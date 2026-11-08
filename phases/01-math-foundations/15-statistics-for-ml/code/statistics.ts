// Lesson: Statistics for Machine Learning (phase 01 / lesson 15)
// TypeScript port of code/statistics.py. Node standard library only.
// Source: phases/01-math-foundations/15-statistics-for-ml/docs/en.md
// Run: npx tsx phases/01-math-foundations/15-statistics-for-ml/code/statistics.ts
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

const random = mulberry32(100);

function randomInt(low: number, high: number): number {
  return low + Math.floor(random() * (high - low + 1));
}

function gauss(mu: number, sigma: number): number {
  let u1 = random();
  while (u1 === 0) {
    u1 = random();
  }
  const u2 = random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + sigma * z;
}

function lgamma(x: number): number {
  const coefficients = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  }
  const shifted = x - 1;
  let series = coefficients[0]!;
  for (let i = 1; i < coefficients.length; i++) {
    series += coefficients[i]! / (shifted + i);
  }
  const t = shifted + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(series);
}

function sum(values: number[]): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
}

function pyBool(value: boolean): string {
  return value ? "True" : "False";
}

function formatList(values: number[]): string {
  return `[${values.join(", ")}]`;
}

function mean(data: number[]): number {
  return sum(data) / data.length;
}

function median(data: number[]): number {
  const s = [...data].sort((a, b) => a - b);
  const n = s.length;
  const mid = Math.floor(n / 2);
  if (n % 2 === 0) {
    return (s[mid - 1]! + s[mid]!) / 2;
  }
  return s[mid]!;
}

function mode(data: number[]): number {
  const counts = new Map<number, number>();
  for (const x of data) {
    counts.set(x, (counts.get(x) ?? 0) + 1);
  }
  const maxCount = Math.max(...counts.values());
  const modes: number[] = [];
  for (const [value, count] of counts) {
    if (count === maxCount) {
      modes.push(value);
    }
  }
  modes.sort((a, b) => a - b);
  return modes[0]!;
}

function variance(data: number[], sample = true): number {
  const n = data.length;
  const m = mean(data);
  let total = 0;
  for (const x of data) {
    total += (x - m) ** 2;
  }
  if (sample && n > 1) {
    return total / (n - 1);
  }
  return total / n;
}

function stdDev(data: number[], sample = true): number {
  return Math.sqrt(variance(data, sample));
}

function percentile(data: number[], p: number): number {
  const s = [...data].sort((a, b) => a - b);
  const n = s.length;
  const k = (p / 100) * (n - 1);
  const f = Math.floor(k);
  const c = Math.ceil(k);
  if (f === c) {
    return s[Math.trunc(k)]!;
  }
  return s[f]! * (c - k) + s[c]! * (k - f);
}

function iqr(data: number[]): number {
  return percentile(data, 75) - percentile(data, 25);
}

function covariance(x: number[], y: number[], sample = true): number {
  const n = x.length;
  const mx = mean(x);
  const my = mean(y);
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += (x[i]! - mx) * (y[i]! - my);
  }
  if (sample && n > 1) {
    return total / (n - 1);
  }
  return total / n;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const mx = mean(x);
  const my = mean(y);
  const sx = stdDev(x, false);
  const sy = stdDev(y, false);
  if (sx === 0 || sy === 0) {
    return 0.0;
  }
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += (x[i]! - mx) * (y[i]! - my);
  }
  const cov = total / n;
  return cov / (sx * sy);
}

function rankData(data: number[]): number[] {
  const indexed = data.map((value, index) => ({ index, value }));
  indexed.sort((a, b) => a.value - b.value);
  const ranks = new Array<number>(data.length).fill(0);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length - 1 && indexed[j + 1]!.value === indexed[i]!.value) {
      j += 1;
    }
    const avgRank = (i + j) / 2.0 + 1.0;
    for (let k = i; k <= j; k++) {
      ranks[indexed[k]!.index] = avgRank;
    }
    i = j + 1;
  }
  return ranks;
}

