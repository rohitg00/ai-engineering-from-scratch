// Lesson: Model Context Protocol (MCP) (phase 11 / lesson 14)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/11-llm-engineering/14-model-context-protocol/docs/en.md
// Run: npx tsx phases/11-llm-engineering/14-model-context-protocol/code/main.ts

export {};

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };
type Kwargs = { [key: string]: Json };

const PROTOCOL_VERSION = "2026-07-28";
const SUPPORTED_VERSIONS: string[] = [PROTOCOL_VERSION];
const PROTOCOL_KEY = "io.modelcontextprotocol/protocolVersion";
const CLIENT_CAPABILITIES_KEY = "io.modelcontextprotocol/clientCapabilities";
const CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo";
const SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo";

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIdType(value: unknown): value is string | number {
  return typeof value === "string" || (typeof value === "number" && Number.isInteger(value));
}

function pyJsonDumps(value: Json): string {
  if (Array.isArray(value)) return "[" + value.map(pyJsonDumps).join(", ") + "]";
  if (isObject(value)) {
    return "{" + Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${pyJsonDumps(v)}`).join(", ") + "}";
  }
  return JSON.stringify(value);
}

function callWithKwargs<T>(params: string[], handler: (args: Kwargs) => T, args: Kwargs): T {
  for (const key of Object.keys(args)) {
    if (!params.includes(key)) throw new TypeError(`unexpected keyword argument '${key}'`);
  }
  for (const key of params) {
    if (!(key in args)) throw new TypeError(`missing required argument: '${key}'`);
  }
  return handler(args);
}

interface Tool {
  name: string;
  description: string;
  input_schema: JsonObject;
  params: string[];
  handler: (args: Kwargs) => Json;
  destructive: boolean;
}

interface Resource {
  uri: string;
  name: string;
  description: string;
  handler: () => unknown;
}

interface Prompt {
  name: string;
  description: string;
  arguments: string[];
  handler: (args: Kwargs) => unknown;
}

function requestMetadata(
  opts: { client_name?: string; client_version?: string; capabilities?: JsonObject | null; protocol_version?: string } = {},
): JsonObject {
  const { client_name = "demo-client", client_version = "1.0.0", capabilities = null, protocol_version = PROTOCOL_VERSION } = opts;
  return {
    [PROTOCOL_KEY]: protocol_version,
    [CLIENT_CAPABILITIES_KEY]: capabilities || {},
    [CLIENT_INFO_KEY]: { name: client_name, version: client_version },
  };
}

class MCPServer {
  name: string;
  server_info: JsonObject;
  tools = new Map<string, Tool>();
  resources = new Map<string, Resource>();
  prompts = new Map<string, Prompt>();

  constructor(name: string) {
    this.name = name;
    this.server_info = { name, version: "0.2.0" };
  }

  tool(
    name: string,
    description: string,
    schema: JsonObject,
    params: string[],
    fn: (args: Kwargs) => Json,
    opts: { destructive?: boolean } = {},
  ): (args: Kwargs) => Json {
    this.tools.set(name, { name, description, input_schema: schema, params, handler: fn, destructive: opts.destructive ?? false });
    return fn;
  }

  resource(uri: string, name: string, description: string, fn: () => unknown): () => unknown {
    this.resources.set(uri, { uri, name, description, handler: fn });
    return fn;
  }

  prompt(name: string, description: string, args: string[], fn: (args: Kwargs) => unknown): (args: Kwargs) => unknown {
    this.prompts.set(name, { name, description, arguments: args, handler: fn });
    return fn;
  }

  private capabilities(): JsonObject {
    return { tools: {}, resources: {}, prompts: {} };
  }

  private complete(payload: JsonObject, opts: { cacheable?: boolean } = {}): JsonObject {
    const result: JsonObject = {
      resultType: "complete",
      ...payload,
      _meta: { [SERVER_INFO_KEY]: this.server_info },
    };
    if (opts.cacheable) Object.assign(result, { ttlMs: 30_000, cacheScope: "private" });
    return result;
  }

  static error(requestId: Json, code: number, message: string, data: Json = null): JsonObject {
    const error: JsonObject = { code, message };
    if (data !== null) error["data"] = data;
    return { jsonrpc: "2.0", id: requestId, error };
  }

  private validateMetadata(params: JsonObject, requestId: Json): JsonObject | null {
    const metadata = params["_meta"];
    if (!isObject(metadata)) return MCPServer.error(requestId, -32602, "params._meta is required");
    if (!(PROTOCOL_KEY in metadata)) return MCPServer.error(requestId, -32602, `${PROTOCOL_KEY} is required`);
    const version = metadata[PROTOCOL_KEY];
    if (typeof version !== "string") return MCPServer.error(requestId, -32602, `${PROTOCOL_KEY} must be a string`);
    if (!SUPPORTED_VERSIONS.includes(version)) {
      return MCPServer.error(requestId, -32022, "Unsupported protocol version", {
        supported: [...SUPPORTED_VERSIONS],
        requested: version,
      });
    }
    if (!isObject(metadata[CLIENT_CAPABILITIES_KEY])) {
      return MCPServer.error(requestId, -32602, "clientCapabilities must be an object");
    }
    const clientInfo = metadata[CLIENT_INFO_KEY];
    if (
      clientInfo !== undefined &&
      clientInfo !== null &&
      (!isObject(clientInfo) || typeof clientInfo["name"] !== "string" || typeof clientInfo["version"] !== "string")
    ) {
      return MCPServer.error(requestId, -32602, "clientInfo must contain name and version");
    }
    return null;
  }

  handle(message: unknown): JsonObject | null {
    if (!isObject(message)) return MCPServer.error(null, -32600, "request must be an object");

    const requestId: Json = message["id"] ?? null;
    if (!("id" in message)) return null;
    if (message["jsonrpc"] !== "2.0" || typeof message["method"] !== "string") {
      const errorId = isIdType(requestId) ? requestId : null;
      return MCPServer.error(errorId, -32600, "invalid JSON-RPC request");
    }
    if (!isIdType(requestId)) return MCPServer.error(null, -32600, "id must be a string or integer");

    const method = message["method"];
    const params = "params" in message ? message["params"] : {};
    if (!isObject(params)) return MCPServer.error(requestId, -32602, "params must be an object");

    const metadataError = this.validateMetadata(params, requestId);
    if (metadataError) return metadataError;

    let result: JsonObject;
    if (method === "server/discover") {
      result = this.complete(
        {
          supportedVersions: [...SUPPORTED_VERSIONS],
          capabilities: this.capabilities(),
          instructions: "Use add for arithmetic and request approval before delete_user.",
        },
        { cacheable: true },
      );
    } else if (method === "tools/list") {
      const sorted = [...this.tools.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      result = this.complete(
        {
          tools: sorted.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.input_schema,
            annotations: (tool.destructive ? { destructiveHint: true } : {}) as JsonObject,
          })),
        },
        { cacheable: true },
      );
    } else if (method === "tools/call") {
      const name = params["name"];
      if (typeof name !== "string" || !this.tools.has(name)) {
        return MCPServer.error(requestId, -32602, "missing or unknown tool name");
      }
      const args = "arguments" in params ? params["arguments"] : {};
      if (!isObject(args)) return MCPServer.error(requestId, -32602, "arguments must be an object");
      const tool = this.tools.get(name)!;
      let output: string;
      try {
        output = pyJsonDumps(callWithKwargs(tool.params, tool.handler, args));
      } catch {
        return MCPServer.error(requestId, -32603, "tool handler failed");
      }
      result = this.complete({ content: [{ type: "text", text: output }], isError: false });
    } else if (method === "resources/list") {
      const sorted = [...this.resources.values()].sort((a, b) => (a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0));
      result = this.complete(
        { resources: sorted.map((item) => ({ uri: item.uri, name: item.name, description: item.description })) },
        { cacheable: true },
      );
    } else if (method === "resources/read") {
      const uri = params["uri"];
      if (typeof uri !== "string" || !this.resources.has(uri)) {
        return MCPServer.error(requestId, -32602, "missing or unknown resource URI");
      }
      const resource = this.resources.get(uri)!;
      let text: string;
      try {
        const value = resource.handler();
        if (typeof value !== "string") throw new TypeError("resource handler must return text");
        text = value;
      } catch {
        return MCPServer.error(requestId, -32603, "resource handler failed");
      }
      result = this.complete({ contents: [{ uri: resource.uri, mimeType: "text/plain", text }] }, { cacheable: true });
    } else if (method === "prompts/list") {
      const sorted = [...this.prompts.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      result = this.complete(
        {
          prompts: sorted.map((item) => ({
            name: item.name,
            description: item.description,
            arguments: item.arguments.map((argument) => ({ name: argument, required: true })),
          })),
        },
        { cacheable: true },
      );
    } else if (method === "prompts/get") {
      const name = params["name"];
      if (typeof name !== "string" || !this.prompts.has(name)) {
        return MCPServer.error(requestId, -32602, "missing or unknown prompt name");
      }
      const args = "arguments" in params ? params["arguments"] : {};
      if (!isObject(args)) return MCPServer.error(requestId, -32602, "arguments must be an object");
      const prompt = this.prompts.get(name)!;
      let rendered: string;
      try {
        const value = callWithKwargs(prompt.arguments, prompt.handler, args);
        if (typeof value !== "string") throw new TypeError("prompt handler must return text");
        rendered = value;
      } catch {
        return MCPServer.error(requestId, -32603, "prompt handler failed");
      }
      result = this.complete({ messages: [{ role: "user", content: { type: "text", text: rendered } }] });
    } else {
      return MCPServer.error(requestId, -32601, `unknown method: ${method}`);
    }

    return { jsonrpc: "2.0", id: requestId, result };
  }
}

class MCPClient {
  server: MCPServer;
  private id = 0;

  constructor(server: MCPServer) {
    this.server = server;
  }

  request(method: string, params: JsonObject | null = null): JsonObject {
    this.id += 1;
    const requestParams: JsonObject = { ...(params || {}) };
    requestParams["_meta"] = requestMetadata();
    const response = this.server.handle({ jsonrpc: "2.0", id: this.id, method, params: requestParams });
    if (response === null) throw new Error("request did not receive a response");
    if ("error" in response) throw new Error(String((response["error"] as JsonObject)["message"]));
    return response["result"] as JsonObject;
  }
}

const server = new MCPServer("demo-server");

server.tool(
  "add",
  "Add two integers and return the sum.",
  {
    type: "object",
    properties: { a: { type: "integer" }, b: { type: "integer" } },
    required: ["a", "b"],
  },
  ["a", "b"],
  function add(args: Kwargs): Json {
    return { sum: (args["a"] as number) + (args["b"] as number) };
  },
);

server.tool(
  "delete_user",
  "Delete a user by id. Mutating; requires approval.",
  {
    type: "object",
    properties: { user_id: { type: "integer" } },
    required: ["user_id"],
  },
  ["user_id"],
  function deleteUser(args: Kwargs): Json {
    return { deleted: args["user_id"], note: "simulated" };
  },
  { destructive: true },
);

server.resource("config://app", "app-config", "Application config as JSON text.", function appConfig(): string {
  return pyJsonDumps({ env: "prod", region: "us-east-1" });
});

server.prompt("code_review", "Review code in a language.", ["language", "code"], function codeReview(args: Kwargs): string {
  return `You are a senior ${String(args["language"])} reviewer. Review for correctness and style:\n\n${String(args["code"])}`;
});

function main(): void {
  const client = new MCPClient(server);
  const discovery = client.request("server/discover");
  const info = (discovery["_meta"] as JsonObject)[SERVER_INFO_KEY] as JsonObject;
  console.log(`Discovered ${String(info["name"])} (protocol ${String((discovery["supportedVersions"] as Json[])[0])})`);

  const tools = client.request("tools/list")["tools"] as JsonObject[];
  console.log(`\n${tools.length} tool(s) discovered:`);
  for (const tool of tools) {
    const annotations = (tool["annotations"] ?? {}) as JsonObject;
    const flag = annotations["destructiveHint"] ? " [destructive]" : "";
    console.log(`  - ${String(tool["name"])}${flag}: ${String(tool["description"])}`);
  }

  const addResult = client.request("tools/call", { name: "add", arguments: { a: 40, b: 2 } });
  console.log("\nCall add(40, 2) ->", String(((addResult["content"] as JsonObject[])[0])["text"]));

  const resources = client.request("resources/list")["resources"] as JsonObject[];
  console.log(`\n${resources.length} resource(s): ${String(resources[0]["uri"])}`);
  const config = client.request("resources/read", { uri: "config://app" });
  console.log("Read config://app ->", String(((config["contents"] as JsonObject[])[0])["text"]));

  const prompt = client.request("prompts/get", {
    name: "code_review",
    arguments: { language: "Python", code: "x = 1\n" },
  });
  const content = ((prompt["messages"] as JsonObject[])[0])["content"] as JsonObject;
  console.log("\nRender code_review prompt ->", String(content["text"]).slice(0, 80));
}

main();
