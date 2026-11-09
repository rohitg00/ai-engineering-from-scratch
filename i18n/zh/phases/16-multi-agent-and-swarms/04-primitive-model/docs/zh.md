# 多代理原始模型

> 四个原始,再也没有什么代理,交付,共享状态,管弦仪跨越四维设计空间, 2026年主要的多代理框架 (AutoGen,LangGraph,CrewAI,OpenAI Agents SDK,Microsoft Agent Framework) 是其中的点. 这一课将它们从零构建,运行一个玩具系统,然后将每个主要框架映射到同一轴上,

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 (Agent Engineering), Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## 问题

每六个月就会出发一个新的多代理框架. 2023年AutoGen. 2024年CrewAI. 2024年LangGraph和OpenAI Swarm. 2025年4月Google ADK. 2026年2月微软代理框架RC.每份新闻稿都声称是"正确的抽象".

如果你试图一次学习它们,你会被烧毁.API看起来不同.文件不同意"代理"是什么.一个框架称共享内存为"黑板",另一个称之为"消息池",第三个称之为"状态图".你开始怀疑该领域只是.

没有.在营销下,四个原始的稳定. 一次学习它们,在一段落中阅读每一个新的框架.

## 概念

### 它们是四个原始的.

1. **Agent**系统提示加上工具列表.无状态;每次运行都从系统提示和当前消息历史开始.
2. **Handoff**从一个代理转移到另一个机械上,一个工具调用,返回一个新的代理或一个条件后面的图边.
3. **Shared state**任何数据结构,可以读取 (有时写入) 超过一个代理. 信息池,黑板,键值存储,矢量内存.
4. **Orchestrator**选择:明确图表 (定决),LLM演讲者选择器 (软),最后演讲者传递呼叫 (OpenAI Swarm),或排队时间表 (swarm架构).

每个框架都选择每个轴的默认设置,其余部分是表面语法.

### 如何每一个2026年框架都将其映射到

| Framework | Agent | Handoff | Shared state | Orchestrator |
|-----------|-------|---------|--------------|--------------|
| OpenAI Swarm / Agents SDK | `Agent(instructions, tools)` | tool returns Agent | caller's problem | the LLM's next handoff call |
| AutoGen v0.4 / AG2 | `ConversableAgent` | speaker-selector on GroupChat | message pool | selector function (LLM or round-robin) |
| CrewAI | `Agent(role, goal, backstory)` | `Process.Sequential / Hierarchical` | Task outputs chained | manager LLM or static order |
| LangGraph | node function | graph edge + condition | `StateGraph` reducer | the graph, deterministic |
| Microsoft Agent Framework | agent + orchestration patterns | pattern-specific | thread / context | pattern-specific |
| Google ADK | agent + A2A card | A2A task | A2A artifacts | host decides |

表面的差异看起来很大,下面:相同的四个扣.

### 为什么这很重要

一旦你看到原始的,框架比较变成一个简短的检查列表:

- 调整者是否信任LLM进行路由 (Swarm) 或是将路由编码 (LangGraph)?
- 共有状态是完整的历史 (GroupChat) 或预测 (StateGraph减小器)?
- 机关可以修改彼此的提示 (CrewAI管理员) 或只交手 (Swarm)?

你停止购买"最好的多代理框架",开始为你真正关心的轴设计.

### 无国无国的洞察力

任何原始除了共享状态之外都是无状态的. 代理是函数 (提示,工具). 交付是函数调用. 管弦仪是调度器. **The only stateful thing in the system is shared state.**这就是所有有趣的错误的所在:记忆中毒 (课15),消息订单,版本编辑,写作纠纷.

隐藏共享状态的框架 (Swarm) 将问题推向调用者. 集中它的框架 (LangGraph检查点,AutoGen池) 使其可检查,但将协调成本转移到共享状态实现.

### 单一原始人的解剖学

#### 代理

```
Agent = (system_prompt, tools, model, optional_name)
```

没有记忆,没有状态,两个具有相同的系统提示和工具的代理人是可替换的,一切看起来像每个代理状态的实际状态是共享状态或交付协议.

#### 交付

```
Handoff = (from_agent, to_agent, reason, payload)
```

实施的三个主导:

- **Function return**工具返回下一个代理.这是OpenAI群体模式.代理在工具方案中携带路由.
- **Graph edge** 兰格拉夫.边缘是声明性的.LLM产生一个值;一个条件选择下一个节点.
- **Speaker selection** AutoGen GroupChat. 选号函数 (有时本身就是一个LLM调用) 阅读游泳池并选择接下来说谁.

#### 共同国家

```
SharedState = { messages: [], artifacts: {}, context: {} }
```

