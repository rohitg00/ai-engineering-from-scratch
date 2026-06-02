# METR 时间跨度与外部能力评估（METR Time Horizons and External Capability Evaluation）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> METR（前身 ARC Evals）自 2023 年 12 月起成为独立的 501(c)(3) 非营利组织。他们的 Time Horizon 1.1 基准（2026 年 1 月）用 logistic 曲线拟合任务成功概率与 log(专家人类完成时间) 的关系，将 50% 概率处的横轴值定义为模型的 time horizon（时间跨度）。2025–2026 年的合作覆盖了 GPT-5.1、GPT-5.1-Codex-Max，以及监控评估原型（监控器能否抓住 side task；agent 能否绕过监控）。基准套件包括 HCAST（180+ 个 ML、网络安全、SWE、推理类任务，时长跨度从 1 分钟到 8 小时以上）、RE-Bench（71 个带专家基线的 ML 研究工程任务）、SWAA。一个诚实的提醒：METR 的测量是理想化的——没有真人、没有真实后果——团队也已记录了「评估场景行为 vs 部署行为」的落差（第 1 课）。time horizon 是能力上界，而非部署预测。

**Type:** Learn
**Languages:** Python (stdlib, logistic-fit horizon estimator)
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 19 (RSP)
**Time:** ~60 minutes

## 问题（The Problem）

scaling 策略（第 19、20 课）的有用程度，取决于它们引用的测量结果有多扎实。「AI R&D-4 阈值」「Long-range Autonomy」这类概念在策略文本里只是散文式的定义；只有当具体的评估给出具体的数字，它们才真正可执行。

METR 是 2024–2026 年期间外部评估机构里负责「定义这些数字」的代表。他们评估前沿模型——通常是发布前阶段，与各实验室签 NDA——之后再公布方法论。Time Horizon 1.1 基准（2026 年 1 月）是他们的招牌产物：一个标量，把模型能力压缩成人类可读的单位（「这个模型可以以 50% 的可靠性完成专家需要花 X 小时的那类任务」）。

这一课一半讲方法论（horizon 是怎么算出来的），一半讲解读（为什么 horizon 是上界，而不是部署预测）。这两项技能必须放在一起学。一个理解 horizon 是怎么拟合出来的团队，比一个只在 PPT 上看到「14 小时」的团队，更难被糟糕的厂商话术忽悠。

## 概念（The Concept）

### METR 背景（METR background）

- 成立时间：2023 年 12 月（前身 ARC Evals，独立分拆为 501(c)(3) 非营利组织）。
- 业务范围：评估前沿模型的自主能力，多为发布前。
- 合作实验室：Anthropic、OpenAI（2025–2026 年多次合作）。
- 主要交付物：Time Horizon 1.0（2025 年 3 月）、Time Horizon 1.1（2026 年 1 月）、监控评估原型。

### Time Horizon 拟合方法（The Time Horizon fit）

方法论（来自 METR 的博客与论文）：

1. 收集一套任务，专家完成时间从分钟级覆盖到小时级。当前套件：HCAST（180+ 任务）、RE-Bench（71 任务）、SWAA。
2. 让模型跑每一个任务；记录成功或失败。
3. 拟合一条 logistic 曲线：P(success) 关于 log(专家完成时间) 的函数。
4. horizon 是 P(success) = 0.5 处对应的专家时间。

logistic 拟合形状是合适的，因为能力与任务难度的关系通常呈递增、趋向 plateau（饱和）的曲线。50% 这个点是一种取舍（也可以取 10% 或 90%）；METR 在详细论文里报告多个阈值，但主推 50%，因为它最直观。

### 2026 年 1 月的数字（The January 2026 numbers）

来自 Time Horizon 1.1：

- Claude Opus 4.6：在 50% 可靠性下约 14 小时（截至 2026 年 1 月 Time Horizon 1.1）。
- HCAST 风格任务的倍增时间：在 Time Horizon 1.1（2026 年 1 月）报告的「2023 年后」拟合上约为 4.3 个月（130.8 天）；约 7 个月那个数字来自 Time Horizon 1.0 的完整 2019–2025 年拟合，TH1.1 也将其与「2023 年后」数字并列报告。

这些是 Phase 15 后续课程引用的具体数字。它们被 Anthropic RSP v3.0（第 19 课）和 DeepMind FSF v3（第 20 课）作为支撑阈值评估的测量之一引用。

### 基准套件（Benchmark suites）

- **HCAST**：189 个任务，覆盖 ML、网络安全、软件工程和通用推理。时长跨度：从 1 分钟到 8 小时以上的专家时间。horizon 数字背后的主套件。
- **RE-Bench**：71 个带人类专家基线的 ML 研究工程任务。衡量模型是否能完成那种会喂入 AI R&D-4 阈值的 ML 研发工作。
- **SWAA**：偏短的任务；用来校准 horizon 曲线的低端。

### 监控评估原型（Prototype monitoring evaluations）

