import type { createWorkflow } from "@mastra/core/workflows";

type Tool = (name: "lookup" | "update", query: string) => Promise<string>;

export function createTicketWorkflow(
  tool: Tool,
  approved = false,
): ReturnType<typeof createWorkflow> {
  throw new Error("Not implemented: createTicketWorkflow");
}

export function planHash(plan: unknown): string {
  throw new Error("Implement plan approval identity");
}
export async function persistentWorkflow(
  tool: Tool,
  url: string,
): Promise<any> {
  throw new Error("Implement the persistent local Mastra adapter");
}
