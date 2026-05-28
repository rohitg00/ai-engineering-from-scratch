# Segurança MCP II — OAuth 2.1, Resource Indicators, Escopos Incrementais

> Servidores MCP remotos precisam de autorização, não só autenticação. A eespecificaçãoificação 2025-11-25 se alinha com OAuth 2.1 + PKCE + resource indicators (RFC 8707) + metadados de protected-resource (RFC 9728). SEP-835 adiciona consentimento incremental de escopo com step-up de autorização em 403 WWW-Authenticate. Esta aula implementa o fluxo de step-up como máquina de estados pra que você veja cada salto.

**Tipo:** Construir
**Linguagens:** Python (stdlib, simulador de máquina de estados OAuth)
**Pré-requisitos:** Fase 13 · 09 (transportes), Fase 13 · 15 (segurança I)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Distinguir responsabilidades do servidor de recursos do servidor de autorização.
- Caminhar pelo fluxo de código de autorização OAuth 2.1 protegido por PKCE.
- Usar `resource` (RFC 8707) e metadados de protected-resource (RFC 9728) pra prevenir ataques de confused deputy.
- Implementar autorização de step-up: servidor responde 403 com WWW-Authenticate pedindo um escopo maior; cliente solicita consentimento do usuário de novo e tenta novamente.

## O Problema

MCP inicial (pré-2025) lançou servidores remotos com chaves de API ad-hoc ou sem auth. A eespecificaçãoificação 2025-11-25 fecha esse gap com um perfil completo de OAuth 2.1.

Três necessidades do mundo real:

- **Servidores remotos comuns.** Usuário instala um servidor MCP remoto que acessa seu Notion / GitHub / Gmail. OAuth 2.1 com PKCE é a forma certa.
- **Escalonamento de escopo.** Um servidor de notas com `notes:read` pode precisar de `notes:write` pra uma ação eespecificaçãoífica. Em vez de refazer todo o fluxo, step-up (SEP-835) solicita o escopo adicional.
- **Prevenção de confused deputy.** Cliente mantém um token com audiência no Servidor A. Servidor A é malicioso e tenta apresentar o token pro Servidor B. Resource indicators (RFC 8707) fixam o token à sua audiência pretendida.

OAuth 2.1 não é novo. O que é novo é o perfil do MCP: fluxos eespecificaçãoíficos obrigatórios (só código de autorização + PKCE; sem implícito, sem client credentials por padrão), resource indicators obrigatórios em cada request de token e metadados de protected-resource publicados pra que clientes saibam onde ir.

## O Conceito

### Papéis

- **Cliente.** O cliente MCP (Claude Desktop, Cursor, etc.).
- **Servidor de recursos.** O servidor MCP (notas, GitHub, Postgres, o que for).
- **Servidor de autorização.** Emite tokens. Pode ser o mesmo serviço que o servidor de recursos ou um IdP separado (Auth0, Keycloak, Cognito).

No perfil do MCP, servidores de recursos e autorização PODEM ser o mesmo host mas DEVEM ser distinguidos por URLs.

### Código de autorização + PKCE

O fluxo:

1. Cliente gera `code_verifier` (aleatório) e `code_challenge` (SHA256).
2. Cliente redireciona o usuário pra `/authorize?response_type=code&client_id=...&redirect_uri=...&scope=notes:read&code_challenge=...&resource=https://notes.example.com`.
3. Usuário consente. Servidor de autorização redireciona pra `redirect_uri?code=...`.
4. Cliente POSTa em `/token?grant_type=authorization_code&code=...&code_verifier=...&resource=...`.
5. Servidor de autorização valida o hash do verifier contra o challenge armazenado e emite um access token.
6. Cliente usa o token: `Authorization: Bearer ***` em todo request pro servidor de recursos.

PKCE previne ataques de interceptação de código de autorização. Resource indicators impedem que o token seja válido em outro lugar.

### Metadados de protected-resource (RFC 9728)

O servidor de recursos publica um documento `.well-known/oauth-protected-resource`:

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["notes:read", "notes:write", "notes:delete"]
}
```

Cliente descobre o servidor de autorização a partir do servidor de recursos. Reduz configuração — o cliente só precisa da URL do resource.

### Resource indicators (RFC 8707)

Parâmetro `resource` no request de token fixa a audiência pretendida do token. O token emitido contém `aud: "https://notes.example.com"`. Outro servidor MCP recebendo este token verifica `aud` e rejeita.

### Modelo de escopo

Escopos são strings separadas por espaço. Convenções MCP comuns:

- `notes:read`, `notes:write`, `notes:delete`
- `admin:*` pra capacidades de admin (use com moderação)
- `profile:read` pra identidade

Seleção de escopo deve ser least-privilege: solicite o que precisa agora, escale quando precisar de mais.

### Autorização de step-up (SEP-835)

Usuário concede `notes:read`. Depois pede ao agente pra deletar uma nota. Servidor responde:

```
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer error="insufficient_scope",
    scope="notes:delete", resource="https://notes.example.com"
