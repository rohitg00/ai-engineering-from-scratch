# Analyse des sentiments

> La plupart de ce que vous devez savoir sur la classification classique du texte apparaît ici.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 2 · 14 (Naive Bayes)
**Time:** ~75 minutes

## Le problème

"La nourriture n'était pas bonne". Positive ou négative?

Le sentiment semble simple. Un critique a dit qu'il aimait ou n'aimait pas quelque chose. Étiquettez la phrase. La raison pour laquelle elle est devenue la tâche canonique de la PNL est que chaque cas facile à regarder cache un cas difficile. La négation renverse le sens. Le sarcasme le renverse. " Pas du tout mauvais " est positif malgré deux mots codés négatifs.`tight`dans la revue musicale versus `tight`dans la revue de la mode).

Si vous comprenez pourquoi chaque ligne de base naïve a un mode d'échec spécifique, vous comprenez pourquoi chaque modèle riche a été inventé. Cette leçon construit une ligne de base naïve Bayes à partir de zéro, ajoute la régression logistique et nomme les pièges qui font du sentiment de production un problème de conformité.

## Le concept

Le sentiment classique est une recette en deux étapes.

1. **Represent.**Transformer le texte en vecteur de fonctionnalités.
2. **Classify.**Adaptation d'un modèle linéaire (Naive Bayes, régression logistique, SVM) sur des exemples étiquetés.

Bayes est le modèle le plus stupide qui fonctionne.`P(word | positive)`et `P(word | negative)`En effet, les résultats sont étonnamment forts: avec des caractéristiques de texte rares et des données modérées, le classifiateur se soucie de savoir de quel côté chaque mot se penche plutôt que de combien.

La régression logistique corrige l'hypothèse d'indépendance. Elle apprend un poids par caractéristique, y compris des poids négatifs. `not good`Bayes naïf ne peut pas faire cela pour des bigrammes qu'il n'a jamais étiquetés.

```figure
sentiment-logits
```

## Faites-le

### Étape 1: un véritable mini-ensemble de données

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

Le travail réel utilise des dizaines de milliers d'exemples (IMDb, SST-2, polarité Yelp).

### Étape 2: Naïve Bayes multinomial à partir de zéro

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

Le smoothing additif (alpha=1.0) est le smoothing Laplace. Sans lui, un mot invisible dans une classe a une probabilité de zéro et le log explose. `alpha=0.01`est commun dans la pratique. `alpha=1.0`est le défaut d'enseignement.

### Étape 3: régression logistique à partir de zéro

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

La régularisation de l'L2 est importante ici. Les caractéristiques du texte sont rares; sans L2 le modèle mémorise des exemples de formation.`0.01`et à la musique.

### Étape 4: négation de la manutention (mode défaillance)

Considérez "pas bon" et "pas mal".`{not, good}`et `{not, bad}`Il apprend de qui il est le plus présent.`not_good`et `not_bad`Il est donc nécessaire de les apprendre comme caractéristiques distinctes.

Un remède plus brut qui fonctionne quand on n' a pas de bigrammes:**negation scoping**. Préfixe des jetons suivant un mot de négation avec `NOT_`jusqu'à la prochaine ponctuation.

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

- Je suis désolé .`good`et `NOT_good`Les trois lignes de pré-traitement, de précision mesurable, sautent sur les benchmarks de sentiment.

### Étape 5: les mesures d'évaluation qui comptent

La précision seule est trompeuse si les classes sont déséquilibrées. Les vrais sentiments corporels sont généralement de 70-80% positifs ou de 70-80% négatifs; un classificateur à majorité constante obtient une précision de 80% et est sans valeur.

- **Per-class precision and recall.**Une paire par classe, et une moyenne macro pour obtenir un seul nombre qui respecte l'équilibre de classe.
- **Macro-F1 (primary metric for imbalanced data).**La moyenne des scores par classe, avec le même poids.
- **Weighted-F1 (alternative).**Rapporte avec la macro-F1 lorsque le déséquilibre lui-même a une signification commerciale.
- **Confusion matrix.**Il faut toujours vérifier avant de faire confiance à une métrique scalaire, elle révèle quel couple de classes le modèle confond.
- **Per-class error samples.**Tirez 5 erreurs de prédiction par classe. Lisez-les. Rien ne remplace la lecture des erreurs réelles.

