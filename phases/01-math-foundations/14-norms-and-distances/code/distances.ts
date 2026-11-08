// Lesson: Norms and Distances (phase 01 / lesson 14)
// TypeScript port of code/distances.py. Node standard library only.
// Source: phases/01-math-foundations/14-norms-and-distances/docs/en.md
// Run: npx tsx phases/01-math-foundations/14-norms-and-distances/code/distances.ts
type Vector = number[];
type Matrix = number[][];

class SeededRandom {
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

  gauss(mu: number, sigma: number): number {
    const u1 = 1 - this.random();
    const u2 = this.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mu + sigma * z;
  }

  randint(low: number, high: number): number {
    return low + Math.floor(this.random() * (high - low + 1));
  }
}

function sum(values: number[]): number {
  let total = 0.0;
  let compensation = 0.0;
  for (const v of values) {
    const t = total + v;
    if (Math.abs(total) >= Math.abs(v)) {
      compensation += total - t + v;
    } else {
      compensation += v - t + total;
    }
    total = t;
  }
  if (compensation !== 0 && Number.isFinite(compensation)) {
    total += compensation;
  }
  return total;
}

function roundTo(x: number, digits: number): number {
  return Number(x.toFixed(digits));
}

function pyRepr(x: number): string {
  if (Number.isNaN(x)) return "nan";
  if (x === Infinity) return "inf";
  if (x === -Infinity) return "-inf";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mantissa, exponentText] = x.toExponential().split("e");
  const exponent = Number(exponentText);
  const sign = x < 0 ? "-" : "";
  const digits = mantissa!.replace("-", "").replace(".", "");
  if (exponent >= -4 && exponent < 16) {
    if (exponent < 0) {
      return sign + "0." + "0".repeat(-exponent - 1) + digits;
    }
    const padded = digits.padEnd(exponent + 1, "0");
    const intPart = padded.slice(0, exponent + 1);
    const fracPart = padded.slice(exponent + 1);
    return sign + intPart + "." + (fracPart === "" ? "0" : fracPart);
  }
  const head = digits[0];
  const tail = digits.slice(1);
  const expSign = exponent < 0 ? "-" : "+";
  const expDigits = String(Math.abs(exponent)).padStart(2, "0");
  return sign + head + (tail === "" ? "" : "." + tail) + "e" + expSign + expDigits;
}

function fmtF(x: number, decimals: number): string {
  if (Number.isNaN(x)) return "nan";
  if (x === Infinity) return "inf";
  if (x === -Infinity) return "-inf";
  const text = x.toFixed(decimals);
  return Object.is(x, -0) ? "-" + text : text;
}

function pyList(values: number[]): string {
  return "[" + values.map(pyRepr).join(", ") + "]";
}

function pyIntList(values: number[]): string {
  return "[" + values.map(String).join(", ") + "]";
}

function pyStrList(values: string[]): string {
  return "[" + values.map((v) => `'${v}'`).join(", ") + "]";
}

function pyBool(value: boolean): string {
  return value ? "True" : "False";
}

function l1Norm(x: Vector): number {
  return sum(x.map((xi) => Math.abs(xi)));
}

function l2Norm(x: Vector): number {
  return Math.sqrt(sum(x.map((xi) => xi ** 2)));
}

function lpNorm(x: Vector, p: number): number {
  if (p === Infinity) {
    return Math.max(...x.map((xi) => Math.abs(xi)));
  }
  return sum(x.map((xi) => Math.abs(xi) ** p)) ** (1 / p);
}

function linfNorm(x: Vector): number {
  return Math.max(...x.map((xi) => Math.abs(xi)));
}

function l1Distance(a: Vector, b: Vector): number {
  return sum(a.map((ai, i) => Math.abs(ai - b[i]!)));
}

function l2Distance(a: Vector, b: Vector): number {
  return Math.sqrt(sum(a.map((ai, i) => (ai - b[i]!) ** 2)));
}

function lpDistance(a: Vector, b: Vector, p: number): number {
  const diff = a.map((ai, i) => ai - b[i]!);
  return lpNorm(diff, p);
}

