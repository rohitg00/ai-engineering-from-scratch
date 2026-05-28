---
name: nli-picker
description: Escolha um modelo NLI, um modelo de rótulo e uma configuração de avaliação para uma tarefa de classificação/fidelidade/zero-shot.
version: 1.0.0
phase: 5
lesson: 21
tags: [nlp, nli, zero-shot]
---

Dado um caso de uso (verificação de fidelidade, classificação zero-shot, inferência em nível de documento), resultado:

1. Modelo. Nomeado ponto de verificação NLI. Razão ligada ao domínio, comprimento, idioma.
2. Modelo (se for zero-shot). Padrão de verbalização. Exemplo.
3. Limiar. Limite de implicação para a regra de decisão. Razão baseada na calibração.
4. Avaliação. Precisão em conjunto rotulado mantido, linha de base apenas de hipótese, subconjunto adversário.

Recuse-se a enviar classificação zero-shot sem uma verificação de sanidade rotulada com 100 exemplos. Recuse-se a usar um modelo NLI em nível de frase em premissas de tamanho de documento. Sinalize qualquer alegação de que a NLI resolve a alucinação – ela a reduz; isso não o elimina.