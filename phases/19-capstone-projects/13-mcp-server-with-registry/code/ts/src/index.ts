// Internal MCP server: hand-rolled stdio JSON-RPC の TypeScript skeleton。
// Python 側は registry と policy gate を提供し、この project は 3 つの
// mock incident tool を持つ MCP transport を提供する。
// Refs: docs/en.md (この lesson),
//   MCP 2025-11-25 spec: https://modelcontextprotocol.io/specification/2025-11-25
//   JSON-RPC 2.0: https://www.jsonrpc.org/specification
//   MCP registry 2026: https://github.com/modelcontextprotocol/registry

import type { JsonRpcRequest } from "./types.js";
import { makeState, PROTOCOL_VERSION } from "./protocol.js";
import { replayFixture, serveStdio } from "./transport.js";
import { TOOL_DESCRIPTORS, makeExecutors, makeIncidents } from "./tools.js";

function demoFixture(): JsonRpcRequest[] {
  return [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: PROTOCOL_VERSION } },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "incidents_list", arguments: { severity: "p0" } },
    },
    {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "incidents_get", arguments: { id: "INC-101" } },
    },
    {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "incidents_ack", arguments: { id: "INC-101" } },
    },
    {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "incidents_get", arguments: { id: "INC-101" } },
    },
    {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "no_such_tool", arguments: {} },
    },
    { jsonrpc: "2.0", id: 8, method: "shutdown" },
    { jsonrpc: "2.0", method: "notifications/initialized" },
  ];
}

function runDemo(): void {
  const state = makeState(TOOL_DESCRIPTORS, makeExecutors(makeIncidents()));

  process.stdout.write("=".repeat(72) + "\n");
  process.stdout.write("PHASE 19 LESSON 13 - internal MCP server (TypeScript, no SDK)\n");
  process.stdout.write("=".repeat(72) + "\n");

  const messages = demoFixture();
  const replies = replayFixture(state, messages);
  const responders = messages.filter((m) => m.id !== undefined);
  for (let i = 0; i < responders.length; i += 1) {
    const req = responders[i];
    const rep = replies[i];
    if (!req || !rep) continue;
    process.stdout.write("\n>>> " + JSON.stringify(req) + "\n");
    process.stdout.write("<<< " + JSON.stringify(rep) + "\n");
  }
  process.stdout.write("\nnotification (response なし) notifications/initialized を処理しました\n");
}

function main(): void {
  if (process.argv.includes("--serve")) {
    const state = makeState(TOOL_DESCRIPTORS, makeExecutors(makeIncidents()));
    serveStdio(state);
    return;
  }
  runDemo();
}

main();
