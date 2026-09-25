# 合规 — SOC 2、HIPAA、GDPR、PCI-DSS、EU AI Act、ISO 42001

> 多框架覆盖是 2026 年企业级交易的基本门槛。**EU AI Act**：自 2024 年 8 月 1 日起生效。大多数高风险要求于 2026 年 8 月 2 日开始执行。针对高风险系统义务的罚款最高可达 1500 万欧元或全球年营业额的 3%（第 99(4) 条）；针对违禁 AI 实践的罚款最高可达 3500 万欧元或 7%（第 99(3) 条）。只要服务欧盟用户即全球适用。**Colorado AI Act**：于 2026 年 6 月 30 日生效（因 SB25B-004 从 2026 年 2 月推迟）——要求对高风险系统进行影响评估，并赋予对 AI 决策的申诉权。Virginia 在信贷/就业/住房/教育方面有类似规定。**SOC 2 Type II**：事实上的 B2B AI 要求（金融科技领域需要 Type II，而非 Type I）。**GDPR**：有记录的最大 AI 专项罚款是针对 Clearview AI 的 3050 万欧元（荷兰数据保护局，2024 年 9 月）；Italy 的 Garante 于 2024 年 12 月对 OpenAI 处以 1500 万欧元罚款（后于 2026 年 3 月在上诉中被推翻）。推理时的实时 PII 脱敏是可辩护的标准；事后处理清理是不够的。**HIPAA**：医疗行业受约束——没有 BAA 就不能将 PHI 发送给外部 AI 服务。**PCI-DSS**：AI 交互层覆盖需要配置 + 合同协议，并非自动覆盖。**ISO 42001**：新兴的 AI 治理标准，与 ISO 27001 一起成为日益常见的采购要求。参考基准：OpenAI 为 ChatGPT 支付组件维持 SOC 2 Type 2、ISO/IEC 27001:2022、ISO/IEC 27701:2019、GDPR/CCPA/HIPAA (BAA)/FERPA、PCI-DSS 合规。跨框架映射可减少审计疲劳：访问控制可映射到 ISO 27001 A.5.15-5.18、GDPR 第 32 条、HIPAA §164.312(a)。

**Type:** Learn
**Languages:**（Python 可选——合规是政策 + 流程，而非代码）
**Prerequisites:** Phase 17 · 25（安全），Phase 17 · 13（可观测性）
**Time:** 约 60 分钟

## 学习目标

- 列出与 LLM 产品相关的七个 2026 年框架，并将每个框架匹配到相应的客户群体。
- 引用 EU AI Act 的执行时间线（2024 年 8 月生效；高风险执行于 2026 年 8 月）和两档罚款上限（高风险义务为 1500 万欧元 / 3%，违禁实践为 3500 万欧元 / 7%）。
- 解释为什么事后处理 PII 清理对 GDPR 来说是不够的，并指出实时推理层脱敏是可辩护的标准。
- 描述跨框架控制映射（例如，访问控制映射到 ISO 27001 A.5.15-5.18 + GDPR 第 32 条 + HIPAA §164.312(a)）。

## 问题

一个企业客户的采购团队要求提供 SOC 2 Type II、GDPR、HIPAA BAA、ISO 27001 以及“EU AI Act 合规声明”。你的团队只有 SOC 2 Type I。距离 Type II 还有六个月，而 GDPR 第 30 条记录尚未开始。

多框架覆盖不是 LLM 问题——它是企业级 SaaS 问题，叠加了 LLM 特有的要求。2026 年的采购团队想要的是一张每个框架一行、每个控制一列的矩阵，而不是一份 PDF。

## 概念

### 七个框架

