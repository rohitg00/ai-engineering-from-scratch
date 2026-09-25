# MCP 一致性工程：版本化、证据与运维

> 一个服务端不能因为它在单一 SDK 下的正常路径通过了测试就称为一致（conformant）。一致性存在于传输线上、版本边界处、经由中间代理的路径中，以及回滚期间。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13 · 09（传输层）、Phase 13 · 17（网关）、Phase 13 · 30（Registry 准入）
**Time:** 约 100 分钟

## 学习目标

- 将 MCP 的规范性规则转化为正向（golden）与反向（negative）线上传输记录。
- 将严格的 `2026-07-28` 行为与有界的旧版回退逻辑分开。
- 区分增量式未知字段与无效的未知 `resultType`。
- 将原始 JSON-RPC 证据与 SDK 归一化后的视图进行对比。
- 通过真实的代理边界证明头部与请求体的完整性。
- 以脱敏后的传输记录、健康与回滚证据作为发布门禁。

## 问题所在

你的客户端通过 SDK 调用 `tools/list` 并获取到工具列表。集成测试通过了。

但这一结果留下了许多未回答的问题：

- 请求是否携带了现代的按请求协议元数据？
- `MCP-Protocol-Version`、`Mcp-Method` 与 `Mcp-Name` 是否与 JSON-RPC 请求体一致？
- 响应在传输线上是否包含有效的 `resultType`，还是由 SDK 合成出来的？
- 客户端是否会保留未来的增量式字段？
- 一个已被识别的现代错误是否会意外触发旧版握手？
- 代理是否保留了源站的 HTTP 状态码与 JSON-RPC 错误？
- 通知序列化器是否发出了被禁止的响应？
- 运维能否在不存储密钥的情况下证明一次发布为何被提升或回滚？

一致性是一组可观测的不变量。构建一个测试工具（harness），在生产流量被迫发现这些问题之前先捕获这些不变量。

```figure
mcp-conformance-operations
```

## 从版本时代入手

MCP `2026-07-28` 使用自包含的按请求元数据。现代请求携带 `params._meta.io.modelcontextprotocol/protocolVersion` 与 `params._meta.io.modelcontextprotocol/clientCapabilities`。带命名空间的确切键名至关重要；裸的 `protocolVersion` 或 `clientCapabilities` 别名是格式错误的。当 HTTP 边界上存在镜像路由头部时，其值必须与 JSON-RPC 请求体一致。现代成功结果携带 `resultType`。

`2025-11-25` 及之前的版本使用早期的初始化时代。缺少 `resultType` 的旧版结果，只有在客户端已选定该早期时代后才被解释为完整。

不要创建一个同时接受两种形态的宽松验证器。应使用两个分支：

| 分支 | 入口证据 | 缺少 `resultType` | 初始化 |
|---|---|---|---|
| 现代 | 成功的 `server/discover` 或被识别的现代响应 | 无效 | 非默认路径 |
| 旧版 | 已配置的允许列表，加上在现代探测不确定之后观察到的有效旧版 `initialize` 结果 | 解释为完整 | 该时代所必需 |

这种分离可以防止一个格式错误的现代对端以更宽松的验证被放行。

### 严格模式（Strict mode）

严格模式要求提供现代行为的证据。一次成功的 `server/discover` 即证明现代分支。一个被识别的现代 JSON-RPC 错误同样可以证明它。此时应修正请求或停止。绝不要因为服务端返回了 `-32020`、`-32021` 或 `-32022` 就降级。

### 回退模式（Fallback mode）

回退模式执行一次有界的现代探测。超时、空回复、连接关闭或无法识别的响应属于“不确定”。它并不能证明对端是旧版的。只有被显式配置或列入允许列表以支持兼容性的端点，才可能随后接受一次有界的旧版探测，并且客户端只有在验证该探测的 `initialize` 结果与协商出的旧版修订号之后，才选择旧版分支。

回退绝不是“出现任何错误后就尝试旧版”。一个被识别的现代错误包含有用的修正信息。在此之后降级可能会掩盖头部不匹配、缺失能力声明或不支持的版本。

