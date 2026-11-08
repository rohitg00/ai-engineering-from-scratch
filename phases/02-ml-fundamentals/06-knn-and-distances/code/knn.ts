// Lesson: K-Nearest Neighbors and Distance Metrics (phase 02 / lesson 06)
// TypeScript port of code/knn.py. Node standard library only.
// Source: phases/02-ml-fundamentals/06-knn-and-distances/docs/en.md
// Run: npx tsx phases/02-ml-fundamentals/06-knn-and-distances/code/knn.ts

type Vector = number[];
type DistanceFn = (a: Vector, b: Vector) => number;
type Task = "classification" | "regression";

class Random {
  private state = 0;
  private spare: number | null = null;

  constructor(seed: number) {
    this.seed(seed);
  }

  seed(seed: number): void {
    this.state = seed >>> 0;
    this.spare = null;
  }

  random(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  uniform(a: number, b: number): number {
    return a + (b - a) * this.random();
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

  randint(a: number, b: number): number {
    return a + Math.floor(this.random() * (b - a + 1));
  }

  choice<T>(items: T[]): T {
    if (items.length === 0) throw new Error("cannot choose from an empty sequence");
    return items[Math.floor(this.random() * items.length)];
  }

  shuffle<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }
}

const random = new Random(42);

function fx(x: number, digits: number): string {
  if (Number.isNaN(x)) return "nan";
  if (x === Infinity) return "inf";
  if (x === -Infinity) return "-inf";
  if (Object.is(x, -0)) return "-" + (0).toFixed(digits);
  return x.toFixed(digits);
}

function signed(x: number, digits: number): string {
  const s = fx(x, digits);
  return s.startsWith("-") ? s : "+" + s;
}

function pyFloat(x: number): string {
  if (Number.isNaN(x)) return "nan";
  if (!Number.isFinite(x)) return x > 0 ? "inf" : "-inf";
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

function pyRound(x: number, digits: number): number {
  return Number(x.toFixed(digits));
}

function sameLength(a: Vector, b: Vector): void {
  if (a.length !== b.length) throw new Error(`vectors have different lengths: ${a.length} and ${b.length}`);
}

function l2Distance(a: Vector, b: Vector): number {
  sameLength(a, b);
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

function l1Distance(a: Vector, b: Vector): number {
  sameLength(a, b);
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s;
}

function cosineDistance(a: Vector, b: Vector): number {
  sameLength(a, b);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] ** 2;
    nb += b[i] ** 2;
  }
  const normA = Math.sqrt(na);
  const normB = Math.sqrt(nb);
  if (normA === 0 || normB === 0) return 1.0;
  return 1.0 - dot / (normA * normB);
}

function minkowskiDistance(a: Vector, b: Vector, p = 2): number {
  sameLength(a, b);
  if (!(p > 0)) throw new Error("p must be positive");
  if (p === Infinity) {
    if (a.length === 0) throw new Error("max() of an empty sequence");
    return Math.max(...a.map((ai, i) => Math.abs(ai - b[i])));
  }
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]) ** p;
  return s ** (1 / p);
}

function standardize(X: Vector[]): [Vector[], number[], number[]] {
  const n = X.length;
  if (n === 0) throw new Error("standardize needs at least one row");
  const d = X[0].length;
  for (const row of X) if (row.length !== d) throw new Error("every row must have the same length");
  const means: number[] = [];
  const stds: number[] = [];
  for (let j = 0; j < d; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += X[i][j];
    means.push(s / n);
  }
  for (let j = 0; j < d; j++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += (X[i][j] - means[j]) ** 2;
    stds.push(Math.max(1e-10, (s / n) ** 0.5));
  }
  return [applyStandardize(X, means, stds), means, stds];
}

function applyStandardize(X: Vector[], means: number[], stds: number[]): Vector[] {
  return X.map((x) => {
    if (x.length !== means.length) throw new Error(`expected ${means.length} features, got ${x.length}`);
    return x.map((v, j) => (v - means[j]) / stds[j]);
  });
}

interface KnnOptions {
  k?: number;
  distanceFn?: DistanceFn;
  weighted?: boolean;
  task?: Task;
}

class KNN {
  k: number;
  distanceFn: DistanceFn;
  weighted: boolean;
  task: Task;
  XTrain: Vector[] | null = null;
  yTrain: number[] | null = null;

