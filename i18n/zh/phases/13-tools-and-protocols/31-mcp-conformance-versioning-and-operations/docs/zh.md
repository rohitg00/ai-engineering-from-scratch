# 标准规范工程:版本化,证据和运营

> 服务器不符合,因为其快乐路径通过一个SDK工作. 符合性在线,版本边界,通过中间人,以及在滚动过程中.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 17 (gateways), Phase 13 · 30 (registry admission)
**Time:** ~100 minutes

## 学习目标

- 转换规范性MCP规则成金色和负线转录.
- 保持严格的态度`2026-07-28`行为与传统的背后行为是不同的.
- 区分添加未知的字段与无效未知的字段`resultType`现在,我们要去.
- 进行原始JSON-RPC证据与SDK正常化的视图的比较.
- 通过一个真正的代理界限证明头部和身体的完整性.
- 关口的发行文件,有编辑的转录,健康和反弹证据.

## 问题

你的客户打电话`tools/list`通过 SDK,获得工具.

这样,我们仍然没有回答重要问题:

- 要求是否包含了现代的每次请求协议的元数据?
- 确实`MCP-Protocol-Version`现在`Mcp-Method`其他`Mcp-Name`能否与JSON-RPC的体格相匹配?
- 答案是否包含有效的`resultType`电线上,或者SDK合成了一个?
- 客户是否会保留未来的添加剂领域?
- 现在的错误会导致一个遗产的握手吗?
- 代理是否保存了源状态和JSON-RPC错误?
- 通知序列化器发出了禁止响应吗?
- 没有保密的释放或推迟?

合规性是观察到的不变元件的集合. 在生产流量必须发现它们之前,建立一个捕获不变元件的带.

```figure
mcp-conformance-operations
```

## 开始使用版本时代

股`2026-07-28`现代请求包含了`params._meta.io.modelcontextprotocol/protocolVersion`其他`params._meta.io.modelcontextprotocol/clientCapabilities`确切的名称间隔的密钥是重要的;`protocolVersion`或`clientCapabilities`标题标题是错误的.当镜像路由标题在HTTP边界存在时,它们的值必须与JSON-RPC体一致.现代成功结果带来了`resultType`现在,我们要去.

通过版本`2025-11-25`没有任何数据的遗产结果.`resultType`只有客户选择了早期时代后才被解释为完整.

不要创建一个允许验证器,同时接受两个形状. 使用两个分支:

| Branch | Entry evidence | Missing `resultType` | Initialization |
|---|---|---|---|
| Modern | Successful `server/discover` or recognized modern response | Invalid | Not the default path |
| Legacy | Configured allowlist plus a valid legacy `initialize` result after an inconclusive modern probe | Interpreted as complete | Required by that era |

隔离使得一个错误的现代同龄人不会得到更弱的验证.

### 严格模式

严格模式需要证明现代行为.`server/discover`现在,我们已经发现了一个新的版本,它可以证明现代分支.一个已知的现代JSON-RPC错误也证明了这一点.`-32020`现在`-32021`其他`-32022`现在,我们要去.

### 倒退模式

倒退模式执行一个有限的现代探测器.时间过关,空答,关闭连接或未识别的响应是不确定性的.它并不证明同行是遗产.只有一个明确配置或配置的终点才能接收一个有限的遗产探测器,客户端只选择了验证该探测器的遗产分支后.`initialize`结果和谈判的遗产修订.

错误后,反弹不是被遗留的. 已认可的现代错误包含有用的纠正信息. 降级后,可能隐藏标题不匹配,缺失功能声明或不支持版本.

这样,攻击者,中断或过代理不会通过放弃现代响应强加降级.记录终点政策,无可推断的现代观察,确切的积极遗产证据和选定的时代.

没有这个事实,一个缺失的字段可能在一个测试过程中看起来是可接受的,而另一个则看起来是不有效的.

## 建立一个转录体

转录器记录了跨越界限的内容,而不仅仅是SDK调用:

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

保持两个类的灯具.

### 黄金的转录

黄金的转录证明了被接受的行为:

- 现代发现或方法请求,配合的元数据和标题
- 要求的字段的完整结果
- `input_required`结果是,当方法可以要求更多输入时
- 扩展结果仅在相应的功能被广告后
- 没有遗产结果`resultType`只有在选择的遗产时代
- 没有JSON-RPC响应的通知处理

黄金的转录是精确的,不是大. 保持可变的身份证和时间标签确定性或在比较之前将它们正常化.

### 负面转录

负面的转录证明拒绝行为:

- 头部和身体的不匹配
- 缺少按要求的能力
- 支持不到的匹配协议版本
- 没有现代`resultType`
- 未知或未公告`resultType`
- 反应`jsonrpc`其他`2.0`或是值或JSON类型不同的ID
- 包含两者之间的反应`result`其他`error`没有一个
- 没有整数的错误`code`子`message`
- 已知协议错误被错误的HTTP状态映射
- 发出通知的回应
- 错误的JSON-RPC封面
- 协议错误的代理崩

对于每一个负例,请确认拒绝边界和稳定错误代码. 呼叫失败太弱.`-32020`虽然它们都能看起来像失败,但却却会讲述完全不同的故事.

标题不匹配配器件必须包含服务器的实际HTTP 400 JSON-RPC响应,并包含匹配请求ID和错误代码`-32020`当地方验证器观察时,自动执行.`HeaderMismatch`对于一个 HTTP 500 系统,即使当地拒绝代码是正确的,也会出现故障. 通过自己的请求验证器投射后停止的链接只测试了自己,而不是服务器的电线行为.

官方MCP合规项目作为外部套件和版本参考很有用. 保存您的本地转录.它们捕获您的代理,SDK,身份验证,扩展和发布路径,而一般套件无法知道.

## 标题值必须与PC体相匹配

在现代流式HTTP中,中间人可以通过镜头标题进行路由或执行政策.JSON-RPC的机体仍然是协议的真相来源.不匹配是完整性失败,而不是选择一个值的暗示.

在此顺序进行验证:

1. 分析和验证JSON-RPC封装和元数据类型.
2. 比较`MCP-Protocol-Version`随着`params._meta.io.modelcontextprotocol/protocolVersion`现在,我们要去.
3. 比较`Mcp-Method`随着`method`现在,我们要去.
4. 如果该方法有路由名称,则比较`Mcp-Name`具有相应的体值.
5. 确定平等后,决定是否支持匹配的版本和功能集.

这种顺序区分了不匹配`-32020`没有支持的版本`-32022`通过此,一个网关可以使用一个不同的机体名称.

HTTP 字段名称是不敏感的,而它们的值仍然是敏感的. 在搜索之前,正常化头条名称,拒绝矛盾的重复.对于不安全的,非ASCII或领先或后续的白色空间.`Mcp-Name`解码了精确的`=?base64?{Base64EncodedValue}?=`拒绝一个不完整的哨兵,不有效的Base64,不有效的UTF-8,或原始的不安全值`-32020`虽然机身包含相同的字符,但原料周围的白色空间是无效的,因为该值需要在运输前进行哨兵编码.

介绍一个错误的HTTP,在请求到达MCP服务器之前可以拒绝错误的HTTP,因此其失败可能是没有JSON-RPC的HTTP错误. 捕获是否拒绝来自介绍者或来源. 当处理有效的JSON-RPC请求时,原始MCP服务器应该使用协议错误合同.

## 无人知之田不是无人知之产物

未来兼容性需要两个不同的规则.

### 添加未知字段

结果对象和`_meta`根据其作用,验证者应保留或忽略添加值的字段,除非该字段违反了保留合同.`futureHint`除了已知结果之外.

如果您是透明代理,保存一个未知的字段通常比剥夺它更安全.如果您是应用程序客户端,忽略它可能是有效的.您的差异测试仍然应该显示SDK遗漏它,因此行为是故意的.

### 没有人知道`resultType`

`resultType`核心现代结果使用`complete`或`input_required`扩展只能在其功能被广告时添加另一个值.`task`在谈判能力的背景下.

客户不知道它会丢弃的生命周期. 拒绝它.

