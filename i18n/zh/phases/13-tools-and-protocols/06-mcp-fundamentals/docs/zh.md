# 无国籍申请和JSON-RPC

> 现代MCP没有握手和协议会议.每个请求必须包含足够的元数据,才能被理解,授权,路由和重新尝试.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lessons 01 through 05
**Time:** ~55 minutes

## 学习目标

- 区分MCP的服务器原始功能与客户端功能.
- 建立有效的JSON-RPC 2.0请求和响应`2026-07-28`现在,我们要去.
- 添加协议版本,客户端功能和客户端身份到每个请求.
- 使用`server/discover`手`UnsupportedProtocolVersionError`没有握手.
- 追踪一个独立的请求从验证到完整的结果.

## 问题

如果服务器记住前一个请求声明了什么,它可以应用错误的权限或返回错误的电线形状.

股`2026-07-28`服务器必须从当前请求中决定如何处理当前请求,而不是从连接历史中决定.

这改变了心理模型.旧的序列是连接第一,握手第二,操作第三.现代的序列更简单:

1. 客户向客户发出自定义请求.
2. 服务器验证了请求的版本和功能.
3. 服务器处理该方法.
4. 服务器返回输入结果或JSON-RPC错误.

接下来的请求从零开始重复相同的过程.

## 概念

### 服务器原始

 MCP 服务器暴露了三个主要的原始性:

1. **Tools**它们是模型控制的行动,`tools/list`,,,,,,,,,,,,,,,,,,,,,,,,,,,,,.`tools/call`现在,我们要去.
2. **Resources**发现的数据是 URI-  адресат的数据`resources/list`子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子`resources/read`现在,我们要去.
3. **Prompts**它们是可重复使用的模板,`prompts/list`字母为`prompts/get`现在,我们要去.

根源,样本采集和伐木仍然存在`2026-07-28`它们是过时的. 新的实施应使用明确的工具或资源输入,用于根源,直接的模型提供商API用于采样,以及用于记录的 stderr或 OpenTelemetry. 通过多次回路请求,服务器返回输入请求,客户端重复初始操作. 现代服务器从来没有启动独立的JSON-RPC请求.

### 其他类型的文件

采用JSON-RPC 2.0的MCP:

- 要求:`{jsonrpc, id, method, params}`
- 答案:`{jsonrpc, id, result}`或`{jsonrpc, id, error}`
- 通知:`{jsonrpc, method, params}`没有`id`

要求`id`没有创建协议会议.

### 要求的请求元数据

每个现代要求都包含一个`_meta`内部的物体`params`其他:

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

需要协议版本和客户端功能. 客户端身份是建议的. 它是自主报告的显示和调试数据,而不是安全凭证.

服务器不得从之前的请求,工作室进程,HTTP连接或单独的运输标题中推断这些值.

### 完整的结果和服务器身份

每一个成功的现代结果都包括`resultType`正常的最终结果使用`"complete"`服务器还应在结果的元数据中识别自己:

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

`tools/list`现在`resources/list`现在`prompts/list`现在`resources/templates/list`现在`resources/read`其他`server/discover`它们包括:`ttlMs`其他`cacheScope`安全的默认是`ttlMs: 0`其他`cacheScope: "private"`列表项应有确定性排序,因此相当的响应产生稳定的缓存键和稳定的模型背景.

### 没有握手的发现

每个现代服务器都必须实现`server/discover`客户可以在其他方法之前调用:

- `supportedVersions`
- 服务器`capabilities`
- 选择性使用`instructions`
- 结果是服务器身份`_meta`
- 缓存提示

发现是有用的,但它不是一个门户.`tools/list`首先,因为该请求已经包含了协议版本和功能.

如果未支持请求版本,服务器将返回JSON-RPC代码 `-32022`含有:

```json
{
  "requested": "2027-01-01",
  "supported": ["2026-07-28"]
}
```

客户端选择一个互助的现代版本,并再次尝试使用新的JSON-RPC请求ID.

### 一个请求生命周期

追踪一个现代要求的顺序:

