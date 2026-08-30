---
name: tool-registry
description: 构建生产级工具目录和注册表，包含 JSON Schema 验证、并行调度和可观测性。
version: 1.0.0
phase: 14
lesson: 06
tags: [function-calling, tools, schema, validation, bfcl, parallel-tools]
---

给定任务域，生成代理可在 BFCL V4 轴（agentic、multi-turn、live、non-live、hallucination）上可靠使用的工具目录。

生成：

1. 工具定义。对于每个工具：`name`（snake_case）、`description`（告诉模型何时使用它以及何时不使用）、带有类型属性的 JSON Schema 输入、必填字段、适用时的枚举、数值的最小/最大值、每个工具的超时、每个工具的沙箱策略（fs surface、network、memory cap）。
2. 描述质量检查。对每个描述运行"这是否告诉模型何时选择此工具而不是其他工具？"如果两个工具有重叠的描述，拒绝并重写。
3. 并行调度计划。对于每个实际任务，识别哪些工具调用是独立的（可以并行化），哪些必须是顺序的。发出预期的调度图。
4. 验证策略。枚举检查、类型强制规则（例如"接受 int-as-string，拒绝 float-as-string"）、必填字段强制执行。每次失败都返回结构化观察字符串，永远不会引发到循环中。
5. 可观测性。每个工具发出一个 OpenTelemetry GenAI `tool_call` span，属性为 `gen_ai.tool.name`、`gen_ai.tool.call.id`、`gen_ai.tool.call.arguments`、`gen_ai.tool.call.result`（当内容策略要求时引用，而不是内联）。

硬性拒绝：

- 通用 shell/command-exec 工具。拒绝并分解为特定动词（`git_status`、`fs_read`、`npm_test`）。
- 参数具有封闭值集时缺少枚举。枚举验证是捕获漂移的最便宜方式。
- 两个不同工具的相同描述。模型无法可靠地在它们之间进行选择。
- 仅命名工具的 `description`（"添加两个数字"）。包含何时选择它而不是替代方案。
- 没有超时。每个工具调用必须有上限。

拒绝规则：

- 如果单个代理的工具列表超过 30 个，拒绝并建议子代理委托（Lesson 17）。
- 如果任何工具执行破坏性操作而没有确认门，拒绝并指向 Lesson 09（permissions、sandboxing）。
- 如果任务是计算机使用（click、type、screenshot），拒绝并指向 Lesson 21 —— 这是一种具有基于视觉操作的单独工具形状。

输出：可粘贴到 Anthropic / OpenAI / Gemini SDK 调用中的 JSON 工具目录、调度图、验证策略文档，以及注册表应通过的 BFCL 风格 mini-eval。

以"what to read next"指针结束：Lesson 09（sandboxing）、Lesson 23（OTel GenAI spans）或 Lesson 30（eval-driven）。
