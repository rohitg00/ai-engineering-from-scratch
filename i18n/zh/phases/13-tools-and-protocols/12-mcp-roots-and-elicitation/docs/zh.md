# 显而易见的范围和无国籍申请

> 根源在MCP 2026-07-28中已经过时,从来没有成为安全沙箱.将可见工具参数或资源URI进行范围,在服务器上授权,并在工具真正需要用户输入时使用MRTR.用户看到决定,模型看到手柄,任何服务器实例都可以处理重试.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 11 (stateless MRTR)
**Time:** ~60 minutes

## 学习目标

- 替换过时的 Roots 用明确的工作空间参数,资源URI或服务器配置.
- 允许,路径控制和操作系统砂盒的分别范围提示.
- 交付方式`elicitation/create`通过MRTR`input_required`结果.
- 广告在客户端要求能力中进行调试支持,拒绝不支持模式.
- 验证`accept`现在`decline`其他`cancel`它们的结果是明确的.
- 绑定破坏性确认与认证的主体,原始参数,候选组,和过期.

## 两个相似的问题

一个备注工具收到这样的请求:"删除旧的TPS报告".

服务器必须回答两个不同的问题.

1. 哪个工作场所可能会受到这次行动的影响?
2. 用户指的是哪一个相匹配的三张音符?

首先是范围和授权.第二个是互动的歧义. 混合它们导致危险的设计,例如将客户提供的文件作为证明,呼叫者可能会删除它内的所有内容.

## 根源是移民的表面

之前的MCP修改允许客户端广告Roots并通知服务器当清单发生变化时.Roots是信息指导.它们没有限制服务器进程可以读到什么,没有授权调用者,也不创建操作系统沙箱.

欧盟2026-07-28年计划已被废除`roots/list`其他`notifications/roots/list_changed`对于新设计,最好选择以下明确的替代品之一:

- `workspaceUri`或`directory`工具参数,当范围因调用而异.
- 运行已经针对资源时的资源URI.
- 服务器配置,当一个部署拥有一个固定工作空间时.
- 进程沙箱或关闭的文件系统,当代码技术上不能逃脱时.

如果目前的2026-07-28的整合仍需要`roots/list`在截止窗口期间,服务器将其嵌入MRTR `inputRequests`它们不能发送现场反转请求. 这是一种迁移适配器,而新的处理器应该接受明确的范围.

隐藏的运输会议范围更难检查,重播,审核和路线.

### 三个层的规则

显而易见的URI仍然没有授权自己.

1. **Authorization:**证实的校长是否可以使用这个工作空间?
2. **Containment:**标准化目标URI是否保持在授权工作空间边界内?
3. **Sandbox:**操作系统能阻止一个受损的服务器逃离吗?

运行式服务器保留授权工作空间URI的允许列表,正常化百分比编码的路径,检查实际的路径组件边界,并在删除前立即重新检查封存.

简单的字符串前检查是错误的:

```text
allowed:   file:///work/notes
attacker:  file:///work/notes-evil/secret.md
traversal: file:///work/notes/%2e%2e/private.md
```

两个敌对的路径都以误导性字符串开始.首先将路径组件正常化,然后比较.一个生产文件系统服务器也必须防范符号链接竞赛和平台特定的路径语义.

## 申请仍然存在,但交付改变

调用是当前客户端功能,用于收集用户输入`tools/call`现在`prompts/get`其他`resources/read`方法名称仍然存在`elicitation/create`电线流的方向发生了变化.

服务器不会发送反转JSON-RPC请求.`InputRequiredResult`其他:

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

客户端将表格转换.用户可以接受,明确拒绝或拒绝.`tools/call`具有新身份证:

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

两个调用之间没有协议会议.服务器验证了回声状态,验证了对预期方案的响应,检查选定的笔记是否在签署的候选组中,重新授权工作空间,重新检查包含,然后删除.

## 根据要求进行能力谈判

支持表格模式调用的客户端声明:

