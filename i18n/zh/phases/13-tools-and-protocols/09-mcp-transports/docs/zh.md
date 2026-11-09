# 转载:无国无国无国可流的HTTP

> 运输运输传输信息. 它不提供缺失协议状态.`2026-07-28`通过本地工作室和远程流向 HTTP, 两个都包含自我描述的请求.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lessons 07 and 08
**Time:** ~65 minutes

## 学习目标

- 选择本地儿童进程的studio和网络服务的 Streamable HTTP.
- 实现现代单端点,仅供POST使用的流向HTTP合同.
- 镜像和验证MCP版本,方法和名称标题与JSON-RPC体.
- 提供按要求范围的SSE和长寿命`subscriptions/listen`流量正确.
- 迁移基于会议和传统的HTTP+SSE部署,而不用将传统行为呈现为现代.

## 问题

之前的流媒体HTTP修改将协议谈判与连接和会议行为结合在一起.`Mcp-Session-Id`通过GET,将一个独立的GET流暴露,接受 DELETE,并恢复SSE.`Last-Event-ID`现在,我们要去.

股`2026-07-28`通过 HTTP 标题,可以将这些机制从现代电线中移除.每个请求都可以落地在任何健康的员工上,因为其协议版本和客户端功能在请求器内. HTTP 标题反映了路由和政策的选择领域,但服务器在执行之前验证了这些标题对身体的验证.

结果更容易扩展,更容易推理. 这也意味着一个教导2025运输的服务器正在教导错误的故障和安全模型.

## 概念

### 工作室

工作室绑定是针对客户端启动的子进程:

- 客户端每行写一个 UTF-8 JSON-RPC 消息到 stdin.
- 服务器每行写一个 UTF-8 JSON-RPC 消息到 stdout.
- 服务器将诊断写给SDR.
- 服务器在EOF中即时离开.
- 每个现代化请求都包含了版本和客户端功能.`params._meta`现在,我们要去.

进程可能会在许多电话中运行,但它不是一个现代协议会议.如果它突然出发,飞行中的请求会丢失.重新启动过程,重新发现,重新列表,重新开放订阅,并重新尝试使用新的请求ID安全操作.

### 流向的HTTP在2026-07-28

现代服务器暴露了一个MCP终端点,例如`/mcp`通过邮件.

每个JSON-RPC请求或通知都是新的HTTP POST. 机体包含一个JSON-RPC消息. 客户端不会向服务器发送JSON-RPC响应.

服务器对请求返回:

- `Content-Type: application/json`通过一个JSON-RPC响应;或
- `Content-Type: text/event-stream`要求的通知,随后是最终的JSON-RPC响应.

对于被接受的通知,服务器返回`202 Accepted`没有尸体.

客户广告两种响应类型:

```http
Accept: application/json, text/event-stream
```

### 仅仅POST的意思是仅仅POST

现代流式HTTP没有独立的GET流和 DELETE会话终点.

- `GET /mcp`收益`405 Method Not Allowed`现在,我们要去.
- `DELETE /mcp`收益`405 Method Not Allowed`现在,我们要去.
- `Mcp-Session-Id`没有任何和回声.
- `Last-Event-ID`由于现代流程无法恢复,

如果请求范围的流在最终响应之前断裂,客户端已经失去了飞行中的请求.它可能会在安全的重试时发出新的请求,并使用新的JSON-RPC id.它不得尝试重启流.

### 验证原产地

服务器验证`Origin`如果头条存在,并且没有明确允许,返回`403 Forbidden`非浏览器客户端可能会省略`Origin`官方交通规则允许的.

地方服务器应与 `127.0.0.1`网络服务仍然需要在每一个请求中进行验证和授权.

使用正确的原始匹配后的定制.`origin.startswith("https://trusted.example")`它们是不安全的,因为它们可以接受攻击者控制的后音.

### 需要的HTTP元数据标题

每个现代 POST 请求都包括:

```http
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes_search
```

标题规则:

- `MCP-Protocol-Version`要求和必须等等`params._meta.io.modelcontextprotocol/protocolVersion`现在,我们要去.
- `Mcp-Method`需要和必须等于JSON-RPC`method`现在,我们要去.
- `Mcp-Name`需要`tools/call`现在`resources/read`其他`prompts/get`现在,我们要去.
- `Mcp-Name`相当于`params.name`其他`params.uri`为了`resources/read`现在,我们要去.
- 标题值对案例敏感,尽管标题名称对案例不敏感.

不安全或非ASCII `Mcp-Name`值使用 UTF-8 Base64 哨兵:

```text
=?base64?{Base64EncodedValue}?=
```

在与机体比较之前,服务器会解码这个值.

缺失,错误的或不匹配的镜头标题返回 HTTP `400`使用JSON-RPC代码`-32020`如果标题和体格同意服务器不支持的版本,返回HTTP `400`随着`-32022`错误数据`{"supported":["2026-07-28"],"requested":"2027-01-01"}`现在,我们要去.

未知现代方法返回HTTP`404`通过JSON-RPC`-32601`由于双代客户端使用它来区分现代错误与传统终端错误,所以JSON-RPC的实体很重要.

### 根据要求进行的SSE

服务器可以选择SSE用于一个长期请求:

```text
POST tools/call id=41
  <- notifications/progress related to id=41
  <- notifications/progress related to id=41
  <- JSON-RPC response id=41
stream closes
```

服务器不得在此流中发送独立的JSON-RPC请求.采样,调用和根交互使用多轮通行请求结果.关闭响应流取消该请求.

