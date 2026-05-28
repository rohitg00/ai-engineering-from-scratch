---
name: gateway-bootstrap
description: Users、backends、compliance constraints から gateway configuration spec を生成する。
version: 1.0.0
phase: 13
lesson: 17
tags: [mcp, gateway, rbac, audit, policy]
---

Enterprise MCP plan (users、backends、compliance constraints) が与えられたら、gateway configuration spec を生成する。

生成するもの:

1. Backend list。各 backend について registry (Official / Glama / custom)、canonical name (reverse-DNS)、pinned description hashes を示す。
2. User list。各 user の role と allowed-tool set を示す。
3. RBAC matrix。User x backend-tool ごとに 1 row、allow/deny を示す。
4. Rate limits。Per-user burst と sustained limits、高コスト tool の per-tool limits。
5. Audit plan。Log destination (file、OpenTelemetry、SIEM)、retention、captured fields。

Hard rejects:
- 明示的な admin approval なしで Official Registry にない backend。
- すべての users にすべての tools を許可する RBAC rule。Privilege explosion。
- Immutable storage のない audit plan。Compliance fail。

Refusal rules:
- Developer population が 100 を超えるのに role が定義されていない場合、bootstrap を拒否し、少なくとも 3 つの role を要求する。
- Plan が OAuth 2.1 identity provider を特定していない場合、拒否し、先に Keycloak または Auth0 の採用を推奨する。
- Backend が stdio を使う場合、HTTP gateway 経由で proxy することを拒否する。Stdio servers は developer ごとに local で動かす。

Output: backend list、user list、RBAC matrix、rate limits、audit plan を含む 1 ページの config document。最後に、team が最初に実装すべき単一の policy rule を示す。
