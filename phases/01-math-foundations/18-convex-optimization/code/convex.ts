// Lesson: Convex Optimization (phase 01 / lesson 18)
// TypeScript port of code/convex.py. Node standard library only.
// Source: phases/01-math-foundations/18-convex-optimization/docs/en.md
// Run: npx tsx phases/01-math-foundations/18-convex-optimization/code/convex.ts
type Point = number[];
type Matrix2 = number[][];
type GradientFn = (x: Point) => Point;
type HessianFn = (x: Point) => Matrix2;

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

function seedRandom(seed: number): void {
  random = mulberry32(seed);
}

function uniform(low: number, high: number): number {
  return low + (high - low) * random();
}

function pyBool(value: boolean): string {
  return value ? "True" : "False";
}

function pyFloat(value: number): string {
  if (value === 0) {
    return Object.is(value, -0) ? "-0.0" : "0.0";
  }
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  if (exponent < -4 || exponent >= 16) {
    const [mantissa, power] = value.toExponential().split("e");
    const sign = power!.startsWith("-") ? "-" : "+";
    const digits = power!.replace(/^[+-]/, "").padStart(2, "0");
    return `${mantissa}e${sign}${digits}`;
  }
  if (Number.isInteger(value)) {
    return value.toFixed(1);
  }
  return String(value);
}

function isEvenTie(value: number, digits: number): boolean {
  const extended = Math.abs(value).toFixed(Math.min(100, digits + 30));
  const cut = extended.indexOf(".") + 1 + digits;
  const tail = extended.slice(cut);
  if (!/^50*$/.test(tail)) {
    return false;
  }
  const lastDigit = Number(extended.slice(0, cut).replace(".", "").slice(-1));
  return lastDigit % 2 === 0;
}

function fixed(value: number, digits: number): string {
  const sign = value < 0 || Object.is(value, -0) ? "-" : "";
  if (isEvenTie(value, digits)) {
    const extended = Math.abs(value).toFixed(Math.min(100, digits + 30));
    const cut = extended.indexOf(".") + (digits === 0 ? 0 : 1 + digits);
    return sign + extended.slice(0, cut);
  }
  return sign + Math.abs(value).toFixed(digits);
}

function exp2(value: number): string {
  const [mantissa, power] = value.toExponential(2).split("e");
  const sign = power!.startsWith("-") ? "-" : "+";
  const digits = power!.replace(/^[+-]/, "").padStart(2, "0");
  return `${mantissa}e${sign}${digits}`;
}

function hasInvalid(x: Point): boolean {
  return x.some((value) => Number.isNaN(value) || !Number.isFinite(value));
}

function sumOfSquares(values: Point): number {
  let total = 0;
  for (const value of values) {
    total += value ** 2;
  }
  return total;
}

function checkConvexity(
  f: (x: Point) => number,
  dim: number,
  bounds: [number, number] = [-5, 5],
  samples = 2000,
  label = "",
): { isConvex: boolean; violations: number } {
  let violations = 0;
  let worstViolation = 0.0;
  for (let s = 0; s < samples; s++) {
    const x: Point = [];
    for (let i = 0; i < dim; i++) {
      x.push(uniform(bounds[0], bounds[1]));
    }
    const y: Point = [];
    for (let i = 0; i < dim; i++) {
      y.push(uniform(bounds[0], bounds[1]));
    }
    const t = uniform(0, 1);
    const mid = x.map((xi, i) => t * xi + (1 - t) * y[i]!);
    const lhs = f(mid);
    const rhs = t * f(x) + (1 - t) * f(y);
    const gap = lhs - rhs;
    if (gap > 1e-10) {
      violations += 1;
      worstViolation = Math.max(worstViolation, gap);
    }
  }
  const isConvex = violations === 0;
  const status = isConvex ? "CONVEX" : "NOT CONVEX";
  if (label) {
    const worst = violations > 0 ? `  worst: ${worstViolation.toFixed(6)}` : "";
    console.log(`  ${label.padEnd(30)}  ${status.padEnd(10)}  violations: ${violations}/${samples}` + worst);
  }
  return { isConvex, violations };
}

