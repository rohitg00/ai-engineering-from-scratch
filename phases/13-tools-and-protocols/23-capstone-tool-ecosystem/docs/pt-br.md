# Capstone — Construa um Ecossistema Completo de Ferramentas

> A Fase 13 ensinou cada peça. Esse capstone conecta todas num sistema com cara de produção: um servidor MCP com ferramentas + recursos + prompts + tasks + UI, OAuth 2.1 na borda, um gateway RBAC, um cliente multi-servidor, uma chamada de sub-agente A2A, rastreamento OTel pra um coletor, detecção de tool-poisoning em CI e um bundle AGENTS.md + SKILL.md. No fim você consegue defender cada escolha de arquitetura.

**Tipo:** Construir
**Linguagens:** Python (stdlib, harness de ponta a ponta de ecossistema)
**Pré-requisitos:** Fase 13 · 01 até 21
**Tempo:** ~120 minutos

## Objetivos de Aprendizado

- Componha um servidor MCP expondo ferramentas, recursos, prompts e uma task com um app `ui://`.
- Coloque o servidor atrás de um gateway OAuth 2.1 que impõe RBAC e hashes ancorados.
- Escreva um cliente multi-servidor que rastreia com atributos OTel GenAI de ponta a ponta.
- Delegue parte do workload pra um sub-agente A2A; verifique que a opacidade é preservada.
- Empacote a stack inteira com AGENTS.md + SKILL.md pra que outros agentes possam dirigir.

## O Problema

Disponibilize o sistema "pesquisa e relatório":

- Usuário pergunta: "summarize the three most-cited 2026 arXiv papers on agente protocols."
- Sistema: pesquise arXiv via MCP; delegue resumo de papers pra um agente escritor eespecificaçãoializado via A2A; agregue resultados; renderize um relatório interativo como recurso MCP Apps `ui://`; registre cada passo no OTel.

Todas as primitivas da Fase 13 aparecem. Isso não é um brinquedo — sistemas de assistente de pesquisa em produção lançados em 2026 pela Anthropic (o produto Claude Research), OpenAI (GPTs com Apps SDK) e terceiros têm exatamente essa forma.

## O Conceito

### Arquitetura

```
[user] -> [client] -> [gateway (OAuth 2.1 + RBAC)] -> [research MCP server]
                                                      |
                                                      +- MCP tool: arxiv_search (pure)
                                                      +- MCP resource: notes://recent
                                                      +- MCP prompt: /research_topic
                                                      +- MCP task: generate_report (long)
                                                      +- MCP Apps UI: ui://report/current
                                                      +- A2A call: writer-agent (tasks/send)
                                                      |
                                                      +- OTel GenAI spans
```

### Hierarquia de trace

```
agent.invoke_agent
 ├── llm.chat (kick off)
 ├── mcp.call -> tools/call arxiv_search
 ├── mcp.call -> resources/read notes://recent
 ├── mcp.call -> prompts/get research_topic
 ├── a2a.tasks/send -> writer-agent
 │    └── task transitions (opaque internals)
 ├── mcp.call -> tools/call generate_report (task-augmented)
 │    └── tasks/status polling
 │    └── tasks/result (completed, returns ui:// resource)
 └── llm.chat (final synthesis)
```

Um trace id. Cada span tem os atributos `gen_ai.*` corretos.

### Postura de segurança

- OAuth 2.1 + PKCE com indicador de recurso ancorando audience no gateway.
- Gateway segura credenciais upstream; usuário nunca as vê.
- RBAC: `alice` tem `research:read`, `research:write`, pode chamar todas as ferramentas. `bob` tem `research:read`, não pode chamar `generate_report`.
- Manifesto de descrição ancorado: descartou qualquer servidor cujos hashes de ferramenta mudaram.
- Auditoria Regra de Dois: nenhuma combina entrada não-confiável, dados sensíveis e ação consequencial.

### Renderização

A task final `generate_report` retorna blocos de conteúdo mais um recurso `ui://report/current`. O host do cliente (Claude Desktop, etc.) renderiza o dashboard interativo num iframe sandbox. O dashboard contém uma lista ordenada de papers, contagem de citações e um botão que chama `host.callTool('summarize_paper', {arxiv_id})` pra qualquer paper que o usuário clique.

### Empacotamento

Tudo é disponibilizado como:

```
research-system/
  AGENTS.md                     # project conventions
  skills/
    run-research/
      SKILL.md                  # the top-level workflow
  servers/
    research-mcp/               # the MCP server
      pyproject.toml
      src/
  agents/
    writer/                     # the A2A agent
  gateway/
    config.yaml                 # RBAC + pinned manifest
```

