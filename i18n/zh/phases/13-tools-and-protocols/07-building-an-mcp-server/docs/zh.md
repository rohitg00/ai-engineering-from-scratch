# 构建一个 MCP 服务器：无状态的 Python 与 TypeScript 实现

> 现代 MCP 服务器不会记住一次握手。它在每个请求上验证元数据，执行一个处理程序，并返回一个类型化的结果。

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** 第 13 阶段，第 06 课
**Time:** 约 85 分钟

## 学习目标

- 为 MCP `2026-07-28` 实现强制的 `server/discover`。
- 在每个请求上验证协议版本和客户端能力。
- 以确定性的列表顺序暴露工具、资源和提示词。
- 在正确的结果上返回 `resultType`、服务器标识和缓存提示。
- 在 Python 和 TypeScript 中通过换行符分隔的 stdio 提供相同的无状态契约。

## 问题

一个在首条消息之后存储客户端能力的服务器易于构建，却难以运维。同一个进程可能为多个串行的客户端提供服务。一个远程请求可能落在不同的 worker 上。一份过期的能力声明可能跨授权边界泄漏行为。

MCP `2026-07-28` 通过让每个请求自我描述，解决了协议层面的问题。你的应用仍然可以保存持久的笔记、任务或显式的状态句柄。它不能保存的是隐藏的协议状态——那种会改变后续请求如何被解码的状态。

本课构建一个笔记服务器两次。Python 和 TypeScript 版本的协议核心只使用各自的标准库。两者暴露相同的方法，并强制执行相同的线上契约。

## 概念

### 现代的分发循环

```text
read one JSON-RPC line
parse the envelope
if it is a notification, do not respond
validate params._meta for this request
route by method
wrap success with resultType and serverInfo
write one JSON-RPC response line
forget request-scoped metadata
```

三条 stdio 规则依然重要：

- 只向 stdout 写 JSON-RPC 消息。把诊断信息发送到 stderr。
- 用换行符分隔消息，并刷新每次响应。
- 当 stdin 到达 EOF 时立即退出。

进程的生命周期就是传输的生命周期。它不是一个现代 MCP 会话。

### 请求验证

每个请求必须包含：

```json
{
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "notes-client",
        "version": "1.0.0"
      }
    }
  }
}
```

前两个字段是必需的。推荐提供 `clientInfo`。验证身份形状（如果存在），但不要将其视为身份认证。

如果版本不受支持，返回代码 `-32022` 以及 `requested` 和 `supported`。缺失的请求元数据属于无效参数，代码为 `-32602`。绝不要用上一次调用的字段去补全缺失的字段。

### 强制的发现

现代服务器必须实现 `server/discover`。一个完整的发现结果包括支持的现代版本、能力、可选的说明、缓存提示，以及 result `_meta` 中的服务器标识：

```json
{
  "resultType": "complete",
  "supportedVersions": ["2026-07-28"],
  "capabilities": {
    "tools": {"listChanged": false},
    "resources": {"listChanged": false, "subscribe": false},
    "prompts": {"listChanged": false}
  },
  "ttlMs": 3600000,
  "cacheScope": "public",
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "notes-server",
      "version": "2.0.0"
    }
  }
}
```

发现并不会解锁服务器。客户端可以不调用发现就调用 `tools/list`，因为 `tools/list` 已经携带了相同的请求元数据。

### 工具

`tools/list` 返回一个确定性的工具描述符列表。稳定的排序可以改善响应缓存，并保持模型上下文稳定。该结果还需要 `ttlMs` 和 `cacheScope`。

`tools/call` 返回内容块和 `isError`。当协议信封或方法参数无效时，使用 JSON-RPC 错误。当一次合法的工具调用已执行但工具本身失败时，使用 `isError: true`。

工具注解仍然只是提示，不是强制机制：

- `readOnlyHint`
- `destructiveHint`
- `idempotentHint`
- `openWorldHint`

宿主应当用它们进行确认和呈现。服务器仍必须执行真正的授权。

### 资源

`resources/list` 返回稳定的 URI 描述符。`resources/read` 返回类型化的内容。两者都可以缓存在 `2026-07-28` 中，因此两者都包含 `ttlMs` 和 `cacheScope`。

