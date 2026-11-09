# 关于MCP工具合同和内容

> 发现,论证,结果,页面化和运输元数据在一个合同时才安全自动化工具.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13, Lessons 07, 09, and 10
**Time:** ~120 minutes

## 学习目标

- 定义工具输入和输出,使用JSON Schema 2020-12.
- 验证结构化结果,而不假设它们是JSON对象.
- 选择文本,图像,音频,资源链接和嵌入式资源.
- 拒绝不安全`x-mcp-header`在工具达到模型之前,定义.
- 编码参数标题值并验证标题对体的准确平衡.
- 通过线程页面化,而不解释线程值.
- 绑定和授权`completion/complete`提供建议.

## 问题

通过人工智能主机调用远程功能是一个合同问题.

服务器发布描述器.客户端将描述器转换为模型文本和用户界面.模型创建参数.一个门户端可以从镜头标题中引导请求.服务器执行工具.客户端然后决定结果是否安全和有效足以返回模型.

一个弱的边界破坏了整个链.

考虑五种失败:

- 描述符说结果是对象,但服务器返回了阵列.
- 客户端停止页面化时`nextCursor`没有任何东西.
- 标志参数被反射到HTTP标题中,并成为中间人可见的.
- 作为原始标题,发送一个Unicode路由值,然后门口和来源解释不同的字节.
- 完成终点向无法访问的通话者提供生产环境.

任何这些故障都不能通过更好的提示来解决.

## 合同管道

处理每个工具通话作为五个门:

1. **Discover.**阅读一个确定性,页面化的工具列表.
2. **Admit.**验证每个描述符并应用本地安全政策.
3. **Invoke.**验证参数和构建运输元数据.
4. **Execute.**运行操作器,并正确分类故障.
5. **Consume.**在使用模型之前验证内容块和结构化输出.

```figure
mcp-contract-pipeline
```

服务器不能强迫客户端相信其注释,方案或输出.

##  JSON 方案是运行时间的界限

在MCP中`2026-07-28`现在`inputSchema`其他`outputSchema`使用JSON图案.`$schema`如果没有,默认方言是2020-12.

输入方案必须是方案对象. 没有参数的工具仍然应该说它接受的内容:

```json
{
  "type": "object",
  "additionalProperties": false
}
```

这比`{ "type": "object" }`通过""来实现,

一旦服务器发布一个,每个完整的工具都会使用
结果承诺返回符合`structuredContent`含结果
随着`isError: true`错误标志分类执行结果;它没有
客户应该验证结果,
对于信任描述者.

### 结构化内容是任何JSON值

不要硬码`structuredContent`作为一个词典.

- 一个物体;
- 一个阵列;
- 一条弦;
- 一个号码;
- 一个布尔式;
- `null`现在,我们要去.

这个工具返回一个阵列:

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

结果是有效的:

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

为了实现兼容性,结构化结果还应包含文本块中的串行 JSON.文本不是验证源. `structuredContent`是的.

### 一个小的验证器仍然教导了边界

课程使用了故意的JSON Schema子集,因为它留在Python标准库内.它检查了样本工具所使用的机制:

- 对象,数组,字符串,整数,数,布尔式和零类型;
- 要求的特性;
- `additionalProperties: false`其他
- 阵列项;
- 值值;
- 弦长度最低.

这不是替代一个完整的生产验证器.可重复使用的课程是验证发生的地方:在描述器的发现后,在执行论证之前,在结构化结果的消费之前.

## 内容块的成本不同

其他`content`列可以结合多种内容类型.

| Type | Use it for | Main boundary |
|------|------------|---------------|
| `text` | Human and model-readable summaries | Treat text as untrusted output |
| `image` | Visual evidence encoded as base64 | Validate media type and size |
| `audio` | Spoken or recorded output encoded as base64 | Validate media type and duration limits |
| `resource_link` | A URI the client may fetch later | Reauthorize the later resource read |
| `resource` | Data embedded directly in the result | Enforce payload and content limits now |

资源链接不是证明资源在 `resources/list`客户端仍然在遵循URI时应用其资源政策.

嵌入式资源避免了再一次回路,但增加了当前响应规模. 使用链接用于大型或独立变化的文物. 使用嵌入式资源用于小证据,必须随结果进行原子旅行.