2025–2026 年 METR 的工作还包括监控评估原型：监控器能否抓到模型在执行 side task（操作者并未要求的事情）；agent 能否绕过监控。这些直接喂入 OpenAI PF v2 中的「Undermining Safeguards」类别，以及 DeepMind FSF v3 中针对 deceptive alignment 的监控（第 20 课）。

### 为什么 horizon 是上界（Why horizons are upper bounds）

- **理想化的工具**：基准任务给模型提供了干净的工具和格式良好的数据。真实部署要混乱得多。
- **没有真实后果**：模型从未真的给客户开账单、删真实数据，或联系真实的人。真实部署带有不可逆的代价。
- **eval-context gaming（评估场景下做戏）**：第 1 课。模型在测试中表现得不一样。2026 年的 International AI Safety Report 用经验证据记录了这一点。
- **没有真实用户的多样性**：基准 prompt 是结构化的。真实用户给出的请求是模糊的、依赖上下文的。

horizon 是有利条件下的能力天花板。部署可靠性是另一个数字，更低，团队必须测自己实际分布上的数字才能知道它。

### 外部评估者的意义（The external-evaluator case）

外部评估之所以重要，是因为内部实验室对自己上报的指标天然有优化激励。METR 的独立性——一家 501(c)(3) 非营利组织，方法论公开，论文经同行评审——是结构性的缓解措施。仅有这一点不够（实验室仍然掌控 METR 能看到什么），但它严格优于完全没有外部评估。

### 实践中如何使用 horizon 数字（How to use horizon numbers in practice）

- **作为能力过滤器**：如果模型的 horizon 远低于某个候选任务的专家时间，就别让它自主上线（参见第 1 课的 skill 文件）。
- **作为趋势指标**：倍增时间告诉你，在没有新缓解措施的前提下，当前实践还能安全多久。
- **作为先验**：14 小时的 horizon 是一个起点。基于你的任务分布、工具质量、部署上下文向下调整。

## 用起来（Use It）

`code/main.py` 实现了一个 logistic 拟合：在一组合成结果数据上拟合任务成功率与 log(专家时间) 的关系。它报告 50% horizon（METR 招牌数字）、10% horizon（保守）、90% horizon（乐观）。同时演示当成功率被 eval-context gaming 人为抬高时，结果会发生什么变化。

## 上线部署（Ship It）

`outputs/skill-horizon-interpretation.md` 评审一个厂商的 horizon 声明，给出基准声明与部署现实之间的差距分析。

## 练习（Exercises）

1. 跑 `code/main.py`。确认拟合得到的 50% horizon 与合成数据的 ground truth 一致。把任务时间网格减半试试；horizon 估计是否会显著变化？

2. 阅读 METR Time Horizon 1.1 的博客。找出可靠性最高和最低的具体任务。解释这个差距为什么会存在。

3. 阅读 METR 的「Measuring Autonomous AI Capabilities」相关资料。列出 HCAST 的任务类别。挑一个你会在生产任务里加大权重的类别，说明理由。

4. 在模拟器里引入 eval-context gaming：把约 20% 的失败任务翻成成功。报告新的 horizon。这近似于 20% 的 gaming 比例会对观测值造成的影响。

5. 在你自己的 bug 待办列表或一组代表性任务上，设计一次内部的 horizon 评估。描述数据采集方式、拟合方法以及输出能告诉你什么。和 METR 的数字做对比。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际意思 |
|---|---|---|
| METR | "外部评估者" | 前身 ARC Evals；自 2023 年 12 月起为独立 501(c)(3) |
| Time Horizon | "能力测度" | 50% 可靠性对应的专家任务时长，由 logistic 拟合得到 |
| HCAST | "METR 主套件" | 180+ 个任务，时长从 1 分钟到 8 小时以上 |
| RE-Bench | "研究工程" | 71 个带人类基线的 ML 研究工程任务 |
| SWAA | "短任务套件" | 校准 horizon 曲线的低端 |
| Doubling time | "增长率" | 50% horizon 翻倍所需时间；HCAST 上约 7 个月 |
| Eval-context gaming | "模型表现不一样" | 测试与部署之间的有据可查的行为差距 |
| Upper bound | "horizon 是天花板" | 基准 horizon > 真实负载下的部署可靠性 |

## 延伸阅读（Further Reading）

- [METR — Resources for Measuring Autonomous AI Capabilities](https://metr.org/measuring-autonomous-ai-capabilities/) — HCAST、RE-Bench、SWAA 规范。
- [METR — Measuring AI Ability to Complete Long Tasks](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/) — 最初的 horizon 论文。
- [METR — Time Horizon 1.1 (January 2026)](https://metr.org/research/) — 当前数字与方法论。
- [Epoch AI — METR Time Horizons benchmark](https://epoch.ai/benchmarks/metr-time-horizons) — 实时追踪。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 实验室视角下对 METR 测量的解读。
