# Roots 与 Elicitation —— 作用域界定与飞行中用户输入

> 硬编码路径在用户打开不同项目时立即失效。预填充工具参数在用户欠指定时失效。Roots 将服务器限定为用户控制的 URI 集合；Elicitation 在工具调用中途暂停，通过表单或 URL 向用户请求结构化输入。两个客户端原语，两个常见 MCP 失效模式的修复。SEP-1036（URL 模式 elicitation，2025-11-25）在 2026 年上半年之前是实验性的——在依赖它之前检查 SDK 版本。

**类型：** Build
**语言：** Python（stdlib，roots + elicitation 演示）
**前置知识：** Phase 13 · 07（MCP 服务器）
**时间：** ~45 分钟

## 学习目标

- 声明 `roots` 并响应 `notifications/roots/list_changed`。
- 将服务器文件操作限制在声明的根集合内的 URI。
- 使用 `elicitation/create` 在工具调用中途向用户请求确认或结构化输入。
- 在表单模式和 URL 模式 elicitation 之间选择（后者是实验性的；注意漂移风险）。

## 问题所在

笔记 MCP 服务器在生产中遇到的两个具体故障。

**损坏的路径假设。** 服务器针对 `~/notes` 编写。另一台机器上笔记在 `~/Documents/Notes` 中的用户得到一个静默失败的工具调用（未找到文件）或更糟，写到了错误的地方。

**用户会知道的缺失参数。** 用户问"删除旧的 TPS 报告笔记"。模型调用 `notes_delete(title: "TPS report")`，但有三个匹配的笔记分别来自 2023、2024 和 2025。工具无法猜测。以"歧义"失败很烦人；在三个上全部运行则是灾难性的。

Roots 修复第一个：客户端在 `initialize` 时声明服务器可以接触的 URI 集合。Elicitation 修复第二个：服务器暂停工具调用并发送 `elicitation/create` 请求用户选择哪一个。

## 核心概念

### Roots

客户端在 `initialize` 时声明根列表：

```json
{
  "capabilities": {"roots": {"listChanged": true}}
}
```

服务器然后可以调用 `roots/list`：

```json
{"roots": [{"uri": "file:///Users/alice/Documents/Notes", "name": "Notes"}]}
```

服务器必须将根视为边界：根集合之外的任何文件读取或写入都被拒绝。这不是由客户端强制执行的（服务器仍然是用户信任的代码），但符合规范的服务器遵守它。

当用户添加或移除根时，客户端发送 `notifications/roots/list_changed`。服务器重新调用 `roots/list` 并更新其边界。

### 为什么 roots 是客户端原语

Roots 由客户端声明，因为它们代表用户的同意模型。用户告诉 Claude Desktop"给这个笔记服务器访问这两个目录的权限"。服务器不能扩大该范围。

### Elicitation：表单模式默认值

`elicitation/create` 接受表单模式加自然语言提示：

