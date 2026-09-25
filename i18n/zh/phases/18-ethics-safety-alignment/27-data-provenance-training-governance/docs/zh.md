# 数据来源与训练数据治理

> EU AI Act 要求到 2025 年 8 月为 GPAI 提供机器可读的选择退出标准（依据 EU Copyright Directive 的 TDM 例外）。California AB 2013（2024 年签署）——生成式 AI 训练数据透明度要求开发者发布包含 12 个法定字段的数据集摘要。2025 年各 DPA 在合法利益上达成一致：爱尔兰 DPC（2025 年 5 月 21 日）在 EDPB 意见后，附带保障措施接受 Meta 基于 EU/EEA 成年用户第一方公开内容的 LLM 训练；科隆高等地方法院（2025 年 5 月 23 日）驳回禁令申请；汉堡 DPA 撤销紧急程序；英国 ICO（2025 年 9 月 23 日）对 LinkedIn 的 AI 训练保障措施（透明度、简化选择退出、延长异议窗口）作出积极监管回应并继续监测——并非正式批准。巴西 ANPD（2024 年 7 月 2 日）以信息透明度不足为由暂停了 Meta 的处理活动；在 Meta 提交合规计划后，该预防措施于 2024 年 8 月 30 日解除。关键的不可逆问题：cookie 同意框架是为实时、可撤销的追踪设计的；一旦数据进入模型权重，手术式删除便不可能——针对已训练神经网络的 GDPR 删除权没有实际可行的实现。合规窗口在数据收集时。Data Provenance Initiative（dataprovenance.org，Longpre、Mahari、Lee 等，"Consent in Crisis"，2024 年 7 月）：大规模审计显示，随着出版商添加 robots.txt 限制，AI 数据公共资源正在迅速萎缩。

**Type:** Learn
**Languages:** Python（标准库，12 字段 California AB 2013 脚手架生成器）
**Prerequisites:** Phase 18 · 24（监管），Phase 18 · 26（模型卡）
**Time:** ~60 分钟

## 学习目标

- 描述 California AB 2013 针对生成式 AI 训练数据透明度的 12 个法定字段。
- 阐述 2025 年各 DPA 对合法利益 LLM 训练的立场（爱尔兰 DPC、英国 ICO、汉堡、科隆）。
- 描述不可逆问题：为什么 GDPR 删除权对已训练神经网络没有实际可行的等价物。
- 阐述 Data Provenance Initiative 的"Consent in Crisis"发现。

## 问题

训练数据治理是每个模型卡（第 26 课）和监管义务（第 24 课）的上游。2024-2025 年，监管格局整合于三项原则：选择退出基础设施、逐数据集披露，以及对公开可用数据的合法利益豁免。未能在收集时合规的提供方无法在下游补救。

## 概念

### California AB 2013

2024 年签署。对 2022 年 1 月 1 日或之后发布的系统，文档必须在 2026 年 1 月 1 日或之前发布。第 3111(a) 节要求开发者发布训练所用数据集的高层级摘要，包含 12 个法定条目：
1. 数据集的来源或所有者。
2. 说明数据集如何服务于 AI 系统的预期用途。
3. 数据集中的数据点数量（可接受大致范围；动态数据集可估计）。
4. 描述数据点类型（已标注数据集的标注类型；未标注数据集的一般特征）。
5. 数据集是否包含受版权、商标或专利保护的数据，或完全属于公有领域。
6. 数据集是否为购买或授权获得。
7. 数据集是否包含个人信息（依据 Cal. Civ. Code §1798.140(v)）。
8. 数据集是否包含汇总消费者信息（依据 Cal. Civ. Code §1798.140(b)）。
9. 开发者进行的清洗、处理或其他修改，及其预期用途。
10. 数据收集的时间段，若收集仍在进行则须注明。
11. 数据集在开发中首次使用的日期。
12. 系统是否使用或持续使用合成数据生成。

第 12 项（合成数据）相对 Gebru 等 2018 年的 datasheets 是新增的。第 7 项（个人信息）触发 Privacy Rights Act（CPRA）义务。该法规豁免安全/完整性系统、飞行器操作系统以及仅限联邦的国家安全系统（第 3111(b) 节）。

### EU AI Act（第 24 课）与 TDM 选择退出

EU Copyright Directive 的文本与数据挖掘例外允许在公开可用内容上训练，除非权利人选择退出。EU AI Act GPAI Code of Practice 的版权章节要求 GPAI 提供方尊重机器可读的选择退出信号（robots.txt、C2PA "No AI Training" 声明等）。

### 2025 年各 DPA 在合法利益上的趋同

