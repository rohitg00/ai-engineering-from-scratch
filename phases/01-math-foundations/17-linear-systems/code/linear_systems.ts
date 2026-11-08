// Lesson: Linear Systems (phase 01 / lesson 17)
// TypeScript port of code/linear_systems.py. Node standard library only.
// Source: phases/01-math-foundations/17-linear-systems/docs/en.md
// Run: npx tsx phases/01-math-foundations/17-linear-systems/code/linear_systems.ts
type Vector = number[];
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

class SeededRandom {
  private next: () => number;

  constructor(seed: number) {
    this.next = mulberry32(seed);
  }

  uniform(low: number, high: number): number {
    return low + (high - low) * this.next();
  }

  normal(): number {
    let u1 = this.next();
    while (u1 === 0) {
      u1 = this.next();
    }
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  normalVector(n: number): Vector {
    const values: Vector = [];
    for (let i = 0; i < n; i++) {
      values.push(this.normal());
    }
    return values;
  }

  normalMatrix(rows: number, cols: number): Matrix {
    const result: Matrix = [];
    for (let i = 0; i < rows; i++) {
      result.push(this.normalVector(cols));
    }
    return result;
  }

  uniformVector(low: number, high: number, n: number): Vector {
    const values: Vector = [];
    for (let i = 0; i < n; i++) {
      values.push(this.uniform(low, high));
    }
    return values;
  }
}

function zerosVector(n: number): Vector {
  return new Array<number>(n).fill(0);
}

function zerosMatrix(rows: number, cols: number): Matrix {
  const result: Matrix = [];
  for (let i = 0; i < rows; i++) {
    result.push(zerosVector(cols));
  }
  return result;
}

function identity(n: number): Matrix {
  const result = zerosMatrix(n, n);
  for (let i = 0; i < n; i++) {
    result[i]![i] = 1;
  }
  return result;
}

function copyMatrix(A: Matrix): Matrix {
  return A.map((row) => [...row]);
}

function transpose(A: Matrix): Matrix {
  const rows = A.length;
  const cols = A[0]!.length;
  const result = zerosMatrix(cols, rows);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j]![i] = A[i]![j]!;
    }
  }
  return result;
}

function matMul(A: Matrix, B: Matrix): Matrix {
  const rows = A.length;
  const inner = B.length;
  const cols = B[0]!.length;
  const result = zerosMatrix(rows, cols);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let total = 0;
      for (let k = 0; k < inner; k++) {
        total += A[i]![k]! * B[k]![j]!;
      }
      result[i]![j] = total;
    }
  }
  return result;
}

function matVec(A: Matrix, x: Vector): Vector {
  return A.map((row) => dot(row, x));
}

function dot(a: Vector, b: Vector): number {
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    total += a[i]! * b[i]!;
  }
  return total;
}

function addVectors(a: Vector, b: Vector): Vector {
  return a.map((value, i) => value + b[i]!);
}

function subtractVectors(a: Vector, b: Vector): Vector {
  return a.map((value, i) => value - b[i]!);
}

function scaleVector(a: Vector, s: number): Vector {
  return a.map((value) => value * s);
}

function addScaledIdentity(A: Matrix, s: number): Matrix {
  return A.map((row, i) => row.map((value, j) => (i === j ? value + s : value)));
}

function scaleMatrix(A: Matrix, s: number): Matrix {
  return A.map((row) => row.map((value) => value * s));
}

function addMatrices(A: Matrix, B: Matrix): Matrix {
  return A.map((row, i) => row.map((value, j) => value + B[i]![j]!));
}

function norm(a: Vector): number {
  return Math.sqrt(dot(a, a));
}

function maxAbsDiffVector(a: Vector, b: Vector): number {
  let worst = 0;
  for (let i = 0; i < a.length; i++) {
    worst = Math.max(worst, Math.abs(a[i]! - b[i]!));
  }
  return worst;
}

