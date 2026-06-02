# 异步任务（SEP-1686）——为长耗时工作做到「先调用，后取结果」

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 真实的 agent 工作动辄要几分钟到几小时：CI 跑完、深度研究综合、批量导出。同步的 tool call 会掉连接、超时，或者把 UI 卡死。SEP-1686 于 2025-11-25 合入，引入了 Tasks 原语：任何 request 都可以被「增广」成一个 task，结果可以稍后再取，或者通过状态通知流式接收。漂移风险提示：Tasks 在 2026 年上半年仍属实验阶段；SDK 表面还在围绕 spec 设计中。

**Type:** Build
**Languages:** Python（stdlib，异步任务状态机）
**Prerequisites:** Phase 13 · 07（MCP server）, Phase 13 · 09（transports）
**Time:** ~75 分钟

## 学习目标（Learning Objectives）

- 判断什么时候要把一个 tool 从同步升级为 task 增广（服务端工作量 >30 秒）。
- 走通 task 生命周期：`working` → `input_required` → `completed` / `failed` / `cancelled`。
- 持久化 task 状态，让进程崩溃也不会丢失飞行中的工作。
- 正确轮询 `tasks/status` 并 fetch `tasks/result`。

## 问题（Problem）

一个 `generate_report` tool 跑一条几分钟的抽取流水线（pipeline）。在同步模型下你能选的：

1. 把连接挂上三分钟。远程 transport 会断、客户端会超时、UI 会冻住。
2. 立即返回一个占位符；让客户端轮询一个自定义 endpoint。这就破坏了 MCP 的统一性。
3. Fire-and-forget；没结果。

哪个都不好。SEP-1686 加了第四种：task 增广。任何 request（通常是 `tools/call`）都可以被打上 task 标记。服务端立即返回一个 task id。客户端轮询 `tasks/status`，完成后再 fetch `tasks/result`。服务端状态可以扛住重启。

## 概念（Concept）

### Task 增广（Task augmentation）

把 `params._meta.task.required: true`（或 `optional: true`，由服务端决定）设上，这条 request 就变成一个 task。服务端立即返回：

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

`ttl` 是服务端承诺保留状态的时长；过了 ttl，task 结果就被丢弃。

### 按 tool 粒度选择支持（Per-tool opt-in）

Tool 注解里可以声明 task 支持级别：

- `taskSupport: "forbidden"` —— 这个 tool 永远同步运行。给快速 tool 用很安全。
- `taskSupport: "optional"` —— 客户端可以请求 task 增广。
- `taskSupport: "required"` —— 客户端**必须**用 task 增广。

`generate_report` 应该是 `required`；`notes_search` 这种就该是 `forbidden`。

### 状态（States）

```
working  -> input_required -> working  (loop via elicitation)
working  -> completed
working  -> failed
working  -> cancelled
```

状态机是 append-only 的：一旦进入 `completed`、`failed` 或 `cancelled`，task 就到了终态。

### 方法（Methods）

- `tasks/status {taskId}` —— 返回当前状态和进度提示。
- `tasks/result {taskId}` —— 阻塞，或者在还没完成时返回 404。
- `tasks/cancel {taskId}` —— 幂等；终态会被忽略。
- `tasks/list` —— 可选；枚举活跃的和最近完成的 task。

### 流式状态变化（Streaming state changes）

当服务端支持时，客户端可以订阅状态通知：

```
server -> notifications/tasks/updated {taskId, state, progress?}
```

走流式而不是轮询的客户端体验更好。但轮询作为最小可用面始终是支持的。

### 持久化状态（Durable state）

Spec 要求声明支持 task 的服务端必须持久化状态。崩溃后，处于 ttl 内的已完成结果不应丢失。存储可以从 SQLite 到 Redis 到文件系统。本节（Lesson 13）的脚手架用文件系统。

### 取消语义（Cancellation semantics）

`tasks/cancel` 是幂等的。如果 task 正在执行中，服务端尝试停下（依赖 executor 协作式取消）。如果已经是终态，这次请求就是 no-op。

### 崩溃恢复（Crash recovery）

服务端进程重启时：

1. 加载所有持久化的 task 状态。
2. 把所有进程挂掉时还在 `working` 的 task 标记为 `failed`，错误码 `CRASH_RECOVERY`。
3. `completed` / `failed` / `cancelled` 在 ttl 内继续保留。

