# 前沿安全框架 — RSP、PF、FSF

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 三大实验室的框架共同定义了 2026 年前沿能力的行业治理格局。Anthropic Responsible Scaling Policy v3.0（2026 年 2 月）引入分级的 AI Safety Levels（AI 安全等级，ASL-1 至 ASL-5+），仿照生物安全等级设计，其中 ASL-3 已于 2025 年 5 月针对 CBRN 相关模型激活。OpenAI Preparedness Framework v2（2025 年 4 月）为受跟踪能力定义了五条标准，并把 Capabilities Reports（能力报告）与 Safeguards Reports（防护措施报告）分开。DeepMind Frontier Safety Framework v3.0（2025 年 9 月）引入 Critical Capability Levels（关键能力等级），其中包含全新的 Harmful Manipulation（有害操纵）CCL。三家如今都包含 competitor-adjustment（同行调整）条款：若同行实验室在没有可比防护的情况下发布模型，本实验室可推迟或下调要求。各实验室的对齐是结构性的，而非术语性的：「Capability Thresholds」「High Capability thresholds」与「Critical Capability Levels」指代的是相互类比的构造。

**Type:** Learn
**Languages:** none
**Prerequisites:** Phase 18 · 17 (WMDP), Phase 18 · 07-09 (deception failures)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 描述 Anthropic 的 ASL 分级结构，以及触发 ASL-3 激活的原因。
- 列出 OpenAI Preparedness Framework v2 中受跟踪能力需满足的五条标准。
- 描述 DeepMind 的 Critical Capability Level 结构，以及 Harmful Manipulation CCL。
- 解释 competitor-adjustment 条款，并说明它对竞速动态（race dynamics）的意义。
- 定义 safety case（安全论证），并描述其三支柱结构（monitoring、illegibility、incapability）。

## 问题（The Problem）

第 7 至 17 课已经表明：欺骗是可能的、双用途能力是真实存在的、评估存在边界。一家拥有前沿能力模型的实验室，需要一套内部治理结构来：
- 定义触发新防护措施的阈值。
- 定义在扩规模之前必须做的评估。
- 描述 safety case 应该长什么样。
- 处理竞速动态问题（如果竞争对手没有防护就发布，自己怎么办？）。

2025–2026 年的三套框架就是当前的最佳实践——它们并不完美，仍在演化，但跨实验室之间已经足够对齐，使得当前的治理问题变成了「这些框架是否充分」，而不再是「是否存在这种框架」。

## 概念（The Concept）

### Anthropic Responsible Scaling Policy v3.0（2026 年 2 月）

ASL 结构：
- ASL-1：非前沿模型（被「弱于前沿基线」的类别吸收）。
- ASL-2：当前前沿基线；以常规防护措施部署。
- ASL-3：灾难性误用风险显著更高；CBRN 相关能力。已于 2025 年 5 月激活。
- ASL-4：跨过 AI R&D-2 阈值；可自动完成入门级 AI 研究的模型。
- ASL-5+：高级 AI R&D；能显著加速有效扩规模的模型。

v3.0 中的新内容：
- Frontier Safety Roadmaps（前沿安全路线图，公开版会做删减处理）。
- Risk Reports（风险报告，按季度发布，部分接受外部评审）。
- AI R&D 被拆分为 AI R&D-2 与 AI R&D-4。
- 一旦跨过 AI R&D-4，必须给出 affirmative safety case（肯定性安全论证），识别模型追求错位目标所带来的 misalignment（对齐失误）风险。

### OpenAI Preparedness Framework v2（2025 年 4 月 15 日）

受跟踪能力需满足的五条标准：
- **Plausible（可成立）。** 存在合理的威胁模型。
- **Measurable（可测量）。** 可以做实证评估。
- **Severe（严重）。** 危害规模大。
- **Net-new（增量风险）。** 不是已有风险的简单放大。
- **Instantaneous-or-irremediable（即时或不可逆）。** 危害发生迅速，或一旦发生无法挽回。

同时满足全部五条的能力会被跟踪，其余则不会。

PF v2 的其他结构：
- 把 Capabilities Reports（模型能做什么）与 Safeguards Reports（已有哪些控制）分离开。
- 由 Safety Advisory Group 评审。
- 由领导层审批；董事会的 Safety & Security Committee 监督。
- 「Adjustment clause（调整条款）」：如果其他实验室在没有可比防护的情况下发布模型，OpenAI 可以下调自己的要求。

### DeepMind Frontier Safety Framework v3.0（2025 年 9 月）

按领域划分的 Critical Capability Levels（CCLs）：
- Bioweapon Uplift（生物武器能力提升）
- Cyber Uplift（网络攻击能力提升）
- ML R&D Acceleration（ML 研发加速）
- Harmful Manipulation（v3.0 新增）：在高风险情境下能显著改变信念或行为的模型。

