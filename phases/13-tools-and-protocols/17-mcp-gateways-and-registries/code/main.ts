// Lesson: Stateless MCP Gateways and Registry Admission (phase 13 / lesson 17)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/17-mcp-gateways-and-registries/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/17-mcp-gateways-and-registries/code/main.ts

import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

type Dict = { [key: string]: any };
type Headers = { [key: string]: string };

const PROTOCOL_VERSION = "2026-07-28";
const PROTOCOL_META = "io.modelcontextprotocol/protocolVersion";
const CLIENT_CAPABILITIES_META = "io.modelcontextprotocol/clientCapabilities";
const CLIENT_INFO_META = "io.modelcontextprotocol/clientInfo";
const SERVER_INFO_META = "io.modelcontextprotocol/serverInfo";
const SUBSCRIPTION_ID_META = "io.modelcontextprotocol/subscriptionId";
const NAMED_METHODS = new Set([
  "tools/call",
  "resources/read",
  "prompts/get",
  "tasks/get",
  "tasks/update",
  "tasks/cancel",
]);

const USERS: { [key: string]: { id: string; role: string } } = {
  "bearer-alice": { id: "alice", role: "developer" },
  "bearer-bob": { id: "bob", role: "auditor" },
};

const RBAC: { [key: string]: Set<string> } = {
  alice: new Set(["notes.search", "notes.create", "issues.list", "issues.open"]),
  bob: new Set(["notes.search", "issues.list"]),
};

const REGISTRY_SERVER_JSON: { [key: string]: Dict } = {
  notes: {
    $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    name: "com.example/notes",
    description: "Example notes MCP server.",
    version: "1.0.0",
    packages: [
      {
        registryType: "npm",
        identifier: "@example/notes-mcp",
        version: "1.0.0",
        transport: { type: "stdio" },
      },
    ],
  },
  issues: {
    $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    name: "com.example/issues",
    description: "Example issues MCP server.",
    version: "1.0.0",
    packages: [
      {
        registryType: "npm",
        identifier: "@example/issues-mcp",
        version: "1.0.0",
        transport: { type: "stdio" },
      },
    ],
  },
};

const VERIFIED_ADMISSION_STATE: { [key: string]: Dict } = {
  notes: {
    registryName: "com.example/notes",
    registryVersion: "1.0.0",
    publisher: { namespace: "com.example", status: "verified" },
    provenance: {
      source: "registry.modelcontextprotocol.io",
      recordId: "com.example/notes@1.0.0",
    },
    admission: { status: "approved", reviewedBy: "gateway-policy" },
  },
  issues: {
    registryName: "com.example/issues",
    registryVersion: "1.0.0",
    publisher: { namespace: "com.example", status: "verified" },
    provenance: {
      source: "registry.modelcontextprotocol.io",
      recordId: "com.example/issues@1.0.0",
    },
    admission: { status: "approved", reviewedBy: "gateway-policy" },
  },
};

function pyJsonString(s: string): string {
  return JSON.stringify(s).replace(/[\u0080-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

function pyDumps(value: any, sortKeys = false, compact = false): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return pyJsonString(value);
  const itemSep = compact ? "," : ", ";
  const keySep = compact ? ":" : ": ";
  if (Array.isArray(value)) return "[" + value.map((v) => pyDumps(v, sortKeys, compact)).join(itemSep) + "]";
  let keys = Object.keys(value);
  if (sortKeys) keys = [...keys].sort();
  return "{" + keys.map((k) => pyJsonString(k) + keySep + pyDumps(value[k], sortKeys, compact)).join(itemSep) + "}";
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
    else if (c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f) out += "\\x" + c.charCodeAt(0).toString(16).padStart(2, "0");
    else out += c;
  }
  return quote + out + quote;
}

function pyRepr(value: any): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return pyStrRepr(value);
  if (Array.isArray(value)) return "[" + value.map(pyRepr).join(", ") + "]";
  return "{" + Object.keys(value).map((k) => pyStrRepr(k) + ": " + pyRepr(value[k])).join(", ") + "}";
}

function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function byName(a: Dict, b: Dict): number {
  return a["name"] < b["name"] ? -1 : a["name"] > b["name"] ? 1 : 0;
}

class KeyError extends Error {}
class ValueError extends Error {}

class ProtocolError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data: Dict | null = null,
  ) {
    super(message);
  }
}

function splitCanonical(canonical: string): [string, string] {
  const at = canonical.indexOf(".");
  if (at < 0) throw new ValueError("not enough values to unpack");
  return [canonical.slice(0, at), canonical.slice(at + 1)];
}

function request_meta(client_name = "gateway-client"): Dict {
  return {
    [PROTOCOL_META]: PROTOCOL_VERSION,
    [CLIENT_CAPABILITIES_META]: {},
    [CLIENT_INFO_META]: { name: client_name, version: "1.0.0" },
  };
}

