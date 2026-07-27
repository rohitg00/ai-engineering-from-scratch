# 多智能体原语模型

> 2026 年发布的每一个多智能体框架——AutoGen、LangGraph、CrewAI、OpenAI Agents SDK、Microsoft Agent Framework——都是四维设计空间中的一个点。四个原语，仅此而已：智能体（Agent）、交接（Handoff）、共享状态（Shared State）、编排器（Orchestrator）。本课从零构建它们，在一个玩具系统上运行全部四种模式，然后将每个主流框架映射到相同的坐标轴上，让你一眼读懂任何一个新版本。

**类型：** 学习
**语言：** Python（标准库）
**前置知识：** 阶段 14（智能体工程），阶段 16 · 01（为何需要多智能体）
**时长：** ~60 分钟

## 问题

每六个月就有一个新的多智能体框架发布。2023 年的 AutoGen，2024 年的 CrewAI、LangGraph 和 OpenAI Swarm，2025 年 4 月的 Google ADK，2026 年 2 月的 Microsoft Agent Framework RC。每一篇新闻稿都声称自己拥有"正确的抽象"。

如果你试图逐个学习它们，你会筋疲力尽。API 看起来各不相同。文档对什么是"智能体"也各执一词。一个框架把它的共享内存称为"黑板"，另一个称之为"消息池"，第三个则叫它"StateGraph"。你开始怀疑这个领域只是在原地打转。

事实并非如此。在市场营销的外表之下，这四个原语是稳定的。一次性学会它们，就能一眼看懂每一个新框架。

## 概念

### 四个原语

1. **智能体（Agent）** —— 一条系统提示加一个工具列表。无状态；每次运行都从其系统提示和当前消息历史开始。
2. **交接（Handoff）** —— 控制权从一个智能体到另一个智能体的结构化的转移。从机制上说，是一个返回新智能体的工具调用，或一条跟随条件执行的图边。
3. **共享状态（Shared State）** —— 多个智能体可以读取（有时也可写入）的任何数据结构。消息池、黑板、键值存储、向量记忆。
4. **编排器（Orchestrator）** —— 决定谁下一个发言的决策者。选项包括：显式图（确定性）、LLM 发言选择器（软性）、上一个发言者的交接调用（OpenAI Swarm）、或基于队列的调度器（群体架构）。

这就是整个设计空间。每个框架为每个轴选择默认值，剩下的只是表面语法。

### 每个 2026 框架如何映射

| 框架 | 智能体 | 交接 | 共享状态 | 编排器 |
|-----------|-------|---------|--------------|--------------|
| OpenAI Swarm / Agents SDK | `Agent(instructions, tools)` | 工具返回 Agent | 调用方的问题 | LLM 的下一个交接调用 |
| AutoGen v0.4 / AG2 | `ConversableAgent` | GroupChat 上的发言选择器 | 消息池 | 选择器函数（LLM 或轮询） |
| CrewAI | `Agent(role, goal, backstory)` | `Process.Sequential / Hierarchical` | 任务输出串联 | 管理 LLM 或静态顺序 |
| LangGraph | 节点函数 | 图边 + 条件 | `StateGraph` 归约器 | 图，确定性 |
| Microsoft Agent Framework | 智能体 + 编排模式 | 模式特定 | 线程 / 上下文 | 模式特定 |
| Google ADK | 智能体 + A2A 卡片 | A2A 任务 | A2A 制品 | 宿主决定 |

表面差异看起来巨大。骨子里：同样的四个旋钮。

### 为什么这很重要

一旦你理解了这些原语，框架对比就变成了一张简短的清单：

- 编排器是信任 LLM 来路由（Swarm），还是将路由固化在代码中（LangGraph）？
- 共享状态是全历史（GroupChat）还是投影式的（StateGraph 归约器）？
- 智能体可以修改彼此的系统提示（CrewAI 管理器），还是只能交接（Swarm）？

这三个问题能回答 80% 的框架适配性问题。你不再寻找"最好的多智能体框架"，而是开始为你真正关心的那个轴进行设计。

### 无状态的洞见

除了共享状态，每个原语都是无状态的。智能体是（提示，工具）的函数。交接是一个函数调用。编排器是一个调度器。**系统中唯一有状态的东西就是共享状态。** 那里是所有有趣的 bug 的藏身之处：记忆中毒（第 15 课）、消息排序、版本控制、写入竞争。

隐藏共享状态的框架（Swarm）把问题推给了调用方。集中管理共享状态的框架（LangGraph checkpoint、AutoGen 池）使其可检查，但将协调成本转移到了共享状态的实现上。

### 单个原语的剖析

#### 智能体

```
Agent = (system_prompt, tools, model, optional_name)
```

没有记忆。没有状态。拥有相同系统提示和工具的两个智能体是可互换的。所有看似是智能体状态的东西，实际上都在共享状态或交接协议中。

#### 交接

```
Handoff = (from_agent, to_agent, reason, payload)
```

三种实现占主导地位：

- **函数返回** —— 工具返回下一个智能体。这是 OpenAI Swarm 的模式。智能体在其工具模式中携带路由信息。
- **图边** —— LangGraph。边是声明式的。LLM 产生一个值；一个条件选择下一个节点。
- **发言选择** —— AutoGen GroupChat。一个选择器函数（有时它本身就是一个 LLM 调用）读取消息池并选择谁下一个发言。

#### 共享状态

```
SharedState = { messages: [], artifacts: {}, context: {} }
```

至少包含一个消息列表。通常包含更多：结构化制品（CrewAI Task outputs）、类型化上下文（LangGraph 归约器）、外部记忆（MCP、向量数据库）。

