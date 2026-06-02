# 合规 — SOC 2、HIPAA、GDPR、PCI-DSS、欧盟 AI 法案、ISO 42001

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 多框架覆盖是 2026 年企业级订单的入场券。**欧盟 AI 法案（EU AI Act）**：自 2024 年 8 月 1 日起生效。大部分高风险条款将于 2026 年 8 月 2 日开始执行。高风险系统义务违规罚款最高 €1500 万或全球年营收的 3%（第 99(4) 条）；禁止类 AI 实践罚款最高 €3500 万或 7%（第 99(3) 条）。只要服务对象包含欧盟用户，全球适用。**科罗拉多 AI 法案（Colorado AI Act）**：2026 年 6 月 30 日生效（被 SB25B-004 从原定的 2026 年 2 月延后）——要求高风险系统做影响评估，赋予用户对 AI 决策的申诉权。弗吉尼亚州在信贷 / 雇佣 / 住房 / 教育领域有类似规定。**SOC 2 Type II**：B2B AI 事实上的硬门槛（金融科技场景必须 Type II，不是 Type I）。**GDPR**：目前已记录的最高 AI 专项罚单是针对 Clearview AI 的 €3050 万（荷兰 DPA，2024 年 9 月）；意大利 Garante 在 2024 年 12 月对 OpenAI 开出 €1500 万罚单（2026 年 3 月二审被撤销）。在 inference（推理）阶段实时做 PII 脱敏才是站得住脚的做法；事后清洗不够。**HIPAA**：医疗领域的硬约束——没签 BAA 就不能把 PHI 发给外部 AI 服务。**PCI-DSS**：AI 交互层的覆盖需要靠配置 + 合同协议，不是自动具备。**ISO 42001**：新兴的 AI 治理标准，正与 ISO 27001 一道成为越来越常见的采购要求。参考画像：OpenAI 维护着 SOC 2 Type 2、ISO/IEC 27001:2022、ISO/IEC 27701:2019、GDPR/CCPA/HIPAA（BAA）/FERPA，以及 ChatGPT 支付模块的 PCI-DSS。跨框架控制点映射可以减轻审计疲劳：访问控制能同时对应到 ISO 27001 A.5.15-5.18、GDPR 第 32 条、HIPAA §164.312(a)。

**Type:** Learn
**Languages:** （Python 可选——合规是策略 + 流程，不是代码）
**Prerequisites:** Phase 17 · 25（安全）、Phase 17 · 13（可观测性）
**Time:** 约 60 分钟

## 学习目标（Learning Objectives）

- 列出与 LLM 产品相关的 7 个 2026 年合规框架，并把每个框架对应到目标客户群。
- 引用欧盟 AI 法案的执行时间线（2024 年 8 月生效；高风险条款 2026 年 8 月执行），以及两档罚款上限（高风险义务 €1500 万 / 3%；禁止类实践 €3500 万 / 7%）。
- 解释为什么事后做 PII 清洗对 GDPR 不够，并指出实时 inference 层脱敏才是站得住脚的标准。
- 描述跨框架的控制点映射（例如，访问控制同时映射到 ISO 27001 A.5.15-5.18 + GDPR 第 32 条 + HIPAA §164.312(a)）。

## 问题（Problem）

某个企业客户的采购部门要求 SOC 2 Type II、GDPR、HIPAA BAA、ISO 27001，再加一份「欧盟 AI 法案合规声明」。你团队手上只有 SOC 2 Type I。距离 Type II 还有 6 个月，GDPR 第 30 条记录还没开始建。

多框架覆盖不是 LLM 的问题，而是企业级 SaaS 的问题，叠加了 LLM 特有的细节。2026 年的采购团队想要的是一张矩阵——每行一个框架、每列一个控制点，而不是一份 PDF。

## 概念（Concept）

### 7 个框架（The seven frameworks）

