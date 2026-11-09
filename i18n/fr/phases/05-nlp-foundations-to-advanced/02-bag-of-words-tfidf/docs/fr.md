# Le sac de mots, TF-IDF et représentation du texte

> Le TF-IDF va encore mieux que les embeddings sur des tâches bien définies en 2026.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 02 (Linear Regression from Scratch)
**Time:** ~75 minutes

## Le problème

Le modèle a besoin de numéros.

Chaque pipeline de PNL doit répondre à la même question. Comment transformer un flux de jetons de longueur variable en un vecteur de taille fixe que le classifiateur peut consommer. La première réponse sur laquelle le champ a atterri était la plus stupide qui fonctionne. Comptez les mots. Faites un vecteur.

Ce vecteur a produit plus de PNL de production que tout autre modèle d'intégration. Filtres de spam, classifiateurs de sujets, détection d'anomalies de journaux, classement de recherche (avant BM25), première vague d'analyse des sentiments, première décennie de benchmarks de PNL académiques. En 2026, les praticiens atteignent toujours la première place sur des tâches de classification étroites. Il est rapide, interprétable et souvent indistinguible d'un modèle d'intégration de paramètres de 400 M dans des tâches où la présence de mots est ce qui compte.

Cette leçon construit un sac de mots, puis TF-IDF, à partir de zéro, puis montre scikit-apprendre faire la même chose en trois lignes, puis nomme le mode d'échec qui vous fait atteindre pour les emblèmes.

## Le concept

**Bag of Words (BoW)**Pour chaque document, comptez combien de fois chaque mot de vocabulaire apparaît.`i`est le nombre de mots `i`- Je suis désolé .

**TF-IDF**Un mot qui apparaît dans chaque document est non informatif, donc réduisez-le. Un mot rare dans le corpus mais fréquent dans un seul document est un signal, donc redoublez-le.

```math
\begin{aligned}
\text{TF-IDF}(w, d) &= \text{TF}(w, d) \cdot \text{IDF}(w) \\
&= \frac{\mathop{\mathrm{count}}(w \text{ in } d)}{|d|} \cdot \log\frac{N}{\mathop{\mathrm{df}}(w)}
\end{aligned}
```

Où ?`TF`est la fréquence des termes dans le document, `df`est la fréquence du document (combien de documents contiennent le mot), `N`Les documents sont totaux.`log`Il garde le poids limité pour les mots omniprésents.

Propriété clé: les deux produisent des vecteurs rares avec des axes interprétables. Vous pouvez regarder les poids d'un classifiateur formé et lire quels mots poussent un document vers chaque classe. Vous ne pouvez pas le faire avec une intégration BERT 768-dimensionnelle.

```figure
bow-tfidf
```

## Faites-le

### Étape 1: construire le vocabulaire

```python
def build_vocab(docs):
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    return vocab
```

