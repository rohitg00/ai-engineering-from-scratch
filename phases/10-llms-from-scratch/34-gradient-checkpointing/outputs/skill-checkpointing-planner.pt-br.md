---
name: checkpointing-planner
description: Escolha uma política de recomputação de ativação por camada (nenhuma/seletiva/completa/descarga) de acordo com uma configuração de treinamento e orçamento HBM.
version: 1.0.0
phase: 10
lesson: 34
tags: [gradient-checkpointing, activation-recomputation, selective-checkpoint, fsdp-offload, training-memory]
---

Dada a configuração de treinamento (contagem de camadas L, tamanho oculto d, comprimento de sequência S, microlote B, dtype bytes por valor, kernel de atenção, grau paralelo de tensor TP, grau paralelo de pipeline PP, grau paralelo de especialista EP se MoE) e o orçamento HBM por classificação após pesos e estado do otimizador, saída:

1. Política por camada. Para cada família de camadas na pilha (incorporação, atenção, FFN, especialista em MoE, norma, cabeçalho de saída), escolha nenhuma, seletiva, completa ou descarregada. O padrão é seletivo para atenção quando S excede 4_096; o padrão é nenhum em fluxos e normas residuais; o padrão é descarregar em FFN somente quando o tempo de transferência PCIe medido para as ativações dessa camada for menor que o tempo de recomputação medido.
2. Tamanho do segmento k. Se o checkpoint completo estiver ativado, escolha k como round(sqrt(L)) para custo de camada uniforme, k menor quando a memória de ativação dominar o orçamento. Relate a porcentagem extra de FLOP como (1/k) de FLOPs futuros.
3. Interação FlashAttention. Confirme se o kernel de atenção já recalcula o softmax. Se sim, o checkpoint de atenção seletiva compra pouco; rebaixar para nenhum. Indique o kernel pelo nome (FlashAttention-2/3, xFormers com eficiência de memória, vanilla).
4. Plano TP/PP. Para TP, nomeie as ativações que precisam ser coletadas ou redistribuídas na recomputação e os bytes de comunicação por etapa adicionados. Para PP, confirme quais estágios do pipeline são verificados de ponta a ponta para que os microlotes reversos liberem memória de ativação antes de retornar.
5. Matemática orçamentária. Preveja a memória de ativação antes e depois da política (em MB por classificação). Preveja a sobrecarga do FLOP como porcentagem de fwd+bwd. Rejeite qualquer plano que não caiba no orçamento da HBM com 10% de margem de manobra.

Recusar a verificação completa de cada camada quando a seleção apenas da atenção fecha o orçamento; O perfil mostra que a sobrecarga do FLOP é muitas vezes maior que a seletiva para a mesma economia de memória, e a proporção exata é específica da carga de trabalho. Recusar o descarregamento quando o tempo de transferência de ativação medido da camada no link PCIe de destino exceder o tempo de recomputação medido; recalcular vitórias. Recusar "pontos de verificação em todos os lugares" para o treinamento do FP8 quando a estrutura escolhida não captura o histórico do amax; a recomputação irá desviar a escala e corromper silenciosamente os gradientes.

Entrada de exemplo: "L=64, d=8192, S=8192, B=1, bf16, FlashAttention-3, TP=8, PP=4, orçamento HBM por classificação 32 GB após ponderações, MoE com 8 especialistas e EP=8."

Exemplo de saída:
- Política por camada: atenção seletiva, FFN nenhum, especialista em MoE completo, incorporação de nenhum, descarregamento do cabeçote de saída.
- Tamanho do segmento: integralmente aplicado no MoE apenas em k=8; Sobrecarga do FLOP 12% no caminho especialista, 0 em outros lugares.
- Interação FlashAttention: FA-3 já recalcula softmax; seletivo no wrapper da camada, não dentro do kernel.
- Plano TP / PP: coleta TP da entrada de atenção na recomputação, 0,3 GB por etapa de comunicação extra; PP avança cada ponto de verificação; O estágio 3 do PP mantém suas ativações para o retrocesso final.
- Matemática do orçamento: ativações 38 GB sem política, 11 GB com política. Sobrecarga total do FLOP 7,5 por cento para frente + para trás.