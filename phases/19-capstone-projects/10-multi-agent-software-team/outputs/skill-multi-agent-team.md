---
name: multi-agent-team
description: Build a multi-agent software team with architect, parallel coders, reviewer, and tester; measure against SWE-bench Pro and produce a handoff post-mortem.
version: 1.0.0
phase: 19
lesson: 10
tags: [capstone, multi-agent, swe-bench, langgraph, a2a, worktree, roles]
---

Given a GitHub issue URL and a parallelism level, deploy a multi-agent software team that produces a merge-ready PR. Evaluate on 50 SWE-bench Pro issues and publish a handoff-failure histogram.

Build plan:

1. Task board: file-backed (or Redis) JSONL store of typed messages. Message kinds: plan_request, subtask, diff_ready, review_needed, review_feedback, approved, test_needed, test_passed, test_failed, replan_needed.
2. Architect (Opus 4.7): reads the issue, writes a plan, emits a DAG of subtasks with explicit interfaces (files touched, public functions, test impact).
3. N coders (Sonnet 4.7): each claims a subtask, spawns a fresh `git worktree add` + Daytona sandbox, implements independently.
4. Merge coordinator: three-way merge; LLM-mediated conflict resolution only on file-level overlap.
5. Reviewer (GPT-5.4): reads merged diff; cannot approve diffs it authored; emits approved or review_feedback routed to the relevant coder.
6. Tester (Gemini 2.5 Pro): runs the test suite in a clean sandbox; emits test_passed or test_failed with artifacts.
7. Handoff accounting: every cross-role message becomes a Langfuse span with payload size and model. Compute token amplification = total_tokens / single_agent_baseline_tokens.
8. Inject an obvious bug probe (10% of runs) to measure reviewer false-approve rate.
9. Run on 50 SWE-bench Pro issues; publish pass@1, wall-clock vs single-agent baseline, per-role token breakdown, handoff-failure histogram.

Assessment rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | 50-issue subset pass@1 |
| 20 | Parallel speedup | Wall-clock vs single-agent baseline |
| 20 | Review quality | False-approval rate on injected-bug probe |
| 20 | Token efficiency | Total tokens per solved issue vs single-agent |
| 15 | Coordination engineering | Merge-conflict resolution, handoff-failure histogram |

Hard rejects:

- Reviewer that can approve diffs it authored or proposed. Hard constraint.
- Reports without a matched single-agent baseline run. Multi-agent has to win *per dollar*, not just pass@1.
- Task boards where messages are free-form strings instead of typed A2A messages.
- Merge coordinators that silently drop conflicting diffs rather than routing back for replan.

Refusal rules:

- Refuse to run without budget ceilings per role (token + dollar).
- Refuse to open a PR whose tester has not verified in a clean sandbox.
- Refuse to scale coders beyond 8 in a single run. Coordination overhead dominates above that.

Output: a repo containing the task board + role workers, the 50-issue SWE-bench Pro run log, a matched single-agent baseline run, a Langfuse dashboard with role-tagged spans and per-role token breakdowns, an injected-bug probe report, and a post-mortem naming the three handoffs that broke most often and the message-schema or prompt change that reduced each.
