// Lesson: MCP Transports: stdio and Stateless Streamable HTTP (phase 13 / lesson 09)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/09-mcp-transports/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/09-mcp-transports/code/main.ts

import http from "node:http";
import type { AddressInfo } from "node:net";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

function pyJsonString(s: string): string {
  return JSON.stringify(s).replace(/[\u0080-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

function pyJsonDumps(value: Json, compact = false): string {
  const itemSep = compact ? "," : ", ";
  const keySep = compact ? ":" : ": ";
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return pyJsonString(value);
  if (Array.isArray(value)) return "[" + value.map((v) => pyJsonDumps(v, compact)).join(itemSep) + "]";
  return "{" + Object.keys(value).map((k) => pyJsonString(k) + keySep + pyJsonDumps(value[k], compact)).join(itemSep) + "}";
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const PROTOCOL_VERSION = "2026-07-28";
const SUPPORTED_VERSIONS = [PROTOCOL_VERSION];
const VERSION_KEY = "io.modelcontextprotocol/protocolVersion";
const CAPABILITIES_KEY = "io.modelcontextprotocol/clientCapabilities";
const CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo";
const SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo";
const SUBSCRIPTION_ID_KEY = "io.modelcontextprotocol/subscriptionId";

const CLIENT_INFO: JsonObject = { name: "lesson-09-client", version: "2.0.0" };
const SERVER_INFO: JsonObject = { name: "lesson-09-http", version: "2.0.0" };
const SERVER_CAPABILITIES: JsonObject = { tools: { listChanged: true } };
const ORIGIN_ALLOWLIST = new Set(["http://localhost", "http://127.0.0.1", "https://client.example"]);
const MAX_REQUEST_BYTES = 1_048_576;
const READ_TIMEOUT_SECONDS = 5.0;
const ROUTING_HEADERS = ["MCP-Protocol-Version", "Mcp-Method", "Mcp-Name"];

const TOOLS: JsonObject[] = [
  {
    name: "ping",
    description: "Return pong for a transport health check.",
    inputSchema: { type: "object", properties: {}, required: [] },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
];

interface HeaderLookup {
  get(name: string): string | null;
  get_all?(name: string): string[];
}

class HeaderBag implements HeaderLookup {
  constructor(private pairs: [string, string][]) {}

  static fromRaw(raw: string[]): HeaderBag {
    const pairs: [string, string][] = [];
    for (let i = 0; i + 1 < raw.length; i += 2) pairs.push([raw[i], raw[i + 1]]);
    return new HeaderBag(pairs);
  }

  get(name: string): string | null {
    const found = this.pairs.find(([k]) => k.toLowerCase() === name.toLowerCase());
    return found ? found[1] : null;
  }

  get_all(name: string): string[] {
    return this.pairs.filter(([k]) => k.toLowerCase() === name.toLowerCase()).map(([, v]) => v);
  }
}

class RpcFault extends Error {
  constructor(
    public code: number,
    message: string,
    public data: Json = null,
  ) {
    super(message);
  }
}

class ValueError extends Error {}

function request_meta(version: string = PROTOCOL_VERSION): JsonObject {
  return {
    [VERSION_KEY]: version,
    [CAPABILITIES_KEY]: {},
    [CLIENT_INFO_KEY]: { ...CLIENT_INFO },
  };
}

function make_request(
  request_id: number | string,
  method: string,
  params: JsonObject | null = null,
  options: { version?: string } = {},
): JsonObject {
  const body_params: JsonObject = { ...(params ?? {}) };
  body_params["_meta"] = request_meta(options.version ?? PROTOCOL_VERSION);
  return { jsonrpc: "2.0", id: request_id, method, params: body_params };
}

function rpc_error(request_id: Json, code: number, message: string, data: Json = null): JsonObject {
  const error: JsonObject = { code, message };
  if (data !== null) error["data"] = data;
  return { jsonrpc: "2.0", id: request_id, error };
}

function complete(
  payload: JsonObject,
  options: { ttl_ms?: number | null; cache_scope?: string; result_meta?: JsonObject | null } = {},
): JsonObject {
  const metadata: JsonObject = { [SERVER_INFO_KEY]: { ...SERVER_INFO } };
  if (options.result_meta && Object.keys(options.result_meta).length > 0) Object.assign(metadata, options.result_meta);
  const result: JsonObject = {
    resultType: "complete",
    ...payload,
    _meta: metadata,
  };
  const ttl_ms = options.ttl_ms ?? null;
  if (ttl_ms !== null) {
    result["ttlMs"] = ttl_ms;
    result["cacheScope"] = options.cache_scope ?? "private";
  }
  return result;
}

function origin_allowed(origin: string | null): boolean {
  return origin === null || ORIGIN_ALLOWLIST.has(origin);
}

function isPrintableAscii(value: string): boolean {
  return [...value].every((c) => c.codePointAt(0)! >= 0x20 && c.codePointAt(0)! <= 0x7e);
}

function encode_header_value(value: string): string {
  const safe = isPrintableAscii(value);
  const sentinel = value.startsWith("=?base64?") && value.endsWith("?=");
  if (safe && value === value.trim() && !sentinel) return value;
  const encoded = Buffer.from(value, "utf-8").toString("base64");
  return `=?base64?${encoded}?=`;
}

function decode_header_value(value: string): string {
  if (value.startsWith("=?base64?") && value.endsWith("?=")) {
    const encoded = value.slice("=?base64?".length, -2);
    if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
      throw new RpcFault(-32020, "Malformed Base64 MCP header value");
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(encoded, "base64"));
    } catch {
      throw new RpcFault(-32020, "Malformed Base64 MCP header value");
    }
  }
  if (!isPrintableAscii(value)) throw new RpcFault(-32020, "Malformed MCP header value");
  return value;
}

function body_name(message: JsonObject): string | null {
  const params = (message["params"] ?? {}) as JsonObject;
  let value: Json | undefined;
  if (message["method"] === "resources/read") {
    value = params["uri"];
  } else if (message["method"] === "tools/call" || message["method"] === "prompts/get") {
    value = params["name"];
  } else {
    return null;
  }
  return typeof value === "string" ? value : null;
}

function http_headers_for(
  message: JsonObject,
  options: { origin?: string; extra?: Record<string, string> | null } = {},
): Record<string, string> {
  const meta = (message["params"] as JsonObject)["_meta"] as JsonObject;
  const headers: Record<string, string> = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    Origin: options.origin ?? "http://localhost",
    "MCP-Protocol-Version": String(meta[VERSION_KEY]),
    "Mcp-Method": String(message["method"]),
  };
  const name = body_name(message);
  if (name !== null) headers["Mcp-Name"] = encode_header_value(name);
  if (options.extra) Object.assign(headers, options.extra);
  return headers;
}

function validate_request_structure(message: JsonObject): string {
  if (message["jsonrpc"] !== "2.0" || typeof message["method"] !== "string") {
    throw new RpcFault(-32600, "Invalid Request");
  }
  const params = message["params"];
  if (!isObject(params)) throw new RpcFault(-32602, "params must be an object");
  const meta = params["_meta"];
  if (!isObject(meta)) throw new RpcFault(-32602, "params._meta is required");
  const version = meta[VERSION_KEY];
  if (typeof version !== "string") throw new RpcFault(-32602, `${VERSION_KEY} is required`);
  if (!isObject(meta[CAPABILITIES_KEY])) throw new RpcFault(-32602, `${CAPABILITIES_KEY} is required`);
  const client_info = meta[CLIENT_INFO_KEY];
  if (
    client_info !== undefined &&
    client_info !== null &&
    (!isObject(client_info) || typeof client_info["name"] !== "string" || typeof client_info["version"] !== "string")
  ) {
    throw new RpcFault(-32602, `${CLIENT_INFO_KEY} is malformed`);
  }
  return version;
}

function validate_supported_version(version: string): void {
  if (!SUPPORTED_VERSIONS.includes(version)) {
    throw new RpcFault(-32022, "Unsupported protocol version", {
      supported: [...SUPPORTED_VERSIONS],
      requested: version,
    });
  }
}

function validate_http_headers(headers: HeaderLookup, message: JsonObject, body_version: string): void {
  const header_version = headers.get("MCP-Protocol-Version");
  if (header_version === null || header_version !== body_version) {
    throw new RpcFault(-32020, "Header mismatch: MCP-Protocol-Version");
  }
  const header_method = headers.get("Mcp-Method");
  if (header_method === null || header_method !== message["method"]) {
    throw new RpcFault(-32020, "Header mismatch: Mcp-Method");
  }
  const expected_name = body_name(message);
  if (["tools/call", "resources/read", "prompts/get"].includes(message["method"] as string)) {
    const header_name = headers.get("Mcp-Name");
    if (header_name === null || expected_name === null) throw new RpcFault(-32020, "Header mismatch: Mcp-Name");
    if (decode_header_value(header_name) !== expected_name) throw new RpcFault(-32020, "Header mismatch: Mcp-Name");
  }
}

function reject_duplicate_routing_headers(headers: HeaderLookup): void {
  if (!headers.get_all) return;
  for (const name of ROUTING_HEADERS) {
    if (headers.get_all(name).length > 1) throw new RpcFault(-32020, `Duplicate routing header: ${name}`);
  }
}

function reject_duplicate_origin(headers: HeaderLookup): void {
  if (headers.get_all && headers.get_all("Origin").length > 1) throw new RpcFault(-32020, "Duplicate Origin header");
}

function reject_ambiguous_body_framing(headers: HeaderLookup): void {
  if (!headers.get_all) return;
  if (headers.get_all("Content-Length").length > 1) {
    throw new ValueError("duplicate Content-Length headers are not allowed");
  }
  if (headers.get_all("Transfer-Encoding").length > 0) throw new ValueError("Transfer-Encoding is not supported");
}

function dispatch(message: JsonObject): JsonObject | null {
  if (!("id" in message)) return null;
  const request_id = message["id"];
  try {
    const version = validate_request_structure(message);
    validate_supported_version(version);
    const method = message["method"] as string;
    const params = message["params"] as JsonObject;
    let result: JsonObject;
    if (method === "server/discover") {
      result = complete(
        {
          supportedVersions: [...SUPPORTED_VERSIONS],
          capabilities: { ...SERVER_CAPABILITIES },
          instructions: "Call ping for a transport health check.",
        },
        { ttl_ms: 3_600_000, cache_scope: "public" },
      );
    } else if (method === "tools/list") {
      const tools = [...TOOLS].sort((a, b) => ((a["name"] as string) < (b["name"] as string) ? -1 : 1));
      result = complete({ tools }, { ttl_ms: 30_000, cache_scope: "public" });
    } else if (method === "tools/call") {
      if (params["name"] !== "ping" || !isObject(params["arguments"] ?? {})) {
        result = complete({
          content: [{ type: "text", text: "Unknown or invalid tool" }],
          isError: true,
        });
      } else {
        result = complete({ content: [{ type: "text", text: "pong" }], isError: false });
      }
    } else if (method === "subscriptions/listen") {
      const notifications = params["notifications"];
      if (!isObject(notifications)) throw new RpcFault(-32602, "subscriptions/listen requires notifications");
      result = complete({});
    } else {
      throw new RpcFault(-32601, `Method not found: ${method}`);
    }
    return { jsonrpc: "2.0", id: request_id, result };
  } catch (exc) {
    if (exc instanceof RpcFault) return rpc_error(request_id, exc.code, exc.message, exc.data);
    throw exc;
  }
}

function accepted_filter(requested: JsonObject): JsonObject {
  const accepted: JsonObject = {};
  for (const key of ["toolsListChanged", "promptsListChanged", "resourcesListChanged"]) {
    if (requested[key] === true) accepted[key] = true;
  }
  const resources = requested["resourceSubscriptions"];
  if (Array.isArray(resources) && resources.every((uri) => typeof uri === "string")) {
    accepted["resourceSubscriptions"] = [...resources];
  }
  return accepted;
}

function subscription_messages(message: JsonObject): JsonObject[] {
  const request_id = message["id"] as Json;
  const requested = (message["params"] as JsonObject)["notifications"] as JsonObject;
  const accepted = accepted_filter(requested);
  const subscription_meta: JsonObject = { [SUBSCRIPTION_ID_KEY]: request_id };
  const messages: JsonObject[] = [
    {
      jsonrpc: "2.0",
      method: "notifications/subscriptions/acknowledged",
      params: { notifications: accepted, _meta: { ...subscription_meta } },
    },
  ];
  if (accepted["toolsListChanged"]) {
    messages.push({
      jsonrpc: "2.0",
      method: "notifications/tools/list_changed",
      params: { _meta: { ...subscription_meta } },
    });
  }
  const resources = (accepted["resourceSubscriptions"] ?? []) as Json[];
  if (resources.length > 0) {
    messages.push({
      jsonrpc: "2.0",
      method: "notifications/resources/updated",
      params: { uri: resources[0], _meta: { ...subscription_meta } },
    });
  }
  messages.push({
    jsonrpc: "2.0",
    id: request_id,
    result: complete({}, { result_meta: subscription_meta }),
  });
  return messages;
}

function readBody(req: http.IncomingMessage, length: number, timeoutMs: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const timer = setTimeout(() => reject(new ValueError("timed out")), timeoutMs);
    const finish = (): void => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).subarray(0, length));
    };
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size >= length) finish();
    });
    req.on("end", finish);
    req.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

