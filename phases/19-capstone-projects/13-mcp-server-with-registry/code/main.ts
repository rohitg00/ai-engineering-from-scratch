// Lesson: Capstone 13: Stateless MCP Server with Registry and Governance (phase 19 / lesson 13)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/13-mcp-server-with-registry/docs/en.md
// Run: npx tsx phases/19-capstone-projects/13-mcp-server-with-registry/code/main.ts

import { createHash } from "node:crypto";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

const PROTOCOL_VERSION = "2026-07-28";
const REGISTRY_SCHEMA = "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json";
const PUBLISHER_DOMAIN = "example.com";
const SERVER_NAME_RE = /^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/;
const DOMAIN_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const REMOTE_URL_RE = /^https?:\/\/\S+$/;
const VERSION_RANGE_RE = /(?:^[~^<>=]|[*]|(?:^|\.)x(?:$|\.))/i;

function pyStr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + ch;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\r") out += "\\r";
    else out += ch;
  }
  return out + quote;
}

function pyRepr(v: Json): string {
  if (v === null) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return pyStr(v);
  if (Array.isArray(v)) return "[" + v.map(pyRepr).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `${pyStr(k)}: ${pyRepr(x)}`).join(", ") + "}";
}

function sortKeysDeep(v: Json): Json {
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  if (isObj(v)) {
    const out: Obj = {};
    for (const k of Object.keys(v).sort()) out[k] = sortKeysDeep(v[k]);
    return out;
  }
  return v;
}

function jsonDumps(v: Json, sortKeys = false): string {
  if (sortKeys) return jsonDumps(sortKeysDeep(v));
  if (v === null || typeof v !== "object") {
    return JSON.stringify(v).replace(/[\u007f-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  }
  if (Array.isArray(v)) return "[" + v.map((x) => jsonDumps(x)).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `${jsonDumps(k)}: ${jsonDumps(x)}`).join(", ") + "}";
}

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pyLen(s: string): number {
  return [...s].length;
}

function now(): number {
  return Date.now() / 1000;
}

function requestMeta(): Obj {
  return {
    "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
    "io.modelcontextprotocol/clientCapabilities": {},
    "io.modelcontextprotocol/clientInfo": {
      name: "registry-capstone-client",
      version: "1.0.0",
    },
  };
}

function error(code: number, message: string, data: Obj | null = null): Obj {
  const detail: Obj = { code, message };
  if (data !== null) detail.data = data;
  return { error: detail };
}

function validateMeta(meta: unknown): Obj | null {
  if (!isObj(meta)) return error(-32602, "params._meta must be an object");
  const requested = meta["io.modelcontextprotocol/protocolVersion"];
  if (typeof requested !== "string") return error(-32602, "protocolVersion must be a string");
  if (requested !== PROTOCOL_VERSION) {
    return error(
      -32022,
      "Unsupported protocol version",
      { supported: [PROTOCOL_VERSION], requested },
    );
  }
  if (!isObj(meta["io.modelcontextprotocol/clientCapabilities"])) {
    return error(-32602, "clientCapabilities must be an object");
  }
  return null;
}

interface ToolSchema {
  readonly name: string;
  readonly requiredScope: string;
  readonly destructive: boolean;
  readonly description: string;
  readonly inputSchema: Obj;
}

function toolSchema(name: string, requiredScope: string, destructive: boolean, description: string, inputSchema: Obj): ToolSchema {
  return { name, requiredScope, destructive, description, inputSchema };
}

type Handler = (args: Obj) => Obj;

class MCPServer {
  tools: Map<string, ToolSchema> = new Map();
  handlers: Map<string, Handler> = new Map();

  constructor(
    public name: string,
    public title: string,
    public description: string,
    public version: string,
    public url: string,
    public trustedIssuer: string,
  ) {}

  get serverInfo(): Obj {
    return { name: this.name, version: this.version };
  }

  register(schema: ToolSchema, handler: Handler): void {
    if (this.tools.has(schema.name)) throw new Error(`duplicate tool: ${schema.name}`);
    this.tools.set(schema.name, schema);
    this.handlers.set(schema.name, handler);
  }

  result(fields: Obj): Obj {
    return {
      resultType: "complete",
      ...fields,
      _meta: { "io.modelcontextprotocol/serverInfo": this.serverInfo },
    };
  }

  discover(meta: Obj): Obj {
    const invalid = validateMeta(meta);
    if (invalid) return invalid;
    return this.result({
      supportedVersions: [PROTOCOL_VERSION],
      capabilities: { tools: { listChanged: false } },
      ttlMs: 3_600_000,
      cacheScope: "public",
    });
  }

  toolsList(meta: Obj): Obj {
    const invalid = validateMeta(meta);
    if (invalid) return invalid;
    const tools: Json[] = [...this.tools.values()]
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: {
          readOnlyHint: !tool.destructive,
          destructiveHint: tool.destructive,
        },
      }));
    return this.result({ tools, ttlMs: 60_000, cacheScope: "private" });
  }

  registryDocument(): Obj {
    return {
      $schema: REGISTRY_SCHEMA,
      name: this.name,
      title: this.title,
      description: this.description,
      version: this.version,
      remotes: [{ type: "streamable-http", url: this.url }],
    };
  }
}