  constructor(opts: KnnOptions = {}) {
    this.k = opts.k ?? 5;
    this.distanceFn = opts.distanceFn ?? l2Distance;
    this.weighted = opts.weighted ?? false;
    this.task = opts.task ?? "classification";
    if (!Number.isInteger(this.k) || this.k < 1) throw new Error("k must be a positive integer");
  }

  fit(X: Vector[], y: number[]): void {
    if (X.length !== y.length) throw new Error(`X has ${X.length} rows but y has ${y.length} values`);
    this.XTrain = [...X];
    this.yTrain = [...y];
  }

  predict(X: Vector[]): number[] {
    return X.map((x) => this.predictOne(x));
  }

  private sortedNeighbors(x: Vector): [number, number, number][] {
    const XTrain = this.XTrain;
    const yTrain = this.yTrain;
    if (XTrain === null || yTrain === null) throw new Error("call fit before predict");
    if (XTrain.length === 0) throw new Error("the training set is empty");
    const distances: [number, number, number][] = XTrain.map((xi, i) => [this.distanceFn(x, xi), i, yTrain[i]]);
    distances.sort((p, q) => p[0] - q[0]);
    return distances.slice(0, this.k);
  }

  private predictOne(x: Vector): number {
    const neighbors = this.sortedNeighbors(x).map(([d, , v]): [number, number] => [d, v]);
    return this.task === "classification" ? this.classify(neighbors) : this.regress(neighbors);
  }

  private classify(neighbors: [number, number][]): number {
    const votes = new Map<number, number>();
    for (const [dist, label] of neighbors) {
      const w = this.weighted ? 1.0 / (dist + 1e-10) : 1;
      votes.set(label, (votes.get(label) ?? 0) + w);
    }
    let best = neighbors[0][1];
    let bestVotes = -Infinity;
    for (const [label, v] of votes) {
      if (v > bestVotes) {
        best = label;
        bestVotes = v;
      }
    }
    return best;
  }

  private regress(neighbors: [number, number][]): number {
    if (this.weighted) {
      let wSum = 0.0;
      let valSum = 0.0;
      for (const [dist, val] of neighbors) {
        const w = 1.0 / (dist + 1e-10);
        valSum += w * val;
        wSum += w;
      }
      return wSum > 0 ? valSum / wSum : 0.0;
    }
    return neighbors.reduce((a, [, v]) => a + v, 0) / neighbors.length;
  }

  predictWithNeighbors(x: Vector): [number, [number, number, number][]] {
    return [this.predictOne(x), this.sortedNeighbors(x)];
  }
}

class KDNode {
  constructor(
    public point: Vector,
    public index: number,
    public axis: number,
    public left: KDNode | null = null,
    public right: KDNode | null = null,
  ) {}
}

class KDTree {
  dim: number;
  root: KDNode | null;

  constructor(X: Vector[]) {
    if (X.length === 0) throw new Error("KDTree needs at least one point");
    this.dim = X[0].length;
    if (this.dim === 0) throw new Error("KDTree points need at least one dimension");
    for (const p of X) if (p.length !== this.dim) throw new Error("every point must have the same dimension");
    this.root = this.build(X.map((p, i): [Vector, number] => [p, i]), 0);
  }

  private build(points: [Vector, number][], depth: number): KDNode | null {
    if (points.length === 0) return null;
    const axis = depth % this.dim;
    points.sort((p, q) => p[0][axis] - q[0][axis]);
    const mid = Math.floor(points.length / 2);
    return new KDNode(
      points[mid][0],
      points[mid][1],
      axis,
      this.build(points.slice(0, mid), depth + 1),
      this.build(points.slice(mid + 1), depth + 1),
    );
  }

  query(point: Vector, k = 1): [number, number, Vector][] {
    if (point.length !== this.dim) throw new Error(`expected a ${this.dim}-dimensional point, got ${point.length}`);
    if (!Number.isInteger(k) || k < 1) throw new Error("k must be a positive integer");
    const best: [number, number, Vector][] = [];
    this.search(this.root, point, k, best);
    best.sort((p, q) => p[0] - q[0]);
    return best;
  }

