# 02 · FIPA-ACL 与言语行为的遗产

> 在 MCP 之前，在 A2A 之前，就已经有了 FIPA-ACL。2000 年，IEEE「智能物理智能体基金会（Foundation for Intelligent Physical Agents，FIPA）」批准了一套智能体通信语言，包含二十个「述行词（performative）」、两种内容语言，以及一组交互协议——合约网（contract net）、订阅/通知（subscribe/notify）、条件请求（request-when）。它之所以在工业界销声匿迹，是因为「本体（ontology）」的开销对于 Web 而言过于沉重；但 LLM 带来的多智能体系统复兴，正在悄悄地重新实现同样的思想，只是没有那套形式化语义：JSON 契约取代了述行词，自然语言取代了本体。本课会认真地研读 FIPA-ACL，让你看清 2026 年的哪些协议决策是旧瓶装新酒、哪些是真正的创新，以及当前这一波浪潮将在哪些地方重新踩中 2000 年代早已解决过的坑。

**类型：** 学习
**语言：** Python（标准库）
**前置：** 第 16 阶段 · 01（为什么需要多智能体）
**时长：** 约 60 分钟

## 问题

2026 年的智能体协议格局热闹非凡：MCP 管工具、A2A 管智能体、ACP 管企业审计、ANP 管去中心化信任、NLIP 管自然语言内容，再加上 CA-MCP 以及二十多份研究提案。每一份规范都宣称自己是奠基性的。

诚实的解读是：它们当中大多数都在重新发现一棵非常具体、有二十年历史的决策树。Austin（1962）和 Searle（1969）提出的「言语行为（speech-act）」理论给了我们一个观念——「话语即行动」。KQML（1993）把它变成了一种线缆协议。FIPA-ACL（2000 年批准）产出了参考性的标准化成果：二十个述行词、内容语言 SL0/SL1，以及面向合约网与订阅-通知的交互协议。JADE 和 JACK 是 Java 上的参考平台。这一努力大约在 2010 年逐渐淡出，因为本体的开销太重，而 Web 正在赢得这场竞赛。

当你审视 MCP 的 `tools/call`、A2A 的任务生命周期，或是 CA-MCP 的共享上下文存储时，你看到的其实是 FIPA 各项决策的一个更柔和、原生于 JSON 的翻版。了解这段渊源能告诉你两件事：哪些新「创新」实际上是重新发明，以及这些新规范将会重新踩中哪些旧的失败模式。

## 概念

### 一段话讲清言语行为

Austin 注意到，有些句子并不描述世界——它们改变世界。「我承诺。」「我请求。」「我宣布。」他把这些称为「述行话语（performative utterance）」。Searle 将其形式化为五类：「断言型（assertive）」「指令型（directive）」「承诺型（commissive）」「表达型（expressive）」「宣告型（declarative）」。KQML（Finin 等人，1993）将其落地为软件智能体可用的形式：一条消息由一个述行词（即动作）加上内容（即动作所针对的对象）构成。FIPA-ACL 弥补了 KQML 的缺口，并围绕二十个述行词进行了标准化。

### 二十个 FIPA 述行词（部分列表）

| 述行词 | 意图 |
|---|---|
| `inform` | 「我告诉你 P 为真」 |
| `request` | 「我请求你执行 X」 |
| `query-if` | 「P 是否为真？」 |
| `query-ref` | 「X 的值是多少？」 |
| `propose` | 「我提议我们执行 X」 |
| `accept-proposal` | 「我接受该提议」 |
| `reject-proposal` | 「我拒绝该提议」 |
| `agree` | 「我同意执行 X」 |
| `refuse` | 「我拒绝执行 X」 |
| `confirm` | 「我确认 P 为真」 |
| `disconfirm` | 「我否认 P」 |
| `not-understood` | 「你的消息无法解析」 |
| `cfp` | 「就 X 发起提案征集」 |
| `subscribe` | 「当 X 发生变化时通知我」 |
| `cancel` | 「取消正在进行的 X」 |
| `failure` | 「我尝试执行 X 但失败了」 |

完整列表见 `fipa00037.pdf`（FIPA ACL Message Structure）。重点不在于死记硬背——而在于，这里的每一个述行词都对应着某个 LLM 协议最终会重新加回去的原语。

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

七个字段承载协议信封；一个字段（`content`）承载有效载荷。其余这些字段，恰恰就是你每次在 JSON 协议上硬加重试、消息线程化和本体时都会重新发明的东西。

### 两个遗留平台

**JADE**（Java Agent DEvelopment framework，1999–2020 年代）是使用最广泛的 FIPA 兼容运行时。智能体继承一个基类、交换 ACL 消息、运行在「容器（container）」内，并使用「行为（behavior）」进行协调。其交互协议库自带了合约网、订阅-通知、条件请求和提议-接受等模式。

**JACK**（Agent Oriented Software 公司出品，商业软件）强调在 FIPA 消息之上进行 BDI（信念-愿望-意图，Belief-Desire-Intention）推理。更形式化，但采用度更低。

