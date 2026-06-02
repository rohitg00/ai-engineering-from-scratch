# FIPA-ACL 与言语行为的遗产（Heritage of FIPA-ACL and Speech Acts）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 在 MCP 之前，在 A2A 之前，已经有 FIPA-ACL。2000 年，IEEE Foundation for Intelligent Physical Agents 通过了一份 agent 通信语言标准：二十个 performative、两种内容语言，以及一组交互协议——contract net、subscribe/notify、request-when。它后来在工业界淡出，因为 ontology 的开销对 web 来说太重；但 LLM 时代的多 agent 系统复兴正在悄悄重新实现同一批想法，只是抛掉了形式语义：用 JSON 合同代替 performative，用自然语言代替 ontology。本课认真读一遍 FIPA-ACL，让你能看清 2026 年的协议设计中：哪些是再发明，哪些是新东西，以及当前这一波将在哪些地方重新踩到 2000 年代已经解决过的坑。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## 问题（Problem）

2026 年的 agent 协议版图很热闹：MCP 管工具、A2A 管 agent、ACP 管企业审计、ANP 管去中心化信任、NLIP 管自然语言内容，再加 CA-MCP 和二十多个研究提案。每一份规范都自称是基础设施。

更诚实的解读是：它们大多在重新发现一棵非常具体、二十年前就长出来的决策树。Austin（1962）和 Searle（1969）的言语行为理论（speech-act theory）告诉我们「话语即行动」。KQML（1993）把它变成了一种线上协议。FIPA-ACL（2000 年通过）给出了参考标准化：二十个 performative，内容语言 SL0/SL1，contract-net 和 subscribe-notify 等交互协议。JADE 和 JACK 是 Java 版的参考平台。这场努力大约在 2010 年前后淡出，因为 ontology 的开销太重，而且 web 正在赢。

当你看 MCP 的 `tools/call`、A2A 的任务生命周期、或 CA-MCP 的共享上下文存储时，你看到的其实是 FIPA 决策的一个更柔软、JSON 原生版的复述。了解这段血缘能告诉你两件事：哪些「新创新」其实是再发明，以及哪些旧的失败模式新规范会重新踩到。

## 概念（Concept）

### 一段话讲完言语行为

Austin 注意到有些句子并不描述世界——它们改变世界。「我承诺。」「我请求。」「我宣布。」他把这些叫作 performative utterance（施事话语）。Searle 把它形式化为五类：assertive、directive、commissive、expressive、declarative。KQML（Finin 等，1993）把这套理论变成了软件 agent 可操作的形式：一条消息 = 一个 performative（动作）+ 一段 content（动作的对象）。FIPA-ACL 修补了 KQML 的缺口，并围绕大约二十个 performative 完成了标准化。

### FIPA 的二十个 performative（部分列表）

| Performative | 意图 |
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

完整清单在 `fipa00037.pdf`（FIPA ACL Message Structure）里。重点不是把它背下来——重点是这里的每一个都对应着某个 LLM 协议最终会重新加回去的原语。

### 一个标准的 FIPA-ACL 消息

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

七个字段承载协议信封，一个字段（`content`）承载 payload。其余字段恰恰就是你每次往 JSON 协议上硬塞重试、线程化、ontology 时反复重新发明的东西。

### 两个遗产平台

**JADE**（Java Agent DEvelopment framework，1999–2020s）是当年最常用的 FIPA 兼容 runtime。Agent 继承一个基类，交换 ACL 消息，跑在容器里，用「behavior」做协调。其交互协议库自带 contract-net、subscribe-notify、request-when 和 propose-accept。

**JACK**（Agent Oriented Software 公司，商业产品）则在 FIPA 消息之上强调 BDI（Belief-Desire-Intention）推理。更形式化，采用率更低。

两者都在 web 技术栈吞掉多 agent 用例之后衰落。MCP 和 A2A 是 2026 年新的 runtime「容器」。

### FIPA 为什么淡出

- **Ontology 开销。** FIPA 要求共享 ontology 才能解析 `content`。而就 ontology 达成一致是一个长达数年的标准化过程。Web 直接用 HTTP + JSON。
- **没人用的形式语义。** SL（Semantic Language）给出了严格的真值条件，但绝大多数生产系统用的都是自由格式的 content，对这套形式系统视而不见。
- **工具链锁定。** JADE 只支持 Java；JACK 是商业产品。多语言团队两个都绕开。
- **互联网赢下了整个栈。** REST、然后是 JSON-RPC、再然后是 gRPC，把 ACL 的传输层替换掉了。

