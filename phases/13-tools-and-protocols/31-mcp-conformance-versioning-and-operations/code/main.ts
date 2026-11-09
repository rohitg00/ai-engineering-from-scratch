// Lesson: MCP Conformance Engineering: Versioning, Evidence, and Operations (phase 13 / lesson 31)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/code/main.ts

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

const MODERN_VERSION = "2026-07-28";
const LEGACY_VERSION = "2025-11-25";
const PROTOCOL_VERSION_KEY = "io.modelcontextprotocol/protocolVersion";
const CLIENT_CAPABILITIES_KEY = "io.modelcontextprotocol/clientCapabilities";
const CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo";
const MODERN_ERROR_CODES = new Set<number>([-32020, -32021, -32022]);
const CORE_RESULT_TYPES = new Set<string>(["complete", "input_required"]);
const EXTENSION_RESULT_TYPES: Record<string, Set<string>> = {
  "io.modelcontextprotocol/tasks": new Set(["task"]),
};
const SECRET_KEYS = new Set<string>([
  "authorization",
  "cookie",
  "setcookie",
  "xapikey",
  "proxyauthorization",
  "accesstoken",
  "refreshtoken",
  "password",
  "secret",
  "token",
  "apikey",
  "clientsecret",
  "registrationaccesstoken",
]);

function isObj(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function pyStr(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function pyEqual(a: unknown, b: unknown): boolean {
  if (a === undefined) a = null;
  if (b === undefined) b = null;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => pyEqual(item, b[index]));
  }
  if (isObj(a) || isObj(b)) {
    if (!isObj(a) || !isObj(b)) return false;
    const keysA = Object.keys(a);
    if (keysA.length !== Object.keys(b).length) return false;
    return keysA.every((key) => key in b && pyEqual(a[key], b[key]));
  }
  return a === b;
}

function encodeString(value: string): string {
  let out = '"';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const ch = value[i];
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

function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "number") {
    if (value === Infinity) return "Infinity";
    if (value === -Infinity) return "-Infinity";
    if (Number.isNaN(value)) return "NaN";
    return String(value);
  }
  if (typeof value === "string") return encodeString(value);
  if (Array.isArray(value)) return "[" + value.map((item) => canonicalJson(item)).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((key) => encodeString(key) + ":" + canonicalJson(obj[key])).join(",") + "}";
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function isSha256Digest(value: unknown): boolean {
  return typeof value === "string" && value.length === 64 && /^[0-9a-fA-F]*$/.test(value);
}

function hmacHex(key: Buffer, payload: Obj): string {
  return createHmac("sha256", key).update(canonicalJson(payload), "utf8").digest("hex");
}

function attachRollbackAttestation(evidence: Obj, signer: string, signingKey: Buffer): Obj {
  const payload: Obj = { ...evidence };
  delete payload["authenticator"];
  const signature = hmacHex(signingKey, payload);
  return {
    ...payload,
    authenticator: {
      algorithm: "hmac-sha256",
      signer,
      signature,
    },
  };
}

function rollbackEvidenceReady(rollback: unknown, trustedSigners: Map<string, Buffer>): boolean {
  if (!isObj(rollback)) return false;
  const requiredText = ["version"];
  if (
    requiredText.some((field) => {
      const value = rollback[field];
      return typeof value !== "string" || !value.trim();
    })
  ) {
    return false;
  }
  if (rollback["healthy"] !== true || rollback["registryStatus"] !== "active") return false;
  for (const field of ["admissionEvidenceDigest", "artifactDigest", "descriptorDigest"]) {
    if (!isSha256Digest(rollback[field])) return false;
  }
  const authenticator = rollback["authenticator"];
  if (!isObj(authenticator) || authenticator["algorithm"] !== "hmac-sha256") return false;
  const signer = authenticator["signer"];
  const signature = authenticator["signature"];
  if (typeof signer !== "string" || typeof signature !== "string") return false;
  const signingKey = trustedSigners.get(signer);
  if (!(signingKey instanceof Buffer)) return false;
  const payload: Obj = { ...rollback };
  delete payload["authenticator"];
  const expected = hmacHex(signingKey, payload);
  const left = Buffer.from(signature, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function canonicalFieldName(key: string): string {
  return Array.from(key.toLowerCase())
    .filter((character) => /[\p{L}\p{N}]/u.test(character))
    .join("");
}

function redact(value: Json): Json {
  if (isObj(value)) {
    const output: Obj = {};
    for (const [key, item] of Object.entries(value)) {
      const normalized = canonicalFieldName(key);
      output[key] = SECRET_KEYS.has(normalized) ? "[REDACTED]" : redact(item);
    }
    return output;
  }
  if (Array.isArray(value)) return value.map((item) => redact(item));
  return value;
}

class ProtocolViolation extends Error {
  code: number;
  constructor(message: string, code: number = -32600) {
    super(message);
    this.code = code;
  }
}

function routingName(body: Obj): string | null {
  const params = "params" in body ? body["params"] : {};
  if (!isObj(params)) return null;
  for (const key of ["name", "taskId", "uri"]) {
    const value = params[key];
    if (typeof value === "string") return value;
  }
  return null;
}

function normalizedHeaders(headers: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const key = name.toLowerCase();
    if (Object.hasOwn(normalized, key) && normalized[key] !== value) {
      throw new ProtocolViolation(`conflicting duplicate HTTP header: ${name}`, -32020);
    }
    normalized[key] = value;
  }
  return normalized;
}

function isPrintableAscii(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) as number;
    if (code < 0x20 || code > 0x7e) return false;
  }
  return true;
}

