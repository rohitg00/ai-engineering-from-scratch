# MCP 工具契约与内容

> 只有当发现、参数、结果、分页与传输元数据都遵循同一契约时，工具才可以安全地自动化。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13, Lessons 07、09 和 10
**Time:** ~120 minutes

## 学习目标

- 使用 JSON Schema 2020-12 定义工具的输入与输出。
- 在不假设结构化结果是 JSON 对象的前提下验证它们。
- 在文本、图像、音频、资源链接与内嵌资源之间做出选择。
- 在工具接触模型之前拒绝不安全的 `x-mcp-header` 定义。
- 对参数头字段值进行编码，并验证头字段与请求体的精确一致性。
- 遍历游标分页，而不解读游标值。
- 对 `completion/complete` 建议进行限定与授权。

## 问题所在

调用一个 Python 函数很容易。通过 AI 宿主调用一个远程能力则是契约问题。

服务端发布描述符。客户端将该描述符转化为模型上下文和用户界面。模型生成参数。网关可能依据镜像头字段路由请求。服务端执行工具。随后，客户端决定结果是否足够安全、有效，可以返回给模型。

一个薄弱的边界会破坏整条链路。

考虑五种故障：

- 描述符声称结果是对象，但服务端返回了数组。
- 当 `nextCursor` 为空字符串时，客户端停止了分页。
- 一个令牌参数被镜像到 HTTP 头字段中，对中间方可见。
- 一个 Unicode 路由值被作为原始头字段发送，随后网关与源站对字节的理解不一致。
- 补全端点向无法访问生产环境的调用者建议了生产环境。

这些问题都无法靠更好的提示词修复。它们需要明确的协议契约与应用契约。

## 契约流水线

将每次工具调用视为五道闸门：

1. **发现。** 读取确定性的、分页的工具列表。
2. **准入。** 验证每个描述符并应用本地安全策略。
3. **调用。** 验证参数并构建传输元数据。
4. **执行。** 运行处理程序并正确分类失败。
5. **消费。** 在供模型使用前验证内容块与结构化输出。

```figure
mcp-contract-pipeline
```

宿主拥有准入与消费这两道闸门。服务端无法强迫客户端信任其注解、模式或输出。

## JSON Schema 是运行时边界

在 MCP `2026-07-28` 中，`inputSchema` 与 `outputSchema` 使用 JSON Schema。当 `$schema` 缺失时，默认方言为 2020-12。

输入模式必须是一个模式对象。即使工具没有参数，也应准确说明它接受什么：

```json
{
  "type": "object",
  "additionalProperties": false
}
```

这比 `{ "type": "object" }` 更严格，后者接受任意属性。

输出模式是可选的。一旦服务端发布了输出模式，每个完整的工具
结果都必须承诺返回符合该模式的 `structuredContent`，包括带有 `isError: true` 的结果。错误标志用于分类执行结果；它并不
豁免已发布的输出契约。客户端应当验证结果，而不是
信任描述符。

### 结构化内容是任意 JSON 值

不要把 `structuredContent` 硬编码为字典。它可以是：

- 对象；
- 数组；
- 字符串；
- 数字；
- 布尔值；
- `null`。

这个工具返回一个数组：

```json
{
  "name": "tag_catalog",
  "inputSchema": {
    "type": "object",
    "additionalProperties": false
  },
  "outputSchema": {
    "type": "array",
    "items": {"type": "string"}
  }
}
```

它的成功结果是有效的：

```json
{
  "resultType": "complete",
  "content": [
    {
      "type": "text",
      "text": "[\"contracts\", \"mcp\", \"stateless\"]"
    }
  ],
  "structuredContent": ["contracts", "mcp", "stateless"],
  "isError": false
}
```

为了兼容性，结构化结果还应在文本块中包含序列化后的 JSON。该文本不是验证依据。`structuredContent` 才是。

### 一个小型验证器仍能说明边界

本课刻意使用 JSON Schema 的一个子集，因为它保持在 Python 标准库之内。它检查示例工具所使用的机制：

