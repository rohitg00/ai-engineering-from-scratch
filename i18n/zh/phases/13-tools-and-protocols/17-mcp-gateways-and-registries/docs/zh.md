# 无国籍MCP门户和注册表入口

> 网关应该明确每个路线. 2026-07-28协议给它方法,名称,版本,能力,身份,缓存和跟踪边界,而无需运输会议.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 15 (security), Phase 13 · 16 (authorization)
**Time:** ~75 minutes

## 学习目标

- 聚合多个MCP服务器在一个2026-07-28终端点后,而没有会话亲密性.
- 在政策或转发之前,按要求验证元数据和路由标题.
- 结合工具,使用稳定的命名空间,确定性顺序,描述符针,RBAC和私人缓存.
- 作为发现证据,仍然需要入学政策.
- 路线要求范围的SSE,`subscriptions/listen` MRTR 再试, 任务延长调用正确.
- 隔离传统的握手和会议支持.

## 问题

直接连接一个客户端到一个服务器是简单的.更大的部署需要一致的答案更难的问题:

- 哪些服务器可以使用?
- 哪个校长可以看到和打电话每个工具?
- 如果两个后端暴露出同一个名字,会发生什么?
- 描述符的变化如何进行审查?
- 利率限制和审计活动在哪里适用?
- 任何一个案例能处理下一个请求吗?

网关位于客户端和后端MCP服务器之间. 它呈现一个MCP终端点,应用跨界政策,并传递批准的请求.

旧的网关设计通常将一个客户端会议复杂化成多个后端会议,然后重新写`Mcp-Session-Id`这是一个传统的兼容性设计. 2026-07-28核心没有协议会议.

## 概念

### 现代门口之路

对于每项请求:

1. 确认出境许可证的本人身份.
2. 验证`MCP-Protocol-Version`现在`Mcp-Method`现在`Mcp-Name`其他`params._meta`现在,我们要去.
3. 授权主题,资源,方法,工具和论点.
4. 应用描述符,注册表,利率和数据政策.
5. 创建一个新的独立请求,为选择的后端.
6. 验证后端结果并返回网关结果.
7. 记录一个审计事件,没有记录秘密.

没有步骤需要隐藏协议会议.应用状态仍然可以存在数据库,明确手柄,任务或完整性保护的MRTR状态中.

### 运行时间政策是主要的关门决定

录取决定后端版本可以进入门口.它不授权直播通话.对于每个请求,门口从认证的主,发行者和资源,租户,匹配的方法和名称,正常化参数,被允许的描述符针,当前后端健康,能力交叉,数据分类,利率状态以及任何行动相关的批准重新计算了政策.

登记记录可以保持活跃,而用户的角色被撤销.一个描述符可以保持固定,而一个目的地参数跨越租户界限.一个后端可以保持批准,而事件政策隔离状态变化的呼叫.因此,运行时间政策是主要允许或拒绝决定,登记和描述符证据作为输入.

不要在连接或删除会议识别器下缓存允许决定. 如果没有可用的政策,按操作类进行声明的失败政策. 安全默认是,如果无法关闭状态变化和敏感阅读,而明确批准的公共阅读路径只能使用短期的最后已知政策,只有当其风险模型允许时. 记录该政策版本和失败路径作出决定,然后在返回之前验证后端结果.

### 一个POST终点

现代流向 HTTP 通过 POST 发送每个 JSON-RPC 消息:

```text
POST /mcp
Authorization: Bearer <gateway-token>
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.search
Accept: application/json, text/event-stream
```

网关可以返回JSON或请求-scoped SSE,为 POST. GET和 DELETE返回405现代请求. `Mcp-Session-Id`其他`Last-Event-ID`不要创造权威,亲密关系或重复行为.

标题和体值必须一致. 拒绝与`-32020`在搜索后端之前,这允许负载平衡器,门户和速度限制器路由,而不会分析整个机体,同时保持端到端完整性.

验证在一个确切的顺序:JSON-RPC和元数据类型,标题和体格等,然后支持匹配的版本.一个不匹配返回HTTP 400`-32020`如果标题和体格同意不支持的版本,请返回HTTP 400`-32022`其他`data`完全是`{"supported":["2026-07-28"],"requested":"<actual>"}`未知方法返回了HTTP 404`-32601`现在,我们要去.

`ProtocolError`带有可选的`data`通过一个通道将其串行到JSON-RPC错误对象中.`id`通过 HTTP 通知,它返回 202 个空格.

### 实现发现在每个层

通过网关实现`server/discover`它还发现每个后端,所以它知道协议版本,功能和扩展.

举例的网关结果:

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

广告只能在网关可以尊重的功能交叉点.后端功能不自动安全地暴露.没有后端路径的网关功能不有用广告.

