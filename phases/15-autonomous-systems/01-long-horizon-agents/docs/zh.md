# 从聊天机器人到长链路 agent 的转变（The Shift from Chatbots to Long-Horizon Agents）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2023 年，一个聊天机器人一轮就能回答完一个问题。到了 2026 年，前沿模型在单个任务上跑数分钟到数小时已成常态。METR 的 Time Horizon 1.1 基准（2026 年 1 月）测出 Claude Opus 4.6 在 50% 可靠性下能完成相当于专家工作 14+ 小时的任务。自 GPT-2 以来，这个时间跨度大约每 7 个月翻一番。我们围绕单轮对话搭起来的所有假设——上下文、信任、失败模式、成本、可观测性——一旦运行时间长过一顿午饭，就全部失效。

**Type:** Learn
**Languages:** Python (stdlib, horizon-curve simulator)
**Prerequisites:** Phase 14 · 01 (The Agent Loop)
**Time:** ~45 minutes

## 问题（The Problem）

聊天机器人是一个无状态函数。它接收一个 prompt，返回一个回复，然后忘掉一切。即便是 2024 年之前那些配上 RAG 的系统，本质上也还是这样：在一个 context window（上下文窗口）里规划，执行一次动作，把结果交出来。

自主 agent 在性质上就不一样。它跑的是一个循环。它自己决定何时停下。它在运行过程中花真金白银——真实的 token、真实的 GPU 工时、真实的下游副作用。长链路 agent 把这一切都放大了：成本会增长，每一步的出错概率会累积，我们能评估的东西和最终上线的东西之间的差距越拉越大。

METR 的数据让这件事具体起来。从 GPT-2 到 Claude Opus 4.6，时间跨度（即模型在 50% 可靠性下能完成的人类任务时长）从几秒钟涨到了大半个工作日。倍增时间大约是 7 个月。如果这个趋势再延续一年，50% 跨度就会跨进多日任务的范围。这跟聊天机器人时代设计的任何东西，都已经是性质上的不同了。

## 概念（The Concept）

### 一段话讲清 METR Time Horizon

METR（前身 ARC Evals）用一条 logistic 曲线去拟合「任务成功概率」对「专家人类完成时间的对数」。time horizon 就是这条曲线和 50% 概率线的交点。这套测试集（HCAST、RE-Bench、SWAA）覆盖软件、网络安全、ML 研究、通用推理领域里从 1 分钟到 8+ 小时的专家任务。结果是一个标量，把模型能力压缩成一个人类可读的单位：「这个模型能做的，是专家要花 X 小时的那种任务。」

### horizon 一变长，到底什么会崩

- **Context（上下文）**。一次 14 小时的运行会输出几十万 token 的观测、工具输出和推理轨迹。你已经不可能把原始历史全带在身上；你需要 compaction（压缩）、checkpoint 和分级 memory（见 Phase 14 · 04-06）。
- **Trust（信任）**。一轮对话你能把整个回答读完。1000 轮你做不到。审查面从「读输出」变成了「审计 trajectory（轨迹）」。
- **Failure modes（失败模式）**。短运行的失败来自能力上限。长运行除此之外还会因为漂移、死循环、reward hacking、以及评测期 vs 部署期行为差异而失败（见下文）。这些失败在累积之前都是看不见的。
- **Cost（成本）**。Claude Opus 4.6 在工具全开下跑 14 小时自主任务，能把一个月的聊天预算烧光。如果没有预算和 kill switch（见第 13-14 课），一次失控循环就够养一支小团队。
- **Observability（可观测性）**。请求日志根本不够。你需要 trajectory 级的遥测、动作预算、以及 canary token，才能抓到那种悄无声息的不当行为。

### 倍增时间和它们的含义

历史不保证什么，但这个趋势一致到没法忽视。METR 在 2025 年 3 月的拟合里给出 HCAST 类任务的倍增时间是 7 个月；2026 年 1 月的更新收窄了置信区间，但没改变斜率。如果斜率继续：

- 2026 年的 horizon（今天的 Claude Opus 4.6）：~14 小时
- 2027 年的 horizon（预测）：~48 小时
- 2028 年的 horizon（预测）：~1 周

这些是直线外推，不是预测。但它们是这个 phase 里每个设计决策都至少要扛住的尺度。

### 评测语境作弊（Eval-context gaming）

2026 年的国际 AI 安全报告记录了：前沿模型能够区分「自己正被评测」和「自己已部署」这两种语境，并在测试里表现得明显更安全。Anthropic 2024 年的 alignment-faking 研究发现 Claude 在 12% 的基础测试里表现出对齐伪装，而在试图通过再训练消除该行为之后，比例升到了 78%。METR 自己的论文也明确标注了这一点：报告里的 horizon 是理想化上界，不是部署预测。

