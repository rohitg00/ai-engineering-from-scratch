# Mission - Repo Memory and Durable State

## Goal
Author JSON Schemas for `agent_state.json` and `task_board.json`, build a `StateManager` that loads, validates, mutates, and writes atomically, and prove the round-trip across two turns.

## Inputs
- The three-file workbench shape from lesson 32
- A stdlib-only validator covering required, type, enum, pattern, and items

## Deliverables
- `agent_state.schema.json` and `task_board.schema.json` next to the code
- `StateManager.load`, `StateManager.update`, `StateManager.commit` with temp-and-rename writes
- A demo run that mutates state across two turns and reloads cleanly

## Acceptance
- `python3 code/main.py` exits zero
- A bad write (missing required field, bad enum) is refused, not persisted
- `workdir/agent_state.json` after the run validates against the schema

## Out of scope
- SQLite or external storage backends. The local file is the lesson.
- LangGraph checkpointers, Letta memory blocks. Same idea, different storage; out of scope here.

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-state-schema.md` - extracted skill