function linfDistance(a: Vector, b: Vector): number {
  return Math.max(...a.map((ai, i) => Math.abs(ai - b[i]!)));
}

function dotProduct(a: Vector, b: Vector): number {
  return sum(a.map((ai, i) => ai * b[i]!));
}

function cosineSimilarity(a: Vector, b: Vector): number {
  const dot = dotProduct(a, b);
  const normA = l2Norm(a);
  const normB = l2Norm(b);
  if (normA === 0 || normB === 0) {
    return 0.0;
  }
  return dot / (normA * normB);
}

function cosineDistance(a: Vector, b: Vector): number {
  return 1.0 - cosineSimilarity(a, b);
}

function mahalanobisDistance(x: Vector, y: Vector, covMatrix: Matrix): number {
  const n = x.length;
  const diff = x.map((xi, i) => xi - y[i]!);

  const invCov = invertMatrix(covMatrix);

  const temp = new Array<number>(n).fill(0.0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      temp[i]! += diff[j]! * invCov[j]![i]!;
    }
  }

  const result = sum(temp.map((t, i) => t * diff[i]!));
  return Math.sqrt(Math.max(0, result));
}

function invertMatrix(matrix: Matrix): Matrix {
  const n = matrix.length;
  const augmented = matrix.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1.0 : 0.0))]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(augmented[row]![col]!) > Math.abs(augmented[maxRow]![col]!)) {
        maxRow = row;
      }
    }
    const swap = augmented[col]!;
    augmented[col] = augmented[maxRow]!;
    augmented[maxRow] = swap;

    const pivotRow = augmented[col]!;
    const pivot = pivotRow[col]!;
    if (Math.abs(pivot) < 1e-12) {
      throw new Error("Matrix is singular or near-singular");
    }
    for (let j = 0; j < 2 * n; j++) {
      pivotRow[j]! /= pivot;
    }

    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const current = augmented[row]!;
        const factor = current[col]!;
        for (let j = 0; j < 2 * n; j++) {
          current[j]! -= factor * pivotRow[j]!;
        }
      }
    }
  }

  return augmented.map((row) => row.slice(n));
}

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) {
    return 1.0;
  }
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersection += 1;
    }
  }
  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

function jaccardDistance(setA: Set<string>, setB: Set<string>): number {
  return 1.0 - jaccardSimilarity(setA, setB);
}

function editDistance(first: string, second: string): number {
  const s1 = [...first];
  const s2 = [...second];
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    dp[i]![0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0]![j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!;
      } else {
        dp[i]![j] = 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
      }
    }
  }

  return dp[m]![n]!;
}

function klDivergence(p: number[], q: number[]): number {
  let total = 0.0;
  for (let i = 0; i < p.length; i++) {
    const pi = p[i]!;
    const qi = q[i]!;
    if (pi > 0) {
      if (qi <= 0) {
        return Infinity;
      }
      total += pi * Math.log(pi / qi);
    }
  }
  return total;
}

function wasserstein1d(p: number[], q: number[]): number {
  if (p.length !== q.length) {
    throw new Error("Distributions must have the same number of bins");
  }
  const n = p.length;
  const cdfP = new Array<number>(n).fill(0.0);
  const cdfQ = new Array<number>(n).fill(0.0);

  cdfP[0] = p[0]!;
  cdfQ[0] = q[0]!;
  for (let i = 1; i < n; i++) {
    cdfP[i] = cdfP[i - 1]! + p[i]!;
    cdfQ[i] = cdfQ[i - 1]! + q[i]!;
  }

  return sum(cdfP.map((c, i) => Math.abs(c - cdfQ[i]!)));
}

function computeCovariance(data: Matrix): Matrix {
  const n = data.length;
  const d = data[0]!.length;
  const means = Array.from({ length: d }, (_, j) => sum(data.map((row) => row[j]!)) / n);
  const centered = data.map((row) => row.map((value, j) => value - means[j]!));
  const cov: Matrix = Array.from({ length: d }, () => new Array<number>(d).fill(0.0));
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      cov[i]![j] = sum(centered.map((row) => row[i]! * row[j]!)) / (n - 1);
    }
  }
  return cov;
}

