# 无国籍服务器可访问的文本

> 工具执行操作.资源暴露可地址的内容.提示用户选择的信息模板.一个好的MCP服务器将这些合同保持分开和可预测.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lesson 07 (Building an MCP Server), Phase 13, Lesson 09 (MCP Transports)
**Time:** ~60 minutes

## 学习目标

- 选择消费者的意图中的工具,资源和提示.
- 通过强制性的方式宣传资源和即时地表面`server/discover`现在,我们要去.
- 建立确定性`resources/list`其他`prompts/list`结果.
- 申请`ttlMs`其他`cacheScope`没有泄露用户特定数据.
- 返回JSON-RPC错误`-32602`对于无效或未知资源URI.
- 打开一个`subscriptions/listen`通过订阅ID将每个事件进行 POST-响应流和相关联.
- 处理资源内容和提示模板作为不值得信赖的服务器输出.

## 首先要从消费者开始

滥用MCP的最简单方法是从实施代码开始.数据库查询成为一个工具,因为功能熟悉.可重复使用的工作流成为资源,因为它存储在文件中.提示成为隐藏的政策,因为主机可以注射它.

首先要知道谁选择,他们期待什么.

| Primitive | Primary intent | Selection owner | Typical result |
|---|---|---|---|
| Tool | Perform an operation | Model or application | Structured action result |
| Resource | Read content at a URI | Host, application, or user | Text or binary content |
| Prompt | Start a reusable message workflow | User through host UI | One or more prompt messages |

给我一个笔记`notes://note-1`由于它是可地址的内容,它是资源. `delete_note`它们是工具,因为它们改变了状态.`review_note`是一个提示,因为用户选择了准备的审查工作流程.

不要把这三项操作都暴露出来,只是为了看起来完整.每一个额外的表面都需要发现,授权,缓存,处理错误,测试和文件.

## 无国籍人包2026-07-28

本课程针对MCP协议修订`2026-07-28`没有启动手握或协议会议.每个请求都包含其协议版本和客户端功能在保留中.`_meta`关键.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": {
        "name": "course-client",
        "version": "1.0.0"
      },
      "io.modelcontextprotocol/clientCapabilities": {}
    }
  }
}
```

服务器必须实现`server/discover`结果广告支持
版本,资源和快速功能,实施身份,以及
客户端可能直接调用另一种方法,但发现给它
在构建UI之前,需要一个稳定的快照.

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "resources": {"listChanged": true, "subscribe": true},
    "prompts": {"listChanged": true}
  },
  "ttlMs": 3600000,
  "cacheScope": "public"
}
```

结果是正常的`"resultType": "complete"`答案`_meta`确定服务执行的情况`io.modelcontextprotocol/serverInfo`对于诊断而言,这些信息是有用的.它不是身份验证.`-32022`要求修改和服务器支持修改.

无国籍合约改变了您的设计本能.列表不能依赖于一个连接的先前调用.授权可能会改变可见的集合,因为凭证是请求输入,但连接历史不能.

## 资源是稳定的URI合同

资源是由URI识别的内容. 在处理器之前设计URI.

良好的URI特性:

- 足以预示或通过请求之间的稳定性.
- 给服务器域名空间.
- 独立于进程身份证或连接.
- 在存储访问前验证.
- 在每一次阅读中都得到授权.

`notes://note-1`没有什么比`note-1`因为它的名字空间是明确的.`file://`解决符号链接和相对段落后,它仍然必须检查配置目录边界.

`resources/list`确定性顺序防止噪音缓存错失,改变快照和主机UI在更新之间跳跃.

```json
{
  "resultType": "complete",
  "resources": [
    {
      "uri": "notes://note-1",
      "name": "Architecture decision",
      "description": "Why the service uses a stateless boundary",
      "mimeType": "text/markdown"
    }
  ],
  "ttlMs": 300000,
  "cacheScope": "public",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "notes-server",
      "version": "2.0.0"
    }
  }
}
```

