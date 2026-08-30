# 03 · Reflexion：语言强化学习

> 基于梯度的强化学习需要数千次试验和一个 GPU 集群才能修复一种失败模式。而 Reflexion（Shinn 等人，NeurIPS 2023）用自然语言就能做到：每次试验失败后，智能体写下一段反思，存入「情景记忆（episodic memory）」，并让下一次试验以该记忆为条件。这正是 Letta 的「睡眠期计算（sleep-time compute）」、Claude Code 的 `CLAUDE.md` 学习记录，以及 pro-workflow 的 learn-rule 背后的模式。

**类型：** 构建
**语言：** Python（标准库）
**前置：** 第 14 阶段 · 01（智能体循环 Agent Loop）、第 14 阶段 · 02（ReWOO）
**时长：** 约 60 分钟

## 学习目标

- 说出 Reflexion 的三个组件（「行动者（Actor）」、「评估器（Evaluator）」、「自我反思器（Self-Reflector）」）以及情景记忆的作用。
- 用标准库实现一个 Reflexion 循环，包含二元评估器、反思缓冲区与全新的重新尝试。
- 针对给定任务，在标量、启发式与自我评估三种反馈来源之间做出选择。
- 解释为什么语言强化能捕获那些基于梯度的强化学习需要数千次试验才能修复的错误。

## 问题所在

一个智能体在任务上失败了。在标准强化学习中，你会再跑数千次试验，计算梯度，更新权重。这既昂贵又缓慢，而且大多数生产环境的智能体并没有为每次失败都配备训练预算。

Reflexion（Shinn 等人，arXiv:2303.11366）提出了一个不同的问题：如果智能体只是思考一下自己为何失败，然后把这个想法放进提示词里再试一次会怎样？没有权重更新，没有梯度，只有在试验之间存储的自然语言。

结果是：在 ALFWorld 上，它击败了 ReAct 和其他未经微调的基线；在 HotpotQA 上，它优于 ReAct；在代码生成任务（HumanEval/MBPP）上，它在当时刷新了最优水平（state of the art）。这一切都没有用到任何一步梯度。

## 核心概念

### 三个组件

```
Actor         : generates a trajectory (ReAct-style loop)
Evaluator     : scores the trajectory — binary, heuristic, or self-eval
Self-Reflector: writes a natural-language reflection on the failure
```

外加一个数据结构：

```
Episodic memory: list of prior reflections, prepended to the next trial's prompt
```

一次试验运行 Actor，由 Evaluator 给它打分。如果分数很低，Self-Reflector 就产出一段反思（「我选错了工具，因为我把问题误读成在问 X，但它其实在问 Y」）。这段反思进入情景记忆。下一次试验从头开始，但能看到这段反思。

### 三种评估器类型

1. **标量（Scalar）** —— 一个外部的二元信号。ALFWorld 成功或失败，HumanEval 测试通过或不通过。最简单，信号最强。
2. **启发式（Heuristic）** —— 预定义的失败特征。「如果智能体连续两次产出同一动作，标记为卡住。」「如果轨迹超过 50 步，标记为低效。」
3. **自我评估（Self-evaluated）** —— LLM 给自己的轨迹打分。当没有「真值（ground truth）」可用时需要它。信号较弱；与基于工具的验证搭配效果更好（第 05 课 —— CRITIC）。

2026 年的默认做法是混合使用：有标量时用标量，没有时用自我评估，并以启发式作为安全护栏。

### 为什么这能泛化

与其说 Reflexion 是一种新算法，不如说它是一种被命名的模式。几乎每个生产环境中的「自愈（self-healing）」智能体都运行着它的某种变体：

- Letta 的睡眠期计算（第 08 课）：一个独立的智能体对过往对话进行反思，并写入记忆块（memory blocks）。
- Claude Code 的 `CLAUDE.md` /「保存记忆」模式：将反思捕获为学习记录，预置到未来的会话中。
- pro-workflow 的 `/learn-rule` 命令：把纠正捕获为明确的规则。
- LangGraph 的反思节点：一个节点为输出打分，并在需要时路由到精炼步骤。

它们都源自同一个洞见：自然语言是一种足够丰富的媒介，足以在多次运行之间承载「我从失败中学到了什么」。

### 何时有效，何时无效

Reflexion 在以下情况下有效：

- 存在明确的失败信号（测试失败、工具报错、答案错误）。
- 任务类别可复现（同一类型的问题可以再次提出）。
- 反思有改进轨迹的空间（动作预算足够）。

Reflexion 在以下情况下帮不上忙：

