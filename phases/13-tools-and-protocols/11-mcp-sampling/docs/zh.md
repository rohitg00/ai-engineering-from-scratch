# 11 · MCP 采样——服务器发起的 LLM 补全与智能体循环

> 大多数 MCP 服务器都是「笨拙的执行者」：接收参数、运行代码、返回内容。采样（Sampling）让服务器反转了这一方向：它可以请求客户端的 LLM 来做出决策。这使得服务器能够托管智能体循环（agent loop），而无需服务器自己持有任何模型凭证。SEP-1577 已于 2025-11-25 合入，它在采样请求内部加入了工具（tools），使得循环能够包含更深层的推理。漂移风险提示：SEP-1577 这种「采样内嵌工具」的形态在 2026 年 Q1 之前一直处于实验性阶段，目前在各 SDK 的 API 中仍在逐步稳定。

**类型：** 构建
**语言：** Python（标准库，采样脚手架）
**前置：** 阶段 13 · 07（MCP 服务器）、阶段 13 · 10（资源与提示）
**时长：** 约 75 分钟

## 学习目标

- 解释 `sampling/createMessage` 解决了什么问题（在没有服务端 API 密钥的情况下托管循环）。
- 实现一个服务器，让它请求客户端对一段多轮提示进行采样，并返回补全结果。
- 使用 `modelPreferences`（成本 / 速度 / 智能优先级）来引导客户端的模型选择。
- 构建一个 `summarize_repo` 工具，让它通过采样在内部迭代，而不是把行为硬编码进去。

## 问题所在

一个用于代码摘要工作流的实用 MCP 服务器需要做到：遍历文件树、挑选要读取的文件、综合出一份摘要并返回。那么 LLM 推理应该发生在哪里？

方案 A：服务器调用它自己的 LLM。这需要 API 密钥、在服务端计费，且分摊到每个用户的成本很高。

方案 B：服务器返回原始内容，由客户端的智能体来做推理。这能跑通，但把服务器逻辑挪进了客户端提示里，很脆弱。

方案 C：服务器通过 `sampling/createMessage` 请求客户端的 LLM。服务器保留算法（读取哪些文件、做几趟）的控制权，而客户端保留计费与模型选择的控制权。服务器完全不持有任何凭证。

采样就是方案 C。它是一种机制，让一个受信任的服务器无需自己成为完整的 LLM 宿主，就能托管智能体循环。

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

- `costPriority`：倾向更便宜的模型。
- `speedPriority`：倾向更快的模型。
- `intelligencePriority`：倾向更强的模型。

外加 `hints`：服务器偏好的具名模型。客户端可以选择是否采纳这些提示；客户端用户的配置始终优先。

### `includeContext`

三个取值：

- `"none"`——只包含服务器提供的消息。默认值。
- `"thisServer"`——包含本服务器会话中的先前消息。
- `"allServers"`——包含全部会话上下文。

`includeContext` 自 2025-11-25 起被「软性弃用」（soft-deprecated），因为它会泄露跨服务器上下文，这是一个安全隐患。推荐使用 `"none"`，并在 messages 中显式传入需要的上下文。

### 带工具的采样（SEP-1577）

2025-11-25 新增：采样请求中可以包含一个 `tools` 数组。客户端会使用这些工具运行一个完整的工具调用循环。这让服务器能够借助客户端的模型托管一个 ReAct 风格的智能体循环。

```json
{
  "messages": [...],
  "tools": [
    {"name": "fetch_url", "description": "...", "inputSchema": {...}}
  ]
}
```

客户端的循环是：采样、若被调用则执行工具、再次采样、返回最终的 assistant 消息。这一特性在 2026 年 Q1 之前都处于实验性阶段；SDK 签名可能仍会漂移。实现时请对照 2025-11-25 规范的 client/sampling 章节进行确认。

### 人在回路（Human-in-the-loop）

在运行采样之前，客户端**必须**向用户展示服务器要求模型执行的内容。恶意服务器可能利用采样来操纵用户的会话（例如「对用户说 X，好让他们点击 Y」）。Claude Desktop、VS Code 和 Cursor 会把采样请求以确认对话框的形式呈现，用户可以拒绝。

2026 年的共识是：未经人工确认的采样是一个危险信号。网关（阶段 13 · 17）可以自动批准低风险采样，并自动拒绝任何可疑请求。

### 无需 API 密钥的服务器托管循环

典型用例：一个自身没有任何 LLM 访问能力的代码摘要 MCP 服务器。它的流程是：

1. 遍历仓库结构。
2. 调用 `sampling/createMessage`，附带「挑出最可能描述本仓库目的的五个文件」。
3. 读取这些文件。
4. 调用 `sampling/createMessage`，附带这些文件的内容以及「用 3 段话总结这个仓库」。
5. 把摘要作为 `tools/call` 的结果返回。

