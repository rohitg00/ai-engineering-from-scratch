# 09 · 自主编码智能体全景（2026）

> SWE-bench Verified 在不到三年的时间里从 4% 跃升至 80.9%。同一个 Claude Sonnet 4.5 在 SWE-agent v1 上得分 43.2%，而在 Cline 自主模式下得分 59.8%——围绕模型搭建的脚手架（scaffolding），如今与模型本身同样重要。OpenHands（前身为 OpenDevin）是最活跃的 MIT 许可平台，其 CodeAct 循环直接在沙箱中执行 Python 动作，而非 JSON 工具调用。这些醒目的数字背后隐藏着一个方法论问题：SWE-bench Verified 的 500 个任务中有 161 个只需改动 1–2 行代码，而对同样的前沿模型而言，SWE-bench Pro（10 行以上改动的任务）的得分仅落在 23–59% 区间。

**类型：** 学习
**语言：** Python（标准库，CodeAct 与 JSON 工具调用对比）
**前置：** 第 14 阶段 · 07（工具使用），第 15 阶段 · 01（长周期智能体）
**时长：** 约 45 分钟

## 问题所在

「哪个编码智能体最好」是个错误的问题。正确的问题是：在一个与我的工作相匹配的任务分布上，使用我将在生产环境中运行的脚手架，我能获得怎样的端到端可靠性？

在 2022 到 2026 年之间，整个领域意识到：脚手架（scaffolding）——检索层、规划器、沙箱、编辑-验证循环、反馈格式——是承重结构。Claude Sonnet 4.5 在 SWE-agent v1 上的 SWE-bench Verified 得分为 43.2%；同一个模型置于 Cline 的自主脚手架中得分为 59.8%。相同的权重，绝对值相差 16.6 个百分点。基座模型只是一个组件；循环才是产品。

与之相伴的另一个问题是：基准测试饱和会掩盖回退。SWE-bench Verified 已接近饱和，而其简单任务的长尾（500 个任务中有 161 个只需改动 ≤2 行）会把头部得分拉高。真实世界的质量更适合在 SWE-bench Pro（10 行以上改动）这类分布上衡量——在那里，同样的领跑者仍然只有 23–59% 的得分。

## 核心概念

### 一段话讲清 SWE-bench

SWE-bench（Jimenez 等人）取用真实的 GitHub issue 及其标准补丁（ground-truth patch），要求智能体生成一个能让测试套件通过的补丁。SWE-bench Verified（OpenAI，2024）是一个经人工筛选的 500 任务子集，移除了模糊和损坏的任务。SWE-bench Pro 则是更难的后继者——任务需要改动 10 行以上代码，当前的前沿智能体在其上仅有 23–59% 的得分。

### 2022 → 2026 曲线究竟揭示了什么

- **2022 年**：研究模型在原始 SWE-bench 上约为 4%。
- **2024 年**：GPT-4 + Devin 风格脚手架约为 14%；SWE-agent 约为 12%。
- **2025 年**：Claude 3.5/3.7 Sonnet 置于 Aider 和 SWE-agent 中，将得分推进到 40–55% 区间。
- **2026 年**：Claude Sonnet 4.5 及前沿竞争者在 SWE-bench Verified 上达到 70–80%+。Epoch AI 的排行榜实时追踪这一进展。

这条上升斜率来自三个相互叠加的来源：更好的基座模型、更好的脚手架（CodeAct、反思、验证器循环），以及更好的基准测试（Verified 消除了噪声）。

### CodeAct 对比 JSON 工具调用

OpenHands（All-Hands-AI，arXiv:2407.16741，前身为 OpenDevin）下了一个明确的架构赌注：模型不再发出由宿主解码并执行的 JSON 工具调用，而是发出 Python 代码，由一个 Jupyter 风格的内核（kernel）在沙箱中运行它。智能体可以在单个动作内部遍历文件、串联工具，并捕获自己抛出的异常。

权衡如下：

- **JSON 工具调用**：每个动作就是一个回合；易于审计；可组合性有限；默认安全，因为每次调用都会经过一个显式的验证器（validator）。
- **CodeAct**：单个动作可以是一整段程序；可组合；需要一个加固的沙箱（OpenHands 使用 Docker 隔离）；其失败模式包含沙箱运行时所允许的任何操作。

两种架构都在生产中使用。CodeAct 在开放平台（OpenHands、smolagents）中占主导。JSON 工具调用则在托管服务（Anthropic Managed Agents、OpenAI Assistants）中保持主导，因为在那里执行器由服务提供方控制。

### 2026 全景中的各类脚手架

| 脚手架 | 许可证 | 执行模型 | 显著特性 |
|---|---|---|---|
| OpenHands (OpenDevin) | MIT | Docker 中的 CodeAct | 最活跃的开放平台；事件流可重放 |
| SWE-agent | MIT | 智能体-计算机接口（ACI） | 首个端到端的 SWE-bench 脚手架 |
| Aider | Apache-2 | 在本地仓库中通过 diff 编辑 | 极简脚手架，回归稳定性强 |
| Cline | Apache-2 | 带工具策略的 VS Code 智能体 | 在 Sonnet 4.5 上得分最高的开放脚手架 |
| Devin (Cognition) | 专有 | 托管 VM + 规划器 | 开创「AI 软件工程师」产品品类 |
| Claude Code | 专有 | 权限模式 + 例程 | 第 10 课详细讲解智能体循环 |

