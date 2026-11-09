// Lesson: Building an MCP Client: Discovery, Routing, and Dual-Era Fallback (phase 13 / lesson 08)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/08-building-an-mcp-client/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/08-building-an-mcp-client/code/main.ts

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

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

function pyRepr(value: Json): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return pyStrRepr(value);
  if (Array.isArray(value)) return "[" + value.map(pyRepr).join(", ") + "]";
  return "{" + Object.keys(value).map((k) => pyStrRepr(k) + ": " + pyRepr(value[k])).join(", ") + "}";
}

function isObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function byName(a: JsonObject, b: JsonObject): number {
  const x = a["name"] as string;
  const y = b["name"] as string;
  if (x === y) return 0;
  return x < y ? -1 : 1;
}

function sortedStrings(values: Iterable<string>): string[] {
  return [...values].sort();
}

const PROTOCOL_VERSION = "2026-07-28";
const LEGACY_VERSION = "2025-11-25";
const VERSION_KEY = "io.modelcontextprotocol/protocolVersion";
const CAPABILITIES_KEY = "io.modelcontextprotocol/clientCapabilities";
const CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo";
const SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo";
const RECOGNIZED_MODERN_ERRORS = new Set([-32020, -32021, -32022]);

const CLIENT_INFO: JsonObject = { name: "lesson-08-client", version: "2.0.0" };
const CLIENT_CAPABILITIES: JsonObject = { extensions: {} };

type Transport = (message: JsonObject, timeout_ms: number | null) => JsonObject | null;

class TimeoutError extends Error {
  name = "TimeoutError";
}

class ConnectionError extends Error {
  name = "ConnectionError";
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

function request_meta(version: string, capabilities: JsonObject | null = null): JsonObject {
  return {
    [VERSION_KEY]: version,
    [CAPABILITIES_KEY]: capabilities === null ? { ...CLIENT_CAPABILITIES } : capabilities,
    [CLIENT_INFO_KEY]: { ...CLIENT_INFO },
  };
}

function modern_request(
  request_id: number | string,
  method: string,
  params: JsonObject | null,
  version: string,
  capabilities: JsonObject | null = null,
): JsonObject {
  const body_params: JsonObject = { ...(params ?? {}) };
  body_params["_meta"] = request_meta(version, capabilities);
  return { jsonrpc: "2.0", id: request_id, method, params: body_params };
}

function legacy_request(request_id: number | string, method: string, params: JsonObject | null = null): JsonObject {
  return { jsonrpc: "2.0", id: request_id, method, params: { ...(params ?? {}) } };
}

function rpc_error(request_id: Json, code: number, message: string, data: Json = null): JsonObject {
  const error: JsonObject = { code, message };
  if (data !== null) error["data"] = data;
  return { jsonrpc: "2.0", id: request_id, error };
}

function complete(
  server_info: JsonObject,
  payload: JsonObject,
  options: { ttl_ms?: number | null; cache_scope?: string } = {},
): JsonObject {
  const result: JsonObject = {
    resultType: "complete",
    ...payload,
    _meta: { [SERVER_INFO_KEY]: { ...server_info } },
  };
  const ttl_ms = options.ttl_ms ?? null;
  if (ttl_ms !== null) {
    result["ttlMs"] = ttl_ms;
    result["cacheScope"] = options.cache_scope ?? "private";
  }
  return result;
}

function decode_rpc_response(response: JsonObject, expected_id: number | string): [string, JsonObject] {
  const response_id = response["id"];
  if (
    response["jsonrpc"] !== "2.0" ||
    !(isInt(response_id) || typeof response_id === "string") ||
    typeof response_id !== typeof expected_id ||
    response_id !== expected_id
  ) {
    throw new Error("invalid JSON-RPC response envelope");
  }
  const has_result = "result" in response;
  const has_error = "error" in response;
  if (has_result === has_error) throw new Error("JSON-RPC response must contain exactly one of result or error");
  if (has_result) {
    const result = response["result"];
    if (!isObject(result)) throw new Error("JSON-RPC result must be an object");
    return ["result", result];
  }
  const error = response["error"];
  if (!isObject(error)) throw new Error("JSON-RPC error must be an object");
  if (!isInt(error["code"]) || typeof error["message"] !== "string") {
    throw new Error("JSON-RPC error requires an integer code and string message");
  }
  return ["error", error];
}

function validate_modern_request(message: JsonObject, supported: string[]): void {
  if (message["jsonrpc"] !== "2.0" || typeof message["method"] !== "string") {
    throw new RpcFault(-32600, "Invalid Request");
  }
  const params = message["params"];
  if (!isObject(params) || !isObject(params["_meta"])) throw new RpcFault(-32602, "Modern params._meta is required");
  const meta = params["_meta"];
  const requested = meta[VERSION_KEY];
  if (typeof requested !== "string") throw new RpcFault(-32602, `${VERSION_KEY} is required`);
  if (!supported.includes(requested)) {
    throw new RpcFault(-32022, "Unsupported protocol version", { requested, supported: [...supported] });
  }
  if (!isObject(meta[CAPABILITIES_KEY])) throw new RpcFault(-32602, `${CAPABILITIES_KEY} is required`);
}

class ModernFakeServer {
  server_info: JsonObject;
  tools: JsonObject[];
  capabilities: JsonObject;
  supported_versions: string[];
  received: JsonObject[] = [];
  timeouts_ms: (number | null)[] = [];

