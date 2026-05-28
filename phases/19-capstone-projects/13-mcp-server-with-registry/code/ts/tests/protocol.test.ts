import { test } from "node:test";
import { strict as assert } from "node:assert";
import { dispatch, makeState, parseRpc, PROTOCOL_VERSION } from "../src/protocol.js";
import { TOOL_DESCRIPTORS, makeExecutors, makeIncidents } from "../src/tools.js";
import { processLine, replayFixture } from "../src/transport.js";
import type { JsonRpcRequest } from "../src/types.js";

function freshState() {
  return makeState(TOOL_DESCRIPTORS, makeExecutors(makeIncidents()));
}

test("initialize は protocol version と server info を返す", () => {
  const state = freshState();
  const resp = dispatch(state, { jsonrpc: "2.0", id: 1, method: "initialize" });
  assert.ok(resp);
  assert.equal(resp.id, 1);
  const result = resp.result as { protocolVersion: string; serverInfo: { name: string } };
  assert.equal(result.protocolVersion, PROTOCOL_VERSION);
  assert.equal(result.serverInfo.name, "lesson-13-internal-mcp");
});

test("tools/list の shape は各 tool の name と inputSchema を含む", () => {
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

test("tools/call は incidents_get に dispatch する", () => {
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

test("unknown tool の tools/call は isError=true を返す", () => {
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

test("incidents_ack は acked state を flip する", () => {
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

test("shutdown は flag を set する", () => {
  const state = freshState();
  dispatch(state, { jsonrpc: "2.0", id: 7, method: "shutdown" });
  assert.equal(state.shutdownRequested, true);
});

test("notification (id なし) は null を返す", () => {
  const state = freshState();
  const resp = dispatch(state, { jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(resp, null);
});

test("unknown method は -32601 を返す", () => {
  const state = freshState();
  const resp = dispatch(state, { jsonrpc: "2.0", id: 8, method: "no/such" });
  assert.ok(resp);
  assert.equal(resp.error?.code, -32601);
});

test("parseRpc は malformed JSON を reject する", () => {
  const r = parseRpc("not json");
  assert.equal(r.ok, false);
});

test("processLine は parse failure で -32700 envelope を emit する", () => {
  const state = freshState();
  const lines: string[] = [];
  processLine(state, "not json", (line) => lines.push(line));
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]!) as { error?: { code: number } };
  assert.equal(parsed.error?.code, -32700);
});

test("replayFixture roundtrip は fixture sequence 全体を駆動する", () => {
  const state = freshState();
  const msgs: JsonRpcRequest[] = [
    { jsonrpc: "2.0", id: 1, method: "initialize" },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    { jsonrpc: "2.0", method: "notifications/initialized" },
  ];
  const replies = replayFixture(state, msgs);
  assert.equal(replies.length, 2);
});