`serverInfo`没有任何数据显示或诊断数据,请不要使用它们作为注册表或出版商证明.

### 客户端要求能力

每个转发的请求都需要一个最新的信息`_meta`包裹:

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

通过后端,不要盲目复制外部客户端功能.门户端是后端客户端. 广告只能具有门户端正确的调解功能.

### 确定性名称空间

合并后端工具以稳定的公共名称:

```text
notes.search
notes.create
issues.list
issues.open
```

保持一个地图从公众名称到后端和原始工具名称. 永远不要选择第一个或最后的碰撞. 公众名称是批准和审计合同的一部分,所以更改它是一个迁移.

`tools/list`显度因主体而异时,返回`cacheScope: private`没有任何限制.`ttlMs`减少后端发现负载,而不会允许用户特定列表在授权环境中泄露.

每个暴露的工具描述符都包含一个稳定的名称,描述和对象根`inputSchema`名称空间不能删除所需的描述字段.完整列表结果还包括`resultType`服务器身份元数据,以及缓存提示.

### 印批准的描述符

在入学时,将完整的描述符归类为法典,并将其消化器存储在合格的公众名称下.在列表和电话时间,将现场描述器与批准的消化器进行比较.

如果变化:

- 删除它`tools/list`现在,我们要去.
- 拒绝直接电话.
- 发出审计活动.
- 需要在更新之前重新批准政策或人类.

网关是一个有用的中央执行点,但它不会使一条第一次看到的描述符成为安全的描述符.

### 登记文件帮助发现,而不是决定

一个注册书`server.json`提供出版元数据. 包装支持的记录可以看起来像这样:

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

发布元数据不包含网关的安全决定. 保存经验证的出版商和来源证据在单独的录取状态:

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

门口检查了`server.json`通过通过该网关,我们可以将其与外部状态联系起来.

对于每一个被允许的后端,记录:

- 记录和记录的确切标识.
- 经过验证的出版商名字空间或域名证据.
- 允许运输和终点.
- 嵌版本或批准的升级政策.
- 艺术品或描述器消化.
- 授权发行人和资源.
- 审核,批准时间,和过期.

由于其显示名称类似于熟悉的产品,所以不要接受服务器.不要把登记器存在视为运营安全审查.即使它们从未出现在公开登记器中,也可以通过相同的证据方案接入私人服务器.

这一课实现了门口接:在后端成为可路由之前,将出版证据与本地录取相结合. [Lesson 30: MCP Registry Supply Chain, Admission, Drift, and Rollback](../../30-mcp-registry-supply-chain-and-drift/docs/en.md)建立完整的控制平面,以确定名称空间的确切性,文物来源,不可变的针头,直播描述器漂移,登记处状态调整,具有明显的录取账本和证据支持的反转.保持供应链状态与上述按要求运行时间决定分开.

### 权证调解

后端的身份证件从未传递给客户端.

保持这些义务明确:

```text
outer principal -> gateway role and policy
backend issuer + resource -> backend registration and token
```

永远不要将外部门口代币传递给后端.永远不要在不同的发行商或资源中重复使用后端代币.如果工具代表最终用户,则用设计的交易或索赔模型保存该代权,而不是用共享服务凭证伪装用户.

### 没有会议的定位限制

通过认证的资本,发行人,资源,公共工具,成本类别和时间窗口的关键限制. 会议ID是缺失的,即使存在,也很容易旋转.

在消耗昂贵的工作之前,请使用廉价验证.

### 审计决策链

记录足以重建电话:

- 要求和追踪标识符.
- 证实资本和发行人
- 公共工具和后端路线.
- 描述器印版本.
- 政策决定和理由.
- 延迟和结果类.
- 适用时MRTR轮或任务标识符.

编辑代码,授权代码,更新代码,原始秘密和不必要的敏感论点.

### 根据要求进行的SSE

当一个请求中工作流时,正常的POST可能会返回请求-scopeed SSE.关闭响应流会取消飞行中现代HTTP请求.

别创建一个独立的GET流,不要承诺重播最后事件ID.

### 长期变化通知

对于列表和资源更改通知,当前客户端发送`subscriptions/listen`通知过器使用精确的平面字段 `toolsListChanged`现在`promptsListChanged`现在`resourcesListChanged`其他`resourceSubscriptions`其他:

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

首先,确认支持的子集.其订阅标识符是开放流的请求的JSON-RPC id:

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

接下来,网关只传输确认的变更类型.`io.modelcontextprotocol/subscriptionId`在`params._meta`没有自动重播或自动重听.重连接后,客户端重新打开订阅并更新其依赖的列表.服务器启动的优雅闭幕返回最终完整结果,标记为相同的订阅ID.

现代道路取代了`resources/subscribe`现在`resources/unsubscribe`保持这些只在一个版本封闭的旧路径.

### 通过门口的MRTR

