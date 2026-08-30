# 12 · 根目录与征询——作用域限定与中途获取用户输入

> 硬编码路径在用户打开另一个项目的那一刻就会失效。预填的工具参数会在用户描述不充分时失效。「根目录（roots）」把服务器约束在一组由用户控制的 URI 范围内；「征询（elicitation）」则在工具调用进行到一半时暂停，通过表单或 URL 向用户索取结构化输入。两个客户端原语，针对两类常见的 MCP 失败模式各给出一种修复手段。SEP-1036（URL 模式征询，2025-11-25）在 2026 上半年期间仍属实验性特性——在依赖它之前请先确认 SDK 版本。

**类型：** 实践（Build）
**语言：** Python（标准库，根目录 + 征询演示）
**前置：** 阶段 13 · 07（MCP 服务器）
**时长：** 约 45 分钟

## 学习目标

- 声明 `roots` 并响应 `notifications/roots/list_changed`。
- 将服务器的文件操作限制在已声明的根目录集合内的 URI 范围。
- 使用 `elicitation/create` 在工具调用中途向用户索要确认或结构化输入。
- 在表单模式（form-mode）与 URL 模式（URL-mode）征询之间做出选择（后者为实验性特性，已标注漂移风险）。

## 问题所在

一个笔记 MCP 服务器在生产环境中会遇到的两个具体失败。

**路径假设被打破。** 服务器是针对 `~/notes` 编写的。某个用户在另一台机器上把笔记放在 `~/Documents/Notes`，于是工具调用要么静默失败（找不到文件），要么更糟——写到了错误的位置。

**用户本该知道、却缺失的参数。** 用户说「删除那条旧的 TPS report 笔记」。模型调用 `notes_delete(title: "TPS report")`，但匹配到的笔记有三条，分别来自 2023、2024 和 2025 年。工具无法猜测。以「歧义」为由失败固然恼人；而对三条全部执行则是灾难性的。

根目录修复第一个问题：客户端在 `initialize` 阶段声明服务器可触及的 URI 集合。征询修复第二个问题：服务器暂停该工具调用，发送 `elicitation/create`，请用户挑选其中一条。

## 概念解析

### 根目录（Roots）

客户端在 `initialize` 阶段声明根目录列表：

```json
{
  "capabilities": {"roots": {"listChanged": true}}
}
```

随后服务器可以调用 `roots/list`：

```json
{"roots": [{"uri": "file:///Users/alice/Documents/Notes", "name": "Notes"}]}
```

服务器**必须**把根目录视为边界：任何对根目录集合之外的文件读写都应被拒绝。这并非由客户端强制执行（服务器终究是用户信任后运行的代码），但符合规范的服务器会遵守这一约定。

当用户增加或移除某个根目录时，客户端会发送 `notifications/roots/list_changed`。服务器随即重新调用 `roots/list` 并更新其边界。

### 为什么根目录是客户端原语

根目录由客户端声明，因为它代表了用户的同意模型（consent model）。是用户告诉 Claude Desktop「给这个笔记服务器访问这两个目录的权限」。服务器无法擅自扩大这一作用域。

### 征询：默认的表单模式

`elicitation/create` 接收一个表单 schema 加上一段自然语言提示：

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

客户端渲染一个表单，收集用户的回答，并返回：

```json
{
  "action": "accept",
  "content": {"note_id": "note-14", "confirm": true}
}
```

共有三种可能的 action：`accept`（用户已填写）、`decline`（用户关闭了它）、`cancel`（用户中止了整个工具调用）。

表单 schema 是扁平的——v1 不支持嵌套对象。SDK 通常会拒绝任何超过单层结构的内容。

### 征询：URL 模式（SEP-1036，实验性）

2025-11-25 新增。服务器不再发送 schema，而是发送一个 URL：

```json
{
  "method": "elicitation/create",
  "params": {
    "message": "Sign in to GitHub",
    "url": "https://github.com/login/oauth/authorize?client_id=..."
  }
}
```

客户端在浏览器中打开该 URL，等待流程完成，待用户返回后再返回结果。适用于 OAuth 流程、支付授权和文档签署等表单无法胜任的场景。

漂移风险提示：SEP-1036 的响应结构仍在定型之中；有的 SDK 返回回调 URL，有的则返回一个完成令牌（completion token）。在生产环境中使用 URL 模式前，请先阅读你所用 SDK 的发布说明。

### 何时该用征询

