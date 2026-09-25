# 模型上下文协议(MCP)

> MCP 为 AI 宿主提供了一个统一的协议,用于发现和调用工具、资源与提示词。2026-07-28 修订版使该协议变为无状态:能力与版本上下文随每个请求传递,而不是通过绑定连接的握手交换。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 11 · 09(Function Calling)、Phase 11 · 03(Structured Outputs)
**Time:** 约 75 分钟

## 学习目标

- 区分 MCP 宿主、客户端、服务器、传输层与服务器原语。
- 构建包含 MCP 2026-07-28 所需元数据的 JSON-RPC 请求。
- 使用 `server/discover` 检查版本、身份与能力。
- 从工具、资源和提示词返回带类型且支持缓存的结果。
- 解释现代无状态 MCP 如何与握手时代的服务器互操作。
- 为服务器选择安全的状态、传输与审批边界。

## 问题所在

你的应用需要数据库查询、日历操作和文件读取。如果没有共享协议,每个 AI 宿主都需要为这些相同的能力定制发现、调用、错误处理、传输与授权的胶水代码。

MCP 缩减了这一集成矩阵。服务器发布标准的 JSON-RPC 接口。符合规范的客户端可以发现该接口、将其呈现给模型或用户、调用它并解释结果,而无需针对特定服务器的适配器。

一个重要的边界很容易被忽略。MCP 标准化的是通信。它不决定模型应该调用哪个工具,不使不可信内容变得安全,也不把无状态请求转化为持久的应用状态。这些决策仍由你的宿主和服务器负责。

## 核心概念

![MCP host, stateless request, and server primitives](../assets/mcp-architecture.svg)

### 三种服务器原语

1. **Tools** 是可调用的操作。每个工具有名称、描述、JSON Schema 输入和处理函数。
2. **Resources** 是可通过 URI 寻址、客户端可以读取的命名内容。
3. **Prompts** 是宿主可以暴露给用户的可复用模板。

宿主是 AI 应用。宿主内的 MCP 客户端与一台服务器通信。传输层在两者之间承载 JSON-RPC 消息。

### 无状态请求取代握手

MCP 2026-07-28 移除了 `initialize` 和 `notifications/initialized`。它也移除了协议层面的会话。每个请求在 `params._meta` 中携带解释该请求所需的上下文:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

协议版本和客户端能力是必需的。建议提供客户端身份。缺失的 `_meta`、缺失的必需字段,或类型错误的必需字段都属于格式错误,会返回 Invalid Params(`-32602`)。格式正确但服务器不支持的版本字符串会返回 `UnsupportedProtocolVersionError`(`-32022`)。服务器可以在不恢复先前协商记录的情况下处理有效请求。

无状态并不意味着应用永远不能维护状态。它意味着状态不隐藏在 MCP 连接或 `Mcp-Session-Id` 之后。如果工作流需要连续性,服务器会生成一个不透明句柄,客户端在后续调用中将该句柄作为普通工具参数传递。授权仍必须在每个请求上检查。

### 发现与版本选择