Entrée: liste des documents Tokenized (tout Tokenizer au niveau des mots le fera; le `code/main.py`Dans cette leçon, une variante en minuscules simplifiée est utilisée.`{word: index}`L'ordre d'insertion stable signifie que l'index de mots 0 est le premier mot vu dans le premier document.

### Étape 2: sac de mots

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

Les lignes sont des documents, les colonnes sont des indices de vocabulaire.`[i][j]`est "combien de fois le mot `j`apparaît dans le document `i`. " Doc 1 a été`cat`Deux fois parce qu'il l'a fait.`ran`Zéro fois parce que ce n'est pas le cas.

### Étape 3: fréquence des termes et fréquence des documents

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

Deux astuces qui méritent d'être nommées.`(n+1)/(d+1)`éviter `log(x/0)`- Le trail .`+1`Il est également possible de faire en sorte qu'un mot dans chaque document ait toujours IDF 1 (et non 0), ce qui correspond à l'interface par défaut de scikit-learn.`log(N/df)`Les deux fonctionnent, la version lisse est plus conviviale.

### Étape 4: TF-IDF

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

Trois documents, cinq mots vocabulaires (`the`- Je suis là .`cat`- Je suis là .`sat`- Je suis là .`dog`- Je suis là .`ran``the`apparaît dans les trois, donc son IDF est faible. `dog`Les mots discriminatifs apparaissent dans un seul, donc leur IDF est élevée.

### Étape 5: normaliser les rangées L2

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

Sans normalisation, un document plus long obtient un vecteur plus grand et domine les scores de similitude. La normalisation L2 met chaque document sur l'hypersphère unitaire.

## Utilisez-le

Scikit-Learn envoie la version de production.

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

`CountVectorizer`fait la tokenization, le vocabulaire et le BoW en un seul appel. `TfidfVectorizer`Les deux matrices sont rares. pour 100 000 documents, la version dense ne s'inscrit pas dans la mémoire; reste rare jusqu'à ce que le classifiateur demande dense.

Des boutons qui changent tout:

| Arg | Effect |
|-----|--------|
| `ngram_range=(1, 2)` | Include bigrams. Usually boosts classification. |
| `min_df=2` | Drop words in fewer than 2 docs. Trims vocabulary on noisy data. |
| `max_df=0.95` | Drop words in more than 95% of docs. Approximates stopword removal without a hardcoded list. |
| `stop_words="english"` | scikit-learn's builtin stopword list. Task-dependent — sentiment analysis should *not* drop negations. |
| `sublinear_tf=True` | Use `1 + log(tf)` instead of raw `tf`. Helps when a term repeats many times in one doc. |

### Lorsque le TF-IDF gagne toujours (à partir de 2026)

- La détection du spam, l'étiquetage des sujets, le démarrage des anomalies du journal.
- Les régimes à faible données (des centaines d'exemples étiquetés) TF-IDF plus régression logistique ne nécessitent aucun coût de pré-entraînement.
- La latence est importante partout. TF-IDF plus un modèle linéaire répond en microsecondes.
- Les systèmes qui doivent expliquer leurs prédictions, examiner les coefficients du classifiateur, les mots positifs sont la raison.

### Lorsque le TF-IDF échoue

L'échec de la cécité sémantique.

- "Le film n'était pas du tout bon".
- "Le film était excellent".

L'une est négative, l'autre est positive, leur superposition entre les deux est exactement la même.`{the, movie, was}`Un classifiateur de sacs de mots doit mémoriser ce mot .`not`près de`good`Il peut apprendre cela sur suffisamment de données, mais jamais aussi gracieusement qu'un modèle qui comprend la syntaxe.

L'autre échec: des mots hors vocabulaire à l'inférence.`Zoomer-approved`Les sous-verbes (leçon 04) gèrent cela. TF-IDF ne peut pas.

### Hybride: intégrations pondérées TF-IDF

Le principe par défaut pragmatique de 2026 pour la classification des données moyennes: utiliser les poids TF-IDF comme attention sur les emblèmes de mots.

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

Vous obtenez la capacité sémantique des emblèmes et l'accent sur les mots rares du TF-IDF. Le classifiateur se forme sur le vecteur regroupé. Cela dépasse soit par lui-même la classification des sentiments, des sujets et des intentions en dessous d'environ 50 000 exemples étiquetés.

## La faire partir

- Je ne sais pas .`outputs/prompt-vectorization-picker.md`- Le numéro de la liste:

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

## Exercices

1. **Easy.**Mise en œuvre `cosine_similarity(doc_vec_a, doc_vec_b)`vérifier que les documents identiques obtiennent un score de 1,0 et les documents de vocabulaire disjoint un score de 0,0.
2. **Medium.**Ajouter `n-gram`soutien à `bag_of_words`Paramètre .`n`produit des comptes sur `n`- Je vais tester ça.`n=2`sur`["the", "cat", "sat"]`produit des nombres de bigrammes pour `["the cat", "cat sat"]`- Je suis désolé .
3. **Hard.**Construisez l'hybrid intégré pondéré TF-IDF ci-dessus en utilisant les vecteurs GloVe 100d (télécharger une fois, cache). Comparer la précision de classification avec les intégrations simples TF-IDF et simples en moyenne intégrées sur le jeu de données 20 Newsgroups. Rapporte qui gagne où.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BoW | Word frequency vector | Counts of vocabulary words in one document. Throws away order. |
| TF | Term frequency | Count of a word in a document, optionally normalized by document length. |
| DF | Document frequency | Count of documents containing the word at least once. |
| IDF | Inverse document frequency | `log(N / df)` smoothed. Downweights words that appear everywhere. |
| Sparse vector | Mostly zeros | Vocabulary is typically 10k-100k words; most are absent from any given document. |
| Cosine similarity | Vector angle | Dot product of L2-normalized vectors. 1 is identical, 0 is orthogonal. |

## Pour en savoir plus

- [scikit-learn — feature extraction from text](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) la référence canonique de l'API, plus des notes sur chaque bouton.
- [Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval](https://www.sciencedirect.com/science/article/pii/0306457388900210) le papier qui a fait du TF-IDF le défaut pendant une décennie.
- ["Why TF-IDF Still Beats Embeddings" — Ashfaque Thonikkadavan (Medium)](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2) 2026 prendre quand l'ancienne méthode gagne et pourquoi.