因此,相同的原始反应可以包含一个可接受的未知的字段和一个不可接受的未知的结果类型.

区分器只是第一层. 验证后的方法特定的有效载荷.`tools/list`结果需要一个`tools`配列的描述符具有独特的非空名,有用的描述和对象根`inputSchema`值.`task`结果仅适用于符合条件的`tools/call`具有任务能力和要求`taskId`已知状态,创建和更新时间标签,`ttlMs`另外一个有效的选项选项间隔.`completion/complete`结果需要一个`completion`具有不超过100个字符串值的对象,可选的非负整数 `total`且可选的布尔式值`hasMore`一个好拼写的`resultType`无法制造一个错误的有效载荷的符合性.

## 通知变异

没有JSON-RPC通知`id`接收器不得发送一个成功或错误的JSON-RPC响应.

对于被接受的HTTP通知形状,带期望一个HTTP`202`没有任何东西.`2026-07-28`定义没有基于 Streamable HTTP 的核心客户端到服务器通知.样本仅使用一个名字空间的进程扩展通知来测试单向串联器不变量.不要将其作为一个新的核心方法.

测试连续化器,不仅是操作器.`None`通过中文软件将其包裹成一个JSON成功对象.

## 添加一个 SDK 区别值

 SDK 经常将线程对象转化为方便的语言类型. 这很有用,但一个正常化的对象不能证明收到的内容.

对于每一个高风险装置,捕获:

1. 在 SDK 解码之前,原始状态,标题和响应器官.
2.  SDK正常化回报值或例外
3. 预期的选择时代的语义投影.
4.  SDK 提升,合成,剥离或更改的场地.

样本允许仅使用SDK去除已知电线账本,如`resultType`现在`_meta`现在`ttlMs`其他`cacheScope`应用程序的有效载荷.`futureHint`因为这个未知的语义领域消失了.

您的组件是否是一个应用程序终端点,可以忽略添加字段,或者一个透明的中间体,该组件应该保存它.

如果两个SDK以不同的方式正常化相同的转录,则发布政策应该说明哪种行为是可接受的,而不是选择最方便的输出.

## 捕获代理证据

产品MCP失败的大部分发生在多个过程中.记录三个视图:

| View | Minimum evidence |
|---|---|
| Ingress | request headers, JSON-RPC body, content type, authenticated route, receive time |
| Origin | forwarded headers and body digest, origin status, response headers and body |
| Egress | client-visible status, headers, body, and send time |

样本检测到两个常见的变化:

- 源 HTTP 400 或 404 JSON-RPC 错误成为通用代理 500
- 出口JSON-RPC体与原体不同

添加内容类型的部署特定声明,`Accept`检查TLS终止的两侧,当政策允许时.永远不要记录凭证,只是为了证明路径.

## 记忆不完之前再写一篇

编辑是符合性操作的一部分,而不是后续清理工作. 在串行,哈希,日志,测试文物或失败上传之前应用它.

样本案例将关键名称折叠,在匹配之前删除分区,然后再次次替换关键下的值,如`Authorization`现在`Cookie`现在`Set-Cookie`现在`X-Api-Key`现在`accessToken`现在`clientSecret`现在`registrationAccessToken`现在`token`现在`password`现在`secret`其他`api_key`纳化和丹尼尔单必须使用相同的形式,因此马,字符串,强调和点子变体不能绕过彼此的政策.`query`仍可能包含个人或受监管的数据.

除了这些数据,还可以将其保存在已批准的短暂系统中,只需要进行特定调查. 化证明了哪些数据驱动了决定;它不显示删除的值.

## 让健康和回归成为门户的一部分

协议合规性是必要的,但不够的释放. 合规候选人仍然可以过时,泄漏内存或过度负载依赖性.

在推出之前定义健康窗口:

- 样本数量最低
- 错误率最高
- 延迟最大百分比
- 和资源限制
- 观察时间
- 与被允许的基线的比较

在推出之前也定义反弹证据:

- 确切的前版本
- 录取证据消化
- 石器和描述器SHA-256
- 目前的登记处状态
- 现状健康结果
- 航线恢复程序
- 证据证明这些精确的领域来自可靠的释放控制器身份

