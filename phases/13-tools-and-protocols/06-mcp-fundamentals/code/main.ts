// Lesson: MCP Fundamentals: Stateless Requests and JSON-RPC (phase 13 / lesson 06)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/06-mcp-fundamentals/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/06-mcp-fundamentals/code/main.ts

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

function pyJsonString(s: string): string {
  return JSON.stringify(s).replace(/[\u0080-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

function pyJson(value: Json, indent?: number, sortKeys = false, level = 0): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return pyJsonString(value);
  const itemSep = indent === undefined ? ", " : ",";
  const pad = indent === undefined ? "" : "\n" + " ".repeat(indent * (level + 1));
  const end = indent === undefined ? "" : "\n" + " ".repeat(indent * level);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return "[" + value.map((v) => pad + pyJson(v, indent, sortKeys, level + 1)).join(itemSep) + end + "]";
  }
  let keys = Object.keys(value);
  if (keys.length === 0) return "{}";
  if (sortKeys) keys = [...keys].sort();
  return "{" + keys.map((k) => pad + pyJsonString(k) + ": " + pyJson(value[k], indent, sortKeys, level + 1)).join(itemSep) + end + "}";
}

function pyStrRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const c of s) {
    if (c === "\\") out += "\\\\";
    else if (c === quote) out += "\\" + c;
    else if (c === "\n") out += "\\n";
    else if (c === "\r") out += "\\r";
    else if (c === "\t") out += "\\t";
    else out += c;
  }
  return quote + out + quote;
}

function isObject(value: Json | undefined): value is JsonObject {
  return value !== null && value !== undefined && typeof value === "object" && !Array.isArray(value);
}

function byName(a: JsonObject, b: JsonObject): number {
  const x = a["name"] as string;
  const y = b["name"] as string;
  if (x === y) return 0;
  return x < y ? -1 : 1;
}

const PROTOCOL_VERSION = "2026-07-28";
const SUPPORTED_VERSIONS = [PROTOCOL_VERSION];
const VERSION_KEY = "io.modelcontextprotocol/protocolVersion";
const CAPABILITIES_KEY = "io.modelcontextprotocol/clientCapabilities";
const CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo";
const SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo";

const CLIENT_INFO: JsonObject = { name: "lesson-06-client", version: "1.0.0" };
const SERVER_INFO: JsonObject = { name: "lesson-06-notes", version: "1.0.0" };
const SERVER_CAPABILITIES: JsonObject = { tools: { listChanged: false } };

