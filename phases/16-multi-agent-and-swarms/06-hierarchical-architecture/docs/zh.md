# 层级架构及其失效模式（Hierarchical Architecture and Its Failure Mode）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 层级（hierarchical）就是 supervisor 套娃：经理 agent 之上还有经理，经理之下还有经理，最后才是干活的 worker。CrewAI 的 `Process.hierarchical` 是教科书版本：一个 `manager_llm` 动态分派任务并校验输出。LangGraph 的对应物是 `create_supervisor(create_supervisor(...))`。当任务真的就是一张组织架构图时，这是最自然的模式；同时，它也是最容易塌缩成「经理 loop」的模式——经理 agent 把活分错、误读 sub-output、谈不拢共识。很多时候 sequential（顺序流水线）反而更香。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:**（前置）Phase 16 · 05（Supervisor Pattern）
**Time:** ~60 minutes

## 问题（Problem）

一旦 supervisor 模式吃透，下一个自然的念头就是「那如果 worker 自己也是 supervisor 呢？」团队下面有子团队；公司下面有部门下面还有部门。层级架构正好对应这种结构。

问题在于：LLM 经理和人类经理不是一回事。人类经理对下属知道什么有稳定的先验。LLM 经理则是每一回合都要从 context 里重新推断这棵组织树。context 稍有漂移，整棵树就把活分错了。

## 概念（Concept）

### 形态（The shape）

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

每个内部节点都在做规划、分派、汇总。只有叶子节点真正干活。

### 它什么时候好用（Where it shines）

- **组织映射清晰。** 如果真实任务就是分部门做（「法务审一遍这份文档、财务审一遍、工程审一遍，最后给高管一份总结」），那这棵层级树就是显式的。
- **本地汇总。** 每个 sub-manager 在顶层经理看到结果之前，先把它那一队的输出做汇总。顶层经理看到的是三份 sub-manager 的总结，而不是十五份 worker 的输出。

### 它什么时候崩（Where it breaks）

2026 年的事故复盘里反复出现的三种失效模式：

1. **任务分派错误（task assignment error）。** 经理读了目标，hallucinate（幻觉）出一份分解方案，然后把活派给了错的 sub-manager。因为 sub-manager 老老实实地按收到的活去做，错误只会在最顶层做汇总时才暴露——离人类本来可以拦截的位置已经隔了一层。
2. **输出误读（output misinterpretation）。** Sub-manager 返回「无法验证主张 X」。顶层经理把它总结成「主张 X 未确认」。每过一层，意思就漂一点。
3. **共识 loop（consensus loop）。** 两个 sub-manager 意见不合；顶层经理让它们去对齐；它们又把活下派；worker 重跑；sub-manager 给回略有不同的答案；如此循环。CrewAI 的 `Process.hierarchical` 用步数上限来挡这个，但这个上限本身现在又成了一个超参数。

### 关键判断题（The deciding question）

Sequential（线性流水线）vs hierarchical：你的任务真的有独立的子团队，还是说本质上就是一条线性流程，硬被掰成了一棵树？如果是后者，用 sequential。如果是前者，用 hierarchical，但要预先留出明确的对齐预算。

### CrewAI 的实现（CrewAI's implementation）

`Process.hierarchical` 在若干专家 crew 之上接一个经理 LLM。经理负责：

- 接收顶层任务，
- 把子任务分派给 crew，
- 评估 crew 的输出，
- 决定接受、重新分派，还是再迭代一轮。

文档：https://docs.crewai.com/en/introduction （在 Core Concepts 下找 "Hierarchical Process"）。

### LangGraph 的实现（LangGraph's implementation）

LangGraph 用嵌套的 `create_supervisor` 调用。内层的 supervisor 有它自己的图；外层的 supervisor 把内层的图当作一个不透明节点。这种方式调试起来比 CrewAI 更干净（你可以分别 step through 每张图），但要表达对树的动态重塑就没那么顺手。

参考：https://reference.langchain.com/python/langgraph-supervisor 。

## 动手实现（Build It）

`code/main.py` 跑一棵三层的层级树：

