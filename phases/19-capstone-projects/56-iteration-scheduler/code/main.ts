// Lesson: Iteration Scheduler (phase 19 / lesson 56)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/56-iteration-scheduler/docs/en.md
// Run: npx tsx phases/19-capstone-projects/56-iteration-scheduler/code/main.ts

import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";

export class PyFloat {
  constructor(readonly v: number) {}
}

export type Json = null | boolean | number | string | PyFloat | Json[] | { [key: string]: Json };
export type Obj = { [key: string]: Json };

const fl = (v: number): PyFloat => new PyFloat(v);

export function pyFloatRepr(x: number): string {
  if (Number.isNaN(x)) return "NaN";
  if (!Number.isFinite(x)) return x > 0 ? "Infinity" : "-Infinity";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const [mant, expStr] = x.toExponential().split("e");
  const exp = Number(expStr);
  const neg = mant.startsWith("-");
  const digits = mant.replace("-", "").replace(".", "");
  let body: string;
  if (exp < -4 || exp >= 16) {
    const frac = digits.length > 1 ? "." + digits.slice(1) : "";
    body = digits[0] + frac + "e" + (exp < 0 ? "-" : "+") + String(Math.abs(exp)).padStart(2, "0");
  } else if (exp < 0) {
    body = "0." + "0".repeat(-exp - 1) + digits;
  } else if (digits.length <= exp + 1) {
    body = digits + "0".repeat(exp + 1 - digits.length) + ".0";
  } else {
    body = digits.slice(0, exp + 1) + "." + digits.slice(exp + 1);
  }
  return (neg ? "-" : "") + body;
}

function fmtFixed(x: number, n: number): string {
  const neg = x < 0 || Object.is(x, -0);
  const a = Math.abs(x);
  const wide = a.toFixed(Math.min(100, n + 30));
  const dot = wide.indexOf(".");
  const tail = wide.slice(dot + 1 + n);
  let out = a.toFixed(n);
  if (/^50*$/.test(tail)) {
    const head = wide.slice(0, dot + 1 + n);
    const trimmed = n === 0 ? head.slice(0, -1) : head;
    if (Number(trimmed[trimmed.length - 1]) % 2 === 0) out = trimmed;
  }
  return (neg ? "-" : "") + out;
}

function pyRound(x: number, n: number): number {
  return Number(fmtFixed(x, n));
}

function jsonStr(s: string): string {
  return (
    '"' +
    s.replace(/[\\"\u0000-\u001f\u007f-￿]/g, (c) => {
      if (c === '"') return '\\"';
      if (c === "\\") return "\\\\";
      if (c === "\n") return "\\n";
      if (c === "\r") return "\\r";
      if (c === "\t") return "\\t";
      if (c === "\b") return "\\b";
      if (c === "\f") return "\\f";
      return "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0");
    }) +
    '"'
  );
}

export function pyDumps(v: Json, indent: number | null = null, level = 0): string {
  if (v === null) return "null";
  if (v === true) return "true";
  if (v === false) return "false";
  if (v instanceof PyFloat) return pyFloatRepr(v.v);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : pyFloatRepr(v);
  if (typeof v === "string") return jsonStr(v);
  let open: string;
  let close: string;
  let items: string[];
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    open = "[";
    close = "]";
    items = v.map((x) => pyDumps(x, indent, level + 1));
  } else {
    const keys = Object.keys(v);
    if (keys.length === 0) return "{}";
    open = "{";
    close = "}";
    items = keys.map((k) => jsonStr(k) + ": " + pyDumps(v[k], indent, level + 1));
  }
  if (indent === null) return open + items.join(", ") + close;
  const pad = "\n" + " ".repeat(indent * (level + 1));
  return open + pad + items.join("," + pad) + "\n" + " ".repeat(indent * level) + close;
}

class Mulberry32 {
  private state: number;
  private spare: number | null = null;

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

