# 综合项目 10 — 多智能体软件工程团队

> SWE-AF 的工厂架构、MetaGPT 的基于角色的提示、AutoGen 0.4 的类型化角色图谱、Cognition 的 Devin，以及 Factory 的 Droids 都汇聚到相同的 2026 年形态：一个架构师进行规划，N 个编程员在并行 worktrees 中工作，一个审查员把关，一个测试员验证。并行 worktrees 将实际时间转换为吞吐量。共享状态和切换协议成为失败面。本综合项目是构建这个团队，在 SWE-bench Pro 上进行评估，并报告哪些切换失败了以及频率如何。

**类型：** 综合项目
**语言：** Python / TypeScript（智能体）、Shell（worktree 脚本）
**前置条件：** 第 11 阶段（LLM 工程）、第 13 阶段（工具）、第 14 阶段（智能体）、第 15 阶段（自主）、第 16 阶段（多智能体）、第 17 阶段（基础设施）
**涉及阶段：** P11 · P13 · P14 · P15 · P16 · P17
**时间：** 40 小时

## 问题描述

单智能体编程框架在大型任务上触及天花板。不是因为任何单个智能体弱，而是因为 20 万 token 的上下文无法容纳架构计划加上四个并行代码库切片加上审查员评论加上测试输出。多智能体工厂分割问题：架构师拥有计划，编程员在并行 worktrees 中拥有实现，审查员把关，测试员验证。SWE-AF 的"工厂"架构、MetaGPT 的角色、AutoGen 的类型化角色图谱——这三种框架都描述相同的形态。

失败面是切换。架构师计划了编程员无法实现的东西。编程员产生冲突的 diffs。审查员批准了幻觉修复。测试员与仍在编写代码的编程员竞速。你将构建其中一个团队，在 50 个 SWE-bench Pro 问题上运行它，跟踪每次切换，并发布事后分析。

## 核心概念

角色是类型化的智能体。**架构师**（Claude Opus 4.7）读取 issue，编写计划，并将其分解为带有显式接口的子任务。**编程员**（Claude Sonnet 4.7，N 个并行实例，每个在 `git worktree` + Daytona 沙箱中）独立实现子任务。**审查员**（GPT-5.4）读取合并的 diff，要么批准，要么请求特定更改。**测试员**（Gemini 2.5 Pro）在隔离环境中运行测试套件，并报告通过/失败及制品。

通信通过共享任务板（文件支持或 Redis）。每个角色消费其被允许处理的任务。切换是 A2A 协议类型的消息。协调关注点：合并冲突解决（协调员角色或自动三路合并）、共享状态同步（一旦编程员开始，计划就被冻结；重计划是独立事件），以及审查员守门（审查员不能批准其自己的更改或它提出的更改）。

Token 放大是隐藏成本。每个角色边界都会增加摘要提示和切换上下文。一个 40 轮的单智能体运行变成跨四个角色的 160 个总轮次。评分标准特别权衡 token 效率与单智能体基线，因为问题不是"多智能体是否有效"，而是"每美元它是否获胜。"

## 架构

```
GitHub issue URL
      |
      v
架构师（Opus 4.7）
   读取 issue，生成带有子任务 + 接口的计划
      |
      v
任务板（文件 / Redis）
      |
   +-- 子任务 1 ---+-- 子任务 2 ---+-- 子任务 3 ---+-- 子任务 4 ---+
   v                v                v                v                v
编程员 A          编程员 B          编程员 C          编程员 D          （4 个并行）
 （Sonnet）         （Sonnet）         （Sonnet）         （Sonnet）
 worktree A       worktree B       worktree C       worktree D
 Daytona          Daytona          Daytona          Daytona
      |                |                |                |
      +--------+-------+-------+--------+
               v
           合并协调员  （三路合并 + 冲突解决）
               |
               v
           审查员（GPT-5.4）
               |
               v
           测试员  （Gemini 2.5 Pro）  -> 通过？ -> 打开 PR
                                     -> 失败？  -> 路由回编程员
```

## 技术栈

- 编排：带有共享状态 + 每智能体子图的 LangGraph
- 消息传递：用于类型化智能体间消息的 A2A 协议（Google 2025）
- 模型：Opus 4.7（架构师）、Sonnet 4.7（编程员）、GPT-5.4（审查员）、Gemini 2.5 Pro（测试员）
- Worktree 隔离：每个编程员 `git worktree add` + Daytona 沙箱
- 合并协调员：自定义三路合并 + LLM 中介的冲突解决
- 评估：SWE-bench Pro（50 个问题）、SWE-AF 场景、用于单元测试的 HumanEval++
- 可观测性：带有角色标记 span 的 Langfuse，每智能体 token 记账
- 部署：K8s，每个角色作为独立的 Deployment + 基于积压的 HPA

## 构建步骤

1. **任务板。** 带有类型化消息的文件支持 JSONL：`plan_request`、`subtask`、`diff_ready`、`review_needed`、`test_needed`、`approved`、`rejected`、`replan_needed`。智能体订阅标签。

2. **架构师。** 读取 GitHub issue，使用要求显式子任务接口（触及的文件、公共函数、测试影响）的计划模板运行 Opus 4.7。发出一个带有子任务 DAG 的 `plan_request`。

