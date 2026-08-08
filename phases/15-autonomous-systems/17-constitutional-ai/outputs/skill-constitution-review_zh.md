---
name: constitution-review
description: 审计部署的宪法层 —— hardcoded prohibitions、soft-coded defaults、operator-adjustable bounds 和四级层次解析。
version: 1.0.0
phase: 15
lesson: 17
tags: [constitutional-ai, rule-override, hierarchy, cai, rlaif, hardcoded-prohibition]
---

给定部署的宪法层（system prompt、operator config、declared principles），针对 Claude Constitution 参考进行审计，并标记缺失的 hardcoded prohibitions、ambiguous principles 或 misordered tiers。

生成：

1. **Hardcoded prohibition 清单。** 列出无论 operator 或 user instruction 如何都不得弯曲的每个禁令。最低底线：bioweapons / CBRN uplift、CSAM、critical infrastructure attack planning、false-identity-when-asked。添加是部署特定的（例如，金融服务添加特定的欺诈禁令）。
2. **Soft-coded defaults。** 列出 operator 可以调整的每个行为。对于每个，说明声明的界限。没有界限的"可调整"设置是后门覆盖。
3. **层级排序。** 确认解析顺序为：safety > ethics > guidelines > helpfulness。如果 helpfulness 在实现的解析器中胜过 ethics，标记为部署中断。
4. **原则歧义标记。** 识别任何文本留下 materially different interpretations 空间的 principle。歧义在训练周期中复合（principle drift）。
5. **层完整性。** 确认运行时层控制（Lessons 10、13、14）除宪法层外存在。仅宪法不足够；仅运行时不足够。

硬性拒绝：
- 没有任何 hardcoded prohibition 层的部署。
- 声称覆盖 hardcoded prohibition 的 Operator config（即使通过重命名）。
- 将 helpfulness 置于 ethics 之上的层级顺序。
- 原则文本如此通用以至于无法评估（"be good"）。
- 将 Constitutional AI 视为运行时控制的替代品。

拒绝规则：
- 如果用户命名 hardcoded prohibition 但无法指向其运行时层后备，将部署标记为单层并拒绝生产。
- 如果 operator config 包含没有声明界限的可调整"safety"设置，拒绝。
- 如果用户将 2023 参与式宪法发现视为当前部署中可操作的，检查：2026 Constitution 未纳入它们，因此"继承民主"是部署无法支持的声明。

输出格式：

返回宪法审计，包含：
- **Hardcoded 底线**（prohibitions、enforcement layer：weights / inference / both）
- **Soft-coded defaults**（setting、operator bound、user-visible y/n）
- **层级顺序**（列出；确认 safety > ethics > guidelines > helpfulness）
- **歧义标记**（principle、specific ambiguity、proposed tightening）
- **层完整性**（constitutional y/n、runtime controls y/n、both required）
- **准备度**（production / staging / research-only）
