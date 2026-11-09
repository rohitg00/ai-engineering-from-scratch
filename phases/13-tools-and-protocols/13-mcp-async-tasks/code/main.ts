// Lesson: MCP Tasks Extension: Durable Work on a Stateless Core (phase 13 / lesson 13)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/13-mcp-async-tasks/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/13-mcp-async-tasks/code/main.ts

import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

type Json = any;
type Obj = Record<string, Json>;

const PROTOCOL_VERSION = "2026-07-28";
const PROTOCOL_META = "io.modelcontextprotocol/protocolVersion";
const CAPABILITIES_META = "io.modelcontextprotocol/clientCapabilities";
const CLIENT_INFO_META = "io.modelcontextprotocol/clientInfo";
const SERVER_INFO_META = "io.modelcontextprotocol/serverInfo";
const SUBSCRIPTION_ID_META = "io.modelcontextprotocol/subscriptionId";
const TASKS_EXTENSION = "io.modelcontextprotocol/tasks";
const TERMINAL_STATUSES = new Set(["completed", "cancelled", "failed"]);
const TOOLS: Obj[] = [
  {
    name: "generate_report",
    description: "Generate a durable report that may require outline approval.",
    inputSchema: {
      type: "object",
      properties: {
        size: {
          type: "string",
          enum: ["small", "medium", "large"],
          default: "medium",
        },
      },
      required: [],
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

function requestMeta(tasks = true): Obj {
  const extensions: Obj = tasks ? { [TASKS_EXTENSION]: {} } : {};
  return {
    [PROTOCOL_META]: PROTOCOL_VERSION,
    [CAPABILITIES_META]: { extensions },
    [CLIENT_INFO_META]: { name: "lesson-client", version: "1.0.0" },
  };
}

function serverMeta(): Obj {
  return { [SERVER_INFO_META]: { name: "tasks-demo", version: "1.0.0" } };
}

function complete(fields: Obj = {}): Obj {
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

function requireTasksExtension(meta: Obj): void {
  const extensions = meta[CAPABILITIES_META].extensions;
  if (!isDict(extensions) || !(TASKS_EXTENSION in extensions)) {
    throw new McpError(-32021, "missing required client capability", {
      requiredCapabilities: { extensions: { [TASKS_EXTENSION]: {} } },
    });
  }
}

function utcNow(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

interface TaskInit {
  task_id: string;
  owner: string;
  operation: string;
  status: string;
  status_message: string;
  created_at: string;
  last_updated_at: string;
  ttl_ms: number | null;
  poll_interval_ms?: number;
  stage?: number;
  size?: string;
  result?: Obj | null;
  error?: Obj | null;
  input_requests?: Obj;
  issued_keys?: string[];
}

class Task {
  taskId: string;
  owner: string;
  operation: string;
  status: string;
  statusMessage: string;
  createdAt: string;
  lastUpdatedAt: string;
  ttlMs: number | null;
  pollIntervalMs: number;
  stage: number;
  size: string;
  result: Obj | null;
  error: Obj | null;
  inputRequests: Obj;
  issuedKeys: string[];

  constructor(init: TaskInit) {
    this.taskId = init.task_id;
    this.owner = init.owner;
    this.operation = init.operation;
    this.status = init.status;
    this.statusMessage = init.status_message;
    this.createdAt = init.created_at;
    this.lastUpdatedAt = init.last_updated_at;
    this.ttlMs = init.ttl_ms;
    this.pollIntervalMs = init.poll_interval_ms ?? 1_000;
    this.stage = init.stage ?? 0;
    this.size = init.size ?? "medium";
    this.result = init.result ?? null;
    this.error = init.error ?? null;
    this.inputRequests = init.input_requests ?? {};
    this.issuedKeys = init.issued_keys ?? [];
  }

  asDict(): Required<TaskInit> {
    return {
      task_id: this.taskId,
      owner: this.owner,
      operation: this.operation,
      status: this.status,
      status_message: this.statusMessage,
      created_at: this.createdAt,
      last_updated_at: this.lastUpdatedAt,
      ttl_ms: this.ttlMs,
      poll_interval_ms: this.pollIntervalMs,
      stage: this.stage,
      size: this.size,
      result: this.result,
      error: this.error,
      input_requests: this.inputRequests,
      issued_keys: this.issuedKeys,
    };
  }

  toWire(): Obj {
    const wire: Obj = {
      taskId: this.taskId,
      status: this.status,
      statusMessage: this.statusMessage,
      createdAt: this.createdAt,
      lastUpdatedAt: this.lastUpdatedAt,
      ttlMs: this.ttlMs,
      pollIntervalMs: this.pollIntervalMs,
    };
    if (this.status === "input_required") {
      wire.inputRequests = this.inputRequests;
    } else if (this.status === "completed") {
      wire.result = this.result;
    } else if (this.status === "failed") {
      wire.error = this.error;
    }
    return wire;
  }
}

function sortKeysDeep(value: Json): Json {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (isDict(value)) {
    const sorted: Obj = {};
    for (const key of Object.keys(value).sort(compareStrings)) {
      sorted[key] = sortKeysDeep(value[key]);
    }
    return sorted;
  }
  return value;
}

class TaskStore {
  readonly directory: string;
  tasks: Map<string, Task> = new Map();

  constructor(directory: string) {
    this.directory = directory;
    mkdirSync(this.directory, { recursive: true });
    this.reload();
  }

  reload(): void {
    this.tasks = new Map();
    const files = readdirSync(this.directory)
      .filter((name) => name.endsWith(".json"))
      .sort(compareStrings);
    for (const name of files) {
      const data = JSON.parse(readFileSync(join(this.directory, name), "utf8")) as TaskInit;
      const task = new Task(data);
      this.tasks.set(task.taskId, task);
    }
  }

  persist(task: Task): void {
    const path = join(this.directory, `${task.taskId}.json`);
    const temporary = join(this.directory, `${task.taskId}.tmp`);
    writeFileSync(temporary, JSON.stringify(sortKeysDeep(task.asDict()), null, 2), "utf8");
    renameSync(temporary, path);
    this.tasks.set(task.taskId, task);
  }

  create(size: string, owner: string): Task {
    const timestamp = utcNow();
    const task = new Task({
      task_id: `tsk_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      owner,
      operation: "tools/call:generate_report",
      status: "working",
      status_message: "Preparing report outline.",
      created_at: timestamp,
      last_updated_at: timestamp,
      ttl_ms: 900_000,
      size,
    });
    this.persist(task);
    return task;
  }

  get(taskId: Json): Task {
    if (typeof taskId !== "string" || !this.tasks.has(taskId)) {
      throw new McpError(-32602, "task not found");
    }
    return this.tasks.get(taskId) as Task;
  }

  save(task: Task): void {
    task.lastUpdatedAt = utcNow();
    this.persist(task);
  }
}

class TaskService {
  store: TaskStore;

  constructor(directory: string) {
    this.store = new TaskStore(directory);
  }

  serverDiscover(params: Obj): Obj {
    validateRequestMeta(params);
    return complete({
      supportedVersions: [PROTOCOL_VERSION],
      capabilities: {
        tools: {},
        extensions: { [TASKS_EXTENSION]: {} },
      },
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

  private ownedTask(taskId: Json, principal: string): Task {
    const task = this.store.get(taskId);
    if (task.owner !== principal) {
      throw new McpError(-32602, "task not found");
    }
    return task;
  }

  toolsCall(params: Obj, principal: string): Obj {
    const meta = validateRequestMeta(params);
    requireTasksExtension(meta);
    if (params.name !== "generate_report") {
      throw new McpError(-32602, "unknown tool");
    }
    const args = "arguments" in params ? params.arguments : {};
    if (!isDict(args)) {
      throw new McpError(-32602, "arguments must be an object");
    }
    const size = "size" in args ? args.size : "medium";
    if (!["small", "medium", "large"].includes(size)) {
      throw new McpError(-32602, "size must be small, medium, or large");
    }

    const task = this.store.create(size, principal);
    return { resultType: "task", ...task.toWire(), _meta: serverMeta() };
  }

  tasksGet(params: Obj, principal: string): Obj {
    const meta = validateRequestMeta(params);
    requireTasksExtension(meta);
    const task = this.ownedTask(params.taskId, principal);
    return complete(task.toWire());
  }

  tasksUpdate(params: Obj, principal: string): Obj {
    const meta = validateRequestMeta(params);
    requireTasksExtension(meta);
    const task = this.ownedTask(params.taskId, principal);
    const responses = params.inputResponses;
    if (!isDict(responses)) {
      throw new McpError(-32602, "inputResponses must be an object");
    }

    if (task.status === "input_required") {
      const answer = responses.approve_outline;
      if (isDict(answer)) {
        const action = answer.action;
        if (action === "decline" || action === "cancel") {
          task.status = "cancelled";
          task.statusMessage = "User did not approve the outline.";
          task.inputRequests = {};
          this.store.save(task);
        } else if (action === "accept" && isDict(answer.content)) {
          if (answer.content.approved === true) {
            task.status = "working";
            task.statusMessage = "Generating approved report.";
            task.stage = 2;
            task.inputRequests = {};
            this.store.save(task);
          }
        }
      }
    }
    return complete();
  }

  tasksCancel(params: Obj, principal: string): Obj {
    const meta = validateRequestMeta(params);
    requireTasksExtension(meta);
    const task = this.ownedTask(params.taskId, principal);
    if (!TERMINAL_STATUSES.has(task.status)) {
      task.status = "cancelled";
      task.statusMessage = "Cancellation was acknowledged by the worker.";
      task.inputRequests = {};
      this.store.save(task);
    }
    return complete();
  }

  advanceWorker(taskId: string): Task {
    const task = this.store.get(taskId);
    if (task.status !== "working") {
      return task;
    }
    if (task.stage === 0) {
      const key = "approve_outline";
      if (task.issuedKeys.includes(key)) {
        throw new Error("task input request key cannot be reused");
      }
      task.issuedKeys.push(key);
      task.inputRequests = {
        [key]: {
          method: "elicitation/create",
          params: {
            mode: "form",
            message: "Approve the generated report outline?",
            requestedSchema: {
              type: "object",
              properties: { approved: { type: "boolean" } },
              required: ["approved"],
            },
          },
        },
      };
      task.status = "input_required";
      task.statusMessage = "Waiting for outline approval.";
      task.stage = 1;
    } else if (task.stage === 2) {
      task.status = "completed";
      task.statusMessage = "Report completed.";
      task.stage = 3;
      task.result = complete({
        content: [
          {
            type: "text",
            text: `Generated ${task.size} report with approved outline.`,
          },
        ],
        structuredContent: { size: task.size, approved: true },
        isError: false,
      });
    }
    this.store.save(task);
    return task;
  }

  subscriptionAcknowledgement(taskIds: string[], subscriptionId: number | string, principal = "user-42"): Obj {
    const accepted = taskIds.filter(
      (taskId) => this.store.tasks.has(taskId) && (this.store.tasks.get(taskId) as Task).owner === principal,
    );
    return {
      jsonrpc: "2.0",
      method: "notifications/subscriptions/acknowledged",
      params: {
        notifications: { taskIds: accepted },
        _meta: { [SUBSCRIPTION_ID_META]: subscriptionId },
      },
    };
  }

  taskNotification(taskId: string, subscriptionId: number | string, principal = "user-42"): Obj {
    const task = this.ownedTask(taskId, principal);
    return {
      jsonrpc: "2.0",
      method: "notifications/tasks",
      params: {
        ...task.toWire(),
        _meta: { [SUBSCRIPTION_ID_META]: subscriptionId },
      },
    };
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
      } else if (method === "tasks/get") {
        result = this.tasksGet(params, principal);
      } else if (method === "tasks/update") {
        result = this.tasksUpdate(params, principal);
      } else if (method === "tasks/cancel") {
        result = this.tasksCancel(params, principal);
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

function makeRequest(requestId: number, method: string, params: Obj, tasks = true): Obj {
  return {
    jsonrpc: "2.0",
    id: requestId,
    method,
    params: { ...params, _meta: requestMeta(tasks) },
  };
}

function makeHttpRequest(
  requestId: number,
  method: string,
  params: Obj,
  tasks = true,
): [Obj, Record<string, string>] {
  const body = makeRequest(requestId, method, params, tasks);
  const headers: Record<string, string> = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    "MCP-Protocol-Version": PROTOCOL_VERSION,
    "Mcp-Method": method,
  };
  const taskMethods = new Set(["tasks/get", "tasks/update", "tasks/cancel"]);
  let name: Json = null;
  if (method === "tools/call") {
    name = body.params.name;
  } else if (taskMethods.has(method)) {
    name = body.params.taskId;
  }
  if (method === "tools/call" || taskMethods.has(method)) {
    if (typeof name !== "string" || !name) {
      throw new RangeError(`${method} requires a name for Mcp-Name`);
    }
    headers["Mcp-Name"] = name;
  }
  return [body, headers];
}

function runDemo(directory: string): [TaskService, Obj[]] {
  let service = new TaskService(directory);
  const transcript: Obj[] = [];
  transcript.push(service.dispatch(makeRequest(0, "server/discover", {})) as Obj);
  const created = service.dispatch(
    makeRequest(1, "tools/call", { name: "generate_report", arguments: { size: "large" } }),
  ) as Obj;
  transcript.push(created);
  const taskId: string = created.result.taskId;

  service = new TaskService(directory);
  transcript.push(service.dispatch(makeRequest(2, "tasks/get", { taskId })) as Obj);
  service.advanceWorker(taskId);
  const needsInput = service.dispatch(makeRequest(3, "tasks/get", { taskId })) as Obj;
  transcript.push(needsInput);
  transcript.push(
    service.dispatch(
      makeRequest(4, "tasks/update", {
        taskId,
        inputResponses: {
          approve_outline: {
            action: "accept",
            content: { approved: true },
          },
        },
      }),
    ) as Obj,
  );
  service.advanceWorker(taskId);
  transcript.push(service.dispatch(makeRequest(5, "tasks/get", { taskId })) as Obj);
  return [service, transcript];
}

function main(): void {
  const directory = mkdtempSync(join(tmpdir(), "lesson-13-tasks-"));
  try {
    const [service, transcript] = runDemo(directory);
    for (const response of transcript) {
      const result = response.result;
      console.log(`id=${response.id} resultType=${result.resultType} ` + `status=${result.status ?? "ack"}`);
    }
    const taskId: string = transcript[1].result.taskId;
    console.log("notification:", JSON.stringify(service.taskNotification(taskId, "listen-demo"), null, 2));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

main();
