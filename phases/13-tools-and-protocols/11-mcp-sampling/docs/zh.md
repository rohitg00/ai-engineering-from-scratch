# MCP 采样——服务器请求的 LLM 补全与代理循环

> 大多数 MCP 服务器是哑执行器：接受参数、运行代码、返回内容。采样让服务器翻转方向：它请求客户端的 LLM 做出决策。这使得服务器可以托管代理循环，而无需服务器拥有任何模型凭证。SEP-1577 于 2025-11-25 合并，在采样请求中添加了工具，因此循环可以包含更深入的推理。漂移风险说明：SEP-1577 的采样内工具形状在 2026 年第一季度之前是实验性的，并且仍在 SDK API 中稳定。

**类型：** Build
**语言：** Python（stdlib，采样框架）
**前置知识：** Phase 13 · 07（MCP 服务器），Phase 13 · 10（资源与提示）
**时间：** ~75 分钟

## 学习目标

- 解释 `sampling/createMessage` 解决的问题（无需服务器端 API 密钥的服务器托管循环）。
- 实现一个服务器，请求客户端对多轮提示进行采样并返回补全。
- 使用 `modelPreferences`（成本 / 速度 / 智能优先级）来指导客户端模型选择。
- 构建一个 `summarize_repo` 工具，通过采样内部迭代，而非硬编码行为。

## 问题所在

一个用于代码摘要工作流的有用 MCP 服务器需要：遍历文件树、选择要读取的文件、合成摘要并返回。LLM 推理发生在哪里？

选项 A：服务器调用自己的 LLM。需要 API 密钥，服务器端计费，每个用户都很昂贵。

选项 B：服务器返回原始内容；客户端的代理进行推理。有效，但将服务器逻辑移入客户端提示，这很脆弱。

选项 C：服务器通过 `sampling/createMessage` 请求客户端的 LLM。服务器保留算法（读取哪些文件、做多少遍），而客户端保留计费和模型选择。服务器根本没有凭证。

采样是选项 C。它是一种机制，通过它受信任的服务器可以托管代理循环，而无需本身成为完整的 LLM 宿主。

## 核心概念

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

三个浮点数，总和为 1.0：

- `costPriority`：偏向更便宜的模型。
- `speedPriority`：偏向更快的模型。
- `intelligencePriority`：偏向更有能力的模型。

加上 `hints`：服务器偏好的命名模型。客户端可以遵守也可以不遵守提示；客户端的用户配置始终优先。

### `includeContext`

三个值：

- `"none"` — 仅服务器提供的消息。默认值。
- `"thisServer"` — 包含来自此服务器会话的先前消息。
- `"allServers"` — 包含所有会话上下文。

`includeContext` 自 2025-11-25 起软弃用，因为它泄漏跨服务器上下文，这是一个安全问题。优先使用 `"none"` 并在消息中传递显式上下文。

### 带工具的采样（SEP-1577）

2025-11-25 新增：采样请求可以包含 `tools` 数组。客户端使用这些工具运行完整的工具调用循环。这让服务器可以通过客户端的模型托管 ReAct 风格的代理循环。

```json
{
  "messages": [...],
  "tools": [
    {"name": "fetch_url", "description": "...", "inputSchema": {...}}
  ]
}
```

客户端循环：采样，如果调用则执行工具，再次采样，返回最终助手消息。这在 2026 年第一季度之前是实验性的；SDK 签名可能仍会漂移。实现时请对照 2025-11-25 规范的 client/sampling 部分确认。

### 人工介入

客户端必须在运行采样之前向用户展示服务器要求模型做什么。恶意服务器可以使用采样来操纵用户的会话（"对用户说 X，让他们点击 Y"）。Claude Desktop、VS Code 和 Cursor 将采样请求作为用户可以拒绝的确认对话框呈现。

2026 年共识：未经人工确认的采样是危险信号。网关（Phase 13 · 17）可以自动批准低风险采样并自动拒绝任何可疑内容。

### 无需 API 密钥的服务器托管循环

典型用例：一个本身没有 LLM 访问权限的代码摘要 MCP 服务器。它执行：

