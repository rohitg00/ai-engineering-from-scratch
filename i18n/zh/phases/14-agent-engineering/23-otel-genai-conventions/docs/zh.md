# OpenTelemetry GenAI 语义约定

> OpenTelemetry 的 GenAI SIG（2024 年 4 月启动）定义了智能体遥测的标准模式。Span 名称、属性和内容捕获规则在各个厂商之间趋于统一，因此智能体追踪在 Datadog、Grafana、Jaeger 和 Honeycomb 中的含义保持一致。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 13 (LangGraph)、Phase 14 · 24 (Observability Platforms)
**Time:** 约 60 分钟

## 学习目标

- 说出 GenAI span 的类别：model/client、agent、tool。
- 区分 `invoke_agent` CLIENT 与 INTERNAL span，以及各自的适用场景。
- 列出 GenAI 的顶层属性：provider 名称、请求模型、数据源 ID。
- 解释内容捕获契约：需显式开启（opt-in）、`OTEL_SEMCONV_STABILITY_OPT_IN`、外部引用建议。

## 问题所在

每个厂商都发明自己的 span 名称。运维团队最终不得不为每个框架单独搭建仪表盘。OpenTelemetry 的 GenAI SIG 通过定义一个整个生态系统共同遵循的标准来解决这个问题。

## 概念

### Span 类别

1. **Model / client spans。** 涵盖原始 LLM 调用。由提供商 SDK（Anthropic、OpenAI、Bedrock）和框架模型适配器发出。
2. **Agent spans。** `create_agent`（构造智能体时）和 `invoke_agent`（运行时）。
3. **Tool spans。** 每次工具调用一个；通过父子关系与 agent span 相连。

### Agent span 命名

- Span 名称：如有名称则为 `invoke_agent {gen_ai.agent.name}`；否则回退到 `invoke_agent`。
- Span kind：
  - **CLIENT** — 用于远程智能体服务（OpenAI Assistants API、Bedrock Agents）。
  - **INTERNAL** — 用于进程内智能体框架（LangChain、CrewAI、本地 ReAct）。

### 关键属性

- `gen_ai.provider.name` — `anthropic`、`openai`、`aws.bedrock`、`google.vertex`。
- `gen_ai.request.model` — 模型 ID。
- `gen_ai.response.model` — 实际解析到的模型（由于路由，可能与请求的模型不同）。
- `gen_ai.agent.name` — 智能体标识符。
- `gen_ai.operation.name` — `chat`、`completion`、`invoke_agent`、`tool_call`。
- `gen_ai.data_source.id` — 用于 RAG：查询了哪个语料库或存储。

Anthropic、Azure AI Inference、AWS Bedrock、OpenAI 均有特定技术的约定。

### 内容捕获

默认规则：插桩默认不应捕获输入/输出。捕获需通过以下方式显式开启：

- `gen_ai.system_instructions`
- `gen_ai.input.messages`
- `gen_ai.output.messages`

推荐的生产模式：将内容存储在外部（S3、你的日志存储），在 span 上记录引用（指针 ID，而非文本）。这正是第 27 课的内容投毒防御接入可观测性的方式。

### 稳定性

截至 2026 年 3 月，大多数约定仍处于实验阶段。使用以下方式启用稳定预览：

```
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

Datadog v1.37+ 将 GenAI 属性原生映射到其 LLM Observability 模式中。其他后端（Grafana、Honeycomb、Jaeger）支持原始属性。

### 这个模式的常见错误

- **在 span 中捕获完整 prompt。** PII、密钥、客户数据进入运维人员可读的追踪记录中。应存储在外部。
- **没有 `gen_ai.provider.name`。** 缺少归因时，多提供商仪表盘会失效。
- **Span 缺少父链接。** 孤立的 tool span。始终传播上下文。
- **未设置稳定性 opt-in。** 后端升级时你的属性可能会被重命名。

```figure
ae-genai-span-tree
```

## 动手构建

`code/main.py` 实现了一个符合 GenAI 约定的 stdlib span 发射器：

- `Span`，带 GenAI 属性模式。
- `Tracer`，带 `start_span`、嵌套上下文。
- 一个脚本化的智能体运行，发出：`create_agent`、`invoke_agent`（INTERNAL）、每个工具的 span、LLM 调用的 `chat` span。
- 一个内容捕获模式，将 prompt 存储在外部并在 span 上记录 ID。

运行它：

```
python3 code/main.py
```

输出：一棵包含所有必需 GenAI 属性的 span 树，以及一个展示 opt-in 内容引用的"外部存储"。

## 直接使用

- **Datadog LLM Observability**（v1.37+）原生映射属性。
- **Langfuse / Phoenix / Opik**（第 24 课）— 对生态系统自动插桩。
- **Jaeger / Honeycomb / Grafana Tempo** — 原始 OTel 追踪；基于 GenAI 属性构建仪表盘。
- **自托管** — 运行带 GenAI 处理器的 OTel Collector。

## 上线部署

`outputs/skill-otel-genai.md` 将 OTel GenAI span 接入现有智能体，包含内容捕获默认值和外部引用存储。

## 练习

1. 用 `invoke_agent`（INTERNAL）+ 每个工具的 span 为你的第 01 课 ReAct 循环插桩。发送到 Jaeger 实例。
2. 以"仅引用"模式添加内容捕获：prompt 存入 SQLite，span 属性只携带行 ID。
3. 阅读关于 `gen_ai.data_source.id` 的规范。将其接入你的第 09 课 Mem0 搜索。
4. 设置 `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`，并验证你的属性不会被 collector 重命名。
5. 仅基于 GenAI 属性构建一个仪表盘："哪些工具错误与哪些模型相关"。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| GenAI SIG | "OpenTelemetry GenAI 工作组" | 定义该模式的 OTel 工作组 |
| invoke_agent | "Agent span" | 表示一次智能体运行的 span 名称 |
| CLIENT span | "远程调用" | 对远程智能体服务调用的 span |
| INTERNAL span | "进程内" | 进程内智能体运行的 span |
| gen_ai.provider.name | "Provider" | anthropic / openai / aws.bedrock / google.vertex |
| gen_ai.data_source.id | "RAG 来源" | 检索命中的语料库/存储 |
| 内容捕获 | "Prompt 日志" | opt-in 的消息捕获；生产环境中存储在外部 |
| 稳定性 opt-in | "预览模式" | 用于固定实验性约定的环境变量 |

## 延伸阅读

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — 规范
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) — 默认输出 GenAI span
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — 内置 OTel span
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) — W3C trace context 传播