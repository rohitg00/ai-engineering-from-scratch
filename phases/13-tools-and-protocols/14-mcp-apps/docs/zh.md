# 14 · MCP 应用——通过 `ui://` 提供交互式 UI 资源

> 纯文本的工具输出限制了智能体（agent）能够展示的内容。MCP 应用（MCP Apps，SEP-1724，于 2026 年 1 月 26 日正式发布）让一个工具能够返回沙箱化的交互式 HTML，并内联渲染在 Claude Desktop、ChatGPT、Cursor、Goose 和 VS Code 中。仪表盘、表单、地图、3D 场景，全部通过同一套扩展实现。本课将逐一讲解 `ui://` 资源方案、`text/html;profile=mcp-app` 这一 MIME 类型、iframe 沙箱的 postMessage 协议，以及让服务器渲染 HTML 所带来的安全攻击面。

**类型：** 实践
**语言：** Python（标准库，UI 资源发射器）、HTML（示例应用）
**前置：** 第 13 阶段 · 07（MCP 服务器）、第 13 阶段 · 10（资源）
**时长：** 约 75 分钟

## 学习目标

- 从一次工具调用中返回 `ui://` 资源，并设置正确的 MIME 类型与元数据。
- 通过 `_meta.ui.resourceUri`、`_meta.ui.csp` 和 `_meta.ui.permissions` 声明某个工具关联的 UI。
- 实现 iframe 沙箱的 postMessage JSON-RPC，用于 UI 向宿主（host）通信。
- 应用「内容安全策略（CSP，Content-Security-Policy）」与权限策略（permissions-policy）的默认值，以防御源自 UI 的攻击。

## 问题所在

一个 2025 年时代的 `visualize_timeline` 工具会返回「这里有按时间顺序排列的 14 条笔记：……」。这只是一段文字。但用户真正想要的是可交互的时间线。在 MCP 应用出现之前，可选方案只有：客户端专有的小组件 API（Claude 的 artifacts、OpenAI 的 Custom GPT HTML），或者干脆没有 UI。

MCP 应用（SEP-1724，于 2026 年 1 月 26 日发布）将这一契约标准化。一个工具结果中包含一个 `resource`，其 URI 为 `ui://...`，其 MIME 类型为 `text/html;profile=mcp-app`。宿主会将其渲染在一个沙箱化的 iframe 中，应用受限的 CSP，且默认无网络访问权限，除非被显式授权。iframe 内部的 UI 通过一种极小的 postMessage JSON-RPC 方言向宿主发送消息。

每个兼容的客户端（Claude Desktop、ChatGPT、Goose、VS Code）都以相同的方式渲染同一个 `ui://` 资源。一个服务器、一份 HTML 包、通用的 UI。

## 核心概念

### `ui://` 资源方案

一个工具返回：

```json
{
  "content": [
    {"type": "text", "text": "Here is your notes timeline:"},
    {"type": "ui_resource", "uri": "ui://notes/timeline"}
  ],
  "_meta": {
    "ui": {
      "resourceUri": "ui://notes/timeline",
      "csp": {
        "defaultSrc": "'self'",
        "scriptSrc": "'self' 'unsafe-inline'",
        "connectSrc": "'self'"
      },
      "permissions": []
    }
  }
}
```

随后宿主对 `ui://notes/timeline` 这个 URI 调用 `resources/read`，并得到返回：

```json
{
  "contents": [{
    "uri": "ui://notes/timeline",
    "mimeType": "text/html;profile=mcp-app",
    "text": "<!doctype html>..."
  }]
}
```

### iframe 沙箱

宿主将 HTML 渲染在一个沙箱化的 `<iframe>` 内，具备以下特征：

- `sandbox="allow-scripts allow-same-origin"`（或根据服务器声明采用更严格的设置）。
- 通过响应头应用服务器声明的 CSP。
- 不携带宿主源（origin）的任何 cookie，也无 localStorage。
- 网络访问被限制在 CSP 中的 `connectSrc` 范围内。

### postMessage 协议

