# 编排模式：监督者、群集、层次化

> 2026 年框架中反复出现四种编排模式：supervisor-worker、swarm / peer-to-peer、hierarchical、debate。Anthropic 的指导："这是关于为您的需求构建正确的系统。"从简单开始；仅在单个智能体加五种工作流模式不足时添加拓扑。

**类型：** 学习 + 构建
**语言：** Python（标准库）
**前置条件：** 阶段 14 · 12（工作流模式），阶段 14 · 25（多智能体辩论）
**时间：** ~60 分钟

## 学习目标

- 命名四种反复出现的编排模式以及每种适合的情况。
- 描述 2026 年 LangChain 建议：基于工具调用的监督与监督者库。
- 解释 Anthropic 的"构建正确系统"规则以及它如何门控拓扑选择。
- 针对通用脚本化 LLM 在标准库中实现所有四种。

## 问题

团队在需要之前就寻求"多智能体"。四种模式在框架中反复出现；一旦您可以命名它们，您就可以选择正确的——或完全跳过拓扑。

## 概念

### Supervisor-worker

- 中央路由 LLM 分派给专家智能体。
- 决定：循环回自身、移交给专家、终止。
- 专家不相互交谈；所有路由通过监督者。

框架：LangGraph `create_supervisor`、Anthropic orchestrator-workers、CrewAI Hierarchical Process。

**2026 年 LangChain 建议：** 通过直接工具调用而不是 `create_supervisor` 进行监督。提供更细的上下文工程控制——您确切决定每个专家看到什么。

### Swarm / peer-to-peer

- 智能体通过共享工具表面直接移交。
- 无中央路由器。
- 比监督者更低的延迟（更少的跳数）。
- 更难推理（无单一控制点）。

框架：LangGraph swarm 拓扑、OpenAI Agents SDK 移交（当所有智能体可以移交给所有其他时）。

### Hierarchical

- 监督者管理子监督者管理工作者。
- 在 LangGraph 中作为嵌套子图实现；在 CrewAI 中作为嵌套 crews。
- 以操作复杂性为代价扩展到大量智能体群体。

当您需要它时：当单个监督者的上下文预算无法容纳所有专家的描述时。

### Debate

- 并行提议者 + 迭代交叉批评（课程 25）。
- 不是真正的编排——更多是验证——但在框架中作为拓扑选择出现。

### CrewAI Crew vs Flow

CrewAI 形式化两种部署模式：

- **Flow** 用于确定性事件驱动自动化（生产推荐起点）。
- **Crew** 用于自主基于角色的协作。

这与上述四种模式正交，但映射到拓扑：Flow 通常是监督者或层次化；Crew 通常是带有 LLM 路由器的监督者。

### Anthropic 的指导

"LLM 领域的成功不是关于构建最复杂的系统。而是关于为您的需求构建正确的系统。"

决策顺序：

1. 单智能体 + 工作流模式（课程 12）— 从这里开始。
2. Supervisor-worker — 当您有 2-4 个专家时。
3. Swarm — 当延迟比推理清晰度更重要时。
4. Hierarchical — 仅当监督者上下文预算失败时。
5. Debate — 当准确性比成本更重要时。

### 这种模式出错的地方

- **拓扑优先思维。** 在识别多智能体解决什么问题之前"我们需要多智能体"。
- **Swarm 中的弹跳移交。** A -> B -> A -> B。使用跳数计数器。
- **假层次。** 三个层因为"企业"；两个实际团队。折叠。

## 构建

`code/main.py` 在标准库中针对脚本化 LLM 实现所有四种模式：

- `Supervisor` — 中央路由器。
- `Swarm` — 带直接移交的对等。
- `Hierarchical` — 监督者的监督者。
- `Debate` — 并行提议者 + 批评。

每种模式处理相同的三意图任务（退款/错误/销售）。跟踪形态不同。

运行它：

```
python3 code/main.py
```

输出：每模式跟踪 + 操作计数。Supervisor 最干净；swarm 最短；hierarchical 最深；debate 最昂贵。

## 使用

- **LangGraph** 用于监督者和层次化（嵌套子图）。
- **OpenAI Agents SDK** 用于作为工具的移交（监督者形态）。
- **CrewAI Flow** 用于生产确定性。
- **自定义** 用于辩论或当您想要精确控制时。

## 交付

`outputs/skill-orchestration-picker.md` 选择拓扑并实现它。

## 练习

1. 通过移除路由器将 supervisor-worker 转换为 swarm。什么坏了？什么改进了？
2. 向 swarm 添加跳数计数器：3 次移交后拒绝。它捕获 A->B->A 弹跳吗？
3. 为 12 专家领域构建两级层次系统。没有嵌套时上下文预算在哪里失败？
4. 在生产形态工作负载上分析四种模式。哪种在哪种指标上获胜（延迟、成本、准确性、可调试性）？
5. 阅读 Anthropic 的"构建有效智能体"帖子。将您的每个生产流映射到四种之一。有任何不能干净映射的吗？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| Supervisor-worker | "路由器 + 专家" | 中央 LLM 分派给专家；它们不相互交谈 |
| Swarm | "对等" | 通过共享工具直接移交；无中央路由器 |
| Hierarchical | "监督者的监督者" | 用于大量群体的嵌套子图 |
| Debate | "提议者 + 批评" | 并行提议者，交叉批评（课程 25） |
| 基于工具调用的监督 | "无库监督者" | 实现监督者作为直接工具调用以进行上下文控制 |
| Crew | "自主团队" | CrewAI 的基于角色的协作模式 |
| Flow | "确定性工作流" | CrewAI 的事件驱动生产模式 |

## 延伸阅读

- [Anthropic，构建有效智能体](https://www.anthropic.com/research/building-effective-agents) — 五种模式 + 智能体 vs 工作流
- [LangGraph 概述](https://docs.langchain.com/oss/python/langgraph/overview) — 监督者、swarm、层次化
- [CrewAI 文档](https://docs.crewai.com/en/introduction) — Crew vs Flow
- [Du 等人，Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) — 辩论模式