class Handler {
  private headers: HeaderBag;

  constructor(
    private req: http.IncomingMessage,
    private res: http.ServerResponse,
  ) {
    this.headers = HeaderBag.fromRaw(req.rawHeaders);
  }

  log_message(text: string): void {
    process.stderr.write("[mcp-http] " + text + "\n");
  }

  private send_response(status: number, headers: Record<string, string>): void {
    this.log_message(`"${this.req.method} ${this.req.url} HTTP/${this.req.httpVersion}" ${status} -`);
    this.res.writeHead(status, headers);
  }

  private _write_json(status: number, payload: JsonObject): void {
    const body = Buffer.from(pyJsonDumps(payload, true), "utf-8");
    this.send_response(status, { "Content-Type": "application/json", "Content-Length": String(body.length) });
    this.res.end(body);
  }

  private _write_fault(status: number, request_id: Json, fault: RpcFault): void {
    this._write_json(status, rpc_error(request_id, fault.code, fault.message, fault.data));
  }

  private _valid_path_and_origin(): boolean {
    if (this.req.url !== "/mcp") {
      this._write_json(404, { error: "Not found" });
      return false;
    }
    try {
      reject_duplicate_origin(this.headers);
    } catch (fault) {
      if (!(fault instanceof RpcFault)) throw fault;
      this._write_fault(400, null, fault);
      return false;
    }
    const origin = this.headers.get("Origin");
    if (!origin_allowed(origin)) {
      this._write_json(403, { error: "Origin not allowed" });
      return false;
    }
    return true;
  }

