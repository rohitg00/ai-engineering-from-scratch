# Supervisor / Orchestrator-Worker 模式

> 一个主控 agent 负责规划和委派；专用 worker 在并行的上下文中执行任务并汇报结果。这就是 Anthropic Research 系统（Claude Opus 4 作为主控，Sonnet 4 作为子 agent）背后的模式，在内部研究评测中比单 agent Opus 4 高出 90.2%。Anthropic 的工程文章指出，BrowseComp 上 80% 的方差仅由 token 使用量解释——多 agent 之所以胜出，主要是因为每个子 agent 都获得一个全新的上下文窗口。本课从基础原语出发构建 supervisor 模式，并涵盖来自生产部署的 2026 年工程经验。

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`)
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~75 分钟

## 问题

研究是单 agent 系统失败的典型任务。你问“2023 到 2026 年间多 agent 系统发生了什么变化？”一个单 agent 会按顺序阅读五篇论文，用它们的文本填满一半上下文，然后还必须对它们进行整体推理。当它读到第五篇时，早已忘记第一篇的内容。它也无法并行化。

supervisor 模式解决了这个问题：一个主控 agent 规划搜索，把每个子问题委派给一个 worker，然后进行综合。每个 worker 获得自己独立的 200k token 窗口来处理一个狭窄的问题。主控从不阅读原始论文——只看 worker 的摘要。

Anthropic 的生产级 Research 系统在内部研究评测中报告，相比单个 Opus 4 提升了 90.2%。同一篇文章指出，BrowseComp 方差的 80% 仅由 *token 使用量* 解释。每个子 agent 的全新上下文是主要机制。

## 概念

### 该模式

```
                 ┌──────────────┐
                 │   Lead       │  plans, decomposes,
                 │  (Opus 4)    │  synthesizes
                 └──┬────┬───┬──┘
                    │    │   │
            ┌───────┘    │   └───────┐
            ▼            ▼           ▼
      ┌─────────┐  ┌─────────┐  ┌─────────┐
      │ Worker1 │  │ Worker2 │  │ Worker3 │
      │(Sonnet) │  │(Sonnet) │  │(Sonnet) │
      └─────────┘  └─────────┘  └─────────┘
         fresh       fresh        fresh
         context     context      context
