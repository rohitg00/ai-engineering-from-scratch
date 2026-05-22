# 合规框架 — SOC 2、HIPAA、GDPR、PCI-DSS、EU AI Act、ISO 42001

> 多框架覆盖是 2026 年企业交易的必备条件。**EU AI Act（欧盟人工智能法案）**：自 2024 年 8 月 1 日起生效。大多数高风险要求将于 2026 年 8 月 2 日开始执行。违反高风险系统义务最高罚款 1500 万欧元或全球年营业额的 3%（第 99(4) 条）； prohibited AI practices（禁止的人工智能行为）最高罚款 3500 万欧元或 7%（第 99(3) 条）。如果服务欧盟用户，则全球适用。**Colorado AI Act（科罗拉多州人工智能法案）**：2026 年 6 月 30 日生效（经 SB25B-004 从 2026 年 2 月推迟）— 高风险系统需进行影响评估，有权对 AI 决策提出申诉。Virginia（弗吉尼亚州）在信贷/就业/住房/教育方面类似。**SOC 2 Type II**：事实上的 B2B AI 要求（金融科技领域需要 Type II，而非 Type I）。**GDPR（通用数据保护条例）**：有记录以来最大的 AI 专项罚款是 Clearview AI 被罚 3050 万欧元（荷兰数据保护局，2024 年 9 月）；意大利 Garante 于 2024 年 12 月对 OpenAI 罚款 1500 万欧元（后于 2026 年 3 月上诉成功推翻，该裁决仍在进一步审查中）。推理时实时 PII（个人身份信息）编辑是公认的标准；事后清理是不够的。**HIPAA（健康保险流通与责任法案）**：医疗领域受限 — 没有 BAA（Business Associate Agreement，商业伙伴协议）不得将 PHI（Personal Health Information，个人健康信息）发送给外部 AI 服务。**PCI-DSS（支付卡行业数据安全标准）**：AI 交互层覆盖需要配置 + 合同约定，而非自动实现。**ISO 42001**：新兴 AI 治理标准，与 ISO 27001 一样，日益成为采购要求。参考案例：OpenAI 持有 SOC 2 Type 2、ISO/IEC 27001:2022、ISO/IEC 27701:2019、GDPR/CCPA/HIPAA (BAA)/FERPA、ChatGPT 支付组件的 PCI-DSS。跨框架映射可减少审计疲劳：访问控制映射到 ISO 27001 A.5.15-5.18、GDPR 第 32 条、HIPAA §164.312(a)。

**类型：** 学习
**语言：**（Python 可选 — 合规是策略 + 流程，而非代码）
**前置条件：** 阶段 17 · 25（安全）、阶段 17 · 13（可观测性）
**时间：** 约 60 分钟

## 学习目标

- 列举与 LLM 产品相关的 2026 年七大框架，并将每个框架与对应的客户群体匹配。
- 引用 EU AI Act 的执行时间表（2024 年 8 月生效；2026 年 8 月执行高风险条款），以及两档罚款上限（高风险义务为 1500 万欧元/3%，禁止行为为 3500 万欧元/7%）。
- 解释为什么事后 PII 清理无法满足 GDPR 要求，并指出实时推理层编辑是公认的标准。
- 描述跨框架控制映射（例如，访问控制映射到 ISO 27001 A.5.15-5.18 + GDPR 第 32 条 + HIPAA §164.312(a)）。

## 问题

企业客户的采购部门要求提供 SOC 2 Type II、GDPR、HIPAA BAA、ISO 27001 以及"EU AI Act 合规声明"。您的团队持有 SOC 2 Type I。距离 Type II 还有六个月，且尚未开始 GDPR 第 30 条记录。

多框架覆盖不是 LLM 的问题 — 而是企业 SaaS 的问题，只是叠加了 LLM 特有的要求。2026 年的采购团队想要一个每行对应一个框架、每列对应一项控制的矩阵，而不是一份 PDF。

## 概念

### 七大框架

