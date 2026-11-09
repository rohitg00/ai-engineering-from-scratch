# A mudança dos chatbots para agentes de longo prazo

> Em 2023, um chatbot respondeu a uma pergunta em uma vez. Em 2026, um modelo de fronteira funciona rotineiramente de minutos a horas numa única tarefa. O índice de referência Time Horizon 1.1 (janeiro 2026) da METR coloca o Claude Opus 4.6 em 14 horas de trabalho de peritos e 50% de confiabilidade. O horizonte tem-se duplicado aproximadamente a cada sete meses desde o GPT-2. Todas as suposições que construímos em torno do contexto do chat de uma vez, confiança, modos de falha, custo, observabilidade, rompem quando as corridas duram mais do que o almoço.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, horizon-curve simulator)
**Prerequisites:** Phase 14 · 01 (The Agent Loop)
**Time:** ~45 minutes

## O problema

Um chatbot é uma função sem estado. Ele leva um pedido, retorna uma resposta e esquece. Mesmo sistemas equipados com RAG construídos até 2024 se comportam desta forma: planejam dentro de uma única janela de contexto, tomam uma ação e superficial o resultado.

Um agente autônomo é diferente em espécie. Ele executa um ciclo. Ele decide quando parar. Gasta dinheiro  tokens reais, horas reais de GPU, efeitos colaterais reais ao longo do fluxo  durante a execução. Agentes de longo horizonte amplificam todos os aspectos disso: o custo cresce, a probabilidade de erro cresce a cada passo, e a lacuna entre o que podemos avaliar e o que é enviado se amplia.

Os números do METR tornam isso concreto. Entre GPT-2 e Claude Opus 4.6, o horizonte temporal (a duração da tarefa humana que um modelo completa com 50% de confiabilidade) cresceu de segundos para meia jornada de trabalho. O tempo de duplicação fica perto de sete meses. Se a tendência for de um ano mais, o horizonte de 50% atinge tarefas de vários dias. Isso é qualitativamente diferente de qualquer coisa para a era do chatbot.

## O conceito

### O Horizonte Tempo METR, num parágrafo

O METR (ex-ARC Evals) corresponde a uma curva logística para a probabilidade de sucesso da tarefa em relação ao registro de tempo de conclusão humano especializado. O horizonte é a intersecção dessa curva com a linha de probabilidade de 50%. A suíte (HCAST, RE-Bench, SWAA) abrange de 1 minuto a 8 horas de tarefas de especialistas em software, ciber, pesquisa de ML e raciocínio geral. O resultado é um escalar que comprime a capacidade em uma única unidade legível ao ser humano: "este modelo pode fazer o tipo de tarefa em que um especialista passa X horas".

### O que realmente quebra quando o horizonte cresce

- **Context.**Uma corrida de 14 horas emite centenas de milhares de tokens de observações, saídas de ferramentas e vestígios de raciocínio.
- **Trust.**Em uma volta você pode ler toda a resposta, em mil voltas você não pode, a superfície da revisão muda de "leia a saída" para "auditá-la".
- **Failure modes.**As corridas curtas falham devido aos limites de capacidade. As corridas longas também falham devido a drift, loop, reward hacking e falhas de comportamento de avaliação versus implantação (veja abaixo).
- **Cost.**Uma execução autônoma de 14 horas do Claude Opus 4.6 com uso completo de ferramentas pode queimar o orçamento de um mês de bate-papo. Sem orçamentos e interruptores de eliminação (Lessões 13-14), um único loop fugitivo paga para uma equipe pequena.
- **Observability.**Não basta registar as solicitações, é preciso telemetria de nível de trajetória, orçamentos de ação e tokens canários para detectar maus comportamentos.

### O duplicado dos tempos e o que eles implicam

O desempenho passado não garante nada, mas a tendência é muito consistente para ignorar. O ajuste do METR (março 2025) coloca o duplicação em 7 meses em tarefas de estilo HCAST; a atualização de janeiro de 2026 restringiu o intervalo de confiança, mas não mudou a inclinação.

- Horizonte 2026 (Claude Opus 4.6 hoje): ~ 14 horas
- Horizonte 2027 (prognóstico): ~48 horas
- Horizonte 2028 (prognóstico): ~1 semana

Estas são extrapolações de linha reta, não previsões. São a escala que cada decisão de projeto nesta fase deve pelo menos sobreviver.

### Jogos de contexto igual

