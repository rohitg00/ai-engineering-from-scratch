# 10 · 多智能体软件工程团队

> SWE-AF 的工厂架构、MetaGPT 的基于角色的提示、AutoGen 0.4 的类型化 actor 图、Cognition 的 Devin 以及 Factory 的 Droids 都在 2026 年收敛到了同一种形态：一个架构师（architect）做计划，N 个编码者（coder）在并行工作树（worktree）中工作，一个审查者（reviewer）把关，一个测试者（tester）验证。并行工作树将挂钟时间转化为吞吐量。共享状态和交接协议（handoff protocol）成为故障面（failure surface）。本课程的顶点项目（capstone）是构建这个团队，在 SWE-bench Pro 上评估，并报告哪些交接出了问题以及出问题的频率。

**类型：** 顶点项目
**语言：** Python / TypeScript（智能体）、Shell（工作树脚本）
**前置：** 第十一章（LLM 工程）、第十三章（工具）、第十四章（智能体）、第十五章（自主性）、第十六章（多智能体）、第十七章（基础设施）
**涉及阶段：** P11 · P13 · P14 · P15 · P16 · P17
**时长：** 40 小时

## 问题

单智能体编程工具在大型任务上会遇到天花板。不是因为任何单个智能体能力不足，而是因为 200k token 的上下文无法同时容纳架构计划、四个并行代码库切片、审查者评论和测试输出。多智能体工厂（Multi-agent factory）将问题拆分开来：架构师负责计划，编码者在各自并行工作树中实现，审查者把关，测试者验证。SWE-AF 的"工厂"架构、MetaGPT 的角色、AutoGen 的类型化 actor 图——这三种框架描述的正是同一种形态。

故障面在于交接（handoff）。架构师设计的方案编码者无法实现。编码者产出冲突的差异。审查者批准了一个幻觉修复。测试者与仍在编写代码的编码者产生竞态。你将构建其中一个团队，在 50 个 SWE-bench Pro 问题上运行它，跟踪每一次交接，并发布事后分析报告。

## 概念

角色是类型化的智能体。**架构师**（Claude Opus 4.7）读取 issue，撰写计划，并将其拆分为带有明确接口的子任务。**编码者**（Claude Sonnet 4.7，N 个并行实例，每个实例在独立的 `git worktree` + Daytona 沙箱（sandbox）中运行）各自独立实现子任务。**审查者**（GPT-5.4）阅读合并后的差异，要么批准，要么提出具体的修改要求。**测试者**（Gemini 2.5 Pro）在隔离环境中运行测试套件，并报告通过/失败及测试产物。

通信通过共享的任务板（Task board）（文件形式或 Redis 实现）进行。每个角色消费其被允许处理的任务。交接消息采用 A2A 协议（A2A protocol）的类型化消息格式。需要关注的协调问题包括：合并冲突解决（由协调器角色或自动三路合并处理）、共享状态同步（编码者一旦开始工作，计划即被冻结；重新规划是独立事件）以及审查者把关（审查者不能批准自己编写的修改或自己提议的修改）。

令牌放大（Token amplification）是隐藏的成本。每一个角色边界都会增加摘要提示和交接上下文。一次 40 轮的单智能体执行，在四个角色之间可能变成 160 轮。评分标准特别关注令牌效率与单智能体基线的对比，因为问题不在于"多智能体是否有效"，而在于"每花费一美元，它是否胜出"。

## 架构

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

## 技术栈

- 编排：LangGraph，配合共享状态 + 每个智能体的子图
- 消息传递：A2A 协议（Google 2025），用于类型化的智能体间消息
- 模型：Opus 4.7（架构师）、Sonnet 4.7（编码者）、GPT-5.4（审查者）、Gemini 2.5 Pro（测试者）
- 工作树隔离：每个编码者执行 `git worktree add` + Daytona 沙箱
- 合并协调器（Merge coordinator）：自定义三路合并 + LLM 辅助的冲突解决
- 评估：SWE-bench Pro（50 个 issue）、SWE-AF 场景、HumanEval++（单元测试）
- 可观测性：Langfuse，带有按角色标记的 span 和每个智能体的 token 统计
- 部署：K8s，每个角色作为独立的 Deployment + 基于任务积压的 HPA

## 构建过程

1. **任务板。** 文件形式的 JSONL，包含类型化消息：`plan_request`、`subtask`、`diff_ready`、`review_needed`、`test_needed`、`approved`、`rejected`、`replan_needed`。智能体按标签订阅。

2. **架构师。** 读取 GitHub issue，使用 Opus 4.7 运行计划模板，要求产出明确的子任务接口（涉及的文件、公开函数、测试影响）。产出一条 `plan_request`，包含子任务的有向无环图（DAG）。

