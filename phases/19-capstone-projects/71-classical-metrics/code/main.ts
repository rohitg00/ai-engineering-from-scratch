// Lesson: Classical Metrics (phase 19 / lesson 71)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/71-classical-metrics/docs/en.md
// Run: npx tsx phases/19-capstone-projects/71-classical-metrics/code/main.ts

const TOKEN_RE = /[\p{L}\p{N}_]+/gu;

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(TOKEN_RE) ?? [];
}

const PY_WS = /^[\t-\r\u001c-\u001f \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+|[\t-\r\u001c-\u001f \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+$/g;

function pyStrip(s: string): string {
  return s.replace(PY_WS, "");
}

export function exactMatch(prediction: string, targets: string[]): number {
  if (!targets.length) return 0.0;
  const pred = pyStrip(prediction);
  return targets.some((t) => pred === pyStrip(t)) ? 1.0 : 0.0;
}

export function accuracy(prediction: string, targets: string[]): number {
  return exactMatch(prediction, targets);
}

function counter<T>(items: T[], key: (x: T) => string = (x) => String(x)): Map<string, number> {
  const out = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

function counterTotal(c: Map<string, number>): number {
  let total = 0;
  for (const v of c.values()) total += v;
  return total;
}

export function f1Score(prediction: string, target: string): number {
  const predTokens = tokenize(prediction);
  const tgtTokens = tokenize(target);
  if (!predTokens.length && !tgtTokens.length) return 1.0;
  if (!predTokens.length || !tgtTokens.length) return 0.0;
  const predCounts = counter(predTokens);
  const tgtCounts = counter(tgtTokens);
  let overlap = 0;
  for (const [tok, n] of predCounts) overlap += Math.min(n, tgtCounts.get(tok) ?? 0);
  if (overlap === 0) return 0.0;
  const precision = overlap / counterTotal(predCounts);
  const recall = overlap / counterTotal(tgtCounts);
  return (2.0 * precision * recall) / (precision + recall);
}

function ngramCounts(tokens: string[], n: number): Map<string, number> {
  if (n <= 0) throw new Error("n must be positive");
  if (tokens.length < n) return new Map();
  const grams: string[][] = [];
  for (let i = 0; i < tokens.length - n + 1; i++) grams.push(tokens.slice(i, i + n));
  return counter(grams, (g) => JSON.stringify(g));
}

function modifiedPrecision(candTokens: string[], refTokens: string[], n: number): [number, number] {
  const candNgrams = ngramCounts(candTokens, n);
  if (!candNgrams.size) return [0, 0];
  const refNgrams = ngramCounts(refTokens, n);
  let clipped = 0;
  for (const [gram, count] of candNgrams) clipped += Math.min(count, refNgrams.get(gram) ?? 0);
  return [clipped, counterTotal(candNgrams)];
}

function brevityPenalty(candLen: number, refLen: number): number {
  if (candLen === 0) return 0.0;
  if (candLen >= refLen) return 1.0;
  return Math.exp(1.0 - refLen / candLen);
}

export function bleu4(prediction: string, reference: string, maxN = 4): number {
  const cand = tokenize(prediction);
  const ref = tokenize(reference);
  if (!cand.length) return 0.0;
  let logPSum = 0.0;
  for (let n = 1; n <= maxN; n++) {
    const [clipped, total] = modifiedPrecision(cand, ref, n);
    logPSum += Math.log((clipped + 1) / (total + 1));
  }
  const geoMean = Math.exp(logPSum / maxN);
  return brevityPenalty(cand.length, ref.length) * geoMean;
}

export function lcsLength(a: string[], b: string[]): number {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return 0;
  const dp: Int32Array[] = [];
  for (let i = 0; i <= n; i++) dp.push(new Int32Array(m + 1));
  for (let i = 0; i < n; i++) {
    const ai = a[i];
    const rowPrev = dp[i];
    const rowCurr = dp[i + 1];
    for (let j = 0; j < m; j++) {
      if (ai === b[j]) rowCurr[j + 1] = rowPrev[j] + 1;
      else rowCurr[j + 1] = Math.max(rowCurr[j], rowPrev[j + 1]);
    }
  }
  return dp[n][m];
}

export function rougeL(prediction: string, reference: string, beta = 1.0): number {
  const cand = tokenize(prediction);
  const ref = tokenize(reference);
  if (!cand.length && !ref.length) return 1.0;
  if (!cand.length || !ref.length) return 0.0;
  const lcs = lcsLength(cand, ref);
  if (lcs === 0) return 0.0;
  const precision = lcs / cand.length;
  const recall = lcs / ref.length;
  if (precision === 0.0 && recall === 0.0) return 0.0;
  const betaSq = beta * beta;
  const denom = recall + betaSq * precision;
  if (denom === 0) return 0.0;
  return ((1 + betaSq) * precision * recall) / denom;
}

export const METRIC_TABLE: Record<string, string> = {
  exact_match: "scalar",
  accuracy: "scalar",
  f1: "per_target_max",
  bleu_4: "per_target_max",
  rouge_l: "per_target_max",
};

export function score(metricName: string, prediction: string, targets: string[]): number {
  if (!targets.length) return 0.0;
  if (metricName === "exact_match") return exactMatch(prediction, targets);
  if (metricName === "accuracy") return accuracy(prediction, targets);
  if (metricName === "f1") return Math.max(...targets.map((t) => f1Score(prediction, t)));
  if (metricName === "bleu_4") return Math.max(...targets.map((t) => bleu4(prediction, t)));
  if (metricName === "rouge_l") return Math.max(...targets.map((t) => rougeL(prediction, t)));
  throw new Error(`unknown metric_name: ${metricName}`);
}

function pairwiseSum(values: number[]): number {
  if (values.length <= 8) {
    let s = 0.0;
    for (const v of values) s += v;
    return s;
  }
  const mid = Math.floor(values.length / 2);
  return pairwiseSum(values.slice(0, mid)) + pairwiseSum(values.slice(mid));
}

export function corpusMean(scores: number[]): number {
  if (!scores.length) return 0.0;
  return pairwiseSum(scores) / scores.length;
}

export function corpusBleu(predictions: string[], references: string[], maxN = 4): number {
  if (predictions.length !== references.length) throw new Error("predictions and references must align");
  if (!predictions.length) return 0.0;
  let totalCandLen = 0;
  let totalRefLen = 0;
  const clippedSums = new Array<number>(maxN).fill(0);
  const totalSums = new Array<number>(maxN).fill(0);
  predictions.forEach((candText, i) => {
    const cand = tokenize(candText);
    const ref = tokenize(references[i]);
    totalCandLen += cand.length;
    totalRefLen += ref.length;
    for (let n = 1; n <= maxN; n++) {
      const [clipped, total] = modifiedPrecision(cand, ref, n);
      clippedSums[n - 1] += clipped;
      totalSums[n - 1] += total;
    }
  });
  if (totalCandLen === 0) return 0.0;
  let logPSum = 0.0;
  for (let n = 1; n <= maxN; n++) logPSum += Math.log((clippedSums[n - 1] + 1) / (totalSums[n - 1] + 1));
  const geo = Math.exp(logPSum / maxN);
  return brevityPenalty(totalCandLen, totalRefLen) * geo;
}

interface Example {
  metric: string;
  pred: string;
  targets: string[];
  expected?: number;
  expected_approx?: number;
  expected_lt?: number;
}

function referenceExamples(): Example[] {
  return [
    { metric: "exact_match", pred: "41", targets: ["41"], expected: 1.0 },
    { metric: "exact_match", pred: "42", targets: ["41"], expected: 0.0 },
    { metric: "f1", pred: "the cat sat", targets: ["a cat sat on the mat"], expected_approx: 0.667 },
    { metric: "f1", pred: "", targets: ["the cat"], expected: 0.0 },
    { metric: "bleu_4", pred: "the cat sat on the mat", targets: ["the cat sat on the mat"], expected_approx: 1.0 },
    { metric: "bleu_4", pred: "the the the the", targets: ["the cat sat on the mat"], expected_lt: 0.5 },
    { metric: "rouge_l", pred: "the cat sat", targets: ["the cat sat on the mat"], expected_approx: 0.667 },
    { metric: "accuracy", pred: "positive", targets: ["positive"], expected: 1.0 },
  ];
}

function pyStrRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  return quote + s.replace(/\\/g, "\\\\").replace(new RegExp(quote, "g"), "\\" + quote) + quote;
}

function pyNum(x: number): string {
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

export function demo(): number {
  console.log("metric demos (using example vectors):");
  let failures = 0;
  for (const ex of referenceExamples()) {
    const actual = score(ex.metric, ex.pred, ex.targets);
    const head = `  ${ex.metric.padEnd(10)} pred=${pyStrRepr(ex.pred).padEnd(30)} -> ${actual.toFixed(4)}`;
    if (ex.expected !== undefined) {
      console.log(`${head} expected=${pyNum(ex.expected)}`);
      if (!(Math.abs(actual - ex.expected) < 1e-9)) failures += 1;
    } else if (ex.expected_approx !== undefined) {
      console.log(`${head} approx=${pyNum(ex.expected_approx)}`);
      if (!(Math.abs(actual - ex.expected_approx) < 0.05)) failures += 1;
    } else if (ex.expected_lt !== undefined) {
      console.log(`${head} < ${pyNum(ex.expected_lt)}`);
      if (!(actual < ex.expected_lt)) failures += 1;
    }
  }
  const preds = ["the cat sat on the mat", "the runner won the race"];
  const refs = ["the cat sat on the mat", "the runner crossed the finish line first"];
  console.log(`  corpus_bleu over 2 examples -> ${corpusBleu(preds, refs).toFixed(4)}`);
  return failures === 0 ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = demo();
}
