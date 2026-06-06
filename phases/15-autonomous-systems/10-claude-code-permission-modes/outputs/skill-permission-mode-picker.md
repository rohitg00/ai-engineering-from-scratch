---
name: permission-mode-picker
description: Match a Claude Code task to the correct permission mode, budget caps, and required isolation before starting a run.
version: 1.0.0
phase: 15
lesson: 10
tags: [claude-code, permission-modes, auto-mode, budgets, isolation]
---

Given a proposed Claude Code task, pick the permission mode, set budgets, and specify the minimum isolation required before the agent is allowed to start.

Produce:

1. **Task profile.** One sentence on what the task does, one sentence on the blast radius if it goes wrong.
2. **Mode recommendation.** One of: `plan`, `default`, `acceptEdits`, `acceptExec`, `autoMode`, `yolo`, `bypassPermissions`. Justify with a single sentence referencing the blast radius.
3. **Budget numbers.** Concrete values for `max_turns`, `max_budget_usd`, and any per-tool caps. For unattended runs over an hour, specify a dollar cap equal to or below what you would pay for a human mistake you cannot roll back.
4. **Isolation requirements.** File-system scope (project directory only, scratch directory, ephemeral container). Network policy (no egress, allowlist only, full). Credential surface (none, scoped token, broad token). For `bypassPermissions` or `yolo`, the run must be inside an ephemeral container with no production credentials mounted.
5. **Trajectory audit plan.** How will a human review the trajectory after the run? Required for `autoMode`, `yolo`, and anything over a 30-minute horizon.

Hard rejects:
- `bypassPermissions` against a repository with uncommitted changes.
- `autoMode` with no budget cap.
- Any mode above `acceptEdits` with broad credentials in the environment (AWS, GCP, GitHub PAT with repo scope).
- Unattended runs longer than one hour with no trajectory audit scheduled.
- Claims that the Auto Mode classifier alone is sufficient for a novel task distribution.

Refusal rules:
- If the user cannot name the blast radius of a failure, refuse and require an explicit worst-case sentence before starting.
- If the user requests `autoMode` in a workspace with production database credentials reachable, refuse and require scoped credentials or an ephemeral container first.
- If the proposed budget cap exceeds what the user is willing to lose on a bad run, refuse and require a lower cap.

Output format:

Return a one-page run card with:
- **Task summary** (one sentence)
- **Blast radius** (one sentence, worst case)
- **Mode** (explicit)
- **Budgets** (`max_turns`, `max_budget_usd`, per-tool caps)
- **Isolation** (fs scope, network policy, credential surface)
- **Audit plan** (who reviews the trajectory, when, against what rubric)