function normalizeVector(v: Vector): Vector {
  const norm = l2Norm(v);
  if (norm === 0) {
    return v.slice();
  }
  return v.map((vi) => vi / norm);
}

type DistanceFn = (a: Vector, b: Vector) => number;

function findNearestNeighbor(query: Vector, dataset: Vector[], distanceFn: DistanceFn): [number, number] {
  let bestIdx = 0;
  let bestDist = Infinity;
  dataset.forEach((point, i) => {
    const d = distanceFn(query, point);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  });
  return [bestIdx, bestDist];
}

function findKNearest(query: Vector, dataset: Vector[], distanceFn: DistanceFn, k = 5): [number, number][] {
  const distances: [number, number][] = dataset.map((point, i) => [i, distanceFn(query, point)]);
  distances.sort((x, y) => x[1] - y[1]);
  return distances.slice(0, k);
}

function banner(title: string): void {
  console.log("=".repeat(65));
  console.log(title);
  console.log("=".repeat(65));
}

function demoNorms(): void {
  banner("NORMS: MEASURING VECTOR SIZE");

  const vectors: [string, Vector][] = [
    ["(3, 4)", [3, 4]],
    ["(1, 1, 1, 1)", [1, 1, 1, 1]],
    ["(5, 0, 0)", [5, 0, 0]],
    ["(1, 2, 3, 4, 5)", [1, 2, 3, 4, 5]],
  ];

  console.log(`  ${"Vector".padEnd(20)} ${"L1".padStart(8)} ${"L2".padStart(8)} ${"L3".padStart(8)} ${"L-inf".padStart(8)}`);
  console.log(`  ${"-".repeat(20)} ${"-".repeat(8)} ${"-".repeat(8)} ${"-".repeat(8)} ${"-".repeat(8)}`);
  for (const [name, v] of vectors) {
    console.log(
      `  ${name.padEnd(20)} ${fmtF(l1Norm(v), 3).padStart(8)} ${fmtF(l2Norm(v), 3).padStart(8)} ` +
        `${fmtF(lpNorm(v, 3), 3).padStart(8)} ${fmtF(linfNorm(v), 3).padStart(8)}`,
    );
  }

  console.log();
  console.log("  Note: L-inf <= L2 <= L1 always holds.");
  console.log();
}

function demoDistances(): void {
  banner("DISTANCES BETWEEN TWO POINTS");

  const a = [1, 2, 3];
  const b = [4, 0, 6];

  console.log(`  A = ${pyIntList(a)}`);
  console.log(`  B = ${pyIntList(b)}`);
  console.log();
  console.log(`  L1 (Manhattan):   ${fmtF(l1Distance(a, b), 4)}`);
  console.log(`  L2 (Euclidean):   ${fmtF(l2Distance(a, b), 4)}`);
  console.log(`  L3:               ${fmtF(lpDistance(a, b, 3), 4)}`);
  console.log(`  L-inf (Chebyshev):${fmtF(linfDistance(a, b), 4)}`);
  console.log(`  Cosine distance:  ${fmtF(cosineDistance(a, b), 4)}`);
  console.log(`  Cosine similarity:${fmtF(cosineSimilarity(a, b), 4)}`);
  console.log(`  Dot product:      ${fmtF(dotProduct(a, b), 4)}`);
  console.log();
}

function pairRow(label: string, x: Vector, y: Vector): string {
  return `  ${label.padEnd(10)} ${fmtF(cosineSimilarity(x, y), 4).padStart(10)} ${fmtF(dotProduct(x, y), 4).padStart(10)}`;
}

