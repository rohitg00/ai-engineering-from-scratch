// Lesson: MCP Tool Contracts and Content (phase 13 / lesson 28)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content/code/main.ts

import { Buffer } from "node:buffer";

type Dict = Record<string, any>;

const PROTOCOL_VERSION = "2026-07-28";
const PROTOCOL_META = "io.modelcontextprotocol/protocolVersion";
const CAPABILITIES_META = "io.modelcontextprotocol/clientCapabilities";
const CLIENT_INFO_META = "io.modelcontextprotocol/clientInfo";
const SERVER_INFO_META = "io.modelcontextprotocol/serverInfo";
const HEADER_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const BASE64_SENTINEL_PREFIX = "=?base64?";
const BASE64_SENTINEL_SUFFIX = "?=";
const JS_SAFE_INTEGER_MIN = -(2 ** 53) + 1;
const JS_SAFE_INTEGER_MAX = 2 ** 53 - 1;
const MAX_TOOL_LIST_PAGES = 100;
const SENSITIVE_NAMES = new Set(["api_key", "apikey", "authorization", "password", "secret", "token"]);

class ContractViolation extends Error {}

class McpError extends Error {
  code: number;
  data: Dict | null;
  constructor(code: number, message: string, data: Dict | null = null) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => deepEqual(item, b[index]));
  }
  if (isDict(a) && isDict(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => key in b && deepEqual(a[key], b[key]));
  }
  return false;
}

function pyStr(value: string): string {
  const quote = value.includes("'") && !value.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + quote;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (code < 0x20 || code === 0x7f) out += "\\x" + code.toString(16).padStart(2, "0");
    else out += ch;
  }
  return out + quote;
}

function pyRepr(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return pyStr(value);
  if (Array.isArray(value)) return "[" + value.map(pyRepr).join(", ") + "]";
  if (isDict(value)) {
    return "{" + Object.entries(value).map(([k, v]) => `${pyStr(k)}: ${pyRepr(v)}`).join(", ") + "}";
  }
  return String(value);
}

function jsonString(value: string): string {
  let out = '"';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    const code = value.charCodeAt(i);
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (code < 0x20 || code > 0x7e) out += "\\u" + code.toString(16).padStart(4, "0");
    else out += ch;
  }
  return out + '"';
}

function pyJsonDumps(value: unknown, sortKeys = false): string {
  if (value === null || value === undefined) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return jsonString(value);
  if (Array.isArray(value)) return "[" + value.map((item) => pyJsonDumps(item, sortKeys)).join(", ") + "]";
  const keys = Object.keys(value as Dict);
  if (sortKeys) keys.sort();
  return "{" + keys.map((k) => `${jsonString(k)}: ${pyJsonDumps((value as Dict)[k], sortKeys)}`).join(", ") + "}";
}

function requestMeta(): Dict {
  return {
    [PROTOCOL_META]: PROTOCOL_VERSION,
    [CAPABILITIES_META]: { completions: {} },
    [CLIENT_INFO_META]: { name: "contract-client", version: "1.0.0" },
  };
}

function serverMeta(): Dict {
  return { [SERVER_INFO_META]: { name: "contract-lab", version: "1.0.0" } };
}

function complete(fields: Dict): Dict {
  return { resultType: "complete", ...fields, _meta: serverMeta() };
}

function validateRequestMeta(params: Dict): void {
  const meta = params["_meta"];
  if (!isDict(meta)) throw new McpError(-32602, "missing request _meta");
  const version = meta[PROTOCOL_META];
  if (typeof version !== "string") throw new McpError(-32602, "missing protocol version");
  if (version !== PROTOCOL_VERSION) {
    throw new McpError(-32022, "unsupported protocol version", { supported: [PROTOCOL_VERSION], requested: version });
  }
  if (!isDict(meta[CAPABILITIES_META])) throw new McpError(-32602, "missing client capabilities");
}

function matchesType(value: unknown, expected: string): boolean {
  if (expected === "null") return value === null;
  if (expected === "boolean") return typeof value === "boolean";
  if (expected === "integer") return isInt(value);
  if (expected === "number") return typeof value === "number";
  if (expected === "string") return typeof value === "string";
  if (expected === "array") return Array.isArray(value);
  if (expected === "object") return isDict(value);
  throw new ContractViolation(`unsupported schema type at validation boundary: ${expected}`);
}

