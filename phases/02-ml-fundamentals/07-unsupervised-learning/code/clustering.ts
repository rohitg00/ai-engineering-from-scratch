// Lesson: Unsupervised Learning (phase 02 / lesson 07)
// TypeScript port of code/clustering.py. Node standard library only.
// Source: phases/02-ml-fundamentals/07-unsupervised-learning/docs/en.md
// Run: npx tsx phases/02-ml-fundamentals/07-unsupervised-learning/code/clustering.ts

type Point = number[];

class Random {
  private state: number;
  private spare: number | null = null;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  gauss(mu: number, sigma: number): number {
    if (this.spare !== null) {
      const value = this.spare;
      this.spare = null;
      return mu + sigma * value;
    }
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spare = r * Math.sin(2 * Math.PI * v);
    return mu + sigma * r * Math.cos(2 * Math.PI * v);
  }

  randint(n: number): number {
    return Math.floor(this.next() * n);
  }

  choice<T>(items: T[]): T {
    if (items.length === 0) throw new Error("cannot choose from an empty sequence");
    return items[this.randint(items.length)];
  }

  sample<T>(items: T[], k: number): T[] {
    if (k < 0 || k > items.length) throw new Error("sample larger than population or is negative");
    const pool = items.slice();
    const out: T[] = [];
    for (let i = 0; i < k; i++) {
      const j = i + this.randint(pool.length - i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
      out.push(pool[i]);
    }
    return out;
  }
}

let rng = new Random(42);

function seed(value: number): void {
  rng = new Random(value);
}

function pyNum(x: number): string {
  if (Number.isInteger(x)) return x.toFixed(1);
  return String(x);
}

function round(x: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

function pyList(values: number[]): string {
  return `[${values.map(pyNum).join(", ")}]`;
}

function pyNested(values: number[][]): string {
  return `[${values.map(pyList).join(", ")}]`;
}

function euclideanDistance(a: Point, b: Point): number {
  const n = Math.min(a.length, b.length);
  let total = 0;
  for (let i = 0; i < n; i++) total += (a[i] - b[i]) ** 2;
  return Math.sqrt(total);
}

function argmin(values: number[]): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] < values[best]) best = i;
  return best;
}

function argmax(values: number[]): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) if (values[i] > values[best]) best = i;
  return best;
}

function kmeans(data: Point[], k: number, maxIterations = 100, seedValue = 42): [number[], Point[]] {
  if (data.length === 0) throw new Error("kmeans needs at least one point");
  seed(seedValue);
  const nFeatures = data[0].length;
  let centroids: Point[] = rng.sample(data, k);
  let assignments: number[] = [];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const clusters: Point[][] = Array.from({ length: k }, () => []);
    assignments = [];

    for (const point of data) {
      const distances = centroids.map((c) => euclideanDistance(point, c));
      const nearest = argmin(distances);
      clusters[nearest].push(point);
      assignments.push(nearest);
    }

    const newCentroids: Point[] = [];
    for (const cluster of clusters) {
      if (cluster.length === 0) {
        newCentroids.push(rng.choice(data));
        continue;
      }
      const centroid: Point = [];
      for (let j = 0; j < nFeatures; j++) {
        let s = 0;
        for (const point of cluster) s += point[j];
        centroid.push(s / cluster.length);
      }
      newCentroids.push(centroid);
    }

    if (centroids.every((old, i) => euclideanDistance(old, newCentroids[i]) < 1e-6)) {
      console.log(`  Converged at iteration ${iteration + 1}`);
      break;
    }

    centroids = newCentroids;
  }

  return [assignments, centroids];
}

function computeInertia(data: Point[], assignments: number[], centroids: Point[]): number {
  let total = 0;
  for (let i = 0; i < Math.min(data.length, assignments.length); i++) {
    total += euclideanDistance(data[i], centroids[assignments[i]]) ** 2;
  }
  return total;
}