function spearmanCorrelation(x: number[], y: number[]): number {
  const rx = rankData(x);
  const ry = rankData(y);
  return pearsonCorrelation(rx, ry);
}

function covarianceMatrix(data: number[][]): number[][] {
  const d = data.length;
  const n = data[0]!.length;
  const means = data.map((row) => mean(row));
  const matrix: number[][] = [];
  for (let i = 0; i < d; i++) {
    matrix.push(new Array<number>(d).fill(0.0));
  }
  for (let i = 0; i < d; i++) {
    for (let j = i; j < d; j++) {
      let total = 0;
      for (let k = 0; k < n; k++) {
        total += (data[i]![k]! - means[i]!) * (data[j]![k]! - means[j]!);
      }
      const cov = total / (n - 1);
      matrix[i]![j] = cov;
      matrix[j]![i] = cov;
    }
  }
  return matrix;
}

function tStatisticOneSample(data: number[], mu0: number): number {
  const n = data.length;
  const m = mean(data);
  const s = stdDev(data, true);
  return (m - mu0) / (s / Math.sqrt(n));
}

function tStatisticTwoSample(data1: number[], data2: number[]): number {
  const n1 = data1.length;
  const n2 = data2.length;
  const m1 = mean(data1);
  const m2 = mean(data2);
  const v1 = variance(data1, true);
  const v2 = variance(data2, true);
  const se = Math.sqrt(v1 / n1 + v2 / n2);
  if (se === 0) {
    throw new Error("both samples have zero variance, so the t statistic is undefined");
  }
  return (m1 - m2) / se;
}

function welchDf(data1: number[], data2: number[]): number {
  const n1 = data1.length;
  const n2 = data2.length;
  const v1 = variance(data1, true);
  const v2 = variance(data2, true);
  const num = (v1 / n1 + v2 / n2) ** 2;
  const denom = (v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1);
  if (denom === 0) {
    return n1 + n2 - 2;
  }
  return num / denom;
}

function tCdfApprox(tVal: number, df: number): number {
  const x = df / (df + tVal * tVal);
  if (tVal < 0) {
    return 0.5 * regularizedBeta(x, df / 2, 0.5);
  }
  return 1.0 - 0.5 * regularizedBeta(x, df / 2, 0.5);
}

function regularizedBeta(x: number, a: number, b: number): number {
  if (x <= 0) {
    return 0.0;
  }
  if (x >= 1) {
    return 1.0;
  }
  const front = Math.exp(a * Math.log(x) + b * Math.log(1.0 - x) - logBetaFunction(a, b));
  if (x < (a + 1.0) / (a + b + 2.0)) {
    return (front * betaContinuedFraction(x, a, b)) / a;
  }
  return 1.0 - (front * betaContinuedFraction(1.0 - x, b, a)) / b;
}

function betaContinuedFraction(x: number, a: number, b: number, maxIter = 300, tol = 1e-15): number {
  const tiny = 1e-300;
  const qab = a + b;
  const qap = a + 1.0;
  const qam = a - 1.0;
  let c = 1.0;
  let d = 1.0 - (qab * x) / qap;
  if (Math.abs(d) < tiny) {
    d = tiny;
  }
  d = 1.0 / d;
  let h = d;
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let num = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1.0 + num * d;
    if (Math.abs(d) < tiny) {
      d = tiny;
    }
    c = 1.0 + num / c;
    if (Math.abs(c) < tiny) {
      c = tiny;
    }
    d = 1.0 / d;
    h *= d * c;
    num = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1.0 + num * d;
    if (Math.abs(d) < tiny) {
      d = tiny;
    }
    c = 1.0 + num / c;
    if (Math.abs(c) < tiny) {
      c = tiny;
    }
    d = 1.0 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1.0) < tol) {
      break;
    }
  }
  return h;
}