function validateJsonSchema(value: unknown, schema: unknown, path = "$"): void {
  if (!isDict(schema)) throw new ContractViolation(`${path}: schema must be an object`);
  if ("enum" in schema && !(schema["enum"] as unknown[]).some((item) => deepEqual(item, value))) {
    throw new ContractViolation(`${path}: value is not in enum`);
  }

  const expected = schema["type"];
  if (expected !== undefined && expected !== null) {
    if (typeof expected !== "string" || !matchesType(value, expected)) {
      throw new ContractViolation(`${path}: expected ${expected}`);
    }
  }

  if (isDict(value)) {
    const properties = "properties" in schema ? schema["properties"] : {};
    const required = "required" in schema ? schema["required"] : [];
    if (!isDict(properties) || !Array.isArray(required)) {
      throw new ContractViolation(`${path}: malformed object schema`);
    }
    for (const name of required) {
      if (!(name in value)) throw new ContractViolation(`${path}.${name}: required property missing`);
    }
    for (const [name, item] of Object.entries(value)) {
      if (name in properties) validateJsonSchema(item, properties[name], `${path}.${name}`);
      else if (schema["additionalProperties"] === false) {
        throw new ContractViolation(`${path}.${name}: additional property rejected`);
      }
    }
  }

  if (Array.isArray(value) && "items" in schema) {
    value.forEach((item, index) => validateJsonSchema(item, schema["items"], `${path}[${index}]`));
  }

  if (typeof value === "string") {
    const minimum = schema["minLength"];
    if (isInt(minimum) && [...value].length < minimum) {
      throw new ContractViolation(`${path}: string is shorter than minLength`);
    }
  }
}

type SchemaPath = (string | number)[];

function iterHeaderAnnotationNodes(node: unknown, path: SchemaPath = []): [SchemaPath, Dict][] {
  const found: [SchemaPath, Dict][] = [];
  if (isDict(node)) {
    if ("x-mcp-header" in node) found.push([path, node]);
    for (const [key, child] of Object.entries(node)) {
      if (isDict(child) || Array.isArray(child)) found.push(...iterHeaderAnnotationNodes(child, [...path, key]));
    }
  } else if (Array.isArray(node)) {
    node.forEach((child, index) => {
      if (isDict(child) || Array.isArray(child)) found.push(...iterHeaderAnnotationNodes(child, [...path, index]));
    });
  }
  return found;
}

function validateHeaderAnnotations(tool: Dict): [string[], string][] {
  const inputSchema = tool["inputSchema"];
  if (!isDict(inputSchema)) throw new ContractViolation("inputSchema must be an object");
  const headers: [string[], string][] = [];
  const seen = new Set<string>();
  for (const [schemaPath, propertySchema] of iterHeaderAnnotationNodes(inputSchema)) {
    if (schemaPath.length !== 2 || schemaPath[0] !== "properties" || typeof schemaPath[1] !== "string") {
      throw new ContractViolation("x-mcp-header is allowed only on a direct inputSchema property");
    }
    const propertyName = schemaPath[1];
    const headerName = propertySchema["x-mcp-header"];
    if (typeof headerName !== "string" || !HEADER_TOKEN.test(headerName)) {
      throw new ContractViolation("x-mcp-header must be a valid HTTP field-name token");
    }
    const lowered = headerName.toLowerCase();
    if (seen.has(lowered)) throw new ContractViolation("x-mcp-header names must be unique ignoring case");
    seen.add(lowered);
    if (!["string", "integer", "boolean"].includes(propertySchema["type"])) {
      throw new ContractViolation("x-mcp-header requires string, integer, or boolean");
    }
    if (SENSITIVE_NAMES.has(propertyName.toLowerCase()) || SENSITIVE_NAMES.has(lowered)) {
      throw new ContractViolation("sensitive arguments must not be mirrored to headers");
    }
    headers.push([[propertyName], headerName]);
  }
  return headers;
}

