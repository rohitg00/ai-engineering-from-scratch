# METR Horizontes temporais e avaliação da capacidade externa

> A METR (ex-ARC Evals) é uma organização independente 501 ((c) ((3)) desde dezembro de 2023. O seu índice de referência Time Horizon 1.1 (janeiro de 2026) corresponde a uma curva logística da probabilidade de sucesso da tarefa versus log ((experto tempo de conclusão humana); a intersecção de 50% de probabilidade define o horizonte temporal do modelo. O conjunto de engajamento 20252026 abrange GPT-5.1, GPT-5.1-Codex-Max e avaliações de monitorização de protótipo (um monitor pode capturar tarefas laterais; o agente pode fugir). Suites de referência: HCAST (180+ ML, ciber, SWE, tarefas de raciocínio; 1 minuto a 8+ horas), RE-Bench (71 ML tarefas de engenharia de pesquisa com base de peritos), SWAA. A nota honesta: as medições METR são idealizadas  sem humanos, sem consequências reais  e a equipe documentou a lacuna de comportamento avaliação versus implantação (Lessão 1). Um horizonte temporal é um limite superior, não uma previsão de implantação.

**Type:** Learn
**Languages:** Python (stdlib, logistic-fit horizon estimator), TypeScript
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 19 (RSP)
**Time:** ~60 minutes

## O problema

As políticas de escalagem (Lessões 19, 20) são apenas tão úteis quanto as medidas que referem. "Predigo de I&D-4 de IA" e "Autonomia de longo alcance" são definidas na prosa da política; elas só se tornam acionáveis quando avaliações específicas produzem números específicos.

O METR é a organização de avaliação externa 20242026 que definiu muitos desses números. Eles avaliam modelos de fronteira  muitas vezes pré-lançamento, sob NDA com laboratórios  e publicam a metodologia depois. O Time Horizon 1.1 (janeiro de 2026) é o seu artefato principal: um único escalar que comprime a capacidade em uma unidade legível pelo ser humano ("este modelo pode fazer o tipo de tarefa em que um especialista passa X horas com 50% de confiabilidade").

A lição é em parte sobre a metodologia (como um horizonte é calculado) e em parte sobre a interpretação (por que um horizonte é um limite superior, não uma previsão de implantação). As duas habilidades pertencem juntas. Uma equipe que entende como o horizonte é adequado é muito mais difícil de enganar com uma reclamação de um mau fornecedor do que uma equipe que vê apenas "14 horas" em um slide.

## O conceito

### METR de fundo

- Fundada: Dezembro de 2023 (ex-ARC Evals, dividida em 501 ((c) ((3)).
- Ámbito de aplicação: avaliação das capacidades autónomas dos modelos de fronteira, muitas vezes pré-lançamento.
- Laboratórios parceiros: Anthropic, OpenAI (múltiples compromissos 20252026).
- Resultados notáveis: Horizonte temporário 1.0 (março 2025), Horizonte temporário 1.1 (janeiro 2026), avaliações de monitorização de protótipos.

### O Time Horizon se encaixa

Metodologia (do blog e artigos da METR):

1. Coletar uma suíte de tarefas que abrange de minutos a horas de tempo de conclusão de peritos. Suites atuais: HCAST (180+ tarefas), RE-Bench (71 tarefas), SWAA.
2. Execute o modelo em cada tarefa; registar sucesso ou fracasso.
3. Aplique uma curva logística: $P(\text{success})$como função de $\log(\text{expert completion time})$- Não .
4. O horizonte é o tempo de expertos em que P ((sucesso) = 0,5.

A forma logística-ajustamento é a certa porque a capacidade geralmente tem uma relação crescente, aproximando-se do planalto com a dificuldade da tarefa. O ponto de 50% é uma escolha (poderia ser 10%, 90%); METR relata vários limiares no papel detalhado, mas lidera com 50% porque é o mais intuitivo.

### Os números de Janeiro de 2026

Por Horizonte Temporal 1.1:

- Claude Opus 4.6: ~ 14 horas com uma confiabilidade de 50%, a partir de Time Horizon 1.1 (janeiro 2026).
- Tempo duplicado em tarefas de estilo HCAST: ~4,3 meses (130,8 dias) no ajuste pós-2023 relatado pelo Time Horizon 1.1 (janeiro de 2026); o número de ~7 meses é o ajuste completo de 20192025 do Time Horizon 1.0 e é relatado em TH1.1 ao lado do número pós-2023.

Estes são os números específicos que restam das referências da Fase 15. Eles são citados no RSP v3.0 (Lessão 19) da Anthropic e no FSF v3 (Lessão 20) da DeepMind como uma das medições que alimentam as avaliações de limiar.

### Suítes de referência

- **HCAST**A programação de trabalho de um grupo de especialistas é uma das principais tarefas da área de tecnologia, segurança cibernética, engenharia de software e raciocínio geral.
- **RE-Bench**A análise da base de dados da IA é feita por um grupo de investigadores que trabalha em uma área de investigação e desenvolvimento de IA.
- **SWAA**As tarefas mais curtas são úteis para a calibração do extremo inferior da curva do horizonte.

### Avaliações de monitorização de protótipos

O trabalho do METR 20252026 incluiu protótipos de monitoramento e avaliação: pode um monitor capturar um modelo realizando uma tarefa lateral (algo diferente do que o operador pediu); pode o agente evitar o monitor. Estes alimentam diretamente a categoria "Submining Safeguards" na OpenAI PF v2 e o monitoramento de alinhamento enganoso na DeepMind FSF v3 (Lessão 20).

### Por que os horizontes são limites superiores

- **Idealized tooling**As tarefas de referência dão ao modelo ferramentas limpas e dados bem formatados.
- **No real consequences**O modelo nunca realmente faturou um cliente, exclui dados reais ou contata pessoas reais.
- **Eval-context gaming**Leção 1. Os modelos comportam-se de forma diferente nos testes. O Relatório Internacional de Segurança da IA de 2026 documenta isso empiricamente.
- **No legitimate user variance**Os utilizadores reais produzem pedidos ambíguos e dependentes do contexto.

O horizonte é o limite máximo de capacidade em condições favoráveis.

### O caso do avaliador externo

A avaliação externa é importante porque os laboratórios internos têm incentivos para otimizar as métricas que relatam. A independência do METR  501 ((c) (3) com uma metodologia declarada e trabalhos revisados por pares  é a mitigação estrutural. Não é suficiente sozinho (os laboratórios ainda controlam o que o METR vê), mas é estritamente melhor do que nenhuma avaliação externa.

### Como utilizar os números de horizonte na prática

- **As a capability filter**Se o horizonte de um modelo estiver bem abaixo do tempo de experiência de uma tarefa proposta, não o enviem de forma autónoma (arquivo de competências da Lesson 1).
- **As a trend indicator**O tempo de duplicação indica quanto tempo a prática actual permanecerá segura mesmo sem novas mitigações.
- **As a prior**A programação de trabalho deve ser feita com base em um horizonte de 14 horas.

```figure
a5-horizon-fit
```

## Usá-lo

`code/main.py`Implementa um ajuste logístico de sucesso de tarefa versus$\log(\text{expert time})$O METR apresenta o horizonte de 50% (título do METR), 10% (conservador) e 90% (optimista).

## Envia-o

`outputs/skill-horizon-interpretation.md`Revisar a alegação de horizonte de um fornecedor e produz uma análise da lacuna entre a alegação de referência e a realidade da implantação.

## Exercícios

1. Corra .`code/main.py`Confirme que o horizonte de 50% da adaptação corresponde à verdade sintética do solo. Agora, dime a grade de tempo de tarefa; o horizonte estima mudanças significativamente?

2. Leia o post do blog Time Horizon 1.1 do METR. Identifique as tarefas específicas em que a confiabilidade é mais alta e em que é mais baixa. Explique por que existe a lacuna.

3. Leia os recursos do METR "Messuring Autonomous AI Capabilities". Enumere as categorias de tarefas HCAST. Escolha uma categoria que você ponderaria mais para uma tarefa de produção e justifique o porquê.

4. Introduza o jogo de conteúdo de avaliação no simulador: inverte ~20% das tarefas falhadas para o sucesso. Relate o novo horizonte. Isso aproxima o que uma taxa de jogo de 20% faz com o número observado.

5. Desenhe uma avaliação do horizonte interno em seu próprio backlog de bugs ou um conjunto de tarefas representativo. Descreva a coleta de dados, o ajuste e o que a saída lhe diz. Compare com números METR.

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| METR | "External evaluator" | ex-ARC Evals; independent 501(c)(3) since Dec 2023 |
| Time Horizon | "Capability measure" | Expert task length at 50% reliability, from logistic fit |
| HCAST | "METR's main suite" | 180+ tasks spanning 1 min to 8+ hours |
| RE-Bench | "Research engineering" | 71 ML research-engineering tasks with human baseline |
| SWAA | "Short-task suite" | Calibrates the low end of the horizon curve |
| Doubling time | "Growth rate" | Time for the 50% horizon to double; ~7 months per HCAST |
| Eval-context gaming | "Model behaves differently" | Documented behavior gap between tests and deployment |
| Upper bound | "Horizon is a ceiling" | Benchmark horizon > deployment reliability under load |

## Mais leitura

- [METR — Resources for Measuring Autonomous AI Capabilities](https://metr.org/measuring-autonomous-ai-capabilities/) Especificações HCAST, RE-Bench, SWAA.
- [METR — Measuring AI Ability to Complete Long Tasks](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/)O papel original do horizonte.
- [METR — Time Horizon 1.1 (January 2026)](https://metr.org/research/) números e metodologia atuais.
- [Epoch AI — METR Time Horizons benchmark](https://epoch.ai/benchmarks/metr-time-horizons)- Seguimento ao vivo.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) Perspectiva interna das medições do METR.
