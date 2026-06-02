# 长时运行的后台 agent：持久化执行（Durable Execution）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 生产级的长链路 agent 不会跑在 `while True` 里。每一次 LLM 调用都变成一个带 checkpoint、重试和回放（replay）的 activity。Temporal 的 OpenAI Agents SDK 集成已于 2026 年 3 月 GA。Anthropic 的 Claude Code Routines 以定时调用 Claude Code 的方式运行，不需要常驻本地进程。会话在等待人工输入时暂停，能跨部署存活，并按 `thread_id` 从最新的 checkpoint 恢复。这套新工效学的背后，藏着一个老 pattern——workflow 编排——只多了一项新输入：把 LLM 调用当作非确定性的 activity，并要求它们在恢复时被确定性地回放。

**Type:** Learn
**Languages:** Python（标准库，最小化的持久化执行状态机）
**Prerequisites:** Phase 15 · 10（权限模式 / Permission modes）, Phase 15 · 01（长链路 agent / Long-horizon agents）
**Time:** ~60 分钟

## 问题（The Problem）

设想一个跑了四个小时的 agent。它调用了三个 tool、两次向用户确认、做了 40 次 LLM 调用。跑到一半，宿主机重启了。会发生什么？

- 朴素的 `while True` 循环里：所有进度全丢。整个 run 从头来一遍。那三个 tool 调用（带真实 side effect）会再执行一次。用户已经批准过的事情会再被问一次。40 次 LLM 调用被重新计费。
- 用持久化执行（durable execution）：run 从最近的 checkpoint 恢复。已完成的 activity 不会被重新执行；它们的结果会从持久化日志里回放出来。用户不会被再次问已经批准过的事情。已经发生的 LLM 调用不会被重新计费。

这就是 workflow 引擎过去十年里一直在交付的那套 pattern（Temporal、Cadence、Uber 的 Cherami）。新东西在于：LLM 调用现在变成了一种 activity——非确定性、昂贵、带 side effect——而它恰好能干净地嵌进这套 pattern 里。

本课的暗线主题：长链路可靠性会衰减（METR 观察到一个「35 分钟衰减」现象——成功率大致与时间跨度的平方成反比下降）。持久化执行让你能跑得比可靠性曲线所支持的更长，这就是一种新的失败方式：设计对了它会安全地失败，设计错了它会不安全地失败。

## 概念（The Concept）

### Activity、workflow 与回放（Activities, workflows, and replay）

- **Workflow**：确定性的编排代码。定义 activity 的顺序、分支、等待。必须是确定性的，才能从事件日志里回放，而不会出现意外的分叉。
- **Activity**：一个非确定性、可能失败的工作单元。LLM 调用、tool 调用、文件写入、HTTP 请求。每个 activity 的输入会被记日志，完成后输出也会被记日志。
- **Event log（事件日志）**：持久化的后端存储。每个 activity 的开始、完成、失败、重试，以及每个 workflow 决策都会被记录。
- **Replay（回放）**：恢复时，workflow 代码会从头再跑一遍；任何已完成的 activity 都会直接返回它日志里记录的结果，不会重新执行。只有那些没完成的 activity 才会真正被运行。

这跟 React 拿 virtual DOM 重新渲染、Git 从 commit 重建工作树是同一个形状。编排器的确定性，是让持久化变得廉价的关键。

### 为什么 LLM 调用契合这套 pattern（Why LLM calls fit the pattern）

LLM 调用具有：
- 非确定性（temperature > 0；即便 temperature 0，跨模型版本也会漂移）。
- 昂贵（金钱与延迟）。
- 可能失败（rate limit、超时）。
- 带 side effect（如果它会触发 tool 调用）。

这恰好就是 activity 的画像。把每次 LLM 调用都包成一个 activity，你就免费拿到了带指数退避的重试、跨重启的 checkpoint，以及一条可回放的 trace 用于调试。

### 按 `thread_id` 索引的 checkpoint（Checkpoints keyed by `thread_id`）

LangGraph、Microsoft Agent Framework、Cloudflare Durable Objects 和 Claude Code Routines 都收敛到了相同的 API 形状：用一个 `thread_id`（或同义物）来标识会话；每次状态转移都持久化到一个后端（默认 PostgreSQL、开发用 SQLite、做缓存用 Redis）；恢复时读取最新的 checkpoint。

后端的选择很重要：

- **PostgreSQL**：持久、可查询、能跨部署存活。LangGraph 的默认后端。
- **SQLite**：仅适用于本地开发；跨主机会丢数据。
- **Redis**：快，但除非配置了 AOF 或快照，否则是易失的。
- **Cloudflare Durable Objects**：透明分布式；按一个唯一 key 划分作用域；可存活数小时到数周。

