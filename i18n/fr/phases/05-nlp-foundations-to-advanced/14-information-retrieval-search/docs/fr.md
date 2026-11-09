# Retour et recherche d'informations

> BM25 est précis mais fragile. Dense lance un large filet mais manque de mots clés. Hybrid est le modèle par défaut de 2026.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 04 (GloVe, FastText, Subword)
**Time:** ~75 minutes

## Le problème

L'utilisateur tape "ce qui se passe si quelqu'un ment pour obtenir de l'argent" et s'attend à trouver le statut qui couvre réellement cela: " section 420 IPC. " Une recherche de mots clés la manque entièrement (pas de vocabulaire partagé). Une recherche sémantique la manque si les emblèmes n'ont pas été formés sur le texte juridique.

L'IR est le pipeline sous chaque système RAG, chaque barre de recherche, chaque recherche floue de site de documentation. L'architecture 2026 qui fonctionne dans la production n'est pas une seule méthode.

Cette leçon construit chaque pièce et nom qui échoue chaque capture.

## Le concept

![Hybrid retrieval: BM25 + dense + RRF + cross-encoder rerank](../assets/retrieval.svg)

Choisissez les quatre couches.

1. **Sparse retrieval (BM25).**Rapide, précis sur les correspondances exactes, terrible sur la sémantique. Remplissez un index inversé. Sub-10ms par requête sur des millions de documents. Vous obtenez des références de statut, codes de produit, messages d'erreur, entités nommées correctement.
2. **Dense retrieval.**Encodez la requête et les documents en vecteurs. recherche du voisin le plus proche. Capture des paraphrases et des similitudes sémantiques. Manque des correspondances exactes de mots clés qui diffèrent par un caractère. 50-200 ms par requête avec FAISS ou un vecteur DB.
3. **Fusion.**La fusion de rangs réciproque (RRF) est la solution par défaut parce qu'elle ignore les scores bruts (qui vivent dans différentes échelles) et n'utilise que les positions de rang.
4. **Cross-encoder rerank.**Prenez le top-30 de fusion. Exécutez un cross-encoder (query + document ensemble, en marquant chaque paire). Gardez le top-5.

La récupération à trois voies (BM25 + dense + learn-sparse comme SPLADE) dépasse les deux voies dans les indices de référence de 2026, mais nécessite une infrastructure pour les indices learn-sparse.

```figure
gx-hybrid-retrieval
```

## Faites-le

### Étape 1: BM25 à partir de zéro

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

Deux paramètres qui méritent d'être connus.`k1=1.5`Il est possible de contrôler la saturation par fréquence terminale; plus élevé signifie plus de poids sur la répétition terminale. `b=0.75`Les paramètres par défaut sont les recommandations de Robertson provenant du papier original et nécessitent rarement une mise en forme.

### Étape 2: récupération dense avec un bi-encodeur

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

L2 normaliser les intégrations de sorte que le produit de point est égal au cosine. `all-MiniLM-L6-v2`est 384 dimension, rapide et suffisamment fort pour la plupart des retouches en anglais.`paraphrase-multilingual-MiniLM-L12-v2`Pour une précision maximale,`bge-large-en-v1.5`ou `e5-large-v2`- Je suis désolé .

### Étape 3: fusion de rang réciproque

```python
def reciprocal_rank_fusion(rankings, k=60):
    scores = {}
    for ranking in rankings:
        for rank, (_, doc_idx) in enumerate(ranking):
            scores[doc_idx] = scores.get(doc_idx, 0.0) + 1.0 / (k + rank + 1)
    fused = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [(score, doc_idx) for doc_idx, score in fused]
```

Le `k=60`La constante provient du papier original RRF.`k`réduit la contribution des différences de rang;`k`60 est la version par défaut publiée et nécessite rarement une mise en forme.

### Étape 4: recherche hybride + réaffectation

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

BM25 trouve des correspondances léxicales. Dense trouve des correspondances sémantiques. RRF fusionne les deux classements sans avoir besoin d'une calibration de score. Cross-encoder récorde le top-30 en utilisant des paires de documents de requête ensemble, ce qui capture une pertinence fine graine du bi-encodeur manqué. Gardez le top-5.

### Étape 5: évaluation

| Metric | Meaning |
|--------|---------|
| Recall@k | Of queries where the correct document exists, how often is it in the top-k? |
| MRR (Mean Reciprocal Rank) | Average of 1/rank of first relevant document. |
| nDCG@k | Accounts for relevance gradations, not just binary relevant/not. |

Pour RAG spécifiquement, **Recall@k**Le lecteur ne peut pas répondre si le passage correct n'est pas dans l'ensemble récupéré.

