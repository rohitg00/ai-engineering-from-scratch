# MCP 安全：投毒元数据、路由与 MRTR 状态

> 无状态并不意味着无信任。它的含义是：每个请求都要暴露证据，使服务器与网关能够独立验证这次调用。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 13 · 07 (MCP server)、Phase 13 · 08 (MCP client)
**Time:** ~60 分钟

## 学习目标

- 将工具描述、注解、客户端信息与服务器信息视为不可信数据。
- 检测元数据投毒、描述符变更以及跨服务器的名称冲突。
- 验证 2026-07-28 请求元数据与 Streamable HTTP 路由头。
- 保护 MRTR `requestState` 免受篡改，并将确认绑定到精确的参数。
- 将授权与限流应用于主体，而非已移除的协议会话。

## 问题

模型读取工具描述来决定调用什么。路由器读取工具名称来决定把请求发往何处。用户读取标签来决定批准什么。一个恶意描述符可以同时攻击这三者。

MCP 官方安全指南是直接的：除非描述和注解来自可信服务器，否则应视为不可信。即便如此，部署信任也可能变化。服务器更新、被入侵的软件包、注册表错误或网关合并都可能改变模型所见的内容。

当前协议还改变了安全边界。在 2026-07-28 中，没有核心握手，也没有传输会话。仅以 `Mcp-Session-Id` 作为键来管理批准、限流或审计历史的安全设计，已不是当前的设计。

## 概念

### 值得检查的七个攻击面

用一个具体的清单替代“要小心”这类模糊指令。

1. **元数据投毒。** 描述中包含与声明的工具行为无关的指令。
2. **描述符“ rug pull”。** 先前已批准的名称、描述、schema 或注解发生变更。
3. **跨服务器遮蔽。** 两个后端暴露相同的非限定工具名，而路由静默地选择其一。
4. **头部与正文混淆。** `Mcp-Method` 或 `Mcp-Name` 与 JSON-RPC 请求不一致。
5. **能力升级。** 对端声称某扩展或客户端特性，而服务器将该声明误认为授权。
6. **MRTR 状态篡改。** 客户端修改 `requestState`、回答不同的问题，或复用确认但参数不同。
7. **供应链身份混淆。** 将熟悉的显示名称当作发布者或服务器身份的证明。

这些攻击面相互重叠。哈希固定有助于应对描述符变更，但无法证明最初的描述符是安全的。静态扫描能发现明显的短语，却难以发现隐晦的指令。命名空间可防止一类冲突，但无法防止恶意的带命名空间的服务器。必须叠加多种控制手段。

### 当前的请求信封是证据，而非身份

每个 2026-07-28 请求都包含：

```json
{
  "_meta": {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {
      "elicitation": {"form": {}}
    },
    "io.modelcontextprotocol/clientInfo": {
      "name": "security-lab",
      "version": "1.0.0"
    }
  }
}
```

在每个请求上验证版本与能力结构。用能力来选择兼容的响应结构。不要将 `clientInfo` 用作已认证的主体，它是自我声明的。

同样的警告适用于结果元数据中的 `io.modelcontextprotocol/serverInfo`。它对日志和调试有用，但不是证书、注册表证明或授权决定。

### 先验证路由，再执行策略

对于 `tools/call`，Streamable HTTP 包含：

```text
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.export
```

头部中的 method 必须等于正文中的 method。头部中的名称必须等于 `params.name`。在选择后端、应用 RBAC 或消耗限流令牌之前，应以 `-32020` 拒绝任何不一致。

这个顺序消除了一个常见的歧义：一个组件对正文授权，而另一个组件按头部路由。

线路验证遵循一个精确的顺序。先验证 JSON-RPC 与元数据类型，再比较头部值与正文，然后检查匹配的版本是否受支持。头部不匹配返回 HTTP 400 及 `-32020`。若头部与正文一致但版本不受支持，返回 HTTP 400 及 `-32022`，且 `data` 恰为 `{"supported":["2026-07-28"],"requested":"<actual>"}`。未知方法返回 HTTP 404 及 `-32601`。

当契约需要结构化恢复信息时，每个错误对象都包含可选的 `data`。通知没有 `id`，因此永远不会收到 JSON-RPC 成功或错误响应。被接受的 HTTP 通知返回 202 和空正文。

### 固定完整描述符

仅靠描述哈希会遗漏 schema 和注解的变更。对用户批准的描述符字段进行规范化并计算哈希：

```python
normalized = json.dumps(tool, sort_keys=True, separators=(",", ":"))
digest = hashlib.sha256(normalized.encode()).hexdigest()
```

将摘要存储在形如 `notes.export` 的限定键之下，并同时保存发布者证据与批准时间（超出本示例玩具范围）。

每次刷新时：

- 未知键：隔离，等待审查。
- 同一键、不同摘要：作为 rug pull 隔离，直至重新批准。
- 重复的非限定名称：要求确定性的命名空间。
- 扫描器命中：阻断并审查完整描述符。

