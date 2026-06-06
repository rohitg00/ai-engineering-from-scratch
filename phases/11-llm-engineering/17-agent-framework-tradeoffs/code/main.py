"""Decision-tree recommender for agent frameworks.

Takes a problem descriptor and recommends LangGraph, CrewAI, AutoGen, Agno, or
"no framework" with a one-sentence justification. The tree encodes the tradeoffs
described in docs/en.md.

Run:
    python main.py           # runs the bundled test suite
    python main.py --ask     # interactive prompt mode
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from typing import Callable


@dataclass(frozen=True)
class Problem:
    """Shape descriptor for an agentic task."""

    has_typed_state: bool = False
    has_roles: bool = False
    has_dialogue: bool = False
    has_parallel_fanout: bool = False
    needs_resume: bool = False
    needs_human_interrupt: bool = False
    total_llm_calls: int = 1
    needs_session_memory: bool = False


@dataclass(frozen=True)
class Recommendation:
    framework: str
    reason: str


def recommend(p: Problem) -> Recommendation:
    # Smallest-first: if it's 2 or fewer calls, skip the framework entirely.
    if p.total_llm_calls <= 2 and not any(
        (p.has_roles, p.has_dialogue, p.needs_resume, p.has_parallel_fanout, p.needs_human_interrupt)
    ):
        return Recommendation(
            "plain python",
            "Two or fewer LLM calls with no state, roles, dialogue, fanout, "
            "or resume needs; a framework is pure overhead.",
        )

    # Durable state or human interrupts or time-travel -> LangGraph.
    if p.needs_resume or p.needs_human_interrupt or p.has_parallel_fanout:
        return Recommendation(
            "langgraph",
            "Typed state, checkpointer, interrupts, and Send fanout are only "
            "first-class in LangGraph.",
        )

    # Dialogue-shaped problem -> AutoGen.
    if p.has_dialogue and not p.has_typed_state:
        return Recommendation(
            "autogen",
            "Proposer-critic or teacher-student dialogue is AutoGen's native "
            "shape; GroupChat selects speakers without hand-wiring.",
        )

    # Role-driven pipeline -> CrewAI.
    if p.has_roles and not p.has_typed_state:
        return Recommendation(
            "crewai",
            "Specialist roles with a short sequential or hierarchical plan "
            "are cheapest to express in CrewAI.",
        )

    # Single agent + sessions -> Agno.
    if p.needs_session_memory and not p.has_roles and not p.has_dialogue:
        return Recommendation(
            "agno",
            "Single agent with tools and persistent session memory; Agno's "
            "storage drivers are built in.",
        )

    # Typed state but no other signals still points at LangGraph.
    if p.has_typed_state:
        return Recommendation(
            "langgraph",
            "Typed state is LangGraph's core abstraction; map your TypedDict "
            "onto a StateGraph.",
        )

    # Fallback.
    return Recommendation(
        "langgraph",
        "Default for multi-step agents with any uncertainty about future state "
        "or branching needs.",
    )


# Tests -----------------------------------------------------------------------


def _check(label: str, actual: Recommendation, expected_framework: str) -> bool:
    ok = actual.framework == expected_framework
    tag = "OK " if ok else "FAIL"
    print(f"[{tag}] {label:<60}  -> {actual.framework:<14} // {actual.reason}")
    return ok


def run_tests() -> int:
    cases: list[tuple[str, Problem, str]] = [
        (
            "two-call summarizer, no state",
            Problem(total_llm_calls=2),
            "plain python",
        ),
        (
            "long-running workflow with human approval",
            Problem(has_typed_state=True, needs_human_interrupt=True, total_llm_calls=8),
            "langgraph",
        ),
        (
            "research with parallel fanout to three retrievers",
            Problem(has_typed_state=True, has_parallel_fanout=True, total_llm_calls=5),
            "langgraph",
        ),
        (
            "proposer-critic coding loop",
            Problem(has_dialogue=True, total_llm_calls=10),
            "autogen",
        ),
        (
            "marketing pipeline with researcher/writer/editor roles",
            Problem(has_roles=True, total_llm_calls=4),
            "crewai",
        ),
        (
            "chat assistant with persistent user memory",
            Problem(needs_session_memory=True, total_llm_calls=6),
            "agno",
        ),
        (
            "workflow that must resume after crash",
            Problem(has_typed_state=True, needs_resume=True, total_llm_calls=12),
            "langgraph",
        ),
    ]

    failures = 0
    for label, problem, expected in cases:
        if not _check(label, recommend(problem), expected):
            failures += 1
    print()
    print(f"{len(cases) - failures}/{len(cases)} cases passed.")
    return 0 if failures == 0 else 1


def run_interactive() -> int:
    def yes(prompt: str) -> bool:
        return input(f"{prompt} [y/N] ").strip().lower().startswith("y")

    p = Problem(
        has_typed_state=yes("Typed state / explicit state schema?"),
        has_roles=yes("Specialist roles with distinct goals?"),
        has_dialogue=yes("Multi-agent dialogue (speaker-ordering emergent)?"),
        has_parallel_fanout=yes("Parallel fanout across N sub-workers?"),
        needs_resume=yes("Must resume after process restart?"),
        needs_human_interrupt=yes("Needs human approval mid-run?"),
        total_llm_calls=int(input("Approx LLM calls per run? ").strip() or "1"),
        needs_session_memory=yes("Needs durable per-user session memory?"),
    )
    r = recommend(p)
    print()
    print(json.dumps({"framework": r.framework, "reason": r.reason}, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ask", action="store_true", help="interactive mode")
    args = parser.parse_args()
    return run_interactive() if args.ask else run_tests()


if __name__ == "__main__":
    sys.exit(main())