- object、array、string、integer、number、boolean 与 null 类型；
- 必需属性；
- `additionalProperties: false`；
- 数组元素；
- 枚举值；
- 最小字符串长度。

这不能替代完整的生产行验证器。可复用的经验在于验证发生的位置：发现之后验证描述符，执行之前验证参数，消费之前验证结构化结果。

## 内容块承载不同的代价

`content` 数组可以组合多种内容类型。

| 类型 | 用途 | 主要边界 |
|------|------|----------|
| `text` | 人类与模型可读的摘要 | 将文本视为不可信输出 |
| `image` | 以 base64 编码的视觉证据 | 验证媒体类型与大小 |
| `audio` | 以 base64 编码的语音或录音输出 | 验证媒体类型与时长限制 |
| `resource_link` | 客户端稍后可能抓取的 URI | 对之后的资源读取重新授权 |
| `resource` | 直接嵌入结果中的数据 | 现在即强制负载数与内容限制 |

资源链接并不能证明该资源出现在 `resources/list` 中。它是本次工具调用返回的引用。客户端在跟随该 URI 时仍会应用其资源策略。

内嵌资源避免了额外一轮往返，但会增大当前响应的体积。对大型或独立变更的制品使用链接。对必须随结果原子性传输的小型证据使用内嵌资源。

本课的 `evidence_bundle` 结果包含全部五种类型。客户端在接受结果之前会验证每个块。

## `x-mcp-header` 是路由元数据

`inputSchema` 内的属性可以声明 `x-mcp-header`。在 Streamable HTTP 之上，客户端会将该参数镜像到 `Mcp-Param-{name}` 中。

```json
{
  "region": {
    "type": "string",
    "x-mcp-header": "Region"
  }
}
```

使用 `region: "eu-west"` 时，传输层可以发出：

```http
Mcp-Param-Region: eu-west
```

该注解的存在是为了让负载均衡器、网关或策略引擎无需解析 JSON 请求体即可路由。它不是存放凭据的地方。

协议对该注解的约束包括：

- 头字段名称非空，且符合 HTTP 字段名 token 语法；
- 头字段名称在不区分大小写的情况下必须唯一；
- 属性类型为 string、integer 或 boolean；
- 不允许 `number`；
- 注解只能出现在 `inputSchema.properties` 的直接成员上；
- 整数值必须位于 `-9007199254740991` 至 `9007199254740991` 之间。

位置规则是语法性的且默认拒绝。要遍历整个模式树，
而不仅是验证器恰好理解的那些属性。拒绝出现在嵌套对象的 `properties` 下、`oneOf` 分支、`items` 中、
由 `$ref` 引用到的定义中，或任何输出模式中的注解。解析引用
并不会把被引用的节点变成直接的一级属性。

本课增加了一条部署策略：拒绝镜像诸如 `password`、`secret`、`token`、`api_key` 或 `authorization` 等名称的描述符。官方规范建议服务端作者不要镜像敏感参数。客户端可以将该建议转化为硬性的准入规则。

审计头字段名称，而不是其值。示例代码记录 `Mcp-Param-Region`，同时将 `eu-west` 排除在审计事件之外。

### 在构建 HTTP 头字段之前先对值编码

参数值只有在满足以下条件时才可作为纯文本传输：它是从 `!` 到 `~` 的可见 ASCII 字符组成的非空字符串，且不像编码哨兵。其余一切必须使用这一精确形式：

```text
=?base64?{Base64UTF8}?=
```

`Base64UTF8` 是对精确的 UTF-8 字节做标准 base64。不要事先修剪、
规范化或替换该值。对 Unicode、空字符串、空格、
制表符、控制字符、CR 或 LF、前导或尾随空白，以及任何以 `=?base64?` 开头的值进行编码。对看似哨兵的值再编码一次，
正是接收方能够恢复字面原文、而不是把它当作传输语法解码的原因。

