// Phase 13 Lesson 07 — toy MCP server, in TypeScript, stdlib only.
//
// Implements the 2025-11-25 spec's core flow:
//   initialize, tools/list, tools/call, resources/list, resources/read,
//   prompts/list, prompts/get, plus notifications/initialized.
//
// Spec references:
//   MCP 2025-11-25       https://modelcontextprotocol.io/specification/2025-11-25
//   JSON-RPC 2.0         https://www.jsonrpc.org/specification
//
// Not a production server: no auth, no Streamable HTTP transport (Lesson 09),
// no subscriptions. But the wire shape is spec-shaped; any MCP client can
// handshake and call the three notes tools.
//
// Run demo:        npx tsx code/main.ts --demo
// Pipe JSON-RPC:   echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | npx tsx code/main.ts

import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";

const PROTOCOL_VERSION = "2025-11-25";
const SERVER_INFO = { name: "notes-lesson-07", version: "1.0.0" };

type Note = { title: string; body: string; tag: string };

const NOTES: Record<string, Note> = {
  "note-1": { title: "MCP overview", body: "Primitives, lifecycle, JSON-RPC.", tag: "mcp" },
  "note-2": { title: "Function calling", body: "Provider shapes diff by envelope.", tag: "api" },
  "note-3": { title: "Tool schemas", body: "Atomic beats monolithic.", tag: "design" },
};

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  minimum?: number;
  maximum?: number;
};

type ToolDescriptor = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: { readOnlyHint?: boolean; idempotentHint?: boolean; destructiveHint?: boolean };
};

const TOOLS: ToolDescriptor[] = [
  {
    name: "notes_list",
    description:
      "Use when the user wants all notes or a filtered list by tag. Do not use to read a note body.",
    inputSchema: {
      type: "object",
      properties: { tag: { type: "string" } },
      required: [],
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  {
    name: "notes_search",
    description:
      "Use when the user searches notes by content keywords. Do not use for tag filters.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 50 },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "notes_create",
    description: "Use when the user writes a new note. Do not use to edit existing ones.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        tag: { type: "string" },
      },
      required: ["title", "body"],
    },
    annotations: { destructiveHint: false, idempotentHint: false },
  },
];

const PROMPTS = [
  {
    name: "review_note",
    description: "Produce a critique of a note with concrete improvements.",
    arguments: [
      { name: "note_id", description: "The id of the note to review", required: true },
    ],
  },
];

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "resource"; resource: { uri: string; text: string } };

type ToolArgs = Record<string, unknown>;

function execNotesList(args: ToolArgs): ContentBlock[] {
  const tag = args.tag as string | undefined;
  const items: Array<{ id: string; title: string; tag: string }> = [];
  for (const [id, note] of Object.entries(NOTES)) {
    if (tag && note.tag !== tag) continue;
    items.push({ id, title: note.title, tag: note.tag });
  }
  return [{ type: "text", text: JSON.stringify(items) }];
}

function execNotesSearch(args: ToolArgs): ContentBlock[] {
  const q = String(args.query).toLowerCase();
  const limit = (args.limit as number | undefined) ?? 10;
  const hits: Array<{ id: string; title: string }> = [];
  for (const [id, n] of Object.entries(NOTES)) {
    if (n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)) {
      hits.push({ id, title: n.title });
    }
  }
  return [{ type: "text", text: JSON.stringify(hits.slice(0, limit)) }];
}

function execNotesCreate(args: ToolArgs): ContentBlock[] {
  const id = `note-${randomUUID().replace(/-/g, "").slice(0, 6)}`;
  const body = String(args.body);
  NOTES[id] = {
    title: String(args.title),
    body,
    tag: (args.tag as string | undefined) ?? "",
  };
  return [
    { type: "text", text: `Created ${id}` },
    { type: "resource", resource: { uri: `notes://${id}`, text: body } },
  ];
}

const TOOL_EXECUTORS: Record<string, (args: ToolArgs) => ContentBlock[]> = {
  notes_list: execNotesList,
  notes_search: execNotesSearch,
  notes_create: execNotesCreate,
};

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: number | string | null;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
};

function handleInitialize(): unknown {
  return {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {
      tools: { listChanged: false },
      resources: { listChanged: false, subscribe: false },
      prompts: { listChanged: false },
    },
    serverInfo: SERVER_INFO,
  };
}

