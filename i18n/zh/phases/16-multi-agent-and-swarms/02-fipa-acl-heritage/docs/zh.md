# 国际国际贸易协会 (FIPA-ACL) 的遗产和演讲法

> 在MCP之前,A2A之前,有FIPA-ACL. 2000年,智能物理代理基金会 (FIPA,于2005年成为IEEE计算机协会标准委员会) 批准了一个有二十个执行语言,两个内容语言和一组互动协议的代理通信语言. 它从行业中消失了,因为对网络的ontology上层费用太重了,但多代理系统的LLM复兴正在地重新实现相同的想法, 这一课将FIPA-ACL认真读取,以便您可以看到2026年协议的决定是什么,是什么新奇,

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## 问题

2026年代理协议景观繁忙:工具的MCP,代理的A2A,企业审计的ACP,分散信任的ANP,自然语言内容的NLIP,加上CA-MCP和两十个研究提案.

诚实地说,他们中的大多数人正在重新发现一个20岁的决定树. 语音行为理论来自奥斯 (1962) 和塞尔 (1969) 给了我们"表达是行动". 国际合资联盟 (批准2000年) 制订了参考标准化:二十个执行语言,内容语言SL0/SL1,互动协议合同网和订阅通知. 杰德和杰克是Java的参考平台. 2010年左右,这项努力然消逝,因为对应性成本太大,

当你看看MCP时`tools/call`了解传统告诉你两件事:哪些新"创新"实际上是重发发,以及哪些旧失败模式新规将重新发现.

## 概念

### 演讲行为,在一段

奥斯注意到,有些句子没有描述世界, "我承诺. " "我要求. " "我宣布. "他称这些表演演讲. 塞尔尔正式化了五种类别:断言性,指令性,委托性,表达性和声明性. 对于软件代理人来说,KQML (Finin等人,1993) 已经使这一点运行起来:一个信息是执行 (行动) 加上内容 (行动是什么). 国际标准化协会 (FIPA-ACL) 清理了KQML的缺陷,并标准化了大约20个表演.

### 国际金融协会20个执行项 (部分列表)

| Performative | Intent |
|---|---|
| `inform` | "I tell you P is true" |
| `request` | "I ask you to do X" |
| `query-if` | "Is P true?" |
| `query-ref` | "What is the value of X?" |
| `propose` | "I propose we do X" |
| `accept-proposal` | "I accept the proposal" |
| `reject-proposal` | "I reject the proposal" |
| `agree` | "I agree to do X" |
| `refuse` | "I refuse to do X" |
| `confirm` | "I confirm P is true" |
| `disconfirm` | "I deny P" |
| `not-understood` | "Your message did not parse" |
| `cfp` | "Call for proposals on X" |
| `subscribe` | "Notify me when X changes" |
| `cancel` | "Cancel the ongoing X" |
| `failure` | "I tried X and failed" |

完整的列表在`fipa00037.pdf`问题不是记住它,问题是,每个这些都与一个原始的 LLM 协议最终重新添加.

### 标准的FIPA-ACL信息

```
(inform
  :sender       agent1@platform
  :receiver     agent2@platform
  :content      "((price IBM 83))"
  :language     SL0
  :ontology     finance
  :protocol     fipa-request
  :conversation-id   conv-42
  :reply-with   msg-17
)
```

