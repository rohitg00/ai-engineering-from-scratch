// Lesson: Benchmarks: SWE-bench, GAIA, AgentBench (phase 14 / lesson 19)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/19-benchmarks-swebench-gaia/docs/en.md
// Run: npx tsx phases/14-agent-engineering/19-benchmarks-swebench-gaia/code/main.ts

type State = Record<string, number | boolean>;
type Check = [string, (s: State) => boolean];

interface Task {
  tid: string;
  description: string;
  stateBefore: State;
  patch: (s: State) => State;
  failToPass: Check[];
  passToPass: Check[];
}

interface TaskResult {
  tid: string;
  ftpPassed: number;
  ftpTotal: number;
  ptpPassed: number;
  ptpTotal: number;
  resolved: boolean;
}

function pyBool(b: boolean): string {
  return b ? "True" : "False";
}

function countPassing(checks: Check[], state: State): number {
  return checks.filter(([, check]) => check(state)).length;
}

function runTask(task: Task): TaskResult {
  const state: State = { ...task.stateBefore };
  const ftpPre = countPassing(task.failToPass, state);
  const ptpPre = countPassing(task.passToPass, state);

  const newState = task.patch({ ...state });

  const ftpPost = countPassing(task.failToPass, newState);
  const ptpPost = countPassing(task.passToPass, newState);

  const ftpFixed = ftpPost - ftpPre;
  const ptpBroke = ptpPre - ptpPost;
  const resolved = ftpPost === task.failToPass.length && ptpBroke === 0;

  return {
    tid: task.tid,
    ftpPassed: ftpPost,
    ftpTotal: task.failToPass.length,
    ptpPassed: ptpPost,
    ptpTotal: task.passToPass.length,
    resolved,
  };
}

function gaiaLevel(question: string): number {
  const lower = question.toLowerCase();
  const stepWords = new Set(["then", "after", "finally", "next", "and"]);
  const steps = lower.split(/\s+/).filter((w) => w.length > 0 && stepWords.has(w)).length + 1;
  const modalities = ["image", "video", "audio", "pdf", "chart", "graph"].filter((w) => lower.includes(w)).length;
  const tools = ["search", "look up", "find", "visit", "extract"].filter((w) => lower.includes(w)).length;
  const score = steps + modalities + tools;
  if (score <= 2) return 1;
  if (score <= 5) return 2;
  return 3;
}

function sweDemo(): void {
  console.log("-".repeat(70));
  console.log("SWE-bench-style harness (FAIL_TO_PASS + PASS_TO_PASS)");
  console.log("-".repeat(70));

  const tasks: Task[] = [
    {
      tid: "t001",
      description: "fix off-by-one in counter",
      stateBefore: { counter: 0, multiplier: 2 },
      patch: (s) => ({ ...s, counter: (s.counter as number) + 1 }),
      failToPass: [["counter > 0", (s) => (s.counter as number) > 0]],
      passToPass: [["multiplier unchanged", (s) => s.multiplier === 2]],
    },
    {
      tid: "t002",
      description: "fix multiplier regression",
      stateBefore: { counter: 1, multiplier: 0 },
      patch: (s) => ({ ...s, multiplier: 2 }),
      failToPass: [["multiplier > 0", (s) => (s.multiplier as number) > 0]],
      passToPass: [["counter unchanged", (s) => s.counter === 1]],
    },
    {
      tid: "t003",
      description: "agent overreaches and breaks a passing test",
      stateBefore: { counter: 1, multiplier: 2, flag: true },
      patch: (s) => ({ ...s, counter: 2, flag: false }),
      failToPass: [["counter > 1", (s) => (s.counter as number) > 1]],
      passToPass: [
        ["flag stays true", (s) => s.flag === true],
        ["multiplier unchanged", (s) => s.multiplier === 2],
      ],
    },
  ];

  let resolvedCount = 0;
  for (const task of tasks) {
    const result = runTask(task);
    console.log(`  ${result.tid}: ${task.description}`);
    console.log(`    FAIL_TO_PASS: ${result.ftpPassed}/${result.ftpTotal}`);
    console.log(`    PASS_TO_PASS: ${result.ptpPassed}/${result.ptpTotal}`);
    console.log(`    resolved:     ${pyBool(result.resolved)}`);
    if (result.resolved) resolvedCount += 1;
  }
  console.log(`\nresolution rate: ${resolvedCount}/${tasks.length}`);
}

function gaiaDemo(): void {
  console.log("\n" + "-".repeat(70));
  console.log("GAIA-style difficulty classifier");
  console.log("-".repeat(70));
  const questions = [
    "What is the capital of France?",
    "Search for the Wikipedia article on ReAct and extract the first author.",
    "Visit the arXiv listing for ReAct, find the GitHub linked in the PDF, " +
      "then count the open issues with label 'bug' and return the ratio " +
      "of bugs to total issues as a decimal.",
  ];
  for (const q of questions) {
    const level = gaiaLevel(q);
    console.log(`  [Level ${level}] ${q.slice(0, 70)}`);
  }
}

function main(): void {
  console.log("=".repeat(70));
  console.log("BENCHMARKS: SWE-bench, GAIA (Phase 14, Lesson 19)");
  console.log("=".repeat(70));
  sweDemo();
  gaiaDemo();
  console.log();
  console.log("SWE-bench: patch-based, unit-test-gated. Verified removes ambiguity.");
  console.log("GAIA: depth + modalities + tools -> difficulty level.");
  console.log("report both your benchmark score AND the Verified/+-audited score.");
}

main();
