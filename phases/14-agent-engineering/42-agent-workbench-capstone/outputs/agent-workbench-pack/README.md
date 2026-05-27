# Agent Workbench Pack

Drop-in workbench for any repo that wants reliable agent work.

## What you get

- `AGENTS.md` short router into the rest of the pack.
- `docs/` rules, reliability policy, handoff protocol, reviewer rubric.
- `schemas/` JSON Schemas for state, board, and scope contract.
- `scripts/` init, feedback runner, verification gate, handoff generator.
- `bin/install.sh` idempotent installer.

## Quickstart

```
bin/install.sh
$EDITOR task_board.json
python3 scripts/init_agent.py
```

## Versioning

The `VERSION` file is the contract. Major bumps require a state migration.
