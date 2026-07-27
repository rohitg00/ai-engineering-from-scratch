# 自主编码智能体全景图（2026）

> SWE-bench Verified 在不到三年内从 4% 跃升至 80.9%。同一套 Claude Sonnet 4.5 在 SWE-agent v1 上得分为 43.2%，在 Cline 自主模式下则为 59.8%——模型周围的脚手架（scaffolding）如今已与模型本身同等重要。OpenHands（前身为 OpenDevin）是最活跃的 MIT 许可平台，其 CodeAct 循环直接在沙箱中执行 Python 动作，而非使用 JSON 工具调用。这些头条数字背后隐藏着一个方法论问题：500 个 SWE-bench Verified 任务中有 161 个仅需 1–2 行修改，而 SWE-bench Pro（10 行以上任务）上同一批前沿模型的得分仅为 23–59%。

**类型：** 学习
**语言：** Python（标准库，CodeAct 与 JSON 工具调用对比）
**前置知识：** 阶段 14 · 07（工具使用），阶段 15 · 01（长程智能体）
**时间：** ~45 分钟

## 问题

"哪个编码智能体最好"是一个错误的问题。正确的问题是：在与我的工作匹配的任务分布上，使用我将在生产环境中运行的脚手架，我能获得怎样的端到端可靠性？

2022 年至 2026 年间，业界认识到脚手架——检索层、规划器、沙箱、编辑-验证循环、反馈格式——是承重结构。Claude Sonnet 4.5 在 SWE-agent v1 上得分为 43.2%；同一模型在 Cline 的自主脚手架内得分为 59.8%。16.6 个百分点的差异，相同的权重。基础模型是一个组件，循环才是产品。

伴随而来的问题是，基准饱和掩盖了性能退化。SWE-bench Verified 已接近饱和，简单任务的尾部（500 个任务中有 161 个需要 ≤2 行修改）拉高了顶尖得分。真实场景的质量更适合用 SWE-bench Pro（10 行以上修改）这类分布来衡量，同一批领先系统在该基准上仍只有 23–59%。

## 概念

### SWE-bench，一段话概括

SWE-bench（Jimenez 等人）选取带有真实补丁的 GitHub Issue，要求智能体生成一个让测试套件通过的补丁。SWE-bench Verified（OpenAI，2024）是一个经过人工筛选的 500 任务子集，剔除了歧义和错误的任务。SWE-bench Pro 是难度更高的后继版本——要求 10 行以上修改的任务，当前前沿智能体得分在 23–59% 之间。

### 2022 → 2026 曲线实际揭示的内容

- **2022 年**：研究模型在原始 SWE-bench 上约 4%。
- **2024 年**：GPT-4 + Devin 风格脚手架约 14%；SWE-agent 约 12%。
- **2025 年**：Aider 和 SWE-agent 内的 Claude 3.5/3.7 Sonnet 推进到 40–55% 范围。
- **2026 年**：Claude Sonnet 4.5 及前沿竞品在 SWE-bench Verified 上达到 70–80%+。Epoch AI 的排行榜实时追踪这一数据。

斜率来自三个叠加因素：更好的基础模型、更好的脚手架（CodeAct、反思、验证器循环），以及更好的基准（Verified 消除了噪声）。

### CodeAct 与 JSON 工具调用

OpenHands（All-Hands-AI，arXiv:2407.16741，前身为 OpenDevin）做出了一项特定的架构选择：模型不是发出由宿主解码并执行的 JSON 工具调用，而是发出 Python 代码，由 Jupyter 风格的内核在沙箱中运行。智能体可以在一个动作内循环处理文件、链式调用工具并捕获自身异常。

权衡如下：

- **JSON 工具调用**：每个动作是一个回合；易于审计；组合性有限；默认安全，因为每次调用都经过显式验证器。
- **CodeAct**：一个动作可以是一个完整程序；组合性强；需要强化的沙箱（OpenHands 使用 Docker 隔离）；故障模式包括沙箱运行时允许的任何行为。

两种架构均已投入生产。CodeAct 在开放平台（OpenHands、smolagents）中占主导地位。JSON 工具调用在托管服务（Anthropic Managed Agents、OpenAI Assistants）中仍占主导地位，因为提供商控制执行器。

### 2026 年全景图中的脚手架

| 脚手架 | 许可证 | 执行模型 | 显著特性 |
|---|---|---|---|
| OpenHands (OpenDevin) | MIT | Docker 中的 CodeAct | 最活跃的开放平台；事件流可回放 |
| SWE-agent | MIT | 智能体-计算机接口 (ACI) | 首个端到端 SWE-bench 脚手架 |
| Aider | Apache-2 | 本地仓库中通过 diff 编辑 | 最小脚手架，回归稳定性强 |
| Cline | Apache-2 | 带工具策略的 VS Code 智能体 | Sonnet 4.5 上得分最高的开放脚手架 |
| Devin (Cognition) | 专有 | 托管 VM + 规划器 | 首个"AI 软件工程师"产品类别 |
| Claude Code | 专有 | 权限模式 + 例程 | 第 10 课详细介绍智能体循环 |

