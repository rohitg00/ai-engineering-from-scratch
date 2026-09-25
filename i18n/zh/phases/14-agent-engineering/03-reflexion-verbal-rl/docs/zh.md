# Reflexion：语言化强化学习

> 基于梯度的 RL 需要成千上万次试验和 GPU 集群才能修正一个失败模式。Reflexion（Shinn 等，NeurIPS 2023）用自然语言做到这一点：每次试验失败后，智能体会写一段反思，存入情景记忆，并在下一次试验时以该记忆为条件。这就是 Letta 的睡眠时计算、Claude Code 的 CLAUDE.md 学习记录以及 pro-workflow 的 learn-rule 背后的模式。

**Type:** Build
**Languages:** Python（标准库）
**Prerequisites:** 第 14 阶段 · 01（Agent Loop）、第 14 阶段 · 02（ReWOO）
**Time:** 约 60 分钟

## 学习目标

- 说出 Reflexion 的三个组件（Actor、Evaluator、Self-Reflector）以及情景记忆的作用。
- 用标准库实现一个 Reflexion 循环，包含二值评估器、反思缓冲区和全新重试。
- 针对给定任务，在标量、启发式和自评估反馈源之间做出选择。
- 解释为什么语言化强化学习能够捕获那些基于梯度的 RL 需要成千上万次试验才能修正的错误。

## 问题

智能体完成不了某个任务。在标准 RL 中，你需要再运行成千上万次试验、计算梯度、更新权重。昂贵、缓慢，而且大多数生产环境的智能体没有为每次失败准备训练预算。

Reflexion（Shinn 等，arXiv:2303.11366）提出了一个不同的问题：如果智能体只是思考一下自己为什么失败，然后带着这个思考重新尝试呢？不更新权重。没有梯度。只是在试验之间存储自然语言。

结果：在 ALFWorld 上它超越了 ReAct 和其他未微调基线。在 HotpotQA 上它优于 ReAct。在代码生成（HumanEval/MBPP）上它创下当时的最先进水平。所有这些都不需要一次梯度步。

## 概念

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

一次试验由 Actor 运行。Evaluator 对其评分。如果分数低，Self-Reflector 会生成一段反思（“我选错了工具，因为我把问题误读成了关于 X，而它实际问的是 Y"）。反思进入情景记忆。下一次试验从头开始，但能看到这段反思。

### 三种评估器类型

1. **标量** — 外部二值信号。ALFWorld 成功或失败。HumanEval 测试通过或不通过。最简单，信号最强。
2. **启发式** — 预定义的失败特征。"如果智能体连续两次产生相同动作，标记为卡住。" "如果轨迹超过 50 步，标记为低效。"
3. **自评估** — LLM 对自己的轨迹打分。在没有真值可用时需要用到。信号较弱；适合与基于工具的验证配合使用（第 05 课 — CRITIC）。

2026 年的默认做法是混合使用：有标量就用标量，没有就用自评估，启发式作为安全护栏。

### 为什么这种方法具有普适性

与其说 Reflexion 是一种新算法，不如说它是一个被命名了的模式。几乎所有生产环境的"自愈"智能体都在运行某种变体：

- Letta 的睡眠时计算（第 08 课）：一个独立的智能体对过去的对话进行反思并写入记忆块。
- Claude Code 的 `CLAUDE.md` / "save memory" 模式：将反思作为学习记录捕获，前置到未来的会话中。
- pro-workflow 的 `/learn-rule` 命令：将纠正作为显式规则捕获。
- LangGraph 的反思节点：一个对输出评分并在需要时路由到精化步骤的节点。

所有这些都源于同一个洞见：自然语言是一种足够丰富的媒介，可以在多次运行之间承载"我从失败中学到了什么"。

### 何时有效、何时无效

Reflexion 在以下情况下有效：

- 存在明确的失败信号（测试失败、工具错误、答案错误）。
- 任务类别可复现（同类问题可以再次被问到）。
- 反思有改进轨迹的空间（足够的动作预算）。

Reflexion 在以下情况下没有帮助：

- 智能体首次尝试就已成功。
- 失败是外部的（网络中断、工具损坏）——对“网络中断”的反思对未来运行没有帮助。
- 反思变成迷信——存储关于一次性偶发故障的叙述。

