# Mission - Scope Contracts と Task Boundaries

## Goal
per-task `scope_contract.json` と glob-aware checker を書き、agent の diff を contract と比較して forbidden または off-scope writes を flag する。

## Inputs
- allowed globs、forbidden globs、acceptance commands、rollback paragraph、approvals required を持つ task description
- 2 つの demo runs: scope 内に留まるものと creep するもの

## 成果物
- `scope_contract.json` schema validator (JSON Schema subset, glob arrays)
- touched files と commands run から `RunSummary` を作る diff parser
- `scope_check(contract, run) -> (violations, in_scope, off_scope)`
- script の横に保存される `scope_report.json`

## Acceptance
- `python3 code/main.py` が exit zero
- in-scope run が zero violations を報告する
- creeping run が exact off-scope files と各 reason を報告する

## Out of scope
- Time budgets、network egress allowlists。lesson は file globs を ship し、exercises が拡張する。
- runtime interrupt への wiring。lesson は report で終わる。

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-scope-contract.md` - extracted skill
