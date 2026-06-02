# 数据溯源与训练数据治理（Data Provenance and Training-Data Governance）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 欧盟《AI 法案》（EU AI Act）要求 GPAI 在 2025 年 8 月前支持机器可读的 opt-out 标准（依托 EU 版权指令的 TDM 例外）。加州 AB 2013（2024 年签署）——生成式 AI 训练数据透明度法，要求开发者按 12 项强制字段公布数据集摘要。2025 年各国数据保护机关（DPA）在「正当利益（legitimate interest）」上趋同：爱尔兰 DPC（2025 年 5 月 21 日）在 EDPB 意见后，接受 Meta 在带有保障措施的前提下使用第一方公开 EU/EEA 成年人内容训练 LLM；科隆高等地方法院（2025 年 5 月 23 日）驳回禁令；汉堡 DPA 撤回紧急程序；英国 ICO（2025 年 9 月 23 日）对 LinkedIn 的 AI 训练保障措施（透明度、简化 opt-out、延长异议窗口）出具积极的监管回应，并继续监控——但**不构成正式放行**。巴西 ANPD（2024 年 7 月 2 日）以信息透明度不足为由暂停 Meta 的处理；该预防性措施在 Meta 提交合规计划后于 2024 年 8 月 30 日解除。核心的不可逆问题：cookie 同意框架是为实时、可逆追踪设计的；一旦数据进入模型权重，外科手术式的擦除不再可能——对于已训练好的神经网络，并不存在 GDPR 删除权（right-to-erasure）的实际等价物。**合规窗口在采集时刻就关上了**。Data Provenance Initiative（dataprovenance.org，Longpre、Mahari、Lee 等，《Consent in Crisis》，2024 年 7 月）：大规模审计显示，随着出版方不断在 robots.txt 中加入限制，AI 数据公地正在快速萎缩。

**Type:** Learn
**Languages:** Python（标准库，加州 AB 2013 的 12 字段脚手架生成器）
**Prerequisites:** Phase 18 · 24（监管），Phase 18 · 26（卡片）
**Time:** ~60 分钟

## 学习目标（Learning Objectives）

- 描述加州 AB 2013 针对生成式 AI 训练数据透明度的 12 项强制字段。
- 陈述 2025 年 DPA 对「正当利益用于 LLM 训练」的立场（爱尔兰 DPC、英国 ICO、汉堡、科隆）。
- 描述不可逆问题：为什么 GDPR 删除权对已训练的神经网络没有实际对应物。
- 陈述 Data Provenance Initiative 的「Consent in Crisis」核心发现。

## 问题（The Problem）

训练数据治理是每一张模型卡（model card，第 26 课）和每一项监管义务（第 24 课）的上游。2024–2025 年间，监管格局收敛在三条原则上：opt-out 基础设施、按数据集披露、以及对公开可用数据的「正当利益」适配。**采集时不合规的提供方，无法在下游补救**。

## 概念（The Concept）

### 加州 AB 2013（California AB 2013）

2024 年签署。对于 2022 年 1 月 1 日及以后发布的系统，必须在 2026 年 1 月 1 日或之前发布相关文档。第 3111(a) 条要求开发者公布训练所用数据集的高层摘要，包含 12 项法定条目：

1. 数据集的来源或所有者。
2. 数据集如何服务于该 AI 系统的预期用途的描述。
3. 数据集中的数据点数量（可接受大致区间；动态数据集可给估值）。
4. 数据点类型描述（已标注数据集给出标签类型；未标注数据集给出总体特征）。
5. 数据集是否包含受版权、商标或专利保护的数据，或完全属于公有领域。
6. 数据集是购买的还是授权的。
7. 数据集是否包含个人信息（依加州民法典 §1798.140(v)）。
8. 数据集是否包含汇总消费者信息（依加州民法典 §1798.140(b)）。
9. 开发者所做的清洗、处理或其他修改，及其预期目的。
10. 数据采集的时间段，若仍在持续采集需注明。
11. 数据集首次在开发中被使用的日期。
12. 系统是否使用、或持续使用合成数据生成。

第 12 项（合成数据）是相对于 Gebru 等 2018 年 datasheet 的新增内容。第 7 项（个人信息）会触发《加州隐私权法案》（CPRA）下的义务。该法对安全/完整性、航空器运行、以及仅用于联邦的国家安全系统给予豁免（第 3111(b) 条）。

### 欧盟 AI 法案（第 24 课）与 TDM opt-out

EU 版权指令的「文本与数据挖掘」（text-and-data-mining，TDM）例外允许在公开可用内容上训练，**除非**权利人选择 opt-out。EU AI 法案 GPAI 行为准则（Code of Practice）的版权章要求 GPAI 提供方尊重机器可读的 opt-out 信号（robots.txt、C2PA "No AI Training" claim 等）。

### 2025 年各 DPA 在正当利益上的趋同

