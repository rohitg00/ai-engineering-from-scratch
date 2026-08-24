"""Phase 13 Capstone - stateless in-process research-and-report simulation.

Several Phase 13 boundaries in one readable demo:
  - gateway-shaped static token lookup and RBAC
  - per-request protocol metadata and mandatory server discovery
  - local tool functions returning task-extension and ui-shaped data
  - A2A-shaped writer delegation represented by a nested span
  - in-memory trace dictionaries sharing one trace id
  - pinned-hash manifest guarding description mutations

This file does not implement an MCP or A2A transport, OAuth exchange, MCP App
bridge, telemetry exporter, or execution sandbox. Stdlib only.

Run: python code/main.py
"""

from __future__ import annotations

import hashlib
import json
import time
import uuid
from copy import deepcopy
from datetime import datetime, timezone


SPANS: list[dict] = []
TASKS: dict[str, dict] = {}

PROTOCOL_VERSION = "2026-07-28"
TASK_EXTENSION = "io.modelcontextprotocol/tasks"
SERVER_INFO = {"name": "research-simulator", "version": "1.0.0"}


def request_meta(*, tasks: bool = False) -> dict:
    extensions = {TASK_EXTENSION: {}} if tasks else {}
    return {
        "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {"extensions": extensions},
        "io.modelcontextprotocol/clientInfo": {
            "name": "capstone-client",
            "version": "1.0.0",
        },
    }


def _server_meta() -> dict:
    return {"io.modelcontextprotocol/serverInfo": deepcopy(SERVER_INFO)}


def complete_result(**fields: object) -> dict:
    return {"resultType": "complete", **fields, "_meta": _server_meta()}


def protocol_error(code: int, message: str, data: dict | None = None) -> dict:
    error = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"error": error}


def validate_request_meta(meta: dict, *, require_tasks: bool = False) -> dict | None:
    if not isinstance(meta, dict):
        return protocol_error(-32602, "params._meta must be an object")
    requested = meta.get("io.modelcontextprotocol/protocolVersion")
    if not isinstance(requested, str):
        return protocol_error(-32602, "protocolVersion must be a string")
    if requested != PROTOCOL_VERSION:
        return protocol_error(
            -32022,
            "Unsupported protocol version",
            {"supported": [PROTOCOL_VERSION], "requested": requested},
        )
    capabilities = meta.get("io.modelcontextprotocol/clientCapabilities")
    if not isinstance(capabilities, dict):
        return protocol_error(-32602, "clientCapabilities must be an object")
    extensions = capabilities.get("extensions", {})
    if require_tasks and (
        not isinstance(extensions, dict) or TASK_EXTENSION not in extensions
    ):
        return protocol_error(
            -32021,
            "Missing required client capability",
            {
                "requiredCapabilities": {
                    "extensions": {TASK_EXTENSION: {}}
                }
            },
        )
    return None


def server_discover(meta: dict) -> dict:
    invalid = validate_request_meta(meta)
    if invalid:
        return invalid
    return complete_result(
        supportedVersions=[PROTOCOL_VERSION],
        capabilities={
            "tools": {"listChanged": False},
            "extensions": {TASK_EXTENSION: {}},
        },
        ttlMs=3_600_000,
        cacheScope="public",
    )


def _hex(n: int) -> str:
    return uuid.uuid4().hex[: n * 2]


def span(name: str, kind: str, trace_id: str | None, parent: str | None,
         attrs: dict) -> dict:
    tid = trace_id or _hex(16)
    sp = {"name": name, "kind": kind, "traceId": tid, "spanId": _hex(8),
          "parentSpanId": parent, "start": time.time_ns(), "attrs": attrs, "end": 0}
    SPANS.append(sp)
    return sp


def finish(sp: dict) -> None:
    sp["end"] = max(time.time_ns(), sp["start"] + 1)


TOOLS = [
    {"name": "arxiv_search", "description": "Use when the user searches arXiv by keyword."},
    {"name": "generate_report", "description": "Use when the user wants a full report."},
]

