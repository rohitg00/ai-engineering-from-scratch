# 生产级扩展 —— 队列、检查点、持久性

> 将多智能体系统扩展到数千个并发运行需要**持久化执行**——即工作队列加检查点，这样任何 worker 在任何崩溃后都能恢复任何运行，前提是租约处理、幂等副作用和确定性重放都已就绪。LangGraph 的运行时是参考范例：它在每个 super-step 之后写入一个以 `thread_id` 为键的检查点(默认使用 Postgres);worker 崩溃会释放租约，由另一个 worker 接续恢复。智能体可以无限期休眠等待人类输入。**MegaAgent**(arXiv:2408.09955)为每个智能体运行一个具有三种状态(Idle / Processing / Response)的生产者-消费者队列，并采用两层协调(组内聊天 + 组间管理员聊天)。对于 LLM 流式传输，**fiber/async** 优于每任务一线程：线程 99% 的时间都在闲置等待 token,而 fiber 在 I/O 时协作式让出。反面观点：Ashpreet Bedi 的"Scaling Agentic Software"主张在负载证明有必要之前，坚持**FastAPI + Postgres,别无其他**——简单架构能走得更远。本课将构建一个持久化检查点日志、一个带状态转换的每智能体工作队列、一个 async 与线程的对比演示，并落地务实的“从简单开始”规则。

**Type:** Learn + Build
**Languages:** Python (stdlib, `asyncio`, `sqlite3`)
**Prerequisites:** Phase 16 · 09(并行 Swarm 网络)、Phase 16 · 13(共享内存)
**Time:** 约 75 分钟

## 问题

一个原型多智能体系统在一台笔记本电脑上运行，包含三个智能体和一个内存事件循环。你要迁移到生产环境：

- 智能体有时会运行数小时(长时间研究、human-in-the-loop 等待)。
- Worker 进程会崩溃。重启会丢失状态。
- 峰值负载是平均值的 10 倍；你需要水平扩展。
- 用户按每次智能体运行付费；你需要计费的 exactly-once 语义。

内存事件循环无法满足以上任何一点。你需要在其下层增加一个持久化执行层。2026 年的几种典型方案是：

1. 带检查点的工作流引擎(Temporal、LangGraph runtime)。
2. 消息队列加状态存储(Postgres + SQS/RabbitMQ)。
3. Actor 模型框架(MegaAgent 的每智能体生产者-消费者模式)。
4. 手写 FastAPI + Postgres(Bedi 的主张)。

本课将为每种方案构建一个迷你版本。

## 概念

### 持久化执行模式

持久化执行引擎在每个“步骤”(用 LangGraph 的术语说是 super-step)之后持久化完整的程序状态。崩溃时：

```
worker crashes mid-step
  -> lease timeout
  -> another worker picks up the thread_id
  -> resumes from last checkpoint
  -> no duplicate side effects
```

要让这一机制生效，需要满足：

- **可序列化的状态。** 所有智能体状态都必须可持久化。持有活跃数据库连接的函数闭包无法幸存。
- **确定性恢复。** 给定相同的状态和相同的输入，智能体产生相同的动作(或对 LLM 调用求助于外部确定性预言机)。
- **幂等副作用。** 外部调用(工具调用、支付)必须幂等，或使用去重键。

LangGraph 在每个 super-step 后写入检查点；Temporal 在每个 activity 后写入；Restate 使用事件溯源日志。三者实现的是同一个模式。

### 每步骤检查点运行时

LangGraph 的运行时是具体示例：每个智能体有一个 `thread_id`;状态是一个类型化字典；每个 super-step 向 checkpoints 表写入一行。恢复时，运行时从最后一个检查点重放，而不是从零开始。智能体可以在等待人类输入时 `interrupt()`;运行时持久化状态并释放 worker。当输入到达时，任何 worker 都可以恢复运行。

这是 2026 年 4 月的参考生产设计。

### MegaAgent 的每智能体队列

arXiv:2408.09955 描述了一个规模实验：一个集群中运行数千个并发智能体。架构：

```
agent i:
  state ∈ {Idle, Processing, Response}
  in_queue   <- messages addressed to agent i
  out_queue  -> replies + side effects

coordinators:
  intra-group chat  (agents in the same group)
  inter-group admin chat  (high-level routing)
```

两层协调让组内对话高密度进行，而组间保持稀疏——这正是将成本控制在数千个智能体规模下保持线性的模式。

### Async 与每任务一线程的对比

LLM 调用是 I/O 密集型的。等待下一个 token 的线程有 99% 的时间是空闲的。每个线程约占用 1MB 内存；10,000 个并发调用仅栈就需要 10GB。

Fiber(Python 的 `asyncio`、Go 的 goroutine、Rust 的 `tokio`)在 I/O 时协作式让出。同样的 10,000 个调用可以轻松容纳在一个进程中。在 LLM 智能体的规模上，async 不是一种优化——它就是架构本身。

例外：CPU 密集型的后处理(嵌入、分词技巧)仍然需要线程或进程。将 I/O 层与 CPU 层分开。

### Bedi 的反面观点

"Scaling Agentic Software"(Ashpreet Bedi,2026)认为，大多数团队在测量负载之前就过度设计。务实的默认方案：

- FastAPI + Postgres。
- 每次智能体运行是一行；状态原地更新，配合乐观并发控制。
- 通过 `pg_notify` 或简单的 Celery worker 处理后台任务。
- 应用代码中实现重试策略。

对于可控任务上低于约 100 个并发智能体运行的负载，这通常就足够了。测到它失败时再升级。

