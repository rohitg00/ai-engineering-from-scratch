// Phase 14 · Lesson 18 — Agno vs Mastra runtimes (TypeScript port).
// Minimal Mastra-shaped sketch: Agent + Tool registry + Workflow, with a
// mocked LLM step. Plus an Agno-shaped sketch for contrast. Stdlib only —
// the real Mastra package wires Zod, the Vercel AI SDK, telemetry.
// Refs: https://mastra.ai/docs/agents/overview
//       https://mastra.ai/docs/workflows/overview
//       https://docs.agno.com/introduction
//       https://sdk.vercel.ai/docs/foundations/agents

import process from "node:process";

// --- Shared LLM stub. Mastra wires Vercel AI SDK's `generateText` here.

type LLMResponse = { text: string; inputTokens: number; outputTokens: number };

async function mockLLM(systemPrompt: string, userMessage: string): Promise<LLMResponse> {
  const inputTokens = Math.ceil((systemPrompt.length + userMessage.length) / 4);
  // Simulate network latency without using a real model.
  await new Promise((r) => setTimeout(r, 5));
  return {
    text: `[mock reply to ${userMessage.slice(0, 60)}]`,
    inputTokens,
    outputTokens: 32,
  };
}

// --- Agno-shaped: stateless agent + session store. One fresh agent per
// request, history lives in the session store (your DB in production).

type AgnoAgent = {
  name: string;
  run: (prompt: string) => Promise<string>;
};

class AgnoSession {
  private turns = new Map<string, string[]>();
  append(sessionId: string, turn: string): void {
    const list = this.turns.get(sessionId) ?? [];
    list.push(turn);
    this.turns.set(sessionId, list);
  }
  history(sessionId: string): string[] {
    return [...(this.turns.get(sessionId) ?? [])];
  }
}

async function agnoHandler(
  session: AgnoSession,
  agent: AgnoAgent,
  sessionId: string,
  prompt: string,
): Promise<{ reply: string; elapsedUs: number }> {
  const start = process.hrtime.bigint();
  session.append(sessionId, `user: ${prompt}`);
  const reply = await agent.run(prompt);
  session.append(sessionId, `assistant: ${reply}`);
  const elapsedUs = Number((process.hrtime.bigint() - start) / 1000n);
  return { reply, elapsedUs };
}

// --- Mastra-shaped: Agents + Tools + Workflows.

type ToolInputSchema = Record<string, "string" | "number" | "boolean">;
type ToolInput = Record<string, string | number | boolean>;
type ToolResult = { output: string };

type MastraTool = {
  id: string;
  description: string;
  inputSchema: ToolInputSchema;
  execute: (input: ToolInput) => Promise<ToolResult>;
};

// Cheap runtime check so a tool can refuse a wrong-shaped call. Real Mastra
// uses zod schemas + inferred TS types here.
function checkSchema(schema: ToolInputSchema, input: ToolInput): string | null {
  for (const [key, expected] of Object.entries(schema)) {
    if (!(key in input)) return `missing field ${key}`;
    if (typeof input[key] !== expected) return `field ${key}: expected ${expected}, got ${typeof input[key]}`;
  }
  return null;
}

type ToolCall = { tool: string; input: ToolInput };
type AgentTrace = { tool: string; result: string }[];

class MastraAgent {
  constructor(
    readonly name: string,
    readonly instructions: string,
    private readonly tools: Map<string, MastraTool>,
  ) {}

  static withTools(name: string, instructions: string, tools: MastraTool[]): MastraAgent {
    const map = new Map<string, MastraTool>();
    for (const t of tools) map.set(t.id, t);
    return new MastraAgent(name, instructions, map);
  }

  async run(userMessage: string, calls: ToolCall[]): Promise<{ output: string; trace: AgentTrace; tokens: number }> {
    const trace: AgentTrace = [];
    let tokens = 0;

    // Agent decides tool calls (here pre-supplied). Each successful call
    // appends a step to the trace; bad calls record the error.
    for (const call of calls) {
      const tool = this.tools.get(call.tool);
      if (!tool) {
        trace.push({ tool: call.tool, result: "error: unknown tool" });
        continue;
      }
      const schemaError = checkSchema(tool.inputSchema, call.input);
      if (schemaError) {
        trace.push({ tool: call.tool, result: `error: ${schemaError}` });
        continue;
      }
      const { output } = await tool.execute(call.input);
      trace.push({ tool: call.tool, result: output });
    }

    // Final LLM step composes trace + user message into a reply.
    const traceText = trace.map((t) => `${t.tool}: ${t.result}`).join("\n");
    const reply = await mockLLM(this.instructions, `${userMessage}\n\nTool results:\n${traceText}`);
    tokens = reply.inputTokens + reply.outputTokens;
    return { output: reply.text, trace, tokens };
  }
}

