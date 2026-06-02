# OpenAI Agents SDK：Handoff、Guardrail、Tracing

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> OpenAI Agents SDK 是构建在 Responses API 之上的轻量级多 agent 框架。五个原语：Agent、Handoff（交接）、Guardrail（护栏）、Session、Tracing。Handoff 以名为 `transfer_to_<agent>` 的工具形式呈现。Tracing 默认开启。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 说出 OpenAI Agents SDK 的五个原语。
- 解释 handoff（交接）：为什么把它建模为工具、模型看到的名字形态是什么、上下文如何传递。
- 区分 input guardrail、output guardrail 和 tool guardrail；解释 `run_in_parallel` 与 blocking 模式的差别。
- 用标准库实现一个带 handoff + guardrail + span 风格 tracing 的运行时。

## 问题（The Problem）

不会干净地委派任务的 agent 最后只能把所有东西塞进一个 prompt。没有 guardrail 的 agent 会泄露 PII、输出违反政策的内容，或者死循环。OpenAI 的 SDK 把让多 agent 协作变得可行的三个原语固化了下来。

## 概念（The Concept）

### 五个原语（Five primitives）

1. **Agent。** LLM + instructions + tools + handoffs。
2. **Handoff。** 委派给另一个 agent。在模型那侧表现为一个名为 `transfer_to_<agent_name>` 的工具。
3. **Guardrail。** 对输入（仅首个 agent）、输出（仅末个 agent）或工具调用（针对每个 function tool）的校验。
4. **Session。** 跨轮次自动保存对话历史。
5. **Tracing。** LLM 生成、工具调用、handoff、guardrail 都有内建的 span。

### Handoff 即工具（Handoffs as tools）

模型在它的工具列表里看到 `transfer_to_billing_agent`。一旦调用，运行时会：

1. 复制对话上下文（或者通过 `nest_handoff_history` beta 把它折叠掉）。
2. 用目标 agent 的 instructions 初始化它。
3. 用目标 agent 继续这次运行。

这就是 supervisor 模式（Lesson 13 / Lesson 28）的产品化。

### Guardrail（护栏）

三种口味：

- **Input guardrail。** 跑在首个 agent 的输入上。在任何 LLM 调用之前就拒掉不安全或越界的请求。
- **Output guardrail。** 跑在末个 agent 的输出上。捕获 PII 泄露、政策违规、格式错误的响应。
- **Tool guardrail。** 按 function tool 逐个跑。校验参数、检查权限、审计执行。

模式：

- **Parallel（并行，默认）。** Guardrail LLM 与主 LLM 并行跑。尾延迟更低。一旦触发，主 LLM 的成果会被丢弃（浪费 token）。
- **Blocking（阻塞，`run_in_parallel=False`）。** Guardrail LLM 先跑。一旦触发，主调用上一个 token 都不浪费。

Tripwire（触发线）会抛出 `InputGuardrailTripwireTriggered` / `OutputGuardrailTripwireTriggered`。

### Tracing

默认开启。每次 LLM 生成、工具调用、handoff、guardrail 都会发出一个 span。`OPENAI_AGENTS_DISABLE_TRACING=1` 可以关掉。`add_trace_processor(processor)` 可以把 span 同时分发到你自己的后端和 OpenAI。

### Session

`Session` 把对话历史存到某个后端（SQLite、Redis、自定义）。`Runner.run(agent, input, session=session)` 会自动加载并追加。

### 这套范式会在哪儿翻车（Where this pattern goes wrong）

- **Handoff 漂移（Handoff drift）。** Agent A 交接给 Agent B，Agent B 又交接回 Agent A。加一个 hop 计数器。
- **Guardrail 绕过（Guardrail bypass）。** Tool guardrail 只对 function tool 生效；内建工具（文件读取、网页抓取）需要单独的政策。
- **Tracing 过度（Over-tracing）。** 敏感内容跑进了 span。配合 OTel GenAI 内容捕获规则（Lesson 23）—— 把内容存在外部，span 里只引 ID。

## 动手实现（Build It）

`code/main.py` 用标准库实现了 SDK 的形态：

- `Agent`、`FunctionTool`、`Handoff`（作为带 transfer 语义的 function tool）。
- `Runner`，带输入/输出/工具 guardrail、handoff 派发，以及 hop 计数器。
- 一个简单的 span 发射器，用来展示 trace 的形状。
- 一个 triage agent，根据用户问题把请求交接给 billing 或 support；其中一条输入会触发 guardrail。

跑起来：

```
python3 code/main.py
```

Trace 里会看到两次成功的 handoff、一次 input guardrail 触发，以及一棵 span 树，形态与真实 SDK 发出的对得上。

## 用起来（Use It）

- **OpenAI Agents SDK** —— 用于 OpenAI 优先的产品。
- **Claude Agent SDK**（Lesson 17）—— 用于 Claude 优先的产品。
- **LangGraph**（Lesson 13）—— 当你想要显式状态和持久化恢复时。
- **Custom**（自研）—— 当你需要精确控制（语音、多 provider、联邦部署）时。

## 上线部署（Ship It）

`outputs/skill-agents-sdk-scaffold.md` 帮你脚手架一个 Agents SDK 应用：triage agent、handoff、输入/输出/工具 guardrail、session 存储，以及一个 trace processor。

## 练习（Exercises）

1. 加一个 handoff hop 计数器：超过 N 次 transfer 后拒绝。把行为追踪下来。
2. 把 `nest_handoff_history` 实现成一个选项——在 transfer 之前把之前的消息折叠成一段 summary。
3. 写一个 blocking 模式的 output guardrail。在会触发它的 prompt 与不会触发的 prompt 上对比延迟。
4. 把 `add_trace_processor` 接到一个 JSON logger。它每个 span 发出的形状是什么样？
5. 读一遍 SDK 文档。把你的标准库玩具移植到 `openai-agents-python`。你建模错了哪些地方？

## 关键术语（Key Terms）

| 术语 | 大家嘴上的说法 | 实际含义 |
|------|----------------|---------|
| Agent | "LLM + instructions" | SDK 里的 Agent 类型；持有 tools 和 handoffs |
| Handoff | "Transfer（转交）" | 模型调用以委派给另一个 agent 的工具 |
| Guardrail | "Policy check（政策检查）" | 对输入 / 输出 / 工具调用的校验 |
| Tripwire | "Guardrail 触发" | guardrail 拒绝时抛出的异常 |
| Session | "History store（历史存储）" | 跨次运行持久化的对话记忆 |
| Tracing | "Spans" | 覆盖 LLM + tool + handoff + guardrail 的内建可观测性 |
| Blocking guardrail | "Sequential check（顺序检查）" | guardrail 先跑；触发时不浪费 token |
| Parallel guardrail | "Concurrent check（并发检查）" | guardrail 并行跑；延迟更低，触发时浪费 token |

## 延伸阅读（Further Reading）

- [OpenAI Agents SDK 文档](https://openai.github.io/openai-agents-python/) —— 原语、handoff、guardrail、tracing
- [Claude Agent SDK 概览](https://platform.claude.com/docs/en/agent-sdk/overview) —— Claude 风味的对应物
- [Anthropic，Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) —— 到底什么时候才该上 handoff
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— Agents SDK 的 span 对齐到的标准
