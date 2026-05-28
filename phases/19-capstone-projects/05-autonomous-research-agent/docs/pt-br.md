# Capstone 05 — Agent de Pesquisa Autônomo (Classe AI-Scientist)

> AI-Scientist-v2 da Sakana publicou papers completos. Agent Laboratory rodou os experimentos. Allen AI compartilhou traces. A forma de 2026 é busca em árvore planejar-executar-verificar sobre experimentos, custo orçado, execução de código em sandbox, escritor LaTeX com feedback visual e um conjunto automatizado de revisores estilo NeurIPS. O capstone é construir um, rodar de ponta a ponta dentro de $30 por paper e sobreviver ao red team de escape de sandbox que a Sakana documentou.

**Tipo:** Capstone
**Linguagens:** Python (agent + sandbox), LaTeX (saída)
**Pré-requisitos:** Fase 2 (ML), Fase 3 (deep learning), Fase 7 (transformers), Fase 10 (LLMs do zero), Fase 14 (agents), Fase 15 (autônomo), Fase 16 (multi-agent), Fase 18 (segurança)
**Fases exercitadas:** P0 · P2 · P3 · P7 · P10 · P14 · P15 · P16 · P18
**Tempo:** 40 horas

## Problema

Agents de pesquisa autônomos cruzaram um limiar em 2026. AI-Scientist-v2 da Sakana AI foi publicado na Nature com papers gerados que passaram em peer review de workshop. ShinkaEvolve (ICLR 2026) estendeu a linha para evoluir hipóteses. Agent Laboratory da AMD lançou traces reproduzíveis. Os agentes não são magia — são um loop planejar-executar-verificar rodando sobre uma árvore de experimentos candidatos, com limites de custo, sandboxes com semente fixada e revisão automatizada. O ofício está no loop, no orçamento e na história de segurança.

Você aprende o loop implementando um contra uma ideia semente em um domínio restrito (por exemplo, ablações de sparsity em attention num transformer de 100M de parâmetros). O valor não está em descobrir algo novo na primeira execução. O valor está na infraestrutura: a busca em árvore, o sandbox de experimentos, o loop escritor-revisor, o relatório do red team. A equipe da Sakana documentou falhas de escape de sandbox; seu agente deve passar no mesmo red team.

## Conceito

O agente é uma busca best-first em árvore. Nós são eespecificaçãoificações de experimento: (hipótese, config, código, resultado esperado). Um passo de expansão propõe filhos com edições pequenas (trocar otimizador, alterar batch size, ablar um componente). Cada filho roda em um sandbox novo com um limite rígido de recursos. Resultados são alimentados de volta em uma função de pontuação que ranqueia nós por (novidade × qualidade × orçamento restante). A árvore cresce até o orçamento se esgotar, depois a melhor ramificação é escrita.

O escritor é multimodal. Gera um rascunho LaTeX, compila, renderiza figuras e alimenta o PDF renderizado de volta para o modo visão do Claude Opus 4.7 para crítica sobre layout, legibilidade de figuras e alinhamento afirmação-evidência. Um conjunto de cinco revisores LLMs emite pontuações estilo NeurIPS (novidade, rigor, clareza, reprodutibilidade, impacto); se a média cair abaixo do limite, o paper volta para o escritor com crítica.

Segurança é sustentável. Cada experimento roda num sandbox E2B ou Daytona sem saída de rede, com relógio de parede limitado e limites de recursos fixados. O passo de geração de código do agente passa por uma camada de política que bloqueia syscalls que escapam do sandbox. O relatório do red team reproduz a superfície de ataque documentada pela Sakana (fork bombs, escapes de filesystem, chamadas de rede escritas por LLM).

## Arquitetura

```
ideia semente + domínio
      |
      v
  busca na literatura (Semantic Scholar + OpenAlex + cache FAISS)
      |
      v
  árvore planificar-executar-verificar LangGraph
      |
      v
  +--- expandir nó ----+      sandbox por nó
  |                    |      (E2B / Daytona)
  v                    v      limites de recursos
  filho_1           filho_k   sem saída de rede
  |                    |      sementes determinísticas
  v                    v
  rodar experimento       rodar experimento
  |                    |
  v                    v
  pontuar nós por (novidade, qualidade, orçamento)
      |
      v
  melhor ramificação -> escritor LaTeX
      |
      v
  compilar + crítica visual (Opus 4.7 visão)
      |
      v
  conjunto de revisores (5 juízes LLM, rubrica NeurIPS)
      |
      v
  paper.pdf + review.md + trace.json
```

