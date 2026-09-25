# 前沿安全框架 — RSP、PF、FSF

> 2026 年前沿能力的行业治理由三大实验室框架定义。Anthropic 负责任扩展政策 v3.0(2026 年 2 月)引入了分级 AI 安全等级(ASL-1 至 ASL-5+),其建模参考生物安全等级,其中 ASL-3 已于 2025 年 5 月针对 CBRN 相关模型启用。OpenAI 准备框架 v2(2025 年 4 月)定义了跟踪能力的五项标准,并将能力报告与保障措施报告分开。DeepMind 前沿安全框架 v3.0(2025 年 9 月)引入了关键能力等级,包括新增的有害操纵 CCL。这三个框架现在都包含竞争者调整条款,允许在同行实验室发布无同等保障措施的模型时推迟执行。实验室之间的对齐是结构性的而非术语上的:"Capability Thresholds"、"High Capability thresholds" 与 "Critical Capability Levels" 指代类似的概念。

**Type:** Learn
**Languages:** none
**Prerequisites:** Phase 18 · 17 (WMDP), Phase 18 · 07-09 (deception failures)
**Time:** ~75 分钟

## 学习目标

- 描述 Anthropic 的 ASL 分级结构以及启用 ASL-3 的原因。
- 说出 OpenAI 准备框架 v2 中跟踪能力的五项标准。
- 描述 DeepMind 的关键能力等级结构以及有害操纵 CCL。
- 解释竞争者调整条款及其对竞争动态的重要性。
- 定义安全案例并描述其三大支柱结构(监控、不可读性、无能力性)。

## 问题所在

第 7-17 课确立了欺骗是可能的、双重用途能力是存在的、评估是有局限的。拥有前沿能力模型的实验室需要一个内部治理结构,以:
- 定义何时需要新保障措施的阈值。
- 定义扩展前所需的评估。
- 描述安全案例的样貌。
- 应对竞争动态问题(如果竞争者在没有保障措施的情况下发布模型,你该怎么办?)。

这三个 2025-2026 年的框架是当前最先进的——并不完美,仍在演进,但各实验室之间已足够对齐,以至于治理问题已不再是框架是否存在,而是框架是否充分。

## 核心概念

### Anthropic 负责任扩展政策 v3.0(2026 年 2 月)

ASL 结构:
- ASL-1:非前沿模型(被弱于前沿的基线所涵盖)。
- ASL-2:当前前沿基线;以常规保障措施部署。
- ASL-3:灾难性误用风险显著更高;CBRN 相关能力。于 2025 年 5 月启用。
- ASL-4:AI R&D-2 越过阈值;能够自动化入门级 AI 研究的模型。
- ASL-5+:高级 AI R&D;能大幅加速有效扩展的模型。

v3.0 的新内容:
- 前沿安全路线图(以删节形式公开)。
- 风险报告(每季度,部分经外部审查)。
- AI R&D 被拆分为 AI R&D-2 和 AI R&D-4。
- 一旦越过 AI R&D-4,就需要提供积极的安全案例,识别模型追求错位目标所带来的错位风险。

### OpenAI 准备框架 v2(2025 年 4 月 15 日)

跟踪能力的五项标准:
- **合理性(Plausible)。** 存在合理的威胁模型。
- **可测量性(Measurable)。** 可以进行实证评估。
- **严重性(Severe)。** 危害很大。
- **全新性(Net-new)。** 不是既有风险被放大。
- **即时性或不可逆性(Instantaneous-or-irremediable)。** 危害发生迅速或无法撤销。

满足全部五项标准的能力将被跟踪。其余的则不会。

PF v2 的其他结构:
- 将能力报告(模型能做什么)与保障措施报告(存在哪些控制措施)分开。
- 安全咨询小组审查。
- 领导层批准;董事会的安全与保障委员会监督。
- "调整条款":如果另一家实验室在没有同等保障措施的情况下发布模型,OpenAI 可以降低要求。

### DeepMind 前沿安全框架 v3.0(2025 年 9 月)

按领域划分的关键能力等级(CCL):
- 生物武器赋能(Bioweapon Uplift)
- 网络赋能(Cyber Uplift)
- ML R&D 加速(ML R&D Acceleration)
- 有害操纵(Harmful Manipulation)(v3.0 新增):在高风险情境中可能大幅改变信念/行为的模型。

v2.0(2025 年 2 月)增加了欺骗性对齐部分,并为 ML R&D CCL 设定了更高的安全等级。

### 跨实验室对齐