iframe 通过 `window.postMessage` 与宿主通信，采用一种极小的 JSON-RPC 2.0 方言：

始终将 `targetOrigin` 锁定为对端的精确源（origin），并在接收方一侧，在处理任何载荷前先依据白名单校验 `event.origin`。该通道的任何一端都绝不能使用 `"*"`——因为消息体中携带的是工具调用和资源读取。

```js
// iframe 向宿主发送（锁定到宿主 origin）
window.parent.postMessage({
  jsonrpc: "2.0",
  id: 1,
  method: "host.callTool",
  params: { name: "notes_update", arguments: { id: "note-14", title: "..." } }
}, "https://host.example.com");

// 宿主向 iframe 发送（锁定到 iframe origin）
iframe.contentWindow.postMessage({
  jsonrpc: "2.0",
  id: 1,
  result: { content: [...] }
}, "https://iframe.example.com");

// 两端都需要的接收方
window.addEventListener("message", (event) => {
  if (event.origin !== "https://expected-peer.example.com") return;
  // 可以安全地处理 event.data
});
```

UI 可调用的宿主侧方法包括：

- `host.callTool(name, arguments)`——调用一个服务器工具。
- `host.readResource(uri)`——读取一个 MCP 资源。
- `host.getPrompt(name, arguments)`——获取一个提示词模板。
- `host.close()`——关闭该 UI。

每次调用仍然经由 MCP 协议进行，并继承服务器的权限设置。

### 权限

`_meta.ui.permissions` 列表用于申请额外的能力：

- `camera`——访问用户的摄像头（用于扫描文档类的 UI）。
- `microphone`——语音输入。
- `geolocation`——位置信息。
- `network:*`——比单凭 `connectSrc` 所允许的更宽泛的网络访问。

每一项权限都对应一个在 UI 渲染前向用户展示的授权提示。

### 安全风险

iframe 中的 HTML 终究还是 HTML。这带来了新的攻击面：

- **经由 UI 的提示词注入（prompt injection）。** 恶意的服务器 UI 可以展示看起来像系统消息的文本，从而欺骗用户。宿主在渲染时应能让用户明显区分服务器 UI 与宿主 UI。
- **经由 `connectSrc` 的数据外泄。** 如果 CSP 允许 `connect-src: *`，UI 就能把数据发送到任意地方。默认值应当严格。
- **点击劫持（clickjacking）。** UI 覆盖在宿主界面（host chrome）之上。宿主必须阻止 z-index 操纵，并强制执行不透明度（opacity）规则。
- **窃取焦点。** UI 抢占键盘焦点并捕获用户的下一条消息。宿主必须拦截此类行为。

第 13 阶段 · 15 会作为 MCP 安全的一部分深入讲解这些风险；本课仅作引入。

### `ui/initialize` 握手

iframe 加载完成后，会通过 postMessage 发送 `ui/initialize`：

```json
{"jsonrpc": "2.0", "id": 0, "method": "ui/initialize",
 "params": {"theme": "dark", "locale": "en-US", "sessionId": "..."}}
```

宿主以一组能力（capabilities）和一个会话令牌（session token）作为响应。UI 在之后每一次向宿主发起的调用中都使用该会话令牌。

### AppRenderer / AppFrame SDK 原语

ext-apps SDK 提供了两个便捷原语：

- `AppRenderer`（服务器侧）——封装一个 React / Vue / Solid 组件，并以正确的 MIME 类型和元数据发射出一个 `ui://` 资源。
- `AppFrame`（客户端侧）——接收该资源，挂载 iframe，并中介 postMessage 通信。

你既可以使用这两个原语，也可以手写 HTML 和 JSON-RPC。

### 生态现状

MCP 应用于 2026 年 1 月 26 日发布。截至 2026 年 4 月的客户端支持情况：

- **Claude Desktop。** 自 2026 年 1 月起完整支持。
- **ChatGPT。** 通过 Apps SDK 完整支持（底层是同一套 MCP 应用协议）。
- **Cursor。** Beta 阶段；通过设置开启。
- **VS Code。** 仅 Insider 构建版本支持。
- **Goose。** 完整支持。
- **Zed、Windsurf。** 已列入路线图。

