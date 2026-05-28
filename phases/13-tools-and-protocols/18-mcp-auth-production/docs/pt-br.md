# Auth em Produção MCP — DCR, Rotação JWKS, Tokens Ancorados em Audience nas Primitivas iii

> A Lição 16 levantou a máquina de estado OAuth 2.1 em memória. Em 2026, todo servidor MCP que você disponibiliza pra uma organização real fica atrás de auth em produção: registro dinâmico de cliente (RFC 7591), descoberta de metadados do servidor de autorização (RFC 8414), rotação de JWKS que não quebra uma validação de token às 3 da manhã, e tokens ancorados em audience que recusam reuso de confused-deputy. Essa lição conecta tudo isso através de primitivas iii — `iii.registerTrigger` pra HTTP e cron, `iii.registerFunction` pra lógica de auth, `state::set/get` pra chaves cacheadas — pra que a superfície de auth seja observável, reiniciável e reproduzível como qualquer outra workload no engine.

**Tipo:** Construir
**Linguagens:** Python (stdlib, iii primitivas mockadas pro ambiente da lição)
**Pré-requisitos:** Fase 13 · 16 (Máquina de estado OAuth 2.1), Fase 13 · 17 (gateways)
**Tempo:** ~90 minutos

## Objetivos de Aprendizado

- Descobrir um servidor de autorização através dos metadados RFC 8414 e verificar o contrato.
- Implementar registro dinâmico de cliente RFC 7591 pra que clientes MCP se registrem sem intervenção de admin.
- Cache e rote de chaves JWKS usando um trigger de cron pra que verificação de assinatura sobreviva à rotação de chaves.
- Ancore tokens a um único recurso MCP usando indicadores de recurso RFC 8707 e recuse reuso de confused-deputy.
- Conecte cada endpoint e job de background como primitivas iii — triggers HTTP, triggers cron, funções nomeadas e leituras `state::*` — pra que uma única reinicialização reconstrua a superfície de auth.
- Leia uma matriz de capacidades de IdP e recuse implantação quando o IdP não satisfaz o perfil de auth do MCP.

## O Problema

O simulador da Lição 16 roda OAuth 2.1 em memória. Produção tem três lacunas operacionais que um simulador só em memória não vê.

A primeira lacuna é cadastro. Uma organização real roda centenas de servidores MCP e milhares de clientes MCP. Operadores não cadastram manualmente cada usuário do Cursor como cliente OAuth. RFC 7591 de registro dinâmico de cliente permite que um cliente faça `POST /register` contra o servidor de autorização e receba um `client_id` (e opcionalmente um `client_secret`) na hora. O servidor publica `registration_endpoint` nos seus metadados RFC 8414; o cliente descobre sem configuração out-of-band.

A segunda lacuna é rotação de chaves. Validação JWT depende das chaves de assinatura do servidor de autorização, publicadas como JSON Web Key Set (JWKS). O servidor de autorização rotaciona essas em agenda (geralmente a cada hora, às vezes mais rápido sob resposta a incidente). Um servidor MCP que busca JWKS uma vez no boot valida bem até a janela de rotação — depois cada requisição falha até reinicialização. Em produção, JWKS é conectado como valor cacheado com job de refresh que sobrescreve o cache antes das chaves anteriores expirarem, mais um reserva de busca em cache miss pra caso um token assinado por uma chave mais nova que o cache chegue.

A terceira lacuna é vinculação de audience. A Lição 16 introduziu indicadores de recurso RFC 8707. Em produção, esse indicador vira uma checagem rigorosa em cada requisição. O servidor MCP compara `token.aud` com sua própria URL canônica de recurso e rejeita divergências com HTTP 401. Essa é a única defesa contra um servidor MCP upstream (ou um cliente malicioso segurando um token destinado a um servidor) reenviando esse token contra outro servidor na mesma mesh de confiança.

Essa lição trata cada uma dessas lacunas como uma primitiva iii. O documento de metadados é um trigger HTTP que retorna a saída de uma função. Rotação de JWKS é um trigger de cron que chama `auth::rotate-jwks`, que escreve em `state::set("auth/jwks/<issuer>", ...)`. Validação de JWT é uma função que outros chamam via `iii.trigger("auth::validate-jwt", token)`. O próprio servidor MCP é só outro trigger HTTP que chama validação antes de despachar. Reinicie o engine: o registro de triggers reconstrói; estado sobrevive; superfície de auth está operacional sem reconciliação manual.