function hessianEigenvalues2d(H: Matrix2): [number, number] | null {
  const a = H[0]![0]!;
  const b = H[0]![1]!;
  const c = H[1]![0]!;
  const d = H[1]![1]!;
  const trace = a + d;
  const det = a * d - b * c;
  const discriminant = trace ** 2 - 4 * det;
  if (discriminant < 0) {
    return null;
  }
  const sqrtDisc = Math.sqrt(discriminant);
  const e1 = (trace + sqrtDisc) / 2;
  const e2 = (trace - sqrtDisc) / 2;
  return [e1, e2];
}

function isPositiveSemidefinite2d(H: Matrix2): boolean {
  const eigenvalues = hessianEigenvalues2d(H);
  if (eigenvalues === null) {
    return false;
  }
  const [e1, e2] = eigenvalues;
  return e1 >= -1e-10 && e2 >= -1e-10;
}

function invert2x2(H: Matrix2): Matrix2 | null {
  const det = H[0]![0]! * H[1]![1]! - H[0]![1]! * H[1]![0]!;
  if (Math.abs(det) < 1e-15) {
    return null;
  }
  return [
    [H[1]![1]! / det, -H[0]![1]! / det],
    [-H[1]![0]! / det, H[0]![0]! / det],
  ];
}

function matVec2d(M: Matrix2, v: Point): Point {
  return [M[0]![0]! * v[0]! + M[0]![1]! * v[1]!, M[1]![0]! * v[0]! + M[1]![1]! * v[1]!];
}

class GradientDescent {
  lr: number;

  constructor(lr = 0.001) {
    this.lr = lr;
  }

  step(params: Point, grads: Point): Point {
    return params.map((p, i) => p - this.lr * grads[i]!);
  }
}

function optimizeGd(gradF: GradientFn, x0: Point, lr = 0.01, steps = 1000, tol = 1e-12): Point[] {
  let x = [...x0];
  const history: Point[] = [[...x]];
  for (let s = 0; s < steps; s++) {
    const g = gradF(x);
    if (sumOfSquares(g) < tol) {
      break;
    }
    x = x.map((xi, i) => xi - lr * g[i]!);
    if (hasInvalid(x)) {
      break;
    }
    history.push([...x]);
  }
  return history;
}

function newtonsMethod(gradF: GradientFn, hessianF: HessianFn, x0: Point, steps = 100, tol = 1e-12): Point[] {
  let x = [...x0];
  const history: Point[] = [[...x]];
  for (let s = 0; s < steps; s++) {
    const g = gradF(x);
    if (sumOfSquares(g) < tol) {
      break;
    }
    const H = hessianF(x);
    const HInv = invert2x2(H);
    if (HInv === null) {
      break;
    }
    const dx = matVec2d(HInv, g);
    x = [x[0]! - dx[0]!, x[1]! - dx[1]!];
    if (hasInvalid(x)) {
      break;
    }
    history.push([...x]);
  }
  return history;
}

type LagrangeStep = { x: Point; lam: number; gv: number };

function lagrangeSolve(
  fGrad: GradientFn,
  gVal: (x: Point) => number,
  gGrad: GradientFn,
  x0: Point,
  lr = 0.01,
  lrLambda = 0.01,
  steps = 5000,
): LagrangeStep[] {
  let x = [...x0];
  let lam = 0.0;
  const history: LagrangeStep[] = [];
  for (let s = 0; s < steps; s++) {
    const fg = fGrad(x);
    const gv = gVal(x);
    const gg = gGrad(x);
    x = x.map((xi, i) => xi - lr * (fg[i]! + lam * gg[i]!));
    lam = lam + lrLambda * gv;
    if (hasInvalid(x)) {
      break;
    }
    history.push({ x: [...x], lam, gv: gVal(x) });
  }
  return history;
}

