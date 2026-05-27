# ReWOO 与 Plan-and-Execute：解耦规划

> ReAct 在一个流中交错思考与行动。ReWOO 将它们分离：先制定一个大计划，然后执行。Token 使用量减少 5 倍，HotpotQA 准确率提高 4%，并且你可以将规划器蒸馏为 7B 模型。Plan-and-Execute 将其泛化；Plan-and-Act 将其扩展到网页导航。

**类型：** 构建（Build）
**语言：** Python（标准库）
**前置要求：** 阶段 14 · 01（Agent 循环）
**时长：** 约 60 分钟

## 学习目标

- 解释为什么 ReWOO 的规划器（Planner）/ 执行器（Worker）/ 求解器（Solver）分离比 ReAct 的交错循环节省 token 并提高鲁棒性。
- 实现一个计划 DAG、一个依赖有序执行器，以及一个组合工作器输出的求解器——全部使用标准库。
- 使用 2026 年"五种工作流模式"框架（Anthropic），决定任务应该作为"先计划后执行"还是交错 ReAct 运行。
- 识别何时需要 Plan-and-Act 的合成计划数据来处理长期（long-horizon）网页或移动任务。

## 问题背景

ReAct 的交错思考-行动-观察循环简单而灵活，但每次工具调用都必须携带完整的先前上下文——包括每个先前的思考。Token 使用量随深度呈二次方增长。更糟糕的是：当工具在循环中途失败时，模型必须从错误观察中重新推导整个计划。

ReWOO（Xu 等人，arXiv:2305.18323，2023 年 5 月）注意到了这一点并做出了一个赌注：提前制定整个计划，并行获取证据，最后组合答案。一次 LLM 调用用于规划，N 次工具调用用于证据（可以并行），一次 LLM 调用用于求解。权衡是灵活性较低（计划是静态的），但 token 效率更高，失败模式更清晰。

## 核心概念

### 三个角色

```
Planner:  user_question -> [plan_dag]
Workers:  [plan_dag]     -> [evidence]        (工具调用，可能并行)
Solver:   user_question, plan_dag, evidence -> final_answer
```

规划器生成一个 DAG。每个节点命名一个工具、其参数，以及它依赖的早期节点（如 `#E1`、`#E2` 的引用）。工作器按拓扑顺序执行节点。求解器将所有内容缝合在一起。

### 为什么 Token 减少 5 倍

ReAct 的提示长度随步骤数线性增长。在第 10 步，提示包含思考 1 + 行动 1 + 观察 1 + 思考 2 + 行动 2 + 观察 2，依此类推。每个中间步骤还冗余地包含原始提示。

ReWOO 支付一次规划器提示（大），N 次小工作器提示（每个只是工具调用，无链式依赖），以及一次求解器提示。论文在 HotpotQA 上测量到约 5 倍的 token 减少，同时绝对准确率提高 4%。

### 为什么更鲁棒

如果工作器 3 在 ReAct 中失败，循环必须在流中推理出错误。在 ReWOO 中，工作器 3 返回一个错误字符串；求解器在原始计划的上下文中看到它，可以优雅地降级。失败定位是按节点进行的，而不是按步骤。

### 规划器蒸馏

论文的第二个结果：因为规划器看不到观察结果，你可以在来自 175B 教师的规划器输出上对 7B 模型进行微调。小模型处理规划；推理时不需要大模型。这现在是标准做法——许多 2026 年的生产 Agent 使用小规划器和大执行器，或反之。

### Plan-and-Execute（LangChain，2023）

LangChain 团队 2023 年 8 月的帖子将 ReWOO 泛化为一个模式名称：Plan-and-Execute。前期规划器发出步骤列表，执行器运行每个步骤，可选的重新规划器可以在观察结果后修订。这比 ReWOO 更接近 ReAct（重新规划器将观察带回规划），但保留了 token 节省。

### Plan-and-Act（Erdogan 等人，arXiv:2503.09572，ICML 2025）

Plan-and-Act 将模式扩展到长期网页和移动 Agent。关键贡献是合成计划数据：标记的轨迹生成器生成计划显式的训练数据。用于微调规划器模型，使其在 WebArena 类任务上工作超过 30-50 个步骤，而单个 ReAct 轨迹会失去连贯性。

### 何时选择哪种

