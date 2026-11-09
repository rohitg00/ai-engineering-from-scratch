// Lesson: Capstone: Stateless Tool Ecosystem (phase 13 / lesson 23)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/23-capstone-tool-ecosystem/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/23-capstone-tool-ecosystem/code/main.ts

import { createHash, randomUUID } from "node:crypto";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

interface Span {
  name: string;
  kind: string;
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  start: bigint;
  attrs: Obj;
  end: bigint;
}

const SPANS: Span[] = [];
const TASKS: Map<string, Obj> = new Map();

const PROTOCOL_VERSION = "2026-07-28";
const TASK_EXTENSION = "io.modelcontextprotocol/tasks";
const SERVER_INFO: Obj = { name: "research-simulator", version: "1.0.0" };

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

function pyFloat(n: number): string {
  if (Number.isInteger(n)) return n.toFixed(1);
  return String(n);
}

function pyRepr(v: Json): string {
  if (v === null) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return pyStr(v);
  if (Array.isArray(v)) return "[" + v.map(pyRepr).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `${pyStr(k)}: ${pyRepr(x)}`).join(", ") + "}";
}

function jsonDumps(v: Json): string {
  if (v === null || typeof v !== "object") {
    return JSON.stringify(v).replace(/[\u007f-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
  }
  if (Array.isArray(v)) return "[" + v.map(jsonDumps).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `${jsonDumps(k)}: ${jsonDumps(x)}`).join(", ") + "}";
}

function deepcopy<T>(v: T): T {
  return structuredClone(v);
}

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function requestMeta(tasks = false): Obj {
  const extensions: Obj = tasks ? { [TASK_EXTENSION]: {} } : {};
  return {
    "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
    "io.modelcontextprotocol/clientCapabilities": { extensions },
    "io.modelcontextprotocol/clientInfo": {
      name: "capstone-client",
      version: "1.0.0",
    },
  };
}

function serverMeta(): Obj {
  return { "io.modelcontextprotocol/serverInfo": deepcopy(SERVER_INFO) };
}

function completeResult(fields: Obj): Obj {
  return { resultType: "complete", ...fields, _meta: serverMeta() };
}

function protocolError(code: number, message: string, data: Obj | null = null): Obj {
  const error: Obj = { code, message };
  if (data !== null) error["data"] = data;
  return { error };
}

function validateRequestMeta(meta: Json, requireTasks = false): Obj | null {
  if (!isObj(meta)) return protocolError(-32602, "params._meta must be an object");
  const requested = meta["io.modelcontextprotocol/protocolVersion"];
  if (typeof requested !== "string") return protocolError(-32602, "protocolVersion must be a string");
  if (requested !== PROTOCOL_VERSION) {
    return protocolError(-32022, "Unsupported protocol version", {
      supported: [PROTOCOL_VERSION],
      requested,
    });
  }
  const capabilities = meta["io.modelcontextprotocol/clientCapabilities"];
  if (!isObj(capabilities)) return protocolError(-32602, "clientCapabilities must be an object");
  const extensions = "extensions" in capabilities ? capabilities["extensions"] : {};
  if (requireTasks && (!isObj(extensions) || !(TASK_EXTENSION in extensions))) {
    return protocolError(-32021, "Missing required client capability", {
      requiredCapabilities: {
        extensions: { [TASK_EXTENSION]: {} },
      },
    });
  }
  return null;
}

function serverDiscover(meta: Obj): Obj {
  const invalid = validateRequestMeta(meta);
  if (invalid) return invalid;
  return completeResult({
    supportedVersions: [PROTOCOL_VERSION],
    capabilities: {
      tools: { listChanged: false },
      extensions: { [TASK_EXTENSION]: {} },
    },
    ttlMs: 3_600_000,
    cacheScope: "public",
  });
}

function hex(n: number): string {
  return randomUUID().replace(/-/g, "").slice(0, n * 2);
}

function timeNs(): bigint {
  return process.hrtime.bigint();
}

function span(name: string, kind: string, traceId: string | null, parent: string | null, attrs: Obj): Span {
  const tid = traceId || hex(16);
  const sp: Span = { name, kind, traceId: tid, spanId: hex(8), parentSpanId: parent, start: timeNs(), attrs, end: 0n };
  SPANS.push(sp);
  return sp;
}

function finish(sp: Span): void {
  const now = timeNs();
  sp.end = now > sp.start + 1n ? now : sp.start + 1n;
}

const TOOLS: { name: string; description: string }[] = [
  { name: "arxiv_search", description: "Use when the user searches arXiv by keyword." },
  { name: "generate_report", description: "Use when the user wants a full report." },
];

const PAPERS: { arxiv_id: string; title: string }[] = [
  { arxiv_id: "2603.22489", title: "Tool poisoning attacks on MCP deployments" },
  { arxiv_id: "2604.01055", title: "Agent-to-agent coordination benchmarks" },
  { arxiv_id: "2603.30016", title: "Long-running tool calls via Tasks" },
];

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

const PINNED: Map<string, string> = new Map(TOOLS.map((t) => [`research::${t.name}`, sha256(t.description)]));

function researchArxivSearch(args: Obj): Obj {
  const q = String(args["query"]).toLowerCase();
  const hits: Json = PAPERS.filter((p) => p.title.toLowerCase().includes(q)).map((p) => ({ ...p }));
  return completeResult({
    content: [{ type: "text", text: jsonDumps(hits) }],
    isError: false,
  });
}

function researchGenerateReport(_args: Obj, traceId: string, parent: string): Obj {
  const taskId = `tsk_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const sp = span("mcp.task.working", "INTERNAL", traceId, parent, {
    "gen_ai.operation.name": "execute_tool",
    "mcp.task.id": taskId,
  });
  const a2a = span("a2a.SendMessage", "CLIENT", traceId, sp.spanId, {
    "a2a.peer": "writer-agent",
    "a2a.skill": "summarize_papers",
  });
  finish(a2a);
  finish(sp);
  const html =
    "<!doctype html><html><body>" +
    "<h1>Agent-protocol arXiv report</h1><ul>" +
    PAPERS.map((p) => `<li>${p.arxiv_id}: ${p.title}</li>`).join("") +
    "</ul><script>/* A real MCP App bridge is intentionally absent. */</script></body></html>";
  const now = new Date().toISOString().replace("Z", "000+00:00");
  TASKS.set(taskId, {
    resultType: "complete",
    taskId,
    status: "completed",
    createdAt: now,
    lastUpdatedAt: now,
    ttlMs: 900_000,
    pollIntervalMs: 1_000,
    result: completeResult({
      content: [
        { type: "text", text: "Report generated: 3 papers summarized." },
        { type: "ui_resource", uri: "ui://report/current" },
      ],
      ui: {
        resourceUri: "ui://report/current",
        csp: { "default-src": "'self'" },
        permissions: [],
      },
      html,
    }),
    _meta: serverMeta(),
  });
  return {
    resultType: "task",
    taskId,
    status: "working",
    createdAt: now,
    lastUpdatedAt: now,
    ttlMs: 900_000,
    pollIntervalMs: 1_000,
    _meta: serverMeta(),
  };
}

function tasksGet(taskId: Json, meta: Obj): Obj {
  const invalid = validateRequestMeta(meta, true);
  if (invalid) return invalid;
  if (typeof taskId !== "string") return protocolError(-32602, "Unknown taskId");
  const task = TASKS.get(taskId);
  if (task === undefined) return protocolError(-32602, "Unknown taskId");
  return deepcopy(task);
}

const USERS: Map<string, { id: string; scopes: Set<string> }> = new Map([
  ["tok_alice", { id: "alice", scopes: new Set(["research:read", "research:write"]) }],
  ["tok_bob", { id: "bob", scopes: new Set(["research:read"]) }],
]);
const REQUIRED_SCOPE: Map<string, string> = new Map([
  ["arxiv_search", "research:read"],
  ["generate_report", "research:write"],
]);

const AUDIT: Obj[] = [];

function pinOk(toolName: string, description: string): boolean {
  return PINNED.get(`research::${toolName}`) === sha256(description);
}

function gatewayCall(token: string, toolName: string, args: Obj, traceId: string, parent: string, meta: Obj): Obj {
  const invalid = validateRequestMeta(meta, toolName === "generate_report");
  if (invalid) return invalid;
  const u = USERS.get(token);
  if (!u) return { error: "unauthenticated" };
  const required = REQUIRED_SCOPE.get(toolName);
  if (required && !u.scopes.has(required)) {
    AUDIT.push({ user: u.id, tool: toolName, decision: "403" });
    return { error: "insufficient_scope", scope: required };
  }
  const tool = TOOLS.find((t) => t.name === toolName);
  if (tool === undefined) return { error: "unknown tool" };
  if (!pinOk(toolName, tool.description)) return { error: "hash_mismatch" };
  const sp = span("mcp.call", "CLIENT", traceId, parent, {
    "gen_ai.operation.name": "execute_tool",
    "gen_ai.tool.name": toolName,
    "gateway.user": u.id,
    "mcp.server": "research",
  });
  let result: Obj;
  if (toolName === "arxiv_search") result = researchArxivSearch(args);
  else result = researchGenerateReport(args, traceId, sp.spanId);
  finish(sp);
  AUDIT.push({ user: u.id, tool: toolName, decision: "allow" });
  return result;
}

interface RunOut {
  trace_id: string;
  search: Obj;
  report: Obj;
  task: Obj | null;
}

function orchestrator(token: string, _userQuery: string): RunOut {
  const traceId = hex(16);
  const root = span("agent.invoke_agent", "INTERNAL", traceId, null, {
    "gen_ai.operation.name": "invoke_agent",
    "gen_ai.agent.name": "research-orchestrator",
  });

  const llm1 = span("llm.chat", "CLIENT", traceId, root.spanId, {
    "gen_ai.operation.name": "chat",
    "gen_ai.provider.name": "openai",
    "gen_ai.request.model": "gpt-4o",
    "gen_ai.usage.input_tokens": 24,
  });
  finish(llm1);

  const search = gatewayCall(token, "arxiv_search", { query: "agent" }, traceId, root.spanId, requestMeta());
  const report = gatewayCall(token, "generate_report", { format: "html" }, traceId, root.spanId, requestMeta(true));
  let task: Obj | null = null;
  if (report["resultType"] === "task") task = tasksGet(report["taskId"] ?? null, requestMeta(true));

  const llm2 = span("llm.chat", "CLIENT", traceId, root.spanId, {
    "gen_ai.operation.name": "chat",
    "gen_ai.provider.name": "openai",
    "gen_ai.request.model": "gpt-4o",
    "gen_ai.usage.output_tokens": 85,
  });
  finish(llm2);

  finish(root);
  return { trace_id: traceId, search, report, task };
}

function get(o: Json, ...path: (string | number)[]): Json {
  let cur: Json = o;
  for (const p of path) {
    if (typeof p === "number") cur = (cur as Json[])[p];
    else cur = (cur as Obj)[p];
  }
  return cur;
}

function demo(): void {
  console.log("=".repeat(72));
  console.log("PHASE 13 CAPSTONE - RESEARCH AND REPORT ECOSYSTEM");
  console.log("=".repeat(72));

  console.log("\n--- stateless server discovery ---");
  const discovery = serverDiscover(requestMeta());
  console.log(`  protocol       : ${get(discovery, "supportedVersions", 0)}`);
  console.log(`  task extension : ${pyRepr(TASK_EXTENSION in (get(discovery, "capabilities", "extensions") as Obj))}`);

  console.log("\n--- orchestrator run as alice (read+write) ---");
  let out = orchestrator("tok_alice", "summarize the three most-cited 2026 arXiv papers");
  console.log(`  trace id      : ${out.trace_id}`);
  console.log(`  search result : ${get(out.search, "content", 0, "text")}`);
  console.log(`  report handle : ${out.report["taskId"]} (${out.report["status"]})`);
  console.log(`  task status   : ${get(out.task, "status")} via tasks/get`);
  console.log(`  ui bytes      : ${String(get(out.task, "result", "html")).length}`);

  console.log("\n--- orchestrator run as bob (read only) ---");
  out = orchestrator("tok_bob", "generate a report");
  console.log(`  generate_report -> ${pyRepr(out.report)}`);

  console.log("\n--- audit log ---");
  for (const row of AUDIT) console.log(`  ${pyRepr(row)}`);

  console.log("\n--- OTel GenAI spans ---");
  for (const sp of SPANS) {
    const durMs = sp.end ? Math.round(Number(sp.end - sp.start) / 10_000) / 100 : 0;
    const parent = sp.parentSpanId ? sp.parentSpanId.slice(0, 6) : "ROOT";
    console.log(`  [${sp.traceId.slice(0, 6)}] ${sp.name.padEnd(20)} ${sp.kind.padEnd(8)} parent=${parent}  dur=${pyFloat(durMs)}ms`);
  }

  console.log("\n--- primitive coverage ---");
  const covered = [
    "tool interface and direct function dispatch",
    "server/discover and per-request stateless metadata",
    "structured content dictionaries",
    "task-extension handle and tasks/get polling",
    "ui://-shaped resource reference",
    "description mutation detection with pinned hashes",
    "static-token scope and gateway policy simulation",
    "A2A-shaped opaque delegation boundary",
    "in-memory trace identifiers and parent span identifiers",
    "orchestrator routing between local operations",
  ];
  for (const c of covered) console.log(`  + ${c}`);
}

demo();