// Workflows: an ordered list of steps. Each step gets the previous output.
type WorkflowStep<I, O> = { name: string; run: (input: I) => Promise<O> | O };

class MastraWorkflow {
  private steps: WorkflowStep<unknown, unknown>[] = [];
  addStep<I, O>(name: string, run: (input: I) => Promise<O> | O): MastraWorkflow {
    this.steps.push({ name, run: run as (input: unknown) => unknown });
    return this;
  }
  async run(initial: unknown): Promise<{ name: string; output: unknown }[]> {
    const trace: { name: string; output: unknown }[] = [];
    let current: unknown = initial;
    for (const step of this.steps) {
      current = await step.run(current);
      trace.push({ name: step.name, output: current });
    }
    return trace;
  }
}

// --- Demo

const searchTool: MastraTool = {
  id: "search",
  description: "Web search over a fixture corpus",
  inputSchema: { query: "string" },
  execute: async (input) => ({ output: `3 results for ${String(input.query)}` }),
};

const summariseTool: MastraTool = {
  id: "summarise",
  description: "Compress text to one sentence",
  inputSchema: { text: "string" },
  execute: async (input) => ({ output: `summary: ${String(input.text).slice(0, 40)}...` }),
};

async function main(): Promise<void> {
  process.stdout.write("=".repeat(70) + "\nAgno vs Mastra runtimes — Phase 14 · 18\n" + "=".repeat(70) + "\n");

  // 1. Agno-shaped — measure agent creation + handler latency.
  process.stdout.write("\n1. Agno-shaped (stateless FastAPI-style handler)\n");
  const session = new AgnoSession();
  const agnoAgent: AgnoAgent = {
    name: "agno_a",
    run: async (prompt) => `[agno reply] ${prompt.slice(0, 40)}`,
  };
  for (let i = 0; i < 3; i += 1) {
    const { reply, elapsedUs } = await agnoHandler(session, agnoAgent, "s001", `query ${i}: how do I ship an agent`);
    process.stdout.write(`  turn ${i}: ${reply}  (handler ${elapsedUs} us)\n`);
  }
  process.stdout.write(`  session history length: ${session.history("s001").length}\n`);
  process.stdout.write("  pattern: fresh agent per request, session holds state, FastAPI/Hono is stateless.\n");

  // 2. Mastra-shaped — agent runs tools then summarises.
  process.stdout.write("\n2. Mastra-shaped (Agents + Tools + Workflows)\n");
  const mastraAgent = MastraAgent.withTools(
    "research_agent",
    "Search, summarise, cite",
    [searchTool, summariseTool],
  );
  const result = await mastraAgent.run("research agent engineering", [
    { tool: "search", input: { query: "agent engineering 2026" } },
    { tool: "search", input: { query: "BFCL V4 benchmarks" } },
    { tool: "unknown_tool", input: { query: "fails on purpose" } },
  ]);
  process.stdout.write(`  agent output: ${result.output}  (~${result.tokens} tokens)\n`);
  for (const t of result.trace) process.stdout.write(`    tool ${t.tool}: ${t.result}\n`);

  // 3. Workflow — normalise → search → summarise.
  process.stdout.write("\n3. Workflow run\n");
  const workflow = new MastraWorkflow()
    .addStep<string, string>("normalise", (p) => p.trim().toLowerCase())
    .addStep<string, string>("search", async (p) => (await searchTool.execute({ query: p })).output)
    .addStep<string, string>("summarise", async (p) => (await summariseTool.execute({ text: p })).output);
  const workflowTrace = await workflow.run("  Agent Engineering 2026  ");
  for (const { name, output } of workflowTrace) process.stdout.write(`    ${name}: ${String(output)}\n`);

  process.stdout.write("\npick by stack: python+fastapi → Agno; typescript+next/vercel → Mastra.\n");
}

main();