function logBetaFunction(a: number, b: number): number {
  return lgamma(a) + lgamma(b) - lgamma(a + b);
}

function betaFunction(a: number, b: number): number {
  return Math.exp(logBetaFunction(a, b));
}

function pValueTwoSided(tVal: number, df: number): number {
  const pLeft = tCdfApprox(Math.abs(tVal), df);
  return 2.0 * (1.0 - pLeft);
}

type TTestResult = { tStatistic: number; df: number; pValue: number };

function oneSampleTtest(data: number[], mu0 = 0): TTestResult {
  const n = data.length;
  const t = tStatisticOneSample(data, mu0);
  const df = n - 1;
  const p = pValueTwoSided(t, df);
  return { tStatistic: t, df, pValue: p };
}

function twoSampleTtest(data1: number[], data2: number[]): TTestResult {
  const t = tStatisticTwoSample(data1, data2);
  const df = welchDf(data1, data2);
  const p = pValueTwoSided(t, df);
  return { tStatistic: t, df, pValue: p };
}

function pairedTtest(data1: number[], data2: number[]): TTestResult {
  const diffs = data1.map((a, i) => a - data2[i]!);
  return oneSampleTtest(diffs, 0);
}

type ChiSquaredResult = { chi2: number; df: number; pValue: number };

function chiSquaredTest(observed: number[], expected: number[]): ChiSquaredResult {
  let chi2 = 0;
  for (let i = 0; i < observed.length; i++) {
    const o = observed[i]!;
    const e = expected[i]!;
    if (e > 0) {
      chi2 += (o - e) ** 2 / e;
    }
  }
  const df = observed.length - 1;
  const p = chiSquaredPValue(chi2, df);
  return { chi2, df, pValue: p };
}

function chiSquaredPValue(chi2: number, df: number): number {
  if (chi2 <= 0) {
    return 1.0;
  }
  return 1.0 - lowerIncompleteGammaRatio(df / 2.0, chi2 / 2.0);
}

function lowerIncompleteGammaRatio(a: number, x: number): number {
  if (x <= 0) {
    return 0.0;
  }
  if (x < a + 1.0) {
    return gammaSeries(a, x);
  }
  return 1.0 - gammaContinuedFraction(a, x);
}

function gammaSeries(a: number, x: number, maxIter = 1000, tol = 1e-16): number {
  let term = 1.0 / a;
  let total = term;
  let ap = a;
  for (let i = 0; i < maxIter; i++) {
    ap += 1.0;
    term *= x / ap;
    total += term;
    if (Math.abs(term) < Math.abs(total) * tol) {
      break;
    }
  }
  return total * Math.exp(-x + a * Math.log(x) - lgamma(a));
}

function gammaContinuedFraction(a: number, x: number, maxIter = 1000, tol = 1e-16): number {
  const tiny = 1e-300;
  let b = x + 1.0 - a;
  let c = 1.0 / tiny;
  let d = 1.0 / b;
  let h = d;
  for (let i = 1; i <= maxIter; i++) {
    const an = -i * (i - a);
    b += 2.0;
    d = an * d + b;
    if (Math.abs(d) < tiny) {
      d = tiny;
    }
    c = b + an / c;
    if (Math.abs(c) < tiny) {
      c = tiny;
    }
    d = 1.0 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1.0) < tol) {
      break;
    }
  }
  return h * Math.exp(-x + a * Math.log(x) - lgamma(a));
}

type BootstrapResult = {
  estimate: number;
  ciLower: number;
  ciUpper: number;
  ciLevel: number;
  nBootstrap: number;
  stdError: number;
};

function resample(data: number[]): number[] {
  const n = data.length;
  const sample: number[] = [];
  for (let i = 0; i < n; i++) {
    sample.push(data[randomInt(0, n - 1)]!);
  }
  return sample;
}

