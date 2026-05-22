# 多智能体原语模型

> 2026 年发布的每个多智能体框架——AutoGen、LangGraph、CrewAI、OpenAI Agents SDK、Microsoft Agent Framework——都是四维设计空间中的一个点。四个原语，仅此而已：智能体（agent）、交接（handoff）、共享状态（shared state）、编排器（orchestrator）。本课从零开始构建它们，在所有四个原语上运行一个玩具系统，然后将每个主要框架映射到相同的轴上，这样你就可以在一个段落内读懂任何新版本。

**类型：** 学习
**语言：** Python（标准库）
**前置条件：** 阶段 14（智能体工程）、阶段 16.01（为何选择多智能体）
**时长：** 约 60 分钟

## 问题背景

每六个月就会发布一个新的多智能体框架。2023 年的 AutoGen。2024 年的 CrewAI。2024 年的 LangGraph 和 OpenAI Swarm。2025 年 4 月的 Google ADK。2026 年 2 月的 Microsoft Agent Framework RC。每个新闻稿都声称是"正确的抽象"。

如果你试图一次学习一个，你会筋疲力尽。API 看起来不同。文档对什么是"智能体"存在分歧。一个框架称其共享内存为"黑板（blackboard）"，另一个称为"消息池（message pool）"，第三个称为"状态图（StateGraph）"。你开始怀疑这个领域只是在炒作。

事实并非如此。在营销外表之下，这四个原语是稳定的。学习它们一次，就能在一个段落内读懂每个新框架。

## 概念讲解

### 四个原语

1. **智能体（Agent）** — 一个系统提示词加一个工具列表。无状态；每次运行都从它的系统提示词和当前消息历史开始。
2. **交接（Handoff）** — 从一个智能体到另一个智能体的结构化控制转移。从机制上讲，是一个返回新智能体的工具调用，或者是跟随条件的图形边。
3. **共享状态（Shared state）** — 多个智能体可以读取（有时写入）的任何数据结构。消息池、黑板、键值存储、向量内存。
4. **编排器（Orchestrator）** — 决定谁下一个发言的人。选项：显式图（确定性）、LLM 发言人选择器（软）、最后一个发言者的交接调用（OpenAI Swarm）或队列上的调度器（群体架构）。

这就是整个设计空间。每个框架为每个轴选择默认值；剩下的就是表面语法。

### 每个 2026 框架如何映射到它

| 框架 | 智能体 | 交接 | 共享状态 | 编排器 |
|-----------|-------|---------|--------------|--------------|
| OpenAI Swarm / Agents SDK | `Agent(instructions, tools)` | 工具返回智能体 | 调用者的问题 | LLM 的下一个交接调用 |
| AutoGen v0.4 / AG2 | `ConversableAgent` | GroupChat 上的发言人选择器 | 消息池 | 选择器函数（LLM 或轮询） |
| CrewAI | `Agent(role, goal, backstory)` | `Process.Sequential / Hierarchical` | 任务输出链式 | 管理器 LLM 或静态顺序 |
| LangGraph | 节点函数 | 图边 + 条件 | `StateGraph` 规约器 | 图，确定性 |
| Microsoft Agent Framework | 智能体 + 编排模式 | 特定于模式 | 线程 / 上下文 | 特定于模式 |
| Google ADK | 智能体 + A2A 卡片 | A2A 任务 | A2A 产物 | 主机决定 |

表面差异看起来巨大。内里：相同的四个旋钮。

### 为什么这很重要

一旦你看到原语，框架比较就变成了一个简短的检查清单：

- 编排器是否信任 LLM 进行路由（Swarm）还是在代码中固定路由（LangGraph）？
- 共享状态是完整历史（GroupChat）还是投影（StateGraph 规约器）？
- 智能体是否可以修改彼此的提示词（CrewAI 管理器）还是只能交接（Swarm）？

这三个问题回答了 80% 的哪个框架适合给定问题。你不再寻找"最好的多智能体框架"，而是开始为你真正关心的轴进行设计。

### 无状态洞察

除了共享状态之外，每个原语都是无状态的。智能体是（提示词、工具）的函数。交接是函数调用。编排器是调度器。**系统中唯一有状态的东西是共享状态。** 那就是所有有趣的错误所在：内存投毒（第 15 课）、消息排序、版本控制、写入争用。

隐藏共享状态的框架（Swarm）将问题推给调用者。集中共享状态的框架（LangGraph 检查点、AutoGen 池）使其可检查，但将协调成本转移到共享状态实现上。

### 单个原语的剖析

#### 智能体

```
Agent = (system_prompt, tools, model, optional_name)
```

没有内存。没有状态。具有相同系统提示词和工具的两个智能体是可以互换的。所有看起来像每个智能体状态的东西实际上都在共享状态或交接协议中。

#### 交接

```
Handoff = (from_agent, to_agent, reason, payload)
```

三种实现占主导地位：

- **函数返回** — 工具返回下一个智能体。这是 OpenAI Swarm 模式。智能体在其工具模式中携带路由。
- **图边** — LangGraph。边是声明式的。LLM 产生一个值；条件选择下一个节点。
- **发言人选择** — AutoGen GroupChat。选择器函数（有时本身是 LLM 调用）读取池并选择谁下一个发言。

#### 共享状态

```
SharedState = { messages: [], artifacts: {}, context: {} }
```

至少有一个消息列表。通常更多：结构化产物（CrewAI 任务输出）、类型化上下文（LangGraph 规约器）、外部内存（MCP、向量数据库）。

