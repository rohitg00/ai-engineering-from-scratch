# 08 · 构建 MCP 客户端——发现、调用与会话管理

> 大多数 MCP 内容只发布服务端教程，对客户端则一笔带过。但客户端代码才是繁重编排逻辑的所在地：进程派生、能力协商、跨多服务端的工具列表合并、采样回调、重连，以及命名空间冲突的消解。本课将构建一个多服务端客户端，把三个不同的 MCP 服务端提升进一个统一扁平的工具命名空间，供模型使用。

**类型：** 构建（Build）
**语言：** Python（标准库，多服务端 MCP 客户端）
**前置：** 阶段 13 · 07（构建 MCP 服务端）
**时长：** 约 75 分钟

## 学习目标

- 把一个 MCP 服务端作为子进程派生出来，完成 `initialize`，并发送 `notifications/initialized`。
- 维护每个服务端各自的会话状态（能力、工具列表、最近一次见到的通知 id）。
- 把多个服务端的工具列表合并进一个命名空间，并处理冲突。
- 把一次工具调用路由到拥有该工具的服务端，并重组其响应。

## 问题所在

一个真实的智能体宿主（Claude Desktop、Cursor、Goose、Gemini CLI）会同时加载多个 MCP 服务端。用户可能同时运行着一个文件系统服务端、一个 Postgres 服务端和一个 GitHub 服务端。客户端的职责是：

1. 派生（spawn）每个服务端。
2. 各自独立完成握手。
3. 对每个服务端调用 `tools/list` 并把结果扁平化。
4. 当模型发出 `notes_search` 时，在合并后的命名空间中查找它，并路由到正确的服务端。
5. 处理来自任意服务端的通知（`tools/list_changed`）而不发生阻塞。
6. 在传输失败时重连。

手工实现这一整套，正是「玩具」与「可用」之间的分水岭。官方 SDK 把这些封装了起来，但你自己心里必须有这套模型。

## 概念

### 子进程派生

使用 `subprocess.Popen`，并设置 `stdin=PIPE, stdout=PIPE, stderr=PIPE`。设置 `bufsize=1` 并使用文本模式，以便逐行读取。每个服务端是一个进程；客户端为每个服务端持有一个 `Popen` 句柄。

### 每服务端的会话状态

每个服务端对应一个 `Session` 对象，其中保存：

- `process`——Popen 句柄。
- `capabilities`——服务端在 `initialize` 时声明的能力。
- `tools`——最近一次 `tools/list` 的结果。
- `pending`——请求 id 到一个等待响应的 promise/future 的映射。

请求天然是异步的；当服务端 B 处于调用中途时，向服务端 A 发出的 `tools/call` 绝不能因此阻塞。要么使用带队列的线程，要么使用 asyncio。

### 合并命名空间

当客户端拿到聚合后的工具列表时，名称可能发生冲突。两个服务端可能都暴露了 `search`。客户端有三种选择：

1. **按服务端名加前缀。** `notes/search`、`files/search`。清晰但难看。
2. **静默先到先得。** 后一个服务端的 `search` 覆盖先前的。有风险；会隐藏冲突。
3. **拒绝冲突。** 拒绝加载第二个服务端，并通知用户。对安全敏感的宿主最为稳妥。

Claude Desktop 采用按服务端加前缀。Cursor 采用拒绝冲突并给出明确的错误。VS Code MCP 同样采用按服务端加前缀。

### 路由

合并完成后，一张分发表（dispatch table）把 `tool_name -> session` 映射起来。模型按名称发出调用；客户端找到对应的会话，向该服务端的 stdin 写入一条 `tools/call` 消息，然后等待响应。

### 采样回调

如果服务端在 `initialize` 时声明了 `sampling` 能力，它就可能发送 `sampling/createMessage`，请求客户端运行其 LLM。此时客户端必须：

1. 在该采样解析完成之前，阻塞向该服务端发出的后续请求；如果其实现支持并发，则可以流水线化处理。
2. 调用其 LLM 提供方。
3. 把响应回传给服务端。

第 11 课会端到端地讲解采样。本课为了完整性，仅给出其桩实现（stub）。

### 通知处理

`notifications/tools/list_changed` 意味着要重新调用 `tools/list`。`notifications/resources/updated` 意味着如果某资源正在使用中，就重新读取它。通知绝不能产生响应——不要试图对它们进行 ack（确认应答）。

一个常见的客户端 bug：在 `tools/call` 上阻塞读取循环，而此时一条通知正滞留在流中。应使用一个后台读取线程，把每条消息推入一个队列；主线程从队列中取出并分发。

### 重连

传输可能失败：服务端崩溃、操作系统杀掉了进程、stdio 管道断裂。客户端在 stdout 上检测到 EOF，便把该会话视为已死。可选方案：