这可以防止攻击者、故障或过滤代理通过丢弃现代响应来强制降级。将端点策略、不确定的现代观测结果、确切的正向旧版证据以及所选时代一并记录。

在每个传输记录旁边记录所选时代。缺少这一事实，一个缺失的字段可能在一次测试运行中看起来可接受，而在另一次中却无效。

## 构建传输记录语料库

传输记录 fixture 记录的是跨越边界的内容，而不仅是 SDK 调用：

```json
{
  "name": "golden-modern-list",
  "era": "modern",
  "headers": {
    "MCP-Protocol-Version": "2026-07-28",
    "Mcp-Method": "tools/list"
  },
  "request": {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {
      "_meta": {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {}
      }
    }
  },
  "responseStatus": 200,
  "responseBody": {
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
      "resultType": "complete",
      "tools": []
    }
  }
}
```

保留两类 fixture。

### 正向传输记录（Golden transcripts）

正向传输记录证明被接受的行为：

- 元数据与头部相匹配的现代发现或方法请求
- 包含必需字段的完整结果
- 当方法可以请求更多输入时的 `input_required` 结果
- 仅在相应能力被通告之后的扩展（extension）结果
- 缺少 `resultType` 的旧版结果，但仅限于选定的旧版时代内
- 不产生 JSON-RPC 响应的通知处理

正向传输记录应当精确，而不是庞大。将易变的 ID 与时间戳设为确定性的，或在比较前将其归一化。

### 反向传输记录（Negative transcripts）

反向传输记录证明拒绝行为：

- 头部与请求体不匹配
- 缺失按请求能力
- 不支持的不匹配协议版本
- 缺少现代的 `resultType`
- 未知或未通告的 `resultType`
- `2.0` 以外的响应 `jsonrpc`，或 ID 在数值或 JSON 类型上不一致
- 同时包含 `result` 与 `error`、或二者皆无的响应
- 缺少整数 `code` 与字符串 `message` 的错误
- 已知协议错误被映射到错误的 HTTP 状态码
- 针对通知发出的响应
- 格式错误的 JSON-RPC 信封
- 代理将协议错误折叠为通用错误

对于每个反向用例，断言其拒绝边界和稳定的错误码。“调用失败了”太弱了。一个由代理生成的 500 和一个来自源站的 `-32020` 可能都表现为失败，但它们向运维讲述的是完全不同的故事。

头部不匹配 fixture 必须包含服务端实际的 HTTP 400 JSON-RPC 响应，带有匹配的请求 ID 和错误码 `-32020`。每当本地验证器观测到 `HeaderMismatch` 时，都应自动强制执行这一断言；不要将响应验证设为可选的 fixture 标志。HTTP 500 且无响应体的用例即使本地拒绝码正确也应判定失败。一个在自己的请求验证器抛出异常后就停止的测试工具，只测试了它自己，而没有测试服务端的线上行为。

官方的 MCP 一致性项目可作为外部测试套件和带版本号的参考。同时也保留你自己的本地传输记录。它们捕捉了你的代理、SDK、认证、扩展与发布路径，而通用套件无法了解这些内容。

## 头部值必须与 RPC 请求体一致

在现代 Streamable HTTP 中，中间代理可以使用镜像头部进行路由或策略执行。JSON-RPC 请求体仍然是协议事实的来源。不匹配属于完整性失败，而不是用来挑选某个值的提示。

按以下顺序进行验证：

1. 解析并验证 JSON-RPC 信封与元数据类型。
2. 比较 `MCP-Protocol-Version` 与 `params._meta.io.modelcontextprotocol/protocolVersion`。
3. 比较 `Mcp-Method` 与 `method`。
4. 当方法带有路由名称时，比较 `Mcp-Name` 与请求体中对应的值。
5. 在等价性确立之后，再判定不匹配的版本与能力集是否受支持。

这一顺序将不匹配的 `-32020` 与不受支持的版本 `-32022` 区分开来。它还能阻止网关依据头部名称进行授权、而源站却执行请求体中另一个名称的情况。

