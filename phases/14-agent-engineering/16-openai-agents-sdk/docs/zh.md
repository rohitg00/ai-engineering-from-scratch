# OpenAI Agents SDK：交接、防护栏、追踪

> OpenAI Agents SDK 是构建在 Responses API 之上的轻量级多 Agent 框架。五个原语：Agent、Handoff、Guardrail、Session、Tracing。交接是名为 `transfer_to_<agent>` 的工具。防护栏在输入或输出时触发。追踪默认开启。

**类型：** 学习与构建
**语言：** Python（标准库）
**前置要求：** 阶段 14 · 01（Agent 循环）、阶段 14 · 06（工具使用）
**时长：** 约 75 分钟

## 学习目标

- 说出 OpenAI Agents SDK 的五个原语。
- 解释交接（handoffs）：为什么它们被建模为工具，模型看到的名称形态，以及上下文如何转移。
- 区分输入防护栏、输出防护栏和工具防护栏；解释 `run_in_parallel` vs 阻塞模式。
- 实现一个带有交接 + 防护栏 + span 风格追踪的标准库运行时。

## 问题背景

无法干净委托的 Agent 最终会将所有内容塞进一个提示。没有防护栏的 Agent 会泄漏 PII、输出违反策略的内容，或永远循环。OpenAI 的 SDK 将使多 Agent 工作可处理的三个原语形式化。

## 核心概念

### 五个原语

1. **Agent。** LLM + 指令 + 工具 + 交接。
2. **Handoff（交接）。** 委托给另一个 Agent。对模型表示为名为 `transfer_to_<agent_name>` 的工具。
3. **Guardrail（防护栏）。** 对输入（仅第一个 Agent）、输出（仅最后一个 Agent）或工具调用（每个函数工具）的验证。
4. **Session（会话）。** 跨回合的自动对话历史。
5. **Tracing（追踪）。** 内置于 LLM 生成、工具调用、交接、防护栏的 span。

### 作为工具的交接

模型在其工具列表中看到 `transfer_to_billing_agent`。调用它向运行时发出信号以：

1. 复制对话上下文（或通过 `nest_handoff_history` beta 压缩它）。
2. 使用其指令初始化目标 Agent。
3. 继续与目标 Agent 一起运行。

这是产品化的监督器模式（第 13 课 / 第 28 课）。

### 防护栏

三种形式：

- **输入防护栏（Input guardrails）。** 在第一个 Agent 的输入上运行。在任何 LLM 调用之前拒绝不安全或范围外的请求。
- **输出防护栏（Output guardrails）。** 在最后一个 Agent 的输出上运行。捕获 PII 泄漏、策略违规、格式错误的响应。
- **工具防护栏（Tool guardrails）。** 按函数工具运行。验证参数、检查权限、审计执行。

模式：

- **并行（Parallel）**（默认）。防护栏 LLM 与主 LLM 一起运行。较低的尾部延迟。如果触发，主 LLM 的工作被丢弃（token 浪费）。
- **阻塞（Blocking）**（`run_in_parallel=False`）。防护栏 LLM 先运行。如果触发，主调用不浪费 token。

触发线引发 `InputGuardrailTripwireTriggered` / `OutputGuardrailTripwireTriggered`。

### 追踪

默认开启。每个 LLM 生成、工具调用、交接和防护栏发出一个 span。`OPENAI_AGENTS_DISABLE_TRACING=1` 选择退出。`add_trace_processor(processor)` 将 span 扇出到你自己的后端，与 OpenAI 的并行。

### 会话

`Session` 在后端（SQLite、Redis、自定义）中存储对话历史。`Runner.run(agent, input, session=session)` 自动加载和追加。

### 这种模式哪里会出错

- **交接漂移（Handoff drift）。** Agent A 交接给 Agent B，后者又交回到 Agent A。添加跳数计数器。
- **防护栏绕过。** 工具防护栏仅在函数工具上触发；内置工具（文件阅读器、网页获取）需要单独的策略。
- **过度追踪。** Span 中的敏感内容。与 OTel GenAI 内容捕获规则（第 23 课）配对——外部存储，按 ID 引用。

## 构建它

`code/main.py` 在标准库中实现 SDK 形态：

- `Agent`、`FunctionTool`、`Handoff`（作为带有转移语义的函数工具）。
- 带有输入/输出/工具防护栏、交接分派和跳数计数器的 `Runner`。
- 一个简单的 span 发射器来显示追踪形态。
- 一个分类 Agent，根据用户的查询交接给账单或支持；一个输入上的防护栏触发。

运行它：

```
python3 code/main.py
```

追踪显示两次成功交接、一次输入防护栏触发，以及与真实 SDK 发出的镜像的 span 树。

## 使用它

- **OpenAI Agents SDK** 用于 OpenAI 优先的产品。
- **Claude Agent SDK**（第 17 课）用于 Claude 优先的产品。
- **LangGraph**（第 13 课）当你想要显式状态和持久恢复时。
- **自定义** 当你需要精确控制时（语音、多提供商、联邦部署）。

## 部署它

`outputs/skill-agents-sdk-scaffold.md` 搭建一个带有分类 Agent、交接、输入/输出/工具防护栏、会话存储和追踪处理器的 Agents SDK 应用程序。

## 练习

1. 添加交接跳数计数器：N 次转移后拒绝。追踪行为。
2. 实现 `nest_handoff_history` 作为一个选项——在转移之前将先前的消息压缩为一个摘要。
3. 编写一个阻塞式输出防护栏。比较会触发它的提示与通过的提示的延迟。
4. 将 `add_trace_processor` 接入 JSON 日志记录器。每个 span 发出什么形态？
5. 阅读 SDK 文档。将你的标准库玩具移植到 `openai-agents-python`。你建模错了什么？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| Agent | "LLM + 指令" | SDK 中的 Agent 类型；拥有工具和交接 |
| Handoff | "转移" | 模型调用的工具，用于委托给另一个 Agent |
| Guardrail | "策略检查" | 对输入 / 输出 / 工具调用的验证 |
| Tripwire | "防护栏触发" | 防护栏拒绝时引发的异常 |
| Session | "历史存储" | 跨运行持久化的对话记忆 |
| Tracing | "Spans" | 内置的可观测性，覆盖 LLM + 工具 + 交接 + 防护栏 |
| Blocking guardrail | "顺序检查" | 防护栏先运行；触发时不浪费 token |
| Parallel guardrail | "并发检查" | 防护栏并行运行；较低的延迟，触发时浪费 token |

## 延伸阅读

- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/)——原语、交接、防护栏、追踪
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview)——Claude 风味的对应物
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)——何时使用交接
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)——标准 Agents SDK span 映射到的地方