1. 遍历仓库结构。
2. 调用 `sampling/createMessage`，提示"选择最可能描述此仓库用途的五个文件"。
3. 读取这些文件。
4. 调用 `sampling/createMessage`，传入文件内容并提示"用 3 段话概括仓库"。
5. 将摘要作为 `tools/call` 结果返回。

服务器从不接触 LLM API。客户端的用户使用自己的凭证为补全付费。

### 安全风险（Unit 42 披露，2026 年第一季度）

- **隐蔽采样。** 一个工具总是调用采样，提示"从会话上下文中回复用户的电子邮件"。Phase 13 · 15 涵盖攻击向量。
- **通过采样窃取资源。** 服务器请求客户端摘要攻击者的负载，向用户计费。
- **循环炸弹。** 服务器在紧密循环中调用采样。客户端必须强制执行每个会话的速率限制。

## 使用它

`code/main.py` 提供一个假的服务器到客户端采样框架。一个模拟的 "summarize_repo" 工具调用两轮采样（选择文件，然后摘要），假客户端返回预设响应。该框架展示：

- 服务器发送带 `modelPreferences` 的 `sampling/createMessage`。
- 客户端返回补全。
- 服务器继续其循环。
- 速率限制器限制每个工具调用的总采样调用次数。

看点：

- 服务器仅暴露一个工具（`summarize_repo`）；所有推理发生在采样调用中。
- 模型偏好权重客户端的模型选择；提示列出偏好模型。
- 循环在 `stopReason: "endTurn"` 时终止。
- `max_samples_per_tool = 5` 限制捕获失控循环。

## 交付它

本课产出 `outputs/skill-sampling-loop-designer.md`。给定一个需要 LLM 调用的服务器端算法（研究、摘要、规划），该技能设计一个基于采样的实现，具备正确的 modelPreferences、速率限制和安全确认。

## 练习

1. 运行 `code/main.py`。将 `max_samples_per_tool` 改为 2 并观察速率限制截断。

2. 实现 SEP-1577 的采样内工具变体：采样请求携带 `tools` 数组。验证客户端循环在执行这些工具后返回最终补全。注意漂移风险：SDK 签名在 2026 年上半年可能仍会改变。

3. 添加人工介入确认：在服务器第一次 `sampling/createMessage` 之前，暂停并等待用户批准。被拒绝的调用返回类型化拒绝。

4. 添加一个按客户端会话键控的每用户速率限制器。同一用户的同服务器循环应共享预算。

5. 设计一个使用采样选择要包含的块的 `summarize_pdf` 工具。草拟发送的消息。`modelPreferences.intelligencePriority` 在 0.1 与 0.9 时如何改变行为？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| 采样 | "服务器到客户端的 LLM 调用" | 服务器请求客户端的模型进行补全 |
| `sampling/createMessage` | "该方法" | 采样请求的 JSON-RPC 方法 |
| `modelPreferences` | "模型优先级" | 成本 / 速度 / 智能权重加上名称提示 |
| `includeContext` | "跨会话泄漏" | 软弃用的上下文包含模式 |
| SEP-1577 | "采样中的工具" | 允许采样内工具用于服务器托管的 ReAct |
| 人工介入 | "用户确认" | 客户端在运行前向用户展示采样请求 |
| 循环炸弹 | "失控采样" | 服务器端无限采样循环；客户端必须限速 |
| 隐蔽采样 | "隐藏推理" | 恶意服务器在采样提示中隐藏意图 |
| 资源窃取 | "使用用户的 LLM 预算" | 服务器强迫客户端在不需要的采样上花费 |
| `stopReason` | "生成停止的原因" | `endTurn`、`stopSequence` 或 `maxTokens` |

## 延伸阅读

- [MCP — 概念：采样](https://modelcontextprotocol.io/docs/concepts/sampling) — 采样的高级概述
- [MCP — 客户端采样规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/client/sampling) — 规范的 `sampling/createMessage` 形状
- [MCP — GitHub SEP-1577](https://github.com/modelcontextprotocol/modelcontextprotocol) — 采样内工具的规范演进提案（实验性）
- [Unit 42 — MCP 攻击向量](https://unit42.paloaltonetworks.com/model-context-protocol-attack-vectors/) — 隐蔽采样和资源窃取模式
- [Speakeasy — MCP 采样核心概念](https://www.speakeasy.com/mcp/core-concepts/sampling) — 带客户端代码示例的演练