function maxAbsDiffMatrix(A: Matrix, B: Matrix): number {
  let worst = 0;
  for (let i = 0; i < A.length; i++) {
    worst = Math.max(worst, maxAbsDiffVector(A[i]!, B[i]!));
  }
  return worst;
}

function columnStack(columns: Vector[]): Matrix {
  const rows = columns[0]!.length;
  const result: Matrix = [];
  for (let i = 0; i < rows; i++) {
    result.push(columns.map((column) => column[i]!));
  }
  return result;
}

function mean(values: Vector): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total / values.length;
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return (Math.sign(value) * Math.round(Math.abs(value) * factor)) / factor;
}

function roundVector(a: Vector, digits: number): Vector {
  return a.map((value) => roundTo(value, digits));
}

function roundMatrix(A: Matrix, digits: number): Matrix {
  return A.map((row) => roundVector(row, digits));
}

function isNegative(value: number): boolean {
  return value < 0 || Object.is(value, -0);
}

function splitNumber(value: number): { whole: string; fraction: string } {
  const text = Math.abs(value).toFixed(8);
  const [wholeDigits, fractionDigits] = text.split(".");
  const whole = (isNegative(value) ? "-" : "") + wholeDigits!;
  const fraction = fractionDigits!.replace(/0+$/, "");
  return { whole, fraction };
}

function arrayLayout(values: number[]): { wholeWidth: number; fractionWidth: number } {
  let wholeWidth = 0;
  let fractionWidth = 0;
  for (const value of values) {
    const parts = splitNumber(value);
    wholeWidth = Math.max(wholeWidth, parts.whole.length);
    fractionWidth = Math.max(fractionWidth, parts.fraction.length);
  }
  return { wholeWidth, fractionWidth };
}

function formatElement(value: number, wholeWidth: number, fractionWidth: number): string {
  const parts = splitNumber(value);
  return parts.whole.padStart(wholeWidth) + "." + parts.fraction.padEnd(fractionWidth);
}

function formatRow(values: Vector, wholeWidth: number, fractionWidth: number): string {
  const cells = values.map((value) => formatElement(value, wholeWidth, fractionWidth));
  return "[" + cells.join(" ") + "]";
}

function formatVector(values: Vector): string {
  const layout = arrayLayout(values);
  return formatRow(values, layout.wholeWidth, layout.fractionWidth);
}

function formatMatrix(A: Matrix): string {
  const layout = arrayLayout(A.flat());
  const rows = A.map((row) => formatRow(row, layout.wholeWidth, layout.fractionWidth));
  return "[" + rows.join("\n ") + "]";
}

function formatExp(value: number, digits: number): string {
  if (value === Infinity) {
    return "inf";
  }
  const text = value.toExponential(digits);
  const [mantissa, exponent] = text.split("e");
  const sign = exponent!.startsWith("-") ? "-" : "+";
  const exponentDigits = exponent!.replace(/^[+-]/, "").padStart(2, "0");
  return `${mantissa}e${sign}${exponentDigits}`;
}

function argmaxAbsFrom(A: Matrix, column: number, start: number): number {
  let best = start;
  for (let i = start + 1; i < A.length; i++) {
    if (Math.abs(A[i]![column]!) > Math.abs(A[best]![column]!)) {
      best = i;
    }
  }
  return best;
}

function swapRows(A: Matrix, i: number, j: number): void {
  const temp = A[i]!;
  A[i] = A[j]!;
  A[j] = temp;
}

function gaussianElimination(A: Matrix, b: Vector): Vector {
  const n = b.length;
  const Ab = A.map((row, i) => [...row, b[i]!]);

  for (let k = 0; k < n; k++) {
    const maxRow = argmaxAbsFrom(Ab, k, k);
    swapRows(Ab, k, maxRow);

    if (Math.abs(Ab[k]![k]!) < 1e-12) {
      throw new Error(`Matrix is singular at pivot ${k}`);
    }

    for (let i = k + 1; i < n; i++) {
      const m = Ab[i]![k]! / Ab[k]![k]!;
      for (let j = k; j <= n; j++) {
        Ab[i]![j] = Ab[i]![j]! - m * Ab[k]![j]!;
      }
    }
  }

  const x = zerosVector(n);
  for (let i = n - 1; i >= 0; i--) {
    let known = 0;
    for (let j = i + 1; j < n; j++) {
      known += Ab[i]![j]! * x[j]!;
    }
    x[i] = (Ab[i]![n]! - known) / Ab[i]![i]!;
  }

  return x;
}

