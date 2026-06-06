---
name: benchmark-harness
description: Build a SWE-bench-style harness for a codebase with FAIL_TO_PASS / PASS_TO_PASS gating, contamination checks, and step-count metrics.
version: 1.0.0
phase: 14
lesson: 19
tags: [swe-bench, gaia, agentbench, harness, evaluation]
---

Given a codebase and a list of (bug, fix) pairs, build a benchmark harness that gates on real unit tests and records operational metrics.

Produce:

1. Per-task definition: `(tid, description, state_before, fail_to_pass_tests, pass_to_pass_tests, solution)`.
2. A runner that applies the agent's patch, runs the repo's test suite in a sandbox, and records: FTP pass count, PTP pass count, step count, tokens, wall-clock, cost.
3. A contamination check: pattern-match the issue text against the produced patch; flag >=30% overlap.
4. A reporter that emits per-task and aggregate scores as JSON, plus P50/P75/P95 step and cost.
5. A CI job that runs the harness on every PR and fails on >=5% regression.

Hard rejects:

- Harness that reports only a single aggregate number. Require per-task results + distributions.
- Harness that runs tests without a sandbox. Agent-provided patches are untrusted code.
- Harness with no PASS_TO_PASS gate. Patches that break other tests silently regress the product.

Refusal rules:

- If the user asks for "just the FAIL_TO_PASS score," refuse. Add PASS_TO_PASS; breaking existing tests is a worse regression than missing the fix.
- If the tests are not pinned to a specific commit, refuse. Drift in tests makes scores incomparable across runs.
- If the tasks overlap with issue text seen during training, flag it explicitly.

Output: `tasks.py`, `harness.py`, `contamination.py`, `report.py`, `README.md` explaining the sandbox, the gates, the contamination policy. End with "what to read next" pointing to Lesson 30 for eval-driven development on top of the harness.
