# 02 · ReWOO 与 Plan-and-Execute：解耦式规划

> ReAct 把思考与行动交织在同一条流里。ReWOO 则把二者分离：先一次性给出完整规划，再去执行。在 HotpotQA 上 token 用量减少 5 倍、准确率提升 +4%，而且你可以把规划器（planner）蒸馏进一个 7B 模型。Plan-and-Execute 把它推广成了一种通用模式；Plan-and-Act 又把它扩展到了网页导航。

**类型：** 构建（Build）
**语言：** Python（标准库）
**前置：** 阶段 14 · 01（智能体循环 / Agent Loop）
**时长：** 约 60 分钟

## 学习目标

- 解释为什么 ReWOO 的规划器（Planner）/ 工作器（Worker）/ 求解器（Solver）三段式拆分，相比 ReAct 的交织式循环能节省 token 并提升鲁棒性。
- 实现一个规划 DAG（有向无环图）、一个按依赖顺序执行的执行器，以及一个组合各工作器输出的求解器——全部仅用标准库。
- 借助 2026 年「五种工作流模式」框架（Anthropic 提出），判断一个任务应当采用「先规划后执行」（plan-then-execute）还是交织式 ReAct。
- 识别在长程（long-horizon）网页或移动端任务中，何时需要 Plan-and-Act 的合成规划数据。

## 问题所在

ReAct 那种交织的「思考—行动—观察」循环简单又灵活，但每次工具调用都必须携带完整的先前上下文——包括之前的每一条思考。token 用量随深度呈二次方增长。更糟的是：当某次工具调用在循环中途失败时，模型只能从错误观察里把整个规划重新推导一遍。

ReWOO（Xu 等人，arXiv:2305.18323，2023 年 5 月）注意到了这一点，并下了一个赌注：把整件事提前规划好，并行地抓取证据，最后再组合出答案。一次 LLM 调用用于规划，N 次工具调用用于取证（可并行），一次 LLM 调用用于求解。代价是灵活性降低（规划是静态的），换来的是大幅提升的 token 效率和更清晰的失败模式。

## 核心概念

### 三种角色

```
Planner:  user_question -> [plan_dag]
Workers:  [plan_dag]     -> [evidence]        (工具调用，可能并行)
Solver:   user_question, plan_dag, evidence -> final_answer
```

规划器（Planner）产出一个 DAG。每个节点指明一个工具、它的参数，以及它依赖哪些更早的节点（用 `#E1`、`#E2` 这样的引用表示）。工作器（Workers）按拓扑顺序执行各节点。求解器（Solver）把一切拼接到一起。

### 为什么 token 少 5 倍

ReAct 的提示词长度随步数线性增长。到第 10 步时，提示词里包含思考 1 加行动 1 加观察 1，加思考 2 加行动 2 加观察 2，以此类推。而且每个中间步骤还会冗余地包含原始提示词。

ReWOO 只需要支付一次规划器提示词（很大）、N 次小型工作器提示词（每次仅含工具调用，不带推理链），以及一次求解器提示词。在 HotpotQA 上，论文测得 token 用量约少 5 倍，同时准确率提升 +4 个百分点（绝对值）。

### 为什么更鲁棒

在 ReAct 中，如果工作器 3 失败，循环必须在流的中途从错误里推理脱困。而在 ReWOO 中，工作器 3 返回一个错误字符串；求解器会在原始规划的上下文中看到它，从而可以优雅降级。失败的定位是按节点（per-node）进行的，而非按步骤（per-step）。

### 规划器蒸馏

论文的第二个结论：因为规划器看不到观察结果，你可以用一个 175B 教师模型的规划器输出来微调一个 7B 模型。小模型负责规划；推理时不再需要大模型。如今这已成标准做法——许多 2026 年的生产级智能体都采用小规划器加大执行器，或反过来。

### Plan-and-Execute（LangChain，2023）

LangChain 团队在 2023 年 8 月的文章把 ReWOO 推广成了一个模式名称：Plan-and-Execute。前置的规划器产出一个步骤列表，执行器逐步运行，一个可选的重规划器（replanner）可在观察到结果后进行修订。这比 ReWOO 更接近 ReAct（重规划器把观察结果带回到规划中），但保留了 token 的节省。

### Plan-and-Act（Erdogan 等人，arXiv:2503.09572，ICML 2025）

Plan-and-Act 把这种模式扩展到了长程的网页与移动端智能体。其关键贡献是合成规划数据（synthetic plan data）：一个带标注的轨迹生成器产出规划显式可见的训练数据。这些数据被用来微调规划器模型，使其在 WebArena 类任务上跑过 30–50 步后仍能正常工作——而单条 ReAct 轨迹在这种长度下会丧失连贯性。