function luDecompose(A: Matrix): { P: Matrix; L: Matrix; U: Matrix } {
  const n = A.length;
  const L = identity(n);
  const U = copyMatrix(A);
  const P = identity(n);

  for (let k = 0; k < n; k++) {
    const maxRow = argmaxAbsFrom(U, k, k);
    if (maxRow !== k) {
      swapRows(U, k, maxRow);
      swapRows(P, k, maxRow);
      if (k > 0) {
        for (let j = 0; j < k; j++) {
          const temp = L[k]![j]!;
          L[k]![j] = L[maxRow]![j]!;
          L[maxRow]![j] = temp;
        }
      }
    }

    for (let i = k + 1; i < n; i++) {
      L[i]![k] = U[i]![k]! / U[k]![k]!;
      for (let j = k; j < n; j++) {
        U[i]![j] = U[i]![j]! - L[i]![k]! * U[k]![j]!;
      }
    }
  }

  return { P, L, U };
}

function luSolve(P: Matrix, L: Matrix, U: Matrix, b: Vector): Vector {
  const n = b.length;
  const Pb = matVec(P, b);

  const y = zerosVector(n);
  for (let i = 0; i < n; i++) {
    let known = 0;
    for (let j = 0; j < i; j++) {
      known += L[i]![j]! * y[j]!;
    }
    y[i] = Pb[i]! - known;
  }

  const x = zerosVector(n);
  for (let i = n - 1; i >= 0; i--) {
    let known = 0;
    for (let j = i + 1; j < n; j++) {
      known += U[i]![j]! * x[j]!;
    }
    x[i] = (y[i]! - known) / U[i]![i]!;
  }

  return x;
}

function cholesky(A: Matrix): Matrix {
  const n = A.length;
  const L = zerosMatrix(n, n);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let known = 0;
      for (let k = 0; k < j; k++) {
        known += L[i]![k]! * L[j]![k]!;
      }
      const s = A[i]![j]! - known;
      if (i === j) {
        if (s <= 0) {
          throw new Error("Matrix is not positive definite");
        }
        L[i]![j] = Math.sqrt(s);
      } else {
        L[i]![j] = s / L[j]![j]!;
      }
    }
  }

  return L;
}

function choleskySolve(L: Matrix, b: Vector): Vector {
  const n = b.length;
  const y = zerosVector(n);
  for (let i = 0; i < n; i++) {
    let known = 0;
    for (let j = 0; j < i; j++) {
      known += L[i]![j]! * y[j]!;
    }
    y[i] = (b[i]! - known) / L[i]![i]!;
  }

  const x = zerosVector(n);
  const Lt = transpose(L);
  for (let i = n - 1; i >= 0; i--) {
    let known = 0;
    for (let j = i + 1; j < n; j++) {
      known += Lt[i]![j]! * x[j]!;
    }
    x[i] = (y[i]! - known) / Lt[i]![i]!;
  }

  return x;
}

function leastSquaresNormal(A: Matrix, b: Vector): Vector {
  const At = transpose(A);
  const AtA = matMul(At, A);
  const Atb = matVec(At, b);
  return gaussianElimination(AtA, Atb);
}

function ridgeRegression(A: Matrix, b: Vector, lam: number): Vector {
  const At = transpose(A);
  const AtA = addScaledIdentity(matMul(At, A), lam);
  const Atb = matVec(At, b);
  const L = cholesky(AtA);
  return choleskySolve(L, Atb);
}