function silhouetteScore(data: Point[], assignments: number[]): number {
  const n = data.length;
  if (n < 2) return 0;
  if (assignments.length !== n) throw new Error("data and assignments must have the same length");

  const clusters = new Map<number, number[]>();
  assignments.forEach((c, i) => {
    if (!clusters.has(c)) clusters.set(c, []);
    clusters.get(c)!.push(i);
  });

  if (clusters.size < 2) return 0;

  const scores: number[] = [];
  for (let i = 0; i < n; i++) {
    const own = assignments[i];
    const ownMembers = clusters.get(own)!.filter((j) => j !== i);

    if (ownMembers.length === 0) {
      scores.push(0);
      continue;
    }

    let a = 0;
    for (const j of ownMembers) a += euclideanDistance(data[i], data[j]);
    a /= ownMembers.length;

    let b = Infinity;
    for (const [clusterId, members] of clusters) {
      if (clusterId === own) continue;
      let d = 0;
      for (const j of members) d += euclideanDistance(data[i], data[j]);
      b = Math.min(b, d / members.length);
    }

    const m = Math.max(a, b);
    scores.push(m === 0 ? 0 : (b - a) / m);
  }

  return scores.reduce((s, v) => s + v, 0) / scores.length;
}

function findBestK(data: Point[], maxK = 10): number[] {
  console.log("Elbow method:");
  const inertias: number[] = [];
  for (let k = 1; k <= maxK; k++) {
    const [assignments, centroids] = kmeans(data, k);
    const inertia = computeInertia(data, assignments, centroids);
    inertias.push(inertia);
    console.log(`  K=${k}: inertia=${inertia.toFixed(2)}`);
  }

  console.log("\nSilhouette scores:");
  for (let k = 2; k <= maxK; k++) {
    const [assignments] = kmeans(data, k);
    const score = silhouetteScore(data, assignments);
    console.log(`  K=${k}: silhouette=${score.toFixed(4)}`);
  }

  return inertias;
}

function dbscan(data: Point[], eps: number, minSamples: number): number[] {
  const n = data.length;
  const labels = new Array<number>(n).fill(-1);
  let clusterId = 0;

  const regionQuery = (idx: number): number[] => {
    const neighbors: number[] = [];
    for (let i = 0; i < n; i++) {
      if (euclideanDistance(data[idx], data[i]) <= eps) neighbors.push(i);
    }
    return neighbors;
  };

  const visited = new Array<boolean>(n).fill(false);

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    visited[i] = true;

    const neighbors = regionQuery(i);
    if (neighbors.length < minSamples) {
      labels[i] = -1;
      continue;
    }

    labels[i] = clusterId;
    const seedSet = neighbors.filter((x) => x !== i);
    const inSeed = new Set(seedSet);

    let j = 0;
    while (j < seedSet.length) {
      const q = seedSet[j];
      if (!visited[q]) {
        visited[q] = true;
        const qNeighbors = regionQuery(q);
        if (qNeighbors.length >= minSamples) {
          for (const nb of qNeighbors) {
            if (!inSeed.has(nb)) {
              seedSet.push(nb);
              inSeed.add(nb);
            }
          }
        }
      }
      if (labels[q] === -1) labels[q] = clusterId;
      j++;
    }

    clusterId++;
  }

  return labels;
}

function gmm(
  data: Point[],
  k: number,
  maxIterations = 100,
  seedValue = 42,
): [number[], Point[], number[], number[][]] {
  if (data.length === 0) throw new Error("gmm needs at least one point");
  seed(seedValue);
  const n = data.length;
  const d = data[0].length;

  const indices = rng.sample(Array.from({ length: n }, (_, i) => i), k);
  const means: Point[] = indices.map((i) => data[i].slice());
  const variances = new Array<number>(k).fill(1);
  const weights = new Array<number>(k).fill(1 / k);

  const gaussianPdf = (x: Point, mean: Point, variance: number): number => {
    const dim = x.length;
    const coeff = 1 / (2 * Math.PI * variance) ** (dim / 2);
    let sq = 0;
    for (let i = 0; i < dim; i++) sq += (x[i] - mean[i]) ** 2;
    const exponent = -sq / (2 * variance);
    return coeff * Math.exp(Math.max(exponent, -500));
  };

  let responsibilities: number[][] = [];
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    responsibilities = [];
    for (let i = 0; i < n; i++) {
      const probs: number[] = [];
      for (let j = 0; j < k; j++) probs.push(weights[j] * gaussianPdf(data[i], means[j], variances[j]));
      let total = probs.reduce((s, v) => s + v, 0);
      if (total === 0) total = 1e-300;
      responsibilities.push(probs.map((p) => p / total));
    }

    const oldMeans = means.map((m) => m.slice());

    for (let j = 0; j < k; j++) {
      let rSum = 0;
      for (let i = 0; i < n; i++) rSum += responsibilities[i][j];
      if (rSum < 1e-10) continue;

      weights[j] = rSum / n;

      for (let dim = 0; dim < d; dim++) {
        let s = 0;
        for (let i = 0; i < n; i++) s += responsibilities[i][j] * data[i][dim];
        means[j][dim] = s / rSum;
      }

      let v = 0;
      for (let i = 0; i < n; i++) {
        let sq = 0;
        for (let dim = 0; dim < d; dim++) sq += (data[i][dim] - means[j][dim]) ** 2;
        v += responsibilities[i][j] * sq;
      }
      variances[j] = Math.max(v / (rSum * d), 1e-6);
    }

    let shift = 0;
    for (let j = 0; j < k; j++) shift += euclideanDistance(oldMeans[j], means[j]);
    if (shift < 1e-6) {
      console.log(`  GMM converged at iteration ${iteration + 1}`);
      break;
    }
  }

  const assignments = responsibilities.map((r) => argmax(r));
  return [assignments, means, weights, responsibilities];
}