  private _method_not_allowed(): void {
    const body = Buffer.from(pyJsonDumps({ error: "Method not allowed" }), "utf-8");
    this.send_response(405, {
      Allow: "POST",
      "Content-Type": "application/json",
      "Content-Length": String(body.length),
    });
    this.res.end(body);
  }

  private _write_subscription_stream(message: JsonObject): void {
    this.send_response(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    });
    for (const payload of subscription_messages(message)) {
      this.res.write(Buffer.from(`data: ${pyJsonDumps(payload, true)}\n\n`, "utf-8"));
    }
    this.res.end();
  }

  async do_POST(): Promise<void> {
    if (!this._valid_path_and_origin()) return;
    const content_type = (this.headers.get("Content-Type") ?? "").split(";", 1)[0].trim().toLowerCase();
    if (content_type !== "application/json") {
      this._write_json(415, { error: "Content-Type must be application/json" });
      return;
    }
    const accept = this.headers.get("Accept") ?? "";
    if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
      this._write_json(406, { error: "Accept must include JSON and SSE" });
      return;
    }
    let message: JsonObject;
    try {
      reject_ambiguous_body_framing(this.headers);
      const raw_length = this.headers.get("Content-Length");
      if (raw_length === null) throw new ValueError("Content-Length is required");
      if (!/^[0-9]+$/.test(raw_length)) throw new ValueError("Content-Length must contain ASCII decimal digits");
      const length = parseInt(raw_length, 10);
      if (!(1 <= length && length <= MAX_REQUEST_BYTES)) {
        throw new ValueError(`Content-Length must be from 1 through ${MAX_REQUEST_BYTES}`);
      }
      const body = await readBody(this.req, length, READ_TIMEOUT_SECONDS * 1000);
      if (body.length !== length) throw new ValueError("request body ended before Content-Length bytes arrived");
      let parsed: Json;
      try {
        parsed = JSON.parse(body.toString("utf-8"));
      } catch (exc) {
        throw new ValueError((exc as Error).message);
      }
      if (!isObject(parsed)) throw new ValueError("message must be an object");
      message = parsed;
    } catch (exc) {
      if (!(exc instanceof ValueError)) throw exc;
      this._write_json(400, rpc_error(null, -32700, "Parse error", { detail: exc.message }));
      return;
    }

    const request_id = message["id"] ?? null;
    try {
      const body_version = validate_request_structure(message);
      reject_duplicate_routing_headers(this.headers);
      validate_http_headers(this.headers, message, body_version);
      validate_supported_version(body_version);
    } catch (fault) {
      if (!(fault instanceof RpcFault)) throw fault;
      this._write_fault(400, request_id, fault);
      return;
    }

    if (!("id" in message)) {
      this.send_response(202, {});
      this.res.end();
      return;
    }

    if (message["method"] === "subscriptions/listen") {
      const notifications = (message["params"] as JsonObject)["notifications"];
      if (!isObject(notifications)) {
        this._write_fault(400, request_id, new RpcFault(-32602, "subscriptions/listen requires notifications"));
        return;
      }
      this._write_subscription_stream(message);
      return;
    }

    const response = dispatch(message);
    const error = response ? response["error"] : undefined;
    const status = isObject(error) && error["code"] === -32601 ? 404 : 200;
    if (response !== null) this._write_json(status, response);
  }

  do_GET(): void {
    if (this._valid_path_and_origin()) this._method_not_allowed();
  }

  do_DELETE(): void {
    if (this._valid_path_and_origin()) this._method_not_allowed();
  }

  async handle(): Promise<void> {
    if (this.req.method === "POST") await this.do_POST();
    else if (this.req.method === "GET") this.do_GET();
    else if (this.req.method === "DELETE") this.do_DELETE();
    else this._write_json(501, { error: "Unsupported method" });
  }
}

