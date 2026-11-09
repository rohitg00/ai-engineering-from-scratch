// Lesson: Anthropic's Workflow Patterns: Simple Over Complex (phase 14 / lesson 12)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/12-anthropic-workflow-patterns/docs/en.md
// Run: npx tsx phases/14-agent-engineering/12-anthropic-workflow-patterns/code/main.ts

export {};

type LLM = (prompt: string) => string;

function pyStr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  return quote + s.split("\\").join("\\\\").split(quote).join("\\" + quote) + quote;
}

class ScriptedLLM {
  index = new Map<string, number>();
  calls: string[] = [];

  constructor(public script: Record<string, string | string[]>) {}

  call: LLM = (prompt) => {
    this.calls.push(prompt);
    const value = this.script[prompt];
    if (Array.isArray(value)) {
      const i = this.index.get(prompt) ?? 0;
      this.index.set(prompt, Math.min(i + 1, value.length - 1));
      return value[i];
    }
    if (typeof value === "string") return value;
    return `[unhandled: ${prompt}]`;
  };
}

function promptChain(inputText: string, llm: LLM, steps: Array<[string, string]>): Array<[string, string]> {
  let current = inputText;
  const trace: Array<[string, string]> = [];
  for (const [label, template] of steps) {
    const prompt = template.split("{text}").join(current);
    const output = llm(prompt);
    trace.push([label, output]);
    current = output;
  }
  return trace;
}

function route(
  inputText: string,
  classifier: (text: string) => string,
  handlers: Record<string, (text: string) => string>,
): [string, string] {
  const label = classifier(inputText);
  const handler = handlers[label] ?? handlers["default"];
  if (handler === undefined) return [label, `no handler for ${label}`];
  return [label, handler(inputText)];
}

