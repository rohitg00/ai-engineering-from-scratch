# 代理框架交易 图表,角色和演员配乐

> 每个框架都销售相同的演示 (研究代理构建报告) 并隐藏相同的错误 (状态方案与编排层作战). 选择一个框架,其抽象与您的问题的形状相匹配; 其余的东西都是您写的两次粘合.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 16 (LangGraph)
**Time:** ~45 minutes

## 问题

你有一个需要多次LLM调试的任务.也许这是一个研究工作流程 (计划,搜索,总结,引用).也许这是一个代码审查管道 (解析差异,批评,补丁,验证).也许这是一个多轮辅助员,谁会预订飞行,写电子邮件,文件支出报告.你选择一个框架.

之后三天,你发现了框架的抽象漏洞. 机器人给你提供角色,但当"研究人员"需要把结构化的计划交给"作家"时,它会对你进行斗争. 兰格拉夫给你一个状态图, 但迫使你在你知道代理会做什么之前, 命名每个转变. 艾格诺给你一个单机抽象,当你试图扩散到三个同时工作者时,它会尖叫.

解决方案不是"选择最好的框架". 解决方案是将框架的核心抽象与您的问题的形状相匹配.

## 概念

![Agent framework matrix: core abstraction vs problem shape](../assets/framework-matrix.svg)

它们的核心抽象不一样.

| Framework | Core abstraction | Best fit | Worst fit |
|-----------|------------------|----------|-----------|
| **LangGraph** | `StateGraph` — typed state, nodes, conditional edges, checkpointer. | Workflows with explicit state and human-in-the-loop interrupts; production agents needing time-travel debugging. | Loose, role-driven brainstorming where the topology is unknown. |
| **CrewAI** | `Crew` — roles (goal, backstory), tasks, process (sequential or hierarchical). | Role-playing or persona-driven workflows with a short linear/hierarchical plan. | Anything stateful beyond the crew's turn history; complex branching. |
| **AutoGen** | `ConversableAgent` pair — two or more agents that speak in turns until an exit condition. | Multi-agent *dialogue* (teacher-student, proposer-critic, actor-reviewer) where the thinking emerges from the chat. | Deterministic workflows with a known DAG; anything needing durable state across restarts. |
| **Agno** | `Agent` — a single LLM + tools + memory, composable into teams. | Fast-to-build single agents and lightweight teams; strong multi-modality and built-in storage drivers. | Deep, explicitly-branched graphs with custom reducers. |

### "抽象"实际上意味着什么

框架的核心抽象是你在设计时绘制在白板上的东西.

- **LangGraph**结点是步骤,边缘是过渡,每个点都打字状态对象.
- **CrewAI**工作人员的职位描述,管理员的任务路线.
- **AutoGen**两个代理人互相发短信,如果需要一个调节者,第三个加入.
- **Agno**让一个团队一起画一个单一的盒子,上面挂着工具. 让一个团队一起画一个盒子. 心理模型是"包括电池的代理".

### 国家问题

制造业的框架选择在大多数国家都会崩.

