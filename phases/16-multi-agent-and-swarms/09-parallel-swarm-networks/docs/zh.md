# 并行 / 群体 / 网络化架构（Parallel / Swarm / Networked Architectures）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 与 supervisor 对比：没有中央决策者。各 agent 读取共享事件总线，异步领取工作，把结果写回去。LangGraph 明确支持「Swarm Architecture」，用于去中心化、动态变化的环境。Matrix（arXiv:2511.21686）把控制流和数据流都表达为通过分布式队列传递的序列化消息，从而消除掉 orchestrator 这个瓶颈。代价摆得很明白：用确定性和可追踪性换可扩展性。Swarm 适合「有大量彼此独立子问题」的任务；它不适合「需要单一连贯计划」的任务。

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`, `queue`)
**Prerequisites:** Phase 16 · 05 (Supervisor Pattern), Phase 16 · 04 (Primitive Model)
**Time:** ~75 minutes

## 问题（Problem）

Supervisor 能扛住几个 worker。那几百个呢？supervisor 自己就成了瓶颈：每一个「谁干什么」的决策都要走那一个 agent。计划阶段哪怕一步慢，全系统都得停在那儿等。

Swarm 架构把这个设计反过来。不再由一个中央 planner 派活，而是 worker 自己从共享队列里抓活。「协调」逻辑被烤进了事件总线的语义里。没有 orchestrator；系统的扩展上限只看队列扛不扛得住。

## 概念（Concept）

### 形态（The shape）

```
                ┌──── shared queue ────┐
                │                      │
       ┌────────┼────────┐  ◄──────┬───┘
       ▼        ▼        ▼         │
     Worker  Worker  Worker   Worker
      A       B       C        D
       │        │        │         │
       └────────┴────────┴─────────┘
                 │
                 ▼
            results pool
