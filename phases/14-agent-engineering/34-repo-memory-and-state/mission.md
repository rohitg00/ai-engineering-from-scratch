# Mission - Repo Memory と Durable State

## Goal
`agent_state.json` と `task_board.json` の JSON Schemas を作成し、load、validate、mutate、atomic write を行う `StateManager` を構築し、2 turns にまたがる round-trip を証明する。

## Inputs
- lesson 32 の three-file workbench shape
- required、type、enum、pattern、items を扱う stdlib-only validator

## 成果物
- code の横に置く `agent_state.schema.json` と `task_board.schema.json`
- temp-and-rename writes を持つ `StateManager.load`, `StateManager.update`, `StateManager.commit`
- 2 turns にわたって state を mutate し、clean に reload する demo run

## Acceptance
- `python3 code/main.py` が exit zero
- bad write (missing required field, bad enum) は persisted されず拒否される
- run 後の `workdir/agent_state.json` が schema に対して validate される

## Out of scope
- SQLite または external storage backends。local file がこの lesson。
- LangGraph checkpointers、Letta memory blocks。同じ考えだが別 storage なのでここでは対象外。

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-state-schema.md` - extracted skill