function demoCosineVsDot(): void {
  banner("COSINE SIMILARITY vs DOT PRODUCT");

  const a = [1, 2, 3];
  const b = [2, 4, 6];
  const c = [3, 1, 0];

  console.log(`  A = ${pyIntList(a)}`);
  console.log(`  B = ${pyIntList(b)}  (A scaled by 2)`);
  console.log(`  C = ${pyIntList(c)}  (different direction)`);
  console.log();
  console.log(`  ${"Pair".padEnd(10)} ${"Cosine".padStart(10)} ${"Dot".padStart(10)}`);
  console.log(`  ${"-".repeat(10)} ${"-".repeat(10)} ${"-".repeat(10)}`);
  console.log(pairRow("A vs B", a, b));
  console.log(pairRow("A vs C", a, c));
  console.log(pairRow("B vs C", b, c));
  console.log();
  console.log("  Cosine says A and B are identical (same direction).");
  console.log("  Dot product says B is more similar because of larger magnitude.");
  console.log();

  const aNorm = normalizeVector(a);
  const bNorm = normalizeVector(b);
  const cNorm = normalizeVector(c);

  console.log("  After L2 normalization:");
  console.log(`  ${"Pair".padEnd(10)} ${"Cosine".padStart(10)} ${"Dot".padStart(10)}`);
  console.log(`  ${"-".repeat(10)} ${"-".repeat(10)} ${"-".repeat(10)}`);
  console.log(pairRow("A vs B", aNorm, bNorm));
  console.log(pairRow("A vs C", aNorm, cNorm));
  console.log();
  console.log("  After normalization, cosine and dot product are identical.");
  console.log();
}

function demoMahalanobis(): void {
  banner("MAHALANOBIS DISTANCE");

  const rng = new SeededRandom(42);
  const n = 200;
  const data: Matrix = [];
  for (let i = 0; i < n; i++) {
    const x = rng.gauss(0, 3);
    const y = 0.8 * x + rng.gauss(0, 1);
    data.push([x, y]);
  }

  const cov = computeCovariance(data);
  const mean = [sum(data.map((d) => d[0]!)) / n, sum(data.map((d) => d[1]!)) / n];

  const pointAlong = [mean[0]! + 3, mean[1]! + 0.8 * 3];
  const pointPerp = [mean[0]! + 1, mean[1]! - 3];

  const l2Along = l2Distance(mean, pointAlong);
  const l2Perp = l2Distance(mean, pointPerp);
  const mahAlong = mahalanobisDistance(mean, pointAlong, cov);
  const mahPerp = mahalanobisDistance(mean, pointPerp, cov);

  console.log(`  Data: ${n} points with correlated features (r ~ 0.8)`);
  console.log(`  Mean: (${fmtF(mean[0]!, 2)}, ${fmtF(mean[1]!, 2)})`);
  console.log(
    `  Covariance: [[${fmtF(cov[0]![0]!, 2)}, ${fmtF(cov[0]![1]!, 2)}], ` +
      `[${fmtF(cov[1]![0]!, 2)}, ${fmtF(cov[1]![1]!, 2)}]]`,
  );
  console.log();
  console.log(`  Point along correlation axis:  ${pyList(pointAlong.map((x) => roundTo(x, 2)))}`);
  console.log(`    L2 distance from mean:       ${fmtF(l2Along, 4)}`);
  console.log(`    Mahalanobis distance:         ${fmtF(mahAlong, 4)}`);
  console.log();
  console.log(`  Point perpendicular to axis:   ${pyList(pointPerp.map((x) => roundTo(x, 2)))}`);
  console.log(`    L2 distance from mean:       ${fmtF(l2Perp, 4)}`);
  console.log(`    Mahalanobis distance:         ${fmtF(mahPerp, 4)}`);
  console.log();
  console.log("  L2 says both points are similar distances from the mean.");
  console.log("  Mahalanobis correctly identifies the perpendicular point as");
  console.log("  more unusual given the correlation structure of the data.");
  console.log();
}