| 模式 | 何时使用 |
|------|---------|
| ReAct | 短任务、未知环境、需要响应式异常处理 |
| ReWOO | 具有已知工具的结构化任务、对 token 敏感、可并行化的证据 |
| Plan-and-Execute | 类似 ReWOO，但在部分执行后重新规划 |
| Plan-and-Act | 长期（>30 步）、网页/移动/计算机使用 |
| Tree of Thoughts | 搜索值得付费（第 04 课） |

Anthropic 2024 年 12 月的指导：从最简单的开始。如果任务是一个工具调用加一个摘要，不要构建 ReWOO。如果任务是 40 步的研究作业，不要单独使用 ReAct。

## 构建它

`code/main.py` 实现了一个玩具 ReWOO：

- `Planner`——一个脚本化策略，从提示发出计划 DAG。
- `Worker`——通过注册表分派每个节点的工具调用。
- `Solver`——脚本化组合，读取证据并产生最终答案。
- 依赖解析——如 `#E1` 的引用被替换为早期工作器输出。

演示回答了"法国首都的人口是多少，四舍五入到百万？"使用两步计划：（1）查找首都，（2）查找人口，然后求解。

运行它：

```
python3 code/main.py
```

轨迹首先显示完整计划，然后工作器结果，然后求解器组合。将 token 计数（我们打印一个粗略的字符计数）与 ReAct 风格的交错运行进行比较——ReWOO 在这类结构化任务上胜出。

## 使用它

LangGraph 将 Plan-and-Execute 作为配方发布（`create_react_agent` 用于 ReAct，自定义图用于计划-执行）。CrewAI 的 Flows 直接编码该模式：你提前定义任务，Flow DAG 执行它们。Plan-and-Act 的合成数据方法仍然主要是研究；运行时模式（显式计划 DAG）通过 LangGraph 和 CrewAI Flows 投入生产。

## 部署它

`outputs/skill-rewoo-planner.md` 根据给定的工具目录，从用户请求生成 ReWOO 计划 DAG。它在移交给执行器之前验证计划（无环、每个引用已解析、每个工具存在）。

## 练习

1. 为独立的计划节点并行化工作器执行。在具有 2 个并行组的 6 节点 DAG 上，它为你带来了什么？
2. 添加一个新的重新规划器节点，如果任何工作器返回错误则触发。对 ReWOO 的最小更改是什么，使其变成 Plan-and-Execute？
3. 将 `Planner` 替换为小模型（7B 级别），并将 `Solver` 保留在前沿模型上。比较端到端质量——分割在哪里失败？
4. 阅读 ReWOO 论文关于规划器蒸馏的第 4 节。从概念上重现 175B -> 7B 结果：你需要什么训练数据，以及如何评估计划质量？
5. 将玩具移植到 Plan-and-Act 的轨迹形态：计划是一个序列，而不是 DAG。什么权衡发生了变化？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| ReWOO | "无观察推理（Reasoning without observations）" | 先计划，然后并行获取证据，然后求解——规划提示中没有观察 |
| Plan-and-Execute | "LangChain 的计划-执行模式" | 带有可选重新规划器节点的 ReWOO（执行后） |
| Plan-and-Act | "扩展的计划-执行" | 显式规划器/执行器分离，带有用于长期任务的合成计划训练数据 |
| Evidence reference | "#E1、#E2、..." | 计划节点占位符，在分派时替换为先前的工作器输出 |
| Planner distillation | "小规划器，大执行器" | 在来自大型教师的规划器轨迹上对小型模型进行微调 |
| Token efficiency | "更少的往返" | 论文中相比 ReAct 在 HotpotQA 上减少 5 倍 token |
| DAG executor | "拓扑分派器" | 按依赖顺序运行计划节点；在每个级别并行 |

## 延伸阅读

- [Xu et al., ReWOO: Decoupling Reasoning from Observations (arXiv:2305.18323)](https://arxiv.org/abs/2305.18323)——规范论文
- [Erdogan et al., Plan-and-Act (arXiv:2503.09572)](https://arxiv.org/abs/2503.09572)——带有合成计划的可扩展规划器-执行器
- [LangGraph Plan-and-Execute tutorial](https://docs.langchain.com/oss/python/langgraph/overview)——框架配方
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)——选择最简单的有效模式
