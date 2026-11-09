# Análisis de los sentimientos

> La tarea canónica de la PNL. La mayor parte de lo que necesitas saber sobre la clasificación de textos clásicos se muestra aquí.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 2 · 14 (Naive Bayes)
**Time:** ~75 minutes

## El problema

"La comida no fue buena". ¿Positiva o negativa?

El sentimiento suena simple. Un revisor dijo que les gustaba o no a algo. Etiquetar la oración. La razón por la que se convirtió en la tarea canónica de la PNL es que cada caso fácil de ver esconde uno difícil. La negación cambia de significado. El sarcasmo lo invierte. "No está mal en absoluto" es positivo a pesar de dos palabras codificadas negativamente.`tight`en la revisión de música versus `tight`en la revisión de la moda).

Si entiendes por qué cada línea de base ingenua tiene un modo de fracaso específico, entiendes por qué se inventó cada modelo más rico. Esta lección construye una línea de base Bayes ingenua desde cero, agrega regresión logística y nombra las trampas que hacen que el sentimiento de producción sea un problema de grado de cumplimiento.

## El concepto

El sentimiento clásico es una receta de dos pasos.

1. **Represent.**Convierta el texto en un vector de características.
2. **Classify.**Aplique un modelo lineal (Naive Bayes, regresión logística, SVM) en ejemplos etiquetados.

Bayes es el modelo más estúpido que funciona.`P(word | positive)`y `P(word | negative)`En la inferencia, multiplica las probabilidades. La suposición de independencia "naiva" es ridículamente errónea y sin embargo los resultados son sorprendentemente fuertes. La razón: con características de texto escasos y datos moderados, al clasificador le importa hacia qué lado se inclina cada palabra más que hacia cuánto.

La regresión logística fija la suposición de independencia. Aprende un peso por característica, incluyendo pesas negativas. `not good`Bayes ingenuo no puede hacer eso para los bigramas que nunca ha etiquetado.

```figure
sentiment-logits
```

## Construye el mismo

### Paso 1: un mini conjunto de datos real

```python
POSITIVE = [
    "absolutely loved this movie",
    "beautiful cinematography and a great story",
    "one of the best films of the year",
    "brilliant acting from the lead",
    "heartwarming and funny",
]

NEGATIVE = [
    "boring and far too long",
    "not worth your time",
    "the plot made no sense",
    "terrible acting, awful script",
    "i want my two hours back",
]
```

El trabajo real utiliza decenas de miles de ejemplos (IMDb, SST-2, polaridad Yelp).

### Paso 2: Naive Bayes multinomial desde cero

```python
import math
from collections import Counter


def train_nb(docs_by_class, vocab, alpha=1.0):
    class_priors = {}
    class_word_probs = {}
    total_docs = sum(len(d) for d in docs_by_class.values())

    for cls, docs in docs_by_class.items():
        class_priors[cls] = len(docs) / total_docs
        counts = Counter()
        for doc in docs:
            for token in doc:
                counts[token] += 1
        total = sum(counts.values()) + alpha * len(vocab)
        class_word_probs[cls] = {
            w: (counts[w] + alpha) / total for w in vocab
        }
    return class_priors, class_word_probs


def predict_nb(doc, class_priors, class_word_probs):
    scores = {}
    for cls in class_priors:
        s = math.log(class_priors[cls])
        for token in doc:
            if token in class_word_probs[cls]:
                s += math.log(class_word_probs[cls][token])
        scores[cls] = s
    return max(scores, key=scores.get)
```

La suavizamiento aditivo (alfa=1.0) es la suavizamiento de Laplace. Sin ella, una palabra no vista en una clase tiene probabilidad cero y el registro explota. `alpha=0.01`Es común en la práctica. `alpha=1.0`es el defecto de enseñanza.

### Paso 3: Regresión logística desde cero

```python
import numpy as np


def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -20, 20)))


def train_lr(X, y, epochs=500, lr=0.05, l2=0.01):
    n_features = X.shape[1]
    w = np.zeros(n_features)
    b = 0.0
    for _ in range(epochs):
        logits = X @ w + b
        preds = sigmoid(logits)
        err = preds - y
        grad_w = X.T @ err / len(y) + l2 * w
        grad_b = err.mean()
        w -= lr * grad_w
        b -= lr * grad_b
    return w, b


def predict_lr(X, w, b):
    return (sigmoid(X @ w + b) >= 0.5).astype(int)
```

