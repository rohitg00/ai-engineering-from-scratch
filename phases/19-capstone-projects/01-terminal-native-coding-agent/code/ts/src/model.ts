import type { ModelTurn, Status, ToolCall, TodoItem } from "./types.ts";
import type { PlanState } from "./plan.ts";

type ScriptStep = {
  plan: ReadonlyArray<readonly [string, Status]>;
  tool: ToolCall | null;
  tokens: number;
  cost: number;
};

const SCRIPT: ScriptStep[] = [
  {
    plan: [
      ["locate target file", "in_progress"],
      ["read and diagnose", "pending"],
      ["apply fix and verify", "pending"],
    ],
    tool: { name: "run_shell", args: { cmd: "ls" } },
    tokens: 1200,
    cost: 0.02,
  },
  {
    plan: [
      ["locate target file", "done"],
      ["read and diagnose", "in_progress"],
      ["apply fix and verify", "pending"],
    ],
    tool: { name: "read_file", args: { path: "README.md" } },
    tokens: 900,
    cost: 0.02,
  },
  {
    plan: [
      ["locate target file", "done"],
      ["read and diagnose", "done"],
      ["apply fix and verify", "done"],
    ],
    tool: null,
    tokens: 600,
    cost: 0.01,
  },
];

export class ScriptedModel {
  step(_plan: PlanState, turn: number): ModelTurn {
    if (turn >= SCRIPT.length) {
      return { plan: [], tool: null, tokens: 200, cost: 0.005 };
    }
    const s = SCRIPT[turn];
    const items: TodoItem[] = s.plan.map(([description, status], i) => ({
      id: i + 1,
      description,
      status,
      note: "",
    }));
    return { plan: items, tool: s.tool, tokens: s.tokens, cost: s.cost };
  }

  scriptLength(): number {
    return SCRIPT.length;
  }
}
