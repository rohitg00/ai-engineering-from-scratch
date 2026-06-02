# Anthropic 负责任扩展政策 v3.0（Anthropic Responsible Scaling Policy v3.0）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> RSP v3.0 于 2026 年 2 月 24 日生效，取代了 2023 年的版本。两层缓解（two-tier mitigation）：Anthropic 单边承担的部分 vs 被定位为行业整体建议的部分（包括 RAND SL-4 安全标准）。新增 Frontier Safety Roadmap（前沿安全路线图）和 Risk Report（风险报告）作为常设文档，而不再是一次性交付物。删除了 2023 年版本中的暂停承诺。引入了 AI R&D-4 阈值：一旦越过，Anthropic 必须发布一份 affirmative case（积极论证），列出潜在的对齐风险及其缓解措施。Claude Opus 4.6 尚未越过这一阈值。Anthropic 在 v3.0 公告中表示，「自信地排除这一可能正变得越来越困难」。SaferAI 给 2023 年版 RSP 打了 2.2 分，把 v3.0 降到了 1.9，把 Anthropic 归入「弱」一档的 RSP，与 OpenAI、DeepMind 同列。定性阈值取代了 2023 年的定量承诺；移除暂停条款是其中最锐利的退步。

**Type:** Learn
**Languages:** Python (stdlib, RSP 阈值决策引擎)
**Prerequisites:** Phase 15 · 06 (AAR), Phase 15 · 07 (RSI)
**Time:** ~45 minutes

## 问题（The Problem）

前沿实验室发布的扩展政策（scaling policy）一半是技术文档，一半是治理文档，再加上一部分是发给监管者的信号。RSP v3.0 是 Anthropic 当下的版本。仔细读它的意义并不在于遵守它有约束力（它没有），而在于：这套表述方式塑造了一个实验室如何在内部理解灾难性风险、如何对外沟通其中的 trade-off。

v3.0 与 v2.0 的 diff 是最有用的分析单元。**新增**了：Frontier Safety Roadmap、Risk Report、AI R&D-4 阈值。**删除**了：2023 年的暂停承诺。**重新表述**为：把缓解措施拆成 Anthropic 单边承担与行业整体建议的两层。外部评审（SaferAI）把分数从 v2 的 2.2 下调到 v3.0 的 1.9。一份扩展政策可以变得没那么严谨，同时却看上去更精致——这就是其中的演变路径。

## 概念（The Concept）

### 两层缓解时间表（The two-tier mitigation schedule）

- **Anthropic 单边行动（Anthropic unilateral actions）**：无论其他实验室怎么做，Anthropic 自己会做的事情。包括：超过某阈值就停止训练、特定的安全措施、特定的部署门槛。
- **行业整体建议（Industry-wide recommendations）**：Anthropic 认为整个行业应该集体去做的事情。包括 RAND SL-4 安全标准。这些不是 Anthropic 自身的承诺，而是它的政策倡导。

两层结构在 v2 里是没有的。这意味着读者必须仔细看每一项承诺到底落在哪一栏。落在「行业整体建议」一栏的安全措施，并不是 Anthropic 的承诺，而是 Anthropic 的期望。

### AI R&D-4 阈值（The AI R&D-4 threshold）

这是 RSP v3.0 指定的、下一步关键的能力等级。具体定义：一个能在有竞争力的成本下自动化大部分 AI 研究的模型。一旦 Anthropic 认为某个模型越过这一阈值，就必须在继续扩展之前，发布一份 affirmative case，识别其中的对齐风险及对应的缓解措施。

按照 v3.0 公告，Claude Opus 4.6 还没越过这一阈值。文档同时补了一句：「自信地排除这一可能正变得越来越困难。」这句话很重要——它承认这个阈值已经近到值得现在就当真的程度，而不是某个遥远的、推测中的极限。

第 6 课（Automated Alignment Research）和第 7 课（Recursive Self-Improvement）直接对接到这个阈值。自动化的对齐研究者（automated alignment researcher）越过研究质量门槛，就是 AI R&D-4 阈值正在逼近的证据。

### Frontier Safety Roadmap 与 Risk Report

v3.0 把两类工件提升为常设文档：

- **Frontier Safety Roadmap**：前瞻性文档，描述计划中的安全工作、能力预期，以及缓解研究方向。
- **Risk Report**：回顾性文档，针对某个具体模型在发布之后撰写，描述实际观察到的能力和残留风险。

两者都对外公开。两者都按照声明好的节奏更新。它们的用处是：读者可以追踪 Anthropic 在 Roadmap 里说要做什么，与他们在 Risk Report 里报告自己实际做了什么之间的差距。

### 移除暂停条款（Removing the pause clause）

