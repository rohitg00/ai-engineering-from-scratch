// Lesson: Perplexity and Calibration (phase 19 / lesson 73)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/73-perplexity-calibration/docs/en.md
// Run: npx tsx phases/19-capstone-projects/73-perplexity-calibration/code/main.ts

export class PerplexityResult {
  constructor(
    public perplexity: number,
    public avg_neg_log_likelihood: number,
    public total_tokens: number,
  ) {}

  toDict(): Record<string, number> {
    return {
      perplexity: this.perplexity,
      avg_neg_log_likelihood: this.avg_neg_log_likelihood,
      total_tokens: this.total_tokens,
    };
  }

  static fromTokenNll(negLogProbs: number[], tokenCounts: number[]): PerplexityResult {
    if (negLogProbs.length !== tokenCounts.length) throw new Error("neg_log_probs and token_counts must align");
    let totalNll = 0.0;
    let totalTokens = 0;
    negLogProbs.forEach((nll, i) => {
      const n = tokenCounts[i];
      if (nll < 0) throw new Error("neg_log_probs must be non-negative (did you forget the negation?)");
      if (n < 0) throw new Error("token_counts must be non-negative");
      totalNll += nll;
      totalTokens += Math.trunc(n);
    });
    if (totalTokens === 0) return new PerplexityResult(NaN, 0.0, 0);
    const avgNll = totalNll / totalTokens;
    return new PerplexityResult(Math.exp(avgNll), avgNll, totalTokens);
  }
}

export function perplexity(negLogProbs: number[], tokenCounts: number[]): number {
  return PerplexityResult.fromTokenNll(negLogProbs, tokenCounts).perplexity;
}

function validateProbs(confidences: number[], correct: number[]): void {
  if (confidences.length !== correct.length) throw new Error("confidences and correct must have the same shape");
  if (!confidences.length) return;
  let lo = confidences[0];
  let hi = confidences[0];
  for (const c of confidences) {
    if (c < lo) lo = c;
    if (c > hi) hi = c;
  }
  if (lo < 0.0 || hi > 1.0) throw new Error("confidences must lie in [0, 1]");
  if (!correct.every((c: unknown) => c === 0 || c === 1 || typeof c === "boolean")) throw new Error("correct must be 0/1 or boolean");
}

function binIndices(confidences: number[], nBins: number): number[] {
  const edges: number[] = [];
  for (let i = 0; i <= nBins; i++) edges.push(i === nBins ? 1.0 : i * (1.0 / nBins));
  return confidences.map((c) => {
    let pos = 0;
    while (pos < edges.length && edges[pos] <= c) pos++;
    return Math.min(Math.max(pos - 1, 0), nBins - 1);
  });
}

function mean(values: number[]): number {
  let s = 0.0;
  for (const v of values) s += v;
  return s / values.length;
}

interface BinStat {
  size: number;
  avgConf: number;
  avgAcc: number;
}

function binStats(conf: number[], corr: number[], bins: number): BinStat[] {
  const idx = binIndices(conf, bins);
  const out: BinStat[] = [];
  for (let b = 0; b < bins; b++) {
    const cs: number[] = [];
    const as: number[] = [];
    idx.forEach((ix, i) => {
      if (ix === b) {
        cs.push(conf[i]);
        as.push(corr[i]);
      }
    });
    out.push({ size: cs.length, avgConf: cs.length ? mean(cs) : 0.0, avgAcc: as.length ? mean(as) : 0.0 });
  }
  return out;
}

export function expectedCalibrationError(confidences: number[], correct: number[], bins = 10): [number, number] {
  validateProbs(confidences, correct);
  if (bins <= 0) throw new Error("bins must be positive");
  const n = confidences.length;
  if (n === 0) return [0.0, 0];
  let totalGap = 0.0;
  let populated = 0;
  for (const s of binStats(confidences, correct, bins)) {
    if (s.size === 0) continue;
    populated += 1;
    totalGap += (s.size / n) * Math.abs(s.avgConf - s.avgAcc);
  }
  return [totalGap, populated];
}

export function brierScore(confidences: number[], correct: number[]): number {
  validateProbs(confidences, correct);
  if (!confidences.length) return 0.0;
  return mean(confidences.map((c, i) => (c - correct[i]) ** 2));
}

export function brierDecomposition(confidences: number[], correct: number[], bins = 10): Record<string, number> {
  if (bins <= 0) throw new Error("bins must be positive");
  validateProbs(confidences, correct);
  const n = confidences.length;
  if (n === 0) return { reliability: 0.0, resolution: 0.0, uncertainty: 0.0, brier: 0.0 };
  const overall = mean(correct);
  let reliability = 0.0;
  let resolution = 0.0;
  for (const s of binStats(confidences, correct, bins)) {
    if (s.size === 0) continue;
    reliability += (s.size / n) * (s.avgConf - s.avgAcc) ** 2;
    resolution += (s.size / n) * (s.avgAcc - overall) ** 2;
  }
  const uncertainty = overall * (1.0 - overall);
  return { reliability, resolution, uncertainty, brier: reliability - resolution + uncertainty };
}

