// Lesson: Swarm Optimization for LLMs (PSO, ACO) (phase 16 / lesson 19)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/19-swarm-optimization-pso-aco/code/main.ts

type Random = () => number;

function mulberry32(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function uniform(rng: Random, a: number, b: number): number {
  return a + (b - a) * rng();
}

function choice<T>(rng: Random, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function signed(x: number, digits: number): string {
  return (x >= 0 ? "+" : "") + x.toFixed(digits);
}

interface Particle {
  x: number[];
  v: number[];
  pBest: number[];
  pBestFit: number;
}

function fitness(x: number[]): number {
  const cx = 0.72;
  const cy = 0.4;
  const dx = x[0] - cx;
  const dy = x[1] - cy;
  const dist2 = dx * dx + dy * dy;
  const ripple = 0.08 * (Math.cos(8 * Math.PI * dx) + Math.cos(8 * Math.PI * dy));
  return Math.max(0.0, 1.0 - 6.0 * dist2 - ripple);
}

function runLmpso(nParticles = 20, iterations = 30, seed = 0): number[] {
  const rng = mulberry32(seed);
  const w = 0.6;
  const c1 = 1.2;
  const c2 = 1.2;
  const bounds: [number, number][] = [
    [0.0, 1.0],
    [0.0, 1.0],
  ];

  const particles: Particle[] = [];
  for (let i = 0; i < nParticles; i++) {
    const x = [uniform(rng, ...bounds[0]), uniform(rng, ...bounds[1])];
    const v = [uniform(rng, -0.1, 0.1), uniform(rng, -0.1, 0.1)];
    const f = fitness(x);
    particles.push({ x: [...x], v, pBest: [...x], pBestFit: f });
  }

  const gBest = particles.reduce((best, p) => (p.pBestFit > best.pBestFit ? p : best));
  let gBestX = [...gBest.pBest];
  let gBestFit = gBest.pBestFit;

  const history: number[] = [gBestFit];

  for (let it = 0; it < iterations; it++) {
    for (const p of particles) {
      const r1 = rng();
      const r2 = rng();
      for (let d = 0; d < 2; d++) {
        const cognitive = c1 * r1 * (p.pBest[d] - p.x[d]);
        const social = c2 * r2 * (gBestX[d] - p.x[d]);
        p.v[d] = w * p.v[d] + cognitive + social;
        p.x[d] += p.v[d];
        p.x[d] = Math.max(bounds[d][0], Math.min(bounds[d][1], p.x[d]));
      }
      const f = fitness(p.x);
      if (f > p.pBestFit) {
        p.pBest = [...p.x];
        p.pBestFit = f;
        if (f > gBestFit) {
          gBestX = [...p.x];
          gBestFit = f;
        }
      }
    }
    history.push(gBestFit);
  }

  return history;
}

class PheromoneRouter {
  pheromones: Map<string, Map<string, number>>;

  constructor(
    public taskTypes: string[],
    public agents: string[],
    public decay = 0.05,
    public reinforce = 0.2,
    public qualityThreshold = 0.6,
  ) {
    this.pheromones = new Map(taskTypes.map((t) => [t, new Map(agents.map((a) => [a, 1.0]))]));
  }

  choose(taskType: string, rng: Random): string {
    const table = this.pheromones.get(taskType)!;
    let total = 0;
    for (const p of table.values()) {
      total += p;
    }
    const r = rng() * total;
    let upto = 0.0;
    for (const [a, p] of table) {
      upto += p;
      if (r <= upto) {
        return a;
      }
    }
    return this.agents[this.agents.length - 1];
  }

  deposit(taskType: string, agent: string, quality: number): void {
    const table = this.pheromones.get(taskType)!;
    for (const a of this.agents) {
      table.set(a, table.get(a)! * (1.0 - this.decay));
    }
    if (quality >= this.qualityThreshold) {
      table.set(agent, table.get(agent)! + this.reinforce * quality);
    }
  }
}

const AGENT_TASK_AFFINITY: Record<string, Record<string, number>> = {
  coder: { code: 0.9, math: 0.5, writing: 0.3, planning: 0.4 },
  mathematician: { code: 0.4, math: 0.95, writing: 0.2, planning: 0.5 },
  writer: { code: 0.2, math: 0.2, writing: 0.9, planning: 0.6 },
};

function simulateTask(agent: string, taskType: string, rng: Random): number {
  const base = AGENT_TASK_AFFINITY[agent][taskType];
  return Math.max(0.0, Math.min(1.0, base + uniform(rng, -0.15, 0.15)));
}

function runAmroS(nTasks = 200, seed = 0): [number, number, PheromoneRouter] {
  const rng = mulberry32(seed);
  const taskTypes = ["code", "math", "writing", "planning"];
  const agents = Object.keys(AGENT_TASK_AFFINITY);

  const router = new PheromoneRouter(taskTypes, agents);
  let randomRouterQuality = 0.0;
  let acoQuality = 0.0;

  for (let i = 0; i < nTasks; i++) {
    const tt = taskTypes[i % taskTypes.length];

    const randAgent = choice(rng, agents);
    const rq = simulateTask(randAgent, tt, rng);
    randomRouterQuality += rq;

    const acoAgent = router.choose(tt, rng);
    const aq = simulateTask(acoAgent, tt, rng);
    acoQuality += aq;
    router.deposit(tt, acoAgent, aq);
  }

  return [randomRouterQuality / nTasks, acoQuality / nTasks, router];
}

function printPheromoneTable(router: PheromoneRouter): void {
  console.log(`  ${"task_type".padEnd(12)} ` + router.agents.map((a) => a.padStart(14)).join(" "));
  for (const tt of router.taskTypes) {
    const row = router.agents.map((a) => router.pheromones.get(tt)!.get(a)!.toFixed(3).padStart(14));
    console.log(`  ${tt.padEnd(12)} ` + row.join(" "));
  }
}

function main(): void {
  console.log("=".repeat(72));
  console.log("LMPSO: 20 particles, 30 iterations, 2D parameter space");
  console.log("=".repeat(72));
  const history = runLmpso();
  for (let i = 0; i < history.length; i += 5) {
    const bar = "#".repeat(Math.max(1, Math.trunc(history[i] * 40)));
    console.log(`  iter ${String(i).padStart(3)}  g_best=${history[i].toFixed(4)}  ${bar}`);
  }
  console.log(
    `  final g_best=${history[history.length - 1].toFixed(4)} (optimum = 1.0000 at (0.72, 0.40))`,
  );

  console.log("\n" + "=".repeat(72));
  console.log("AMRO-S: 200 tasks routed across 3 agents × 4 task-types");
  console.log("=".repeat(72));
  const [randQuality, acoQuality, router] = runAmroS();
  console.log(`  random routing avg quality: ${randQuality.toFixed(3)}`);
  console.log(`  ACO routing    avg quality: ${acoQuality.toFixed(3)}`);
  console.log(`  improvement: ${signed(((acoQuality - randQuality) / randQuality) * 100, 1)}%`);

  console.log("\n  final pheromone table (after 200 tasks):");
  printPheromoneTable(router);

  console.log("\nTakeaways:");
  console.log("  PSO converges to the fitness peak without gradients, using only fitness evals.");
  console.log("  ACO pheromone trails surface interpretable evidence for who routes where.");
  console.log("  quality-gated deposits (threshold=0.6) prevent fast-but-wrong agents from locking in.");
}

main();

export {};
