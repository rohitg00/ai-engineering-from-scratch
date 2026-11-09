// Lesson: Leaderboard Aggregation (phase 19 / lesson 74)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/74-leaderboard-aggregation/docs/en.md
// Run: npx tsx phases/19-capstone-projects/74-leaderboard-aggregation/code/main.ts

export class EvalRun {
  constructor(
    public model_id: string,
    public task_id: string,
    public metric_name: string,
    public score: number,
    public category = "general",
    public weight = 1.0,
  ) {}
}

export class LeaderboardRow {
  constructor(
    public model_id: string,
    public mean_score: number,
    public mean_ci_lo: number,
    public mean_ci_hi: number,
    public win_rate: number,
    public tasks_completed: number,
    public categories: Record<string, number> = {},
  ) {}

  toDict(): Record<string, unknown> {
    return {
      model_id: this.model_id,
      mean_score: this.mean_score,
      mean_ci_lo: this.mean_ci_lo,
      mean_ci_hi: this.mean_ci_hi,
      win_rate: this.win_rate,
      tasks_completed: this.tasks_completed,
      categories: { ...this.categories },
    };
  }
}

export class PairwiseDiff {
  constructor(
    public model_a: string,
    public model_b: string,
    public diff_mean: number,
    public ci_lo: number,
    public ci_hi: number,
    public significant: boolean,
  ) {}

  toDict(): Record<string, unknown> {
    return {
      model_a: this.model_a,
      model_b: this.model_b,
      diff_mean: this.diff_mean,
      ci_lo: this.ci_lo,
      ci_hi: this.ci_hi,
      significant: this.significant,
    };
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

  integer(lo: number, hi: number): number {
    return lo + Math.floor(this.random() * (hi - lo));
  }

  uniform(lo: number, hi: number): number {
    return lo + (hi - lo) * this.random();
  }
}

function mean(values: number[]): number {
  let s = 0.0;
  for (const v of values) s += v;
  return s / values.length;
}

function percentile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const pos = ((sorted.length - 1) * q) / 100.0;
  const lo = Math.floor(pos);
  const hi = Math.min(lo + 1, sorted.length - 1);
  const frac = pos - lo;
  return sorted[lo] + (sorted[hi] - sorted[lo]) * frac;
}

function validateRuns(runs: EvalRun[]): void {
  const seen = new Set<string>();
  for (const r of runs) {
    if (!(r.score >= 0.0 && r.score <= 1.0)) throw new Error(`score for ${r.model_id}/${r.task_id} not in [0,1]: ${r.score}`);
    const key = JSON.stringify([r.model_id, r.task_id]);
    if (seen.has(key)) throw new Error(`duplicate run for ${r.model_id}/${r.task_id}`);
    seen.add(key);
  }
}

function groupBy(runs: EvalRun[], key: (r: EvalRun) => string): Map<string, EvalRun[]> {
  const out = new Map<string, EvalRun[]>();
  for (const r of runs) {
    const k = key(r);
    const list = out.get(k);
    if (list) list.push(r);
    else out.set(k, [r]);
  }
  return out;
}

export function bootstrapMeanCi(scores: number[], b = 1000, alpha = 0.05, seed = 0): [number, number] {
  if (!scores.length) return [0.0, 0.0];
  const rng = new Mulberry32(seed);
  const n = scores.length;
  const means: number[] = [];
  for (let i = 0; i < b; i++) {
    const sample: number[] = [];
    for (let k = 0; k < n; k++) sample.push(scores[rng.integer(0, n)]);
    means.push(mean(sample));
  }
  return [percentile(means, 100.0 * (alpha / 2.0)), percentile(means, 100.0 * (1.0 - alpha / 2.0))];
}

export function bootstrapPairwiseDiff(pairedA: number[], pairedB: number[], b = 1000, alpha = 0.05, seed = 0): [number, number, number] {
  if (pairedA.length !== pairedB.length) throw new Error("paired arrays must align");
  if (!pairedA.length) return [0.0, 0.0, 0.0];
  const rng = new Mulberry32(seed);
  const diffs = pairedA.map((a, i) => a - pairedB[i]);
  const diffMean = mean(diffs);
  const n = diffs.length;
  const boots: number[] = [];
  for (let i = 0; i < b; i++) {
    const sample: number[] = [];
    for (let k = 0; k < n; k++) sample.push(diffs[rng.integer(0, n)]);
    boots.push(mean(sample));
  }
  return [diffMean, percentile(boots, 100.0 * (alpha / 2.0)), percentile(boots, 100.0 * (1.0 - alpha / 2.0))];
}

function winRate(modelId: string, runsByTask: Map<string, EvalRun[]>): [number, number] {
  let wins = 0;
  let total = 0;
  for (const runs of runsByTask.values()) {
    const scores = new Map(runs.map((r) => [r.model_id, r.score]));
    if (!scores.has(modelId)) continue;
    total += 1;
    const best = Math.max(...scores.values());
    const score = scores.get(modelId) as number;
    if (Math.abs(score - best) <= Math.max(1e-9 * Math.max(Math.abs(score), Math.abs(best)), 1e-12)) wins += 1;
  }
  if (total === 0) return [0.0, 0];
  return [wins / total, total];
}

