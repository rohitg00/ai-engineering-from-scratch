"""Companion code for:
certifications/mcpa/lessons/21-long-running-work-and-tasks/docs/en.md
A build-pipeline tool that only becomes a durable task when the client declares
io.modelcontextprotocol/tasks.
Sources: SEP-2663 (tasks extension); MCP tasks extension overview.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"

TASKS_EXTENSION = "io.modelcontextprotocol/tasks"
TASKS_CAPS = {"extensions": {TASKS_EXTENSION: {}}}
TOOL_NAME = "run_build_pipeline"

METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
MISSING_REQUIRED_CLIENT_CAPABILITY = -32021
UNSUPPORTED_PROTOCOL_VERSION = -32022

EXTENSION_RESULT_TYPES = {"task"}


def make_request(request_id: int, method: str, params: dict | None = None, capabilities: dict | None = None,
                 version: str = PROTOCOL_VERSION) -> dict:
    body = dict(params or {})
    body["_meta"] = {
        PV_KEY: version,
        CAPS_KEY: capabilities or {},
        CLIENT_INFO_KEY: {"name": "lesson-client", "version": "1.0.0"},
    }
    return {"jsonrpc": "2.0", "id": request_id, "method": method, "params": body}


def make_result(request_id: Any, result_type: str = "complete", **fields: Any) -> dict:
    return {"jsonrpc": "2.0", "id": request_id, "result": {"resultType": result_type, **fields}}


def make_error(request_id: Any, code: int, message: str, data: Any = None) -> dict:
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": error}


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _client_declares_tasks(meta: dict) -> bool:
    capabilities = meta.get(CAPS_KEY) or {}
    extensions = capabilities.get("extensions") or {}
    return TASKS_EXTENSION in extensions


@dataclass
class Task:
    task_id: str
    project: str
    environment: str
    status: str = "working"
    stage: int = 0
    status_message: str = "Installing dependencies and running tests."
    created_at: str = field(default_factory=_timestamp)
    last_updated_at: str = field(default_factory=_timestamp)
    ttl_ms: int = 900000
    poll_interval_ms: int = 2000
    input_requests: dict = field(default_factory=dict)
    result: dict | None = None

    def touch(self) -> None:
        self.last_updated_at = _timestamp()

    def snapshot(self, request_id: Any) -> dict:
        fields: dict[str, Any] = {
            "taskId": self.task_id,
            "status": self.status,
            "createdAt": self.created_at,
            "lastUpdatedAt": self.last_updated_at,
            "ttlMs": self.ttl_ms,
            "pollIntervalMs": self.poll_interval_ms,
        }
        if self.status_message:
            fields["statusMessage"] = self.status_message
        if self.status == "input_required":
            fields["inputRequests"] = dict(self.input_requests)
        if self.status == "completed":
            fields["result"] = self.result
        return make_result(request_id, "complete", **fields)


@dataclass
class Server:
    name: str
    tasks: dict[str, Task] = field(default_factory=dict)
    capabilities: dict = field(
        default_factory=lambda: {"tools": {"listChanged": False}, "extensions": {TASKS_EXTENSION: {}}}
    )

    def _server_meta(self) -> dict:
        return {SERVER_INFO_KEY: {"name": self.name, "version": "1.0.0"}}

    def _supports_tasks(self) -> bool:
        return TASKS_EXTENSION in (self.capabilities.get("extensions") or {})

    def handle(self, message: dict) -> dict:
        request_id = message.get("id")
        params = message.get("params") or {}
        meta = params.get("_meta") or {}
        if not isinstance(meta.get(PV_KEY), str) or not isinstance(meta.get(CAPS_KEY), dict):
            return make_error(request_id, INVALID_PARAMS, "Missing required _meta fields")
        if meta[PV_KEY] != PROTOCOL_VERSION:
            return make_error(
                request_id,
                UNSUPPORTED_PROTOCOL_VERSION,
                "Unsupported protocol version",
                {"supported": [PROTOCOL_VERSION], "requested": meta[PV_KEY]},
            )
        method = message.get("method")
        if method == "server/discover":
            return self._discover(request_id)
        if method == "tools/list":
            return self._list_tools(request_id)
        if method == "tools/call":
            return self._call_tool(request_id, params, meta)
        if method == "tasks/get":
            return self._task_get(request_id, params, meta)
        if method == "tasks/update":
            return self._task_update(request_id, params, meta)
        if method == "tasks/cancel":
            return self._task_cancel(request_id, params, meta)
        return make_error(request_id, METHOD_NOT_FOUND, f"Method not found: {method}")

    def _discover(self, request_id: Any) -> dict:
        return make_result(
            request_id,
            "complete",
            supportedVersions=[PROTOCOL_VERSION],
            capabilities=self.capabilities,
            ttlMs=300000,
            cacheScope="public",
            _meta=self._server_meta(),
        )

    def _list_tools(self, request_id: Any) -> dict:
        tool = {
            "name": TOOL_NAME,
            "description": "Install, test, and, with an approved task, deploy a project to an environment.",
            "inputSchema": {
                "type": "object",
                "properties": {"project": {"type": "string"}, "environment": {"type": "string"}},
                "required": ["project", "environment"],
            },
        }
        return make_result(request_id, "complete", tools=[tool], ttlMs=300000, cacheScope="public", _meta=self._server_meta())

    def _pipeline_payload(self, project: str, environment: str, deployed: bool) -> dict:
        steps = ["install", "test"] + (["deploy"] if deployed else [])
        if deployed:
            text = f"Deployed {project} to {environment} after install and test."
        else:
            text = f"Installed and tested {project} for {environment}. Deploy needs the tasks extension for approval."
        return {
            "resultType": "complete",
            "content": [{"type": "text", "text": text}],
            "structuredContent": {"project": project, "environment": environment, "steps": steps, "deployed": deployed},
            "isError": False,
            "_meta": self._server_meta(),
        }

    def _call_tool(self, request_id: Any, params: dict, meta: dict) -> dict:
        if params.get("name") != TOOL_NAME:
            return make_error(request_id, INVALID_PARAMS, f"Unknown tool: {params.get('name')}")
        arguments = params.get("arguments") or {}
        missing = [key for key in ("project", "environment") if key not in arguments]
        if missing:
            return make_result(
                request_id,
                "complete",
                content=[{"type": "text", "text": f"Missing required argument: {', '.join(missing)}. Provide it and call again."}],
                isError=True,
                _meta=self._server_meta(),
            )
        project, environment = arguments["project"], arguments["environment"]
        if self._supports_tasks() and _client_declares_tasks(meta):
            task = Task(task_id=f"tsk_{uuid.uuid4().hex[:12]}", project=project, environment=environment)
            self.tasks[task.task_id] = task
            return make_result(
                request_id,
                "task",
                taskId=task.task_id,
                status=task.status,
                statusMessage=task.status_message,
                createdAt=task.created_at,
                lastUpdatedAt=task.last_updated_at,
                ttlMs=task.ttl_ms,
                pollIntervalMs=task.poll_interval_ms,
                _meta=self._server_meta(),
            )
        payload = self._pipeline_payload(project, environment, deployed=False)
        return {"jsonrpc": "2.0", "id": request_id, "result": payload}

    def _find_task(self, request_id: Any, params: dict, meta: dict) -> tuple[Task | None, dict | None]:
        if not (self._supports_tasks() and _client_declares_tasks(meta)):
            return None, make_error(
                request_id,
                MISSING_REQUIRED_CLIENT_CAPABILITY,
                "Missing required client capability",
                {"requiredCapabilities": {"extensions": {TASKS_EXTENSION: {}}}},
            )
        task = self.tasks.get(params.get("taskId"))
        if task is None:
            return None, make_error(request_id, INVALID_PARAMS, "Failed to retrieve task: Task not found")
        return task, None

    def _task_get(self, request_id: Any, params: dict, meta: dict) -> dict:
        task, error = self._find_task(request_id, params, meta)
        if error is not None:
            return error
        return task.snapshot(request_id)

    def _task_update(self, request_id: Any, params: dict, meta: dict) -> dict:
        task, error = self._find_task(request_id, params, meta)
        if error is not None:
            return error
        responses = params.get("inputResponses") or {}
        for key, response in responses.items():
            if key in task.input_requests and isinstance(response, dict) and response.get("action") == "accept":
                task.input_requests.pop(key, None)
        if task.status == "input_required" and not task.input_requests:
            task.status = "working"
            task.stage = 2
            task.status_message = f"Deploying to {task.environment}."
            task.touch()
        return make_result(request_id, "complete")

    def _task_cancel(self, request_id: Any, params: dict, meta: dict) -> dict:
        task, error = self._find_task(request_id, params, meta)
        if error is not None:
            return error
        if task.status not in ("completed", "cancelled"):
            task.status = "cancelled"
            task.status_message = "Cancelled before finishing."
            task.input_requests = {}
            task.touch()
        return make_result(request_id, "complete")

    def advance_task(self, task_id: str) -> None:
        task = self.tasks[task_id]
        if task.status == "working" and task.stage == 0:
            task.stage = 1
            task.status = "input_required"
            task.status_message = "Waiting for deploy approval."
            task.input_requests = {
                "approve_deploy": {
                    "method": "elicitation/create",
                    "params": {
                        "mode": "form",
                        "message": f"Approve deploying {task.project} to {task.environment}?",
                        "requestedSchema": {
                            "type": "object",
                            "properties": {"approved": {"type": "boolean"}},
                            "required": ["approved"],
                        },
                    },
                }
            }
            task.touch()
        elif task.status == "working" and task.stage == 2:
            task.stage = 3
            task.status = "completed"
            task.status_message = ""
            task.result = self._pipeline_payload(task.project, task.environment, deployed=True)
            task.touch()


class Client:
    def __init__(self, server: Server) -> None:
        self.server = server
        self.next_id = 0
        self.log: list[dict] = []

    def send(self, method: str, params: dict | None = None, capabilities: dict | None = None,
              version: str = PROTOCOL_VERSION) -> dict:
        self.next_id += 1
        request = make_request(self.next_id, method, params, capabilities, version)
        response = self.server.handle(request)
        self.log.extend([request, response])
        return response


def run_scenario() -> tuple[Client, dict[str, str]]:
    server = Server("pipelines")
    client = Client(server)

    client.send("server/discover")
    client.send("tools/call", {"name": TOOL_NAME, "arguments": {"project": "web-storefront", "environment": "staging"}})

    client.send("server/discover", capabilities=TASKS_CAPS)
    created = client.send(
        "tools/call",
        {"name": TOOL_NAME, "arguments": {"project": "web-storefront", "environment": "production"}},
        capabilities=TASKS_CAPS,
    )
    task_id = created["result"]["taskId"]

    client.send("tasks/get", {"taskId": task_id}, capabilities=TASKS_CAPS)
    server.advance_task(task_id)
    client.send("tasks/get", {"taskId": task_id}, capabilities=TASKS_CAPS)
    client.send(
        "tasks/update",
        {"taskId": task_id, "inputResponses": {"approve_deploy": {"action": "accept", "content": {"approved": True}}}},
        capabilities=TASKS_CAPS,
    )
    server.advance_task(task_id)
    client.send("tasks/get", {"taskId": task_id}, capabilities=TASKS_CAPS)

    cancel_created = client.send(
        "tools/call",
        {"name": TOOL_NAME, "arguments": {"project": "mobile-app", "environment": "production"}},
        capabilities=TASKS_CAPS,
    )
    cancel_id = cancel_created["result"]["taskId"]
    client.send("tasks/cancel", {"taskId": cancel_id}, capabilities=TASKS_CAPS)
    client.send("tasks/get", {"taskId": cancel_id}, capabilities=TASKS_CAPS)

    client.send("tasks/get", {"taskId": "tsk_does_not_exist"}, capabilities=TASKS_CAPS)
    client.send("tasks/get", {"taskId": task_id})
    client.send("tools/call", {"name": TOOL_NAME, "arguments": {"project": "web-storefront"}}, capabilities=TASKS_CAPS)

    return client, {"task_id": task_id, "cancel_id": cancel_id}


def transcript() -> list[dict]:
    client, _ = run_scenario()
    return client.log


def demo() -> None:
    client, info = run_scenario()
    print("build pipeline: io.modelcontextprotocol/tasks demo")
    for message in client.log:
        print("  " + json.dumps(message, sort_keys=True)[:200])
    print("\ntask id:", info["task_id"])
    print("cancelled task id:", info["cancel_id"])


if __name__ == "__main__":
    demo()
