# Bolsa de palabras, TF-IDF y representación del texto

> TF-IDF todavía supera las incorporaciones en tareas bien definidas en 2026.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 02 (Linear Regression from Scratch)
**Time:** ~75 minutes

## El problema

El modelo necesita números.

Cada línea de NLP tiene que responder a la misma pregunta. ¿Cómo convertir un flujo de tokens de longitud variable en un vector de tamaño fijo que un clasificador puede consumir? La primera respuesta que el campo aterrizó fue la más tonta que funciona. Cuente las palabras. Haga un vector.

Ese vector ha llevado más NLP de producción que cualquier modelo de incorporación. Filtros de spam, clasificadores de temas, detección de anomalías de registro, clasificación de búsqueda (antes de BM25), la primera ola de análisis de sentimientos, la primera década de benchmarks académicos de PNL. 2026 los profesionales todavía lo alcanzan primero en tareas de clasificación estrechas. Es rápido, interpretable y a menudo indistinguible de un modelo de incorporación de parámetros de 400M en tareas donde la presencia de palabras es lo que importa.

Esta lección construye una bolsa de palabras, luego TF-IDF, desde cero. Luego muestra a scikit-learn haciendo lo mismo en tres líneas. Luego nombra el modo de fracaso que te hace llegar a las incorporaciones.

## El concepto

**Bag of Words (BoW)**Para cada documento, cuenta cuántas veces aparece cada palabra del vocabulario.`i`es el conteo de palabras `i`¿ Qué ?

**TF-IDF**Una palabra que aparece en cada documento es poco informativa, así que redujelo. Una palabra rara en todo el corpus pero frecuente en un solo documento es señal, así que redujelo.

```math
\begin{aligned}
\text{TF-IDF}(w, d) &= \text{TF}(w, d) \cdot \text{IDF}(w) \\
&= \frac{\mathop{\mathrm{count}}(w \text{ in } d)}{|d|} \cdot \log\frac{N}{\mathop{\mathrm{df}}(w)}
\end{aligned}
```

¿ Dónde ?`TF`es la frecuencia de los términos en el documento, `df`es la frecuencia del documento (cuántos documentos contienen la palabra), `N`Es el total de documentos.`log`mantiene el peso limitado para las palabras omnipresentes.

Propiedad clave: ambos producen vectores escasos con ejes interpretables. Puedes mirar los pesos de un clasificador entrenado y leer qué palabras empujan un documento hacia cada clase. No puedes hacer esto con una incorporación BERT de 768 dimensiones.

```figure
bow-tfidf
```

## Construye el mismo

### Paso 1: construir el vocabulario

```python
def build_vocab(docs):
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    return vocab
```

Entrada: lista de documentos tokenizados (se hará cualquier tokenizer de nivel de palabra; el `code/main.py`En esta lección se utiliza una variante simplificada en letras pequeñas).`{word: index}`Dict. orden de inserción estable significa que el índice de palabras 0 es la primera palabra que se ve en el primer documento.

### Paso 2: bolsa de palabras

```python
def bag_of_words(docs, vocab):
    matrix = [[0] * len(vocab) for _ in docs]
    for i, doc in enumerate(docs):
        for token in doc:
            if token in vocab:
                matrix[i][vocab[token]] += 1
    return matrix
```

```python
>>> docs = [["cat", "sat", "on", "mat"], ["cat", "cat", "ran"]]
>>> vocab = build_vocab(docs)
>>> bag_of_words(docs, vocab)
[[1, 1, 1, 1, 0], [2, 0, 0, 0, 1]]
```

Las filas son documentos, las columnas son índices de vocabulario.`[i][j]`es "cuántas veces palabra `j`aparece en el documento `i`." Doc 1 tiene `cat`Dos veces porque lo hizo.`ran`cero veces porque no lo hizo.

### Paso 3: frecuencia de los términos y frecuencia de los documentos

```python
import math


def term_frequency(doc_bow, doc_length):
    return [c / doc_length if doc_length else 0 for c in doc_bow]


def document_frequency(bow_matrix):
    df = [0] * len(bow_matrix[0])
    for row in bow_matrix:
        for j, count in enumerate(row):
            if count > 0:
                df[j] += 1
    return df


def inverse_document_frequency(df, n_docs):
    return [math.log((n_docs + 1) / (d + 1)) + 1 for d in df]
```