HTTP 字段名不区分大小写，而字段值仍然区分大小写。在查找之前先对头部名称做归一化，并拒绝冲突的重复项。对于不安全的、非 ASCII 的或首尾含空白字符的 `Mcp-Name`，先解码确切的 `=?base64?{Base64EncodedValue}?=` UTF-8 哨兵再与请求体比较。对于不完整的哨兵、无效的 Base64、无效的 UTF-8 或原始的不安全值，使用 `-32020` 拒绝。即使请求体包含相同的字符，原始的周围空白也是无效的，因为该值在传输前必须经过哨兵编码。

中间代理可能在请求到达 MCP 服务端之前就拒绝格式错误的 HTTP，因此其失败可能是没有 JSON-RPC 的 HTTP 错误。要记录拒绝是来自中间代理还是源站。源站的 MCP 服务端在处理了有效的 JSON-RPC 请求时，应使用协议错误契约。

## 未知字段不等于未知结果

前向兼容性需要两条不同的规则。

### 增量式未知字段

Result 对象和 `_meta` 映射可以获得新字段。除非该字段违反了保留契约，验证器应根据其角色来保留或忽略增量字段。示例将完整的原始结果保留在证据中，并在已知结果旁边接受 `futureHint`。

如果你是一个透明代理，保留未知字段通常比剥离它更安全。如果你是应用客户端，忽略它也可能是合法的。你的差分测试仍应揭示 SDK 将其省略了，从而使这一行为是有意为之。

### 未知 `resultType`

`resultType` 是一个判别器（discriminator）。核心的现代结果使用 `complete` 或 `input_required`。扩展只有在相应能力被通告后才能添加另一个值。例如，Tasks 扩展可以在该协商能力上下文中添加 `task`。

未知或未通告的判别器不能被安全地当作完整结果处理。客户端并不知道它将要丢弃的是什么生命周期。应拒绝它。

因此，同一个原始响应可以同时包含一个可接受的未知字段和一个不可接受的未知结果类型。两类情况都要测试。

判别器只是第一层。之后还需验证方法特定的载荷。一个完整的 `tools/list` 结果需要 `tools` 数组，其描述符具有唯一且非空的名称、有用的描述以及以对象为根的 `inputSchema` 值。一个 `task` 结果仅对启用了 Tasks 能力且符合条件的 `tools/call` 有效，并且要求 `taskId`、已知状态、创建与更新时间戳以及 `ttlMs`，外加一个有效的可选轮询间隔。一个完整的 `completion/complete` 结果需要一个 `completion` 对象，其中字符串值不超过 100 个，可选的非负整数 `total` 不得小于返回的值的数量，以及可选的布尔值 `hasMore`。拼写正确的 `resultType` 无法使格式错误的载荷变为一致。

## 通知不变量

JSON-RPC 通知没有 `id`。接收方绝不能发送 JSON-RPC 的成功或错误响应。

对于被接受的 HTTP 通知形态，测试工具期望收到主体为空的 HTTP `202`。MCP `2026-07-28` 在 Streamable HTTP 上没有定义任何核心的客户端到服务端通知。示例仅使用一个带命名空间的课程扩展通知来测试单向序列化器不变量。不要将其呈现为新的核心方法。

要测试序列化器，而不仅仅是处理程序。处理程序可能返回 `None`，而中间件却将其包装进一个 JSON 成功对象中。要捕获最终的出口字节。

## 加入 SDK 差分

SDK 常常把线上对象转换为便捷的语言原生类型。这很有用，但归一化后的对象无法证明实际接收到了什么。

对每一个高风险 fixture，捕获：

1. SDK 解码前的原始状态码、头部与响应体。
2. SDK 归一化后的返回值或异常。
3. 针对所选时代的预期语义投影。
4. 被 SDK 提升、合成、剥离或改变的字段。

示例在比较应用载荷时，允许 SDK 专门移除已知的线上簿记字段，例如 `resultType`、`_meta`、`ttlMs` 与 `cacheScope`。同时它会报告被丢弃的 `futureHint`，因为该未知语义字段消失了。

不要假设每一个差异都是 SDK 的 bug。重点是让转换可见。判断你的组件是应用端点（可以忽略增量字段），还是透明中间代理（应当保留它）。

针对你发布的每一个 SDK 与版本运行差分测试。如果两个 SDK 对同一份传输记录的归一化结果不同，发布策略应明确哪种行为是可接受的，而不是事后选择最方便的输出。

