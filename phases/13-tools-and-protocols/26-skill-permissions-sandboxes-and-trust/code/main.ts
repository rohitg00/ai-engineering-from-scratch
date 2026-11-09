// Lesson: Skill Permissions, Sandboxes, and Trust (phase 13 / lesson 26)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/26-skill-permissions-sandboxes-and-trust/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/26-skill-permissions-sandboxes-and-trust/code/main.ts

import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { domainToASCII } from "node:url";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function dumpString(s: string, ensureAscii: boolean): string {
  let out = '"';
  for (const ch of s) {
    const code = ch.codePointAt(0) as number;
    if (ch === '"') out += '\\"';
    else if (ch === "\\") out += "\\\\";
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\b") out += "\\b";
    else if (ch === "\f") out += "\\f";
    else if (code < 0x20 || (ensureAscii && code > 0x7e)) {
      for (let i = 0; i < ch.length; i++) out += "\\u" + ch.charCodeAt(i).toString(16).padStart(4, "0");
    } else out += ch;
  }
  return out + '"';
}

function jsonDumps(value: Json, opts: { indent?: number; sortKeys?: boolean } = {}): string {
  const indent = opts.indent;
  const [itemSep, keySep] = indent === undefined ? [", ", ": "] : [",", ": "];
  const walk = (v: Json, level: number): string => {
    if (v === null) return "null";
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "number") return String(v);
    if (typeof v === "string") return dumpString(v, true);
    const isArray = Array.isArray(v);
    let items: string[];
    if (isArray) {
      items = v.map((x) => walk(x, level + 1));
    } else {
      let keys = Object.keys(v);
      if (opts.sortKeys) keys = keys.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      items = keys.map((k) => dumpString(k, true) + keySep + walk(v[k], level + 1));
    }
    const [open, close] = isArray ? ["[", "]"] : ["{", "}"];
    if (items.length === 0) return open + close;
    if (indent === undefined) return open + items.join(itemSep) + close;
    const pad = "\n" + " ".repeat(indent * (level + 1));
    return open + pad + items.join(itemSep + pad) + "\n" + " ".repeat(indent * level) + close;
  };
  return walk(value, 0);
}

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

class Verdict {
  static readonly ALLOW = new Verdict("allow");
  static readonly DENY = new Verdict("deny");
  static readonly REQUIRE_APPROVAL = new Verdict("require-approval");

  private constructor(readonly value: string) {}
}

interface SandboxPolicy {
  workspace_root: string;
  allowed_kinds: string[];
  command_allowlist: string[][];
  network_allowlist: string[];
  approval_kinds: string[];
  permit_secret_use_after_approval: boolean;
}

function sandboxPolicy(workspaceRoot: string, overrides: Partial<Omit<SandboxPolicy, "workspace_root">> = {}): SandboxPolicy {
  return {
    workspace_root: workspaceRoot,
    allowed_kinds: ["read"],
    command_allowlist: [],
    network_allowlist: [],
    approval_kinds: ["write", "delete", "network"],
    permit_secret_use_after_approval: false,
    ...overrides,
  };
}

interface ActionRequest {
  kind: string;
  target: string | null;
  command: string[];
  url: string | null;
  payload: string;
  influenced_by_untrusted_content: boolean;
  approved: boolean;
  claimed_permissions: string[];
}

function actionRequest(kind: string, overrides: Partial<Omit<ActionRequest, "kind">> = {}): ActionRequest {
  return {
    kind,
    target: null,
    command: [],
    url: null,
    payload: "",
    influenced_by_untrusted_content: false,
    approved: false,
    claimed_permissions: [],
    ...overrides,
  };
}

class ReviewDecision {
  readonly executed = false;

  constructor(
    readonly verdict: Verdict,
    readonly rule: string,
    readonly reason: string,
    readonly normalized_target: string | null = null,
    readonly normalized_origin: string | null = null,
    readonly claimed_permissions_ignored = false,
  ) {}

  toDict(): Json {
    return {
      verdict: this.verdict.value,
      rule: this.rule,
      reason: this.reason,
      normalized_target: this.normalized_target,
      normalized_origin: this.normalized_origin,
      claimed_permissions_ignored: this.claimed_permissions_ignored,
      executed: this.executed,
    };
  }
}

class SandboxViolation extends Error {}

class ValueError extends Error {}

