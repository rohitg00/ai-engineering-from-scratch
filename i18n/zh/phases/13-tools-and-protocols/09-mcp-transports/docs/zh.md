# MCP 传输层：stdio 与无状态 Streamable HTTP

> 传输层承载 MCP 消息。它不提供缺失的协议状态。在 `2026-07-28` 中，本地 stdio 和远程 Streamable HTTP 都承载自描述的请求。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 13, Lessons 07 and 08
**Time:** ~65 minutes

## 学习目标

- 本地子进程选择 stdio，网络服务选择 Streamable HTTP。
- 实现现代的单端点、仅 POST 的 Streamable HTTP 契约。
- 对照 JSON-RPC 请求体镜像并校验 MCP 版本、方法和名称头部。
- 正确交付请求作用域的 SSE 与长连接的 `subscriptions/listen` 流。
- 在迁移基于会话的和旧版 HTTP+SSE 部署时，不将旧版行为冒充为现代行为。

## 问题所在

早期的 Streamable HTTP 修订版将协议协商与连接及会话行为混在一起。服务器可以签发 `Mcp-Session-Id`，暴露独立的 GET 流，接受 DELETE 以终止会话，并通过 `Last-Event-ID` 恢复 SSE。

MCP `2026-07-28` 从现代线路协议中移除了这些机制。每个请求都可以落到任意健康的工作进程上，因为其协议版本和客户端能力随请求体一起传输。HTTP 头部镜像选定的字段以用于路由和策略，但服务器在执行前会对照请求体校验这些头部。

其结果更易于扩展，也更易于推理。这也意味着，一个将 2025 传输层当作现行标准来讲授的服务器，正在传授错误的故障与安全模型。

## 核心概念

### stdio

stdio 绑定用于客户端启动的子进程：

- 客户端每行向 stdin 写入一条 UTF-8 JSON-RPC 消息。
- 服务器每行向 stdout 写入一条 UTF-8 JSON-RPC 消息。
- 服务器将诊断信息写入 stderr。
- 服务器在 stdin EOF 时立即退出。
- 每个现代请求都在 `params._meta` 中携带版本和客户端能力。

进程可能存活多次调用，但它不是现代协议会话。如果它意外退出，进行中的请求会丢失。重启进程、重新发现、重新列举、重新打开订阅，并用新的请求 id 重试安全操作。

### 2026-07-28 版的 Streamable HTTP

现代服务器暴露一个接受 POST 的 MCP 端点，例如 `/mcp`。

每个 JSON-RPC 请求或通知都是一个新的 HTTP POST。请求体包含一条 JSON-RPC 消息。客户端不向服务器发送 JSON-RPC 响应。

对于请求，服务器返回以下二者之一：

- `Content-Type: application/json`，携带一条 JSON-RPC 响应；或
- `Content-Type: text/event-stream`，携带与该请求相关的通知，随后是最终的 JSON-RPC 响应。

对于已接受的通知，服务器返回 `202 Accepted`，无响应体。

客户端同时声明两种响应类型：

```http
Accept: application/json, text/event-stream
```

### 仅 POST 就是仅 POST

现代 Streamable HTTP 没有独立的 GET 流，也没有 DELETE 会话端点。

- `GET /mcp` 返回 `405 Method Not Allowed`。
- `DELETE /mcp` 返回 `405 Method Not Allowed`。
- `Mcp-Session-Id` 被忽略，从不签发或回显。
- `Last-Event-ID` 被忽略，因为现代流不可恢复。

如果请求作用域的流在最终响应之前中断，客户端即丢失了该进行中的请求。在重试安全的情况下，它可以发出带有新 JSON-RPC id 的新请求。它绝不能尝试恢复流。

### Origin 校验

服务器对入站连接校验 `Origin` 以防止 DNS 重绑定。如果该头部存在且未被显式允许，返回 `403 Forbidden`。非浏览器客户端可以省略 `Origin`，这是官方传输规则所允许的。

本地服务器应绑定到 `127.0.0.1`，而不是所有网络接口。网络服务仍需在每个请求上进行身份验证和授权。Origin 校验不是身份验证。

