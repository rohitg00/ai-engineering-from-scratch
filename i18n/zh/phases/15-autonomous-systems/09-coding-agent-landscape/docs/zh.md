# 自主编程 Agent 格局（2026）

> SWE-bench Verified 在不到三年内从 4% 提升到 80.9%。同一个 Claude Sonnet 4.5 在 SWE-agent v1 上得分为 43.2%，在 Cline autonomous 上为 59.8%——模型周围的脚手架现在与模型本身同样重要。OpenHands（前身为 OpenDevin）是最活跃的 MIT 许可平台，其 CodeAct 循环直接在沙箱中执行 Python 操作，而不是 JSON 工具调用。这些亮眼数字背后隐藏着一个方法论问题：SWE-bench Verified 的 500 个任务中有 161 个只需要 1–2 行的修改，而 SWE-bench Pro（10+ 行任务）上同样的前沿模型得分仅为 23–59%。

**Type:** Learn
**Languages:** Python (stdlib, CodeAct vs JSON tool-call comparison)
**Prerequisites:** Phase 14 · 07 (Tool use)，Phase 15 · 01 (Long-horizon agents)
**Time:** 约 45 分钟

## 问题所在

"哪个编程 agent 最好" 是一个错误的问题。正确的问题是：在一个与我实际工作相匹配的任务分布上，使用我将在生产环境中运行的脚手架，我能获得怎样的端到端可靠性？

从 2022 年到 2026 年，这个领域认识到脚手架——检索层、规划器、沙箱、编辑-验证循环、反馈格式——是承重结构。Claude Sonnet 4.5 在 SWE-agent v1 中的 SWE-bench Verified 得分为 43.2%；同一个模型放在 Cline 的自主脚手架中得分为 59.8%。同样的权重，绝对差距 16.6 个百分点。基础模型是一个组件；循环才是产品。

伴随的问题是基准饱和掩盖了退步。SWE-bench Verified 已接近饱和，简单任务尾部（500 个任务中有 161 个需要 ≤2 行修改）拉高了顶级分数。真实世界的质量更适合用 SWE-bench Pro（10+ 行修改）这类分布来衡量，同样的领先系统在那里也只有 23–59%。

## 核心概念

### SWE-bench，一段话说明

SWE-bench（Jimenez 等人）选取带有标准补丁（ground-truth patch）的真实 GitHub issue，要求 agent 产出一个能让测试套件通过的补丁。SWE-bench Verified（OpenAI，2024）是经过人工筛选的 500 个任务的子集，去除了模糊和有问题的任务。SWE-bench Pro 是更难的后续版本——任务需要 10+ 行的修改，当前的前沿 agent 在其中得分为 23–59%。

### 2022 → 2026 曲线究竟说明了什么

- **2022**：研究模型在原始 SWE-bench 上约 4%。
- **2024**：GPT-4 + Devin 风格的脚手架约 14%；SWE-agent 约 12%。
- **2025**：Claude 3.5/3.7 Sonnet 在 Aider 和 SWE-agent 中达到 40–55% 区间。
- **2026**：Claude Sonnet 4.5 及前沿竞争者在 SWE-bench Verified 上达到 70–80%+。Epoch AI 的排行榜实时跟踪这一进展。

这一斜率来自三个复合因素：更好的基础模型、更好的脚手架（CodeAct、反思、验证器循环），以及更好的基准（Verified 去除了噪声）。

### CodeAct vs JSON 工具调用

OpenHands（All-Hands-AI，arXiv:2407.16741，前身为 OpenDevin）做了一个特定的架构押注：模型不再输出由宿主解码并执行的 JSON 工具调用，而是输出 Python 代码，由 Jupyter 风格的内核在沙箱中运行它。agent 可以在一次操作内循环遍历文件、串联工具调用，并捕获自身的异常。

权衡如下：

- **JSON 工具调用**：每次操作一个回合；易于审计；组合性有限；默认安全，因为每次调用都经过显式验证器。
- **CodeAct**：一次操作可以是一整个程序；具有组合性；需要一个加固的沙箱（OpenHands 使用 Docker 隔离）；失败模式包括沙箱运行时允许的任何行为。

两种架构都在生产中使用。CodeAct 在开放平台中占主导（OpenHands、smolagents）。JSON 工具调用在托管服务中仍占主导（Anthropic Managed Agents、OpenAI Assistants），在这些服务中由提供商控制执行器。

### 2026 格局中的脚手架

| 脚手架 | 许可证 | 执行模型 | 显著特性 |
|---|---|---|---|
| OpenHands (OpenDevin) | MIT | Docker 中的 CodeAct | 最活跃的开放平台；事件流可回放 |
| SWE-agent | MIT | Agent-Computer Interface (ACI) | 首个端到端 SWE-bench 脚手架 |
| Aider | Apache-2 | 本地仓库中的 diff 编辑 | 极简脚手架，回归稳定性强 |
| Cline | Apache-2 | 带工具策略的 VS Code agent | Sonnet 4.5 上得分最高的开放脚手架 |
| Devin (Cognition) | 专有 | 托管 VM + 规划器 | 首个"AI 软件工程师"产品类别 |
| Claude Code | 专有 | 权限模式 + 常规例程 | 第 10 课详细介绍该 agent 循环 |