function parallelVote(prompt: string, llm: LLM, n = 5): [string, Map<string, number>] {
  const votes: string[] = [];
  for (let i = 0; i < n; i++) votes.push(llm(prompt));
  const counts = new Map<string, number>();
  for (const v of votes) counts.set(v, (counts.get(v) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return [ranked[0][0], counts];
}

interface Worker {
  name: string;
  handles: (task: string) => boolean;
  fn: (task: string) => string;
}

function orchestratorWorkers(
  task: string,
  workers: Worker[],
  synth: (outputs: Array<[string, string]>) => string,
): [string, Array<[string, string]>] {
  const outputs: Array<[string, string]> = [];
  for (const worker of workers) {
    if (worker.handles(task)) outputs.push([worker.name, worker.fn(task)]);
  }
  return [synth(outputs), outputs];
}

function evaluatorOptimizer(
  task: string,
  proposer: (task: string, feedback: string | null) => string,
  evaluator: (task: string, candidate: string) => [boolean, string],
  maxIter = 5,
): [string, Array<[string, string, string]>] {
  const trace: Array<[string, string, string]> = [];
  let feedback: string | null = null;
  let candidate = "";
  for (let i = 0; i < maxIter; i++) {
    candidate = proposer(task, feedback);
    const [ok, judge] = evaluator(task, candidate);
    trace.push([candidate, ok ? "PASS" : "FAIL", judge]);
    if (ok) return [candidate, trace];
    feedback = judge;
  }
  return [candidate, trace];
}

function demoChain(llm: ScriptedLLM): void {
  console.log("-".repeat(70));
  console.log("1. PROMPT CHAINING: summarize then title");
  console.log("-".repeat(70));
  const trace = promptChain("Agents are ReAct loops with tools, memory, and guardrails.", llm.call, [
    ["summarize", "summarize: {text}"],
    ["title", "give a 6-word title: {text}"],
  ]);
  for (const [label, output] of trace) console.log(`  [${label}] ${output}`);
}

function demoRoute(llm: ScriptedLLM): void {
  console.log("\n" + "-".repeat(70));
  console.log("2. ROUTING: classify then dispatch");
  console.log("-".repeat(70));

  const classifier = (text: string): string => llm.call(`classify: ${text}`);

  const handlers: Record<string, (t: string) => string> = {
    refund: (t) => llm.call(`handle refund: ${t}`),
    bug: (t) => llm.call(`handle bug: ${t}`),
    sales: (t) => llm.call(`handle sales: ${t}`),
    default: () => "escalate to human",
  };

  for (const inp of ["I want my money back", "the CLI crashes on ctrl-c", "do you offer volume pricing"]) {
    const [label, out] = route(inp, classifier, handlers);
    console.log(`  [${label}] ${out}`);
  }
}

function demoParallel(llm: ScriptedLLM): void {
  console.log("\n" + "-".repeat(70));
  console.log("3. PARALLELIZATION: N voters on a boolean");
  console.log("-".repeat(70));
  const [winner, counts] = parallelVote("is this code safe to ship?", llm.call, 5);
  console.log(`  winner: ${winner}`);
  const repr = [...counts.entries()].map(([k, v]) => `${pyStr(k)}: ${v}`).join(", ");
  console.log(`  counts: {${repr}}`);
}

function demoOrchestrator(llm: ScriptedLLM): void {
  console.log("\n" + "-".repeat(70));
  console.log("4. ORCHESTRATOR-WORKERS: specialist pool");
  console.log("-".repeat(70));

  const workers: Worker[] = [
    {
      name: "python_reviewer",
      handles: (t) => t.toLowerCase().includes("python"),
      fn: (t) => llm.call(`review python: ${t}`),
    },
    { name: "security_reviewer", handles: () => true, fn: (t) => llm.call(`review security: ${t}`) },
    {
      name: "style_reviewer",
      handles: (t) => t.toLowerCase().includes("style"),
      fn: (t) => llm.call(`review style: ${t}`),
    },
  ];

  const synth = (outputs: Array<[string, string]>): string =>
    outputs.map(([name, out]) => `${name}: ${out}`).join(" | ");

  const task = "review this python change for style and security";
  const [final, outputs] = orchestratorWorkers(task, workers, synth);
  for (const [name, out] of outputs) console.log(`  [${name}] ${out}`);
  console.log(`  synth: ${final}`);
}

function demoEvaluatorOptimizer(llm: ScriptedLLM): void {
  console.log("\n" + "-".repeat(70));
  console.log("5. EVALUATOR-OPTIMIZER: propose, judge, refine");
  console.log("-".repeat(70));

  const proposer = (task: string, feedback: string | null): string => {
    let prompt = `propose: ${task}`;
    if (feedback) prompt += ` (fix: ${feedback})`;
    return llm.call(prompt);
  };

  const evaluator = (_task: string, candidate: string): [boolean, string] => {
    const verdict = llm.call(`evaluate: ${candidate}`);
    return [verdict.startsWith("PASS"), verdict];
  };

  const [final, trace] = evaluatorOptimizer("write a one-line summary of ReAct", proposer, evaluator);
  trace.forEach(([cand, verdict, reason], idx) => {
    console.log(`  iter ${idx + 1}  [${verdict}] ${cand}  // ${reason}`);
  });
  console.log(`  final: ${final}`);
}

function main(): void {
  console.log("=".repeat(70));
  console.log("ANTHROPIC WORKFLOW PATTERNS: Phase 14, Lesson 12");
  console.log("=".repeat(70));

  const llm = new ScriptedLLM({
    "summarize: Agents are ReAct loops with tools, memory, and guardrails.": "Agents: ReAct + tools + memory + guardrails.",
    "give a 6-word title: Agents: ReAct + tools + memory + guardrails.": "Agents as ReAct with Guardrails Built In",

    "classify: I want my money back": "refund",
    "classify: the CLI crashes on ctrl-c": "bug",
    "classify: do you offer volume pricing": "sales",
    "handle refund: I want my money back": "refund filed",
    "handle bug: the CLI crashes on ctrl-c": "bug logged",
    "handle sales: do you offer volume pricing": "quote sent",

    "is this code safe to ship?": ["yes", "yes", "no", "yes", "no"],

    "review python: review this python change for style and security": "python ok",
    "review security: review this python change for style and security": "security ok",
    "review style: review this python change for style and security": "style ok",

    "propose: write a one-line summary of ReAct": "ReAct loops thoughts and tool calls.",
    "evaluate: ReAct loops thoughts and tool calls.": "FAIL: missing observations",
    "propose: write a one-line summary of ReAct (fix: FAIL: missing observations)":
      "ReAct interleaves thought, action, and observation until done.",
    "evaluate: ReAct interleaves thought, action, and observation until done.": "PASS",
  });

  demoChain(llm);
  demoRoute(llm);
  demoParallel(llm);
  demoOrchestrator(llm);
  demoEvaluatorOptimizer(llm);

  console.log(`\ntotal llm calls across all five patterns: ${llm.calls.length}`);
  console.log("direct API + small helpers. no framework needed.");
}

main();
