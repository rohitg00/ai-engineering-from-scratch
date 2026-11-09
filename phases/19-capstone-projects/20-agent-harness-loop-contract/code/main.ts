// Lesson: Agent Harness Loop Contract (phase 19 / lesson 20)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/20-agent-harness-loop-contract/docs/en.md
// Run: npx tsx phases/19-capstone-projects/20-agent-harness-loop-contract/code/main.ts

import assert from "node:assert";

enum State {
  IDLE = "idle",
  PLANNING = "planning",
  EXECUTING = "executing",
  AWAITING_TOOL = "awaiting_tool",
  REFLECTING = "reflecting",
  DONE = "done",
}

const HOOK_TOPICS = [
  "before_plan",
  "after_plan",
  "before_step",
  "after_step",
  "before_tool_call",
  "after_tool_call",
  "on_error",
  "on_pause",
  "on_budget_exceeded",
  "on_complete",
] as const;

const EVENT_TYPES = [
  "session.start",
  "plan.draft",
  "plan.commit",
  "step.start",
  "step.end",
  "tool.call",
  "tool.result",
  "tool.error",
  "budget.warn",
  "session.pause",
  "session.complete",
] as const;

type Payload = Record<string, unknown>;

class HookAbort extends Error {}

function now(): number {
  return Date.now() / 1000;
}

class Event {
  constructor(public type: string, public payload: Payload, public ts: number) {}

  toDict(): Payload {
    return { type: this.type, payload: this.payload, ts: this.ts };
  }
}

class Budget {
  turns = 0;
  toolCalls = 0;
  startedAt: number = now();

  constructor(
    public maxTurns = 8,
    public maxToolCalls = 16,
    public maxWallSeconds = 30.0,
  ) {}

  remainingSeconds(): number {
    return Math.max(0.0, this.maxWallSeconds - (now() - this.startedAt));
  }

  exceeded(): string | null {
    if (this.turns >= this.maxTurns) return "turns";
    if (this.toolCalls >= this.maxToolCalls) return "tool_calls";
    if (this.remainingSeconds() <= 0.0) return "wall_clock";
    return null;
  }
}

class Step {
  result: unknown = null;
  error: string | null = null;

  constructor(
    public id: number,
    public description: string,
    public requiresTool: boolean,
    public toolName: string | null = null,
    public toolArgs: Payload = {},
  ) {}
}

class PullRequest {
  constructor(public reason: string, public state: State, public payload: Payload) {}
}

class SessionResult {
  constructor(public state: State, public reason: string, public steps: Step[], public events: Event[]) {}
}

type Hook = (payload: Payload) => unknown;

class HookRegistry {
  private subs: Map<string, Hook[]> = new Map(HOOK_TOPICS.map((t) => [t, []]));

  on(topic: string, fn: Hook): void {
    const list = this.subs.get(topic);
    if (list === undefined) throw new Error(`unknown hook topic: ${topic}`);
    list.push(fn);
  }

  fire(topic: string, payload: Payload): unknown[] {
    const results: unknown[] = [];
    for (const fn of this.subs.get(topic)!) results.push(fn(payload));
    return results;
  }
}

type Planner = (goal: string, history: Step[]) => Step[];

function defaultPlanner(goal: string, history: Step[]): Step[] {
  if (history.length > 0) return [];
  return [
    new Step(1, `interpret goal: ${goal}`, false),
    new Step(2, "fetch user record", true, "db.get_user", { id: 42 }),
    new Step(3, "summarize and respond", true, "format.summary", { style: "short" }),
  ];
}

const LEGAL: Record<State, Set<State>> = {
  [State.IDLE]: new Set([State.PLANNING]),
  [State.PLANNING]: new Set([State.EXECUTING, State.IDLE, State.DONE]),
  [State.EXECUTING]: new Set([State.AWAITING_TOOL, State.REFLECTING, State.IDLE]),
  [State.AWAITING_TOOL]: new Set([State.REFLECTING, State.IDLE]),
  [State.REFLECTING]: new Set([State.PLANNING, State.EXECUTING, State.DONE, State.IDLE]),
  [State.DONE]: new Set(),
};

class HarnessLoop {
  state: State = State.IDLE;
  hooks = new HookRegistry();
  budget: Budget;
  private planner: Planner;
  private goal = "";
  private planSteps: Step[] = [];
  private cursor = 0;
  private eventLog: Event[] = [];
  private history: Step[] = [];
  private reason = "";
  private prevState: State | null = null;

  constructor(planner: Planner | null = null, budget: Budget | null = null) {
    this.budget = budget ?? new Budget();
    this.planner = planner ?? defaultPlanner;
  }

  get events(): Event[] {
    return [...this.eventLog];
  }

  get plan(): Step[] {
    return [...this.planSteps];
  }

  private emit(etype: string, payload: Payload): void {
    if (!(EVENT_TYPES as readonly string[]).includes(etype)) throw new Error(`unknown event type: ${etype}`);
    this.eventLog.push(new Event(etype, payload, now()));
  }

  private transition(target: State): void {
    if (!LEGAL[this.state].has(target)) {
      throw new Error(`illegal transition ${this.state} -> ${target}`);
    }
    this.state = target;
  }

  private checkBudget(): PullRequest | null {
    const which = this.budget.exceeded();
    if (which === null) return null;
    this.emit("budget.warn", { limit: which });
    this.hooks.fire("on_budget_exceeded", { limit: which, budget: this.budget });
    this.reason = `budget_exceeded:${which}`;
    this.prevState = this.state;
    return this.pause(this.reason);
  }

