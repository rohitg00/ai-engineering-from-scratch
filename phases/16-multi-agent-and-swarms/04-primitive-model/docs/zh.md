# 多 agent 原语模型（The Multi-Agent Primitive Model）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2026 年还在迭代的每一个多 agent 框架——AutoGen、LangGraph、CrewAI、OpenAI Agents SDK、Microsoft Agent Framework——都不过是同一个四维设计空间里的一个点。四个原语，仅此而已：agent、handoff（交接）、shared state（共享状态）、orchestrator（协调器）。本课从零搭建这四个原语，跑一个把它们都用上的玩具系统，再把每个主流框架投影到同一组坐标轴上，让你今后看到任何新发布都能用一段话读完。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 (Agent Engineering), Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## 问题（Problem）

每隔半年就会出一个新的多 agent 框架。AutoGen 在 2023 年。CrewAI 在 2024 年。LangGraph 和 OpenAI Swarm 在 2024 年。Google ADK 在 2025 年 4 月。Microsoft Agent Framework RC 在 2026 年 2 月。每篇发布稿都自称是「正确的抽象」。

如果你想一个一个学完，会先把自己烧穿。API 长得各不相同。文档对「agent 是什么」都没共识。一个框架管自己的共享内存叫「黑板」（blackboard），另一个叫「消息池」（message pool），第三个叫「StateGraph」。你开始怀疑这个领域是不是只是在原地打转。

不是。在营销话术之下，四个原语是稳定的。学一次，之后每个新框架你都能用一段话读完。

## 概念（Concept）

### 四个原语（The four primitives）

1. **Agent** —— 一个 system prompt 加一份 tool 列表。无状态；每次运行都从它的 system prompt 和当前消息历史出发。
2. **Handoff（交接）** —— 把控制权从一个 agent 结构化地移交给另一个 agent。机制上，要么是一次返回新 agent 的 tool 调用，要么是一条按条件跳转的图的边。
3. **Shared state（共享状态）** —— 任何一个以上 agent 都能读（有时也能写）的数据结构。消息池、黑板、键值存储、向量记忆都算。
4. **Orchestrator（协调器）** —— 决定下一个谁说话的那个东西。可选项：显式图（确定性）、由 LLM 担任的 speaker selector（软式）、上一发言者的 handoff 调用（OpenAI Swarm）、或者一个跑在队列上的调度器（swarm 架构）。

整个设计空间就这么大。每个框架都是在每个轴上选了默认值，剩下的全是表层语法。

### 把每个 2026 框架都映射进来

| 框架 | Agent | Handoff | Shared state | Orchestrator |
|-----------|-------|---------|--------------|--------------|
| OpenAI Swarm / Agents SDK | `Agent(instructions, tools)` | tool 返回 Agent | 调用方自己负责 | LLM 的下一次 handoff 调用 |
| AutoGen v0.4 / AG2 | `ConversableAgent` | GroupChat 上的 speaker-selector | 消息池 | selector 函数（LLM 或 round-robin） |
| CrewAI | `Agent(role, goal, backstory)` | `Process.Sequential / Hierarchical` | Task 输出串成链 | manager LLM 或静态顺序 |
| LangGraph | 节点函数 | 图的边 + 条件 | `StateGraph` reducer | 图本身，确定性 |
| Microsoft Agent Framework | agent + 编排模式（orchestration patterns） | 模式相关 | thread / context | 模式相关 |
| Google ADK | agent + A2A card | A2A task | A2A artifacts | 由 host 决定 |

表面差异看起来巨大。底下其实是同样四个旋钮。

### 为什么这件事重要

一旦你看见原语，框架对比就变成一份很短的清单：

- orchestrator 是相信 LLM 来路由（Swarm）还是把路由钉死在代码里（LangGraph）？
- shared state 是全量历史（GroupChat）还是投影后的（StateGraph reducer）？
- agent 之间能互相改 prompt（CrewAI manager）还是只能交接（Swarm）？