function demoConvexityChecker(): void {
  console.log("=".repeat(65));
  console.log("  CONVEXITY CHECKER");
  console.log("=".repeat(65));
  console.log();

  seedRandom(42);

  checkConvexity((x) => x[0]! ** 2, 1, undefined, undefined, "f(x) = x^2");
  checkConvexity((x) => Math.abs(x[0]!), 1, undefined, undefined, "f(x) = |x|");
  checkConvexity((x) => Math.exp(x[0]!), 1, undefined, undefined, "f(x) = e^x");
  checkConvexity((x) => x[0]! ** 2 + x[1]! ** 2, 2, undefined, undefined, "f(x,y) = x^2 + y^2");
  checkConvexity((x) => Math.max(x[0]!, 0), 1, undefined, undefined, "f(x) = max(0, x) [ReLU]");

  checkConvexity((x) => Math.sin(x[0]!), 1, undefined, undefined, "f(x) = sin(x)");
  checkConvexity((x) => x[0]! ** 3, 1, undefined, undefined, "f(x) = x^3");
  checkConvexity((x) => -(x[0]! ** 2), 1, undefined, undefined, "f(x) = -x^2");
  checkConvexity((x) => Math.sin(x[0]!) * Math.cos(x[1]!), 2, undefined, undefined, "f(x,y) = sin(x)*cos(y)");
  checkConvexity((x) => x[0]! ** 2 - x[1]! ** 2, 2, undefined, undefined, "f(x,y) = x^2 - y^2 [saddle]");

  console.log();
  console.log("  Top group: expected convex. Bottom group: expected non-convex.");
}

function formatHessian(H: Matrix2): string {
  return `[[${H[0]![0]}, ${H[0]![1]}], [${H[1]![0]}, ${H[1]![1]}]]`;
}

function demoHessianAnalysis(): void {
  console.log();
  console.log();
  console.log("=".repeat(65));
  console.log("  HESSIAN ANALYSIS AND CURVATURE");
  console.log("=".repeat(65));

  console.log();
  console.log("  f(x,y) = 5x^2 + y^2 (elongated bowl)");
  const H1 = [
    [10, 0],
    [0, 2],
  ];
  let [e1, e2] = hessianEigenvalues2d(H1)!;
  let psd = isPositiveSemidefinite2d(H1);
  console.log(`  Hessian: ${formatHessian(H1)}`);
  console.log(`  Eigenvalues: ${e1.toFixed(1)}, ${e2.toFixed(1)}`);
  console.log(`  Condition number: ${(e1 / e2).toFixed(1)}`);
  console.log(`  Positive semidefinite: ${pyBool(psd)}`);
  console.log(`  Convex: ${pyBool(psd)}`);

  console.log();
  console.log("  f(x,y) = x^2 - y^2 (saddle)");
  const H2 = [
    [2, 0],
    [0, -2],
  ];
  [e1, e2] = hessianEigenvalues2d(H2)!;
  psd = isPositiveSemidefinite2d(H2);
  console.log(`  Hessian: ${formatHessian(H2)}`);
  console.log(`  Eigenvalues: ${e1.toFixed(1)}, ${e2.toFixed(1)}`);
  console.log(`  Positive semidefinite: ${pyBool(psd)}`);
  console.log("  Saddle point: mixed signs confirm saddle");

  console.log();
  console.log("  f(x,y) = x^2 + 3xy + y^2");
  const H3 = [
    [2, 3],
    [3, 2],
  ];
  [e1, e2] = hessianEigenvalues2d(H3)!;
  psd = isPositiveSemidefinite2d(H3);
  console.log(`  Hessian: ${formatHessian(H3)}`);
  console.log(`  Eigenvalues: ${e1.toFixed(1)}, ${e2.toFixed(1)}`);
  console.log(`  Positive semidefinite: ${pyBool(psd)}`);
  console.log(`  Convex: ${pyBool(psd)} (negative eigenvalue means indefinite)`);

  console.log();
  console.log("  Rosenbrock at minimum (1, 1)");
  const Hmin = [
    [802, -400],
    [-400, 200],
  ];
  [e1, e2] = hessianEigenvalues2d(Hmin)!;
  psd = isPositiveSemidefinite2d(Hmin);
  console.log(`  Hessian: ${formatHessian(Hmin)}`);
  console.log(`  Eigenvalues: ${e1.toFixed(2)}, ${e2.toFixed(2)}`);
  console.log(`  Condition number: ${(e1 / e2).toFixed(1)}`);
  console.log(`  Positive semidefinite at (1,1): ${pyBool(psd)}`);
}

