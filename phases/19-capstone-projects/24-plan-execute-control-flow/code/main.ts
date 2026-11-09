// Lesson: Plan-Execute Control Flow (phase 19 / lesson 24)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/24-plan-execute-control-flow/docs/en.md
// Run: npx tsx phases/19-capstone-projects/24-plan-execute-control-flow/code/main.ts

type Args = Record<string, unknown>;

function pyJsonDumpsSorted(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(pyJsonDumpsSorted).join(", ") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => `${JSON.stringify(k)}: ${pyJsonDumpsSorted(obj[k])}`).join(", ") + "}";
}

export class Step {
  result: unknown = null;
  error: string | null = null;
  constructor(
    public id: number,
    public toolName: string,
    public args: Args,
    public expectedOutcome: string,
  ) {}

  signature(): string {
    return JSON.stringify([this.toolName, pyJsonDumpsSorted(this.args)]);
  }
}

export class PlanDiff {
  constructor(
    public revision: number,
    public removed: number[],
    public added: number[],
    public revised: number[],
  ) {}

  toDict(): Record<string, unknown> {
    return {
      revision: this.revision,
      removed: [...this.removed],
      added: [...this.added],
      revised: [...this.revised],
    };
  }
}

export class Event {
  ts: number;
  constructor(public type: string, public payload: Record<string, unknown>) {
    this.ts = Date.now() / 1000;
  }
}

export class SessionResult {
  constructor(
    public status: string,
    public reason: string,
    public history: Step[],
    public revisions: PlanDiff[],
    public events: Event[],
  ) {}

  toDict(): Record<string, unknown> {
    return {
      status: this.status,
      reason: this.reason,
      history: this.history.map((s) => ({
        id: s.id, tool: s.toolName, args: s.args,
        result: s.result, error: s.error,
      })),
      revisions: this.revisions.map((r) => r.toDict()),
      events: this.events.map((e) => ({ type: e.type, payload: e.payload, ts: e.ts })),
    };
  }
}

export type Planner = (goal: string, history: Step[], lastError: string | null) => Step[];
export type ToolExecutor = (tool: string, args: Args) => unknown;

export class ToolFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolFailure";
  }
}

function diffPlans(old: Step[], next: Step[], revision: number): PlanDiff {
  const oldIds = new Set(old.map((s) => s.id));
  const newIds = new Set(next.map((s) => s.id));
  const removed = [...oldIds].filter((i) => !newIds.has(i)).sort((a, b) => a - b);
  const added = [...newIds].filter((i) => !oldIds.has(i)).sort((a, b) => a - b);
  const revised: number[] = [];
  const oldById = new Map(old.map((s) => [s.id, s] as [number, Step]));
  for (const s of next) {
    if (oldIds.has(s.id) && oldById.get(s.id)!.signature() !== s.signature()) revised.push(s.id);
  }
  return new PlanDiff(revision, removed, added, revised);
}

export class PlanExecuteAgent {
  private planner: Planner;
  private executor: ToolExecutor;
  maxSteps: number;
  maxReplans: number;
  private events: Event[] = [];

  constructor(
    planner: Planner,
    executor: ToolExecutor,
    opts: { maxSteps?: number; maxReplans?: number } = {},
  ) {
    this.planner = planner;
    this.executor = executor;
    this.maxSteps = opts.maxSteps ?? 12;
    this.maxReplans = opts.maxReplans ?? 5;
  }

  private emit(etype: string, payload: Record<string, unknown>): void {
    this.events.push(new Event(etype, payload));
  }