Pour les requêtes qui ne sont pas correctes, différez les classements rares et denses. Si l'un trouve le bon document et l'autre non, vous avez un déséquilibre vocabulaire (fix: ajouter la moitié manquante) ou une ambiguïté sémantique (fix: meilleures emblèmes ou un réencadrement).

## Utilisez-le

La pile de 2026:

| Scale | Stack |
|-------|-------|
| 1k-100k docs | In-memory BM25 + `all-MiniLM-L6-v2` embeddings + RRF. No separate DB. |
| 100k-10M docs | FAISS or pgvector for dense + Elasticsearch / OpenSearch for BM25. Run in parallel. |
| 10M+ docs | Qdrant / Weaviate / Vespa / Milvus with hybrid support. Cross-encoder rerank on top-30. |
| Best-quality frontier | Three-way (BM25 + dense + SPLADE) + ColBERT late-interaction reranking |

Quoi que vous choisissiez, budget pour l'évaluation. Rappel de référence avant de comparer la précision de fin à fin RAG. Un lecteur ne peut pas corriger ce que le récupérateur a manqué.

### Les leçons durement acquises de la production RAG 2026

- **80% of RAG failures trace to ingestion and chunking, not the model.**Les équipes passent des semaines à échanger des LLM et à régler les instructions, tandis que la récupération renvoie le mauvais contexte à chaque troisième requête.
- **Chunking strategy matters more than chunk size.**Les tableaux, les codes et les en-têtes sont divisés en deux.
- **Parent-doc pattern.**Retirer de petits morceaux " enfant " pour une précision. Lorsque plusieurs enfants de la même section parent apparaissent, échanger dans le bloc parent pour préserver le contexte. Cela améliore systématiquement la qualité des réponses sans recyclage.
- **k_rerank=3 is usually optimal.**Chaque pièce supplémentaire qui ajoute le coût des jetons et la latence de génération sans augmenter la qualité des réponses.
- **HyDE / query expansion.**Générer une réponse hypothétique à partir de la requête, intégrer, récupérer. Couper le fossé entre les questions courtes et les documents longs.
- **Context budget under 8K tokens.**Des coups constants à cette limite signifient que le seuil de ré-rangement est trop lâche.
- **Version everything.**Les instructions, les règles de déchiquetage, le modèle d'intégration, le réencadrement. Toute dérive brise silencieusement la qualité des réponses. Les portes de l'IC sur la fidélité, la précision du contexte et le taux de requête non répondue bloquent les régressions avant que les utilisateurs ne les voient.
- **Three-way retrieval (BM25 + dense + learned-sparse like SPLADE) outperforms two-way**Envoyer lorsque l'infrastructure prend en charge les indices SPLADE.

Une conception correcte de récupération réduit les hallucinations de 70-90% selon les mesures de l'industrie de 2026.

## La faire partir

- Je ne sais pas .`outputs/skill-retrieval-picker.md`- Le numéro de la liste:

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

## Exercices

1. **Easy.**Mise en œuvre `hybrid_search`Comparer le rappel à 5 entre BM25 seulement, dense seulement et hybride.
2. **Medium.**Ajoutez le calcul MRR. Pour chaque requête de test avec un document correct connu, trouvez le rang du document correct dans les classements BM25, dense et hybride.
3. **Hard.**Téléchargez un codeur dense sur votre domaine en utilisant MultipleNegativesRankingLoss (Transformateurs de sentences). Construisez un ensemble de formation à partir de 500 paires de requêtes-document. Comparer le rappel avant et après la télétravail.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| BM25 | Keyword search | Okapi BM25. Scores documents by term frequency, IDF, and length. |
| Dense retrieval | Vector search | Encode query + doc into vectors, find nearest neighbors. |
| Bi-encoder | Embedding model | Encodes query and doc independently. Fast at query time. |
| Cross-encoder | Reranker model | Encodes query + doc together. Slow but accurate. |
| RRF | Rank fusion | Combine two rankings by summing `1/(k + rank)`. |
| Recall@k | Retrieval metric | Fraction of queries where a relevant doc is in the top-k. |

## Pour en savoir plus

- [Robertson and Zaragoza (2009). The Probabilistic Relevance Framework: BM25 and Beyond](https://www.staff.city.ac.uk/~sbrp622/papers/foundations_bm25_review.pdf) le traitement définitif de BM25.
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) DPR, le bi-encodeur canonique.
- [Formal et al. (2021). SPLADE: Sparse Lexical and Expansion Model](https://arxiv.org/abs/2107.05720)Le retriever à sparsité apprise qui ferme l'écart avec dense.
- [Cormack, Clarke, Büttcher (2009). Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf) papier RRF.
- [Khattab and Zaharia (2020). ColBERT: Efficient and Effective Passage Search](https://arxiv.org/abs/2004.12832) Retrait en interaction tardive.
