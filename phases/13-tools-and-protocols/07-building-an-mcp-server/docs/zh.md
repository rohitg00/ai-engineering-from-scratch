# 07 · 构建一个 MCP 服务器 —— Python + TypeScript SDK

> 大多数 MCP 教程只演示基于 stdio 的「hello world」。而一个真正的服务器要同时暴露工具（tools）、资源（resources）和提示（prompts），处理能力协商（capability negotiation），返回结构化的错误，并且在不同 SDK 之间行为一致。本课会端到端地构建一个笔记服务器：基于标准库的 stdio 传输、JSON-RPC 分发、三种服务器原语，以及一种纯函数（pure-function）风格——当你准备升级时，这种风格可以无缝迁移到 Python SDK 的 FastMCP 或 TypeScript SDK。

**类型：** 构建
**语言：** Python（标准库，stdio MCP 服务器）
**前置：** 第 13 阶段 · 06（MCP 基础）
**时长：** 约 75 分钟

## 学习目标

- 实现 `initialize`、`tools/list`、`tools/call`、`resources/list`、`resources/read`、`prompts/list` 与 `prompts/get` 等方法。
- 编写一个分发循环（dispatch loop），从 stdin 读取 JSON-RPC 消息，并把响应写入 stdout。
- 按照 JSON-RPC 2.0 规范以及 MCP 额外定义的错误码，返回结构化的错误响应。
- 在不重写工具逻辑的前提下，把标准库实现升级到 FastMCP（Python SDK）或 TypeScript SDK。

## 问题所在

在你能使用远程传输（第 13 阶段 · 09）或鉴权层（第 13 阶段 · 16）之前，你需要一个干净的本地服务器。本地意味着 stdio：服务器由客户端作为子进程（child process）启动，消息通过 stdin/stdout 以换行符分隔的方式流动。

2025-11-25 版规范规定，stdio 消息编码为 JSON 对象，并以显式的 `\n` 分隔。这里没有 SSE；SSE 是旧的远程模式，将在 2026 年中期被移除（Atlassian 的 Rovo MCP 服务器于 2026 年 6 月 30 日弃用它；Keboola 则在 2026 年 4 月 1 日弃用）。对于 stdio，每行一个 JSON 对象就是全部的传输线格式（wire format）。

笔记服务器是个很好的范例，因为它能演练全部三种服务器原语。工具（tools）执行变更（`notes_create`）。资源（resources）暴露数据（`notes://{id}`）。提示（prompts）提供模板（`review_note`）。本课的整体形态可以推广到任意领域。

## 核心概念

### 分发循环

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

- 不要向 stdout 打印任何非 JSON-RPC 信封（envelope）的内容。调试日志要写到 stderr。
- 每个请求（request）都必须有一个携带相同 `id` 的响应（response）与之匹配。
- 通知（notification）绝不能被响应。

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

只声明你支持的能力。客户端依赖这套能力集（capability set）来开启或关闭功能。

### 实现 `tools/list` 与 `tools/call`

`tools/list` 返回 `{tools: [...]}`，其中每一项都带有 `name`、`description`、`inputSchema`。`tools/call` 接收 `{name, arguments}`，返回 `{content: [blocks], isError: bool}`。

内容块（content block）是带类型的。最常见的几种：

```json
{"type": "text", "text": "Found 2 notes"}
{"type": "resource", "resource": {"uri": "notes://14", "text": "..."}}
{"type": "image", "data": "<base64>", "mimeType": "image/png"}
```

工具错误有两种形态。协议级错误（未知方法、错误参数）属于 JSON-RPC 错误。工具级错误（调用合法但工具执行失败）则以 `{content: [...], isError: true}` 返回。这样可以让模型在它的上下文中看到这次失败。

### 实现资源

资源在设计上是只读的。`resources/list` 返回一份清单（manifest）；`resources/read` 返回具体内容。URI 可以是 `file://...`、`http://...`，也可以是像 `notes://` 这样的自定义 scheme。

当你把数据作为资源而非工具暴露时：

- 模型不会去「调用」它；客户端可以在用户请求时把它注入上下文。
- 订阅（subscription）让服务器在资源变化时主动推送更新（第 13 阶段 · 10）。
- 第 13 阶段 · 14 用 `ui://` 把这一机制扩展到交互式资源。

### 实现提示

提示是带命名参数的模板。宿主（host）会把它们呈现为斜杠命令（slash-command）。一个 `review_note` 提示可能接收一个 `note_id` 参数，并生成一份多消息的提示模板，由客户端喂给它的模型。

### stdio 传输的细节

- 以换行符分隔的 JSON。没有长度前缀（length-prefixed）的帧封装。
- 不要做缓冲。每次写入后都要 `sys.stdout.flush()`。
- 生命周期由客户端控制。当 stdin 关闭（EOF）时，干净地退出。
- 不要静默地处理 SIGPIPE；记录日志并退出。

