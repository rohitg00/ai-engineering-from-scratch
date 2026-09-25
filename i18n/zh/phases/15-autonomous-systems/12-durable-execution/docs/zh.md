# 长时运行后台智能体：持久化执行（Durable Execution）

> 生产环境中的长时程智能体并非运行在 `while True` 中。每一次 LLM 调用都成为一个带有检查点、重试与重放机制的活动。Temporal 的 OpenAI Agents SDK 集成已于 2026 年 3 月正式发布（GA）。Claude Code Routines（Anthropic）可以在没有常驻本地进程的情况下运行定时调度的 Claude Code 调用。会话在等待人工输入时暂停，在部署中存活，并从以 `thread_id` 为键的最新检查点恢复。在这些新式易用接口的背后是一个古老模式——工作流编排——外加一项新输入：将 LLM 调用视为非确定性活动，它们必须在恢复时被确定性地重放。

**Type:** Learn
**Languages:** Python（标准库，极简持久化执行状态机）
**Prerequisites:** Phase 15 · 10（权限模式）、Phase 15 · 01（长时程智能体）
**Time:** ~60 分钟

## 问题所在

设想一个运行四小时的智能体。它调用三个工具，两次询问用户，并发出四十次 LLM 调用。进行到一半时，它所在的主机重启了。会发生什么？

- 在朴素的 `while True` 循环中：一切丢失。运行从头开始。三个工具调用（带有真实副作用）会再次执行。用户会被再次询问他们已经批准过的事项。四十次 LLM 调用会被重复计费。
- 使用持久化执行时：运行从最近的检查点恢复。已完成的活动不会被重新执行；其结果从持久化日志中重放。用户无需重新批准已批准的事项。已发出的 LLM 调用不会被重复计费。

这与工作流引擎已经交付了十年的模式相同（Temporal、Cadence、Uber 的 Cherami）。新的地方在于：LLM 调用现在成为了一类活动——非确定性、昂贵、带有副作用——而它们与该模式完美契合。

本课贯穿始终的主题：长时程可靠性会衰减（METR 观察到“35 分钟退化”——成功率随时程大约呈二次方下降）。持久化执行使运行时长可以超过可靠性曲线所支持的范围——如果设计正确，这是一种安全失败的新方式；如果设计错误，则是不安全的。

## 核心概念

### 活动、工作流与重放

- **工作流（Workflow）**：确定性的编排代码。定义活动的顺序、分支与等待。必须具有确定性，才能从事件日志中重放而不产生意外偏差。
- **活动（Activity）**：一个非确定性、可能失败的工作单元。LLM 调用、工具调用、文件写入、HTTP 请求。每个活动都会记录其输入以及（完成后）其输出。
- **事件日志（Event log）**：持久化的底层存储。每次活动的开始、完成、失败、重试，以及每个工作流决策都被记录。
- **重放（Replay）**：恢复时，工作流代码从头重新运行；每个已完成的活动直接返回其日志记录的结果，而不再重新执行。只有未完成的活动才被真正运行。

这与 React 针对虚拟 DOM 重新渲染、或 Git 从提交重建工作树是同一种形态。编排器中的确定性是使持久化变得廉价的关键。

### 为什么 LLM 调用契合该模式

LLM 调用具有以下特点：
- 非确定性（temperature > 0；即使 temperature 为 0，在不同模型版本间也会漂移）。
- 昂贵（金钱与延迟）。
- 可能失败（速率限制、超时）。
- 有副作用（当它们调用工具时）。

这正是活动的典型特征。将每次 LLM 调用包装为一个活动，即可获得指数退避重试、跨重启的检查点，以及用于调试的可重放追踪。

### 以 `thread_id` 为键的检查点

LangGraph、Microsoft Agent Framework、Cloudflare Durable Objects 以及 Claude Code Routines 都收敛到了相同的 API 形态：一个 `thread_id`（或等价物）标识会话；每次状态转移持久化到后端（默认 PostgreSQL，开发用 SQLite，缓存用 Redis）；恢复时读取最新检查点。

后端的选择很重要：

