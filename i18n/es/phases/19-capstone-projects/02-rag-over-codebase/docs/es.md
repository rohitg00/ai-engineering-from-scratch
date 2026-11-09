# Capstone 02  RAG sobre la base de código (Búsqueda semántica en todo reporte)

> Cada organización de ingeniería seria en 2026 realiza una búsqueda interna de código que entiende el significado, no sólo las cadenas. Amp de fuente, respuestas de base de código de Cursor, gráfico de empresa de Augment, repomap de Aider, MCP interno de Pinterest  la misma forma. Ingerir muchos repos, analizar con el árbol-sitter, incrustar las piezas de nivel de función y clase, búsqueda híbrida, re-ranquear, responder con citas. Esta piedra angular le pide que construya una que maneje 2M líneas de código en 10 repos y sobrevive a la reindexación incremental en cada empurrón de git.

**Type:** Capstone
**Languages:** Python (ingestion), TypeScript (API + UI, retrieval scaffold)
**Prerequisites:** Phase 5 (NLP foundations), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 17 (infrastructure)
**Phases exercised:**P5 · P7 · P11 · P13 · P17
**Time:** 30 hours

## El problema

Para 2026, todos los agentes de codificación fronteriza envían una capa de recuperación de base de código porque las ventanas de contexto por sí solas no resuelven preguntas de intercambio. El contexto de 1M-token de Claude ayuda; no elimina la necesidad de obtener un ranking. La búsqueda ingenuo de cosinos sobre trozos de venenos en bruto resulta en el código generado, en la duplicación monorepo y en la cola larga de símbolos raramente importados. La respuesta de producción es una búsqueda híbrida (densa + BM25) sobre trozos conscientes de AST con un re-ranqueador, respaldado por un gráfico de referencias de símbolos.

Aprendes esto indexando una flota real  no un repos tutorial  y midiendo MRR@10, fidelidad de citación y frescura incremental. Los modos de falla son infraestructurales: un monorepo de archivo de 100k, un empuje que retuta la mitad de los archivos, una consulta que necesita cruzar cuatro repos para responder correctamente.

## Concepto

Un tubo de ingestión consciente de AST analiza cada archivo con tree-sitter, extrae funciones y nodos de clase, y trozos en los límites de nodos en lugar de ventanas fijas de tokens. Cada pieza obtiene tres representaciones: una incorporación densa (código Voyage-3 o código nomico-embed), términos escasos BM25 y un breve resumen de lenguaje natural. El resumen añade una tercera modalidad recuperable  los usuarios preguntan "cómo se autoriza X" y el resumen menciona "authz", incluso si el código sólo tiene `check_permission`¿ Qué ?

La recuperación es híbrida. Una consulta dispara tanto búsquedas densas como BM25, fusiona top-k y entrega la unión a un re-ranqueador de codificación cruzada (Cohere rerank-3 o bge-reranker-v2-gemma-2b). La lista re-ranqueada va a un sintetizador de contexto largo (Claude Sonnet 4.7 con caché rápido, o Llama 3.3 70B auto-hosted) con instrucciones para citar cada reclamo por archivo y rango de líneas. Las respuestas sin citas son rechazadas por un post-filtro.

La actualidad incremental es el problema de la infraestructura. Git push provoca una diferencia: qué archivos han cambiado, qué símbolos han cambiado. Sólo los trozos afectados se reincorporan. Los bordes de símbolos cruzados de archivos afectados (importaciones, llamadas de método) se recomputan. El índice se mantiene consistente sin reprocesar 2M líneas cada uno compromete.

## Arquitectura

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

## El establo

- Parsing: árbol-servidor con 17 gramáticas de lenguaje (Python, TS, Rust, Go, Java, C++, etc.)
- Embedings densos: Voyage-code-3 (hosted) o nomic-embed-code-v1.5 (autohost), bge-code-v1 fallback
- Indice de dispersión: Tantivy (Rust) con BM25F, ponderado por campo en nombre de símbolo vs cuerpo
- DB de vectores: Qdrant 1.12 con búsqueda híbrida, o pgvector + pgvector escala para equipos con vectores menores a 50M
- Modelo de resumen de piezas: Claude Haiku 4.5 o Gemini 2.5 Flash, almacenado en caché rápido
- Re-ranking: Cohere re-ranking-3 o bge-re-ranking-v2-gemma-2b auto-hosted
- Orquestación: LlamaIndex Flujos de trabajo para ingestión, LangGraph para agente de consulta
- Sintesis: Claude Sonnet 4.7 (1M contexto) con caché rápido
- Gráfico de símbolos: Neo4j (administrado) o kuzu (embedded) para bordes de importación y llamada
- Observabilidad: extensiones de la fusión de la membrana por etapa de extracción + síntesis

```figure
ce-hybrid-retrieval
```

## Construye el mismo

1. **Ingestion walker.**Iterar el historial de git en cada gancho de empuje. Recoger archivos cambiados. Para cada archivo, analizar con el árbol-sitter, extraer función y nodos de clase con su extensión de origen completa. Emite archivos de fragmentos`{repo, path, start_line, end_line, symbol, body}`¿ Qué ?

2. **Chunk summarizer.**Los lotes de piezas en Haiku 4.5 llamadas con caché rápido en el preámbulo del sistema. Prompt: "Resumir esta función en una frase, nombrando su contrato público y efectos secundarios". Almacenar resumen junto al pieza.

