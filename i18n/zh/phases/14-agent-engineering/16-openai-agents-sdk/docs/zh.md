# OpenAI Agents SDK：Handoff、Guardrail、Tracing

> OpenAI Agents SDK 是构建在 Responses API 之上的轻量级多智能体框架。包含五个原语：Agent、Handoff、Guardrail、Session、Tracing。Handoff 是名为 `transfer_to_<agent>` 的工具。Guardrail 在输入或输出时触发。Tracing 默认开启。

**Type:** Learn + Build
**Languages:** Python（标准库）
**Prerequisites:** Phase 14 · 01（Agent Loop）、Phase 14 · 06（Tool Use）
**Time:** 约 75 分钟

## 学习目标

- 说出 OpenAI Agents SDK 的五个原语。
- 解释 handoff：为什么将其建模为工具、模型看到的名称形状是什么，以及上下文如何传递。
- 区分输入 guardrail、输出 guardrail 和工具 guardrail；解释 `run_in_parallel` 与阻塞模式的区别。
- 用标准库实现一个包含 handoff、guardrail 和 span 风格 tracing 的运行时。

## 问题

无法干净地委派任务的 Agent 最终会把所有内容塞进一个 prompt 里。没有 guardrail 的 Agent 会泄露 PII、输出违反策略的内容，或无限循环。OpenAI 的 SDK 将使多智能体工作可控的三个原语规范化。

## 概念

### 五个原语

1. **Agent。** LLM + 指令 + 工具 + handoff。
2. **Handoff。** 委派给另一个 Agent。以名为 `transfer_to_<agent_name>` 的工具形式呈现给模型。
3. **Guardrail。** 在输入（仅第一个 agent）、输出（仅最后一个 agent）或工具调用（每个 function tool）上进行校验。
4. **Session。** 跨轮次的自动对话历史。
5. **Tracing。** 内置的 span，覆盖 LLM 生成、工具调用、handoff、guardrail。

### Handoff 即工具

模型在其工具列表中看到 `transfer_to_billing_agent`。调用它表示运行时将：

1. 复制对话上下文（或通过 `nest_handoff_history` beta 将其压缩）。
2. 用其指令初始化目标 agent。
3. 由目标 agent 继续运行。

这就是被产品化的监督者模式（Lesson 13 / Lesson 28）。

### Guardrail

三种类型：

- **输入 guardrail。** 在第一个 agent 的输入上运行。在任何 LLM 调用之前拒绝不安全或超出范围的请求。
- **输出 guardrail。** 在最后一个 agent 的输出上运行。捕获 PII 泄露、策略违规、格式错误的响应。
- **工具 guardrail。** 在每个 function tool 上运行。校验参数、检查权限、审计执行。

模式：

- **并行**（默认）。Guardrail LLM 与主 LLM 并行运行。尾部延迟更低。如果触发，主 LLM 的工作将被丢弃（浪费 token）。
- **阻塞**（`run_in_parallel=False`）。Guardrail LLM 先运行。如果触发，主调用不会浪费任何 token。

触发 tripwire 时会抛出 `InputGuardrailTripwireTriggered` / `OutputGuardrailTripwireTriggered`。

### Tracing

默认开启。每次 LLM 生成、工具调用、handoff 和 guardrail 都会发出一个 span。`OPENAI_AGENTS_DISABLE_TRACING=1` 用于退出。`add_trace_processor(processor)` 会将 span 与 OpenAI 的一同发送到你自己的后端。

### Session

`Session` 将对话历史存储在后端（SQLite、Redis、自定义）。`Runner.run(agent, input, session=session)` 自动加载并追加。

### 这种模式何时会出问题

- **Handoff 漂移。** Agent A 交给 Agent B，后者又交回给 Agent A。需要添加跳数计数器。
- **Guardrail 绕过。** 工具 guardrail 仅在 function tool 上触发；内置工具（文件读取、网页抓取）需要单独的策略。
- **过度追踪。** span 中包含敏感内容。配合 OTel GenAI 内容捕获规则（Lesson 23）——外部存储，按 ID 引用。

```figure
ae-agent-handoff
```

## 动手实现

`code/main.py` 用标准库实现了 SDK 的形态：

- `Agent`、`FunctionTool`、`Handoff`（作为具有转移语义的 function tool）。
- `Runner`，带有输入/输出/工具 guardrail、handoff 分发和跳数计数器。
- 一个简单的 span 发射器，用于展示 trace 的形态。
- 一个分诊 agent，根据用户查询交给 billing 或 support；guardrail 会在某个输入上触发。

运行它：

```
python3 code/main.py
```

trace 显示两次成功的 handoff、一次输入 guardrail 触发，以及一棵与真实 SDK 发出的结果类似的 span 树。

## 何时使用

- **OpenAI Agents SDK**：面向 OpenAI 优先的产品。
- **Claude Agent SDK**（Lesson 17）：面向 Claude 优先的产品。
- **LangGraph**（Lesson 13）：当你需要显式状态和持久化恢复时。
- **自研**：当你需要精确控制时（语音、多供应商、联合部署）。

## 上线建议

`outputs/skill-agents-sdk-scaffold.md` 可搭建一个 Agents SDK 应用，包含分诊 agent、handoff、输入/输出/工具 guardrail、session 存储和 trace 处理器。

## 练习

1. 添加 handoff 跳数计数器：在 N 次转移后拒绝。追踪该行为。
2. 将 `nest_handoff_history` 实现为一个选项——在转移前将先前的消息压缩成一份摘要。
3. 编写一个阻塞式输出 guardrail。对比在会触发它和不会触发的 prompt 上的延迟。
4. 将 `add_trace_processor` 接入 JSON 日志器。它对每个 span 发出什么形状的数据？
5. 阅读 SDK 文档。将你的标准库玩具移植到 `openai-agents-python`。你建模错了什么？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| Agent | "LLM + 指令" | SDK 中的 Agent 类型；拥有工具和 handoff |
| Handoff | "转移" | 模型为委派给另一个 agent 而调用的工具 |
| Guardrail | "策略检查" | 在输入/输出/工具调用上的校验 |
| Tripwire | "guardrail 触发" | guardrail 拒绝时抛出的异常 |
| Session | "历史存储" | 在多次运行之间持久化的对话记忆 |
| Tracing | "span" | 覆盖 LLM + 工具 + handoff + guardrail 的内置可观测性 |
| 阻塞式 guardrail | "顺序检查" | guardrail 先运行；触发时不浪费 token |
| 并行 guardrail | "并发检查" | guardrail 并行运行；延迟更低，触发时浪费 token |

## 延伸阅读

- [OpenAI Agents SDK 文档](https://openai.github.io/openai-agents-python/) — 原语、handoff、guardrail、tracing
- [Claude Agent SDK 概览](https://platform.claude.com/docs/en/agent-sdk/overview) — Claude 风格的对应方案
- [Anthropic，Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — 何时该使用 handoff
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — Agents SDK 的 span 所映射的标准