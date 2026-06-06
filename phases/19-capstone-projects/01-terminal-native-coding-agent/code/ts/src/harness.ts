import { Budget, PlanState } from "./plan.ts";
import { HookBus, destructiveGuard } from "./hooks.ts";
import { ScriptedModel } from "./model.ts";
import { TOOLS } from "./tools.ts";
import type { HookPayload, RunResult } from "./types.ts";

export function runAgent(task: string, sandbox: string): RunResult {
  const plan = new PlanState(task);
  const budget = new Budget();
  const hooks = new HookBus();
  const trace: HookPayload[] = [];
  const model = new ScriptedModel();

  hooks.on("PreToolUse", destructiveGuard);
  hooks.on("PostToolUse", (p) => {
    trace.push({ event: "tool", ...p });
    return p;
  });
  hooks.on("SessionStart", (p) => {
    trace.push({ event: "start", ...p });
    return p;
  });
  hooks.on("SessionEnd", (p) => {
    trace.push({ event: "end", ...p });
    return p;
  });
  hooks.on("Stop", (p) => {
    trace.push({ event: "stop", ...p });
    return p;
  });

  hooks.fire("SessionStart", { task, sandbox, startedAt: Date.now() });

  let turn = 0;
  let completed = false;
  while (true) {
    const limit = budget.exceeded();
    if (limit) {
      hooks.fire("Stop", { reason: limit, turn });
      break;
    }
    const step = model.step(plan, turn);
    plan.rewrite(step.plan);
    budget.step(step.tokens, step.cost);

    const postStepLimit = budget.exceeded();
    if (postStepLimit) {
      hooks.fire("Stop", { reason: "budget", turn });
      completed = true;
      break;
    }

    if (step.tool === null) {
      hooks.fire("Stop", { reason: "complete", turn });
      completed = true;
      break;
    }

    const { name, args } = step.tool;
    const pre = hooks.fire("PreToolUse", { tool: name, args });
    if (pre.blocked) {
      hooks.fire("PostToolUse", {
        tool: name,
        blocked: true,
        reason: String(pre.reason ?? ""),
      });
      turn += 1;
      continue;
    }

    try {
      const result = TOOLS[name](sandbox, args);
      hooks.fire("PostToolUse", { tool: name, ok: true, bytes: result.length });
    } catch (err) {
      const e = err as Error;
      hooks.fire("PostToolUse", { tool: name, ok: false, error: e.message });
    }
    turn += 1;
  }

  hooks.fire("SessionEnd", budget.snapshot() as unknown as HookPayload);

  const allDone =
    plan.items.length > 0 && plan.items.every((it) => it.status === "done");
  return {
    plan: plan.summary(),
    budget: budget.snapshot(),
    trace,
    passed: completed && allDone,
  };
}
