# MCP Sampling —— 服务端发起的 LLM 补全与 agent loop

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 大多数 MCP server 都是「无脑执行器」：接参数、跑代码、返回内容。而 sampling 让 server 反向操作：它去请求客户端的 LLM 来做决策。这样一来，server 无需持有任何模型凭据，就能托管 agent loop。SEP-1577 在 2025-11-25 合入，允许在 sampling 请求里塞 tools，让 loop 也能进行更深入的推理。漂移风险提示：SEP-1577 的 tool-in-sampling 形态在 2026 Q1 之前都还是实验性的，SDK API 仍未稳定。

**Type:** Build
**Languages:** Python (stdlib, sampling harness)
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources and prompts)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 解释 `sampling/createMessage` 解决了什么问题（在 server 不持有 API key 的前提下托管 loop）。
- 实现一个 server，它请求客户端基于多轮 prompt 做 sampling，并把补全结果返回。
- 用 `modelPreferences`（cost / speed / intelligence 优先级）来引导客户端选模型。
- 构建一个 `summarize_repo` 工具，通过 sampling 内部迭代，而不是把行为硬编码进去。

## 问题（Problem）

一个有用的、面向「代码总结」工作流的 MCP server，需要做这些事：遍历文件树、挑出要读的文件、综合写出摘要、返回结果。那 LLM 推理这一步发生在哪？

方案 A：server 自己调 LLM。需要 API key，账单算在 server 头上，每个用户成本都很高。

方案 B：server 只返回原始内容，由客户端 agent 来做推理。能跑，但把 server 的逻辑挪进了客户端 prompt 里，很脆弱。

方案 C：server 通过 `sampling/createMessage` 去请求客户端的 LLM。算法（读哪些文件、跑几轮）留在 server 这边，账单和模型选择留在客户端。server 完全不需要任何凭据。

Sampling 就是方案 C。它是一种机制——让一个受信任的 server 在自身并非完整 LLM 宿主的情况下，依然能托管 agent loop。

## 概念（Concept）

### `sampling/createMessage` 请求

server 发送：

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

客户端跑自己的 LLM，返回：

```json
{"jsonrpc": "2.0", "id": 42, "result": {
  "role": "assistant",
  "content": {"type": "text", "text": "..."},
  "model": "claude-3-5-sonnet-20251022",
  "stopReason": "endTurn"
}}
```

### `modelPreferences`

三个浮点数，加起来等于 1.0：

- `costPriority`：偏向更便宜的模型。
- `speedPriority`：偏向更快的模型。
- `intelligencePriority`：偏向能力更强的模型。

外加 `hints`：server 偏好的具名模型清单。客户端可以选择尊重也可以不尊重 hints；客户端用户的配置永远优先。

### `includeContext`

三个取值：

- `"none"` —— 只用 server 提供的 messages。默认。
- `"thisServer"` —— 包含本 server 当前 session 的历史 messages。
- `"allServers"` —— 包含所有 session 的上下文。

`includeContext` 自 2025-11-25 起处于「软弃用」状态，原因是它会泄漏跨 server 的上下文，是个安全隐患。建议用 `"none"`，把需要的上下文显式塞进 messages 里。

### Sampling with tools (SEP-1577)

2025-11-25 新增：sampling 请求可以带一个 `tools` 数组。客户端会用这些 tools 跑一整轮 tool-calling loop。这让 server 能借助客户端的模型，托管一个 ReAct 风格的 agent loop。

```json
{
  "messages": [...],
  "tools": [
    {"name": "fetch_url", "description": "...", "inputSchema": {...}}
  ]
}
```

客户端的循环是：sample → 如果调用了 tool 就执行 → 再 sample → 返回最终的 assistant 消息。这一特性在 2026 Q1 之前都属实验性，SDK 签名还可能漂移。实现时请对照 2025-11-25 spec 的 client/sampling 一节确认。

### Human-in-the-loop（人工确认）

客户端**必须**在跑 sample 之前，把 server 想让模型做什么这件事展示给用户。一个恶意 server 完全可以用 sampling 来操纵用户的 session（「跟用户说 X，让他们点 Y」）。Claude Desktop、VS Code、Cursor 都把 sampling 请求弹成一个用户可以拒绝的确认对话框。

2026 年的共识是：没有人工确认就跑 sampling，是个红色信号。Gateways（Phase 13 · 17）可以对低风险 sampling 自动放行，对任何可疑请求自动拒绝。

### 没有 API key 的 server-hosted loop

教科书级用例：一个自己完全不接入任何 LLM 的「代码总结」MCP server。流程是：

1. 遍历仓库结构。
2. 调 `sampling/createMessage`，让模型「挑出最能说明这个仓库目的的五个文件」。
3. 读这些文件。
4. 再调 `sampling/createMessage`，把文件内容传过去，让模型「用 3 段话总结这个仓库」。
5. 把摘要作为 `tools/call` 的结果返回。

