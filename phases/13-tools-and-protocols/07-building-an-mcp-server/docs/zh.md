# 构建一个 MCP 服务器 —— Python + TypeScript SDK

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 大多数 MCP 教程只演示 stdio 上的 hello-world。一个真正的服务器要同时暴露 tools、resources 和 prompts，要处理能力协商（capability negotiation），要发出结构化的错误，并且在不同 SDK 之间表现一致。本课从头到尾构建一个 notes 服务器：标准库的 stdio 传输、JSON-RPC 派发、三种服务器原语（primitive），以及一种纯函数风格——当你升级时，这种代码可以直接搬进 Python SDK 的 FastMCP 或 TypeScript SDK。

**Type:** Build
**Languages:** Python (stdlib, stdio MCP server)
**Prerequisites:** Phase 13 · 06 (MCP fundamentals)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 实现 `initialize`、`tools/list`、`tools/call`、`resources/list`、`resources/read`、`prompts/list` 和 `prompts/get` 这些方法。
- 写一个派发循环：从 stdin 读取 JSON-RPC 消息，把响应写到 stdout。
- 按照 JSON-RPC 2.0 规范以及 MCP 额外定义的错误码，发出结构化的错误响应。
- 把基于标准库的实现升级到 FastMCP（Python SDK）或 TypeScript SDK，且无需重写 tool 逻辑。

## 问题（The Problem）

在你能用上远程传输（Phase 13 · 09）或加上鉴权层（Phase 13 · 16）之前，你需要先有一个干净的本地服务器。本地意味着 stdio：服务器由客户端作为子进程拉起，消息以换行分隔的方式在 stdin/stdout 之间流动。

2025-11-25 版规范规定：stdio 消息编码为 JSON 对象，并以显式的 `\n` 作为分隔符。这里没有 SSE；SSE 是旧的远程模式，将在 2026 年中被移除（Atlassian 的 Rovo MCP server 在 2026 年 6 月 30 日废弃；Keboola 在 2026 年 4 月 1 日废弃）。对 stdio 来说，每行一个 JSON 对象，就是全部的线上格式。

notes 服务器是一个不错的形态，因为它能把三种服务器原语都用上。Tools 负责变更（`notes_create`）。Resources 暴露数据（`notes://{id}`）。Prompts 提供模板（`review_note`）。这一课的形态可以推广到任何领域。

## 概念（The Concept）

### 派发循环（Dispatch loop）

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

- 不要往 stdout 打印任何不是 JSON-RPC 信封的内容。调试日志走 stderr。
- 每个请求必须由一个携带相同 `id` 的响应来匹配。
- 通知（notification）不允许有响应。

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

只声明你支持的能力。客户端会基于这份能力集来决定开放哪些功能。

### 实现 `tools/list` 和 `tools/call`

`tools/list` 返回 `{tools: [...]}`，每一项含 `name`、`description`、`inputSchema`。`tools/call` 接收 `{name, arguments}`，返回 `{content: [blocks], isError: bool}`。

Content block 是有类型的。最常见的几种：

```json
{"type": "text", "text": "Found 2 notes"}
{"type": "resource", "resource": {"uri": "notes://14", "text": "..."}}
{"type": "image", "data": "<base64>", "mimeType": "image/png"}
```

Tool 的错误分两种形态。协议级错误（未知方法、参数错误）属于 JSON-RPC 错误。Tool 级错误（调用合法但工具执行失败）则以 `{content: [...], isError: true}` 的方式返回。这样模型能在自己的上下文里看到这次失败。

### 实现 resources

Resources 在设计上是只读的。`resources/list` 返回清单；`resources/read` 返回内容。URI 可以是 `file://...`、`http://...`，或者像 `notes://` 这样的自定义 scheme。

把数据作为 resource 而不是 tool 暴露时：

- 模型并不会去「调用」它；客户端可以在用户请求时把它注入到 context。
- 订阅机制让服务器在 resource 变化时主动推送更新（Phase 13 · 10）。
- Phase 13 · 14 用 `ui://` 把它扩展为交互式 resource。

### 实现 prompts

Prompts 是带具名参数的模板。Host 把它们以 slash 命令的形式呈现出来。一个 `review_note` prompt 可能接收 `note_id` 参数，产出一段多消息的 prompt 模板，由客户端喂给它的模型。

### Stdio 传输的小细节

- 换行分隔的 JSON。没有按长度前缀的 framing。
- 不要做缓冲。每次写完都要 `sys.stdout.flush()`。
- 生命周期由客户端控制。stdin 关闭（EOF）时干净地退出。
- 不要静默处理 SIGPIPE；记日志然后退出。

