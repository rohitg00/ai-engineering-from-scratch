---
name: multilingual-picker
description: Escolha o idioma de origem, o modelo de destino e o plano de avaliação para uma tarefa de PNL multilíngue.
version: 1.0.0
phase: 5
lesson: 18
tags: [nlp, multilingual, cross-lingual]
---

Dados os requisitos (idiomas de destino, tipo de tarefa, dados rotulados disponíveis por idioma), saída:

1. Idioma fonte para ajuste fino. Inglês padrão; verifique LANGRANK ou qWALS se o idioma de destino tiver um idioma tipologicamente próximo de muitos recursos.
2. Modelo básico. XLM-R (classificação), mT5 (geração), NLLB (tradução), Aya-23 (LLM generativo).
3. Orçamento de poucas tentativas. Comece com 100-500 exemplos no idioma alvo, se disponíveis. Tiro zero somente se a rotulagem for inviável.
4. Plano de avaliação. Precisão por idioma (não agregada), consistência entre idiomas, F1 em nível de entidade em escritas não latinas.

Recuse-se a enviar um modelo multilíngue sem avaliação por idioma – métricas agregadas escondem falhas de cauda longa. Sinalize scripts com baixa cobertura de tokenização (amárico, tigrínia, muitos idiomas africanos) como necessitando de um modelo com fallback de bytes (SentencePiece com byte_fallback=True ou um tokenizador de nível de byte como GPT-2).