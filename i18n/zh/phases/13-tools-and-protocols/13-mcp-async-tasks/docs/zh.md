# 扩大MCP任务:对无国籍核心的持续工作

> 无国籍MCP并不意味着每个操作都必须在一个请求中完成.官方任务扩展提供了长时间工作的明确持久的手柄.`tools/call`任何一个例子都能回答.`tasks/get`通过客户输入`tasks/update`没有恢复协议会议.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 11 (stateless MRTR), Phase 13 · 12 (elicitation)
**Time:** ~90 minutes

## 学习目标

- 区分无状态协议运输与耐用应用任务状态.
- 谈判`io.modelcontextprotocol/tasks`扩大每次请求能力`server/discover`现在,我们要去.
- 返回一个服务器导向的`CreateTaskResult`随着`resultType: "task"`只有在永恒的创造之后.
- 调查`tasks/get`完成任务输入`tasks/update`要求合作取消`tasks/cancel`现在,我们要去.
- 删除老人`tasks/status`现在`tasks/result`其他`tasks/list`假设
- 通过 订阅可选任务通知`subscriptions/listen`在 POST 响应 SSE 流上.
- 模型任务过期,重新启动恢复,输入键的排版,以及执行错误正确.

## 为什么任务是延长

任务首次在2025年1月25日出现为实验核心功能.`io.modelcontextprotocol/tasks`扩展,使客户和服务器可以选择额外的生命周期,

扩展规范仍然是一个草稿表面,尽管它是目前的官方主页任务. 插入 SDK 支持的扩展版本,运行符合性场景,并将线索适配器从您的工作者和存储域中隔离.

使用操作具有以下一个或多个特性时的任务:

- 要求时间可能超过普通的要求时间.
- 工人队列或外部工作系统已经拥有执行.
- 客户需要恢复,
- 执行过程中,操作暂停用户或模型输入.
- 取消和持久的结果检索是产品要求.

没有什么可做,但我们必须要做一个好事.

## 无国籍核心,国家申请

移除MCP 2026-07-28 `initialize`现在`notifications/initialized`会议,`Mcp-Session-Id`这并不禁止有国产.

任务 id 是明确的应用状态:

- 在返回之前,服务器坚持使用.
- 客户可以重新启动后存储并进行重新调查.
- 身份证可以向任何复制品提供相同的持久商店的支持.
- 每个任务方法都会检查授权.
- 过期和删除由任务领域定义,而不是运输寿命.

这从操作上来看,与连接连接的隐藏状态不同.

让四个生命分开:

| State | Lifetime | Where it belongs |
|---|---|---|
| Protocol metadata | One request | `params._meta`, validated again on every call |
| Transport work | One stdio request or HTTP response | In-flight coordinator with a bounded deadline |
| MRTR continuation | One retry sequence | Integrity-protected `requestState`, plus replay controls when needed |
| Durable task | Across requests, replicas, restarts, and reconnects | Shared application store keyed by an authorized `taskId` |

移动一个任务记录到进程内存并不能使MCP变得状态.`tasks/get`继续前回手柄,然后让每个任务方法在租户和主管检查下解决相同的共享记录.

## 能力谈判

客户在每一个符合条件的请求上宣告支持:

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

服务器返回了确切的信息`supportedVersions`其他国家`ttlMs`其他`cacheScope`其他`server/discover`由于它宣传工具,它也实施强制性`tools/list`这结果返回了确定性`generate_report`描述符,有效的对象`inputSchema`现在`resultType: "complete"`服务器身份元数据,以及公共缓存提示.

没有声明延长返回的客户端的任务方法`-32021`缺失客户能力,`data.requiredCapabilities`设置为`{"extensions":{"io.modelcontextprotocol/tasks":{}}}`没有支持的协议链返回`-32022`确切的`supported`其他`requested`输出数据; 输出缺失或非字符串版本 `-32602`现在,我们要去.

没有JSON-RPC的封面`id`接收器可能会处理它,但它不会发出任何JSON-RPC结果或错误.`202 Accepted`没有接受通知的机构.

目前,只有`tools/call`设计您的内部抽象,以便未来的请求类型不需要重写存储.

## 服务器指导任务创建

旧客户旗`params._meta.task.required`客户端宣布扩展支持,然后服务器决定是否提供特定的服务器.`tools/call`成为一个任务.

要求:

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

答案:

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

服务器不得返回此手柄,直到一个`tasks/get`在最终一致的存储中,在回答之前等待读取可见性.否则客户端可以收到一个有效的ID,然后立即得到"没有找到".

任务响应是未要求的,即客户端不要求任务模式. 它并非未经谈判:当前的请求仍然必须广告扩展.

## 任务的形状

每个任务都包含:

