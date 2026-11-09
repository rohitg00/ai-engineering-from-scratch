# Modelos de incorporación  La inmersión profunda de 2026

> Word2Vec le dio un vector por palabra. Modelos de incorporación modernos le dan un vector por pasaje, translingual, con vistas escasas, densas y multi-vector, tamaño para adaptarse a su índice. Elige mal y su RAG recupera la cosa equivocada.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 03 (Word2Vec), Phase 5 · 14 (Information Retrieval)
**Time:** ~60 minutes

## El problema

Su sistema RAG recupera el pasaje equivocado el 40% del tiempo. El culpable es rara vez la base de datos vectorial o el prompt. Es el modelo de incorporación.

Elegir una incorporación en 2026 significa elegir a través de cinco ejes:

1. **Dense vs sparse vs multi-vector.**Un vector por pasaje, o uno por símbolo, o una bolsa de palabras escasa y pesada.
2. **Language coverage.**Los modelos monolingües de inglés aún ganan en tareas solo en inglés.
3. **Context length.**512 tokens vs 8.192 vs 32.768  y la capacidad efectiva real es a menudo 60-70% del máximo anunciado.
4. **Dimension budget.**Los datos de la matriz de truncado de Matryoshka reducen este número de 4 veces.
5. **Open vs hosted.**El peso abierto significa que controlas la pila y los datos.

Esta lección nombra los compromisos para que puedas recoger pruebas, no lo que fue popular el trimestre pasado.

## El concepto

![Dense, sparse, and multi-vector embeddings](../assets/embedding-modes.svg)

**Dense embeddings.**Un vector por pasaje (generalmente 384-3,072 dimensiones). La similitud cosínica clasifica los pasajes por proximidad semántica.`text-embedding-3-large`, modo BGE-M3 denso, Voyage-3.

**Sparse embeddings.**Un transformador predice un peso para cada token de vocabulario, luego cero para la mayoría de ellos. El resultado es un vector de tamaño reducido. Captura la coincidencia léxica (como BM25) pero con pesos de términos aprendidos.

**Multi-vector (late interaction).**ColBERTv2, Jina-ColBERT. Un vector por token. Puntuación con MaxSim: para cada token de consulta, encontrar el token de documento más similar, sumar las puntuaciones. Más caro de almacenar y puntuación, pero gana en consultas largas y corpora específicos de dominio.

**BGE-M3: all three at once.**El modelo único produce representaciones densas, escasas y multivéctoras simultáneamente. Cada una puede ser consultada de forma independiente; las puntuaciones se fusionan a través de la suma ponderada.

**Matryoshka Representation Learning.**Se entrenan para que las primeras dimensiones N del vector formen una incorporación independiente útil. Truncate un vector de 1.536 dimensiones a 256 dimensiones y pagar ~1% de precisión para ahorros de almacenamiento 6x.

### El tablero de clasificación de MTEB cuenta una historia parcial

En el inicio de 2026, Gemini Embedding 2 alcanza la máxima capacidad de recuperación (67.71 MTEB-R). Cohere embed-v4 conduce general (65.2 MTEB). BGE-M3 conduce multilingüe de peso abierto (63.0).

### El patrón de tres niveles

| Use case | Pattern |
|----------|---------|
| Fast first-pass | Dense bi-encoder (BGE-M3, text-3-small) |
| Recall boost | Sparse (SPLADE, BGE-M3 sparse) + RRF fuse |
| Precision on top-50 | Multi-vector (ColBERTv2) or cross-encoder reranker |

La mayoría de las estacas de producción utilizan las tres.

```figure
gx-matryoshka
```

## Construye el mismo

### Paso 1: línea de base  incrustaciones densas con Sentence-BERT

```python
from sentence_transformers import SentenceTransformer
import numpy as np

encoder = SentenceTransformer("BAAI/bge-small-en-v1.5")
corpus = [
    "The first iPhone launched in 2007.",
    "Apple released the iPod in 2001.",
    "Android is an operating system from Google.",
]
emb = encoder.encode(corpus, normalize_embeddings=True)

query = "When was the iPhone released?"
q_emb = encoder.encode([query], normalize_embeddings=True)[0]
scores = emb @ q_emb
print(sorted(enumerate(scores), key=lambda x: -x[1]))
```