  private search(node: KDNode | null, point: Vector, k: number, best: [number, number, Vector][]): void {
    if (node === null) return;
    const dist = l2Distance(point, node.point);
    if (best.length < k) {
      best.push([dist, node.index, node.point]);
      best.sort((p, q) => p[0] - q[0]);
    } else if (dist < best[best.length - 1][0]) {
      best[best.length - 1] = [dist, node.index, node.point];
      best.sort((p, q) => p[0] - q[0]);
    }
    const diff = point[node.axis] - node.point[node.axis];
    const [first, second] = diff <= 0 ? [node.left, node.right] : [node.right, node.left];
    this.search(first, point, k, best);
    if (best.length < k || Math.abs(diff) < best[best.length - 1][0]) this.search(second, point, k, best);
  }
}

function accuracy(yTrue: number[], yPred: number[]): number {
  if (yTrue.length === 0) throw new Error("accuracy needs at least one label");
  if (yTrue.length !== yPred.length) throw new Error("yTrue and yPred must have the same length");
  let correct = 0;
  for (let i = 0; i < yTrue.length; i++) if (yTrue[i] === yPred[i]) correct++;
  return correct / yTrue.length;
}

function mse(yTrue: number[], yPred: number[]): number {
  if (yTrue.length === 0) throw new Error("mse needs at least one value");
  if (yTrue.length !== yPred.length) throw new Error("yTrue and yPred must have the same length");
  let s = 0;
  for (let i = 0; i < yTrue.length; i++) s += (yTrue[i] - yPred[i]) ** 2;
  return s / yTrue.length;
}

function generateClassificationData(nSamples = 200, nClasses = 3, seed = 42): [Vector[], number[]] {
  random.seed(seed);
  const centers = [
    [1.0, 1.0],
    [-1.0, -1.0],
    [1.0, -1.0],
  ];
  if (nClasses < 1 || nClasses > centers.length) throw new Error(`n_classes must be between 1 and ${centers.length}`);
  const X: Vector[] = [];
  const y: number[] = [];
  for (let i = 0; i < nSamples; i++) {
    const c = random.randint(0, nClasses - 1);
    X.push([centers[c][0] + random.gauss(0, 0.5), centers[c][1] + random.gauss(0, 0.5)]);
    y.push(c);
  }
  return [X, y];
}

function generateRegressionData(nSamples = 200, seed = 42): [Vector[], number[]] {
  random.seed(seed);
  const X: Vector[] = [];
  const y: number[] = [];
  for (let i = 0; i < nSamples; i++) {
    const x = random.uniform(-3, 3);
    X.push([x]);
    y.push(Math.sin(x) + random.gauss(0, 0.15));
  }
  return [X, y];
}

function generateHighDimData(nSamples = 500, nDims = 2, seed = 42): [Vector[], number[]] {
  if (nDims < 2) throw new Error("n_dims must be at least 2");
  random.seed(seed);
  const X: Vector[] = [];
  const y: number[] = [];
  for (let i = 0; i < nSamples; i++) {
    const point = Array.from({ length: nDims }, () => random.uniform(0, 1));
    X.push(point);
    y.push(point[0] + point[1] > 1.0 ? 1 : 0);
  }
  return [X, y];
}

function trainTestSplit(X: Vector[], y: number[], testRatio = 0.2, seed = 42): [Vector[], number[], Vector[], number[]] {
  if (X.length !== y.length) throw new Error("X and y must have the same length");
  random.seed(seed);
  const indices = Array.from({ length: X.length }, (_, i) => i);
  random.shuffle(indices);
  const split = Math.trunc(X.length * (1 - testRatio));
  const trainIdx = indices.slice(0, split);
  const testIdx = indices.slice(split);
  return [trainIdx.map((i) => X[i]), trainIdx.map((i) => y[i]), testIdx.map((i) => X[i]), testIdx.map((i) => y[i])];
}

function header(title: string): void {
  console.log("=".repeat(65));
  console.log(title);
  console.log("=".repeat(65));
  console.log();
}

function seconds(): number {
  return performance.now() / 1000;
}

