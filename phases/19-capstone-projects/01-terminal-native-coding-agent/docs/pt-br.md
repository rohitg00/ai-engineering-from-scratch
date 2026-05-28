# Capstone 01 — Agent de Programação Nativo de Terminal

> Em 2026, a forma de um agente de programação já está definida. Uma TUI de suporte, um plano com estado, uma superfície de ferramentas em sandbox, um loop que planeja, executa, observa e recupera. Claude Code, Cursor 3 e OpenCode parecem todos iguais a 50 metros de distância. Este capstone te pede pra construir um de ponta a ponta — CLI de entrada, pull request de saída — e avaliar contra mini-swe-agent e Live-SWE-agent no SWE-bench Pro. Você vai descobrir que a parte difícil não é a chamada ao modelo, mas o loop de ferramentas, o sandbox e o custo máximo numa execução de 50 turnos.

**Tipo:** Capstone
**Linguagens:** TypeScript / Bun (suporte), Python (scripts de avaliação)
**Pré-requisitos:** Fase 11 (engenharia de LLM), Fase 13 (ferramentas e protocolos), Fase 14 (agents), Fase 15 (sistemas autônomos), Fase 17 (infraestrutura)
**Fases exercitadas:** P0 · P5 · P7 · P10 · P11 · P13 · P14 · P15 · P17 · P18
**Tempo:** 35 horas

## Problema

Agents de programação se tornaram a principal categoria de aplicação de IA em 2026. Claude Code (Anthropic), Cursor 3 com Composer 2 e Agent Tabs (Cursor), Amp (Sourcegraph), OpenCode (112k stars), Factory Droids e Google Jules — todos lançam variações da mesma arquitetura: um suporte de terminal, uma superfície de ferramentas com permissões, um sandbox e um loop planejar-executar-observar construído em torno de um modelo de fronteira. A fronteira é estreita — Live-SWE-agent atingiu 79.2% no SWE-bench Verified com Opus 4.5 — mas o ofício de engenharia é amplo. A maioria dos modos de falha não são erros do modelo. São instabilidade no loop de ferramentas, envenenamento de contexto, custo descontrolado de tokens e operações destrutivas no filesystem.

Você não consegue entender esses agentes de fora. Precisa construir um, ver o loop travar no turno 47 quando o ripgrep retorna 8MB de resultados e reconstruir a camada de truncamento. Esse é o ponto deste capstone.

## Conceito

O suporte tem quatro superfícies. **Plano** mantém um objeto de estado estilo TodoWrite que o modelo reescreve a cada turno. **Execução** despacha chamadas de ferramentas (ler, editar, rodar, buscar, git). **Observação** captura stdout / stderr / códigos de saída, trunca e alimenta o resumo de volta. **Recuperação** lida com erros de ferramentas sem estourar a janela de contexto ou entrar em loop infinito. A forma de 2026 adiciona mais uma coisa: **hooks**. `PreToolUse`, `PostToolUse`, `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `Notification`, `Stop` e `PreCompact` — pontos de extensão configuráveis onde o operador injeta política, telemetria e guardrails.

O sandbox é E2B ou Daytona. Cada tarefa roda em um devcontainer novo com um git worktree montado em leitura-escrita. O suporte nunca toca no filesystem do host. O worktree é derrubado em sucesso ou falha. O controle de custo é aplicado em três camadas: um limite de tokens por turno, um orçamento em dólares por sessão e um limite duro de turnos (tipicamente 50). A camada de observabilidade são spans de OpenTelemetry com convenções semânticas de GenAI, enviados para um Langfuse auto-hospedado.

## Arquitetura

```
  user CLI  ->  suporte (Bun + Ink TUI)
                  |
                  v
           loop plano / execução / observação  <--->  Claude Sonnet 4.7 / GPT-5.4-Codex / Gemini 3 Pro
                  |                          (via OpenRouter, independente do modelo)
                  v
           despacho de ferramentas (cliente MCP StreamableHTTP)
                  |
     +------------+------------+----------+
     v            v            v          v
  read/edit    ripgrep     tree-sitter   git/run
     |            |            |          |
     +------------+------------+----------+
                  |
                  v
           sandbox E2B / Daytona  (worktree isolado)
                  |
                  v
           hooks: Pre/Post, Session, Prompt, Compact
                  |
                  v
           OpenTelemetry -> Langfuse (spans, tokens, $)
                  |
                  v
           PR via GitHub app