```

Cliente vê o erro insufficient_scope, mostra ao usuário um diálogo de consentimento pra o escopo adicional, faz um mini fluxo OAuth pra ele, e tenta o request de novo com o novo token.

### Validação de audiência do token

Todo request: servidor verifica `token.aud == self.resource_url`. Desacordo = 401. Isso impede reuso cross-server de tokens.

### Tokens de curta duração e rotação

Access tokens DEVEM ser de curta duração (1 hora padrão). Refresh tokens rotacionam a cada refresh. Cliente lida com refresh silencioso no background.

### Sem passagem de token

Servidores de sampling (Fase 13 · 11) NÃO DEVEM passar o token do cliente pra outros serviços. O request de sampling é o limite.

### Prevenção de confused deputy

Token se liga a `aud`. Cliente se liga a `client_id`. Todo request validado contra ambos. A eespecificaçãoificação proíbe explicitamente o antigo padrão de "passar token" que era comum em ecossistemas de ferramentas remotas pré-MCP.

### Descoberta de Client ID

Cada cliente MCP publica seus metadados numa URL fixa. Servidores de autorização podem buscar o documento de metadados do cliente pra descobrir URIs de redirect e informações de contato. Isso remove o registro manual de cliente.

### Gateways e OAuth

Fase 13 · 17 mostra como um gateway empresarial lida com OAuth: gateway mantém credenciais pra servidores upstream, tokens pro cliente são emitidos pelo gateway, e tokens upstream nunca saem do gateway. Isso inverte o modelo de confiança — usuários autenticam com o gateway uma vez; gateway lida com N autorizações de servidor.

## Use

`code/main.py` simula o fluxo completo de step-up OAuth 2.1 como máquina de estados. Ele implementa:

- Geração de PKCE code-verifier / challenge.
- Fluxo de código de autorização com resource indicator.
- Endpoint de metadados de protected-resource.
- Validação de token com verificação de audiência.
- Step-up em `insufficient_scope`.

Sem servidor HTTP nesta aula; a máquina de estados roda em memória pra que você trace cada salto. A aula 17 do gateway conecta isso a um transporte real.

## Entregue

Esta aula produz `outputs/skill-oauth-scope-planner.md`. Dado um servidor MCP remoto com ferramentas, a skill projeta o conjunto de escopo, regras de fixação e política de step-up.

## Exercícios

1. Rode `code/main.py`. Trace o fluxo de step-up de dois escopos. Anote quais saltos repetem no step-up.

2. Adicione rotação de refresh token: cada refresh emite um novo refresh token e invalida o antigo. Simule um refresh token roubado sendo usado após rotação e confirme que falha.

3. Implemente o endpoint de metadados de protected-resource como uma resposta HTTP real usando stdlib http.server. Espelhe o endpoint /mcp da Aula 09.

4. Projete uma hierarquia de escopos pra um servidor MCP de GitHub: ler repo, escrever PR, aprovar PR, merge PR, admin. Use step-up entre cada nível.

5. Leia RFC 8707 e RFC 9728. Identifique o único campo na 9728 que o MCP usa diferente do exemplo da RFC. (Dica: diz respeito a `scopes_supported`.)

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| OAuth 2.1 | "OAuth moderno" | RFC consolidada que obriga PKCE e proíbe fluxo implícito |
| PKCE | "Prova de posse" | Code verifier + challenge derrotando interceptação de código de autorização |
| Resource indicator | "Audiência do token" | Parâmetro `resource` da RFC 8707 fixando token a um servidor |
| Metadados de protected-resource | "Documento de descoberta" | `.well-known/oauth-protected-resource` da RFC 9728 |
| Autorização de step-up | "Consentimento incremental" | Fluxo SEP-835 pra adicionar escopos sob demanda |
| `insufficient_scope` | "403 com WWW-Authenticate" | Sinal do servidor pra re-consentir pra escopo maior |
| Confused deputy | "Reuso de token entre serviços" | Ataque onde um titular confiável encaminha token indevidamente |
| Token de curta duração | "TTL do access token" | Bearer que expira rápido; refresh token renova |
| Hierarquia de escopos | "Stack de least privilege" | Conjunto de escopos graduados com step-up entre níveis |
| Metadados de Client ID | "Documento de descoberta do cliente" | URL onde o cliente publica seus próprios metadados OAuth |

## Leituras Complementares

- [MCP — Authorization especificação](https://modelcontextprotocol.io/especificaçãoification/draft/basic/authorization) — perfil OAuth canônico do MCP
- [den.dev — MCP November authorization especificação](https://den.dev/blog/mcp-november-authorization-especificação/) — walkthrough das mudanças 2025-11-25
- [RFC 8707 — Resource indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707) — a RFC de fixação de audiência
- [RFC 9728 — OAuth 2.0 protected resource metadata](https://datatracker.ietf.org/doc/html/rfc9728) — a RFC de documento de descoberta
- [Aembit — MCP OAuth 2.1, PKCE and the future of AI authorization](https://aembit.io/blog/mcp-oauth-2-1-pkce-and-the-future-of-ai-authorization/) — walkthrough prático de step-up
