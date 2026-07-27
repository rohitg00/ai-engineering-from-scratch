---
name: mcp-server-platform
description: 部署一个生产级 MCP 服务器，支持 StreamableHTTP、OAuth 2.1 作用域、OPA 策略、面向破坏性工具的人工审批门控，以及用于发现的注册表。
version: 1.0.0
phase: 19
lesson: 13
tags: [capstone, mcp, fastmcp, streamablehttp, oauth, opa, registry, governance]
---

给定一个企业环境，提供一个包含 10 个内部工具的 MCP 服务器、一个用于发现的注册表服务，以及一个通过 Slack 批准门控破坏性工具的管理层。

构建计划：

1. FastMCP 服务器，公开 10 个只读工具（Postgres、S3、Jira、Linear、Datadog、PagerDuty、GitHub、Notion、Slack、Salesforce），每个都有类型化模式和所需作用域。
2. StreamableHTTP 传输，无状态，位于负载均衡器后面。
3. OAuth 2.1 令牌内省中间件；通过 SPIFFE / SPIRE 的工作负载身份。
4. 对每个工具调用的 OPA / Rego 策略决策：作用域执行、PII 编辑、负载大小上限。
5. 破坏性工具（Jira 创建、Linear 创建、Postgres 写入）在单独的 MCP 服务器上，需要作用域 `approved:by:human`，通过 Slack 卡片在 15 分钟内提升。
6. 注册表服务，从每个服务器轮询 `.well-known/mcp-capabilities`，使用 JSON Schema 验证，并公开列表/搜索/验证/启用 UI。
7. 每个租户的 JSONL 审计日志，在写入前进行 Presidio PII 编辑。
8. 100 客户端负载测试，展示水平扩展；通过 MCP 一致性测试套件。

评估量规：

| 权重 | 标准 | 衡量方法 |
|:-:|---|---|
| 25 | 规范一致性 | StreamableHTTP + 能力清单通过 MCP 一致性测试 |
| 20 | 安全性 | 作用域执行、每个工具的 OPA 覆盖率、密钥卫生 |
| 20 | 可观测性 | 每个工具调用审计日志，写入时 PII 编辑 |
| 20 | 扩展性 | 100 客户端负载测试，展示水平扩展 |
| 15 | 注册表用户体验 | 发现/验证/启用-禁用工作流演示 |

硬性拒绝：

- 需要有状态会话的服务器（违反 2026 StreamableHTTP 无状态合同）。
- 破坏性工具与只读工具共享相同认证表面的单服务器拓扑。
- 持久化原始 PII 的审计日志。
- 忽略能力清单；注册表集成是硬性要求。

拒绝规则：

- 拒绝在没有 OAuth 的情况下部署；匿名访问是不可接受的。
- 拒绝在未集成 Slack 审批流程的情况下提供破坏性工具。
- 拒绝暴露作用域或描述不在能力清单中的工具。

输出：一个包含两个 MCP 服务器（只读 + 破坏性）、注册表服务、Slack 批准集成、OPA 策略、100 客户端负载测试框架、一致性测试结果，以及一份说明您考虑过但未暴露的工具（及原因）以及干运行期间捕获到接近失误的前三大 OPA 规则的仓库。
