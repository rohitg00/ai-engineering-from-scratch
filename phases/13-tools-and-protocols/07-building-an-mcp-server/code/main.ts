// Phase 13 Lesson 07: a stateless MCP server over stdio.
// Lesson: phases/13-tools-and-protocols/07-building-an-mcp-server/docs/en.md
// Specification: https://modelcontextprotocol.io/specification/2026-07-28/
// Implements discovery, three server primitives, and per-request validation.
// Run: npx tsx main.ts --demo

import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";

const PROTOCOL_VERSION = "2026-07-28";
const SUPPORTED_VERSIONS = [PROTOCOL_VERSION];
const VERSION_KEY = "io.modelcontextprotocol/protocolVersion";
const CAPABILITIES_KEY = "io.modelcontextprotocol/clientCapabilities";
const CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo";
const SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo";

const CLIENT_INFO = { name: "lesson-07-client", version: "1.0.0" };
const SERVER_INFO = { name: "notes-lesson-07", version: "2.0.0" };
const SERVER_CAPABILITIES = {
  tools: { listChanged: false },
  resources: { listChanged: false, subscribe: false },
  prompts: { listChanged: false },
};

type JsonObject = Record<string, any>;
type Note = { title: string; body: string; tag: string };
type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: number | string;
  method: string;
  params?: JsonObject;
};
type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: JsonObject;
  error?: { code: number; message: string; data?: unknown };
};

const NOTES: Record<string, Note> = {
  "note-1": { title: "MCP overview", body: "Stateless requests and JSON-RPC.", tag: "mcp" },
  "note-2": { title: "Function calling", body: "Provider envelopes differ.", tag: "api" },
  "note-3": { title: "Tool schemas", body: "Atomic tools are easier to route.", tag: "design" },
};

const TOOLS: JsonObject[] = [
  {
    name: "notes_search",
    description: "Search note titles and bodies by keyword.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  {
    name: "notes_create",
    description: "Create a new note.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        tag: { type: "string" },
      },
      required: ["title", "body"],
    },
    annotations: { destructiveHint: false, idempotentHint: false },
  },
  {
    name: "notes_list",
    description: "List notes, optionally filtered by tag.",
    inputSchema: {
      type: "object",
      properties: { tag: { type: "string" } },
      required: [],
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
];

const PROMPTS: JsonObject[] = [
  {
    name: "review_note",
    description: "Critique a note and propose concrete improvements.",
    arguments: [{ name: "note_id", description: "Note identifier", required: true }],
  },
];

class RpcProblem extends Error {
  readonly code: number;
  readonly data?: unknown;

  constructor(
    code: number,
    message: string,
    data?: unknown,
  ) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

function isValidRequestId(value: unknown): value is number | string {
  return typeof value === "string" || (typeof value === "number" && Number.isSafeInteger(value));
}

function requestMeta(version = PROTOCOL_VERSION, capabilities: JsonObject = {}): JsonObject {
  return {
    [VERSION_KEY]: version,
    [CAPABILITIES_KEY]: capabilities,
    [CLIENT_INFO_KEY]: { ...CLIENT_INFO },
  };
}

function makeRequest(
  id: number | string,
  method: string,
  params: JsonObject = {},
  version = PROTOCOL_VERSION,
): JsonRpcRequest {
  return {
    jsonrpc: "2.0",
    id,
    method,
    params: { ...params, _meta: requestMeta(version) },
  };
}

function rpcError(
  id: number | string | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse {
  const error: { code: number; message: string; data?: unknown } = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: "2.0", id, error };
}

function complete(
  payload: JsonObject,
  cache?: { ttlMs: number; cacheScope: "private" | "public" },
): JsonObject {
  return {
    resultType: "complete",
    ...payload,
    ...(cache ?? {}),
    _meta: { [SERVER_INFO_KEY]: { ...SERVER_INFO } },
  };
}

function validateRequest(message: JsonRpcRequest): void {
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    throw new RpcProblem(-32600, "Invalid Request");
  }
  const requestId: unknown = message.id;
  if (requestId !== undefined && !isValidRequestId(requestId)) {
    throw new RpcProblem(-32600, "id must be a string or integer");
  }
  const params = message.params;
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    throw new RpcProblem(-32602, "params must be an object");
  }
  const meta = params._meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    throw new RpcProblem(-32602, "params._meta is required");
  }
  const requested = meta[VERSION_KEY];
  if (typeof requested !== "string") {
    throw new RpcProblem(-32602, `${VERSION_KEY} is required`);
  }
  if (!SUPPORTED_VERSIONS.includes(requested)) {
    throw new RpcProblem(-32022, "Unsupported protocol version", {
      requested,
      supported: [...SUPPORTED_VERSIONS],
    });
  }
  const capabilities = meta[CAPABILITIES_KEY];
  if (!capabilities || typeof capabilities !== "object" || Array.isArray(capabilities)) {
    throw new RpcProblem(-32602, `${CAPABILITIES_KEY} is required`);
  }
  const clientInfo = meta[CLIENT_INFO_KEY];
  if (
    clientInfo !== undefined &&
    (!clientInfo ||
      typeof clientInfo !== "object" ||
      typeof clientInfo.name !== "string" ||
      typeof clientInfo.version !== "string")
  ) {
    throw new RpcProblem(-32602, `${CLIENT_INFO_KEY} is malformed`);
  }
}

