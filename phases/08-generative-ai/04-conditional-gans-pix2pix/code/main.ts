// Lesson: Conditional GANs & Pix2Pix (phase 08 / lesson 04)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/08-generative-ai/04-conditional-gans-pix2pix/docs/en.md
// Run: npx tsx phases/08-generative-ai/04-conditional-gans-pix2pix/code/main.ts

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

interface Mlp {
  W1: Matrix;
  b1: Vector;
  W2: Matrix;
  b2: Vector;
}

function signed(v: number, digits: number): string {
  const sign = v < 0 || Object.is(v, -0) ? "-" : "+";
  return sign + Math.abs(v).toFixed(digits);
}

function sigmoid(x: number): number {
  if (x >= 0) {
    const z = Math.exp(-x);
    return 1 / (1 + z);
  }
  const z = Math.exp(x);
  return z / (1 + z);
}

function leaky(x: number, a = 0.2): number {
  return x > 0 ? x : a * x;
}

function leakyGrad(x: number, a = 0.2): number {
  return x > 0 ? 1.0 : a;
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

function oneHot(c: number, num: number): Vector {
  const v: Vector = new Array(num).fill(0.0);
  v[c] = 1.0;
  return v;
}

function initMlp(inDim: number, hidden: number, outDim: number, rng: Rng): Mlp {
  return {
    W1: randnMatrix(hidden, inDim, rng),
    b1: new Array(hidden).fill(0.0),
    W2: randnMatrix(outDim, hidden, rng),
    b2: new Array(outDim).fill(0.0),
  };
}

function gForward(z: Vector, c: number, G: Mlp, numClasses: number): [Vector, Vector, Vector, Vector] {
  const inp = [...z, ...oneHot(c, numClasses)];
  const pre1 = add(matmul(G.W1, inp), G.b1);
  const h = pre1.map((v) => leaky(v));
  const out = add(matmul(G.W2, h), G.b2);
  return [out, h, pre1, inp];
}

function dForward(x: Vector, c: number, D: Mlp, numClasses: number): [number, Vector, Vector, Vector, number] {
  const inp = [...x, ...oneHot(c, numClasses)];
  const pre1 = add(matmul(D.W1, inp), D.b1);
  const h = pre1.map((v) => leaky(v));
  const logit = add(matmul(D.W2, h), D.b2)[0];
  return [sigmoid(logit), h, pre1, inp, logit];
}

function sampleRealConditional(n: number, numClasses: number, rng: Rng): [Vector, number][] {
  const out: [Vector, number][] = [];
  for (let i = 0; i < n; i++) {
    const c = rng.randrange(numClasses);
    const x = c === 0 ? rng.gauss(-2.0, 0.3) : rng.gauss(2.0, 0.3);
    out.push([[x], c]);
  }
  return out;
}

function updateD(reals: [Vector, number][], fakes: [Vector, number][], D: Mlp, numClasses: number, lr: number): void {
  const grads = initGrads(D);
  for (const [x, c] of reals) accumulateDGrad(x, c, 1.0, D, numClasses, grads);
  for (const [x, c] of fakes) accumulateDGrad(x, c, 0.0, D, numClasses, grads);
  const n = reals.length + fakes.length;
  applyGrads(D, grads, lr, n);
}

function accumulateDGrad(x: Vector, c: number, target: number, D: Mlp, numClasses: number, grads: Mlp): void {
  const [p, h, pre1, inp] = dForward(x, c, D, numClasses);
  const dLdpre2 = p - target;
  grads.b2[0] += dLdpre2;
  for (let j = 0; j < h.length; j++) grads.W2[0][j] += dLdpre2 * h[j];
  const dh = h.map((_, j) => D.W2[0][j] * dLdpre2);
  const dpre1 = h.map((_, j) => dh[j] * leakyGrad(pre1[j]));
  for (let j = 0; j < h.length; j++) {
    grads.b1[j] += dpre1[j];
    for (let k = 0; k < inp.length; k++) grads.W1[j][k] += dpre1[j] * inp[k];
  }
}

function updateG(
  noise: Vector[],
  cs: number[],
  G: Mlp,
  D: Mlp,
  numClasses: number,
  lr: number,
  l1W = 0.0,
  targets: Vector[] | null = null,
): void {
  const grads = initGrads(G);
  noise.forEach((z, i) => {
    const c = cs[i];
    const [xHat, gH, gPre1, gInp] = gForward(z, c, G, numClasses);
    const [p, dH, dPre1] = dForward(xHat, c, D, numClasses);
    const dLdpre2 = p - 1.0;
    const dhD = dH.map((_, j) => D.W2[0][j] * dLdpre2);
    const dpre1D = dH.map((_, j) => dhD[j] * leakyGrad(dPre1[j]));
    const dLdxhat: Vector = new Array(xHat.length).fill(0.0);
    for (let j = 0; j < dH.length; j++) {
      for (let k = 0; k < xHat.length; k++) dLdxhat[k] += D.W1[j][k] * dpre1D[j];
    }
    if (l1W > 0 && targets !== null) {
      for (let k = 0; k < xHat.length; k++) dLdxhat[k] += l1W * (xHat[k] > targets[i][k] ? 1.0 : -1.0);
    }
    grads.b2 = xHat.map((_, a) => grads.b2[a] + dLdxhat[a]);
    for (let a = 0; a < xHat.length; a++) {
      for (let b = 0; b < gH.length; b++) grads.W2[a][b] += dLdxhat[a] * gH[b];
    }
    const dhG = gH.map((_, b) => {
      let s = 0;
      for (let a = 0; a < xHat.length; a++) s += G.W2[a][b] * dLdxhat[a];
      return s;
    });
    const dpre1G = gH.map((_, j) => dhG[j] * leakyGrad(gPre1[j]));
    for (let j = 0; j < gH.length; j++) {
      grads.b1[j] += dpre1G[j];
      for (let k = 0; k < gInp.length; k++) grads.W1[j][k] += dpre1G[j] * gInp[k];
    }
  });
  applyGrads(G, grads, lr, noise.length);
}

function initGrads(net: Mlp): Mlp {
  return {
    W1: net.W1.map((r) => r.map(() => 0.0)),
    b1: net.b1.map(() => 0.0),
    W2: net.W2.map((r) => r.map(() => 0.0)),
    b2: net.b2.map(() => 0.0),
  };
}

function applyGrads(net: Mlp, grads: Mlp, lr: number, n: number): void {
  for (const k of ["W1", "W2"] as const) {
    for (let i = 0; i < net[k].length; i++) {
      for (let j = 0; j < net[k][i].length; j++) net[k][i][j] -= (lr * grads[k][i][j]) / n;
    }
  }
  for (const k of ["b1", "b2"] as const) {
    for (let i = 0; i < net[k].length; i++) net[k][i] -= (lr * grads[k][i]) / n;
  }
}

function mean(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / Math.max(xs.length, 1);
}

function noiseBatch(n: number, zDim: number, rng: Rng): Vector[] {
  const out: Vector[] = [];
  for (let i = 0; i < n; i++) {
    const z: Vector = [];
    for (let j = 0; j < zDim; j++) z.push(rng.gauss(0, 1));
    out.push(z);
  }
  return out;
}

function main(): void {
  const rng = new Rng(86);
  const numClasses = 2;
  const zDim = 4;
  const hidden = 16;
  const G = initMlp(zDim + numClasses, hidden, 1, rng);
  const D = initMlp(1 + numClasses, hidden, 1, rng);

  const batch = 32;
  const gLr = 0.02;
  const dLr = 0.01;
  console.log("=== conditional GAN on two-mode mixture (class 0 -> -2, class 1 -> +2) ===");
  for (let step = 1; step <= 600; step++) {
    const reals = sampleRealConditional(batch, numClasses, rng);
    let cs = reals.map(([, c]) => c);
    let noise = noiseBatch(batch, zDim, rng);
    const fakes: [Vector, number][] = [];
    for (let i = 0; i < batch; i++) fakes.push([gForward(noise[i], cs[i], G, numClasses)[0], cs[i]]);
    updateD(reals, fakes, D, numClasses, dLr);

    noise = noiseBatch(batch, zDim, rng);
    cs = [];
    for (let i = 0; i < batch; i++) cs.push(rng.randrange(numClasses));
    updateG(noise, cs, G, D, numClasses, gLr);

    if (step % 150 === 0) {
      const probes: number[][] = [];
      for (let c = 0; c < numClasses; c++) probes.push([]);
      for (let i = 0; i < 300; i++) {
        const c = rng.randrange(numClasses);
        const z: Vector = [];
        for (let j = 0; j < zDim; j++) z.push(rng.gauss(0, 1));
        probes[c].push(gForward(z, c, G, numClasses)[0][0]);
      }
      let line = `step ${String(step).padStart(4)}:`;
      for (let c = 0; c < numClasses; c++) {
        line += `  class ${c}: mean ${signed(mean(probes[c]), 2)}  (n=${probes[c].length})`;
      }
      console.log(line);
    }
  }

  console.log();
  console.log("=== sampling per class ===");
  for (let c = 0; c < numClasses; c++) {
    const zBatch = noiseBatch(6, zDim, rng);
    const outs = zBatch.map((z) => gForward(z, c, G, numClasses)[0][0]);
    console.log(`  class ${c}: ` + outs.map((v) => signed(v, 2)).join(" "));
  }

  console.log();
  console.log("takeaway: G(z, c) learns a class-specific sampler.");
  console.log("          same architecture, one extra input, totally different samples.");
}

main();

export {};
