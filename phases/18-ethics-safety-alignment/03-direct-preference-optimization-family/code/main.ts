// Lesson: The Direct Preference Optimization Family (phase 18 / lesson 03)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/03-direct-preference-optimization-family/code/main.ts

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

  randrange(n: number): number {
    return Math.floor(this.random() * n);
  }

  choice<T>(items: readonly T[]): T {
    return items[this.randrange(items.length)];
  }

  sample<T>(items: readonly T[], k: number): T[] {
    const pool = [...items];
    const out: T[] = [];
    for (let i = 0; i < k; i++) {
      const j = this.randrange(pool.length);
      out.push(pool[j]);
      pool.splice(j, 1);
    }
    return out;
  }
}

const rng = new Random(1);

const N_ACTIONS = 4;
const TRUE_UTILITY = [0.2, 1.0, -0.4, -0.8];

type Pair = [number, number, number];
type Label = [number, boolean];

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

function softmax(logits: number[]): number[] {
  const m = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - m));
  const z = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / z);
}

function logsoftmax(logits: number[]): number[] {
  const m = Math.max(...logits);
  const z = Math.log(logits.reduce((s, x) => s + Math.exp(x - m), 0)) + m;
  return logits.map((x) => x - z);
}

function sigmoid(x: number): number {
  if (x > 30) {
    return 1.0;
  }
  if (x < -30) {
    return 0.0;
  }
  return 1.0 / (1.0 + Math.exp(-x));
}

function samplePrefPair(): Pair {
  const [i, j] = rng.sample(range(N_ACTIONS), 2);
  const pIBeatsJ = sigmoid(TRUE_UTILITY[i] - TRUE_UTILITY[j]);
  if (rng.random() < pIBeatsJ) {
    return [i, j, pIBeatsJ];
  }
  return [j, i, 1 - pIBeatsJ];
}

class Policy {
  logits: number[];

  constructor(logits: number[]) {
    this.logits = logits;
  }

  logprob(a: number): number {
    return logsoftmax(this.logits)[a];
  }

  gradLogprob(a: number): number[] {
    const probs = softmax(this.logits);
    return range(N_ACTIONS).map((b) => (b === a ? 1.0 : 0.0) - probs[b]);
  }
}

function applyGrad(p: Policy, grad: number[], lr: number): void {
  p.logits = p.logits.map((l, i) => l - lr * grad[i]);
}

function makePolicyAndRef(): [Policy, Policy] {
  const refLogits = [0.1, 0.2, -0.1, -0.2];
  return [new Policy([...refLogits]), new Policy([...refLogits])];
}

function trainDpo(pairs: Pair[], beta: number = 0.1, steps: number = 2000, lr: number = 0.05,
  variant: string = "dpo"): Policy {
  const [pi, ref] = makePolicyAndRef();
  for (let step = 0; step < steps; step++) {
    const [w, l] = rng.choice(pairs);
    const logPiW = pi.logprob(w);
    const logPiL = pi.logprob(l);
    const logRefW = ref.logprob(w);
    const logRefL = ref.logprob(l);
    const margin = beta * ((logPiW - logRefW) - (logPiL - logRefL));
    const gw = pi.gradLogprob(w);
    const gl = pi.gradLogprob(l);
    let grad: number[];
    if (variant === "dpo") {
      const gMargin = -(1.0 - sigmoid(margin));
      grad = gw.map((gwI, k) => beta * (gMargin * gwI - gMargin * gl[k]));
    } else if (variant === "ipo") {
      const target = 1.0 / (2 * beta);
      const diff = (logPiW - logRefW) - (logPiL - logRefL) - target;
      const gMargin = 2 * diff;
      grad = gw.map((gwI, k) => gMargin * (gwI - gl[k]));
    } else if (variant === "bpo") {
      const gMargin = -(1.0 - sigmoid(margin));
      const anchorPen = Math.max(0.0, -(logPiW - logRefW));
      grad = gw.map((gwI, k) => beta * (gMargin * gwI - gMargin * gl[k]) - 0.05 * anchorPen * gwI);
    } else {
      throw new Error(variant);
    }
    applyGrad(pi, grad, lr);
  }
  return pi;
}

function trainSimpo(pairs: Pair[], beta: number = 1.5, gamma: number = 0.5, steps: number = 2000,
  lr: number = 0.05): Policy {
  const [pi] = makePolicyAndRef();
  const lens = [1, 1, 1, 1];
  for (let step = 0; step < steps; step++) {
    const [w, l] = rng.choice(pairs);
    const logPiW = pi.logprob(w) / lens[w];
    const logPiL = pi.logprob(l) / lens[l];
    const margin = beta * (logPiW - logPiL) - gamma;
    const gw = pi.gradLogprob(w);
    const gl = pi.gradLogprob(l);
    const gMargin = -(1.0 - sigmoid(margin));
    const grad = gw.map((gwI, k) => beta * (gMargin * gwI / lens[w] - gMargin * gl[k] / lens[l]));
    applyGrad(pi, grad, lr);
  }
  return pi;
}