function tableHeader(width: number): string {
  return `  ${"Step".padStart(6)}  ${"x".padStart(width)}  ${"y".padStart(width)}  ${"f(x,y)".padStart(14)}`;
}

function tableRow(step: number, p: Point, value: number, width: number, digits: number): string {
  const x = fixed(p[0]!, digits).padStart(width);
  const y = fixed(p[1]!, digits).padStart(width);
  return `  ${String(step).padStart(6)}  ${x}  ${y}  ${fixed(value, 8).padStart(14)}`;
}

function demoNewtonsMethod(): void {
  console.log();
  console.log();
  console.log("=".repeat(65));
  console.log("  NEWTON'S METHOD vs GRADIENT DESCENT");
  console.log("=".repeat(65));

  const f = (x: Point): number => 50 * x[0]! ** 2 + x[1]! ** 2;
  const gradF = (x: Point): Point => [100 * x[0]!, 2 * x[1]!];
  const hessianF = (_x: Point): Matrix2 => [
    [100, 0],
    [0, 2],
  ];

  const start = [10.0, 10.0];

  console.log();
  console.log("  Function: f(x,y) = 50x^2 + y^2");
  console.log("  Minimum at: (0, 0), f = 0");
  console.log(`  Starting point: (${pyFloat(start[0]!)}, ${pyFloat(start[1]!)}), f = ${f(start).toFixed(1)}`);
  console.log(`  Condition number: ${(100 / 2).toFixed(0)} (elongated valley)`);

  const newtonHist = newtonsMethod(gradF, hessianF, start, 50);
  const gdHist = optimizeGd(gradF, start, 0.015, 500);

  console.log();
  console.log(`  Newton's method: ${newtonHist.length - 1} steps to converge`);
  console.log(tableHeader(12));
  console.log(`  ${"-".repeat(48)}`);
  newtonHist.forEach((p, i) => {
    console.log(tableRow(i, p, f(p), 12, 8));
  });

  console.log();
  const threshold = 1e-10;
  let gdConverged = gdHist.length - 1;
  for (let i = 0; i < gdHist.length; i++) {
    if (f(gdHist[i]!) < threshold) {
      gdConverged = i;
      break;
    }
  }

  console.log(`  Gradient descent (lr=0.015): ${gdHist.length - 1} steps taken`);
  const stepsToShow = [0, 1, 5, 10, 25, 50, 100, 200, 300, 400, 499].filter((s) => s < gdHist.length);
  console.log(tableHeader(12));
  console.log(`  ${"-".repeat(48)}`);
  for (const i of stepsToShow) {
    const p = gdHist[i]!;
    console.log(tableRow(i, p, f(p), 12, 8));
  }

  console.log();
  console.log(`  Newton converged in ${newtonHist.length - 1} step(s)`);
  const notConverged = gdConverged === gdHist.length - 1 ? " (did not converge)" : "";
  console.log(`  GD reached f < ${pyFloat(threshold)} at step ${gdConverged}` + notConverged);
  console.log();
  console.log("  Newton's method is exact for quadratic functions.");
  console.log("  GD struggles with high condition number (elongated valleys).");
}