function demoBasicKnn(): void {
  header("KNN CLASSIFICATION: THE BASICS");
  const [X, y] = generateClassificationData(200, 3, 42);
  const [Xtr, ytr, Xte, yte] = trainTestSplit(X, y);
  console.log(`  Dataset: ${X.length} samples, 2 features, 3 classes`);
  console.log(`  Train: ${Xtr.length}  Test: ${Xte.length}`);
  console.log();
  console.log(`  ${"K".padStart(6)}  ${"Train Acc".padStart(10)}  ${"Test Acc".padStart(10)}`);
  console.log(`  ${"-".repeat(6)}  ${"-".repeat(10)}  ${"-".repeat(10)}`);
  for (const k of [1, 3, 5, 7, 11, 15, 25, 50]) {
    const knn = new KNN({ k, task: "classification" });
    knn.fit(Xtr, ytr);
    const trainAcc = accuracy(ytr, knn.predict(Xtr));
    const testAcc = accuracy(yte, knn.predict(Xte));
    console.log(`  ${String(k).padStart(6)}  ${fx(trainAcc, 4).padStart(10)}  ${fx(testAcc, 4).padStart(10)}`);
  }
  console.log();
  console.log("  K=1: perfect training accuracy (memorization), lower test accuracy.");
  console.log("  Increasing K smooths the decision boundary.");
  console.log();
}

function demoDistanceMetrics(): void {
  header("DISTANCE METRICS: SAME DATA, DIFFERENT NEIGHBORS");
  const [X, y] = generateClassificationData(200, 3, 42);
  const [Xs] = standardize(X);
  const [Xtr, ytr, Xte, yte] = trainTestSplit(Xs, y);
  const metrics: [string, DistanceFn][] = [
    ["L2 (Euclidean)", l2Distance],
    ["L1 (Manhattan)", l1Distance],
    ["Cosine", cosineDistance],
  ];
  const k = 5;
  console.log(`  K = ${k}, features standardized`);
  console.log();
  console.log(`  ${"Metric".padEnd(20)}  ${"Test Accuracy".padStart(14)}`);
  console.log(`  ${"-".repeat(20)}  ${"-".repeat(14)}`);
  for (const [name, fn] of metrics) {
    const knn = new KNN({ k, distanceFn: fn, task: "classification" });
    knn.fit(Xtr, ytr);
    console.log(`  ${name.padEnd(20)}  ${fx(accuracy(yte, knn.predict(Xte)), 4).padStart(14)}`);
  }
  console.log();
  const query = Xte[0];
  console.log(`  Query point: [${fx(query[0], 3)}, ${fx(query[1], 3)}]`);
  console.log(`  True label: ${yte[0]}`);
  console.log();
  for (const [name, fn] of metrics) {
    const knn = new KNN({ k, distanceFn: fn, task: "classification" });
    knn.fit(Xtr, ytr);
    const [pred, neighbors] = knn.predictWithNeighbors(query);
    console.log(`  ${name}: prediction = ${pred}`);
    for (const [dist, idx, label] of neighbors) {
      console.log(`    neighbor idx=${idx}, label=${label}, dist=${fx(dist, 4)}`);
    }
    console.log();
  }
}

function demoWeightedKnn(): void {
  header("WEIGHTED vs UNWEIGHTED KNN");
  const [X, y] = generateClassificationData(200, 3, 42);
  const [Xs] = standardize(X);
  const [Xtr, ytr, Xte, yte] = trainTestSplit(Xs, y);
  console.log(`  ${"K".padStart(6)}  ${"Unweighted".padStart(12)}  ${"Weighted".padStart(12)}  ${"Diff".padStart(8)}`);
  console.log(`  ${"-".repeat(6)}  ${"-".repeat(12)}  ${"-".repeat(12)}  ${"-".repeat(8)}`);
  for (const k of [3, 7, 15, 25]) {
    const uw = new KNN({ k, weighted: false, task: "classification" });
    const w = new KNN({ k, weighted: true, task: "classification" });
    uw.fit(Xtr, ytr);
    w.fit(Xtr, ytr);
    const accUw = accuracy(yte, uw.predict(Xte));
    const accW = accuracy(yte, w.predict(Xte));
    console.log(
      `  ${String(k).padStart(6)}  ${fx(accUw, 4).padStart(12)}  ${fx(accW, 4).padStart(12)}  ${signed(accW - accUw, 4).padStart(8)}`,
    );
  }
  console.log();
  console.log("  Weighted KNN is less sensitive to large K values.");
  console.log("  Distant neighbors contribute less, so increasing K is safer.");
  console.log();
}

