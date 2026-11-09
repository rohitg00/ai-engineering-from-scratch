// Lesson: Proximal Policy Optimization (PPO) (phase 09 / lesson 08)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/09-reinforcement-learning/08-ppo/docs/en.md
// Run: npx tsx phases/09-reinforcement-learning/08-ppo/code/main.ts

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

  shuffle<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }
}

type State = [number, number];
type Action = "up" | "down" | "left" | "right";

interface Rec {
  x: number[];
  a: number;
  r: number;
  done: boolean;
  v_old: number;
  log_pi_old: number;
  v_next: number;
  last: boolean;
  adv: number;
  ret: number;
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

function collectRollout(theta: number[][], w: number[], rng: Random, horizon = 50, nEnvs = 8): Rec[] {
  const buffer: Rec[] = [];
  for (let e = 0; e < nEnvs; e++) {
    let s = reset();
    for (let t = 0; t < horizon; t++) {
      const x = features(s);
      const probs = softmax(logits(theta, x));
      const a = sample(probs, rng);
      const [sNext, r, done] = step(s, a);
      buffer.push({
        x,
        a,
        r,
        done,
        v_old: value(w, x),
        log_pi_old: Math.log(Math.max(probs[a], 1e-12)),
        v_next: value(w, features(sNext)),
        last: done || t === horizon - 1,
        adv: 0,
        ret: 0,
      });
      if (done) break;
      s = sNext;
    }
  }
  return buffer;
}

function gae(buffer: Rec[], gamma = 0.99, lam = 0.95): [number[], number[]] {
  const T = buffer.length;
  const advantages = new Array<number>(T).fill(0.0);
  let gaeVal = 0.0;
  for (let t = T - 1; t >= 0; t--) {
    if (buffer[t].last) gaeVal = 0.0;
    const nextV = buffer[t].done ? 0.0 : buffer[t].last ? buffer[t].v_next : buffer[t + 1].v_old;
    const delta = buffer[t].r + gamma * nextV - buffer[t].v_old;
    gaeVal = delta + gamma * lam * gaeVal;
    advantages[t] = gaeVal;
  }
  const returns = advantages.map((a, t) => a + buffer[t].v_old);
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

function ppoUpdate(
  theta: number[][],
  w: number[],
  buffer: Rec[],
  advantages: number[],
  returns: number[],
  lrA = 0.05,
  lrV = 0.1,
  eps = 0.2,
  epochs = 4,
  batch = 32,
  rng: Random = new Random(0),
): [number, number] {
  buffer.forEach((rec, i) => {
    rec.adv = advantages[i];
    rec.ret = returns[i];
  });

  let klTotal = 0.0;
  let klCount = 0;
  let clipHits = 0;
  let total = 0;

  for (let e = 0; e < epochs; e++) {
    const shuffled = [...buffer];
    rng.shuffle(shuffled);
    for (let i = 0; i < shuffled.length; i += batch) {
      const mb = shuffled.slice(i, i + batch);
      const advNorm = normalize(mb.map((rec) => rec.adv));

      for (let k = 0; k < mb.length; k++) {
        const rec = mb[k];
        const adv = advNorm[k];
        const x = rec.x;
        const probs = softmax(logits(theta, x));
        const logp = Math.log(Math.max(probs[rec.a], 1e-12));
        const ratio = Math.exp(logp - rec.log_pi_old);

        const clipped = (adv > 0 && ratio > 1 + eps) || (adv < 0 && ratio < 1 - eps);
        if (clipped) clipHits += 1;
        total += 1;
        klTotal += rec.log_pi_old - logp;
        klCount += 1;

        const pgScale = clipped ? 0.0 : ratio * adv;

        for (let action = 0; action < N_ACTIONS; action++) {
          const gradLogpi = (action === rec.a ? 1.0 : 0.0) - probs[action];
          for (let j = 0; j < N_FEAT; j++) theta[action][j] += lrA * pgScale * gradLogpi * x[j];
        }

        const err = rec.ret - value(w, x);
        for (let j = 0; j < N_FEAT; j++) w[j] += lrV * err * x[j];
      }
    }
  }

  const meanKl = klTotal / Math.max(1, klCount);
  const clipFrac = clipHits / Math.max(1, total);
  return [meanKl, clipFrac];
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

function evaluate(theta: number[][], rng: Random, episodes = 50): number {
  let total = 0.0;
  for (let ep = 0; ep < episodes; ep++) {
    let s = reset();
    let epTotal = 0.0;
    for (let t = 0; t < 50; t++) {
      const probs = softmax(logits(theta, features(s)));
      const a = sample(probs, rng);
      const [next, r, done] = step(s, a);
      s = next;
      epTotal += r;
      if (done) break;
    }
    total += epTotal;
  }
  return total / episodes;
}

function signed(x: number, digits: number): string {
  return (x >= 0 ? "+" : "") + x.toFixed(digits);
}

function main(): void {
  const rng = new Random(123);
  const theta = initTheta(rng);
  const w = initW(rng);

  const updates = 60;
  console.log(`=== PPO on 4x4 GridWorld (${updates} updates, 8 envs x 50 steps, eps=0.2, K=4) ===`);
  console.log();

  for (let it = 0; it < updates; it++) {
    const buffer = collectRollout(theta, w, rng);
    const [advantages, returns] = gae(buffer);
    const [meanKl, clipFrac] = ppoUpdate(theta, w, buffer, advantages, returns, 0.05, 0.1, 0.2, 4, 32, rng);
    if ((it + 1) % 10 === 0) {
      const meanRet = evaluate(theta, new Random(it));
      console.log(
        `  update ${String(it + 1).padStart(3)}  mean_return=${meanRet.toFixed(2).padStart(6)}  mean_KL=${signed(meanKl, 4)}  clip_frac=${clipFrac.toFixed(3)}`,
      );
    }
  }

  console.log();
  printPolicy(greedyPolicy(theta), "greedy policy");
  const final = evaluate(theta, new Random(999), 200);
  console.log();
  console.log(`final evaluated return (200 episodes) = ${final.toFixed(2)}  (optimal = -6.0)`);
}

main();
