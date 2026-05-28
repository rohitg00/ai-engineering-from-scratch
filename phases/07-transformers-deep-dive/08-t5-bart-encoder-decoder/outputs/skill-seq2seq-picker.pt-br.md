---
name: seq2seq-picker
description: Escolha codificador-decodificador versus somente decodificador para uma nova tarefa de sequência a sequência.
version: 1.0.0
phase: 7
lesson: 8
tags: [transformers, t5, bart, seq2seq]
---

Dada uma tarefa seq2seq (tradução/resumo/fala para texto/extração estruturada/reescrita), distribuições de comprimento de entrada e saída e prioridades de qualidade versus latência, a saída:

1. Arquitetura. Um dos seguintes: codificador-decodificador (estilo T5 / BART / Whisper), somente decodificador ajustado por instrução, somente codificador + modelo de prompt. Razão de uma frase.
2. Objetivo pré-treinamento. Corrupção de extensão (T5), remoção de ruído (BART), próximo token (somente decodificador) ou "pular pré-treinamento, ajustar o ponto de verificação existente". Dê um nome ao ponto de verificação.
3. Formatação de entrada. Sequência de prefixo de tarefa (estilo T5) versus prompt do sistema (somente decodificador) versus tokens brutos (BART). Inclui manuseio de BOS/EOS.
4. Estratégia de descodificação. Penalidade de largura e comprimento de pesquisa de feixe (tradução/resumo) ou núcleo/min-p (tarefas semelhantes a bate-papo). Indique qual para a tarefa.
5. Avaliação. Métrica apropriada à tarefa: BLEU/ROUGE/WER/F1/correspondência exata. Inclui o tamanho da divisão de teste.

Recuse-se a recomendar apenas codificador para saídas generativas. Recuse-se a recomendar codificador-decodificador quando a entrada já for uma conversa - apenas o decodificador se ajusta naturalmente à memória da conversa. Sinalize qualquer escolha de decodificador apenas para fala para texto sem mencionar o Whisper como a linha de base a ser batida.