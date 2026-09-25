# ReWOO 与 Plan-and-Execute：解耦式规划

> ReAct 在同一条流中交替进行思考和行动。ReWOO 将二者分离：先一次性做出完整计划，再执行。Token 减少 5 倍，HotpotQA 准确率提升 4%，而且可以把规划器蒸馏到 7B 模型中。Plan-and-Execute 将其泛化；Plan-and-Act 将其扩展到网页导航。

**Type:** Build
**Languages:** Python (标准库)
**Prerequisites:** 第 14 阶段 · 01（Agent Loop）
**Time:** 约 60 分钟

## 学习目标

- 解释为什么 ReWOO 的 Planner / Worker / Solver 拆分比 ReAct 的交替循环更节省 token、更健壮。
- 实现计划 DAG、按依赖顺序执行的执行器，以及组合各 Worker 输出的求解器——全部使用标准库。
- 使用 2026 年“五种工作流模式”框架（Anthropic），判断一个任务应以先规划后执行还是交替式 ReAct 运行。
- 识别何时需要 Plan-and-Act 的合成计划数据来处理长程网页或移动端任务。

## 问题所在

ReAct 的思考-行动-观察交替循环简单而灵活，但每次工具调用都必须携带完整的先前上下文——包括之前所有的思考。Token 用量随深度呈二次增长。更糟的是：当某个工具在循环中途失败时，模型必须从错误观察中重新推导整个计划。

ReWOO（Xu et al., arXiv:2305.18323，2023 年 5 月）注意到了这一点，并做了一个赌注：预先规划整个任务，并行获取证据，最后组合答案。一次 LLM 调用做规划，N 次工具调用获取证据（可并行），一次 LLM 调用求解。代价是灵活性降低（计划是静态的），换来的是显著更好的 token 效率和更清晰的失败模式。

## 核心概念

### 三个角色

```
Planner:  user_question -> [plan_dag]
Workers:  [plan_dag]     -> [evidence]        (tool calls, possibly parallel)
Solver:   user_question, plan_dag, evidence -> final_answer
```

Planner 生成一个 DAG。每个节点指明一个工具、其参数，以及它依赖哪些更早的节点（形如 `#E1`、`#E2` 的引用）。Worker 按拓扑顺序执行节点。Solver 将所有内容拼接在一起。

### 为什么 token 减少 5 倍

ReAct 的提示长度随步数线性增长。到第 10 步时，提示包含思考 1 加行动 1 加观察 1 加思考 2 加行动 2 加观察 2，以此类推。每个中间步骤还冗余地重复包含原始提示。

ReWOO 只付出一个规划器提示（较大）、N 个小的 worker 提示（每个只包含工具调用，无链条），以及一个求解器提示。论文在 HotpotQA 上测得约 5 倍更少的 token，同时绝对准确率提升 4 个百分点。

### 为什么更健壮

在 ReAct 中，如果 worker 3 失败，循环必须在流中途从错误中推理。在 ReWOO 中，worker 3 返回一个错误字符串；solver 在上下文中结合原始计划看到它，可以优雅地降级。失败定位是按节点的，而非按步骤的。

### 规划器蒸馏

论文的第二个结果：因为规划器不接触观察结果，你可以在一个 175B 教师模型的规划器输出上微调一个 7B 模型。小模型负责规划；推理时不需要大模型。这如今已是标准做法——2026 年许多生产级 agent 使用小规划器加大执行器，或反之。

### Plan-and-Execute（2023）

LangChain 团队 2023 年 8 月的文章将 ReWOO 泛化为一个模式名称：Plan-and-Execute。预先的规划器输出步骤列表，执行器运行每一步，一个可选的重新规划器可在观察结果后进行修订。这比 ReWOO 更接近 ReAct（重新规划器将观察带回规划中），但保留了 token 节省。

### Plan-and-Act（Erdogan et al., arXiv:2503.09572, ICML 2025）

Plan-and-Act 将该模式扩展到长程网页和移动端 agent。其关键贡献是合成计划数据：一个带标注的轨迹生成器产生计划显式的训练数据。用于微调规划器模型，使其在类 WebArena 的任务上能持续工作超过 30–50 步——在这类任务上，单条 ReAct 轨迹会失去连贯性。

### 何时选择哪种