function serve(host: string = "127.0.0.1", port: number = 0): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    new Handler(req, res).handle().catch((err: unknown) => {
      process.stderr.write(`[mcp-http] handler error: ${String(err)}\n`);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  return new Promise((resolve) => server.listen(port, host, () => resolve(server)));
}

type PostResult = [number, http.IncomingHttpHeaders, unknown];

function rawRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: Buffer | null,
): Promise<[number, http.IncomingHttpHeaders, string]> {
  return new Promise((resolve, reject) => {
    const allHeaders: Record<string, string> = { ...headers, Connection: "close" };
    if (body !== null) allHeaders["Content-Length"] = String(body.length);
    const request = http.request(url, { method, headers: allHeaders, agent: false }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("end", () =>
        resolve([response.statusCode ?? 0, response.headers, Buffer.concat(chunks).toString("utf-8")]),
      );
      response.on("error", reject);
    });
    request.setTimeout(3000, () => request.destroy(new Error("timed out")));
    request.on("error", reject);
    request.end(body ?? undefined);
  });
}

function contentType(headers: http.IncomingHttpHeaders): string {
  const value = headers["content-type"];
  if (!value) return "text/plain";
  return value.split(";", 1)[0].trim().toLowerCase();
}

async function post(url: string, message: JsonObject, headers: Record<string, string>): Promise<PostResult> {
  const data = Buffer.from(pyJsonDumps(message), "utf-8");
  const [status, response_headers, body] = await rawRequest(url, "POST", headers, data);
  if (status >= 400) return [status, response_headers, body ? JSON.parse(body) : null];
  const payload: unknown = contentType(response_headers) === "application/json" ? JSON.parse(body) : body;
  return [status, response_headers, payload];
}

