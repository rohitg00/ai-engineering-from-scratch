# 共享内存与黑板模式（Shared Memory and Blackboard Patterns）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2026 年的多 agent 系统里有两种共存方案：**message pool（消息池）**——所有人都能看到所有人的消息（如 AutoGen GroupChat 或 MetaGPT），以及**带订阅的 blackboard（黑板）**——agent 订阅自己关心的事件（如 Context-Aware MCP 或 Matrix 框架）。两者都是多 agent 系统里**唯一**有状态的部分——也就意味着，最有意思的 bug 都藏在这里。这里最经典的失效模式叫 **memory poisoning（内存投毒）**：一个 agent 幻觉出一个"事实"，其它 agent 当成已验证内容来用，准确率慢慢下降——比直接崩溃难调试得多。本课用 stdlib 把两种结构都搭起来，注入一次投毒攻击，再展示生产环境里真正有效的三种缓解手段。

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`)
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## 问题（Problem）

多 agent 系统需要一个让 agent 之间共享事实的地方。一种朴素方案是"全部塞进消息里传"——但这等于换了种方式重新发明共享状态，还多了拷贝开销。另一种是"给所有人一份全局日志"——可全局日志会无限增长，而且很容易被投毒。第三种是"给每个 agent 投影一个视图"——可扩展性好，但 schema 设计成本高。

只要有一个 agent 出现幻觉，并把幻觉写进了共享状态，下游所有读到该状态的 agent 都会把这个幻觉当成事实采纳。等人类发现的时候，推理链已经叠了五层，根因却是最早写入的第三条消息。调试多 agent 准确率衰减，比调试一次崩溃要难得多。

这就是 memory poisoning。它在 MAST 分类法（Cemri 等，arXiv:2503.13657）中是文献记录第二多的失效家族，而且是结构性问题：**任何缺乏 provenance（出处溯源）和不可写 verifier（验证器）的共享内存设计，最终都会出现这种问题**。

## 概念（Concept）

### 两大主流拓扑（The two main topologies）

**全量 message pool。** 每个 agent 读所有消息。AutoGen GroupChat 与 MetaGPT 都用这种方式。简单、透明、可检视，但规模超过约 10 个 agent 后就撑不住了——因为每个 agent 的 context 都会被其它 agent 的工作灌满。

```
agent-A ──write──▶ ┌────────────────┐ ◀──read── agent-D
                   │ message pool   │
agent-B ──write──▶ │                │ ◀──read── agent-E
                   │ (global log)   │
agent-C ──write──▶ └────────────────┘ ◀──read── agent-F
```

**带订阅的 blackboard。** agent 声明自己关心的 topic；底层只把相关消息路由过去。CA-MCP（arXiv:2601.11595）和去中心化的 Matrix 框架（arXiv:2511.21686）都用这种方式。能扩展到更大规模，但前期需要做 schema 设计来让订阅有意义。

```
                   ┌─ topic: prices ──┐
agent-A ──pub────▶ │                  │ ──▶ agent-D (subscribed)
                   ├─ topic: orders ──┤
agent-B ──pub────▶ │                  │ ──▶ agent-E (subscribed)
                   ├─ topic: alerts ──┤
agent-C ──pub────▶ │                  │ ──▶ agent-F (subscribed)
                   └──────────────────┘