  normal(mu: number, sigma: number): number {
    if (this.spare !== null) {
      const z = this.spare;
      this.spare = null;
      return mu + sigma * z;
    }
    let u = 0.0;
    while (u === 0.0) u = this.random();
    const v = this.random();
    const r = Math.sqrt(-2.0 * Math.log(u));
    this.spare = r * Math.sin(2.0 * Math.PI * v);
    return mu + sigma * r * Math.cos(2.0 * Math.PI * v);
  }
}

export class Hypothesis {
  constructor(
    public id: string,
    public branch: string,
    public payload: Obj = {},
  ) {}

  toDict(): Obj {
    return { id: this.id, branch: this.branch, payload: { ...this.payload } };
  }
}

export class Result {
  constructor(
    public hypothesis_id: string,
    public branch: string,
    public reward: number,
    public payload: Obj = {},
  ) {}

  toDict(): Obj {
    return {
      hypothesis_id: this.hypothesis_id,
      branch: this.branch,
      reward: fl(this.reward),
      payload: { ...this.payload },
    };
  }
}

export class BranchStats {
  constructor(
    public branch: string,
    public runs = 0,
    public reward_sum = 0.0,
    public pruned = false,
    public paper_triggered = false,
  ) {}

  get mean(): number {
    return this.runs ? this.reward_sum / this.runs : 0.0;
  }

  toDict(): Obj {
    return {
      branch: this.branch,
      runs: this.runs,
      reward_sum: fl(this.reward_sum),
      mean: fl(this.mean),
      pruned: this.pruned,
      paper_triggered: this.paper_triggered,
    };
  }
}

export class TraceEvent {
  constructor(
    public kind: string,
    public payload: Obj,
  ) {}

  toDict(): Obj {
    return { kind: this.kind, payload: { ...this.payload } };
  }
}

export class SchedulerReport {
  constructor(
    public stop_reason: string,
    public experiments_run: number,
    public wall_seconds: number,
    public branches: BranchStats[],
    public paper_triggers: string[],
    public trace: TraceEvent[],
  ) {}

  toDict(): Obj {
    return {
      stop_reason: this.stop_reason,
      experiments_run: this.experiments_run,
      wall_seconds: fl(pyRound(this.wall_seconds, 4)),
      branches: this.branches.map((b) => b.toDict()),
      paper_triggers: [...this.paper_triggers],
      trace: this.trace.map((e) => e.toDict()),
    };
  }
}

export type Runner = (hyp: Hypothesis) => Promise<Result>;
export type Expander = (result: Result) => Hypothesis[];

export function ucbScore(branchStats: BranchStats, totalRuns: number, c: number): number {
  if (branchStats.runs === 0) return Infinity;
  if (totalRuns === 0) return branchStats.mean;
  return branchStats.mean + c * Math.sqrt(Math.log(Math.max(totalRuns, 1)) / branchStats.runs);
}

export interface SchedulerOptions {
  slots?: number;
  max_experiments?: number;
  max_seconds?: number;
  exploration_c?: number;
  paper_threshold?: number;
  prune_floor?: number;
  prune_after_runs?: number;
  expander?: Expander | null;
}

interface Task {
  promise: Promise<void>;
  settled: boolean;
  value?: Result;
  error?: unknown;
}

function pyRepr(exc: unknown): string {
  if (exc instanceof Error) {
    const msg = exc.message;
    const quote = msg.includes("'") && !msg.includes('"') ? '"' : "'";
    return `${exc.constructor.name}(${quote}${msg}${quote})`;
  }
  return String(exc);
}

export class IterationScheduler {
  slots: number;
  max_experiments: number;
  max_seconds: number;
  exploration_c: number;
  paper_threshold: number;
  prune_floor: number;
  prune_after_runs: number;
  expander: Expander | null;

