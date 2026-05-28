---
name: migration-agent
description: deterministic recipe と agent fallback loop を組み合わせ、MigrationBench を通過し、failure taxonomy を公開する repo-level code migration agent を構築する。
version: 1.0.0
phase: 19
lesson: 09
tags: [capstone, code-migration, openrewrite, libcst, migrationbench, agent, sandbox]
---

Java 8 または Python 2 repo を受け取り、test suite が green で coverage regression が最小の migrated branch (Java 17 または Python 3.12) を生成する。50-repo MigrationBench subset 全体で評価する。

構築計画:

1. deterministic pass: OpenRewrite (Java) または libcst (Python) が mechanical rewrites を先に実行する。clean diff を持つ "recipe" commit として commit する。
2. Daytona sandbox: target runtime を事前 install し、per-branch build と read-only source mount を使う。
3. agent loop: Claude Opus 4.7 + GPT-5.4-Codex 上の LangGraph または OpenAI Agents SDK。tools: `run_build`, `read_file`, `edit_file`, `run_test`, `git_diff`。failure (dep, syntax, test, build-tool) を classify し、targeted fix を適用して rerun する。
4. budget caps: 30 min、$8、20 turns。どれかを超えたら halt し、current diff とともに `budget_exhausted` に分類する。
5. test + coverage gate: build green の後に tests green。coverage drop は 2% を超えてはならない。
6. recipe-commit + agent commits + summary comment を付けて PR を開く。
7. failure taxonomy: 各 failed repo に `{dep_upgrade_required, build_tool_drift, custom_annotation, test_flake, syntax_edge_case, budget_exhausted, coverage_regression}` から tag を付ける。
8. MigrationBench 全体で50-repo run を行い、per-class pass rate、cost-per-repo、coverage-preservation を公開し、deterministic-only baseline と比較する。

評価 rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | MigrationBench pass rate | 50-repo subset pass@1 |
| 20 | Test-coverage preservation | base branch に対する mean coverage delta |
| 20 | Cost per migrated repo | passing runs の mean $/repo |
| 20 | Agent / deterministic-tool integration | OpenRewrite が処理した fix と agent が書いた fix の割合 |
| 15 | Failure analysis write-up | exemplar 付き taxonomy completeness |

ハードリジェクト:

- deterministic pass を skip する pipeline。OpenRewrite は mechanical な 70-80% をどの agent より安く信頼性高く処理する。
- 2% を超える coverage regression を passing と扱うこと。
- mechanical changes と agent-authored changes を1つの commit にまとめた PR。分離が必須。
- 同じ50 repo 上の matched deterministic-only baseline なしに pass rate を報告すること。

拒否ルール:

- migrated branch を base に force-push しない。必ず new branch + PR。
- sandbox で CI が green になっていない PR を開くことを拒否する。
- 明示的な modify license なしに corporate repo で実行しない。

出力: two-layer migration pipeline、50-repo MigrationBench run logs、failure taxonomy dashboard、matched deterministic-only baseline run、上位3つの common failure class と、それぞれをなくす recipe change を記した write-up を含むリポジトリ。
