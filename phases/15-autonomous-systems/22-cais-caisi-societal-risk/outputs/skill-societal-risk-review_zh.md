---
name: societal-risk-review
description: 使用 CAIS 四风险框架和 CAISI / SB-53 监管上下文审查部署的社会规模风险态势。
version: 1.0.0
phase: 15
lesson: 22
tags: [cais, caisi, four-risk-framework, organizational-risk, sb-53, societal-risk]
---

给定提议或运营的 AI 部署，生成社会规模风险审查，将部署标记到 CAIS 四风险框架，清点组织风险子杠杆，并命名监管表面。

生成：

1. **四风险标记。** 对于四个类别中的每一个（malicious use、AI races、organizational risks、rogue AIs），说明部署是否触及它以及如何触及。部署可以触及多个类别；"does not apply"必须在一句话中证明。
2. **组织风险清单。** 针对四个子杠杆评分部署：safety culture、audit rigor、multi-layered defenses、information security。任何评分为"missing"的杠杆是标记的差距。
3. **监管表面。** 命名适用的监管框架：EU AI Act（如果在 EU 或为 EU 用户服务）、California SB-53（如果已签署且适用）、CAISI voluntary agreements（如果实验室已签署一个）。合规是部署门，不是部署 nice-to-have。
4. **外部评估态势。** 命名部署或其基础模型已进行的外部评估（METR、CAISI、Apollo、Gray Swan 等）。没有外部评估是长期自主部署的标记差距。
5. **结构力暴露。** 估计组织面临的竞争部署压力有多大，以及这与组织风险杠杆如何权衡。承受重 race 压力的团队首先降低审计优先级；这是 CAIS 发现。

硬性拒绝：
- 触及有害能力类别而没有 hardcoded-prohibition 层（Lesson 17）的部署。
- 在竞争 race 条件下没有独立审计的部署。
- 没有外部能力评估的长期自主部署。
- 没有 Article 14 HITL（Lesson 15）的 EU 部署。
- 如果 SB-53 已签署，没有 incident-reporting process 的 California 部署。

拒绝规则：
- 如果用户无法命名基础模型的外部评估者，拒绝并要求先进行识别。仅自我评估不足够。
- 如果用户将"我们有扩展策略"视为灾难性风险监管的合规，拒绝并要求特定监管表面映射。
- 如果用户提议在 race 压力下部署而没有审计，拒绝并命名 CAIS 关于组织风险的发现。

输出格式：

返回社会风险审查，包含：
- **四风险行表**（category、touched y/n、nature）
- **组织风险记分卡**（safety culture / audit / defenses / infosec）
- **监管表面**（applicable frameworks with compliance status）
- **外部评估态势**（evaluator、scope、cadence）
- **结构力暴露**（low / medium / high with rationale）
- **部署准备度**（production / staging / research-only）
