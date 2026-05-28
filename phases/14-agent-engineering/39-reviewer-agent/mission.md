# Mission - Reviewer Agent: Builder と Marker を分ける

## 目標
builder の artifacts を read-only で読み、5つの dimensions を合計10点で採点し、pass、soft_fail、hard_fail の verdict を持つ `review_report.json` を emit する reviewer loop を構築する。

## Inputs
- prior lessons からの diff、state、feedback、verification verdict をまとめる `ReviewerInputs`
- Rubric dimensions: problem fit、scope discipline、assumptions、verification quality、handoff readiness

## 成果物
- dimension ごとの scoring function (lesson 用の stub-grade、deterministic)
- 5つの scores、total、verdict を持つ `review_report.json` writer
- 2つの demo cases: clean change と「right tests, wrong problem」change

## Acceptance
- `python3 code/main.py` が exit zero になる
- clean change は 7 点以上で verdict `pass`
- wrong-problem change は少なくとも1つの dimension で落ち込み、total が 5 未満になって verdict が `hard_fail` に変わる

## 対象外
- 実際の LLM calls。lesson では各 dimension を stub 化し、skill が後で model に差し替える。
- diff の編集。reviewer は読み、採点し、report する。patch は次 turn の builder の仕事。

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-reviewer-agent.md` - extracted skill
