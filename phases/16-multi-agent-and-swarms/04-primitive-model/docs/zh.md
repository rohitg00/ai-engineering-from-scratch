# 04 · 多智能体原语模型

> 2026 年发布的每一个多智能体框架——AutoGen、LangGraph、CrewAI、OpenAI Agents SDK、Microsoft Agent Framework——都是同一个四维设计空间中的一个点。原语只有四个，不多不少：智能体（agent）、交接（handoff）、共享状态（shared state）、编排器（orchestrator）。本课从零构建这四个原语，用一个玩具系统把它们全部跑一遍，然后把每一个主流框架映射到同一组坐标轴上，让你能用一段话读懂任何新发布的版本。

**类型：** 学习
**语言：** Python（标准库）
**前置：** 阶段 14（智能体工程）、阶段 16 · 01（为什么要多智能体）
**时长：** 约 60 分钟

## 问题

每隔半年就有一个新的多智能体框架问世。2023 年的 AutoGen。2024 年的 CrewAI。2024 年的 LangGraph 和 OpenAI Swarm。2025 年 4 月的 Google ADK。2026 年 2 月的 Microsoft Agent Framework RC。每一份新闻稿都声称自己才是「正确的抽象」。

如果你想一个一个地去学，你会累垮。这些 API 看起来各不相同。文档对「智能体到底是什么」各执一词。一个框架把它的共享内存叫「黑板（blackboard）」，另一个叫「消息池（message pool）」，第三个叫「StateGraph」。你开始怀疑这个领域只是在原地空转。

并非如此。在营销话术之下，那四个原语是稳定的。学一次，之后用一段话就能读懂每一个新框架。

## 概念

### 四个原语

1. **智能体（Agent）**——一段系统提示词加一份工具列表。无状态；每次运行都从它的系统提示词和当前消息历史开始。
2. **交接（Handoff）**——把控制权从一个智能体结构化地转移给另一个智能体。在机制上，它要么是一次返回新智能体的工具调用，要么是一条按条件触发的图边（graph edge）。
3. **共享状态（Shared state）**——任何可被多个智能体读取（有时可写）的数据结构。消息池、黑板、键值存储、向量记忆都算。
4. **编排器（Orchestrator）**——决定下一个由谁发言的角色。可选方案有：显式的图（确定性）、一个 LLM 发言者选择器（软性）、上一个发言者的交接调用（OpenAI Swarm），或者基于队列的调度器（蜂群架构）。

这就是整个设计空间。每个框架都为每个坐标轴选定了默认值；其余的不过是表层语法。

### 2026 年的每个框架如何映射到它

| 框架 | 智能体 | 交接 | 共享状态 | 编排器 |
|-----------|-------|---------|--------------|--------------|
| OpenAI Swarm / Agents SDK | `Agent(instructions, tools)` | 工具返回 Agent | 调用方自行负责 | LLM 的下一次交接调用 |
| AutoGen v0.4 / AG2 | `ConversableAgent` | GroupChat 上的发言者选择器 | 消息池 | 选择器函数（LLM 或轮询） |
| CrewAI | `Agent(role, goal, backstory)` | `Process.Sequential / Hierarchical` | 串联的 Task 输出 | 管理者 LLM 或静态顺序 |
| LangGraph | 节点函数 | 图边 + 条件 | `StateGraph` reducer | 图本身，确定性 |
| Microsoft Agent Framework | 智能体 + 编排模式 | 模式特定 | 线程 / 上下文 | 模式特定 |
| Google ADK | 智能体 + A2A 卡片 | A2A 任务 | A2A 产物 | 由 host 决定 |

表层差异看起来巨大。底层：同样的四个旋钮。

### 为什么这很重要

一旦你看清了这些原语，框架比较就变成了一份简短的检查清单：

- 编排器是信任 LLM 来做路由（Swarm），还是把路由钉死在代码里（LangGraph）？
- 共享状态是全历史（GroupChat），还是投影后的（StateGraph reducer）？
- 智能体能否修改彼此的提示词（CrewAI 管理者），还是只能交接（Swarm）？