对用户特定的笔记数据使用 `cacheScope: "private"`。共享缓存绝不能跨授权上下文复用私有响应。

现代的变更交付不使用 `resources/subscribe`。客户端打开 `subscriptions/listen` 并请求 `resourceSubscriptions` 或列表变更类别。第 10 课构建该流程。

### 提示词

`prompts/list` 是可缓存的且确定性的。`prompts/get` 使用参数渲染一个具名的提示词。渲染后的提示词结果是完整的，但它不属于需要缓存提示的可缓存列表或读取结果。

### 每个成功的结果都是类型化的

示例对所有成功使用同一个包装器：

```python
def complete(payload):
    return {
        "resultType": "complete",
        **payload,
        "_meta": {SERVER_INFO_KEY: SERVER_INFO},
    }
```

列表、读取和发现处理程序会添加 `ttlMs` 以及 `cacheScope`。集中化这个包装器可以防止某个处理程序悄悄遗漏现代结果字段。

### 没有服务器发起的请求

现代服务器可以发送与客户端请求相关的通知，或在客户端打开的 `subscriptions/listen` 流上发送通知。它不得发送自己的 JSON-RPC 请求。

当处理程序需要采样、引导输入或根目录输入时，它返回一个 `input_required` 结果。客户端完成内嵌的输入请求，然后用新的请求 id 重试原始方法。第 11 课讲解这种多轮往返请求（Multi Round-Trip Request）模式。

### 显式的遗留兼容

双时代服务器也可以在一个明确分离的遗留分支上实现 `2025-11-25` 握手。当存在必需的现代 `_meta` 字段时它选择现代行为，当收到 `initialize` 时选择遗留行为。

不要让 `2026-07-28` 请求走遗留握手路径。不要把现代的 `resultType` 字段盖到遗留的初始化结果上。本课的代码刻意只支持现代，以使其不变式保持可见。

```figure
t3-dispatch-loop
```

## 使用它

运行 Python 服务器的有限演示和测试：

```bash
cd code
python3 main.py --demo
python3 -m unittest discover tests -v
```

使用 TypeScript 运行器运行 TypeScript 移植版：

```bash
npx tsx main.ts --demo
```

演示会发送 `server/discover`、列出每种原语、调用工具，并展示一个不支持版本的错误。每个现代请求都重复元数据。每个成功都包含服务器标识。

## 发布它

本课发布 `outputs/skill-mcp-server-scaffolder.md`。它生成一个现代服务器计划，包含发现契约、逐请求验证、确定性的可缓存列表，以及一个可选的隔离的遗留适配器。

## 练习

1. 从一个请求中移除能力字段，并证明服务器不会复用上一个请求的声明。
2. 打乱 `TOOLS`、`PROMPTS` 和笔记插入的顺序。确认所有列表结果保持稳定。
3. 添加一个具有破坏性的 `notes_delete` 工具，并在执行器内部要求一次授权检查。仅将 `destructiveHint` 作为 UX 提示保留。
4. 添加 `resources/templates/list`，包含 `ttlMs`、`cacheScope` 和确定性排序。
5. 为 `2025-11-25` 构建一个分离的遗留适配器。添加测试以证明现代请求永远不会进入它。

## 关键术语

| 术语 | 含义 |
|------|---------|
| 无状态服务器 | 从请求自身的元数据出发处理每个请求，没有协议会话记忆 |
| `server/discover` | 强制的现代方法，通告版本和能力 |
| 完整结果 | 带有 `resultType: "complete"` 的成功现代结果 |
| 可缓存结果 | 带有 `ttlMs` 和 `cacheScope` 的发现、列表或资源读取结果 |
| 确定性列表 | 同一逻辑注册表总是产生相同的条目顺序 |
| 服务器标识 | result `_meta` 中推荐的 `io.modelcontextprotocol/serverInfo` |
| 工具错误 | 合法的工具调用返回带有 `isError: true` 的内容 |
| 协议错误 | 通过 `error` 返回的无效 JSON-RPC 或 MCP 请求 |

## 延伸阅读

- [MCP 规范 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/)
- [MCP 服务器发现](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP 工具](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [MCP 资源](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)
- [MCP 提示词](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts)
- [MCP stdio 传输](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)