`normalize_embeddings=True`hace que el producto de puntos sea igual a la similitud cosínica.

### Paso 2: Truncamiento de matrioshka

```python
def truncate(vectors, dim):
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)

emb_256 = truncate(emb, 256)
emb_128 = truncate(emb, 128)
```

La normalización se realiza después de la truncada. Nomic v1.5, OpenAI text-3, y Voyage-4 están entrenados para que esto sea sin pérdidas para los primeros niveles.

### Paso 3: Multifunkcionalidad de la BGE-M3

```python
from FlagEmbedding import BGEM3FlagModel

model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)

output = model.encode(
    corpus,
    return_dense=True,
    return_sparse=True,
    return_colbert_vecs=True,
)
# output["dense_vecs"]:    (n_docs, 1024)
# output["lexical_weights"]: list of dict {token_id: weight}
# output["colbert_vecs"]:  list of (n_tokens, 1024) arrays
```

Tres índices, una llamada de inferencia.

```python
dense_score = ... # cosine over dense_vecs
sparse_score = model.compute_lexical_matching_score(q_lex, d_lex)
colbert_score = model.colbert_score(q_col, d_col)
final = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

Ajusta los pesos en tu dominio.

### Paso 4: Evaluación de MTEB en una tarea personalizada

```python
from mteb import MTEB

tasks = ["ArguAna", "SciFact", "NFCorpus"]
evaluation = MTEB(tasks=tasks)
results = evaluation.run(encoder, output_folder="./mteb-results")
```

Ejecutar los modelos de candidatos en un subconjunto *representativo* No confíe en el ranking de la lista de clasificación solo  su dominio importa.

### Paso 5: cosino laminado a mano desde cero

¿ Qué ?`code/main.py`. Embebedidos de Hashing Trick promedio (solo stdlib). No competitivos con los embebedidos de transformadores, pero muestra la forma: tokenize → vector → normalize → product punto.

## Las trampas

- **Same model for query and doc.**Algunos modelos (Voyage, Jina-ColBERT) utilizan codificación asimétrica  consulta y documento pasan a través de diferentes caminos.
- **Missing prefix.** `bge-*`los modelos necesitan`"Represent this sentence for searching relevant passages: "`3-5 puntos de retorno de la brecha si se olvida.
- **Over-trimming Matryoshka.**1.536 → 256 es generalmente seguro. 1.536 → 64 no es. Valida en tu conjunto de eval.
- **Context truncation.**La mayoría de los modelos truncan silenciosamente las entradas en su longitud máxima.
- **Ignoring latency tail.**Los puntajes MTEB ocultan la latencia p99. Un modelo 600M podría superar un modelo 335M en 2 puntos pero cuesta 3 veces más por consulta.

## Usalo

La pila de 2026:

| Situation | Pick |
|-----------|------|
| English-only, fast, API | `text-embedding-3-large` or `voyage-3-large` |
| Open-weight, English | `BAAI/bge-large-en-v1.5` |
| Open-weight, multilingual | `BAAI/bge-m3` or `Qwen3-Embedding-8B` |
| Long context (32k+) | Voyage-3-large, Cohere embed-v4, Qwen3-Embedding-8B |
| CPU-only deployment | Nomic Embed v2 (137M params, MoE) |
| Storage-constrained | Matryoshka-truncated + int8 quantization |
| Keyword-heavy queries | Add SPLADE sparse, RRF-fuse with dense |

Modelo 2026: comience con BGE-M3 o texto-3-largo, evalúe en su dominio con MTEB, cambie si un modelo específico de dominio gana en más de 3 puntos.

## Envío

Salvo como`outputs/skill-embedding-picker.md`¿Qué es esto ?

```markdown
---
name: embedding-picker
description: Pick embedding model, dimension, and retrieval mode for a given corpus and deployment.
version: 1.0.0
phase: 5
lesson: 22
tags: [nlp, embeddings, retrieval]
---

