# Reflexion： verbal 强化学习

> 基于梯度的强化学习需要数千次试验和 GPU 集群来修复一个失败模式。Reflexion（Shinn 等人，NeurIPS 2023）用自然语言做到了：每次失败的试验后，Agent 写一份反思，将其存储在情景记忆（episodic memory）中，并根据该记忆调节下一次试验。这是 Letta 的睡眠时计算（sleep-time compute）、Claude Code 的 CLAUDE.md 学习以及 pro-workflow 的 learn-rule 背后的模式。

**类型：** 构建（Build）
**语言：** Python（标准库）
**前置要求：** 阶段 14 · 01（Agent 循环）、阶段 14 · 02（ReWOO）
**时长：** 约 60 分钟

## 学习目标

- 说出 Reflexion 的三个组成部分（Actor、Evaluator、Self-Reflector）以及情景记忆的作用。
- 实现一个带有二进制评估器、反思缓冲区和全新重试的标准库 Reflexion 循环。
- 针对给定任务，在标量、启发式和自评估反馈源之间进行选择。
- 解释为什么 verbal 强化能捕获基于梯度的强化学习需要数千次试验才能修复的错误。

## 问题背景

一个 Agent 任务失败。在标准强化学习中，你需要运行数千次更多试验，计算梯度，更新权重。昂贵、缓慢，而且大多数生产 Agent 没有为每个失败提供训练预算。

Reflexion（Shinn 等人，arXiv:2303.11366）提出了一个不同的问题：如果 Agent 只是思考它为什么失败，并在提示中带着那个思考再次尝试呢？无需权重更新。无需梯度。只是在试验之间存储的自然语言。

结果：在 ALFWorld 上它击败了 ReAct 和其他非微调基线。在 HotpotQA 上它比 ReAct 有所改进。在代码生成（HumanEval/MBPP）上，它当时达到了最先进水平。所有这一切都没有一个梯度步骤。

## 核心概念

### 三个组成部分

```
Actor         : 生成一个轨迹（ReAct 风格的循环）
Evaluator     : 对轨迹评分——二进制、启发式或自评估
Self-Reflector: 对失败写一份自然语言反思
```

加上一个数据结构：

```
Episodic memory: 先前反思的列表，预置到下一次试验的提示中
```

一次试验运行 Actor。评估器对其评分。如果分数低，Self-Reflector 产生一个反思（"我选错了工具，因为我把问题误读为询问 X，而它实际上在询问 Y"）。反思进入情景记忆。下一次试验从头开始，但看到了反思。

### 三种评估器类型

1. **标量（Scalar）**——外部二进制信号。ALFWorld 成功或失败。HumanEval 测试通过或失败。最简单，信号最强。
2. **启发式（Heuristic）**——预定义的失败签名。"如果 Agent 连续产生相同的行动，标记为卡住。""如果轨迹超过 50 步，标记为低效。"
3. **自评估（Self-evaluated）**——LLM 对自己的轨迹评分。当没有真实标签（ground truth）可用时需要。信号较弱；与工具 grounding 验证配合良好（第 05 课——CRITIC）。

2026 年的默认设置是混合：可用时用标量，不可用时用自评估，启发式作为安全栏。

### 为什么能泛化

Reflexion 与其说是一种新算法，不如说是一个命名模式。几乎每个生产中的"自我修复"Agent 都运行某种变体：

- Letta 的睡眠时计算（第 08 课）：一个独立的 Agent 反思过去的对话并写入记忆块。
- Claude Code 的 `CLAUDE.md` / "保存记忆"模式：反思捕获为学习内容，预置到未来的会话中。
- pro-workflow 的 `/learn-rule` 命令：纠正捕获为显式规则。
- LangGraph 的反思节点：一个对输出评分并在需要时路由到精炼的节点。

所有这些都源于同一个洞察：自然语言是一个足够丰富的媒介，可以在运行之间携带"我从失败中学到了什么"。

### 何时有效、何时无效

Reflexion 在以下情况有效：

- 有明确的失败信号（测试失败、工具错误、错误答案）。
- 任务类别是可复现的（可以再次提出同类型的问题）。
- 反思有改进轨迹的空间（足够的行动预算）。