| 框架 | 范围 | LLM 特有要求 |
|-----------|-------|--------------------------|
| SOC 2 Type II | B2B SaaS 基线 | 经过 6-12 个月审计的流程控制 |
| HIPAA | 美国医疗 | 需要 BAA；未经签署协议，PHI 不得离开基础设施 |
| GDPR | 欧盟用户 | 实时 PII 编辑；数据主体权利；第 30 条记录 |
| PCI-DSS | 支付数据 | 接触支付的 AI 需要配置 + 合同 |
| EU AI Act | 服务欧盟用户 | 风险等级分类；高风险系统：合规性评估、文档、日志记录 |
| Colorado AI Act | 服务科罗拉多州居民 | 影响评估；申诉权 |
| ISO 42001 | AI 治理 | 新兴标准；与 ISO 27001 配套 |

### EU AI Act 时间表

- 2024 年 8 月 1 日：生效。
- 2025 年 2 月 2 日：禁止的 AI 行为开始执行。
- 2026 年 8 月 2 日：高风险系统开始执行（合规性评估、文档、日志记录）。
- 2027 年 8 月：协调立法下产品中的高风险系统。

风险等级：不可接受（禁止）、高风险（合规性 + 日志记录）、有限风险（透明度）、最小风险（无约束）。大多数 B2B LLM SaaS 属于有限风险；就业、信贷、教育、执法、移民、基本服务领域涉及高风险。

罚款（第 99 条）：违反高风险系统义务最高罚款 1500 万欧元或全球年营业额的 3%（第 99(4) 条）；禁止的 AI 行为最高罚款 3500 万欧元或 7%（第 99(3) 条）；以较高者为准。

### GDPR — 实时编辑是标准

事后清理（在 LLM 看到 PII 后再编辑）不是一种可辩护的立场 — 模型已经看到了数据。实时推理层编辑是 2026 年的标准：

- 在 LLM 调用前进行实体识别。
- 一致的 tokenization（分词）（Mesh 方法）保留语义。
- 仅存储编辑后的提示词 + 经同意的未编辑原始数据。

最近的执法案例：Clearview AI 被罚 3050 万欧元（荷兰数据保护局，2024 年 9 月）是有记录以来最大的 AI 专项 GDPR 罚款；OpenAI 被罚 1500 万欧元（意大利 Garante，2024 年 12 月）是最大的 LLM 专项罚款，尽管该罚款于 2026 年 3 月上诉成功被推翻，裁决仍在进一步审查中。事后清理的主张在审计中已失败。

### HIPAA — BAA 不是可选项

未经签署 Business Associate Agreement（商业伙伴协议），不得将 PHI 发送给外部 AI 服务。三大超大规模 LLM 平台（Bedrock、Azure OpenAI、Vertex）均提供 BAA。OpenAI 直连 API 提供 BAA。Anthropic 直连 API 提供 BAA。在发送 PHI 之前请确认。

### SOC 2 Type II

Type I：控制措施经过设计并记录。

Type II：控制措施在 6-12 个月内持续有效运行。

2026 年 B2B 采购默认要求 Type II。Type I 是入门级；Type II 是门槛。

常见审计驱动因素：访问日志（谁查看了什么）、变更管理（如何部署）、风险评估（季度）、事件响应（是否经过测试？）。阶段 17 · 25 的审计日志可直接复用。

### 跨框架映射

一项访问控制策略可以满足多个框架的控制要求：

| 控制 | 框架 |
|---------|-----------|
| 访问日志记录 | ISO 27001 A.5.15-5.18、GDPR 第 32 条、HIPAA §164.312(a) |
| 变更管理 | ISO 27001 A.8.32、PCI DSS 要求 6、HIPAA 违约通知范围 |
| 传输中加密 | ISO 27001 A.8.24、GDPR 第 32 条、HIPAA §164.312(e) |
| 密钥管理 | ISO 27001 A.8.19、PCI DSS 要求 8、SOC 2 CC6.1 |

合规工具（Drata、Vanta、Secureframe）可自动执行此映射。规模化后值得投入。

### ISO 42001 — 新兴标准

发布于 2023 年末。与 ISO 27001 一样，日益成为采购要求。AI 治理框架，包括风险管理、数据质量、透明度、人工监督。