function singularValues(A: Matrix): Vector {
  const columns = transpose(A);
  const n = columns.length;

  for (let sweep = 0; sweep < 100; sweep++) {
    let rotated = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const alpha = dot(columns[i]!, columns[i]!);
        const beta = dot(columns[j]!, columns[j]!);
        const gamma = dot(columns[i]!, columns[j]!);
        if (Math.abs(gamma) <= 1e-15 * Math.sqrt(alpha * beta)) {
          continue;
        }
        rotated = true;
        const zeta = (beta - alpha) / (2 * gamma);
        const t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
        const c = 1 / Math.sqrt(1 + t * t);
        const s = c * t;
        const columnI = columns[i]!;
        const columnJ = columns[j]!;
        columns[i] = columnI.map((value, k) => c * value - s * columnJ[k]!);
        columns[j] = columnJ.map((value, k) => s * columnI[k]! + c * value);
      }
    }
    if (!rotated) {
      break;
    }
  }

  return columns.map((column) => norm(column)).sort((a, b) => b - a);
}

function conditionNumber(A: Matrix): number {
  const S = singularValues(A);
  const largest = S[0]!;
  const smallest = S[S.length - 1]!;
  if (smallest === 0 || smallest <= largest * Number.EPSILON * Number.EPSILON) {
    return Infinity;
  }
  return largest / smallest;
}

function conjugateGradient(A: Matrix, b: Vector, tol = 1e-10, maxIter?: number): { x: Vector; iterations: number } {
  const n = b.length;
  const limit = maxIter ?? n;

  let x = zerosVector(n);
  let r = subtractVectors(b, matVec(A, x));
  let p = [...r];
  let rsOld = dot(r, r);
  if (Math.sqrt(rsOld) < tol) {
    return { x, iterations: 0 };
  }

  for (let k = 0; k < limit; k++) {
    const Ap = matVec(A, p);
    const alpha = rsOld / dot(p, Ap);
    x = addVectors(x, scaleVector(p, alpha));
    r = subtractVectors(r, scaleVector(Ap, alpha));
    const rsNew = dot(r, r);
    if (Math.sqrt(rsNew) < tol) {
      return { x, iterations: k + 1 };
    }
    const beta = rsNew / rsOld;
    p = addVectors(r, scaleVector(p, beta));
    rsOld = rsNew;
  }

  return { x, iterations: limit };
}

function referenceSolve(A: Matrix, b: Vector): Vector {
  const n = b.length;
  const Ab = A.map((row, i) => [...row, b[i]!]);

  for (let k = 0; k < n; k++) {
    swapRows(Ab, k, argmaxAbsFrom(Ab, k, k));
    const pivot = Ab[k]![k]!;
    for (let j = k; j <= n; j++) {
      Ab[k]![j] = Ab[k]![j]! / pivot;
    }
    for (let i = 0; i < n; i++) {
      if (i === k) {
        continue;
      }
      const factor = Ab[i]![k]!;
      for (let j = k; j <= n; j++) {
        Ab[i]![j] = Ab[i]![j]! - factor * Ab[k]![j]!;
      }
    }
  }

  return Ab.map((row) => row[n]!);
}

function referenceCholesky(A: Matrix): Matrix {
  const n = A.length;
  const L = zerosMatrix(n, n);

  for (let j = 0; j < n; j++) {
    let diagonal = A[j]![j]!;
    for (let k = 0; k < j; k++) {
      diagonal -= L[j]![k]! * L[j]![k]!;
    }
    L[j]![j] = Math.sqrt(diagonal);
    for (let i = j + 1; i < n; i++) {
      let value = A[i]![j]!;
      for (let k = 0; k < j; k++) {
        value -= L[i]![k]! * L[j]![k]!;
      }
      L[i]![j] = value / L[j]![j]!;
    }
  }

  return L;
}