La regularización de L2 es importante aquí. Las características del texto son escasas; sin L2 el modelo memoriza ejemplos de entrenamiento.`0.01`y sintonizar.

### Paso 4: negación de manejo (modo de falla)

Considere "no bueno" y "no malo". Un clasificador de BoW ve.`{not, good}`y `{not, bad}`Y aprende de quien apareció más en el entrenamiento.`not_good`y `not_bad`Y los aprende como características distintas.

Una solución más crudera que funciona cuando no tienes bigramas: **negation scoping**. Prefijo de tokens después de una palabra de negación con `NOT_`hasta la siguiente puntuación.

```python
NEGATION_WORDS = {"not", "no", "never", "nor", "none", "nothing", "neither"}
NEGATION_TERMINATORS = {".", "!", "?", ",", ";"}


def apply_negation(tokens):
    out = []
    negate = False
    for token in tokens:
        if token in NEGATION_TERMINATORS:
            negate = False
            out.append(token)
            continue
        if token in NEGATION_WORDS:
            negate = True
            out.append(token)
            continue
        out.append(f"NOT_{token}" if negate else token)
    return out
```

```python
>>> apply_negation(["not", "good", "at", "all", ".", "but", "funny"])
['not', 'NOT_good', 'NOT_at', 'NOT_all', '.', 'but', 'funny']
```

Ahora .`good`y `NOT_good`El clasificador puede pesarlas opuestas. tres líneas de precisión de procesamiento medible saltan sobre los puntos de referencia del sentimiento.

### Paso 5: métricas de evaluación que importan

La exactitud por sí sola es engañosa si las clases están desequilibradas. Los corpora de sentimiento reales suelen ser de 70-80% positivo o 70-80% negativo; un clasificador de mayoría constante obtiene una exactitud del 80% y no tiene valor.

- **Per-class precision and recall.**Un par por clase, y los promediamos para obtener un solo número que respete el equilibrio de clase.
- **Macro-F1 (primary metric for imbalanced data).**Mediano de puntuaciones por clase, igual de ponderada.
- **Weighted-F1 (alternative).**Igual que macro pero ponderado por la frecuencia de la clase.
- **Confusion matrix.**Siempre inspeccione antes de confiar en cualquier métrica escalar; revela qué par de clases el modelo confunde.
- **Per-class error samples.**Toma 5 predicciones erróneas por clase. Léaslas. Nada reemplaza la lectura de los errores reales.

Para datos gravemente desequilibrados (> 95-5 ratio), informe **AUROC**y **AUPRC**AUPRC es más sensible a la clase minoritaria, que es lo que normalmente se preocupa (spam, fraude, sentimiento raro).

**Common bug to avoid.**Informar micro-F1 en lugar de macro-F1 en datos desequilibrados da un número que parece alto porque está dominado por la clase mayoritaria.

```python
def evaluate(y_true, y_pred):
    tp = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 1)
    fp = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 1)
    fn = sum(1 for t, p in zip(y_true, y_pred) if t == 1 and p == 0)
    tn = sum(1 for t, p in zip(y_true, y_pred) if t == 0 and p == 0)
    precision = tp / (tp + fp) if tp + fp else 0
    recall = tp / (tp + fn) if tp + fn else 0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0
    return {"tp": tp, "fp": fp, "tn": tn, "fn": fn, "precision": precision, "recall": recall, "f1": f1}
```

## Usalo

Scikit-learn lo hace en seis líneas, correctamente.

```python
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline

pipe = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, sublinear_tf=True, stop_words=None)),
    ("clf", LogisticRegression(C=1.0, max_iter=1000)),
])
pipe.fit(X_train, y_train)
print(pipe.score(X_test, y_test))
```

Tres cosas que hay que notar.`stop_words=None`mantiene las negaciones. `ngram_range=(1, 2)`añade grandes gramos así `not good`se convierte en una característica (scikit-learn une las dos palabras con un espacio). `sublinear_tf=True`Estas tres señales son la diferencia entre un 75% de precisión y un 85% de precisión en el SST-2.

