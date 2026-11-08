"""A stand-in for rea's MCP stdio server that replays fixtures/runs/agent-run.json.
It speaks newline-delimited JSON-RPC 2.0 and answers each tools/call with the evidence
record the real server returned for the same tool and arguments. The tests use it to
exercise the client and the agent loop without rea, Ghidra, or Java."""

import json
import sys
from pathlib import Path

RUN = Path(__file__).resolve().parents[1] / "fixtures" / "runs" / "agent-run.json"


def main() -> None:
    run = json.loads(RUN.read_text(encoding="utf-8"))
    by_call = {}
    for step in run["steps"]:
        key = json.dumps([step["tool"], step["arguments"]], sort_keys=True)
        structured = run["evidence"].get(step["evidence_id"]) if step["evidence_id"] else None
        by_call.setdefault(key, structured)
    tool_names = sorted({step["tool"] for step in run["steps"]})
    for line in sys.stdin:
        message = json.loads(line)
        if "id" not in message:
            continue
        method = message.get("method")
        params = message.get("params") or {}
        if method == "initialize":
            result = {
                "protocolVersion": params.get("protocolVersion"),
                "capabilities": {"tools": {"listChanged": False}},
                "serverInfo": {"name": "fake-rea", "version": run["server"].get("version", "0")},
            }
        elif method == "tools/list":
            result = {"tools": [{"name": name, "inputSchema": {"type": "object"}} for name in tool_names]}
        elif method == "tools/call":
            arguments = dict(params.get("arguments") or {})
            if params.get("name") == "open_binary":
                arguments["path"] = run["steps"][0]["arguments"]["path"]
            key = json.dumps([params.get("name"), arguments], sort_keys=True)
            if key not in by_call:
                result = {"isError": True, "content": [{"type": "text", "text": f"no recorded answer for {key}"}]}
            else:
                structured = by_call[key]
                result = {"content": [{"type": "text", "text": json.dumps(structured) if structured else "{}"}]}
                if structured:
                    result["structuredContent"] = structured
        else:
            sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": message["id"], "error": {"code": -32601, "message": "method not found"}}) + "\n")
            sys.stdout.flush()
            continue
        sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": message["id"], "result": result}) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
