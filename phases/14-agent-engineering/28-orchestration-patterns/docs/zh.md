# 编排模式：Supervisor、Swarm、Hierarchical

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2026 年的各大框架里反复出现四种编排模式：supervisor-worker、swarm / peer-to-peer、hierarchical、debate。Anthropic 的建议是：「关键是为你的需求构建对的系统。」先从简单做起；只有当「单 agent + 五种 workflow 模式」都不够用时，再去叠加拓扑。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 25 (Multi-Agent Debate)
**Time:** ~60 minutes

## 学习目标

- 说出四种反复出现的编排模式，以及各自的适用场景。
- 描述 2026 年 LangChain 的建议：基于 tool call 的 supervision vs 用 supervisor 库。
- 解释 Anthropic 的「构建对的系统」原则，以及它如何决定拓扑选择。
- 用 stdlib 针对一个共同的脚本化 LLM 实现这四种模式。

## 问题（Problem）

团队在真正需要之前就开始上「multi-agent」。这四种模式在各种框架里反复出现；一旦你能叫出它们的名字，就能挑对那个——或者干脆不要拓扑。

## 概念（Concept）

### Supervisor-worker

- 一个中心路由 LLM 把任务分派给专员 agent。
- 它来决定：回到自己继续、交给某个专员、还是终止。
- 专员之间不互相对话；所有路由都经过 supervisor。

框架：LangGraph `create_supervisor`、Anthropic orchestrator-workers、CrewAI Hierarchical Process。

**2026 LangChain 的建议：** 通过直接 tool call 来做 supervision，而不是用 `create_supervisor`。这样在 context engineering 上更细粒度可控——每个专员看到什么完全由你决定。

### Swarm / peer-to-peer

- agent 之间通过共享的工具表面直接交接。
- 没有中央路由器。
- 比 supervisor 延迟更低（跳数更少）。
- 更难推理（没有单一控制点）。

框架：LangGraph swarm 拓扑、OpenAI Agents SDK handoffs（当所有 agent 都可以互相交接时）。

### Hierarchical

- supervisor 管理若干 sub-supervisor，sub-supervisor 再管理 worker。
- 在 LangGraph 里实现为嵌套子图；在 CrewAI 里实现为嵌套 crew。
- 能扩展到大规模 agent 群体，代价是运维复杂度。

什么时候需要它：当单个 supervisor 的 context 预算装不下所有专员的描述时。

### Debate

- 并行提议者 + 迭代式互相批评（Lesson 25）。
- 它其实算不上编排——更像是一种验证手段——但在框架里也以拓扑选项的形式出现。

### CrewAI Crew vs Flow

CrewAI 把两种部署模式正式化了：

- **Flow** 用于确定性的事件驱动自动化（推荐用于生产环境的起点）。
- **Crew** 用于自主的、基于角色的协作。

这一对概念和上面四种模式是正交的，但能映射到拓扑：Flow 通常是 supervisor 或 hierarchical 的；Crew 通常是带 LLM 路由器的 supervisor。

### Anthropic 的指引

「在 LLM 这个领域，成功不在于构建最复杂的系统。而在于为你的需求构建对的系统。」

决策顺序：

1. 单 agent + workflow 模式（Lesson 12）——从这里开始。
2. Supervisor-worker——当你有 2-4 个专员。
3. Swarm——当延迟比推理清晰度更重要时。
4. Hierarchical——只有在 supervisor 的 context 预算扛不住时才上。
5. Debate——当准确度比成本更重要时。

### 这个模式容易翻车的地方

- **拓扑先行的思路。** 还没搞清楚 multi-agent 解决什么问题，就先喊「我们需要 multi-agent」。
- **Swarm 里的反复横跳。** A -> B -> A -> B。用 hop 计数器。
- **假层级。** 因为「我们是企业级」就搞三层；实际上只有两支真团队。压扁它。

## 动手实现（Build It）

`code/main.py` 用 stdlib、针对一个脚本化的 LLM 实现了全部四种模式：

- `Supervisor`——中央路由器。
- `Swarm`——peer-to-peer，直接交接。
- `Hierarchical`——supervisor 之上还有 supervisor。
- `Debate`——并行提议者 + 批评。

每种模式处理同一个三意图任务（退款 / bug / 销售）。trace 的形状各不相同。

跑起来：

```
python3 code/main.py
```

输出：每种模式的 trace + 操作计数。Supervisor 最干净；swarm 最短；hierarchical 最深；debate 最贵。

## 用起来（Use It）

- **LangGraph** 用来做 supervisor 和 hierarchical（嵌套子图）。
- **OpenAI Agents SDK** 用来做 handoffs-as-tools（supervisor 形态）。
- **CrewAI Flow** 用于生产环境的确定性流程。
- **自己手写**用于 debate，或者当你想要精确控制的时候。

## 上线部署（Ship It）

`outputs/skill-orchestration-picker.md` 会挑一个拓扑并实现它。

## 练习

1. 把一个 supervisor-worker 改成 swarm，方法是去掉路由器。什么坏了？什么变好了？
2. 给 swarm 加一个 hop 计数器：3 次交接以后拒绝。它能抓住 A->B->A 的反复横跳吗？
3. 给一个有 12 个专员的领域搭一个两层的 hierarchical 系统。如果不嵌套，context 预算会在哪里崩？
4. 在一个生产形态的工作负载上对四种模式做 profile。哪种在哪个指标上赢（延迟、成本、准确度、可调试性）？
5. 读一下 Anthropic 的《Building Effective Agents》。把你生产里的每条流程映射到四种之一。有哪些没法干净映射的？

## 关键术语

| 术语 | 大家嘴上的说法 | 它实际是什么 |
|------|----------------|------------------------|
| Supervisor-worker | 「路由器 + 专员」 | 中央 LLM 把任务分派给专员；专员之间不互相对话 |
| Swarm | 「peer-to-peer」 | 通过共享工具直接交接；没有中央路由器 |
| Hierarchical | 「supervisor 之上的 supervisor」 | 用嵌套子图来扛大规模群体 |
| Debate | 「提议者 + 批评」 | 并行提议者，互相批评（Lesson 25） |
| 基于 tool call 的 supervision | 「不用库的 supervisor」 | 把 supervisor 实现成直接 tool call，以换取 context 控制权 |
| Crew | 「自主团队」 | CrewAI 的基于角色的协作模式 |
| Flow | 「确定性 workflow」 | CrewAI 的事件驱动生产模式 |

## 延伸阅读

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)——五种模式 + agent vs workflow
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)——supervisor、swarm、hierarchical
- [CrewAI docs](https://docs.crewai.com/en/introduction)——Crew vs Flow
- [Du et al., Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325)——debate 模式
