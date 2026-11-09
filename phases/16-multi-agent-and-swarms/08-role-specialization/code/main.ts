// Lesson: Role Specialization: Planner, Critic, Executor, Verifier (phase 16 / lesson 08)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/08-role-specialization/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/08-role-specialization/code/main.ts

export {};

interface Spec {
  task_name: string;
  signature: string;
  description: string;
  tests: [number[], number][];
}

interface Artifact {
  code: string;
}

interface CriticReport {
  approved: boolean;
  notes: string[];
}

interface VerifierReport {
  passed: boolean;
  failures: string[];
}

function pyStr(s: string): string {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
  if (q === "'") out = out.replace(/'/g, "\\'");
  return q + out + q;
}

function pyList(items: string[]): string {
  return "[" + items.map(pyStr).join(", ") + "]";
}

function pyTuple(items: number[]): string {
  return items.length === 1 ? `(${items[0]},)` : "(" + items.join(", ") + ")";
}

function pyBool(b: boolean): string {
  return b ? "True" : "False";
}

function planner(userWish: string): Spec {
  return {
    task_name: "add_two",
    signature: "add_two(a: int, b: int) -> int",
    description: userWish,
    tests: [[[1, 2], 3], [[10, 20], 30], [[-5, 5], 0]],
  };
}

function executorCorrect(spec: Spec): Artifact {
  void spec;
  return { code: "def add_two(a, b):\n    return a + b\n" };
}

function executorBuggy(spec: Spec): Artifact {
  void spec;
  return { code: "def add_two(a, b):\n    return a * b\n" };
}

function critic(spec: Spec, art: Artifact): CriticReport {
  const notes: string[] = [];
  if (!art.code.includes("def")) notes.push("missing def statement");
  if (!art.code.includes("return")) notes.push("missing return");
  if (!art.code.includes(spec.task_name)) notes.push(`function name does not match spec '${spec.task_name}'`);
  return { approved: notes.length === 0, notes };
}

function execPythonSubset(code: string): Map<string, (...args: number[]) => unknown> {
  const ns = new Map<string, (...args: number[]) => unknown>();
  const lines = code.split("\n").filter((l) => l.trim() !== "");
  let i = 0;
  while (i < lines.length) {
    const header = /^def\s+(\w+)\s*\(([^)]*)\)\s*:\s*$/.exec(lines[i]);
    if (!header) throw new Error(`invalid syntax (line ${i + 1})`);
    const body: string[] = [];
    i++;
    while (i < lines.length && /^\s+/.test(lines[i])) {
      const ret = /^\s+return\s+(.+)$/.exec(lines[i]);
      if (!ret) throw new Error(`invalid syntax (line ${i + 1})`);
      body.push(`return (${ret[1]});`);
      i++;
    }
    const params = header[2].split(",").map((p) => p.trim()).filter((p) => p !== "");
    ns.set(header[1], new Function(...params, body.join("\n")) as (...args: number[]) => unknown);
  }
  return ns;
}

function verifier(spec: Spec, art: Artifact): VerifierReport {
  let ns: Map<string, (...args: number[]) => unknown>;
  try {
    ns = execPythonSubset(art.code);
  } catch (e) {
    return { passed: false, failures: [`exec error: ${(e as Error).message}`] };
  }
  const fn = ns.get(spec.task_name);
  if (typeof fn !== "function") {
    return { passed: false, failures: [`no callable '${spec.task_name}' produced`] };
  }
  const failures: string[] = [];
  for (const [args, expected] of spec.tests) {
    let got: unknown;
    try {
      got = fn(...args);
    } catch (e) {
      failures.push(`call ${pyTuple(args)} raised ${(e as Error).message}`);
      continue;
    }
    if (got !== expected) failures.push(`call ${pyTuple(args)}: expected ${expected}, got ${got}`);
  }
  return { passed: failures.length === 0, failures };
}

function runPipeline(userWish: string, executor: (spec: Spec) => Artifact, label: string): void {
  console.log(`\n=== ${label} ===`);
  const spec = planner(userWish);
  console.log(`  [planner] spec: ${spec.signature} with ${spec.tests.length} tests`);
  const art = executor(spec);
  console.log(`  [executor] produced:\n    ${art.code.split("\n").join("\n    ")}`);
  const crep = critic(spec, art);
  console.log(`  [critic] approved=${pyBool(crep.approved)}, notes=${pyList(crep.notes)}`);
  const vrep = verifier(spec, art);
  console.log(`  [verifier] passed=${pyBool(vrep.passed)}, failures=${pyList(vrep.failures)}`);
  if (crep.approved && vrep.passed) {
    console.log("  RESULT: ship it.");
  } else if (!vrep.passed) {
    console.log("  RESULT: verifier blocked ship (deterministic catch).");
  } else if (!crep.approved) {
    console.log("  RESULT: critic blocked ship (subjective catch).");
  }
}

function main(): void {
  console.log("Role specialization pipeline: planner, executor, critic, verifier");
  console.log("-".repeat(70));

  runPipeline(
    "A function that returns the sum of two integers.",
    executorCorrect,
    "Correct executor output",
  );

  runPipeline(
    "A function that returns the sum of two integers.",
    executorBuggy,
    "Buggy executor output (looks plausible; fails runtime)",
  );

  console.log("\nKey insight: the critic passes the buggy code because it looks fine.");
  console.log("Only the verifier -- deterministic test execution -- catches the semantic bug.");
  console.log("All-LLM pipelines (no verifier) would ship the bug. Classic MAST failure mode.");
}

main();
