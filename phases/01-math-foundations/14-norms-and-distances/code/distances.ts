// Phase 1 · Lesson 14 — Norms & Distances (TypeScript port).
// From-scratch norms, distance metrics, and similarity measures; mirrors distances.py.
// A seeded PRNG keeps the randomized demos deterministic across runs.
// Refs: https://en.wikipedia.org/wiki/Norm_(mathematics)  https://en.wikipedia.org/wiki/Levenshtein_distance

function makeRng(seed: number): { next: () => number; gauss: (mu: number, sigma: number) => number; randint: (lo: number, hi: number) => number } {
  let state = seed >>> 0;
  const next = (): number => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = (mu: number, sigma: number): number => {
    let u = 0;
    let v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const randint = (lo: number, hi: number): number => lo + Math.floor(next() * (hi - lo + 1));
  return { next, gauss, randint };
}

function l1Norm(x: number[]): number {
  return x.reduce((acc, xi) => acc + Math.abs(xi), 0);
}

function l2Norm(x: number[]): number {
  return Math.sqrt(x.reduce((acc, xi) => acc + xi * xi, 0));
}

function lpNorm(x: number[], p: number): number {
  if (!Number.isFinite(p)) return Math.max(...x.map((xi) => Math.abs(xi)));
  return x.reduce((acc, xi) => acc + Math.abs(xi) ** p, 0) ** (1 / p);
}

function linfNorm(x: number[]): number {
  return Math.max(...x.map((xi) => Math.abs(xi)));
}

function l1Distance(a: number[], b: number[]): number {
  return a.reduce((acc, ai, i) => acc + Math.abs(ai - b[i]!), 0);
}

function l2Distance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((acc, ai, i) => acc + (ai - b[i]!) ** 2, 0));
}

function lpDistance(a: number[], b: number[], p: number): number {
  return lpNorm(a.map((ai, i) => ai - b[i]!), p);
}

function linfDistance(a: number[], b: number[]): number {
  return Math.max(...a.map((ai, i) => Math.abs(ai - b[i]!)));
}

function dotProduct(a: number[], b: number[]): number {
  return a.reduce((acc, ai, i) => acc + ai * b[i]!, 0);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const normA = l2Norm(a);
  const normB = l2Norm(b);
  if (normA === 0 || normB === 0) return 0;
  return dotProduct(a, b) / (normA * normB);
}

function cosineDistance(a: number[], b: number[]): number {
  return 1 - cosineSimilarity(a, b);
}

function invertMatrix(matrix: number[][]): number[][] {
  const n = matrix.length;
  const aug = matrix.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);

  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row]![col]!) > Math.abs(aug[maxRow]![col]!)) maxRow = row;
    }
    [aug[col], aug[maxRow]] = [aug[maxRow]!, aug[col]!];

    const pivot = aug[col]![col]!;
    if (Math.abs(pivot) < 1e-12) throw new Error("Matrix is singular or near-singular");
    for (let j = 0; j < 2 * n; j++) aug[col]![j]! /= pivot;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row]![col]!;
      for (let j = 0; j < 2 * n; j++) aug[row]![j]! -= factor * aug[col]![j]!;
    }
  }

  return aug.map((row) => row.slice(n));
}

function mahalanobisDistance(x: number[], y: number[], cov: number[][]): number {
  const n = x.length;
  const diff = x.map((xi, i) => xi - y[i]!);
  const invCov = invertMatrix(cov);

  const temp = Array.from({ length: n }, (_, i) =>
    diff.reduce((acc, dj, j) => acc + dj * invCov[j]![i]!, 0)
  );
  const result = temp.reduce((acc, ti, i) => acc + ti * diff[i]!, 0);
  return Math.sqrt(Math.max(0, result));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function editDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

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
  let total = 0;
  for (let i = 0; i < p.length; i++) {
    if (p[i]! > 0) {
      if (q[i]! <= 0) return Infinity;
      total += p[i]! * Math.log(p[i]! / q[i]!);
    }
  }
  return total;
}

