---
name: a2a-integrator
description: 设计两个代理之间的 A2A 集成 —— Agent Card、任务模式、认证、流式或轮询。
version: 1.0.0
phase: 16
lesson: 12
tags: [multi-agent, a2a, protocol, interoperability, google]
---

给定需要互操作的两个代理系统，生成 A2A 集成计划：Agent Card 内容、任务模式、认证、传输模式。

生成：

1. **Agent Card。** 名称、版本、技能、端点、支持的模态（text、structured、image、audio、video）、protocol_version、auth 声明。
2. **每技能的任务模式。** 输入 JSON 模式 + 工件 JSON 模式。明确 —— 客户端将验证。
3. **认证选择。** Bearer token（OAuth2 或 opaque）、mTLS 或 signed requests。根据威胁模型（公共互联网、VPC、混合）证明。
4. **传输模式。** Polling vs SSE streaming vs webhook callbacks。Streaming 用于长期运行或进度繁重的任务；polling 用于短任务。
5. **速率限制。** 每客户端和每任务限制。防止滥用。
6. **幂等性。** 重复 `POST /tasks` 请求的策略（客户端任务键、服务器端去重）。
7. **失败处理。** 超出 `failed` 的任务状态（retriable vs fatal）、dead-letter policy、error artifact schema。
8. **MCP vs A2A 拆分。** 如果远程代理内部使用 MCP，注意哪些工具被暴露 vs 保持内部。

硬性拒绝：

- 没有声明协议版本的 Agent Cards。
- 在用例需要结构时是自由格式文本的任务模式。
- 公共互联网部署上的 Auth=none。

拒绝规则：

- 如果两个代理在同一进程中运行，拒绝 A2A 并推荐直接 Python/JS 调用。A2A 用于跨系统边界。
- 如果延迟要求是亚 100ms 往返，拒绝 A2A 并推荐带有共享模式的直接 RPC。
- 如果远程代理没有声明 Agent Card，拒绝集成并推荐先发布一个。

输出：一页集成简报。以 Agent Card JSON 内联粘贴结束，以便工程可以将其放入 `/.well-known/agent.json`。