最少是信息列表.通常更多的是:结构化文物 (CrewAI任务输出),输入文本 (长度图减小器),外部内存 (MCP,向量DB).

两个拓:**full pool**(每个代理都看到每一个消息)**projected**预测的池是规模化的,但需要先前的方案设计.

#### 乐团主持人

```
Orchestrator = ({state, last_speaker}) -> next_agent
```

它们有四种味道:

- **Static**图是在构建时间 (长图确定性, CrewAI序列) 固定.
- **LLM-selected**一个法学士读出游泳池,然后选择下一个讲者 (AutoGen, CrewAI等级).
- **Handoff-driven**当前代理通过调用交付工具 (Swarm) 决定.
- **Queue-driven**从共享队列中拉出工人;没有明确的下一个扬声器 (群众架构,矩阵).

### 框架之间的变化

一旦原始的定位,剩下的设计决定是:

- **Memory strategy**短暂对耐用检查点 (长图检查点).
- **Safety boundary**可以批准转让 (人在循环中).
- **Cost accounting**每位代理的代币预算.
- **Observability**追踪传递,持续状态重播.

它们都可在原始上实现.

```figure
a5-primitive-radar
```

## 建立它

`code/main.py`执行四个原始在约150行的Stdlib Python. 没有真正的LLM每个代理都是一个脚本的政策,所以重点仍然是协调结构.

文件出口:

- `Agent`一个数据类名称,系统提示,工具,政策功能.
- `Handoff`一个返回新代理的函数.
- `SharedState`一个安全的线程信息池.
- `Orchestrator`三个变体:`StaticOrchestrator`现在`HandoffOrchestrator`现在`LLMSelectorOrchestrator`它们是的.

演示程序通过三个管弦组类型运行相同的三位代理管道 (搜索 →写 → 审查) 并在最后打印了消息池.你可以看到输出仅在 *谁选择下一个* 中不同; 代理和共享状态在运行中相同.

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

预期输出:三个管弦乐器运行,每一个模式.每个打印最后的消息池.如果研究人员决定提前完成,转发运行会达到较少的代理人.

## 用它

`outputs/skill-primitive-mapper.md`通过使用一个新框架版本运行它,才能在阅读文件之前获得一段落的理解.

## 运送它

在采用新框架之前,请为它写原始地图.如果您无法,则文件是不完整的,或者框架正在发明第五个原始 (罕见的查找您未见的共享状态口味).

编写地图在您的架构文档中.当新团队成员加入时,请在API文档之前发送地图.当框架版本发生变化时,将地图区分,而不是变更日志.

## 运动

1. 跑步`code/main.py`观察主管如何改变哪些代理运行.
2. 执行第四种管弦乐器类型:排队驱动的, 代理人投票分享工作状态.
3. 通过LangGraph快速启动 (https://docs.langchain.com/oss/python/langgraph/workflows-agents拉格拉夫的抽象图 1:1中的哪个是便利包装?
4. 阅读OpenAI群群的厨师书 (https://developers.openai.com/cookbook/examples/orchestrating_agents确定Swarm最具工作效能的四种原始物种,
5. 在这个表中找到一个完全隐藏共享状态的框架. 解释什么是打断的,当代理人需要在传递中协调,而不需要重新阅读历史.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "An LLM with tools" | A `(system_prompt, tools, model)` triple. Stateless. |
| Handoff | "Transfer of control" | A structured call that names the next agent and optional payload. Three implementations: function return, graph edge, speaker selection. |
| Shared state | "Memory" / "context" | The only stateful part of a multi-agent system. Message pool or blackboard. |
| Orchestrator | "Coordinator" | Whoever decides who runs next. Static graph, LLM selector, handoff-driven, or queue-driven. |
| Primitive | "Abstraction" | One of the four axes every framework parameterizes. Not a framework feature. |
| Message pool | "Shared chat history" | Full-history shared state. Easy to reason about, scales badly. |
| Projected state | "Scoped view" | Role-specific view into shared state. Scales, requires schema design. |
| Speaker selection | "Who talks next" | Orchestrator pattern where a function (often an LLM) picks the next agent from a group. |

## 进一步阅读

- [OpenAI cookbook: Orchestrating Agents — Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents)最清楚的交付驱动的管弦乐
- [AutoGen stable docs](https://microsoft.github.io/autogen/stable/)集团聊天+演讲者选择是LLM选择的管弦乐队的参考
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents)图边管弦和基于减小器的共享状态
- [CrewAI introduction](https://docs.crewai.com/en/introduction)角色目标背景经纪人,序列/层次流程
- [AG2 (community AutoGen continuation)](https://github.com/ag2ai/ag2)微软将0.4转移到维护后的AutoGen v0.2直播线
