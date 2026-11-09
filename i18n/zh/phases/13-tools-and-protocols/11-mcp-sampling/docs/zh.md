# 采样移民和无国籍MRTR

> 通过MCP 2026-07-28将新设计的样本取消,并删除服务器到客户端请求道.如果现有工作流仍然需要客户端的模型,服务器将返回一个 `input_required`结果是,客户端将原始请求重新尝试,使用模型输出.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources and prompts)
**Time:** ~75 minutes

## 学习目标

- 解释为什么MCP 2026-07-28中采样已过时,并选择新服务器的直接模型集成默认.
- 实现兼容性工作流程`sampling/createMessage`通过多次回路请求 (MRTR).
- 将协议修改和客户端功能放入每个请求中`_meta`它们是什么?
- 返回`resultType: "input_required"`通过新的JSON-RPCID重新尝试原始方法.
- 保护完整性`requestState`并且将其绑定到本,方法,论点和过期.
- 附带模型辅助循环,具有能力检查,批准,响应验证和圆的限制.

## 议定书前的决定

工具如`summarize_repo`需要两种工作:

1. 确定性工作:列表文件,阅读允许文件,验证路径和组装内容.
2. 模型工作:选择代表文件并合成总结.

现在你有两个有效的架构.

### 新服务器:直接与模型提供商集成

服务器拥有模型选择,凭证,预算,重试和可观测性.它返回一个普通 `tools/call`结果对MCP客户.

当服务器已经是一个托管服务或预测模型行为比使用托管模型更重要时,选择此.

### 现有样本工作流程:将其迁移到MRTR

针对2026-07-28的服务器不能发送直播`sampling/createMessage`要求返回客户.`InputRequiredResult`现在,我们要去.

选择这种兼容性路径只有在使用客户端模型时,并且凭证是真正的产品要求.记录一个删除计划,因为新的实现不应该采用过时的样本.

## 无国籍合同

2026年7月份的协议没有`initialize`交换,没有`notifications/initialized`没有.`Mcp-Session-Id`每个请求都包含了以前在握手中生活的信息:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "summarize_repo",
    "arguments": {"audience": "developer"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {"sampling": {}},
      "io.modelcontextprotocol/clientInfo": {
        "name": "lesson-client",
        "version": "1.0.0"
      }
    }
  }
}
```

服务器验证每一个请求的修改. 缺失或无字符串版本是无效的参数,`-32602`没有支持的字符串返回`-32022`具有准确的数据`{"supported":["2026-07-28"],"requested":"<client version>"}`缺失的样本能力返回`-32021`随着`data.requiredCapabilities`设置为`{"sampling":{}}`现在,我们要去.

没有JSON-RPC的封面`id`接收器可能会处理它,但它不会发出成功响应或错误响应.`202 Accepted`没有接受通知的机构.

服务器还实现了`server/discover`准确的`supportedVersions`关键,能力,`ttlMs`其他`cacheScope`为了让客户端能够在调用工具之前学习和缓存服务器合同.`tools`服务器也执行强制性`tools/list`它是决定性的.`summarize_repo`描述符包含一个有效的对象`inputSchema`现在`resultType: "complete"`服务器身份元数据,以及公共缓存提示.

每一个成功的现代结果都有一个差异:

- `resultType: "complete"`代表行动结束.
- `resultType: "input_required"`客户必须满足嵌入式请求,并再次尝试.
- 扩展可能定义其他结果类型. 任务扩展添加 `"task"`在第13课.

## 一轮MRT

服务器无法在处理请求时调用客户端.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "input_required",
    "inputRequests": {
      "pick_files": {
        "method": "sampling/createMessage",
        "params": {
          "messages": [
            {
              "role": "user",
              "content": {
                "type": "text",
                "text": "Choose three representative files and return a JSON array."
              }
            }
          ],
          "systemPrompt": "Return only the requested value.",
          "modelPreferences": {
            "costPriority": 0.8,
            "intelligencePriority": 0.2
          },
          "maxTokens": 400
        }
      }
    },
    "requestState": "opaque-integrity-protected-value"
  }
}
```

