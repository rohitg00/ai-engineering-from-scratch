# Team Configuration Review: Support Router

Status: ready for team review

## Scope

Owner: developer-platform. The reviewed job proposes patches from pull-request
diffs. It cannot merge, deploy, post comments, or read unrelated repositories.

## Capability Inventory

Read is limited to the isolated checkout. Edit is limited to the patch workspace.
The job may run `python3 -m unittest`; network and production credentials are
absent. A human owns merge and any external communication.

## Permission Modes

Interactive work begins in `default`. `acceptEdits` may pre-approve file edits,
but it does not authorize a push, deploy, network call, or external message.
Headless review uses `dontAsk` with narrow allow rules, while a deny rule blocks
credentials and publishing in every ordinary mode. `bypassPermissions` is not
allowed in this job.

## Context Recovery

The operator uses `/context` to inspect consumption and `/compact` with explicit
focus to continue the same task. `/clear` starts unrelated work with empty
conversation context. `/rewind` may restore tracked edits or conversation, but
Git and authoritative external state remain the recovery record.

## Autonomous Boundary

`/goal` is allowed only with a measurable acceptance condition, a turn budget
visible to the evaluator, and an externally enforced turn bound. `/loop` may
poll CI while the session stays open, but it cannot invent new work or widen
publishing authority. Both retain the current permission boundary.

## Worktree Ownership

Each parallel change starts with `claude --worktree <owner-task>`. One named
owner controls each branch and file surface. Worktree isolation prevents edit
collisions, not credential or network access, and its shared Git metadata is
still protected by repository policy.

## Hook Decision

`permission-request-decision.json` is an exit 0 structured response for the
`PermissionRequest` event. It denies external publishing with a message. A
command hook that uses exit 2 blocks through stderr instead; it never prints
JSON and exit 2 together.

## Scheduled Execution

An in-session `/loop` handles short polling. A cloud routine is reviewed as an
autonomous identity with only the required repositories and connectors. GitHub
Actions owns repository-governed cron jobs with minimal workflow permissions.

## Review Automation

As verified 2026-08-09, managed Code Review is a research preview for Team and
Enterprise plans. It may report inline findings but does not approve or block
the pull request. Repository automation uses
`anthropics/claude-code-action@v1` with a pinned prompt, explicit tools, a turn
limit, and the protected merge path.

## Allowed Fixture

The allow fixture reads `src/router.py`, edits its paired test, runs the focused
suite, and emits a patch artifact with exact test evidence. `acceptEdits` may
speed those local edits but grants no public action.

## Denied Fixture

The deny fixture attempts to read `.env`, push a protected branch, and call an
unapproved server. Pre-action policy blocks all three before execution.

## Version Evidence

Claude Code configuration version `team-review-1.2` and the review procedure are
pinned in the repository. The model alias, plugin versions, and test command are
recorded in the artifact metadata for every run.

## Rollback

Rollback disables the job, discards its isolated patch, restores configuration
`team-review-1.1`, and reruns the allow and deny fixtures before re-enablement.
