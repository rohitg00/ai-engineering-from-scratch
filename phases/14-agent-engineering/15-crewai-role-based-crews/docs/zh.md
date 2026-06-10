# 15 · CrewAI：基于角色的 Crew 与 Flow

> CrewAI 是 2026 年的基于角色的多智能体框架。四个原语：Agent、Task、Crew、Process。两种顶层形态：Crew（自主、基于角色的协作）与 Flow（事件驱动、确定性）。官方文档直言不讳：「对于任何生产就绪的应用，先从 Flow 开始。」

**类型：** 学习 + 构建
**语言：** Python（标准库）
**前置：** 阶段 14 · 12（工作流模式）、阶段 14 · 14（Actor 模型）
**时长：** 约 75 分钟

## 学习目标

- 说出 CrewAI 的四个原语（Agent、Task、Crew、Process）以及各自负责什么。
- 区分 Sequential、Hierarchical 以及计划中的 Consensus 流程；为每种工作负载挑选其一。
- 区分 Crew（自主、基于角色）与 Flow（事件驱动、确定性），并解释文档给出的生产建议。
- 用 `@tool` 装饰器和 `BaseTool` 子类接入工具；权衡结构化输出与自由文本的取舍。
- 说出 CrewAI 的四种记忆类型，以及各自在何时见效。
- 用标准库实现一个三智能体 crew（researcher、writer、editor），产出一份简报。
- 识别 CrewAI 的三种失败模式：提示词膨胀、manager-LLM 税、脆弱的交接。

## 问题所在

采用多智能体框架的团队都会撞上同一堵墙。「自主协作」在演示里听起来很棒。然后一位客户提了个 bug，你需要确定性的回放（replay）。或者财务部门问你，一个由 LLM 路由的 crew 每次运行要花多少钱。又或者值班的人需要知道凌晨 3 点是哪个智能体卡住了。

自由形态、由 LLM 路由的 crew 对这些问题没有一个能干净地回答。纯粹的 DAG（有向无环图）能全部回答，但失去了头脑风暴型智能体所需的那种探索性形态。

CrewAI 的拆分对这个权衡很诚实。Crew 用于协作式、基于角色、探索性的工作。Flow 用于事件驱动、代码掌控、可审计的生产环境。同一个框架，两种形态，按场景挑选。

## 核心概念

### 四个原语

CrewAI 的接口很小。记住下面这些，剩下的都是配置。

- **Agent。** `role + goal + backstory + tools + （可选）llm`。backstory 是承重墙。它塑造语气、判断力以及智能体何时停下。tools 是智能体可以调用的函数（下文详述）。
- **Task。** `description + expected_output + agent + （可选）context + （可选）output_pydantic`。一个可复用的工作单元。`expected_output` 是契约。`context` 列出其输出会被传入的上游任务。`output_pydantic` 强制结构化形态。
- **Crew。** 容器。负责持有 `agents` 列表、`tasks` 列表、`process`，以及可选的 `memory` + `verbose` + `manager_llm` 设置。
- **Process。** 执行策略。Sequential、Hierarchical、Consensus（计划中）。决定整个运行的形态。

智能体之间不会直接看到彼此。Task 引用智能体。Crew 对 Task 排序。Process 决定由谁来挑选下一个 Task。这就是全部的心智模型。