  run(goal: string): SessionResult {
    this.events = [];
    const history: Step[] = [];
    const revisions: PlanDiff[] = [];
    let stepsTaken = 0;
    let replansUsed = 0;
    let lastError: string | null = null;

    let plan = this.planner(goal, history, null);
    this.emit("plan.commit", { revision: 0, steps: summarize(plan) });

    if (plan.length === 0) {
      this.emit("session.complete", { reason: "no_plan" });
      return new SessionResult("failed", "no_plan", history, revisions, [...this.events]);
    }

    let cursor = 0;
    let revision = 0;

    while (cursor < plan.length) {
      if (stepsTaken >= this.maxSteps) {
        this.emit("session.complete", { reason: "step_budget" });
        return new SessionResult("failed", "step_budget", history, revisions, [...this.events]);
      }

      const step = plan[cursor];
      this.emit("step.start", { step_id: step.id, tool: step.toolName });
      try {
        step.result = this.executor(step.toolName, step.args);
        this.emit("step.end", { step_id: step.id, outcome: "ok" });
        history.push(step);
        cursor += 1;
        stepsTaken += 1;
        continue;
      } catch (exc) {
        const name = exc instanceof Error ? exc.name : "Exception";
        const msg = exc instanceof Error ? exc.message : String(exc);
        step.error = `${name}: ${msg}`;
        this.emit("step.end", { step_id: step.id, outcome: "error", error: step.error });
        history.push(step);
        stepsTaken += 1;
        lastError = step.error;
      }

      if (replansUsed >= this.maxReplans) {
        this.emit("session.complete", { reason: "replan_budget" });
        return new SessionResult("failed", "replan_budget", history, revisions, [...this.events]);
      }

      replansUsed += 1;
      revision += 1;
      const newPlan = this.planner(goal, history, lastError);
      this.emit("plan.draft", { revision, steps: summarize(newPlan) });
      if (newPlan.length === 0) {
        this.emit("session.complete", { reason: "no_plan" });
        return new SessionResult("failed", "no_plan", history, revisions, [...this.events]);
      }
      const diff = diffPlans(plan.slice(cursor), newPlan, revision);
      revisions.push(diff);
      this.emit("plan.diff", diff.toDict());
      plan = newPlan;
      cursor = 0;
      this.emit("plan.commit", { revision, steps: summarize(plan) });
    }

    this.emit("session.complete", { reason: "goal_met" });
    return new SessionResult("completed", "goal_met", history, revisions, [...this.events]);
  }
}

function summarize(plan: Step[]): Record<string, unknown>[] {
  return plan.map((s) => ({ id: s.id, tool: s.toolName, outcome: s.expectedOutcome }));
}

export function makeDeterministicPlanner(failStepId: number | null, recovery: string = "route_around"): Planner {
  return (goal: string, history: Step[], lastError: string | null): Step[] => {
    if (lastError === null) {
      const initial = [
        new Step(1, "fetch", { key: "input" }, "loaded user input"),
        new Step(2, "transform", { mode: "v1" }, "computed v1 form"),
        new Step(3, "render", {}, "rendered output"),
        new Step(4, "submit", {}, "submitted to backend"),
      ];
      if (failStepId !== null) {
        for (const s of initial) {
          if (s.id === failStepId) s.args = { ...s.args, _force_fail: true };
        }
      }
      return initial;
    }
    if (recovery === "route_around" && lastError.includes("transform")) {
      return [
        new Step(2, "transform", { mode: "v2" }, "computed via fallback"),
        new Step(3, "render", {}, "rendered output"),
        new Step(4, "submit", {}, "submitted to backend"),
      ];
    }
    if (recovery === "give_up") {
      return [
        new Step(98, "log_failure", { why: lastError || "" }, "logged failure"),
        new Step(99, "notify_user", {}, "told the user"),
      ];
    }
    return [];
  };
}

function demo(): void {
  const counters = { transform_v1_calls: 0 };

  const executor = (tool: string, args: Args): unknown => {
    if (args._force_fail) {
      counters.transform_v1_calls += 1;
      throw new ToolFailure(`${tool} marker-forced failure`);
    }
    if (tool === "fetch") return { k: "v" };
    if (tool === "transform") {
      if (args.mode === "v1") {
        counters.transform_v1_calls += 1;
        throw new ToolFailure("transform v1 backend down");
      }
      return { ok: true };
    }
    if (tool === "render") return "html";
    if (tool === "submit") return { id: 1 };
    if (tool === "log_failure" || tool === "notify_user") return "logged";
    throw new ToolFailure(`unknown tool ${tool}`);
  };

  const agent = new PlanExecuteAgent(
    makeDeterministicPlanner(2, "route_around"),
    executor,
    { maxSteps: 12, maxReplans: 5 },
  );
  const res = agent.run("ship the report");
  console.log(JSON.stringify({
    status: res.status,
    reason: res.reason,
    history: res.history.map((s) => [s.id, s.toolName, Boolean(s.error)]),
    revisions: res.revisions.map((r) => r.toDict()),
    events: res.events.map((e) => e.type),
    transform_v1_calls: counters.transform_v1_calls,
  }, null, 2));
}

demo();
