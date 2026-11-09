# Capstone 10  Equipa de engenharia de software multi-agente

> A forma de 2026 de uma equipe de engenharia multi-agente convergiu: um arquiteto planeja, N codificadores trabalham em árvores de trabalho paralelas, um revisor de portas, um testador verifica. A arquitetura de fábrica da SWE-AF, a solicitação baseada em papéis do MetaGPT, o gráfico de atores tipado do AutoGen 0.4, o Devin da Cognition e os droides da fábrica todos aterraram sobre ele de forma independente. Os árvores de trabalho paralelas convertem o relógio de parede em capacidade. Os protocolos de estado e transferência compartilhados tornam-se a superfície de falha. A pedra angular é construir a equipa, avaliar no banco de SWE Pro, e relatar quais entregas quebrarem e com que frequência.

**Type:** Capstone
**Languages:** Python / TypeScript (agents, task board scaffold), Shell (worktree scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 17 (infrastructure)
**Phases exercised:**P11 · P13 · P14 · P15 · P16 · P17
**Time:** 40 hours

## Problemas

Os arneses de codificação de agente único atingiram um teto em tarefas grandes. Não porque qualquer agente individual seja fraco, mas porque um contexto de 200k-token não pode conter um plano de arquitetura mais quatro fatias paralelas de base de código mais comentários do revisor mais saída de teste. As fábricas de vários agentes dividem o problema: um arquiteto possui o plano, os programadores possuem a implementação em árvores de trabalho paralelas, um revisor verifica os portões, um testador verifica. A arquitetura "fabricante" da SWE-AF, os papéis do MetaGPT, o gráfico de atores tipado da AutoGen  todas as três molduras descrevem a mesma forma.

A superfície de falha é a transferência. Arquiteto planeja algo que os programadores não podem implementar. Os programadores produzem diferenças conflitantes. O revisor aprova uma correção alucinante. O testeiro corre um programador de escrita fixa. Você vai construir uma dessas equipes, executá-lo em 50 edições Pro do banco SWE, rastrear cada transferência e publicar o pós-mortem.

## Conceptos

Os papéis são agentes de tipografia.**Architect**(Claude Opus 4.7) lê o número, escreve um plano e divide-o em subtarefas com interfaces explícitas. **Coders**(Claude Sonnet 4.7, N instâncias paralelas, cada uma em um `git worktree`+ Daytona sandbox) implementar subtarefas de forma independente. **Reviewer**(GPT-5.4) lê a diferença combinada e aprova ou solicita alterações específicas. **Tester**(Gemini 2.5 Pro) executa a suite de teste isolada e relata falhas/passagens com artefatos.

A comunicação é feita através de um painel de tarefas compartilhado (contigo de arquivos ou Redis). Cada papel consome tarefas que lhe é permitido realizar. As transferências são mensagens tipo protocolo A2A. Concorrências de coordenação: resolução de conflitos de fusão (função de coordenador ou fusão automática em três direções), sincronização de estado compartilhado (o plano é congelado quando os programadores começam; os replãs são eventos separados) e vigilância de revisores (o revisor não pode aprovar as suas próprias alterações ou alterações propostas).

A amplificação de tokens é o custo oculto. Cada limite de papel adiciona instruções de resumo e contexto de entrega. Uma rodada de 40 voltas de um único agente se torna 160 voltas totais em quatro roles. A rubrica pesa especificamente a eficiência do token versus a linha de base de um único agente porque a questão não é "faz multi-agente trabalho" mas "faz ganhar por dólar".

## Arquitetura

```
GitHub issue URL
      |
      v
Architect (Opus 4.7)
   reads issue, produces plan with subtasks + interfaces
      |
      v
Task board (file / Redis)
      |
   +-- subtask 1 ---+-- subtask 2 ---+-- subtask 3 ---+-- subtask 4 ---+
   v                v                v                v                v
Coder A          Coder B          Coder C          Coder D          (4 parallel)
 (Sonnet)         (Sonnet)         (Sonnet)         (Sonnet)
 worktree A       worktree B       worktree C       worktree D
 Daytona          Daytona          Daytona          Daytona
      |                |                |                |
      +--------+-------+-------+--------+
               v
           merge coordinator  (three-way merge + conflict resolution)
               |
               v
           Reviewer (GPT-5.4)
               |
               v
           Tester  (Gemini 2.5 Pro)  -> passes? -> open PR
                                     -> fails?  -> route back to coder
```

## Estaca

- Orquestração: LangGraph com estado compartilhado + subgrafos por agente
- Mensagens: Protocolo A2A (Google 2025) para mensagens entre agentes digitadas
- Modelos: Opus 4.7 (arquiteto), Sonnet 4.7 (códeros), GPT-5.4 (revisor), Gemini 2.5 Pro (tester)
- Isolamento de árvores de trabalho: `git worktree add`por codificador + caixa de areia Daytona
- Coordenador de fusão: fusão trilateral personalizada + resolução de conflitos mediada pela MLL
- Eval: SWE-bench Pro (50 edições), cenários SWE-AF, HumanEval++ para testes unitários
- Observabilidade: Langfuse com intervalos de roteiros, contabilidade de tokens por agente
- Deploição: K8s com cada função como uma implantação separada + HPA em backlog

```figure
ce-team-handoff
```

## Construí-lo

1. **Task board.**JSONL com arquivo respaldado com mensagens digitalizadas: `plan_request`- Não .`subtask`- Não .`diff_ready`- Não .`review_needed`- Não .`test_needed`- Não .`approved`- Não .`rejected`- Não .`replan_needed`Os agentes assinam as etiquetas.

2. **Architect.**Leia a questão do GitHub, executa Opus 4.7 com um modelo de plano que requer interfaces de subtarefa explícitas (arquivos tocados, funções públicas, impacto de teste).`plan_request`com um dia de subtarefas.

3. **Coders.**N trabalhadores paralelos, cada um reivindica uma subtarefa da tabela.`git worktree add`A partir de agora, o sistema de controle de dados é um sistema de controle de dados.`diff_ready`com o parche + delta de ensaio.

4. **Merge coordinator.**Em todos os codificadores, o tricampo funde os ramos N em um ramo em fase.

5. **Reviewer.**O GPT-5.4 lê a diferença combinada. Não pode aprovar as diferenças que a autorização emite.`approved`(não-op) ou `review_feedback`com pedidos específicos de alteração encaminhados de volta para o codificador relevante.

6. **Tester.**O Gemini 2.5 Pro faz o teste numa caixa de areia limpa, capta artefatos, emite.`test_passed`ou `test_failed`Os testes falhados voltam ao programador que possui a subtarefa falhada.

7. **Handoff accounting.**Cada mensagem que atravessa um limite de papel recebe um espaço em Langfuse com o tamanho da carga útil e o modelo usado.

8. **Eval.**Execute em 50 números SWE-bench Pro. Compare pass@1 e $- por problema resolvido com uma linha de base de um único agente (um Sonnet 4.7 em uma única árvore de trabalho).

9. **Post-mortem.**Para cada problema falhado, identifique a transferência que foi quebrada (plano muito vago, conflito de fusão, falha de aprovação do revisor, flake do testeiro).

## Usá-lo

```
$ team run --issue https://github.com/acme/widget/issues/842
[architect] plan: 4 subtasks (parser, cache, api, migration)
[board]     dispatched to 4 coders in parallel worktrees
[coder-A]   subtask parser  -> 42 lines, tests pass locally
[coder-B]   subtask cache   -> 88 lines, tests pass locally
[coder-C]   subtask api     -> 31 lines, tests pass locally
[coder-D]   subtask migration -> 19 lines, tests pass locally
[merge]     3-way merge: 0 conflicts
[reviewer]  comments on cache (thread pool sizing); routed to coder-B
[coder-B]   revision: 92 lines; submits
[reviewer]  approved
[tester]    all 412 tests pass
[pr]        opened #3382   4 coders, 1 revision, $4.90, 18m
```

## Envia-o

`outputs/skill-multi-agent-team.md`Dada uma URL de questão e nível de paralelismo, a equipe produz um PR pronto para fusão com contabilidade de tokens por papel.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | Matched 50-issue subset, pass@1 |
| 20 | Parallel speedup | Wall-clock vs single-agent baseline |
| 20 | Review quality | False-approval rate on injected-bug probe |
| 20 | Token efficiency | Total tokens per solved issue vs single-agent |
| 15 | Coordination engineering | Merge-conflict resolution, handoff-failure histogram |
| **100** | | |

## Exercícios

1. Injectar um bug óbvio em um diferencial de meia execução (extra `return None`A taxa de aprovação falsa do revisor é medida.

2. Reduzir para dois programadores (arquiteto + dois programadores + revisor + testador, cada programador executa duas subtarefas sequencialmente). Compare o relógio de parede e a taxa de passagem.

3. Substitua o coordenador de fusão por uma restrição de um único escritor (subtarefas tocam conjuntos de arquivos disjunto).

4. Revisor de swap de GPT-5.4 a Claude Opus 4.7. Medir a taxa de falsa aprovação e o delta de custo dos tokens.

5. Adicione um quinto papel: documentador (Haiku 4.5). Após revisão, ele produz uma entrada de log de mudança.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Parallel worktree | "Isolated branch" | `git worktree add` producing a fresh working tree per coder |
| Task board | "Shared message bus" | File or Redis store of typed messages agents subscribe to |
| Handoff | "Role boundary" | Any message crossing from one role's context to another's |
| Token amplification | "Multi-agent overhead" | Total tokens across roles / single-agent tokens for the same task |
| A2A protocol | "Agent-to-agent" | Google's 2025 spec for typed inter-agent messages |
| Merge coordinator | "Integrator" | Component that runs three-way merge and mediates conflicts |
| False approval | "Reviewer hallucination" | Reviewer approves a diff with known bugs |

## Mais leitura

- [SWE-AF factory architecture](https://github.com/Agent-Field/SWE-AF) fábrica de referência de agentes múltiplos 2026
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT) quadro multiagente baseado em funções
- [AutoGen v0.4](https://github.com/microsoft/autogen) Framework de atores digitais da Microsoft
- [Cognition AI (Devin)](https://cognition.ai) Produto de referência
- [Factory Droids](https://www.factory.ai) Produto de referência alternativo
- [Google A2A protocol](https://a2a-protocol.org/latest/) Especificações de mensagens entre agentes
- [git worktree documentation](https://git-scm.com/docs/git-worktree) o substrato de isolamento
- [SWE-bench Pro](https://www.swebench.com) o objectivo de avaliação