3. **Embedding pool.**Dos colas paralelas: densa (code de viaje-3 lote 128) y resumen (el mismo modelo, pero en la cadena de resumen).`{repo, path, start_line, end_line, symbol, kind}`¿ Qué ?

4. **BM25 index.**Indice de Tantivy ponderado por campo: peso del nombre del símbolo 4, peso del cuerpo del símbolo 1, peso resumen 2. Habilita las consultas "encuentra la función llamada X" junto con "encuentra la función que hace X".

5. **Symbol graph.**Para cada pieza, registran bordes: importaciones (este archivo utiliza el símbolo Y de repo Z), llamadas (esta función llama el método M en la clase C), herencia. Almacenar en kuzu. Se utiliza en el momento de la consulta para expandir la recuperación a través de los límites de repo.

6. **Query agent.**LangGraph con tres nodos.`retrieve`Fuego denso + BM25 en paralelo, deduplicado por (repo, camino, símbolo). `rerank`ejecuta el codificador cruzado en Top-50 y mantiene Top-10. `synth`llama a Claude Sonnet 4.7 con los trozos re-ranqueados en contexto, almacena el prompt del sistema, requiere citas de archivo: línea.

7. **Citation enforcement.**Analizar la salida del modelo; cualquier reclamación sin una `(repo/path:start-end)`El anclaje se marca para volver a preguntar o se deja de responder.

8. **Incremental re-index.**En cada conexión web, calcular la diferencia de nivel de símbolo. Sólo re-embed trozos cuyo texto cambió. Recomputar bordes de símbolo para trozos cuyas importaciones cambiaron. Medida: un 50 archivo de empuje re-indecciona en menos de 60 segundos para una flota de 2M-LOC.

9. **Eval.**Etiquetar 100 preguntas de referencia cruzada con archivo de oro: respuestas de línea. Medir MRR@10, nDCG@10, fidelidad de citación (fracción de reclamaciones con anclajes verificables) y latencia p50/p99.

## Usalo

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

## Envío

Habilidad de entrega `outputs/skill-codebase-rag.md`. Dado un corpus de repos, se muestra la línea de ingesta, el índice híbrido y el agente de consulta, y devuelve una respuesta citada para cualquier pregunta de repos.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Retrieval quality | MRR@10 and nDCG@10 on a 100-question held-out set |
| 20 | Citation faithfulness | Fraction of answer claims with verifiable file:line anchors |
| 20 | Latency and scale | p95 query latency at 10k QPS on the indexed corpus size |
| 20 | Incremental indexing correctness | Time from git push to searchable on a 50-file commit |
| 15 | UX and answer formatting | Citation clickability, snippet previews, follow-up affordance |
| **100** | | |

## Los ejercicios

1. Cambiar el código Voyage-3 por el código nominal integrado alojado en sí mismo. Medir el delta MRR@10. Informar si la brecha se cierra con la re-ranking habilitada.

2. Inyectar el 20% de código generado (caldalizador de LLM) en el corpus y volver a evaluar. Observar la intoxicación de recuperación. Agregar una bandera "generada" a la carga útil y reducir el peso de esos golpes.

3. Indique la búsqueda híbrida Qdrant vs pgvector + pgvector escala en su tamaño de cuerpo.

4. Añadir una verificación de derivación basada en muestras: semanalmente, repetir la evaluación de 100 preguntas.

5. Extensión a resolución de símbolos interlinguísticos: una función Python que llama a un servicio Go sobre gRPC. Utilice el gráfico de símbolos para vincularlos.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AST-aware chunking | "Function-level splits" | Cutting code at tree-sitter node boundaries instead of fixed token windows |
| Hybrid search | "Dense + sparse" | Run BM25 and vector search in parallel, merge top-k, rerank |
| Cross-encoder rerank | "Second-stage rank" | Model that scores each (query, candidate) pair together, more accurate than cosine |
| Prompt caching | "Cached system prompt" | 2026 Claude / OpenAI feature that discounts repeat prefix tokens up to 90% |
| Symbol graph | "Code graph" | Edges for imports, calls, inheritance across files and repos |
| Citation faithfulness | "Grounded answer rate" | Fraction of claims a user can verify by clicking the anchor and reading the referenced span |
| Incremental re-index | "Push-to-search time" | Wall-clock from git push to the changed symbols being queryable |

## Leer más

- [Sourcegraph Amp](https://ampcode.com) Inteligencia de código de producción entre los diferentes países
- [Sourcegraph Cody RAG architecture](https://sourcegraph.com/blog/how-cody-understands-your-codebase) el buceo profundo de referencia para esta piedra angular
- [Aider repo-map](https://aider.chat/docs/repomap.html) Vista de repos clasificado para el árbol
- [Augment Code enterprise graph](https://www.augmentcode.com) símbolo comercial-grafo RAG
- [Qdrant hybrid search docs](https://qdrant.tech/documentation/concepts/hybrid-queries/) Implementación de referencia
- [Voyage AI code embeddings](https://docs.voyageai.com/docs/embeddings) Detalles del código de viaje-3
- [Cohere rerank-3](https://docs.cohere.com/reference/rerank) Referencia de codificación cruzada
- [Pinterest MCP internal search](https://medium.com/pinterest-engineering) Referencia interna de la plataforma