## O Conceito

### RFC 8414 — Metadados do Servidor de Autorização OAuth

Um documento em `/.well-known/oauth-authorization-server` descreve tudo que um cliente precisa:

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
  "registration_endpoint": "https://auth.example.com/register",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["mcp:tools.read", "mcp:tools.invoke"],
  "token_endpoint_auth_methods_supported": ["none", "private_key_jwt"]
}
```

Um cliente que recebe uma URL de recurso MCP encadeia descoberta: `oauth-protected-resource` da RFC 9728 (o documento do resource server) nomeia o issuer, depois `oauth-authorization-server` (esta RFC) nomeia cada endpoint. O cliente nunca codifica uma URL de autorização fixa.

O contrato que você verifica antes de confiar num IdP pra MCP:

- `code_challenge_methods_supported` inclui `S256` (PKCE por RFC 7636).
- `grant_types_supported` inclui `authorization_code` e rejeita `password` e `implicit`.
- `registration_endpoint` está presente (suporte RFC 7591).
- `response_types_supported` é exatamente `["code"]` pra OAuth 2.1.

Se qualquer um desses estiver faltando, o servidor MCP recusa implantação contra este IdP. O manifesto de implantação está errado, não o código.

### RFC 9728 (resumo) — Metadados de Recurso Protegido

A Lição 16 cobriu RFC 9728. O delta em produção: este documento é o único lugar onde um cliente procura os servidores de autorização confiáveis por *este* servidor MCP. Um único servidor MCP pode aceitar tokens de múltiplos IdPs (um pra funcionários, um pra parceiros). RFC 9728 declara esse conjunto; RFC 8414 documenta o que cada IdP suporta.

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com", "https://partners.example.com"],
  "scopes_supported": ["mcp:tools.invoke"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://notes.example.com/docs"
}
```

### RFC 7591 — Registro Dinâmico de Cliente

Sem DCR, cada cliente MCP (Cursor, Claude Desktop, um agente customizado) precisa de uma troca out-of-band com o admin do IdP. Com DCR, o cliente publica:

```json
POST /register
Content-Type: application/json

{
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "mcp:tools.invoke",
  "client_name": "Cursor",
  "software_id": "com.cursor.cursor",
  "software_version": "0.42.0"
}
```

O servidor responde com `client_id` e um `registration_access_token` pra atualizações futuras:

```json
{
  "client_id": "c_3e7f1a",
  "client_id_issued_at": 1769472000,
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "registration_access_token": "regt_b2...",
  "registration_client_uri": "https://auth.example.com/register/c_3e7f1a"
}
```

`token_endpoint_auth_method: none` é o padrão certo pra clientes MCP que rodam no dispositivo do usuário. Recebem só um `client_id` — sem `client_secret` pra exfiltrar. PKCE fornece a prova de posse que clientes públicos precisam.

Três armadilhas de produção:

- O endpoint de registro deve limitar taxa por IP de origem. Sem isso, um ator hostil scripta milhões de registros falsos e esgota o namespace de `client_id`. iii torna isso trivial: o trigger HTTP de registro chama uma função `auth::rate-limit` antes de despachar pro registrador.
- `software_statement` (um JWT assinado que atesta o cliente) é exigido por alguns IdPs enterprise. O mock da lição pula; em produção, conecta uma etapa de verificação que rejeita registros não assinados de qualquer coisa que não sejam URIs de redirecionamento localhost.
- O `registration_access_token` deve ser armazenado como hash, não texto plano. Roubo desse token significa que o ator malicioso pode reescrever as URIs de redirecionamento do cliente.

### RFC 8707 (resumo) — Indicadores de Recurso

A Lição 16 estabeleceu a forma. A regra de produção: cada requisição de token inclui `resource=<canonical-mcp-url>`, e o servidor MCP verifica que `token.aud` corresponde à sua própria URL de recurso em cada chamada. Se o servidor MCP é acessível em `https://notes.example.com/mcp`, a URL canônica é `https://notes.example.com` — o componente path é excluído pra que um único servidor hospede múltiplos paths sob uma única audience.

### RFC 7636 (resumo) — PKCE

