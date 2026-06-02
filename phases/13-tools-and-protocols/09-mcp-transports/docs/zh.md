# MCP Transports — stdio、Streamable HTTP 与 SSE 迁移

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> stdio 只在本机能用，跨机一概抓瞎。Streamable HTTP（2025-03-26）是远程传输的标准。老的 HTTP+SSE 传输已被弃用，将于 2026 年中彻底移除。选错传输方式要付出迁移代价；选对了，就能拿到一个可远程托管、带会话连续性、还能防 DNS-rebinding 的 MCP 服务器。

**Type:** Learn
**Languages:** Python（stdlib，Streamable HTTP 端点骨架）
**Prerequisites:** Phase 13 · 07, 08（MCP 服务器与客户端）
**Time:** ~45 分钟

## 学习目标（Learning Objectives）

- 根据部署形态（本地 vs 远程，单进程 vs 集群）在 stdio 与 Streamable HTTP 之间做选择。
- 实现 Streamable HTTP 的单端点模式：POST 用于请求，GET 用于会话流。
- 强制执行 `Origin` 校验和会话 id 语义，挫败 DNS-rebinding 攻击。
- 在 2026 年中的移除截止日期之前，把遗留的 HTTP+SSE 服务器迁移到 Streamable HTTP。

## 问题（The Problem）

MCP 第一版远程传输（2024-11）是 HTTP+SSE：两个端点，一个收客户端的 POST，另一个是从服务器到客户端的 Server-Sent-Events 通道。它能用，但很笨拙：每个会话两个端点，某些 CDN 前面的缓存会出问题，还硬性依赖长连接 SSE，而某些 WAF 会粗暴地把这种连接切断。

2025-03-26 规范用 Streamable HTTP 替换了它：一个端点，POST 发客户端请求，GET 建会话流，二者共享 `Mcp-Session-Id` 头部。从那时起新建或迁移过的服务器都用 Streamable HTTP。老的 SSE 模式正在被弃用——Atlassian Rovo 在 2026 年 6 月 30 日下线；Keboola 在 2026 年 4 月 1 日下线；剩下的多数企业服务器会在 2026 年年底前完成迁移。

而 stdio 对本地服务器仍然重要。Claude Desktop、VS Code，以及所有 IDE 形态的客户端都通过 stdio 拉起服务器。正确的心智模型是：stdio 用于「这台机器」，Streamable HTTP 用于「跨网络」。两者不交叉。

## 概念（The Concept）

### stdio

- 子进程传输。客户端拉起服务器，通过 stdin/stdout 通信。
- 每行一个 JSON 对象。换行符分隔。
- 没有会话 id；进程身份就是会话身份。
- 不需要 auth（子进程继承父进程的信任边界）。
- 永远不要用于远程服务器——你得用 SSH 或 socat 做隧道，到那一步还不如直接上 Streamable HTTP。

### Streamable HTTP

单端点 `/mcp`（路径任选）。支持三种 HTTP 方法：

- **POST /mcp。** 客户端发送一条 JSON-RPC 消息。服务器要么返回单条 JSON 响应，要么返回一个 SSE 流（一条或多条响应，适合批量响应以及与该请求相关的通知）。
- **GET /mcp。** 客户端打开一条长连接 SSE 通道。服务器用它发起服务器到客户端的请求（sampling、notifications、elicitation）。
- **DELETE /mcp。** 客户端显式终结会话。

会话由 `Mcp-Session-Id` 头部标识：服务器在首个响应里设置该头部，客户端在后续每个请求中回显它。会话 id 必须是密码学随机的（128 位以上）；客户端自选的 id 出于安全考虑会被拒绝。

### 单端点 vs 双端点

老规范的双端点模式在 2026 年仍可调用——规范声明它「兼容遗留实现」。但所有新服务器都应使用单端点。官方 SDK 都输出单端点；只有在与未迁移的远端通信时才用遗留模式。

