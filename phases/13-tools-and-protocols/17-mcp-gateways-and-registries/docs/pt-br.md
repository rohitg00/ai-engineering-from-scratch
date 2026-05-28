# Gateways e Registries MCP — Planos de Controle Empresariais

> Empresas não podem deixar cada dev instalar servidores MCP aleatórios. Um gateway centraliza auth, RBAC, auditoria, rate limiting, cache e detecção de ferramenta poisoning, depois expõe a superfície de ferramentas mesclada como um único endpoint MCP. O Official MCP Registry (Anthropic + GitHub + PulseMCP + Microsoft, namespace-verificado) é o upstream canônico. Esta aula nomeia onde um gateway se encaixa, caminha por uma implementação mínima e faz um levantamento do panorama de vendors de 2026.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, gateway mínimo)
**Pré-requisitos:** Fase 13 · 15 (tool poisoning), Fase 13 · 16 (OAuth 2.1)
**Tempo:** ~45 minutos

## Objetivos de Aprendizado

- Explicar onde um gateway MCP se situa (entre clientes MCP e múltiplos servidores backend).
- Implementar as cinco responsabilidades do gateway: auth, RBAC, auditoria, rate limit, política.
- Aplicar um manifesto de hash de ferramentas fixadas na camada do gateway.
- Diferenciar o Official MCP Registry de metaregistries (Glama, MCPMarket, MCP.so, Smithery, LobeHub).

## O Problema

Uma Fortune 500 tem 30 servidores MCP aprovados, 5000 desenvolvedores, requisitos de conformidade e auditoria e uma equipe de segurança que quer política centralizada. Deixar cada desenvolvedor instalar servidores arbitrários em seus IDEs é fora de cogitação.

O padrão de gateway:

1. Gateway roda como um único endpoint Streamable HTTP que desenvolvedores conectam.
2. Gateway mantém credenciais pra cada servidor MCP backend.
3. Cada requisição do desenvolvedor é autenticada e delimitada via OAuth próprio do gateway.
4. Gateway rota a chamada pro servidor backend, aplicando política.
5. Todas chamadas logadas pra auditoria.

Cloudflare MCP Portals, Kong AI Gateway, IBM ContextForge, MintMCP, TrueFoundry, Envoy AI Gateway — todos lançaram gateways ou funcionalidades de gateway em 2025-2026.

Enquanto isso, o Official MCP Registry lançou como upstream canônico: curado, namespace-verificado, com nomes DNS reversa que o gateway pode puxar. Metaregistries (Glama, MCPMarket, MCP.so, Smithery, LobeHub) agregam servidores de múltiplas fontes.

## O Conceito

### Cinco responsabilidades do gateway

1. **Auth.** OAuth 2.1 pra identificar o desenvolvedor; mapeia pra papéis de usuário.
2. **RBAC.** Política por usuário: quais servidores, quais ferramentas, quais escopos.
3. **Auditoria.** Toda chamada logada com quem, o quê, quando, resultado.
4. **Rate limit.** Limites por usuário / ferramenta / servidor pra prevenir abuso.
5. **Política.** Rejeitar descrições envenenadas, aplicar Regra dos Dois, redact PII.

### Gateway como endpoint único

Pra desenvolvedores, o gateway parece um servidor MCP. Internamente rota pra N backends. Ids de sessão (Fase 13 · 09) são reescritos na borda.

### Armazenamento de credenciais

Desvelopolvedores nunca veem tokens de backend. Gateway os mantém (ou proxy pra um provedor de identidade que mantém). Um desenvolvedor com `notes:read` no gateway pode acessar transitiveamente o servidor de notas com as próprias credenciais de backend do gateway — mas só sob política que vincula o acesso transitivo.

### Fixação de hash de ferramenta no gateway

Gateway mantém um manifesto de descrições de ferramenta aprovadas (hashes SHA256). Na descoberta, ele busca `tools/list` de cada backend, compara hashes com o manifesto e remove qualquer ferramenta cuja descrição mutou. Essa é a defesa contra rug pull da Fase 13 · 15 aplicada centralmente.

### Política como código

Gateways avançados expressam política em OPA/Rego, Kyverno ou Styra. Regras como "usuário `alice` pode chamar `github.open_pr` só em repos da org `acme`" são codificadas declarativamente. Gateways simples usam Python codificado à mão. Ambas formas são válidas.

### Roteamento com consciência de sessão

Quando a sessão de um usuário inclui uma mistura de servidores, o gateway multiplexa: a sessão MCP única do desenvolvedor mantém N sessões de backend, uma por servidor. Notificações de qualquer backend roteiam pelo gateway pra sessão do desenvolvedor.

### Mesclagem de namespace

Gateways mesclam namespaces de ferramentas de todos backends, tipicamente com prefixo em caso de colisão. `github.open_pr`, `notes.search`. Isso torna o roteamento inequívoco.

### Registries