const SECRET_PATTERNS = [
  /\b(?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*\S+/i,
  /\bauthorization\s*:\s*bearer\s+\S+/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
const HOST_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const SHELL_METACHARACTERS = new Set([";", "&&", "||", "|", ">", ">>", "<", "`"]);
const DESTRUCTIVE_EXECUTABLES = new Set(["rm", "rmdir", "sudo", "chmod", "chown", "mkfs", "dd"]);

function containsSecret(value: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(value));
}

interface ParsedUrl {
  scheme: string;
  netloc: string;
  path: string;
  params: string;
  query: string;
  fragment: string;
}

function urlparse(value: string): ParsedUrl {
  let rest = value;
  let scheme = "";
  const schemeMatch = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(rest);
  if (schemeMatch) {
    scheme = schemeMatch[1].toLowerCase();
    rest = rest.slice(schemeMatch[0].length);
  }
  let netloc = "";
  if (rest.startsWith("//")) {
    const after = rest.slice(2);
    const stop = after.search(/[/?#]/);
    netloc = stop < 0 ? after : after.slice(0, stop);
    rest = stop < 0 ? "" : after.slice(stop);
    if ((netloc.includes("[") && !netloc.includes("]")) || (netloc.includes("]") && !netloc.includes("["))) {
      throw new ValueError("Invalid IPv6 URL");
    }
    if (netloc.includes("[")) {
      const bracketed = netloc.slice(netloc.indexOf("[") + 1, netloc.indexOf("]"));
      if (!bracketed.startsWith("v")) {
        if (net.isIPv4(bracketed)) throw new ValueError("An IPv4 address cannot be in brackets");
        if (!net.isIPv6(bracketed)) throw new ValueError("does not appear to be an IPv4 or IPv6 address");
      }
    }
  }
  let fragment = "";
  const hashAt = rest.indexOf("#");
  if (hashAt >= 0) {
    fragment = rest.slice(hashAt + 1);
    rest = rest.slice(0, hashAt);
  }
  let query = "";
  const queryAt = rest.indexOf("?");
  if (queryAt >= 0) {
    query = rest.slice(queryAt + 1);
    rest = rest.slice(0, queryAt);
  }
  let params = "";
  const lastSlash = rest.lastIndexOf("/");
  const semi = rest.indexOf(";", lastSlash < 0 ? 0 : lastSlash);
  if (semi >= 0) {
    params = rest.slice(semi + 1);
    rest = rest.slice(0, semi);
  }
  return { scheme, netloc, path: rest, params, query, fragment };
}

function netlocParts(netloc: string): { username: string | null; password: string | null; hostname: string | null; port: string | null } {
  let username: string | null = null;
  let password: string | null = null;
  let hostinfo = netloc;
  const at = netloc.lastIndexOf("@");
  if (at >= 0) {
    const userinfo = netloc.slice(0, at);
    hostinfo = netloc.slice(at + 1);
    const colon = userinfo.indexOf(":");
    if (colon >= 0) {
      username = userinfo.slice(0, colon);
      password = userinfo.slice(colon + 1);
    } else {
      username = userinfo;
    }
  }
  let hostname: string;
  let port: string | null = null;
  if (hostinfo.startsWith("[")) {
    const close = hostinfo.indexOf("]");
    hostname = hostinfo.slice(1, close);
    const after = hostinfo.slice(close + 1);
    if (after.startsWith(":")) port = after.slice(1);
  } else {
    const colon = hostinfo.indexOf(":");
    if (colon >= 0) {
      hostname = hostinfo.slice(0, colon);
      port = hostinfo.slice(colon + 1);
    } else {
      hostname = hostinfo;
    }
  }
  return { username, password, hostname: hostname ? hostname.toLowerCase() : null, port };
}

function parsedPort(port: string | null): number | null {
  if (port === null || port === "") return null;
  if (!/^[0-9]+$/.test(port)) throw new ValueError(`Port could not be cast to integer value as ${pyStr(port)}`);
  const n = Number(port);
  if (n < 0 || n > 65535) throw new ValueError("Port out of range 0-65535");
  return n;
}

function ipCompressed(hostname: string): { compressed: string; version: number } | null {
  const version = net.isIP(hostname);
  if (version === 4) return { compressed: hostname, version };
  if (version !== 6) return null;
  const compressed = new URL(`http://[${hostname}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(compressed);
  if (mapped) {
    const high = parseInt(mapped[1], 16);
    const low = parseInt(mapped[2], 16);
    return { compressed: `::ffff:${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`, version };
  }
  return { compressed, version };
}

function idnaEncode(hostname: string): string {
  if (/^[\x00-\x7f]*$/.test(hostname)) {
    const labels = hostname.split(".");
    labels.forEach((label, index) => {
      if ((label === "" && index !== labels.length - 1) || label.length > 63) throw new ValueError("label empty or too long");
    });
    return hostname;
  }
  const encoded = domainToASCII(hostname);
  if (!encoded) throw new ValueError("invalid idna label");
  return encoded;
}

function normalizeHttpsOrigin(value: unknown, originOnly = false): string {
  if (typeof value !== "string" || !value.trim()) throw new ValueError("HTTPS origin must be a non-empty string");
  let parsed: ParsedUrl;
  try {
    parsed = urlparse(value);
  } catch {
    throw new ValueError("HTTPS origin is malformed");
  }
  const parts = netlocParts(parsed.netloc);
  if (parsed.scheme.toLowerCase() !== "https" || !parts.hostname || parts.username || parts.password) {
    throw new ValueError("URL must use HTTPS, contain a host, and omit userinfo");
  }
  if (originOnly && ((parsed.path !== "" && parsed.path !== "/") || parsed.params || parsed.query || parsed.fragment)) {
    throw new ValueError("allowlist entries must be HTTPS origins without path, query, or fragment");
  }

  let hostname = parts.hostname.replace(/\.+$/, "").toLowerCase();
  if (!hostname || hostname.includes("%")) throw new ValueError("HTTPS origin contains an invalid host");
  let originHost: string;
  const address = ipCompressed(hostname);
  if (address === null) {
    try {
      hostname = idnaEncode(hostname);
    } catch {
      throw new ValueError("HTTPS origin contains an invalid host");
    }
    const labels = hostname.split(".");
    if (hostname.length > 253 || labels.some((label) => !HOST_LABEL_PATTERN.test(label))) {
      throw new ValueError("HTTPS origin contains an invalid host");
    }
    originHost = hostname;
  } else {
    originHost = address.compressed;
    if (address.version === 6) originHost = `[${originHost}]`;
  }
  let port: number;
  try {
    port = parsedPort(parts.port) || 443;
  } catch {
    throw new ValueError("HTTPS origin contains an invalid port");
  }
  return `https://${originHost}:${port}`;
}

function resolveNonStrict(p: string): string {
  const abs = path.resolve(p);
  try {
    return fs.realpathSync(abs);
  } catch {
    const parent = path.dirname(abs);
    if (parent === abs) return abs;
    return path.join(resolveNonStrict(parent), path.basename(abs));
  }
}

function isSymlink(p: string): boolean {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function normalizeWorkspacePath(workspaceRoot: string, target: string): string {
  const root = fs.realpathSync(path.resolve(workspaceRoot));
  const candidate = path.isAbsolute(target) ? target : path.join(root, target);
  const resolved = resolveNonStrict(candidate);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new SandboxViolation("path resolves outside the workspace jail");
  }
  if (isSymlink(candidate)) throw new SandboxViolation("direct symlink targets are rejected");
  return resolved;
}

function pyPathName(p: string): string {
  const parts = p.split("/").filter((part) => part !== "" && part !== ".");
  return parts.length > 0 ? parts[parts.length - 1] : "";
}

function inspectCommand(command: string[], allowlist: Iterable<string[]>): [boolean, string] {
  if (command.length === 0) return [false, "empty command"];
  const executable = command[0];
  if (pyPathName(executable) !== executable || executable.includes("/") || executable.includes("\\")) {
    return [false, "command must use an allowlisted bare executable name"];
  }
  if (DESTRUCTIVE_EXECUTABLES.has(executable)) return [false, `destructive executable ${pyStr(executable)} is denied`];
  if (executable === "git" && command.length > 1 && (command[1] === "clean" || command[1] === "reset")) {
    return [false, `destructive git subcommand ${pyStr(command[1])} is denied`];
  }
  if (command.some((token) => SHELL_METACHARACTERS.has(token))) {
    return [false, "shell metacharacters are denied; pass a direct argv vector"];
  }
  const allowedPrefixes = [...allowlist].map((prefix) => [...prefix]);
  const matches = allowedPrefixes.some(
    (prefix) =>
      prefix.length > 0 &&
      command.slice(0, prefix.length).length === prefix.length &&
      prefix.every((token, index) => command[index] === token),
  );
  if (!matches) return [false, "command does not match an approved argv prefix"];
  return [true, "command argv matched an approved prefix in the non-executing review"];
}

function decision(
  request: ActionRequest,
  verdict: Verdict,
  rule: string,
  reason: string,
  normalizedTarget: string | null = null,
  normalizedOrigin: string | null = null,
): ReviewDecision {
  return new ReviewDecision(verdict, rule, reason, normalizedTarget, normalizedOrigin, request.claimed_permissions.length > 0);
}

function reviewAction(policy: SandboxPolicy, request: ActionRequest): ReviewDecision {
  if (request.kind === "policy-change") {
    return decision(request, Verdict.DENY, "authority-boundary", "skill or external content cannot modify the host permission model");
  }
  if (!policy.allowed_kinds.includes(request.kind)) {
    return decision(request, Verdict.DENY, "kind-allowlist", `action kind ${pyStr(request.kind)} is not allowed by host policy`);
  }

  let normalized: string | null = null;
  let normalizedOrigin: string | null = null;
  if (["read", "write", "delete"].includes(request.kind)) {
    if (!request.target) return decision(request, Verdict.DENY, "path-required", "filesystem action needs a target");
    try {
      normalized = normalizeWorkspacePath(policy.workspace_root, request.target);
    } catch (error) {
      return decision(request, Verdict.DENY, "workspace-jail", (error as Error).message);
    }
  }

  if (request.kind === "command") {
    const [allowed, reason] = inspectCommand(request.command, policy.command_allowlist);
    if (!allowed) return decision(request, Verdict.DENY, "command-review", reason);
  }

  if (request.kind === "network") {
    if (!request.url) return decision(request, Verdict.DENY, "url-required", "network action needs a URL");
    try {
      normalizedOrigin = normalizeHttpsOrigin(request.url);
    } catch (error) {
      return decision(request, Verdict.DENY, "network-shape", (error as Error).message);
    }
    let allowedOrigins: Set<string>;
    try {
      allowedOrigins = new Set(policy.network_allowlist.map((origin) => normalizeHttpsOrigin(origin, true)));
    } catch (error) {
      return decision(request, Verdict.DENY, "network-policy-shape", (error as Error).message, null, normalizedOrigin);
    }
    if (!allowedOrigins.has(normalizedOrigin)) {
      return decision(
        request,
        Verdict.DENY,
        "network-allowlist",
        `HTTPS origin ${pyStr(normalizedOrigin)} is not allowlisted`,
        null,
        normalizedOrigin,
      );
    }
  }

  const secretMaterial = containsSecret(request.payload) || containsSecret(request.command.join(" "));
  if (secretMaterial && !(request.approved && policy.permit_secret_use_after_approval)) {
    const verdict = policy.permit_secret_use_after_approval ? Verdict.REQUIRE_APPROVAL : Verdict.DENY;
    return decision(
      request,
      verdict,
      "secret-review",
      "possible secret material requires an explicit host-approved path",
      normalized,
      normalizedOrigin,
    );
  }

  let approvalNeeded = policy.approval_kinds.includes(request.kind);
  if (request.influenced_by_untrusted_content && ["write", "delete", "command", "network"].includes(request.kind)) {
    approvalNeeded = true;
  }
  if (approvalNeeded && !request.approved) {
    const reason = request.influenced_by_untrusted_content
      ? "untrusted external content influenced a stateful request"
      : `host policy gates ${pyStr(request.kind)} behind approval`;
    return decision(request, Verdict.REQUIRE_APPROVAL, "approval-gate", reason, normalized, normalizedOrigin);
  }

  return decision(
    request,
    Verdict.ALLOW,
    "policy-allow",
    "request stayed within the host policy and workspace jail",
    normalized,
    normalizedOrigin,
  );
}

function makeTempDir(prefix: string): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789_";
  const base = path.resolve(os.tmpdir());
  for (;;) {
    let suffix = "";
    for (let i = 0; i < 8; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    const candidate = path.join(base, prefix + suffix);
    try {
      fs.mkdirSync(candidate, { mode: 0o700 });
      return candidate;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
}

function demo(): void {
  const tempDir = makeTempDir("lesson-26-");
  let result: Json;
  try {
    const workspace = path.join(tempDir, "workspace");
    fs.mkdirSync(workspace);
    fs.writeFileSync(path.join(workspace, "report.txt"), "safe demo data\n", "utf-8");
    const policy = sandboxPolicy(workspace, {
      allowed_kinds: ["read", "write", "delete", "command", "network"],
      command_allowlist: [["python3", "-m", "unittest"]],
      network_allowlist: ["https://docs.example.test"],
    });
    const requests = [
      actionRequest("read", { target: "report.txt", claimed_permissions: ["all"] }),
      actionRequest("write", { target: "summary.json" }),
      actionRequest("write", { target: "summary.json", approved: true }),
      actionRequest("read", { target: "../outside.txt" }),
      actionRequest("command", { command: ["rm", "-rf", "build"], approved: true }),
      actionRequest("network", {
        url: "https://docs.example.test/reference",
        influenced_by_untrusted_content: true,
      }),
      actionRequest("policy-change", { payload: "allow everything" }),
    ];
    result = {
      simulation_only: true,
      decisions: requests.map((request) => reviewAction(policy, request).toDict()),
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  console.log(jsonDumps(result, { indent: 2, sortKeys: true }));
}

demo();