function referenceDeterminant(A: Matrix): number {
  const n = A.length;
  const U = copyMatrix(A);
  let determinant = 1;

  for (let k = 0; k < n; k++) {
    const maxRow = argmaxAbsFrom(U, k, k);
    if (maxRow !== k) {
      swapRows(U, k, maxRow);
      determinant = -determinant;
    }
    determinant *= U[k]![k]!;
    for (let i = k + 1; i < n; i++) {
      const factor = U[i]![k]! / U[k]![k]!;
      for (let j = k; j < n; j++) {
        U[i]![j] = U[i]![j]! - factor * U[k]![j]!;
      }
    }
  }

  return determinant;
}

function referenceLeastSquares(A: Matrix, b: Vector): Vector {
  const m = A.length;
  const n = A[0]!.length;
  const R = copyMatrix(A);
  const y = [...b];

  for (let k = 0; k < n; k++) {
    const v = zerosVector(m);
    let columnNorm = 0;
    for (let i = k; i < m; i++) {
      v[i] = R[i]![k]!;
      columnNorm += v[i]! * v[i]!;
    }
    columnNorm = Math.sqrt(columnNorm);
    v[k] = v[k]! + (v[k]! >= 0 ? columnNorm : -columnNorm);
    const vNormSquared = dot(v, v);
    if (vNormSquared === 0) {
      continue;
    }
    for (let j = k; j < n; j++) {
      let projection = 0;
      for (let i = k; i < m; i++) {
        projection += v[i]! * R[i]![j]!;
      }
      const factor = (2 * projection) / vNormSquared;
      for (let i = k; i < m; i++) {
        R[i]![j] = R[i]![j]! - factor * v[i]!;
      }
    }
    let projection = 0;
    for (let i = k; i < m; i++) {
      projection += v[i]! * y[i]!;
    }
    const factor = (2 * projection) / vNormSquared;
    for (let i = k; i < m; i++) {
      y[i] = y[i]! - factor * v[i]!;
    }
  }

  const x = zerosVector(n);
  for (let i = n - 1; i >= 0; i--) {
    let known = 0;
    for (let j = i + 1; j < n; j++) {
      known += R[i]![j]! * x[j]!;
    }
    x[i] = (y[i]! - known) / R[i]![i]!;
  }
  return x;
}

function demoGaussianElimination(): void {
  console.log("=".repeat(60));
  console.log("Gaussian Elimination with Partial Pivoting");
  console.log("=".repeat(60));

  const A = [
    [2, 1, 1],
    [4, 3, 3],
    [2, 3, 1],
  ];
  const b = [8, 20, 12];

  const xOurs = gaussianElimination(A, b);
  const xReference = referenceSolve(A, b);

  console.log(`A =\n${formatMatrix(A)}`);
  console.log(`b = ${formatVector(b)}`);
  console.log(`Solution (ours):  ${formatVector(xOurs)}`);
  console.log(`Solution (ref):   ${formatVector(xReference)}`);
  console.log(`Max difference: ${formatExp(maxAbsDiffVector(xOurs, xReference), 2)}`);

  const residual = subtractVectors(matVec(A, xOurs), b);
  console.log(`Residual ||Ax - b||: ${formatExp(norm(residual), 2)}`);
  console.log();
}

function demoLu(): void {
  console.log("=".repeat(60));
  console.log("LU Decomposition");
  console.log("=".repeat(60));

  const A = [
    [2, 1, 1],
    [4, 3, 3],
    [2, 3, 1],
  ];
  const b = [8, 20, 12];

  const { P, L, U } = luDecompose(A);

  console.log(`P =\n${formatMatrix(P)}`);
  console.log(`L =\n${formatMatrix(L)}`);
  console.log(`U =\n${formatMatrix(U)}`);

  const reconstructed = matMul(matMul(transpose(P), L), U);
  console.log(`PA = LU reconstruction error: ${formatExp(maxAbsDiffMatrix(A, reconstructed), 2)}`);

  const x = luSolve(P, L, U, b);
  console.log(`Solution: ${formatVector(x)}`);

  console.log("\nSolving 3 different right-hand sides with the same LU:");
  for (const bi of [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]) {
    const xi = luSolve(P, L, U, bi);
    console.log(`  b = ${formatVector(bi)} -> x = ${formatVector(roundVector(xi, 4))}`);
  }
  console.log();
}

