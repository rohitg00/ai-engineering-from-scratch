# Mission - The Workbench on a Real Repo

## 目標
同じ sample app に対して `/signup` validation task を prompt-only pipeline と workbench-guided pipeline の両方で実行し、skeptic が読める before/after comparison report を emit する。

## Inputs
- validation なしの `app.py`、happy-path test が1つある `test_app.py`、forbidden-zone bait としての `README.md` と `scripts/release.sh` を持つ `sample_app/`
- 両 pipeline は fully scripted。real LLM calls なし

## 成果物
- 同じ fixture に対して両 pipeline を orchestrate する `code/main.py`
- 5つの outcomes table を持つ `before-after-report.md`
- downstream charting 用の `comparison.json`

## Acceptance
- `python3 code/main.py` が exit zero になる
- report が5つすべての outcomes を測定する: tests actually ran、acceptance met、files outside scope、handoff quality、reviewer total
- workbench pipeline が5つのうち少なくとも4つで prompt-only pipeline を上回る

## 対象外
- real LLM の接続。pipelines は reproducibility のため scripted。
- model tuning。comparison は構造上 model を一定に保つ。

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-workbench-benchmark.md` - extracted skill