PAPERS = [
    {"arxiv_id": "2603.22489", "title": "Tool poisoning attacks on MCP deployments"},
    {"arxiv_id": "2604.01055", "title": "Agent-to-agent coordination benchmarks"},
    {"arxiv_id": "2603.30016", "title": "Long-running tool calls via Tasks"},
]

PINNED = {f"research::{t['name']}": hashlib.sha256(t["description"].encode()).hexdigest()
          for t in TOOLS}


def research_arxiv_search(args: dict) -> dict:
    q = args["query"].lower()
    hits = [p for p in PAPERS if q in p["title"].lower()]
    return complete_result(
        content=[{"type": "text", "text": json.dumps(hits)}],
        isError=False,
    )


def research_generate_report(args: dict, trace_id: str, parent: str) -> dict:
    task_id = f"tsk_{uuid.uuid4().hex[:10]}"
    sp = span("mcp.task.working", "INTERNAL", trace_id, parent,
              {"gen_ai.operation.name": "execute_tool", "mcp.task.id": task_id})
    a2a = span("a2a.SendMessage", "CLIENT", trace_id, sp["spanId"],
               {"a2a.peer": "writer-agent", "a2a.skill": "summarize_papers"})
    finish(a2a)
    finish(sp)
    html = (
        "<!doctype html><html><body>"
        "<h1>Agent-protocol arXiv report</h1><ul>"
        + "".join(f"<li>{p['arxiv_id']}: {p['title']}</li>" for p in PAPERS)
        + "</ul><script>/* A real MCP App bridge is intentionally absent. */</script></body></html>"
    )
    now = datetime.now(timezone.utc).isoformat()
    TASKS[task_id] = {
        "resultType": "complete",
        "taskId": task_id,
        "status": "completed",
        "createdAt": now,
        "lastUpdatedAt": now,
        "ttlMs": 900_000,
        "pollIntervalMs": 1_000,
        "result": complete_result(
            content=[
                {"type": "text", "text": "Report generated: 3 papers summarized."},
                {"type": "ui_resource", "uri": "ui://report/current"},
            ],
            ui={
                "resourceUri": "ui://report/current",
                "csp": {"default-src": "'self'"},
                "permissions": [],
            },
            html=html,
        ),
        "_meta": _server_meta(),
    }
    return {
        "resultType": "task",
        "taskId": task_id,
        "status": "working",
        "createdAt": now,
        "lastUpdatedAt": now,
        "ttlMs": 900_000,
        "pollIntervalMs": 1_000,
        "_meta": _server_meta(),
    }


def tasks_get(task_id: str, meta: dict) -> dict:
    invalid = validate_request_meta(meta, require_tasks=True)
    if invalid:
        return invalid
    if not isinstance(task_id, str):
        return protocol_error(-32602, "Unknown taskId")
    task = TASKS.get(task_id)
    if task is None:
        return protocol_error(-32602, "Unknown taskId")
    return deepcopy(task)


USERS = {
    "tok_alice": {"id": "alice", "scopes": {"research:read", "research:write"}},
    "tok_bob":   {"id": "bob",   "scopes": {"research:read"}},
}
REQUIRED_SCOPE = {"arxiv_search": "research:read",
                  "generate_report": "research:write"}

AUDIT: list[dict] = []


def pin_ok(tool_name: str, description: str) -> bool:
    return PINNED.get(f"research::{tool_name}") == hashlib.sha256(description.encode()).hexdigest()


def gateway_call(token: str, tool_name: str, args: dict,
                 trace_id: str, parent: str, meta: dict) -> dict:
    invalid = validate_request_meta(
        meta, require_tasks=tool_name == "generate_report"
    )
    if invalid:
        return invalid
    u = USERS.get(token)
    if not u:
        return {"error": "unauthenticated"}
    required = REQUIRED_SCOPE.get(tool_name)
    if required and required not in u["scopes"]:
        AUDIT.append({"user": u["id"], "tool": tool_name, "decision": "403"})
        return {"error": "insufficient_scope", "scope": required}
    tool = next((t for t in TOOLS if t["name"] == tool_name), None)
    if tool is None:
        return {"error": "unknown tool"}
    if not pin_ok(tool_name, tool["description"]):
        return {"error": "hash_mismatch"}
    sp = span("mcp.call", "CLIENT", trace_id, parent,
              {"gen_ai.operation.name": "execute_tool", "gen_ai.tool.name": tool_name,
               "gateway.user": u["id"], "mcp.server": "research"})
    if tool_name == "arxiv_search":
        result = research_arxiv_search(args)
    else:
        result = research_generate_report(args, trace_id, sp["spanId"])
    finish(sp)
    AUDIT.append({"user": u["id"], "tool": tool_name, "decision": "allow"})
    return result


