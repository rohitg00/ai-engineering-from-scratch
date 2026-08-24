import type { JsonRpcRequest } from "./types.js";
import { makeContext, makeRequest } from "./protocol.js";
import { replayFixture, serveStdio } from "./transport.js";
import { TOOL_DESCRIPTORS, makeExecutors, makeIncidents } from "./tools.js";

function demoFixture(): JsonRpcRequest[] {
  return [
    makeRequest(1, "server/discover"),
    makeRequest(2, "tools/list"),
    makeRequest(3, "tools/call", {
      name: "incidents_list",
      arguments: { severity: "p0" },
    }),
    makeRequest(4, "tools/call", {
      name: "incidents_get",
      arguments: { id: "INC-101" },
    }),
    makeRequest(5, "tools/call", {
      name: "incidents_ack",
      arguments: { id: "INC-101" },
    }),
    makeRequest(6, "tools/call", {
      name: "incidents_get",
      arguments: { id: "INC-101" },
    }),
    makeRequest(7, "tools/call", { name: "no_such_tool", arguments: {} }),
    makeRequest(8, "tools/list", {}, "2027-01-01"),
  ];
}

function runDemo(): void {
  const context = makeContext(TOOL_DESCRIPTORS, makeExecutors(makeIncidents()));

  process.stdout.write("=".repeat(72) + "\n");
  process.stdout.write("PHASE 19 LESSON 13 - stateless MCP server (TypeScript, no SDK)\n");
  process.stdout.write("=".repeat(72) + "\n");

  const messages = demoFixture();
  const replies = replayFixture(context, messages);
  for (let i = 0; i < messages.length; i += 1) {
    const req = messages[i];
    const rep = replies[i];
    if (!req || !rep) continue;
    process.stdout.write("\n>>> " + JSON.stringify(req) + "\n");
    process.stdout.write("<<< " + JSON.stringify(rep) + "\n");
  }
}

function main(): void {
  if (process.argv.includes("--serve")) {
    const context = makeContext(TOOL_DESCRIPTORS, makeExecutors(makeIncidents()));
    serveStdio(context);
    return;
  }
  runDemo();
}

main();
