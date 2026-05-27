# CrewAI：基于角色的 Crews 与 Flows

> CrewAI 是 2026 年基于角色的多 Agent 框架——Agent、Tasks、Crews、Processes 作为四个原语。文档中的生产指导："对于任何生产就绪的应用程序，从 Flow 开始。"

**类型：** 学习与构建
**语言：** Python（标准库）
**前置要求：** 阶段 14 · 12（工作流模式）、阶段 14 · 14（参与者模型）
**时长：** 约 60 分钟

## 学习目标

- 说出 CrewAI 的四个原语——Agent、Task、Crew、Process——以及各自的作用。
- 区分 Crews（自主的基于角色的协作）与 Flows（事件驱动的确定性工作流）。
- 解释为什么文档建议使用 Flows 进行生产，使用 Crews 进行探索。
- 实现一个标准库 Crew 运行器以及一个标准库 Flow 运行器；展示各自的亮点。

## 问题背景

采用多 Agent 框架的团队会遇到同一堵墙："自主协作"听起来很棒，但当客户提交错误时，你需要确定性回放。CrewAI 明确地拆分了这一点——Crews 用于创造性协作，Flows 用于事件驱动、可审计、生产形态的工作流。

## 核心概念

### 四个原语

- **Agent。** 角色 + 目标 + 背景故事 + 工具。背景故事是承重的——它塑造语气和判断。
- **Task。** 描述 + expected_output + 分配的 Agent。可重用的工作单元。
- **Crew。** 序列化 Agent 和任务的容器。拥有执行 Process。
- **Process。** Sequential（顺序）或 Hierarchical（带有管理 Agent）或 Consensual（共识）。

### Crews vs Flows

- **Crew。** 自主的，LLM 驱动的。适用于开放式任务：研究、头脑风暴、初稿。框架在运行时选择形态。
- **Flow。** 事件驱动的，代码拥有的图。每个步骤在触发器（函数装饰器、事件匹配）上触发。适用于生产：可观察、可测试、确定性。

CrewAI 2026 文档说：从 Flows 开始生产应用程序；当自主性值得其成本时，将 Crews 折叠为子步骤。

### 记忆系统

CrewAI 开箱即用地提供四种记忆类型：短期（运行内）、长期（跨运行）、实体（每实体事实）、上下文（检索时组装）。与向量存储的集成是第一方的。

### AWS Bedrock 集成

CrewAI 有记录的 AWS Bedrock 集成，带有 CloudWatch、AgentOps 和 Langfuse 可观测性钩子。AWS 文档在他们的基准测试中引用相比 LangGraph 在 QA 任务上 5.76 倍的加速——将框架特定的数字视为方向性的，而不是绝对的。

### 依赖形态

独立于 LangChain。Python 3.10–3.13。使用 `uv` 进行依赖管理。2026 年初 30k+ GitHub 星标。

### 这种模式哪里会出错

- **Crew-as-prod。** 在生产中使用自由形式的 Crew 而没有 Flow 包装器。输出可变性高；调试痛苦。
- **背景故事膨胀。** 2000 字的背景故事推出上下文预算。保持它们紧凑。
- **Process 混淆。** 分层 Process 添加了一个管理 Agent 进行路由；仅当你有 4+ 专家时使用。

## 构建它

`code/main.py` 实现两者的标准库版本：

- `Agent`、`Task`、`Crew`、`SequentialCrew`（一次一个任务）、`HierarchicalCrew`（管理路由）。
- `Flow` 带有 `@start()` 和 `@listen()` 装饰器（普通函数占位符），在命名事件上触发。
- 相同三步任务（研究、大纲、草稿）以两种方式实现。

运行它：

```
python3 code/main.py
```

Crew 轨迹是流动和可变的；Flow 轨迹是固定和可观察的。这就是选择。

## 使用它

- **CrewAI Flow** 用于生产。
- **CrewAI Crew** 用于探索、配对、初稿。
- **LangGraph**（第 13 课）如果你想要更显式的状态机。
- **AutoGen v0.4**（第 14 课）如果你想要参与者模型并发。

## 部署它

`outputs/skill-crew-or-flow.md` 为任务选择 Crew vs Flow 并搭建最小实现。

## 练习

1. 将基于 Crew 的演示转换为 Flow。计算可变性下降的接触点。
2. 向 Crew 添加实体记忆：关于客户的事实跨任务持久化。
3. 实现分层 Process：管理 Agent 根据先前输出选择哪个专家接下来运行。
4. 阅读 CrewAI 的文档介绍。将你的玩具移植到真实的 `crewai` API。可测试性发生了什么变化？
5. 将 AgentOps 或 Langfuse 接入你的一个运行。你在标准库版本中错过了哪些轨迹？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| Agent | "Persona" | 角色 + 目标 + 背景故事 + 工具 |
| Task | "工作单元" | 描述 + 预期输出 + 被分配者 |
| Crew | "Agent 团队" | Agent + 任务 + Process 的容器 |
| Process | "执行策略" | Sequential / Hierarchical / Consensual |
| Flow | "确定性工作流" | 事件驱动、代码拥有、可测试 |
| Backstory | "Persona 提示" | Agent 的语气和判断塑造者 |
| Entity memory | "每实体事实" | 范围限定到客户/账户/问题的记忆 |

## 延伸阅读

- [CrewAI docs introduction](https://docs.crewai.com/en/introduction)——概念和建议的生产路径
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)——何时多 Agent 有帮助以及何时没有
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview)——状态机替代方案