PKCE é obrigatório em OAuth 2.1. O fluxo de código de autorização da lição sempre carrega `code_challenge` e `code_verifier`. O servidor rejeita qualquer requisição de token sem um verificador ou com um verificador que não faz hash pro challenge armazenado.

### Perfil de Auth da Eespecificaçãoificação MCP 2025-11-25

A eespecificaçãoificação MCP (2025-11-25) é precisa sobre o que a camada de autorização de um servidor MCP deve fazer:

- Publicar `/.well-known/oauth-protected-resource` (RFC 9728).
- Aceitar tokens apenas via `Authorization: Bearer ***`
- Validar `aud`, `iss`, `exp` e scopes necessários por requisição.
- Responder com `WWW-Authenticate` trazendo `Bearer error=...` pra cada 401 e 403, incluindo parâmetros `scope=` e `resource=` quando aplicável.
- Rejeitar tokens cujo `aud` não corresponde ao recurso canônico.
- Rejeitar tokens cujo `iss` não está na lista `authorization_servers` dos metadados de recurso protegido.

O draft OAuth 2.1 é a base; RFC 8414/7591/8707/9728 + RFC 7636 são a superfície; a eespecificaçãoificação MCP é o perfil.

### Matriz de capacidades de IdP

Nem todo IdP suporta o perfil completo de MCP. A matriz abaixo documenta declarações factuais de capacidade conforme a eespecificaçãoificação 2025-11-25. É um *gate de deploy*, não uma recomendação.

| Categoria de IdP | Metadados RFC 8414 | DCR RFC 7591 | Recurso RFC 8707 | PKCE S256 RFC 7636 | Notas |
|---|---|---|---|---|---|
| Self-hosted (Keycloak) | sim | sim | sim (desde 24.x) | sim | IdP de referência pra MCP; suporta cada RFC de ponta a ponta. |
| SSO Enterprise (Microsoft Entra ID) | sim | sim (tiers premium) | sim | sim | Disponibilidade de DCR varia por tenant; verifique antes de deployar. |
| SSO Enterprise (Okta) | sim | sim (Okta CIC / Auth0) | sim | sim | DCR disponível no Auth0 (agora Okta CIC); organizações clássicas do Okta requerem pré-registro de admin. |
| IdPs de login social (genérico) | varia | raramente | raramente | sim | Maioria dos IdPs sociais tratam clientes como parceiros estáticos; não dependa de DCR. Use só como fonte de identidade, coloque seu próprio servidor de autorização MCP-aware em cima. |
| Custom / caseiro | depende | depende | depende | depende | Se você constrói o seu, disponibilize o perfil completo. Pular qualquer um dos quatro RFCs acima quebra o contrato de auth do MCP. |

Regra de recusa pro manifesto de deploy: se o IdP escolhido não retorna `registration_endpoint` e não lista `S256` em `code_challenge_methods_supported`, o servidor MCP recusa iniciar. Não existe modo degradado.

### Padrão de rotação JWKS com iii

O modo de falha em produção é um cache JWKS desatualizado. Resolva com um trigger de cron e um cache `state::*`:

```python
iii.registerTrigger(
    "cron",
    {"schedule": "0 */6 * * *", "name": "auth::jwks-refresh"},
    "auth::rotate-jwks",
)
```

A cada seis horas, o trigger de cron chama `auth::rotate-jwks`, que busca `<issuer>/.well-known/jwks.json` e escreve em `state::set("auth/jwks/<issuer>", {keys, fetched_at})`. O validador lê de `state::get`. Um token cujo `kid` está faltando no cache dispara uma chamada síncrona `auth::rotate-jwks` como fallback. Isso lida com dois casos ao mesmo tempo: rotação agendada (cron) e janelas de sobreposição de chaves (fallback síncrono).

A forma do estado:

```json
{
  "auth/jwks/https://auth.example.com": {
    "keys": [
      {"kid": "k_2026_03", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"},
      {"kid": "k_2026_04", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"}
    ],
    "fetched_at": 1772668800
  }
}
```

Duas chaves ao mesmo tempo é o estado estável. Servidores de autorização rotacionam introduzindo a próxima chave (`k_2026_04`) antes de aposentar a anterior (`k_2026_03`), pra que tokens emitidos sob a chave antiga continuem válidos até expirarem. O cache mantém a união; o validador escolhe por `kid`.

### Conexão de primitivas iii (a parte que esta lição realmente aborda)

