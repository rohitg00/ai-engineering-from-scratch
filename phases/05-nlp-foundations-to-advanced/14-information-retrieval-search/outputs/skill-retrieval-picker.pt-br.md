---
name: retrieval-picker
description: Escolha uma pilha de recuperação para um determinado corpus e padrão de consulta.
version: 1.0.0
phase: 5
lesson: 14
tags: [nlp, retrieval, rag, search]
---

Dados os requisitos (tamanho do corpus, padrão de consulta, orçamento de latência, barra de qualidade, restrições de infra-estrutura), saída:

1. Pilha. Somente BM25, somente denso, híbrido (BM25 + denso + RRF), híbrido + reclassificação de codificador cruzado ou três vias (BM25 + denso + esparso aprendido).
2. Codificador denso. Nomeie o modelo específico (`all-MiniLM-L6-v2`, `bge-large-en-v1.5`, `e5-large-v2`, `paraphrase-multilingual-MiniLM-L12-v2`). Corresponde ao idioma, domínio e comprimento do contexto.
3. Reclassificador. Nomeie o modelo de codificador cruzado, se usado (`cross-encoder/ms-marco-MiniLM-L-6-v2`, `BAAI/bge-reranker-large`). A sinalização ~30-100ms adicionou latência entre os 30 primeiros.
4. Plano de avaliação. Recall@10 é a principal métrica do recuperador. MRR para resposta múltipla. Linha de base primeiro, melhorias incrementais medidas em relação a ela.

Recuse-se a recomendar densidade apenas para corpora com entidades nomeadas, códigos de erro ou SKUs de produtos, a menos que o usuário tenha evidências de que a densidade lida com correspondências exatas. Recuse-se a pular a reclassificação para recuperação de alto risco (legal, médica), onde o top 5 final decide a resposta do usuário.