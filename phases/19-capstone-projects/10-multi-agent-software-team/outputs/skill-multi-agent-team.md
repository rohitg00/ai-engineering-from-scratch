---
name: multi-agent-team
description: architect、parallel coders、reviewer、tester からなる multi-agent software team を構築し、SWE-bench Pro と handoff post-mortem で測定する。
version: 1.0.0
phase: 19
lesson: 10
tags: [capstone, multi-agent, swe-bench, langgraph, a2a, worktree, roles]
---

GitHub issue URL と parallelism level を受け取り、merge-ready PR を生成する multi-agent software team を deploy する。50件の SWE-bench Pro issue で評価し、handoff-failure histogram を公開する。

構築計画:

1. task board: file-backed (または Redis) JSONL store の typed messages。message kinds: plan_request, subtask, diff_ready, review_needed, review_feedback, approved, test_needed, test_passed, test_failed, replan_needed。
2. architect (Opus 4.7): issue を読み、plan を書き、明示的な interfaces (files touched, public functions, test impact) を持つ subtasks の DAG を出力する。
3. N coders (Sonnet 4.7): 各 coder が subtask を claim し、新しい `git worktree add` + Daytona sandbox を spawn して独立に実装する。
4. merge coordinator: three-way merge。file-level overlap がある場合だけ LLM-mediated conflict resolution を使う。
5. reviewer (GPT-5.4): merged diff を読む。自分が書いた diff を approve できない。approved または該当 coder に route される review_feedback を出力する。
6. tester (Gemini 2.5 Pro): clean sandbox で test suite を走らせる。artifact 付きで test_passed または test_failed を出力する。
7. handoff accounting: cross-role message はすべて payload size と model を持つ Langfuse span になる。token amplification = total_tokens / single_agent_baseline_tokens を計算する。
8. obvious bug probe (run の10%) を注入し、reviewer false-approve rate を測る。
9. 50件の SWE-bench Pro issue で走らせ、pass@1、single-agent baseline に対する wall-clock、role 別 token breakdown、handoff-failure histogram を公開する。

評価 rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | 50-issue subset pass@1 |
| 20 | Parallel speedup | single-agent baseline に対する wall-clock |
| 20 | Review quality | injected-bug probe 上の false-approval rate |
| 20 | Token efficiency | solved issue あたり total tokens と single-agent の比較 |
| 15 | Coordination engineering | merge-conflict resolution、handoff-failure histogram |

ハードリジェクト:

- 自分が書いた、または提案した diff を approve できる reviewer。これは hard constraint。
- matched single-agent baseline run のない report。multi-agent は pass@1 だけでなく *per dollar* で勝つ必要がある。
- typed A2A messages ではなく free-form strings を使う task board。
- conflicting diffs を silently drop し、replan に戻さない merge coordinator。

拒否ルール:

- role ごとの budget ceiling (token + dollar) なしで実行しない。
- tester が clean sandbox で verify していない PR を開かない。
- single run で coder を8人超に scale しない。それ以上は coordination overhead が支配する。

出力: task board + role workers、50-issue SWE-bench Pro run log、matched single-agent baseline run、role-tagged spans と role 別 token breakdown を持つ Langfuse dashboard、injected-bug probe report、最も多く壊れた3つの handoff と、それぞれを減らした message-schema または prompt change を記す post-mortem を含むリポジトリ。