不要添加SSE事件ID来重播. `Last-Event-ID`恢复并非现代修订的一部分.

### 长期的变化使用订阅/听

变更通知使用客户端开放的请求,而不是独立的GET:

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

后者是一个长期的SSE流.`notifications/subscriptions/acknowledged`确认,每次变更通知以及最终结果都会带来`io.modelcontextprotocol/subscriptionId`在`_meta`服务器可能会作为保留符发出SSE评论.当流量下降时,客户端会重新发出`subscriptions/listen`具有新的请求身份和重新调整影响数据.

`resources/subscribe`其他`resources/unsubscribe`现在,我们在这个世界里,

### 明确申请状态

删除协议会议不会禁止使用状态的工作流程.服务器可能会打印一个不透明的状态手柄,并将其返回为正常工具结果.客户端在后来的电话中将该手柄作为明确的参数.

绑定手柄与认证的主体,使它们无法测试,过期,并授权所有使用. 这使状态在应用层上可见,而不是隐藏在运输亲密度.

隐藏复制状态导致的故障是机械的:

1. 要求A达到复制1并创建一个草案在该过程的记忆中.
2. 答案不会返回草案处理器,因为实施假设连接识别了草案.
3. 要求B是新 POST,达到复制 2.
4. 复制2有有效的协议元数据,但没有方法命名或加载草案,因此工作流失败或读取错误的本地对象.
5. 粘性路由似乎会修复症状,直到重新启动,推出,重新安排或失败转移下一个请求.

正确的边界有两个部分. 每个请求都包含了协议的文本. 持久应用状态在服务器硬件的手柄下,返回给客户端. 接下来的调用器提供处理器,任何复制器都加载相同的记录, 复制记忆可能会缓存记录,但不能是唯一需要对准的副本.

选择状态机制根据寿命.请求本地变量可以服务于一个调用.短时间的MRTR延续可以使用完整性保护 `requestState`草案或持久任务需要明确的处理,加上共享的持久性,过期,同步控制和无效性.这些对象中没有一个是MCP协议会议.

### 双时代 HTTP 兼容性

如果客户端支持现代和传统服务器,首先尝试一个现代 POST.`400`现在`404`其他`405`检查了身体:

- 已识别的现代JSON-RPC错误证明服务器是现代化的. 纠正请求或重新尝试广告版本. 不要降级.
- 只有试用旧的GET终端点,并预计其遗产 `endpoint`事件

服务器可以通过将现代的元数据向现代的POST实现并保留旧客户端的独立遗产终端点来支持迁移期间的两个时代.永远不要将遗产GET, DELETE,会议ID或重播行为描述为`2026-07-28`现在,我们要去.

```figure
tp-transport-handshake
```

## 用它

`code/main.py`通过 Python 标准库实现一个有限的,现代的 Streamable HTTP 服务器.它验证了 Origin 和 Mirrored 头条,忽略了删除的会话头条,返回了 JSON 用于正常调用,并显示了一个有限的 `subscriptions/listen`水电流.

```bash
cd code
python3 main.py --probe
npx tsx main.ts --probe
python3 -m unittest discover tests -v
```

探测器检查:

- 拒绝无效的起源;
- 没有会议ID的情况下发现成功;
- `Mcp-Session-Id`其他`Last-Event-ID`无视;
- 标题不匹配返回`-32020`其他
- 没有支持的版本返回`-32022`确切的`supported`其他`requested`数据;
- 已接受的无 id 通知返回 HTTP `202`没有尸体;
- 获取和删除返回`405`其他
- `subscriptions/listen`是一个 POST 响应流,其确认,通知和最终结果包含其订阅ID.

## 运送它

这一课是很好的.`outputs/skill-mcp-transport-migrator.md`它删除了现代协议会议,增加了标题体验证,并取代了独立的GET.`subscriptions/listen`任何遗产桥梁都会显著分开.

## 运动

1. 删除`Mcp-Method`通过一个POST. 确认HTTP`400`错误`-32020`现在,我们要去.
2. 发送相匹配的标题和体格版本`2027-01-01`确认HTTP`400`错误`-32022`准确的数据`{"supported":["2026-07-28"],"requested":"2027-01-01"}`现在,我们要去.
3. 派一个Base64哨兵`Mcp-Name`确认解码值与 已解码值的值进行比较`params.uri`现在,我们要去.
4. 在最终响应之前打破有限的听声流,用新的JSON-RPCID重新发布并重复工具.
5. 添加一个明确的工作流程手柄到ping工具. 绑定它到一个授权主题,而不使用连接亲密性.

## 关键词

| Term | Meaning |
|------|---------|
| stdio | Newline-delimited JSON-RPC over a client-launched subprocess |
| Streamable HTTP | Single endpoint where each modern message is a new POST |
| Request-scoped SSE | POST response stream containing related notifications and final response |
| `subscriptions/listen` | Long-lived POST request for opted-in change notifications |
| Header mismatch | HTTP `400` and JSON-RPC `-32020` when mirrored headers disagree with body |
| Origin validation | DNS-rebinding defense for incoming connections, not authentication |
| Explicit state handle | Application token passed as an ordinary argument instead of hidden session state |
| Legacy bridge | Separate earlier-era behavior kept only for compatibility |

## 进一步阅读

- [MCP Transport Overview](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)
- [MCP stdio Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Subscriptions](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions)
- [MCP 2026-07-28 Changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
