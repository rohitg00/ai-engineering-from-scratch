// Phase 13 Lesson 19 — A2A agent-to-agent protocol, in TypeScript.
//
// Research agent calls writer agent via A2A 1.0:
//   1. Research agent fetches writer's Agent Card
//   2. Sends SendMessage with text + file parts
//   3. Writer task moves TASK_STATE_WORKING -> TASK_STATE_INPUT_REQUIRED
//      -> TASK_STATE_WORKING -> TASK_STATE_COMPLETED
//   4. Research agent receives an Artifact
//
// Stdlib only; in-process transport stands in for JSON-RPC over HTTP.
//
// Spec references:
//   A2A protocol         https://a2a-protocol.org/latest/specification/
//   Agent Card schema    https://a2a-protocol.org/latest/specification/#8-agent-discovery-the-agent-card
//
// Run: npx tsx code/main.ts

import { randomUUID } from "node:crypto";

const A2A_VERSION = "1.0";

type AgentInterface = { url: string; protocolBinding: string; protocolVersion: string };

type Capabilities = { streaming: boolean; pushNotifications: boolean };

type Skill = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  inputModes: string[];
  outputModes: string[];
};

type AgentCard = {
  name: string;
  description: string;
  version: string;
  supportedInterfaces: AgentInterface[];
  capabilities: Capabilities;
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: Skill[];
};

const WRITER_AGENT_CARD: AgentCard = {
  name: "writer-agent",
  description: "Drafts technical summaries and reports from source material.",
  version: "1.0.0",
  supportedInterfaces: [
    {
      url: "https://writer.example.com/a2a",
      protocolBinding: "JSONRPC",
      protocolVersion: A2A_VERSION,
    },
  ],
  capabilities: { streaming: true, pushNotifications: false },
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/markdown"],
  skills: [
    {
      id: "draft_report",
      name: "Draft report",
      description: "Given source material and a target length, produce a report.",
      tags: ["writing", "summarization"],
      inputModes: ["text/plain", "application/pdf", "application/json"],
      outputModes: ["text/markdown"],
    },
  ],
};

type PartMeta = { filename?: string; mediaType?: string };
type TextPart = PartMeta & { text: string };
type RawPart = PartMeta & { raw: string };
type UrlPart = PartMeta & { url: string };
type DataPart = PartMeta & { data: Record<string, unknown> };
type Part = TextPart | RawPart | UrlPart | DataPart;

const PART_CONTENT_FIELDS = ["text", "raw", "url", "data"] as const;

function partContent(part: Part): (typeof PART_CONTENT_FIELDS)[number] {
  const present = PART_CONTENT_FIELDS.filter((name) => name in part);
  if (present.length !== 1) {
    throw new Error(`a Part holds exactly one of text, raw, url, data; got ${present}`);
  }
  return present[0];
}

type Role = "ROLE_USER" | "ROLE_AGENT";

type Message = { messageId: string; role: Role; parts: Part[]; taskId?: string };

type Artifact = { artifactId: string; name: string; parts: Part[] };

type TaskState =
  | "TASK_STATE_SUBMITTED"
  | "TASK_STATE_WORKING"
  | "TASK_STATE_INPUT_REQUIRED"
  | "TASK_STATE_COMPLETED"
  | "TASK_STATE_FAILED"
  | "TASK_STATE_CANCELED";

type Task = {
  id: string;
  contextId: string;
  status: { state: TaskState; message?: Message };
  artifacts: Artifact[];
  history: Message[];
};

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params: { message: Message };
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: number;
  result?: { task: Task };
  error?: { code: number; message: string };
};

const TASK_STORE = new Map<string, Task>();

function newMessage(role: Role, parts: Part[], taskId?: string): Message {
  const message: Message = { messageId: randomUUID(), role, parts };
  if (taskId) message.taskId = taskId;
  return message;
}

function transition(task: Task, state: TaskState, message?: Message): void {
  console.log(`    WRITER  : ${task.status.state} -> ${state}`);
  task.status = { state };
  if (message) {
    task.status.message = message;
    task.history.push(message);
  }
}

function finish(task: Task, length: string): void {
  const text =
    `[writer agent] ${length} summary of provided source: ` +
    `topic identified, key points extracted, conclusion drafted.`;
  task.artifacts.push({
    artifactId: randomUUID(),
    name: "summary",
    parts: [{ text, mediaType: "text/markdown" }],
  });
  transition(task, "TASK_STATE_COMPLETED");
}

