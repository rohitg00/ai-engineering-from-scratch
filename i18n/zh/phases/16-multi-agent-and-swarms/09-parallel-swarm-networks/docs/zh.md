# 并行 / 蜂群 / 网络化架构

> 与 Supervisor 对比：没有中央决策者。Agent 读取共享的事件总线，异步领取任务，写回结果。LangGraph 明确支持面向去中心化、动态环境的"Swarm Architecture"。Matrix(arXiv:2511.21686)将控制流和数据流都表示为通过分布式队列传递的序列化消息，以消除编排器瓶颈。权衡是明确的：以确定性和可追溯性换取可扩展性。蜂群适合包含大量独立子问题的任务；不适合需要单一连贯计划的任务。

**Type:** Learn + Build
**Languages:** Python (标准库, `threading`, `queue`)
**Prerequisites:** Phase 16 · 05(Supervisor 模式),Phase 16 · 04(基础模型)
**Time:** ~75 分钟

## 问题

Supervisor 能扩展到几个 worker。那如果是几百个呢？Supervisor 本身就成了瓶颈:关于谁做什么的每个决策都要经过一个 agent。一个缓慢的计划步骤会拖慢整个系统。

蜂群架构颠覆了这种设计。不是由中央规划器分发任务,而是 worker 从共享队列中领取任务。"协调"内建于事件总线的语义之中。没有编排器;系统会一直扩展,直到队列本身成为限制。

## 概念

### 结构

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

没有编排器。每个 worker 重复:领取任务、处理、写回结果(并可选地将后续任务入队)。

### 蜂群适用的场景

- **大量独立任务。** 抓取、转换、分类。任务之间互不依赖。
- **持续时间不定的任务。** 如果有些任务需要 100ms,另一些需要 10s,蜂群会自动平衡负载——快的 worker 领取下一个任务。Supervisor 则必须预判任务时长。
- **吞吐量优先于确定性。** 你关心的是总完成时间,而不是严格的顺序。

### 蜂群失效的场景

- **有序工作流。** 如果步骤 3 需要步骤 2 的输出,蜂群有可能在步骤 2 完成之前就触发步骤 3。
- **需要全局规划的任务。** 复杂的研究问题需要一个规划器。一群研究员各自产出独立的事实,而不是一份连贯的报告。
- **调试。** 没有中央日志且工作是异步的,复现一个 bug 的代价很高。

### Matrix(arXiv:2511.21686)

Matrix 是 2025 年的一篇论文,它把蜂群推到了自然的结论:控制流和数据流都是分布式队列上的序列化消息。没有中央协调器。容错来自消息持久性。可扩展性是消息代理的问题,而不是系统的问题。

贡献:一个编程模型,其中多 agent 协调被表述为"这个 agent 订阅哪个消息主题?"而不是"supervisor 下一步选哪个 agent?"这使得系统看起来像一个发布/订阅的事件网格。

### 图框架中的蜂群

LangGraph 2025 文档明确将"Swarm Architecture"描述为多 agent 模式之一:agent 是节点,但边构成带环的有向图,任何节点都可以从池中被激活。worker 按条件从可用工作中选取,而不是由 supervisor 指派。

### 失效模式:饥饿与热点

如果所有 worker 都领取最快可完成的任务,长任务永远不会被领取,直到只剩下它们。经典的队列饥饿。

缓解措施:
- 带显式老化的优先级队列(随等待时间提高优先级)。
- worker 专业化:某些 worker 只领取"长"任务。
- 背压:限制进入队列的快速任务数量。

### 基于内容的路由关联

蜂群与基于内容的路由(第 22 课)天然契合。不是使用通用队列,而是每种消息类型一个队列。专业 worker 只订阅自己的类型。这是可扩展到数千个 agent 的消息总线架构的基础。

```figure
sw-work-stealing
```

## 动手构建