```

主控从不阅读原始材料。worker 之间彼此看不到对方的工作，直到主控进行综合。每条箭头都是一次带有狭窄产物的交接。

### 为什么它有效

三个机制：

1. **每个子 agent 拥有全新上下文。** 一个探索“FIPA-ACL 源流”的 worker 不会携带主控规划时消耗的 40k token。它获得一个 200k 的窗口来处理单一问题。
2. **通过 prompt 实现专业化。** 主控的 prompt 是“分解与综合”，而不是“研究”。每个 worker 的 prompt 都很狭窄：“找出 X 发生了什么变化。”聚焦的 prompt 产生聚焦的输出。
3. **并行性。** worker 并发运行。墙钟时间大约是 `max(worker_times) + plan + synthesis`，而不是 `sum(worker_times)`。

### 工程经验（Anthropic 2025）

Anthropic 的文章列出了若干生产经验，在 2026 年仍然适用：

- **投入与查询复杂度相匹配。** 简单查询：一个 agent，3-10 次工具调用。复杂查询：10 个以上 agent。必须由主控来估计这一点，而不是调用者。
- **先宽后窄。** 先分解为宽泛的子问题，如果答案需要更深入，再为每个子问题生成更多 worker。
- **Rainbow 部署。** agent 是长时运行且有状态的。传统的蓝绿部署行不通。Anthropic 使用 rainbow 方式：新版本逐步上线，旧版本逐步排空。
- **Token 使用量主导一切。** 多 agent 的 token 用量约为单 agent 的 15 倍。只有当任务价值能证明成本合理时才使用它。

### 图原生转向

LangGraph 最初发布了一个 `langgraph-supervisor` 库，带有高级的 `create_supervisor` 辅助函数。2025 年，LangChain 将推荐做法改为通过工具调用直接实现 supervisor 模式，因为工具调用可以对 *supervisor 所看到的内容* 提供更多控制（上下文工程）。旧库仍然可用；文档现在推荐工具调用形式。

### 失败模式

- **主控幻觉出错误的计划。** 如果主控生成的子问题没有真正分解原始问题，worker 就会对错误的目标进行精确研究。
- **Worker 过度探索。** 缺乏明确的范围边界时，worker 会漂移到其被分配的子问题之外，污染综合步骤。
- **综合冲突。** 两个 worker 返回相互矛盾的事实。主控必须要么重新提问（增加一轮），要么明确标注分歧。静默地选择一方是最糟糕的失败：用户永远不会知道发生过分歧。

### 何时 supervisor 是错误的选�择

- **顺序任务。** 如果步骤 2 确实需要步骤 1 的输出，并行化毫无收益。使用流水线（CrewAI Sequential、LangGraph 线性图）。
- **简单查询。** 单 agent 处理它们更快、更便宜。在生成 worker 之前先使用主控的“投入匹配”检查。
- **严格确定性。** Supervisor 依赖 LLM 选择的委派。当审计/重放比适应性更重要时，静态图更好。

```figure
supervisor-hierarchy
```

## 动手构建

`code/main.py` 使用 `threading` 实现了一个由三个并行 worker 组成的 supervisor。主控将一个查询分解为子问题，worker 在每个子问题上并发运行，主控进行综合。没有真实的 LLM——worker 由脚本编写，用于模拟抓取并摘要。

关键结构：

- `Lead.plan(query)` 将一个查询拆分为 3 个子问题。
- `Worker.run(sub_q)` 返回一个伪造的摘要（在生产中可以是任何使用工具的 agent）。
- `Lead.run(query)` 在线程中启动 worker、join，然后进行综合。

运行：

```
python3 code/main.py
```

输出显示计划、带开始/结束时间戳的并行 worker 轨迹，以及最终的综合。你可以看到墙钟时间的收益：三个 0.3 秒的 worker 在约 0.35 秒内完成，而不是 0.9 秒。

## 使用它

`outputs/skill-supervisor-designer.md` 接收一个用户查询并生成一个 supervisor 模式设计：主控系统 prompt、worker 角色、子问题分解规则以及综合模板。在构建新的研究类 agent 系统之前先使用它。

## 上线它

部署 supervisor 模式之前的检查清单：

- **模型配对。** 主控使用推理层级的模型（Opus 级、`o3` 级）。Worker 使用更快、更便宜的模型（Sonnet、`o4-mini`）。
- **Worker 超时。** 任何超过中位运行时间 2 倍的 worker 会被终止；主控要么以更窄的范围重新生成，要么在没有它的情况下继续。
- **每个 worker 的 token 上限。** 硬性限制（比如预期综合输入的 10 倍）可防止失控的 worker 撑爆预算。
- **可观测性。** 追踪主控的计划、每个 worker 的工具调用以及综合过程。这是任何事后调试的基础。
- **Rainbow 灰度发布。** 有状态的长时运行 agent 需要渐进式版本过渡，而不是热切换。

## 练习

1. 运行 `code/main.py`，然后修改主控使其生成 5 个 worker 而不是 3 个。观察墙钟时间的影响。在此演示中，当 worker 数量为多少时，生成开销超过并行节省的时间？
2. 实现 worker 超时：终止任何运行超过 0.5 秒的 worker，并让主控综合剩余结果。你需要什么样的可观测性才能知道某个 worker 被切断了？
3. 在主控的综合中添加一个冲突检测步骤：如果两个 worker 返回相互矛盾的答案，主控应标注分歧而不是选择其中之一。如何在不调用 LLM 的情况下检测矛盾？
4. 阅读 Anthropic 关于 Research 系统的工程文章。列出这个玩具演示要在生产中运行需要采用的三个实践。
5. 比较 LangGraph 的 `create_supervisor`（旧版）与新的工具调用推荐。哪一种对 supervisor 所看到的内容提供更好的控制？为什么 Anthropic 明确只传入子答案而不传入 worker 的原始上下文进行综合？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|------------------------|------------------------|
| Supervisor | “主控 agent” | 一个负责规划、委派和综合的编排 agent。本身不做具体工作。 |
| Worker | “子 agent” | 由 supervisor 调用的聚焦 agent，范围狭窄并拥有自己的上下文窗口。 |
| Orchestrator-worker | “Supervisor 模式” | 同一个东西，不同的名字。2026 年的文献中两者都有使用。 |
| Fresh context | “干净窗口” | worker 的上下文从其系统 prompt 和被分配的问题开始，而不是主控的历史。 |
| Rainbow deployment | “渐进式发布” | 长时运行的有状态 agent 需要带版本的排空替换，而不是蓝绿部署。 |
| Token dominance | “上下文是关键变量” | 据 Anthropic，研究评测中 80% 的方差来自总 token 使用量，而非模型选择。 |
| Scale effort | “让 agent 数量与复杂度匹配” | 主控估计查询难度，相应地生成 1 个或 10 个以上 worker。 |
| Synthesis conflict | “worker 之间有分歧” | 两个 worker 返回相互矛盾的事实；主控必须呈现分歧，而不是静默选择其一。 |

## 延伸阅读

- [Anthropic engineering — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — supervisor 模式的生产参考
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — 工具调用 supervisor 现在是推荐形式
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) — 旧版辅助函数，2026 年生产中仍在使用
- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) — 基于交接的 supervisor 变体