function pyStrip(value: string): string {
  return value.replace(/^[\s\x1c-\x1f\x85]+|[\s\x1c-\x1f\x85]+$/g, "");
}

function encodeHeaderValue(value: string): string {
  const safe = isPrintableAscii(value);
  const sentinel = value.startsWith("=?base64?") && value.endsWith("?=");
  if (safe && value === pyStrip(value) && !sentinel) return value;
  const encoded = Buffer.from(value, "utf8").toString("base64");
  return `=?base64?${encoded}?=`;
}

function decodeHeaderValue(value: string): string {
  const starts = value.startsWith("=?base64?");
  const ends = value.endsWith("?=");
  if (starts || ends) {
    if (!(starts && ends)) throw new ProtocolViolation("malformed Base64 MCP header sentinel", -32020);
    const encoded = value.slice("=?base64?".length, Math.max("=?base64?".length, value.length - 2));
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
      throw new ProtocolViolation("malformed Base64 MCP header value", -32020);
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(encoded, "base64"));
    } catch {
      throw new ProtocolViolation("malformed Base64 MCP header value", -32020);
    }
  }
  if (value !== pyStrip(value) || !isPrintableAscii(value)) {
    throw new ProtocolViolation("unsafe MCP header value must use the Base64 sentinel", -32020);
  }
  return value;
}

function validateRequest(headers: Record<string, string>, body: Obj, era: string): void {
  if (body["jsonrpc"] !== "2.0" || typeof body["method"] !== "string") {
    throw new ProtocolViolation("invalid JSON-RPC request");
  }
  const params = "params" in body ? body["params"] : {};
  if (!isObj(params)) throw new ProtocolViolation("params must be an object", -32602);
  const wireHeaders = normalizedHeaders(headers);
  if (era === "legacy") {
    if (body["method"] !== "initialize" && wireHeaders["mcp-protocol-version"] === MODERN_VERSION) {
      throw new ProtocolViolation("modern metadata reached the legacy branch", -32020);
    }
    return;
  }
  if (era !== "modern") throw new Error(`unknown era: ${era}`);

  const metadata = params["_meta"];
  if (!isObj(metadata)) throw new ProtocolViolation("modern request is missing params._meta", -32602);
  const protocolVersion = metadata[PROTOCOL_VERSION_KEY];
  const capabilities = metadata[CLIENT_CAPABILITIES_KEY];
  if (typeof protocolVersion !== "string") {
    throw new ProtocolViolation(`modern request is missing ${PROTOCOL_VERSION_KEY}`, -32602);
  }
  if (!isObj(capabilities)) {
    throw new ProtocolViolation(`modern request is missing ${CLIENT_CAPABILITIES_KEY}`, -32021);
  }

  const mirrored: Record<string, string> = {
    "mcp-protocol-version": protocolVersion,
    "mcp-method": body["method"],
  };
  const name = routingName(body);
  if (name !== null) mirrored["mcp-name"] = name;
  for (const [header, bodyValue] of Object.entries(mirrored)) {
    let headerValue: string | undefined = wireHeaders[header];
    if (header === "mcp-name" && headerValue !== undefined) headerValue = decodeHeaderValue(headerValue);
    if (headerValue !== bodyValue) {
      throw new ProtocolViolation(`${header} does not match the JSON-RPC body`, -32020);
    }
  }
  if (protocolVersion !== MODERN_VERSION) {
    throw new ProtocolViolation(`unsupported protocol version: ${protocolVersion}`, -32022);
  }
}

