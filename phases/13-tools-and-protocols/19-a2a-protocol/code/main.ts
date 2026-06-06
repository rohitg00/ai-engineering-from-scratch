// Phase 13 Lesson 19 — A2A agent-to-agent protocol, in TypeScript.
//
// Research agent calls writer agent via A2A:
//   1. Research agent fetches writer's Agent Card
//   2. Submits a Task with text + file + data parts
//   3. Writer transitions working -> input_required -> working -> completed
//   4. Research agent receives an Artifact
//
// Stdlib only; in-process transport stands in for JSON-RPC over HTTP.
//
// Spec references:
//   A2A protocol         https://a2aproject.github.io/A2A/specification
//   Agent Card schema    https://a2aproject.github.io/A2A/specification/#agent-card
//
// Run: npx tsx code/main.ts

import { randomUUID } from "node:crypto";

type Capabilities = { streaming: boolean; pushNotifications: boolean };

type Skill = {
  id: string;
  name: string;
  description: string;
  inputModes: string[];
  outputModes: string[];
};

type AgentCard = {
  schemaVersion: string;
  name: string;
  description: string;
  url: string;
  version: string;
  skills: Skill[];
  capabilities: Capabilities;
};

const WRITER_AGENT_CARD: AgentCard = {
  schemaVersion: "1.0",
  name: "writer-agent",
  description: "Drafts technical summaries and reports from source material.",
  url: "https://writer.example.com/a2a",
  version: "1.0.0",
  skills: [
    {
      id: "draft_report",
      name: "Draft report",
      description: "Given source material and a target length, produce a report.",
      inputModes: ["text", "file", "data"],
      outputModes: ["text", "artifact"],
    },
  ],
  capabilities: { streaming: true, pushNotifications: false },
};

type TextPart = { kind: "text"; payload: { text: string } };
type FilePart = {
  kind: "file";
  payload: { file: { name: string; mimeType: string; bytes: string } };
};
type DataPart = { kind: "data"; payload: Record<string, unknown> };
type Part = TextPart | FilePart | DataPart;

type Message = { role: "user" | "agent"; parts: Part[] };

type Artifact = { name: string; mimeType: string; parts: Part[] };

type TaskState =
  | "submitted"
  | "working"
  | "input_required"
  | "completed"
  | "failed"
  | "canceled";

type Task = {
  id: string;
  state: TaskState;
  messages: Message[];
  artifact: Artifact | null;
};

const TASK_STORE = new Map<string, Task>();

function newTask(): Task {
  const id = `task_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const task: Task = { id, state: "submitted", messages: [], artifact: null };
  TASK_STORE.set(id, task);
  return task;
}

function findDataPart(message: Message): DataPart | undefined {
  return message.parts.find((p): p is DataPart => p.kind === "data");
}

function finish(task: Task, length: string): void {
  const text =
    `[writer agent] ${length} summary of provided source: ` +
    `topic identified, key points extracted, conclusion drafted.`;
  task.artifact = {
    name: "summary",
    mimeType: "text/markdown",
    parts: [{ kind: "text", payload: { text } }],
  };
  task.state = "completed";
  console.log(`    WRITER  : completed task ${task.id}`);
}

function writerTasksSend(skillId: string, message: Message): Task {
  const task = newTask();
  task.state = "working";
  task.messages.push(message);
  console.log(`    WRITER  : started task ${task.id} skill=${skillId}`);

  const data = findDataPart(message);
  if (!data || !("targetLength" in data.payload)) {
    task.state = "input_required";
    task.messages.push({
      role: "agent",
      parts: [
        {
          kind: "text",
          payload: { text: "Please specify targetLength as a data part." },
        },
      ],
    });
    console.log(`    WRITER  : paused input_required`);
  } else {
    finish(task, String(data.payload.targetLength));
  }
  return task;
}

function writerTasksReply(taskId: string, message: Message): Task {
  const task = TASK_STORE.get(taskId);
  if (!task) throw new Error(`unknown task ${taskId}`);
  task.messages.push(message);
  const data = findDataPart(message);
  if (task.state === "input_required" && data) {
    task.state = "working";
    finish(task, String(data.payload.targetLength ?? "short"));
  }
  return task;
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
        url: WRITER_AGENT_CARD.url,
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
  const initialMessage: Message = {
    role: "user",
    parts: [
      { kind: "text", payload: { text: "Summarize the attached paper." } },
      {
        kind: "file",
        payload: {
          file: { name: "paper.pdf", mimeType: "application/pdf", bytes: fakePdfBytes },
        },
      },
    ],
  };
  let task = writerTasksSend(skillId, initialMessage);
  console.log(`  research : task state = ${task.state}`);

  if (task.state === "input_required") {
    console.log("\n--- research agent supplies the missing data ---");
    const followup: Message = {
      role: "user",
      parts: [{ kind: "data", payload: { targetLength: "3 paragraphs" } }],
    };
    task = writerTasksReply(task.id, followup);
    console.log(`  research : task state = ${task.state}`);
  }

  console.log("\n--- research agent reads artifact ---");
  if (task.artifact) {
    const firstPart = task.artifact.parts[0];
    console.log(`  name     : ${task.artifact.name}`);
    console.log(`  mimeType : ${task.artifact.mimeType}`);
    if (firstPart.kind === "text") {
      console.log(`  content  : ${firstPart.payload.text}`);
    }
  }

  console.log("\n--- lifecycle observation ---");
  console.log(`  final state : ${task.state}`);
  console.log(`  messages    : ${task.messages.length}`);
}

researchAgentFlow();
