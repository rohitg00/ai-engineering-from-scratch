# Mission - Verification Gates

## Goal
Implement `verify(task_id, artifacts)` as a pure deterministic function over scope report, rule report, feedback log, and diff, emitting one `verification_report.json` per task close-out.

## Inputs
- Stub loaders for `scope_report.json`, `rule_report.json`, `feedback_record.jsonl`, and the diff
- The check table: acceptance ran, acceptance exited zero, scope clean, no `null` exits, all block-severity rules pass

## Deliverables
- A pure `verify(task_id, artifacts) -> VerdictReport`
- A printer that shows per-check results and the final pass/fail
- Three demo scenarios written to disk: clean pass, scope creep, missing acceptance

## Acceptance
- `python3 code/main.py` exits zero
- The clean-pass scenario reports `passed: true`; the other two report `passed: false`
- Each scenario writes a separate `verification_report.json` under `outputs/verification/`

## Out of scope
- LLM-as-judge logic. The gate stays deterministic; qualitative judgment belongs to the reviewer in lesson 39.
- Signed override audit logs. The exercise prompts extend the gate that way.

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-verification-gate.md` - extracted skill