```

## Stack

- Runtime do suporte: Bun 1.2 + Ink 5 (React no terminal)
- Acesso ao modelo: API unificada OpenRouter com Claude Sonnet 4.7, GPT-5.4-Codex, Gemini 3 Pro, Opus 4.5 (para tarefas mais difíceis)
- Transporte de ferramentas: Model Context Protocol StreamableHTTP (revisão MCP 2026)
- Sandbox: sandboxes E2B (SDK JS) ou devcontainers Daytona
- Busca de código: subprocesso ripgrep, parsers tree-sitter para 17 linguagens (pré-compilados)
- Isolamento: `git worktree add` por tarefa, limpeza em sucesso / falha
- Avaliação: SWE-bench Pro (subconjunto verificado) + Terminal-Bench 2.0 + seus próprios 30 issues de retenção
- Observabilidade: SDK OpenTelemetry com `gen_ai.*` semconv → Langfuse auto-hospedado
- Publicação de PR: GitHub App com token refinado, escopo limitado ao repo alvo

## Construa

1. **TUI e loop de comandos.** Crie um projeto Bun com Ink. Aceite `agent run <repo> "<tarefa>"`. Imprima uma visão dividida: painel de plano (topo), stream de chamadas de ferramentas (meio), orçamento de tokens (base). Adicione cancelamento com Ctrl-C que dispara o hook `SessionEnd` antes de sair.

2. **Estado do plano.** Defina um esquema tipado de TodoWrite (itens pendentes / em_progresso / concluídos com notas). O modelo reescreve o estado completo a cada turno como uma chamada de ferramenta — não deixe ele mutar incrementalmente. Persista o plano em `.agent/state.json` para que crashes possam ser retomados.

3. **Superfície de ferramentas.** Defina seis ferramentas: `read_file`, `edit_file` (com preview de diff), `ripgrep`, `tree_sitter_symbols`, `run_shell` (com timeout), `git` (status / diff / commit / push). Exponha via MCP StreamableHTTP para que o suporte seja independente do transporte. Cada ferramenta retorna saída truncada (limite de 4k tokens por chamada).

4. **Envoltória de sandbox.** Cada tarefa cria um sandbox E2B. `git worktree add -b agent/$TASK_ID` uma branch nova. Todas as chamadas de ferramentas executam dentro do sandbox. O filesystem do host é inacessível.

5. **Hooks.** Implemente todos os oito tipos de hook de 2026. Conecte pelo menos quatro hooks criados por você: (a) `PreToolUse` guard de comando destrutivo que bloqueia `rm -rf` fora do worktree, (b) `PostToolUse` contabilização de tokens, (c) `SessionStart` inicialização de orçamento, (d) `Stop` escreve um pacote final de trace.

6. **Loop de avaliação.** Clone um subconjunto de 30 issues do SWE-bench Pro Python. Execute seu suporte contra cada um. Compare com mini-swe-agent (baseline mínima) em pass@1, turnos-por-tarefa e $-por-tarefa. Escreva os resultados em `eval/results.jsonl`.

7. **Controle de custo.** Limites rígidos: 50 turnos, 200k de contexto, $5 por tarefa. O hook `PreCompact` resume turnos antigos em um bloco de estado anterior nos 150k, liberando espaço para novas observações sem perder o plano.

8. **Publicação de PR.** Em sucesso, o passo final é `git push` + uma chamada à API do GitHub que abre um PR com o plano e o resumo do diff no corpo.

## Use

```
$ agente run ./my-repo "Corrija a condição de corrida em worker.rs"
[plano]  1 localizar worker.rs e enumerar uso de mutex
         2 identificar estado compartilhado sob contenção
         3 propor correção, verificar testes
