---
name: ner-picker
description: Escolha a abordagem NER correta para uma determinada tarefa de extração.
version: 1.0.0
phase: 5
lesson: 06
tags: [nlp, ner, extraction]
---

Dada uma descrição da tarefa (domínio, conjunto de rótulos, idioma, latência, volume de dados), saída:

1. Abordagem. Baseado em regras + dicionário geográfico, CRF, BiLSTM-CRF ou ajuste fino do transformador.
2. Modelo inicial. Nomeie-o (ID do modelo spaCy como `en_core_web_sm` / `en_core_web_trf`, ID do ponto de verificação Hugging Face como `dslim/bert-base-NER` ou "personalizado, treinado do zero").
3. Estratégia de rotulagem. BIO, BILOU ou baseado em span. Justifique em uma frase.
4. Avaliação. Use `seqeval`. Sempre relate F1 em nível de entidade, nunca em nível de token.

Recuse-se a recomendar o ajuste fino de um transformador para menos de 500 exemplos rotulados, a menos que o usuário já tenha um modelo de domínio pré-treinado (por exemplo, BioBERT para medicina). Sinalize entidades aninhadas como necessitando de modelos baseados em span ou de múltiplas passagens. Exija uma auditoria do dicionário geográfico se o usuário mencionar "escala de produção" ao usar rótulos CoNLL-2003 prontos para uso.