// Lesson: Numerical Stability (phase 01 / lesson 13)
// TypeScript port of code/numerical.py. Node standard library only.
// Source: phases/01-math-foundations/13-numerical-stability/docs/en.md
// Run: npx tsx phases/01-math-foundations/13-numerical-stability/code/numerical.ts
class OverflowError extends Error {}
class DomainError extends Error {}
class ZeroDivisionError extends Error {}

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

  uniform(low: number, high: number): number {
    return low + (high - low) * this.random();
  }

  gauss(mu: number, sigma: number): number {
    const u1 = 1 - this.random();
    const u2 = this.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mu + sigma * z;
  }
}

function exp(x: number): number {
  const result = Math.exp(x);
  if (result === Infinity && Number.isFinite(x)) {
    throw new OverflowError("math range error");
  }
  return result;
}

function log(x: number): number {
  if (x <= 0) {
    throw new DomainError("math domain error");
  }
  return Math.log(x);
}

function divide(numerator: number, denominator: number): number {
  if (denominator === 0) {
    throw new ZeroDivisionError("float division by zero");
  }
  return numerator / denominator;
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

function isClose(a: number, b: number, relTol = 1e-9): boolean {
  return Math.abs(a - b) <= relTol * Math.max(Math.abs(a), Math.abs(b));
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

function fmtE(x: number, decimals: number): string {
  if (Number.isNaN(x)) return "nan";
  if (x === Infinity) return "inf";
  if (x === -Infinity) return "-inf";
  const [mantissa, exponentText] = x.toExponential(decimals).split("e");
  const exponent = Number(exponentText);
  const expSign = exponent < 0 ? "-" : "+";
  return mantissa + "e" + expSign + String(Math.abs(exponent)).padStart(2, "0");
}

function pyList(values: number[]): string {
  return "[" + values.map(pyRepr).join(", ") + "]";
}

function pyStrList(values: string[]): string {
  return "[" + values.map((v) => `'${v}'`).join(", ") + "]";
}

function pyBool(value: boolean): string {
  return value ? "True" : "False";
}

function softmaxNaive(logits: number[]): number[] {
  const exps = logits.map((z) => exp(z));
  const total = sum(exps);
  return exps.map((e) => e / total);
}

function softmaxStable(logits: number[]): number[] {
  const maxLogit = Math.max(...logits);
  const exps = logits.map((z) => exp(z - maxLogit));
  const total = sum(exps);
  return exps.map((e) => e / total);
}

function logsumexpNaive(values: number[]): number {
  return log(sum(values.map((v) => exp(v))));
}

function logsumexpStable(values: number[]): number {
  const c = Math.max(...values);
  return c + log(sum(values.map((v) => exp(v - c))));
}

function logSoftmaxStable(logits: number[]): number[] {
  const c = Math.max(...logits);
  const shiftedLse = log(sum(logits.map((z) => exp(z - c))));
  return logits.map((z) => z - c - shiftedLse);
}

function crossEntropyNaive(trueClass: number, logits: number[]): number {
  const probs = softmaxNaive(logits);
  return -log(probs[trueClass]!);
}

function crossEntropyStable(trueClass: number, logits: number[]): number {
  const logProbs = logSoftmaxStable(logits);
  return -logProbs[trueClass]!;
}

function sigmoidNaive(x: number): number {
  return 1.0 / (1.0 + exp(-x));
}

function sigmoidStable(x: number): number {
  if (x >= 0) {
    const z = exp(-x);
    return 1.0 / (1.0 + z);
  }
  const z = exp(x);
  return z / (1.0 + z);
}

function binaryCrossEntropyNaive(yTrue: number, yPred: number): number {
  return -(yTrue * log(yPred) + (1 - yTrue) * log(1 - yPred));
}

function binaryCrossEntropyStable(yTrue: number, logit: number): number {
  const maxVal = Math.max(0.0, logit);
  return maxVal + log(exp(-maxVal) + exp(logit - maxVal)) - yTrue * logit;
}

function numericalGradient(f: (x: number[]) => number, x: number[], h = 1e-5): number[] {
  const grad: number[] = [];
  for (let i = 0; i < x.length; i++) {
    const xPlus = x.slice();
    const xMinus = x.slice();
    xPlus[i]! += h;
    xMinus[i]! -= h;
    grad.push((f(xPlus) - f(xMinus)) / (2 * h));
  }
  return grad;
}

function checkGradient(analytical: number[], numerical: number[], tolerance = 1e-5): boolean {
  let allOk = true;
  for (let i = 0; i < analytical.length; i++) {
    const a = analytical[i]!;
    const n = numerical[i]!;
    const denom = Math.max(Math.abs(a), Math.abs(n), 1e-8);
    const relError = Math.abs(a - n) / denom;
    const status = relError < tolerance ? "OK" : "FAIL";
    if (status === "FAIL") {
      allOk = false;
    }
    console.log(
      `  param ${i}: analytical=${fmtF(a, 8)} numerical=${fmtF(n, 8)} ` +
        `rel_error=${fmtE(relError, 2)} [${status}]`,
    );
  }
  return allOk;
}

function clipByValue(gradients: number[], maxVal: number): number[] {
  return gradients.map((g) => Math.max(-maxVal, Math.min(maxVal, g)));
}

function clipByNorm(gradients: number[], maxNorm: number): number[] {
  const totalNorm = Math.sqrt(sum(gradients.map((g) => g ** 2)));
  if (totalNorm > maxNorm) {
    const scale = maxNorm / totalNorm;
    return gradients.map((g) => g * scale);
  }
  return gradients.slice();
}

function checkTensor(name: string, values: number[]): boolean {
  const nNan = values.filter((v) => Number.isNaN(v)).length;
  const nInf = values.filter((v) => v === Infinity || v === -Infinity).length;
  if (nNan > 0 || nInf > 0) {
    console.log(`  WARNING ${name}: ${nNan} NaN, ${nInf} Inf out of ${values.length} values`);
    return false;
  }
  console.log(`  OK ${name}: all ${values.length} values finite`);
  return true;
}

function simulateBfloat16(x: number): number {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, x, true);
  const asInt = view.getUint32(0, true);
  const truncated = (asInt & 0xffff0000) >>> 0;
  view.setUint32(0, truncated, true);
  return view.getFloat32(0, true);
}

function roundHalfEven(y: number): number {
  const floor = Math.floor(y);
  const fraction = y - floor;
  if (fraction > 0.5) return floor + 1;
  if (fraction < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

function simulateFloat16(x: number): number {
  if (Number.isNaN(x)) return NaN;
  const magnitude = Math.abs(x);
  const sign = x < 0 || Object.is(x, -0) ? -1 : 1;
  if (magnitude >= 65520) {
    return x > 0 ? Infinity : -Infinity;
  }
  const smallestNormal = 2 ** -14;
  let quantum: number;
  if (magnitude < smallestNormal) {
    quantum = 2 ** -24;
  } else {
    let exponent = Math.floor(Math.log2(magnitude));
    while (2 ** exponent > magnitude) exponent -= 1;
    while (2 ** (exponent + 1) <= magnitude) exponent += 1;
    quantum = 2 ** (exponent - 10);
  }
  return sign * roundHalfEven(magnitude / quantum) * quantum;
}

function kahanSum(values: number[]): number {
  let total = 0.0;
  let compensation = 0.0;
  for (const v of values) {
    const y = v - compensation;
    const t = total + y;
    compensation = t - total - y;
    total = t;
  }
  return total;
}

function welfordVariance(values: number[]): number {
  let n = 0;
  let mean = 0.0;
  let m2 = 0.0;
  for (const x of values) {
    n += 1;
    const delta = x - mean;
    mean += delta / n;
    const delta2 = x - mean;
    m2 += delta * delta2;
  }
  if (n < 2) {
    return 0.0;
  }
  return m2 / n;
}

function varianceNaive(values: number[]): number {
  const n = values.length;
  const meanX = sum(values) / n;
  const meanX2 = sum(values.map((v) => v ** 2)) / n;
  return meanX2 - meanX ** 2;
}

function layerNorm(values: number[], epsilon = 1e-5, gamma = 1.0, beta = 0.0): number[] {
  const n = values.length;
  const mean = sum(values) / n;
  const variance = sum(values.map((v) => (v - mean) ** 2)) / n;
  const std = Math.sqrt(variance + epsilon);
  return values.map((v) => ((v - mean) / std) * gamma + beta);
}

function banner(title: string): void {
  console.log("=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

function demoFloatPrecision(): void {
  banner("DEMO 1: Floating Point Precision Limits");

  console.log(`\n  0.1 + 0.2 = ${pyRepr(0.1 + 0.2)}`);
  console.log(`  0.1 + 0.2 == 0.3? ${pyBool(0.1 + 0.2 === 0.3)}`);
  console.log(`  Difference from 0.3: ${fmtE(0.1 + 0.2 - 0.3, 2)}`);
  console.log(`  math.isclose(0.1 + 0.2, 0.3): ${pyBool(isClose(0.1 + 0.2, 0.3))}`);

  console.log(`\n  Float32 max: ~${fmtE(3.4028235e38, 2)}`);
  console.log(`  Float32 min positive (normal): ~${fmtE(1.175e-38, 2)}`);
  console.log(`  Float32 epsilon: ~${fmtE(1.1920929e-7, 2)}`);

  console.log(`\n  1.0 + 1e-7 == 1.0?  ${pyBool(1.0 + 1e-7 === 1.0)}`);
  console.log(`  1.0 + 1e-8 == 1.0?  ${pyBool(1.0 + 1e-8 === 1.0)}`);
  console.log("  (These are float64 in Python. In float32, epsilon is ~1.19e-7)");

  let totalNaive = 0.0;
  for (let i = 0; i < 1_000_000; i++) {
    totalNaive += 1e-7;
  }
  const totalKahan = kahanSum(new Array<number>(1_000_000).fill(1e-7));
  const trueValue = 1e-7 * 1_000_000;

  console.log("\n  Summing 1e-7 one million times:");
  console.log(`  True value:  ${pyRepr(trueValue)}`);
  console.log(`  Naive sum:   ${fmtF(totalNaive, 10)}  (error: ${fmtE(Math.abs(totalNaive - trueValue), 2)})`);
  console.log(`  Kahan sum:   ${fmtF(totalKahan, 10)}  (error: ${fmtE(Math.abs(totalKahan - trueValue), 2)})`);
  console.log();
}

function demoCatastrophicCancellation(): void {
  banner("DEMO 2: Catastrophic Cancellation");

  const data = [1_000_000.0, 1_000_001.0, 1_000_002.0];
  const trueVar = 2.0 / 3.0;

  const varNaive = varianceNaive(data);
  const varWelford = welfordVariance(data);

  console.log(`\n  Data: ${pyList(data)}`);
  console.log(`  True variance: ${fmtF(trueVar, 10)}`);
  console.log(`  Naive (E[x^2] - E[x]^2): ${fmtF(varNaive, 10)}`);
  console.log(`  Welford (online):         ${fmtF(varWelford, 10)}`);
  console.log(`  Naive error:   ${fmtE(Math.abs(varNaive - trueVar), 2)}`);
  console.log(`  Welford error: ${fmtE(Math.abs(varWelford - trueVar), 2)}`);

  const a = 1.0000001;
  const b = 1.0;
  const trueDiff = 1e-7;
  const computedDiff = a - b;
  const relError = (Math.abs(computedDiff - trueDiff) / trueDiff) * 100;

  console.log("\n  Subtracting nearly equal numbers:");
  console.log(`  a = ${pyRepr(a)}`);
  console.log(`  b = ${pyRepr(b)}`);
  console.log(`  True a - b = ${pyRepr(trueDiff)}`);
  console.log(`  Computed:    ${pyRepr(computedDiff)}`);
  console.log(`  Relative error: ${fmtF(relError, 1)}%`);
  console.log();
}

function demoOverflowUnderflow(): void {
  banner("DEMO 3: Overflow and Underflow in exp() and log()");

  console.log("\n  exp() overflow boundary (float64 in Python):");
  for (const x of [700, 709, 709.78, 710]) {
    try {
      const result = exp(x);
      console.log(`  exp(${x}) = ${fmtE(result, 4)}`);
    } catch (error) {
      if (!(error instanceof OverflowError)) throw error;
      console.log(`  exp(${x}) = OVERFLOW`);
    }
  }

  console.log("\n  exp() underflow (results become 0.0):");
  for (const x of [-700, -745, -746]) {
    const result = exp(x);
    console.log(`  exp(${x}) = ${pyRepr(result)}`);
  }

  console.log("\n  log() edge cases:");
  for (const x of [1.0, 1e-300, 1e-323, 0.0]) {
    try {
      if (x === 0.0) {
        console.log("  log(0.0) = -inf  (mathematically)");
        const result = log(1e-323);
        console.log(`  log(1e-323) = ${fmtF(result, 2)}  (closest we can get)`);
      } else {
        const result = log(x);
        console.log(`  log(${pyRepr(x)}) = ${fmtF(result, 4)}`);
      }
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      console.log(`  log(${pyRepr(x)}) = DOMAIN ERROR`);
    }
  }

  console.log("\n  Float16 overflow boundary:");
  for (const val of [65000.0, 65504.0, 65520.0, 70000.0]) {
    const f16 = simulateFloat16(val);
    console.log(`  float16(${pyRepr(val)}) = ${pyRepr(f16)}`);
  }
  console.log();
}

function demoSoftmaxStability(): void {
  banner("DEMO 4: Naive vs Stable Softmax");

  const safeLogits = [2.0, 1.0, 0.1];
  console.log(`\n  Safe logits: ${pyList(safeLogits)}`);
  const naiveSafe = softmaxNaive(safeLogits);
  const stableSafe = softmaxStable(safeLogits);
  console.log(`  Naive:  ${pyStrList(naiveSafe.map((p) => fmtF(p, 6)))}`);
  console.log(`  Stable: ${pyStrList(stableSafe.map((p) => fmtF(p, 6)))}`);
  const match = naiveSafe.every((a, i) => Math.abs(a - stableSafe[i]!) < 1e-10);
  console.log(`  Match: ${pyBool(match)}`);

  const moderateLogits = [100.0, 101.0, 102.0];
  console.log(`\n  Moderate logits: ${pyList(moderateLogits)}`);
  const stableModerate = softmaxStable(moderateLogits);
  console.log(`  Stable: ${pyStrList(stableModerate.map((p) => fmtF(p, 6)))}`);
  try {
    const naiveModerate = softmaxNaive(moderateLogits);
    console.log(`  Naive:  ${pyStrList(naiveModerate.map((p) => fmtF(p, 6)))}`);
  } catch (error) {
    if (!(error instanceof OverflowError)) throw error;
    console.log("  Naive:  OVERFLOW (exp(100) too large)");
  }

  const extremeLogits = [1000.0, 1001.0, 1002.0];
  console.log(`\n  Extreme logits: ${pyList(extremeLogits)}`);
  const stableExtreme = softmaxStable(extremeLogits);
  console.log(`  Stable: ${pyStrList(stableExtreme.map((p) => fmtF(p, 6)))}`);
  console.log("  Naive:  would be [nan, nan, nan] or OVERFLOW");

  const negativeLogits = [-1000.0, -999.0, -998.0];
  console.log(`\n  Very negative logits: ${pyList(negativeLogits)}`);
  const stableNegative = softmaxStable(negativeLogits);
  console.log(`  Stable: ${pyStrList(stableNegative.map((p) => fmtF(p, 6)))}`);
  console.log("  Naive:  would be [0/0 = nan] (all exp() underflow to 0)");
  console.log();
}

function demoLogsumexp(): void {
  banner("DEMO 5: Log-Sum-Exp Trick");

  const safe = [1.0, 2.0, 3.0];
  console.log(`\n  Safe values: ${pyList(safe)}`);
  console.log(`  Naive:  ${fmtF(logsumexpNaive(safe), 10)}`);
  console.log(`  Stable: ${fmtF(logsumexpStable(safe), 10)}`);

  const large = [500.0, 501.0, 502.0];
  console.log(`\n  Large values: ${pyList(large)}`);
  console.log(`  Stable: ${fmtF(logsumexpStable(large), 10)}`);
  try {
    const naive = logsumexpNaive(large);
    console.log(`  Naive:  ${pyRepr(naive)}`);
  } catch (error) {
    if (!(error instanceof OverflowError)) throw error;
    console.log("  Naive:  OVERFLOW");
  }

  const veryNegative = [-1000.0, -999.0, -998.0];
  console.log(`\n  Very negative values: ${pyList(veryNegative)}`);
  console.log(`  Stable: ${fmtF(logsumexpStable(veryNegative), 10)}`);

  const equal = [5.0, 5.0, 5.0];
  console.log(`\n  Equal values: ${pyList(equal)}`);
  const expected = 5.0 + Math.log(3.0);
  console.log(`  Stable:   ${fmtF(logsumexpStable(equal), 10)}`);
  console.log(`  Expected: ${fmtF(expected, 10)} (= 5.0 + ln(3))`);

  const oneDominant = [100.0, 1.0, 1.0];
  console.log(`\n  One dominant value: ${pyList(oneDominant)}`);
  console.log(`  Stable: ${fmtF(logsumexpStable(oneDominant), 10)}`);
  console.log("  ~100.0 (dominated by exp(100))");
  console.log();
}

function demoCrossEntropy(): void {
  banner("DEMO 6: Stable Cross-Entropy Loss");

  const logits = [2.0, 5.0, 1.0];
  let trueClass = 1;

  console.log(`\n  Logits: ${pyList(logits)}, true class: ${trueClass}`);
  const ceNaive = crossEntropyNaive(trueClass, logits);
  let ceStable = crossEntropyStable(trueClass, logits);
  console.log(`  Naive:  ${fmtF(ceNaive, 10)}`);
  console.log(`  Stable: ${fmtF(ceStable, 10)}`);
  console.log(`  Match:  ${pyBool(Math.abs(ceNaive - ceStable) < 1e-10)}`);

  const largeLogits = [100.0, 105.0, 99.0];
  trueClass = 1;
  console.log(`\n  Large logits: ${pyList(largeLogits)}, true class: ${trueClass}`);
  ceStable = crossEntropyStable(trueClass, largeLogits);
  console.log(`  Stable: ${fmtF(ceStable, 10)}`);
  try {
    const ceNaiveLarge = crossEntropyNaive(trueClass, largeLogits);
    console.log(`  Naive:  ${fmtF(ceNaiveLarge, 10)}`);
  } catch (error) {
    if (!(error instanceof OverflowError || error instanceof DomainError)) throw error;
    console.log("  Naive:  OVERFLOW or NaN");
  }

  const confidentLogits = [0.0, 0.0, 50.0];
  trueClass = 2;
  let ce = crossEntropyStable(trueClass, confidentLogits);
  console.log("\n  Very confident prediction:");
  console.log(`  Logits: ${pyList(confidentLogits)}, true class: ${trueClass}`);
  console.log(`  Loss: ${fmtF(ce, 10)}  (near zero, model is correct and confident)`);

  const wrongLogits = [0.0, 0.0, 50.0];
  trueClass = 0;
  ce = crossEntropyStable(trueClass, wrongLogits);
  console.log("\n  Very wrong prediction:");
  console.log(`  Logits: ${pyList(wrongLogits)}, true class: ${trueClass}`);
  console.log(`  Loss: ${fmtF(ce, 4)}  (very large, model is confident but wrong)`);
  console.log();
}

function demoSigmoidStability(): void {
  banner("DEMO 7: Stable Sigmoid");

  const testValues = [0.0, 1.0, -1.0, 10.0, -10.0, 100.0, -100.0, 500.0, -500.0, 710.0, -710.0];
  console.log(`\n  ${"x".padStart(8)}  ${"naive".padStart(14)}  ${"stable".padStart(14)}`);
  console.log(`  ${"-".repeat(8)}  ${"-".repeat(14)}  ${"-".repeat(14)}`);
  for (const x of testValues) {
    let naiveText: string;
    try {
      naiveText = fmtF(sigmoidNaive(x), 10);
    } catch (error) {
      if (!(error instanceof OverflowError)) throw error;
      naiveText = "OVERFLOW";
    }
    const stable = sigmoidStable(x);
    console.log(`  ${fmtF(x, 1).padStart(8)}  ${naiveText.padStart(14)}  ${fmtF(stable, 10)}`);
  }
  console.log();
}

function demoGradientChecking(): void {
  banner("DEMO 8: Gradient Checking");

  console.log("\n  Test 1: f(x,y) = x^2 + 3xy + y^3");

  const f1 = (params: number[]): number => {
    const [x, y] = params as [number, number];
    return x ** 2 + 3 * x * y + y ** 3;
  };

  const f1Grad = (params: number[]): number[] => {
    const [x, y] = params as [number, number];
    return [2 * x + 3 * y, 3 * x + 3 * y ** 2];
  };

  const point = [2.0, 1.0];
  const analytical = f1Grad(point);
  const numerical = numericalGradient(f1, point);
  console.log(`  Point: ${pyList(point)}`);
  checkGradient(analytical, numerical);

  console.log("\n  Test 2: f(x) = softmax cross-entropy");

  const f2 = (logits: number[]): number => crossEntropyStable(0, logits);

  const logits = [2.0, 1.0, 0.5];
  const probs = softmaxStable(logits);
  const analyticalCe = probs.map((p, i) => p - (i === 0 ? 1.0 : 0.0));
  const numericalCe = numericalGradient(f2, logits);
  console.log(`  Logits: ${pyList(logits)}`);
  checkGradient(analyticalCe, numericalCe);

  console.log("\n  Test 3: Deliberately wrong gradient (should FAIL)");

  const f3 = (params: number[]): number => {
    const [x, y] = params as [number, number];
    return x ** 2 + y ** 2;
  };

  const wrongGrad = [1.0, 1.0];
  const numericalF3 = numericalGradient(f3, [3.0, 4.0]);
  console.log(`  Wrong analytical: ${pyList(wrongGrad)}`);
  console.log(`  Correct numerical: ${pyStrList(numericalF3.map((g) => fmtF(g, 4)))}`);
  checkGradient(wrongGrad, numericalF3);
  console.log();
}

function demoNanInf(): void {
  banner("DEMO 9: NaN and Inf Detection and Propagation");

  console.log("\n  How inf appears:");
  console.log(`  1.0 / 0.0    = ${pyRepr(Infinity)}`);
  console.log("  exp(710)     = overflow -> inf");
  console.log(`  1e308 * 10   = ${pyRepr(1e308 * 10)}`);

  console.log("\n  How nan appears:");
  console.log(`  0.0 / 0.0        = ${pyRepr(NaN)}`);
  console.log(`  inf - inf        = ${pyRepr(Infinity - Infinity)}`);
  console.log(`  inf * 0          = ${pyRepr(Infinity * 0)}`);
  console.log(`  nan + 1          = ${pyRepr(NaN + 1)}`);
  console.log(`  nan == nan       = ${pyBool(Number.NaN === Number.NaN)}`);
  console.log(`  nan < 0          = ${pyBool(Number.NaN < 0)}`);
  console.log(`  nan > 0          = ${pyBool(Number.NaN > 0)}`);

  console.log("\n  NaN propagation (one nan ruins everything):");
  const values = [1.0, 2.0, NaN, 4.0, 5.0];
  console.log(`  values = ${pyList(values)}`);
  console.log(`  sum    = ${pyRepr(sum(values))}`);
  console.log("  max    = nan (comparison with nan is always False)");
  console.log(`  mean   = ${pyRepr(sum(values) / values.length)}`);

  console.log("\n  Tensor health checks:");
  checkTensor("weights", [0.1, -0.3, 0.5, 0.2]);
  checkTensor("logits_bad", [1.0, Infinity, -2.0]);
  checkTensor("grads_bad", [0.01, NaN, -0.03]);
  checkTensor("activations", [0.0, 0.5, 1.0, 0.3]);
  console.log();
}

function demoGradientClipping(): void {
  banner("DEMO 10: Gradient Clipping");

  const grads = [10.0, 20.0, 30.0];
  const norm = Math.sqrt(sum(grads.map((g) => g ** 2)));

  console.log(`\n  Gradients: ${pyList(grads)}`);
  console.log(`  Norm: ${fmtF(norm, 4)}`);

  const clippedVal = clipByValue(grads, 15.0);
  const clippedNorm = clipByNorm(grads, 5.0);

  console.log(`\n  Clip by value (max=15.0): ${pyList(clippedVal)}`);
  console.log(
    "  Clip by value changes direction: " +
      `${pyList(grads.map((g) => g / grads[0]!))} vs ${pyList(clippedVal.map((g) => g / clippedVal[0]!))}`,
  );

  console.log(`\n  Clip by norm (max=5.0): ${pyStrList(clippedNorm.map((g) => fmtF(g, 4)))}`);
  const clippedNormVal = Math.sqrt(sum(clippedNorm.map((g) => g ** 2)));
  console.log(`  Clipped norm: ${fmtF(clippedNormVal, 4)}`);
  console.log(
    "  Direction preserved: " +
      `${pyList(grads.map((g) => roundTo(g / grads[0]!, 4)))} == ` +
      `${pyList(clippedNorm.map((g) => roundTo(g / clippedNorm[0]!, 4)))}`,
  );

  console.log("\n  Gradient explosion simulation:");
  let gradVal = 1.0;
  const maxNorm = 1.0;
  for (let step = 0; step < 8; step++) {
    gradVal *= 3.5;
    const clipped = clipByNorm([gradVal], maxNorm)[0]!;
    console.log(`  Step ${step}: raw_grad=${fmtF(gradVal, 2).padStart(12)}  clipped=${fmtF(clipped, 4).padStart(8)}`);
  }
  console.log();
}

function demoMixedPrecision(): void {
  banner("DEMO 11: Mixed Precision and Loss Scaling");

  console.log("\n  bfloat16 vs float16 precision:");
  const testValues = [1.0, 0.1, 3.14159, 100.0, 65504.0, 65536.0, 100000.0];
  console.log(`  ${"value".padStart(12)}  ${"float16".padStart(12)}  ${"bfloat16".padStart(12)}`);
  console.log(`  ${"-".repeat(12)}  ${"-".repeat(12)}  ${"-".repeat(12)}`);
  for (const v of testValues) {
    const f16 = simulateFloat16(v);
    const bf16 = simulateBfloat16(v);
    const f16Text = Number.isFinite(f16) ? fmtF(f16, 4) : "inf";
    const bf16Text = Number.isFinite(bf16) ? fmtF(bf16, 4) : "inf";
    console.log(`  ${fmtF(v, 4).padStart(12)}  ${f16Text.padStart(12)}  ${bf16Text.padStart(12)}`);
  }

  console.log("\n  Loss scaling simulation:");
  const rng = new SeededRandom(42);
  const nGrads = 1000;
  const tinyGrads: number[] = [];
  for (let i = 0; i < nGrads; i++) {
    tinyGrads.push(rng.uniform(1e-9, 1e-5));
  }

  const zerosWithoutScaling = tinyGrads.filter((g) => simulateFloat16(g) === 0.0).length;

  const scale = 1024.0;
  const scaledGrads = tinyGrads.map((g) => g * scale);
  const zerosWithScaling = scaledGrads.filter((g) => simulateFloat16(g) === 0.0).length;

  const scaledBack = tinyGrads.map((g) => simulateFloat16(g * scale) / scale);
  const zerosAfterRoundtrip = scaledBack.filter((g) => g === 0.0).length;

  console.log(`  ${nGrads} gradients in range [1e-9, 1e-5]`);
  console.log(
    `  Zeros without scaling: ${zerosWithoutScaling}/${nGrads} ` +
      `(${fmtF((zerosWithoutScaling / nGrads) * 100, 1)}%)`,
  );
  console.log(
    `  Zeros with scaling (x${fmtF(scale, 0)}): ${zerosWithScaling}/${nGrads} ` +
      `(${fmtF((zerosWithScaling / nGrads) * 100, 1)}%)`,
  );
  console.log(
    `  Zeros after scale+convert+unscale: ${zerosAfterRoundtrip}/${nGrads} ` +
      `(${fmtF((zerosAfterRoundtrip / nGrads) * 100, 1)}%)`,
  );

  console.log("\n  Dynamic loss scaling simulation:");
  let scaleFactor = 65536.0;
  let noOverflowSteps = 0;
  const growthInterval = 100;

  console.log(`  ${"step".padStart(6)}  ${"scale".padStart(12)}  event`);
  for (let step = 0; step < 500; step++) {
    const grad = rng.gauss(0, 1);
    const scaled = grad * scaleFactor;
    const converted = simulateFloat16(scaled);
    if (converted === Infinity || converted === -Infinity) {
      scaleFactor /= 2;
      noOverflowSteps = 0;
      if (step < 20 || step % 100 === 0) {
        console.log(`  ${String(step).padStart(6)}  ${fmtF(scaleFactor, 0).padStart(12)}  overflow -> halved`);
      }
    } else {
      noOverflowSteps += 1;
      if (noOverflowSteps >= growthInterval) {
        scaleFactor *= 2;
        noOverflowSteps = 0;
        if (step < 100 || step % 100 === 0) {
          console.log(`  ${String(step).padStart(6)}  ${fmtF(scaleFactor, 0).padStart(12)}  stable -> doubled`);
        }
      }
    }
  }
  console.log(`  Final scale factor: ${fmtF(scaleFactor, 0)}`);
  console.log();
}

function demoLayerNorm(): void {
  banner("DEMO 12: Normalization as Numerical Stabilizer");

  console.log("\n  Without normalization (values grow through layers):");
  let values = [1.0, 0.5, -0.3, 0.8, -0.1];
  for (let layer = 0; layer < 10; layer++) {
    values = values.map((v) => Math.max(0, v * 2.5 + 0.1));
    const maxVal = Math.max(...values.map((v) => Math.abs(v)));
    if (layer % 2 === 0) {
      const preview = pyStrList(values.slice(0, 3).map((v) => fmtF(v, 2)));
      console.log(`  Layer ${String(layer).padStart(2)}: max=${fmtF(maxVal, 2).padStart(12)}  values=${preview}...`);
    }
  }

  console.log("\n  With layer normalization (values stay bounded):");
  values = [1.0, 0.5, -0.3, 0.8, -0.1];
  for (let layer = 0; layer < 10; layer++) {
    values = values.map((v) => Math.max(0, v * 2.5 + 0.1));
    values = layerNorm(values);
    const maxVal = Math.max(...values.map((v) => Math.abs(v)));
    if (layer % 2 === 0) {
      const preview = pyStrList(values.slice(0, 3).map((v) => fmtF(v, 4)));
      console.log(`  Layer ${String(layer).padStart(2)}: max=${fmtF(maxVal, 4).padStart(6)}  values=${preview}...`);
    }
  }
  console.log();
}

function demoCommonBugs(): void {
  banner("DEMO 13: Common ML Numerical Bugs");

  console.log("\n  Bug 1: log(0) from confident wrong prediction");
  let logits = [500.0, -500.0, -500.0];
  const probs = softmaxStable(logits);
  console.log(`  Softmax: ${pyStrList(probs.map((p) => fmtE(p, 2)))}`);
  let line = `  If true class is 1: log(${fmtE(probs[1]!, 2)}) = `;
  if (probs[1] === 0.0) {
    line += "log(0) = -inf (CRASH)";
  } else {
    line += fmtF(log(probs[1]!), 2);
  }
  console.log(line);
  console.log(`  Stable cross-entropy handles this: ${fmtF(crossEntropyStable(1, logits), 4)}`);

  console.log("\n  Bug 2: exp() overflow in naive softmax");
  logits = [800.0, 801.0, 802.0];
  try {
    const naive = softmaxNaive(logits);
    console.log(`  Naive softmax: ${pyList(naive)}`);
  } catch (error) {
    if (!(error instanceof OverflowError)) throw error;
    console.log("  Naive softmax: OverflowError (exp(800) is too large)");
  }
  const stable = softmaxStable(logits);
  console.log(`  Stable softmax: ${pyStrList(stable.map((p) => fmtF(p, 6)))}`);

  console.log("\n  Bug 3: Variance underflow with large-mean data");
  const data = [1e8 + 1, 1e8 + 2, 1e8 + 3, 1e8 + 4, 1e8 + 5];
  const varNaive = varianceNaive(data);
  const varWelford = welfordVariance(data);
  const trueVar = 2.0;
  console.log(`  Data: [${fmtF(data[0]!, 0)}, ..., ${fmtF(data[data.length - 1]!, 0)}]`);
  console.log(`  True variance: ${pyRepr(trueVar)}`);
  console.log(`  Naive:   ${fmtF(varNaive, 6)}  (error: ${fmtE(Math.abs(varNaive - trueVar), 2)})`);
  console.log(`  Welford: ${fmtF(varWelford, 6)}  (error: ${fmtE(Math.abs(varWelford - trueVar), 2)})`);

  console.log("\n  Bug 4: Float comparison in training loop");
  let loss = 0.0;
  for (let i = 0; i < 10; i++) {
    loss += 0.1;
  }
  console.log(`  After 10 steps of loss += 0.1: loss = ${pyRepr(loss)}`);
  console.log(`  loss == 1.0? ${pyBool(loss === 1.0)} (WRONG)`);
  console.log(`  math.isclose(loss, 1.0)? ${pyBool(isClose(loss, 1.0))} (CORRECT)`);

  console.log("\n  Bug 5: NaN from 0/0 in normalization");
  const constant = [5.0, 5.0, 5.0, 5.0];
  const mean = sum(constant) / constant.length;
  const variance = sum(constant.map((v) => (v - mean) ** 2)) / constant.length;
  console.log(`  Constant input: ${pyList(constant)}`);
  console.log(`  Variance: ${pyRepr(variance)}`);
  line = "  1/sqrt(var) = 1/sqrt(0) = ";
  try {
    const result = divide(1.0, Math.sqrt(variance));
    line += pyRepr(result);
  } catch (error) {
    if (!(error instanceof ZeroDivisionError)) throw error;
    line += "ZeroDivisionError";
  }
  console.log(line);
  const safe = 1.0 / Math.sqrt(variance + 1e-5);
  console.log(`  1/sqrt(var + 1e-5) = ${fmtF(safe, 2)} (safe with epsilon)`);
  console.log();
}

function demoFormatComparison(): void {
  banner("DEMO 14: Float Format Comparison Summary");

  console.log(`
  Format     Bits  Exp  Mantissa  ~Digits  Max Value       Best For
  -------    ----  ---  --------  -------  ----------      --------
  float64    64    11   52        15-16    1.8e308         CPU training, accumulation
  float32    32    8    23        7-8      3.4e38          Default training
  float16    16    5    10        3-4      65,504          Inference
  bfloat16   16    8    7         2-3      3.4e38          GPU/TPU training
  float8     8     4    3         1-2      240             Forward pass only (H100+)
`);

  console.log("  Precision test (representing pi):");
  const pi = Math.PI;
  const f16Pi = simulateFloat16(pi);
  const bf16Pi = simulateBfloat16(pi);
  console.log(`  float64:  ${pyRepr(pi)}`);
  console.log(`  float16:  ${pyRepr(f16Pi)}  (error: ${fmtF(Math.abs(f16Pi - pi), 6)})`);
  console.log(`  bfloat16: ${pyRepr(bf16Pi)}  (error: ${fmtF(Math.abs(bf16Pi - pi), 6)})`);

  console.log("\n  Range test (large values):");
  for (const val of [100.0, 1000.0, 10000.0, 65504.0, 100000.0]) {
    const f16 = simulateFloat16(val);
    const bf16 = simulateBfloat16(val);
    const f16Ok = Number.isFinite(f16) ? "ok" : "INF";
    const bf16Ok = Number.isFinite(bf16) ? "ok" : "INF";
    console.log(`  ${fmtF(val, 0).padStart(10)}  float16=${f16Ok.padStart(4)}  bfloat16=${bf16Ok.padStart(4)}`);
  }
  console.log();
}

demoFloatPrecision();
demoCatastrophicCancellation();
demoOverflowUnderflow();
demoSoftmaxStability();
demoLogsumexp();
demoCrossEntropy();
demoSigmoidStability();
demoGradientChecking();
demoNanInf();
demoGradientClipping();
demoMixedPrecision();
demoLayerNorm();
demoCommonBugs();
demoFormatComparison();
console.log("All demos complete.");
