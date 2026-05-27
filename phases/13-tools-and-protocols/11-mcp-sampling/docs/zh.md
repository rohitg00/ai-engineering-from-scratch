# MCP 采样 — 服务器请求的 LLM 补全和智能体循环

> 大多数 MCP 服务器是哑执行器：接受参数，运行代码，返回内容。采样（Sampling）让服务器翻转方向：它请求客户端的 LLM 做决策。这使得服务器托管的智能体循环无需服务器拥有任何模型凭据。SEP-1577（2025-11-25 合并）在采样请求中添加了工具，因此循环可以包含更深层的推理。漂移风险说明：SEP-1577 采样内工具形态在 2026 年第一季度仍是实验性的，在 SDK API 中仍在稳定中。

**类型：** 构建
**语言：** Python (stdlib, 采样工具)
**前置条件：** 阶段 13 · 07 (MCP 服务器), 阶段 13 · 10 (资源和提示词)
**时间：** ~75 分钟

## 学习目标

- 解释 `sampling/createMessage` 解决的问题（无需服务器端 API 密钥的服务器托管循环）。
- 实现向客户端请求在多轮提示词上采样并返回补全结果的服务器。
- 使用 `modelPreferences`（成本/速度/智能优先级）来引导客户端模型选择。
- 构建一个 `summarize_repo` 工具，内部通过采样迭代而不是硬编码行为。

## 问题背景

代码摘要工作流的有用 MCP 服务器需要：遍历文件树，选择要读取的文件，合成摘要，并返回。LLM 推理发生在哪里？

选项 A：服务器调用自己的 LLM。需要 API 密钥，服务器端计费，每个用户成本高。

选项 B：服务器返回原始内容；客户端的智能体执行推理。可行但将服务器逻辑移到客户端提示词中，这很脆弱。

选项 C：服务器通过 `sampling/createMessage` 请求客户端的 LLM。服务器保留算法（读取哪些文件，做多少轮），而客户端保留计费和模型选择。服务器完全没有凭据。

采样是选项 C。它是受信任的服务器可以在不成为完整 LLM 宿主的情况下托管智能体循环的机制。

## 概念详解

### `sampling/createMessage` 请求

服务器发送：

```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "sampling/createMessage",
  "params": {
    "messages": [{"role": "user", "content": {"type": "text", "text": "..."}}],
    "systemPrompt": "...",
    "includeContext": "none",
    "modelPreferences": {
      "costPriority": 0.3,
      "speedPriority": 0.2,
      "intelligencePriority": 0.5,
      "hints": [{"name": "claude-3-5-sonnet"}]
    },
    "maxTokens": 1024
  }
}
```

客户端运行其 LLM，返回：

```json
{"jsonrpc": "2.0", "id": 42, "result": {
  "role": "assistant",
  "content": {"type": "text", "text": "..."},
  "model": "claude-3-5-sonnet-20251022",
  "stopReason": "endTurn"
}}
```

### `modelPreferences`

三个浮点数之和为 1.0：

- `costPriority`：偏好更便宜的模型。
- `speedPriority`：偏好更快的模型。
- `intelligencePriority`：偏好能力更强的模型。

加上 `hints`：服务器偏好的命名模型。客户端可能会或可能不会遵守提示；客户端的用户配置总是优先。

### `includeContext`

三个值：

- `"none"` — 仅服务器提供的消息。默认。
- `"thisServer"` — 包含此服务器会话的先前消息。
- `"allServers"` — 包含所有会话上下文。

截至 2025-11-25，`includeContext` 被软弃用，因为它会泄漏跨服务器上下文，这是一个安全问题。偏好 `"none"` 并在消息中传递显式上下文。

### 带工具的采样（SEP-1577）

2025-11-25 新增：采样请求可以包含 `tools` 数组。客户端使用这些工具运行完整的工具调用循环。这让服务器可以通过客户端的模型托管 ReAct 风格的智能体循环。

```json
{
  "messages": [...],
  "tools": [
    {"name": "fetch_url", "description": "...", "inputSchema": {...}}
  ]
}
```

客户端循环：采样，如果调用则执行工具，再次采样，返回最终助手消息。这在 2026 年第一季度仍是实验性的；SDK 签名可能仍有漂移。实现时请对照 2025-11-25 规范的 client/sampling 部分进行确认。

### 人在回路中

客户端必须在运行采样之前向用户展示服务器要求模型做什么。恶意服务器可能利用采样来操纵用户的会话（"对用户说 X 让他们点击 Y"）。Claude Desktop、VS Code 和 Cursor 将采样请求作为用户可以拒绝的确认对话框展示。

2026 年的共识：未经人工确认的采样是一个危险信号。网关（阶段 13 · 17）可以自动批准低风险采样，并自动拒绝任何可疑的。