function demoRegression(): void {
  header("KNN REGRESSION: APPROXIMATING sin(x)");
  const [X, y] = generateRegressionData(200, 42);
  const [Xtr, ytr, Xte, yte] = trainTestSplit(X, y);
  console.log("  Target: y = sin(x) + noise");
  console.log(`  Train: ${Xtr.length}  Test: ${Xte.length}`);
  console.log();
  console.log(`  ${"K".padStart(6)}  ${"Unweighted MSE".padStart(16)}  ${"Weighted MSE".padStart(14)}`);
  console.log(`  ${"-".repeat(6)}  ${"-".repeat(16)}  ${"-".repeat(14)}`);
  for (const k of [1, 3, 5, 10, 20, 50]) {
    const uw = new KNN({ k, task: "regression", weighted: false });
    const w = new KNN({ k, task: "regression", weighted: true });
    uw.fit(Xtr, ytr);
    w.fit(Xtr, ytr);
    const mseUw = mse(yte, uw.predict(Xte));
    const mseW = mse(yte, w.predict(Xte));
    console.log(`  ${String(k).padStart(6)}  ${fx(mseUw, 6).padStart(16)}  ${fx(mseW, 6).padStart(14)}`);
  }
  console.log();
  console.log("  K=1 overfits (follows noise). Large K underfits (over-smooths).");
  console.log("  Weighted KNN smooths predictions while respecting local structure.");
  console.log();
  const knn = new KNN({ k: 5, task: "regression", weighted: true });
  knn.fit(Xtr, ytr);
  console.log("  Sample predictions (K=5, weighted):");
  console.log(`  ${"x".padStart(8)}  ${"True y".padStart(8)}  ${"Pred y".padStart(8)}  ${"Error".padStart(8)}`);
  console.log(`  ${"-".repeat(8)}  ${"-".repeat(8)}  ${"-".repeat(8)}  ${"-".repeat(8)}`);
  for (let i = 0; i < Math.min(10, Xte.length); i++) {
    const pred = knn.predict([Xte[i]])[0];
    const err = Math.abs(yte[i] - pred);
    console.log(`  ${fx(Xte[i][0], 3).padStart(8)}  ${fx(yte[i], 3).padStart(8)}  ${fx(pred, 3).padStart(8)}  ${fx(err, 3).padStart(8)}`);
  }
  console.log();
}

function demoCurseOfDimensionality(): void {
  header("CURSE OF DIMENSIONALITY");
  const nPoints = 200;
  console.log("  Part 1: Distance ratio convergence");
  console.log(`  ${nPoints} random uniform points in [0, 1]^d`);
  console.log();
  console.log(`  ${"Dimensions".padStart(12)}  ${"Max/Min dist".padStart(14)}  ${"Mean dist".padStart(10)}  ${"Std dist".padStart(10)}`);
  console.log(`  ${"-".repeat(12)}  ${"-".repeat(14)}  ${"-".repeat(10)}  ${"-".repeat(10)}`);
  for (const d of [2, 5, 10, 20, 50, 100]) {
    random.seed(42);
    const points = Array.from({ length: nPoints }, () => Array.from({ length: d }, () => random.uniform(0, 1)));
    const distances: number[] = [];
    const sampleSize = Math.min(500, Math.floor((nPoints * (nPoints - 1)) / 2));
    for (let s = 0; s < sampleSize; s++) {
      const i = random.randint(0, nPoints - 1);
      const j = random.randint(0, nPoints - 1);
      if (i !== j) distances.push(l2Distance(points[i], points[j]));
    }
    const positive = distances.filter((v) => v > 0);
    if (positive.length > 0) {
      const maxD = Math.max(...distances);
      const minD = Math.min(...positive);
      const meanD = distances.reduce((a, b) => a + b, 0) / distances.length;
      const stdD = Math.sqrt(distances.reduce((a, v) => a + (v - meanD) ** 2, 0) / distances.length);
      const ratio = minD > 0 ? maxD / minD : Infinity;
      console.log(`  ${String(d).padStart(12)}  ${fx(ratio, 4).padStart(14)}  ${fx(meanD, 4).padStart(10)}  ${fx(stdD, 4).padStart(10)}`);
    }
  }
  console.log();
  console.log("  As dimensions grow, max/min ratio shrinks toward 1.");
  console.log("  All points become equally distant. 'Nearest' loses meaning.");
  console.log();
  console.log("  Part 2: KNN accuracy vs dimensionality");
  console.log("  Binary classification: label = 1 if x[0] + x[1] > 1, else 0");
  console.log("  Extra dimensions are pure noise.");
  console.log();
  console.log(`  ${"Dimensions".padStart(12)}  ${"K=5 Acc".padStart(10)}  ${"K=15 Acc".padStart(10)}`);
  console.log(`  ${"-".repeat(12)}  ${"-".repeat(10)}  ${"-".repeat(10)}`);
  for (const d of [2, 5, 10, 20, 50]) {
    const [X, y] = generateHighDimData(400, d, 42);
    const [Xs] = standardize(X);
    const [Xtr, ytr, Xte, yte] = trainTestSplit(Xs, y);
    const knn5 = new KNN({ k: 5, task: "classification" });
    const knn15 = new KNN({ k: 15, task: "classification" });
    knn5.fit(Xtr, ytr);
    knn15.fit(Xtr, ytr);
    const acc5 = accuracy(yte, knn5.predict(Xte));
    const acc15 = accuracy(yte, knn15.predict(Xte));
    console.log(`  ${String(d).padStart(12)}  ${fx(acc5, 4).padStart(10)}  ${fx(acc15, 4).padStart(10)}`);
  }
  console.log();
  console.log("  Accuracy degrades as noisy dimensions increase.");
  console.log("  The signal (first 2 dims) gets drowned by noise dimensions.");
  console.log();
}

