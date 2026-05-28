# Mission - Multi-Session Handoff

## 目標
session end に workbench artifacts から `handoff.md` と `handoff.json` を生成し、次 session が最初の1分から productive になるようにする。両形式は同じ7つの fields を持ち、食い違えば JSON が勝つ。

## Inputs
- earlier lessons の `agent_state.json`、`verification_report.json`、`review_report.json`、`feedback_record.jsonl`
- 7つの fields: summary、changed_files、commands_run、failed_attempts、open_risks、next_action、verdict_pointer

## 成果物
- 4つの artifacts を bundle する `WorkbenchSnapshot` loader
- `generate_handoff(snapshot) -> (markdown, payload)`
- 最後の K records とすべての non-zero exit を選ぶ feedback filter
- script の隣に書かれる `handoff.md` と `handoff.json`

## Acceptance
- `python3 code/main.py` が exit zero になる
- 両 file が7つすべての fields と non-empty な `next_action` を持つ
- 同じ inputs で script を再実行すると同一の packet を生成する

## 対象外
- Compaction strategies (Codex compact endpoint、Claude Code five-stage)。handoff は session を閉じ、compaction は session を伸ばす。
- PR templating。markdown は PR body として再利用できるが、lesson は file までで止める。

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-handoff-generator.md` - extracted skill
