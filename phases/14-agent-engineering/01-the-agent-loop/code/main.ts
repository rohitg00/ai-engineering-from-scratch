// Phase 14 Lesson 01 — toy ReAct agent loop, in TypeScript.
//
// Mirrors code/main.py: message buffer, tool registry, stop condition,
// turn budget, observation formatter. The model is a scripted ToyLLM so the
// loop runs offline and deterministic; swap for a real provider client and
// the control flow is identical.
//
// References:
//   ReAct paper       https://arxiv.org/abs/2210.03629
//   Anthropic agents  https://www.anthropic.com/engineering/building-effective-agents
//
// Run: npx tsx code/main.ts

type ToolFn = (args: Record<string, string>) => string;

type ToolCall = {
  name: string;
  args: Record<string, string>;
};

type Turn = {
  kind: "user" | "thought" | "action" | "final";
  content: string;
  toolCall?: ToolCall;
  observation?: string;
};

class ToolRegistry {
  private tools = new Map<string, ToolFn>();

  register(name: string, fn: ToolFn): void {
    this.tools.set(name, fn);
  }

  names(): string[] {
    return [...this.tools.keys()].sort();
  }

  dispatch(call: ToolCall): string {
    const fn = this.tools.get(call.name);
    if (!fn) return `error: unknown tool ${JSON.stringify(call.name)}`;
    try {
      return fn(call.args);
    } catch (err) {
      const e = err as Error;
      return `error: ${e.name}: ${e.message}`;
    }
  }
}

function calculator(args: Record<string, string>): string {
  const expr = args.expr;
  if (typeof expr !== "string") return "error: missing expr";
  if (!/^[0-9+\-*/(). ]+$/.test(expr)) {
    return "error: illegal character in expr";
  }
  try {
    const fn = new Function(`"use strict"; return (${expr});`);
    const value = fn();
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return `error: non-finite result for ${expr}`;
    }
    return String(value);
  } catch (err) {
    const e = err as Error;
    return `error: ${e.name}: ${e.message}`;
  }
}

class KVStore {
  private store = new Map<string, string>();

  get = (args: Record<string, string>): string => {
    const key = args.key;
    if (!this.store.has(key)) return `missing:${key}`;
    return this.store.get(key) as string;
  };

  set = (args: Record<string, string>): string => {
    this.store.set(args.key, args.value);
    return `stored ${args.key}`;
  };
}

type ScriptEntry =
  | { kind: "action"; thought: string; action: string; args: Record<string, string> }
  | { kind: "finish"; content: string };

// Scripted ReAct policy. Returns one assistant turn per call.
// Replace with a provider client and the loop is identical.
class ToyLLM {
  private cursor = 0;
  constructor(private script: ScriptEntry[]) {}

  respond(_history: Turn[]): ScriptEntry {
    if (this.cursor >= this.script.length) {
      return { kind: "finish", content: "no more actions" };
    }
    return this.script[this.cursor++];
  }
}

class AgentLoop {
  history: Turn[] = [];

  constructor(
    private llm: ToyLLM,
    private tools: ToolRegistry,
    private maxTurns = 12,
  ) {}

  run(userMessage: string): string {
    this.history.push({ kind: "user", content: userMessage });
    for (let step = 0; step < this.maxTurns; step++) {
      const reply = this.llm.respond(this.history);
      if (reply.kind === "finish") {
        this.history.push({ kind: "final", content: reply.content });
        return reply.content;
      }
      this.history.push({ kind: "thought", content: reply.thought });
      const call: ToolCall = { name: reply.action, args: reply.args };
      const observation = this.tools.dispatch(call);
      this.history.push({
        kind: "action",
        content: call.name,
        toolCall: call,
        observation,
      });
    }
    this.history.push({ kind: "final", content: "budget exhausted" });
    return "budget exhausted";
  }

  toolNames(): string[] {
    return this.tools.names();
  }
}

function prettyTrace(history: Turn[]): void {
  history.forEach((turn, i) => {
    const tag = `[${String(i).padStart(2, "0")} ${turn.kind.padStart(7)}]`;
    if (turn.kind === "user" || turn.kind === "thought" || turn.kind === "final") {
      console.log(`${tag} ${turn.content}`);
    } else if (turn.kind === "action" && turn.toolCall) {
      const argText = JSON.stringify(turn.toolCall.args);
      console.log(`${tag} ${turn.toolCall.name}(${argText}) -> ${turn.observation}`);
    }
  });
}

function buildDemoAgent(): AgentLoop {
  const tools = new ToolRegistry();
  tools.register("calculator", calculator);
  const kv = new KVStore();
  tools.register("kv_get", kv.get);
  tools.register("kv_set", kv.set);

  const script: ScriptEntry[] = [
    {
      kind: "action",
      thought: "store the base price",
      action: "kv_set",
      args: { key: "base", value: "120" },
    },
    {
      kind: "action",
      thought: "compute 15% tax",
      action: "calculator",
      args: { expr: "120 * 0.15" },
    },
    {
      kind: "action",
      thought: "store the tax",
      action: "kv_set",
      args: { key: "tax", value: "18.0" },
    },
    {
      kind: "action",
      thought: "compute total",
      action: "calculator",
      args: { expr: "120 + 18.0" },
    },
    {
      kind: "action",
      thought: "confirm stored values",
      action: "kv_get",
      args: { key: "base" },
    },
    { kind: "finish", content: "the total including 15% tax is 138.0" },
  ];
  return new AgentLoop(new ToyLLM(script), tools, 10);
}

function main(): void {
  console.log("=".repeat(70));
  console.log("TOY REACT LOOP — Phase 14, Lesson 01 (TypeScript port)");
  console.log("=".repeat(70));

  const agent = buildDemoAgent();
  const final = agent.run("What is 120 plus 15% tax, stored in kv?");
  console.log();
  prettyTrace(agent.history);
  console.log();
  console.log(`final answer: ${final}`);
  const actions = agent.history.filter((t) => t.kind === "action").length;
  console.log(`turns used:   ${actions}`);
  console.log(`tools used:   ${JSON.stringify(agent.toolNames())}`);
}

main();