function pyPairs(pairs: [number, number][]): string {
  return "[" + pairs.map(([d, i]) => `(${pyFloat(d)}, ${i})`).join(", ") + "]";
}

function pyFloatList(values: number[]): string {
  return "[" + values.map(pyFloat).join(", ") + "]";
}

function bruteTopK(query: Vector, X: Vector[], k: number): [number, number][] {
  const dists = X.map((x, i): [number, number] => [l2Distance(query, x), i]);
  dists.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  return dists.slice(0, k);
}

function demoKdtree(): void {
  header("KD-TREE: EFFICIENT NEAREST NEIGHBOR SEARCH");
  random.seed(42);
  console.log("  2D data, finding 5 nearest neighbors");
  console.log();
  console.log(`  ${"N points".padStart(10)}  ${"Brute force".padStart(14)}  ${"KD-tree".padStart(14)}  ${"Speedup".padStart(10)}`);
  console.log(`  ${"-".repeat(10)}  ${"-".repeat(14)}  ${"-".repeat(14)}  ${"-".repeat(10)}`);
  for (const n of [100, 500, 1000, 5000]) {
    const X = Array.from({ length: n }, () => [random.uniform(0, 10), random.uniform(0, 10)]);
    const k = 5;
    const queries = Array.from({ length: 100 }, () => [random.uniform(0, 10), random.uniform(0, 10)]);

    let start = seconds();
    for (const q of queries) bruteTopK(q, X, k);
    const bruteTime = seconds() - start;

    const tree = new KDTree(X);
    start = seconds();
    for (const q of queries) tree.query(q, k);
    const kdTime = seconds() - start;

    const speedup = kdTime > 0 ? bruteTime / kdTime : Infinity;
    console.log(`  ${String(n).padStart(10)}  ${fx(bruteTime, 4).padStart(14)}s  ${fx(kdTime, 4).padStart(14)}s  ${fx(speedup, 1).padStart(10)}x`);
  }
  console.log();

  const X = Array.from({ length: 100 }, () => [random.uniform(0, 10), random.uniform(0, 10)]);
  const tree = new KDTree(X);
  const query = [5.0, 5.0];
  const bruteTop5 = bruteTopK(query, X, 5);
  const kdTop5 = tree.query(query, 5).map(([d, idx]): [number, number] => [d, idx]);
  console.log("  Verification (100 points, k=5):");
  console.log(`    Brute force: ${pyPairs(bruteTop5.map(([d, i]) => [pyRound(d, 4), i]))}`);
  console.log(`    KD-tree:     ${pyPairs(kdTop5.map(([d, i]) => [pyRound(d, 4), i]))}`);
  const a = new Set(bruteTop5.map(([, i]) => i));
  const b = new Set(kdTop5.map(([, i]) => i));
  const match = a.size === b.size && [...a].every((i) => b.has(i));
  console.log(`    Results match: ${match ? "True" : "False"}`);
  console.log();
}

