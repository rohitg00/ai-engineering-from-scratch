// Lesson: Sim-to-Real Transfer (phase 09 / lesson 11)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/09-reinforcement-learning/11-sim-to-real-transfer/docs/en.md
// Run: npx tsx phases/09-reinforcement-learning/11-sim-to-real-transfer/code/main.ts

class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  random(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  uniform(a: number, b: number): number {
    return a + (b - a) * this.random();
  }

  choice<T>(items: readonly T[]): T {
    return items[Math.floor(this.random() * items.length)];
  }
}

type State = [number, number];
type Action = "up" | "down" | "left" | "right";
type QRow = Map<Action, number>;

const GRID = 5;
const TERMINAL: State = [GRID - 1, GRID - 1];
const ACTIONS: readonly Action[] = ["up", "down", "left", "right"];
const DELTAS: Record<Action, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

class QTable {
  readonly rows = new Map<string, QRow>();

  get(s: State): QRow {
    const k = `${s[0]},${s[1]}`;
    let row = this.rows.get(k);
    if (row === undefined) {
      row = defaultQ();
      this.rows.set(k, row);
    }
    return row;
  }
}

function isTerminal(s: State): boolean {
  return s[0] === TERMINAL[0] && s[1] === TERMINAL[1];
}

function step(state: State, action: Action, slip: number, rng: Random): [State, number, boolean] {
  if (isTerminal(state)) return [state, 0.0, true];
  let act = action;
  if (rng.random() < slip) {
    const perp: Action[] = act === "up" || act === "down" ? ["left", "right"] : ["up", "down"];
    act = rng.choice(perp);
  }
  const [dr, dc] = DELTAS[act];
  const [r, c] = state;
  const nr = Math.min(Math.max(r + dr, 0), GRID - 1);
  const nc = Math.min(Math.max(c + dc, 0), GRID - 1);
  const next: State = [nr, nc];
  return [next, -1.0, isTerminal(next)];
}

function defaultQ(): QRow {
  return new Map(ACTIONS.map((a) => [a, 0.0]));
}

function argmaxAction(q: QRow): Action {
  let best = ACTIONS[0];
  for (const a of ACTIONS) if (q.get(a)! > q.get(best)!) best = a;
  return best;
}

function epsilonGreedy(Q: QTable, s: State, rng: Random, eps: number): Action {
  if (rng.random() < eps) return rng.choice(ACTIONS);
  return argmaxAction(Q.get(s));
}

function trainFixed(slip: number, episodes = 3000, alpha = 0.1, gamma = 0.95, eps = 0.15, rng: Random = new Random(0)): QTable {
  const Q = new QTable();
  for (let ep = 0; ep < episodes; ep++) {
    let s: State = [0, 0];
    for (let t = 0; t < 100; t++) {
      const a = epsilonGreedy(Q, s, rng, eps);
      const [sNext, r, done] = step(s, a, slip, rng);
      const row = Q.get(s);
      if (done) {
        row.set(a, row.get(a)! + alpha * (r - row.get(a)!));
        break;
      }
      const bestNext = Math.max(...Q.get(sNext).values());
      row.set(a, row.get(a)! + alpha * (r + gamma * bestNext - row.get(a)!));
      s = sNext;
    }
  }
  return Q;
}

function trainDr(
  slipLow: number,
  slipHigh: number,
  episodes = 3000,
  alpha = 0.1,
  gamma = 0.95,
  eps = 0.15,
  rng: Random = new Random(0),
): QTable {
  const Q = new QTable();
  for (let ep = 0; ep < episodes; ep++) {
    const slipEp = rng.uniform(slipLow, slipHigh);
    let s: State = [0, 0];
    for (let t = 0; t < 100; t++) {
      const a = epsilonGreedy(Q, s, rng, eps);
      const [sNext, r, done] = step(s, a, slipEp, rng);
      const row = Q.get(s);
      if (done) {
        row.set(a, row.get(a)! + alpha * (r - row.get(a)!));
        break;
      }
      const bestNext = Math.max(...Q.get(sNext).values());
      row.set(a, row.get(a)! + alpha * (r + gamma * bestNext - row.get(a)!));
      s = sNext;
    }
  }
  return Q;
}

function evaluate(Q: QTable, slip: number, episodes = 200, rng: Random = new Random(42)): number {
  let total = 0.0;
  for (let ep = 0; ep < episodes; ep++) {
    let s: State = [0, 0];
    let epTotal = 0.0;
    for (let t = 0; t < 100; t++) {
      const a = argmaxAction(Q.get(s));
      const [next, r, done] = step(s, a, slip, rng);
      s = next;
      epTotal += r;
      if (done) break;
    }
    total += epTotal;
  }
  return total / episodes;
}

function main(): void {
  console.log(`=== sim-to-real: train in 'sim', evaluate on 'real' ===`);
  console.log(`env: ${GRID}x${GRID} GridWorld, slip = probability of perpendicular slip`);
  console.log();

  console.log("training two policies with same compute budget:");
  console.log("  policy A: fixed slip = 0.0 (no domain randomization)");
  console.log("  policy B: slip ~ Uniform[0.0, 0.3] (domain randomization)");
  console.log();

  let rng = new Random(6);
  const qFixed = trainFixed(0.0, 3000, 0.1, 0.95, 0.15, rng);
  rng = new Random(6);
  const qDr = trainDr(0.0, 0.3, 3000, 0.1, 0.95, 0.15, rng);

  console.log("evaluation on 'real' slips (each 200 episodes greedy eval):");
  console.log(`  ${"slip".padEnd(10)}${"fixed-slip policy".padEnd(22)}${"DR-trained policy".padEnd(22)}`);
  for (const slip of [0.0, 0.1, 0.2, 0.3, 0.5, 0.7]) {
    const rFixed = evaluate(qFixed, slip);
    const rDr = evaluate(qDr, slip);
    const label = slip <= 0.3 ? "(in-support for DR)" : "(OOD for DR)";
    console.log(`  ${slip.toFixed(2).padEnd(10)}${rFixed.toFixed(2).padEnd(22)}${rDr.toFixed(2).padEnd(22)}${label}`);
  }

  console.log();
  console.log("takeaway: DR-trained policy degrades gracefully; fixed-slip policy is brittle out-of-distribution.");
}

main();