function categoryMeans(runs: EvalRun[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [cat, rs] of groupBy(runs, (r) => r.category)) out[cat] = mean(rs.map((r) => r.score));
  return out;
}

export function aggregate(runs: EvalRun[], b = 500, alpha = 0.05, seed = 0): LeaderboardRow[] {
  if (!runs.length) return [];
  validateRuns(runs);
  const byModel = groupBy(runs, (r) => r.model_id);
  const byTask = groupBy(runs, (r) => r.task_id);
  const rows: LeaderboardRow[] = [];
  for (const [modelId, modelRuns] of byModel) {
    const scores = modelRuns.map((r) => r.score);
    const [lo, hi] = bootstrapMeanCi(scores, b, alpha, seed);
    const [wr, completed] = winRate(modelId, byTask);
    rows.push(new LeaderboardRow(modelId, mean(scores), lo, hi, wr, completed ? completed : scores.length, categoryMeans(modelRuns)));
  }
  rows.sort((x, y) => y.mean_score - x.mean_score);
  return rows;
}

export function pairwiseDiffs(runs: EvalRun[], b = 500, alpha = 0.05, seed = 0): PairwiseDiff[] {
  if (!runs.length) return [];
  validateRuns(runs);
  const modelIds = [...groupBy(runs, (r) => r.model_id).keys()].sort();
  const common = new Map<string, Map<string, number>>();
  for (const r of runs) {
    let ms = common.get(r.task_id);
    if (!ms) {
      ms = new Map();
      common.set(r.task_id, ms);
    }
    ms.set(r.model_id, r.score);
  }
  const out: PairwiseDiff[] = [];
  for (let i = 0; i < modelIds.length; i++) {
    for (let j = i + 1; j < modelIds.length; j++) {
      const a = modelIds[i];
      const bId = modelIds[j];
      const pairedA: number[] = [];
      const pairedB: number[] = [];
      for (const ms of common.values()) {
        if (ms.has(a) && ms.has(bId)) {
          pairedA.push(ms.get(a) as number);
          pairedB.push(ms.get(bId) as number);
        }
      }
      if (!pairedA.length) continue;
      const [diffMean, lo, hi] = bootstrapPairwiseDiff(pairedA, pairedB, b, alpha, seed + i + j);
      out.push(new PairwiseDiff(a, bId, diffMean, lo, hi, lo > 0.0 || hi < 0.0));
    }
  }
  return out;
}

export function renderMarkdown(rows: LeaderboardRow[]): string {
  const lines = ["| Rank | Model | Mean | 95% CI | Win rate | Tasks |", "|------|-------|------|--------|----------|-------|"];
  rows.forEach((row, i) => {
    const label = [...row.model_id].slice(0, 20).join("");
    const ci = `${row.mean_ci_lo.toFixed(2)}-${row.mean_ci_hi.toFixed(2)}`;
    lines.push(`| ${i + 1} | ${label} | ${row.mean_score.toFixed(2)} | ${ci} | ${row.win_rate.toFixed(2)} | ${row.tasks_completed} |`);
  });
  return lines.join("\n");
}

export function renderJson(rows: LeaderboardRow[]): string {
  return JSON.stringify(
    rows.map((r) => r.toDict()),
    null,
    2,
  );
}

export function signed(x: number, digits: number): string {
  const s = x.toFixed(digits);
  return s.startsWith("-") ? s : "+" + s;
}

function syntheticRuns(seed = 0): EvalRun[] {
  const rng = new Mulberry32(seed);
  const models = ["model_a", "model_b", "model_c"];
  const categories = ["arithmetic", "mcq", "code_exec", "summary"];
  const means: Record<string, number> = { model_a: 0.78, model_b: 0.72, model_c: 0.55 };
  const metrics: Record<string, string> = { arithmetic: "exact_match", mcq: "accuracy", code_exec: "code_exec", summary: "rouge_l" };
  const runs: EvalRun[] = [];
  for (const cat of categories) {
    for (let t = 0; t < 3; t++) {
      const taskId = `${cat}_${String(t).padStart(2, "0")}`;
      for (const m of models) {
        let base = means[m];
        if (cat === "code_exec") base -= 0.1;
        if (cat === "summary" && m === "model_c") base += 0.15;
        const noise = rng.uniform(-0.1, 0.1);
        const score = Math.min(1.0, Math.max(0.0, base + noise));
        runs.push(new EvalRun(m, taskId, metrics[cat], score, cat));
      }
    }
  }
  return runs;
}

export function demo(): number {
  const runs = syntheticRuns(42);
  const rows = aggregate(runs, 300, 0.05, 11);
  const diffs = pairwiseDiffs(runs, 300, 0.05, 11);
  console.log(renderMarkdown(rows));
  console.log();
  console.log("Pairwise comparisons (paired bootstrap):");
  for (const d of diffs) {
    const sig = d.significant ? "yes" : "no";
    console.log(
      `  ${d.model_a} vs ${d.model_b}: diff=${signed(d.diff_mean, 3)} ci=[${signed(d.ci_lo, 3)},${signed(d.ci_hi, 3)}] significant=${sig}`,
    );
  }
  if (!rows.length) return 1;
  if (rows[0].mean_score < rows[rows.length - 1].mean_score) return 1;
  return 0;
}

if (require.main === module) {
  process.exitCode = demo();
}