| 框架 | 范围 | LLM 特有要求 |
|-----------|-------|--------------------------|
| SOC 2 Type II | B2B SaaS 基线 | 经 6-12 个月审计的流程控制 |
| HIPAA | 美国医疗行业 | 需要 BAA；没有签署协议 PHI 不得离开基础设施 |
| GDPR | 欧盟用户 | 实时 PII 脱敏；数据主体权利；第 30 条记录 |
| PCI-DSS | 支付数据 | 涉及支付的 AI 需要配置 + 合同 |
| EU AI Act | 服务欧盟用户 | 风险分级；高风险系统：合格性评估、文档、日志 |
| Colorado AI Act | 服务 Colorado 居民 | 影响评估；申诉权 |
| ISO 42001 | AI 治理 | 新兴标准；与 ISO 27001 配套 |

### EU AI Act 时间线

- 2024 年 8 月 1 日：生效。
- 2025 年 2 月 2 日：违禁 AI 实践开始执行。
- 2026 年 8 月 2 日：高风险系统开始执行（合格性评估、文档、日志）。
- 2027 年 8 月：协调立法下产品中的高风险系统。

风险分级：不可接受（禁止）、高风险（合格性评估 + 日志）、有限风险（透明度）、最小风险（无约束）。大多数 B2B LLM SaaS 属于有限风险；高风险适用于就业、信贷、教育、执法、移民、基本服务。

罚款（第 99 条）：违反高风险系统义务最高可达 1500 万欧元或全球年营业额的 3%（第 99(4) 条）；违禁 AI 实践最高可达 3500 万欧元或 7%（第 99(3) 条）；以较高者为准。

### GDPR — 实时脱敏是标准

事后处理清理（在 LLM 看到数据之后再脱敏 PII）不是可辩护的姿态——模型已经看到了数据。实时推理层脱敏是 2026 年的标准：

- 在 LLM 调用之前进行实体识别。
- 一致的 tokenization（Mesh 方法）保留语义。
- 仅存储脱敏后的提示词 + 经同意加入的原始数据。

近期执法：针对 Clearview AI 的 3050 万欧元罚款（荷兰数据保护局，2024 年 9 月）是迄今为止有记录的最大 AI 专项 GDPR 罚款；针对 OpenAI 的 1500 万欧元罚款（Italy 的 Garante，2024 年 12 月）是最大的 LLM 专项罚款，尽管该裁决于 2026 年 3 月在上诉中被推翻，目前仍在进一步审查中。事后处理的说法在审计中已被判定不合格。

### HIPAA — BAA 不是可选的

没有签署的商业伙伴协议（BAA），你不能将 PHI 发送给外部 AI 服务。三家超大规模 LLM 平台（Bedrock、Azure OpenAI、Vertex）都提供 BAA。OpenAI 直接 API 提供 BAA。Anthropic 直接 API 提供 BAA。发送 PHI 之前请先确认。

### SOC 2 Type II

Type I：控制已设计和记录。
Type II：控制在 6-12 个月内有效运行。

2026 年的 B2B 采购默认要求 Type II。Type I 是入门；Type II 是门槛。

常见的审计驱动因素：访问日志（谁看了什么）、变更管理（如何部署）、风险评估（每季度）、事件响应（是否经过演练？）。Phase 17 · 25 的审计日志可直接复用。

### 跨框架映射

一条访问控制策略可满足多个框架的控制要求：

| 控制 | 框架 |
|---------|-----------|
| 访问日志 | ISO 27001 A.5.15-5.18、GDPR 第 32 条、HIPAA §164.312(a) |
| 变更管理 | ISO 27001 A.8.32、PCI DSS Req. 6、HIPAA 违规通知范围 |
| 传输加密 | ISO 27001 A.8.24、GDPR 第 32 条、HIPAA §164.312(e) |
| 密钥管理 | ISO 27001 A.8.19、PCI DSS Req. 8、SOC 2 CC6.1 |

合规工具（Drata、Vanta、Secureframe）可自动完成此映射。规模化时值得投入。

### ISO 42001 — 新兴标准

2023 年底发布。与 ISO 27001 一起成为日益增长的采购要求。AI 治理框架，包括风险管理、数据质量、透明度、人类监督。

### OpenAI 的参考基准

