// Lesson: Dimensionality Reduction (phase 01 / lesson 10)
// TypeScript port of code/dim_reduction.py. Node standard library only.
// Source: phases/01-math-foundations/10-dimensionality-reduction/docs/en.md
// Run: npx tsx phases/01-math-foundations/10-dimensionality-reduction/code/dim_reduction.ts
type Matrix = number[][];

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let random = mulberry32(42);

function seed(value: number): void {
  random = mulberry32(value);
}

function uniform(low: number, high: number, count: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(low + (high - low) * random());
  }
  return values;
}

function standardNormal(): number {
  let u = random();
  while (u === 0) {
    u = random();
  }
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function normal(mean: number, std: number, count: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < count; i++) {
    values.push(mean + std * standardNormal());
  }
  return values;
}

function randn(rows: number, cols: number): Matrix {
  const result: Matrix = [];
  for (let i = 0; i < rows; i++) {
    result.push(normal(0, 1, cols));
  }
  return result;
}

function zeros(rows: number, cols: number): Matrix {
  const result: Matrix = [];
  for (let i = 0; i < rows; i++) {
    result.push(new Array<number>(cols).fill(0));
  }
  return result;
}

function columnStack(columns: number[][]): Matrix {
  const rows = columns[0]!.length;
  const result: Matrix = [];
  for (let i = 0; i < rows; i++) {
    result.push(columns.map((column) => column[i]!));
  }
  return result;
}

function transpose(a: Matrix): Matrix {
  const rows = a.length;
  const cols = a[0]!.length;
  const result = zeros(cols, rows);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j]![i] = a[i]![j]!;
    }
  }
  return result;
}

function matmul(a: Matrix, b: Matrix): Matrix {
  const rows = a.length;
  const inner = b.length;
  const cols = b[0]!.length;
  const result = zeros(rows, cols);
  for (let i = 0; i < rows; i++) {
    const rowA = a[i]!;
    const rowOut = result[i]!;
    for (let k = 0; k < inner; k++) {
      const aik = rowA[k]!;
      const rowB = b[k]!;
      for (let j = 0; j < cols; j++) {
        rowOut[j]! += aik * rowB[j]!;
      }
    }
  }
  return result;
}

function columnMeans(a: Matrix): number[] {
  const cols = a[0]!.length;
  const means = new Array<number>(cols).fill(0);
  for (const row of a) {
    for (let j = 0; j < cols; j++) {
      means[j]! += row[j]!;
    }
  }
  return means.map((total) => total / a.length);
}

function subtractRow(a: Matrix, row: number[]): Matrix {
  return a.map((r) => r.map((value, j) => value - row[j]!));
}

function addRow(a: Matrix, row: number[]): Matrix {
  return a.map((r) => r.map((value, j) => value + row[j]!));
}

function covariance(centered: Matrix): Matrix {
  const product = matmul(transpose(centered), centered);
  const divisor = centered.length - 1;
  return product.map((row) => row.map((value) => value / divisor));
}

function meanSquaredDifference(a: Matrix, b: Matrix): number {
  let total = 0;
  let count = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a[i]!.length; j++) {
      const diff = a[i]![j]! - b[i]![j]!;
      total += diff * diff;
      count++;
    }
  }
  return total / count;
}

