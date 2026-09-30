"""Companion code for:
certifications/mcpa/lessons/17-tool-invocation-lifecycle/docs/en.md
A tool-call lifecycle state machine from discover through final.
Sources: MCP 2026-07-28 Tools, multi round-trip requests, and Cancellation pages.
"""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass, field
from typing import Any


PROTOCOL_VERSION = "2026-07-28"
PV_KEY = "io.modelcontextprotocol/protocolVersion"
CAPS_KEY = "io.modelcontextprotocol/clientCapabilities"
CLIENT_INFO_KEY = "io.modelcontextprotocol/clientInfo"
SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo"
PROGRESS_TOKEN_KEY = "progressToken"

INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603


def make_request(request_id: int, method: str, params: dict | None = None, capabilities: dict | None = None,
                 version: str = PROTOCOL_VERSION, progress_token: Any = None) -> dict:
    body = dict(params or {})
    meta = {
        PV_KEY: version,
        CAPS_KEY: capabilities or {},
        CLIENT_INFO_KEY: {"name": "lesson-client", "version": "1.0.0"},
    }
    if progress_token is not None:
        meta[PROGRESS_TOKEN_KEY] = progress_token
    body["_meta"] = meta
    return {"jsonrpc": "2.0", "id": request_id, "method": method, "params": body}


def make_result(request_id: Any, result_type: str = "complete", **fields: Any) -> dict:
    return {"jsonrpc": "2.0", "id": request_id, "result": {"resultType": result_type, **fields}}


def make_error(request_id: Any, code: int, message: str, data: Any = None) -> dict:
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": error}


# Local bookkeeping labels for the lifecycle state machine. These never appear
# as a wire resultType: only "complete" and "input_required" do that. A stage
# such as "cancelled" or "timeout" describes what the client decided to do,
# not something the server put on the wire.
STAGE_DISCOVER = "discover"
STAGE_LIST = "list"
STAGE_SELECT = "select"
STAGE_CONFIRM = "confirm"
STAGE_CALL = "call"
STAGE_VALIDATE = "validate"
STAGE_EXECUTE = "execute"
STAGE_PROGRESS = "progress"
STAGE_RESULT = "result"
STAGE_RETRY = "retry"
STAGE_FINAL = "final"


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict[str, Any]
    read_only: bool = False
    destructive: bool = False
    idempotent: bool = False

    def definition(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "inputSchema": self.input_schema,
            "annotations": {
                "readOnlyHint": self.read_only,
                "destructiveHint": self.destructive,
                "idempotentHint": self.idempotent,
                "openWorldHint": False,
            },
        }


START_BUILD = Tool(
    name="start_build",
    description="Start a build for a service and return a build handle. Not idempotent: every call starts a new build.",
    input_schema={"type": "object", "properties": {"service": {"type": "string"}}, "required": ["service"]},
)
GET_BUILD_STATUS = Tool(
    name="get_build_status",
    description="Poll a build handle for progress. Read-only and safe to retry with the same handle after a broken stream.",
    input_schema={"type": "object", "properties": {"build_id": {"type": "string"}}, "required": ["build_id"]},
    read_only=True,
    idempotent=True,
)
PUBLISH_RELEASE = Tool(
    name="publish_release",
    description="Publish a service to an environment. Destructive: a human confirms before this is even called.",
    input_schema={
        "type": "object",
        "properties": {"service": {"type": "string"}, "environment": {"type": "string"}},
        "required": ["service", "environment"],
    },
    destructive=True,
)
TOOLS = {tool.name: tool for tool in (START_BUILD, GET_BUILD_STATUS, PUBLISH_RELEASE)}


@dataclass
class Build:
    ticks: int = 0
    total: int = 3


def _encode_state(payload: dict[str, Any]) -> str:
    return base64.urlsafe_b64encode(json.dumps(payload, sort_keys=True).encode("utf-8")).decode("ascii")


def _decode_state(state: Any) -> dict[str, Any] | None:
    if not isinstance(state, str):
        return None
    try:
        return json.loads(base64.urlsafe_b64decode(state.encode("ascii")).decode("utf-8"))
    except Exception:
        return None