每个现代服务器都实现 `server/discover`。其结果声明支持的版本、能力和服务器身份:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "complete",
    "supportedVersions": ["2026-07-28"],
    "capabilities": {
      "tools": {},
      "resources": {},
      "prompts": {}
    },
    "ttlMs": 3600000,
    "cacheScope": "public",
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "demo-server",
        "version": "1.0.0"
      }
    }
  }
}
```

客户端可以直接调用其他方法并处理版本错误,但发现机制使能力展示和版本选择变得显式。不支持的版本会返回 `UnsupportedProtocolVersionError`,代码为 `-32022`。其数据包含 `supported`(服务器修订版列表)和 `requested`(被拒绝的修订版)。

在 stdio 上,双时代客户端用 `server/discover` 探测。发现结果或可识别的现代错误(如 `UnsupportedProtocolVersionError`)表明这是现代服务器。任何未被识别为现代的错误或超时都允许回退到 2025-11-25 的 `initialize` 流程。旧版行为是兼容性代码,而非现代默认路径。

### 结果是显式的

每个核心 2026-07-28 结果都包含 `resultType`:

- `complete` 表示操作已完成。
- `input_required` 表示服务器需要按照 Multi Round-Trip Requests 模式进行另一次往返。核心服务器只能从 `tools/call`、`resources/read` 或 `prompts/get` 返回它。

客户端必须将省略 `resultType` 的旧版结果视为已完成。

服务器应在每个结果的 `_meta` 中包含 `io.modelcontextprotocol/serverInfo`。此身份是自报告的,用于展示、日志记录和调试,而非安全决策。

列表和读取结果还携带 `ttlMs` 和 `cacheScope`。确定性的 `tools/list` 顺序加上新鲜度提示,让客户端可以安全地缓存发现结果,并提升提示词缓存的稳定性。`cacheScope: public` 允许共享缓存;`private` 将复用限制在调用上下文内。

### 线上格式与传输

MCP 在 stdio 或 Streamable HTTP 上使用 JSON-RPC 2.0。

- 请求包含 `jsonrpc`、`id`、`method` 和 `params`。
- 响应包含匹配的 `id` 以及 `result` 或 `error`。
- 通知没有 `id`,也不期待响应。

现代 Streamable HTTP 暴露一个接受 POST 的端点。每条 JSON-RPC 消息有各自的 POST。请求 POST 接收单个 JSON 对象或一个以最终响应结尾的请求级 Server-Sent Events 流。被接受的通知 POST 返回 HTTP 202 且无响应体;本核心修订版在 Streamable HTTP 上不定义任何客户端到服务器的通知。

2026-07-28 中没有独立的 MCP GET 流、DELETE 会话端点、`Mcp-Session-Id` 或 `Last-Event-ID` 重放。长期存在的变更通知使用 `subscriptions/listen` POST,其响应作为 SSE 流保持打开。

### 无服务器发起请求的客户端输入

旧版修订版允许服务器在流上发送诸如 `sampling/createMessage`、`roots/list` 或 `elicitation/create` 之类的请求。当前协议改用 Multi Round-Trip Requests。符合条件的工具调用、资源读取或提示词获取会返回 `resultType: input_required`,其中至少包含 `inputRequests` 或 `requestState` 之一。客户端收集所有被请求的输入,使用新的 JSON-RPC ID 和对应的 `inputResponses` 重试原始方法,并在提供了 `requestState` 时原样回显。如果没有 `inputRequests`,重试时省略 `inputResponses`。

Roots、Sampling 和 Logging 仍然可用但已弃用,新实现不应采用它们。现有的 Roots 或 Sampling 请求在 MRTR `inputRequests` 内传递,绝不作为独立的服务器到客户端 JSON-RPC 请求。优先使用显式的文件或目录参数、资源 URI、服务器配置以及直接的模型提供商集成。stdio 诊断输出使用 stderr,生产遥测使用 OpenTelemetry。

```figure
mcp-nxm-collapse
```

## 动手构建

### 步骤 1:注册服务器接口

尽管请求契约改变了,注册仍然简单:

```python
server = MCPServer("demo-server")

@server.tool(
    "add",
    "Add two integers.",
    {
        "type": "object",
        "properties": {
            "a": {"type": "integer"},
            "b": {"type": "integer"}
        },
        "required": ["a", "b"]
    }
)
def add(a: int, b: int) -> dict:
    return {"sum": a + b}
```

`code/main.py` 中随附的实现还注册了一个资源和一个提示词。它刻意使用标准库,让你能看清每个信封,而不是将协议委托给 SDK。

### 步骤 2:为每个请求附加元数据

```python
def request(method, params=None):
    body_params = dict(params or {})
    body_params["_meta"] = {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
        "io.modelcontextprotocol/clientInfo": {
            "name": "demo-client",
            "version": "1.0.0"
        }
    }
    return {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": body_params
    }
```

不要将这些元数据仅缓存在连接对象中。服务器会在每个请求上验证它。

### 步骤 3:可选地在列出前先发现

调用 `server/discover`,选择一个受支持的版本,然后调用 `tools/list`。如果你已经知道版本并能处理 `-32022`,直接调用 `tools/list` 也是有效的。

演示按名称顺序返回工具列表,并附带 `ttlMs`、`cacheScope`、`resultType` 以及服务器身份。工具调用返回一个完整且不可缓存的结果,因为其输出可能依赖当前状态。

### 步骤 4:将同一请求映射到 HTTP

远程 `tools/call` POST 包含与 JSON-RPC 请求体对应的头部:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: add
```

`MCP-Protocol-Version` 头部必须与 `_meta` 中的版本匹配。每个 JSON-RPC 请求都必须包含 `Mcp-Method`,且必须与 `method` 匹配。`Mcp-Name` 仅对 `tools/call`、`resources/read` 和 `prompts/get` 是必需的,此时它必须与工具名称、资源 URI 或提示词名称匹配。缺失必需头部或不匹配会返回 HTTP 400,错误码为 `-32020`(`HeaderMismatch`)。