爱尔兰 DPC（2025 年 5 月 21 日）：在 EDPB 意见后，接受 Meta 使用第一方公开 EU/EEA 成年用户内容进行训练的方案，附带保障措施。科隆高等地方法院（2025 年 5 月 23 日）驳回针对 Meta 的禁令：opt-out 已经足够。汉堡 DPA 撤回紧急程序，转向欧盟范围的一致性。英国 ICO（2025 年 9 月 23 日）对 LinkedIn 在类似保障措施下重启 AI 训练给出积极的监管回应——**并非正式放行**——并将持续监控。

收敛出的原则是：在公开可用的第一方内容上做训练，正当利益 + opt-out 即可作为合法基础。**不需要明示同意**。

### 巴西 ANPD（2024 年 6 月）

以信息透明度不足为由，暂停 Meta 处理巴西用户数据用于 AI 训练。结论与欧盟各 DPA 不同——ANPD 优先考虑透明度，而非「正当利益的可适用性」。

### 不可逆问题（The irreversibility problem）

Cookie 同意是为实时、可逆的追踪设计的。训练数据不一样：一旦数据进入模型权重，就**无法外科手术式地擦除**。从零重训是唯一的完全补救方式，但代价高得令人望而却步。

部分补救手段：

- **Unlearning（遗忘）**。近似式移除；用 MIA（第 22 课）来度量。
- **Influence function-based localization（基于影响函数的定位）**。识别受该数据影响最大的权重，选择性更新。
- **Fine-tune-suppression（微调抑制）**。训练模型拒绝输出与该数据相关的内容。

没有一种能完全解决问题。**合规窗口在采集时刻**。

### Data Provenance Initiative

dataprovenance.org。Longpre、Mahari、Lee 等，《Consent in Crisis》（2024 年 7 月）：对 AI 训练数据公地的大规模审计。结论：出版方加 robots.txt 限制的速度在加快。可以公开训练的公地正在快速收缩。从 2023 → 2024，约 25% 的头部训练源添加了某种限制。含义：未来训练数据的可得性，将取决于新的获取范式（许可、合成生成、激励参与）。

### 这一课在 Phase 18 中的位置

第 26 课讲的是模型层面的文档。第 27 课讲的是数据集层面的治理。两者共同定义「透明度层」。第 28 课描绘围绕这些问题工作的研究生态。

## 用起来（Use It）

`code/main.py` 为一个玩具数据集生成符合加州 AB 2013 的 12 字段数据集摘要脚手架。你可以填充字段，观察哪些字段会触发隐私或版权方面的后续义务。

## 上线部署（Ship It）

这一课产出 `outputs/skill-provenance-check.md`。给定一个用于训练的数据集，它会检查 AB 2013 的 12 字段覆盖、opt-out 基础设施合规、DPA 一致性，以及不可逆性风险评估。

## 练习（Exercises）

1. 运行 `code/main.py`。为一个玩具数据集产出 12 字段摘要，并指出哪些字段尚未充分描述。

2. EU 版权指令的 TDM opt-out 是机器可读的。提议一种 opt-out 信号的标准格式，并将其与 robots.txt 和 C2PA "No AI Training" 进行对比。

3. 阅读 Data Provenance Initiative 的《Consent in Crisis》（2024 年 7 月）。描述限制速度最快的三类内容，并论证一项经济后果。

4. 2025 年的 DPA 趋同接受用「正当利益」做公开内容训练。构造一个「正当利益不足以支撑」的场景，并指出此时提供方需要的另一种合法基础是什么。

5. 草拟一份训练数据溯源 manifest，能与 AB 2013 字段以及每个数据集的 C2PA 签名溯源链协同工作。指出一个技术障碍和一个法律障碍。

## 关键术语（Key Terms）

| 术语 | 大家通常这样说 | 它实际指的是 |
|------|-----------------|------------------------|
| AB 2013 | 「那部加州法」 | 生成式 AI 训练数据透明度；12 项强制字段 |
| TDM exception | 「文本与数据挖掘例外」 | EU 版权指令中的训练数据例外，配合 opt-out |
| Legitimate interest（正当利益） | 「欧盟那个基础」 | GDPR 第 6 条中可能为公开内容训练提供合法性的基础 |
| Opt-out signal | 「机器可读的 no-train」 | robots.txt、C2PA "No AI Training"、TDM.Reservation |
| Irreversibility（不可逆性） | 「无法 un-train」 | 模型权重里的数据无法被外科手术式移除 |
| Unlearning | 「近似式移除」 | 训练后干预，降低模型对特定数据的依赖 |
| Consent in Crisis | 「DPI 那份审计」 | 2024 年 7 月的发现：robots.txt 限制在加速增加 |

## 延伸阅读（Further Reading）

- [California AB 2013](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2013) — 生成式 AI 训练数据透明度法
- [EU AI Act + GPAI Code of Practice（第 24 课）](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) — 版权章
- [Longpre、Mahari、Lee 等 — Consent in Crisis（dataprovenance.org，2024 年 7 月）](https://www.dataprovenance.org/consent-in-crisis-paper) — DPI 审计
- [IAPP — EU Digital Omnibus GDPR 修订（2025）](https://iapp.org/news/a/eu-digital-omnibus-amendments-to-gdpr-to-facilitate-ai-training-miss-the-mark) — 监管背景
