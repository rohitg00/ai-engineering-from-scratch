// Lesson: MCP Authorization: CIMD, Issuer Binding, PKCE, and Step-Up (phase 13 / lesson 16)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/16-mcp-security-oauth-2-1/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/16-mcp-security-oauth-2-1/code/main.ts

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { isIPv4, isIPv6 } from "node:net";

type Dict = { [key: string]: any };

const PROTOCOL_VERSION = "2026-07-28";
const PROTOCOL_META = "io.modelcontextprotocol/protocolVersion";
const CLIENT_CAPABILITIES_META = "io.modelcontextprotocol/clientCapabilities";
const CLIENT_INFO_META = "io.modelcontextprotocol/clientInfo";
const SERVER_INFO_META = "io.modelcontextprotocol/serverInfo";
const RESOURCE = "https://notes.example.com/mcp";
const RESOURCE_METADATA_URI = "https://notes.example.com/.well-known/oauth-protected-resource/mcp";
const ISSUER = "https://auth.example.com";
const CLIENT_METADATA_URL = "https://client.example.com/oauth/metadata.json";
const SERVER_INFO = { name: "notes-server", version: "2.0.0" };
const BASE64_SENTINEL_PREFIX = "=?base64?";
const BASE64_SENTINEL_SUFFIX = "?=";
const FORBIDDEN_CIMD_SECRET_FIELDS = new Set([
  "client_secret",
  "client_secret_expires_at",
  "private_key",
  "private_key_jwk",
  "private_key_pem",
]);
const PRIVATE_JWK_FIELDS = new Set(["d", "p", "q", "dp", "dq", "qi", "oth", "k"]);

const TOOL_DESCRIPTORS: Dict[] = [
  {
    name: "notes.create",
    description: "Create a note.",
    inputSchema: {
      type: "object",
      properties: { title: { type: "string" } },
      required: ["title"],
    },
  },
  {
    name: "notes.delete",
    description: "Delete a note by identifier.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "notes.list",
    description: "List notes visible to the principal.",
    inputSchema: { type: "object", properties: {} },
  },
];

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

function pyIsSpace(c: string): boolean {
  const code = c.codePointAt(0) ?? 0;
  if (code === 0xfeff) return false;
  return /\s/u.test(c) || (code >= 0x1c && code <= 0x1f) || code === 0x85;
}

function isAscii(value: string): boolean {
  return /^[\x00-\x7f]*$/.test(value);
}

function pyStrip(value: string): string {
  const chars = [...value];
  let start = 0;
  let end = chars.length;
  while (start < end && pyIsSpace(chars[start])) start += 1;
  while (end > start && pyIsSpace(chars[end - 1])) end -= 1;
  return chars.slice(start, end).join("");
}

class ValueError extends Error {}

type ParsedUrl = {
  scheme: string;
  netloc: string;
  path: string;
  params: string;
  query: string;
  fragment: string;
  hostname: string | null;
  username: string | null;
  password: string | null;
};