已在生产环境中运行的服务器：仪表盘、地图可视化、数据表格、图表生成器、沙箱 IDE 预览。

## 动手用一用

`code/main.py` 为笔记服务器扩展了一个 `visualize_timeline` 工具，它返回一个 `ui://notes/timeline` 资源，并为该 URI 上的 `resources/read` 提供了一个处理器，返回一个小而完整的 HTML 包，其中包含一条 SVG 时间线。该 HTML 使用标准库模板化——无需任何构建系统。由于标准库无法驱动浏览器，postMessage 部分以 JS 注释的形式给出草图。

需要关注的内容：

- 工具响应上的 `_meta.ui` 携带了 resourceUri、CSP、permissions。
- 该 HTML 在无网络访问的情况下也能渲染；所有数据都内联其中。
- JS 通过 `window.parent.postMessage` 调用 `host.callTool`（有文档说明，但在本标准库演示中是惰性的、不会真正执行）。

## 交付成果

本课产出 `outputs/skill-mcp-apps-spec.md`。给定一个能从交互式 UI 中受益的工具，该 skill 会产出完整的 MCP 应用契约：`ui://` URI、CSP、permissions、postMessage 入口点，以及一份安全检查清单。

## 练习

1. 运行 `code/main.py` 并检查它发射出的 HTML。在浏览器中直接打开该 HTML，确认 SVG 能够渲染。然后勾勒出该 UI 用于调用 `host.callTool("notes_update", ...)` 所需的 postMessage 契约。

2. 收紧 CSP：移除 `'unsafe-inline'`，改用基于 nonce 的脚本策略。HTML 生成代码中需要做哪些改动？

3. 新增第二个 UI 资源 `ui://notes/editor`，提供一个用于就地编辑笔记的表单。当用户提交时，iframe 调用 `host.callTool("notes_update", ...)`。

4. 审计该 UI 的攻击面。恶意服务器可能在哪里注入内容？iframe 沙箱能防御什么、又不能防御什么？

5. 阅读 SEP-1724 规范，找出 MCP 应用 SDK 中有一项能力是这个玩具实现没有用到的。（提示：组件级状态同步。）

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| MCP 应用（MCP Apps） | "交互式 UI 资源" | 于 2026-01-26 发布的 SEP-1724 扩展 |
| `ui://` | "应用 URI 方案" | 用于 UI 包的资源方案 |
| `text/html;profile=mcp-app` | "那个 MIME" | MCP 应用 HTML 的 content-type |
| iframe 沙箱 | "渲染容器" | 浏览器对 UI 进行的沙箱化，附带 CSP 和权限 |
| postMessage JSON-RPC | "UI 与宿主之间的链路" | 用于宿主调用的、基于 postMessage 的极小 JSON-RPC 方言 |
| `_meta.ui` | "工具与 UI 的绑定" | 将工具结果关联到某个 UI 资源的元数据 |
| CSP | "Content-Security-Policy" | 声明脚本、网络、样式所允许的来源 |
| AppRenderer | "服务器 SDK 原语" | 将框架组件转换为 `ui://` 资源 |
| AppFrame | "客户端 SDK 原语" | 挂载 iframe 并中介 postMessage 的辅助工具 |
| `ui/initialize` | "握手" | UI 向宿主发出的第一条 postMessage |

## 延伸阅读

- [MCP ext-apps — GitHub](https://github.com/modelcontextprotocol/ext-apps) —— 参考实现与 SDK
- [MCP Apps 规范 2026-01-26](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) —— 正式规范文档
- [MCP — Apps 扩展概览](https://modelcontextprotocol.io/extensions/apps/overview) —— 高层级文档
- [MCP 博客 — MCP Apps 发布](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) —— 2026 年 1 月发布文章
- [MCP Apps API 参考](https://apps.extensions.modelcontextprotocol.io/api/) —— JSDoc 风格的 SDK 参考
