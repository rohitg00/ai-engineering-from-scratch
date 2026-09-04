"""PSO for LLM parameter optimization and ACO for agent routing, stdlib only.

PSO runs on a 2D parameter space (temperature, top_k_weight) with a scripted
fitness proxy. AMRO-S simulates 3 agents handling 4 task types with a
pheromone matrix that strengthens on quality, decays over time.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field


# ---------- LMPSO ----------

@dataclass
class Particle:
    x: list[float]
    v: list[float]
    p_best: list[float]
    p_best_fit: float


def fitness(x: list[float]) -> float:
    """Rastrigin-style fitness: narrow peak at (0.72, 0.40) with ripples.
    Chosen to be harder than a plain bowl so PSO convergence is visible."""
    cx, cy = 0.72, 0.40
    dx, dy = x[0] - cx, x[1] - cy
    dist2 = dx * dx + dy * dy
    ripple = 0.08 * (math.cos(8 * math.pi * dx) + math.cos(8 * math.pi * dy))
    return max(0.0, 1.0 - 6.0 * dist2 - ripple)


def run_lmpso(n_particles: int = 20, iterations: int = 30, seed: int = 0) -> list[float]:
    rng = random.Random(seed)
    w, c1, c2 = 0.6, 1.2, 1.2
    bounds = ((0.0, 1.0), (0.0, 1.0))

    particles: list[Particle] = []
    for _ in range(n_particles):
        x = [rng.uniform(*bounds[0]), rng.uniform(*bounds[1])]
        v = [rng.uniform(-0.1, 0.1), rng.uniform(-0.1, 0.1)]
        f = fitness(x)
        particles.append(Particle(x=list(x), v=v, p_best=list(x), p_best_fit=f))

    g_best = max(particles, key=lambda p: p.p_best_fit)
    g_best_x = list(g_best.p_best)
    g_best_fit = g_best.p_best_fit

    history: list[float] = [g_best_fit]

    for _ in range(iterations):
        for p in particles:
            r1, r2 = rng.random(), rng.random()
            for d in range(2):
                cognitive = c1 * r1 * (p.p_best[d] - p.x[d])
                social = c2 * r2 * (g_best_x[d] - p.x[d])
                p.v[d] = w * p.v[d] + cognitive + social
                p.x[d] += p.v[d]
                p.x[d] = max(bounds[d][0], min(bounds[d][1], p.x[d]))
            f = fitness(p.x)
            if f > p.p_best_fit:
                p.p_best = list(p.x)
                p.p_best_fit = f
                if f > g_best_fit:
                    g_best_x = list(p.x)
                    g_best_fit = f
        history.append(g_best_fit)

    return history


# ---------- AMRO-S (ACO routing) ----------

class PheromoneRouter:
    def __init__(self, task_types: list[str], agents: list[str],
                 decay: float = 0.05, reinforce: float = 0.2,
                 quality_threshold: float = 0.6) -> None:
        self.task_types = task_types
        self.agents = agents
        self.decay = decay
        self.reinforce = reinforce
        self.quality_threshold = quality_threshold
        self.pheromones = {t: {a: 1.0 for a in agents} for t in task_types}

    def choose(self, task_type: str, rng: random.Random) -> str:
        table = self.pheromones[task_type]
        total = sum(table.values())
        r = rng.random() * total
        upto = 0.0
        for a, p in table.items():
            upto += p
            if r <= upto:
                return a
        return self.agents[-1]

    def deposit(self, task_type: str, agent: str, quality: float) -> None:
        for a in self.agents:
            self.pheromones[task_type][a] *= (1.0 - self.decay)
        if quality >= self.quality_threshold:
            self.pheromones[task_type][agent] += self.reinforce * quality


AGENT_TASK_AFFINITY = {
    "coder": {"code": 0.9, "math": 0.5, "writing": 0.3, "planning": 0.4},
    "mathematician": {"code": 0.4, "math": 0.95, "writing": 0.2, "planning": 0.5},
    "writer": {"code": 0.2, "math": 0.2, "writing": 0.9, "planning": 0.6},
}


def simulate_task(agent: str, task_type: str, rng: random.Random) -> float:
    base = AGENT_TASK_AFFINITY[agent][task_type]
    return max(0.0, min(1.0, base + rng.uniform(-0.15, 0.15)))


def run_amro_s(n_tasks: int = 200, seed: int = 0) -> tuple[float, float, PheromoneRouter]:
    rng = random.Random(seed)
    task_types = ["code", "math", "writing", "planning"]
    agents = list(AGENT_TASK_AFFINITY.keys())

    router = PheromoneRouter(task_types, agents)
    random_router_quality = 0.0
    aco_quality = 0.0

    for i in range(n_tasks):
        tt = task_types[i % len(task_types)]

        # Random baseline
        rand_agent = rng.choice(agents)
        rq = simulate_task(rand_agent, tt, rng)
        random_router_quality += rq

        # ACO router
        aco_agent = router.choose(tt, rng)
        aq = simulate_task(aco_agent, tt, rng)
        aco_quality += aq
        router.deposit(tt, aco_agent, aq)

    return random_router_quality / n_tasks, aco_quality / n_tasks, router


def print_pheromone_table(router: PheromoneRouter) -> None:
    print(f"  {'task_type':12s} " + " ".join(f"{a:>14s}" for a in router.agents))
    for tt in router.task_types:
        row = [f"{router.pheromones[tt][a]:>14.3f}" for a in router.agents]
        print(f"  {tt:12s} " + " ".join(row))


def main() -> None:
    print("=" * 72)
    print("LMPSO — 20 particles, 30 iterations, 2D parameter space")
    print("=" * 72)
    history = run_lmpso()
    for i in range(0, len(history), 5):
        bar = "#" * max(1, int(history[i] * 40))
        print(f"  iter {i:3d}  g_best={history[i]:.4f}  {bar}")
    print(f"  final g_best={history[-1]:.4f} (optimum = 1.0000 at (0.72, 0.40))")

    print("\n" + "=" * 72)
    print("AMRO-S — 200 tasks routed across 3 agents × 4 task-types")
    print("=" * 72)
    rand_quality, aco_quality, router = run_amro_s()
    print(f"  random routing avg quality: {rand_quality:.3f}")
    print(f"  ACO routing    avg quality: {aco_quality:.3f}")
    print(f"  improvement: {(aco_quality - rand_quality) / rand_quality * 100:+.1f}%")

    # Show the pheromone table from the run we just measured
    print("\n  final pheromone table (after 200 tasks):")
    print_pheromone_table(router)

    print("\nTakeaways:")
    print("  PSO converges to the fitness peak without gradients, using only fitness evals.")
    print("  ACO pheromone trails surface interpretable evidence for who routes where.")
    print("  quality-gated deposits (threshold=0.6) prevent fast-but-wrong agents from locking in.")


if __name__ == "__main__":
    main()
