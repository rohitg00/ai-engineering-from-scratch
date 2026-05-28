# Capstone 10 — Time de Engenharia de Software Multi-Agent

> Arquitetura factory do SWE-AF, prompting baseado em papéis do MetaGPT, grafo de atores tipado do AutoGen 0.4, Devin da Cognition e Droids da Factory — todos convergiram na mesma forma de 2026: um arquiteto planeja, N programadores trabalham em paralelo em worktrees, um revisor controla, um testador verifica. Worktrees paralelos convertem tempo de parede em throughput. Estado compartilhado e protocolos de handoff se tornam a superfície de falha. O capstone é construir o time, avaliar no SWE-bench Pro e relatar quais handoffs quebram e com que frequência.

**Tipo:** Capstone
**Linguagens:** Python / TypeScript (agents), Shell (scripts de worktree)
**Pré-requisitos:** Fase 11 (engenharia de LLM), Fase 13 (ferramentas), Fase 14 (agents), Fase 15 (autônomo), Fase 16 (multi-agent), Fase 17 (infraestrutura)
**Fases exercitadas:** P11 · P13 · P14 · P15 · P16 · P17
**Tempo:** 40 horas

## Problema

Agents single-agent de programação batem um teto em tarefas grandes. Não porque qualquer agente individual seja fraco, mas porque um contexto de 200k tokens não comporta um plano de arquitetura mais quatro fatias paralelas de codebase mais comentários do revisor mais saída de testes. Factories multi-agent dividem o problema: um arquiteto detém o plano, programadores detêm implementação em worktrees paralelos, um revisor controla, um testador verifica. A "factory" do SWE-AF, os papéis do MetaGPT, o grafo de atores tipado do AutoGen — as três formulações descrevem a mesma forma.

A superfície de falha é o handoff. Arquiteto planeja algo que os programadores não conseguem implementar. Programadores produzem diffs conflitantes. Revisor aprova uma correção alucinada. Testador corre contra um programador que ainda está escrevendo. Você vai construir um desses times, rodar em 50 issues do SWE-bench Pro, rastrear cada handoff e publicar o post-mortem.

## Conceito

Papéis são agentes tipados. **Arquiteto** (Claude Opus 4.7) lê a issue, escreve um plano e o divide em subtarefas com interfaces explícitas. **Programadores** (Claude Sonnet 4.7, N instâncias paralelas, cada um em um `git worktree` + sandbox Daytona) implementam subtarefas independentemente. **Revisor** (GPT-5.4) lê o diff mesclado e aprova ou solicita alterações eespecificaçãoíficas. **Testador** (Gemini 2.5 Pro) roda a suíte de testes isoladamente e reporta pass/falha com artefatos.

Comunicação é via um quadro de tarefas compartilhado (arquivo ou Redis). Cada papel consome tarefas que tem permissão para lidar. Handoffs são mensagens tipadas do protocolo A2A. Preocupações de coordenação: resolução de conflitos de merge (papel de coordenador ou merge três-vias automático), sincronização de estado compartilhado (o plano é congelado quando os programadores começam; replanejamentos são eventos separados) e controle de aprovação do revisor (o revisor não pode aprovar suas próprias mudanças ou mudanças que propôs).

Amplificação de tokens é o custo oculto. Cada fronteira de papel adiciona prompts de resumo e contexto de handoff. Uma execução single-agent de 40 turnos se torna 160 turnos totais entre quatro papéis. A rubrica pondera eespecificaçãoificamente eficiência de tokens vs baseline single-agent porque a questão não é "multi-agent funciona" mas "vale a pena por dólar."

## Arquitetura