function householderTridiagonalize(V: Matrix, d: number[], e: number[]): void {
  const n = V.length;
  for (let j = 0; j < n; j++) {
    d[j] = V[n - 1]![j]!;
  }

  for (let i = n - 1; i > 0; i--) {
    let scale = 0;
    let h = 0;
    for (let k = 0; k < i; k++) {
      scale += Math.abs(d[k]!);
    }
    if (scale === 0) {
      e[i] = d[i - 1]!;
      for (let j = 0; j < i; j++) {
        d[j] = V[i - 1]![j]!;
        V[i]![j] = 0;
        V[j]![i] = 0;
      }
    } else {
      for (let k = 0; k < i; k++) {
        d[k] = d[k]! / scale;
        h += d[k]! * d[k]!;
      }
      let f = d[i - 1]!;
      let g = Math.sqrt(h);
      if (f > 0) {
        g = -g;
      }
      e[i] = scale * g;
      h = h - f * g;
      d[i - 1] = f - g;
      for (let j = 0; j < i; j++) {
        e[j] = 0;
      }
      for (let j = 0; j < i; j++) {
        f = d[j]!;
        V[j]![i] = f;
        g = e[j]! + V[j]![j]! * f;
        for (let k = j + 1; k <= i - 1; k++) {
          g += V[k]![j]! * d[k]!;
          e[k] = e[k]! + V[k]![j]! * f;
        }
        e[j] = g;
      }
      f = 0;
      for (let j = 0; j < i; j++) {
        e[j] = e[j]! / h;
        f += e[j]! * d[j]!;
      }
      const hh = f / (h + h);
      for (let j = 0; j < i; j++) {
        e[j] = e[j]! - hh * d[j]!;
      }
      for (let j = 0; j < i; j++) {
        f = d[j]!;
        g = e[j]!;
        for (let k = j; k <= i - 1; k++) {
          V[k]![j] = V[k]![j]! - (f * e[k]! + g * d[k]!);
        }
        d[j] = V[i - 1]![j]!;
        V[i]![j] = 0;
      }
    }
    d[i] = h;
  }

  for (let i = 0; i < n - 1; i++) {
    V[n - 1]![i] = V[i]![i]!;
    V[i]![i] = 1;
    const h = d[i + 1]!;
    if (h !== 0) {
      for (let k = 0; k <= i; k++) {
        d[k] = V[k]![i + 1]! / h;
      }
      for (let j = 0; j <= i; j++) {
        let g = 0;
        for (let k = 0; k <= i; k++) {
          g += V[k]![i + 1]! * V[k]![j]!;
        }
        for (let k = 0; k <= i; k++) {
          V[k]![j] = V[k]![j]! - g * d[k]!;
        }
      }
    }
    for (let k = 0; k <= i; k++) {
      V[k]![i + 1] = 0;
    }
  }
  for (let j = 0; j < n; j++) {
    d[j] = V[n - 1]![j]!;
    V[n - 1]![j] = 0;
  }
  V[n - 1]![n - 1] = 1;
  e[0] = 0;
}

function tridiagonalQL(V: Matrix, d: number[], e: number[]): void {
  const n = V.length;
  for (let i = 1; i < n; i++) {
    e[i - 1] = e[i]!;
  }
  e[n - 1] = 0;

  let f = 0;
  let largest = 0;
  const eps = 2 ** -52;
  for (let l = 0; l < n; l++) {
    largest = Math.max(largest, Math.abs(d[l]!) + Math.abs(e[l]!));
    let m = l;
    while (m < n - 1 && Math.abs(e[m]!) > eps * largest) {
      m++;
    }

    if (m > l) {
      do {
        let g = d[l]!;
        let p = (d[l + 1]! - g) / (2 * e[l]!);
        let r = Math.hypot(p, 1);
        if (p < 0) {
          r = -r;
        }
        d[l] = e[l]! / (p + r);
        d[l + 1] = e[l]! * (p + r);
        const dl1 = d[l + 1]!;
        let h = g - d[l]!;
        for (let i = l + 2; i < n; i++) {
          d[i] = d[i]! - h;
        }
        f += h;

        p = d[m]!;
        let c = 1;
        let c2 = c;
        let c3 = c;
        const el1 = e[l + 1]!;
        let s = 0;
        let s2 = 0;
        for (let i = m - 1; i >= l; i--) {
          c3 = c2;
          c2 = c;
          s2 = s;
          g = c * e[i]!;
          h = c * p;
          r = Math.hypot(p, e[i]!);
          e[i + 1] = s * r;
          s = e[i]! / r;
          c = p / r;
          p = c * d[i]! - s * g;
          d[i + 1] = h + s * (c * g + s * d[i]!);
          for (let k = 0; k < n; k++) {
            const row = V[k]!;
            const right = row[i + 1]!;
            row[i + 1] = s * row[i]! + c * right;
            row[i] = c * row[i]! - s * right;
          }
        }
        p = (-s * s2 * c3 * el1 * e[l]!) / dl1;
        e[l] = s * p;
        d[l] = c * p;
      } while (Math.abs(e[l]!) > eps * largest);
    }
    d[l] = d[l]! + f;
    e[l] = 0;
  }
}