哈希相等证明的是稳定性，而非安全性。一个被投毒的描述符即使被完美固定，依然是被投毒的。

### 静态扫描是绊线

简单的模式可以标记角色标签、指令覆盖、隐藏行为、秘密访问以及被混淆的网络目的地。它们足够廉价，可用于安装时和 CI。

它们不是语义证明。一条安全的描述可能在正当的警告中包含被标记的短语；一条恶意描述则可以避开所有短语。将扫描器输出视为审查证据，而非自动的无罪评分。

### 合并之前先加命名空间

假设两个服务器都暴露 `search`。绝不要让发现顺序决定谁胜出。

```text
notes.search
issues.search
```

限定名称即公开的网关名称。后端映射需单独记录。稳定的名称使批准、审计、哈希固定和 `Mcp-Name` 路由指向同一个对象。

### 能力是兼容性声明

每个请求的 `clientCapabilities` 告诉服务器客户端能够处理哪些协议特性。它并不授予客户端访问工具、数据或操作的权限。

授权仍然来自已认证的主体与资源策略。顺序是：

1. 认证传输凭证。
2. 验证版本、头部和请求结构。
3. 检查能力兼容性。
4. 授权主体、工具、资源和参数。
5. 执行或请求用户输入。

### 保护无状态的 MRTR 确认

有重要后果的工具可能需要用户确认。当前 MCP 使用 Multi Round-Trip Requests，而非服务器到客户端的回调。

第一次响应：

```json
{
  "resultType": "input_required",
  "inputRequests": {
    "confirm": {
      "method": "elicitation/create",
      "params": {
        "mode": "form",
        "message": "Export notes to archive?",
        "requestedSchema": {
          "type": "object",
          "properties": {
            "confirm": {"type": "boolean"}
          },
          "required": ["confirm"]
        }
      }
    }
  },
  "requestState": "opaque-integrity-protected-value"
}
```

