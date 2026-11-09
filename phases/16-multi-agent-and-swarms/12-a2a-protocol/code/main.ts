// Lesson: A2A: The Agent-to-Agent Protocol (phase 16 / lesson 12)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/12-a2a-protocol/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/12-a2a-protocol/code/main.ts

import { randomUUID } from "node:crypto";
import http from "node:http";
import { setTimeout as sleep } from "node:timers/promises";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };

const A2A_VERSION = "1.0";
const A2A_MEDIA_TYPE = "application/a2a+json";
const PORT = 8765;
const BASE_URL = `http://localhost:${PORT}`;
const TERMINAL_STATES = ["TASK_STATE_COMPLETED", "TASK_STATE_FAILED", "TASK_STATE_CANCELED", "TASK_STATE_REJECTED"];

const AGENT_CARD: Obj = {
  name: "code-review-agent",
  description: "Reviews Python code for missing functions and return statements.",
  version: "0.1.0",
  supportedInterfaces: [
    { url: BASE_URL, protocolBinding: "HTTP+JSON", protocolVersion: A2A_VERSION },
  ],
  capabilities: { streaming: false, pushNotifications: false },
  securityRequirements: [],
  defaultInputModes: ["application/json"],
  defaultOutputModes: ["application/json"],
  skills: [
    {
      id: "review-python",
      name: "Review Python",
      description: "Flags Python code with no function definition or no return statement.",
      tags: ["code-review", "python"],
    },
  ],
};

function pyStr(s: string): string {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
  if (q === "'") out = out.replace(/'/g, "\\'");
  return q + out + q;
}

function pyRepr(v: Json): string {
  if (v === null) return "None";
  if (typeof v === "string") return pyStr(v);
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return "[" + v.map(pyRepr).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `${pyStr(k)}: ${pyRepr(x)}`).join(", ") + "}";
}

class TaskStore {
  tasks = new Map<string, Obj>();

  async create(message: Obj, returnImmediately: boolean): Promise<Obj | null> {
    const tid = randomUUID().slice(0, 8);
    const task: Obj = {
      id: tid,
      contextId: randomUUID(),
      status: { state: "TASK_STATE_SUBMITTED" },
      artifacts: [],
      history: [message],
    };
    this.tasks.set(tid, task);
    const submitted: Obj = { id: tid, contextId: task["contextId"], status: { ...(task["status"] as Obj) } };
    const worker = this.run(tid);
    if (returnImmediately) return submitted;
    await worker;
    return this.get(tid);
  }

  private async run(tid: string): Promise<void> {
    this.tasks.get(tid)!["status"] = { state: "TASK_STATE_WORKING" };
    await sleep(200);
    const t = this.tasks.get(tid)!;
    const first = (t["history"] as Obj[])[0];
    const part = (first["parts"] as Obj[]).find((p) => "data" in p);
    const data: Json = part ? part["data"] : {};
    const code = data !== null && typeof data === "object" && !Array.isArray(data) ? data["code"] : undefined;
    if (typeof code === "string") {
      const issues: string[] = [];
      if (!code.includes("return")) issues.push("no return statement");
      if (!code.includes("def ")) issues.push("no function definition");
      t["artifacts"] = [{
        artifactId: randomUUID(),
        name: "review",
        parts: [{ data: { issues, lines: code.split("\n").length }, mediaType: "application/json" }],
      }];
      t["status"] = { state: "TASK_STATE_COMPLETED" };
    } else {
      t["status"] = {
        state: "TASK_STATE_FAILED",
        message: {
          messageId: randomUUID(), role: "ROLE_AGENT",
          parts: [{ text: "expected a data part with a 'code' field" }],
        },
      };
    }
  }

  get(tid: string): Obj | null {
    return this.tasks.get(tid) ?? null;
  }
}

const STORE = new TaskStore();

function sendJson(res: http.ServerResponse, status: number, body: Json, contentType = A2A_MEDIA_TYPE): void {
  const data = Buffer.from(JSON.stringify(body), "utf-8");
  res.writeHead(status, { "Content-Type": contentType, "Content-Length": String(data.length) });
  res.end(data);
}

function sendError(res: http.ServerResponse, httpStatus: number, rpcStatus: string, message: string, reason = ""): void {
  const error: Obj = { code: httpStatus, status: rpcStatus, message };
  if (reason) {
    error["details"] = [{
      "@type": "type.googleapis.com/google.rpc.ErrorInfo",
      reason, domain: "a2a-protocol.org",
    }];
  }
  sendJson(res, httpStatus, { error });
}

