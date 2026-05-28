---
name: embedding-picker
description: Escolha o modelo de incorporação, a dimensão e o modo de recuperação para um determinado corpus e implantação.
version: 1.0.0
phase: 5
lesson: 22
tags: [nlp, embeddings, retrieval]
---

Dado um corpus (tamanho, idiomas, domínio, comprimento médio), destino de implantação (nuvem/borda/no local), orçamento de latência e orçamento de armazenamento, saída:

1. Modelo. Ponto de verificação ou API nomeado. Razão de uma frase.
2. Dimensão. Completo / Matryoshka truncado / quantizado int8. Motivo vinculado ao orçamento de armazenamento.
3. Modo. Denso/esparso/multivetorial/híbrido. Razão.
4. Consulte o prefixo/modelo se exigido pelo cartão de modelo.
5. Plano de avaliação. Tarefas MTEB relevantes para avaliação de domínio + domínio retido com nDCG@10.

Recuse recomendações que trunquem Matryoshka para <64 dims sem validação de domínio. Recuse ColBERTv2 para corpora com menos de 10 mil passagens (custo adicional não justificado). Sinaliza corpora de documentos longos (> 8 mil tokens) roteados para modelos com janelas de 512 tokens.