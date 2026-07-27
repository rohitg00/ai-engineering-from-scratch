# Roots 与 Elicitation——作用域界定与运行中的用户输入

> 硬编码的路径在用户打开另一个项目时就会失效。预填的工具参数在用户未充分指定时也会失效。Roots 将服务器的作用域限定在用户控制的一组 URI 内；Elicitation 则在工具调用中途暂停，通过表单或 URL 向用户请求结构化输入。这是两个客户端原语，分别修复了 MCP 的两种常见故障模式。SEP-1036（URL 模式 elicitation，2025-11-25）在 2026 年上半年之前为实验性特性——使用前请检查 SDK 版本。

**类型：** 构建
**语言：** Python（标准库，roots + elicitation 演示）
**前置条件：** 阶段 13 · 07（MCP 服务器）
**时长：** 约 45 分钟

## 学习目标

- 声明 `roots` 并响应 `notifications/roots/list_changed`。
- 将服务器的文件操作限制在已声明的 root 集合内的 URI。
- 使用 `elicitation/create` 在工具调用中途向用户请求确认或结构化输入。
- 在表单模式与 URL 模式 elicitation 之间做出选择（后者为实验性特性；已注明变更风险）。

## 问题

一个笔记 MCP 服务器在生产环境中会遇到两种具体的故障。

**路径假设错误。** 服务器针对 `~/notes` 编写。某个用户在不同机器上将笔记放在 `~/Documents/Notes` 中，导致工具调用静默失败（找不到文件），甚至更糟——写入了错误的位置。

**缺少用户本应知道的参数。** 用户要求"删除旧的 TPS 报告笔记"。模型调用了 `notes_delete(title: "TPS report")`，但有三个匹配的笔记分别来自 2023、2024 和 2025 年。工具无法猜测。返回"存在歧义"的错误令人厌烦；对所有三个都执行操作则会造成灾难性后果。

Roots 修复了第一个问题：客户端在 `initialize` 时声明服务器可以访问的 URI 集合。Elicitation 修复了第二个问题：服务器暂停工具调用并发送 `elicitation/create`，让用户选择具体是哪一个。

## 概念

### Roots

客户端在 `initialize` 时声明 root 列表：

```json
{
  "capabilities": {"roots": {"listChanged": true}}
}
```

服务器随后可以调用 `roots/list`：

```json
{"roots": [{"uri": "file:///Users/alice/Documents/Notes", "name": "Notes"}]}
```

服务器必须将 roots 视为边界：任何对 root 集合之外的文件的读写操作都应被拒绝。这一点不由客户端强制执行（服务器仍然是用户信任的代码），但符合规范的服务器会遵守这一约束。

当用户添加或移除某个 root 时，客户端会发送 `notifications/roots/list_changed`。服务器重新调用 `roots/list` 并更新其边界。

### 为什么 roots 是客户端原语

Roots 由客户端声明，因为它们代表了用户的授权模型。用户已告知 Claude Desktop"允许这个笔记服务器访问这两个目录"。服务器不能扩大这个范围。

### Elicitation：表单模式（默认）

`elicitation/create` 接收一个表单模式（schema）加上一个自然语言提示：

```json
{
  "method": "elicitation/create",
  "params": {
    "message": "删除 'TPS report'？存在多条匹配笔记，请选择一个。",
    "requestedSchema": {
      "type": "object",
      "properties": {
        "note_id": {
          "type": "string",
          "enum": ["note-3", "note-7", "note-14"]
        },
        "confirm": {"type": "boolean"}
      },
      "required": ["note_id", "confirm"]
    }
  }
}
```

客户端渲染表单，收集用户的回答，返回：

```json
{
  "action": "accept",
  "content": {"note_id": "note-14", "confirm": true}
}
```

三种可能的操作结果：`accept`（用户已填写）、`decline`（用户已关闭）、`cancel`（用户已中止整个工具调用）。

表单模式是扁平的——v1 不支持嵌套对象。SDK 通常会拒绝比单层更复杂的结构。

### Elicitation：URL 模式（SEP-1036，实验性）

2025-11-25 新增。服务器发送一个 URL 而不是模式：

```json
{
  "method": "elicitation/create",
  "params": {
    "message": "登录 GitHub",
    "url": "https://github.com/login/oauth/authorize?client_id=..."
  }
}
```

客户端在浏览器中打开该 URL，等待完成，在用户返回后结束。适用于 OAuth 流程、支付授权和文档签名等表单不足以满足需求的场景。

**变更风险说明：** SEP-1036 的响应格式仍在变动中；某些 SDK 返回回调 URL，另一些返回完成令牌。在生产环境中使用 URL 模式之前，请阅读您所用 SDK 的发布说明。

