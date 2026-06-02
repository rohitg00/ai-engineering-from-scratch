# 模型卡、系统卡与数据集卡（Model, System, and Dataset Cards）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 三种文档格式构筑起 AI 透明度的骨架。Model Cards（模型卡，Mitchell et al. 2019）—— 模型的「营养成分表」：训练数据、按维度拆分的定量分析、伦理考量、注意事项；可惜 Hugging Face 上仅 0.3% 的 model card 写了伦理考量（Oreamuno et al. 2023）。Datasheets for Datasets（数据集说明书，Gebru et al. 2018, CACM）—— 动机、构成、采集流程、标注、分发、维护；类比电子元件 datasheet。Data Cards（数据卡，Pushkarna et al., Google 2022）—— 模块化分层细节（telescopic 望远、periscopic 潜望、microscopic 显微），作为「边界对象（boundary object）」服务于不同读者。2024-2025 进展：用 LLM 自动生成（CardGen, Liu et al. 2024）；model card 越详细，HF 下载量最多可上升 29%（Liang et al. 2024）；可验证证明（Laminator, Duddu et al. 2024）；面向碳水足迹的可持续性披露条目（Jouneaux et al. July 2025）；EU/ISO 监管型卡片正在成形。System Cards（系统卡，Sidhpurwala 2024；Meta 系统级透明度；"Blueprints of Trust" arXiv:2509.20394）—— 端到端 AI 系统文档，覆盖安全能力、prompt-injection 防护、数据外泄检测、与人类价值观的对齐。

**Type:** Build
**Languages:** Python (stdlib, model-card + datasheet + system-card generator)
**Prerequisites:** Phase 18 · 18 (safety frameworks), Phase 18 · 24 (regulatory)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 描述 Mitchell et al. 2019 原始 model card 与 Gebru et al. 2018 datasheet。
- 描述 Data Cards 的 telescopic / periscopic / microscopic 三层结构。
- 描述 System Cards 及其端到端覆盖范围。
- 列举 2024-2025 的三项进展（自动生成、可验证证明、可持续性披露）。

## 问题（Problem）

监管框架（第 24 课）和实验室安全策略（第 18 课）都要求文档。文档格式从模型本身（model cards）演化到数据集（datasheets），再演化到系统（system cards）。每一种处理一个不同尺度的透明度问题。2024-2025 关于自动化和可验证证明的工作，则在攻克长期以来的「写了没人写、写了不可信」的采纳难题。

## 概念（Concept）

### 模型卡（Model Cards, Mitchell et al. 2019）

章节构成：
- 模型详情（Model details）。
- 预期用途（Intended use）。
- 因素（Factors）—— 评估时相关的人口学或环境因素。
- 指标（Metrics）。
- 评估数据（Evaluation data）。
- 训练数据（Training data）。
- 定量分析（Quantitative analyses）—— 按因素拆分。
- 伦理考量（Ethical considerations）。
- 注意事项与建议（Caveats and recommendations）。

采纳问题：Oreamuno et al. 2023 对 Hugging Face 上的 model card 做审计，发现仅 0.3% 写了伦理考量。

### 数据集说明书（Datasheets for Datasets, Gebru et al. 2018）

类比电子元件 datasheet。章节构成：
- 动机（Motivation）—— 数据集为何被创建。
- 构成（Composition）—— 里面有什么。
- 采集流程（Collection process）—— 是如何汇总起来的。
- 标注（Labeling）—— 如适用。
- 用途（Uses）—— 预期用途、禁止用途、风险。
- 分发（Distribution）。
- 维护（Maintenance）。

发表于 CACM 2021。datasheet 是上游文档；model card 的准确性依赖 datasheet 的准确性。

### 数据卡（Data Cards, Pushkarna et al., Google 2022）

模块化的分层细节。三种缩放层级：
- **Telescopic（望远）**：面向非专家的高层摘要。
- **Periscopic（潜望）**：面向 ML 从业者的中层概览。
- **Microscopic（显微）**：面向审计员的特征级详细文档。

边界对象（boundary object）框架：同一份文档，不同读者各取所需。

### 系统卡（System Cards）