  constructor(
    public runner: Runner,
    opts: SchedulerOptions = {},
  ) {
    this.slots = opts.slots ?? 3;
    this.max_experiments = opts.max_experiments ?? 50;
    this.max_seconds = opts.max_seconds ?? 30.0;
    this.exploration_c = opts.exploration_c ?? Math.sqrt(2.0);
    this.paper_threshold = opts.paper_threshold ?? 0.7;
    this.prune_floor = opts.prune_floor ?? 0.2;
    this.prune_after_runs = opts.prune_after_runs ?? 3;
    this.expander = opts.expander ?? null;
    if (this.slots < 1) throw new Error("slots must be >= 1");
    if (this.max_experiments < 1) throw new Error("max_experiments must be >= 1");
  }

  private pickNext(queue: Hypothesis[], stats: Map<string, BranchStats>): number | null {
    let bestIdx: number | null = null;
    let bestScore = -Infinity;
    let totalRuns = 0;
    for (const s of stats.values()) totalRuns += s.runs;
    queue.forEach((hyp, idx) => {
      const bs = stats.get(hyp.branch);
      if (bs !== undefined && bs.pruned) return;
      const score = ucbScore(bs ?? new BranchStats(hyp.branch), totalRuns, this.exploration_c);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });
    return bestIdx;
  }

  async run(seed: Hypothesis[]): Promise<SchedulerReport> {
    const queue: Hypothesis[] = [...seed];
    const stats = new Map<string, BranchStats>();
    for (const h of seed) stats.set(h.branch, new BranchStats(h.branch));
    const inFlight = new Map<Task, Hypothesis>();
    const trace: TraceEvent[] = [];
    const triggers: string[] = [];
    let experimentsRun = 0;
    let stopReason = "queue_empty";
    const t0 = performance.now();

    const deadlineHit = (): boolean => (performance.now() - t0) / 1000 >= this.max_seconds;
    const budgetHit = (): boolean => experimentsRun >= this.max_experiments;
    const statsFor = (branch: string): BranchStats => {
      let bs = stats.get(branch);
      if (bs === undefined) {
        bs = new BranchStats(branch);
        stats.set(branch, bs);
      }
      return bs;
    };

    const dispatchUntilFull = (): void => {
      while (queue.length && inFlight.size < this.slots && !budgetHit() && !deadlineHit()) {
        const idx = this.pickNext(queue, stats);
        if (idx === null) return;
        const hyp = queue.splice(idx, 1)[0];
        statsFor(hyp.branch);
        const task: Task = { promise: Promise.resolve(), settled: false };
        task.promise = this.runner(hyp).then(
          (value) => {
            task.settled = true;
            task.value = value;
          },
          (error: unknown) => {
            task.settled = true;
            task.error = error;
          },
        );
        inFlight.set(task, hyp);
        experimentsRun += 1;
        trace.push(new TraceEvent("dispatch", { hypothesis_id: hyp.id, branch: hyp.branch, slot_count: inFlight.size }));
      }
    };

    dispatchUntilFull();

    while (inFlight.size) {
      await Promise.race([...inFlight.keys()].map((t) => t.promise));
      const done = [...inFlight.keys()].filter((t) => t.settled);
      for (const task of done) {
        const hyp = inFlight.get(task) as Hypothesis;
        inFlight.delete(task);
        if (task.error !== undefined || task.value === undefined) {
          trace.push(new TraceEvent("error", { hypothesis_id: hyp.id, branch: hyp.branch, error: pyRepr(task.error) }));
          continue;
        }
        const result = task.value;
        const bs = statsFor(result.branch);
        bs.runs += 1;
        bs.reward_sum += result.reward;
        trace.push(
          new TraceEvent("result", {
            hypothesis_id: result.hypothesis_id,
            branch: result.branch,
            reward: fl(result.reward),
            branch_mean: fl(bs.mean),
            branch_runs: bs.runs,
          }),
        );

        if (!bs.paper_triggered && bs.mean >= this.paper_threshold && bs.runs >= 1) {
          bs.paper_triggered = true;
          triggers.push(result.branch);
          trace.push(new TraceEvent("paper.trigger", { branch: result.branch, mean: fl(bs.mean) }));
        }

        if (!bs.pruned && bs.runs >= this.prune_after_runs && bs.mean < this.prune_floor) {
          bs.pruned = true;
          const kept = queue.filter((h) => h.branch !== bs.branch);
          queue.splice(0, queue.length, ...kept);
          trace.push(new TraceEvent("prune", { branch: bs.branch, mean: fl(bs.mean), runs: bs.runs }));
        }

        if (this.expander !== null && result.reward >= this.paper_threshold) {
          const followups = this.expander(result);
          if (followups.length) {
            queue.push(...followups);
            trace.push(new TraceEvent("expand", { branch: result.branch, added: followups.map((h) => h.id) }));
          }
        }
      }

      if (budgetHit()) {
        stopReason = "max_experiments";
        break;
      }
      if (deadlineHit()) {
        stopReason = "deadline";
        break;
      }

      dispatchUntilFull();
    }

    for (const task of [...inFlight.keys()]) {
      await task.promise;
      if (task.error !== undefined || task.value === undefined) {
        inFlight.delete(task);
        continue;
      }
      const result = task.value;
      const bs = statsFor(result.branch);
      bs.runs += 1;
      bs.reward_sum += result.reward;
      inFlight.delete(task);
      if (!bs.paper_triggered && bs.mean >= this.paper_threshold) {
        bs.paper_triggered = true;
        triggers.push(result.branch);
        trace.push(new TraceEvent("paper.trigger", { branch: result.branch, mean: fl(bs.mean) }));
      }
      trace.push(new TraceEvent("result.drain", { branch: result.branch, reward: fl(result.reward) }));
    }

    const wall = (performance.now() - t0) / 1000;
    const branches = [...stats.values()].sort((a, b) => (a.branch < b.branch ? -1 : a.branch > b.branch ? 1 : 0));
    return new SchedulerReport(stopReason, experimentsRun, wall, branches, triggers, trace);
  }
}

