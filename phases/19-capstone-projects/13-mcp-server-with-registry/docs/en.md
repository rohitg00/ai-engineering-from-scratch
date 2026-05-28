# キャップストーン 13 — MCP Server with Registry and Governance

> Model Context Protocol は未来の仕様ではなく、2026 年には default の tool-use spec になった。Anthropic、OpenAI、Google、主要 IDE は MCP client を提供している。Pinterest は内部 MCP server ecosystem を公開した。AAIF Registry は `.well-known` に置く capability metadata を形式化した。AWS ECS は stateless deployment の参照実装を公開した。Block の goose-agent は同じ protocol を hosted assistant の中に入れた。2026 年の本番構成は、StreamableHTTP transport、OAuth 2.1 scopes、OPA policy gating、platform team が server を discover、validate、enable できる registry である。これを end to end で構築する。

**種類:** Capstone
**言語:** Python (server, via FastMCP) または TypeScript (@modelcontextprotocol/sdk)、Go (registry service)
**前提:** Phase 11 (LLM engineering)、Phase 13 (tools and MCP)、Phase 14 (agents)、Phase 17 (infrastructure)、Phase 18 (safety)
**演習対象フェーズ:** P11 · P13 · P14 · P17 · P18
**時間:** 25 時間

## 問題

MCP は tool-use の lingua franca になった。Claude Code、Cursor 3、Amp、OpenCode、Gemini CLI、そしてすべての managed agent が MCP server を consume する。本番での課題は server authoring ではない (FastMCP が容易にする)。課題は、enterprise requirement を満たして scale deployment することだ: tenant ごとの OAuth scope、destructive tool に対する OPA policy、StreamableHTTP stateless scaling、discovery 用 registry、tool call ごとの audit log。Pinterest の internal MCP ecosystem と AAIF Registry spec が 2026 年の基準を作っている。

あなたは 10 個の internal tool (Postgres read-only、S3 listing、Jira、Linear、Datadog など) を公開する MCP server、platform discovery 用 registry UI、destructive tool の human-approval gate を構築する。Load test では StreamableHTTP の horizontal scaling を示す。Audit trail は enterprise security review を満たす。

## コンセプト

MCP 2026 revision は StreamableHTTP を default transport として要求する。以前の stdio-and-SSE 形式と違い、StreamableHTTP は default で stateless である。単一の HTTP endpoint が JSON-RPC request を受け取り、response を stream し、notification 用の long-lived connection を support する。Stateless なので load balancer の背後で horizontal scale できる。

Authorization は per-tool scope を持つ OAuth 2.1 で行う。Token には `jira:read`、`s3:list`、`postgres:query:readonly` のような scope が入る。MCP server は session start だけではなく tool-call time に scope を検査する。High-risk tool では、直近 N 分以内に `approved:by:human` に elevation されていない scope の call を server が拒否する。この elevation は Slack review card から来る。

Registry は別 service である。各 MCP server は tool manifest、transport URL、auth requirements を含む `.well-known/mcp-capabilities` document を公開する。Registry は poll、validate、index を行う。Platform team は registry UI で、利用できる tool、必要な scope、owner team を確認する。

## アーキテクチャ

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

## スタック

- Server framework: FastMCP (Python) または `@modelcontextprotocol/sdk` (TypeScript)
- Transport: HTTPS 上の StreamableHTTP (stateless)
- Auth: OAuth 2.1 と SPIFFE / SPIRE による workload identity
- Policy: tool ごとの OPA / Rego rule。Request ごとに policy decision service を呼ぶ
- Registry: self-hosted。`.well-known/mcp-capabilities` manifest を consume する
- Human approval: destructive tool 用 Slack interactive message
- Deployment: AWS ECS Fargate または Fly.io。Tenant ごとに 1 server、または tenant scoping 付き shared server
- Audit: per-tenant bucket に structured JSONL、call ごとの lineage 付き

## 実装

1. **Tool surface.** 10 個の internal tool を expose する: Postgres read-only query、S3 list objects、Jira search/fetch、Linear search/fetch、Datadog metric query、PagerDuty on-call lookup、GitHub read-only、Notion search、Slack search、Salesforce read。各 tool は typed schema と scope label を持つ。

2. **FastMCP server.** Tool を mount する。StreamableHTTP transport を設定する。OAuth token introspection と scope enforcement 用 middleware を追加する。

