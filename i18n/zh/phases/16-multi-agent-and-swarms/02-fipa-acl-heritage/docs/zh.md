# FIPA-ACL 与言语行为的传承

> 在 MCP 之前，在 A2A 之前，还有 FIPA-ACL。2000 年，IEEE 智能物理Agent基金会（Foundation for Intelligent Physical Agents）批准了一种Agent通信语言，包含二十种施为词（performatives）、两种内容语言以及一组交互协议——contract net、subscribe/notify、request-when。它在工业界逐渐消失，因为本体（ontology）负担对 Web 来说太重了，但由 LLM 驱动的多Agent系统复兴正在悄然重新实现同样的思想，只是去掉了形式化语义：JSON 契约取代了施为词，自然语言取代了本体。本课将认真研读 FIPA-ACL，让你看清 2026 年的哪些协议决策属于重新发明，哪些属于真正的新意，以及当前这波浪潮将在何处重新发现 2000 年代早已解决的问题。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## 问题

2026 年的Agent协议格局非常热闹：MCP 用于工具，A2A 用于Agent，ACP 用于企业审计，ANP 用于去中心化信任，NLIP 用于自然语言内容，再加上 CA-MCP 和二十多个研究提案。每一份规范都自诩为奠基之作。

诚实的解读是：它们中的大多数正在重新发现一棵非常具体的、二十年前的决策树。Austin（1962）和 Searle（1969）的言语行为（speech-act）理论给了我们"话语即行动"的洞见。KQML（1993）将其转化为线上协议。FIPA-ACL（2000 年批准）产出了参考标准化：二十种施为词、内容语言 SL0/SL1、以及 contract-net 和 subscribe-notify 的交互协议。JADE 和 JACK 是 Java 参考实现平台。这项工作在 2010 年前后逐渐消退，因为本体负担太重，而 Web 正在赢得胜利。

当你看到 MCP 的 `tools/call`、A2A 的任务生命周期，或 CA-MCP 的共享上下文存储时，你看到的是对 FIPA 决策的更柔和、JSON 原生的翻版。了解这段传承能告诉你两件事：哪些新的"创新"实际上是重新发明，以及哪些旧的失败模式会被新规范重新发现。

## 概念

### 言语行为，一段话讲清楚

Austin 注意到，有些句子并不描述世界——它们改变世界。"我承诺。""我请求。""我宣布。"他把这些称为施为话语（performative utterances）。Searle 将其形式化为五类：assertive（断言）、directive（指令）、commissive（承诺）、expressive（表达）、declarative（宣告）。KQML（Finin 等，1993）将其在软件Agent上落地：一条消息就是一个施为词（即行动）加上内容（行动所针对的对象）。FIPA-ACL 修补了 KQML 的缺口，围绕约二十种施为词进行了标准化。

### FIPA 的二十种施为词（部分列表）

| 施为词 | 意图 |
|---|---|
| `inform` | "我告诉你 P 为真" |
| `request` | "我请你做 X" |
| `query-if` | "P 是否为真？" |
| `query-ref` | "X 的值是什么？" |
| `propose` | "我提议我们做 X" |
| `accept-proposal` | "我接受该提议" |
| `reject-proposal` | "我拒绝该提议" |
| `agree` | "我同意做 X" |
| `refuse` | "我拒绝做 X" |
| `confirm` | "我确认 P 为真" |
| `disconfirm` | "我否认 P" |
| `not-understood` | "你的消息未能解析" |
| `cfp` | "征求关于 X 的提议" |
| `subscribe` | "当 X 变化时通知我" |
| `cancel` | "取消进行中的 X" |
| `failure` | "我尝试了 X 但失败了" |

完整列表见 `fipa00037.pdf`（FIPA ACL Message Structure）。重点不在于背下它——重点在于，其中每一项都对应着一个 LLM 协议迟早会重新加入的原语。

### 规范的 FIPA-ACL 消息

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

七个字段承载协议信封；一个字段（`content`）承载负载。其余字段正是你在向 JSON 协议上嫁接重试、线程和本体时每次都要重新发明的东西。

### 两个遗留平台

**JADE**（Java Agent DEvelopment framework，1999–2020 年代）是使用最广泛的 FIPA 兼容运行时。Agent 继承基类、交换 ACL 消息、运行在容器中，并通过"行为（behaviors）"进行协调。其交互协议库随附 contract-net、subscribe-notify、request-when 和 propose-accept。

**JACK**（Agent Oriented Software，商业产品）强调在 FIPA 消息之上进行 BDI（信念-愿望-意图）推理。更形式化，但采用度更低。