### 注解

每个工具都可以携带 `annotations`，用来描述其安全属性：

- `readOnlyHint: true` —— 纯读取，重试是安全的。
- `destructiveHint: true` —— 有不可逆的副作用；客户端应当先确认。
- `idempotentHint: true` —— 相同输入产生相同输出。
- `openWorldHint: true` —— 与外部系统交互。

客户端利用这些注解来决定交互体验（确认对话框、状态指示器）以及路由（第 13 阶段 · 17）。

### 升级路径

`code/main.py` 中的标准库服务器大约 180 行。FastMCP（Python）把同样的逻辑收敛成装饰器（decorator）风格：

```python
from fastmcp import FastMCP
app = FastMCP("notes")

@app.tool()
def notes_search(query: str, limit: int = 10) -> list[dict]:
    ...
```

TypeScript SDK 有等价的形态。当你准备好时，升级路径是即插即用（drop-in）的；其中的概念（能力声明、分发、内容块）都是一致的。

## 动手用一用

`code/main.py` 是一个完整的、基于 stdio 的笔记 MCP 服务器，仅使用标准库。它处理 `initialize`、`tools/list`、针对三个工具（`notes_list`、`notes_search`、`notes_create`）的 `tools/call`、针对每条笔记的 `resources/list` 与 `resources/read`，以及一个 `review_note` 提示。你可以通过管道传入 JSON-RPC 消息来驱动它：

```
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | python main.py
```

重点关注：

- 分发器（dispatcher）是一个以方法名为键的 `dict[str, Callable]`。
- 每个工具执行器（executor）返回的是一个内容块列表，而不是一个裸字符串。
- 当执行器抛出异常时，会设置 `isError: true`。

## 交付成果

本课产出 `outputs/skill-mcp-server-scaffolder.md`。给定一个领域（笔记、工单、文件、数据库），该技能（skill）会脚手架式地搭建出一个 MCP 服务器，并给出合理的工具 / 资源 / 提示拆分方案与 SDK 升级路径。

## 练习

1. 运行 `code/main.py`，用手写的 JSON-RPC 消息来驱动它。先调用 `notes_create`，再用 `resources/read` 取回这条新笔记。

2. 添加一个带 `annotations: {destructiveHint: true}` 的 `notes_delete` 工具。验证客户端会弹出一个确认对话框（这需要一个真实的宿主；Claude Desktop 可用）。

3. 实现 `resources/subscribe`，让服务器在某条笔记被修改时推送 `notifications/resources/updated`。再加上一个保活（keepalive）任务。

4. 把服务器移植到 FastMCP。Python 文件应缩短到 80 行以内。传输线上的行为必须完全一致；用同一套 JSON-RPC 测试装置（test harness）来验证。

5. 阅读规范的 `server/tools` 章节，找出本课服务器尚未实现的某个工具定义字段。（提示：有好几个；挑一个并把它加进去。）

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| MCP 服务器 | 「暴露工具的那个东西」 | 通过 stdio 或 HTTP 说 MCP JSON-RPC 的进程 |
| stdio 传输 | 「子进程模型」 | 服务器由客户端启动；通过 stdin/stdout 通信 |
| 分发器（Dispatcher） | 「方法路由器」 | 从 JSON-RPC 方法名到处理函数的映射 |
| 内容块（Content block） | 「工具结果片段」 | 工具响应中 `content` 数组里带类型的元素 |
| `isError` | 「工具级失败」 | 标识工具执行失败；与 JSON-RPC 错误区分开 |
| 注解（Annotations） | 「安全提示」 | readOnly / destructive / idempotent / openWorld 标志 |
| FastMCP | 「Python SDK」 | 构建在 MCP 协议之上、基于装饰器的高层框架 |
| 资源 URI（Resource URI） | 「可寻址数据」 | `file://`、`db://` 或自定义 scheme，用于标识一个资源 |
| 提示模板（Prompt template） | 「斜杠命令简报」 | 服务器提供、带参数槽位、供宿主 UI 使用的模板 |
| 能力声明（Capability declaration） | 「功能开关」 | 在 `initialize` 中按原语逐项声明的标志 |

## 延伸阅读

- [Model Context Protocol — Python SDK](https://github.com/modelcontextprotocol/python-sdk) —— 参考性的 Python 实现
- [Model Context Protocol — TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) —— 对应的 TS 实现
- [FastMCP — 服务器框架](https://gofastmcp.com/) —— 面向 MCP 服务器的装饰器风格 Python API
- [MCP — 服务器快速上手指南](https://modelcontextprotocol.io/quickstart/server) —— 使用任一 SDK 的端到端教程
- [MCP — 服务器工具规范](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) —— tools/* 消息的完整参考
