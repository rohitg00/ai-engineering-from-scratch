#!/usr/bin/env python3
"""Structured shell-command runner. See Phase 14 · 37."""

from __future__ import annotations

import argparse
import json
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RECORD = ROOT / "feedback_record.jsonl"
HEAD_LINES = 5
TAIL_LINES = 30


def deterministic_tail(text: str) -> tuple[str, int]:
    lines = text.splitlines()
    if len(lines) <= HEAD_LINES + TAIL_LINES:
        return text, 0
    cut = len(lines) - HEAD_LINES - TAIL_LINES
    return "\n".join(lines[:HEAD_LINES] + [f"...truncated {cut} lines..."] + lines[-TAIL_LINES:]), cut


def run_with_feedback(command: list[str], agent_note: str = "", timeout_s: float = 30.0) -> dict[str, object]:
    started = time.time()
    record: dict[str, object] = {"command": command, "agent_note": agent_note, "started_at": started}
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=timeout_s)
        out, cut_out = deterministic_tail(completed.stdout)
        err, cut_err = deterministic_tail(completed.stderr)
        record.update(
            stdout_tail=out, stderr_tail=err, exit_code=completed.returncode,
            duration_ms=int((time.time() - started) * 1000),
            truncations={"stdout": cut_out, "stderr": cut_err},
        )
    except subprocess.TimeoutExpired as exc:
        partial_out = exc.stdout.decode(errors="replace") if isinstance(exc.stdout, bytes) else (exc.stdout or "")
        partial_err = exc.stderr.decode(errors="replace") if isinstance(exc.stderr, bytes) else (exc.stderr or "")
        out, cut_out = deterministic_tail(partial_out)
        err, cut_err = deterministic_tail(partial_err)
        record.update(
            stdout_tail=out, stderr_tail=err, exit_code=None,
            duration_ms=int((time.time() - started) * 1000),
            error=f"timeout after {timeout_s}s",
            truncations={"stdout": cut_out, "stderr": cut_err},
        )
    except FileNotFoundError as exc:
        record.update(stdout_tail="", stderr_tail="", exit_code=None,
                      duration_ms=int((time.time() - started) * 1000), error=str(exc))
    with RECORD.open("a") as fh:
        fh.write(json.dumps(record) + "\n")
    return record


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", nargs="+")
    ap.add_argument("--note", default="")
    ap.add_argument("--timeout", type=float, default=30.0)
    args = ap.parse_args()
    rec = run_with_feedback(args.command, agent_note=args.note, timeout_s=args.timeout)
    print(json.dumps(rec, indent=2))
    return 0 if rec.get("exit_code") == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