我们学会了什么?`evidence_bundle`客户端在接受结果之前验证每个区块.

## `x-mcp-header`转向转移数据

房子里面的房产`inputSchema`声明`x-mcp-header`通过流式HTTP,客户端将该参数反映在`Mcp-Param-{name}`现在,我们要去.

```json
{
  "region": {
    "type": "string",
    "x-mcp-header": "Region"
  }
}
```

随着`region: "eu-west"`运输可能会发射:

```http
Mcp-Param-Region: eu-west
```

标注存在于一个负载平衡器,门户或政策引擎可以在没有解析JSON体内进行路由.

协议限制了注释:

- 标题名称是无空的,并遵循HTTP字段名称代码语法;
- 标题名称是不论情况如何,均为独一无二的;
- 属性类型是字符串,整数或布尔式;
- `number`禁止使用;
- 标注仅出现在直接成员的`inputSchema.properties`其他
- 整数值保持在`-9007199254740991`通过`9007199254740991`现在,我们要去.

位置规则是语法和失败关闭. 走整个图案树,
您的验证器不仅了解了这些特性.
嵌套物体下面的注释`properties`其他`oneOf`部门`items`其他
定义`$ref`解决一个引用的方法是
没有将引用的节点转化为直接的顶级属性.

这一课增加了部署政策:拒绝反映如`password`现在`secret`现在`token`现在`api_key`其他`authorization`服务器作者不应该反映敏感参数. 客户端可以把这些建议变成一个严格的录取规则.

检查标题名称,而不是其值.`Mcp-Param-Region`在保持`eu-west`审计活动中.

### 在构建HTTP标题之前编码值

参数值只能作为平文传输,只能是不空字符串
可见的ASCII字符`!`通过`~`没有任何相似的
其他一切都用了这个形式:

```text
=?base64?{Base64UTF8}?=
```

`Base64UTF8`标准的Base64是 UTF-8字节的标准.
编码 Unicode,空字符串,空间,
标签,控制字符,CR或LF,前线或后线白色空间,任何
开始的值`=?base64?`编码一个看起来像哨兵的值是
接收器可以恢复文字原始文本,而不是解码
作为交通语法.

布尔语是小字母.`true`或`false`在基础10中呈现的整数和
值必须在 JavaScript 安全整数范围内留下.
它们被中介拒绝而不是圆.

### 服务器检查镜像复印件

在流式HTTP界限上,
服务器必须:

1. 发现被认可`Mcp-Param-*`名称,不考虑标题名称情况;
2. 现有时,将精确的base64哨兵形式解码;
3. 完全将解码的文本与相应的JSON体参数进行比较;
4. 拒绝丢失,复制,意想不到,错形或不匹配的东西
   在发送前识别标题.

拒绝是HTTP`400`使用JSON-RPC错误代码`-32020`没有任何一个
审计记录中,该表格的编码标题形式也不属于审计记录.
仅承认标题名称和拒绝类别.

`code/main.py`直接模拟这个边界.[Lesson 09](../../09-mcp-transports/)
涵盖了更广泛的 Streamable HTTP 验证顺序,包括方法和
协议版本平衡.

## 页面曲器是不透明的

服务器选择页面大小和线程格式.客户端得到一个决定:

```python
if result.get("nextCursor") is None:
    break
cursor = result["nextCursor"]
```

不要写这句话:

```python
if not result.get("nextCursor"):
    break
```

没有字符串是有效的线索.

客户端不得解码一个线索,增加它,与之前的线索进行订单,或推断页面号码.服务器可以签署一个线索,将其绑定到目录版本,或将其映射到私有状态.这是服务器的实现细节.

样本服务器故意返回`""`客户端必须在第二次请求中发送这个值.

```text
<first request with no cursor>
<second request with cursor "">
```

无效的缓冲器生成 JSON-RPC无效参数,代码 `-32602`现在,我们要去.

## 完成是授权的表面

`completion/complete`提供快速参数和资源模板参数的建议. 它对于交互式表格是有用的,但它可以泄露普通列表方法保护的名称.

完成请求中,引用和完成的论点:

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

结果返回最多100个值,并且可以报告`total`另外`hasMore`现在,我们要去.

应用引用提示或资源使用的相同授权界限.`development`其他`staging`只有一个运营商才能接收`production`现在,我们要去.

生产完成还需要:

- 输入验证;
- 电话通讯过;
- 要求在客户中撤销;
- 在服务器中限制速度;
- 限制结果数量;
- 没有暴露敏感的建议值的日志.

完成是协助,而不是发现的绕行.

## 两个错误层

保持协议错误与工具执行错误分开.

使用JSON-RPC错误,当MCP请求无法正确发送时:

- 工具名称未知;
- 要求形状不良;
- 缺失请求元数据;
- 无效的标记器.

使用完整的工具结果`isError: true`要求到达工具时,工具报告可执行的故障:

- 报告来源不可使用;
- 日期不在支持范围之外;
- 商业规则拒绝请求的操作.

模型通常可以修复工具执行错误.它们不能修复违反其自己的输出方案的服务器.

如果工具声明出口方案,模型可以操作的故障在
图案,样本`route_report`失败返回其请求区域
`accepted: false`通过使用的文件,`isError: true`现在,我们要去.

## 建立它

`code/main.py`通过Python标准库构建边界的两侧.

服务器实现:

- 根据要求验证MCP元数据;
- `server/discover`具有工具和完成能力;
- 确定性`tools/list`页面化;
- 四个工具描述符,其中一个必须被拒绝;
- 阵列结构输出;
- 每个当前工具内容块类型;
- 通过 HTTP 流式等值门来解码已识别的参数标题和
  返回 HTTP `400`加上JSON-RPC`-32020`没有匹配的情况;
- 授权和限额完成.

客户执行:

- 描述符的录取;
- 树`x-mcp-header`定位验证和敏感领域政策;
- 精确可见ASCII或base64 UTF-8值编码;
- 无透明的针循环,遵循一个空串;
- 论证和结果验证;
- 内容区块验证;
- 标题审计事件包含名称,但不是值.

无人为人所知的描述符是教学数据. 它证明一个被拒绝的工具不会阻止有效的工具加载.

## 用它

根据数据库根:

