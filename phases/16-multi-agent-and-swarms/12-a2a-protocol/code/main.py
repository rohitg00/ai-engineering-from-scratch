"""http.server を使った A2A-minimal server/client。

discovery-submit-poll-result flow を実装する:
  - GET /.well-known/agent.json  -> Agent Card
  - POST /tasks                  -> task を作成
  - GET /tasks/{id}              -> state + artifact

server は background thread で動き、client が通信して trace を表示する。
"""
from __future__ import annotations

import json
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any
from uuid import uuid4


AGENT_CARD = {
    "name": "code-review-agent",
    "version": "0.1.0",
    "skills": ["review-python"],
    "endpoints": {
        "tasks": "http://localhost:8765/tasks",
    },
    "auth": {"type": "none"},
    "modalities": ["text", "structured"],
    "protocol_version": "a2a-0.3",
}


class TaskStore:
    def __init__(self) -> None:
        self.tasks: dict[str, dict[str, Any]] = {}
        self._lock = threading.Lock()

    def create(self, skill: str, payload: dict) -> str:
        tid = str(uuid4())[:8]
        with self._lock:
            self.tasks[tid] = {
                "id": tid,
                "skill": skill,
                "payload": payload,
                "state": "submitted",
                "artifact": None,
                "created_at": time.time(),
            }
        threading.Thread(target=self._run, args=(tid,), daemon=True).start()
        return tid

    def _run(self, tid: str) -> None:
        with self._lock:
            self.tasks[tid]["state"] = "working"
        time.sleep(0.2)
        with self._lock:
            t = self.tasks[tid]
            if t["skill"] == "review-python":
                code = t["payload"].get("code", "")
                issues = []
                if "return" not in code:
                    issues.append("no return statement")
                if "def " not in code:
                    issues.append("no function definition")
                t["artifact"] = {
                    "type": "structured",
                    "data": {"issues": issues, "lines": code.count("\n") + 1},
                }
                t["state"] = "completed"
            else:
                t["state"] = "failed"
                t["artifact"] = {"type": "text", "data": f"unknown skill '{t['skill']}'"}

    def get(self, tid: str) -> dict | None:
        with self._lock:
            return self.tasks.get(tid)


STORE = TaskStore()


class A2AHandler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        return

    def _send_json(self, status: int, body: Any) -> None:
        data = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:
        if self.path == "/.well-known/agent.json":
            self._send_json(200, AGENT_CARD)
            return
        if self.path.startswith("/tasks/"):
            tid = self.path.split("/tasks/", 1)[1]
            task = STORE.get(tid)
            if task is None:
                self._send_json(404, {"error": "not found"})
                return
            self._send_json(200, task)
            return
        self._send_json(404, {"error": "route not found"})

    def do_POST(self) -> None:
        if self.path == "/tasks":
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length).decode("utf-8"))
            tid = STORE.create(body.get("skill", ""), body.get("payload", {}))
            self._send_json(201, {"task_id": tid, "state": "submitted"})
            return
        self._send_json(404, {"error": "route not found"})


def run_server() -> HTTPServer:
    server = HTTPServer(("localhost", 8765), A2AHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def http_json(method: str, url: str, body: Any = None) -> dict:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def run_client() -> None:
    print("\n[1] discovery: GET /.well-known/agent.json")
    card = http_json("GET", "http://localhost:8765/.well-known/agent.json")
    print(f"    name={card['name']}, skills={card['skills']}")

    print("\n[2] task submit: POST /tasks")
    submission = {"skill": "review-python", "payload": {"code": "x = 1\nprint(x)\n"}}
    resp = http_json("POST", card["endpoints"]["tasks"], submission)
    tid = resp["task_id"]
    print(f"    task_id={tid}, state={resp['state']}")

    print("\n[3] completed まで poll")
    for i in range(10):
        task = http_json("GET", f"http://localhost:8765/tasks/{tid}")
        print(f"    attempt {i + 1}: state={task['state']}")
        if task["state"] in ("completed", "failed"):
            print(f"    artifact: {task['artifact']}")
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
    print("\nKey insight: discovery + task lifecycle + typed artifact + auth が A2A surface。")
    print("MCP は agent <-> tool (vertical)。A2A は agent <-> agent (horizontal)。production では両方を使う。")


if __name__ == "__main__":
    main()
