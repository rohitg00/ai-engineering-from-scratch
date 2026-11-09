// Lesson: Explicit Scope and Stateless Elicitation (phase 13 / lesson 12)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/code/main.ts

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type Json = any;
type Obj = Record<string, Json>;

const PROTOCOL_VERSION = "2026-07-28";
const PROTOCOL_META = "io.modelcontextprotocol/protocolVersion";
const CAPABILITIES_META = "io.modelcontextprotocol/clientCapabilities";
const CLIENT_INFO_META = "io.modelcontextprotocol/clientInfo";
const SERVER_INFO_META = "io.modelcontextprotocol/serverInfo";
const SERVER_SECRET = Buffer.from("lesson-12-demo-secret-change-in-production");

const DEFAULT_NOTES: Record<string, Record<string, string>> = {
  "note-3": {
    title: "TPS report 2023",
    uri: "file:///Users/alice/Documents/Notes/tps-2023.md",
  },
  "note-7": {
    title: "TPS report 2024",
    uri: "file:///Users/alice/Documents/Notes/tps-2024.md",
  },
  "note-14": {
    title: "TPS report 2025",
    uri: "file:///Users/alice/Documents/Notes/tps-2025.md",
  },
  "note-99": {
    title: "shopping list",
    uri: "file:///Users/alice/Documents/Notes/shopping.md",
  },
  "note-100": {
    title: "outside root",
    uri: "file:///tmp/outside.md",
  },
};
const TOOLS: Obj[] = [
  {
    name: "notes_delete",
    description: "Delete one authorized note after explicit user confirmation.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceUri: { type: "string", format: "uri" },
        title: { type: "string", minLength: 1 },
      },
      required: ["workspaceUri", "title"],
    },
  },
];

class McpError extends Error {
  code: number;
  data: Obj | null;

  constructor(code: number, message: string, data: Obj | null = null) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

function isDict(value: Json): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function pyDumps(value: Json, sortKeys = false, compact = false): string {
  const itemSep = compact ? "," : ", ";
  const keySep = compact ? ":" : ": ";
  const encodeString = (text: string): string =>
    JSON.stringify(text).replace(/[^\x00-\x7f]/g, (ch) => "\\u" + ch.charCodeAt(0).toString(16).padStart(4, "0"));
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    return encodeString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((item) => pyDumps(item, sortKeys, compact)).join(itemSep) + "]";
  }
  const keys = Object.keys(value);
  if (sortKeys) {
    keys.sort(compareStrings);
  }
  return "{" + keys.map((key) => encodeString(key) + keySep + pyDumps(value[key], sortKeys, compact)).join(itemSep) + "}";
}

function pyStrList(items: string[]): string {
  return "[" + items.map((item) => `'${item}'`).join(", ") + "]";
}

function nowSeconds(): number {
  return Date.now() / 1000;
}

class ReplayStore {
  readonly maxEntries: number;
  private clock: () => number;
  private consumed: Map<string, number> = new Map();

  constructor(maxEntries = 1_000, clock: () => number = nowSeconds) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new RangeError("max_entries must be a positive integer");
    }
    this.maxEntries = maxEntries;
    this.clock = clock;
  }

  claimAndConsume<T>(nonce: string, expiresAt: number, operation: () => T): T {
    const now = this.clock();
    this.consumed = new Map([...this.consumed].filter(([, expiry]) => expiry > now));
    if (expiresAt <= now) {
      throw new McpError(-32602, "requestState expired");
    }
    if (this.consumed.has(nonce)) {
      throw new McpError(-32602, "requestState was already consumed");
    }
    if (this.consumed.size >= this.maxEntries) {
      throw new McpError(-32023, "replay protection capacity exhausted");
    }
    const result = operation();
    this.consumed.set(nonce, expiresAt);
    return result;
  }
}

function requestMeta(elicitation = true): Obj {
  const capabilities: Obj = elicitation ? { elicitation: { form: {} } } : {};
  return {
    [PROTOCOL_META]: PROTOCOL_VERSION,
    [CAPABILITIES_META]: capabilities,
    [CLIENT_INFO_META]: { name: "lesson-client", version: "1.0.0" },
  };
}

