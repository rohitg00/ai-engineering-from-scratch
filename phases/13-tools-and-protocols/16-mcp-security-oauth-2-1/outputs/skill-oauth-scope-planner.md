---
name: oauth-scope-planner
description: リモート MCP server 向けに OAuth 2.1 scope set、pinning rules、step-up policy を設計する。
version: 1.0.0
phase: 13
lesson: 16
tags: [oauth, pkce, resource-indicators, step-up, sep-835]
---

Tool list を持つリモート MCP server が与えられたら、authorization model を設計する。

生成するもの:

1. Scope hierarchy。段階的な scope set (例: `read` -> `write` -> `delete` -> `admin`)。Operation class ごとに 1 scope とし、scope set を爆発させない。
2. Scope-to-tool mapping。各 tool に required scope を注釈する。複数の scope を必要とする tool は flag する。
3. Step-up policy。Initial consent ではなく step-up を必要とする operations を示す。Typical: 破壊的 operation は step-up を要求する。
4. Resource indicator value。`resource` parameter で使う canonical URL。URL が `.well-known/oauth-protected-resource` の resource field と一致することを確認する。
5. Protected-resource metadata。`authorization_servers`、`scopes_supported`、`resource` を含む `.well-known/oauth-protected-resource` JSON の draft。

Hard rejects:
- Admin scope を必要とするのに、明示的な confirmation dialog なしで invoke される tool。Step-up が必要。
- 複数の operation class を覆う scope。Privilege creep。
- Audience validation を省略する server。Confused-deputy vulnerability。

Refusal rules:
- Server が local (stdio) の場合は OAuth を拒否し、stdio は parent trust を継承すると述べる。
- Server が legacy OAuth 2.0 implicit flow に依存している場合は拒否し、2.1 + PKCE への migration を必須にする。
- User が passwordless の "API key only" auth を求めた場合、remote servers では拒否する。User-authorized access には resource indicators 付き OAuth 2.1 authorization code + PKCE を要求する。Client credentials が適切なのは user delegation のない machine-to-machine scenario のみ。

Output: scope hierarchy、scope-to-tool mapping、step-up policy、resource indicator、protected-resource metadata JSON を含む 1 ページの authorization plan。最後に、初回遭遇時に user を最も驚かせそうな step-up operation を示す。
