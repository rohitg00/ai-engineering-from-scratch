---
name: preference-loss-selector
description: Recomende uma perda de algoritmo de alinhamento direto, dada a forma do conjunto de dados e o estágio de destino.
version: 1.0.0
phase: 18
lesson: 3
tags: [dpo, ipo, kto, simpo, orpo, bpo, daa, preference-optimization]
---

Dada uma descrição do conjunto de dados de preferência (emparelhado versus não pareado, distribuição de força de preferência, distribuição de comprimento, tamanho) e uma meta de treinamento (um estágio da base, dois estágios após SFT, continuação de acordo com a política), recomende uma perda da família DPO e nomeie o modo de falha único contra o qual ela protege.

Produzir:

1. Impressão digital do conjunto de dados. Emparelhado? Não pareado? Equilibrado em comprimento? Variância de força de preferência? Principalmente em distribuição ou domínio aberto? Escolha os 4 campos mais informativos para este conjunto de dados.
2. Recomendação de perda. De {DPO, IPO, KTO, SimPO, ORPO, BPO}. Um primário e um substituto. Para cada um, nomeie o modo de falha específico contra o qual ele protege neste conjunto de dados.
3. Padrões de hiperparâmetros. `beta` para métodos ancorados, margem `gamma` para SimPO, `lambda` para ORPO. Sempre cite-os como pontos de partida para uma varredura, nunca como valores finais.
4. Sinais de alerta nos dados. Se as forças de preferência forem perfeitamente uniformes, os métodos da família DPO perdem seu sinal aos pares - recomendamos a coleta de preferências calibradas. Se a média de `|y_w| / |y_l|` desviar > 1,5, sinalize a tendência de comprimento e empurre em direção ao SimPO.

Rejeições difíceis:
- Qualquer alegação de que o DPO (ou qualquer membro da família) “escapa de Goodhart”. Rafailov et al. (NeurIPS 2024) provam que os algoritmos de alinhamento direto otimizam demais o mesmo formato da curva de recompensa de ouro que o RM RLHF explícito.
- Qualquer recomendação que não especifique a avaliação de capacidade mantida juntamente com a avaliação de preferência. Algoritmos de alinhamento direto ainda precisam de benchmarks de sinal dourado.
- Qualquer alegação de que métodos livres de política de referência (SimPO, ORPO) “não precisam de regularização”. O prazo ou penalidade de duração semelhante ao SFT é o regularizador.

Regras de recusa:
- Se o conjunto de dados for menor que 5 mil pares e o usuário tiver como alvo um modelo em escala de fronteira, recuse e recomende a expansão do conjunto de dados ou o uso de uma abordagem SFT-first.
- Se o usuário solicitar "a melhor" perda, recuse e explique que não existe nenhum vencedor em formato fechado - o método correto depende do formato e da tarefa do conjunto de dados.

Resultado: uma recomendação de uma página listando a impressão digital do conjunto de dados, perda primária e substituta, hiperparâmetros iniciais e sinais de alerta. Cite DPO (arXiv:2305.18290) e um outro documento familiar (IPO, KTO, SimPO, ORPO ou BPO) exatamente uma vez cada.