function demoJaccard(): void {
  banner("JACCARD SIMILARITY (SETS)");

  const pairs: [Set<string>, Set<string>][] = [
    [new Set(["cat", "dog", "fish"]), new Set(["cat", "bird", "fish", "snake"])],
    [new Set(["python", "java", "rust"]), new Set(["python", "java", "rust"])],
    [new Set(["a", "b", "c"]), new Set(["d", "e", "f"])],
    [new Set(["ml", "ai", "data"]), new Set(["ml", "ai", "data", "ops", "cloud"])],
  ];

  for (const [a, b] of pairs) {
    const j = jaccardSimilarity(a, b);
    console.log(`  A = ${pyStrList([...a].sort())}`);
    console.log(`  B = ${pyStrList([...b].sort())}`);
    console.log(`  Jaccard similarity: ${fmtF(j, 4)}`);
    console.log(`  Jaccard distance:   ${fmtF(1 - j, 4)}`);
    console.log();
  }
}

function demoEditDistance(): void {
  banner("EDIT DISTANCE (LEVENSHTEIN)");

  const pairs: [string, string][] = [
    ["kitten", "sitting"],
    ["sunday", "saturday"],
    ["hello", "hello"],
    ["", "abc"],
    ["algorithm", "altruistic"],
    ["python", "pytorch"],
  ];

  for (const [s1, s2] of pairs) {
    const d = editDistance(s1, s2);
    console.log(`  '${s1}' -> '${s2}':  distance = ${d}`);
  }

  console.log();
}

function demoKlDivergence(): void {
  banner("KL DIVERGENCE (NOT SYMMETRIC)");

  const p = [0.9, 0.1];
  const q = [0.5, 0.5];

  const klPq = klDivergence(p, q);
  const klQp = klDivergence(q, p);

  console.log(`  P = ${pyList(p)}`);
  console.log(`  Q = ${pyList(q)}`);
  console.log(`  KL(P || Q) = ${fmtF(klPq, 4)} nats`);
  console.log(`  KL(Q || P) = ${fmtF(klQp, 4)} nats`);
  console.log(`  Difference: ${fmtF(Math.abs(klPq - klQp), 4)}`);
  console.log("  KL divergence is NOT a distance metric.");
  console.log();

  const p2 = [0.25, 0.25, 0.25, 0.25];
  const q2 = [0.1, 0.1, 0.1, 0.7];

  console.log(`  P = ${pyList(p2)}`);
  console.log(`  Q = ${pyList(q2)}`);
  console.log(`  KL(P || Q) = ${fmtF(klDivergence(p2, q2), 4)} nats`);
  console.log(`  KL(Q || P) = ${fmtF(klDivergence(q2, p2), 4)} nats`);
  console.log();
}

function demoWasserstein(): void {
  banner("WASSERSTEIN DISTANCE (EARTH MOVER'S DISTANCE)");

  const cases: [string, number[], number[]][] = [
    ["Identical", [0.25, 0.25, 0.25, 0.25], [0.25, 0.25, 0.25, 0.25]],
    ["Shifted right by 1", [0.5, 0.5, 0.0, 0.0], [0.0, 0.5, 0.5, 0.0]],
    ["Shifted right by 2", [0.5, 0.5, 0.0, 0.0], [0.0, 0.0, 0.5, 0.5]],
    ["Opposite ends", [1.0, 0.0, 0.0, 0.0], [0.0, 0.0, 0.0, 1.0]],
    ["Spread vs concentrated", [0.25, 0.25, 0.25, 0.25], [0.0, 0.0, 0.0, 1.0]],
  ];

  for (const [name, p, q] of cases) {
    const w = wasserstein1d(p, q);
    const kl = klDivergence(p, q);
    const klText = kl !== Infinity ? fmtF(kl, 4) : "inf";
    console.log(`  ${name}`);
    console.log(`    P = ${pyList(p)}`);
    console.log(`    Q = ${pyList(q)}`);
    console.log(`    Wasserstein: ${fmtF(w, 4)}    KL: ${klText}`);
    console.log();
  }

  console.log("  Wasserstein provides finite, meaningful distances even when");
  console.log("  distributions do not overlap (where KL goes to infinity).");
  console.log();
}

