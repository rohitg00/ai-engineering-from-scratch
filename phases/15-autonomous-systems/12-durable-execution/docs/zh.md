# 12 · 长时运行的后台智能体：持久化执行

> 生产级的长时程智能体不会跑在 `while True` 循环里。每一次 LLM 调用都会成为一个带检查点（checkpoint）、重试（retry）与重放（replay）的活动（activity）。Temporal 对 OpenAI Agents SDK 的集成已于 2026 年 3 月正式发布（GA）。Claude Code Routines（Anthropic）无需常驻本地进程即可运行已排程的 Claude Code 调用。会话会在等待人工输入时暂停、在部署更迭中存活，并从以 `thread_id` 为键的最新检查点恢复。在这些全新的工程学体验背后，是一个古老的模式——工作流编排（workflow orchestration）——只是多了一个新输入：把 LLM 调用视作非确定性的活动，并在恢复时确定性地重放。

**类型：** 学习
**语言：** Python（标准库，极简持久化执行状态机）
**前置：** 阶段 15 · 10（权限模式）、阶段 15 · 01（长时程智能体）
**时长：** 约 60 分钟

## 问题所在

设想一个运行四小时的智能体。它调用三个工具、两次向用户发起询问、做出四十次 LLM 调用。进行到一半时，它所运行的主机重启了。会发生什么？

- 在一个朴素的 `while True` 循环里：一切尽失。整个运行从头开始。三个工具调用（带有真实副作用）再次执行。用户被再次询问那些他们早已批准过的事项。四十次 LLM 调用被重新计费。
- 采用持久化执行（durable execution）：运行从最近的检查点恢复。已完成的活动不会被重新执行；它们的结果从持久化日志中重放出来。用户不会被要求再次批准已批准过的事项。已经发出的 LLM 调用不会被重新计费。

这正是工作流引擎已经交付了十年的同一个模式（Temporal、Cadence、Uber 的 Cherami）。新的地方在于：LLM 调用如今成了一类活动——非确定性、昂贵、带副作用——而且它们干净利落地契合这个模式。

本课贯穿始终的主题是：长时程可靠性会衰减（METR 观察到一种「35 分钟退化」——成功率大致随时程呈二次方下降）。持久化执行使得运行时长可以超出可靠性曲线所能支撑的范围，这是一种全新的失败方式——设计得当时安全地失败，设计不当时则不安全地失败。

## 核心概念

### 活动、工作流与重放

- **工作流（Workflow）**：确定性的编排代码。定义活动的序列、分支与等待。它必须是确定性的，才能从事件日志（event log）中重放而不出现意外的发散。
- **活动（Activity）**：一个非确定性的、可能失败的工作单元。LLM 调用、工具调用、文件写入、HTTP 请求都算。每个活动都会连同它的输入、以及（一旦完成时）它的输出一起被记入日志。
- **事件日志（Event log）**：持久化的后端存储。每一次活动的开始、完成、失败、重试，以及每一个工作流决策都会被记录。
- **重放（Replay）**：恢复时，工作流代码从头重新运行；每个已完成的活动都直接返回其记录在案的结果，而不会被重新执行。只有那些尚未完成的活动才会被真正运行。

这与 React 针对虚拟 DOM 重新渲染（re-render）、或者 Git 从提交记录重建工作树是同一种形态。编排器中的确定性，正是让持久化变得廉价的关键。

### 为什么 LLM 调用契合这个模式

LLM 调用具有以下特征：
- 非确定性（temperature > 0；即便 temperature 为 0，跨模型版本也会漂移）。
- 昂贵（金钱与延迟）。
- 可能失败（速率限制、超时）。
- 带副作用（如果它们调用了工具）。

这恰好就是活动的特征画像。把每一次 LLM 调用都包装为一个活动，你就获得了带指数退避（exponential backoff）的重试、跨重启的检查点，以及一条可重放的、用于调试的轨迹。

### 以 `thread_id` 为键的检查点

LangGraph、Microsoft Agent Framework、Cloudflare Durable Objects 以及 Claude Code Routines 都收敛到了同一种 API 形态：用一个 `thread_id`（或等价物）标识会话；每一次状态转移都持久化到某个后端（默认 PostgreSQL，开发环境用 SQLite，缓存用 Redis）；恢复时读取最新的检查点。

后端的选择很重要：

