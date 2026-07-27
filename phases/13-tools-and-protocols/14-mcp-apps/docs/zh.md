# MCP Apps —— 通过 `ui://` 实现交互式 UI 资源

> 纯文本的工具输出限制了智能体所能展示的内容。MCP Apps（SEP-1724，2026 年 1 月 26 日正式发布）让工具能够返回沙盒化的交互式 HTML，并在 Claude Desktop、ChatGPT、Cursor、Goose 和 VS Code 中内联渲染。仪表盘、表单、地图、3D 场景，全部通过一个扩展实现。本课将介绍 `ui://` 资源方案、`text/html;profile=mcp-app` MIME 类型、iframe-sandbox postMessage 协议，以及允许服务器渲染 HTML 所带来的安全面。

**类型：** 构建
**语言：** Python（stdlib，UI 资源发射器），HTML（示例应用）
**前置要求：** 阶段 13 · 07（MCP 服务器），阶段 13 · 10（资源）
**时长：** ~75 分钟

## 学习目标

- 从工具调用返回 `ui://` 资源，并设置正确的 MIME 和元数据。
- 使用 `_meta.ui.resourceUri`、`_meta.ui.csp` 和 `_meta.ui.permissions` 声明工具的关联 UI。
- 实现用于 UI 与宿主通信的 iframe 沙盒 postMessage JSON-RPC。
- 应用 CSP 和权限策略的默认值，以防御源自 UI 的攻击。

## 问题

在 2025 年，一个 `visualize_timeline` 工具只能返回"以下是按时间顺序排列的 14 条笔记：……"。这只是一个段落。用户实际上想要的是交互式时间线。在 MCP Apps 出现之前，可选方案只有：客户端特定的 Widget API（Claude artifacts、OpenAI Custom GPT HTML），或者根本没有 UI。

MCP Apps（SEP-1724，2026 年 1 月 26 日发布）标准化了契约。工具结果包含一个 URI 为 `ui://...`、MIME 类型为 `text/html;profile=mcp-app` 的 `resource`。宿主在沙盒化的 iframe 中渲染该资源，并带有受限的 CSP，除非明确授予，否则没有网络访问权限。iframe 内的 UI 通过一个轻量的 postMessage JSON-RPC 方言向宿主发送消息。

每个兼容客户端（Claude Desktop、ChatGPT、Goose、VS Code）都以相同方式渲染同一个 `ui://` 资源。一个服务器，一个 HTML 包，通用 UI。

## 概念

### `ui://` 资源方案

工具返回：

```json
{
  "content": [
    {"type": "text", "text": "这是你的笔记时间线："},
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

然后宿主调用 `resources/read` 读取 `ui://notes/timeline` URI，得到：

```json
{
  "contents": [{
    "uri": "ui://notes/timeline",
    "mimeType": "text/html;profile=mcp-app",
    "text": "<!doctype html>..."
  }]
}
```

### Iframe 沙盒

宿主在沙盒化的 `<iframe>` 中渲染 HTML，具有以下特性：

- `sandbox="allow-scripts allow-same-origin"`（或更严格的服务器声明）
- 通过响应头应用服务器声明的 CSP。
- 没有来自宿主源的 cookies 和 localStorage。
- 网络访问限制在 CSP 的 `connectSrc` 范围内。

### postMessage 协议

iframe 通过 `window.postMessage` 与宿主通信。一种轻量的 JSON-RPC 2.0 方言：

始终将 `targetOrigin` 固定为对端的精确源，并在接收端根据白名单验证 `event.origin`，然后再处理任何载荷。切勿在此通道的任意一侧使用 `"*"`——消息体携带的是工具调用和资源读取。

```js
// iframe 到宿主（固定为宿主源）
window.parent.postMessage({
  jsonrpc: "2.0",
  id: 1,
  method: "host.callTool",
  params: { name: "notes_update", arguments: { id: "note-14", title: "..." } }
}, "https://host.example.com");

// 宿主到 iframe（固定为 iframe 源）
iframe.contentWindow.postMessage({
  jsonrpc: "2.0",
  id: 1,
  result: { content: [...] }
}, "https://iframe.example.com");

// 两端的接收方
window.addEventListener("message", (event) => {
  if (event.origin !== "https://expected-peer.example.com") return;
  // 安全处理 event.data
});
```

UI 可以调用的宿主端方法：

- `host.callTool(name, arguments)` —— 调用服务器工具。
- `host.readResource(uri)` —— 读取 MCP 资源。
- `host.getPrompt(name, arguments)` —— 获取提示模板。
- `host.close()` —— 关闭 UI。

每次调用仍然通过 MCP 协议进行，并继承服务器的权限。

### 权限

`_meta.ui.permissions` 列表请求额外的能力：

- `camera` —— 访问用户摄像头（用于扫描文档等 UI）。
- `microphone` —— 语音输入。
- `geolocation` —— 位置信息。
- `network:*` —— 比 `connectSrc` 单独允许的更广泛的网络访问。

每个权限在 UI 渲染前都会向用户显示提示。

### 安全风险

iframe 中的 HTML 仍然是 HTML。新的攻击面包括：

- **通过 UI 进行提示注入。** 恶意服务器的 UI 可以显示看起来像系统消息的文本，从而欺骗用户。宿主的渲染应明显区分服务器 UI 和宿主 UI。
- **通过 `connectSrc` 窃取数据。** 如果 CSP 允许 `connect-src: *`，UI 可以将数据发送到任何地方。默认应严格限制。
- **点击劫持。** UI 覆盖宿主界面。宿主必须防止 z-index 操纵并强制实施透明度规则。
- **窃取焦点。** UI 夺取键盘焦点并捕获下一条消息。宿主必须拦截。