function bootstrapStatistic(
  data: number[],
  statFunc: (values: number[]) => number,
  nBootstrap = 5000,
  ci = 95,
): BootstrapResult {
  const bootstrapStats: number[] = [];
  for (let i = 0; i < nBootstrap; i++) {
    bootstrapStats.push(statFunc(resample(data)));
  }
  bootstrapStats.sort((a, b) => a - b);
  const lowerPct = (100 - ci) / 2;
  const upperPct = 100 - lowerPct;
  return {
    estimate: statFunc(data),
    ciLower: percentile(bootstrapStats, lowerPct),
    ciUpper: percentile(bootstrapStats, upperPct),
    ciLevel: ci,
    nBootstrap,
    stdError: stdDev(bootstrapStats, true),
  };
}

type BootstrapCompareResult = {
  observedDiff: number;
  ciLower: number;
  ciUpper: number;
  significant: boolean;
  ciLevel: number;
};

function bootstrapCompare(
  data1: number[],
  data2: number[],
  statFunc: (values: number[]) => number,
  nBootstrap = 5000,
  ci = 95,
): BootstrapCompareResult {
  const diffs: number[] = [];
  for (let i = 0; i < nBootstrap; i++) {
    const s1 = resample(data1);
    const s2 = resample(data2);
    diffs.push(statFunc(s2) - statFunc(s1));
  }
  diffs.sort((a, b) => a - b);
  const lowerPct = (100 - ci) / 2;
  const upperPct = 100 - lowerPct;
  const ciLower = percentile(diffs, lowerPct);
  const ciUpper = percentile(diffs, upperPct);
  const observedDiff = statFunc(data2) - statFunc(data1);
  const significant = ciLower > 0 || ciUpper < 0;
  return { observedDiff, ciLower, ciUpper, significant, ciLevel: ci };
}

function cohensD(data1: number[], data2: number[]): number {
  const m1 = mean(data1);
  const m2 = mean(data2);
  const n1 = data1.length;
  const n2 = data2.length;
  const v1 = variance(data1, true);
  const v2 = variance(data2, true);
  const pooled = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
  if (pooled === 0) {
    return 0.0;
  }
  return (m1 - m2) / pooled;
}

function interpretCohensD(d: number): string {
  const size = Math.abs(d);
  if (size < 0.2) {
    return "negligible";
  }
  if (size < 0.5) {
    return "small";
  }
  if (size < 0.8) {
    return "medium";
  }
  return "large";
}

type BonferroniResult = { originalP: number; adjustedAlpha: number; significant: boolean };

function bonferroniCorrection(pValues: number[], alpha = 0.05): BonferroniResult[] {
  const m = pValues.length;
  const adjustedAlpha = alpha / m;
  const results: BonferroniResult[] = [];
  for (const p of pValues) {
    results.push({ originalP: p, adjustedAlpha, significant: p < adjustedAlpha });
  }
  return results;
}

function generateNormal(n: number, mu = 0, sigma = 1): number[] {
  const samples: number[] = [];
  for (let i = 0; i < Math.floor(n / 2) + 1; i++) {
    let u1 = random();
    const u2 = random();
    while (u1 === 0) {
      u1 = random();
    }
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const z1 = Math.sqrt(-2 * Math.log(u1)) * Math.sin(2 * Math.PI * u2);
    samples.push(mu + sigma * z0);
    samples.push(mu + sigma * z1);
  }
  return samples.slice(0, n);
}

type AbTestResult = {
  groupAMean: number;
  groupBMean: number;
  observedDiff: number;
  trueEffect: number;
  tTest: TTestResult;
  cohensD: number;
  effectInterpretation: string;
  bootstrap: BootstrapCompareResult;
  significantTtest: boolean;
  significantBootstrap: boolean;
};

