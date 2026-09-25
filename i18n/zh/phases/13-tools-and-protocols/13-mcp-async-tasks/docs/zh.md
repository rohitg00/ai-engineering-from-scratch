# MCP Tasks 扩展：在无状态核心之上实现持久化工作

> 无状态 MCP 并不意味着每个操作必须在一次请求内完成。官方 Tasks 扩展为长时间运行的工作提供了显式的持久化句柄。服务端可以从 `tools/call` 返回该句柄，任何实例都可以响应 `tasks/get`,客户端输入通过 `tasks/update` 到达，而无需复活协议会话。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13 · 09(transports)、Phase 13 · 11(stateless MRTR)、Phase 13 · 12(elicitation)
**Time:** ~90 分钟

## 学习目标

- 区分无状态协议传输与持久化的应用任务状态。
- 在每请求能力和 `server/discover` 中协商 `io.modelcontextprotocol/tasks` 扩展。
- 仅在持久化创建完成后，才返回服务端主导的 `CreateTaskResult` 以及 `resultType: "task"`。
- 使用 `tasks/get` 轮询，通过 `tasks/update` 提交任务输入，通过 `tasks/cancel` 请求协作式取消。
- 移除旧的 `tasks/status`、`tasks/result` 和 `tasks/list` 假设。
- 通过 POST 响应 SSE 流上的 `subscriptions/listen` 订阅可选的任务通知。
- 正确建模任务过期、重启恢复、输入键去重以及执行错误。

## 为什么 Tasks 是一个扩展

Tasks 最初于 2025-11-25 作为实验性核心特性出现。2026 年 7 月的重设计将其移入官方的 `io.modelcontextprotocol/tasks` 扩展，使客户端与服务端可以选择启用这一额外的生命周期，而无需为所有人扩展核心协议。

尽管 Tasks 目前由该扩展官方承载，扩展规范仍处于草案状态。请锁定你的 SDK 所支持的扩展版本，运行一致性测试场景，并将线上传输适配器与你的 worker 和存储领域隔离开来。

当操作具备以下一项或多项特征时，使用任务：

- 它可能超出普通请求超时时间。
- 执行已由 worker 队列或外部作业系统接管。
- 客户端需要在自身重启后恢复。
- 操作在执行期间暂停等待用户或模型输入。
- 取消与持久化结果获取是产品需求。

不要为廉价的确定性查询创建任务。句柄、持久化、轮询、过期与取消都是实实在在的复杂度。

## 无状态核心，有状态应用

MCP 2026-07-28 移除了 `initialize`、`notifications/initialized`、协议会话以及 `Mcp-Session-Id`。但这并不禁止有状态的产品。

任务 id 是显式的应用状态：

- 服务端在返回之前先持久化它。
- 客户端可以存储它并在重启后再次轮询。
- 该 id 可以路由到由同一持久化存储支撑的任意副本。
- 每个任务方法都会进行授权检查。
- 过期与删除由任务字段定义，而非传输层生命周期。

这与附着在连接上的隐藏状态在运维层面截然不同。

请将四种生命周期分开管理：

| 状态 | 生命周期 | 归属位置 |
|---|---|---|
| 协议元数据 | 单次请求 | `params._meta`,每次调用时重新校验 |
| 传输层工作 | 单个 stdio 请求或 HTTP 响应 | 具有有界截止时间的在途协调器 |
| MRTR 续传 | 单个重试序列 | 受完整性保护的 `requestState`,必要时加上重放控制 |
| 持久化任务 | 跨请求、副本、重启与重连 | 由经过授权的 `taskId` 作为键的共享应用存储 |

把任务记录移入进程内存并不会让 MCP 变成有状态。它只会让应用变得不可靠。协议保持无状态，但之后路由到另一个副本的 `tasks/get` 无法找回该记录。在返回句柄之前先持久化，然后让每个任务方法在租户与主体校验之下解析同一条共享记录。

## 能力协商

客户端在每个符合条件的请求上声明支持：

```json
{
  "_meta": {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {
      "extensions": {
        "io.modelcontextprotocol/tasks": {}
      }
    },
    "io.modelcontextprotocol/clientInfo": {
      "name": "lesson-client",
      "version": "1.0.0"
    }
  }
}
```

服务端从 `server/discover` 返回精确的 `supportedVersions`、能力、`ttlMs` 和 `cacheScope`,并在 capabilities 中携带相同的扩展。由于它声明了工具，它还必须实现强制的 `tools/list`。该结果返回确定性的 `generate_report` 描述符、有效的对象 `inputSchema`、`resultType: "complete"`、服务端身份元数据以及公共缓存提示。