- **PostgreSQL**：持久、可查询、能在部署更迭中存活。LangGraph 的默认选项。
- **SQLite**：仅限本地开发；跨主机会丢失数据。
- **Redis**：快，但除非配置了 AOF/快照，否则是易失的。
- **Cloudflare Durable Objects**：透明分布式；按唯一键作用域隔离；存活时长可从数小时到数周。

### 把人工输入视作一等公民状态

「先提议后提交」（propose-then-commit，第 15 课）需要一个持久化的「等待人工」状态。工作流暂停，外部队列保管待处理的请求，一次批准则从那个确切的点恢复。没有持久化，这只能尽力而为；有了它，一份过夜的批准在清晨送达，工作流便在早晨接续运行。

### 35 分钟退化

METR 观察到：所有被测量的智能体类别，在连续运行约 35 分钟之后都会出现可靠性衰减。任务时长翻倍，失败率大致翻两番。持久化执行并不能修复这一点；它只是让你能运行得比可靠性曲线所支撑的更久。安全的做法是：把持久化与「在重新进入时要求新一轮人在回路（HITL）」的检查点相结合，再配上预算熔断开关（kill switch，第 13 课）——无论挂钟时间多长，都为总算力设上限。

### 何时持久化执行是错误的答案

- 短于几分钟、且无人工输入的运行。开销大于收益。
- 严格只读的信息检索。
- 正确性要求在单个上下文窗口内端到端完成的任务（某些推理任务；某些一次性生成）。

## 动手用

`code/main.py` 用标准库 Python 实现了一个极简的持久化执行引擎。它支持：

- `@activity` 装饰器，将输入与输出记录到一个 JSON 事件日志中。
- 一个对活动进行编排排序的工作流函数。
- 一个 `run_or_replay(workflow, event_log)` 函数，它重放已完成的活动而不重新执行它们。

驱动程序模拟一个含三个活动的工作流，在进行到一半时崩溃，并展示：(a) 朴素重试把所有东西重新执行一遍，对比 (b) 重放只运行缺失的那个活动。

## 上线交付

`outputs/skill-durable-execution-review.md` 针对一个提案中的长时运行智能体部署，评审其是否具备正确的持久化执行形态：活动、确定性、检查点后端、人工输入状态，以及恢复时的人在回路（HITL-on-resume）策略。

## 练习

1. 运行 `code/main.py`。观察朴素重试与重放在「活动执行次数」上的差异。改变崩溃点，展示重放次数随之相应变化。

2. 把这个玩具引擎改造为显式使用 `thread_id`。模拟两个共享同一引擎的并发会话，并确认它们的事件日志不会相互冲突。

3. 取玩具引擎中的某一个活动。引入一处非确定性（在某个工作流决策内部使用一个挂钟时间戳）。演示重放时的发散。解释真实引擎如何处理这一点（副作用注册、`Workflow.now()` 类 API）。

4. 阅读 LangChain 的《Runtime behind production deep agents》一文。列出运行时持久化的每一项状态，并指出每一项各自覆盖了哪种失败模式。

5. 为一个 6 小时的自主编码任务设计一套检查点策略。你在哪里设检查点？崩溃恢复看起来是什么样？哪些环节需要新一轮人在回路（HITL）？

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|---|---|---|
| Workflow | 「智能体的脚本」 | 确定性的编排代码；可从事件日志重放 |
| Activity | 「一个步骤」 | 非确定性单元（LLM 调用、工具调用）；前后都记入日志 |
| Event log | 「后端存储」 | 每一次状态转移的持久化记录 |
| Replay | 「恢复」 | 重新运行工作流；已完成的活动返回记录的结果而不重新执行 |
| Checkpoint | 「保存点」 | 以 thread_id 为键持久化的状态；恢复时以最新者为准 |
| thread_id | 「会话键」 | 划定持久化状态作用域的标识符 |
| 35 分钟退化 | 「可靠性衰减」 | METR：成功率随时程大致呈二次方下降 |
| 非确定性 | 「重放时漂移」 | 挂钟、随机、LLM 输出；必须注册为副作用 |

## 延伸阅读

- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) — 预算、轮次与恢复语义。
- [Microsoft — Agent Framework: human-in-the-loop and checkpointing](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — RequestInfoEvent 的形态。
- [LangChain — The Runtime Behind Production Deep Agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) — 具体的运行时需求。
- [OpenAI Agents SDK + Temporal integration (Trigger.dev announcement)](https://trigger.dev) — LLM 调用的活动形态。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 35 分钟退化的出处。