这三个问题就能回答 80% 的「这个问题该用哪个框架」。你不再到处比价「最好的多 agent 框架」，而是开始针对自己真正在乎的那条轴去设计。

### 无状态这一洞察（The stateless insight）

除了 shared state 以外，每一个原语都是无状态的。Agent 是 (prompt, tools) 的函数。Handoff 是一次函数调用。Orchestrator 是一个调度器。**整个系统里唯一有状态的东西是 shared state。** 所有有意思的 bug 都长在那儿：memory poisoning（见第 15 课）、消息顺序、版本、写竞争。

把 shared state 藏起来的框架（Swarm）等于把这个问题甩给调用方。把它集中起来的框架（LangGraph checkpoint、AutoGen 池）让它可被检查，但代价是把协调成本压到 shared state 的实现里。

### 单个原语的解剖（Anatomy of a single primitive）

#### Agent

```
Agent = (system_prompt, tools, model, optional_name)
```

没有记忆，没有状态。两个 system prompt 和 tools 都一样的 agent 是可互换的。任何看起来像「每个 agent 自己的状态」的东西，本质上都在 shared state 里，或者在 handoff 协议里。

#### Handoff

```
Handoff = (from_agent, to_agent, reason, payload)
```

主流的实现有三种：

- **函数返回** —— tool 直接返回下一个 agent。这是 OpenAI Swarm 的范式，路由信息直接挂在 agent 的 tool schema 上。
- **图的边** —— LangGraph。边是声明式的。LLM 给出一个值，条件再据此选下一个节点。
- **Speaker selection（发言者选择）** —— AutoGen GroupChat。一个 selector 函数（有时本身就是一次 LLM 调用）读取池子，挑下一个发言者。

#### Shared state

```
SharedState = { messages: [], artifacts: {}, context: {} }
```

最小形态就是一份消息列表。常见的会更多一些：结构化产物（CrewAI 的 Task 输出）、有类型的 context（LangGraph reducer）、外部记忆（MCP、向量数据库）。

两种拓扑：**全量池（full pool）**（每个 agent 都能看到每条消息），和**投影池（projected）**（agent 看到的是按角色裁过的视图）。全量池实现简单，但扩展性差。投影池能扩展，但要前置做 schema 设计。

#### Orchestrator

```
Orchestrator = ({state, last_speaker}) -> next_agent
```

四种风味：

- **静态（Static）** —— 图在构建时就定好（LangGraph 的确定性版本、CrewAI Sequential）。
- **LLM 选择（LLM-selected）** —— 由一次 LLM 调用读池子、挑下一个发言者（AutoGen、CrewAI Hierarchical）。
- **Handoff 驱动（Handoff-driven）** —— 当前 agent 通过调用 handoff tool 自己决定（Swarm）。
- **队列驱动（Queue-driven）** —— worker 从共享队列里拉活；没有显式的「下一个发言者」（swarm 架构，Matrix）。

### 框架之间真正在变什么

原语固定下来之后，剩下的设计决策只有：

- **记忆策略** —— 临时的 vs. 持久 checkpoint（LangGraph checkpointer）。
- **安全边界** —— 谁有权批准一次 handoff（human-in-the-loop，人工确认）。
- **成本核算** —— 每个 agent 的 token 预算。
- **可观测性** —— trace handoff、把状态持久化以便重放。

这些都能在原语之上实现。它们都不是新原语。

## 动手实现（Build It）

`code/main.py` 用大约 150 行标准库 Python 实现了这四个原语。不接真实 LLM —— 每个 agent 都是一段写死的策略，让你把注意力留在协调结构本身上。

文件导出：

- `Agent` —— 一个 dataclass，包含 name、system prompt、tools、policy function。
- `Handoff` —— 一个返回新 agent 的函数。
- `SharedState` —— 一个线程安全的消息池。
- `Orchestrator` —— 三种变体：`StaticOrchestrator`、`HandoffOrchestrator`、`LLMSelectorOrchestrator`（模拟版）。

