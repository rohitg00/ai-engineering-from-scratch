import { test } from "node:test";
import { strict as assert } from "node:assert";
import { dispatch, makeState, parseRpc, PROTOCOL_VERSION } from "../src/protocol.js";
import { TOOL_DESCRIPTORS, makeExecutors, makeIncidents } from "../src/tools.js";
import { processLine, replayFixture } from "../src/transport.js";
import type { JsonRpcRequest } from "../src/types.js";

function freshState() {
  return makeState(TOOL_DESCRIPTORS, makeExecutors(makeIncidents()));
}

test("initialize returns protocol version and server info", () => {
  const state = freshState();
  const resp = dispatch(state, { jsonrpc: "2.0", id: 1, method: "initialize" });
  assert.ok(resp);
  assert.equal(resp.id, 1);
  const result = resp.result as { protocolVersion: string; serverInfo: { name: string } };
  assert.equal(result.protocolVersion, PROTOCOL_VERSION);
  assert.equal(result.serverInfo.name, "lesson-13-internal-mcp");
});

test("tools/list shape includes name + inputSchema for each tool", () => {
  const state = freshState();
  const resp = dispatch(state, { jsonrpc: "2.0", id: 2, method: "tools/list" });
  assert.ok(resp);
  const result = resp.result as { tools: Array<{ name: string; inputSchema: unknown }> };
  assert.equal(result.tools.length, 3);
  for (const t of result.tools) {
    assert.equal(typeof t.name, "string");
    assert.ok(t.inputSchema);
  }
});

test("tools/call dispatches to incidents_get", () => {
  const state = freshState();
  const resp = dispatch(state, {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "incidents_get", arguments: { id: "INC-101" } },
  });
  assert.ok(resp);
  const result = resp.result as { isError: boolean; content: Array<{ text: string }> };
  assert.equal(result.isError, false);
  const text = result.content[0]?.text ?? "";
  assert.ok(text.includes("INC-101"));
});

test("tools/call unknown tool returns isError=true", () => {
  const state = freshState();
  const resp = dispatch(state, {
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "nope", arguments: {} },
  });
  assert.ok(resp);
  const result = resp.result as { isError: boolean };
  assert.equal(result.isError, true);
});

test("incidents_ack flips acked state", () => {
  const state = freshState();
  dispatch(state, {
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "incidents_ack", arguments: { id: "INC-103" } },
  });
  const resp = dispatch(state, {
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: { name: "incidents_get", arguments: { id: "INC-103" } },
  });
  assert.ok(resp);
  const text = (resp.result as { content: Array<{ text: string }> }).content[0]?.text ?? "";
  assert.ok(text.includes('"acked":true'));
});

test("shutdown sets flag", () => {
  const state = freshState();
  dispatch(state, { jsonrpc: "2.0", id: 7, method: "shutdown" });
  assert.equal(state.shutdownRequested, true);
});

test("notification (no id) returns null", () => {
  const state = freshState();
  const resp = dispatch(state, { jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(resp, null);
});

test("unknown method returns -32601", () => {
  const state = freshState();
  const resp = dispatch(state, { jsonrpc: "2.0", id: 8, method: "no/such" });
  assert.ok(resp);
  assert.equal(resp.error?.code, -32601);
});

test("parseRpc rejects malformed JSON", () => {
  const r = parseRpc("not json");
  assert.equal(r.ok, false);
});

test("processLine emits -32700 envelope on parse failure", () => {
  const state = freshState();
  const lines: string[] = [];
  processLine(state, "not json", (line) => lines.push(line));
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]!) as { error?: { code: number } };
  assert.equal(parsed.error?.code, -32700);
});

test("replayFixture roundtrip drives full fixture sequence", () => {
  const state = freshState();
  const msgs: JsonRpcRequest[] = [
    { jsonrpc: "2.0", id: 1, method: "initialize" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    { jsonrpc: "2.0", method: "notifications/initialized" },
  ];
  const replies = replayFixture(state, msgs);
  assert.equal(replies.length, 2);
});
