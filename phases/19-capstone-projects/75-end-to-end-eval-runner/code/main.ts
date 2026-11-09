// Lesson: End-to-End Eval Runner (phase 19 / lesson 75)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/75-end-to-end-eval-runner/docs/en.md
// Run: npx tsx phases/19-capstone-projects/75-end-to-end-eval-runner/code/main.ts

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

import { TaskSpec, loadFixtures, postProcess, pyStrRepr, renderPrompt, validateFile } from "../../70-task-spec-format/code/main.js";
import { score as metricScore } from "../../71-classical-metrics/code/main.js";
import { extractCode, runCandidate } from "../../72-code-exec-metric/code/main.js";
import { CalibrationReport, PerplexityResult } from "../../73-perplexity-calibration/code/main.js";
import { EvalRun, aggregate, pairwiseDiffs, signed } from "../../74-leaderboard-aggregation/code/main.js";

class PyRandom {
  private mt = new Uint32Array(624);
  private mti = 625;

  constructor(seed: number) {
    this.initByArray([seed >>> 0]);
  }

  private initGenrand(s: number): void {
    this.mt[0] = s >>> 0;
    for (this.mti = 1; this.mti < 624; this.mti++) {
      const prev = this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30);
      this.mt[this.mti] = (Math.imul(1812433253, prev) + this.mti) >>> 0;
    }
  }

  private initByArray(key: number[]): void {
    this.initGenrand(19650218);
    let i = 1;
    let j = 0;
    for (let k = Math.max(624, key.length); k > 0; k--) {
      const prev = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = ((this.mt[i] ^ Math.imul(prev, 1664525)) + key[j] + j) >>> 0;
      i++;
      j++;
      if (i >= 624) {
        this.mt[0] = this.mt[623];
        i = 1;
      }
      if (j >= key.length) j = 0;
    }
    for (let k = 623; k > 0; k--) {
      const prev = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = ((this.mt[i] ^ Math.imul(prev, 1566083941)) - i) >>> 0;
      i++;
      if (i >= 624) {
        this.mt[0] = this.mt[623];
        i = 1;
      }
    }
    this.mt[0] = 0x80000000;
  }

  private genrand(): number {
    if (this.mti >= 624) {
      for (let kk = 0; kk < 624; kk++) {
        const y = (this.mt[kk] & 0x80000000) | (this.mt[(kk + 1) % 624] & 0x7fffffff);
        this.mt[kk] = this.mt[(kk + 397) % 624] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0);
      }
      this.mti = 0;
    }
    let y = this.mt[this.mti++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  random(): number {
    const a = this.genrand() >>> 5;
    const b = this.genrand() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }
}

export class Generation {
  constructor(
    public text: string,
    public confidence = 0.5,
    public token_nll = 0.0,
    public token_count = 0,
  ) {}
}

export abstract class ModelAdapter {
  abstract model_id: string;
  token_stats: [number, number][] = [];

  abstract generate(prompt: string, task: TaskSpec): Generation;
}

export class TaskResult {
  constructor(
    public model_id: string,
    public task_id: string,
    public category: string,
    public metric_name: string,
    public score: number,
    public correct: boolean,
    public confidence: number,
    public generation: string,
    public detail = "",
    public wall_seconds = 0.0,
  ) {}
}

type Row = Record<string, unknown>;

export class EvalReport {
  constructor(
    public leaderboard: Row[],
    public pairwise: Row[],
    public calibration: Record<string, Row>,
    public perplexity: Record<string, Row>,
    public summary: Row,
    public error: string | null = null,
  ) {}

  toJson(): string {
    const payload: Row = {
      leaderboard: this.leaderboard,
      pairwise: this.pairwise,
      calibration: this.calibration,
      perplexity: this.perplexity,
      summary: this.summary,
    };
    if (this.error) payload["error"] = this.error;
    return JSON.stringify(payload, null, 2);
  }
}

function correctFromScore(metricName: string, score: number, threshold = 0.5): boolean {
  if (["exact_match", "accuracy", "code_exec"].includes(metricName)) return score >= 0.999999;
  return score >= threshold;
}

function scoreOne(adapter: ModelAdapter, task: TaskSpec, timeoutS = 3.0): TaskResult {
  const rendered = renderPrompt(task);
  const t0 = performance.now();
  const gen = adapter.generate(rendered, task);
  const elapsed = (performance.now() - t0) / 1000;
  const processed = postProcess(gen.text, task.postProcess);
  let score: number;
  let detail: string;
  if (task.metricName === "code_exec") {
    const result = runCandidate(extractCode(processed) || processed, task.targets, timeoutS);
    score = result.score;
    detail = result.detail;
  } else {
    score = metricScore(task.metricName, processed, task.targets);
    detail = "";
  }
  return new TaskResult(
    adapter.model_id,
    task.taskId,
    task.category,
    task.metricName,
    score,
    correctFromScore(task.metricName, score),
    Number.isNaN(gen.confidence) ? 0.0 : Math.min(1.0, Math.max(0.0, gen.confidence)),
    gen.text,
    detail,
    elapsed,
  );
}