Pour les données gravement déséquilibrées (> rapport 95-5), le rapport **AUROC**et **AUPRC**Au lieu de l'exactitude, l'AUPRC est plus sensible à la classe minoritaire, ce qui est ce qui vous intéresse habituellement (spam, fraude, sentiment rare).

**Common bug to avoid.**En rapportant micro-F1 au lieu de macro-F1 sur des données déséquilibrées, on obtient un nombre qui semble élevé parce qu'il est dominé par la classe majoritaire.

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

## Utilisez-le

Scikit-learn le fait en six lignes, correctement.

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

Trois choses à remarquer.`stop_words=None`Il ne peut pas se permettre de négationner.`ngram_range=(1, 2)`ajoute des bigrammes donc `not good`devient une caractéristique (scikit-learn relie les deux mots par un espace). `sublinear_tf=True`Ces trois indicateurs représentent la différence entre une base de 75% et une base de 85% sur SST-2.

### Quand trouver un transformateur

- Les modèles classiques échouent ici.
- Des critiques longues où le sentiment change au milieu du document.
- "La caméra était super mais la batterie était terrible". Vous devez attribuer le sentiment aux aspects.
- Les langues non anglaises et à faible consommation de ressources.

Si vous avez besoin de l'un des éléments ci-dessus, passez à la phase 7 (merde profonde des transformateurs).

### Le piège de la reproductibilité (encore une fois)

La réapprentissage des modèles de sentiment est routinière. La réévaluation de ces modèles n'est pas. Les chiffres de précision rapportés dans les documents utilisent des fractions spécifiques, des pré-traitement spécifiques, des jetons spécifiques. Si vous comparez votre nouveau modèle à une ligne de base sans utiliser le même pipeline, vous obtiendrez des delta trompeurs.

## La faire partir

- Je ne sais pas .`outputs/prompt-sentiment-baseline.md`- Le numéro de la liste:

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

## Exercices

1. **Easy.**Ajouter `apply_negation`comme étape de pré-traitement dans le pipeline scikit-learn et mesurer le delta de la F1 sur un petit ensemble de données de sentiment.
2. **Medium.**Implémentation de la régression logistique pondérée par classe (passage `class_weight="balanced"`Mesurer l'effet sur un déséquilibre synthétique de classe 90-10.
3. **Hard.**Construisez un détecteur de sarcasme en formant un deuxième classifiateur sur les résidus du modèle de sentiment. Documentez votre configuration expérimentale. Avertissez le lecteur lorsque votre précision est inférieure à la chance (le niveau de chance sur le sarcasme de 2 classes est de ~ 50% et la plupart des premières tentatives y atterrissent).

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Polarity | Positive or negative | Binary label; sometimes extended to neutral or fine-grained (5-star). |
| Aspect-based sentiment | Per-aspect polarity | Attribute sentiment to specific entities or attributes mentioned in text. |
| Negation scoping | Reversing nearby tokens | Prefix tokens after "not" with `NOT_` until punctuation. |
| Laplace smoothing | Adding 1 to counts | Prevents zero-probability features in Naive Bayes. |
| L2 regularization | Shrinking weights | Adds `lambda * sum(w^2)` to loss. Essential for sparse text features. |

## Pour en savoir plus

- [Pang and Lee (2008). Opinion Mining and Sentiment Analysis](https://www.cs.cornell.edu/home/llee/opinion-mining-sentiment-analysis-survey.html)- l'enquête fondatrice. Longue, mais les quatre premières sections couvrent tout ce qui est classique.
- [Wang and Manning (2012). Baselines and Bigrams: Simple, Good Sentiment and Topic Classification](https://aclanthology.org/P12-2018/) Le journal qui montrait Bigrams + Naive Bayes est difficile à battre sur le texte court.
- [scikit-learn text feature extraction docs](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) référence à `CountVectorizer`- Je suis là .`TfidfVectorizer`, et chaque bouton que vous réglerez.
