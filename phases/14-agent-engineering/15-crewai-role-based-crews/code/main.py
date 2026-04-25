"""CrewAI-shaped Crew and Flow primitives in stdlib.

Crew = role-based autonomous collaboration. Flow = event-driven deterministic.
Same three-step task (research, outline, draft) implemented both ways.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class Agent:
    role: str
    goal: str
    backstory: str
    fn: Callable[..., str]


@dataclass
class Task:
    description: str
    expected_output: str
    agent: Agent
    inputs: dict[str, Any] = field(default_factory=dict)


@dataclass
class SequentialCrew:
    agents: list[Agent]
    tasks: list[Task]

    def kickoff(self, context: dict[str, Any]) -> list[str]:
        outputs: list[str] = []
        running = context.get("topic", "")
        for task in self.tasks:
            out = task.agent.fn(running)
            outputs.append(f"[{task.agent.role}] {out}")
            running = out
        return outputs


@dataclass
class HierarchicalCrew:
    manager: Agent
    specialists: dict[str, Agent]
    max_steps: int = 5

    def kickoff(self, topic: str) -> list[str]:
        outputs: list[str] = []
        current = topic
        done: set[str] = set()
        for _ in range(self.max_steps):
            pick = self.manager.fn(done)
            if pick == "done":
                outputs.append("[manager] done")
                break
            specialist = self.specialists.get(pick)
            if specialist is None:
                outputs.append(f"[manager] unknown pick {pick!r}")
                break
            out = specialist.fn(current)
            outputs.append(f"[{specialist.role}] {out}")
            current = out
            done.add(pick)
        return outputs


class Flow:
    """Deterministic event-driven workflow. start() fires on kickoff;
    listen(topic) fires when another step emits that topic.
    """

    def __init__(self) -> None:
        self.start_step: Callable[[Any], tuple[str, Any]] | None = None
        self.listeners: dict[str, Callable[[Any], tuple[str, Any] | None]] = {}
        self.trace: list[tuple[str, str, Any]] = []

    def start(self, fn: Callable[[Any], tuple[str, Any]]) -> Callable[..., Any]:
        self.start_step = fn
        return fn

    def listen(self, topic: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        def decorator(fn: Callable[[Any], tuple[str, Any] | None]) -> Callable[..., Any]:
            self.listeners[topic] = fn
            return fn
        return decorator

    def kickoff(self, payload: Any) -> list[tuple[str, str, Any]]:
        if self.start_step is None:
            return []
        self.trace = []
        topic, out = self.start_step(payload)
        self.trace.append(("start", topic, out))
        while topic in self.listeners:
            step = self.listeners[topic]
            result = step(out)
            if result is None:
                break
            topic, out = result
            self.trace.append((step.__name__, topic, out))
        return self.trace


def _researcher(topic: str) -> str:
    return f"research: {topic} - 3 sources gathered"


def _outliner(prior: str) -> str:
    return f"outline: 3 sections from '{prior[:30]}...'"


def _drafter(prior: str) -> str:
    return f"draft: 800 words based on '{prior[:30]}...'"


def _manager(done: set[str]) -> str:
    if "researcher" not in done:
        return "researcher"
    if "outliner" not in done:
        return "outliner"
    if "drafter" not in done:
        return "drafter"
    return "done"


def main() -> None:
    print("=" * 70)
    print("CREWAI CREW AND FLOW — Phase 14, Lesson 15")
    print("=" * 70)

    researcher = Agent(role="researcher", goal="find 3 sources",
                       backstory="former librarian, terse", fn=_researcher)
    outliner = Agent(role="outliner", goal="structure the piece",
                     backstory="writes in threes", fn=_outliner)
    drafter = Agent(role="drafter", goal="turn outline into prose",
                    backstory="editorial voice", fn=_drafter)

    print("\n1. SequentialCrew (autonomous role-based)")
    crew = SequentialCrew(
        agents=[researcher, outliner, drafter],
        tasks=[
            Task(description="research topic", expected_output="sources",
                 agent=researcher),
            Task(description="outline", expected_output="3 sections",
                 agent=outliner),
            Task(description="draft", expected_output="800 words",
                 agent=drafter),
        ],
    )
    for line in crew.kickoff({"topic": "agent engineering 2026"}):
        print(f"  {line}")

    print("\n2. HierarchicalCrew (manager routes)")
    manager = Agent(role="manager", goal="pick next specialist",
                    backstory="PM background", fn=_manager)
    hcrew = HierarchicalCrew(
        manager=manager,
        specialists={"researcher": researcher, "outliner": outliner,
                     "drafter": drafter},
    )
    for line in hcrew.kickoff("agent engineering 2026"):
        print(f"  {line}")

    print("\n3. Flow (event-driven deterministic)")
    flow = Flow()

    @flow.start
    def kickoff(topic: str) -> tuple[str, str]:
        return "researched", _researcher(topic)

    @flow.listen("researched")
    def on_researched(prior: str) -> tuple[str, str]:
        return "outlined", _outliner(prior)

    @flow.listen("outlined")
    def on_outlined(prior: str) -> tuple[str, str]:
        return "drafted", _drafter(prior)

    @flow.listen("drafted")
    def on_drafted(prior: str) -> None:
        return None

    for step_name, topic, output in flow.kickoff("agent engineering 2026"):
        print(f"  [{step_name}] -> topic={topic!r} output={output}")

    print()
    print("Crew: variable, LLM picks the shape. Flow: fixed, code owns the shape.")
    print("CrewAI 2026 docs: start production with Flow; fold Crews in as sub-steps.")


if __name__ == "__main__":
    main()
