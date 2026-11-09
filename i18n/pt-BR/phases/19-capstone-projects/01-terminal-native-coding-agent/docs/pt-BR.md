# Capstone 01  Agente de codificação nativo de terminal

> Em 2026, a forma de um agente de codificação está definida. Um arame TUI, um plano com estado, uma superfície de ferramentas em caixa de areia, um ciclo que planeja, age, observa, recupera. Claude Code, Cursor 3 e OpenCode são todos iguais a partir de 50 pés. Esta pedra final pede-lhe para construir um extremo para o outro  CLI, puxar o pedido  e medir contra mini-swe-agente e Live-SWE-agente em SWE-bench Pro. Você aprenderá por que a parte difícil não é a chamada de modelo, mas o ciclo de ferramentas, a caixa de areia e o teto de custo em uma corrida de 50 voltas.

**Type:** Capstone
**Languages:** TypeScript / Bun (harness, loop scaffold), Python (eval scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and protocols), Phase 14 (agents), Phase 15 (autonomous systems), Phase 17 (infrastructure)
**Phases exercised:**P0 · P5 · P7 · P10 · P11 · P13 · P14 · P15 · P17 · P18
**Time:** 35 hours

## Problemas

Os agentes de codificação tornaram-se a categoria de aplicação de IA dominante em 2026. Claude Code (Antropic), Cursor 3 com Composer 2 e Agent Tabs (Cursor), Amp (Sourcegraph), OpenCode (112k estrelas), Factory Droids e Google Jules todas as variações de nave da mesma arquitetura: um arame terminal, uma superfície de ferramentas autorizada, uma caixa de areia e um ciclo de observação de planos-atos construído em torno de um modelo de fronteira. A fronteira é estreita  Agente SWE-Live alcançou 79,2% no banco SWE Verificado com Opus 4.5  mas a nave de engenharia é ampla. A maioria dos modos de falha não são erros de modelo. São instabilidade no loop de ferramentas, envenenamento de contexto, custo de token fugitivo e operações destrutivas do sistema de arquivos.

Não se pode pensar sobre estes agentes de fora, é preciso construir um, ver o ciclo cair na curva 47 quando o ripgrep devolver 8 MB de fósforos e reconstruir a camada de truncamento.

## Conceptos

O arame tem quatro superfícies.**Plan**mantém um objeto de estado de estilo TodoWrite que o modelo reescreve em cada virada. **Act**Dispeça chamadas de ferramentas (leia, edita, executa, busca, git). **Observe**captura os códigos de saída / stderr / stdout, truncates e reintegra o resumo. **Recover**O formato 2026 adiciona mais uma coisa: **hooks**- Não .`PreToolUse`- Não .`PostToolUse`- Não .`SessionStart`- Não .`SessionEnd`- Não .`UserPromptSubmit`- Não .`Notification`- Não .`Stop`, e `PreCompact` pontos de extensão configuráveis em que o operador injeta políticas, telemetria e barris de segurança.

A caixa de areia é E2B ou Daytona. Cada tarefa é executada em um devcontainer novo com um git worktree montado leitura-escrita. O arnes nunca toca o sistema de arquivos do host. A árvore de trabalho é rasgada por sucesso ou fracasso. O controle de custos é aplicado em três camadas: um teto de token por turno, um orçamento de dólares por sessão e um limite de turno duro (normalmente 50). A camada de observabilidade é OpenTelemetry com convenções semânticas da GenAI, enviada para um Langfuse auto-hosted.

## Arquitetura

```
  user CLI  ->  harness (Bun + Ink TUI)
                  |
                  v
           plan / act / observe loop  <--->  Claude Sonnet 4.7 / GPT-5.4-Codex / Gemini 3 Pro
                  |                          (via OpenRouter, model-agnostic)
                  v
           tool dispatcher (MCP StreamableHTTP client)
                  |
     +------------+------------+----------+
     v            v            v          v
  read/edit    ripgrep     tree-sitter   git/run
     |            |            |          |
     +------------+------------+----------+
                  |
                  v
           E2B / Daytona sandbox  (worktree isolated)
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

## Estaca

- Tempo de execução do arame: Bun 1.2 + Ink 5 (Reacção no terminal)
- Modelo de acesso: OpenRouter API unificada com Claude Sonnet 4.7, GPT-5.4-Codex, Gemini 3 Pro, Opus 4.5 (para tarefas mais difíceis)
- Transporte de ferramentas: Modelo de protocolo contextual StreamableHTTP (revisao do MCP 2026)
- Sandbox: Sandbox E2B (JS SDK) ou contêineres de desenvolvimento Daytona
- Pesquisa de código: subprocesso ripgrep, parseres de guarda-árvore para 17 idiomas (pre-compilado)
- Isolamento: `git worktree add`por tarefa, limpeza sobre sucesso / fracasso
- Arneses Eval: SWE-bench Pro (subconjunto verificado) + Terminal-Bench 2.0 + seu próprio retalho de 30 tarefas
- Observabilidade: OpenTelemetry SDK com `gen_ai.*`semconv → auto-hosted Langfuse
- Publicado em Relações Públicas: Aplicativo GitHub com token de grãos finos, alcance limitado ao repo alvo

```figure
ce-agent-loop
```

## Construí-lo

1. **TUI and command loop.**Echa um projeto Bun com tinta.`agent run <repo> "<task>"`Imprimir uma visão dividida: painel de plano (acima), fluxo de chamadas de ferramentas (médio), orçamento de token (abaixo). Adicionar cancelar no Ctrl-C que dispara `SessionEnd`- Aqueça antes da saída.

2. **Plan state.**Defina um esquema TodoWrite digitado (em espera / in_progress / itens feitos com notas). O modelo reescreve o estado completo a cada turno como uma chamada de ferramenta  não deixe que mude incrementalmente.`.agent/state.json`Para que os acidentes possam retomar.

3. **Tool surface.**Define seis ferramentas: `read_file`- Não .`edit_file`(com uma visão de antecedência diferente),`ripgrep`- Não .`tree_sitter_symbols`- Não .`run_shell`(com prazo de ausência), `git`(status / diff / commit / push). Expor em MCP StreamableHTTP para que o arnes seja transportagnóstico. Cada ferramenta retorna a saída truncada (cap a 4k tokens por chamada).

4. **Sandbox wrapping.**Cada tarefa gera uma caixa de areia E2B. `git worktree add -b agent/$TASK_ID`Todos os chamados de ferramentas são executados dentro da caixa de areia.

5. **Hooks.**Implementar os oito tipos de ganchos de 2026:`PreToolUse`Guarda de comando destrutivo que bloqueia`rm -rf`fora da árvore de trabalho, b) `PostToolUse`Contabilidade simbólica, c) `SessionStart`Inicialização orçamental, d) `Stop`escreve um último pacote de vestígios.

6. **Eval loop.**Clone um subconjunto de 30 edições do SWE-bench Pro Python. Exerça seu arnes contra cada um. Compare com mini-swe-agent (a linha de base mínima) em pass@1, viradas por tarefa e $-per-tarefa. Escreva os resultados para `eval/results.jsonl`- Não .

7. **Cost control.**Cutoffs difíceis: 50 voltas, 200 mil contextos, 5 dólares por tarefa.`PreCompact`Hook resume as mudanças mais antigas em um bloco de estado anterior na marca de 150k, liberando espaço para novas observações sem perder o plano.

8. **PR posting.**Para o sucesso, o passo final é`git push`+ uma chamada de API do GitHub que abre uma relação de relações públicas com o plano e o resumo diferencial no corpo.

## Usá-lo

```
$ agent run ./my-repo "Fix the race condition in worker.rs"
[plan]  1 locate worker.rs and enumerate mutex uses
        2 identify shared state under contention
        3 propose fix, verify tests