`code/main.py` 实现了一个由 4 个 worker 线程组成的蜂群,从共享的 `queue.Queue` 中领取任务。任务时长不定(有快有慢)。演示对比:

- **顺序基线:** 一个 worker 串行处理所有任务。
- **固定分配:** 每个任务预先分配给特定 worker(supervisor 风格)。
- **蜂群:** worker 从共享队列领取任务。

蜂群自动平衡负载;固定分配在分配的任务很慢时会让快的 worker 闲置。

运行:

```
python3 code/main.py
```

输出显示每个 worker 的任务数(蜂群的分布不均匀但最优)和墙钟时间。

## 使用

`outputs/skill-swarm-fit.md` 评估一个任务应该使用蜂群还是 supervisor。输入:任务独立性、时长方差、顺序要求、可调试性需求。

## 上线

检查清单:

- **带老化的优先级队列。** 防止长任务饥饿。
- **Worker 幂等性。** 如果 worker 在运行中途崩溃,任务可能被多次领取。worker 必须是幂等的。
- **持久化队列。** 生产环境使用 Kafka、Redis Streams 或基于数据库的队列。`queue.Queue` 仅在内存中。
- **按任务的可观测性。** 每个任务都有一个 trace ID;每个 worker 在开始/结束时用它记录日志。
- **背压。** 如果队列增长快于 worker 的处理速度,就让生产者减速。

## 练习

1. 运行 `code/main.py`。在时长不定的负载下,蜂群比顺序执行快多少?比固定分配快多少?
2. 添加优先级队列变体(使用 `queue.PriorityQueue`)。按任务的"重要性"字段分配优先级。观察在持续负载下低优先级任务是否会饥饿。
3. 实现一个热点检测器:当任何 worker 处理的任务数是最慢 worker 的 3 倍以上时记录日志。这说明任务时长分布有什么特征?
4. 阅读 Matrix 论文(arXiv:2511.21686)的摘要和第 3 节。指出 Matrix 接受的一个具体权衡(可扩展性收益)和放弃的一个方面(可追溯性、确定性)。
5. 将蜂群演示改为使用 (task_type, payload) 元组的 `queue.Queue`,worker 只订阅特定类型。当任务异构时,什么样的路由规则是合理的?

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| 蜂群架构 | "去中心化的 agent" | Worker 从共享队列领取任务;没有中央编排器。 |
| 事件总线 | "Agent 订阅主题" | 按类型或内容将任务路由到 worker 的消息代理。 |
| 饥饿 | "任务永远不运行" | 低优先级任务始终不被领取,因为高优先级工作不断到来。 |
| 热点 | "一个 worker 被淹没" | 负载不均衡,某个 worker 获得了大部分任务。 |
| 背压 | "让生产者减速" | 队列填满时通知上游停止生产的机制。 |
| 幂等 worker | "可以安全重跑" | 同一任务处理两次产生相同结果。必需,因为 worker 可能在运行中途崩溃。 |
| 持久化队列 | "能在崩溃后存活" | 由磁盘或副本存储支撑的队列;worker 崩溃时任务不丢失。 |
| Matrix 框架 | "完整的消息传递蜂群" | 数据流和控制流都是分布式队列上的序列化消息。 |

## 延伸阅读

- [LangGraph workflows and agents — Swarm Architecture](https://docs.langchain.com/oss/python/langgraph/workflows-agents) — 明确的蜂群支持
- [Matrix — A Decentralized Framework for Multi-Agent Systems](https://arxiv.org/abs/2511.21686) — 完整的消息传递蜂群
- [Anthropic engineering — why supervisor not swarm in Research](https://www.anthropic.com/engineering/multi-agent-research-system) — 某个具体生产系统为何明确选择 supervisor 而非蜂群
- [AutoGen v0.4 actor-model docs](https://microsoft.github.io/autogen/stable/) — 事件驱动的 actor 重写,比 v0.2 的 GroupChat 更接近蜂群