function symmetricEigen(input: Matrix): { values: number[]; vectors: Matrix } {
  const n = input.length;
  const vectors = input.map((row) => row.slice());
  const values = new Array<number>(n).fill(0);
  const offDiagonal = new Array<number>(n).fill(0);
  householderTridiagonalize(vectors, values, offDiagonal);
  tridiagonalQL(vectors, values, offDiagonal);
  return { values, vectors };
}

function argsortDescending(values: number[]): number[] {
  const indices = values.map((_, i) => i);
  indices.sort((i, j) => values[j]! - values[i]!);
  return indices;
}

function sum(values: number[]): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
}

function shapeOf(a: Matrix): string {
  return `(${a.length}, ${a[0]!.length})`;
}

function formatArray(values: number[]): string {
  const fixed = values.map((value) => value.toFixed(8));
  let digits = 8;
  while (digits > 1 && fixed.every((text) => text.endsWith("0".repeat(9 - digits)))) {
    digits--;
  }
  return `[${values.map((value) => value.toFixed(digits)).join(" ")}]`;
}

function pythonFloat(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

class PCA {
  nComponents: number;
  components: Matrix = [];
  mean: number[] = [];
  eigenvalues: number[] = [];
  explainedVarianceRatio: number[] = [];

  constructor(nComponents: number) {
    this.nComponents = nComponents;
  }

  fit(X: Matrix): PCA {
    this.mean = columnMeans(X);
    const XCentered = subtractRow(X, this.mean);

    const covMatrix = covariance(XCentered);

    const { values, vectors } = symmetricEigen(covMatrix);

    const sortedIdx = argsortDescending(values);
    const eigenvalues = sortedIdx.map((i) => values[i]!);
    const eigenvectorColumns = sortedIdx.map((i) => vectors.map((row) => row[i]!));

    this.components = eigenvectorColumns.slice(0, this.nComponents);
    this.eigenvalues = eigenvalues.slice(0, this.nComponents);
    const totalVar = sum(eigenvalues);
    this.explainedVarianceRatio = this.eigenvalues.map((value) => value / totalVar);

    return this;
  }

  transform(X: Matrix): Matrix {
    const XCentered = subtractRow(X, this.mean);
    return matmul(XCentered, transpose(this.components));
  }

  fitTransform(X: Matrix): Matrix {
    this.fit(X);
    return this.transform(X);
  }

  inverseTransform(XReduced: Matrix): Matrix {
    return addRow(matmul(XReduced, this.components), this.mean);
  }
}

function printHeader(title: string): void {
  console.log("=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

function demoSynthetic(): void {
  printHeader("PCA on synthetic 3D data");

  seed(42);
  const nSamples = 500;

  const t = uniform(0, 2 * Math.PI, nSamples);
  const noise1 = normal(0, 0.2, nSamples);
  const x1 = t.map((angle, i) => 3 * Math.cos(angle) + noise1[i]!);
  const noise2 = normal(0, 0.2, nSamples);
  const x2 = t.map((angle, i) => 3 * Math.sin(angle) + noise2[i]!);
  const noise3 = normal(0, 0.1, nSamples);
  const x3 = x1.map((value, i) => 0.5 * value + 0.3 * x2[i]! + noise3[i]!);

  const X = columnStack([x1, x2, x3]);

  const pca = new PCA(2);
  const XReduced = pca.fitTransform(X);

  console.log(`Original shape: ${shapeOf(X)}`);
  console.log(`Reduced shape:  ${shapeOf(XReduced)}`);
  console.log(`Explained variance ratios: ${formatArray(pca.explainedVarianceRatio)}`);
  console.log(`Total variance captured: ${sum(pca.explainedVarianceRatio).toFixed(4)}`);

  const XReconstructed = pca.inverseTransform(XReduced);
  const mse = meanSquaredDifference(X, XReconstructed);
  console.log(`Reconstruction MSE: ${mse.toFixed(6)}`);
  console.log();
}

function demoMnist(): void {
  printHeader("PCA on MNIST digits");
  console.log("Python only: this demo downloads MNIST with scikit-learn.");
  console.log();
}

function demoSklearnComparison(): void {
  printHeader("Comparison: our PCA vs sklearn PCA");
  console.log("Python only: this demo compares against scikit-learn.");
  console.log();
}

function demoTsne(): void {
  printHeader("t-SNE on MNIST (5000 samples)");
  console.log("Python only: this demo uses scikit-learn TSNE.");
  console.log();
}

function demoUmap(): void {
  printHeader("UMAP on MNIST (5000 samples)");
  console.log("Python only: this demo uses umap-learn.");
  console.log();
}

function demoPcaPreprocessing(): void {
  printHeader("PCA as preprocessing for logistic regression");
  console.log("Python only: this demo uses scikit-learn LogisticRegression.");
  console.log();
}

function kernelPca(X: Matrix, nComponents: number, kernel = "rbf", gamma = 1.0): Matrix {
  const n = X.length;

  const gram = matmul(X, transpose(X));
  let K: Matrix;
  if (kernel === "rbf") {
    const squaredNorms = gram.map((row, i) => row[i]!);
    K = gram.map((row, i) =>
      row.map((dot, j) => Math.exp(-gamma * (squaredNorms[i]! + squaredNorms[j]! - 2 * dot))),
    );
  } else if (kernel === "poly") {
    K = gram.map((row) => row.map((dot) => (dot + 1) ** gamma));
  } else {
    K = gram;
  }

  const rowMeans = K.map((row) => sum(row) / n);
  const colMeans = columnMeans(K);
  const grandMean = sum(rowMeans) / n;
  const KCentered = K.map((row, i) =>
    row.map((value, j) => value - colMeans[j]! - rowMeans[i]! + grandMean),
  );

  const { values, vectors } = symmetricEigen(KCentered);

  const sortedIdx = argsortDescending(values);
  const topIdx = sortedIdx.slice(0, nComponents);
  const topVals = topIdx.map((i) => values[i]!);
  const topVecs = vectors.map((row) => topIdx.map((i) => row[i]!));

  for (let i = 0; i < nComponents; i++) {
    if (topVals[i]! > 1e-10) {
      const scale = Math.sqrt(topVals[i]!);
      for (const row of topVecs) {
        row[i] = row[i]! / scale;
      }
    }
  }

  return topVecs.map((row) => row.map((value, i) => value * topVals[i]!));
}

function reconstructionError(X: Matrix, XReconstructed: Matrix): number {
  return meanSquaredDifference(X, XReconstructed);
}

function ringPoints(radius: number, count: number): Matrix {
  const theta = uniform(0, 2 * Math.PI, count);
  const r = normal(0, 0.1, count).map((noise) => radius + noise);
  return columnStack([
    theta.map((angle, i) => r[i]! * Math.cos(angle)),
    theta.map((angle, i) => r[i]! * Math.sin(angle)),
  ]);
}

function firstColumnByLabel(X: Matrix, labels: number[], label: number): number[] {
  const values: number[] = [];
  for (let i = 0; i < X.length; i++) {
    if (labels[i] === label) {
      values.push(X[i]![0]!);
    }
  }
  return values;
}

function mean(values: number[]): number {
  return sum(values) / values.length;
}

function demoKernelPca(): void {
  printHeader("KERNEL PCA: Concentric circles");

  seed(42);
  const nPerRing = 200;

  const inner = ringPoints(1.0, nPerRing);
  const outer = ringPoints(3.0, nPerRing);

  const XCircles = [...inner, ...outer];
  const labels = [...new Array<number>(nPerRing).fill(0), ...new Array<number>(nPerRing).fill(1)];

  const pcaLinear = new PCA(1);
  const XLinear = pcaLinear.fitTransform(XCircles);

  const innerLinear = firstColumnByLabel(XLinear, labels, 0);
  const outerLinear = firstColumnByLabel(XLinear, labels, 1);
  const innerRangeLinear = [Math.min(...innerLinear), Math.max(...innerLinear)] as const;
  const outerRangeLinear = [Math.min(...outerLinear), Math.max(...outerLinear)] as const;

  console.log(`\n  Data: ${nPerRing} points per ring, 2 concentric circles`);
  console.log("\n  Linear PCA (1 component):");
  console.log(`    Inner ring range: [${innerRangeLinear[0].toFixed(2)}, ${innerRangeLinear[1].toFixed(2)}]`);
  console.log(`    Outer ring range: [${outerRangeLinear[0].toFixed(2)}, ${outerRangeLinear[1].toFixed(2)}]`);
  const overlap = innerRangeLinear[1] > outerRangeLinear[0] && outerRangeLinear[1] > innerRangeLinear[0];
  const overlapText = overlap ? "True" : "False";
  console.log(`    Overlapping: ${overlapText} (linear PCA cannot separate circles)`);

  const XKpca = kernelPca(XCircles, 2, "rbf", 0.5);

  const innerMean = mean(firstColumnByLabel(XKpca, labels, 0));
  const outerMean = mean(firstColumnByLabel(XKpca, labels, 1));
  const separation = Math.abs(outerMean - innerMean);

  console.log("\n  Kernel PCA (RBF, gamma=0.5, 2 components):");
  console.log(`    Inner ring PC1 mean: ${innerMean.toFixed(4)}`);
  console.log(`    Outer ring PC1 mean: ${outerMean.toFixed(4)}`);
  console.log(`    Separation on PC1: ${separation.toFixed(4)}`);
  console.log("    Kernel PCA separates the circles in the first component");

  for (const g of [0.1, 0.5, 1.0, 5.0]) {
    const XK = kernelPca(XCircles, 2, "rbf", g);
    const innerM = mean(firstColumnByLabel(XK, labels, 0));
    const outerM = mean(firstColumnByLabel(XK, labels, 1));
    const sep = Math.abs(outerM - innerM);
    console.log(`    gamma=${pythonFloat(g).padEnd(4)}  separation=${sep.toFixed(4)}`);
  }

  console.log();
}

function demoReconstructionError(): void {
  printHeader("RECONSTRUCTION ERROR vs NUMBER OF COMPONENTS");

  seed(42);
  const nSamples = 300;
  const nFeatures = 20;
  const nInformative = 5;

  const base = randn(nSamples, nInformative);
  const mixing = randn(nInformative, nFeatures);
  const noise = randn(nSamples, nFeatures).map((row) => row.map((value) => value * 0.1));
  const mixed = matmul(base, mixing);
  const X = mixed.map((row, i) => row.map((value, j) => value + noise[i]![j]!));

  const totalVarPca = new PCA(nFeatures);
  totalVarPca.fit(X);

  console.log(`\n  Data: ${nSamples} samples, ${nFeatures} features, ${nInformative} informative`);
  console.log(
    `\n  ${"k".padStart(4)}  ${"Recon MSE".padStart(12)}  ${"Explained Var".padStart(14)}  ${"Cumulative".padStart(11)}`,
  );
  console.log(`  ${"-".repeat(4)}  ${"-".repeat(12)}  ${"-".repeat(14)}  ${"-".repeat(11)}`);

  for (const k of [1, 2, 3, 5, 10, 15, 20]) {
    const pcaK = new PCA(k);
    const XReduced = pcaK.fitTransform(X);
    const XReconstructed = pcaK.inverseTransform(XReduced);
    const mse = reconstructionError(X, XReconstructed);
    const cumulative = sum(pcaK.explainedVarianceRatio);
    const ev = pcaK.explainedVarianceRatio[k - 1]!;
    console.log(
      `  ${String(k).padStart(4)}  ${mse.toFixed(4).padStart(12)}  ${ev.toFixed(6).padStart(14)}  ${cumulative.toFixed(4).padStart(11)}`,
    );
  }

  console.log(`\n  The data is effectively ${nInformative}-dimensional.`);
  console.log(`  After k=${nInformative}, reconstruction error drops to near-noise level.`);
  console.log("  Additional components capture only noise variance.");
  console.log();
}

demoKernelPca();
demoReconstructionError();
demoSynthetic();

demoMnist();
demoSklearnComparison();
demoTsne();
demoUmap();
demoPcaPreprocessing();
