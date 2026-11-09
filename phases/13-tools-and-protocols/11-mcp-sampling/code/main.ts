// Lesson: MCP Model Input: Sampling Migration and Stateless MRTR (phase 13 / lesson 11)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/11-mcp-sampling/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/11-mcp-sampling/code/main.ts

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

type Json = any;
type Obj = Record<string, Json>;

const PROTOCOL_VERSION = "2026-07-28";
const PROTOCOL_META = "io.modelcontextprotocol/protocolVersion";
const CAPABILITIES_META = "io.modelcontextprotocol/clientCapabilities";
const CLIENT_INFO_META = "io.modelcontextprotocol/clientInfo";
const SERVER_INFO_META = "io.modelcontextprotocol/serverInfo";
const SERVER_SECRET = Buffer.from("lesson-11-demo-secret-change-in-production");

const FAKE_REPO: Record<string, string> = {
  "README.md": "A small notes server used to teach stateless MCP.",
  "server.py": "def dispatch(request): return handle(request)",
  "client.py": "def retry(request, inputs, state): ...",
  LICENSE: "MIT",
  "tests/test_server.py": "def test_stateless_retry(): ...",
  "docs/intro.md": "The server has no protocol session state.",
};
const TOOLS: Obj[] = [
  {
    name: "summarize_repo",
    description: "Select representative repository files and summarize them.",
    inputSchema: {
      type: "object",
      properties: {
        audience: {
          type: "string",
          description: "Audience for the final repository summary.",
        },
      },
      required: [],
    },
  },
];

class McpError extends Error {
  code: number;
  data: Obj | null;

  constructor(code: number, message: string, data: Obj | null = null) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

function isDict(value: Json): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function pyDumps(value: Json, sortKeys = false, compact = false): string {
  const itemSep = compact ? "," : ", ";
  const keySep = compact ? ":" : ": ";
  const encodeString = (text: string): string =>
    JSON.stringify(text).replace(/[^\x00-\x7f]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    return encodeString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((item) => pyDumps(item, sortKeys, compact)).join(itemSep) + "]";
  }
  const keys = Object.keys(value);
  if (sortKeys) {
    keys.sort(compareStrings);
  }
  return "{" + keys.map((key) => encodeString(key) + keySep + pyDumps(value[key], sortKeys, compact)).join(itemSep) + "}";
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function requestMeta(sampling = true): Obj {
  const capabilities: Obj = sampling ? { sampling: {} } : {};
  return {
    [PROTOCOL_META]: PROTOCOL_VERSION,
    [CAPABILITIES_META]: capabilities,
    [CLIENT_INFO_META]: { name: "lesson-client", version: "1.0.0" },
  };
}

function serverMeta(): Obj {
  return { [SERVER_INFO_META]: { name: "mrtr-demo", version: "1.0.0" } };
}

function complete(fields: Obj): Obj {
  return { resultType: "complete", ...fields, _meta: serverMeta() };
}

function validateRequestMeta(params: Obj): Obj {
  const meta = params._meta;
  if (!isDict(meta)) {
    throw new McpError(-32602, "missing request _meta");
  }
  const requestedVersion = meta[PROTOCOL_META];
  if (typeof requestedVersion !== "string") {
    throw new McpError(-32602, "missing protocol version");
  }
  if (requestedVersion !== PROTOCOL_VERSION) {
    throw new McpError(-32022, "unsupported protocol version", {
      supported: [PROTOCOL_VERSION],
      requested: requestedVersion,
    });
  }
  const capabilities = meta[CAPABILITIES_META];
  if (!isDict(capabilities)) {
    throw new McpError(-32602, "missing client capabilities");
  }
  return meta;
}

function serverDiscover(params: Obj): Obj {
  validateRequestMeta(params);
  return complete({
    supportedVersions: [PROTOCOL_VERSION],
    capabilities: { tools: {} },
    ttlMs: 300_000,
    cacheScope: "public",
  });
}

function toolsList(params: Obj): Obj {
  validateRequestMeta(params);
  return complete({
    tools: structuredClone(TOOLS).sort((a, b) => compareStrings(a.name, b.name)),
    ttlMs: 60_000,
    cacheScope: "public",
  });
}

function b64(data: Buffer): string {
  return data.toString("base64url");
}

function unb64(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1) {
    throw new TypeError("invalid base64");
  }
  return Buffer.from(value, "base64url");
}

function argumentsDigest(args: Obj): string {
  const encoded = pyDumps(args, true, true);
  return createHash("sha256").update(encoded).digest("hex");
}

function sealRequestState(payload: Obj): string {
  const body = Buffer.from(pyDumps(payload, true, true));
  const signature = createHmac("sha256", SERVER_SECRET).update(body).digest();
  return `${b64(body)}.${b64(signature)}`;
}

function verifyRequestState(token: string, principal: string, args: Obj, now: number | null = null): Obj {
  let body: Buffer;
  let supplied: Buffer;
  try {
    const dot = token.indexOf(".");
    if (dot < 0) {
      throw new TypeError("missing separator");
    }
    body = unb64(token.slice(0, dot));
    supplied = unb64(token.slice(dot + 1));
  } catch {
    throw new McpError(-32602, "invalid requestState encoding");
  }
  const expected = createHmac("sha256", SERVER_SECRET).update(body).digest();
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new McpError(-32602, "requestState integrity check failed");
  }
  let state: Obj;
  try {
    state = JSON.parse(body.toString("utf8"));
  } catch {
    throw new McpError(-32602, "invalid requestState payload");
  }
  if (state.principal !== principal) {
    throw new McpError(-32602, "requestState principal mismatch");
  }
  if (state.method !== "tools/call") {
    throw new McpError(-32602, "requestState method mismatch");
  }
  if (state.argumentsDigest !== argumentsDigest(args)) {
    throw new McpError(-32602, "requestState arguments mismatch");
  }
  if (Math.trunc(Number(state.expiresAt ?? 0)) < (now === null ? nowSeconds() : now)) {
    throw new McpError(-32602, "requestState expired");
  }
  return state;
}

