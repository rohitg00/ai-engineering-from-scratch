---
name: mcp-auth-iii-wiring
description: Conecte a autorização MCP de produção (RFC 8414, 7591, 8707, 7636 PKCE, 9728) a iii primitivos — RegisterTrigger para HTTP/cron, RegisterFunction para validação, state::* para cache JWKS.
version: 1.0.0
phase: 13
lesson: 18
tags: [mcp, oauth, dcr, jwks, iii, rfc8414, rfc7591, rfc8707, rfc7636, rfc9728]
---

Dada uma configuração de servidor MCP e um conjunto de recursos IdP, emita as iii primitivas e regras de recusa que constituem a superfície de autenticação de produção.

Entradas:

- `mcp_resource_url` — URL de recurso canônico (sem caminho), usado como `aud` e como valor de metadados de recurso protegido `resource`.
- `idp_metadata_url` — o URL `/.well-known/oauth-authorization-server` do IdP.
- `idp_capabilities` — valores observados para `code_challenge_methods_supported`, `grant_types_supported`, `registration_endpoint`, `response_types_supported`.
- `tools` — a lista de ferramentas MCP com o escopo que cada uma exige.

Produzir:

1. **Portão de recusa.** Se alguma das quatro condições falhar, recuse a fiação e pare:
   - `S256` está faltando em `code_challenge_methods_supported`.
   - `authorization_code` está faltando em `grant_types_supported`.
   - `registration_endpoint` está ausente (sem RFC 7591 DCR).
   - `response_types_supported` é qualquer coisa diferente de exatamente `["code"]`.

2. **Documento de metadados de recursos protegidos** (RFC 9728) para o servidor MCP publicar em `/.well-known/oauth-protected-resource`. Inclui `resource`, `authorization_servers` (a lista de permissões do emissor), `scopes_supported`, `bearer_methods_supported: ["header"]`.

3. **iii acione registros.** Emita cada chamada literalmente:
   -`iii.registerTrigger("http", {"path": "/.well-known/oauth-protected-resource", "method": "GET"}, "auth::serve-protected-resource")`
   - `iii.registerTrigger("http", {"path": "/mcp", "method": "POST"}, "mcp::dispatch")` — o despachante chama `iii.trigger("auth::validate-jwt", ...)` antes de qualquer ferramenta ser executada.
   - `iii.registerTrigger("cron", {"schedule": "<rotation_schedule>"}, "auth::rotate-jwks")` — a programação é `0 */6 * * *` por padrão; aperte para `*/15 * * * *` para IdPs de alta rotação.

4. **iii registros de funções.** Emita cada chamada literalmente:
   - `iii.registerFunction("auth::validate-jwt", handler)` — verifica a lista de permissões de `iss`, assinatura em JWKS em cache, `aud == mcp_resource_url`, `exp`, escopo necessário.
   - `iii.registerFunction("auth::rotate-jwks", handler)` — busca `jwks_uri`, escreve `state::set("auth/jwks/<iss>", {keys, fetched_at})`.
   - `iii.registerFunction("auth::serve-protected-resource", handler)` — retorna o documento de (2).
   - `iii.registerFunction("auth::issue-step-up", handler)` — somente se a lista de ferramentas contiver operações restritas a um escopo que o usuário não concede inicialmente.

5. **Plano de chave estadual.** Uma chave por emissor aceito: `auth/jwks/<issuer>` detentor de `{keys, fetched_at}`. Documente o padrão de leitura: o validador lê de `state::get`, retorna para um `iii.trigger("auth::rotate-jwks", ...)` síncrono na falha de `kid`.

6. **Mapeamento de escopo.** Mapeie cada ferramenta de acordo com o escopo necessário. Produza uma tabela:
   `| tool | required_scope | rationale |`. Agrupar ferramentas destrutivas sob seu próprio escopo; nunca reutilize um escopo de leitura para uma ferramenta de gravação.

7. **Regras de recusa em tempo de execução** (o validador deve codificá-las — emiti-las no corpo do manipulador):
   - Rejeitar quando `aud != mcp_resource_url`.
   - Rejeitar quando `iss not in authorization_servers`.
   - Rejeitar quando `kid` não estiver em JWKS em cache após um único fallback de rotação.
   - Rejeitar quando o escopo necessário estiver ausente → 403 `Bearer error="insufficient_scope", scope="<required>", resource="<mcp_resource_url>"`.
   - Rejeite qualquer solicitação de token sem o parâmetro `code_verifier` ou `resource`.

Rejeições definitivas (nunca transfira nenhuma delas - recuse a solicitação e documente o motivo):

- Armazenando `client_secret` em texto simples no armazenamento de estado iii. Clientes públicos usam `token_endpoint_auth_method: none`; clientes confidenciais usam `private_key_jwt`. Nenhum segredo compartilhado em texto simples em `state::*` ou nos logs de resposta de registro.
- Ignorando a verificação `aud` no validador. Deputado confuso é toda a razão para RFC 8707 + RFC 9728.
- Permitir solicitações de código de autorização sem PKCE. OAuth 2.1 proíbe isso; o validador deve rejeitar qualquer troca `/token` cujo registro de código de autorização armazenado não possua `code_challenge`.
- Armazenando JWKS em cache sem um trabalho de atualização. O gatilho cron é enviado ou a superfície de autenticação não é implantada.
- Confiar na reivindicação `iss` sem uma lista de permissões. Qualquer validador que aceite um token de qualquer `iss` permite que um invasor crie seu próprio IdP e forje tokens.
- Armazenando `registration_access_token` em texto simples. Hash em repouso; exigem texto não criptografado em cada atualização.

Saída: um plano de ligação de uma página com o documento de recurso protegido, as três chamadas `registerTrigger`, as quatro chamadas `registerFunction`, o plano de chave de estado, a tabela de mapeamento de escopo e as regras de recusa de tempo de execução codificadas. Termine com a lacuna única de bloqueio de implantação com maior probabilidade de surgir no IdP escolhido – normalmente disponibilidade de DCR para SSO corporativo.