| 框架 | 适用范围 | LLM 特有要求 |
|-----------|-------|--------------------------|
| SOC 2 Type II | B2B SaaS 基线 | 流程控制需经 6-12 个月审计 |
| HIPAA | 美国医疗 | 必须签 BAA；未签协议前 PHI 不得离开基础设施 |
| GDPR | 欧盟用户 | 实时 PII 脱敏；数据主体权利；第 30 条记录 |
| PCI-DSS | 支付数据 | AI 涉及支付时需要配置 + 合同 |
| 欧盟 AI 法案 | 服务欧盟用户 | 风险等级分类；高风险系统：合规评估、文档、日志 |
| 科罗拉多 AI 法案 | 服务科罗拉多居民 | 影响评估；申诉权 |
| ISO 42001 | AI 治理 | 新兴标准；与 ISO 27001 配套 |

### 欧盟 AI 法案时间线（EU AI Act timeline）

- 2024 年 8 月 1 日：生效。
- 2025 年 2 月 2 日：禁止类 AI 实践开始执行。
- 2026 年 8 月 2 日：高风险系统开始执行（合规评估、文档、日志）。
- 2027 年 8 月：受统一立法管辖的产品中的高风险系统执行。

风险等级：不可接受（禁用）、高风险（合规 + 日志）、有限风险（透明度）、最小风险（无约束）。大多数 B2B LLM SaaS 属于有限风险；只有进入雇佣、信贷、教育、执法、移民、基础公共服务等领域时，才会被划入高风险。

罚款（第 99 条）：违反高风险系统义务最高 €1500 万或全球年营收 3%（第 99(4) 条）；禁止类 AI 实践最高 €3500 万或 7%（第 99(3) 条）；以较高者为准。

### GDPR——实时脱敏才是标准（GDPR — real-time redaction is the standard）

事后清洗（在 LLM 看到数据之后再去脱敏 PII）站不住脚——模型已经看到原始数据。2026 年的标准是在 inference 层做实时脱敏：

- 在调用 LLM 之前做实体识别。
- 一致化 tokenization（Mesh 思路）保留语义。
- 只存脱敏后的 prompt + 用户明示同意（opt-in）的原始数据。

最近的执法案例：针对 Clearview AI 的 €3050 万（荷兰 DPA，2024 年 9 月）是迄今记录在案的最大 AI 专项 GDPR 罚单；针对 OpenAI 的 €1500 万（意大利 Garante，2024 年 12 月）是最大的 LLM 专项罚单，但已于 2026 年 3 月二审被撤销，目前仍在进一步审议。事后清洗的说辞在审计中无法过关。

### HIPAA——BAA 不是可选项（HIPAA — BAA is not optional）

没有签订 Business Associate Agreement 之前，PHI 不能发给外部 AI 服务。三大超大规模云的 LLM 平台（Bedrock、Azure OpenAI、Vertex）都提供 BAA。OpenAI 直连 API 提供 BAA。Anthropic 直连 API 提供 BAA。发送 PHI 之前先确认。

### SOC 2 Type II

Type I：控制已设计并文档化。
Type II：控制在 6-12 个月内有效运转。

2026 年 B2B 采购默认要 Type II。Type I 只是入门；Type II 才是闸口。

常见的审计要点：访问日志（谁看了什么）、变更管理（怎么部署的）、风险评估（每季度）、事件响应（演练过吗？）。Phase 17 · 25 里的审计日志可以直接复用。

### 跨框架映射（Cross-framework mapping）

一份访问控制策略可以同时满足多个框架的控制点：

| 控制点 | 涉及框架 |
|---------|-----------|
| 访问日志 | ISO 27001 A.5.15-5.18、GDPR 第 32 条、HIPAA §164.312(a) |
| 变更管理 | ISO 27001 A.8.32、PCI DSS Req. 6、HIPAA 违规通知范围 |
| 传输加密 | ISO 27001 A.8.24、GDPR 第 32 条、HIPAA §164.312(e) |
| Secrets 管理 | ISO 27001 A.8.19、PCI DSS Req. 8、SOC 2 CC6.1 |

合规工具（Drata、Vanta、Secureframe）能把这种映射自动化。规模上来后值这个钱。

### ISO 42001——新兴标准（ISO 42001 — emerging）

2023 年底发布。正在与 ISO 27001 一起成为越来越常见的采购要求。它是一套 AI 治理框架，涵盖风险管理、数据质量、透明度、人工监督。

### OpenAI 的参考画像（OpenAI's reference profile）

