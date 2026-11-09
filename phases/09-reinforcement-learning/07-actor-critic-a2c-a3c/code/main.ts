// Lesson: Actor-Critic: A2C and A3C (phase 09 / lesson 07)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/docs/en.md
// Run: npx tsx phases/09-reinforcement-learning/07-actor-critic-a2c-a3c/code/main.ts

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

interface Node {
  x: number[];
  a: number;
  r: number;
  probs: number[];
  v: number;
  done: boolean;
}

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

function softmax(z: number[]): number[] {
  const m = Math.max(...z);
  const exps = z.map((zi) => Math.exp(zi - m));
  let Z = 0;
  for (const e of exps) Z += e;
  return exps.map((e) => e / Z);
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let j = 0; j < a.length; j++) s += a[j] * b[j];
  return s;
}

function logits(theta: number[][], x: number[]): number[] {
  return theta.map((row) => dot(row, x));
}

function value(w: number[], x: number[]): number {
  return dot(w, x);
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

function initTheta(rng: Random): number[][] {
  return Array.from({ length: N_ACTIONS }, () => Array.from({ length: N_FEAT }, () => rng.gauss(0, 0.1)));
}

function initW(_rng: Random): number[] {
  return new Array<number>(N_FEAT).fill(0.0);
}

function rollout(theta: number[][], w: number[], rng: Random, maxSteps = 100): Node[] {
  const traj: Node[] = [];
  let s = reset();
  for (let t = 0; t < maxSteps; t++) {
    const x = features(s);
    const probs = softmax(logits(theta, x));
    const a = sample(probs, rng);
    const [sNext, r, done] = step(s, a);
    traj.push({ x, a, r, probs, v: value(w, x), done });
    if (done) break;
    s = sNext;
  }
  return traj;
}

function gaeAdvantages(traj: Node[], gamma = 0.99, lam = 0.95): [number[], number[]] {
  const T = traj.length;
  const advantages = new Array<number>(T).fill(0.0);
  let gae = 0.0;
  for (let t = T - 1; t >= 0; t--) {
    const nextV = traj[t].done ? 0.0 : t + 1 < T ? traj[t + 1].v : 0.0;
    const delta = traj[t].r + gamma * nextV - traj[t].v;
    gae = delta + gamma * lam * gae;
    advantages[t] = gae;
  }
  const returns = advantages.map((a, t) => a + traj[t].v);
  return [advantages, returns];
}

function normalize(xs: number[]): number[] {
  if (xs.length < 2) return xs;
  let s = 0;
  for (const x of xs) s += x;
  const m = s / xs.length;
  let v = 0;
  for (const x of xs) v += (x - m) ** 2;
  const sd = Math.sqrt(v / xs.length) + 1e-8;
  return xs.map((x) => (x - m) / sd);
}

function actorCritic(
  episodes: number,
  lrA = 0.05,
  lrV = 0.1,
  gamma = 0.99,
  lam = 0.95,
  entCoef = 0.01,
  rng: Random = new Random(0),
): [number[][], number[], number[]] {
  const theta = initTheta(rng);
  const w = initW(rng);
  const returnsLog: number[] = [];

  for (let ep = 0; ep < episodes; ep++) {
    const traj = rollout(theta, w, rng);
    const [advs, returns] = gaeAdvantages(traj, gamma, lam);
    const advsNorm = normalize(advs);

    for (let t = 0; t < traj.length; t++) {
      const node = traj[t];
      const target = returns[t];
      const err = target - value(w, node.x);
      for (let j = 0; j < N_FEAT; j++) w[j] += lrV * err * node.x[j];

      const adv = advsNorm[t];
      const probs = node.probs;
      for (let i = 0; i < N_ACTIONS; i++) {
        const gradLogpi = (i === node.a ? 1.0 : 0.0) - probs[i];
        const entropyGrad = -Math.log(Math.max(probs[i], 1e-12)) - 1.0;
        for (let j = 0; j < N_FEAT; j++) {
          theta[i][j] += lrA * (adv * gradLogpi + entCoef * entropyGrad * probs[i]) * node.x[j];
        }
      }
    }

    if (traj.length > 0) {
      let mcReturn = 0.0;
      for (let i = traj.length - 1; i >= 0; i--) mcReturn = traj[i].r + gamma * mcReturn;
      returnsLog.push(mcReturn);
    }
  }

  return [theta, w, returnsLog];
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
  const episodes = 1500;
  const rng = new Random(7);
  const [theta, w, log] = actorCritic(episodes, 0.05, 0.1, 0.99, 0.95, 0.01, rng);

  console.log(`=== A2C-style actor-critic with GAE(lam=0.95) on 4x4 GridWorld ===`);
  console.log();
  console.log(`learning curve (mean return per 150 episodes):`);
  blockMean(log, 150).forEach((m, i) => console.log(`  block ${i + 1}: mean return = ${m.toFixed(2).padStart(6)}`));

  console.log();
  printPolicy(greedyPolicy(theta), "greedy policy from actor");
  console.log();
  console.log("critic values V_phi(s):");
  for (let r = 0; r < GRID; r++) {
    const row: string[] = [];
    for (let c = 0; c < GRID; c++) row.push(value(w, features([r, c])).toFixed(2).padStart(7));
    console.log("   " + row.join(" "));
  }

  console.log();
  console.log(`final mean return (last 150 eps) = ${(sum(log.slice(-150)) / 150).toFixed(2)}  (optimal = -6.0)`);
}

main();
