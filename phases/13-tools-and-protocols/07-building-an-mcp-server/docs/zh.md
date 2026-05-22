# 构建 MCP 服务器 —— Python + TypeScript SDK

> 大多数 MCP 教程只展示 stdio "Hello World"。一个真正的服务器需要同时暴露工具（tools）、资源（resources）和提示词（prompts），处理能力协商（capability negotiation），发出结构化错误，并且在不同 SDK 间行为一致。本课程将端到端构建一个笔记服务器：使用标准库的 stdio 传输层、JSON-RPC 分发、三种服务器原语，以及一套纯函数风格代码，当你进阶时，可以轻松地将其迁移到 Python SDK 的 FastMCP 或 TypeScript SDK。

**类型：** 构建  
**语言：** Python（标准库，stdio MCP 服务器）  
**前置条件：** 阶段 13 · 06（MCP 基础）  
**时间：** 约 75 分钟

## 学习目标

- 实现 `initialize`、`tools/list`、`tools/call`、`resources/list`、`resources/read`、`prompts/list` 和 `prompts/get` 方法。
- 编写一个分发循环，从 stdin 读取 JSON-RPC 消息，并向 stdout 写入响应。
- 按照 JSON-RPC 2.0 规范以及 MCP 的附加错误码，发出结构化错误响应。
- 在不重写工具逻辑的前提下，将标准库实现迁移到 FastMCP（Python SDK）或 TypeScript SDK。

## 问题

在你可以使用远程传输层（阶段 13 · 09）或认证层（阶段 13 · 16）之前，你需要一个干净的本地服务器。本地意味着 stdio：服务器由客户端作为子进程启动，消息通过 stdin/stdout 以换行符分隔的方式流动。

2025-11-25 规范规定，stdio 消息被编码为 JSON 对象，并使用显式的 `\n` 分隔符。这里没有 SSE；SSE 是旧的远程模式，将于 2026 年中旬被移除（Atlassian 的 Rovo MCP 服务器于 2026 年 6 月 30 日弃用了它；Keboola 于 2026 年 4 月 1 日弃用了它）。对于 stdio，每行一个 JSON 对象就是完整的 wire 格式。

笔记服务器是个很好的示例，因为它能锻炼所有三种服务器原语。工具（Tools）执行修改操作（`notes_create`）。资源（Resources）暴露数据（`notes://{id}`）。提示词（Prompts）提供模板（`review_note`）。本课程的结构可推广到任何领域。

## 概念

### 分发循环

```
循环:
  line = stdin.readline()
  msg = json.loads(line)
  如果包含 id:
    处理请求 -> 写入响应
  否则:
    处理通知 -> 不响应
```

三条规则：

- 不要向 stdout 输出任何非 JSON-RPC 信封的内容。调试日志发送到 stderr。
- 每个请求必须对应一个响应，且携带相同的 `id`。
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

只声明你支持的功能。客户端依赖能力集来门控特性。

### 实现 `tools/list` 和 `tools/call`

`tools/list` 返回 `{tools: [...]}`，每个条目包含 `name`、`description`、`inputSchema`。`tools/call` 接收 `{name, arguments}`，返回 `{content: [blocks], isError: bool}`。

内容块（Content blocks）是类型化的。最常见的有：

```json
{"type": "text", "text": "Found 2 notes"}
{"type": "resource", "resource": {"uri": "notes://14", "text": "..."}}
{"type": "image", "data": "<base64>", "mimeType": "image/png"}
```

工具错误有两种形式。协议级别的错误（未知方法、参数错误）是 JSON-RPC 错误。工具级别的错误（调用合法但工具执行失败）以 `{content: [...], isError: true}` 的形式返回。这样模型就能在其上下文中看到失败信息。

### 实现资源

资源在设计上是只读的。`resources/list` 返回清单；`resources/read` 返回内容。URI 可以是 `file://...`、`http://...`，或自定义协议如 `notes://`。

当你以资源而不是工具的形式暴露数据时：

- 模型不会“调用”它；客户端可以在用户请求时将其注入到上下文中。
- 订阅（Subscriptions）允许服务器在资源发生变化时推送更新（阶段 13 · 10）。
- 阶段 13 · 14 通过 `ui://` 扩展了交互式资源。

### 实现提示词

提示词是带有命名参数的模板。宿主将它们暴露为斜杠命令。一个 `review_note` 提示词可能接受一个 `note_id` 参数，并生成一个多消息提示词模板，客户端将其提供给模型。

### stdio 传输层注意事项

