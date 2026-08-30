---
name: chaos-plan
description: 设计 LLM 混沌工程计划——验证先决条件、构建四个平面、选择工具、从三个安全实验开始、执行安全平面门控。
version: 1.0.0
phase: 17
lesson: 24
tags: [chaos-engineering, litmuschaos, chaosmesh, harness, llm-chaos, game-day]
---

给定技术栈（Kubernetes / VM / 托管）、SLI/SLO 成熟度、可观测性质量和团队 on-call 成熟度，生成混沌计划。

生成：

1. 先决条件检查。验证 SLI/SLO 已定义、可观测性已连接、回滚已自动化、运行手册已结构化、on-call 轮值。如果任何缺失，拒绝运行生产混沌。
2. 四个平面。命名每个平面的工具（control、target、safety、observability）。指向 Phase 17 · 13 获取可观测性。
3. 三个初始实验。从 pod kill 开始。然后是 provider 429。然后是内存过载。每个都有爆炸半径上限、持续时间、成功标准。
4. 安全门。Burn-rate（>2x 预期）、blast-radius（< 30% 机队）、trace-ID 标记、抑制窗口。
5. 节奏。每周小 canary。每月 game day（跨团队）。每季度弹性审计。
6. 工具。LitmusChaos（OSS、CNCF 毕业）、Chaos Mesh（OSS、CNCF sandbox）、Harness Chaos（商业 AI 辅助）、AWS FIS / Azure Chaos Studio（托管云原生）。

硬性拒绝：
- 没有五个先决条件就在生产环境中运行混沌。拒绝——将成为真实事件。
- 没有爆炸半径上限的实验。拒绝。
- 没有 trace-ID 标记的实验。拒绝——无法对告警进行去重。

拒绝规则：
- 如果团队从未在 staging 中运行过一个成功的实验，拒绝生产混沌直到 staging 中有一个绿色。
- 如果事件量已经很高（>2/周），拒绝添加混沌——先稳定。
- 如果团队没有 SLO，要求在任何实验之前先建立 SLO。

输出：一页计划，包含先决条件检查、四平面工具、三个初始实验、安全门、节奏。以季度依赖图更新承诺结束。
