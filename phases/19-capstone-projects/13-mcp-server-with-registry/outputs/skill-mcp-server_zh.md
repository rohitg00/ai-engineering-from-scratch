---
name: mcp-server-platform
description: 部署生产级MCP服务器，具备StreamableHTTP、OAuth 2.1作用域、OPA策略、破坏性工具的人工审批门和用于发现的注册表。
version: 1.0.0
phase: 19
lesson: 13
tags: [capstone, mcp, fastmcp, streamablehttp, oauth, opa, registry, governance]
---

给定企业环境，交付一个包含10个内部工具的MCP服务器、用于发现的注册表服务，以及通过Slack审批门控破坏性工具的治理层。

构建计划：

1. FastMCP服务器暴露10个只读工具（Postgres、S3、Jira、Linear、Datadog、PagerDuty、GitHub、Notion、Slack、Salesforce），每个工具都有类型化模式和必需作用域。
2. StreamableHTTP传输，负载均衡器后的无状态服务。
3. OAuth 2.1令牌内省中间件；通过SPIFFE / SPIRE的工作负载身份。
4. 每次工具调用的OPA / Rego策略决策：作用域执行、PII修订、负载大小上限。
5. 破坏性工具（Jira创建、Linear创建、Postgres写入）在单独的MCP服务器上，需要`approved:by:human`作用域，通过15分钟内的Slack卡片提升。
6. 注册表服务，轮询每个服务器的`.well-known/mcp-capabilities`，用JSON Schema验证，并暴露列表/搜索/验证/启用UI。
7. 每租户JSONL审计日志，写入前通过Presidio PII修订。
8. 100客户端负载测试，展示水平扩展；通过MCP一致性套件。

评估标准：

| 权重 | 标准 | 测量 |
|:-:|---|---|
| 25 | 规范一致性 | StreamableHTTP + 能力清单通过MCP一致性测试 |
| 20 | 安全性 | 作用域执行、每个工具的OPA覆盖、密钥卫生 |
| 20 | 可观测性 | 带写入时PII修订的每工具调用审计日志 |
| 20 | 规模 | 100客户端负载测试，展示水平扩展 |
| 15 | 注册表UX | 发现/验证/启用-禁用工作流运行 |

硬性拒绝：
- 需要状态会话的服务器（违反2026 StreamableHTTP无状态契约）。
- 破坏性工具与只读工具共享相同认证表面的单服务器拓扑。
- 持久化原始PII的审计日志。
- 忽略能力清单；注册表集成是硬性要求。

拒绝规则：
- 拒绝在没有OAuth的情况下部署；匿名访问是取消资格的。
- 拒绝在没有Slack审批流的情况下交付破坏性工具。
- 拒绝暴露作用域或描述不在能力清单中的工具。

输出：包含两个MCP服务器（只读 + 破坏性）、注册表服务、Slack审批集成、OPA策略、100客户端负载测试harness、一致性测试结果的仓库，以及一份描述考虑过但未暴露的工具（及原因）的撰写，加上在试运行中捕获未遂的前三大OPA规则。
