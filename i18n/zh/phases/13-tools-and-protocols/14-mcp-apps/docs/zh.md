# 无状态协议上的 MCP Apps

> 交互式结果仍然是一次 MCP 工具与资源的交换。2026-07-28 核心使这种交换自包含，而 Apps 扩展则增加了沙箱化的浏览器界面。

**Type:** 构建
**Languages:** Python
**Prerequisites:** 阶段 13 · 07（MCP 服务器）、阶段 13 · 10（资源）
**Time:** 约 75 分钟

## 学习目标

- 通过 `server/discover` 和每请求扩展能力通告 MCP Apps。
- 在工具被调用之前，在该工具上声明一个 `ui://` 资源。
- 在 2026-07-28 无状态传输协议上返回完整的工具与资源结果。
- 将 Apps 的 `ui/initialize` 桥接消息与已移除的 MCP 核心握手区分开。
- 应用来源校验、沙箱、CSP 以及最小权限原则。

## 问题所在

文本结果可以描述一个时间线，却无法给用户一个可筛选、可查看、可操作的时间线。

MCP Apps 通过一个可选扩展解决呈现问题。工具定义指向一个 `ui://` 资源。宿主可以在工具运行之前获取并审查该资源，将其渲染在沙箱化的 iframe 中，并通过 JSON-RPC 桥接中介所有应用操作。

核心协议在 2026-07-28 发生了变化。不要把 App 包裹在旧的连接生命周期中：

- 不存在核心的 `initialize` 请求或 `notifications/initialized` 通知。
- 不存在 `Mcp-Session-Id` 请求头。
- 每个请求都在 `params._meta` 中携带协议版本和客户端能力。
- 服务器实现 `server/discover`，以便客户端可以检查版本、核心能力和扩展。
- 每个成功的结果都有一个 `resultType` 判别字段。
- Streamable HTTP 对每个请求使用一次 POST。现代的 GET 和 DELETE 入口返回 405。

Apps 桥接仍然有一个名为 `ui/initialize` 的方法。它属于 iframe postMessage 方言，并不重建核心 MCP 会话。

## 概念

### 两个协议，一个功能

保持层次清晰：

1. MCP 核心承载 `server/discover`、`tools/list`、`tools/call`、`resources/list` 和 `resources/read`。
2. MCP Apps 扩展声明 UI 并定义 iframe 到宿主的桥接。
3. 浏览器沙箱规则限制 UI 能触及的范围。

扩展标识符是 `io.modelcontextprotocol/ui`。双方都需要选择加入。客户端在每次请求的 capabilities 对象中发送扩展支持：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "server/discover",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/ui": {}
        }
      },
      "io.modelcontextprotocol/clientInfo": {
        "name": "timeline-host",
        "version": "1.0.0"
      }
    }
  }
}
```

`clientInfo` 被推荐用于诊断。它是自报告数据，不是授权身份。

### 渲染之前先发现

服务器的发现结果通告该扩展：

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "tools": {},
    "resources": {},
    "extensions": {
      "io.modelcontextprotocol/ui": {}
    }
  },
  "ttlMs": 300000,
  "cacheScope": "public",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "timeline-app-server",
      "version": "2.0.0"
    }
  }
}
```

服务器必须支持发现。客户端不必在每个操作之前都调用发现，因为每个操作都自带自己的能力信息。

### 在工具定义上声明 UI

现代的 Apps 契约在 `tools/list` 中将 UI 绑定到工具：

```json
{
  "name": "notes_timeline",
  "description": "Render a timeline of notes.",
  "inputSchema": {
    "type": "object",
    "properties": {}
  },
  "_meta": {
    "ui": {
      "resourceUri": "ui://notes/timeline.html"
    }
  }
}
```

这是刻意设计的预调用元数据。宿主可以在结果请求显示之前预加载、缓存并对 HTML 做安全审查。较旧的扁平元数据键可能被兼容性代码接受，但新服务器应输出嵌套的 `_meta.ui.resourceUri` 形式。