```
URL de issue do GitHub
      |
      v
Arquiteto (Opus 4.7)
   lê issue, produz plano com subtarefas + interfaces
      |
      v
Quadro de tarefas (arquivo / Redis)
      |
   +-- subtarefa 1 ---+-- subtarefa 2 ---+-- subtarefa 3 ---+-- subtarefa 4 ---+
   v                  v                  v                  v                  v
Programador A      Programador B      Programador C      Programador D      (4 paralelos)
 (Sonnet)           (Sonnet)           (Sonnet)           (Sonnet)
 worktree A         worktree B         worktree C         worktree D
 Daytona            Daytona            Daytona            Daytona
      |                  |                  |                  |
      +--------+---------+---------+--------+
               v
           coordenador de merge  (merge três-vias + resolução de conflitos)
               |
               v
           Revisor (GPT-5.4)
               |
               v
           Testador  (Gemini 2.5 Pro)  -> passa? -> abrir PR
                                        -> falha? -> rotear de volta ao programador
```

## Stack

- Orquestração: LangGraph com estado compartilhado + sub-grafos por agent
- Mensagens: protocolo A2A (Google 2025) para mensagens tipadas entre agents
- Modelos: Opus 4.7 (arquiteto), Sonnet 4.7 (programadores), GPT-5.4 (revisor), Gemini 2.5 Pro (testador)
- Isolamento por worktree: `git worktree add` por programador + sandbox Daytona
- Coordenador de merge: merge três-vias customizado + resolução de conflitos mediada por LLM
- Avaliação: SWE-bench Pro (50 issues), cenários SWE-AF, HumanEval++ para testes unitários
- Observabilidade: Langfuse com spans etiquetados por papel, contabilização de tokens por agent
- Deploy: K8s com cada papel como um Deployment separado + HPA no backlog

## Construa

1. **Quadro de tarefas.** JSONL com arquivo de suporte e mensagens tipadas: `plan_request`, `subtask`, `diff_ready`, `review_needed`, `test_needed`, `approved`, `rejected`, `replan_needed`. Agents se inscrevem nas tags.

2. **Arquiteto.** Lê a issue do GitHub, roda Opus 4.7 com um template de plano que exige interfaces explícitas de subtarefa (arquivos tocados, funções públicas, impacto em testes). Emite um `plan_request` com um DAG de subtarefas.

3. **Programadores.** N workers paralelos, cada um reivindicar uma subtarefa do quadro. Cada um cria uma nova branch `git worktree add` mais um sandbox Daytona. Implementa a subtarefa. Emite `diff_ready` com o patch + deltas de teste.

4. **Coordenador de merge.** Quando todos-programadores-terminaram, faz merge três-vias das N branches numa branch de staging. Resolução de conflitos mediada por LLM apenas quando existe sobreposição em nível de arquivo.

5. **Revisor.** GPT-5.4 lê o diff mesclado. Não pode aprovar diffs que ele mesmo escreveu. Emite `approved` (no-op) ou `review_feedback` com pedidos de alteração eespecificaçãoíficos roteados de volta ao programador relevante.

6. **Testador.** Gemini 2.5 Pro roda a suíte de testes num sandbox limpo. Captura artefatos. Emite `test_passed` ou `test_failed` com stacktraces. Testes que falharam retornam ao programador que detém a subtarefa falhada.

7. **Contabilização de handoffs.** Cada mensagem que cruza uma fronteira de papel ganha um span no Langfuse com tamanho do payload e modelo usado. Compute amplificação de tokens por subtarefa (tokens_programador + tokens_revisor + tokens_testador + cota_arquiteto / tokens_programador).

8. **Avaliação.** Rode em 50 issues do SWE-bench Pro. Compare pass@1 e $-por-issue-resolvida contra uma baseline single-agent (um Sonnet 4.7 num único worktree).

9. **Post-mortem.** Para cada issue falhada, identifique o handoff que quebrou (plano vago demais, conflito de merge, falso-aprovação do revisor, flake do testador). Produza um histograma de falhas-de-handoff.

## Use