Demo 把同样的三 agent 流水线（research → write → review）放进三种 orchestrator 都跑一遍，最后打印消息池。你能看到结果只在「谁来挑下一棒」上有差异；agent 和 shared state 在三次运行里完全一样。

跑起来：

```
python3 code/main.py
```

预期输出：三次 orchestrator 运行，每种范式一次。每次都打印最终消息池。如果 researcher 早早决定收工，那次 handoff 驱动的运行会触达更少的 agent —— 这就是 LLM 路由权衡的微缩版。

## 用起来（Use It）

`outputs/skill-primitive-mapper.md` 是一个 skill：丢给它任何一份多 agent 代码库或框架文档，它会返回这套四原语的映射。新框架一发版，先跑一遍它，得到一段话级别的理解，再去深读文档。

## 上线部署（Ship It）

在采用一个新框架之前，先给它写出原语映射。如果写不出来，要么文档不全，要么这个框架在发明第五个原语（很罕见 —— 多半是某种你没见过的 shared state 风味）。

把这份映射钉在你的架构文档里。新成员入职时，先发映射给 ta，再发 API 文档。框架版本升级时，要 diff 的是映射，不是 changelog。

## 练习（Exercises）

1. 用不同的 agent 策略把 `code/main.py` 跑三次。观察 orchestrator 的选择如何改变了实际跑起来的 agent。
2. 实现第四种 orchestrator：队列驱动版，让 agent 主动从 shared state 里轮询拉活。会出现哪种死锁？你打算怎么检测？
3. 拿 LangGraph quickstart（https://docs.langchain.com/oss/python/langgraph/workflows-agents），把它按四原语重写一遍。LangGraph 哪些抽象是 1:1 对应的，哪些只是便利包装？
4. 读一下 OpenAI Swarm cookbook（https://developers.openai.com/cookbook/examples/orchestrating_agents）。指出 Swarm 把四原语里的哪一个做得最顺手，又把哪一个甩给了调用方。
5. 在表里找一个把 shared state 完全藏起来的框架。说说当 agent 需要跨多次 handoff 协调、又不想重读历史时，会出什么问题。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 它实际是什么 |
|------|----------------|------------------------|
| Agent | 「带 tool 的 LLM」 | 一个 `(system_prompt, tools, model)` 三元组。无状态。 |
| Handoff | 「控制权转移」 | 一次结构化调用，里面写明下一个 agent 是谁、可选的 payload 是什么。三种实现：函数返回、图的边、speaker selection。 |
| Shared state | 「记忆」/「上下文」 | 多 agent 系统里唯一有状态的部分。消息池或者黑板。 |
| Orchestrator | 「协调者」 | 决定下一个谁来跑的那个东西。静态图、LLM selector、handoff 驱动、或队列驱动。 |
| Primitive（原语） | 「抽象」 | 每个框架都会在其上选参数的四条轴之一。它不是某个框架的特性。 |
| Message pool（消息池） | 「共享聊天记录」 | 全量历史的 shared state。容易推理，扩展性差。 |
| Projected state（投影状态） | 「按角色的视图」 | shared state 上按角色定制的视图。能扩展，但要做 schema 设计。 |
| Speaker selection | 「下一个谁说话」 | 一种 orchestrator 范式：用一个函数（通常是一次 LLM 调用）从一组 agent 里挑下一棒。 |

## 延伸阅读（Further Reading）

- [OpenAI cookbook: Orchestrating Agents — Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) —— handoff 驱动编排讲得最清楚的一篇
- [AutoGen stable docs](https://microsoft.github.io/autogen/stable/) —— GroupChat + speaker selection 是「LLM 选择式」编排的参考实现
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) —— 图边编排 + 基于 reducer 的 shared state
- [CrewAI introduction](https://docs.crewai.com/en/introduction) —— role-goal-backstory 风格的 agent，Sequential / Hierarchical 两种 process
- [AG2 (community AutoGen continuation)](https://github.com/ag2ai/ag2) —— 微软把 v0.4 转入维护后，社区延续的 AutoGen v0.2 主线