function demoScalingImportance(): void {
  header("FEATURE SCALING: WHY IT MATTERS FOR KNN");
  random.seed(42);
  const X: Vector[] = [];
  const y: number[] = [];
  for (let i = 0; i < 200; i++) {
    const age = random.gauss(40, 15);
    const salary = random.gauss(50000, 20000);
    X.push([age, salary]);
    y.push(age > 45 && salary < 40000 ? 1 : 0);
  }
  const [Xtr, ytr, Xte, yte] = trainTestSplit(X, y);

  const knnRaw = new KNN({ k: 5, task: "classification" });
  knnRaw.fit(Xtr, ytr);
  const accRaw = accuracy(yte, knnRaw.predict(Xte));

  const [XtrS, means, stds] = standardize(Xtr);
  const XteS = applyStandardize(Xte, means, stds);
  const knnScaled = new KNN({ k: 5, task: "classification" });
  knnScaled.fit(XtrS, ytr);
  const accScaled = accuracy(yte, knnScaled.predict(XteS));

  console.log("  Features: age (range ~10-70), salary (range ~10k-90k)");
  console.log();
  console.log(`  Without scaling: accuracy = ${fx(accRaw, 4)}`);
  console.log(`  With scaling:    accuracy = ${fx(accScaled, 4)}`);
  console.log();

  const firstFive = (q: Vector, rows: Vector[]): number[] =>
    rows
      .slice(0, 5)
      .map((r, i): [number, number] => [l2Distance(q, r), i])
      .sort((p, q2) => p[0] - q2[0] || p[1] - q2[1])
      .map(([d]) => d);
  const distsRaw = firstFive(Xte[0], Xtr);
  const distsScaled = firstFive(XteS[0], XtrS);
  console.log("  Sample distances for first test point:");
  console.log(`  Without scaling: ${pyFloatList(distsRaw.map((d) => pyRound(d, 1)))}`);
  console.log(`  With scaling:    ${pyFloatList(distsScaled.map((d) => pyRound(d, 4)))}`);
  console.log();
  console.log("  Unscaled: salary dominates (tens of thousands vs tens of years).");
  console.log("  Scaled: both features contribute equally to distance.");
  console.log();
}

function demoLazyVsEager(): void {
  header("LAZY vs EAGER LEARNING: TIMING COMPARISON");
  random.seed(42);
  console.log(`  ${"N".padStart(6)}  ${"KNN train".padStart(12)}  ${"KNN predict".padStart(14)}  ${"Total".padStart(10)}`);
  console.log(`  ${"-".repeat(6)}  ${"-".repeat(12)}  ${"-".repeat(14)}  ${"-".repeat(10)}`);
  for (const n of [100, 500, 1000, 5000]) {
    const X = Array.from({ length: n }, () => Array.from({ length: 5 }, () => random.gauss(0, 1)));
    const y = Array.from({ length: n }, () => random.choice([0, 1]));
    const nTest = Math.min(50, Math.floor(n / 5));
    const XtestLocal = Array.from({ length: nTest }, () => Array.from({ length: 5 }, () => random.gauss(0, 1)));
    const knn = new KNN({ k: 5, task: "classification" });

    let start = seconds();
    knn.fit(X, y);
    const trainTime = seconds() - start;

    start = seconds();
    knn.predict(XtestLocal);
    const predTime = seconds() - start;

    const total = trainTime + predTime;
    console.log(`  ${String(n).padStart(6)}  ${fx(trainTime, 6).padStart(12)}s  ${fx(predTime, 6).padStart(14)}s  ${fx(total, 6).padStart(10)}s`);
  }
  console.log();
  console.log("  KNN training is O(1): just store the data.");
  console.log("  KNN prediction is O(n*d) per query: compute all distances.");
  console.log("  For eager learners (neural nets), the pattern is reversed.");
  console.log();
}