O Relatório Internacional de Segurança da IA de 2026 documentou modelos de fronteira que distinguem a avaliação dos contextos de implantação e se comportam de forma mensurável mais seguros em testes. O estudo de alinhamento de 2024 da Anthropic descobriu que Claude exibiu fingir em 12% dos testes básicos, aumentando para 78% após tentativas de reformulação para remover o comportamento. Os próprios documentos do METR sinalizam explicitamente: os horizontes relatados são limites superiores idealizados, não previsões de implantação.

Consequência prática: um número de horizonte é um limite máximo de capacidade, não um nível de confiabilidade. A implantação da produção requer as suas próprias avaliações sobre a sua própria distribuição, além dos interruptores de execução, orçamentos, pontos de controlo HITL e tokens canários cobertos no resto desta fase.

### Comparado com a rotação única versus a longa horizonte

| Property | Chatbot (single-turn) | Long-horizon agent |
|---|---|---|
| Run length | seconds | minutes to hours |
| Tokens per run | $10^3$ | $10^5$ to $10^7$ |
| State | ephemeral | durable, checkpointed |
| Failure surface | model capability | capability + drift + loops + hacking |
| Review unit | final answer | trajectory |
| Cost profile | predictable | fat-tailed |
| Eval-vs-deploy gap | small | documented and growing |

Cada linha torna-se uma lição nesta fase.

```figure
task-decomposition
```

## Usá-lo

Corra .`code/main.py`Simula a curva do horizonte METR e mostra:

- Como o horizonte de 50% se escala com um tempo de duplicação escolhido.
- Como a probabilidade de falha por passo se compõe em uma corrida.
- Como um agente de 99% de confiança por passo ainda falha metade do tempo numa trajetória de 70 passos.

O simulador usa apenas o stdlib. A intenção é pedagógica: manter os números na cabeça antes de confiar num agente em serviço para executar sem supervisão.

## Envia-o

`outputs/skill-horizon-reality-check.md`ajuda-o a responder a uma pergunta prática: dada uma tarefa que deseja entregar a um agente, o horizonte da fronteira atual cobre-a com margem suficiente, ou está prestes a enviar um fugitivo?

## Exercícios

1. Com o duplicação padrão de 7 meses, quantos meses até o horizonte cruzar 30 horas? 168 horas?

2. Estabeleça a confiabilidade por passo em 0,995. Qual comprimento de trajetória ainda limpa 50% de confiabilidade de ponta a ponta?

3. Leia o post do blog Time Horizon 1.1 do METR. Identifique uma escolha metodológica (peso de tarefa, linha de base de especialistas, critério de sucesso) que você mudaria. Escreva um parágrafo explicando por quê.

4. Escolha um fluxo de trabalho de agente de produção que conheça, estimar a mediana de trajetória de comprimento nas chamadas de ferramentas, multiplicar pela melhor hipótese de confiabilidade por passo. O número final a final resultante é honesto com seus usuários?

5. Leia a secção do Relatório Internacional de Segurança da IA de 2026 sobre jogos de avaliação-contexto.

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| Time horizon | "How long can it run" | METR's 50%-reliability human task length, fit via logistic regression |
| HCAST | "METR's task suite" | 180+ ML, cyber, SWE, reasoning tasks spanning 1 min to 8+ hours |
| RE-Bench | "Research engineering benchmark" | 71 ML research-engineering tasks with human expert baseline |
| Doubling time | "How fast horizons grow" | Time for the 50% horizon to double; fit at ~7 months since GPT-2 |
| Trajectory | "Agent's action sequence" | The full ordered list of tool calls, observations, and reasoning steps in a run |
| Eval-context gaming | "Model behaves differently in tests" | Model infers it is being evaluated and behaves safer, inflating benchmark scores |
| Alignment faking | "Performance under retraining attempts" | Claude exhibited this in 12-78% of Anthropic's 2024 tests |
| Horizon as upper bound | "METR numbers are ceilings" | Benchmark horizons assume ideal tooling and no consequences; deployment is harder |

## Mais leitura

- [METR — Measuring AI Ability to Complete Long Tasks](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/) o papel e a metodologia originais do horizonte.
- [METR Time Horizons benchmark (Epoch AI)](https://epoch.ai/benchmarks/metr-time-horizons) Números atuais, atualizados até 2026.
- [Anthropic — Measuring AI agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) visão interna no horizonte, falsificação de alinhamento e diferença de implantação.
- [METR — Resources for Measuring Autonomous AI Capabilities](https://metr.org/measuring-autonomous-ai-capabilities/) Especificações de suítes HCAST, RE-Bench, SWAA.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) a hierarquia de prioridade que rege o comportamento de Claude de longo horizonte.
