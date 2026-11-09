# 并行/集群/网络架构

> 与监管者相比:没有中央决定者. 代理人阅读了共享活动的公共汽车, 随时进行工作, 写回结果. 拉格格拉夫明确支持"群众架构"用于分散,动态环境. 矩阵 (arXiv:2511.21686) 代表了控制和数据流程,作为串行信息通过分布式排队来消除乐队主持人瓶. 交易是明确的:确定性和可追溯性 群集适应许多独立子问题的任务;它不适应需要单一一致的计划的任务.

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`, `queue`), TypeScript
**Prerequisites:** Phase 16 · 05 (Supervisor Pattern), Phase 16 · 04 (Primitive Model)
**Time:** ~75 minutes

## 问题

监督员工只能达到几名工人.如果有数百人,怎么办?监督员本身就会成为瓶:每一个决定谁做什么,都通过一个代理. 一个缓慢的计划步骤,会阻碍整个系统.

群众架构翻转了设计.而不是一个中央规划者发送工作,工人从共享队列中选择工作."协调"被入事件巴士语义中.没有管弦器;系统在队列完成之前进行了扩展.

## 概念

### 形状

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

没有调整器. 每个员工都重复:拉出任务,处理,写出结果 (选择性地排列后续).

### 当群众相应时

- **Many independent tasks.**扫描,转换,分类,任务不依赖于彼此.
- **Variable-duration work.**如果一些任务需要100ms,而其他任务需要10ms,一群平衡负载自动快速的工人将下一个工作拉动.
- **Throughput over determinism.**你关心的是完成时间,而不是严格的订单.

### 当群众失败时

- **Ordered workflows.**如果步骤3需要步骤2的输出,一群在步骤2完成之前会冒着步骤3的风险.
- **Global-plan tasks.**复杂的研究问题从一个规划者中获益. 一群研究人员会提供独立的事实,而不是一致的报告.
- **Debugging.**没有中央日志和异步工作,

### 矩阵 (arXiv:2511.21686)

矩阵是2025年的论文,将群众带到自然结论:控制流和数据流都是分布式排列上的串行信息.没有中央协调员.错误容忍性来自于消息持久性.可扩展性是消息经纪人的问题,而不是系统的.

贡献:一个多代理协调模式是"该代理订阅什么信息主题?"而不是"监督者接下来选择哪个代理?" 这使系统看起来像一个公寓/子活动网.

### 图表框架中的群体

兰格拉夫 2025 文件明确描述"群众架构"为多代理模式之一:代理是节点,但边缘形成一个有周期的导向图表,任何节点都可以从池中激活.一个工人根据条件选择可用的工作,而不是监督员的任务.

### 失效模式:饥饿和热点

如果所有工人都能完成最快的任务, 长期的任务就不会被选中,

减轻:
- 优先排队,显着老化 (随着等待时间增加优先级).
- 工人专业化:有些工人只承担"长时间"的任务.
- 逆压力:限制排列中进入多少个快速任务.

### 基于内容的路由链接

随着内容基础的路由 (课 22) 进行自然的群组组.而不是一个通用队列,每个消息类型都有一个队列.专业人员只订阅他们的类型.这是以数千个代理为基础的消息巴士架构.

```figure
sw-work-stealing
```

## 建立它

`code/main.py`通过使用4个工人线程的工具,`queue.Queue`任务的持续时间可变 (有些快,有些慢).

- **Sequential baseline:**一个工人将所有任务进行序列处理.
- **Fixed assignment:**每个事先分配给特定的工人 (监督员类型).
- **Swarm:**工人从共享队列中拉下来.

积的平衡自动加载; 固定的任务让快速的工人放松,

运行:

```
python3 code/main.py
npx tsx code/main.ts
```

输出显示每位工人任务数量 (群群分布不均但最佳) 和墙钟时间.

## 用它

`outputs/skill-swarm-fit.md`评估任务是否应该使用群与监督者.输入:任务独立性,持续时间差异,订单要求,可调试需求.

## 运送它

检查列表:

- **Priority queue with aging.**防止长期的饥饿.
- **Worker idempotency.**工人在运行中遇到事故,工作可能会一次以上被拖累.
- **Durable queue.**通过使用卡夫卡,Redis流或数据库支持的排队进行制作. `queue.Queue`只有记忆.
- **Observability per task.**每个任务都有一个追踪身份证,每个员工都会使用它开始/结束日志.
- **Back-pressure.**如果排队增长得比工人排水更快,

## 运动

1. 跑步`code/main.py`变量时间工作负载上的群群比顺序速度快多多?
2. 添加优先排列变量 (使用 `queue.PriorityQueue`按任务"重要"字段分配优先级. 观察是否在持续负载下,低优先级任务会饿死.
3. 实现热点检测器:记录当任何工人处理比最慢工人多的任务时3倍. 这表明任务时间分布如何?
4. 阅读Matrix论文 (arXiv:2511.21686) 摘要和第3节. 确定一个特定的交易Matrix接受 (可扩展性收益) 和一个它放弃 (可追溯性,确定性).
5. 转换群体演示器使用一个`queue.Queue`工作人员只会订阅特定类型. 任务异性时,哪些路由规则是有意义的?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Swarm architecture | "Decentralized agents" | Workers pull from shared queue; no central orchestrator. |
| Event bus | "Agents subscribe to topics" | Message broker that routes tasks to workers by type or content. |
| Starvation | "Task never runs" | Low-priority task never gets picked because higher-priority work arrives continuously. |
| Hot-spotting | "One worker drowns" | Load imbalance where one worker gets most tasks. |
| Back-pressure | "Slow down the producer" | Mechanism that signals upstream to stop producing when the queue fills up. |
| Idempotent worker | "Safe to re-run" | A task processed twice produces the same result. Required because workers may crash mid-run. |
| Durable queue | "Survives crashes" | Queue backed by disk or replicated storage; tasks are not lost when a worker crashes. |
| Matrix framework | "Full message-passing swarm" | Both data and control flow are serialized messages on distributed queues. |

## 进一步阅读

- [LangGraph workflows and agents — Swarm Architecture](https://docs.langchain.com/oss/python/langgraph/workflows-agents)明确的群群支持
- [Matrix — A Decentralized Framework for Multi-Agent Systems](https://arxiv.org/abs/2511.21686) 完整的传递信息群
- [Anthropic engineering — why supervisor not swarm in Research](https://www.anthropic.com/engineering/multi-agent-research-system)为什么一个特定的生产系统明确选择监管者而不是群众
- [AutoGen v0.4 actor-model docs](https://microsoft.github.io/autogen/stable/)事件驱动演员重写,比 v0.2 的群体聊天更接近群体