Cinco primitivas compõem a superfície de auth:

```python
# 1. RFC 8414 metadata document
iii.registerTrigger(
    "http",
    {"path": "/.well-known/oauth-authorization-server", "method": "GET"},
    "auth::serve-asm",
)

# 2. RFC 7591 dynamic client registration
iii.registerTrigger(
    "http",
    {"path": "/register", "method": "POST"},
    "auth::register-client",
)

# 3. JWT validation as a callable function (the resource server triggers it)
iii.registerFunction("auth::validate-jwt", validate_jwt_handler)

# 4. Step-up issuance for incremental scope (SEP-835 from L16)
iii.registerFunction("auth::issue-step-up", issue_step_up_handler)

# 5. Cron-driven JWKS rotation
iii.registerTrigger(
    "cron",
    {"schedule": "0 */6 * * *"},
    "auth::rotate-jwks",
)
iii.registerFunction("auth::rotate-jwks", rotate_jwks_handler)
```

O próprio servidor MCP nunca chama validação diretamente. Ele faz:

```python
result = iii.trigger("auth::validate-jwt", {"token": bearer_token, "resource": self.resource})
if not result["valid"]:
    return {"status": 401, "WWW-Authenticate": result["www_authenticate"]}
```

Essa indireção é a aposta do iii. Amanhã você troca o validador por um fanout que consulta dois IdPs em paralelo, ou adiciona um emissor de span, ou cacheia validações positivas. O servidor MCP não muda.

### Walkthrough de confused-deputy com vinculação de audience

Servidor A (`notes.example.com`) e Servidor B (`tasks.example.com`) ambos se registram contra o mesmo servidor de autorização. Servidor A é comprometido. O ator malicioso pega o token de notas de um usuário e reenvia contra Servidor B.

Validador do Servidor B:

1. Decodifica JWT, busca JWKS por `kid`, verifica assinatura.
2. Verifica `iss` contra os metadados `authorization_servers` do recurso protegido. (Passa — mesmo IdP.)
3. Verifica `aud == "https://tasks.example.com"`. (Falha — `aud` do token é `https://notes.example.com`.)
4. Retorna 401 com `WWW-Authenticate: Bearer error="invalid_token", error_description="audience mismatch"`.

A claim de audience é a única defesa contra esse ataque na camada de protocolo. Pulá-la por performance é o erro de produção mais comum; o validador deve rodar em cada requisição, não só no início da sessão.

### Modos de falha

- **JWKS desatualizado.** O validador rejeita tokens válidos após rotação de chaves. A correção é o padrão de cron+fallback acima. Nunca cacheie JWKS sem job de refresh.
- **Claim `aud` faltando.** Alguns IdPs omitem `aud` por padrão a menos que `resource` esteja presente na requisição de token. O validador deve rejeitar tokens com `aud` faltante, não tratar ausência como wildcard.
- **Race de upgrade de scope.** Dois fluxos de step-up concorrentes pro mesmo usuário podem ambos sucesso e produzir dois tokens de acesso com scopes diferentes. O validador deve usar o token apresentado na requisição, não buscar "o scope atual do usuário" — isso cria uma janela TOCTOU.
- **Roubo de token de registro.** Um `registration_access_token` vazado permite que o ator malicioso reescreva URIs de redirecionamento. Faça hash em repouso; exija que o cliente apresente o texto plano em cada atualização; rotacione em caso de suspeita.
- **`iss` não ancorado.** Um validador que aceita qualquer `iss` permite que um ator malicioso monte seu próprio servidor de autorização, registre um cliente pro audience alvo e emita tokens. A lista `authorization_servers` dos metadados de recurso protegido é a allow-list; imponha.

## Usar

`code/main.py` percorre o fluxo completo de produção com Python stdlib e um pequeno registro `iii_mock` que imita `iii.registerFunction`, `iii.registerTrigger`, `iii.trigger` e `state::set/get`. O fluxo:

1. Servidor de autorização publica metadados RFC 8414 em `/.well-known/oauth-authorization-server`.
2. Cliente MCP chama endpoint de metadados, descobre endpoint de registro.
3. Cliente MCP publica em `/register` (RFC 7591) e recebe `client_id`.
4. Cliente MCP roda fluxo de código de autorização com PKCE (RFC 7636) e indicador `resource` (RFC 8707).
5. Cliente MCP chama uma ferramenta no servidor MCP com `Authorization: Bearer ***`
6. Servidor MCP dispara `auth::validate-jwt`, que lê JWKS de `state::get`.
7. O trigger de cron dispara `auth::rotate-jwks`, substituindo o JWKS no estado.
8. A próxima chamada valida contra as novas chaves sem reinicialização.
9. Uma tentativa de confused-deputy contra outro recurso MCP recebe 401 com incompatibilidade de audience.

O JWT mock aqui usa HS256 com secret compartilhado (pra que a lição rode só com stdlib). Em produção, usa RS256 ou EdDSA com o padrão JWKS acima; a lógica de validação é caso contrário idêntica.

## Entregar

Essa lição produz `outputs/skill-mcp-auth-iii.md`. Dada uma config de servidor MCP e um conjunto de capacidades de IdP, a skill emite as primitivas iii pra registrar, o agenda de rotação de JWKS, o mapeamento de scope e as regras de recusa a aplicar quando o IdP não suporta o perfil completo de RFC.

## Exercícios

1. Rode `code/main.py`. Rastreie o fluxo de 9 passos. Observe onde `state::get` retorna dados desatualizados imediatamente antes de `auth::rotate-jwks` sobrescrevê-los, e como a próxima requisição agora valida contra a nova chave.

2. Adicione um novo IdP à lista `authorization_servers` dos metadados de recurso protegido. Emita um token assinado pelo novo IdP e confirme que o validador aceita. Emita um token assinado por um IdP não listado e confirme que o validador rejeita com `WWW-Authenticate: Bearer error="invalid_token", error_description="iss not allowed"`.

3. Implemente `auth::rate-limit` como uma função iii e chame-a de dentro do trigger HTTP de registro antes do registrar rodar. Use um token-bucket por IP de origem armazenado em `state::set("auth/ratelimit/<ip>", ...)`.

4. Leia a RFC 7591 e identifique dois campos que o handler `/register` da lição não valida. Adicione a validação. (Dica: `software_statement` e esquema de URI de `redirect_uris`.)

5. Leia a seção de autorização da eespecificaçãoificação MCP 2025-11-25. Encontre o único requisito normativo em headers `WWW-Authenticate` que o validador da lição atualmente não emite. Adicione-o.

## Termos Chave

| Termo | O que as pessoas dizem | O que significa de verdade |
|------|----------------|------------------------|
| ASM | "Documento de metadados OAuth" | JSON de RFC 8414 `/.well-known/oauth-authorization-server` |
| DCR | "Auto-cadastro de cliente" | Fluxo de RFC 7591 `POST /register` |
| JWKS | "Chaves públicas pra validação de JWT" | JSON Web Key Set, buscado de `jwks_uri`, indexado por `kid` |
| Indicador de recurso | "Parâmetro de audience" | Parâmetro RFC 8707 `resource` ancorando o token num servidor |
| Claim `aud` | "Audience" | Claim de JWT que o validador compara contra a URL do recurso canônico |
| Confused deputy | "Reenvio de token" | Ataque onde um token emitido pra Servidor A é apresentado a Servidor B |
| Allow-list de `iss` | "Servidores de autorização confiáveis" | O conjunto nomeado nos metadados de recurso protegido `authorization_servers` |
| Rotação de chaves | "Rolar JWKS" | Substituição periódica de chaves de assinatura com janelas de sobreposição |
| Cliente público | "Cliente nativo ou de navegador" | Cliente OAuth sem `client_secret`; PKCE compensa |
| `WWW-Authenticate` | "Header de resposta 401/403" | Carrega diretivas `Bearer error=...` que orientam recuperação do cliente |

## Leitura Complementar

- [MCP — Auth especificação (2025-11-25)](https://modelcontextprotocol.io/especificaçãoification/draft/basic/authorization) — o perfil de auth MCP que esta lição implementa
- [RFC 8414 — OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414) — contrato de descoberta
- [RFC 7591 — OAuth 2.0 Dynamic Client Registration Protocol](https://datatracker.ietf.org/doc/html/rfc7591) — DCR
- [RFC 7636 — Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636) — prova de posse de cliente público
- [RFC 8707 — Resource Indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707) — ancoramento de audience
- [RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728) — descoberta de resource server
- [OAuth 2.1 draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1) — base consolidada de OAuth
