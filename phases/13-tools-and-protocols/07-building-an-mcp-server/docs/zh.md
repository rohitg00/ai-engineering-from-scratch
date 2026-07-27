# 构建 MCP 服务端 —— Python + TypeScript SDK

> 大多数 MCP 教程只展示 stdio 的 hello-world。一个真正的服务端需要同时暴露 tools、resources 和 prompts，处理能力协商（capability negotiation），输出结构化错误，并且在不同 SDK 之间行为一致。本课程端到端地构建一个笔记服务端：stdlib stdio 传输、JSON-RPC 调度、三大服务端原语，以及一种纯函数风格——当你准备升级时，可以直接放入 Python SDK 的 FastMCP 或 TypeScript SDK。

**类型：** 构建  
**语言：** Python（stdlib，stdio MCP 服务端）  
**前置要求：** 阶段 13 · 06（MCP 基础）  
**时长：** ~75 分钟

## 学习目标

- 实现 `initialize`、`tools/list`、`tools/call`、`resources/list`、`resources/read`、`prompts/list` 和 `prompts/get` 方法。
- 编写一个调度循环，从 stdin 读取 JSON-RPC 消息并将响应写入 stdout。
- 按照 JSON-RPC 2.0 规范及 MCP 额外错误码输出结构化错误响应。
- 将 stdlib 实现升级到 FastMCP（Python SDK）或 TypeScript SDK，且无需重写工具逻辑。

## 问题

在你能使用远程传输（阶段 13 · 09）或认证层（阶段 13 · 16）之前，你需要一个干净的本地服务端。本地意味着 stdio：服务端作为子进程由客户端启动，消息通过 stdin/stdout 以换行符分隔的方式流动。

2025-11-25 规范规定 stdio 消息编码为 JSON 对象，并使用明确的 `\n` 分隔符。这里没有 SSE；SSE 是旧的远程模式，将在 2026 年中移除（Atlassian 的 Rovo MCP 服务端于 2026 年 6 月 30 日弃用；Keboola 于 2026 年 4 月 1 日弃用）。对于 stdio，每行一个 JSON 对象就是完整的线缆格式。

笔记服务端是一个很好的示例，因为它能练习所有三种服务端原语。Tools 执行变更（`notes_create`）。Resources 暴露数据（`notes://{id}`）。Prompts 提供模板（`review_note`）。本课程的框架可以推广到任何领域。

## 概念

### 调度循环

```
loop:
  line = stdin.readline()
  msg = json.loads(line)
  if has id:
    handle request -> write response
  else:
    handle notification -> no response
```

三条规则：

- 不要向 stdout 打印任何非 JSON-RPC 信封的内容。调试日志输出到 stderr。
- 每个请求必须匹配一个带有相同 `id` 的响应。
- 通知不得被响应。

### 实现 `initialize`

```python
def initialize(params):
    return {
        "protocolVersion": "2025-11-25",
        "capabilities": {
            "tools": {"listChanged": True},
            "resources": {"listChanged": True, "subscribe": False},
            "prompts": {"listChanged": False},
        },
        "serverInfo": {"name": "notes", "version": "1.0.0"},
    }
```

只声明你支持的能力。客户端依赖能力集来开启或关闭功能。

### 实现 `tools/list` 和 `tools/call`

`tools/list` 返回 `{tools: [...]}`，每个条目包含 `name`、`description` 和 `inputSchema`。`tools/call` 接收 `{name, arguments}` 并返回 `{content: [blocks], isError: bool}`。

内容块是类型化的。最常见的有：

```json
{"type": "text", "text": "Found 2 notes"}
{"type": "resource", "resource": {"uri": "notes://14", "text": "..."}}
{"type": "image", "data": "<base64>", "mimeType": "image/png"}
```

工具错误有两种形式。协议级错误（未知方法、错误参数）是 JSON-RPC 错误。工具级错误（调用有效但工具执行失败）则返回 `{content: [...], isError: true}`。这样模型就能在其上下文中看到失败信息。

### 实现 resources

Resources 在设计上是只读的。`resources/list` 返回清单；`resources/read` 返回内容。URI 可以是 `file://...`、`http://...` 或自定义协议如 `notes://`。

当你将数据作为 resource 而非 tool 暴露时：

- 模型不会"调用"它；客户端可以在用户请求时将其注入上下文。
- 订阅允许服务端在资源变化时推送更新（阶段 13 · 10）。
- 阶段 13 · 14 通过 `ui://` 将其扩展到交互式资源。

### 实现 prompts

Prompts 是带有命名参数的模板。宿主将它们展示为斜杠命令。一个 `review_note` prompt 可能接收一个 `note_id` 参数，并生成一个多消息的提示模板，由客户端馈送给其模型。