布尔值渲染为小写的 `true` 或 `false`。整数以 10 进制渲染，
且必须处于 JavaScript 安全整数范围内。超出该范围的值会被拒绝，
而不是被中间方四舍五入。

### 服务端校验镜像副本

生成头字段只是客户端的一半。在 Streamable HTTP 边界上，服务端必须：

1. 在不区分头字段名大小写的情况下找到被识别的 `Mcp-Param-*` 名称；
2. 若存在则解码精确的 base64 哨兵形式；
3. 将解码后的文本与对应的 JSON 请求体参数做精确比较；
4. 在分发之前拒绝缺失、重复、意外、畸形或不匹配的被识别头字段。

该拒绝以 HTTP `400` 及 JSON-RPC 错误码 `-32020` 返回。请求体的值
或其编码后的头字段形式都不应进入审计记录。只记录被识别的头字段名称与拒绝类别。

`code/main.py` 直接建模了这一边界。[Lesson 09](../../09-mcp-transports/)
涵盖了更广泛的 Streamable HTTP 验证顺序，包括方法与协议版本的一致性。

## 分页游标是不透明的

MCP 列表操作使用游标分页。服务端决定页大小与游标格式。客户端只需做一个决定：

```python
if result.get("nextCursor") is None:
    break
cursor = result["nextCursor"]
```

不要这样写：

```python
if not result.get("nextCursor"):
    break
```

空字符串是合法的游标。真值判断会过早停止。

客户端不得解码游标、对其递增、与之前的游标比较顺序，或推断页码。服务端可以对游标签名、将其绑定到目录版本，或映射到私有状态。那是服务端的实现细节。

示例服务端刻意在第一页之后返回 `""`。客户端必须在第二个请求中原样发送该值。其轨迹为：

```text
<first request with no cursor>
<second request with cursor "">
```

无效的游标产生 JSON-RPC invalid params，错误码 `-32602`。

## 补全是授权面

`completion/complete` 为 prompt 参数与资源模板参数提供建议。它对交互式表单很有用，但可能泄露被普通列表方法保护的名称。

一次补全请求会指明一个引用以及正在补全的参数：

```json
{
  "method": "completion/complete",
  "params": {
    "ref": {
      "type": "ref/prompt",
      "name": "deployment_review"
    },
    "argument": {
      "name": "environment",
      "value": "st"
    }
  }
}
```

结果最多返回 100 个值，并可能报告 `total` 与 `hasMore`。

应用与被引用的 prompt 或资源相同的授权边界。示例中的分析员只能收到 `development` 与 `staging`。只有操作员才能收到 `production`。

生产环境中的补全还需要：

- 输入验证；
- 基于调用者的过滤；
- 客户端中的请求防抖；
- 服务端中的速率限制；
- 有界的结果数量；
- 不暴露敏感建议值的日志。

补全是辅助手段，不是发现绕过手段。

## 两层错误

将协议错误与工具执行错误分开。

当 MCP 请求无法正确分发时，使用 JSON-RPC 错误：

- 未知工具名称；
- 畸形的请求形状；
- 缺失请求元数据；
- 无效游标。

当调用已到达工具、且工具报告了可操作的失败时，使用带有 `isError: true` 的完整工具结果：

- 报告数据源不可用；
- 日期超出支持范围；
- 业务规则拒绝了所请求的操作。

模型通常可以修复工具执行错误。它们无法修复违反自身输出模式的服务端。

如果工具声明了输出模式，应把可操作的失败建模在该模式之内。示例中 `route_report` 的失败会返回其所请求的区域及 `accepted: false`，并附带人类可读的错误文本与 `isError: true`。

## 动手构建

`code/main.py` 使用 Python 标准库构建边界的两侧。

服务端实现：

- 每个请求的 MCP 元数据验证；
- 带有 tools 与 completions 能力的 `server/discover`；
- 确定性的 `tools/list` 分页；
- 四个工具描述符，其中包括一个必须被拒绝的；
- 数组结构化输出；
- 当前所有工具内容块类型；
- 一个 Streamable HTTP 一致性闸门，解码被识别的参数头字段，并在不匹配时返回 HTTP `400` 与 JSON-RPC `-32020`；
- 经授权且限速的补全。