function request_name(method: string, params: Dict): any {
  if (method === "tasks/get" || method === "tasks/update" || method === "tasks/cancel") {
    return params["taskId"] ?? null;
  }
  return params["name"] || params["uri"] || null;
}

function make_request(method: string, request_id: any, params: Dict | null = null, client_name = "gateway-client"): [Dict, Headers] {
  const wire_params: Dict = { ...(params ?? {}) };
  wire_params["_meta"] = request_meta(client_name);
  const body = { jsonrpc: "2.0", id: request_id, method, params: wire_params };
  const headers: Headers = { "MCP-Protocol-Version": PROTOCOL_VERSION, "Mcp-Method": method };
  if (NAMED_METHODS.has(method)) {
    const name = request_name(method, wire_params);
    headers["Mcp-Name"] = name ? String(name) : "";
  }
  return [body, headers];
}

function descriptor_digest(tool: Dict): string {
  const canonical = pyDumps(tool, true, true);
  return createHash("sha256").update(canonical).digest("hex");
}

function registry_record_is_admissible(record: Dict, admission: Dict, namespace = "com.example/"): boolean {
  const packages = record["packages"];
  const package_shapes_are_valid =
    Array.isArray(packages) &&
    packages.length > 0 &&
    packages.every(
      (pkg) =>
        isDict(pkg) &&
        typeof pkg["registryType"] === "string" &&
        typeof pkg["identifier"] === "string" &&
        typeof pkg["version"] === "string" &&
        isDict(pkg["transport"]) &&
        pkg["transport"]["type"] === "stdio",
    );
  return Boolean(
    typeof record["name"] === "string" &&
      record["name"].startsWith(namespace) &&
      typeof record["description"] === "string" &&
      record["version"] === admission["registryVersion"] &&
      record["name"] === admission["registryName"] &&
      package_shapes_are_valid &&
      (admission["publisher"] ?? {})["namespace"] === "com.example" &&
      (admission["publisher"] ?? {})["status"] === "verified" &&
      (admission["provenance"] ?? {})["source"] === "registry.modelcontextprotocol.io" &&
      (admission["admission"] ?? {})["status"] === "approved",
  );
}

function validate_wire(body: Dict, headers: Headers): Dict {
  if (body["jsonrpc"] !== "2.0") throw new ProtocolError(-32600, "Invalid Request");
  const method = body["method"];
  const params = body["params"];
  if (typeof method !== "string" || !isDict(params)) throw new ProtocolError(-32600, "Invalid Request");
  const meta = params["_meta"];
  if (!isDict(meta)) throw new ProtocolError(-32602, "params._meta is required");
  const requested_version = meta[PROTOCOL_META];
  if (typeof requested_version !== "string") throw new ProtocolError(-32602, "protocolVersion must be a string");
  if (!isDict(meta[CLIENT_CAPABILITIES_META])) throw new ProtocolError(-32602, "clientCapabilities is required");
  if (headers["MCP-Protocol-Version"] !== requested_version) {
    throw new ProtocolError(-32020, "MCP-Protocol-Version header mismatch");
  }
  if (headers["Mcp-Method"] !== method) throw new ProtocolError(-32020, "Mcp-Method header mismatch");
  const expected_name = request_name(method, params);
  if (NAMED_METHODS.has(method) && (headers["Mcp-Name"] ?? null) !== expected_name) {
    throw new ProtocolError(-32020, "Mcp-Name header mismatch");
  }
  if (requested_version !== PROTOCOL_VERSION) {
    throw new ProtocolError(-32022, "Unsupported protocol version", {
      supported: [PROTOCOL_VERSION],
      requested: requested_version,
    });
  }
  return params;
}

class BackendServer {
  name: string;
  tools: Dict[];

  constructor(name: string, tools: Dict[]) {
    this.name = name;
    this.tools = JSON.parse(JSON.stringify(tools));
  }

  _success(request_id: any, result: Dict): Dict {
    const payload: Dict = { ...result };
    if (!("resultType" in payload)) payload["resultType"] = "complete";
    if (!("_meta" in payload)) payload["_meta"] = {};
    payload["_meta"][SERVER_INFO_META] = { name: this.name, version: "2.0.0" };
    return { jsonrpc: "2.0", id: request_id, result: payload };
  }

