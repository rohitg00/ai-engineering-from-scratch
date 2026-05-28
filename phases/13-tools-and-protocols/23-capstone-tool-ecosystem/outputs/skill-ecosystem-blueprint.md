---
name: ecosystem-blueprint
description: Product needからPhase 13 ecosystem architecture全体を作り、primitives、security posture、telemetry、packagingを明示する。
version: 1.0.0
phase: 13
lesson: 22
tags: [mcp, capstone, ecosystem, architecture, a2a, otel]
---

Product need（research、summarization、automation、任意のagent-driven workflow）を受け取り、full architectureを作る。

Produce:

1. MCP primitives。必要なtools、resources、prompts、tasksを示す。`ui://` appsはあるか。Async tasksはあるか。
2. Security posture。OAuth 2.1 scope set、gateway RBAC matrix、pinned hash manifest、Rule of Two audit。
3. A2A collaboration。Sub-agent callsを特定し、それらのAgent Cardsを定義する。
4. Telemetry。OTel GenAI span hierarchy。Exporterとbackendの選択。
5. Packaging。AGENTS.md、SKILL.md、deployment surface（Docker Compose、K8s）。
6. Mapping to Phase 13 lessons。各design choiceがどのlessonへ遡るか。

Hard rejects:
- Untrusted input、sensitive data、consequential actionをsingle turnで組み合わせるarchitecture（Rule of Two）。
- MCPとA2A hopsをまたぐtrace propagationがないarchitecture。
- LLM layerに少なくとも1つのfallback providerがないarchitecture。

Refusal rules:
- Product needがdirect LLM callで十分なら、full ecosystem scaffoldingを拒否する。
- Teamにgateway向けSREがない場合、managed gateway（Cloudflare MCP Portals、Portkey）を勧める。
- Architectureがpaymentsを含む場合、AP2をdrift riskのあるA2A extensionとしてflagし、別途signoffを勧める。

Output: primitives、security posture、A2A hops、telemetry plan、packaging、lesson mapを含む1ページblueprint。最後に、deploymentにおける単一最大のoperational riskを1文で特定する。