### 异步 task + sampling（Async tasks plus sampling）

一个 task 自己可以调 `sampling/createMessage`。这正是长时间运行的 research task 的工作方式：服务端的 task 线程按需对客户端模型做 sampling，与此同时客户端 UI 把这个 task 显示为 `working` 状态，并周期性地刷新进度。

### 为什么还是实验阶段（Why this is experimental）

SEP-1686 在 2025-11-25 上线，但更大的路线图里还有三个开放问题：持久订阅原语、subtask（父子 task 关系）、以及结果 TTL 的标准化。预计 spec 会在整个 2026 年继续演进。生产代码应该把 Tasks 视为「常见场景下稳定」，并对未来 SDK 中关于 subtask 的变化做好防御。

## 用起来（Use It）

`code/main.py` 实现了一个持久化 task store（基于文件系统）和一个 `generate_report` tool，后者跑在后台线程里。客户端调用这个 tool 后立即拿到 task id，在 worker 更新进度时轮询 `tasks/status`，完成后 fetch `tasks/result`。取消能用；崩溃恢复通过杀掉 worker 线程并重新加载状态来模拟。

要看的几个点：

- Task 状态 JSON 持久化到 `/tmp/lesson-13-tasks/<id>.json`。
- Worker 线程更新 `progress` 字段；轮询能看到它在推进。
- 客户端发起的取消会设置一个事件；worker 检查到后提前退出。
- 「崩溃」后的状态重载会把飞行中的 task 标为 `failed`，附带 `CRASH_RECOVERY`。

## 上线部署（Ship It）

本节产出 `outputs/skill-task-store-designer.md`。给一个长耗时 tool（research、build、export），这个 skill 设计 task store（状态形态、ttl、持久化方式）、挑选合适的 taskSupport 标志，并勾勒出进度通知方案。

## 练习（Exercises）

1. 跑 `code/main.py`。启动一个 `generate_report` task，轮询 status，然后 fetch result。

2. 在执行中途插入一次 `tasks/cancel` 调用。验证 worker 真的尊重了取消，状态变为 `cancelled`。

3. 模拟崩溃恢复：杀掉 worker 线程，重启 loader，观察 `CRASH_RECOVERY` 失败模式。

4. 把 store 扩展到 SQLite。持久化收益是一样的；查询能力打开了（比如列出某个 session X 的所有 task）。

5. 读一遍 MCP 2026 路线图博客。挑出最有可能在未来一年影响 SDK API 设计的那一个 Tasks 相关开放问题。

## 关键术语（Key Terms）

| 术语 | 别人怎么说 | 实际意思 |
|------|----------|---------|
| Task | 「长耗时 tool call」 | 用 `_meta.task` 增广、走异步执行的 request |
| SEP-1686 | 「Tasks spec」 | 在 2025-11-25 引入 Tasks 的 Spec Evolution Proposal |
| `_meta.task` | 「Task envelope」 | 每个 request 上的元数据，含 id、state、ttl |
| taskSupport | 「Tool 标志」 | 每个 tool 上的 `forbidden` / `optional` / `required` |
| `tasks/status` | 「轮询方法」 | 取当前状态和可选的进度提示 |
| `tasks/result` | 「取结果」 | 返回完成后的 payload，未完成则 404 |
| `tasks/cancel` | 「停掉它」 | 幂等的取消请求 |
| ttl | 「保留预算」 | 服务端承诺保留 task 状态的毫秒数 |
| `notifications/tasks/updated` | 「状态推送」 | 服务端主动发起的状态变更事件 |
| Durable store | 「崩溃安全状态」 | 文件系统 / SQLite / Redis 持久化层 |

## 延伸阅读（Further Reading）

- [MCP — GitHub SEP-1686 issue](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1686) —— 起源提案与完整讨论
- [WorkOS — MCP async tasks for AI agent workflows](https://workos.com/blog/mcp-async-tasks-ai-agent-workflows) —— 设计思路与动机走查
- [DeepWiki — MCP task system and async operations](https://deepwiki.com/modelcontextprotocol/modelcontextprotocol/2.7-task-system-and-async-operations) —— 机制与状态机
- [FastMCP — Tasks](https://gofastmcp.com/servers/tasks) —— SDK 层面的 task 实现模式
- [MCP blog — 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) —— 开放问题与 2026 优先级，含 subtask