function abTestSimulator(
  nPerGroup = 100,
  trueEffect = 0.0,
  baseMean = 50,
  baseStd = 10,
  alpha = 0.05,
): AbTestResult {
  const groupA = generateNormal(nPerGroup, baseMean, baseStd);
  const groupB = generateNormal(nPerGroup, baseMean + trueEffect, baseStd);

  const result = twoSampleTtest(groupA, groupB);
  const d = cohensD(groupA, groupB);
  const boot = bootstrapCompare(groupA, groupB, mean, 2000);

  return {
    groupAMean: mean(groupA),
    groupBMean: mean(groupB),
    observedDiff: mean(groupB) - mean(groupA),
    trueEffect,
    tTest: result,
    cohensD: d,
    effectInterpretation: interpretCohensD(d),
    bootstrap: boot,
    significantTtest: result.pValue < alpha,
    significantBootstrap: boot.significant,
  };
}

type MultipleTestsResult = {
  nTests: number;
  trueEffect: number;
  falsePositiveRate: number | null;
  uncorrectedSignificant: number;
  correctedSignificant: number;
  pValues: number[];
};

function runMultipleAbTests(
  nTests = 20,
  nPerGroup = 100,
  trueEffect = 0.0,
  alpha = 0.05,
): MultipleTestsResult {
  const pValues: number[] = [];
  let significantCount = 0;
  for (let i = 0; i < nTests; i++) {
    const groupA = generateNormal(nPerGroup, 50, 10);
    const groupB = generateNormal(nPerGroup, 50 + trueEffect, 10);
    const result = twoSampleTtest(groupA, groupB);
    pValues.push(result.pValue);
    if (result.pValue < alpha) {
      significantCount += 1;
    }
  }

  const corrected = bonferroniCorrection(pValues, alpha);
  const correctedSignificant = corrected.filter((r) => r.significant).length;

  return {
    nTests,
    trueEffect,
    falsePositiveRate: trueEffect === 0 ? significantCount / nTests : null,
    uncorrectedSignificant: significantCount,
    correctedSignificant,
    pValues,
  };
}

type SampleSummary = {
  n: number;
  pValue: number;
  cohensD: number;
  significant: boolean;
  interpretation: string;
};

function summarizeSample(n: number, effect: number): SampleSummary {
  const groupA = generateNormal(n, 50, 10);
  const groupB = generateNormal(n, 50 + effect, 10);
  const result = twoSampleTtest(groupA, groupB);
  const d = cohensD(groupA, groupB);
  return {
    n,
    pValue: result.pValue,
    cohensD: d,
    significant: result.pValue < 0.05,
    interpretation: interpretCohensD(d),
  };
}

function statisticalVsPracticalSignificance(
  smallN = 30,
  largeN = 100000,
  effect = 0.1,
): { smallSample: SampleSummary; largeSample: SampleSummary; trueEffect: number } {
  const smallSample = summarizeSample(smallN, effect);
  const largeSample = summarizeSample(largeN, effect);
  return { smallSample, largeSample, trueEffect: effect };
}

function banner(title: string): void {
  console.log("=".repeat(60));
  console.log(title);
  console.log("=".repeat(60));
}