这三个问题就回答了「哪个框架适合某个给定问题」中 80% 的内容。你不再四处寻找「最好的多智能体框架」，而是开始针对你真正在意的那个坐标轴来做设计。

### 无状态洞见

除共享状态以外，每一个原语都是无状态的。智能体是 (prompt, tools) 的函数。交接是一次函数调用。编排器是一个调度器。**系统中唯一有状态的东西就是共享状态。** 所有有趣的 bug 都住在那里：记忆投毒（第 15 课）、消息排序、版本管理、写入竞争。

那些隐藏共享状态的框架（Swarm）把这个问题推给了调用方。那些把它集中起来的框架（LangGraph checkpoint、AutoGen 消息池）让它变得可检视，但也把协调成本转嫁到了共享状态的实现上。

### 单个原语的解剖

#### 智能体（Agent）

```
Agent = (system_prompt, tools, model, optional_name)
```

没有记忆。没有状态。两个拥有相同系统提示词和工具的智能体是可互换的。一切看起来像「每个智能体自有状态」的东西，其实都在共享状态里，或者在交接协议里。

#### 交接（Handoff）

```
Handoff = (from_agent, to_agent, reason, payload)
```

三种实现方式占主导：

- **函数返回（Function return）**——工具返回下一个智能体。这是 OpenAI Swarm 的模式。智能体把路由信息携带在它们的工具 schema 里。
- **图边（Graph edge）**——LangGraph。边是声明式的。LLM 产出一个值；一个条件据此选择下一个节点。
- **发言者选择（Speaker selection）**——AutoGen GroupChat。一个选择器函数（有时它本身就是一次 LLM 调用）读取消息池，挑出下一个发言者。

#### 共享状态（Shared state）

```
SharedState = { messages: [], artifacts: {}, context: {} }
```

最低限度是一份消息列表。往往还更多：结构化产物（CrewAI 的 Task 输出）、带类型的上下文（LangGraph 的 reducer）、外部记忆（MCP、向量数据库）。

两种拓扑：**全池（full pool）**（每个智能体都看到每条消息）和**投影（projected）**（智能体只看到按角色裁剪的视图）。全池简单但扩展性差。投影池可扩展，但需要前期的 schema 设计。

#### 编排器（Orchestrator）

```
Orchestrator = ({state, last_speaker}) -> next_agent
```

四种风味：

- **静态（Static）**——图在构建时就固定下来（LangGraph 确定性模式、CrewAI Sequential）。
- **LLM 选择（LLM-selected）**——一个 LLM 读取消息池并挑选下一个发言者（AutoGen、CrewAI Hierarchical）。
- **交接驱动（Handoff-driven）**——当前智能体通过调用一个交接工具来决定（Swarm）。
- **队列驱动（Queue-driven）**——工作者从共享队列中拉取任务；没有显式的下一发言者（蜂群架构、Matrix）。

### 框架之间会变化的是什么

一旦原语固定下来，剩下的设计决策就是：

- **记忆策略**——临时性 vs 持久化检查点（LangGraph checkpointer）。
- **安全边界**——谁能批准一次交接（人在回路，human-in-the-loop）。
- **成本核算**——每个智能体的 token 预算。
- **可观测性**——追踪交接，持久化状态以供回放。

这些全都可以在原语之上实现。它们没有一个是新的原语。

## 动手构建

`code/main.py` 用约 150 行标准库 Python 实现了这四个原语。没有真正的 LLM——每个智能体都是一个脚本化的策略，从而让焦点停留在协调结构上。

该文件导出：

- `Agent`——一个包含 name、系统提示词、tools、策略函数的 dataclass。
- `Handoff`——一个返回新智能体的函数。
- `SharedState`——一个线程安全的消息池。
- `Orchestrator`——三个变体：`StaticOrchestrator`、`HandoffOrchestrator`、`LLMSelectorOrchestrator`（模拟）。

