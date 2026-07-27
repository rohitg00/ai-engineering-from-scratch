# 编排模式：Supervisor、Swarm、分层式

> 2026 年的各框架中反复出现四种编排模式：主管-工作者（supervisor-worker）、对等群集（swarm / peer-to-peer）、分层式（hierarchical）、辩论式（debate）。Anthropic 的指导意见："关键是为你的需求构建正确的系统。"从简单开始；只有当单个 Agent 加上五种工作流模式仍不够时，才考虑增加拓扑。

**类型：** 学 + 练
**语言：** Python（标准库）
**前置学习：** 第 14 阶段 · 12（工作流模式）、第 14 阶段 · 25（多 Agent 辩论）
**时间：** ~60 分钟

## 学习目标

- 说出四种常见编排模式及其适用场景。
- 描述 2026 年 LangChain 的建议：基于工具调用的监督 vs 主管库。
- 解释 Anthropic 的"构建正确的系统"原则及其如何决定拓扑选择。
- 基于标准库和模拟 LLM 实现全部四种模式。

## 问题

团队往往在真正需要之前就追求"多 Agent"。四种模式在各框架中反复出现；一旦你能说出它们的名字，就能选对方案——或者干脆跳过拓扑。

## 概念

### Supervisor-worker（主管-工作者）

- 一个中央路由 LLM 将任务分发给专业 Agent。
- 决策：回传给自己、交给专业 Agent、终止。
- 专业 Agent 之间不直接通信；所有路由都经过主管。

相关框架：LangGraph `create_supervisor`、Anthropic orchestrator-workers、CrewAI Hierarchical Process。

**2026 年 LangChain 建议：** 通过直接的工具调用而非 `create_supervisor` 来实现监督。这样可以更精细地控制上下文工程——你决定每个专业 Agent 看到什么。

### Swarm / peer-to-peer（对等群集）

- Agent 之间通过共享的工具接口直接交接。
- 无中央路由器。
- 延迟低于 Supervisor（跳数更少）。
- 更难推理（没有单一控制点）。

相关框架：LangGraph swarm 拓扑、OpenAI Agents SDK handoffs（当所有 Agent 都可以相互交接时）。

### Hierarchical（分层式）

- 主管管理下级主管，下级主管管理工作站。
- 在 LangGraph 中实现为嵌套子图；在 CrewAI 中实现为嵌套 crew。
- 可扩展到大量 Agent 群体，代价是运维复杂度增加。

适用场景：当单个 Supervisor 的上下文预算无法容纳所有专业 Agent 的描述时。

### Debate（辩论式）

- 并行提议者 + 迭代交叉评审（第 25 课）。
- 严格来说不算编排——更像是验证——但在框架中常作为拓扑选项出现。

### CrewAI：Crew vs Flow

CrewAI 形式化了两种部署模式：

- **Flow**：用于确定性事件驱动自动化（推荐的生成环境起点）。
- **Crew**：用于自主角色型协作。

这与上述四种模式正交，但映射到拓扑上：Flow 通常是 Supervisor 或 Hierarchical；Crew 通常是 Supervisor 加 LLM 路由器。

### Anthropic 的指导意见

"在 LLM 领域的成功不在于构建最复杂的系统，而在于为你的需求构建正确的系统。"

决策顺序：

1. 单个 Agent + 工作流模式（第 12 课）——从这里开始。
2. Supervisor-worker — 当你有 2-4 个专业 Agent 时。
3. Swarm — 当延迟比推理清晰度更重要时。
4. Hierarchical — 仅在 Supervisor 上下文预算不够时。
5. Debate — 当准确率比成本更重要时。

### 常见误区

- **拓扑优先思维。** 还没搞清楚"多 Agent"要解决什么问题就先说"我们需要多 Agent"。
- **Swarm 中的交接循环。** A -> B -> A -> B。应使用跳数计数器。
- **虚假分层。** 因为"企业架构"就堆三层，实际上只有两个团队。合并。

## 动手实现

`code/main.py` 使用标准库和模拟 LLM 实现了全部四种模式：

- `Supervisor` — 中央路由器。
- `Swarm` — 对等直接交接。
- `Hierarchical` — 主管的主管。
- `Debate` — 并行提议者 + 评审。

每种模式处理同样的三意图任务（退款 / Bug / 销售）。追踪形状各不相同。

运行方式：

```
python3 code/main.py
```

输出：每种模式的追踪路径 + 操作计数。Supervisor 最清晰；Swarm 最短；Hierarchical 最深；Debate 最昂贵。

## 应用建议

- **LangGraph**：适合 Supervisor 和 Hierarchical（嵌套子图）。
- **OpenAI Agents SDK**：适合将交接作为工具（Supervisor 形态）。
- **CrewAI Flow**：适合生产环境的确定性流程。
- **自定义**：适合 Debate 或需要精确控制的场景。

## 成果交付

`outputs/skill-orchestration-picker.md` 选择一种拓扑并实现。

## 练习

1. 移除路由器，把 supervisor-worker 改成 swarm。什么会出问题？哪些地方变好了？
2. 给 swarm 加上跳数计数器：超过 3 次交接则拒绝。它能捕获 A->B->A 循环吗？
3. 为一个有 12 个专业 Agent 的领域构建两层分层系统。如果不嵌套，上下文预算在哪里失效？
4. 对四种模式进行生产负载测试。哪种模式在哪些指标上胜出（延迟、成本、准确率、可调试性）？
5. 阅读 Anthropic 的"Building Effective Agents"博文。将你的每个生产流程映射到四种模式之一。有没有无法清晰映射的？

## 关键术语

| 术语 | 通常说法 | 实际含义 |
|------|----------|----------|
| Supervisor-worker | "路由器 + 专业 Agent" | 中央 LLM 分发给专业 Agent；它们之间不直接对话 |
| Swarm | "对等网络" | 通过共享工具直接交接；无中央路由器 |
| Hierarchical | "主管的主管" | 面向大规模群体的嵌套子图 |
| Debate | "提议者 + 评审" | 并行提议者，交叉评审（第 25 课） |
| 基于工具调用的监督 | "不用库的 Supervisor" | 通过直接工具调用实现 Supervisor，以获得上下文控制权 |
| Crew | "自主团队" | CrewAI 的基于角色的协作模式 |
| Flow | "确定性工作流" | CrewAI 的事件驱动生产模式 |

## 延伸阅读

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — 五种模式 + Agent vs 工作流
- [LangGraph 概览](https://docs.langchain.com/oss/python/langgraph/overview) — supervisor、swarm、hierarchical
- [CrewAI 文档](https://docs.crewai.com/en/introduction) — Crew vs Flow
- [Du et al., Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) — 辩论模式