function wasserstein1d(p: number[], q: number[]): number {
  if (p.length !== q.length) throw new Error("Distributions must have the same number of bins");
  let cdfP = 0;
  let cdfQ = 0;
  let total = 0;
  for (let i = 0; i < p.length; i++) {
    cdfP += p[i]!;
    cdfQ += q[i]!;
    total += Math.abs(cdfP - cdfQ);
  }
  return total;
}

function computeCovariance(data: number[][]): number[][] {
  const n = data.length;
  const d = data[0]!.length;
  const means = Array.from({ length: d }, (_, j) => data.reduce((acc, row) => acc + row[j]!, 0) / n);
  const centered = data.map((row) => row.map((v, j) => v - means[j]!));
  const cov = Array.from({ length: d }, () => new Array<number>(d).fill(0));
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      cov[i]![j] = centered.reduce((acc, row) => acc + row[i]! * row[j]!, 0) / (n - 1);
    }
  }
  return cov;
}

function normalizeVector(v: number[]): number[] {
  const norm = l2Norm(v);
  if (norm === 0) return [...v];
  return v.map((vi) => vi / norm);
}

const line = (): string => "=".repeat(65);
const r2 = (x: number): number => Math.round(x * 100) / 100;
const pad = (s: string, w: number, right = false): string => (right ? s.padStart(w) : s.padEnd(w));

function demoNorms(): void {
  console.log(line());
  console.log("NORMS: MEASURING VECTOR SIZE");
  console.log(line());

  const vectors: [string, number[]][] = [
    ["(3, 4)", [3, 4]],
    ["(1, 1, 1, 1)", [1, 1, 1, 1]],
    ["(5, 0, 0)", [5, 0, 0]],
    ["(1, 2, 3, 4, 5)", [1, 2, 3, 4, 5]],
  ];

  console.log(`  ${pad("Vector", 20)} ${pad("L1", 8, true)} ${pad("L2", 8, true)} ${pad("L3", 8, true)} ${pad("L-inf", 8, true)}`);
  for (const [name, v] of vectors) {
    console.log(
      `  ${pad(name, 20)} ${pad(l1Norm(v).toFixed(3), 8, true)} ${pad(l2Norm(v).toFixed(3), 8, true)} ` +
        `${pad(lpNorm(v, 3).toFixed(3), 8, true)} ${pad(linfNorm(v).toFixed(3), 8, true)}`
    );
  }
  console.log("\n  Note: L-inf <= L2 <= L1 always holds.\n");
}

function demoDistances(): void {
  console.log(line());
  console.log("DISTANCES BETWEEN TWO POINTS");
  console.log(line());

  const a = [1, 2, 3];
  const b = [4, 0, 6];

  console.log(`  A = [${a}]`);
  console.log(`  B = [${b}]\n`);
  console.log(`  L1 (Manhattan):   ${l1Distance(a, b).toFixed(4)}`);
  console.log(`  L2 (Euclidean):   ${l2Distance(a, b).toFixed(4)}`);
  console.log(`  L3:               ${lpDistance(a, b, 3).toFixed(4)}`);
  console.log(`  L-inf (Chebyshev):${linfDistance(a, b).toFixed(4)}`);
  console.log(`  Cosine distance:  ${cosineDistance(a, b).toFixed(4)}`);
  console.log(`  Cosine similarity:${cosineSimilarity(a, b).toFixed(4)}`);
  console.log(`  Dot product:      ${dotProduct(a, b).toFixed(4)}\n`);
}