### 把人工输入当作一等公民状态（Human-input as a first-class state）

Propose-then-commit（第 15 课）需要一个持久化的「等待人工」状态。Workflow 暂停，外部队列持有这条挂起的请求，一次审批从那个准确的位置上恢复。没有持久化时，这只能是 best-effort；有了它，一次过夜审批可以早上回来再继续，workflow 接着跑。

### 35 分钟衰减（The 35-minute degradation）

METR 观察到：每一类被测量的 agent 都会在连续运行约 35 分钟之后出现可靠性衰减。任务时长翻倍，失败率大约翻四倍。持久化执行并不能修复这件事；它只是让你能跑得比可靠性曲线允许的更长。安全的 pattern 是把持久化和「重入时要求新一轮 HITL（human-in-the-loop，人工确认）」的 checkpoint 结合起来，再叠加预算开关（第 13 课）来封顶总算力，与 wall-clock 时间无关。

### 什么时候持久化执行不是答案（When durable execution is the wrong answer）

- 短于几分钟、无人工输入的 run。开销大于收益。
- 严格只读的信息检索。
- 那些正确性要求在一个 context window 内端到端完成的任务（部分推理任务；部分一次性生成任务）。

## 用起来（Use It）

`code/main.py` 用 Python 标准库实现了一个极简的持久化执行引擎。它支持：

- `@activity` 装饰器，把输入和输出记到一份 JSON 事件日志里。
- 一个串联 activity 序列的 workflow 函数。
- 一个 `run_or_replay(workflow, event_log)` 函数，会回放已完成的 activity，不重新执行它们。

驱动程序模拟了一个三步 activity 的 workflow，在中途崩溃，并对比展示：(a) 朴素重试会把所有事重跑一遍；(b) 回放只会跑那一个缺失的 activity。

## 上线部署（Ship It）

`outputs/skill-durable-execution-review.md` 用持久化执行的标准形态——activity、确定性、checkpoint 后端、人工输入状态、resume 时是否要求新一轮 HITL——审查一份长时运行 agent 的部署提案。

## 练习（Exercises）

1. 跑一遍 `code/main.py`。观察朴素重试与回放在 activity 执行次数上的差别。改一下崩溃点，演示回放次数会相应变化。

2. 把这个玩具引擎改成显式使用 `thread_id`。模拟两个并发会话共用同一个引擎，验证它们的事件日志不会撞车。

3. 在玩具引擎里挑一个 activity。引入一处非确定性（在某个 workflow 决策里读了一次 wall-clock 时间戳）。演示回放时的发散。说明真实引擎是怎么处理这件事的（side-effect 注册、`Workflow.now()` 之类 API）。

4. 读 LangChain 那篇 "Runtime behind production deep agents"。列出 runtime 持久化的每一项状态，并说出每项对应覆盖了哪种失败模式。

5. 为一个 6 小时的自主编码任务设计 checkpoint 策略。在哪里下 checkpoint？崩溃后 resume 长什么样？哪些地方需要新一轮 HITL？

## 关键术语（Key Terms）

| 术语 | 大家通常怎么说 | 它到底是什么 |
|---|---|---|
| Workflow | 「agent 的脚本」 | 确定性的编排代码；可从事件日志回放 |
| Activity | 「一步」 | 非确定性的工作单元（LLM 调用、tool 调用）；执行前后都记日志 |
| Event log | 「后端存储」 | 每次状态转移的持久化记录 |
| Replay | 「恢复」 | 重跑 workflow；已完成的 activity 直接返回日志里的结果，不再执行 |
| Checkpoint | 「存档点」 | 按 thread_id 索引的持久化状态；resume 时取最新一份 |
| thread_id | 「会话 key」 | 给持久化状态划作用域的标识符 |
| 35-minute degradation | 「可靠性衰减」 | METR：成功率大致随时间跨度平方下降 |
| Non-determinism | 「回放时漂移」 | wall-clock、随机、LLM 输出；必须注册为 side effect |

## 延伸阅读（Further Reading）

- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) — 预算、轮数与 resume 语义。
- [Microsoft — Agent Framework: human-in-the-loop and checkpointing](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — RequestInfoEvent 的形态。
- [LangChain — The Runtime Behind Production Deep Agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) — 具体的 runtime 需求清单。
- [OpenAI Agents SDK + Temporal integration (Trigger.dev announcement)](https://trigger.dev) — 把 LLM 调用塑成 activity 的形态。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — 35 分钟衰减的出处。