@dataclass
class LifecycleServer:
    """Runs every tools/call through validate (is the tool known) then execute (schema, then handler)."""

    name: str = "release-pipeline"
    version: str = "1.0.0"
    builds: dict[str, Build] = field(default_factory=dict)
    _seq: int = 0

    def _server_meta(self) -> dict[str, Any]:
        return {SERVER_INFO_KEY: {"name": self.name, "version": self.version}}

    def discover(self, message: dict[str, Any]) -> dict[str, Any]:
        request_id = message["id"]
        return make_result(
            request_id,
            supportedVersions=[PROTOCOL_VERSION],
            capabilities={"tools": {"listChanged": False}},
            ttlMs=300000,
            cacheScope="public",
            _meta=self._server_meta(),
        )

    def list_tools(self, message: dict[str, Any]) -> dict[str, Any]:
        request_id = message["id"]
        tools = [TOOLS[name].definition() for name in sorted(TOOLS)]
        return make_result(request_id, tools=tools, ttlMs=300000, cacheScope="public", _meta=self._server_meta())

    def seed_build(self, service: str, ticks: int, total: int = 3) -> str:
        self._seq += 1
        build_id = f"bld_{self._seq}"
        self.builds[build_id] = Build(ticks=ticks, total=total)
        return build_id

    def call(self, message: dict[str, Any]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        """Checkpoint validate, then checkpoint execute. Returns (notifications, response)."""
        request_id = message.get("id")
        params = message.get("params") if isinstance(message.get("params"), dict) else {}
        name = params.get("name")
        if name not in TOOLS:
            return [], make_error(request_id, INVALID_PARAMS, f"Unknown tool: {name}")
        arguments = params.get("arguments") if isinstance(params.get("arguments"), dict) else {}
        progress_token = ((message.get("params") or {}).get("_meta") or {}).get(PROGRESS_TOKEN_KEY)
        if name == START_BUILD.name:
            return [], self._start_build(request_id, arguments)
        if name == GET_BUILD_STATUS.name:
            return self._get_build_status(request_id, arguments, progress_token)
        return [], self._publish_release(request_id, params, arguments)

    def _missing(self, tool: Tool, arguments: dict[str, Any]) -> list[str]:
        return [key for key in tool.input_schema.get("required", []) if key not in arguments]

    def _start_build(self, request_id: Any, arguments: dict[str, Any]) -> dict[str, Any]:
        missing = self._missing(START_BUILD, arguments)
        if missing:
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"Missing required argument(s): {', '.join(missing)}."}],
                isError=True,
                _meta=self._server_meta(),
            )
        build_id = self.seed_build(arguments["service"], ticks=0, total=3)
        return make_result(
            request_id,
            content=[{"type": "text", "text": f"Started build {build_id} for {arguments['service']}"}],
            structuredContent={"buildId": build_id},
            isError=False,
            _meta=self._server_meta(),
        )

    def _get_build_status(self, request_id: Any, arguments: dict[str, Any], progress_token: Any) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        missing = self._missing(GET_BUILD_STATUS, arguments)
        if missing:
            response = make_result(
                request_id,
                content=[{"type": "text", "text": f"Missing required argument(s): {', '.join(missing)}."}],
                isError=True,
                _meta=self._server_meta(),
            )
            return [], response
        build_id = arguments["build_id"]
        build = self.builds.get(build_id)
        if build is None:
            response = make_result(
                request_id,
                content=[{"type": "text", "text": f"No build with handle {build_id}. It may have expired; start a new build."}],
                isError=True,
                _meta=self._server_meta(),
            )
            return [], response
        if build_id == "bld_corrupt":
            # A genuine, unexpected server fault: not something the caller's
            # input caused, so it is reported as a protocol error, not isError.
            try:
                _ = build.ticks / (build.total - build.total)
            except ZeroDivisionError as exc:
                return [], make_error(request_id, INTERNAL_ERROR, f"release-pipeline hit an unexpected fault: {exc}")
        notifications: list[dict[str, Any]] = []
        if build.ticks < build.total:
            build.ticks += 1
        if progress_token is not None:
            notifications.append({
                "jsonrpc": "2.0",
                "method": "notifications/progress",
                "params": {"progressToken": progress_token, "progress": build.ticks, "total": build.total,
                          "message": f"build {build_id}: {build.ticks}/{build.total}"},
            })
        if build.ticks >= build.total:
            response = make_result(
                request_id,
                content=[{"type": "text", "text": f"Build {build_id} complete"}],
                structuredContent={"buildId": build_id, "status": "complete"},
                isError=False,
                _meta=self._server_meta(),
            )
        else:
            response = make_result(
                request_id,
                content=[{"type": "text", "text": f"Build {build_id} still running: {build.ticks}/{build.total}"}],
                structuredContent={"buildId": build_id, "status": "running"},
                isError=False,
                _meta=self._server_meta(),
            )
        return notifications, response

    def _publish_release(self, request_id: Any, params: dict[str, Any], arguments: dict[str, Any]) -> dict[str, Any]:
        missing = self._missing(PUBLISH_RELEASE, arguments)
        if missing:
            return make_result(
                request_id,
                content=[{"type": "text", "text": f"Missing required argument(s): {', '.join(missing)}. Provide them and call again."}],
                isError=True,
                _meta=self._server_meta(),
            )
        is_retry = "inputResponses" in params or "requestState" in params
        if not is_retry:
            state = _encode_state({"service": arguments["service"], "environment": arguments["environment"], "requestId": request_id})
            return make_result(
                request_id,
                result_type="input_required",
                inputRequests={
                    "change_ticket": {
                        "method": "elicitation/create",
                        "params": {
                            "mode": "form",
                            "message": f"Publishing {arguments['service']} to {arguments['environment']}. Enter the change ticket that authorizes it.",
                            "requestedSchema": {
                                "type": "object",
                                "properties": {"ticket": {"type": "string"}},
                                "required": ["ticket"],
                            },
                        },
                    }
                },
                requestState=state,
                _meta=self._server_meta(),
            )
        decoded = _decode_state(params.get("requestState"))
        if decoded is None or decoded.get("service") != arguments.get("service") or decoded.get("environment") != arguments.get("environment"):
            return make_result(
                request_id,
                content=[{"type": "text", "text": "requestState does not match this request. Call publish_release again to get a fresh one."}],
                isError=True,
                _meta=self._server_meta(),
            )
        responses = params.get("inputResponses") if isinstance(params.get("inputResponses"), dict) else {}
        answer = responses.get("change_ticket")
        ticket = answer.get("content", {}).get("ticket") if isinstance(answer, dict) else None
        if not ticket:
            return make_result(
                request_id,
                content=[{"type": "text", "text": "No change ticket was provided; publish_release was not performed."}],
                isError=False,
                structuredContent={"published": False},
                _meta=self._server_meta(),
            )
        return make_result(
            request_id,
            content=[{"type": "text", "text": f"Published {arguments['service']} to {arguments['environment']} under {ticket}"}],
            structuredContent={"published": True, "ticket": ticket},
            isError=False,
            _meta=self._server_meta(),
        )