OpenAI 维护着 SOC 2 Type 2、ISO/IEC 27001:2022、ISO/IEC 27701:2019、GDPR/CCPA/HIPAA（BAA）/FERPA，以及 ChatGPT 支付模块的 PCI-DSS。这大致就是 2026 年企业级的入场券。

### 该记住的几个数字（Numbers you should remember）

- 欧盟 AI 法案罚款：高风险义务最高 €1500 万 / 3%（第 99(4) 条）；禁止类实践最高 €3500 万 / 7%（第 99(3) 条）。
- 欧盟 AI 法案高风险条款执行：2026 年 8 月 2 日。
- 已记录的最大 AI 专项 GDPR 罚单：€3050 万，Clearview AI（荷兰 DPA，2024 年 9 月）。
- 最大的 LLM 专项 GDPR 罚单：€1500 万，OpenAI（意大利 Garante，2024 年 12 月；2026 年 3 月二审被撤销）。
- SOC 2 Type II 时间窗：控制有效运转 6-12 个月。
- 科罗拉多 AI 法案生效日期：2026 年 6 月 30 日（被 SB25B-004 从 2026 年 2 月延后）。

## 用起来（Use It）

`code/main.py` 是一份用 Python 写的合规映射表——给定一个控制点，列出它能满足的框架。

## 上线部署（Ship It）

本课的产物是 `outputs/skill-compliance-matrix.md`。给定客户群体和地理范围，输出对应的必备框架和控制点。

## 练习（Exercises）

1. 你的第一个企业客户要求 SOC 2 Type II、HIPAA BAA、欧盟 AI 法案声明。要拿下这单的最小可行合规姿态是什么？
2. 用欧盟 AI 法案的风险等级给 3 个假设的 LLM 产品分类。进入高风险后会改变什么？
3. 你不小心把 PHI 发给了一个还没签 BAA 的供应商。把事件响应流程走一遍。
4. 论证一下：对中端 AI 厂商而言，ISO 42001 在 2026 年是否「必要」。
5. 把你 LLM 审计日志的字段（Phase 17 · 25）映射到至少 3 个框架的控制点上。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际含义 |
|------|----------------|------------------------|
| SOC 2 Type II | 「审计过的控制」 | 控制点在 6-12 个月内运转，并经过独立鉴证 |
| HIPAA BAA | 「医疗合同」 | Business Associate Agreement；处理 PHI 必备 |
| GDPR | 「欧盟隐私」 | 2026 年站得住脚的标准是实时 PII 脱敏 |
| 欧盟 AI 法案 | 「欧盟 AI 规则」 | 高风险条款 2026 年 8 月执行；€1500 万 / 3%（高风险义务）——€3500 万 / 7%（禁止类实践） |
| 科罗拉多 AI 法案 | 「美国 AI 州法」 | 2026 年 6 月 30 日生效（被 SB25B-004 延后）；要求影响评估 |
| ISO 42001 | 「AI 治理」 | 处理 AI 风险 + 透明度的新兴框架 |
| ISO 27001 | 「安全 ISMS」 | 信息安全管理体系（Information Security Management System）基线 |
| Conformity assessment | 「欧盟 AI 文档包」 | 高风险条款要求：文档、测试、日志 |
| 跨框架映射 | 「一个控制点对应多个框架」 | 单一策略满足多个框架的控制点 |

## 延伸阅读（Further Reading）

- [OpenAI Security and Privacy](https://openai.com/security-and-privacy/) — 参考合规画像。
- [GuardionAI — LLM Compliance 2026: ISO 42001, EU AI Act, SOC 2, GDPR](https://guardion.ai/blog/llm-compliance-guide-iso-42001-eu-ai-act-soc2-gdpr-2026)
- [Dsalta — SOC 2 Type 2 Audit Guide 2026: 10 AI Controls](https://www.dsalta.com/resources/ai-compliance/soc-2-type-2-audit-guide-2026-10-ai-powered-controls-every-saas-team-needs)
- [EU AI Act official text](https://eur-lex.europa.eu/eli/reg/2024/1689/oj) — 一手原文。
- [Colorado AI Act](https://leg.colorado.gov/bills/sb24-205) — 一手原文。
- [ISO/IEC 42001:2023](https://www.iso.org/standard/81230.html) — AI 管理体系标准。