function allowedResultTypes(capabilities: ReadonlySet<string>): Set<string> {
  const allowed = new Set(CORE_RESULT_TYPES);
  for (const capability of capabilities) {
    for (const item of EXTENSION_RESULT_TYPES[capability] ?? new Set<string>()) allowed.add(item);
  }
  return allowed;
}

interface ValidatedResult {
  semanticType: string;
  wire: Obj;
  inferred: boolean;
}

function validateResult(result: Json, era: string, capabilities: ReadonlySet<string> | null = null): ValidatedResult {
  if (!isObj(result)) throw new ProtocolViolation("result must be an object");
  const preserved: Obj = { ...result };
  const resultType = result["resultType"];
  if (era === "legacy") {
    if (resultType === undefined || resultType === null) {
      return { semanticType: "complete", wire: preserved, inferred: true };
    }
  } else if (era === "modern") {
    if (resultType === undefined || resultType === null) {
      throw new ProtocolViolation("modern result is missing resultType");
    }
  } else {
    throw new Error(`unknown era: ${era}`);
  }

  const allowed = allowedResultTypes(capabilities ?? new Set<string>());
  if (typeof resultType !== "string" || !allowed.has(resultType)) {
    throw new ProtocolViolation(`unknown or unadvertised resultType: ${pyStr(resultType)}`);
  }
  return { semanticType: resultType, wire: preserved, inferred: false };
}

function validateMethodResult(method: string, result: Obj): void {
  const resultType = result["resultType"];
  if (method === "tools/list") {
    if (resultType !== "complete") throw new ProtocolViolation("tools/list must return a complete result");
    const tools = result["tools"];
    if (!Array.isArray(tools)) throw new ProtocolViolation("complete tools/list result requires a tools array");
    const names = new Set<string>();
    for (const tool of tools) {
      if (!isObj(tool)) throw new ProtocolViolation("each tools/list descriptor must be an object");
      const name = tool["name"];
      const description = tool["description"];
      const inputSchema = tool["inputSchema"];
      if (typeof name !== "string" || !name) {
        throw new ProtocolViolation("each tool descriptor requires a non-empty name");
      }
      if (names.has(name)) throw new ProtocolViolation("tools/list contains a duplicate tool name");
      names.add(name);
      if (typeof description !== "string" || !description) {
        throw new ProtocolViolation("each tool descriptor requires a non-empty description");
      }
      if (!isObj(inputSchema) || inputSchema["type"] !== "object") {
        throw new ProtocolViolation("each tool descriptor requires an object-root inputSchema");
      }
    }
  }

  if (method === "completion/complete") {
    if (resultType !== "complete") {
      throw new ProtocolViolation("completion/complete must return a complete result");
    }
    const completion = result["completion"];
    if (!isObj(completion)) throw new ProtocolViolation("completion/complete requires a completion object");
    const values = completion["values"];
    if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
      throw new ProtocolViolation("completion.values must be an array of strings");
    }
    if (values.length > 100) throw new ProtocolViolation("completion.values must contain at most 100 entries");
    const total = completion["total"];
    if (total !== undefined && total !== null && (!isInt(total) || total < values.length)) {
      throw new ProtocolViolation("completion.total must be an integer at least values length");
    }
    const hasMore = completion["hasMore"];
    if (hasMore !== undefined && hasMore !== null && typeof hasMore !== "boolean") {
      throw new ProtocolViolation("completion.hasMore must be a boolean");
    }
  }

  if (resultType !== "task") return;
  if (method !== "tools/call") throw new ProtocolViolation("task result is valid only for tools/call");
  const requiredStrings = ["taskId", "status", "createdAt", "lastUpdatedAt"];
  for (const field of requiredStrings) {
    const value = result[field];
    if (typeof value !== "string" || !value) {
      throw new ProtocolViolation(`task result requires non-empty ${field}`);
    }
  }
  if (!["working", "input_required", "completed", "cancelled", "failed"].includes(result["status"] as string)) {
    throw new ProtocolViolation("task result has an unknown status");
  }
  if (!("ttlMs" in result)) throw new ProtocolViolation("task result requires ttlMs");
  const ttlMs = result["ttlMs"];
  if (ttlMs !== null && (!isInt(ttlMs) || ttlMs < 0)) {
    throw new ProtocolViolation("task result ttlMs must be null or a non-negative integer");
  }
  const pollInterval = result["pollIntervalMs"];
  if (pollInterval !== undefined && pollInterval !== null && (!isInt(pollInterval) || pollInterval < 0)) {
    throw new ProtocolViolation("task result pollIntervalMs must be a non-negative integer");
  }
}

