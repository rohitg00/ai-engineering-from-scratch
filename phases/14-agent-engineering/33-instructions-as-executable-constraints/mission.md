# Mission - 実行可能な制約としての Agent Instructions

## Goal
prose instructions を 5 categories の machine-checkable rules に変換し、reviewer が採点できる rule report を出力する。

## Inputs
- heading ごとに 1 rule を持つ `docs/agent-rules.md`。各 rule は slug、category、description、`check` field を持つ
- 意図的に 2 つの rules に違反する demo agent run

## 成果物
- `agent-rules.md` を dataclass に load する parser
- 参照される `check` ごとに 1 つの `rule_checker.py` style function
- rule ごとの pass/fail と aggregate severity を持つ `rule_report.json`

## Acceptance
- `python3 code/main.py` が exit zero
- 出力が parsed rule set、run trace、rule ごとの pass/fail を表示する
- `rule_report.json` が 2 つの intentional violations を捕捉する

## Out of scope
- checker を CI に結線すること。lesson は written report で終わる。
- Framework guardrails (OpenAI SDK, LangGraph interrupts)。rule set はそれらが実装する human-readable contract。

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-rule-set-builder.md` - extracted skill