```
$ team run --issue https://github.com/acme/widget/issues/842
[arquiteto] plano: 4 subtarefas (parser, cache, api, migration)
[quadro]    despachado para 4 programadores em worktrees paralelos
[prog-A]    subtarefa parser  -> 42 linhas, testes passam localmente
[prog-B]    subtarefa cache   -> 88 linhas, testes passam localmente
[prog-C]    subtarefa api     -> 31 linhas, testes passam localmente
[prog-D]    subtarefa migration -> 19 linhas, testes passam localmente
[merge]     merge três-vias: 0 conflitos
[revisor]   comenta no cache (dimensionamento de pool de threads); roteado ao prog-B
[prog-B]    revisão: 92 linhas; submete
[revisor]   aprovado
[testador]  todos os 412 testes passam
[pr]        aberto #3382   4 programadores, 1 revisão, $4.90, 18m
```

## Entregue

`outputs/skill-multi-agent-team.md` é a entrega. Dada uma URL de issue e nível de paralelismo, o time produz um PR pronto para merge com contabilização de tokens por papel.

| Peso | Critério | Como é medido |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | Subconjunto equivalente de 50 issues, pass@1 |
| 20 | Aceleração paralela | Tempo de parede vs baseline single-agent |
| 20 | Qualidade da revisão | Taxa de falso-aprovação em probe de bugs injetados |
| 20 | Eficiência de tokens | Total de tokens por issue resolvida vs single-agent |
| 15 | Engenharia de coordenação | Resolução de conflitos de merge, histograma de falhas-de-handoff |
| **100** | | |

## Exercícios

1. Injete um bug óbvio no meio de um diff durante a execução (`return None` extra antes do corpo principal). Meça a taxa de falso-aprovação do revisor. Calibre o prompt do revisor até falso-aprovação ficar abaixo de 5%.

2. Reduza para dois programadores (arquiteto + programador + revisor + testador, programador roda duas subtarefas sequencialmente). Compare tempo de parede e taxa de pass.

3. Substitua o coordenador de merge por uma restrição de escritor único (subtarefas tocadas por conjuntos disjuntos de arquivos). Meça a carga de planejamento no arquiteto.

4. Troque o revisor de GPT-5.4 para Claude Opus 4.7. Meça a taxa de falso-aprovação e o delta de custo de tokens.

5. Adicione um quinto papel: documentador (Haiku 4.5). Após a revisão, ele produz uma entrada de changelog. Meça se a qualidade da documentação justifica o gasto extra de tokens.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|------------------------|------------------------|
| Worktree paralelo | "Branch isolada" | `git worktree add` produzindo uma árvore de trabalho nova por programador |
| Quadro de tarefas | "Barramento de mensagens compartilhado" | Loja de arquivo ou Redis de mensagens tipadas que os agentes se inscrevem |
| Handoff | "Fronteira de papel" | Qualquer mensagem que cruza do contexto de um papel para o de outro |
| Amplificação de tokens | "Overhead multi-agent" | Total de tokens entre papéis / tokens single-agent para a mesma tarefa |
| Protocolo A2A | "Agent-to-agent" | Eespecificaçãoificação de 2025 do Google para mensagens tipadas entre agentes |
| Coordenador de merge | "Integrador" | Componente que roda merge três-vias e media conflitos |
| Falso-aprovação | "Alucinação do revisor" | Revisor aprova um diff com bugs conhecidos |

## Leitura Complementar

- [Arquitetura factory SWE-AF](https://github.com/Agent-Field/SWE-AF) — a factory multi-agent de referência de 2026
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT) — framework multi-agent baseado em papéis
- [AutoGen v0.4](https://github.com/microsoft/autogen) — framework de atores tipado da Microsoft
- [Cognition AI (Devin)](https://cognition.ai) — produto de referência
- [Factory Droids](https://www.factory.ai) — produto de referência alternativo
- [Protocolo A2A do Google](https://developers.google.com/agent-to-agent) — eespecificaçãoificação de mensagens entre agents
- [Documentação git worktree](https://git-scm.com/docs/git-worktree) — o substrato de isolamento
- [SWE-bench Pro](https://www.swebench.com) — o alvo de avaliação
