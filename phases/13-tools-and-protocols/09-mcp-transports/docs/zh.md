# MCP 传输层 — stdio vs Streamable HTTP vs SSE 迁移

> stdio 只能在本地工作，在其他地方则不行。Streamable HTTP（2025-03-26）是远程标准。旧的 HTTP+SSE 传输层已弃用，将于 2026 年中期移除。选错传输层会带来迁移成本；选对传输层则能获得支持远程部署、会话连续性和 DNS 重绑定防护的 MCP 服务器。

**类型：** 学习
**语言：** Python（stdlib，Streamable HTTP 端点骨架）
**前置要求：** 阶段 13 · 07、08（MCP 服务器和客户端）
**时长：** ~45 分钟

## 学习目标

- 根据部署形态（本地 vs 远程、单进程 vs 多实例）在 stdio 和 Streamable HTTP 之间做出选择。
- 实现 Streamable HTTP 单端点模式：POST 用于请求，GET 用于会话流。
- 强制执行 `Origin` 验证和会话 ID 语义以抵御 DNS 重绑定。
- 在 2026 年中移除截止日期前，将遗留的 HTTP+SSE 服务器迁移到 Streamable HTTP。

## 问题所在

第一个 MCP 远程传输层（2024-11）是 HTTP+SSE：两个端点，一个用于客户端的 POST，一个用于服务器到客户端流的服务器推送事件（Server-Sent Events）通道。它确实能用，但也相当笨拙：每个会话两个端点，某些 CDN 前的缓存会出现问题，并且严重依赖某些 WAF 会激进关闭的长连接 SSE 连接。

2025-03-26 规范用 Streamable HTTP 取代了它：一个端点，POST 用于客户端请求，GET 用于建立会话流，两者共享 `Mcp-Session-Id` 头部。此后构建或迁移的每个服务器都使用 Streamable HTTP。旧的 SSE 模式正在被弃用——Atlassian Rovo 于 2026 年 6 月 30 日移除，Keboola 于 2026 年 4 月 1 日移除，大多数其他企业服务器将在 2026 年底前移除。

而 stdio 对本地服务器仍然重要。Claude Desktop、VS Code 和每个 IDE 形态的客户端都通过 stdio 启动服务器。正确的思维模型是：stdio 用于"本机"，Streamable HTTP 用于"通过网络"。两者不交叉。

## 概念理解

### stdio

- 子进程传输层。客户端启动服务器，通过 stdin/stdout 通信。
- 每行一个 JSON 对象。以换行符分隔。
- 无会话 ID；进程身份即为会话。
- 无需认证（子进程继承父进程的信任边界）。
- 切勿用于远程服务器——你需要 SSH 或 socat 来隧道传输，那时不如使用 Streamable HTTP。

### Streamable HTTP

单一端点 `/mcp`（或任意路径）。支持三种 HTTP 方法：

- **POST /mcp。** 客户端发送 JSON-RPC 消息。服务器回复单个 JSON 响应，或一个包含一个或多个响应的 SSE 流（适用于批量响应和与该请求相关的通知）。
- **GET /mcp。** 客户端打开一个长连接 SSE 通道。服务器用于服务器到客户端的请求（采样、通知、诱导）。
- **DELETE /mcp。** 客户端显式终止会话。

会话由服务器在首次响应中设置、客户端在每次后续请求中回传的 `Mcp-Session-Id` 头部标识。会话 ID 必须是加密随机生成的（128+ 位）；客户端选择的 ID 出于安全原因会被拒绝。

### 单端点 vs 双端点

旧规范中的双端点模式在 2026 年仍然可用——规范将其声明为"遗留兼容"。但所有新服务器应使用单端点模式。官方 SDK 发出的是单端点；仅在需要与未迁移的远程服务器通信时才使用遗留模式。

### `Origin` 验证与 DNS 重绑定

