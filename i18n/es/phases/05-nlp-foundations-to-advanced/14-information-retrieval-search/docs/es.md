# Recuperación y búsqueda de información

> BM25 es preciso pero frágil. Denso lanza una red amplia pero se pierden palabras clave. Hybrid es el estándar de 2026. Todo lo demás está sintonizado.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## El problema

El usuario escribe "qué sucede si alguien miente para obtener dinero" y espera encontrar el estatuto que realmente cubre eso: "Sección 420 IPC". Una búsqueda de palabras clave se pierde por completo (no hay vocabulario compartido). Una búsqueda semántica se pierde si los embebidos no fueron entrenados en texto legal.

IR es el tubo bajo cada sistema RAG, cada barra de búsqueda, cada búsqueda de documentos. La arquitectura 2026 que funciona en la producción no es un solo método. Es una cadena de métodos complementarios, cada uno de los cuales atrapa los fallos de la anterior.

Esta lección construye cada pieza y nombres que fracasan cada captura.

## El concepto

![Hybrid retrieval: BM25 + dense + RRF + cross-encoder rerank](../assets/retrieval.svg)

Cuatro capas, escoge las que necesites.

1. **Sparse retrieval (BM25).**Rápido, preciso en las coincidencias exactas, terrible en la semántica, ejecuta un índice invertido, sub-10ms por consulta en millones de documentos, te da referencias de estatuto, códigos de producto, mensajes de error, entidades nombradas correctamente.
2. **Dense retrieval.**Encode la consulta y los documentos en vectores. búsqueda de vecino más cercano. Captura parafrases y similitud semántica. Se pierden coincidencias exactas de palabras clave que difieren por un carácter. 50-200 ms por consulta con FAISS o un vector DB.
3. **Fusion.**Combine las listas clasificadas de escasas y densas. La fusión de rango recíproco (RRF) es el estándar fácil porque ignora las puntuaciones en bruto (que viven en diferentes escalas) y solo utiliza posiciones de rango. La fusión ponderada es una opción cuando sabes que una señal domina para tu dominio.
4. **Cross-encoder rerank.**Tome el top-30 de la fusión. ejecuta un codificador cruzado (queriendo + documento juntos, anotando cada par). Mantenga el top-5. Los codificadores cruzados son más lentos por par que los bi-coders pero mucho más precisos.

La recuperación de tres vías (BM25 + denso + espacio aprendido como SPLADE) supera a dos vías en los índices de referencia de 2026, pero necesita infraestructura para los índices de espacio aprendido.

```figure
gx-hybrid-retrieval
```

## Construye el mismo

### Paso 1: BM25 desde cero

```python
import math
import re
from collections import Counter

TOKEN_RE = re.compile(r"[a-z0-9]+")


def tokenize(text):
    return TOKEN_RE.findall(text.lower())


class BM25:
    def __init__(self, corpus, k1=1.5, b=0.75):
        if not corpus:
            raise ValueError("corpus must not be empty")
        self.corpus = [tokenize(d) for d in corpus]
        self.k1 = k1
        self.b = b
        self.n_docs = len(self.corpus)
        self.avg_dl = sum(len(d) for d in self.corpus) / self.n_docs
        self.df = Counter()
        for doc in self.corpus:
            for term in set(doc):
                self.df[term] += 1

    def idf(self, term):
        n = self.df.get(term, 0)
        return math.log(1 + (self.n_docs - n + 0.5) / (n + 0.5))

    def score(self, query, doc_idx):
        q_tokens = tokenize(query)
        doc = self.corpus[doc_idx]
        dl = len(doc)
        freq = Counter(doc)
        score = 0.0
        for term in q_tokens:
            f = freq.get(term, 0)
            if f == 0:
                continue
            numerator = f * (self.k1 + 1)
            denominator = f + self.k1 * (1 - self.b + self.b * dl / self.avg_dl)
            score += self.idf(term) * numerator / denominator
        return score

    def rank(self, query, top_k=10):
        scored = [(self.score(query, i), i) for i in range(self.n_docs)]
        scored.sort(reverse=True)
        return scored[:top_k]
```

Dos parámetros que vale la pena conocer.`k1=1.5`control de saturación de la frecuencia de término; mayor significa más peso en la repetición de término. `b=0.75`El número 0 ignora la longitud del documento, el número 1 normaliza completamente.

### Paso 2: Recuperación densa con un bi-encodor

