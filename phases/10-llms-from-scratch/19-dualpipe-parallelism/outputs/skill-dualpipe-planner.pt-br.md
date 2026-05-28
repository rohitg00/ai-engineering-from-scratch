---
name: dualpipe-planner
description: Planeje uma estratégia de paralelismo de pipeline (1F1B, Zero Bubble, DualPipe, DualPipeV) para um cluster de treinamento.
version: 1.0.0
phase: 10
lesson: 19
tags: [pipeline-parallelism, dualpipe, dualpipev, zero-bubble, expert-parallelism, distributed-training]
---

Dada uma especificação de cluster de treinamento (contagem total de GPUs, topologia de interconexão, modelo de acelerador, memória por GPU), um formato de modelo (parâmetros totais, parâmetros ativos, MoE ou contagem de camadas esperadas e densas) e um volume de dados de treinamento alvo, recomende uma estratégia de paralelismo de pipeline e confirme a fração de bolha esperada.

Produzir:

1. Profundidade do pipeline P. Escolha com base no orçamento de memória da GPU (deve caber em um estágio de pipeline por classificação), MoE vs denso e largura de banda de interconexão. Faixa: 4 para pequenos clusters, 16-32 para treinamento de fronteira do MoE.
2. Contagem de microlotes M. Deve ser divisível por 2 para DualPipe e DualPipeV. Razão típica M/P entre 8 e 16. Justifique contra alvos de acumulação de gradiente e memória de ativação no comprimento da sequência alvo.
3. Escolha do horário. Escolha entre 1F1B, Zero Bubble, DualPipe, DualPipeV. Tabela de decisão: treinamento denso em 500 GPUs -> Zero Bubble. MoE com paralelismo especializado -> DualPipe. Treinamento denso acima de 500 GPUs sem tudo-para-todos pesados ​​-> DualPipeV. Pequenas execuções abaixo de 100 GPUs -> 1F1B está bom.
4. Fração de bolha esperada. Calcule para o cronograma escolhido no P e M alvo. Relate como porcentagem e como horas absolutas de GPU economizadas em comparação com 1F1B no orçamento total de treinamento.
5. Plano de replicação de parâmetros (somente DualPipe). Confirme se a replicação de parâmetros 2x se ajusta à VRAM disponível. Relate a densidade efetiva de parâmetros por GPU dado o P escolhido.

Rejeições difíceis:
- DualPipe sem paralelismo especializado. A replicação 2x não se justifica sem comunicações pesadas do EP para ocultar.
- P > 64 em qualquer treino. A fração de bolha cresce linearmente com P independentemente do cronograma.
- Contagem de microlotes não divisível por 2 para DualPipe/DualPipeV. A agenda não fechará.
- Paralelismo de pipeline quando o modelo cabe na memória de uma GPU. Use apenas paralelismo de dados.

Regras de recusa:
- Se a interconexão for de 200 Gbps ou mais lenta por GPU, recuse o DualPipe e recomende o DualPipeV. A janela de sobreposição total é muito estreita para justificar a replicação.
- Se o usuário não puder fornecer um kernel completo personalizado adequado para sua topologia de cluster, recomende Zero Bubble em vez de DualPipe.
- Se a execução do treinamento estiver abaixo de 1 bilhão de tokens, recuse totalmente o planejamento de paralelismo de pipeline e recomende paralelismo de dados mais paralelismo de tensor.

Saída: um plano de uma página listando P, M, cronograma, fração de bolha esperada, custo de replicação de parâmetros (se DualPipe) e uma recomendação de kernel completa. Termine com um parágrafo de "gatilho de reversão" nomeando a métrica de utilização específica (porcentagem agregada de utilização da GPU, medida nas primeiras 1.000 etapas) que justificaria a mudança para uma programação mais simples se o número alvo não fosse atingido.