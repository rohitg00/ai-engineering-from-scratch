# OpenTelemetry GenAI 语义规范（OpenTelemetry GenAI Semantic Conventions）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> OpenTelemetry 的 GenAI SIG（2024 年 4 月成立）为 agent 遥测定义了标准 schema。span 名称、属性、内容捕获规则在各厂商之间趋于一致，让 agent trace 在 Datadog、Grafana、Jaeger 和 Honeycomb 里表达的是同一回事。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 24 (Observability Platforms)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 说出 GenAI 的 span 分类：model/client、agent、tool。
- 区分 `invoke_agent` CLIENT span 与 INTERNAL span，以及它们各自的适用场景。
- 列出顶层 GenAI 属性：provider name、request model、data-source ID。
- 解释内容捕获契约：opt-in、`OTEL_SEMCONV_STABILITY_OPT_IN`、外部引用建议。

## 问题（Problem）

每家厂商都自己造一套 span 名。运维团队最后只能为每个框架单独搭一套看板。OpenTelemetry 的 GenAI SIG 通过定义一套全生态都对齐的标准来解决这个问题。

## 概念（Concept）

### span 分类（Span categories）

1. **Model / client span。** 覆盖原始的 LLM 调用。由 provider SDK（Anthropic、OpenAI、Bedrock）和框架的 model 适配层发出。
2. **Agent span。** `create_agent`（agent 构造时）和 `invoke_agent`（agent 运行时）。
3. **Tool span。** 每次工具调用一个 span；通过父子关系挂在 agent span 之下。

### Agent span 命名（Agent span naming）

- span 名称：如果命名了，就是 `invoke_agent {gen_ai.agent.name}`；否则回落到 `invoke_agent`。
- span kind：
  - **CLIENT** —— 用于远端 agent 服务（OpenAI Assistants API、Bedrock Agents）。
  - **INTERNAL** —— 用于进程内的 agent 框架（LangChain、CrewAI、本地 ReAct）。

### 关键属性（Key attributes）

- `gen_ai.provider.name` —— `anthropic`、`openai`、`aws.bedrock`、`google.vertex`。
- `gen_ai.request.model` —— 模型 ID。
- `gen_ai.response.model` —— 实际解析到的模型（由于路由，可能与请求不同）。
- `gen_ai.agent.name` —— agent 标识。
- `gen_ai.operation.name` —— `chat`、`completion`、`invoke_agent`、`tool_call`。
- `gen_ai.data_source.id` —— 用于 RAG：被查询的是哪一个语料库或存储。

针对 Anthropic、Azure AI Inference、AWS Bedrock、OpenAI 还各自有专属约定。

### 内容捕获（Content capture）

默认规则：instrumentation **不应**默认捕获输入/输出。捕获是 opt-in 的，通过：

- `gen_ai.system_instructions`
- `gen_ai.input.messages`
- `gen_ai.output.messages`

推荐的生产模式：把内容存到外部（S3、你自己的日志库），span 上只记录引用（pointer ID，而不是原文）。这就是 Lesson 27 里的 content-poisoning 防御思路接到可观测性上的具体体现。

### 稳定性（Stability）

截至 2026 年 3 月，大部分约定仍处于 experimental 状态。通过下面这条来 opt-in 到 stable preview：

```
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

Datadog v1.37+ 会把 GenAI 属性原生映射到它的 LLM Observability schema。其他后端（Grafana、Honeycomb、Jaeger）支持原始属性。

### 这套模式容易翻车的地方（Where this pattern goes wrong）

- **把完整 prompt 写进 span。** PII、密钥、客户数据全暴露在运维能读到的 trace 里。请存到外部。
- **没有 `gen_ai.provider.name`。** 缺了来源归属，多 provider 看板就废了。
- **span 没有父链路。** tool span 变成孤儿。永远要传播 context。
- **没设稳定性 opt-in。** 你的属性可能在后端升级时被改名。

## 动手实现（Build It）

`code/main.py` 用 stdlib 实现了一个符合 GenAI 规范的 span 发射器：

- 带 GenAI 属性 schema 的 `Span`。
- 带 `start_span`、嵌套上下文的 `Tracer`。
- 一段脚本化的 agent 运行，它会发出：`create_agent`、`invoke_agent`（INTERNAL）、每个工具一个 span、LLM 调用对应的 `chat` span。
- 一个内容捕获模式，它把 prompt 存到外部，span 上只记录 ID。

跑起来：

```
python3 code/main.py
```

输出：一棵带齐所有必需 GenAI 属性的 span 树，以及一个「外部存储」展示 opt-in 模式下的内容引用。

## 用起来（Use It）

- **Datadog LLM Observability**（v1.37+）原生映射属性。
- **Langfuse / Phoenix / Opik**（Lesson 24）—— 对整个生态自动 instrument。
- **Jaeger / Honeycomb / Grafana Tempo** —— 原始 OTel trace；基于 GenAI 属性搭看板。
- **自托管** —— 跑 OTel Collector，挂上一个 GenAI processor。

## 上线部署（Ship It）

`outputs/skill-otel-genai.md` 把 OTel GenAI span 接进一个已有的 agent，配套默认的内容捕获策略和外部引用存储。

## 练习（Exercises）

1. 给你 Lesson 01 的 ReAct 循环加上 `invoke_agent`（INTERNAL）+ 每工具一个 span 的 instrumentation。把数据送到一个 Jaeger 实例。
2. 加一个「只存引用」模式的内容捕获：prompt 写进 SQLite，span 属性只带行 ID。
3. 读 `gen_ai.data_source.id` 的 spec。把它接进你 Lesson 09 的 Mem0 搜索。
4. 设上 `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`，验证你的属性不会被 collector 改名。
5. 搭一个看板：仅基于 GenAI 属性，回答「哪些工具错误和哪些模型相关」。

## 关键术语（Key Terms）

| 术语 | 大家通常怎么说 | 它实际是什么 |
|------|----------------|------------------------|
| GenAI SIG | 「OpenTelemetry GenAI 小组」 | 定义 schema 的 OTel 工作组 |
| invoke_agent | 「Agent span」 | 表示一次 agent 运行的 span 名 |
| CLIENT span | 「远端调用」 | 调用远端 agent 服务的 span |
| INTERNAL span | 「进程内」 | 进程内 agent 运行的 span |
| gen_ai.provider.name | 「Provider」 | anthropic / openai / aws.bedrock / google.vertex |
| gen_ai.data_source.id | 「RAG 来源」 | 一次检索命中的是哪个语料库/存储 |
| Content capture | 「Prompt 日志」 | opt-in 的消息捕获；生产环境请存到外部 |
| Stability opt-in | 「预览模式」 | 用环境变量锁定 experimental 约定 |

## 延伸阅读（Further Reading）

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— 规范本体
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) —— 默认就发 GenAI span
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) —— 内建 OTel span
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) —— W3C trace context 传播
