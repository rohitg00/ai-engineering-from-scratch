# Capstone 02  RAG sobre base de código (Cross-Repo Semantic Search)

> Todas as organizações de engenharia serias em 2026 executam uma busca interna de código que entende o significado, não apenas as cordas. Amp de fonte, respostas base de código do Cursor, gráfico de empresa do Augment, repomap de Aider, MCP interno do Pinterest  a mesma forma. Ingerir muitos repos, analisar com árvore-servidor, incorporar funções e classes de nível, busca híbrida, re-ranquear, responder com citações. Esta pedra final pede-lhe para construir um que lida com 2 milhões de linhas de código em 10 repos e sobrevive a re-indexação incremental em cada empurrão de git.

**Type:** Capstone
**Languages:** Python (ingestion), TypeScript (API + UI, retrieval scaffold)
**Prerequisites:** Phase 5 (NLP foundations), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 17 (infrastructure)
**Phases exercised:**P5 · P7 · P11 · P13 · P17
**Time:** 30 hours

## Problemas

Até 2026, todos os agentes de codificação de fronteira enviam uma camada de recuperação de base de código porque as janelas de contexto sozinhas não resolvem questões de reposição cruzada. O contexto de 1M-token de Claude ajuda; não elimina a necessidade de recuperação de classificação. Uma busca ingênua por tóxicos em pedaços brutos resulta em código gerado, duplicação monorepo e na cauda longa de símbolos raramente importados. A resposta de produção é uma busca híbrida (densa + BM25) sobre pedaços conscientes de AST com um re-ranqueador, apoiado por um gráfico de referências de símbolos.

Você aprende isso indexando uma frota real  não um repo tutorial  e medindo MRR@10, fidelidade de citação e frescura incremental. Os modos de falha são infraestruturais: um monorepo de arquivo de 100k, um empurrão que retouche metade dos arquivos, uma consulta que precisa cruzar quatro repos para responder corretamente.

## Conceptos

Um pipeline de ingestão consciente da AST analisa cada arquivo com um árvore-servidor, extrai funções e nós de classe e pedaços em limites de nós em vez de janelas fixas de tokens. Cada peça recebe três representações: um embebed denso (Voyage-code-3 ou nomic-embed-code), termos raros BM25 e um breve resumo de linguagem natural. O resumo adiciona uma terceira modalidade recuperável  os usuários perguntam "como é autorizado X" e o resumo menciona "authz", mesmo que o código tenha apenas `check_permission`- Não .

A recuperação é híbrida. Uma consulta dispara tanto pesquisas densas quanto BM25, funde top-k e entrega a união a um re-ranqueador de codificação cruzada (Cohere rerank-3 ou bge-reranker-v2-gemma-2b). A lista re-rancada vai para um sintetizador de longo contexto (Claude Sonnet 4.7 com cache rápido, ou Llama 3.3 70B auto-hosted) com instruções para citar cada reivindicação por arquivo e faixa de linha. As respostas sem citações são rejeitadas por um post-filtro.

A frescura incremental é o problema da infraestrutura. O empurrão Git desencadeia uma diferença: quais arquivos mudaram, quais símbolos mudaram. Somente os blocos afetados são re-embedados. As bordas afetadas do símbolo de arquivo cruzado (importações, chamadas de método) são recomputadas. O índice permanece consistente sem reprocessar 2M linhas cada um compromete.

## Arquitetura

```
git push --> webhook --> ingest worker (LlamaIndex Workflow)
                           |
                           v
             tree-sitter parse + AST chunk
                           |
            +--------------+----------------+
            v              v                v
          dense        BM25 index       summary (LLM)
        (Voyage / bge)  (Tantivy)        (Haiku 4.5)
            |              |                |
            +------> Qdrant / pgvector <----+
                            |
                            v
                      symbol graph (Neo4j / kuzu)
                            |
  query --> LangGraph agent (retrieve -> rerank -> synth)
                            |
                            v
                 Claude Sonnet 4.7 1M context
                            |
                            v
                 answer + file:line citations
```