type Linkage = "single" | "complete" | "average" | "ward";
type Merge = [number, number, number, number];

function agglomerativeClustering(data: Point[], nClusters = 3, linkage: Linkage = "ward"): [number[], Merge[]] {
  const n = data.length;
  if (nClusters < 1 || nClusters > n) throw new Error("n_clusters must be between 1 and the number of points");
  const clusterMap = new Map<number, number[]>();
  for (let i = 0; i < n; i++) clusterMap.set(i, [i]);
  const active: number[] = Array.from({ length: n }, (_, i) => i);
  const history: Merge[] = [];
  const dims = data[0].length;

  const centroidOf = (idx: number[]): Point => {
    const c: Point = [];
    for (let d = 0; d < dims; d++) {
      let s = 0;
      for (const i of idx) s += data[i][d];
      c.push(s / idx.length);
    }
    return c;
  };

  const clusterDistance = (c1: number[], c2: number[]): number => {
    if (linkage === "single" || linkage === "complete" || linkage === "average") {
      let best = linkage === "single" ? Infinity : -Infinity;
      let total = 0;
      for (const i of c1) {
        for (const j of c2) {
          const dist = euclideanDistance(data[i], data[j]);
          if (linkage === "single") best = Math.min(best, dist);
          else if (linkage === "complete") best = Math.max(best, dist);
          else total += dist;
        }
      }
      return linkage === "average" ? total / (c1.length * c2.length) : best;
    }
    const merged = c1.concat(c2);
    const cm = centroidOf(merged);
    const ca = centroidOf(c1);
    const cb = centroidOf(c2);
    let vm = 0;
    for (const i of merged) vm += euclideanDistance(data[i], cm) ** 2;
    let va = 0;
    for (const i of c1) va += euclideanDistance(data[i], ca) ** 2;
    let vb = 0;
    for (const i of c2) vb += euclideanDistance(data[i], cb) ** 2;
    return vm - va - vb;
  };

  let nextId = n;
  while (active.length > nClusters) {
    let bestDist = Infinity;
    let bestPair: [number, number] | null = null;

    for (let a = 0; a < active.length; a++) {
      for (let b = a + 1; b < active.length; b++) {
        const ca = active[a];
        const cb = active[b];
        const dist = clusterDistance(clusterMap.get(ca)!, clusterMap.get(cb)!);
        if (dist < bestDist) {
          bestDist = dist;
          bestPair = [ca, cb];
        }
      }
    }

    const [ca, cb] = bestPair!;
    const merged = clusterMap.get(ca)!.concat(clusterMap.get(cb)!);
    clusterMap.set(nextId, merged);
    history.push([ca, cb, bestDist, merged.length]);
    active.splice(active.indexOf(ca), 1);
    active.splice(active.indexOf(cb), 1);
    active.push(nextId);
    nextId++;
  }

  const labels = new Array<number>(n).fill(0);
  active.forEach((clusterId, label) => {
    for (const idx of clusterMap.get(clusterId)!) labels[idx] = label;
  });

  return [labels, history];
}

