# Mission - Verification Gates

## 目標
scope report、rule report、feedback log、diff に対する pure deterministic function として `verify(task_id, artifacts)` を実装し、task close-out ごとに1つの `verification_report.json` を emit する。

## Inputs
- `scope_report.json`、`rule_report.json`、`feedback_record.jsonl`、diff 用の stub loaders
- check table: acceptance ran、acceptance exited zero、scope clean、`null` exits なし、すべての block-severity rules pass

## 成果物
- pure な `verify(task_id, artifacts) -> VerdictReport`
- check ごとの result と最終 pass/fail を表示する printer
- disk に書かれる3つの demo scenarios: clean pass、scope creep、missing acceptance

## Acceptance
- `python3 code/main.py` が exit zero になる
- clean-pass scenario は `passed: true`、他の2つは `passed: false` を report する
- 各 scenario が `outputs/verification/` 配下に別々の `verification_report.json` を書く

## 対象外
- LLM-as-judge logic。gate は deterministic のままにし、qualitative judgment は lesson 39 の reviewer に任せる。
- Signed override audit logs。exercise prompts が gate をその方向に拡張する。

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-verification-gate.md` - extracted skill
