// Lesson: Capstone 01: Terminal-Native Coding Agent (phase 19 / lesson 01)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/01-terminal-native-coding-agent/docs/en.md
// Run: npx tsx phases/19-capstone-projects/01-terminal-native-coding-agent/code/main.ts

import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";

type Status = "pending" | "in_progress" | "done" | "failed";
type Payload = Record<string, unknown>;

function pyJson(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(pyJson).join(", ") + "]";
  if (typeof v === "object") {
    return "{" + Object.entries(v as Payload).map(([k, x]) => JSON.stringify(k) + ": " + pyJson(x)).join(", ") + "}";
  }
  return JSON.stringify(String(v));
}

class TodoItem {
  constructor(public id: number, public description: string, public status: Status, public note: string = "") {}
}

class PlanState {
  items: TodoItem[] = [];
  constructor(public goal: string) {}

  summary(): string {
    const marks: Record<Status, string> = { pending: " ", in_progress: ">", done: "x", failed: "!" };
    const lines = [`GOAL: ${this.goal}`];
    for (const it of this.items) lines.push(`  [${marks[it.status]}] ${it.id}. ${it.description}`);
    return lines.join("\n");
  }
}

class Budget {
  max_turns = 50;
  max_tokens = 200_000;
  max_dollars = 5.0;
  turns_used = 0;
  tokens_used = 0;
  dollars_used = 0.0;

  step(tokens: number, dollars: number): void {
    this.turns_used += 1;
    this.tokens_used += tokens;
    this.dollars_used += dollars;
  }

  exceeded(): string | null {
    if (this.turns_used >= this.max_turns) return "turn_limit";
    if (this.tokens_used >= this.max_tokens) return "token_limit";
    if (this.dollars_used >= this.max_dollars) return "dollar_limit";
    return null;
  }
}

type HookFn = (payload: Payload) => Payload | undefined;

class HookBus {
  static EVENTS = ["SessionStart", "SessionEnd", "PreToolUse", "PostToolUse", "UserPromptSubmit", "Notification", "Stop", "PreCompact"];
  private hooks: Record<string, HookFn[]> = {};

  constructor() {
    for (const e of HookBus.EVENTS) this.hooks[e] = [];
  }

  on(event: string, fn: HookFn): void {
    this.hooks[event].push(fn);
  }

  fire(event: string, payload: Payload): Payload {
    for (const fn of this.hooks[event]) payload = fn(payload) || payload;
    return payload;
  }
}

const TRUNCATE_BYTES = 4096;

function realpath(p: string): string {
  try {
    return realpathSync(p);
  } catch {
    return resolve(p);
  }
}

function toolReadFile(sandbox: string, args: Record<string, string>): string {
  const full = join(sandbox, args.path);
  if (!realpath(full).startsWith(realpath(sandbox))) throw new Error("path escapes sandbox");
  try {
    return readFileSync(full, "utf8").slice(0, TRUNCATE_BYTES);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") throw new Error(`[Errno 2] No such file or directory: '${full}'`);
    throw e;
  }
}

function toolRunShell(sandbox: string, args: Record<string, string>): string {
  const proc = spawnSync(args.cmd, { cwd: sandbox, shell: true, encoding: "utf8", timeout: 30_000 });
  const out = ((proc.stdout ?? "") + (proc.stderr ?? "")).slice(0, TRUNCATE_BYTES);
  return `exit=${proc.status}\n${out}`;
}

const TOOLS: Record<string, (sandbox: string, args: Record<string, string>) => string> = {
  read_file: toolReadFile,
  run_shell: toolRunShell,
};

type ToolCall = [string, Record<string, string>] | null;
interface ScriptStep {
  plan: [string, Status][];
  tool: ToolCall;
  tokens: number;
  cost: number;
}

