// Lesson: Inpainting, Outpainting & Image Editing (phase 08 / lesson 09)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/08-generative-ai/09-inpainting-outpainting-editing/docs/en.md
// Run: npx tsx phases/08-generative-ai/09-inpainting-outpainting-editing/code/main.ts

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

  choice<T>(items: T[]): T {
    return items[Math.floor(this.random() * items.length)];
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

function pyList(items: string[]): string {
  return "[" + items.map((s) => `'${s}'`).join(", ") + "]";
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

function forward(xT: Vector, tEmb: Vector, net: Net): [Vector, Cache] {
  const inp = [...xT, ...tEmb];
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

function sampleData(rng: Rng, d = 5): [Vector, number] {
  const cluster = rng.choice([0, 1]);
  const center: Vector = new Array(d).fill(cluster === 0 ? -1.0 : 1.0);
  return [center.map((c) => c + rng.gauss(0, 0.2)), cluster];
}

function randnVector(n: number, rng: Rng): Vector {
  const out: Vector = [];
  for (let i = 0; i < n; i++) out.push(rng.gauss(0, 1));
  return out;
}

function train(net: Net, alphaBars: Vector, T: number, steps: number, lr: number, tDim: number, d: number, rng: Rng): void {
  for (let step = 0; step < steps; step++) {
    const [x0] = sampleData(rng, d);
    const t = rng.randrange(T);
    const eps = randnVector(d, rng);
    const aBar = alphaBars[t];
    const xT = x0.map((x, i) => Math.sqrt(aBar) * x + Math.sqrt(1 - aBar) * eps[i]);
    const tEmb = sinEmbed(t, T, tDim);
    const [out, cache] = forward(xT, tEmb, net);
    const grads = backward(eps, out, cache, net);
    apply(net, grads, lr);
  }
}

function sampleUnconditional(net: Net, alphas: Vector, alphaBars: Vector, T: number, tDim: number, d: number, rng: Rng): Vector {
  let x = randnVector(d, rng);
  for (let t = T - 1; t >= 0; t--) {
    const tEmb = sinEmbed(t, T, tDim);
    const [epsHat] = forward(x, tEmb, net);
    const betaT = 1 - alphas[t];
    const mean: Vector = [];
    for (let i = 0; i < d; i++) {
      mean.push((x[i] - (betaT / Math.sqrt(1 - alphaBars[t])) * epsHat[i]) / Math.sqrt(alphas[t]));
    }
    if (t > 0) x = mean.map((m) => m + Math.sqrt(betaT) * rng.gauss(0, 1));
    else x = mean;
  }
  return x;
}

function inpaint(
  net: Net,
  alphas: Vector,
  alphaBars: Vector,
  T: number,
  tDim: number,
  d: number,
  clean: Vector,
  mask: boolean[],
  rng: Rng,
): Vector {
  let x = randnVector(d, rng);
  for (let t = T - 1; t >= 0; t--) {
    const aBar = alphaBars[t];
    for (let i = 0; i < d; i++) {
      if (!mask[i]) x[i] = Math.sqrt(aBar) * clean[i] + Math.sqrt(1 - aBar) * rng.gauss(0, 1);
    }
    const tEmb = sinEmbed(t, T, tDim);
    const [epsHat] = forward(x, tEmb, net);
    const betaT = 1 - alphas[t];
    const mean: Vector = [];
    for (let i = 0; i < d; i++) {
      mean.push((x[i] - (betaT / Math.sqrt(1 - alphaBars[t])) * epsHat[i]) / Math.sqrt(alphas[t]));
    }
    if (t > 0) x = mean.map((m) => m + Math.sqrt(betaT) * rng.gauss(0, 1));
    else x = mean;
  }
  for (let i = 0; i < d; i++) {
    if (!mask[i]) x[i] = clean[i];
  }
  return x;
}

function main(): void {
  const rng = new Rng(5);
  const T = 40;
  const tDim = 8;
  const hidden = 32;
  const d = 5;
  const [alphas, alphaBars] = makeSchedule(T);
  const net = initNet(d, tDim, hidden, rng);

  console.log("=== training 5-D DDPM on two-cluster mixture ===");
  train(net, alphaBars, T, 5000, 0.01, tDim, d, rng);

  console.log();
  console.log("=== inpainting: pin dims 0-2, regenerate dims 3-4 ===");
  for (let trial = 0; trial < 5; trial++) {
    const [clean, cluster] = sampleData(rng, d);
    const mask = [false, false, false, true, true];
    const out = inpaint(net, alphas, alphaBars, T, tDim, d, clean, mask, rng);
    const label = cluster === 0 ? "neg cluster" : "pos cluster";
    const pinned = pyList(clean.slice(0, 3).map((v) => signed(v, 2)));
    const filled = pyList(out.slice(3, 5).map((v) => signed(v, 2)));
    console.log(`  ${label}: pinned=${pinned}  filled=${filled}`);
  }

  console.log();
  console.log("=== outpainting (mask dims 0-1, pin 2-4) ===");
  for (let trial = 0; trial < 3; trial++) {
    const [clean] = sampleData(rng, d);
    const mask = [true, true, false, false, false];
    const out = inpaint(net, alphas, alphaBars, T, tDim, d, clean, mask, rng);
    console.log(
      `  pinned tail=[${signed(clean[2], 2)}, ${signed(clean[3], 2)}, ${signed(clean[4], 2)}]  ` +
        `filled head=[${signed(out[0], 2)}, ${signed(out[1], 2)}]`,
    );
  }

  console.log();
  console.log("takeaway: the filled dims match the cluster sign of the pinned dims.");
  console.log("          that is why inpainting looks coherent with the surroundings.");
}

main();

export {};