function handleToolsList(): unknown {
  return { tools: TOOLS };
}

function handleToolsCall(params: Record<string, unknown>): unknown {
  const name = params.name as string;
  const args = (params.arguments as ToolArgs | undefined) ?? {};
  const exec = TOOL_EXECUTORS[name];
  if (!exec) {
    return { content: [{ type: "text", text: `unknown tool ${name}` }], isError: true };
  }
  try {
    return { content: exec(args), isError: false };
  } catch (err) {
    return { content: [{ type: "text", text: String(err) }], isError: true };
  }
}

function handleResourcesList(): unknown {
  const items = Object.entries(NOTES).map(([id, n]) => ({
    uri: `notes://${id}`,
    name: n.title,
    mimeType: "text/markdown",
  }));
  return { resources: items };
}

function handleResourcesRead(params: Record<string, unknown>): unknown {
  const uri = String(params.uri);
  const id = uri.replace("notes://", "");
  const n = NOTES[id];
  if (!n) throw new Error(`not found: ${uri}`);
  return {
    contents: [
      {
        uri,
        mimeType: "text/markdown",
        text: `# ${n.title}\n\n${n.body}\n\ntag: ${n.tag}`,
      },
    ],
  };
}

function handlePromptsList(): unknown {
  return { prompts: PROMPTS };
}

function handlePromptsGet(params: Record<string, unknown>): unknown {
  if (params.name !== "review_note") throw new Error("unknown prompt");
  const args = (params.arguments as Record<string, unknown> | undefined) ?? {};
  const id = String(args.note_id ?? "");
  const body = NOTES[id]?.body ?? "(not found)";
  return {
    description: "Review the note and propose concrete improvements.",
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Review this note and propose improvements:\n\n${body}`,
        },
      },
    ],
  };
}

const HANDLERS: Record<string, (params: Record<string, unknown>) => unknown> = {
  initialize: handleInitialize,
  "tools/list": handleToolsList,
  "tools/call": handleToolsCall,
  "resources/list": handleResourcesList,
  "resources/read": handleResourcesRead,
  "prompts/list": handlePromptsList,
  "prompts/get": handlePromptsGet,
};

function dispatch(msg: JsonRpcRequest): JsonRpcResponse | null {
  const method = msg.method;
  if (msg.id === undefined) return null;
  const id = msg.id;
  const handler = HANDLERS[method];
  if (!handler) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    };
  }
  try {
    const result = handler(msg.params ?? {});
    return { jsonrpc: "2.0", id, result };
  } catch (err) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32603, message: String(err) },
    };
  }
}

function serveStdio(): void {
  const rl = createInterface({ input: process.stdin, terminal: false });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let msg: JsonRpcRequest;
    try {
      msg = JSON.parse(trimmed) as JsonRpcRequest;
    } catch (err) {
      process.stderr.write(`parse error: ${String(err)}\n`);
      process.stdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Parse error", data: String(err) },
        }) + "\n",
      );
      return;
    }
    const resp = dispatch(msg);
    if (resp) process.stdout.write(JSON.stringify(resp) + "\n");
  });
}

function demo(): void {
  console.log("=".repeat(72));
  console.log("PHASE 13 LESSON 07 - MCP SERVER DEMO (TypeScript port, no transport)");
  console.log("=".repeat(72));

  const scenarios: JsonRpcRequest[] = [
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: PROTOCOL_VERSION } },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "notes_search", arguments: { query: "MCP" } },
    },
    { jsonrpc: "2.0", id: 4, method: "resources/list" },
    {
      jsonrpc: "2.0",
      id: 5,
      method: "resources/read",
      params: { uri: "notes://note-1" },
    },
    {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: {
        name: "notes_create",
        arguments: { title: "Session notes", body: "Built it.", tag: "mcp" },
      },
    },
    {
      jsonrpc: "2.0",
      id: 7,
      method: "prompts/get",
      params: { name: "review_note", arguments: { note_id: "note-1" } },
    },
    {
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: { name: "no_such_tool", arguments: {} },
    },
  ];

  for (const msg of scenarios) {
    console.log("\n>>>", msg.method);
    const resp = dispatch(msg);
    console.log(JSON.stringify(resp, null, 2).slice(0, 400));
  }
}

function main(): void {
  if (process.argv.includes("--demo")) {
    demo();
  } else {
    serveStdio();
  }
}

main();
