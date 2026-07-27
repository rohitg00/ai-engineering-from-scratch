# FIPA-ACL 与言语行为的遗产

> 在 MCP 和 A2A 之前，存在着 FIPA-ACL。2000 年，IEEE 智能物理代理基金会（IEEE Foundation for Intelligent Physical Agents）批准了一种代理通信语言，包含二十种执行语（performatives）、两种内容语言以及一组交互协议——合同网（contract net）、订阅/通知（subscribe/notify）、条件请求（request-when）。由于本体（ontology）开销对 Web 而言过于沉重，它逐渐淡出了工业界，但 LLM 驱动的多智能体系统复兴正在悄然重新实现同样的理念，只不过去掉了形式化语义：JSON 合约取代了执行语，自然语言取代了本体。本课程认真研读 FIPA-ACL，让你能看清哪些 2026 年的协议决策是重新发明，哪些是真正的创新，以及当前浪潮将在何处重新发现 2000 年代已解决的问题。

**类型：** 学习
**语言：** Python（标准库）
**前置条件：** 阶段 16 · 01（为何需要多智能体）
**时长：** 约 60 分钟

## 问题

2026 年的智能体协议版图热闹非凡：MCP（工具）、A2A（智能体间）、ACP（企业审计）、ANP（去中心化信任）、NLIP（自然语言内容），外加 CA-MCP 和二十多份研究提案。每个规范都宣称自己是基础性的。

诚实的解读是，它们大多数都在重新发现一棵非常具体的、已有二十年历史的决策树。奥斯汀（Austin，1962）和塞尔（Searle，1969）的言语行为理论告诉我们"话语即行动"。KQML（1993）将其转化为线缆协议。FIPA-ACL（2000 年批准）产生了标准化参考：二十种执行语、内容语言 SL0/SL1、用于合同网和订阅-通知的交互协议。JADE 和 JACK 是 Java 参考平台。这一努力在 2010 年左右逐渐式微，因为本体的开销过于沉重，而 Web 正在胜出。

当你审视 MCP 的 `tools/call`、A2A 的任务生命周期或 CA-MCP 的共享上下文存储时，你看到的是对 FIPA 决策的更柔和、JSON 原生的重新包装。了解这段遗产能告诉你两件事：哪些新的"创新"实际上是重新发明，以及哪些旧的失败模式将被新规范重新发现。

## 概念

### 言语行为，用一段话说明

奥斯汀注意到，有些句子不是在描述世界——它们是在改变世界。"我承诺。""我请求。""我宣布。"他称这些为执行性话语（performative utterances）。塞尔将其形式化为五个类别：断言类（assertive）、指令类（directive）、承诺类（commissive）、表达类（expressive）、宣告类（declarative）。KQML（Finin 等人，1993）将其操作化，应用于软件智能体：一条消息包含一个执行语（行动）加上内容（行动的对象）。FIPA-ACL 清理了 KQML 的缺陷，并将二十种执行语标准化。

### 二十种 FIPA 执行语（部分列表）

| 执行语 | 意图 |
|---|---|
| `inform` | "我告诉你 P 为真" |
| `request` | "我请求你做 X" |
| `query-if` | "P 是否为真？" |
| `query-ref` | "X 的值是什么？" |
| `propose` | "我提议我们做 X" |
| `accept-proposal` | "我接受该提议" |
| `reject-proposal` | "我拒绝该提议" |
| `agree` | "我同意做 X" |
| `refuse` | "我拒绝做 X" |
| `confirm` | "我确认 P 为真" |
| `disconfirm` | "我否认 P" |
| `not-understood` | "你的消息无法解析" |
| `cfp` | "就 X 征求提议" |
| `subscribe` | "当 X 变化时通知我" |
| `cancel` | "取消正在进行的 X" |
| `failure` | "我尝试了 X，但失败了" |

完整列表见 `fipa00037.pdf`（FIPA ACL 消息结构）。重点不在于记住它——而在于这些执行语中的每一个都对应着 LLM 协议最终会重新添加的一种原语。

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

七个字段携带协议信封；一个字段（`content`）携带负载。其余字段正是你每次将重试、线程化和本体硬塞进 JSON 协议时都要重新发明的东西。

### 两个遗留平台

**JADE**（Java Agent DEvelopment framework，1999–2020 年代）是使用最广泛的符合 FIPA 规范的运行时。智能体继承一个基类，交换 ACL 消息，在容器内运行，并通过"行为"进行协调。其交互协议库内置了合同网、订阅-通知、条件请求和提议-接受。

**JACK**（Agent Oriented Software，商业软件）强调在 FIPA 消息之上进行 BDI（信念-愿望-意图）推理。更形式化，但采用度较低。