### Stdio 传输细节

- 换行符分隔的 JSON。无长度前缀的帧结构。
- 不要缓冲。每次写入后执行 `sys.stdout.flush()`。
- 客户端控制生命周期。当 stdin 关闭（EOF）时，干净退出。
- 不要静默处理 SIGPIPE；记录日志并退出。

### 注解

每个工具可以携带描述安全属性的 `annotations`：

- `readOnlyHint: true` —— 纯读取，可安全重试。
- `destructiveHint: true` —— 不可逆的副作用；客户端应确认。
- `idempotentHint: true` —— 相同输入产生相同输出。
- `openWorldHint: true` —— 与外部系统交互。

客户端使用这些注解来决定用户体验（确认对话框、状态指示器）和路由（阶段 13 · 17）。

### 升级路径

`code/main.py` 中的 stdlib 服务端大约 180 行。FastMCP（Python）将同样的逻辑简化为装饰器风格：

```python
from fastmcp import FastMCP
app = FastMCP("notes")

@app.tool()
def notes_search(query: str, limit: int = 10) -> list[dict]:
    ...
```

TypeScript SDK 也有类似的结构。升级路径是即插即用的——当你准备好时即可使用；概念（capabilities、dispatch、content blocks）完全相同。

## 使用

`code/main.py` 是一个完整的基于 stdio 的笔记 MCP 服务端，仅使用 stdlib。它处理 `initialize`、`tools/list`、`tools/call`（三个工具：`notes_list`、`notes_search`、`notes_create`）、`resources/list` 和 `resources/read`（为每条笔记提供服务）以及一个 `review_note` prompt。你可以通过管道传入 JSON-RPC 消息来驱动它：

```
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | python main.py
```

需要关注的地方：

- 调度器是一个以方法名为键的 `dict[str, Callable]`。
- 每个工具执行器返回一个内容块列表，而非裸字符串。
- 当执行器抛出异常时，设置 `isError: true`。

## 输出

本课程产出 `outputs/skill-mcp-server-scaffolder.md`。给定一个领域（笔记、工单、文件、数据库），该技能可以搭建一个具有正确 tools/resources/prompts 划分及 SDK 升级路径的 MCP 服务端。

## 练习

1. 运行 `code/main.py`，用手工构建的 JSON-RPC 消息驱动它。先执行 `notes_create`，然后通过 `resources/read` 检索新创建的笔记。

2. 添加一个带有 `annotations: {destructiveHint: true}` 的 `notes_delete` 工具。验证客户端会显示确认对话框（这需要一个真实的宿主；Claude Desktop 可以）。

3. 实现 `resources/subscribe`，使服务端在笔记被修改时推送 `notifications/resources/updated`。添加一个保活任务。

4. 将服务端移植到 FastMCP。Python 文件应缩减到 80 行以内。线缆行为必须完全一致；使用相同的 JSON-RPC 测试工具验证。

5. 阅读规范中的 `server/tools` 章节，找出本课程服务端未实现的一个工具定义字段。（提示：有多个；选一个并添加它。）

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-----------|---------|
| MCP server | "那个暴露工具的东西" | 通过 stdio 或 HTTP 使用 MCP JSON-RPC 通信的进程 |
| stdio transport | "子进程模型" | 服务端由客户端启动，通过 stdin/stdout 通信 |
| Dispatcher | "方法路由器" | JSON-RPC 方法名到处理函数的映射 |
| Content block | "工具结果块" | 工具响应中 `content` 数组里的类型化元素 |
| `isError` | "工具级失败" | 标识工具执行失败；区别于 JSON-RPC 错误 |
| Annotations | "安全提示" | readOnly / destructive / idempotent / openWorld 标志 |
| FastMCP | "Python SDK" | 基于 MCP 协议的装饰器式高级框架 |
| Resource URI | "可寻址的数据" | `file://`、`db://` 或自定义协议标识的资源 |
| Prompt template | "斜杠命令简介" | 服务端提供的带参数槽的模板，供宿主 UI 使用 |
| Capability declaration | "功能开关" | 在 `initialize` 中声明的每个原语的能力标志 |

## 延伸阅读

- [Model Context Protocol — Python SDK](https://github.com/modelcontextprotocol/python-sdk) —— 参考 Python 实现
- [Model Context Protocol — TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) —— 并行的 TypeScript 实现
- [FastMCP — server framework](https://gofastmcp.com/) —— MCP 服务端的装饰器式 Python API
- [MCP — Quickstart server guide](https://modelcontextprotocol.io/quickstart/server) —— 使用任意 SDK 的端到端教程
- [MCP — Server tools spec](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) —— tools/* 消息的完整参考
