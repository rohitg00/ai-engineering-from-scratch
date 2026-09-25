# 编排模式：Supervisor、Swarm、层级式

> 2026 年的框架中反复出现四种编排模式：supervisor-worker、swarm / 点对点、层级式、debate。Anthropic 的指导原则：“关键是为你的需求构建合适的系统。”从简单开始；只有当单个 agent 加五种工作流模式不够用时，才引入拓扑结构。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 25 (Multi-Agent Debate)
**Time:** ~60 分钟

## 学习目标

- 说出四种反复出现的编排模式及各自的适用场景。
- 描述 2026 年 LangChain 的建议：基于工具调用的监督 vs supervisor 库。
- 解释 Anthropic 的“构建合适的系统”原则，以及它如何约束拓扑选择。
- 使用标准库针对同一个脚本化 LLM 实现全部四种模式。

## 问题

团队往往在真正需要"multi-agent"之前就用上它。四种模式在各框架中反复出现；一旦你能叫出它们的名字，就能选对——或者干脆不用拓扑结构。

## 概念

### Supervisor-worker

- 一个中央路由 LLM 向专家 agent 分发任务。
- 决策：回到自身循环、移交专家、终止。
- 专家之间不互相通信；所有路由都经过 supervisor。

框架：LangGraph `create_supervisor`、Anthropic orchestrator-workers、CrewAI Hierarchical Process。

**2026 年 LangChain 建议：** 通过直接工具调用实现监督，而不是 `create_supervisor`。这提供更细粒度的上下文工程控制——你可以精确决定每个专家看到什么。

### Swarm / 点对点

- agent 通过共享的工具接口直接移交。
- 没有中央路由器。
- 比 supervisor 延迟更低（跳数更少）。
- 更难推理（没有单一控制点）。

框架：LangGraph swarm 拓扑、OpenAI Agents SDK handoffs（当所有 agent 都能移交给所有其他 agent 时）。

### 层级式

- supervisor 管理子 supervisor，子 supervisor 管理工作者。
- 在 LangGraph 中以嵌套子图实现；在 CrewAI 中以嵌套 crew 实现。
- 可扩展到大规模 agent 群体，代价是运营复杂性增加。

什么时候需要它：当单个 supervisor 的上下文预算无法容纳所有专家的描述时。

### Debate

- 并行提议者 + 迭代式交叉批判（第 25 课）。
- 严格来说不算编排——更接近验证——但在框架中会作为一种拓扑选项出现。

### 自治 crew vs 确定性 flow

CrewAI 正式定义了两种部署模式：

- **Flow** 用于确定性的事件驱动自动化（生产环境推荐的起点）。
- **Crew** 用于自治的基于角色的协作。

这与上述四种模式正交，但可映射到拓扑：Flow 通常对应 supervisor 或层级式；Crew 通常对应带 LLM 路由器的 supervisor。

### Anthropic 的指导

"在 LLM 领域取得成功，不在于构建最复杂的系统，而在于为你的需求构建合适的系统。"

决策顺序：

1. 单个 agent + 工作流模式（第 12 课）——从这里开始。
2. Supervisor-worker——当你有 2-4 个专家时。
3. Swarm——当延迟比推理清晰度更重要时。
4. 层级式——只有当 supervisor 上下文预算不够时。
5. Debate——当准确率比成本更重要时。

### 这种模式的常见错误

- **拓扑优先思维。** 在弄清 multi-agent 解决什么问题之前就说“我们需要 multi-agent"。
- **Swarm 中来回移交。** A -> B -> A -> B。使用跳数计数器。
- **虚假层级。** 因为“企业级”而设三层；实际只有两个团队。合并掉。

```figure
orchestration-pattern
```

## 动手实现

`code/main.py` 使用标准库针对一个脚本化 LLM 实现全部四种模式：

- `Supervisor` —— 中央路由器。
- `Swarm` —— 直接移交的点对点。
- `Hierarchical` —— supervisor 的 supervisor。
- `Debate` —— 并行提议者 + 批判。

每种模式处理同样的三意图任务（退款 / bug / 销售）。追踪形态各不相同。

运行它：

```
python3 code/main.py
```

输出：每种模式的追踪 + 操作计数。Supervisor 最干净；swarm 跳数最少；层级式最深；debate 最昂贵。

## 使用场景

- **LangGraph** 用于 supervisor 和层级式（嵌套子图）。
- **OpenAI Agents SDK** 用于 handoffs-as-tools（supervisor 形态）。
- **CrewAI Flow** 用于生产环境的确定性场景。
- **Custom** 用于 debate 或需要精确控制的场景。

## 上线

`outputs/skill-orchestration-picker.md` 选择一种拓扑并实现它。

## 练习

1. 通过移除路由器，把 supervisor-worker 转换为 swarm。什么会坏掉？什么会改善？
2. 给 swarm 加一个跳数计数器：3 次移交后拒绝。它能捕捉到 A->B->A 的来回吗？
3. 为一个 12 专家的领域构建一个两层层级系统。没有嵌套时，上下文预算在哪里不够用？
4. 在生产形态的工作负载上对四种模式做性能分析。哪个模式在哪项指标上胜出（延迟、成本、准确率、可调试性）？
5. 阅读 Anthropic 的《Building Effective Agents》文章。把你的每个生产流程映射到四种之一。有映射不顺的吗？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| Supervisor-worker | “路由器 + 专家" | 中央 LLM 向专家分发任务；专家之间互不通信 |
| Swarm | "Peer-to-peer" | 通过共享工具直接移交；没有中央路由器 |
| 层级式 | “supervisor 的 supervisor" | 为大规模群体使用嵌套子图 |
| Debate | “提议者 + 批判" | 并行提议者，交叉批判（第 25 课） |
| 基于工具调用的监督 | “不依赖库的 supervisor" | 把 supervisor 实现为直接工具调用，以控制上下文 |
| Crew | “自治团队" | CrewAI 的基于角色的协作模式 |
| Flow | “确定性工作流" | CrewAI 的事件驱动生产模式 |

## 延伸阅读

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) —— 五种模式 + agent vs 工作流
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) —— supervisor、swarm、层级式
- [CrewAI docs](https://docs.crewai.com/en/introduction) —— Crew vs Flow
- [Du et al., Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) —— debate 模式