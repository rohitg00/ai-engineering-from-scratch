# 无状态 MCP 网关与注册表准入

> 网关应当使每条路由都显式化。2026-07-28 协议为其提供了方法、名称、版本、能力、身份、缓存与追踪边界，而无需传输层会话。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 13 · 15 (security), Phase 13 · 16 (authorization)
**Time:** ~75 分钟

## 学习目标

- 在不依赖会话亲和性的前提下，将多个 MCP 服务器聚合到一个 2026-07-28 端点之后。
- 在执行策略或转发之前，验证每个请求的元数据与路由头。
- 合并工具时保持稳定的命名空间、确定性顺序、描述符锚定、RBAC 与私有缓存。
- 将注册表记录视为发现证据，但仍需准入策略。
- 正确路由请求作用域的 SSE、`subscriptions/listen`、MRTR 重试与 Tasks 扩展调用。
- 将旧式握手与会话支持与现代路径隔离开来。

## 问题所在

一个客户端直连一个服务器很简单。更大规模的部署需要对更难的问题给出一致的答案：

- 哪些服务器是允许的？
- 哪个主体可以查看并调用每个工具？
- 当两个后端暴露相同名称时会发生什么？
- 描述符的变更如何审核？
- 速率限制和审计事件应用在哪里？
- 任意实例是否都能处理下一个请求？

网关位于客户端与后端 MCP 服务器之间。它呈现一个 MCP 端点，应用横切策略，并转发已批准的请求。

较早的网关设计常常将一个客户端会话多路复用到多个后端会话，并重写 `Mcp-Session-Id`。那是一种遗留兼容性设计。2026-07-28 核心中不存在协议会话。

## 核心概念

### 现代网关路径

对于每个请求：

1. 从传输层授权认证主体。
2. 验证 `MCP-Protocol-Version`、`Mcp-Method`、`Mcp-Name` 和 `params._meta`。
3. 授权主体、资源、方法、工具与参数。
4. 应用描述符、注册表、速率与数据策略。
5. 为选定的后端创建一个全新的自包含请求。
6. 验证后端结果并返回网关结果。
7. 记录审计事件而不记录机密信息。

没有任何步骤需要隐藏的协议会话。应用状态仍可存在于数据库、显式句柄、Tasks 或完整性受保护的 MRTR 状态中。

### 运行时策略是网关的首要决策

准入决定哪个后端版本可以进入网关，它并不授权一次实时调用。对每个请求，网关都会基于已认证的主体、签发者与资源、租户、匹配的方法与名称、规范化后的参数、已准入的描述符锚定、当前后端健康状况、能力交集、数据分类、速率状态以及任何绑定到操作的批准来重新计算策略。

这个顺序很重要。注册表记录可以保持活跃，而用户的角色已被撤销。描述符可以保持锚定，而目标参数跨过了租户边界。后端可以保持已批准状态，而事件策略已隔离改变状态的调用。因此，运行时策略才是首要的允许或拒绝决策，注册表与描述符证据只是输入。

不要在连接或已移除的会话标识符下缓存允许决策。如果策略不可用，则按照操作类别遵循已声明的失败策略。一个安全的默认做法是对状态变更和敏感读取失败即关闭（fail closed），而经明确批准的公共读取路径仅在其风险模型允许时才可使用短期的最后已知策略。记录是哪个策略版本和哪条失败路径做出了该决策，然后在返回前验证后端结果。

### 单一 POST 端点

现代 Streamable HTTP 通过 POST 发送每条 JSON-RPC 消息：

```text
POST /mcp
Authorization: Bearer <gateway-token>
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.search
Accept: application/json, text/event-stream
```

网关可以为该 POST 返回 JSON 或请求作用域的 SSE。对于现代请求，GET 和 DELETE 返回 405。`Mcp-Session-Id` 和 `Last-Event-ID` 不会创建权限、亲和性或重放行为。

头部与正文值必须一致。在查找后端之前，用 `-32020` 拒绝不匹配的情况。这使得负载均衡器、网关和速率限制器无需解析完整正文即可进行路由，同时保持端到端完整性。

按一个精确的顺序进行验证：JSON-RPC 与元数据类型、头部与正文相等性，然后是对匹配版本的支持。不匹配返回 HTTP 400 和 `-32020`。如果头部与正文在不受支持的版本上一致，则返回 HTTP 400、`-32022` 和 `data`，且完全等于 `{"supported":["2026-07-28"],"requested":"<actual>"}`。未知方法返回 HTTP 404 和 `-32601`。