  constructor(
    name: string,
    tools: JsonObject[],
    capabilities: JsonObject | null = null,
    supported_versions: string[] | null = null,
  ) {
    this.server_info = { name, version: "2.0.0" };
    this.tools = [...tools].sort(byName);
    this.capabilities =
      capabilities && Object.keys(capabilities).length > 0 ? capabilities : { tools: { listChanged: false } };
    this.supported_versions =
      supported_versions && supported_versions.length > 0 ? supported_versions : [PROTOCOL_VERSION];
  }

  call(message: JsonObject, timeout_ms: number | null = null): JsonObject | null {
    this.received.push(message);
    this.timeouts_ms.push(timeout_ms);
    if (!("id" in message)) return null;
    const request_id = message["id"];
    try {
      validate_modern_request(message, this.supported_versions);
      const method = message["method"] as string;
      const params = message["params"] as JsonObject;
      let result: JsonObject;
      if (method === "server/discover") {
        result = complete(
          this.server_info,
          {
            supportedVersions: [...this.supported_versions],
            capabilities: { ...this.capabilities },
            instructions: `Tools provided by ${this.server_info["name"]}.`,
          },
          { ttl_ms: 3_600_000, cache_scope: "public" },
        );
      } else if (method === "tools/list") {
        result = complete(this.server_info, { tools: [...this.tools] }, { ttl_ms: 30_000, cache_scope: "public" });
      } else if (method === "tools/call") {
        const name = params["name"];
        if (typeof name !== "string") throw new RpcFault(-32602, "tools/call requires name");
        const declared = new Set(this.tools.map((tool) => tool["name"]));
        result = complete(this.server_info, {
          content: [
            {
              type: "text",
              text: declared.has(name) ? `[${this.server_info["name"]}] ${name} ran` : `Unknown tool: ${name}`,
            },
          ],
          isError: !declared.has(name),
        });
      } else {
        throw new RpcFault(-32601, `Method not found: ${method}`);
      }
      return { jsonrpc: "2.0", id: request_id, result };
    } catch (exc) {
      if (exc instanceof RpcFault) return rpc_error(request_id, exc.code, exc.message, exc.data);
      throw exc;
    }
  }
}

class LegacyFakeServer {
  tools: JsonObject[];
  initialized = false;
  received: JsonObject[] = [];
  timeouts_ms: (number | null)[] = [];

  constructor(
    public name: string,
    tools: JsonObject[],
  ) {
    this.tools = [...tools].sort(byName);
  }

  call(message: JsonObject, timeout_ms: number | null = null): JsonObject | null {
    this.received.push(message);
    this.timeouts_ms.push(timeout_ms);
    const method = message["method"];
    const id = message["id"] ?? null;
    if (method === "server/discover") return rpc_error(id, -32601, "Method not found");
    if (method === "initialize") {
      this.initialized = true;
      return {
        jsonrpc: "2.0",
        id: message["id"],
        result: {
          protocolVersion: LEGACY_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: this.name, version: "1.0.0" },
        },
      };
    }
    if (method === "notifications/initialized") return null;
    if (!this.initialized) return rpc_error(id, -32002, "Server not initialized");
    if (method === "tools/list") return { jsonrpc: "2.0", id: message["id"], result: { tools: [...this.tools] } };
    if (method === "tools/call") {
      const name = ((message["params"] ?? {}) as JsonObject)["name"];
      return {
        jsonrpc: "2.0",
        id: message["id"],
        result: {
          content: [{ type: "text", text: `[${this.name}/legacy] ${name ?? "None"} ran` }],
          isError: false,
        },
      };
    }
    return rpc_error(id, -32601, `Method not found: ${method ?? "None"}`);
  }
}