当一个后端回来时`resultType: input_required`通过输入,网关只能转发该结果,如果外部客户端支持所需的输入请求.`requestState`字节对字节,除非门户故意终止并重新发行互动.

客户端将使用新 JSON-RPC ID 重新尝试原始公共工具`inputResponses`网关重新授权重新尝试,检查相同的公共路线,然后发送新的后端请求. 它不能假设一个早些时候获得无限批准.

### 任务扩展路由

任务是官方扩展,`io.modelcontextprotocol/tasks`它们不是一个核心会议的替代品.

客户端声明扩展在每次请求客户端功能内,门口只在能够保存生命周期终端时将其公布在发现中.`tools/call`后端单独决定是否返回普通结果`resultType: task`任务结果带有`taskId`现在`status`时间,`ttlMs`其他选择性`pollIntervalMs`任务必须在发送结果之前已经可读.

后者是: 通过该网关记录了不透明任务识别器的认证主和后端路线.`tasks/get`现在`tasks/update`其他`tasks/cancel`电话使用`params.taskId`作为`Mcp-Name`通过此, 提供了路由密钥.`tasks/get`收益`resultType: complete`输入到终端状态的终端结果或协议错误. `tasks/update`发送钥匙`inputResponses`对于未完成任务输入,返回一个空白的完整确认. `tasks/cancel`合作的意图是完全承认的,而不是保证工作停止.

不要实施新的`tasks/list`或`tasks/result`需要输入的任务将通过 系统中包含的请求进行解明.`tasks/get`客户通过回复`tasks/update`客户端仍然在建议的间隔中进行投票;任务创建仍然是服务器导向的.

持久任务路径状态是应用程序数据,由任务处理器键化,而不是协议会议.

### 兼容性界限

如果网关必须为旧客户端或后端服务:

- 显然可以探测到时代.
- 保存初始化,运输会议,GET流,资源订阅和旧任务词汇在旧适配器中.
- 永远不要将旧的会议身份证泄露到现代路由或授权中.
- 宁愿有限于发现探测器和明确的反弹政策,

```figure
t3-gateway-funnel
```

## 建立它

`code/main.py`通过程序中协议网关和两个后端服务器实现.每个后端都收到一个新的当前协议请求.`tools/list`名称间路由,登记`server.json`另外,外接状态,描述符,RBAC,主要关键利率限制,审计决定以及一个模型`subscriptions/listen`证实安全性.

该模型接收解析请求体,路由标题和认证的载体身份.它不是完整的HTTP适配器,也不解析`Content-Type`或是全部`Accept`连接到第09课的流向HTTP适配器,`Content-Type: application/json`其他`Accept`含有两者中的值`application/json`其他`text/event-stream`现在,我们要去.

运行它:

```bash
cd phases/13-tools-and-protocols/17-mcp-gateways-and-registries
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

演示程序将打印外部请求 ID 和新版本的后端请求 ID,

## 用它

换取实时协议客户端的进程后端对象.保持相同的连接:

- 在连接前的录取记录.
- 在能力曝光之前的后端发现.
- 在授权之前的合格公众名称.
- 在列表或电话之前,点描述符.
- 在转发前,每次请求的新型元数据.
- 在返回之前验证结果.

## 运送它

这一课是很好的.`outputs/skill-gateway-bootstrap.md`它生产了一个现代化的门户设计,涵盖入口,发现,录取,命名空间,授权,缓存,流媒体,订阅,MRTR,任务,可观察性和遗产隔离.

## 运动

1. 添加跟踪文本到外部和转发的请求元数据,并记录在审计事件中相关性.
2. 添加一个可执行任务的后端和路线`tasks/get`按任务ID`Mcp-Name`现在,我们要去.
3. 改变一个后端描述符,证明发现和直接调用都被阻止了.
4. 添加一个主要特定的服务器功能,并解释为什么发现必须保持私密缓存.
5. 写一个旧的适配器界面,而不需要添加任何旧状态到现代的`Gateway`课程.

## 关键词

| Term | Meaning |
|------|---------|
| MCP gateway | Policy and routing server between clients and backend MCP servers |
| Admission record | Evidence and policy decision allowing one backend into the gateway |
| Qualified tool name | Stable public route such as `notes.search` |
| Descriptor pin | Approved digest checked during discovery and dispatch |
| Private cache scope | Cached result restricted to one authorization context |
| Request-scoped SSE | Streaming response attached to one POST request |
| `subscriptions/listen` | Client-opened SSE stream for selected long-lived change notifications |
| Task route | Application mapping from an opaque task id to its backend |
| Legacy adapter | Explicit version-gated boundary for old handshake and session behavior |

## 进一步阅读

- [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [Official Registry server.json requirements](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/server-json/official-registry-requirements.md)
- [MCP Tasks extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