- 顶层经理：把任务拆成「engineering」和「legal」两支，
- engineering sub-manager：再拆成「frontend」和「backend」两个 worker，
- legal sub-manager：一个 worker。

Demo 把 happy path（大家都同意）和**扰动路径（perturbed path）**做对比——在扰动路径里，顶层经理的分解把「legal」误标成了「finance」，然后我们看着这个错误一路级联：sub-manager 老老实实地做了 finance 的活，顶层 synthesizer 汇报的是 finance 的发现，而最初的 legal 问题没人回答。

运行：

```
python3 code/main.py
```

输出会把两条路径并排展示，「问的是什么」vs「交付的是什么」一目了然。

## 用起来（Use It）

`outputs/skill-hierarchy-fitness.md` 用来评估一个给定任务到底该用 hierarchical、sequential 还是扁平的 supervisor。输入：任务描述、组织结构、对齐预算。输出：模式推荐，并指出需要重点防御的具体失效模式。

## 上线部署（Ship It）

如果你真要上 hierarchical：

- **树深限制在 2 层。** 三层就已经把大多数错误藏在 observability（可观测性）之外了。
- **显式的对齐预算。** 在顶层经理必须拍板之前，设好最大轮次。一般是 2。
- **每一次汇总都带 provenance（出处链）。** 每个节点的总结必须能引用是哪些叶子输出产出了它。
- **对分解漂移（decomposition drift）报警。** 把经理每一步的分解都打 log；和用户的原始 query 做 diff。一旦分解不再覆盖原 query，就触发告警。

## 练习（Exercises）

1. 跑一遍 `code/main.py`，对比 happy 和 perturbed。要经过多少层经理交接（hand-off），顶层输出才会和用户原问题完全跑偏？
2. 加上第三层（top → sub → sub-sub → worker）。随着深度增加，扰动路径自我纠正 vs 完全跑偏的频率怎么变？
3. 在每个 sub-manager 那里实现一个「金丝雀（canary）」worker：始终原封不动地被问用户的原始问题。用金丝雀的回答来检测分解漂移。当金丝雀的回答和汇总后的回答不一致时，经理应该怎么应对？
4. 读 CrewAI 的 `Process.hierarchical` 文档。挑一条 CrewAI 应用的具体 guardrail（护栏，比如步数上限、`manager_llm` 约束），描述它瞄准的是哪种失效模式。
5. 对比嵌套 LangGraph supervisor 和 CrewAI hierarchical：哪种让对齐 loop 更便宜地被检测出来？

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 它实际是什么 |
|------|----------------|------------------------|
| Hierarchical（层级） | 「组织架构图模式」 | supervisor 之上还有 supervisor；只有叶子干活。 |
| Manager LLM（经理 LLM） | 「老板」 | 在某个内部节点上做分解、分派、校验的那个 LLM。 |
| Decomposition drift（分解漂移） | 「老板跑偏了」 | 顶层经理的拆分不再覆盖原始问题。 |
| Reconciliation loop（对齐 loop） | 「开不完的会」 | sub-manager 意见不一；顶层重新下派；worker 重跑；直到预算耗尽。 |
| Depth-2 ceiling（两层封顶） | 「别超过两层」 | 经验性 guardrail：三层及以上 observability 就崩了。 |
| Canary question（金丝雀问题） | 「每一层都留个 ground truth」 | 一个始终被原封不动问原始 query 的 worker，用来检测漂移。 |
| Provenance chain（出处链） | 「谁说了什么」 | 从每一份汇总往回追踪到产出它的叶子输出。 |

## 延伸阅读（Further Reading）

- [CrewAI introduction — Process.hierarchical](https://docs.crewai.com/en/introduction) — 教科书式的 hierarchical，配一个经理 LLM
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) — 通过 `create_supervisor` 实现嵌套 supervisor
- [Anthropic engineering — Research system](https://www.anthropic.com/engineering/multi-agent-research-system) — Anthropic 为何刻意选了扁平 supervisor 而非 hierarchical
- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) — MAST 分类法；协调失效那一节记录了分解漂移