### 脚手架为何占主导地位

编码运行是一个长程轨迹（第 1 课）。可靠性在步骤间累积。脚手架带来提升的三个关键点：

1. **检索**：找到要读取的正确文件是沉默的瓶颈。SWE-agent 的 ACI、OpenHands 的文件索引和 Aider 的仓库映射都在解决这个问题。
2. **验证器循环**：运行测试、读取堆栈跟踪并重试，在 SWE-bench 上可带来 10 个百分点的差异。
3. **故障隔离**：出错时回滚的沙箱可防止级联损害。带有和没有验证器循环的同一模型，看起来就像两个不同的产品。

### 基准饱和与真实分布

OpenHands 作者和 Epoch AI 均指出，SWE-bench Verified 存在简单的尾部：500 个任务中有 161 个仅需 1–2 行修改。高分部分是由这个尾部驱动的。SWE-bench Pro 限制为 10 行以上修改，即使是前沿系统得分也仅在 23–59% 范围内。你的生产分布几乎肯定更接近 Pro 而非 Verified。

选择智能体的启示：在你自己的 Bug 积压中运行类似 Pro 的子集。真正重要的分数是那些代表你交付任务的得分。

## 动手实践

`code/main.py` 在固定的小型任务分布上比较两个玩具智能体脚手架：

1. 一个 **JSON 工具调用** 脚手架，每回合执行一个动作。
2. 一个 **CodeAct** 脚手架，每个动作可发出一段小 Python 代码片段。

两者均使用存根"模型"（确定性规则），因此比较隔离了脚手架与模型质量的影响。输出显示 CodeAct 脚手架以更少的回合解决了更多任务，代价是每个动作的影响范围更大。

## 落地应用

`outputs/skill-scaffold-audit.md` 帮助你在采用某个编码智能体脚手架之前对其进行审计：检索质量、验证器存在性、沙箱隔离，以及基准与分布匹配度。

## 练习

1. 运行 `code/main.py`。每个脚手架在相同任务集上需要多少个回合？每个动作的影响范围分别有多大？

2. 阅读 OpenHands 论文（arXiv:2407.16741）。该论文认为 CodeAct 在复杂任务上优于 JSON 工具调用。指出论文承认的一种故障模式，并用一句话说明该模式在生产环境中何时会占主导地位。

3. 从你的 Bug 积压中选择一个需要跨两个文件修改 10 行以上代码的任务。估算前沿模型在 (a) JSON 工具调用和 (b) CodeAct 下的端到端成功概率。说明差距理由。

4. SWE-bench Verified 有 161 个单文件、1–2 行修改的任务。构建一个排除它们的评分。排行榜会如何变化？

5. 阅读"Introducing SWE-bench Verified"（OpenAI）。解释用于消除歧义任务的具体方法论，并指出筛选会遗漏的一个类别。

## 关键术语

| 术语 | 人们通常说的 | 实际含义 |
|---|---|---|
| SWE-bench | "编码基准" | 带有真实补丁和测试套件的实际 GitHub Issue |
| SWE-bench Verified | "清理后的子集" | 500 个人工筛选任务，存在简单尾部 |
| SWE-bench Pro | "更难的子集" | 10 行以上修改；前沿得分 23–59% |
| CodeAct | "代码即动作" | 智能体发出 Python 代码；Jupyter 风格内核在沙箱中执行 |
| JSON 工具调用 | "函数调用" | 每个动作是结构化的 JSON 载荷，执行前经过验证 |
| Scaffold（脚手架） | "智能体框架" | 围绕基础模型的检索 + 规划器 + 执行器 + 验证器循环 |
| ACI（智能体-计算机接口） | "SWE-agent 的格式" | 为 LLM 人体工学而非人机 Shell 设计的命令集 |
| 验证器循环 | "测试并重试" | 运行测试、读取输出、修改补丁；最大的非模型可靠性提升 |

## 扩展阅读

- [Jimenez 等人 — SWE-bench](https://www.swebench.com/) — 原始基准和方法论。
- [OpenAI — Introducing SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — 如何构建筛选后的子集。
- [Wang 等人 — OpenHands: An Open Platform for AI Software Developers](https://arxiv.org/abs/2407.16741) — CodeAct 架构和事件流设计。
- [Epoch AI — SWE-bench 排行榜](https://epoch.ai/benchmarks) — 实时追踪的评分。
- [Anthropic — Measuring agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) — 长程编码智能体可靠性框架。
