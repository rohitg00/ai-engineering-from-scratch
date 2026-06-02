# 构建 MCP 客户端 —— 发现、调用与会话管理（Building an MCP Client — Discovery, Invocation, Session Management）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 大部分 MCP 内容都在讲服务端教程，对客户端则一笔带过。可真正硬核的编排逻辑都在客户端代码里：进程派生、capability 协商、跨多个 server 合并 tool 列表、sampling 回调、重连，以及命名空间冲突的解决。本课会构建一个多 server 客户端，把三个不同的 MCP server 提升进同一个扁平的 tool 命名空间，喂给模型。

**Type:** Build
**Languages:** Python (stdlib, multi-server MCP client)
**Prerequisites:** Phase 13 · 07 (building an MCP server)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 把 MCP server 作为子进程派生出来，完成 `initialize` 流程，并发送 `notifications/initialized`。
- 维护每个 server 的会话状态（capability、tool 列表、最近的通知 id）。
- 把多个 server 的 tool 列表合并到一个命名空间里，并处理冲突。
- 把一次 tool 调用路由到拥有它的 server，并把响应组装回来。

## 问题（The Problem）

一个真实的 agent 宿主（Claude Desktop、Cursor、Goose、Gemini CLI）会同时加载多个 MCP server。用户可能同时跑着一个 filesystem server、一个 Postgres server、一个 GitHub server。客户端的工作是：

1. 把每个 server 派生出来。
2. 各自独立完成握手。
3. 对每个 server 调用 `tools/list`，把结果摊平。
4. 当模型发出 `notes_search` 时，去合并后的命名空间里查，路由到对应 server。
5. 处理任意 server 的通知（`tools/list_changed`），不能被阻塞。
6. 在传输层失败时重连。

把这一整套手搓出来，正是「玩具」与「能用」之间的分水岭。官方 SDK 已经包好了这些，但脑子里那张图必须是你自己的。

## 概念（The Concept）

### 子进程派生（Child-process spawning）

用 `subprocess.Popen`，配上 `stdin=PIPE, stdout=PIPE, stderr=PIPE`。设 `bufsize=1`，开 text 模式，一行一行读。每个 server 一个进程；客户端为每个 server 持有一个 `Popen` 句柄。

### 每个 server 的会话状态（Per-server session state）

每个 server 一个 `Session` 对象，里面装着：

- `process` —— Popen 句柄。
- `capabilities` —— server 在 `initialize` 时声明的内容。
- `tools` —— 最近一次 `tools/list` 的结果。
- `pending` —— 请求 id 到 promise/future 的映射，等着对应响应。

请求天生异步；发到 server A 的 `tools/call` 不能因为 server B 正在调用就阻塞。要么用线程加队列，要么用 asyncio。

### 合并的命名空间（Merged namespace）

当客户端看到聚合后的 tool 列表时，名字会撞车。两个 server 都可能暴露 `search`。客户端有三个选项：

1. **按 server 名加前缀**。`notes/search`、`files/search`。清晰但难看。
2. **静默先到先得**。后注册的 server 的 `search` 覆盖先注册的。冒险；冲突被掩盖。
3. **冲突即拒绝**。拒绝加载第二个 server，并通知用户。对安全敏感的宿主最稳。

Claude Desktop 用按 server 加前缀。Cursor 用冲突即拒绝并给出明确错误。VS Code MCP 同样采用按 server 加前缀。

### 路由（Routing）

合并完成后，一张 dispatch 表把 `tool_name -> session` 关联起来。模型按名字发起调用；客户端找到对应 session，把一条 `tools/call` 消息写到那个 server 的 stdin，然后等响应。

### Sampling 回调（Sampling callback）

如果 server 在 `initialize` 时声明了 `sampling` capability，它就可能发 `sampling/createMessage`，让客户端去跑自己的 LLM。客户端必须：

1. 在这次 sample 解析完之前阻塞对该 server 的进一步请求；如果实现支持并发，则可以流水线化。
2. 调用自己的 LLM 提供方。
3. 把响应送回 server。

第 11 课会端到端讲 sampling。本课为完整性留了个桩。

### 通知处理（Notification handling）

`notifications/tools/list_changed` 意味着要重新调用 `tools/list`。`notifications/resources/updated` 意味着如果该资源在用就要重新读取。通知不能产生响应——别去 ack 它们。

一个常见的客户端 bug：在 `tools/call` 上阻塞了读循环，而流里又躺着一条通知。请用一个后台 reader 线程，把每条消息推进队列；主线程从队列出队、分发。

### 重连（Reconnection）

传输可能挂掉：server 崩了、OS 杀了进程、stdio 管道断了。客户端在 stdout 上检测到 EOF，就把会话当作死掉。选项：

