"""Companion code for:
certifications/claude/lessons/11-mcp-server-design-and-integration/docs/en.md
It models the MCP 2025-06-18 compatibility profile and migration decisions.
Protocol shapes follow the official MCP specification concepts.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Callable


LEGACY_PROTOCOL_VERSION = "2025-06-18"
CURRENT_PROTOCOL_VERSION = "2026-07-28"


@dataclass(frozen=True)
class Capability:
    name: str
    description: str
    input_schema: dict[str, Any]
    handler: Callable[[dict[str, Any]], Any]

    def validate_arguments(self, arguments: Any) -> dict[str, Any]:
        if not isinstance(arguments, dict):
            raise ValueError("arguments must be an object")
        properties = self.input_schema.get("properties", {})
        required = self.input_schema.get("required", [])
        if not isinstance(properties, dict) or not isinstance(required, list):
            raise ValueError("advertised input schema is invalid")
        missing = [name for name in required if name not in arguments]
        if missing:
            raise ValueError(f"missing {', '.join(missing)}")
        unexpected = set(arguments) - set(properties)
        if unexpected and self.input_schema.get("additionalProperties") is False:
            raise ValueError(f"unexpected fields: {', '.join(sorted(unexpected))}")

        type_checks: dict[str, Callable[[Any], bool]] = {
            "boolean": lambda value: isinstance(value, bool),
            "integer": lambda value: isinstance(value, int) and not isinstance(value, bool),
            "number": lambda value: isinstance(value, (int, float)) and not isinstance(value, bool),
            "string": lambda value: isinstance(value, str),
            "array": lambda value: isinstance(value, list),
            "object": lambda value: isinstance(value, dict),
            "null": lambda value: value is None,
        }
        for name, value in arguments.items():
            if name not in properties:
                continue
            advertised_type = properties[name].get("type") if isinstance(properties[name], dict) else None
            if advertised_type not in type_checks:
                raise ValueError(f"advertised type for {name} is invalid")
            if not type_checks[advertised_type](value):
                raise ValueError(f"{name} must be {advertised_type}")
        return arguments


class MCPServer:
    def __init__(self) -> None:
        self.initialize_requested = False
        self.initialized = False
        self.client_capabilities: dict[str, Any] = {}
        self.pending_notifications: list[dict[str, Any]] = []
        self.next_server_request_id = 1000
        self.tools = {
            "add": Capability(
                "add",
                "Add two integers. Use only for arithmetic addition.",
                {
                    "type": "object",
                    "required": ["a", "b"],
                    "additionalProperties": False,
                    "properties": {"a": {"type": "integer"}, "b": {"type": "integer"}},
                },
                lambda args: args["a"] + args["b"],
            )
        }
        self.resources = {"config://service": '{"region":"local","mode":"training"}'}
        self.prompts = {"review": "Review the supplied change for correctness, evidence, and rollback risk."}

    def handle(self, request: dict[str, Any]) -> dict[str, Any] | None:
        if not isinstance(request, dict):
            return self._error(None, -32600, "Invalid Request")
        if request.get("jsonrpc") != "2.0" or not isinstance(request.get("method"), str):
            return self._error(request.get("id"), -32600, "Invalid Request")
        request_id = request.get("id")
        method = request["method"]
        params = request.get("params", {})
        if method.startswith("notifications/"):
            if method == "notifications/initialized" and self.initialize_requested:
                self.initialized = True
            return None
        if method != "initialize" and not self.initialized:
            return self._error(request_id, -32002, "Server not initialized")
        try:
            result = self._dispatch(method, params)
            return {"jsonrpc": "2.0", "id": request_id, "result": result}
        except KeyError as exc:
            return self._error(request_id, -32602, f"Invalid params: missing {exc.args[0]}")
        except ValueError as exc:
            return self._error(request_id, -32602, f"Invalid params: {exc}")
        except TypeError:
            return self._error(request_id, -32602, "Invalid params: incompatible value type")
        except LookupError as exc:
            return self._error(request_id, -32601, str(exc))
        except Exception:
            return self._error(request_id, -32603, "Internal error")

    def _dispatch(self, method: str, params: dict[str, Any]) -> Any:
        if not isinstance(params, dict):
            raise ValueError("params must be an object")
        if method == "initialize":
            if self.initialize_requested:
                raise ValueError("initialize may only be requested once")
            self.initialize_requested = True
            capabilities = params.get("capabilities", {})
            if not isinstance(capabilities, dict):
                raise ValueError("client capabilities must be an object")
            self.client_capabilities = capabilities
            return {
                "protocolVersion": LEGACY_PROTOCOL_VERSION,
                "serverInfo": {"name": "study-server", "version": "1.0.0"},
                "capabilities": {"tools": {}, "resources": {}, "prompts": {}, "logging": {}},
            }
        if method == "tools/list":
            return {"tools": [{"name": tool.name, "description": tool.description, "inputSchema": tool.input_schema} for tool in self.tools.values()]}
        if method == "tools/call":
            name = params["name"]
            if not isinstance(name, str) or not name:
                raise ValueError("name must be a non-empty string")
            tool = self.tools.get(name)
            if tool is None:
                raise ValueError("unknown tool")
            arguments = tool.validate_arguments(params.get("arguments", {}))
            metadata = params.get("_meta", {})
            if not isinstance(metadata, dict):
                raise ValueError("_meta must be an object")
            progress_token = metadata.get("progressToken")
            if progress_token is not None:
                self._queue_progress(progress_token, 0, 1, "starting")
            value = tool.handler(arguments)
            if progress_token is not None:
                self._queue_progress(progress_token, 1, 1, "complete")
            self.pending_notifications.append(
                {
                    "jsonrpc": "2.0",
                    "method": "notifications/message",
                    "params": {"level": "info", "logger": "study-server", "data": "tool completed"},
                }
            )
            return {"content": [{"type": "text", "text": json.dumps(value)}], "isError": False}
        if method == "resources/list":
            return {"resources": [{"uri": uri, "name": uri.removeprefix("config://")} for uri in self.resources]}
        if method == "resources/read":
            uri = params["uri"]
            if not isinstance(uri, str):
                raise ValueError("uri must be a string")
            if uri not in self.resources:
                raise ValueError("unknown resource")
            return {"contents": [{"uri": uri, "mimeType": "application/json", "text": self.resources[uri]}]}
        if method == "prompts/list":
            return {"prompts": [{"name": name, "description": text} for name, text in self.prompts.items()]}
        if method == "prompts/get":
            name = params["name"]
            if not isinstance(name, str):
                raise ValueError("name must be a string")
            if name not in self.prompts:
                raise ValueError("unknown prompt")
            return {"messages": [{"role": "user", "content": {"type": "text", "text": self.prompts[name]}}]}
        raise LookupError(f"Method not found: {method}")

    def request_client(self, client: "MCPClient", method: str, params: dict[str, Any]) -> dict[str, Any]:
        """Model a server-to-client callback in the legacy compatibility profile."""
        required_capability = {"sampling/createMessage": "sampling", "roots/list": "roots"}.get(method)
        if required_capability is None:
            raise ValueError("unsupported client callback")
        if required_capability not in self.client_capabilities:
            raise ValueError(f"client did not negotiate {required_capability}")
        request_id = self.next_server_request_id
        self.next_server_request_id += 1
        response = client.handle_server_request(
            {"jsonrpc": "2.0", "id": request_id, "method": method, "params": params}
        )
        if response.get("id") != request_id:
            raise RuntimeError("invalid callback response correlation")
        return response

    def drain_notifications(self) -> list[dict[str, Any]]:
        notifications = self.pending_notifications[:]
        self.pending_notifications.clear()
        return notifications

    def _queue_progress(self, token: Any, progress: float, total: float, message: str) -> None:
        if not isinstance(token, (str, int)) or isinstance(token, bool):
            raise ValueError("progressToken must be a string or integer")
        self.pending_notifications.append(
            {
                "jsonrpc": "2.0",
                "method": "notifications/progress",
                "params": {
                    "progressToken": token,
                    "progress": progress,
                    "total": total,
                    "message": message,
                },
            }
        )

    @staticmethod
    def _error(request_id: Any, code: int, message: str) -> dict[str, Any]:
        return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


class MCPClient:
    def __init__(self, server: MCPServer, *, advertise_callbacks: bool = True) -> None:
        self.server = server
        self.next_id = 1
        self.notifications: list[dict[str, Any]] = []
        self.roots = [{"uri": "file:///workspace", "name": "Workspace"}]
        self.capabilities: dict[str, Any] = (
            {"sampling": {}, "roots": {"listChanged": True}} if advertise_callbacks else {}
        )

    def request(self, method: str, params: dict[str, Any] | None = None) -> Any:
        request_id = self.next_id
        self.next_id += 1
        response = self.server.handle({"jsonrpc": "2.0", "id": request_id, "method": method, "params": params or {}})
        for notification in self.server.drain_notifications():
            self.receive_notification(notification)
        if response is None or response.get("id") != request_id:
            raise RuntimeError("invalid response correlation")
        if "error" in response:
            raise RuntimeError(response["error"]["message"])
        return response["result"]

    def initialize(self) -> dict[str, Any]:
        result = self.request(
            "initialize",
            {
                "protocolVersion": LEGACY_PROTOCOL_VERSION,
                "capabilities": self.capabilities,
                "clientInfo": {"name": "study-client", "version": "1.0.0"},
            },
        )
        self.server.handle({"jsonrpc": "2.0", "method": "notifications/initialized"})
        return result

    def receive_notification(self, notification: dict[str, Any]) -> None:
        if notification.get("jsonrpc") != "2.0" or "id" in notification:
            raise ValueError("notifications must be uncorrelated JSON-RPC messages")
        if notification.get("method") not in {"notifications/progress", "notifications/message"}:
            raise ValueError("unsupported notification")
        self.notifications.append(notification)

    def handle_server_request(self, request: dict[str, Any]) -> dict[str, Any]:
        request_id = request.get("id")
        method = request.get("method")
        params = request.get("params", {})
        if method == "roots/list":
            result: dict[str, Any] = {"roots": self.roots}
        elif method == "sampling/createMessage":
            messages = params.get("messages", [])
            if not isinstance(messages, list) or not messages:
                return MCPServer._error(request_id, -32602, "Invalid params: messages required")
            result = {
                "role": "assistant",
                "content": {"type": "text", "text": "approved training sample"},
                "model": "study-model",
                "stopReason": "endTurn",
            }
        else:
            return MCPServer._error(request_id, -32601, f"Method not found: {method}")
        return {"jsonrpc": "2.0", "id": request_id, "result": result}


def deployment_plan(protocol_version: str, *, application_state: bool) -> dict[str, Any]:
    """Describe the routing cost of legacy sessions versus the stateless core."""
    if protocol_version == LEGACY_PROTOCOL_VERSION:
        return {
            "protocolVersion": protocol_version,
            "protocolSession": True,
            "routing": "sticky-or-shared-session-store",
            "applicationState": "session-bound" if application_state else "none",
        }
    if protocol_version == CURRENT_PROTOCOL_VERSION:
        return {
            "protocolVersion": protocol_version,
            "protocolSession": False,
            "routing": "round-robin",
            "applicationState": "explicit-handle-or-shared-store" if application_state else "none",
        }
    raise ValueError("unsupported protocol version")


def demo() -> dict[str, Any]:
    server = MCPServer()
    client = MCPClient(server)
    initialized = client.initialize()
    tools = client.request("tools/list")
    answer = client.request(
        "tools/call",
        {
            "name": "add",
            "arguments": {"a": 20, "b": 22},
            "_meta": {"progressToken": "addition-1"},
        },
    )
    roots = server.request_client(client, "roots/list", {})["result"]
    sample = server.request_client(
        client,
        "sampling/createMessage",
        {"messages": [{"role": "user", "content": {"type": "text", "text": "Confirm 42"}}]},
    )["result"]
    return {
        "initialize": initialized,
        "tools": tools,
        "answer": answer,
        "legacyCallbacks": {"roots": roots, "sampling": sample},
        "notifications": client.notifications,
        "deployment": {
            "legacyStateful": deployment_plan(LEGACY_PROTOCOL_VERSION, application_state=True),
            "currentStateless": deployment_plan(CURRENT_PROTOCOL_VERSION, application_state=True),
        },
    }


if __name__ == "__main__":
    print(json.dumps(demo(), indent=2))