function selectEra(
  observation: Obj,
  policy: string,
  legacyAllowed: boolean = false,
  legacyEvidence: Obj | null = null,
): string {
  if (policy !== "strict" && policy !== "fallback") throw new Error("policy must be strict or fallback");
  const kind = observation["kind"];
  if (kind === "discover_success") return "modern";
  const code = observation["code"];
  if (kind === "jsonrpc_error" && typeof code === "number" && MODERN_ERROR_CODES.has(code)) return "modern";
  if (policy === "strict") {
    throw new ProtocolViolation("modern support was not proven; strict policy forbids fallback");
  }
  if (!["empty", "timeout", "connection_closed", "unrecognized"].includes(kind as string)) {
    throw new ProtocolViolation("probe outcome is not safe evidence for fallback");
  }
  if (!legacyAllowed) throw new ProtocolViolation("legacy fallback is not allowlisted for this endpoint");
  if (!isObj(legacyEvidence)) {
    throw new ProtocolViolation("inconclusive modern probe is not positive legacy evidence");
  }
  if (legacyEvidence["kind"] !== "initialize_success" || legacyEvidence["protocolVersion"] !== LEGACY_VERSION) {
    throw new ProtocolViolation("legacy probe did not prove the configured legacy era");
  }
  return "legacy";
}

function notificationHttpOutcome(request: Obj): [number, null] {
  if ("id" in request) throw new Error("request has an id and is not a notification");
  return [202, null];
}

interface Transcript {
  name: string;
  era: string;
  headers: Record<string, string>;
  request: Obj;
  responseStatus: number;
  responseBody: Obj | null;
  capabilities: ReadonlySet<string>;
  expectedErrorCode: number | null;
}

function transcript(
  name: string,
  era: string,
  headers: Record<string, string>,
  request: Obj,
  responseStatus: number,
  responseBody: Obj | null,
  capabilities: ReadonlySet<string> = new Set<string>(),
  expectedErrorCode: number | null = null,
): Transcript {
  return { name, era, headers, request, responseStatus, responseBody, capabilities, expectedErrorCode };
}

interface CaseResult {
  name: string;
  passed: boolean;
  detail: string;
  evidence_digest: string;
}

function validateResponse(
  request: Obj,
  status: number,
  response: Obj,
  era: string,
  capabilities: ReadonlySet<string>,
): void {
  if (!isObj(response) || response["jsonrpc"] !== "2.0") {
    throw new ProtocolViolation("invalid JSON-RPC response envelope");
  }
  const requestId = request["id"] ?? null;
  const responseId = response["id"] ?? null;
  const kindOf = (value: Json): string => (value === null ? "none" : Array.isArray(value) ? "list" : typeof value);
  if (kindOf(responseId) !== kindOf(requestId) || !pyEqual(responseId, requestId)) {
    throw new ProtocolViolation("response id does not exactly match request id");
  }
  const hasResult = "result" in response;
  const hasError = "error" in response;
  if (hasResult === hasError) {
    throw new ProtocolViolation("response must contain exactly one of result or error");
  }
  if (hasResult) {
    if (status !== 200) throw new ProtocolViolation("successful JSON-RPC result requires HTTP 200");
    validateResult(response["result"], era, capabilities);
    validateMethodResult(request["method"] as string, response["result"] as Obj);
    return;
  }

  const error = response["error"];
  if (!isObj(error)) throw new ProtocolViolation("JSON-RPC error must be an object");
  const code = error["code"];
  if (!isInt(code) || typeof error["message"] !== "string") {
    throw new ProtocolViolation("JSON-RPC error requires integer code and string message");
  }
  const statusMap: Record<string, number> = { "-32020": 400, "-32021": 400, "-32022": 400, "-32601": 404 };
  const expectedStatus = statusMap[String(code)];
  if (expectedStatus !== undefined && status !== expectedStatus) {
    throw new ProtocolViolation(`JSON-RPC error ${code} requires HTTP ${expectedStatus}`);
  }
}