function checkBracketedNetloc(netloc: string): void {
  const hostAndPort = netloc.slice(netloc.lastIndexOf("@") + 1);
  const open = hostAndPort.indexOf("[");
  if (open < 0) return;
  if (open > 0) throw new ValueError("Invalid IPv6 URL");
  const bracketed = hostAndPort.slice(open + 1);
  const close = bracketed.indexOf("]");
  const hostname = close >= 0 ? bracketed.slice(0, close) : bracketed;
  const port = close >= 0 ? bracketed.slice(close + 1) : "";
  if (port && !port.startsWith(":")) throw new ValueError("Invalid IPv6 URL");
  if (hostname.startsWith("v")) {
    if (!/^v[a-fA-F0-9]+\.[a-zA-Z0-9\-._~!$&'()*+,;=:]+$/.test(hostname)) throw new ValueError("IPvFuture address is invalid");
    return;
  }
  const address = hostname.split("%")[0];
  if (isIPv4(address)) throw new ValueError("An IPv4 address cannot be in brackets");
  if (!isIPv6(address)) throw new ValueError("does not appear to be an IPv4 or IPv6 address");
}

function urlparse(input: string): ParsedUrl {
  let url = input.replace(/^[\x00-\x20]+/, "").replace(/[\t\r\n]/g, "");
  let scheme = "";
  let netloc = "";
  let query = "";
  let fragment = "";
  const colon = url.indexOf(":");
  if (colon > 0 && /^[A-Za-z][A-Za-z0-9+\-.]*$/.test(url.slice(0, colon))) {
    scheme = url.slice(0, colon).toLowerCase();
    url = url.slice(colon + 1);
  }
  if (url.startsWith("//")) {
    let delim = url.length;
    for (const c of "/?#") {
      const at = url.indexOf(c, 2);
      if (at >= 0) delim = Math.min(delim, at);
    }
    netloc = url.slice(2, delim);
    url = url.slice(delim);
    if (netloc.includes("[") !== netloc.includes("]")) throw new ValueError("Invalid IPv6 URL");
    if (netloc.includes("[")) checkBracketedNetloc(netloc);
  }
  const hash = url.indexOf("#");
  if (hash >= 0) {
    fragment = url.slice(hash + 1);
    url = url.slice(0, hash);
  }
  const question = url.indexOf("?");
  if (question >= 0) {
    query = url.slice(question + 1);
    url = url.slice(0, question);
  }
  let params = "";
  const usesParams = new Set(["", "ftp", "hdl", "prospero", "http", "imap", "https", "shttp", "rtsp", "rtsps", "rtspu", "sip", "sips", "mms", "sftp", "tel"]);
  if (usesParams.has(scheme) && url.includes(";")) {
    let at: number;
    if (url.includes("/")) at = url.indexOf(";", url.lastIndexOf("/"));
    else at = url.indexOf(";");
    if (at >= 0) {
      params = url.slice(at + 1);
      url = url.slice(0, at);
    }
  }
  const atSign = netloc.lastIndexOf("@");
  const hostinfo = atSign >= 0 ? netloc.slice(atSign + 1) : netloc;
  let username: string | null = null;
  let password: string | null = null;
  if (atSign >= 0) {
    const userinfo = netloc.slice(0, atSign);
    const sep = userinfo.indexOf(":");
    username = sep >= 0 ? userinfo.slice(0, sep) : userinfo;
    password = sep >= 0 ? userinfo.slice(sep + 1) : null;
  }
  let host: string;
  const open = hostinfo.indexOf("[");
  if (open >= 0) {
    const bracketed = hostinfo.slice(open + 1);
    const close = bracketed.indexOf("]");
    host = close >= 0 ? bracketed.slice(0, close) : bracketed;
  } else {
    const sep = hostinfo.indexOf(":");
    host = sep >= 0 ? hostinfo.slice(0, sep) : hostinfo;
  }
  const hostname = host ? host.toLowerCase() : null;
  return { scheme, netloc, path: url, params, query, fragment, hostname, username, password };
}

class Token {
  constructor(
    public readonly value: string,
    public readonly issuer: string,
    public readonly audience: string,
    public readonly subject: string,
    public readonly client_id: string,
    public readonly scopes: ReadonlySet<string>,
    public readonly expires_at: number,
  ) {}
}

class ProtocolError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data: Dict | null = null,
    public readonly http_status: number = 400,
    public readonly headers: { [key: string]: string } | null = null,
  ) {
    super(message);
  }
}

type HandleResult = [number, Dict | null, { [key: string]: string }];

function nowSeconds(): number {
  return Date.now() / 1000;
}

function tokenUrlsafe(nbytes: number): string {
  return randomBytes(nbytes).toString("base64url");
}

function tokenHex(nbytes: number): string {
  return randomBytes(nbytes).toString("hex");
}