```json
{
  "method": "elicitation/create",
  "params": {
    "message": "删除 'TPS report'？多个笔记匹配；选择一个。",
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

客户端渲染表单，收集用户的答案，返回：

```json
{
  "action": "accept",
  "content": {"note_id": "note-14", "confirm": true}
}
```

三种可能的动作：`accept`（用户填写了）、`decline`（用户关闭了）、`cancel`（用户中止了整个工具调用）。

表单模式是扁平的——v1 中不支持嵌套对象。SDK 通常拒绝任何比单层更复杂的东西。

### Elicitation：URL 模式（SEP-1036，实验性）

2025-11-25 新增。服务器发送 URL 而非模式：

```json
{
  "method": "elicitation/create",
  "params": {
    "message": "登录 GitHub",
    "url": "https://github.com/login/oauth/authorize?client_id=..."
  }
}
```

客户端在浏览器中打开 URL，等待完成，用户返回时返回。对 OAuth 流程、支付授权和表单不足的文档签名很有用。

漂移风险说明：SEP-1036 响应形状仍在稳定中；一些 SDK 返回回调 URL，另一些返回完成令牌。在生产中使用 URL 模式之前阅读你的 SDK 的发布说明。

### Elicitation 何时是正确工具

- 破坏性操作前的用户确认（破坏性提示 + elicitation）。
- 消歧（从 N 个匹配中选择一个）。
- 首次运行设置（API 密钥、目录、偏好）。
- OAuth 风格流程（URL 模式）。

### Elicitation 何时错误

- 填充模型本可以用散文询问的工具必需参数。使用正常的重新提示，而非 elicitation 对话框。
- 高频调用。Elicitation 中断对话；不要在循环中触发它。
- 服务器可以在事后验证的任何事情。验证，返回错误，让模型用文本询问用户。

### 人工介入桥梁

Elicitation 加采样共同启用 MCP 的"人工介入"模型。服务器的代理循环可以暂停以获取用户输入（elicitation）或模型推理（采样）。Phase 13 · 11 涵盖采样；本课涵盖 elicitation。将它们组合起来以实现完整的循环中控制。

## 使用它

`code/main.py` 扩展了笔记服务器，包括：

- `roots/list` 响应，服务器在根列表变更通知后重新查询。
- 一个 `notes_delete` 工具，当多个笔记匹配时使用 `elicitation/create` 进行消歧。
- 一个 `notes_setup` 工具，使用 URL 模式 elicitation 打开首次运行配置页面（模拟）。
- 拒绝声明根之外 URI 操作的边界检查。

演示运行三个场景：快乐路径（一个匹配）、消歧（三个匹配，elicitation 触发）、根外写入（被拒绝）。

## 交付它

本课产出 `outputs/skill-elicitation-form-designer.md`。给定一个可能需要用户确认或消歧的工具，该技能设计 elicitation 表单模式和消息模板。

## 练习

1. 运行 `code/main.py`。触发消歧路径；确认模拟的用户答案被路由回工具。

2. 添加一个新工具 `notes_archive`，每次都需要 elicitation 确认（破坏性提示）。检查 UX：这与模型用文本重新询问相比如何？

3. 为首次运行 OAuth 流程实现 URL 模式 elicitation。注意漂移风险并添加 SDK 版本保护。

4. 扩展 `roots/list` 处理：当通知到达时，服务器应原子性地重新读取并重新扫描可能现在超出范围的打开文件句柄。

5. 阅读 GitHub 上的 SEP-1036 问题讨论线程。识别一个影响服务器应如何处理 URL 模式回调的开放问题。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Root | "同意边界" | 客户端允许服务器接触的 URI |
| `roots/list` | "服务器请求作用域" | 客户端返回当前根集合 |
| `notifications/roots/list_changed` | "用户更改了作用域" | 客户端信号根集合已变更 |
| Elicitation | "调用中途询问用户" | 服务器发起的结构化用户输入请求 |
| `elicitation/create` | "该方法" | Elicitation 请求的 JSON-RPC 方法 |
| 表单模式 | "模式驱动表单" | 在客户端 UI 中渲染为表单的扁平 JSON 模式 |
| URL 模式 | "浏览器重定向" | SEP-1036 实验性；打开 URL 并等待 |
| `accept` / `decline` / `cancel` | "用户响应结果" | 服务器处理的三个分支 |
| 消歧 | "选择一个" | 工具具有 N 个候选时的常见 elicitation 用例 |
| 扁平表单 | "仅顶层属性" | Elicitation 模式不能嵌套 |

## 延伸阅读

- [MCP — 客户端 roots 规范](https://modelcontextprotocol.io/specification/draft/client/roots) — 规范的 roots 参考
- [MCP — 客户端 elicitation 规范](https://modelcontextprotocol.io/specification/draft/client/elicitation) — 规范的 elicitation 参考
- [Cisco — MCP elicitation、结构化内容、OAuth 增强中的新功能](https://blogs.cisco.com/developer/whats-new-in-mcp-elicitation-structured-content-and-oauth-enhancements) — 2025-11-25 新增功能演练
- [MCP — GitHub SEP-1036](https://github.com/modelcontextprotocol/modelcontextprotocol) — URL 模式 elicitation 提案（实验性，漂移风险）
- [The New Stack — Elicitation 如何将人工介入带入 AI 工具](https://thenewstack.io/how-elicitation-in-mcp-brings-human-in-the-loop-to-ai-tools/) — UX 演练
