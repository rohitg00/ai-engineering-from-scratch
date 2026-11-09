# Modélisation de thèmes  LDA et BERTopic

> LDA: les documents sont des mélanges de sujets, les sujets sont des distributions sur des mots. BERTopic: les documents sont un cluster dans un espace intégré, les clusters sont des sujets. Le même objectif, des décompositions différentes.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 03 (Word2Vec)
**Time:** ~45 minutes

## Le problème

Vous avez 10 000 billets de soutien à la clientèle, 50 000 articles d'actualité ou 200 000 tweets. Vous devez savoir ce que la collection est sans le lire. Vous n'avez pas de catégories étiquetées. Vous ne savez même pas combien de catégories existent.

La modélisation de thèmes répond à cela sans supervision. Donnez-lui un corpus, obtenez un petit ensemble de thèmes cohérents et, pour chaque document, une distribution sur ces thèmes.

Deux familles algorithmiques dominent. LDA (2003) traite chaque document comme un mélange de sujets latents et chaque sujet comme une distribution sur des mots. L'inférence est bayésienne.

BERTopic (2020) encode les documents avec BERT, réduit la dimensionnalité avec UMAP, les clusters avec HDBSCAN et extrait les mots de thème via TF-IDF basé sur la classe. Il gagne sur le texte court, les médias sociaux et tout ce qui compte plus que la similitude sémantique que la chevauchée des mots. Un document obtient un sujet, ce qui est une limitation pour le contenu de forme longue.

Cette leçon construit l'intuition pour les deux et les noms à choisir pour un corps donné.

## Le concept

![LDA mixture model vs BERTopic clustering](../assets/topic-modeling.svg)

**LDA generative story.**Chaque sujet est une distribution sur des mots. Chaque document est un mélange de sujets. Pour générer un mot dans un document, prenez un échantillon d'un sujet du mélange du document, puis prenez un échantillon d'un mot de la distribution de ce sujet. L'inférence inverse ceci: étant donné les mots observés, inférez la distribution de sujet par document et la distribution de mots par sujet.

L'alimentation de base de l'AEL:

- `doc_topic`: matrice `(n_docs, n_topics)`, chaque ligne s'élève à 1 (mixture de thèmes du document).
- `topic_word`: matrice `(n_topics, vocab_size)`, chaque ligne s'élève à 1 (distribution des mots du sujet).

**BERTopic pipeline.**

1. Encodez chaque document avec un transformateur de phrases (p. ex., `all-MiniLM-L6-v2`Les vecteurs de 384 dimensions.
2. Réduire la dimensionnalité avec UMAP à ~5 dimensions.
3. Cluster avec HDBSCAN. basé sur la densité, produit des clusters de taille variable et un label "outlier".
4. Pour chaque cluster, calculer TF-IDF basé sur la classe sur les documents du cluster pour extraire les mots les plus importants.

La sortie est un sujet par document (plus une étiquette de -1), optionnellement, une adhésion douce via le vecteur de probabilité de HDBSCAN.

```figure
topic-drift
```

## Faites-le

### Étape 1: LDA via scikit-learn

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

Remarque: les mots d'arrêt supprimés, min_df et max_df filtrent des termes rares et omniprésents, CountVectorizer (pas TfidfVectorizer) parce que LDA s'attend à des comptes bruts.

### Étape 2: BERTopic (production)

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

Le filtre est allumé .`Topic != -1`dépose le bac à écarts de BERTopic (documents que HDBSCAN ne pouvait pas regrouper). `min_topic_size`Il est également possible de calculer la taille minimale du cluster HDBSCAN; la taille par défaut de la bibliothèque BERTopic est 10.

### Étape 3: évaluation

Les deux méthodes produisent des mots de thème.

- **Topic coherence (c_v).**Combine NPMI (informations mutuelles normales en sens ponctuel) des paires de mots de haut niveau sur des contextes de fenêtre coulissante, agrégant les scores en vecteurs de sujet et comparant ces vecteurs par similitude cosine.`gensim.models.CoherenceModel`avec `coherence="c_v"`- Je suis désolé .
- **Topic diversity.**Fraction de mots uniques sur les mots clés de tous les sujets.
- **Qualitative inspection.**Les mots clés de chaque sujet sont-ils réels?

## Quand choisir lequel

| Situation | Pick |
|-----------|------|
| Short text (tweets, reviews, headlines) | BERTopic |
| Long documents with topic mixtures | LDA |
| No GPU / limited compute | LDA or NMF |
| Need document-level multi-topic distributions | LDA |
| LLM integration for topic labeling | BERTopic (direct support) |
| Resource-constrained edge deployment | LDA |
| Max semantic coherence | BERTopic |

La plus grande considération pratique est la longueur du document. Les emplacements BERT tronquent; LDA compte le travail sur n'importe quelle longueur. Pour les documents plus longs que le contexte du modèle d'embedding, soit chunk + aggregate ou utilisez LDA.

## Utilisez-le

La pile de 2026:

- **BERTopic.**Par défaut pour le texte court et tout ce qui a de la signification.
- **`gensim.models.LdaModel`.**LDA classique pour la production, mature, testée en combat.
- **`sklearn.decomposition.LatentDirichletAllocation`.**LDA facile pour les expériences.
- **NMF.**Factorisation de matrice non négative, alternative rapide à LDA, qualité comparable sur texte court.
- **Top2Vec.**Conception similaire à BERTopic, communauté plus petite mais bonne sur certaines critères de référence.
- **FASTopic.**Plus récente, plus rapide que BERTopic sur de très gros corps.
- **LLM-based labeling.**Exécutez une clôture, puis demandez à un modèle de nommer chaque cluster.

## La faire partir

- Je ne sais pas .`outputs/skill-topic-picker.md`- Le numéro de la liste:

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

## Exercices

1. **Easy.**LDA avec 5 sujets sur le jeu de données de 20 Newsgroups. Imprimez les 10 premiers mots par sujet. Étiquettez chaque sujet à la main. L'algorithme a-t-il trouvé les vraies catégories?
2. **Medium.**Réglez BERTopic sur le même sous-ensemble de 20 Newsgroups. Comparer le nombre de sujets trouvés, les mots clés et la cohérence qualitative par rapport à LDA.
3. **Hard.**Comptez la cohérence c_v pour LDA et BERTopic sur votre corpus. Exécutez chacun avec 5, 10, 20, 50 sujets.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Topic | A thing the corpus is about | A probability distribution over words (LDA) or a cluster of similar documents (BERTopic). |
| Mixed membership | Doc is multiple topics | LDA assigns each document a distribution over all topics. |
| UMAP | Dimensionality reduction | Manifold learning that preserves local structure; used in BERTopic. |
| HDBSCAN | Density clustering | Finds variable-size clusters; produces "noise" label (-1) for outliers. |
| c_v coherence | Topic quality metric | NPMI of top topic words over sliding windows, turned into context vectors and compared with cosine similarity. |

## Pour en savoir plus

- [Blei, Ng, Jordan (2003). Latent Dirichlet Allocation](https://www.jmlr.org/papers/volume3/blei03a/blei03a.pdf) le journal de l'Agence de l'emploi.
- [Grootendorst (2022). BERTopic: Neural topic modeling with a class-based TF-IDF procedure](https://arxiv.org/abs/2203.05794) le journal BERTopic.
- [Röder, Both, Hinneburg (2015). Exploring the Space of Topic Coherence Measures](https://svn.aksw.org/papers/2015/WSDM_Topic_Evaluation/public.pdf)Le journal qui a introduit c_v et les amis.
- [BERTopic documentation](https://maartengr.github.io/BERTopic/) la référence de production.