## 捕获代理证据

大多数生产环境的 MCP 故障发生在不止一个进程之间。记录三种视图：

| 视图 | 最低证据要求 |
|---|---|
| 入口（Ingress） | 请求头部、JSON-RPC 请求体、content type、经过认证的路由、接收时间 |
| 源站（Origin） | 转发的头部与请求体摘要、源站状态码、响应头部与响应体 |
| 出口（Egress） | 客户端可见的状态码、头部、请求体与发送时间 |

示例会检测两种常见的转换：

- 源站的 HTTP 400 或 404 JSON-RPC 错误被替换为通用的代理 500
- 出口的 JSON-RPC 请求体与源站请求体不一致

为 content type、`Accept`、压缩、请求级 SSE、缓存头部与 trace 关联添加部署特定的断言。在策略允许时捕获 TLS 终止的两侧。绝不要为了证明路径而记录凭证。

## 在证据离开内存之前先脱敏

脱敏是一致性运维的一部分，而不是事后的清理工作。在序列化、哈希、日志、测试工件或失败上报之前应用它。

示例对键名进行大小写折叠并移除分隔符后再匹配，然后递归地替换以下键下的值：`Authorization`、`Cookie`、`Set-Cookie`、`X-Api-Key`、`accessToken`、`clientSecret`、`registrationAccessToken`、`token`、`password`、`secret` 与 `api_key`。规范化与拒绝列表必须使用同一形式，这样 camelCase、连字符、下划线与点号等变体才不能绕过彼此的策略。生产环境的采集器还应添加方法特定的参数策略，因为像 `query` 这样看似无害的键仍然可能包含个人或受监管的数据。

对脱敏后的证据包进行哈希。只有当某次特定调查需要时，才将原始捕获保存在经批准的短期存储系统中。摘要可以证明是哪个脱敏后的数据包驱动了决策，但不会泄露被移除的值。

## 将健康与回滚纳入发布门禁

协议一致性是必要条件，但不足以进行发布。一个一致的候选版本仍然可能超时、泄漏内存或使依赖过载。

在上线之前定义健康窗口：

- 最小样本数
- 最大错误率
- 最大延迟百分位
- 饱和度或资源限制
- 观测时长
- 与已准入基线的比较

同样在上线之前定义回滚证据：

- 确切的先前版本
- 准入证据摘要
- SHA-256 工件与描述符 pin
- 当前 Registry 状态
- 当前健康结果
- 路由恢复流程
- 来自可信发布控制器身份、覆盖这些确切字段的证明（attestation）

要求回滚目标在提升（promotion）之前、而不仅是在候选版本失败之后，已被验证且处于健康状态。一个没有可用恢复路径的成功发布并不算生产就绪。

如果候选版本失败而回滚目标缺少该证据，则应保留流量而不是猜测。“回滚到当时随便什么东西”不是一种运维控制手段。

不要将就绪性简化为真值检查，例如非空版本号、`healthy: "yes"` 或任意证据字符串。示例要求确切的类型、活跃状态、三个 SHA-256 摘要、可信签名者，以及覆盖完整回滚载荷的有效 HMAC-SHA-256 证明。其确定性的演示密钥是非机密的 fixture。在生产环境中，应在发布边界注入受保护的密钥、KMS 验证结果或公钥证明验证器。

发布门禁还会拒绝为空的传输记录、SDK 差分或代理证据。每个证据源都必须携带有效的证据摘要。绿色的健康窗口无法弥补一个从未被观测到的边界。

## 构建它

运行标准库测试工具：

```bash
cd phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations
python3 code/main.py
```

该演示精确地运行十五个正向与反向传输记录，包括有效与格式错误的补全（completion）结果，比较原始结果与 SDK 视图，检查一个折叠了源站错误的代理，评估健康，认证回滚证据，并选中该目标。

预期形态：

```json
{
  "transcriptsPassed": 15,
  "transcriptsTotal": 15,
  "sdkDroppedFields": ["futureHint"],
  "proxyIssues": [
    "proxy collapsed a protocol error into HTTP 500",
    "proxy changed the origin JSON-RPC body"
  ],
  "releaseAction": "rollback",
  "evidenceDigest": "..."
}
```

