# 数据来源与训练数据治理

> EU AI Act 要求 GPAI 在 2025 年 8 月前建立机器可读的退出标准（通过 EU Copyright Directive TDM 例外）。California AB 2013（2024 年签署）—— 生成式 AI 训练数据透明度要求开发者发布包含 12 个强制字段的数据集摘要。2025 年 DPA 对合法利益的协调：Irish DPC（2025 年 5 月 21 日）在 EDPB 意见后接受 Meta 对欧盟/欧洲经济区成人公开内容的 LLM 训练，并附带保障措施；Cologne Higher Regional Court（2025 年 5 月 23 日）驳回禁令；Hamburg DPA 放弃紧急程序；UK ICO（2025 年 9 月 23 日）对 LinkedIn 的 AI 训练保障措施（透明度、简化退出、延长异议窗口）发布积极监管回应，并继续监测——不是正式许可。Brazilian ANPD（2024 年 7 月 2 日）因信息透明度不足暂停 Meta 的处理；在 Meta 提交合规计划后，预防性措施于 2024 年 8 月 30 日解除。关键不可逆性问题：cookie 同意框架专为实时、可逆的跟踪设计；一旦数据进入模型权重，外科手术式擦除是不可能的——对训练神经网络没有实际的 GDPR 擦除权。合规窗口在收集时。Data Provenance Initiative（dataprovenance.org，Longpre, Mahari, Lee 等人，"Consent in Crisis"，2024 年 7 月）：大规模审计显示，随着出版商添加 robots.txt 限制，AI 数据共享空间迅速萎缩。

**类型：** 学习
**语言：** Python（标准库，12 字段 California AB 2013 脚手架生成器）
**先决条件：** Phase 18 · 24（监管），Phase 18 · 26（卡片）
**时间：** ~60 分钟

## 学习目标

- 描述 California AB 2013 的生成式 AI 训练数据透明度的 12 个强制字段。
- 说明 2025 年 DPA 对合法利益 LLM 训练的立场（Irish DPC、UK ICO、Hamburg、Cologne）。
- 描述不可逆性问题：为什么 GDPR 擦除权对训练神经网络没有实际等效物。
- 说明 Data Provenance Initiative 的 "Consent in Crisis" 发现。

## 问题

训练数据治理是每个模型卡片（第 26 课）和监管义务（第 24 课）的上游。2024-2025 年，监管格局在三个原则上巩固：退出基础设施、每数据集披露、对公开可用数据的合法利益安排。在收集时不合规的提供者无法下游补救。

## 概念

### California AB 2013

2024 年签署。文档必须在 2026 年 1 月 1 日或之前发布，适用于 2022 年 1 月 1 日或之后发布的系统。第 3111(a) 条要求开发者发布训练中使用的数据集的高级摘要，包含 12 个法定项目：
1. 数据集的来源或所有者。
2. 描述数据集如何促进 AI 系统的预期目的。
3. 数据集中的数据点数量（一般范围可接受；动态数据集的估计）。
4. 数据点类型的描述（标注数据集的标注类型；未标注的一般特征）。
5. 数据集是否包含受版权、商标或专利保护的数据，或完全在公共领域。
6. 数据集是否被购买或许可。
7. 数据集是否包含个人信息（根据 Cal. Civ. Code §1798.140(v)）。
8. 数据集是否包含聚合消费者信息（根据 Cal. Civ. Code §1798.140(b)）。
9. 开发者的清洗、处理或其他修改，以及预期目的。
10. 数据收集的时间段，如果收集正在进行则通知。
11. 数据集在开发期间首次使用的日期。
12. 系统是否使用或持续使用合成数据生成。

第 12 项（合成数据）相对于 Gebru 等人 2018 数据表是新的。第 7 项（个人信息）触发隐私权法案（CPRA）义务。法规豁免安全/完整性、飞机操作和仅限联邦的国家安全系统（第 3111(b) 条）。

### EU AI Act（第 24 课）和 TDM 退出

EU Copyright Directive 文本和数据挖掘例外允许在公开可用内容上训练，除非权利持有人退出。EU AI Act GPAI 行为准则版权章节要求 GPAI 提供者尊重机器可读的退出信号（robots.txt、C2PA "No AI Training" 声明等）。

### 2025 年 DPA 对合法利益的趋同

