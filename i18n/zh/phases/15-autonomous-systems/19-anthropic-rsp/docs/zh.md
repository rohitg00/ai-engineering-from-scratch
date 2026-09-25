# Anthropic 负责任扩展政策 v3.0

> RSP v3.0 于 2026 年 2 月 24 日生效，取代 2023 年的政策。双层缓解措施：区分 Anthropic 将单方面采取的行动与被定位为全行业建议的内容（包括 RAND SL-4 安全标准）。新增 Frontier Safety Roadmap 和 Risk Report 作为常设文档，而非一次性交付物。删除了 2023 年的暂停承诺。引入 AI R&D-4 阈值：一旦跨越该阈值，Anthropic 必须发布一份肯定性论证，识别错位风险及相应缓解措施。Claude Opus 4.6 尚未跨越该阈值。Anthropic 在 v3.0 公告中指出，“要自信地排除这一点正变得越来越困难。”SaferAI 对 2023 年 RSP 的评分为 2.2；他们将 v3.0 下调至 1.9，使 Anthropic 与 OpenAI 和 DeepMind 一同落入“弱”RSP 类别。定性阈值取代了 2023 年的定量承诺；删除暂停条款是最严重的倒退。

**Type:** Learn
**Languages:** Python (标准库，RSP 阈值决策引擎)
**Prerequisites:** Phase 15 · 06 (AAR), Phase 15 · 07 (RSI)
**Time:** 约 45 分钟

## 问题所在

前沿实验室发布的扩展政策，一部分是技术文档，一部分是治理文档，还有一部分是向监管机构发出的信号。RSP v3.0 是 Anthropic 当前的政策文档。仔细阅读它的意义不在于遵守它具有约束力（它并不具有），而在于其框架塑造了实验室构想灾难性风险的方式，以及他们向公众传达权衡取舍的方式。

v3.0 与 v2.0 的差异对比是有用的分析单元。新增的内容：Frontier Safety Roadmap、Risk Report、AI R&D-4 阈值。删除的内容：2023 年的暂停承诺。被重新表述的内容：拆分为 Anthropic 单方面承诺与行业建议的双层缓解计划。外部评审方 SaferAI 将评分从 2.2（v2）下调至 1.9（v3.0）。这就是一份扩展政策如何在看起来更加精致的同时，实际上变得不那么严格。

## 核心概念

### 双层缓解计划

- **Anthropic 单方面行动**：无论其他实验室做什么，Anthropic 都会采取的行动。超过阈值即停止训练、具体的安全措施、具体的部署关卡。
- **全行业建议**：Anthropic 认为行业应当集体采取的行动。包括 RAND SL-4 安全标准。这些不是 Anthropic 方面的承诺，而是政策倡导。

双层结构在 v2 中并不存在。这意味着读者需要查看每项承诺属于哪一栏。“全行业建议”一栏中的安全措施不是 Anthropic 的承诺，而是 Anthropic 的期望。

### AI R&D-4 阈值

这是 RSP v3.0 所指定的下一个重要能力阈值。具体而言：一个能够以有竞争力的成本自动化相当大比例 AI 研究的模型。一旦 Anthropic 认为某个模型跨越了该阈值，他们必须在继续扩展之前发布一份肯定性论证，识别错位风险及相应缓解措施。

根据 v3.0 公告，Claude Opus 4.6 尚未跨越该阈值。文档补充道：“要自信地排除这一点正变得越来越困难。”这一措辞很重要；它承认该阈值已经足够接近，是一个现实存在的担忧，而非推测性的极限。

第 6 课（自动化对齐研究）和第 7 课（递归自我改进）直接对应这一阈值。自动化对齐研究员达到研究质量门槛，就是 AI R&D-4 阈值正在逼近的证据。

### Frontier Safety Roadmap 与 Risk Report

v3.0 将两类文档提升为常设文档：

- **Frontier Safety Roadmap**：前瞻性文档，描述计划中的安全工作、能力预期和缓解措施研究。
- **Risk Report**：模型发布后的回顾性文档，描述已观测到的能力和残余风险。

两者都是公开的。两者都按声明的节奏更新。其价值在于：读者可以追踪 Anthropic 在 Roadmap 中所说的计划，与其在 Risk Report 中报告的结果进行对比。

### 删除暂停条款

2023 年的 RSP 包含一项明确的暂停承诺：如果某个模型跨越了特定的能力阈值，训练将暂停，直到缓解措施到位。v3.0 用更温和的表述取代了明确的暂停（发布肯定性论证，若缓解措施充分则继续推进）。SaferAI 和其他分析者直接指出这是新文档中最严重的倒退。