function validateProtocolErrorEvidence(caseItem: Transcript, expectedCode: number): void {
  if (caseItem.responseBody === null) throw new ProtocolViolation("expected JSON-RPC error response is missing");
  validateResponse(
    caseItem.request,
    caseItem.responseStatus,
    caseItem.responseBody,
    caseItem.era,
    new Set(caseItem.capabilities),
  );
  const error = caseItem.responseBody["error"];
  if (!isObj(error) || error["code"] !== expectedCode) {
    throw new ProtocolViolation(`server did not return JSON-RPC error ${expectedCode}`);
  }
}

function runTranscript(caseItem: Transcript): CaseResult {
  const evidence = redact({
    headers: caseItem.headers,
    request: caseItem.request,
    responseStatus: caseItem.responseStatus,
    responseBody: caseItem.responseBody,
  });
  try {
    validateRequest(caseItem.headers, caseItem.request, caseItem.era);
    if (!("id" in caseItem.request)) {
      const [expectedStatus, expectedBody] = notificationHttpOutcome(caseItem.request);
      if (caseItem.responseStatus !== expectedStatus || caseItem.responseBody !== expectedBody) {
        throw new ProtocolViolation("notification received a response body");
      }
    } else if (caseItem.responseBody === null) {
      throw new ProtocolViolation("JSON-RPC request has no response body");
    } else {
      validateResponse(
        caseItem.request,
        caseItem.responseStatus,
        caseItem.responseBody,
        caseItem.era,
        new Set(caseItem.capabilities),
      );
    }
    if (caseItem.expectedErrorCode !== null) {
      return { name: caseItem.name, passed: false, detail: "negative case was accepted", evidence_digest: digest(evidence) };
    }
    return { name: caseItem.name, passed: true, detail: "accepted as expected", evidence_digest: digest(evidence) };
  } catch (error) {
    if (!(error instanceof ProtocolViolation)) throw error;
    let passed = caseItem.expectedErrorCode === error.code;
    let detail = `rejected with ${error.code}: ${error.message}`;
    if (error.code === -32020) {
      try {
        validateProtocolErrorEvidence(caseItem, -32020);
      } catch (responseError) {
        if (!(responseError instanceof ProtocolViolation)) throw responseError;
        passed = false;
        detail = `request rejection was correct, but response was invalid: ${responseError.message}`;
      }
    }
    return { name: caseItem.name, passed, detail, evidence_digest: digest(evidence) };
  }
}

function modernRequest(
  method: string = "tools/list",
  requestId: number | null = 1,
  name: string | null = null,
): [Record<string, string>, Obj] {
  const params: Obj = {
    _meta: {
      [PROTOCOL_VERSION_KEY]: MODERN_VERSION,
      [CLIENT_CAPABILITIES_KEY]: {},
      [CLIENT_INFO_KEY]: { name: "course-harness", version: "1.0.0" },
    },
  };
  if (name !== null) params["name"] = name;
  const body: Obj = { jsonrpc: "2.0", method, params };
  if (requestId !== null) body["id"] = requestId;
  const headers: Record<string, string> = { "MCP-Protocol-Version": MODERN_VERSION, "Mcp-Method": method };
  if (name !== null) headers["Mcp-Name"] = encodeHeaderValue(name);
  return [headers, body];
}