function trainKto(labels: Label[], beta: number = 0.1, steps: number = 2000, lr: number = 0.05): Policy {
  const [pi, ref] = makePolicyAndRef();
  const zRef = 0.0;
  for (let step = 0; step < steps; step++) {
    const [y, desirable] = rng.choice(labels);
    const logPiY = pi.logprob(y);
    const logRefY = ref.logprob(y);
    const value = beta * (logPiY - logRefY) - zRef;
    let gValue: number;
    if (desirable) {
      const v = sigmoid(value);
      gValue = -(1 - v);
    } else {
      const v = sigmoid(-value);
      gValue = (1 - v) * 2.0;
    }
    const gy = pi.gradLogprob(y);
    const grad = gy.map((gyI) => beta * gValue * gyI);
    applyGrad(pi, grad, lr);
  }
  return pi;
}

function trainOrpo(pairs: Pair[], lam: number = 0.1, steps: number = 2000, lr: number = 0.05): Policy {
  const [pi] = makePolicyAndRef();
  for (let step = 0; step < steps; step++) {
    const [w, l] = rng.choice(pairs);
    const logPiW = pi.logprob(w);
    const logPiL = pi.logprob(l);
    const gw = pi.gradLogprob(w);
    const oddsW = Math.exp(logPiW) / (1 - Math.exp(logPiW) + 1e-6);
    const oddsL = Math.exp(logPiL) / (1 - Math.exp(logPiL) + 1e-6);
    const logRatio = Math.log(oddsW + 1e-6) - Math.log(oddsL + 1e-6);
    const gOr = -(1 - sigmoid(logRatio));
    const gl = pi.gradLogprob(l);
    const grad = gw.map((gwI, k) => -gwI + lam * gOr * (gwI - gl[k]));
    applyGrad(pi, grad, lr);
  }
  return pi;
}

function winRate(pi: Policy): number {
  const probs = softmax(pi.logits);
  const trueProbs = softmax(TRUE_UTILITY);
  const ranked = range(N_ACTIONS).sort((a, b) => -trueProbs[a] - -trueProbs[b]);
  const best = ranked[0];
  return probs[best];
}

function signed(x: number, digits: number): string {
  return x >= 0 ? "+" + x.toFixed(digits) : x.toFixed(digits);
}

function reprList(items: string[]): string {
  return "[" + items.map((s) => `'${s}'`).join(", ") + "]";
}

function pyFloat(x: number): string {
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

function report(name: string, pi: Policy): void {
  console.log(`  ${name.padEnd(8)}  probs=${reprList(softmax(pi.logits).map((p) => p.toFixed(3)))}  ` +
    `win_rate=${winRate(pi).toFixed(3)}  logits=${reprList(pi.logits.map((l) => signed(l, 2)))}`);
}

function main(): void {
  console.log("=".repeat(70));
  console.log("DPO FAMILY ON TOY 4-ACTION PREFERENCE DATA (Phase 18, Lesson 3)");
  console.log("=".repeat(70));
  console.log(`  true utility : [${TRUE_UTILITY.map(pyFloat).join(", ")}]`);
  console.log(`  true optimum : ${reprList(softmax(TRUE_UTILITY).map((p) => p.toFixed(3)))}`);
  console.log();

  const pairs = Array.from({ length: 500 }, () => samplePrefPair());
  const labels: Label[] = [];
  for (let n = 0; n < 500; n++) {
    const a = rng.randrange(N_ACTIONS);
    const desirable = rng.random() < sigmoid(TRUE_UTILITY[a]);
    labels.push([a, desirable]);
  }

  const [ref] = makePolicyAndRef();
  report("REF", ref);

  report("DPO", trainDpo(pairs, 0.1, 2000, 0.05, "dpo"));
  report("IPO", trainDpo(pairs, 0.1, 2000, 0.05, "ipo"));
  report("BPO", trainDpo(pairs, 0.1, 2000, 0.05, "bpo"));
  report("SimPO", trainSimpo(pairs));
  report("KTO", trainKto(labels));
  report("ORPO", trainOrpo(pairs));

  console.log();
  console.log("-".repeat(70));
  console.log("TAKEAWAY: all six methods shift mass toward action 1 (highest true");
  console.log("utility). they differ in how tightly they anchor to the reference,");
  console.log("how they treat preference strength, and whether they need pairs.");
  console.log("=".repeat(70));
}

main();