### 何时选哪个

| 模式 | 适用场景 |
|---------|------|
| ReAct | 短任务、环境未知、需要反应式的异常处理 |
| ReWOO | 工具已知的结构化任务、对 token 敏感、证据可并行 |
| Plan-and-Execute | 类似 ReWOO，但在部分执行后带有重规划 |
| Plan-and-Act | 长程任务（>30 步）、网页/移动端/计算机操作 |
| Tree of Thoughts | 值得为「搜索」付出代价的场景（第 04 课） |

Anthropic 在 2024 年 12 月给出的指导：从最简单的开始。如果任务只是一次工具调用加一段摘要，就别去构建 ReWOO。如果任务是一份 40 步的研究作业，就别单用 ReAct。

## 动手构建

`code/main.py` 实现了一个玩具版 ReWOO：

- `Planner` —— 一个脚本化策略，从提示词产出规划 DAG。
- `Worker` —— 通过注册表（registry）分派每个节点的工具调用。
- `Solver` —— 脚本化的组合逻辑，读取证据并产出最终答案。
- 依赖解析 —— 像 `#E1` 这样的引用会被替换为更早的工作器输出。

这个演示回答「法国首都的人口是多少，四舍五入到百万？」，使用一个两步规划：(1) 查出首都，(2) 查出人口，然后求解。

运行它：

```
python3 code/main.py
```

这段执行轨迹会先显示完整规划，再显示工作器结果，最后显示求解器的组合过程。把它的 token 数（我们会打印一个粗略的字符计数）与 ReAct 式的交织运行做对比——在这类结构化任务上 ReWOO 占优。

## 实际运用

LangGraph 把 Plan-and-Execute 作为一个配方提供（ReAct 用 `create_react_agent`，plan-execute 用自定义图）。CrewAI 的 Flows 直接编码了这一模式：你提前定义好任务，Flow 的 DAG 负责执行它们。Plan-and-Act 的合成数据方法目前大体上仍属研究阶段；而其运行时模式（显式规划 DAG）已通过 LangGraph 和 CrewAI Flows 进入生产环境。

## 交付落地

`outputs/skill-rewoo-planner.md` 会在给定工具目录（tool catalog）的前提下，从用户请求生成一个 ReWOO 规划 DAG。它会在交给执行器之前校验规划（无环、每个引用都能解析、每个工具都存在）。

## 练习

1. 为相互独立的规划节点并行化工作器执行。在一个含 2 个并行组的 6 节点 DAG 上，这能给你带来什么收益？
2. 增加一个重规划器节点，使其在任意工作器返回错误时触发。让 ReWOO 变成 Plan-and-Execute 的最小改动是什么？
3. 把 `Planner` 换成一个小模型（7B 量级），并让 `Solver` 保持在前沿模型上。对比端到端质量——这种拆分在哪里会失效？
4. 阅读 ReWOO 论文第 4 节关于规划器蒸馏的内容。在概念层面复现 175B -> 7B 的结果：你需要什么训练数据，又如何给规划质量打分？
5. 把这个玩具移植到 Plan-and-Act 的轨迹形态：规划是一个序列，而非 DAG。哪些权衡会随之改变？

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| ReWOO | 「无观察推理」（Reasoning without observations） | 先规划，再并行抓取证据，最后求解——规划提示词里不含任何观察结果 |
| Plan-and-Execute | 「LangChain 的 plan-execute 模式」 | 带有一个可选重规划器节点（在执行后）的 ReWOO |
| Plan-and-Act | 「扩展版的 plan-execute」 | 显式的规划器/执行器拆分，配以面向长程任务的合成规划训练数据 |
| 证据引用（Evidence reference） | 「#E1、#E2、……」 | 规划节点中的占位符，分派时被替换为先前工作器的输出 |
| 规划器蒸馏（Planner distillation） | 「小规划器，大执行器」 | 用大教师模型的规划器轨迹来微调一个小模型 |
| token 效率 | 「更少的往返」 | 论文中在 HotpotQA 上比 ReAct 少 5 倍 token |
| DAG 执行器 | 「拓扑分派器」 | 按依赖顺序运行规划节点；每一层内部可并行 |

## 延伸阅读

- [Xu et al., ReWOO: Decoupling Reasoning from Observations (arXiv:2305.18323)](https://arxiv.org/abs/2305.18323) —— 经典原始论文
- [Erdogan et al., Plan-and-Act (arXiv:2503.09572)](https://arxiv.org/abs/2503.09572) —— 配以合成规划的扩展版规划器-执行器
- [LangGraph Plan-and-Execute 教程](https://docs.langchain.com/oss/python/langgraph/overview) —— 框架配方
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) —— 选择能解决问题的最简单模式
