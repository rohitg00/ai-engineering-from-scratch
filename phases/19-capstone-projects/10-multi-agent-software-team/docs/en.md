# Capstone 10 — Multi-Agent Software Engineering Team

> SWE-AF の factory architecture、MetaGPT の role-based prompting、AutoGen 0.4 の typed actor graph、Cognition の Devin、Factory の Droids は、2026年に同じ形へ収束しました。architect が plan し、N 人の coder が parallel worktree で作業し、reviewer が gate し、tester が verify します。parallel worktree は wall-clock を throughput に変換します。shared state と handoff protocol が failure surface になります。この capstone では team を構築し、SWE-bench Pro で評価し、どの handoff がどれだけ壊れるかを報告します。

**種別:** Capstone
**言語:** Python / TypeScript (agents), Shell (worktree scripts)
**前提条件:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 17 (infrastructure)
**Phases exercised:** P11 · P13 · P14 · P15 · P16 · P17
**所要時間:** 40時間

## 問題

single-agent coding harness は大きな task で ceiling に当たります。個々の agent が弱いからではなく、200k-token context に architecture plan、4つの parallel codebase slice、reviewer commentary、test output を同時に保持できないからです。multi-agent factory は問題を分割します。architect が plan を持ち、coder が parallel worktree で implementation を持ち、reviewer が gate し、tester が verify します。SWE-AF の "factory" architecture、MetaGPT の role、AutoGen の typed actor graph は、同じ形を別の言葉で表しています。

failure surface は handoff です。architect が coder には実装できない plan を出す。coder が conflicting diff を作る。reviewer が hallucinated fix を approve する。tester がまだ書き込み中の coder と race する。この team を構築し、50件の SWE-bench Pro issue で走らせ、すべての handoff を trace し、post-mortem を公開します。

## コンセプト

role は typed agent です。**Architect** (Claude Opus 4.7) は issue を読み、plan を書き、明示的な interface を持つ subtask に分解します。**Coders** (Claude Sonnet 4.7、N parallel instances、各自 `git worktree` + Daytona sandbox) は subtask を独立に実装します。**Reviewer** (GPT-5.4) は merged diff を読み、approve または specific change を request します。**Tester** (Gemini 2.5 Pro) は isolated test suite を走らせ、artifact 付きで pass/fail を報告します。

communication は shared task board (file-backed または Redis) で行います。各 role は許可された task を consume します。handoff は A2A-protocol-typed message です。coordination concern は、merge-conflict resolution (coordinator role または automatic three-way merge)、shared-state synchronization (coder が開始したら plan は freeze、replan は separate event)、reviewer gatekeeping (reviewer は自分が approve する変更を自分で書いたり提案したりできない) です。

hidden cost は token amplification です。role boundary ごとに summary prompt と handoff context が増えます。40-turn の single-agent run は、4 role 全体では 160 total turns になります。rubric は single-agent baseline に対する token efficiency を明示的に重視します。問いは「multi-agent は動くか」ではなく、「dollar あたり勝つか」です。

## Architecture

```
GitHub issue URL
      |
      v
Architect (Opus 4.7)
   reads issue, produces plan with subtasks + interfaces
      |
      v
Task board (file / Redis)
      |
   +-- subtask 1 ---+-- subtask 2 ---+-- subtask 3 ---+-- subtask 4 ---+
   v                v                v                v                v
Coder A          Coder B          Coder C          Coder D          (4 parallel)
 (Sonnet)         (Sonnet)         (Sonnet)         (Sonnet)
 worktree A       worktree B       worktree C       worktree D
 Daytona          Daytona          Daytona          Daytona
      |                |                |                |
      +--------+-------+-------+--------+
               v
           merge coordinator  (three-way merge + conflict resolution)
               |
               v
           Reviewer (GPT-5.4)
               |
               v
           Tester  (Gemini 2.5 Pro)  -> passes? -> open PR
                                     -> fails?  -> route back to coder
```

## Stack

- Orchestration: shared state と per-agent sub-graphs を持つ LangGraph
- Messaging: typed inter-agent message 用 A2A protocol (Google 2025)
- Models: architect は Opus 4.7、coders は Sonnet 4.7、reviewer は GPT-5.4、tester は Gemini 2.5 Pro
- Worktree isolation: coder ごとに `git worktree add` + Daytona sandbox
- Merge coordinator: custom three-way merge + LLM-mediated conflict resolution
- Eval: SWE-bench Pro (50 issues)、SWE-AF scenarios、unit test 用 HumanEval++
- Observability: role-tagged spans と per-agent token accounting を持つ Langfuse
- Deployment: role ごとに separate Deployment とし、backlog に基づく HPA を使う K8s

## 実装

1. **Task board.** typed messages を保存する file-backed JSONL を作ります: `plan_request`, `subtask`, `diff_ready`, `review_needed`, `test_needed`, `approved`, `rejected`, `replan_needed`。agent は tag を購読します。

2. **Architect.** GitHub issue を読み、explicit subtask interface (files touched、public functions、test impact) を要求する plan template で Opus 4.7 を走らせます。subtask DAG を持つ `plan_request` を1つ emit します。

