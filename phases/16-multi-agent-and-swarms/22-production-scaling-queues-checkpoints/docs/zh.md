# 22 · 生产级扩展——队列、检查点与持久性

> 把多智能体系统扩展到数千个并发运行需要「持久化执行（durable execution）」。LangGraph 的运行时会在每个超级步骤（super-step）后写入一个以 `thread_id` 为键的检查点（默认使用 Postgres）；当工作进程崩溃时会释放租约（lease），另一个工作进程随即接管恢复。智能体可以无限期休眠以等待人工输入。**MegaAgent**（arXiv:2408.09955）为每个智能体运行了一个生产者-消费者队列，包含三种状态（Idle / Processing / Response），并采用两层协调机制（组内对话 + 组间管理对话）。对于 LLM 流式输出，「纤程/异步（Fiber/async）」胜过每任务一线程（thread-per-job）：线程有 99% 的时间在空闲等待 token，而纤程在 I/O 上协作式让出。反方观点：Ashpreet Bedi 的《Scaling Agentic Software》主张在负载尚未证明需要之前，坚持 **FastAPI + Postgres，别的什么都不要**——简单架构能走得比预期更远。本课会构建一个持久化检查点日志、一个带状态转换的按智能体工作队列、一个异步对比线程的演示，并最终落到务实的「从简单开始」准则。

**类型：** 学习 + 构建
**语言：** Python（标准库、`asyncio`、`sqlite3`）
**前置：** 阶段 16 · 09（并行蜂群网络），阶段 16 · 13（共享内存）
**时长：** 约 75 分钟

## 问题

一个原型多智能体系统在一台笔记本上、以内存事件循环运行三个智能体时工作正常。现在你要转向生产环境：

- 智能体有时会运行数小时（长时间研究、人在回路（human-in-the-loop）等待）。
- 工作进程会崩溃。重启会丢失状态。
- 峰值负载是平均值的 10 倍；你需要横向扩展（horizontal scaling）。
- 用户按智能体运行次数付费；计费需要恰好一次（exactly-once）的语义。

内存事件循环一项都做不到。你需要在底层有一个持久化执行层。2026 年的经典选项有：

1. 带检查点的工作流引擎（Temporal、LangGraph 运行时）。
2. 配合状态存储的消息队列（Postgres + SQS/RabbitMQ）。
3. 行动者模型（actor-model）框架（MegaAgent 的按智能体生产者-消费者）。
4. 手写的 FastAPI + Postgres（Bedi 的主张）。

本课会为以上每一种构建一个微缩版本。

## 概念

### 持久化执行这一模式

持久化执行引擎会在每一「步」之后持久化整个程序状态（用 LangGraph 的术语说，是超级步骤）。崩溃时：

```
worker crashes mid-step
  -> lease timeout
  -> another worker picks up the thread_id
  -> resumes from last checkpoint
  -> no duplicate side effects
```

要让这套机制成立的前提：

- **可序列化状态（Serializable state）。** 所有智能体状态都必须可持久化。带有活跃数据库连接的函数闭包无法存活。
- **确定性恢复（Deterministic resume）。** 给定相同的状态和相同的输入，智能体产生相同的动作（或者对于 LLM 调用，转交给一个外部的确定性预言机）。
- **幂等的副作用（Idempotent side effects）。** 外部调用（工具调用、支付）必须是幂等的，或者使用去重键（deduplication key）。

LangGraph 在每个超级步骤后写入检查点；Temporal 在每个活动（activity）后写入；Restate 使用事件溯源（event-sourced）日志。这三者实现的是同一个模式。

### LangGraph 的运行时

每个智能体都有一个 `thread_id`；状态是一个带类型的字典；每个超级步骤向检查点表写入一行。恢复时，运行时从最后一个检查点重放（replay），而非从头开始。智能体可以调用 `interrupt()` 来等待人工输入；运行时会持久化状态并释放工作进程。当输入到达时，任何工作进程都可以恢复执行。

