# MCP 传输——stdio vs 可流式 HTTP vs SSE 迁移

> stdio 只在本地工作。可流式 HTTP（2025-03-26）是远程标准。旧的 HTTP+SSE 传输已弃用，并将于 2026 年中期移除。选择错误的传输需要迁移；选择正确的传输可以获得可远程托管的 MCP 服务器，具备会话连续性和 DNS 重绑定保护。

**类型：** Learn
**语言：** Python（stdlib，可流式 HTTP 端点骨架）
**前置知识：** Phase 13 · 07、08（MCP 服务器和客户端）
**时间：** ~45 分钟

## 学习目标

- 根据部署形态（本地 vs 远程，单进程 vs 集群）在 stdio 和可流式 HTTP 之间做出选择。
- 实现可流式 HTTP 单端点模式：POST 用于请求，GET 用于会话流。
- 强制执行 `Origin` 验证和会话 ID 语义以防御 DNS 重绑定。
- 在 2026 年中期移除截止日期之前，将遗留的 HTTP+SSE 服务器迁移到可流式 HTTP。

## 问题所在

第一个 MCP 远程传输（2024-11）是 HTTP+SSE：两个端点，一个用于客户端的 POST，一个用于服务器到客户端流的 Server-Sent-Events 通道。它有效。但它也很笨拙：每个会话两个端点，某些 CDN 前面的缓存损坏，以及对一些 WAF 积极终止的长连接 SSE 的硬依赖。

2025-03-26 规范用可流式 HTTP 替代了它：一个端点，POST 用于客户端请求，GET 用于建立会话流，两者共享一个 `Mcp-Session-Id` 头。此后构建或迁移的每个服务器都使用可流式 HTTP。旧的 SSE 模式正在被弃用——Atlassian Rovo 于 2026 年 6 月 30 日移除它；Keboola 于 2026 年 4 月 1 日；大多数剩余的企业服务器在 2026 年底前。

而 stdio 对本地服务器仍然重要。Claude Desktop、VS Code 和每个 IDE 形状的客户端通过 stdio 生成服务器。正确的心智模型：stdio 用于"这台机器"，可流式 HTTP 用于"通过网络"。没有交叉。

## 核心概念

### stdio

- 子进程传输。客户端生成服务器，通过 stdin/stdout 通信。
- 每行一个 JSON 对象。换行分隔。
- 无会话 ID；进程身份就是会话。
- 不需要认证（子进程继承父进程的信任边界）。
- 永远不要用于远程服务器——你需要 SSH 或 socat 来隧道，此时使用可流式 HTTP。

### 可流式 HTTP

单端点 `/mcp`（或任何路径）。支持三种 HTTP 方法：

- **POST /mcp。** 客户端发送 JSON-RPC 消息。服务器回复单个 JSON 响应，或一个 SSE 流，包含一个或多个响应（对批量响应和与该请求相关的通知有用）。
- **GET /mcp。** 客户端打开一个长连接 SSE 通道。服务器用它发送服务器到客户端的请求（采样、通知、引导）。
- **DELETE /mcp。** 客户端显式终止会话。

会话由服务器在第一个响应上设置的 `Mcp-Session-Id` 头标识，客户端在后续每个请求上回显。会话 ID 必须是加密随机的（128+ 位）；客户端选择的 ID 因安全而被拒绝。

### 单端点 vs 双端点

旧规范的双端点模式在 2026 年仍然可调用——规范声明它"遗留兼容"。但所有新服务器都应该是单端点。官方 SDK 发出单端点；仅在跟未迁移的远程通信时使用遗留模式。

### `Origin` 验证和 DNS 重绑定

浏览器不是 MCP 客户端（今天），但攻击者可以制作一个网页，说服浏览器向 `localhost:1234/mcp` POST——用户的本地 MCP 服务器监听的地方。如果服务器不检查 `Origin`，浏览器的同源策略不会拯救它，因为 `Origin: http://evil.com` 是有效的跨域。

2025-11-25 规范要求服务器拒绝 `Origin` 不在允许列表上的请求。允许列表通常包含 MCP 客户端宿主（`https://claude.ai`、`vscode-webview://*`）和本地 UI 的 localhost 变体。

### 会话 ID 生命周期

1. 客户端发送第一个请求，不带 `Mcp-Session-Id`。
2. 服务器分配一个随机 ID，在响应头上设置 `Mcp-Session-Id`。
3. 客户端在所有后续请求和用于流的 `GET /mcp` 上回显该头。
4. 会话可以被服务器撤销；客户端在后续请求上看到 404，必须重新初始化。
5. 客户端可以显式 DELETE 会话以干净关闭。

### 保活和重新连接

SSE 连接会断开。客户端通过用相同的 `Mcp-Session-Id` 重新 GET 来重新建立。服务器必须将在中断期间错过的事件排队（在一个合理的窗口内）并通过客户端回显的 `last-event-id` 头重放。

Phase 13 · 13 涵盖任务，它让长时间运行的工作即使在完整会话重新连接后也能存活。

### 向后兼容探测

想要同时支持新旧服务器的客户端：

1. POST 到 `/mcp`。
2. 如果响应是 `200 OK` 带 JSON 或 SSE，这是可流式 HTTP。
3. 如果响应是 `200 OK` 带 `Content-Type: text/event-stream` 和一个指向辅助端点的 `Location` 头，这是遗留 HTTP+SSE；跟随 `Location`。

### Cloudflare、ngrok 和托管

