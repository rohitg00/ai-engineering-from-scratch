# 16 · OpenAI Agents SDK：交接、护栏与追踪

> OpenAI Agents SDK 是构建在 Responses API 之上的轻量级多智能体框架。五个核心原语：Agent、Handoff、Guardrail、Session、Tracing。交接（Handoff）以名为 `transfer_to_<agent>` 的工具形式呈现。护栏（Guardrail）会在输入或输出上触发。追踪（Tracing）默认开启。

**类型：** 学习 + 构建
**语言：** Python（标准库）
**前置：** 阶段 14 · 01（智能体循环）、阶段 14 · 06（工具调用）
**时长：** 约 75 分钟

## 学习目标

- 说出 OpenAI Agents SDK 的五个核心原语。
- 解释交接（handoff）：为什么把它建模为工具、模型看到的名称形态是什么，以及上下文如何转移。
- 区分输入护栏、输出护栏与工具护栏；解释 `run_in_parallel` 与阻塞模式（blocking mode）的区别。
- 用标准库实现一套带交接、护栏与跨度式（span-style）追踪的运行时。

## 问题所在

无法干净地委派任务的智能体，最终会把所有内容都塞进一个提示里。缺少护栏的智能体会泄露个人身份信息（PII）、产出违反策略的输出，或者陷入无限循环。OpenAI 的 SDK 把让多智能体协作变得可控的三个原语固化了下来。

## 核心概念

### 五个原语

1. **Agent（智能体）。** LLM + 指令 + 工具 + 交接。
2. **Handoff（交接）。** 把任务委派给另一个智能体。对模型而言，它表现为一个名为 `transfer_to_<agent_name>` 的工具。
3. **Guardrail（护栏）。** 对输入（仅首个智能体）、输出（仅最后一个智能体）或工具调用（针对每个函数工具）进行校验。
4. **Session（会话）。** 跨多轮自动维护对话历史。
5. **Tracing（追踪）。** 为 LLM 生成、工具调用、交接、护栏内置跨度（span）。

### 把交接建模为工具

模型会在其工具列表中看到 `transfer_to_billing_agent`。调用它会向运行时发出信号，要求：

1. 复制对话上下文（或通过 `nest_handoff_history` beta 特性将其折叠）。
2. 用目标智能体的指令初始化它。
3. 用目标智能体继续这次运行。

这就是监督者模式（supervisor pattern，第 13 课 / 第 28 课）的产品化形态。

### 护栏

三种类型：

- **输入护栏（Input guardrails）。** 作用于首个智能体的输入。在任何 LLM 调用之前，拒绝不安全或超出范围的请求。
- **输出护栏（Output guardrails）。** 作用于最后一个智能体的输出。捕获 PII 泄露、策略违规、格式错误的响应。
- **工具护栏（Tool guardrails）。** 针对每个函数工具运行。校验参数、检查权限、审计执行过程。

模式：

- **并行（Parallel，默认）。** 护栏 LLM 与主 LLM 并行运行。尾部延迟更低。一旦触发，主 LLM 已完成的工作会被丢弃（造成 token 浪费）。
- **阻塞（Blocking，`run_in_parallel=False`）。** 护栏 LLM 先运行。一旦触发，主调用上不会浪费任何 token。

触发线（Tripwire）会抛出 `InputGuardrailTripwireTriggered` / `OutputGuardrailTripwireTriggered`。

### 追踪

默认开启。每一次 LLM 生成、工具调用、交接和护栏都会发出一个跨度（span）。`OPENAI_AGENTS_DISABLE_TRACING=1` 可关闭追踪。`add_trace_processor(processor)` 可在向 OpenAI 发送跨度的同时，把跨度分发到你自己的后端。

### 会话

`Session` 把对话历史存储在某个后端（SQLite、Redis 或自定义）中。`Runner.run(agent, input, session=session)` 会自动加载并追加历史。

### 这种模式在哪里会出问题

- **交接漂移（Handoff drift）。** 智能体 A 交接给智能体 B，B 又交回给 A。加一个跳数计数器（hop counter）。
- **护栏绕过（Guardrail bypass）。** 工具护栏只对函数工具生效；内置工具（文件读取器、网页抓取）需要单独的策略。
- **追踪过度（Over-tracing）。** 跨度中包含敏感内容。请与 OTel GenAI 的内容捕获规则（第 23 课）配合使用——把内容存到外部，仅按 ID 引用。

## 动手构建

`code/main.py` 用标准库实现了该 SDK 的形态：

- `Agent`、`FunctionTool`、`Handoff`（以一个带转移语义的函数工具形式存在）。
- `Runner`，带有输入/输出/工具护栏、交接调度和跳数计数器。
- 一个简单的跨度发射器，用来展示追踪的形态。
- 一个分诊智能体（triage agent），根据用户查询交接给计费（billing）或支持（support）智能体；其中一条输入会触发护栏。

运行它：

```
python3 code/main.py
```

追踪会显示两次成功的交接、一次输入护栏触发，以及一棵镜像真实 SDK 所发出形态的跨度树。

## 实际运用

- **OpenAI Agents SDK** 适用于以 OpenAI 为先的产品。
- **Claude Agent SDK**（第 17 课）适用于以 Claude 为先的产品。
- **LangGraph**（第 13 课）适用于你需要显式状态和持久化恢复（durable resume）的场景。
- **自定义** 适用于你需要精确控制的场景（语音、多供应商、联邦化部署）。

## 交付落地

`outputs/skill-agents-sdk-scaffold.md` 会脚手架生成一个 Agents SDK 应用，包含分诊智能体、交接、输入/输出/工具护栏、会话存储和一个追踪处理器（trace processor）。

## 练习

1. 添加一个交接跳数计数器：在 N 次转移后拒绝交接。追踪其行为。
2. 把 `nest_handoff_history` 实现为一个可选项——在转移之前把先前的消息折叠成一份摘要。
3. 编写一个阻塞式输出护栏。比较在会触发它的提示与能通过的提示之间的延迟差异。
4. 把 `add_trace_processor` 接到一个 JSON 日志记录器上。它在每个跨度上发出的是什么形态？
5. 阅读 SDK 文档。把你的标准库玩具版移植到 `openai-agents-python`。你哪里建模错了？

## 关键术语

| 术语 | 人们常说的 | 它实际的含义 |
|------|----------------|------------------------|
| Agent | “LLM + 指令” | SDK 中的 Agent 类型；拥有工具和交接 |
| Handoff | “转移” | 模型调用以委派给另一个智能体的工具 |
| Guardrail | “策略检查” | 对输入 / 输出 / 工具调用的校验 |
| Tripwire | “护栏触发” | 护栏拒绝时抛出的异常 |
| Session | “历史存储” | 在多次运行之间持久化的对话记忆 |
| Tracing | “跨度” | 覆盖 LLM + 工具 + 交接 + 护栏的内置可观测性 |
| Blocking guardrail | “顺序检查” | 护栏先运行；触发时不浪费 token |
| Parallel guardrail | “并发检查” | 护栏并行运行；延迟更低，但触发时浪费 token |

## 延伸阅读

- [OpenAI Agents SDK 文档](https://openai.github.io/openai-agents-python/) — 原语、交接、护栏、追踪
- [Claude Agent SDK 概览](https://platform.claude.com/docs/en/agent-sdk/overview) — Claude 风味的对应方案
- [Anthropic，《构建高效智能体》](https://www.anthropic.com/research/building-effective-agents) — 究竟何时该动用交接
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — Agents SDK 跨度所映射到的标准
