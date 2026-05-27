# 根和询问 — 作用域和飞行中用户输入

> 当用户打开不同的项目时，硬编码路径就会失效。当用户规范不足时，预填充的工具参数就会失效。根（Roots）将服务器作用域限定为用户控制的一组 URI；询问（Elicitation）在工具调用中途暂停，通过表单或 URL 询问用户结构化输入。两个客户端原语，修复两个常见的 MCP 故障模式。SEP-1036（URL 模式询问，2025-11-25）在 2026 年上半年是实验性的 — 在依赖它之前请检查 SDK 版本。

**类型：** 构建
**语言：** Python (stdlib, 根 + 询问演示)
**前置条件：** 阶段 13 · 07 (MCP 服务器)
**时间：** ~45 分钟

## 学习目标

- 声明 `roots` 并响应 `notifications/roots/list_changed`。
- 将服务器文件操作限制在声明的根集合内的 URI。
- 使用 `elicitation/create` 在工具调用中途询问用户确认或结构化输入。
- 在表单模式和 URL 模式询问之间做出选择（后者是实验性的；注意漂移风险）。

## 问题背景

笔记 MCP 服务器在生产中遇到的两个具体故障。

**破坏的路径假设。** 服务器是针对 `~/notes` 编写的。不同机器上笔记在 `~/Documents/Notes` 的用户得到一个静默失败（未找到文件）的工具调用，或者更糟的是，写入了错误的地方。

**用户会知道但缺失的参数。** 用户问"删除旧的 TPS 报告笔记"。模型调用 `notes_delete(title: "TPS report")`，但有 2023、2024 和 2025 年的三个匹配笔记。工具无法猜测。以"模糊"失败很烦人；对所有三个运行是灾难性的。

根修复第一个：客户端在 `initialize` 时声明服务器可以接触的 URI 集合。询问修复第二个：服务器暂停工具调用并发送 `elicitation/create` 询问用户选择哪一个。

## 概念详解

### 根

客户端在 `initialize` 时声明根列表：

```json
{
  "capabilities": {"roots": {"listChanged": true}}
}
```

然后服务器可以调用 `roots/list`：

```json
{"roots": [{"uri": "file:///Users/alice/Documents/Notes", "name": "Notes"}]}
```

服务器必须将根视为边界：根集合之外的任何文件读取或写入都会被拒绝。这不是由客户端强制执行的（服务器仍然是用户信任的代码），但符合规范的服务器会遵守它。

当用户添加或删除根时，客户端发送 `notifications/roots/list_changed`。服务器重新调用 `roots/list` 并更新其边界。

### 为什么根是客户端原语

根由客户端声明，因为它们代表用户的同意模型。用户告诉 Claude Desktop"给这个笔记服务器访问这两个目录的权限"。服务器不能扩大该范围。

### 询问：表单模式默认

`elicitation/create` 接受表单模式和自然语言提示：