要求提升前,不仅需要候选人失败后,还要验证并健康的反弹目标.

如果候选人失败,而反弹目标缺乏这些证据, 停止交通,而不是猜测.

不要减少对未空版本等真实性检查的准备,`healthy: "yes"`样本需要准确的类型,活跃状态,三个SHA-256字段,一个可信的签名器和一个有效的HMAC-SHA-256证明,在完整的反弹有效载荷上.其确定性演示密钥是一个非秘密的装置.在生产的释放边界注入一个保护密钥,KMS验证结果或公钥验证证证.

发放门也拒绝空格转录,SDK差异或代理证据.每个来源都必须携带有效的证据消化.绿色健康窗口不能填补未被观察过的边界.

## 建立它

运行标准图书馆带:

```bash
cd phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations
python3 code/main.py
npx tsx code/main.ts
```

演示程序运行了15个黄金和负面的转录,包括有效和错误的完成结果,将原始结果与SDK视图进行比较,检查一个失败的代理,评估健康,验证反弹证据,并选择目标.

预期的形状:

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

阅读`code/main.py`在此顺序:

1. `validate_request()`执行特定时代的请求和标题规则.
2. `validate_result()`区分失踪的传统歧视者,有效的现代价值观,扩展和未知的价值观.
3. `select_era()`实施严格的反弹政策.
4. `run_transcript()`评估黄金和负光.
5. `compare_sdk_view()`报告显示了正常化差异.
6. `inspect_proxy()`进行了进口,出口和出口证据的比较.
7. `redact()`在证据被除之前,它会删除明显的秘密.
8. `rollback_evidence_ready()`验证准确的针字段和可靠的释放证书.
9. `ReleaseGate.evaluate()`加入非空格合规性,SDK,代理,健康和反弹证据.

## 用它

运行四个点:

1. 在每次实施变更时,使用在过程中测试适配器.
2. 针对实际运输的客户端和服务器二进制.
3. 通过部署的代理或门户在一个舞台环境中.
4. 在加拿大鱼发射期间,有现实健康和反弹证据.

保持相同的稳定案例名称在各层.`negative-header-body-mismatch`据悉,在""中,该指数的数量是1个,且在"端到端",代理和可查报告中,该指数的变量不相同.

存储版本控制中的固定方案. 在发布系统中存储编辑的运行证据. 仅在事件访问控制下存储短暂的原始捕获.

## 互动实验室

### 实验室A:证明时代的边界

关于`code`开放字符串:

```bash
cd phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations/code
python3 -q
```

运行:

```python
from main import *
validate_result({"tools": []}, "legacy")
validate_result({"tools": []}, "modern")
```

遗产的呼叫是无效的`complete`现代的呼唤引起了`ProtocolViolation`现在试试倒:

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

由于沉默不是遗产证据,所以第一时间停止运行.第二次调用仅因为配置允许,所以选择遗产,并且观察到有效的遗产初始化结果.

### 实验室B:添加式场与差异

```python
validate_result({"resultType": "complete", "tools": [], "futureHint": True}, "modern")
validate_result({"resultType": "future_mode", "tools": []}, "modern")
```

首先,结果保持了`futureHint`另一种原因是因为生命周期的差异是未知的.

### 实验室C:检查 SDK 转型

```python
compare_sdk_view(
    {"resultType": "complete", "tools": [], "futureHint": {"mode": "new"}},
    {"tools": []},
)
```

决定是否可以忽略你的组件`futureHint`您可以将此选项写入释放政策中.

### 实验室D:修复代理

修改演示表格,以保证出口的原始状态和体质.`python3 main.py`现在,我们需要一个新的方法来实现.`futureHint`在 SDK 视图中,并观察行动变化到`promote`当一切证据都过去了.

## 实践实验室

加入要求测量的SSE转录到带上.

要求:

