# Mission - Multi-Session Handoff

## Goal
Generate `handoff.md` and `handoff.json` from workbench artifacts at session end so the next session is productive in the first minute. Both forms carry the same seven fields; the JSON wins on disagreement.

## Inputs
- `agent_state.json`, `verification_report.json`, `review_report.json`, `feedback_record.jsonl` from earlier lessons
- The seven fields: summary, changed_files, commands_run, failed_attempts, open_risks, next_action, verdict_pointer

## Deliverables
- A `WorkbenchSnapshot` loader bundling the four artifacts
- `generate_handoff(snapshot) -> (markdown, payload)`
- A feedback filter that picks the last K records plus every non-zero exit
- `handoff.md` and `handoff.json` written next to the script

## Acceptance
- `python3 code/main.py` exits zero
- Both files carry all seven fields and a non-empty `next_action`
- Re-running the script with the same inputs produces an identical packet

## Out of scope
- Compaction strategies (Codex compact endpoint, Claude Code five-stage). Handoff closes a session; compaction extends one.
- PR templating. The markdown is reusable as a PR body but the lesson stops at the file.

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-handoff-generator.md` - extracted skill