两种拓扑结构：**全池**（每个智能体看到每条消息）和**投影式**（智能体看到按角色限定的视图）。全池简单但伸缩性差。投影式可以扩展但需要事先设计模式。

#### 编排器

```
Orchestrator = ({state, last_speaker}) -> next_agent
```

四种风格：

- **静态** —— 图在构建时固定（LangGraph 确定性、CrewAI Sequential）。
- **LLM 选择** —— LLM 读取消息池并选择下一个发言者（AutoGen、CrewAI Hierarchical）。
- **交接驱动** —— 当前智能体通过调用交接工具来决定（Swarm）。
- **队列驱动** —— 工作者从共享队列中拉取任务；没有明确的下一个发言者（群体架构、Matrix）。

### 框架之间有什么变化

一旦原语固定下来，剩余的设计决策是：

- **记忆策略** —— 临时 vs 持久的检查点（LangGraph checkpointer）。
- **安全边界** —— 谁可以批准一次交接（人在回路中）。
- **成本核算** —— 每个智能体的 Token 预算。
- **可观测性** —— 追踪交接、持久化状态以支持重放。

所有这些都可在原语之上实现。它们都不是新的原语。

## 动手构建

`code/main.py` 用约 150 行标准库 Python 实现了四个原语。没有真正的 LLM——每个智能体都是一个脚本化的策略，让焦点保持在协调结构上。

该文件导出了：

- `Agent` —— 一个包含名称、系统提示、工具、策略函数的数据类。
- `Handoff` —— 一个返回新智能体的函数。
- `SharedState` —— 一个线程安全的消息池。
- `Orchestrator` —— 三种变体：`StaticOrchestrator`、`HandoffOrchestrator`、`LLMSelectorOrchestrator`（模拟）。

演示程序通过全部三种编排器类型运行相同的三智能体流水线（调研 → 写作 → 评审），并在最后打印消息池。你可以看到输出仅在于*谁选择下一个*；智能体和共享状态在各次运行中完全相同。

运行它：

```
python3 code/main.py
```

预期输出：三次编排器运行，每种模式一次。每次打印最终的消息池。如果调研者提前决定任务完成，交接驱动模式的运行会到达较少的智能体——这正是 LLM 路由的取舍权衡的缩影。

## 使用它

`outputs/skill-primitive-mapper.md` 是一个技能文件，它可以读取任何多智能体代码库或框架文档，并返回四个原语的映射。在一个新框架版本上运行它，就能在深入阅读文档之前获得一段话的理解。

## 交付它

在采用一个新框架之前，为其编写原语映射。如果你做不到，说明文档不完整，或者该框架正在发明第五个原语（很少见——检查是否有你未见过的共享状态变种）。

将映射固定在你的架构文档中。当新团队成员加入时，在给他们看 API 文档之前，先发送映射给他们。当框架版本变更时，对比映射的差异，而不是变更日志。

## 练习

1. 使用不同的智能体策略运行 `code/main.py` 三次。观察编排器的选择如何改变哪些智能体实际运行。
2. 实现第四种编排器类型：队列驱动的编排器，其中智能体轮询共享状态获取任务。可能发生什么死锁？你如何检测它？
3. 阅读 LangGraph 快速入门指南（https://docs.langchain.com/oss/python/langgraph/workflows-agents），并将其重新表述为四个原语。LangGraph 的哪些抽象是一一映射，哪些是便利包装？
4. 阅读 OpenAI Swarm 烹饪书（https://developers.openai.com/cookbook/examples/orchestrating_agents）。识别 Swarm 使四个原语中的哪一个最为易用，以及它将哪一个推给了调用方。
5. 从表格中找出一个完全隐藏共享状态的框架。解释当智能体需要在没有重读历史的情况下跨交接协调时，会出现什么问题。

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|------|----------------|------------------------|
| 智能体（Agent） | "一个带有工具的 LLM" | 一个 `(system_prompt, tools, model)` 三元组。无状态。 |
| 交接（Handoff） | "控制权转移" | 一个结构化的调用，指明下一个智能体和可选的负载。三种实现：函数返回、图边、发言选择。 |
| 共享状态（Shared state） | "记忆"/"上下文" | 多智能体系统中唯一有状态的部分。消息池或黑板。 |
| 编排器（Orchestrator） | "协调器" | 决定谁下一个运行的人。静态图、LLM 选择器、交接驱动或队列驱动。 |
| 原语（Primitive） | "抽象" | 每个框架参数化的四个轴之一。不是框架特性。 |
| 消息池（Message pool） | "共享聊天历史" | 全历史共享状态。易于推理，伸缩性差。 |
| 投影式状态（Projected state） | "限定视图" | 共享状态中按角色限定的视图。可扩展，需要模式设计。 |
| 发言选择（Speaker selection） | "谁下一个发言" | 编排器模式，一个函数（通常是 LLM）从一组智能体中挑选下一个。 |

## 延伸阅读

- [OpenAI cookbook: Orchestrating Agents — Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) —— 最清晰的交接驱动编排阐述
- [AutoGen stable docs](https://microsoft.github.io/autogen/stable/) —— GroupChat + 发言选择器是 LLM 选择编排的参考实现
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) —— 图边编排和基于归约器的共享状态
- [CrewAI introduction](https://docs.crewai.com/en/introduction) —— 角色-目标-背景故事智能体，Sequential / Hierarchical 流程
- [AG2（社区 AutoGen 延续分支）](https://github.com/ag2ai/ag2) —— 微软将 v0.4 移入维护后仍在活跃的 AutoGen v0.2 分支
