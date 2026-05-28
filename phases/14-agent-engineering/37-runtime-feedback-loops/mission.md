# Mission - Runtime Feedback Loops

## 目標
`subprocess.run` を wrap し、stdout、stderr、exit code、duration を取り込み、output を決定的に切り詰め、次の turn と verification gate の両方が読む JSONL record を append する `run_with_feedback` を構築する。

## Inputs
- runner を試す3つの demo command: success、failure、slow
- Token budget: deterministic head plus tail と `...truncated N lines...` marker

## 成果物
- `feedback_record.jsonl` に書き込む `run_with_feedback(command, agent_note)`
- JSONL を Python list に stream する loader
- command ごとの最後の record を表示する printer

## Acceptance
- `python3 code/main.py` が exit zero になる
- `feedback_record.jsonl` が再実行をまたいで command ごとに1 record を蓄積する
- `exit_code: null` の command を loop が successful と mark できない

## 対象外
- Telemetry pipelines (OTel, Langfuse)。Feedback は次の turn のためのもの、telemetry は operator のためのもの。
- Redaction passes と rotation policy。lesson exercise prompts がそれらを扱う。

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-feedback-runner.md` - extracted skill