2026 年的生产远程 MCP 服务器运行在 Cloudflare Workers（带其 MCP Agents SDK）、Vercel Functions 或容器化的 Node/Python 上。关键：你的托管必须支持 SSE GET 的长连接 HTTP。Vercel 的免费层上限为 10 秒，不适用。Cloudflare Workers 支持无限流。

### 网关组合

当你用网关前置多个 MCP 服务器时（Phase 13 · 17），网关是一个单可流式 HTTP 端点，重写会话 ID 并多路复用上游。工具在网关层合并；客户端看到一个单一逻辑服务器。

### 传输失败模式

- **stdio SIGPIPE。** 写入中途子进程死亡引发 SIGPIPE；服务器应干净退出。客户端应检测 EOF 并标记会话死亡。
- **HTTP 502 / 504。** Cloudflare、nginx 和其他代理在上游失败时发出这些。可流式 HTTP 客户端应在短退避后重试一次。
- **SSE 连接断开。** TCP RST、代理超时或客户端网络变化关闭流。客户端用 `Mcp-Session-Id` 重新连接，并可选 `last-event-id` 以恢复。
- **会话撤销。** 服务器使会话 ID 无效；客户端在下一个请求上看到 404。客户端必须重新握手。
- **时钟偏差。** 客户端上的资源 TTL 计算与服务器分歧。客户端应将服务器时间戳视为权威。

### 何时绕过可流式 HTTP

一些企业在自己的网络内部署 MCP 服务器，使用 gRPC 或消息队列传输。这是非标准的——MCP 的规范没有正式定义这些。网关可以向 MCP 客户端暴露可流式 HTTP 表面，同时内部使用 gRPC。保持外部表面符合规范；网关拥有翻译。

## 使用它

`code/main.py` 使用 `http.server`（stdlib）实现一个最小可流式 HTTP 端点。它在 `/mcp` 上处理 POST、GET 和 DELETE，在第一个响应上设置 `Mcp-Session-Id`，验证 `Origin`，并拒绝来自非允许列表来源的请求。处理程序重用第 07 课笔记服务器的分发逻辑。

看点：

- POST 处理程序读取 JSON-RPC 主体，分发，并写入 JSON 响应（单响应变体；SSE 变体结构相似）。
- `Origin` 检查拒绝默认的 `http://evil.example` 探测但接受 `http://localhost`。
- 会话 ID 是随机的 128 位十六进制字符串；服务器在内存中保持每个会话状态。

## 交付它

本课产出 `outputs/skill-mcp-transport-migrator.md`。给定一个 HTTP+SSE（遗留）MCP 服务器，该技能产生一个迁移计划到可流式 HTTP，具备会话 ID 连续性、Origin 检查和向后兼容探测支持。

## 练习

1. 运行 `code/main.py`。从 `curl` POST 一个 `initialize` 并观察 `Mcp-Session-Id` 响应头。POST 第二个请求回显该头并验证会话连续性。

2. 添加一个打开 SSE 流的 GET 处理程序。每五秒发送一个 `notifications/progress` 事件。通过用相同会话 ID 重新 GET 来重新连接并确认服务器接受它。

3. 实现 `last-event-id` 重放逻辑。重新连接时，重放自该 ID 以来生成的任何事件。

4. 扩展 `Origin` 验证以支持通配符模式（`https://*.example.com`）并确认它接受 `https://app.example.com` 但拒绝 `https://evil.example.com.attacker.net`。

5. 从官方注册表中获取一个遗留 HTTP+SSE 服务器（有几个）并草拟迁移：端点处理、会话 ID 生成和头语义中的变化。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| stdio 传输 | "本地子进程" | 通过 stdin/stdout 的 JSON-RPC，换行分隔 |
| 可流式 HTTP | "远程传输" | 单端点 POST + GET + 可选 SSE，2025-03-26 规范 |
| HTTP+SSE | "遗留" | 将于 2026 年中期移除的双端点模型 |
| `Mcp-Session-Id` | "会话头" | 服务器分配的随机 ID，在每个后续请求上回显 |
| `Origin` 允许列表 | "DNS 重绑定防御" | 拒绝 Origin 未获批准的请求 |
| 单端点 | "一个 URL" | `/mcp` 处理所有会话操作的 POST / GET / DELETE |
| `last-event-id` | "SSE 重放" | 用于恢复断开的流而不丢失事件的头 |
| 向后兼容探测 | "旧 vs 新检测" | 自动选择传输的客户端响应形状检查 |
| 长连接 HTTP | "SSE 流式" | 服务器在单个 TCP 连接上推送事件数分钟或数小时 |
| 会话撤销 | "强制重新初始化" | 服务器使会话 ID 无效；客户端必须重新握手 |

## 延伸阅读

- [MCP — 基础传输规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) — stdio 和可流式 HTTP 的规范参考
- [MCP — 基础传输规范 2025-03-26](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — 引入可流式 HTTP 的修订版
- [Cloudflare — MCP 传输](https://developers.cloudflare.com/agents/model-context-protocol/transport/) — Workers 托管的可流式 HTTP 模式
- [AWS — MCP 传输机制](https://builder.aws.com/content/35A0IphCeLvYzly9Sw40G1dVNzc/mcp-transport-mechanisms-stdio-vs-streamable-http) — 跨部署形态的比较
- [Atlassian — HTTP+SSE 弃用通知](https://community.atlassian.com/forums/Atlassian-Remote-MCP-Server/HTTP-SSE-Deprecation-Notice/ba-p/3205484) — 具体迁移截止日期示例
