// Lesson: Decision Trees and Random Forests (phase 02 / lesson 04)
// TypeScript port of code/trees.py. Node standard library only.
// Source: phases/02-ml-fundamentals/04-decision-trees/docs/en.md
// Run: npx tsx phases/02-ml-fundamentals/04-decision-trees/code/trees.ts

type Label = number | string;
type Task = "classification" | "regression";
type Criterion = "gini" | "entropy";
type MaxFeatures = number | "sqrt" | null;

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

  shuffle<T>(items: T[]): void {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }

  sample(n: number, k: number): number[] {
    if (k < 0 || k > n) throw new RangeError("sample larger than population or is negative");
    const pool = Array.from({ length: n }, (_, i) => i);
    const out: number[] = [];
    for (let i = 0; i < k; i++) {
      const j = i + Math.floor(this.random() * (n - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
      out.push(pool[i]);
    }
    return out;
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

function pyFloat(x: number): string {
  if (Number.isNaN(x)) return "nan";
  if (!Number.isFinite(x)) return x > 0 ? "inf" : "-inf";
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

function pyStrList(items: string[]): string {
  return "[" + items.map((s) => `'${s}'`).join(", ") + "]";
}

function countLabels<T>(labels: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return counts;
}

function giniImpurity<T>(labels: T[]): number {
  const n = labels.length;
  if (n === 0) return 0.0;
  let s = 0;
  for (const c of countLabels(labels).values()) s += (c / n) ** 2;
  return 1.0 - s;
}

function entropy<T>(labels: T[]): number {
  const n = labels.length;
  if (n === 0) return 0.0;
  let s = 0;
  for (const c of countLabels(labels).values()) {
    if (c > 0) s += (c / n) * Math.log2(c / n);
  }
  return -s;
}

function informationGain<T>(parent: T[], left: T[], right: T[], criterion: Criterion = "gini"): number {
  const measure = criterion === "gini" ? giniImpurity : entropy;
  const n = parent.length;
  if (left.length === 0 || right.length === 0) return 0.0;
  const parentImpurity = measure(parent);
  const childImpurity = (left.length / n) * measure(left) + (right.length / n) * measure(right);
  return parentImpurity - childImpurity;
}

function variance(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0.0;
  const m = values.reduce((a, b) => a + b, 0) / n;
  return values.reduce((a, v) => a + (v - m) ** 2, 0) / n;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0.0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function varianceReduction(parent: number[], left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0) return 0.0;
  const n = parent.length;
  const childVar = (left.length / n) * variance(left) + (right.length / n) * variance(right);
  return variance(parent) - childVar;
}

function majorityVote<T>(labels: T[]): T {
  if (labels.length === 0) throw new Error("majorityVote needs at least one label");
  let best: T = labels[0];
  let bestCount = -1;
  for (const [label, c] of countLabels(labels)) {
    if (c > bestCount) {
      best = label;
      bestCount = c;
    }
  }
  return best;
}

type Leaf = { leaf: true; value: Label };
type Split = { leaf: false; feature: number; threshold: number; left: TreeNode; right: TreeNode };
type TreeNode = Leaf | Split;

interface TreeOptions {
  maxDepth?: number | null;
  minSamplesSplit?: number;
  minSamplesLeaf?: number;
  criterion?: Criterion;
  maxFeatures?: MaxFeatures;
  task?: Task;
}

function checkXY(X: number[][], y: Label[]): void {
  if (X.length === 0) throw new Error("fit needs at least one sample");
  if (X.length !== y.length) throw new Error(`X has ${X.length} rows but y has ${y.length} values`);
  const d = X[0].length;
  if (d === 0) throw new Error("fit needs at least one feature");
  for (const row of X) {
    if (row.length !== d) throw new Error("every row of X must have the same number of features");
  }
}

class DecisionTree {
  maxDepth: number | null;
  minSamplesSplit: number;
  minSamplesLeaf: number;
  criterion: Criterion;
  maxFeatures: MaxFeatures;
  task: Task;
  tree: TreeNode | null = null;
  featureImportances: number[] = [];
  nFeatures = 0;
  nSamples = 0;

  constructor(opts: TreeOptions = {}) {
    this.maxDepth = opts.maxDepth ?? null;
    this.minSamplesSplit = opts.minSamplesSplit ?? 2;
    this.minSamplesLeaf = opts.minSamplesLeaf ?? 1;
    this.criterion = opts.criterion ?? "gini";
    this.maxFeatures = opts.maxFeatures ?? null;
    this.task = opts.task ?? "classification";
  }

  fit(X: number[][], y: Label[]): void {
    checkXY(X, y);
    if (this.task === "regression" && y.some((v) => typeof v !== "number")) {
      throw new Error("regression targets must be numbers");
    }
    this.nFeatures = X[0].length;
    this.featureImportances = new Array<number>(this.nFeatures).fill(0);
    this.nSamples = X.length;
    this.tree = this.build(X, y, 0);
    const total = this.featureImportances.reduce((a, b) => a + b, 0);
    if (total > 0) this.featureImportances = this.featureImportances.map((fi) => fi / total);
  }

  predict(X: number[][]): Label[] {
    const root = this.tree;
    if (root === null) throw new Error("call fit before predict");
    return X.map((x) => {
      if (x.length !== this.nFeatures) throw new Error(`expected ${this.nFeatures} features, got ${x.length}`);
      return this.predictOne(x, root);
    });
  }

  private build(X: number[][], y: Label[], depth: number): TreeNode {
    if (new Set(y).size === 1) {
      return { leaf: true, value: this.task === "classification" ? y[0] : mean(y as number[]) };
    }
    if (this.maxDepth !== null && depth >= this.maxDepth) return this.makeLeaf(y);
    if (y.length < this.minSamplesSplit) return this.makeLeaf(y);

    const [bestFeature, bestThreshold, bestGain] = this.bestSplit(X, y);
    if (bestFeature === null || bestGain <= 0) return this.makeLeaf(y);

    const [leftX, leftY, rightX, rightY] = this.splitData(X, y, bestFeature, bestThreshold);
    if (leftY.length < this.minSamplesLeaf || rightY.length < this.minSamplesLeaf) return this.makeLeaf(y);

    this.featureImportances[bestFeature] += (y.length / this.nSamples) * bestGain;

    const left = this.build(leftX, leftY, depth + 1);
    const right = this.build(rightX, rightY, depth + 1);
    return { leaf: false, feature: bestFeature, threshold: bestThreshold, left, right };
  }

  private makeLeaf(y: Label[]): Leaf {
    if (this.task === "classification") return { leaf: true, value: majorityVote(y) };
    return { leaf: true, value: mean(y as number[]) };
  }

  private featureIndices(): number[] {
    const all = Array.from({ length: this.nFeatures }, (_, i) => i);
    if (this.maxFeatures === null) return all;
    if (this.maxFeatures === "sqrt") {
      const k = Math.max(1, Math.trunc(Math.sqrt(this.nFeatures)));
      return random.sample(this.nFeatures, k);
    }
    if (!Number.isInteger(this.maxFeatures) || this.maxFeatures < 1) {
      throw new Error("max_features must be at least 1 when given as an integer");
    }
    return random.sample(this.nFeatures, Math.min(this.maxFeatures, this.nFeatures));
  }

  private bestSplit(X: number[][], y: Label[]): [number | null, number, number] {
    let bestFeature: number | null = null;
    let bestThreshold = 0;
    let bestGain = -1.0;

    for (const f of this.featureIndices()) {
      const values = [...new Set(X.map((row) => row[f]))].sort((a, b) => a - b);
      if (values.length <= 1) continue;

      for (let i = 0; i < values.length - 1; i++) {
        const threshold = (values[i] + values[i + 1]) / 2.0;
        const leftY: Label[] = [];
        const rightY: Label[] = [];
        for (let j = 0; j < X.length; j++) {
          if (X[j][f] <= threshold) leftY.push(y[j]);
          else rightY.push(y[j]);
        }
        if (leftY.length < this.minSamplesLeaf || rightY.length < this.minSamplesLeaf) continue;

        const gain =
          this.task === "classification"
            ? informationGain(y, leftY, rightY, this.criterion)
            : varianceReduction(y as number[], leftY as number[], rightY as number[]);

        if (gain > bestGain) {
          bestGain = gain;
          bestFeature = f;
          bestThreshold = threshold;
        }
      }
    }
    return [bestFeature, bestThreshold, bestGain];
  }

  private splitData(X: number[][], y: Label[], feature: number, threshold: number): [number[][], Label[], number[][], Label[]] {
    const leftX: number[][] = [];
    const leftY: Label[] = [];
    const rightX: number[][] = [];
    const rightY: Label[] = [];
    for (let i = 0; i < X.length; i++) {
      if (X[i][feature] <= threshold) {
        leftX.push(X[i]);
        leftY.push(y[i]);
      } else {
        rightX.push(X[i]);
        rightY.push(y[i]);
      }
    }
    return [leftX, leftY, rightX, rightY];
  }

  private predictOne(x: number[], node: TreeNode): Label {
    let current = node;
    while (!current.leaf) current = x[current.feature] <= current.threshold ? current.left : current.right;
    return current.value;
  }

  printTree(node: TreeNode | null = this.tree, indent = ""): void {
    if (node === null) throw new Error("call fit before printTree");
    if (node.leaf) {
      const v = typeof node.value === "number" && this.task === "regression" ? pyFloat(node.value) : String(node.value);
      console.log(`${indent}Predict: ${v}`);
      return;
    }
    console.log(`${indent}Feature ${node.feature} <= ${fx(node.threshold, 4)}?`);
    console.log(`${indent}  Yes:`);
    this.printTree(node.left, indent + "    ");
    console.log(`${indent}  No:`);
    this.printTree(node.right, indent + "    ");
  }
}

interface ForestOptions {
  nTrees?: number;
  maxDepth?: number | null;
  minSamplesSplit?: number;
  maxFeatures?: MaxFeatures;
  criterion?: Criterion;
  task?: Task;
}

class RandomForest {
  nTrees: number;
  maxDepth: number | null;
  minSamplesSplit: number;
  maxFeatures: MaxFeatures;
  criterion: Criterion;
  task: Task;
  trees: DecisionTree[] = [];

  constructor(opts: ForestOptions = {}) {
    this.nTrees = opts.nTrees ?? 100;
    this.maxDepth = opts.maxDepth ?? null;
    this.minSamplesSplit = opts.minSamplesSplit ?? 2;
    this.maxFeatures = opts.maxFeatures === undefined ? "sqrt" : opts.maxFeatures;
    this.criterion = opts.criterion ?? "gini";
    this.task = opts.task ?? "classification";
    if (!Number.isInteger(this.nTrees) || this.nTrees < 1) throw new Error("n_trees must be a positive integer");
  }

  fit(X: number[][], y: Label[]): void {
    checkXY(X, y);
    this.trees = [];
    const n = X.length;
    for (let t = 0; t < this.nTrees; t++) {
      const indices = Array.from({ length: n }, () => random.randint(0, n - 1));
      const tree = new DecisionTree({
        maxDepth: this.maxDepth,
        minSamplesSplit: this.minSamplesSplit,
        maxFeatures: this.maxFeatures,
        criterion: this.criterion,
        task: this.task,
      });
      tree.fit(indices.map((i) => X[i]), indices.map((i) => y[i]));
      this.trees.push(tree);
    }
  }

  predict(X: number[][]): Label[] {
    if (this.trees.length === 0) throw new Error("call fit before predict");
    const allPreds = this.trees.map((tree) => tree.predict(X));
    return X.map((_, i) => {
      if (this.task === "classification") return majorityVote(allPreds.map((p) => p[i]));
      return allPreds.reduce((a, p) => a + (p[i] as number), 0) / allPreds.length;
    });
  }

  featureImportances(): number[] {
    if (this.trees.length === 0) throw new Error("call fit before featureImportances");
    const nFeatures = this.trees[0].nFeatures;
    let importances = new Array<number>(nFeatures).fill(0);
    for (const tree of this.trees) {
      for (let j = 0; j < nFeatures; j++) importances[j] += tree.featureImportances[j];
    }
    const total = importances.reduce((a, b) => a + b, 0);
    if (total > 0) importances = importances.map((imp) => imp / total);
    return importances;
  }
}

function accuracy(yTrue: Label[], yPred: Label[]): number {
  if (yTrue.length === 0) throw new Error("accuracy needs at least one label");
  if (yTrue.length !== yPred.length) throw new Error("yTrue and yPred must have the same length");
  let correct = 0;
  for (let i = 0; i < yTrue.length; i++) if (yTrue[i] === yPred[i]) correct++;
  return correct / yTrue.length;
}

function meanSquaredError(yTrue: Label[], yPred: Label[]): number {
  if (yTrue.length === 0) throw new Error("mse needs at least one value");
  if (yTrue.length !== yPred.length) throw new Error("yTrue and yPred must have the same length");
  let s = 0;
  for (let i = 0; i < yTrue.length; i++) s += ((yTrue[i] as number) - (yPred[i] as number)) ** 2;
  return s / yTrue.length;
}

function generateClassificationData(nSamples = 200, seed = 42): [number[][], number[]] {
  random.seed(seed);
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < nSamples; i++) {
    const x1 = random.uniform(-3, 3);
    const x2 = random.uniform(-3, 3);
    const noise = random.gauss(0, 0.3);
    let label: number;
    if (x1 ** 2 + x2 ** 2 + noise < 3) label = 0;
    else if (x1 + x2 + noise > 1) label = 1;
    else label = 2;
    X.push([x1, x2]);
    y.push(label);
  }
  return [X, y];
}

function generateRegressionData(nSamples = 200, seed = 42): [number[][], number[]] {
  random.seed(seed);
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < nSamples; i++) {
    const x = random.uniform(-3, 3);
    X.push([x]);
    y.push(Math.sin(x) * x + random.gauss(0, 0.2));
  }
  return [X, y];
}

function trainTestSplit<T>(X: number[][], y: T[], testRatio = 0.2, seed = 42): [number[][], T[], number[][], T[]] {
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

function demoSplitCriteria(): void {
  header("SPLIT CRITERIA: GINI vs ENTROPY");
  const testCases: [string, string[]][] = [
    ["Pure node [A,A,A,A]", ["A", "A", "A", "A"]],
    ["Balanced [A,A,B,B]", ["A", "A", "B", "B"]],
    ["Imbalanced [A,A,A,B]", ["A", "A", "A", "B"]],
    ["Three classes [A,A,B,C]", ["A", "A", "B", "C"]],
    ["Uniform 4-class", ["A", "B", "C", "D"]],
  ];
  console.log(`  ${"Distribution".padEnd(30)} ${"Gini".padStart(8)} ${"Entropy".padStart(8)}`);
  console.log(`  ${"-".repeat(30)} ${"-".repeat(8)} ${"-".repeat(8)}`);
  for (const [name, labels] of testCases) {
    console.log(`  ${name.padEnd(30)} ${fx(giniImpurity(labels), 4).padStart(8)} ${fx(entropy(labels), 4).padStart(8)}`);
  }
  console.log();
  console.log("  Both measures agree: pure = 0, balanced = maximum.");
  console.log("  Entropy grows slightly faster than Gini for multi-class.");
  console.log();
}

function demoInformationGain(): void {
  header("INFORMATION GAIN: CHOOSING THE BEST SPLIT");
  const parent = ["cat", "cat", "cat", "cat", "dog", "dog", "dog", "bird", "bird", "bird"];
  const splits: [string, string[], string[]][] = [
    ["Feature A: [cat,cat,cat,dog] | [cat,dog,dog,bird,bird,bird]", ["cat", "cat", "cat", "dog"], ["cat", "dog", "dog", "bird", "bird", "bird"]],
    ["Feature B: [cat,cat,cat,cat] | [dog,dog,dog,bird,bird,bird]", ["cat", "cat", "cat", "cat"], ["dog", "dog", "dog", "bird", "bird", "bird"]],
    ["Feature C: [cat,cat,dog,bird] | [cat,cat,dog,dog,bird,bird]", ["cat", "cat", "dog", "bird"], ["cat", "cat", "dog", "dog", "bird", "bird"]],
  ];
  console.log(`  Parent: ${pyStrList(parent)}`);
  console.log(`  Parent Gini: ${fx(giniImpurity(parent), 4)}`);
  console.log(`  Parent Entropy: ${fx(entropy(parent), 4)}`);
  console.log();
  console.log(`  ${"Split".padEnd(55)} ${"IG(Gini)".padStart(10)} ${"IG(Entropy)".padStart(12)}`);
  console.log(`  ${"-".repeat(55)} ${"-".repeat(10)} ${"-".repeat(12)}`);
  for (const [name, left, right] of splits) {
    const g = informationGain(parent, left, right, "gini");
    const e = informationGain(parent, left, right, "entropy");
    console.log(`  ${name.padEnd(55)} ${fx(g, 4).padStart(10)} ${fx(e, 4).padStart(12)}`);
  }
  console.log();
  console.log("  Feature B separates cats perfectly. Highest information gain.");
  console.log();
}

function demoDecisionTree(): void {
  header("DECISION TREE: CLASSIFICATION");
  const [X, y] = generateClassificationData(200, 42);
  const [Xtr, ytr, Xte, yte] = trainTestSplit(X, y);
  console.log(`  Dataset: ${X.length} samples, 2 features, 3 classes`);
  console.log(`  Train: ${Xtr.length}  Test: ${Xte.length}`);
  console.log();
  const depths: (number | null)[] = [1, 2, 3, 5, 10, null];
  console.log(`  ${"Max Depth".padStart(10)}  ${"Train Acc".padStart(10)}  ${"Test Acc".padStart(10)}`);
  console.log(`  ${"-".repeat(10)}  ${"-".repeat(10)}  ${"-".repeat(10)}`);
  for (const d of depths) {
    const tree = new DecisionTree({ maxDepth: d, criterion: "gini" });
    tree.fit(Xtr, ytr);
    const trainAcc = accuracy(ytr, tree.predict(Xtr));
    const testAcc = accuracy(yte, tree.predict(Xte));
    const dStr = d === null ? "None" : String(d);
    console.log(`  ${dStr.padStart(10)}  ${fx(trainAcc, 4).padStart(10)}  ${fx(testAcc, 4).padStart(10)}`);
  }
  console.log();
  console.log("  Shallow trees underfit. Deep trees overfit.");
  console.log("  The sweet spot is somewhere in between.");
  console.log();
  const tree = new DecisionTree({ maxDepth: 3, criterion: "gini" });
  tree.fit(Xtr, ytr);
  console.log("  Tree structure (max_depth=3):");
  tree.printTree();
  console.log();
}

function demoRandomForest(): void {
  header("RANDOM FOREST: ENSEMBLE POWER");
  random.seed(42);
  const [X, y] = generateClassificationData(300, 42);
  const [Xtr, ytr, Xte, yte] = trainTestSplit(X, y);
  console.log(`  Dataset: ${X.length} samples, 2 features, 3 classes`);
  console.log(`  Train: ${Xtr.length}  Test: ${Xte.length}`);
  console.log();
  console.log(`  ${"N Trees".padStart(8)}  ${"Train Acc".padStart(10)}  ${"Test Acc".padStart(10)}`);
  console.log(`  ${"-".repeat(8)}  ${"-".repeat(10)}  ${"-".repeat(10)}`);
  for (const n of [1, 3, 5, 10, 25, 50, 100]) {
    const rf = new RandomForest({ nTrees: n, maxDepth: 5, criterion: "gini" });
    rf.fit(Xtr, ytr);
    const trainAcc = accuracy(ytr, rf.predict(Xtr));
    const testAcc = accuracy(yte, rf.predict(Xte));
    console.log(`  ${String(n).padStart(8)}  ${fx(trainAcc, 4).padStart(10)}  ${fx(testAcc, 4).padStart(10)}`);
  }
  console.log();
  console.log("  More trees = better generalization, with diminishing returns.");
  console.log("  Test accuracy plateaus but does not decrease.");
  console.log();
}

function demoFeatureImportance(): void {
  header("FEATURE IMPORTANCE");
  random.seed(42);
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < 200; i++) {
    const important1 = random.uniform(-2, 2);
    const important2 = random.uniform(-2, 2);
    const noise1 = random.gauss(0, 1);
    const noise2 = random.gauss(0, 1);
    X.push([important1, important2, noise1, noise2]);
    y.push(important1 + important2 > 0 ? 1 : 0);
  }
  const featureNames = ["important_1", "important_2", "noise_1", "noise_2"];
  const rf = new RandomForest({ nTrees: 50, maxDepth: 5 });
  rf.fit(X, y);
  const importances = rf.featureImportances();
  console.log("  Target: 1 if feature_0 + feature_1 > 0, else 0");
  console.log("  Features 2 and 3 are pure noise.");
  console.log();
  console.log(`  ${"Feature".padEnd(15)}  ${"Importance".padStart(12)}`);
  console.log(`  ${"-".repeat(15)}  ${"-".repeat(12)}`);
  const ranked = featureNames.map((name, i): [string, number] => [name, importances[i]]).sort((a, b) => b[1] - a[1]);
  for (const [name, imp] of ranked) {
    console.log(`  ${name.padEnd(15)}  ${fx(imp, 4).padStart(12)}  ${"#".repeat(Math.trunc(imp * 40))}`);
  }
  console.log();
  console.log("  The forest correctly identifies which features matter.");
  console.log();
}

function demoRegressionTree(): void {
  header("REGRESSION TREE: PIECEWISE CONSTANT APPROXIMATION");
  const [X, y] = generateRegressionData(200, 42);
  const [Xtr, ytr, Xte, yte] = trainTestSplit(X, y);
  console.log("  Target: y = sin(x) * x + noise");
  console.log(`  Train: ${Xtr.length}  Test: ${Xte.length}`);
  console.log();
  console.log(`  ${"Max Depth".padStart(10)}  ${"Train MSE".padStart(10)}  ${"Test MSE".padStart(10)}`);
  console.log(`  ${"-".repeat(10)}  ${"-".repeat(10)}  ${"-".repeat(10)}`);
  for (const d of [1, 2, 3, 5, 10]) {
    const tree = new DecisionTree({ maxDepth: d, task: "regression" });
    tree.fit(Xtr, ytr);
    const trainMse = meanSquaredError(ytr, tree.predict(Xtr));
    const testMse = meanSquaredError(yte, tree.predict(Xte));
    console.log(`  ${String(d).padStart(10)}  ${fx(trainMse, 4).padStart(10)}  ${fx(testMse, 4).padStart(10)}`);
  }
  console.log();
  const rf = new RandomForest({ nTrees: 50, maxDepth: 5, task: "regression" });
  rf.fit(Xtr, ytr);
  const rfMse = meanSquaredError(yte, rf.predict(Xte));
  console.log(`  Random Forest (50 trees, depth=5) Test MSE: ${fx(rfMse, 4)}`);
  console.log();
  console.log("  The forest averages many piecewise predictions for smoother output.");
  console.log();
}

function demoGiniVsEntropy(): void {
  header("GINI vs ENTROPY: DO THEY DISAGREE?");
  random.seed(42);
  const [X, y] = generateClassificationData(200, 42);
  const [Xtr, ytr, Xte, yte] = trainTestSplit(X, y);
  for (const depth of [3, 5, 10]) {
    const treeGini = new DecisionTree({ maxDepth: depth, criterion: "gini" });
    const treeEntropy = new DecisionTree({ maxDepth: depth, criterion: "entropy" });
    treeGini.fit(Xtr, ytr);
    treeEntropy.fit(Xtr, ytr);
    const accGini = accuracy(yte, treeGini.predict(Xte));
    const accEntropy = accuracy(yte, treeEntropy.predict(Xte));
    console.log(
      `  depth=${String(depth).padEnd(4)}  Gini acc: ${fx(accGini, 4)}  ` +
        `Entropy acc: ${fx(accEntropy, 4)}  ` +
        `Diff: ${fx(Math.abs(accGini - accEntropy), 4)}`,
    );
  }
  console.log();
  console.log("  In practice, Gini and entropy produce nearly identical trees.");
  console.log("  Gini is slightly faster (no log computation).");
  console.log();
}

function populationStd(values: number[]): number {
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / values.length);
}

function demoSingleTreeVsForest(): void {
  header("SINGLE TREE vs RANDOM FOREST: STABILITY");
  const [X, y] = generateClassificationData(200, 42);

  const runTrials = (makeModel: () => DecisionTree | RandomForest): number[] => {
    const accs: number[] = [];
    for (let trial = 0; trial < 5; trial++) {
      random.seed(trial * 10);
      const indices = Array.from({ length: X.length }, () => random.randint(0, X.length - 1));
      const [Xtr, ytr, Xte, yte] = trainTestSplit(indices.map((i) => X[i]), indices.map((i) => y[i]), 0.2, trial);
      const model = makeModel();
      model.fit(Xtr, ytr);
      const acc = accuracy(yte, model.predict(Xte));
      accs.push(acc);
      console.log(`    Trial ${trial + 1}: accuracy = ${fx(acc, 4)}`);
    }
    return accs;
  };

  console.log("  Training 5 single trees on slightly different data subsets:");
  const singleAccs = runTrials(() => new DecisionTree({ maxDepth: 5 }));
  console.log();
  console.log("  Training 5 random forests on the same data subsets:");
  const forestAccs = runTrials(() => new RandomForest({ nTrees: 30, maxDepth: 5 }));

  const avg = (v: number[]): number => v.reduce((a, b) => a + b, 0) / 5;
  console.log();
  console.log(`  Single tree:   mean = ${fx(avg(singleAccs), 4)}, std = ${fx(populationStd(singleAccs), 4)}`);
  console.log(`  Random forest: mean = ${fx(avg(forestAccs), 4)}, std = ${fx(populationStd(forestAccs), 4)}`);
  console.log();
  console.log("  Forests are more stable (lower variance) across data perturbations.");
  console.log();
}

function printSummary(): void {
  console.log();
  header("SUMMARY");
  console.log("  1. Decision trees split data by maximizing information gain.");
  console.log("  2. Gini impurity and entropy produce nearly identical splits.");
  console.log("  3. Single trees are unstable. Small data changes = different tree.");
  console.log("  4. Random forests average many trees for stable, strong predictions.");
  console.log("  5. Bagging + feature randomization decorrelate the trees.");
  console.log("  6. Feature importance falls out naturally from impurity reduction.");
  console.log("  7. Trees dominate neural networks on tabular data.");
  console.log();
}

demoSplitCriteria();
demoInformationGain();
demoDecisionTree();
demoGiniVsEntropy();
demoRandomForest();
demoFeatureImportance();
demoRegressionTree();
demoSingleTreeVsForest();
printSummary();
