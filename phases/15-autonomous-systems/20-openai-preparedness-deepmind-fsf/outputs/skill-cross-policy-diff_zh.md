---
name: cross-policy-diff
description: 使用 OpenAI Preparedness Framework v2、Anthropic RSP v3.0 和 DeepMind FSF v3 作为参考，为特定能力生成跨策略比较。
version: 1.0.0
phase: 15
lesson: 20
tags: [preparedness-framework, fsf, rsp, cross-policy, scaling-policy]
---

给定特定前沿能力（例如，"long-range autonomy"、"autonomous replication and adaptation"、"R&D automation"），生成跨策略差异，显示每个三个框架如何分类能力以及触发什么缓解措施。

生成：

1. **OpenAI PF v2 分类。** Tracked 或 Research。如果是 Tracked，命名 Capabilities + Safeguards Report 触发器。如果是 Research，注意策略语言是"potential"缓解措施。
2. **Anthropic RSP v3.0 分类。** 哪个阈值（ASL-3、AI R&D-4、hardcoded prohibition）？哪个缓解措施（affirmative case、security + deployment）？确认承诺是位于 Anthropic-unilateral 层还是 industry-recommendation 层。
3. **DeepMind FSF v3 分类。** 哪个领域（Cyber、Bio、ML R&D、CBRN）？哪个 CCL 或 Tracked Capability Level？是否调用 deceptive alignment monitoring？
4. **收敛摘要。** 三个策略是否在能力的严重性上达成一致，还是有 meaningful disagreement？哪个分类最严格，哪个最不严格？
5. **测量依赖性。** 每个分类都依赖于能力测量。命名如何测量能力以及哪个评估提供者（METR、Apollo、internal、third-party）拥有该测量。

硬性拒绝：
- 基于 announcement-language similarity 而没有 document-level evidence 的跨策略对齐声明。
- 任何无法指向源文档中特定条款的分类。
- 将"Research Category"（OpenAI）等同于"Tracked Category"——它们有不同的操作后果。

拒绝规则：
- 如果用户无法为每个分类生成源文档段落，拒绝并要求先进行引用。
- 如果用户将 policy-existence 视为 mitigation-in-practice 的证据，拒绝并要求特定缓解措施触发的证据。
- 如果能力声称被框架"覆盖"但该词未出现在文档中，拒绝并要求具体条款引用。

输出格式：

返回差异文档，包含：
- **能力定义**（一句话）
- **OpenAI PF v2 行**（classification、trigger、source clause）
- **Anthropic RSP v3.0 行**（classification、trigger、unilateral-vs-recommendation）
- **DeepMind FSF v3 行**（domain、CCL / TCL、deceptive-alignment involvement）
- **收敛摘要**（agreement + meaningful disagreement）
- **测量所有权**（eval provider、eval cadence）
- **读者建议**（most rigorous、least rigorous、justified）
