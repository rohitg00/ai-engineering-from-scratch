# 多智能体原语模型

> 四个原语，仅此而已——智能体、移交、共享状态、编排器——它们张成一个四维设计空间，2026 年发布的各大多智能体框架（AutoGen、LangGraph、CrewAI、OpenAI Agents SDK、Microsoft Agent Framework）都是这个空间中的点。本课从零构建它们，在一个玩具系统上运行全部四种，然后把每个主要框架映射到相同的坐标轴上，让你能用一段话读懂任何新版本。

**Type:** Learn
**Languages:** Python（标准库）
**Prerequisites:** Phase 14（Agent Engineering）、Phase 16 · 01（Why Multi-Agent）
**Time:** 约 60 分钟

## 问题

每六个月就有一个新的多智能体框架发布。2023 年是 AutoGen，2024 年是 CrewAI、LangGraph 和 OpenAI Swarm，2025 年 4 月是 Google ADK，2026 年 2 月是 Microsoft Agent Framework RC。每一份新闻稿都宣称自己是"正确的抽象"。

如果你试图逐个学习它们，你会精疲力竭。API 看起来各不相同。文档对"智能体"是什么也说法不一。一个框架把它的共享内存叫作"黑板"，另一个叫"消息池"，第三个叫"StateGraph"。你会开始怀疑这个领域只是在无谓地翻腾。

并非如此。在营销话术之下，四个原语是稳定的。学一次，就能用一段话读懂每一个新框架。

## 概念

### 四个原语

1. **智能体（Agent）**——一个系统提示词加一个工具列表。无状态；每次运行都从它的系统提示词和当前消息历史开始。
2. **移交（Handoff）**——从一个智能体到另一个的结构化控制转移。机制上，是一次返回新智能体的工具调用，或是图中一条按条件走向的边。
3. **共享状态（Shared state）**——任何可供多个智能体读取（有时写入）的数据结构。消息池、黑板、键值存储、向量内存。
4. **编排器（Orchestrator）**——决定下一个由谁发言的一方。选项：显式图（确定性）、LLM 发言者选择器（软性）、上一个发言者的移交调用（OpenAI Swarm），或队列上的调度器（swarm 架构）。

这就是整个设计空间。每个框架只是在每条坐标轴上选取默认值；其余都是表层语法。

### 2026 年各框架如何映射到它

| 框架 | Agent | Handoff | Shared state | Orchestrator |
|-----------|-------|---------|--------------|--------------|
| OpenAI Swarm / Agents SDK | `Agent(instructions, tools)` | 工具返回 Agent | 调用方的问题 | LLM 的下一次移交调用 |
| AutoGen v0.4 / AG2 | `ConversableAgent` | GroupChat 上的发言者选择器 | 消息池 | 选择器函数（LLM 或轮询） |
| CrewAI | `Agent(role, goal, backstory)` | `Process.Sequential / Hierarchical` | Task 输出串联 | manager LLM 或静态顺序 |
| LangGraph | 节点函数 | 图边 + 条件 | `StateGraph` reducer | 图本身，确定性 |
| Microsoft Agent Framework | agent + 编排模式 | 因模式而异 | thread / context | 因模式而异 |
| Google ADK | agent + A2A 卡片 | A2A 任务 | A2A artifacts | host 决定 |

表层差异看起来很大。底层：同样的四个旋钮。

### 为什么这很重要

一旦看清这些原语，框架比较就变成一份简短的清单：

- 编排器是信任 LLM 来路由（Swarm），还是在代码中固定路由（LangGraph）？
- 共享状态是完整历史（GroupChat）还是投影视图（StateGraph reducer）？
- 智能体能修改彼此的提示词（CrewAI manager），还是只能移交（Swarm）？

这三个问题能回答 80% 的"哪个框架适合给定问题"。你不再寻找"最好的多智能体框架"，而是开始针对你真正关心的那条坐标轴做设计。

### 无状态的洞见

除共享状态外，每个原语都是无状态的。Agent 是 (prompt, tools) 的函数。Handoff 是一次函数调用。Orchestrator 是一个调度器。**系统中唯一有状态的东西就是共享状态。**所有有趣的 bug 都藏在这里：内存污染（Lesson 15）、消息排序、版本管理、写入竞争。

隐藏共享状态的框架（Swarm）把问题推给调用方。集中共享状态的框架（LangGraph checkpoint、AutoGen pool）使它可检视，但把协调成本转嫁到共享状态的实现上。

### 单个原语的解剖

#### Agent

```
Agent = (system_prompt, tools, model, optional_name)
```

没有记忆。没有状态。两个拥有相同系统提示词和工具的智能体可以互换。一切看起来像智能体私有状态的东西，实际上都在共享状态或移交协议里。

#### Handoff

```
Handoff = (from_agent, to_agent, reason, payload)
```

三种实现占主导地位：

- **函数返回**——工具返回下一个智能体。这是 OpenAI Swarm 模式。智能体把路由信息编码在工具 schema 中。
- **图边**——LangGraph。边是声明式的。LLM 产出一个值；一个条件选择下一个节点。
- **发言者选择**——AutoGen GroupChat。一个选择器函数（有时本身就是一次 LLM 调用）读取消息池并选出下一个发言者。

#### Shared state

```
SharedState = { messages: [], artifacts: {}, context: {} }
```

最低限度，是一个消息列表。通常更多：结构化产物（CrewAI Task 输出）、带类型的上下文（LangGraph reducer）、外部记忆（MCP、向量数据库）。

