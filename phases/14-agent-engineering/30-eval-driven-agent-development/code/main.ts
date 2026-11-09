// Lesson: Eval-Driven Agent Development (phase 14 / lesson 30)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/30-eval-driven-agent-development/docs/en.md
// Run: npx tsx phases/14-agent-engineering/30-eval-driven-agent-development/code/main.ts

interface EvalCase {
  cid: string;
  category: string;
  description: string;
  proposer: (feedback: string | null) => string;
  judge: (candidate: string) => [boolean, string];
  maxRounds: number;
}

interface CaseResult {
  cid: string;
  category: string;
  passed: boolean;
  rounds: number;
  final: string;
  reason: string;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function evaluatorOptimizer(c: EvalCase): CaseResult {
  let feedback: string | null = null;
  let candidate = "";
  for (let r = 0; r < c.maxRounds; r++) {
    candidate = c.proposer(feedback);
    const [ok, reason] = c.judge(candidate);
    if (ok) return { cid: c.cid, category: c.category, passed: true, rounds: r + 1, final: candidate, reason };
    feedback = reason;
  }
  return {
    cid: c.cid,
    category: c.category,
    passed: false,
    rounds: c.maxRounds,
    final: candidate,
    reason: feedback || "unknown",
  };
}

function ciGate(results: CaseResult[], baselinePassRate: number, regressionThreshold = 0.05): [boolean, string] {
  if (results.length === 0) return [false, "no cases"];
  const passRate = results.filter((r) => r.passed).length / results.length;
  const regression = baselinePassRate - passRate;
  if (regression > regressionThreshold) {
    return [false, `regression ${pct(regression)} > threshold ` + `${pct(regressionThreshold)}`];
  }
  return [true, `pass_rate=${pct(passRate)} baseline=${pct(baselinePassRate)}`];
}

function benchmarkCase(): EvalCase {
  const proposer = (feedback: string | null): string => {
    if (feedback && feedback.includes("missing sticks")) return "patch: add stick dep and craft";
    return "patch: just craft";
  };
  const judge = (candidate: string): [boolean, string] => {
    if (candidate.includes("add stick dep")) return [true, "FAIL_TO_PASS fixed, PASS_TO_PASS intact"];
    return [false, "missing sticks in recipe"];
  };
  return {
    cid: "bench_t001",
    category: "benchmark",
    description: "fix craft_iron_pickaxe recipe",
    proposer,
    judge,
    maxRounds: 3,
  };
}

function customLlmJudgeCase(): EvalCase {
  const proposer = (feedback: string | null): string => {
    if (feedback && feedback.includes("citations")) return "answer with cite [arXiv:2210.03629]";
    return "answer without citation";
  };
  const judge = (candidate: string): [boolean, string] => {
    if (candidate.includes("arXiv") || candidate.includes("cite")) return [true, "citations present"];
    return [false, "missing citations"];
  };
  return {
    cid: "custom_c001",
    category: "custom",
    description: "ReAct summary must cite arXiv paper",
    proposer,
    judge,
    maxRounds: 3,
  };
}

function onlineGuardrailCase(): EvalCase {
  const proposer = (feedback: string | null): string => {
    if (feedback && feedback.toLowerCase().includes("ssn")) return "refused: will not process social security numbers";
    return "forwarded: ssn 123-45-6789 to downstream system";
  };
  const judge = (candidate: string): [boolean, string] => {
    if (candidate.toLowerCase().includes("refused")) return [true, "PII guardrail held"];
    return [false, "ssn was forwarded; PII guardrail failed"];
  };
  return {
    cid: "online_o001",
    category: "online",
    description: "PII guardrail blocks SSN forwarding",
    proposer,
    judge,
    maxRounds: 3,
  };
}

function flakyBenchmarkCase(): EvalCase {
  let attempt = 0;
  const proposer = (_feedback: string | null): string => {
    attempt += 1;
    if (attempt >= 2) return "patch: correct";
    return "patch: wrong first time";
  };
  const judge = (candidate: string): [boolean, string] => {
    if (candidate.includes("correct")) return [true, "pass"];
    return [false, "try again"];
  };
  return {
    cid: "bench_t002",
    category: "benchmark",
    description: "eventually-correct patch",
    proposer,
    judge,
    maxRounds: 3,
  };
}

function main(): void {
  console.log("=".repeat(70));
  console.log("EVAL-DRIVEN AGENT DEVELOPMENT: Phase 14, Lesson 30");
  console.log("=".repeat(70));

  const cases = [benchmarkCase(), flakyBenchmarkCase(), customLlmJudgeCase(), onlineGuardrailCase()];

  const results: CaseResult[] = [];
  console.log();
  for (const c of cases) {
    const result = evaluatorOptimizer(c);
    results.push(result);
    const verdict = result.passed ? "PASS" : "FAIL";
    console.log(`  [${result.category.padEnd(9)}] ${result.cid}  ${verdict}  ` + `rounds=${result.rounds}`);
    console.log(`    ${c.description}`);
    console.log(`    final: ${result.final}`);
    console.log(`    reason: ${result.reason}`);
  }

  const baseline = 0.95;
  const [ok, message] = ciGate(results, baseline);
  console.log(`\nCI gate: ${ok ? "ALLOW" : "BLOCK"}  (${message})`);

  console.log("\nper-category breakdown");
  for (const category of ["benchmark", "custom", "online"]) {
    const catResults = results.filter((r) => r.category === category);
    if (catResults.length === 0) continue;
    const passed = catResults.filter((r) => r.passed).length;
    console.log(`  ${category.padEnd(9)}: ${passed}/${catResults.length}`);
  }

  console.log();
  console.log("evals live next to code, run in CI, gate merges.");
  console.log("every guardrail and learned rule maps to a case.");
}

main();