该演示让同一个三智能体流水线（research → write → review）依次跑过全部三种编排器类型，并在最后打印消息池。你可以看到，输出之间的差别仅在于*由谁挑选下一个*；各次运行中的智能体和共享状态都是一样的。

运行它：

```
python3 code/main.py
```

预期输出：三次编排器运行，每种模式一次。每次都打印最终的消息池。如果研究者提前判定任务已完成，交接驱动的那次运行会触及更少的智能体——这就是 LLM 路由权衡的微缩版。

## 用起来

`outputs/skill-primitive-mapper.md` 是一个技能（skill），它会读取任何一份多智能体代码库或框架文档，并返回四原语映射。在一个新框架发布时跑一下它，就能在深入阅读文档之前先获得一段话级别的理解。

## 上线发布

在采用一个新框架之前，先为它写出原语映射。如果你写不出来，那要么是文档不完整，要么是这个框架在发明第五个原语（罕见——去检查是不是出现了你没见过的某种共享状态风味）。

把这份映射钉在你的架构文档里。新成员加入时，先把映射发给他们，再发 API 文档。框架版本变更时，去 diff 映射，而不是 changelog。

## 练习

1. 用不同的智能体策略把 `code/main.py` 跑三遍。观察编排器的选择如何改变实际运行的智能体。
2. 实现第四种编排器类型：一个队列驱动的编排器，智能体轮询共享状态来领取工作。可能发生什么样的死锁，你又如何检测它？
3. 拿来 LangGraph 快速上手指南（https://docs.langchain.com/oss/python/langgraph/workflows-agents），把它改写为四个原语。LangGraph 的哪些抽象是 1:1 映射的，哪些只是便利包装？
4. 阅读 OpenAI Swarm cookbook（https://developers.openai.com/cookbook/examples/orchestrating_agents）。指出 Swarm 把四个原语中的哪一个做得最顺手，又把哪一个推给了调用方。
5. 在本表中找出一个完全隐藏共享状态的框架。解释当智能体需要跨交接协调、却无法重读历史时，会出什么问题。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| 智能体（Agent） | 「一个带工具的 LLM」 | 一个 `(system_prompt, tools, model)` 三元组。无状态。 |
| 交接（Handoff） | 「控制权转移」 | 一次结构化调用，指明下一个智能体和可选的载荷。三种实现：函数返回、图边、发言者选择。 |
| 共享状态（Shared state） | 「记忆」/「上下文」 | 多智能体系统中唯一有状态的部分。消息池或黑板。 |
| 编排器（Orchestrator） | 「协调者」 | 决定下一个由谁运行的角色。静态图、LLM 选择器、交接驱动，或队列驱动。 |
| 原语（Primitive） | 「抽象」 | 每个框架都会参数化的四个坐标轴之一。不是某个框架的特性。 |
| 消息池（Message pool） | 「共享聊天历史」 | 全历史的共享状态。易于推理，扩展性差。 |
| 投影状态（Projected state） | 「裁剪视图」 | 对共享状态的、角色特定的视图。可扩展，需要 schema 设计。 |
| 发言者选择（Speaker selection） | 「下一个谁说话」 | 一种编排器模式，由一个函数（通常是 LLM）从一组智能体中挑出下一个。 |

## 延伸阅读

- [OpenAI cookbook：Orchestrating Agents — Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) —— 对交接驱动编排最清晰的阐述
- [AutoGen 稳定版文档](https://microsoft.github.io/autogen/stable/) —— GroupChat + 发言者选择是 LLM 选择型编排的参考实现
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) —— 图边编排与基于 reducer 的共享状态
- [CrewAI introduction](https://docs.crewai.com/en/introduction) —— role-goal-backstory 智能体，Sequential / Hierarchical 流程
- [AG2（社区延续的 AutoGen）](https://github.com/ag2ai/ag2) —— 微软将 v0.4 转入维护后，仍在活跃的 AutoGen v0.2 分支