- 静默重启 server 并重新握手。对纯只读 server 没问题。
- 把失败暴露给用户。对那些用户能看见的、有状态的 server 比较合适。

Phase 13 · 09 会讲 Streamable HTTP 的重连语义；stdio 这边更简单。

### Keepalive 与 session id（Keepalive and session id）

Streamable HTTP 用一个 `Mcp-Session-Id` 头。Stdio 没有 session id —— 进程的身份本身就是会话。Keepalive ping 是可选的；stdio 管道不会因为闲置而断。

## 用起来（Use It）

`code/main.py` 把三个模拟的 MCP server 作为子进程派生出来，分别握手，合并它们的 tool 列表，然后把 tool 调用路由到正确的 server。这些「server」实际上是另外的 Python 进程，跑着玩具响应器（没有真 LLM）。跑一下，可以看到：

- 三次 initialization，每个都有自己的一套 capability。
- 三个 `tools/list` 结果合并成一个含 7 个 tool 的命名空间。
- 基于 tool 名做的路由决策。
- 通过命名空间前缀避免的一次冲突。

看这些地方：

- `Session` dataclass 把每个 server 的状态干净地装起来。
- 后台 reader 线程从 stdout 上把每一行出队，不阻塞主线程。
- dispatch 表就是一个简单的 `dict[str, Session]`。
- 冲突处理是显式的：当两个 server 声明了同一个名字，后来的会被加前缀重命名。

## 上线部署（Ship It）

本课产出 `outputs/skill-mcp-client-harness.md`。给定一份声明式的 MCP server 清单（name、command、args），这个 skill 会生成一套 harness：派生进程、合并 tool 列表，并附带一个带冲突解决的路由函数。

## 练习（Exercises）

1. 跑 `code/main.py`，看 server 的派生日志。用 SIGTERM 干掉其中一个模拟 server 进程，观察客户端是怎么检测到 EOF 并把那个会话标记为死掉的。

2. 实现命名空间前缀。当两个 server 都暴露 `search` 时，把第二个重命名为 `<server>/search`。更新 dispatch 表，并验证 tool 调用路由正确。

3. 给 server 重启加上一种连接池风格的退避：连续失败做指数退避，封顶 30 秒，连续三次失败后给用户发一条通知。

4. 草拟一个支持 100 个并发 MCP server 的客户端。简单的 dispatch dict 该被什么数据结构替代？（提示：用 trie 做前缀命名空间，外加一个每个 server 的 tool 数指标。）

5. 把客户端移植到官方 MCP Python SDK。SDK 包了 `stdio_client` 和 `ClientSession`。代码应该从约 200 行缩到约 40 行，同时保留多 server 路由能力。

## 关键术语（Key Terms）

| Term | 大家怎么说 | 它实际是什么 |
|------|----------------|------------------------|
| MCP client | 「agent 宿主」 | 派生 server、编排 tool 调用的进程 |
| Session | 「每个 server 的状态」 | capability、tool 列表、待响应请求的账本 |
| Merged namespace | 「一份 tool 列表」 | 所有活跃 server 上 tool 名的扁平集合 |
| Namespace collision | 「两个 server 同名 tool」 | 客户端必须选加前缀、拒绝、或先到先得 |
| Routing | 「这个调用归谁？」 | 从 tool 名分发到拥有它的 server |
| Background reader | 「非阻塞 stdout」 | 把 server stdout 抽进队列的线程或任务 |
| Sampling callback | 「LLM 即服务」 | 客户端对 server 发来的 `sampling/createMessage` 的处理 |
| `notifications/*_changed` | 「原语变了」 | 客户端必须重新发现或重新读取的信号 |
| Reconnection policy | 「server 死了之后」 | 传输失败时的重启语义 |
| Stdio session | 「进程 = 会话」 | 没有 session id；子进程的生命周期就是会话 |

## 延伸阅读（Further Reading）

- [Model Context Protocol — Client spec](https://modelcontextprotocol.io/specification/2025-11-25/client) —— 客户端行为的权威定义
- [MCP — Quickstart client guide](https://modelcontextprotocol.io/quickstart/client) —— 用 Python SDK 写 hello-world 客户端的入门教程
- [MCP Python SDK — client module](https://github.com/modelcontextprotocol/python-sdk) —— 参考 `ClientSession` 和 `stdio_client`
- [MCP TypeScript SDK — Client](https://github.com/modelcontextprotocol/typescript-sdk) —— TS 端的对应实现
- [VS Code — MCP in extensions](https://code.visualstudio.com/api/extension-guides/ai/mcp) —— VS Code 怎么在一个编辑器宿主里多路复用多个 MCP server