### 为什么脚手架占主导地位

一次编程运行是一条长视野轨迹（第 1 课）。可靠性随步骤复合累积。脚手架能带来提升的三个地方：

1. **检索**：找到要读取的正确文件是隐性瓶颈。SWE-agent 的 ACI、OpenHands 的文件索引和 Aider 的 repo-map 都在解决这个问题。
2. **验证器循环**：运行测试、读取堆栈跟踪并重试，在 SWE-bench 上可带来 10+ 个百分点的提升。
3. **失败遏制**：出错时回滚的沙箱能防止损害复合累积。同一个模型有无验证器循环，看起来就像两个不同的产品。

### 基准饱和与真实分布

OpenHands 的作者和 Epoch AI 都指出 SWE-bench Verified 存在简单尾部：500 个任务中有 161 个只需 1–2 行修改。高分部分是由这个尾部驱动的。SWE-bench Pro 限制为 10+ 行修改，即使是前沿系统的得分也回到 23–59% 区间。你的生产分布几乎肯定更接近 Pro 而非 Verified。

对选择 agent 的启示：用你自己的 bug 积压中类似 Pro 的子集进行测试。真正重要的分数是在能代表你所交付内容的任务上的分数。

```figure
a5-scaffold-delta
```

## 使用它

`code/main.py` 在固定的迷你任务分布上比较两个玩具 agent 脚手架：

1. 一个 **JSON 工具调用** 脚手架，每回合执行一次操作。
2. 一个 **CodeAct** 脚手架，每次操作可以输出一小段 Python 代码。

两者都使用存根"模型"（确定性规则），因此该比较将脚手架与模型质量隔离开来。输出显示 CodeAct 脚手架以更少的回合解决更多任务，代价是更大的单次操作影响范围。

## 上线它

`outputs/skill-scaffold-audit.md` 帮助你在采用之前审计一个拟议的编程 agent 脚手架：检索质量、验证器存在性、沙箱隔离，以及基准与分布的匹配度。

## 练习

1. 运行 `code/main.py`。每个脚手架在相同任务集上各需要多少回合？每个脚手架的单次操作影响范围是多少？

2. 阅读 OpenHands 论文（arXiv:2407.16741）。该论文认为 CodeAct 在复杂任务上优于 JSON 工具调用。找出论文承认的一个失败模式，并用一句话说明该模式在何时会在生产环境中成为主导因素。

3. 从你的 bug 积压中选一个需要跨两个文件修改 10+ 行的任务。估算一个前沿模型在 (a) JSON 工具调用和 (b) CodeAct 下的端到端成功概率，并解释这个差距。

4. SWE-bench Verified 有 161 个单文件、1–2 行的任务。构造一个排除它们的分数。排行榜会发生怎样的变化？

5. 阅读 "Introducing SWE-bench Verified"（OpenAI）。解释用于移除模糊任务的具体方法论，并指出这种人工筛选可能遗漏的一个类别。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|---|---|---|
| SWE-bench | "编程基准" | 带有标准补丁和测试套件的真实 GitHub issue |
| SWE-bench Verified | "清洗过的子集" | 500 个人工筛选的任务，仍含较易的尾部 |
| SWE-bench Pro | "更难的子集" | 10+ 行修改；前沿系统得分为 23–59% |
| CodeAct | "以代码为动作" | Agent 输出 Python；Jupyter 风格内核在沙箱中执行 |
| JSON 工具调用 | "函数调用" | 每次操作是一个在执行前经过验证的结构化 JSON 载荷 |
| 脚手架 | "Agent 框架" | 围绕基础模型的检索 + 规划器 + 执行器 + 验证器循环 |
| ACI (Agent-Computer Interface) | "SWE-agent 的格式" | 为 LLM 人体工学而非人类 shell 设计的命令集 |
| 验证器循环 | "测试并重试" | 运行测试、读取输出、修订补丁；最大的非模型可靠性收益 |

## 延伸阅读

- [Jimenez 等人 — SWE-bench](https://www.swebench.com/) — 原始基准与方法论。
- [OpenAI — Introducing SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — 该人工筛选子集的构建方式。
- [Wang 等人 — OpenHands: An Open Platform for AI Software Developers](https://arxiv.org/abs/2407.16741) — CodeAct 架构与事件流设计。
- [Epoch AI — SWE-bench 排行榜](https://epoch.ai/benchmarks) — 实时跟踪的分数。
- [Anthropic — Measuring agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) — 长视野编程 agent 可靠性的分析框架。