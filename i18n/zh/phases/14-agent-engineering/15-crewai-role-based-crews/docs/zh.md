# 基于角色的智能体团队 — 角色、任务、流程

> 四个原语：Agent、Task、Crew、Process。两种顶层形态：Crew(自主的、基于角色的协作)和 Flow(事件驱动的、确定性的)。CrewAI 是 2026 年的参考实现，其文档态度直白："对于任何生产级应用，请从 Flow 开始。"

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 14 (Actor Model)
**Time:** ~75 分钟

## 学习目标

- 说出 CrewAI 的四个原语(Agent、Task、Crew、Process)以及各自负责什么。
- 区分 Sequential、Hierarchical 以及计划中的 Consensus 流程；按工作负载选择其一。
- 区分 Crew(自主、基于角色)与 Flow(事件驱动、确定性)，并解释文档中的生产环境建议。
- 使用 `@tool` 装饰器和 `BaseTool` 子类接入工具；理解结构化输出与自由文本的区别。
- 说出 CrewAI 的四种记忆类型以及各自的适用时机。
- 用标准库实现一个三智能体 crew(研究员、写手、编辑)，产出一篇简报。
- 识别 CrewAI 的三种失败模式：提示词膨胀、manager-LLM 开销、脆弱的交接。

## 问题

采用多智能体框架的团队都会撞上同一堵墙。“自主协作”在演示中听起来很棒。然后客户提交了一个 bug,你需要确定性的重放。或者财务问每次运行 LLM 路由的 crew 成本是多少。或者值班工程师需要知道凌晨 3 点哪个智能体卡住了。

自由形式的 LLM 路由 crew 无法清晰地回答其中任何一个问题。纯 DAG 能回答所有问题，却失去了头脑风暴型智能体所需的探索性形态。

CrewAI 的拆分坦诚地面对了这个权衡。Crew 用于协作式、基于角色、探索性的工作。Flow 用于事件驱动、代码掌控、可审计的生产环境。同一个框架，两种形态，按场景选择。

## 概念

### 四个原语

CrewAI 的接口面很小。记住这些，剩下的就是配置。

- **Agent。** `role + goal + backstory + tools + (optional) llm`。backstory 是承重结构。它塑造语气、判断力，以及智能体何时停止。工具是智能体可以调用的函数(下文详述)。
- **Task。** `description + expected_output + agent + (optional) context + (optional) output_pydantic`。一个可复用的工作单元。`expected_output` 是契约。`context` 列出其输出会被传入的上游任务。`output_pydantic` 强制要求结构化的形态。
- **Crew。** 容器。拥有 `agents` 列表、`tasks` 列表、`process`,以及可选的 `memory` + `verbose` + `manager_llm` 设置。
- **Process。** 执行策略。Sequential、Hierarchical、Consensus(计划中)。决定运行的形态。

智能体彼此之间不直接可见。任务引用智能体。Crew 对任务排序。Process 决定由谁选择下一个任务。这就是全部的心智模型。