export function reliabilityDiagram(confidences: number[], correct: number[], bins = 10): [number[], number[], number[]] {
  if (bins <= 0) throw new Error("bins must be positive");
  validateProbs(confidences, correct);
  const binConf = new Array<number>(bins).fill(0.0);
  const binAcc = new Array<number>(bins).fill(0.0);
  const binCount = new Array<number>(bins).fill(0);
  if (!confidences.length) return [binConf, binAcc, binCount];
  binStats(confidences, correct, bins).forEach((s, b) => {
    binCount[b] = s.size;
    if (s.size === 0) return;
    binConf[b] = s.avgConf;
    binAcc[b] = s.avgAcc;
  });
  return [binConf, binAcc, binCount];
}

export class CalibrationReport {
  constructor(
    public ece: number,
    public brier: number,
    public populated_bins: number,
    public reliability: [number[], number[], number[]],
    public n_samples: number,
  ) {}

  toDict(): Record<string, unknown> {
    const [binConf, binAcc, binCount] = this.reliability;
    return {
      ece: this.ece,
      brier: this.brier,
      populated_bins: this.populated_bins,
      n_samples: this.n_samples,
      reliability: { bin_conf: [...binConf], bin_acc: [...binAcc], bin_count: [...binCount] },
    };
  }

  static fromPredictions(confidences: number[], correct: number[], bins = 10): CalibrationReport {
    const [ece, populated] = expectedCalibrationError(confidences, correct, bins);
    const brier = brierScore(confidences, correct);
    const rel = reliabilityDiagram(confidences, correct, bins);
    return new CalibrationReport(ece, brier, populated, rel, confidences.length);
  }
}

class Mulberry32 {
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

  uniform(lo: number, hi: number, size: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < size; i++) out.push(lo + (hi - lo) * this.random());
    return out;
  }

  integers(lo: number, hi: number, size: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < size; i++) out.push(lo + Math.floor(this.random() * (hi - lo)));
    return out;
  }
}

export function syntheticCalibrated(n: number, seed = 0): [number[], number[]] {
  const rng = new Mulberry32(seed);
  const confidences = rng.uniform(0.0, 1.0, n);
  const draws = rng.uniform(0.0, 1.0, n);
  return [confidences, draws.map((u, i) => (u < confidences[i] ? 1 : 0))];
}

export function syntheticOverconfident(n: number, seed = 1): [number[], number[]] {
  const rng = new Mulberry32(seed);
  const confidences = rng.uniform(0.7, 1.0, n);
  const draws = rng.uniform(0.0, 1.0, n);
  return [confidences, draws.map((u, i) => (u < confidences[i] * 0.5 ? 1 : 0))];
}

export function syntheticUnderconfident(n: number, seed = 2): [number[], number[]] {
  const rng = new Mulberry32(seed);
  const confidences = rng.uniform(0.0, 0.3, n);
  const draws = rng.uniform(0.0, 1.0, n);
  return [confidences, draws.map((u, i) => (u < 0.5 + confidences[i] ? 1 : 0))];
}

export function syntheticTokenNll(seed = 0): [number[], number[]] {
  const rng = new Mulberry32(seed);
  const counts = rng.integers(20, 60, 12);
  const nlls = counts.map((n) => rng.uniform(1.5, 3.0, 1)[0] * n);
  return [nlls, counts];
}

export function demo(): number {
  let failures = 0;
  const builders: [string, (n: number) => [number[], number[]]][] = [
    ["calibrated", (n) => syntheticCalibrated(n)],
    ["overconfident", (n) => syntheticOverconfident(n)],
    ["underconfident", (n) => syntheticUnderconfident(n)],
  ];
  for (const [label, builder] of builders) {
    const [conf, corr] = builder(800);
    const report = CalibrationReport.fromPredictions(conf, corr, 10);
    console.log(`${label.padEnd(14)} ece=${report.ece.toFixed(4)} brier=${report.brier.toFixed(4)} populated=${report.populated_bins}`);
    if (label === "calibrated" && report.ece > 0.07) failures += 1;
    if (label === "overconfident" && report.ece <= 0.1) failures += 1;
  }

  const [nlls, counts] = syntheticTokenNll(7);
  const pp = PerplexityResult.fromTokenNll(nlls, counts);
  console.log(
    `perplexity     value=${pp.perplexity.toFixed(3)}  avg_nll=${pp.avg_neg_log_likelihood.toFixed(3)}  tokens=${pp.total_tokens}`,
  );
  if (!(3.0 < pp.perplexity && pp.perplexity < 25.0)) failures += 1;

  const [, , binCount] = reliabilityDiagram([0.05, 0.15, 0.85, 0.95], [0, 0, 1, 1], 10);
  console.log(`reliability    populated_bins=${binCount.filter((c) => c > 0).length}`);
  return failures === 0 ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = demo();
}