function demoCholesky(): void {
  console.log("=".repeat(60));
  console.log("Cholesky Decomposition");
  console.log("=".repeat(60));

  const A = [
    [4, 2, 1],
    [2, 5, 3],
    [1, 3, 6],
  ];

  const L = cholesky(A);
  const LLt = matMul(L, transpose(L));
  console.log(`A =\n${formatMatrix(A)}`);
  console.log(`L =\n${formatMatrix(roundMatrix(L, 4))}`);
  console.log(`L @ L^T =\n${formatMatrix(roundMatrix(LLt, 4))}`);
  console.log(`Reconstruction error: ${formatExp(maxAbsDiffMatrix(A, LLt), 2)}`);

  const LReference = referenceCholesky(A);
  console.log(`Max diff from ref cholesky: ${formatExp(maxAbsDiffMatrix(L, LReference), 2)}`);

  const b = [7, 10, 10];
  const x = choleskySolve(L, b);
  const xDirect = referenceSolve(A, b);
  console.log("\nSolve Ax = b:");
  console.log(`  x (ours):  ${formatVector(roundVector(x, 4))}`);
  console.log(`  x (ref):   ${formatVector(roundVector(xDirect, 4))}`);

  console.log("\nLog determinant via Cholesky:");
  let logDet = 0;
  for (let i = 0; i < L.length; i++) {
    logDet += Math.log(L[i]![i]!);
  }
  logDet *= 2;
  const logDetReference = Math.log(referenceDeterminant(A));
  console.log(`  2 * sum(log(diag(L))) = ${logDet.toFixed(6)}`);
  console.log(`  log(det(A))           = ${logDetReference.toFixed(6)}`);
  console.log();
}

function demoLeastSquares(): void {
  console.log("=".repeat(60));
  console.log("Least Squares = Linear Regression");
  console.log("=".repeat(60));

  const rng = new SeededRandom(42);
  const nSamples = 100;
  const nFeatures = 3;
  const wTrue = [2.0, -1.0, 0.5];

  const XRaw = rng.normalMatrix(nSamples, nFeatures);
  const noise = scaleVector(rng.normalVector(nSamples), 0.1);
  const y = addVectors(matVec(XRaw, wTrue), noise);

  const X = XRaw.map((row) => [1, ...row]);
  const wTrueWithBias = [0.0, 2.0, -1.0, 0.5];

  const wOls = leastSquaresNormal(X, y);
  const wReference = referenceLeastSquares(X, y);

  console.log(`True weights:          ${formatVector(wTrueWithBias)}`);
  console.log(`OLS weights (ours):    ${formatVector(roundVector(wOls, 4))}`);
  console.log(`OLS weights (ref QR):  ${formatVector(roundVector(wReference, 4))}`);
  console.log(`Max difference: ${formatExp(maxAbsDiffVector(wOls, wReference), 2)}`);

  const residual = subtractVectors(matVec(X, wOls), y);
  console.log(`Residual norm: ${norm(residual).toFixed(4)}`);
  console.log();
}