function transcriptSuite(): Transcript[] {
  const [listHeaders, listRequest] = modernRequest();
  const [mismatchHeaders, mismatchRequest] = modernRequest("tools/call", 2, "inventory_get");
  mismatchHeaders["Mcp-Name"] = "inventory_delete";
  const [missingTypeHeaders, missingTypeRequest] = modernRequest("tools/list", 3);
  const [unknownTypeHeaders, unknownTypeRequest] = modernRequest("tools/list", 4);
  const [notificationHeaders, notificationRequest] = modernRequest("notifications/course/progress", null);
  const [badJsonrpcHeaders, badJsonrpcRequest] = modernRequest("tools/list", 5);
  const [wrongIdHeaders, wrongIdRequest] = modernRequest("tools/list", 6);
  const [exclusiveHeaders, exclusiveRequest] = modernRequest("tools/list", 7);
  const [malformedErrorHeaders, malformedErrorRequest] = modernRequest("tools/list", 8);
  const [mappingHeaders, mappingRequest] = modernRequest("tools/list", 9);
  const [malformedToolsHeaders, malformedToolsRequest] = modernRequest("tools/list", 10);
  const [malformedTaskHeaders, malformedTaskRequest] = modernRequest("tools/call", 11, "report_generate");
  const [goldenTaskHeaders, goldenTaskRequest] = modernRequest("tools/call", 12, "report_generate");
  const [completionHeaders, completionRequest] = modernRequest("completion/complete", 13);
  const [malformedCompletionHeaders, malformedCompletionRequest] = modernRequest("completion/complete", 14);
  const tasks = new Set<string>(["io.modelcontextprotocol/tasks"]);
  const none = new Set<string>();
  return [
    transcript("golden-modern-list", "modern", listHeaders, listRequest, 200, {
      jsonrpc: "2.0",
      id: 1,
      result: {
        resultType: "complete",
        tools: [],
        futureHint: { safeToIgnore: true },
      },
    }),
    transcript("golden-notification-no-response", "modern", notificationHeaders, notificationRequest, 202, null),
    transcript(
      "negative-header-body-mismatch",
      "modern",
      mismatchHeaders,
      mismatchRequest,
      400,
      {
        jsonrpc: "2.0",
        id: 2,
        error: { code: -32020, message: "Mcp-Name header mismatch" },
      },
      none,
      -32020,
    ),
    transcript(
      "negative-missing-result-type",
      "modern",
      missingTypeHeaders,
      missingTypeRequest,
      200,
      { jsonrpc: "2.0", id: 3, result: { tools: [] } },
      none,
      -32600,
    ),
    transcript(
      "negative-unknown-result-type",
      "modern",
      unknownTypeHeaders,
      unknownTypeRequest,
      200,
      {
        jsonrpc: "2.0",
        id: 4,
        result: { resultType: "surprise", tools: [] },
      },
      none,
      -32600,
    ),
    transcript(
      "negative-response-jsonrpc-version",
      "modern",
      badJsonrpcHeaders,
      badJsonrpcRequest,
      200,
      { jsonrpc: "1.0", id: 5, result: { resultType: "complete" } },
      none,
      -32600,
    ),
    transcript(
      "negative-response-id-mismatch",
      "modern",
      wrongIdHeaders,
      wrongIdRequest,
      200,
      { jsonrpc: "2.0", id: "6", result: { resultType: "complete" } },
      none,
      -32600,
    ),
    transcript(
      "negative-result-error-exclusivity",
      "modern",
      exclusiveHeaders,
      exclusiveRequest,
      200,
      {
        jsonrpc: "2.0",
        id: 7,
        result: { resultType: "complete" },
        error: { code: -32600, message: "both" },
      },
      none,
      -32600,
    ),
    transcript(
      "negative-malformed-error",
      "modern",
      malformedErrorHeaders,
      malformedErrorRequest,
      400,
      { jsonrpc: "2.0", id: 8, error: { code: "-32020" } },
      none,
      -32600,
    ),
    transcript(
      "negative-error-http-mapping",
      "modern",
      mappingHeaders,
      mappingRequest,
      500,
      {
        jsonrpc: "2.0",
        id: 9,
        error: { code: -32020, message: "header mismatch" },
      },
      none,
      -32600,
    ),
    transcript(
      "negative-malformed-tools-list",
      "modern",
      malformedToolsHeaders,
      malformedToolsRequest,
      200,
      {
        jsonrpc: "2.0",
        id: 10,
        result: {
          resultType: "complete",
          tools: [{ name: "unsafe", description: "Missing schema" }],
        },
      },
      none,
      -32600,
    ),
    transcript(
      "negative-task-required-fields",
      "modern",
      malformedTaskHeaders,
      malformedTaskRequest,
      200,
      { jsonrpc: "2.0", id: 11, result: { resultType: "task", taskId: "t-1" } },
      tasks,
      -32600,
    ),
    transcript(
      "golden-task-result",
      "modern",
      goldenTaskHeaders,
      goldenTaskRequest,
      200,
      {
        jsonrpc: "2.0",
        id: 12,
        result: {
          resultType: "task",
          taskId: "t-2",
          status: "working",
          createdAt: "2026-08-21T10:00:00Z",
          lastUpdatedAt: "2026-08-21T10:00:00Z",
          ttlMs: 900000,
          pollIntervalMs: 1000,
        },
      },
      tasks,
    ),
    transcript("golden-completion-result", "modern", completionHeaders, completionRequest, 200, {
      jsonrpc: "2.0",
      id: 13,
      result: {
        resultType: "complete",
        completion: {
          values: ["development", "staging"],
          total: 3,
          hasMore: true,
        },
      },
    }),
    transcript(
      "negative-malformed-completion-result",
      "modern",
      malformedCompletionHeaders,
      malformedCompletionRequest,
      200,
      {
        jsonrpc: "2.0",
        id: 14,
        result: {
          resultType: "complete",
          completion: {
            values: ["staging", 7],
            total: 2,
            hasMore: false,
          },
        },
      },
      none,
      -32600,
    ),
  ];
}

