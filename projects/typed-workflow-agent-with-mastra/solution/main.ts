/*
 * Typed Workflow Agent with Mastra reference implementation.
 * Follow stages in projects/typed-workflow-agent-with-mastra/stages/.
 * The demo is deterministic and requires no provider credentials.
 * Protocol references are listed in the project README.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

export type Ticket = { id: string; message: string };
export type Classification = {
  ticket: Ticket;
  intent: "read" | "write";
  topic: string;
};
export type Action = { tool: "lookup" | "update"; query: string };
export type Plan = {
  ticket: Ticket;
  actions: Action[];
  requiresApproval: boolean;
};
export type Tool = (name: Action["tool"], query: string) => Promise<string>;
export type Trace = { step: string; status: string; attempt: number };
export type Result =
  | {
      status: "complete";
      result: { ticketId: string; answer: string; calls: number };
      trace: Trace[];
    }
  | { status: "suspended"; checkpoint: Plan; trace: Trace[] }
  | { status: "failed"; reason: string; trace: Trace[] };
export function parseTicket(raw: unknown): Ticket {
  if (!raw || typeof raw !== "object") throw new Error("invalid ticket");
  const t = raw as Ticket;
  if (
    typeof t.id !== "string" ||
    !t.id.trim() ||
    typeof t.message !== "string" ||
    !t.message.trim() ||
    t.message.length > 10000
  )
    throw new Error("invalid ticket");
  return { id: t.id.trim(), message: t.message.trim() };
}
export function classify(raw: unknown): Classification {
  const ticket = parseTicket(raw);
  const lower = ticket.message.toLowerCase();
  return {
    ticket,
    intent: /\b(update|delete|change|cancel)\b/.test(lower) ? "write" : "read",
    topic: lower.includes("billing")
      ? "billing"
      : lower.includes("account")
        ? "account"
        : "general",
  };
}
export function makePlan(c: Classification): Plan {
  parseTicket(c.ticket);
  if (!["read", "write"].includes(c.intent)) throw new Error("invalid intent");
  return {
    ticket: c.ticket,
    actions: [
      {
        tool: c.intent === "write" ? "update" : "lookup",
        query: c.ticket.message,
      },
    ],
    requiresApproval: c.intent === "write",
  };
}
export function validatePlan(plan: Plan): Plan {
  parseTicket(plan.ticket);
  if (
    !Array.isArray(plan.actions) ||
    !plan.actions.length ||
    plan.actions.length > 10 ||
    plan.actions.some(
      (a) =>
        !["lookup", "update"].includes(a.tool) ||
        typeof a.query !== "string" ||
        !a.query.trim(),
    )
  )
    throw new Error("invalid plan");
  if (plan.requiresApproval !== plan.actions.some((a) => a.tool === "update"))
    throw new Error("invalid approval contract");
  return plan;
}
export async function executePlan(
  plan: Plan,
  tool: Tool,
  options: { approved?: boolean; maxCalls?: number; maxAttempts?: number } = {},
): Promise<Result> {
  validatePlan(plan);
  const maxCalls = options.maxCalls ?? 3,
    maxAttempts = options.maxAttempts ?? 2;
  if (
    !Number.isInteger(maxCalls) ||
    maxCalls < 1 ||
    maxCalls > 100 ||
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1 ||
    maxAttempts > 10
  )
    throw new Error("invalid budget");
  const trace: Trace[] = [];
  if (plan.requiresApproval && !options.approved)
    return {
      status: "suspended",
      checkpoint: structuredClone(plan),
      trace: [{ step: "approval", status: "suspended", attempt: 0 }],
    };
  let calls = 0;
  const answers: string[] = [];
  for (const action of plan.actions) {
    let complete = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (calls >= maxCalls)
        return { status: "failed", reason: "call budget exhausted", trace };
      calls++;
      try {
        const result = await tool(action.tool, action.query);
        if (typeof result !== "string" || !result.trim())
          throw new Error("empty tool result");
        answers.push(result.trim());
        trace.push({ step: action.tool, status: "complete", attempt });
        complete = true;
        break;
      } catch (e) {
        trace.push({ step: action.tool, status: "failed", attempt });
        if (attempt === maxAttempts)
          return { status: "failed", reason: (e as Error).message, trace };
      }
    }
    if (!complete)
      return { status: "failed", reason: "retry exhausted", trace };
  }
  return {
    status: "complete",
    result: { ticketId: plan.ticket.id, answer: answers.join("\n"), calls },
    trace,
  };
}
export async function runTicket(
  raw: unknown,
  tool: Tool,
  options: { approved?: boolean; maxCalls?: number; maxAttempts?: number } = {},
): Promise<Result> {
  return executePlan(makePlan(classify(raw)), tool, options);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const tool: Tool = async (name, query) =>
    name === "lookup"
      ? "Billing policy: receipts are required."
      : `Recorded change: ${query}`;
  const read = await runTicket(
    { id: "T-1", message: "Find billing policy" },
    tool,
  );
  const paused = await runTicket(
    { id: "T-2", message: "Update billing address" },
    tool,
  );
  const resumed =
    paused.status === "suspended"
      ? await executePlan(paused.checkpoint, tool, { approved: true })
      : paused;
  console.log(JSON.stringify({ read, paused, resumed }, null, 2));
}
