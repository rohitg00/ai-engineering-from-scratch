"""Send versioned JSON requests through the bounded Rust action loop."""

import argparse, json, subprocess, tempfile
from pathlib import Path

TOOLS = {
    "read": {
        "type": "object",
        "required": ["path"],
        "properties": {"path": {"type": "string"}},
    },
    "list": {"type": "object", "properties": {"path": {"type": "string"}}},
    "search": {
        "type": "object",
        "required": ["path", "pattern"],
        "properties": {"path": {"type": "string"}, "pattern": {"type": "string"}},
    },
    "help": {"type": "object"},
    "pwd": {"type": "object"},
    "quit": {"type": "object"},
}


def encode(request):
    if (
        not isinstance(request, dict)
        or not isinstance(request.get("id"), str)
        or not request["id"]
    ):
        raise ValueError("request id required")
    tool = request.get("tool")
    args = request.get("arguments", {})
    if tool not in TOOLS or not isinstance(args, dict):
        raise ValueError("known tool and object arguments required")
    if any(key not in args for key in TOOLS[tool].get("required", [])):
        raise ValueError("missing required tool argument")
    if set(args) - set(TOOLS[tool].get("properties", {})):
        raise ValueError("unknown tool argument")
    for value in args.values():
        if not isinstance(value, str) or any(ord(c) < 32 for c in value):
            raise ValueError("string arguments without control characters required")
    if tool == "search":
        return f"search {args['pattern']}\t{args['path']}"
    if tool in ("read", "list"):
        return f"{tool} {args.get('path', '.')}"
    return tool


def receipts(rows, stdout, reason, abnormal=False):
    responses = []
    protocol_error = False
    for line in stdout.splitlines(keepends=True):
        newline = b"\n" if isinstance(line, bytes) else "\n"
        if abnormal and not line.endswith(newline):
            reason += "; incomplete response discarded"
            break
        try:
            event = json.loads(line)
            if (
                not isinstance(event, dict)
                or type(event.get("seq")) is not int
                or event["seq"] < 0
                or event.get("kind") not in ("ok", "error", "rejected")
                or not isinstance(event.get("output"), str)
                or not isinstance(event.get("terminal"), bool)
            ):
                raise ValueError("invalid event fields")
        except (ValueError, UnicodeDecodeError):
            reason = f"invalid native response at position {len(responses) + 1}"
            protocol_error = True
            break
        responses.append(event)
    events = []
    for index, request in enumerate(rows):
        if index < len(responses):
            event = responses[index]
            if event["terminal"] and not protocol_error:
                reason = event.get("output", "session closed")
        else:
            event = {
                "seq": responses[-1]["seq"] if responses else 0,
                "kind": "not-executed",
                "output": "no response received: " + reason,
                "terminal": True,
            }
        events.append({**event, "schema_version": 1, "request_id": request["id"]})
    return events, protocol_error


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workspace")
    parser.add_argument("requests")
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--out")
    args = parser.parse_args()
    rows = [
        json.loads(line)
        for line in Path(args.requests).read_text().splitlines()
        if line.strip()
    ]
    commands = [encode(row) for row in rows]
    if len({row["id"] for row in rows}) != len(rows):
        raise ValueError("duplicate request id")
    with tempfile.TemporaryDirectory(prefix="rust-shell-private-") as folder:
        binary = Path(folder) / "shell"
        subprocess.run(
            [
                "rustc",
                "--edition=2021",
                str(Path(__file__).with_name("main.rs")),
                "-o",
                str(binary),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        try:
            run = subprocess.run(
                [str(binary), args.workspace, str(args.limit)],
                input=("\n".join(commands) + ("\n" if commands else "")).encode("utf-8"),
                capture_output=True,
                timeout=30,
            )
            reason = run.stderr.decode("utf-8", errors="replace").strip() or "process ended"
            events, protocol_error = receipts(rows, run.stdout, reason, abnormal=bool(run.returncode))
            exit_code = 1 if run.returncode or protocol_error else 0
        except subprocess.TimeoutExpired as error:
            events, _ = receipts(rows, error.stdout or b"", "process timed out", abnormal=True)
            exit_code = 1
    payload = (
        "\n".join(json.dumps(event, ensure_ascii=False) for event in events)
        + ("\n" if events else "")
    )
    if args.out:
        Path(args.out).write_text(payload)
    print(payload, end="")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
