---
name: mcp-server-platform
description: Implante um servidor MCP de produção com StreamableHTTP, escopos OAuth 2.1, política OPA, portão de aprovação humana para ferramentas destrutivas e um registro para descoberta.
version: 1.0.0
phase: 19
lesson: 13
tags: [capstone, mcp, fastmcp, streamablehttp, oauth, opa, registry, governance]
---

Em um ambiente corporativo, forneça um servidor MCP com 10 ferramentas internas, um serviço de registro para descoberta e uma camada de governança que bloqueie ferramentas destrutivas por meio da aprovação do Slack.

Plano de construção:

1. Servidor FastMCP expondo 10 ferramentas somente leitura (Postgres, S3, Jira, Linear, Datadog, PagerDuty, GitHub, Notion, Slack, Salesforce), cada uma com esquema digitado e escopo necessário.
2. Transporte StreamableHTTP, sem estado atrás de um balanceador de carga.
3. Middleware de introspecção de token OAuth 2.1; identidade da carga de trabalho via SPIFFE/SPIRE.
4. Decisões políticas OPA/Rego em cada chamada de ferramenta: aplicação de escopo, redação de PII, limites de tamanho de carga útil.
5. Ferramentas destrutivas (criação Jira, criação Linear, gravação Postgres) em um servidor MCP separado, exigindo o escopo `approved:by:human` elevado via cartão Slack em 15 minutos.
6. Serviço de registro que pesquisa `.well-known/mcp-capabilities` de cada servidor, valida com esquema JSON e expõe uma interface de usuário de lista/pesquisa/validação/ativação.
7. Log de auditoria JSONL por locatário com redação de PII do Presidio antes da gravação.
8. Teste de carga de 100 clientes demonstrando escala horizontal; passar pelo conjunto de conformidade MCP.

Rubrica de avaliação:

| Peso | Critério | Medição |
|:-:|---|---|
| 25 | Conformidade com especificações | Manifesto de capacidade StreamableHTTP + passa nos testes de conformidade MCP |
| 20 | Segurança | Aplicação do escopo, cobertura OPA em todas as ferramentas, higiene secreta |
| 20 | Observabilidade | Registro de auditoria por chamada de ferramenta com redação de PII na gravação |
| 20 | Escala | Teste de carga de 100 clientes com demonstração em escala horizontal |
| 15 | Experiência do usuário do registro | Fluxo de trabalho de descoberta/validação/ativação-desativação exercido |

Rejeições difíceis:

- Servidores que exigem sessões com estado (viola o contrato sem estado do 2026 StreamableHTTP).
- Topologia de servidor único onde ferramentas destrutivas compartilham a mesma superfície de autenticação que somente leitura.
- Logs de auditoria que persistem PII brutos.
- Ignorar o manifesto de capacidade; a integração do registro é um requisito difícil.

Regras de recusa:

- Recuse-se a implantar sem OAuth; o acesso anônimo é desqualificante.
- Recuse-se a enviar ferramentas destrutivas sem o fluxo de aprovação do Slack.
- Recuse-se a expor uma ferramenta cujo escopo ou descrição não esteja no manifesto de capacidade.

Saída: um repositório contendo os dois servidores MCP (somente leitura + destrutivo), o serviço de registro, a integração de aprovação do Slack, as políticas OPA, o equipamento de teste de carga de 100 clientes, os resultados do teste de conformidade e um artigo descrevendo quais ferramentas você considerou expor, mas não o fez (e por que), além das três principais regras OPA que detectaram quase acidentes durante o teste.