3. **编码者。** N 个并行工作进程，每个从任务板认领一个子任务。每个进程创建一个新的 `git worktree add` 分支以及一个 Daytona 沙箱。实现子任务。产出 `diff_ready`，包含补丁 + 测试增量。

4. **合并协调器。** 在所有编码者完成后，将 N 个分支三路合并到暂存分支。仅在存在文件级重叠时进行 LLM 辅助的冲突解决。

5. **审查者。** GPT-5.4 阅读合并后的差异。不能批准由其自己编写的差异。产出 `approved`（无操作）或 `review_feedback`，包含具体的修改要求，路由回对应的编码者。

6. **测试者。** Gemini 2.5 Pro 在干净的沙箱中运行测试套件。捕获测试产物。产出 `test_passed` 或 `test_failed`（附带堆栈跟踪）。失败的测试循环回到拥有该失败子任务的编码者。

7. **交接记录。** 每条跨越角色边界的消息在 Langfuse 中生成一个 span，记录负载大小和使用的模型。计算每个子任务的令牌放大（(coder_tokens + reviewer_tokens + tester_tokens + architect_share) / coder_tokens）。

8. **评估。** 在 50 个 SWE-bench Pro issue 上运行。将 pass@1 和每个已解决问题的花费与单智能体基线（一个 Sonnet 4.7 在单个工作树中）进行对比。

9. **事后分析。** 对每个失败的 issue，识别出错的交接环节（计划过于模糊、合并冲突、审查者误批准、测试者偶发失败）。产出一张交接失败直方图。

## 使用示例

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

## 交付标准

`outputs/skill-multi-agent-team.md` 是最终交付物。给定一个 issue URL 和并行度，团队产出一个可合并的 PR，并附有每个角色的 token 统计。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | 在匹配的 50 issue 子集上的 pass@1 |
| 20 | 并行加速比 | 挂钟时间对比单智能体基线 |
| 20 | 审查质量 | 注入 bug 探测中的误批准率（False-approval rate） |
| 20 | 令牌效率 | 每个已解决问题的总 token 对比单智能体 |
| 15 | 协调工程 | 合并冲突解决、交接失败直方图 |
| **100** | | |

## 练习

1. 在运行过程中向差异中注入一个明显的 bug（在主体逻辑之前额外插入 `return None`）。测量审查者的误批准率。调整审查者提示词，直到误批准率低于 5%。

2. 减少到两个编码者（架构师 + 编码者 + 审查者 + 测试者，编码者按顺序执行两个子任务）。对比挂钟时间和通过率。

3. 用单写者约束替换合并协调器（子任务涉及互不相交的文件集）。测量架构师的规划负担。

4. 将审查者从 GPT-5.4 替换为 Claude Opus 4.7。测量误批准率和 token 成本差异。

5. 增加第五个角色：文档编写者（Haiku 4.5）。在审查后，产出 changelog 条目。衡量文档质量是否值得额外的 token 开销。

## 关键术语

| 术语 | 日常说法 | 实际含义 |
|------|---------|---------|
| 并行工作树（Parallel worktree） | "隔离分支" | `git worktree add` 为每个编码者生成一个独立的工作树 |
| 任务板（Task board） | "共享消息总线" | 文件或 Redis 存储的类型化消息，智能体按标签订阅 |
| 交接（Handoff） | "角色边界" | 任何从某一角色上下文跨越到另一角色上下文的消息 |
| 令牌放大（Token amplification） | "多智能体开销" | 所有角色总 token 数 / 同一任务的单智能体 token 数 |
| A2A 协议 | "智能体到智能体" | Google 2025 年发布的类型化智能体间消息规范 |
| 合并协调器（Merge coordinator） | "集成器" | 执行三路合并并调解冲突的组件 |
| 误批准（False approval） | "审查者幻觉" | 审查者批准了包含已知 bug 的差异 |

## 扩展阅读

- [SWE-AF 工厂架构](https://github.com/Agent-Field/SWE-AF) —— 2026 年参考级多智能体工厂
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT) —— 基于角色的多智能体框架
- [AutoGen v0.4](https://github.com/microsoft/autogen) —— 微软的类型化 actor 框架
- [Cognition AI (Devin)](https://cognition.ai) —— 参考产品
- [Factory Droids](https://www.factory.ai) —— 替代参考产品
- [Google A2A 协议](https://developers.google.com/agent-to-agent) —— 智能体间消息传递规范
- [git worktree 文档](https://git-scm.com/docs/git-worktree) —— 隔离基础层
- [SWE-bench Pro](https://www.swebench.com) —— 评估目标
