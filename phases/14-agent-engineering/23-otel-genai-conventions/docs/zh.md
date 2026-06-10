# 23 · OpenTelemetry GenAI 语义约定

> OpenTelemetry 的 GenAI SIG（于 2024 年 4 月成立）为智能体遥测定义了标准化的 schema。跨厂商统一的 span 名称、属性以及内容捕获规则，使得智能体的链路追踪在 Datadog、Grafana、Jaeger 和 Honeycomb 中含义一致。

**类型：** 学习 + 实践
**语言：** Python（标准库）
**前置：** 第 14 阶段 · 13（LangGraph）、第 14 阶段 · 24（可观测性平台）
**时长：** 约 60 分钟

## 学习目标

- 说出 GenAI 的几类 span 类别：模型/客户端、智能体、工具。
- 区分 `invoke_agent` 的 CLIENT span 与 INTERNAL span，以及各自的适用场景。
- 列出顶层 GenAI 属性：提供方名称、请求模型、数据源 ID。
- 解释内容捕获契约：默认不捕获（opt-in）、`OTEL_SEMCONV_STABILITY_OPT_IN`、外部引用的推荐做法。

## 问题所在

每家厂商都自创自己的 span 名称。运维团队最终只能为每个框架分别搭建仪表盘。OpenTelemetry 的 GenAI SIG 通过定义一套整个生态系统共同遵循的标准来解决这一问题。

## 核心概念

### Span 类别

1. **模型 / 客户端 span。** 覆盖原始的 LLM 调用。由提供方 SDK（Anthropic、OpenAI、Bedrock）和框架的模型适配器发出。
2. **智能体 span。** `create_agent`（在构建智能体时）和 `invoke_agent`（在其运行时）。
3. **工具 span。** 每次工具调用对应一个；通过父子关系挂接到智能体 span 上。

### 智能体 span 的命名

- Span 名称：若有命名则为 `invoke_agent {gen_ai.agent.name}`；否则回退为 `invoke_agent`。
- Span 类型（span kind）：
  - **CLIENT** —— 用于远程智能体服务（OpenAI Assistants API、Bedrock Agents）。
  - **INTERNAL** —— 用于进程内运行的智能体框架（LangChain、CrewAI、本地 ReAct）。

### 关键属性

- `gen_ai.provider.name` —— `anthropic`、`openai`、`aws.bedrock`、`google.vertex`。
- `gen_ai.request.model` —— 模型 ID。
- `gen_ai.response.model` —— 实际解析得到的模型（可能因路由而与请求不同）。
- `gen_ai.agent.name` —— 智能体标识符。
- `gen_ai.operation.name` —— `chat`、`completion`、`invoke_agent`、`tool_call`。
- `gen_ai.data_source.id` —— 用于 RAG：标识查询了哪个语料库或存储。

针对 Anthropic、Azure AI Inference、AWS Bedrock、OpenAI 还存在各自的技术专属约定。

### 内容捕获

默认规则：插桩（instrumentation）默认不应捕获输入/输出。捕获需通过以下属性显式开启（opt-in）：

- `gen_ai.system_instructions`
- `gen_ai.input.messages`
- `gen_ai.output.messages`

推荐的生产实践：将内容存储在外部（S3、你自己的日志存储），并在 span 上仅记录引用（指针 ID，而非正文内容）。这正是第 27 课的内容投毒（content-poisoning）防御方案与可观测性的结合。

### 稳定性

截至 2026 年 3 月，大多数约定仍处于实验阶段。可通过以下方式启用稳定预览：

```
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

Datadog v1.37+ 会将 GenAI 属性原生映射进其 LLM Observability schema。其他后端（Grafana、Honeycomb、Jaeger）则支持原始属性。

### 该模式容易出错的地方

- **把完整提示词捕获进 span。** PII、密钥、客户数据会出现在运维人员可读的链路追踪里。请存到外部。
- **缺少 `gen_ai.provider.name`。** 缺失归因信息会导致多提供方仪表盘失效。
- **span 没有父级链接。** 出现孤立的工具 span。务必传播上下文。
- **未设置稳定性 opt-in。** 后端升级时你的属性可能被重命名。

## 动手实现

`code/main.py` 实现了一个符合 GenAI 约定的标准库 span 发射器：

- 带 GenAI 属性 schema 的 `Span`。
- 带 `start_span`、嵌套上下文的 `Tracer`。
- 一段脚本化的智能体运行，会发出：`create_agent`、`invoke_agent`（INTERNAL）、每个工具的 span、以及用于 LLM 调用的 `chat` span。
- 一种内容捕获模式：将提示词存储在外部，并在 span 上记录对应 ID。

运行它：

```
python3 code/main.py
```

输出：一棵带有全部必需 GenAI 属性的 span 树，以及一个展示 opt-in 内容引用的「外部存储」。

## 实际运用

- **Datadog LLM Observability**（v1.37+）原生映射这些属性。
- **Langfuse / Phoenix / Opik**（第 24 课）—— 对整个生态进行自动插桩。
- **Jaeger / Honeycomb / Grafana Tempo** —— 原始 OTel 链路追踪；基于 GenAI 属性构建仪表盘。
- **自托管** —— 运行带 GenAI 处理器的 OTel Collector。

## 上线交付

`outputs/skill-otel-genai.md` 把 OTel GenAI span 接入到一个已有智能体中，配置了内容捕获默认值与外部引用存储。

## 练习

1. 用 `invoke_agent`（INTERNAL）+ 每个工具的 span 给你在第 01 课的 ReAct 循环插桩。发送到一个 Jaeger 实例。
2. 以「仅引用」模式添加内容捕获：提示词写入 SQLite，span 属性只携带行 ID。
3. 阅读 `gen_ai.data_source.id` 的规范。把它接入你在第 09 课的 Mem0 搜索。
4. 设置 `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`，验证你的属性不会被 collector 重命名。
5. 构建一个仪表盘：仅凭 GenAI 属性，得出「哪些工具报错与哪些模型相关联」。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| GenAI SIG | “OpenTelemetry GenAI 小组” | 定义 schema 的 OTel 工作组 |
| invoke_agent | “智能体 span” | 表示一次智能体运行的 span 名称 |
| CLIENT span | “远程调用” | 表示对远程智能体服务发起调用的 span |
| INTERNAL span | “进程内” | 表示进程内智能体运行的 span |
| gen_ai.provider.name | “提供方” | anthropic / openai / aws.bedrock / google.vertex |
| gen_ai.data_source.id | “RAG 源” | 检索命中的是哪个语料库/存储 |
| 内容捕获 | “提示词日志” | 对消息的 opt-in 捕获；生产环境中存到外部 |
| 稳定性 opt-in | “预览模式” | 用于固定实验性约定的环境变量 |

## 延伸阅读

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— 规范文档
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) —— 默认发出 GenAI span
- [AutoGen v0.4（Microsoft Research）](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) —— 内置 OTel span
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) —— W3C trace context 传播
