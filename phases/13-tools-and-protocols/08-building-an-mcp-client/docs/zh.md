# 构建MCP客户端 — 发现、调用和会话管理

> 大多数MCP内容都提供服务器教程，而对客户端部分则一笔带过。客户端代码才是复杂编排的核心所在：进程生成、能力协商、跨多个服务器的工具列表合并、采样回调、重连以及命名空间冲突解决。本课程将构建一个多服务器客户端，将三个不同的MCP服务器提升到一个扁平的工具命名空间中，供模型使用。

**类型：** 实践项目
**语言：** Python (标准库, 多服务器MCP客户端)
**先决条件：** 第13阶段 · 07 (构建MCP服务器)
**时间：** 约75分钟

## 学习目标

- 将MCP服务器作为子进程生成，完成`initialize`并发送`notifications/initialized`。
- 维护每个服务器的会话状态（能力、工具列表、最后看到的notification ID）。
- 将多个服务器的工具列表合并到一个命名空间中，并处理冲突。
- 将工具调用路由到拥有它的服务器，并重新组装响应。

## 问题

真实的代理主机（Claude Desktop、Cursor、Goose、Gemini CLI）同时加载多个MCP服务器。用户可能同时运行文件系统服务器、Postgres服务器和GitHub服务器。客户端的工作：

1. 生成每个服务器。
2. 独立地与每个服务器握手。
3. 对每个服务器调用`tools/list`并扁平化结果。
4. 当模型发出`notes_search`时，在合并的命名空间中查找并将其路由到正确的服务器。
5. 处理来自任何服务器的通知（`tools/list_changed`）而不阻塞。
6. 在传输失败时重新连接。

所有这些手动实现是将"玩具"级别与"可用"级别区分开来的关键。官方SDK封装了这些功能，但 mental model 必须由你自己掌握。

## 概念

### 子进程生成

使用`subprocess.Popen`并设置`stdin=PIPE, stdout=PIPE, stderr=PIPE`。设置`bufsize=1`并使用文本模式进行逐行读取。每个服务器是一个进程；客户端为每个服务器持有一个`Popen`句柄。

### 每个服务器的会话状态

每个服务器一个`Session`对象，包含：

- `process` — Popen句柄。
- `capabilities` — 服务器在`initialize`时声明的能力。
- `tools` — 最后的`tools/list`结果。
- `pending` — 请求ID到等待响应的promise/future的映射。

请求本质上是异步的；在服务器B进行调用时发送给服务器A的`tools/call`不能阻塞。可以使用带队列的线程或asyncio。

### 合并的命名空间

当客户端看到聚合的工具列表时，名称可能会冲突。两个服务器都可能暴露`search`功能。客户端有三个选项：

1. **按服务器名前缀。** `notes/search`、`files/search`。清晰但不够美观。
2. **静默先到先得。** 后面服务器的`search`会覆盖前面的。有风险；隐藏了冲突。
3. **冲突拒绝。** 拒绝加载第二个服务器；通知用户。对于安全敏感的主机最安全。

Claude Desktop使用按服务器名前缀。Cursor使用冲突拒绝并给出明确的错误。VS Code MCP也采用按服务器名前缀。

### 路由

合并后，分发表将`tool_name -> session`映射。模型按名称发出调用；客户端找到对应的会话并向该服务器的stdin写入`tools/call`消息，然后等待响应。

### 采样回调

如果服务器在`initialize`时声明了`sampling`能力，它可能会发送`sampling/createMessage`请求客户端运行其LLM。客户端必须：

1. 在样本解决之前阻止对该服务器的进一步请求，如果实现支持并发，则可以流水线处理。
2. 调用其LLM提供商。
3. 将响应发送回服务器。

第11课程涵盖了端到端的采样。本课程为完整性起见将其存根化。

### 通知处理

`notifications/tools/list_changed`意味着重新调用`tools/list`。`notifications/resources/updated`意味着如果资源正在使用则重新读取资源。通知不能产生响应 — 不要尝试确认它们。

一个常见的客户端错误：在通知位于流中时，在`tools/call`上阻塞读取循环。使用后台读取线程将每条消息推入队列；主线程出队并分发。

### 重连

