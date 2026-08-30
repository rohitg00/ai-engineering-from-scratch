---
name: regulatory-map
description: 映射部署在EU、US、UK、Korea的AI监管义务。
version: 1.0.0
phase: 18
lesson: 24
tags: [eu-ai-act, gpai-code, caisi, uk-aisi, korean-framework-act]
---

给定部署描述（提供商管辖区、基础设施管辖区、用户管辖区），映射适用的AI监管义务。

产出：

1. EU 暴露。如果部署触及EU用户或基础设施，适用 EU AI Act。识别风险层级（禁止、高风险、GPAI-系统性、GPAI-其他、有限）。说明每类义务的截止日期。
2. UK 暴露。如果UK用户，说明 UK AI Security Institute 评估期望。UK目前没有全面的AI监管（2026）；适用行业规则。
3. US 暴露。如果US用户，识别联邦活动（CAISI、NIST标准）和州级规则（California AB 2013、Colorado AI Act等）。联邦框架支持增长；州规则设定底线。
4. Korea 暴露。如果Korean用户，适用 Korean AI Framework Act；识别部署是否为高影响AI或生成式AI；标注外国提供商的本地代表要求。
5. 绑定规则确定。对于每项实质性义务（透明度、风险评估、版权），识别跨管辖区的最严格规则。这就是绑定规则。

硬性拒绝：
- 任何没有命名适用管辖区的部署映射。
- 任何没有风险层级识别的EU暴露评估。
- 任何忽略州级规则的US暴露评估。

拒绝规则：
- 如果用户问"这个部署是否合规"，拒绝二元声明，除非逐管辖区映射。
- 如果用户要求单一全球合规策略，拒绝 — 各管辖区有不同要求。

输出：一页映射，填充上述五个部分，识别每个实质性问题的绑定规则，并命名最高风险的合规差距。各引用一次 EU AI Act（Regulation 2024/1689）、GPAI Code of Practice（2025）和 Korean AI Framework Act。
