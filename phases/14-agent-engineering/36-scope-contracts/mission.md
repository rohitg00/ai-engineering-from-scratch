# Mission - Scope Contracts and Task Boundaries

## Goal
Write a per-task `scope_contract.json` and a glob-aware checker that compares the agent's diff against the contract and flags any forbidden or off-scope writes.

## Inputs
- A task description with allowed globs, forbidden globs, acceptance commands, rollback paragraph, approvals required
- Two demo runs: one that stays in scope, one that creeps

## Deliverables
- `scope_contract.json` schema validator (subset of JSON Schema, glob arrays)
- A diff parser that produces a `RunSummary` from touched files plus commands run
- `scope_check(contract, run) -> (violations, in_scope, off_scope)`
- `scope_report.json` saved next to the script

## Acceptance
- `python3 code/main.py` exits zero
- The in-scope run reports zero violations
- The creeping run reports the exact off-scope files and the reason for each

## Out of scope
- Time budgets, network egress allowlists. The lesson ships file globs; the exercise prompts extend it.
- Wiring into a runtime interrupt. The lesson exits at the report.

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-scope-contract.md` - extracted skill