七个字段包含协议封面;一个字段 (`content`其他领域是你每次重新发明的,每次将重试,线程和ontology转载到JSON协议上.

### 两个传统平台

**JADE**(Java Agent DEvelopment framework, 19992020s) 是最常用的符合FIPA的运行时间.代理扩展了一个基类,交换ACL消息,运行在容器内,并通过"行为"协调.

**JACK**作为一个"非正式的,不太受欢迎的" (FIPA) 信息的基础上,BDI (信仰-愿望-意图) 的推理强调了.

两者都在网页堆吃了多代理使用案例后减少.MCP和A2A是2026年的运行时间"容器".

### 为什么FIPA淡

- **Ontology overhead.**国际金融协会要求进行共享的分析`content`网络只是使用HTTP+JSON.
- **Formal semantics nobody used.**语义语言 (SL) 提供了严格的真相条件,但大多数生产系统使用了自由形式的内容,并忽略了形式主义.
- **Tooling lock-in.**简单的说法是Java,简单的说法是JACK.
- **The internet won the stack.**后来是JSON-RPC,然后是gRPC取代了ACL的运输.

### 法律法师复兴是FIPA-lite

比较一个FIPA`request`向一个MCP`tools/call`其他:

```
(request                                {
  :sender  agent1                         "jsonrpc": "2.0",
  :receiver tool-server                   "method":  "tools/call",
  :content "(lookup stock IBM)"           "params":  {"name":"lookup_stock",
  :ontology finance                                   "arguments":{"symbol":"IBM"}},
  :conversation-id c42                    "id": 42
)                                        }
```

两者都包含:谁,谁,意图,有效载荷,相关性ID. 两者都不是一个革命对另一个.

等人在2025年进行的调查 ("MCP, ACP, A2A, ANP的调查"),使这一谱系明确:MCP与工具使用语音行为,A2A与代理同行语音行为,ACP与审计轨道语音行为,ANP与分散身份扩展等相关.新规格是ACL后代,具有JSON语法和较宽松的语义.

### 交易,明确表示

**What FIPA gave you and modern specs drop:**

- 形式语义,你可以证明.`inform`意思是发送者相信内容.
- ,你不必再说"如果我们有"`cancel`没有什么可做.
- 几十年的互动协议模式 合同网,订阅-通知,提出-接受 已知正确性特性.

**What modern specs give you and FIPA did not:**

- 基于JSON的有效载荷,与所有现代工具兼容.
- 法律法师可以在没有手编码的托学的情况下解释的自然语言内容.
- 网络堆运输 (HTTP,SSE,WebSocket).
- 通过现场MCP发现能力`server/discover`,我还在.

为了更轻松地实现,更宽松的意图语义.

### 值得移植的交互协议

国际金融协会发送了15个互动协议.三个值得将转载到LLM多代理系统:

1. **Contract Net Protocol (CNP).**管理者问题`cfp`投标者回答:`propose`管理者接受/拒绝. 这就是常规的任务市场模式 (16 · 16 阶段的谈判).
2. **Subscribe/Notify.**订阅者发送`subscribe`出版商发送`inform`这就是2026年的每一个活动.
3. **Request-When.**"当条件 Y 维持时做X". 延迟操作与预先条件. 2026 模拟是耐用工作流动引擎中的延迟任务 (阶段 16 · 22 生产规模化).

每个图片都清晰地将信息排队,HTTP+投票或SSE流量进行排列.

### 当你放弃了理学时,什么会破裂

没有共享的定学,代理从自然语言内容中推断意义.**semantic drift**:两个代理使用相同的词 (`"customer"`) 对微妙不同的概念,接收者的代理人根据错误的解释行动,没有方案验证器抓住它.FIPA的学要求将在解析时拒绝信息.

减轻没有完全的定性:

-  JSON 方案`content`拒绝电线结构错误.
- 类型的文物 (A2A) 拒绝了错误的模式.
- 封面中的明确执行性使意图不含糊,即使内容是自然语言.

### 2026年规格,与演讲行为遗产相匹配

| Modern spec | FIPA analog | What it keeps | What it drops |
|---|---|---|---|
| MCP `tools/call` | `request` | explicit intent, correlation id | formal semantics, ontology |
| MCP `resources/read` | `query-ref` | explicit intent, correlation id | formal semantics |
| A2A Task lifecycle | contract-net + request-when | async lifecycle, state transitions | formal completeness guarantees |
| A2A streaming events | subscribe/notify | async push | typed-predicate subscription |
| CA-MCP shared context | blackboard (Hayes-Roth 1985) | multi-writer shared memory | logical consistency model |
| NLIP | natural-language content | LLM-native | schema |

阅读表表上至下,模式是:保持结构原始,放弃形式主义,让LLM在模糊性上写下.

```figure
sw-contract-net
```

## 建立它

`code/main.py`实现了纯stdlib的FIPA-ACL翻译器.它编码和解码了正规的ACL包裹,并显示了每个MCP/A2A消息形状如何缩小到相同的七个字段.演示:

- 编码五个MCP式和A2A式消息为FIPA-ACL.
- 解码FIPA-ACL回到现代相当.
- 运行一个玩具 合同 经理和三位投标者之间的网络谈判`cfp`现在`propose`现在`accept-proposal`现在`reject-proposal`现在,我们要去.

运行:

```
python3 code/main.py
npx tsx code/main.ts
```

输出是一个横边的痕迹,显示每一个现代消息,在2026 JSON形式和FIPA-ACL形式,然后是合同网投标的回路.同样的协议原始物存活回路;只有语法不同.

## 用它

`outputs/skill-fipa-mapper.md`通过FIFA-ACL地图,在采用新协议之前,使用它来回答:"这是真的新吗?`inform`通过JSON语法?"

## 运送它

让我们回来,让我们回来.

- 每个信息的原始意图是什么?
- 要求响应和取消的相关性ID有没有?
- 有没有明确的内容语言 (JSON-RPC,简体文本,结构化编写的文物)?
- 互动协议是第一级的,还是你从零开始重新实施合同网?
- 如果两个代理人在内容意义上不同意 (语义漂移) 怎么办?

在你发送到生产之前,记录这些五个问题.

## 运动

1. 跑步`code/main.py`观察回路编码. 确定 FIPA 性能符号对应哪个`tools/call`现在`resources/read`通过A2A创建任务.
2. 延长合同网演示`cancel`管理员可以在中期退出任务.`cancel`解决这些问题,你自己做了吗?
3. 阅读FIPA ACL信息结构 (http://www.fipa.org/specs/fipa00037/) 4.14.3 分. 选择本课程未涉及的执行式,并描述其现代的JSON-RPC模拟.
4. 阅读Liu et al., arXiv:2505.02279. 对于每一个MCP,A2A,ACP,ANP,列出 FIPA执行家族,他们保持和下降.
5. 设计一个最小的JSON-Schema`content`一个字段`request`什么是纯自然语言没有的,而且成本是多少?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Speech act | "An utterance that does something" | Austin/Searle: utterances as actions. The theoretical parent of ACL. |
| FIPA | "That old XML thing" | Foundation for Intelligent Physical Agents. Standardized ACL in 2000; became an IEEE Computer Society standards committee in 2005. |
| ACL | "Agent Communication Language" | FIPA's envelope format: performative + content + metadata. |
| Performative | "The verb" | The intent class of a message: `inform`, `request`, `propose`, `cfp`, etc. |
| KQML | "FIPA's predecessor" | Knowledge Query and Manipulation Language (1993). Simpler, narrower. |
| Ontology | "Shared vocabulary" | A formal definition of the concepts the content language talks about. |
| SL0 / SL1 | "FIPA content languages" | Semantic Language levels 0 and 1 — the formal content language family. |
| Contract Net | "Task market" | Manager issues cfp; bidders propose; manager accepts. The canonical interaction protocol. |
| Interaction protocol | "Pattern of messages" | A sequence of performatives with known correctness: request-when, subscribe-notify, etc. |

## 进一步阅读

- [Liu et al. — A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP](https://arxiv.org/html/2505.02279v1)2025年可信调查,将现代规格与FIPA遗产联系起来
- [FIPA ACL Message Structure Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/)批准的2000年包裹格式
- [FIPA Communicative Act Library Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/)完整的表演目录
- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)目前无国有工具使用等价`request`现在,我们要去.`query-ref`
- [A2A specification](https://a2a-protocol.org/latest/specification/)现代代理同等的合同网和订阅通知
