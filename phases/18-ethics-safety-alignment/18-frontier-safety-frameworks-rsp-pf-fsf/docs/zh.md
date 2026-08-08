# 前沿安全框架 —— RSP、PF、FSF

> 三个主要实验室框架定义了 2026 年前沿能力的行业治理。Anthropic Responsible Scaling Policy v3.0（2026 年 2 月）引入了分层的 AI 安全级别（ASL-1 到 ASL-5+），以生物安全级别为模型，ASL-3 于 2025 年 5 月针对 CBRN 相关模型激活。OpenAI Preparedness Framework v2（2025 年 4 月）定义了跟踪能力的五个标准，并将能力报告与安全措施报告分开。DeepMind Frontier Safety Framework v3.0（2025 年 9 月）引入了关键能力级别，包括新的有害操纵 CCL。三者现在都包含竞争对手调整条款，如果同行实验室在没有相当保障措施的情况下发布，允许推迟。跨实验室对齐仍然是结构性的，而非术语性的："能力阈值"、"高能力阈值"和"关键能力级别"表示类似的构造。

**类型：** 学习
**语言：** 无
**先决条件：** Phase 18 · 17（WMDP），Phase 18 · 07-09（欺骗失效）
**时间：** ~75 分钟

## 学习目标

- 描述 Anthropic 的 ASL 层级结构以及什么激活了 ASL-3。
- 说出 OpenAI Preparedness Framework v2 跟踪能力的五个标准。
- 描述 DeepMind 的关键能力级别结构和有害操纵 CCL。
- 解释竞争对手调整条款以及它们为什么对竞赛动态重要。
- 定义安全案例并描述三支柱结构（监控、不可读性、无能力）。

## 问题

第 7-17 课确立了欺骗是可能的，双重用途能力存在，评估有局限性。一个拥有前沿能力模型的实验室需要内部治理结构，该结构：
- 定义何时需要新保障措施的阈值。
- 定义扩展前所需的评估。
- 描述安全案例的样子。
- 处理竞赛动态问题（如果竞争对手在没有保障措施的情况下发布，你做什么？）。

三个 2025-2026 框架是最先进的——不完美、不断演变，跨实验室足够对齐，以至于治理问题现在是框架是否充分，而不是它们是否存在。

## 概念

### Anthropic Responsible Scaling Policy v3.0（2026 年 2 月）

ASL 结构：
- ASL-1：不是前沿模型（被弱于前沿的基线吸收）。
- ASL-2：当前前沿基线；以通常的保障措施部署。
- ASL-3：灾难性滥用的风险显著更高；CBRN 相关能力。2025 年 5 月激活。
- ASL-4：AI R&D-2 跨越阈值；可以自动化入门级 AI 研究的模型。
- ASL-5+：高级 AI R&D；显著加速有效扩展的模型。

v3.0 中的新内容：
- 前沿安全路线图（以编辑形式公开）。
- 风险报告（季度，部分外部审查）。
- AI R&D 分解为 AI R&D-2 和 AI R&D-4。
- 一旦跨越 AI R&D-4，需要肯定的安全案例，识别模型追求未对齐目标时的未对齐风险。

### OpenAI Preparedness Framework v2（2025 年 4 月 15 日）

跟踪能力的五个标准：
- **合理。** 存在合理的威胁模型。
- **可测量。** 可以进行经验评估。
- **严重。** 伤害很大。
- **全新。** 不是预先存在的风险放大。
- **瞬时或不可挽回。** 伤害发生快或无法撤销。

满足全部五个的能力被跟踪。其他不被跟踪。

PF v2 的其他结构：
- 将能力报告（模型能做什么）与安全措施报告（存在什么控制）分开。
- 安全咨询小组审查。
- 领导批准；董事会安全与安保委员会监督。
- "调整条款"：如果另一个实验室在没有相当保障措施的情况下发布，OpenAI 可以减少要求。

### DeepMind Frontier Safety Framework v3.0（2025 年 9 月）

按领域的关键能力级别（CCL）：
- 生物武器提升
- 网络提升
- ML R&D 加速
- 有害操纵（v3.0 新增）：可以在高风险环境中实质改变信念/行为的模型。

v2.0（2025 年 2 月）添加了欺骗对齐部分和 ML R&D CCL 的更高安全级别。

### 跨实验室对齐