客户端验证它支持采样,应用其批准和模型政策,并获得模型响应.然后它发送一个新的请求,使用不同的JSON-RPC id:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "summarize_repo",
    "arguments": {"audience": "developer"},
    "inputResponses": {
      "pick_files": {
        "role": "assistant",
        "content": {
          "type": "text",
          "text": "[\"README.md\", \"server.py\", \"docs/intro.md\"]"
        },
        "model": "host-model",
        "stopReason": "endTurn"
      }
    },
    "requestState": "opaque-integrity-protected-value",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {"sampling": {}}
    }
  }
}
```

复试不是协议会议的延续,而是重复原始方法和参数的新请求,只添加当前轮的参数.`inputResponses`声的声音`requestState`字节对字节.

只有在 `tools/call`现在`prompts/get`其他`resources/read`服务器不得返回`input_required`没有相关的方法.

## 多圆形状态

这一课需要两个模式:

1. `pick_files`返回一个JSON阵列.
2. `summary`返回最后的散文.

每次重试只包含了该轮回复.因此服务器将阶段和验证的中间数据放入下一个轮.`requestState`现在,我们要去.

通过使用一个原始的相位名称,将状态绑定到:

- 证实的资本,非自报 `clientInfo`其他
- 产品来源方法;
- 关于本案的论点的摘要;
- 短期的期限;
- 现阶段和验证的中间值.

使用HMAC,如果不需要保密.使用验证加密,如果客户端不能读取状态.拒绝错误的签名,过期值,改变主题或改变参数.`-32602`现在,我们要去.

客户不得分析或修改`requestState`唯一的任务是重试时回声.

## 模型偏好是提示

`costPriority`现在`speedPriority`其他`intelligencePriority`客户可能会忽略它们,因为客户拥有模型政策.

保持`includeContext`在`"none"`如果您保留已旧的样本流量.其他语境模式增加泄漏风险,本身已过时.请通过请求中最小明确的语境.

## 安全变化

客户是嵌入式样本请求的信任界限.

- 显示用户在政策需要批准时服务器要求模型做什么.
- 通过MRT,一个恶意服务器可以创建一个模型支出循环.
- 在使用它作为文件名,URL或工具输入之前验证每个样本反应.
- 每轮的字节和代币限制.
- 拒绝未在当前客户端功能中声明的输入请求.
- 保持模型输出在授权决策中.
- 记录原始方法和输入请求键,而不记录敏感的提示内容.

`clientInfo`其他`serverInfo`任何一个数据都不能被认证身份.

```figure
t3-sampling-flip
```

## 建立它

`code/main.py`实现了完全的双轮流,没有第三方包:

- `server/discover`收益`supportedVersions`通过Cache,广告工具支持,并返回缓存提示.
- `tools/list`返回一个确定性,可缓存的`summarize_repo`具有对象输入方案的描述符.
- `tools/call`根据请求验证了元数据.
- 首先,结果是`sampling/createMessage`文件选择.
- 第一次重试验证实模型结果,并嵌入第二次请求.
- 受到HMAC保护`requestState`独立请求之间的阶段.
- 最终结果使用`resultType: "complete"`现在,我们要去.

假的主机模型使得例子是确定性的.`fake_host_model`服务器边状态机应该保持确定性和可测试性.

## 用它

根据数据库根:

```bash
cd phases/13-tools-and-protocols/11-mcp-sampling/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

预期的检查站:

- 发现返回一个完整的结果`ttlMs`其他`cacheScope`现在,我们要去.
- 工具发现返回相同的分类描述符`resultType`服务器身份,缓存提示.
- 缺失功能和不支持版本使用精确的`-32021`其他`-32022`错误数据.
- 没有 id 的通知不会产生 JSON-RPC 响应.
- 要求身份证是`[1, 2, 3]`证明每次MRTR轮都是独立的.
- 首先的两个结果是`input_required`现在,我们要去.
- 最终结果是`complete`包含选定的文件以及总结.
- 试验中改变原始参数将失败于请求状态检查.

## 运送它

`outputs/skill-sampling-loop-designer.md`现在是迁移规划师.它首先决定是否应该取消样本以支持直接模型集成.如果需要兼容性,它会产生MRTR轮,状态绑定,能力门,预算,验证和取消计划.

## 运动

1. 改变文件选择响应为无效的JSON. 确认服务器返回`-32602`而不是相信模型的输出.
2. 改变`audience`解释为什么封闭状态阻止了交叉请求的重复使用.
3. 加入第三轮,要求主机批评总结. 携带之前的总结进入签署状态,并将整个流量限制在三个轮.
4. 通过用服务器所有模型适配器取代假的主机回调,删除样本.列出哪些批准,发票和可观察责任转移到服务器.
5. 添加使用超过一秒的状态值的过期测试.

## 关键词

| Term | Meaning in 2026-07-28 |
|------|------------------------|
| Sampling | Deprecated feature that asks the client's model for a completion |
| MRTR | Stateless retry pattern for client input required during a request |
| `InputRequiredResult` | Result with `resultType: "input_required"` |
| `inputRequests` | Server-assigned map of embedded elicitation, sampling, or roots requests |
| `inputResponses` | Current round's client results keyed like `inputRequests` |
| `requestState` | Opaque server state echoed exactly by the client and verified by the server |
| `resultType` | Required discriminator for modern MCP results |
| Direct model integration | Recommended replacement for new servers that need model inference |
| Capability gate | Rule that prevents sending an embedded request the client did not advertise |
| Loop budget | Maximum rounds, tokens, bytes, time, and spend allowed for the operation |

## 遗产兼容性

预定到2025-11-25的客户端可能仍然使用旧的服务器启动`sampling/createMessage`通过直播连接来传输. 仅在版本特定的适配器中保持这种行为. 不要让会议的路径成为2026-07-28服务器的架构.

官方SDK可以翻译现代化`input_required`对于老年同龄人来说,这种闪是兼容性界限,而不是允许添加新的依赖于会议的逻辑.

## 进一步阅读

- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [MCP Sampling deprecation](https://modelcontextprotocol.io/seps/2577-deprecate-roots-sampling-and-logging)
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
