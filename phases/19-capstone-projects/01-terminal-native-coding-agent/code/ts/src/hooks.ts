import type { HookEvent, HookFn, HookPayload, ToolArgs } from "./types.ts";

export class HookBus {
  static readonly EVENTS: HookEvent[] = [
    "SessionStart",
    "SessionEnd",
    "PreToolUse",
    "PostToolUse",
    "UserPromptSubmit",
    "Notification",
    "Stop",
    "PreCompact",
  ];

  private hooks: Map<HookEvent, HookFn[]> = new Map();

  constructor() {
    for (const e of HookBus.EVENTS) this.hooks.set(e, []);
  }

  on(event: HookEvent, fn: HookFn): void {
    this.hooks.get(event)!.push(fn);
  }

  fire(event: HookEvent, payload: HookPayload): HookPayload {
    let current = payload;
    for (const fn of this.hooks.get(event)!) {
      current = fn(current) ?? current;
    }
    return current;
  }
}

const DESTRUCTIVE_PATTERNS = [/\brm\s+-rf\b/, /\bshutdown\b/];

export function destructiveGuard(payload: HookPayload): HookPayload {
  const rawArgs = payload.args;
  const args =
    rawArgs && typeof rawArgs === "object" ? (rawArgs as ToolArgs) : ({} as ToolArgs);
  const rawCmd = args.cmd;
  if (typeof rawCmd !== "string") return payload;
  const cmd = rawCmd.trim().toLowerCase();
  if (DESTRUCTIVE_PATTERNS.some((re) => re.test(cmd))) {
    return {
      ...payload,
      blocked: true,
      reason: "destructive command blocked by PreToolUse hook",
    };
  }
  return payload;
}
