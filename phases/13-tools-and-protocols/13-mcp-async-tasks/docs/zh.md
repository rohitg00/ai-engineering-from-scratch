# 13 · 异步任务（SEP-1686）——立即调用、稍后取回，专为长耗时工作而生

> 真实的智能体（agent）工作动辄需要数分钟到数小时：CI 运行、深度研究综合、批量导出。同步的工具调用会断开连接、超时，或阻塞用户界面。SEP-1686 于 2025-11-25 合入，引入了一个任务（Tasks）原语：任何请求都可被增强为一个任务，其结果可以稍后取回，或通过状态通知以流式方式推送。漂移风险提示：在整个 2026 上半年，任务都属于实验性特性；SDK 层面的接口仍在围绕规范进行设计。

**类型：** 构建
**语言：** Python（标准库，异步任务状态机）
**前置：** 阶段 13 · 07（MCP 服务器）、阶段 13 · 09（传输层）
**时长：** 约 75 分钟

## 学习目标

- 判断何时应将一个工具从同步模式提升为任务增强模式（服务端工作超过 30 秒时）。
- 走通任务生命周期：`working` → `input_required` → `completed` / `failed` / `cancelled`。
- 持久化任务状态，使崩溃不会丢失正在执行中的工作。
- 正确地轮询 `tasks/status` 并取回 `tasks/result`。

## 问题所在

一个 `generate_report` 工具会运行一条耗时数分钟的提取流水线。在同步模型下有这些选项：

1. 把连接保持打开三分钟。远程传输会把它断开；客户端会超时；界面会冻结。
2. 立即返回一个占位符，要求客户端去轮询一个自定义端点。这破坏了 MCP 的统一性。
3. 发后不理（fire-and-forget），没有结果。

这些都不好。SEP-1686 增加了第四种选择：任务增强（task augmentation）。任何请求（通常是 `tools/call`）都可以被标记为一个任务。服务器立即返回一个任务 id。客户端轮询 `tasks/status`，并在完成时取回 `tasks/result`。服务端状态可在重启后存续。

## 核心概念

### 任务增强

设置 `params._meta.task.required: true`（或 `optional: true`，由服务器决定）即可让一个请求变成任务。服务器立即响应：

```json
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "_meta": {
      "task": {
        "id": "tsk_9f7b...",
        "state": "working",
        "ttl": 900000
      }
    }
  }
}
```

`ttl` 是服务器对保留状态时长的承诺；超过 ttl 后任务结果将被丢弃。

### 逐工具选择启用

工具注解（annotations）可以声明对任务的支持情况：

- `taskSupport: "forbidden"` —— 该工具始终同步运行。适用于快速工具。
- `taskSupport: "optional"` —— 客户端可以请求任务增强。
- `taskSupport: "required"` —— 客户端必须使用任务增强。

`generate_report` 这类工具应当是 `required`。`notes_search` 这类工具应当是 `forbidden`。

### 状态

```
working  -> input_required -> working  (通过 elicitation 循环)
working  -> completed
working  -> failed
working  -> cancelled
```

状态机是只追加（append-only）的：一旦进入 `completed`、`failed` 或 `cancelled`，任务即为终态。

### 方法

- `tasks/status {taskId}` —— 返回当前状态和一个进度提示。
- `tasks/result {taskId}` —— 阻塞等待，或在尚未完成时返回 404。
- `tasks/cancel {taskId}` —— 幂等；终态会被忽略。
- `tasks/list` —— 可选；枚举活跃以及近期已完成的任务。

### 流式状态变更

当服务器支持时，客户端可以订阅状态通知：

```
server -> notifications/tasks/updated {taskId, state, progress?}
```

采用流式而非轮询的客户端能获得更好的用户体验。轮询作为最小接口始终受支持。

### 持久化状态

规范要求声明支持任务的服务器持久化状态。崩溃不应在 ttl 内丢失已完成的结果。存储方案可以是 SQLite、Redis 或文件系统。第 13 课的实验环境（harness）使用文件系统。

### 取消语义

`tasks/cancel` 是幂等的。如果任务正在执行中，服务器会尝试停止它（参见执行器协作式取消，executor-cooperative cancellation）。如果任务已是终态，该请求为空操作（no-op）。

### 崩溃恢复

当服务器进程重启时：

