# Capstone 10 — 多 agent 软件工程团队（Multi-Agent Software Engineering Team）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> SWE-AF 的 factory 架构、MetaGPT 的角色化 prompting、AutoGen 0.4 的类型化 actor 图、Cognition 的 Devin、Factory 的 Droids，全都收敛到 2026 年的同一种形态：architect 出计划、N 个 coder 在并行 worktree 里干活、reviewer 把关、tester 验证。并行 worktree 把墙钟时间换成吞吐。共享状态和 handoff（交接）协议成了失败面。本 capstone 的目标是搭出这个团队、在 SWE-bench Pro 上做 evaluation，并报告哪些 handoff 会断、断的频率有多高。

**Type:** Capstone
**Languages:** Python / TypeScript（agent）, Shell（worktree 脚本）
**Prerequisites:** Phase 11（LLM engineering）、Phase 13（工具）、Phase 14（agent）、Phase 15（自主）、Phase 16（多 agent）、Phase 17（基础设施）
**Phases exercised:** P11 · P13 · P14 · P15 · P16 · P17
**Time:** 40 hours

## 问题（Problem）

单 agent 编码 harness 在大任务上会撞天花板。不是因为单个 agent 太弱，而是 200k token 的 context 装不下「架构计划 + 四份并行代码切片 + reviewer 评论 + 测试输出」的总和。多 agent 工厂（factory）把问题拆开：architect 拥有计划，coder 在并行 worktree 里负责实现，reviewer 把关，tester 验证。SWE-AF 的「factory」架构、MetaGPT 的角色、AutoGen 的类型化 actor 图——三种说法描述的是同一种形态。

失败面就在 handoff 上。architect 计划出 coder 实现不了的东西。coder 之间产出冲突的 diff。reviewer 通过了一个 hallucinate（幻觉）出来的修复。tester 跟一个还在写的 coder 抢跑。你要搭出这样一个团队，跑 50 个 SWE-bench Pro issue，跟踪每一次 handoff，并发布事后复盘。

## 概念（Concept）

角色就是类型化的 agent。**Architect**（Claude Opus 4.7）读 issue、写计划、把它拆成带显式接口的子任务。**Coder**（Claude Sonnet 4.7，N 个并行实例，每个跑在 `git worktree` + Daytona 沙箱里）独立实现子任务。**Reviewer**（GPT-5.4）读合并后的 diff，要么 approve，要么提出具体修改请求。**Tester**（Gemini 2.5 Pro）在隔离环境里跑测试套件，带 artifact（产物）报告 pass/fail。

通信走一块共享的 task board（文件或 Redis 后端）。每个角色消费它被允许处理的任务。handoff 是 A2A 协议类型化的消息。协调层要操心的事情：合并冲突解决（协调者角色或自动三路合并）、共享状态同步（一旦 coder 开干，计划就冻结；replan 是单独事件）、reviewer 把关（reviewer 不能 approve 自己写的 diff，也不能 approve 它自己提出的修改）。

token 放大是隐藏成本。每一个角色边界都会增加摘要 prompt 和 handoff context。一次 40 轮的单 agent 跑下来，到了四个角色那儿就变成了 160 轮。评分 rubric 特意把 token 效率与单 agent 基线作对比，因为关键问题不是「多 agent 能不能跑通」，而是「按美元算它能不能赢」。

## 架构（Architecture）

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

## 技术栈（Stack）

- 编排：LangGraph，共享状态 + 每个 agent 一个 sub-graph（子图）
- 消息：A2A 协议（Google 2025），用于类型化的 agent 间消息
- 模型：Opus 4.7（architect）、Sonnet 4.7（coder）、GPT-5.4（reviewer）、Gemini 2.5 Pro（tester）
- worktree 隔离：每个 coder 一份 `git worktree add` + Daytona 沙箱
- 合并协调：自定义三路合并 + LLM 介入的冲突解决
- 评估（Eval）：SWE-bench Pro（50 个 issue）、SWE-AF 场景、HumanEval++ 跑单元测试
- 可观测性：Langfuse，按角色打 tag 的 span，按 agent 做 token 计账
- 部署：K8s，每个角色一个独立 Deployment，按 backlog 做 HPA

## 动手实现（Build It）

1. **Task board。** 文件后端的 JSONL，带类型化消息：`plan_request`、`subtask`、`diff_ready`、`review_needed`、`test_needed`、`approved`、`rejected`、`replan_needed`。agent 按 tag 订阅。

2. **Architect。** 读 GitHub issue，跑 Opus 4.7，用一个要求显式子任务接口（涉及的文件、对外公开的函数、测试影响）的计划模板。发出一条 `plan_request`，带一个子任务的 DAG（有向无环图）。