2026 年的陷阱：记忆腐化。反思不断累积；有些已过时或是错误的；随着情景缓冲区增长，重新运行变得更慢。缓解方法：定期压缩（第 06 课）、为反思设置 TTL，或使用独立的睡眠时清理智能体（Letta）。

```figure
react-trace
```

## 动手实现

`code/main.py` 在一个玩具谜题上实现了 Reflexion：生成一个和等于目标值的 3 元素列表。Actor 生成候选列表；Evaluator 检查总和；Self-Reflector 写一行关于哪里出了问题的诊断。反思进入情景记忆，供下一次试验使用。

组件：

- `Actor` — 一个脚本化策略，在看到反思时会改进。
- `Evaluator.binary()` — 对目标总和的通过/失败判定。
- `SelfReflector` — 生成一行关于失败的诊断。
- `EpisodicMemory` — 一个有界列表，带 TTL 语义。

运行：

```
python3 code/main.py
```

轨迹显示三次试验。试验 1 失败，存入一段反思；试验 2 看到反思并有所改进，但仍然失败；试验 3 成功。与基线运行（无反思）对比——它一直卡在试验 1 的答案上。

## 应用

LangGraph 以节点模式提供反思功能。Claude Code 的 `/memory` 命令和 pro-workflow 的 `/learn-rule` 将情景缓冲区外化为一个 markdown 文件。Letta 的睡眠时计算在空闲时段运行 Self-Reflector，使主智能体保持低延迟。OpenAI Agents SDK 不直接提供 Reflexion；你可以用一个按分数拒绝轨迹的自定义 Guardrail 和一个跨运行持久化的记忆 `Session` 来构建它。

## 上线生产

`outputs/skill-reflexion-buffer.md` 创建并维护一个情景缓冲区，包含反思捕获、TTL 和去重。给定任务类别和一次失败，它会生成一段真正能帮助下一次试验的反思（而不是泛泛的"要更加小心"）。

## 练习

1. 从二值评估器切换为返回距离度量（离目标多远）的标量评估器。收敛会更快吗？
2. 为反思添加 10 次试验的 TTL。超过这个时间后，较旧的反思是有害还是有益？
3. 实现启发式评估器：如果相同动作重复出现，将试验标记为卡住。这与 Self-Reflector 如何交互？
4. 用一个忽略反思的对抗性 Actor 运行 Reflexion。要让 Actor 注意到反思，最少需要多少反思提示工程？
5. 阅读 Reflexion 论文中关于 AlfWorld 的第 4 节。从概念上复现 130% 的成功率提升：相比原生 ReAct 的关键差异是什么？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| Reflexion | "自我纠正" | Shinn 等，2023 — Actor、Evaluator、Self-Reflector 加上情景记忆 |
| 语言化强化学习 | "无需梯度的学习" | 前置到下一次试验提示中的自然语言反思 |
| 情景记忆 | "按任务的反思" | 针对一个任务类别的有界先前反思缓冲区 |
| 标量评估器 | "二值成功信号" | 来自真值的通过/失败或数值分数 |
| 启发式评估器 | "基于模式的检测器" | 预定义的失败特征（如卡死循环、步骤过多） |
| 自评估器 | "LLM 作为自身轨迹的裁判" | 没有真值时的低信号兜底方案——需与基于工具的验证配合 |
| 记忆腐化 | "过时的反思" | 情景缓冲区被过时条目填满；用压缩/TTL 解决 |
| 睡眠时反思 | "异步自我反思" | 在热路径之外运行 Self-Reflector，使主智能体保持快速 |

## 延伸阅读

- [Shinn 等，Reflexion: Language Agents with Verbal Reinforcement Learning (arXiv:2303.11366)](https://arxiv.org/abs/2303.11366) — 权威论文
- [Letta, Sleep-time Compute](https://www.letta.com/blog/sleep-time-compute) — 生产环境中的异步反思
- [Anthropic, Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — 将情景缓冲区作为上下文的一部分进行管理
- [LangGraph 概览](https://docs.langchain.com/oss/python/langgraph/overview) — 反思节点模式