客户端获取输入后，用新的 JSON-RPC id 重试原方法：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "notes.export",
    "arguments": {"query": "private", "destination": "archive"},
    "requestState": "opaque-integrity-protected-value",
    "inputResponses": {
      "confirm": {
        "action": "accept",
        "content": {"confirm": true}
      }
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "elicitation": {"form": {}}
      }
    }
  }
}
```

每个 `inputRequests` 值都是一个完整的嵌入式请求，带有 `method` 和 `params`。其 key 必须与 `inputResponses` 中对应的条目匹配。表单征询使用以对象为根的 `requestedSchema`，且客户端必须在服务器请求之前已声明表单征询能力。

当前能力有两种合法的表单声明。`{"elicitation":{}}` 隐式支持表单征询，而 `{"elicitation":{"form":{}}}` 显式声明之。仅 URL 的声明（如 `{"elicitation":{"url":{}}}`）不支持表单请求。此时服务器返回 HTTP 400 及 `-32021`，且 `data.requiredCapabilities` 等于 `{"elicitation":{"form":{}}}`。

将 `requestState` 视为敌对输入。对其进行签名或加密、验证，并在重放有影响时将其绑定到方法、工具、精确参数、目的、有效期、主体和一次性 nonce。课程代码使用 HMAC 和精确参数匹配来使这一边界可见。

nonce 账本绝不能存放在单个网关对象内部。可运行模型注入了一个有界的、按 TTL 修剪的重放存储，可由多个网关实例共享。其原子认领即执行边界：只有经过验证的接受或明确的终结性拒绝才消耗状态。格式错误的响应或 `cancel` 不执行任何操作，并在到期前保持可重试。生产环境需要在共享持久存储中实现同样的条件认领。

不要将隐藏的确认上下文存储在协议会话中。任何服务器实例都应能验证重试。

### 高风险调用的“两条规则”

沿三个维度对调用分类：

- 它消费不可信输入。
- 它能访问敏感数据。
- 它造成有后果的外部操作。

单个自动步骤不应同时兼具三者。应拆分它、降低权限，或通过 MRTR 请求明确的用户输入。这是一个设计启发式，而非协议能力。

### 在执行之前削减权限

仅有无状态并不等于安全。它移除了隐藏的协议历史，但一个自包含的请求仍然可以让一个权限过大的处理程序泄露数据或做出不可逆的更改。安全来自在每个边界上削减权限：

1. **类型化动词。** 只暴露一个有界操作，如 `archive_note`，而不是能表达无关能力的通用 `run` 或 `request` 工具。
2. **经验证的参数。** 在可行时使用封闭 schema，拒绝未知字段，统一规范化一次标识符，限制大小，并在策略评估前验证目的地、租户和资源所有权。
3. **当前授权。** 将已认证主体绑定到精确的动词、资源、环境和规范化参数。工具注解与客户端能力不授予此权限。
4. **绑定操作的批准。** 对于有后果的调用，将批准绑定到类型化动词与规范化参数的摘要，外加主体、有效期和一次性策略。任何字段的变更都需要新的决策。
5. **一等公民式拒绝。** 将拒绝、批准过期、用户拒绝和不安全目的地建模为不执行任何副作用的普通结果。不要将拒绝转换为较弱的回退工具。
6. **脱敏的审计证据。** 记录谁发起请求、使用了哪个已准入的描述符与策略版本、授权了哪个规范化目标、决策为何允许或拒绝，以及执行是否开始。存储摘要或脱敏值而非秘密。

每一步都在收窄下一个组件可以做的事。最终处理程序应接收一个已验证的领域命令，而非原始模型文本加宽泛凭证。在 MRTR 重试、任务更新或网关转发的调用上，重复执行整条链。早先的批准不会把后续请求变成可信的会话流量。

### 当前与遗留的交互路径

Roots、Sampling 与 Logging 对于新的 2026-07-28 实现已弃用。网关仅可作为版本门控的兼容路径保留旧的请求通道代码。

不要围绕每会话的 sampling 限流器构建新的防御。将配额应用于已认证主体、签发者、资源、工具和时间窗口。对于当前的交互式工作，请检查 MRTR 输入请求与响应。

### 无状态传输检查

- 在唯一的 POST 端点接受现代 MCP 消息。
- 对现代 GET 和 DELETE 返回 405。
- 不要铸造或依赖 `Mcp-Session-Id`。
- 忽略遗留会话与重放头，不将其作为授权输入。
- 为该 POST 返回 JSON 或请求作用域的 SSE。
- 仅对选择加入的长期变更通知使用 `subscriptions/listen`。

```figure
tp-tool-poisoning
```

## 动手实现

`code/main.py` 实现了一个小的进程内安全网关模型。它规范化并固定完整工具描述符，报告元数据投毒与遮蔽，验证现代请求信封与路由值，并执行两轮确认导出，包含签名的 `requestState` 和注入的共享重放存储。

该模型在 HTTP 适配器已解析 JSON 正文和路由头之后启动。它不验证 `Content-Type` 或 `Accept`。将同一调度器连接到第 09 课的完整 Streamable HTTP 适配器，后者要求 `Content-Type: application/json` 以及一个同时包含 `application/json` 和 `text/event-stream` 的 `Accept` 值。

运行它：

```bash
cd phases/13-tools-and-protocols/15-mcp-security-tool-poisoning
python3 code/main.py
python3 -m unittest discover code/tests -v
```

示例刻意篡改了一个描述符。扫描器与摘要比较会产生独立的发现。随后导出演示了 `input_required` 响应与无状态重试。

## 使用它

用你自己已批准服务器的规范化快照替换 `SAFE_TOOLS`。不要将凭证与秘密放入快照。在更新其摘要之前，审查每个新增或变更的描述符。

在网关处，于发现时和分发前各执行一次相同的检查。缓存可以减少发现工作，但缓存的批准必须在描述符变更时过期或失效。

## 交付

本课交付 `outputs/skill-mcp-threat-model.md`。它生成一个涵盖元数据、路由、能力、授权、MRTR、缓存、注册表与兼容性边界的当前协议威胁模型。

## 练习

1. 将已认证主体与当前授权决策绑定到密封的 MRTR 状态，然后拒绝来自不同主体的重试。
2. 将内存中的重放存储替换为持久化的条件插入，并证明两个进程不能同时认领同一个 nonce。
3. 在重放认领之后、模拟导出之前注入一个故障。定义并测试使恢复安全的交易或幂等规则。
4. 修改某工具的 `inputSchema` 但不改其描述。确认整描述符固定能捕获它。
5. 增加一条策略：当 `tools/list` 因主体不同而不同时，拒绝公开缓存。
6. 在网关后建模一个较旧的服务器。将所有握手与会话行为置于显式的 `2025-11-25` 兼容分支之后。

## 关键术语

| 术语 | 含义 |
|------|---------|
| 元数据投毒 | 嵌入在工具描述符中的指令或欺骗性声明 |
| Rug pull | 先前已批准的描述符发生变更 |
| 工具遮蔽 | 由重复的非限定名称引起的歧义路由 |
| 头部不匹配 | 路由头与 JSON-RPC 正文不一致，错误 `-32020` |
| 哈希固定 | 完整已批准描述符的摘要 |
| MRTR | 用于服务器请求输入的无状态响应与重试模式 |
| `requestState` | 必须视为不可信输入的不透明往返值 |
| 能力声明 | 协议兼容性声明，而非授权 |
| 隐式表单支持 | 空的 `elicitation` 能力对象，等价于表单支持 |
| 限定工具名 | 稳定的网关名称，如 `notes.search` |

## 延伸阅读

- [MCP 安全与信任指南](https://modelcontextprotocol.io/specification/2026-07-28#security-and-trust--safety)
- [Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [Streamable HTTP 传输](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [已弃用特性](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)