- `taskId`:稳定服务器生成的标识符;
- `status`其他`working`现在`input_required`现在`completed`现在`cancelled`其他`failed`其他
- `createdAt`其他`lastUpdatedAt`:ISO 8601时间标签;
- `ttlMs`:自创建到期,或`null`没有广告的限制;
- 选择性`pollIntervalMs`:服务器目前的最低建议投票时间;
- 选择性`statusMessage`面向用户或面向模型的环境.

只有当相关时,状态特定的字段才会出现:

- `input_required`包括`inputRequests`现在,我们要去.
- `completed`包括原本请求的文件`result`它们的形状.
- `failed`包含一个JSON-RPC`error`它们是什么?

客户应该尊重`pollIntervalMs`服务器可能会限制更具攻击性的民意调查,并且可能会在任务寿命中改变间隔.

## 调查`tasks/get`

客户端要求一个当前的快照:

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

`tasks/get`结果总是有着`resultType: "complete"`嵌的任务仍然可以得到`status: "working"`或`status: "input_required"`现在,我们要去.

这种区别可以防止一个常见的解析器错误:

```text
result.resultType = complete    means the tasks/get RPC finished
result.status = working        means the represented job is still running
```

没有.`tasks/result`接下来,我们将会做一个任务.`tasks/get`答案是原始的`CallToolResult`根据`result`其他:

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

外面的`resultType`现在,`tasks/get`完成了. 嵌套`result.resultType`需要一个嵌套的区分符.`CallToolResult`应该还要带着自己的.`io.modelcontextprotocol/serverInfo`没有类型的有效载荷的存储,

没有.`tasks/list`无会议服务器无法安全地推断哪些任务属于连接范围列表.需要历史记录的应用程序应该暴露出一个有权限的域名工具,有明确的过器和所有权规则.

## 执行任务时输入

任务输入和核心MRTR看起来相似,但使用不同的延续.

### 任务创建前所需的输入

返回核心`resultType: "input_required"`根据原始的版本`tools/call`客户端完成了任务,然后再尝试原来的调用,

### 任务创建后所需的输入

设定任务`input_required`现在,我们要去.`tasks/get`揭示了突出的`inputRequests`客户通过`tasks/update`客户不会再试原始`tools/call`现在,我们要去.

快速拍摄:

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

更新:

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

成功的反应是空白的承认,加上`resultType: "complete"`总之,客户继续进行投票或听取.

每个`inputRequests`重复  重复 重复 重复 重复`tasks/get`快照可能显示相同的未完成密钥;客户端将UI复制,服务器忽略对未知,取代或已经完成的密钥的响应.`input_required`在所有必要的钥匙被回答之前.

## 取消是合作的

`tasks/cancel`工作人员的工作可能会先完成,忽略取消或过渡.

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

对于所有三个任务方法,`Mcp-Name`镜子`params.taskId`没有重复JSON-RPC方法名称. `code/main.py`们的们在`make_http_request`现在,我们要去.

课程工作者立即尊重取消,并会重复打电话无权.

不要使用`notifications/cancelled`通知属于取消请求,而不是持久任务.

要求取消是针对飞行中一个JSON-RPC操作或其请求范围的HTTP响应.`tools/call`已经回来了`resultType: "task"`要求已完成,关闭运输不能提及或停止持久的工作. `tasks/cancel`具有授权的新PCP.`params.taskId`镜像是个身份证`Mcp-Name`解决任务的后端,记录合作伙伴取消意图,并返回确认,而不要求工人停止.

通过一个网关,请求协调器和任务路线必须在不同的表格中存储.请求表可能会在响应完成时消失.任务路线必须存活到终端状态和保留期限到期. [Lesson 29: MCP Reliability, Cancellation, and Flow Control](../../29-mcp-reliability-cancellation-and-flow-control/docs/en.md)建立竞赛,时间过期,无力,压力,再试规则.

## 选择性通知

客户想要推送更新的发送`subscriptions/listen`对于 Streamable HTTP,这是一个 POST,其响应是请求-scoped SSE 流.没有独立的 GET 事件流和没有协议会议保持活跃.

服务器确认接受的ID`notifications/subscriptions/acknowledged`然后可以通过全息图发送`notifications/tasks`确认和每项任务通知都包含`io.modelcontextprotocol/subscriptionId`在`_meta`等于`subscriptions/listen`要求 id. 其他情况下,每个任务通知等于`tasks/get`现在,我会回来.

客户仍然必须声明任务扩展. 他们应该从持久的任务ID重新连接和恢复,而不是依赖于事件重播或`Last-Event-ID`现在,我们要去.

## 失败语义

运用两个错误层正确.

### 协议错误

无效方法参数或未知的任务ID返回JSON-RPC错误,通常是`-32602`缺失延期支持的回报`-32021`具有所需能力对象.

### 任务执行结果