在规范化配置之后使用精确的 origin 匹配。诸如 `origin.startswith("https://trusted.example")` 之类的前缀检查是不安全的，因为它们可能接受攻击者控制的后缀。

### 必需的 HTTP 元数据头部

每个现代 POST 请求都包含：

```http
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes_search
```

头部规则：

- `MCP-Protocol-Version` 为必需，且必须等于 `params._meta.io.modelcontextprotocol/protocolVersion`。
- `Mcp-Method` 为必需，且必须等于 JSON-RPC 的 `method`。
- `Mcp-Name` 对于 `tools/call`、`resources/read` 和 `prompts/get` 为必需。
- `Mcp-Name` 等于 `params.name`，对于 `resources/read` 则为 `params.uri`。
- 头部名称不区分大小写，但头部值区分大小写。

不安全或非 ASCII 的 `Mcp-Name` 值使用精确的 UTF-8 Base64 哨兵值：

```text
=?base64?{Base64EncodedValue}?=
```

服务器在将其与请求体比较之前会解码该值。

缺失、格式错误或不匹配的镜像头部返回 HTTP `400`，JSON-RPC 错误码为 `-32020`。如果头部和请求体在某个服务器不支持的版本上一致，返回 HTTP `400`，附带 `-32022` 和精确的错误数据，例如 `{"supported":["2026-07-28"],"requested":"2027-01-01"}`。

未知的现代方法返回 HTTP `404`，JSON-RPC 错误码为 `-32601`。JSON-RPC 请求体很重要，因为跨时代的客户端依赖它来区分现代错误与旧版端点未命中。

### 请求作用域的 SSE

对于某个长时间运行的请求，服务器可以选择 SSE：

```text
POST tools/call id=41
  <- notifications/progress related to id=41
  <- notifications/progress related to id=41
  <- JSON-RPC response id=41
stream closes
```

服务器不得在此流上发送独立的 JSON-RPC 请求。Sampling、elicitation 和 roots 交互使用 Multi Round-Trip Request 结果。关闭响应流即取消该请求。

不要为重放添加 SSE 事件 id。`Last-Event-ID` 恢复不属于现代修订版。

### 长期的变更使用 subscriptions/listen

变更通知使用客户端发起的请求，而非独立的 GET：

```json
{
  "jsonrpc": "2.0",
  "id": "listen-1",
  "method": "subscriptions/listen",
  "params": {
    "notifications": {
      "toolsListChanged": true,
      "resourceSubscriptions": ["notes://note-1"]
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "course-client",
        "version": "1.0.0"
      }
    }
  }
}
```

POST 响应是一个长连接的 SSE 流。它的第一条协议消息是 `notifications/subscriptions/acknowledged`。确认消息、每条变更通知以及最终结果都在 `_meta` 中携带 `io.modelcontextprotocol/subscriptionId`，其值等于 listen 请求的 id。服务器可以发出 SSE 注释作为保活信号。当流断开时，客户端用新的请求 id 重新发起 `subscriptions/listen`，并重新获取受影响的数据。

`resources/subscribe` 和 `resources/unsubscribe` 属于旧时代。不要在现代连接上使用它们。

### 显式的应用状态

移除协议会话并不意味着禁止有状态的工作流。服务器可以签发一个不透明的状态句柄，并作为普通的工具结果返回。客户端在后续调用中把该句柄作为显式参数传入。

将句柄绑定到已认证的主体，使其不可猜测，设置过期时间，并对每次使用进行授权。这样状态就在应用层可见，而不是隐藏在传输亲和性中。

隐藏的副本状态所导致的故障是机械性的：

1. 请求 A 到达副本 1，并在该进程的内存中创建了一个草稿。
2. 响应没有返回草稿句柄，因为实现假定连接本身就标识了草稿。
3. 请求 B 是一个全新的 POST，到达副本 2。
4. 副本 2 拥有有效的协议元数据，却无法命名或加载该草稿，因此工作流失败或读取了错误的本地对象。
5. 粘性路由看似修复了症状，直到一次重启、发布、重新调度或故障转移将下一个请求移走。

正确的边界有两个部分。协议上下文保留在每个请求中。持久的应用状态存放在共享存储中，由服务器签发句柄并返回给客户端。下一次调用提供该句柄，任意副本都能加载同一条记录，并且授权将该记录绑定到已认证的主体和租户。副本内存可以缓存记录，但它不能是保证正确性所必需的唯一副本。

