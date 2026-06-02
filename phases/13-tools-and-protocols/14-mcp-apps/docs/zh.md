# MCP Apps —— 通过 `ui://` 提供交互式 UI 资源

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 纯文本的 tool 输出限制了 agent 能展示的内容上限。MCP Apps（SEP-1724，2026 年 1 月 26 日正式发布）让一个 tool 能返回沙箱化的交互式 HTML，并直接在 Claude Desktop、ChatGPT、Cursor、Goose、VS Code 中内联渲染。Dashboard、表单、地图、3D 场景，全都通过同一个扩展搞定。本课走一遍 `ui://` 资源 scheme、`text/html;profile=mcp-app` MIME、iframe-sandbox 的 postMessage 协议，以及让 server 渲染 HTML 所带来的安全面。

**Type:** Build
**Languages:** Python (stdlib, UI resource emitter), HTML (sample app)
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 在 tool 调用中返回一个 `ui://` 资源，并设置正确的 MIME 与元数据。
- 用 `_meta.ui.resourceUri`、`_meta.ui.csp`、`_meta.ui.permissions` 声明 tool 关联的 UI。
- 实现 iframe 沙箱里 UI 与 host 通信用的 postMessage JSON-RPC。
- 应用 CSP 与 permissions-policy 的默认值，防御来自 UI 一侧的攻击。

## 问题（The Problem）

2025 年风格的 `visualize_timeline` tool 能返回一段「Here are 14 notes organized chronologically: ...」，那是一段文字。用户真正想要的是可交互的 timeline。在 MCP Apps 之前，可选项只有：客户端自家的 widget API（Claude artifacts、OpenAI Custom GPT HTML），或者干脆没有 UI。

MCP Apps（SEP-1724，2026 年 1 月 26 日上线）把契约标准化了。一个 tool 结果里包含一个 `resource`，URI 是 `ui://...`，MIME 是 `text/html;profile=mcp-app`。host 把它渲染在沙箱化的 iframe 里，配上受限的 CSP，除非显式授权否则没有网络访问。iframe 内部的 UI 通过一个微型的 postMessage JSON-RPC 方言向 host 发消息。

每个兼容客户端（Claude Desktop、ChatGPT、Goose、VS Code）都用同样方式渲染同一个 `ui://` 资源。一个 server，一份 HTML bundle，通用 UI。

## 概念（The Concept）

### `ui://` 资源 scheme

一个 tool 返回：

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

随后 host 对 `ui://notes/timeline` URI 调用 `resources/read`，拿回：

```json
{
  "contents": [{
    "uri": "ui://notes/timeline",
    "mimeType": "text/html;profile=mcp-app",
    "text": "<!doctype html>..."
  }]
}
```

### Iframe 沙箱

host 把 HTML 渲染在一个沙箱化的 `<iframe>` 里：

- `sandbox="allow-scripts allow-same-origin"`（或按 server 声明更严格）
- 通过 response header 应用 server 声明的 CSP。
- 没有 cookie，也不能访问 host 源的 localStorage。
- 网络访问受限于 CSP 中的 `connectSrc`。

### postMessage 协议

iframe 通过 `window.postMessage` 与 host 通信。一种微型的 JSON-RPC 2.0 方言：

`targetOrigin` 必须固定为对端的精确 origin，接收侧也要把 `event.origin` 与 allowlist（白名单）比对后才处理任何 payload。两端都不要用 `"*"` —— 这条信道传输的是 tool 调用与资源读取。

```js
// iframe to host  (pin to host origin)
window.parent.postMessage({
  jsonrpc: "2.0",
  id: 1,
  method: "host.callTool",
  params: { name: "notes_update", arguments: { id: "note-14", title: "..." } }
}, "https://host.example.com");

// host to iframe  (pin to iframe origin)
iframe.contentWindow.postMessage({
  jsonrpc: "2.0",
  id: 1,
  result: { content: [...] }
}, "https://iframe.example.com");

// receiver on both sides
window.addEventListener("message", (event) => {
  if (event.origin !== "https://expected-peer.example.com") return;
  // safe to process event.data
});
```

UI 这一侧可调用的 host 方法：

- `host.callTool(name, arguments)` —— 调用 server 上的一个 tool。
- `host.readResource(uri)` —— 读取一个 MCP 资源。
- `host.getPrompt(name, arguments)` —— 获取一个 prompt 模板。
- `host.close()` —— 关闭 UI。

每次调用仍然走 MCP 协议，并继承 server 的权限。

### 权限（Permissions）

`_meta.ui.permissions` 列表用于申请额外能力：

- `camera` —— 访问用户摄像头（用于扫描文档之类的 UI）。
- `microphone` —— 语音输入。
- `geolocation` —— 位置。
- `network:*` —— 比单独的 `connectSrc` 更宽的网络访问。

每项权限都会在 UI 渲染前向用户弹出确认。

### 安全风险

iframe 里的 HTML 还是 HTML，新的攻击面包括：

- **借 UI 进行 prompt-injection。** 恶意 server UI 能显示一段看起来像 system 消息的文字来骗用户。host 渲染时应在视觉上明确把 server UI 与 host UI 区分开。
- **借 `connectSrc` 进行外泄。** 如果 CSP 允许 `connect-src: *`，UI 可以把数据发到任意地方。默认应当严格。
- **Clickjacking。** UI 覆盖在 host 的 chrome 之上。host 必须阻止 z-index 操纵并强制透明度规则。
- **抢焦点。** UI 拿走键盘焦点并截获下一条消息。host 必须拦截。