export function runEval(
  adapters: ModelAdapter[],
  tasks: TaskSpec[],
  _parallel = true,
  _maxWorkers = 8,
  codeExecTimeoutS = 3.0,
): [TaskResult[], Map<string, [number, number, number][]>] {
  const results: TaskResult[] = [];
  const modelIds = adapters.map((a) => a.model_id);
  if (new Set(modelIds).size !== modelIds.length) throw new Error("adapter.model_id values must be unique within a single eval run");
  const calibrationBuf = new Map<string, [number, number, number][]>(modelIds.map((m) => [m, []]));
  if (!tasks.length || !adapters.length) return [results, calibrationBuf];

  for (const adapter of adapters) {
    for (const task of tasks) results.push(scoreOne(adapter, task, codeExecTimeoutS));
  }

  results.sort((a, b) => {
    if (a.model_id !== b.model_id) return a.model_id < b.model_id ? -1 : 1;
    return a.task_id < b.task_id ? -1 : a.task_id > b.task_id ? 1 : 0;
  });
  for (const r of results) {
    (calibrationBuf.get(r.model_id) as [number, number, number][]).push([r.confidence, r.correct ? 1.0 : 0.0, r.score]);
  }
  return [results, calibrationBuf];
}

export function buildEvalRuns(results: TaskResult[]): EvalRun[] {
  return results.map((r) => new EvalRun(r.model_id, r.task_id, r.metric_name, r.score, r.category));
}

function calibrationBlocks(buf: Map<string, [number, number, number][]>): Record<string, Row> {
  const out: Record<string, Row> = {};
  for (const [modelId, entries] of buf) {
    if (!entries.length) {
      out[modelId] = { ece: 0.0, brier: 0.0, populated_bins: 0, n_samples: 0 };
      continue;
    }
    const report = CalibrationReport.fromPredictions(
      entries.map((e) => e[0]),
      entries.map((e) => e[1]),
      10,
    );
    out[modelId] = { ece: report.ece, brier: report.brier, populated_bins: report.populated_bins, n_samples: report.n_samples };
  }
  return out;
}

function perplexityBlocks(adapters: ModelAdapter[], adapterTokenStats: Map<string, [number, number][]>): Record<string, Row> {
  const out: Record<string, Row> = {};
  for (const adapter of adapters) {
    const stats = adapterTokenStats.get(adapter.model_id) ?? [];
    if (!stats.length) {
      out[adapter.model_id] = { perplexity: NaN, total_tokens: 0 };
      continue;
    }
    out[adapter.model_id] = PerplexityResult.fromTokenNll(
      stats.map((s) => s[0]),
      stats.map((s) => s[1]),
    ).toDict();
  }
  return out;
}

export function renderReport(
  adapters: ModelAdapter[],
  tasks: TaskSpec[],
  results: TaskResult[],
  calibrationBuf: Map<string, [number, number, number][]>,
  adapterTokenStats: Map<string, [number, number][]>,
  wallSeconds: number,
): EvalReport {
  const evalRuns = buildEvalRuns(results);
  const rows = aggregate(evalRuns, 200, 0.05, 7);
  const diffs = pairwiseDiffs(evalRuns, 200, 0.05, 7);
  const summary: Row = { tasks: tasks.length, models: adapters.length, task_runs: results.length, wall_seconds: wallSeconds };
  return new EvalReport(
    rows.map((r) => r.toDict()),
    diffs.map((d) => d.toDict()),
    calibrationBlocks(calibrationBuf),
    perplexityBlocks(adapters, adapterTokenStats),
    summary,
  );
}

export function renderMarkdownBlock(report: EvalReport): string {
  const lines = [
    "| Rank | Model | Mean | 95% CI | Win rate | Tasks | ECE | Brier |",
    "|------|-------|------|--------|----------|-------|-----|-------|",
  ];
  report.leaderboard.forEach((row, idx) => {
    const cal = report.calibration[row["model_id"] as string] ?? {};
    const ece = (cal["ece"] as number | undefined) ?? NaN;
    const brier = (cal["brier"] as number | undefined) ?? NaN;
    const ci = `${(row["mean_ci_lo"] as number).toFixed(2)}-${(row["mean_ci_hi"] as number).toFixed(2)}`;
    lines.push(
      `| ${idx + 1} | ${[...(row["model_id"] as string)].slice(0, 20).join("")} | ${(row["mean_score"] as number).toFixed(2)} | ${ci} | ` +
        `${(row["win_rate"] as number).toFixed(2)} | ${row["tasks_completed"]} | ${ece.toFixed(3)} | ${brier.toFixed(3)} |`,
    );
  });
  return lines.join("\n");
}