```bash
cd phases/13-tools-and-protocols/28-mcp-tool-contracts-and-content/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

演示版允许的工具,拒绝的描述符,
要求,结构化数组内容,内容区块类型,镜头标题
名称,无论是需要编码的值,HTTP等级状态,以及
调用器过完成值.

## 互动实验室

开放`code/main.py`查找`TOOLS`现在,我们要去.

1. 改变`tag_catalog.outputSchema.type`其他`array`为了`object`现在,我们要去.
2. 运行演示,客户端应该拒绝返回的阵列.
3. 恢复方案.
4. 保持第一页的.`nextCursor`作为`""`然后返回最后一页
   `nextCursor: None`没有遗漏这个领域.
5. 运行测试,并比较导向器的痕迹.
6. 加入`x-mcp-header: "Authorization"`它们是指一个字符串的属性.
7. 确认描述符的录取在调用之前拒绝.
8. 试试吧`region`包含 Unicode,新线,周围空间的值,以及
   字面上文本`=?base64?SGVsbG8=?=`解码发射的每个标题,并证明
   基本值仍然是正确的.
9. 移动注释到`oneOf`现在`items`其他`$ref`确认
   每个描述符都被拒绝,即使该分支从未被演示程序使用.
10. 删除已识别的标题或更改其解码值.确认HTTP
    边界返回状态`400`和JSON-RPC代码`-32020`现在,我们要去.

目的不是记住一个JSON形状,而是观察每个门在它所有的边界失败.

## 实践实验室

扩大合同实验室`search_evidence`工具.

要求:

1. 它的输入方案接受`query`现在`limit`并且有一个安全柜`region`路由场
2. 它的输出方案是具有 的对象数组.`uri`现在`title`其他`score`现在,我们要去.
3. 结果包括每个项目兼容性文本和资源链接.
4. 论证拒绝了未知的属性.
5. `limit`申请验证的限制.
6. 没有访问一个URI的调用者从来没有看到完成或工具输出的URI.
7. 测试包括不符合分数,无效标题注释,以及两页列表.
8. 标题值测试涵盖可见的ASCII,Unicode,控制字符,
   它们都具有 JavaScript 安全的整数界限.
9.  HTTP 装置接受不敏感的标题名称,但拒绝缺失
   或与地位相匹配的认可值不一致`400`及代码`-32020`现在,我们要去.

## 运输的文物

`outputs/skill-mcp-contract-reviewer.md`提供工具描述符,样本结果,页面化行为和完成政策.它返回录取决定,结果验证计划,标题政策和具体失败测试.

## 检查

如果这些说法是真的,课程就会完整:

- `tools/list`在重复通话时返回相同的逻辑顺序.
- 客户在`nextCursor`是`""`现在,我们要去.
- 其他工具仍可用,而不安全的敏感标题描述器被排除在外.
- 一个阵列通过其阵列输出方案.
- 它们是对象的.
- 错误结果不能忽略或违反已发布的输出方案.
- 文字,图像,音频,资源链接和嵌入式资源块验证.
- 标题审计事件包含名称,没有值.
- 简单可见的ASCII仍然是简单的; 统一码,控制,填充,空,
  通过精确的base64 UTF-8编码,看起来像哨兵的值往返.
- 拒绝除JavaScript安全范围之外的镜像整数.
- 下列说明`oneOf`现在`items`嵌物体`$ref`定义或
  在入学期间,输出方案被拒绝.
- 只有解码值时,可通过无情案例的认可标题名称
  完全匹配体;缺失或不匹配的副本产生HTTP `400`
  及JSON-RPC`-32020`现在,我们要去.
- 分析师的完成永远不会回来`production`现在,我们要去.
- 工具故障使用`isError: true`错误的协议调用使用JSON-RPC`error`现在,我们要去.

## 生产失败模式

| Failure | What the learner sees | Correct response |
|---------|-----------------------|------------------|
| Client assumes object output | Valid arrays fail or are silently wrapped | Validate against the published schema without object-only types |
| Empty cursor treated as false | Final pages disappear | Continue whenever `nextCursor` is present and non-null |
| Sensitive value mirrored | Secret appears in proxy, WAF, or trace data | Reject the descriptor and keep secrets in protected request data |
| Raw Unicode or whitespace mirrored | Gateway and origin disagree or the value is normalized | Use exact base64 UTF-8 sentinel encoding and compare after decoding |
| Annotation hidden in a schema branch | A client misses routing metadata during admission | Traverse the entire schema tree and allow only direct top-level properties |
| Large integer mirrored | JavaScript intermediary rounds the routing value | Reject values outside the JavaScript safe integer range |
| Header and body disagree | Gateway routes one target while the origin executes another | Reject before dispatch with HTTP `400` and JSON-RPC `-32020` |
| Output schema ignored | Downstream code consumes corrupt structure | Validate before model or application use |
| Resource link trusted automatically | Caller follows an unauthorized URI | Reauthorize every resource read |
| Completion shares global suggestions | Hidden tenant names leak | Filter by caller, reference, and authorization |
| Tool annotations treated as policy | Destructive operation bypasses confirmation | Enforce authorization and approval outside annotations |
| One malformed tool breaks discovery | Entire server becomes unavailable | Reject the bad descriptor and admit valid tools independently |

## 石连接

阶段13的终点石需要一个可以将几个服务器的工具合并的门户.

通过该文物来分类四件石头证据:

- 确定性和完整的页面化发现;
- 在模型暴露之前验证描述符;
- 验证的结构化输出加上有界限的内容块;
- 完成和路由以保留授权界限的元数据.

没有成功的网关兼容性`tools/call`记录描述符,页面追踪,被允许的工具集,被拒绝的工具集,以及一个验证结果.

## 关键词

| Term | Meaning |
|------|---------|
| `inputSchema` | JSON Schema object defining accepted tool arguments |
| `outputSchema` | Optional JSON Schema defining `structuredContent` |
| `structuredContent` | Any JSON value produced by a tool result |
| Content block | Typed text, image, audio, resource link, or embedded resource |
| `x-mcp-header` | Schema annotation that mirrors a primitive argument into Streamable HTTP metadata |
| Opaque cursor | Server-issued pagination token whose value the client does not interpret |
| Completion reference | Prompt name or resource URI/template whose argument is being completed |
| Admission | Client decision to expose or reject a discovered descriptor |

## 进一步阅读

- [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- [MCP Completion](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/completion)
- [MCP Pagination](https://modelcontextprotocol.io/specification/2026-07-28/server/utilities/pagination)
- [MCP Streamable HTTP Parameter Headers](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http#custom-headers-from-tool-parameters)
