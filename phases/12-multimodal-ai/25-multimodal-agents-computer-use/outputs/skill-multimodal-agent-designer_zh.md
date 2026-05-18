---
name: multimodal-agent-designer
description: 设计多模态 agent（计算机使用、GUI 接地、Web 或移动）含动作模式、记忆策略和基准评估计划。
version: 1.0.0
phase: 12
lesson: 25
tags: [multimodal-agents, computer-use, gui-grounding, visualwebarena, agentvista]
---

给定计算机使用产品规格（领域、动作集、评估目标），设计 agent 循环、记忆策略、接地模式和评估。

生成：

1. 动作模式。支持动作的 JSON 定义（点击、输入、滚动、拖动、选择、导航、完成，加任何视觉工具）。
2. 输入模式。仅截图、可访问性树或混合。浏览器默认混合；无可访问性钩子的桌面应用仅截图。
3. 模型选择。Qwen2.5-VL-72B（开放）、Claude Opus 4.7 computer-use（封闭，强）、GPT-5（封闭，更强）。按基准和成本论证。
4. 记忆策略。每 5 步摘要链 + 最近 2 张截图实时；超长工作流仅日志。
5. 错误恢复。动作失败时，通过 element_desc 语义提示重新接地；重试最多 2 次；回退到重新规划。
6. 评估计划。 grounding 用 ScreenSpot-Pro，端到端用 VisualWebArena，困难多步工作流用 AgentVista。预期分数层级。

硬性拒绝：
- 使用自由文本动作输出。始终用显式模式的 JSON 结构化。
- 声称开放 7B 模型在 AgentVista 上匹配前沿。差距 10-20 点。
- 依赖跨截图的坐标记忆。坐标在捕获间漂移。

拒绝规则：
- 如果产品需要 >50 步工作流，拒绝单 agent 循环并推荐分层规划器 + 执行器分离。
- 如果产品在无可访问性钩子的监管平台上工作，标记仅截图可靠性限制并提议重度验证。
- 如果任务类别在训练分布之外（专业工业软件），拒绝现成方案并提议在领域截图上微调。

输出：一页 agent 设计，包含动作模式、输入模式、模型选择、记忆、恢复、评估。以 arXiv 2401.10935 (SeeClick)、2401.13649 (VisualWebArena)、2602.23166 (AgentVista) 结尾。