```python
from sentence_transformers import SentenceTransformer
import numpy as np


def build_dense_index(corpus, model_id="sentence-transformers/all-MiniLM-L6-v2"):
    encoder = SentenceTransformer(model_id)
    embeddings = encoder.encode(corpus, normalize_embeddings=True)
    return encoder, embeddings


def dense_search(encoder, embeddings, query, top_k=10):
    q_emb = encoder.encode([query], normalize_embeddings=True)
    sims = (embeddings @ q_emb.T).flatten()
    order = np.argsort(-sims)[:top_k]
    return [(float(sims[i]), int(i)) for i in order]
```

L2-normalizar las incorporaciones de modo que el producto punto es igual a cosino. `all-MiniLM-L6-v2`Es 384 dimensiones, rápido y lo suficientemente fuerte para la mayoría de los retiros en inglés.`paraphrase-multilingual-MiniLM-L12-v2`Para la máxima precisión,`bge-large-en-v1.5`o `e5-large-v2`¿ Qué ?

### Paso 3: Fusión recíproca de rango

```python
def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, (_, doc_idx) in enumerate(ranking):
            scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(score, doc_idx) for doc_idx, score in fused]
```

El `k=60`La constante proviene del papel original de RRF.`k`Aporta la contribución de las diferencias de rango;`k`60 es el estándar publicado y rara vez necesita ajuste.

### Paso 4: búsqueda híbrida + re-ranqueo

```python
from sentence_transformers import CrossEncoder

reranker = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")


def hybrid_search(query, bm25, encoder, dense_embeddings, corpus, top_k=5, pool_size=30, reranker=reranker):
    sparse_ranking = bm25.rank(query, top_k=pool_size)
    dense_ranking = dense_search(encoder, dense_embeddings, query, top_k=pool_size)
    fused = reciprocal_rank_fusion([sparse_ranking, dense_ranking])[:pool_size]

    pairs = [(query, corpus[doc_idx]) for _, doc_idx in fused]
    scores = reranker.predict(pairs)
    reranked = sorted(zip(scores, [doc_idx for _, doc_idx in fused]), reverse=True)
    return reranked[:top_k]
```

BM25 encuentra coincidencias léxicas. Denso encuentra coincidencias semánticas. RRF fusiona las dos clasificaciones sin necesidad de calibración de puntaje. Cross-encoder vuelve a marcar el top-30 usando pares de documentos de consulta juntos, lo que capta la relevancia de granos finos que el bi-encoder no logró. Mantenga el top-5.

### Paso 5: evaluación

| Metric | Meaning |
|--------|---------|
| Recall@k | Of queries where the correct document exists, how often is it in the top-k? |
| MRR (Mean Reciprocal Rank) | Average of 1/rank of first relevant document. |
| nDCG@k | Accounts for relevance gradations, not just binary relevant/not. |

Para RAG específicamente, **Recall@k**El lector no puede responder si el pasaje correcto no está en el conjunto recuperado.

Tip de desarreglamiento: para las consultas fallidas, diferir las clasificaciones escasas y densas. Si uno encuentra el documento correcto y el otro no, usted tiene un desajuste de vocabulario (corrección: agregar la mitad que falta) o una ambigüedad semántica (corrección: mejores embebedidos o un re-ranqueador).

## Usalo

La pila de 2026:

| Scale | Stack |
|-------|-------|
| 1k-100k docs | In-memory BM25 + `all-MiniLM-L6-v2` embeddings + RRF. No separate DB. |
| 100k-10M docs | FAISS or pgvector for dense + Elasticsearch / OpenSearch for BM25. Run in parallel. |
| 10M+ docs | Qdrant / Weaviate / Vespa / Milvus with hybrid support. Cross-encoder rerank on top-30. |
| Best-quality frontier | Three-way (BM25 + dense + SPLADE) + ColBERT late-interaction reranking |

Cualquiera que sea el presupuesto para la evaluación. Recall de recuperación de benchmark antes de comparar la exactitud de RAG de extremo a extremo. Un lector no puede arreglar lo que el recuperador perdió.

### Las lecciones duramente aprendidas de la producción RAG 2026

