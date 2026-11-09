# Modelado de temas  LDA y BERTopic

> LDA: documentos son mezclas de temas, temas son distribuciones sobre palabras. BERTopic: documentos en grupo en el espacio de incorporación, grupos son temas.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word2Vec)
**Time:** ~45 minutes

## El problema

Tienes 10.000 boletos de atención al cliente, 50.000 artículos de noticias o 200.000 tweets. Necesitas saber de qué se trata la colección sin leerla. No tienes etiquetadas categorías. Ni siquiera sabes cuántas categorías existen.

El modelo de temas responde sin supervisión. Dale un corpus, retorna un pequeño conjunto de temas coherentes y, para cada documento, una distribución sobre esos temas.

El LDA (2003) trata cada documento como una mezcla de temas latentes y cada tema como una distribución sobre palabras. La inferencia es bayesiana. Todavía se envía en producción donde se necesitan asignaciones de temas de miembros mixtos y distribuciones de probabilidad explicables a nivel de palabras.

BERTopic (2020) codifica documentos con BERT, reduce la dimensionalidad con UMAP, agrupa con HDBSCAN y extrae palabras de temas a través de TF-IDF basado en clase. Se gana en texto corto, redes sociales y cualquier cosa donde la similitud semántica importa más que la superposición de palabras. Un documento obtiene un tema, que es una limitación para el contenido de forma larga.

Esta lección construye la intuición para ambos y los nombres que uno debe elegir para un cuerpo dado.

## El concepto

![LDA mixture model vs BERTopic clustering](../assets/topic-modeling.svg)

**LDA generative story.**Cada tema es una distribución sobre palabras. Cada documento es una mezcla de temas. Para generar una palabra en un documento, muestre un tema de la mezcla del documento, luego muestre una palabra de la distribución de ese tema. La inferencia invierte esto: dada las palabras observadas, inferir la distribución de temas por documento y la distribución de palabras por tema.

Fuente de salida de LDA clave:

- `doc_topic`: matriz `(n_docs, n_topics)`, cada fila suma a 1 (mezcla de temas del documento).
- `topic_word`: matriz `(n_topics, vocab_size)`, cada fila suma a 1 (distribución de palabras del tema).

**BERTopic pipeline.**