### 注解（Annotations）

每个 tool 都可以带上 `annotations` 来描述它的安全属性：

- `readOnlyHint: true` —— 纯读，可安全重试。
- `destructiveHint: true` —— 不可逆的副作用；客户端应当二次确认。
- `idempotentHint: true` —— 相同输入产生相同输出（幂等）。
- `openWorldHint: true` —— 与外部系统交互。

客户端利用这些来决定 UX（确认弹窗、状态指示器）和路由（Phase 13 · 17）。

### 升级路径（Graduation path）

`code/main.py` 里基于标准库的服务器约 180 行。FastMCP（Python）能把同样的逻辑塌缩成装饰器风格：

```python
from fastmcp import FastMCP
app = FastMCP("notes")

@app.tool()
def notes_search(query: str, limit: int = 10) -> list[dict]:
    ...
```

TypeScript SDK 也是相似的形态。当你准备好时，升级路径是即插即用的；概念（capability、派发、content block）完全一致。

## 用起来（Use It）

`code/main.py` 是一个完整的、跑在 stdio 上、仅用标准库实现的 notes MCP 服务器。它处理 `initialize`、`tools/list`、`tools/call`（覆盖三个 tool：`notes_list`、`notes_search`、`notes_create`）、对每个 note 的 `resources/list` 和 `resources/read`，以及一个 `review_note` prompt。你可以通过管道喂 JSON-RPC 消息来驱动它：

```
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | python main.py
```

可以重点看几处：

- 派发器是一个以方法名为键的 `dict[str, Callable]`。
- 每个 tool 执行器返回的是一个 content block 列表，而不是裸字符串。
- 当执行器抛异常时，`isError: true` 会被设上。

## 上线部署（Ship It）

本课产出 `outputs/skill-mcp-server-scaffolder.md`。给定一个领域（notes、tickets、files、database），这个 skill 会脚手架式地搭出一个 MCP 服务器，给出合理的 tools / resources / prompts 拆分，以及 SDK 升级路径。

## 练习（Exercises）

1. 跑 `code/main.py`，用手写的 JSON-RPC 消息驱动它。先调 `notes_create`，再用 `resources/read` 把新建的 note 取出来。

2. 加一个 `notes_delete` tool，带上 `annotations: {destructiveHint: true}`。验证客户端会弹出一个确认对话框（这需要一个真实的 host；Claude Desktop 可以）。

3. 实现 `resources/subscribe`，让服务器在 note 被修改时推送 `notifications/resources/updated`。再加上一个 keepalive 任务。

4. 把这个服务器移植到 FastMCP。Python 文件应该会缩到 80 行以内。线上行为必须完全一致；用同一套 JSON-RPC 测试夹具去验证。

5. 读规范里的 `server/tools` 章节，找出 tool 定义中本课服务器没有实现的某个字段。（提示：有好几个；挑一个加上去。）

## 关键术语（Key Terms）

| Term | 大家通常怎么说 | 实际是什么 |
|------|----------------|------------------------|
| MCP server | "暴露 tool 的那个东西" | 在 stdio 或 HTTP 之上讲 MCP JSON-RPC 的进程 |
| stdio transport | "子进程模型" | 服务器由客户端拉起；通过 stdin/stdout 通信 |
| Dispatcher | "方法路由器" | JSON-RPC 方法名到处理函数的映射 |
| Content block | "Tool 结果片段" | tool 响应的 `content` 数组中的一个有类型元素 |
| `isError` | "Tool 级失败" | 标记 tool 失败；和 JSON-RPC 错误区分开 |
| Annotations | "安全提示" | readOnly / destructive / idempotent / openWorld 标志 |
| FastMCP | "Python SDK" | 在 MCP 协议之上、基于装饰器的高层框架 |
| Resource URI | "可寻址数据" | `file://`、`db://`、或自定义 scheme，用来标识一个 resource |
| Prompt template | "Slash 命令简介" | 服务端提供的、带参数槽位、供 host UI 使用的模板 |
| Capability declaration | "功能开关" | 在 `initialize` 中按原语逐个声明的标志位 |

## 延伸阅读（Further Reading）

- [Model Context Protocol — Python SDK](https://github.com/modelcontextprotocol/python-sdk) —— 参考用 Python 实现
- [Model Context Protocol — TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) —— 平行的 TS 实现
- [FastMCP — server framework](https://gofastmcp.com/) —— 装饰器风格的 Python MCP 服务器 API
- [MCP — Quickstart server guide](https://modelcontextprotocol.io/quickstart/server) —— 用任一 SDK 走完整流程的教程
- [MCP — Server tools spec](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) —— tools/* 消息的完整参考