Dos trucos de suavizamiento que vale la pena nombrar.`(n+1)/(d+1)`evita`log(x/0)`- El trasero .`+1`El sistema de instrucción de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de base de datos de base de datos de base de datos de base de base de datos de datos de base de base de datos de base de datos de base de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de datos de base de base de datos de datos de base de base de datos de base de base de datos de datos de base de base de datos de base de base de datos de base de base de datos de base de base de datos de datos de base de base de datos de base de base de datos de base de base de datos de base de base de datos de base de base de base de datos de base de base de datos de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de`log(N/df)`Ambos funcionan, la versión suave es más amigable.

### Paso 4: TF-IDF

```python
def tfidf(bow_matrix):
    n_docs = len(bow_matrix)
    df = document_frequency(bow_matrix)
    idf = inverse_document_frequency(df, n_docs)
    out = []
    for row in bow_matrix:
        length = sum(row)
        tf = term_frequency(row, length)
        out.append([tf_j * idf_j for tf_j, idf_j in zip(tf, idf)])
    return out
```

```python
>>> docs = [
...     ["the", "cat", "sat"],
...     ["the", "dog", "sat"],
...     ["the", "cat", "ran"],
... ]
>>> vocab = build_vocab(docs)
>>> bow = bag_of_words(docs, vocab)
>>> tfidf(bow)
```

