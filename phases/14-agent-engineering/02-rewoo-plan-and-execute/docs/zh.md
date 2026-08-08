# ReWOO 与 Plan-and-Execute：解耦规划

> ReAct 在一个流中交错思考和行动。ReWOO 将它们分离：先制定一个大计划，然后执行。令牌减少 5 倍，HotpotQA 准确率提升 4%，并且你可以将规划器蒸馏到 7B 模型中。Plan-and-Execute 将其泛化；Plan-and-Act 将其扩展到网页导航。

**类型：** Build
**语言：** Python（stdlib）
**前置知识：** Phase 14 · 01（智能体循环）
**时间：** ~60 分钟

## 学习目标

- 解释为什么 ReWOO 的 Planner / Worker / Solver 拆分比 ReAct 的交错循环节省令牌并提高鲁棒性。
- 实现计划 DAG、依赖有序执行器和组合 Worker 输出的 Solver —— 全部使用 stdlib。
- 使用 2026 年"五种工作流模式"框架（Anthropic）决定任务应该作为先计划后执行还是交错 ReAct 运行。
- 识别 Plan-and-Act 的合成计划数据何时需要用于长程网页或移动任务。

## 问题所在

ReAct 的交错思考-行动-观察循环简单灵活，但每次工具调用都必须携带完整的先前上下文 —— 包括每个先前的思考。令牌使用量随深度二次增长。更糟的是：当工具在循环中间失败时，模型必须从错误观察中重新推导整个计划。

ReWOO（Xu 等人，arXiv:2305.18323，2023 年 5 月）注意到了这一点并打了一个赌：先计划整个事情，并行获取证据，最后组合答案。一个 LLM 调用用于计划，N 个工具调用用于证据（可以并行），一个 LLM 调用用于解决。权衡是灵活性降低（计划是静态的）以换取更好的令牌效率和更清晰的失败模式。

## 核心概念

### 三个角色

```
Planner:  user_question -> [plan_dag]
Workers:  [plan_dag]     -> [evidence]        (工具调用，可能并行)
Solver:   user_question, plan_dag, evidence -> final_answer
```

Planner 产生 DAG。每个节点命名一个工具、其参数以及它依赖的先前节点（如 `#E1`、`#E2` 的引用）。Workers 按拓扑顺序执行节点。Solver 将所有内容缝合在一起。

### 为什么令牌减少 5 倍

ReAct 的提示长度随步骤数线性增长。在第 10 步，提示包含思考 1 加行动 1 加观察 1 加思考 2 加行动 2 加观察 2，依此类推。每个中间步骤还冗余地包含原始提示。

ReWOO 支付一个规划器提示（大），N 个小 Worker 提示（每个只是工具调用，无链），和一个 Solver 提示。在 HotpotQA 上，论文测量令牌减少约 5 倍，同时准确率绝对提升 4%。

### 为什么它更鲁棒

如果 Worker 3 在 ReAct 中失败，循环必须在中流中从错误中推理出来。在 ReWOO 中，Worker 3 返回错误字符串；Solver 在原始计划上下文中看到它，可以优雅降级。失败定位是每节点的，不是每步的。

### 规划器蒸馏

论文的第二个结果：因为规划器看不到观察，你可以在 175B 教师的规划器输出上微调 7B 模型。小模型处理规划；大模型在推理时不需要。这现在是标准做法 —— 许多 2026 年生产智能体使用小规划器和大执行器，或反之。

### Plan-and-Execute（LangChain，2023）

LangChain 团队 2023 年 8 月的文章将 ReWOO 泛化为一个模式名称：Plan-and-Execute。预先规划器发出步骤列表，执行器运行每个步骤，可选的重新规划器可以在观察结果后修订。这比 ReWOO 更接近 ReAct（重新规划器将观察带回规划），但保留了令牌节省。

### Plan-and-Act（Erdogan 等人，arXiv:2503.09572，ICML 2025）

Plan-and-Act 将模式扩展到长程网页和移动智能体。关键贡献是合成计划数据：标记的轨迹生成器产生训练数据，其中计划是显式的。用于微调规划器模型，使其在 WebArena 类任务上超过 30-50 步时仍然有效，而单个 ReAct 轨迹会失去连贯性。

### 何时选择哪个