`tools/list` 在当前核心中是可缓存的。应包含确定性排序、`ttlMs` 和 `cacheScope`。当可见工具随用户或令牌变化时，使用 `private`。

### 返回数据，让宿主绑定视图

工具调用返回普通内容外加结构化数据：

```json
{
  "resultType": "complete",
  "content": [
    {"type": "text", "text": "Timeline ready."}
  ],
  "structuredContent": {
    "notes": [
      {"id": "note-1", "title": "Discover", "created": "2026-07-28"}
    ]
  },
  "isError": false
}
```

宿主已经知道哪个视图属于该工具。不要为了重复 URI 而发明新的内容块。

### 将应用作为资源提供

服务器在发现中通告 `resources`，因此它也必须实现强制的 `resources/list` 操作。其确定性列表条目包含规范 URI、稳定名称、描述和 MIME 类型。列表结果包含 `resultType`、服务器身份元数据、`ttlMs` 和 `cacheScope`，与确定性工具列表一致。

宿主发送 `resources/read`。在 Streamable HTTP 上，该请求包含：

```text
POST /mcp
MCP-Protocol-Version: 2026-07-28
Mcp-Method: resources/read
Mcp-Name: ui://notes/timeline.html
```

请求头的值与 JSON-RPC 请求体必须一致。不一致即协议错误 `-32020`。

结果包含 HTML 资源和缓存提示：

```json
{
  "resultType": "complete",
  "contents": [
    {
      "uri": "ui://notes/timeline.html",
      "mimeType": "text/html;profile=mcp-app",
      "text": "<!doctype html>...",
      "_meta": {
        "ui": {
          "csp": {
            "connectDomains": [],
            "resourceDomains": [],
            "frameDomains": [],
            "baseUriDomains": []
          },
          "permissions": {}
        }
      }
    }
  ],
  "ttlMs": 60000,
  "cacheScope": "public"
}
```

### 将 UI 资源作为可执行内容缓存

App 资源不能与普通文本互换。它的缓存条目可以执行桥接代码、渲染工具数据并请求宿主中介的操作。应按规范的 `ui://` URI、被接纳的服务器身份与版本、资源内容摘要，以及当 `cacheScope` 为私有时的授权上下文来作为键。绝不能跨主体复用私有的 App 资源，因为即使 URI 相同，HTML 或其策略元数据也可能不同。

当其 `ttlMs` 过期、工具的 `_meta.ui.resourceUri` 绑定变化、服务器版本或被接纳的描述符指纹变化，或已被确认的资源变更订阅指向该 URI 时，应使缓存条目失效。在重新挂载之前重新获取并重新应用 CSP 与权限审查。陈旧的 iframe 不得仅因为新的资源版本尚未加载就保留更宽的权限。

### 在特性策略之前拒绝传输歧义

校验有刻意的顺序。首先校验 JSON-RPC 形状，要求协议元数据为字符串且客户端能力映射为对象。接着将路由请求头与请求体比较。只有在此之后才判断匹配到的协议版本是否受支持。这个顺序可以防止代理与服务器对不同的请求做出不同解释。

| 条件 | HTTP | JSON-RPC 错误 |
|-----------|------|----------------|
| 请求头与请求体的版本、方法或名称不一致 | 400 | `-32020` |
| 请求头与请求体一致但版本不受支持 | 400 | `-32022`，且 `data` 恰为 `{"supported":["2026-07-28"],"requested":"<actual>"}` |
| `resources/read` 缺少 Apps 扩展能力 | 400 | `-32021`，并带 `data.requiredCapabilities.extensions.io.modelcontextprotocol/ui` |
| 方法未知 | 404 | `-32601` |

JSON-RPC 通知没有 `id`，因此服务器从不会为它发出 JSON-RPC 响应。被接受的 HTTP 通知返回 202 且响应体为空。错误可以改变 HTTP 状态码，但仍然不能为通知创建 JSON-RPC 错误响应体。

### 沙箱是边界，不是信任判定

宿主控制 iframe。App 无法直接读取宿主的 cookie、本地存储或页面 DOM。所有特权操作都必须经过桥接。

