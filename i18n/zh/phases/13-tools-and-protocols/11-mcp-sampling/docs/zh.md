# MCP 模型输入：Sampling 迁移与无状态 MRTR

> MCP 2026-07-28 弃用了用于新设计的 Sampling,并移除了服务器到客户端的请求通道。如果现有工作流仍然需要客户端的模型，服务器会返回一个 `input_required` 结果，然后客户端携带模型输出重试原始请求。推理循环由此在协议层变得显式、有界且无状态。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13 · 07(MCP server)、Phase 13 · 10(resources and prompts)
**Time:** 约 75 分钟

## 学习目标

- 解释为什么 Sampling 在 MCP 2026-07-28 中被弃用，并选择直接集成模型作为新服务器的默认方案。
- 实现一个兼容性工作流，将 `sampling/createMessage` 贯穿多往返请求(MRTR)。
- 在每个请求 `_meta` 对象中携带协议版本和客户端能力。
- 返回 `resultType: "input_required"`,并使用新的 JSON-RPC id 重试原始方法。
- 对 `requestState` 进行完整性保护，并将其绑定到主体、方法、参数和过期时间。
- 通过能力检查、审批、响应验证和轮次上限来约束模型辅助循环。

## 协议之前需要做的决定

像 `summarize_repo` 这样的工具需要完成两类工作：

1. 确定性工作：列出文件、读取被允许的文件、校验路径并组装内容。
2. 模型工作：挑选代表性文件并生成摘要。

你现在有两种有效的架构。

### 新服务器：直接集成模型提供商

这是当前的默认方案。服务器负责模型选择、凭据、预算、重试和可观测性。它向 MCP 客户端返回一个普通的 `tools/call` 结果。

当服务器本身已经是托管服务，或者可预测的模型行为比使用宿主方的模型更重要时，选择此方案。

### 现有 Sampling 工作流：迁移到 MRTR

Sampling 在其弃用窗口期内仍然存在。以 2026-07-28 为目标的服务器无法向客户端发回实时的 `sampling/createMessage` 请求。它会将该请求嵌入到一个 `InputRequiredResult` 中。

只有当使用客户端的模型和凭据是真实的产品需求时，才选择这条兼容路径。同时记录一份移除计划，因为新的实现不应采用已弃用的 Sampling。

## 无状态契约

2026 年 7 月的协议中不再有 `initialize` 交换、`notifications/initialized`,也没有 `Mcp-Session-Id`。每个请求都携带原本保存在握手中的信息：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "summarize_repo",
    "arguments": {"audience": "developer"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {"sampling": {}},
      "io.modelcontextprotocol/clientInfo": {
        "name": "lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

服务器对每个请求都校验版本。缺失或非字符串的版本属于 invalid params,即 `-32602`。不支持的版本字符串返回 `-32022`,并附带精确数据 `{"supported":["2026-07-28"],"requested":"<client version>"}`。缺少 Sampling 能力则返回 `-32021`,并将 `data.requiredCapabilities` 设为 `{"sampling":{}}`。

没有 JSON-RPC `id` 的信封是一条通知。接收方可以处理它，但既不发出成功响应也不发出错误响应。Streamable HTTP 适配器对已接受的通知返回 `202 Accepted` 且无响应体。

服务器还实现了 `server/discover`,使用精确的 `supportedVersions` 键、capabilities、`ttlMs` 和 `cacheScope`,使客户端能够在调用工具之前了解并缓存服务器契约。由于发现过程通告了 `tools`,服务器也必须实现强制的 `tools/list`。其确定性的 `summarize_repo` 描述符包含有效的对象 `inputSchema`、`resultType: "complete"`、服务器身份元数据和公共缓存提示。

每个现代成功结果都有一个判别字段：

- `resultType: "complete"` 表示操作已完成。
- `resultType: "input_required"` 表示客户端必须完成内嵌请求并重试。
- 扩展可以定义其他结果类型。Tasks 扩展在第 13 课中增加了 `"task"`。

## 一次 MRTR 轮次

服务器在处理请求期间无法调用客户端。它改为返回以下结果：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "input_required",
    "inputRequests": {
      "pick_files": {
        "method": "sampling/createMessage",
        "params": {
          "messages": [
            {
              "role": "user",
              "content": {
                "type": "text",
                "text": "Choose three representative files and return a JSON array."
              }
            }
          ],
          "systemPrompt": "Return only the requested value.",
          "modelPreferences": {
            "costPriority": 0.8,
            "intelligencePriority": 0.2
          },
          "maxTokens": 400
        }
      }
    },
    "requestState": "opaque-integrity-protected-value"
  }
}
```

客户端确认它支持 Sampling,应用其审批和模型策略，并获得模型响应。然后它发送一个携带不同 JSON-RPC id 的新请求：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "summarize_repo",
    "arguments": {"audience": "developer"},
    "inputResponses": {
      "pick_files": {
        "role": "assistant",
        "content": {
          "type": "text",
          "text": "[\"README.md\", \"server.py\", \"docs/intro.md\"]"
        },
        "model": "host-model",
        "stopReason": "endTurn"
      }
    },
    "requestState": "opaque-integrity-protected-value",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {"sampling": {}}
    }
  }
}
```