function demoConditionNumberEffect(): void {
  console.log();
  console.log();
  console.log("=".repeat(65));
  console.log("  CONDITION NUMBER EFFECT ON GRADIENT DESCENT");
  console.log("=".repeat(65));
  console.log();

  const conditions = [1, 5, 10, 50, 100];

  console.log("  Minimizing f(x,y) = c*x^2 + y^2, start = (10, 10)");
  console.log("  Newton always converges in 1 step for any condition number.");
  console.log();
  console.log(
    `  ${"Cond #".padStart(8)}  ${"GD steps".padStart(10)}  ${"Newton steps".padStart(14)}  ${"GD final loss".padStart(14)}`,
  );
  console.log(`  ${"-".repeat(50)}`);

  for (const c of conditions) {
    const gradF = (x: Point): Point => [2 * c * x[0]!, 2 * x[1]!];
    const hessF = (_x: Point): Matrix2 => [
      [2 * c, 0],
      [0, 2],
    ];
    const fVal = (x: Point): number => c * x[0]! ** 2 + x[1]! ** 2;

    const start = [10.0, 10.0];
    const lr = 0.9 / (2 * c);

    const gdHist = optimizeGd(gradF, start, lr, 2000);
    const newtonHist = newtonsMethod(gradF, hessF, start, 50);

    const gdSteps = gdHist.length - 1;
    const newtonSteps = newtonHist.length - 1;
    const gdFinal = fVal(gdHist[gdHist.length - 1]!);

    console.log(
      `  ${String(c).padStart(8)}  ${String(gdSteps).padStart(10)}  ${String(newtonSteps).padStart(14)}  ${exp2(gdFinal).padStart(14)}`,
    );
  }
}

function demoLagrangeMultipliers(): void {
  console.log();
  console.log();
  console.log("=".repeat(65));
  console.log("  LAGRANGE MULTIPLIER SOLVER");
  console.log("=".repeat(65));

  console.log();
  console.log("  Problem: minimize f(x,y) = x^2 + y^2");
  console.log("  Subject to: g(x,y) = x + y - 1 = 0");
  console.log("  Analytical solution: x = 0.5, y = 0.5, lambda = -1");
  console.log();

  const fGrad = (x: Point): Point => [2 * x[0]!, 2 * x[1]!];
  const gVal = (x: Point): number => x[0]! + x[1]! - 1;
  const gGrad = (_x: Point): Point => [1.0, 1.0];

  const history = lagrangeSolve(fGrad, gVal, gGrad, [2.0, 2.0], 0.01, 0.01, 5000);

  const milestones = [0, 49, 499, 999, 2499, 4999].filter((m) => m < history.length);

  console.log(
    `  ${"Step".padStart(6)}  ${"x".padStart(8)}  ${"y".padStart(8)}  ${"lambda".padStart(8)}  ${"g(x,y)".padStart(10)}  ${"f(x,y)".padStart(10)}`,
  );
  console.log(`  ${"-".repeat(56)}`);

  for (const i of milestones) {
    const { x, lam, gv } = history[i]!;
    const fv = x[0]! ** 2 + x[1]! ** 2;
    const cells = [
      String(i + 1).padStart(6),
      fixed(x[0]!, 4).padStart(8),
      fixed(x[1]!, 4).padStart(8),
      fixed(lam, 4).padStart(8),
      fixed(gv, 6).padStart(10),
      fixed(fv, 6).padStart(10),
    ];
    console.log(`  ${cells.join("  ")}`);
  }

  const final = history[history.length - 1]!;
  console.log();
  console.log(`  Final:   x = ${fixed(final.x[0]!, 6)}, y = ${fixed(final.x[1]!, 6)}`);
  console.log(`  lambda = ${fixed(final.lam, 6)}`);
  console.log(`  Constraint violation: ${exp2(Math.abs(final.gv))}`);
  console.log(`  Objective value: ${fixed(final.x[0]! ** 2 + final.x[1]! ** 2, 6)}`);

  console.log();
  console.log();
  console.log("  Problem: minimize f(x,y) = (x-3)^2 + (y-3)^2");
  console.log("  Subject to: x + 2y = 4");
  console.log();

  const fGrad2 = (x: Point): Point => [2 * (x[0]! - 3), 2 * (x[1]! - 3)];
  const gVal2 = (x: Point): number => x[0]! + 2 * x[1]! - 4;
  const gGrad2 = (_x: Point): Point => [1.0, 2.0];

  const history2 = lagrangeSolve(fGrad2, gVal2, gGrad2, [0.0, 0.0], 0.002, 0.002, 20000);

  const final2 = history2[history2.length - 1]!;
  const [x2, y2] = [final2.x[0]!, final2.x[1]!];
  console.log(`  Solution: x = ${fixed(x2, 6)}, y = ${fixed(y2, 6)}`);
  console.log(`  lambda = ${fixed(final2.lam, 6)}`);
  console.log(`  Constraint x + 2y = ${fixed(x2 + 2 * y2, 6)} (target: 4)`);
  console.log(`  Objective: ${fixed((x2 - 3) ** 2 + (y2 - 3) ** 2, 6)}`);

  const xExact = 2.0;
  const yExact = 1.0;
  console.log();
  console.log("  Analytical: x = 2, y = 1, lambda = 2");
  console.log(`  Error: ${exp2(Math.sqrt((x2 - xExact) ** 2 + (y2 - yExact) ** 2))}`);
}