- 智能体第一次尝试就已经成功。
- 失败是外部原因（网络中断、工具损坏）—— 对「网络中断了」进行反思对未来的运行毫无帮助。
- 反思变成了迷信 —— 为一次偶发的不稳定运行存下一段叙事。

2026 年的陷阱：记忆腐烂（memory rot）。反思不断累积；其中一些已经过时或错误；随着情景缓冲区增长，重新运行变得越来越慢。缓解办法：定期压缩（第 06 课）、给反思设置 TTL，或使用一个独立的睡眠期清理智能体（Letta）。

## 动手构建

`code/main.py` 在一个玩具谜题上实现了 Reflexion：生成一个三元素列表，其和等于给定目标值。Actor 给出候选列表；Evaluator 检查总和；Self-Reflector 写下一行关于哪里出错的说明。这段反思进入情景记忆，供下一次试验使用。

组件：

- `Actor` —— 一个脚本化的策略，在看到反思时会改进。
- `Evaluator.binary()` —— 对目标和的通过/失败判定。
- `SelfReflector` —— 为失败生成一行诊断。
- `EpisodicMemory` —— 一个带 TTL 语义的有界列表。

运行它：

```
python3 code/main.py
```

跟踪输出显示三次试验。试验 1 失败，存下一段反思；试验 2 看到反思后有所改进但仍然失败；试验 3 成功。与基线运行（无反思）对比 —— 基线会一直卡在试验 1 的答案上。

## 实际运用

LangGraph 将反思作为一种节点模式提供。Claude Code 的 `/memory` 命令和 pro-workflow 的 `/learn-rule` 把情景缓冲区外化为一个 markdown 文件。Letta 的睡眠期计算在空闲时段运行 Self-Reflector，从而让主智能体保持受延迟约束（latency-bound）的状态。OpenAI Agents SDK 不直接提供 Reflexion；你需要用一个自定义的「护栏（Guardrail）」来按分数拒绝轨迹，再用一个跨运行存续的记忆 `Session` 来构建它。

## 交付落地

`outputs/skill-reflexion-buffer.md` 创建并维护一个情景缓冲区，具备反思捕获、TTL 与去重功能。给定一个任务类别和一次失败，它会产出一段真正能帮助下一次试验的反思（而不是泛泛的「下次更小心一点」）。

## 练习

1. 从二元评估器切换到返回距离度量（离目标有多远）的标量评估器。它收敛得更快吗？
2. 给反思加上 10 次试验的 TTL。超过这个点后，更早的反思是有害还是有益？
3. 实现启发式评估器：如果同一动作重复出现，就把该次试验标记为卡住。它与 Self-Reflector 如何相互作用？
4. 用一个忽略反思的对抗性 Actor 来运行 Reflexion。要让 Actor 注意到反思，所需的最小反思提示词工程是什么？
5. 阅读 Reflexion 论文中关于 AlfWorld 的第 4 节。在概念上复现那 130% 的成功率提升：相比原版 ReAct，关键差异是什么？

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| Reflexion | 「自我纠正」 | Shinn 等人 2023 —— Actor、Evaluator、Self-Reflector 加上情景记忆 |
| 语言强化（Verbal reinforcement） | 「无梯度学习」 | 预置到下一次试验提示词中的自然语言反思 |
| 情景记忆（Episodic memory） | 「按任务存的反思」 | 针对单一任务类别的、由先前反思构成的有界缓冲区 |
| 标量评估器（Scalar evaluator） | 「二元成功信号」 | 来自真值的通过/失败或数值评分 |
| 启发式评估器（Heuristic evaluator） | 「基于模式的检测器」 | 预定义的失败特征（如卡死循环、步数过多） |
| 自我评估器（Self-evaluator） | 「对自身轨迹的 LLM 充当裁判」 | 无真值时信号较弱的兜底方案 —— 与基于工具的验证搭配使用 |
| 记忆腐烂（Memory rot） | 「过时的反思」 | 情景缓冲区被陈旧条目填满；用压缩/TTL 修复 |
| 睡眠期反思（Sleep-time reflection） | 「异步自我反思」 | 在热路径之外运行 Self-Reflector，让主智能体保持快速 |

## 延伸阅读

- [Shinn et al., Reflexion: Language Agents with Verbal Reinforcement Learning (arXiv:2303.11366)](https://arxiv.org/abs/2303.11366) —— 经典原始论文
- [Letta, Sleep-time Compute](https://www.letta.com/blog/sleep-time-compute) —— 生产环境中的异步反思
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) —— 把情景缓冲区作为上下文的一部分来管理
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) —— 反思节点模式