```

### 各自的适用场景（When each wins）

- **全量 pool** 适合 agent 数量少（< 10）、异质、对话短链路的场景。所有人都看得到所有人，谁说了什么一目了然。
- **Blackboard** 适合 agent 数量多、角色同质但实例众多（swarm 集群）、对话长期运行的场景。路由能省 token 成本，避免 context 被污染。

生产系统里经常混搭：上层（规划层）用一个小规模的全量 pool，下层（worker 层）用 blackboard。

### 一个场景看懂 memory poisoning（Memory poisoning, in one scenario）

三个 agent 协作完成一个研究任务。Agent A 是检索 agent，Agent B 是摘要 agent，Agent C 是分析 agent。

1. A 抓了一个网页，往共享状态里写了一条消息："研究报告显示准确率提升了 42%。"
2. 网页原文其实写的是"提升 4.2%"。A 把小数点幻觉掉了。
3. B 读到共享状态，写："已报告大幅 42% 准确率增益（来源：A）。"
4. C 读到共享状态，写："建议采用——42% 的提升是变革级的。"
5. 最终报告引用了一个从未存在过的 42%。

没有 agent 崩溃，没有测试失败。系统"跑通了"。幻觉通过共享状态，从一个 agent 的 context 横跨进了下游每个 agent 的推理链。

### 为什么这是结构性问题（Why this is structural）

如果没有共享状态，A 的幻觉只会留在 A 自己的 context 里。下游 agent 会重新抓取或重新推导，可能就把错误抓出来了。一旦有了简陋的共享状态，A 的 context 就变成了所有人的 context，幻觉被"洗"成事实。

问题的根源不是共享状态本身——而是**没有 provenance 和独立 verifier 的共享状态**。三种缓解手段对症下药：

1. **每次写入都带 provenance（出处）。** 共享状态里每一条记录都要写明：谁写的、什么时候写的、用的是哪条 prompt、（如适用）agent 引用的来源是什么。下游 agent 读取时，按 provenance 决定怀疑程度。
2. **写入要做版本管理；按 append-only（仅追加）处理。** 修正是一条**新**记录、覆盖旧记录的语义，而不是原地更新。审计链路得以保留。
3. **至少保留一个不能写共享状态的 agent。** 一个只读的 verifier agent 抽样读条目、独立重新抓取来源、标记不一致。因为它无法往池子里写，所以它不会被池子投毒。

### Blackboard 的历史渊源（Blackboard precedent (Hayes-Roth, 1985)）

Blackboard 模式比 LLM agent 早了四十年。Hayes-Roth（1985, "A Blackboard Architecture for Control"）描述了一组专家型 Knowledge Source（知识源），它们观察一个全局黑板、贡献部分解、并触发其它知识源。2026 年的 blackboard（CA-MCP、Matrix）是同一种模式，只不过把知识源换成了 LLM agent，把部分解换成了 JSON blob。老文献里关于写竞争（write contention）、机会式控制（opportunistic control）、一致性的解法都已成文，现代系统正在重新发现。

### 投影 vs 全视图（Projection vs full view）

纯黑板给所有订阅者同样的投影（按 topic 划界）。更激进的设计是 **per-agent projection（每个 agent 一份投影）**：每个 agent 拿到一个针对自己角色定制过的视图。LangGraph 的 state reducer 是 2026 年的标准实现——reducer 函数把全局状态折叠成角色特定的切片。

per-agent projection 扩展性更好，但需要 schema。如果没有 schema，你只能在每个 agent 的 prompt 里临时拼一份投影。

### 写竞争模式（Write-contention patterns）

多 agent 同时写入是一个并发问题，并不只是 LLM 问题。三种模式有效：

- **顺序写入器（单生产者，sequential writer）。** 所有写入都通过一个 coordinator agent 串行化。简单，但是瓶颈。
- **带版本的乐观并发（optimistic concurrency with versioning）。** 每条记录带版本号；写入时若版本不匹配则失败重试。经典数据库技术。
- **Topic 分区（topic partitioning）。** 不同 agent 拥有不同 topic。跨 topic 不会有竞争。需要预先设计好分区边界。

2026 年大多数框架默认用顺序写入器——因为 LLM 调用本身够慢，竞争很罕见，瓶颈也不会真的伤到性能。

### 不可写 verifier（The unwritable verifier）

承重最关键的一条缓解手段，就是只读 verifier。实现规则：

- Verifier 与团队共享状态（读 blackboard 或 pool）。
- Verifier 没有共享状态的写句柄——只能写一个独立的验证通道。
- Verifier 独立抓取写入中所引用的来源，标记分歧。
- Verifier 自己的输出，要路由给人类或独立决策 agent，**绝不**回灌进 pool。

没有这层隔离，verifier 的输出就会变成 pool 的新条目，意味着被投毒的 pool 会反过来投毒 verifier，verifier 又会污染自己的验证结果。

## 动手实现（Build It）

`code/main.py` 用 stdlib Python 实现了两种拓扑、一次玩具版投毒攻击，以及三种缓解手段。

- `MessagePool` —— 线程安全的 append-only 日志，支持全量读出。
- `Blackboard` —— 按 topic 索引的 pub/sub，支持按 agent 订阅。
- `ProvenanceEntry` —— 每次写入都记录 `(writer, timestamp, prompt_hash, source_uri)`。
- `PoisoningScenario` —— 运行三 agent 研究任务，agent A 把小数点幻觉掉。打印最终报告。
- `Verifier` —— 一个只读 agent，重新抓取来源、标记不一致。在带 verifier 的环境下重跑同一场景。

运行：

```
python3 code/main.py
```

预期输出：
- Run 1（无 verifier）：被幻觉出来的 42% 一路传到最终报告。
- Run 2（带 verifier）：verifier 标出不一致，pool 被打上 "flagged" 标签，最终报告里包含了一段撤回声明。

## 用起来（Use It）

`outputs/skill-memory-auditor.md` 是一个 skill，用来审计任意多 agent 系统的共享内存设计——检查 provenance、版本管理、verifier 隔离这三点。新搭多 agent 架构时，上线前跑一遍。

## 上线部署（Ship It）

任何共享内存设计都要做到：

- 每次写入都记录 provenance：`(writer, timestamp, prompt_hash, tool_calls_cited, source_uri)`。
- 日志保持 append-only。修正是引用被覆盖项的新条目。
- 至少部署一个能独立访问来源的只读 verifier agent。
- Verifier 输出走独立通道，不回灌共享 pool。
- 记录"覆盖式写入（supersession）"占总写入的比例——这一比例上升是幻觉模式出现的早期信号。

## 练习（Exercises）

1. 跑一遍 `code/main.py`。确认 run 1 把幻觉传播了出去、run 2 把幻觉抓住了。
2. 加上第二处幻觉：agent B 编造一个数据集大小。Verifier 应该不需要为任何一个手动调参，就能同时抓出两处。
3. 把全量 pool 换成带 topic 分区（`prices`、`summaries`、`analyses`）的 blackboard。topic 分区让哪些投毒场景更难得手？哪些场景它帮不上忙？
4. 读 Hayes-Roth（1985, "A Blackboard Architecture for Control"）。从这篇论文里找出两种本课没讨论、但 2026 年系统会受益的控制模式。
5. 读 CA-MCP（arXiv:2601.11595）。把它的 Shared Context Store 映射到 `code/main.py` 里的 `MessagePool` 或 `Blackboard` 类。CA-MCP 在此之上加了哪些原语？

## 关键术语（Key Terms）

| 术语 | 大家通常怎么说 | 实际含义 |
|------|----------------|------------------------|
| Message pool | "共享聊天历史" | append-only 日志，所有 agent 都读。全透明，规模差。 |
| Blackboard | "共享工作区" | 按 topic 索引的 pub/sub。agent 订阅相关 topic。规模可扩展。 |
| Provenance（出处） | "谁写了什么" | 每次写入的元数据：写入者、时间戳、prompt、来源。 |
| Memory poisoning（内存投毒） | "幻觉在传染" | 一个 agent 的错误进入共享状态，下游 agent 当成事实采纳。 |
| Append-only（仅追加） | "不原地更新" | 修正是用新条目覆盖旧条目。保留审计链路。 |
| Unwritable verifier（不可写验证器） | "独立审计员" | 只读 agent，重新抓取来源、标记不一致。 |
| Projection（投影） | "限定视图" | 每个 agent 由全局状态计算得到的视图。LangGraph reducer 是经典实现。 |
| Knowledge Source（知识源） | "专家型 agent" | Hayes-Roth 1985 年用的术语，指黑板上的参与者。 |

## 延伸阅读（Further Reading）

- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) — MAST 分类法；memory poisoning 属于协调失效子家族
- [CA-MCP — Context-Aware Multi-Server MCP](https://arxiv.org/abs/2601.11595) — 用于协同 MCP 服务器的 Shared Context Store
- [Matrix — decentralized multi-agent framework](https://arxiv.org/abs/2511.21686) — 基于消息队列的去中心化 blackboard，无中央编排器
- [LangGraph state and reducers](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — 生产环境中的 per-agent projection 模式
- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — 来自一次生产部署的 provenance 与验证笔记
