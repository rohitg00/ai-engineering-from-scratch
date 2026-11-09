// Lesson: ML System Design: From Problem to Deployed Model (phase 02 / lesson 19)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/02-ml-fundamentals/19-ml-system-design/docs/en.md
// Run: npx tsx phases/02-ml-fundamentals/19-ml-system-design/code/main.ts

import { readFileSync } from "node:fs";

type Random = () => number;

function mulberry32(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fx(x: number, digits: number): string {
  if (!Number.isFinite(x)) return x > 0 ? "inf" : x < 0 ? "-inf" : "nan";
  const negative = x < 0 || Object.is(x, -0);
  const a = Math.abs(x);
  let s = a.toFixed(digits);
  const width = Math.min(100, digits + 60);
  const exact = a.toFixed(width);
  const tail = exact.slice(exact.length - (width - digits));
  if (/^50*$/.test(tail)) {
    const down = (Math.floor(a * 10 ** digits) / 10 ** digits).toFixed(digits);
    if (Number(down.replace(".", "").slice(-1)) % 2 === 0) s = down;
  }
  return negative ? `-${s}` : s;
}

function withCommas(s: string): string {
  const [whole, frac] = s.split(".");
  const sign = whole.startsWith("-") ? "-" : "";
  const digits = whole.replace("-", "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac === undefined ? `${sign}${digits}` : `${sign}${digits}.${frac}`;
}

function stripZeros(s: string): string {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

function fg(x: number): string {
  if (x === 0) return "0";
  const [mantissa, expText] = x.toExponential(5).split("e");
  const exp = Number(expText);
  if (exp < -4 || exp >= 6) {
    return `${stripZeros(mantissa)}e${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
  }
  return stripZeros(x.toFixed(5 - exp));
}

function signed(x: number, digits: number): string {
  const s = fx(x, digits);
  return s.startsWith("-") ? s : `+${s}`;
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pyTruthy(value: Json | undefined): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return Boolean(value);
}

function pyStr(value: Json | undefined): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}

type Workload = {
  name: string;
  entities: number;
  requests_per_day: number;
  peak_qps: number;
  max_staleness_hours: number;
  latency_budget_ms: number;
};

function workload(
  name: string,
  entities: number,
  requests_per_day: number,
  peak_qps: number,
  max_staleness_hours: number,
  latency_budget_ms: number,
): Workload {
  return { name, entities, requests_per_day, peak_qps, max_staleness_hours, latency_budget_ms };
}

type CostModel = {
  batch_dollars_per_million: number;
  batch_job_hours: number;
  lookup_dollars_per_million: number;
  lookup_latency_ms: number;
  replica_dollars_per_hour: number;
  replica_qps: number;
  min_replicas: number;
  online_latency_ms: number;
};

function costModel(overrides: Partial<CostModel> = {}): CostModel {
  return {
    batch_dollars_per_million: 0.4,
    batch_job_hours: 1.0,
    lookup_dollars_per_million: 0.25,
    lookup_latency_ms: 4.0,
    replica_dollars_per_hour: 0.5,
    replica_qps: 200.0,
    min_replicas: 2,
    online_latency_ms: 35.0,
    ...overrides,
  };
}

type ServingPlan = {
  mode: string;
  feasible: boolean;
  dollars_per_day: number;
  latency_ms: number;
  worst_staleness_hours: number;
  predictions_per_day: number;
  reason: string;
};

function plan(
  mode: string,
  feasible: boolean,
  dollars_per_day: number,
  latency_ms: number,
  worst_staleness_hours: number,
  predictions_per_day: number,
  reason: string,
): ServingPlan {
  return { mode, feasible, dollars_per_day, latency_ms, worst_staleness_hours, predictions_per_day, reason };
}

function batchPlan(w: Workload, costs: CostModel): ServingPlan {
  const refreshHours = w.max_staleness_hours - costs.batch_job_hours;
  if (refreshHours <= 0) {
    return plan(
      "batch", false, Infinity, costs.lookup_latency_ms, Infinity, 0.0,
      "staleness limit is shorter than one batch job",
    );
  }
  const runsPerDay = 24.0 / refreshHours;
  const predictions = w.entities * runsPerDay;
  const dollars =
    (predictions / 1e6) * costs.batch_dollars_per_million +
    (w.requests_per_day / 1e6) * costs.lookup_dollars_per_million;
  const feasible = costs.lookup_latency_ms <= w.latency_budget_ms;
  let reason = `${fx(runsPerDay, 1)} runs per day over ${withCommas(String(w.entities))} entities`;
  if (!feasible) {
    reason = "key-value lookup is slower than the latency budget";
  }
  return plan("batch", feasible, dollars, costs.lookup_latency_ms, w.max_staleness_hours, predictions, reason);
}

function onlinePlan(w: Workload, costs: CostModel): ServingPlan {
  const replicas = Math.max(costs.min_replicas, Math.ceil(w.peak_qps / costs.replica_qps));
  const dollars = replicas * costs.replica_dollars_per_hour * 24.0;
  const feasible = costs.online_latency_ms <= w.latency_budget_ms;
  let reason = `${replicas} replicas sized for ${fg(w.peak_qps)} peak QPS`;
  if (!feasible) {
    reason = "model latency is slower than the latency budget";
  }
  return plan("online", feasible, dollars, costs.online_latency_ms, 0.0, w.requests_per_day, reason);
}

function chooseServing(w: Workload, costs: CostModel = costModel()): [ServingPlan | null, ServingPlan[]] {
  const plans = [batchPlan(w, costs), onlinePlan(w, costs)];
  const feasible = plans.filter((p) => p.feasible);
  let best: ServingPlan | null = null;
  for (const p of feasible) {
    if (best === null || p.dollars_per_day < best.dollars_per_day) best = p;
  }
  return [best, plans];
}

function checkLengths(yTrue: readonly unknown[], yPred: readonly unknown[]): void {
  if (yTrue.length !== yPred.length) {
    throw new Error(`y_true has ${yTrue.length} values and y_pred has ${yPred.length}`);
  }
  if (yTrue.length === 0) {
    throw new Error("a metric needs at least one value");
  }
}

function f1Score(yTrue: readonly number[], yPred: readonly number[]): number {
  checkLengths(yTrue, yPred);
  let tp = 0;
  let fp = 0;
  let fn = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const t = yTrue[i];
    const p = yPred[i];
    if (t === 1 && p === 1) tp++;
    if (t === 0 && p === 1) fp++;
    if (t === 1 && p === 0) fn++;
  }
  return tp === 0 ? 0.0 : (2 * tp) / (2 * tp + fp + fn);
}

function meanAbsoluteError(yTrue: readonly number[], yPred: readonly number[]): number {
  checkLengths(yTrue, yPred);
  return yTrue.reduce((s, t, i) => s + Math.abs(t - yPred[i]), 0) / yTrue.length;
}

function majorityBaseline(yTrain: readonly number[], n: number): number[] {
  const values = [...new Set(yTrain)].sort((a, b) => a - b);
  let top = values[0];
  let topCount = -1;
  for (const v of values) {
    const c = yTrain.filter((y) => y === v).length;
    if (c > topCount) {
      top = v;
      topCount = c;
    }
  }
  return new Array<number>(n).fill(top);
}

function meanBaseline(yTrain: readonly number[], n: number): number[] {
  return new Array<number>(n).fill(yTrain.reduce((s, v) => s + v, 0) / yTrain.length);
}

function baseRateBaseline(yTrain: readonly number[], n: number, seed = 0): number[] {
  const rate = yTrain.reduce((s, v) => s + v, 0) / yTrain.length;
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () => (rng() < rate ? 1 : 0));
}

type Row = { [feature: string]: number };

function fitRule(rows: readonly Row[], labels: readonly number[], feature: string): number {
  const candidates = [...new Set(rows.map((row) => row[feature]))].sort((a, b) => a - b);
  let bestThreshold = candidates[0];
  let bestScore = -1.0;
  for (const threshold of candidates) {
    const score = f1Score(labels, applyRule(rows, feature, threshold));
    if (score > bestScore) {
      bestThreshold = threshold;
      bestScore = score;
    }
  }
  return bestThreshold;
}

function applyRule(rows: readonly Row[], feature: string, threshold: number): number[] {
  return rows.map((row) => (row[feature] > threshold ? 1 : 0));
}

class BaselineReport {
  constructor(
    readonly metric: string,
    readonly scores: [string, number][],
    readonly bestBaseline: string,
    readonly lift: number,
    readonly minLift: number,
  ) {}

  get beatsBaselines(): boolean {
    return this.lift >= this.minLift;
  }
}

function compareToBaselines(
  yTrue: readonly number[],
  modelPred: readonly number[],
  baselines: [string, number[]][],
  metric: (a: readonly number[], b: readonly number[]) => number,
  metricName: string,
  higherIsBetter = true,
  minLift = 0.02,
): BaselineReport {
  if (baselines.length === 0) {
    throw new Error("a model needs at least one baseline");
  }
  const scores: [string, number][] = baselines.map(([name, pred]) => [name, metric(yTrue, pred)]);
  let [bestName, bestScore] = scores[0];
  for (const [name, score] of scores) {
    if (higherIsBetter ? score > bestScore : score < bestScore) {
      bestName = name;
      bestScore = score;
    }
  }
  const modelScore = metric(yTrue, modelPred);
  const lift = higherIsBetter ? modelScore - bestScore : bestScore - modelScore;
  return new BaselineReport(metricName, [["model", modelScore], ...scores], bestName, lift, minLift);
}

const FEATURES = ["days_idle", "tickets", "tenure_months"] as const;

function makeChurnData(n: number, seed: number): [Row[], number[]] {
  const rng = mulberry32(seed);
  const rows: Row[] = [];
  const labels: number[] = [];
  const ticketChoices = [0, 0, 0, 1, 1, 2, 3, 5];
  for (let i = 0; i < n; i++) {
    const idle = -Math.log(1.0 - rng()) / (1 / 10);
    const tickets = ticketChoices[Math.floor(rng() * ticketChoices.length)];
    const tenure = 1 + (60 - 1) * rng();
    const z = -2.6 + 0.12 * idle + 0.45 * tickets - 0.035 * tenure;
    labels.push(rng() < 1 / (1 + Math.exp(-z)) ? 1 : 0);
    rows.push({ days_idle: idle, tickets, tenure_months: tenure });
  }
  return [rows, labels];
}

class LogisticModel {
  means: { [k: string]: number } = {};
  stds: { [k: string]: number } = {};
  weights: number[] = FEATURES.map(() => 0.0);
  bias = 0.0;
  threshold = 0.5;

  constructor(
    readonly epochs = 300,
    readonly lr = 0.5,
  ) {}

  private vector(row: Row): number[] {
    return FEATURES.map((k) => (row[k] - this.means[k]) / this.stds[k]);
  }

  fit(rows: readonly Row[], labels: readonly number[]): LogisticModel {
    const n = rows.length;
    for (const k of FEATURES) {
      this.means[k] = rows.reduce((s, r) => s + r[k], 0) / n;
      const spread = Math.sqrt(rows.reduce((s, r) => s + (r[k] - this.means[k]) ** 2, 0) / n);
      this.stds[k] = spread || 1.0;
    }
    const vectors = rows.map((r) => this.vector(r));
    for (let epoch = 0; epoch < this.epochs; epoch++) {
      const gradW = FEATURES.map(() => 0.0);
      let gradB = 0.0;
      vectors.forEach((x, i) => {
        const error = this.sigmoid(x) - labels[i];
        x.forEach((xj, j) => {
          gradW[j] += error * xj;
        });
        gradB += error;
      });
      this.weights = this.weights.map((w, j) => w - (this.lr * gradW[j]) / n);
      this.bias -= (this.lr * gradB) / n;
    }
    const probabilities = vectors.map((x) => this.sigmoid(x));
    const grid: number[] = [];
    for (let t = 5; t < 96; t += 5) grid.push(t / 100);
    let bestT = grid[0];
    let bestF1 = -Infinity;
    for (const t of grid) {
      const score = f1Score(labels, probabilities.map((p) => (p >= t ? 1 : 0)));
      if (score > bestF1) {
        bestT = t;
        bestF1 = score;
      }
    }
    this.threshold = bestT;
    return this;
  }

  private sigmoid(x: readonly number[]): number {
    const z = this.weights.reduce((s, w, j) => s + w * x[j], 0) + this.bias;
    return 1 / (1 + Math.exp(-Math.max(-50.0, Math.min(50.0, z))));
  }

  predict(rows: readonly Row[]): number[] {
    return rows.map((r) => (this.sigmoid(this.vector(r)) >= this.threshold ? 1 : 0));
  }
}

const ML_TASKS = new Set([
  "binary_classification", "multiclass_classification", "regression",
  "ranking", "forecasting", "anomaly_detection", "clustering",
]);
const STRONG_BASELINE_KINDS = new Set(["heuristic", "current_system"]);

function getPath(doc: Json, path: string): Json | undefined {
  let node: Json = doc;
  for (const part of path.split(".")) {
    if (!isObject(node) || !(part in node)) {
      return undefined;
    }
    node = node[part];
  }
  return node;
}

function isNumber(value: Json | undefined): value is number {
  return typeof value === "number";
}

function text(doc: Json, path: string): boolean {
  const value = getPath(doc, path);
  return typeof value === "string" && value.trim() !== "";
}

function items(doc: Json, path: string): boolean {
  const value = getPath(doc, path);
  return Array.isArray(value) && value.length > 0;
}

function positive(doc: Json, path: string): boolean {
  const value = getPath(doc, path);
  return isNumber(value) && Number.isFinite(value) && value > 0;
}

function choice(doc: Json, path: string, allowed: Set<string>): boolean {
  const value = getPath(doc, path);
  return typeof value === "string" && allowed.has(value);
}

function checkBaselines(doc: Json): boolean {
  const baselines = getPath(doc, "baselines");
  if (!Array.isArray(baselines)) {
    return false;
  }
  return baselines.some((b) => isObject(b) && typeof b.kind === "string" && STRONG_BASELINE_KINDS.has(b.kind));
}

function checkRollout(doc: Json): boolean {
  const stages = getPath(doc, "rollout.stages");
  if (!Array.isArray(stages) || !stages.every((stage) => typeof stage === "string")) {
    return false;
  }
  return (stages.includes("shadow") || stages.includes("canary")) && text(doc, "rollout.rollback");
}

function checkFailureModes(doc: Json): boolean {
  const modes = getPath(doc, "failure_modes");
  if (!Array.isArray(modes) || modes.length === 0) {
    return false;
  }
  return modes.every((m) => isObject(m) && pyStr("default_action" in m ? m.default_action : "").trim() !== "");
}

function workloadFromDoc(doc: Json): Workload | null {
  const needed: [keyof Workload, string][] = [
    ["entities", "serving.entities"],
    ["requests_per_day", "serving.requests_per_day"],
    ["peak_qps", "budgets.peak_qps"],
    ["max_staleness_hours", "serving.max_staleness_hours"],
    ["latency_budget_ms", "budgets.latency_ms_p99"],
  ];
  const values: { [key: string]: number } = {};
  for (const [key, path] of needed) {
    const value = getPath(doc, path);
    if (!isNumber(value) || !Number.isFinite(value) || value < 0) {
      return null;
    }
    values[key] = value;
  }
  const title = getPath(doc, "title");
  return workload(
    pyTruthy(title) ? pyStr(title) : "design doc",
    values.entities,
    values.requests_per_day,
    values.peak_qps,
    values.max_staleness_hours,
    values.latency_budget_ms,
  );
}

function checkServingFit(doc: Json, costs: CostModel = costModel()): boolean {
  const w = workloadFromDoc(doc);
  const mode = getPath(doc, "serving.mode");
  const budget = getPath(doc, "budgets.max_dollars_per_day");
  if (w === null || typeof mode !== "string" || !positive(doc, "budgets.max_dollars_per_day") || !isNumber(budget)) {
    return false;
  }
  const [, plans] = chooseServing(w, costs);
  const chosen = new Map(plans.map((p) => [p.mode, p])).get(mode);
  return chosen !== undefined && chosen.feasible && chosen.dollars_per_day <= budget;
}

type CheckItem = {
  key: string;
  weight: number;
  blocking: boolean;
  message: string;
  check: (doc: Json) => boolean;
};

function item(key: string, weight: number, blocking: boolean, message: string, check: (doc: Json) => boolean): CheckItem {
  return { key, weight, blocking, message, check };
}

const CHECKLIST: CheckItem[] = [
  item("business_goal", 1, false, "state the business goal in one sentence", (d) => text(d, "problem.business_goal")),
  item("ml_task", 1, false, "name the ML task type", (d) => choice(d, "problem.ml_task", ML_TASKS)),
  item("decision", 2, true, "name the action that uses each prediction", (d) => text(d, "problem.decision")),
  item("why_not_rules", 1, false, "explain why a rule or lookup is not enough", (d) => text(d, "problem.why_not_rules")),
  item("offline_metric", 1, false, "list the offline metrics", (d) => items(d, "metrics.offline")),
  item("online_metric", 1, false, "list the online metrics", (d) => items(d, "metrics.online")),
  item("business_metric", 2, true, "list the business metric the model must move", (d) => items(d, "metrics.business")),
  item("guardrails", 1, false, "list guardrail metrics that must not get worse", (d) => items(d, "metrics.guardrails")),
  item("baselines", 2, true, "add a heuristic or current-system baseline", checkBaselines),
  item("label_source", 1, false, "say where the labels come from", (d) => text(d, "data.label_source")),
  item("label_delay", 1, false, "give the label delay in days", (d) => {
    const v = getPath(d, "data.label_delay_days");
    return typeof v === "number" || typeof v === "boolean";
  }),
  item("no_leakage", 2, true, "confirm every feature exists at prediction time", (d) => getPath(d, "data.features_available_at_prediction_time") === true),
  item("budgets", 1, false, "set latency, peak QPS, and daily cost budgets", (d) =>
    ["budgets.latency_ms_p99", "budgets.peak_qps", "budgets.max_dollars_per_day"].every((p) => positive(d, p)),
  ),
  item("serving_fit", 1, false, "pick a serving mode that meets the staleness, latency, and cost budgets", (d) => checkServingFit(d)),
  item("rollout", 2, true, "plan a shadow or canary stage and a rollback", checkRollout),
  item("feedback_loop", 1, false, "describe the feedback loop risk and its mitigation", (d) => text(d, "feedback_loop.risk") && text(d, "feedback_loop.mitigation")),
  item("failure_modes", 2, true, "give every failure mode a default action", checkFailureModes),
  item("monitoring", 1, false, "list what you monitor after launch", (d) => items(d, "monitoring")),
];

type Review = {
  score: number;
  verdict: string;
  passed: string[];
  failed: [string, boolean, string][];
};

function reviewDesignDoc(doc: Json, readyScore = 0.85): Review {
  const total = CHECKLIST.reduce((s, it) => s + it.weight, 0);
  const passed: string[] = [];
  const failed: [string, boolean, string][] = [];
  let earned = 0;
  for (const it of CHECKLIST) {
    if (it.check(doc)) {
      passed.push(it.key);
      earned += it.weight;
    } else {
      failed.push([it.key, it.blocking, it.message]);
    }
  }
  const score = earned / total;
  const blocked = failed.some(([, blocking]) => blocking);
  const verdict = score >= readyScore && !blocked ? "ready for review" : "revise";
  failed.sort((a, b) => {
    const ka = a[1] ? 0 : 1;
    const kb = b[1] ? 0 : 1;
    if (ka !== kb) return ka - kb;
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });
  return { score, verdict, passed, failed };
}

const WEAK_DOC: Json = {
  title: "Churn model v1",
  problem: { business_goal: "Reduce churn", ml_task: "binary_classification" },
  metrics: { offline: ["AUC"] },
  baselines: [{ name: "always predict no churn", kind: "trivial" }],
  data: { label_source: "cancellations table", features_available_at_prediction_time: false },
  serving: { mode: "online" },
};

const STRONG_DOC: Json = {
  title: "Churn save-offer model",
  problem: {
    business_goal: "Cut monthly subscriber churn from 4.0 to 3.5 percent",
    ml_task: "binary_classification",
    decision: "Send a save offer to the 5 percent of users with the highest churn score each night",
    why_not_rules: "The idle-days rule reaches F1 0.50 and misses churners who still log in",
  },
  metrics: {
    offline: ["F1 at the offer threshold", "precision at top 5 percent"],
    online: ["offer acceptance rate", "score distribution"],
    business: ["30-day churn rate in the treated group versus a holdout"],
    guardrails: ["offer cost per saved user", "unsubscribe rate"],
  },
  baselines: [
    { name: "majority class", kind: "trivial" },
    { name: "days idle above a fitted threshold", kind: "heuristic" },
  ],
  data: {
    label_source: "billing cancellations joined 30 days after the score date",
    label_delay_days: 30,
    features_available_at_prediction_time: true,
  },
  budgets: { latency_ms_p99: 100, peak_qps: 40, max_dollars_per_day: 5 },
  serving: { mode: "batch", entities: 2000000, requests_per_day: 300000, max_staleness_hours: 24 },
  rollout: { stages: ["shadow", "canary", "ab_test"], rollback: "Point the job back to the previous model version" },
  feedback_loop: {
    risk: "Users who accept offers stay, so future labels under-count churn",
    mitigation: "Keep a 5 percent random holdout that never gets offers",
  },
  failure_modes: [
    { mode: "nightly job fails", default_action: "Serve yesterday's scores for up to 48 hours" },
    { mode: "score missing for a new user", default_action: "Use the idle-days rule" },
  ],
  monitoring: ["input drift on days_idle", "share of users scored", "offer acceptance rate"],
};

const SCENARIOS: Workload[] = [
  workload("nightly churn scores", 2_000_000, 300_000, 40, 24, 100),
  workload("feed ranking, 2-hour freshness", 5_000_000, 2_000_000, 120, 2, 80),
  workload("fraud check at payment", 10_000_000, 800_000, 60, 0.05, 50),
];

function printServing(costs: CostModel = costModel()): void {
  console.log("=== Batch versus online serving ===");
  for (const w of SCENARIOS) {
    const [best, plans] = chooseServing(w, costs);
    console.log(`\n${w.name}`);
    for (const p of plans) {
      const cost = Number.isFinite(p.dollars_per_day) ? `$${withCommas(fx(p.dollars_per_day, 2))}/day` : "n/a";
      const state = p.feasible ? "ok " : "no ";
      console.log(`  ${state}${p.mode.padEnd(7)} ${cost.padStart(14)}  ${fx(p.latency_ms, 0).padStart(5)} ms  ${p.reason}`);
    }
    console.log(`  choose: ${best ? best.mode : "none, change the budgets"}`);
  }
}

function printBaselines(): void {
  console.log("\n=== Model versus baselines (churn, metric F1) ===");
  const [trainRows, trainY] = makeChurnData(2000, 1);
  const [testRows, testY] = makeChurnData(1000, 2);
  const model = new LogisticModel().fit(trainRows, trainY);
  const threshold = fitRule(trainRows, trainY, "days_idle");
  const report = compareToBaselines(
    testY,
    model.predict(testRows),
    [
      ["majority class", majorityBaseline(trainY, testY.length)],
      ["random at base rate", baseRateBaseline(trainY, testY.length)],
      [`days_idle > ${fg(threshold)}`, applyRule(testRows, "days_idle", threshold)],
    ],
    f1Score,
    "F1",
  );
  const ordered = [...report.scores].sort((a, b) => b[1] - a[1]);
  for (const [name, score] of ordered) {
    console.log(`  ${name.padEnd(24)} ${fx(score, 3)}`);
  }
  const verdict = report.beatsBaselines ? "beats" : "does not beat";
  console.log(`  model ${verdict} the strongest baseline (${report.bestBaseline}) by ${signed(report.lift, 3)}`);
}

function printReview(doc: Json): void {
  const review = reviewDesignDoc(doc);
  const title = isObject(doc) && "title" in doc ? pyStr(doc.title) : "design doc";
  console.log(`\n${title}: score ${fx(review.score, 2)}, verdict: ${review.verdict}`);
  for (const [key, blocking, message] of review.failed) {
    const tag = blocking ? "BLOCKING" : "missing ";
    console.log(`  ${tag} ${key}: ${message}`);
  }
}

function main(argv: string[]): number {
  if (argv.length > 1) {
    printReview(JSON.parse(readFileSync(argv[1], "utf-8")) as Json);
    return 0;
  }
  printServing();
  printBaselines();
  console.log("\n=== Design doc review ===");
  printReview(WEAK_DOC);
  printReview(STRONG_DOC);
  return 0;
}

process.exitCode = main(process.argv.slice(1));
