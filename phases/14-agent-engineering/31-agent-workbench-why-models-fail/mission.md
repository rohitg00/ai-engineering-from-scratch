# Mission - Agent Workbench: 高性能モデルがそれでも失敗する理由

## Goal
同じ小さな repo task を、prompt-only と 7 つの workbench surface を結線した状態で 2 回実行し、欠けていた surface とそれが引き起こした症状を対応付ける failure-mode report を出力する。

## Inputs
- stub agent と、validation 対象の小さな FastAPI 風 handler
- 7 つの surface list (instructions, state, scope, feedback, verification, review, handoff)

## 成果物
- 両方の pipeline を back to back で実行する `code/main.py`
- prompt-only run を要約する `failure_modes.json`
- workbench run の one-line verdict

## Acceptance
- `python3 code/main.py` が exit zero
- 出力に 2 つの run の side-by-side log が表示される
- `failure_modes.json` が、欠けた各 surface と対応する symptom を列挙する

## Out of scope
- 実モデルの呼び出し。stub は意図的に rule-based。
- 1 つの surface を深掘りして構築すること。それは次の 11 lessons の範囲。

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-workbench-audit.md` - extracted skill