[ferram]  ripgrep mutex.*lock -t rust           (44 correspondências, truncado)
[ferram]  read_file src/worker.rs 120..180
[ferram]  edit_file src/worker.rs (+8 -3)
[ferram]  run_shell cargo test worker::          (passou)
[plano]  1 feito · 2 feito · 3 feito
[feito]  PR aberto: #482   turnos=9   tokens=38k   custo=$0.41
```

## Entregue

A skill entregável fica em `outputs/skill-terminal-coding-agent.md`. Dado um caminho de repo e uma descrição de tarefa, ela roda o loop completo planejar-executar-observar num sandbox e retorna uma URL de PR mais um pacote de trace. A rubrica deste capstone:

| Peso | Critério | Como é medido |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 vs baseline | Seu suporte vs mini-swe-agent em 30 tarefas Python equivalentes |
| 20 | Clareza da arquitetura | Separação plano/execução/observação, superfície de hooks, esquema de ferramentas — revisado contra o layout do Live-SWE-agent |
| 20 | Segurança | Testes de escape de sandbox, prompts de permissão, guard de comando destrutivo passa no red team |
| 20 | Observabilidade | Completude dos traces (100% das chamadas de ferramentas com span), contabilização de tokens por turno |
| 15 | UX para o desenvolvedor | Cold-start < 2s, recuperação de crash retoma o plano, Ctrl-C cancela no meio da ferramenta limpo |
| **100** | | |

## Exercícios

1. Troque o modelo subjacente de Claude Sonnet 4.7 para Qwen3-Coder-30B servido no vLLM. Compare pass@1 e $-por-tarefa. Relate onde o modelo aberto tem desempenho inferior.

2. Adicione um sub-agent `reviewer` que lê o diff antes de publicar o PR e pode solicitar um ciclo de revisão. Meça se avaliações falsas positivas reduzem o pass rate do SWE-bench abaixo da baseline single-agent (dica: geralmente sim).

3. Estresse o sandbox: escreva uma tarefa que tenta `curl` uma URL externa e uma tarefa que escreve fora do worktree. Confirme que ambas são bloqueadas pelo hook PreToolUse. Registre as tentativas.

4. Implemente sumarização `PreCompact` com um modelo menor (Haiku 4.5). Meça quanto da fidelidade do plano é perdida com compactação 3x.

5. Troque o transporte MCP StreamableHTTP por stdio. Teste o cold-start e a latência por chamada. Escolha o melhor para uso local.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|------------------------|------------------------|
| Harness | "O loop do agent" | O código ao redor do modelo que despacha ferramentas, mantém estado do plano e aplica orçamentos |
| Hook | "Listener de eventos do agent" | Um script criado pelo usuário executado em um dos oito eventos de ciclo de vida pelo suporte |
| Worktree | "Sandbox do git" | Um checkout do git vinculado a um caminho separado; descartável sem tocar no clone principal |
| TodoWrite | "Estado do plano" | Uma lista tipada de itens pendentes/em-progresso/concluídos que o modelo reescreve a cada turno |
| StreamableHTTP | "Transporte MCP" | Revisão MCP 2026: conexão HTTP de longa duração com streaming bidirecional; substitui SSE |
| Limite de tokens | "Orçamento de contexto" | Limite por turno ou por sessão de tokens de entrada+saída; dispara compactação ou terminação |
| pass@1 | "Taxa de passagem em tentativa única" | Fração de tarefas do SWE-bench resolvidas na primeira execução sem retry ou olhar pro conjunto de testes |

## Leitura Complementar

- [Documentação do Claude Code](https://docs.anthropic.com/en/docs/claude-code) — suporte de referência da Anthropic
- [Changelog do Cursor 3](https://cursor.com/changelog) — notas do produto Agent Tabs e Composer 2
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) — baseline mínima para comparação de suporte no SWE-bench
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) — 79.2% no SWE-bench Verified com Opus 4.5
- [OpenCode](https://opencode.ai) — suporte aberto, 112k stars
- [Ranking do SWE-bench Pro](https://www.swebench.com) — a avaliação que este capstone visa
- [Roadmap MCP 2026](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — StreamableHTTP, metadados de capacidades
- [Convenções semânticas GenAI do OpenTelemetry](https://opentelemetry.io/docs/especificaçãos/semconv/gen-ai/) — esquema de spans para chamadas de ferramentas e uso de tokens
