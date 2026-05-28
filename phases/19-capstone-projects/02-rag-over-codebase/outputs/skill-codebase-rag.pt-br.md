---
name: codebase-rag
description: Crie um sistema de pesquisa semântica entre repositórios com chunking compatível com AST, recuperação híbrida, reindexação incremental e respostas citadas.
version: 1.0.0
phase: 19
lesson: 02
tags: [capstone, rag, code-search, tree-sitter, qdrant, bm25, hybrid-retrieval]
---

Dados mais de 10 repositórios, totalizando pelo menos 2 milhões de linhas de código, crie um pipeline de ingestão, um índice híbrido e um agente de consulta com aplicação de citação que responda a perguntas entre repositórios com âncoras file:line verificáveis.

Plano de construção:

1. Analise cada arquivo com o tree-sitter. Pedaço nos limites dos nós de função e classe. Armazene `{repo, path, start_line, end_line, symbol, body}`.
2. Resuma cada parte com Claude Haiku 4.5 ou Gemini 2.5 Flash usando prompts do sistema armazenados em cache. Armazene o resumo de uma frase próximo ao pedaço.
3. Índice em três estruturas: Qdrant (denso, Voyage-code-3 ou nomic-embed-code), Tantivy (BM25 com pesos de campo) e kuzu (arestas de gráfico de símbolos para importações, chamadas, herança).
4. Construa um agente de consulta LangGraph com três nós: recuperação (BM25 paralelo denso), reclassificação (Cohere rerank-3 ou bge-reranker-v2-gemma-2b), sintetizador (Claude Sonnet 4.7 com cache de prompt e requisito de citação de arquivo: linha).
5. Pós-filtro: rejeita qualquer reclamação sem uma âncora `(repo/path:start-end)` verificável; pergunte novamente ou desista.
6. Conecte um webhook git push que calcula uma diferença de nível de símbolo e incorpora novamente apenas os pedaços alterados. Alvo: commit de 50 arquivos pesquisáveis ​​em menos de 60 anos em uma frota 2M-LOC.
7. Avalie com um conjunto de 100 perguntas. Relatório MRR@10, nDCG@10, fidelidade de citação e percentis de latência.
8. Execute um trabalho de desvio semanal que reexecuta a avaliação e alerta sobre queda de MRR@10 > 5%.

Rubrica de avaliação:

| Peso | Critério | Medição |
|:-:|---|---|
| 25 | Qualidade de recuperação | MRR@10 e nDCG@10 em um conjunto de 100 perguntas |
| 20 | Fidelidade de citação | Fração de reivindicações de resposta com âncoras file:line verificáveis ​​|
| 20 | Latência e escala | Latência de consulta p95 a 10k QPS no tamanho do corpus indexado |
| 20 | Correção de indexação incremental | Tempo desde git push até pesquisável em um commit de 50 arquivos |
| 15 | UX e formatação de respostas | Clicabilidade de citações, visualizações de snippets, recursos de acompanhamento |

Rejeições difíceis:

- Segmentação de token de tamanho fixo em vez de fragmentação com reconhecimento de AST. Envenenará corpora com muitos códigos gerados.
- Recuperação apenas de cosseno sem BM25 ou reclassificação. Conhecido por falhar em consultas de nome de símbolo exato.
- Respostas sem citações obrigatórias de arquivo:linha.
- Reincorporação completa do corpus em cada git push; deve ser incremental.

Regras de recusa:

- Recuse-se a indexar repositórios sem ler sua licença. Alguns proíbem a incorporação em lojas de vetores de terceiros.
- Recuse-se a responder perguntas que alegam citar arquivos que o índice nunca viu; sempre verifique a âncora antes de retornar.
- Recuse-se a entregar uma resposta em p95 acima de 4s; retornar um resultado parcial com um identificador de acompanhamento.

Saída: um repositório contendo o pipeline de ingestão, o agente de consulta LangGraph, o conjunto de avaliação rotulado de 100 perguntas, um link do painel Langfuse e um artigo nomeando os três modos de falha de recuperação que você corrigiu (envenenamento de código gerado, recuperação de símbolo de cauda longa, resolução de símbolo de repositório cruzado) e a alteração exata que corrigiu cada um.