`resources/read`返回一个或多个内容项.未知URI不是成功的空读.当前资源规格将无效或未知资源URI分配给 JSON-RPC无效参数,代码 `-32602`现在,我们要去.

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "error": {
    "code": -32602,
    "message": "Unknown or invalid resource URI",
    "data": {
      "uri": "notes://missing"
    }
  }
}
```

这种区别使客户端能够将缺席与有效的空文件分开.

### 资源模板

资源模板描述了一个参数化的URI家族. 列出每个具体项目时使用一个. 例如,`notes://projects/{project}/decisions/{decision}`告诉客户如何形成有效地址,而不返回每一个决定.

模板不会削弱验证.解析变量,应用授权,执行长度和字符限制,并构建使用输入参数的存储查询.永远不要将任意的URI尾巴连接到文件系统路径或数据库声明中.

### 内容不是可信的指令

资源文本可能包含即时注射,秘密,误导命令或错误的标记.主机应该保留来源,并将资源内容视为数据.服务器应该限制内容大小,返回准确的MIME类型,编辑调用者无法访问的字段,避免返回无关记录.

## 提示是用户控制的模板

简单的MCP提示是为用户选择设计的.主机可以将它们作为切片命令,菜单项或工作流按.协议不需要一个UI.

`prompts/list`每个提示需要一个稳定的名称,一个有用的描述和参数声明,让主机收集输入之前`prompts/get`现在,我们要去.

```json
{
  "resultType": "complete",
  "prompts": [
    {
      "name": "review_note",
      "title": "Review a note",
      "description": "Review one note for a named concern",
      "arguments": [
        {
          "name": "uri",
          "description": "The note resource URI",
          "required": true
        }
      ]
    }
  ],
  "ttlMs": 600000,
  "cacheScope": "public"
}
```

`prompts/get`解决参数成消息. 它不取代主机的系统说明.主机决定如何返回消息进入模型背景,并将自己的可信度政策放在更高的优先级.

验证服务器边界的提示参数.提示URI应通过直接资源阅读的相同授权检查.不要使提示作为资源访问的侧通道.

## 缓存提示是正确的部分

`ttlMs`告诉客户,结果可以再使用多久. `cacheScope`描述谁可能分享存储值.

| Scope | Meaning | Typical use |
|---|---|---|
| `public` | May be reused across users when authorization permits | Public prompt catalog |
| `private` | Bound to the requesting user or credential context | User-owned note content |

根据数据的变化速度和延迟损害,选择一个TTL.五分钟可能适合公开提示目录.私人笔记阅读可能需要一分钟.

只有MCP定义了`public`其他`private`作为`cacheScope`对于一个秘密的结果或快速变化的结果,返回`cacheScope: "private"`随着`ttlMs: 0`通过"存储器"的方法,`no-store`本身不是MCP`cacheScope`价值

缓存提示永远不会取代授权.缓存密钥必须包含所有改变可见性的请求维度,包括租户,用户,范围,本地和页面化缓冲器.如果共享缓存无法安全表达这些维度,则使用`private`没有任何店铺政策.

## 订阅使用客户开放的响应流

现代订阅模式取代了前一种模式.`resources/subscribe`通过RPC和旧的HTTP GET事件终点.

客户发送了`subscriptions/listen`通过流式HTTP,这是一个POST,其响应仍然作为SSE流开放.`notifications`服务器不得提供未请求的通知类型.

```json
{
  "jsonrpc": "2.0",
  "id": 17,
  "method": "subscriptions/listen",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "course-client",
        "version": "1.0.0"
      }
    },
    "notifications": {
      "resourcesListChanged": true,
      "promptsListChanged": true,
      "resourceSubscriptions": [
        "notes://note-1"
      ]
    }
  }
}
```

请求 ID 是订阅 ID. 在任何请求事件之前,服务器发送`notifications/subscriptions/acknowledged`服务器只接受的子集.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/subscriptions/acknowledged",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": 17
    },
    "notifications": {
      "resourcesListChanged": true,
      "resourceSubscriptions": [
        "notes://note-1"
      ]
    }
  }
}
```

后来的每一个事件都包含相同的元数据.

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/updated",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/subscriptionId": 17
    },
    "uri": "notes://note-1"
  }
}
```

客户端再次阅读了它.`resources/read`根据目前的授权,它不假设事件包含新的文件.