这次重试不是协议会话的延续。它是一个新请求，重复原始方法和参数，只添加当前轮次的 `inputResponses`,并逐字节回显 `requestState`。

MRTR 只允许用于 `tools/call`、`prompts/get` 和 `resources/read`。服务器不得从不相关的方法返回 `input_required`。

## 多轮状态

本课需要两次模型调用：

1. `pick_files` 返回一个 JSON 数组。
2. `summary` 返回最终的文字内容。

每次重试只携带该轮次的响应。因此，服务器将阶段和已验证的中间数据放入下一个 `requestState`。

将该值视为攻击者可控的内容。仅对原始阶段名进行签名是不够的。必须将状态绑定到：

- 已认证的主体，而不是自报的 `clientInfo`;
- 发起的方法；
- 原始参数的摘要；
- 较短的过期时间；
- 当前阶段和已验证的中间值。

在不需要机密性时使用 HMAC。当客户端不得读取状态时，使用认证加密。对签名错误、值过期、主体变更或参数变更的情况，一律以 `-32602` 拒绝。

客户端不得解析或修改 `requestState`。它唯一的职责是在重试时逐字回显该字符串。

## 模型偏好只是提示

`costPriority`、`speedPriority` 和 `intelligencePriority` 是相互独立的偏好。它们不是概率分布，也不需要和为 1。客户端可以忽略它们，因为模型策略由客户端掌控。

如果你维护一个遗留的 Sampling 流程，请将 `includeContext` 保持为 `"none"`。其他上下文模式会增加泄露风险，并且本身已被弃用。请在请求中传递最少的显式上下文。

## 安全不变量

客户端是内嵌 Sampling 请求的信任边界。

- 当策略要求审批时，向用户展示服务器要求模型执行的操作。
- 限制 MRTR 轮次。否则恶意服务器可以制造模型开销循环。
- 在将每个采样响应用作文件名、URL 或工具输入之前进行验证。
- 限制每轮的字节数和 token 数。
- 拒绝未在当前客户端能力中声明的输入请求。
- 不让模型输出参与授权决策。
- 记录发起方法和输入请求键，但不记录敏感的提示内容。

`clientInfo` 和 `serverInfo` 是用于显示和诊断的元数据。绝不要将其中任何一个用作经过认证的身份。

```figure
t3-sampling-flip
```

## 构建它

`code/main.py` 在不使用任何第三方包的情况下实现了完整的两轮流程：

