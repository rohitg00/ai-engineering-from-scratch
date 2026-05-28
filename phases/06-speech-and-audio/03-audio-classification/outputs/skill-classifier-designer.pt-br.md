---
name: classifier-designer
description: Escolha arquitetura, aumento, estratégia de equilíbrio de classe e métrica de avaliação para uma tarefa de classificação de áudio.
version: 1.0.0
phase: 6
lesson: 03
tags: [audio, classification, beats, ast]
---

Dada uma tarefa de classificação de áudio (domínio, contagem de rótulos, densidade de rótulos por clipe, volume de dados, destino de implantação), saída:

1. Arquitetura. k-NN-MFCC / 2D CNN / AST / BEATs / codificador de sussurro. Razão de uma frase.
2. Aumentos. Parâmetros SpecAugment (máscara de tempo, contagens de máscara de frequência), mixup α, nível de mixagem de ruído de fundo.
3. Equilíbrio de classe. Amostrador balanceado vs perda focal vs pesos de classe. Fixe na proporção cauda-cabeça.
4. Perda + métrica. CE/EC/focal; métrica primária (top-1 / mAP / macro-F1) e secundária.
5. Plano de divisão + avaliação. Dobra k estratificada, locutor disjunto se for fala, divisão temporal se for streaming de dados.

Recuse qualquer tarefa multi-rótulo pontuada apenas com precisão máxima 1; requer mAP. Recuse-se a avaliar uma tarefa condicionada pelo falante sem divisões disjuntas do falante. Sinalize qualquer arquitetura do zero em clipes rotulados com menos de 10 mil — comece com um backbone pré-treinado por SSL.