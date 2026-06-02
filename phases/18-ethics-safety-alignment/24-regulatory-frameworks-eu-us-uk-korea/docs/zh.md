# 监管框架——欧盟、美国、英国、韩国（Regulatory Frameworks — EU, US, UK, Korea）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 四套主要监管制度勾勒了 2026 年的 AI 治理图景。欧盟 AI Act（2024 年 8 月 1 日生效）——禁止性做法和 AI 素养自 2025 年 2 月 2 日起适用；GPAI 义务自 2025 年 8 月 2 日起适用；全面适用以及 Article 50 的透明度义务自 2026 年 8 月 2 日起；存量 GPAI 与嵌入式高风险系统自 2027 年 8 月 2 日起；罚则最高 1500 万欧元或全球营业额的 3%。GPAI Code of Practice（行为准则，2025 年 7 月 10 日发布）：三章——透明度、版权、安全性与安保（Safety and Security）——共 12 项承诺；执法自 2026 年 8 月开始。英国 AISI -> AI Security Institute（2025 年 2 月）：改名意味着范围收窄。美国 AISI -> CAISI（2025 年 6 月）：NIST 下设 Center for AI Standards and Innovation；姿态转向亲增长。韩国 AI Framework Act（2024 年 12 月通过，2026 年 1 月生效）：第 12 条在 MSIT（科学技术信息通信部）下设立 AISI；对在韩运营的外国 AI 公司强制要求设立本地代表，并要求高影响 AI 与 generative AI 的风险评估和安全措施。

**Type:** Learn
**Languages:** none
**Prerequisites:** Phase 18 · 18（前沿框架）, Phase 18 · 27（数据治理）
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 描述欧盟 AI Act 的风险分级（prohibited、high-risk、general-purpose、limited-risk），以及 2025 年 8 月 / 2026 年 8 月 / 2027 年 8 月的时间线。
- 描述 GPAI Code of Practice 的三个章节，以及每章分别约束哪些 provider。
- 描述 2025 年的两次更名：英国 AISI -> AI Security Institute；美国 AISI -> CAISI；每次更名暗示了怎样的政策方向。
- 陈述韩国 AI Framework Act 的核心条款。

## 问题（The Problem）

实验室自定的框架（Lesson 18）是自愿的；监管框架是强制的。2024–2026 这段时间，第一波综合性 AI 监管开始落地生效。部署方必须把技术控制项映射到监管义务上；这套映射在不同司法辖区里并不一样。

## 概念（The Concept）

### 欧盟 AI Act（EU AI Act）

**2024 年 8 月 1 日生效。** 风险分级结构：

- **Prohibited practices（禁止性做法，第 5 条）**。社会评分、公共场所的实时远程生物特征识别（执法例外除外）、对弱势群体进行剥削性操控。2025 年 2 月 2 日起适用。
- **High-risk systems（高风险系统，附件 III）**。就业、教育、信贷、执法、司法、移民。要求做合规性评估（conformity assessment）、风险管理、日志记录、透明度。
- **General-Purpose AI (GPAI) models（通用人工智能模型）**。2025 年 8 月 2 日起适用。所有 GPAI provider 都有义务；具有系统性风险的 GPAI（训练计算量 >1e25 FLOP）还有附加义务。
- **Limited-risk systems（有限风险系统）**。承担第 50 条下的透明度义务（AI 生成内容的标注）。2026 年 8 月 2 日起适用。

时间线：
- 2025 年 2 月 2 日：禁止性做法 + AI 素养。
- 2025 年 8 月 2 日：GPAI + 治理。
- 2026 年 8 月 2 日：全面适用 + 第 50 条透明度 + 罚则最高 1500 万欧元 / 全球营业额 3%。
- 2027 年 8 月 2 日：存量 GPAI + 嵌入式高风险。

欧盟委员会在 2025 年末提议把高风险时间线调整为 16 个月。

### GPAI Code of Practice（GPAI 行为准则）

2025 年 7 月 10 日发布。三章：

- **Transparency（透明度）**。所有 GPAI provider。
- **Copyright（版权）**。所有 GPAI provider。
- **Safety and Security（安全性与安保）**。具有系统性风险的 GPAI provider（估计 5–15 家公司）。

合计 12 项承诺。一个由 AI Office 主持的 Signatory Taskforce（签署方工作组）负责实施落地。执法自 2026 年 8 月 2 日开始；在那之前，接受善意合规（good-faith compliance）。

### 第 50 条透明度准则（Transparency Code for Article 50）

第一稿 2025 年 12 月 17 日。第二稿 2026 年 3 月。最终稿 2026 年 6 月。覆盖 AI 生成内容的标注，包括 deepfake——也就是要求落地 Lesson 23 中水印技术的那一层监管。

### 英国 AI Security Institute（2025 年 2 月）

