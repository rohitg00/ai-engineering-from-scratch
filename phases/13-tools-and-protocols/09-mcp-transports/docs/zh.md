# 09 · MCP 传输层——stdio、Streamable HTTP 与 SSE 迁移对比

> stdio 只能在本地工作，离开本机就失效。Streamable HTTP（2025-03-26）是远程传输的标准。旧的 HTTP+SSE 传输已被弃用，并将在 2026 年年中被移除。选错传输层意味着要付出一次迁移的代价；选对了，则换来一个可远程托管、具备会话连续性（session continuity）与 DNS 重绑定（DNS-rebinding）防护的 MCP 服务器。

**类型：** 学习
**语言：** Python（标准库，Streamable HTTP 端点骨架）
**前置：** 阶段 13 · 07、08（MCP 服务器与客户端）
**时长：** 约 45 分钟

## 学习目标

- 根据部署形态（本地 vs 远程、单进程 vs 集群）在 stdio 与 Streamable HTTP 之间做出选择。
- 实现 Streamable HTTP 单端点模式：用 POST 发送请求，用 GET 建立会话流。
- 强制执行 `Origin` 校验与 session-id 语义，以挫败 DNS 重绑定攻击。
- 在 2026 年年中的移除截止期之前，把遗留的 HTTP+SSE 服务器迁移到 Streamable HTTP。

## 问题所在

MCP 最早的远程传输（2024-11）是 HTTP+SSE：两个端点，一个用于客户端的 POST，另一个是用于服务器到客户端流的服务器发送事件（Server-Sent-Events，SSE）通道。它能用，但也很笨重：每个会话需要两个端点、在某些 CDN 前会破坏缓存，还硬性依赖长连接 SSE，而有些 WAF（Web 应用防火墙）会激进地终止这类连接。

2025-03-26 规范用 Streamable HTTP 取代了它：单个端点，POST 用于客户端请求，GET 用于建立会话流，二者共享一个 `Mcp-Session-Id` 头。自那以后构建或迁移的每一个服务器都使用 Streamable HTTP。旧的 SSE 模式正在被弃用——Atlassian Rovo 于 2026 年 6 月 30 日移除；Keboola 于 2026 年 4 月 1 日移除；其余大多数企业级服务器将在 2026 年年底前完成。

而 stdio 对本地服务器依然重要。Claude Desktop、VS Code 以及每一个 IDE 形态的客户端都通过 stdio 来启动服务器。正确的思维模型是：stdio 用于「本机」，Streamable HTTP 用于「跨网络」。两者不交叉。

## 核心概念

### stdio

- 子进程传输。客户端启动服务器，通过 stdin/stdout 通信。
- 每行一个 JSON 对象，以换行符分隔。
- 没有 session id；进程身份即会话。
- 无需鉴权（子进程继承父进程的信任边界）。
- 切勿用于远程服务器——那样你就需要用 SSH 或 socat 做隧道，而到那一步还不如直接用 Streamable HTTP。

### Streamable HTTP

单个端点 `/mcp`（或任意路径）。支持三种 HTTP 方法：

- **POST /mcp。** 客户端发送一条 JSON-RPC 消息。服务器以单个 JSON 响应作答，或返回一个包含一个或多个响应的 SSE 流（这对批量响应以及与该请求相关的通知很有用）。
- **GET /mcp。** 客户端打开一个长连接 SSE 通道。服务器用它来发起服务器到客户端的请求（采样 sampling、通知、信息征询 elicitation）。
- **DELETE /mcp。** 客户端显式终止会话。

会话通过 `Mcp-Session-Id` 头来标识：服务器在首个响应上设置该头，客户端在之后的每个请求上回传它。session id 必须是密码学随机值（128 位以上）；出于安全考虑，由客户端选定的 id 会被拒绝。

### 单端点 vs 双端点

旧规范里的双端点模式在 2026 年仍可调用——规范将其声明为「遗留兼容（legacy compatible）」。但所有新服务器都应采用单端点。官方 SDK 输出的是单端点；只有在与未迁移的远程服务器通信时才使用遗留模式。

