// Lesson: Evaluation: FID, CLIP Score, Human Preference (phase 08 / lesson 14)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/08-generative-ai/14-evaluation-fid-clip-score/docs/en.md
// Run: npx tsx phases/08-generative-ai/14-evaluation-fid-clip-score/code/main.ts

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

function meanVec(vectors: Vector[]): Vector {
  const d = vectors[0].length;
  const n = vectors.length;
  return Array.from({ length: d }, (_, i) => {
    let s = 0;
    for (const v of vectors) s += v[i];
    return s / n;
  });
}

function covariance(vectors: Vector[], mu: Vector): Matrix {
  const d = mu.length;
  const n = vectors.length;
  const cov: Matrix = Array.from({ length: d }, () => new Array<number>(d).fill(0.0));
  for (const v of vectors) {
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) cov[i][j] += (v[i] - mu[i]) * (v[j] - mu[j]);
    }
  }
  return cov.map((row) => row.map((x) => x / Math.max(n - 1, 1)));
}

function trace(M: Matrix): number {
  let s = 0;
  for (let i = 0; i < M.length; i++) s += M[i][i];
  return s;
}

function matmul(A: Matrix, B: Matrix): Matrix {
  const n = A.length;
  const p = B[0].length;
  const m = B.length;
  const out: Matrix = Array.from({ length: n }, () => new Array<number>(p).fill(0.0));
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < m; k++) {
      for (let j = 0; j < p; j++) out[i][j] += A[i][k] * B[k][j];
    }
  }
  return out;
}

function jacobiSqrt(M: Matrix, iters = 30): Matrix {
  const n = M.length;
  let Y = M.map((row) => [...row]);
  let Z: Matrix = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1.0 : 0.0)));
  for (let it = 0; it < iters; it++) {
    const yInv = inverse(Y);
    const zInv = inverse(Z);
    const yNext = Y.map((row, i) => row.map((y, j) => (y + zInv[i][j]) / 2));
    const zNext = Z.map((row, i) => row.map((z, j) => (z + yInv[i][j]) / 2));
    Y = yNext;
    Z = zNext;
  }
  return Y;
}

function inverse(M: Matrix): Matrix {
  const n = M.length;
  const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1.0 : 0.0))]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    }
    [A[col], A[pivot]] = [A[pivot], A[col]];
    let piv = A[col][col];
    if (Math.abs(piv) < 1e-12) piv = 1e-12;
    for (let j = 0; j < 2 * n; j++) A[col][j] /= piv;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = A[r][col];
      for (let j = 0; j < 2 * n; j++) A[r][j] -= factor * A[col][j];
    }
  }
  return A.map((row) => row.slice(n));
}

function fid(realFeatures: Vector[], genFeatures: Vector[]): number {
  const muR = meanVec(realFeatures);
  const muG = meanVec(genFeatures);
  const covR = covariance(realFeatures, muR);
  const covG = covariance(genFeatures, muG);
  let meanSq = 0;
  for (let i = 0; i < muR.length; i++) meanSq += (muR[i] - muG[i]) ** 2;
  const prod = matmul(covR, covG);
  const sqrtProd = jacobiSqrt(prod);
  return meanSq + trace(covR) + trace(covG) - 2 * trace(sqrtProd);
}

function clipLike(a: Vector, b: Vector): number {
  let dot = 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  for (const x of a) sa += x * x;
  for (const x of b) sb += x * x;
  return dot / Math.max(Math.sqrt(sa) * Math.sqrt(sb), 1e-8);
}

function eloUpdate(rA: number, rB: number, winner: string, k = 32): [number, number] {
  const expectedA = 1 / (1 + 10 ** ((rB - rA) / 400));
  const actualA = winner === "a" ? 1.0 : 0.0;
  const delta = k * (actualA - expectedA);
  return [rA + delta, rB - delta];
}

function makeFeatures(center: number, n: number, d: number, rng: Random, scale = 0.4): Vector[] {
  return Array.from({ length: n }, () => Array.from({ length: d }, () => center + rng.gauss(0, scale)));
}

function signed(x: number, digits: number): string {
  return (x >= 0 ? "+" : "") + x.toFixed(digits);
}

function main(): void {
  const rng = new Random(29);
  const d = 4;

  console.log("=== FID bias at small N ===");
  for (const n of [50, 200, 1000]) {
    const real = makeFeatures(0.0, n, d, rng);
    const gen = makeFeatures(0.0, n, d, rng);
    const score = fid(real, gen);
    console.log(`  N=${String(n).padStart(5)}: FID (identical distributions) = ${score.toFixed(4)}  (lower = more similar)`);
  }

  console.log("  -> FID should be 0 for identical distributions but is biased up at small N");
  console.log();

  console.log("=== FID separates different distributions ===");
  const real = makeFeatures(0.0, 500, d, rng);
  for (const shift of [0.0, 0.2, 0.5, 1.0]) {
    const gen = makeFeatures(shift, 500, d, rng);
    const score = fid(real, gen);
    console.log(`  shift=${shift.toFixed(1)}: FID = ${score.toFixed(3)}`);
  }

  console.log();
  console.log("=== CLIP-like cosine similarity ===");
  const prompt = [1.0, 0.5, -0.2, 0.3];
  for (const imageCenter of [1.0, 0.5, 0.0, -0.5]) {
    const image = Array.from({ length: d }, () => imageCenter + rng.gauss(0, 0.1));
    const score = clipLike(image, prompt);
    console.log(`  image center ${signed(imageCenter, 1)}: CLIP-like score = ${signed(score, 3)}`);
  }

  console.log();
  console.log("=== Elo from synthetic A/B preferences ===");
  let rA = 1000;
  let rB = 1000;
  for (let i = 0; i < 200; i++) {
    const winner = rng.random() < 0.7 ? "a" : "b";
    [rA, rB] = eloUpdate(rA, rB, winner);
  }
  console.log(`  after 200 pairs (A wins 70%): r_A = ${rA.toFixed(0)}, r_B = ${rB.toFixed(0)}`);

  console.log();
  console.log("takeaway: FID is a distance; CLIP is an adherence score; Elo aggregates preferences.");
  console.log("          production evaluation uses all three plus qualitative failure audits.");
}

main();