按以下顺序阅读 `code/main.py`：

1. `validate_request()` 强制执行特定于时代的请求与头部规则。
2. `validate_result()` 区分缺失的旧版判别器、有效的现代值、扩展与未知值。
3. `select_era()` 实现严格模式与有界回退策略。
4. `run_transcript()` 评估正向与反向 fixture。
5. `compare_sdk_view()` 暴露归一化差异。
6. `inspect_proxy()` 比较入口、源站与出口证据。
7. `redact()` 在证据哈希之前移除明显的机密信息。
8. `rollback_evidence_ready()` 验证确切的 pin 字段与可信发布证明。
9. `ReleaseGate.evaluate()` 汇集非空的一致性、SDK、代理、健康与回滚证据。

## 使用它

在四个节点运行该工具：

1. 在每次实现变更时，配合进程内测试适配器。
2. 针对构建出的客户端与服务端二进制文件，通过真实传输层运行。
3. 在预发（staging）环境中通过已部署的代理或网关运行。
4. 在灰度发布期间，配合实时健康与回滚证据运行。

在各层之间保持相同且稳定的用例名称。`negative-header-body-mismatch` 在单元测试、端到端测试、代理与灰度报告中应代表同一不变量。证据摘要会因边界不同而不同；但需求不应当改变。

将 fixture 模式存储在版本控制中。将脱敏后的运行证据存储在发布系统中。只有在事件访问控制之下，才短期存储原始捕获数据。

## 交互式实验

### 实验 A：证明时代边界

从 `code` 目录打开 Python：

```bash
cd phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/code
python3 -q
```

运行：

```python
from main import *
validate_result({"tools": []}, "legacy")
validate_result({"tools": []}, "modern")
```

旧版调用会推断出 `complete`。现代调用会抛出 `ProtocolViolation`。现在测试回退：

```python
select_era({"kind": "timeout"}, "fallback")
select_era(
    {"kind": "timeout"},
    "fallback",
    legacy_allowed=True,
    legacy_evidence={"kind": "initialize_success", "protocolVersion": LEGACY_VERSION},
)
select_era({"kind": "jsonrpc_error", "code": -32021}, "fallback")
```

第一次超时采取失败关闭（fail closed）策略，因为沉默并不是旧版的证据。第二次调用之所以选择旧版，仅仅因为配置允许它，并且观察到了有效的旧版初始化结果。被识别的缺失能力错误证明了现代分支。

### 实验 B：增量字段对比判别器

```python
validate_result({"resultType": "complete", "tools": [], "futureHint": True}, "modern")
validate_result({"resultType": "future_mode", "tools": []}, "modern")
```

第一个结果保留了 `futureHint`。第二个被拒绝，因为生命周期判别器是未知的。

### 实验 C：检查一次 SDK 转换

```python
compare_sdk_view(
    {"resultType": "complete", "tools": [], "futureHint": {"mode": "new"}},
    {"tools": []},
)
```

判断你的组件是可以忽略 `futureHint`，还是必须转发它。将这一决定写进发布策略。不要无声地抹掉该差分。

### 实验 D：修复代理

修改演示交换，使出口保留源站的状态码与请求体。再次运行 `python3 main.py`。代理问题应当消失，但 SDK 差分仍会阻止提升。然后将 `futureHint` 包含进 SDK 视图，并观察当所有证据源都通过时，动作如何变为 `promote`。

## 练习实验

为测试工具添加请求级 SSE 传输记录。

要求：

- 捕获响应状态码、content type、有序的 SSE 事件以及流的终止。
- 证明每个 JSON-RPC 事件具有有效的特定于时代的结果或错误。
- 为代理在转发前缓冲整个流的情形添加反向用例。
- 为 JSON-RPC id 与请求不一致的 SSE 事件添加反向用例。
- 在写入证据之前对事件数据进行脱敏。
- 在健康窗口中包含流时长、首个事件延迟以及事件数量。
- 使发布门禁仅在流失败时选择有证据支持的回滚目标。