function demoCosineVsDot(): void {
  console.log(line());
  console.log("COSINE SIMILARITY vs DOT PRODUCT");
  console.log(line());

  const a = [1, 2, 3];
  const b = [2, 4, 6];
  const c = [3, 1, 0];

  console.log(`  A = [${a}]`);
  console.log(`  B = [${b}]  (A scaled by 2)`);
  console.log(`  C = [${c}]  (different direction)\n`);
  console.log(`  ${pad("Pair", 10)} ${pad("Cosine", 10, true)} ${pad("Dot", 10, true)}`);
  console.log(`  ${pad("A vs B", 10)} ${pad(cosineSimilarity(a, b).toFixed(4), 10, true)} ${pad(dotProduct(a, b).toFixed(4), 10, true)}`);
  console.log(`  ${pad("A vs C", 10)} ${pad(cosineSimilarity(a, c).toFixed(4), 10, true)} ${pad(dotProduct(a, c).toFixed(4), 10, true)}`);
  console.log(`  ${pad("B vs C", 10)} ${pad(cosineSimilarity(b, c).toFixed(4), 10, true)} ${pad(dotProduct(b, c).toFixed(4), 10, true)}\n`);
  console.log("  Cosine says A and B are identical (same direction).");
  console.log("  Dot product says B is more similar because of larger magnitude.\n");

  const an = normalizeVector(a);
  const bn = normalizeVector(b);
  const cn = normalizeVector(c);
  console.log("  After L2 normalization:");
  console.log(`  ${pad("A vs B", 10)} ${pad(cosineSimilarity(an, bn).toFixed(4), 10, true)} ${pad(dotProduct(an, bn).toFixed(4), 10, true)}`);
  console.log(`  ${pad("A vs C", 10)} ${pad(cosineSimilarity(an, cn).toFixed(4), 10, true)} ${pad(dotProduct(an, cn).toFixed(4), 10, true)}\n`);
  console.log("  After normalization, cosine and dot product are identical.\n");
}

function demoMahalanobis(): void {
  console.log(line());
  console.log("MAHALANOBIS DISTANCE");
  console.log(line());

  const rng = makeRng(42);
  const n = 200;
  const data: number[][] = [];
  for (let i = 0; i < n; i++) {
    const x = rng.gauss(0, 3);
    const y = 0.8 * x + rng.gauss(0, 1);
    data.push([x, y]);
  }

  const cov = computeCovariance(data);
  const mean = [data.reduce((acc, d) => acc + d[0]!, 0) / n, data.reduce((acc, d) => acc + d[1]!, 0) / n];

  const along = [mean[0]! + 3, mean[1]! + 0.8 * 3];
  const perp = [mean[0]! + 1, mean[1]! - 3];

  console.log(`  Data: ${n} points with correlated features (r ~ 0.8)`);
  console.log(`  Mean: (${mean[0]!.toFixed(2)}, ${mean[1]!.toFixed(2)})`);
  console.log(`  Covariance: [[${cov[0]![0]!.toFixed(2)}, ${cov[0]![1]!.toFixed(2)}], [${cov[1]![0]!.toFixed(2)}, ${cov[1]![1]!.toFixed(2)}]]\n`);
  console.log(`  Point along correlation axis:  [${along.map(r2)}]`);
  console.log(`    L2 distance from mean:        ${l2Distance(mean, along).toFixed(4)}`);
  console.log(`    Mahalanobis distance:         ${mahalanobisDistance(mean, along, cov).toFixed(4)}\n`);
  console.log(`  Point perpendicular to axis:   [${perp.map(r2)}]`);
  console.log(`    L2 distance from mean:        ${l2Distance(mean, perp).toFixed(4)}`);
  console.log(`    Mahalanobis distance:         ${mahalanobisDistance(mean, perp, cov).toFixed(4)}\n`);
  console.log("  L2 says both points are similar distances from the mean.");
  console.log("  Mahalanobis correctly identifies the perpendicular point as");
  console.log("  more unusual given the correlation structure of the data.\n");
}

function demoJaccard(): void {
  console.log(line());
  console.log("JACCARD SIMILARITY (SETS)");
  console.log(line());

  const pairs: [Set<string>, Set<string>][] = [
    [new Set(["cat", "dog", "fish"]), new Set(["cat", "bird", "fish", "snake"])],
    [new Set(["python", "java", "rust"]), new Set(["python", "java", "rust"])],
    [new Set(["a", "b", "c"]), new Set(["d", "e", "f"])],
    [new Set(["ml", "ai", "data"]), new Set(["ml", "ai", "data", "ops", "cloud"])],
  ];

  for (const [a, b] of pairs) {
    const j = jaccardSimilarity(a, b);
    console.log(`  A = [${[...a].sort()}]`);
    console.log(`  B = [${[...b].sort()}]`);
    console.log(`  Jaccard similarity: ${j.toFixed(4)}`);
    console.log(`  Jaccard distance:   ${(1 - j).toFixed(4)}\n`);
  }
}