function demoRidge(): void {
  console.log("=".repeat(60));
  console.log("Ridge Regression (Regularized Least Squares)");
  console.log("=".repeat(60));

  const rng = new SeededRandom(42);
  const nSamples = 100;
  const nFeatures = 3;
  const wTrue = [2.0, -1.0, 0.5];

  const XRaw = rng.normalMatrix(nSamples, nFeatures);
  const noise = scaleVector(rng.normalVector(nSamples), 0.1);
  const y = addVectors(matVec(XRaw, wTrue), noise);

  const X = XRaw.map((row) => [1, ...row]);

  for (const lam of [0.0, 0.1, 1.0, 10.0]) {
    const w = lam === 0.0 ? leastSquaresNormal(X, y) : ridgeRegression(X, y, lam);
    const r = norm(subtractVectors(matVec(X, w), y));
    const wNorm = norm(w);
    console.log(
      `lambda=${lam.toFixed(1).padStart(5)}  w=${formatVector(roundVector(w, 3))}  ||w||=${wNorm.toFixed(3)}  ||Xw-y||=${r.toFixed(3)}`,
    );
  }

  console.log("\nCompare with reference ridge (Gauss-Jordan on X^T X + lambda I):");
  const Xt = transpose(X);
  for (const lam of [0.1, 1.0, 10.0]) {
    const wOurs = ridgeRegression(X, y, lam);
    const wReference = referenceSolve(addScaledIdentity(matMul(Xt, X), lam), matVec(Xt, y));
    const diff = maxAbsDiffVector(wOurs, wReference);
    console.log(`  lambda=${lam.toFixed(1).padStart(5)}  max diff from reference: ${formatExp(diff, 2)}`);
  }
  console.log();
}

function demoConditionNumber(): void {
  console.log("=".repeat(60));
  console.log("Condition Number");
  console.log("=".repeat(60));

  const AGood = [
    [2, 0],
    [0, 1],
  ];
  console.log(`Well-conditioned: kappa = ${conditionNumber(AGood).toFixed(1)}`);

  const ABad = [
    [1, 1],
    [1, 1 + 1e-10],
  ];
  console.log(`Ill-conditioned:  kappa = ${formatExp(conditionNumber(ABad), 2)}`);

  const rng = new SeededRandom(42);
  const X = rng.normalMatrix(100, 5);
  console.log("\nRandom 100x5 matrix:");
  console.log(`  kappa(X)     = ${conditionNumber(X).toFixed(2)}`);
  console.log(`  kappa(X^T X) = ${conditionNumber(matMul(transpose(X), X)).toFixed(2)}`);

  const XCollinear = copyMatrix(X);
  const jitter = rng.normalVector(100);
  for (let i = 0; i < 100; i++) {
    XCollinear[i]![4] = XCollinear[i]![0]! + 1e-8 * jitter[i]!;
  }
  const XtXCollinear = matMul(transpose(XCollinear), XCollinear);
  console.log("\nWith near-collinear feature:");
  console.log(`  kappa(X)     = ${formatExp(conditionNumber(XCollinear), 2)}`);
  console.log(`  kappa(X^T X) = ${formatExp(conditionNumber(XtXCollinear), 2)}`);

  const lam = 0.01;
  const XtXRegularized = addScaledIdentity(XtXCollinear, lam);
  console.log(`\nAfter regularization (lambda=${lam}):`);
  console.log(`  kappa(X^T X + lambda I) = ${conditionNumber(XtXRegularized).toFixed(2)}`);
  console.log();
}

function demoConjugateGradient(): void {
  console.log("=".repeat(60));
  console.log("Conjugate Gradient");
  console.log("=".repeat(60));

  const rng = new SeededRandom(42);
  const n = 50;
  const M = rng.normalMatrix(n, n);
  const MtM = matMul(transpose(M), M);
  const A = addScaledIdentity(MtM, 0.1);
  const b = rng.normalVector(n);

  const { x: xCg, iterations } = conjugateGradient(A, b, 1e-10);
  const xDirect = referenceSolve(A, b);

  console.log(`System size: ${n}`);
  console.log(`CG iterations: ${iterations} (max possible: ${n})`);
  console.log(`Max diff from direct solve: ${formatExp(maxAbsDiffVector(xCg, xDirect), 2)}`);
  console.log(`Residual norm: ${formatExp(norm(subtractVectors(matVec(A, xCg), b)), 2)}`);
  console.log(`Condition number: ${conditionNumber(A).toFixed(2)}`);

  const AWell = addMatrices(identity(n), scaleMatrix(MtM, 0.1 / n));
  const bWell = rng.normalVector(n);
  const { iterations: iterationsWell } = conjugateGradient(AWell, bWell, 1e-10);
  console.log("\nBetter-conditioned system:");
  console.log(`  kappa = ${conditionNumber(AWell).toFixed(2)}`);
  console.log(`  CG iterations: ${iterationsWell}`);
  console.log();
}

