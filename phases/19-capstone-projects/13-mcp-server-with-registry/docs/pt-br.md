# Capstone 13 — Servidor MCP com Registro e Governança

> Model Context Protocol parou de ser o futuro e se tornou a eespecificaçãoificação padrão de uso de ferramentas em 2026. Anthropic, OpenAI, Google e todo IDE importante lançam clientes MCP. Pinterest publicou seu ecossistema interno de servidores MCP. AAIF Registry formalizou metadados de capacidade em `.well-known`. AWS ECS publicou a referência de implantação stateless. goose-agent da Block colocou o mesmo protocolo dentro de um assistente hospedado. A forma de produção de 2026 é: transporte StreamableHTTP, escopos OAuth 2.1, controle de política OPA e um registro que permite times de plataforma descobrir, validar e habilitar servidores. Construa isso de ponta a ponta.

**Tipo:** Capstone
**Linguagens:** Python (servidor, via FastMCP) ou TypeScript (@modelcontextprotocol/sdk), Go (serviço de registro)
**Pré-requisitos:** Fase 11 (engenharia de LLM), Fase 13 (ferramentas e MCP), Fase 14 (agents), Fase 17 (infraestrutura), Fase 18 (segurança)
**Fases exercitadas:** P11 · P13 · P14 · P17 · P18
**Tempo:** 25 horas

## Problema

MCP se tornou a língua franca de uso de ferramentas. Claude Code, Cursor 3, Amp, OpenCode, Gemini CLI e todo agente gerenciado agora consomem servidores MCP. Os desafios de produção não são criar servidores (FastMCP torna isso fácil) mas implantá-los em escala com requisitos empresariais: escopos OAuth por inquilino, política OPA em ferramentas destrutivas, escalabilidade stateless do StreamableHTTP, um registro para descoberta, logs de auditoria por chamada de ferramenta. O ecossistema MCP interno da Pinterest e a eespecificaçãoificação AAIF Registry definiram a barra de 2026.

Você vai construir um servidor MCP expondo 10 ferramentas internas (Postgres somente-leitura, listagem S3, Jira, Linear, Datadog, etc.), uma UI de registro para descoberta de plataforma e um portão de aprovação humana para ferramentas destrutivas. O teste de carga demonstra escalabilidade horizontal do StreamableHTTP. A trilha de auditoria satisfaz uma revisão de segurança empresarial.

## Conceito

Revisão MCP 2026 mandate StreamableHTTP como transporte padrão. Diferente da forma anterior de stdio-e-SSE, StreamableHTTP é stateless por padrão: um único endpoint HTTP aceita requisições JSON-RPC, faz streaming de respostas e suporta conexões de longa duração para notificações. Stateless significa escalável horizontalmente atrás de um balanceador de carga.

Autorização é OAuth 2.1 com escopos por ferramenta. Um token carrega escopos como `jira:read`, `s3:list`, `postgres:consulta:readonly`. O servidor MCP verifica escopos no momento da chamada de ferramenta, não apenas no início da sessão. Para ferramentas de alto risco, o servidor rejeita qualquer chamada cujo escopo não foi elevado para `approved:by:human` nos últimos N minutos — essa elevação vem de um card de revisão no Slack.

O registro é um serviço separado. Cada servidor MCP expõe um documento `.well-known/mcp-capabilities` com seu manifesto de ferramentas, URL de transporte, requisitos de autenticação. O registro faz polling, valida e indexa. Times de plataforma usam a UI do registro para ver quais ferramentas estão disponíveis, quais escopos precisam e quais times as detêm.

## Arquitetura

```
cliente MCP (Claude Code, Cursor 3, ...)
          |
          v
StreamableHTTP via HTTPS (JSON-RPC + streaming)
          |
          v
servidor MCP (FastMCP) atrás de balanceador de carga
          |
   +------+------+---------+----------+------------+
   v             v         v          v            v
Postgres    listagem S3  Jira       Linear     Datadog
(somente-   (paginado)  (leitura)  (leitura)  (consulta)
leitura)          |
   +------+-------------+
   v                    v
gate de política OPA   ferramenta destrutiva MCP (servidor separado)
                        |
                        v
                   aprovação humana via Slack
                        |
                        v
                   log de auditoria (append-only, por inquilino)

  serviço de registro
     |
     v  GET /.well-known/mcp-capabilities de cada servidor
     v
     UI: busca / validar / habilitar-desabilitar / propriedade
```

## Stack

- Framework de servidor: FastMCP (Python) ou `@modelcontextprotocol/sdk` (TypeScript)
- Transporte: StreamableHTTP via HTTPS (stateless)
- Autenticação: OAuth 2.1 com identidade de workload via SPIFFE / SPIRE
- Política: regras OPA / Rego por ferramenta; serviço de decisão de política por requisição
- Registro: auto-hospedado, consome manifestos `.well-known/mcp-capabilities`
- Aprovação humana: mensagem Slack interativa para ferramentas destrutivas
- Deploy: AWS ECS Fargate ou Fly.io, um servidor por inquilino ou compartilhado com escopo de inquilino
- Auditoria: JSONL append-only por balde de inquilino com linhagem por chamada

## Construa

1. **Superfície de ferramentas.** Exponha 10 ferramentas internas: consulta Postgres somente-leitura, listagem de objetos S3, busca/busca Jira, busca/busca Linear, consulta de métricas Datadog, consulta de plantão PagerDuty, GitHub somente-leitura, busca Notion, busca Slack, leitura Salesforce. Cada ferramenta tem um esquema tipado e uma etiqueta de escopo.