3. **编程员。** N 个并行 worker，每个从板上领取一个子任务。每个生成一个全新的 `git worktree add` 分支加上一个 Daytona 沙箱。实现子任务。发出带有补丁 + 测试增量的 `diff_ready`。

4. **合并协调员。** 在所有编程员完成后，将 N 个分支三路合并到一个暂存分支。仅当存在文件级重叠时才进行 LLM 中介的冲突解决。

5. **审查员。** GPT-5.4 读取合并的 diff。不能批准其创作的 diffs。发出 `approved`（无操作）或带有路由回相关编程员的特定变更请求的 `review_feedback`。

6. **测试员。** Gemini 2.5 Pro 在干净的沙箱中运行测试套件。捕获制品。发出 `test_passed` 或带有堆栈跟踪的 `test_failed`。失败的测试循环回拥有失败子任务的编程员。

7. **切换记账。** 每个跨越角色边界的消息在 Langfuse 中获得一个 span，带有载荷大小和使用的模型。计算每子任务 token 放大（coder_tokens + reviewer_tokens + tester_tokens + architect_share / coder_tokens）。

8. **评估。** 在 50 个 SWE-bench Pro 问题上运行。将 pass@1 和每解决 issue 的 $-$ 与单智能体基线（单个 worktree 中的单个 Sonnet 4.7）进行比较。

9. **事后分析。** 对于每个失败的问题，识别破坏的切换（计划太模糊、合并冲突、审查员误批准、测试员 flake）。生成切换失败直方图。

## 使用示例

```
$ team run --issue https://github.com/acme/widget/issues/842
[architect] 计划：4 个子任务（parser、cache、api、migration）
[board]     并行分派到 4 个编程员在 worktrees 中
[coder-A]   子任务 parser  -> 42 行，测试本地通过
[coder-B]   子任务 cache   -> 88 行，测试本地通过
[coder-C]   子任务 api     -> 31 行，测试本地通过
[coder-D]   子任务 migration -> 19 行，测试本地通过
[merge]     三路合并：0 个冲突
[reviewer]  对 cache 发表评论（线程池大小）；路由到 coder-B
[coder-B]   修订：92 行；提交
[reviewer]  已批准
[tester]    全部 412 个测试通过
[pr]        打开的 #3382   4 个编程员，1 次修订，$4.90，18 分钟
```

## 交付成果

`outputs/skill-multi-agent-team.md` 是可交付成果。给定一个 issue URL 和并行度级别，团队生成带有每角色 token 记账的合并就绪 PR。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | 匹配的 50 问题子集，pass@1 |
| 20 | 并行加速 | 与单智能体基线的实际时间对比 |
| 20 | 审查质量 | 在 injected-bug 探针上的误批准率 |
| 20 | Token 效率 | 每解决 issue 的总 tokens vs 单智能体 |
| 15 | 协调工程 | 合并冲突解决、切换失败直方图 |
| **100** | | |

## 练习

1. 在运行中向 diff 注入一个明显的 bug（在主体重前的额外 `return None`）。测量审查员的误批准率。调整审查员提示，直到误批准低于 5%。

2. 减少到两个编程员（架构师 + 编程员 + 审查员 + 测试员，编程员顺序运行两个子任务）。比较实际时间和通过率。

3. 用单写入者约束替换合并协调员（子任务触及不相交的文件集）。测量架构师的规划负担。

4. 将审查员从 GPT-5.4 换为 Claude Opus 4.7。测量误批准率和 token 成本差异。

5. 添加第五个角色：文档员（Haiku 4.5）。审查后，它生成一个变更日志条目。测量文档质量是否证明额外的 token 支出是合理的。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| 并行 worktree | "隔离分支" | `git worktree add` 为每个编程员生成一个全新的工作树 |
| 任务板 | "共享消息总线" | 智能体订阅的类型化消息的文件或 Redis 存储 |
| 切换 | "角色边界" | 任何从一个角色的上下文跨越到另一个角色的上下文的消息 |
| Token 放大 | "多智能体开销" | 跨角色的 total tokens / 同一任务的单智能体 tokens |
| A2A 协议 | "智能体到智能体" | Google 的 2025 年类型化智能体间消息规范 |
| 合并协调员 | "集成器" | 运行三路合并并调解冲突的组件 |
| 误批准 | "审查员幻觉" | 审查员批准带有已知 bug 的 diff |

## 延伸阅读

- [SWE-AF 工厂架构](https://github.com/Agent-Field/SWE-AF) — 2026 年参考多智能体工厂
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT) — 基于角色的多智能体框架
- [AutoGen v0.4](https://github.com/microsoft/autogen) — 微软的类型化角色框架
- [Cognition AI (Devin)](https://cognition.ai) — 参考产品
- [Factory Droids](https://www.factory.ai) — 备选参考产品
- [Google A2A 协议](https://developers.google.com/agent-to-agent) — 智能体间消息规范
- [git worktree 文档](https://git-scm.com/docs/git-worktree) — 隔离底层
- [SWE-bench Pro](https://www.swebench.com) — 评估目标
