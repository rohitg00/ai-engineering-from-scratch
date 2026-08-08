# 合规 —— SOC 2、HIPAA、GDPR、PCI-DSS、EU AI Act、ISO 42001

> 2026 年，多框架覆盖是企业交易的标配。**EU AI Act**：2024 年 8 月 1 日生效。大多数高风险要求于 2026 年 8 月 2 日强制执行。高风险系统义务违规罚款最高 €1500 万或全球年营业额 3%（第 99(4) 条）；禁止性 AI 实践违规最高 €3500 万或 7%（第 99(3) 条）。若面向欧盟用户，则全球适用。**Colorado AI Act**：2026 年 6 月 30 日生效（原 2026 年 2 月被 SB25B-004 推迟）—— 高风险系统需进行影响评估，用户有权对 AI 决策提出申诉。Virginia 对信用/就业/住房/教育领域也有类似规定。**SOC 2 Type II**：B2B AI 的事实标准要求（金融科技需 Type II，非 Type I）。**GDPR**：迄今最大 AI 相关罚款为荷兰 DPA 2024 年 9 月对 Clearview AI 的 €3050 万；意大利 Garante 2024 年 12 月对 OpenAI 开出 €1500 万（2026 年 3 月上诉推翻）。实时 PII 脱敏是推理层的可辩护标准；仅事后清理不足够。**HIPAA**：医疗领域绑定 —— 无 BAA 不得将 PHI 发送至外部 AI 服务。**PCI-DSS**：AI 交互层覆盖需要配置 + 合同约定，非自动生效。**ISO 42001**：新兴 AI 治理标准，与 ISO 27001 一起日益成为采购要求。参考档案：OpenAI 维护 SOC 2 Type 2、ISO/IEC 27001:2022、ISO/IEC 27701:2019、GDPR/CCPA/HIPAA (BAA)/FERPA、ChatGPT 支付组件的 PCI-DSS。跨框架映射减少审计疲劳：访问控制同时映射到 ISO 27001 A.5.15-5.18、GDPR 第 32 条、HIPAA §164.312(a)。

**类型：** 学习
**语言：**（Python 可选 —— 合规是政策 + 流程，非代码）
**前置知识：** 第 17 阶段 · 25（安全）、第 17 阶段 · 13（可观测性）
**时间：** ~60 分钟

## 学习目标

- 列举 2026 年与 LLM 产品相关的七个框架，并将每个匹配到客户群体。
- 引用 EU AI Act 执行时间线（2024 年 8 月生效；高风险 2026 年 8 月强制执行）及两级罚款上限（€1500 万 / 3% 针对高风险义务，€3500 万 / 7% 针对禁止性实践）。
- 解释为何事后 PII 清理对 GDPR 不足够，并说明实时推理层脱敏是可辩护标准。
- 描述跨框架控制映射（例如，访问控制映射到 ISO 27001 A.5.15-5.18 + GDPR 第 32 条 + HIPAA §164.312(a)）。

## 问题背景

企业客户的采购要求提供 SOC 2 Type II、GDPR、HIPAA BAA、ISO 27001 和"EU AI Act 合规声明"。你的团队只有 SOC 2 Type I。距离 Type II 还有六个月，且尚未开始 GDPR 第 30 条记录。

多框架覆盖不是 LLM 问题 —— 它是企业 SaaS 问题，带有 LLM 特定叠加层。2026 年的采购团队想要一个矩阵，每行一个框架、每列一个控制，而非一份 PDF。

## 核心概念

### 七大框架

| 框架 | 范围 | LLM 特定要求 |
|------|------|-------------|
| SOC 2 Type II | B2B SaaS 基线 | 6–12 个月的过程控制审计 |
| HIPAA | 美国医疗 | 需要 BAA；PHI 未经签署协议不得离开基础设施 |
| GDPR | 欧盟用户 | 实时 PII 脱敏；数据主体权利；第 30 条记录 |
| PCI-DSS | 支付数据 | AI 接触支付需配置 + 合同 |
| EU AI Act | 面向欧盟用户 | 风险等级分类；高风险系统：合格评定、文档、日志 |
| Colorado AI Act | 面向科罗拉多居民 | 影响评估；申诉权 |
| ISO 42001 | AI 治理 | 新兴；与 ISO 27001 配对 |

### EU AI Act 时间线

- 2024 年 8 月 1 日：生效。
- 2025 年 2 月 2 日：禁止性 AI 实践强制执行。
- 2026 年 8 月 2 日：高风险系统强制执行（合格评定、文档、日志）。
- 2027 年 8 月：协调立法下产品中的高风险系统。

风险等级：不可接受（禁止）、高风险（合格 + 日志）、有限风险（透明）、最小风险（无约束）。大多数 B2B LLM SaaS 属于有限风险；高风险涉及就业、信用、教育、执法、移民、基础服务。

罚款（第 99 条）：高风险系统义务违规最高 €1500 万或全球年营业额 3%（第 99(4) 条）；禁止性 AI 实践最高 €3500 万或 7%（第 99(3) 条）；取较高者。

### GDPR —— 实时脱敏是标准

事后清理（LLM 看到数据后再脱敏 PII）不是可辩护姿态 —— 模型已经看到了数据。实时推理层脱敏是 2026 年标准：

- LLM 调用前进行实体识别。
- 一致性分词（Mesh 方法）保留语义。
- 仅存储脱敏后的 prompt + 经同意的 opt-in 原始数据。

近期执法：荷兰 DPA 2024 年 9 月对 Clearview AI 的 €3050 万是迄今最大 AI 相关 GDPR 罚款；意大利 Garante 2024 年 12 月对 OpenAI 的 €1500 万是最大 LLM 相关罚款，但 2026 年 3 月上诉推翻，裁决仍在进一步审查中。事后处理声明在审计中已失败。