```json
{
  "io.modelcontextprotocol/clientCapabilities": {
    "elicitation": {"form": {}}
  }
}
```

没有任何动力,`"elicitation": {}`其他类型的支持,但仅仅是形式的支持.`"elicitation": {"form": {}}`支持表格模式. 仅使用URL的声明,`"elicitation": {"url": {}}`服务器不得嵌入一个没有当前请求功能的模式,即使在一个早期请求中广告它.

每个请求都包含`io.modelcontextprotocol/protocolVersion`输出一个缺失或非字符串版本`-32602`没有支持的字符串返回`-32022`确切的`supported`其他`requested`缺失或仅使用URL的请求支持返回`-32021`随着`data.requiredCapabilities`设置为`{"elicitation":{"form":{}}}`现在,我们要去.

没有JSON-RPC的封面`id`通过JSON-RPC,将数据处理到一个消息中,并将数据处理到一个消息中.`202 Accepted`没有尸体.

`clientInfo`必须在诊断中包含,但它是自主报告的,不能识别用户的授权.

服务器实现`server/discover`利率`supportedVersions`其他国家`ttlMs`其他`cacheScope`随着`resultType: "complete"`由于它宣传工具,它也实施强制性`tools/list`结果返回了确定性`notes_delete`描述符,一个有效的对象`inputSchema`服务器身份元数据,以及公共缓存提示.

## 形式模式

形式模式使用用于可用对话的限制JSON方案.根是一个对象,其属性是平原原始字段或支持的enum阵列.深嵌的对象和一般用途的文档方案不属于确认对话.

使用表格模式:

- 选择几个候选人中的一个;
- 确认破坏性操作;
- 收集非敏感偏好;
- 收集少量的值,用户而不是模型必须决定.

对于密码,API密钥,访问代币或支付凭证,不要使用表格模式.这些秘密将通过MCP客户端传递,可能会进入日志或模型文本.

服务器再次验证返回的内容.客户端形式验证改善了UX,但不会产生信任.

## URL模式

转载方式将安全的网址发送到带外交互:

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

客户端在开放之前显示完整的目的地,并获得同意.它不得先查询URL.

`accept`响应是用户同意打开URL.它不证明外部流程完成.在重试时,服务器检查了自己的状态,然后完成或返回另一个状态.`input_required`结果.

URL发动不是MCP客户端和MCP服务器之间的授权的替代品.它是MCP服务器需要代表用户进行外部互动的原因.服务器必须将浏览器用户绑定到启动MCP操作的相同认证主题.

## 应对部门

处理行动作为产品决定,而不是伪称:

| Action | Meaning | Safe server behavior |
|--------|---------|----------------------|
| `accept` | User submitted the interaction | Validate content and continue |
| `decline` | User explicitly refused | Return a complete, non-error refusal outcome |
| `cancel` | User dismissed or could not finish | Stop safely and allow a later retry |

永远不要把缺失内容解释为同意.

## 保护破坏性MRTR状态

候选人列表不能只存在一个提示或未签署的 Base64值. 客户端控制了它回发的一切.

课程签署了包含:

- 证实的资本;
- 产品来源方法;
- 消化`workspaceUri`其他`title`其他
- 在表格中显示的允许的注册表;
- 运营阶段;
- 短期期.

在突变之前,服务器还检查了现场记录. 这捕获了删除比赛和表格显示后移动到工作空间之外的目标.

对于一次性金融或不可逆转的行动,仅HMAC不能阻止在到期期间重复有效状态. 存储和消耗一个nonce,在每一个处理器实例共享的重播商店. 课程注入了一个有限的,TTL切割的存储器,并保持其原子声称,同时执行内存删除. 生产数据库应将非实质性索赔和突变结合到一个交易或相当的条件性写字边界.

要求不合格的反应或 否则`cancel`没有发生突变,并且可以在到期之前恢复状态.`decline`课程是终极的,所以课程消耗了无数的内容,而不会删除任何内容.