- **PostgreSQL**：持久、可查询、在部署中存活。LangGraph 的默认选择。
- **SQLite**：仅限本地开发；跨主机丢失数据。
- **Redis**：快但易失，除非配置了 AOF/快照。
- **Cloudflare Durable Objects**：透明地分布式；按唯一键划分作用域；可存活数小时至数周。

### 人工输入作为一等状态

提案-确认模式（第 15 课）需要一个持久的“等待人工”状态。工作流暂停，外部队列持有待处理请求，一次批准使工作流从该精确位置恢复。没有持久化，这只能尽力而为；有了它，隔夜到达的批准会在第二天早上让工作流继续执行。

### 35 分钟退化

METR 观察到，所有被测量的智能体类别在连续运行约 35 分钟后都表现出可靠性衰减。任务时长翻倍，失败率大约翻四倍。持久化执行并不能修复这一点；它只是让你能运行超过可靠性曲线所支持的范围。安全的模式是将持久化与“重新进入时要求新 HITL”的检查点相结合，并与预算熔断开关（第 13 课）相结合——无论实际耗时如何都限制总计算量。

### 何时持久化执行是错误的答案

- 运行时长仅几分钟且无人工输入。开销 > 收益。
- 严格只读的信息检索。
- 正确性要求在单个上下文窗口内端到端完成的任务（某些推理任务；某些一次性生成任务）。

```figure
memory-consolidation
```

## 动手使用

`code/main.py` 用标准库 Python 实现了一个极简的持久化执行引擎。它支持：

- `@activity` 装饰器，将输入和输出记录到 JSON 事件日志。
- 一个按顺序编排活动的工作流函数。
- 一个 `run_or_replay(workflow, event_log)` 函数，重放已完成的活动而不重新执行。

驱动程序模拟一个三活动的工作流，中途崩溃，并展示：(a) 朴素重试会重新执行一切，对比 (b) 重放只运行缺失的活动。

## 上线部署

`outputs/skill-durable-execution-review.md` 会审查一个拟议的长时运行智能体部署是否具备正确的持久化执行形态：活动、确定性、检查点后端、人工输入状态，以及恢复时的 HITL 策略。

## 练习

1. 运行 `code/main.py`。观察朴素重试与重放在活动执行次数上的差异。改变崩溃点，并展示重放次数相应变化。

2. 将玩具引擎改为显式使用 `thread_id`。模拟两个共享该引擎的并发会话，并确认它们的事件日志不会冲突。

3. 选取玩具引擎中的一个活动。引入非确定性（在工作流决策中使用墙上时钟时间戳）。演示重放时的偏差。解释真实引擎如何处理这一点（副作用注册、`Workflow.now()` API）。

4. 阅读 LangChain 的"Runtime behind production deep agents"文章。列出该运行时持久化的每一种状态，并说明每种状态分别覆盖了哪种故障模式。

5. 为一个 6 小时的自主编码任务设计检查点策略。在哪里设置检查点？崩溃后恢复是什么样的？哪些需要新的 HITL？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|---|---|---|
| Workflow | “智能体的脚本” | 确定性编排代码；可从事件日志重放 |
| Activity | “一步” | 非确定性单元（LLM 调用、工具调用）；前后均有记录 |
| Event log | “底层存储” | 每次状态转移的持久化记录 |
| Replay | “恢复” | 重新运行工作流；已完成的活动返回日志记录的结果而不重新执行 |
| Checkpoint | “存档点” | 以 thread_id 为键的持久化状态；恢复时以最新为准 |
| thread_id | “会话键” | 划分持久化状态作用域的标识符 |
| 35-minute degradation | “可靠性衰减” | METR：成功率随时程约呈二次方下降 |
| Non-determinism | “重放时漂移” | 墙上时钟、随机数、LLM 输出；必须注册为副作用 |

## 延伸阅读

- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) — 预算、轮次与恢复语义。
- [Microsoft — Agent Framework: human-in-the-loop and checkpointing](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — RequestInfoEvent 形态。
- [LangChain — The Runtime Behind Production Deep Agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) — 具体的运行时需求。
- [OpenAI Agents SDK + Temporal integration (Trigger.dev announcement)](https://trigger.dev) — LLM 调用的活动形态。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 35 分钟退化的出处。