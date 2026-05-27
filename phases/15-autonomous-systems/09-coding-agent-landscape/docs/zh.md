# 自主编码智能体格局（2026）

> SWE-bench Verified 在不到三年内从4%上升到80.9%。同一 Claude Sonnet 4.5 在 SWE-agent v1 上得分43.2%，在 Cline 自主上得分59.8%——模型周围的脚手架现在与模型本身一样重要。OpenHands（前 OpenDevin）是最活跃的 MIT 许可平台，其 CodeAct 循环直接在沙箱中执行 Python 操作，而不是 JSON 工具调用。标题数字隐藏了一个方法论问题：500个 SWE-bench Verified 任务中有161个只需要1-2行更改，SWE-bench Pro（10+行任务）对于同一前沿模型处于23-59%。

**类型：** 学习
**语言：** Python（标准库，CodeAct vs JSON 工具调用比较）
**前置条件：** 第14阶段 · 07（工具使用），第15阶段 · 01（长时域智能体）
**时间：** 约45分钟

## 问题

"哪个编码智能体最好"是错误的问题。正确的问题是：在与我的工作匹配的任务分布上，使用我将在生产中运行的脚手架，我得到什么端到端可靠性？

在2022年和2026年之间，该领域了解到，脚手架——检索层、规划器、沙箱、编辑验证循环、反馈格式——是承重的。Claude Sonnet 4.5 在 SWE-agent v1 上在 SWE-bench Verified 上得分43.2%；同一模型在 Cline 的自主脚手架内得分59.8%。16.6个百分点的差异，相同的权重。基础模型是一个组件；循环是产品。

伴随的问题是基准饱和隐藏了回归。SWE-bench Verified 接近饱和，简单任务尾部（500个任务中需要 ≤2行的161个）拉高了顶级分数。真实世界质量更好地在像 SWE-bench Pro（10+行更改）这样的分布上衡量，其中同一领导者仍处于23-59%。

## 概念

### SWE-bench，一段话

SWE-bench（Jimenez 等人）采用具有真实补丁和测试套件的真实 GitHub 问题，并要求智能体生成使测试套件通过的补丁。SWE-bench Verified（OpenAI，2024）是一个人工策展的500任务子集，移除了模糊和破坏的任务。SWE-bench Pro 是更困难的继任者——需要10+行更改的任务，当前前沿智能体处于23-59%。

### 2022 → 2026 曲线实际显示的内容

- **2022年**：原始 SWE-bench 上的研究模型约4%。
- **2024年**：GPT-4 + Devin 风格脚手架约14%；SWE-agent 约12%。
- **2025年**：Aider 和 SWE-agent 内的 Claude 3.5/3.7 Sonnet 推入40-55%范围。
- **2026年**：Claude Sonnet 4.5 和前沿竞争者在 SWE-bench Verified 上达到70-80%+。Epoch AI 的排行榜实时跟踪这一点。

斜率来自三个复合来源：更好的基础模型、更好的脚手架（CodeAct、反思、验证器循环）和更好的基准（Verified 移除噪声）。

### CodeAct vs JSON 工具调用

OpenHands（All-Hands-AI，arXiv:2407.16741，前 OpenDevin）采取了一个特定的架构赌注：模型不是发出由主机解码和执行的 JSON 工具调用，而是发出 Python 代码，Jupyter 风格的核在沙箱中运行它。智能体可以循环文件、链式工具，并在一个动作中捕获自己的异常。

权衡：

- **JSON 工具调用**：每个动作是一轮；易于审计；有限的组合性；默认安全，因为每个调用都通过显式验证器。
- **CodeAct**：一个动作可以是一个完整程序；组合性的；需要加固的沙箱（OpenHands 使用 Docker 隔离）；失败模式包括沙箱运行时允许的任何事情。

两种架构都在生产中。CodeAct 在开放平台（OpenHands、smolagents）中占主导地位。JSON 工具调用在托管服务（Anthropic Managed Agents、OpenAI Assistants）中仍然占主导地位，其中提供者控制执行器。

### 2026 年格局中的脚手架

| 脚手架 | 许可证 | 执行模型 | 显著属性 |
|---|---|---|---|
| OpenHands（OpenDevin） | MIT | Docker 中的 CodeAct | 最活跃的开放平台；事件流可重放 |
| SWE-agent | MIT | 智能体-计算机接口（ACI） | 第一个端到端 SWE-bench 脚手架 |
| Aider | Apache-2 | 本地仓库中的差异编辑 | 最小脚手架，强回归稳定性 |
| Cline | Apache-2 | 带有工具策略的 VS Code 智能体 | Sonnet 4.5 上得分最高的开放脚手架 |
| Devin（Cognition） | 专有 | 托管 VM + 规划器 | 第一个"AI 软件工程师"产品类别 |
| Claude Code | 专有 | 权限模式 + 例程 | 第10课详细介绍了智能体循环 |