爱尔兰 DPC（2025 年 5 月 21 日）：在 EDPB 意见后，附带保障措施接受 Meta 基于 EU/EEA 成年用户第一方公开内容的训练计划。科隆高等地方法院（2025 年 5 月 23 日）驳回针对 Meta 的禁令申请：选择退出已足够。汉堡 DPA 为全欧盟一致性而撤销紧急程序。英国 ICO（2025 年 9 月 23 日）对 LinkedIn 在类似保障措施和持续监测下恢复 AI 训练作出积极监管回应——并非正式批准。

趋同原则：合法利益可证成在附带选择退出的公开可用第一方内容上训练。无需同意。

### 巴西 ANPD（2024 年 6 月）

以信息透明度不足为由，暂停了 Meta 对巴西用户数据的 AI 训练处理。结果与 EU 各 DPA 不同——ANPD 将透明度置于合法利益可采性之上。

### 不可逆问题

Cookie 同意是为实时、可撤销的追踪设计的。训练数据不同：一旦数据进入模型权重，手术式删除便不可能。从头重新训练是唯一完整的补救方式，但其成本令人望而却步。

部分补救方式：
- **Unlearning（遗忘）。** 近似移除；以 MIA 度量（第 22 课）。
- **基于影响函数的定位。** 识别受该数据影响最大的权重；选择性更新。
- **微调抑制。** 训练模型拒绝源自该数据的输出。

以上都不能完全解决问题。合规窗口在数据收集时。

### Data Provenance Initiative

dataprovenance.org。Longpre、Mahari、Lee 等"Consent in Crisis"（2024 年 7 月）：对 AI 训练数据公共资源的大规模审计。发现：出版商正以加速的速度添加 robots.txt 限制。可开放训练的公共资源正在迅速收缩。2023 到 2024 年间，约 25% 的头部训练数据来源添加了某种限制。含义：未来训练数据的可得性取决于新的获取范式（授权、合成生成、激励参与）。

### 在 Phase 18 中的位置

第 26 课是模型级文档。第 27 课是数据集级治理。二者共同构成透明度层。第 28 课梳理研究这些问题的研究生态系统。

```figure
an-provenance-oneway
```

## 使用

`code/main.py` 为一个玩具数据集生成符合 California AB 2013 的 12 字段数据集摘要脚手架。你可以填写各字段，并观察哪些字段会触发隐私或版权的后续义务。

## 交付

本课产出 `outputs/skill-provenance-check.md`。给定一个用于训练的数据集，它会检查 AB 2013 的 12 字段覆盖情况、选择退出基础设施合规性、与 DPA 立场的一致性，以及不可逆风险评估。

## 练习

1. 运行 `code/main.py`。为一个玩具数据集生成 12 字段摘要，并指出哪些字段规定不足。

2. EU Copyright Directive 的 TDM 选择退出是机器可读的。提出一种选择退出信号的标准格式，并将其与 robots.txt 和 C2PA "No AI Training" 比较。

3. 阅读 Data Provenance Initiative 的"Consent in Crisis"（2024 年 7 月）。描述限制增加最快的三个内容类别，并论证一个经济后果。

4. 2025 年各 DPA 的一致立场接受以合法利益在公开内容上训练。构造一个合法利益不足以成立的场景，并指出提供方需要的替代法律依据。

5. 草拟一份与 AB 2013 字段兼容的训练数据来源清单（manifest），以及每个数据集的 C2PA 签名来源链。指出一个技术障碍和一个法律障碍。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| AB 2013 | “加州那部法律” | 生成式 AI 训练数据透明度；12 个法定字段 |
| TDM exception | “文本与数据挖掘” | EU Copyright Directive 附带选择退出的训练数据例外 |
| Legitimate interest | “欧盟的法律依据” | GDPR 第 6 条依据，可证成在公开内容上训练 |
| Opt-out signal | “机器可读的不许训练” | robots.txt、C2PA "No AI Training"、TDM.Reservation |
| Irreversibility | “无法撤销训练” | 数据一旦进入模型权重便无法手术式移除 |
| Unlearning | “近似移除” | 训练后干预，以降低模型对特定数据的依赖 |
| Consent in Crisis | “DPI 审计” | 2024 年 7 月关于 robots.txt 限制加速增加的发现 |

## 延伸阅读

- [California AB 2013](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2013) — 生成式 AI 训练数据透明度法律
- [EU AI Act + GPAI Code of Practice（第 24 课）](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) — 版权章节
- [Longpre、Mahari、Lee 等 — Consent in Crisis（dataprovenance.org，2024 年 7 月）](https://www.dataprovenance.org/consent-in-crisis-paper) — DPI 审计
- [IAPP — EU Digital Omnibus GDPR 修正案（2025）](https://iapp.org/news/a/eu-digital-omnibus-amendments-to-gdpr-to-facilitate-ai-training-miss-the-mark) — 监管背景