传输可能会失败：服务器崩溃、操作系统终止进程、stdio管道损坏。客户端检测到stdout上的EOF并将会话视为死亡。选项：

- 静默重启服务器并重新握手。适用于纯只读服务器。
- 向用户显示故障。适用于具有用户可见会话的状态服务器。

第13阶段 · 09涵盖了可流式HTTP重连语义；stdio更简单。

### 保活和会话ID

可流式HTTP使用`Mcp-Session-Id`头。stdio没有会话ID — 进程身份就是会话。保活ping是可选的；stdio管道在空闲状态下不会断开。

## 使用它

`code/main.py`将三个模拟MCP服务器作为子进程生成，与每个服务器握手，合并它们的工具列表，并将工具调用路由到正确的服务器。"服务器"实际上是运行玩具响应器的其他Python进程（没有真正的LLM）。运行它以查看：

- 三次初始化，每个都有自己的能力集。
- 三个`tools/list`结果合并为一个包含7个工具的命名空间。
- 基于工具名的路由决策。
- 通过命名空间前缀防止的冲突。

查看内容：

- `Session`数据类干净地保存每个服务器的状态。
- 后台读取线程在不阻塞主线程的情况下出队stdout上的每一行。
- 分发表是一个简单的`dict[str, Session]`。
- 冲突处理是明确的：当两个服务器声明相同的名称时，后面的一个会被重命名并添加前缀。

## 发布它

本课程生成`outputs/skill-mcp-client-harness.md`。给定一个MCP服务器的声明性列表（名称、命令、参数），该技能生成一个框架，用于生成服务器、合并工具列表，并提供带有冲突解决的路由函数。

## 练习

1. 运行`code/main.py`并观察服务器生成日志。使用SIGTERM终止一个模拟服务器进程，观察客户端如何检测EOF并将该会话标记为死亡。

2. 实现命名空间前缀。当两个服务器暴露`search`时，将第二个重命名为`<server>/search`。更新分发表并验证工具调用是否正确路由。

3. 添加连接池式的服务器重启退避：连续失败时使用指数退避，上限为30秒，三次失败后向用户发出通知。

4. 设计一个支持100个并发MCP服务器的客户端。什么数据结构可以替换简单的分发表字典？（提示：用于前缀命名空间的trie，加上每个服务器的工具计数指标。）

5. 将客户端移植到官方MCP Python SDK。SDK封装了`stdio_client`和`ClientSession`。代码应该从约200行缩减到约40行，同时保持多服务器路由功能。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| MCP客户端 | "代理主机" | 生成服务器并编排工具调用的进程 |
| 会话 | "每服务器状态" | 能力、工具列表和待处理请求记录 |
| 合并的命名空间 | "一个工具列表" | 所有活动服务器上的工具名称的扁平集合 |
| 命名空间冲突 | "两个服务器相同工具" | 客户端必须添加前缀、拒绝或采用先到先得的方式处理重复项 |
| 路由 | "这个调用给谁" | 从工具名称到拥有它的服务器的分发 |
| 后台读取器 | "非阻塞stdout" | 将服务器stdout排入队列的线程或任务 |
| 采样回调 | "LLM即服务" | 客户端处理来自服务器的`sampling/createMessage` |
| `notifications/*_changed` | "原语被修改" | 客户端必须重新发现或重新读取的信号 |
| 重连策略 | "服务器死亡时" | 传输失败时的重启语义 |
| Stdio会话 | "进程=会话" | 无会话ID；子进程生命周期就是会话 |

## 延伸阅读

- [模型上下文协议 — 客户端规范](https://modelcontextprotocol.io/specification/2025-11-25/client) — 权威的客户端行为
- [MCP — 快速入门客户端指南](https://modelcontextprotocol.io/quickstart/client) — 使用Python SDK的hello-world客户端教程
- [MCP Python SDK — 客户端模块](https://github.com/modelcontextprotocol/python-sdk) — 参考`ClientSession`和`stdio_client`
- [MCP TypeScript SDK — 客户端](https://github.com/modelcontextprotocol/typescript-sdk) — TypeScript并行实现
- [VS Code — 扩展中的MCP](https://code.visualstudio.com/api/extension-guides/ai/mcp) — VS Code如何在单个编辑器主机中多路复用多个MCP服务器