3. **OPA policy.** Tool ごとの Rego policy: どの scope が invocation を許可するか、どの PII redaction を適用するか、payload-size cap は何か。すべての tool call で decision service を呼ぶ。

4. **Registry service.** Registered server から `.well-known/mcp-capabilities` を poll し、JSON Schema で validate し、list / search / validate / enable-disable UI を提供する独立した Go または TS service。

5. **Capability manifest.** 各 server は `.well-known/mcp-capabilities` を expose する。中身は tool list、auth requirements、transport URL、owner team、SLO。

6. **Destructive tool separation.** State を mutate する tool (Jira create、Linear create、Postgres write) は 2 つ目の MCP server に置き、より厳しい auth flow にする。Token は Slack card 経由で 15 分以内に elevation された `approved:by:human` scope を持つ必要がある。

7. **Audit log.** Tenant ごとに append-only JSONL: `{timestamp, user, tool, args_redacted, response_redacted, outcome}`。Write 前に Presidio で PII redaction する。

8. **Load test.** StreamableHTTP 上で 100 concurrent clients。2 つ目の replica を追加して horizontal scaling を示し、session stickiness なしに load balancer が redistributing することを見せる。

9. **Conformance tests.** Official MCP conformance suite を両 server に対して実行する。Mandatory section をすべて pass する。

## 使ってみる

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

## Ship It

`outputs/skill-mcp-server.md` が提出物を説明する。OAuth 2.1 scope と OPA gating を備えた internal tool 用の production-grade MCP server + registry + audit layer。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Spec conformance | StreamableHTTP + capability manifest が MCP conformance test を pass |
| 20 | Security | Scope enforcement、全 tool の OPA coverage、secret hygiene |
| 20 | Observability | PII redaction 付き per-tool-call audit log |
| 20 | Scale | 100-client load test で horizontal scale を demonstrate |
| 15 | Registry UX | Discover / validate / enable-disable workflow |
| **100** | | |

## 演習

1. 新しい tool (Confluence search) を追加する。Core server に触らず registry validation flow を通して ship する。

2. `email`、`ssn`、`phone` という列を含む Postgres query result を redact する OPA policy を書く。Probe query で実行する。

3. Local latency で StreamableHTTP と stdio を benchmark する。Per-call p50/p95 を報告する。

4. Per-tenant quota を実装する: tenant ごと、tool ごと、1 分あたり最大 N calls。2 つ目の OPA rule で enforce する。

5. [mcp-conformance-tests](https://github.com/modelcontextprotocol/conformance) から MCP conformance suite を実行し、すべての failure を修正する。

## 重要用語

| Term | よくある言い方 | 実際の意味 |
|------|-----------------|------------|
| StreamableHTTP | "2026 MCP transport" | Stateless HTTP + streaming。Networked server では SSE + stdio を置き換える |
| Capability manifest | "Well-known doc" | tool list、auth、transport URL を持つ `.well-known/mcp-capabilities` |
| OPA / Rego | "Policy engine" | External rule に対して tool call を authorize する Open Policy Agent |
| Scope elevation | "Approved-by-human" | Slack approval で付与される短命 scope。Destructive tool に必要 |
| Registry | "Tool discovery" | capability manifest から MCP server を index する service |
| Workload identity | "SPIFFE / SPIRE" | OAuth token 発行用の cryptographic service identity |
| Conformance suite | "Spec tests" | StreamableHTTP + tool manifest correctness 用の official MCP test battery |

## 参考資料

- [Model Context Protocol 2026 Roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — StreamableHTTP、capability metadata、registry
- [AAIF MCP Registry spec](https://github.com/modelcontextprotocol/registry) — 2026 registry spec
- [AWS ECS reference deployment](https://aws.amazon.com/blogs/containers/deploying-model-context-protocol-mcp-servers-on-amazon-ecs/) — production deployment の参照実装
- [Pinterest internal MCP ecosystem](https://www.infoq.com/news/2026/04/pinterest-mcp-ecosystem/) — internal deployment の参照例
- [Block `goose` MCP usage](https://block.github.io/goose/) — agent consumption pattern の参照例
- [FastMCP](https://github.com/jlowin/fastmcp) — Python server framework
- [Open Policy Agent](https://www.openpolicyagent.org/) — policy engine reference
- [SPIFFE / SPIRE](https://spiffe.io) — workload identity reference
