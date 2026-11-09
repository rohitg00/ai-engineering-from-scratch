// Lesson: OpenAI Agents SDK: Handoffs, Guardrails, Tracing (phase 14 / lesson 16)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/16-openai-agents-sdk/docs/en.md
// Run: npx tsx phases/14-agent-engineering/16-openai-agents-sdk/code/main.ts

export {};

type Attrs = Record<string, unknown>;

function pyStrRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + ch;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\r") out += "\\r";
    else out += ch;
  }
  return quote + out + quote;
}

function pyRepr(v: unknown): string {
  if (typeof v === "string") return pyStrRepr(v);
  if (typeof v === "boolean") return v ? "True" : "False";
  if (v === null || v === undefined) return "None";
  if (Array.isArray(v)) return "[" + v.map(pyRepr).join(", ") + "]";
  if (typeof v === "object") {
    return "{" + Object.entries(v as Attrs).map(([k, x]) => `${pyStrRepr(k)}: ${pyRepr(x)}`).join(", ") + "}";
  }
  return String(v);
}

class GuardrailTripped extends Error {
  name = "GuardrailTripped";

  constructor(public which: string, public reason: string) {
    super(`${which}: ${reason}`);
  }
}

interface FunctionTool {
  name: string;
  description: string;
  fn: (args: Attrs) => string;
}

class Handoff {
  constructor(public target: Agent) {}

  get toolName(): string {
    return `transfer_to_${this.target.name}`;
  }
}

interface PolicyOutput {
  kind: string;
  text?: string;
  tool?: string;
  args?: Attrs;
  to?: string;
  input?: string;
}

interface Agent {
  name: string;
  instructions: string;
  policy: (input: string) => PolicyOutput;
  tools: FunctionTool[];
  handoffs: Handoff[];
}

interface Guardrail {
  name: string;
  check: (text: string) => [boolean, string];
}

class Span {
  children: Span[] = [];

  constructor(public name: string, public attributes: Attrs = {}) {}
}

class Runner {
  maxHops = 3;
  trace = new Span("run");

  constructor(public inputGuardrails: Guardrail[] = [], public outputGuardrails: Guardrail[] = []) {}

  run(agent: Agent, userInput: string): string {
    for (const guard of this.inputGuardrails) {
      const [ok, reason] = guard.check(userInput);
      this.trace.children.push(new Span(`input_guardrail.${guard.name}`, { passed: ok, reason }));
      if (!ok) throw new GuardrailTripped("input", reason);
    }

    let currentAgent = agent;
    let currentInput = userInput;
    let finalOutput = "";
    for (let hop = 0; hop < this.maxHops; hop++) {
      const agentSpan = new Span(`agent.${currentAgent.name}`, {
        hop,
        instructions: currentAgent.instructions.slice(0, 40),
      });
      this.trace.children.push(agentSpan);

      const policyOutput = currentAgent.policy(currentInput);
      const kind = policyOutput.kind;

      if (kind === "final") {
        finalOutput = policyOutput.text as string;
        agentSpan.children.push(new Span("llm_generation", { output: finalOutput.slice(0, 60) }));
        break;
      }
      if (kind === "tool") {
        const toolName = policyOutput.tool as string;
        const args = policyOutput.args ?? {};
        const tool = currentAgent.tools.find((t) => t.name === toolName);
        if (tool === undefined) {
          agentSpan.children.push(new Span("tool_error", { tool: toolName, reason: "unknown tool" }));
          finalOutput = `error: unknown tool ${toolName}`;
          break;
        }
        const result = tool.fn(args);
        agentSpan.children.push(new Span(`tool.${toolName}`, { args, result: result.slice(0, 40) }));
        currentInput = `tool ${toolName} returned: ${result}`;
        continue;
      }
      if (kind === "handoff") {
        const targetName = policyOutput.to as string;
        const handoff = currentAgent.handoffs.find((h) => h.target.name === targetName);
        if (handoff === undefined) {
          finalOutput = `error: no handoff to ${targetName}`;
          break;
        }
        agentSpan.children.push(new Span(`handoff.${handoff.toolName}`, { from: currentAgent.name, to: targetName }));
        currentAgent = handoff.target;
        currentInput = policyOutput.input ?? currentInput;
        continue;
      }
      finalOutput = `error: unknown policy kind ${kind}`;
      break;
    }

    for (const guard of this.outputGuardrails) {
      const [ok, reason] = guard.check(finalOutput);
      this.trace.children.push(new Span(`output_guardrail.${guard.name}`, { passed: ok, reason }));
      if (!ok) throw new GuardrailTripped("output", reason);
    }

    return finalOutput;
  }
}

function printSpan(span: Span, indent = 0): void {
  const prefix = "  ".repeat(indent);
  const attrs = Object.entries(span.attributes)
    .map(([k, v]) => `${k}=${pyRepr(v)}`)
    .join(" ");
  console.log(`${prefix}${span.name}  ${attrs}`);
  for (const child of span.children) printSpan(child, indent + 1);
}

function triagePolicy(userInput: string): PolicyOutput {
  const t = userInput.toLowerCase();
  if (t.includes("refund") || t.includes("billing") || t.includes("invoice")) {
    return { kind: "handoff", to: "billing", input: userInput };
  }
  if (t.includes("error") || t.includes("crash") || t.includes("bug")) {
    return { kind: "handoff", to: "support", input: userInput };
  }
  return { kind: "final", text: "i'm not sure how to help with that" };
}

function billingPolicy(userInput: string): PolicyOutput {
  return { kind: "final", text: `billing handled: ${userInput.slice(0, 40)}` };
}

function supportPolicy(userInput: string): PolicyOutput {
  return { kind: "final", text: `support handled: ${userInput.slice(0, 40)}` };
}

function piiCheck(text: string): [boolean, string] {
  if (text.toLowerCase().includes("ssn")) return [false, "refuses to process social security numbers"];
  return [true, "ok"];
}

function lengthCheck(text: string): [boolean, string] {
  return [text.length < 200, `output ${text.length} chars`];
}

function main(): void {
  console.log("=".repeat(70));
  console.log("OPENAI AGENTS SDK SHAPE: Phase 14, Lesson 16");
  console.log("=".repeat(70));

  const billing: Agent = {
    name: "billing",
    instructions: "handle refunds and invoices",
    policy: billingPolicy,
    tools: [],
    handoffs: [],
  };
  const support: Agent = {
    name: "support",
    instructions: "handle bugs and errors",
    policy: supportPolicy,
    tools: [],
    handoffs: [],
  };
  const triage: Agent = {
    name: "triage",
    instructions: "route queries to the right specialist",
    policy: triagePolicy,
    tools: [],
    handoffs: [new Handoff(billing), new Handoff(support)],
  };

  const runner = new Runner([{ name: "pii_block", check: piiCheck }], [{ name: "length_cap", check: lengthCheck }]);

  const cases = ["I need a refund for invoice 4711", "the CLI crashes on ctrl-c", "share my ssn with the team"];
  for (const c of cases) {
    console.log(`\n--- case: ${c} ---`);
    runner.trace = new Span("run", { user_input: c.slice(0, 40) });
    try {
      const out = runner.run(triage, c);
      console.log(`final: ${out}`);
    } catch (e) {
      if (!(e instanceof GuardrailTripped)) throw e;
      console.log(`GUARDRAIL: ${e.message}`);
    }
    console.log("span tree:");
    printSpan(runner.trace, 1);
  }

  console.log();
  console.log("every handoff is a tool named transfer_to_<agent>.");
  console.log("every guardrail trip is a structured exception, not a crash.");
}

main();
