# 自主编码 agent 全景图（2026）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> SWE-bench Verified 在不到三年的时间里从 4% 涨到 80.9%。同一个 Claude Sonnet 4.5，在 SWE-agent v1 上拿到 43.2%，在 Cline autonomous 上拿到 59.8%——围绕模型搭建的 scaffolding（脚手架）现在和模型本身一样重要。OpenHands（前身是 OpenDevin）是最活跃的 MIT 协议平台，它的 CodeAct loop 直接在 sandbox（沙箱）里执行 Python 动作，而不是走 JSON tool call。耀眼的数字背后藏着一个方法论问题：SWE-bench Verified 500 个任务里有 161 个只需要改 1–2 行代码，而 SWE-bench Pro（10 行以上改动的任务）上同一批前沿模型只能拿到 23–59%。

**Type:** Learn
**Languages:** Python（标准库，CodeAct vs JSON tool-call 对比）
**Prerequisites:** Phase 14 · 07（Tool use）, Phase 15 · 01（长链路 agent）
**Time:** ~45 minutes

## 问题（The Problem）

「哪个编码 agent 最好」是一个错的问题。对的问法是：在与我的工作匹配的任务分布上，配上我会在生产里跑的 scaffolding，端到端的可靠性能到多少？

2022 到 2026 年间，整个领域学到了一件事：scaffolding——retrieval（检索）层、planner（规划器）、sandbox、edit-verify loop（编辑—验证循环）、反馈格式——是承重结构。Claude Sonnet 4.5 在 SWE-agent v1 上得 43.2%；同一个模型放进 Cline 的 autonomous scaffold 里得 59.8%。同样的权重，绝对值差了 16.6 个点。基础模型只是一个组件；loop 才是产品。

与之伴生的另一个问题是：基准饱和会掩盖回归。SWE-bench Verified 已经接近饱和，而那条容易任务的长尾（500 个任务里 161 个只要 ≤2 行改动）把头部分数拉了上去。真实世界的质量更适合在 SWE-bench Pro（10 行以上改动）那种分布上度量——在那里，同样这些领头羊还停留在 23–59%。

## 概念（The Concept）

### SWE-bench，一段话讲完（SWE-bench, one paragraph）

SWE-bench（Jimenez 等人）取真实的 GitHub issue 和它们对应的 ground-truth 补丁，要求 agent 产出一个能让测试套件通过的补丁。SWE-bench Verified（OpenAI，2024）是一个 500 任务的子集，由人工筛选，去掉了模糊和坏掉的任务。SWE-bench Pro 是更难的后继版本——任务要求 10 行以上的改动，当前前沿 agent 在上面只有 23–59%。

### 2022 → 2026 这条曲线到底说明了什么（What the 2022 → 2026 curve actually shows）

- **2022**：研究模型在原始 SWE-bench 上约 4%。
- **2024**：GPT-4 + Devin 风格 scaffolding 约 14%；SWE-agent 约 12%。
- **2025**：Claude 3.5/3.7 Sonnet 在 Aider 和 SWE-agent 里把分数推进到 40–55% 区间。
- **2026**：Claude Sonnet 4.5 和前沿竞争者在 SWE-bench Verified 上 70–80%+。Epoch AI 的榜单实时追踪这条曲线。

斜率来自三股相互叠加的力量：更好的基础模型、更好的 scaffolding（CodeAct、reflection、verifier loop）、更好的基准（Verified 去掉了噪声）。

### CodeAct vs JSON tool call（CodeAct vs JSON tool calls）

OpenHands（All-Hands-AI，arXiv:2407.16741，前身 OpenDevin）下了一个明确的架构赌注：模型不再吐 JSON tool call、由 host 解码后执行，而是直接吐 Python 代码、由一个 Jupyter 风格的 kernel 在 sandbox 里跑。Agent 可以在一次动作里循环遍历文件、串联工具、捕获自己的异常。

权衡在于：

- **JSON tool call**：每次动作就是一个回合；容易审计；组合性受限；默认安全，因为每次调用都过一道显式 validator（验证器）。
- **CodeAct**：一次动作可以是一整段程序；可组合；需要硬化过的 sandbox（OpenHands 用 Docker 隔离）；失败模式包含 sandbox 运行时所允许的一切。

两种架构都在生产里跑。CodeAct 在开放平台里占主导（OpenHands、smolagents）。JSON tool call 在托管服务里仍然占主导（Anthropic Managed Agents、OpenAI Assistants），因为执行器由服务方控制。

### 2026 全景中的 scaffold（Scaffolds in the 2026 landscape）

| Scaffold | 协议 | 执行模型 | 显著特性 |
|---|---|---|---|
| OpenHands（OpenDevin） | MIT | Docker 中的 CodeAct | 最活跃的开源平台；事件流可重放 |
| SWE-agent | MIT | Agent-Computer Interface（ACI） | 第一个端到端的 SWE-bench scaffold |
| Aider | Apache-2 | 在本地 repo 中通过 diff 编辑 | 极简 scaffold，回归稳定性强 |
| Cline | Apache-2 | 带 tool policy 的 VS Code agent | Sonnet 4.5 上得分最高的开源 scaffold |
| Devin（Cognition） | 闭源 | 托管 VM + planner | 开创了「AI 软件工程师」这一产品品类 |
| Claude Code | 闭源 | 权限模式 + routines | 第 10 课会详细讲它的 agent loop |