- 具有正常的工具结果`isError: true`现在还在`completed`由于工具调用产生了所定义的结果.
- 延期执行过程中出现了JSON-RPC错误,使得任务完成`failed`存储在 中的 JSON-RPC 错误`error`现在,我们要去.
- 用户拒绝可能会产生`cancelled`文件文件,文件文件,文件文件,文件文件,文件文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,文件,

## 长期,期限和所有权

保持至少任务 id,状态,时间标签, ttl,投票间隔,最初操作所有权,结果或错误,未完成的输入请求以及所有发行的输入密钥.

存储密钥必须包含或解决一个权威的租户和主管.知道一个任务ID不能允许访问. 检查所有权`tasks/get`现在`tasks/update`现在`tasks/cancel`加入

`ttlMs`服务器可能会失败,然后删除过期任务.不要描述它为承诺保留完成结果完成后的数毫秒.

课程编写一个临时文件,并将其原子改名.多重复制服务应该使用共享的持久存储器和工人租或同等的同时控制.

```figure
tp-task-lifecycle
```

## 建立它

`code/main.py`执行确定性任务服务:

- `server/discover`收益`supportedVersions`预存提示,和任务扩展.
- `tools/list`返回一个确定性,可缓存的`generate_report`具有有效输入方案的描述符.
- `tools/call`在返回之前创建和持续任务`resultType: "task"`现在,我们要去.
- 重新启动恢复的新服务实例重新加载相同任务.
- `tasks/get`返回完整任务快照.
- 工人从`working`为了`input_required`现在,我们要去.
- `tasks/update`接受表格回复并返回空白的完全确认.
- 工人存储一个子`CallToolResult`自己的`resultType`服务器身份,然后转向`completed`现在,我们要去.
- `tasks/cancel`在此实施中,它是无力的.
-  HTTP 构建器设置`Mcp-Name`为了`params.taskId`为了`tasks/get`现在`tasks/update`其他`tasks/cancel`现在,我们要去.
- 通知助理使用`notifications/subscriptions/acknowledged`其他`notifications/tasks`两者都标记着听取请求的身份.
- 无 id 的通知没有产生 JSON-RPC 响应.

工人显然进步,而不是睡在背景线程中. 这使得每个状态过渡都具有确定性,并且使协议示例与队列机制保持分开.

## 用它

根据数据库根:

```bash
cd phases/13-tools-and-protocols/13-mcp-async-tasks/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

预期结果序列:

```text
id=0 resultType=complete status=ack
id=1 resultType=task status=working
id=2 resultType=complete status=working
id=3 resultType=complete status=input_required
id=4 resultType=complete status=ack
id=5 resultType=complete status=completed
```

检查一下`tasks/status`现在`tasks/result`其他`tasks/list`报价方法在现代服务中没有找到.
检查一下`tools/list`现在的 HTTP 任务方法都反映了其任务 id 通过`Mcp-Name`现在,我们要去.

## 运送它

`outputs/skill-task-store-designer.md`现在生产一个知情的扩展设计:能力谈判,持续前回归创建,当前的方法,输入更新流量,所有权,过期,取消,订阅和从删除的实验方法迁移.

## 运动

1. 添加第二个未完成输入键.`tasks/update`证明任务仍然存在`input_required`直到两个钥匙都被回答.
2. 增加租户的所有权,并拒绝由错误的认证主体提供的有效任务身份.
3. 增加到到期的工人租合同. 证明两个服务实例不能同时完成同一个任务.
4. 实现一个POST响应SSE适配器`subscriptions/listen`不要添加GET,`Last-Event-ID`没有任何问题,
5. 加入过期清理. 区分过期任务与错误的任务身份证,而不会泄露跨租户存在.

## 关键词

| Term | Meaning in the current extension |
|------|----------------------------------|
| Tasks extension | Optional `io.modelcontextprotocol/tasks` capability for durable async work |
| `CreateTaskResult` | Server-directed `resultType: "task"` response to an eligible request |
| `tasks/get` | Poll a full current task snapshot, including terminal result or pending input |
| `tasks/update` | Submit responses to a task's outstanding `inputRequests` |
| `tasks/cancel` | Acknowledge cooperative cancellation intent |
| `input_required` | Task status indicating client input is outstanding |
| `pollIntervalMs` | Server-suggested minimum delay before another poll |
| `ttlMs` | Expiry duration measured from task creation |
| Durable-before-return | Rule that the task id must resolve before its handle is sent |
| `notifications/tasks` | Optional full task snapshot delivered on a subscribed SSE response |

## 遗产兼容性

根据客户要求,`tasks/status`现在`tasks/result`其他选择性`tasks/list`现在的客户端使用扩展功能,接受服务器导向手柄,投票`tasks/get`提供输入`tasks/update`读取任务快照的最终结果.

## 进一步阅读

- [Official MCP Tasks extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
