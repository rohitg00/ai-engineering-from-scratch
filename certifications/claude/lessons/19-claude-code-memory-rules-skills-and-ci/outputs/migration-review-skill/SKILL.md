---
name: migration-review
description: Review database migration files when a change adds or modifies paths under migrations/. Use it before merge to collect forward, rollback, locking, and data-safety evidence.
allowed-tools: Read Grep Glob Bash(python3 ${CLAUDE_SKILL_DIR}/scripts/check_scope.py *)
---

# Migration Review

Review only the migration files named in `$ARGUMENTS` and the code needed to
verify their compatibility. This Skill does not authorize applying a migration.

1. Run `python3 ${CLAUDE_SKILL_DIR}/scripts/check_scope.py $ARGUMENTS`.
2. Stop if the checker rejects any path outside `migrations/`.
3. Read [references/review-checklist.md](references/review-checklist.md).
4. Inspect each accepted file and its schema assumptions.
5. Report forward behavior, rollback limits, lock risk, data-volume risk,
   verification evidence, and unresolved blockers.

Return these headings: `Scope`, `Evidence`, `Risks`, `Rollback`, `Blockers`, and
`Decision`. Use `Decision: blocked` whenever required evidence is missing.

The bundled checker is [scripts/check_scope.py](scripts/check_scope.py). The
`allowed-tools` entry pre-approves only that command for the invocation turn; it
does not remove other tools or replace project permission rules.
