# Mission - Runtime Feedback Loops

## Goal
Build `run_with_feedback` that wraps `subprocess.run`, captures stdout, stderr, exit code, and duration, truncates output deterministically, and appends a JSONL record the next turn and the verification gate both read.

## Inputs
- Three demo commands to exercise the runner: one success, one failure, one slow
- Token budget: deterministic head plus tail with a `...truncated N lines...` marker

## Deliverables
- `run_with_feedback(command, agent_note)` writing to `feedback_record.jsonl`
- A loader that streams the JSONL into a Python list
- A printer that shows the last record per command

## Acceptance
- `python3 code/main.py` exits zero
- `feedback_record.jsonl` accumulates one record per command across re-runs
- A command with `exit_code: null` cannot be marked successful by the loop

## Out of scope
- Telemetry pipelines (OTel, Langfuse). Feedback is for the next turn; telemetry is for the operator.
- Redaction passes and rotation policy. Lesson exercise prompts cover those.

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-feedback-runner.md` - extracted skill
