# 模型文本协议 (MCP)

> 2026-07-28的修订使该协议无状态:功能和版本文本与每个请求都随着,而不是连接的握手.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 03 (Structured Outputs)
**Time:** ~75 minutes

## 学习目标

- 区分一个MCP主机,客户端,服务器,运输和服务器原始.
- 建立一个JSON-RPC请求,使用MCP 2026-07-28所要求的元数据.
- 使用`server/discover`检查版本,身份和功能.
- 返回输入和缓存的结果来自工具,资源和提示.
- 解释现代无国无国 MCP 与握手时代的服务器如何互动.
- 选择安全状态,运输和许可限制.

## 问题

没有共享协议,每个AI主机都需要自定义发现,调用,错误,运输和授权粘合剂,

服务器发布标准的JSON-RPC表面.一个符合要求的客户端可以发现表面,向模型或用户展示它,调用它,并没有服务器特定的适配器解释结果.

重要界限很容易被错过.MCP标准化通信.它不决定模型应该调用哪个工具,使不值得信赖的内容安全,或将无状态请求变成持久的应用状态.你的主机和服务器仍然拥有这些决定.

## 概念

![MCP host, stateless request, and server primitives](../assets/mcp-architecture.svg)

### 服务器的三个原始

1. **Tools**每个工具都有一个名称,描述,JSON Schema输入和处理器.
2. **Resources**客户可以阅读的 URI 地址的内容.
3. **Prompts**它们是主机可以向用户展示的可重复使用模板.

机器人是AI应用程序.机器人内部的MCP客户端与一个服务器交谈.运输器在它们之间传输JSON-RPC消息.

### 无国籍申请取代握手

移除MCP 2026-07-28 `initialize`其他`notifications/initialized`任何请求都包含需要解释的文本.`params._meta`其他:

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