浏览器不是 MCP 客户端（目前如此），但攻击者可以构造一个网页，诱使浏览器向 `localhost:1234/mcp` 发送 POST 请求——而用户的本地 MCP 服务器正在那里监听。如果服务器不检查 `Origin`，浏览器的同源策略也无济于事，因为 `Origin: http://evil.com` 是合法的跨域请求。

2025-11-25 规范要求服务器拒绝 `Origin` 不在白名单中的请求。白名单通常包含 MCP 客户端主机（`https://claude.ai`、`vscode-webview://*`）以及供本地 UI 使用的 localhost 变体。

### 会话 ID 生命周期

1. 客户端发送首个请求时不带 `Mcp-Session-Id`。
2. 服务器分配一个随机 ID，在响应头部设置 `Mcp-Session-Id`。
3. 客户端在后续所有请求和 `GET /mcp` 流中回传该头部。
4. 服务器可以撤销会话；后续请求客户端会收到 404，必须重新初始化。
5. 客户端可以显式 DELETE 会话以实现干净关闭。

### 心跳保活与重连

SSE 连接会断开。客户端通过使用相同的 `Mcp-Session-Id` 重新发起 GET 来重建连接。服务器必须缓存在中断期间错过的事件（在合理的时间窗口内），并通过客户端回传的 `last-event-id` 头部进行重放。

阶段 13 · 13 涵盖了任务（Tasks），即使完全重新连接会话，长期运行的工作也能持续。

### 向后兼容探测

希望同时支持新旧服务器的客户端：

1. 向 `/mcp` 发送 POST。
2. 如果响应是 `200 OK` 并带有 JSON 或 SSE，则为 Streamable HTTP。
3. 如果响应是 `200 OK`，且 `Content-Type: text/event-stream` 并带有指向次要端点的 `Location` 头部，则为遗留的 HTTP+SSE；跟随 `Location`。

### Cloudflare、ngrok 与托管

2026 年生产环境中的远程 MCP 服务器运行在 Cloudflare Workers（使用其 MCP Agents SDK）、Vercel Functions 或容器化的 Node/Python 上。关键在于：你的托管服务必须支持用于 SSE GET 的长连接 HTTP 连接。Vercel 的免费套餐上限为 10 秒，不适合此用途。Cloudflare Workers 则支持无限流。

### 网关组合

当你在网关（阶段 13 · 17）前对接多个 MCP 服务器时，网关是一个单一的 Streamable HTTP 端点，它会重写会话 ID 并在上游进行多路复用。工具在网关层合并；客户端看到的是一个单一的逻辑服务器。

### 传输层故障模式

- **stdio SIGPIPE。** 子进程在写入时死亡会引发 SIGPIPE；服务器应干净退出。客户端应检测 EOF 并将会话标记为已死亡。
- **HTTP 502 / 504。** Cloudflare、nginx 和其他代理在上游故障时会发出这些状态码。Streamable HTTP 客户端应在短暂回退后重试一次。
- **SSE 连接断开。** TCP RST、代理超时或客户端网络变更会关闭流。客户端使用 `Mcp-Session-Id` 和可选的 `last-event-id` 重新连接以恢复会话。
- **会话撤销。** 服务器使会话 ID 失效；客户端在下次请求时收到 404。客户端必须重新握手。
- **时钟偏差。** 客户端上的资源 TTL 计算与服务器不一致。客户端应视服务器时间戳为权威。

### 何时绕过 Streamable HTTP

某些企业在其内部网络中使用 gRPC 或消息队列传输层部署 MCP 服务器。这并非标准做法——MCP 规范并未正式定义这些传输方式。网关可以在内部使用 gRPC 的同时，向 MCP 客户端暴露 Streamable HTTP 接口。保持外部接口符合规范；由网关负责转换。

## 动手实践

