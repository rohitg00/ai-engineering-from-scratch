# Roots 与 Elicitation —— 作用域限定与运行中的用户输入

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 一旦用户打开另一个项目，硬编码的路径就立刻失效；预填的 tool 参数则会因为用户描述不完整而崩溃。Roots 把 server 限定在用户授权的一组 URI 内；elicitation 则在 tool 调用过程中暂停下来，通过表单或 URL 向用户索取结构化输入。两个 client 端 primitive，对应两类常见的 MCP 失败模式。SEP-1036（URL 模式 elicitation，2025-11-25）在 2026 上半年仍属实验性 —— 在依赖它之前先确认你的 SDK 版本。

**Type:** Build
**Languages:** Python (stdlib, roots + elicitation demo)
**Prerequisites:** Phase 13 · 07 (MCP server)
**Time:** ~45 minutes

## 学习目标（Learning Objectives）

- 声明 `roots`，并响应 `notifications/roots/list_changed`。
- 把 server 的文件操作限定在已声明 root 集合内的 URI。
- 用 `elicitation/create` 在 tool 调用进行中向用户索取确认或结构化输入。
- 在 form 模式与 URL 模式 elicitation 之间做选择（后者尚处实验阶段，注意 drift 风险）。

## 问题（Problem）

一台运行在生产环境的 notes MCP server，会撞上两类具体故障。

**路径假设失效。** Server 写死了 `~/notes`。换一台机器、笔记目录在 `~/Documents/Notes` 的用户调用 tool，要么悄无声息地失败（找不到文件），要么更糟 —— 写到了错误的位置。

**模型缺少用户才知道的参数。** 用户说「删掉那条旧的 TPS 报告笔记」。模型调用 `notes_delete(title: "TPS report")`，但 2023、2024、2025 各有一条匹配。Tool 没法猜。直接报「ambiguous」很烦人；三条全删则是灾难。

Roots 解决第一类：client 在 `initialize` 阶段声明一组 server 可以触碰的 URI。Elicitation 解决第二类：server 暂停 tool 调用，发 `elicitation/create` 让用户挑出具体那条。

## 概念（Concept）

### Roots

Client 在 `initialize` 时声明 root 列表：

```json
{
  "capabilities": {"roots": {"listChanged": true}}
}
```

Server 之后可以调用 `roots/list`：

```json
{"roots": [{"uri": "file:///Users/alice/Documents/Notes", "name": "Notes"}]}
```

Server **必须**把 roots 当作边界：任何在 root 集合之外的文件读写都要拒绝。这条规则不由 client 强制（毕竟 server 仍是用户信任并运行的代码），但符合规范的 server 会遵守。

当用户增删 root 时，client 发送 `notifications/roots/list_changed`。Server 重新调用 `roots/list`，更新自己的边界。

### Roots 为什么是 client 端的 primitive

Roots 由 client 声明，因为它们代表的是用户的授权模型。是用户告诉 Claude Desktop：「让这个 notes server 访问这两个目录」。Server 无权扩大这个范围。

### Elicitation：默认的 form 模式

`elicitation/create` 接收一个 form schema 加一段自然语言提示：

