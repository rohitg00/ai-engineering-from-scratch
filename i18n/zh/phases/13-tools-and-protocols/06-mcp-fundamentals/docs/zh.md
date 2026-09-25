# MCP 基础：无状态请求与 JSON-RPC

> 现代 MCP 没有握手，也没有协议会话。每个请求必须自带足够的元数据，使其能够被独立地理解、授权、路由和重试。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 13, 第 01 至 05 课
**Time:** 约 55 分钟

## 学习目标

- 区分 MCP 的服务器原语与客户端侧特性。
- 为 MCP `2026-07-28` 构建合法的 JSON-RPC 2.0 请求与响应。
- 在每个请求中附加协议版本、客户端能力与客户端身份。
- 使用 `server/discover`，并在没有握手的情况下处理 `UnsupportedProtocolVersionError`。
- 跟踪一个独立请求从校验到完整结果的全过程。

## 问题所在

一个 MCP 服务器可能在同一个进程或 HTTP worker 上，接连收到来自不同客户端、具备不同能力的两个请求。如果服务器记住了上一个请求所声明的内容，就可能应用错误的权限或返回错误的线上格式。

MCP `2026-07-28` 消除了这种歧义。协议核心是无状态的。服务器必须依据当前请求本身来决定如何处理当前请求，而不是依据连接历史。

这改变了心智模型。旧的顺序是先连接、再握手、最后操作。现代顺序更简单：

1. 客户端发送一个自描述的请求。
2. 服务器校验该请求的版本与能力。
3. 服务器处理该方法。
4. 服务器返回一个带类型的结果或 JSON-RPC 错误。

下一个请求从头重复同样的过程。

## 概念

### 服务器原语

MCP 服务器暴露三个主要原语：

1. **Tools** 是由模型控制的操作，通过 `tools/list` 发现，通过 `tools/call` 调用。
2. **Resources** 是以 URI 寻址的数据，通过 `resources/list` 发现，通过 `resources/read` 获取。
3. **Prompts** 是可复用的模板，通过 `prompts/list` 发现，通过 `prompts/get` 渲染。

Roots、sampling 和 logging 仍保留在 `2026-07-28` 模式中以保持兼容，但已被弃用。新实现应使用显式的工具或资源输入来处理 roots，使用直接的模型提供商 API 处理 sampling，使用 stderr 或 OpenTelemetry 处理 logging。Elicitation 仍可通过 Multi Round-Trip Requests 实现：服务器返回一个输入请求，客户端随后重试原始操作。现代服务器绝不发起独立的 JSON-RPC 请求。

### JSON-RPC 信封

MCP 使用 JSON-RPC 2.0：

- 请求：`{jsonrpc, id, method, params}`
- 响应：`{jsonrpc, id, result}` 或 `{jsonrpc, id, error}`
- 通知：`{jsonrpc, method, params}`，且没有 `id`

请求的 `id` 关联唯一一个响应。它并不创建协议会话。

### 必需的请求元数据