function compareDigest(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function s256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

function pkce_pair(): [string, string] {
  const verifier = tokenUrlsafe(32);
  const challenge = s256(verifier);
  return [verifier, challenge];
}

function request_meta(): Dict {
  return {
    [PROTOCOL_META]: PROTOCOL_VERSION,
    [CLIENT_CAPABILITIES_META]: {},
    [CLIENT_INFO_META]: { name: "oauth-lesson-client", version: "1.0.0" },
  };
}

function isPrintableAscii(value: string): boolean {
  return [...value].every((c) => {
    const code = c.codePointAt(0) ?? 0;
    return code >= 0x20 && code <= 0x7e;
  });
}

function encode_mcp_header_value(value: string): string {
  const isSafe =
    isAscii(value) &&
    value === pyStrip(value) &&
    isPrintableAscii(value) &&
    !(value.startsWith(BASE64_SENTINEL_PREFIX) && value.endsWith(BASE64_SENTINEL_SUFFIX));
  if (isSafe) return value;
  const payload = Buffer.from(value, "utf-8").toString("base64");
  return `${BASE64_SENTINEL_PREFIX}${payload}${BASE64_SENTINEL_SUFFIX}`;
}

function strictBase64Decode(payload: string): string {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(payload) || payload.length % 4 !== 0) {
    throw new ValueError("invalid base64");
  }
  const bytes = Buffer.from(payload, "base64");
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function decode_mcp_header_value(value: unknown): string {
  if (typeof value !== "string") {
    throw new ProtocolError(-32020, "Mcp-Name header is missing or malformed");
  }
  if (value.startsWith(BASE64_SENTINEL_PREFIX) && value.endsWith(BASE64_SENTINEL_SUFFIX)) {
    const payload = value.slice(BASE64_SENTINEL_PREFIX.length, value.length - BASE64_SENTINEL_SUFFIX.length);
    try {
      return strictBase64Decode(payload);
    } catch {
      throw new ProtocolError(-32020, "Mcp-Name header has invalid Base64 encoding");
    }
  }
  if (!isAscii(value) || value !== pyStrip(value) || !isPrintableAscii(value)) {
    throw new ProtocolError(-32020, "Mcp-Name header is not safely encoded");
  }
  return value;
}

function make_mcp_request(request_id: number, tool: string, args: Dict | null = null): [Dict, { [key: string]: string }] {
  const params = { name: tool, arguments: { ...(args ?? {}) }, _meta: request_meta() };
  const body = { jsonrpc: "2.0", id: request_id, method: "tools/call", params };
  const headers = {
    "MCP-Protocol-Version": PROTOCOL_VERSION,
    "Mcp-Method": "tools/call",
    "Mcp-Name": encode_mcp_header_value(tool),
  };
  return [body, headers];
}

function make_discover_request(request_id = 0): [Dict, { [key: string]: string }] {
  const body = {
    jsonrpc: "2.0",
    id: request_id,
    method: "server/discover",
    params: { _meta: request_meta() },
  };
  const headers = {
    "MCP-Protocol-Version": PROTOCOL_VERSION,
    "Mcp-Method": "server/discover",
  };
  return [body, headers];
}

function make_tools_list_request(request_id = 0): [Dict, { [key: string]: string }] {
  const body = {
    jsonrpc: "2.0",
    id: request_id,
    method: "tools/list",
    params: { _meta: request_meta() },
  };
  const headers = {
    "MCP-Protocol-Version": PROTOCOL_VERSION,
    "Mcp-Method": "tools/list",
  };
  return [body, headers];
}

function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const REDIRECT_ERROR = "redirect_uris entries must be non-empty absolute URIs without fragments";

class AuthorizationServer {
  issuer: string;
  supports_cimd: boolean;
  supports_dcr: boolean;
  clients: { [key: string]: Dict } = {};
  pending_codes: { [key: string]: Dict } = {};

  constructor(options: { issuer?: string; supports_cimd?: boolean; supports_dcr?: boolean } = {}) {
    this.issuer = options.issuer ?? ISSUER;
    this.supports_cimd = options.supports_cimd ?? true;
    this.supports_dcr = options.supports_dcr ?? true;
  }

  metadata(): Dict {
    const metadata: Dict = {
      issuer: this.issuer,
      authorization_endpoint: `${this.issuer}/authorize`,
      token_endpoint: `${this.issuer}/token`,
      code_challenge_methods_supported: ["S256"],
      authorization_response_iss_parameter_supported: true,
      client_id_metadata_document_supported: this.supports_cimd,
    };
    if (this.supports_dcr) metadata["registration_endpoint"] = `${this.issuer}/register`;
    return metadata;
  }

  static _validate_application(metadata: Dict, require_application_type: boolean): void {
    const application_type = metadata["application_type"];
    if (require_application_type && application_type !== "native" && application_type !== "web") {
      throw new ValueError("application_type must be native or web");
    }
    if (application_type !== undefined && application_type !== null && application_type !== "native" && application_type !== "web") {
      throw new ValueError("application_type must be native or web");
    }
    const redirect_uris = metadata["redirect_uris"];
    if (!Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      throw new ValueError("redirect_uris is required");
    }
    const parsed_redirects: ParsedUrl[] = [];
    for (const redirect_uri of redirect_uris) {
      if (
        typeof redirect_uri !== "string" ||
        !redirect_uri ||
        redirect_uri !== pyStrip(redirect_uri) ||
        [...redirect_uri].some(pyIsSpace)
      ) {
        throw new ValueError(REDIRECT_ERROR);
      }
      let parsed: ParsedUrl;
      try {
        parsed = urlparse(redirect_uri);
      } catch {
        throw new ValueError(REDIRECT_ERROR);
      }
      const hostname = parsed.hostname;
      if (
        !parsed.scheme ||
        parsed.fragment ||
        ((parsed.scheme === "http" || parsed.scheme === "https") && (!parsed.netloc || hostname === null))
      ) {
        throw new ValueError(REDIRECT_ERROR);
      }
      parsed_redirects.push(parsed);
    }
    if (application_type === "web") {
      for (const parsed of parsed_redirects) {
        if (parsed.scheme !== "https" || parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
          throw new ValueError("web redirect URIs must use remote HTTPS");
        }
      }
    }
  }

  enroll_cimd(metadata_url: string, document: Dict): string {
    if (!this.supports_cimd) throw new ValueError("CIMD is not supported");
    const parsed = urlparse(metadata_url);
    if (parsed.scheme !== "https" || !parsed.netloc || parsed.path === "" || parsed.path === "/") {
      throw new ValueError("CIMD client_id must be an HTTPS URL with a path");
    }
    if (parsed.username !== null || parsed.password !== null) {
      throw new ValueError("CIMD client_id must not contain userinfo");
    }
    if (parsed.fragment) throw new ValueError("CIMD client_id must not contain a fragment");
    if (parsed.path.split("/").some((segment) => segment === "." || segment === "..")) {
      throw new ValueError("CIMD client_id must not contain dot path segments");
    }
    if (document["client_id"] !== metadata_url) {
      throw new ValueError("CIMD client_id must equal its metadata URL");
    }
    if (typeof document["client_name"] !== "string" || !document["client_name"]) {
      throw new ValueError("client_name is required");
    }
    const auth_method = document["token_endpoint_auth_method"];
    if (auth_method !== undefined && auth_method !== null && typeof auth_method !== "string") {
      throw new ValueError("token_endpoint_auth_method must be a string");
    }
    if (typeof auth_method === "string" && auth_method.startsWith("client_secret")) {
      throw new ValueError("CIMD must not use shared-secret client authentication");
    }
    const forbidden_fields = Object.keys(document).filter((key) => FORBIDDEN_CIMD_SECRET_FIELDS.has(key));
    if (forbidden_fields.length > 0) {
      throw new ValueError("CIMD must not contain client secrets or private keys");
    }
    const jwks = document["jwks"];
    if (isDict(jwks)) {
      const keys = "keys" in jwks ? jwks["keys"] : [];
      if (Array.isArray(keys) && keys.some((key) => isDict(key) && Object.keys(key).some((k) => PRIVATE_JWK_FIELDS.has(k)))) {
        throw new ValueError("CIMD jwks must contain public keys only");
      }
    }
    AuthorizationServer._validate_application(document, false);
    this.clients[metadata_url] = { ...document, enrollment: "cimd" };
    return metadata_url;
  }

  dynamic_register(metadata: Dict): string {
    if (!this.supports_dcr) throw new ValueError("DCR is not supported");
    AuthorizationServer._validate_application(metadata, true);
    const client_id = `dcr_${tokenHex(6)}`;
    this.clients[client_id] = { ...metadata, enrollment: "dcr-compatibility" };
    return client_id;
  }

  authorize(options: {
    client_id: string;
    redirect_uri: string;
    subject: string;
    scopes: Set<string>;
    challenge: string;
    resource: string;
  }): { [key: string]: string } {
    const client = this.clients[options.client_id];
    if (client === undefined || !client["redirect_uris"].includes(options.redirect_uri)) {
      throw new ValueError("unknown client or redirect URI");
    }
    const code = `code_${tokenHex(8)}`;
    this.pending_codes[code] = {
      client_id: options.client_id,
      redirect_uri: options.redirect_uri,
      subject: options.subject,
      scopes: new Set(options.scopes),
      challenge: options.challenge,
      resource: options.resource,
      expires_at: nowSeconds() + 300,
    };
    return { code, iss: this.issuer };
  }

  exchange(options: { code: string; client_id: string; verifier: string; redirect_uri: string; resource: string }): Token {
    const record = this.pending_codes[options.code];
    if (record === undefined) throw new ValueError("invalid authorization code");
    if (record["expires_at"] <= nowSeconds()) {
      delete this.pending_codes[options.code];
      throw new ValueError("invalid authorization code");
    }
    if (record["client_id"] !== options.client_id) throw new ValueError("client_id mismatch");
    if (record["redirect_uri"] !== options.redirect_uri) throw new ValueError("redirect_uri mismatch");
    if (record["resource"] !== options.resource) throw new ValueError("resource mismatch");
    const challenge = s256(options.verifier);
    if (!compareDigest(challenge, record["challenge"])) throw new ValueError("PKCE mismatch");
    delete this.pending_codes[options.code];
    return new Token(
      `tok_${tokenHex(12)}`,
      this.issuer,
      options.resource,
      record["subject"],
      record["client_id"],
      record["scopes"],
      nowSeconds() + 3600,
    );
  }
}

class ResourceServer {
  resource: string;
  issuer: string;
  scopes: { [key: string]: string };

  constructor(options: { resource?: string; issuer?: string; scopes?: { [key: string]: string } } = {}) {
    this.resource = options.resource ?? RESOURCE;
    this.issuer = options.issuer ?? ISSUER;
    this.scopes = options.scopes ?? {
      "notes.list": "notes:read",
      "notes.create": "notes:write",
      "notes.delete": "notes:delete",
    };
  }

  protected_resource_metadata(): Dict {
    return {
      resource: this.resource,
      authorization_servers: [this.issuer],
      scopes_supported: [...new Set(Object.values(this.scopes))].sort(),
    };
  }

  static _success(request_id: any, result: Dict): Dict {
    const payload: Dict = { ...result };
    if (!("resultType" in payload)) payload["resultType"] = "complete";
    if (!("_meta" in payload)) payload["_meta"] = {};
    payload["_meta"][SERVER_INFO_META] = SERVER_INFO;
    return { jsonrpc: "2.0", id: request_id, result: payload };
  }

  static _error(request_id: any, error: ProtocolError): Dict {
    const payload: Dict = { code: error.code, message: error.message };
    if (error.data !== null) payload["data"] = error.data;
    return { jsonrpc: "2.0", id: request_id ?? null, error: payload };
  }

  static _validate_wire(body: Dict, headers: { [key: string]: string }): Dict {
    if (body["jsonrpc"] !== "2.0") throw new ProtocolError(-32600, "Invalid Request");
    const method = body["method"];
    const params = body["params"];
    if (typeof method !== "string" || !isDict(params)) throw new ProtocolError(-32600, "Invalid Request");
    const meta = params["_meta"];
    if (!isDict(meta)) throw new ProtocolError(-32602, "params._meta must be an object");
    const requested_version = meta[PROTOCOL_META];
    if (typeof requested_version !== "string") throw new ProtocolError(-32602, "protocolVersion must be a string");
    if (!isDict(meta[CLIENT_CAPABILITIES_META])) throw new ProtocolError(-32602, "clientCapabilities must be an object");
    if (headers["MCP-Protocol-Version"] !== requested_version) {
      throw new ProtocolError(-32020, "MCP-Protocol-Version header mismatch");
    }
    if (headers["Mcp-Method"] !== method) throw new ProtocolError(-32020, "Mcp-Method header mismatch");
    if (method === "tools/call" || method === "resources/read" || method === "prompts/get") {
      const expected_name = params["name"] || params["uri"];
      const supplied_name = decode_mcp_header_value(headers["Mcp-Name"]);
      if (supplied_name !== expected_name) throw new ProtocolError(-32020, "Mcp-Name header mismatch");
    }
    if (requested_version !== PROTOCOL_VERSION) {
      throw new ProtocolError(-32022, "Unsupported protocol version", {
        supported: [PROTOCOL_VERSION],
        requested: requested_version,
      });
    }
    return params;
  }

  discover(body: Dict, headers: { [key: string]: string }, http_method = "POST"): HandleResult {
    return this.handle(body, headers, null, http_method);
  }

  call(body: Dict, headers: { [key: string]: string }, token: Token | null, http_method = "POST"): HandleResult {
    return this.handle(body, headers, token, http_method);
  }

  handle(body: Dict, headers: { [key: string]: string }, token: Token | null = null, http_method = "POST"): HandleResult {
    const is_notification = !("id" in body);
    try {
      if (http_method !== "POST") throw new ProtocolError(-32600, "HTTP method not allowed", null, 405);
      const params = ResourceServer._validate_wire(body, headers);
      const method = body["method"];
      let result: Dict;
      if (method === "server/discover") {
        result = {
          supportedVersions: [PROTOCOL_VERSION],
          capabilities: { tools: { listChanged: false } },
          ttlMs: 60_000,
          cacheScope: "public",
        };
      } else if (method === "tools/list") {
        result = {
          tools: [...TOOL_DESCRIPTORS].sort((a, b) => (a["name"] < b["name"] ? -1 : a["name"] > b["name"] ? 1 : 0)),
          ttlMs: 60_000,
          cacheScope: "public",
        };
      } else if (method === "tools/call") {
        const challenge_base = `Bearer resource_metadata="${RESOURCE_METADATA_URI}"`;
        const challenge_headers = { "WWW-Authenticate": challenge_base };
        if (token === null || token.expires_at < nowSeconds()) {
          throw new ProtocolError(-32001, "Unauthorized", { reason: "invalid_token" }, 401, challenge_headers);
        }
        if (token.issuer !== this.issuer || token.audience !== this.resource) {
          throw new ProtocolError(-32001, "Unauthorized", { reason: "invalid_token" }, 401, challenge_headers);
        }
        const required = this.scopes[params["name"]];
        if (required === undefined) {
          throw new ProtocolError(-32602, "Unknown tool", { name: params["name"] ?? null }, 404);
        }
        if (!token.scopes.has(required)) {
          const challenge = `${challenge_base}, error="insufficient_scope", scope="${required}"`;
          throw new ProtocolError(-32003, "Insufficient scope", { requiredScope: required }, 403, {
            "WWW-Authenticate": challenge,
          });
        }
        result = {
          content: [
            {
              type: "text",
              text: `${params["name"]} allowed for ${token.subject}`,
            },
          ],
          isError: false,
        };
      } else {
        throw new ProtocolError(-32601, "Method not found", null, 404);
      }
      if (is_notification) return [202, null, {}];
      return [200, ResourceServer._success(body["id"], result), {}];
    } catch (error) {
      if (!(error instanceof ProtocolError)) throw error;
      if (is_notification) return [error.http_status, null, { ...(error.headers ?? {}) }];
      return [error.http_status, ResourceServer._error(body["id"], error), { ...(error.headers ?? {}) }];
    }
  }
}

class Client {
  subject: string;
  application_type: string;
  redirect_uri: string;
  client_ids_by_issuer: { [key: string]: string } = {};
  tokens_by_issuer_resource: Map<string, Token> = new Map();
  next_request_id = 1;

  constructor(options: { subject?: string; application_type?: string } = {}) {
    this.subject = options.subject ?? "alice";
    this.application_type = options.application_type ?? "native";
    this.redirect_uri =
      this.application_type === "native" ? "http://127.0.0.1:8765/callback" : "https://client.example.com/callback";
  }

  _client_document(): Dict {
    return {
      client_id: CLIENT_METADATA_URL,
      client_name: "OAuth lesson client",
      application_type: this.application_type,
      redirect_uris: [this.redirect_uri],
      grant_types: ["authorization_code"],
      response_types: ["code"],
    };
  }

  enroll(auth: AuthorizationServer): string {
    const metadata = auth.metadata();
    if (metadata["issuer"] !== auth.issuer) throw new ValueError("authorization metadata issuer mismatch");
    let client_id: string;
    if (metadata["client_id_metadata_document_supported"]) {
      client_id = auth.enroll_cimd(CLIENT_METADATA_URL, this._client_document());
    } else if (metadata["registration_endpoint"]) {
      const fallback = this._client_document();
      delete fallback["client_id"];
      client_id = auth.dynamic_register(fallback);
    } else {
      throw new ValueError("authorization server offers no supported client enrollment");
    }
    this.client_ids_by_issuer[auth.issuer] = client_id;
    return client_id;
  }

  authorize(auth: AuthorizationServer, resource: string, scopes: Set<string>): Token {
    let client_id = this.client_ids_by_issuer[auth.issuer];
    if (client_id === undefined) client_id = this.enroll(auth);
    const [verifier, challenge] = pkce_pair();
    const response = auth.authorize({
      client_id,
      redirect_uri: this.redirect_uri,
      subject: this.subject,
      scopes,
      challenge,
      resource,
    });
    if (response["iss"] !== auth.issuer) throw new ValueError("authorization response issuer mismatch");
    const token = auth.exchange({
      code: response["code"],
      client_id,
      verifier,
      redirect_uri: this.redirect_uri,
      resource,
    });
    this.tokens_by_issuer_resource.set(JSON.stringify([auth.issuer, resource]), token);
    return token;
  }

  call_with_step_up(tool: string, server: ResourceServer, auth: AuthorizationServer): HandleResult {
    if (server.issuer !== auth.issuer) throw new ValueError("protected resource selected a different issuer");
    const key = JSON.stringify([auth.issuer, server.resource]);
    let token = this.tokens_by_issuer_resource.get(key);
    if (token === undefined) token = this.authorize(auth, server.resource, new Set(["notes:read"]));
    let [body, headers] = make_mcp_request(this.next_request_id, tool);
    this.next_request_id += 1;
    let [status, response, response_headers] = server.call(body, headers, token);
    if (status === 403 && response !== null && (response["error"] ?? {})["code"] === -32003) {
      const required = response_headers["WWW-Authenticate"].split('scope="').slice(1).join('scope="').split('"')[0];
      token = this.authorize(auth, server.resource, new Set([...token.scopes, required]));
      [body, headers] = make_mcp_request(this.next_request_id, tool);
      this.next_request_id += 1;
      [status, response, response_headers] = server.call(body, headers, token);
    }
    return [status, response, response_headers];
  }
}

function demo(): void {
  const auth = new AuthorizationServer();
  const server = new ResourceServer();
  const client = new Client();
  const [discover_body, discover_headers] = make_discover_request();
  const [, discovery] = server.discover(discover_body, discover_headers);
  console.log("server discovery:", pyRepr(discovery ? discovery["result"] : null));
  const [list_body, list_headers] = make_tools_list_request();
  const [, listing] = server.handle(list_body, list_headers);
  console.log("tools:", pyRepr(listing ? listing["result"]["tools"].map((tool: Dict) => tool["name"]) : null));
  console.log("protected resource metadata:", pyRepr(server.protected_resource_metadata()));
  console.log("CIMD client_id:", client.enroll(auth));
  for (const tool of ["notes.list", "notes.create", "notes.delete"]) {
    const [status, response] = client.call_with_step_up(tool, server, auth);
    console.log(tool, status, pyRepr(response ? (response["result"] ?? {})["content"] : null));
  }
  console.log("effective client ids by issuer:", pyRepr(Object.keys(client.client_ids_by_issuer).sort()));
}

demo();