```json
{
  "method": "elicitation/create",
  "params": {
    "message": "Delete 'TPS report'? Multiple notes match; pick one.",
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

Client 渲染表单，收集用户答案，返回：

```json
{
  "action": "accept",
  "content": {"note_id": "note-14", "confirm": true}
}
```

三种可能的 action：`accept`（用户填好了）、`decline`（用户关掉了表单）、`cancel`（用户中止了整个 tool 调用）。

Form schema 必须是扁平的 —— v1 不支持嵌套对象。SDK 通常会拒绝任何超过单层的 schema。

### Elicitation：URL 模式（SEP-1036，实验性）

2025-11-25 新增。Server 不再发 schema，而是发一个 URL：

```json
{
  "method": "elicitation/create",
  "params": {
    "message": "Sign in to GitHub",
    "url": "https://github.com/login/oauth/authorize?client_id=..."
  }
}
```

Client 在浏览器中打开该 URL，等待完成，用户回到 client 后返回结果。适合 OAuth 流程、支付授权、文档签署 —— 表单装不下的场景。

Drift 风险提示：SEP-1036 的响应结构尚未定型，有的 SDK 返回回调 URL，有的返回完成 token。在生产中使用 URL 模式前，先看清你 SDK 的 release notes。

### 何时该用 elicitation

- 在破坏性操作前向用户确认（destructive hint + elicitation）。
- 消歧（在 N 个匹配里选一个）。
- 首次运行配置（API key、目录、偏好设置）。
- OAuth 风格的流程（URL 模式）。

### 何时不该用 elicitation

- 用来填 tool 的必填参数 —— 那些模型本可以用对话再问一遍的东西。用普通的 re-prompt，别动用 elicitation 弹窗。
- 高频调用。Elicitation 会打断对话；别把它放进循环里。
- 任何 server 事后可以校验的东西。先校验、报错、让模型用文字向用户询问。

### Human-in-the-loop（人工确认）的桥梁

Elicitation 加上 sampling 共同支撑了 MCP 的 human-in-the-loop（人工确认）模型。Server 端的 agent loop 既可以暂停等待用户输入（elicitation），也可以暂停等待模型推理（sampling）。Phase 13 · 11 讲了 sampling，本课讲 elicitation。把它们组合起来，就能在 loop 进行中获得完整的控制权。

## 用起来（Use It）

`code/main.py` 在 notes server 之上扩展出：

- `roots/list` 响应；server 会在收到 root-list-changed 通知后重新查询。
- 一个 `notes_delete` tool，匹配多条时用 `elicitation/create` 做消歧。
- 一个 `notes_setup` tool，用 URL 模式 elicitation 打开首次运行配置页（模拟）。
- 一个边界检查，拒绝在已声明 roots 之外的 URI 上做操作。

Demo 跑三种场景：happy path（单条命中）、消歧（三条命中，触发 elicitation）、越界写入（被拒）。

## 上线部署（Ship It）

本课产出 `outputs/skill-elicitation-form-designer.md`。给定一个可能需要用户确认或消歧的 tool，这个 skill 会为它设计 elicitation 的 form schema 与 message 模板。

## 练习（Exercises）

1. 运行 `code/main.py`。触发消歧路径；确认模拟用户的回答能够回流到 tool。

2. 新增一个 `notes_archive` tool，每次都要求 elicitation 确认（带 destructive hint）。观察体验：和模型在文本里再问一遍相比，差别在哪？

3. 为首次运行的 OAuth 流程实现 URL 模式 elicitation。注意 drift 风险，加上 SDK 版本守卫。

4. 扩展 `roots/list` 的处理：当通知到达时，server 应该原子地重新读取，并重扫已打开的文件句柄 —— 这些句柄此刻可能已落在范围之外。

5. 阅读 GitHub 上 SEP-1036 的讨论 thread。指出其中一个尚未定论、且会影响 server 如何处理 URL 模式回调的开放性问题。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|----------------|------------------------|
| Root | 「授权边界」 | Client 允许 server 触碰的 URI |
| `roots/list` | 「Server 查询作用域」 | Client 返回当前的 root 集合 |
| `notifications/roots/list_changed` | 「用户改了作用域」 | Client 通知 root 集合已变更 |
| Elicitation | 「调用中向用户提问」 | Server 主动发起的结构化用户输入请求 |
| `elicitation/create` | 「那个方法」 | Elicitation 请求对应的 JSON-RPC 方法 |
| Form 模式 | 「按 schema 出表单」 | 扁平 JSON Schema，由 client UI 渲染成表单 |
| URL 模式 | 「浏览器跳转」 | SEP-1036，实验性；打开 URL 并等待 |
| `accept` / `decline` / `cancel` | 「用户响应结果」 | Server 需要处理的三个分支 |
| 消歧（Disambiguation） | 「挑一个」 | 当 tool 有 N 个候选时常见的 elicitation 用法 |
| Flat form | 「只有顶层属性」 | Elicitation schema 不能嵌套 |

## 延伸阅读（Further Reading）

- [MCP — Client roots spec](https://modelcontextprotocol.io/specification/draft/client/roots) —— roots 的权威参考
- [MCP — Client elicitation spec](https://modelcontextprotocol.io/specification/draft/client/elicitation) —— elicitation 的权威参考
- [Cisco — What's new in MCP elicitation, structured content, OAuth enhancements](https://blogs.cisco.com/developer/whats-new-in-mcp-elicitation-structured-content-and-oauth-enhancements) —— 2025-11-25 新增内容的逐条解读
- [MCP — GitHub SEP-1036](https://github.com/modelcontextprotocol/modelcontextprotocol) —— URL 模式 elicitation 提案（实验性，有 drift 风险）
- [The New Stack — How elicitation brings human-in-the-loop to AI tools](https://thenewstack.io/how-elicitation-in-mcp-brings-human-in-the-loop-to-ai-tools/) —— UX 视角讲解