- 静默重启服务端并重新握手。对纯只读服务端可行。
- 把失败暴露给用户。对带有用户可见会话的有状态服务端可行。

阶段 13 · 09 会讲解 Streamable HTTP 的重连语义；stdio 则更简单。

### 保活与会话 id

Streamable HTTP 使用 `Mcp-Session-Id` 头。stdio 没有会话 id——进程身份本身就是会话。保活 ping 是可选的；stdio 管道不会因为空闲而断裂。

## 动手用它

`code/main.py` 把三个模拟的 MCP 服务端作为子进程派生出来，分别与之握手，合并它们的工具列表，并把工具调用路由到正确的那一个。这些「服务端」其实是另外运行着玩具应答器的 Python 进程（没有真实的 LLM）。运行它，你会看到：

- 三次初始化，每次各自带有独立的能力集合。
- 三个 `tools/list` 结果合并进一个 7 个工具的命名空间。
- 一次基于工具名称的路由决策。
- 一次通过命名空间前缀避免的冲突。

需要关注的地方：

- `Session` 数据类（dataclass）干净地保存每服务端的状态。
- 后台读取线程把 stdout 上的每一行取出，且不阻塞主线程。
- 分发表就是一个简单的 `dict[str, Session]`。
- 冲突处理是显式的：当两个服务端声明了相同的名称时，后一个会被加上前缀重命名。

## 交付它

本课产出 `outputs/skill-mcp-client-harness.md`。给定一份声明式的 MCP 服务端列表（名称、命令、参数），该技能（skill）会产出一个测试框架（harness），它派生这些服务端、合并工具列表，并交付一个带冲突消解的路由函数。

## 练习

1. 运行 `code/main.py` 并观察服务端派生日志。用 SIGTERM 杀掉其中一个模拟服务端进程，观察客户端如何检测到 EOF 并把该会话标记为已死。

2. 实现命名空间前缀。当两个服务端都暴露 `search` 时，把第二个重命名为 `<server>/search`。更新分发表，并验证工具调用能正确路由。

3. 为服务端重启加入一个连接池式的退避（backoff）：在连续失败时采用指数退避，上限封顶为 30 秒，并在三次失败后向用户发出一条通知。

4. 勾勒一个支持 100 个并发 MCP 服务端的客户端。什么数据结构会取代那个简单的分发字典？（提示：用前缀树（trie）做前缀命名空间，再加上一个「每服务端工具数」的度量指标。）

5. 把该客户端移植到官方 MCP Python SDK 上。该 SDK 封装了 `stdio_client` 和 `ClientSession`。代码应当从约 200 行缩减到约 40 行，同时保留多服务端路由能力。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| MCP 客户端（MCP client） | 「智能体宿主」 | 派生服务端并编排工具调用的进程 |
| 会话（Session） | 「每服务端状态」 | 能力、工具列表，以及待处理请求的记账 |
| 合并命名空间（Merged namespace） | 「一份工具列表」 | 跨所有活跃服务端的扁平工具名集合 |
| 命名空间冲突（Namespace collision） | 「两个服务端同名工具」 | 客户端必须对重复项加前缀、拒绝或先到先得 |
| 路由（Routing） | 「谁来接这次调用？」 | 从工具名分发到拥有它的服务端 |
| 后台读取器（Background reader） | 「非阻塞 stdout」 | 把服务端 stdout 抽空进队列的线程或任务 |
| 采样回调（Sampling callback） | 「LLM 即服务」 | 客户端对服务端发来的 `sampling/createMessage` 的处理器 |
| `notifications/*_changed` | 「原语发生了变更」 | 提示客户端必须重新发现或重新读取的信号 |
| 重连策略（Reconnection policy） | 「服务端挂了怎么办」 | 传输失败时的重启语义 |
| Stdio 会话（Stdio session） | 「进程 = 会话」 | 没有会话 id；子进程的生命周期就是会话 |

## 延伸阅读

- [Model Context Protocol — 客户端规范](https://modelcontextprotocol.io/specification/2025-11-25/client) —— 权威的客户端行为定义
- [MCP — 客户端快速上手指南](https://modelcontextprotocol.io/quickstart/client) —— 使用 Python SDK 的 hello-world 客户端教程
- [MCP Python SDK — 客户端模块](https://github.com/modelcontextprotocol/python-sdk) —— `ClientSession` 与 `stdio_client` 的参考实现
- [MCP TypeScript SDK — Client](https://github.com/modelcontextprotocol/typescript-sdk) —— TS 对应实现
- [VS Code — 扩展中的 MCP](https://code.visualstudio.com/api/extension-guides/ai/mcp) —— VS Code 如何在单个编辑器宿主中多路复用多个 MCP 服务端
