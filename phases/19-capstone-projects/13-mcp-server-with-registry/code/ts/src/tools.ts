import type { ContentBlock, Incident, ToolArgs, ToolDescriptor, ToolExecutor } from "./types.js";

export function makeIncidents(): Record<string, Incident> {
  return {
    "INC-101": { id: "INC-101", severity: "p0", title: "checkout 500s", acked: false },
    "INC-102": { id: "INC-102", severity: "p2", title: "slow dashboard", acked: true },
    "INC-103": { id: "INC-103", severity: "p1", title: "rate-limit storm", acked: false },
  };
}

export const TOOL_DESCRIPTORS: ToolDescriptor[] = [
  {
    name: "incidents_list",
    description:
      "Use when listing recent incidents or filtering by severity. Do not use to look up a single id.",
    inputSchema: {
      type: "object",
      properties: { severity: { type: "string", enum: ["p0", "p1", "p2"] } },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "incidents_get",
    description: "Use to fetch one incident by id. Do not use for listing.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "incidents_ack",
    description: "Use to acknowledge an incident. Write op; only authorized callers.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    annotations: { destructiveHint: true, readOnlyHint: false },
  },
];

export function makeExecutors(store: Record<string, Incident>): Record<string, ToolExecutor> {
  const execList = (args: ToolArgs): ContentBlock[] => {
    const sev = typeof args.severity === "string" ? args.severity : undefined;
    const items = Object.values(store).filter((i) => !sev || i.severity === sev);
    return [{ type: "text", text: JSON.stringify(items) }];
  };

  const execGet = (args: ToolArgs): ContentBlock[] => {
    const id = String(args.id ?? "");
    const inc = store[id];
    if (!inc) throw new Error(`not found: ${id}`);
    return [{ type: "text", text: JSON.stringify(inc) }];
  };

  const execAck = (args: ToolArgs): ContentBlock[] => {
    const id = String(args.id ?? "");
    const inc = store[id];
    if (!inc) throw new Error(`not found: ${id}`);
    inc.acked = true;
    return [{ type: "text", text: JSON.stringify({ id, acked: true }) }];
  };

  return {
    incidents_list: execList,
    incidents_get: execGet,
    incidents_ack: execAck,
  };
}
