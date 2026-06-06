import { createInterface } from "node:readline";
import type { JsonRpcRequest, JsonRpcResponse } from "./types.js";
import { dispatch, parseRpc, type ProtocolState } from "./protocol.js";

export type LineSink = (line: string) => void;

export function processLine(state: ProtocolState, line: string, sink: LineSink): void {
  const trimmed = line.trim();
  if (!trimmed) return;
  const parsed = parseRpc(trimmed);
  if (!parsed.ok) {
    const message = parsed.code === -32600 ? "Invalid Request" : "Parse error";
    const err: JsonRpcResponse = {
      jsonrpc: "2.0",
      id: null,
      error: { code: parsed.code, message, data: parsed.err },
    };
    sink(JSON.stringify(err));
    return;
  }
  const resp = dispatch(state, parsed.msg);
  if (resp) sink(JSON.stringify(resp));
}

export function replayFixture(
  state: ProtocolState,
  messages: JsonRpcRequest[],
): JsonRpcResponse[] {
  const out: JsonRpcResponse[] = [];
  for (const msg of messages) {
    const reply = dispatch(state, msg);
    if (reply) out.push(reply);
  }
  return out;
}

export function serveStdio(state: ProtocolState): void {
  const rl = createInterface({ input: process.stdin, terminal: false });
  const sink: LineSink = (line) => process.stdout.write(line + "\n");
  rl.on("line", (line) => {
    processLine(state, line, sink);
    if (state.shutdownRequested) rl.close();
  });
  rl.on("close", () => process.exit(0));
}