### 步骤 5:在协议状态之外强制安全

- 在每个 HTTP 请求上验证授权与受众。
- 将本地服务器绑定到 localhost,并在 Streamable HTTP 上验证 `Origin`。
- 用 `destructiveHint: true` 标记修改型工具并要求宿主审批。
- 显式传递目录和文件范围,而不是依赖已弃用的 Roots。
- 将资源和工具输出视为不可信数据。
- 在 stdio 下将 stdout 保留给 JSON-RPC;诊断信息写入 stderr。

## 使用它

从其目录运行本课:

```bash
python3 code/main.py
cd code
python3 -m unittest discover tests -v
```

第一行应报告在协议 `2026-07-28` 下发现了 `demo-server`。然后检查 `MCPClient.request`:它为每次调用重建 `_meta`。从某个请求中移除元数据,观察服务器拒绝该请求。

## 上线

`outputs/skill-mcp-server-designer.md` 将一个领域转化为无状态 MCP 设计。其验收门槛要求:发现结果、按请求的元数据策略、确定性的缓存感知列表、显式的状态句柄、传输头部、授权与审批规则。

## 继续 MCP 深入学习

本课为你提供了协议模型。Phase 13 将四个生产边界拆分为独立的构建与验证课程:

1. [MCP Tool Contracts and Content](../../../13-tools-and-protocols/28-mcp-tool-contracts-and-content/docs/en.md) 涵盖封闭的输入模式、结构化内容、路由元数据、不透明分页、完成授权,以及协议错误与工具领域错误的区别。
2. [MCP Reliability, Cancellation, and Flow Control](../../../13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/docs/en.md) 涵盖请求取消、持久任务取消、截止时间、幂等性、背压、代理缓冲与重连行为。
3. [MCP Registry Supply Chain, Admission, Drift, and Rollback](../../../13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/docs/en.md) 涵盖命名空间证明、制品来源、不可变锁定、实时漂移、Registry 状态、准入证据与回滚。
4. [MCP Conformance Engineering](../../../13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/docs/en.md) 涵盖黄金与负面线上转录、严格的版本时代、SDK 差异、代理证据、脱敏、健康门禁与发布回滚。

当服务器将跨越团队或信任边界时,请按顺序学习。它们共同让你从"方法能工作"走向"契约在部署中始终保持安全且可诊断"。

## 练习

1. 添加一个 `subtract` 工具,并确认 `tools/list` 仍保持字母序。
2. 移除协议版本键,验证 Invalid Params(`-32602`)。然后发送格式正确但不受支持的版本 `2025-11-25`,验证 `-32022`,确认 `requested` 回显了该修订版,并从 `supported` 中选择。
3. 为一个创建操作添加服务器生成的 `draftId`,然后要求将其作为更新操作的参数。解释为什么这是应用状态而非协议会话。
4. 从一个需要用户确认的工具返回 `input_required`。使用新 ID、一个 `inputResponses` 条目和原样的 `requestState` 重试原始调用,而不是自行发明服务器到客户端的 JSON-RPC 请求。
5. 草拟一个双时代 stdio 客户端。将结果或可识别的现代错误视为现代,并仅对无法识别的错误或超时允许回退到 `initialize`。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| MCP | "LLM 的工具协议" | 用于服务器发现、工具、资源、提示词和扩展的 JSON-RPC 协议 |
| Host | "AI 应用" | 拥有模型和 UI,并挂载一个或多个 MCP 客户端 |
| Client | "连接器" | 代表宿主与一台服务器使用 MCP 通信 |
| 无状态 MCP | "无会话" | 每个请求携带版本和能力;没有按连接键控的协议状态 |
| `server/discover` | "能力探测" | 必需的服务器方法,声明版本、能力和身份 |
| `resultType` | "结果状态" | 将结果标记为 `complete` 或 `input_required` |
| State handle | "工作流 ID" | 服务器生成的应用标识符,作为普通参数传递 |
| Streamable HTTP | "远程传输" | 一个 POST 端点,响应为 JSON 或请求级 SSE |
| MRTR | "询问并重试" | 嵌入在结果中的输入请求,随后重试原始操作 |

## 延伸阅读

- [MCP 2026-07-28 关键变更](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP 服务器发现](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 已弃用特性](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)