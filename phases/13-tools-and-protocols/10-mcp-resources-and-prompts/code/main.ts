// Lesson: MCP Resources and Prompts: Addressable Context for Stateless Servers (phase 13 / lesson 10)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/10-mcp-resources-and-prompts/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/10-mcp-resources-and-prompts/code/main.ts

export {};

type Json = any;
type Obj = Record<string, Json>;

const PROTOCOL_VERSION = "2026-07-28";
const SERVER_INFO: Obj = { name: "lesson-resource-server", version: "2.0.0" };

const NOTES: Record<string, Obj> = {
  "notes://note-2": {
    name: "Release checklist",
    description: "Checks to run before publishing",
    mimeType: "text/markdown",
    text: "# Release\n\n- Run tests\n- Confirm the tag",
  },
  "notes://note-1": {
    name: "Architecture decision",
    description: "Why the service uses a stateless protocol boundary",
    mimeType: "text/markdown",
    text: "# Decision\n\nKeep protocol requests self-contained.",
  },
};

const PROMPTS: Record<string, Obj> = {
  release_brief: {
    title: "Draft a release brief",
    description: "Turn release facts into a concise user-facing brief",
    arguments: [{ name: "audience", description: "Who will read the brief", required: true }],
  },
  review_note: {
    title: "Review a note",
    description: "Review one note for a named concern",
    arguments: [
      { name: "uri", description: "The note resource URI", required: true },
      { name: "focus", description: "The review focus", required: false },
    ],
  },
};

class RpcError extends Error {
  code: number;
  data: Obj;

  constructor(code: number, message: string, data?: Obj) {
    super(message);
    this.code = code;
    this.data = data ?? {};
  }

  asJson(): Obj {
    const error: Obj = { code: this.code, message: this.message };
    if (Object.keys(this.data).length > 0) {
      error.data = this.data;
    }
    return error;
  }
}

function isDict(value: Json): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function orNull(value: Json): Json {
  return value === undefined ? null : value;
}

