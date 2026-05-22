# MCP 传输层 — stdio vs Streamable HTTP vs SSE 迁移

> stdio 在本地运行，在其他地方无法使用。Streamable HTTP (2025-03-26) 是远程标准。旧的 HTTP+SSE 传输层已被弃用，将于 2026 年中移除。选错传输层需要迁移；选对传输层可以获得支持会话连续性和 DNS 重绑定保护的远程可托管 MCP 服务器。

**类型：** 学习
**语言：** Python (stdlib, Streamable HTTP 端点框架)
**前置条件：** 阶段 13 · 07, 08 (MCP 服务器和客户端)
**时间：** ~45 分钟

## 学习目标

- 根据部署形态（本地 vs 远程，单进程 vs 集群）在 stdio 和 Streamable HTTP 之间做出选择。
- 实现 Streamable HTTP 单端点模式：POST 用于请求，GET 用于会话流。
- 强制执行 `Origin` 验证和会话 ID 语义以防御 DNS 重绑定攻击。
- 在 2026 年中移除截止日期之前，将遗留的 HTTP+SSE 服务器迁移到 Streamable HTTP。

## 问题背景

第一个 MCP 远程传输层 (2024-11) 是 HTTP+SSE：两个端点，一个用于客户端的 POST 请求，一个用于服务器到客户端的流传输的 Server-Sent-Events 通道。它能工作，但也笨拙：每个会话需要两个端点，某些 CDN 前面的缓存会出问题，并且强依赖长连接 SSE，而某些 WAF 会主动终止这种连接。

2025-03-26 规范用 Streamable HTTP 取代了它：一个端点，POST 用于客户端请求，GET 用于建立会话流，两者共享 `Mcp-Session-Id` 头部。从那时起构建或迁移的每个服务器都使用 Streamable HTTP。旧的 SSE 模式正在被弃用 — Atlassian Rovo 将于 2026 年 6 月 30 日移除它；Keboola 在 2026 年 4 月 1 日；大多数剩余的企业服务器在 2026 年底前完成。

stdio 对于本地服务器仍然重要。Claude Desktop、VS Code 和每个 IDE 形态的客户端都通过 stdio 启动服务器。正确的心智模型：stdio 用于"本机"，Streamable HTTP 用于"网络连接"。不要交叉使用。

## 概念详解

### stdio

- 子进程传输层。客户端启动服务器，通过 stdin/stdout 进行通信。
- 每行一个 JSON 对象。换行符分隔。
- 无会话 ID；进程身份即会话。
- 无需认证（子进程继承父进程的信任边界）。
- 永远不要用于远程服务器 — 你需要 SSH 或 socat 来隧道传输，既然如此不如直接使用 Streamable HTTP。

### Streamable HTTP

单端点 `/mcp`（或任何路径）。支持三种 HTTP 方法：

- **POST /mcp。** 客户端发送 JSON-RPC 消息。服务器回复单个 JSON 响应，或者一个或多个响应的 SSE 流（适用于批量响应和与该请求相关的通知）。
- **GET /mcp。** 客户端打开长连接 SSE 通道。服务器用它来处理服务器到客户端的请求（采样、通知、询问）。
- **DELETE /mcp。** 客户端显式终止会话。

会话由服务器在首次响应上设置、客户端在后续每个请求中回显的 `Mcp-Session-Id` 头部标识。会话 ID 必须是加密随机的（128+ 位）；出于安全考虑，客户端选择的 ID 会被拒绝。

### 单端点 vs 双端点

旧规范中的双端点模式在 2026 年仍然可以调用 — 规范声明它是"遗留兼容"的。但所有新服务器都应该使用单端点。官方 SDK 都使用单端点；仅在与不迁移的远程服务器通信时使用遗留模式。

### `Origin` 验证和 DNS 重绑定

浏览器不是 MCP 客户端（目前），但攻击者可以制作一个网页，诱使浏览器向 `localhost:1234/mcp` 发送 POST 请求 — 即用户本地 MCP 服务器监听的地址。如果服务器不检查 `Origin`，浏览器的同源策略也无法拯救它，因为 `Origin: http://evil.com` 是有效的跨源请求。

2025-11-25 规范要求服务器拒绝 `Origin` 不在允许列表中的请求。允许列表通常包含 MCP 客户端主机（`https://claude.ai`、`vscode-webview://*`）和本地 UI 的 localhost 变体。

### 会话 ID 生命周期

1. 客户端发送第一个不带 `Mcp-Session-Id` 的请求。
2. 服务器分配随机 ID，在响应头部设置 `Mcp-Session-Id`。
3. 客户端在所有后续请求和 `GET /mcp` 流请求中回显该头部。
4. 会话可以被服务器撤销；客户端在后续请求中看到 404 必须重新初始化。
5. 客户端可以显式 DELETE 会话以实现干净关闭。

### 保活和重连

SSE 连接会断开。客户端通过重新 GET 相同的 `Mcp-Session-Id` 来重新建立连接。服务器必须将中断期间错过的事件排队（在合理的时间窗口内）并通过客户端回显的 `last-event-id` 头部重放。

阶段 13 · 13 涵盖了 Tasks，它让长时间运行的工作即使在完全会话重连时也能存活。

### 向后兼容性探测

想要同时支持新旧服务器的客户端：

1. POST 到 `/mcp`。
2. 如果响应是带 JSON 或 SSE 的 `200 OK`，这是 Streamable HTTP。
3. 如果响应是带 `Content-Type: text/event-stream` 的 `200 OK` 并且有一个指向辅助端点的 `Location` 头部，这是遗留的 HTTP+SSE；遵循 `Location`。

### Cloudflare、ngrok 和托管