interface SdkReport {
  semanticMatch: boolean;
  droppedFields: string[];
  changedFields: string[];
  rawDigest: string;
  sdkDigest: string;
}

function compareSdkView(
  rawResult: Obj,
  sdkResult: Obj,
  era: string = "modern",
  capabilities: ReadonlySet<string> | null = null,
  method: string = "tools/list",
): SdkReport {
  const validated = validateResult(rawResult, era, capabilities);
  const methodResult: Obj = { ...validated.wire };
  methodResult["resultType"] = validated.semanticType;
  validateMethodResult(method, methodResult);
  const bookkeeping = new Set(["resultType", "_meta", "ttlMs", "cacheScope"]);
  const semanticWire: Obj = {};
  for (const [key, value] of Object.entries(validated.wire)) {
    if (!bookkeeping.has(key)) semanticWire[key] = value;
  }
  const dropped = Object.keys(semanticWire)
    .filter((key) => !(key in sdkResult))
    .sort();
  const changed = Object.keys(semanticWire)
    .filter((key) => key in sdkResult && !pyEqual(semanticWire[key], sdkResult[key]))
    .sort();
  return {
    semanticMatch: dropped.length === 0 && changed.length === 0,
    droppedFields: dropped,
    changedFields: changed,
    rawDigest: digest(rawResult),
    sdkDigest: digest(sdkResult),
  };
}

interface ProxyReport {
  passed: boolean;
  issues: string[];
  ingressDigest: string;
  originDigest: string;
  egressDigest: string;
  evidence: Json;
}

function getObj(source: Obj, key: string): Obj {
  const value = source[key];
  return value === undefined ? {} : (value as Obj);
}

function inspectProxy(exchange: Obj): ProxyReport {
  const issues: string[] = [];
  const ingress = getObj(exchange, "ingress");
  const origin = getObj(exchange, "origin");
  const egress = getObj(exchange, "egress");
  try {
    validateRequest(
      (ingress["headers"] ?? {}) as Record<string, string>,
      getObj(ingress, "body"),
      "modern",
    );
  } catch (error) {
    if (!(error instanceof ProtocolViolation)) throw error;
    issues.push(`ingress:${error.code}`);
  }

  const originBody = origin["body"];
  if (
    (origin["status"] === 400 || origin["status"] === 404) &&
    isObj(originBody) &&
    "error" in originBody &&
    egress["status"] === 500
  ) {
    issues.push("proxy collapsed a protocol error into HTTP 500");
  }
  if (!pyEqual(origin["body"], egress["body"])) issues.push("proxy changed the origin JSON-RPC body");

  const redactedExchange = redact(exchange) as Obj;
  return {
    passed: issues.length === 0,
    issues,
    ingressDigest: digest(getObj(redactedExchange, "ingress")),
    originDigest: digest(getObj(redactedExchange, "origin")),
    egressDigest: digest(getObj(redactedExchange, "egress")),
    evidence: redactedExchange,
  };
}

function numberOr(source: Obj, key: string, fallback: number): number {
  const value = source[key];
  return value === undefined ? fallback : (value as number);
}

function evaluateHealth(health: Obj): [boolean, string[]] {
  const reasons: string[] = [];
  if (numberOr(health, "sampleCount", 0) <= 0) reasons.push("health window has no samples");
  if (numberOr(health, "errorRate", 1.0) > numberOr(health, "maxErrorRate", 0.01)) {
    reasons.push("error rate exceeds the release threshold");
  }
  if (numberOr(health, "p95Ms", Infinity) > numberOr(health, "maxP95Ms", 500)) {
    reasons.push("p95 latency exceeds the release threshold");
  }
  return [reasons.length === 0, reasons];
}

interface GateReport {
  action: string;
  passed: boolean;
  reasons: string[];
  healthPassed: boolean;
  rollbackReady: boolean;
  evidenceDigest: string;
  evidence: Json;
}

class ReleaseGate {
  trustedRollbackSigners: Map<string, Buffer>;

  constructor(trustedRollbackSigners: Map<string, Buffer> | null = null) {
    this.trustedRollbackSigners = new Map(trustedRollbackSigners ?? []);
  }

