// Lesson: GANs: Generator vs Discriminator (phase 08 / lesson 03)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/08-generative-ai/03-gans-generator-discriminator/docs/en.md
// Run: npx tsx phases/08-generative-ai/03-gans-generator-discriminator/code/main.ts

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

function leakyRelu(x: number, a = 0.2): number {
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

function initMlp(inDim: number, hidden: number, outDim: number, rng: Rng): Mlp {
  return {
    W1: randnMatrix(hidden, inDim, rng),
    b1: new Array(hidden).fill(0.0),
    W2: randnMatrix(outDim, hidden, rng),
    b2: new Array(outDim).fill(0.0),
  };
}

function forwardG(z: Vector, G: Mlp): [Vector, Vector, Vector] {
  const pre1 = add(matmul(G.W1, z), G.b1);
  const h = pre1.map((v) => leakyRelu(v));
  const pre2 = add(matmul(G.W2, h), G.b2);
  return [pre2, h, pre1];
}

function forwardD(x: Vector, D: Mlp): [number, Vector, Vector, number] {
  const pre1 = add(matmul(D.W1, x), D.b1);
  const h = pre1.map((v) => leakyRelu(v));
  const pre2 = add(matmul(D.W2, h), D.b2);
  return [sigmoid(pre2[0]), h, pre1, pre2[0]];
}

function sampleReal(n: number, rng: Rng): Vector[] {
  const out: Vector[] = [];
  for (let i = 0; i < n; i++) {
    if (rng.random() < 0.5) out.push([rng.gauss(-2.0, 0.4)]);
    else out.push([rng.gauss(2.0, 0.4)]);
  }
  return out;
}

function sampleNoise(n: number, zDim: number, rng: Rng): Vector[] {
  const out: Vector[] = [];
  for (let i = 0; i < n; i++) {
    const z: Vector = [];
    for (let j = 0; j < zDim; j++) z.push(rng.gauss(0, 1));
    out.push(z);
  }
  return out;
}

function zerosLike(P: Mlp): Mlp {
  return {
    W1: P.W1.map((r) => r.map(() => 0.0)),
    b1: P.b1.map(() => 0.0),
    W2: P.W2.map((r) => r.map(() => 0.0)),
    b2: P.b2.map(() => 0.0),
  };
}

function applyGrads(P: Mlp, grads: Mlp, lr: number, n: number): void {
  for (const part of ["W1", "W2"] as const) {
    for (let i = 0; i < P[part].length; i++) {
      for (let j = 0; j < P[part][i].length; j++) P[part][i][j] -= (lr * grads[part][i][j]) / n;
    }
  }
  for (const part of ["b1", "b2"] as const) {
    for (let i = 0; i < P[part].length; i++) P[part][i] -= (lr * grads[part][i]) / n;
  }
}

function updateD(reals: Vector[], fakes: Vector[], D: Mlp, lr: number): void {
  const grads = zerosLike(D);

  const accumulate = (x: Vector, target: number): void => {
    const [p, h, pre1] = forwardD(x, D);
    const dLdpre2 = p - target;
    grads.b2[0] += dLdpre2;
    for (let j = 0; j < h.length; j++) grads.W2[0][j] += dLdpre2 * h[j];
    const dh = h.map((_, j) => D.W2[0][j] * dLdpre2);
    const dpre1 = h.map((_, j) => dh[j] * leakyGrad(pre1[j]));
    for (let j = 0; j < h.length; j++) {
      grads.b1[j] += dpre1[j];
      for (let k = 0; k < x.length; k++) grads.W1[j][k] += dpre1[j] * x[k];
    }
  };

  for (const x of reals) accumulate(x, 1.0);
  for (const x of fakes) accumulate(x, 0.0);

  applyGrads(D, grads, lr, reals.length + fakes.length);
}

function updateG(noiseBatch: Vector[], G: Mlp, D: Mlp, lr: number): void {
  const grads = zerosLike(G);

  for (const z of noiseBatch) {
    const [xHat, gH, gPre1] = forwardG(z, G);
    const [p, dH, dPre1] = forwardD(xHat, D);
    const dLdpre2 = p - 1.0;
    const dhD = dH.map((_, j) => D.W2[0][j] * dLdpre2);
    const dpre1D = dH.map((_, j) => dhD[j] * leakyGrad(dPre1[j]));
    const dLdxhat: Vector = new Array(xHat.length).fill(0.0);
    for (let j = 0; j < dH.length; j++) {
      for (let k = 0; k < xHat.length; k++) dLdxhat[k] += D.W1[j][k] * dpre1D[j];
    }
    grads.b2 = xHat.map((_, i) => grads.b2[i] + dLdxhat[i]);
    for (let i = 0; i < xHat.length; i++) {
      for (let j = 0; j < gH.length; j++) grads.W2[i][j] += dLdxhat[i] * gH[j];
    }
    const dhG = gH.map((_, j) => {
      let s = 0;
      for (let i = 0; i < xHat.length; i++) s += G.W2[i][j] * dLdxhat[i];
      return s;
    });
    const dpre1G = gH.map((_, j) => dhG[j] * leakyGrad(gPre1[j]));
    for (let j = 0; j < gH.length; j++) {
      grads.b1[j] += dpre1G[j];
      for (let k = 0; k < z.length; k++) grads.W1[j][k] += dpre1G[j] * z[k];
    }
  }

  applyGrads(G, grads, lr, noiseBatch.length);
}

function mean(xs: number[]): number {
  let s = 0;
  for (const x of xs) s += x;
  return s / Math.max(xs.length, 1);
}

function main(): void {
  const rng = new Rng(7);
  const zDim = 4;
  const hidden = 16;
  const G = initMlp(zDim, hidden, 1, rng);
  const D = initMlp(1, hidden, 1, rng);

  const batch = 32;
  const gLr = 0.02;
  const dLr = 0.01;
  console.log("=== training 1-D GAN on two-mode Gaussian mixture ===");
  for (let step = 1; step <= 800; step++) {
    const reals = sampleReal(batch, rng);
    let noise = sampleNoise(batch, zDim, rng);
    const fakes = noise.map((z) => forwardG(z, G)[0]);
    updateD(reals, fakes, D, dLr);

    noise = sampleNoise(batch, zDim, rng);
    updateG(noise, G, D, gLr);

    if (step % 100 === 0) {
      const probeFakes = sampleNoise(400, zDim, rng).map((z) => forwardG(z, G)[0][0]);
      const modeA = probeFakes.filter((v) => v < 0).length;
      const modeB = 400 - modeA;
      const dReal = mean(sampleReal(100, rng).map((x) => forwardD(x, D)[0]));
      const dFake = mean(probeFakes.map((v) => forwardD([v], D)[0]));
      const warn = Math.min(modeA, modeB) < 50 ? "  [!] mode collapse" : "";
      console.log(
        `step ${String(step).padStart(4)}: D(real)=${dReal.toFixed(2)}  D(fake)=${dFake.toFixed(2)}  ` +
          `modeA=${String(modeA).padStart(3)}  modeB=${String(modeB).padStart(3)}${warn}`,
      );
    }
  }

  console.log();
  console.log("=== final 10 generator samples ===");
  for (const z of sampleNoise(10, zDim, rng)) {
    console.log(`  G(z) = ${signed(forwardG(z, G)[0][0], 2)}`);
  }
}

main();

export {};