function validateToolDescriptor(tool: Dict): void {
  if (typeof tool["name"] !== "string" || !tool["name"]) {
    throw new ContractViolation("tool name must be a non-empty string");
  }
  const inputSchema = tool["inputSchema"];
  if (!isDict(inputSchema) || inputSchema["type"] !== "object") {
    throw new ContractViolation("inputSchema must be an object schema");
  }
  const outputSchema = tool["outputSchema"];
  if (outputSchema != null && !isDict(outputSchema)) {
    throw new ContractViolation("outputSchema must be a JSON Schema object");
  }
  if (outputSchema != null && iterHeaderAnnotationNodes(outputSchema).length > 0) {
    throw new ContractViolation("x-mcp-header is not allowed in outputSchema");
  }
  validateHeaderAnnotations(tool);
}

function strictBase64Decode(value: string): Buffer {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new Error("invalid base64");
  }
  return Buffer.from(value, "base64");
}

function validateBase64(value: unknown, field: string): void {
  if (typeof value !== "string") throw new ContractViolation(`${field} must be a base64 string`);
  try {
    strictBase64Decode(value);
  } catch {
    throw new ContractViolation(`${field} is not valid base64`);
  }
}

function validateContentBlock(block: unknown): void {
  if (!isDict(block)) throw new ContractViolation("content block must be an object");
  const blockType = block["type"];
  if (blockType === "text") {
    if (typeof block["text"] !== "string") throw new ContractViolation("text content requires text");
  } else if (blockType === "image" || blockType === "audio") {
    validateBase64(block["data"], `${blockType}.data`);
    if (typeof block["mimeType"] !== "string") throw new ContractViolation(`${blockType} content requires mimeType`);
  } else if (blockType === "resource_link") {
    if (!["uri", "name"].every((field) => typeof block[field] === "string")) {
      throw new ContractViolation("resource_link requires uri and name");
    }
  } else if (blockType === "resource") {
    const resource = block["resource"];
    if (!isDict(resource) || typeof resource["uri"] !== "string") {
      throw new ContractViolation("embedded resource requires a uri");
    }
    if (!("text" in resource) && !("blob" in resource)) {
      throw new ContractViolation("embedded resource requires text or blob");
    }
  } else {
    throw new ContractViolation(`unknown content block type: ${blockType === undefined ? "None" : blockType}`);
  }
}

function validateToolResult(tool: Dict, result: Dict): void {
  if (result["resultType"] !== "complete") throw new ContractViolation("tool result must be complete");
  const content = result["content"];
  if (!Array.isArray(content) || content.length === 0) {
    throw new ContractViolation("tool result must contain at least one content block");
  }
  for (const block of content) validateContentBlock(block);

  const outputSchema = tool["outputSchema"];
  if (outputSchema != null) {
    if (!("structuredContent" in result)) throw new ContractViolation("outputSchema requires structuredContent");
    validateJsonSchema(result["structuredContent"], outputSchema);
    if (!content.some((block: Dict) => block["type"] === "text")) {
      throw new ContractViolation("structured results require compatibility text");
    }
  }
}

function descriptor(name: string, description: string, inputSchema: Dict, outputSchema: Dict): Dict {
  return { name, description, inputSchema, outputSchema };
}

