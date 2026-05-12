"""Wrap subprocess.run with deterministic structured capture.

Every shell command goes through run_with_feedback, which appends a
record to feedback_record.jsonl. Records carry the command, truncated
stdout/stderr tails, exit code, duration, started_at timestamp, and an
agent note. The verification gate reads this file later.

Run: python3 code/main.py
"""

from __future__ import annotations

import json
import shlex
import subprocess
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path

HERE = Path(__file__).parent
RECORD = HERE / "feedback_record.jsonl"

HEAD_LINES = 5
TAIL_LINES = 30


@dataclass
class FeedbackRecord:
    command: list[str]
    stdout_tail: str
    stderr_tail: str
    exit_code: int | None
    duration_ms: int
    started_at: float
    agent_note: str
    error: str | None = None
    truncations: dict[str, int] = field(default_factory=dict)


def deterministic_tail(text: str, head: int = HEAD_LINES, tail: int = TAIL_LINES) -> tuple[str, int]:
    lines = text.splitlines()
    if len(lines) <= head + tail:
        return text, 0
    cut = len(lines) - head - tail
    return "\n".join(lines[:head] + [f"...truncated {cut} lines..."] + lines[-tail:]), cut


def run_with_feedback(command: list[str], agent_note: str = "", timeout_s: float = 30.0) -> FeedbackRecord:
    started = time.time()
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=timeout_s)
        stdout, cut_out = deterministic_tail(completed.stdout)
        stderr, cut_err = deterministic_tail(completed.stderr)
        record = FeedbackRecord(
            command=command,
            stdout_tail=stdout,
            stderr_tail=stderr,
            exit_code=completed.returncode,
            duration_ms=int((time.time() - started) * 1000),
            started_at=started,
            agent_note=agent_note,
            truncations={"stdout": cut_out, "stderr": cut_err},
        )
    except subprocess.TimeoutExpired:
        record = FeedbackRecord(
            command=command,
            stdout_tail="",
            stderr_tail="",
            exit_code=None,
            duration_ms=int(timeout_s * 1000),
            started_at=started,
            agent_note=agent_note,
            error=f"timeout after {timeout_s}s",
        )
    except FileNotFoundError as exc:
        record = FeedbackRecord(
            command=command,
            stdout_tail="",
            stderr_tail="",
            exit_code=None,
            duration_ms=int((time.time() - started) * 1000),
            started_at=started,
            agent_note=agent_note,
            error=str(exc),
        )

    with RECORD.open("a") as fh:
        fh.write(json.dumps(asdict(record)) + "\n")
    return record


def loop_can_advance(record: FeedbackRecord) -> bool:
    """Refuse to advance the loop when exit code is missing."""
    return record.exit_code is not None


def load_all() -> list[FeedbackRecord]:
    if not RECORD.exists():
        return []
    return [FeedbackRecord(**json.loads(line)) for line in RECORD.read_text().splitlines() if line.strip()]


def main() -> None:
    RECORD.unlink(missing_ok=True)

    ok = run_with_feedback(["python3", "-c", "print('hello')"], agent_note="expect hello")
    fail = run_with_feedback(["python3", "-c", "import sys; sys.exit(2)"], agent_note="expect non-zero")
    missing = run_with_feedback([shlex.split("does-not-exist")[0]], agent_note="probe missing binary")

    for label, rec in (("ok", ok), ("fail", fail), ("missing", missing)):
        print(f"{label}: exit={rec.exit_code} duration_ms={rec.duration_ms} note={rec.agent_note!r}")
        if rec.error:
            print(f"  error: {rec.error}")
        print(f"  advance_allowed: {loop_can_advance(rec)}")

    print(f"\n{len(load_all())} records persisted in {RECORD.name}")


if __name__ == "__main__":
    main()