## Stack

- Orquestração: LangGraph com checkpointing e portões de aprovação humana
- Busca em árvore: best-first customizado sobre nós de experimento (estilo AB-MCTS da Sakana v2)
- Sandbox: E2B por experimento, reserva Docker-in-Docker; limites de recursos via cgroups
- Literatura: Graph API do Semantic Scholar + OpenAlex + cache local FAISS de resumos
- Escritor: template LaTeX + Claude Opus 4.7 (modo visão) para crítica de figuras e layout
- Revisor: conjunto de 5 juízes (Opus 4.7, GPT-5.4, Gemini 3 Pro, DeepSeek R1, Qwen3-Max) com agregação ponderada
- Framework de experimentos: PyTorch 2.5 para os experimentos físicos, W&B para logging
- Observabilidade: Langfuse para traces do agent, orçamento rígido de $30 por paper

## Construa

1. **Delimitação de semente e domínio.** Pegue uma ideia semente (ex.: "investigar padrões de sparsity em mapas de attention de transformers sub-1B"). Defina o espaço de busca: modelos, datasets, orçamento de computação.

2. **Passada na literatura.** Consulte Semantic Scholar + OpenAlex por 50 papers mais citados relevantes; cacheie resumos localmente; gere um digest de uma página do domínio.

3. **Estruturação da árvore.** Inicialize a raiz com a hipótese semente. Implemente `expandir(nó) -> filhos` com propostas de pequena edição (uma mudança de config por filho). Implemente `pontuar(nó)` como um termo ponderado de novidade × qualidade × orçamento.

4. **Envoltória de sandbox.** Todo experimento roda `docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only` (ou a política equivalente do E2B). Sementes são escritas no sandbox; saídas são montadas em leitura-escrita de volta.

5. **Loop planificar-executar-verificar.** `planificar` propõe filhos. `executar` roda o sandbox, captura logs e métricas. `verificar` roda verificações unitárias nas métricas (a perda diminuiu? a ablação isola o efeito?). Nós falhados recebem uma razão de falha armazenada na árvore.

6. **Escritor.** Após o orçamento, selecione a melhor ramificação. Renderize figuras com matplotlib. Gere um rascunho LaTeX via Claude Opus 4.7 com o trace da ramificação em contexto. Compile. Alimente o PDF compilado de volta ao Opus 4.7 visão para crítica. Repita.

7. **Conjunto de revisores.** Cinco juízes pontuam o rascunho em (novidade, rigor, clareza, reprodutibilidade, impacto) com rubricas estilo NeurIPS. Se média < 4.0/5, retorne ao escritor com crítica. Parada dura após 3 reescritas.

8. **Red team.** Construa ou integre um conjunto de tarefas adversárias visando o sandbox: fork bombs, tentativas de exfiltração de rede, escapes de filesystem, metacaracteres de shell escritos por LLM. Confirme que todos são bloqueados. Escreva os achados.

9. **Reprodutibilidade.** Cada paper é entregue com seu JSON de trace da busca em árvore, sementes, links de execução do W&B, configs de sandbox e um README reproduzindo de ponta a ponta.

## Use

```
$ ai-scientist run --seed "sparsity em attention de transformers sub-1B" --budget 30
[lit]    50 papers, digest em 12s
[árvore] expandiu 8 nós, orçamento 12/30
[exec]   nó #3 sparsity=top-8, perda=2.83 (melhor até agora)
[exec]   nó #6 sparsity=top-4, perda=3.12 (pior)
[exec]   ...
[árvore] escolheu ramificação enraizada no nó #3 (novidade 0.62, qualidade 0.81)
[escrit] rascunho LaTeX v1 completo
[visão]  crítica: legenda da figura 2 pequena demais, afirmação-evidência ok
[escrit] rascunho v2 após 3 edições
[revisão] média 4.2/5 (novidade 3.9, rigor 4.3, clareza 4.1, reprod 4.5, impacto 4.2)
[feito]  paper.pdf + review.md + trace.json     $28.40 gastos
```