function demoEditDistance(): void {
  console.log(line());
  console.log("EDIT DISTANCE (LEVENSHTEIN)");
  console.log(line());

  const pairs: [string, string][] = [
    ["kitten", "sitting"],
    ["sunday", "saturday"],
    ["hello", "hello"],
    ["", "abc"],
    ["algorithm", "altruistic"],
    ["python", "pytorch"],
  ];

  for (const [s1, s2] of pairs) {
    console.log(`  '${s1}' -> '${s2}':  distance = ${editDistance(s1, s2)}`);
  }
  console.log();
}

function demoKlDivergence(): void {
  console.log(line());
  console.log("KL DIVERGENCE (NOT SYMMETRIC)");
  console.log(line());

  const p = [0.9, 0.1];
  const q = [0.5, 0.5];
  const klPq = klDivergence(p, q);
  const klQp = klDivergence(q, p);

  console.log(`  P = [${p}]`);
  console.log(`  Q = [${q}]`);
  console.log(`  KL(P || Q) = ${klPq.toFixed(4)} nats`);
  console.log(`  KL(Q || P) = ${klQp.toFixed(4)} nats`);
  console.log(`  Difference: ${Math.abs(klPq - klQp).toFixed(4)}`);
  console.log("  KL divergence is NOT a distance metric.\n");

  const p2 = [0.25, 0.25, 0.25, 0.25];
  const q2 = [0.1, 0.1, 0.1, 0.7];
  console.log(`  P = [${p2}]`);
  console.log(`  Q = [${q2}]`);
  console.log(`  KL(P || Q) = ${klDivergence(p2, q2).toFixed(4)} nats`);
  console.log(`  KL(Q || P) = ${klDivergence(q2, p2).toFixed(4)} nats\n`);
}

function demoWasserstein(): void {
  console.log(line());
  console.log("WASSERSTEIN DISTANCE (EARTH MOVER'S DISTANCE)");
  console.log(line());

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
    const klStr = Number.isFinite(kl) ? kl.toFixed(4) : "inf";
    console.log(`  ${name}`);
    console.log(`    P = [${p}]`);
    console.log(`    Q = [${q}]`);
    console.log(`    Wasserstein: ${w.toFixed(4)}    KL: ${klStr}\n`);
  }
  console.log("  Wasserstein provides finite, meaningful distances even when");
  console.log("  distributions do not overlap (where KL goes to infinity).\n");
}

function demoNormOrdering(): void {
  console.log(line());
  console.log("NORM ORDERING: L-inf <= L2 <= L1 (always)");
  console.log(line());

  const rng = makeRng(55);
  for (let trial = 0; trial < 5; trial++) {
    const dim = rng.randint(2, 10);
    const a = Array.from({ length: dim }, () => rng.gauss(0, 5));
    const b = Array.from({ length: dim }, () => rng.gauss(0, 5));
    const d1 = l1Distance(a, b);
    const d2 = l2Distance(a, b);
    const dinf = linfDistance(a, b);
    const holds = dinf <= d2 && d2 <= d1;
    console.log(
      `  dim=${pad(String(dim), 2, true)}  L1=${pad(d1.toFixed(3), 8, true)}  L2=${pad(d2.toFixed(3), 8, true)}  L-inf=${pad(dinf.toFixed(3), 8, true)}  ordering holds: ${holds}`
    );
  }
  console.log("\n  For any p1 < p2: ||x||_p2 <= ||x||_p1");
  console.log("  Higher p values focus on fewer (larger) components.\n");
}