function samplingRequest(prompt: string, intelligence: number): Obj {
  return {
    method: "sampling/createMessage",
    params: {
      messages: [{ role: "user", content: { type: "text", text: prompt } }],
      systemPrompt: "Return only the requested value.",
      modelPreferences: {
        costPriority: Math.round((1.0 - intelligence) * 100) / 100,
        intelligencePriority: intelligence,
      },
      maxTokens: 400,
    },
  };
}

function inputRequired(key: string, prompt: string, state: Obj, intelligence: number): Obj {
  return {
    resultType: "input_required",
    inputRequests: { [key]: samplingRequest(prompt, intelligence) },
    requestState: sealRequestState(state),
    _meta: serverMeta(),
  };
}

function samplingText(inputResponses: Json, key: string): string {
  if (!isDict(inputResponses)) {
    throw new McpError(-32602, "inputResponses must be an object");
  }
  const response = inputResponses[key];
  if (!isDict(response)) {
    throw new McpError(-32602, `missing input response: ${key}`);
  }
  const content = response.content;
  if (!isDict(content) || content.type !== "text") {
    throw new McpError(-32602, `invalid sampling response: ${key}`);
  }
  const text = content.text;
  if (typeof text !== "string" || !text.trim()) {
    throw new McpError(-32602, `empty sampling response: ${key}`);
  }
  return text;
}

function toolsCall(params: Obj, principal: string): Obj {
  const meta = validateRequestMeta(params);
  if (params.name !== "summarize_repo") {
    throw new McpError(-32602, "unknown tool");
  }
  const args = "arguments" in params ? params.arguments : {};
  if (!isDict(args)) {
    throw new McpError(-32602, "arguments must be an object");
  }
  const capabilities = meta[CAPABILITIES_META];
  if (!("sampling" in capabilities)) {
    throw new McpError(-32021, "missing required client capability", {
      requiredCapabilities: { sampling: {} },
    });
  }

  const stateToken = params.requestState;
  if (stateToken === undefined || stateToken === null) {
    const state = {
      phase: "pick",
      principal,
      method: "tools/call",
      argumentsDigest: argumentsDigest(args),
      expiresAt: nowSeconds() + 300,
    };
    const prompt =
      "Choose three representative files and return a JSON array. Files: " +
      pyDumps(Object.keys(FAKE_REPO).sort(compareStrings));
    return inputRequired("pick_files", prompt, state, 0.2);
  }

  if (typeof stateToken !== "string") {
    throw new McpError(-32602, "requestState must be a string");
  }
  const state = verifyRequestState(stateToken, principal, args);
  const responses = params.inputResponses;

  if (state.phase === "pick") {
    const rawPicks = samplingText(responses, "pick_files");
    let picks: Json;
    try {
      picks = JSON.parse(rawPicks);
    } catch {
      throw new McpError(-32602, "pick_files must return JSON");
    }
    if (!Array.isArray(picks) || !picks.every((item) => typeof item === "string")) {
      throw new McpError(-32602, "pick_files must return a string array");
    }
    const picked = (picks as string[]).filter((name) => name in FAKE_REPO).slice(0, 3);
    if (picked.length === 0) {
      throw new McpError(-32602, "pick_files returned no known files");
    }
    const combined = picked.map((name) => `${name}: ${FAKE_REPO[name]}`).join("\n\n");
    const nextState = {
      ...state,
      phase: "summarize",
      picked,
      expiresAt: nowSeconds() + 300,
    };
    const prompt = "Summarize these files in two sentences:\n\n" + combined;
    return inputRequired("summary", prompt, nextState, 0.8);
  }

  if (state.phase === "summarize") {
    const summary = samplingText(responses, "summary");
    return complete({
      content: [{ type: "text", text: summary }],
      structuredContent: { picked: state.picked, summary },
      isError: false,
    });
  }

  throw new McpError(-32602, "unknown requestState phase");
}

