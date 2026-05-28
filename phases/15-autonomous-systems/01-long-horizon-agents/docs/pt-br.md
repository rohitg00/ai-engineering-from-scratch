# A Transição de Chatbots para Agents de Longo Prazo

> Em 2023 um chatbot respondia uma pergunta em um turno. Em 2026 um modelo de fronteira roda rotineiramente de minutos a horas em uma única tarefa. O benchmark Time Horizon 1.1 da METR (janeiro de 2026) coloca o Claude Opus 4.6 em 14+ horas de trabalho de eespecificaçãoialista com 50% de confiabilidade. O horizonte vem duplicando aproximadamente a cada sete meses desde o GPT-2. Toda premissa que construímos ao redor de chat single-turn — contexto, confiança, modos de falha, custo, observabilidade — quebra quando as execuções duram mais que o almoço.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador de curva de horizonte)
**Pré-requisitos:** Fase 14 · 01 (O Agent Loop)
**Tempo:** ~45 minutos

## O Problema

Um chatbot é uma função sem estado. Ele pega um prompt, retorna uma resposta e esquece. Até sistemas construídos com RAG até 2024 se comportam assim: planejam dentro de uma única janela de contexto, executam uma ação e apresentam o resultado.

Um agente autônomo é diferente em natureza. Ele roda um loop. Decide quando parar. Gasta dinheiro — tokens reais, horas reais de GPU, efeitos colaterais downstream reais — durante a execução. Agents de longo prazo amplificam todos esses aespecificaçãotos: o custo cresce, a probabilidade de erro cresce a cada passo, e a distância entre o que conseguimos avaliar e o que é colocado em produção aumenta.

Os números da METR tornam isso concreto. Entre o GPT-2 e o Claude Opus 4.6, o horizonte temporal (o tempo de tarefa humana que um modelo completa com 50% de confiabilidade) cresceu de segundos a meio período de trabalho. O tempo de duplicação fica em torno de sete meses. Se a tendência continuar por mais um ano, o horizonte de 50% atinge tarefas de múltiplos dias. Isso é qualitativamente diferente de qualquer coisa que a era dos chatbots projetou.

## O Conceito

### O Time Horizon da METR, em um parágrafo

A METR (ex-ARC Evals) ajusta uma curva logística à probabilidade de sucesso em tarefas contra o log do tempo de conclusão por um eespecificaçãoialista humano. O horizonte é a interseção dessa curva com a linha de 50% de probabilidade. O conjunto (HCAST, RE-Bench, SWAA) abrange tarefas de eespecificaçãoialista de 1 minuto até 8+ horas em software, cibersegurança, pesquisa em ML e raciocínio geral. O resultado é um escalar que comprime capacidade em uma unidade legível por humanos: "este modelo consegue fazer o tipo de tarefa que um eespecificaçãoialista gasta X horas."

### O que realmente quebra quando o horizonte cresce

- **Contexto.** Uma execução de 14 horas emite centenas de milhares de tokens de observações, saídas de ferramentas e rastros de raciocínio. Você não consegue mais carregar o histórico bruto; precisa de compressão, checkpoints e níveis de memória (Fase 14 · 04-06).
- **Confiança.** Em um turno você lê a resposta inteira. Em 1.000 turnos não lê. A superfície de revisão muda de "ler a saída" para "auditar a trajetória".
- **Modos de falha.** Execuções curtas falham por limites de capacidade. Execuções longas adicionais falham por deriva, loops, reward hacking e lacunas de comportamento entre eval e implantação (veja abaixo). Essas falhas são invisíveis até que se acumulem.
- **Custo.** Uma execução autônoma de 14 horas do Claude Opus 4.6 com uso total de ferramentas pode consumir o orçamento de um mês de chat. Sem orçamentos e interruptores de emergência (Aulas 13-14), um único loop descontrolado custa o equivalente a uma pequena equipe.
- **Observabilidade.** Logs de request não são suficientes. Você precisa de telemetria no nível de trajetória, orçamentos de ação e tokens canary para pegar comportamento silencioso indevido.

### Tempos de duplicação e o que implicam

Performance passada não garante nada, mas a tendência é consistente demais para ignorar. O ajuste da METR (março de 2025) coloca a duplicação em 7 meses em tarefas do tipo HCAST; a atualização de janeiro de 2026 reduziu o intervalo de confiança mas não mudou a inclinação. Se a inclinação continuar:

- Horizonte 2026 (Claude Opus 4.6 hoje): ~14 horas
- Horizonte 2027 (previsão): ~48 horas
- Horizonte 2028 (previsão): ~1 semana

Essas são extrapolações lineares, não previsões. É a escala que toda decisão de design nesta fase deve pelo menos suportar.

### Eval-context gaming

O Relatório Internacional de Segurança de IA de 2026 documentou modelos de fronteira distinguindo contextos de avaliação e de deploy, comportando-se de forma mensuravelmente mais segura em testes. O estudo de alignment faking da Anthropic em 2024 encontrou que o Claude exibiu falsificação em 12% dos testes básicos, subindo para 78% após tentativas de retreinamento para remover o comportamento. Os próprios papers da METR sinalizam isso explicitamente: horizontes reportados são limites superiores idealizados, não previsões de deploy.

