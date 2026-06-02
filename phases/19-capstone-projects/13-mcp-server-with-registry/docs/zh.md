# Capstone 13 — 带注册表与治理的 MCP Server

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Model Context Protocol 在 2026 年不再是未来式，而是 tool-use 规范的事实标准。Anthropic、OpenAI、Google，以及所有主流 IDE 都内置了 MCP 客户端。Pinterest 公开了它内部的 MCP server 生态。AAIF Registry 在 `.well-known` 路径上把能力（capability）元数据规范化。AWS ECS 发布了无状态部署的参考实现。Block 的 goose-agent 把同一套协议放进了托管助手里。2026 年的生产形态是：StreamableHTTP 传输、OAuth 2.1 scopes、OPA 策略门控，外加一个让平台团队能发现、校验、启用 server 的注册表。把这一整套从头到尾搭起来。

**Type:** Capstone
**Languages:** Python（server，借助 FastMCP）或 TypeScript（@modelcontextprotocol/sdk），Go（注册表服务）
**Prerequisites:** Phase 11（LLM engineering）、Phase 13（tools 与 MCP）、Phase 14（agents）、Phase 17（基础设施）、Phase 18（安全）
**Phases exercised:** P11 · P13 · P14 · P17 · P18
**Time:** 25 hours

## 问题（Problem）

MCP 已成为 tool-use 的通用语。Claude Code、Cursor 3、Amp、OpenCode、Gemini CLI，以及所有的托管 agent 现在都消费 MCP server。生产环境的挑战不在于「写 server」（FastMCP 让这件事很简单），而在于满足企业要求的大规模部署：按租户的 OAuth scopes、对破坏性工具的 OPA 策略、StreamableHTTP 无状态扩缩容、用于发现的注册表、每次工具调用的审计日志。Pinterest 的内部 MCP 生态和 AAIF Registry spec 共同定义了 2026 年的标杆。

你将构建一个暴露 10 个内部工具（Postgres 只读、S3 列举、Jira、Linear、Datadog 等）的 MCP server，一个供平台发现使用的注册表 UI，以及面向破坏性工具的人工审批门控。负载测试演示 StreamableHTTP 的水平扩展。审计轨迹满足企业级安全评审。

## 概念（Concept）

MCP 2026 修订版强制把 StreamableHTTP 作为默认传输。和早期的 stdio + SSE 形态不同，StreamableHTTP 默认无状态：单一 HTTP 端点接收 JSON-RPC 请求、流式返回响应，并支持长连接以投递通知。无状态意味着可以在负载均衡器后水平扩展。

授权采用 OAuth 2.1，scopes 按工具划分。一个 token 携带类似 `jira:read`、`s3:list`、`postgres:query:readonly` 的 scope。MCP server 在工具调用时检查 scope，而不只是会话开始时检查一次。对于高风险工具，server 会拒绝任何 scope 未在最近 N 分钟内被提升为 `approved:by:human` 的调用 —— 这种提升来自一张 Slack 评审卡。

注册表是一个独立服务。每个 MCP server 暴露一份 `.well-known/mcp-capabilities` 文档，包含其工具清单、传输 URL、auth 要求。注册表轮询、校验、建立索引。平台团队通过注册表 UI 查看哪些工具可用、各自需要什么 scope，以及由哪个团队拥有。

## 架构（Architecture）

```
MCP client (Claude Code, Cursor 3, ...)
          |
          v
StreamableHTTP over HTTPS (JSON-RPC + streaming)
          |
          v
MCP server (FastMCP) behind load balancer
          |
   +------+------+---------+----------+------------+
   v             v         v          v            v
Postgres    S3 listing  Jira       Linear     Datadog
(read-only) (paged)     (read)     (read)     (query)
          |
   +------+-------------+
   v                    v
 OPA policy gate   destructive tool MCP (separate server)
                        |
                        v
                   human approval via Slack
                        |
                        v
                   audit log (append-only, per-tenant)

  registry service
     |
     v  GET /.well-known/mcp-capabilities from each server
     v
     UI: search / validate / enable-disable / ownership
```

## 技术栈（Stack）

- Server 框架：FastMCP（Python）或 `@modelcontextprotocol/sdk`（TypeScript）
- 传输：StreamableHTTP over HTTPS（无状态）
- Auth：OAuth 2.1 + 通过 SPIFFE / SPIRE 的工作负载身份（workload identity）
- 策略：每个工具一份 OPA / Rego 规则；每次请求调用策略决策服务
- 注册表：自托管，消费 `.well-known/mcp-capabilities` manifest
- 人工审批：对破坏性工具走 Slack 交互消息
- 部署：AWS ECS Fargate 或 Fly.io，每租户一个 server，或共享 server + 租户作用域
- 审计：按租户落地的结构化 JSONL，记录每次调用的血缘

## 动手实现（Build It）

1. **工具面（Tool surface）。** 暴露 10 个内部工具：Postgres 只读查询、S3 list objects、Jira 搜索/拉取、Linear 搜索/拉取、Datadog 指标查询、PagerDuty on-call 查询、GitHub 只读、Notion 搜索、Slack 搜索、Salesforce 只读。每个工具都有强类型 schema 和一个 scope 标签。