function demoKnnClassification(): void {
  console.log(line());
  console.log("KNN CLASSIFICATION: DISTANCE METRIC CHANGES THE PREDICTION");
  console.log(line());

  const training: [number[], string][] = [
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
  console.log(`  Query: [${query}]`);
  console.log(`  Training set: ${training.length} points, 3 classes\n`);

  const k = 3;
  const metrics: [string, (a: number[], b: number[]) => number][] = [
    ["L1", l1Distance],
    ["L2", l2Distance],
    ["Cosine", cosineDistance],
    ["L-inf", linfDistance],
  ];

  for (const [name, fn] of metrics) {
    const dists = training
      .map(([point, label]) => ({ d: fn(query, point), label, point }))
      .sort((x, y) => x.d - y.d)
      .slice(0, k);

    const votes = new Map<string, number>();
    for (const nb of dists) votes.set(nb.label, (votes.get(nb.label) ?? 0) + 1);
    const prediction = [...votes.entries()].reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];

    console.log(`  Metric: ${name}`);
    for (const nb of dists) console.log(`    Neighbor: [${nb.point}]  class=${nb.label}  dist=${nb.d.toFixed(4)}`);
    console.log(`    Prediction (k=${k}): ${prediction}\n`);
  }
}

function demoDifferentNeighbors(): void {
  console.log(line());
  console.log("SAME DATA, DIFFERENT METRICS, DIFFERENT NEAREST NEIGHBORS");
  console.log(line());

  const rng = makeRng(123);
  const nPoints = 8;
  const dim = 5;
  const dataset: number[][] = [];
  for (let i = 0; i < nPoints; i++) {
    if (i < 3) {
      dataset.push(Array.from({ length: dim }, () => rng.gauss(0, 1)));
    } else if (i < 6) {
      const base = Array.from({ length: dim }, () => rng.gauss(0, 0.5));
      base[0]! *= 5;
      dataset.push(base);
    } else {
      dataset.push(Array.from({ length: dim }, () => rng.gauss(3, 0.3)));
    }
  }

  const query = [1.0, 0.5, -0.5, 1.0, 0.2];
  console.log(`  Query: [${query.map(r2)}]\n`);
  console.log(`  ${pad("Point", 8)} ${pad("L1", 8, true)} ${pad("L2", 8, true)} ${pad("Cosine", 8, true)} ${pad("L-inf", 8, true)}`);

  const results: Record<string, [number, number][]> = { L1: [], L2: [], Cosine: [], "L-inf": [] };
  dataset.forEach((point, i) => {
    const dL1 = l1Distance(query, point);
    const dL2 = l2Distance(query, point);
    const dCos = cosineDistance(query, point);
    const dInf = linfDistance(query, point);
    results.L1!.push([i, dL1]);
    results.L2!.push([i, dL2]);
    results.Cosine!.push([i, dCos]);
    results["L-inf"]!.push([i, dInf]);
    console.log(`  ${pad(`P${i}`, 8)} ${pad(dL1.toFixed(3), 8, true)} ${pad(dL2.toFixed(3), 8, true)} ${pad(dCos.toFixed(4), 8, true)} ${pad(dInf.toFixed(3), 8, true)}`);
  });

  console.log("\n  Nearest neighbor by metric:");
  const best: Record<string, number> = {};
  for (const [name, dists] of Object.entries(results)) {
    const winner = dists.reduce((b, c) => (c[1] < b[1] ? c : b));
    best[name] = winner[0];
    console.log(`    ${pad(name, 8)}: Point ${winner[0]} (distance = ${winner[1].toFixed(4)})`);
  }

  const allSame = Object.values(best).every((v) => v === best.L1);
  if (!allSame) {
    console.log("\n  The metrics DISAGREE on which point is nearest.");
    console.log("  Your distance function defines your notion of similarity.");
  }
  console.log();
}

