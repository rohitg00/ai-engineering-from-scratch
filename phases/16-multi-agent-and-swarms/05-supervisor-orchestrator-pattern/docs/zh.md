# Supervisor / Orchestrator-Worker 模式

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 一个 lead agent 负责规划与分派；专精的 worker 在各自并行的 context 里执行，再把结果汇报回来。这就是 Anthropic Research 系统背后的模式（Claude Opus 4 当 lead，Sonnet 4 当 subagent），在内部 research 评测上比单 agent Opus 4 高 +90.2%。Anthropic 的工程博客指出，BrowseComp 上 80% 的方差仅由 token 用量解释——multi-agent 之所以赢，主要是因为每个 subagent 都拿到一份新鲜的 context window。本节课从原语出发搭建 supervisor 模式，并讲透 2026 年从生产部署里沉淀下来的工程教训。

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`)
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~75 minutes

## 问题（Problem）

Research 是单 agent 系统典型会翻车的任务。你问："2023 到 2026 之间 multi-agent 系统有什么变化？" 单个 agent 顺序读完 5 篇论文，把它们的正文塞满半个 context，然后还得对所有论文一起做推理。等读到第 5 篇，它已经忘了第 1 篇。它没法并行。

Supervisor 模式正好补上：一个 lead agent 规划检索方案，把每个子问题分派给 worker，再做综合。每个 worker 拿到自己 200k token 的窗口去对付一个窄问题。Lead 自己从不去看原始论文——只看 worker 的摘要。

Anthropic 生产环境的 Research 系统在内部 research 评测上比单 Opus 4 高 +90.2%。同一篇博客指出，BrowseComp 上 80% 的方差仅由 *token 用量* 解释。每个 subagent 都拿到新鲜 context，是主要机制。

## 概念（Concept）

### 这个模式（The pattern）

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

Lead 从不读原始材料。Worker 之间也彼此看不到对方的工作，直到 lead 做综合。每根箭头都是一次 handoff（交接包），承载一个窄的产物。

### 它为什么赢（Why it wins）

三个机制：

1. **每个 subagent 拿到新鲜 context（Fresh context per subagent）。** 一个去查 "FIPA-ACL 渊源" 的 worker，并不会带着 lead 规划阶段花掉的那 40k token。它对一个问题独享一个 200k 窗口。
2. **靠 prompt 做专精（Specialization via prompt）。** Lead 的 prompt 是 "拆解和综合"，不是 "做研究"。每个 worker 的 prompt 都很窄："找出 X 上发生了什么变化"。聚焦的 prompt 产出聚焦的输出。
3. **并行（Parallelism）。** Worker 并发跑。Wall-clock 时间大致是 `max(worker_times) + plan + synthesis`，而不是 `sum(worker_times)`。

### 工程教训（Engineering lessons，Anthropic 2025）

Anthropic 那篇博客列出了好几条到 2026 年仍然适用的生产教训：

- **按查询复杂度配资源（Scale effort to query complexity）。** 简单查询：一个 agent，3-10 次 tool call。复杂查询：10+ 个 agent。这个估计要由 lead 来做，不是调用方。
- **先广后窄（Broad then narrow）。** 先把问题拆成几个宽的子问题，如果某个子问题的答案值得深挖，再为它额外派 worker。
- **Rainbow 部署（Rainbow deployments）。** Agent 是长时运行且有状态的。传统的蓝绿部署不行。Anthropic 用 rainbow：新版本逐步铺开，老版本慢慢排空。
- **Token 用量主导一切（Token usage dominates）。** Multi-agent 的 token 用量大约是单 agent 的 15×。只在任务价值能覆盖成本时才用。

### LangGraph 的转向（The LangGraph turn）

LangGraph 最初发布的 `langgraph-supervisor` 库带一个高层的 `create_supervisor` helper。2025 年 LangChain 把推荐姿势改成了直接用 tool-calling 实现 supervisor 模式，因为 tool call 能更精细地控制 *supervisor 看见什么*（context engineering）。库还能用；文档现在推荐的是 tool-calling 形式。

### 失败模式（The failure modes）

- **Lead 把 plan 幻觉出来了。** 如果 lead 生成的子问题并没有真正拆开原问题，那 worker 就会精确地在错误的目标上做研究。
- **Worker 越界探索（over-explore）。** 没有显式的 scope 边界，worker 会跑到分配给自己的子问题之外，把综合阶段污染掉。
- **综合冲突（Synthesis conflicts）。** 两个 worker 返回相互矛盾的事实。Lead 要么再问一轮（多加一轮），要么显式标注分歧。最糟糕的失败是 lead 悄悄选了一边——用户根本不知道发生了分歧。

### Supervisor 不该用的时候（When supervisor is wrong）

- **顺序型任务（Sequential tasks）。** 如果第 2 步真的需要第 1 步的输出，并行带不来任何收益。改用 pipeline（CrewAI Sequential、LangGraph 线性图）。
- **简单查询（Simple queries）。** 单 agent 又快又便宜。在派 worker 之前，先让 lead 跑一下 "scale effort" 检查。
- **严格确定性（Strict determinism）。** Supervisor 靠 LLM 选择分派目标。当审计 / 回放比适应性更重要时，静态图更合适。

## 动手实现（Build It）

`code/main.py` 用 `threading` 实现了一个带三个并行 worker 的 supervisor。Lead 把一个 query 拆成几个子问题，worker 在每个子问题上并发执行，然后 lead 做综合。没有真正调用 LLM——worker 用脚本模拟 fetch-and-summarize。

关键结构：

- `Lead.plan(query)` 把一个 query 切成 3 个子问题。
- `Worker.run(sub_q)` 返回一段假的摘要（在生产环境里可以是任何使用工具的 agent）。
- `Lead.run(query)` 用线程拉起 worker，join，做综合。

运行：

```
python3 code/main.py
```

输出会展示 plan、并行 worker 的轨迹（带起止时间戳）以及最终的综合结果。你能看到 wall-clock 上的收益：三个耗时 0.3 秒的 worker 在大约 0.35 秒内跑完，而不是 0.9 秒。

## 用起来（Use It）

`outputs/skill-supervisor-designer.md` 接受一个用户 query，输出一份 supervisor 模式的设计：lead 的 system prompt、worker 角色、子问题拆解规则，以及综合环节的模板。在你新搭一套 research 风格的 agent 系统之前，先用这个走一遍。

## 上线部署（Ship It）

部署 supervisor 模式之前的清单：

- **模型搭配（Model pairing）。** Lead 用推理档位的模型（Opus 档位、`o3` 档位）。Worker 用更快更便宜的模型（Sonnet、`o4-mini`）。
- **Worker 超时（Worker timeout）。** 任何超过中位运行时长 2× 的 worker 都会被 kill；lead 要么用更窄的 scope 重新派一个，要么不带它直接往下走。
- **每个 worker 的 token 上限（Token cap per worker）。** 设硬上限（比如预期综合输入的 10×），防止失控的 worker 把预算打爆。
- **可观测性（Observability）。** 把 lead 的 plan、每个 worker 的 tool call 以及综合环节都 trace 起来。这是事后调试的基础。
- **Rainbow 灰度（Rainbow rollout）。** 长时运行、有状态的 agent 需要逐步换版本，而不是热切换。

## 练习（Exercises）

1. 跑一下 `code/main.py`，然后改 lead，让它派 5 个 worker 而不是 3 个。观察 wall-clock 的影响。在这个 demo 里，worker 数量到几个时，spawn 的开销就会超过并行带来的节省？
2. 实现 worker 超时：kill 任何运行超过 0.5 秒的 worker，让 lead 用剩下的结果做综合。你需要哪些可观测性，才能知道某个 worker 被切掉了？
3. 在 lead 的综合环节加一个冲突检测：如果两个 worker 返回相互矛盾的答案，lead 应当标注分歧而不是挑一个。怎样在不调用 LLM 的情况下检测矛盾？
4. 读 Anthropic 那篇 Research 系统的工程博客。列出 3 条这个玩具 demo 想跑生产就必须采纳的实践。
5. 比较 LangGraph 的 `create_supervisor`（旧）和新的 tool-calling 推荐姿势。哪个能让你更好地控制 supervisor 看见什么？为什么 Anthropic 明确只把子答案而不是 worker 的原始 context 传进综合环节？

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Supervisor | "Lead agent" | 负责规划、分派、综合的协调 agent。自己不做实际工作。 |
| Worker | "Subagent" | 由 supervisor 调用的聚焦 agent，scope 很窄，并拥有自己的 context window。 |
| Orchestrator-worker | "Supervisor pattern" | 同一件事的不同名字。2026 年的文献两种叫法都在用。 |
| Fresh context | "Clean window" | Worker 的 context 从它自己的 system prompt 和被分配的问题开始，不带 lead 的历史。 |
| Rainbow deployment | "Gradual rollout" | 长时运行、有状态的 agent 需要带版本的 drain-and-replace，而不是蓝绿。 |
| Token dominance | "Context is the variable" | 据 Anthropic，research 评测上 80% 的方差来自总 token 用量，而不是模型选型。 |
| Scale effort | "Match agent count to complexity" | Lead 评估 query 的难度，相应地决定派 1 个还是 10+ 个 worker。 |
| Synthesis conflict | "Workers disagree" | 两个 worker 返回相互矛盾的事实；lead 必须把分歧暴露出来，不能默默挑一边。 |

## 延伸阅读（Further Reading）

- [Anthropic engineering — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — supervisor 模式的生产参考实现
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — tool-calling 形式的 supervisor 现在是推荐姿势
- [LangGraph supervisor reference](https://reference.langchain.com/python/langgraph-supervisor) — 旧版 helper，2026 年生产里仍在用
- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) — 基于 handoff 的 supervisor 变体