使用以下默认值：

- 将所有 CSP 域名列表留空，然后只添加 App 所需的来源。fetch、XHR 和 WebSocket 使用 `connectDomains`；脚本、样式、图片和字体使用 `resourceDomains`。
- 尽可能将代码和数据打包在一起。
- 除非某个可见功能需要，否则不要请求摄像头、麦克风或位置权限。
- 将 `postMessage` 固定为精确的对端来源，并拒绝来自任何其他来源的事件。
- 将工具参数、工具结果、资源文本和桥接消息都视为不可信输入。
- 将用户同意保留在宿主中。iframe 不能批准自己的重大操作。

不要把教程中的固定 `sandbox` 属性复制到每个宿主。宿主必须根据 App 的来源模型和自身的隔离设计来选择标志位。

被允许的域名仍然是一条数据外泄路径。`connectDomains: ["https://api.example.com"]` 意味着任何在 App 内执行的脚本都可以向那里发送被允许的数据。精确来源匹配可以防止目标混淆，但不能判定载荷是否恰当。默认保持连接访问为空，避免在 iframe 中放置 bearer 令牌，可行时通过宿主代理收窄的操作，限制响应与请求的大小，并审计每次出站请求是由哪个用户操作触发的。将 `resourceDomains` 与 `connectDomains` 区别对待；加载字体或脚本的权限不应授予任意数据上传权限。

### Apps 桥接有自己的生命周期

Apps 桥接是 `postMessage` 之上的 JSON-RPC 方言。它可以交换 `ui/initialize` 和 `ui/*` 通知，并且可以代理看似核心的方法，例如 `tools/call`。

View 发送带 `appInfo` 和一个 `appCapabilities` 对象的 `ui/initialize`。宿主返回其能力和宿主上下文。只有在该响应之后，View 才发送 `ui/notifications/initialized`。宿主必须等待这条 Apps 通知后才能向 View 发送消息。

这个本地握手在一个 iframe 与一个宿主 frame 之间创建桥接。它不协商 MCP 协议版本、不创建服务器状态，也不铸造传输会话。注意确切的前缀：核心的 `notifications/initialized` 已被移除，而 Apps 的 `ui/notifications/initialized` 仍然保留。由桥接的工具调用生成的核心请求是一个新的自包含请求，带有新的 JSON-RPC id 和完整的请求元数据。

### 宿主上下文、操作与撤销

桥接初始化之后，宿主仍是权威。View 只能通过宿主通告的能力请求工具操作、导航、剪贴板使用或其他特权效果。宿主校验带类型的请求、当前用户、目标和参数，应用审批策略，并可以拒绝它。按钮点击和合法的桥接消息表达的是意图；两者都不授予权限。

将主题、尺寸和可访问性视为会变化的宿主上下文，而非一次性的渲染输入：

- 应用宿主提供的颜色与排版令牌，并在主题或对比度偏好变化时作出响应。
- 允许 View 报告期望的尺寸，但由宿主限制并应用 iframe 尺寸，使内容无法逃出布局或制造欺骗性覆盖层。
- 在 iframe 内保持键盘顺序、可见焦点、可访问名称、屏幕阅读器状态、足够的对比度、缩放以及减弱动效行为。
- 在调整大小和重新渲染之后，重新测试宿主控件与 View 控件之间的焦点转移。

在 App 打开期间，能力可能因用户更换账户、策略变化、服务器被隔离或宿主收窄同意而被撤销。应在操作时刻检查能力与授权，而不是仅在 `ui/initialize` 时检查。撤销时，拒绝待处理的特权调用、停止不再符合策略的网络活动、清除已渲染的敏感状态，并在 UI 资源本身不再被接纳时重新挂载或回退到文本。View 必须将拒绝当作正常结果处理，而不是重试直到宿主让步。

### 回退是契约的一部分

支持 Apps 的服务器仍然可以为未通告 UI 扩展的宿主服务：