Irish DPC（2025 年 5 月 21 日）：在 EDPB 意见后，接受 Meta 对欧盟/欧洲经济区成人用户公开内容的训练计划，并附带保障措施。Cologne Higher Regional Court（2025 年 5 月 23 日）驳回对 Meta 的禁令：退出足够。Hamburg DPA 为欧盟范围的一致性放弃紧急程序。UK ICO（2025 年 9 月 23 日）发布积极监管回应——不是正式许可——对 LinkedIn 在类似保障措施和持续监测下恢复 AI 训练。

趋同原则：合法利益可以证明在公开可用的第一方内容上训练，并附带退出。不需要同意。

### Brazilian ANPD（2024 年 6 月）

因信息透明度不足暂停 Meta 对巴西用户数据的 AI 训练处理。与欧盟 DPA 的结果不同——ANPD 优先考虑透明度而非合法利益的可接受性。

### 不可逆性问题

Cookie 同意专为实时、可逆的跟踪设计。训练数据不同：一旦数据进入模型权重，外科手术式擦除是不可能的。从头重新训练是唯一的完整补救，而且成本高昂。

部分补救：
- **遗忘。** 近似移除；通过 MIA 测量（第 22 课）。
- **基于影响函数的局部化。** 识别最受数据影响的权重；选择性更新。
- **微调抑制。** 训练模型拒绝源自数据的输出。

没有一个完全解决问题。合规窗口在收集时。

### Data Provenance Initiative

dataprovenance.org。Longpre, Mahari, Lee 等人 "Consent in Crisis"（2024 年 7 月）：AI 训练数据共享空间的大规模审计。发现：出版商正以加速速度添加 robots.txt 限制。公开可训练的空间正在迅速收缩。2023 -> 2024 年，约 25% 的顶级训练来源添加了某种限制。含义：未来训练数据的可用性取决于新的获取范式（许可、合成生成、激励参与）。

### 这在 Phase 18 中的位置

第 26 课是模型级文档。第 27 课是数据集级治理。它们共同定义透明度层。第 28 课映射研究这些问题的研究生态系统。

## 使用它

`code/main.py` 为模拟数据集生成符合 California AB 2013 的 12 字段数据集摘要脚手架。你可以填写字段并观察哪些触发隐私或版权后续义务。

## 交付它

本课产生 `outputs/skill-provenance-check.md`。给定训练中使用的数据集，它检查 AB 2013 12 字段覆盖、退出基础设施合规性、DPA 对齐和不可逆性风险评估。

## 练习

1. 运行 `code/main.py`。为模拟数据集生成 12 字段摘要，并识别哪些字段指定不足。

2. EU Copyright Directive TDM 退出是机器可读的。提出退出信号的标准格式，并将其与 robots.txt 和 C2PA "No AI Training" 进行比较。

3. 阅读 Data Provenance Initiative 的 "Consent in Crisis"（2024 年 7 月）。描述三个最快限制的内容类别，并论证一个经济后果。

4. 2025 年 DPA 协调接受公开内容训练的合法利益。构建一个合法利益不足够的场景，并识别提供者需要的法律基础。

5. 草拟一个与 AB 2013 字段和每个数据集的 C2PA 签名来源链组合的培训数据来源清单。识别一个技术障碍和一个法律障碍。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| AB 2013 | "加州法律" | 生成式 AI 训练数据透明度；12 个强制字段 |
| TDM 例外 | "文本和数据挖掘" | EU Copyright Directive 训练数据例外，附带退出 |
| 合法利益 | "欧盟基础" | GDPR 第 6 条基础，可能证明公开内容训练的合理性 |
| 退出信号 | "机器可读的不训练" | robots.txt、C2PA "No AI Training"、TDM.Reservation |
| 不可逆性 | "无法取消训练" | 模型权重中的数据无法外科手术式移除 |
| 遗忘 | "近似移除" | 减少模型对特定数据依赖的训练后干预 |
| Consent in Crisis | "DPI 审计" | 2024 年 7 月发现 robots.txt 限制加速 |

## 延伸阅读

- [California AB 2013](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2013) — 生成式 AI 训练数据透明度法
- [EU AI Act + GPAI Code of Practice (第 24 课)](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) — 版权章节
- [Longpre, Mahari, Lee 等人 — Consent in Crisis (dataprovenance.org, 2024 年 7 月)](https://www.dataprovenance.org/consent-in-crisis-paper) — DPI 审计
- [IAPP — EU Digital Omnibus GDPR amendments (2025)](https://iapp.org/news/a/eu-digital-omnibus-amendments-to-gdpr-to-facilitate-ai-training-miss-the-mark) — 监管背景
