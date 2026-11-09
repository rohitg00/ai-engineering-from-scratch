// Lesson: MCP Apps on the Stateless Protocol (phase 13 / lesson 14)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/14-mcp-apps/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/14-mcp-apps/code/main.ts

export {};

type Json = any;
type Obj = Record<string, Json>;

const PROTOCOL_VERSION = "2026-07-28";
const APPS_EXTENSION = "io.modelcontextprotocol/ui";
const PROTOCOL_META = "io.modelcontextprotocol/protocolVersion";
const CLIENT_CAPABILITIES_META = "io.modelcontextprotocol/clientCapabilities";
const CLIENT_INFO_META = "io.modelcontextprotocol/clientInfo";
const SERVER_INFO_META = "io.modelcontextprotocol/serverInfo";
const SERVER_INFO: Obj = { name: "timeline-app-server", version: "2.0.0" };
const RESOURCE_URI = "ui://notes/timeline.html";
const RESOURCE_MIME = "text/html;profile=mcp-app";
const HOST_ORIGIN = "https://host.example";

const NOTES: Record<string, string>[] = [
  { id: "note-1", title: "Discover", created: "2026-07-28" },
  { id: "note-2", title: "Per-request metadata", created: "2026-07-29" },
  { id: "note-3", title: "MCP Apps", created: "2026-07-30" },
];

const APP_CSP: Obj = {
  connectDomains: [],
  resourceDomains: [],
  frameDomains: [],
  baseUriDomains: [],
};

class ProtocolError extends Error {
  readonly code: number;
  readonly data: Obj | null;

  constructor(code: number, message: string, data: Obj | null = null) {
    super(message);
    this.code = code;
    this.data = data;
  }
}

function isDict(value: Json): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pyDumps(value: Json): string {
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
    return "[" + value.map((item) => pyDumps(item)).join(", ") + "]";
  }
  return "{" + Object.keys(value).map((key) => encodeString(key) + ": " + pyDumps(value[key])).join(", ") + "}";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function requestMeta(apps = true): Obj {
  const extensions: Obj = apps ? { [APPS_EXTENSION]: {} } : {};
  return {
    [PROTOCOL_META]: PROTOCOL_VERSION,
    [CLIENT_CAPABILITIES_META]: { extensions },
    [CLIENT_INFO_META]: { name: "lesson-client", version: "1.0.0" },
  };
}

function makeRequest(
  method: string,
  requestId: number,
  params: Obj | null = null,
  apps = true,
): [Obj, Record<string, string>] {
  const bodyParams: Obj = { ...(params ?? {}) };
  bodyParams._meta = requestMeta(apps);
  const body = { jsonrpc: "2.0", id: requestId, method, params: bodyParams };
  const headers: Record<string, string> = { "MCP-Protocol-Version": PROTOCOL_VERSION, "Mcp-Method": method };
  if (["tools/call", "resources/read", "prompts/get"].includes(method)) {
    headers["Mcp-Name"] = String(bodyParams.name || bodyParams.uri || "");
  }
  return [body, headers];
}