按生命周期选择状态机制。请求局部变量可以服务单次调用。短期的 MRTR 延续可以使用完整性受保护的 `requestState`。草稿或持久任务需要显式句柄，外加共享持久化、过期机制、并发控制和幂等性。这些对象都不是 MCP 协议会话。

### HTTP 跨时代兼容

同时支持现代与旧版服务器的客户端会先尝试现代 POST。如果收到 HTTP `400`、`404` 或 `405`，它会检查响应体：

- 可识别的现代 JSON-RPC 错误证明服务器是现代的。修正请求或重试一个已声明的版本。不要降级。
- 空响应体或无法识别的响应可能表明这是一个旧版 HTTP+SSE 服务器。只有此时才尝试旧的 GET 端点，并期待其旧版 `endpoint` 事件。

在迁移期间，服务器可以通过将现代元数据路由到仅 POST 的现代实现，并为旧客户端保留单独的旧版端点，来同时支持两个时代。绝不要将旧版的 GET、DELETE、会话 id 或重放行为描述为 `2026-07-28` 的一部分。

```figure
tp-transport-handshake
```

## 实践

`code/main.py` 使用 Python 标准库实现了一个有限的、现代的 Streamable HTTP 服务器。它校验 Origin 和镜像头部，忽略已移除的会话头部，对普通调用返回 JSON，并演示了一个有限的 `subscriptions/listen` SSE 流。

```bash
cd code
python3 main.py --probe
python3 -m unittest discover tests -v
```

探针检查：

- 无效的 Origin 被拒绝；
- 无需会话 id 即可完成发现；
- `Mcp-Session-Id` 和 `Last-Event-ID` 被忽略；
- 头部不匹配返回 `-32020`；
- 不支持的版本返回 `-32022`，附带精确的 `supported` 和 `requested` 数据；
- 已接受的无 id 通知返回 HTTP `202`，无响应体；
- GET 和 DELETE 返回 `405`；
- `subscriptions/listen` 是一个 POST 响应流，其确认消息、通知和最终结果都携带其订阅 id。

## 上线

本课上线 `outputs/skill-mcp-transport-migrator.md`。它移除现代协议会话，增加头部-请求体校验，用 `subscriptions/listen` 取代独立的 GET，并将任何旧版桥接明确地保持分离。

## 练习

1. 从一个 POST 中移除 `Mcp-Method`。确认返回 HTTP `400` 和错误 `-32020`。
2. 发送头部与请求体版本一致但为 `2027-01-01` 的请求。确认返回 HTTP `400`、错误 `-32022` 以及精确数据 `{"supported":["2026-07-28"],"requested":"2027-01-01"}`。
3. 为一个非 ASCII 资源 URI 发送 Base64 哨兵值 `Mcp-Name`。确认解码后的值与 `params.uri` 进行了比较。
4. 在有限的 listen 流的最终响应之前将其中断。用新的 JSON-RPC id 重新发起，并重新获取工具。
5. 为 ping 工具添加一个显式的工作流句柄。将其绑定到一个授权主体，而不使用连接亲和性。

## 关键术语

| 术语 | 含义 |
|------|---------|
| stdio | 在客户端启动的子进程上按行分隔的 JSON-RPC |
| Streamable HTTP | 单端点，每条现代消息都是一个新的 POST |
| 请求作用域的 SSE | 包含相关通知和最终响应的 POST 响应流 |
| `subscriptions/listen` | 用于订阅变更通知的长连接 POST 请求 |
| 头部不匹配 | 镜像头部与请求体不一致时的 HTTP `400` 和 JSON-RPC `-32020` |
| Origin 校验 | 针对入站连接的 DNS 重绑定防御，不是身份验证 |
| 显式状态句柄 | 作为普通参数传递的应用令牌，而非隐藏的会话状态 |
| 旧版桥接 | 仅为兼容性而保留的早期时代行为 |

## 延伸阅读

- [MCP Transport Overview](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)
- [MCP stdio Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Subscriptions](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions)
- [MCP 2026-07-28 Changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)