两者均在 Web 栈吞噬多智能体用例后衰落。MCP 和 A2A 是 2026 年的运行时"容器"。

### FIPA 为何衰落

- **本体开销。** FIPA 要求共享本体来解析 `content`。就本体达成一致是一个长达数年的标准化过程。而 Web 只使用了 HTTP + JSON。
- **无人使用的形式化语义。** SL（语义语言）提供了严格的真值条件，但大多数生产系统使用自由格式的内容并忽略了形式化。
- **工具锁定。** JADE 仅支持 Java；JACK 是商业软件。多语言团队绕开了两者。
- **互联网赢得了技术栈。** REST，然后是 JSON-RPC，再然后是 gRPC，取代了 ACL 的传输层。

### LLM 复兴是 FIPA-Lite

将 FIPA 的 `request` 与 MCP 的 `tools/call` 进行比较：

```
(request                                {
  :sender  agent1                         "jsonrpc": "2.0",
  :receiver tool-server                   "method":  "tools/call",
  :content "(lookup stock IBM)"           "params":  {"name":"lookup_stock",
  :ontology finance                                   "arguments":{"symbol":"IBM"}},
  :conversation-id c42                    "id": 42
)                                        }
```

相同的信封，不同的语法。两者都携带：谁、给谁、意图、负载、关联 ID。两者之间并无革命性差异——它们是在同一设计上的不同权衡。

Liu 等人 2025 年的综述（《智能体互操作协议综述：MCP、ACP、A2A、ANP》，arXiv:2505.02279）明确指出了这一谱系：MCP 对应工具使用的言语行为，A2A 对应智能体对等的言语行为，ACP 对应审计追踪的言语行为，ANP 对应去中心化身份扩展。这些新规范是具有 JSON 语法和更宽松语义的 ACL 后代。

### 权衡，直截了当地说

**FIPA 提供而现代规范舍弃的东西：**

- 形式化语义——你可以证明 `inform` 暗示发送者相信其内容。
- 一套规范化的执行语目录——你不必重新争论"我们应该有 `cancel` 吗？"。
- 数十年的交互协议模式——合同网、订阅-通知、提议-接受——具有已知的正确性属性。

**现代规范提供而 FIPA 没有的东西：**

- JSON 原生负载，与所有现代工具兼容。
- 自然语言内容，LLM 无需手工编码的本体即可解释。
- Web 栈传输（HTTP、SSE、WebSocket）。
- 通过自描述文档进行能力发现（MCP `listTools`、A2A Agent Card）。

更宽松的意图语义换来更简单的实现。这就是确切的权衡。

### 值得移植的交互协议

FIPA 提供了约 15 种交互协议。其中三种值得带入 LLM 多智能体系统：

1. **合同网协议（CNP）。** 管理者发出 `cfp`（征求提议）；投标者回复 `propose`；管理者接受/拒绝。这是规范的任务市场模式（阶段 16 · 16 谈判）。
2. **订阅/通知。** 订阅者发送 `subscribe`；每当主题变化时，发布者发送 `inform`。这就是 2026 年的每个事件总线。
3. **条件请求。** "当条件 Y 满足时执行 X。"带前置条件的延迟行动。2026 年的对应物是持久化工作流引擎中的延迟任务（阶段 16 · 22 生产环境扩展）。

每一种都能干净地映射到现代消息队列、HTTP + 轮询或 SSE 流上。

### 放弃本体后会出现什么问题

没有共享本体，智能体从自然语言内容中推断含义。2026 年有记录的失败模式是**语义漂移**：两个智能体使用相同的词（如"customer"）表示略有不同的概念，接收方的智能体基于错误的理解行事，而没有任何模式校验器捕获这个问题。FIPA 的本体要求在解析时就会拒绝该消息。

在不完全采用本体的情况下的缓解措施：

- 对 `content` 使用 JSON Schema——在线缆层面拒绝结构性错误。
- 类型化工件（A2A）——拒绝错误的模态。
- 在信封中明确标明执行语——即使内容是自然语言，也能使意图明确无误。

### 2026 年规范映射到言语行为遗产

| 现代规范 | FIPA 类比 | 保留了什么 | 舍弃了什么 |
|---|---|---|---|
| MCP `tools/call` | `request` | 明确的意图、关联 ID | 形式化语义、本体 |
| MCP `resources/read` | `query-ref` | 明确的意图、关联 ID | 形式化语义 |
| A2A 任务生命周期 | 合同网 + 条件请求 | 异步生命周期、状态转移 | 形式化完备性保证 |
| A2A 流式事件 | 订阅/通知 | 异步推送 | 类型化谓词订阅 |
| CA-MCP 共享上下文 | 黑板（Hayes-Roth 1985） | 多写者共享内存 | 逻辑一致性模型 |
| NLIP | 自然语言内容 | LLM 原生 | 模式 |