function timelineHtml(notes: Record<string, string>[]): string {
  const items = notes
    .map(
      (note) =>
        `<li><button data-note='${escapeHtml(note.id)}'>${escapeHtml(note.title)}</button><time>${escapeHtml(note.created)}</time></li>`,
    )
    .join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Notes timeline</title>
<style>body{font:16px system-ui;margin:1rem}li{display:flex;gap:1rem;margin:.5rem}</style>
</head><body><h1>Notes timeline</h1><ol>${items}</ol>
<script>
const hostOrigin = ${pyDumps(HOST_ORIGIN)};
let nextId = 0;
function callTool(name, args) {
  const id = ++nextId;
  window.parent.postMessage({
    jsonrpc: "2.0", id, method: "tools/call",
    params: {name, arguments: args}
  }, hostOrigin);
}
window.addEventListener("message", (event) => {
  if (event.origin !== hostOrigin || !event.data || event.data.jsonrpc !== "2.0") return;
  if (event.data.id === 0 && event.data.result) {
    document.body.dataset.bridgeReady = "true";
    window.parent.postMessage({
      jsonrpc: "2.0", method: "ui/notifications/initialized"
    }, hostOrigin);
  }
});
document.querySelectorAll("button").forEach((button) => {
  button.addEventListener("click", () => callTool("notes_open", {id: button.dataset.note}));
});
// ui/initialize belongs to the Apps postMessage dialect, not MCP core initialization.
window.parent.postMessage({
  jsonrpc: "2.0", id: 0, method: "ui/initialize",
  params: {
    appInfo: {name: "notes-timeline", version: "1.0.0"},
    appCapabilities: {}
  }
}, hostOrigin);
</script></body></html>`;
}

class McpAppServer {
  private validate(body: Obj, headers: Record<string, string>): Obj {
    if (body.jsonrpc !== "2.0") {
      throw new ProtocolError(-32600, "Invalid Request");
    }
    const method = body.method;
    const params = body.params;
    if (typeof method !== "string" || !isDict(params)) {
      throw new ProtocolError(-32600, "Invalid Request");
    }
    const meta = params._meta;
    if (!isDict(meta)) {
      throw new ProtocolError(-32602, "request params._meta is required");
    }
    const requestedVersion = meta[PROTOCOL_META];
    if (typeof requestedVersion !== "string") {
      throw new ProtocolError(-32602, "protocolVersion must be a string");
    }
    if (!isDict(meta[CLIENT_CAPABILITIES_META])) {
      throw new ProtocolError(-32602, "clientCapabilities is required on every request");
    }
    if (headers["MCP-Protocol-Version"] !== requestedVersion) {
      throw new ProtocolError(-32020, "MCP-Protocol-Version header does not match body");
    }
    if (headers["Mcp-Method"] !== method) {
      throw new ProtocolError(-32020, "Mcp-Method header does not match body");
    }
    const expectedName = params.name || params.uri || null;
    if (["tools/call", "resources/read", "prompts/get"].includes(method)) {
      if ((headers["Mcp-Name"] ?? null) !== expectedName) {
        throw new ProtocolError(-32020, "Mcp-Name header does not match body");
      }
    }
    if (requestedVersion !== PROTOCOL_VERSION) {
      throw new ProtocolError(-32022, "Unsupported protocol version", {
        supported: [PROTOCOL_VERSION],
        requested: requestedVersion,
      });
    }
    return meta;
  }

  private static appsEnabled(meta: Obj): boolean {
    const caps = meta[CLIENT_CAPABILITIES_META];
    const extensions = "extensions" in caps ? caps.extensions : {};
    return isDict(extensions) && isDict(extensions[APPS_EXTENSION]);
  }

  private static success(requestId: Json, input: Obj): Obj {
    const result: Obj = { ...input };
    if (!("resultType" in result)) {
      result.resultType = "complete";
    }
    if (!("_meta" in result)) {
      result._meta = {};
    }
    result._meta[SERVER_INFO_META] = SERVER_INFO;
    return { jsonrpc: "2.0", id: requestId, result };
  }

  private static error(requestId: Json, error: ProtocolError): Obj {
    const payload: Obj = { code: error.code, message: error.message };
    if (error.data !== null) {
      payload.data = error.data;
    }
    return { jsonrpc: "2.0", id: requestId, error: payload };
  }

  private static errorStatus(error: ProtocolError): number {
    return error.code === -32601 ? 404 : 400;
  }

  handle(body: Obj, headers: Record<string, string>, httpMethod = "POST"): [number, Obj | null] {
    if (httpMethod !== "POST") {
      return [405, null];
    }
    const isNotification = !("id" in body);
    try {
      const meta = this.validate(body, headers);
      const method = body.method;
      const params = body.params;
      let result: Obj;
      if (method === "server/discover") {
        result = {
          supportedVersions: [PROTOCOL_VERSION],
          capabilities: {
            tools: {},
            resources: {},
            extensions: { [APPS_EXTENSION]: {} },
          },
          ttlMs: 300_000,
          cacheScope: "public",
        };
      } else if (method === "tools/list") {
        const tool: Obj = {
          name: "notes_timeline",
          description: "Render a timeline of notes.",
          inputSchema: { type: "object", properties: {} },
        };
        if (McpAppServer.appsEnabled(meta)) {
          tool._meta = { ui: { resourceUri: RESOURCE_URI } };
        }
        result = { tools: [tool], ttlMs: 60_000, cacheScope: "public" };
      } else if (method === "tools/call") {
        if (params.name !== "notes_timeline") {
          throw new ProtocolError(-32602, "Unknown tool");
        }
        result = {
          content: [{ type: "text", text: "Timeline ready." }],
          structuredContent: { notes: NOTES },
          isError: false,
        };
      } else if (method === "resources/list") {
        result = {
          resources: [
            {
              uri: RESOURCE_URI,
              name: "notes-timeline",
              description: "Interactive notes timeline for MCP Apps hosts.",
              mimeType: RESOURCE_MIME,
            },
          ],
          ttlMs: 60_000,
          cacheScope: "public",
        };
      } else if (method === "resources/read") {
        if (params.uri !== RESOURCE_URI) {
          throw new ProtocolError(-32602, "Unknown resource URI");
        }
        if (!McpAppServer.appsEnabled(meta)) {
          throw new ProtocolError(-32021, "MCP Apps client capability is required", {
            requiredCapabilities: {
              extensions: { [APPS_EXTENSION]: {} },
            },
          });
        }
        result = {
          contents: [
            {
              uri: RESOURCE_URI,
              mimeType: RESOURCE_MIME,
              text: timelineHtml(NOTES),
              _meta: { ui: { csp: APP_CSP, permissions: {} } },
            },
          ],
          ttlMs: 60_000,
          cacheScope: "public",
        };
      } else {
        throw new ProtocolError(-32601, "Method not found");
      }
      if (isNotification) {
        return [202, null];
      }
      return [200, McpAppServer.success(body.id, result)];
    } catch (exc) {
      if (!(exc instanceof ProtocolError)) {
        throw exc;
      }
      if (isNotification) {
        return [McpAppServer.errorStatus(exc), null];
      }
      return [McpAppServer.errorStatus(exc), McpAppServer.error(body.id ?? null, exc)];
    }
  }
}

function demo(): void {
  const server = new McpAppServer();
  const calls: [string, Obj][] = [
    ["server/discover", {}],
    ["tools/list", {}],
    ["tools/call", { name: "notes_timeline", arguments: {} }],
    ["resources/read", { uri: RESOURCE_URI }],
  ];
  calls.forEach(([method, params], index) => {
    const requestId = index + 1;
    const [body, headers] = makeRequest(method, requestId, params);
    const [status, response] = server.handle(body, headers);
    const summary = (response as Obj).result ?? (response as Obj).error ?? null;
    console.log(`${status} ${method}: ${pyDumps(summary).slice(0, 220)}`);
  });
}

demo();
