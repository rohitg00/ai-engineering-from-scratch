# LangGraph：有状态图

> LangGraph 将 agent 工作流建模为状态机。节点是函数；边是条件转换；状态在每个步骤间持久化。这与 ReAct 循环不同，因为状态是显式的、可检查的，并且可以在错误后恢复。

**类型：** 构建
**语言：** Python（标准库）
**前置条件：** 第 14 阶段 · 01（Agent Loop），第 14 阶段 · 12（Anthropic 工作流模式）
**时间：** ~75 分钟

## 学习目标

- 解释 LangGraph 的核心抽象：状态、节点、边、条件边和持久化检查点。
- 对比 LangGraph 的状态机模型与 ReAct 的隐式状态（提示词 + 工具输出）。
- 实现一个标准库图，包含状态模式、节点执行和条件路由。
- 识别何时图抽象值得其复杂性成本。

## 问题

ReAct 循环（第 01 课）将所有状态存储在提示词中。这很简单，但使调试变得困难：你无法检查 agent 的当前状态而不解析提示词。你无法在步骤 7 失败后从步骤 5 恢复。你无法分叉执行以并行探索两个选项。

LangGraph 的答案：将 agent 工作流建模为显式状态机，状态在每个步骤间持久化，转换是条件性的，执行可以分叉和合并。

## 概念

### 状态模式

LangGraph 的 `State` 是 `TypedDict`，包含 agent 在其生命周期中跟踪的字段。示例：

```python
class AgentState(TypedDict):
    query: str
    plan: list[str]
    results: list[str]
    final_answer: str
    iteration: int
```

状态是显式的。工程师定义模式。每个节点读取和写入状态的子集。

### 节点

节点是接收状态、执行工作并返回状态更新的 Python 函数。节点不直接调用其他节点——图定义控制流。

```python
def research_node(state: AgentState) -> AgentState:
    # 读取 state["query"]
    # 写入 state["results"]
    return {"results": [...]}
```

### 边

边定义节点之间的转换。两种类型：

- **普通边。** 节点 A 总是转到节点 B。
- **条件边。** 节点 A 根据状态转到节点 B、C 或 D。

```python
def route(state: AgentState) -> str:
    if state["iteration"] < 3:
        return "research"
    return "synthesize"
```

### 持久化检查点

LangGraph 在每个步骤后将状态持久化到存储（内存、SQLite、Postgres）。这意味着：

- **恢复。** 在步骤 7 崩溃后，从步骤 6 重新启动。
- **时间旅行。** 重放执行直到步骤 4，然后分叉到新路径。
- **人类在环。** 暂停执行，等待人工批准，然后恢复。

这是 LangGraph 相对于简单 ReAct 循环的主要工程优势。

### 与 ReAct 的对比

| 方面 | ReAct | LangGraph |
|------|-------|-----------|
| 状态 | 隐式（提示词 + 工具输出） | 显式（模式化字典） |
| 控制流 | LLM 决定下一个动作 | 工程师定义图；LLM 填充节点 |
| 持久化 | 无（每个调用重新开始） | 每个步骤检查点 |
| 调试 | 解析提示词历史 | 检查状态对象 |
| 分叉 | 不可能 | 条件边支持 |
| 复杂性 | 低 | 高（需要图设计） |

### 何时使用 LangGraph

- **长时间运行的 agent。** 需要数小时或数天的任务；检查点防止丢失进度。
- **人类在环工作流。** 需要审批门、审查步骤或人工覆盖。
- **错误恢复。** 步骤失败时，从上一个检查点重试，不是从头开始。
- **复杂分支。** 执行路径取决于运行时状态，无法预先确定。

### 何时不使用 LangGraph

- **简单任务。** 3-5 步 ReAct 循环不需要图。
- **低延迟需求。** 图增加序列化/反序列化开销。
- **原型阶段。** 先用简单循环验证；当需要持久化时再图化。

### 此模式出错的地方

- **状态膨胀。** 状态对象增长到兆字节，序列化成为瓶颈。定义严格的模式；不要存储完整的历史。
- **条件边过于复杂。** 路由逻辑变得比节点逻辑更难调试。保持条件简单。
- **过早图化。** 团队为 2 步工作流构建 20 节点图。从简单开始。

## 构建

`code/main.py` 实现标准库图：

- `State` —— 模式化字典，包含查询、结果、迭代、最终答案。
- `Nodes` —— `research`（模拟搜索）、`synthesize`（模拟综合）、`check`（决定继续或停止）。
- `Graph` —— 注册节点，添加边（`research -> check`，`check -> research|synthesize`），执行带检查点。
- `Checkpoint` —— 每个步骤后序列化状态到 JSON。

运行：

```
python3 code/main.py
```

跟踪显示状态在每个步骤间演变，条件路由决策，以及检查点恢复。

## 使用

- **LangGraph（LangChain）** —— 生产框架；与 LangChain 生态集成。
- **自定义图** —— 标准库实现（如本课）覆盖核心概念；LangGraph 添加持久化、流式、人机交互。
- **替代方案** —— Temporal（工作流引擎）、AWS Step Functions（云原生）。LangGraph 针对 LLM agent 优化。

## 交付

`outputs/skill-stateful-graph.md` 为给定 agent 任务设计状态模式、节点和边，包括检查点策略。

## 练习

1. 添加一个"人类在环"节点：在 `research` 和 `synthesize` 之间暂停，等待人工批准。实现为检查点 + 外部信号。
2. 实现时间旅行：从检查点 3 恢复，但修改状态（"假设我们找到了不同结果"），然后继续。
3. 为状态添加类型验证：如果节点返回不在模式中的字段，在图执行期间引发错误。
4. 测量检查点开销：序列化 1KB、100KB、10MB 状态对象。LangGraph 的 SQLite 后端在什么大小下退化？
5. 将第 12 课的五种 Anthropic 工作流模式之一（如编排器-工作者）建模为 LangGraph。哪些部分变干净，哪些部分变复杂？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| State | "Agent 记忆" | 模式化字典，在节点间传递 |
| Node | "处理步骤" | 读取状态、执行工作、返回更新的函数 |
| Edge | "转换" | 节点之间的连接；普通或条件 |
| Conditional edge | "路由" | 基于状态动态选择下一个节点 |
| Checkpoint | "持久化快照" | 每个步骤后序列化状态；启用恢复和时间旅行 |
| Time travel | "分叉执行" | 从过去检查点恢复并走不同路径 |
| Human-in-the-loop | "审批门" | 暂停图执行等待人工输入 |
| State bloat | "模式膨胀" | 状态对象过大；序列化和调试成本 |

## 延伸阅读

- [LangGraph 文档](https://langchain-ai.github.io/langgraph/) —— 官方指南和概念
- [LangGraph 概念：持久化](https://langchain-ai.github.io/langgraph/concepts/persistence/) —— 检查点和恢复
- [LangGraph 概念：人机交互](https://langchain-ai.github.io/langgraph/concepts/human_in_the_loop/) —— 审批和审查
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) —— 何时状态机值得其成本