未声明该扩展的客户端调用任务方法会返回 `-32021`(Missing Required Client Capability),并将 `data.requiredCapabilities` 设为 `{"extensions":{"io.modelcontextprotocol/tasks":{}}}`。不支持的协议字符串返回 `-32022`,并附带精确的 `supported` 与 `requested` 数据；缺失或非字符串的版本返回 `-32602`。

没有 JSON-RPC `id` 的信封是一条通知。接收方可以处理它，但不会发出 JSON-RPC 结果或错误。Streamable HTTP 适配器对于已接受的通知返回 `202 Accepted` 且无响应体。

目前，只有 `tools/call` 支持任务增强的执行。请设计你的内部抽象，使未来的请求类型无需重写存储。

## 服务端主导的任务创建

旧的客户端标志 `params._meta.task.required` 已被移除。客户端声明扩展支持，然后由服务端决定某个特定的 `tools/call` 是否成为任务。

请求：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "generate_report",
    "arguments": {"size": "large"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

响应：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "task",
    "taskId": "tsk_786512e29e0d",
    "status": "working",
    "statusMessage": "Preparing report outline.",
    "createdAt": "2026-08-21T10:30:00Z",
    "lastUpdatedAt": "2026-08-21T10:30:00Z",
    "ttlMs": 900000,
    "pollIntervalMs": 1000
  }
}
```

在该 id 的 `tasks/get` 可以解析之前，服务端不得返回此句柄。在使用最终一致性存储时，应在应答之前等待读取可见性。否则，客户端可能收到一个看似有效的 id,却立即得到"not found"。

任务响应是“未经请求”的，意思是客户端并未请求任务模式。但它并非未经协商：当前请求仍然必须声明该扩展。

## 任务的结构

每个任务都携带：

- `taskId`:稳定的服务端生成的标识符；
- `status`:`working`、`input_required`、`completed`、`cancelled` 或 `failed`;
- `createdAt` 与 `lastUpdatedAt`:ISO 8601 时间戳；
- `ttlMs`:创建时设置的过期时长，或 `null` 表示未声明限制；
- 可选的 `pollIntervalMs`:服务端当前建议的最小轮询节奏；
- 可选的 `statusMessage`:面向用户或面向模型的上下文。

状态专属字段仅在相关时出现：

- `input_required` 包含 `inputRequests`。
- `completed` 包含原始请求的 `result` 形态。
- `failed` 包含 JSON-RPC `error` 对象。

客户端应当遵守 `pollIntervalMs`。服务端可以对更激进的轮询进行限速，并可在任务生命周期内更改该间隔。

## 使用 `tasks/get` 轮询

客户端请求当前快照：

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/get
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tasks/get",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

`tasks/get` 本身已完成，因此其结果始终包含 `resultType: "complete"`。嵌套任务仍可能处于 `status: "working"` 或 `status: "input_required"`。

这一区分可以防止一个常见的解析错误：

```text
result.resultType = complete    means the tasks/get RPC finished
result.status = working        means the represented job is still running
```

不存在 `tasks/result` 调用。当任务完成时，下一个 `tasks/get` 响应会在 `result` 下内联原始的 `CallToolResult`:

```json
{
  "resultType": "complete",
  "taskId": "tsk_786512e29e0d",
  "status": "completed",
  "createdAt": "2026-08-21T10:30:00Z",
  "lastUpdatedAt": "2026-08-21T10:34:12Z",
  "ttlMs": 900000,
  "result": {
    "resultType": "complete",
    "content": [
      {"type": "text", "text": "Generated large report with approved outline."}
    ],
    "structuredContent": {"size": "large", "approved": true},
    "isError": false,
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "tasks-demo",
        "version": "1.0.0"
      }
    }
  },
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "tasks-demo",
      "version": "1.0.0"
    }
  }
}
```

外层的 `resultType` 表示 `tasks/get` RPC 已完成。嵌套的 `result.resultType` 表示原始工具调用已完成。该嵌套判别字段是必需的。嵌套的 `CallToolResult` 还应当(Should)携带自己的 `io.modelcontextprotocol/serverInfo`;本课包含它，而不是存储一个无类型载荷。

不存在 `tasks/list`。无会话的服务器无法安全地推断哪些任务属于某个连接作用域的列表。需要历史记录的应用应当暴露一个带显式过滤器和所有权规则的、经过授权的领域工具。

## 任务执行期间的输入

任务输入与核心 MRTR 看似相似，但使用不同的续传机制。

### 任务创建之前需要输入

从原始 `tools/call` 返回核心的 `resultType: "input_required"`。客户端完成该输入并重试原始调用。只有在这些同步 MRTR 轮次完成后，才创建任务。

### 任务创建之后需要输入

将任务置为 `input_required`。`tasks/get` 暴露未完成的 `inputRequests`,客户端通过 `tasks/update` 发送响应。客户端不重试原始的 `tools/call`。

快照：

```json
{
  "resultType": "complete",
  "taskId": "tsk_786512e29e0d",
  "status": "input_required",
  "createdAt": "2026-08-21T10:30:00Z",
  "lastUpdatedAt": "2026-08-21T10:31:00Z",
  "ttlMs": 900000,
  "inputRequests": {
    "approve_outline": {
      "method": "elicitation/create",
      "params": {
        "mode": "form",
        "message": "Approve the generated report outline?",
        "requestedSchema": {
          "type": "object",
          "properties": {"approved": {"type": "boolean"}},
          "required": ["approved"]
        }
      }
    }
  }
}
```

更新：

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/update
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tasks/update",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "inputResponses": {
      "approve_outline": {
        "action": "accept",
        "content": {"approved": true}
      }
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

成功响应是一个空的确认加上 `resultType: "complete"`。状态变更可能是最终一致的，因此客户端应继续轮询或监听。

每个 `inputRequests` 键在整个任务生命周期内必须唯一。重复的 `tasks/get` 快照可能显示相同的未完成键；客户端应在 UI 中去重，服务端应忽略针对未知、已被取代或已完成的键的响应。部分更新可能使任务停留在 `input_required` 状态，直到所有必需的键都被应答。

## 取消是协作式的

`tasks/cancel` 表达意图并返回一个空的完成确认。该确认并不保证 worker 已经停止。工作可能先行完成、忽略取消，或在之后才发生转换。

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/cancel
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tasks/cancel",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

对于所有三个任务方法，`Mcp-Name` 镜像 `params.taskId`。它不重复 JSON-RPC 方法名。`code/main.py` 在 `make_http_request` 中集中规定了这一规则。

本课的 worker 立即响应取消，使重复调用具有幂等性。生产环境的客户端仍必须将取消视为协作式的，而不是从确认中推断任务的最终状态。

不要使用 `notifications/cancelled` 来取消任务。该通知属于请求取消，而非持久化的 Tasks。

这一区别在路由边界处至关重要。请求取消针对的是一个在途的 JSON-RPC 操作或其请求作用域的 HTTP 响应。如果 `tools/call` 已经返回了 `resultType: "task"`,则该请求已经完成，关闭其传输层既无法指名也无法停止该持久化作业。`tasks/cancel` 是一个新的、经过授权的 RPC。它携带 `params.taskId`,在 `Mcp-Name` 中镜像该 id,解析任务所属的后端，记录协作式取消意图，并返回一个确认——而不声称 worker 已经停止。

因此，网关必须将请求协调器与任务路由保存在不同的表中。请求表可以在响应完成后消失。而任务路由必须存活至终止状态与保留期届满。[Lesson 29: MCP Reliability, Cancellation, and Flow Control](../../29-mcp-reliability-cancellation-and-flow-control/docs/en.md) 为这两条路径构建了竞态、超时、幂等性、背压与重试规则。

## 可选通知

轮询是基线。希望获得推送更新的客户端发送 `subscriptions/listen` 并附带任务 id。对于 Streamable HTTP,这是一个 POST,其响应是请求作用域的 SSE 流。不存在独立的 GET 事件流，也没有需要维持的协议会话。

服务端通过 `notifications/subscriptions/acknowledged` 确认已接受的 id,然后可以通过 `notifications/tasks` 发送完整快照。该确认以及每条任务通知都在 `_meta` 中携带 `io.modelcontextprotocol/subscriptionId`,其值等于 `subscriptions/listen` 请求 id。除此之外，每条任务通知在语义上等同于 `tasks/get` 在该时刻会返回的内容。

客户端仍必须声明 Tasks 扩展。它们应当从持久化的任务 id 进行重连与恢复，而不是依赖事件重放或 `Last-Event-ID`。

## 失败语义

正确使用两个错误层次。

### 协议错误

无效的方法参数或未知的任务 id 返回 JSON-RPC 错误，通常是 `-32602`。缺少扩展支持返回 `-32021`,并附带所需的能力对象。

### 任务执行结果

- 带有 `isError: true` 的正常工具结果仍然是一个 `completed` 任务，因为该工具调用产生了其定义的结果。
- 延迟执行期间的 JSON-RPC 错误使任务变为 `failed`,并将该 JSON-RPC 错误存储在 `error` 下。
- 用户拒绝可能产生 `cancelled`、一个已完成的拒绝结果，或另一个领域特定的安全结果。请记录你的选择。

## 持久化、过期与所有权

至少持久化以下内容：任务 id、状态、时间戳、ttl、轮询间隔、原始操作的所有权、结果或错误、未完成的输入请求，以及所有已发出的输入键。

存储键必须包含或可解析出一个权威的租户与主体。知道一个任务 id 不得赋予访问权限。在每次 `tasks/get`、`tasks/update`、`tasks/cancel` 以及订阅时都检查所有权。

`ttlMs` 从创建时刻起计算，并且可能变化。当任务停止产生可观察的更新时，客户端可以将其作为兜底。服务端可以将过期任务标记为失败并稍后删除。不要把它描述为“完成后该结果保留那么多毫秒”的承诺。

使用原子写入或事务。本课写入一个临时文件并原子性地重命名它。多副本服务应当使用共享的持久化存储以及 worker 租约或等效的并发控制。

```figure
tp-task-lifecycle
```

## 构建它

`code/main.py` 实现了一个确定性的任务服务：

- `server/discover` 返回 `supportedVersions`、缓存提示以及 Tasks 扩展。
- `tools/list` 返回确定性的、可缓存的 `generate_report` 描述符，并带有有效的输入 schema。
- `tools/call` 在返回 `resultType: "task"` 之前创建并持久化任务。
- 一个新的服务实例重新加载同一任务，演示重启恢复。
- `tasks/get` 返回完整的任务快照。
- worker 从 `working` 推进到 `input_required`。
- `tasks/update` 接受表单响应并返回一个空的完成确认。
- worker 存储一个嵌套的 `CallToolResult`,带有其自身的 `resultType` 与服务端身份，然后转换到 `completed`。
- `tasks/cancel` 在本实现中是幂等的。
- HTTP 构建器针对 `tasks/get`、`tasks/update` 和 `tasks/cancel` 将 `Mcp-Name` 设为 `params.taskId`。
- 通知辅助函数使用 `notifications/subscriptions/acknowledged` 与 `notifications/tasks`,两者都带有监听请求 id 标签。
- 无 id 的通知不产生 JSON-RPC 响应。

worker 显式推进状态，而不是在后台线程中休眠。这使得每个状态转换都是确定性的，并将协议示例与队列机制分离开来。

## 使用它

在仓库根目录下：

```bash
cd phases/13-tools-and-protocols/13-mcp-async-tasks/code
python3 main.py
python3 -m unittest discover tests -v
```

预期的结果序列：

```text
id=0 resultType=complete status=ack
id=1 resultType=task status=working
id=2 resultType=complete status=working
id=3 resultType=complete status=input_required
id=4 resultType=complete status=ack
id=5 resultType=complete status=completed
```

同时验证 `tasks/status`、`tasks/result` 与 `tasks/list` 在现代服务中返回 method-not-found。
验证 `tools/list` 是确定性的，并且当前每个 HTTP 任务方法都通过 `Mcp-Name` 镜像其任务 id。

## 发布它

`outputs/skill-task-store-designer.md` 现在产生一个扩展感知的设计：能力协商、返回前持久化创建、现行方法、输入更新流程、所有权、过期、取消、订阅，以及从已移除的实验性方法的迁移。

## 练习

1. 添加第二个未完成的输入键。发送一个部分的 `tasks/update`,并证明任务在两个键都被应答之前保持 `input_required`。
2. 为存储添加租户所有权，并拒绝由错误认证主体提交的有效任务 id。
3. 添加带过期时间的 worker 租约。证明两个服务实例无法并发完成同一任务。
4. 为 `subscriptions/listen` 实现一个 POST 响应 SSE 适配器。不要添加 GET、`Last-Event-ID` 或会话头。
5. 添加过期清理。在不泄露跨租户存在性的前提下，区分过期任务与格式错误的任务 id。

## 关键术语

| 术语 | 在现行扩展中的含义 |
|------|----------------------------------|
| Tasks 扩展 | 用于持久化异步工作的可选 `io.modelcontextprotocol/tasks` 能力 |
| `CreateTaskResult` | 针对符合条件的请求的服务端主导的 `resultType: "task"` 响应 |
| `tasks/get` | 轮询完整的当前任务快照，包括终止结果或待处理输入 |
| `tasks/update` | 提交对任务未完成 `inputRequests` 的响应 |
| `tasks/cancel` | 确认协作式取消意图 |
| `input_required` | 表示客户端输入未完成的任务状态 |
| `pollIntervalMs` | 服务端建议的下一次轮询前的最小延迟 |
| `ttlMs` | 从任务创建时刻起计算的过期时长 |
| 返回前持久化 | 规定在发送句柄之前任务 id 必须可解析的规则 |
| `notifications/tasks` | 在已订阅的 SSE 响应上投递的可选完整任务快照 |

## 遗留兼容性

2025-11-25 的实验性接口使用了客户端请求的任务增强、`tasks/status`、`tasks/result` 以及可选的 `tasks/list`。仅在锁定的遗留适配器内部保留这些名称。现代客户端使用扩展能力、接受服务端主导的句柄、轮询 `tasks/get`、通过 `tasks/update` 提供输入，并从任务快照读取最终结果。

## 延伸阅读

- [官方 MCP Tasks 扩展](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)