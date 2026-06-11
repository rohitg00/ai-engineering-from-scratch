# OpenTelemetry GenAI 语义约定

> OpenTelemetry 的 GenAI SIG（2024 年 4 月启动）定义了 agent 遥测的标准模式。Span 名称、属性和内容捕获规则在供应商之间趋同，因此 agent 跟踪在 Datadog、Grafana、Jaeger 和 Honeycomb 中意味着相同的东西。

**类型：** 学习 + 构建
**语言：** Python（标准库）
**前置条件：** 第 14 阶段 · 13（LangGraph），第 14 阶段 · 24（可观察性平台）
**时间：** ~60 分钟

## 学习目标

- 说出 GenAI span 类别：model/client、agent、tool。
- 区分 `invoke_agent` CLIENT 与 INTERNAL span 以及各自的适用场景。
- 列出顶级 GenAI 属性：provider name、request model、data-source ID。
- 解释内容捕获契约：opt-in、`OTEL_SEMCONV_STABILITY_OPT_IN`、外部引用推荐。

## 问题

每个供应商都发明自己的 span 名称。运维团队最终为每个框架构建仪表板。OpenTelemetry 的 GenAI SIG 通过定义整个生态系统的目标标准来解决这个问题。

## 概念

### Span 类别

1. **Model / client span。** 覆盖原始 LLM 调用。由 provider SDK（Anthropic、OpenAI、Bedrock）和框架模型适配器发出。
2. **Agent span。** `create_agent`（agent 构建时）和 `invoke_agent`（运行时）。
3. **Tool span。** 每次工具调用一个；通过父子关系连接到 agent span。

### Agent span 命名

- Span name：`invoke_agent {gen_ai.agent.name}`（如果有名称）；回退到 `invoke_agent`。
- Span kind：
  - **CLIENT** —— 用于远程 agent 服务（OpenAI Assistants API、Bedrock Agents）。
  - **INTERNAL** —— 用于进程内 agent 框架（LangChain、CrewAI、本地 ReAct）。

### 关键属性

- `gen_ai.provider.name` —— `anthropic`、`openai`、`aws.bedrock`、`google.vertex`。
- `gen_ai.request.model` —— 模型 ID。
- `gen_ai.response.model` —— 解析后的模型（可能因路由与请求不同）。
- `gen_ai.agent.name` —— agent 标识符。
- `gen_ai.operation.name` —— `chat`、`completion`、`invoke_agent`、`tool_call`。
- `gen_ai.data_source.id` —— 用于 RAG：查询了哪个语料库或存储。

Anthropic、Azure AI Inference、AWS Bedrock、OpenAI 存在技术特定约定。

### 内容捕获

默认规则：instrumentations 默认不应捕获输入/输出。捕获是 opt-in：

- `gen_ai.system_instructions`
- `gen_ai.input.messages`
- `gen_ai.output.messages`

推荐生产模式：将内容存储在外部（S3、你的日志存储），在 span 上记录引用（指针 ID，不是文本）。这是第 27 课内容投毒防御接入可观察性。

### 稳定性

截至 2026 年 3 月，大多数约定是实验性的。通过以下方式选择稳定预览：

```
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

Datadog v1.37+ 将 GenAI 属性原生映射到其 LLM 可观察性模式。其他后端（Grafana、Honeycomb、Jaeger）支持原始属性。

### 此模式出错的地方

- **在 span 中捕获完整提示词。** PII、秘密、客户数据进入运维可读的跟踪。存储在外部。
- **缺少 `gen_ai.provider.name`。** 多供应商仪表板在缺少归因时损坏。
- **没有父链接的 span。** 孤立的 tool span。始终传播上下文。
- **未设置稳定性 opt-in。** 你的属性可能在后端升级时被重命名。

## 构建

`code/main.py` 实现匹配 GenAI 约定的标准库 span 发射器：

- 带有 GenAI 属性模式的 `Span`。
- 带有 `start_span`、嵌套上下文的 `Tracer`。
- 发出以下内容的脚本化 agent 运行：`create_agent`、`invoke_agent`（INTERNAL）、per-tool span、LLM 调用的 `chat` span。
- 将提示词存储在外部并在 span 上记录 ID 的内容捕获模式。

运行：

```
python3 code/main.py
```

输出：带有所有必需 GenAI 属性的 span 树，以及显示 opt-in 内容引用的"外部存储"。

## 使用

- **Datadog LLM Observability**（v1.37+）原生映射属性。
- **Langfuse / Phoenix / Opik**（第 24 课）—— 自动检测生态系统。
- **Jaeger / Honeycomb / Grafana Tempo** —— 原始 OTel 跟踪；从 GenAI 属性构建仪表板。
- **自托管** —— 运行带有 GenAI 处理器的 OTel Collector。

## 交付

`outputs/skill-otel-genai.md` 将 OTel GenAI span 接入现有 agent，包含内容捕获默认值和外部引用存储。

## 练习

1. 用 `invoke_agent`（INTERNAL）+ per-tool span 检测你的第 01 课 ReAct 循环。发送到 Jaeger 实例。
2. 以"仅引用"模式添加内容捕获：提示词到 SQLite，span 属性仅携带行 ID。
3. 阅读 `gen_ai.data_source.id` 的规范。将其接入你的第 09 课 Mem0 搜索。
4. 设置 `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` 并验证你的属性不会被 collector 重命名。
5. 构建仪表板："哪些工具错误与哪些模型相关"，仅从 GenAI 属性。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| GenAI SIG | "OpenTelemetry GenAI 组" | 定义模式的 OTel 工作组 |
| invoke_agent | "Agent span" | 代表 agent 运行的 span 名称 |
| CLIENT span | "远程调用" | 远程 agent 服务调用的 span |
| INTERNAL span | "进程内" | 进程内 agent 运行的 span |
| gen_ai.provider.name | "Provider" | anthropic / openai / aws.bedrock / google.vertex |
| gen_ai.data_source.id | "RAG 来源" | 检索命中的语料库/存储 |
| Content capture | "提示词日志" | 消息的 opt-in 捕获；生产中存储在外部 |
| Stability opt-in | "预览模式" | 固定实验性约定的环境变量 |

## 延伸阅读

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— 规范
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) —— 默认 GenAI span
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) —— 内置 OTel span
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) —— W3C 跟踪上下文传播