- 在执行破坏性操作前请求用户确认（破坏性提示 + 征询）。
- 消歧（在 N 个匹配项中挑选其一）。
- 首次运行配置（API 密钥、目录、偏好设置）。
- OAuth 风格的流程（URL 模式）。

### 何时不该用征询

- 填充工具的必填参数，而这些参数模型本可以用文字提问获得。此时应使用普通的重新提问，而非征询对话框。
- 高频调用。征询会打断对话；不要在循环内部触发它。
- 任何服务器可以事后校验的内容。先校验，返回错误，再让模型用文字向用户询问。

### 人在回路（human-in-the-loop）的桥梁

征询与「采样（sampling）」结合，共同实现了 MCP 的「人在回路」模型。服务器的智能体循环可以为用户输入（征询）或模型推理（采样）而暂停。阶段 13 · 11 讲解了采样；本课讲解征询。将两者结合，即可实现对循环中途的完整控制。

## 动手实践

`code/main.py` 在笔记服务器的基础上扩展了：

- 一个 `roots/list` 响应，服务器会在收到根目录列表变更通知后重新查询它。
- 一个 `notes_delete` 工具，当有多条笔记匹配时使用 `elicitation/create` 进行消歧。
- 一个 `notes_setup` 工具，使用 URL 模式征询打开首次运行的配置页（模拟）。
- 一项边界检查，拒绝对已声明根目录之外的 URI 执行操作。

该演示运行三个场景：顺利路径（单条匹配）、消歧（三条匹配，触发征询）、写入根目录之外（被拒绝）。

## 交付物

本课产出 `outputs/skill-elicitation-form-designer.md`。给定一个可能需要用户确认或消歧的工具，该 skill 会设计出征询的表单 schema 与消息模板。

## 练习

1. 运行 `code/main.py`。触发消歧路径；确认模拟的用户回答被正确回传给工具。

2. 新增一个工具 `notes_archive`，要求每次都进行征询确认（破坏性提示）。审视其用户体验：与让模型用文字重新询问相比如何？

3. 为首次运行的 OAuth 流程实现 URL 模式征询。注意漂移风险，并加入一个 SDK 版本守卫。

4. 扩展 `roots/list` 的处理逻辑：当通知到达时，服务器应当原子化地重新读取，并重新扫描那些此刻可能已超出作用域的已打开文件句柄。

5. 阅读 GitHub 上 SEP-1036 issue 的讨论串。找出一个会影响服务器应如何处理 URL 模式回调的悬而未决的问题。

## 关键术语

| 术语 | 人们常说 | 实际含义 |
|------|----------------|------------------------|
| Root（根目录） | 「同意边界」 | 客户端允许服务器触及的 URI |
| `roots/list` | 「服务器索要作用域」 | 客户端返回当前的根目录集合 |
| `notifications/roots/list_changed` | 「用户改变了作用域」 | 客户端发出根目录集合已变动的信号 |
| Elicitation（征询） | 「调用中途问用户」 | 服务器发起的、索取结构化用户输入的请求 |
| `elicitation/create` | 「那个方法」 | 用于征询请求的 JSON-RPC 方法 |
| Form mode（表单模式） | 「schema 驱动的表单」 | 在客户端 UI 中渲染为表单的扁平 JSON Schema |
| URL mode（URL 模式） | 「浏览器跳转」 | SEP-1036 实验性特性；打开一个 URL 并等待 |
| `accept` / `decline` / `cancel` | 「用户响应结果」 | 服务器需处理的三个分支 |
| Disambiguation（消歧） | 「挑一个」 | 当工具有 N 个候选项时常见的征询用例 |
| Flat form（扁平表单） | 「只有顶层属性」 | 征询 schema 不能嵌套 |

## 延伸阅读

- [MCP——客户端根目录规范](https://modelcontextprotocol.io/specification/draft/client/roots) —— 根目录的权威参考
- [MCP——客户端征询规范](https://modelcontextprotocol.io/specification/draft/client/elicitation) —— 征询的权威参考
- [Cisco——MCP 征询、结构化内容、OAuth 增强有何新变化](https://blogs.cisco.com/developer/whats-new-in-mcp-elicitation-structured-content-and-oauth-enhancements) —— 2025-11-25 新增内容详解
- [MCP——GitHub SEP-1036](https://github.com/modelcontextprotocol/modelcontextprotocol) —— URL 模式征询提案（实验性，存在漂移风险）
- [The New Stack——征询如何为 AI 工具带来人在回路](https://thenewstack.io/how-elicitation-in-mcp-brings-human-in-the-loop-to-ai-tools/) —— 用户体验详解
