# 构建 MCP 客户端——发现、调用、会话管理

> 大多数 MCP 内容发布服务器教程并对客户端挥挥手。客户端代码是困难编排所在：进程生成、能力协商、跨多个服务器的工具列表合并、采样回调、重新连接和命名空间冲突解决。本课构建一个多服务器客户端，将三个不同的 MCP 服务器提升到一个扁平的工具命名空间中供模型使用。

**类型：** Build
**语言：** Python（stdlib，多服务器 MCP 客户端）
**前置知识：** Phase 13 · 07（构建 MCP 服务器）
**时间：** ~75 分钟

## 学习目标

- 将 MCP 服务器作为子进程生成，完成 `initialize`，并发送 `notifications/initialized`。
- 维护每个服务器的会话状态（能力、工具列表、最后看到的通知 ID）。
- 将跨多个服务器的工具列表合并到一个命名空间中并处理冲突。
- 将工具调用路由到拥有它的服务器并重组响应。

## 问题所在

真正的代理宿主（Claude Desktop、Cursor、Goose、Gemini CLI）同时加载多个 MCP 服务器。用户可能同时运行文件系统服务器、Postgres 服务器和 GitHub 服务器。客户端的工作：

1. 生成每个服务器。
2. 独立握手每个。
3. 在每个上调用 `tools/list` 并扁平化结果。
4. 当模型发出 `notes_search` 时，在合并的命名空间中查找并将其路由到正确的服务器。
5. 处理来自任何服务器的通知（`tools/list_changed`）而不阻塞。
6. 传输失败时重新连接。

手工完成所有这些是将"玩具"与"可用"分开的。官方 SDK 包装了此，但心智模型必须是你的。

## 核心概念

### 子进程生成

`subprocess.Popen` 带 `stdin=PIPE, stdout=PIPE, stderr=PIPE`。设置 `bufsize=1` 并使用文本模式进行逐行读取。每个服务器是一个进程；客户端为每个服务器持有一个 `Popen` 句柄。

### 每个服务器的会话状态

每个服务器一个 `Session` 对象持有：

- `process` — Popen 句柄。
- `capabilities` — 服务器在 `initialize` 时声明的内容。
- `tools` — 最后的 `tools/list` 结果。
- `pending` — 请求 ID 到等待响应的 promise/future 的映射。

请求本质上是异步的；发送到服务器 A 的 `tools/call` 不应在服务器 B 正在调用时阻塞。使用带队列的线程或 asyncio。

### 合并命名空间

当客户端看到聚合工具列表时，名称可能冲突。两个服务器可能都暴露 `search`。客户端有三个选项：

1. **按服务器名前缀。** `notes/search`、`files/search`。清晰但丑陋。
2. **静默先到。** 后到的服务器的 `search` 覆盖早到的。有风险；隐藏冲突。
3. **冲突拒绝。** 拒绝加载第二个服务器；通知用户。对安全敏感宿主最安全。

Claude Desktop 使用按服务器前缀。Cursor 使用带清晰错误的冲突拒绝。VS Code MCP 也采用按服务器前缀。

### 路由

合并后，一个分发表将 `tool_name -> session` 映射。模型按名称发出调用；客户端找到会话并将 `tools/call` 消息写入该服务器的 stdin，然后等待响应。

### 采样回调

如果服务器在 `initialize` 时声明了 `sampling` 能力，它可以发送 `sampling/createMessage` 请求客户端运行其 LLM。客户端必须：

1. 阻塞对该服务器的进一步请求直到采样解决，或如果其实现支持并发则流水线处理。
2. 调用其 LLM 提供商。
3. 将响应发送回服务器。

第 11 课端到端涵盖采样。本课为完整性而存根。

### 通知处理

`notifications/tools/list_changed` 意味着重新调用 `tools/list`。`notifications/resources/updated` 意味着如果资源正在使用则重新读取。通知不得产生响应——不要尝试确认它们。

常见客户端错误：在 `tools/call` 上阻塞读取循环，而通知留在流中。使用后台读取线程将每条消息推送到队列；主线程出队并分发。

### 重新连接

传输可能失败：服务器崩溃、操作系统终止进程、stdio 管道断裂。客户端检测 stdout 上的 EOF 并将会话视为死亡。选项：

