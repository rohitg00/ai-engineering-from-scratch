# 分层架构及其失效模式

> 分层即主管嵌套。Manager agent 管理子 manager，子 manager 管理 worker。CrewAI `Process.hierarchical` 是教科书式的实现：一个 `manager_llm` 动态分配任务并校验输出。LangGraph 中的等价实现是 `create_supervisor(create_supervisor(...))`。当任务本身就是真实的组织架构图时，这是最自然的模式。它也是最可能退化为管理层循环的模式——manager agent 分配任务不当、误解子输出，或无法达成共识。顺序模式往往更优。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** 第 16 阶段 · 05（Supervisor 模式）
**Time:** ~60 分钟

## 问题

一旦理解了 supervisor 模式，自然的下一步就是："如果 worker 本身也是 supervisor 会怎样？"团队有子团队；公司有部门的部门。分层架构正是对这种结构的映射。

问题在于：LLM 经理并不等于人类经理。人类经理对下属知道什么有稳定的先验判断。LLM 经理则在每一轮根据上下文中的内容重新推理整个组织结构。上下文中的微小偏差，就会导致整个树状结构错误分配工作。

## 概念

### 结构形态

```
                 Manager
                 ┌─────┐
                 └──┬──┘
           ┌────────┴────────┐
           ▼                 ▼
       Sub-Mgr A         Sub-Mgr B
       ┌─────┐           ┌─────┐
       └──┬──┘           └──┬──┘
         ┌┴──┬──┐          ┌┴──┐
         ▼   ▼  ▼          ▼   ▼
       W1  W2  W3         W4  W5
```

每个内部节点负责规划、分配和综合。只有叶子节点执行实际工作。

### 适用场景

- **清晰的组织映射。** 如果真实任务本身就是按部门划分的（"法务审阅文档，财务审阅文档，工程审阅文档，然后汇总给高管"），那么层级结构是显式的。
- **局部汇总。** 每个子 manager 在顶层 manager 看到之前，先综合其团队的输出。顶层 manager 看到的是三份子 manager 摘要，而不是十五份 worker 输出。

### 失效场景

2026 年的事后分析中反复发现的三种失效模式：

1. **任务分配错误。** manager 读取目标，幻觉出一个任务分解，并把任务分配给错误的子 manager。由于子 manager 会顺从地执行分配给它的任务，这个错误只会在顶层综合时才浮现——距离人类本可发现它的地方隔了一层。
2. **输出误读。** 子 manager 返回"无法验证论断 X"。顶层 manager 摘要为"论断 X 未确认"。含义在每一层都发生漂移。
3. **共识循环。** 两个子 manager 意见不一致；顶层 manager 要求它们调和；它们向下重新分配任务；worker 重新运行；子 manager 返回略有不同的答案；循环。CrewAI 的 `Process.hierarchical` 通过步数限制来防范这种情况，但这个限制本身现在成了一个超参数。

### 决定性问题

顺序（线性流水线）与分层的对比：你的任务是否真的有独立的子团队，还是只是一条假装成树状结构的线性流程？如果是后者，使用顺序模式。如果是前者，可以使用分层模式，但要预留显式的调和规则预算。

### 角色框架实现

CrewAI 的 `Process.hierarchical` 在专家团队之上接一个 manager LLM。该 manager：

- 接收顶层任务，
- 将子任务分配给各个 crew，
- 评估 crew 的输出，
- 决定接受、重新分配还是迭代。

文档：https://docs.crewai.com/en/introduction（在 Core Concepts 下查找"Hierarchical Process"）。

### 图框架实现

LangGraph 使用嵌套的 `create_supervisor` 调用。内层 supervisor 拥有自己的图；外层 supervisor 将内层图视为一个不透明节点。这比 CrewAI 更易于调试（可以分别单步调试每个图），但更难表达对树状结构的动态重塑。

参考：https://reference.langchain.com/python/langgraph-supervisor.

```figure
swarm-hierarchy-token
```

## 动手构建

`code/main.py` 运行一个 3 层级结构：

- 顶层 manager：将任务拆分为"工程"和"法务"两个分支，
- 工程子 manager：拆分为"前端"和"后端" worker，
- 法务子 manager：一个 worker。

演示对比了正常路径（所有人都一致）与一条**扰动路径**：顶层 manager 的任务分解将"法务"误标为"财务"，然后观察错误的级联——子 manager 顺从地做了财务工作，顶层综合器报告了财务结论，而最初的法务问题无人回答。

运行：

```
python3 code/main.py
```

输出同时展示两条路径，并清晰并排对比"被要求做什么"与"实际交付了什么"。

## 使用

`outputs/skill-hierarchy-fitness.md` 评估给定任务应使用分层、顺序还是扁平 supervisor 模式。输入：任务描述、组织结构、调和预算。输出：模式推荐以及需要防范的具体失效模式。

## 上线

如果要上线分层模式：

- **将树深度限制在 2 层。** 三层已经会让大多数错误脱离可观测范围。
- **显式调和预算。** 在顶层 manager 必须提交结论之前设定最大轮数。通常为 2。
- **每次综合都带溯源。** 每个节点的摘要必须注明由哪些叶子输出生成。
- **对分解漂移告警。** 记录 manager 每一步的分解结果；与用户查询做 diff。如果分解不再覆盖该查询，触发告警。

## 练习

1. 运行 `code/main.py` 并对比正常路径与扰动路径。经过多少层 manager 交接后，顶层输出才与用户问题完全偏离？
2. 增加第三层（顶层 → 子 → 子子 → worker）。测量随着深度增长，扰动路径自我纠正与完全偏离的频率对比。
3. 在每个子 manager 下实现一个"金丝雀" worker，始终用未经修改的原始用户问题询问它。利用金丝雀答案检测分解漂移。当金丝雀答案与综合答案不一致时，manager 应如何反应？
4. 阅读 CrewAI 的 `Process.hierarchical` 文档。找出 CrewAI 应用的一个具体防护措施（步数限制、manager_llm 约束），并描述它针对的失效模式。
5. 对比嵌套 LangGraph supervisor 与 CrewAI 分层模式。哪种方式更容易检测到调和循环？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|------------------------|------------------------|
| 分层 | "组织架构图模式" | Supervisor 套 supervisor；只有叶子节点执行工作。 |
| Manager LLM | "老板" | 在内部节点进行分解、分配和校验的 LLM。 |
| 分解漂移 | "老板跑题了" | 顶层 manager 的拆分不再覆盖原始问题。 |
| 调和循环 | "没完没了的会议" | 子 manager 意见不一致；顶层重新分配；worker 重新运行；循环直到预算耗尽。 |
| 深度-2 上限 | "不要超过 2 层" | 经验性防护：3 层及以上会使可观测性崩溃。 |
| 金丝雀问题 | "每一层的基准真相" | 始终被问原始问题（未经修改）的 worker，用于检测漂移。 |
| 溯源链 | "谁说了什么" | 从每次综合回溯到生成它的叶子输出的追踪链。 |

## 延伸阅读

- [CrewAI 介绍 — Process.hierarchical](https://docs.crewai.com/en/introduction) — 带有 manager LLM 的教科书式分层模式
- [LangGraph supervisor 参考](https://reference.langchain.com/python/langgraph-supervisor) — 通过 `create_supervisor` 实现的嵌套 supervisor
- [Anthropic 工程博客 — Research 系统](https://www.anthropic.com/engineering/multi-agent-research-system) — Anthropic 为何刻意选择扁平 supervisor 而非分层模式
- [Cemri 等 — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) — MAST 分类法；其中关于协调失效的章节记录了分解漂移