通过 HTTP,关闭响应流取消订阅.一个结束流的服务器优雅地返回一个最终的 服务器 通过 HTTP 关闭响应流取消订阅.`resultType: "complete"`与原始请求相关的反应.

您不能使用订阅流作为协议会议. 后续阅读仍然是完整的请求,可以达到任何健康的服务器实例.

```figure
t3-primitive-sort
```

## 互动实验室

使用这个图表来分类一个项目跟踪器的五个功能:问题细节,创建问题,冲刺审查模板,项目政策和关闭问题.然后决定哪些列表可以向公众缓存,哪些列表必须保持私密,哪些资源应该更新通知.

如果模型执行操作,请使用工具.如果主机阅读了URI地址的内容,请使用资源.如果用户启动一个准备的消息工作流程,请使用提示.

## 实践实验室

运行模拟器从存储器根:

```bash
cd phases/13-tools-and-protocols/10-mcp-resources-and-prompts/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

检查转录的顺序:

1. 确认`server/discover`广告目前的修改和两项功能.
2. 确认列表结果均有序,并使用`resultType: "complete"`现在,我们要去.
3. 确认列表,并阅读结果带有故意缓存提示.
4. 改变读取URI为`notes://missing`观察`-32602`现在,我们要去.
5. 确认订阅确认之前的资源事件.
6. 确认活动,并以优雅的方式关闭,同时携带订阅身份证.`5`现在,我们要去.

 Python 模型不会打开真正的 HTTP 连接.它代表一个 SDK 必须在请求范围响应流中放置的信息.使用官方 SDK 为框架和输送在生产中.

## 运输的文物

`outputs/skill-primitive-splitter.md`是MCP原始选择的可重复使用设计审查.它现在检查了确定性发现,缓存范围,无效的URI行为和现代订阅过器.

课程也会带来影响.`assets/primitive-split.svg`对于非线学习,原始和订阅界限的静态版本.

## 检查

```bash
cd phases/13-tools-and-protocols/10-mcp-resources-and-prompts/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

预期结果:主程序打印一个JSON转录,测试命令报告至少12次通过测试.

## 石连接

包含一个确定性目录快照,一个授权资源阅读,一个快速分辨率,一个不有效的URI案例和一个订阅转录.

您的证据应该表明,没有列表依赖于连接历史,并且订阅事件从来没有允许访问底层资源.

## 运动

1. 添加一个`notes://projects/{project}/notes/{id}`资源模板并验证两个变量.
2. 添加页面`resources/list`保持确定性秩序.
3. 改变一个资源为`cacheScope: "private"`随着`ttlMs: 0`添加一个主机级别的禁店政策,并解释了这两个控制的威胁.
4. 添加提示列表变更订阅,证明当过器遗漏时没有发送事件`promptsListChanged`现在,我们要去.
5. 创建两个同时订阅,证明每个事件都包含了正确的请求ID.
6. 添加一个被读取处理器的权限,证明缓存输入不能跨越主题.

## 关键词

- **Resource:**通过MCP服务器暴露的URI地址内容.
- **Prompt:**通过MCP服务器暴露的用户控制信息模板.
- **Deterministic list:**发现结果,有稳定的成员和订单相同的请求输入.
- **`ttlMs`:**缓存新鲜度持续时间在毫秒.
- **`cacheScope`:**为了缓存结果的共享界限.
- **`subscriptions/listen`:**长期的请求,其响应流提供了明确过的通知.
- **Subscription ID:**听取请求的原始身份证,在通知元数据中重复.
- **Invalid parameters:** JSON-RPC 错误`-32602`用于无效或未知资源URI.
- **Unsupported protocol version:** JSON-RPC 错误`-32022`包括`supported`其他`requested`修订
- **`server/discover`:**强制性服务器方法,返回支持的修改,功能,身份和可选缓存提示.

## 进一步阅读

- [MCP 2026-07-28 Resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)
- [MCP 2026-07-28 Prompts](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts)
- [MCP 2026-07-28 Subscriptions](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions)
- [MCP 2026-07-28 Caching](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/caching)
