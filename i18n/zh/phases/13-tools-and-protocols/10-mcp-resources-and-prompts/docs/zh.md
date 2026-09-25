# MCP 资源与提示：面向无状态服务器的可寻址上下文

> 工具执行操作。资源暴露可寻址内容。提示打包用户选择的消息模板。一个好的 MCP 服务器会让这三种契约保持分离且行为可预测。

**Type:** Build
**Languages:** Python
**Prerequisites:** 阶段 13，第 07 课（构建 MCP 服务器）、阶段 13，第 09 课（MCP 传输层）
**Time:** 约 60 分钟

## 学习目标

- 根据消费者的意图在工具、资源和提示之间做出选择。
- 通过强制的 `server/discover` 公布资源和提示的接口。
- 构建确定性的 `resources/list` 和 `prompts/list` 结果。
- 在不泄露用户特定数据的前提下应用 `ttlMs` 和 `cacheScope`。
- 对无效或未知的资源 URI 返回 JSON-RPC 错误 `-32602`。
- 打开 `subscriptions/listen` POST 响应流，并通过订阅 ID 关联每个事件。
- 将资源内容和提示模板视为不可信的服务器输出。

## 从消费者出发

误用 MCP 最简单的方式是从实现代码入手。一次数据库查询会变成工具，因为函数更熟悉。一个可复用的工作流会变成资源，因为它存储在文件中。一个提示会变成隐藏策略，因为宿主可以注入它。

应该从“由谁选择”以及“他们期望什么”开始。

| 原语 | 主要意图 | 选择者 | 典型结果 |
|---|---|---|---|
| 工具 | 执行一个操作 | 模型或应用程序 | 结构化的操作结果 |
| 资源 | 读取某个 URI 处的内容 | 宿主、应用程序或用户 | 文本或二进制内容 |
| 提示 | 启动一个可复用的消息工作流 | 用户通过宿主 UI | 一条或多条提示消息 |

`notes://note-1` 处的一条笔记是资源，因为它是可寻址内容。`delete_note` 是工具，因为它会改变状态。`review_note` 是提示，因为用户选择了一个准备好的评审工作流。

不要仅仅为了看起来功能完整，就把同一个操作以三种原语全部暴露。每个额外的接口都需要发现、授权、缓存、错误处理、测试和文档。

## 2026-07-28 无状态信封

本课针对 MCP 协议修订版 `2026-07-28`。在此配置中没有初始化握手，也没有协议会话。每个请求都在保留的 `_meta` 键中携带其协议版本和客户端能力。

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

服务器必须实现 `server/discover`。其结果公布所支持的版本、资源和提示能力、实现标识以及缓存提示。客户端可以直接调用另一个方法，但发现调用让它在构建 UI 之前获得一个稳定的快照。

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

正常的结果声明 `"resultType": "complete"`。响应的 `_meta` 通过 `io.modelcontextprotocol/serverInfo` 标识提供服务的实现。此信息对诊断有用，但不是身份认证标识。携带不受支持的修订版的请求会返回 `-32022`，其中同时包含请求的修订版和服务器支持的修订版。

无状态契约改变了你的设计直觉。列表不能依赖于某条连接上先前的一次调用。授权可以改变可见集合，因为凭据是请求的输入，但连接历史绝不能影响结果。

## 资源是稳定的 URI 契约

资源是由 URI 标识的内容。先设计 URI，再写处理程序。

良好的 URI 属性：

- 足够稳定，可被收藏或在请求之间传递。
- 以服务器自身的域进行命名空间隔离。
- 与进程 ID 或连接无关。
- 在访问存储之前完成校验。
- 每次读取时都进行授权。

`notes://note-1` 比 `note-1` 更好，因为它的命名空间是显式的。文件服务器可以使用 `file://` URI，但在解析符号链接和相对路径段之后，仍必须检查配置的目录边界。

`resources/list` 返回调用者当前可见的资源。按稳定键（如 URI）排序。确定性的顺序可以避免嘈杂的缓存失效、快照变化，以及宿主 UI 在刷新之间的跳动。

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