> **验证于** CrewAI 0.86(2026-05)。较新版本可能重命名或合并流程类型；在依赖某个特定形态之前，请查阅 [CrewAI Processes 文档](https://docs.crewai.com/concepts/processes)。

### Sequential vs Hierarchical vs Consensus

- **Sequential。** 任务按声明顺序运行。任务 N 的输出以 `context` 的形式提供给任务 N+1。成本最低。最可预测。当顺序固定时使用。
- **Hierarchical。** 一个 manager Agent(单独的 LLM 调用)在专家之间进行路由。CrewAI 根据你的 `manager_llm` 配置或默认配置生成 manager。manager 每轮选择下一个任务，可以拒绝或重新路由。当你有四个或更多专家，且顺序确实取决于先前输出时使用。
- **Consensus。** 计划中，目前尚未在公开 API 中实现。文档为未来基于投票的流程保留了这个名称。今天不要依赖它。

Hierarchical 在每次专家调用之上增加一次每轮的 LLM 调用(manager)。在一个五步运行中，token 成本可能增至三倍。只有在你需要路由时才为此付费。

### Crews vs Flows

这是 2026 年文档开篇所强调的框架。

- **Crew。** LLM 驱动的自主性。框架在运行时选择形态。适用于：研究、头脑风暴、初稿，以及任何路径本身就是答案一部分的场景。难以重放。难以测试。原型制作成本低。
- **Flow。** 你拥有的事件驱动图。`@start` 标记入口。`@listen(topic)` 标记在其他步骤发出该 topic 时触发的步骤。每个步骤都是纯 Python(可以在内部调用 Crew)。适用于：生产环境。可观察。可测试。确定性。

文档在 2026 年的生产建议：从 Flow 开始。当自主性物有所值时，在 Flow 步骤内部以 `Crew.kickoff()` 调用的方式引入 Crew。Flow 给你审计轨迹，Crew 给你探索能力。组合使用，而非二选一。

### 工具集成

给 Agent 提供工具的三种方式。选择最简单且合适的一种。

1. **`@tool` 装饰器。** 纯函数变为工具。函数签名即 schema;docstring 是 LLM 看到的描述。最适合一次性的辅助函数。

   ```python
   from crewai.tools import tool

   @tool("Search the web")
   def search(query: str) -> str:
       """Return top results for the query."""
       return run_search(query)
   ```

2. **`BaseTool` 子类。** 基于类的工具，带显式的 args schema、异步支持、重试。当工具有状态(客户端、缓存)或需要结构化参数时使用。

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

3. **内置工具包。** CrewAI 提供第一方适配器：`SerperDevTool`、`FileReadTool`、`DirectoryReadTool`、`CodeInterpreterTool`、`RagTool`、`WebsiteSearchTool`。一次导入即可接入。

结构化输出使用 Pydantic。在 Task 上传入 `output_pydantic=MyModel`。CrewAI 根据 model 校验 LLM 响应，并进行强制转换或重试。配合一个严格的 `expected_output` 字符串使用。自由文本输出适合草稿；结构化输出才是下游 Flow 可以消费的。

### 记忆钩子

CrewAI 开箱即提供四种记忆类型。它们可以组合：一个 Crew 可以同时启用全部四种。

> **验证于** CrewAI 0.86(2026-05)。近期版本将一切都通过一个统一的 `Memory` 系统路由，该系统封装了这四个存储。下面的概念模型仍然成立，但在较新版本中，公开类接口可能收敛为单一入口 `Memory`;请查阅 [CrewAI memory 文档](https://docs.crewai.com/concepts/memory) 了解当前 API。

- **Short-term。** 单次运行内的对话缓冲。结束时清空。
- **Long-term。** 跨运行持久化。存储在向量数据库中(默认 Chroma,可替换)。通过与当前任务的相似度检索。
- **Entity。** 按实体存储的事实。"客户 X 使用企业套餐。"按实体键控，而非按相似度。跨运行保留。
- **Contextual。** 组装时检索。在 Agent 需要的那一刻拉取相关记忆，而非预加载。

通过 `memory=True` 或按类型配置在 Crew 上启用。由你配置的 embeddings 提供方支持(默认 OpenAI,可替换为本地)。记忆是 CrewAI 相比更轻量的框架体现价值的地方之一；纯 LangGraph 需要你自己接入其中每一项。

### 基于角色的团队何时适用

- 三到六个具有明确角色和协作工作流的智能体。起草、审阅、规划、头脑风暴。
- 路由中 LLM 对下一步的判断本身就是价值的一部分时(Hierarchical)。
- 团队更愿意阅读 `role + goal + backstory` 而非图定义的任何场景。

### 何时不适用

- 严格排序的确定性 DAG。使用 LangGraph(第 13 课)。图形态是正确的抽象；CrewAI 的角色框架反而是阻力。
- 亚秒级延迟预算。Hierarchical 增加往返。即使是 Sequential 也会将包含 backstory 和先前输出的提示词串行化。
- 单智能体循环。跳过框架；一个智能体循环(第 1 课)加一个工具注册表更简洁。

第 17 课(Agent Framework Tradeoffs)以矩阵形式阐述了这一点。简而言之：CrewAI 处于"协作式、基于角色"的象限。

### 依赖形态

独立于 LangChain。Python 3.10 至 3.13。使用 `uv`。星标数：见 [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI)(截至 2026-05 的快照)。AWS Bedrock 集成有文档记录；厂商基准测试报告在 QA 工作负载上比 LangGraph 有显著加速，但方法论(数据集、硬件、评估指标)未公开，因此将框架厂商的数字仅视为方向性参考。

### 该模式的常见出错方式

- **backstory 导致的提示词膨胀。** 每个智能体 2000 字的 backstory 加上五个智能体的 crew,在第一次工具调用之前就耗尽了上下文预算。backstory 控制在 200 字以内。跨智能体复用措辞；不要把团队风格重复五遍。
- **manager-LLM token 开销。** Hierarchical 流程在每次专家调用前增加一次 manager LLM 调用。在一个五任务的 crew 中，这是六次 LLM 调用而非五次，且 manager 调用携带完整的任务列表加上先前输出。除非路由取决于输出，否则切换到 Sequential。
- **脆弱的交接。** 任务 N 的 `expected_output` 是“一份大纲”。任务 N+1 将其读取为 `context` 并尝试解析三个章节。LLM 产出了四个。下游 Agent 即兴发挥。通过在任务 N 上使用 `output_pydantic` 修复，使任务 N+1 读取的是类型化对象而非自由文本。
- **Crew 直接上生产。** 自由形式的 Crew 未加 Flow 封装就部署到生产环境。输出变异性高；无法重放；值班工程师无法将一次坏运行与好运行做对比。用 Flow 封装。

```figure
ae-crew-vs-flow
```

## 动手构建

`code/main.py` 用标准库实现了两种形态，外加一个三智能体 crew。

形态：

- `Agent`、`Task` dataclass,与 CrewAI 的接口对应。
- `SequentialCrew.kickoff(inputs)` 按声明顺序运行任务，以 `context` 的形式传递输出。
- `HierarchicalCrew.kickoff(topic)` 增加一个每轮选择下一位专家的 manager Agent,遇到"done"时停止。
- `Flow`,带 `@start` 和 `@listen(topic)` 装饰器、一个小型事件循环，以及一个 trace。
- `tool(name)` 装饰器，镜像 CrewAI 的 `@tool` 形态。
- `Memory`,带 `short_term`、`long_term`、`entity` 存储；模拟的相似度计算使用 numpy。
- 模拟的 LLM 响应是按角色加输入前缀键控的硬编码字符串。无网络。确定性。

具体演示：研究员、写手、编辑组成的 crew,产出关于“2026 年智能体工程”的简报。研究员拉取(模拟的)来源。写手起草。编辑润色。同一个 crew 通过 Flow 运行，以展示确定性形态。

运行它：

```bash
python3 code/main.py
```

Trace 涵盖：sequential crew 通过 `context` 传递输出、带 manager 选择(研究员、写手、编辑，然后"done")的 hierarchical crew、以显式 topic(`researched`、`drafted`、`edited`)运行相同三步的 flow、通过 `@tool` 路由的工具调用，以及在两次 kickoff 之间保留的长期记忆。

Crew 的 trace 是流动的；manager 原则上可以重新排序。Flow 的 trace 是固定的。这个选择本身就是本课的要点。

## 何时使用

- **CrewAI Flow** 用于生产环境。即使 Flow 只是一个调用 `Crew.kickoff()` 的步骤。Flow 提供了审计边界。
- **CrewAI Crew(Sequential)** 用于顺序明确的协作工作，尤其是初稿和审阅循环。
- **CrewAI Crew(Hierarchical)** 当路由取决于输出且你有四个或更多专家时。
- **LangGraph**(第 13 课)用于显式状态机、持久恢复、严格排序。
- **AutoGen v0.4**(第 14 课)用于 actor 模型并发与故障隔离。
- **OpenAI Agents SDK**(第 16 课)用于 OpenAI 优先、带 handoffs 和 guardrails 的产品。
- **Claude Agent SDK**(第 17 课)用于 Claude 优先、带 subagents 和会话存储的产品。

## 上线发布

`outputs/skill-crew-or-flow.md` 为一个任务选择 Crew 还是 Flow,并搭建最小实现。硬性拒绝：无 backstory 的 Crew、无显式 topic 的 Flow、专家少于三人的 Hierarchical。

## 常见陷阱

- **把 backstory 当装饰。** 它塑造输出。每个智能体测试三个变体；差异是真实存在的。选定一个，冻结它。
- **跳过 `expected_output`。** 没有每个任务的契约，下游任务就会接收 LLM 产出的任何内容。Crew 能运行；审计会失败。
- **记忆常开。** 长期记忆每次运行都写入。向量数据库不断增长。检索变得嘈杂。将写入范围限定在事实具有持久性的任务上。
- **manager 提示词漂移。** Hierarchical 的 manager 提示词是隐式的。如果路由变得怪异，在 verbose 模式下输出并阅读它。
- **Crew 中的工具副作用。** Crew 调用工具的次数可能超出预期。POST、DELETE、支付应放在 Flow 步骤中，绝不要放在 Crew 工具里。

## 练习

1. 将 Sequential crew 转换为 Flow。统计变异性下降的触点数量。记录可读性在何处下降。
2. 为 crew 添加实体记忆：关于某个客户的事实跨 kickoff 保留。验证检索拉取到正确的实体。
3. 实现一个 Hierarchical 流程，其中 manager 在写手的输出不足三段之前拒绝路由给编辑。追踪重试过程。
4. 为(模拟的)网页搜索接入一个 `BaseTool` 子类。比较其 trace 形态与 `@tool` 装饰器版本的差异。
5. 为编辑任务添加 `output_pydantic=Brief`,其中 `Brief` 包含 `title`、`summary`、`sections`。让写手任务输出一次格式错误的 JSON;在 trace 中验证 CrewAI 的重试行为。
6. 阅读 CrewAI 文档的介绍部分。将玩具实现迁移到真实的 `crewai` API。标准库版本跳过了哪些保证？
7. 将 AgentOps 或 Langfuse(第 24 课)接入一次真实运行。标准库版本中你缺少了哪些 trace?

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Agent | "Persona" | 角色 + 目标 + backstory + 工具 |
| Task | "Unit of work" | 描述 + 期望输出 + 承担者 + 可选的结构化输出 |
| Crew | "Agent team" | Agents + Tasks + Process 的容器 |
| Process | "Execution strategy" | Sequential / Hierarchical / Consensus(计划中) |
| Flow | "Deterministic workflow" | 事件驱动、代码掌控、可测试 |
| Backstory | "Persona prompt" | Agent 的语气与判断力塑造器 |
| `@tool` | "Function tool" | 将函数转换为 Agent 可调用工具的装饰器 |
| `BaseTool` | "Class tool" | 基于、带 args schema、重试和异步支持的工具 |
| Entity memory | "Per-entity facts" | 限定于某个客户/账户/问题的记忆 |
| Long-term memory | "Cross-run memory" | 跨 kickoff 保留的向量记忆 |
| Contextual memory | "Just-in-time retrieval" | 在 Agent 需要的那一刻拉取的记忆 |
| Manager LLM | "Router agent" | Hierarchical 流程中选择下一个任务的额外 LLM |
| `expected_output` | "Task contract" | 告诉 Agent(以及审计)返回什么形态的字符串 |

## 延伸阅读

- [CrewAI docs introduction](https://docs.crewai.com/en/introduction):概念与推荐的生产路径
- [CrewAI Flows guide](https://docs.crewai.com/en/concepts/flows):事件驱动形态、`@start`、`@listen`
- [CrewAI tools reference](https://docs.crewai.com/en/concepts/tools):`@tool`、`BaseTool`、内置工具包
- [CrewAI memory](https://docs.crewai.com/en/concepts/memory):短期、长期、实体、上下文记忆
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents):多智能体何时有用、何时无用
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview):状态机替代方案