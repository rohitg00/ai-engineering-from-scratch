// Lesson: MCP Auth in Production: Issuer-Bound Enrollment and Tokens (phase 13 / lesson 18)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/18-mcp-auth-production/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/18-mcp-auth-production/code/main.ts

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIPv4, isIPv6 } from "node:net";

type Dict = { [key: string]: any };

function pyJsonString(s: string): string {
  return JSON.stringify(s).replace(/[\u0080-\uffff]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

function pyDumpsCompact(value: any): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return pyJsonString(value);
  if (Array.isArray(value)) return "[" + value.map(pyDumpsCompact).join(",") + "]";
  return "{" + Object.keys(value).map((k) => pyJsonString(k) + ":" + pyDumpsCompact(value[k])).join(",") + "}";
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

function pyIsSpace(c: string): boolean {
  const code = c.codePointAt(0) ?? 0;
  if (code === 0xfeff) return false;
  return /\s/u.test(c) || (code >= 0x1c && code <= 0x1f) || code === 0x85;
}

function pyStrip(value: string): string {
  const chars = [...value];
  let start = 0;
  let end = chars.length;
  while (start < end && pyIsSpace(chars[start])) start += 1;
  while (end > start && pyIsSpace(chars[end - 1])) end -= 1;
  return chars.slice(start, end).join("");
}

function pySplitWhitespace(value: string): string[] {
  return value.split(/[\s\x1c-\x1f\x85]+/u).filter((part) => part.length > 0);
}

class ValueError extends Error {}

class AssertionError extends Error {}

function check(condition: boolean): void {
  if (!condition) throw new AssertionError("assertion failed");
}

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
  rawPort: string | null;
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
  let port: string;
  const open = hostinfo.indexOf("[");
  if (open >= 0) {
    const bracketed = hostinfo.slice(open + 1);
    const close = bracketed.indexOf("]");
    host = close >= 0 ? bracketed.slice(0, close) : bracketed;
    const rest = close >= 0 ? bracketed.slice(close + 1) : "";
    const portSep = rest.indexOf(":");
    port = portSep >= 0 ? rest.slice(portSep + 1) : "";
  } else {
    const sep = hostinfo.indexOf(":");
    host = sep >= 0 ? hostinfo.slice(0, sep) : hostinfo;
    port = sep >= 0 ? hostinfo.slice(sep + 1) : "";
  }
  const hostname = host ? host.toLowerCase() : null;
  return { scheme, netloc, path: url, params, query, fragment, hostname, username, password, rawPort: port || null };
}

function urlPort(parsed: ParsedUrl): number | null {
  if (parsed.rawPort === null) return null;
  if (!/^[0-9]+$/.test(parsed.rawPort)) throw new ValueError(`Port could not be cast to integer value as ${pyStrRepr(parsed.rawPort)}`);
  const port = Number.parseInt(parsed.rawPort, 10);
  if (!(port >= 0 && port <= 65535)) throw new ValueError("Port out of range 0-65535");
  return port;
}

function nowSeconds(): number {
  return Date.now() / 1000;
}

function tokenUrlsafe(nbytes: number): string {
  return randomBytes(nbytes).toString("base64url");
}

function tokenHex(nbytes: number): string {
  return randomBytes(nbytes).toString("hex");
}

function compareDigest(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function b64url(raw: Buffer): string {
  return raw.toString("base64url");
}

function b64url_decode(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

function jwt_sign(payload: Dict, kid: string, secret: Buffer): string {
  const header = { alg: "HS256", typ: "JWT", kid };
  const h = b64url(Buffer.from(pyDumpsCompact(header)));
  const p = b64url(Buffer.from(pyDumpsCompact(payload)));
  const sig = createHmac("sha256", secret).update(`${h}.${p}`).digest();
  return `${h}.${p}.${b64url(sig)}`;
}

function splitToken(token: string): [string, string, string] {
  const parts = token.split(".");
  if (parts.length !== 3) throw new ValueError("expected 3 values to unpack");
  return [parts[0], parts[1], parts[2]];
}

function jwt_decode(token: string): [Dict, Dict, string] {
  const [h_b64, p_b64, sig_b64] = splitToken(token);
  const header = JSON.parse(b64url_decode(h_b64).toString("utf-8"));
  const payload = JSON.parse(b64url_decode(p_b64).toString("utf-8"));
  return [header, payload, sig_b64];
}

function jwt_verify(token: string, secret: Buffer): boolean {
  const [h_b64, p_b64, sig_b64] = splitToken(token);
  const expected = createHmac("sha256", secret).update(`${h_b64}.${p_b64}`).digest();
  return compareDigest(expected, b64url_decode(sig_b64));
}

function protected_resource_metadata_url(resource: string): string {
  const parsed = urlparse(resource);
  if (parsed.scheme !== "https" || !parsed.netloc || parsed.query || parsed.fragment) {
    throw new ValueError("MCP resource must be an absolute HTTPS URL without query or fragment");
  }
  const suffix = parsed.path === "" || parsed.path === "/" ? "" : parsed.path;
  return `${parsed.scheme}://${parsed.netloc}/.well-known/oauth-protected-resource${suffix}`;
}

const MCP_RESOURCE = "https://notes.example.com";
const OTHER_MCP_RESOURCE = "https://tasks.example.com";

const MCP_RESOURCE_METADATA = protected_resource_metadata_url(MCP_RESOURCE);
const OTHER_MCP_RESOURCE_METADATA = protected_resource_metadata_url(OTHER_MCP_RESOURCE);

const TOOL_SCOPES: { [key: string]: string } = {
  "notes.list": "mcp:tools.invoke",
  "notes.read": "mcp:tools.invoke",
  "notes.delete": "mcp:tools.delete",
  "tasks.list": "mcp:tools.invoke",
};
const DEFAULT_TOOL_SCOPE = "mcp:tools.invoke";
const AUTHORIZATION_CODE_TTL_SECONDS = 300;

function parsed_absolute_redirect_uri(value: unknown): ParsedUrl | null {
  if (
    typeof value !== "string" ||
    !value ||
    value !== pyStrip(value) ||
    [...value].some((c) => pyIsSpace(c) || (c.codePointAt(0) ?? 0) < 0x20 || c.codePointAt(0) === 0x7f)
  ) {
    return null;
  }
  let parsed: ParsedUrl;
  try {
    parsed = urlparse(value);
    urlPort(parsed);
  } catch (error) {
    if (error instanceof ValueError) return null;
    throw error;
  }
  const hostname = parsed.hostname;
  if (!parsed.scheme || parsed.fragment || parsed.username !== null || parsed.password !== null) return null;
  if ((parsed.scheme === "http" || parsed.scheme === "https") && (!parsed.netloc || hostname === null)) return null;
  return parsed;
}

function valid_web_redirect_uri(value: unknown): boolean {
  const parsed = parsed_absolute_redirect_uri(value);
  return parsed !== null && parsed.scheme === "https" && parsed.hostname !== null;
}

function valid_private_use_scheme(scheme: string): boolean {
  const labels = scheme.split(".");
  return (
    labels.length >= 2 &&
    labels.every(
      (label) =>
        label.length > 0 &&
        /^[\x00-\x7f]*$/.test(label) &&
        /[A-Za-z0-9]/.test(label[0]) &&
        /[A-Za-z0-9]/.test(label[label.length - 1]) &&
        /^[A-Za-z0-9-]*$/.test(label),
    )
  );
}

function valid_native_redirect_uri(value: unknown): boolean {
  const parsed = parsed_absolute_redirect_uri(value);
  if (parsed === null) return false;
  if (parsed.scheme === "https") return parsed.hostname !== null;
  if (parsed.scheme === "http") {
    return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1";
  }
  return valid_private_use_scheme(parsed.scheme);
}

class IdPKey {
  constructor(
    public kid: string,
    public secret: Buffer,
    public issued_at: number,
  ) {}
}

class AuthorizationServer {
  issuer: string;
  keys: IdPKey[];
  clients: { [key: string]: Dict };
  authorization_codes: { [key: string]: Dict };

  constructor(options: { issuer?: string; keys?: IdPKey[]; clients?: { [key: string]: Dict } } = {}) {
    this.issuer = options.issuer ?? "https://auth.example.com";
    this.keys = options.keys ?? [];
    this.clients = options.clients ?? {};
    this.authorization_codes = {};
  }

  current_key(): IdPKey {
    return this.keys[this.keys.length - 1];
  }

  rotate_key(): IdPKey {
    const new_kid = `k_${Math.floor(nowSeconds())}_${tokenHex(2)}`;
    const key = new IdPKey(new_kid, randomBytes(32), nowSeconds());
    this.keys.push(key);
    if (this.keys.length > 2) this.keys = this.keys.slice(-2);
    return key;
  }

  jwks(): Dict {
    return {
      keys: this.keys.map((k) => ({ kid: k.kid, kty: "oct", alg: "HS256", use: "sig", k: b64url(k.secret) })),
    };
  }

  metadata(): Dict {
    return {
      issuer: this.issuer,
      authorization_endpoint: `${this.issuer}/authorize`,
      token_endpoint: `${this.issuer}/token`,
      jwks_uri: `${this.issuer}/.well-known/jwks.json`,
      registration_endpoint: `${this.issuer}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["mcp:tools.read", "mcp:tools.invoke"],
      token_endpoint_auth_methods_supported: ["none", "private_key_jwt"],
      authorization_response_iss_parameter_supported: true,
      client_id_metadata_document_supported: true,
    };
  }

  register_cimd(document_url: string, document: Dict): string {
    const parsed = urlparse(document_url);
    if (parsed.scheme !== "https" || !parsed.netloc || parsed.path === "" || parsed.path === "/") {
      throw new ValueError("CIMD client_id must be an absolute HTTPS URL with a path");
    }
    if (document["client_id"] !== document_url) throw new ValueError("CIMD client_id must equal its document URL");
    const client_name = document["client_name"];
    if (typeof client_name !== "string" || !pyStrip(client_name)) throw new ValueError("CIMD requires a non-empty client_name");
    const application_type = document["application_type"] ?? null;
    if (application_type !== null && application_type !== "native" && application_type !== "web") {
      throw new ValueError("CIMD application_type, when present, must be native or web");
    }
    const redirect_application_type = application_type || "native";
    const redirect_uris = "redirect_uris" in document ? document["redirect_uris"] : [];
    if (
      !Array.isArray(redirect_uris) ||
      redirect_uris.length === 0 ||
      redirect_uris.some((uri) => parsed_absolute_redirect_uri(uri) === null)
    ) {
      throw new ValueError("CIMD requires absolute redirect URIs without fragments");
    }
    if (redirect_application_type === "web" && redirect_uris.some((uri) => !valid_web_redirect_uri(uri))) {
      throw new ValueError("CIMD web clients require absolute HTTPS redirect URIs with a host and no fragment");
    }
    if (redirect_application_type === "native" && redirect_uris.some((uri) => !valid_native_redirect_uri(uri))) {
      throw new ValueError(
        "CIMD native clients require HTTPS, a loopback HTTP URI, or a domain-based private-use scheme",
      );
    }
    this.clients[document_url] = {
      redirect_uris,
      grant_types: "grant_types" in document ? document["grant_types"] : ["authorization_code"],
      application_type,
      client_name,
      enrollment: "cimd",
      issued_at: nowSeconds(),
    };
    return document_url;
  }

  register_client(body: Dict): Dict {
    const redirect_uris = "redirect_uris" in body ? body["redirect_uris"] : [];
    if (
      !Array.isArray(redirect_uris) ||
      redirect_uris.length === 0 ||
      redirect_uris.some((uri) => parsed_absolute_redirect_uri(uri) === null)
    ) {
      return { status: 400, body: { error: "invalid_redirect_uri" } };
    }
    const application_type = body["application_type"];
    if (application_type !== "native" && application_type !== "web") {
      return { status: 400, body: { error: "invalid_client_metadata" } };
    }
    if (application_type === "web" && redirect_uris.some((uri) => !valid_web_redirect_uri(uri))) {
      return { status: 400, body: { error: "invalid_redirect_uri" } };
    }
    if (application_type === "native" && redirect_uris.some((uri) => !valid_native_redirect_uri(uri))) {
      return { status: 400, body: { error: "invalid_redirect_uri" } };
    }
    const auth_method = "token_endpoint_auth_method" in body ? body["token_endpoint_auth_method"] : "none";
    if (auth_method !== "none" && auth_method !== "private_key_jwt") {
      return { status: 400, body: { error: "invalid_client_metadata" } };
    }
    const cid = `c_${tokenHex(4)}`;
    const reg_token = tokenUrlsafe(24);
    const grant_types = "grant_types" in body ? body["grant_types"] : ["authorization_code"];
    this.clients[cid] = {
      redirect_uris,
      grant_types,
      registration_access_token_hash: createHash("sha256").update(reg_token).digest("hex"),
      client_name: "client_name" in body ? body["client_name"] : "",
      application_type,
      enrollment: "dcr",
      issued_at: nowSeconds(),
    };
    return {
      status: 201,
      body: {
        client_id: cid,
        client_id_issued_at: Math.floor(nowSeconds()),
        redirect_uris,
        grant_types,
        application_type,
        registration_access_token: reg_token,
        registration_client_uri: `${this.issuer}/register/${cid}`,
      },
    };
  }

  pre_register_client(
    client_id: string,
    options: { redirect_uris: string[]; client_name: string; application_type?: string },
  ): string {
    const { redirect_uris, client_name } = options;
    const application_type = options.application_type ?? "native";
    if (!client_id || !redirect_uris || redirect_uris.length === 0 || !pyStrip(client_name)) {
      throw new ValueError("pre-registration requires client_id, client_name, and redirect_uris");
    }
    if (application_type !== "native" && application_type !== "web") {
      throw new ValueError("pre-registration application_type must be native or web");
    }
    if (!Array.isArray(redirect_uris) || redirect_uris.some((uri) => parsed_absolute_redirect_uri(uri) === null)) {
      throw new ValueError("pre-registration requires absolute redirect URIs without fragments");
    }
    if (application_type === "web" && redirect_uris.some((uri) => !valid_web_redirect_uri(uri))) {
      throw new ValueError("pre-registered web clients require absolute HTTPS redirect URIs with a host and no fragment");
    }
    if (application_type === "native" && redirect_uris.some((uri) => !valid_native_redirect_uri(uri))) {
      throw new ValueError(
        "pre-registered native clients require HTTPS redirect URIs, loopback HTTP redirect URIs, or a domain-based private-use scheme",
      );
    }
    this.clients[client_id] = {
      redirect_uris: [...redirect_uris],
      grant_types: ["authorization_code"],
      application_type,
      client_name,
      enrollment: "pre_registered",
      issued_at: nowSeconds(),
    };
    return client_id;
  }

  begin_authorization(options: {
    client_id: string;
    redirect_uri: string;
    code_challenge: string;
    code_challenge_method: string;
    scopes: Set<string>;
    resource: string;
    user: string;
  }): { [key: string]: string } {
    const client = this.clients[options.client_id];
    if (client === undefined) throw new ValueError("client is not enrolled with this issuer");
    if (!(client["redirect_uris"] ?? []).includes(options.redirect_uri)) {
      throw new ValueError("authorization redirect_uri is not registered");
    }
    if (typeof options.code_challenge !== "string" || !options.code_challenge) {
      throw new ValueError("authorization request requires an S256 code_challenge");
    }
    if (options.code_challenge_method !== "S256") {
      throw new ValueError("authorization request requires code_challenge_method S256");
    }
    const parsed_resource = urlparse(options.resource);
    if (parsed_resource.scheme !== "https" || !parsed_resource.netloc) {
      throw new ValueError("resource must be an absolute HTTPS URL");
    }
    const now = nowSeconds();
    const expired_codes = Object.entries(this.authorization_codes)
      .filter(([, record]) => record["expires_at"] <= now)
      .map(([code]) => code);
    for (const expired_code of expired_codes) delete this.authorization_codes[expired_code];
    let code = tokenUrlsafe(24);
    while (code in this.authorization_codes) code = tokenUrlsafe(24);
    this.authorization_codes[code] = {
      client_id: options.client_id,
      redirect_uri: options.redirect_uri,
      code_challenge: options.code_challenge,
      code_challenge_method: options.code_challenge_method,
      scopes: new Set(options.scopes),
      resource: options.resource,
      user: options.user,
      expires_at: now + AUTHORIZATION_CODE_TTL_SECONDS,
    };
    return { code, iss: this.issuer };
  }

  redeem_code(options: { code: string; client_id: string; redirect_uri: string; code_verifier: string; resource: string }): string {
    const record = this.authorization_codes[options.code];
    if (record === undefined) throw new ValueError("authorization code is invalid or already used");
    if (record["expires_at"] <= nowSeconds()) {
      delete this.authorization_codes[options.code];
      throw new ValueError("authorization code is expired");
    }
    if (record["client_id"] !== options.client_id || record["redirect_uri"] !== options.redirect_uri) {
      throw new ValueError("authorization code is not bound to this client redirect");
    }
    if (record["resource"] !== options.resource) {
      throw new ValueError("token resource does not match the authorization request");
    }
    const supplied_challenge = b64url(createHash("sha256").update(options.code_verifier).digest());
    if (!compareDigest(Buffer.from(record["code_challenge"]), Buffer.from(supplied_challenge))) {
      throw new ValueError("PKCE code_verifier does not match the stored challenge");
    }
    delete this.authorization_codes[options.code];
    return this.issue_token(options.client_id, record["user"], record["scopes"], record["resource"]);
  }

  issue_token(client_id: string, user: string, scopes: Set<string>, resource: string): string {
    if (!(client_id in this.clients)) throw new ValueError("client is not enrolled with this issuer");
    const key = this.current_key();
    const claims = {
      iss: this.issuer,
      sub: user,
      aud: resource,
      azp: client_id,
      scope: [...scopes].sort().join(" "),
      iat: Math.floor(nowSeconds()),
      exp: Math.floor(nowSeconds()) + 3600,
    };
    return jwt_sign(claims, key.kid, key.secret);
  }
}

class ResourceServer {
  resource: string;
  auth_server: AuthorizationServer;
  allowed_issuers: string[];
  jwks_cache: { [key: string]: Dict };

  constructor(options: { resource: string; auth_server: AuthorizationServer; allowed_issuers?: string[] }) {
    this.resource = options.resource;
    this.auth_server = options.auth_server;
    this.allowed_issuers = options.allowed_issuers ?? [];
    this.jwks_cache = {};
  }

  get resource_metadata(): string {
    return protected_resource_metadata_url(this.resource);
  }

  refresh_jwks(): Dict {
    const keys: Dict[] = this.auth_server.jwks()["keys"];
    this.jwks_cache[this.auth_server.issuer] = { keys, fetched_at: nowSeconds() };
    return { refreshed: true, kids: keys.map((k) => k["kid"]) };
  }

  cached_kids(): string[] {
    const entry = this.jwks_cache[this.auth_server.issuer] ?? { keys: [] };
    return entry["keys"].map((k: Dict) => k["kid"]);
  }

  validate(token: string, required_scope: string | null = null): Dict {
    const rm = this.resource_metadata;

    const challenge = (status: number, params: string): Dict => ({
      valid: false,
      status,
      www_authenticate: `Bearer ${params}`,
    });

    let header: Dict;
    let claims: Dict;
    try {
      [header, claims] = jwt_decode(token);
    } catch {
      return challenge(401, `error="invalid_token", error_description="malformed", resource_metadata="${rm}"`);
    }

    const iss = "iss" in claims ? claims["iss"] : "";
    if (!this.allowed_issuers.includes(iss)) {
      return challenge(401, `error="invalid_token", error_description="iss not allowed", resource_metadata="${rm}"`);
    }
    let cache: Dict | undefined = this.jwks_cache[iss];
    if (cache === undefined) {
      this.refresh_jwks();
      cache = this.jwks_cache[iss];
    }

    const findKey = (entry: Dict | undefined): Dict | undefined =>
      entry ? entry["keys"].find((k: Dict) => k["kid"] === (header["kid"] ?? null)) : undefined;
    let matching = findKey(cache);
    if (matching === undefined) {
      this.refresh_jwks();
      cache = this.jwks_cache[iss];
      matching = findKey(cache);
    }
    if (matching === undefined) {
      return challenge(401, `error="invalid_token", error_description="unknown kid", resource_metadata="${rm}"`);
    }

    if (!jwt_verify(token, b64url_decode(matching["k"]))) {
      return challenge(401, `error="invalid_token", error_description="bad signature", resource_metadata="${rm}"`);
    }
    if ((claims["aud"] ?? null) !== this.resource) {
      return challenge(401, `error="invalid_token", error_description="audience mismatch", resource_metadata="${rm}"`);
    }
    if (("exp" in claims ? claims["exp"] : 0) < nowSeconds()) {
      return challenge(401, `error="invalid_token", error_description="expired", resource_metadata="${rm}"`);
    }
    if (required_scope && !new Set(pySplitWhitespace("scope" in claims ? claims["scope"] : "")).has(required_scope)) {
      return challenge(403, `error="insufficient_scope", scope="${required_scope}", resource_metadata="${rm}"`);
    }
    return { valid: true, claims };
  }

  call_tool(tool: string, bearer: string): Dict {
    const required_scope = TOOL_SCOPES[tool] ?? DEFAULT_TOOL_SCOPE;
    const result = this.validate(bearer, required_scope);
    if (!result["valid"]) return { status: result["status"], "WWW-Authenticate": result["www_authenticate"] };
    return { status: 200, body: { tool, user: result["claims"]["sub"], ok: true } };
  }
}

class Client {
  name: string;
  auth_server: AuthorizationServer;
  client_metadata_url: string | null;
  client_metadata: Dict | null;
  pre_registered_client_ids_by_issuer: { [key: string]: string };
  client_ids_by_issuer: { [key: string]: string } = {};
  access_tokens_by_issuer_resource: Map<string, string> = new Map();
  expected_issuer: string | null = null;
  require_response_issuer = false;

  constructor(options: {
    name: string;
    auth_server: AuthorizationServer;
    client_metadata_url?: string | null;
    client_metadata?: Dict | null;
    pre_registered_client_ids_by_issuer?: { [key: string]: string };
  }) {
    this.name = options.name;
    this.auth_server = options.auth_server;
    this.client_metadata_url = options.client_metadata_url ?? null;
    this.client_metadata = options.client_metadata ?? null;
    this.pre_registered_client_ids_by_issuer = options.pre_registered_client_ids_by_issuer ?? {};
  }

  discover(): Dict {
    const meta = this.auth_server.metadata();
    if (meta["issuer"] !== this.auth_server.issuer) throw new ValueError("authorization metadata issuer mismatch");
    if (!meta["code_challenge_methods_supported"].includes("S256")) {
      throw new ValueError("authorization server does not advertise S256 PKCE");
    }
    if (!(meta["client_id_metadata_document_supported"] || "registration_endpoint" in meta)) {
      throw new ValueError("authorization server advertises no client enrollment path");
    }
    this.expected_issuer = meta["issuer"];
    this.require_response_issuer = Boolean(meta["authorization_response_iss_parameter_supported"]);
    return meta;
  }

  register(): string {
    const resp = this.auth_server.register_client({
      redirect_uris: ["http://127.0.0.1:7333/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type: "native",
      scope: "mcp:tools.invoke",
      client_name: this.name,
    });
    if (resp["status"] !== 201) throw new ValueError(`client registration failed: ${pyRepr(resp)}`);
    const issuer = this.auth_server.issuer;
    this.client_ids_by_issuer[issuer] = resp["body"]["client_id"];
    return this.client_ids_by_issuer[issuer];
  }

  enroll(): string {
    const meta = this.discover();
    const issuer = meta["issuer"];
    if (issuer in this.client_ids_by_issuer) return this.client_ids_by_issuer[issuer];
    const pre_registered = this.pre_registered_client_ids_by_issuer[issuer];
    if (pre_registered !== undefined) {
      if (!(pre_registered in this.auth_server.clients)) {
        throw new ValueError("pre-registered client_id is not known to this issuer");
      }
      this.client_ids_by_issuer[issuer] = pre_registered;
      return pre_registered;
    }
    if (meta["client_id_metadata_document_supported"]) {
      if (!this.client_metadata_url || !this.client_metadata || Object.keys(this.client_metadata).length === 0) {
        throw new ValueError("CIMD-capable issuer requires a client metadata document");
      }
      const client_id = this.auth_server.register_cimd(this.client_metadata_url, this.client_metadata);
      this.client_ids_by_issuer[issuer] = client_id;
      return client_id;
    }
    return this.register();
  }

  validate_authorization_response_issuer(returned_issuer: string | null): void {
    if (this.expected_issuer === null) throw new ValueError("authorization server metadata was not discovered");
    if (returned_issuer === null) {
      if (this.require_response_issuer) throw new ValueError("authorization response omitted required iss");
      return;
    }
    if (returned_issuer !== this.expected_issuer) throw new ValueError("authorization response issuer mismatch");
  }

  use_authorization_server(auth_server: AuthorizationServer): void {
    this.auth_server = auth_server;
    this.expected_issuer = null;
    this.require_response_issuer = false;
  }

  authorize(scopes: Set<string>, resource: string, user: string): string {
    const issuer = this.auth_server.issuer;
    const client_id = this.client_ids_by_issuer[issuer];
    if (client_id === undefined) throw new ValueError("client must enroll separately with this issuer");
    const redirect_uris: string[] = this.auth_server.clients[client_id]["redirect_uris"] ?? [];
    if (redirect_uris.length === 0) throw new ValueError("client has no registered redirect URI");
    const redirect_uri = redirect_uris[0];
    const verifier = tokenUrlsafe(32);
    const challenge = b64url(createHash("sha256").update(verifier).digest());
    const authorization_response = this.auth_server.begin_authorization({
      client_id,
      redirect_uri,
      code_challenge: challenge,
      code_challenge_method: "S256",
      scopes,
      resource,
      user,
    });
    this.validate_authorization_response_issuer(authorization_response["iss"] ?? null);
    const token = this.auth_server.redeem_code({
      code: authorization_response["code"],
      client_id,
      redirect_uri,
      code_verifier: verifier,
      resource,
    });
    this.access_tokens_by_issuer_resource.set(JSON.stringify([issuer, resource]), token);
    return token;
  }
}

function demo(): void {
  console.log("=".repeat(72));
  console.log("PHASE 13 LESSON 18 - MCP AUTH IN PRODUCTION");
  console.log("=".repeat(72));

  console.log("\n--- step 1: stand up the authorization server (two overlapping keys) ---");
  const auth = new AuthorizationServer();
  auth.rotate_key();
  auth.rotate_key();
  console.log(`  issuer=${auth.issuer}, keys=${pyRepr(auth.keys.map((k) => k.kid))}`);

  console.log("\n--- step 2: client discovers the authorization server (RFC 8414) ---");
  const cimd_url = "https://client.example.com/oauth/client.json";
  const client = new Client({
    name: "Example native client",
    auth_server: auth,
    client_metadata_url: cimd_url,
    client_metadata: {
      client_id: cimd_url,
      client_name: "Example native client",
      redirect_uris: ["http://127.0.0.1:7333/callback"],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
  });
  const meta = client.discover();
  console.log(`  issuer=${meta["issuer"]}, S256 PKCE supported`);
  console.log(`  CIMD supported=${pyRepr(meta["client_id_metadata_document_supported"])}`);

  console.log("\n--- step 3: client enrolls through CIMD without DCR ---");
  const cid = client.enroll();
  console.log(`  client_id metadata URL: ${cid}`);
  console.log(`  credential cache issuer keys: ${pyRepr(Object.keys(client.client_ids_by_issuer))}`);

  console.log("\n--- step 4: client runs PKCE authorization flow with resource indicator ---");
  const bearer = client.authorize(new Set(["mcp:tools.invoke"]), MCP_RESOURCE, "alice@example.com");
  console.log(`  bearer issued (kid=${auth.current_key().kid}, aud=${MCP_RESOURCE})`);

  console.log("\n--- step 5: MCP server validates the request, JWKS cache primed on first use ---");
  const server = new ResourceServer({ resource: MCP_RESOURCE, auth_server: auth, allowed_issuers: [auth.issuer] });
  let resp = server.call_tool("notes.list", bearer);
  console.log(`  server response: ${pyRepr(resp)}`);
  check(resp["status"] === 200);

  console.log("\n--- step 6: IdP rotates a key, scheduled refresh re-pulls the JWKS ---");
  console.log(`  cached kids before refresh: ${pyRepr(server.cached_kids())}`);
  auth.rotate_key();
  server.refresh_jwks();
  console.log(`  cached kids after refresh:  ${pyRepr(server.cached_kids())}`);

  console.log("\n--- step 7: existing token still validates (overlap window) ---");
  resp = server.call_tool("notes.list", bearer);
  console.log(`  server response: ${pyRepr(resp)}`);
  check(resp["status"] === 200);

  console.log("\n--- step 8: new token signed with new key validates against refreshed JWKS ---");
  const fresh_bearer = client.authorize(new Set(["mcp:tools.invoke"]), MCP_RESOURCE, "alice@example.com");
  const [fresh_header] = jwt_decode(fresh_bearer);
  console.log(`  fresh token kid: ${fresh_header["kid"]}`);
  resp = server.call_tool("notes.read", fresh_bearer);
  console.log(`  server response: ${pyRepr(resp)}`);
  check(resp["status"] === 200);

  console.log("\n--- step 9: audience-replay attempt against a different MCP resource ---");
  const other_server = new ResourceServer({ resource: OTHER_MCP_RESOURCE, auth_server: auth, allowed_issuers: [auth.issuer] });
  resp = other_server.call_tool("tasks.list", bearer);
  console.log(`  other server response: ${pyRepr(resp)}`);
  check(resp["status"] === 401);
  check(resp["WWW-Authenticate"].includes("audience mismatch"));

  console.log("\n--- bonus: step-up flow for a higher-privilege scope ---");
  const elevated = client.authorize(new Set(["mcp:tools.invoke", "mcp:tools.delete"]), MCP_RESOURCE, "alice@example.com");
  const elevated_resp = server.call_tool("notes.delete", elevated);
  console.log(`  server response: ${pyRepr(elevated_resp)}`);

  console.log("\n" + "=".repeat(72));
  console.log("DONE - issuer-bound enrollment, response iss, audience, and JWKS refresh");
  console.log("=".repeat(72));
}

demo();