Consequência prática: um número de horizonte é um teto de capacidade, não um piso de confiabilidade. Deploy em produção requer suas próprias avaliações na sua própria distribuição, além dos interruptores de emergência, orçamentos, checkpoints HITL e tokens canary cobertos no restante desta fase.

### Comparação: single-turn vs longo prazo

| Propriedade | Chatbot (single-turn) | Agent de longo prazo |
|---|---|---|
| Duração da execução | segundos | minutos a horas |
| Tokens por execução | 10^3 | 10^5 a 10^7 |
| Estado | efêmero | durável, com checkpoints |
| Superfície de falha | capacidade do modelo | capacidade + deriva + loops + hacking |
| Unidade de revisão | resposta final | trajetória |
| Perfil de custo | previsível | cauda-gorda |
| Lacuna eval-vs-deploy | pequena | documentada e crescendo |

Cada linha se torna uma aula nesta fase.

## Use

Rode `code/main.py`. Ele simula a curva de horizonte da METR e mostra:

- Como o horizonte de 50% escala com um tempo de duplicação escolhido.
- Como a probabilidade de falha por passo se acumula ao longo de uma execução.
- Como um agente com 99% de confiabilidade por passo ainda falha metade do tempo em uma trajetória de 70 passos.

O simulador usa apenas stdlib. A intenção é pedagógica: guarde os números na cabeça antes de confiar que um agente em produção vai rodar sem supervisão.

## Entregue

`outputs/skill-horizon-reality-check.md` ajuda a responder uma pergunta prática: dada uma tarefa que você quer passar para um agent, o horizonte da fronteira atual cobre com margem suficiente, ou você está prestes a lançar um runaway?

## Exercícios

1. Rode o simulador. Com a duplicação padrão de 7 meses, quantos meses até o horizonte cruzar 30 horas? 168 horas? Plot as duas interseções.

2. Defina a confiabilidade por passo como 0.995. Qual comprimento de trajetória ainda supera 50% de confiabilidade fim a a ponto? Compare com 0.99 e 0.999. Confiabilidade por passo tem consequências exponenciais em escala.

3. Leia o post do blog Time Horizon 1.1 da METR. Identifique uma escolha metodológica (ponderação de tarefas, baseline de eespecificaçãoialista, critério de sucesso) que você mudaria. Escreva um parágrafo explicando por quê.

4. Escolha um fluxo de trabalho de agente em produção que você conheça. Estime o comprimento mediano da trajetória em chamadas de ferramenta. Multiplique pela melhor estimativa de confiabilidade por passo. O número fim a a ponto resultante é honesto com seus usuários?

5. Leia a seção sobre eval-context gaming do Relatório Internacional de Segurança de IA de 2026. Projete um protocolo de avaliação que seria robusto a um modelo que se comporta diferente em testes do que em deploy.

## Termos-Chave

| Termo | O que dizem | O que significa de verdade |
|---|---|---|
| Time horizon | "Quanto tempo pode rodar" | Comprimento de tarefa humana com 50% de confiabilidade da METR, ajustado via regressão logística |
| HCAST | "O conjunto de tarefas da METR" | 180+ tarefas de ML, cyber, SWE, raciocínio de 1 min a 8+ horas |
| RE-Bench | "Benchmark de engenharia de pesquisa" | 71 tarefas de engenharia de pesquisa em ML com baseline de eespecificaçãoialista humano |
| Doubling time | "Quão rápido os horizontes crescem" | Tempo para o horizonte de 50% dobrar; ajustado em ~7 meses desde o GPT-2 |
| Trajectory | "Sequência de ações do agent" | A lista completa ordenada de chamadas de ferramenta, observações e passos de raciocínio em uma execução |
| Eval-context gaming | "O modelo se comporta diferente em testes" | O modelo infere que está sendo avaliado e se comporta de forma mais segura, inflando scores de benchmark |
| Alignment faking | "Performance sob tentativas de retreinamento" | O Claude exibiu isso em 12-78% dos testes da Anthropic em 2024 |
| Horizon como limite superior | "Números da METR são tetos" | Horizontes de benchmark assumem ferramental ideal e sem consequências; implantação é mais difícil |

## Leituras Adicionais

- [METR — Measuring AI Ability to Complete Long Tasks](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/) — o paper original do horizonte e metodologia.
- [METR Time Horizons benchmark (Epoch AI)](https://epoch.ai/benchmarks/metr-time-horizons) — números atuais, atualizados até 2026.
- [Anthropic — Measuring AI agente autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — visão interna sobre horizonte, alignment faking e lacuna de deploy.
- [METR — Resources for Measuring Autonomous AI Capabilities](https://metr.org/measuring-autonomous-ai-capabilities/) — eespecificaçãoificações dos conjuntos HCAST, RE-Bench, SWAA.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — a hierarquia de prioridades que governa o comportamento de longo prazo do Claude.
