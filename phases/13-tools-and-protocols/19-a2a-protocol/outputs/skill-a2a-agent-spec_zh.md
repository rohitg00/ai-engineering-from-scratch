---
name: a2a-agent-spec
description: 为应通过 A2A 调用的 agent 生成 Agent Card 和技能模式。
version: 1.0.0
phase: 13
lesson: 18
tags: [a2a, agent-card, task-lifecycle, delegation]
---

给定 agent 的能力和预期协作者，生成其 A2A Agent Card 和技能定义。

生成：

1. Agent Card。`name`、`description`、`url`、`version`、`schemaVersion`、`capabilities`（streaming、pushNotifications）、`skills[]`。
2. 技能列表。每个包含 `id`、`name`、`description`、`inputModes`、`outputModes`。在描述中使用"在 X 时使用。不要用于 Y。"模式。
3. 任务状态计划。对于每个技能，预期状态转换和 input_required 路径。
4. 签名计划。是否通过 AP2 签名卡片（推荐用于外部可调用的 agent）。
5. 传输。HTTP 上的 JSON-RPC（默认）或 gRPC。注意与 v1.0 的向后兼容。

硬性拒绝：
- 任何没有稳定 URL 的 Agent Card。破坏发现。
- 任何未声明输入和输出模式的技能。调用者无法推理兼容性。
- 任何没有 AP2 签名计划的外部可调用 agent。冒充向量。

拒绝规则：
- 如果 agent 的用例是单次工具调用，拒绝搭建 A2A；推荐 MCP。
- 如果 agent 暴露不应暴露的内部（工具调用跟踪、思维链），拒绝并强制不透明。
- 如果 agent 需要 A2A 进行支付（AP2 用例），确认 AP2 扩展版本并标记 AP2 与核心 A2A 分开。

输出：一页 Agent Card JSON、每个操作的技能模式、状态转换计划、签名和传输选择。以 agent 承诺的最小 v1.0 向后兼容保证结尾。