Phase 13 · 15 会作为 MCP 安全的一部分深入这些；本课只是引入。

### `ui/initialize` 握手

iframe 加载完后，会通过 postMessage 发出 `ui/initialize`：

```json
{"jsonrpc": "2.0", "id": 0, "method": "ui/initialize",
 "params": {"theme": "dark", "locale": "en-US", "sessionId": "..."}}
```

host 回复能力清单和一个 session token。UI 在之后每次调 host 时都用这个 session token。

### AppRenderer / AppFrame SDK 原语

ext-apps SDK 暴露两个便利原语：

- `AppRenderer`（server 侧）—— 包装一个 React / Vue / Solid 组件，并发出带正确 MIME 与元数据的 `ui://` 资源。
- `AppFrame`（client 侧）—— 接收资源、挂载 iframe、并代理 postMessage。

你可以用它们，也可以手写 HTML 和 JSON-RPC。

### 生态现状

MCP Apps 于 2026 年 1 月 26 日上线。截至 2026 年 4 月的客户端支持情况：

- **Claude Desktop。** 自 2026 年 1 月起完全支持。
- **ChatGPT。** 通过 Apps SDK 完全支持（底层是同一套 MCP Apps 协议）。
- **Cursor。** Beta，需在设置里开启。
- **VS Code。** 仅 Insider 版本。
- **Goose。** 完全支持。
- **Zed、Windsurf。** 已列入路线图。

生产环境中的 server：dashboard、地图可视化、数据表格、图表生成器、沙箱 IDE 预览。

## 用起来（Use It）

`code/main.py` 在 notes server 基础上扩展了一个 `visualize_timeline` tool，返回一个 `ui://notes/timeline` 资源，并配套一个针对该 URI 的 `resources/read` 处理器，吐出一份小而完整的 HTML bundle，包含一个 SVG timeline。HTML 用 stdlib 模板拼出来 —— 没有 build 系统。postMessage 在 JS 注释里勾勒了出来，因为 stdlib 没法驱动浏览器。

可以重点看：

- tool 响应上的 `_meta.ui` 携带了 resourceUri、CSP、permissions。
- HTML 渲染时不需要网络访问；所有数据都是内联的。
- JS 通过 `window.parent.postMessage` 调用 `host.callTool`（在这个 stdlib demo 里有文档但是 inert，不会真正执行）。

## 上线部署（Ship It）

本课产出 `outputs/skill-mcp-apps-spec.md`。给定一个适合做交互式 UI 的 tool，这份 skill 会产出完整的 MCP Apps 契约：`ui://` URI、CSP、权限、postMessage 入口点，以及一份安全 checklist。

## 练习（Exercises）

1. 跑一下 `code/main.py`，看看吐出来的 HTML。直接在浏览器里打开这段 HTML，确认 SVG 能渲染。然后勾画一下 UI 调 `host.callTool("notes_update", ...)` 时使用的 postMessage 契约。

2. 把 CSP 收紧：去掉 `'unsafe-inline'`，改用基于 nonce 的脚本策略。HTML 生成代码需要做哪些改动？

3. 再加一个 UI 资源 `ui://notes/editor`，里面是一个可以原地编辑某条 note 的表单。当用户提交时，iframe 调用 `host.callTool("notes_update", ...)`。

4. 审一下这个 UI 的攻击面。恶意 server 可能在哪里注入内容？iframe 沙箱能防住什么、不能防住什么？

5. 读一下 SEP-1724 spec，找出一个 MCP Apps SDK 中的能力，是这份玩具实现没用到的。（提示：组件级别的状态同步。）

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际是什么 |
|------|----------------|------------|
| MCP Apps | "Interactive UI resources" | SEP-1724 扩展，2026-01-26 上线 |
| `ui://` | "App URI scheme" | UI bundle 用的资源 scheme |
| `text/html;profile=mcp-app` | "The MIME" | MCP App HTML 的 Content-type |
| Iframe sandbox | "渲染容器" | 浏览器对 UI 做沙箱化，配 CSP 和 permissions |
| postMessage JSON-RPC | "UI-to-host 信道" | 跑在 postMessage 上的微型 JSON-RPC 方言，给 UI 调 host 用 |
| `_meta.ui` | "Tool-UI 绑定" | 把 tool 结果与 UI 资源关联起来的元数据 |
| CSP | "Content-Security-Policy" | 声明脚本、网络、样式允许的来源 |
| AppRenderer | "Server SDK 原语" | 把框架组件转成一个 `ui://` 资源 |
| AppFrame | "Client SDK 原语" | iframe 挂载助手，代理 postMessage |
| `ui/initialize` | "握手" | UI 发给 host 的第一条 postMessage |

## 延伸阅读（Further Reading）

- [MCP ext-apps — GitHub](https://github.com/modelcontextprotocol/ext-apps) —— 参考实现与 SDK
- [MCP Apps specification 2026-01-26](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) —— 正式 spec 文档
- [MCP — Apps extension overview](https://modelcontextprotocol.io/extensions/apps/overview) —— 高层文档
- [MCP blog — MCP Apps launch](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) —— 2026 年 1 月发布博文
- [MCP Apps API reference](https://apps.extensions.modelcontextprotocol.io/api/) —— JSDoc 风格 SDK 参考