`resources/read` 返回一个或多个内容项。未知 URI 不是一次成功的空读取。当前的 Resources 规范将无效或未知的资源 URI 归为 JSON-RPC 无效参数，代码 `-32602`。

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

这一区分让客户端能够把“不存在”与“合法的空文档”分开。它还防止意外回退到更宽泛的查找。

### 资源模板

资源模板描述一族参数化的 URI。当列出每个具体条目的代价过高或数量无界时使用它。例如，`notes://projects/{project}/decisions/{decision}` 告诉客户端如何构造一个有效地址，而不必返回每个决策。

模板不会削弱校验。解析变量、执行授权、强制长度和字符限制，并使用类型化参数构造存储查询。绝不要把任意 URI 尾部拼接进文件系统路径或数据库语句。

### 内容不是可信指令

资源文本可能包含提示注入、机密信息、误导性命令或畸形标记。宿主应保留来源信息，并将资源内容当作数据处理。服务器应限制内容大小、返回准确的 MIME 类型、脱敏调用者无权访问的字段，并避免返回无关记录。

## 提示是用户控制的模板

MCP 提示是为显式的用户选择而设计的。宿主可以将它们呈现为斜杠命令、菜单项或工作流按钮。协议不要求某种特定 UI。

`prompts/list` 对于相同的请求授权应当是确定性的。每个提示需要稳定的名称、有用的描述，以及让宿主能在 `prompts/get` 之前收集输入的参数声明。

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

`prompts/get` 将参数解析为消息。它不取代宿主的系统指令。宿主决定返回的消息如何进入模型上下文，并保持自身可信策略的更高优先级。

在服务器边界校验提示参数。提示 URI 应通过与直接资源读取相同的授权检查。不要把提示当作绕过资源访问的侧信道。

## 缓存提示是正确性的一部分

`ttlMs` 告诉客户端结果可以被复用多长时间。`cacheScope` 描述谁可以共享该缓存值。

| 范围 | 含义 | 典型用途 |
|---|---|---|
| `public` | 在授权允许时可在用户之间复用 | 公共提示目录 |
| `private` | 绑定到发起请求的用户或凭据上下文 | 用户拥有的笔记内容 |

根据数据的变化速率和过期造成的损害选择 TTL。五分钟可能适合公共提示目录。私有笔记的读取可能使用一分钟。

MCP 只定义了 `public` 和 `private` 作为 `cacheScope` 值。对于包含机密或快速变化的结果，返回 `cacheScope: "private"` 并附带 `ttlMs: 0`，然后在宿主缓存策略中应用更严格的 no-store 规则。`no-store` 本身不是 MCP 的 `cacheScope` 值。

缓存提示绝不替代授权。缓存键必须包含改变可见性的每个请求维度，包括租户、用户、范围、区域设置和分页游标。如果共享缓存无法安全地表达这些维度，使用 `private` 并将 TTL 设为零，同时在宿主层面采用 no-store 策略。

## 订阅使用客户端打开的响应流

现代订阅模式取代了以前的 `resources/subscribe` RPC 和旧的 HTTP GET 事件端点。

客户端将 `subscriptions/listen` 作为普通 JSON-RPC 请求发送。在 Streamable HTTP 上，这是一个 POST，其响应保持打开状态作为 SSE 流。`notifications` 对象是一个允许列表。服务器不得投递未被请求的通知类型。

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

请求 ID 就是订阅 ID。在任何被请求的事件之前，服务器发送 `notifications/subscriptions/acknowledged`。其过滤器只包含服务器接受的子集。

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

该流上后续的每个事件都携带相同的元数据。

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

通知表示资源已变化。客户端在当前授权允许的情况下通过 `resources/read` 再次读取。它不应假设事件中包含新文档。

多个订阅可以共享一条 stdio 通道。订阅 ID 让客户端能够多路分用。在 HTTP 上，关闭响应流即取消订阅。优雅结束流的服务器会返回一个与原始请求相关联的最终 `resultType: "complete"` 响应。

不要把订阅流当作协议会话。后续读取仍然是一个完整的请求，可以到达任意健康的服务器实例。

```figure
t3-primitive-sort
```

## 交互实验