class Peer {
  era = "unknown";
  protocol_version: string | null = null;
  capabilities: JsonObject = {};
  server_info: JsonObject = {};
  tools: JsonObject[] = [];
  available = false;

  constructor(
    public name: string,
    public transport: Transport,
    public allow_legacy: boolean = false,
  ) {}
}

class MergedTool {
  constructor(
    readonly canonical_name: string,
    readonly peer_name: string,
    readonly local_name: string,
    readonly description: string,
  ) {}
}

type ClientOptions = {
  supported_modern?: string[];
  supported_legacy?: string[];
  probe_version?: string | null;
  discovery_timeout_ms?: number;
  legacy_probe_timeout_ms?: number;
};

class MultiServerClient {
  supported_modern: string[];
  supported_legacy: string[];
  probe_version: string;
  discovery_timeout_ms: number;
  legacy_probe_timeout_ms: number;
  client_capabilities: JsonObject;
  peers: Map<string, Peer> = new Map();
  registry: Map<string, MergedTool> = new Map();
  private _next_request_id = 1;

  constructor(options: ClientOptions = {}) {
    const supported_modern = options.supported_modern ?? [PROTOCOL_VERSION];
    const supported_legacy = options.supported_legacy ?? [LEGACY_VERSION];
    const discovery_timeout_ms = options.discovery_timeout_ms ?? 1_000;
    const legacy_probe_timeout_ms = options.legacy_probe_timeout_ms ?? 1_000;
    if (supported_modern.length === 0 || supported_legacy.length === 0) {
      throw new Error("at least one modern and legacy version must be configured");
    }
    if (discovery_timeout_ms <= 0 || legacy_probe_timeout_ms <= 0) throw new Error("probe timeouts must be positive");
    this.supported_modern = supported_modern;
    this.supported_legacy = supported_legacy;
    this.probe_version = options.probe_version || supported_modern[0];
    this.discovery_timeout_ms = discovery_timeout_ms;
    this.legacy_probe_timeout_ms = legacy_probe_timeout_ms;
    this.client_capabilities = { ...CLIENT_CAPABILITIES };
  }

  private _new_id(): number {
    const request_id = this._next_request_id;
    this._next_request_id += 1;
    return request_id;
  }

  add_server(name: string, transport: Transport, options: { allow_legacy?: boolean } = {}): void {
    this.peers.set(name, new Peer(name, transport, options.allow_legacy ?? false));
  }

  private static _send(peer: Peer, message: JsonObject, timeout_ms: number | null = null): JsonObject | null {
    return peer.transport(message, timeout_ms);
  }

  private _mutual_version(advertised: Json[]): string | null {
    const common = advertised.filter(
      (version): version is string => typeof version === "string" && this.supported_modern.includes(version),
    );
    return common.length > 0 ? sortedStrings(common).reverse()[0] : null;
  }

  private _activate_modern(peer: Peer, result: JsonObject, version: string): void {
    if (result["resultType"] !== "complete") throw new Error(`${peer.name}: modern discovery omitted resultType`);
    peer.era = "modern";
    peer.protocol_version = version;
    peer.capabilities = (result["capabilities"] ?? {}) as JsonObject;
    peer.server_info = (((result["_meta"] ?? {}) as JsonObject)[SERVER_INFO_KEY] ?? {}) as JsonObject;
    peer.available = true;
  }