function demoEmbeddingSearch(): void {
  console.log(line());
  console.log("EMBEDDING SIMILARITY SEARCH");
  console.log(line());

  const rng = makeRng(77);
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

  const embeddings: number[][] = documents.map((_, i) => {
    const base = Array.from({ length: dim }, () => rng.gauss(0, 1));
    if (i < 5) {
      for (let j = 0; j < 10; j++) base[j]! += 2.0;
    } else {
      for (let j = 10; j < 20; j++) base[j]! += 2.0;
    }
    if (i === 0 || i === 1) {
      for (let j = 20; j < 25; j++) base[j]! += 1.5;
    }
    return base;
  });

  const noise = Array.from({ length: dim }, () => rng.gauss(0, 0.3));
  const query = embeddings[0]!.map((q, i) => q + noise[i]!);

  console.log(`  Query: '${documents[0]}' (with noise)`);
  console.log(`  Embedding dimension: ${dim}\n`);

  const cosineRanked = documents.map((_, i) => [i, cosineSimilarity(query, embeddings[i]!)] as [number, number]).sort((a, b) => b[1] - a[1]);
  const l2Ranked = documents.map((_, i) => [i, l2Distance(query, embeddings[i]!)] as [number, number]).sort((a, b) => a[1] - b[1]);
  const dotRanked = documents.map((_, i) => [i, dotProduct(query, embeddings[i]!)] as [number, number]).sort((a, b) => b[1] - a[1]);

  console.log(`  ${pad("Rank", 6)} ${pad("Cosine", 34)} ${pad("L2", 34)} ${pad("Dot Product", 34)}`);
  for (let rank = 0; rank < documents.length; rank++) {
    const [ci, cs] = cosineRanked[rank]!;
    const [li, ls] = l2Ranked[rank]!;
    const [di, ds] = dotRanked[rank]!;
    const cosStr = `${pad(documents[ci]!.slice(0, 25), 25)} (${cs.toFixed(3)})`;
    const l2Str = `${pad(documents[li]!.slice(0, 25), 25)} (${ls.toFixed(1)})`;
    const dotStr = `${pad(documents[di]!.slice(0, 25), 25)} (${ds.toFixed(1)})`;
    console.log(`  ${pad(String(rank + 1), 6)} ${pad(cosStr, 34)} ${pad(l2Str, 34)} ${pad(dotStr, 34)}`);
  }
  console.log("\n  Cosine similarity focuses on direction (topic similarity).");
  console.log("  L2 distance is sensitive to magnitude differences.");
  console.log("  Dot product blends direction and magnitude.\n");
}

function demoRegularization(): void {
  console.log(line());
  console.log("L1 vs L2 REGULARIZATION EFFECT ON WEIGHTS");
  console.log(line());

  const rng = makeRng(42);
  const nFeatures = 10;
  const weights = Array.from({ length: nFeatures }, () => rng.gauss(0, 2));

  console.log(`  Original weights: [${weights.map((w) => r2(w))}]`);
  console.log(`  L1 norm: ${l1Norm(weights).toFixed(4)}`);
  console.log(`  L2 norm: ${l2Norm(weights).toFixed(4)}\n`);

  const lr = 0.1;

  const wL1 = [...weights];
  for (let step = 0; step < 50; step++) {
    for (let i = 0; i < nFeatures; i++) {
      const grad = lr * (wL1[i]! > 0 ? 1 : wL1[i]! < 0 ? -1 : 0);
      wL1[i]! -= grad;
      if (Math.abs(wL1[i]!) < lr) wL1[i] = 0;
    }
  }

  const wL2 = [...weights];
  for (let step = 0; step < 50; step++) {
    for (let i = 0; i < nFeatures; i++) {
      wL2[i]! -= lr * 2 * wL2[i]!;
    }
  }

  console.log("  After L1 regularization (50 steps):");
  console.log(`    Weights: [${wL1.map((w) => r2(w))}]`);
  console.log(`    Zeros:   ${wL1.filter((w) => w === 0).length}/${nFeatures}`);
  console.log(`    L1 norm: ${l1Norm(wL1).toFixed(4)}\n`);
  console.log("  After L2 regularization (50 steps):");
  console.log(`    Weights: [${wL2.map((w) => r2(w))}]`);
  console.log(`    Zeros:   ${wL2.filter((w) => Math.abs(w) < 1e-10).length}/${nFeatures}`);
  console.log(`    L2 norm: ${l2Norm(wL2).toFixed(4)}\n`);
  console.log("  L1 drives 'small' weights to exactly zero (sparsity).");
  console.log("  L2 shrinks all weights but none reach exactly zero.\n");
}

function main(): void {
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
}

main();