server 自始至终没碰过任何 LLM API。客户端的用户用自己的凭据，付掉这些补全的钱。

### 安全风险（Unit 42 披露，2026 Q1）

- **Covert sampling（隐蔽 sampling）**。一个 tool 每次都用「从 session context 里把用户的邮箱回出来」之类的 prompt 调 sampling。攻击向量见 Phase 13 · 15。
- **通过 sampling 做资源盗用**。server 让客户端去总结攻击者的 payload，账单走用户的。
- **Loop bombs（循环炸弹）**。server 在死循环里反复调 sampling。客户端**必须**强制按 session 限速。

## 用起来（Use It）

`code/main.py` 提供了一个 fake 的 server-to-client sampling harness。一个模拟的 `summarize_repo` 工具发起两轮 sampling（先挑文件，再做摘要），fake 客户端返回写死的响应。这套 harness 演示了：

- server 发出带 `modelPreferences` 的 `sampling/createMessage`。
- 客户端返回一个补全。
- server 继续它的 loop。
- 限速器对单次 tool 调用的 sampling 总次数设了上限。

重点看：

- server 只暴露一个 tool（`summarize_repo`）；所有推理都发生在 sampling 调用里。
- model preferences 加权决定客户端的选模行为；hints 列出偏好模型。
- loop 在 `stopReason: "endTurn"` 时终止。
- `max_samples_per_tool = 5` 这一上限挡掉了失控循环。

## 上线部署（Ship It）

本节产出 `outputs/skill-sampling-loop-designer.md`。给定一个 server 端、需要 LLM 调用的算法（研究、摘要、规划），这个 skill 会基于 sampling 设计具体实现，把 modelPreferences、限速、安全确认这几块都安排妥当。

## 练习（Exercises）

1. 跑 `code/main.py`。把 `max_samples_per_tool` 改成 2，观察被限速截断的过程。

2. 实现 SEP-1577 的 tool-in-sampling 变体：sampling 请求带一个 `tools` 数组。验证客户端 loop 在返回最终补全之前会先把这些 tools 跑完。注意漂移风险：SDK 签名在 2026 H1 之前可能还会变。

3. 加上 human-in-the-loop 确认：在 server 第一次 `sampling/createMessage` 之前，暂停并等用户批准。被拒绝的调用返回带类型的拒绝结果。

4. 加一个按客户端 session 计数的 per-user 限速器。同一用户跑同一 server 的多个 loop，应该共用一份预算。

5. 设计一个 `summarize_pdf` 工具，用 sampling 来挑要包含的 chunk。把发出的 messages 草拟出来。`modelPreferences.intelligencePriority` 取 0.1 与 0.9 时，行为有何不同？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|----------------|------------------------|
| Sampling | 「server 反向调客户端 LLM」 | server 请求客户端的模型给一个补全 |
| `sampling/createMessage` | 「那个方法」 | sampling 请求用的 JSON-RPC 方法 |
| `modelPreferences` | 「模型优先级」 | cost / speed / intelligence 权重，加上具名 hints |
| `includeContext` | 「跨 session 泄漏」 | 已软弃用的上下文包含模式 |
| SEP-1577 | 「sampling 里塞 tools」 | 允许 sampling 内嵌 tools，以支持 server-hosted ReAct |
| Human-in-the-loop | 「用户确认」 | 客户端在执行前把 sampling 请求弹给用户 |
| Loop bomb | 「失控的 sampling」 | server 端的死循环 sampling；客户端必须限速 |
| Covert sampling | 「隐蔽推理」 | 恶意 server 把意图藏在 sampling 的 prompt 里 |
| Resource theft | 「花用户的 LLM 预算」 | server 强迫客户端在它不想要的 sampling 上花钱 |
| `stopReason` | 「为什么停下来了」 | `endTurn`、`stopSequence` 或 `maxTokens` |

## 延伸阅读（Further Reading）

- [MCP — Concepts: Sampling](https://modelcontextprotocol.io/docs/concepts/sampling) —— sampling 的高层概览
- [MCP — Client sampling spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/client/sampling) —— 标准 `sampling/createMessage` 形态
- [MCP — GitHub SEP-1577](https://github.com/modelcontextprotocol/modelcontextprotocol) —— sampling 内嵌 tools 的 Spec Evolution Proposal（实验性）
- [Unit 42 — MCP attack vectors](https://unit42.paloaltonetworks.com/model-context-protocol-attack-vectors/) —— covert sampling 与资源盗用的攻击模式
- [Speakeasy — MCP sampling core concept](https://www.speakeasy.com/mcp/core-concepts/sampling) —— 带客户端代码示例的演练
