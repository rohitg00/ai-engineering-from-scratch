// Lesson: Latent Diffusion & Stable Diffusion (phase 08 / lesson 07)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/08-generative-ai/07-latent-diffusion-stable-diffusion/docs/en.md
// Run: npx tsx phases/08-generative-ai/07-latent-diffusion-stable-diffusion/code/main.ts

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

function oneHot(c: number, num: number): Vector {
  const v: Vector = new Array(num).fill(0.0);
  v[c] = 1.0;
  return v;
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

const NULL_CLASS = 2;

function initNet(xDim: number, tDim: number, cDim: number, hidden: number, rng: Rng): Net {
  return {
    W1: randnMatrix(hidden, xDim + tDim + cDim, rng),
    b1: new Array(hidden).fill(0.0),
    W2: randnMatrix(hidden, hidden, rng),
    b2: new Array(hidden).fill(0.0),
    W3: randnMatrix(xDim, hidden, rng),
    b3: new Array(xDim).fill(0.0),
  };
}

function forward(xT: Vector, tEmb: Vector, cEmb: Vector, net: Net): [Vector, Cache] {
  const inp = [...xT, ...tEmb, ...cEmb];
  const pre1 = add(matmul(net.W1, inp), net.b1);
  const h1 = tanh(pre1);
  const pre2 = add(matmul(net.W2, h1), net.b2);
  const h2 = tanh(pre2);
  const out = add(matmul(net.W3, h2), net.b3);
  return [out, { inp, h1, h2 }];
}

function backward(target: Vector, out: Vector, cache: Cache, net: Net): Net {
  const grads: Net = {
    W1: net.W1.map((r) => r.map(() => 0.0)),
    b1: net.b1.map(() => 0.0),
    W2: net.W2.map((r) => r.map(() => 0.0)),
    b2: net.b2.map(() => 0.0),
    W3: net.W3.map((r) => r.map(() => 0.0)),
    b3: net.b3.map(() => 0.0),
  };
  const dOut = out.map((a, i) => 2 * (a - target[i]));
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

function apply(net: Net, grads: Net, lr: number): void {
  for (const k of MATRICES) {
    for (let i = 0; i < net[k].length; i++) {
      for (let j = 0; j < net[k][i].length; j++) net[k][i][j] -= lr * grads[k][i][j];
    }
  }
  for (const k of VECTORS) {
    for (let i = 0; i < net[k].length; i++) net[k][i] -= lr * grads[k][i];
  }
}

function makeSchedule(T: number): [Vector, Vector] {
  const betas: Vector = [];
  for (let t = 0; t < T; t++) betas.push(1e-4 + ((0.02 - 1e-4) * t) / (T - 1));
  const alphas = betas.map((b) => 1 - b);
  const bars: Vector = [];
  let cum = 1.0;
  for (const a of alphas) {
    cum *= a;
    bars.push(cum);
  }
  return [alphas, bars];
}

function encode(x: number): number {
  return x * 0.5;
}

function decode(z: number): number {
  return z * 2.0;
}

function sampleData(rng: Rng): [number, number] {
  const c = rng.randrange(2);
  const x = rng.gauss(c === 0 ? -2.0 : 2.0, 0.4);
  return [x, c];
}

function main(): void {
  const rng = new Rng(11);
  const T = 40;
  const tDim = 8;
  const hidden = 32;
  const numClassesIncNull = 3;
  const [alphas, alphaBars] = makeSchedule(T);
  const net = initNet(1, tDim, numClassesIncNull, hidden, rng);

  console.log("=== training class-conditional latent diffusion with CFG dropout ===");
  for (let step = 0; step < 4000; step++) {
    const [x0, c] = sampleData(rng);
    const z0 = encode(x0);
    const t = rng.randrange(T);
    const eps = rng.gauss(0, 1);
    const zT = Math.sqrt(alphaBars[t]) * z0 + Math.sqrt(1 - alphaBars[t]) * eps;
    const useC = rng.random() < 0.1 ? NULL_CLASS : c;
    const cEmb = oneHot(useC, numClassesIncNull);
    const tEmb = sinEmbed(t, T, tDim);
    const [out, cache] = forward([zT], tEmb, cEmb, net);
    const grads = backward([eps], out, cache, net);
    apply(net, grads, 0.01);
    if ((step + 1) % 1000 === 0) console.log(`  step ${String(step + 1).padStart(5)}`);
  }

  const sample = (cTarget: number, w: number): number => {
    let z = rng.gauss(0, 1);
    for (let t = T - 1; t >= 0; t--) {
      const tEmb = sinEmbed(t, T, tDim);
      const [epsC] = forward([z], tEmb, oneHot(cTarget, numClassesIncNull), net);
      const [epsU] = forward([z], tEmb, oneHot(NULL_CLASS, numClassesIncNull), net);
      const epsCfg = (1 + w) * epsC[0] - w * epsU[0];
      const betaT = 1 - alphas[t];
      const mean = (z - (betaT / Math.sqrt(1 - alphaBars[t])) * epsCfg) / Math.sqrt(alphas[t]);
      if (t > 0) z = mean + Math.sqrt(betaT) * rng.gauss(0, 1);
      else z = mean;
    }
    return decode(z);
  };

  console.log();
  console.log("=== CFG sweep: per-class mean over 200 samples ===");
  for (const w of [0.0, 1.0, 3.0, 7.0]) {
    const samples: number[][] = [[], []];
    for (let i = 0; i < 200; i++) {
      const c = rng.randrange(2);
      samples[c].push(sample(c, w));
    }
    const m0 = samples[0].reduce((a, b) => a + b, 0) / samples[0].length;
    const m1 = samples[1].reduce((a, b) => a + b, 0) / samples[1].length;
    console.log(`  w=${w.toFixed(1)}: class 0 mean ${signed(m0, 2)}  class 1 mean ${signed(m1, 2)}`);
  }

  console.log();
  console.log("takeaway: same DDPM loss, just running on encoded z.");
  console.log("          CFG scales conditioning strength without retraining.");
}

main();

export {};
