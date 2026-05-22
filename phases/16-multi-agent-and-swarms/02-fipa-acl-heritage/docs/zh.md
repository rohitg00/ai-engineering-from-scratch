# FIPA-ACL 与言语行为理论遗产

> 在 MCP 之前，在 A2A 之前，还有 FIPA-ACL。2000 年，IEEE 基金会 for Intelligent Physical Agents 批准了一种智能体通信语言，包含二十种言语行为（performatives）、两种内容语言和一组交互协议——合同网、订阅/通知、条件请求。它因本体论开销对 Web 过于沉重而从工业界消失，但 LLM 复兴的多智能体系统正在悄然重新实现相同的理念，只是没有了形式化语义：JSON 合约代替了言语行为，自然语言代替了本体论。本课的阅读 FIPA-ACL 旨在让你看清 2026 年的哪些协议决策是重新发明、哪些是真正的创新，以及当前这波浪潮将在哪些地方重新发现 2000 年代早已解决的问题。

**类型：** 学习
**语言：** Python (标准库)
**前置条件：** 第 16 阶段 · 01 (为什么需要多智能体)
**时间：** ~60 分钟

## 问题

2026 年的智能体协议领域非常繁忙：MCP 用于工具，A2A 用于智能体，ACP 用于企业审计，ANP 用于去中心化信任，NLIP 用于自然语言内容，加上 CA-MCP 和几十个研究提案。每个规范都宣称自己是基础性的。

坦率地说，它们中的大多数都在重新发现一棵非常具体的、有二十年历史的决策树。Austin (1962) 和 Searle (1969) 的言语行为理论给了我们"话语即行动"。KQML (1993) 将其转化为线路协议。FIPA-ACL (2000 年批准) 产生了参考标准化：二十种言语行为、内容语言 SL0/SL1、合同网和订阅-通知的交互协议。JADE 和 JACK 是 Java 参考平台。这项工作 around 2010 年逐渐衰落，因为本体论开销过于沉重，而 Web 正在获胜。

当你看到 MCP 的 `tools/call`、A2A 的任务生命周期或 CA-MCP 的共享上下文存储时，你看到的其实是对 FIPA 决策的更柔和、JSON 原生的重新演绎。了解这一遗产可以告诉你两件事：哪些新的"创新"实际上是重新发明，以及新规范将重新发现哪些旧的失败模式。

## 概念

### 言语行为，一段话总结

Austin 注意到有些句子不是在描述世界——它们在改变世界。"我承诺。""我请求。""我宣布。" 他称之为施事话语（performative utterances）。Searle 将其形式化为五个类别：断言式、指令式、承诺式、表达式、宣告式。KQML (Finin et al., 1993) 为软件智能体使其可操作：消息是言语行为（动作）加上内容（动作所涉及的内容）。FIPA-ACL 清理了 KQML 的空白，并围绕二十种言语行为进行了标准化。

### 二十种 FIPA 言语行为（部分列表）

| 言语行为 | 意图 |
|---|---|
| `inform` | "我告诉你 P 为真" |
| `request` | "我请你做 X" |
| `query-if` | "P 为真吗？" |
| `query-ref` | "X 的值是什么？" |
| `propose` | "我建议我们做 X" |
| `accept-proposal` | "我接受该提议" |
| `reject-proposal` | "我拒绝该提议" |
| `agree` | "我同意做 X" |
| `refuse` | "我拒绝做 X" |
| `confirm` | "我确认 P 为真" |
| `disconfirm` | "我否认 P" |
| `not-understood` | "你的消息无法解析" |
| `cfp` | "征集关于 X 的提案" |
| `subscribe` | "当 X 变化时通知我" |
| `cancel` | "取消正在进行的 X" |
| `failure` | "我尝试了 X 但失败了" |

完整列表在 `fipa00037.pdf` (FIPA ACL 消息结构) 中。重点不是记住它——重点是每一种都对应于 LLM 协议最终会重新添加的基元。

### 标准 FIPA-ACL 消息

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

七个字段承载协议信封；一个字段 (`content`) 承载有效载荷。其余字段正是每次你在 JSON 协议上强加重试、线程和本体论时重新发明的东西。

### 两个遗留平台

**JADE** (Java Agent DEvelopment framework, 1999–2020s) 是使用最广泛的 FIPA 兼容运行时。智能体扩展基类，交换 ACL 消息，在容器内运行，并使用"行为"进行协调。交互协议库附带合同网、订阅-通知、条件请求和提议-接受。

**JACK** (Agent Oriented Software，商业产品) 强调基于 FIPA 消息的 BDI (信念-期望-意图) 推理。更形式化，采用较少。

