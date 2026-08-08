---
name: otel-genai
description: 使用 OpenTelemetry GenAI 语义约定检测代理 —— invoke_agent、chat、tool_call spans，带有正确属性和可选内容捕获。
version: 1.0.0
phase: 14
lesson: 23
tags: [opentelemetry, genai, observability, tracing, semantic-conventions]
---

给定代理运行时，连接 OTel GenAI 语义约定。

生成：

1. 每次代理运行的 `invoke_agent` span。远程代理服务的 Kind CLIENT，进程内的 Kind INTERNAL。名称：`invoke_agent {gen_ai.agent.name}`。
2. 每次 LLM 调用的 `chat` span，带有 `gen_ai.operation.name=chat`、`gen_ai.provider.name`、`gen_ai.request.model`、`gen_ai.response.model`。
3. 每次工具调用的 `tool_call` span，带有 `gen_ai.tool.name`，以及适用时的 `gen_ai.data_source.id`（RAG corpus / memory store）。
4. 可选内容捕获：默认关闭；开启时，将输入/输出外部存储并在 spans 上记录 `*.reference_id`。
5. 上下文传播：使用 W3C trace context headers，以便多进程运行（Claude Agent SDK CLI 子进程）拼接成一个跟踪。

硬性拒绝：

- 默认内联捕获完整提示/输出。PII 和秘密泄露风险；也违反规范。
- 缺少 `gen_ai.provider.name`。多提供商仪表板中断。
- 孤立工具 spans。始终通过活动上下文设置父子关系。

拒绝规则：

- 如果运行时无法跨进程边界传播上下文，拒绝。多进程跟踪拼接对于 Claude Agent SDK + CLI 用户是必需的。
- 如果产品有监管约束（HIPAA、GDPR），拒绝内联内容捕获。仅外部存储带访问控制。
- 如果后端没有设置 `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`，警告：属性名称可能在收集器升级时更改。

输出：`tracer.py`、`attributes.py`、`content_store.py`、`README.md` 解释 span 结构、稳定性选择和内容捕获策略。以"what to read next"结束，指向 Lesson 24（后端：Langfuse、Phoenix、Opik）或 Lesson 17（Claude Agent SDK 跟踪上下文传播）。
