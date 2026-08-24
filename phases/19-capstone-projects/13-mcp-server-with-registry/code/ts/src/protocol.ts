import type {
  JsonSchema,
  JsonRpcRequest,
  JsonRpcRequestId,
  JsonRpcResponse,
  ToolArgs,
  ToolDescriptor,
  ToolExecutor,
} from "./types.js";

export const PROTOCOL_VERSION = "2026-07-28";
export const SUPPORTED_VERSIONS = [PROTOCOL_VERSION] as const;
export const PROTOCOL_VERSION_KEY = "io.modelcontextprotocol/protocolVersion";
export const CLIENT_CAPABILITIES_KEY = "io.modelcontextprotocol/clientCapabilities";
export const CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo";
export const SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo";
export const SERVER_NAME = "com.example/internal-incidents";
export const SERVER_INFO = { name: SERVER_NAME, version: "1.0.0" };
export const SERVER_CAPABILITIES = { tools: { listChanged: false } };

export type ServerContext = {
  descriptors: ToolDescriptor[];
  executors: Record<string, ToolExecutor>;
};

export function makeContext(
  descriptors: ToolDescriptor[],
  executors: Record<string, ToolExecutor>,
): ServerContext {
  return { descriptors, executors };
}

class RpcProblem extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateSchema(value: unknown, schema: JsonSchema, path: string): string[] {
  if (schema.type === "object") {
    if (!isRecord(value)) return [`${path} must be an object`];
    const issues: string[] = [];
    const properties = schema.properties ?? {};
    for (const required of schema.required ?? []) {
      if (!Object.hasOwn(value, required)) issues.push(`${path}.${required} is required`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(properties, key)) issues.push(`${path}.${key} is not allowed`);
      }
    }
    for (const [key, propertySchema] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) {
        issues.push(...validateSchema(value[key], propertySchema, `${path}.${key}`));
      }
    }
    return issues;
  }
  if (schema.type === "string" && typeof value !== "string") {
    return [`${path} must be a string`];
  }
  if (schema.enum && !schema.enum.includes(value as string)) {
    return [`${path} must be one of ${schema.enum.join(", ")}`];
  }
  return [];
}

export function requestMeta(
  version = PROTOCOL_VERSION,
  clientCapabilities: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    [PROTOCOL_VERSION_KEY]: version,
    [CLIENT_CAPABILITIES_KEY]: clientCapabilities,
    [CLIENT_INFO_KEY]: { name: "lesson-13-demo-client", version: "1.0.0" },
  };
}

export function makeRequest(
  id: JsonRpcRequestId,
  method: string,
  params: Record<string, unknown> = {},
  version = PROTOCOL_VERSION,
): JsonRpcRequest {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params: { ...params, _meta: requestMeta(version) },
  };
}

function complete(
  payload: Record<string, unknown>,
  cache?: { ttlMs: number; cacheScope: "public" | "private" },
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    resultType: "complete",
    ...payload,
    _meta: { [SERVER_INFO_KEY]: { ...SERVER_INFO } },
  };
  if (cache) {
    result.ttlMs = cache.ttlMs;
    result.cacheScope = cache.cacheScope;
  }
  return result;
}

function validateRequest(msg: JsonRpcRequest): Record<string, unknown> {
  if (!isRecord(msg.params)) {
    throw new RpcProblem(-32602, "params must be an object");
  }
  const meta = msg.params._meta;
  if (!isRecord(meta)) {
    throw new RpcProblem(-32602, "params._meta is required");
  }
  const requested = meta[PROTOCOL_VERSION_KEY];
  if (typeof requested !== "string") {
    throw new RpcProblem(-32602, `${PROTOCOL_VERSION_KEY} is required`);
  }
  if (!(SUPPORTED_VERSIONS as readonly string[]).includes(requested)) {
    throw new RpcProblem(-32022, "Unsupported protocol version", {
      supported: [...SUPPORTED_VERSIONS],
      requested,
    });
  }
  if (!isRecord(meta[CLIENT_CAPABILITIES_KEY])) {
    throw new RpcProblem(-32602, `${CLIENT_CAPABILITIES_KEY} is required`);
  }
  const clientInfo = meta[CLIENT_INFO_KEY];
  if (
    clientInfo !== undefined &&
    (!isRecord(clientInfo) ||
      typeof clientInfo.name !== "string" ||
      typeof clientInfo.version !== "string")
  ) {
    throw new RpcProblem(-32602, `${CLIENT_INFO_KEY} is malformed`);
  }
  return msg.params;
}

function handleDiscover(): Record<string, unknown> {
  return complete(
    {
      supportedVersions: [...SUPPORTED_VERSIONS],
      capabilities: SERVER_CAPABILITIES,
      instructions: "Use incident tools to list, inspect, and acknowledge incidents.",
    },
    { ttlMs: 3_600_000, cacheScope: "public" },
  );
}

function handleToolsList(context: ServerContext): Record<string, unknown> {
  const tools = [...context.descriptors].sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  );
  return complete({ tools }, { ttlMs: 300_000, cacheScope: "public" });
}

function handleToolsCall(
  context: ServerContext,
  params: Record<string, unknown>,
): Record<string, unknown> {
  const name = params.name;
  const rawArgs = params.arguments ?? {};
  if (typeof name !== "string" || !name) {
    throw new RpcProblem(-32602, "tools/call requires a non-empty string name");
  }
  const executor = context.executors[name];
  const descriptor = context.descriptors.find((candidate) => candidate.name === name);
  if (!executor || !descriptor) {
    throw new RpcProblem(-32602, `Unknown tool: ${name}`);
  }
  const schemaIssues = validateSchema(rawArgs, descriptor.inputSchema, "arguments");
  if (schemaIssues.length > 0) {
    return complete({
      content: [
        {
          type: "text",
          text: `Invalid arguments for ${name}: ${schemaIssues.join("; ")}`,
        },
      ],
      isError: true,
    });
  }
  try {
    return complete({ content: executor(rawArgs as ToolArgs), isError: false });
  } catch (err) {
    return complete({ content: [{ type: "text", text: String(err) }], isError: true });
  }
}

function rpcError(
  id: JsonRpcRequestId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

export function dispatch(context: ServerContext, msg: JsonRpcRequest): JsonRpcResponse | null {
  if (msg.id === undefined) return null;
  const id = msg.id;
  try {
    const params = validateRequest(msg);
    if (msg.method === "server/discover") {
      return { jsonrpc: "2.0", id, result: handleDiscover() };
    }
    if (msg.method === "tools/list") {
      return { jsonrpc: "2.0", id, result: handleToolsList(context) };
    }
    if (msg.method === "tools/call") {
      return { jsonrpc: "2.0", id, result: handleToolsCall(context, params) };
    }
    return rpcError(id, -32601, `Method not found: ${msg.method}`);
  } catch (err) {
    if (err instanceof RpcProblem) {
      return rpcError(id, err.code, err.message, err.data);
    }
    return rpcError(id, -32603, "Internal error", { detail: String(err) });
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
  if (!isRecord(raw) || raw.jsonrpc !== "2.0" || typeof raw.method !== "string") {
    return { ok: false, err: "invalid JSON-RPC envelope", code: -32600 };
  }
  if (
    "id" in raw &&
    typeof raw.id !== "string" &&
    typeof raw.id !== "number"
  ) {
    return { ok: false, err: "invalid JSON-RPC envelope", code: -32600 };
  }
  return { ok: true, msg: raw as JsonRpcRequest };
}