1. 加载所有已持久化的任务状态。
2. 将任何因进程已死亡而处于 `working` 的任务标记为 `failed`，错误码为 `CRASH_RECOVERY`。
3. 在各自的 ttl 内保留 `completed` / `failed` / `cancelled` 状态。

### 异步任务结合采样

一个任务自身可以调用 `sampling/createMessage`。长耗时研究任务正是这样工作的：服务器的任务线程按需对客户端的模型进行采样（sampling），与此同时客户端界面将该任务显示为 `working`，并周期性更新进度。

### 为什么这是实验性的

SEP-1686 已于 2025-11-25 发布，但更宏观的路线图列出了三个尚未解决的问题：持久化订阅原语、子任务（subtasks，父子任务关系），以及结果 TTL 的标准化。预计该规范会在整个 2026 年持续演进。生产代码应只把任务视为在常见场景下稳定，并对子任务相关的未来 SDK 变更做好防护。

## 动手用起来

`code/main.py` 实现了一个持久化任务存储（基于文件系统）以及一个在后台线程中运行的 `generate_report` 工具。客户端调用该工具，立即拿到一个任务 id，在工作线程更新进度期间轮询 `tasks/status`，并在完成时取回 `tasks/result`。取消功能可用；崩溃恢复则通过杀死工作线程并重新加载状态来模拟。

需要关注的内容：

- 任务状态 JSON 被持久化到 `/tmp/lesson-13-tasks/<id>.json`。
- 工作线程更新 `progress` 字段；轮询可见它在推进。
- 客户端发起的取消会设置一个事件；工作线程检查到后提前退出。
- “崩溃”后的状态重新加载会把执行中的任务标记为 `failed`，错误码 `CRASH_RECOVERY`。

## 交付成果

本课产出 `outputs/skill-task-store-designer.md`。给定一个长耗时工具（研究、构建、导出），该技能会设计任务存储（状态结构、ttl、持久化），选择正确的 taskSupport 标志，并勾勒出进度通知方案。

## 练习

1. 运行 `code/main.py`。启动一个 `generate_report` 任务，轮询状态，然后取回结果。

2. 在运行途中加入一次 `tasks/cancel` 调用。验证工作线程会遵守它，且状态变为 `cancelled`。

3. 模拟崩溃恢复：杀死工作线程，重启加载器，并观察 `CRASH_RECOVERY` 失败模式。

4. 把存储扩展到 SQLite。持久化方面的收益是一样的，但查询能力得以打开（例如列出会话 X 的所有任务）。

5. 阅读 2026 年的 MCP 路线图文章。找出其中最有可能在未来一年内影响 SDK API 设计的那个与任务相关的待解决问题。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| 任务（Task） | “长耗时工具调用” | 通过 `_meta.task` 增强、用于异步执行的请求 |
| SEP-1686 | “任务规范” | 于 2025-11-25 引入任务的规范演进提案（Spec Evolution Proposal） |
| `_meta.task` | “任务信封” | 包含 id、state、ttl 的每请求元数据 |
| taskSupport | “工具标志” | 每个工具的 `forbidden` / `optional` / `required` |
| `tasks/status` | “轮询方法” | 取回当前状态和可选的进度提示 |
| `tasks/result` | “取回结果” | 返回已完成的载荷，或在尚未完成时返回 404 |
| `tasks/cancel` | “停下它” | 幂等的取消请求 |
| ttl | “保留预算” | 服务器承诺保留任务状态的毫秒数 |
| `notifications/tasks/updated` | “状态推送” | 服务器发起的状态变更事件 |
| 持久化存储（Durable store） | “崩溃安全状态” | 文件系统 / SQLite / Redis 持久化层 |

## 延伸阅读

- [MCP —— GitHub SEP-1686 issue](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1686) —— 该提案的源头及完整讨论
- [WorkOS —— 面向 AI 智能体工作流的 MCP 异步任务](https://workos.com/blog/mcp-async-tasks-ai-agent-workflows) —— 带原理阐释的设计走读
- [DeepWiki —— MCP 任务系统与异步操作](https://deepwiki.com/modelcontextprotocol/modelcontextprotocol/2.7-task-system-and-async-operations) —— 机制与状态机
- [FastMCP —— Tasks](https://gofastmcp.com/servers/tasks) —— SDK 层面的任务实现模式
- [MCP 博客 —— 2026 路线图](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) —— 待解决问题与 2026 优先事项，包括子任务