Tres documentos, cinco palabras vocabularias (`the`¿ Qué ?`cat`¿ Qué ?`sat`¿ Qué ?`dog`¿ Qué ?`ran`¿ Qué es esto ?`the`aparece en los tres, así que su IDF es baja. `dog`En el caso de los vehículos de guerra, el número de vehículos de guerra que aparecen en uno es alto.

### Paso 5: Normaliza las filas L2

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

Sin normalización, un documento más largo obtiene un vector más grande y domina las puntuaciones de similitud. La normalización L2 pone cada documento en la hiperesfera unitaria. La similitud cosínica entre filas es ahora solo un producto de puntos.

## Usalo

Scikit-Learn envía la versión de producción.

```python
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer

docs = ["the cat sat on the mat", "the dog sat on the mat", "the cat ran"]

bow_vectorizer = CountVectorizer()
bow = bow_vectorizer.fit_transform(docs)
print(bow_vectorizer.get_feature_names_out())
print(bow.toarray())

tfidf_vectorizer = TfidfVectorizer()
tfidf = tfidf_vectorizer.fit_transform(docs)
print(tfidf.toarray().round(3))
```

`CountVectorizer`hace tokenización, vocabulario y BoW en una sola llamada. `TfidfVectorizer`Para 100k documentos, la versión densa no encaja en la memoria; permanezca escasa hasta que el clasificador exija densa.

Los nudos que cambian todo:

| Arg | Effect |
|-----|--------|
| `ngram_range=(1, 2)` | Include bigrams. Usually boosts classification. |
| `min_df=2` | Drop words in fewer than 2 docs. Trims vocabulary on noisy data. |
| `max_df=0.95` | Drop words in more than 95% of docs. Approximates stopword removal without a hardcoded list. |
| `stop_words="english"` | scikit-learn's builtin stopword list. Task-dependent — sentiment analysis should *not* drop negations. |
| `sublinear_tf=True` | Use `1 + log(tf)` instead of raw `tf`. Helps when a term repeats many times in one doc. |

### Cuando TF-IDF todavía gane (a partir de 2026)

- La detección de spam, etiquetado de temas, marcado de anomalías de registro.
- Los regímenes de datos bajos (cientos de ejemplos etiquetados) TF-IDF más regresión logística no tienen coste previo a la formación.
- TF-IDF más un modelo lineal responde en microsecondas.
- Los sistemas que deben explicar sus predicciones, inspeccionar los coeficientes del clasificador, las palabras positivas más altas son la razón.

### Cuando el TF-IDF falla

El fracaso de la ceguera semántica.

- "La película no fue buena en absoluto".
- "La película fue excelente".

Uno es una revisión negativa, otro es positivo, su superposición entre TF e IDF es exactamente`{the, movie, was}`Un clasificador de bolsas de palabras tiene que memorizar esa palabra .`not`cerca .`good`Puede aprender esto con suficiente datos, pero nunca tan graciosamente como un modelo que entiende la sintaxis.

El otro fracaso: palabras fuera del vocabulario en la inferencia.`Zoomer-approved`Si el token no apareció en el entrenamiento, las incorporaciones de subpalabra (lección 04) manejan esto.

### El valor de la carga de carga de la aeronave se calcula en el punto de partida 1 del anexo I.

El estándar pragmático para 2026 para la clasificación de datos medios: utilizar pesas TF-IDF como atención sobre las incorporaciones de palabras.

```python
def tfidf_weighted_embedding(doc, tfidf_scores, embedding_table, dim):
    vec = [0.0] * dim
    total_weight = 0.0
    for token in doc:
        if token not in embedding_table or token not in tfidf_scores:
            continue
        weight = tfidf_scores[token]
        emb = embedding_table[token]
        for i in range(dim):
            vec[i] += weight * emb[i]
        total_weight += weight
    if total_weight == 0:
        return vec
    return [v / total_weight for v in vec]
```

Obtienes capacidad semántica de las incorporaciones, y énfasis en palabras raras de TF-IDF. El clasificador se forma en el vector combinado. Esto supera por sí solo para la clasificación de sentimiento, tema y intención por debajo de unos 50k ejemplos etiquetados.

## Envío

Salvo como`outputs/prompt-vectorization-picker.md`¿Qué es esto ?

```markdown
---
name: vectorization-picker
description: Given a text-classification task, recommend BoW, TF-IDF, embeddings, or a hybrid.
phase: 5
lesson: 02
---

You recommend a text-vectorization strategy. Given a task description, output:

1. Representation (BoW, TF-IDF, transformer embeddings, or a hybrid). Explain why in one sentence.
2. Specific vectorizer configuration. Name the library. Quote the arguments (`ngram_range`, `min_df`, `max_df`, `sublinear_tf`, `stop_words`).
3. One failure mode to test before shipping.

Refuse to recommend embeddings when the user has under 500 labeled examples unless they show evidence of semantic failure in a TF-IDF baseline. Refuse to remove stopwords for sentiment analysis (negations carry signal). Flag class imbalance as needing more than a vectorizer change.

Example input: "Classifying 30k customer support tickets into 12 categories. Most tickets are 2-3 sentences. English only. Need explainability for audit logs."

Example output:

- Representation: TF-IDF. 30k examples is not small; explainability requirement rules out dense embeddings.
- Config: `TfidfVectorizer(ngram_range=(1, 2), min_df=3, max_df=0.95, sublinear_tf=True, stop_words=None)`. Keep stopwords because category keywords sometimes are stopwords ("not working" vs "working").
- Failure to test: verify `min_df=3` does not drop rare category keywords. Run `get_feature_names_out` filtered by class and eyeball.
```

## Los ejercicios

1. **Easy.**Implementación `cosine_similarity(doc_vec_a, doc_vec_b)`Verificar que los documentos idénticos obtienen un puntaje de 1.0 y los documentos de vocabulario desarticulado un puntaje de 0.0.
2. **Medium.**Añadir`n-gram`apoyo a `bag_of_words`Parámetro .`n`produce recuentos sobre `n`- Prueba eso.`n=2`En el`["the", "cat", "sat"]`produce un gran número de números de gramos para`["the cat", "cat sat"]`¿ Qué ?
3. **Hard.**Construir el híbrido de incorporación ponderada TF-IDF arriba utilizando vectores GloVe 100d (descargar una vez, caché). Comparar la precisión de clasificación con la TF-IDF y las incorporaciones medias comunes en el conjunto de datos de 20 Newsgroups.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BoW | Word frequency vector | Counts of vocabulary words in one document. Throws away order. |
| TF | Term frequency | Count of a word in a document, optionally normalized by document length. |
| DF | Document frequency | Count of documents containing the word at least once. |
| IDF | Inverse document frequency | `log(N / df)` smoothed. Downweights words that appear everywhere. |
| Sparse vector | Mostly zeros | Vocabulary is typically 10k-100k words; most are absent from any given document. |
| Cosine similarity | Vector angle | Dot product of L2-normalized vectors. 1 is identical, 0 is orthogonal. |

## Leer más

- [scikit-learn — feature extraction from text](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) la referencia canónica de API, más notas en cada botón.
- [Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval](https://www.sciencedirect.com/science/article/pii/0306457388900210) el papel que hizo que TF-IDF fuera el default durante una década.
- ["Why TF-IDF Still Beats Embeddings" — Ashfaque Thonikkadavan (Medium)](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2) 2026 tomar cuando el viejo método gana y por qué.