阶段 13 · 15 将作为 MCP 安全的一部分深入介绍这些内容；本课仅做引入。

### `ui/initialize` 握手

iframe 加载完成后，通过 postMessage 发送 `ui/initialize`：

```json
{"jsonrpc": "2.0", "id": 0, "method": "ui/initialize",
 "params": {"theme": "dark", "locale": "en-US", "sessionId": "..."}}
```

宿主响应能力信息和会话令牌。UI 在每次后续宿主调用中都使用该会话令牌。

### AppRenderer / AppFrame SDK 原语

ext-apps SDK 提供了两个便捷原语：

- `AppRenderer`（服务端）—— 包装 React / Vue / Solid 组件，并以正确的 MIME 和元数据发出 `ui://` 资源。
- `AppFrame`（客户端）—— 接收资源，挂载 iframe，并调解 postMessage。

你可以使用这些原语，也可以手写 HTML 和 JSON-RPC。

### 生态现状

MCP Apps 于 2026 年 1 月 26 日发布。截至 2026 年 4 月的客户端支持情况：

- **Claude Desktop。** 自 2026 年 1 月起完全支持。
- **ChatGPT。** 通过 Apps SDK（相同的底层 MCP Apps 协议）完全支持。
- **Cursor。** Beta 版本；需在设置中启用。
- **VS Code。** 仅内部构建版本。
- **Goose。** 完全支持。
- **Zed、Windsurf。** 已在路线图中。

生产中的服务器：仪表盘、地图可视化、数据表格、图表构建器、沙盒 IDE 预览。

## 使用它

`code/main.py` 为笔记服务器增加了一个 `visualize_timeline` 工具，该工具返回 `ui://notes/timeline` 资源，以及一个针对该 URI 的 `resources/read` 处理器，返回一个包含 SVG 时间线的精简 HTML 包。HTML 使用 stdlib 模板化 —— 无需构建系统。由于 stdlib 无法驱动浏览器，postMessage 以 JS 注释形式做了示意。

需要关注的内容：

- 工具响应中的 `_meta.ui` 携带了 resourceUri、CSP、permissions。
- HTML 在没有网络访问的情况下渲染；所有数据都是内联的。
- JS 通过 `window.parent.postMessage` 调用 `host.callTool`（在此 stdlib 演示中有文档记录但处于非活动状态）。

## 产出

本课产出的文件是 `outputs/skill-mcp-apps-spec.md`。给定一个受益于交互式 UI 的工具，该技能将生成完整的 MCP Apps 契约：`ui://` URI、CSP、权限、postMessage 入口点以及安全检查清单。

## 练习

1. 运行 `code/main.py` 并检查生成的 HTML。直接在浏览器中打开 HTML，验证 SVG 是否渲染。然后描绘 UI 用于调用 `host.callTool("notes_update", ...)` 的 postMessage 契约。

2. 收紧 CSP：移除 `'unsafe-inline'` 并改用基于 nonce 的脚本策略。HTML 生成代码需要做哪些更改？

3. 添加第二个 UI 资源 `ui://notes/editor`，包含一个用于原地编辑笔记的表单。当用户提交时，iframe 调用 `host.callTool("notes_update", ...)`。

4. 审计 UI 的攻击面。恶意服务器可能在哪些地方注入内容？iframe 沙盒能防御什么，不能防御什么？

5. 阅读 SEP-1724 规范，找出这个玩具实现未使用的 MCP Apps SDK 中的一个能力。（提示：组件级状态同步。）

## 关键术语

| 术语 | 通俗说法 | 实际含义 |
|------|----------|----------|
| MCP Apps | "交互式 UI 资源" | 2026 年 1 月 26 日发布的 SEP-1724 扩展 |
| `ui://` | "App URI 方案" | UI 包的资源方案 |
| `text/html;profile=mcp-app` | "MIME 类型" | MCP App HTML 的内容类型 |
| Iframe 沙盒 | "渲染容器" | 使用 CSP 和权限对 UI 进行浏览器沙盒化 |
| postMessage JSON-RPC | "UI 到宿主的通信线" | 用于宿主调用的轻量 JSON-RPC-over-postMessage 方言 |
| `_meta.ui` | "工具-UI 绑定" | 将工具结果链接到 UI 资源的元数据 |
| CSP | "内容安全策略" | 声明脚本、网络、样式的允许来源 |
| AppRenderer | "服务端 SDK 原语" | 将框架组件转换为 `ui://` 资源 |
| AppFrame | "客户端 SDK 原语" | 挂载 iframe 并调解 postMessage 的辅助工具 |
| `ui/initialize` | "握手" | UI 到宿主的首次 postMessage |

## 延伸阅读

- [MCP ext-apps — GitHub](https://github.com/modelcontextprotocol/ext-apps) —— 参考实现和 SDK
- [MCP Apps 规范 2026-01-26](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) —— 正式规范文档
- [MCP — Apps 扩展概述](https://modelcontextprotocol.io/extensions/apps/overview) —— 高层文档
- [MCP 博客 — MCP Apps 发布](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) —— 2026 年 1 月发布文章
- [MCP Apps API 参考](https://apps.extensions.modelcontextprotocol.io/api/) —— JSDoc 风格的 SDK 参考