| 模式 | 适用场景 |
|---------|------|
| ReAct | 短任务、未知环境、需要响应式异常处理 |
| ReWOO | 结构化任务、工具已知、对 token 敏感、证据可并行 |
| Plan-and-Execute | 类似 ReWOO，但可在部分执行后重新规划 |
| Plan-and-Act | 长程（>30 步）、网页/移动端/计算机操作 |
| Tree of Thoughts | 搜索值得付出代价时（第 04 课） |

Anthropic 2024 年 12 月的指导：从最简单的开始。如果任务只是一次工具调用加一段总结，不要构建 ReWOO。如果任务是一个 40 步的研究作业，不要只用 ReAct。

```figure
rewoo-plan
```

## 动手构建

`code/main.py` 实现了一个玩具版 ReWOO：

- `Planner` —— 一个脚本化策略，从提示生成计划 DAG。
- `Worker` —— 通过注册表分发每个节点的工具调用。
- `Solver` —— 脚本化组合，读取证据并产生最终答案。
- 依赖解析 —— 形如 `#E1` 的引用会被替换为更早的 worker 输出。

演示回答“法国首都的人口，四舍五入到百万是多少？”，使用两步计划：(1) 查询首都，(2) 查询人口，然后求解。

运行它：

```
python3 code/main.py
```

轨迹首先显示完整计划，然后是 worker 结果，最后是 solver 组合。将 token 计数（我们打印一个粗略的字符计数）与 ReAct 风格的交替运行比较——在这类结构化任务上 ReWOO 胜出。

## 如何使用

LangGraph 将 Plan-and-Execute 作为配方提供（`create_react_agent` 用于 ReAct，自定义图用于 plan-execute）。CrewAI 的 Flows 直接编码了该模式：你预先定义任务，Flow DAG 执行它们。Plan-and-Act 的合成数据方法仍主要处于研究阶段；其运行时模式（显式计划 DAG）通过 LangGraph 和 CrewAI Flows 进入生产环境。

## 如何上线

`outputs/skill-rewoo-planner.md` 在给定工具目录的情况下，从用户请求生成 ReWOO 计划 DAG。它在校验计划（无环、所有引用已解析、所有工具存在）之后才交给执行器。

## 练习

1. 为独立的计划节点并行化 worker 执行。在一个有 2 个并行组的 6 节点 DAG 上，这能带来什么收益？
2. 添加一个重新规划节点，在任何 worker 返回错误时触发。对 ReWOO 做出什么最小改动能使其成为 Plan-and-Execute？
3. 将 `Planner` 替换为小模型（7B 级），并让 `Solver` 保持在前沿模型上。比较端到端质量——这种拆分在何处失效？
4. 阅读 ReWOO 论文第 4 节关于规划器蒸馏的内容。从概念上复现 175B -> 7B 的结果：你需要什么训练数据，以及如何为计划质量打分？
5. 将玩具版移植到 Plan-and-Act 的轨迹形态：计划是序列而非 DAG。哪些权衡发生了变化？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|------------------------|
| ReWOO | "无观察的推理" | 先规划，再并行获取证据，最后求解——规划提示中不含观察结果 |
| Plan-and-Execute | "LangChain 的 plan-execute 模式" | 带有执行后可选重新规划节点的 ReWOO |
| Plan-and-Act | "扩展的 plan-execute" | 显式的规划器/执行器拆分，配合用于长程任务的合成计划训练数据 |
| 证据引用 | "#E1, #E2, ..." | 计划节点占位符，在分发时被替换为先前的 worker 输出 |
| 规划器蒸馏 | "小规划器，大执行器" | 在大教师模型的规划器轨迹上微调小模型 |
| Token 效率 | "更少的往返" | 论文中在 HotpotQA 上比 ReAct 少 5 倍 token |
| DAG 执行器 | "拓扑分发器" | 按依赖顺序运行计划节点；每一层可并行 |

## 延伸阅读

- [Xu et al., ReWOO: Decoupling Reasoning from Observations (arXiv:2305.18323)](https://arxiv.org/abs/2305.18323) —— 原始论文
- [Erdogan et al., Plan-and-Act (arXiv:2503.09572)](https://arxiv.org/abs/2503.09572) —— 使用合成计划扩展的规划器-执行器
- [LangGraph Plan-and-Execute tutorial](https://docs.langchain.com/oss/python/langgraph/overview) —— 框架配方
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) —— 选择可行的最简单模式