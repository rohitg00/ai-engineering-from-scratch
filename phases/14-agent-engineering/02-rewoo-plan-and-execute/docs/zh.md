# ReWOO 与 Plan-and-Execute：解耦的规划

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> ReAct 把思考和行动交织在同一条流里。ReWOO 把它们分开：先一次性产出大计划，再去执行。在 HotpotQA 上 token 用量减少 5 倍、准确率反而 +4%，而且你可以把 planner 蒸馏到 7B 模型里。Plan-and-Execute 把它推广成一种范式；Plan-and-Act 又把它扩展到了 web 导航这种长链路场景。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop)
**Time:** ~60 minutes

## 学习目标

- 解释为什么 ReWOO 把 Planner / Worker / Solver 拆开后，比 ReAct 的交织循环更省 token、也更鲁棒。
- 实现一个 plan DAG、一个按依赖顺序调度的执行器，以及一个把 worker 输出拼起来的 solver——全部用标准库。
- 用 2026 年 Anthropic 提出的「五种工作流范式」框架，决定一个任务该走 plan-then-execute 还是交织式 ReAct。
- 识别哪些长链路 web / 移动端任务需要 Plan-and-Act 的合成 plan 数据。

## 问题（Problem）

ReAct 那种「思考-行动-观察」交织起来的循环很简单也很灵活，但每一次工具调用都得带上之前所有的上下文——包括之前每一步的思考。token 用量会随深度二次方膨胀。更糟的是：当工具在循环中途失败时，模型必须从那条错误观察里把整个计划重新推导一遍。

ReWOO（Xu et al.，arXiv:2305.18323，2023 年 5 月）注意到了这一点，于是赌了一把：先把整件事规划清楚，并行去取证据，最后再把答案拼出来。一次 LLM 调用做规划，N 次工具调用取证据（可以并行），再一次 LLM 调用做求解。代价是灵活度下降（计划是静态的），换来的是显著更好的 token 效率和更清晰的失败模式。

## 概念（Concept）

### 三种角色

```
Planner:  user_question -> [plan_dag]
Workers:  [plan_dag]     -> [evidence]        (tool calls, possibly parallel)
Solver:   user_question, plan_dag, evidence -> final_answer
```

Planner 产出一个 DAG。每个节点写明用哪个工具、传什么参数、依赖哪些更早的节点（用 `#E1`、`#E2` 这种引用）。Workers 按拓扑顺序执行节点。Solver 把所有东西拼起来。

### 为什么省 5 倍 token

ReAct 的 prompt 长度随步数线性增长。到第 10 步时，prompt 里包含 thought 1 + action 1 + observation 1 + thought 2 + action 2 + observation 2，以此类推。每个中间步骤还会重复地把原始 prompt 也带上。

ReWOO 只付出一次 planner prompt（较大）、N 次小的 worker prompt（每次只有那个工具调用，没有思维链），加一次 solver prompt。论文里在 HotpotQA 上测得 token 大约少 5 倍，同时准确率绝对值高 +4。

### 为什么更鲁棒

如果 worker 3 挂了，ReAct 必须在流的中途从错误里推理出路。而在 ReWOO 中，worker 3 返回一个错误字符串；solver 看到的是它和原始 plan 的并列上下文，可以平滑降级。失败定位是按节点的，而不是按步骤的。

### Planner 蒸馏

论文的第二个结果：因为 planner 不看 observation，你可以用一个 175B 教师模型产出的 planner 输出去微调一个 7B 模型。小模型负责规划；推理时不再需要那个大模型。这件事现在已经很标准了——2026 年很多生产环境的 agent 都是「小 planner + 大 executor」或反过来的搭配。

### Plan-and-Execute（LangChain，2023）

LangChain 团队在 2023 年 8 月那篇博文里把 ReWOO 推广成了一个范式名字：Plan-and-Execute。前置 planner 给出一个步骤列表，executor 一步步跑，再加一个可选的 replanner 在观察到结果后修订计划。它比 ReWOO 更接近 ReAct（replanner 又把 observation 带回了 planning），但保留了 token 上的节省。

### Plan-and-Act（Erdogan et al.，arXiv:2503.09572，ICML 2025）

Plan-and-Act 把这种范式扩展到了长链路 web 和移动端 agent。它的核心贡献是合成 plan 数据：一个带标注的轨迹生成器产出训练数据，里面 plan 是显式的。这些数据用来微调 planner 模型，让它在 WebArena 这类任务上跑过 30–50 步还能保持连贯——而单条 ReAct 轨迹在那种长度上早就丢失上下文了。

### 怎么挑