const TOOLS: JsonObject[] = [
  {
    name: "notes_search",
    description: "Search notes by keyword.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "notes_list",
    description: "List note titles.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

class Trace {
  constructor(
    readonly kind: string,
    readonly method: string,
    readonly era: string,
    readonly detail: string,
  ) {}
}

function request_meta(
  version: string = PROTOCOL_VERSION,
  capabilities: JsonObject | null = null,
  include_client_info: boolean = true,
): JsonObject {
  const meta: JsonObject = {
    [VERSION_KEY]: version,
    [CAPABILITIES_KEY]: capabilities === null ? {} : capabilities,
  };
  if (include_client_info) meta[CLIENT_INFO_KEY] = { ...CLIENT_INFO };
  return meta;
}

function make_request(
  request_id: number | string,
  method: string,
  params: JsonObject | null = null,
  options: { version?: string; capabilities?: JsonObject | null } = {},
): JsonObject {
  const body_params: JsonObject = { ...(params ?? {}) };
  body_params["_meta"] = request_meta(options.version ?? PROTOCOL_VERSION, options.capabilities ?? null);
  return {
    jsonrpc: "2.0",
    id: request_id,
    method,
    params: body_params,
  };
}

function rpc_error(request_id: Json, code: number, message: string, data: Json = null): JsonObject {
  const error: JsonObject = { code, message };
  if (data !== null) error["data"] = data;
  return { jsonrpc: "2.0", id: request_id, error };
}

function complete_result(
  payload: JsonObject,
  options: { ttl_ms?: number | null; cache_scope?: string | null } = {},
): JsonObject {
  const result: JsonObject = {
    resultType: "complete",
    ...payload,
    _meta: { [SERVER_INFO_KEY]: { ...SERVER_INFO } },
  };
  const ttl_ms = options.ttl_ms ?? null;
  if (ttl_ms !== null) {
    result["ttlMs"] = ttl_ms;
    result["cacheScope"] = options.cache_scope || "private";
  }
  return result;
}

function validate_request(message: JsonObject): JsonObject | null {
  const request_id = message["id"] ?? null;
  if (message["jsonrpc"] !== "2.0" || typeof message["method"] !== "string") {
    return rpc_error(request_id, -32600, "Invalid Request");
  }
  const params = message["params"];
  if (!isObject(params)) return rpc_error(request_id, -32602, "params must be an object");
  const meta = params["_meta"];
  if (!isObject(meta)) return rpc_error(request_id, -32602, "params._meta is required");
  const version = meta[VERSION_KEY];
  if (typeof version !== "string") return rpc_error(request_id, -32602, `${VERSION_KEY} is required`);
  if (!SUPPORTED_VERSIONS.includes(version)) {
    return rpc_error(request_id, -32022, "Unsupported protocol version", {
      requested: version,
      supported: [...SUPPORTED_VERSIONS],
    });
  }
  if (!isObject(meta[CAPABILITIES_KEY])) return rpc_error(request_id, -32602, `${CAPABILITIES_KEY} is required`);
  const client_info = meta[CLIENT_INFO_KEY];
  if (
    client_info !== undefined &&
    client_info !== null &&
    (!isObject(client_info) || typeof client_info["name"] !== "string" || typeof client_info["version"] !== "string")
  ) {
    return rpc_error(request_id, -32602, `${CLIENT_INFO_KEY} is malformed`);
  }
  return null;
}

function dispatch(message: JsonObject): JsonObject | null {
  if (!("id" in message)) return null;
  const invalid = validate_request(message);
  if (invalid !== null) return invalid;

  const request_id = message["id"];
  const method = message["method"] as string;
  const params = message["params"] as JsonObject;
  let result: JsonObject;
  if (method === "server/discover") {
    result = complete_result(
      {
        supportedVersions: [...SUPPORTED_VERSIONS],
        capabilities: { ...SERVER_CAPABILITIES },
        instructions: "Use notes_list for titles and notes_search for keywords.",
      },
      { ttl_ms: 3_600_000, cache_scope: "public" },
    );
  } else if (method === "tools/list") {
    result = complete_result({ tools: [...TOOLS].sort(byName) }, { ttl_ms: 30_000, cache_scope: "public" });
  } else if (method === "tools/call") {
    const name = params["name"];
    const args = (params["arguments"] ?? {}) as JsonObject;
    if (name === "notes_list") {
      const text = "JSON-RPC notes, MCP metadata notes";
      result = complete_result({ content: [{ type: "text", text }], isError: false });
    } else if (name === "notes_search" && typeof args["query"] === "string") {
      const text = `Found notes matching ${pyStrRepr(args["query"])}`;
      result = complete_result({ content: [{ type: "text", text }], isError: false });
    } else {
      result = complete_result({
        content: [{ type: "text", text: `Unknown or invalid tool: ${name === undefined || name === null ? "None" : String(name)}` }],
        isError: true,
      });
    }
  } else {
    return rpc_error(request_id, -32601, `Method not found: ${method}`);
  }
  return { jsonrpc: "2.0", id: request_id, result };
}

function trace_message(message: JsonObject): Trace {
  if ("method" in message && "id" in message) {
    const method = String(message["method"]);
    if (method === "initialize") return new Trace("request", method, "legacy", "connection-scoped handshake");
    const params = message["params"] ?? {};
    const meta = isObject(params) ? (params["_meta"] ?? {}) : {};
    if (isObject(meta) && VERSION_KEY in meta && CAPABILITIES_KEY in meta) {
      const detail = `version=${meta[VERSION_KEY]} capabilities=current-request`;
      return new Trace("request", method, "modern", detail);
    }
    return new Trace("request", method, "invalid", "missing modern request metadata");
  }
  if ("result" in message || "error" in message) {
    if ("error" in message) {
      return new Trace("response", "error", "unknown", `code=${(message["error"] as JsonObject)["code"]}`);
    }
    const result = message["result"] as JsonObject;
    const era = result["resultType"] ? "modern" : "legacy";
    return new Trace("response", "result", era, `resultType=${result["resultType"] ?? "absent"}`);
  }
  if ("method" in message) return new Trace("notification", String(message["method"]), "unknown", "no response expected");
  return new Trace("unknown", "", "invalid", "not a JSON-RPC message");
}

function show(message: JsonObject): void {
  const trace = trace_message(message);
  console.log(`[${trace.kind}/${trace.era}] ${trace.method}: ${trace.detail}`);
  console.log(pyJson(message, 2, true));
}

function main(): void {
  const requests = [
    make_request(1, "server/discover"),
    make_request(2, "tools/list"),
    make_request(3, "tools/call", { name: "notes_search", arguments: { query: "JSON-RPC" } }),
    make_request(4, "tools/list", null, { version: "2027-01-01" }),
  ];
  console.log("MCP 2026-07-28 stateless request trace");
  for (const current of requests) {
    console.log();
    show(current);
    const response = dispatch(current);
    if (response !== null) show(response);
  }
  console.log("\nTransport closes. No protocol session was created or terminated.");
}

main();

export {};
