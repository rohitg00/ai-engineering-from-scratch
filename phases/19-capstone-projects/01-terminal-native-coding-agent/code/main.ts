// Capstone 19/01: terminal-native coding agent harness skeleton (TypeScript).
//
// Sources:
//   This lesson's docs/en.md (the Bun + Ink TUI harness with eight 2026 hooks)
//   Claude Code docs            https://docs.anthropic.com/en/docs/claude-code
//   Model Context Protocol      https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/
//   OpenTelemetry GenAI semconv https://opentelemetry.io/docs/specs/semconv/gen-ai/
//
// The harness side of the capstone: REPL command parser, scripted (offline) LLM,
// tool dispatcher with read_file/run_shell, eight-event hook bus, plan state
// rewritten whole each turn, hard ceilings on turns/tokens/dollars, plus a tiny
// pass/fail eval counter. Zero network, stdlib only.
//
// Run: npx -y tsx@4.19.2 code/main.ts

import { readFileSync } from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";

type Status = "pending" | "in_progress" | "done" | "failed";

type TodoItem = {
  id: number;
  description: string;
  status: Status;
  note: string;
};

class PlanState {
  goal: string;
  items: TodoItem[];

  constructor(goal: string) {
    this.goal = goal;
    this.items = [];
  }

  rewrite(items: TodoItem[]): void {
    this.items = items;
  }

  summary(): string {
    const mark: Record<Status, string> = {
      pending: " ",
      in_progress: ">",
      done: "x",
      failed: "!",
    };
    const lines = [`GOAL: ${this.goal}`];
    for (const it of this.items) {
      lines.push(`  [${mark[it.status]}] ${it.id}. ${it.description}`);
    }
    return lines.join("\n");
  }
}

class Budget {
  maxTurns = 50;
  maxTokens = 200_000;
  maxDollars = 5.0;
  turnsUsed = 0;
  tokensUsed = 0;
  dollarsUsed = 0;

  step(tokens: number, dollars: number): void {
    this.turnsUsed += 1;
    this.tokensUsed += tokens;
    this.dollarsUsed += dollars;
  }

  exceeded(): string | null {
    if (this.turnsUsed >= this.maxTurns) return "turn_limit";
    if (this.tokensUsed >= this.maxTokens) return "token_limit";
    if (this.dollarsUsed >= this.maxDollars) return "dollar_limit";
    return null;
  }

  snapshot(): { turnsUsed: number; tokensUsed: number; dollarsUsed: number } {
    return {
      turnsUsed: this.turnsUsed,
      tokensUsed: this.tokensUsed,
      dollarsUsed: this.dollarsUsed,
    };
  }
}

type HookEvent =
  | "SessionStart"
  | "SessionEnd"
  | "PreToolUse"
  | "PostToolUse"
  | "UserPromptSubmit"
  | "Notification"
  | "Stop"
  | "PreCompact";

type HookPayload = Record<string, unknown>;
type HookFn = (payload: HookPayload) => HookPayload;

class HookBus {
  static readonly EVENTS: HookEvent[] = [
    "SessionStart",
    "SessionEnd",
    "PreToolUse",
    "PostToolUse",
    "UserPromptSubmit",
    "Notification",
    "Stop",
    "PreCompact",
  ];

  private hooks: Map<HookEvent, HookFn[]> = new Map();

  constructor() {
    for (const e of HookBus.EVENTS) this.hooks.set(e, []);
  }

  on(event: HookEvent, fn: HookFn): void {
    this.hooks.get(event)!.push(fn);
  }

  fire(event: HookEvent, payload: HookPayload): HookPayload {
    let current = payload;
    for (const fn of this.hooks.get(event)!) {
      current = fn(current) ?? current;
    }
    return current;
  }
}

const TRUNCATE_BYTES = 4096;

type ToolArgs = Record<string, string>;
type ToolFn = (sandbox: string, args: ToolArgs) => string;

function toolReadFile(sandbox: string, args: ToolArgs): string {
  const target = args.path ?? "";
  const full = path.resolve(sandbox, target);
  const root = path.resolve(sandbox);
  if (!full.startsWith(root + path.sep) && full !== root) {
    throw new Error("path escapes sandbox");
  }
  const data = readFileSync(full, "utf8");
  return data.slice(0, TRUNCATE_BYTES);
}