function demoMinkowskiFamily(): void {
  header("MINKOWSKI DISTANCE FAMILY");
  const a = [1.0, 2.0, 3.0];
  const b = [4.0, 0.0, 6.0];
  console.log(`  a = ${pyFloatList(a)}`);
  console.log(`  b = ${pyFloatList(b)}`);
  console.log();
  console.log(`  ${"p".padStart(8)}  ${"Distance".padStart(12)}  ${"Name".padStart(15)}`);
  console.log(`  ${"-".repeat(8)}  ${"-".repeat(12)}  ${"-".repeat(15)}`);
  for (const p of [1, 1.5, 2, 3, 5, 10, Infinity]) {
    const d = minkowskiDistance(a, b, p);
    let name: string;
    if (p === 1) name = "Manhattan (L1)";
    else if (p === 2) name = "Euclidean (L2)";
    else if (p === Infinity) name = "Chebyshev (Linf)";
    else name = `Lp (p=${p})`;
    const pStr = p === Infinity ? "inf" : String(p);
    console.log(`  ${pStr.padStart(8)}  ${fx(d, 4).padStart(12)}  ${name.padStart(15)}`);
  }
  console.log();
  console.log("  As p increases, the distance is dominated by the largest component difference.");
  console.log("  L-inf <= L2 <= L1 always holds.");
  console.log();
}

function demoKSelection(): void {
  header("SELECTING K: CROSS-VALIDATION APPROACH");
  const [X, y] = generateClassificationData(300, 3, 42);
  const n = X.length;
  random.seed(42);
  const indices = Array.from({ length: n }, (_, i) => i);
  random.shuffle(indices);
  const nFolds = 5;
  const foldSize = Math.floor(n / nFolds);
  console.log(`  ${nFolds}-fold cross-validation on ${n} samples`);
  console.log();
  console.log(`  ${"K".padStart(6)}  ${"Mean Acc".padStart(10)}  ${"Std Acc".padStart(10)}  ${"Visual".padStart(20)}`);
  console.log(`  ${"-".repeat(6)}  ${"-".repeat(10)}  ${"-".repeat(10)}  ${"-".repeat(20)}`);
  let bestK = 1;
  let bestMean = 0.0;
  for (const k of [1, 3, 5, 7, 9, 11, 15, 21, 31]) {
    const foldAccs: number[] = [];
    for (let fold = 0; fold < nFolds; fold++) {
      const valStart = fold * foldSize;
      const valEnd = valStart + foldSize;
      const valIdx = indices.slice(valStart, valEnd);
      const trainIdx = [...indices.slice(0, valStart), ...indices.slice(valEnd)];
      const knn = new KNN({ k, task: "classification" });
      knn.fit(trainIdx.map((i) => X[i]), trainIdx.map((i) => y[i]));
      foldAccs.push(accuracy(valIdx.map((i) => y[i]), knn.predict(valIdx.map((i) => X[i]))));
    }
    const meanAcc = foldAccs.reduce((s, v) => s + v, 0) / foldAccs.length;
    const stdAcc = Math.sqrt(foldAccs.reduce((s, v) => s + (v - meanAcc) ** 2, 0) / foldAccs.length);
    const bar = "#".repeat(Math.trunc(meanAcc * 20));
    if (meanAcc > bestMean) {
      bestMean = meanAcc;
      bestK = k;
    }
    console.log(`  ${String(k).padStart(6)}  ${fx(meanAcc, 4).padStart(10)}  ${fx(stdAcc, 4).padStart(10)}  ${bar}`);
  }
  console.log();
  console.log(`  Best K = ${bestK} with mean accuracy = ${fx(bestMean, 4)}`);
  console.log();
}

function printSummary(): void {
  console.log();
  header("SUMMARY");
  console.log("  1. KNN is lazy: zero training, all work at prediction time.");
  console.log("  2. K controls bias-variance: small K overfits, large K underfits.");
  console.log("  3. Distance metric choice matters. L2 is default, cosine for text.");
  console.log("  4. Always scale features. Unscaled features distort distances.");
  console.log("  5. Weighted KNN reduces sensitivity to K by down-weighting distant neighbors.");
  console.log("  6. Curse of dimensionality: KNN degrades beyond ~20-50 dimensions.");
  console.log("  7. KD-trees speed up search in low dimensions. Ball trees for moderate.");
  console.log("  8. KNN is the same algorithm behind vector databases and RAG retrieval.");
  console.log();
}

demoBasicKnn();
demoDistanceMetrics();
demoWeightedKnn();
demoRegression();
demoMinkowskiFamily();
demoCurseOfDimensionality();
demoScalingImportance();
demoKdtree();
demoLazyVsEager();
demoKSelection();
printSummary();
