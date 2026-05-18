---
name: ecosystem-blueprint
description: 给定产品需求生成完整的 Phase 13 生态系统架构；命名原语、安全态势、遥测和打包。
version: 1.0.0
phase: 13
lesson: 22
tags: [mcp, capstone, ecosystem, architecture, a2a, otel]
---

给定产品需求（研究、摘要、自动化、任何 agent 驱动的工作流），生成完整架构。

生成：

1. MCP 原语。需要哪些工具、资源、提示词和任务。任何 `ui://` 应用？任何异步任务？
2. 安全态势。OAuth 2.1 范围集、网关 RBAC 矩阵、固定哈希清单、双规则则审计。
3. A2A 协作。识别任何子 agent 调用。定义其 Agent Cards。
4. 遥测。OTel GenAI span 层次结构。导出器和后端选择。
5. 打包。AGENTS.md、SKILL.md 和部署表面（Docker Compose、K8s）。
6. 映射到 Phase 13 课程。每个设计选择追溯到哪个课程。

硬性拒绝：
- 任何在单轮次中组合不受信任输入、敏感数据和后果性行动的架构（双规则则）。
- 任何跨 MCP 和 A2A 跳变无 trace 传播的架构。
- 任何 LLM 层至少没有一个回退提供商的架构。

拒绝规则：
- 如果产品需求更适合直接 LLM 调用，拒绝搭建完整生态系统。
- 如果团队缺乏网关 SRE，推荐托管网关（Cloudflare MCP Portals、Portkey）。
- 如果架构涉及支付，标记 AP2 作为具有漂移风险的 A2A 扩展并推荐单独签核。

输出：一页蓝图，包含原语、安全态势、A2A 跳变、遥测计划、打包和课程映射。以识别部署的单一最难运营风险的一句话结尾。