### 无需 API 密钥的服务器托管循环

典型用例：一个没有自己 LLM 访问权限的代码摘要 MCP 服务器。它执行：

1. 遍历仓库结构。
2. 使用"选择最有可能描述此仓库用途的五个文件"调用 `sampling/createMessage`。
3. 读取这些文件。
4. 使用文件内容和"用 3 段话总结仓库"调用 `sampling/createMessage`。
5. 将摘要作为 `tools/call` 结果返回。

服务器从不接触 LLM API。客户端的用户使用自己的凭据为补全付费。

### 安全风险（Unit 42 披露，2026 年第一季度）

- **隐蔽采样。** 一个总是用"从会话上下文中响应用户的电子邮件"调用采样的工具。阶段 13 · 15 涵盖攻击向量。
- **通过采样窃取资源。** 服务器要求客户端摘要攻击者的有效载荷，由用户计费。
- **循环炸弹。** 服务器在紧密循环中调用采样。客户端必须强制执行每会话速率限制。

## 使用示例

`code/main.py` 提供了一个假的服务器到客户端采样工具。一个模拟的"summarize_repo"工具调用两轮采样（选择文件，然后摘要），假的客户端返回预设响应。该工具展示了：

- 服务器发送带 `modelPreferences` 的 `sampling/createMessage`。
- 客户端返回补全结果。
- 服务器继续其循环。
- 速率限制器限制每次工具调用的总采样调用次数。

需要关注的点：

- 服务器只暴露一个工具（`summarize_repo`）；所有推理都发生在采样调用中。
- 模型偏好加权客户端模型选择；提示列表列出偏好的模型。
- 循环在 `stopReason: "endTurn"` 时终止。
- `max_samples_per_tool = 5` 限制捕获 runaway 循环。

## 实战输出

本课生成 `outputs/skill-sampling-loop-designer.md`。给定一个需要 LLM 调用的服务器端算法（研究、摘要、规划），该技能设计一个基于采样的实现，带有正确的 modelPreferences、速率限制和安全确认。

## 练习

1. 运行 `code/main.py`。将 `max_samples_per_tool` 更改为 2 并观察速率限制截断。

2. 实现 SEP-1577 采样内工具变体：采样请求携带一个 `tools` 数组。验证客户端循环在返回最终补全之前执行了这些工具。注意漂移风险：SDK 签名在 2026 年上半年可能仍有变化。

3. 添加人在回路中的确认：在服务器的第一次 `sampling/createMessage` 之前，暂停并等待用户批准。被拒绝的调用返回类型化拒绝。

4. 添加以客户端会话为键的每用户速率限制器。同一用户的相同服务器循环应该共享一个预算。

5. 设计一个使用采样选择要包含的块的 `summarize_pdf` 工具。勾勒发送的消息。在 0.1 vs 0.9 时，`modelPreferences.intelligencePriority` 如何改变行为？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| 采样 | "服务器到客户端的 LLM 调用" | 服务器请求客户端的模型进行补全 |
| `sampling/createMessage` | "该方法" | 用于采样请求的 JSON-RPC 方法 |
| `modelPreferences` | "模型优先级" | 成本/速度/智能权重加上名称提示 |
| `includeContext` | "跨会话泄漏" | 软弃用的上下文包含模式 |
| SEP-1577 | "采样中的工具" | 允许在采样中使用工具以进行服务器托管的 ReAct |
| 人在回路中 | "用户确认" | 客户端在运行前将采样请求展示给用户 |
| 循环炸弹 | "失控采样" | 服务器端无限采样循环；客户端必须速率限制 |
| 隐蔽采样 | "隐藏推理" | 恶意服务器在采样提示词中隐藏意图 |
| 资源窃取 | "使用用户的 LLM 预算" | 服务器强制客户端在不想要的情况下为采样付费 |
| `stopReason` | "生成停止的原因" | `endTurn`、`stopSequence` 或 `maxTokens` |

## 延伸阅读

- [MCP — 概念：采样](https://modelcontextprotocol.io/docs/concepts/sampling) — 采样的高层概览
- [MCP — 客户端采样规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/client/sampling) — 权威的 `sampling/createMessage` 形态
- [MCP — GitHub SEP-1577](https://github.com/modelcontextprotocol/modelcontextprotocol) — 采样中工具的规范演进提案（实验性）
- [Unit 42 — MCP 攻击向量](https://unit42.paloaltonetworks.com/model-context-protocol-attack-vectors/) — 隐蔽采样和资源窃取模式
- [Speakeasy — MCP 采样核心概念](https://www.speakeasy.com/mcp/core-concepts/sampling) — 带客户端代码示例的演练