### `Origin` 校验与 DNS 重绑定

浏览器（目前）不是 MCP 客户端，但攻击者可以构造一个网页，诱使浏览器向 `localhost:1234/mcp`（用户本地 MCP 服务器监听的地址）发起 POST。如果服务器不检查 `Origin`，浏览器的同源策略也救不了它，因为 `Origin: http://evil.com` 是合法的跨源（cross-origin）值。

2025-11-25 规范要求服务器拒绝 `Origin` 不在白名单（allowlist）上的请求。白名单通常包含 MCP 客户端主机（`https://claude.ai`、`vscode-webview://*`）以及面向本地 UI 的 localhost 变体。

### session id 生命周期

1. 客户端发送首个请求，不带 `Mcp-Session-Id`。
2. 服务器分配一个随机 id，在响应头上设置 `Mcp-Session-Id`。
3. 客户端在之后所有请求以及用于建立流的 `GET /mcp` 上回传该头。
4. 会话可被服务器吊销；客户端在后续请求上看到 404，必须重新初始化。
5. 客户端可显式 DELETE 会话以实现干净关闭。

### 保活与重连

SSE 连接会断开。客户端通过用相同的 `Mcp-Session-Id` 重新 GET 来重建连接。服务器必须缓存断连期间错过的事件（在合理的窗口内），并通过客户端回传的 `last-event-id` 头重放这些事件。

阶段 13 · 13 讲解任务（Tasks），它让长时间运行的工作即便在整个会话重连后也能存活。

### 向后兼容探测

一个想同时支持新旧服务器的客户端：

1. 向 `/mcp` 发起 POST。
2. 如果响应是 `200 OK` 且为 JSON 或 SSE，则这是 Streamable HTTP。
3. 如果响应是 `200 OK`、`Content-Type: text/event-stream` 且带有一个指向次级端点的 `Location` 头，则这是遗留的 HTTP+SSE；跟随该 `Location`。

### Cloudflare、ngrok 与托管

2026 年的生产环境远程 MCP 服务器运行在 Cloudflare Workers（搭配其 MCP Agents SDK）、Vercel Functions，或容器化的 Node/Python 上。关键在于：你的托管平台必须支持用于 SSE GET 的长连接 HTTP。Vercel 免费层将连接上限设为 10 秒，并不适用。Cloudflare Workers 支持无限期的流。

### 网关组合

当你用网关（阶段 13 · 17）在多个 MCP 服务器前端聚合时，网关本身是一个单独的 Streamable HTTP 端点，负责改写 session id 并对上游做多路复用。工具在网关层被合并；客户端看到的是单个逻辑服务器。

### 传输层的失败模式

- **stdio SIGPIPE。** 子进程在写入过程中死亡会引发 SIGPIPE；服务器应干净退出。客户端应检测 EOF 并将会话标记为已死。
- **HTTP 502 / 504。** Cloudflare、nginx 以及其他代理在上游故障时会发出这些状态码。Streamable HTTP 客户端应在短暂退避后重试一次。
- **SSE 连接断开。** TCP RST、代理超时或客户端网络变更会关闭流。客户端用 `Mcp-Session-Id` 以及可选的 `last-event-id` 重连以恢复。
- **会话吊销。** 服务器作废一个 session id；客户端在下次请求时看到 404。客户端必须重新握手。
- **时钟偏移（clock skew）。** 客户端的资源 TTL 计算与服务器产生分歧。客户端应将服务器时间戳视为权威。

### 何时绕过 Streamable HTTP

一些企业在自有网络内将 MCP 服务器部署在 gRPC 或消息队列传输之后。这是非标准做法——MCP 规范并未正式定义这些。网关可以对 MCP 客户端暴露一个 Streamable HTTP 表面，而在内部使用 gRPC。要保持外部表面符合规范；翻译工作由网关负责。

## 动手用它