使用图示对项目跟踪器中的五项能力进行分类：议题详情、创建议题、冲刺评审模板、项目策略和关闭议题。然后决定哪些列表可以公开缓存、哪些读取必须保持私有，以及哪些资源值得发送更新通知。

对每个分类，说出选择者是谁。如果模型执行操作，使用工具。如果宿主读取 URI 寻址的内容，使用资源。如果用户启动一个准备好的消息工作流，使用提示。

## 练习实验

从仓库根目录运行模拟器：

```bash
cd phases/13-tools-and-protocols/10-mcp-resources-and-prompts/code
python3 main.py
python3 -m unittest discover tests -v
```

按以下顺序查看对话记录：

1. 确认 `server/discover` 公布当前修订版和两项能力。
2. 确认两个列表结果都已排序并使用 `resultType: "complete"`。
3. 确认列表和读取结果带有有意的缓存提示。
4. 将读取 URI 改为 `notes://missing`，并观察 `-32602`。
5. 确认订阅确认先于资源事件。
6. 确认事件和优雅关闭都携带订阅 ID `5`。

Python 模型不会打开真实的 HTTP 连接。它表示 SDK 必须放置在请求作用域响应流上的消息。在生产环境中，请使用官方 SDK 处理帧协议和传输。

## 交付产物

`outputs/skill-primitive-splitter.md` 是一个可复用的 MCP 原语选择设计评审。它现在检查确定性发现、缓存范围、无效 URI 行为以及现代订阅过滤器。

本课还附带 `assets/primitive-split.svg`，即原语与订阅边界的静态版本，供离线学习。

## 自我验证

```bash
cd phases/13-tools-and-protocols/10-mcp-resources-and-prompts/code
python3 main.py
python3 -m unittest discover tests -v
```

预期结果：主程序打印一条 JSON 对话记录，且测试命令报告至少十二个通过的测试。

## 毕业项目关联

当你的毕业项目服务器需要在操作之外暴露可寻址知识时，请使用本契约。包含一个确定性目录快照、一次经过授权的资源读取、一次提示解析、一个无效 URI 用例，以及一条订阅对话记录。

你的证据应表明：没有任何列表依赖于连接历史，且订阅事件绝不会授予对底层资源的访问权限。

## 练习题

1. 添加一个 `notes://projects/{project}/notes/{id}` 资源模板并校验两个变量。
2. 为 `resources/list` 添加分页，同时保持确定性顺序。
3. 将一个资源改为 `cacheScope: "private"` 并附带 `ttlMs: 0`，添加宿主层面的 no-store 策略，并解释同时需要这两项控制的威胁。
4. 添加一个提示列表变更订阅，并证明当过滤器省略 `promptsListChanged` 时不会发送任何事件。
5. 创建两个同时进行的订阅，并证明每个事件都携带正确的请求 ID。
6. 为读取处理程序添加授权主体，并证明缓存条目不会跨主体共享。

## 关键术语

- **资源：** MCP 服务器暴露的 URI 寻址内容。
- **提示：** MCP 服务器暴露的用户控制消息模板。
- **确定性列表：** 对于相同的请求输入，成员和排序稳定不变的发现结果。
- **`ttlMs`：** 以毫秒为单位的缓存新鲜度时长。
- **`cacheScope`：** 缓存结果的共享边界。
- **`subscriptions/listen`：** 一种长时间保持的请求，其响应流投递显式过滤的通知。
- **订阅 ID：** 原始监听请求的 ID，在通知元数据中重复出现。
- **无效参数：** JSON-RPC 错误 `-32602`，用于无效或未知的资源 URI。
- **不支持的协议版本：** JSON-RPC 错误 `-32022`，涵盖 `supported` 和 `requested` 修订版。
- **`server/discover`：** 强制的服务器方法，返回支持的修订版、能力、标识以及可选的缓存提示。

## 延伸阅读

- [MCP 2026-07-28 资源](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)
- [MCP 2026-07-28 提示](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts)
- [MCP 2026-07-28 订阅](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions)
- [MCP 2026-07-28 缓存](https://modelcontextprotocol.io/specification/2026-07-28/basic/utilities/caching)