class Token {
  constructor(
    readonly user: string,
    readonly issuer: string,
    readonly audience: string,
    readonly scopes: ReadonlySet<string>,
    readonly expiresAt: number,
  ) {}

  hasScope(scope: string): boolean {
    return this.scopes.has(scope);
  }

  isExpired(t: number): boolean {
    return t >= this.expiresAt;
  }
}

function argumentsDigest(args: Obj): string {
  const normalized = JSON.stringify(sortKeysDeep(args));
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

class ApprovalRecord {
  constructor(
    readonly actor: string,
    readonly tool: string,
    readonly argumentsDigest: string,
    readonly target: string,
    readonly expiresAt: number,
  ) {}

  static forAction(actor: string, tool: string, args: Obj, target: string, expiresAt: number): ApprovalRecord {
    return new ApprovalRecord(actor, tool, argumentsDigest(args), target, expiresAt);
  }

  authorize(actor: string, tool: string, args: Obj, target: string, t: number): [boolean, string] {
    if (this.actor !== actor) return [false, "approval actor does not match token subject"];
    if (this.tool !== tool) return [false, "approval tool does not match requested tool"];
    if (this.target !== target) return [false, "approval target does not match this server"];
    if (this.argumentsDigest !== argumentsDigest(args)) return [false, "approval arguments do not match requested action"];
    if (t >= this.expiresAt) return [false, "approval has expired"];
    return [true, "ok"];
  }
}

function policyDecide(
  server: MCPServer,
  tool: string,
  token: Token,
  args: Obj,
  t: number,
  approval: ApprovalRecord | null = null,
): [boolean, string] {
  if (token.issuer !== server.trustedIssuer) return [false, "token issuer is not trusted by this server"];
  if (token.audience !== server.url) return [false, "token audience does not match this server"];
  if (token.isExpired(t)) return [false, "token has expired"];
  const schema = server.tools.get(tool);
  if (schema === undefined) return [false, `no such tool: ${tool}`];
  if (!token.hasScope(schema.requiredScope)) return [false, `missing scope: ${schema.requiredScope}`];
  if (jsonDumps(args).length > 8192) return [false, "payload too large"];
  if (schema.destructive) {
    if (approval === null) return [false, "destructive tool requires an action-bound approval"];
    const [approved, reason] = approval.authorize(token.user, tool, args, server.url, t);
    if (!approved) return [false, reason];
  }
  return [true, "ok"];
}

function redact(payload: Obj): Obj {
  let text = jsonDumps(payload);
  text = text.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]");
  text = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[ssn]");
  return JSON.parse(text) as Obj;
}

interface AuditEntry {
  readonly ts: number;
  readonly user: string;
  readonly issuer: string;
  readonly tool: string;
  readonly outcome: string;
  readonly args_redacted: Obj;
  readonly response_redacted: Obj;
}

function auditEntry(ts: number, user: string, issuer: string, tool: string, outcome: string, argsRedacted: Obj, responseRedacted: Obj): AuditEntry {
  return { ts, user, issuer, tool, outcome, args_redacted: argsRedacted, response_redacted: responseRedacted };
}

function dispatch(
  server: MCPServer,
  token: Token,
  tool: string,
  args: Obj,
  meta: Obj,
  audit: AuditEntry[],
  approval: ApprovalRecord | null = null,
): Obj {
  const invalid = validateMeta(meta);
  if (invalid) return invalid;
  const t = now();
  const [allowed, reason] = policyDecide(server, tool, token, args, t, approval);
  if (!allowed) {
    audit.push(auditEntry(t, token.user, token.issuer, tool, `denied:${reason}`, redact(args), {}));
    return error(-32000, reason);
  }
  let response: Obj;
  try {
    response = server.handlers.get(tool)!(args);
  } catch (exc) {
    audit.push(auditEntry(t, token.user, token.issuer, tool, "handler_error", redact(args), {}));
    return server.result({
      content: [{ type: "text", text: exc instanceof Error ? exc.message : String(exc) }],
      isError: true,
    });
  }
  audit.push(auditEntry(t, token.user, token.issuer, tool, "allowed", redact(args), redact(response)));
  return server.result({
    content: [{ type: "text", text: jsonDumps(response) }],
    structuredContent: response,
    isError: false,
  });
}

