// Lesson: ReWOO and Plan-and-Execute: Decoupled Planning (phase 14 / lesson 02)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/02-rewoo-plan-and-execute/docs/en.md
// Run: npx tsx phases/14-agent-engineering/02-rewoo-plan-and-execute/code/main.ts

export {};

type Args = Record<string, unknown>;

function pyStr(s: string): string {
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
  if (typeof v === "string") return pyStr(v);
  if (Array.isArray(v)) return "[" + v.map(pyRepr).join(", ") + "]";
  if (v !== null && typeof v === "object") {
    return "{" + Object.entries(v as Args).map(([k, x]) => `${pyStr(k)}: ${pyRepr(x)}`).join(", ") + "}";
  }
  return String(v);
}

function pyRound(x: number): number {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

class PlanStep {
  constructor(public id: string, public tool: string, public args: Args) {}
}

class Plan {
  constructor(public steps: PlanStep[]) {}
}

type Tool = (args: Args) => string;

class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(name: string, fn: Tool): void {
    this.tools.set(name, fn);
  }

  dispatch(name: string, args: Args): string {
    const fn = this.tools.get(name);
    if (fn === undefined) return `error: unknown tool ${pyStr(name)}`;
    try {
      return fn(args);
    } catch (e) {
      const err = e as Error;
      return `error: ${err.name}: ${err.message}`;
    }
  }
}

const REFERENCE_RE = /#E(\d+)/g;

function resolveReferences(value: unknown, evidence: Record<string, string>): unknown {
  if (typeof value !== "string") return value;
  return value.replace(REFERENCE_RE, (m, g: string) => evidence[`E${g}`] ?? m);
}

function topological(plan: Plan): PlanStep[] {
  const resolved: PlanStep[] = [];
  const known = new Set<string>();
  let pending = [...plan.steps];
  while (pending.length > 0) {
    let progress = false;
    const rest: PlanStep[] = [];
    for (const step of pending) {
      const refs = [...pyRepr(step.args).matchAll(REFERENCE_RE)].map((m) => m[1]);
      if (refs.every((r) => known.has(`E${r}`))) {
        resolved.push(step);
        known.add(step.id);
        progress = true;
      } else {
        rest.push(step);
      }
    }
    if (!progress) throw new Error("cyclic plan or unresolved reference");
    pending = rest;
  }
  return resolved;
}

function runWorkers(plan: Plan, tools: ToolRegistry): Record<string, string> {
  const evidence: Record<string, string> = {};
  for (const step of topological(plan)) {
    const boundArgs: Args = {};
    for (const [k, v] of Object.entries(step.args)) boundArgs[k] = resolveReferences(v, evidence);
    evidence[step.id] = tools.dispatch(step.tool, boundArgs);
  }
  return evidence;
}

class ScriptedPlanner {
  constructor(public plan: Plan) {}

  planFor(_question: string): Plan {
    return this.plan;
  }
}

class ScriptedSolver {
  constructor(public template: string) {}

  solve(_question: string, _plan: Plan, evidence: Record<string, string>): string {
    return this.template.replace(/\{(\w+)\}/g, (_m, k: string) => {
      if (!(k in evidence)) throw new Error(`KeyError: ${pyStr(k)}`);
      return evidence[k];
    });
  }
}

function fakeSearch(args: Args): string {
  const query = String(args.query);
  if (query.toLowerCase().includes("capital of france")) return "Paris";
  if (query.toLowerCase().includes("population of paris")) return "11.2 million metro";
  if (query.toLowerCase().includes("capital of germany")) return "Berlin";
  return `no result for ${pyStr(query)}`;
}

function roundedMillion(args: Args): string {
  const text = String(args.text);
  const m = /([0-9]+\.?[0-9]*)/.exec(text);
  if (!m) return "unknown";
  return `${pyRound(parseFloat(m[1]))} million`;
}

interface ReWOORun {
  question: string;
  plan: Plan;
  evidence: Record<string, string>;
  answer: string;
  plannerChars: number;
  workerChars: number;
  solverChars: number;
}

function runRewoo(question: string, planner: ScriptedPlanner, tools: ToolRegistry, solver: ScriptedSolver): ReWOORun {
  const plan = planner.planFor(question);
  const plannerChars = question.length + plan.steps.reduce((a, s) => a + s.tool.length + pyRepr(s.args).length, 0);
  const evidence = runWorkers(plan, tools);
  const values = Object.values(evidence);
  let workerChars = 0;
  for (let i = 0; i < Math.min(plan.steps.length, values.length); i++) {
    workerChars += pyRepr(plan.steps[i].args).length + values[i].length;
  }
  const answer = solver.solve(question, plan, evidence);
  const solverChars = question.length + workerChars + answer.length;
  return { question, plan, evidence, answer, plannerChars, workerChars, solverChars };
}

function runReactMock(question: string, tools: ToolRegistry, trajectory: Array<[string, Args]>): number {
  const promptChars = question.length;
  let total = 0;
  let historyChars = 0;
  for (const [name, args] of trajectory) {
    total += promptChars + historyChars + name.length + pyRepr(args).length;
    const obs = tools.dispatch(name, args);
    historyChars += name.length + pyRepr(args).length + obs.length + 40;
  }
  total += promptChars + historyChars;
  return total;
}

function main(): void {
  console.log("=".repeat(70));
  console.log("REWOO: Planner, Workers, Solver (Phase 14, Lesson 02)");
  console.log("=".repeat(70));

  const tools = new ToolRegistry();
  tools.register("search", fakeSearch);
  tools.register("round_million", roundedMillion);

  const plan = new Plan([
    new PlanStep("E1", "search", { query: "capital of France" }),
    new PlanStep("E2", "search", { query: "population of #E1" }),
    new PlanStep("E3", "round_million", { text: "#E2" }),
  ]);
  const planner = new ScriptedPlanner(plan);
  const solver = new ScriptedSolver("The capital of France is {E1}; rounded population is {E3}.");
  const run = runRewoo("What is the population of the capital of France, rounded?", planner, tools, solver);

  console.log("\nPLAN");
  for (const step of run.plan.steps) console.log(`  ${step.id}: ${step.tool}(${pyRepr(step.args)})`);
  console.log("\nEVIDENCE");
  for (const [k, v] of Object.entries(run.evidence)) console.log(`  ${k} -> ${v}`);
  console.log(`\nFINAL: ${run.answer}`);

  const reactChars = runReactMock(run.question, tools, [
    ["search", { query: "capital of France" }],
    ["search", { query: "population of Paris" }],
    ["round_million", { text: "11.2 million metro" }],
  ]);
  const rewooChars = run.plannerChars + run.workerChars + run.solverChars;
  console.log("\nTOKEN INTUITION (chars, approximate)");
  console.log(`  react total  : ${reactChars}`);
  console.log(`  rewoo total  : ${rewooChars}`);
  console.log(`  ratio        : ${(reactChars / Math.max(rewooChars, 1)).toFixed(2)}x`);
  console.log("\npaper claim: ~5x fewer tokens on HotpotQA. toy approximates the shape.");
}

main();