规则是：当你遇到简单架构无法解决的具体问题时，才采用持久化执行框架。过早采用会浪费大量时间在不会带来回报的仪式性工作上。

### Exactly-once 语义

对于付费的智能体运行，你需要"exactly-once effective"(至少一次投递 + 幂等消费者)。工程手段：

- **每次运行的去重键。** 将其包含在每一次副作用调用中。
- **Outbox 模式。** 副作用先写入表，再由独立进程执行。两个步骤都幂等。
- **补偿事务。** 当副作用成功但其跟踪写入失败时，调度一次补偿。

这些是数据库工程模式，并非 LLM 特有。LLM 带来的唯一额外负担只是 LLM 调用很慢；其余一切都是标准分布式系统实践。

### Rainbow 部署

Anthropic 的多智能体研究系统使用"rainbow deployments":多个版本的智能体运行时并发运行，这样长期运行的智能体不必在每次代码部署时被杀死。在新版本上对一部分流量做金丝雀发布；旧版本上的智能体运行结束后再将其退役。

这对长期运行的有状态系统是标准做法；2026 年的新变化是智能体可以存活数小时，因此部署周期必须适应这一点。

### 标准生产清单

- 持久化状态(检查点、快照，或 outbox + 可重放日志)。
- 幂等副作用。
- 用于 LLM 调用的异步 I/O 层。
- 至少一次投递配合去重。
- 针对有状态负载的 rainbow/金丝雀部署。
- 可观测性：每智能体追踪、super-step 审计、重试计数。

```figure
sw-checkpoint-replay
```

## 动手构建

`code/main.py` 实现了：

- `CheckpointStore` —— 基于 SQLite 的检查点日志，以 thread-id 为键。每个 super-step 追加一行。
- `run_with_checkpoint(agent, thread_id)` —— 模拟运行中途崩溃；第二个 worker 从最后一个检查点恢复。
- `AgentQueue` —— 每智能体的 Idle / Processing / Response 状态机，附带一个小型工作队列。
- `demo_async_vs_threads()` —— 分别通过 asyncio 和线程运行 500 个并发模拟"LLM 调用"；报告实际耗时和峰值内存(近似值)。

运行：

```
python3 code/main.py
```

预期输出：模拟崩溃后检查点恢复成功；async 版本在 1 秒内处理 500 个并发调用；线程版本需要数秒，且每个并发单元使用的内存高出多个数量级。

## 应用

`outputs/skill-scaling-advisor.md` 就持久化执行方案的选择提供建议：FastAPI + Postgres、LangGraph runtime、Temporal 或自建。依据负载、状态保留需求和部署频率进行校准。

## 上线

标准的生产加固措施：

- **从简单开始(Bedi 规则)。** 在测到失败之前，坚持 FastAPI + Postgres。
- **优化之前先做埋点。** 每次运行的延迟直方图、每步骤耗时、重试次数、失败分类。
- **副作用使用 outbox 模式。** 尤其是支付和外部 API 调用。
- **Rainbow 部署。** 绝不在部署时杀死运行中的智能体任务。
- **在遇到具体问题时采用持久化执行引擎(Temporal / LangGraph / Restate):** 数小时长的 human-in-the-loop 等待、跨区域协调、复杂的重试/补偿策略。
- **I/O 层使用 async。** 线程仅用于 CPU 密集型后处理。

## 练习

1. 运行 `code/main.py`。确认检查点恢复正常；测量 async 与线程的并发性能差异。
2. 实现一个 **outbox** 表：每次工具调用先写入 outbox,再由单独的 goroutine/task 执行。通过运行同一工具调用两次来验证幂等性。
3. 模拟一次 **rainbow 部署**：两个运行时版本并发运行；将新 thread_ids 的一半路由到每个版本；确认旧版本上运行中的线程不会被打断。
4. 阅读 LangGraph 的运行时文档(见下方链接)。找出在手写的 FastAPI + Postgres 版本中，运行时的哪些功能复现起来耗时最长。这是采用它的理由，还是可以推迟？
5. 阅读 MegaAgent(arXiv:2408.09955)第 3 节。两层协调(组内 + 组间管理员聊天)是明确描述的。粗略设计如何将其映射到具有两个队列族的消息队列上。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| 持久化执行 | “持久化程序状态” | 引擎在每个 super-step 后写入状态；崩溃恢复是确定性的。 |
| Super-step | “事务边界” | 检查点之间的工作单元。LangGraph 术语。 |
| thread_id | “智能体运行标识符” | 绑定检查点与恢复逻辑的键。 |
| 幂等性 | “可以安全重试” | 重复一次副作用产生的结果与执行一次相同。 |
| Outbox 模式 | “解耦副作用” | 将意图写入表；由单独的执行器执行并标记完成。 |
| 至少一次投递 | “可能出现重复” | 消息队列语义；去重键使消费者实际只处理一次。 |
| Rainbow 部署 | “版本重叠” | 长期运行负载期间多个运行时版本并发。 |
| Async fiber | “协作式让出” | 用户态并发；对 I/O 密集型负载而言比线程廉价得多。 |
| 检查点 | “状态快照” | super-step 边界处序列化的状态；恢复的关键。 |

## 延伸阅读

- [LangChain — The runtime behind production deep agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) — LangGraph runtime 设计
- [MegaAgent](https://arxiv.org/abs/2408.09955) — 每智能体生产者-消费者队列；数千并发智能体下的两层协调
- [Matrix](https://arxiv.org/abs/2511.21686) — 以消息队列作为协调基质的去中心化框架
- [Temporal docs](https://docs.temporal.io/) — 持久化执行的参考工作流引擎
- [Anthropic — Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — 生产经验，包括 rainbow 部署