## Entregue

`outputs/skill-ai-scientist.md` é a entrega. Dada uma ideia semente + um domínio + um orçamento de $30, ela roda a pipeline completa e emite um paper revisável mais um pacote de reprodutibilidade.

| Peso | Critério | Como é medido |
|:-:|---|---|
| 25 | Qualidade do paper | Revisão cega por rubrica contra papers publicados em workshop |
| 20 | Rigor experimental | Baselines, sementes, ablações; cada afirmação sustentada por uma célula na tabela de resultados |
| 20 | Disciplina de custo e computação | Limite de $30/paper aplicado, rastreado pelo Langfuse |
| 20 | Segurança | Red team de sandbox passa; política de rede e kill-switch verificados |
| 15 | Reprodutibilidade | Reexecução em um comando com sementes idênticas reproduz o paper |
| **100** | | |

## Exercícios

1. Rode a pipeline contra três ideias sementes diferentes no mesmo domínio. Compare quais partes da busca em árvore se sobrepõem. Identifique computação desperdiçada duplicada.

2. Adicione um portão de aprovação humana antes da execução do experimento para nós estimados acima de $5. Meça quanto o custo total cai.

3. Troque o conjunto de revisores por um único juiz. Meça a taxa de falso-aceite em um conjunto retido de papers sabidamente ruins.

4. Introduza um teste adversarial de exfiltração de rede: agente escreve código que tenta fazer `curl` para um endereço externo. Confirme que a política `--network=none` bloqueia. Registre a tentativa.

5. Compare sua busca em árvore com uma baseline aleatória flat (mesmo orçamento, sem estratégia de expansão). Relate o ganho de novidade × qualidade.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|------|------------------------|------------------------|
| Busca em árvore | "Expansão estilo AB-MCTS" | Exploração best-first sobre nós de experimento com pontuação novidade×qualidade×orçamento |
| Sandbox | "Isolamento de experimentos" | Container sem rede, CPU/memória limitada, sementes fixadas, entradas em leitura-escrita |
| Crítica visual | "Renderizar-e-depois-ler" | Compilar o paper para PDF, alimentar o PDF de volta a um VLM para crítica de layout e afirmação-evidência |
| Conjunto de revisores | "Revisão automatizada por pares" | Múltiplos juízes LLM pontuando o paper com rubrica NeurIPS; agregação ponderada controla a pipeline |
| Pontuação de novidade | "Isso é novo?" | Heurística que penaliza proximidade ao cache de 50 papers da literatura |
| Limite de custo | "Orçamento em $" | Limite rígido no gasto total por paper; contadores Langfuse + estimativas pré-execução |
| Red team | "Auditoria de escape de sandbox" | Tarefas adversárias que escapariam do sandbox se a política estiver errada |

## Leitura Complementar

- [Repositório AI-Scientist-v2 da Sakana](https://github.com/SakanaAI/AI-Scientist-v2) — o agente de pesquisa de referência em produção
- [Paper AI-Scientist-v1 da Sakana (arXiv:2408.06292)](https://arxiv.org/abs/2408.06292) — a metodologia original
- [ShinkaEvolve (Sakana ICLR 2026)](https://sakana.ai) — extensão evolutiva
- [Agent Laboratory (AMD)](https://github.com/SamuelSchmidgall/AgentLaboratory) — framework de laboratório de pesquisa multi-papel
- [Documentação LangGraph](https://langchain-ai.github.io/langgraph/) — camada de orquestração de referência
- [Graph API do Semantic Scholar](https://api.semanticscholar.org/) — busca na literatura
- [Sandboxes E2B](https://e2b.dev) — isolamento de experimentos de referência
- [Diretrizes de revisão NeurIPS](https://neurips.cc/Conferences/2026/Reviewer-Guidelines) — a rubrica que o conjunto de revisores codifica