需要协议版本和客户端功能. 客户端身份是建议的. 缺失一个`_meta`错误类型的要求字段是错误的,返回不有效的参数 (`-32602`服务器不支持的完整版本字符串返回`UnsupportedProtocolVersionError`(`-32022`服务器可以处理有效的请求,而不需要恢复之前的谈判记录.

无国籍并不意味着应用程序永远无法保持状态.`Mcp-Session-Id`如果工作流需要连续性,服务器会打造一个不透明的手柄,客户端将该手柄作为后来的调用工具的普通参数.

### 发现和版本选择

每个现代服务器都实现了`server/discover`结果宣传支持的版本,功能和服务器身份:

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

客户端可能直接调用另一种方法并处理版本错误,但发现使功能显示和版本选择明确.一个不支持的版本返回.`UnsupportedProtocolVersionError`具有代码`-32022`它的数据包含`supported`服务器修改的数组,`requested`拒绝的修订.

在工作室,一个双代客户探测`server/discover`发现结果或已认可的现代错误,例如`UnsupportedProtocolVersionError`任何错误或截止时间都不能被认为是现代的,`initialize`传统的行为是兼容性代码,而不是现代的默认代码.

### 结果是明确的

每个核心2026-07-28的结果都有`resultType`其他:

- `complete`代表行动结束.
- `input_required`服务器需要通过多次回路请求模式进行一次回复访问.`tools/call`现在`resources/read`其他`prompts/get`现在,我们要去.

客户必须处理遗留结果,`resultType`完全的.

服务器应包括`io.modelcontextprotocol/serverInfo`在每一个结果中`_meta`个人身份是自主报告的,用于显示,记录和调试,而不是用于安全决策.

列表和阅读结果也包含`ttlMs`其他`cacheScope`确定性`tools/list`随着订单加上新鲜度提示,客户可以安全地缓存发现,并提高快速缓存稳定性. `cacheScope: public`允许共享缓存;`private`只有在调用环境下才能重复使用.

### 电线格式和运输

通过 stdio 或 Streamable HTTP,MCP 使用JSON-RPC 2.0.

- 要求有`jsonrpc`现在`id`现在`method`其他`params`现在,我们要去.
- 答案是相匹配的`id`任何一个`result`或`error`现在,我们要去.
- 没有通知`id`他没有预期任何回应.

现代流向HTTP暴露一个接收 POST 的终端点.每个JSON-RPC消息都获得了自己的 POST.一个请求 POST 接收了一个 JSON 对象或一个请求范围的服务器发送事件流,最终的响应结束.一个接受的通知 POST 接收了 HTTP 202 没有响应体;本核心修订定义了没有客户端到服务器的通知.

没有独立的MCP GET流, DELETE会议终点,`Mcp-Session-Id`其他`Last-Event-ID`长期变化通知使用一个`subscriptions/listen`作为一个SSE流的响应仍然是开放的.

### 客户端输入,没有服务器启动的请求

旧版本允许服务器发送如 `sampling/createMessage`现在`roots/list`其他`elicitation/create`现在的协议使用多次回路请求.一个符合条件的工具调用,资源阅读或提示获取回报.`resultType: input_required`具有至少一个`inputRequests`或`requestState`客户端收集任何请求的输入,使用新的JSON-RPCID和相应的方法重新尝试.`inputResponses`它们是完全的.`requestState`如果没有,`inputRequests`没有人回来,再试.`inputResponses`现在,我们要去.

根,样本和登记仍然功能,但已经过时,因此新实现不应该采用它们.现有根或样本请求在MRTR内运行`inputRequests`服务器的配置,服务器配置和直接模型提供商集成. 对于工作室诊断使用 stderr 和生产远程测量使用 OpenTelemetry.

```figure
mcp-nxm-collapse
```

## 建立它

### 步骤1:注册服务器表面

尽管申请合同发生了变化,但仍保持简单的注册:

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

运输的实施`code/main.py`它故意使用标准库,以便您可以看到每个封面,而不是将协议委托到SDK.

### 步骤2:将元数据添加到每个请求

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

只有在连接对象中,不要将此元数据存储在缓存中.服务器在每个请求上验证它.

### 步骤3:在上市之前,选择发现

电话`server/discover`选择支持版本,然后打电话`tools/list`直接的`tools/list`您已经知道版本,并且可以处理`-32022`现在,我们要去.

演示显示工具列表以名称顺序返回,并附加`ttlMs`现在`cacheScope`现在`resultType`工具调用会返回一个完整的,不可缓存的结果,因为其输出可能取决于当前状态.

### 步骤4:将相同的请求映射到HTTP

一个遥控器`tools/call`POST包含反映JSON-RPC体的标题:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: add
```

其他`MCP-Protocol-Version`标题必须与该版本相匹配`_meta`现在,我们要去.`Mcp-Method`需要在每个JSON-RPC请求中,必须匹配`method`现在,我们要去.`Mcp-Name`仅需要`tools/call`现在`resources/read`其他`prompts/get`需要一个缺失的标题或不匹配返回 HTTP 400 `HeaderMismatch`代码`-32020`现在,我们要去.

### 步骤5: 执行协议状态之外的安全

- 验证每个HTTP请求的授权和观众.
- 将本地服务器与本地主机连接并验证`Origin`在流式HTTP上.
- 标记突变工具`destructiveHint: true`需要主机批准.
- 通过目录和文件范围,而不是依赖于过时的根.
- 处理资源和工具输出数据是不可信的数据.
- 保持在stdio下保留的 stdout为JSON-RPC;写诊断到stderr.

## 用它

运行课程从它的目录:

```bash
python3 code/main.py
npx tsx code/main.ts
cd code
python3 -m unittest discover tests -v
```

首先,应该报告发现`demo-server`在协议中`2026-07-28`然后检查`MCPClient.request`它们重建了`_meta`删除一个请求的元数据,并观察服务器拒绝它.

## 运送它

`outputs/skill-mcp-server-designer.md`域名将域名转化为无状态的MCP设计.其接受门需要一个发现结果,每次请求的元数据政策,确定性缓存意识列表,明确的状态处理,运输标题,授权和批准规则.

## 继续MCP深度潜水

阶段13将四个生产界限变成单独的构建和验证课程:

1. [MCP Tool Contracts and Content](../../../13-tools-and-protocols/28-mcp-tool-contracts-and-content/docs/en.md)涵盖封闭输入方案,结构化内容,路由元数据,不透明的页面化,完成授权以及协议和工具域错误之间的区别.
2. [MCP Reliability, Cancellation, and Flow Control](../../../13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/docs/en.md)覆盖请求取消,持久任务取消,截止日期,无效,压力,代理缓冲和重新连接行为.
3. [MCP Registry Supply Chain, Admission, Drift, and Rollback](../../../13-tools-and-protocols/30-mcp-registry-supply-chain-and-drift/docs/en.md)包含名称空间证明,文物来源,不可变的,直播漂移,注册表状态,录取证据和反弹.
4. [MCP Conformance Engineering](../../../13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/docs/en.md)涵盖金色和负线转录,严格版本时代,SDK差异,代理证据,编辑,健康门和释放回放.

随着服务器将跨越团队或信任边界时,随着它们的顺序进行下载. 它们一起从方法工作到合同仍然安全,通过部署可诊断.

## 运动

1. 添加一个`subtract`工具和确认`tools/list`它们是字母顺序的.
2. 删除协议版本键,并验证不有效参数 (`-32602`接着发送一个有形的,但没有支持的版本.`2025-11-25`检查`-32022`确认`requested`根据此次修订,`supported`现在,我们要去.
3. 添加一个服务器编译`draftId`解释为什么这是应用状态而不是协议会议.
4. 返回`input_required`通过一个新的ID,重新尝试原来的电话,`inputResponses`报名,以及`requestState`而不是发明一个服务器到客户端的JSON-RPC请求.
5. 描绘一个双代工作室客户端. 处理结果或被承认的现代错误为现代,并允许倒退.`initialize`只有未知错误或截止日期.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| MCP | "Tool protocol for LLMs" | JSON-RPC protocol for server discovery, tools, resources, prompts, and extensions |
| Host | "The AI app" | Owns the model and UI and mounts one or more MCP clients |
| Client | "The connector" | Speaks MCP to one server on behalf of a host |
| Stateless MCP | "No session" | Every request carries version and capabilities; no protocol state is keyed by a connection |
| `server/discover` | "Capability probe" | Required server method advertising versions, capabilities, and identity |
| `resultType` | "Result state" | Marks a result as `complete` or `input_required` |
| State handle | "Workflow id" | Server-minted application identifier passed as an ordinary argument |
| Streamable HTTP | "Remote transport" | One POST endpoint with JSON or request-scoped SSE responses |
| MRTR | "Ask and retry" | Input request embedded in a result, followed by a retry of the original operation |

## 进一步阅读

- [MCP 2026-07-28 key changes](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP deprecated features](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)