- **80% of RAG failures trace to ingestion and chunking, not the model.**Los equipos pasan semanas intercambiando LLM y sintonizando las instrucciones mientras que la recuperación devuelve silenciosamente el contexto equivocado cada tercera consulta.
- **Chunking strategy matters more than chunk size.**El tamaño fijo se divide en tablas, código y encabezados anidados.
- **Parent-doc pattern.**Recoger pequeños trozos de "niño" para obtener precisión. Cuando aparecen varios niños de la misma sección de padres, intercambiar en el bloque de padres para preservar el contexto. Esto aumenta constantemente la calidad de las respuestas sin necesidad de reentrenamiento.
- **k_rerank=3 is usually optimal.**Cada pieza extra que añade el costo de token y la latencia de generación sin elevar la calidad de la respuesta. Si k=8 es aún mejor que k=3 para usted, el re-ranqueador está haciendo mal.
- **HyDE / query expansion.**Generar una respuesta hipotética de la consulta, incrustar, recuperar. Cubriendo la brecha de fraseo entre preguntas cortas y documentos largos.
- **Context budget under 8K tokens.**Los golpes constantes en ese límite significan que el umbral de re-ranqueador es demasiado suelto.
- **Version everything.**Las instrucciones, las reglas de fragmentación, el modelo de incorporación, el reranker. Cualquier deriva rompe silenciosamente la calidad de la respuesta. Las puertas de CI sobre fidelidad, precisión de contexto y tasa de preguntas sin respuesta bloquean las regresiones antes de que los usuarios las vean.
- **Three-way retrieval (BM25 + dense + learned-sparse like SPLADE) outperforms two-way**Envía cuando la infraestructura admita los índices SPLADE.

El diseño adecuado de recuperación reduce las alucinaciones en un 70-90% de acuerdo con las mediciones de la industria de 2026. La mayoría de los beneficios de rendimiento de RAG provienen de una mejor recuperación, no de ajuste fino del modelo.

## Envío

Salvo como`outputs/skill-retrieval-picker.md`¿Qué es esto ?

```markdown
---
name: retrieval-picker
description: Pick a retrieval stack for a given corpus and query pattern.
version: 1.0.0
phase: 5
lesson: 14
tags: [nlp, retrieval, rag, search]
---

Given requirements (corpus size, query pattern, latency budget, quality bar, infra constraints), output:

1. Stack. BM25 only, dense only, hybrid (BM25 + dense + RRF), hybrid + cross-encoder rerank, or three-way (BM25 + dense + learned-sparse).
2. Dense encoder. Name the specific model. Match to language(s), domain, and context length.
3. Reranker. Name the specific cross-encoder model if used. Flag that rerank adds 30-100ms latency on top-30.
4. Evaluation plan. Recall@10 is the primary retriever metric. MRR for multi-answer. Baseline first, incremental improvements measured against it.

Refuse to recommend dense-only for corpora with named entities, error codes, or product SKUs unless the user has evidence dense handles exact matches. Refuse to skip reranking for high-stakes retrieval (legal, medical) where the final top-5 decides the user's answer.
```

## Los ejercicios

1. **Easy.**Implementación `hybrid_search`En el caso de los datos de la serie de datos, el número de datos de los datos de la serie de datos de la serie de datos de la serie de datos de la serie de datos de la serie de datos de la serie de datos de la serie de datos de la serie de datos de la serie de datos de la serie de datos de la serie de datos de la serie de datos de la serie de datos de la serie de datos de la serie de datos de la serie de datos de la serie de datos de la serie de datos de la serie de datos de la serie de datos de la serie de datos de la serie de datos de datos de la serie de datos de datos de la serie de datos de datos de la serie de datos de datos de la serie de datos de datos de la serie de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos
2. **Medium.**Añadir el cálculo de MRR. Para cada consulta de prueba con un documento correcto conocido, encontrar el rango del documento correcto en BM25, clasificaciones densas e híbridas. Informar el MRR para cada uno.
3. **Hard.**Afinar un codificador denso en su dominio utilizando MultipleNegativesRankingLoss (Transformadores de Sentencia). Construir un conjunto de entrenamiento de 500 pares de documentos de consulta. Comparar el pre y post-afinado de recuerdos.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BM25 | Keyword search | Okapi BM25. Scores documents by term frequency, IDF, and length. |
| Dense retrieval | Vector search | Encode query + doc into vectors, find nearest neighbors. |
| Bi-encoder | Embedding model | Encodes query and doc independently. Fast at query time. |
| Cross-encoder | Reranker model | Encodes query + doc together. Slow but accurate. |
| RRF | Rank fusion | Combine two rankings by summing `1/(k + rank)`. |
| Recall@k | Retrieval metric | Fraction of queries where a relevant doc is in the top-k. |

## Leer más

- [Robertson and Zaragoza (2009). The Probabilistic Relevance Framework: BM25 and Beyond](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf) el tratamiento definitivo de BM25.
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) DPR, el bi-encodador canónico.
- [Formal et al. (2021). SPLADE: Sparse Lexical and Expansion Model](https://arxiv.org/abs/2107.05720) el retriever de espacios aprendidos que cierra la brecha con denso.
- [Cormack, Clarke, Büttcher (2009). Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) Papel de RRF.
- [Khattab and Zaharia (2020). ColBERT: Efficient and Effective Passage Search](https://arxiv.org/abs/2004.12832) Recuperación de interacción tardía.