2026 年生产环境的远程 MCP 服务器运行在 Cloudflare Workers（使用其 MCP Agents SDK）、Vercel Functions 或容器化的 Node/Python 上。关键：你的托管必须支持长连接 HTTP 连接以用于 SSE GET。Vercel 的免费层限制为 10 秒，不适合。Cloudflare Workers 支持无限期流。

### 网关组合

当你用网关（阶段 13 · 17）前置多个 MCP 服务器时，网关是一个重写会话 ID 并多路复用上游的单 Streamable HTTP 端点。工具在网关层合并；客户端看到的是一个逻辑服务器。

### 传输层故障模式

- **stdio SIGPIPE。** 写入过程中子进程死亡会引发 SIGPIPE；服务器应该干净地退出。客户端应该检测 EOF 并标记会话已死。
- **HTTP 502 / 504。** Cloudflare、nginx 和其他代理在上游故障时发出这些。Streamable HTTP 客户端应该在短暂退避后重试一次。
- **SSE 连接断开。** TCP RST、代理超时或客户端网络变化会关闭流。客户端使用 `Mcp-Session-Id` 和可选的 `last-event-id` 重新连接以恢复。
- **会话撤销。** 服务器使会话 ID 失效；客户端在下一个请求中看到 404。客户端必须重新握手。
- **时钟偏移。** 客户端上的资源 TTL 计算与服务器偏离。客户端应该将服务器时间戳视为权威。

### 何时绕过 Streamable HTTP

某些企业在自己的网络内通过 gRPC 或消息队列传输层部署 MCP 服务器。这是非标准的 — MCP 规范没有正式定义这些。网关可以向 MCP 客户端暴露 Streamable HTTP 表面，同时在内部使用 gRPC。保持外部表面符合规范；网关负责转换。

## 使用示例

`code/main.py` 使用 `http.server` (stdlib) 实现了一个最小的 Streamable HTTP 端点。它处理 `/mcp` 上的 POST、GET 和 DELETE，在首次响应上设置 `Mcp-Session-Id`，验证 `Origin`，并拒绝来自非允许列表来源的请求。处理器复用了第 07 课笔记服务器的调度逻辑。

需要关注的点：

- POST 处理器读取 JSON-RPC 主体，调度，并写入 JSON 响应（单响应变体；SSE 变体结构类似）。
- `Origin` 检查拒绝默认的 `http://evil.example` 探测但接受 `http://localhost`。
- 会话 ID 是随机的 128 位十六进制字符串；服务器在内存中保存每个会话的状态。

## 实战输出

本课生成 `outputs/skill-mcp-transport-migrator.md`。给定一个 HTTP+SSE（遗留）MCP 服务器，该技能生成迁移到 Streamable HTTP 的计划，包括会话 ID 连续性、Origin 检查和向后兼容探测支持。

## 练习

1. 运行 `code/main.py`。从 `curl` POST 一个 `initialize` 并观察 `Mcp-Session-Id` 响应头部。POST 第二个请求回显该头部并验证会话连续性。

2. 添加打开 SSE 流的 GET 处理器。每五秒发送一个 `notifications/progress` 事件。通过使用相同会话 ID 重新 GET 来重新连接，并确认服务器接受它。

3. 实现 `last-event-id` 重放逻辑。重新连接时，重放自该 ID 以来生成的任何事件。

4. 扩展 `Origin` 验证以支持通配符模式（`https://*.example.com`）并确认它接受 `https://app.example.com` 但拒绝 `https://evil.example.com.attacker.net`。

5. 从官方注册表选择一个遗留的 HTTP+SSE 服务器（有几个）并勾勒迁移方案：端点处理、会话 ID 生成和头部语义方面需要什么更改。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| stdio 传输层 | "本地子进程" | 通过 stdin/stdout 的 JSON-RPC，换行符分隔 |
| Streamable HTTP | "远程传输层" | 单端点 POST + GET + 可选 SSE，2025-03-26 规范 |
| HTTP+SSE | "遗留" | 双端点模型，将于 2026 年中移除 |
| `Mcp-Session-Id` | "会话头部" | 服务器分配的随机 ID，在每个后续请求中回显 |
| `Origin` 允许列表 | "DNS 重绑定防御" | 拒绝来源未获批准的请求 |
| 单端点 | "一个 URL" | `/mcp` 处理所有会话操作的 POST / GET / DELETE |
| `last-event-id` | "SSE 重放" | 用于恢复断开的流而不丢失事件的头部 |
| 向后兼容探测 | "新旧检测" | 客户端响应形状检查，自动选择传输层 |
| 长连接 HTTP | "SSE 流" | 服务器在一个 TCP 连接上推送事件数分钟或数小时 |
| 会话撤销 | "强制重新初始化" | 服务器使会话 ID 失效；客户端必须再次握手 |

## 延伸阅读

- [MCP — 基础传输层规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) — stdio 和 Streamable HTTP 的权威参考
- [MCP — 基础传输层规范 2025-03-26](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — 引入 Streamable HTTP 的修订版
- [Cloudflare — MCP 传输层](https://developers.cloudflare.com/agents/model-context-protocol/transport/) — Workers 托管的 Streamable HTTP 模式
- [AWS — MCP 传输层机制](https://builder.aws.com/content/35A0IphCeLvYzly9Sw40G1dVNzc/mcp-transport-mechanisms-stdio-vs-streamable-http) — 跨部署形态的比较
- [Atlassian — HTTP+SSE 弃用通知](https://community.atlassian.com/forums/Atlassian-Remote-MCP-Server/HTTP-SSE-Deprecation-Notice/ba-p/3205484) — 具体的迁移截止日期示例
