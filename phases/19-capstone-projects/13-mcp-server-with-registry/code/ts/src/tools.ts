import type { ContentBlock, Incident, ToolArgs, ToolDescriptor, ToolExecutor } from "./types.js";

export function makeIncidents(): Record<string, Incident> {
  return {
    "INC-101": { id: "INC-101", severity: "p0", title: "checkout 500s", acked: false },
    "INC-102": { id: "INC-102", severity: "p2", title: "dashboard が遅い", acked: true },
    "INC-103": { id: "INC-103", severity: "p1", title: "rate-limit storm", acked: false },
  };
}

export const TOOL_DESCRIPTORS: ToolDescriptor[] = [
  {
    name: "incidents_list",
    description:
      "最近の incident を list する、または severity で filter するときに使う。単一 id の lookup には使わない。",
    inputSchema: {
      type: "object",
      properties: { severity: { type: "string", enum: ["p0", "p1", "p2"] } },
      required: [],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "incidents_get",
    description: "id で incident を 1 件 fetch するときに使う。Listing には使わない。",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "incidents_ack",
    description: "Incident を acknowledge するときに使う。Write op なので authorized caller のみ。",
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
