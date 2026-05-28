# Mission - Capstone: 再利用可能な Agent Workbench Pack を出荷する

## 目標
prior 11 lessons を、任意の target repo に idempotent に配置する installer 付きの versioned `outputs/agent-workbench-pack/` directory に組み立てる。

## Inputs
- lessons 32 through 40 の schemas、scripts、docs
- pack layout: `AGENTS.md`、`docs/`、`schemas/`、`scripts/`、`bin/`、`README.md`、`VERSION`

## 成果物
- full layout が populated された `outputs/agent-workbench-pack/`
- `--force` なしでは overwrite を拒否する `bin/install.sh` (または `bin/install.py`)
- 何を入れ何を出すかを説明する `VERSION` file と `README.md`

## Acceptance
- `python3 code/main.py` が exit zero になり pack tree を表示する
- assembler の再実行が idempotent
- fresh target への `bin/install.sh` が working workbench を残す: state、board、rules、scope、init、runner、gate、reviewer、handoff がすべて配置される

## 対象外
- per-project task content。tasks は pack ではなく target repo の board に属する。
- Vendor SDK calls。pack は設計上 framework-agnostic。

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-workbench-pack.md` - extracted skill