@dataclass
class Run:
    """One lifecycle trace: the ordered stages a single logical call moved through, and how it ended."""

    label: str
    stages: list[str] = field(default_factory=list)
    final: str = ""
    request_ids: list[Any] = field(default_factory=list)

    def enter(self, stage: str) -> None:
        self.stages.append(stage)


class Client:
    def __init__(self, server: LifecycleServer) -> None:
        self.server = server
        self.next_id = 0
        self.log: list[Any] = []
        self.cancelled_ids: set[Any] = set()

    def _new_id(self) -> int:
        self.next_id += 1
        return self.next_id

    def discover(self, run: Run) -> dict[str, Any]:
        run.enter(STAGE_DISCOVER)
        request = make_request(self._new_id(), "server/discover")
        response = self.server.discover(request)
        self.log.append(request)
        self.log.append(response)
        return response

    def list_tools(self, run: Run) -> list[dict[str, Any]]:
        run.enter(STAGE_LIST)
        request = make_request(self._new_id(), "tools/list")
        response = self.server.list_tools(request)
        self.log.append(request)
        self.log.append(response)
        return response["result"]["tools"]

    def call(self, run: Run, name: str, arguments: dict[str, Any], *, input_responses: dict[str, Any] | None = None,
            request_state: Any = None, progress_token: Any = None, drop_response: bool = False,
            violation: str | None = None) -> dict[str, Any] | None:
        run.enter(STAGE_CALL)
        params: dict[str, Any] = {"name": name, "arguments": arguments}
        if input_responses is not None:
            params["inputResponses"] = input_responses
        if request_state is not None:
            params["requestState"] = request_state
        request = make_request(self._new_id(), "tools/call", params, progress_token=progress_token)
        request_id = request["id"]
        run.request_ids.append(request_id)
        notifications, response = self.server.call(request)
        self.log.append({"violation": violation, "message": request} if violation else request)
        if name not in TOOLS:
            run.enter(STAGE_VALIDATE)
            self.log.append(response)
            run.final = "protocol_error"
            return response
        run.enter(STAGE_VALIDATE)
        run.enter(STAGE_EXECUTE)
        for notification in notifications:
            run.enter(STAGE_PROGRESS)
            self.log.append(notification)
        if drop_response:
            # The stream broke before the response arrived. The server's
            # answer is discarded here to model a packet that never landed;
            # the id stays unresolved on the wire, exactly as it would if the
            # bytes were lost in transit.
            run.final = "dropped"
            return None
        self.log.append(response)
        result = response.get("result") if isinstance(response, dict) else None
        if isinstance(result, dict):
            # A genuine Result message: this attempt reached the result checkpoint,
            # whether it completed, asked for more input, or came back isError.
            run.enter(STAGE_RESULT)
            if result.get("resultType") == "input_required":
                run.final = "input_required"
            elif result.get("isError"):
                run.final = "isError"
            else:
                run.final = "complete"
        else:
            # A bare JSON-RPC error surfaced mid-execute: an unexpected server
            # fault, not actionable input. It has no resultType, so it never
            # reaches the result checkpoint at all.
            run.final = "protocol_error"
        return response

    def cancel(self, run: Run, request_id: Any, reason: str) -> None:
        notification = {"jsonrpc": "2.0", "method": "notifications/cancelled", "params": {"requestId": request_id, "reason": reason}}
        self.log.append(notification)
        self.cancelled_ids.add(request_id)
        run.final = "cancelled"

    def deliver_late(self, run: Run, request_id: Any, response: dict[str, Any]) -> bool:
        """A response for a cancelled request arrives anyway. It is ignored, not appended to the log."""
        if request_id in self.cancelled_ids:
            return False
        self.log.append(response)
        return True