这一变更的政策论据是：2023 年的定量阈值在 2026 年代的能力基准测试中已无法达到，因为基准测试本身被重新标定了。反驳论据是：扩展政策中的暂停条款是一种承诺机制；删除它就消除了政策的可信度。

### SaferAI 的下调

SaferAI 是一家为 RSP 类文档评分的独立组织。其公开评分：2023 年 Anthropic RSP 得分 2.2（评分体系中 4.0 为当前最佳 RSP，1.0 为名义性）。v3.0 得分 1.9。这使 Anthropic 从“中等”降至“弱”，与 OpenAI 和 DeepMind 一同进入弱类别。

根据 SaferAI 的说法，下调因素包括：
- 定性阈值取代了定量阈值。
- 暂停承诺被删除。
- AI R&D-4 阈值的缓解措施被描述为“肯定性论证”，而非具体措施。
- 评审机制依赖于 Anthropic 的安全顾问组，独立监督有限。

### 本课不是什么

这不是一门合规课。RSP v3.0 不是法规；没有任何力量强制 Anthropic 遵守它。本课的意义在于以该文档应得的严谨态度和怀疑精神来阅读它。扩展政策是前沿实验室就灾难性风险立场发出的主要公开信号。善于阅读它们，对任何工作依赖前沿能力的人来说，都是一项实用技能。

```figure
a5-rsp-ladder
```

## 实践

`code/main.py` 实现了一个小型决策引擎，其形态对应 RSP 的阈值评估：给定一个候选模型和一组能力测量值，返回 AI R&D-4 阈值是否被跨越、所需的肯定性论证章节，以及部署是否可以进行。它刻意保持简单；重点在于将文档的逻辑显式化。

## 交付

`outputs/skill-scaling-policy-review.md` 将一份扩展政策（Anthropic、OpenAI、DeepMind 或内部的）对照 v3.0 参考标准进行审查：双层结构、阈值、暂停承诺、独立评审。

## 练习

1. 运行 `code/main.py`。输入三个处于不同能力水平的合成模型。确认阈值评估器行为符合预期，并生成正确的肯定性论证模板。

2. 完整阅读 RSP v3.0（32 页）。找出所有属于“全行业建议”层级的承诺。其中哪些承诺在 v2 中本应是“Anthropic 单方面”的？

3. 阅读 SaferAI 的 RSP 评分方法论。通过将其评分标准应用于该文档，复现他们对 v3.0 的 1.9 分。评分标准中哪一行对下调的贡献最大？

4. 2023 年的暂停承诺已被删除。提出一项替代承诺，在承认 2026 年基准重标定问题的同时，保持政策的可信度。

5. 将 RSP v3.0 与 OpenAI Preparedness Framework v2（第 20 课）进行比较。选出 v3.0 更强的一个方面。再选出 Preparedness Framework 更强的一个方面。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|---|---|---|
| RSP | “Anthropic 的扩展政策” | 负责任扩展政策；v3.0 于 2026 年 2 月 24 日生效 |
| AI R&D-4 | “研究自动化阈值” | 以有竞争力的成本自动化大量 AI 研究的能力 |
| 肯定性论证 | “安全性论证” | 发布的论证，说明风险已被识别且缓解措施充分 |
| Frontier Safety Roadmap | “前瞻计划” | 关于计划安全工作和能力预期的常设文档 |
| Risk Report | “模型回顾” | 关于模型发布后已观测能力和残余风险的常设文档 |
| 双层缓解 | “单方面 vs 行业” | Anthropic 承诺与行业建议的区分 |
| 暂停承诺 | “2023 条款” | 明确的暂停训练承诺；在 v3.0 中被删除 |
| SaferAI 评分 | “独立 RSP 评级” | 第三方评分标准；v3.0 得分 1.9（v2 为 2.2） |

## 延伸阅读

- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — 完整的 32 页政策文档。
- [Anthropic — RSP v3.0 公告](https://www.anthropic.com/news/responsible-scaling-policy-v3) — 相对于 v2 的变更摘要。
- [Anthropic — Frontier Safety Roadmap](https://www.anthropic.com/research/frontier-safety) — 从 RSP v3.0 链接的常设文档。
- [Anthropic — Risk Report: Claude Opus 4.6](https://www.anthropic.com/research/risk-report-claude-opus-4-6) — 对当前前沿模型的回顾。
- [Anthropic — 实践中测量智能体自主性](https://www.anthropic.com/research/measuring-agent-autonomy) — 将 AI R&D-4 与已测量的自主性联系起来。