### `Origin` 校验与 DNS-rebinding

浏览器（目前）不是 MCP 客户端，但攻击者可以构造一个网页，诱导浏览器向 `localhost:1234/mcp`——也就是用户本机 MCP 服务器监听的地方——发起 POST。如果服务器不检查 `Origin`，浏览器的同源策略救不了你，因为 `Origin: http://evil.com` 是合法的跨源 Origin。

2025-11-25 规范要求服务器拒绝 `Origin` 不在 allowlist（白名单）里的请求。allowlist 通常包含 MCP 客户端主机（`https://claude.ai`、`vscode-webview://*`）以及给本地 UI 用的 localhost 变体。

### 会话 id 生命周期

1. 客户端第一次发请求时不带 `Mcp-Session-Id`。
2. 服务器分配一个随机 id，在响应头里设置 `Mcp-Session-Id`。
3. 客户端在后续所有请求以及 `GET /mcp` 拉流时都回显该头部。
4. 服务器可以撤销会话；客户端在后续请求中收到 404，必须重新初始化。
5. 客户端可以显式 DELETE 会话以干净关闭。

### 保活与重连

SSE 连接会断。客户端用同一个 `Mcp-Session-Id` 重新 GET 即可重连。服务器**必须**把停连期间错过的事件排队（保留一段合理的窗口），并通过客户端回显的 `last-event-id` 头部重放。

Phase 13 · 13 会讲 Tasks，能让长时间运行的工作即使在整段会话重连后也存活下来。

### 向后兼容探测

想同时支持新老服务器的客户端：

1. POST 到 `/mcp`。
2. 如果响应是 `200 OK` 携带 JSON 或 SSE，那就是 Streamable HTTP。
3. 如果响应是 `200 OK` 携带 `Content-Type: text/event-stream` **且**有一个指向次要端点的 `Location` 头部，那就是遗留 HTTP+SSE；按 `Location` 走即可。

### Cloudflare、ngrok 与托管

2026 年生产级远程 MCP 服务器跑在 Cloudflare Workers（用其 MCP Agents SDK）、Vercel Functions，或容器化的 Node/Python 上。关键：你的托管必须支持长连接 HTTP，以承载 SSE 的 GET。Vercel 免费档上限 10 秒，不堪用。Cloudflare Workers 支持无限期流式连接。

### Gateway 组合

当你在多个 MCP 服务器前面架一个 gateway（Phase 13 · 17），这个 gateway 就是单一的 Streamable HTTP 端点，会改写会话 id 并向上游做多路复用。tool 在 gateway 层合并；客户端看到的是一个逻辑上的单一服务器。

### 传输失败模式

- **stdio SIGPIPE。** 子进程在写到一半时死掉会触发 SIGPIPE；服务器应该干净退出。客户端应该检测 EOF 并把会话标记为已死。
- **HTTP 502 / 504。** Cloudflare、nginx 等代理在上游失败时会发出这些。Streamable HTTP 客户端应短暂退避后重试一次。
- **SSE 连接断开。** TCP RST、代理超时或客户端网络切换都会关闭流。客户端用 `Mcp-Session-Id` 加可选的 `last-event-id` 重连以恢复。
- **会话撤销。** 服务器使会话 id 失效；客户端下一次请求收到 404，必须重新握手。
- **时钟漂移。** 客户端的资源 TTL 计算与服务器分歧。客户端应把服务器时间戳视为权威。

### 何时绕开 Streamable HTTP

某些企业在自己的内网里把 MCP 服务器部署在 gRPC 或消息队列传输之上。这是非标准做法——MCP 规范并未正式定义这些。gateway 可以对外暴露 Streamable HTTP 表面给 MCP 客户端，内部则用 gRPC。把对外的表面保持符合规范；翻译工作交给 gateway。

## 用起来（Use It）

