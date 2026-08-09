# Configuration Scope Audit: Python Service

## Instruction Hierarchy

The root guide contains purpose, layout, canonical commands, security boundary,
and links. API, migration, and documentation guidance remain at path scope.

## Path Rule Fixtures

The API allow fixture `src/api/orders.py` loads contract and authorization
guidance. The deny fixture `docs/orders.md` does not. Migration fixtures prove
append-only guidance loads only under `migrations/**`.

## Skill and Command

The migration-review Skill packages reusable evidence gathering. The legacy
explicit ADR command remains compatible, but new multi-step procedures use a
Skill so supporting files load on demand. Neither grants authorization.

## Skill Package

`migration-review-skill/SKILL.md` defines a trigger description and a narrow
`allowed-tools` grant. It routes detailed evidence to
`references/review-checklist.md` and validates every argument with
`scripts/check_scope.py`. The grant pre-approves that bundled checker for the
invocation turn; it does not restrict all other tools or override deny rules.

## Subagent Contract

`/agents` registers a migration auditor with read-only tools, `maxTurns: 10`,
and `isolation: worktree` when edits are requested. Its response contains
`status`, `evidence`, `blockers`, and `next_step`. It stops at the turn box and
reports an obstacle instead of claiming success or widening scope.

## Plugin Distribution

Project Skills and agents are committed under `.claude/`. Shared plugin sources
and defaults live in `.claude/settings.json` through
`extraKnownMarketplaces` and `enabledPlugins`, with folder trust and review.
Organization managed settings restrict allowed marketplaces and non-negotiable
permissions. Versions and rollback are recorded before rollout.

## Hooks

A deterministic pre-write hook blocks paths outside declared scope. A post-edit
hook formats only changed files. A pre-command hook blocks secret printing and
destructive operations. A `PreToolUse` structured decision uses exit 0 with JSON;
an exit 2 hook writes its blocking reason to stderr and prints no JSON. A
`PermissionRequest` hook uses its own nested decision shape.

## Headless CI

CI starts from a fresh checkout with versioned project configuration, read-only
review tools, bounded runtime, structured findings, and separate deterministic
tests. It never inherits an interactive session. As verified 2026-08-09,
managed Code Review is a Team and Enterprise research preview; it reports
findings without replacing gates. Repository automation uses
`anthropics/claude-code-action@v1` with explicit workflow permissions and tools.

## Remediation

Stable finding IDs, original evidence, current diff, tests, and acceptance rules
are passed to the remediation review. Local preferences are excluded.