### LLM 复兴 = FIPA 的轻量版

把 FIPA 的 `request` 和 MCP 的 `tools/call` 摆在一起：

```
(request                                {
  :sender  agent1                         "jsonrpc": "2.0",
  :receiver tool-server                   "method":  "tools/call",
  :content "(lookup stock IBM)"           "params":  {"name":"lookup_stock",
  :ontology finance                                   "arguments":{"symbol":"IBM"}},
  :conversation-id c42                    "id": 42
)                                        }
```

同一个信封，不同的语法。两者都携带：谁发、发给谁、意图、payload、相关 id。哪一个都不是相对另一个的革命——它们只是同一份设计上的不同权衡。

Liu 等人 2025 年的综述（"A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP", arXiv:2505.02279）把这条血脉讲得很清楚：MCP 对应 tool-use 类言语行为，A2A 对应 agent 同侪间的言语行为，ACP 对应留痕审计的言语行为，ANP 对应去中心化身份的扩展。这些新规范本质上都是 ACL 的后裔，只是换了 JSON 语法、宽松了语义。

### 直白地讲这笔交易

**FIPA 给过你、现代规范丢掉的：**

- 形式语义——你可以证明 `inform` 蕴含「发送方相信该 content」。
- 一份标准 performative 目录——你不用再为「我们要不要有 `cancel`？」吵一次。
- 几十年沉淀下来的交互协议模式——contract-net、subscribe-notify、propose-accept——附带已知的正确性属性。

**现代规范给你、FIPA 当年没给的：**

- JSON 原生 payload，与一切现代工具兼容。
- 自然语言 content，让 LLM 不靠手工 ontology 也能解释意图。
- Web 栈传输（HTTP、SSE、WebSocket）。
- 自描述文档式的能力发现（MCP `listTools`、A2A Agent Card）。

更宽松的意图语义，换更轻松的实现。这就是确切的那笔交易。

### 值得移植的交互协议

FIPA 当年带了大约 15 个交互协议。其中三个值得搬到 LLM 多 agent 系统里继续用：

1. **Contract Net Protocol（CNP，合同网协议）。** Manager 发出 `cfp`（call for proposals）；竞标方用 `propose` 回应；manager 决定 accept 或 reject。这是任务市场（task-market）的标准模式（Phase 16 · 16 谈判）。
2. **Subscribe/Notify。** 订阅方发 `subscribe`；发布方在话题变更时发 `inform`。这就是 2026 年的每一条事件总线。
3. **Request-When。** 「当条件 Y 成立时执行 X。」带前置条件的延迟动作。它在 2026 年的对应物是耐久工作流引擎里的延迟任务（Phase 16 · 22 生产规模化）。

每一个都能干净地映射到现代消息队列、HTTP + 轮询，或 SSE 流式推送上。

### 丢掉 ontology 之后会坏掉什么

没有共享 ontology 时，agent 只能从自然语言 content 里推断意义。2026 年已经有记录在案的失败模式：**semantic drift（语义漂移）**——两个 agent 用同一个词（比如 `"customer"`）表示稍有不同的概念，接收方按错误的解释去执行，没有任何 schema 校验器能拦下来。FIPA 的 ontology 要求会在解析阶段就把这条消息拒掉。

不必走完整 ontology 路线的几种缓解：

- 给 `content` 上 JSON Schema——在线上把结构错误挡掉。
- Typed artifacts（A2A）——把模态错误挡掉。
- 在信封里显式带上 performative——即便 content 是自然语言，意图也明确无歧义。

### 把 2026 的规范映射回言语行为血统

| 现代规范 | FIPA 对应 | 保留了什么 | 丢掉了什么 |
|---|---|---|---|
| MCP `tools/call` | `request` | 显式意图、相关 id | 形式语义、ontology |
| MCP `resources/read` | `query-ref` | 显式意图、相关 id | 形式语义 |
| A2A 任务生命周期 | contract-net + request-when | 异步生命周期、状态迁移 | 形式完备性保证 |
| A2A 流式事件 | subscribe/notify | 异步推送 | 类型化谓词订阅 |
| CA-MCP 共享上下文 | 黑板模型（Hayes-Roth 1985） | 多写者共享内存 | 逻辑一致性模型 |
| NLIP | 自然语言 content | LLM 原生 | schema |

从上到下读这张表，模式是一样的：保留结构原语、丢掉形式系统、让 LLM 把模糊性糊过去。

## 动手实现（Build It）