## Estaca

- Parsing: árvore-servidora com 17 gramáticas linguísticas (Python, TS, Rust, Go, Java, C++, etc.)
- Embedings densos: Voyage-code-3 (hosted) ou nomic-embed-code-v1.5 (autohost), bge-code-v1 fallback
- Indice de escassez: Tantivy (Rust) com BM25F, ponderado em campo em nome de símbolo vs corpo
- DB vetorial: Qdrant 1.12 com busca híbrida, ou pgvector + pgvector escala para equipes com menos de 50M vetores
- Modelo de resumo de pedaços: Claude Haiku 4.5 ou Gemini 2.5 Flash, em cache imediato
- Re-ranking: Cohere re-ranking-3 ou bge-re-ranking-v2-gemma-2b auto-hosted
- Orquestração: LlamaIndex Fluxos de trabalho para ingestão, LangGraph para agente de consulta
- Sintetizador: Claude Sonnet 4.7 (1M contexto) com cache rápido
- Gráfico de símbolos: Neo4j (gerido) ou kuzu (embedded) para bordas de importação e chamada
- Observabilidade: Espasso de extensão da fusão de luz por etapa de recuperação + síntese

```figure
ce-hybrid-retrieval
```

## Construí-lo

1. **Ingestion walker.**Iterar o histórico de git em cada gancho de empurrão. Coletar arquivos alterados. Para cada arquivo, análise com árvore-servidor, extrair função e nós de classe com a sua extensão de fonte completa. Emitir registros de pedaços `{repo, path, start_line, end_line, symbol, body}`- Não .

2. **Chunk summarizer.**Batch chunks em Haiku 4.5 chamadas com cache imediato no preâmbulo do sistema. Prompt: "Resumir esta função em uma frase, nomeando seu contrato público e efeitos colaterais".

3. **Embedding pool.**Duas fileiras paralelas: densa (code de viagem-3 lote 128) e resumo (o mesmo modelo, mas na cadeia de resumo).`{repo, path, start_line, end_line, symbol, kind}`- Não .

4. **BM25 index.**Índice Tantivy ponderado em campo: peso do nome do símbolo 4, peso do corpo do símbolo 1, peso resumido 2. Permite "encontrar a função chamada X" junto com "encontrar a função que faz X".

5. **Symbol graph.**Para cada peça, grava bordas: importações (este arquivo usa o símbolo Y do repo Z), chamadas (esta função chama o método M na classe C), herança. Armazenar em kuzu. Usado no momento da consulta para expandir a recuperação através das fronteiras do repo.

6. **Query agent.**LangGraph com três nós.`retrieve`fogos densos + BM25 em paralelo, deduplicados por (repo, caminho, símbolo). `rerank`Ele corre o cross-encoder no top-50 e mantém o top-10.`synth`liga Claude Sonnet 4.7 com os blocos re-ranqueados no contexto, cache o prompt do sistema, requer citações de arquivo: linha.

7. **Citation enforcement.**Analisar a saída do modelo; qualquer reivindicação sem um `(repo/path:start-end)`O ancor é marcado para re-pedir ou ser retirado.

8. **Incremental re-index.**Em cada webhook, calcular a diferença de nível de símbolo. Apenas re-embed blocos cujo texto mudou. Reconta as bordas de símbolo para blocos cujas importações mudaram. Medida: um empurrão de 50 arquivos re-indexado em menos de 60 segundos para uma frota 2M-LOC.

9. **Eval.**Etiquetar 100 perguntas de repórter cruzado com arquivo ouro: respostas de linha. Medir MRR@10, nDCG@10, fidelidade de citação (fracção de alegações com ancoramentos verificáveis) e latência p50/p99.

## Usá-lo