这是 2026 年 4 月的参考生产设计。

### MegaAgent 的按智能体队列

arXiv:2408.09955 描述了一个规模实验：在一个集群中运行数千个并发智能体。其架构：

```
agent i:
  state ∈ {Idle, Processing, Response}
  in_queue   <- messages addressed to agent i
  out_queue  -> replies + side effects

coordinators:
  intra-group chat  (agents in the same group)
  inter-group admin chat  (high-level routing)
```

两层协调让组内对话可以密集进行，而组间保持稀疏——这正是让成本随数千个智能体保持线性增长所用的模式。

### 异步对比每任务一线程

LLM 调用是 I/O 密集型（I/O-bound）的。一个等待下一个 token 的线程 99% 的时间都在空闲。每个线程约耗费 1MB 内存；在 10,000 个并发调用时，仅栈空间就要 10GB。

纤程（Python `asyncio`、Go goroutine、Rust `tokio`）在 I/O 上协作式让出。同样的 10,000 个调用可以舒适地装进一个进程内。在 LLM 智能体的规模上，异步不是一种优化——它就是架构本身。

例外情况：CPU 密集型（CPU-bound）的后处理（嵌入、分词器技巧）仍然需要线程或进程。把你的 I/O 层与 CPU 层分开。

### Bedi 的反方观点

《Scaling Agentic Software》（Ashpreet Bedi，2026）主张，大多数团队在尚未测量负载之前就过度工程化了。务实的默认做法是：

- FastAPI + Postgres。
- 每个智能体运行就是一行记录；状态以乐观并发控制（optimistic concurrency）就地更新。
- 后台作业通过 `pg_notify` 或一个简单的 Celery worker 实现。
- 重试策略写在应用代码里。

对于在可控任务上、低于约 100 个并发智能体运行的负载，这往往就是你所需要的全部。等你测量到它失效时再升级。

准则：当你撞上简单架构无法解决的具体问题时，才采用持久化执行框架。过早采用会把时间烧在收益甚微的繁文缛节上。

### 恰好一次语义

对于付费的智能体运行，你需要「有效恰好一次（exactly-once effective）」（至少一次（at-least-once）投递 + 幂等消费者）。工程上的做法：

- **每次运行一个去重键。** 在每个副作用调用中都带上它。
- **发件箱模式（Outbox pattern）。** 副作用先写入一张表，再由一个独立进程执行它们。两步都是幂等的。
- **补偿事务（Compensating transactions）。** 当副作用成功但其跟踪写入失败时，调度一个补偿动作。

这些都是数据库工程模式，并非 LLM 专有。LLM 带来的额外开销仅仅是 LLM 调用慢；其余一切都是标准的分布式系统。

### 彩虹部署

Anthropic 的多智能体研究系统使用「彩虹部署（rainbow deployments）」：多个版本的智能体运行时并发运行，这样长时间运行的智能体就不必在每次代码部署时被杀掉。在一小部分流量上灰度（canary）新版本；当旧版本上的智能体完成后再退役它们。

这对于长时间运行的有状态系统是标准做法；2026 年的适配之处在于，智能体可以存活数小时，因此部署周期必须容纳这一点。

### 经典生产清单

- 持久化状态（检查点、快照，或发件箱 + 可重放日志）。
- 幂等的副作用。
- 用于 LLM 调用的异步 I/O 层。
- 带去重的至少一次投递。
- 针对有状态工作负载的彩虹/灰度部署。
- 可观测性：按智能体的追踪、超级步骤审计、重试计数器。

## 动手构建

`code/main.py` 实现了：

- `CheckpointStore`——基于 SQLite 的检查点日志，以 thread-id 为键。每个超级步骤追加一行。
- `run_with_checkpoint(agent, thread_id)`——模拟运行途中的一次崩溃；第二个工作进程从最后一个检查点恢复。
- `AgentQueue`——按智能体的 Idle / Processing / Response 状态机，附带一个小型工作队列。
- `demo_async_vs_threads()`——通过 asyncio 和通过线程分别运行 500 个并发的模拟「LLM 调用」；报告挂钟时间（wall-clock）和峰值内存（近似）。