客户端实现：

- 描述符准入；
- 全树的 `x-mcp-header` 位置验证与敏感字段策略；
- 精确的纯可见 ASCII 或 base64 UTF-8 值编码；
- 跟随空字符串的不透明游标循环；
- 参数与结果验证；
- 内容块验证；
- 只包含名称、不包含值的头字段审计事件。

那个刻意不安全的描述符是教学数据。它证明拒绝一个工具并不会妨碍有效工具的加载。

## 使用方式

在仓库根目录下运行：

```bash
cd phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content/code
python3 main.py
python3 -m unittest discover tests -v
```

该演示会打印被准入的工具、被拒绝的描述符、两个分页请求、
结构化数组内容、内容块类型、镜像头字段的名称、
值是否需要编码、HTTP 一致性状态，以及经调用者过滤的补全值。

## 交互实验

打开 `code/main.py` 并找到 `TOOLS`。

1. 将 `tag_catalog.outputSchema.type` 从 `array` 改为 `object`。
2. 运行演示。客户端应拒绝返回的数组。
3. 恢复该模式。
4. 保持第一页的 `nextCursor` 为 `""`，然后让最后一页返回
   `nextCursor: None`，而不是省略该字段。
5. 运行测试并比较游标轨迹。
6. 在一个字符串属性上添加 `x-mcp-header: "Authorization"`。
7. 确认描述符准入在调用之前就拒绝了它。
8. 尝试包含 Unicode、换行符、周围空白以及字面文本 `=?base64?SGVsbG8=?=` 的 `region` 值。解码每个发出的头字段，证明原始值被精确保留。
9. 将该注解移到 `oneOf` 下、`items` 或某个 `$ref` 定义中。确认
   即使该分支从未被演示使用，每个描述符仍会被拒绝。
10. 移除被识别的头字段或更改其解码后的值。确认 HTTP
    边界返回状态码 `400` 与 JSON-RPC 错误码 `-32020`。

重点不是记住某个 JSON 形状，而是观察每道闸门在拥有它的边界处如何失败。

## 练习实验

用一个 `search_evidence` 工具扩展契约实验。

要求：

1. 其输入模式接受 `query`、`limit` 以及一个安全的 `region` 路由字段。
2. 其输出模式是由带有 `uri`、`title` 与 `score` 的对象组成的数组。
3. 结果包括兼容性文本以及每个条目的资源链接。
4. 参数拒绝未知属性。
5. `limit` 受应用层验证的约束。
6. 对某个 URI 无访问权限的调用者，绝不能通过补全或工具输出看到该 URI。
7. 测试包括一个不符合模式的分数、一个无效的头字段注解，以及一个两页的列表。
8. 头字段值测试覆盖可见 ASCII、Unicode、控制字符、
   空白、看似哨兵的文本，以及两个 JavaScript 安全整数边界。
9. HTTP fixture 接受大小写不敏感的头字段名称，但以状态码 `400` 与错误码 `-32020` 拒绝缺失或不匹配的被识别值。

## 交付工件

`outputs/skill-mcp-contract-reviewer.md` 是一个扁平、可复用的评审技能。给它一个工具描述符、示例结果、分页行为以及补全策略，它会返回一个准入决定、结果验证计划、头字段策略以及具体的失败测试。

## 验证清单

当以下陈述全部成立时，本课即告完成：

- `tools/list` 在重复调用时返回相同的逻辑顺序。
- 当 `nextCursor` 为 `""` 时，客户端发起第二个请求。
- 不安全的敏感头字段描述符被排除，而其他工具保持可用。
- 一个数组能通过其数组输出模式。
- 一个对象无法通过同一个数组模式。
- 错误结果不能省略或违反已发布的输出模式。
- 文本、图像、音频、资源链接与内嵌资源块均可通过验证。
- 头字段审计事件包含名称，不含值。
- 纯可见 ASCII 保持纯文本；Unicode、控制字符、带填充、空以及
  看似哨兵的值可通过精确的 base64 UTF-8 编码完整往返。