由 AI Safety Institute 更名而来。改名收窄了范围：放下了算法偏见与言论自由那套表述，聚焦于前沿能力的安全（frontier capability security）。开源了 Inspect 评估工具（2024 年 5 月）。在控制安全论证（control safety cases）上与 Redwood（Lesson 10）合作。

### 美国 CAISI（2025 年 6 月）

特朗普政府把 NIST 下的 AI Safety Institute 改造为 Center for AI Standards and Innovation。按副总统 Vance 在巴黎 AI Action Summit 上的发言，姿态转向「亲增长的 AI 政策」。淡化部署前评估（pre-deployment evaluation），强调标准与创新支持。在国内层面，作为对欧盟 AI Act 监管姿态的一种制衡。

### 韩国 AI Framework Act

2024 年 12 月通过，2025 年 1 月颁布，2026 年 1 月生效。整合了此前 19 部独立的 AI 法案。

第 12 条在 Ministry of Science and ICT（MSIT，科学技术信息通信部）下设立 AISI。强制要求：
- 在韩运营的外国 AI 公司必须设立本地代表。
- 对「高影响（high-impact）」AI 系统做风险评估。
- 对 generative AI 与高影响 AI 采取安全措施。

亚洲第一个具备综合性横向 AI 监管的司法辖区。

### 跨司法辖区的动态

- 欧盟：严格、按风险分级、罚则重。隐私相邻领域监管的标杆。
- 美国：偏向创新、去中心化，州层面（例如加州 AB 2013——Lesson 27）来填补联邦层面的空白。
- 英国：聚焦狭义的安全，评估基础设施很强。
- 韩国：MSIT 主导，针对外国 provider。

互相竞争的监管哲学。在多个司法辖区都有部署的部署方，必须按最严格的那一套合规——在 2026 年通常就是欧盟 AI Act。

### 这一节在 Phase 18 中的位置

Lesson 18 是实验室自愿性治理；Lesson 24 是监管层面；Lesson 25 是 AI 系统正在涌现出来的一类新 CVE；Lesson 26–27 涵盖文档（cards）与训练数据治理。

## 用起来（Use It）

没有代码。去读欧盟 AI Act 的一手材料：法规原文、GPAI Code of Practice、英国 AISI 的 Inspect 框架。把你自己的部署逐项映射到每个司法辖区下应承担的义务。

## 上线部署（Ship It）

本课产出 `outputs/skill-regulatory-map.md`。给定一份部署描述，它会映射出适用的司法辖区、每个辖区里的分级归类、各辖区下的义务，以及对应的截止时间结构。

## 练习（Exercises）

1. 读欧盟 AI Act（regulation 2024/1689）和 GPAI Code of Practice（2025 年 7 月 10 日）。指出三项适用于所有 GPAI provider 的义务，以及三项只适用于具有系统性风险的 GPAI 的义务。

2. 一个部署：由美国公司发起，跑在欧盟基础设施上，服务韩国用户。哪三套司法辖区的规则适用？在每个具体的实质性问题上，哪一套规则起约束作用？

3. 英国 AI Security Institute 改名后范围收窄。请正反两面各论证一遍。指出每一面所依赖的政策假设。

4. CAISI 的「亲增长」表述与 2022–2024 年 AI safety institute 模式有所偏离。指出由这种表述会推导出的两个可度量的政策变化。

5. 韩国 AI Framework Act 要求外国 provider 设立本地代表。请描述：一家服务韩国用户的湾区公司，由此带来的运营层面影响。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际含义 |
|------|-----------------|------------------------|
| EU AI Act | "the regulation" | 基于风险分级的横向 AI 监管；2024 年 8 月生效 |
| GPAI | "general-purpose AI" | 大型基础模型；其中具有系统性风险的子集承担额外义务 |
| Article 50 | "transparency obligations" | AI 生成内容标注；2026 年 8 月起适用 |
| UK AISI | "AI Security Institute" | 2025 年 2 月更名；范围更窄，聚焦前沿安全 |
| CAISI | "US center for AI standards" | 2025 年 6 月由 AI Safety Institute 更名而来；亲增长姿态 |
| Korean AI Framework Act | "MSIT horizontal regulation" | 亚洲首部综合性 AI 法律；2026 年 1 月生效 |
| Systemic-risk GPAI | "the 1e25 FLOP threshold" | 附加义务的分级；估计约束 5–15 家公司 |

## 延伸阅读（Further Reading）

- [EU AI Act 法规原文（Regulation 2024/1689）](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) ——法规与时间线
- [GPAI Code of Practice（2025 年 7 月 10 日）](https://digital-strategy.ec.europa.eu/en/library/final-version-general-purpose-ai-code-practice) ——三章式行为准则
- [UK AI Security Institute（2025 年 2 月更名）](https://www.gov.uk/government/organisations/ai-security-institute) ——官方页面
- [CSET——South Korea AI Framework Act Analysis（2025）](https://cset.georgetown.edu/publication/south-korea-ai-law-2025/) ——韩国框架分析