function makeBlobs(centers: number[][], nPerCluster = 50, spread = 0.5, seedValue = 42): [Point[], number[]] {
  seed(seedValue);
  const data: Point[] = [];
  const labels: number[] = [];
  centers.forEach(([cx, cy], label) => {
    for (let i = 0; i < nPerCluster; i++) {
      const x = cx + rng.gauss(0, spread);
      const y = cy + rng.gauss(0, spread);
      data.push([x, y]);
      labels.push(label);
    }
  });
  return [data, labels];
}

function makeMoons(nSamples = 200, noise = 0.1, seedValue = 42): [Point[], number[]] {
  seed(seedValue);
  const data: Point[] = [];
  const labels: number[] = [];
  const nHalf = Math.floor(nSamples / 2);
  for (let i = 0; i < nHalf; i++) {
    const angle = (Math.PI * i) / nHalf;
    data.push([Math.cos(angle) + rng.gauss(0, noise), Math.sin(angle) + rng.gauss(0, noise)]);
    labels.push(0);
  }
  for (let i = 0; i < nHalf; i++) {
    const angle = (Math.PI * i) / nHalf;
    data.push([1 - Math.cos(angle) + rng.gauss(0, noise), 1 - Math.sin(angle) - 0.5 + rng.gauss(0, noise)]);
    labels.push(1);
  }
  return [data, labels];
}

function countClusters(labels: number[]): number {
  return new Set(labels.filter((l) => l !== -1)).size;
}

function main(): void {
  const centers = [
    [2, 2],
    [8, 3],
    [5, 8],
  ];
  const [data] = makeBlobs(centers, 50, 0.8);

  console.log("=== K-Means on 3 blobs ===");
  const [assignments, centroids] = kmeans(data, 3);
  console.log(`  Centroids: ${pyNested(centroids.map((c) => c.map((v) => round(v, 2))))}`);
  console.log(`  Silhouette score: ${silhouetteScore(data, assignments).toFixed(4)}`);

  console.log("\n=== Elbow Method ===");
  findBestK(data, 6);

  console.log("\n=== DBSCAN on 3 blobs ===");
  const dbLabels = dbscan(data, 1.5, 5);
  console.log(`  Found ${countClusters(dbLabels)} clusters, ${dbLabels.filter((l) => l === -1).length} noise points`);

  console.log("\n=== GMM on 3 blobs ===");
  const [gmmAssignments, gmmMeans, gmmWeights] = gmm(data, 3);
  console.log(`  Means: ${pyNested(gmmMeans.map((m) => m.map((v) => round(v, 2))))}`);
  console.log(`  Weights: ${pyList(gmmWeights.map((w) => round(w, 3)))}`);
  console.log(`  Silhouette score: ${silhouetteScore(data, gmmAssignments).toFixed(4)}`);

  console.log("\n=== Hierarchical Clustering on 3 blobs (Ward linkage) ===");
  const smallData = data.slice(0, 30);
  const [hcLabels, merges] = agglomerativeClustering(smallData, 3);
  console.log(`  Silhouette score: ${silhouetteScore(smallData, hcLabels).toFixed(4)}`);
  const last = merges.slice(-3).map(([a, b, d]) => `(${a}, ${b}, ${pyNum(round(d, 2))})`);
  console.log(`  Last 3 merges: [${last.join(", ")}]`);

  console.log("\n=== DBSCAN on moons (non-spherical clusters) ===");
  const [moonData] = makeMoons(200, 0.1);
  const moonDb = dbscan(moonData, 0.3, 5);
  console.log(`  Found ${countClusters(moonDb)} clusters, ${moonDb.filter((l) => l === -1).length} noise points`);

  console.log("\n=== K-Means on moons (will fail to separate) ===");
  const [moonKm] = kmeans(moonData, 2);
  console.log(`  Silhouette score: ${silhouetteScore(moonData, moonKm).toFixed(4)}`);
  console.log("  K-Means splits moons poorly because they are not spherical");

  console.log("\n=== Anomaly detection with DBSCAN ===");
  const anomalyData = data.slice();
  anomalyData.push([20, 20]);
  anomalyData.push([-5, -5]);
  anomalyData.push([15, 0]);
  const anomalyLabels = dbscan(anomalyData, 1.5, 5);
  const anomalies = anomalyData.filter((_, i) => anomalyLabels[i] === -1);
  console.log(`  Detected ${anomalies.length} anomalies`);
  for (const a of anomalies.slice(-3)) console.log(`    Point ${pyList(a.map((v) => round(v, 2)))}`);
}

main();
