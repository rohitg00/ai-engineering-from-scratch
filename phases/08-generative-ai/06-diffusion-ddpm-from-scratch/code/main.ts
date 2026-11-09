// Lesson: Diffusion Models: DDPM from Scratch (phase 08 / lesson 06)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/08-generative-ai/06-diffusion-ddpm-from-scratch/docs/en.md
// Run: npx tsx phases/08-generative-ai/06-diffusion-ddpm-from-scratch/code/main.ts

class Rng {
  private a: number;

  constructor(seed: number) {
    this.a = seed >>> 0;
  }

  random(): number {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  gauss(mu: number, sigma: number): number {
    let u1 = this.random();
    while (u1 === 0) u1 = this.random();
    const u2 = this.random();
    return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  randrange(n: number): number {
    return Math.floor(this.random() * n);
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
  pre1: Vector;
  pre2: Vector;
}

const MATRICES = ["W1", "W2", "W3"] as const;
const VECTORS = ["b1", "b2", "b3"] as const;

function signed(v: number, digits: number): string {
  const sign = v < 0 || Object.is(v, -0) ? "-" : "+";
  return sign + Math.abs(v).toFixed(digits);
}

function sinEmbed(t: number, T: number, dim = 8): Vector {
  const out: Vector = [];
  const half = Math.floor(dim / 2);
  for (let i = 0; i < half; i++) {
    const freq = 1.0 / 10000 ** (i / Math.max(half - 1, 1));
    out.push(Math.sin(t * freq));
    out.push(Math.cos(t * freq));
  }
  return out.slice(0, dim);
}

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

function randnMatrix(rows: number, cols: number, rng: Rng, scale = 0.3): Matrix {
  const out: Matrix = [];
  for (let i = 0; i < rows; i++) {
    const row: Vector = [];
    for (let j = 0; j < cols; j++) row.push(rng.gauss(0, scale));
    out.push(row);
  }
  return out;
}

function initNet(xDim: number, tDim: number, hidden: number, rng: Rng): Net {
  return {
    W1: randnMatrix(hidden, xDim + tDim, rng),
    b1: new Array(hidden).fill(0.0),
    W2: randnMatrix(hidden, hidden, rng),
    b2: new Array(hidden).fill(0.0),
    W3: randnMatrix(xDim, hidden, rng),
    b3: new Array(xDim).fill(0.0),
  };
}

function forward(xT: Vector, tEmbed: Vector, net: Net): [Vector, Cache] {
  const inp = [...xT, ...tEmbed];
  const pre1 = add(matmul(net.W1, inp), net.b1);
  const h1 = tanh(pre1);
  const pre2 = add(matmul(net.W2, h1), net.b2);
  const h2 = tanh(pre2);
  const epsHat = add(matmul(net.W3, h2), net.b3);
  return [epsHat, { inp, h1, h2, pre1, pre2 }];
}

function backward(targetEps: Vector, epsHat: Vector, cache: Cache, net: Net): Net {
  const grads: Net = {
    W1: net.W1.map((r) => r.map(() => 0.0)),
    b1: net.b1.map(() => 0.0),
    W2: net.W2.map((r) => r.map(() => 0.0)),
    b2: net.b2.map(() => 0.0),
    W3: net.W3.map((r) => r.map(() => 0.0)),
    b3: net.b3.map(() => 0.0),
  };

  const dOut = epsHat.map((a, i) => 2 * (a - targetEps[i]));
  for (let i = 0; i < dOut.length; i++) {
    grads.b3[i] += dOut[i];
    for (let j = 0; j < cache.h2.length; j++) grads.W3[i][j] += dOut[i] * cache.h2[j];
  }
  const dH2 = cache.h2.map((_, j) => {
    let s = 0;
    for (let i = 0; i < dOut.length; i++) s += net.W3[i][j] * dOut[i];
    return s;
  });
  const g2 = tanhGrad(cache.h2);
  const dPre2 = cache.h2.map((_, j) => dH2[j] * g2[j]);
  for (let j = 0; j < cache.h2.length; j++) {
    grads.b2[j] += dPre2[j];
    for (let k = 0; k < cache.h1.length; k++) grads.W2[j][k] += dPre2[j] * cache.h1[k];
  }
  const dH1 = cache.h1.map((_, k) => {
    let s = 0;
    for (let j = 0; j < cache.h2.length; j++) s += net.W2[j][k] * dPre2[j];
    return s;
  });
  const g1 = tanhGrad(cache.h1);
  const dPre1 = cache.h1.map((_, j) => dH1[j] * g1[j]);
  for (let j = 0; j < cache.h1.length; j++) {
    grads.b1[j] += dPre1[j];
    for (let k = 0; k < cache.inp.length; k++) grads.W1[j][k] += dPre1[j] * cache.inp[k];
  }
  return grads;
}

function applyUpdate(net: Net, grads: Net, lr: number): void {
  for (const k of MATRICES) {
    for (let i = 0; i < net[k].length; i++) {
      for (let j = 0; j < net[k][i].length; j++) net[k][i][j] -= lr * grads[k][i][j];
    }
  }
  for (const k of VECTORS) {
    for (let i = 0; i < net[k].length; i++) net[k][i] -= lr * grads[k][i];
  }
}

function makeSchedule(T: number): [Vector, Vector, Vector] {
  const betas: Vector = [];
  for (let t = 0; t < T; t++) betas.push(1e-4 + ((0.02 - 1e-4) * t) / (T - 1));
  const alphas = betas.map((b) => 1 - b);
  const alphaBars: Vector = [];
  let cum = 1.0;
  for (const a of alphas) {
    cum *= a;
    alphaBars.push(cum);
  }
  return [betas, alphas, alphaBars];
}

function sampleData(rng: Rng): number {
  return rng.random() < 0.5 ? rng.gauss(-2.0, 0.4) : rng.gauss(2.0, 0.4);
}

function train(net: Net, alphaBars: Vector, T: number, steps: number, lr: number, tDim: number, rng: Rng): void {
  for (let step = 0; step < steps; step++) {
    const x0 = sampleData(rng);
    const t = rng.randrange(T);
    const aBar = alphaBars[t];
    const eps = rng.gauss(0, 1);
    const xT = Math.sqrt(aBar) * x0 + Math.sqrt(1 - aBar) * eps;
    const tEmb = sinEmbed(t, T, tDim);
    const [epsHat, cache] = forward([xT], tEmb, net);
    const grads = backward([eps], epsHat, cache, net);
    applyUpdate(net, grads, lr);
    if ((step + 1) % 500 === 0) {
      const loss = (epsHat[0] - eps) ** 2;
      console.log(`step ${String(step + 1).padStart(5)}: loss ${loss.toFixed(4)}`);
    }
  }
}

function sample(net: Net, alphas: Vector, alphaBars: Vector, T: number, tDim: number, rng: Rng): number {
  let x = rng.gauss(0, 1);
  for (let t = T - 1; t >= 0; t--) {
    const tEmb = sinEmbed(t, T, tDim);
    const [epsHat] = forward([x], tEmb, net);
    const betaT = 1 - alphas[t];
    const mean = (x - (betaT / Math.sqrt(1 - alphaBars[t])) * epsHat[0]) / Math.sqrt(alphas[t]);
    if (t > 0) x = mean + Math.sqrt(betaT) * rng.gauss(0, 1);
    else x = mean;
  }
  return x;
}

function histogram(samples: Vector, lo = -5.0, hi = 5.0, bins = 30): string {
  const width = (hi - lo) / bins;
  const counts: number[] = new Array(bins).fill(0);
  for (const s of samples) {
    if (lo <= s && s < hi) counts[Math.trunc((s - lo) / width)] += 1;
  }
  const peak = Math.max(...counts) || 1;
  const height = 8;
  const rows: string[] = [];
  for (let r = height; r > 0; r--) {
    const thr = (peak * r) / height;
    rows.push(counts.map((c) => (c >= thr ? "#" : " ")).join(""));
  }
  rows.push("-".repeat(bins));
  return rows.join("\n");
}

function main(): void {
  const rng = new Rng(13);
  const T = 40;
  const tDim = 8;
  const hidden = 24;
  const [, alphas, alphaBars] = makeSchedule(T);
  const net = initNet(1, tDim, hidden, rng);

  console.log("=== training DDPM on two-mode 1-D mixture ===");
  train(net, alphaBars, T, 4000, 0.01, tDim, rng);

  console.log();
  console.log("=== sampling ===");
  const samples: Vector = [];
  for (let i = 0; i < 500; i++) samples.push(sample(net, alphas, alphaBars, T, tDim, rng));
  console.log(histogram(samples));
  let m = 0;
  for (const s of samples) m += s;
  m /= samples.length;
  const pos = samples.filter((s) => s > 0).length;
  console.log(`mean ${signed(m, 3)}, modeA(<0)=${500 - pos}, modeB(>0)=${pos}`);

  console.log();
  console.log("takeaway: trained noise predictor + reverse chain reproduces both modes.");
  console.log("          same loss function that scales to images, video, 3D.");
}

main();

export {};