- **Official MCP Registry (`registry.modelcontextprotocol.io`).** Lançado sob stewardship da Anthropic, GitHub, PulseMCP, Microsoft. Namespace-verificado (DNS reversa: `io.github.user/server`). Pré-filtrado pra qualidade básica.
- **Glama.** Metaregistry centrada em busca agregando muitas fontes.
- **MCPMarket.** Diretório com viés comercial com listagens de vendors.
- **MCP.so.** Diretório comunitário; submissões abertas.
- **Smithery.** Fluxo de instalação estilo gerenciador de pacotes.
- **LobeHub.** Registry integrado à UI no app LobeChat.

Gateways empresariais puxam do Official Registry por padrão, permitem adições curadas por admin de metaregistries e rejeitam qualquer coisa não fixada.

### Nomenclatura DNS reversa

Official Registry exige nomes DNS reversa pra servidores públicos: `io.github.alice/notes`. Namespaces previnem squatting e tornam delegação de confiança mais clara.

### Levantamento de vendors, abril 2026

| Vendor | Ponto forte |
|--------|-------------|
| Cloudflare MCP Portals | Edge-hosted; OAuth integrado; tier grátis |
| Kong AI Gateway | K8s-nativo; política granular; logs pra OpenTelemetry |
| IBM ContextForge | IAM empresarial; conformidade; export de auditoria |
| TrueFoundry | Orientado a DevOps; métricas primeiro |
| MintMCP | Orientado a plataforma de desenvolvedor |
| Envoy AI Gateway | Código aberto; filtros customizáveis |

Fase 17 (infraestrutura de produção) aprofunda operações de gateway.

## Use

`code/main.py` entrega um gateway mínimo em ~150 linhas: autentica usuários por um Bearer token falso, mantém política RBAC por usuário, rota requests pra dois servidores MCP backend, escreve toda chamada em log de auditoria, aplica rate limit e rejeita qualquer ferramenta de backend cujo hash de descrição não bate com um manifesto fixado.

O que conferir:

- Dict `RBAC` indexado por `user_id` com entradas `server_tool` permitidas.
- `AUDIT_LOG` é uma lista append-only de eventos.
- Rate limit usa token bucket por usuário.
- Manifesto fixado é um dict de `server::tool -> hash`.

## Entregue

Esta aula produz `outputs/skill-gateway-bootstrap.md`. Dado um plano MCP empresarial (usuários, backends, conformidade), a skill produz uma eespecificaçãoificação de configuração do gateway.

## Exercícios

1. Rode `code/main.py`. Faça uma chamada como usuário permitido; depois como não permitido; depois uma rajada que excede rate limit. Verifique os três fluxos.

2. Adicione uma política que redact PII dos resultados antes de retornar pro cliente. Use um pass simples de regex pra strings no formato de SSN; note o gap (emails, telefones).

3. Estenda o log de auditoria pra emitir spans OpenTelemetry GenAI. Fase 13 · 20 cobre os atributos exatos.

4. Projete uma política RBAC pra uma equipe de 50 desenvolvedores com cinco backends (notes, github, postgres, jira, slack). Quem recebe somente leitura em cada? Quem recebe escrita?

5. Leia o post empresarial de MCP da Cloudflare de ponta a ponta. Identifique uma funcionalidade que a Cloudflare entrega e que este gateway stdlib não tem.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Gateway | "Proxy MCP" | Servidor centralizador entre clientes e backends |
| Armazenamento de credenciais | "Tokens de backend ficam no lado do servidor" | Desvelopolvedores nunca veem tokens upstream |
| Roteamento com consciência de sessão | "Sessão multi-backend" | Gateway multiplexa N sessões de backend por sessão de desenvolvedor |
| Fixação de hash de ferramenta | "Manifesto aprovado" | SHA256 de cada descrição de ferramenta aprovada; bloqueia rug pulls centralmente |
| RBAC | "Política por usuário" | Controle de acesso baseado em papéis pra ferramentas e servidores |
| Política como código | "Regras declarativas" | Políticas OPA/Rego, Kyverno, Styra aplicadas no gateway |
| Log de auditoria | "Quem, o quê, quando" | Log de eventos append-only pra conformidade |
| Rate limit | "Token bucket por usuário" | Limites por minuto pra prevenir abuso |
| Official MCP Registry | "Upstream canônico" | `registry.modelcontextprotocol.io`, namespace-verificado |
| Nomenclatura DNS reversa | "Namespace do registry" | Convenção `io.github.user/server` |

## Leituras Complementares

- [Official MCP Registry](https://registry.modelcontextprotocol.io/) — upstream canônico, namespace-verificado
- [Cloudflare — Enterprise MCP](https://blog.cloudflare.com/enterprise-mcp/) — padrão de gateway com OAuth e política
- [agentic-community — MCP gateway registry](https://github.com/agentic-community/mcp-gateway-registry) — gateway de referência de código aberto
- [TrueFoundry — What is an MCP gateway?](https://www.truefoundry.com/blog/what-is-mcp-gateway) — artigo de comparação de funcionalidades
- [IBM — MCP context forge](https://github.com/IBM/mcp-context-forge) — gateway empresarial da IBM
