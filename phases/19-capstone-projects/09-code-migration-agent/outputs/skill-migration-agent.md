---
name: migration-agent
description: Build a repo-level code migration agent that combines deterministic recipes with an agent fallback loop, passes MigrationBench, and publishes a failure taxonomy.
version: 1.0.0
phase: 19
lesson: 09
tags: [capstone, code-migration, openrewrite, libcst, migrationbench, agent, sandbox]
---

Given a Java 8 or Python 2 repo, produce a migrated branch (to Java 17 or Python 3.12) with a green test suite and minimal coverage regression. Evaluate across the 50-repo MigrationBench subset.

Build plan:

1. Deterministic pass: OpenRewrite (Java) or libcst (Python) runs mechanical rewrites first. Commit as the "recipe" commit with a clean diff.
2. Daytona sandbox: target runtime preinstalled; per-branch build; read-only source mount.
3. Agent loop: LangGraph or OpenAI Agents SDK over Claude Opus 4.7 + GPT-5.4-Codex. Tools: `run_build`, `read_file`, `edit_file`, `run_test`, `git_diff`. Classify failure (dep, syntax, test, build-tool), apply targeted fix, rerun.
4. Budget caps: 30 min, $8, 20 turns. Breaching any halts and files under `budget_exhausted` with the current diff.
5. Test + coverage gate: build green then tests green; coverage must not drop more than 2%.
6. PR open with recipe-commit + agent commits + summary comment.
7. Failure taxonomy: per-repo tag from `{dep_upgrade_required, build_tool_drift, custom_annotation, test_flake, syntax_edge_case, budget_exhausted, coverage_regression}`.
8. 50-repo run across MigrationBench; publish per-class pass rate, cost-per-repo, and coverage-preservation; compare vs deterministic-only baseline.

Assessment rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | MigrationBench pass rate | 50-repo subset pass@1 |
| 20 | Test-coverage preservation | Mean coverage delta vs base branch |
| 20 | Cost per migrated repo | Mean $/repo on passing runs |
| 20 | Agent / deterministic-tool integration | Fraction of fixes handled by OpenRewrite vs agent |
| 15 | Failure analysis write-up | Taxonomy completeness with exemplars |

Hard rejects:

- Pipelines that skip the deterministic pass. OpenRewrite handles the mechanical 70-80% cheaper and more reliably than any agent.
- Coverage regressions above 2% treated as passing.
- PRs that bundle mechanical and agent-authored changes into one commit. Must separate.
- Reporting pass rate without a matched deterministic-only baseline on the same 50 repos.

Refusal rules:

- Refuse to force-push a migrated branch over the base. Always a new branch + PR.
- Refuse to open a PR whose CI has not flipped green in the sandbox.
- Refuse to run on corporate repos without explicit license to modify.

Output: a repo containing the two-layer migration pipeline, the 50-repo MigrationBench run logs, the failure taxonomy dashboard, a matched deterministic-only baseline run, and a write-up on the three most common failure classes and the recipe change that would eliminate each.