  handle(body: Dict, headers: Headers): Dict {
    const params = validate_wire(body, headers);
    let result: Dict;
    if (body["method"] === "server/discover") {
      result = {
        supportedVersions: [PROTOCOL_VERSION],
        capabilities: { tools: { listChanged: true } },
        ttlMs: 60_000,
        cacheScope: "public",
      };
    } else if (body["method"] === "tools/list") {
      result = {
        tools: [...this.tools].sort(byName),
        ttlMs: 30_000,
        cacheScope: "public",
      };
    } else if (body["method"] === "tools/call") {
      const tool = this.tools.find((item) => item["name"] === params["name"]);
      if (tool === undefined) throw new ProtocolError(-32601, "Tool not found");
      result = {
        content: [{ type: "text", text: `${this.name}.${tool["name"]} completed` }],
        isError: false,
      };
    } else {
      throw new ProtocolError(-32601, "Method not found");
    }
    return this._success(body["id"] ?? null, result);
  }
}

function monotonic(): number {
  return performance.now() / 1000;
}

class TokenBucket {
  capacity: number;
  refill_per_second: number;
  tokens: number;
  updated_at: number;

  constructor(capacity = 5, refill_per_second = 1.0, tokens = 5.0, updated_at: number = monotonic()) {
    this.capacity = capacity;
    this.refill_per_second = refill_per_second;
    this.tokens = tokens;
    this.updated_at = updated_at;
  }