[tool]  ripgrep mutex.*lock -t rust           (44 matches, truncated)
[tool]  read_file src/worker.rs 120..180
[tool]  edit_file src/worker.rs (+8 -3)
[tool]  run_shell cargo test worker::          (passed)
[plan]  1 done · 2 done · 3 done
[done]  PR opened: #482   turns=9   tokens=38k   cost=$0.41
```

## Envia-o

A habilidade de entrega vive em`outputs/skill-terminal-coding-agent.md`. Dada uma via repo e uma descrição de tarefa, ele executa o ciclo completo de planejamento-ato-observação em uma caixa de areia e retorna uma URL de PR mais um pacote de rastreamento.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 vs baseline | Your harness vs mini-swe-agent on 30 matched Python tasks |
| 20 | Architecture clarity | Plan/act/observe separation, hook surface, tool schema — reviewed against Live-SWE-agent layout |
| 20 | Safety | Sandbox escape tests, permission prompts, destructive-command guard passes red-team |
| 20 | Observability | Trace completeness (100% of tool calls spanned), token accounting per turn |
| 15 | Developer UX | Cold-start < 2s, crash recovery resumes plan, Ctrl-C cancels mid-tool cleanly |
| **100** | | |

## Exercícios

1. Troque o modelo de suporte de Claude Sonnet 4.7 para Qwen3-Coder-30B servido no vLLM. Compare pass@1 e $-per-task. Relate onde o modelo aberto tem um desempenho inferior.

2. Adicionar um`reviewer`Sub-agente que lê o diferencial antes de publicar o PR e pode solicitar um ciclo de revisão. Medir se as revisões falsamente positivas caem na taxa de aprovação do banco de SWE abaixo da linha de base de um único agente (indicação: geralmente sim).

3. Teste de estresse na caixa de areia: escreva uma tarefa que tente`curl`uma URL externa e uma tarefa que escreve fora da árvore de trabalho. Confirme que ambos são bloqueados pelo gancho PreToolUse. Registre as tentativas.

4. Implementação `PreCompact`Resumo com um modelo menor (Haiku 4.5).

5. Troque o transporte MCP StreamableHTTP para estúdio. Marque a latência de arranque a frio e por chamada. Escolha um vencedor para uso local.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Harness | "The agent loop" | The code surrounding the model that dispatches tools, maintains plan state, and enforces budgets |
| Hook | "Agent event listener" | A user-authored script run on one of eight lifecycle events by the harness |
| Worktree | "Git sandbox" | A linked git checkout at a separate path; disposable without touching the main clone |
| TodoWrite | "Plan state" | A typed list of pending/in-progress/done items the model rewrites each turn |
| StreamableHTTP | "MCP transport" | 2026 MCP revision: long-lived HTTP connection with bidirectional streaming; replaces SSE |
| Token ceiling | "Context budget" | Per-turn or per-session cap on input+output tokens; triggers compaction or termination |
| pass@1 | "Single-attempt pass rate" | Fraction of SWE-bench tasks solved on the first run without retry or test-set peeking |

## Mais leitura

- [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) Arnes de referência da Anthropic
- [Cursor 3 changelog](https://cursor.com/changelog) Agentes Tabs e notas de produto Composer 2
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) Linha de base mínima para comparação entre o arame de banco SWE
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) 79,2% de banco SWE Verificado com Opus 4.5
- [OpenCode](https://opencode.ai)Arnes aberto, 112 mil estrelas.
- [SWE-bench Pro leaderboard](https://www.swebench.com) a avaliação dos objectivos desta pedra angular
- [Model Context Protocol 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) StreamableHTTP, metadados de capacidade
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) Esquema de tempo para chamadas de ferramentas e uso de tokens