一旦 Web 技术栈吞噬了多智能体用例，这两者都走向衰落。MCP 和 A2A 就是 2026 年的运行时「容器」。

### FIPA 为何淡出

- **本体开销。** FIPA 要求一套共享本体才能解析 `content`。就本体达成一致是一个长达数年的标准化流程。而 Web 直接用 HTTP + JSON。
- **无人使用的形式化语义。** SL（Semantic Language，语义语言）给出了严格的真值条件，但大多数生产系统使用自由格式的内容，无视了这套形式体系。
- **工具锁定。** JADE 仅支持 Java；JACK 是商业软件。多语言团队都绕开了二者。
- **互联网赢下了整个技术栈。** REST，然后是 JSON-RPC，再然后是 gRPC，取代了 ACL 的传输层。

### LLM 复兴是「FIPA 精简版」

将一个 FIPA `request` 与一个 MCP `tools/call` 对比：

```
(request                                {
  :sender  agent1                         "jsonrpc": "2.0",
  :receiver tool-server                   "method":  "tools/call",
  :content "(lookup stock IBM)"           "params":  {"name":"lookup_stock",
  :ontology finance                                   "arguments":{"symbol":"IBM"}},
  :conversation-id c42                    "id": 42
)                                        }
```

相同的信封，不同的语法。两者都承载了：谁、向谁、意图、有效载荷、关联 id。两者相对于彼此都算不上革命——它们只是在同一套设计上做出的不同取舍。

Liu 等人 2025 年的综述（《A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP》，arXiv:2505.02279）把这条谱系讲得很明白：MCP 对应工具使用类言语行为，A2A 对应智能体对等类言语行为，ACP 对应审计追踪类言语行为，ANP 对应去中心化身份的扩展。这些新规范是带着 JSON 语法、语义更松散的 ACL 后代。

### 直白陈述这一取舍

**FIPA 给了你、而现代规范丢掉的：**

- 形式化语义——你可以证明 `inform` 蕴含发送方相信该内容。
- 一份规范的述行词目录——你不必反复争论「我们到底要不要 `cancel`？」。
- 数十年沉淀的交互协议模式——合约网、订阅-通知、提议-接受——并附带已知的正确性属性。

**现代规范给了你、而 FIPA 没有的：**

- 原生于 JSON 的有效载荷，兼容每一款现代工具。
- LLM 无需手写本体即可解读的自然语言内容。
- Web 技术栈的传输方式（HTTP、SSE、WebSocket）。
- 通过自描述文档实现的能力发现（MCP 的 `listTools`、A2A 的 Agent Card）。

用更松散的意图语义，换取更容易的实现。这就是那笔精确的交易。

### 值得移植的交互协议

FIPA 提供了约 15 个交互协议。其中三个值得带进 LLM 多智能体系统：

1. **合约网协议（Contract Net Protocol，CNP）。** 管理者发出 `cfp`（提案征集）；竞标者以 `propose` 响应；管理者接受/拒绝。这是规范的任务市场模式（第 16 阶段 · 16 谈判）。
2. **订阅/通知。** 订阅方发送 `subscribe`；发布方在主题每次变化时发送 `inform`。这就是 2026 年的每一个事件总线。
3. **条件请求（Request-When）。** 「当条件 Y 成立时执行 X。」带前置条件的延迟动作。其 2026 年的对应物是持久化工作流引擎中的延迟任务（第 16 阶段 · 22 生产化扩展）。

每一个都能干净地映射到现代消息队列、HTTP + 轮询，或 SSE 流式传输上。

### 丢掉本体会破坏什么

没有共享本体时，智能体从自然语言内容中推断含义。有据可查的 2026 年失败模式是**语义漂移（semantic drift）**：两个智能体用同一个词（`"customer"`）指代微妙不同的概念，接收方智能体按错误的解读行事，却没有任何 schema 校验器能捕获它。FIPA 的本体要求本可以在解析阶段就拒绝这条消息。

不必走向完整本体的缓解措施：

- 对 `content` 施加 JSON Schema——在线缆层拒绝结构性错误。
- 类型化工件（A2A）——拒绝错误的模态。
- 在信封中显式标注述行词——即便内容是自然语言，也让意图毫不含糊。

### 2026 年各规范与言语行为遗产的映射

| 现代规范 | FIPA 对应物 | 保留了什么 | 丢掉了什么 |
|---|---|---|---|
| MCP `tools/call` | `request` | 显式意图、关联 id | 形式化语义、本体 |
| MCP `resources/read` | `query-ref` | 显式意图、关联 id | 形式化语义 |
| A2A 任务生命周期 | 合约网 + 条件请求 | 异步生命周期、状态转换 | 形式化完备性保证 |
| A2A 流式事件 | 订阅/通知 | 异步推送 | 类型化谓词订阅 |
| CA-MCP 共享上下文 | 黑板（blackboard，Hayes-Roth 1985） | 多写者共享内存 | 逻辑一致性模型 |
| NLIP | 自然语言内容 | LLM 原生 | schema |

