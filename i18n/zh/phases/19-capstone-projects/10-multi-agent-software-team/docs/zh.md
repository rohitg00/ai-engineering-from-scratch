# 毕业项目 10 — 多智能体软件工程团队

> 2026 年多智能体工程团队的形态已趋同:架构师负责规划,N 个编码者在并行 worktree 中工作,评审者把关,测试者验证。SWE-AF 的工厂架构、MetaGPT 的基于角色的提示、AutoGen 0.4 的类型化 actor 图、Cognition 的 Devin,以及 Factory 的 Droids,都独立地收敛到了这一形态。并行 worktree 将墙钟时间转化为吞吐量。共享状态与交接协议则成为故障面。本毕业项目的任务是构建这个团队,在 SWE-bench Pro 上评估,并报告哪些交接会失败以及失败频率。

**Type:** Capstone
**Languages:** Python / TypeScript (agents), Shell (worktree scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 17 (infrastructure)
**Phases exercised:** P11 · P13 · P14 · P15 · P16 · P17
**Time:** 40 hours

## 问题

单智能体编码框架在大型任务上遇到了天花板。不是因为任何单个智能体能力不足,而是因为 200k token 的上下文无法同时容纳一份架构计划、四份并行的代码库切片、评审者意见以及测试输出。多智能体工厂对问题进行拆分:架构师负责计划,编码者在并行 worktree 中负责实现,评审者把关,测试者验证。SWE-AF 的"工厂"架构、MetaGPT 的角色设计、AutoGen 的类型化 actor 图——这三种表述描述的都是同一形态。

故障面就是交接。架构师规划出编码者无法实现的内容。编码者产出相互冲突的 diff。评审者批准了一个幻觉式的修复。测试者与仍在写代码的编码者产生竞争。你将构建一个这样的团队,在 50 个 SWE-bench Pro 问题上运行,追踪每一次交接,并发布复盘报告。

## 概念

角色是类型化的智能体。**架构师**(Claude Opus 4.7)阅读 issue,撰写计划,并将其拆解为具有显式接口的子任务。**编码者**(Claude Sonnet 4.7,N 个并行实例,每个位于 `git worktree` + Daytona 沙箱中)独立实现各子任务。**评审者**(GPT-5.4)阅读合并后的 diff,要么批准,要么要求具体修改。**测试者**(Gemini 2.5 Pro)在隔离环境中运行测试套件,并附带产物报告通过/失败。

通信通过共享任务板(基于文件或 Redis)进行。每个角色只消费其被允许处理的任务。交接是 A2A 协议类型化的消息。协调关注点包括:合并冲突解决(协调者角色或自动三方合并)、共享状态同步(计划在编码者开始后即冻结;重新规划是独立事件),以及评审者把关(评审者不能批准自己做出的或自己提出的修改)。

Token 放大是隐性成本。每个角色边界都会增加摘要提示与交接上下文。一次 40 轮的单智能体运行,分散到四个角色后变成总共 160 轮。评分标准特别权衡 token 效率与单智能体基线的对比,因为问题不是"多智能体是否可行",而是"每花费一美元是否更划算"。

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

- 编排:LangGraph,共享状态 + 每个智能体独立的子图
- 消息传递:A2A 协议(Google 2025),用于类型化的智能体间消息
- 模型:Opus 4.7(架构师)、Sonnet 4.7(编码者)、GPT-5.4(评审者)、Gemini 2.5 Pro(测试者)
- Worktree 隔离:每个编码者一个 `git worktree add` + Daytona 沙箱
- 合并协调器:自定义三方合并 + LLM 介入的冲突解决
- 评估:SWE-bench Pro(50 个问题)、SWE-AF 场景、HumanEval++ 用于单元测试
- 可观测性:Langfuse,带角色标记的 span,按智能体的 token 计量
- 部署:K8s,每个角色作为独立的 Deployment + 基于积压队列的 HPA

```figure
ce-team-handoff
```

## 构建步骤

1. **任务板。** 基于文件的 JSONL,包含类型化消息:`plan_request`、`subtask`、`diff_ready`、`review_needed`、`test_needed`、`approved`、`rejected`、`replan_needed`。智能体按标签订阅。

2. **架构师。** 阅读 GitHub issue,使用一个要求显式子任务接口(涉及的文件、公开函数、测试影响)的计划模板运行 Opus 4.7。输出一条 `plan_request`,包含子任务的 DAG。

3. **编码者。** N 个并行 worker,每个从任务板认领一个子任务。各自创建一个全新的 `git worktree add` 分支以及一个 Daytona 沙箱。实现子任务。输出 `diff_ready`,附带补丁和测试差异。

4. **合并协调器。** 在所有编码者完成后,将 N 个分支三方合并到 staging 分支。仅在文件级重叠存在时进行 LLM 介入的冲突解决。

5. **评审者。** GPT-5.4 阅读合并后的 diff。不能批准自己撰写的 diff。输出 `approved`(无操作)或 `review_feedback`,具体的修改请求被路由回相关编码者。

6. **测试者。** Gemini 2.5 Pro 在干净的沙箱中运行测试套件。捕获产物。输出 `test_passed` 或带堆栈跟踪的 `test_failed`。失败的测试回环给拥有该失败子任务的编码者。

7. **交接计量。** 每条跨越角色边界的消息都在 Langfuse 中生成一个 span,记录负载大小和所用模型。计算每个子任务的 token 放大率(coder_tokens + reviewer_tokens + tester_tokens + architect_share / coder_tokens)。

8. **评估。** 在 50 个 SWE-bench Pro 问题上运行。对比 pass@1 和每解决一个问题的成本,与单智能体基线(单个 worktree 中的一个 Sonnet 4.7)进行比较。

9. **复盘。** 对每个失败的问题,识别出失败的交接(计划过于模糊、合并冲突、评审者误批准、测试者偶发失败)。生成一份交接失败直方图。

## 使用

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

## 交付

`outputs/skill-multi-agent-team.md` 是交付物。给定一个 issue URL 和并行度级别,团队产出一个可合并的 PR,并附带按角色的 token 计量。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | 匹配的 50 问题子集,pass@1 |
| 20 | 并行加速比 | 墙钟时间对比单智能体基线 |
| 20 | 评审质量 | 注入 bug 探针下的误批准率 |
| 20 | Token 效率 | 每解决一个问题的总 token 数对比单智能体 |
| 15 | 协调工程质量 | 合并冲突解决、交接失败直方图 |
| **100** | | |

## 练习

1. 在运行中途向 diff 注入一个明显的 bug(在主体之前加入额外的 `return None`)。测量评审者的误批准率。调整评审者提示,直到误批准率低于 5%。

2. 将编码者减少到两个(架构师 + 编码者 + 评审者 + 测试者,编码者依次执行两个子任务)。对比墙钟时间和通过率。

3. 用单写者约束(子任务涉及互不相交的文件集)替代合并协调器。测量架构师承受的规划负担。

4. 将评审者从 GPT-5.4 换成 Claude Opus 4.7。测量误批准率和 token 成本差异。

5. 增加第五个角色:文档撰写者(Haiku 4.5)。在评审之后,它生成一条变更日志。衡量文档质量是否值得额外的 token 开销。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 并行 worktree | "隔离分支" | `git worktree add`,为每个编码者生成一个全新的工作树 |
| 任务板 | "共享消息总线" | 智能体订阅的类型化消息的文件或 Redis 存储 |
| 交接 | "角色边界" | 任何从一个角色的上下文跨越到另一个角色的消息 |
| Token 放大 | "多智能体开销" | 各角色总 token 数 / 同一任务的单智能体 token 数 |
| A2A 协议 | "Agent-to-agent" | Google 2025 年的类型化智能体间消息规范 |
| 合并协调器 | "集成者" | 执行三方合并并调解冲突的组件 |
| 误批准 | "评审者幻觉" | 评审者批准了一个含有已知 bug 的 diff |

## 延伸阅读

- [SWE-AF factory architecture](https://github.com/Agent-Field/SWE-AF) — 2026 年多智能体工厂的参考实现
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT) — 基于角色的多智能体框架
- [AutoGen v0.4](https://github.com/microsoft/autogen) — Microsoft 的类型化 actor 框架
- [Cognition AI (Devin)](https://cognition.ai) — 参考产品
- [Factory Droids](https://www.factory.ai) — 替代参考产品
- [Google A2A protocol](https://a2a-protocol.org/latest/) — 智能体间消息传递规范
- [git worktree documentation](https://git-scm.com/docs/git-worktree) — 隔离的底层机制
- [SWE-bench Pro](https://www.swebench.com) — 评估目标