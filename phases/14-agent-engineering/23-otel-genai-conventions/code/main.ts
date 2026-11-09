// Lesson: OpenTelemetry GenAI Semantic Conventions (phase 14 / lesson 23)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/23-otel-genai-conventions/docs/en.md
// Run: npx tsx phases/14-agent-engineering/23-otel-genai-conventions/code/main.ts

import { hrtime } from "node:process";

function pyStr(s: string): string {
  if (s.includes("'") && !s.includes('"')) return `"${s}"`;
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function byKey(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

class Span {
  children: Span[] = [];
  endNs = 0n;

  constructor(
    public name: string,
    public kind = "INTERNAL",
    public attributes: Record<string, string> = {},
    public startNs = 0n,
  ) {}

  get durationMs(): number {
    return Number(this.endNs - this.startNs) / 1_000_000;
  }
}

class ExternalContentStore {
  private store = new Map<string, string>();
  private counter = 0;

  put(content: string): string {
    this.counter += 1;
    const cid = `content_${String(this.counter).padStart(3, "0")}`;
    this.store.set(cid, content);
    return cid;
  }

  get(cid: string): string {
    return this.store.get(cid) ?? "";
  }

  items(): [string, string][] {
    return [...this.store.entries()].sort((a, b) => byKey(a[0], b[0]));
  }
}

class Tracer {
  root = new Span("__root__");
  stack: Span[] = [this.root];
  contentStore: ExternalContentStore;

  constructor(
    public captureInline = false,
    contentStore: ExternalContentStore | null = null,
  ) {
    this.contentStore = contentStore ?? new ExternalContentStore();
  }

  startSpan(name: string, kind = "INTERNAL", attributes: Record<string, string> | null = null): Span {
    const span = new Span(name, kind, { ...(attributes ?? {}) }, hrtime.bigint());
    this.stack[this.stack.length - 1]!.children.push(span);
    this.stack.push(span);
    return span;
  }

  endSpan(): void {
    const span = this.stack.pop()!;
    span.endNs = hrtime.bigint();
  }

  addContent(span: Span, key: string, content: string): void {
    if (this.captureInline) {
      span.attributes[key] = content.slice(0, 200);
      return;
    }
    const cid = this.contentStore.put(content);
    span.attributes[`${key}.reference_id`] = cid;
  }
}

function scriptedLlm(prompt: string): string {
  if (prompt.toLowerCase().includes("search")) return 'search_tool("agent engineering")';
  if (prompt.toLowerCase().includes("result")) return "found 3 sources; drafting answer";
  return "final answer: agents in 2026";
}

function searchTool(query: string): string {
  return `[3 sources for ${pyStr(query)}]`;
}

function main(): void {
  console.log("=".repeat(70));
  console.log("OTEL GENAI SEMANTIC CONVENTIONS: Phase 14, Lesson 23");
  console.log("=".repeat(70));

  const tracer = new Tracer(false);

  tracer.startSpan("create_agent research_bot", "INTERNAL", {
    "gen_ai.agent.name": "research_bot",
    "gen_ai.operation.name": "create_agent",
    "gen_ai.provider.name": "anthropic",
  });
  tracer.endSpan();

  tracer.startSpan("invoke_agent research_bot", "INTERNAL", {
    "gen_ai.agent.name": "research_bot",
    "gen_ai.operation.name": "invoke_agent",
    "gen_ai.provider.name": "anthropic",
    "gen_ai.request.model": "claude-opus-4-6",
  });

  for (let turn = 0; turn < 3; turn++) {
    const chat = tracer.startSpan("chat", "INTERNAL", {
      "gen_ai.operation.name": "chat",
      "gen_ai.provider.name": "anthropic",
      "gen_ai.request.model": "claude-opus-4-6",
      "gen_ai.response.model": "claude-opus-4-6",
    });
    const prompt = `turn ${turn}: next action please`;
    tracer.addContent(chat, "gen_ai.input.messages", prompt);
    const output = scriptedLlm(prompt);
    tracer.addContent(chat, "gen_ai.output.messages", output);
    tracer.endSpan();

    if (output.includes("search_tool")) {
      const toolSpan = tracer.startSpan("tool_call search_tool", "INTERNAL", {
        "gen_ai.operation.name": "tool_call",
        "gen_ai.tool.name": "search_tool",
        "gen_ai.data_source.id": "corpus://mem0/default",
      });
      const result = searchTool("agent engineering");
      tracer.addContent(toolSpan, "gen_ai.tool.result", result);
      tracer.endSpan();
    }
  }

  tracer.endSpan();

  const render = (span: Span, indent = 0): void => {
    if (span.name === "__root__") {
      for (const child of span.children) render(child, indent);
      return;
    }
    const pad = "  ".repeat(indent);
    const dur = span.endNs ? `${span.durationMs.toFixed(2)}ms` : "...";
    console.log(`${pad}${span.name}  [${span.kind}]  ${dur}`);
    for (const key of Object.keys(span.attributes).sort(byKey)) {
      let val = span.attributes[key]!;
      if (val.length > 50) val = val.slice(0, 50) + "...";
      console.log(`${pad}  ${key} = ${pyStr(val)}`);
    }
    for (const child of span.children) render(child, indent + 1);
  };

  console.log("\nspan tree (GenAI-shaped)");
  render(tracer.root);

  console.log("\nexternal content store (opt-in references, not inline)");
  for (const [cid, content] of tracer.contentStore.items()) {
    console.log(`  ${cid}: ${content.slice(0, 60)}`);
  }

  console.log();
  console.log("content NOT captured inline by default. store externally; span");
  console.log("attributes carry reference IDs. set OTEL_SEMCONV_STABILITY_OPT_IN");
  console.log("=gen_ai_latest_experimental to pin experimental attribute names.");
}

main();