3. **Coder。** N 个并行 worker，每人从 board 上认领一个子任务。每个都新开一个 `git worktree add` 分支加一个 Daytona 沙箱。实现子任务。发出 `diff_ready`，带 patch + 测试增量。

4. **合并协调者（Merge coordinator）。** 所有 coder 完工后，把 N 条分支三路合并到一条 staging 分支。只在文件级出现重叠时才让 LLM 介入解冲突。

5. **Reviewer。** GPT-5.4 读合并后的 diff。不能 approve 自己写过的 diff。发出 `approved`（no-op）或 `review_feedback`，把具体的修改请求路由回相应的 coder。

6. **Tester。** Gemini 2.5 Pro 在干净沙箱里跑测试套件。捕获 artifact。发出 `test_passed` 或 `test_failed`（带 stacktrace）。失败的测试会回环到拥有那个失败子任务的 coder 身上。

7. **Handoff 计账。** 每一条跨角色边界的消息都在 Langfuse 里有一个 span，记录 payload 大小和所用模型。算出每个子任务的 token 放大率（coder_tokens + reviewer_tokens + tester_tokens + architect_share / coder_tokens）。

8. **Eval（评估）。** 跑 50 个 SWE-bench Pro issue。把 pass@1 和「每解决一个 issue 花多少美元」与单 agent 基线（一个 Sonnet 4.7 跑在一个 worktree 里）作对比。

9. **事后复盘（Post-mortem）。** 对每一个失败的 issue，找出断掉的那个 handoff（计划太模糊、合并冲突、reviewer 误 approve、tester flake）。产出一张 handoff 失败直方图。

## 用起来（Use It）

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

## 上线部署（Ship It）

`outputs/skill-multi-agent-team.md` 是交付物。给定一个 issue URL 和并行度，这个团队产出一份可合入的 PR，附带按角色细分的 token 计账。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | 在匹配过的 50-issue 子集上的 pass@1 |
| 20 | 并行加速比 | 墙钟时间相对于单 agent 基线 |
| 20 | Review 质量 | 在注入 bug 的探针上的误 approve 率 |
| 20 | Token 效率 | 每解决一个 issue 的总 token 数对比单 agent |
| 15 | 协调工程 | 合并冲突解决、handoff 失败直方图 |
| **100** | | |

## 练习（Exercises）

1. 跑到一半时往 diff 里注入一个明显 bug（在主体之前多塞一个 `return None`）。测 reviewer 的误 approve 率。调 reviewer 的 prompt，直到误 approve 率低于 5%。

2. 缩减到两个 coder（architect + coder + reviewer + tester，coder 顺序跑两个子任务）。对比墙钟时间和通过率。

3. 把合并协调者换成「单写者」约束（子任务只能改互不相交的文件集合）。测一下这给 architect 带来的规划负担。

4. 把 reviewer 从 GPT-5.4 换成 Claude Opus 4.7。测误 approve 率和 token 成本差。

5. 加上第五个角色：documenter（Haiku 4.5）。在 review 之后产出一条 changelog。看看文档质量是否值得这笔额外的 token 开销。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| 并行 worktree | 「隔离分支」 | `git worktree add` 给每个 coder 生成一棵全新的工作树 |
| Task board | 「共享消息总线」 | agent 按 tag 订阅的、文件或 Redis 存储的类型化消息 |
| Handoff | 「角色边界」 | 任何从一个角色的 context 跨到另一个角色 context 的消息 |
| Token 放大 | 「多 agent 开销」 | 同一任务下，跨角色总 token 数 / 单 agent token 数 |
| A2A 协议 | 「agent-to-agent」 | Google 2025 年的 agent 间类型化消息规范 |
| 合并协调者 | 「集成器」 | 跑三路合并、调解冲突的组件 |
| 误 approve | 「reviewer 幻觉」 | reviewer 通过了一个已知有 bug 的 diff |

## 延伸阅读（Further Reading）

- [SWE-AF factory architecture](https://github.com/Agent-Field/SWE-AF) — 2026 年的参考多 agent factory
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT) — 基于角色的多 agent 框架
- [AutoGen v0.4](https://github.com/microsoft/autogen) — 微软的类型化 actor 框架
- [Cognition AI (Devin)](https://cognition.ai) — 参考产品
- [Factory Droids](https://www.factory.ai) — 另一个参考产品
- [Google A2A protocol](https://developers.google.com/agent-to-agent) — agent 间消息规范
- [git worktree documentation](https://git-scm.com/docs/git-worktree) — 隔离的底座
- [SWE-bench Pro](https://www.swebench.com) — 评估目标