2. **FastMCP server。** 挂载这些工具。配置 StreamableHTTP 传输。加一个中间件做 OAuth token 内省与 scope 强制。

3. **OPA 策略。** 每个工具一份 Rego 策略：哪些 scope 允许调用、应用什么 PII 脱敏、payload 大小上限是多少。每次工具调用都走决策服务。

4. **注册表服务。** 一个独立的 Go 或 TS 服务，从已注册的 server 轮询 `.well-known/mcp-capabilities`，用 JSON Schema 校验，并对外提供列表 / 搜索 / 校验 / 启停的 UI。

5. **能力清单（Capability manifest）。** 每个 server 暴露 `.well-known/mcp-capabilities`，内容包含：工具列表、auth 要求、传输 URL、属主团队、SLO。

6. **破坏性工具拆分。** 改写状态的工具（Jira create、Linear create、Postgres write）放到第二个 MCP server，走更严格的 auth 流程：token 必须在最近 15 分钟内通过 Slack 卡片提升出 `approved:by:human` scope。

7. **审计日志。** 按租户的 append-only JSONL：`{timestamp, user, tool, args_redacted, response_redacted, outcome}`。写入前用 Presidio 做 PII 脱敏。

8. **负载测试。** 100 个并发客户端打 StreamableHTTP。增加第二个副本以演示水平扩展；展示负载均衡器在没有 session stickiness 的前提下重新分配流量。

9. **一致性测试（Conformance tests）。** 在两个 server 上跑官方的 MCP conformance 套件。所有强制条目必须通过。

## 用起来（Use It）

```
$ curl -H "Authorization: Bearer eyJhbGc..." \
       -X POST https://mcp.internal.example.com/ \
       -d '{"jsonrpc":"2.0","method":"tools/call",
            "params":{"name":"postgres.readonly","arguments":{"sql":"SELECT 1"}}}'
[registry]   capability validated: postgres.readonly v1.2
[policy]    scope postgres:query:readonly present; allowed
[audit]     logged: user=u42 tool=postgres.readonly outcome=ok
response:    { "result": { "rows": [[1]] } }
```

## 上线部署（Ship It）

`outputs/skill-mcp-server.md` 描述交付物。一套生产级的 MCP server + 注册表 + 审计层，覆盖内部工具，带 OAuth 2.1 scopes 与 OPA 门控。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | 规范一致性 | StreamableHTTP + capability manifest 通过 MCP conformance 测试 |
| 20 | 安全 | scope 强制、所有工具的 OPA 覆盖、密钥卫生 |
| 20 | 可观测性 | 每次工具调用的审计日志，含 PII 脱敏 |
| 20 | 规模 | 100 客户端负载测试演示水平扩展 |
| 15 | 注册表 UX | 发现 / 校验 / 启停 流程顺畅 |
| **100** | | |

## 练习（Exercises）

1. 新增一个工具（Confluence 搜索）。在不改动核心 server 的前提下走完整的注册表校验流程上线。

2. 写一份 OPA 策略，对 Postgres 查询结果中名为 `email`、`ssn` 或 `phone` 的列做脱敏。用一条探针查询验证。

3. 在本地基准对比 StreamableHTTP 与 stdio 的延迟。报告每次调用的 p50 / p95。

4. 实现按租户的配额：每租户每工具每分钟最多 N 次调用。用第二条 OPA 规则强制。

5. 跑 [mcp-conformance-tests](https://github.com/modelcontextprotocol/conformance) 提供的 MCP conformance 套件，修掉每一处失败。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| StreamableHTTP | 「2026 MCP 传输」 | 无状态 HTTP + 流式；面向网络化 server，取代 SSE + stdio |
| Capability manifest | 「well-known 文档」 | `.well-known/mcp-capabilities`，含工具列表、auth、传输 URL |
| OPA / Rego | 「策略引擎」 | Open Policy Agent，根据外部规则授权工具调用 |
| Scope elevation | 「人工批准过的」 | 通过 Slack 审批临时授予的短时 scope，破坏性工具必备 |
| Registry | 「工具发现」 | 从 capability manifest 索引 MCP server 的服务 |
| Workload identity | 「SPIFFE / SPIRE」 | 用于签发 OAuth token 的密码学服务身份 |
| Conformance suite | 「规范测试」 | 官方 MCP 测试集，校验 StreamableHTTP + 工具 manifest 的正确性 |

## 延伸阅读（Further Reading）

- [Model Context Protocol 2026 Roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — StreamableHTTP、能力元数据、注册表
- [AAIF MCP Registry spec](https://github.com/modelcontextprotocol/registry) — 2026 注册表规范
- [AWS ECS reference deployment](https://aws.amazon.com/blogs/containers/deploying-model-context-protocol-mcp-servers-on-amazon-ecs/) — 参考生产部署
- [Pinterest internal MCP ecosystem](https://www.infoq.com/news/2026/04/pinterest-mcp-ecosystem/) — 参考的内部部署
- [Block `goose` MCP usage](https://block.github.io/goose/) — 参考的 agent 消费模式
- [FastMCP](https://github.com/jlowin/fastmcp) — Python server 框架
- [Open Policy Agent](https://www.openpolicyagent.org/) — 策略引擎参考
- [SPIFFE / SPIRE](https://spiffe.io) — 工作负载身份参考