Reflexion 在以下情况没有帮助：

- Agent 在第一次尝试时就成功了。
- 失败是外部的（网络中断、工具损坏）——对"网络中断"的反思无助于未来的运行。
- 反思变成了迷信——存储关于一次性不稳定运行的描述。

2026 年的陷阱：记忆腐烂（memory rot）。反思积累；有些过时或错误；随着情景缓冲区增长，重新运行变慢。缓解措施：定期压缩（第 06 课）、反思的 TTL，或独立的睡眠时清理 Agent（Letta）。

## 构建它

`code/main.py` 在一个玩具谜题上实现 Reflexion：生成一个和为目标值的 3 元素列表。Actor 发出候选列表；评估器检查总和；Self-Reflector 写一行关于哪里出问题的内容。反思进入下一次试验的情景记忆。

组件：

- `Actor`——一个在看到反思时会改进的脚本化策略。
- `Evaluator.binary()`——对目标总和的通过/失败。
- `SelfReflector`——生成关于失败的单行诊断。
- `EpisodicMemory`——带有 TTL 语义的有界列表。

运行它：

```
python3 code/main.py
```

轨迹显示三次试验。试验 1 失败，存储了一个反思，试验 2 看到反思并改进但仍然失败，试验 3 成功。与基线运行（无反思）比较——它卡在试验 1 的答案上。

## 使用它

LangGraph 将反思作为节点模式发布。Claude Code 的 `/memory` 命令和 pro-workflow 的 `/learn-rule` 将情景缓冲区外化为 Markdown 文件。Letta 的睡眠时计算在停机时间运行 Self-Reflector，以便主 Agent 保持延迟绑定。OpenAI Agents SDK 不直接提供 Reflexion；你可以用一个按分数拒绝轨迹的自定义 Guardrail 和一个跨运行存活的记忆 `Session` 来构建它。

## 部署它

`outputs/skill-reflexion-buffer.md` 创建并维护一个带有反思捕获、TTL 和去重的情景缓冲区。给定任务类别和失败，它发出一个真正有助于下一次试验的反思（不是通用的"更加小心"）。

## 练习

1. 从二进制评估器切换到返回距离度量（离目标多远）的标量评估器。它收敛更快吗？
2. 为反思添加 10 次试验的 TTL。在那之后，较旧的反思是有害还是有帮助？
3. 实现启发式评估器：如果相同的行动重复，将试验标记为卡住。这与 Self-Reflector 如何交互？
4. 使用忽略反思的对抗性 Actor 运行 Reflexion。强制 Actor 注意到它们的最小反思提示工程是什么？
5. 阅读 Reflexion 论文关于 AlfWorld 的第 4 节。从概念上重现 130% 的成功率提升：与 vanilla ReAct 相比的关键增量是什么？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| Reflexion | "自我纠正" | Shinn 等人 2023 年——Actor、Evaluator、Self-Reflector 加上情景记忆 |
| Verbal reinforcement | "无梯度学习" | 预置到下一次试验提示中的自然语言反思 |
| Episodic memory | "每任务反思" | 一个任务类别的先前反思的有界缓冲区 |
| Scalar evaluator | "二进制成功信号" | 来自真实标签的通过/失败或数字分数 |
| Heuristic evaluator | "基于模式的检测器" | 预定义的失败签名（例如卡住循环、步骤过多） |
| Self-evaluator | "LLM 作为自身轨迹的评判" | 无真实标签时的低信号回退——与工具 grounding 验证配对 |
| Memory rot | "陈旧反思" | 情景缓冲区填满过时的条目；用压缩/TTL 修复 |
| Sleep-time reflection | "异步自我反思" | 在热路径外运行 Self-Reflector，以便主 Agent 保持快速 |

## 延伸阅读

- [Shinn et al., Reflexion: Language Agents with Verbal Reinforcement Learning (arXiv:2303.11366)](https://arxiv.org/abs/2303.11366)——规范论文
- [Letta, Sleep-time Compute](https://www.letta.com/blog/sleep-time-compute)——生产中的异步反思
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)——将情景缓冲区作为上下文的一部分进行管理
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)——反思节点模式
