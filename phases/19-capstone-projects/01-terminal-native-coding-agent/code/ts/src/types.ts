export type Status = "pending" | "in_progress" | "done" | "failed";

export type TodoItem = {
  id: number;
  description: string;
  status: Status;
  note: string;
};

export type HookEvent =
  | "SessionStart"
  | "SessionEnd"
  | "PreToolUse"
  | "PostToolUse"
  | "UserPromptSubmit"
  | "Notification"
  | "Stop"
  | "PreCompact";

export type HookPayload = Record<string, unknown>;
export type HookFn = (payload: HookPayload) => HookPayload;

export type ToolArgs = Record<string, string>;
export type ToolFn = (sandbox: string, args: ToolArgs) => string;
export type ToolCall = { name: string; args: ToolArgs };

export type ModelTurn = {
  plan: TodoItem[];
  tool: ToolCall | null;
  tokens: number;
  cost: number;
};

export type BudgetSnapshot = {
  turnsUsed: number;
  tokensUsed: number;
  dollarsUsed: number;
};

export type RunResult = {
  plan: string;
  budget: BudgetSnapshot;
  trace: HookPayload[];
  passed: boolean;
};