`ProtocolError` 携带可选的 `data`，网关将其序列化进 JSON-RPC 错误对象中。通知没有 `id`，因此它永远不会收到 JSON-RPC 成功或错误响应。已接受的 HTTP 通知返回 202 和空正文。

### 在每一层实现发现

网关为客户端实现 `server/discover`。它也发现每个后端，从而了解协议版本、能力与扩展。

网关结果示例：

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "tools": {"listChanged": true}
  },
  "ttlMs": 30000,
  "cacheScope": "private",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "enterprise-gateway",
      "version": "2.0.0"
    }
  }
}
```

只通告网关能端到端兑现的能力交集。后端特性并不自动意味着可以安全暴露。没有后端路径支撑的网关特性也不值得通告。

`serverInfo` 是自报告的展示与诊断数据。不要将其用作注册表或发布者证明。

### 每请求的客户端能力

每个转发的请求都需要一个最新的 `_meta` 信封：

```json
{
  "io.modelcontextprotocol/protocolVersion": "2026-07-28",
  "io.modelcontextprotocol/clientCapabilities": {},
  "io.modelcontextprotocol/clientInfo": {
    "name": "enterprise-gateway",
    "version": "1.0.0"
  }
}
```

不要盲目地将外层客户端能力复制到后端。网关才是后端的客户端。只通告网关能够正确中介的特性。

### 确定性的命名空间

在稳定的公共名称下合并后端工具：

```text
notes.search
notes.create
issues.list
issues.open
```

维护一个从公共名称到后端及原始工具名称的映射。绝不要随意选择第一个或最后一个冲突项。公共名称是批准与审计契约的一部分，因此更改它属于一次迁移。

`tools/list` 必须是确定性的。当可见性因主体而异时，返回 `cacheScope: private`。有界的 `ttlMs` 可减少后端发现负载，同时不允许用户特定的列表在授权上下文之间泄漏。

每个暴露的工具描述符都包含稳定的名称、描述以及以对象为根的 `inputSchema`。命名空间不能移除必需的描述符字段。完整的列表结果还包括 `resultType`、服务器身份元数据和缓存提示。

### 锚定已批准的描述符

在准入时，对完整描述符进行规范化，并将其摘要存储在限定的公共名称下。在列表和调用时，将实时描述符与已批准的摘要进行比较。

如果它发生了变化：

- 将其从 `tools/list` 中移除。
- 拒绝直接调用。
- 发出审计事件。
- 在更新锚定之前，需要策略或人工重新批准。

网关是一个有用的中央执行点，但它不会把首次见到的描述符变成安全的描述符。初始审查仍然必不可少。

### 注册表帮助发现，而非决策

注册表 `server.json` 提供发布元数据。基于包的记录可能如下所示：

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "com.example/notes",
  "description": "Example notes MCP server.",
  "version": "1.0.0",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "@example/notes-mcp",
      "version": "1.0.0",
      "transport": {"type": "stdio"}
    }
  ]
}
```

发布元数据不承载网关的安全决策。将已验证的发布者与来源证据保存在单独的准入状态中：

```json
{
  "registryName": "com.example/notes",
  "registryVersion": "1.0.0",
  "publisher": {"namespace": "com.example", "status": "verified"},
  "provenance": {
    "source": "registry.modelcontextprotocol.io",
    "recordId": "com.example/notes@1.0.0"
  },
  "admission": {"status": "approved", "reviewedBy": "gateway-policy"}
}
```

网关检查 `server.json` 的结构并将其与该外部状态联接。网关仍然需要准入策略。

对每个已准入的后端，记录：

- 确切的注册表与记录标识符。
- 已验证的发布者命名空间或域证据。
- 允许的传输方式与端点。
- 锚定的版本或已批准的升级策略。
- 工件或描述符摘要。
- 授权的签发者与资源。
- 审查者、批准时间与过期时间。

不要因为某服务器的显示名称看起来像熟悉的产品就接受它。不要将注册表中的存在视为运营安全审查。私有服务器即使从未出现在公共注册表中，也可以通过相同的证据模式获得准入。