function writerSendMessage(params: { message: Message }): { task: Task } {
  const { message } = params;
  let task: Task;
  if (message.taskId) {
    const existing = TASK_STORE.get(message.taskId);
    if (!existing) throw new Error(`unknown task ${message.taskId}`);
    task = existing;
  } else {
    const id = `task_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
    task = {
      id,
      contextId: randomUUID(),
      status: { state: "TASK_STATE_SUBMITTED" },
      artifacts: [],
      history: [],
    };
    TASK_STORE.set(id, task);
    console.log(`    WRITER  : created task ${id}`);
  }
  task.history.push(message);
  transition(task, "TASK_STATE_WORKING");

  const data = message.parts.find((p): p is DataPart => partContent(p) === "data");
  if (!data || !("targetLength" in data.data)) {
    transition(
      task,
      "TASK_STATE_INPUT_REQUIRED",
      newMessage("ROLE_AGENT", [{ text: "Please specify targetLength as a data part." }], task.id),
    );
  } else {
    finish(task, String(data.data.targetLength));
  }
  return { task };
}

function writerEndpoint(headers: Record<string, string>, request: JsonRpcRequest): JsonRpcResponse {
  const response: JsonRpcResponse = { jsonrpc: "2.0", id: request.id };
  if (headers["A2A-Version"] !== A2A_VERSION) {
    response.error = { code: -32009, message: "Version not supported" };
  } else if (request.method !== "SendMessage") {
    response.error = { code: -32601, message: "Method not found" };
  } else {
    response.result = writerSendMessage(request.params);
  }
  return response;
}

function sendMessage(requestId: number, message: Message): Task {
  const request: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: requestId,
    method: "SendMessage",
    params: { message },
  };
  console.log(`  research : ${request.method} (A2A-Version: ${A2A_VERSION})`);
  const response = writerEndpoint({ "A2A-Version": A2A_VERSION }, request);
  if (!response.result) throw new Error(`A2A error ${response.error?.code}`);
  return response.result.task;
}

function researchAgentFlow(): void {
  console.log("=".repeat(72));
  console.log("PHASE 13 LESSON 19 - A2A CALL FROM RESEARCH TO WRITER (TypeScript port)");
  console.log("=".repeat(72));

  console.log("\n--- research agent fetches writer Agent Card ---");
  console.log(
    JSON.stringify(
      {
        name: WRITER_AGENT_CARD.name,
        supportedInterfaces: WRITER_AGENT_CARD.supportedInterfaces,
        skills: WRITER_AGENT_CARD.skills,
      },
      null,
      2,
    ),
  );

  const skill = WRITER_AGENT_CARD.skills[0];
  const skillId = skill.id;
  console.log(`\n  research agent will invoke skill: ${skillId}`);

  const fakePdfBytes = Buffer.from("fake-pdf").toString("base64");
  const initialMessage = newMessage("ROLE_USER", [
    { text: "Summarize the attached paper." },
    { raw: fakePdfBytes, filename: "paper.pdf", mediaType: "application/pdf" },
  ]);
  let task = sendMessage(1, initialMessage);
  console.log(`  research : task state = ${task.status.state}`);

  if (task.status.state === "TASK_STATE_INPUT_REQUIRED") {
    console.log("\n--- research agent supplies the missing data ---");
    const followup = newMessage(
      "ROLE_USER",
      [{ data: { targetLength: "3 paragraphs" }, mediaType: "application/json" }],
      task.id,
    );
    task = sendMessage(2, followup);
    console.log(`  research : task state = ${task.status.state}`);
  }

  console.log("\n--- research agent reads artifact ---");
  const artifact = task.artifacts[0];
  if (artifact) {
    const firstPart = artifact.parts[0];
    console.log(`  name      : ${artifact.name}`);
    console.log(`  mediaType : ${firstPart.mediaType}`);
    if ("text" in firstPart) {
      console.log(`  content   : ${firstPart.text}`);
    }
  }

  console.log("\n--- lifecycle observation ---");
  console.log(`  final state : ${task.status.state}`);
  console.log(`  history     : ${task.history.length}`);
}

researchAgentFlow();
