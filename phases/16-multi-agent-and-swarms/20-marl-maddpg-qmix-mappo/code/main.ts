// Lesson: MARL: MADDPG, QMIX, MAPPO (phase 16 / lesson 20)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/20-marl-maddpg-qmix-mappo/code/main.ts

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

function randint(rng: Random, a: number, b: number): number {
  return a + Math.floor(rng() * (b - a + 1));
}

const GRID = 4;

type Pos = [number, number];

function key(p: Pos): string {
  return `${p[0]},${p[1]}`;
}

class Env {
  pelletsRemaining: Map<string, Pos>;

  constructor(
    public agent0: Pos,
    public agent1: Pos,
    public pellet0: Pos,
    public pellet1: Pos,
  ) {
    this.pelletsRemaining = new Map([
      [key(pellet0), pellet0],
      [key(pellet1), pellet1],
    ]);
  }

  static create(rng: Random): Env {
    const positions = new Map<string, Pos>();
    while (positions.size < 4) {
      const p: Pos = [randint(rng, 0, GRID - 1), randint(rng, 0, GRID - 1)];
      positions.set(key(p), p);
    }
    const [a0, a1, p0, p1] = [...positions.values()];
    return new Env(a0, a1, p0, p1);
  }

  get done(): boolean {
    return this.pelletsRemaining.size === 0;
  }

  collectIfOnPellet(): void {
    for (const pos of [this.agent0, this.agent1]) {
      this.pelletsRemaining.delete(key(pos));
    }
  }
}

function manhattan(a: Pos, b: Pos): number {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

function sign(x: number): number {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

function stepToward(pos: Pos, target: Pos): Pos {
  const dx = target[0] - pos[0];
  const dy = target[1] - pos[1];
  let nx: number;
  let ny: number;
  if (Math.abs(dx) >= Math.abs(dy)) {
    nx = pos[0] + sign(dx);
    ny = pos[1];
  } else {
    nx = pos[0];
    ny = pos[1] + sign(dy);
  }
  nx = Math.max(0, Math.min(GRID - 1, nx));
  ny = Math.max(0, Math.min(GRID - 1, ny));
  return [nx, ny];
}

function moveOrWait(pos: Pos, target: Pos, wait: boolean): Pos {
  if (wait) {
    return pos;
  }
  return stepToward(pos, target);
}

function nearest(from: Pos, pellets: Pos[]): Pos {
  return pellets.reduce((best, p) => (manhattan(from, p) < manhattan(from, best) ? p : best));
}

function runIndependent(env: Env, maxSteps = 50): number {
  let steps = 0;
  while (!env.done && steps < maxSteps) {
    const pellets = [...env.pelletsRemaining.values()];
    const p0Target = nearest(env.agent0, pellets);
    const p1Target = nearest(env.agent1, pellets);
    env.agent0 = stepToward(env.agent0, p0Target);
    env.agent1 = stepToward(env.agent1, p1Target);
    env.collectIfOnPellet();
    steps += 1;
  }
  return steps;
}

function assignedTargets(env: Env): [Pos, Pos] {
  const pellets = [...env.pelletsRemaining.values()];
  if (pellets.length === 1) {
    return [pellets[0], pellets[0]];
  }
  const [p, q] = pellets;
  const costPq = manhattan(env.agent0, p) + manhattan(env.agent1, q);
  const costQp = manhattan(env.agent0, q) + manhattan(env.agent1, p);
  return costPq <= costQp ? [p, q] : [q, p];
}

function runMaddpgStyle(env: Env, maxSteps = 50): number {
  let steps = 0;
  while (!env.done && steps < maxSteps) {
    const [t0, t1] = assignedTargets(env);
    env.agent0 = stepToward(env.agent0, t0);
    env.agent1 = stepToward(env.agent1, t1);
    env.collectIfOnPellet();
    steps += 1;
  }
  return steps;
}

function runQmixStyle(env: Env, maxSteps = 50): number {
  let steps = 0;
  while (!env.done && steps < maxSteps) {
    let t0: Pos;
    let t1: Pos;
    if (env.pelletsRemaining.size >= 2) {
      [t0, t1] = assignedTargets(env);
    } else {
      const only = env.pelletsRemaining.values().next().value as Pos;
      t0 = only;
      t1 = only;
    }
    env.agent0 = stepToward(env.agent0, t0);
    env.agent1 = stepToward(env.agent1, t1);
    env.collectIfOnPellet();
    steps += 1;
  }
  return steps;
}

function runMappoStyle(env: Env, maxSteps = 50): number {
  return runMaddpgStyle(env, maxSteps);
}

function bench(label: string, runner: (env: Env) => number): void {
  let total = 0;
  const trials = 500;
  for (let i = 0; i < trials; i++) {
    const rng = mulberry32(i);
    const env = Env.create(rng);
    total += runner(env);
  }
  console.log(`  ${label.padEnd(20)} avg_steps_to_goal = ${(total / trials).toFixed(2)}`);
}

function main(): void {
  console.log("=".repeat(72));
  console.log("MARL PATTERNS on a 4x4 grid with 2 agents and 2 pellets (cooperative)");
  console.log("=".repeat(72));
  bench("independent (no coord)", runIndependent);
  bench("MADDPG-style (CTDE)", runMaddpgStyle);
  bench("QMIX-style (mono decomp)", runQmixStyle);
  bench("MAPPO-style (centralized V)", runMappoStyle);
  console.log("\nTakeaways:");
  console.log("  independent baseline wastes steps on duplicate effort.");
  console.log("  CTDE-family variants coordinate so only the closer agent moves per step.");
  console.log("  QMIX and MAPPO reach the same steady-state behavior with different training");
  console.log("  stories; at deploy-time the policy they learn is similar.");
  console.log("  In LLM-agent systems, this is the 'router decides which sub-agent advances'");
  console.log("  pattern. CTDE is a design discipline even when you do not train end-to-end.");
}

main();

export {};
