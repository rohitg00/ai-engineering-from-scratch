# 生产级扩展 —— 队列、Checkpoint、持久化

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 把多 agent 系统扩展到上千个并发 run，需要 **durable execution（持久化执行）**。LangGraph 运行时在每个 super-step 之后以 `thread_id` 为键写一条 checkpoint（默认 Postgres）；worker 崩溃后租约（lease）释放，另一个 worker 接续运行。Agent 可以无限期地睡着等待人工输入。**MegaAgent**（arXiv:2408.09955）跑了一个 per-agent 的生产者-消费者队列，包含三个状态（Idle / Processing / Response），并采用两层协调（组内 chat + 组间 admin chat）。**Fiber/async** 在 LLM 流式输出场景下完胜 thread-per-job：线程 99% 的时间都在等 token 空转，而 fiber 在 I/O 时会协作式地让出。反方观点：Ashpreet Bedi 的《Scaling Agentic Software》主张**只用 FastAPI + Postgres，别的什么都不要**，等到压测真的扛不住再说 —— 简单架构能撑得比预期远得多。本课会构建一个持久化 checkpoint 日志、一个带状态迁移的 per-agent 工作队列、一个 async vs thread 的对照 demo，最后落到「先从简单开始」这条务实规则。

**Type:** Learn + Build
**Languages:** Python (stdlib, `asyncio`, `sqlite3`)
**Prerequisites:** Phase 16 · 09 (Parallel Swarm Networks), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## 问题（Problem）

一个原型多 agent 系统在你笔记本上跑得挺好：三个 agent，一个内存事件循环。然后你要上生产：

- Agent 有时一跑就是好几个小时（长链路研究、human-in-the-loop（人工确认）等待）。
- Worker 进程会崩。重启就丢状态。
- 峰值流量是均值的 10 倍；你需要水平扩展。
- 用户按 agent-run 计费；你需要 exactly-once 语义来记账。

内存事件循环一条都满足不了。下面必须垫一层 durable execution。2026 年正典级的选项有：

1. 带 checkpoint 的 workflow 引擎（Temporal、LangGraph 运行时）。
2. 消息队列 + 状态存储（Postgres + SQS/RabbitMQ）。
3. Actor 模型框架（MegaAgent 的 per-agent 生产者-消费者）。
4. 手搓 FastAPI + Postgres（Bedi 的主张）。

本课会给每种各做一个迷你版。

## 概念（Concept）

### Durable execution，模式本身

durable-execution 引擎在每个「step」（在 LangGraph 的术语里叫 super-step）之后把整个程序状态持久化下来。崩溃时：

```
worker crashes mid-step
  -> lease timeout
  -> another worker picks up the thread_id
  -> resumes from last checkpoint
  -> no duplicate side effects
```

这个机制成立的前提：

- **可序列化的 state。** 所有 agent state 都得能被持久化。带活的数据库连接的函数闭包活不过这一关。
- **可确定性恢复（deterministic resume）。** 给定相同 state 和相同输入，agent 产生相同动作（或者把 LLM 调用委托给一个外部确定性 oracle）。
- **幂等的副作用。** 外部调用（tool call、支付）必须幂等，或者使用去重键（dedup key）。

LangGraph 在每个 super-step 后写 checkpoint；Temporal 在每个 activity 后写；Restate 用事件溯源（event-sourced）日志。三者实现的是同一个模式。

### LangGraph 的运行时

每个 agent 有一个 `thread_id`；state 是一个带类型的 dict；每个 super-step 在 checkpoints 表里写一行。恢复时，运行时从最近一个 checkpoint 重放，而不是从头跑。Agent 可以 `interrupt()` 等人工输入；运行时持久化状态并释放 worker。等输入到来时，任意 worker 都能续上。

这是 2026 年 4 月的参考生产设计。

### MegaAgent 的 per-agent 队列

arXiv:2408.09955 描述了一个规模实验：单集群里上千个并发 agent。架构如下：

```
agent i:
  state ∈ {Idle, Processing, Response}
  in_queue   <- messages addressed to agent i
  out_queue  -> replies + side effects

coordinators:
  intra-group chat  (agents in the same group)
  inter-group admin chat  (high-level routing)
```

两层协调让组内对话密集、组间对话稀疏 —— 这正是上千 agent 也能保持成本线性的关键。

### Async vs thread-per-job

LLM 调用是 I/O 密集型。等下一个 token 的线程 99% 时间都是空转。一条线程占用约 1MB 内存；并发 10,000 个调用，光栈就要 10GB。

Fiber（Python `asyncio`、Go goroutine、Rust `tokio`）在 I/O 时协作式让出。同样 10,000 个调用在一个进程里完全装得下。在 LLM-agent 这个量级，async 不是优化 —— 它就是架构本身。

例外：CPU 密集的后处理（embedding、tokenizer 小技巧）还是要走线程或进程。把 I/O 层和 CPU 层分开。

### Bedi 的反方意见

《Scaling Agentic Software》（Ashpreet Bedi, 2026）认为大多数团队都在没度量过负载之前就过度工程化。务实默认方案：

- FastAPI + Postgres。
- 每个 agent run 是一行；state 用乐观并发（optimistic concurrency）原地更新。
- 后台任务用 `pg_notify` 或一个简单的 Celery worker。
- 重试策略写在应用代码里。

对于负载在 ~100 并发 agent-run 以下、任务可控的场景，这套通常就够了。等量到了，再升级。

规则是：当你撞上简单架构解决不了的具体问题时，再上 durable-execution 框架。过早采纳，时间都耗在仪式上，没回报。

### Exactly-once 语义

对于付费的 agent run，你需要「effective exactly-once」（at-least-once 投递 + 幂等消费者）。工程上的动作：