### OpenAI 的参考案例

OpenAI 持有 SOC 2 Type 2、ISO/IEC 27001:2022、ISO/IEC 27701:2019、GDPR/CCPA/HIPAA (BAA)/FERPA、ChatGPT 支付组件的 PCI-DSS。这大致是 2026 年的企业必备条件。

### 需要记住的数字

- EU AI Act 罚款：最高 1500 万欧元/3%（高风险义务，第 99(4) 条）；最高 3500 万欧元/7%（禁止行为，第 99(3) 条）。
- EU AI Act 高风险执行日期：2026 年 8 月 2 日。
- 有记录以来最大的 AI 专项 GDPR 罚款：3050 万欧元，Clearview AI（荷兰数据保护局，2024 年 9 月）。
- 最大的 LLM 专项 GDPR 罚款：1500 万欧元，OpenAI（意大利 Garante，2024 年 12 月；2026 年 3 月上诉成功推翻）。
- SOC 2 Type II 窗口期：6-12 个月的运行控制措施。
- Colorado AI Act 生效日期：2026 年 6 月 30 日（经 SB25B-004 从 2026 年 2 月推迟）。

## 实践

`code/main.py` 是一个用 Python 实现的合规映射电子表格 — 给定一个控制项，列出它所满足的框架。

## 输出

本课生成 `outputs/skill-compliance-matrix.md`。根据客户群体和地理位置，指定所需的框架和控制措施。

## 练习

1. 您的第一个企业客户要求 SOC 2 Type II、HIPAA BAA、EU AI Act 声明。赢得交易所需的最低可行合规姿态是什么？
2. 根据 EU AI Act 风险等级对三个假设的 LLM 产品进行分类。高风险等级会带来什么变化？
3. 您意外地在未签署 BAA 的情况下向供应商发送了 PHI。请演练事件响应流程。
4. 讨论 ISO 42001 对于中等市场的 AI 供应商在 2026 年是否"必要"。
5. 将您的 LLM 审计日志字段（阶段 17 · 25）映射到至少三个框架控制项。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| SOC 2 Type II | "经审计的控制" | 控制措施在 6-12 个月内持续运行，经独立认证 |
| HIPAA BAA | "医疗合同" | Business Associate Agreement（商业伙伴协议）；PHI 所需 |
| GDPR | "欧盟隐私" | 实时 PII 编辑是 2026 年公认的标准 |
| EU AI Act | "欧盟 AI 规则" | 2026 年 8 月执行高风险条款；1500 万欧元/3%（高风险义务）— 3500 万欧元/7%（禁止行为） |
| Colorado AI Act | "美国 AI 州法" | 2026 年 6 月 30 日生效（经 SB25B-004 推迟）；影响评估 |
| ISO 42001 | "AI 治理" | AI 风险 + 透明度的新兴框架 |
| ISO 27001 | "安全 ISMS" | 信息安全管理系统基线 |
| Conformity assessment（合规性评估） | "欧盟 AI 文档包" | 高风险要求：文档、测试、日志记录 |
| Cross-framework mapping（跨框架映射） | "一个控制，多个框架" | 单一策略满足多个框架控制要求 |

## 延伸阅读

- [OpenAI Security and Privacy](https://openai.com/security-and-privacy/) — 合规参考案例。
- [GuardionAI — LLM Compliance 2026: ISO 42001, EU AI Act, SOC 2, GDPR](https://guardion.ai/blog/llm-compliance-guide-iso-42001-eu-ai-act-soc2-gdpr-2026)
- [Dsalta — SOC 2 Type 2 Audit Guide 2026: 10 AI Controls](https://www.dsalta.com/resources/ai-compliance/soc-2-type-2-audit-guide-2026-10-ai-powered-controls-every-saas-team-needs)
- [EU AI Act official text](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) — 原始来源。
- [Colorado AI Act](https://leg.colorado.gov/bills/sb24-205) — 原始来源。
- [ISO/IEC 42001:2023](https://www.iso.org/standard/81230.html) — AI 管理体系标准。
