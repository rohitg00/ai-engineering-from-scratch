# 密码数据安全:有毒的元数据,路由和MRTR状态

> 无国籍并不意味着无信任,而是每一次请求都暴露出服务器和网关需要的证据,

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 08 (MCP client)
**Time:** ~60 minutes

## 学习目标

- 处理工具描述,注释,客户端信息和服务器信息作为不可信的数据.
- 检测到元数据中毒,描述符变化,以及跨服务器名称碰撞.
- 验证2026-07-28请求元数据和流式HTTP路由标题.
- 保护MRTR`requestState`对于改和将确认绑定到精确的论点.
- 申请授权和利率限制,而不是删除协议会议.

## 问题

模型阅读工具描述,以决定该打电话.路由器阅读工具名称,以决定要发送请求.用户阅读标签,以决定该批准什么.一个恶意描述符可以针对所有三个.

官方MCP安全指导是直接的:除非它们来自一个可信的服务器,否则描述和注释应被视为不可信的.即使如此,部署的信任也可能会改变.服务器更新,受损的包,注册表错误或网关合并可能会改变模型看到的内容.

现在的协议也改变了安全界限.在2026-07-28年,没有核心握手和没有运输会议.一个安全设计,只需通过通过核准,利率限制或审计历史的安全设计.`Mcp-Session-Id`现在的设计不一样.

## 概念

### 值得检查的7个攻击面

为了保持谨慎,不要使用模糊的指令,而是用具体的列表.

1. **Metadata poisoning.**描述包含与声明的工具行为无关的指令.
2. **Descriptor rug pull.**已批准的名称,描述,方案或注释变化.
3. **Cross-server shadowing.**两个后端都显示出相同的无条件工具名称,路由则默默地选择一个.
4. **Header and body confusion.** `Mcp-Method`或`Mcp-Name`不同意JSON-RPC请求.
5. **Capability escalation.**一个同行声称一个扩展或客户端功能,服务器误会该声明授权.
6. **MRTR state tampering.**客户改变`requestState`答案不同问题,或用不同的论点重新确认.
7. **Supply-chain identity confusion.**已知显示名称被视为出版商或服务器身份证明.

这些表面重叠.哈希粘贴有助于描述符的更改,但并不能证明第一个描述符是安全的.静态扫描捕获明显的短语,但不是微妙的指示.命名空间防止一个碰撞类,但不是恶意的名称空间服务器.堆控制.

### 目前的申请包是证据,而不是身份

每个2026-07-28的请求都包含:

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

验证每个请求的版本和功能形状. 使用功能来选择兼容的响应形状.不要使用 `clientInfo`作为一个认证的资本.

同样的警告适用于`io.modelcontextprotocol/serverInfo`结果的元数据. 它是用于日志和调试. 它不是证书,注册证明或授权决定.

### 在政策之前验证路由

为了`tools/call`流式HTTP包括:

```text
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes.export
```

标题方法必须等于体型方法.标题名称必须等于`params.name`拒绝与`-32020`在选择后端,应用RBAC或消耗利率限制令牌之前.

这种排序消除了一个常见的模糊性:一个组件授权了机器,而另一个由头条路径.

电线验证遵循一个确切的序列.验证JSON-RPC和元数据类型,与体格比较标题值,然后检查是否支持匹配的版本.一个不匹配的标题返回HTTP 400`-32020`如果标题和体格同意不支持的版本,请返回HTTP 400`-32022`其他`data`完全是`{"supported":["2026-07-28"],"requested":"<actual>"}`未知方法返回了HTTP 404`-32601`现在,我们要去.

每个错误对象都包含了可选的`data`合同需要结构化回收信息.`id`通过 HTTP 通知,它将返回 202 个空体.

### 入整个描述符

仅仅一个描述哈希,则会错过方案和注释变化. 用户批准的描述字段可归化和哈希:

```python
normalized = json.dumps(tool, sort_keys=True, separators=(",", ":"))
digest = hashlib.sha256(normalized.encode()).hexdigest()
```

存储该文件在一个合格的钥匙下,例如`notes.export`其他类型的玩具,

在每次更新时:

