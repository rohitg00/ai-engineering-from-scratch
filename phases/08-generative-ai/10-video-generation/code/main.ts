// Lesson: Video Generation (phase 08 / lesson 10)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/08-generative-ai/10-video-generation/docs/en.md
// Run: npx tsx phases/08-generative-ai/10-video-generation/code/main.ts

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

function sinEmbed(t: number, dim = 8): Vector {
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

const T_FRAMES = 6;
const POS_DIM = 4;

function makeVideo(rng: Rng): Vector {
  const base = rng.gauss(0, 1);
  const slope = rng.gauss(0, 0.3);
  const out: Vector = [];
  for (let t = 0; t < T_FRAMES; t++) out.push(base + slope * t + rng.gauss(0, 0.05));
  return out;
}

function patchifyWithPos(video: Vector): Vector[] {
  const out: Vector[] = [];
  for (let t = 0; t < T_FRAMES; t++) {
    const pe = sinEmbed(t, POS_DIM);
    out.push([video[t], ...pe]);
  }
  return out;
}

function flatten(patches: Vector[]): Vector {
  return patches.flat();
}

function initNet(inDim: number, hidden: number, outDim: number, rng: Rng): Net {
  return {
    W1: randnMatrix(hidden, inDim, rng),
    b1: new Array(hidden).fill(0.0),
    W2: randnMatrix(hidden, hidden, rng),
    b2: new Array(hidden).fill(0.0),
    W3: randnMatrix(outDim, hidden, rng),
    b3: new Array(outDim).fill(0.0),
  };
}

function forward(x: Vector, tEmb: Vector, net: Net): [Vector, Cache] {
  const inp = [...x, ...tEmb];
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

function trainJoint(net: Net, alphaBars: Vector, T: number, tDim: number, steps: number, lr: number, rng: Rng): void {
  for (let step = 0; step < steps; step++) {
    const video = makeVideo(rng);
    const t = rng.randrange(T);
    const eps: Vector = [];
    for (let i = 0; i < T_FRAMES; i++) eps.push(rng.gauss(0, 1));
    const aBar = alphaBars[t];
    const noisy = video.map((v, i) => Math.sqrt(aBar) * v + Math.sqrt(1 - aBar) * eps[i]);
    const patches = patchifyWithPos(noisy);
    const xFlat = flatten(patches);
    const tEmb = sinEmbed(t, tDim);
    const [out, cache] = forward(xFlat, tEmb, net);
    const grads = backward(eps, out, cache, net);
    apply(net, grads, lr);
  }
}

function sampleJoint(net: Net, alphas: Vector, alphaBars: Vector, T: number, tDim: number, rng: Rng): Vector {
  let x: Vector = [];
  for (let i = 0; i < T_FRAMES; i++) x.push(rng.gauss(0, 1));
  for (let t = T - 1; t >= 0; t--) {
    const patches = patchifyWithPos(x);
    const xFlat = flatten(patches);
    const tEmb = sinEmbed(t, tDim);
    const [epsHat] = forward(xFlat, tEmb, net);
    const betaT = 1 - alphas[t];
    const newX: Vector = [];
    for (let i = 0; i < T_FRAMES; i++) {
      newX.push((x[i] - (betaT / Math.sqrt(1 - alphaBars[t])) * epsHat[i]) / Math.sqrt(alphas[t]));
    }
    if (t > 0) x = newX.map((v) => v + Math.sqrt(betaT) * rng.gauss(0, 1));
    else x = newX;
  }
  return x;
}

function independentPerFrame(TFrames: number, rng: Rng): Vector {
  const out: Vector = [];
  for (let t = 0; t < TFrames; t++) out.push(rng.gauss(0, 1) + 0.3 * t);
  return out;
}

function frameDeltas(video: Vector): Vector {
  const out: Vector = [];
  for (let i = 0; i < video.length - 1; i++) out.push(Math.abs(video[i + 1] - video[i]));
  return out;
}

function main(): void {
  const rng = new Rng(21);
  const T = 40;
  const tDim = 8;
  const hidden = 48;
  const [alphas, alphaBars] = makeSchedule(T);
  const net = initNet(T_FRAMES * (1 + POS_DIM) + tDim, hidden, T_FRAMES, rng);

  console.log(`=== training joint video DDPM: ${T_FRAMES} frames per clip ===`);
  trainJoint(net, alphaBars, T, tDim, 3000, 0.01, rng);

  console.log();
  console.log("=== 5 clips, joint sampling (coherent) ===");
  const jointDeltas: Vector = [];
  for (let i = 0; i < 5; i++) {
    const clip = sampleJoint(net, alphas, alphaBars, T, tDim, rng);
    jointDeltas.push(...frameDeltas(clip));
    console.log(`  clip ${i}: ` + clip.map((v) => signed(v, 2)).join(" "));
  }

  console.log();
  console.log("=== 5 clips, independent per-frame (flicker baseline) ===");
  const indepDeltas: Vector = [];
  for (let i = 0; i < 5; i++) {
    const clip = independentPerFrame(T_FRAMES, rng);
    indepDeltas.push(...frameDeltas(clip));
    console.log(`  clip ${i}: ` + clip.map((v) => signed(v, 2)).join(" "));
  }

  const avgJoint = jointDeltas.reduce((a, b) => a + b, 0) / jointDeltas.length;
  const avgIndep = indepDeltas.reduce((a, b) => a + b, 0) / indepDeltas.length;
  console.log();
  console.log(`avg frame-to-frame delta: joint=${avgJoint.toFixed(2)}  independent=${avgIndep.toFixed(2)}`);
  console.log("joint sampling produces smoother motion (smaller deltas).");
}

main();

export {};
