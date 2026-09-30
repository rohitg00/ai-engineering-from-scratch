"""Implement initialized JSON-RPC over stdio.

Lesson: projects/mcp-at-scale/stages/03-protocol/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import json
import sys
from registry import catalog, execute
from discovery import discover
from rest_adapter import execute_rest


def handle(request, state, inventory):
    if (
        not isinstance(request, dict)
        or request.get("jsonrpc") != "2.0"
        or not isinstance(request.get("method"), str)
    ):
        return {
            "jsonrpc": "2.0",
            "id": request.get("id") if isinstance(request, dict) else None,
            "error": {"code": -32600, "message": "Invalid Request"},
        }
    id = request.get("id")
    method = request["method"]
    params = request.get("params", {})

    def result(value):
        return {"jsonrpc": "2.0", "id": id, "result": value}

    def error(code, message):
        return {"jsonrpc": "2.0", "id": id, "error": {"code": code, "message": message}}

    if "id" not in request:
        if method == "notifications/initialized" and state.get("negotiated"):
            state["initialized"] = True
        return None
    if not isinstance(params, dict):
        return error(-32602, "Invalid params")
    if method == "initialize":
        if params.get("protocolVersion") not in ["2025-06-18", "2025-11-25"]:
            return error(-32602, "Unsupported protocol version")
        state["negotiated"] = True
        return result(
            {
                "protocolVersion": params["protocolVersion"],
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "local-inventory", "version": "1.0"},
            }
        )
    if not state.get("initialized"):
        return error(-32002, "Initialize before using tools")
    tools = state.get("catalog", catalog())
    if method == "tools/list":
        try:
            offset = int(params.get("cursor", "0"))
        except (ValueError, TypeError):
            return error(-32602, "Invalid cursor")
        if offset < 0 or offset > len(tools):
            return error(-32602, "Invalid cursor")
        page = [
            {key: t[key] for key in ["name", "description", "inputSchema"]}
            for t in tools[offset : offset + 32]
        ]
        payload = {"tools": page}
        if offset + 32 < len(tools):
            payload["nextCursor"] = str(offset + 32)
        return result(payload)
    if method == "tools/call":
        tool = next((t for t in tools if t["name"] == params.get("name")), None)
        if tool is None:
            return error(-32602, "Unknown tool")
        try:
            if tool["name"] == "catalog_search":
                args = params.get("arguments", {})
                if (
                    not isinstance(args, dict)
                    or set(args) - {"query", "max_chars", "k"}
                    or not isinstance(args.get("query"), str)
                    or any(
                        type(args.get(key, default)) is not int
                        for key, default in [("max_chars", 1500), ("k", 5)]
                    )
                ):
                    raise ValueError("invalid discovery arguments")
                value = discover(
                    [t for t in tools if t["name"] != "catalog_search"],
                    args["query"],
                    args.get("max_chars", 1500),
                    args.get("k", 5),
                )
            elif "rest" in tool:
                value = execute_rest(
                    tool,
                    params.get("arguments", {}),
                    inventory.get("recordings"),
                    inventory.get("base_url"),
                )
            else:
                value = execute(tool, params.get("arguments", {}), inventory)
        except ValueError as exc:
            return result(
                {"content": [{"type": "text", "text": str(exc)}], "isError": True}
            )
        return result(
            {"content": [{"type": "text", "text": json.dumps(value)}], "isError": False}
        )
    return error(-32601, "Method not found")


def serve(lines, output, inventory, tools=None):
    state = {} if tools is None else {"catalog": tools}
    for line in lines:
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            response = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {"code": -32700, "message": "Parse error"},
            }
        else:
            response = handle(request, state, inventory)
        if response is not None:
            output.write(json.dumps(response) + "\n")
            output.flush()


if __name__ == "__main__":
    serve(
        sys.stdin,
        sys.stdout,
        {
            "pods": [
                {"name": "worker-1", "phase": "Running"},
                {"name": "worker-2", "phase": "Pending"},
            ]
        },
    )