- 换行符分隔的 JSON。没有长度前缀的帧格式。
- 不要缓冲。每次写入后调用 `sys.stdout.flush()`。
- 客户端控制生命周期。当 stdin 关闭（EOF）时，干净地退出。
- 不要静默处理 SIGPIPE；记录日志并退出。

### 注解

每个工具可以携带 `annotations` 来描述安全性：

- `readOnlyHint: true` — 纯读取，安全可重试。
- `destructiveHint: true` — 不可逆的副作用；客户端应确认。
- `idempotentHint: true` — 相同输入产生相同输出。
- `openWorldHint: true` — 与外部系统交互。

客户端使用这些注解来决定用户体验（确认对话框、状态指示器）和路由（阶段 13 · 17）。

### 进阶路径

`code/main.py` 中的标准库服务器大约 180 行。FastMCP（Python）将同样的逻辑精简为装饰器风格：

```python
from fastmcp import FastMCP
app = FastMCP("notes")

@app.tool()
def notes_search(query: str, limit: int = 10) -> list[dict]:
    ...
```

TypeScript SDK 有等同的结构。进阶路径是即插即用的：当你准备好时，概念（能力、分发、内容块）是相同的。

## 使用它

`code/main.py` 是一个完整的笔记 MCP 服务器，基于 stdio 和标准库。它处理了 `initialize`、三个工具的 `tools/list` 和 `tools/call`（`notes_list`、`notes_search`、`notes_create`）、每个笔记的 `resources/list` 和 `resources/read`，以及一个 `review_note` 提示词。你可以通过管道传入 JSON-RPC 消息来驱动它：

```
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | python main.py
```

关注点：

- 分发器是一个以方法名为键的 `dict[str, Callable]`。
- 每个工具执行器返回一个内容块列表，而不是一个裸字符串。
- 当执行器抛出异常时，设置 `isError: true`。

## 交付它

本课程产出 `outputs/skill-mcp-server-scaffolder.md`。给定一个领域（笔记、工单、文件、数据库），这个技能会搭建一个具有合理工具/资源/提示词划分以及 SDK 进阶路径的 MCP 服务器。

## 练习

1. 运行 `code/main.py`，使用手工构建的 JSON-RPC 消息来驱动它。执行 `notes_create`，然后使用 `resources/read` 检索新笔记。

2. 添加一个带有 `annotations: {destructiveHint: true}` 的 `notes_delete` 工具。验证客户端会显示确认对话框（这需要一个真实的宿主；Claude Desktop 可以）。

3. 实现 `resources/subscribe`，以便每当笔记被修改时，服务器推送 `notifications/resources/updated`。添加一个保活任务。

4. 将服务器移植到 FastMCP。Python 文件应缩减到 80 行以内。线缆上的行为必须相同；用同一个 JSON-RPC 测试工具验证。

5. 阅读规范中 `server/tools` 部分，找出本课程服务器中未实现的一个工具定义字段。（提示：有多个；选择一个并添加它。）

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-----------|---------|
| MCP 服务器 | "暴露工具的那个东西" | 通过 stdio 或 HTTP 使用 MCP JSON-RPC 协议的进程 |
| stdio 传输层 | "子进程模型" | 服务器由客户端启动；通过 stdin/stdout 通信 |
| 分发器 | "方法路由器" | 将 JSON-RPC 方法名映射到处理函数的映射表 |
| 内容块 | "工具结果片段" | 工具响应 `content` 数组中的类型化元素 |
| `isError` | "工具级别失败" | 表示工具执行失败；与 JSON-RPC 错误区分 |
| 注解 | "安全提示" | readOnly / destructive / idempotent / openWorld 标志 |
| FastMCP | "Python SDK" | 基于 MCP 协议之上的装饰器风格高级框架 |
| 资源 URI | "可寻址数据" | `file://`、`db://` 或自定义协议标识一个资源 |
| 提示词模板 | "斜杠命令摘要" | 服务器提供的、带有参数槽的模板，供宿主 UI 使用 |
| 能力声明 | "功能开关" | 在 `initialize` 中声明的每个特性的标志 |

## 延伸阅读

- [Model Context Protocol — Python SDK](https://github.com/modelcontextprotocol/python-sdk) — 参考的 Python 实现
- [Model Context Protocol — TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — 并行的 TypeScript 实现
- [FastMCP — 服务器框架](https://gofastmcp.com/) — MCP 服务器的装饰器风格 Python API
- [MCP — 快速启动服务器指南](https://modelcontextprotocol.io/quickstart/server) — 使用任一 SDK 的端到端教程
- [MCP — 服务器工具规范](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) — tools/* 消息的完整参考