成功的标准是：同一个用例可以直接运行也可以通过代理运行，并且报告能识别出行为发生改变的确切边界。

## 交付工件

本课程交付 `outputs/skill-mcp-conformance-release-gate.md`。使用它将服务端、客户端、网关或 SDK 的变更转化为带版本号的一致性矩阵和发布决策。该工件要求原始线上证据、反向用例、显式的时代选择、SDK 差分、代理证明、脱敏、健康阈值以及回滚证据。

## 验证它

运行演示与确定性测试套件：

```bash
cd phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

验证应证明：

- 每个包含的正向与反向传输记录都达到了预期的结果
- 现代请求要求确切的带命名空间元数据键
- HTTP 头部名称不区分大小写地匹配，且编码后的 `Mcp-Name` 值被精确解码
- 头部与请求体不匹配返回现代的不匹配错误码
- 响应版本、ID、结果或错误的互斥性、错误形态与 HTTP 映射均经过验证
- 方法特定的工具列表（tool-list）、任务（task）与补全（completion）载荷要求被强制执行
- 每次观测到的 `HeaderMismatch` 都要求存在实际的 HTTP 400 JSON-RPC `-32020` 响应
- 原始的 `Mcp-Name` 空白被拒绝，而精确哨兵编码的空白可以正确往返
- 缺失的 `resultType` 仅在选定的旧版时代内有效
- 增量字段在原始验证中得以保留，而未知结果类型则失败
- 扩展结果类型要求其已通告的能力
- 被识别的现代错误绝不会导致旧版回退
- 通知不产生 JSON-RPC 响应
- SDK 簿记字段移除与语义字段丢失被区分开
- 代理错误折叠被检测到，且凭证在 camelCase 与分隔符变体之间被递归脱敏
- 提升要求非空的传输记录、SDK、代理与健康运维证据
- 提升与回滚都要求一个已认证、已 pin、处于活跃且健康的回滚目标

## 生产故障模式

| 故障 | 弱测试报告的内容 | 测试工具必须证明的内容 |
|---|---|---|
| SDK 合成了缺失的判别器 | “tools/list 通过” | 原始现代结果缺少 `resultType`，因此无效 |
| 客户端在 `-32021` 之后降级 | “旧版重试有效” | 被识别的现代错误禁止回退 |
| 未知结果类型被当作完整结果 | “响应已解析” | 未通告的生命周期判别器被拒绝 |
| 代理授权了一个工具而源站执行了另一个 | “请求到达服务端” | `Mcp-Name` 在每一跳都等于请求体中的路由名称 |
| 测试工具在读取服务端响应之前抛出异常 | “头部不匹配测试通过” | HTTP 400 与 JSON-RPC `-32020` 响应被捕获并经过验证 |
| 代理将源站 400 转为通用 500 | “上游错误” | 源站与出口的状态码及 JSON-RPC 请求体被保留 |
| 通知中间件发出 `{result: null}` | “处理程序返回了 none” | 最终出口请求体为空，且不存在任何 JSON-RPC 响应 |
| SDK 剥离了增量字段 | “类型化对象一致” | 原始视图与归一化视图显示出被丢弃的确切字段 |
| 失败工件泄露了 bearer token | “调试包已上传” | 脱敏发生在哈希、日志或上传之前 |
| 凭证键风格绕过了脱敏 | “拒绝列表包含 api_key” | CamelCase 与分隔符变体共享同一种规范拒绝列表形式 |
| 灰度没有样本却看起来健康 | “零错误” | 最小样本数被强制执行 |
| 回滚选中了未知构建 | “之前的部署已恢复” | 目标版本、准入摘要、pin、状态与健康信息均已具备 |

## 运维准则

测试你发送的字节、每一个中间代理转发的字节、每个 SDK 暴露的语义，以及运维在压力下会使用的证据。兼容性是一个显式的分支。回滚是一个有证据支撑的发布动作。二者都不应当是宽松解析器产生的意外副作用。

## 延伸阅读

- [MCP 2026-07-28 基础协议](https://modelcontextprotocol.io/specification/2026-07-28/basic)
- [MCP 版本协商](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [官方 MCP 一致性项目](https://github.com/modelcontextprotocol/conformance)