function sortedEntries<T>(record: Record<string, T>): [string, T][] {
  return Object.entries(record).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

function requestMeta(clientName = "lesson-client"): Obj {
  return {
    "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
    "io.modelcontextprotocol/clientInfo": { name: clientName, version: "1.0.0" },
    "io.modelcontextprotocol/clientCapabilities": {},
  };
}

function responseMeta(): Obj {
  return { "io.modelcontextprotocol/serverInfo": { ...SERVER_INFO } };
}

function complete(payload: Obj): Obj {
  return { resultType: "complete", ...payload, _meta: responseMeta() };
}

function validateRequestMeta(params: Obj): void {
  const meta = params._meta;
  if (!isDict(meta)) {
    throw new RpcError(-32602, "Missing request metadata");
  }
  const requested = meta["io.modelcontextprotocol/protocolVersion"];
  if (typeof requested !== "string") {
    throw new RpcError(-32602, "Missing or invalid protocol version");
  }
  if (requested !== PROTOCOL_VERSION) {
    throw new RpcError(-32022, "Unsupported protocol version", {
      supported: [PROTOCOL_VERSION],
      requested,
    });
  }
  if (!isDict(meta["io.modelcontextprotocol/clientCapabilities"])) {
    throw new RpcError(-32602, "Missing client capabilities");
  }
}

function serverDiscover(_: Obj): Obj {
  return complete({
    supportedVersions: [PROTOCOL_VERSION],
    capabilities: {
      resources: { listChanged: true, subscribe: true },
      prompts: { listChanged: true },
    },
    instructions: "Read notes by URI and let users select review prompts.",
    ttlMs: 3_600_000,
    cacheScope: "public",
  });
}

function resourcesList(_: Obj): Obj {
  const resources = sortedEntries(NOTES).map(([uri, value]) => ({
    name: value.name,
    description: value.description,
    mimeType: value.mimeType,
    uri,
  }));
  return complete({ resources, ttlMs: 300_000, cacheScope: "public" });
}

function resourcesRead(params: Obj): Obj {
  const uri = params.uri;
  if (typeof uri !== "string" || !(uri in NOTES)) {
    throw new RpcError(-32602, "Unknown or invalid resource URI", { uri: orNull(uri) });
  }
  const note = NOTES[uri];
  return complete({
    contents: [{ uri, mimeType: note.mimeType, text: note.text }],
    ttlMs: 60_000,
    cacheScope: "private",
  });
}

function promptsList(_: Obj): Obj {
  const prompts = sortedEntries(PROMPTS).map(([name, definition]) => ({ name, ...definition }));
  return complete({ prompts, ttlMs: 600_000, cacheScope: "public" });
}

function promptsGet(params: Obj): Obj {
  const name = params.name;
  const args = "arguments" in params ? params.arguments : {};
  if (typeof name !== "string" || !(name in PROMPTS) || !isDict(args)) {
    throw new RpcError(-32602, "Unknown prompt or invalid arguments", { name: orNull(name) });
  }
  let text: string;
  if (name === "review_note") {
    const uri = args.uri;
    if (typeof uri !== "string" || !(uri in NOTES)) {
      throw new RpcError(-32602, "review_note requires a known resource URI", { uri: orNull(uri) });
    }
    const focus = "focus" in args ? args.focus : "correctness";
    text = `Review the resource ${uri} for ${focus}. Cite the URI in every finding.`;
  } else {
    const audience = args.audience;
    if (typeof audience !== "string" || !audience.trim()) {
      throw new RpcError(-32602, "release_brief requires audience");
    }
    text = `Draft a release brief for ${audience}. Separate verified facts from open questions.`;
  }
  return complete({
    description: PROMPTS[name].description,
    messages: [{ role: "user", content: { type: "text", text } }],
  });
}

const SUPPORTED_NOTIFICATION_FIELDS = new Set([
  "promptsListChanged",
  "resourcesListChanged",
  "resourceSubscriptions",
]);

class SubscriptionStream {
  readonly subscriptionId: number | string;
  readonly notifications: Obj;

  constructor(subscriptionId: number | string, notifications: Obj) {
    this.subscriptionId = subscriptionId;
    this.notifications = notifications;
  }

  private meta(): Obj {
    return { "io.modelcontextprotocol/subscriptionId": this.subscriptionId };
  }

  acknowledged(): Obj {
    return {
      jsonrpc: "2.0",
      method: "notifications/subscriptions/acknowledged",
      params: { _meta: this.meta(), notifications: this.notifications },
    };
  }

  resourceUpdated(uri: string): Obj | null {
    const subs: string[] = this.notifications.resourceSubscriptions ?? [];
    if (!subs.includes(uri)) {
      return null;
    }
    return {
      jsonrpc: "2.0",
      method: "notifications/resources/updated",
      params: { _meta: this.meta(), uri },
    };
  }

  resourcesListChanged(): Obj | null {
    if (!this.notifications.resourcesListChanged) {
      return null;
    }
    return {
      jsonrpc: "2.0",
      method: "notifications/resources/list_changed",
      params: { _meta: this.meta() },
    };
  }

  promptsListChanged(): Obj | null {
    if (!this.notifications.promptsListChanged) {
      return null;
    }
    return {
      jsonrpc: "2.0",
      method: "notifications/prompts/list_changed",
      params: { _meta: this.meta() },
    };
  }

  close(): Obj {
    return {
      jsonrpc: "2.0",
      id: this.subscriptionId,
      result: {
        resultType: "complete",
        _meta: { ...this.meta(), ...responseMeta() },
      },
    };
  }
}

function subscriptionsListen(requestId: number | string, params: Obj): SubscriptionStream {
  const requested = params.notifications;
  if (!isDict(requested)) {
    throw new RpcError(-32602, "subscriptions/listen requires a notifications filter");
  }
  const agreed: Obj = {};
  for (const key of [...SUPPORTED_NOTIFICATION_FIELDS].sort()) {
    const value = requested[key];
    if (key === "resourceSubscriptions" && value !== undefined && value !== null) {
      if (!Array.isArray(value) || !value.every((uri) => typeof uri === "string")) {
        throw new RpcError(-32602, "resourceSubscriptions must be an array of URIs");
      }
      agreed[key] = [...new Set(value as string[])].sort();
    } else if (key !== "resourceSubscriptions" && value === true) {
      agreed[key] = true;
    }
  }
  return new SubscriptionStream(requestId, agreed);
}

const HANDLERS: Record<string, (params: Obj) => Obj> = {
  "server/discover": serverDiscover,
  "resources/list": resourcesList,
  "resources/read": resourcesRead,
  "prompts/list": promptsList,
  "prompts/get": promptsGet,
};

function handle(request: Obj): Obj | SubscriptionStream | null {
  const isNotification = !("id" in request);
  const requestId = orNull(request.id);
  const method = request.method;
  const params = "params" in request ? request.params : {};
  if (!isDict(params)) {
    if (isNotification) {
      return null;
    }
    const error = new RpcError(-32602, "params must be an object");
    return { jsonrpc: "2.0", id: requestId, error: error.asJson() };
  }
  try {
    validateRequestMeta(params);
    const handler = typeof method === "string" && method in HANDLERS ? HANDLERS[method] : undefined;
    if (isNotification) {
      if (handler !== undefined) {
        handler(params);
      }
      return null;
    }
    if (method === "subscriptions/listen") {
      if (requestId === null) {
        throw new RpcError(-32602, "subscriptions/listen requires a request id");
      }
      return subscriptionsListen(requestId, params);
    }
    if (handler === undefined) {
      throw new RpcError(-32601, "Method not found", { method: orNull(method) });
    }
    return { jsonrpc: "2.0", id: requestId, result: handler(params) };
  } catch (exc) {
    if (!(exc instanceof RpcError)) {
      throw exc;
    }
    if (isNotification) {
      return null;
    }
    return { jsonrpc: "2.0", id: requestId, error: exc.asJson() };
  }
}

function rpcRequest(requestId: number, method: string, params: Obj = {}): Obj {
  return {
    jsonrpc: "2.0",
    id: requestId,
    method,
    params: { ...params, _meta: requestMeta() },
  };
}

function demo(): Obj[] {
  const transcript: (Obj | SubscriptionStream | null)[] = [];
  transcript.push(handle(rpcRequest(0, "server/discover")));
  transcript.push(handle(rpcRequest(1, "resources/list")));
  transcript.push(handle(rpcRequest(2, "resources/read", { uri: "notes://note-1" })));
  transcript.push(handle(rpcRequest(3, "prompts/list")));
  transcript.push(
    handle(
      rpcRequest(4, "prompts/get", {
        name: "review_note",
        arguments: { uri: "notes://note-1", focus: "operational risk" },
      }),
    ),
  );
  const stream = handle(
    rpcRequest(5, "subscriptions/listen", {
      notifications: {
        resourcesListChanged: true,
        resourceSubscriptions: ["notes://note-1"],
      },
    }),
  );
  if (!(stream instanceof SubscriptionStream)) {
    throw new Error("expected a subscription stream");
  }
  transcript.push(stream.acknowledged(), stream.resourceUpdated("notes://note-1"), stream.close());
  return transcript.filter((item): item is Obj => item !== null && !(item instanceof SubscriptionStream));
}

console.log(JSON.stringify(demo(), null, 2));
