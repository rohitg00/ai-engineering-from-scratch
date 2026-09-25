# 显式作用域与无状态引导

> Roots 在 MCP 2026-07-28 中已被弃用，且从来都不是安全沙箱。将作用域放在可见的工具参数或资源 URI 中，在服务器端进行授权，当工具确实需要用户输入时使用 MRTR。用户看到决策，模型看到句柄，任何服务器实例都可以处理重试。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 11 (stateless MRTR)
**Time:** ~60 minutes

## 学习目标

- 用显式的工作区参数、资源 URI 或服务器配置替换已弃用的 Roots。
- 将作用域提示与授权、路径限制和操作系统沙箱分离开来。
- 通过 MRTR `input_required` 结果交付表单模式的 `elicitation/create`。
- 在每请求的客户端能力中声明对引导（elicitation）的支持，并拒绝不支持的模式。
- 将 `accept`、`decline` 和 `cancel` 验证为不同的结果。
- 将破坏性操作的确认绑定到已认证的主体、原始参数、候选集和过期时间。

## 两个看似相似的问题

一个笔记工具收到这样的请求："Delete the old TPS report."

服务器必须回答两个不同的问题。

1. 这次操作可以触及哪个工作区？
2. 三条匹配的笔记中，用户指的是哪一条？

第一个是作用域与授权问题。第二个是交互式消歧问题。把两者混在一起会导致危险的设计，例如把客户端提供的文件夹视为调用者可以删除其中所有内容的证明。

## Roots 只是一个迁移接口

早期的 MCP 版本允许客户端声明 Roots 并在列表变化时通知服务器。Roots 只是信息性的指引。它们不限制服务器进程能读取什么，不授权调用者，也不创建操作系统沙箱。

MCP 2026-07-28 弃用了 `roots/list` 和 `notifications/roots/list_changed`，不建议用于新设计。请优先选择以下显式替代方案之一：

- 当作用域随调用而变化时，使用 `workspaceUri` 或 `directory` 工具参数。
- 当操作本身就是针对某个资源时，使用资源 URI。
- 当一个部署拥有一个固定工作区时，使用服务器配置。
- 当代码必须在技术上无法逃逸时，使用进程沙箱或受限文件系统。

如果现有的 2026-07-28 集成在弃用窗口期内仍需要 `roots/list`，服务器应将其嵌入到 MRTR `inputRequests` 中。它绝不能发送实时的反向请求。那是一个迁移适配器；新的处理器应接受显式作用域。

模型可以看到并复述显式句柄。隐藏在传输会话中的作用域更难检查、重放、审计和路由。

### 三层规则

显式 URI 并不能自动完成授权。必须强制执行全部三层：

1. **授权：** 这个已认证的主体是否被允许使用这个工作区？
2. **限制：** 规范化后的目标 URI 是否保持在已授权的工作区边界之内？
3. **沙箱：** 操作系统是否仍能阻止被攻陷的服务器逃逸？

可运行的服务器维护一个已授权工作区 URI 的允许列表，对百分号编码的路径进行规范化，检查真实的路径组件边界，并在删除之前立即重新检查限制。

朴素的字符串前缀检查是错误的：

```text
allowed:   file:///work/notes
attacker:  file:///work/notes-evil/secret.md
traversal: file:///work/notes/%2e%2e/private.md
```

两个恶意路径都以一个具有误导性的字符串开头。先规范化，再比较路径组件。生产环境的文件系统服务器还必须防御符号链接竞争和平台特定的路径语义。

## 引导仍然存在，但交付方式改变了

引导（Elicitation）是当前用于在 `tools/call`、`prompts/get` 或 `resources/read` 期间收集用户输入的客户端功能。方法名仍然是 `elicitation/create`。改变的是线上流程的方向。

2026-07-28 的服务器不发送反向 JSON-RPC 请求。它返回一个 `InputRequiredResult`：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "input_required",
    "inputRequests": {
      "delete_choice": {
        "method": "elicitation/create",
        "params": {
          "mode": "form",
          "message": "Choose one matching note and confirm deletion.",
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
    },
    "requestState": "integrity-protected-delete-state"
  }
}
```

宿主渲染表单。用户可以接受、明确拒绝或关闭它。客户端随后用一个全新的 id 重试原始的 `tools/call`：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "notes_delete",
    "arguments": {
      "workspaceUri": "file:///Users/alice/Documents/Notes",
      "title": "TPS report"
    },
    "inputResponses": {
      "delete_choice": {
        "action": "accept",
        "content": {"note_id": "note-14", "confirm": true}
      }
    },
    "requestState": "integrity-protected-delete-state",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "elicitation": {"form": {}}
      }
    }
  }
}
```