- 关键不明:隔离到审查.
- 关键相同,消化不同:隔离作为一毯拉直到重新批准.
- 复制无条件名称:需要确定性名称空间.
- 扫描仪击:封锁并查看完整的描述符.

毒性描述器在完美地住时保持毒性.

### 静态扫描是三线

简单的模式可以标记角色标签,指令过关,隐藏,秘密访问和隐藏的网络目的地.它们对于安装时间和CI来说足够便宜.

它们不是一个语义证据.安全的描述可以包含一个标记的短语在一个合法的警告中.恶意的描述可以避免每一个短语. 处理扫描器输出作为审查证据,而不是自动无辜分数.

### 在合并之前的名称空间

假设两个服务器都暴露了`search`永远不要让发现命令决定谁赢.

```text
notes.search
issues.search
```

合格名称是公共网关名称. 记录后端映射单独. 稳定名称进行批准,审计,哈希针,`Mcp-Name`路由指的是同一个对象.

### 能力是兼容性声明

根据要求`clientCapabilities`服务器可以使用客户端处理的协议,它不会让客户端访问工具,数据或操作.

授权仍然来自认证的资本和资源政策.

1. 验证交通证书.
2. 验证版本,标题和请求形状.
3. 检查能力兼容性.
4. 授权主题,工具,资源和论点.
5. 执行或请求用户输入.

### 保护无状态MRTR确认

结果工具可能需要用户确认.当前的MCP使用多次回路请求而不是服务器到客户端回调.

首先,

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

客户端将输入并使用新的JSON-RPCID重新尝试原始方法:

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

每个`inputRequests`值是一个完整的嵌入式请求`method`其他`params`关键必须与相应的输入相匹配`inputResponses`形式发出使用对象根`requestedSchema`服务器要求之前,客户端必须已经声明了表格发出能力.

目前的功能有两个有效的表格声明. `{"elicitation":{}}`支持形式的诱惑,而`{"elicitation":{"form":{}}}`只有URL的声明,如`{"elicitation":{"url":{}}}`服务器返回 HTTP 400 函数,`-32021`其他`data.requiredCapabilities`相当于`{"elicitation":{"form":{}}}`现在,我们要去.

治疗`requestState`作为敌对输入.签字或加密,验证,并将其绑定到方法,工具,精确参数,目的,期限,主题,以及重复问题时一次性不用.课程代码使用HMAC和精确参数匹配,使界限可见.

无线账本不能住在一个门户对象内.可运行模型注入一个有限的,TTL剪切的重播存储器,可以由多个门户实例共享.它的原子要求是执行边界:只有验证的接受或明确的终端下降才消耗状态.一个错误的反应或 `cancel`生产舰队需要在共享持久存储中相同的条件要求.

没有在协议会议中存储隐藏的确认文本.任何服务器实例都应该能够验证重试.

### 对于高风险调用的第二规则

按三个轴分类一个呼叫:

- 它消耗了不值得信赖的输入.
- 它可以访问敏感数据.
- 造成后果的外部行动.

一个自动步骤不应该结合三个. 分开,减少特权,或通过MRTR请求明确的用户输入.这是一个设计论,而不是协议功能.

### 执行前的权力减少

无国籍本身并不是安全性.它删除了隐藏的协议历史,但一个自主请求仍然可以要求一个超级权力处理器泄露数据或进行不可逆转的变化.安全性来自于减少每个边界的权威:

1. **Typed verb.**设置一个有限的操作,例如`archive_note`没有一般药物`run`或`request`工具可以表达无关权力.
2. **Validated arguments.**使用一个关闭的方案,在政策评估之前,将未知的字段拒绝,一次正常化识别符,限制大小,并验证目的地,租户和资源所有权.
3. **Current authorization.**绑定验证的主题与精确的动词,资源,环境和正常化参数.工具注释和客户端功能不赋予此权限.
4. **Action-bound approval.**为了获得后果调用,将批准绑定到输入的动词和正常化参数的摘录,加上主题,过期和一次性政策.任何改变的字段都需要新的决定.
5. **First-class refusal.**拒绝模型,过期批准,用户拒绝,不安全的目的地作为普通结果,不会产生任何副作用.不要把拒绝转化为更弱的反弹工具.
6. **Redacted audit evidence.**记录谁问,哪个承认描述符和政策版本使用,什么正常目标被授权,为什么决定允许或拒绝,以及是否开始执行.

