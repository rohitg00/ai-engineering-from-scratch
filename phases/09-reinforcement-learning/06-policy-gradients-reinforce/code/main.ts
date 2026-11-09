// Lesson: Policy Gradient: REINFORCE from Scratch (phase 09 / lesson 06)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/09-reinforcement-learning/06-policy-gradients-reinforce/docs/en.md
// Run: npx tsx phases/09-reinforcement-learning/06-policy-gradients-reinforce/code/main.ts

class Random {
  private state: number;
  private spare: number | null = null;

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

  gauss(mu: number, sigma: number): number {
    if (this.spare !== null) {
      const z = this.spare;
      this.spare = null;
      return mu + sigma * z;
    }
    let u1 = this.random();
    while (u1 <= 0) u1 = this.random();
    const u2 = this.random();
    const r = Math.sqrt(-2 * Math.log(u1));
    this.spare = r * Math.sin(2 * Math.PI * u2);
    return mu + sigma * r * Math.cos(2 * Math.PI * u2);
  }
}

type State = [number, number];
type Action = "up" | "down" | "left" | "right";
type Step = [number[], number, number, number[]];

const GRID = 4;
const TERMINAL: State = [3, 3];
const ACTIONS: readonly Action[] = ["up", "down", "left", "right"];
const DELTAS: Record<Action, [number, number]> = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
const N_ACTIONS = ACTIONS.length;
const N_FEAT = GRID * GRID;

function key(s: State): string {
  return `${s[0]},${s[1]}`;
}

function isTerminal(s: State): boolean {
  return s[0] === TERMINAL[0] && s[1] === TERMINAL[1];
}

function reset(): State {
  return [0, 0];
}

function step(state: State, actionIdx: number): [State, number, boolean] {
  if (isTerminal(state)) return [state, 0.0, true];
  const [dr, dc] = DELTAS[ACTIONS[actionIdx]];
  const [r, c] = state;
  const nr = Math.min(Math.max(r + dr, 0), GRID - 1);
  const nc = Math.min(Math.max(c + dc, 0), GRID - 1);
  const next: State = [nr, nc];
  return [next, -1.0, isTerminal(next)];
}

function features(state: State): number[] {
  const x = new Array<number>(N_FEAT).fill(0.0);
  const [r, c] = state;
  x[r * GRID + c] = 1.0;
  return x;
}

function initTheta(rng: Random): number[][] {
  return Array.from({ length: N_ACTIONS }, () => Array.from({ length: N_FEAT }, () => rng.gauss(0, 0.1)));
}

function logits(theta: number[][], x: number[]): number[] {
  return theta.map((row) => {
    let s = 0;
    for (let j = 0; j < row.length; j++) s += row[j] * x[j];
    return s;
  });
}

function softmax(z: number[]): number[] {
  const m = Math.max(...z);
  const exps = z.map((zi) => Math.exp(zi - m));
  let Z = 0;
  for (const e of exps) Z += e;
  return exps.map((e) => e / Z);
}

function sample(probs: number[], rng: Random): number {
  const x = rng.random();
  let cum = 0.0;
  for (let a = 0; a < probs.length; a++) {
    cum += probs[a];
    if (x <= cum) return a;
  }
  return N_ACTIONS - 1;
}

function rollout(theta: number[][], rng: Random, maxSteps = 100): Step[] {
  const traj: Step[] = [];
  let s = reset();
  for (let t = 0; t < maxSteps; t++) {
    const x = features(s);
    const probs = softmax(logits(theta, x));
    const a = sample(probs, rng);
    const [sNext, r, done] = step(s, a);
    traj.push([x, a, r, probs]);
    if (done) break;
    s = sNext;
  }
  return traj;
}

function returnsToGo(traj: Step[], gamma: number): number[] {
  let G = 0.0;
  const out: number[] = [];
  for (let i = traj.length - 1; i >= 0; i--) {
    G = traj[i][2] + gamma * G;
    out.push(G);
  }
  out.reverse();
  return out;
}

function reinforce(
  episodes: number,
  lr = 0.05,
  gamma = 0.99,
  useBaseline = false,
  rng: Random = new Random(0),
): [number[][], number[]] {
  const theta = initTheta(rng);
  let baseline = 0.0;
  const returnsLog: number[] = [];
  for (let ep = 0; ep < episodes; ep++) {
    const traj = rollout(theta, rng);
    const returns = returnsToGo(traj, gamma);
    if (useBaseline) baseline = 0.95 * baseline + 0.05 * returns[0];
    for (let t = 0; t < traj.length; t++) {
      const [x, a, , probs] = traj[t];
      const adv = returns[t] - (useBaseline ? baseline : 0.0);
      for (let i = 0; i < N_ACTIONS; i++) {
        const grad = (i === a ? 1.0 : 0.0) - probs[i];
        for (let j = 0; j < N_FEAT; j++) theta[i][j] += lr * adv * grad * x[j];
      }
    }
    returnsLog.push(returns.length > 0 ? returns[0] : 0.0);
  }
  return [theta, returnsLog];
}

function argmax(xs: number[]): number {
  let best = 0;
  for (let i = 1; i < xs.length; i++) if (xs[i] > xs[best]) best = i;
  return best;
}

function greedyPolicy(theta: number[][]): Map<string, Action> {
  const policy = new Map<string, Action>();
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (isTerminal([r, c])) continue;
      const z = logits(theta, features([r, c]));
      policy.set(key([r, c]), ACTIONS[argmax(z)]);
    }
  }
  return policy;
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

function blockMean(xs: number[], block: number): number[] {
  const out: number[] = [];
  for (let i = 0; i <= xs.length - block; i += block) out.push(sum(xs.slice(i, i + block)) / block);
  return out;
}

function main(): void {
  const episodes = 2000;
  let rng = new Random(42);
  const [, rPlain] = reinforce(episodes, 0.05, 0.99, false, rng);
  rng = new Random(42);
  const [thetaB, rBase] = reinforce(episodes, 0.05, 0.99, true, rng);

  console.log(`=== REINFORCE on 4x4 GridWorld, ${episodes} episodes, lr=0.05, gamma=0.99 ===`);
  console.log();
  console.log("learning curves (mean return per 200 episodes):");
  const bp = blockMean(rPlain, 200);
  const bb = blockMean(rBase, 200);
  for (let i = 0; i < Math.min(bp.length, bb.length); i++) {
    console.log(`  block ${i + 1}: vanilla=${bp[i].toFixed(2).padStart(7)}   with-baseline=${bb[i].toFixed(2).padStart(7)}`);
  }

  console.log();
  printPolicy(greedyPolicy(thetaB), "final greedy policy (with-baseline)");
  console.log();
  console.log(
    `final mean return (last 200 eps): vanilla=${(sum(rPlain.slice(-200)) / 200).toFixed(2)}   with-baseline=${(sum(rBase.slice(-200)) / 200).toFixed(2)}`,
  );
  console.log("(optimal return on this 4x4 GridWorld = -6.0)");
}

main();
