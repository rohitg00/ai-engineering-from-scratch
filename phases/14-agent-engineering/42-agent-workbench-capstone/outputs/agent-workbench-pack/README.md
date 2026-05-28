# Agent Workbench Pack

reliable な agent work を必要とする任意の repo 向けの drop-in workbench。

## 得られるもの

- pack の残りへ案内する短い router としての `AGENTS.md`。
- rules、reliability policy、handoff protocol、reviewer rubric を含む `docs/`。
- state、board、scope contract 用の JSON Schemas を含む `schemas/`。
- init、feedback runner、verification gate、handoff generator を含む `scripts/`。
- idempotent installer としての `bin/install.sh`。

## Quickstart

```
bin/install.sh
$EDITOR task_board.json
python3 scripts/init_agent.py
```

## Versioning

`VERSION` file が contract です。major bump には state migration が必要です。