def run_happy_path(server: LifecycleServer, client: Client) -> Run:
    run = Run("happy_path")
    client.discover(run)
    client.list_tools(run)
    run.enter(STAGE_SELECT)
    run.enter(STAGE_CONFIRM)  # get_build_status is read-only: the host shows it but does not gate it
    build_id = server.seed_build("checkout", ticks=1, total=3)
    client.call(run, GET_BUILD_STATUS.name, {"build_id": build_id}, progress_token="pt-happy")
    run.enter(STAGE_FINAL)
    return run


def run_needs_input_then_retry(server: LifecycleServer, client: Client) -> Run:
    run = Run("needs_input_then_retry")
    client.discover(run)
    client.list_tools(run)
    run.enter(STAGE_SELECT)
    run.enter(STAGE_CONFIRM)  # publish_release is destructive: the host asked, and the reviewer approved
    ask = client.call(run, PUBLISH_RELEASE.name, {"service": "checkout", "environment": "production"})
    state = ask["result"]["requestState"]
    run.enter(STAGE_RETRY)
    client.call(
        run, PUBLISH_RELEASE.name, {"service": "checkout", "environment": "production"},
        input_responses={"change_ticket": {"action": "accept", "content": {"ticket": "CHG-4471"}}},
        request_state=state,
    )
    run.enter(STAGE_FINAL)
    return run


def run_confirmation_denied(server: LifecycleServer, client: Client) -> Run:
    run = Run("confirmation_denied")
    client.discover(run)
    client.list_tools(run)
    run.enter(STAGE_SELECT)
    run.enter(STAGE_CONFIRM)  # publish_release is destructive: the reviewer declines, so no call is ever sent
    run.final = "confirmation_denied"
    run.enter(STAGE_FINAL)
    return run