function main(): void {
  banner("DESCRIPTIVE STATISTICS");
  let data = [23, 45, 12, 67, 34, 89, 21, 56, 43, 78, 31, 64, 19, 52, 41];
  console.log(`Data: ${formatList(data)}`);
  console.log(`Mean:     ${mean(data).toFixed(2)}`);
  console.log(`Median:   ${median(data).toFixed(2)}`);
  console.log(`Mode:     ${mode(data)}`);
  console.log(`Std Dev:  ${stdDev(data).toFixed(2)}`);
  console.log(`Variance: ${variance(data).toFixed(2)}`);
  console.log(`P25:      ${percentile(data, 25).toFixed(2)}`);
  console.log(`P50:      ${percentile(data, 50).toFixed(2)}`);
  console.log(`P75:      ${percentile(data, 75).toFixed(2)}`);
  console.log(`IQR:      ${iqr(data).toFixed(2)}`);

  const skewed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1000];
  console.log(`\nSkewed data: ${formatList(skewed)}`);
  console.log(`Mean:   ${mean(skewed).toFixed(2)}  (pulled by outlier)`);
  console.log(`Median: ${median(skewed).toFixed(2)}  (robust to outlier)`);

  console.log("");
  banner("CORRELATION");
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const yLinear = [2.1, 3.9, 6.2, 7.8, 10.1, 12.3, 13.8, 16.1, 18.0, 20.2];
  console.log("Linear relationship:");
  console.log(`  Pearson:  ${pearsonCorrelation(x, yLinear).toFixed(4)}`);
  console.log(`  Spearman: ${spearmanCorrelation(x, yLinear).toFixed(4)}`);

  const yQuadratic = x.map((xi) => xi ** 2);
  console.log("Quadratic relationship (y = x^2):");
  console.log(`  Pearson:  ${pearsonCorrelation(x, yQuadratic).toFixed(4)}  (not perfect, relationship is nonlinear)`);
  console.log(`  Spearman: ${spearmanCorrelation(x, yQuadratic).toFixed(4)}  (perfect, relationship is monotonic)`);

  const yNone = x.map(() => gauss(0, 1));
  console.log("No relationship (random):");
  console.log(`  Pearson:  ${pearsonCorrelation(x, yNone).toFixed(4)}`);
  console.log(`  Spearman: ${spearmanCorrelation(x, yNone).toFixed(4)}`);

  console.log("");
  banner("COVARIANCE MATRIX");
  const feature1: number[] = [];
  for (let i = 0; i < 100; i++) {
    feature1.push(gauss(0, 1));
  }
  const feature2 = feature1.map((f) => f + gauss(0, 0.5));
  const feature3: number[] = [];
  for (let i = 0; i < 100; i++) {
    feature3.push(gauss(0, 1));
  }
  const covMat = covarianceMatrix([feature1, feature2, feature3]);
  console.log("3-feature covariance matrix:");
  for (const row of covMat) {
    const cells = row.map((value) => value.toFixed(3).padStart(7));
    console.log(`  [${cells.join("  ")}]`);
  }
  console.log("Feature 1 and 2 are correlated (constructed that way).");
  console.log("Feature 3 is independent.");

  console.log("");
  banner("HYPOTHESIS TESTING: ONE-SAMPLE T-TEST");
  const sample = generateNormal(50, 52, 10);
  let result = oneSampleTtest(sample, 50);
  console.log("Testing if population mean = 50 (true mean = 52)");
  console.log(`  Sample mean: ${mean(sample).toFixed(2)}`);
  console.log(`  t-statistic: ${result.tStatistic.toFixed(4)}`);
  console.log(`  df:          ${result.df}`);
  console.log(`  p-value:     ${result.pValue.toFixed(4)}`);
  console.log(`  Significant at alpha=0.05: ${pyBool(result.pValue < 0.05)}`);

  console.log("");
  banner("HYPOTHESIS TESTING: TWO-SAMPLE T-TEST");
  const modelAScores = generateNormal(30, 0.85, 0.05);
  const modelBScores = generateNormal(30, 0.88, 0.05);
  result = twoSampleTtest(modelAScores, modelBScores);
  const d = cohensD(modelAScores, modelBScores);
  console.log(`Model A mean: ${mean(modelAScores).toFixed(4)}`);
  console.log(`Model B mean: ${mean(modelBScores).toFixed(4)}`);
  console.log(`  t-statistic: ${result.tStatistic.toFixed(4)}`);
  console.log(`  p-value:     ${result.pValue.toFixed(4)}`);
  console.log(`  Cohen's d:   ${d.toFixed(4)} (${interpretCohensD(d)})`);
  console.log(`  Significant: ${pyBool(result.pValue < 0.05)}`);

  console.log("");
  banner("PAIRED T-TEST (CROSS-VALIDATION)");
  const cvA = [0.82, 0.85, 0.81, 0.84, 0.83, 0.86, 0.8, 0.84, 0.82, 0.85];
  const cvB = [0.84, 0.87, 0.83, 0.86, 0.85, 0.88, 0.83, 0.86, 0.85, 0.87];
  result = pairedTtest(cvA, cvB);
  console.log(`Model A folds: ${formatList(cvA)}`);
  console.log(`Model B folds: ${formatList(cvB)}`);
  console.log(`  Mean diff:   ${mean(cvA.map((a, i) => cvB[i]! - a)).toFixed(4)}`);
  console.log(`  t-statistic: ${result.tStatistic.toFixed(4)}`);
  console.log(`  p-value:     ${result.pValue.toFixed(4)}`);
  console.log(`  Significant: ${pyBool(result.pValue < 0.05)}`);

  console.log("");
  banner("CHI-SQUARED TEST");
  const observed = [120, 80, 95, 105];
  const expected = [100, 100, 100, 100];
  const chiResult = chiSquaredTest(observed, expected);
  console.log(`Observed: ${formatList(observed)}`);
  console.log(`Expected: ${formatList(expected)}`);
  console.log(`  chi-squared: ${chiResult.chi2.toFixed(4)}`);
  console.log(`  df:          ${chiResult.df}`);
  console.log(`  p-value:     ${chiResult.pValue.toFixed(4)}`);
  console.log(`  Significant: ${pyBool(chiResult.pValue < 0.05)}`);

  console.log("");
  banner("BOOTSTRAP CONFIDENCE INTERVALS");
  data = generateNormal(50, 100, 15);
  const bootMean = bootstrapStatistic(data, mean, 5000);
  const bootMedian = bootstrapStatistic(data, median, 5000);
  console.log("Sample size: 50, true mean: 100");
  console.log(
    `Bootstrap mean:   ${bootMean.estimate.toFixed(2)}  ` +
      `95% CI: [${bootMean.ciLower.toFixed(2)}, ${bootMean.ciUpper.toFixed(2)}]  ` +
      `SE: ${bootMean.stdError.toFixed(2)}`,
  );
  console.log(
    `Bootstrap median: ${bootMedian.estimate.toFixed(2)}  ` +
      `95% CI: [${bootMedian.ciLower.toFixed(2)}, ${bootMedian.ciUpper.toFixed(2)}]  ` +
      `SE: ${bootMedian.stdError.toFixed(2)}`,
  );

  console.log("\nBootstrap model comparison:");
  const scoresA = generateNormal(40, 0.85, 0.04);
  const scoresB = generateNormal(40, 0.88, 0.04);
  const comp = bootstrapCompare(scoresA, scoresB, mean, 5000);
  console.log(`  Model A mean: ${mean(scoresA).toFixed(4)}`);
  console.log(`  Model B mean: ${mean(scoresB).toFixed(4)}`);
  console.log(`  Diff:         ${comp.observedDiff.toFixed(4)}`);
  console.log(`  95% CI:       [${comp.ciLower.toFixed(4)}, ${comp.ciUpper.toFixed(4)}]`);
  console.log(`  Significant:  ${pyBool(comp.significant)} (CI excludes 0)`);

  console.log("");
  banner("A/B TEST SIMULATOR");
  console.log("\nTest 1: No real effect (true_effect = 0)");
  const ab1 = abTestSimulator(200, 0.0);
  console.log(`  Group A mean: ${ab1.groupAMean.toFixed(2)}`);
  console.log(`  Group B mean: ${ab1.groupBMean.toFixed(2)}`);
  console.log(`  Observed diff: ${ab1.observedDiff.toFixed(2)}`);
  console.log(`  p-value: ${ab1.tTest.pValue.toFixed(4)}`);
  console.log(`  Significant (t-test): ${pyBool(ab1.significantTtest)}`);
  console.log(`  Cohen's d: ${ab1.cohensD.toFixed(4)} (${ab1.effectInterpretation})`);

  console.log("\nTest 2: Real effect (true_effect = 5)");
  const ab2 = abTestSimulator(200, 5.0);
  console.log(`  Group A mean: ${ab2.groupAMean.toFixed(2)}`);
  console.log(`  Group B mean: ${ab2.groupBMean.toFixed(2)}`);
  console.log(`  Observed diff: ${ab2.observedDiff.toFixed(2)}`);
  console.log(`  p-value: ${ab2.tTest.pValue.toFixed(4)}`);
  console.log(`  Significant (t-test): ${pyBool(ab2.significantTtest)}`);
  console.log(`  Cohen's d: ${ab2.cohensD.toFixed(4)} (${ab2.effectInterpretation})`);

  console.log("");
  banner("MULTIPLE COMPARISON PROBLEM");
  console.log("\n20 tests with NO real effect (all null hypotheses true):");
  const multi = runMultipleAbTests(20, 100, 0.0);
  console.log(`  Tests significant (uncorrected): ${multi.uncorrectedSignificant}/20`);
  console.log(`  Tests significant (Bonferroni):  ${multi.correctedSignificant}/20`);
  console.log("  Expected false positives at alpha=0.05: ~1");
  console.log(`  Bonferroni adjusted alpha: ${(0.05 / 20).toFixed(4)}`);

  console.log("");
  banner("STATISTICAL VS PRACTICAL SIGNIFICANCE");
  const significance = statisticalVsPracticalSignificance(30, 100000, 0.1);
  console.log(`\nTrue effect: ${significance.trueEffect} (tiny)`);
  console.log(`\nSmall sample (n=${significance.smallSample.n}):`);
  console.log(`  p-value:  ${significance.smallSample.pValue.toFixed(4)}`);
  console.log(
    `  Cohen's d: ${significance.smallSample.cohensD.toFixed(4)} (${significance.smallSample.interpretation})`,
  );
  console.log(`  Significant: ${pyBool(significance.smallSample.significant)}`);
  console.log(`\nLarge sample (n=${significance.largeSample.n}):`);
  console.log(`  p-value:  ${significance.largeSample.pValue.toFixed(4)}`);
  console.log(
    `  Cohen's d: ${significance.largeSample.cohensD.toFixed(4)} (${significance.largeSample.interpretation})`,
  );
  console.log(`  Significant: ${pyBool(significance.largeSample.significant)}`);
  console.log("\nLesson: large n can make a negligible effect 'significant'.");
  console.log("Always check effect size, not just p-values.");

  console.log("");
  banner("POWER ANALYSIS SIMULATION");
  console.log("\nHow often do we detect a real effect (true_effect=3)?");
  const nSims = 200;
  let detected = 0;
  for (let i = 0; i < nSims; i++) {
    const a = generateNormal(50, 50, 10);
    const b = generateNormal(50, 53, 10);
    if (twoSampleTtest(a, b).pValue < 0.05) {
      detected += 1;
    }
  }
  console.log(`  Power (n=50, effect=3, std=10): ${(detected / nSims).toFixed(2)}`);
  console.log(`  (${detected}/${nSims} simulations detected the effect)`);

  let detectedLarge = 0;
  for (let i = 0; i < nSims; i++) {
    const a = generateNormal(200, 50, 10);
    const b = generateNormal(200, 53, 10);
    if (twoSampleTtest(a, b).pValue < 0.05) {
      detectedLarge += 1;
    }
  }
  console.log(`  Power (n=200, effect=3, std=10): ${(detectedLarge / nSims).toFixed(2)}`);
  console.log(`  (${detectedLarge}/${nSims} simulations detected the effect)`);
  console.log("  Larger samples give more power to detect real effects.");
}

main();