两种拓扑：**完整池**（每个智能体看到每条消息）和**投影**（智能体看到按角色裁剪的视图）。完整池简单但扩展性差。投影池可扩展，但需要预先设计 schema。

#### Orchestrator

```
Orchestrator = ({state, last_speaker}) -> next_agent
```

四种风格：

- **静态**——图在构建时固定（LangGraph 确定性模式、CrewAI Sequential）。
- **LLM 选择**——LLM 读取消息池并挑选下一个发言者（AutoGen、CrewAI Hierarchical）。
- **移交驱动**——当前智能体通过调用移交工具来决定（Swarm）。
- **队列驱动**——worker 从共享队列拉取任务；没有显式的下一个发言者（swarm 架构、Matrix）。

### 框架之间的差异在哪里

原语固定之后，剩余的设计决策是：

- **内存策略**——临时还是持久化检查点（LangGraph checkpointer）。
- **安全边界**——谁能批准一次移交（human-in-the-loop）。
- **成本核算**——按智能体的 token 预算。
- **可观测性**——追踪移交、持久化状态以便重放。

全部都可以在原语之上实现。没有一个算得上新原语。

```figure
a5-primitive-radar
```

## 动手构建

`code/main.py` 用约 150 行标准库 Python 实现了这四个原语。不使用真实的 LLM——每个智能体都是一个脚本化的策略，以便焦点保持在协调结构上。

该文件导出：

- `Agent`——一个 dataclass，包含 name、system prompt、tools、policy 函数。
- `Handoff`——一个返回新智能体的函数。
- `SharedState`——一个线程安全的消息池。
- `Orchestrator`——三种变体：`StaticOrchestrator`、`HandoffOrchestrator`、`LLMSelectorOrchestrator`（模拟）。

演示将同一条三智能体流水线（research → write → review）依次通过三种编排器类型运行，并在最后打印消息池。你可以看到，输出的差异仅在于*由谁挑选下一个发言者*；各次运行中的智能体和共享状态完全相同。

运行它：

```
python3 code/main.py
```

预期输出：三次编排器运行，每种模式一次。每次都会打印最终的消息池。如果 researcher 提前判定任务完成，移交驱动的那次运行会触及更少的智能体——这就是 LLM 路由权衡的缩影。

## 使用

`outputs/skill-primitive-mapper.md` 是一个 skill，它读取任何多智能体代码库或框架文档，并返回四原语映射。在一个新框架发布时运行它，即可在深入阅读文档之前获得一段话式的理解。

## 上线

在采用一个新框架之前，先为它写出原语映射。如果写不出来，要么文档不完整，要么该框架在发明第五个原语（少见——检查是否有一种你没见过的共享状态变体）。

把映射固定在你的架构文档里。新团队成员加入时，先发映射，再发 API 文档。框架版本变更时，对比的是映射，而不是 changelog。

## 练习

1. 用不同的智能体策略运行 `code/main.py` 三次。观察编排器的选择如何改变哪些智能体被运行。
2. 实现第四种编排器类型：队列驱动型，智能体轮询共享状态以获取任务。可能发生什么死锁？你如何检测它？
3. 拿 LangGraph quickstart（https://docs.langchain.com/oss/python/langgraph/workflows-agents）改写成四个原语。LangGraph 的哪些抽象是 1:1 对应的，哪些只是便捷封装？
4. 阅读 OpenAI Swarm cookbook（https://developers.openai.com/cookbook/examples/orchestrating_agents）。指出 Swarm 让四个原语中的哪一个最易用，又把哪一个推给了调用方。
5. 找出表中一个完全隐藏共享状态的框架。解释当智能体需要在移交之间协调而又不重读历史时，什么会出问题。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| Agent | "带工具的 LLM" | 一个 `(system_prompt, tools, model)` 三元组。无状态。 |
| Handoff | "控制转移" | 一次结构化调用，指名下一个智能体及可选载荷。三种实现：函数返回、图边、发言者选择。 |
| Shared state | "内存" / "上下文" | 多智能体系统中唯一有状态的部分。消息池或黑板。 |
| Orchestrator | "协调者" | 决定下一个由谁运行的一方。静态图、LLM 选择器、移交驱动或队列驱动。 |
| Primitive | "抽象" | 每个框架都要参数化的四条坐标轴之一。不是框架特性。 |
| Message pool | "共享聊天历史" | 完整历史的共享状态。易于推理，扩展性差。 |
| Projected state | "作用域视图" | 共享状态中按角色裁剪的视图。可扩展，需要 schema 设计。 |
| Speaker selection | "下一个谁说话" | 一种编排器模式：由一个函数（通常是 LLM）从群体中挑选下一个发言的智能体。 |

## 延伸阅读

- [OpenAI cookbook: Orchestrating Agents — Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents)——对移交驱动编排最清晰的阐述
- [AutoGen stable docs](https://microsoft.github.io/autogen/stable/)——GroupChat + 发言者选择是 LLM 选择式编排的参考实现
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents)——图边编排与基于 reducer 的共享状态
- [CrewAI introduction](https://docs.crewai.com/en/introduction)——role-goal-backstory 智能体，Sequential / Hierarchical 流程
- [AG2 (community AutoGen continuation)](https://github.com/ag2ai/ag2)——在 Microsoft 将 v0.4 转入维护后，AutoGen v0.2 的活跃延续线