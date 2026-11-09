// Lesson: Planning with HTN and Evolutionary Search (phase 14 / lesson 11)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/11-planning-htn-and-evolutionary/docs/en.md
// Run: npx tsx phases/14-agent-engineering/11-planning-htn-and-evolutionary/code/main.ts

export {};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pyStr(s: string): string {
  return `'${s}'`;
}

function listRepr(xs: string[] | null): string {
  if (xs === null) return "None";
  return "[" + xs.map(pyStr).join(", ") + "]";
}

function tupleRepr(xs: string[]): string {
  if (xs.length === 1) return `(${pyStr(xs[0])},)`;
  return "(" + xs.map(pyStr).join(", ") + ")";
}

class Operator {
  constructor(
    public name: string,
    public preconditions: string[],
    public effectsAdd: string[],
    public effectsRemove: string[] = [],
  ) {}

  applicable(state: Set<string>): boolean {
    return this.preconditions.every((p) => state.has(p));
  }

  apply(state: Set<string>): Set<string> {
    const newState = new Set(state);
    for (const fact of this.effectsRemove) newState.delete(fact);
    for (const fact of this.effectsAdd) newState.add(fact);
    return newState;
  }
}

class Method {
  constructor(public name: string, public task: string, public preconditions: string[], public subtasks: string[]) {}

  applicable(state: Set<string>): boolean {
    return this.preconditions.every((p) => state.has(p));
  }
}

class ScriptedLLM {
  calls: string[] = [];

  constructor(private scripts: Record<string, string[]>) {}

  decompose(task: string, _state: Set<string>): string[] | null {
    this.calls.push(task);
    return this.scripts[task] ?? null;
  }
}

class HTNPlanner {
  cachedMethods = new Map<string, string[]>();

  constructor(
    public operators: Record<string, Operator>,
    public methods: Record<string, Method[]>,
    public llm: ScriptedLLM,
  ) {}

  plan(task: string, state: Set<string>, depth = 0, maxDepth = 12): string[] | null {
    if (depth > maxDepth) return null;
    if (task in this.operators) {
      const op = this.operators[task];
      if (op.applicable(state)) return [task];
      return null;
    }
    const applicable = (this.methods[task] ?? []).filter((m) => m.applicable(state));
    const cached = this.cachedMethods.get(task);
    if (applicable.length === 0 && cached !== undefined) return this.expand([...cached], state, depth);
    if (applicable.length === 0) {
      const suggested = this.llm.decompose(task, state);
      if (suggested === null) return null;
      if (!suggested.every((s) => s in this.operators || s in this.methods)) return null;
      this.cachedMethods.set(task, suggested);
      return this.expand([...suggested], state, depth);
    }
    const method = applicable[0];
    return this.expand([...method.subtasks], state, depth);
  }

  private expand(subtasks: string[], state: Set<string>, depth: number): string[] | null {
    const plan: string[] = [];
    let currentState = new Set(state);
    for (const subtask of subtasks) {
      const subPlan = this.plan(subtask, currentState, depth + 1);
      if (subPlan === null) return null;
      for (const step of subPlan) {
        const op = this.operators[step];
        if (op === undefined || !op.applicable(currentState)) return null;
        currentState = op.apply(currentState);
        plan.push(step);
      }
    }
    return plan;
  }
}