| 模式 | 何时使用 |
|---------|------|
| ReAct | 短任务、未知环境、需要反应式异常处理 |
| ReWOO | 结构化任务、已知工具、令牌敏感、可并行证据 |
| Plan-and-Execute | 像 ReWOO 但部分执行后重新规划 |
| Plan-and-Act | 长程（>30 步）、网页/移动/计算机使用 |
| Tree of Thoughts | 搜索值得付费（第 04 课） |

Anthropic 2024 年 12 月指导：从最简单的开始。如果任务是一个工具调用加摘要，不要构建 ReWOO。如果任务是 40 步的研究任务，不要单独做 ReAct。

## 构建它

`code/main.py` 实现一个玩具 ReWOO：

- `Planner` —— 一个脚本策略，从提示发出计划 DAG。
- `Worker` —— 通过注册表分发每个节点的工具调用。
- `Solver` —— 脚本组合，读取证据并产生最终答案。
- 依赖解析 —— 像 `#E1` 的引用被替换为先前 Worker 输出。

演示回答"法国首都的人口是多少，四舍五入到百万？"使用两步计划：(1) 查找首都，(2) 查找人口，然后解决。

运行它：

```
python3 code/main.py
```

追踪首先显示完整计划，然后显示 Worker 结果，然后显示 Solver 组合。将令牌计数（我们打印粗略字符计数）与 ReAct 风格交错运行比较 —— ReWOO 在这种结构化任务上获胜。

## 使用它

LangGraph 将 Plan-and-Execute 作为配方提供（`create_react_agent` 用于 ReAct，自定义图用于计划-执行）。CrewAI 的 Flows 直接编码该模式：你预先定义任务，Flow DAG 执行它们。Plan-and-Act 的合成数据方法仍然主要是研究；运行时模式（显式计划 DAG）通过 LangGraph 和 CrewAI Flows 投入生产。

## 交付它

`outputs/skill-rewoo-planner.md` 从用户请求生成 ReWOO 计划 DAG，给定工具目录。它在移交给执行器之前验证计划（无环、每个引用已解析、每个工具存在）。

## 练习

1. 并行化独立计划节点的 Worker 执行。在具有 2 个并行组的 6 节点 DAG 上，它给你带来什么？
2. 添加一个重新规划节点，如果任何 Worker 返回错误则触发。使 ReWOO 成为 Plan-and-Execute 的最小改动是什么？
3. 将 `Planner` 替换为小模型（7B 级别）并将 `Solver` 保留在前沿模型上。比较端到端质量 —— 拆分在哪里失败？
4. 阅读 ReWOO 论文第 4 节关于规划器蒸馏的内容。概念上复现 175B -> 7B 结果：你需要什么训练数据，如何评分计划质量？
5. 将玩具移植到 Plan-and-Act 的轨迹形状：计划是序列，不是 DAG。什么权衡会改变？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| ReWOO | "无观察推理" | 计划，然后并行获取证据，然后解决 —— 规划提示中没有观察 |
| Plan-and-Execute | "LangChain 的计划-执行模式" | 带可选重新规划节点的 ReWOO，在执行后 |
| Plan-and-Act | "扩展的计划-执行" | 显式规划器/执行器拆分，带合成计划训练数据，用于长程任务 |
| 证据引用 | "#E1, #E2, ..." | 计划节点占位符，在分发时替换为先前 Worker 输出 |
| 规划器蒸馏 | "小规划器，大执行器" | 在大型教师的规划器轨迹上微调小模型 |
| 令牌效率 | "更少的往返" | 论文中 HotpotQA 比 ReAct 令牌减少 5 倍 |
| DAG 执行器 | "拓扑分发器" | 按依赖顺序运行计划节点；每层并行 |

## 延伸阅读

- [Xu 等人，ReWOO：从观察中解耦推理（arXiv:2305.18323）](https://arxiv.org/abs/2305.18323) —— 规范论文
- [Erdogan 等人，Plan-and-Act（arXiv:2503.09572）](https://arxiv.org/abs/2503.09572) —— 带合成计划的扩展规划器-执行器
- [LangGraph Plan-and-Execute 教程](https://docs.langchain.com/oss/python/langgraph/overview) —— 框架配方
- [Anthropic，构建有效智能体](https://www.anthropic.com/research/building-effective-agents) —— 选择最简单的有效模式