`code/main.py` 用 `http.server`（stdlib）实现了一个最小的 Streamable HTTP 端点。它处理 `/mcp` 上的 POST、GET、DELETE，在首个响应中设置 `Mcp-Session-Id`，校验 `Origin`，并拒绝来自非 allowlist origin 的请求。该 handler 复用了 Lesson 07 notes 服务器的 dispatch 逻辑。

要看的几处：

- POST handler 读取 JSON-RPC 请求体，dispatch，然后写出一条 JSON 响应（单响应变体；SSE 变体结构上类似）。
- `Origin` 检查会拒绝默认的 `http://evil.example` 探测，但接受 `http://localhost`。
- 会话 id 是随机的 128 位十六进制字符串；服务器在内存里保留各会话的状态。

## 上线部署（Ship It）

本课产出 `outputs/skill-mcp-transport-migrator.md`。给定一个 HTTP+SSE（遗留）MCP 服务器，该 skill 输出一份迁移到 Streamable HTTP 的方案，包含会话 id 连续性、Origin 校验、向后兼容探测支持。

## 练习（Exercises）

1. 运行 `code/main.py`。用 `curl` POST 一个 `initialize`，观察响应头 `Mcp-Session-Id`。再 POST 一次并回显该头部，验证会话连续性。

2. 加一个 GET handler，打开一条 SSE 流。每五秒发一条 `notifications/progress` 事件。用同一会话 id 重新 GET，确认服务器接受。

3. 实现 `last-event-id` 重放逻辑。重连时，重放自该 id 之后产生的所有事件。

4. 扩展 `Origin` 校验，支持通配符模式（`https://*.example.com`），并确认它接受 `https://app.example.com` 但拒绝 `https://evil.example.com.attacker.net`。

5. 从官方 registry 里挑一个遗留 HTTP+SSE 服务器（有好几个），勾画其迁移：端点处理、会话 id 生成、头部语义都要变什么。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|----------------|------------------------|
| stdio transport | 「本地子进程」 | JSON-RPC 走 stdin/stdout，换行符分隔 |
| Streamable HTTP | 「远程传输」 | 单端点 POST + GET + 可选 SSE，2025-03-26 规范 |
| HTTP+SSE | 「遗留」 | 双端点模型，2026 年中被移除 |
| `Mcp-Session-Id` | 「会话头部」 | 服务器分配的随机 id，后续每次请求都要回显 |
| `Origin` allowlist | 「DNS-rebinding 防御」 | 拒绝 Origin 不在批准名单内的请求 |
| Single endpoint | 「一个 URL」 | `/mcp` 处理所有会话操作的 POST / GET / DELETE |
| `last-event-id` | 「SSE 重放」 | 用于断流恢复且不丢事件的头部 |
| Backwards-compat probe | 「新老识别」 | 客户端通过响应形态自动选传输方式 |
| Long-lived HTTP | 「SSE 流式」 | 服务器在一条 TCP 连接上推事件，可持续数分钟到数小时 |
| Session revocation | 「强制重新初始化」 | 服务器使会话 id 失效；客户端必须重新握手 |

## 延伸阅读（Further Reading）

- [MCP — Basic transports spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) — stdio 和 Streamable HTTP 的权威参考
- [MCP — Basic transports spec 2025-03-26](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — 引入 Streamable HTTP 的版本
- [Cloudflare — MCP transport](https://developers.cloudflare.com/agents/model-context-protocol/transport/) — Workers 托管的 Streamable HTTP 模式
- [AWS — MCP transport mechanisms](https://builder.aws.com/content/35A0IphCeLvYzly9Sw40G1dVNzc/mcp-transport-mechanisms-stdio-vs-streamable-http) — 各部署形态横向对比
- [Atlassian — HTTP+SSE deprecation notice](https://community.atlassian.com/forums/Atlassian-Remote-MCP-Server/HTTP-SSE-Deprecation-Notice/ba-p/3205484) — 具体的迁移截止日期范例