Given a corpus (size, languages, domain, avg length), deployment target (cloud / edge / on-prem), latency budget, and storage budget, output:

1. Model. Named checkpoint or API. One-sentence reason.
2. Dimension. Full / Matryoshka-truncated / int8-quantized. Reason tied to storage budget.
3. Mode. Dense / sparse / multi-vector / hybrid. Reason.
4. Query prefix / template if required by the model card.
5. Evaluation plan. MTEB tasks relevant to domain + held-out domain eval with nDCG@10.

Refuse recommendations that truncate Matryoshka to <64 dims without domain validation. Refuse ColBERTv2 for corpora under 10k passages (overhead not justified). Flag long-document corpora (>8k tokens) routed to models with 512-token windows.
```

## Los ejercicios

1. **Easy.**Encode 100 frases con `bge-small-en-v1.5`En el punto de baja de la velocidad, en el punto de baja de la velocidad, en el punto de baja de la velocidad, en el punto de baja de la velocidad, en el punto de baja de la velocidad, en el punto de baja de la velocidad, en el punto de baja de la velocidad, en el punto de baja de la velocidad, en el punto de baja de la velocidad, en el punto de baja de la velocidad, en el punto de baja de la velocidad, en el punto de baja de la velocidad, en el punto de baja de la velocidad, en el punto de baja de la velocidad, en el punto de baja de la velocidad, en el punto de baja de la velocidad, en el punto de baja de la velocidad, en el punto de baja de baja de la velocidad, en el punto de baja de baja de la velocidad, en el punto de baja de baja de la velocidad, en el punto de baja de baja de la velocidad, en el punto de baja de baja de baja de la velocidad, en el punto de baja de baja de baja de la velocidad, en el punto de baja de la velocidad, en el punto de baja de baja de la velocidad, en el punto de la velocidad, en el punto de la velocidad, en el punto de la cual se puede medir, en el punto de la velocidad, en el punto de la velocidad, en el punto de la velocidad, en el punto de la cual se puede ser.
2. **Medium.**Comparar BGE-M3 denso, escaso y colbert en 500 pasajes de su dominio. ¿Cuál gana en recall@10? ¿La fusión RRF supera el mejor modo individual?
3. **Hard.**ejecuta MTEB en tres modelos candidatos en tus dos tareas de dominio más importantes. informe MTEB puntaje, p99 latencia en un lote de 100 consultas, y $ / 1M consultas. Elige el Pareto-óptimo uno.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Dense embedding | The vector | One fixed-size vector per text. Cosine similarity for ranking. |
| Sparse embedding | Learned BM25 | One weight per vocab token; mostly zeros; trained end-to-end. |
| Multi-vector | ColBERT-style | One vector per token; MaxSim scoring; bigger index, better recall. |
| Matryoshka | Russian doll trick | First N dims are a valid smaller embedding on their own. |
| MTEB | The benchmark | Massive Text Embedding Benchmark — 56 tasks at launch, 100+ in v2. |
| BEIR | The retrieval benchmark | 18 zero-shot retrieval tasks; often cited for cross-domain robustness. |
| Asymmetric encoding | Query ≠ doc path | Model uses different projections for queries and documents. |

## Leer más

- [Reimers, Gurevych (2019). Sentence-BERT](https://arxiv.org/abs/1908.10084) el papel de biencoder.
- [Muennighoff et al. (2022). MTEB: Massive Text Embedding Benchmark](https://arxiv.org/abs/2210.07316) el papel de la tabla de clasificación.
- [Chen et al. (2024). BGE-M3: Multi-lingual, Multi-functionality, Multi-granularity](https://arxiv.org/abs/2402.03216) el modelo unificado de tres modos.
- [Kusupati et al. (2022). Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) el objetivo de formación en la escalera de dimensiones.
- [Santhanam et al. (2022). ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488) Interacción tardía en la producción.
- [MTEB leaderboard on Hugging Face](https://huggingface.co/spaces/mteb/leaderboard) rankings en vivo.
