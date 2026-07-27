# CrewAI：基于角色的团队（Crews）与工作流（Flows）

> CrewAI 是 2026 年基于角色的多智能体框架。四大原语：Agent（智能体）、Task（任务）、Crew（团队）、Process（流程）。两大顶层形态：Crews（自主的、基于角色的协作）和 Flows（事件驱动的、确定性的）。官方文档直言不讳："对于任何生产级应用，请从 Flow 开始。"

**类型：** 学习 + 构建
**语言：** Python（标准库）
**前置知识：** 阶段 14 · 12（工作流模式）、阶段 14 · 14（Actor 模型）
**时间：** 约 75 分钟

## 学习目标

- 说出 CrewAI 的四大原语（Agent、Task、Crew、Process）及其各自的职责。
- 区分 Sequential（顺序）、Hierarchical（分层）和计划中的 Consensus（共识）流程；根据工作负载选择合适的流程。
- 区分 Crews（自主的、基于角色的）与 Flows（事件驱动的、确定性的），并解释官方文档的生产环境推荐。
- 使用 `@tool` 装饰器和 `BaseTool` 子类接入工具；理解结构化输出与自由文本的取舍。
- 说出 CrewAI 的四种内存类型及其适用场景。
- 实现一个包含三个智能体（研究员、写作者、编辑）的标准库团队，生成一份简报。
- 识别 CrewAI 的三种故障模式：提示膨胀、管理模型 Token 税、脆弱的交接。

## 问题

采用多智能体框架的团队总会遇到同样的困境。"自主协作"在演示中听起来很棒。然后客户提交了一个 Bug，你需要确定性回放。或者财务部门询问一个由 LLM 路由的团队每次运行的成本。或者值班人员需要在凌晨 3 点知道哪个智能体卡住了。

自由形式的 LLM 路由团队无法清晰地回答这些问题。纯 DAG 可以回答所有问题，但失去了头脑风暴型智能体所需的探索形态。

CrewAI 的划分诚实地反映了这种权衡。Crews 用于协作性、基于角色、探索性的工作。Flows 用于事件驱动、代码掌控、可审计的生产环境。同一框架，两种形态，按场景选择。

## 概念

### 四大原语

CrewAI 的表面概念很少。记住这些，剩下的只是配置。

- **Agent（智能体）。** `role + goal + backstory + tools +（可选）llm`。backstory（背景故事）承担着实际的职责——它塑造语气、判断力以及智能体何时停止。Tools（工具）是智能体可以调用的函数（详见下文）。
- **Task（任务）。** `description + expected_output + agent +（可选）context +（可选）output_pydantic`。一个可重用的工作单元。`expected_output` 是契约。`context` 列出上游任务的输出，这些输出会传递给当前任务。`output_pydantic` 强制要求结构化输出。
- **Crew（团队）。** 容器。包含 `agents` 列表、`tasks` 列表、`process`（流程），以及可选的 `memory` + `verbose` + `manager_llm` 设置。
- **Process（流程）。** 执行策略。Sequential（顺序）、Hierarchical（分层）、Consensus（共识，计划中）。决定运行形态。

智能体之间不直接通信。任务引用智能体。Crew 对任务进行排序。Process 决定谁选择下一个任务。这就是完整的思维模型。