| Pattern | 适用场景 |
|---------|------|
| ReAct | 短任务、环境未知、需要反应式异常处理 |
| ReWOO | 结构化任务、工具已知、对 token 敏感、证据可并行 |
| Plan-and-Execute | 类似 ReWOO，但执行到一半后还要 replan |
| Plan-and-Act | 长链路（>30 步）、web / 移动端 / computer-use |
| Tree of Thoughts | 值得为搜索付额外代价的场景（Lesson 04） |

Anthropic 在 2024 年 12 月给的建议：从最简单的开始。如果任务就是一次工具调用加一段总结，不要上 ReWOO。如果任务是一个 40 步的研究作业，不要单靠 ReAct。

## 动手实现（Build It）

`code/main.py` 实现了一个玩具版 ReWOO：

- `Planner`——一个脚本化的策略，从 prompt 产出 plan DAG。
- `Worker`——通过注册表分发每个节点的工具调用。
- `Solver`——脚本化的拼接逻辑，读取证据后生成最终答案。
- 依赖解析——`#E1` 这种引用会被替换成更早 worker 的输出。

这个 demo 用一个两步计划回答「法国首都的人口约为多少百万？」：(1) 查首都，(2) 查人口，然后求解。

跑起来：

```
python3 code/main.py
```

trace 会先显示完整的 plan，然后是 worker 结果，再然后是 solver 的拼接过程。把 token 数（我们打印了一个粗略的字符计数）和 ReAct 风格的交织运行做对比——在这种结构化任务上 ReWOO 是赢的。

## 用起来（Use It）

LangGraph 把 Plan-and-Execute 作为一个 recipe 出货（ReAct 用 `create_react_agent`，plan-execute 用自定义 graph）。CrewAI 的 Flows 直接把这个范式编码进去了：你预先定义任务，Flow DAG 来执行。Plan-and-Act 的合成数据方法目前还主要停留在研究阶段；但运行时范式（显式 plan DAG）已经通过 LangGraph 和 CrewAI Flows 进了生产。

## 上线部署（Ship It）

`outputs/skill-rewoo-planner.md` 在给定工具目录的情况下，从用户请求生成一个 ReWOO plan DAG。它在交给 executor 之前会校验 plan（无环、每个引用都解析得到、每个工具都存在）。

## 练习

1. 让独立的 plan 节点并行执行。在一个 6 节点、有 2 个并行组的 DAG 上，这能给你换来什么？
2. 加一个 replanner 节点，只要任意 worker 返回错误就触发它。能让 ReWOO 变成 Plan-and-Execute 的最小改动是什么？
3. 把 `Planner` 换成一个小模型（7B 量级），保持 `Solver` 用前沿模型。比较端到端质量——这种拆分在哪里会失败？
4. 读 ReWOO 论文第 4 节关于 planner 蒸馏的内容。在概念层面复现 175B -> 7B 的结果：你需要什么训练数据？怎么给 plan 质量打分？
5. 把这个玩具版迁移成 Plan-and-Act 的轨迹形态：plan 是一条序列而不是 DAG。哪些权衡会改变？

## 关键术语

| 术语 | 大家常这么说 | 实际意思 |
|------|----------------|------------------------|
| ReWOO | "Reasoning without observations" | 先规划，再并行取证据，最后求解——规划 prompt 里没有 observation |
| Plan-and-Execute | "LangChain 的 plan-execute 范式" | ReWOO 加上一个可选的 replanner 节点（在执行后） |
| Plan-and-Act | "扩大版 plan-execute" | 显式的 planner / executor 拆分，配上为长链路任务训练 planner 用的合成 plan 数据 |
| Evidence reference | "#E1, #E2, ..." | plan 节点里的占位符，分发时被替换为之前 worker 的输出 |
| Planner 蒸馏 | "小 planner，大 executor" | 用大教师模型的 planner 轨迹微调一个小模型 |
| Token 效率 | "round trip 更少" | 论文里在 HotpotQA 上比 ReAct 少 5 倍 token |
| DAG executor | "拓扑调度器" | 按依赖顺序跑 plan 节点；同一层可以并行 |

## 参考资料

- [Xu et al., ReWOO: Decoupling Reasoning from Observations (arXiv:2305.18323)](https://arxiv.org/abs/2305.18323) — 经典论文
- [Erdogan et al., Plan-and-Act (arXiv:2503.09572)](https://arxiv.org/abs/2503.09572) — 用合成 plan 扩展的 planner-executor
- [LangGraph Plan-and-Execute tutorial](https://docs.langchain.com/oss/python/langgraph/overview) — 框架级 recipe
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — 选最简单能跑通的范式