function demoDifferentNeighbors(): void {
  banner("SAME DATA, DIFFERENT METRICS, DIFFERENT NEAREST NEIGHBORS");

  const rng = new SeededRandom(123);
  const nPoints = 8;
  const dim = 5;

  const dataset: Vector[] = [];
  for (let i = 0; i < nPoints; i++) {
    let point: Vector;
    if (i < 3) {
      point = Array.from({ length: dim }, () => rng.gauss(0, 1));
    } else if (i < 6) {
      const base = Array.from({ length: dim }, () => rng.gauss(0, 0.5));
      base[0]! *= 5;
      point = base;
    } else {
      point = Array.from({ length: dim }, () => rng.gauss(3, 0.3));
    }
    dataset.push(point);
  }

  const query = [1.0, 0.5, -0.5, 1.0, 0.2];

  console.log(`  Query: ${pyList(query.map((x) => roundTo(x, 2)))}`);
  console.log();
  console.log(
    `  ${"Point".padEnd(8)} ${"L1".padStart(8)} ${"L2".padStart(8)} ${"Cosine".padStart(8)} ${"L-inf".padStart(8)}`,
  );
  console.log(`  ${"-".repeat(8)} ${"-".repeat(8)} ${"-".repeat(8)} ${"-".repeat(8)} ${"-".repeat(8)}`);

  const results = new Map<string, [number, number][]>([
    ["L1", []],
    ["L2", []],
    ["Cosine", []],
    ["L-inf", []],
  ]);

  dataset.forEach((point, i) => {
    const dL1 = l1Distance(query, point);
    const dL2 = l2Distance(query, point);
    const dCos = cosineDistance(query, point);
    const dLinf = linfDistance(query, point);

    results.get("L1")!.push([i, dL1]);
    results.get("L2")!.push([i, dL2]);
    results.get("Cosine")!.push([i, dCos]);
    results.get("L-inf")!.push([i, dLinf]);

    console.log(
      `  P${String(i).padEnd(6)} ${fmtF(dL1, 3).padStart(8)} ${fmtF(dL2, 3).padStart(8)} ` +
        `${fmtF(dCos, 4).padStart(8)} ${fmtF(dLinf, 3).padStart(8)}`,
    );
  });

  const closest = (dists: [number, number][]): [number, number] => {
    let best = dists[0]!;
    for (const entry of dists) {
      if (entry[1] < best[1]) {
        best = entry;
      }
    }
    return best;
  };

  console.log();
  console.log("  Nearest neighbor by metric:");
  for (const [metricName, dists] of results) {
    const best = closest(dists);
    console.log(`    ${metricName.padEnd(8)}: Point ${best[0]} (distance = ${fmtF(best[1], 4)})`);
  }

  const l1Best = closest(results.get("L1")!)[0];
  const l2Best = closest(results.get("L2")!)[0];
  const cosBest = closest(results.get("Cosine")!)[0];
  const linfBest = closest(results.get("L-inf")!)[0];

  const allSame = l1Best === l2Best && l2Best === cosBest && cosBest === linfBest;
  if (!allSame) {
    console.log();
    console.log("  The metrics DISAGREE on which point is nearest.");
    console.log("  Your distance function defines your notion of similarity.");
  }
  console.log();
}

