---
name: issue-to-pr
description: Build an async GitHub issue-to-PR agent that runs in a cloud sandbox, reproduces the build, verifies tests, and opens review-ready PRs within strict per-repo budgets.
version: 1.0.0
phase: 19
lesson: 16
tags: [capstone, async-agent, github, fargate, daytona, swe-bench, budget, safety]
---

Given a GitHub repository with issues labeled `@agent fix this`, ship a self-hosted cloud agent that turns each labeled issue into a review-ready PR with scoped credentials and bounded cost.

Build plan:

1. GitHub App with fine-grained token: issues rw, PRs write, contents rw, workflows read. No force-push. Branch protection on main prevents direct writes.
2. Webhook receiver (Lambda or Fly.io) filters label / PR-comment events and enqueues to SQS.
3. Dispatcher enforces per-repo per-day $ and PR-count ceilings; spins up an ECS Fargate task per allowed job.
4. Environment inference: detect language + package manager + runtime from repo contents. Synthesize a Dockerfile on the fly if absent.
5. Daytona or E2B sandbox per task. Clone repo into a fresh `git worktree` + agent branch.
6. Agent loop (mini-swe-agent or SWE-agent v2 over Claude Opus 4.7 or GPT-5.4-Codex). Tools: ripgrep, tree-sitter repo-map, read_file, edit_file, run_tests, git. Caps: $20, 30 turns, 30 min.
7. Verify: full CI in-sandbox; coverage delta via jacoco / coverage.py; label `needs-review` if delta < -2%; halt if CI red.
8. PR open via GitHub API with rationale, diff summary, trace URL, cost, turns.
9. Observability: Langfuse trace per PR; log scrub for secrets; per-repo budget dashboard.
10. Eval on 30 seeded internal issues; compare vs Cursor Background Agents and AWS Remote SWE Agents on a three-issue shared subset.

Assessment rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | Pass rate on 30 issues | End-to-end success (CI green + coverage OK) |
| 20 | PR quality | Diff size, coverage delta, style conformance |
| 20 | Cost and latency per resolved issue | $/PR and wall-clock/PR |
| 20 | Safety | Scoped token, per-repo budget, no force-push, credential hygiene |
| 15 | Operator UX | Rationale comments, retry affordance, @-mention follow-up |

Hard rejects:

- Any agent that can force-push. Hard exclusion.
- Dispatchers that skip budget checks. Runaway loops are the classic failure.
- PRs opened without the full CI having passed in-sandbox.
- Trace archives containing unredacted tokens or PII.

Refusal rules:

- Refuse to install without branch protection on main.
- Refuse to run without a per-repo daily budget (dollars and PR count).
- Refuse to retry failed runs automatically; all retries require a human label reapplication.

Output: a repo containing the GitHub App, the webhook receiver, the dispatcher + budget ledger, the Fargate task definition, the sandbox lifecycle manager, the mini-swe-agent loop, the 30-issue eval run, a side-by-side comparison against Cursor Background Agents and AWS Remote SWE Agents, and a write-up naming the top three build-inference failures and the Dockerfile-synthesis change that reduced each.
