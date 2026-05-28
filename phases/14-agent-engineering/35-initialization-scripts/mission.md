# Mission - Agents のための Initialization Scripts

## Goal
runtime、dependencies、test command、env vars、state freshness を probe する `init_agent.py` を作り、`init_report.json` を書き、block-severity probe が失敗したら session を loud に halt する。

## Inputs
- `requirements.txt` (または equivalent)、test command、lesson 34 の workbench state file を持つ repo
- lesson の probe table (runtime, deps, paths, env, state freshness, last-known-good commit)

## 成果物
- probe ごとに `(name, status, detail)` を返す 1 function を持つ `init_agent.py`
- full probe set と timestamp を運ぶ `init_report.json`
- block-severity probe failure があれば non-zero exit

## Acceptance
- happy path で `python3 code/main.py` が exit zero
- 連続 2 回実行しても timestamp 以外 no-op
- simulated missing env var probe が report に surface し、exit code を反転させる

## Out of scope
- missing dependencies の auto-install。script は halt して surface し、人間が直す。
- probe から LLM を呼ぶこと。probes は deterministic plumbing に留める。

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-init-script.md` - extracted skill