function executeList(arguments_: JsonObject): JsonObject[] {
  const tag = arguments_.tag;
  const items = Object.entries(NOTES)
    .sort(([left], [right]) => left.localeCompare(right))
    .filter(([, note]) => !tag || note.tag === tag)
    .map(([id, note]) => ({ id, title: note.title, tag: note.tag }));
  return [{ type: "text", text: JSON.stringify(items) }];
}

function executeSearch(arguments_: JsonObject): JsonObject[] {
  if (typeof arguments_.query !== "string" || !arguments_.query) {
    throw new Error("query must be a non-empty string");
  }
  const limit = arguments_.limit ?? 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new Error("limit must be an integer from 1 through 50");
  }
  const query = arguments_.query.toLowerCase();
  const hits = Object.entries(NOTES)
    .sort(([left], [right]) => left.localeCompare(right))
    .filter(([, note]) => note.title.toLowerCase().includes(query) || note.body.toLowerCase().includes(query))
    .map(([id, note]) => ({ id, title: note.title }))
    .slice(0, limit);
  return [{ type: "text", text: JSON.stringify(hits) }];
}

function executeCreate(arguments_: JsonObject): JsonObject[] {
  if (typeof arguments_.title !== "string" || typeof arguments_.body !== "string") {
    throw new Error("title and body must be strings");
  }
  const id = `note-${randomUUID().replaceAll("-", "").slice(0, 6)}`;
  NOTES[id] = {
    title: arguments_.title,
    body: arguments_.body,
    tag: typeof arguments_.tag === "string" ? arguments_.tag : "",
  };
  return [
    { type: "text", text: `Created ${id}` },
    { type: "resource", resource: { uri: `notes://${id}`, text: arguments_.body } },
  ];
}

const TOOL_EXECUTORS: Record<string, (arguments_: JsonObject) => JsonObject[]> = {
  notes_create: executeCreate,
  notes_list: executeList,
  notes_search: executeSearch,
};

function handleDiscover(): JsonObject {
  return complete(
    {
      supportedVersions: [...SUPPORTED_VERSIONS],
      capabilities: structuredClone(SERVER_CAPABILITIES),
      instructions: "Use tools for note actions, resources for note bodies, and prompts for reviews.",
    },
    { ttlMs: 3_600_000, cacheScope: "public" },
  );
}

function handleToolsList(): JsonObject {
  return complete(
    { tools: [...TOOLS].sort((left, right) => left.name.localeCompare(right.name)) },
    { ttlMs: 60_000, cacheScope: "public" },
  );
}

function handleToolsCall(params: JsonObject): JsonObject {
  if (typeof params.name !== "string" || !params.arguments || typeof params.arguments !== "object") {
    throw new RpcProblem(-32602, "tools/call requires string name and object arguments");
  }
  const executor = TOOL_EXECUTORS[params.name];
  if (!executor) {
    return complete({
      content: [{ type: "text", text: `Unknown tool: ${params.name}` }],
      isError: true,
    });
  }
  try {
    return complete({ content: executor(params.arguments), isError: false });
  } catch (error) {
    return complete({ content: [{ type: "text", text: String(error) }], isError: true });
  }
}