```

没有 orchestrator。每个 worker 重复一件事：拉一个任务、处理、把结果写回去（也可以顺手再 enqueue 几个后续任务）。

### swarm 适合的场景（When swarm fits）

- **大量独立任务。** 抓取、转换、分类。任务之间互不依赖。
- **耗时差异大的工作。** 如果有的任务 100ms、有的要 10s，swarm 会自动均衡负载——空出来的 worker 自己去拉下一个。supervisor 则得提前预估时长。
- **吞吐优先于确定性。** 你只在乎总完成时间，不在乎严格的顺序。

### swarm 不适合的场景（When swarm fails）

- **有顺序的工作流。** 如果 step 3 依赖 step 2 的输出，swarm 里 step 3 有可能在 step 2 还没干完时就被触发。
- **需要全局规划的任务。** 复杂的研究问题更需要一个 planner。一群 swarm 研究员产出的是一堆相互独立的事实，而不是一篇连贯的报告。
- **调试。** 没有中央日志、又是异步执行，复现一个 bug 的成本会非常高。

### Matrix（arXiv:2511.21686）

Matrix 是 2025 年那篇把 swarm 推到自然终点的论文：控制流和数据流都是分布式队列上的序列化消息。没有中央协调者。容错性来自消息的持久化。可扩展性是消息中间件的问题，而不是系统本身的问题。

它的贡献：一个把多 agent 协调表达为「这个 agent 订阅哪个 topic？」、而不是「supervisor 接下来挑哪个 agent？」的编程模型。这让整个系统看起来就是一个 pub/sub 事件网格。

### LangGraph 的 Swarm 架构（LangGraph's Swarm Architecture）

LangGraph 2025 的文档明确把「Swarm Architecture」列为多 agent 模式之一：agent 是节点，但边构成一张带环的有向图，并且任意节点都可以从池里被激活。worker 是按条件领活的，不是被 supervisor 指派的。

### 失败模式：饥饿与热点（Failure mode: starvation and hot-spotting）

如果所有 worker 都去抢「最快能完成的任务」，那些长任务就会一直没人接，直到队列里只剩它们才被理会。这是经典的队列饥饿。

缓解办法：

- 带显式 aging 的优先级队列（等待时间越长，优先级越高）。
- worker 特化：某些 worker 只接「长任务」。
- back-pressure：限制有多少快任务能进入队列。

### 与基于内容的路由的接口（The content-based routing link）

Swarm 天然能跟基于内容的路由（Lesson 22）配合。不要只用一个通用队列，而是每种消息类型一条队列。专业 worker 只订阅自己那一类。这就是能扩展到上千 agent 的消息总线架构的基础。

## 动手实现（Build It）

`code/main.py` 实现了一个 4 个 worker 线程的 swarm，所有 worker 都从一个共享的 `queue.Queue` 拉任务。任务的耗时差异较大（有的快、有的慢）。Demo 里对比了三种方式：

- **顺序基准（Sequential baseline）：** 一个 worker 串行处理所有任务。
- **固定指派（Fixed assignment）：** 每个任务被预先指派给某个特定 worker（supervisor 风格）。
- **Swarm：** worker 从共享队列里自己拉。

Swarm 会自动均衡负载；固定指派则会让快 worker 在自己的任务正好是慢任务时空转。

运行：

```
python3 code/main.py
```

输出会显示每个 worker 处理的任务数（swarm 分布不均匀，但是最优的）以及总墙钟时间。

## 用起来（Use It）

`outputs/skill-swarm-fit.md` 用来评估某个任务到底该用 swarm 还是 supervisor。输入维度：任务独立性、时长方差、顺序要求、可调试性需求。

## 上线部署（Ship It）

清单：

- **带 aging 的优先级队列。** 防止长任务饿死。
- **worker 幂等。** 如果 worker 跑到一半挂了，同一个任务可能被拉走不止一次。worker 必须幂等。
- **持久化队列。** 生产环境用 Kafka、Redis Streams 或基于数据库的队列。`queue.Queue` 只在内存里。
- **每个任务都可观测。** 每个任务带一个 trace ID；每个 worker 都用这个 ID 记录开始/结束。
- **Back-pressure。** 如果队列增长比 worker 消费快，就让生产者慢下来。

## 练习（Exercises）

1. 跑一下 `code/main.py`。在这种时长方差大的负载下，swarm 比顺序快多少？比固定指派又快多少？
2. 加一个优先级队列变体（用 `queue.PriorityQueue`）。按任务的「importance」字段定优先级。观察在持续负载下，低优先级任务是否会饿死。
3. 实现一个热点检测器：当某个 worker 处理的任务数达到最慢 worker 的 3 倍时记日志。这意味着任务时长分布是怎样的？
4. 读一下 Matrix 论文（arXiv:2511.21686）的摘要和第 3 节。挑出 Matrix 明确接受的一个 tradeoff（换来扩展性）和它放弃的一个东西（可追踪性、确定性）。
5. 把 swarm demo 改成用 `queue.Queue` 装 `(task_type, payload)` 元组，让 worker 只订阅特定的类型。当任务异构时，什么样的路由规则才合理？

## 关键术语（Key Terms）

| 术语 | 大家嘴上怎么说 | 实际是什么 |
|------|----------------|------------|
| Swarm 架构 | 「去中心化的 agent」 | worker 从共享队列拉任务；没有中央 orchestrator。 |
| 事件总线（Event bus） | 「agent 订阅 topic」 | 一个消息中间件，按类型或内容把任务路由到 worker。 |
| 饥饿（Starvation） | 「这个任务永远跑不到」 | 低优先级任务因为高优先级任务源源不断地来，永远轮不到自己。 |
| 热点（Hot-spotting） | 「某个 worker 被淹了」 | 负载不均，绝大多数任务都堆到一个 worker 上。 |
| Back-pressure | 「让生产者慢下来」 | 队列满了之后向上游发信号，让它停止生产的机制。 |
| 幂等 worker（Idempotent worker） | 「重跑也安全」 | 同一个任务处理两次得到一样的结果。因为 worker 可能跑到一半崩溃，所以必须幂等。 |
| 持久化队列（Durable queue） | 「崩了也不丢」 | 队列后面挂着磁盘或副本存储；worker 崩溃时任务不会丢。 |
| Matrix 框架 | 「彻底基于消息传递的 swarm」 | 数据流和控制流都是分布式队列上的序列化消息。 |

## 延伸阅读（Further Reading）

- [LangGraph workflows and agents — Swarm Architecture](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — 显式支持 swarm
- [Matrix — A Decentralized Framework for Multi-Agent Systems](https://arxiv.org/abs/2511.21686) — 完整的消息传递式 swarm
- [Anthropic engineering — why supervisor not swarm in Research](https://www.anthropic.com/engineering/multi-agent-research-system) — 一个具体的生产系统为什么明确选择 supervisor 而不是 swarm
- [AutoGen v0.4 actor-model docs](https://microsoft.github.io/autogen/stable/) — 事件驱动的 actor 重写版，比 v0.2 的 GroupChat 更接近 swarm