```json
{
  "method": "elicitation/create",
  "params": {
    "message": "删除 'TPS 报告'？多个笔记匹配；请选择一个。",
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

三种可能的操作：`accept`（用户填写了）、`decline`（用户关闭了）、`cancel`（用户中止了整个工具调用）。

表单模式是扁平的 — v1 不支持嵌套对象。SDK 通常拒绝比单层更复杂的任何东西。

### 询问：URL 模式（SEP-1036，实验性）

2025-11-25 新增。服务器发送 URL 而不是模式：

```json
{
  "method": "elicitation/create",
  "params": {
    "message": "登录 GitHub",
    "url": "https://github.com/login/oauth/authorize?client_id=..."
  }
}
```

客户端在浏览器中打开 URL，等待完成，当用户返回时返回。适用于 OAuth 流程、支付授权和文档签名等表单不足的情况。

漂移风险说明：SEP-1036 响应形态仍在稳定中；某些 SDK 返回回调 URL，其他返回完成令牌。在生产中使用 URL 模式之前，请阅读 SDK 的发行说明。

### 何时询问是正确的工具

- 破坏性操作前的用户确认（破坏性提示 + 询问）。
- 消歧（从 N 个匹配中选择一个）。
- 首次运行设置（API 密钥、目录、偏好）。
- OAuth 风格流程（URL 模式）。

### 何时询问是错误的

- 填充模型本可以通过散文询问的工具所需参数。使用正常的重新提示，而不是询问对话框。
- 高频调用。询问会中断对话；不要在循环内触发它。
- 服务器可以在事后验证的任何事情。验证，返回错误，让模型以文本询问用户。

### 人在回路中的桥梁

询问加上采样一起实现了 MCP 的"人在回路中"模型。服务器的智能体循环可以暂停以等待用户输入（询问）或模型推理（采样）。阶段 13 · 11 涵盖了采样；本课涵盖询问。将它们放在一起以实现完整的循环内控制。

## 使用示例

`code/main.py` 扩展了笔记服务器，包含：

- `roots/list` 响应，服务器在根列表更改通知后重新查询。
- 使用 `elicitation/create` 在多个笔记匹配时消歧的 `notes_delete` 工具。
- 使用 URL 模式询问打开首次运行配置页面（模拟）的 `notes_setup` 工具。
- 拒绝在声明根之外的 URI 上操作的边界检查。

演示运行三种场景：快乐路径（一个匹配）、消歧（三个匹配，触发询问）、根外写入（被拒绝）。

## 实战输出

本课生成 `outputs/skill-elicitation-form-designer.md`。给定一个可能需要用户确认或消歧的工具，该技能设计询问表单模式和消息模板。

## 练习

1. 运行 `code/main.py`。触发消歧路径；确认模拟的用户答案被路由回工具。

2. 添加一个每次都需要询问确认的 `notes_archive` 工具（破坏性提示）。检查 UX：这与模型以文本重新询问相比如何？

3. 为首次运行 OAuth 流程实现 URL 模式询问。注意漂移风险并添加 SDK 版本保护。

4. 扩展 `roots/list` 处理：当通知到达时，服务器应该原子地重新读取并重新扫描现在可能超出范围的打开文件句柄。

5. 阅读 GitHub 上的 SEP-1036 问题讨论线程。识别一个影响服务器应如何处理 URL 模式回调的开放问题。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| 根 | "同意边界" | 客户端允许服务器接触的 URI |
| `roots/list` | "服务器请求作用域" | 客户端返回当前根集合 |
| `notifications/roots/list_changed` | "用户更改了作用域" | 客户端信号根集合已变更 |
| 询问 | "在调用中途询问用户" | 服务器发起的结构化用户输入请求 |
| `elicitation/create` | "该方法" | 用于询问请求的 JSON-RPC 方法 |
| 表单模式 | "模式驱动的表单" | 在客户端 UI 中渲染为表单的扁平 JSON 模式 |
| URL 模式 | "浏览器重定向" | SEP-1036 实验性；打开 URL 并等待 |
| `accept` / `decline` / `cancel` | "用户响应结果" | 服务器处理的三个分支 |
| 消歧 | "选择一个" | 工具具有 N 个候选时的常见询问用例 |
| 扁平表单 | "仅顶级属性" | 询问模式不能嵌套 |

## 延伸阅读

- [MCP — 客户端根规范](https://modelcontextprotocol.io/specification/draft/client/roots) — 权威根参考
- [MCP — 客户端询问规范](https://modelcontextprotocol.io/specification/draft/client/elicitation) — 权威询问参考
- [Cisco — MCP 询问、结构化内容、OAuth 增强中的新增功能](https://blogs.cisco.com/developer/whats-new-in-mcp-elicitation-structured-content-and-oauth-enhancements) — 2025-11-25 新增功能演练
- [MCP — GitHub SEP-1036](https://github.com/modelcontextprotocol/modelcontextprotocol) — URL 模式询问提案（实验性，漂移风险）
- [The New Stack — 询问如何将人在回路中带入 AI 工具](https://thenewstack.io/how-elicitation-in-mcp-brings-human-in-the-loop-to-ai-tools/) — UX 演练