从上到下阅读该表格，模式是：保留结构原语，舍弃形式化，让 LLM 来掩盖歧义。

## 动手构建

`code/main.py` 实现了一个纯标准库的 FIPA-ACL 转换器。它对规范的 ACL 信封进行编码和解码，并展示每个 MCP / A2A 消息形状如何归结为相同的七个字段。该演示：

- 将五条 MCP 风格和 A2A 风格的消息编码为 FIPA-ACL。
- 将 FIPA-ACL 解码回现代等价形式。
- 运行一个玩具版的合同网协商，涉及一个管理者和三个投标者，使用 `cfp`、`propose`、`accept-proposal`、`reject-proposal`。

运行：

```
python3 code/main.py
```

输出是一个并排追踪，展示每条现代消息同时以 2026 年 JSON 形式和 FIPA-ACL 形式呈现，然后是一个合同网投标的往返转换。相同的协议原语在往返过程中保持不变；不同的只是语法。

## 使用它

`outputs/skill-fipa-mapper.md` 是一个技能，它读取任何智能体协议规范并生成 FIPA-ACL 映射。在采用新协议之前使用它来回答："这是真正的新东西，还是带 JSON 语法的 `inform`？"

## 交付检查清单

不要带回 FIPA-ACL。带回它的检查清单：

- 每条消息的意图原语（执行语）是什么？
- 是否有用于请求-响应和取消的关联 ID？
- 是否有明确的内容语言（JSON-RPC、纯文本、结构化类型化工件）？
- 交互协议是否是一等公民，还是你在从头重新实现合同网？
- 当两个智能体对内容含义存在分歧时（语义漂移），会发生什么？

在将任何新协议投入生产之前，记录这五个问题。

## 练习

1. 运行 `code/main.py`。观察往返编码过程。识别哪个 FIPA 执行语对应 `tools/call`、`resources/read` 以及 A2A 任务创建。
2. 扩展合同网演示，加入 `cancel` 执行语，允许管理者在投标过程中撤回任务。`cancel` 解决了哪些仅靠重试无法解决的失败情况？
3. 阅读 FIPA ACL 消息结构（http://www.fipa.org/specs/fipa00037/）第 4.1–4.3 节。选择一个本课程未涵盖的执行语，描述其现代 JSON-RPC 类比。
4. 阅读 Liu 等人，arXiv:2505.02279。对于 MCP、A2A、ACP、ANP 中的每一个，列出它们保留和舍弃的 FIPA 执行语族。
5. 为你自己系统中 `request` 执行语的 `content` 字段设计一个最小的 JSON Schema。该模式给你带来了什么纯自然语言无法提供的东西，以及它的代价是什么？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| 言语行为（Speech act） | "一种做事情的话语" | 奥斯汀/塞尔：话语作为行动。ACL 的理论源头。 |
| FIPA | "那个古老的 XML 东西" | IEEE 智能物理代理基金会。2000 年标准化 ACL。 |
| ACL | "代理通信语言" | FIPA 的信封格式：执行语 + 内容 + 元数据。 |
| 执行语（Performative） | "那个动词" | 消息的意图类别：`inform`、`request`、`propose`、`cfp` 等。 |
| KQML | "FIPA 的前身" | 知识与查询操作语言（1993）。更简单，范围更窄。 |
| 本体（Ontology） | "共享词汇表" | 对内容语言所讨论概念的形式化定义。 |
| SL0 / SL1 | "FIPA 内容语言" | 语义语言级别 0 和 1——形式化内容语言家族。 |
| 合同网（Contract Net） | "任务市场" | 管理者发出 cfp；投标者提议；管理者接受。规范的交互协议。 |
| 交互协议（Interaction protocol） | "消息的模式" | 一系列具有已知正确性的执行语序列：条件请求、订阅-通知等。 |

## 延伸阅读

- [Liu 等人——智能体互操作协议综述：MCP、ACP、A2A、ANP](https://arxiv.org/html/2505.02279v1)——连接现代规范与 FIPA 遗产的权威 2025 年综述
- [FIPA ACL 消息结构规范（fipa00037）](http://www.fipa.org/specs/fipa00037/)——2000 年批准的信封格式
- [FIPA 通信行为库规范（fipa00037）](http://www.fipa.org/specs/fipa00037/)——完整的执行语目录
- [MCP 规范 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25)——`request`/`query-ref` 的现代工具使用等价物
- [A2A 规范](https://a2a-protocol.org/latest/specification/)——合同网和订阅-通知的现代智能体对等等价物