### 为什么脚手架占主导

一次编码运行是一条长周期轨迹（第 1 课）。可靠性会跨步骤逐级累乘。脚手架在三个地方能换来分数：

1. **检索**：找到该读取的正确文件是一个隐形瓶颈。SWE-agent 的 ACI、OpenHands 的文件索引、Aider 的 repo-map 都在攻克这一点。
2. **验证器循环**：运行测试、阅读堆栈跟踪、再次尝试，在 SWE-bench 上带来 10 个点以上的差距。
3. **失败遏制**：一个在出错时回滚的沙箱可以防止损害逐级累加。同一个模型，有无验证器循环，看起来就像两个不同的产品。

### 基准测试饱和与真实分布

OpenHands 的作者和 Epoch AI 都指出，SWE-bench Verified 存在一条简单长尾：500 个任务中有 161 个只需改动 1–2 行代码。高分有一部分正是由这条长尾推高的。SWE-bench Pro 限定为 10 行以上的改动，即便对前沿系统，得分也回落到 23–59% 区间。你的生产分布几乎可以肯定更接近 Pro，而非 Verified。

对选择智能体的启示：拿你自己的 bug 待办清单跑一个类似 Pro 的子集。真正重要的得分，是在那些能代表你实际交付内容的任务上的得分。

## 动手用

`code/main.py` 在一个固定的迷你任务分布上对比两种玩具级智能体脚手架：

1. 一个**JSON 工具调用**脚手架，每回合执行一个动作。
2. 一个**CodeAct**脚手架，每个动作可以发出一小段 Python 片段。

两者都使用一个桩「模型」（确定性规则），从而让对比把脚手架与模型质量隔离开来。输出显示 CodeAct 脚手架以更少的回合解决了更多任务，代价是每个动作的影响范围（blast radius）更大。

## 上线部署

`outputs/skill-scaffold-audit.md` 帮助你在采用某个候选编码智能体脚手架之前对其进行审计：检索质量、是否存在验证器、沙箱隔离，以及基准测试与实际分布的契合度。

## 练习

1. 运行 `code/main.py`。在同一个任务集上，每种脚手架各花费多少回合？每种脚手架每个动作的影响范围（blast radius）有多大？

2. 阅读 OpenHands 论文（arXiv:2407.16741）。论文主张 CodeAct 在复杂任务上胜过 JSON 工具调用。找出论文所承认的一种失败模式，并用一句话说明这种模式在生产中何时会占主导。

3. 从你的 bug 待办清单中挑选一个需要跨两个文件改动 10 行以上代码的任务。估算一个前沿模型在 (a) JSON 工具调用 和 (b) CodeAct 两种方式下的端到端成功概率。为这一差距给出理由。

4. SWE-bench Verified 有 161 个单文件、1–2 行的任务。构造一个排除它们的评分。排行榜会如何重新洗牌？

5. 阅读《Introducing SWE-bench Verified》（OpenAI）。解释其用于移除模糊任务的具体方法论，并指出一类该筛选过程会遗漏的任务。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|---|---|---|
| SWE-bench | 「编码基准测试」 | 带标准补丁和测试套件的真实 GitHub issue |
| SWE-bench Verified | 「清洗过的子集」 | 500 个人工筛选的任务，仍含较易的长尾 |
| SWE-bench Pro | 「更难的子集」 | 10 行以上改动；前沿模型落在 23–59% |
| CodeAct | 「代码即动作」 | 智能体发出 Python；Jupyter 风格内核在沙箱中执行 |
| JSON tool call | 「函数调用」 | 每个动作是一个结构化的 JSON 负载，执行前经过验证 |
| Scaffold（脚手架） | 「智能体框架」 | 围绕基座模型的检索 + 规划器 + 执行器 + 验证器循环 |
| ACI（智能体-计算机接口） | 「SWE-agent 的格式」 | 为 LLM 工效学而非人类 shell 设计的命令集 |
| Verifier loop（验证器循环） | 「测试后重试」 | 运行测试、读取输出、修订补丁；非模型层面最大的可靠性增益 |

## 延伸阅读

- [Jimenez 等人 — SWE-bench](https://www.swebench.com/) — 原始基准测试及其方法论。
- [OpenAI — Introducing SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — 这个经筛选的子集是如何构建的。
- [Wang 等人 — OpenHands: An Open Platform for AI Software Developers](https://arxiv.org/abs/2407.16741) — CodeAct 架构与事件流设计。
- [Epoch AI — SWE-bench leaderboard](https://epoch.ai/benchmarks) — 实时追踪的得分。
- [Anthropic — Measuring agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) — 长周期编码智能体可靠性的框架视角。