一旦 Web 技术栈吞噬了多智能体用例，两者都衰落了。MCP 和 A2A 是 2026 年的运行时"容器"。

### FIPA 衰落的原因

- **本体论开销。** FIPA 需要共享本体来解析 `content`。就本体论达成共识是一个长达数年的标准过程。Web 只使用 HTTP + JSON。
- **无人使用的形式化语义。** SL (语义语言) 提供了严格的真值条件，但大多数生产系统使用自由格式内容并忽略了形式化。
- **工具锁定。** JADE 仅支持 Java；JACK 是商业产品。多语言团队绕过了两者。
- **互联网赢得了技术栈。** REST，然后是 JSON-RPC，然后是 gRPC 取代了 ACL 的传输。

### LLM 复兴是 FIPA 的轻量版

比较 FIPA `request` 与 MCP `tools/call`：

```
(request                                {
  :sender  agent1                         "jsonrpc": "2.0",
  :receiver tool-server                   "method":  "tools/call",
  :content "(lookup stock IBM)"           "params":  {"name":"lookup_stock",
  :ontology finance                                   "arguments":{"symbol":"IBM"}},
  :conversation-id c42                    "id": 42
)                                        }
```

相同的信封，不同的语法。两者都携带：发送者、接收者、意图、有效载荷、关联 ID。两者都不是对另一个的革命——它们只是同一设计上的不同权衡。

Liu 等人 (2025) 的 survey ("A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP", arXiv:2505.02279) 明确指出了这一传承：MCP 对应于工具使用言语行为，A2A 对应于智能体对智能体言语行为，ACP 对应于审计跟踪言语行为，ANP 对应于去中心化身份扩展。新规范是 ACL 的后代，具有 JSON 语法和更松散的语义。

### 权衡，直白地说

**FIPA 给你的而现代规范放弃的：**

- 形式化语义——你可以证明 `inform` 意味着发送者相信内容。
- 言语行为的规范目录——你不必重新争论"我们是否应该有一个 `cancel`？"。
- 数十年的交互协议模式——合同网、订阅-通知、提议-接受——具有已知的正确性属性。

**现代规范给你的而 FIPA 没有的：**

- 与每个现代工具兼容的 JSON 原生有效载荷。
- LLM 可以在没有手写本体论的情况下解释的自然语言内容。
- Web 技术栈传输 (HTTP、SSE、WebSocket)。
- 通过自描述文档进行能力发现 (MCP `listTools`、A2A Agent Card)。

为更容易的实现而放松意图语义。这就是确切的权衡。

### 值得移植的交互协议

FIPA 发布了约 15 种交互协议。三种值得延续到 LLM 多智能体系统中：

1. **合同网协议 (CNP)。** 管理者发出 `cfp` (征集提案)；投标者以 `propose` 回应；管理者接受/拒绝。这是典型的市场任务模式 (第 16 阶段 · 16 谈判)。
2. **订阅/通知。** 订阅者发送 `subscribe`；发布者每当主题变化时发送 `inform`。这就是 2026 年的每个事件总线。
3. **条件请求。** "当条件 Y 成立时做 X。" 带有前置条件的延迟动作。2026 年的类比是持久工作流引擎中的延迟任务 (第 16 阶段 · 22 生产扩展)。

每个都可以清晰地映射到现代消息队列、HTTP + 轮询或 SSE 流。

### 当你放弃本体论时会发生什么

没有共享本体论，智能体从自然语言内容推断含义。有记录的 2026 年失败模式是**语义漂移**：两个智能体对微妙不同的概念使用相同的词 (`"customer"`)，接收者的智能体根据错误的解释采取行动，没有模式验证器捕获它。FIPA 的本体论要求本会在解析时拒绝该消息。

不采用完整本体论的缓解措施：

- `content` 上的 JSON Schema——在线路上拒绝结构错误。
- 类型化制品 (A2A)——拒绝错误的模态。
- 信封中的显式言语行为——即使内容是自然语言，也使意图明确。

### 2026 规范，映射到言语行为遗产

| 现代规范 | FIPA 类比 | 保留的内容 | 放弃的内容 |
|---|---|---|---|
| MCP `tools/call` | `request` | 显式意图、关联 ID | 形式化语义、本体论 |
| MCP `resources/read` | `query-ref` | 显式意图、关联 ID | 形式化语义 |
| A2A 任务生命周期 | 合同网 + 条件请求 | 异步生命周期、状态转换 | 形式化完整性保证 |
| A2A 流事件 | 订阅/通知 | 异步推送 | 类型化谓词订阅 |
| CA-MCP 共享上下文 | 黑板 (Hayes-Roth 1985) | 多写入者共享内存 | 逻辑一致性模型 |
| NLIP | 自然语言内容 | LLM 原生 | 模式 |