- 捕获响应状态,内容类型,订单的SSE事件和流程终止.
- 证明每个JSON-RPC事件具有有效的时代特定结果或错误.
- 添加一个负案例,为代理,在转发之前缓冲整个流.
- 添加一个与请求不同的JSON-RPCID的SSE事件的负案例.
- 在写证据之前,重新编写事件数据.
- 包含流程时间,第一次事件延迟和事件数量在健康窗口中.
- 让释放门选择只有一个证明的反弹目标,当流失败.

成功意味着同一案例直接通过代理运行, 报告确定了改变行为的确切边界.

## 运输的文物

这一课是很好的.`outputs/skill-mcp-conformance-release-gate.md`通过它将服务器,客户端,门户或SDK更改成版本的兼容矩阵和发布决定.该文物需要原始线索证据,负案例,明确时代选择,SDK差异,代理证明,编辑,健康门和反弹证据.

## 检查

运行演示和确定性套件:

```bash
cd phases/13-tools-and-protocols/31-mcp-conformance-versioning-and-operations
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover -s code/tests -v
```

验证应证明:

- 每个包含的黄金和负面的转录都达到预期的结果
- 现代要求需要精确的名称空间的元数据密钥
-  HTTP 标题名称是不敏感的,并且编码.`Mcp-Name`值被解码准确
- 标题和机身不匹配返回现代不匹配代码
- 答案版本,ID,结果或错误独占性,错误形状和HTTP映射被验证
- 执行方法特定的工具列表,任务和完成有效载荷要求
- 每个观察到的`HeaderMismatch`需要一个实际的HTTP 400 JSON-RPC `-32020`反应
- 原料`Mcp-Name`时被拒绝,而精确的哨兵编码的白空间回来旅行
- 失踪的`resultType`仅在选择的遗产时代有效
- 添加式字段存活原始验证,而未知的结果类型失败
- 扩展结果类型需要其广告的能力
- 现代错误从来没有导致遗产倒退
- 通知没有产生JSON-RPC响应
-  SDK 会计删除和语义字段损失分别
- 检测到代理错误崩,并且在camelCase和分离器变体中恢复性删除凭证
- 促进需要非空格转录,SDK,代理和健康的运营证据
- 促进和推翻都需要一个认证,固定,活跃,健康的推翻目标

## 生产失败模式

| Failure | What the weak test reports | What the harness must prove |
|---|---|---|
| SDK synthesizes a missing discriminator | “tools/list passed” | Raw modern result lacked `resultType` and is invalid |
| Client downgrades after `-32021` | “legacy retry worked” | Recognized modern error forbids fallback |
| Unknown result type treated as complete | “response parsed” | Unadvertised lifecycle discriminator is rejected |
| Proxy authorizes one tool and origin executes another | “request reached server” | `Mcp-Name` equals the body routing name at every hop |
| Harness throws before reading the server response | “header mismatch test passed” | HTTP 400 and JSON-RPC `-32020` response are captured and validated |
| Proxy turns origin 400 into generic 500 | “upstream error” | Origin and egress statuses and JSON-RPC bodies are preserved |
| Notification middleware emits `{result: null}` | “handler returned none” | Final egress body is empty and no JSON-RPC response exists |
| SDK strips an additive field | “typed objects match” | Raw and normalized views show the exact dropped field |
| Failure artifact leaks a bearer token | “debug bundle uploaded” | Redaction occurred before hashing, logging, or upload |
| Credential key style bypasses redaction | “denylist contains api_key” | CamelCase and separator variants share one canonical denylist form |
| Canary has no samples but appears healthy | “zero errors” | Minimum sample count is enforced |
| Rollback selects an unknown build | “previous deployment restored” | Target version, admission digest, pins, status, and health are present |

## 运营规则

测试你发送的字节,每个中间件的字节向前,每个SDK暴露的语义,以及在压力下使用的证据操作.兼容性是明确的分支.滚动是基于证据的释放行动.任何一个不能是允许解析器的意外副作用.

## 进一步阅读

- [MCP 2026-07-28 base protocol](https://modelcontextprotocol.io/specification/2026-07-28/basic)
- [MCP version negotiation](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Official MCP conformance project](https://github.com/modelcontextprotocol/conformance)
