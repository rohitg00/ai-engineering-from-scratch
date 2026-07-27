# OpenTelemetry GenAI 语义约定

> OpenTelemetry 的 GenAI SIG（2024 年 4 月启动）定义了代理遥测的标准模式。跨度名称、属性和内容捕获规则在各供应商之间趋于统一，使得代理跟踪在 Datadog、Grafana、Jaeger 和 Honeycomb 中具有相同的含义。

**类型：** 学习 + 动手构建  
**语言：** Python（标准库）  
**前置知识：** 阶段 14 · 13（LangGraph）、阶段 14 · 24（可观测性平台）  
**时长：** 约 60 分钟

## 学习目标

- 说出 GenAI 跨度类别：模型/客户端、代理、工具。
- 区分 `invoke_agent` 的 CLIENT 与 INTERNAL 跨度及其各自的适用场景。
- 列出顶级 GenAI 属性：提供者名称、请求模型、数据源 ID。
- 解释内容捕获约定：选择加入、`OTEL_SEMCONV_STABILITY_OPT_IN`、外部引用推荐。

## 问题

每个供应商都有自己的跨度命名方式。运维团队不得不为每个框架构建专属仪表盘。OpenTelemetry 的 GenAI SIG 通过定义一套整个生态共同遵循的标准来解决这一问题。

## 概念

### 跨度类别

1. **模型 / 客户端跨度。** 涵盖原始的 LLM 调用。由提供者 SDK（Anthropic、OpenAI、Bedrock）和框架模型适配器发出。
2. **代理跨度。** `create_agent`（代理创建时）和 `invoke_agent`（代理运行时）。
3. **工具跨度。** 每次工具调用一个跨度；通过父子关系连接到代理跨度。

### 代理跨度命名

- 跨度名称：若有命名则使用 `invoke_agent {gen_ai.agent.name}`；否则回退为 `invoke_agent`。
- 跨度类型：
  - **CLIENT** — 用于远程代理服务（OpenAI Assistants API、Bedrock Agents）。
  - **INTERNAL** — 用于进程内代理框架（LangChain、CrewAI、本地 ReAct）。

### 关键属性

- `gen_ai.provider.name` — `anthropic`、`openai`、`aws.bedrock`、`google.vertex`。
- `gen_ai.request.model` — 模型 ID。
- `gen_ai.response.model` — 实际解析的模型（可能因路由而与请求模型不同）。
- `gen_ai.agent.name` — 代理标识符。
- `gen_ai.operation.name` — `chat`、`completion`、`invoke_agent`、`tool_call`。
- `gen_ai.data_source.id` — 用于 RAG：指示查询了哪个语料库或存储。

Anthropic、Azure AI Inference、AWS Bedrock、OpenAI 等均有各自的技术特定约定。

### 内容捕获

默认规则：**不应**默认捕获输入/输出。通过以下方式选择加入捕获：

- `gen_ai.system_instructions`
- `gen_ai.input.messages`
- `gen_ai.output.messages`

推荐的生产模式：将内容存储在外部（S3、日志存储），在跨度上记录引用（指针 ID，而非原文）。这是第 27 课中内置到可观测性中的内容污染防御机制。

### 稳定性

截至 2026 年 3 月，大多数约定仍处于实验阶段。通过以下方式选择加入稳定预览：

```
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

Datadog v1.37+ 原生将 GenAI 属性映射到其 LLM 可观测性模式中。其他后端（Grafana、Honeycomb、Jaeger）支持原始属性。

### 该模式的常见误区

- **在跨度中捕获完整的提示词。** 跟踪数据中可能包含 PII、密钥、客户数据，运维人员可以读取。应存储在外部。
- **缺少 `gen_ai.provider.name`。** 缺少归属信息时，多提供者仪表盘将无法正常工作。
- **跨度缺少父级链接。** 产生孤立工具跨度。务必传播上下文。
- **未设置稳定性选择加入。** 后端升级时你的属性可能被重命名。

## 动手构建

`code/main.py` 实现了一个符合 GenAI 约定的标准库跨度发射器：

- 包含 GenAI 属性模式的 `Span`。
- 支持 `start_span` 和嵌套上下文的 `Tracer`。
- 一个脚本化的代理运行，发出：`create_agent`、`invoke_agent`（INTERNAL）、每个工具的跨度、用于 LLM 调用的 `chat` 跨度。
- 一种内容捕获模式，将提示词存储在外部并在跨度上记录 ID。

运行方式：

```
python3 code/main.py
```

输出：一个包含所有必需 GenAI 属性的跨度树，以及一个显示选择加入内容引用的"外部存储"。

## 使用方式

- **Datadog LLM 可观测性**（v1.37+）原生映射属性。
- **Langfuse / Phoenix / Opik**（第 24 课）——自动检测生态。
- **Jaeger / Honeycomb / Grafana Tempo**——原始 OTel 跟踪；基于 GenAI 属性构建仪表盘。
- **自托管**——使用 GenAI 处理器运行 OTel Collector。

## 交付产出

`outputs/skill-otel-genai.md` 将 OTel GenAI 跨度接入现有代理，包含内容捕获默认设置和外部引用存储。

## 练习

1. 为你的第 01 课 ReAct 循环添加 `invoke_agent`（INTERNAL）和每个工具的跨度，并发送到 Jaeger 实例。
2. 以"仅引用"模式添加内容捕获：将提示词存入 SQLite，跨度属性仅携带行 ID。
3. 阅读 `gen_ai.data_source.id` 的规范。将其接入你的第 09 课 Mem0 搜索中。
4. 设置 `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`，验证你的属性不会被 collector 重命名。
5. 构建一个仪表盘：仅使用 GenAI 属性分析"哪些工具错误与哪些模型相关"。

## 关键术语

| 术语 | 常见说法 | 实际含义 |
|------|---------|---------|
| GenAI SIG | "OpenTelemetry GenAI 小组" | 定义模式的 OTel 工作组 |
| invoke_agent | "代理跨度" | 表示一次代理运行的跨度名称 |
| CLIENT span | "远程调用" | 对远程代理服务调用的跨度 |
| INTERNAL span | "进程内" | 进程内代理运行的跨度 |
| gen_ai.provider.name | "提供者" | anthropic / openai / aws.bedrock / google.vertex |
| gen_ai.data_source.id | "RAG 来源" | 检索命中的语料库/存储 |
| Content capture | "提示词日志" | 选择加入的消息捕获；生产环境中存储在外部 |
| Stability opt-in | "预览模式" | 用于锁定实验约定的环境变量 |

## 扩展阅读

- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/)——规范文档
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)——默认启用 GenAI 跨度
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/)——内置 OTel 跨度
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview)——W3C 跟踪上下文传播
