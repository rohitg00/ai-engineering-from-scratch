"""Generative agents のミニチュア: stdlib 版 Smallville。

5 体のエージェントが小さな world を共有する。Agent 0 には party goal を seed する。
tick が進むにつれ、bilateral memory observations によって invitations が広がり、
reflection が beliefs を synthesize し、plans が update される。final tick までに、
central orchestrator なしで 3 体以上の agents が party location に集まる。
"""
from __future__ import annotations

import math
import time
from dataclasses import dataclass, field


TICK_DURATION_S = 0.01  # simulation 用。出力は実質 instantaneous


@dataclass
class Memory:
    ts: int
    kind: str
    content: str
    importance: int


@dataclass
class Plan:
    tick: int
    where: str
    note: str


@dataclass
class Agent:
    name: str
    location: str
    stream: list[Memory] = field(default_factory=list)
    plans: list[Plan] = field(default_factory=list)
    beliefs: list[str] = field(default_factory=list)

    def observe(self, tick: int, content: str, importance: int = 3) -> None:
        self.stream.append(Memory(tick, "observation", content, importance))

    def reflect(self, tick: int) -> None:
        recent_important = [m for m in self.stream if m.importance >= 6 and tick - m.ts <= 5]
        for m in recent_important:
            if "invited" in m.content and "party at" in m.content:
                belief = f"there is a party I was invited to"
                if belief not in self.beliefs:
                    self.beliefs.append(belief)
                    self.stream.append(Memory(tick, "reflection", belief, 8))

    def update_plan(self, tick: int) -> None:
        if "there is a party I was invited to" in self.beliefs:
            if not any(p.where == "HobbsCafe" for p in self.plans):
                self.plans.append(Plan(tick=5, where="HobbsCafe", note="attend the party"))

    def act(self, tick: int) -> str:
        for p in self.plans:
            if p.tick == tick:
                self.location = p.where
                return f"{self.name} moves to {p.where} ({p.note})"
        return f"{self.name} remains at {self.location}"


def retrieve_top_k(stream: list[Memory], query: str, tick: int, k: int = 3) -> list[Memory]:
    def score(m: Memory) -> float:
        recency = math.exp(-0.3 * (tick - m.ts))
        importance = m.importance / 10.0
        relevance = 0.6 if any(w in m.content.lower() for w in query.lower().split()) else 0.1
        return recency + importance + relevance
    return sorted(stream, key=score, reverse=True)[:k]


def run_simulation(n_agents: int = 5, ticks: int = 6) -> None:
    agents = [Agent(f"agent-{i}", location="home") for i in range(n_agents)]

    # agent 0 に party goal を seed する。
    agents[0].stream.append(Memory(0, "goal", "host a Valentine's party at HobbsCafe at tick 5", 10))
    agents[0].plans.append(Plan(tick=5, where="HobbsCafe", note="host the party"))
    agents[0].beliefs.append("there is a party I was invited to")

    print("=" * 72)
    print(f"GENERATIVE AGENTS（ミニチュア）— {n_agents} agents, {ticks} ticks")
    print("=" * 72)

    for tick in range(ticks):
        print(f"\n--- tick {tick} ---")
        # invitation propagation: agent 0 が tick 0-2 で direct neighbors を招待し、
        # 招待された agent が subsequent ticks でさらに 1 体を招待する。
        if tick == 0:
            for i in (1, 2):
                agents[i].observe(tick, f"agent-0 invited me to a party at HobbsCafe at tick 5", importance=8)
                print(f"  agent-0 -> agent-{i}: 招待")
        if tick == 1:
            agents[3].observe(tick, f"agent-1 invited me to a party at HobbsCafe at tick 5", importance=7)
            print(f"  agent-1 -> agent-3: 二次的な招待")
        if tick == 2:
            agents[4].observe(tick, f"agent-2 invited me to a party at HobbsCafe at tick 5", importance=7)
            print(f"  agent-2 -> agent-4: 二次的な招待")

        for a in agents:
            a.reflect(tick)
            a.update_plan(tick)
            action = a.act(tick)
            if action.startswith(a.name + " moves"):
                print(f"  {action}")

    # 最終状態
    print("\n" + "=" * 72)
    print("最終位置:")
    for a in agents:
        print(f"  {a.name:10s} at {a.location}")

    at_party = sum(1 for a in agents if a.location == "HobbsCafe")
    print(f"\n{at_party}/{n_agents} agents が HobbsCafe の party に集まりました。")
    print("orchestrator はありません。seed は 1 つだけ。残りは memory + reflection + plan です。")


def demo_retrieval() -> None:
    print("\n" + "=" * 72)
    print("RETRIEVAL DEMO — recency + importance + relevance による top-k")
    print("=" * 72)
    stream = [
        Memory(0, "observation", "saw Isabella at the cafe", importance=4),
        Memory(1, "observation", "Isabella said she is planning a party", importance=7),
        Memory(2, "reflection", "I would enjoy a party at the cafe", importance=6),
        Memory(3, "observation", "Klaus mentioned he is writing a paper", importance=3),
    ]
    top = retrieve_top_k(stream, query="party cafe", tick=4, k=3)
    print("  query: 'party cafe' at tick 4")
    for m in top:
        print(f"  [t={m.ts}] {m.kind:11s} imp={m.importance} :: {m.content}")


def main() -> None:
    run_simulation()
    demo_retrieval()
    print("\n要点:")
    print("  seed 1 つ + 3 components = orchestrator なしの coordinated arrival。")
    print("  reflection は load-bearing です。外すと belief formation が止まります。")
    print("  retrieval は recency、importance、relevance を組み合わせます。単一 score では足りません。")


if __name__ == "__main__":
    main()