function handleResourcesList(): JsonObject {
  const resources = Object.entries(NOTES)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, note]) => ({
      uri: `notes://${id}`,
      name: note.title,
      mimeType: "text/markdown",
    }));
  return complete({ resources }, { ttlMs: 10_000, cacheScope: "private" });
}

function handleResourcesRead(params: JsonObject): JsonObject {
  if (typeof params.uri !== "string" || !params.uri.startsWith("notes://")) {
    throw new RpcProblem(-32602, "resources/read requires a notes:// URI");
  }
  const id = params.uri.slice("notes://".length);
  const note = NOTES[id];
  if (!note) throw new RpcProblem(-32602, "Resource not found", { uri: params.uri });
  return complete(
    {
      contents: [
        {
          uri: params.uri,
          mimeType: "text/markdown",
          text: `# ${note.title}\n\n${note.body}\n\ntag: ${note.tag}`,
        },
      ],
    },
    { ttlMs: 5_000, cacheScope: "private" },
  );
}

function handlePromptsList(): JsonObject {
  return complete(
    { prompts: [...PROMPTS].sort((left, right) => left.name.localeCompare(right.name)) },
    { ttlMs: 60_000, cacheScope: "public" },
  );
}

function handlePromptsGet(params: JsonObject): JsonObject {
  if (params.name !== "review_note") throw new RpcProblem(-32602, "Unknown prompt");
  const arguments_ = params.arguments;
  if (!arguments_ || typeof arguments_ !== "object" || typeof arguments_.note_id !== "string") {
    throw new RpcProblem(-32602, "note_id must name an existing note");
  }
  const note = NOTES[arguments_.note_id];
  if (!note) throw new RpcProblem(-32602, "note_id must name an existing note");
  return complete({
    description: "Review the note and propose concrete improvements.",
    messages: [
      {
        role: "user",
        content: { type: "text", text: `Review this note and propose improvements:\n\n${note.body}` },
      },
    ],
  });
}

const HANDLERS: Record<string, (params: JsonObject) => JsonObject> = {
  "prompts/get": handlePromptsGet,
  "prompts/list": handlePromptsList,
  "resources/list": handleResourcesList,
  "resources/read": handleResourcesRead,
  "server/discover": handleDiscover,
  "tools/call": handleToolsCall,
  "tools/list": handleToolsList,
};

function dispatch(message: JsonRpcRequest): JsonRpcResponse | null {
  if (message.id === undefined) return null;
  const id = message.id;
  const errorId = isValidRequestId(id) ? id : null;
  try {
    validateRequest(message);
    const handler = HANDLERS[message.method];
    if (!handler) throw new RpcProblem(-32601, `Method not found: ${message.method}`);
    return { jsonrpc: "2.0", id, result: handler(message.params ?? {}) };
  } catch (error) {
    if (error instanceof RpcProblem) return rpcError(errorId, error.code, error.message, error.data);
    return rpcError(errorId, -32603, "Internal error", { detail: String(error) });
  }
}

function serveStdio(): void {
  const reader = createInterface({ input: process.stdin, terminal: false });
  reader.on("line", (line) => {
    if (!line.trim()) return;
    let response: JsonRpcResponse | null;
    try {
      const parsed = JSON.parse(line) as unknown;
      response =
        parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
          ? dispatch(parsed as JsonRpcRequest)
          : rpcError(null, -32600, "Invalid Request");
    } catch (error) {
      response = rpcError(null, -32700, "Parse error", { detail: String(error) });
    }
    if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
  });
}

function demo(): void {
  const scenarios: JsonRpcRequest[] = [
    makeRequest(1, "server/discover"),
    makeRequest(2, "tools/list"),
    makeRequest(3, "resources/list"),
    makeRequest(4, "prompts/list"),
    makeRequest(5, "tools/call", { name: "notes_search", arguments: { query: "MCP" } }),
    makeRequest(6, "resources/read", { uri: "notes://note-1" }),
    makeRequest(7, "prompts/get", { name: "review_note", arguments: { note_id: "note-1" } }),
    makeRequest(8, "tools/list", {}, "2027-01-01"),
  ];
  console.log("MCP 2026-07-28 stateless notes server, TypeScript");
  for (const message of scenarios) {
    console.log(`\n${message.method} id=${message.id}`);
    console.log(JSON.stringify(dispatch(message), null, 2).slice(0, 700));
  }
}

if (process.argv.includes("--demo")) demo();
else serveStdio();