OpenAI 为 ChatGPT 支付组件维持 SOC 2 Type 2、ISO/IEC 27001:2022、ISO/IEC 27701:2019、GDPR/CCPA/HIPAA (BAA)/FERPA、PCI-DSS 合规。这大致就是 2026 年企业级交易的基本门槛。

### 你应该记住的数字

- EU AI Act 罚款：最高 1500 万欧元 / 3%（高风险义务，第 99(4) 条）；最高 3500 万欧元 / 7%（违禁实践，第 99(3) 条）。
- EU AI Act 高风险执行：2026 年 8 月 2 日。
- 有记录的最大 AI 专项 GDPR 罚款：3050 万欧元，Clearview AI（荷兰数据保护局，2024 年 9 月）。
- 最大的 LLM 专项 GDPR 罚款：1500 万欧元，OpenAI（Italy 的 Garante，2024 年 12 月；2026 年 3 月上诉中被推翻）。
- SOC 2 Type II 周期：控制运行 6-12 个月。
- Colorado AI Act 生效日期：2026 年 6 月 30 日（因 SB25B-004 从 2026 年 2 月推迟）。

```figure
i4-control-matrix
```

## 应用

`code/main.py` 是一个用 Python 编写的合规映射电子表格——给定一个控制，列出它所满足的框架。

## 交付

本课产出 `outputs/skill-compliance-matrix.md`。给定客户群体和地域，指定所需的框架和控制。

## 练习

1. 你的第一个企业客户要求 SOC 2 Type II、HIPAA BAA、EU AI Act 声明。赢得这笔交易的最低可行合规姿态是什么？
2. 将三个假想的 LLM 产品按 EU AI Act 风险分级进行分类。在高风险级别会发生什么变化？
3. 你意外地在没有 BAA 的情况下将 PHI 发送给了某提供商。请完整走一遍事件响应流程。
4. 论证对于一家中端市场 AI 供应商，ISO 42001 在 2026 年是否“必要”。
5. 将你的 LLM 审计日志字段（Phase 17 · 25）映射到至少三个框架控制。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| SOC 2 Type II | “经审计的控制” | 控制运行 6-12 个月，由独立机构证明 |
| HIPAA BAA | “医疗合同” | 商业伙伴协议；处理 PHI 必需 |
| GDPR | “欧盟隐私” | 实时 PII 脱敏是 2026 年可辩护的标准 |
| EU AI Act | “欧盟 AI 法规” | 高风险执行于 2026 年 8 月；1500 万欧元 / 3%（高风险义务）— 3500 万欧元 / 7%（违禁实践） |
| Colorado AI Act | “美国州级 AI 法” | 2026 年 6 月 30 日生效（因 SB25B-004 推迟）；影响评估 |
| ISO 42001 | “AI 治理” | 新兴的 AI 风险 + 透明度框架 |
| ISO 27001 | “安全 ISMS” | 信息安全管理体系基线 |
| 合格性评估 | “欧盟 AI 文档包” | 高风险要求：文档、测试、日志 |
| 跨框架映射 | “一个控制，多个框架” | 单一策略满足多个框架的控制 |

## 延伸阅读

- [OpenAI Security and Privacy](https://openai.com/security-and-privacy/) — 参考合规基准。
- [GuardionAI — LLM Compliance 2026: ISO 42001, EU AI Act, SOC 2, GDPR](https://guardion.ai/blog/llm-compliance-guide-iso-42001-eu-ai-act-soc2-gdpr-2026)
- [Dsalta — SOC 2 Type 2 Audit Guide 2026: 10 AI Controls](https://www.dsalta.com/resources/ai-compliance/soc-2-type-2-audit-guide-2026-10-ai-powered-controls-every-saas-team-needs)
- [EU AI Act 官方文本](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) — 一手资料。
- [Colorado AI Act](https://leg.colorado.gov/bills/sb24-205) — 一手资料。
- [ISO/IEC 42001:2023](https://www.iso.org/standard/81230.html) — AI 管理体系标准。