`code/main.py` 使用 `http.server`（标准库）实现了一个最小化的 Streamable HTTP 端点。它在 `/mcp` 上处理 POST、GET 和 DELETE，在首个响应上设置 `Mcp-Session-Id`，校验 `Origin`，并拒绝来自非白名单源的请求。该处理器复用了第 07 课笔记服务器的分发逻辑。

需要关注的地方：

- POST 处理器读取 JSON-RPC 报文体、分发，并写出 JSON 响应（单响应变体；SSE 变体在结构上类似）。
- `Origin` 检查拒绝默认的 `http://evil.example` 探测，但接受 `http://localhost`。
- session id 是随机的 128 位十六进制字符串；服务器在内存中保存每个会话的状态。

## 交付它

本课产出 `outputs/skill-mcp-transport-migrator.md`。给定一个 HTTP+SSE（遗留）MCP 服务器，该技能会生成一份迁移到 Streamable HTTP 的方案，涵盖 session-id 连续性、Origin 检查与向后兼容探测支持。

## 练习

1. 运行 `code/main.py`。用 `curl` POST 一个 `initialize`，观察 `Mcp-Session-Id` 响应头。再 POST 第二个请求并回传该头，验证会话连续性。

2. 添加一个 GET 处理器来打开 SSE 流。每五秒发送一个 `notifications/progress` 事件。用相同的 session id 重新 GET 来重连，确认服务器接受它。

3. 实现 `last-event-id` 重放逻辑。重连时，重放自该 id 以来生成的所有事件。

4. 扩展 `Origin` 校验以支持通配符模式（`https://*.example.com`），确认它接受 `https://app.example.com` 但拒绝 `https://evil.example.com.attacker.net`。

5. 从官方注册表（有好几个）中取一个遗留的 HTTP+SSE 服务器，勾勒其迁移方案：端点处理、session id 生成以及头语义各自需要做哪些改动。

## 关键术语

| 术语 | 人们怎么说 | 它实际的含义 |
|------|----------------|------------------------|
| stdio 传输 | 「本地子进程」 | 基于 stdin/stdout 的 JSON-RPC，以换行符分隔 |
| Streamable HTTP | 「远程传输」 | 单端点 POST + GET + 可选 SSE，2025-03-26 规范 |
| HTTP+SSE | 「遗留」 | 双端点模型，2026 年年中被移除 |
| `Mcp-Session-Id` | 「会话头」 | 服务器分配的随机 id，在之后每个请求上回传 |
| `Origin` 白名单 | 「DNS 重绑定防御」 | 拒绝 Origin 未获批准的请求 |
| 单端点 | 「一个 URL」 | `/mcp` 处理所有会话操作的 POST / GET / DELETE |
| `last-event-id` | 「SSE 重放」 | 用于恢复已断开的流而不丢失事件的头 |
| 向后兼容探测 | 「新旧检测」 | 客户端通过响应形态检查来自动选择传输层 |
| 长连接 HTTP | 「SSE 流式」 | 服务器在一条 TCP 连接上推送事件，持续数分钟到数小时 |
| 会话吊销 | 「强制重新初始化」 | 服务器作废一个 session id；客户端必须重新握手 |

## 延伸阅读

- [MCP——基础传输规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) —— stdio 与 Streamable HTTP 的权威参考
- [MCP——基础传输规范 2025-03-26](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) —— 引入 Streamable HTTP 的那一版修订
- [Cloudflare——MCP 传输](https://developers.cloudflare.com/agents/model-context-protocol/transport/) —— Workers 托管的 Streamable HTTP 模式
- [AWS——MCP 传输机制](https://builder.aws.com/content/35A0IphCeLvYzly9Sw40G1dVNzc/mcp-transport-mechanisms-stdio-vs-streamable-http) —— 跨部署形态的对比
- [Atlassian——HTTP+SSE 弃用通告](https://community.atlassian.com/forums/Atlassian-Remote-MCP-Server/HTTP-SSE-Deprecation-Notice/ba-p/3205484) —— 一个具体的迁移截止期示例
