// Lesson: Temporal Difference: Q-Learning & SARSA (phase 09 / lesson 04)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/09-reinforcement-learning/04-q-learning-sarsa/docs/en.md
// Run: npx tsx phases/09-reinforcement-learning/04-q-learning-sarsa/code/main.ts

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

  choice<T>(items: readonly T[]): T {
    return items[Math.floor(this.random() * items.length)];
  }
}

type State = [number, number];
type Action = "up" | "down" | "left" | "right";
type QRow = Map<Action, number>;

const GRID = 4;
const TERMINAL: State = [3, 3];
const ACTIONS: readonly Action[] = ["up", "down", "left", "right"];
const DELTAS: Record<Action, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

class QTable {
  readonly rows = new Map<string, QRow>();

  get(s: State): QRow {
    const k = key(s);
    let row = this.rows.get(k);
    if (row === undefined) {
      row = new Map(ACTIONS.map((a) => [a, 0.0]));
      this.rows.set(k, row);
    }
    return row;
  }
}

function key(s: State): string {
  return `${s[0]},${s[1]}`;
}

function isTerminal(s: State): boolean {
  return s[0] === TERMINAL[0] && s[1] === TERMINAL[1];
}

function reset(): State {
  return [0, 0];
}

function step(state: State, action: Action): [State, number, boolean] {
  if (isTerminal(state)) return [state, 0.0, true];
  const [dr, dc] = DELTAS[action];
  const [r, c] = state;
  const nr = Math.min(Math.max(r + dr, 0), GRID - 1);
  const nc = Math.min(Math.max(c + dc, 0), GRID - 1);
  const next: State = [nr, nc];
  return [next, -1.0, isTerminal(next)];
}

function argmaxAction(q: QRow): Action {
  let best = ACTIONS[0];
  for (const a of ACTIONS) if (q.get(a)! > q.get(best)!) best = a;
  return best;
}

function epsilonGreedy(Q: QTable, state: State, rng: Random, epsilon: number): Action {
  if (rng.random() < epsilon) return rng.choice(ACTIONS);
  return argmaxAction(Q.get(state));
}

function sarsa(episodes: number, alpha = 0.1, gamma = 0.99, epsilon = 0.1, rng: Random = new Random(0)): [QTable, number[]] {
  const Q = new QTable();
  const returns: number[] = [];
  for (let ep = 0; ep < episodes; ep++) {
    let s = reset();
    let a = epsilonGreedy(Q, s, rng, epsilon);
    let total = 0.0;
    for (let t = 0; t < 200; t++) {
      const [sNext, r, done] = step(s, a);
      total += r;
      if (done) {
        const row = Q.get(s);
        row.set(a, row.get(a)! + alpha * (r - row.get(a)!));
        break;
      }
      const aNext = epsilonGreedy(Q, sNext, rng, epsilon);
      const target = r + gamma * Q.get(sNext).get(aNext)!;
      const row = Q.get(s);
      row.set(a, row.get(a)! + alpha * (target - row.get(a)!));
      s = sNext;
      a = aNext;
    }
    returns.push(total);
  }
  return [Q, returns];
}

function qLearning(episodes: number, alpha = 0.1, gamma = 0.99, epsilon = 0.1, rng: Random = new Random(0)): [QTable, number[]] {
  const Q = new QTable();
  const returns: number[] = [];
  for (let ep = 0; ep < episodes; ep++) {
    let s = reset();
    let total = 0.0;
    for (let t = 0; t < 200; t++) {
      const a = epsilonGreedy(Q, s, rng, epsilon);
      const [sNext, r, done] = step(s, a);
      total += r;
      if (done) {
        const row = Q.get(s);
        row.set(a, row.get(a)! + alpha * (r - row.get(a)!));
        break;
      }
      const bestNext = Math.max(...Q.get(sNext).values());
      const target = r + gamma * bestNext;
      const row = Q.get(s);
      row.set(a, row.get(a)! + alpha * (target - row.get(a)!));
      s = sNext;
    }
    returns.push(total);
  }
  return [Q, returns];
}

function greedyPolicy(Q: QTable): Map<string, Action> {
  const out = new Map<string, Action>();
  for (const [s, q] of Q.rows) out.set(s, argmaxAction(q));
  return out;
}

function printPolicy(policy: Map<string, Action>, title: string): void {
  const arrows: Record<Action, string> = { up: "^", down: "v", left: "<", right: ">" };
  console.log(`  ${title}`);
  for (let r = 0; r < GRID; r++) {
    const row: string[] = [];
    for (let c = 0; c < GRID; c++) {
      const k = key([r, c]);
      if (isTerminal([r, c])) row.push(".");
      else if (policy.has(k)) row.push(arrows[policy.get(k)!]);
      else row.push("?");
    }
    console.log("   " + row.join(" "));
  }
}

function sum(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s;
}

function blockMeans(xs: number[], block: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= xs.length - block; i += block) out.push(sum(xs.slice(i, i + block)) / block);
  return out;
}

function main(): void {
  const episodes = 3000;
  let rng = new Random(42);
  const [qSarsa, retSarsa] = sarsa(episodes, 0.1, 0.99, 0.1, rng);
  rng = new Random(42);
  const [qQl, retQl] = qLearning(episodes, 0.1, 0.99, 0.1, rng);

  console.log(`=== 4x4 GridWorld, ${episodes} episodes, alpha=0.1, eps=0.1, gamma=0.99 ===`);
  console.log();
  console.log("learning curves (mean return per block of 500 episodes):");
  const bs = blockMeans(retSarsa, 500);
  const bq = blockMeans(retQl, 500);
  for (let i = 0; i < Math.min(bs.length, bq.length); i++) {
    console.log(`  block ${i + 1}: sarsa=${bs[i].toFixed(2).padStart(7)}   q-learning=${bq[i].toFixed(2).padStart(7)}`);
  }

  console.log();
  printPolicy(greedyPolicy(qSarsa), "SARSA greedy policy");
  console.log();
  printPolicy(greedyPolicy(qQl), "Q-learning greedy policy");

  console.log();
  console.log(
    `final mean return (last 500 eps):  sarsa=${(sum(retSarsa.slice(-500)) / 500).toFixed(2)}   q-learning=${(sum(retQl.slice(-500)) / 500).toFixed(2)}`,
  );
  console.log("(optimal return on this 4x4 GridWorld = -6.0)");
}

main();