export interface RunnerOptions {
  noise?: number;
  delay_ms?: number;
  seed?: number;
}

export function makeDeterministicRunner(baseRewards: Record<string, number>, opts: RunnerOptions = {}): Runner {
  const noise = opts.noise ?? 0.05;
  const delayMs = opts.delay_ms ?? 5.0;
  const rng = new Mulberry32(opts.seed ?? 0);

  return async (hyp: Hypothesis): Promise<Result> => {
    const base = Object.hasOwn(baseRewards, hyp.branch) ? baseRewards[hyp.branch] : 0.5;
    const bump = rng.normal(0.0, noise);
    const reward = Math.max(0.0, Math.min(1.0, base + bump));
    await sleep(delayMs);
    return new Result(hyp.id, hyp.branch, reward, { base: fl(base), noise: fl(noise) });
  };
}

export function deterministicExpander(result: Result): Hypothesis[] {
  return [1, 2].map((i) => new Hypothesis(`${result.hypothesis_id}-f${i}`, result.branch, { parent: result.hypothesis_id }));
}

async function demoAsync(): Promise<Obj> {
  const seed = [
    new Hypothesis("h-a-1", "branch-a"),
    new Hypothesis("h-b-1", "branch-b"),
    new Hypothesis("h-c-1", "branch-c"),
    new Hypothesis("h-d-1", "branch-d"),
  ];
  const runner = makeDeterministicRunner(
    { "branch-a": 0.85, "branch-b": 0.55, "branch-c": 0.15, "branch-d": 0.4 },
    { seed: 7, delay_ms: 2.0 },
  );
  const sched = new IterationScheduler(runner, {
    slots: 3,
    max_experiments: 20,
    paper_threshold: 0.7,
    prune_floor: 0.25,
    prune_after_runs: 3,
    expander: deterministicExpander,
  });
  const report = await sched.run(seed);
  return report.toDict();
}

if (require.main === module) {
  demoAsync().then((r) => {
    console.log(
      pyDumps(
        {
          stop_reason: r["stop_reason"],
          experiments_run: r["experiments_run"],
          wall_seconds: r["wall_seconds"],
          paper_triggers: r["paper_triggers"],
          branches: r["branches"],
        },
        2,
      ),
    );
  });
}
