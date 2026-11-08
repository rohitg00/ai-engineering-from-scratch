"""Phase 13 Lesson 19 - A2A agent-to-agent protocol.

Research agent calls writer agent via A2A 1.0:
  1. Research agent fetches writer's Agent Card
  2. Sends SendMessage with text + file parts
  3. Writer task moves TASK_STATE_WORKING -> TASK_STATE_INPUT_REQUIRED
     -> TASK_STATE_WORKING -> TASK_STATE_COMPLETED
  4. Research agent receives an Artifact

Stdlib only; in-process transport stands in for JSON-RPC over HTTP.
Wire names follow A2A 1.0.1: docs/specification.md and specification/a2a.proto.

Run: python code/main.py
"""

from __future__ import annotations

import base64
import json
import uuid


A2A_VERSION = "1.0"

WRITER_AGENT_CARD = {
    "name": "writer-agent",
    "description": "Drafts technical summaries and reports from source material.",
    "version": "1.0.0",
    "supportedInterfaces": [
        {
            "url": "https://writer.example.com/a2a",
            "protocolBinding": "JSONRPC",
            "protocolVersion": A2A_VERSION,
        }
    ],
    "capabilities": {"streaming": True, "pushNotifications": False},
    "defaultInputModes": ["text/plain"],
    "defaultOutputModes": ["text/markdown"],
    "skills": [
        {
            "id": "draft_report",
            "name": "Draft report",
            "description": "Given source material and a target length, produce a report.",
            "tags": ["writing", "summarization"],
            "inputModes": ["text/plain", "application/pdf", "application/json"],
            "outputModes": ["text/markdown"],
        }
    ],
}

PART_CONTENT_FIELDS = ("text", "raw", "url", "data")


def part_content(part: dict) -> str:
    present = [name for name in PART_CONTENT_FIELDS if name in part]
    if len(present) != 1:
        raise ValueError(f"a Part holds exactly one of text, raw, url, data; got {present}")
    return present[0]


def new_message(role: str, parts: list[dict], task_id: str | None = None) -> dict:
    message = {"messageId": str(uuid.uuid4()), "role": role, "parts": parts}
    if task_id:
        message["taskId"] = task_id
    return message


TASK_STORE: dict[str, dict] = {}


def transition(task: dict, state: str, message: dict | None = None) -> None:
    print(f"    WRITER  : {task['status']['state']} -> {state}")
    task["status"] = {"state": state}
    if message:
        task["status"]["message"] = message
        task["history"].append(message)


def writer_send_message(params: dict) -> dict:
    message = params["message"]
    task_id = message.get("taskId")
    if task_id:
        task = TASK_STORE[task_id]
    else:
        task = {
            "id": f"task_{uuid.uuid4().hex[:10]}",
            "contextId": str(uuid.uuid4()),
            "status": {"state": "TASK_STATE_SUBMITTED"},
            "artifacts": [],
            "history": [],
        }
        TASK_STORE[task["id"]] = task
        print(f"    WRITER  : created task {task['id']}")
    task["history"].append(message)
    transition(task, "TASK_STATE_WORKING")
    data_payloads = [p["data"] for p in message["parts"] if part_content(p) == "data"]
    if not data_payloads or "targetLength" not in data_payloads[0]:
        transition(task, "TASK_STATE_INPUT_REQUIRED", new_message("ROLE_AGENT", [
            {"text": "Please specify targetLength as a data part."}
        ], task["id"]))
    else:
        finish(task, data_payloads[0]["targetLength"])
    return {"task": task}


def finish(task: dict, length: str) -> None:
    text = f"[writer agent] {length} summary of provided source: "\
           f"topic identified, key points extracted, conclusion drafted."
    task["artifacts"].append({
        "artifactId": str(uuid.uuid4()),
        "name": "summary",
        "parts": [{"text": text, "mediaType": "text/markdown"}],
    })
    transition(task, "TASK_STATE_COMPLETED")


def writer_endpoint(headers: dict, request: dict) -> dict:
    response = {"jsonrpc": "2.0", "id": request["id"]}
    if headers.get("A2A-Version") != A2A_VERSION:
        response["error"] = {"code": -32009, "message": "Version not supported"}
    elif request["method"] != "SendMessage":
        response["error"] = {"code": -32601, "message": "Method not found"}
    else:
        response["result"] = writer_send_message(request["params"])
    return response


def send_message(request_id: int, message: dict) -> dict:
    request = {"jsonrpc": "2.0", "id": request_id, "method": "SendMessage",
               "params": {"message": message}}
    print(f"  research : {request['method']} (A2A-Version: {A2A_VERSION})")
    response = writer_endpoint({"A2A-Version": A2A_VERSION}, request)
    return response["result"]["task"]


def research_agent_flow() -> None:
    print("=" * 72)
    print("PHASE 13 LESSON 18 - A2A CALL FROM RESEARCH TO WRITER")
    print("=" * 72)

    print("\n--- research agent fetches writer Agent Card ---")
    print(json.dumps({k: WRITER_AGENT_CARD[k] for k in ("name", "supportedInterfaces", "skills")},
                     indent=2))

    skill = WRITER_AGENT_CARD["skills"][0]
    skill_id = skill["id"]
    print(f"\n  research agent will invoke skill: {skill_id}")

    msg = new_message("ROLE_USER", [
        {"text": "Summarize the attached paper."},
        {"raw": base64.b64encode(b"fake-pdf").decode(), "filename": "paper.pdf",
         "mediaType": "application/pdf"},
    ])
    task = send_message(1, msg)
    print(f"  research : task state = {task['status']['state']}")

    if task["status"]["state"] == "TASK_STATE_INPUT_REQUIRED":
        print("\n--- research agent supplies the missing data ---")
        followup = new_message("ROLE_USER", [
            {"data": {"targetLength": "3 paragraphs"}, "mediaType": "application/json"},
        ], task["id"])
        task = send_message(2, followup)
        print(f"  research : task state = {task['status']['state']}")

    print("\n--- research agent reads artifact ---")
    if task["artifacts"]:
        artifact = task["artifacts"][0]
        print(f"  name      : {artifact['name']}")
        print(f"  mediaType : {artifact['parts'][0]['mediaType']}")
        print(f"  content   : {artifact['parts'][0]['text']}")

    print("\n--- lifecycle observation ---")
    print(f"  final state : {task['status']['state']}")
    print(f"  history     : {len(task['history'])}")


if __name__ == "__main__":
    research_agent_flow()