v2.0（2025 年 2 月）新增了 Deceptive Alignment（欺骗式对齐）章节，并提高了 ML R&D CCL 的安全等级要求。

### 跨实验室对齐

- Anthropic「Capability Thresholds」。
- DeepMind「Critical Capability Levels」。
- OpenAI「High Capability thresholds」。

行业尚无统一术语。但结构上是对齐的：三档前沿能力等级，配套已公开的评估标准。三家都包含 competitor-adjustment 条款（2025 年起）。

### Safety cases（安全论证）

safety case 是一份书面论证，用于说明在最坏情况假设下某次部署是可接受地安全的。其标准结构面向三大支柱：

- **Monitoring（监测）。** 不良行为一旦发生，我们能否检测到？
- **Illegibility（不可执行性）。** 模型是否缺乏执行一个连贯有害计划的能力？
- **Incapability（不具备能力）。** 模型是否根本不具备造成相应危害的能力？

不同的 safety case 针对不同的支柱。对于 ASL-3 的 CBRN 论证，主要目标是 incapability（通过 unlearning 实现）。对于 deceptive alignment，目标是 monitoring 与 illegibility。对于网络攻击能力提升，三者都相关。

### 竞速动态问题

competitor-adjustment 条款颇具争议。批评者认为它造成「逐底竞争」：如果三家实验室都会在竞争对手「叛变」时下调要求，均衡就会向叛变倾斜。支持者则认为，替代方案（单边坚持防护）若对手是更不重视安全的实验室，反而会带来更糟的结果。

UK AISI、US CAISI 和 EU AI Office（第 24 课）是与之对应的外部治理力量。实验室自己的框架是自愿的；监管框架则在逐步成形。

### 在 Phase 18 中的位置

第 17–18 课是叠加在欺骗与红队分析之上的「测量与治理」层。第 19–24 课覆盖福祉、偏见、隐私、水印与监管结构。第 28 课梳理研究生态（MATS、Redwood、Apollo、METR），它们把这些评估真正落地。

## 用起来（Use It）

本课没有代码。请阅读三份一手材料：RSP v3.0、PF v2、FSF v3.0。把每家实验室的分级结构与其他两家做对照，找出每家定义了、而另外两家没有定义的某个阈值。

## 上线部署（Ship It）

本课产出 `outputs/skill-framework-diff.md`。给定一份安全框架或发布说明，它会把该框架的阈值定义、所需评估和 safety case 结构与 RSP v3.0、PF v2、FSF v3.0 做对比，并标记跨实验室之间的差异。

## 练习（Exercises）

1. 阅读 RSP v3.0、PF v2 与 FSF v3.0。整理一张表，列出每家的 CBRN 阈值、每家的 AI R&D 阈值，以及每家在部署前所要求的评估。

2. competitor-adjustment 条款在三套框架中都有（2025 年起）。写一段支持它的论述；再写一段反对它的论述。指出每个立场各自依赖的假设。

3. 为一个跨过 Anthropic AI R&D-4 阈值的模型设计 safety case。说明三大支柱（monitoring、illegibility、incapability）各自需要什么证据。

4. DeepMind FSF v3.0 引入了 Harmful Manipulation CCL。提出三种实证测量方式，用以判断一个模型是否已经跨过该阈值。

5. 阅读 METR 的「Common Elements of Frontier AI Safety Policies」（2025）。指出跨实验室之间最强的三处趋同，以及最大的两处分歧。

## 关键术语（Key Terms）

| 术语 | 大家通常怎么说 | 实际指什么 |
|------|-----------------|------------------------|
| RSP | 「Anthropic 的框架」 | Responsible Scaling Policy；ASL 分级；v3.0 于 2026 年 2 月发布 |
| PF | 「OpenAI 的框架」 | Preparedness Framework；五条标准；v2 于 2025 年 4 月发布 |
| FSF | 「DeepMind 的框架」 | Frontier Safety Framework；CCLs；v3.0 于 2025 年 9 月发布 |
| ASL-3 | 「类比生物安全 3 级」 | Anthropic 针对 CBRN 相关能力的等级；2025 年 5 月激活 |
| CCL | 「关键能力等级」 | DeepMind 的阈值构造；按领域划分 |
| Safety case | 「正式论证」 | 一份书面论证，证明在最坏情况假设下部署是可接受地安全的 |
| Adjustment clause | 「容许竞争对手叛变」 | 框架中的条款：若竞争对手在没有可比防护的情况下发布，可下调要求 |

## 延伸阅读（Further Reading）

- [Anthropic — Responsible Scaling Policy v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) — ASL 分级、路线图、AI R&D 拆分
- [OpenAI — Updating the Preparedness Framework (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) — 五条标准、调整条款
- [DeepMind — Strengthening our Frontier Safety Framework (September 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — CCL v3.0、Harmful Manipulation
- [METR — Common Elements of Frontier AI Safety Policies (2025)](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — 跨实验室对照