function validateRegistryDocument(document: unknown): string[] {
  if (!isObj(document)) return ["server.json must be an object"];
  const issues: string[] = [];
  const has = (k: string) => Object.prototype.hasOwnProperty.call(document, k);

  for (const key of ["name", "description", "version"]) {
    if (!has(key)) issues.push(`missing ${key}`);
  }

  const schemaUri = document["$schema"];
  if (has("$schema") && schemaUri !== REGISTRY_SCHEMA) issues.push("unsupported registry schema");

  const name = document.name;
  if (has("name") && (
    typeof name !== "string"
    || !(pyLen(name) >= 3 && pyLen(name) <= 200)
    || !SERVER_NAME_RE.test(name)
  )) {
    issues.push("name must match namespace/server and be 3-200 characters");
  }

  const description = document.description;
  if (has("description") && (
    typeof description !== "string" || !(pyLen(description) >= 1 && pyLen(description) <= 100)
  )) {
    issues.push("description must be a 1-100 character string");
  }

  const title = document.title;
  if (has("title") && (
    typeof title !== "string" || !(pyLen(title) >= 1 && pyLen(title) <= 100)
  )) {
    issues.push("title must be a 1-100 character string");
  }

  const version = document.version;
  if (has("version") && (
    typeof version !== "string"
    || !(pyLen(version) >= 1 && pyLen(version) <= 255)
    || VERSION_RANGE_RE.test(version)
    || version.toLowerCase() === "latest"
  )) {
    issues.push("version must be one concrete 1-255 character version");
  }

  const remotes = document.remotes;
  if (!Array.isArray(remotes) || remotes.length === 0) {
    issues.push("remote profile requires a non-empty remotes list");
  } else {
    remotes.forEach((remote, index) => {
      if (!isObj(remote)) {
        issues.push(`remotes[${index}] must be an object`);
        return;
      }
      if (remote.type !== "streamable-http" && remote.type !== "sse") {
        issues.push(`remotes[${index}].type must be streamable-http or sse`);
      }
      const remoteUrl = remote.url;
      if (typeof remoteUrl !== "string" || !REMOTE_URL_RE.test(remoteUrl)) {
        issues.push(`remotes[${index}].url must be an http(s) URL template`);
      }
    });
  }
  return issues;
}

function reverseDnsNamespace(domain: string): string {
  const normalized = domain.toLowerCase().replace(/\.+$/, "");
  const labels = normalized.split(".");
  if (labels.length < 2 || labels.some((label) => !DOMAIN_LABEL_RE.test(label))) {
    throw new Error("publisher domain must be a valid multi-label DNS name");
  }
  return [...labels].reverse().join(".");
}

function validatePublisherNamespace(document: unknown, verifiedDomain: string): string[] {
  if (!isObj(document) || typeof document.name !== "string") return [];
  const name = document.name;
  const slash = name.indexOf("/");
  const namespace = slash === -1 ? name : name.slice(0, slash);
  const expected = reverseDnsNamespace(verifiedDomain);
  if (namespace !== expected && !namespace.startsWith(`${expected}.`)) {
    return [`name namespace must be ${expected} or its child for verified domain ${verifiedDomain}`];
  }
  return [];
}

function validateRuntimeAlignment(document: Obj, discovery: unknown): string[] {
  if (!isObj(discovery)) return ["server/discover result must be an object"];
  const meta = discovery._meta;
  const serverInfo = isObj(meta) ? meta["io.modelcontextprotocol/serverInfo"] : null;
  if (!isObj(serverInfo)) return ["server/discover must include serverInfo for registry drift checks"];

  const issues: string[] = [];
  if (serverInfo.name !== document.name) issues.push("runtime serverInfo.name does not match server.json name");
  if (serverInfo.version !== document.version) issues.push("runtime serverInfo.version does not match server.json version");
  return issues;
}

class Registry {
  entries: Map<string, Obj> = new Map();
  runtimeDiscovery: Map<string, Obj> = new Map();

  constructor(public publisherDomain: string = PUBLISHER_DOMAIN) {}