function serverMeta(): Obj {
  return { [SERVER_INFO_META]: { name: "explicit-scope-demo", version: "1.0.0" } };
}

function complete(fields: Obj): Obj {
  return { resultType: "complete", ...fields, _meta: serverMeta() };
}

function validateRequestMeta(params: Obj): Obj {
  const meta = params._meta;
  if (!isDict(meta)) {
    throw new McpError(-32602, "missing request _meta");
  }
  const requestedVersion = meta[PROTOCOL_META];
  if (typeof requestedVersion !== "string") {
    throw new McpError(-32602, "missing protocol version");
  }
  if (requestedVersion !== PROTOCOL_VERSION) {
    throw new McpError(-32022, "unsupported protocol version", {
      supported: [PROTOCOL_VERSION],
      requested: requestedVersion,
    });
  }
  const capabilities = meta[CAPABILITIES_META];
  if (!isDict(capabilities)) {
    throw new McpError(-32602, "missing client capabilities");
  }
  return meta;
}

function supportsFormElicitation(capabilities: Obj): boolean {
  const elicitation = capabilities.elicitation;
  if (!isDict(elicitation)) {
    return false;
  }
  if (Object.keys(elicitation).length === 0) {
    return true;
  }
  return isDict(elicitation.form);
}

function unquote(text: string): string {
  if (!text.includes("%")) {
    return text;
  }
  const bytes: number[] = [];
  const raw = Buffer.from(text, "utf8");
  for (let i = 0; i < raw.length; i += 1) {
    const hex = raw.subarray(i + 1, i + 3).toString("latin1");
    if (raw[i] === 0x25 && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16));
      i += 2;
    } else {
      bytes.push(raw[i]);
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

function normpath(path: string): string {
  if (path === "") {
    return ".";
  }
  let initialSlashes = path.startsWith("/") ? 1 : 0;
  if (initialSlashes && path.startsWith("//") && !path.startsWith("///")) {
    initialSlashes = 2;
  }
  const newComps: string[] = [];
  for (const comp of path.split("/")) {
    if (comp === "" || comp === ".") {
      continue;
    }
    if (comp !== ".." || (!initialSlashes && newComps.length === 0) || (newComps.length > 0 && newComps[newComps.length - 1] === "..")) {
      newComps.push(comp);
    } else if (newComps.length > 0) {
      newComps.pop();
    }
  }
  const joined = "/".repeat(initialSlashes) + newComps.join("/");
  return joined || ".";
}

function commonpath(paths: string[]): string {
  if (paths.length === 0) {
    throw new RangeError("commonpath() arg is an empty sequence");
  }
  const isAbs = paths.map((p) => p.startsWith("/"));
  if (isAbs.some((value) => value !== isAbs[0])) {
    throw new RangeError("Can't mix absolute and relative paths");
  }
  const split = paths.map((p) => p.split("/").filter((c) => c !== "" && c !== "."));
  const common: string[] = [];
  const shortest = split.reduce((a, b) => (a.length <= b.length ? a : b));
  for (let i = 0; i < shortest.length; i += 1) {
    if (split.every((parts) => parts[i] === shortest[i])) {
      common.push(shortest[i]);
    } else {
      break;
    }
  }
  return (isAbs[0] ? "/" : "") + common.join("/");
}

function normalizedUriParts(uri: string): [string, string, string] {
  const match = /^([A-Za-z][A-Za-z0-9+.-]*):(.*)$/s.exec(uri);
  const scheme = match ? match[1].toLowerCase() : "";
  let rest = match ? match[2] : uri;
  let netloc = "";
  if (rest.startsWith("//")) {
    const end = rest.slice(2).search(/[/?#]/);
    netloc = end < 0 ? rest.slice(2) : rest.slice(2, 2 + end);
    rest = end < 0 ? "" : rest.slice(2 + end);
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
  if (scheme !== "file" || query || fragment) {
    throw new RangeError("only plain file URIs are supported");
  }
  const path = normpath(unquote(rest));
  if (!path.startsWith("/")) {
    throw new RangeError("file URI path must be absolute");
  }
  return [scheme, netloc, path];
}

function uriWithinWorkspace(workspaceUri: string, candidateUri: string): boolean {
  try {
    const [workspaceScheme, workspaceHost, workspacePath] = normalizedUriParts(workspaceUri);
    const [candidateScheme, candidateHost, candidatePath] = normalizedUriParts(candidateUri);
    if (workspaceScheme !== candidateScheme || workspaceHost !== candidateHost) {
      return false;
    }
    return commonpath([workspacePath, candidatePath]) === workspacePath;
  } catch (exc) {
    if (exc instanceof RangeError || exc instanceof TypeError) {
      return false;
    }
    throw exc;
  }
}

function b64(data: Buffer): string {
  return data.toString("base64url");
}

function unb64(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1) {
    throw new TypeError("invalid base64");
  }
  return Buffer.from(value, "base64url");
}

function argumentsDigest(args: Obj): string {
  const encoded = pyDumps(args, true, true);
  return createHash("sha256").update(encoded).digest("hex");
}

function sealRequestState(payload: Obj): string {
  const body = Buffer.from(pyDumps(payload, true, true));
  const signature = createHmac("sha256", SERVER_SECRET).update(body).digest();
  return `${b64(body)}.${b64(signature)}`;
}

function verifyRequestState(token: string, principal: string, args: Obj, now: number | null = null): Obj {
  let body: Buffer;
  let supplied: Buffer;
  try {
    const dot = token.indexOf(".");
    if (dot < 0) {
      throw new TypeError("missing separator");
    }
    body = unb64(token.slice(0, dot));
    supplied = unb64(token.slice(dot + 1));
  } catch {
    throw new McpError(-32602, "invalid requestState encoding");
  }
  const expected = createHmac("sha256", SERVER_SECRET).update(body).digest();
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new McpError(-32602, "requestState integrity check failed");
  }
  let state: Obj;
  try {
    state = JSON.parse(body.toString("utf8"));
  } catch {
    throw new McpError(-32602, "invalid requestState payload");
  }
  if (state.principal !== principal) {
    throw new McpError(-32602, "requestState principal mismatch");
  }
  if (state.method !== "tools/call") {
    throw new McpError(-32602, "requestState method mismatch");
  }
  if (state.argumentsDigest !== argumentsDigest(args)) {
    throw new McpError(-32602, "requestState arguments mismatch");
  }
  const expiresAt = state.expiresAt;
  if (typeof expiresAt !== "number") {
    throw new McpError(-32602, "invalid requestState expiry");
  }
  if (expiresAt <= (now === null ? nowSeconds() : now)) {
    throw new McpError(-32602, "requestState expired");
  }
  return state;
}

class NotesServer {
  notes: Record<string, Record<string, string>>;
  authorizedWorkspaces: Set<string>;
  replayStore: ReplayStore;

  constructor(notes: Record<string, Record<string, string>> | null = null, replayStore: ReplayStore | null = null) {
    this.notes = notes === null ? structuredClone(DEFAULT_NOTES) : notes;
    this.authorizedWorkspaces = new Set(["file:///Users/alice/Documents/Notes"]);
    this.replayStore = replayStore !== null ? replayStore : new ReplayStore();
  }

  serverDiscover(params: Obj): Obj {
    validateRequestMeta(params);
    return complete({
      supportedVersions: [PROTOCOL_VERSION],
      capabilities: { tools: {} },
      ttlMs: 300_000,
      cacheScope: "public",
    });
  }

  toolsList(params: Obj): Obj {
    validateRequestMeta(params);
    return complete({
      tools: [...TOOLS].sort((a, b) => compareStrings(a.name, b.name)),
      ttlMs: 60_000,
      cacheScope: "public",
    });
  }

  private requireAuthorizedWorkspace(workspaceUri: Json): string {
    if (typeof workspaceUri !== "string") {
      throw new McpError(-32602, "workspaceUri must be a string");
    }
    if (!this.authorizedWorkspaces.has(workspaceUri)) {
      throw new McpError(-32602, "workspace is not authorized");
    }
    return workspaceUri;
  }

  private elicitationResult(candidates: Obj[], principal: string, args: Obj): Obj {
    const candidateIds = candidates.map((candidate) => candidate.id);
    const state = {
      phase: "confirm_delete",
      principal,
      method: "tools/call",
      argumentsDigest: argumentsDigest(args),
      candidateIds,
      nonce: randomBytes(16).toString("hex"),
      expiresAt: Math.floor(nowSeconds()) + 300,
    };
    return {
      resultType: "input_required",
      inputRequests: {
        delete_choice: {
          method: "elicitation/create",
          params: {
            mode: "form",
            message: "Choose one matching note and confirm deletion.",
            requestedSchema: {
              type: "object",
              properties: {
                note_id: { type: "string", enum: candidateIds },
                confirm: { type: "boolean" },
              },
              required: ["note_id", "confirm"],
            },
          },
        },
      },
      requestState: sealRequestState(state),
      _meta: serverMeta(),
    };
  }

  private deleteNoteOnce(nonce: string, expiresAt: number, noteId: string, workspaceUri: string): void {
    const deleteNote = (): void => {
      const note = Object.prototype.hasOwnProperty.call(this.notes, noteId) ? this.notes[noteId] : undefined;
      if (note === undefined) {
        throw new McpError(-32602, "selected note no longer exists");
      }
      if (!uriWithinWorkspace(workspaceUri, note.uri)) {
        throw new McpError(-32602, "selected note is outside workspace");
      }
      delete this.notes[noteId];
    };

    this.replayStore.claimAndConsume(nonce, expiresAt, deleteNote);
  }

  toolsCall(params: Obj, principal: string): Obj {
    const meta = validateRequestMeta(params);
    if (params.name !== "notes_delete") {
      throw new McpError(-32602, "unknown tool");
    }
    const args = params.arguments;
    if (!isDict(args)) {
      throw new McpError(-32602, "arguments must be an object");
    }
    const workspaceUri = this.requireAuthorizedWorkspace(args.workspaceUri);
    const title = args.title;
    if (typeof title !== "string" || !title.trim()) {
      throw new McpError(-32602, "title must be a non-empty string");
    }

    const capabilities = meta[CAPABILITIES_META];
    if (!supportsFormElicitation(capabilities)) {
      throw new McpError(-32021, "missing required client capability", {
        requiredCapabilities: { elicitation: { form: {} } },
      });
    }

    const hasState = "requestState" in params;
    const hasResponses = "inputResponses" in params;
    if (hasState !== hasResponses) {
      throw new McpError(-32602, "requestState and inputResponses must be provided together");
    }
    if (!hasState) {
      const candidates = Object.entries(this.notes)
        .filter(
          ([, note]) =>
            note.title.toLowerCase().includes(title.toLowerCase()) && uriWithinWorkspace(workspaceUri, note.uri),
        )
        .map(([noteId, note]) => ({ id: noteId, ...note }));
      if (candidates.length === 0) {
        return complete({
          content: [{ type: "text", text: "no match in authorized workspace" }],
          isError: true,
        });
      }
      return this.elicitationResult(candidates, principal, args);
    }

    const stateToken = params.requestState;
    if (typeof stateToken !== "string") {
      throw new McpError(-32602, "requestState must be a string");
    }
    const state = verifyRequestState(stateToken, principal, args);
    if (state.phase !== "confirm_delete") {
      throw new McpError(-32602, "unknown requestState phase");
    }
    const nonce = state.nonce;
    if (typeof nonce !== "string" || !nonce) {
      throw new McpError(-32602, "requestState nonce is missing");
    }
    const expiresAt: number = state.expiresAt;
    const responses = params.inputResponses;
    if (!isDict(responses)) {
      throw new McpError(-32602, "inputResponses must be an object");
    }
    const answer = responses.delete_choice;
    if (!isDict(answer)) {
      throw new McpError(-32602, "missing delete_choice response");
    }
    const action = answer.action;
    if (action === "cancel") {
      return complete({
        content: [{ type: "text", text: "deletion cancelled" }],
        structuredContent: { deleted: false },
        isError: false,
      });
    }
    if (action === "decline") {
      this.replayStore.claimAndConsume(nonce, expiresAt, () => null);
      return complete({
        content: [{ type: "text", text: "deletion declined" }],
        structuredContent: { deleted: false },
        isError: false,
      });
    }
    if (action !== "accept" || !isDict(answer.content)) {
      throw new McpError(-32602, "invalid elicitation response");
    }
    const content = answer.content;
    const noteId = content.note_id;
    const candidateIds: Json[] = state.candidateIds;
    if (content.confirm !== true || !candidateIds.includes(noteId ?? null)) {
      throw new McpError(-32602, "invalid deletion confirmation");
    }
    this.deleteNoteOnce(nonce, expiresAt, noteId, workspaceUri);
    return complete({
      content: [{ type: "text", text: `deleted ${noteId}` }],
      structuredContent: { deleted: true, noteId },
      isError: false,
    });
  }

  dispatch(request: Obj, principal = "user-42"): Obj | null {
    const isNotification = !("id" in request);
    const requestId = request.id ?? null;
    try {
      const params = "params" in request ? request.params : {};
      if (!isDict(params)) {
        throw new McpError(-32602, "params must be an object");
      }
      const method = request.method;
      let result: Obj;
      if (method === "server/discover") {
        result = this.serverDiscover(params);
      } else if (method === "tools/list") {
        result = this.toolsList(params);
      } else if (method === "tools/call") {
        result = this.toolsCall(params, principal);
      } else {
        throw new McpError(-32601, "method not found");
      }
      if (isNotification) {
        return null;
      }
      return { jsonrpc: "2.0", id: requestId, result };
    } catch (exc) {
      if (!(exc instanceof McpError)) {
        throw exc;
      }
      if (isNotification) {
        return null;
      }
      const error: Obj = { code: exc.code, message: exc.message };
      if (exc.data !== null) {
        error.data = exc.data;
      }
      return { jsonrpc: "2.0", id: requestId, error };
    }
  }
}

function toolRequest(requestId: number, title = "TPS report"): Obj {
  return {
    jsonrpc: "2.0",
    id: requestId,
    method: "tools/call",
    params: {
      name: "notes_delete",
      arguments: {
        workspaceUri: "file:///Users/alice/Documents/Notes",
        title,
      },
      _meta: requestMeta(),
    },
  };
}

function runMrtr(action = "accept"): [NotesServer, Obj, number[]] {
  const server = new NotesServer();
  const first = server.dispatch(toolRequest(1)) as Obj;
  const inputRequest = first.result.inputRequests.delete_choice;
  const choices: string[] = inputRequest.params.requestedSchema.properties.note_id.enum;
  const content = action === "accept" ? { note_id: choices[choices.length - 1], confirm: true } : {};
  const retry = toolRequest(2);
  Object.assign(retry.params, {
    inputResponses: {
      delete_choice: { action, content },
    },
    requestState: first.result.requestState,
  });
  const final = server.dispatch(retry) as Obj;
  return [server, final, [1, 2]];
}

function main(): void {
  const firstServer = new NotesServer();
  const discovery = firstServer.dispatch({
    jsonrpc: "2.0",
    id: 0,
    method: "server/discover",
    params: { _meta: requestMeta() },
  }) as Obj;
  console.log("discover:", JSON.stringify(discovery.result, null, 2));
  const [server, final, requestIds] = runMrtr();
  console.log("independent request ids:", "[" + requestIds.join(", ") + "]");
  console.log("final:", JSON.stringify(final.result, null, 2));
  console.log("remaining note ids:", pyStrList(Object.keys(server.notes).sort(compareStrings)));
}

main();