- 静默重启服务器并重新握手。对纯只读服务器可以。
- 向用户暴露失败。对有用户可见会话的状态服务器可以。

Phase 13 · 09 涵盖可流式 HTTP 重新连接语义；stdio 更简单。

### 保活和会话 ID

可流式 HTTP 使用 `Mcp-Session-Id` 头。Stdio 没有会话 ID — 进程身份就是会话。保活 ping 是可选的；stdio 管道在空闲时不会断裂。

## 使用它

`code/main.py` 将三个模拟 MCP 服务器作为子进程生成，独立握手每个，合并它们的工具列表，并将工具调用路由到正确的服务器。"服务器"实际上是运行玩具响应器的其他 Python 进程（无真实 LLM）。运行它以查看：

- 三次初始化，每个都有自己的能力集。
- 三个 `tools/list` 结果合并到一个 7 工具命名空间中。
- 基于工具名称的路由决策。
- 通过命名空间前缀防止的冲突。

看点：

- `Session` 数据类干净地持有每个服务器状态。
- 后台读取线程在 stdout 上出队每行而不阻塞主线程。
- 分发表是一个简单的 `dict[str, Session]`。
- 冲突处理是显式的：当两个服务器声明相同名称时，后到的用前缀重命名。

## 交付它

本课产出 `outputs/skill-mcp-client-harness.md`。给定 MCP 服务器的声明列表（名称、命令、参数），该技能产生一个框架，生成它们、合并工具列表并发布带冲突解决的路由函数。

## 练习

1. 运行 `code/main.py` 并观察服务器生成日志。用 SIGTERM 终止其中一个模拟服务器进程并观察客户端如何检测 EOF 并将该会话标记为死亡。

2. 实现命名空间前缀。当两个服务器暴露 `search` 时，将第二个重命名为 `<server>/search`。更新分发表并验证工具调用正确路由。

3. 为服务器重启添加连接池风格的退避：连续失败时指数退避，上限 30 秒，三次失败后向用户发出通知。

4. 草拟一个支持 100 个并发 MCP 服务器的客户端。什么数据结构替代简单的分发字典？（提示：前缀命名空间的 trie，加上每个服务器的工具计数指标。）

5. 将客户端移植到官方 MCP Python SDK。SDK 包装 `stdio_client` 和 `ClientSession`。代码应从约 200 行缩减到约 40 行，同时保留多服务器路由。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| MCP 客户端 | "代理宿主" | 生成服务器并编排工具调用的进程 |
| 会话 | "每个服务器的状态" | 能力、工具列表和待处理请求簿记 |
| 合并命名空间 | "一个工具列表" | 跨所有活动服务器的工具名称扁平集 |
| 命名空间冲突 | "两个服务器相同工具" | 客户端必须前缀、拒绝或先到处理重复 |
| 路由 | "谁得到这个调用？" | 从工具名称到拥有服务器的分发 |
| 后台读取器 | "非阻塞 stdout" | 将服务器 stdout 排入队列的线程或任务 |
| 采样回调 | "LLM 即服务" | 客户端处理来自服务器的 `sampling/createMessage` |
| `notifications/*_changed` | "原语已变更" | 信号客户端必须重新发现或重新读取 |
| 重新连接策略 | "服务器死亡时" | 传输失败时的重启语义 |
| Stdio 会话 | "进程 = 会话" | 无会话 ID；子进程生命周期就是会话 |

## 延伸阅读

- [模型上下文协议 — 客户端规范](https://modelcontextprotocol.io/specification/2025-11-25/client) — 规范客户端行为
- [MCP — 快速入门客户端指南](https://modelcontextprotocol.io/quickstart/client) — 使用 Python SDK 的 hello-world 客户端教程
- [MCP Python SDK — 客户端模块](https://github.com/modelcontextprotocol/python-sdk) — 参考 `ClientSession` 和 `stdio_client`
- [MCP TypeScript SDK — 客户端](https://github.com/modelcontextprotocol/typescript-sdk) — TS 并行
- [VS Code — 扩展中的 MCP](https://code.visualstudio.com/api/extension-guides/ai/mcp) — VS Code 如何在单个编辑器宿主中多路复用多个 MCP 服务器