  private _probe_legacy(peer: Peer, trigger: string): void {
    if (!peer.allow_legacy) throw new Error(`${peer.name}: ${trigger}; legacy compatibility is not allowlisted`);
    const request_id = this._new_id();
    const initialize = legacy_request(request_id, "initialize", {
      protocolVersion: this.supported_legacy[0],
      capabilities: { ...this.client_capabilities },
      clientInfo: { ...CLIENT_INFO },
    });
    let response: JsonObject | null;
    try {
      response = MultiServerClient._send(peer, initialize, this.legacy_probe_timeout_ms);
    } catch (exc) {
      if (exc instanceof TimeoutError || exc instanceof ConnectionError) {
        throw new Error(`${peer.name}: bounded legacy probe failed closed`, { cause: exc });
      }
      throw exc;
    }
    if (!isObject(response)) throw new Error(`${peer.name}: bounded legacy probe returned no result`);
    const [kind, payload] = decode_rpc_response(response, request_id);
    if (kind !== "result") throw new Error(`${peer.name}: legacy initialize returned an error`);
    const result = payload;
    const version = result["protocolVersion"];
    const capabilities = result["capabilities"];
    const server_info = result["serverInfo"];
    const valid_server_info =
      isObject(server_info) &&
      typeof server_info["name"] === "string" &&
      Boolean(server_info["name"]) &&
      typeof server_info["version"] === "string" &&
      Boolean(server_info["version"]);
    if (typeof version !== "string" || !this.supported_legacy.includes(version)) {
      throw new Error(`${peer.name}: unsupported legacy protocol revision`);
    }
    if (!isObject(capabilities) || !valid_server_info) throw new Error(`${peer.name}: malformed legacy initialize result`);
    peer.era = "legacy";
    peer.protocol_version = version;
    peer.capabilities = capabilities;
    peer.server_info = server_info;
    peer.available = true;
    MultiServerClient._send(peer, { jsonrpc: "2.0", method: "notifications/initialized", params: {} });
  }

  private _connect_peer(peer: Peer): void {
    if (peer.available && (peer.era === "modern" || peer.era === "legacy")) return;
    const request_id = this._new_id();
    const probe = modern_request(request_id, "server/discover", {}, this.probe_version, this.client_capabilities);
    let response: JsonObject | null;
    try {
      response = MultiServerClient._send(peer, probe, this.discovery_timeout_ms);
    } catch (exc) {
      if (exc instanceof TimeoutError || exc instanceof ConnectionError) {
        this._probe_legacy(peer, exc.name);
        return;
      }
      throw exc;
    }

    if (response === null) {
      this._probe_legacy(peer, "empty discovery response");
      return;
    }
    if (!isObject(response)) throw new Error(`${peer.name}: malformed discovery response`);
    const [kind, payload] = decode_rpc_response(response, request_id);
    if (kind === "result") {
      const advertised = payload["supportedVersions"] ?? [];
      if (!Array.isArray(advertised) || !advertised.every((version) => typeof version === "string")) {
        throw new Error(`${peer.name}: malformed modern discovery result`);
      }
      const selected = this._mutual_version(advertised);
      if (selected === null) throw new Error(`${peer.name}: no mutually supported modern version`);
      this._activate_modern(peer, payload, selected);
      return;
    }

    const code = payload["code"] as number;
    if (RECOGNIZED_MODERN_ERRORS.has(code)) {
      if (code !== -32022) throw new Error(`${peer.name}: correct modern request error ${code} before retrying`);
      const data = payload["data"];
      const advertised = isObject(data) ? ((data["supported"] ?? []) as Json[]) : [];
      const selected = this._mutual_version(advertised);
      if (selected === null) throw new Error(`${peer.name}: no mutually supported modern version`);
      const retry_id = this._new_id();
      const retry = modern_request(retry_id, "server/discover", {}, selected, this.client_capabilities);
      let retried: JsonObject | null;
      try {
        retried = MultiServerClient._send(peer, retry, this.discovery_timeout_ms);
      } catch (exc) {
        if (exc instanceof TimeoutError || exc instanceof ConnectionError) {
          throw new Error(`${peer.name}: proven-modern discovery retry failed`, { cause: exc });
        }
        throw exc;
      }
      if (!isObject(retried)) throw new Error(`${peer.name}: proven-modern discovery retry returned no result`);
      const [retry_kind, retry_payload] = decode_rpc_response(retried, retry_id);
      if (retry_kind !== "result") throw new Error(`${peer.name}: proven-modern discovery retry returned an error`);
      this._activate_modern(peer, retry_payload, selected);
      return;
    }

    this._probe_legacy(peer, `unrecognized discovery error ${code}`);
  }

  connect_all(): void {
    for (const peer_name of sortedStrings(this.peers.keys())) this._connect_peer(this.peers.get(peer_name) as Peer);
  }

