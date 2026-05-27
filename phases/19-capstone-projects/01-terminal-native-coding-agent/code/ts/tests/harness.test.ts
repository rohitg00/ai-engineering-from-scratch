import { test } from "node:test";
import { strict as assert } from "node:assert";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { runAgent } from "../src/harness.ts";
import { runEval } from "../src/eval.ts";
import { HookBus, destructiveGuard } from "../src/hooks.ts";
import { Budget, PlanState } from "../src/plan.ts";
import { parseCommand } from "../src/repl.ts";

const here = path.dirname(fileURLToPath(import.meta.url));

test("runAgent: scripted task converges to all-done plan", () => {
  const r = runAgent("demo", here);
  assert.equal(r.passed, true);
  assert.ok(r.plan.includes("[x] 1."));
  assert.ok(r.plan.includes("[x] 3."));
  assert.equal(r.budget.turnsUsed >= 1, true);
  assert.equal(r.budget.dollarsUsed > 0, true);
});

test("runEval: all three offline tasks pass", () => {
  const e = runEval(here);
  assert.equal(e.passed, 3);
  assert.equal(e.failed, 0);
});

test("HookBus: fires hooks in registration order", () => {
  const bus = new HookBus();
  const order: string[] = [];
  bus.on("PreToolUse", (p) => {
    order.push("a");
    return p;
  });
  bus.on("PreToolUse", (p) => {
    order.push("b");
    return p;
  });
  bus.fire("PreToolUse", { tool: "x" });
  assert.deepEqual(order, ["a", "b"]);
});

test("destructiveGuard: blocks rm -rf", () => {
  const out = destructiveGuard({ tool: "run_shell", args: { cmd: "rm -rf /" } });
  assert.equal(out.blocked, true);
  assert.match(String(out.reason), /destructive/);
});

test("destructiveGuard: passes safe commands", () => {
  const out = destructiveGuard({ tool: "run_shell", args: { cmd: "ls" } });
  assert.equal(out.blocked, undefined);
});

test("Budget: trips on turn limit", () => {
  const b = new Budget();
  b.maxTurns = 2;
  b.step(10, 0.01);
  assert.equal(b.exceeded(), null);
  b.step(10, 0.01);
  assert.equal(b.exceeded(), "turn_limit");
});

test("PlanState: summary marks status correctly", () => {
  const p = new PlanState("write");
  p.rewrite([
    { id: 1, description: "draft", status: "done", note: "" },
    { id: 2, description: "edit", status: "in_progress", note: "" },
  ]);
  const s = p.summary();
  assert.match(s, /\[x\] 1\. draft/);
  assert.match(s, /\[>\] 2\. edit/);
});

test("parseCommand: recognizes core verbs", () => {
  assert.equal(parseCommand("quit").kind, "quit");
  assert.equal(parseCommand("help").kind, "help");
  assert.equal(parseCommand("eval").kind, "eval");
  const run = parseCommand("run fix the bug");
  assert.equal(run.kind, "run");
  if (run.kind === "run") assert.equal(run.task, "fix the bug");
  assert.equal(parseCommand("teleport").kind, "unknown");
});