`code/main.py` 使用 `http.server`（标准库）实现了一个最小的 Streamable HTTP 端点。它处理 `/mcp` 上的 POST、GET 和 DELETE，在首次响应时设置 `Mcp-Session-Id`，验证 `Origin`，并拒绝来自非白名单来源的请求。该处理程序复用了第 07 课笔记服务器的分发逻辑。

值得关注的内容：

- POST 处理程序读取 JSON-RPC 主体，进行分发，并写入 JSON 响应（单响应变体；SSE 变体结构类似）。
- `Origin` 检查会拒绝默认的 `http://evil.example` 探测请求，但接受 `http://localhost`。
- 会话 ID 是随机的 128 位十六进制字符串；服务器将每个会话的状态保存在内存中。

## 交付成果

本课程产出 `outputs/skill-mcp-transport-migrator.md`。给定一个 HTTP+SSE（遗留）MCP 服务器，该技能会生成一个迁移计划，迁移到支持会话 ID 连续性、Origin 检查和向后兼容探测的 Streamable HTTP。

## 练习

1. 运行 `code/main.py`。通过 `curl` POST 一个 `initialize` 请求，观察 `Mcp-Session-Id` 响应头部。再次 POST 一个请求，回传该头部，并验证会话连续性。

2. 添加一个打开 SSE 流的 GET 处理程序。每五秒发送一个 `notifications/progress` 事件。通过使用相同的会话 ID 重新 GET 来重连，并确认服务器接受该连接。

3. 实现 `last-event-id` 重放逻辑。在重连时，重放自该 ID 以来生成的所有事件。

4. 扩展 `Origin` 验证以支持通配符模式（`https://*.example.com`），并确认它接受 `https://app.example.com` 但拒绝 `https://evil.example.com.attacker.net`。

5. 从官方注册表中取出一个遗留的 HTTP+SSE 服务器（有多个可用），并草拟迁移方案：端点处理、会话 ID 生成和头部语义需要做哪些变更。

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-----------|---------|
| stdio 传输层 | "本地子进程" | 通过 stdin/stdout 的 JSON-RPC，换行符分隔 |
| Streamable HTTP | "远程传输层" | 单端点 POST + GET + 可选 SSE，2025-03-26 规范 |
| HTTP+SSE | "遗留模式" | 2026 年中将移除的双端点模型 |
| `Mcp-Session-Id` | "会话头部" | 服务器分配的随机 ID，每次后续请求回传 |
| `Origin` 白名单 | "DNS 重绑定防御" | 拒绝 Origin 未经批准的请求 |
| 单端点 | "一个 URL" | `/mcp` 处理所有会话操作的 POST / GET / DELETE |
| `last-event-id` | "SSE 重放" | 用于在不丢失事件的情况下恢复断开流的头部 |
| 向后兼容探测 | "新旧检测" | 客户端通过响应形态检查自动选择传输层 |
| 长连接 HTTP | "SSE 流式传输" | 服务器在一个 TCP 连接上持续推送事件数分钟或数小时 |
| 会话撤销 | "强制重新初始化" | 服务器使会话 ID 失效；客户端必须重新握手 |

## 延伸阅读

- [MCP — 基本传输层规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) — stdio 和 Streamable HTTP 的权威参考
- [MCP — 基本传输层规范 2025-03-26](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — 引入 Streamable HTTP 的修订版
- [Cloudflare — MCP 传输层](https://developers.cloudflare.com/agents/model-context-protocol/transport/) — Workers 托管的 Streamable HTTP 模式
- [AWS — MCP 传输机制](https://builder.aws.com/content/35A0IphCeLvYzly9Sw40G1dVNzc/mcp-transport-mechanisms-stdio-vs-streamable-http) — 跨部署形态的对比
- [Atlassian — HTTP+SSE 弃用通知](https://community.atlassian.com/forums/Atlassian-Remote-MCP-Server/HTTP-SSE-Deprecation-Notice/ba-p/3205484) — 具体的迁移截止日期示例