> **验证版本：** CrewAI 0.86（2026 年 5 月）。较新版本可能重命名或合并流程类型；在依赖特定形态前，请查阅 [CrewAI 流程文档](https://docs.crewai.com/concepts/processes)。

### Sequential vs Hierarchical vs Consensus

- **Sequential（顺序）。** 任务按声明顺序执行。任务 N 的输出作为 `context` 提供给任务 N+1。成本最低。最可预测。在顺序固定的场景下使用。
- **Hierarchical（分层）。** 一个管理者智能体（单独的 LLM 调用）在专家之间进行路由。CrewAI 从你的 `manager_llm` 配置或默认配置中生成该管理者。管理者每轮选择下一个任务，并可以拒绝或重新路由。在拥有四个或更多专家且顺序确实依赖于先前输出的场景下使用。
- **Consensus（共识）。** 计划中，当前公共 API 尚未实现。官方文档保留该名称用于未来基于投票的流程。目前请勿依赖。

Hierarchical 在每次专家调用的基础上增加了一轮 LLM 调用（管理者）。在五步运行中，Token 成本可能翻三倍。只在确实需要路由时才为此买单。

### Crews vs Flows

这是官方文档在 2026 年首要介绍的概念框架。

- **Crew（团队）。** LLM 驱动的主宰。框架在运行时决定形态。适用于：研究、头脑风暴、初稿——任何路径本身就是答案一部分的场景。难以回放。难以测试。快速原型。
- **Flow（工作流）。** 你掌控的事件驱动图。`@start` 标记入口。`@listen(topic)` 标记一个步骤，当另一个步骤发出该主题时触发。每个步骤都是纯 Python（内部可以调用 Crew）。适用于：生产环境。可观测。可测试。确定性。

官方文档 2026 年的生产环境推荐：从 Flow 开始。当自主性能发挥其价值时，通过 Flow 步骤内部的 `Crew.kickoff()` 调用将 Crews 融入其中。Flow 提供审计轨迹，Crew 提供探索能力。组合使用，而非二选一。

### 工具集成

给智能体赋予工具的三种方式。选择最简单且适合需求的方式。

1. **`@tool` 装饰器。** 纯函数变成工具。函数签名是 schema；文档字符串是 LLM 看到的描述。最适合一次性辅助工具。

   ```python
   from crewai.tools import tool

   @tool("搜索网络")
   def search(query: str) -> str:
       """返回查询的搜索结果。"""
       return run_search(query)
   ```

2. **`BaseTool` 子类。** 基于类的工具，包含显式的参数 schema、异步支持、重试机制。在工具具有状态（如客户端、缓存）或需要结构化参数时使用。

   ```python
   from crewai.tools import BaseTool
   from pydantic import BaseModel

   class SearchArgs(BaseModel):
       query: str
       limit: int = 10

   class SearchTool(BaseTool):
       name = "web_search"
       description = "搜索网络并返回结果。"
       args_schema = SearchArgs

       def _run(self, query: str, limit: int = 10) -> str:
           return self.client.search(query, limit=limit)
   ```

3. **内置工具包。** CrewAI 自带官方适配器：`SerperDevTool`、`FileReadTool`、`DirectoryReadTool`、`CodeInterpreterTool`、`RagTool`、`WebsiteSearchTool`。一次导入即可使用。

结构化输出使用 Pydantic。在 Task 上传递 `output_pydantic=MyModel`。CrewAI 会验证 LLM 的响应是否符合该模型，并进行强制转换或重试。配合简洁的 `expected_output` 字符串使用。自由文本输出适合草稿；结构化输出是下游 Flow 可以消费的内容。

### 内存钩子

CrewAI 内置四种内存类型。它们可以组合使用：一个 Crew 可以同时启用全部四种。

> **验证版本：** CrewAI 0.86（2026 年 5 月）。最近的版本通过统一的 `Memory` 系统来管理这四种存储。以下概念模型仍然适用，但公共类接口在新版本中可能合并为一个 `Memory` 入口点；请查阅 [CrewAI 内存文档](https://docs.crewai.com/concepts/memory)了解当前 API。

- **短期内存（Short-term）。** 单次运行内的对话缓冲区。运行结束时清除。
- **长期内存（Long-term）。** 跨运行持久化。存储在向量数据库中（默认 Chroma，可替换）。通过与当前任务的相似度检索。
- **实体内存（Entity）。** 每个实体的事实。"客户 X 使用的是企业版计划。"按实体键值存储，而非相似度。跨运行持久化。
- **上下文内存（Contextual）。** 组装时检索。在智能体需要时即时提取相关内存，而非预先加载。

在 Crew 上通过 `memory=True` 或按类型配置来启用。由你配置的嵌入提供者支持（默认为 OpenAI，可替换为本地模型）。内存是 CrewAI 相比更轻量框架的一大优势；纯 LangGraph 需要你自行实现每一项。

### CrewAI 的适用场景

- 三到六个具有命名角色和协作工作流的智能体。起草、审查、规划、头脑风暴。
- 路由决策中，LLM 对下一步的判断本身就是价值的一部分（Hierarchical）。
- 团队更愿意阅读 `role + goal + backstory` 而非图定义的任何场景。

### CrewAI 的不适用场景

- 具有严格顺序的确定性 DAG。使用 LangGraph（第 13 课）。图形态是正确的抽象；CrewAI 的角色框架反而增加摩擦。
- 亚秒级延迟预算。Hierarchical 增加了往返次数。即使是 Sequential 也会序列化包含背景故事和先前输出的提示词。
- 单智能体循环。无需框架；一个智能体循环（第 1 课）加一个工具注册表更加简洁。

第 17 课（智能体框架权衡）以矩阵形式进行了详细阐述。简而言之：CrewAI 位于"基于角色的协作"象限。

### 依赖关系

独立于 LangChain。Python 3.10 至 3.13。使用 `uv`。Star 数量：参见 [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI)（截至 2026 年 5 月）。AWS Bedrock 集成有文档记录；供应商报告称在 QA 工作负载上相比 LangGraph 有显著加速，但方法论（数据集、硬件、评估指标）未公开，因此请将框架供应商的数据仅视为方向性参考。

### 该模式的常见问题

- **背景故事导致的提示膨胀。** 每个智能体 2000 词的背景故事加上五个智能体的团队，在第一次工具调用前就烧尽了上下文预算。将背景故事控制在 200 词以内。在智能体之间复用短语，不要重复五次相同的风格说明。
- **管理模型 Token 税。** Hierarchical 流程在每次专家调用前增加一次管理模型的 LLM 调用。对于五个任务的团队，这是六次 LLM 调用而非五次，而且管理模型的调用携带了完整的任务列表及先前输出。除非路由依赖于输出，否则切换到 Sequential。
- **脆弱的交接。** 任务 N 的 `expected_output` 是"一份大纲"。任务 N+1 将其作为 `context` 读取并试图解析出三个章节。但 LLM 生成了四个章节。下游智能体即兴发挥。通过在任务 N 上使用 `output_pydantic` 来解决，这样任务 N+1 读取的是类型化对象，而非自由文本。
- **Crew 直接用于生产。** 将自由形式的 Crew 在没有 Flow 包装的情况下直接部署到生产环境。输出变异性高；无法回放；值班人员无法对比异常运行与正常运行的差异。请使用 Flow 进行包装。

## 构建

`code/main.py` 实现了两种形态的标准库版本以及一个三智能体团队。

形态：

- `Agent`、`Task` 数据类，与 CrewAI 的表面 API 匹配。
- `SequentialCrew.kickoff(inputs)` 按声明顺序运行任务，将输出作为 `context` 传递。
- `HierarchicalCrew.kickoff(topic)` 增加一个管理者智能体，每轮选择下一个专家，直到"完成"。
- `Flow` 包含 `@start` 和 `@listen(topic)` 装饰器、一个小型事件循环和一条追踪记录。
- `tool(name)` 装饰器，模拟 CrewAI 的 `@tool` 形态。
- `Memory` 包含 `short_term`、`long_term`、`entity` 存储；使用 numpy 模拟相似度计算。
- 模拟 LLM 响应是基于角色加输入前缀的硬编码字符串。无需网络。确定性执行。

具体演示：研究员、写作者、编辑团队生成一份关于"2026 年智能体工程"的简报。研究员获取（模拟的）资料。写作者起草。编辑润色。同一团队通过 Flow 运行，展示确定性形态。

运行方式：

```bash
python3 code/main.py
```

追踪覆盖范围：顺序团队通过 `context` 传递输出；分层团队由管理者选择（研究员、写作者、编辑，然后"完成"）；Flow 使用显式主题（`researched`、`drafted`、`edited`）运行相同三个步骤；工具调用通过 `@tool` 路由；长期内存在两次 kickoff 之间持久化。

Crew 的追踪是流动的；管理者原则上可以重新排序。Flow 的追踪是固定的。这种选择本身就是一堂课。

## 使用

- **CrewAI Flow** 用于生产环境。即使 Flow 只有一个步骤调用了 `Crew.kickoff()`。Flow 提供了审计边界。
- **CrewAI Crew（Sequential）** 用于顺序明确的协作工作，特别是初稿和审查循环。
- **CrewAI Crew（Hierarchical）** 当路由依赖于输出且你有四个或更多专家时。
- **LangGraph**（第 13 课）用于显式状态机、持久恢复、严格排序。
- **AutoGen v0.4**（第 14 课）用于 Actor 模型并发和故障隔离。
- **OpenAI Agents SDK**（第 16 课）用于以 OpenAI 为主的、需要交接和护栏的产品。
- **Claude Agent SDK**（第 17 课）用于以 Claude 为主的、需要子智能体和会话存储的产品。

## 交付

`outputs/skill-crew-or-flow.md` 针对给定任务选择 Crew 或 Flow，并搭建最小实现。严格拒绝：没有背景故事的 Crew、没有显式主题的 Flow、少于三个专家的 Hierarchical。

## 陷阱

- **背景故事作为调味料。** 它塑造输出。每个智能体测试三个变体；差异是真实存在的。选择一个，冻结它。
- **跳过 `expected_output`。** 每个任务没有契约的话，下游任务会接收到 LLM 产生的任何内容。Crew 可以运行，但审计会失败。
- **始终开启的内存。** 长期内存在每次运行时写入。向量数据库不断增长。检索变得嘈杂。仅在事实需要持久化的任务中写入。
- **管理者提示漂移。** Hierarchical 的管理者提示是隐式的。如果路由变得奇怪，在 verbose 模式下将其转储出来查看。
- **Crew 中的工具副作用。** Crew 可能比预期更频繁地调用工具。POST、DELETE、支付操作应放在 Flow 步骤中，永远不要放在 Crew 工具中。

## 练习

1. 将顺序团队（Sequential crew）转换为 Flow。统计变异性下降的接触点。注意可读性下降的地方。
2. 为团队添加实体内存：关于客户的事实跨 kickoff 持久化。验证检索是否能拉取正确的实体。
3. 实现一个 Hierarchical 流程，其中管理者拒绝将任务路由给编辑，直到写作者的输出至少包含三段内容。追踪重试过程。
4. 为（模拟的）网络搜索接入一个 `BaseTool` 子类。比较其与 `@tool` 装饰器版本的追踪形态。
5. 为编辑任务添加 `output_pydantic=Brief`，其中 `Brief` 包含 `title`、`summary`、`sections`。使写作者任务的输出产生一次格式错误的 JSON；验证 CrewAI 在追踪中的重试行为。
6. 阅读 CrewAI 的文档介绍。将玩具示例迁移到真实的 `crewai` API。标准库版本跳过了哪些保证？
7. 将 AgentOps 或 Langfuse（第 24 课）接入一次真实运行。标准库版本中你错过了哪些追踪信息？

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| Agent | "角色" | 角色 + 目标 + 背景故事 + 工具 |
| Task | "工作单元" | 描述 + 预期输出 + 负责人 + 可选结构化输出 |
| Crew | "智能体团队" | Agent + Task + Process 的容器 |
| Process | "执行策略" | Sequential / Hierarchical / Consensus（计划中） |
| Flow | "确定性工作流" | 事件驱动、代码掌控、可测试 |
| Backstory | "角色提示" | 智能体的语气和判断力塑造器 |
| `@tool` | "函数工具" | 将函数变为智能体可调用工具的装饰器 |
| `BaseTool` | "类工具" | 基于类的工具，带参数 schema、重试、异步支持 |
| Entity memory | "每个实体的事实" | 限定到客户/账户/问题的内存 |
| Long-term memory | "跨运行内存" | 向量数据库支持、在 kickoff 之间持久化的内存 |
| Contextual memory | "即时检索" | 在智能体需要时动态提取的内存 |
| Manager LLM | "路由智能体" | 在 Hierarchical 流程中负责选择下一个任务的额外 LLM |
| `expected_output` | "任务契约" | 告诉智能体（和审计）返回什么形态的字符串 |

## 延伸阅读

- [CrewAI 文档介绍](https://docs.crewai.com/en/introduction)：概念及推荐的生产路径
- [CrewAI Flows 指南](https://docs.crewai.com/en/concepts/flows)：事件驱动的形态、`@start`、`@listen`
- [CrewAI 工具参考](https://docs.crewai.com/en/concepts/tools)：`@tool`、`BaseTool`、内置工具包
- [CrewAI 内存](https://docs.crewai.com/en/concepts/memory)：短期、长期、实体、上下文
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)：多智能体何时有帮助，何时没有
- [LangGraph 概览](https://docs.langchain.com/oss/python/langgraph/overview)：状态机替代方案