从上到下阅读表格，模式是：保留结构化基元，放弃形式主义，让 LLM 掩盖歧义。

## 构建它

`code/main.py` 实现了一个纯标准库的 FIPA-ACL 转换器。它编码和解码标准 ACL 信封，并展示每个 MCP / A2A 消息形状如何简化为相同的七个字段。演示：

- 将五个 MCP 风格和 A2A 风格的消息编码为 FIPA-ACL。
- 将 FIPA-ACL 解码回现代等价物。
- 使用 `cfp`、`propose`、`accept-proposal`、`reject-proposal` 在一个管理者和三个投标者之间运行一个玩具合同网谈判。

运行：

```
python3 code/main.py
```

输出是一个并排跟踪，显示每个现代消息的 2026 JSON 形式和 FIPA-ACL 形式，然后是合同网投标的往返。相同的协议基元在往返中存活；只有语法不同。

## 使用它

`outputs/skill-fipa-mapper.md` 是一个技能，读取任何智能体协议规范并产生 FIPA-ACL 映射。在采用新协议之前使用它来回答："这是真正的新东西，还是带有 JSON 语法的 `inform`？"

## 发布它

不要带回 FIPA-ACL。带回它的检查清单：

- 每条消息的意图基元（言语行为）是什么？
- 是否有用于请求-响应和取消的关联 ID？
- 是否有显式内容语言 (JSON-RPC、纯文本、结构化类型化制品)？
- 交互协议是否是一等的，或者你是否正在从零开始重新实现合同网？
- 当两个智能体对内容含义存在分歧时会发生什么（语义漂移）？

在将任何新协议发布到生产环境之前，记录这五个问题。

## 练习

1. 运行 `code/main.py`。观察往返编码。识别对应于 `tools/call`、`resources/read` 和 A2A 任务创建的 FIPA 言语行为。
2. 用 `cancel` 言语行为扩展合同网演示，让管理者可以在投标中途撤回任务。仅凭重试无法解决的失败案例是什么？
3. 阅读 FIPA ACL 消息结构 (http://www.fipa.org/specs/fipa00037/) 第 4.1–4.3 节。选择本课未涵盖的一种言语行为并描述其现代 JSON-RPC 类比。
4. 阅读 Liu et al., arXiv:2505.02279。对于 MCP、A2A、ACP、ANP 中的每一个，列出它们保留和放弃的 FIPA 言语行为系列。
5. 为你自己系统中的 `request` 言语行为的 `content` 字段设计一个最小 JSON Schema。该模式给你的是纯自然语言所没有的，代价是什么？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| 言语行为 | "一种有所作为的话语" | Austin/Searle：作为行动的话语。ACL 的理论母体。 |
| FIPA | "那个旧的 XML 东西" | IEEE 基金会 for Intelligent Physical Agents。2000 年标准化了 ACL。 |
| ACL | "智能体通信语言" | FIPA 的信封格式：言语行为 + 内容 + 元数据。 |
| 言语行为 | "动词" | 消息的意图类：`inform`、`request`、`propose`、`cfp` 等。 |
| KQML | "FIPA 的前身" | 知识查询和操作语言 (1993)。更简单，更狭窄。 |
| 本体论 | "共享词汇表" | 内容语言所讨论概念的形式化定义。 |
| SL0 / SL1 | "FIPA 内容语言" | 语义语言级别 0 和 1——形式化内容语言家族。 |
| 合同网 | "任务市场" | 管理者发出 cfp；投标者提议；管理者接受。标准交互协议。 |
| 交互协议 | "消息模式" | 具有已知正确性的言语行为序列：条件请求、订阅-通知等。 |

## 延伸阅读

- [Liu et al. — A Survey of Agent Interoperability Protocols: MCP, ACP, A2A, ANP](https://arxiv.org/html/2505.02279v1) — 将现代规范连接到 FIPA 遗产的权威 2025 年调查
- [FIPA ACL Message Structure Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) — 2000 年批准的信封格式
- [FIPA Communicative Act Library Specification (fipa00037)](http://www.fipa.org/specs/fipa00037/) — 完整言语行为目录
- [MCP specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — `request`/`query-ref` 的现代工具使用等价物
- [A2A specification](https://a2a-protocol.org/latest/specification/) — 合同网和订阅/通知的现代智能体对智能体等价物