- Anthropic "能力阈值"。
- DeepMind "关键能力级别"。
- OpenAI "高能力阈值"。

没有行业标准术语。结构上对齐：三个前沿能力层级，带有已发布的评估标准。三者都包含竞争对手调整条款（2025 年起）。

### 安全案例

安全案例是一个书面论证，即部署在最坏情况假设下是可接受地安全的。标准结构针对三个支柱：

- **监控。** 如果发生，我们能检测坏行为吗？
- **不可读性。** 模型是否缺乏执行连贯伤害计划的能力？
- **无能力。** 模型是否缺乏造成所讨论伤害的能力？

不同的安全案例针对不同的支柱。对于 ASL-3 CBRN 案例，无能力（通过遗忘）是主要目标。对于欺骗对齐，监控和不可读性是目标。对于网络提升，三者都相关。

### 竞赛动态问题

竞争对手调整条款有争议。批评者认为它们创造了逐底竞争：如果三个实验室都会在竞争对手违约时减少要求，均衡就会转向违约。辩护者认为替代方案（单方面保障措施）如果违约实验室安全意识较低，会产生更糟的结果。

UK AISI、US CAISI 和 EU AI Office（第 24 课）是外部治理对应物。实验室框架是自愿的；监管框架正在出现。

### 这在 Phase 18 中的位置

第 17-18 课是欺骗和红队分析之上的测量和治理层。第 19-24 课涵盖福利、偏见、隐私、水印和监管结构。第 28 课映射操作化评估的研究生态系统（MATS、Redwood、Apollo、METR）。

## 使用它

本课没有代码。阅读三个主要来源：RSP v3.0、PF v2、FSF v3.0。将每个实验室的层级结构映射到其他，并识别每个实验室定义的阈值，其他实验室没有。

## 交付它

本课产生 `outputs/skill-framework-diff.md`。给定一个安全框架或发布说明，它将框架的阈值定义、所需评估和安全案例结构与 RSP v3.0、PF v2、FSF v3.0 进行比较，并标记跨实验室差距。

## 练习

1. 阅读 RSP v3.0、PF v2 和 FSF v3.0。编制每个实验室的 CBRN 阈值、每个实验室的 AI R&D 阈值以及每个实验室的所需部署前评估的表格。

2. 竞争对手调整条款在所有三个框架中（2025+）。写一段支持它的论证；写一段反对它的论证。识别每个立场依赖的假设。

3. 为跨越 Anthropic AI R&D-4 阈值的模型设计一个安全案例。命名三个支柱（监控、不可读性、无能力）中每一个所需的证据。

4. DeepMind 的 FSF v3.0 引入了有害操纵 CCL。提出三个经验测量，表明模型已跨越此阈值。

5. 阅读 METR 的 "Common Elements of Frontier AI Safety Policies"（2025）。命名三个最强的跨实验室趋同和两个最大的分歧。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| RSP | "Anthropic 的框架" | Responsible Scaling Policy；ASL 层级；v3.0 2026 年 2 月 |
| PF | "OpenAI 的框架" | Preparedness Framework；五个标准；v2 2025 年 4 月 |
| FSF | "DeepMind 的框架" | Frontier Safety Framework；CCL；v3.0 2025 年 9 月 |
| ASL-3 | "生物安全级别 3 类比" | Anthropic 针对 CBRN 相关能力的层级；2025 年 5 月激活 |
| CCL | "关键能力级别" | DeepMind 的阈值构造；按领域 |
| 安全案例 | "正式论证" | 书面论证，即部署在最坏情况 U 下是可接受地安全的 |
| 调整条款 | "竞争对手违约允许" | 如果竞争对手在没有相当保障措施的情况下发布，减少要求的框架条款 |

## 延伸阅读

- [Anthropic — Responsible Scaling Policy v3.0 (2026 年 2 月)](https://www.anthropic.com/responsible-scaling-policy) — ASL 层级、路线图、AI R&D 分解
- [OpenAI — Updating the Preparedness Framework (2025 年 4 月 15 日)](https://openai.com/index/updating-our-preparedness-framework/) — 五个标准、调整条款
- [DeepMind — Strengthening our Frontier Safety Framework (2025 年 9 月)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — CCL v3.0、有害操纵
- [METR — Common Elements of Frontier AI Safety Policies (2025)](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) — 跨实验室比较