function demoEmbeddingSearch(): void {
  banner("EMBEDDING SIMILARITY SEARCH");

  const rng = new SeededRandom(77);
  const dim = 64;

  const documents = [
    "machine learning algorithms",
    "deep neural networks",
    "natural language processing",
    "computer vision models",
    "reinforcement learning agents",
    "database query optimization",
    "web server configuration",
    "network security protocols",
  ];

  const embeddings: Vector[] = [];
  documents.forEach((_, i) => {
    const base = Array.from({ length: dim }, () => rng.gauss(0, 1));
    if (i < 5) {
      for (let j = 0; j < 10; j++) base[j]! += 2.0;
    } else {
      for (let j = 10; j < 20; j++) base[j]! += 2.0;
    }
    if (i === 0 || i === 1) {
      for (let j = 20; j < 25; j++) base[j]! += 1.5;
    }
    embeddings.push(base);
  });

  const noise = Array.from({ length: dim }, () => rng.gauss(0, 0.3));
  const queryEmbedding = embeddings[0]!.map((q, i) => q + noise[i]!);

  console.log(`  Query: '${documents[0]}' (with noise)`);
  console.log(`  Embedding dimension: ${dim}`);
  console.log();

  const cosineScores: [number, number][] = [];
  const l2Scores: [number, number][] = [];
  const dotScores: [number, number][] = [];

  for (let i = 0; i < documents.length; i++) {
    cosineScores.push([i, cosineSimilarity(queryEmbedding, embeddings[i]!)]);
    l2Scores.push([i, l2Distance(queryEmbedding, embeddings[i]!)]);
    dotScores.push([i, dotProduct(queryEmbedding, embeddings[i]!)]);
  }

  const cosineRanked = [...cosineScores].sort((x, y) => y[1] - x[1]);
  const l2Ranked = [...l2Scores].sort((x, y) => x[1] - y[1]);
  const dotRanked = [...dotScores].sort((x, y) => y[1] - x[1]);

  console.log(`  ${"Rank".padEnd(6)} ${"Cosine".padEnd(35)} ${"L2".padEnd(35)} ${"Dot Product".padEnd(35)}`);
  console.log(`  ${"-".repeat(6)} ${"-".repeat(35)} ${"-".repeat(35)} ${"-".repeat(35)}`);
  for (let rank = 0; rank < documents.length; rank++) {
    const [ci, cs] = cosineRanked[rank]!;
    const [li, ls] = l2Ranked[rank]!;
    const [di, ds] = dotRanked[rank]!;
    const cosText = `${documents[ci]!.slice(0, 25).padEnd(25)} (${fmtF(cs, 3)})`;
    const l2Text = `${documents[li]!.slice(0, 25).padEnd(25)} (${fmtF(ls, 1)})`;
    const dotText = `${documents[di]!.slice(0, 25).padEnd(25)} (${fmtF(ds, 1)})`;
    console.log(`  ${String(rank + 1).padEnd(6)} ${cosText.padEnd(35)} ${l2Text.padEnd(35)} ${dotText.padEnd(35)}`);
  }

  console.log();
  console.log("  Cosine similarity focuses on direction (topic similarity).");
  console.log("  L2 distance is sensitive to magnitude differences.");
  console.log("  Dot product blends direction and magnitude.");
  console.log();
}

function demoKnnClassification(): void {
  banner("KNN CLASSIFICATION: DISTANCE METRIC CHANGES THE PREDICTION");

  const trainingData: [Vector, string][] = [
    [[1.0, 5.0], "A"],
    [[1.5, 4.5], "A"],
    [[2.0, 4.0], "A"],
    [[5.0, 1.0], "B"],
    [[4.5, 1.5], "B"],
    [[4.0, 2.0], "B"],
    [[3.0, 3.0], "C"],
    [[3.5, 2.5], "C"],
    [[2.5, 3.5], "C"],
  ];

  const query = [2.8, 2.8];

  console.log(`  Query: ${pyList(query)}`);
  console.log(`  Training set: ${trainingData.length} points, 3 classes`);
  console.log();

  const k = 3;
  const metrics: [string, DistanceFn][] = [
    ["L1", l1Distance],
    ["L2", l2Distance],
    ["Cosine", cosineDistance],
    ["L-inf", linfDistance],
  ];
  for (const [metricName, distFn] of metrics) {
    const distances: [number, string, Vector][] = trainingData.map(([point, label]) => [
      distFn(query, point),
      label,
      point,
    ]);
    distances.sort((x, y) => x[0] - y[0]);

    const neighbors = distances.slice(0, k);
    const votes = new Map<string, number>();
    for (const [, label] of neighbors) {
      votes.set(label, (votes.get(label) ?? 0) + 1);
    }
    let prediction = "";
    let bestVotes = -1;
    for (const [label, count] of votes) {
      if (count > bestVotes) {
        bestVotes = count;
        prediction = label;
      }
    }

    console.log(`  Metric: ${metricName}`);
    for (const [d, label, point] of neighbors) {
      console.log(`    Neighbor: ${pyList(point)}  class=${label}  dist=${fmtF(d, 4)}`);
    }
    console.log(`    Prediction (k=${k}): ${prediction}`);
    console.log();
  }
}