### Cuando se debe buscar un transformador

- Detección de sarcasmo, los modelos clásicos fallan aquí.
- Largas revisiones donde el sentimiento cambia a mediados del documento.
- "La cámara era genial pero la batería era terrible". Necesitas atribuir el sentimiento a aspectos.
- Los idiomas no ingleses y de bajo recurso. BERT multilingüe te da una línea de base de cero disparos de forma gratuita.

Si necesita cualquiera de los anteriores, salte a la fase 7 (mergullamiento profundo de transformadores). de lo contrario, la regresión logística de Naive Bayes o TF-IDF más bigramas más manipulación de negación es su línea de base de producción para 2026.

### La trampa de reproducción (de nuevo)

Reentrenar modelos de sentimiento es rutina. Reevaluarlos no es. Los números de precisión reportados en los documentos utilizan divisiones específicas, preprocesamiento específico, tokenizers específicos. Si compara su nuevo modelo con una línea de base sin usar la misma tubería, obtendrá deltas engañosas. Siempre regenerar la línea de base en su tubería, no el número del papel.

## Envío

Salvo como`outputs/prompt-sentiment-baseline.md`¿Qué es esto ?

```markdown
---
name: sentiment-baseline
description: Design a sentiment analysis baseline for a new dataset.
phase: 5
lesson: 05
---

Given a dataset description (domain, language, size, label granularity, latency budget), you output:

1. Feature extraction recipe. Specify tokenizer, n-gram range, stopword policy (usually keep), negation handling (scoped prefix or bigrams).
2. Classifier. Naive Bayes for baseline, logistic regression for production, transformer only if the domain needs sarcasm / aspects / cross-lingual.
3. Evaluation plan. Report precision, recall, F1, confusion matrix, and per-class error samples (not just scalars).
4. One failure mode to monitor post-deployment. Domain drift and sarcasm are the top two.

Refuse to recommend dropping stopwords for sentiment tasks. Refuse to report accuracy as the sole metric when classes are imbalanced (e.g., 90% positive). Flag subword-rich languages as needing FastText or transformer embeddings over word-level TF-IDF.
```

## Los ejercicios

1. **Easy.**Añadir`apply_negation`como un paso de preprocesamiento en la línea de aprendizaje de scikit y medir el delta de F1 en un pequeño conjunto de datos de sentimiento.
2. **Medium.**Implementar la regresión logística ponderada por clase (pasar `class_weight="balanced"`En el caso de los sistemas de cálculo, el resultado de la evaluación de los resultados de los resultados de los estudios de cálculo es el resultado de la evaluación de los resultados de los resultados de los resultados de los estudios de cálculo.
3. **Hard.**Construye un detector de sarcasmo entrenando un segundo clasificador sobre los residuos del modelo de sentimiento. Documente su configuración experimental. Advierta al lector cuando su precisión esté por debajo de la casualidad (el nivel de probabilidad en el sarcasmo de 2 clases es de ~50%, y la mayoría de los primeros intentos aterrizan allí).

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Polarity | Positive or negative | Binary label; sometimes extended to neutral or fine-grained (5-star). |
| Aspect-based sentiment | Per-aspect polarity | Attribute sentiment to specific entities or attributes mentioned in text. |
| Negation scoping | Reversing nearby tokens | Prefix tokens after "not" with `NOT_` until punctuation. |
| Laplace smoothing | Adding 1 to counts | Prevents zero-probability features in Naive Bayes. |
| L2 regularization | Shrinking weights | Adds `lambda * sum(w^2)` to loss. Essential for sparse text features. |

## Leer más

- [Pang and Lee (2008). Opinion Mining and Sentiment Analysis](https://www.cs.cornell.edu/home/llee/opinion-mining-sentiment-analysis-survey.html)La investigación fundamental es larga, pero las primeras cuatro secciones cubren todo lo clásico.
- [Wang and Manning (2012). Baselines and Bigrams: Simple, Good Sentiment and Topic Classification](https://aclanthology.org/P12-2018/) el periódico que mostró Bigrams + Naive Bayes es difícil de superar en texto corto.
- [scikit-learn text feature extraction docs](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) referencia para `CountVectorizer`¿ Qué ?`TfidfVectorizer`, y cada botón que sintonizarás.
