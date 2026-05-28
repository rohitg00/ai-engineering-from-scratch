---
name: mcp-server-platform
description: StreamableHTTP、OAuth 2.1 scopes、OPA policy、destructive tool 用 human-approval gate、discovery 用 registry を備えた production MCP server を deploy する。
version: 1.0.0
phase: 19
lesson: 13
tags: [capstone, mcp, fastmcp, streamablehttp, oauth, opa, registry, governance]
---

Enterprise environment を対象に、10 個の internal tool を持つ MCP server、discovery 用 registry service、destructive tool を Slack approval で gate する governance layer を ship する。

Build plan:

1. FastMCP server で 10 個の read-only tool (Postgres、S3、Jira、Linear、Datadog、PagerDuty、GitHub、Notion、Slack、Salesforce) を expose する。各 tool は typed schema と required scope を持つ。
2. StreamableHTTP transport。Load balancer 背後で stateless にする。
3. OAuth 2.1 token introspection middleware。Workload identity は SPIFFE / SPIRE。
4. すべての tool call に OPA / Rego policy decision を適用する: scope enforcement、PII redaction、payload size cap。
5. Destructive tool (Jira create、Linear create、Postgres write) は separate MCP server に置き、15 分以内に Slack card で elevation された scope `approved:by:human` を必須にする。
6. 各 server から `.well-known/mcp-capabilities` を poll し、JSON Schema で validate し、list/search/validate/enable UI を提供する registry service。
7. Write 前に Presidio PII redaction を行う per-tenant JSONL audit log。
8. Horizontal scale を demonstrate する 100-client load test。MCP conformance suite を pass する。

Assessment rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | Spec conformance | StreamableHTTP + capability manifest が MCP conformance test を pass |
| 20 | Security | Scope enforcement、全 tool の OPA coverage、secret hygiene |
| 20 | Observability | Write 時に PII redaction する per-tool-call audit log |
| 20 | Scale | Horizontal scale demonstration 付き 100-client load test |
| 15 | Registry UX | Discover / validate / enable-disable workflow を実行 |

Hard rejects:

- Stateful session を必須にする server (2026 StreamableHTTP stateless contract 違反)。
- Destructive tool が read-only と同じ auth surface を共有する single-server topology。
- Raw PII を persist する audit log。
- Capability manifest を無視すること。Registry integration は必須要件。

Refusal rules:

- OAuth なしでは deploy しない。Anonymous access は失格。
- Slack approval flow なしで destructive tool を ship しない。
- Scope または description が capability manifest に載っていない tool は expose しない。

Output: 2 つの MCP server (read-only + destructive)、registry service、Slack approval integration、OPA policies、100-client load-test harness、conformance-test results、expose を検討したが見送った tool とその理由、dry-run 中の near-miss を捕まえた OPA rule top 3 を説明する write-up を含む repo。