- **每个 run 一个 dedup key。** 在每一次副作用调用里都带上。
- **Outbox 模式。** 副作用先写到一张表里，再由一个独立进程去执行。两步都幂等。
- **补偿事务。** 当副作用成功了但跟踪记录写失败时，调度一个补偿动作。

这些都是数据库工程模式，不是 LLM 专属。LLM 带来的「税」只是调用慢，其它都是分布式系统的标准课。

### Rainbow deployment（彩虹部署）

Anthropic 的多 agent 研究系统用「rainbow deployment」：让多个 agent 运行时版本并发跑，这样长时间运行的 agent 不至于每次代码部署都被强杀。新版本灰度上一小片流量；老版本上的 agent 跑完后再退役。

这是长生命周期有状态系统的标配；2026 年的本地化是：agent 可能活几个小时，部署节奏必须配合这一点。

### 生产正典 checklist

- 持久化 state（checkpoint、snapshot，或 outbox + 可重放日志）。
- 幂等的副作用。
- LLM 调用走 async I/O 层。
- At-least-once 投递 + dedup。
- 有状态负载用 rainbow / canary 部署。
- 可观测性：per-agent trace、super-step 审计、重试计数。

## 动手实现（Build It）

`code/main.py` 实现以下内容：

- `CheckpointStore` —— 基于 SQLite 的 checkpoint 日志，按 thread-id 索引。每个 super-step 追加一行。
- `run_with_checkpoint(agent, thread_id)` —— 模拟一次 run 中途崩溃；第二个 worker 从最近 checkpoint 续上。
- `AgentQueue` —— per-agent 的 Idle / Processing / Response 状态机，带一个小的 work queue。
- `demo_async_vs_threads()` —— 用 asyncio 和线程分别跑 500 个并发的模拟「LLM 调用」；报告 wall-clock 和峰值内存（近似值）。

运行：

```
python3 code/main.py
```

预期输出：模拟崩溃后 checkpoint 恢复成功；async 版本在 1 秒以内处理 500 个并发调用；线程版本要几秒钟，每个并发单元的内存占用要高出几个数量级。

## 用起来（Use It）

`outputs/skill-scaling-advisor.md` 给出 durable-execution 选型建议：FastAPI + Postgres、LangGraph 运行时、Temporal、或自研。校准维度是负载、state 保留需求和部署频次。

## 上线部署（Ship It）

生产正典化加固：

- **从简单开始（Bedi 法则）。** FastAPI + Postgres，量出问题再说。
- **优化前先把仪表打齐。** 每个 run 的延迟直方图、每个 step 的耗时、重试计数、失败分类。
- **副作用走 outbox 模式。** 尤其是支付和外部 API 调用。
- **Rainbow 部署。** 部署期间永远不要杀掉正在飞的 agent run。
- **遇到下面这些具体问题再上 durable-execution 引擎（Temporal / LangGraph / Restate）：** 几小时级别的 human-in-the-loop 等待、跨区域协调、复杂的重试/补偿策略。
- **I/O 层走 async。** 线程只用于 CPU 密集的后处理。

## 练习（Exercises）

1. 跑 `code/main.py`。确认 checkpoint 恢复有效；测量 async vs thread 的并发差距。
2. 实现一张 **outbox** 表：每次 tool 调用先写 outbox，再由独立的 goroutine/task 执行。把同一次 tool 调用跑两遍验证幂等性。
3. 模拟一次 **rainbow deploy**：两个并发的运行时版本；把一半新的 thread_id 路由到每一个；确认老版本上飞着的 thread 不会被打断。
4. 阅读 LangGraph 运行时文档（下方链接）。找出运行时里哪些特性如果用手搓的 FastAPI + Postgres 来复现会最费时间。这是采纳的理由，还是可以先延后？
5. 阅读 MegaAgent（arXiv:2408.09955）第 3 节。两层协调（组内 + 组间 admin chat）写得很明白。设想一下你要怎么把它映射到一个有两个队列家族的消息队列上。

## 关键术语（Key Terms）

| Term | 大家嘴上的说法 | 它真正的意思 |
|------|----------------|--------------|
| Durable execution | "把程序状态持久化" | 引擎在每个 super-step 后写 state；崩溃恢复是确定性的。 |
| Super-step | "事务边界" | 两个 checkpoint 之间的工作单元。LangGraph 术语。 |
| thread_id | "Agent run 标识符" | 把 checkpoint 与恢复逻辑绑在一起的键。 |
| Idempotency | "可以安全重试" | 副作用重复一次，结果跟跑一次一样。 |
| Outbox pattern | "把副作用解耦" | 把意图先写一张表；独立的 executor 执行并标记完成。 |
| At-least-once delivery | "可能有重复" | 消息队列语义；dedup key 让消费者达到 effective-once。 |
| Rainbow deploy | "重叠版本" | 长生命周期负载期间多个运行时版本并发存在。 |
| Async fiber | "协作式让出" | 用户态并发；对 I/O 密集负载来说比线程便宜得多。 |
| Checkpoint | "State 快照" | super-step 边界处的序列化 state；恢复的关键。 |

## 延伸阅读（Further Reading）

- [LangChain — The runtime behind production deep agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) — LangGraph 运行时设计
- [MegaAgent](https://arxiv.org/abs/2408.09955) — per-agent 生产者-消费者队列；上千并发 agent 下的两层协调
- [Matrix](https://arxiv.org/abs/2511.21686) — 以消息队列为协调底座的去中心化框架
- [Temporal docs](https://docs.temporal.io/) — durable execution 的参考 workflow 引擎
- [Anthropic — Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — 生产经验，包含 rainbow deployment