`code/main.py` 用纯标准库实现了一个 FIPA-ACL 翻译器。它对标准 ACL 信封做编码和解码，并展示每一种 MCP / A2A 消息形态如何归约到同样的七个字段。Demo 包含：

- 把五条 MCP 风格和 A2A 风格的消息编码为 FIPA-ACL。
- 把 FIPA-ACL 解码回现代等价物。
- 用 `cfp`、`propose`、`accept-proposal`、`reject-proposal` 在 1 个 manager 和 3 个竞标方之间跑一个玩具版 Contract Net 谈判。

运行：

```
python3 code/main.py
```

输出是一份并排 trace：每条现代消息分别以它的 2026 JSON 形态和 FIPA-ACL 形态展示出来，然后是一轮 contract-net 投标的来回。同样的协议原语在往返中存活下来；只有语法不一样。

## 用起来（Use It）

`outputs/skill-fipa-mapper.md` 是一个 skill，能读入任意一份 agent 协议规范，输出对应的 FIPA-ACL 映射。在采用一个新协议之前用它来回答：「这是真的新东西，还是只是带 JSON 语法的 `inform`？」

## 上线部署（Ship It）

不要把 FIPA-ACL 拉回来。把它的检查清单拉回来：

- 每条消息的意图原语（performative）是什么？
- 有没有用于请求-响应和取消的相关 id？
- 有没有显式的内容语言（JSON-RPC、纯文本、结构化的 typed artifact）？
- 交互协议是不是一等公民？还是你又在从零重新实现 contract-net？
- 当两个 agent 对 content 的含义产生分歧（semantic drift）时会发生什么？

任何一份新协议在你把它推到生产之前，先把这五个问题写下来留档。

## 练习（Exercises）

1. 跑一遍 `code/main.py`。观察往返编码。指出哪个 FIPA performative 对应 `tools/call`、`resources/read` 和 A2A 的任务创建。
2. 给 contract-net demo 扩展一个 `cancel` performative，让 manager 能在投标过程中撤回任务。`cancel` 解决的是哪一种「光靠重试解决不了」的失败场景？
3. 读 FIPA ACL Message Structure（http://www.fipa.org/specs/fipa00037/）的 4.1–4.3 节。从本课没覆盖的 performative 中挑一个，描述它在现代 JSON-RPC 里的对应物。
4. 读 Liu 等，arXiv:2505.02279。对 MCP、A2A、ACP、ANP 各自，列出它们保留和丢弃的 FIPA performative 家族。
5. 为你自己系统里 `request` performative 的 `content` 字段设计一份最小 JSON-Schema。这份 schema 给你哪些纯自然语言给不了的东西？又付出了什么代价？

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际是什么 |
|------|----------------|------------------------|
| Speech act（言语行为） | 「一种会做事的话语」 | Austin/Searle：把话语视为行动。ACL 的理论祖先。 |
| FIPA | 「那个老掉牙的 XML 玩意」 | IEEE Foundation for Intelligent Physical Agents。2000 年标准化了 ACL。 |
| ACL | 「Agent 通信语言」 | FIPA 的信封格式：performative + content + 元数据。 |
| Performative | 「那个动词」 | 一条消息的意图类别：`inform`、`request`、`propose`、`cfp` 等。 |
| KQML | 「FIPA 的前身」 | Knowledge Query and Manipulation Language（1993）。更简单、更窄。 |
| Ontology | 「共享词汇表」 | 对内容语言所谈论概念的一份形式化定义。 |
| SL0 / SL1 | 「FIPA 的内容语言」 | Semantic Language 第 0 / 1 级——形式化的内容语言家族。 |
| Contract Net | 「任务市场」 | Manager 发 cfp；竞标方 propose；manager 接受。标准的交互协议。 |
| Interaction protocol（交互协议） | 「一套消息模式」 | 一个有已知正确性的 performative 序列：request-when、subscribe-notify 等。 |

## 延伸阅读（Further Reading）

- [Liu et al. — A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP](https://arxiv.org/html/2505.02279v1) — 把现代规范与 FIPA 血统串起来的那份 2025 标准综述
- [FIPA ACL Message Structure Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) — 2000 年通过的信封格式
- [FIPA Communicative Act Library Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) — 完整的 performative 目录
- [MCP specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — `request` / `query-ref` 在现代 tool-use 上的对应物
- [A2A specification](https://a2a-protocol.org/latest/specification/) — contract-net 与 subscribe-notify 在现代 agent 同侪通信上的对应物