服务器从未接触过任何 LLM API。客户端的用户使用自己的凭证为这些补全付费。

### 安全风险（Unit 42 披露，2026 Q1）

- **隐蔽采样（Covert sampling）。** 某个工具总是带着「用会话上下文中的用户邮箱来回复」去调用采样。阶段 13 · 15 会讲解这些攻击向量。
- **借采样窃取资源（Resource theft via sampling）。** 服务器请求客户端去总结攻击者的载荷，让用户为此买单。
- **循环炸弹（Loop bombs）。** 服务器在一个紧密循环里不停调用采样。客户端**必须**强制执行每会话的速率限制。

## 上手实践

`code/main.py` 附带了一个模拟的「服务器到客户端」采样脚手架。一个被模拟的 `summarize_repo` 工具触发两轮采样（先挑文件，再做总结），而模拟客户端返回预设好的响应。该脚手架展示了：

- 服务器发送带 `modelPreferences` 的 `sampling/createMessage`。
- 客户端返回一个补全。
- 服务器继续其循环。
- 速率限制器对每次工具调用的总采样次数设上限。

需要关注的地方：

- 服务器只暴露一个工具（`summarize_repo`）；所有推理都发生在采样调用中。
- 模型偏好会影响客户端的模型选择权重；hints 列出了偏好的模型。
- 循环在 `stopReason: "endTurn"` 时终止。
- `max_samples_per_tool = 5` 这一上限可以拦住失控的循环。

## 交付产物

本课会产出 `outputs/skill-sampling-loop-designer.md`。给定一个需要 LLM 调用的服务端算法（研究、摘要、规划），该技能会设计出一个基于采样的实现，并配上恰当的 modelPreferences、速率限制和安全确认。

## 练习

1. 运行 `code/main.py`。把 `max_samples_per_tool` 改为 2，观察速率限制的截断效果。

2. 实现 SEP-1577 的「采样内嵌工具」变体：采样请求携带一个 `tools` 数组。验证客户端循环会先执行这些工具，再返回最终补全。注意漂移风险：SDK 签名在 2026 年上半年可能仍会变化。

3. 加入人在回路的确认：在服务器第一次 `sampling/createMessage` 之前，暂停并等待用户批准。被拒绝的调用返回一个带类型的拒绝（typed refusal）。

4. 加入一个按客户端会话归类（keyed）的「每用户」速率限制器。同一用户在同一服务器上的循环应共享一份预算。

5. 设计一个 `summarize_pdf` 工具，用采样来挑选要纳入的分块（chunk）。勾勒出所发送的 messages。当 `modelPreferences.intelligencePriority` 取 0.1 与取 0.9 时，行为会如何变化？

## 关键术语

| 术语 | 大家怎么说 | 它实际的含义 |
|------|----------------|------------------------|
| 采样（Sampling） | 「服务器到客户端的 LLM 调用」 | 服务器向客户端的模型请求一个补全 |
| `sampling/createMessage` | 「那个方法」 | 用于采样请求的 JSON-RPC 方法 |
| `modelPreferences` | 「模型优先级」 | 成本 / 速度 / 智能权重，外加名称提示 |
| `includeContext` | 「跨会话泄露」 | 被软性弃用的上下文包含模式 |
| SEP-1577 | 「采样中的工具」 | 允许在采样内嵌入工具，以实现服务器托管的 ReAct |
| 人在回路（Human-in-the-loop） | 「用户确认」 | 客户端在运行前把采样请求呈现给用户 |
| 循环炸弹（Loop bomb） | 「失控的采样」 | 服务端的无限采样循环；客户端必须限速 |
| 隐蔽采样（Covert sampling） | 「隐藏的推理」 | 恶意服务器把意图藏在采样提示里 |
| 资源窃取（Resource theft） | 「花用户的 LLM 预算」 | 服务器强迫客户端为它不想要的采样付费 |
| `stopReason` | 「生成为何停止」 | `endTurn`、`stopSequence` 或 `maxTokens` |

## 延伸阅读

- [MCP — 概念：采样](https://modelcontextprotocol.io/docs/concepts/sampling) — 采样的高层概览
- [MCP — 客户端采样规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/client/sampling) — 权威的 `sampling/createMessage` 形态
- [MCP — GitHub SEP-1577](https://github.com/modelcontextprotocol/modelcontextprotocol) — 关于「采样中的工具」的规范演进提案（实验性）
- [Unit 42 — MCP 攻击向量](https://unit42.paloaltonetworks.com/model-context-protocol-attack-vectors/) — 隐蔽采样与资源窃取模式
- [Speakeasy — MCP 采样核心概念](https://www.speakeasy.com/mcp/core-concepts/sampling) — 含客户端代码示例的逐步讲解