### 为什么 scaffolding 占主导（Why scaffolding dominates）

一次编码运行就是一条长链路轨迹（第 1 课）。可靠性会跨步骤复合。Scaffolding 在三个地方能买到分数：

1. **Retrieval**：找到正确的文件来读，是那个隐形的瓶颈。SWE-agent 的 ACI、OpenHands 的 file-index、Aider 的 repo-map 都在攻击这个问题。
2. **Verifier loop（验证器循环）**：跑测试、读 stack trace、重试一次——这在 SWE-bench 上是 10+ 个点的差距。
3. **Failure containment（失败收敛）**：一个出错时能回滚的 sandbox，能阻止损害复合。同一个模型，带不带 verifier loop，看起来像两个不同的产品。

### 基准饱和与真实分布（Benchmark saturation and the real distribution）

OpenHands 作者和 Epoch AI 都指出 SWE-bench Verified 有一条「容易尾巴」：500 个任务里 161 个只要 1–2 行改动。高分一部分是被这条尾巴推上去的。SWE-bench Pro 限定为 10 行以上的改动，即使是前沿系统也只能跑出 23–59% 的分数。你的生产分布几乎肯定更接近 Pro，而不是 Verified。

选 agent 时的含义：拿你自己 bug backlog 里类似 Pro 难度的子集去跑。真正重要的分数，是在那些代表你实际要交付内容的任务上的分数。

## 用起来（Use It）

`code/main.py` 在一组固定的迷你任务分布上对比两个玩具 agent scaffold：

1. 一个 **JSON tool-call** scaffold，每回合一个动作。
2. 一个 **CodeAct** scaffold，每个动作可以吐一小段 Python 代码。

两者都使用 stub「模型」（确定性规则），这样比较就把 scaffold 从模型质量里隔离出来了。输出会显示 CodeAct scaffold 在更少的回合里解决了更多任务，代价是每次动作的影响半径更大。

## 上线部署（Ship It）

`outputs/skill-scaffold-audit.md` 帮你在采纳一个编码 agent scaffold 之前对它做审计：retrieval 质量、是否带 verifier、sandbox 隔离、以及基准与你的分布是否匹配。

## 练习（Exercises）

1. 跑 `code/main.py`。在同一组任务上，每个 scaffold 各用了多少回合？每次动作的影响半径分别有多大？

2. 读 OpenHands 论文（arXiv:2407.16741）。论文主张 CodeAct 在复杂任务上胜过 JSON tool call。找出论文承认的一种失败模式，并用一句话写出在生产里这种模式什么时候会占主导。

3. 从你的 bug backlog 里挑一个需要在两个文件里改 10 行以上的任务。估一下前沿模型在 (a) JSON tool call 和 (b) CodeAct 下的端到端成功概率。论证一下两者的差距。

4. SWE-bench Verified 有 161 个单文件、1–2 行的任务。构造一个把它们排除掉的分数。榜单会怎么洗牌？

5. 读《Introducing SWE-bench Verified》（OpenAI）。解释他们用什么具体方法去掉模糊任务，并指出这套筛选会漏掉的一类问题。

## 关键术语（Key Terms）

| 术语 | 大家嘴上怎么说 | 实际意思 |
|---|---|---|
| SWE-bench | 「编码基准」 | 真实的 GitHub issue，配 ground-truth 补丁和测试套件 |
| SWE-bench Verified | 「清洗过的子集」 | 500 个人工筛选的任务，仍带有容易尾巴 |
| SWE-bench Pro | 「更难的子集」 | 10 行以上的改动；前沿停在 23–59% |
| CodeAct | 「代码即动作」 | Agent 吐 Python；Jupyter 风格 kernel 在 sandbox 里执行 |
| JSON tool call | 「函数调用」 | 每个动作是结构化 JSON payload，执行前先验证 |
| Scaffold | 「Agent 框架」 | 围绕基础模型的 retrieval + planner + 执行器 + verifier loop |
| ACI（Agent-Computer Interface） | 「SWE-agent 的格式」 | 为 LLM 人体工学而设计的命令集，不是给人用的 shell |
| Verifier loop | 「测—改」 | 跑测试、读输出、改补丁；非模型层面最大的可靠性增益 |

## 延伸阅读（Further Reading）

- [Jimenez et al. — SWE-bench](https://www.swebench.com/) — 原始基准与方法论。
- [OpenAI — Introducing SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — 那个筛选过的子集是怎么造出来的。
- [Wang et al. — OpenHands: An Open Platform for AI Software Developers](https://arxiv.org/abs/2407.16741) — CodeAct 架构与事件流设计。
- [Epoch AI — SWE-bench leaderboard](https://epoch.ai/benchmarks) — 实时追踪的分数。
- [Anthropic — Measuring agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) — 长链路编码 agent 可靠性的框架性讨论。