本课实现了网关接缝：在后端成为可路由之前，将发布证据与本地准入联接起来。[Lesson 30: MCP Registry Supply Chain, Admission, Drift, and Rollback](../../30-mcp-registry-supply-chain-and-drift/docs/en.md) 构建了完整的控制平面，涵盖精确的命名空间证明、工件来源、不可变锚定、实时描述符漂移、注册表状态对账、防篡改准入账本以及有证据支撑的回滚。请将该供应链状态与上述每请求运行时决策分开保存。

### 凭证中介

网关对其调用者进行认证，并单独向后端进行认证。后端凭证绝不会发送给客户端。

保持这些绑定是显式的：

```text
outer principal -> gateway role and policy
backend issuer + resource -> backend registration and token
```

绝不要将外层网关令牌传递给后端。绝不要在不同的签发者或资源处复用后端令牌。如果某个工具代表最终用户执行操作，请通过设计的交换或声明模型来保留该委托，而不是使用共享的服务凭证冒充用户。

### 无会话的速率限制

按已认证的主体、签发者、资源、公共工具、成本类别和时间窗口来设置键控限制。会话 ID 不存在，即便存在也容易被轮换。

在消耗昂贵的工作之前先应用廉价的验证。决定被拒绝的调用是否计入滥用限制、业务配额，或两者皆计。

### 审计决策链

记录足够的信息以重建一次调用：

- 请求与追踪标识符。
- 已认证的主体与签发者。
- 公共工具与后端路由。
- 描述符锚定版本。
- 策略决策与原因。
- 延迟与结果类别。
- 适用时的 MRTR 轮次或任务标识符。

对持有者令牌、授权码、刷新令牌、原始机密以及不必要的敏感参数进行脱敏。

### 请求作用域的 SSE

当工作在单次请求期间流式传输时，普通 POST 可以返回请求作用域的 SSE。关闭响应流即取消该进行中的现代 HTTP 请求。

不要创建单独的 GET 流，也不要承诺 Last-Event-ID 重放。那些是较早传输层的假设。

### 长期变更通知

对于列表与资源变更通知，现代客户端通过 POST 发送 `subscriptions/listen` 并接收 SSE 响应。通知过滤器使用精确的扁平字段 `toolsListChanged`、`promptsListChanged`、`resourcesListChanged` 和 `resourceSubscriptions`：

```json
{
  "jsonrpc": "2.0",
  "id": "listen-tools",
  "method": "subscriptions/listen",
  "params": {
    "notifications": {
      "toolsListChanged": true
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

第一个事件确认所支持的子集。其订阅标识符就是打开该流的请求的 JSON-RPC id：

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/subscriptions/acknowledged",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": "listen-tools"
    },
    "notifications": {
      "toolsListChanged": true
    }
  }
}
```

之后网关只转发已确认的变更类型。该流上的每条通知都在 `params._meta` 中携带相同的 `io.modelcontextprotocol/subscriptionId`。没有自动重放或自动重新监听。重连时，客户端重新打开订阅并刷新其依赖的列表。服务器发起的优雅关闭会返回一个最终完整结果，并标记相同的订阅 id。

现代路径取代了 `resources/subscribe`、`resources/unsubscribe` 以及未经请求的独立 GET 流。仅在版本门控的旧式路径中保留它们。

### 通过网关的 MRTR

当后端返回 `resultType: input_required` 时，只有在外层客户端支持所需的输入请求时，网关才能转发该结果。除非网关有意终止并重新发起交互，否则应逐字节保留 `requestState`。

客户端使用全新的 JSON-RPC id 和 `inputResponses` 重试原始的公共工具。网关对重试重新授权，检查相同的公共路由，然后转发一个全新的后端请求。它不得假设较早的轮次授予了无限批准。

### Tasks 扩展路由

Tasks 是由 `io.modelcontextprotocol/tasks` 标识的官方扩展。它们不是核心会话的替代品。

客户端在每请求的客户端能力内声明该扩展，网关只有在能端到端保持其生命周期时才在发现中通告它。对于受支持的 `tools/call`，仅由后端决定是返回普通结果还是 `resultType: task`。任务结果直接在结果中携带 `taskId`、`status`、时间戳、`ttlMs` 以及可选的 `pollIntervalMs`。在该结果被发送之前，任务必须已经可以持久地读取。