一旦 Web 技术栈吞并了多Agent系统的应用场景，两者都走向了衰落。MCP 和 A2A 就是 2026 年的运行时"容器"。

### FIPA 为何衰落

- **本体负担。** FIPA 要求共享本体才能解析 `content`。就本体达成一致是一个旷日持久的标准化过程。而 Web 直接使用 HTTP + JSON。
- **无人使用的形式化语义。** SL（Semantic Language）给出了严格的真值条件，但大多数生产系统使用自由格式的内容，无视这套形式化体系。
- **工具锁定。** JADE 仅支持 Java；JACK 是商业产品。多语言团队绕开了这两者。
- **互联网赢得了技术栈。** REST，然后是 JSON-RPC，然后是 gRPC，取代了 ACL 的传输层。

### LLM 复兴是 FIPA 的精简版

比较 FIPA 的 `request` 与 MCP 的 `tools/call`：

```
(request                                {
  :sender  agent1                         "jsonrpc": "2.0",
  :receiver tool-server                   "method":  "tools/call",
  :content "(lookup stock IBM)"           "params":  {"name":"lookup_stock",
  :ontology finance                                   "arguments":{"symbol":"IBM"}},
  :conversation-id c42                    "id": 42
)                                        }
```

同样的信封，不同的语法。两者都承载：谁、发给谁、意图、负载、关联 id。二者之间不存在革命性差异——它们只是同一设计上不同的权衡。

Liu 等 2025 年的综述（"A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP"，arXiv:2505.02279）明确指出了这一传承脉络：MCP 对应工具使用类言语行为，A2A 对应Agent对等类言语行为，ACP 对应审计轨迹类言语行为，ANP 对应去中心化身份的扩展。这些新规范是采用 JSON 语法、语义更宽松的 ACL 后裔。

### 权衡，直白地说

**FIPA 给了你而现代规范舍弃的：**

- 形式化语义——你可以证明 `inform` 蕴含发送者相信该内容。
- 施为词的规范目录——你不必重新争论"我们是否需要一个 `cancel`？"。
- 数十年的交互协议模式——contract-net、subscribe-notify、propose-accept——并带有已知的正确性性质。

**现代规范给了你而 FIPA 没有的：**

- 与所有现代工具兼容的 JSON 原生负载。
- LLM 无需手工编码本体即可解释的自然语言内容。
- Web 技术栈传输（HTTP、SSE、WebSocket）。
- 通过实时的 MCP `server/discover` 和 A2A Agent Cards 进行能力发现。

用更宽松的意图语义换取更简单的实现。这就是那笔交易。

### 值得移植的交互协议

FIPA 提供了约 15 种交互协议。其中有三种值得带入 LLM 多Agent系统：

1. **Contract Net Protocol（CNP）。** 管理者发出 `cfp`（征求提议）；竞标者以 `propose` 响应；管理者接受/拒绝。这是规范的任务市场模式（Phase 16 · 16 Negotiation）。
2. **Subscribe/Notify。** 订阅者发送 `subscribe`；发布者在主题变化时发送 `inform`。这就是 2026 年的每一个事件总线。
3. **Request-When。** "当条件 Y 成立时做 X。" 带前置条件的延迟动作。2026 年的对应物是持久化工作流引擎中的延迟任务（Phase 16 · 22 Production Scaling）。

每一种都能干净地映射到现代消息队列、HTTP + 轮询或 SSE 流上。

### 舍弃本体后，什么东西会坏掉

没有共享本体，Agent 会从自然语言内容中推断含义。2026 年已有记录的失败模式是**语义漂移（semantic drift）**：两个Agent使用同一个词（`"customer"`）表达微妙不同的概念，接收方的Agent按错误的解释行动，而没有任何 schema 校验器捕获这一点。FIPA 的本体要求本可以在解析时就拒绝该消息。

在不完全转向本体的情况下的缓解措施：

- 在 `content` 上使用 JSON Schema——在线路层面拒绝结构性错误。
- 类型化工件（A2A）——拒绝错误的模态。
- 信封中的显式施为词——即使内容是自然语言，意图也无歧义。

### 2026 年规范与言语行为传承的映射

| 现代规范 | FIPA 对应物 | 保留了什么 | 舍弃了什么 |
|---|---|---|---|
| MCP `tools/call` | `request` | 显式意图、关联 id | 形式化语义、本体 |
| MCP `resources/read` | `query-ref` | 显式意图、关联 id | 形式化语义 |
| A2A 任务生命周期 | contract-net + request-when | 异步生命周期、状态转换 | 形式化完备性保证 |
| A2A 流式事件 | subscribe/notify | 异步推送 | 类型化谓词订阅 |
| CA-MCP 共享上下文 | 黑板模型（Hayes-Roth 1985） | 多写者共享内存 | 逻辑一致性模型 |
| NLIP | 自然语言内容 | LLM 原生 | schema |

