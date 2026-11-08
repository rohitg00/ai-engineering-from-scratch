"""A2A-minimal server and client using http.server, on the A2A 1.0 HTTP+JSON binding.

Implements the discovery-submit-poll-result flow:
  - GET /.well-known/agent-card.json  -> Agent Card
  - POST /message:send                -> SendMessage, returns the new task
  - GET /tasks/{id}                   -> GetTask, status + artifacts

Server runs in a background thread; client talks to it and prints the trace.
"""
from __future__ import annotations

import json
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any
from uuid import uuid4


A2A_VERSION = "1.0"
A2A_MEDIA_TYPE = "application/a2a+json"
PORT = 8765
BASE_URL = f"http://localhost:{PORT}"
TERMINAL_STATES = ("TASK_STATE_COMPLETED", "TASK_STATE_FAILED", "TASK_STATE_CANCELED", "TASK_STATE_REJECTED")

AGENT_CARD = {
    "name": "code-review-agent",
    "description": "Reviews Python code for missing functions and return statements.",
    "version": "0.1.0",
    "supportedInterfaces": [
        {"url": BASE_URL, "protocolBinding": "HTTP+JSON", "protocolVersion": A2A_VERSION},
    ],
    "capabilities": {"streaming": False, "pushNotifications": False},
    "securityRequirements": [],
    "defaultInputModes": ["application/json"],
    "defaultOutputModes": ["application/json"],
    "skills": [
        {
            "id": "review-python",
            "name": "Review Python",
            "description": "Flags Python code with no function definition or no return statement.",
            "tags": ["code-review", "python"],
        }
    ],
}


class TaskStore:
    def __init__(self) -> None:
        self.tasks: dict[str, dict[str, Any]] = {}
        self._lock = threading.Lock()

    def create(self, message: dict, return_immediately: bool) -> dict:
        tid = str(uuid4())[:8]
        task = {
            "id": tid,
            "contextId": str(uuid4()),
            "status": {"state": "TASK_STATE_SUBMITTED"},
            "artifacts": [],
            "history": [message],
        }
        with self._lock:
            self.tasks[tid] = task
            submitted = {"id": tid, "contextId": task["contextId"], "status": dict(task["status"])}
        worker = threading.Thread(target=self._run, args=(tid,), daemon=True)
        worker.start()
        if return_immediately:
            return submitted
        worker.join()
        return self.get(tid)

    def _run(self, tid: str) -> None:
        with self._lock:
            self.tasks[tid]["status"] = {"state": "TASK_STATE_WORKING"}
        time.sleep(0.2)
        with self._lock:
            t = self.tasks[tid]
            data = next((p["data"] for p in t["history"][0]["parts"] if "data" in p), {})
            code = data.get("code") if isinstance(data, dict) else None
            if isinstance(code, str):
                issues = []
                if "return" not in code:
                    issues.append("no return statement")
                if "def " not in code:
                    issues.append("no function definition")
                t["artifacts"] = [{
                    "artifactId": str(uuid4()),
                    "name": "review",
                    "parts": [{"data": {"issues": issues, "lines": code.count("\n") + 1},
                               "mediaType": "application/json"}],
                }]
                t["status"] = {"state": "TASK_STATE_COMPLETED"}
            else:
                t["status"] = {
                    "state": "TASK_STATE_FAILED",
                    "message": {"messageId": str(uuid4()), "role": "ROLE_AGENT",
                                "parts": [{"text": "expected a data part with a 'code' field"}]},
                }

    def get(self, tid: str) -> dict | None:
        with self._lock:
            return self.tasks.get(tid)


STORE = TaskStore()


class A2AHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        return

    def _send_json(self, status: int, body: Any, content_type: str = A2A_MEDIA_TYPE) -> None:
        data = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _send_error(self, http_status: int, rpc_status: str, message: str, reason: str = "") -> None:
        error: dict[str, Any] = {"code": http_status, "status": rpc_status, "message": message}
        if reason:
            error["details"] = [{"@type": "type.googleapis.com/google.rpc.ErrorInfo",
                                 "reason": reason, "domain": "a2a-protocol.org"}]
        self._send_json(http_status, {"error": error})

    def _version_ok(self) -> bool:
        if self.headers.get("A2A-Version") == A2A_VERSION:
            return True
        self._send_error(400, "FAILED_PRECONDITION", f"A2A-Version {A2A_VERSION} is required",
                         "VERSION_NOT_SUPPORTED")
        return False

    def do_GET(self) -> None:
        if self.path == "/.well-known/agent-card.json":
            self._send_json(200, AGENT_CARD, "application/json")
            return
        if self.path.startswith("/tasks/"):
            if not self._version_ok():
                return
            tid = self.path.split("/tasks/", 1)[1]
            task = STORE.get(tid)
            if task is None:
                self._send_error(404, "NOT_FOUND", "task not found", "TASK_NOT_FOUND")
                return
            self._send_json(200, task)
            return
        self._send_error(404, "NOT_FOUND", "route not found")

    def do_POST(self) -> None:
        if self.path == "/message:send":
            if not self._version_ok():
                return
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            return_immediately = body.get("configuration", {}).get("returnImmediately", False)
            task = STORE.create(body["message"], return_immediately)
            self._send_json(200, {"task": task})
            return
        self._send_error(404, "NOT_FOUND", "route not found")


def run_server() -> HTTPServer:
    server = HTTPServer(("localhost", PORT), A2AHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def http_json(method: str, url: str, body: Any = None) -> dict:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", A2A_MEDIA_TYPE)
    req.add_header("A2A-Version", A2A_VERSION)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def run_client() -> None:
    print("\n[1] discovery: GET /.well-known/agent-card.json")
    card = http_json("GET", f"{BASE_URL}/.well-known/agent-card.json")
    interface = card["supportedInterfaces"][0]
    print(f"    name={card['name']}, skills={[s['id'] for s in card['skills']]}")
    print(f"    interface={interface['protocolBinding']} {interface['protocolVersion']} at {interface['url']}")

    print("\n[2] send message: POST /message:send (returnImmediately)")
    request = {
        "message": {
            "messageId": str(uuid4()),
            "role": "ROLE_USER",
            "parts": [{"data": {"code": "x = 1\nprint(x)\n"}, "mediaType": "application/json"}],
        },
        "configuration": {"returnImmediately": True},
    }
    task = http_json("POST", f"{interface['url']}/message:send", request)["task"]
    tid = task["id"]
    print(f"    task id={tid}, state={task['status']['state']}")

    print("\n[3] poll GET /tasks/{id} until a terminal state")
    for i in range(10):
        task = http_json("GET", f"{interface['url']}/tasks/{tid}")
        state = task["status"]["state"]
        print(f"    attempt {i + 1}: state={state}")
        if state in TERMINAL_STATES:
            print(f"    artifacts: {task['artifacts']}")
            break
        time.sleep(0.1)


def main() -> None:
    print("A2A minimal protocol demo")
    print("-" * 30)
    server = run_server()
    time.sleep(0.1)
    try:
        run_client()
    finally:
        server.shutdown()
    print("\nKey insight: discovery + task lifecycle + typed artifact + auth is the A2A surface.")
    print("MCP is agent <-> tool (vertical); A2A is agent <-> agent (horizontal). Production uses both.")


if __name__ == "__main__":
    main()