### 何时适合使用 Elicitation

- 执行破坏性操作前的用户确认（破坏性提示 + elicitation）。
- 消除歧义（从 N 个匹配项中选一个）。
- 首次运行设置（API 密钥、目录、偏好）。
- OAuth 类流程（URL 模式）。

### 何时不应使用 Elicitation

- 填充工具的必要参数，而模型本可以用文字向用户询问。使用正常的重新提示，而不是 elicitation 对话框。
- 高频调用。Elicitation 会中断对话；不要在循环内触发它。
- 任何服务器可以在事后验证的内容。先验证，返回错误，让模型用文字询问用户。

### 人在回路中的桥梁

Elicitation 与采样（sampling）共同构成了 MCP 的"人在回路中"模型。服务器的代理循环可以暂停以等待用户输入（elicitation）或模型推理（sampling）。阶段 13 · 11 介绍了采样；本课程介绍 elicitation。将两者结合，即可实现对环路中段的完全控制。

## 使用它

`code/main.py` 扩展了笔记服务器，包含：

- `roots/list` 响应，服务器在收到 root 列表变更通知后重新查询。
- 一个 `notes_delete` 工具，在多条笔记匹配时使用 `elicitation/create` 来消除歧义。
- 一个 `notes_setup` 工具，使用 URL 模式 elicitation 打开首次运行配置页面（模拟）。
- 一个边界检查，拒绝在已声明 root 之外的 URI 上执行操作。

演示运行三种场景：正常路径（一个匹配项）、消除歧义（三个匹配项，触发 elicitation）、越界写入（被拒绝）。

## 交付物

本课程产出一个 `outputs/skill-elicitation-form-designer.md`。该技能针对可能需要用户确认或消除歧义的工具，设计 elicitation 表单模式和消息模板。

## 练习

1. 运行 `code/main.py`。触发消除歧义路径；确认模拟的用户回答被正确路由回工具。

2. 新增一个需要每次 elicitation 确认的工具 `notes_archive`（破坏性提示）。检查用户体验：与模型用文字重新询问相比如何？

3. 为首次运行 OAuth 流程实现 URL 模式 elicitation。注意变更风险并添加 SDK 版本保护。

4. 扩展 `roots/list` 处理：当收到通知时，服务器应原子性地重新读取并重新扫描可能已超出范围的已打开文件句柄。

5. 在 GitHub 上阅读 SEP-1036 议题讨论线程。找出一个影响服务器应如何处理 URL 模式回调的待决问题。

## 关键术语

| 术语 | 通常说法 | 实际含义 |
|------|----------|----------|
| Root | "授权边界" | 客户端允许服务器访问的 URI |
| `roots/list` | "服务器请求作用域" | 客户端返回当前的 root 集合 |
| `notifications/roots/list_changed` | "用户更改了作用域" | 客户端通知 root 集合已变更 |
| Elicitation | "在调用中途询问用户" | 服务器发起的结构化用户输入请求 |
| `elicitation/create` | "该方法" | 用于 elicitation 请求的 JSON-RPC 方法 |
| 表单模式 | "基于模式的表单" | 在客户端 UI 中渲染为表单的扁平 JSON Schema |
| URL 模式 | "浏览器跳转" | SEP-1036 实验性特性；打开 URL 并等待 |
| `accept` / `decline` / `cancel` | "用户响应结果" | 服务器需要处理的三种分支 |
| 消除歧义 | "选择一个" | 当工具有 N 个候选时常见的 elicitation 用例 |
| 扁平表单 | "仅顶层属性" | Elicitation 模式不支持嵌套 |

## 延伸阅读

- [MCP——客户端 roots 规范](https://modelcontextprotocol.io/specification/draft/client/roots)——roots 的权威参考
- [MCP——客户端 elicitation 规范](https://modelcontextprotocol.io/specification/draft/client/elicitation)——elicitation 的权威参考
- [Cisco——MCP elicitation、结构化内容、OAuth 增强的新特性](https://blogs.cisco.com/developer/whats-new-in-mcp-elicitation-structured-content-and-oauth-enhancements)——2025-11-25 新增功能详解
- [MCP——GitHub SEP-1036](https://github.com/modelcontextprotocol/modelcontextprotocol)——URL 模式 elicitation 提案（实验性，存在变更风险）
- [The New Stack——Elicitation 如何将人类带入 AI 工具的回路中](https://thenewstack.io/how-elicitation-in-mcp-brings-human-in-the-loop-to-ai-tools/)——用户体验详解