function toolRunShell(_sandbox: string, args: ToolArgs): string {
  // Offline scaffold: stub the shell. The capstone wires this to E2B / Daytona.
  // Returning a deterministic, truncated stand-in keeps the loop testable.
  const cmd = args.cmd ?? "";
  const stub: Record<string, string> = {
    ls: "README.md\nmain.ts\nmain.py",
    "git status": "On branch agent/demo\nnothing to commit, working tree clean",
  };
  const out = stub[cmd] ?? `(stub) ran: ${cmd}`;
  return `exit=0\n${out.slice(0, TRUNCATE_BYTES)}`;
}

const TOOLS: Record<string, ToolFn> = {
  read_file: toolReadFile,
  run_shell: toolRunShell,
};

type ToolCall = { name: string; args: ToolArgs };

type ModelTurn = {
  plan: TodoItem[];
  tool: ToolCall | null;
  tokens: number;
  cost: number;
};

type ScriptStep = {
  plan: ReadonlyArray<readonly [string, Status]>;
  tool: ToolCall | null;
  tokens: number;
  cost: number;
};

const SCRIPT: ScriptStep[] = [
  {
    plan: [
      ["locate target file", "in_progress"],
      ["read and diagnose", "pending"],
      ["apply fix and verify", "pending"],
    ],
    tool: { name: "run_shell", args: { cmd: "ls" } },
    tokens: 1200,
    cost: 0.02,
  },
  {
    plan: [
      ["locate target file", "done"],
      ["read and diagnose", "in_progress"],
      ["apply fix and verify", "pending"],
    ],
    tool: { name: "read_file", args: { path: "main.ts" } },
    tokens: 900,
    cost: 0.02,
  },
  {
    plan: [
      ["locate target file", "done"],
      ["read and diagnose", "done"],
      ["apply fix and verify", "done"],
    ],
    tool: null,
    tokens: 600,
    cost: 0.01,
  },
];

class ScriptedModel {
  step(_plan: PlanState, turn: number): ModelTurn {
    if (turn >= SCRIPT.length) {
      return { plan: [], tool: null, tokens: 200, cost: 0.005 };
    }
    const s = SCRIPT[turn];
    const items: TodoItem[] = s.plan.map(([description, status], i) => ({
      id: i + 1,
      description,
      status,
      note: "",
    }));
    return { plan: items, tool: s.tool, tokens: s.tokens, cost: s.cost };
  }
}

function destructiveGuard(payload: HookPayload): HookPayload {
  const args = (payload.args ?? {}) as ToolArgs;
  const cmd = args.cmd ?? "";
  if (cmd.includes("rm -rf") || cmd.includes("shutdown")) {
    return { ...payload, blocked: true, reason: "destructive command blocked by PreToolUse hook" };
  }
  return payload;
}

type RunResult = {
  plan: string;
  budget: { turnsUsed: number; tokensUsed: number; dollarsUsed: number };
  trace: HookPayload[];
  passed: boolean;
};

function runAgent(task: string, sandbox: string): RunResult {
  const plan = new PlanState(task);
  const budget = new Budget();
  const hooks = new HookBus();
  const trace: HookPayload[] = [];
  const model = new ScriptedModel();

  hooks.on("PreToolUse", destructiveGuard);
  hooks.on("PostToolUse", (p) => {
    trace.push({ event: "tool", ...p });
    return p;
  });
  hooks.on("SessionStart", (p) => {
    trace.push({ event: "start", ...p });
    return p;
  });
  hooks.on("SessionEnd", (p) => {
    trace.push({ event: "end", ...p });
    return p;
  });
  hooks.on("Stop", (p) => {
    trace.push({ event: "stop", ...p });
    return p;
  });

  hooks.fire("SessionStart", { task, sandbox, startedAt: Date.now() });

  let turn = 0;
  let completed = false;
  while (true) {
    const limit = budget.exceeded();
    if (limit) {
      hooks.fire("Stop", { reason: limit, turn });
      break;
    }
    const step = model.step(plan, turn);
    plan.rewrite(step.plan);
    budget.step(step.tokens, step.cost);

    if (step.tool === null) {
      hooks.fire("Stop", { reason: "complete", turn });
      completed = true;
      break;
    }

    const { name, args } = step.tool;
    const pre = hooks.fire("PreToolUse", { tool: name, args });
    if (pre.blocked) {
      hooks.fire("PostToolUse", {
        tool: name,
        blocked: true,
        reason: String(pre.reason ?? ""),
      });
      turn += 1;
      continue;
    }

    try {
      const result = TOOLS[name](sandbox, args);
      hooks.fire("PostToolUse", { tool: name, ok: true, bytes: result.length });
    } catch (err) {
      const e = err as Error;
      hooks.fire("PostToolUse", { tool: name, ok: false, error: e.message });
    }
    turn += 1;
  }

  hooks.fire("SessionEnd", budget.snapshot() as unknown as HookPayload);

  const allDone = plan.items.length > 0 && plan.items.every((it) => it.status === "done");
  return {
    plan: plan.summary(),
    budget: budget.snapshot(),
    trace,
    passed: completed && allDone,
  };
}

