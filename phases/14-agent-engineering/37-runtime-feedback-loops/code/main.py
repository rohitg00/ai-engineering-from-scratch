"""Wrap subprocess.run with structured capture, secret redaction, rotation, and command lineage.

Every shell command goes through run_with_feedback. Records carry argv, redacted
stdout/stderr tails, exit code, duration, started_at, agent note, and a
command_id/parent_command_id pair so retries trace back to their origin. The
JSONL file rotates at 1 MB to keep loader memory bounded.

Run: python3 code/main.py
"""

from __future__ import annotations

import json
import re
import shlex
import subprocess
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path

HERE = Path(__file__).parent
RECORD = HERE / "feedback_record.jsonl"

HEAD_LINES = 5
TAIL_LINES = 30
ROTATE_BYTES = 1 * 1024 * 1024  # 1 MB
MAX_ROTATIONS = 5

# Secret patterns. Audit quarterly against the production runtime's observed leak shapes.
REDACTION_PATTERNS = [
    (re.compile(r"(?i)bearer\s+[A-Za-z0-9._\-]+"), "Bearer [REDACTED]"),
    (re.compile(r"(?i)\b(password|passwd|secret|api[_-]?key|access[_-]?key|token)\s*[:=]\s*\S+"),
     r"\1=[REDACTED]"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "AKIA[REDACTED]"),
    (re.compile(r"\bxox[baprs]-[A-Za-z0-9\-]+"), "xox-[REDACTED]"),
    (re.compile(r"-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----"),
     "[REDACTED PRIVATE KEY]"),
]


@dataclass
class FeedbackRecord:
    command_id: str
    parent_command_id: str | None
    command: list[str]
    stdout_tail: str
    stderr_tail: str
    exit_code: int | None
    duration_ms: int
    started_at: float
    agent_note: str
    error: str | None = None
    truncations: dict[str, int] = field(default_factory=dict)
    redactions: dict[str, int] = field(default_factory=dict)


def redact(text: str) -> tuple[str, int]:
    """Strip secrets before the JSONL append. Read-time redaction is a foot-gun."""
    if not text:
        return text, 0
    hits = 0
    out = text
    for pattern, replacement in REDACTION_PATTERNS:
        out, n = pattern.subn(replacement, out)
        hits += n
    return out, hits


def deterministic_tail(text: str, head: int = HEAD_LINES, tail: int = TAIL_LINES) -> tuple[str, int]:
    lines = text.splitlines()
    if len(lines) <= head + tail:
        return text, 0
    cut = len(lines) - head - tail
    return "\n".join(lines[:head] + [f"...truncated {cut} lines..."] + lines[-tail:]), cut


def _process_capture(text: str) -> tuple[str, int, int]:
    """Truncate first, then redact. Returns (text, cut_lines, redaction_hits)."""
    tailed, cut = deterministic_tail(text)
    redacted, hits = redact(tailed)
    return redacted, cut, hits


def maybe_rotate() -> None:
    """Cap the active file at ROTATE_BYTES; rotate .1 .. .MAX, drop oldest."""
    if not RECORD.exists() or RECORD.stat().st_size < ROTATE_BYTES:
        return
    for idx in range(MAX_ROTATIONS, 0, -1):
        src = RECORD.with_suffix(RECORD.suffix + (f".{idx - 1}" if idx > 1 else ""))
        if src == RECORD:
            src = RECORD
        dst = RECORD.with_suffix(RECORD.suffix + f".{idx}")
        if src.exists():
            if idx == MAX_ROTATIONS and dst.exists():
                dst.unlink()
            try:
                src.rename(dst)
            except FileNotFoundError:
                pass