1. Encodizar cada documento con un transformador de oraciones (por ejemplo, `all-MiniLM-L6-v2`Los vectores de 384 dimensiones.
2. Reducir la dimensionalidad con UMAP a ~5 dimensiones.
3. Cluster con HDBSCAN. basado en la densidad, produce grupos de tamaño variable y una etiqueta "outlier".
4. Para cada grupo, computa TF-IDF basado en la clase sobre los documentos del grupo para extraer las palabras principales.

La salida es un tema por documento (más una etiqueta de -1 fuera).

```figure
topic-drift
```

## Construye el mismo

### Paso 1: LDA a través de scikit-learn

```python
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import LatentDirichletAllocation
import numpy as np


def fit_lda(documents, n_topics=5, max_features=1000):
    cv = CountVectorizer(
        max_features=max_features,
        stop_words="english",
        min_df=2,
        max_df=0.9,
    )
    X = cv.fit_transform(documents)
    lda = LatentDirichletAllocation(
        n_components=n_topics,
        random_state=42,
        max_iter=50,
        learning_method="online",
    )
    doc_topic = lda.fit_transform(X)
    feature_names = cv.get_feature_names_out()
    return lda, cv, doc_topic, feature_names


def print_top_words(lda, feature_names, n_top=10):
    for idx, topic in enumerate(lda.components_):
        top_idx = np.argsort(-topic)[:n_top]
        words = [feature_names[i] for i in top_idx]
        print(f"topic {idx}: {' '.join(words)}")
```

Nota: se han eliminado las palabras de parada, min_df y max_df filtran términos raros y ubicuos, CountVectorizer (no TfidfVectorizer) porque LDA espera contagens crudas.

### Paso 2: BERTopic (producción)

```python
from bertopic import BERTopic

topic_model = BERTopic(
    embedding_model="sentence-transformers/all-MiniLM-L6-v2",
    min_topic_size=15,
    verbose=True,
)

topics, probs = topic_model.fit_transform(documents)
info = topic_model.get_topic_info()
print(info.head(20))
valid_topics = info[info["Topic"] != -1]["Topic"].tolist()
for topic_id in valid_topics[:5]:
    print(f"topic {topic_id}: {topic_model.get_topic(topic_id)[:10]}")
```

El filtro está encendido .`Topic != -1`Se elimina el cubo de pérdida de BERTopic (documentos que HDBSCAN no pudo agrupar). `min_topic_size`El tamaño mínimo de los clusters de HDBSCAN se controla; el estándar de biblioteca de BERTopic es 10.

### Paso 3: evaluación

Ambos métodos producen palabras de tema. La pregunta es si esas palabras coinciden.

- **Topic coherence (c_v).**Combina NPMI (información mutua normalizada de punto) de pares de palabras principales en contextos de ventana deslizante, agrega las puntuaciones en vectores de tema y compara esos vectores a través de similitud cosínica.`gensim.models.CoherenceModel`con`coherence="c_v"`¿ Qué ?
- **Topic diversity.**Fracción de palabras únicas en todas las palabras principales de los temas.
- **Qualitative inspection.**¿Es verdad que el juicio humano es la última línea de defensa?

## ¿Cuándo elegir cuál

| Situation | Pick |
|-----------|------|
| Short text (tweets, reviews, headlines) | BERTopic |
| Long documents with topic mixtures | LDA |
| No GPU / limited compute | LDA or NMF |
| Need document-level multi-topic distributions | LDA |
| LLM integration for topic labeling | BERTopic (direct support) |
| Resource-constrained edge deployment | LDA |
| Max semantic coherence | BERTopic |

La mayor consideración práctica es la longitud del documento. las incorporaciones BERT truncan; LDA cuenta el trabajo en cualquier longitud. Para documentos más largos que el contexto del modelo de incorporación, ya sea pieza + agregado o use LDA.

## Usalo

La pila de 2026:

- **BERTopic.**Default para texto corto y cualquier cosa donde la semántica importa.
- **`gensim.models.LdaModel`.**LDA clásico para producción, maduro, probado en batalla.
- **`sklearn.decomposition.LatentDirichletAllocation`.**LDA fácil para experimentos.
- **NMF.**Factorizamiento de matriz no negativo, alternativa rápida a la LDA, calidad comparable en texto corto.
- **Top2Vec.**Diseño similar al de BERTopic, comunidad más pequeña pero buena en algunos puntos de referencia.
- **FASTopic.**Más nuevo, más rápido que BERTopic en corpora muy grandes.
- **LLM-based labeling.**Ejecutar cualquier agrupación, luego pedir un modelo para nombrar cada agrupación.

## Envío

Salvo como`outputs/skill-topic-picker.md`¿Qué es esto ?

```markdown
---
name: topic-picker
description: Pick LDA or BERTopic for a corpus. Specify library, knobs, evaluation.
version: 1.0.0
phase: 5
lesson: 15
tags: [nlp, topic-modeling]
---

Given a corpus description (document count, avg length, domain, language, compute budget), output:

1. Algorithm. LDA / NMF / BERTopic / Top2Vec / FASTopic. One-sentence reason.
2. Configuration. Number of topics: `recommended = max(5, round(sqrt(n_docs)))`, clamped to 200 for corpora under 40,000 docs; permit >200 only when the corpus is genuinely large (>40k) and note the increased compute cost. `min_df` / `max_df` filters and embedding model for neural approaches also belong here.
3. Evaluation. Topic coherence (c_v) via `gensim.models.CoherenceModel`, topic diversity, and a 20-sample human read.
4. Failure mode to probe. For LDA, "junk topics" absorbing stopwords and frequent terms. For BERTopic, the -1 outlier cluster swallowing ambiguous documents.

Refuse BERTopic on documents longer than the embedding model's context window without a chunking strategy. Refuse LDA on very short text (tweets, reviews under 10 tokens) as coherence collapses. Flag any n_topics choice below 5 as likely wrong; flag >200 on corpora under 40k docs as likely over-splitting.
```

## Los ejercicios

1. **Easy.**Aplica LDA con 5 temas en el conjunto de datos de 20 Newsgroups. Imprima las 10 palabras principales por tema. Etiqueta cada tema a mano. ¿El algoritmo encontró las categorías reales?
2. **Medium.**En la actualidad, el grupo de noticias de la región de LDA es el más importante de los grupos de noticias de la región de LDA.
3. **Hard.**Compute la coherencia c_v tanto para LDA como para BERTopic en su corpus. ejecuta cada uno con 5, 10, 20, 50 temas. Conserva la coherencia frente al conteo de temas. Reporte qué método es más estable en los conteos de temas.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Topic | A thing the corpus is about | A probability distribution over words (LDA) or a cluster of similar documents (BERTopic). |
| Mixed membership | Doc is multiple topics | LDA assigns each document a distribution over all topics. |
| UMAP | Dimensionality reduction | Manifold learning that preserves local structure; used in BERTopic. |
| HDBSCAN | Density clustering | Finds variable-size clusters; produces "noise" label (-1) for outliers. |
| c_v coherence | Topic quality metric | NPMI of top topic words over sliding windows, turned into context vectors and compared with cosine similarity. |

## Leer más

- [Blei, Ng, Jordan (2003). Latent Dirichlet Allocation](https://www.jmlr.org/papers/volume3/blei03a/blei03a.pdf) el documento de la LDA.
- [Grootendorst (2022). BERTopic: Neural topic modeling with a class-based TF-IDF procedure](https://arxiv.org/abs/2203.05794) el periódico BERTopic.
- [Röder, Both, Hinneburg (2015). Exploring the Space of Topic Coherence Measures](https://svn.aksw.org/papers/2015/WSDM_Topic_Evaluation/public.pdf) el periódico que introdujo a C_V y amigos.
- [BERTopic documentation](https://maartengr.github.io/BERTopic/) la referencia de producción.
