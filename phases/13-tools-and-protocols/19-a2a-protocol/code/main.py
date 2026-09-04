"""Phase 13 Lesson 19 - A2A agent-to-agent protocol.

Research agent calls writer agent via A2A:
  1. Research agent fetches writer's Agent Card
  2. Submits a Task with text + file + data parts
  3. Writer transitions working -> input_required -> working -> completed
  4. Research agent receives an Artifact

Stdlib only; in-process transport stands in for JSON-RPC over HTTP.

Run: python code/main.py
"""

from __future__ import annotations

import base64
import json
import uuid
from dataclasses import dataclass, field


WRITER_AGENT_CARD = {
    "schemaVersion": "1.0",
    "name": "writer-agent",
    "description": "Drafts technical summaries and reports from source material.",
    "url": "https://writer.example.com/a2a",
    "version": "1.0.0",
    "skills": [
        {
            "id": "draft_report",
            "name": "Draft report",
            "description": "Given source material and a target length, produce a report.",
            "inputModes": ["text", "file", "data"],
            "outputModes": ["text", "artifact"],
        }
    ],
    "capabilities": {"streaming": True, "pushNotifications": False},
}


@dataclass
class Part:
    kind: str
    payload: dict


@dataclass
class Message:
    role: str
    parts: list[Part] = field(default_factory=list)


@dataclass
class Artifact:
    name: str
    mimeType: str
    parts: list[Part]


@dataclass
class Task:
    id: str
    state: str = "submitted"
    messages: list[Message] = field(default_factory=list)
    artifact: Artifact | None = None

    def append(self, m: Message) -> None:
        self.messages.append(m)


TASK_STORE: dict[str, Task] = {}


def writer_tasks_send(skill_id: str, message: Message) -> Task:
    task = Task(id=f"task_{uuid.uuid4().hex[:10]}")
    TASK_STORE[task.id] = task
    task.state = "working"
    task.append(message)
    print(f"    WRITER  : started task {task.id} skill={skill_id}")
    # needs target_length
    data_parts = [p for p in message.parts if p.kind == "data"]
    if not data_parts or "targetLength" not in data_parts[0].payload:
        task.state = "input_required"
        task.append(Message(role="agent", parts=[
            Part("text", {"text": "Please specify target_length as a data part."})
        ]))
        print(f"    WRITER  : paused input_required")
    else:
        finish(task, data_parts[0].payload["targetLength"])
    return task


def writer_tasks_reply(task_id: str, message: Message) -> Task:
    task = TASK_STORE[task_id]
    task.append(message)
    data_parts = [p for p in message.parts if p.kind == "data"]
    if task.state == "input_required" and data_parts:
        task.state = "working"
        finish(task, data_parts[0].payload.get("targetLength", "short"))
    return task


def finish(task: Task, length: str) -> None:
    text = f"[writer agent] {length} summary of provided source: "\
           f"topic identified, key points extracted, conclusion drafted."
    task.artifact = Artifact(
        name="summary",
        mimeType="text/markdown",
        parts=[Part("text", {"text": text})],
    )
    task.state = "completed"
    print(f"    WRITER  : completed task {task.id}")


def research_agent_flow() -> None:
    print("=" * 72)
    print("PHASE 13 LESSON 18 - A2A CALL FROM RESEARCH TO WRITER")
    print("=" * 72)

    print("\n--- research agent fetches writer Agent Card ---")
    print(json.dumps({k: WRITER_AGENT_CARD[k] for k in ("name", "url", "skills")}, indent=2))

    skill = WRITER_AGENT_CARD["skills"][0]
    skill_id = skill["id"]
    print(f"\n  research agent will invoke skill: {skill_id}")

    msg = Message(role="user", parts=[
        Part("text", {"text": "Summarize the attached paper."}),
        Part("file", {"file": {"name": "paper.pdf", "mimeType": "application/pdf",
                                "bytes": base64.b64encode(b"fake-pdf").decode()}}),
    ])
    task = writer_tasks_send(skill_id, msg)
    print(f"  research : task state = {task.state}")

    if task.state == "input_required":
        print("\n--- research agent supplies the missing data ---")
        followup = Message(role="user", parts=[
            Part("data", {"targetLength": "3 paragraphs"}),
        ])
        task = writer_tasks_reply(task.id, followup)
        print(f"  research : task state = {task.state}")

    print("\n--- research agent reads artifact ---")
    if task.artifact:
        print(f"  name     : {task.artifact.name}")
        print(f"  mimeType : {task.artifact.mimeType}")
        print(f"  content  : {task.artifact.parts[0].payload['text']}")

    print("\n--- lifecycle observation ---")
    print(f"  final state : {task.state}")
    print(f"  messages    : {len(task.messages)}")


if __name__ == "__main__":
    research_agent_flow()