  consume(now: number | null = null): boolean {
    const current = now === null ? monotonic() : now;
    this.tokens = Math.min(this.capacity, this.tokens + Math.max(0.0, current - this.updated_at) * this.refill_per_second);
    this.updated_at = current;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

class Gateway {
  backends: { [key: string]: BackendServer };
  pins: { [key: string]: string };
  buckets: { [key: string]: TokenBucket } = {};
  audit: Dict[] = [];
  forwarded_request_ids: string[] = [];

  constructor() {
    this.backends = {
      notes: new BackendServer("notes", [
        {
          name: "search",
          description: "Search approved notes.",
          inputSchema: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
          },
        },
        {
          name: "create",
          description: "Create a note.",
          inputSchema: {
            type: "object",
            properties: { title: { type: "string" } },
            required: ["title"],
          },
        },
      ]),
      issues: new BackendServer("issues", [
        {
          name: "list",
          description: "List tracked issues.",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "open",
          description: "Open an issue.",
          inputSchema: {
            type: "object",
            properties: { id: { type: "string" } },
            required: ["id"],
          },
        },
      ]),
    };
    this.pins = {};
    for (const [server_name, backend] of Object.entries(this.backends)) {
      for (const tool of backend.tools) {
        this.pins[`${server_name}.${tool["name"]}`] = descriptor_digest(tool);
      }
    }
  }

  static _success(request_id: any, result: Dict): Dict {
    const payload: Dict = { ...result };
    if (!("resultType" in payload)) payload["resultType"] = "complete";
    if (!("_meta" in payload)) payload["_meta"] = {};
    payload["_meta"][SERVER_INFO_META] = { name: "enterprise-gateway", version: "2.0.0" };
    return { jsonrpc: "2.0", id: request_id, result: payload };
  }

  static _error(request_id: any, error: ProtocolError): Dict {
    const payload: Dict = { code: error.code, message: error.message };
    if (error.data !== null) payload["data"] = error.data;
    return { jsonrpc: "2.0", id: request_id ?? null, error: payload };
  }

  static _error_status(error: ProtocolError): number {
    return error.code === -32601 ? 404 : 400;
  }

  _is_pinned(canonical_name: string, tool: Dict): boolean {
    const expected = this.pins[canonical_name];
    return expected !== undefined && expected === descriptor_digest(tool);
  }

  _visible_tools(user_id: string): Dict[] {
    const visible: Dict[] = [];
    for (const [server_name, backend] of Object.entries(this.backends)) {
      if (!registry_record_is_admissible(REGISTRY_SERVER_JSON[server_name], VERIFIED_ADMISSION_STATE[server_name])) {
        continue;
      }
      for (const tool of backend.tools) {
        const canonical = `${server_name}.${tool["name"]}`;
        if ((RBAC[user_id] ?? new Set()).has(canonical) && this._is_pinned(canonical, tool)) {
          visible.push({ ...tool, name: canonical });
        }
      }
    }
    return visible.sort(byName);
  }

  _forward(canonical_name: string, args: Dict): Dict {
    const [server_name, tool_name] = splitCanonical(canonical_name);
    const backend = this.backends[server_name];
    if (backend === undefined) throw new KeyError(server_name);
    const forwarded_id = `gw-${this.forwarded_request_ids.length + 1}`;
    this.forwarded_request_ids.push(forwarded_id);
    const [body, headers] = make_request("tools/call", forwarded_id, { name: tool_name, arguments: args }, "enterprise-gateway");
    return backend.handle(body, headers)["result"];
  }

  handle(
    bearer: string,
    body: Dict,
    headers: Headers,
    http_method = "POST",
    accept = "application/json, text/event-stream",
  ): [number, Dict | null] {
    if (http_method !== "POST") return [405, null];
    const is_notification = !("id" in body);
    const user = USERS[bearer];
    if (user === undefined) {
      if (is_notification) return [401, null];
      return [401, Gateway._error(body["id"], new ProtocolError(-32001, "Unauthenticated"))];
    }
    try {
      const params = validate_wire(body, headers);
      const method = body["method"];
      let result: Dict;
      if (method === "server/discover") {
        result = {
          supportedVersions: [PROTOCOL_VERSION],
          capabilities: { tools: { listChanged: true } },
          ttlMs: 30_000,
          cacheScope: "private",
        };
      } else if (method === "tools/list") {
        result = {
          tools: this._visible_tools(user.id),
          ttlMs: 10_000,
          cacheScope: "private",
        };
      } else if (method === "tools/call") {
        const canonical = String(params["name"] ?? "");
        if (!(RBAC[user.id] ?? new Set()).has(canonical)) {
          this.audit.push({ principal: user.id, tool: canonical, decision: "deny" });
          throw new ProtocolError(-32003, "Forbidden", { tool: canonical });
        }
        if (!(user.id in this.buckets)) this.buckets[user.id] = new TokenBucket();
        const bucket = this.buckets[user.id];
        if (!bucket.consume()) {
          this.audit.push({ principal: user.id, tool: canonical, decision: "rate_limit" });
          if (is_notification) return [429, null];
          return [429, Gateway._error(body["id"], new ProtocolError(-32029, "Rate limited"))];
        }
        const [server_name, tool_name] = splitCanonical(canonical);
        const backend = this.backends[server_name];
        if (backend === undefined) throw new KeyError(server_name);
        const tool = backend.tools.find((item) => item["name"] === tool_name);
        if (tool === undefined || !this._is_pinned(canonical, tool)) {
          this.audit.push({ principal: user.id, tool: canonical, decision: "pin_mismatch" });
          if (is_notification) return [409, null];
          return [409, Gateway._error(body["id"], new ProtocolError(-32010, "Descriptor changed", { tool: canonical }))];
        }
        const backend_result = this._forward(canonical, "arguments" in params ? params["arguments"] : {});
        result = {};
        for (const [key, value] of Object.entries(backend_result)) {
          if (key !== "_meta") result[key] = value;
        }
        this.audit.push({ principal: user.id, tool: canonical, decision: "allow" });
      } else if (method === "subscriptions/listen") {
        if (!accept.includes("text/event-stream")) {
          if (is_notification) return [406, null];
          return [406, Gateway._error(body["id"], new ProtocolError(-32602, "subscriptions/listen requires an SSE response"))];
        }
        const requested = "notifications" in params ? params["notifications"] : {};
        if (!isDict(requested)) throw new ProtocolError(-32602, "notifications must be an object");
        const honored: Dict = {};
        if (requested["toolsListChanged"] === true) honored["toolsListChanged"] = true;
        if (is_notification) return [202, null];
        return [
          200,
          {
            contentType: "text/event-stream",
            events: [
              {
                jsonrpc: "2.0",
                method: "notifications/subscriptions/acknowledged",
                params: {
                  _meta: { [SUBSCRIPTION_ID_META]: body["id"] ?? null },
                  notifications: honored,
                },
              },
            ],
          },
        ];
      } else {
        throw new ProtocolError(-32601, "Method not found");
      }
      if (is_notification) return [202, null];
      return [200, Gateway._success(body["id"], result)];
    } catch (error) {
      if (error instanceof KeyError || error instanceof ValueError) {
        if (is_notification) return [400, null];
        return [400, Gateway._error(body["id"], new ProtocolError(-32602, "Invalid params"))];
      }
      if (error instanceof ProtocolError) {
        const status = error.code === -32003 ? 403 : Gateway._error_status(error);
        if (is_notification) return [status, null];
        return [status, Gateway._error(body["id"], error)];
      }
      throw error;
    }
  }
}

function demo(): void {
  const gateway = new Gateway();
  const requests: [string, Dict][] = [
    ["server/discover", {}],
    ["tools/list", {}],
    ["tools/call", { name: "notes.search", arguments: { query: "stateless" } }],
    ["subscriptions/listen", { notifications: { toolsListChanged: true } }],
  ];
  requests.forEach(([method, params], index) => {
    const request_id = index + 1;
    const [body, headers] = make_request(method, request_id, params);
    const [status, response] = gateway.handle("bearer-alice", body, headers);
    console.log(status, method, [...pyDumps(response)].slice(0, 260).join(""));
  });
  console.log("forwarded request ids:", pyRepr(gateway.forwarded_request_ids));
  console.log("audit:", pyRepr(gateway.audit));
}

demo();