自上而下读这张表，模式是一致的：保留结构原语，丢掉形式体系，让 LLM 去糊弄掉其中的歧义。

## 动手构建

`code/main.py` 用纯标准库实现了一个 FIPA-ACL 翻译器。它对规范的 ACL 信封进行编码与解码，并展示每一种 MCP / A2A 消息形态都能归约为同样的七个字段。该演示会：

- 将五条 MCP 风格和 A2A 风格的消息编码为 FIPA-ACL。
- 将 FIPA-ACL 解码回现代等价形式。
- 用 `cfp`、`propose`、`accept-proposal`、`reject-proposal` 在一个管理者与三个竞标者之间运行一次玩具级的合约网谈判。

运行：

```
python3 code/main.py
```

输出是一份并排的追踪记录，展示每条现代消息在其 2026 年 JSON 形式和 FIPA-ACL 形式下的样子，随后是一次合约网竞标的往返过程。同样的协议原语在往返中得以幸存；变化的只有语法。

## 动手使用

`outputs/skill-fipa-mapper.md` 是一个技能，它能读取任意智能体协议规范，并产出其 FIPA-ACL 映射。在采用一项新协议之前先用它，来回答这个问题：「这是真正的新东西，还是只是套了 JSON 语法的 `inform`？」

## 交付上线

不要把 FIPA-ACL 搬回来。要搬回来的是它的检查清单：

- 每条消息的意图原语（述行词）是什么？
- 是否有用于请求-响应与取消的关联 id？
- 是否有显式的内容语言（JSON-RPC、纯文本、结构化的类型化工件）？
- 交互协议是否是一等公民，还是你正在从零重新实现合约网？
- 当两个智能体对内容含义产生分歧（语义漂移）时会发生什么？

在把任何新协议交付到生产环境之前，先为它记录下这五个问题。

## 练习

1. 运行 `code/main.py`。观察往返编码。指出哪个 FIPA 述行词对应 `tools/call`、`resources/read` 以及 A2A 的任务创建。
2. 为合约网演示扩展一个 `cancel` 述行词，让管理者能在竞标进行到一半时撤回任务。`cancel` 解决了哪种单靠重试无法解决的失败情形？
3. 阅读 FIPA ACL Message Structure（http://www.fipa.org/specs/fipa00037/）的第 4.1–4.3 节。挑一个本课未涉及的述行词，描述它对应的现代 JSON-RPC 形式。
4. 阅读 Liu 等人，arXiv:2505.02279。针对 MCP、A2A、ACP、ANP 中的每一个，列出它们保留和丢弃了哪些 FIPA 述行词家族。
5. 为你自己系统中某个 `request` 述行词的 `content` 字段设计一个最小的 JSON-Schema。这个 schema 给了你纯自然语言所没有的什么东西，又付出了什么代价？

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| 言语行为（Speech act） | 「一句能做点什么的话语」 | Austin/Searle：把话语当作行动。ACL 的理论之父。 |
| FIPA | 「那个老掉牙的 XML 玩意儿」 | IEEE 智能物理智能体基金会。于 2000 年标准化了 ACL。 |
| ACL | 「智能体通信语言（Agent Communication Language）」 | FIPA 的信封格式：述行词 + 内容 + 元数据。 |
| 述行词（Performative） | 「那个动词」 | 一条消息的意图类别：`inform`、`request`、`propose`、`cfp` 等。 |
| KQML | 「FIPA 的前身」 | 知识查询与操纵语言（Knowledge Query and Manipulation Language，1993）。更简单、更狭窄。 |
| 本体（Ontology） | 「共享词汇表」 | 对内容语言所谈论的那些概念的形式化定义。 |
| SL0 / SL1 | 「FIPA 的内容语言」 | 语义语言（Semantic Language）的 0 级和 1 级——形式化内容语言家族。 |
| 合约网（Contract Net） | 「任务市场」 | 管理者发出 cfp；竞标者 propose；管理者接受。规范的交互协议。 |
| 交互协议（Interaction protocol） | 「消息的模式」 | 一段带有已知正确性的述行词序列：条件请求、订阅-通知等。 |

## 延伸阅读

- [Liu 等人 — A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP](https://arxiv.org/html/2505.02279v1) —— 将现代规范与 FIPA 遗产串联起来的权威 2025 年综述
- [FIPA ACL Message Structure Specification（fipa00037）](http://www.fipa.org/specs/fipa00037/) —— 2000 年批准的信封格式
- [FIPA Communicative Act Library Specification（fipa00037）](http://www.fipa.org/specs/fipa00037/) —— 完整的述行词目录
- [MCP 规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) —— `request`/`query-ref` 的现代工具使用等价物
- [A2A 规范](https://a2a-protocol.org/latest/specification/) —— 合约网与订阅-通知的现代智能体对等等价物