function demoRegularizationGeometry(): void {
  console.log();
  console.log();
  console.log("=".repeat(65));
  console.log("  REGULARIZATION AS CONSTRAINED OPTIMIZATION");
  console.log("=".repeat(65));
  console.log();

  console.log("  Unconstrained minimum of (x-3)^2 + (y-2)^2: (3, 2)");
  console.log();

  console.log("  L2 constraint: x^2 + y^2 <= 1 (unit circle)");
  const xL2 = [3.0 / Math.sqrt(13), 2.0 / Math.sqrt(13)];
  console.log(`  Projected solution: (${fixed(xL2[0]!, 6)}, ${fixed(xL2[1]!, 6)})`);
  console.log(`  ||w||^2 = ${fixed(xL2[0]! ** 2 + xL2[1]! ** 2, 6)}`);
  console.log("  Both weights nonzero: weights shrink but none eliminated");
  console.log();

  console.log("  L1 constraint: |x| + |y| <= 1 (unit diamond)");
  console.log("  Solution sits at a corner of the diamond.");

  let bestVal = Infinity;
  let bestX: Point = [];

  for (let i = 0; i <= 1000; i++) {
    const xCand = i * 0.001;
    const yCand = 1.0 - xCand;
    const val = (xCand - 3) ** 2 + (yCand - 2) ** 2;
    if (val < bestVal) {
      bestVal = val;
      bestX = [xCand, yCand];
    }
  }

  for (let i = 0; i <= 1000; i++) {
    const yCandRaw = i * 0.001;
    const xCand = 1.0 - yCandRaw;
    const val = (xCand - 3) ** 2 + (yCandRaw - 2) ** 2;
    if (val < bestVal) {
      bestVal = val;
      bestX = [xCand, yCandRaw];
    }
  }

  const cornerVals: [Point, number][] = [
    [[1.0, 0.0], (1 - 3) ** 2 + (0 - 2) ** 2],
    [[0.0, 1.0], (0 - 3) ** 2 + (1 - 2) ** 2],
    [[-1.0, 0.0], (-1 - 3) ** 2 + (0 - 2) ** 2],
    [[0.0, -1.0], (0 - 3) ** 2 + (-1 - 2) ** 2],
  ];

  console.log("  Scanning diamond boundary...");
  console.log(`  Best on edges: (${fixed(bestX[0]!, 4)}, ${fixed(bestX[1]!, 4)}), objective = ${fixed(bestVal, 4)}`);
  console.log();
  console.log("  Diamond corners:");
  const bestCorner = Math.min(...cornerVals.map(([, val]) => val));
  for (const [pt, val] of cornerVals) {
    const marker = val === bestCorner ? " <-- best corner" : "";
    console.log(`    (${fixed(pt[0]!, 1).padStart(5)}, ${fixed(pt[1]!, 1).padStart(5)})  objective = ${fixed(val, 1)}${marker}`);
  }

  console.log();
  console.log("  L1 pushes solution toward corners (axis-aligned).");
  console.log("  L2 pushes solution toward the nearest point on the circle.");
  console.log("  L1 produces sparsity. L2 produces small but nonzero weights.");
}