1. 分析一个JSON-RPC封面.
2. 确认`jsonrpc`是`"2.0"`其他`id`存在的`method`是一个字符串,`params`是一个物体.
3. 要求版本字符串和功能对象在 `params._meta`错误的或缺失的元数据`-32602`现在,我们要去.
4. 在HTTP边界,将版本,方法和适用的名称标题与体格进行比较.`-32020`即使两个版本值中的一个不支持.
5. 通过" 支持不支持的版本"来拒绝相匹配的版本.`-32022`现在,我们要去.
6. 检查所需的能力,然后通过路线`method`验证特定方法的参数.
7. 在操作器运行之前,验证和授权混凝土操作.
8. 返回一个完整的结果,提供服务器身份.
9. 忘记请求范围的协议元数据.

通过该命令,两个组件无法解释不同的通话.`Mcp-Name: notes.read`在原始执行时`params.name: notes.delete`它还将错误输入,标题混,版本谈判,能力故障,授权和处理器故障作为明显的证据.

关闭STDIN或HTTP响应结束了运输活动.它不会终止协议会议,因为现代MCP没有协议会议.

### 显而易见的遗产兼容性

通过版本`2025-11-25`使用`initialize`现在`notifications/initialized`由于这种行为仍然是相关的,当一个双代客户端与旧服务器交谈时.

保持时代分开.现代请求由每请求所需的元数据识别.只通过记录后退路径选择旧连接.`initialize`作为一个 `2026-07-28`服务器.

无国籍因此具有特定时代的意义.`2026-07-28`任何普通请求都可以独立解释,没有MCP会议.`2025-11-25`双代实现不是一个允许状态的机器.它是一个独立的传统适配器旁边的无状态现代核心,在任何解析器运行之前,它明确选择决定.

任何一个意思都禁止持久的应用状态.一个工作流程,任务或草案可以在共享存储器中的不透明的手柄背后生活.客户端将该手柄作为普通输入,每个复制都验证并授权其使用.协议文本不得作为删除的会议的替代品泄露到该存储器中.

```figure
mcp-tool-call
```

## 用它

`code/main.py`建立,验证,追踪和发送现代MCP消息,而无需框架.

```bash
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

检查输出中的三个不变:

- 每个请求都重复了自己的要求.`_meta`其他地方
- 每个成功的结果都是`resultType: "complete"`包含服务器身份.
- 列表结果是确定性排序的,并且有明确的缓存提示.

## 运送它

这一课是很好的.`outputs/skill-mcp-handshake-tracer.md`历史文件名仍然稳定,但该文物现在已成为一个无状态请求追踪器. 它独立审计每个消息,并且只有当它真正存在时才标记旧的握手流量.

## 运动

1. 改变一个请求的协议版本为 `2027-01-01`确认错误代码是`-32022`数据宣传支持版本.
2. 删除`io.modelcontextprotocol/clientCapabilities`确认服务器不使用第一请求的功能.
3. 转换内存工具登记器. 确认`tools/list`仍然返回相同的确定性顺序.
4. 改变`cacheScope`其他`public`为了`private`解释哪些授权环境可以在每个情况下重复使用响应.
5. 添加一个可选的`clientInfo`由于客户身份是建议的,而不是要求的,请求应保持有效.

## 关键词

| Term | Meaning |
|------|---------|
| Stateless protocol | Every request supplies the metadata needed to interpret it |
| Request metadata | Version, client capabilities, and recommended client identity in `params._meta` |
| `server/discover` | Mandatory server method for versions, capabilities, instructions, and identity |
| `resultType` | Discriminator on every successful modern result |
| Cacheable result | Result that includes required `ttlMs` and `cacheScope` hints |
| Protocol era | Modern per-request metadata or legacy connection-scoped initialization |
| Transport lifetime | Process, connection, or response-stream lifetime, not protocol session state |
| `-32022` | Unsupported protocol version error with requested and supported versions |

## 进一步阅读

- [MCP Architecture](https://modelcontextprotocol.io/specification/2026-07-28/architecture)
- [MCP Base Protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic)
- [MCP Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP 2026-07-28 Changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