function demoRegularization(): void {
  banner("L1 vs L2 REGULARIZATION EFFECT ON WEIGHTS");

  const rng = new SeededRandom(42);
  const nFeatures = 10;
  const weights = Array.from({ length: nFeatures }, () => rng.gauss(0, 2));

  console.log(`  Original weights: ${pyList(weights.map((w) => roundTo(w, 3)))}`);
  console.log(`  L1 norm: ${fmtF(l1Norm(weights), 4)}`);
  console.log(`  L2 norm: ${fmtF(l2Norm(weights), 4)}`);
  console.log();

  const lr = 0.1;

  const wL1 = weights.slice();
  for (let step = 0; step < 50; step++) {
    for (let i = 0; i < nFeatures; i++) {
      const w = wL1[i]!;
      const grad = lr * Math.sign(w);
      wL1[i] = w - grad;
      if (Math.abs(wL1[i]!) < lr) {
        wL1[i] = 0.0;
      }
    }
  }

  const wL2 = weights.slice();
  for (let step = 0; step < 50; step++) {
    for (let i = 0; i < nFeatures; i++) {
      const grad = lr * 2 * wL2[i]!;
      wL2[i]! -= grad;
    }
  }

  console.log("  After L1 regularization (50 steps):");
  console.log(`    Weights: ${pyList(wL1.map((w) => roundTo(w, 3)))}`);
  console.log(`    Zeros:   ${wL1.filter((w) => w === 0.0).length}/${nFeatures}`);
  console.log(`    L1 norm: ${fmtF(l1Norm(wL1), 4)}`);
  console.log();
  console.log("  After L2 regularization (50 steps):");
  console.log(`    Weights: ${pyList(wL2.map((w) => roundTo(w, 3)))}`);
  console.log(`    Zeros:   ${wL2.filter((w) => Math.abs(w) < 1e-10).length}/${nFeatures}`);
  console.log(`    L2 norm: ${fmtF(l2Norm(wL2), 4)}`);
  console.log();
  console.log("  L1 drives 'small' weights to exactly zero (sparsity).");
  console.log("  L2 shrinks all weights but none reach exactly zero.");
  console.log();
}

function demoNormOrdering(): void {
  banner("NORM ORDERING: L-inf <= L2 <= L1 (always)");

  const rng = new SeededRandom(55);
  for (let trial = 0; trial < 5; trial++) {
    const dim = rng.randint(2, 10);
    const a = Array.from({ length: dim }, () => rng.gauss(0, 5));
    const b = Array.from({ length: dim }, () => rng.gauss(0, 5));

    const d1 = l1Distance(a, b);
    const d2 = l2Distance(a, b);
    const dinf = linfDistance(a, b);

    const holds = dinf <= d2 && d2 <= d1;
    console.log(
      `  dim=${String(dim).padStart(2)}  L1=${fmtF(d1, 3).padStart(8)}  L2=${fmtF(d2, 3).padStart(8)}  ` +
        `L-inf=${fmtF(dinf, 3).padStart(8)}  ordering holds: ${pyBool(holds)}`,
    );
  }

  console.log();
  console.log("  For any p1 < p2: ||x||_p2 <= ||x||_p1");
  console.log("  Higher p values focus on fewer (larger) components.");
  console.log();
}

demoNorms();
demoDistances();
demoCosineVsDot();
demoMahalanobis();
demoJaccard();
demoEditDistance();
demoKlDivergence();
demoWasserstein();
demoNormOrdering();
demoDifferentNeighbors();
demoEmbeddingSearch();
demoKnnClassification();
demoRegularization();