自上而下读这张表，模式是：保留结构性原语，舍弃形式化体系，让 LLM 去掩盖歧义。

```figure
sw-contract-net
```

## 动手实现

`code/main.py` 实现了一个纯标准库的 FIPA-ACL 转换器。它对规范的 ACL 信封进行编码和解码，并展示每一条 MCP / A2A 消息如何归约为同样的七个字段。演示内容：

- 将五条 MCP 风格和 A2A 风格的消息编码为 FIPA-ACL。
- 将 FIPA-ACL 解码回现代等价形式。
- 使用 `cfp`、`propose`、`accept-proposal`、`reject-proposal` 在一个管理者和三个竞标者之间运行一个玩具 Contract Net 协商。

运行：

```
python3 code/main.py
```

输出是一个并排的追踪日志，以 2026 年的 JSON 形式和 FIPA-ACL 形式同时显示每条现代消息，然后是一次 contract-net 竞标的往返。同样的协议原语在往返后保持不变；只有语法不同。

## 使用

`outputs/skill-fipa-mapper.md` 是一个技能（skill），读取任意Agent协议规范并产出对应的 FIPA-ACL 映射。在采纳新协议之前使用它来回答："这是真正的新东西，还是套着 JSON 语法的 `inform`？"

## 上线

不要把 FIPA-ACL 带回来。带回它的清单：

- 每条消息的意图原语（施为词）是什么？
- 是否有用于请求-响应和取消的关联 id？
- 是否有显式的内容语言（JSON-RPC、纯文本、结构化类型化工件）？
- 交互协议是否是一等公民，还是你在从零重新实现 contract-net？
- 当两个Agent对内容含义产生分歧（语义漂移）时会发生什么？

在任何新协议投入生产之前，把这五个问题记录成文档。

## 练习

1. 运行 `code/main.py`。观察往返编码。找出对应于 `tools/call`、`resources/read` 和 A2A 任务创建的 FIPA 施为词。
2. 扩展 contract-net 演示，加入一个让管理者能在竞标中途撤回任务的 `cancel` 施为词。`cancel` 解决了哪些单纯重试无法解决的失败情况？
3. 阅读 FIPA ACL Message Structure（http://www.fipa.org/specs/fipa00037/）的 4.1–4.3 节。选择一个本课未涵盖的施为词，并描述其现代 JSON-RPC 对应物。
4. 阅读 Liu 等，arXiv:2505.02279。对 MCP、A2A、ACP、ANP 各自列出它们保留和舍弃的 FIPA 施为词家族。
5. 为你自己系统中 `request` 施为词的 `content` 字段设计一个最小化的 JSON-Schema。相比纯自然语言，这个 schema 给了你什么，又付出了什么代价？

## 关键术语

| 术语 | 人们怎么说 | 它实际意味着什么 |
|------|----------------|------------------------|
| 言语行为 | "做了某件事的话语" | Austin/Searle：话语即行动。ACL 的理论源头。 |
| FIPA | "那个老的 XML 东西" | IEEE 智能物理Agent基金会。2000 年标准化了 ACL。 |
| ACL | "Agent通信语言" | FIPA 的信封格式：施为词 + 内容 + 元数据。 |
| 施为词 | "那个动词" | 消息的意图类别：`inform`、`request`、`propose`、`cfp` 等。 |
| KQML | "FIPA 的前身" | Knowledge Query and Manipulation Language（1993）。更简单、更窄。 |
| 本体 | "共享词汇表" | 对内容语言所谈论概念的形式化定义。 |
| SL0 / SL1 | "FIPA 内容语言" | Semantic Language 的 0 级和 1 级——形式化内容语言家族。 |
| Contract Net | "任务市场" | 管理者发出 cfp；竞标者提议；管理者接受。规范性的交互协议。 |
| 交互协议 | "消息的模式" | 具有已知正确性的施为词序列：request-when、subscribe-notify 等。 |

## 延伸阅读

- [Liu 等 — A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP](https://arxiv.org/html/2505.02279v1) — 将现代规范与 FIPA 传承联系起来的一部 2025 年权威综述
- [FIPA ACL Message Structure Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) — 2000 年批准的信封格式
- [FIPA Communicative Act Library Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) — 完整的施为词目录
- [MCP specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28) — `request`/`query-ref` 的当前无状态工具使用等价物
- [A2A specification](https://a2a-protocol.org/latest/specification/) — contract-net 和 subscribe-notify 的现代Agent对等等价物