两种拓扑：**全池**（每个智能体看到每条消息）和**投影**（智能体看到角色范围视图）。全池简单但扩展性差。投影池可扩展但需要前期模式设计。

#### 编排器

```
Orchestrator = ({state, last_speaker}) -> next_agent
```

四种风格：

- **静态** — 图在构建时固定（LangGraph 确定性、CrewAI Sequential）。
- **LLM 选择** — LLM 读取池并选择下一个发言人（AutoGen、CrewAI Hierarchical）。
- **交接驱动** — 当前智能体通过调用交接工具决定（Swarm）。
- **队列驱动** — 工作者从共享队列拉取；没有显式的下一个发言人（群体架构、Matrix）。

### 框架之间的变化

一旦原语固定，剩下的设计决策是：

- **内存策略** — 临时 vs 持久检查点（LangGraph 检查指针）。
- **安全边界** — 谁可以批准交接（人在回路中）。
- **成本会计** — 每个智能体的令牌预算。
- **可观测性** — 追踪交接、持久化状态以重放。

所有这些都可以在原语之上实现。它们都不是新的原语。

## 构建实现

`code/main.py` 用约 150 行标准库 Python 实现四个原语。没有真实的 LLM——每个智能体都是一个脚本化策略，所以重点保持在协调结构上。

该文件导出：

- `Agent` — 名称、系统提示词、工具、策略函数的数据类。
- `Handoff` — 返回新智能体的函数。
- `SharedState` — 线程安全的消息池。
- `Orchestrator` — 三个变体：`StaticOrchestrator`、`HandoffOrchestrator`、`LLMSelectorOrchestrator`（模拟）。

演示通过所有三种编排器类型运行相同的三智能体流水线（研究 → 编写 → 审查），并在最后打印消息池。你可以看到输出仅在*谁选择下一个*方面不同；智能体和共享状态在各次运行之间是相同的。

运行它：

```
python3 code/main.py
```

预期输出：三个编排器运行，每种模式一个。每个都打印最终消息池。如果研究员决定提前完成，交接驱动的运行会到达更少的智能体——这就是小规模 LLM 路由权衡。

## 实际应用

`outputs/skill-primitive-mapper.md` 是一个技能，读取任何多智能体代码库或框架文档并返回四原语映射。在新框架版本发布时运行它，以便在深入阅读文档之前获得一个段落的理解。

## 部署实现

在采用新框架之前，先编写它的原语映射。如果不能，要么文档不完整，要么框架正在发明第五个原语（罕见——检查你是否看到了未见过的共享状态风格）。

在架构文档中固定映射。当新团队成员加入时，在 API 文档之前发送给他们映射。当框架版本更改时，比较映射的差异，而不是变更日志。

## 练习

1. 用不同的智能体策略运行 `code/main.py` 三次。观察编排器选择如何改变哪些智能体运行。
2. 实现第四种编排器类型：智能体轮询共享状态以获取工作的队列驱动型。可能发生什么死锁，如何检测它？
3. 拿 LangGraph 快速入门（https://docs.langchain.com/oss/python/langgraph/workflows-agents）并将其重写为四个原语。LangGraph 的哪些抽象是 1:1 映射的，哪些是便利包装器？
4. 阅读 OpenAI Swarm 食谱（https://developers.openai.com/cookbook/examples/orchestrating_agents）。确定 Swarm 使四个原语中的哪一个最具人体工程学，以及它将哪一个推给调用者。
5. 在此表中找到一个完全隐藏共享状态的框架。解释当智能体需要在不重新读取历史的情况下跨交接进行协调时会出现什么问题。

## 关键术语

| 术语 | 人们说的 | 它实际意味着什么 |
|------|----------------|------------------------|
| Agent（智能体） | "带有工具的 LLM" | 一个（系统提示词、工具、模型）三元组。无状态。 |
| Handoff（交接） | "控制转移" | 命名下一个智能体和可选负载的结构化调用。三种实现：函数返回、图边、发言人选择。 |
| Shared state（共享状态） | "内存" / "上下文" | 多智能体系统的唯一有状态部分。消息池或黑板。 |
| Orchestrator（编排器） | "协调器" | 决定谁下一个运行的人。静态图、LLM 选择器、交接驱动或队列驱动。 |
| Primitive（原语） | "抽象" | 每个框架参数化的四个轴之一。不是框架特性。 |
| Message pool（消息池） | "共享聊天历史" | 完整历史共享状态。易于推理，扩展性差。 |
| Projected state（投影状态） | "范围视图" | 共享状态中的角色特定视图。可扩展，需要模式设计。 |
| Speaker selection（发言人选择） | "谁下一个发言" | 编排器模式，其中一个函数（通常是 LLM）从组中选择下一个智能体。 |

## 延伸阅读

- [OpenAI 食谱：编排智能体——例程和交接](https://developers.openai.com/cookbook/examples/orchestrating_agents) — 交接驱动编排的最清晰阐述
- [AutoGen 稳定文档](https://microsoft.github.io/autogen/stable/) — GroupChat + 发言人选择是 LLM 选择编排的参考
- [LangGraph 工作流和智能体](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — 图边编排和基于规约器的共享状态
- [CrewAI 介绍](https://docs.crewai.com/en/introduction) — 角色-目标-背景故事智能体，顺序 / 分层流程
- [AG2（社区 AutoGen 延续）](https://github.com/ag2ai/ag2) — Microsoft 将 v0.4 移入维护后的活跃 AutoGen v0.2 产品线
