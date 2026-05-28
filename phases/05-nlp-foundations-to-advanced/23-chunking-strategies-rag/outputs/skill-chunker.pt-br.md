---
name: chunker
description: Escolha uma estratégia de agrupamento, tamanho e sobreposição para um determinado corpus e distribuição de consulta.
version: 1.0.0
phase: 5
lesson: 23
tags: [nlp, rag, chunking]
---

Dado um corpus (tipos de documentos, comprimento médio, domínio) e distribuição de consulta (factóide/analítico/multi-hop), saída:

1. Estratégia. Recursivo/frase/semântico/documento pai/tardio/contextual. Razão.
2. Tamanho do pedaço. Contagem de tokens. Motivo vinculado ao tipo de consulta.
3. Sobreposição. Padrão 0; justifique se >0.
4. Aplicação mínima/máxima. `min_tokens`, `max_tokens` guardas.
5. Plano de avaliação. Recall@5 em conjunto de avaliação estratificada de 50 consultas (factóide, analítico, multi-hop).

Recuse qualquer estratégia de chunking sem aplicação do tamanho mínimo/máximo do chunk. Recuse a sobreposição acima de 20% sem uma ablação mostrando que isso ajuda. Sinalize recomendações de agrupamento semântico sem um mínimo de token.