  evaluate(
    transcripts: CaseResult[],
    sdkReports: SdkReport[],
    proxyReports: ProxyReport[],
    health: Obj,
    rollback: Obj,
  ): GateReport {
    const reasons: string[] = [];
    if (transcripts.length === 0) reasons.push("conformance transcript evidence is empty");
    else if (transcripts.some((caseItem) => !isSha256Digest(caseItem.evidence_digest))) {
      reasons.push("conformance transcript evidence has an invalid digest");
    }
    for (const caseItem of transcripts) {
      if (!caseItem.passed) reasons.push(`transcript failed: ${caseItem.name}`);
    }
    if (sdkReports.length === 0) reasons.push("SDK differential evidence is empty");
    else if (sdkReports.some((report) => !isSha256Digest(report.rawDigest) || !isSha256Digest(report.sdkDigest))) {
      reasons.push("SDK differential evidence has an invalid digest");
    }
    for (const report of sdkReports) {
      if (report.semanticMatch !== true) reasons.push("SDK view lost or changed wire semantics");
    }
    if (proxyReports.length === 0) reasons.push("proxy evidence is empty");
    else if (
      proxyReports.some(
        (report) =>
          !isSha256Digest(report.ingressDigest) ||
          !isSha256Digest(report.originDigest) ||
          !isSha256Digest(report.egressDigest),
      )
    ) {
      reasons.push("proxy evidence has an invalid digest");
    }
    for (const report of proxyReports) reasons.push(...report.issues);
    for (const report of proxyReports) {
      if (report.passed !== true && report.issues.length === 0) reasons.push("proxy evidence did not pass");
    }
    const [healthPassed, healthReasons] = evaluateHealth(health);
    reasons.push(...healthReasons);

    const rollbackReady = rollbackEvidenceReady(rollback, this.trustedRollbackSigners);
    if (!rollbackReady) reasons.push("no verified healthy rollback target");
    let action: string;
    if (reasons.length === 0) action = "promote";
    else if (rollbackReady) action = "rollback";
    else action = "hold";

    const evidence = redact({
      transcripts: transcripts.map((caseItem) => ({ ...caseItem })),
      sdkDifferential: sdkReports.map((report) => ({ ...report })),
      proxy: proxyReports.map((report) => ({ ...report })),
      health,
      rollback,
    });
    return {
      action,
      passed: action === "promote",
      reasons,
      healthPassed,
      rollbackReady,
      evidenceDigest: digest(evidence),
      evidence,
    };
  }
}

function healthyWindow(): Obj {
  return {
    sampleCount: 1000,
    errorRate: 0.002,
    maxErrorRate: 0.01,
    p95Ms: 180,
    maxP95Ms: 500,
  };
}

function demo(): void {
  const cases = transcriptSuite().map((caseItem) => runTranscript(caseItem));
  const rawResult: Obj = {
    resultType: "complete",
    tools: [],
    futureHint: { preserve: true },
    _meta: { trace: "trace-42" },
  };
  const sdkReport = compareSdkView(rawResult, { tools: [] });
  const [headers, request] = modernRequest("tools/call", 7, "inventory_get");
  const errorBody: Obj = {
    jsonrpc: "2.0",
    id: 7,
    error: { code: -32020, message: "header mismatch" },
  };
  const proxyReport = inspectProxy({
    ingress: {
      headers: { ...headers, Authorization: "Bearer do-not-store" },
      body: request,
    },
    origin: { status: 400, body: errorBody },
    egress: { status: 500, body: { message: "upstream failed" } },
  });
  const fixtureKey = createHash("sha256").update(Buffer.from("deterministic non-secret lesson fixture")).digest();
  const rollback = attachRollbackAttestation(
    {
      version: "1.0.0",
      healthy: true,
      registryStatus: "active",
      admissionEvidenceDigest: digest({ release: "1.0.0" }),
      artifactDigest: digest({ artifact: "inventory-1.0.0" }),
      descriptorDigest: digest({ tools: ["inventory_get"] }),
    },
    "release-controller",
    fixtureKey,
  );
  const report = new ReleaseGate(new Map([["release-controller", fixtureKey]])).evaluate(
    cases,
    [sdkReport],
    [proxyReport],
    healthyWindow(),
    rollback,
  );
  console.log(
    JSON.stringify(
      {
        transcriptsPassed: cases.filter((caseItem) => caseItem.passed).length,
        transcriptsTotal: cases.length,
        sdkDroppedFields: sdkReport.droppedFields,
        proxyIssues: proxyReport.issues,
        releaseAction: report.action,
        evidenceDigest: report.evidenceDigest,
      },
      null,
      2,
    ),
  );
}


demo();