### 为什么脚手架占主导地位

编码运行是一个长时域轨迹（第1课）。可靠性跨步骤复合。脚手架购买点的三个地方：

1. **检索**：找到要读取的正确文件是静默瓶颈。SWE-agent 的 ACI、OpenHands 的文件索引和 Aider 的仓库映射都攻击这一点。
2. **验证器循环**：运行测试、读取堆栈跟踪和重新尝试在 SWE-bench 上是10+个百分点的增量。
3. **失败遏制**：在错误时回滚的沙箱防止复合损害。有和没有验证器循环的同一模型看起来像两个不同的产品。

### 基准饱和和真实分布

OpenHands 作者和 Epoch AI 都标记 SWE-bench Verified 有一个简单的尾部：500个任务中有161个只需要1-2行更改。高分部分由这个尾部驱动。SWE-bench Pro 限制为10+行更改，即使对于前沿系统也返回23-59%的分数。你的生产分布几乎肯定更接近 Pro 而不是 Verified。

选择智能体的含义：运行你自己的 Bug 积压的类似 Pro 的子集。重要的分数是代表你出货的任务上的分数。

## 使用

`code/main.py` 在固定的迷你任务分布上比较两个玩具智能体脚手架：

1. 每轮采取一个动作的 **JSON 工具调用** 脚手架。
2. 每个动作可以发出一个小 Python 片段的 **CodeAct** 脚手架。

两者都使用存根"模型"（确定性规则），因此比较将脚手架与模型质量隔离。输出显示 CodeAct 脚手架以更大的每动作爆炸半径为代价，在更少轮次中解决更多任务。

## 实战

`outputs/skill-scaffold-audit.md` 帮助你在采用之前审计提议的编码智能体脚手架：检索质量、验证器存在、沙箱隔离和基准到分布拟合。

## 练习

1. 运行 `code/main.py`。每个脚手架在同一个任务集上需要多少轮？每个的每动作爆炸半径是多少？

2. 阅读 OpenHands 论文（arXiv:2407.16741）。论文认为 CodeAct 在复杂任务上击败 JSON 工具调用。确定一个论文承认的失败模式，并写一句话说明该模式在生产中何时会占主导地位。

3. 从你的 Bug 积压中选择一个需要跨两个文件10+行更改的任务。估计（a）JSON 工具调用和（b）CodeAct 下前沿模型的端到端成功概率。证明差距的合理性。

4. SWE-bench Verified 有161个单文件、1-2行任务。构建一个排除它们的分数。排行榜如何洗牌？

5. 阅读"Introducing SWE-bench Verified"（OpenAI）。解释用于移除模糊任务的特定方法论，并命名策展会错过的一个类别。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|---|---|---|
| SWE-bench | "编码基准" | 具有真实补丁和测试套件的真实 GitHub 问题 |
| SWE-bench Verified | "清理的子集" | 500个人工策展的任务，存在简单尾部 |
| SWE-bench Pro | "更困难的子集" | 10+行更改；前沿处于23-59% |
| CodeAct | "代码即动作" | 智能体发出 Python；Jupyter 风格的内核在沙箱中执行 |
| JSON 工具调用（JSON Tool Call） | "函数调用" | 每个动作是在执行前验证的结构化 JSON 有效负载 |
| 脚手架（Scaffold） | "智能体框架" | 基础模型周围的检索 + 规划器 + 执行器 + 验证器循环 |
| ACI（智能体-计算机接口） | "SWE-agent 的格式" | 为 LLM 人体工程学设计的命令集，而不是人类 Shell |
| 验证器循环（Verifier Loop） | "测试并重试" | 运行测试，读取输出，修改补丁；最大的非模型可靠性增益 |

## 延伸阅读

- [Jimenez 等人 — SWE-bench](https://www.swebench.com/) — 原始基准和方法论。
- [OpenAI — 介绍 SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — 策展子集是如何构建的。
- [Wang 等人 — OpenHands：AI 软件开发者的开放平台](https://arxiv.org/abs/2407.16741) — CodeAct 架构和事件流设计。
- [Epoch AI — SWE-bench 排行榜](https://epoch.ai/benchmarks) — 实时跟踪的分数。
- [Anthropic — 测量智能体自主性](https://www.anthropic.com/research/measuring-agent-autonomy) — 长时域编码智能体可靠性框架。