type Command =
  | { kind: "run"; task: string }
  | { kind: "eval" }
  | { kind: "help" }
  | { kind: "quit" }
  | { kind: "unknown"; raw: string };

function parseCommand(line: string): Command {
  const trimmed = line.trim();
  if (!trimmed) return { kind: "help" };
  if (trimmed === "quit" || trimmed === "exit") return { kind: "quit" };
  if (trimmed === "help" || trimmed === "?") return { kind: "help" };
  if (trimmed === "eval") return { kind: "eval" };
  const m = /^run\s+(.+)$/.exec(trimmed);
  if (m) return { kind: "run", task: m[1] };
  return { kind: "unknown", raw: trimmed };
}

function helpText(): string {
  return [
    "harness commands:",
    "  run <task>   plan/act/observe loop for one task against the scripted model",
    "  eval         run the offline eval and print pass/fail counts",
    "  help         show this message",
    "  quit         exit",
  ].join("\n");
}

const EVAL_TASKS: { task: string; expectedDone: number }[] = [
  { task: "diagnose worker.rs", expectedDone: 3 },
  { task: "summarize README", expectedDone: 3 },
  { task: "run smoke tests", expectedDone: 3 },
];

function runEval(sandbox: string): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  for (const t of EVAL_TASKS) {
    const r = runAgent(t.task, sandbox);
    const doneCount = (r.plan.match(/\[x\]/g) ?? []).length;
    if (r.passed && doneCount >= t.expectedDone) passed += 1;
    else failed += 1;
  }
  return { passed, failed };
}

function isInteractive(): boolean {
  return process.stdin.isTTY === true && process.argv.includes("--repl");
}

async function repl(sandbox: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(helpText());
  const ask = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));
  while (true) {
    const line = await ask("agent> ");
    const cmd = parseCommand(line);
    if (cmd.kind === "quit") break;
    if (cmd.kind === "help") {
      console.log(helpText());
      continue;
    }
    if (cmd.kind === "eval") {
      const e = runEval(sandbox);
      console.log(`eval: passed=${e.passed} failed=${e.failed}`);
      continue;
    }
    if (cmd.kind === "run") {
      const r = runAgent(cmd.task, sandbox);
      console.log(r.plan);
      console.log("---");
      console.log(
        `turns=${r.budget.turnsUsed} tokens=${r.budget.tokensUsed} ` +
          `dollars=$${r.budget.dollarsUsed.toFixed(3)} passed=${r.passed}`,
      );
      continue;
    }
    console.log(`unknown command: ${cmd.raw}; type 'help'`);
  }
  rl.close();
}

async function main(): Promise<void> {
  const sandbox = path.resolve(__dirname);
  if (isInteractive()) {
    await repl(sandbox);
    return;
  }
  const task = "demonstrate the plan-act-observe loop without network calls";
  const result = runAgent(task, sandbox);
  console.log(result.plan);
  console.log("---");
  console.log(
    `turns=${result.budget.turnsUsed} tokens=${result.budget.tokensUsed} ` +
      `dollars=$${result.budget.dollarsUsed.toFixed(3)}`,
  );
  console.log("---");
  console.log(`trace events: ${result.trace.length}`);
  for (const ev of result.trace) console.log(" ", JSON.stringify(ev));
  console.log("---");
  const e = runEval(sandbox);
  console.log(`eval: passed=${e.passed} failed=${e.failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