### HIPAA —— BAA 不是可选项

未经签署的商业伙伴协议，不得将 PHI 发送至外部 AI 服务。三大超大规模 LLM 平台（Bedrock、Azure OpenAI、Vertex）均提供 BAA。OpenAI 直连 API 提供 BAA。Anthropic 直连 API 提供 BAA。发送 PHI 前请确认。

### SOC 2 Type II

Type I：控制已设计和记录。
Type II：控制在 6–12 个月内有效运行。

2026 年 B2B 采购默认要求 Type II。Type I 是起步；Type II 是门槛。

常见审计驱动因素：访问日志（谁看了什么）、变更管理（如何部署）、风险评估（季度）、事件响应（是否测试过？）。第 17 阶段 · 25 的审计日志可直接复用。

### 跨框架映射

一项访问控制策略满足多个框架控制：

| 控制 | 框架 |
|------|------|
| 访问日志 | ISO 27001 A.5.15-5.18、GDPR 第 32 条、HIPAA §164.312(a) |
| 变更管理 | ISO 27001 A.8.32、PCI DSS 要求 6、HIPAA 违规通知范围 |
| 传输加密 | ISO 27001 A.8.24、GDPR 第 32 条、HIPAA §164.312(e) |
| 密钥管理 | ISO 27001 A.8.19、PCI DSS 要求 8、SOC 2 CC6.1 |

合规工具（Drata、Vanta、Secureframe）自动化此映射。规模上去后值得投入。

### ISO 42001 —— 新兴标准

2023 年底发布。与 ISO 27001 一起日益成为采购要求。AI 治理框架，包括风险管理、数据质量、透明性、人类监督。

### OpenAI 的参考档案

OpenAI 维护 SOC 2 Type 2、ISO/IEC 27001:2022、ISO/IEC 27701:2019、GDPR/CCPA/HIPAA (BAA)/FERPA、ChatGPT 支付组件的 PCI-DSS。这大致是 2026 年企业入门标准。

### 需要记住的数字

- EU AI Act 罚款：最高 €1500 万 / 3%（高风险义务，第 99(4) 条）；最高 €3500 万 / 7%（禁止性实践，第 99(3) 条）。
- EU AI Act 高风险强制执行：2026 年 8 月 2 日。
- 迄今最大 AI 相关 GDPR 罚款：€3050 万，Clearview AI（荷兰 DPA，2024 年 9 月）。
- 最大 LLM 相关 GDPR 罚款：€1500 万，OpenAI（意大利 Garante，2024 年 12 月；2026 年 3 月上诉推翻）。
- SOC 2 Type II 窗口：6–12 个月有效运行控制。
- Colorado AI Act 生效日期：2026 年 6 月 30 日（原 2026 年 2 月被 SB25B-004 推迟）。

## 使用

`code/main.py` 是一个 Python 实现的合规映射表 —— 给定一个控制，列出其满足的框架。

## 交付

本课产出 `outputs/skill-compliance-matrix.md`。给定客户群体和地理范围，指定所需框架和控制。

## 练习

1. 你的第一个企业客户要求 SOC 2 Type II、HIPAA BAA、EU AI Act 声明。赢得这笔交易的最低可行合规姿态是什么？
2. 对三个假设的 LLM 产品进行 EU AI Act 风险等级分类。高风险时会发生什么变化？
3. 你不小心将 PHI 发送给了没有 BAA 的提供商。走一遍事件响应流程。
4. 辩论 ISO 42001 对中端市场 AI 供应商在 2026 年是否"必要"。
5. 将你的 LLM 审计日志字段（第 17 阶段 · 25）映射到至少三个框架控制。

## 关键术语

| 术语 | 业界说法 | 实际含义 |
|------|---------|---------|
| SOC 2 Type II | "audited controls" | 6–12 个月有效运行控制，经独立鉴证 |
| HIPAA BAA | "healthcare contract" | 商业伙伴协议；PHI 必需 |
| GDPR | "EU privacy" | 实时 PII 脱敏是 2026 年可辩护标准 |
| EU AI Act | "EU AI rules" | 高风险 2026 年 8 月强制执行；€1500 万 / 3%（高风险义务）— €3500 万 / 7%（禁止性实践） |
| Colorado AI Act | "US AI state law" | 2026 年 6 月 30 日生效（被 SB25B-004 推迟）；影响评估 |
| ISO 42001 | "AI governance" | AI 风险 + 透明性的新兴框架 |
| ISO 27001 | "security ISMS" | 信息安全管理系统基线 |
| Conformity assessment | "EU AI doc package" | 高风险要求：文档、测试、日志 |
| Cross-framework mapping | "one control, many frames" | 单一策略满足多个框架控制 |

## 延伸阅读

- [OpenAI Security and Privacy](https://openai.com/security-and-privacy/) —— 参考合规档案。
- [GuardionAI — LLM Compliance 2026: ISO 42001, EU AI Act, SOC 2, GDPR](https://guardion.ai/blog/llm-compliance-guide-iso-42001-eu-ai-act-soc2-gdpr-2026)
- [Dsalta — SOC 2 Type 2 Audit Guide 2026: 10 AI Controls](https://www.dsalta.com/resources/ai-compliance/soc-2-type-2-audit-guide-2026-10-ai-powered-controls-every-saas-team-needs)
- [EU AI Act official text](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) —— 一手来源。
- [Colorado AI Act](https://leg.colorado.gov/bills/sb24-205) —— 一手来源。
- [ISO/IEC 42001:2023](https://www.iso.org/standard/81230.html) —— AI 管理系统标准。