function dispatch(request: Obj, principal = "user-42"): Obj | null {
  const isNotification = !("id" in request);
  const requestId = request.id ?? null;
  try {
    const method = request.method;
    const params = "params" in request ? request.params : {};
    if (!isDict(params)) {
      throw new McpError(-32602, "params must be an object");
    }
    let result: Obj;
    if (method === "server/discover") {
      result = serverDiscover(params);
    } else if (method === "tools/list") {
      result = toolsList(params);
    } else if (method === "tools/call") {
      result = toolsCall(params, principal);
    } else {
      throw new McpError(-32601, "method not found");
    }
    if (isNotification) {
      return null;
    }
    return { jsonrpc: "2.0", id: requestId, result };
  } catch (exc) {
    if (!(exc instanceof McpError)) {
      throw exc;
    }
    if (isNotification) {
      return null;
    }
    const error: Obj = { code: exc.code, message: exc.message };
    if (exc.data !== null) {
      error.data = exc.data;
    }
    return { jsonrpc: "2.0", id: requestId, error };
  }
}

function fakeHostModel(inputRequest: Obj): Obj {
  const messages: Obj[] = inputRequest.params.messages;
  const prompt: string = messages[messages.length - 1].content.text;
  let text: string;
  if (prompt.includes("Choose three")) {
    text = pyDumps(["README.md", "server.py", "docs/intro.md"]);
  } else {
    text =
      "This repository demonstrates a stateless MCP server and client retry loop. " +
      "Each MRTR round carries all required state without a protocol session.";
  }
  return {
    role: "assistant",
    content: { type: "text", text },
    model: "host-model",
    stopReason: "endTurn",
  };
}

function runMrtr(): [Obj, number[]] {
  const baseParams: Obj = {
    name: "summarize_repo",
    arguments: { audience: "developer" },
    _meta: requestMeta(),
  };
  let requestId = 1;
  let response = dispatch({ jsonrpc: "2.0", id: requestId, method: "tools/call", params: baseParams }) as Obj;
  const seenIds = [requestId];

  while ((response.result ?? {}).resultType === "input_required") {
    const pending = response.result;
    const fulfilled: Obj = {};
    for (const [key, inputRequest] of Object.entries(pending.inputRequests as Obj)) {
      fulfilled[key] = fakeHostModel(inputRequest);
    }
    requestId += 1;
    seenIds.push(requestId);
    const retryParams = {
      ...baseParams,
      inputResponses: fulfilled,
      requestState: pending.requestState,
    };
    response = dispatch({
      jsonrpc: "2.0",
      id: requestId,
      method: "tools/call",
      params: retryParams,
    }) as Obj;
  }
  return [response, seenIds];
}

function main(): void {
  const discovery = dispatch({
    jsonrpc: "2.0",
    id: 0,
    method: "server/discover",
    params: { _meta: requestMeta() },
  }) as Obj;
  console.log("discover:", JSON.stringify(discovery.result, null, 2));
  const [response, requestIds] = runMrtr();
  console.log("independent request ids:", "[" + requestIds.join(", ") + "]");
  console.log("final:", JSON.stringify(response.result, null, 2));
}

main();