每个现代请求都在 `params` 中携带一个 `_meta` 对象：

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/list",
  "params": {
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

协议版本和客户端能力是必需的。客户端身份是推荐的。它是自报告的显示与调试数据，不是安全凭证。

服务器不得从更早的请求、stdio 进程、HTTP 连接或仅凭传输层头部推断这些值中的任何一个。

### 完整结果与服务器身份

每个成功的现代结果都包含 `resultType`。普通的最终结果使用 `"complete"`。服务器还应在结果元数据中标识自身：

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "resultType": "complete",
    "tools": [],
    "ttlMs": 30000,
    "cacheScope": "public",
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "notes-server",
        "version": "1.0.0"
      }
    }
  }
}
```

`tools/list`、`resources/list`、`prompts/list`、`resources/templates/list`、`resources/read` 和 `server/discover` 是可缓存的结果。它们包含 `ttlMs` 和 `cacheScope`。一个安全的默认值是 `ttlMs: 0` 和 `cacheScope: "private"`。列表项应当具有确定性排序，使等价的响应产生稳定的缓存键和稳定的模型上下文。

### 无握手的发现

每个现代服务器必须实现 `server/discover`。客户端可以在调用其他方法之前调用它来获取：

- `supportedVersions`
- 服务器 `capabilities`
- 可选的使用说明 `instructions`
- 结果 `_meta` 中的服务器身份
- 缓存提示

发现机制很有用，但它不是门槛。客户端可以先发送 `tools/list`，因为该请求本身已经携带了协议版本和能力。

如果请求的版本不受支持，服务器返回 JSON-RPC 错误码 `-32022`，内容为：

```json
{
  "requested": "2027-01-01",
  "supported": ["2026-07-28"]
}
```

客户端选择一个双方都支持的现代版本，并使用新的 JSON-RPC 请求 id 重试。

### 单个请求的生命周期

按以下顺序跟踪一个现代请求：

1. 解析一个 JSON-RPC 信封。
2. 确认 `jsonrpc` 是 `"2.0"`，存在 `id`，`method` 是字符串，且 `params` 是对象。
3. 要求 `params._meta` 中的版本字符串和能力对象；元数据格式错误或缺失即为 `-32602`。
4. 在 HTTP 边界处，将头部中的版本、方法和适用的名称字段与请求体比较。即使其中一个版本值不受支持，不匹配也判定为 `-32020`。
5. 在确认一致性之后，对已匹配但不受支持的版本以 `-32022` 拒绝。
6. 检查必需的能力，然后按 `method` 路由并校验方法特定的参数。
7. 在处理器运行之前对具体操作进行认证与授权。
8. 返回带服务器身份的完整结果。
9. 丢弃请求作用域的协议元数据。

这一顺序防止两个组件对不同的调用做出解释。网关不得在源站执行 `params.name: notes.delete` 的情况下对 `Mcp-Name: notes.read` 进行授权。它还使格式错误的输入、头部混淆、版本协商、能力失败、授权失败和处理器失败成为彼此可区分的证据。

关闭 stdin 或 HTTP 响应只会结束传输活动。它不会终止协议会话，因为现代 MCP 没有协议会话。

### 明确的旧版兼容性

`2025-11-25` 及更早版本使用 `initialize`、`notifications/initialized`、连接作用域的能力，以及在早期 Streamable HTTP 上的可选协议会话。当双时代客户端与旧服务器通信时，这些行为仍然相关。

保持两个时代相互独立。现代请求由必需的每请求元数据标识。旧版连接只能通过文档化的回退路径选择。不要向 `2026-07-28` 服务器默认发送 `initialize`。

因此，"无状态"具有时代特定的含义。在 `2026-07-28` 中，它是协议不变量：每个普通请求都可被独立解释，且不存在任何 MCP 会话。在 `2025-11-25` 及更早版本中，初始化与协商的能力属于连接，因此兼容性适配器可以保留这种旧版连接状态。双时代实现不是一个宽松的状态机。它是一个无状态的现代核心，旁边挂着一个隔离的旧版适配器，并在任一解析器运行之前做出显式的选择决策。

这两种含义都不禁止持久的应用状态。工作流、任务或草稿可以以不透明句柄的形式存放在共享存储中。客户端将该句柄作为普通输入发送，每个副本都对其使用进行认证与授权。协议上下文绝不能作为被移除的会话的替代品泄漏到该存储中。

```figure
mcp-tool-call
```

## 使用它

`code/main.py` 在不依赖框架的情况下构建、校验、跟踪和分发现代 MCP 消息。运行：

```bash
python3 code/main.py
python3 -m unittest discover code/tests -v
```

在输出中关注三个不变量：

- 每个请求都重复其 `_meta` 字段。
- 每个成功的结果都是 `resultType: "complete"`，并包含服务器身份。
- 列表结果具有确定性排序，并带有显式的缓存提示。

## 发布它

本课发布 `outputs/skill-mcp-handshake-tracer.md`。历史文件名保持不变，但该产物现在是一个无状态请求跟踪器。它独立审计每条消息，并且仅当旧版握手流量真实存在时才标记它。

## 练习

1. 将某个请求的协议版本改为 `2027-01-01`。确认错误码是 `-32022`，且 data 中声明了受支持的版本。
2. 从第二个请求中移除 `io.modelcontextprotocol/clientCapabilities`。确认服务器没有复用第一个请求的能力。
3. 反转内存中的工具注册表。确认 `tools/list` 仍返回相同的确定性顺序。
4. 将 `cacheScope` 从 `public` 改为 `private`。解释每种情况下哪些授权上下文可以复用该响应。
5. 添加一个可选的 `clientInfo` 缺失测试。请求应仍然有效，因为客户端身份是推荐的，而非必需的。

## 关键术语

| 术语 | 含义 |
|------|---------|
| 无状态协议 | 每个请求都自带解释它所需的元数据 |
| 请求元数据 | `params._meta` 中的版本、客户端能力以及推荐的客户端身份 |
| `server/discover` | 强制的服务器方法，用于获取版本、能力、说明与身份 |
| `resultType` | 每个成功的现代结果上的判别字段 |
| 可缓存结果 | 包含必需的 `ttlMs` 和 `cacheScope` 提示的结果 |
| 协议时代 | 现代的每请求元数据，或旧版的连接作用域初始化 |
| 传输生命周期 | 进程、连接或响应流的生命周期，而非协议会话状态 |
| `-32022` | 不支持的协议版本错误，附带请求的版本与受支持的版本 |

## 延伸阅读

- [MCP Architecture](https://modelcontextprotocol.io/specification/2026-07-28/architecture)
- [MCP Base Protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic)
- [MCP Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP 2026-07-28 Changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)