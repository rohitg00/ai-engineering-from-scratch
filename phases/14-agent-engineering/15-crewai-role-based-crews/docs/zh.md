# CrewAI：基于角色的 Crew 与 Flow

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> CrewAI 是 2026 年的基于角色的多 agent 框架。四个原语：Agent、Task、Crew、Process。两种顶层形态：Crews（自治、基于角色的协作）和 Flows（事件驱动、确定性）。文档说得很直白：「面向任何生产级应用，请从 Flow 起步。」

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 14 (Actor Model)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 说出 CrewAI 的四个原语（Agent、Task、Crew、Process）以及各自的职责。
- 区分 Sequential、Hierarchical 与规划中的 Consensus process；按工作负载选用其一。
- 区分 Crews（自治、基于角色）与 Flows（事件驱动、确定性），并解释官方文档的生产推荐。
- 用 `@tool` 装饰器与 `BaseTool` 子类挂载工具；权衡结构化输出 vs 自由文本。
- 说出 CrewAI 的四种 memory 类型，以及它们各自在什么场景才划算。
- 用 stdlib 实现一个三 agent 的 crew（researcher、writer、editor），输出一份 brief。
- 识别 CrewAI 的三种典型失败模式：prompt 膨胀、manager-LLM 税、脆弱的 handoff（交接）。

## 问题（The Problem）

采用多 agent 框架的团队都会撞到同一堵墙。「自治协作」在 demo 里听起来很美。然后客户报了一个 bug，你需要确定性回放。或者财务来问一次 LLM 路由的 crew 跑一轮要花多少钱。或者凌晨三点 on-call 想知道哪个 agent 卡住了。

自由形式、LLM 路由的 crew 没法干净地回答这些问题。纯 DAG（有向无环图）能回答全部，但失去了 brainstorming agent 所需的探索性形态。

CrewAI 的拆分对这种取舍很坦诚。Crews 用于协作的、基于角色的、探索性的工作。Flows 用于事件驱动的、代码主导的、可审计的生产。同一个框架，两种形态，按场景挑。

## 概念（The Concept）

### 四个原语（Four primitives）

CrewAI 的接口面很小。背下这块，剩下都是配置。

- **Agent。** `role + goal + backstory + tools + (optional) llm`。backstory 是承重墙。它塑造语气、判断力、agent 何时停下。tools 是 agent 可以调用的函数（下面详述）。
- **Task。** `description + expected_output + agent + (optional) context + (optional) output_pydantic`。一个可复用的工作单元。`expected_output` 是契约。`context` 列出上游 task，其输出会被传入。`output_pydantic` 强制结构化形态。
- **Crew。** 容器。持有 `agents` 列表、`tasks` 列表、`process`，以及可选的 `memory` + `verbose` + `manager_llm` 配置。
- **Process。** 执行策略。Sequential、Hierarchical、Consensus（规划中）。决定一次运行的形态。

Agent 之间不直接看到彼此。Task 引用 agent。Crew 串联 task。Process 决定谁挑下一个 task。这就是全部心智模型。

