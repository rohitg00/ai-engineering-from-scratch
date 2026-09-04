import { runAgent } from "./harness.ts";

export type EvalCase = { task: string; expectedDone: number };

export const EVAL_TASKS: EvalCase[] = [
  { task: "diagnose worker.rs", expectedDone: 3 },
  { task: "summarize README", expectedDone: 3 },
  { task: "run smoke tests", expectedDone: 3 },
];

export type EvalResult = { passed: number; failed: number };

export function runEval(sandbox: string, cases: EvalCase[] = EVAL_TASKS): EvalResult {
  let passed = 0;
  let failed = 0;
  for (const t of cases) {
    const r = runAgent(t.task, sandbox);
    const doneCount = (r.plan.match(/\[x\]/g) ?? []).length;
    if (r.passed && doneCount >= t.expectedDone) passed += 1;
    else failed += 1;
  }
  return { passed, failed };
}
