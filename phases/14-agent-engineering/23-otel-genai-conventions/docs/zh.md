# OpenTelemetry GenAI 语义约定

> OpenTelemetry 的 GenAI SIG（2024 年 4 月启动）定义了 Agent 遥测的标准模式。Span 名称、属性和内容捕获规则在各供应商之间达成一致，因此 Agent 追踪在 Datadog、Grafana、Jaeger和 Honeycomb 中含义相同。

**类型：** 学习 + 构建
**语言：** Python（标准库）
**前置要求：** 阶段 14 · 13（LangGraph）、阶段 14 · 24（可观测性平台）
**时长：** 约 60 分钟

## 学习目标

- 说出 GenAI 的 span 类别：model/client、agent、tool。
- 区分 `invoke_agent` CLIENT 与 INTERNAL span 以及各自的适用场景。
- 列出顶级 GenAI 属性：provider name、request model、data-source ID。
- 解释内容捕获约定：opt-in、`OTEL_SEMCONV_STABILITY_OPT_IN`、外部引用推荐。

## 问题背景

每个供应商都发明自己的 span 名称。运维团队最终为每个框架构建独立的仪表板。OpenTelemetry 的 GenAI SIG 通过定义整个生态系统瞄准的单一标准来解决这个问题。

## 核心概念

### Span 类别

1. **模型 / 客户端 span。** 覆盖原始 LLM 调用。由提供商 SDK（Anthropic、OpenAI、Bedrock）和框架模型适配器发出。
2. **Agent span。** `create_agent`（构造 Agent 时）和 `invoke_agent`（运行时）。
3. **工具 span。** 每次工具调用一个；通过父子关系连接到 Agent span。

### Agent span 命名

- Span 名称：如果有名称则为 `invoke_agent {gen_ai.agent.name}`，否则回退到 `invoke_agent`。
- Span 类型：
  - **CLIENT**——用于远程 Agent 服务（OpenAI Assistants API、Bedrock Agents）。
  - **INTERNAL**——用于进程内 Agent 框架（LangChain、CrewAI、本地 ReAct）。

### 关键属性

- `gen_ai.provider.name`——`anthropic`、`openai`、`aws.bedrock`、`google.vertex`。
- `gen_ai.request.model`——请求的模型 ID。
- `gen_ai.response.model`——解析后的模型（由于路由可能与请求不同）。
- `gen_ai.agent.name`——Agent 标识符。
- `gen_ai.operation.name`——`chat`、`completion`、`invoke_agent`、`tool_call`。
- `gen_ai.data_source.id`——用于 RAG：查询了哪个语料库或存储。

针对 Anthropic、Azure AI Inference、AWS Bedrock、OpenAI 的特定技术约定都存在。

### 内容捕获

默认规则：Instrumentation **不应**默认捕获输入/输出。捕获需通过以下方式 opt-in：

- `gen_ai.system_instructions`
- `gen_ai.input.messages`
- `gen_ai.output.messages`

推荐的生产模式：将内容存储到外部（S3、你的日志存储），在 span 上记录引用（指针 ID，而非原文）。这是接入可观测性的第 27 课内容投毒防御。

### 稳定性

截至 2026 年 3 月，大多数约定仍是实验性的。通过以下方式 opt-in 到稳定预览版：

```
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

Datadog v1.37+ 原生映射 GenAI 属性到其 LLM Observability 模式。其他后端（Grafana、Honeycomb、Jaeger）支持原始属性。

### 这种模式哪里会出错

- **在 span 中捕获完整提示词。** 追踪中保留着 PII、密钥、客户数据，运维人员可以读取。请存储到外部。
- **没有 `gen_ai.provider.name`。** 当归属缺失时，多提供商仪表板会出问题。
- **没有父链接的 span。** 孤立工具 span。始终传播上下文。
- **未设置稳定性 opt-in。** 你的属性可能在后端升级时被重命名。

## 构建它

`code/main.py` 实现了一个匹配 GenAI 约定的标准库 span 发射器：

- 带有 GenAI 属性模式的 `Span`。
- 带有 `start_span`、嵌套上下文的 `Tracer`。
- 一个脚本化 Agent 运行，发出：`create_agent`、`invoke_agent`（INTERNAL）、每工具 span、用于 LLM 调用的 `chat` span。
- 一个内容捕获模式，将提示词存储到外部并在 span 上记录 ID。

运行它：

```
python3 code/main.py
```

输出：所有必需 GenAI 属性的 span 树，以及显示 opt-in 内容引用的"外部存储"。

## 使用它

- **Datadog LLM Observability**（v1.37+）原生映射属性。
- **Langfuse / Phoenix / Opik**（第 24 课）——自动 instrumentation 生态系统。
- **Jaeger / Honeycomb / Grafana Tempo**——原始 OTel 追踪；从 GenAI 属性构建仪表板。
- **自托管**——使用带有 GenAI 处理器的 OTel Collector。

## 部署它

`outputs/skill-otel-genai.md` 将 OTel GenAI span 接入现有 Agent，附带内容捕获默认值和外部引用存储。

## 练习

1. 使用 `invoke_agent`（INTERNAL）+ 每工具 span 来 instrumentation 你的第 01 课 ReAct 循环。发送到 Jaeger 实例。
2. 添加步骤计数指标。在你的 3 个任务上，每次解决需要多少 Agent 步骤？
3. 阅读 SWE-bench+ 论文。实现解决方案泄漏检查（将问题文本与 diff 进行模式匹配）。
4. 从公共拆分下载一个 GAIA 问题。追踪 GPT-4 级别 Agent 会做什么。它需要什么工具？
5. 阅读 AgentBench 的每环境细目。哪个环境反映你的产品表面？那里的"SOTA"是什么样子的？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| GenAI SIG | "OpenTelemetry GenAI 组" | 定义模式的 OTel 工作组 |
| invoke_agent | "Agent span" | 表示 Agent 运行的 span 名称 |
| CLIENT span | "远程调用" | 对远程 Agent 服务的调用 span |
| INTERNAL span | "进程内" | 进程内 Agent 运行的 span |
| gen_ai.provider.name | "提供商" | anthropic / openai / aws.bedrock / google.vertex |
| gen_ai.data_source.id | "RAG 源" | 检索命中的语料库/存储 |
| Content capture | "提示词记录" | 消息的 Opt-in 捕获；在生产中存储到外部 |
| Stability opt-in | "预览模式" | 用于固定实验性约定的环境变量 |

## 延伸阅读

- [OpenTelemetry GenAI 语义约定](https://opentelemetry.io/docs/specs/semconv/gen-ai/)——规范
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)——默认发出 GenAI span
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/)——内置 OTel span
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview)——W3C 追踪上下文传播