```
$ code-rag ask "how is S3 multipart abort wired into our retry budget?"
[retrieve]  12 chunks dense + 7 chunks bm25, 16 unique after dedup
[rerank]    top-5 kept (cohere rerank-3)
[synth]     claude-sonnet-4.7, cache hit rate 68%, 2.1s
answer:
  Multipart aborts are triggered by `AbortMultipartOnFail` in
  services/uploader/retry.go:122-148, which decrements the per-bucket
  retry budget defined in config/budgets.yaml:34-51 ...
  citations: [services/uploader/retry.go:122-148, config/budgets.yaml:34-51,
              libs/s3client/multipart.ts:44-61]
```

## Envia-o

Habilidade de entrega .`outputs/skill-codebase-rag.md`- Dado um corpus de repó, ele apresenta o pipeline de ingestão, o índice híbrido e o agente de consulta e retorna uma resposta citada para qualquer pergunta de repó.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Retrieval quality | MRR@10 and nDCG@10 on a 100-question held-out set |
| 20 | Citation faithfulness | Fraction of answer claims with verifiable file:line anchors |
| 20 | Latency and scale | p95 query latency at 10k QPS on the indexed corpus size |
| 20 | Incremental indexing correctness | Time from git push to searchable on a 50-file commit |
| 15 | UX and answer formatting | Citation clickability, snippet previews, follow-up affordance |
| **100** | | |

## Exercícios

1. Troque o código Voyage-3 para o código nomico-embed auto-hosted. Messa o delta MRR@10. Relate se a lacuna se fecha com a re-ranking habilitada.

2. Injecte o código gerado de 20% (boilerplate produzido por LLM) no corpus e reavalie. Observe envenenamento de recuperação. Adicione uma bandeira "gerada" à carga útil e reduzir o peso desses hits.

3. Indicar a busca híbrida Qdrant versus pgvector + pgvectorscale no seu tamanho de corpus.

4. Adicionar uma verificação de deriva baseada em amostragem: semanalmente, repetir a avaliação de 100 perguntas.

5. Extenda para resolução de símbolos interlinguários: uma função Python que chama um serviço Go sobre gRPC. Use o gráfico de símbolos para ligá-los.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AST-aware chunking | "Function-level splits" | Cutting code at tree-sitter node boundaries instead of fixed token windows |
| Hybrid search | "Dense + sparse" | Run BM25 and vector search in parallel, merge top-k, rerank |
| Cross-encoder rerank | "Second-stage rank" | Model that scores each (query, candidate) pair together, more accurate than cosine |
| Prompt caching | "Cached system prompt" | 2026 Claude / OpenAI feature that discounts repeat prefix tokens up to 90% |
| Symbol graph | "Code graph" | Edges for imports, calls, inheritance across files and repos |
| Citation faithfulness | "Grounded answer rate" | Fraction of claims a user can verify by clicking the anchor and reading the referenced span |
| Incremental re-index | "Push-to-search time" | Wall-clock from git push to the changed symbols being queryable |

## Mais leitura

- [Sourcegraph Amp](https://ampcode.com) Informação sobre o código de produção
- [Sourcegraph Cody RAG architecture](https://sourcegraph.com/blog/how-cody-understands-your-codebase) o mergulho profundo de referência para esta pedra de captação
- [Aider repo-map](https://aider.chat/docs/repomap.html) Vista de repo classificada por árvore
- [Augment Code enterprise graph](https://www.augmentcode.com) símbolo comercial-grafo RAG
- [Qdrant hybrid search docs](https://qdrant.tech/documentation/concepts/hybrid-queries/) Implementação de referência
- [Voyage AI code embeddings](https://docs.voyageai.com/docs/embeddings) Detalhes do código de viagem-3
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank) Referência de codificadores cruzados
- [Pinterest MCP internal search](https://medium.com/pinterest-engineering) Referência interna da plataforma