- Anthropic "Capability Thresholds"。
- DeepMind "Critical Capability Levels"。
- OpenAI "High Capability thresholds"。

没有行业标准术语。结构上对齐:三个层次的前沿能力,均有公开的评估标准。三者都包含竞争者调整条款(2025 年起)。

### 安全案例

安全案例是一份书面论证,说明在最坏情况假设下,某次部署的安全风险是可接受的。标准结构针对三大支柱:

- **监控(Monitoring)。** 如果出现不良行为,我们能否检测到?
- **不可读性(Illegibility)。** 模型是否缺乏执行连贯计划以造成危害的能力?
- **无能力性(Incapability)。** 模型是否缺乏造成所述危害的能力?

不同的安全案例针对不同的支柱。对于 ASL-3 CBRN 案例,主要针对无能力性(通过遗忘)。对于欺骗性对齐,则针对监控和不可读性。对于网络赋能,三者均相关。

### 竞争动态问题

竞争者调整条款存在争议。批评者认为它们会造成逐底竞争:如果三家实验室都会在竞争者“背叛”时降低要求,均衡就会向背叛倾斜。辩护者则认为,如果背叛的实验室安全意识较低,替代方案(单方面保障措施)会产生更糟的结果。

UK AISI、US CAISI 和 EU AI Office(第 24 课)是外部治理对应机构。实验室框架是自愿性的;监管框架正在形成。

### 本课在 Phase 18 中的位置

第 17-18 课是建立在欺骗与红队分析之上的测量与治理层。第 19-24 课涵盖福祉、偏见、隐私、水印和监管结构。第 28 课描绘了将评估落地的研发生态系统(MATS、Redwood、Apollo、METR)。

```figure
al-asl-ladder
```

## 动手实践

本课没有代码。阅读三份原始资料:RSP v3.0、PF v2、FSF v3.0。将各家实验室的分级结构相互映射,并找出每家实验室定义了而其他实验室没有定义的一个阈值。

## 成果输出

本课产出 `outputs/skill-framework-diff.md`。给定一个安全框架或发布说明,它将该框架的阈值定义、所需评估和安全案例结构与 RSP v3.0、PF v2、FSF v3.0 进行对比,并标记跨实验室差距。

## 练习

1. 阅读 RSP v3.0、PF v2 和 FSF v3.0。编制一张表格,列出各实验室的 CBRN 阈值、各自的 AI R&D 阈值,以及各自要求的部署前评估。

2. 三个框架(2025 年起)都包含竞争者调整条款。写一段支持它的论述;再写一段反对它的论述。指出每个立场所依赖的假设。

3. 为一个越过 Anthropic AI R&D-4 阈值的模型设计一个安全案例。列出三大支柱(监控、不可读性、无能力性)各自所需的证据。

4. DeepMind 的 FSF v3.0 引入了有害操纵 CCL。提出三项可表明模型已越过该阈值的实证测量方法。

5. 阅读 METR 的 "Common Elements of Frontier AI Safety Policies"(2025)。说出三个最强的跨实验室趋同点和两个最大的分歧点。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| RSP | "Anthropic 的框架" | 负责任扩展政策;ASL 分级;v3.0 2026 年 2 月 |
| PF | "OpenAI 的框架" | 准备框架;五项标准;v2 2025 年 4 月 |
| FSF | "DeepMind 的框架" | 前沿安全框架;CCL;v3.0 2025 年 9 月 |
| ASL-3 | "生物安全等级 3 的类比" | Anthropic 针对CBRN 相关能力的等级;2025 年 5 月启用 |
| CCL | "关键能力等级" | DeepMind 的阈值概念;按领域划分 |
| 安全案例 | "正式论证" | 说明在最坏情况 U 下部署安全风险可接受的书面论证 |
| 调整条款 | "竞争者背叛豁免" | 框架中关于在竞争者发布无同等保障措施模型时降低要求的条款 |

## 延伸阅读

- [Anthropic — Responsible Scaling Policy v3.0(2026 年 2 月)](https://www.anthropic.com/responsible-scaling-policy) — ASL 分级、路线图、AI R&D 拆分
- [OpenAI — Updating the Preparedness Framework(2025 年 4 月 15 日)](https://openai.com/index/updating-our-preparedness-framework/) — 五项标准、调整条款
- [DeepMind — Strengthening our Frontier Safety Framework(2025 年 9 月)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — CCL v3.0、有害操纵
- [METR — Common Elements of Frontier AI Safety Policies(2025)](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — 跨实验室对比