Usuários deployam com `docker compose up`. Usuários do Claude Code, Cursor, Codex e opencode podem dirigir o sistema invocando a skill `run-research`.

### O que cada lição da Fase 13 contribuiu

| Lição | O que o capstone usa |
|--------|------------------------|
| 01-05 | Interface de ferramenta, portabilidade de provider, chamadas paralelas, schemas, linting |
| 06-10 | Primitivas MCP, servidor, cliente, transportes, recursos + prompts |
| 11-14 | Sampling, roots + elicitation, tasks async, apps `ui://` |
| 15-17 | Tool poisoning, OAuth 2.1, gateway + registry |
| 18 | Delegação de sub-agente A2A |
| 19 | Rastreamento OTel GenAI |
| 20 | Gateway de roteamento pra camada LLM |
| 21 | Empacotamento SKILL.md + AGENTS.md |

## Usar

`code/main.py` costura os padrões das lições anteriores num demo rodável. Tudo stdlib, tudo em-processo pra que você leia de ponta a ponta. Rode o fluxo completo pro cenário de pesquisa-e-relatório: handshake com gateway, OAuth 2.1 simulado, tools/list mesclado, generate_report como task, chamada A2A pro writer, recurso ui:// retornado, spans OTel emitidos.

O que observar:

- Um trace id único em cada hop.
- Política do gateway bloqueia um segundo usuário de escrever.
- Ciclo de vida da task vai working → completed e retorna tanto texto quanto conteúdo ui://.
- Estado interno da chamada A2A é opaco pro orquestrador.
- AGENTS.md e SKILL.md são os únicos arquivos que outro agente precisa pra reproduzir o workflow.

## Entregar

Essa lição produz `outputs/skill-ecosystem-blueprint.md`. Dada uma necessidade de produto (pesquisa, resumo, automação), a skill produz a arquitetura completa: quais primitivas MCP, quais controles de gateway, quais chamadas A2A, quais telemetrias, qual empacotamento.

## Exercícios

1. Rode `code/main.py`. Observe o trace id único e como os spans se aninhão. Conte quantas primitivas da Fase 13 o demo toca.

2. Estenda o demo: adicione um segundo servidor MCP backend (ex: `bibliography`) e confirme que o gateway mescla suas ferramentas no mesmo namespace.

3. Substitua o agente A2A writer falso por um real rodando num subprocesso. Use o harness da Lição 19.

4. Adicione uma etapa de redação de PII no gateway de roteamento entre o orquestrador e o LLM. Confirme que emails na consulta do usuário são limpos.

5. Escreva um AGENTS.md pra um colega que manterá este sistema. Deve levar menos de cinco minutos pra ler e dar tudo que ele precisa pra dirigir o capstone no Cursor ou Codex.

## Termos Chave

| Termo | O que as pessoas dizem | O que significa de verdade |
|------|----------------|------------------------|
| Capstone | "Demo de integração da Fase 13" | Sistema de ponta a ponta usando cada primitiva |
| Pesquisa e relatório | "O cenário" | Padrão de pesquisar, resumir, renderizar |
| Ecossistema | "Todas as peças juntas" | Servidor + cliente + gateway + sub-agente + telemetria + pacote |
| Hierarquia de trace | "Trace id único" | Cada hop compartilha o trace; pai-filho via IDs de span |
| Token emitido pelo gateway | "Auth transitivo" | Cliente vê só token do gateway; gateway segura credenciais upstream |
| Namespace mesclado | "Todas as ferramentas numa lista plana" | Merge multi-servidor no gateway, prefixo em caso de colisão |
| Fronteira de opacidade | "Chamada A2A esconde internos" | Raciocínio do sub-agente invisível pro orquestrador |
| Stack de três camadas | "AGENTS.md + SKILL.md + MCP" | Contexto do projeto + workflow + ferramentas |
| Defesa em profundidade | "Múltiplas camadas de segurança" | Hashes ancorados, OAuth, RBAC, Regra de Dois, log de auditoria |
| Matriz de conformidade com especificação | "O que disponibilizamos que a eespecificaçãoificação exige" | Checklist mapeando entregáveis pra requisitos 2025-11-25 |

## Leitura Complementar

- [MCP — Specification 2025-11-25](https://modelcontextprotocol.io/especificaçãoification/2025-11-25) — referência consolidada
- [MCP blog — 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — pra onde o protocolo vai
- [a2a-protocol.org](https://a2a-protocol.org/latest/) — referência A2A v1.0
- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/especificaçãos/semconv/gen-ai/) — convenções canônicas de rastreamento
- [Anthropic — Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) — padrões de runtime de agente em produção