function wordCount(text: string): number {
  return text.split(/[\t-\r\u001c-\u001f \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/).filter(Boolean).length;
}

export class RuleBasedAdapter extends ModelAdapter {
  model_id = "rule_based";

  generate(_prompt: string, task: TaskSpec): Generation {
    let text = task.targets.length ? task.targets[0] : "";
    if (task.metricName === "code_exec") {
      if (task.taskId === "code_001") text = "```python\ndef add(a, b):\n    return a + b\n```";
      else if (task.taskId === "code_002") text = "```python\ndef is_even(n):\n    return n % 2 == 0\n```";
      else text = "```python\npass\n```";
    }
    if (task.postProcess === "extract_letter" && task.targets.length) text = `Answer: ${task.targets[0]}`;
    const tokenCount = Math.max(1, wordCount(text));
    const nll = tokenCount * 0.8;
    this.token_stats.push([nll, tokenCount]);
    return new Generation(text, 0.92, nll, tokenCount);
  }
}

export class NoisyAdapter extends ModelAdapter {
  model_id = "noisy";
  private rng: PyRandom;

  constructor(seed = 0) {
    super();
    this.rng = new PyRandom(seed);
  }

  generate(_prompt: string, task: TaskSpec): Generation {
    let text: string;
    if (this.rng.random() < 0.25 && task.targets.length) {
      text = task.targets[0];
    } else {
      text = "I do not know";
      if (task.postProcess === "extract_letter") text = "Answer: A";
      if (task.metricName === "code_exec") text = "```python\ndef add(a, b):\n    return a - b\n```";
    }
    const tokenCount = Math.max(1, wordCount(text));
    const nll = tokenCount * 2.5;
    this.token_stats.push([nll, tokenCount]);
    return new Generation(text, 0.85, nll, tokenCount);
  }
}

export class BiasedAdapter extends ModelAdapter {
  model_id = "biased";

  constructor(public good_category = "arithmetic") {
    super();
  }

  generate(_prompt: string, task: TaskSpec): Generation {
    let text: string;
    let confidence: number;
    let nllPerToken: number;
    if (task.category === this.good_category && task.targets.length) {
      text = task.targets[0];
      confidence = 0.9;
      nllPerToken = 1.0;
    } else {
      text = "guess";
      if (task.postProcess === "extract_letter") text = "Answer: B";
      if (task.metricName === "code_exec") text = "```python\ndef add(a, b):\n    return None\n```";
      confidence = 0.4;
      nllPerToken = 3.0;
    }
    const tokenCount = Math.max(1, wordCount(text));
    const nll = tokenCount * nllPerToken;
    this.token_stats.push([nll, tokenCount]);
    return new Generation(text, confidence, nll, tokenCount);
  }
}

function loadFixtureTasks(): TaskSpec[] {
  const outDir = mkdtempSync(join(tmpdir(), "aie_l75_"));
  const [good] = loadFixtures(outDir);
  const [tasks, errors] = validateFile(good);
  if (errors.length) {
    const shown = errors.map(
      (e) =>
        `ValidationError(line_number=${e.lineNumber}, task_id=${pyStrRepr(e.taskId)}, rule=${pyStrRepr(e.rule)}, field_name=${pyStrRepr(e.fieldName)}, detail=${pyStrRepr(e.detail)})`,
    );
    throw new Error(`fixture validation failed: [${shown.join(", ")}]`);
  }
  return tasks;
}

function pyFloat(x: number): string {
  if (Number.isInteger(x)) return x.toFixed(1);
  return String(x);
}

export function demo(): number {
  const tasks = loadFixtureTasks();
  const adapters: ModelAdapter[] = [new RuleBasedAdapter(), new NoisyAdapter(1), new BiasedAdapter("arithmetic")];
  const t0 = performance.now();
  const [results, calibrationBuf] = runEval(adapters, tasks, true, 6, 2.0);
  const wall = (performance.now() - t0) / 1000;

  const tokenStats = new Map(adapters.map((a) => [a.model_id, [...a.token_stats]]));
  const report = renderReport(adapters, tasks, results, calibrationBuf, tokenStats, wall);

  console.log(renderMarkdownBlock(report));
  console.log();
  const s = report.summary;
  console.log(
    `summary: {\n  "tasks": ${s["tasks"]},\n  "models": ${s["models"]},\n  "task_runs": ${s["task_runs"]},\n  "wall_seconds": ${pyFloat(s["wall_seconds"] as number)}\n}`,
  );
  console.log();
  console.log("pairwise differences (paired bootstrap):");
  for (const d of report.pairwise) {
    const sig = d["significant"] ? "yes" : "no";
    console.log(
      `  ${d["model_a"]} vs ${d["model_b"]}: diff=${signed(d["diff_mean"] as number, 3)}  ci=[${signed(d["ci_lo"] as number, 3)},${signed(d["ci_hi"] as number, 3)}]  significant=${sig}`,
    );
  }

  if (!report.leaderboard.length) {
    console.log("ERROR: empty leaderboard");
    return 1;
  }
  const top = report.leaderboard[0]["model_id"];
  const bot = report.leaderboard[report.leaderboard.length - 1]["model_id"];
  if (top !== "rule_based") {
    console.log(`ERROR: expected rule_based at top, got ${top}`);
    return 2;
  }
  if (bot === "rule_based") {
    console.log("ERROR: rule_based should not be at the bottom");
    return 3;
  }
  return 0;
}

if (require.main === module) {
  process.exitCode = demo();
}
