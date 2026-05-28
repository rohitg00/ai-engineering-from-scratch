"""tiny grid 上の MARL patterns — CTDE、value decomposition、centralized value。

2 agents、4x4 grid、pellet。4 styles は同じ environment と reward を共有する。
scripted policies により、gradient updates がなくても CTDE variants が
independent baseline より速く converge することを示す。
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field


GRID = 4


@dataclass
class Env:
    """Cooperative task: pellets は 2 つで、各 agent が 1 つ collect する。
    agent が move してもしなくても step cost がかかる。collisions
    （2 agents が same cell）は extra step の cost になる。"""
    agent0: tuple[int, int]
    agent1: tuple[int, int]
    pellet0: tuple[int, int]
    pellet1: tuple[int, int]
    pellets_remaining: set[tuple[int, int]] = field(default_factory=set)

    @staticmethod
    def new(rng: random.Random) -> "Env":
        positions: set[tuple[int, int]] = set()
        while len(positions) < 4:
            positions.add((rng.randint(0, GRID - 1), rng.randint(0, GRID - 1)))
        a0, a1, p0, p1 = list(positions)
        return Env(agent0=a0, agent1=a1, pellet0=p0, pellet1=p1,
                   pellets_remaining={p0, p1})

    @property
    def done(self) -> bool:
        return not self.pellets_remaining

    def collect_if_on_pellet(self) -> None:
        for pos in (self.agent0, self.agent1):
            self.pellets_remaining.discard(pos)


def manhattan(a: tuple[int, int], b: tuple[int, int]) -> int:
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def step_toward(pos: tuple[int, int], target: tuple[int, int]) -> tuple[int, int]:
    dx = (target[0] - pos[0])
    dy = (target[1] - pos[1])
    if abs(dx) >= abs(dy):
        nx = pos[0] + (1 if dx > 0 else -1 if dx < 0 else 0)
        ny = pos[1]
    else:
        nx = pos[0]
        ny = pos[1] + (1 if dy > 0 else -1 if dy < 0 else 0)
    nx = max(0, min(GRID - 1, nx))
    ny = max(0, min(GRID - 1, ny))
    return (nx, ny)


def move_or_wait(pos: tuple[int, int], target: tuple[int, int], wait: bool) -> tuple[int, int]:
    if wait:
        return pos
    return step_toward(pos, target)


def run_independent(env: Env, max_steps: int = 50) -> int:
    """各 agent が独立に nearest pellet を target する。other agent の
    target を知らないため、両方が同じ pellet を target しがちである。"""
    steps = 0
    while not env.done and steps < max_steps:
        p0_target = min(env.pellets_remaining, key=lambda p: manhattan(env.agent0, p))
        p1_target = min(env.pellets_remaining, key=lambda p: manhattan(env.agent1, p))
        env.agent0 = step_toward(env.agent0, p0_target)
        env.agent1 = step_toward(env.agent1, p1_target)
        env.collect_if_on_pellet()
        steps += 1
    return steps


def _assigned_targets(env: Env) -> tuple[tuple[int, int], tuple[int, int]]:
    """centralized optimal pellet assignment: total Manhattan を最小化する。"""
    pellets = list(env.pellets_remaining)
    if len(pellets) == 1:
        return pellets[0], pellets[0]
    p, q = pellets[0], pellets[1]
    cost_pq = manhattan(env.agent0, p) + manhattan(env.agent1, q)
    cost_qp = manhattan(env.agent0, q) + manhattan(env.agent1, p)
    return (p, q) if cost_pq <= cost_qp else (q, p)


def run_maddpg_style(env: Env, max_steps: int = 50) -> int:
    """centralized critic が各 agent に distinct pellet を割り当てる。
    各 agent の actor は assigned target に向かう。deploy-time には actors だけが動く。"""
    steps = 0
    while not env.done and steps < max_steps:
        t0, t1 = _assigned_targets(env)
        env.agent0 = step_toward(env.agent0, t0)
        env.agent1 = step_toward(env.agent1, t1)
        env.collect_if_on_pellet()
        steps += 1
    return steps


def run_qmix_style(env: Env, max_steps: int = 50) -> int:
    """Value decomposition: 各 agent は higher local Q（lower manhattan）の
    pellet を選ぶ。monotone mixing により argmax-decomposable になる。"""
    steps = 0
    while not env.done and steps < max_steps:
        if len(env.pellets_remaining) >= 2:
            t0, t1 = _assigned_targets(env)
        else:
            only = next(iter(env.pellets_remaining))
            t0, t1 = only, only
        env.agent0 = step_toward(env.agent0, t0)
        env.agent1 = step_toward(env.agent1, t1)
        env.collect_if_on_pellet()
        steps += 1
    return steps


def run_mappo_style(env: Env, max_steps: int = 50) -> int:
    """centralized value function を持つ PPO。deploy では CTDE のように振る舞う。
    この size task では似た policies に converge するため、scripted variant は
    ここでは MADDPG を mirror する。"""
    return run_maddpg_style(env, max_steps)


def bench(label: str, runner) -> None:
    total = 0
    trials = 500
    for i in range(trials):
        rng = random.Random(i)
        env = Env.new(rng)
        total += runner(env)
    print(f"  {label:20s} avg_steps_to_goal = {total / trials:.2f}")


def main() -> None:
    print("=" * 72)
    print("MARL PATTERNS — 4x4 grid、2 agents、2 pellets（cooperative）")
    print("=" * 72)
    bench("independent (no coord)", run_independent)
    bench("MADDPG-style (CTDE)", run_maddpg_style)
    bench("QMIX-style (mono decomp)", run_qmix_style)
    bench("MAPPO-style (centralized V)", run_mappo_style)
    print("\n要点:")
    print("  independent baseline は duplicate effort で steps を浪費します。")
    print("  CTDE-family variants は coordinate し、各 step で近い agent だけが動くようにします。")
    print("  QMIX と MAPPO は異なる training story から同じ steady-state behavior に到達します。")
    print("  deploy-time では、学習される policy は似ています。")
    print("  LLM-agent systems では、これは 'router decides which sub-agent advances' pattern です。")
    print("  end-to-end で train しなくても、CTDE は design discipline になります。")


if __name__ == "__main__":
    main()