运行：

```
python3 code/main.py
```

预期输出：在模拟崩溃后检查点恢复成功；异步版本在 < 1 秒内处理 500 个并发调用；线程版本耗时数秒，且每个并发单元的内存占用要高出几个数量级。

## 实际运用

`outputs/skill-scaling-advisor.md` 就持久化执行的选型给出建议：FastAPI + Postgres、LangGraph 运行时、Temporal，还是自研。依据负载、状态保留需求和部署频率进行校准。

## 上线交付

经典的生产加固：

- **从简单开始（Bedi 的准则）。** 在你测量到它失效之前，坚持 FastAPI + Postgres。
- **优化之前先把一切埋点。** 按运行的延迟直方图、按步骤的耗时、重试次数、失败分类。
- **副作用使用发件箱模式。** 尤其是支付和外部 API 调用。
- **彩虹部署。** 部署期间绝不杀掉飞行中的智能体运行。
- **在你撞上具体问题时再采用持久化执行引擎（Temporal / LangGraph / Restate）：** 长达数小时的人在回路等待、跨区域协调、复杂的重试/补偿策略。
- **I/O 层用异步。** 线程仅用于 CPU 密集型的后处理。

## 练习

1. 运行 `code/main.py`。确认检查点恢复有效；测量异步与线程的并发差异。
2. 实现一张**发件箱（outbox）**表：每个工具调用先写入发件箱，再由一个独立的 goroutine/任务执行。通过把同一个工具调用运行两次来验证幂等性。
3. 模拟一次**彩虹部署**：两个并发的运行时版本；把一半的新 thread_id 路由到每个版本；确认旧版本上飞行中的线程不被打断。
4. 阅读 LangGraph 的运行时文档（下方链接）。找出该运行时的哪些特性在手写 FastAPI + Postgres 版本中最难复制。这是采用它的理由，还是你可以推迟？
5. 阅读 MegaAgent（arXiv:2408.09955）第 3 节。两层协调（组内 + 组间管理对话）是显式的。勾画一下你会如何把它映射到一个带两个队列族（queue families）的消息队列上。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| 持久化执行（Durable execution） | "持久化程序状态" | 引擎在每个超级步骤后写入状态；崩溃恢复是确定性的。 |
| 超级步骤（Super-step） | "事务边界" | 检查点之间的工作单元。LangGraph 术语。 |
| thread_id | "智能体运行标识符" | 把检查点与恢复逻辑绑定在一起的键。 |
| 幂等性（Idempotency） | "可以安全重试" | 重复一次副作用所产生的结果与执行一次相同。 |
| 发件箱模式（Outbox pattern） | "解耦副作用" | 把意图写入一张表；由一个独立的执行器去执行并标记完成。 |
| 至少一次投递（At-least-once delivery） | "可能有重复" | 消息队列语义；去重键让消费者达到有效恰好一次。 |
| 彩虹部署（Rainbow deploy） | "版本重叠" | 在长时间运行的工作负载期间多个运行时版本并发。 |
| 异步纤程（Async fiber） | "协作式让出" | 用户态并发；对于 I/O 密集型负载，相比线程更廉价。 |
| 检查点（Checkpoint） | "状态快照" | 在超级步骤边界处序列化的状态；恢复的关键。 |

## 延伸阅读

- [LangChain — The runtime behind production deep agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) — LangGraph 运行时设计
- [MegaAgent](https://arxiv.org/abs/2408.09955) — 按智能体的生产者-消费者队列；在数千个并发智能体规模下的两层协调
- [Matrix](https://arxiv.org/abs/2511.21686) — 以消息队列为协调底座的去中心化框架
- [Temporal docs](https://docs.temporal.io/) — 持久化执行的参考工作流引擎
- [Anthropic — Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — 包含彩虹部署在内的生产经验