两次调用之间不存在协议会话。服务器验证回显的状态，按照预期模式校验响应，检查所选笔记是否在已签名的候选集中，重新授权工作区，重新检查限制，然后执行删除。

## 能力协商按请求进行

支持表单模式引导的客户端声明：

```json
{
  "io.modelcontextprotocol/clientCapabilities": {
    "elicitation": {"form": {}}
  }
}
```

空的引导能力 `"elicitation": {}` 为了兼容性仍然等同于仅表单支持。显式的 `"elicitation": {"form": {}}` 也支持表单模式。仅 URL 的声明 `"elicitation": {"url": {}}` 则不支持。服务器绝不能嵌入当前请求能力中不存在的模式，即使之前的请求声明过它。

每个请求还携带 `io.modelcontextprotocol/protocolVersion`。缺失或非字符串的版本返回 `-32602`。不支持的字符串返回 `-32022`，并带有精确的 `supported` 和 `requested` 数据。缺失或仅支持 URL 的引导返回 `-32021`，并将 `data.requiredCapabilities` 设为 `{"elicitation":{"form":{}}}`。

没有 JSON-RPC `id` 的信封是一个通知。处理它时不要发出 JSON-RPC 成功或错误响应。在 Streamable HTTP 上，被接受的通知会收到 `202 Accepted`，没有响应体。

`clientInfo` 应该被包含进来用于诊断，但它是自我报告的，不能用于识别授权用户。

服务器实现了 `server/discover` 并返回 `supportedVersions`、能力、`ttlMs` 和带有 `resultType: "complete"` 的 `cacheScope`。在这个现代设计中，它不声明 Roots。因为它声明了工具，所以它也实现了强制的 `tools/list`。该结果返回确定性的 `notes_delete` 描述符、有效的对象 `inputSchema`、服务器身份元数据和公开的缓存提示。

## 表单模式

表单模式使用一种为可用对话框设计的受限 JSON Schema。根节点是一个对象，其属性是扁平的原始字段或受支持的枚举数组。深层嵌套对象和通用文档模式不属于确认对话框。

表单模式适用于：

- 从多个候选中选择一个；
- 确认破坏性操作；
- 收集非敏感偏好；
- 收集少量必须由用户（而非模型）决定的值。

不要将表单模式用于密码、API 密钥、访问令牌或支付凭据。这些机密信息会经过 MCP 客户端，可能进入日志或模型上下文。

服务器会再次校验返回的内容。客户端表单校验可以改善用户体验，但不构成信任。

## URL 模式

URL 模式发送一个安全的 web URL，用于带外交互：

```json
{
  "method": "elicitation/create",
  "params": {
    "mode": "url",
    "message": "Connect the report service to continue.",
    "url": "https://mcp.example.com/connect/report-service"
  }
}
```

当敏感信息必须直接发送到服务器控制的 web 流程（如第三方授权）时使用它。客户端会显示完整的目标地址，并在打开之前征得同意。它绝不能预取该 URL。

`accept` 响应意味着用户同意打开该 URL。它并不证明外部流程已经完成。在重试时，服务器检查自己的状态，要么完成操作，要么返回另一个 `input_required` 结果。

URL 引导不是 MCP 客户端与 MCP 服务器之间授权的替代品。它用于 MCP 服务器需要代表用户执行的外部交互。服务器必须将浏览器用户绑定到发起 MCP 操作的同一个已认证主体。

## 响应分支

将这些操作视为产品决策，而非别名：

| 操作 | 含义 | 安全的服务器行为 |
|--------|---------|----------------------|
| `accept` | 用户提交了交互 | 校验内容并继续 |
| `decline` | 用户明确拒绝 | 返回完整的、非错误的拒绝结果 |
| `cancel` | 用户关闭或未能完成 | 安全停止并允许稍后重试 |

绝不要把缺失的内容解释为同意。绝不要把拒绝变成反复提示的循环。

## 保护破坏性 MRTR 状态

候选列表不能只存在于提示中或未签名的 Base64 值里。客户端会控制它发回的一切。

本课对包含以下内容的状态载荷进行签名：

- 已认证的主体；
- 发起的方法；
- `workspaceUri` 和 `title` 的摘要；
- 表单中显示的允许的笔记 id；
- 操作阶段；
- 较短的过期时间。

在变更之前，服务器还会检查实时的笔记记录。这可以捕获删除竞争，以及表单显示后目标被移出工作区的情况。

