# MCP Sampling — 服务器请求的 LLM 补全与代理循环

> 大多数 MCP 服务器只是哑执行器：接收参数、运行代码、返回内容。Sampling（采样）让服务器翻转方向：它请求客户端的 LLM 做出决策。这使得服务器可以在不拥有任何模型凭证的情况下托管代理循环。SEP-1577（于 2025-11-25 合并）在采样请求中加入了工具，使循环能够包含更深层的推理。漂移风险提示：SEP-1577 中的工具内采样形态在 2026 年 Q1 期间仍处于实验阶段，且 SDK API 仍在持续调整中。

**类型：** 构建
**语言：** Python（标准库，采样框架）
**前置条件：** 阶段 13 · 07（MCP 服务器），阶段 13 · 10（资源和提示）
**时间：** ~75 分钟

## 学习目标

- 解释 `sampling/createMessage` 解决了什么问题（无服务器端 API 密钥的服务器托管循环）。
- 实现一个服务器，请求客户端对多轮提示进行采样并返回补全结果。
- 使用 `modelPreferences`（成本/速度/智能优先级）指导客户端模型选择。
- 构建一个 `summarize_repo` 工具，该工具内部通过采样迭代，而非硬编码行为。

## 问题描述

一个用于代码摘要工作流的实用 MCP 服务器需要：遍历文件树、选择要读取的文件、综合生成摘要并返回。LLM 推理发生在哪里？

方案 A：服务器调用自己的 LLM。需要 API 密钥，服务器端计费，每个用户成本高昂。

方案 B：服务器返回原始内容；客户端的代理进行推理。这种方式可行，但将服务器逻辑移入客户端提示中，这很脆弱。

方案 C：服务器通过 `sampling/createMessage` 请求客户端的 LLM。服务器保留算法（读取哪些文件、执行多少轮），而客户端保留计费和模型选择权。服务器完全不持有凭证。

Sampling 就是方案 C。它是一种机制，使受信任的服务器能够托管代理循环，而无需成为完整的 LLM 主机。

## 概念

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

- `costPriority`：倾向于更便宜的模型。
- `speedPriority`：倾向于更快的模型。
- `intelligencePriority`：倾向于能力更强的模型。

另外还有 `hints`：服务器偏好的命名模型。客户端可以遵从也可以不遵从提示；客户端的用户配置始终具有最终决定权。

### `includeContext`

三个值：

- `"none"` — 仅使用服务器提供的消息。默认值。
- `"thisServer"` — 包含来自此服务器会话的先前消息。
- `"allServers"` — 包含所有会话上下文。

自 2025-11-25 起，`includeContext` 被软弃用，因为它会泄漏跨服务器上下文，存在安全问题。建议使用 `"none"` 并在消息中传递显式上下文。

### 带工具的 Sampling（SEP-1577）

2025-11-25 新增：采样请求可以包含一个 `tools` 数组。客户端使用这些工具运行完整的工具调用循环。这使得服务器可以通过客户端的模型托管 ReAct 风格的代理循环。

```json
{
  "messages": [...],
  "tools": [
    {"name": "fetch_url", "description": "...", "inputSchema": {...}}
  ]
}
```

客户端循环执行：采样，如有工具调用则执行，再次采样，返回最终的助手消息。这在 2026 年 Q1 期间仍处于实验阶段；SDK 签名可能还会变化。实现时请对照 2025-11-25 规范的客户端/采样部分进行确认。

### 人在回路中

客户端必须在运行采样之前向用户展示服务器要求模型执行的操作。恶意服务器可能利用采样来操纵用户的会话（"对用户说 X，这样他们就会点击 Y"）。Claude Desktop、VS Code 和 Cursor 将采样请求以确认对话框的形式呈现给用户，用户可以选择拒绝。

2026 年的共识：未经人工确认的采样是一个危险信号。网关（阶段 13 · 17）可以自动批准低风险采样，并自动拒绝任何可疑内容。

### 无 API 密钥的服务器托管循环

典型用例：一个没有自己 LLM 接入能力的代码摘要 MCP 服务器。它执行以下操作：

1. 遍历仓库结构。
2. 调用 `sampling/createMessage`，内容为"选择最可能描述此仓库用途的五个文件。"
3. 读取这些文件。
4. 调用 `sampling/createMessage`，附带文件内容并指示"用三段话总结该仓库。"
5. 将摘要作为 `tools/call` 的结果返回。