  register(server: MCPServer): void {
    const document = server.registryDocument();
    const issues = validateRegistryDocument(document);
    issues.push(...validatePublisherNamespace(document, this.publisherDomain));
    if (issues.length > 0) throw new Error(issues.join("; "));
    const discovery = server.discover(requestMeta());
    if ("error" in discovery) throw new Error("runtime discovery failed");
    const alignmentIssues = validateRuntimeAlignment(document, discovery);
    if (alignmentIssues.length > 0) throw new Error(alignmentIssues.join("; "));
    this.entries.set(server.name, structuredClone(document));
    this.runtimeDiscovery.set(server.name, structuredClone(discovery));
  }

  search(query: string): string[] {
    const needle = query.toLowerCase();
    return [...this.entries.entries()]
      .filter(([name, entry]) =>
        name.toLowerCase().includes(needle)
        || String(entry.title).toLowerCase().includes(needle)
        || String(entry.description).toLowerCase().includes(needle))
      .map(([name]) => name)
      .sort();
  }
}

function buildReadonlyServer(): MCPServer {
  const server = new MCPServer(
    "com.example/internal-readonly",
    "Internal Read-Only Tools",
    "Read-only incident and data lookup tools.",
    "1.0.0",
    "https://mcp.internal.example.com/readonly",
    "https://auth.internal.example.com",
  );
  server.register(
    toolSchema(
      "postgres.readonly",
      "postgres:query:readonly",
      false,
      "Run an approved read-only query.",
      {
        type: "object",
        properties: { sql: { type: "string" } },
        required: ["sql"],
        additionalProperties: false,
      },
    ),
    (args) => ({ rows: [[1]], sql: args.sql }),
  );
  server.register(
    toolSchema(
      "s3.list",
      "s3:list",
      false,
      "List objects in one approved bucket.",
      {
        type: "object",
        properties: { bucket: { type: "string" } },
        required: ["bucket"],
        additionalProperties: false,
      },
    ),
    (args) => ({ bucket: args.bucket, objects: ["a/b.txt"] }),
  );
  return server;
}

function buildDestructiveServer(): MCPServer {
  const server = new MCPServer(
    "com.example/internal-destructive",
    "Internal Destructive Tools",
    "State-changing tools behind explicit approval.",
    "1.0.0",
    "https://mcp.internal.example.com/destructive",
    "https://auth.internal.example.com",
  );
  server.register(
    toolSchema(
      "jira.create",
      "jira:write",
      true,
      "Create one Jira issue after explicit approval.",
      {
        type: "object",
        properties: { title: { type: "string" } },
        required: ["title"],
        additionalProperties: false,
      },
    ),
    (args) => ({ id: "PROJ-99", title: args.title, created: true }),
  );
  return server;
}

function main(): void {
  const readonly = buildReadonlyServer();
  const destructive = buildDestructiveServer();
  const registry = new Registry();
  registry.register(readonly);
  registry.register(destructive);
  const audit: AuditEntry[] = [];

  const readonlyToken = new Token(
    "u42",
    readonly.trustedIssuer,
    readonly.url,
    new Set(["postgres:query:readonly", "s3:list"]),
    now() + 3_600,
  );
  const approvedToken = new Token(
    "u42",
    destructive.trustedIssuer,
    destructive.url,
    new Set(["jira:write"]),
    now() + 3_600,
  );
  const approvedArgs: Obj = { title: "new bug" };
  const approval = ApprovalRecord.forAction(
    approvedToken.user,
    "jira.create",
    approvedArgs,
    destructive.url,
    now() + 900,
  );

  console.log("=== registry metadata and runtime discovery ===");
  console.log(JSON.stringify(registry.entries.get(readonly.name), null, 2));
  console.log(JSON.stringify(registry.runtimeDiscovery.get(readonly.name), null, 2));
  console.log("tools:", JSON.stringify(readonly.toolsList(requestMeta()), null, 2));

  console.log("\n=== policy-gated calls ===");
  console.log(pyRepr(dispatch(
    readonly,
    readonlyToken,
    "postgres.readonly",
    { sql: "SELECT 1" },
    requestMeta(),
    audit,
  )));
  console.log(pyRepr(dispatch(
    destructive,
    approvedToken,
    "jira.create",
    approvedArgs,
    requestMeta(),
    audit,
    approval,
  )));

  console.log("\n=== audit log ===");
  for (const entry of audit) {
    console.log(jsonDumps({ ...entry }, true));
  }
}

main();