  private _request(peer: Peer, method: string, params: JsonObject): JsonObject {
    const request_id = this._new_id();
    let message: JsonObject;
    if (peer.era === "modern") {
      message = modern_request(
        request_id,
        method,
        params,
        peer.protocol_version || PROTOCOL_VERSION,
        this.client_capabilities,
      );
    } else if (peer.era === "legacy") {
      message = legacy_request(request_id, method, params);
    } else {
      throw new Error(`${peer.name}: protocol era not selected`);
    }
    const response = MultiServerClient._send(peer, message);
    if (!isObject(response)) throw new Error(`${peer.name}: missing response`);
    const [kind, payload] = decode_rpc_response(response, request_id);
    if (kind !== "result") throw new Error(`${peer.name}: RPC error ${pyRepr(payload)}`);
    const result: JsonObject = { ...payload };
    if (peer.era === "modern" && !("resultType" in result)) throw new Error(`${peer.name}: modern result omitted resultType`);
    if (peer.era === "legacy" && !("resultType" in result)) result["resultType"] = "complete";
    return result;
  }

  discover_tools(): void {
    for (const peer_name of sortedStrings(this.peers.keys())) {
      const peer = this.peers.get(peer_name) as Peer;
      if (peer.available) {
        const result = this._request(peer, "tools/list", {});
        peer.tools = [...((result["tools"] ?? []) as JsonObject[])].sort(byName);
      }
    }
  }

  merge(policy: string = "prefix-on-collision"): void {
    if (policy !== "prefix-on-collision" && policy !== "reject") {
      throw new Error("policy must be prefix-on-collision or reject");
    }
    this.registry.clear();
    for (const peer_name of sortedStrings(this.peers.keys())) {
      const peer = this.peers.get(peer_name) as Peer;
      for (const tool of peer.tools) {
        const local_name = tool["name"] as string;
        let canonical_name = local_name;
        if (this.registry.has(canonical_name)) {
          if (policy === "reject") continue;
          canonical_name = `${peer.name}/${local_name}`;
          if (this.registry.has(canonical_name)) throw new Error(`canonical collision: ${canonical_name}`);
        }
        this.registry.set(
          canonical_name,
          new MergedTool(canonical_name, peer.name, local_name, (tool["description"] ?? "") as string),
        );
      }
    }
    this.registry = new Map(sortedStrings(this.registry.keys()).map((k) => [k, this.registry.get(k) as MergedTool]));
  }

  call(canonical_name: string, args: JsonObject): JsonObject {
    const merged = this.registry.get(canonical_name);
    if (merged === undefined) {
      return {
        resultType: "complete",
        content: [{ type: "text", text: `Unknown tool: ${canonical_name}` }],
        isError: true,
      };
    }
    const peer = this.peers.get(merged.peer_name) as Peer;
    if (!peer.available) {
      return {
        resultType: "complete",
        content: [{ type: "text", text: `Transport unavailable: ${peer.name}` }],
        isError: true,
      };
    }
    return this._request(peer, "tools/call", { name: merged.local_name, arguments: args });
  }
}

function tool(name: string, description: string): JsonObject {
  return {
    name,
    description,
    inputSchema: { type: "object", properties: {}, required: [] },
  };
}

function main(): void {
  const notes = new ModernFakeServer("notes", [tool("search", "Search notes"), tool("create", "Create note")]);
  const files = new ModernFakeServer("files", [tool("search", "Search files"), tool("read", "Read file")]);
  const archive = new LegacyFakeServer("archive", [tool("search", "Search archive"), tool("restore", "Restore item")]);

  const client = new MultiServerClient();
  client.add_server("notes", (m, t) => notes.call(m, t));
  client.add_server("files", (m, t) => files.call(m, t));
  client.add_server("archive", (m, t) => archive.call(m, t), { allow_legacy: true });

  client.connect_all();
  client.discover_tools();
  client.merge();

  console.log("MCP client peers");
  for (const peer_name of sortedStrings(client.peers.keys())) {
    const peer = client.peers.get(peer_name) as Peer;
    console.log(`  ${peer_name.padEnd(8)} era=${peer.era.padEnd(6)} version=${peer.protocol_version ?? "None"}`);
  }
  console.log("\nMerged tools");
  for (const [canonical_name, merged] of client.registry) {
    console.log(`  ${canonical_name.padEnd(20)} -> ${merged.peer_name}:${merged.local_name}`);
  }
  console.log("\nCalls");
  for (const name of ["create", "read", "notes/search", "search", "restore"]) {
    const result = client.call(name, {});
    const content = result["content"] as JsonObject[];
    console.log(`  ${name.padEnd(20)} -> ${content[0]["text"]}`);
  }
  console.log("\nNo modern protocol sessions were created.");
}

main();

export {};