对于一次性的金融或不可逆操作，仅有 HMAC 并不能防止有效状态在其过期时间内被重放。在由每个处理器实例共享的重放存储中，将 nonce 存储并恰好消费一次。本课注入一个有界的、按 TTL 修剪的存储，并在执行内存中删除时持有其原子性认领。生产数据库应该在单个事务或等效的条件写边界中将 nonce 认领与变更耦合起来。

在认领 nonce 之前先校验交互。格式错误的响应或 `cancel` 不会执行任何变更，并使状态保持可重试直至过期。明确的 `decline` 是终止性的，因此本课会消费 nonce 但不删除任何内容。

```figure
t3-roots-boundary
```

## 构建它

`code/main.py` 演示了一个现代的 `notes_delete` 工具：

- `tools/list` 返回确定性的、可缓存的描述符，包含所需的工作区和标题模式。
- 作用域是一个显式的 `workspaceUri` 参数。
- 服务器配置为课程主体授权该工作区。
- URI 规范化拒绝前缀混淆和编码的路径穿越。
- 每次破坏性删除都需要表单模式引导。
- 引导内容包含在 `resultType: "input_required"` 内部。
- 已签名的 `requestState` 绑定精确的候选列表和原始参数。
- 注入的重放存储拒绝跨服务器实例的相同已接受或已拒绝状态。
- 重试使用全新的请求 id 并返回 `resultType: "complete"`。

数据存储在内存中，以便协议行为易于检查。使用数据库时安全规则保持不变。

## 使用它

在仓库根目录下：

```bash
cd phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/code
python3 main.py
python3 -m unittest discover tests -v
```

预期检查点：

- 发现时声明工具而不带 Roots。
- 工具发现返回带有 `resultType`、服务器身份和缓存提示的 `notes_delete`。
- 请求 id `1` 在 `inputRequests.delete_choice` 中返回表单。
- 请求 id `2` 回显已签名的状态并完成删除。
- 前缀路径和编码的路径穿越路径都无法通过限制检查。
- 更改后的标题不能复用原始确认状态。
- 拒绝会使笔记保持不变。
- 共享笔记和重放状态的两个服务器对象不能都执行同一个确认。
- 空的和显式的表单声明都可以工作，而仅 URL 支持则返回精确的 `-32021` 表单要求。
- 不支持的版本失败使用精确的 `-32022` 数据形状。
- 没有 id 的通知不产生任何 JSON-RPC 响应。

## 发布它

`outputs/skill-elicitation-form-designer.md` 设计显式作用域、授权检查、MRTR 表单、响应分支和状态绑定。它拒绝把已弃用的 Roots 当作沙箱，也拒绝通过表单模式收集机密信息。

## 练习

1. 将内存中的重放存储替换为 SQLite。使用一个事务来认领 nonce 并删除笔记，然后证明两个进程不能同时提交。
2. 添加 `url` 能力协商和带外设置流程。将第三方凭据排除在 `inputResponses` 之外。
3. 将内存中的笔记映射替换为临时 SQLite 数据库。在变更事务内部重新检查授权和限制。
4. 为真实的文件系统实现添加符号链接策略。解释为什么仅靠 URI 词法限制无法阻止符号链接逃逸。
5. 设计一个 2025-11-25 适配器，将现代 MRTR 处理器输出映射到旧式的服务器发起引导。将其与当前处理器隔离。

## 关键术语

| 术语 | 在 2026-07-28 中的含义 |
|------|------------------------|
| Roots | 已弃用的信息性工作区提示，不是授权或沙箱 |
| 显式作用域 | 请求参数中可见的工作区、目录或资源句柄 |
| 限制 | 规范化的路径组件检查，确保目标保持在边界之内 |
| 引导（Elicitation） | 用于在 MCP 操作期间获取用户输入的客户端功能 |
| 表单模式 | 使用受限扁平模式的带内结构化用户输入 |
| URL 模式 | 用于敏感或外部工作流的带外交互 |
| MRTR | 无状态的输入必需结果，随后是全新的重试 |
| `requestState` | 不透明的状态，被精确回显并由服务器进行完整性校验 |
| Decline | 用户的明确拒绝 |
| Cancel | 关闭或未完成的交互，未经批准 |

## 旧版兼容性

对于固定在 2025-11-25 的对端，`roots/list`、`notifications/roots/list_changed` 和实时的服务器发起 `elicitation/create` 可能仍然存在。将该适配器标记为旧版。不要允许旧版 Root 列表绕过服务器授权，也不要把协议会话假设带入现代处理器。

## 延伸阅读

- [MCP 2026-07-28 Elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation)
- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 Roots deprecation](https://modelcontextprotocol.io/specification/2026-07-28/client/roots)
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)