def run_with_feedback(
    command: list[str],
    agent_note: str = "",
    timeout_s: float = 30.0,
    parent_command_id: str | None = None,
) -> FeedbackRecord:
    started = time.time()
    command_id = uuid.uuid4().hex[:12]
    base_kwargs = dict(
        command_id=command_id,
        parent_command_id=parent_command_id,
        command=command,
        started_at=started,
        agent_note=agent_note,
    )
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=timeout_s)
        out, cut_out, red_out = _process_capture(completed.stdout)
        err, cut_err, red_err = _process_capture(completed.stderr)
        record = FeedbackRecord(
            stdout_tail=out, stderr_tail=err,
            exit_code=completed.returncode,
            duration_ms=int((time.time() - started) * 1000),
            truncations={"stdout": cut_out, "stderr": cut_err},
            redactions={"stdout": red_out, "stderr": red_err},
            **base_kwargs,
        )
    except subprocess.TimeoutExpired as exc:
        partial_out = exc.stdout.decode(errors="replace") if isinstance(exc.stdout, bytes) else (exc.stdout or "")
        partial_err = exc.stderr.decode(errors="replace") if isinstance(exc.stderr, bytes) else (exc.stderr or "")
        out, cut_out, red_out = _process_capture(partial_out)
        err, cut_err, red_err = _process_capture(partial_err)
        record = FeedbackRecord(
            stdout_tail=out, stderr_tail=err,
            exit_code=None,
            duration_ms=int((time.time() - started) * 1000),
            error=f"timeout after {timeout_s}s",
            truncations={"stdout": cut_out, "stderr": cut_err},
            redactions={"stdout": red_out, "stderr": red_err},
            **base_kwargs,
        )
    except FileNotFoundError as exc:
        record = FeedbackRecord(
            stdout_tail="", stderr_tail="",
            exit_code=None,
            duration_ms=int((time.time() - started) * 1000),
            error=str(exc),
            **base_kwargs,
        )

    maybe_rotate()
    with RECORD.open("a") as fh:
        fh.write(json.dumps(asdict(record)) + "\n")
    return record


def loop_can_advance(record: FeedbackRecord) -> bool:
    """Refuse to advance the loop when exit code is missing."""
    return record.exit_code is not None


def load_all() -> list[FeedbackRecord]:
    """Read active + rotated files so parent-command lineage survives rotation."""
    def _rotation_key(p: Path) -> int:
        suffix = p.name[len(RECORD.name):]
        if not suffix:
            return 0  # active file
        try:
            return int(suffix.lstrip("."))
        except ValueError:
            return 99
    paths = sorted(HERE.glob(RECORD.name + "*"), key=_rotation_key, reverse=True)
    by_id: dict[str, FeedbackRecord] = {}
    for path in paths:
        try:
            text = path.read_text()
        except FileNotFoundError:
            continue
        for line in text.splitlines():
            if not line.strip():
                continue
            try:
                record = FeedbackRecord(**json.loads(line))
            except (json.JSONDecodeError, TypeError):
                continue
            by_id[record.command_id] = record  # active file wins (last loaded)
    return list(by_id.values())


def retry_chain(command_id: str) -> list[FeedbackRecord]:
    """Walk parent_command_id pointers to reconstruct a retry chain."""
    records = {r.command_id: r for r in load_all()}
    chain: list[FeedbackRecord] = []
    cursor: str | None = command_id
    while cursor and cursor in records:
        chain.append(records[cursor])
        cursor = records[cursor].parent_command_id
    return list(reversed(chain))


def main() -> None:
    for path in HERE.glob("feedback_record.jsonl*"):
        path.unlink()

    ok = run_with_feedback(["python3", "-c", "print('hello')"], agent_note="expect hello")
    leak = run_with_feedback(
        ["python3", "-c",
         "print('Authorization: Bearer ya29.AbCdEf'); print('password=hunter2'); print('AKIAIOSFODNN7EXAMPLE')"],
        agent_note="expect redaction"
    )
    fail = run_with_feedback(["python3", "-c", "import sys; sys.exit(2)"], agent_note="first attempt; will retry")
    retry = run_with_feedback(
        ["python3", "-c", "print('recovered'); import sys; sys.exit(0)"],
        agent_note="retry after non-zero",
        parent_command_id=fail.command_id,
    )
    missing = run_with_feedback([shlex.split("does-not-exist")[0]], agent_note="probe missing binary")

    for label, rec in (("ok", ok), ("leak", leak), ("fail", fail), ("retry", retry), ("missing", missing)):
        print(f"{label}: cid={rec.command_id} parent={rec.parent_command_id or '-'} exit={rec.exit_code} "
              f"duration_ms={rec.duration_ms} redactions={rec.redactions or '-'}")
        if rec.error:
            print(f"  error: {rec.error}")
        if rec.stdout_tail and "REDACTED" in rec.stdout_tail:
            print(f"  stdout after redaction: {rec.stdout_tail!r}")

    chain = retry_chain(retry.command_id)
    print(f"\nretry chain for {retry.command_id}: {[r.command_id for r in chain]} (oldest -> newest)")
    print(f"{len(load_all())} records persisted in {RECORD.name}")


if __name__ == "__main__":
    main()