2. **Servidor FastMCP.** Monte as ferramentas. Configure o transporte StreamableHTTP. Adicione um middleware para introespecificaçãoção de token OAuth e aplicação de escopos.

3. **Política OPA.** Política Rego por ferramenta: quais escopos permitem invocação, qual redação de PII se aplica, quais limites de tamanho de payload se aplicam. Serviço de decisão chamado em cada chamada de ferramenta.

4. **Serviço de registro.** Serviço Go ou TS separado que faz polling de `.well-known/mcp-capabilities` dos servidores registrados, valida com JSON Schema e expõe uma UI de listar / buscar / validar / habilitar-desabilitar.

5. **Manifesto de capacidade.** Cada servidor expõe `.well-known/mcp-capabilities` com: lista de ferramentas, requisitos de autenticação, URL de transporte, time proprietário, SLO.

6. **Separação de ferramentas destrutivas.** Ferramentas que mutam estado (criação Jira, criação Linear, escrita Postgres) ficam num segundo servidor MCP com fluxo de autenticação mais restrito: tokens devem ter um escopo `approved:by:human` elevado via card Slack em 15 minutos.

7. **Log de auditoria.** JSONL append-only por inquilino: `{timestamp, user, tool, args_redacted, response_redacted, outcome}`. Redação de PII via Presidio antes da escrita.

8. **Teste de carga.** 100 clientes concorrentes em StreamableHTTP. Demonstre escalabilidade horizontal adicionando uma segunda réplica; mostre o balanceador de carga redistribuindo sem pegajosidade de sessão.

9. **Testes de conformidade.** Rode a suíte oficial de conformidade MCP contra ambos os servidores. Passe todas as seções obrigatórias.

## Use

```
$ curl -H "Authorization: Bearer *** \
       -X POST https://mcp.internal.example.com/ \
       -d '{"jsonrpc":"2.0","method":"tools/call",
            "params":{"name":"postgres.readonly","arguments":{"sql":"SELECT 1"}}}'
[registro]  capacidade validada: postgres.readonly v1.2
[policy]    escopo postgres:consulta:readonly presente; permitido
[auditoria] registrado: user=u42 tool=postgres.readonly outcome=ok
resposta:   { "result": { "rows": [[1]] } }
```

## Entregue

`outputs/skill-mcp-server.md` descreve a entrega. Um servidor MCP de grau de produção + registro + camada de auditoria para ferramentas internas com escopos OAuth 2.1 e controle OPA.

| Peso | Critério | Como é medido |
|:-:|---|---|
| 25 | Conformidade com eespecificaçãoificação | StreamableHTTP + manifesto de capacidade passa nos testes de conformidade MCP |
| 20 | Segurança | Aplicação de escopos, cobertura OPA em cada ferramenta, higiene de segredos |
| 20 | Observabilidade | Log de auditoria por chamada de ferramenta com redação de PII |
| 20 | Escala | Demonstração de escala horizontal com teste de carga de 100 clientes |
| 15 | UX do registro | Fluxo descobrir / validar / habilitar-desabilitar |
| **100** | | |

## Exercícios

1. Adicione uma nova ferramenta (busca Confluence). Lance pelo fluxo de validação do registro sem tocar no servidor principal.

2. Escreva uma política OPA que redija resultados de consulta Postgres contendo colunas chamadas `email`, `ssn` ou `phone`. Exercite com uma consulta de probe.

3. Teste StreamableHTTP vs stdio em latência local. Relate p50/p95 por chamada.

4. Implemente cota por inquilino: máximo N chamadas por minuto por ferramenta por inquilino. Aplique via uma segunda regra OPA.

5. Rode a suíte de conformidade MCP de [mcp-conformance-tests](https://github.com/modelcontextprotocol/conformance) e conserte cada falha.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|------------------------|------------------------|
| StreamableHTTP | "Transporte MCP 2026" | HTTP stateless + streaming; substitui SSE + stdio para servidores em rede |
| Manifesto de capacidade | "Documento well-known" | `.well-known/mcp-capabilities` com lista de ferramentas, autenticação, URL de transporte |
| OPA / Rego | "Motor de política" | Open Policy Agent para autorizar chamadas de ferramentas contra regras externas |
| Elevação de escopo | "Aprovado-por-humano" | Escopo de curta duração concedido via aprovação Slack, necessário para ferramentas destrutivas |
| Registro | "Descoberta de ferramentas" | Serviço que indexa servidores MCP a partir de seus manifestos de capacidade |
| Identidade de workload | "SPIFFE / SPIRE" | Identidade de serviço criptográfica para emissão de token OAuth |
| Suíte de conformidade | "Testes de eespecificaçãoificação" | Bateria oficial de testes MCP para StreamableHTTP + correção do manifesto de ferramentas |

## Leitura Complementar

- [Roadmap MCP 2026](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — StreamableHTTP, metadados de capacidade, registro
- [Eespecificaçãoificação AAIF MCP Registry](https://github.com/modelcontextprotocol/registry) — a eespecificaçãoificação de registro de 2026
- [Referência de implantação AWS ECS](https://aws.amazon.com/blogs/containers/deploying-model-context-protocol-mcp-servers-on-amazon-ecs/) — referência de implantação de produção
- [Ecossistema MCP interno Pinterest](https://www.infoq.com/news/2026/04/pinterest-mcp-ecosystem/) — referência de implantação interno
- [Uso MCP `goose` da Block](https://block.github.io/goose/) — referência de padrão de consumo por agent
- [FastMCP](https://github.com/jlowin/fastmcp) — framework Python server
- [Open Policy Agent](https://www.openpolicyagent.org/) — referência do motor de política
- [SPIFFE / SPIRE](https://spiffe.io) — referência de identidade de workload