> **验证版本** CrewAI 0.86（2026-05）。新版本可能重命名或合并 process 类型；在依赖某个具体形态前，请查阅 [CrewAI Processes 文档](https://docs.crewai.com/concepts/processes)。

### Sequential vs Hierarchical vs Consensus

- **Sequential。** Task 按声明顺序执行。task N 的输出作为 `context` 提供给 task N+1。成本最低。最可预测。当顺序固定时使用。
- **Hierarchical。** 一个 manager Agent（独立的 LLM 调用）在专家之间路由。CrewAI 要么从你的 `manager_llm` 配置生成 manager，要么用默认的。manager 每轮挑下一个 task，可以拒绝或重新路由。当你有四个或以上专家、且顺序确实依赖前序输出时使用。
- **Consensus。** 规划中，目前公开 API 还未实现。文档为未来一种基于投票的 process 保留这个名字。今天不要依赖它。

Hierarchical 在每个专家调用之上额外加一个每轮 LLM 调用（manager）。在五步运行里 token 成本可能翻三倍。只有当你确实需要这种路由时才付这笔钱。

### Crews vs Flows

这是文档在 2026 年开篇就强调的取景方式。

- **Crew。** LLM 驱动的自治。框架在运行时挑选形态。适合：研究、brainstorming、初稿、那些「路径本身就是答案的一部分」的场景。难回放。难测试。原型成本低。
- **Flow。** 你拥有的事件驱动图。`@start` 标记入口。`@listen(topic)` 标记一个步骤——当另一个步骤发出该 topic 时它触发。每个步骤都是普通 Python（内部可以调用 Crew）。适合：生产。可观测。可测试。确定性。

文档的 2026 生产推荐：从 Flow 起步。当自治值回票价时，把 Crew 以 `Crew.kickoff()` 调用的方式折叠进 Flow 步骤里。Flow 给你审计轨迹，Crew 给你探索性。组合，不是二选一。

### 工具集成（Tool integration）

给 Agent 挂工具有三种方式。挑符合需求的最简单一种。

1. **`@tool` 装饰器。** 纯函数变成工具。签名即 schema；docstring 是 LLM 看到的描述。最适合一次性的小工具。

   ```python
   from crewai.tools import tool

   @tool("Search the web")
   def search(query: str) -> str:
       """Return top results for the query."""
       return run_search(query)
   ```

2. **`BaseTool` 子类。** 基于类的工具，带显式 args schema、async 支持、重试。当工具有状态（一个 client、一个 cache）或需要结构化参数时使用。

   ```python
   from crewai.tools import BaseTool
   from pydantic import BaseModel

   class SearchArgs(BaseModel):
       query: str
       limit: int = 10

   class SearchTool(BaseTool):
       name = "web_search"
       description = "Search the web and return top results."
       args_schema = SearchArgs

       def _run(self, query: str, limit: int = 10) -> str:
           return self.client.search(query, limit=limit)
   ```

3. **内建工具集。** CrewAI 内置一方适配器：`SerperDevTool`、`FileReadTool`、`DirectoryReadTool`、`CodeInterpreterTool`、`RagTool`、`WebsiteSearchTool`。一个 import 就能挂上。

结构化输出用 Pydantic。在 Task 上传 `output_pydantic=MyModel`。CrewAI 会把 LLM 响应对照模型校验，要么强转、要么重试。把它和一个收紧的 `expected_output` 字符串配对使用。自由文本输出对初稿没问题；下游 Flow 能消费的是结构化输出。

### Memory hooks

CrewAI 开箱即提供四种 memory 类型。它们可以组合：一个 Crew 可以同时启用全部四种。

> **验证版本** CrewAI 0.86（2026-05）。最近的版本把所有东西经由统一的 `Memory` 系统包装这四种存储。下面的概念模型仍然成立，但公开类的接口面在新版本里可能收敛为单一的 `Memory` 入口；当前 API 请查阅 [CrewAI memory 文档](https://docs.crewai.com/concepts/memory)。

- **Short-term。** 单次运行内的对话缓冲。结束后清空。
- **Long-term。** 跨运行持久化。存在向量数据库里（默认 Chroma，可换）。按与当前 task 的相似度检索。
- **Entity。** 按实体存事实。「客户 X 在企业版方案上。」按实体而非相似度索引。跨运行存活。
- **Contextual。** 装配时检索。在 Agent 需要的那一刻拉取相关 memory，而非预加载。

在 Crew 上用 `memory=True` 启用，或者按类型分别配置。背后由你配置的 embeddings 提供方支撑（默认 OpenAI，可切换到本地）。Memory 是 CrewAI 相对更轻量的框架挣回身价的地方之一；纯 LangGraph 需要你自己把这四种逐一接好。

### CrewAI 适配的场景（When CrewAI fits）

- 三到六个有命名角色、协作型工作流的 agent。起草、评审、规划、brainstorming。
- 路由场景中，「LLM 对下一步的判断」本身就是价值的一部分（Hierarchical）。
- 团队读 `role + goal + backstory` 比读图定义更舒服的一切场景。

### CrewAI 不适配的场景（When CrewAI does not fit）

- 严格定序的确定性 DAG。用 LangGraph（第 13 课）。图形态才是正确抽象；CrewAI 的角色取景反而是摩擦。
- 亚秒级延迟预算。Hierarchical 增加往返。即便 Sequential 也要把 backstory 和前序输出一起序列化进 prompt。
- 单 agent 循环。跳过框架；一个 agent loop（第 1 课）加一个工具注册表更短。

第 17 课（Agent Framework Tradeoffs）用矩阵铺开了这些。简版：CrewAI 站在「协作型、基于角色」的那一角。

### 依赖形态（Dependency shape）

独立于 LangChain。Python 3.10 到 3.13。使用 `uv`。star 数：见 [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI)（截至 2026-05 的快照）。AWS Bedrock 集成已记录在文档中；vendor 基准测试报告在 QA 工作负载上相对 LangGraph 有显著加速，但方法论（数据集、硬件、评估指标）未公开，所以把框架厂商的数据当作方向性参考即可。

### 这个模式会在哪里翻车（Where this pattern goes wrong）

- **backstory 引发的 prompt 膨胀。** 每个 agent 2000 字的 backstory，一个五 agent crew 还没等到第一次工具调用就把 context 预算烧光了。把 backstory 控制在 200 字以内。在 agent 之间复用短语；不要把同一份「家规」重复五遍。
- **Manager-LLM token 税。** Hierarchical process 在每次专家调用前增加一次 manager LLM 调用。五个 task 的 crew 就从 5 次变成 6 次 LLM 调用，且 manager 调用还要带上完整 task 列表加前序输出。除非路由依赖输出，否则切回 Sequential。
- **脆弱的 handoff。** Task N 的 `expected_output` 是「一份大纲」。Task N+1 把它当 `context` 读，试图解析出三段。LLM 给了四段。下游 Agent 临场发挥。修法：在 Task N 上加 `output_pydantic`，让 Task N+1 读到的是带类型的对象，不是自由文本。
- **Crew 当生产。** 自由形态的 Crew 没有 Flow 包装就直接上线。输出方差大；无法回放；on-call 没法把一次坏运行和一次好运行 diff 起来。用 Flow 包起来。

## 动手实现（Build It）

`code/main.py` 用 stdlib 实现两种形态，外加一个三 agent 的 crew。

形态：

- `Agent`、`Task` dataclass，对齐 CrewAI 的接口面。
- `SequentialCrew.kickoff(inputs)` 按声明顺序执行 task，把输出作为 `context` 串过去。
- `HierarchicalCrew.kickoff(topic)` 加一个 manager Agent 每轮挑下一个专家，碰到 "done" 就停。
- `Flow` 带 `@start` 和 `@listen(topic)` 装饰器，一个小事件循环，加一个 trace。
- `tool(name)` 装饰器，对齐 CrewAI 的 `@tool` 形态。
- `Memory` 含 `short_term`、`long_term`、`entity` 存储；mock 的相似度用 numpy。
- mock LLM 响应是按 role 加 input 前缀键入的硬编码字符串。无网络。确定性。

具体 demo：researcher、writer、editor 的 crew，产出一份关于 "agent engineering 2026" 的 brief。Researcher 拉取（mock 的）资料。Writer 起草。Editor 收紧。同一个 crew 也跑一遍 Flow，演示确定性形态。

运行：

```bash
python3 code/main.py
```

Trace 覆盖：sequential crew 把输出经由 `context` 串起来；hierarchical crew 由 manager 挑选（researcher、writer、editor，最后 "done"）；flow 带显式 topic（`researched`、`drafted`、`edited`）跑同样的三步；工具调用经由 `@tool` 路由；以及 long-term memory 跨两次 kickoff 存活。

Crew 的 trace 是流动的；manager 原则上可以重排。Flow 的 trace 是固定的。这个选择就是本课。

## 用起来（Use It）

- **CrewAI Flow** 用于生产。哪怕 Flow 只有一个步骤、内部调用 `Crew.kickoff()` 也行。Flow 提供审计边界。
- **CrewAI Crew（Sequential）** 用于顺序清晰的协作型工作，尤其是初稿与评审循环。
- **CrewAI Crew（Hierarchical）** 当路由依赖输出、且你有四个或以上专家时使用。
- **LangGraph**（第 13 课）用于显式状态机、可持久续跑、严格定序。
- **AutoGen v0.4**（第 14 课）用于 actor 模型并发与故障隔离。
- **OpenAI Agents SDK**（第 16 课）用于 OpenAI 优先、需要 handoff 与 guardrail（护栏）的产品。
- **Claude Agent SDK**（第 17 课）用于 Claude 优先、需要 subagent 与会话存储的产品。

## 上线部署（Ship It）

`outputs/skill-crew-or-flow.md` 为某个任务挑 Crew 还是 Flow，并搭最小实现。对「无 backstory 的 Crew」「无显式 topic 的 Flow」「不到三个专家的 Hierarchical」直接拒收。

## 陷阱（Pitfalls）

- **把 backstory 当调味料。** 它会塑造输出。每个 agent 测三个变体；方差是真的。挑一个，冻住。
- **跳过 `expected_output`。** 没有按 task 的契约，下游 task 会捡到 LLM 随便产出的东西。Crew 跑通了；审计跪了。
- **Memory 一直开。** Long-term 每次运行都写。向量数据库越长越大。检索越来越吵。把写入限定在「事实需要持久化」的那些 task 上。
- **Manager prompt 漂移。** Hierarchical 的 manager prompt 是隐式的。如果路由变怪，开 verbose 把它 dump 出来读。
- **Crew 里的工具副作用。** Crew 调用工具的次数可能比预期多。POST、DELETE、支付属于 Flow 步骤，永远不放在 Crew 工具里。

## 练习（Exercises）

1. 把 Sequential crew 改成 Flow。数一数方差降低的接触点。也记一下哪里可读性下降了。
2. 给 crew 加上 entity memory：关于某个客户的事实跨 kickoff 持久化。验证检索拉到的是正确的实体。
3. 实现一个 Hierarchical process，manager 拒绝在 writer 输出至少三段之前路由到 editor。trace 出重试过程。
4. 为（mock 的）网页搜索接一个 `BaseTool` 子类。对比它和 `@tool` 装饰器版本的 trace 形态。
5. 在 editor task 上加 `output_pydantic=Brief`，其中 `Brief` 含 `title`、`summary`、`sections`。让 writer task 输出一次格式损坏的 JSON；在 trace 里验证 CrewAI 的重试行为。
6. 读 CrewAI 的文档介绍。把这个玩具版迁移到真正的 `crewai` API。stdlib 版跳过了哪些保证？
7. 给一次真实运行接上 AgentOps 或 Langfuse（第 24 课）。stdlib 版漏掉了哪些 trace？

## 关键术语（Key Terms）

| 术语 | 别人嘴里怎么说 | 它实际是什么 |
|------|----------------|------------------------|
| Agent | 「人设」 | role + goal + backstory + tools |
| Task | 「工作单元」 | description + expected output + 指派对象 + 可选结构化输出 |
| Crew | 「agent 团队」 | Agents + Tasks + Process 的容器 |
| Process | 「执行策略」 | Sequential / Hierarchical / Consensus（规划中） |
| Flow | 「确定性工作流」 | 事件驱动、代码主导、可测试 |
| Backstory | 「人设 prompt」 | 塑造 Agent 语气与判断力的部分 |
| `@tool` | 「函数工具」 | 把函数变成 Agent 可调用工具的装饰器 |
| `BaseTool` | 「类工具」 | 基于类的工具，带 args schema、重试、async 支持 |
| Entity memory | 「按实体的事实」 | 范围限定到某个客户 / 账号 / issue 的 memory |
| Long-term memory | 「跨运行 memory」 | 由向量库支撑、跨 kickoff 存活的 memory |
| Contextual memory | 「即时检索」 | 在 Agent 需要的那一刻拉取的 memory |
| Manager LLM | 「路由 agent」 | Hierarchical process 中挑下一个 task 的额外 LLM |
| `expected_output` | 「task 契约」 | 告诉 Agent（与审计）应当返回什么形态的字符串 |

## 延伸阅读（Further Reading）

- [CrewAI docs introduction](https://docs.crewai.com/en/introduction)：概念以及推荐的生产路径
- [CrewAI Flows guide](https://docs.crewai.com/en/concepts/flows)：事件驱动形态，`@start`、`@listen`
- [CrewAI tools reference](https://docs.crewai.com/en/concepts/tools)：`@tool`、`BaseTool`、内建工具集
- [CrewAI memory](https://docs.crewai.com/en/concepts/memory)：short-term、long-term、entity、contextual
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)：多 agent 何时有用、何时无用
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)：状态机式替代方案