2023 年版的 RSP 包含一条明确的暂停承诺：如果模型越过特定能力阈值，就要暂停训练，直到缓解措施到位为止。v3.0 用一种更软的表述替换了显式的暂停（发布一份 affirmative case，如果缓解措施充分则继续推进）。SaferAI 和其他分析者直接把这条点名为新文档里**最强烈的退步**。

支持这一改动的政策论证是：2023 年提出的定量阈值，到 2026 年这一代能力基准（benchmark）下已经不可能被触及，因为基准本身被重新校准了。反方论证是：扩展政策里的暂停条款是一种承诺装置（commitment device），把它移除，等于把这份政策的可信度也一并移除。

### SaferAI 的降级（SaferAI's downgrade）

SaferAI 是一家独立机构，专门给 RSP 类文档打分。他们公开的评分：2023 年 Anthropic RSP 得分 2.2（量表上 4.0 是当前最佳 RSP，1.0 为名义合规级）。v3.0 得分 1.9。这把 Anthropic 从「中等」推到了「弱」一档，与 OpenAI、DeepMind 并列。

SaferAI 给出的降级原因：
- 定性阈值替换了定量阈值。
- 暂停承诺被移除。
- AI R&D-4 阈值的缓解措施被描述为「affirmative case」，而非具体的措施。
- 评审机制依赖 Anthropic 自家的 Safety Advisory Group（安全咨询组），独立监督有限。

### 这节课不是什么（What this lesson is not）

这不是一节合规课。RSP v3.0 不是法规；没有任何东西强制 Anthropic 遵守它。本课要教的是：以这份文档应得的细致度和怀疑度来阅读它。扩展政策是前沿实验室对外释放的、关于灾难性风险姿态的最主要的公开信号。能把它们读好，是任何工作依赖于前沿能力的人需要的实战技能。

## 用起来（Use It）

`code/main.py` 实现了一个小型决策引擎，模仿 RSP 的阈值评估形态：给定一个候选模型和一组能力测量结果，返回是否越过 AI R&D-4 阈值、需要哪些 affirmative-case 章节，以及是否可以继续部署。它故意做得很简单，目的是把文档的逻辑显性地写出来。

## 上线部署（Ship It）

`outputs/skill-scaling-policy-review.md` 用 v3.0 作为参照，对一份扩展政策（Anthropic、OpenAI、DeepMind，或者你公司内部的）做评审：两层结构、阈值、暂停承诺、独立评审。

## 练习（Exercises）

1. 跑一下 `code/main.py`。喂三个能力等级不同的合成模型进去。确认阈值评估器的行为符合预期，并产出正确的 affirmative-case 模板。

2. 通读 RSP v3.0（32 页）。把所有落在「行业整体建议」那一层里的承诺都标出来。其中哪些条目，在 v2 里本来是「Anthropic 单边」的？

3. 读 SaferAI 的 RSP 评分方法学。把他们的评分细则套到这份文档上，自己复现 v3.0 的 1.9 分。哪一行评分细则对降级贡献最大？

4. 2023 年的暂停承诺被删除了。请提出一条替代承诺，既能保住政策的可信度，又能正面回应 2026 年基准被重新校准这个事实。

5. 把 RSP v3.0 与 OpenAI Preparedness Framework v2（第 20 课）做对比。挑一个 v3.0 更强的方面。再挑一个 Preparedness Framework 更强的方面。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际指什么 |
|---|---|---|
| RSP | 「Anthropic 的扩展政策」 | Responsible Scaling Policy；v3.0 自 2026 年 2 月 24 日生效 |
| AI R&D-4 | 「研究自动化阈值」 | 在有竞争力的成本下自动化大部分 AI 研究的能力 |
| Affirmative case | 「安全论证」 | 公开发布的论证，说明已识别风险且缓解措施充分 |
| Frontier Safety Roadmap | 「前瞻计划」 | 描述计划中的安全工作和能力预期的常设文档 |
| Risk Report | 「模型回顾」 | 模型发布之后描述实测能力与残留风险的常设文档 |
| Two-tier mitigation | 「单边 vs 行业」 | 把 Anthropic 自身承诺与行业建议拆开列出 |
| Pause commitment | 「2023 年那条」 | 暂停训练的显式承诺；v3.0 已移除 |
| SaferAI rating | 「独立 RSP 评分」 | 第三方评分细则；v3.0 得 1.9 分（v2 是 2.2 分） |

## 延伸阅读（Further Reading）

- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — 完整的 32 页政策。
- [Anthropic — RSP v3.0 announcement](https://www.anthropic.com/news/responsible-scaling-policy-v3) — 相对 v2 的变化总览。
- [Anthropic — Frontier Safety Roadmap](https://www.anthropic.com/research/frontier-safety) — RSP v3.0 引用的常设文档。
- [Anthropic — Risk Report: Claude Opus 4.6](https://www.anthropic.com/research/risk-report-claude-opus-4-6) — 当前前沿模型的回顾。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 把 AI R&D-4 与可测量的自主性连接起来。