function versionOk(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  if (req.headers["a2a-version"] === A2A_VERSION) return true;
  sendError(res, 400, "FAILED_PRECONDITION", `A2A-Version ${A2A_VERSION} is required`, "VERSION_NOT_SUPPORTED");
  return false;
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const path = req.url ?? "";
  if (req.method === "GET") {
    if (path === "/.well-known/agent-card.json") {
      sendJson(res, 200, AGENT_CARD, "application/json");
      return;
    }
    if (path.startsWith("/tasks/")) {
      if (!versionOk(req, res)) return;
      const tid = path.slice(path.indexOf("/tasks/") + "/tasks/".length);
      const task = STORE.get(tid);
      if (task === null) {
        sendError(res, 404, "NOT_FOUND", "task not found", "TASK_NOT_FOUND");
        return;
      }
      sendJson(res, 200, task);
      return;
    }
    sendError(res, 404, "NOT_FOUND", "route not found");
    return;
  }
  if (req.method === "POST") {
    if (path === "/message:send") {
      if (!versionOk(req, res)) return;
      const raw = await readBody(req);
      const body = JSON.parse(raw) as Obj;
      const configuration = (body["configuration"] as Obj | undefined) ?? {};
      const returnImmediately = (configuration["returnImmediately"] as boolean | undefined) ?? false;
      const task = await STORE.create(body["message"] as Obj, returnImmediately);
      sendJson(res, 200, { task });
      return;
    }
    sendError(res, 404, "NOT_FOUND", "route not found");
    return;
  }
  sendError(res, 501, "UNIMPLEMENTED", "method not supported");
}

function runServer(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    handle(req, res).catch((e: Error) => sendError(res, 500, "INTERNAL", e.message));
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(PORT, "localhost", () => resolve(server));
  });
}

function httpJson(method: string, url: string, body: Json | null = null): Promise<Obj> {
  const data = body !== null ? Buffer.from(JSON.stringify(body), "utf-8") : null;
  const headers: http.OutgoingHttpHeaders = { "Content-Type": A2A_MEDIA_TYPE, "A2A-Version": A2A_VERSION };
  if (data) headers["Content-Length"] = String(data.length);
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (resp) => {
      const chunks: Buffer[] = [];
      resp.on("data", (c: Buffer) => chunks.push(c));
      resp.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf-8");
        const status = resp.statusCode ?? 0;
        if (status >= 400) {
          reject(new Error(`HTTP Error ${status}: ${text}`));
          return;
        }
        resolve(JSON.parse(text) as Obj);
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runClient(): Promise<void> {
  console.log("\n[1] discovery: GET /.well-known/agent-card.json");
  const card = await httpJson("GET", `${BASE_URL}/.well-known/agent-card.json`);
  const iface = (card["supportedInterfaces"] as Obj[])[0];
  const skillIds = (card["skills"] as Obj[]).map((s) => s["id"] as string);
  console.log(`    name=${card["name"]}, skills=${pyRepr(skillIds)}`);
  console.log(`    interface=${iface["protocolBinding"]} ${iface["protocolVersion"]} at ${iface["url"]}`);

  console.log("\n[2] send message: POST /message:send (returnImmediately)");
  const request: Obj = {
    message: {
      messageId: randomUUID(),
      role: "ROLE_USER",
      parts: [{ data: { code: "x = 1\nprint(x)\n" }, mediaType: "application/json" }],
    },
    configuration: { returnImmediately: true },
  };
  let task = (await httpJson("POST", `${iface["url"]}/message:send`, request))["task"] as Obj;
  const tid = task["id"] as string;
  console.log(`    task id=${tid}, state=${(task["status"] as Obj)["state"]}`);

  console.log("\n[3] poll GET /tasks/{id} until a terminal state");
  for (let i = 0; i < 10; i++) {
    task = await httpJson("GET", `${iface["url"]}/tasks/${tid}`);
    const state = (task["status"] as Obj)["state"] as string;
    console.log(`    attempt ${i + 1}: state=${state}`);
    if (TERMINAL_STATES.includes(state)) {
      console.log(`    artifacts: ${pyRepr(task["artifacts"])}`);
      break;
    }
    await sleep(100);
  }
}

async function main(): Promise<void> {
  console.log("A2A minimal protocol demo");
  console.log("-".repeat(30));
  const server = await runServer();
  await sleep(100);
  try {
    await runClient();
  } finally {
    server.closeAllConnections();
    server.close();
  }
  console.log("\nKey insight: discovery + task lifecycle + typed artifact + auth is the A2A surface.");
  console.log("MCP is agent <-> tool (vertical); A2A is agent <-> agent (horizontal). Production uses both.");
}

main();