- `server/discover` 返回 `supportedVersions`,通告工具支持，并返回缓存提示。
- `tools/list` 返回一个确定性、可缓存的 `summarize_repo` 描述符，带有对象输入模式。
- `tools/call` 校验每个请求的元数据。
- 第一个结果内嵌 `sampling/createMessage` 用于文件选择。
- 第一次重试校验模型结果并内嵌第二个请求。
- 受 HMAC 保护的 `requestState` 在独立请求之间携带阶段信息。
- 最终结果使用 `resultType: "complete"`。

模拟的宿主模型使示例具有确定性。连接真实宿主时只需替换 `fake_host_model`。服务器端状态机应保持确定且可测试。

## 使用它

在仓库根目录下：

```bash
cd phases/13-tools-and-protocols/11-mcp-sampling/code
python3 main.py
python3 -m unittest discover tests -v
```

预期的检查点：

- Discovery 返回一个包含 `ttlMs` 和 `cacheScope` 的完整结果。
- 工具发现返回相同的已排序描述符，包含 `resultType`、服务器身份和缓存提示。
- 缺失能力和不支持的版本使用精确的 `-32021` 和 `-32022` 错误数据。
- 无 id 的通知不产生任何 JSON-RPC 响应。
- 请求 id 为 `[1, 2, 3]`,证明每轮 MRTR 都是独立的。
- 前两个结果是 `input_required`。
- 最终结果是 `complete`,包含选中的文件以及摘要。
- 在重试时更改原始参数会导致请求状态检查失败。

## 交付它

`outputs/skill-sampling-loop-designer.md` 现在是一个迁移规划器。它首先决定是否应移除 Sampling,改用直接模型集成。如果需要兼容性，它会生成 MRTR 轮次、状态绑定、能力门控、预算、验证和移除计划。

## 练习

1. 将文件选择的响应改为无效 JSON。确认服务器返回 `-32602` 而不是信任模型输出。
2. 在第一次调用和重试之间更改 `audience`。解释为什么密封状态会阻止跨请求复用。
3. 增加第三个轮次，要求宿主对摘要进行评价。将先前的摘要放入签名状态中，并将整个流程的上限设为三轮。
4. 通过将模拟宿主回调替换为服务器自有的模型适配器来移除 Sampling。列出哪些审批、计费和可观测性职责转移到了服务器。
5. 添加一个过期测试，使用一个已超过截止时间一秒的状态值。

## 关键术语

| 术语 | 在 2026-07-28 中的含义 |
|------|------------------------|
| Sampling | 已弃用的特性，请求客户端的模型生成补全 |
| MRTR | 用于请求期间需要客户端输入的无状态重试模式 |
| `InputRequiredResult` | 携带 `resultType: "input_required"` 的结果 |
| `inputRequests` | 服务器分配的内嵌 elicitation、sampling 或 roots 请求映射 |
| `inputResponses` | 当前轮次的客户端结果，按类似 `inputRequests` 的方式键控 |
| `requestState` | 由客户端逐字回显、由服务器验证的不透明服务器状态 |
| `resultType` | 现代 MCP 结果必需的判别字段 |
| Direct model integration | 推荐给需要模型推理的新服务器的替代方案 |
| Capability gate | 防止发送客户端未通告的内嵌请求的规则 |
| Loop budget | 该操作允许的最大轮次、token、字节、时间和开销 |

## 遗留兼容性

锁定在 2025-11-25 的客户端仍可以通过活动连接使用较旧的服务器发起式 `sampling/createMessage` 流程。仅将该行为保留在特定版本的适配器中。不要把有会话的路径作为 2026-07-28 服务器的架构。

官方 SDK 可以为较旧的对端转换现代的 `input_required` 处理器。该垫片是兼容性边界，而不是添加新的依赖会话逻辑的许可。

## 延伸阅读

- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP Sampling deprecation](https://modelcontextprotocol.io/seps/2577-deprecate-roots-sampling-and-logging)
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)