- **LangGraph.**类型状态 (`TypedDict`简历,中断和时间旅行是免费的. *(见第11期 · 16期.) *
- **CrewAI.**通过                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            `context`其他类型的`output_pydantic`没有一个持久的每员工店出盒子,如果你必须生存一个重启,你自己就会跳.
- **AutoGen.**状态是聊天历史和任何用户定义的状态`context`对话转录仍然存在,除非你写适配器,否则任意工作流状态不会存在.
- **Agno.**连接到一个 `Agent`通过`storage=`对话会话和用户记忆会自动保存.

### 分支问题

每个非微不足道的代理都分支,谁决定分支的事.

- **LangGraph**您决定,通过条件边缘.路由是一个名字分支的Python函数.分支在编译图中是第一类;检查点记录了哪个分支被取.
- **CrewAI**管理者在等级模式下决定;在序列模式下,你决定在构建时.路由是隐含的任务列表中;管理者的提示之外没有一级"如果".
- **AutoGen**代理人通过聊天决定. 分支是从谁接下来说.`GroupChatManager`选择下一个扬声器;你可以手写一个`speaker_selection_method`但默认的原因是,
- **Agno**代理人决定下一步使用哪个工具.团队有协调员/路由器/合作者模式;在此之外,分支是开发者的责任.

### 观察性问题

- **LangGraph**通过兰格斯密或任何OTel出口商的OpenTelemetry.每个节点过渡都是追踪时间;检查站是可重复的追踪.兰格斯密是第一方选项;兰格斯密/尼克斯也拥有适配器.
- **CrewAI**自2025年底以来的第一级开放电气;与兰格斯,城,奥皮克,代理运营公司的集成.
- **AutoGen**通过OpenTelemetry集成`autogen-core`检测细分度是每个代理信息,而不是每个节点.
- **Agno**内置`monitoring=True`旗加上OpenTelemetry出口商;密切与Langfuse集成,以便进行会议追踪.

### 成本和延迟

所有四个框架都增加了每次通话的通用费用 (框架逻辑,验证,序列化).大致的通用费用增加顺序:Agno ≈ LangGraph < CrewAI ≈ AutoGen. 差异由框架的额外LLM路由所占主导地位. CrewAI的层次管理人员花费代币决定谁接下来; AutoGen的代码.`GroupChatManager`长图只在你写的位置花钱.`llm.invoke`亚格诺的单机代理路线很薄.

当每次运行成本重要时,更好选择明确的路由 (长图边缘,自动生成`speaker_selection_method`) 通过选择LLM路线.

### 互操作性

- **LangGraph** **LangChain**工具,检索器,LLM. 一级MCP适配器 (作为MCP服务器进口的工具).
- **CrewAI**工具继承`BaseTool`通过机组人员的代表团通过机组人员的代表团,`allow_delegation=True`现在,我们要去.
- **AutoGen**其他`FunctionTool`通过"Python"来调用,可使用的MCP适配器,并将其紧密地连接到AG2生态系统,以实现代理对代理模式.
- **Agno**其他`@tool`装饰器或BaseTool子类;MCP适配器;工具可在代理人和团队之间共享.

## 技能

> 您可以用一句话解释为什么给定的框架适合给定的代理问题.

预制清单:

1. **Draw the shape.**这是一个图表 (类型状态,命名的过渡);一个角色扮演 (专家放弃工作);一个聊天 (代理人谈到完成);一个单独的代理人有工具?
2. **Decide who branches.**开发者决定分支 → 兰格拉夫. 管理者-代理人决定 → 机组人员等级. 聊天出现 → 自动生成. 工具调用决定 → Agno.
3. **Check the state budget.**如果是,则是LangGraph默认,AgnO会话覆盖对话范围状态.
4. **Check the cost budget.**如果代理人每天运行数千次, 宁愿明确的路由.
5. **Budget the framework overhead.**如果任务是两个LLM调用和一个工具,请写30行简单的Python;没有框架比没有框架便宜.

拒绝在绘制图表,组织图表,聊天或代理框之前寻找一个框架.拒绝选择一个强迫你为你真正需要的东西而战的框架.

## 决策矩阵

| Problem shape | Preferred framework | Why |
|---------------|---------------------|-----|
| Workflow DAG with typed state, human approvals, long-running | LangGraph | First-class state, checkpointer, interrupts, time-travel. |
| Research / writing pipeline with distinct roles | CrewAI (sequential) or LangGraph subgraphs | Role-per-task is cheap to express in CrewAI; scale up with LangGraph when branching gets complex. |
| Proposer-critic or teacher-student dialogue | AutoGen | Two-agent chat is its native shape. |
| Single agent with tools, sessions, memory | Agno | Thinnest setup, built-in storage and memory. |
| Thousands of parallel fanouts with reducers | LangGraph + `Send` | The only one with a first-class parallel-dispatch API. |
| Quick prototype, no framework commitment | Plain Python + provider SDK | No framework is the fastest framework. |

```figure
l5-framework-fit
```

## 运动

1. **Easy.**"研究人类总部,写一个200字的简要,引用来源",并将其实现在LangGraph (四个节点:计划,搜索,写,引用) 和CrewAI (三个角色:研究人员,作家,编辑). 报告每次运行和代码行代码成本.
2. **Medium.**在AutoGen中构建相同的任务 (研究人员 作家聊天,编辑通过 加入`GroupChat`) 和阿格诺 (一个代理人`search_tools`其他`write_tools`根据 (a) 每次运行成本, (b) 事故后恢复能力, (c) 在写作步骤之前注入人类批准的能力,将四个实现分类.
3. **Hard.**建立一个决策树脚本`pick_framework.py`需要简短的问题描述 (JSON: `{has_typed_state, has_roles, has_dialogue, has_parallel_fanout, needs_resume}`) 并返回一个句子的推,请在您自己设计的六个案例上验证.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Orchestration | "How the agents coordinate" | The layer that decides which node/role/agent runs next. |
| Durable state | "Resume after a restart" | State that survives process death, attached to a checkpoint or session store. |
| LLM-selected routing | "Let the model decide" | A planner LLM picks the next step each turn; flexible but pays tokens on every decision. |
| Explicit routing | "Developer decides" | A Python function or static edge picks the next step; cheap and auditable. |
| Crew | "A CrewAI team" | Roles + tasks + process (sequential or hierarchical) bound into a single runnable. |
| GroupChat | "AutoGen's multi-agent chat" | A managed conversation between N agents with a speaker selector. |
| Team (Agno) | "Multi-agent Agno" | Route / coordinate / collaborate mode over a set of agents. |
| StateGraph | "LangGraph's graph" | Typed-state, node, conditional-edge, checkpointer abstraction. |

## 进一步阅读

- [LangGraph documentation](https://langchain-ai.github.io/langgraph/)国家图,检查点,中断,时间旅行.
- [CrewAI documentation](https://docs.crewai.com/) 机组人员,流动,代理人,任务,过程.
- [AutoGen documentation](https://microsoft.github.io/autogen/)可交谈的代理,集团聊天,团队,工具.
- [Agno documentation](https://docs.agno.com/)代理,团队,工作流程,存储,内存.
- [Anthropic — Building effective agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents)模式图书馆 (即时链接,路由,并行,管弦工作者,评估者优化器) 框架-无知.
- [Yao et al., "ReAct: Synergizing Reasoning and Acting" (ICLR 2023)](https://arxiv.org/abs/2210.03629)每个框架都穿着循环.
- [Wu et al., "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation" (2023)](https://arxiv.org/abs/2308.08155) 汽车代购设计文件.
- [Park et al., "Generative Agents: Interactive Simulacra of Human Behavior" (UIST 2023)](https://arxiv.org/abs/2304.03442)角色扮演基础, CrewAI风格的人物堆建立在.
-                                                                                                                                                                                                                                                               
- 阶段11·19 (反射) 一个图案,它清晰地映射到LangGraph,但对CrewAI来说很尬.
- 如何使用仪器,无论你选择哪个框架.
