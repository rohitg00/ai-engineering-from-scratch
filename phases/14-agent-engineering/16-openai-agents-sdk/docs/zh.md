# OpenAI Agents SDK：交接（Handoffs）、护栏（Guardrails）、追踪（Tracing）

> OpenAI Agents SDK 是基于 Responses API 的轻量级多智能体框架。五大原语：Agent、Handoff、Guardrail、Session、Tracing。交接是以 `transfer_to_<agent>` 命名的工具。护栏在输入或输出时触发。追踪默认开启。

**类型：** 学习 + 构建
**语言：** Python（标准库）
**前置知识：** 阶段 14 · 01（Agent 循环），阶段 14 · 06（工具使用）
**时长：** ~75 分钟

## 学习目标

- 列举 OpenAI Agents SDK 的五大原语。
- 解释交接：为何将其建模为工具、模型看到的名称格式是什么、上下文如何转移。
- 区分输入护栏、输出护栏和工具护栏；解释 `run_in_parallel` 与阻塞模式的区别。
- 使用标准库实现一个支持交接 + 护栏 + 跨度风格追踪的运行时。

## 问题

无法清晰委托的智能体会将所有内容塞进一个提示词中。没有护栏的智能体会泄露 PII（个人身份信息）、输出违反策略的内容，或者无限循环。OpenAI 的 SDK 将三种原语规范化，使多智能体工作变得可控。

## 概念

### 五大原语

1. **Agent（智能体）。** LLM + 指令 + 工具 + 交接。
2. **Handoff（交接）。** 委托给另一个智能体。对模型而言表现为一个名为 `transfer_to_<agent_name>` 的工具。
3. **Guardrail（护栏）。** 对输入（仅第一个智能体）、输出（仅最后一个智能体）或工具调用（每个函数工具）进行验证。
4. **Session（会话）。** 跨轮次的自动对话历史记录。
5. **Tracing（追踪）。** 内置跨度，覆盖 LLM 生成、工具调用、交接、护栏。

### 交接即工具

模型在其工具列表中看到 `transfer_to_billing_agent`。调用它即指示运行时：

1. 复制对话上下文（或通过 `nest_handoff_history` 测试版折叠上下文）。
2. 使用目标智能体的指令初始化该智能体。
3. 继续由目标智能体运行。

这即是经过产品化的监督者模式（课程 13 / 课程 28）。

### 护栏

三种类型：

- **输入护栏（Input guardrails）。** 在第一个智能体的输入上执行。在任何 LLM 调用之前拒绝不安全或超出范围的请求。
- **输出护栏（Output guardrails）。** 在最后一个智能体的输出上执行。捕获 PII 泄露、策略违规、格式错误的响应。
- **工具护栏（Tool guardrails）。** 在每个函数工具上执行。验证参数、检查权限、审计执行。

模式：

- **并行（Parallel，默认）。** 护栏 LLM 与主 LLM 同时运行。降低尾延迟。如果触发，主 LLM 的工作将被丢弃（令牌浪费）。
- **阻塞（Blocking，`run_in_parallel=False`）。** 护栏 LLM 先运行。如果触发，主调用不会浪费令牌。

触发时分别抛出 `InputGuardrailTripwireTriggered` / `OutputGuardrailTripwireTriggered`。

### 追踪

默认开启。每次 LLM 生成、工具调用、交接和护栏都会发出一个跨度。设置 `OPENAI_AGENTS_DISABLE_TRACING=1` 可选择退出。`add_trace_processor(processor)` 可将跨度同时发送到 OpenAI 和您自己的后端。

### 会话

`Session` 将会话历史存储在后端（SQLite、Redis、自定义）中。`Runner.run(agent, input, session=session)` 会自动加载和追加。

### 这种模式可能出问题的地方

- **交接漂移（Handoff drift）。** 智能体 A 交接给智能体 B，智能体 B 又交回给智能体 A。需要添加跳数计数器。
- **护栏绕过（Guardrail bypass）。** 工具护栏仅对函数工具生效；内置工具（文件读取器、网页抓取）需要单独的策略。
- **过度追踪（Over-tracing）。** 跨度中包含敏感内容。配合 OTel GenAI 内容捕获规则（课程 23）——外部存储，通过 ID 引用。

## 动手构建

`code/main.py` 使用标准库实现了 SDK 的基本形态：

- `Agent`、`FunctionTool`、`Handoff`（作为具有转移语义的函数工具）。
- `Runner`，包含输入/输出/工具护栏、交接分发和跳数计数器。
- 一个简单的跨度发射器，用于展示追踪结构。
- 一个分诊智能体，根据用户查询交接给账单或支持；护栏会在某次输入时触发。

运行它：

```
python3 code/main.py
```

追踪会显示两次成功的交接、一次输入护栏触发，以及一个反映真实 SDK 发出内容的跨度树。

## 使用场景

- **OpenAI Agents SDK** 用于以 OpenAI 为首选的产品。
- **Claude Agent SDK**（课程 17）用于以 Claude 为首选的产品。
- **LangGraph**（课程 13）用于需要显式状态和持久化恢复的场景。
- **自定义实现** 用于需要精确控制的场景（语音、多提供商、联邦部署）。

## 发布产物

`outputs/skill-agents-sdk-scaffold.md` 提供了一个 Agents SDK 应用的脚手架，包含分诊智能体、交接、输入/输出/工具护栏、会话存储和追踪处理器。

## 练习

1. 添加交接跳数计数器：超过 N 次转移后拒绝。追踪该行为。
2. 将 `nest_handoff_history` 作为一个选项实现——在转移前将先前的消息折叠为一条摘要。
3. 编写一个阻塞式输出护栏。比较会触发它的提示词和能通过的提示词之间的延迟。
4. 将 `add_trace_processor` 接入 JSON 日志记录器。每个跨度会发出什么形状的数据？
5. 阅读 SDK 文档。将您的标准库玩具移植到 `openai-agents-python`。您建模了哪些错误？

## 关键术语

| 术语 | 通俗说法 | 实际含义 |
|------|----------|----------|
| Agent | "LLM + 指令" | SDK 中的 Agent 类型；拥有工具和交接 |
| Handoff | "转移" | 模型调用的、用于委托给另一个智能体的工具 |
| Guardrail | "策略检查" | 对输入 / 输出 / 工具调用的验证 |
| Tripwire | "护栏触发" | 当护栏拒绝时抛出的异常 |
| Session | "历史存储" | 跨运行持久化的对话记忆 |
| Tracing | "跨度" | 覆盖 LLM + 工具 + 交接 + 护栏的内置可观测性 |
| Blocking guardrail | "顺序检查" | 护栏先运行；触发时不浪费令牌 |
| Parallel guardrail | "并发检查" | 护栏并行运行；延迟更低，触发时浪费令牌 |

## 延伸阅读

- [OpenAI Agents SDK 文档](https://openai.github.io/openai-agents-python/) —— 原语、交接、护栏、追踪
- [Claude Agent SDK 概览](https://platform.claude.com/docs/en/agent-sdk/overview) —— Claude 风格的对应实现
- [Anthropic，构建高效智能体](https://www.anthropic.com/research/building-effective-agents) —— 何时应该使用交接
- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— Agents SDK 跨度映射到的标准
