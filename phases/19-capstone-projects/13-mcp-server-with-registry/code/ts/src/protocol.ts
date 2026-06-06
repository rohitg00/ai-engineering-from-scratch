import type {
  JsonRpcRequest,
  JsonRpcResponse,
  ToolArgs,
  ToolDescriptor,
  ToolExecutor,
} from "./types.js";

export const PROTOCOL_VERSION = "2025-11-25";
export const SERVER_INFO = { name: "lesson-13-internal-mcp", version: "1.0.0" };

export type ProtocolState = {
  descriptors: ToolDescriptor[];
  executors: Record<string, ToolExecutor>;
  shutdownRequested: boolean;
};

export function makeState(
  descriptors: ToolDescriptor[],
  executors: Record<string, ToolExecutor>,
): ProtocolState {
  return { descriptors, executors, shutdownRequested: false };
}

function handleInitialize(): unknown {
  return {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: { tools: { listChanged: false } },
    serverInfo: SERVER_INFO,
  };
}

function handleToolsList(state: ProtocolState): unknown {
  return { tools: state.descriptors };
}

function handleToolsCall(state: ProtocolState, params: Record<string, unknown>): unknown {
  const name = String(params.name ?? "");
  const args = (params.arguments as ToolArgs | undefined) ?? {};
  const fn = state.executors[name];
  if (!fn) {
    return { content: [{ type: "text", text: `unknown tool: ${name}` }], isError: true };
  }
  try {
    return { content: fn(args), isError: false };
  } catch (err) {
    return { content: [{ type: "text", text: String(err) }], isError: true };
  }
}

function handleShutdown(state: ProtocolState): unknown {
  state.shutdownRequested = true;
  return {};
}

export function dispatch(state: ProtocolState, msg: JsonRpcRequest): JsonRpcResponse | null {
  if (msg.id === undefined) {
    return null;
  }
  const id = msg.id;
  const params = msg.params ?? {};
  try {
    if (msg.method === "initialize") {
      return { jsonrpc: "2.0", id, result: handleInitialize() };
    }
    if (msg.method === "tools/list") {
      return { jsonrpc: "2.0", id, result: handleToolsList(state) };
    }
    if (msg.method === "tools/call") {
      return { jsonrpc: "2.0", id, result: handleToolsCall(state, params) };
    }
    if (msg.method === "shutdown") {
      return { jsonrpc: "2.0", id, result: handleShutdown(state) };
    }
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${msg.method}` },
    };
  } catch (err) {
    return { jsonrpc: "2.0", id, error: { code: -32603, message: String(err) } };
  }
}

export function parseRpc(
  line: string,
): { ok: true; msg: JsonRpcRequest } | { ok: false; err: string; code: number } {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch (err) {
    return { ok: false, err: String(err), code: -32700 };
  }
  const m = raw as JsonRpcRequest;
  if (!m || typeof m !== "object" || m.jsonrpc !== "2.0" || typeof m.method !== "string") {
    return { ok: false, err: "invalid JSON-RPC envelope", code: -32600 };
  }
  return { ok: true, msg: m };
}
