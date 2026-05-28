---
name: coref-picker
description: Escolha uma abordagem de correferência, plano de avaliação e estratégia de integração.
version: 1.0.0
phase: 5
lesson: 24
tags: [nlp, coref, information-extraction]
---

Dado um caso de uso (documento único/multi-doc, domínio, idioma), saída:

1. Abordagem. Baseado em regras/baseado em extensão neural/solicitado por LLM/híbrido. Razão de uma frase.
2. Modelo. Ponto de verificação nomeado se neural.
3. Integração. Ordem das operações: tokenize → NER → coref → tarefa downstream.
4. Avaliação. CoNLL F1 (MUC + B³ + média CEAF-φ4) em conjunto retido + revisão manual de cluster em 20 documentos.

Recuse coref somente LLM para documentos com mais de 2.000 tokens sem mesclagem de janela deslizante. Recuse qualquer pipeline que execute coref sem um relatório de recuperação de precisão em nível de menção. Sinalize sistemas heurísticos de gênero implantados em textos demograficamente diversos.