const SCRIPT: ScriptStep[] = [
  {
    plan: [["locate target file", "in_progress"], ["read and diagnose", "pending"], ["apply fix and verify", "pending"]],
    tool: ["run_shell", { cmd: "ls" }],
    tokens: 1200,
    cost: 0.02,
  },
  {
    plan: [["locate target file", "done"], ["read and diagnose", "in_progress"], ["apply fix and verify", "pending"]],
    tool: ["read_file", { path: "README.md" }],
    tokens: 900,
    cost: 0.02,
  },
  {
    plan: [["locate target file", "done"], ["read and diagnose", "done"], ["apply fix and verify", "done"]],
    tool: null,
    tokens: 600,
    cost: 0.01,
  },
];

interface StepOut {
  plan: TodoItem[];
  tool: ToolCall;
  tokens: number;
  cost: number;
}

function modelStep(plan: PlanState, turn: number): StepOut {
  if (turn >= SCRIPT.length) return { plan: plan.items, tool: null, tokens: 200, cost: 0.005 };
  const s = SCRIPT[turn];
  const items = s.plan.map(([desc, status], i) => new TodoItem(i + 1, desc, status));
  return { plan: items, tool: s.tool, tokens: s.tokens, cost: s.cost };
}

function destructiveGuard(payload: Payload): Payload {
  const args = (payload.args ?? {}) as Record<string, string>;
  const cmd = args.cmd ?? "";
  if (cmd.includes("rm -rf") || cmd.includes("shutdown")) {
    payload.blocked = true;
    payload.reason = "destructive command blocked by PreToolUse hook";
  }
  return payload;
}

function runAgent(task: string, sandbox: string): { plan: string; budget: Budget; trace: Payload[] } {
  const plan = new PlanState(task);
  const budget = new Budget();
  const hooks = new HookBus();
  const trace: Payload[] = [];

  hooks.on("PreToolUse", destructiveGuard);
  hooks.on("PostToolUse", (p) => (trace.push({ event: "tool", ...p }), p));
  hooks.on("SessionStart", (p) => (trace.push({ event: "start", ...p }), p));
  hooks.on("SessionEnd", (p) => (trace.push({ event: "end", ...p }), p));

  hooks.fire("SessionStart", { task, sandbox, started_at: Date.now() / 1000 });

  let turn = 0;
  while (true) {
    const stop = budget.exceeded();
    if (stop) {
      hooks.fire("Stop", { reason: stop, turn });
      break;
    }

    const step = modelStep(plan, turn);
    plan.items = step.plan;
    budget.step(step.tokens, step.cost);

    const call = step.tool;
    if (call === null) {
      hooks.fire("Stop", { reason: "complete", turn });
      break;
    }

    const [name, args] = call;
    const pre = hooks.fire("PreToolUse", { tool: name, args });
    if (pre.blocked) {
      hooks.fire("PostToolUse", { tool: name, blocked: true, reason: pre.reason ?? "" });
      turn += 1;
      continue;
    }

    try {
      const result = TOOLS[name](sandbox, args);
      hooks.fire("PostToolUse", { tool: name, ok: true, bytes: [...result].length });
    } catch (exc) {
      hooks.fire("PostToolUse", { tool: name, ok: false, error: (exc as Error).message });
    }

    turn += 1;
  }

  hooks.fire("SessionEnd", { turns: budget.turns_used, tokens: budget.tokens_used, dollars: budget.dollars_used });

  return { plan: plan.summary(), budget, trace };
}

function main(): void {
  const task = "demonstrate the plan-act-observe loop without network calls";
  const sandbox = __dirname;
  const result = runAgent(task, sandbox);
  console.log(result.plan);
  console.log("---");
  console.log(`turns=${result.budget.turns_used} tokens=${result.budget.tokens_used} dollars=$${result.budget.dollars_used.toFixed(3)}`);
  console.log("---");
  console.log(`trace events: ${result.trace.length}`);
  for (const ev of result.trace) console.log(" ", pyJson(ev));
}

main();