范围：端到端 AI 系统，包含模型 + 安全栈 + 部署上下文。典型章节包括：
- 安全能力（Security capabilities）。
- prompt-injection 防护。
- 数据外泄检测（Data-exfiltration detection）。
- 与所声明人类价值观的对齐。
- 事件响应（Incident response）。

参见 Sidhpurwala 2024 与 Meta 的系统级透明度工作。"Blueprints of Trust"（arXiv:2509.20394）将 System Card 形式化为 Model Card 在部署层的对应物。

### 2024-2025 进展

- **CardGen (Liu et al. 2024)**：用 LLM 自动生成 model card；在 Mitchell 2019 标准化字段上，报告显示其客观性高于许多人类作者撰写的卡片。
- **下载量相关性（Liang et al. 2024）**：详细的 model card 与 HF 上最高 29% 的下载量提升相关 —— 采纳压力如今由市场驱动，而不仅是合规驱动。
- **Laminator (Duddu et al. 2024)**：通过硬件 TEE / 密码学签名提供可验证证明 —— 让 model card 携带「主张的证明」，而不仅是「主张」。
- **可持续性（Jouneaux et al. July 2025）**：增补碳、水、计算能耗足迹条目；ISO 标准正在成形。
- **监管型卡片**：EU AI Act（第 24 课）的 GPAI Code of Practice 透明度章节，要求 model card 作为合规产物。

### 这一节在 Phase 18 中的位置

第 24-25 课是监管层和 CVE 层。第 26 课是文档层。第 27 课是训练数据治理，是 datasheet 的上游。第 28 课是产出卡片中所引用评估的研究生态。

## 用起来（Use It）

`code/main.py` 为一个玩具部署生成一份最小化的 model card、datasheet 和 system card。每一份都遵循其规范的章节结构。你可以查看格式，对比三种不同的覆盖范围。

## 上线部署（Ship It）

本课产出 `outputs/skill-card-audit.md`。给定一份 model card、datasheet 或 system card，它会审计章节覆盖度、数值是否做了拆分、以及是否带有可验证证明。

## 练习（Exercises）

1. 运行 `code/main.py`。查看生成的卡片。指出哪些章节较弱（仅占位），并说明需要什么证据来强化它们。

2. 在 model card 中扩展一份按两个人口学群体拆分的定量分析（第 20 课）。

3. 阅读 Oreamuno et al. 2023 关于 0.3% 采纳率的工作。提出一项 model card 规范的结构性改动，以提高伦理考量章节的采纳率。

4. Laminator (Duddu et al. 2024) 用 TEE 做可验证证明。设计一个 model card 字段，用于承载某项评估结果的密码学证明，并描述验证者的角色。

5. 为你以往的某个项目或一个假想的部署写一份 System Card（注意是 System Card，不是 Model Card）。指出对第三方审计员价值最高的那一节。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|------------------------|
| Model Card | "the Mitchell card" | Mitchell et al. 2019 提出的 ML 模型标准文档 |
| Datasheet | "the Gebru datasheet" | Gebru et al. 2018 提出的数据集标准文档 |
| Data Card | "the Pushkarna card" | Google 2022 提出的模块化分层数据文档 |
| System Card | "the deployment card" | 端到端 AI 系统文档，含安全栈 |
| Boundary object | "different readers, one doc" | Data Cards 的框架：同一份文档服务多元受众 |
| Verifiable attestation | "the Laminator attestation" | 附在文档主张上的密码学或 TEE 证明 |
| Sustainability field | "carbon / water footprint" | 2025 年新兴的环境核算条目 |

## 延伸阅读（Further Reading）

- [Mitchell et al. — Model Cards for Model Reporting (arXiv:1810.03993, FAT* 2019)](https://arxiv.org/abs/1810.03993) — 经典 model card 论文
- [Gebru et al. — Datasheets for Datasets (CACM 2021, arXiv:1803.09010)](https://arxiv.org/abs/1803.09010) — datasheet 论文
- [Pushkarna et al. — Data Cards (Google 2022)](https://arxiv.org/abs/2204.01075) — 分层数据文档
- [Sidhpurwala et al. — Blueprints of Trust (arXiv:2509.20394)](https://arxiv.org/abs/2509.20394) — System Card 形式化