- 在 `tools/list` 中返回不带 `_meta.ui` 的同一工具。
- 为 `tools/call` 保留有用的文本结果。
- 对 UI 的 `resources/read` 请求返回缺少能力的错误。
- 在判断工具是否完成时，绝不假设 iframe 存在。

```figure
t3-ui-sandbox
```

## 动手构建

`code/main.py` 在不使用 SDK 的情况下构建一个小型进程内协议模型。它校验当前的请求信封和 Streamable HTTP 路由值，通过 `server/discover` 通告 Apps，列出工具和资源，执行工具，并提供一个自包含的 HTML 资源。

该模型接收已解析的请求体和路由请求头。它不是完整的 HTTP 适配器，也不解析 `Content-Type` 或 `Accept`。完整的 Streamable HTTP 适配器（需要 `Content-Type: application/json` 以及同时包含 `application/json` 和 `text/event-stream` 的 `Accept` 值）请参见第 09 课。

运行它：

```bash
cd phases/13-tools-and-protocols/14-mcp-apps
python3 code/main.py
python3 -m unittest discover code/tests -v
```

在输出中检查四点：

1. 每次调用都是独立的。
2. 每个请求都带有 `_meta` 能力。
3. `resources/list` 在任何资源读取之前返回稳定的描述符。
4. 每个结果都有 `resultType` 和服务器身份元数据。
5. 不出现任何核心会话标识符。

## 使用它

从 `server/discover` 开始。确认 `io.modelcontextprotocol/ui` 出现在服务器的扩展映射中。然后调用 `tools/list` 两次，一次带 Apps 能力，一次不带。第一次响应声明了资源。第二次仍是一个可用的纯文本工具。

阅读 `ui://notes/timeline.html`。在 HTML 中搜索 `hostOrigin` 和 `event.origin` 守卫。这两行是桥接不使用通配符目标的最小可见证据。

## 交付它

本课交付 `outputs/skill-mcp-apps-spec.md`。在编写框架代码之前，用它来审查 App 契约。它迫使作者明确当前的核心信封、扩展协商、回退、UI 资源、缓存策略、CSP、权限、桥接方法和同意边界。

## 练习

1. 将客户端能力改为空的扩展映射。确认 `tools/list` 保留工具但移除 UI 绑定。
2. 发送读取时间线的 `Mcp-Name: ui://notes/other.html` 请求体。确认错误 `-32020`。
3. 将资源改为 `cacheScope: private`。描述支持这一改动的用户特定条件。
4. 将脚本移至 `https://static.example.com/app.js`。将该来源加入 `resourceDomains` 并解释新的供应链风险。
5. 添加一个 `notes_open` 工具，并将按钮点击经由宿主路由。将用户批准保留在宿主中。

## 关键术语

| 术语 | 含义 |
|------|---------|
| MCP Apps | 由 MCP 宿主渲染交互式 HTML 的可选扩展 |
| `io.modelcontextprotocol/ui` | 双方对等方通告的扩展标识符 |
| `ui://` | App 的 UI 模板所用的资源 scheme |
| `text/html;profile=mcp-app` | MCP App HTML 的 MIME 类型 |
| `server/discover` | 当前用于协议与能力发现的 RPC |
| `resources/list` | 服务器通告资源时必须实现的资源列表方法 |
| `resultType` | 现代成功结果所必需的判别字段 |
| `ui/initialize` | Apps 桥接的首个请求，与已移除的核心初始化相互独立 |
| `ui/notifications/initialized` | 在宿主响应之后由 Apps View 发送的就绪通知 |
| CSP | 限制脚本、样式、图片和网络来源的浏览器策略 |
| 文本回退 | 为不支持 Apps 的宿主保留的工具行为 |

## 延伸阅读

- [MCP 2026-07-28 基础协议](https://modelcontextprotocol.io/specification/2026-07-28/basic)
- [MCP Apps 概述](https://modelcontextprotocol.io/extensions/apps/overview)
- [MCP Apps 构建指南](https://modelcontextprotocol.io/extensions/apps/build)
- [官方扩展支持矩阵](https://modelcontextprotocol.io/extensions/client-matrix)