function demoFirstVsSecondOrder(): void {
  console.log();
  console.log();
  console.log("=".repeat(65));
  console.log("  FIRST-ORDER vs SECOND-ORDER: CONVERGENCE SPEED");
  console.log("=".repeat(65));
  console.log();

  const rosenbrock = (x: Point): number => (1 - x[0]!) ** 2 + 100 * (x[1]! - x[0]! ** 2) ** 2;

  const rosenbrockGrad = (x: Point): Point => {
    const dx = -2 * (1 - x[0]!) + 200 * (x[1]! - x[0]! ** 2) * (-2 * x[0]!);
    const dy = 200 * (x[1]! - x[0]! ** 2);
    return [dx, dy];
  };

  const rosenbrockHessian = (x: Point): Matrix2 => {
    const h00 = 2 - 400 * x[1]! + 1200 * x[0]! ** 2;
    const h01 = -400 * x[0]!;
    const h10 = -400 * x[0]!;
    const h11 = 200;
    return [
      [h00, h01],
      [h10, h11],
    ];
  };

  const start = [0.5, 0.5];

  console.log("  Rosenbrock function: f(x,y) = (1-x)^2 + 100(y-x^2)^2");
  console.log("  Minimum at (1, 1), f = 0");
  console.log(`  Start: (${pyFloat(start[0]!)}, ${pyFloat(start[1]!)}), f = ${fixed(rosenbrock(start), 4)}`);
  console.log();

  const newtonHist = newtonsMethod(rosenbrockGrad, rosenbrockHessian, start, 100);

  const gdHist = optimizeGd(rosenbrockGrad, start, 0.001, 10000);

  console.log(`  Newton's method (${newtonHist.length - 1} steps):`);
  console.log(tableHeader(10));
  console.log(`  ${"-".repeat(44)}`);
  newtonHist.slice(0, 15).forEach((p, i) => {
    console.log(tableRow(i, p, rosenbrock(p), 10, 6));
  });
  if (newtonHist.length > 15) {
    const p = newtonHist[newtonHist.length - 1]!;
    console.log(tableRow(newtonHist.length - 1, p, rosenbrock(p), 10, 6));
  }

  console.log();

  const gdThreshold = 1e-6;
  let gdConvergeStep = gdHist.length - 1;
  for (let i = 0; i < gdHist.length; i++) {
    if (rosenbrock(gdHist[i]!) < gdThreshold) {
      gdConvergeStep = i;
      break;
    }
  }

  console.log(`  Gradient descent (lr=0.001, ${gdHist.length - 1} steps):`);
  const showSteps = [0, 10, 100, 500, 1000, 2000, 5000, 9999].filter((s) => s < gdHist.length);
  console.log(tableHeader(10));
  console.log(`  ${"-".repeat(44)}`);
  for (const i of showSteps) {
    const p = gdHist[i]!;
    console.log(tableRow(i, p, rosenbrock(p), 10, 6));
  }

  console.log();
  console.log(`  Newton converged (f < 1e-12) in ${newtonHist.length - 1} steps`);
  if (gdConvergeStep < gdHist.length - 1) {
    console.log(`  GD converged (f < ${pyFloat(gdThreshold)}) in ${gdConvergeStep} steps`);
  } else {
    const finalGd = rosenbrock(gdHist[gdHist.length - 1]!);
    console.log(
      `  GD did not reach f < ${pyFloat(gdThreshold)} in ${gdHist.length - 1} steps (final: ${exp2(finalGd)})`,
    );
  }

  console.log();
  console.log("  Newton uses O(n^3) per step but converges quadratically.");
  console.log("  GD uses O(n) per step but converges linearly.");
  console.log("  For small problems, Newton wins. For millions of parameters, GD wins.");
}

function demoConvexVsNonconvexLandscape(): void {
  console.log();
  console.log();
  console.log("=".repeat(65));
  console.log("  CONVEX vs NON-CONVEX: ASCII LANDSCAPE");
  console.log("=".repeat(65));
  console.log();
  console.log("  Convex: f(x) = x^2");
  console.log();

  for (let yLevel = 10; yLevel >= 0; yLevel--) {
    const threshold = yLevel * 2.5;
    let line = "  ";
    for (let xStep = -20; xStep <= 20; xStep++) {
      const x = xStep * 0.25;
      const val = x ** 2;
      if (Math.abs(val - threshold) < 1.3) {
        line += "*";
      } else {
        line += " ";
      }
    }
    console.log(line);
  }

  console.log("  " + "-".repeat(41));
  console.log("  " + " ".repeat(18) + "x=0");
  console.log("  One valley. Gradient descent always finds the bottom.");

  console.log();
  console.log("  Non-convex: f(x) = sin(3x) + 0.1*x^2");
  console.log();

  for (let yLevel = 10; yLevel >= 0; yLevel--) {
    const threshold = -1.0 + yLevel * 0.4;
    let line = "  ";
    for (let xStep = -25; xStep <= 25; xStep++) {
      const x = xStep * 0.2;
      const val = Math.sin(3 * x) + 0.1 * x ** 2;
      if (Math.abs(val - threshold) < 0.25) {
        line += "*";
      } else {
        line += " ";
      }
    }
    console.log(line);
  }

  console.log("  " + "-".repeat(51));
  console.log("  Multiple valleys. Gradient descent may get stuck.");
}

