---
name: oauth-scope-planner
description: Design the OAuth 2.1 scope set, pinning rules, and step-up policy for a remote MCP server.
version: 1.0.0
phase: 13
lesson: 16
tags: [oauth, pkce, resource-indicators, step-up, sep-835]
---
---
name: oauth-scope-planner
description: Design the OAuth 2.1 scope set, pinning rules, and step-up policy for a remote MCP server.
version: 1.0.0
phase: 13
lesson: 16
tags: [oauth, pkce, resource-indicators, step-up, sep-835]
---

Dado um servidor MCP remoto com uma lista de ferramentas, projete o modelo de autorização.

Produzir:

1. Hierarquia de escopo. Conjunto de escopo graduado (por exemplo, `read` -> `write` -> `delete` -> `admin`). Um escopo por classe de operação; não exploda o conjunto de osciloscópios.
2. Mapeamento do escopo para a ferramenta. Cada ferramenta anotada com seu escopo necessário. Sinalize qualquer ferramenta que precise de mais de um escopo.
3. Política de intensificação. Quais operações exigem intensificação em vez de um consentimento inicial. Típico: operações destrutivas exigem intensificação.
4. Valor do indicador de recursos. O URL canônico usado no parâmetro `resource`. Certifique-se de que o URL corresponda ao campo de recurso `.well-known/oauth-protected-resource`.
5. Metadados de recursos protegidos. Rascunho `.well-known/oauth-protected-resource` JSON com `authorization_servers`, `scopes_supported` e `resource`.

Rejeições difíceis:
- Qualquer ferramenta que exija escopo administrativo, mas seja invocada sem uma caixa de diálogo de confirmação explícita. Precisa de reforço.
- Qualquer escopo que cubra mais de uma classe de operação. Crescimento de privilégio.
- Qualquer servidor que ignore a validação do público. Vulnerabilidade de deputado confuso.

Regras de recusa:
- Se o servidor for local (stdio), recuse o OAuth e declare que o stdio herda a confiança dos pais.
- Se o servidor depender de um fluxo implícito do OAuth 2.0 legado, recuse e ordene a migração para 2.1 + PKCE.
- Se o usuário solicitar autenticação "somente chave de API" sem senha, recuse para servidores remotos; requer código de autorização OAuth 2.1 + PKCE com indicadores de recursos para acesso autorizado pelo usuário. As credenciais do cliente só são apropriadas para cenários máquina a máquina sem delegação de usuário.

Saída: um plano de autorização de uma página com hierarquia de escopo, mapeamento de escopo para ferramenta, política de avanço, indicador de recursos e JSON de metadados de recursos protegidos. Termine com a operação intensificada com maior probabilidade de surpreender os usuários no primeiro encontro.