def run_unknown_tool(server: LifecycleServer, client: Client) -> Run:
    run = Run("unknown_tool")
    client.discover(run)
    client.list_tools(run)
    run.enter(STAGE_SELECT)
    run.enter(STAGE_CONFIRM)
    client.call(run, "delete_all_builds", {})
    run.enter(STAGE_FINAL)
    return run


def run_invalid_arguments(server: LifecycleServer, client: Client) -> Run:
    run = Run("invalid_arguments")
    client.discover(run)
    client.list_tools(run)
    run.enter(STAGE_SELECT)
    run.enter(STAGE_CONFIRM)
    client.call(run, PUBLISH_RELEASE.name, {"service": "checkout"})
    run.enter(STAGE_FINAL)
    return run


def run_broken_stream_reissue(server: LifecycleServer, client: Client) -> Run:
    run = Run("broken_stream_reissue")
    client.discover(run)
    client.list_tools(run)
    run.enter(STAGE_SELECT)
    run.enter(STAGE_CONFIRM)
    build_id = server.seed_build("search", ticks=2, total=3)
    client.call(run, GET_BUILD_STATUS.name, {"build_id": build_id}, drop_response=True,
               violation="the stream broke before this response reached the client; it never learns the outcome")
    # get_build_status carries idempotentHint true, so a blind reissue with a new id is a safe read.
    client.call(run, GET_BUILD_STATUS.name, {"build_id": build_id})
    run.enter(STAGE_FINAL)
    return run


def run_timeout_then_cancel(server: LifecycleServer, client: Client) -> Run:
    run = Run("timeout_then_cancel")
    client.discover(run)
    client.list_tools(run)
    run.enter(STAGE_SELECT)
    run.enter(STAGE_CONFIRM)
    build_id = server.seed_build("billing", ticks=0, total=10)
    response = client.call(run, GET_BUILD_STATUS.name, {"build_id": build_id}, progress_token="pt-timeout")
    max_polls_without_progress_past_budget = 1
    polls = 0
    while response is not None and response["result"]["structuredContent"]["status"] != "complete" and polls < max_polls_without_progress_past_budget:
        response = client.call(run, GET_BUILD_STATUS.name, {"build_id": build_id}, progress_token="pt-timeout")
        polls += 1
    last_request_id = run.request_ids[-1]
    client.cancel(run, last_request_id, "client hard timeout: build did not finish inside the polling budget")
    run.enter(STAGE_FINAL)
    late_response = make_result(last_request_id, content=[{"type": "text", "text": "finished after all"}],
                                structuredContent={"buildId": build_id, "status": "complete"}, isError=False,
                                _meta=server._server_meta())
    delivered = client.deliver_late(run, last_request_id, late_response)
    run.stages.append("late_response_delivered" if delivered else "late_response_ignored")
    return run


def run_internal_fault(server: LifecycleServer, client: Client) -> Run:
    run = Run("internal_fault")
    client.discover(run)
    client.list_tools(run)
    run.enter(STAGE_SELECT)
    run.enter(STAGE_CONFIRM)
    server.builds["bld_corrupt"] = Build(ticks=0, total=0)
    client.call(run, GET_BUILD_STATUS.name, {"build_id": "bld_corrupt"})
    run.enter(STAGE_FINAL)
    return run


def run_all() -> dict[str, Any]:
    server = LifecycleServer()
    client = Client(server)
    runs = {
        "happy_path": run_happy_path(server, client),
        "needs_input_then_retry": run_needs_input_then_retry(server, client),
        "confirmation_denied": run_confirmation_denied(server, client),
        "unknown_tool": run_unknown_tool(server, client),
        "invalid_arguments": run_invalid_arguments(server, client),
        "broken_stream_reissue": run_broken_stream_reissue(server, client),
        "timeout_then_cancel": run_timeout_then_cancel(server, client),
        "internal_fault": run_internal_fault(server, client),
    }
    return {"server": server, "client": client, "runs": runs}


def transcript() -> list[Any]:
    scenario = run_all()
    return scenario["client"].log


def demo() -> None:
    scenario = run_all()
    for label, run in scenario["runs"].items():
        print(f"{label}: {' -> '.join(run.stages)}")
        print(f"  final: {run.final}")
    print()
    print("wire messages exchanged:", len(scenario["client"].log))


if __name__ == "__main__":
    demo()
