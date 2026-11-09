// Lesson: Flow Matching & Rectified Flows (phase 08 / lesson 13)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/08-generative-ai/13-flow-matching-rectified-flows/docs/en.md
// Run: npx tsx phases/08-generative-ai/13-flow-matching-rectified-flows/code/main.ts

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

type Matrix = number[][];
type Vector = number[];

interface Net {
  W1: Matrix;
  b1: Vector;
  W2: Matrix;
  b2: Vector;
  W3: Matrix;
  b3: Vector;
}

interface Cache {
  inp: Vector;
  h1: Vector;
  h2: Vector;
}

const MATRIX_KEYS = ["W1", "W2", "W3"] as const;
const VECTOR_KEYS = ["b1", "b2", "b3"] as const;

function tanh(v: Vector): Vector {
  return v.map((x) => Math.tanh(x));
}

function tanhGrad(h: Vector): Vector {
  return h.map((x) => 1 - x * x);
}

function matmul(W: Matrix, x: Vector): Vector {
  return W.map((row) => {
    let s = 0;
    for (let i = 0; i < Math.min(row.length, x.length); i++) s += row[i] * x[i];
    return s;
  });
}

function add(a: Vector, b: Vector): Vector {
  return a.map((x, i) => x + b[i]);
}

function randnMatrix(rows: number, cols: number, rng: Random, scale = 0.3): Matrix {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => rng.gauss(0, scale)));
}

function initNet(inDim: number, hidden: number, outDim: number, rng: Random): Net {
  return {
    W1: randnMatrix(hidden, inDim, rng),
    b1: new Array<number>(hidden).fill(0.0),
    W2: randnMatrix(hidden, hidden, rng),
    b2: new Array<number>(hidden).fill(0.0),
    W3: randnMatrix(outDim, hidden, rng),
    b3: new Array<number>(outDim).fill(0.0),
  };
}

function forward(x: number, t: number, net: Net): [number, Cache] {
  const inp = [x, t, t * t, Math.sin(2 * Math.PI * t), Math.cos(2 * Math.PI * t)];
  const pre1 = add(matmul(net.W1, inp), net.b1);
  const h1 = tanh(pre1);
  const pre2 = add(matmul(net.W2, h1), net.b2);
  const h2 = tanh(pre2);
  const out = add(matmul(net.W3, h2), net.b3);
  return [out[0], { inp, h1, h2 }];
}

function backward(target: number, out: number, cache: Cache, net: Net): Net {
  const grads: Net = {
    W1: net.W1.map((row) => new Array<number>(row.length).fill(0.0)),
    b1: new Array<number>(net.b1.length).fill(0.0),
    W2: net.W2.map((row) => new Array<number>(row.length).fill(0.0)),
    b2: new Array<number>(net.b2.length).fill(0.0),
    W3: net.W3.map((row) => new Array<number>(row.length).fill(0.0)),
    b3: new Array<number>(net.b3.length).fill(0.0),
  };
  const nH2 = cache.h2.length;
  const nH1 = cache.h1.length;
  const dOut = 2 * (out - target);
  grads.b3[0] += dOut;
  for (let j = 0; j < nH2; j++) grads.W3[0][j] += dOut * cache.h2[j];
  const dH2 = Array.from({ length: nH2 }, (_, j) => net.W3[0][j] * dOut);
  const dPre2 = Array.from({ length: nH2 }, (_, j) => dH2[j] * tanhGrad(cache.h2)[j]);
  for (let j = 0; j < nH2; j++) {
    grads.b2[j] += dPre2[j];
    for (let k = 0; k < nH1; k++) grads.W2[j][k] += dPre2[j] * cache.h1[k];
  }
  const dH1 = Array.from({ length: nH1 }, (_, k) => {
    let s = 0;
    for (let j = 0; j < nH2; j++) s += net.W2[j][k] * dPre2[j];
    return s;
  });
  const dPre1 = Array.from({ length: nH1 }, (_, j) => dH1[j] * tanhGrad(cache.h1)[j]);
  for (let j = 0; j < nH1; j++) {
    grads.b1[j] += dPre1[j];
    for (let k = 0; k < cache.inp.length; k++) grads.W1[j][k] += dPre1[j] * cache.inp[k];
  }
  return grads;
}

function apply(net: Net, grads: Net, lr: number): void {
  for (const k of MATRIX_KEYS) {
    const v = net[k];
    for (let i = 0; i < v.length; i++) {
      for (let j = 0; j < v[i].length; j++) v[i][j] -= lr * grads[k][i][j];
    }
  }
  for (const k of VECTOR_KEYS) {
    const v = net[k];
    for (let i = 0; i < v.length; i++) v[i] -= lr * grads[k][i];
  }
}

function sampleData(rng: Random): number {
  return rng.random() < 0.5 ? rng.gauss(-2.0, 0.3) : rng.gauss(2.0, 0.3);
}

function train(net: Net, steps: number, lr: number, rng: Random): void {
  for (let s = 0; s < steps; s++) {
    const x0 = sampleData(rng);
    const x1 = rng.gauss(0, 1);
    const t = rng.random();
    const xT = t * x1 + (1 - t) * x0;
    const target = x1 - x0;
    const [pred, cache] = forward(xT, t, net);
    const grads = backward(target, pred, cache, net);
    apply(net, grads, lr);
  }
}

function sample(net: Net, numSteps: number, rng: Random): number {
  let x = rng.gauss(0, 1);
  const dt = 1.0 / numSteps;
  for (let i = 0; i < numSteps; i++) {
    const t = 1.0 - i * dt;
    const [v] = forward(x, t, net);
    x -= dt * v;
  }
  return x;
}

function histogram(samples: number[], lo = -5.0, hi = 5.0, bins = 30): string {
  const width = (hi - lo) / bins;
  const counts = new Array<number>(bins).fill(0);
  for (const s of samples) {
    if (lo <= s && s < hi) counts[Math.trunc((s - lo) / width)] += 1;
  }
  const peak = Math.max(...counts) || 1;
  const height = 6;
  const rows: string[] = [];
  for (let r = height; r > 0; r--) {
    const thr = (peak * r) / height;
    rows.push(counts.map((c) => (c >= thr ? "#" : " ")).join(""));
  }
  rows.push("-".repeat(bins));
  return rows.join("\n");
}

function signed(x: number, digits: number): string {
  return (x >= 0 ? "+" : "") + x.toFixed(digits);
}

function main(): void {
  const rng = new Random(1);
  const net = initNet(5, 24, 1, rng);

  console.log("=== training flow matching on two-mode mixture ===");
  train(net, 6000, 0.01, rng);

  console.log();
  for (const numSteps of [1, 2, 4, 8, 20]) {
    const samples = Array.from({ length: 500 }, () => sample(net, numSteps, rng));
    let total = 0;
    for (const s of samples) total += s;
    const m = total / samples.length;
    const pos = samples.filter((s) => s > 0).length;
    console.log(`=== ${numSteps}-step Euler integration ===`);
    console.log(histogram(samples));
    console.log(`mean ${signed(m, 2)}, left mode = ${500 - pos}, right mode = ${pos}`);
    console.log();
  }

  console.log("takeaway: straight-line flow matching lets Euler work at 4-8 steps.");
  console.log("          DDPM needs 20+ for similar quality in this toy.");
}

main();