每一步都缩小了下一个组件可能做的事情.最终处理器应该收到已经验证的域命令,而不是原始模型文本加上广泛的凭证.在MRTR重试,任务更新或网关转发呼叫时重复整个链接.早期的批准不会将后来的请求转化为可信的会话流量.

### 现行和遗产交互路径

根源,样本和登录已被废除了2026-07-28的新实现.一个门户只能保留旧的请求频道代码作为一个版本关闭的兼容路径.

不要围绕每次采样限制器构建新的防御.将配额应用于认证的资本,发行商,资源,工具和时间窗口.对于当前互动工作,检查MRTR输入请求和响应.

### 无国籍交通检查

- 在单个POST终端点接受现代MCP消息.
- 返回405的现代GET和 DELETE.
- 不要或依赖`Mcp-Session-Id`现在,我们要去.
- 忽略旧会议,并将标题作为权威输入.
- 返回JSON或请求扫描SSE用于该POST.
- 使用`subscriptions/listen`只有选择长期变更通知.

```figure
tp-tool-poisoning
```

## 建立它

`code/main.py`实现了小型的过程中安全网关模型. 它可规范和入完整的工具描述符,报告了元数据中毒和阴影,验证了现代的请求包裹和路由值,并执行了签署的两轮确认出口`requestState`并且有一个注射共享播放商店.

模型启动后,HTTP适配器已经解析了JSON体和路由标题.它不验证`Content-Type`或`Accept`连接同一个发送器到课程09的完整的流式HTTP适配器,需要`Content-Type: application/json`其他`Accept`含有两者中的值`application/json`其他`text/event-stream`现在,我们要去.

运行它:

```bash
cd phases/13-tools-and-protocols/15-mcp-security-tool-poisoning
python3 code/main.py
npx tsx code/main.ts
python3 -m unittest discover code/tests -v
```

检测器和消化比较产生独立的发现. 进口后证明了`input_required`没有国家,再试一次.

## 用它

取代`SAFE_TOOLS`通过您的自行批准的服务器进行正常化的快照. 保持凭证和秘密在快照中. 在更新其消化之前,请检查每一个新的或更改的描述符.

在门口,在发现期间和发送前再次执行相同的检查.缓存可以减少发现工作,但在描述符变化时,缓存批准必须过期或无效.

## 运送它

这一课是很好的.`outputs/skill-mcp-threat-model.md`它在元数据,路由,能力,授权,MRTR,缓存,注册表和兼容性界限中生成了当前协议威胁模型.

## 运动

1. 绑定验证的主和当前授权决定与密封的MRTR状态,然后拒绝以不同的主体重新尝试.
2. 换取内存重播存储器的持续条件插入,证明两个过程都不能要求一个不存在.
3. 输入复制索赔后,但在模拟出口之前,注入故障.定义和测试使恢复安全的交易或无效规则.
4. 换一个工具`inputSchema`确认整个描述符的接抓住它.
5. 加入一个政策,拒绝公共缓存,`tools/list`根据主管的不同.
6. 设置一个旧服务器后面的门口.`2025-11-25`互动性分支

## 关键词

| Term | Meaning |
|------|---------|
| Metadata poisoning | Instructions or deceptive claims embedded in a tool descriptor |
| Rug pull | Change to a previously approved descriptor |
| Tool shadowing | Ambiguous routing caused by duplicate unqualified names |
| Header mismatch | Routing header and JSON-RPC body disagreement, error `-32020` |
| Hash pin | Digest of the complete approved descriptor |
| MRTR | Stateless response and retry pattern for server-requested input |
| `requestState` | Opaque round-trip value that must be treated as untrusted input |
| Capability declaration | Statement of protocol compatibility, not authorization |
| Implicit form support | An empty `elicitation` capability object, equivalent to form support |
| Qualified tool name | Stable gateway name such as `notes.search` |

## 进一步阅读

- [MCP security and trust guidance](https://modelcontextprotocol.io/specification/2026-07-28#security-and-trust--safety)
- [Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Deprecated features](https://modelcontextprotocol.io/specification/2026-07-28/deprecated)
