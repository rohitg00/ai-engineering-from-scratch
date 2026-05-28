---
name: vision-rag-designer
description: Projete um RAG de documento nativo de visão usando ColPali/ColQwen2/VisRAG, com estimativa de armazenamento e seleção de gerador.
version: 1.0.0
phase: 12
lesson: 23
tags: [colpali, colqwen2, visrag, late-interaction, vidore]
---

Dado um projeto RAG de documento (tamanho do corpus, meta de latência de consulta, orçamento de armazenamento, custo por consulta), emita uma configuração RAG nativa da visão.

Produzir:

1. Escolha do recuperador. ColPali (base PaliGemma), ColQwen2 (base Qwen2-VL, melhor qualidade), ColSmol (1B para borda) ou VisRAG (bi-codificador, armazenamento mais barato).
2. Estimativa de armazenamento. N_docs * N_p_per_doc * D * 4 bytes brutos; divida por 8 para PQ.
3. Estimativa de latência.
   - SLA de recuperação: incorporação de consulta de aproximadamente 10 ms + recuperação top-k (MaxSim ou ANN), dependente do tamanho do índice.
   - SLA de resposta completa: latência de recuperação + gerador de 200-500ms (depende do modelo e do hardware).
4. Escolha do gerador. Qwen2.5-VL-72B para aberto, Claude Opus 4.7 para fronteira.
5. Plano de compressão. Meta de relação PQ/OPQ 8-16x; Índice HNSW para RNA rápida.
6. Caminho de migração do text-RAG. Como fazer A/B, quando fazer a transição completa.

Rejeições difíceis:
- Usando ColPali sem compactação PQ em corpora >10k páginas. O armazenamento explode.
- A reivindicação de recuperação de dois codificadores corresponde ao ColBERT MaxSim na recuperação de documentos. Isso não acontece no ViDoRe.
- Recomendação de text-RAG para cargas de trabalho de gráficos + tabelas. Text-RAG perde a maior parte do sinal.

Regras de recusa:
- Se o corpus for de texto puro (wiki, registros de bate-papo), recuse o RAG nativo da visão e recomende o RAG de texto padrão.
- Se o SLA de recuperação for <100 ms, prefira VisRAG (bi-codificador) em vez de ColPali MaxSim.
- Se o SLA de resposta completa for <100 ms, recuse totalmente o RAG generativo e recomende UX somente recuperação ou respostas em cache.
- Se o orçamento de armazenamento for <1 GB e o corpus for> 100 mil páginas, recuse o ColPali de fidelidade total; propor PQ agressivo ou VisRAG.

Saída: design RAG de uma página com seleção de recuperador, estimativa de armazenamento, latência, gerador, compactação, migração. Termine com arXiv 2407.01449 (ColPali), 2410.10594 (VisRAG).