function demoEquivalence(): void {
  console.log("=".repeat(60));
  console.log("All Methods Agree: Gaussian, LU, Cholesky, Normal Eq, Reference");
  console.log("=".repeat(60));

  const rng = new SeededRandom(42);
  const n = 5;
  const M = rng.normalMatrix(n, n);
  const A = addScaledIdentity(matMul(transpose(M), M), 1);
  const b = rng.normalVector(n);

  const xGauss = gaussianElimination(A, b);

  const { P, L, U } = luDecompose(A);
  const xLu = luSolve(P, L, U, b);

  const Lc = cholesky(A);
  const xChol = choleskySolve(Lc, b);

  const xReference = referenceSolve(A, b);

  const { x: xCg } = conjugateGradient(A, b, 1e-12);

  console.log(`Gaussian:  ${formatVector(roundVector(xGauss, 6))}`);
  console.log(`LU:        ${formatVector(roundVector(xLu, 6))}`);
  console.log(`Cholesky:  ${formatVector(roundVector(xChol, 6))}`);
  console.log(`Reference: ${formatVector(roundVector(xReference, 6))}`);
  console.log(`CG:        ${formatVector(roundVector(xCg, 6))}`);
  console.log("\nAll within tolerance:");
  const others: [string, Vector][] = [
    ["LU", xLu],
    ["Cholesky", xChol],
    ["Reference", xReference],
    ["CG", xCg],
  ];
  for (const [name, x] of others) {
    console.log(`  Gaussian vs ${name.padStart(10)}: ${formatExp(maxAbsDiffVector(xGauss, x), 2)}`);
  }
  console.log();
}

function demoLinearRegressionFull(): void {
  console.log("=".repeat(60));
  console.log("Full Pipeline: Linear Regression from Scratch");
  console.log("=".repeat(60));

  const rng = new SeededRandom(0);
  const nSamples = 200;
  const x1 = rng.uniformVector(0, 10, nSamples);
  const x2 = rng.uniformVector(0, 5, nSamples);
  const noise = scaleVector(rng.normalVector(nSamples), 0.5);
  const y = x1.map((value, i) => 3.0 * value - 2.0 * x2[i]! + 7.0 + noise[i]!);

  const X = columnStack([new Array<number>(nSamples).fill(1), x1, x2]);
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);

  console.log(`Data: ${nSamples} samples, ${X[0]!.length} features (with intercept)`);
  console.log("True weights: [7.0, 3.0, -2.0]");
  console.log(`Condition number of X^T X: ${conditionNumber(XtX).toFixed(2)}`);

  const wNormal = leastSquaresNormal(X, y);
  console.log(`\nNormal equations:     ${formatVector(roundVector(wNormal, 4))}`);

  const Lc = cholesky(XtX);
  const wChol = choleskySolve(Lc, matVec(Xt, y));
  console.log(`Cholesky:             ${formatVector(roundVector(wChol, 4))}`);

  const wReference = referenceLeastSquares(X, y);
  console.log(`Ref QR lstsq:         ${formatVector(roundVector(wReference, 4))}`);

  const yPred = matVec(X, wNormal);
  const errors = subtractVectors(y, yPred);
  const mse = mean(errors.map((e) => e * e));
  const yMean = mean(y);
  const totalSquares = y.reduce((total, value) => total + (value - yMean) ** 2, 0);
  const r2 = 1 - dot(errors, errors) / totalSquares;
  console.log(`\nMSE:  ${mse.toFixed(4)}`);
  console.log(`R^2:  ${r2.toFixed(4)}`);
  console.log();
}

demoGaussianElimination();
demoLu();
demoCholesky();
demoLeastSquares();
demoRidge();
demoConditionNumber();
demoConjugateGradient();
demoEquivalence();
demoLinearRegressionFull();
