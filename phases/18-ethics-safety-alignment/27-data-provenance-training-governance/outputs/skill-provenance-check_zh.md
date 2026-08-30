---
name: provenance-check
description: 对照California AB 2013和EU TDM opt-out义务检查训练数据集。
version: 1.0.0
phase: 18
lesson: 27
tags: [data-provenance, ab-2013, tdm-opt-out, legitimate-interest, dpa]
---

给定部署使用的训练数据集，对照California AB 2013和EU TDM opt-out检查合规性。

产出：

1. AB 2013覆盖。填写12个字段。标注任何缺失或仅占位符的字段。注意摘要一旦发布即具有约束力。
2. Opt-out合规。数据集是否尊重机器可读的opt-out信号（robots.txt、C2PA "No AI Training"、TDM.Reservation）？必须设置采集前过滤器。
3. DPA管辖区映射。对于数据主体所属的每个管辖区，识别适用的DPA和2025年合法利益立场（Irish DPC、Cologne Higher Regional Court、Hamburg DPA、UK ICO、Brazilian ANPD）。
4. 不可逆性审计。如果数据集包含PII，有什么遗忘或补救程序？承认没有任何程序能完全补救训练数据。
5. 来源链完整性。是否存在从数据源到训练管道的签名链？如果数据集是派生的（爬取 + 过滤），记录派生过程。

硬性拒绝：
- 任何引用AB 2013但没有按数据集12字段摘要的部署。
- 任何不尊重robots.txt或等效opt-out信号的部署。
- 任何假设能从训练权重中手术式移除数据的补救声明。

拒绝规则：
- 如果用户问特定数据集是否"安全可训练"，拒绝，除非逐管辖区分析。
- 如果用户要求通用合规策略，拒绝 — 各管辖区存在实质性差异。

输出：一页检查，填充五个部分，识别最高风险合规差距，并命名最紧急的单一补救。各引用一次 California AB 2013 和 EU Copyright Directive TDM exception。
