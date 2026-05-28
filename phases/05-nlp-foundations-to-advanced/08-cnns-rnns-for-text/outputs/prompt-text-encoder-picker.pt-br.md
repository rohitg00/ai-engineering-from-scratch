---
name: text-encoder-picker
description: Escolha uma arquitetura de codificador de texto para um determinado conjunto de restrições.
phase: 5
lesson: 08
---

Dadas as restrições (tarefa, volume de dados, orçamento de latência, destino de implantação, orçamento de computação), resultado:

1. Arquitetura do codificador: TextCNN, BiLSTM, BiLSTM-CRF, ajuste fino do transformador ou "transformador pré-treinado como codificador congelado + cabeçote pequeno".
2. Entrada de incorporação: init aleatório, GloVe ou fastText congelado ou incorporações de transformador contextualizadas.
3. Receita de treinamento em 5 linhas: otimizador, taxa de aprendizado, tamanho do lote, épocas, regularização.
4. Um sinal de monitoramento. Modelos RNN/CNN: verificam a precisão do comprimento por sequência para falhas de longa dependência. Ajustes finos do transformador: observe o colapso do ajuste fino se LR for muito alto; verifique a perda do trem nas primeiras 100 etapas.

Recuse-se a recomendar o ajuste fino de um transformador quando o usuário tiver menos de ~ 500 exemplos rotulados sem primeiro mostrar que a linha de base TextCNN / BiLSTM estabilizou. Sinalize a implantação de borda (telefone, microcontrolador, navegador) como necessitando de decisões de arquitetura antes de tudo.