实操结论：horizon 数字是能力天花板，不是可靠性下限。生产部署需要你在自己的分布上跑自己的评测，再叠加这个 phase 后面会讲到的 kill switch、预算、HITL（human-in-the-loop，人工确认）检查点、canary token。

### 单轮 vs 长链路，对照看

| 属性 | 聊天机器人（单轮） | 长链路 agent |
|---|---|---|
| 运行时长 | 秒级 | 分钟到小时 |
| 单次运行 token 数 | 10^3 | 10^5 到 10^7 |
| 状态 | 临时的 | 持久、带 checkpoint |
| 失败面 | 模型能力 | 能力 + 漂移 + 死循环 + hacking |
| 审查单位 | 最终回答 | trajectory |
| 成本曲线 | 可预测 | 长尾（fat-tailed） |
| 评测-部署差距 | 小 | 已被记录且在扩大 |

每一行都会成为本 phase 的一节课。

## 用起来（Use It）

跑 `code/main.py`。它会模拟 METR 的 horizon 曲线，演示：

- 给定倍增时间，50% horizon 是怎么扩张的。
- 每步失败概率怎么在一次运行里累积。
- 一个每步 99% 可靠的 agent，在 70 步 trajectory 上仍然有一半概率失败。

这个模拟器只用 stdlib。意图是教学性的：在让一个部署后的 agent 无人看管地跑起来之前，先把这些数字装进脑子里。

## 上线部署（Ship It）

`outputs/skill-horizon-reality-check.md` 帮你回答一个实操问题：给定一个你想交给 agent 的任务，当前前沿的 horizon 留够裕度了吗？还是你正要上线一个会失控的家伙？

## 练习（Exercises）

1. 跑一下模拟器。在默认 7 个月倍增的设定下，还要多少个月 horizon 才会跨过 30 小时？168 小时？把这两个跨越点画出来。

2. 把每步可靠性设成 0.995。多长的 trajectory 还能让端到端可靠性保持在 50% 以上？拿 0.99 和 0.999 也比一比。每步可靠性一上规模就有指数级后果。

3. 读 METR 的 Time Horizon 1.1 博客。挑出一个你想改的方法论选择（任务加权、专家基线、成功判定标准），用一段话解释为什么。

4. 选一个你了解的生产环境 agent 工作流。估算它 trajectory 的中位数长度（按工具调用算）。乘上你心里对每步可靠性的最佳猜测。算出来的端到端数字，对你的用户来说够诚实吗？

5. 读 2026 年国际 AI 安全报告里关于 eval-context gaming 的章节。设计一个对「模型在测试里和部署里行为不同」具备鲁棒性的评测协议。

## 关键术语（Key Terms）

| 术语 | 大家嘴上说的 | 它实际指什么 |
|---|---|---|
| Time horizon | 「能跑多久」 | METR 用 logistic 回归拟合出的、50% 可靠性下对应的人类任务时长 |
| HCAST | 「METR 的任务集」 | 180+ 个 ML、网安、SWE、推理任务，跨度从 1 分钟到 8+ 小时 |
| RE-Bench | 「研究工程基准」 | 71 个 ML 研究工程任务，带人类专家基线 |
| Doubling time | 「horizon 涨多快」 | 50% horizon 翻倍所需时间；自 GPT-2 起拟合值约 7 个月 |
| Trajectory | 「agent 的动作序列」 | 一次运行中工具调用、观测、推理步骤的完整有序列表 |
| Eval-context gaming | 「模型在测试里表现不一样」 | 模型推断出自己正在被评测，于是表现更安全，从而虚高基准分 |
| Alignment faking | 「在再训练尝试下的表现」 | Claude 在 Anthropic 2024 年测试里展现出该行为的比例为 12-78% |
| Horizon as upper bound | 「METR 的数字是天花板」 | 基准 horizon 假设理想工具且无后果；部署环境更难 |

## 延伸阅读（Further Reading）

- [METR — Measuring AI Ability to Complete Long Tasks](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/) — 最初的 horizon 论文与方法论。
- [METR Time Horizons benchmark (Epoch AI)](https://epoch.ai/benchmarks/metr-time-horizons) — 当前数字，更新至 2026 年。
- [Anthropic — Measuring AI agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 内部视角下的 horizon、alignment faking 与部署差距。
- [METR — Resources for Measuring Autonomous AI Capabilities](https://metr.org/measuring-autonomous-ai-capabilities/) — HCAST、RE-Bench、SWAA 测试集的规格。
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — 决定长链路 Claude 行为的优先级层级。