  private pause(reason: string): PullRequest {
    this.emit("session.pause", { reason });
    this.hooks.fire("on_pause", { reason });
    this.transition(State.IDLE);
    return new PullRequest(reason, this.state, { reason });
  }

  run(goal: string): PullRequest | SessionResult {
    if (this.state !== State.IDLE) throw new Error(`run() requires IDLE, got ${this.state}`);
    this.goal = goal;
    this.budget.startedAt = now();
    this.emit("session.start", { goal });
    return this.step();
  }

  resume(payload: Payload | null = null): PullRequest | SessionResult {
    if (this.state === State.IDLE && this.reason.startsWith("budget_exceeded")) {
      this.budget.turns = 0;
      this.budget.toolCalls = 0;
      this.budget.startedAt = now();
      this.reason = "";
      const prev = this.prevState;
      this.prevState = null;
      if (this.planSteps.length === 0) return this.beginPlan();
      this.state = prev === State.EXECUTING ? State.EXECUTING : State.REFLECTING;
      return this.step();
    }
    if (this.state === State.AWAITING_TOOL) {
      if (payload === null) throw new Error("resume from AWAITING_TOOL requires a payload");
      const current = this.planSteps[this.cursor];
      if ("error" in payload) {
        current.error = String(payload.error);
        this.emit("tool.error", { step: current.id, error: current.error });
        this.hooks.fire("on_error", { step: current, error: current.error });
      } else {
        current.result = payload.result ?? null;
        this.emit("tool.result", { step: current.id, result: current.result });
      }
      this.hooks.fire("after_tool_call", { step: current });
      this.transition(State.REFLECTING);
      return this.step();
    }
    throw new Error(`resume() unsupported from state ${this.state}`);
  }

  private beginPlan(): PullRequest | SessionResult {
    this.transition(State.PLANNING);
    this.hooks.fire("before_plan", { goal: this.goal, history: [...this.history] });
    const draft = this.planner(this.goal, [...this.history]);
    this.emit("plan.draft", { steps: draft.map((s) => s.description) });
    this.hooks.fire("after_plan", { steps: draft });
    this.planSteps = draft;
    this.cursor = 0;
    this.emit("plan.commit", { count: draft.length });
    if (draft.length === 0) return this.complete("no_plan");
    this.transition(State.EXECUTING);
    return this.step();
  }

  private step(): PullRequest | SessionResult {
    if (this.state === State.IDLE) return this.beginPlan();
    const budgetHit = this.checkBudget();
    if (budgetHit !== null) return budgetHit;
    if (this.state === State.REFLECTING) {
      this.cursor += 1;
      this.budget.turns += 1;
      if (this.cursor >= this.planSteps.length) return this.complete("goal_met");
      this.transition(State.EXECUTING);
      return this.step();
    }
    if (this.state !== State.EXECUTING) {
      throw new Error(`_step requires EXECUTING/REFLECTING, got ${this.state}`);
    }
    const step = this.planSteps[this.cursor];
    this.hooks.fire("before_step", { step });
    this.emit("step.start", { step_id: step.id, desc: step.description });
    if (step.requiresTool) {
      try {
        this.hooks.fire("before_tool_call", { step });
      } catch (exc) {
        if (!(exc instanceof HookAbort)) throw exc;
        step.error = `hook_abort:${exc.message}`;
        this.emit("tool.error", { step: step.id, error: step.error });
        this.hooks.fire("on_error", { step, error: step.error });
        this.transition(State.REFLECTING);
        return this.step();
      }
      this.budget.toolCalls += 1;
      this.emit("tool.call", { step: step.id, tool: step.toolName, args: step.toolArgs });
      this.transition(State.AWAITING_TOOL);
      this.emit("step.end", { step_id: step.id, outcome: "awaiting_tool" });
      this.hooks.fire("after_step", { step, outcome: "awaiting_tool" });
      return new PullRequest(
        "tool_call",
        this.state,
        { tool: step.toolName, args: step.toolArgs, step_id: step.id },
      );
    }
    step.result = `ok:${step.description}`;
    this.emit("step.end", { step_id: step.id, outcome: "ok" });
    this.hooks.fire("after_step", { step, outcome: "ok" });
    this.transition(State.REFLECTING);
    return this.step();
  }

  private complete(reason: string): SessionResult {
    this.emit("session.complete", { reason });
    this.hooks.fire("on_complete", { reason });
    this.transition(State.DONE);
    this.reason = reason;
    return new SessionResult(this.state, reason, [...this.planSteps], [...this.eventLog]);
  }
}

function demo(): void {
  const loop = new HarnessLoop();
  const fired: string[] = [];
  for (const topic of HOOK_TOPICS) {
    loop.hooks.on(topic, () => fired.push(topic));
  }

  let out = loop.run("ship the release notes");
  assert(out instanceof PullRequest && out.reason === "tool_call");
  out = loop.resume({ result: { id: 42, name: "ada" } });
  assert(out instanceof PullRequest && out.reason === "tool_call");
  const final = loop.resume({ result: "summary text" });
  assert(final instanceof SessionResult);
  assert(final.state === State.DONE);
  assert(final.reason === "goal_met");

  const report = {
    events: final.events.map((e) => e.type),
    hooks_fired: fired,
    final_state: final.state,
    final_reason: final.reason,
  };
  console.log(JSON.stringify(report, null, 2));
}

demo();
