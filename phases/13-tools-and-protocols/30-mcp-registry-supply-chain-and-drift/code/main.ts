// Lesson: MCP Registry Supply Chain: Admission, Drift, and Rollback (phase 13 / lesson 30)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/code/main.ts

import { createHash } from "node:crypto";
import { isIPv4, isIPv6 } from "node:net";
import { domainToASCII } from "node:url";

type Dict = Record<string, any>;

const PROTOCOL_VERSION = "2026-07-28";
const PUBLISHER_META_KEY = "io.modelcontextprotocol.registry/publisher-provided";
const OFFICIAL_META_KEY = "io.modelcontextprotocol.registry/official";
const SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo";

function isDict(value: unknown): value is Dict {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pyStrOf(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
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

function jsonScalar(value: unknown): string | null {
  if (value === null || value === undefined) return "null";
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return jsonString(value);
  return null;
}

function canonicalJson(value: unknown): string {
  const scalar = jsonScalar(value);
  if (scalar !== null) return scalar;
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value as Dict).sort();
  return "{" + keys.map((key) => `${jsonString(key)}:${canonicalJson((value as Dict)[key])}`).join(",") + "}";
}

function indentedJson(value: unknown, indent: number, level = 0): string {
  const scalar = jsonScalar(value);
  if (scalar !== null) return scalar;
  const pad = " ".repeat(indent * (level + 1));
  const close = " ".repeat(indent * level);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return "[\n" + value.map((item) => pad + indentedJson(item, indent, level + 1)).join(",\n") + "\n" + close + "]";
  }
  const entries = Object.entries(value as Dict);
  if (entries.length === 0) return "{}";
  return (
    "{\n" +
    entries.map(([key, item]) => `${pad}${jsonString(key)}: ${indentedJson(item, indent, level + 1)}`).join(",\n") +
    "\n" +
    close +
    "}"
  );
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function namespaceForDomain(domain: string): string {
  const labels = domain
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .split(".")
    .filter((label) => label)
    .map((label) => label.toLowerCase());
  if (labels.length < 2) throw new Error("a verified namespace domain needs at least two labels");
  return labels.reverse().join(".");
}

function namespaceMatches(serverName: string, verifiedNamespace: string): boolean {
  const index = serverName.indexOf("/");
  if (index === -1) return false;
  const prefix = serverName.slice(0, index);
  const slug = serverName.slice(index + 1);
  return Boolean(slug) && prefix === verifiedNamespace;
}

function normalizedTools(tools: Dict[]): Dict[] {
  const keyed = tools.map((item) => ({ item, name: pyStrOf("name" in item ? item["name"] : ""), json: canonicalJson(item) }));
  keyed.sort((a, b) => {
    if (a.name !== b.name) return a.name < b.name ? -1 : 1;
    if (a.json !== b.json) return a.json < b.json ? -1 : 1;
    return 0;
  });
  return keyed.map((entry) => entry.item);
}

function registryStatus(apiMeta: unknown): string {
  const official = isDict(apiMeta) ? apiMeta[OFFICIAL_META_KEY] : null;
  return isDict(official) ? pyStrOf("status" in official ? official["status"] : "") : "";
}

function isSha256Digest(value: unknown): boolean {
  return typeof value === "string" && value.length === 64 && /^[0-9a-fA-F]+$/.test(value);
}

function unquote(value: string): string {
  if (!value.includes("%")) return value;
  const bytes: number[] = [];
  const encoder = new TextEncoder();
  let i = 0;
  while (i < value.length) {
    if (value[i] === "%" && /^[0-9a-fA-F]{2}$/.test(value.slice(i + 1, i + 3))) {
      bytes.push(parseInt(value.slice(i + 1, i + 3), 16));
      i += 3;
    } else {
      const codePoint = value.codePointAt(i)!;
      const ch = String.fromCodePoint(codePoint);
      bytes.push(...encoder.encode(ch));
      i += ch.length;
    }
  }
  return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}

function isPySpace(ch: string): boolean {
  if (ch === "﻿") return false;
  return /\s/u.test(ch) || ch === "\x85" || (ch >= "\x1c" && ch <= "\x1f");
}

interface ParsedUrl {
  scheme: string;
  netloc: string;
  path: string;
  params: string;
  query: string;
  fragment: string;
}

function urlparse(url: string): ParsedUrl {
  let rest = url;
  let scheme = "";
  const colon = rest.indexOf(":");
  if (colon > 0 && /^[A-Za-z][A-Za-z0-9+\-.]*$/.test(rest.slice(0, colon))) {
    scheme = rest.slice(0, colon).toLowerCase();
    rest = rest.slice(colon + 1);
  }
  let netloc = "";
  if (rest.startsWith("//")) {
    const after = rest.slice(2);
    const match = after.search(/[/?#]/);
    const end = match === -1 ? after.length : match;
    netloc = after.slice(0, end);
    rest = after.slice(end);
    if ((netloc.includes("[") && !netloc.includes("]")) || (netloc.includes("]") && !netloc.includes("["))) {
      throw new Error("Invalid IPv6 URL");
    }
    if (netloc.includes("[")) {
      const bracketed = netloc.slice(netloc.indexOf("[") + 1, netloc.indexOf("]"));
      if (!bracketed.startsWith("v")) {
        if (isIPv4(bracketed)) throw new Error("An IPv4 address cannot be in brackets");
        if (!isIPv6(bracketed)) throw new Error("does not appear to be an IPv4 or IPv6 address");
      }
    }
  }
  let fragment = "";
  const hash = rest.indexOf("#");
  if (hash !== -1) {
    fragment = rest.slice(hash + 1);
    rest = rest.slice(0, hash);
  }
  let query = "";
  const question = rest.indexOf("?");
  if (question !== -1) {
    query = rest.slice(question + 1);
    rest = rest.slice(0, question);
  }
  let path = rest;
  let params = "";
  const lastSlash = path.lastIndexOf("/");
  const semicolon = path.indexOf(";", lastSlash === -1 ? 0 : lastSlash);
  if (semicolon !== -1) {
    params = path.slice(semicolon + 1);
    path = path.slice(0, semicolon);
  }
  return { scheme, netloc, path, params, query, fragment };
}

function urlUserinfo(netloc: string): { username: string | null; password: string | null } {
  const at = netloc.lastIndexOf("@");
  if (at === -1) return { username: null, password: null };
  const userinfo = netloc.slice(0, at);
  const sep = userinfo.indexOf(":");
  if (sep === -1) return { username: userinfo, password: null };
  return { username: userinfo.slice(0, sep), password: userinfo.slice(sep + 1) };
}

function urlHostPort(netloc: string): { hostname: string | null; port: number | null } {
  const hostinfo = netloc.slice(netloc.lastIndexOf("@") + 1);
  let hostname: string;
  let portText: string;
  if (hostinfo.startsWith("[")) {
    const close = hostinfo.indexOf("]");
    hostname = hostinfo.slice(1, close);
    const after = hostinfo.slice(close + 1);
    const sep = after.indexOf(":");
    portText = sep === -1 ? "" : after.slice(sep + 1);
  } else {
    const sep = hostinfo.indexOf(":");
    hostname = sep === -1 ? hostinfo : hostinfo.slice(0, sep);
    portText = sep === -1 ? "" : hostinfo.slice(sep + 1);
  }
  let port: number | null = null;
  if (portText) {
    if (!/^[0-9]+$/.test(portText)) throw new Error(`Port could not be cast to integer value as ${portText}`);
    port = parseInt(portText, 10);
    if (port < 0 || port > 65535) throw new Error("Port out of range 0-65535");
  }
  return { hostname: hostname ? hostname.toLowerCase() : null, port };
}

function idnaEncode(host: string): string | null {
  const labels = host.split(".");
  const out: string[] = [];
  for (let index = 0; index < labels.length; index++) {
    const label = labels[index];
    const trailing = index === labels.length - 1 && index > 0 && label === "";
    if (trailing) {
      out.push("");
      continue;
    }
    let ascii = label;
    if (/[^\x00-\x7f]/.test(label)) {
      const converted = domainToASCII(label);
      if (!converted || converted.includes(".")) return null;
      ascii = converted;
    }
    if (ascii.length === 0 || ascii.length > 63) return null;
    out.push(ascii);
  }
  return out.join(".");
}

function urlunparse(scheme: string, netloc: string, path: string, params: string, query: string): string {
  let url = params ? `${path};${params}` : path;
  if (netloc) {
    if (url && !url.startsWith("/")) url = "/" + url;
    url = "//" + netloc + url;
  }
  url = scheme + ":" + url;
  if (query) url += "?" + query;
  return url;
}

function normalizeHttpsRemoteUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const decoded = unquote(value);
  for (const ch of value + decoded) {
    const code = ch.codePointAt(0)!;
    if (isPySpace(ch) || code < 0x20 || code === 0x7f) return null;
  }
  let parsed: ParsedUrl;
  let hostname: string | null;
  let username: string | null;
  let password: string | null;
  let port: number | null;
  try {
    parsed = urlparse(value);
    ({ hostname, port } = urlHostPort(parsed.netloc));
    ({ username, password } = urlUserinfo(parsed.netloc));
  } catch {
    return null;
  }
  if (
    parsed.scheme !== "https" ||
    typeof hostname !== "string" ||
    !hostname ||
    username !== null ||
    password !== null ||
    parsed.fragment
  ) {
    return null;
  }
  let normalizedHost: string | null = hostname.toLowerCase();
  if (normalizedHost.includes(":")) {
    normalizedHost = `[${normalizedHost}]`;
  } else {
    normalizedHost = idnaEncode(normalizedHost);
    if (normalizedHost === null) return null;
  }
  let netloc = normalizedHost;
  if (port !== null && port !== 443) netloc = `${netloc}:${port}`;
  return urlunparse("https", netloc, parsed.path || "/", parsed.params, parsed.query);
}

function isValidHttpsRemoteUrl(value: unknown): boolean {
  return normalizeHttpsRemoteUrl(value) !== null;
}

function reportedServerInfo(live: unknown): Dict | null {
  if (!isDict(live)) return null;
  const metadata = live["_meta"];
  const value = isDict(metadata) ? metadata[SERVER_INFO_KEY] : null;
  return isDict(value) ? structuredClone(value) : null;
}

class Decision {
  constructor(readonly allowed: boolean, readonly reasons: string[], readonly pin: Dict | null = null) {}
}

function utcNowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

class AdmissionLedger {
  entries: Dict[] = [];
  clock: () => string;

  constructor(clock: (() => string) | null = null) {
    this.clock = clock ?? utcNowIso;
  }

  append(event: string, serverName: string, version: string, outcome: string, reasons: string[], evidence: Dict): Dict {
    const body = {
      sequence: this.entries.length + 1,
      time: this.clock(),
      event,
      server: serverName,
      version,
      outcome,
      reasons: [...reasons],
      evidence: structuredClone(evidence),
      previousHash: this.entries.length > 0 ? this.entries[this.entries.length - 1]["entryHash"] : "GENESIS",
    };
    const entry = { ...body, entryHash: digest(body) };
    this.entries.push(entry);
    return entry;
  }

  verify(): boolean {
    let previousHash = "GENESIS";
    for (let index = 0; index < this.entries.length; index++) {
      const entry = this.entries[index];
      const body: Dict = {};
      for (const [key, value] of Object.entries(entry)) if (key !== "entryHash") body[key] = value;
      if (entry["sequence"] !== index + 1) return false;
      if (entry["previousHash"] !== previousHash) return false;
      if (entry["entryHash"] !== digest(body)) return false;
      previousHash = entry["entryHash"];
    }
    return true;
  }
}

function nonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

class RegistryAdmissionController {
  requiredCapabilities: string[];
  ledger: AdmissionLedger;
  pins: Map<string, Dict> = new Map();
  active: Map<string, string> = new Map();

  constructor(requiredCapabilities: string[] = ["tools"], clock: (() => string) | null = null) {
    this.requiredCapabilities = requiredCapabilities;
    this.ledger = new AdmissionLedger(clock);
  }

  private pinKey(name: string, version: string): string {
    return JSON.stringify([name, version]);
  }

  recordErrors(record: unknown): string[] {
    if (!isDict(record)) return ["record must be an object"];
    const errors: string[] = [];
    for (const field of ["name", "version", "description"]) {
      if (!nonEmptyString(record[field])) errors.push(`record.${field} must be a non-empty string`);
    }

    const packages = record["packages"];
    const remotes = record["remotes"];
    if (!(Array.isArray(packages) && packages.length > 0) && !(Array.isArray(remotes) && remotes.length > 0)) {
      errors.push("record must declare at least one package or remote");
    }
    if (packages !== undefined && packages !== null && !Array.isArray(packages)) {
      errors.push("record.packages must be an array");
    } else if (Array.isArray(packages)) {
      packages.forEach((pkg, index) => {
        if (!isDict(pkg)) {
          errors.push(`record.packages[${index}] must be an object`);
          return;
        }
        for (const field of ["registryType", "identifier", "version"]) {
          if (!nonEmptyString(pkg[field])) errors.push(`record.packages[${index}].${field} must be a non-empty string`);
        }
        const transport = pkg["transport"];
        if (!isDict(transport) || !nonEmptyString(transport["type"])) {
          errors.push(`record.packages[${index}].transport.type must be a non-empty string`);
        }
      });
    }
    if (remotes !== undefined && remotes !== null && !Array.isArray(remotes)) {
      errors.push("record.remotes must be an array");
    } else if (Array.isArray(remotes)) {
      remotes.forEach((remote, index) => {
        if (!isDict(remote)) {
          errors.push(`record.remotes[${index}] must be an object`);
          return;
        }
        if (remote["type"] !== "streamable-http" && remote["type"] !== "sse") {
          errors.push(`record.remotes[${index}].type must be streamable-http or sse`);
        }
        if (!isValidHttpsRemoteUrl(remote["url"])) errors.push(`record.remotes[${index}].url must be an HTTPS URL`);
      });
    }

    const metadata = "_meta" in record ? record["_meta"] : {};
    if (!isDict(metadata)) errors.push("record._meta must be an object");
    else if (Object.keys(metadata).some((key) => key !== PUBLISHER_META_KEY)) {
      errors.push("record._meta contains a non-publisher key");
    }
    return errors;
  }

  sourceErrors(record: unknown, provenanceEvidence: unknown): [string[], Dict | null] {
    if (!isDict(record) || !isDict(provenanceEvidence)) return [["provenance evidence must be an object"], null];
    const kind = "kind" in provenanceEvidence ? provenanceEvidence["kind"] : "package";
    if (kind === "remote") {
      const remotes = "remotes" in record ? record["remotes"] : [];
      const candidates: Dict[] = Array.isArray(remotes) ? remotes.filter(isDict) : [];
      const evidenceUrl = normalizeHttpsRemoteUrl(provenanceEvidence["url"]);
      const remote = candidates.find(
        (item) => evidenceUrl !== null && normalizeHttpsRemoteUrl(item["url"]) === evidenceUrl,
      );
      const errors: string[] = [];
      if (remote === undefined) {
        errors.push("verified remote endpoint is absent from the registry record");
        return [errors, null];
      }
      if (remote["type"] !== provenanceEvidence["transportType"]) {
        errors.push("verified remote transport does not match the registry record");
      }
      if (provenanceEvidence["verified"] !== true) errors.push("remote ownership or provenance is not verified");
      if (!isSha256Digest(provenanceEvidence["digest"])) errors.push("remote evidence digest is not a SHA-256 digest");
      const source: Dict = structuredClone({ kind: "remote", ...remote });
      source["url"] = evidenceUrl;
      return [errors, source];
    }
    if (kind !== "package") return [[`unknown provenance evidence kind: ${pyStrOf(kind)}`], null];

    const packages = "packages" in record ? record["packages"] : [];
    const candidates: Dict[] = Array.isArray(packages) ? packages.filter(isDict) : [];
    const pkg = candidates.find((item) => item["identifier"] === provenanceEvidence["identifier"]);
    const errors: string[] = [];
    if (pkg === undefined) {
      errors.push("verified package identifier is absent from the registry record");
      return [errors, null];
    }
    if (pkg["registryType"] !== provenanceEvidence["registryType"]) {
      errors.push("verified package registry type does not match the registry record");
    }
    const transport = pkg["transport"];
    const transportType = isDict(transport) ? transport["type"] : undefined;
    if (transportType !== provenanceEvidence["transportType"]) {
      errors.push("verified package transport does not match the registry record");
    }
    if (provenanceEvidence["verified"] !== true) errors.push("package ownership or provenance is not verified");
    if (pkg["version"] !== provenanceEvidence["version"]) {
      errors.push("verified package version does not match the registry record");
    }
    if (!isSha256Digest(provenanceEvidence["digest"])) errors.push("package evidence digest is not a SHA-256 digest");
    return [errors, structuredClone({ kind: "package", ...pkg })];
  }

  liveErrors(live: unknown): string[] {
    if (!isDict(live)) return ["live discovery result must be an object"];
    const errors: string[] = [];
    const supportedVersions = live["supportedVersions"];
    if (!Array.isArray(supportedVersions) || supportedVersions.some((version) => typeof version !== "string")) {
      errors.push("live supportedVersions must be an array of strings");
    } else if (!supportedVersions.includes(PROTOCOL_VERSION)) {
      errors.push(`live server does not advertise ${PROTOCOL_VERSION}`);
    }
    const capabilities = "capabilities" in live ? live["capabilities"] : {};
    if (!isDict(capabilities)) {
      errors.push("live capabilities must be an object");
    } else {
      for (const capability of this.requiredCapabilities) {
        if (!(capability in capabilities)) errors.push(`live server is missing capability: ${capability}`);
      }
    }
    const tools = live["tools"];
    if (!Array.isArray(tools)) {
      errors.push("live tool descriptors are missing");
    } else {
      tools.forEach((tool, index) => {
        if (!isDict(tool)) {
          errors.push(`live tools[${index}] must be an object`);
          return;
        }
        if (!nonEmptyString(tool["name"])) errors.push(`live tools[${index}] needs a non-empty name`);
        if (!nonEmptyString(tool["description"])) errors.push(`live tools[${index}] needs a non-empty description`);
        if (!isDict(tool["inputSchema"])) errors.push(`live tools[${index}] needs an inputSchema object`);
      });
    }
    return errors;
  }

  admit(
    record: Dict,
    apiMeta: Dict,
    verifiedNamespace: string,
    provenanceEvidence: Dict,
    live: unknown,
    registrySource = "https://registry.modelcontextprotocol.io",
  ): Decision {
    const name = isDict(record) ? pyStrOf("name" in record ? record["name"] : "<missing>") : "<missing>";
    const version = isDict(record) ? pyStrOf("version" in record ? record["version"] : "<missing>") : "<missing>";
    const reasons = this.recordErrors(record);
    const status = registryStatus(apiMeta);
    if (status !== "active") reasons.push(`registry status is ${status || "missing"}, not active`);
    if (!namespaceMatches(name, verifiedNamespace)) reasons.push("server name is outside the verified namespace");
    const [sourceErrors, source] = this.sourceErrors(record, provenanceEvidence);
    reasons.push(...sourceErrors);
    reasons.push(...this.liveErrors(live));

    const evidence = {
      recordDigest: digest(record),
      registrySource,
      status,
      verifiedNamespace,
    };
    if (reasons.length > 0) {
      this.ledger.append("admission", name, version, "rejected", reasons, evidence);
      return new Decision(false, [...reasons]);
    }

    if (source === null) throw new Error("AssertionError");
    const provenance = {
      registrySource,
      server: name,
      registryVersion: version,
      recordDigest: evidence.recordDigest,
      source,
      sourceDigest: provenanceEvidence["digest"],
    };
    const pin = {
      server: name,
      version,
      registryStatus: status,
      recordDigest: evidence.recordDigest,
      source,
      sourceDigest: provenanceEvidence["digest"],
      toolsetDigest: digest(normalizedTools((live as Dict)["tools"])),
      provenanceDigest: digest(provenance),
      reportedServerInfo: reportedServerInfo(live),
      quarantined: false,
    };
    this.pins.set(this.pinKey(name, version), structuredClone(pin));
    this.active.set(name, version);
    this.ledger.append("admission", name, version, "approved", [], pin);
    return new Decision(true, [], structuredClone(pin));
  }

  checkLive(serverName: string, version: string, live: unknown): Decision {
    const pin = this.pins.get(this.pinKey(serverName, version));
    if (pin === undefined) return new Decision(false, ["version has no admission pin"]);
    const reasons = this.liveErrors(live);
    const tools = isDict(live) ? live["tools"] : null;
    const toolsValid = Array.isArray(tools) && tools.every((tool) => isDict(tool));
    const observedToolset = toolsValid ? digest(normalizedTools(tools as Dict[])) : null;
    if (toolsValid && observedToolset !== pin["toolsetDigest"]) {
      reasons.push("live tool descriptors differ from the admitted pin");
    }
    if (pin["quarantined"]) reasons.push("version is quarantined");
    if (reasons.length > 0) {
      pin["quarantined"] = true;
      if (this.active.get(serverName) === version) this.active.delete(serverName);
    }
    const outcome = reasons.length === 0 ? "healthy" : "drifted";
    this.ledger.append("live-check", serverName, version, outcome, reasons, {
      pin: pin["provenanceDigest"],
      observedToolset,
    });
    return new Decision(reasons.length === 0, [...reasons], structuredClone(pin));
  }

  observeRegistryStatus(serverName: string, version: string, status: string): void {
    const pin = this.pins.get(this.pinKey(serverName, version));
    const reasons: string[] = [];
    let outcome = "observed";
    if (pin === undefined) {
      reasons.push("status refers to an unadmitted version");
      outcome = "ignored";
    } else {
      pin["registryStatus"] = status;
      if (status !== "active") {
        pin["quarantined"] = true;
        outcome = "quarantined";
        reasons.push(`registry status changed to ${status}`);
        if (this.active.get(serverName) === version) this.active.delete(serverName);
      }
    }
    this.ledger.append("registry-status", serverName, version, outcome, reasons, { status });
  }

  rollback(serverName: string, targetVersion: string, reason: string): Decision {
    const pin = this.pins.get(this.pinKey(serverName, targetVersion));
    const reasons: string[] = [];
    if (pin === undefined) reasons.push("rollback target has no admission pin");
    else if (pin["quarantined"] || pin["registryStatus"] !== "active") {
      reasons.push("rollback target is not eligible or is quarantined");
    }
    if (reasons.length > 0 || pin === undefined) {
      this.ledger.append("rollback", serverName, targetVersion, "rejected", reasons, { reason });
      return new Decision(false, [...reasons]);
    }
    const previous = this.active.has(serverName) ? this.active.get(serverName)! : null;
    this.active.set(serverName, targetVersion);
    const evidence = { from: previous, to: targetVersion, reason };
    this.ledger.append("rollback", serverName, targetVersion, "activated", [], evidence);
    return new Decision(true, [], structuredClone(pin));
  }
}

function sampleRecord(version: string): Dict {
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
    name: "com.example/inventory",
    version,
    description: "Read-only inventory lookup tools",
    packages: [
      {
        registryType: "pypi",
        identifier: "example-mcp-inventory",
        version,
        transport: { type: "stdio" },
      },
    ],
    _meta: { [PUBLISHER_META_KEY]: { tier: "internal-approved" } },
  };
}

function sampleLive(version: string, extraTool = false): Dict {
  const tools: Dict[] = [
    {
      name: "inventory_get",
      description: "Fetch one inventory item",
      inputSchema: {
        type: "object",
        properties: { sku: { type: "string" } },
        required: ["sku"],
      },
    },
  ];
  if (extraTool) {
    tools.push({
      name: "inventory_delete",
      description: "Delete one inventory item",
      inputSchema: { type: "object" },
    });
  }
  return {
    resultType: "complete",
    supportedVersions: [PROTOCOL_VERSION],
    capabilities: { tools: { listChanged: false } },
    tools,
    _meta: { [SERVER_INFO_KEY]: { name: "com.example/inventory", version } },
  };
}

function evidenceFor(version: string): Dict {
  return {
    kind: "package",
    registryType: "pypi",
    identifier: "example-mcp-inventory",
    version,
    transportType: "stdio",
    digest: digest({ wheel: `example-mcp-inventory-${version}.whl` }),
    verified: true,
  };
}

function demo(): void {
  let second = 0;
  const ticks = (): string => {
    if (second >= 9) throw new Error("StopIteration");
    return `2026-08-21T10:00:0${second++}+00:00`;
  };
  const controller = new RegistryAdmissionController(["tools"], ticks);
  const activeMeta = { [OFFICIAL_META_KEY]: { status: "active" } };

  const first = controller.admit(
    sampleRecord("1.0.0"),
    activeMeta,
    namespaceForDomain("example.com"),
    evidenceFor("1.0.0"),
    sampleLive("1.0.0"),
  );
  const secondAdmit = controller.admit(
    sampleRecord("1.1.0"),
    activeMeta,
    namespaceForDomain("example.com"),
    evidenceFor("1.1.0"),
    sampleLive("1.1.0"),
  );
  const drift = controller.checkLive("com.example/inventory", "1.1.0", sampleLive("1.1.0", true));
  controller.observeRegistryStatus("com.example/inventory", "1.1.0", "deprecated");
  const rollback = controller.rollback("com.example/inventory", "1.0.0", "unexpected delete tool");

  const report = {
    admitted: [first.allowed, secondAdmit.allowed],
    driftAllowed: drift.allowed,
    driftReasons: drift.reasons,
    rollbackAllowed: rollback.allowed,
    activeVersion: controller.active.get("com.example/inventory"),
    ledgerEntries: controller.ledger.entries.length,
    ledgerValid: controller.ledger.verify(),
  };
  console.log(indentedJson(report, 2));
}

export {
  canonicalJson,
  digest,
  namespaceForDomain,
  namespaceMatches,
  normalizeHttpsRemoteUrl,
  RegistryAdmissionController,
  sampleRecord,
  sampleLive,
  evidenceFor,
};

demo();