> **验证版本** CrewAI 0.86（2026-05）。更新的版本可能会重命名或合并 process 类型；在依赖某个具体形态之前，请查阅 [CrewAI Processes 文档](https://docs.crewai.com/concepts/processes)。

### Sequential 对比 Hierarchical 对比 Consensus

- **Sequential。** Task 按声明顺序运行。第 N 个任务的输出会作为 `context` 提供给第 N+1 个任务。成本最低。最可预测。当顺序固定时使用。
- **Hierarchical。** 一个 manager Agent（独立的 LLM 调用）在专家之间进行路由。CrewAI 会从你的 `manager_llm` 配置或一个默认值来生成这个 manager。manager 每一轮挑选下一个任务，并且可以拒绝或重新路由。当你有四个或更多专家、且顺序确实取决于先前输出时使用。
- **Consensus。** 计划中，目前尚未在公开 API 中实现。文档为一种未来基于投票的流程保留了这个名字。今天不要依赖它。

Hierarchical 在每一个专家调用之上，还要每轮加一次 LLM 调用（即 manager）。在五步的运行中，token 成本可能会翻三倍。只有当你确实需要这种路由时才为它付费。

### Crew 对比 Flow

这是文档在 2026 年率先抛出的框定方式。

- **Crew。** LLM 驱动的自主性。框架在运行时挑选形态。适合：研究、头脑风暴、初稿，以及任何「路径本身就是答案一部分」的场景。难以回放。难以测试。原型成本低。
- **Flow。** 由你掌控的事件驱动图。`@start` 标记入口。`@listen(topic)` 标记一个步骤，当另一个步骤发出该 topic 时触发。每个步骤都是纯 Python（内部可以调用一个 Crew）。适合：生产环境。可观测。可测试。确定性。

文档在 2026 年给出的生产建议：先从 Flow 开始。当自主性配得上它的成本时，再把 Crew 以 `Crew.kickoff()` 调用的形式折叠进 Flow 步骤里。Flow 给你审计轨迹，Crew 给你探索能力。组合，而非二选一。

### 工具集成

给 Agent 接入工具有三种方式。挑选最简单的那个。

1. **`@tool` 装饰器。** 纯函数变成工具。函数签名即 schema；docstring 是 LLM 看到的描述。最适合一次性的小工具。

   ```python
   from crewai.tools import tool

   @tool("Search the web")
   def search(query: str) -> str:
       """Return top results for the query."""
       return run_search(query)
   ```

2. **`BaseTool` 子类。** 基于类的工具，带显式的 args schema、异步支持、重试。当工具有状态（一个客户端、一个缓存）或需要结构化参数时使用。

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

3. **内置工具包。** CrewAI 自带一方适配器：`SerperDevTool`、`FileReadTool`、`DirectoryReadTool`、`CodeInterpreterTool`、`RagTool`、`WebsiteSearchTool`。一行 import 即可接入。

结构化输出使用 Pydantic。在 Task 上传入 `output_pydantic=MyModel`。CrewAI 会针对该模型校验 LLM 的响应，并进行强制转换或重试。把它和一个收紧的 `expected_output` 字符串搭配使用。自由文本输出对初稿没问题；结构化输出才是下游 Flow 可以消费的东西。

### 记忆钩子

CrewAI 开箱自带四种记忆类型。它们可以组合：一个 Crew 可以同时启用全部四种。

> **验证版本** CrewAI 0.86（2026-05）。最近的版本把一切都通过一个统一的 `Memory` 系统来路由，该系统封装了这四个存储。下面的概念模型依然成立，但在更新的版本中公开的类接口可能会收敛为单一的 `Memory` 入口；当前 API 请查阅 [CrewAI memory 文档](https://docs.crewai.com/concepts/memory)。

- **Short-term（短期）。** 单次运行内的对话缓冲区。运行结束时清空。
- **Long-term（长期）。** 跨运行持久化。存储在向量数据库中（默认 Chroma，可替换）。按与当前任务的相似度检索。
- **Entity（实体）。** 按实体存储事实。「客户 X 用的是企业版套餐。」以实体为键，而非以相似度为键。跨运行存续。
- **Contextual（上下文）。** 装配时检索。在 Agent 需要的那一刻拉取相关记忆，而非预先加载。

在 Crew 上用 `memory=True` 或按类型配置来启用。背后由你配置的一个嵌入（embeddings）提供方支撑（默认 OpenAI，可替换为本地）。记忆是 CrewAI 相对更轻量的框架体现价值的地方之一；纯 LangGraph 要求你自己把每一种都接好。

### CrewAI 适用时

- 三到六个带命名角色、有协作工作流的智能体。撰写、评审、规划、头脑风暴。
- 路由场景中，「下一步该走哪」这种 LLM 的判断本身就是价值的一部分（Hierarchical）。
- 任何团队更乐意读 `role + goal + backstory` 而非读一份图定义的场景。

### CrewAI 不适用时

- 有严格顺序的确定性 DAG。用 LangGraph（第 13 课）。图形态才是正确的抽象；CrewAI 的角色框定在这里是阻力。
- 亚秒级延迟预算。Hierarchical 增加往返。即便是 Sequential，也会串行化那些包含 backstory 和先前输出的提示词。
- 单智能体循环。跳过框架；一个智能体循环（第 1 课）加一个工具注册表更短。

第 17 课（智能体框架取舍）用一个矩阵把这些铺开。简短版本：CrewAI 坐落在「协作式、基于角色」的那个角落。

### 依赖形态

独立于 LangChain。Python 3.10 到 3.13。使用 `uv`。Star 数量：见 [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI)（截至 2026-05 的快照）。AWS Bedrock 集成有文档记录；厂商基准测试报告在问答（QA）工作负载上相对 LangGraph 有可观的提速，但其方法论（数据集、硬件、评估指标）并未公开，因此请把框架厂商给出的数字仅当作方向性参考。

### 这个模式会在哪里出错

- **来自 backstory 的提示词膨胀。** 每个智能体 2000 词的 backstory，加上一个五智能体的 crew，会在第一次工具调用之前就烧光上下文预算。把 backstory 控制在 200 词以内。在智能体之间复用措辞；不要把「家规风格」重复五遍。
- **manager-LLM token 税。** Hierarchical 流程会在每个专家调用之前加一次 manager LLM 调用。在一个五任务的 crew 上，那就是六次 LLM 调用而非五次，而且 manager 调用还携带完整的任务列表加上先前输出。除非路由依赖于输出，否则切换到 Sequential。
- **脆弱的交接。** 任务 N 的 `expected_output` 是「一份大纲」。任务 N+1 把它当作 `context` 读入，并尝试解析三个章节。但 LLM 产出了四个。下游 Agent 开始即兴发挥。用任务 N 上的 `output_pydantic` 来修复，让任务 N+1 读到的是一个有类型的对象，而非自由文本。
- **把 Crew 当生产。** 自由形态的 Crew 没有 Flow 包裹就被发到生产环境。输出波动很大；回放不可能；值班人员无法把一次糟糕的运行与一次正常运行做 diff。用 Flow 包裹它。

## 动手构建

`code/main.py` 用标准库实现了两种形态，外加一个三智能体 crew。

形态：

- 与 CrewAI 接口对应的 `Agent`、`Task` dataclass。
- `SequentialCrew.kickoff(inputs)` 按声明顺序运行任务，把输出作为 `context` 串联起来。
- `HierarchicalCrew.kickoff(topic)` 增加一个 manager Agent，每轮挑选下一个专家，在「done」处停止。
- `Flow`，带 `@start` 和 `@listen(topic)` 装饰器、一个极小的事件循环，以及一条 trace。
- `tool(name)` 装饰器，镜像 CrewAI 的 `@tool` 形态。
- `Memory`，带 `short_term`、`long_term`、`entity` 存储；模拟的相似度用 numpy。
- 模拟的 LLM 响应是按角色加输入前缀作为键的硬编码字符串。无网络。确定性。

具体演示：researcher、writer、editor 组成的 crew，产出一份关于「agent engineering 2026」的简报。researcher 拉取（模拟的）来源。writer 起草。editor 收紧。同一个 crew 再通过一个 Flow 运行一遍，以展示确定性形态。

运行它：

```bash
python3 code/main.py
```

trace 覆盖：sequential crew 通过 `context` 串联输出、hierarchical crew 带 manager 挑选（researcher、writer、editor，然后是「done」）、flow 用显式 topic（`researched`、`drafted`、`edited`）运行同样的三个步骤、经由 `@tool` 路由的工具调用，以及跨两次 kickoff 存续的长期记忆。

Crew trace 是流动的；manager 原则上可以重新排序。Flow trace 是固定的。这个选择就是本课的要点。

## 如何使用

- **CrewAI Flow** 用于生产。即便这个 Flow 只是一个调用 `Crew.kickoff()` 的单步骤。Flow 给出审计边界。
- **CrewAI Crew（Sequential）** 用于顺序清晰的协作工作，尤其是初稿和评审循环。
- **CrewAI Crew（Hierarchical）** 用于路由依赖输出、且你有四个或更多专家的场景。
- **LangGraph**（第 13 课）用于显式状态机、可持久化恢复、严格排序。
- **AutoGen v0.4**（第 14 课）用于 actor 模型并发与故障隔离。
- **OpenAI Agents SDK**（第 16 课）用于以 OpenAI 为先、带交接与护栏的产品。
- **Claude Agent SDK**（第 17 课）用于以 Claude 为先、带子智能体与会话存储的产品。

## 交付上线

`outputs/skill-crew-or-flow.md` 为一个任务在 Crew 与 Flow 之间做选择，并搭建最小实现。对「没有 backstory 的 Crew」「没有显式 topic 的 Flow」「专家少于三个的 Hierarchical」会硬性拒绝。

## 陷阱

- **把 backstory 当点缀。** 它会塑造输出。每个智能体测试三个变体；方差是真实存在的。挑一个，冻结它。
- **跳过 `expected_output`。** 没有每个任务的契约，下游任务就会捡起 LLM 随便产出的东西。Crew 运行了；审计失败了。
- **记忆常开。** 长期记忆每次运行都写入。向量数据库不断增长。检索变得嘈杂。把写入收窄到那些事实确实持久的任务上。
- **manager 提示词漂移。** Hierarchical 的 manager 提示词是隐式的。如果路由变怪，就用 verbose 模式把它 dump 出来读。
- **Crew 里的工具副作用。** 一个 Crew 调用某个工具的次数可能超出预期。POST、DELETE、付款属于 Flow 步骤，绝不属于 Crew 工具。

## 练习

1. 把 Sequential crew 转换成一个 Flow。数一数波动性下降的接触点。记下可读性下降的地方。
2. 给 crew 加上实体记忆：关于某个客户的事实跨 kickoff 存续。验证检索拉取的是正确的实体。
3. 实现一个 Hierarchical 流程，让 manager 在 writer 的输出至少有三段之前拒绝路由到 editor。追踪那次重试。
4. 为一个（模拟的）网页搜索接入一个 `BaseTool` 子类。对比它与 `@tool` 装饰器版本的 trace 形态。
5. 给 editor 任务加上 `output_pydantic=Brief`，其中 `Brief` 有 `title`、`summary`、`sections`。让 writer 任务有一次输出格式错误的 JSON；在 trace 中验证 CrewAI 的重试行为。
6. 读 CrewAI 的文档导言。把这个玩具移植到真实的 `crewai` API。标准库版本跳过了哪些保证？
7. 给一次真实运行接上 AgentOps 或 Langfuse（第 24 课）。在标准库版本里你漏掉了哪些 trace？

## 关键术语

| 术语 | 大家怎么说 | 它实际是什么 |
|------|----------------|------------------------|
| Agent | 「人设」 | Role + goal + backstory + tools |
| Task | 「工作单元」 | Description + expected output + 受派人 + 可选的结构化输出 |
| Crew | 「智能体团队」 | 装 Agent + Task + Process 的容器 |
| Process | 「执行策略」 | Sequential / Hierarchical / Consensus（计划中） |
| Flow | 「确定性工作流」 | 事件驱动、代码掌控、可测试 |
| Backstory | 「人设提示词」 | Agent 的语气与判断力塑造器 |
| `@tool` | 「函数工具」 | 把函数变成 Agent 可调用工具的装饰器 |
| `BaseTool` | 「类工具」 | 基于类的工具，带 args schema、重试、异步支持 |
| Entity memory | 「按实体存储的事实」 | 作用域限定到某个客户 / 账户 / 工单的记忆 |
| Long-term memory | 「跨运行记忆」 | 由向量支撑、在 kickoff 之间存续的记忆 |
| Contextual memory | 「即时检索」 | 在 Agent 需要的那一刻拉取的记忆 |
| Manager LLM | 「路由智能体」 | Hierarchical 流程中挑选下一个任务的额外 LLM |
| `expected_output` | 「任务契约」 | 告诉 Agent（以及审计）应返回何种形态的字符串 |

## 延伸阅读

- [CrewAI 文档导言](https://docs.crewai.com/en/introduction)：概念与推荐的生产路径
- [CrewAI Flows 指南](https://docs.crewai.com/en/concepts/flows)：事件驱动形态、`@start`、`@listen`
- [CrewAI 工具参考](https://docs.crewai.com/en/concepts/tools)：`@tool`、`BaseTool`、内置工具包
- [CrewAI memory](https://docs.crewai.com/en/concepts/memory)：short-term、long-term、entity、contextual
- [Anthropic，构建高效智能体](https://www.anthropic.com/research/building-effective-agents)：多智能体何时有用、何时无用
- [LangGraph 概览](https://docs.langchain.com/oss/python/langgraph/overview)：状态机替代方案