function demoDualityIntuition(): void {
  console.log();
  console.log();
  console.log("=".repeat(65));
  console.log("  DUALITY: PRIMAL vs DUAL");
  console.log("=".repeat(65));
  console.log();
  console.log("  Primal: minimize x^2 + y^2 subject to x + y >= 1");
  console.log("  Rewrite constraint as: -(x + y - 1) <= 0");
  console.log();
  console.log("  Lagrangian: L = x^2 + y^2 + lambda * (1 - x - y)");
  console.log("  dL/dx = 2x - lambda = 0  =>  x = lambda/2");
  console.log("  dL/dy = 2y - lambda = 0  =>  y = lambda/2");
  console.log();
  console.log("  Dual function:");
  console.log("    d(lambda) = min_x,y [x^2 + y^2 + lambda(1 - x - y)]");
  console.log("              = (lambda/2)^2 + (lambda/2)^2 + lambda(1 - lambda)");
  console.log("              = lambda^2/2 + lambda - lambda^2");
  console.log("              = lambda - lambda^2/2");
  console.log();
  console.log("  Dual problem: maximize lambda - lambda^2/2 s.t. lambda >= 0");
  console.log("  d'(lambda) = 1 - lambda = 0  =>  lambda* = 1");
  console.log();

  const lamStar = 1.0;
  const xStar = lamStar / 2;
  const yStar = lamStar / 2;
  const primalVal = xStar ** 2 + yStar ** 2;
  const dualVal = lamStar - lamStar ** 2 / 2;

  console.log(`  Primal solution: x = ${pyFloat(xStar)}, y = ${pyFloat(yStar)}`);
  console.log(`  Primal objective: ${pyFloat(primalVal)}`);
  console.log(`  Dual objective:   ${pyFloat(dualVal)}`);
  console.log(`  Strong duality:   primal = dual = ${pyFloat(primalVal)}`);
  console.log(`  Constraint: x + y = ${pyFloat(xStar + yStar)} >= 1  (active)`);
  console.log(`  Complementary slackness: lambda * (1 - x - y) = ${pyFloat(lamStar * (1 - xStar - yStar))}`);
}

function printSummary(): void {
  console.log();
  console.log();
  console.log("=".repeat(65));
  console.log("  SUMMARY");
  console.log("=".repeat(65));
  console.log();
  console.log("  1. Convex functions have one valley. Every local min is global.");
  console.log("  2. The Hessian encodes curvature. PSD Hessian = convex.");
  console.log("  3. Newton's method uses curvature for faster convergence.");
  console.log("  4. Lagrange multipliers handle equality constraints.");
  console.log("  5. KKT conditions handle inequality constraints.");
  console.log("  6. L1 regularization = diamond constraint = sparsity.");
  console.log("  7. L2 regularization = circle constraint = weight shrinkage.");
  console.log("  8. Duality converts hard primal problems into sometimes-easier duals.");
  console.log("  9. Neural networks are non-convex, but overparameterization and");
  console.log("     stochastic noise make gradient descent work anyway.");
  console.log();
}

demoConvexityChecker();
demoHessianAnalysis();
demoNewtonsMethod();
demoConditionNumberEffect();
demoLagrangeMultipliers();
demoRegularizationGeometry();
demoFirstVsSecondOrder();
demoConvexVsNonconvexLandscape();
demoDualityIntuition();
printSummary();