const TOOLS: Dict[] = [
  descriptor(
    "tag_catalog",
    "Return an array of tags to prove structuredContent is not object-only.",
    { type: "object", additionalProperties: false },
    { type: "array", items: { type: "string" } },
  ),
  descriptor(
    "evidence_bundle",
    "Return text, media, a resource link, and an embedded resource.",
    { type: "object", additionalProperties: false },
    {
      type: "object",
      properties: { artifact: { type: "string" }, blockCount: { type: "integer" } },
      required: ["artifact", "blockCount"],
      additionalProperties: false,
    },
  ),
  descriptor(
    "route_report",
    "Route a report by a non-sensitive region argument.",
    {
      type: "object",
      properties: {
        region: { type: "string", "x-mcp-header": "Region" },
        report: { type: "string", minLength: 1 },
      },
      required: ["region", "report"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: { region: { type: "string" }, accepted: { type: "boolean" } },
      required: ["region", "accepted"],
      additionalProperties: false,
    },
  ),
  descriptor(
    "blocked_secret_route",
    "Deliberately unsafe descriptor used to exercise client rejection.",
    {
      type: "object",
      properties: { token: { type: "string", "x-mcp-header": "Token" } },
      required: ["token"],
      additionalProperties: false,
    },
    { type: "boolean" },
  ),
];

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

class ContractServer {
  completionCalls: Map<string, number> = new Map();

  serverDiscover(params: Dict): Dict {
    validateRequestMeta(params);
    return complete({
      supportedVersions: [PROTOCOL_VERSION],
      capabilities: { tools: { listChanged: false }, completions: {} },
      ttlMs: 300_000,
      cacheScope: "public",
    });
  }

  toolsList(params: Dict): Dict {
    validateRequestMeta(params);
    const ordered = [...TOOLS].sort((a, b) => compareStrings(a["name"], b["name"]));
    const hasCursor = "cursor" in params;
    const cursor = params["cursor"];
    let page: Dict[];
    let nextCursor: string | null;
    if (!hasCursor) {
      page = ordered.slice(0, 2);
      nextCursor = "";
    } else if (cursor === "") {
      page = ordered.slice(2);
      nextCursor = null;
    } else {
      throw new McpError(-32602, "invalid cursor");
    }
    const fields: Dict = { tools: page, ttlMs: 60_000, cacheScope: "public" };
    if (nextCursor !== null) fields["nextCursor"] = nextCursor;
    return complete(fields);
  }

  toolsCall(params: Dict): Dict {
    validateRequestMeta(params);
    const name = params["name"];
    const tool = TOOLS.find((item) => item["name"] === name);
    if (tool === undefined) throw new McpError(-32602, "unknown tool");
    const args = "arguments" in params ? params["arguments"] : {};
    if (!isDict(args)) throw new McpError(-32602, "arguments must be an object");
    try {
      validateJsonSchema(args, tool["inputSchema"]);
    } catch (exc) {
      if (!(exc instanceof ContractViolation)) throw exc;
      return complete({ content: [{ type: "text", text: exc.message }], isError: true });
    }

    if (name === "tag_catalog") {
      const structured = ["contracts", "mcp", "stateless"];
      return complete({
        content: [{ type: "text", text: pyJsonDumps(structured) }],
        structuredContent: structured,
        isError: false,
      });
    }
    if (name === "evidence_bundle") {
      const structured = { artifact: "contract-report", blockCount: 5 };
      return complete({
        content: [
          { type: "text", text: pyJsonDumps(structured, true) },
          { type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" },
          { type: "audio", data: "UklGRg==", mimeType: "audio/wav" },
          {
            type: "resource_link",
            uri: "evidence://contract-report",
            name: "contract-report",
            mimeType: "application/json",
          },
          {
            type: "resource",
            resource: {
              uri: "evidence://contract-report/summary",
              mimeType: "text/plain",
              text: "All contract checks passed.",
            },
          },
        ],
        structuredContent: structured,
        isError: false,
      });
    }
    if (name === "route_report") {
      if (args["report"] === "unavailable") {
        return complete({
          content: [{ type: "text", text: "Report source is unavailable." }],
          structuredContent: { region: args["region"], accepted: false },
          isError: true,
        });
      }
      const structured = { region: args["region"], accepted: true };
      return complete({
        content: [{ type: "text", text: pyJsonDumps(structured, true) }],
        structuredContent: structured,
        isError: false,
      });
    }
    return complete({ content: [{ type: "text", text: "true" }], structuredContent: true, isError: false });
  }

  completionComplete(params: Dict, principal: string): Dict {
    validateRequestMeta(params);
    this.completionCalls.set(principal, (this.completionCalls.get(principal) ?? 0) + 1);
    if (this.completionCalls.get(principal)! > 3) throw new McpError(-32029, "completion rate limit exceeded");

    const reference = params["ref"];
    const argument = params["argument"];
    if (!deepEqual(reference, { type: "ref/prompt", name: "deployment_review" })) {
      throw new McpError(-32602, "unknown completion reference");
    }
    if (!isDict(argument) || argument["name"] !== "environment") {
      throw new McpError(-32602, "unknown completion argument");
    }
    const prefix = argument["value"];
    if (typeof prefix !== "string") throw new McpError(-32602, "completion value must be a string");

    const allowedByPrincipal: Record<string, string[]> = {
      analyst: ["development", "staging"],
      operator: ["development", "production", "staging"],
    };
    const allowed = Object.hasOwn(allowedByPrincipal, principal) ? allowedByPrincipal[principal] : [];
    const matches = allowed.filter((item) => item.startsWith(prefix));
    return complete({ completion: { values: matches.slice(0, 100), total: matches.length, hasMore: false } });
  }

  dispatch(request: Dict, principal = "analyst"): Dict | null {
    const isNotification = !("id" in request);
    const requestId = "id" in request ? request["id"] : null;
    try {
      const params = "params" in request ? request["params"] : {};
      if (!isDict(params)) throw new McpError(-32602, "params must be an object");
      const method = request["method"];
      let result: Dict;
      if (method === "server/discover") result = this.serverDiscover(params);
      else if (method === "tools/list") result = this.toolsList(params);
      else if (method === "tools/call") result = this.toolsCall(params);
      else if (method === "completion/complete") result = this.completionComplete(params, principal);
      else throw new McpError(-32601, "method not found");
      if (isNotification) return null;
      return { jsonrpc: "2.0", id: requestId, result };
    } catch (exc) {
      if (!(exc instanceof McpError)) throw exc;
      if (isNotification) return null;
      const error: Dict = { code: exc.code, message: exc.message };
      if (exc.data !== null) error["data"] = exc.data;
      return { jsonrpc: "2.0", id: requestId, error };
    }
  }
}

function makeRequest(requestId: number, method: string, params: Dict): Dict {
  return { jsonrpc: "2.0", id: requestId, method, params: { ...params, _meta: requestMeta() } };
}

const MISSING = Symbol("missing");

function readPath(args: Dict, path: string[]): unknown {
  let value: unknown = args;
  for (const segment of path) {
    if (!isDict(value) || !(segment in value)) return MISSING;
    value = value[segment];
  }
  return value;
}

function parameterText(value: unknown, expectedType: string): string {
  if (expectedType === "string" && typeof value === "string") return value;
  if (expectedType === "boolean" && typeof value === "boolean") return value ? "true" : "false";
  if (expectedType === "integer" && isInt(value)) {
    if (!(JS_SAFE_INTEGER_MIN <= value && value <= JS_SAFE_INTEGER_MAX)) {
      throw new ContractViolation("mirrored integer is outside the JavaScript safe range");
    }
    return String(value);
  }
  throw new ContractViolation(`mirrored value does not match declared ${expectedType} type`);
}

function isPlainVisibleAscii(value: string): boolean {
  return value.length > 0 && [...value].every((ch) => {
    const code = ch.codePointAt(0)!;
    return 0x21 <= code && code <= 0x7e;
  });
}

function encodeParameterHeaderValue(value: string): string {
  const sentinelLooking = value.startsWith(BASE64_SENTINEL_PREFIX);
  if (isPlainVisibleAscii(value) && !sentinelLooking) return value;
  const payload = Buffer.from(value, "utf8").toString("base64");
  return `${BASE64_SENTINEL_PREFIX}${payload}${BASE64_SENTINEL_SUFFIX}`;
}

function decodeParameterHeaderValue(value: unknown): string {
  if (typeof value !== "string") throw new ContractViolation("parameter header value must be a string");
  if (value.startsWith(BASE64_SENTINEL_PREFIX)) {
    if (!value.endsWith(BASE64_SENTINEL_SUFFIX)) {
      throw new ContractViolation("parameter header uses a malformed base64 sentinel");
    }
    const payload = value.slice(BASE64_SENTINEL_PREFIX.length, value.length - BASE64_SENTINEL_SUFFIX.length);
    let raw: Buffer;
    let decoded: string;
    try {
      raw = strictBase64Decode(payload);
      decoded = new TextDecoder("utf-8", { fatal: true }).decode(raw);
    } catch {
      throw new ContractViolation("parameter header uses invalid base64 UTF-8");
    }
    if (raw.toString("base64") !== payload) throw new ContractViolation("parameter header base64 is not canonical");
    return decoded;
  }
  if (!isPlainVisibleAscii(value)) throw new ContractViolation("plain parameter header is not visible ASCII");
  return value;
}

function buildParameterHeaders(tool: Dict, args: Dict, auditLog: Dict[]): Record<string, string> {
  const headers: Record<string, string> = {};
  const encodedNames: string[] = [];
  const properties = tool["inputSchema"]["properties"] ?? {};
  for (const [path, name] of validateHeaderAnnotations(tool)) {
    const value = readPath(args, path);
    if (value === MISSING) continue;
    const propertySchema = properties[path[0]];
    const rendered = parameterText(value, propertySchema["type"]);
    const headerName = `Mcp-Param-${name}`;
    const encoded = encodeParameterHeaderValue(rendered);
    headers[headerName] = encoded;
    if (encoded !== rendered) encodedNames.push(headerName);
  }
  auditLog.push({
    event: "parameter_headers_built",
    headerNames: Object.keys(headers).sort(),
    encodedHeaderNames: [...encodedNames].sort(),
  });
  return headers;
}

function validateParameterHeaders(tool: Dict, args: Dict, headers: Record<string, string>, auditLog: Dict[]): void {
  const normalized = new Map<string, [string, string][]>();
  for (const [suppliedName, suppliedValue] of Object.entries(headers)) {
    const key = suppliedName.toLowerCase();
    if (!normalized.has(key)) normalized.set(key, []);
    normalized.get(key)!.push([suppliedName, suppliedValue]);
  }

  const checkedNames: string[] = [];
  const properties = tool["inputSchema"]["properties"] ?? {};
  for (const [path, suffix] of validateHeaderAnnotations(tool)) {
    const expectedName = `Mcp-Param-${suffix}`;
    const supplied = normalized.get(expectedName.toLowerCase()) ?? [];
    const bodyValue = readPath(args, path);
    if (bodyValue === MISSING) {
      if (supplied.length > 0) throw new ContractViolation("recognized parameter header has no body argument");
      continue;
    }
    if (supplied.length === 0) throw new ContractViolation("recognized parameter header is missing");
    if (supplied.length !== 1) throw new ContractViolation("recognized parameter header is duplicated");
    const decoded = decodeParameterHeaderValue(supplied[0][1]);
    const expected = parameterText(bodyValue, properties[path[0]]["type"]);
    if (decoded !== expected) throw new ContractViolation("recognized parameter header does not match the body");
    checkedNames.push(expectedName);
  }

  auditLog.push({ event: "parameter_headers_validated", headerNames: [...checkedNames].sort() });
}

function streamableHttpToolCall(
  server: ContractServer,
  request: Dict,
  headers: Record<string, string>,
  auditLog: Dict[],
  principal = "analyst",
): [number, Dict | null] {
  if (request["method"] === "tools/call") {
    const params = request["params"];
    if (isDict(params)) {
      const args = params["arguments"];
      const tool = TOOLS.find((item) => item["name"] === params["name"]);
      if (tool !== undefined && isDict(args)) {
        try {
          validateParameterHeaders(tool, args, headers, auditLog);
        } catch (exc) {
          if (!(exc instanceof ContractViolation)) throw exc;
          return [
            400,
            {
              jsonrpc: "2.0",
              id: "id" in request ? request["id"] : null,
              error: {
                code: -32020,
                message: "parameter headers do not match request body",
                data: { reason: exc.message },
              },
            },
          ];
        }
      }
    }
  }
  return [200, server.dispatch(request, principal)];
}

class ContractClient {
  server: ContractServer;
  principal: string;
  maxListPages: number;
  rejections: Record<string, string>[] = [];
  cursorTrace: (string | null)[] = [];
  tools: Record<string, Dict> = {};

  constructor(server: ContractServer, principal = "analyst", maxListPages: number = MAX_TOOL_LIST_PAGES) {
    if (!isInt(maxListPages) || maxListPages <= 0) {
      throw new ContractViolation("tools/list page limit must be a positive integer");
    }
    this.server = server;
    this.principal = principal;
    this.maxListPages = maxListPages;
  }

  discoverTools(): Record<string, Dict> {
    let cursor: string | null = null;
    let requestId = 1;
    const seenCursors = new Set<string>();
    for (let i = 0; i < this.maxListPages; i++) {
      const params: Dict = {};
      if (cursor !== null) params["cursor"] = cursor;
      this.cursorTrace.push(cursor);
      const response = this.server.dispatch(makeRequest(requestId, "tools/list", params));
      if (response === null || "error" in response) throw new ContractViolation("tools/list failed");
      const result = response["result"];
      for (const tool of result["tools"] as Dict[]) {
        try {
          validateToolDescriptor(tool);
        } catch (exc) {
          if (!(exc instanceof ContractViolation)) throw exc;
          this.rejections.push({ tool: "name" in tool ? tool["name"] : "<unknown>", reason: exc.message });
          continue;
        }
        this.tools[tool["name"]] = tool;
      }
      const nextCursor = result["nextCursor"];
      if (nextCursor === undefined || nextCursor === null) return this.tools;
      if (typeof nextCursor !== "string") {
        throw new ContractViolation("tools/list nextCursor must be a string or null");
      }
      if (seenCursors.has(nextCursor)) {
        throw new ContractViolation("tools/list returned a repeated or cyclic nextCursor");
      }
      seenCursors.add(nextCursor);
      cursor = nextCursor;
      requestId += 1;
    }
    throw new ContractViolation(`tools/list exceeded the page limit of ${this.maxListPages}`);
  }

  call(name: string, args: Dict): Dict {
    if (Object.keys(this.tools).length === 0) this.discoverTools();
    const tool = this.tools[name];
    if (tool === undefined) throw new ContractViolation(`tool is not admitted: ${name}`);
    const response = this.server.dispatch(makeRequest(20, "tools/call", { name, arguments: args }), this.principal);
    if (response === null || "error" in response) throw new ContractViolation("tools/call returned a protocol error");
    validateToolResult(tool, response["result"]);
    return response["result"];
  }

  completeEnvironment(prefix: string): string[] {
    const response = this.server.dispatch(
      makeRequest(30, "completion/complete", {
        ref: { type: "ref/prompt", name: "deployment_review" },
        argument: { name: "environment", value: prefix },
      }),
      this.principal,
    );
    if (response === null || "error" in response) throw new ContractViolation("completion request failed");
    return response["result"]["completion"]["values"];
  }
}

function main(): void {
  const server = new ContractServer();
  const client = new ContractClient(server);
  const tools = client.discoverTools();
  const tags = client.call("tag_catalog", {});
  const bundle = client.call("evidence_bundle", {});
  const auditLog: Dict[] = [];
  const routeTool = tools["route_report"];
  const headers = buildParameterHeaders(routeTool, { region: "europe-λ", report: "quarterly" }, auditLog);
  const lowered: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) lowered[name.toLowerCase()] = value;
  const [httpStatus] = streamableHttpToolCall(
    server,
    makeRequest(40, "tools/call", {
      name: "route_report",
      arguments: { region: "europe-λ", report: "quarterly" },
    }),
    lowered,
    auditLog,
  );

  console.log("visible tools:", Object.keys(tools).sort().join(", "));
  console.log("rejected tools:", client.rejections.map((item) => item["tool"]).join(", "));
  console.log("cursor trace:", pyRepr(client.cursorTrace.map((item) => (item === null ? "<first>" : pyStr(item)))));
  console.log("array structuredContent:", pyRepr(tags["structuredContent"]));
  console.log("content block types:", pyRepr((bundle["content"] as Dict[]).map((block) => block["type"])));
  console.log("mirrored header names:", pyRepr(Object.keys(headers).sort()));
  console.log("encoded parameter value:", pyRepr(headers["Mcp-Param-Region"].startsWith(BASE64_SENTINEL_PREFIX)));
  console.log("HTTP parity status:", String(httpStatus));
  console.log("audit event:", pyRepr(auditLog[0]));
  console.log("analyst completions:", pyRepr(client.completeEnvironment("")));
}

main();