服务器从不接触 LLM API。客户端的用户使用自己的凭证支付补全费用。

### 安全风险（Unit 42 披露，2026 年 Q1）

- **隐蔽采样。** 一个始终调用采样并指示"从会话上下文中响应用户的电子邮件"的工具。阶段 13 · 15 涵盖了攻击向量。
- **通过采样进行资源窃取。** 服务器请求客户端总结攻击者的负载，向用户收费。
- **循环炸弹。** 服务器在紧密循环中调用采样。客户端必须强制执行每会话速率限制。

## 使用它

`code/main.py` 提供了一个模拟的服务器到客户端采样框架。一个模拟的"summarize_repo"工具调用两轮采样（选择文件，然后总结），模拟客户端返回预设的响应。该框架展示了：

- 服务器发送带 `modelPreferences` 的 `sampling/createMessage`。
- 客户端返回补全结果。
- 服务器继续其循环。
- 速率限制器为每次工具调用设定采样总次数上限。

需要关注的内容：

- 服务器仅暴露一个工具（`summarize_repo`）；所有推理都在采样调用中完成。
- 模型偏好权重影响客户端的模型选择；hints 列出偏好的模型。
- 循环在 `stopReason: "endTurn"` 时终止。
- `max_samples_per_tool = 5` 的限制可防止失控循环。

## 产出

本课程生成 `outputs/skill-sampling-loop-designer.md`。给定一个需要 LLM 调用（研究、总结、规划）的服务器端算法，该技能将设计一个基于采样的实现，包含适当的 modelPreferences、速率限制和安全确认。

## 练习

1. 运行 `code/main.py`。将 `max_samples_per_tool` 改为 2，观察速率限制的截断效果。

2. 实现 SEP-1577 工具内采样变体：采样请求携带一个 `tools` 数组。验证客户端循环在执行这些工具后才返回最终的补全结果。注意漂移风险：SDK 签名在 2026 年 H1 期间可能仍然会变化。

3. 添加人在回路中的确认：在服务器的第一次 `sampling/createMessage` 之前，暂停并等待用户批准。被拒绝的调用返回类型化的拒绝信息。

4. 添加按客户端会话键控的每用户速率限制器。同一用户的同一服务器循环应共享一个预算。

5. 设计一个 `summarize_pdf` 工具，使用采样来选择要包含的块。勾勒发送的消息内容。`modelPreferences.intelligencePriority` 在 0.1 与 0.9 时如何改变行为？

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| Sampling | "服务器到客户端的 LLM 调用" | 服务器请求客户端的模型完成补全 |
| `sampling/createMessage` | "该方法" | 用于采样请求的 JSON-RPC 方法 |
| `modelPreferences` | "模型优先级" | 成本/速度/智能权重及名称提示 |
| `includeContext` | "跨会话泄漏" | 软弃用的上下文包含模式 |
| SEP-1577 | "采样中的工具" | 允许在采样中包含工具，用于服务器托管的 ReAct |
| 人在回路中 | "用户确认" | 客户端在运行前向用户展示采样请求 |
| 循环炸弹 | "失控采样" | 服务器端无限采样循环；客户端必须进行速率限制 |
| 隐蔽采样 | "隐藏推理" | 恶意服务器在采样提示中隐藏意图 |
| 资源窃取 | "使用用户的 LLM 预算" | 服务器强制客户端为其不需要的采样付费 |
| `stopReason` | "生成停止的原因" | `endTurn`、`stopSequence` 或 `maxTokens` |

## 延伸阅读

- [MCP — 概念：Sampling](https://modelcontextprotocol.io/docs/concepts/sampling) — 采样的高级概述
- [MCP — 客户端采样规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/client/sampling) — 规范的 `sampling/createMessage` 形态
- [MCP — GitHub SEP-1577](https://github.com/modelcontextprotocol/modelcontextprotocol) — 关于采样中工具（实验性）的规范演进提案
- [Unit 42 — MCP 攻击向量](https://unit42.paloaltonetworks.com/model-context-protocol-attack-vectors/) — 隐蔽采样和资源窃取模式
- [Speakeasy — MCP 采样核心概念](https://www.speakeasy.com/mcp/core-concepts/sampling) — 附客户端代码示例的详细讲解