function htnDemo(): void {
  console.log("-".repeat(70));
  console.log("demo 1: ChatHTN-style hybrid HTN planner");
  console.log("-".repeat(70));
  const operators: Record<string, Operator> = {
    open_editor: new Operator("open_editor", ["logged_in"], ["editor_open"]),
    write_tests: new Operator("write_tests", ["editor_open"], ["tests_written"]),
    run_tests: new Operator("run_tests", ["tests_written"], ["tests_passing"]),
    open_pr: new Operator("open_pr", ["tests_passing"], ["pr_open"]),
  };
  const methods: Record<string, Method[]> = {
    ship_change: [
      new Method("ship_change_m1", "ship_change", ["logged_in"], ["open_editor", "write_tests", "run_tests", "open_pr"]),
    ],
  };
  const llm = new ScriptedLLM({
    ship_feature_with_migration: ["open_editor", "write_tests", "run_tests", "open_pr"],
  });
  const planner = new HTNPlanner(operators, methods, llm);

  const state = new Set(["logged_in"]);
  console.log("\ncase A: goal=ship_change (method library matches)");
  let plan = planner.plan("ship_change", state);
  console.log(`  plan: ${listRepr(plan)}`);
  console.log(`  llm calls: ${listRepr(planner.llm.calls)}`);

  console.log("\ncase B: goal=ship_feature_with_migration (no method -> LLM fallback)");
  plan = planner.plan("ship_feature_with_migration", state);
  console.log(`  plan: ${listRepr(plan)}`);
  console.log(`  llm calls (cumulative): ${listRepr(planner.llm.calls)}`);
  const cache = [...planner.cachedMethods.entries()].map(([k, v]) => `${pyStr(k)}: ${tupleRepr(v)}`).join(", ");
  console.log(`  cache hit for next time: {${cache}}`);

  console.log("\ncase C: goal=ship_feature_with_migration (cached now -> no LLM call)");
  const llmCallsBefore = planner.llm.calls.length;
  plan = planner.plan("ship_feature_with_migration", state);
  console.log(`  plan: ${listRepr(plan)}`);
  const newCalls = planner.llm.calls.length - llmCallsBefore;
  console.log(`  new LLM calls this round: ${newCalls}  (expect 0)`);
}

function evolutionaryDemo(): void {
  console.log();
  console.log("-".repeat(70));
  console.log("demo 2: AlphaEvolve-style evolutionary search (toy)");
  console.log("-".repeat(70));
  const rng = mulberry32(0);
  const choice = <T>(xs: T[]): T => xs[Math.floor(rng() * xs.length)];
  const randint = (lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo + 1));

  const evaluator = (a: number, b: number): number => {
    let total = 0.0;
    for (let x = -5; x < 6; x++) {
      const target = 3 * x + 7;
      const guess = a * x + b;
      total += (target - guess) ** 2;
    }
    return total;
  };

  const randomMutation = (a: number, b: number): [number, number] => {
    const da = choice([-2, -1, 0, 1, 2]);
    const db = choice([-2, -1, 0, 1, 2]);
    return [a + da, b + db];
  };

  type Indiv = [number, number, number];
  let population: Indiv[] = [];
  for (let i = 0; i < 6; i++) population.push([randint(-10, 10), randint(-10, 10), 0.0]);
  population = population.map(([a, b]) => [a, b, evaluator(a, b)]);
  population.sort((p, q) => p[2] - q[2]);

  const generations = 12;
  const pad = (n: number): string => String(n).padStart(3);
  console.log("\nseed population (a*x + b, target 3x + 7)");
  for (const [a, b, fit] of population.slice(0, 3)) console.log(`  a=${pad(a)}  b=${pad(b)}  fitness=${fit.toFixed(2)}`);

  for (let gen = 1; gen <= generations; gen++) {
    const survivors = population.slice(0, 3);
    const children: Indiv[] = [];
    for (const [a, b] of survivors) {
      for (let k = 0; k < 3; k++) {
        const [na, nb] = randomMutation(a, b);
        children.push([na, nb, evaluator(na, nb)]);
      }
    }
    population = [...survivors, ...children].sort((p, q) => p[2] - q[2]).slice(0, 6);
    if (gen % 3 === 0) {
      const best = population[0];
      console.log(
        `  gen ${String(gen).padStart(2, "0")}: best a=${pad(best[0])} b=${pad(best[1])} fitness=${best[2].toFixed(2)}`,
      );
    }
  }

  const best = population[0];
  console.log(`\nconverged on: a=${best[0]}  b=${best[1]}  fitness=${best[2].toFixed(2)}`);
  console.log("expected:     a=3    b=7    fitness=0.00");
}

function main(): void {
  console.log("=".repeat(70));
  console.log("HTN + EVOLUTIONARY SEARCH: Phase 14, Lesson 11");
  console.log("=".repeat(70));
  htnDemo();
  evolutionaryDemo();
  console.log();
  console.log("HTN: LLM amplifies method library; symbolic layer owns correctness.");
  console.log("AlphaEvolve: ensemble mutates, deterministic evaluator selects.");
  console.log("both require machine-checkable structure. reach for ReAct first.");
}

main();