```figure
t3-roots-boundary
```

## 建立它

`code/main.py`证明了现代化的`notes_delete`工具:

- `tools/list`返回一个确定性,可缓存的描述符,包含所需的工作空间和标题方案.
- 范围是明确的`workspaceUri`关于一个问题.
- 服务器配置允许课程主任使用该工作空间.
-  URI正常化拒绝预写混和编码的穿越.
- 任何破坏性删除都需要形式模式的引发.
- 诱惑的过程是进入的.`resultType: "input_required"`现在,我们要去.
- 签署`requestState`结合了具体的候选人名单和原始参数.
- 注射的重播存储器在服务器实例中拒绝相同的接受或拒绝状态.
- 重新尝试使用新的请求ID,并返回`resultType: "complete"`现在,我们要去.

数据存储器存储在内存中,因此协议行为很容易检查.

## 用它

根据数据库根:

```bash
cd phases/13-tools-and-protocols/12-mcp-roots-and-elicitation/code
python3 main.py
npx tsx main.ts
python3 -m unittest discover tests -v
```

预期的检查站:

- 发现广告没有根的工具.
- 工具发现返回`notes_delete`随着`resultType`服务器身份,缓存提示.
- 申请身份`1`返回表格`inputRequests.delete_choice`现在,我们要去.
- 申请身份`2`标签状态和删除完成.
- 预सर्ग路径和加码的穿越路径都无法控制.
- 改名不能重新使用原始确认状态.
- 幅不变,则笔记没有变.
- 两个共享注释和重播状态的服务器对象不能执行一个确认.
- 空格和明确的表格声明有效,而仅支持URL则返回准确的信息`-32021`形式要求.
- 没有支持的版本故障使用了精确的`-32022`数据形状.
- 没有 id 的通知不会产生 JSON-RPC 响应.

## 运送它

`outputs/skill-elicitation-form-designer.md`设计了明确的范围,授权检查,MRTR表格,响应分支和状态绑定.它拒绝将废旧的根作为沙盒或通过表格模式收集秘密.

## 运动

1. 通过 SQLite 取代内存重播存储器. 使用一个交易来索赔非值并删除笔记,然后证明两个进程都不能承诺.
2. 加入`url`保持第三方的凭证远离`inputResponses`现在,我们要去.
3. 通过临时的SQLite数据库来取代内存记忆图.
4. 添加一个符号链接政策来实现真正的文件系统.解释为什么单独的URI词汇控制不能阻止符号链接逃逸.
5. 设计一个2025-11-25适配器,将现代MRTR处理器输出映射到传统的服务器启动的发动.将其与当前处理器隔离.

## 关键词

| Term | Meaning in 2026-07-28 |
|------|------------------------|
| Roots | Deprecated informational workspace hints, not authorization or sandboxing |
| Explicit scope | Workspace, directory, or resource handle visible in request arguments |
| Containment | Normalized path-component check that keeps a target inside a boundary |
| Elicitation | Client feature for obtaining user input during an MCP operation |
| Form mode | In-band structured user input using a restricted flat schema |
| URL mode | Out-of-band interaction for sensitive or external workflows |
| MRTR | Stateless input-required result followed by a fresh retry |
| `requestState` | Opaque state echoed exactly and integrity-checked by the server |
| Decline | Explicit user refusal |
| Cancel | Dismissal or incomplete interaction without approval |

## 遗产兼容性

对于一个同龄人,被定制在2025-11-25`roots/list`现在`notifications/roots/list_changed`通过直播服务器启动`elicitation/create`标签适配器遗产. 勿允许一个遗产的根列表绕过服务器授权,并且不要将协议-会议假设带入现代处理器.

## 进一步阅读

- [MCP 2026-07-28 Elicitation](https://modelcontextprotocol.io/specification/2026-07-28/client/elicitation)
- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 Roots deprecation](https://modelcontextprotocol.io/specification/2026-07-28/client/roots)
- [MCP 2026-07-28 server discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