3. **Coders.** N parallel worker が board から subtask を1つ claim します。各 worker は fresh `git worktree add` branch と Daytona sandbox を spawn し、subtask を実装します。patch と test deltas を持つ `diff_ready` を emit します。

4. **Merge coordinator.** all-coders-done で N branch を staging branch に three-way merge します。file-level overlap がある場合だけ LLM-mediated conflict resolution を使います。

5. **Reviewer.** GPT-5.4 が merged diff を読みます。自分が authored した diff は approve できません。`approved` (no-op) または relevant coder へ route される specific change request 付き `review_feedback` を emit します。

6. **Tester.** Gemini 2.5 Pro が clean sandbox で test suite を走らせます。artifact を capture します。stacktrace 付き `test_passed` または `test_failed` を emit します。failed test は failing subtask を所有する coder に戻します。

7. **Handoff accounting.** role boundary を越えるすべての message に、payload size と model を持つ Langfuse span を付けます。per-subtask token amplification = (coder_tokens + reviewer_tokens + tester_tokens + architect_share) / coder_tokens を計算します。

8. **Eval.** 50件の SWE-bench Pro issue で走らせます。single-agent baseline (single worktree 上の Sonnet 4.7 1体) に対して pass@1 と $-per-solved-issue を比較します。

9. **Post-mortem.** failed issue ごとに壊れた handoff (plan too vague、merge conflict、reviewer false-approve、tester flake) を特定し、handoff-failure histogram を作ります。

## Use It

```
$ team run --issue https://github.com/acme/widget/issues/842
[architect] plan: 4 subtasks (parser, cache, api, migration)
[board]     dispatched to 4 coders in parallel worktrees
[coder-A]   subtask parser  -> 42 lines, tests pass locally
[coder-B]   subtask cache   -> 88 lines, tests pass locally
[coder-C]   subtask api     -> 31 lines, tests pass locally
[coder-D]   subtask migration -> 19 lines, tests pass locally
[merge]     3-way merge: 0 conflicts
[reviewer]  comments on cache (thread pool sizing); routed to coder-B
[coder-B]   revision: 92 lines; submits
[reviewer]  approved
[tester]    all 412 tests pass
[pr]        opened #3382   4 coders, 1 revision, $4.90, 18m
```

## Ship It

`outputs/skill-multi-agent-team.md` が deliverable です。issue URL と parallelism level を受け取り、per-role token accounting 付きの merge-ready PR を生成します。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | matched 50-issue subset、pass@1 |
| 20 | Parallel speedup | single-agent baseline に対する wall-clock |
| 20 | Review quality | injected-bug probe 上の false-approval rate |
| 20 | Token efficiency | solved issue あたり total tokens と single-agent の比較 |
| 15 | Coordination engineering | merge-conflict resolution、handoff-failure histogram |
| **100** | | |

## Exercises

1. mid-run の diff に明らかな bug (main body の前に余計な `return None`) を注入します。reviewer の false-approve rate を測り、5% 未満になるまで reviewer prompt を調整します。

2. coder を2人に減らします (architect + coder + reviewer + tester、coder が2 subtask を sequential に実行)。wall-clock と pass rate を比較します。

3. merge coordinator を single-writer constraint (subtask は disjoint file set に触る) に置き換えます。architect の planning burden を測ります。

4. reviewer を GPT-5.4 から Claude Opus 4.7 に差し替えます。false-approval rate と token cost delta を測ります。

5. 5番目の role として documenter (Haiku 4.5) を追加します。review 後に changelog entry を作らせ、documentation quality が追加 token spend に見合うか測ります。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Parallel worktree | 「Isolated branch」 | coder ごとに fresh working tree を作る `git worktree add` |
| Task board | 「Shared message bus」 | agent が subscribe する typed message の file または Redis store |
| Handoff | 「Role boundary」 | ある role の context から別 role の context へ渡る message |
| Token amplification | 「Multi-agent overhead」 | 同じ task に対する roles 全体 tokens / single-agent tokens |
| A2A protocol | 「Agent-to-agent」 | typed inter-agent message 用の Google 2025 spec |
| Merge coordinator | 「Integrator」 | three-way merge を実行し、conflict を mediate する component |
| False approval | 「Reviewer hallucination」 | known bug を含む diff を reviewer が approve すること |

## 参考文献

- [SWE-AF factory architecture](https://github.com/Agent-Field/SWE-AF) — 2026 multi-agent factory の reference
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT) — role-based multi-agent framework
- [AutoGen v0.4](https://github.com/microsoft/autogen) — Microsoft の typed actor framework
- [Cognition AI (Devin)](https://cognition.ai) — reference product
- [Factory Droids](https://www.factory.ai) — alternate reference product
- [Google A2A protocol](https://developers.google.com/agent-to-agent) — inter-agent messaging spec
- [git worktree documentation](https://git-scm.com/docs/git-worktree) — isolation substrate
- [SWE-bench Pro](https://www.swebench.com) — evaluation target