网关为不透明的任务标识符记录已认证的主体与后端路由。后续的 `tasks/get`、`tasks/update` 和 `tasks/cancel` 调用使用 `params.taskId` 作为 `Mcp-Name`，这为中间件提供了路由键。`tasks/get` 返回 `resultType: complete`，其中包含当前任务状态，并在终态中内联最终结果或协议错误。`tasks/update` 为待处理任务输入发送键控的 `inputResponses`，并返回一个空的 complete 确认。`tasks/cancel` 是一种协作性意图，带有一个空的 complete 确认，并不保证工作已停止。

不要实现新的 `tasks/list` 或 `tasks/result` 方法。它们属于较早的实验模型。需要输入的任务通过 `tasks/get` 暴露完整的内嵌请求；客户端通过 `tasks/update` 回答它们，而不是重试原始工具调用。客户端仍按建议的间隔轮询；任务创建仍由服务器主导。

持久化的任务路由状态是以任务句柄为键的应用数据，而不是协议会话。

### 兼容性边界

如果网关必须服务较旧的客户端或后端：

- 显式地检测所处的时代。
- 将初始化、传输会话、GET 流、资源订阅和旧任务词汇保留在遗留适配器内。
- 绝不将遗留会话 id 泄漏到现代路由或授权中。
- 优先使用有界的发现探测和显式回退策略，而非静默降级。

```figure
t3-gateway-funnel
```

## 动手实现

`code/main.py` 实现了一个进程内协议网关和两个后端服务器。每个后端都接收一个全新的当前协议请求。网关提供发现、用户过滤的确定性 `tools/list`、命名空间路由、注册表 `server.json` 与外部准入状态、描述符锚定、RBAC、按主体键控的速率限制、审计决策以及建模的 `subscriptions/listen` SSE 确认。

该模型接收解析后的请求正文、路由头部和已认证的持有者身份。它不是完整的 HTTP 适配器，也不解析 `Content-Type` 或完整的 `Accept` 契约。将其连接到 Lesson 09 的 Streamable HTTP 适配器，该适配器要求 `Content-Type: application/json` 以及同时包含 `application/json` 和 `text/event-stream` 的 `Accept` 值。

运行方式：

```bash
cd phases/13-tools-and-protocols/17-mcp-gateways-and-registries
python3 code/main.py
python3 -m unittest discover code/tests -v
```

演示会打印外层请求 id 和全新的后端请求 id，以便看到无状态的中转跳。

## 使用方式

将进程内的后端对象替换为真实的当前协议客户端。保持相同的接缝：

- 连接之前的准入记录。
- 能力暴露之前的后端发现。
- 授权之前的限定公共名称。
- 列表或调用之前的描述符锚定。
- 转发之前的全新每请求元数据。
- 返回之前的结果验证。

## 交付方式

本课交付 `outputs/skill-gateway-bootstrap.md`。它产生一个涵盖入口、发现、准入、命名空间、授权、缓存、流式传输、订阅、MRTR、Tasks、可观测性与遗留隔离的现代网关设计。

## 练习

1. 在外层和转发的请求元数据中添加追踪上下文，并在审计事件中记录该关联。
2. 添加一个支持 Tasks 的后端，并通过 `Mcp-Name` 中的任务 id 路由 `tasks/get`。
3. 更改一个后端描述符，并证明发现和直接调用都被阻止。
4. 添加一个主体特定的服务器能力，并解释为什么发现必须保持私有缓存。
5. 编写一个遗留适配器接口，而不向现代 `Gateway` 类添加任何遗留状态。

## 关键术语

| 术语 | 含义 |
|------|---------|
| MCP 网关 | 位于客户端与后端 MCP 服务器之间的策略与路由服务器 |
| 准入记录 | 允许某个后端进入网关的证据与策略决策 |
| 限定工具名称 | 稳定的公共路由，例如 `notes.search` |
| 描述符锚定 | 在发现和分发期间检查的已批准摘要 |
| 私有缓存作用域 | 限定在单个授权上下文内的缓存结果 |
| 请求作用域 SSE | 附加到单次 POST 请求的流式响应 |
| `subscriptions/listen` | 客户端打开的 SSE 流，用于选定的长期变更通知 |
| 任务路由 | 从不透明任务 id 到其后端的应用层映射 |
| 遗留适配器 | 针对旧式握手与会话行为的显式版本门控边界 |

## 延伸阅读

- [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [Official Registry server.json requirements](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/official-registry-requirements.md)
- [MCP Tasks extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)