- 超出 JavaScript 安全范围的镜像整数被拒绝。
- 位于 `oneOf` 下、`items`、嵌套对象、`$ref` 定义或
  输出模式中的注解在准入阶段被拒绝。
- 大小写不敏感的被识别头字段名称只有在解码后的值与请求体精确匹配时才通过；缺失或不匹配的副本产生 HTTP `400` 与 JSON-RPC `-32020`。
- 分析员补全绝不返回 `production`。
- 工具失败使用 `isError: true`；畸形的协议调用使用 JSON-RPC `error`。

## 生产环境故障模式

| 故障 | 学习者看到的现象 | 正确响应 |
|------|------------------|----------|
| 客户端假设输出为对象 | 有效的数组失败或被静默包装 | 依据已发布的模式验证，不限定仅对象类型 |
| 空游标被当作假值 | 最后一页消失 | 只要 `nextCursor` 存在且非 null 就继续 |
| 敏感值被镜像 | 秘密出现在代理、WAF 或追踪数据中 | 拒绝该描述符，并将秘密保存在受保护的请求数据中 |
| 原始 Unicode 或空白被镜像 | 网关与源站不一致，或值被规范化 | 使用精确的 base64 UTF-8 哨兵编码，并在解码后比较 |
| 注解隐藏在模式分支中 | 客户端在准入时遗漏路由元数据 | 遍历整个模式树，只允许直接的一级属性 |
| 大整数被镜像 | JavaScript 中间方对路由值做舍入 | 拒绝超出 JavaScript 安全整数范围的值 |
| 头字段与请求体不一致 | 网关路由到一个目标，而源站执行另一个 | 在分发前以 HTTP `400` 与 JSON-RPC `-32020` 拒绝 |
| 输出模式被忽略 | 下游代码消费了损坏的结构 | 在供模型或应用使用前验证 |
| 资源链接被自动信任 | 调用者跟随了未授权的 URI | 对每一次资源读取重新授权 |
| 补全共享全局建议 | 隐藏的租户名称泄露 | 按调用者、引用与授权过滤 |
| 工具注解被当作策略 | 破坏性操作绕过确认 | 在注解之外强制执行授权与审批 |
| 一个畸形工具破坏发现 | 整个服务端不可用 | 拒绝坏的描述符，独立准入有效的工具 |

## 结业项目衔接

Phase 13 的结业项目需要一个能够合并多个服务端工具的网关。本课提供其准入核心。

使用该工件评审四项结业证据：

- 确定性且完整的分页发现；
- 在模型暴露之前的描述符验证；
- 经过验证的结构化输出加上有界的内容块；
- 保持授权边界的补全与路由元数据。

不要仅凭一次成功的 `tools/call` 就声称网关兼容。要采集描述符、页轨迹、被准入的工具集合、被拒绝的工具集合以及一个经过验证的结果。

## 关键术语

| 术语 | 含义 |
|------|------|
| `inputSchema` | 定义工具可接受参数的 JSON Schema 对象 |
| `outputSchema` | 定义 `structuredContent` 的可选 JSON Schema |
| `structuredContent` | 工具结果产生的任意 JSON 值 |
| Content block | 有类型的文本、图像、音频、资源链接或内嵌资源 |
| `x-mcp-header` | 将原始参数镜像到 Streamable HTTP 元数据中的模式注解 |
| Opaque cursor | 服务端签发的分页令牌，客户端不解读其值 |
| Completion reference | 正在为其参数做补全的 prompt 名称或资源 URI/模板 |
| Admission | 客户端对是否暴露或拒绝某个已发现描述符的决定 |

## 延伸阅读

- [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [MCP Completion](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/completion)
- [MCP Pagination](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/pagination)
- [MCP Streamable HTTP Parameter Headers](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http#custom-headers-from-tool-parameters)