def orchestrator(token: str, user_query: str) -> dict:
    trace_id = _hex(16)
    root = span("agent.invoke_agent", "INTERNAL", trace_id, None,
                {"gen_ai.operation.name": "invoke_agent",
                 "gen_ai.agent.name": "research-orchestrator"})

    llm1 = span("llm.chat", "CLIENT", trace_id, root["spanId"],
                {"gen_ai.operation.name": "chat", "gen_ai.provider.name": "openai",
                 "gen_ai.request.model": "gpt-4o", "gen_ai.usage.input_tokens": 24})
    finish(llm1)

    search = gateway_call(token, "arxiv_search",
                          {"query": "agent"}, trace_id, root["spanId"],
                          request_meta())
    report = gateway_call(token, "generate_report",
                          {"format": "html"}, trace_id, root["spanId"],
                          request_meta(tasks=True))
    task = None
    if report.get("resultType") == "task":
        task = tasks_get(report["taskId"], request_meta(tasks=True))

    llm2 = span("llm.chat", "CLIENT", trace_id, root["spanId"],
                {"gen_ai.operation.name": "chat", "gen_ai.provider.name": "openai",
                 "gen_ai.request.model": "gpt-4o", "gen_ai.usage.output_tokens": 85})
    finish(llm2)

    finish(root)
    return {"trace_id": trace_id, "search": search, "report": report, "task": task}


def demo() -> None:
    print("=" * 72)
    print("PHASE 13 CAPSTONE - RESEARCH AND REPORT ECOSYSTEM")
    print("=" * 72)

    print("\n--- stateless server discovery ---")
    discovery = server_discover(request_meta())
    print(f"  protocol       : {discovery['supportedVersions'][0]}")
    print(f"  task extension : {TASK_EXTENSION in discovery['capabilities']['extensions']}")

    print("\n--- orchestrator run as alice (read+write) ---")
    out = orchestrator("tok_alice", "summarize the three most-cited 2026 arXiv papers")
    print(f"  trace id      : {out['trace_id']}")
    print(f"  search result : {out['search']['content'][0]['text']}")
    print(f"  report handle : {out['report']['taskId']} ({out['report']['status']})")
    print(f"  task status   : {out['task']['status']} via tasks/get")
    print(f"  ui bytes      : {len(out['task']['result']['html'])}")

    print("\n--- orchestrator run as bob (read only) ---")
    out = orchestrator("tok_bob", "generate a report")
    print(f"  generate_report -> {out['report']}")

    print("\n--- audit log ---")
    for row in AUDIT:
        print(f"  {row}")

    print("\n--- OTel GenAI spans ---")
    for sp in SPANS:
        dur_ms = round((sp['end'] - sp['start']) / 1_000_000, 2) if sp['end'] else 0
        parent = sp['parentSpanId'][:6] if sp['parentSpanId'] else "ROOT"
        print(f"  [{sp['traceId'][:6]}] {sp['name']:20s} {sp['kind']:8s} "
              f"parent={parent}  dur={dur_ms}ms")

    print("\n--- primitive coverage ---")
    covered = [
        "tool interface and direct function dispatch",
        "server/discover and per-request stateless metadata",
        "structured content dictionaries",
        "task-extension handle and tasks/get polling",
        "ui://-shaped resource reference",
        "description mutation detection with pinned hashes",
        "static-token scope and gateway policy simulation",
        "A2A-shaped opaque delegation boundary",
        "in-memory trace identifiers and parent span identifiers",
        "orchestrator routing between local operations",
    ]
    for c in covered:
        print(f"  + {c}")


if __name__ == "__main__":
    demo()