function headerOrNone(headers: http.IncomingHttpHeaders, name: string): string {
  const value = headers[name.toLowerCase()];
  if (value === undefined) return "None";
  return Array.isArray(value) ? value[0] : value;
}

async function probe(): Promise<void> {
  const server = await serve();
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`;
  console.log("MCP 2026-07-28 Streamable HTTP probe");

  const discover = make_request(1, "server/discover");
  let [status, headers, payload] = await post(url, discover, http_headers_for(discover, { origin: "http://evil.example" }));
  console.log(`  invalid Origin: HTTP ${status}`);

  [status, headers, payload] = await post(url, discover, http_headers_for(discover));
  let result = (payload as JsonObject)["result"] as JsonObject;
  console.log(
    `  discovery: HTTP ${status}, version=${(result["supportedVersions"] as Json[])[0]}, ` +
      `session-header=${headerOrNone(headers, "Mcp-Session-Id")}`,
  );

  const listing = make_request(2, "tools/list");
  const removed = { "Mcp-Session-Id": "ignored", "Last-Event-ID": "ignored" };
  [status, headers, payload] = await post(url, listing, http_headers_for(listing, { extra: removed }));
  result = (payload as JsonObject)["result"] as JsonObject;
  console.log(
    `  removed headers ignored: HTTP ${status}, tool=${((result["tools"] as JsonObject[])[0])["name"]}, ` +
      `echo=${headerOrNone(headers, "Mcp-Session-Id")}`,
  );

  const mismatched = http_headers_for(listing);
  mismatched["Mcp-Method"] = "tools/call";
  [status, , payload] = await post(url, listing, mismatched);
  console.log(`  header mismatch: HTTP ${status}, code=${((payload as JsonObject)["error"] as JsonObject)["code"]}`);

  const future = make_request(3, "tools/list", null, { version: "2027-01-01" });
  [status, , payload] = await post(url, future, http_headers_for(future));
  console.log(`  unsupported version: HTTP ${status}, code=${((payload as JsonObject)["error"] as JsonObject)["code"]}`);

  const notification = make_request(4, "tools/list");
  delete notification["id"];
  [status, , payload] = await post(url, notification, http_headers_for(notification));
  console.log(`  accepted notification: HTTP ${status}, empty-body=${payload === "" ? "True" : "False"}`);

  for (const method of ["GET", "DELETE"]) {
    const [code] = await rawRequest(url, method, { Origin: "http://localhost" }, null);
    if (code >= 400) console.log(`  ${method}: HTTP ${code}`);
  }

  const listen = make_request("listen-1", "subscriptions/listen", { notifications: { toolsListChanged: true } });
  const [listenStatus, , stream] = await post(url, listen, http_headers_for(listen));
  const text = String(stream);
  console.log(
    `  subscriptions/listen: HTTP ${listenStatus}, ` +
      `SSE=${text.includes("notifications/subscriptions/acknowledged") ? "True" : "False"}, ` +
      `tagged=${text.includes(SUBSCRIPTION_ID_KEY) ? "True" : "False"}`,
  );

  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

async function main(): Promise<void> {
  if (!process.argv.slice(2).includes("--serve")) {
    await probe();
    return;
  }
  const server = await serve("127.0.0.1", 8017);
  console.log("MCP 2026-07-28 endpoint: http://127.0.0.1:8017/mcp");
  process.on("SIGINT", () => {
    server.closeAllConnections();
    server.close(() => process.exit(0));
  });
}

void main();
