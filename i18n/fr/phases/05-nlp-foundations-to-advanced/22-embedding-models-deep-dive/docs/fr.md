# Modèles intégrés  La plongée profonde de 2026

> Word2Vec vous donne un vecteur par mot. Les modèles modernes d'intégration vous donnent un vecteur par passage, translinguiste, avec des vues rares, denses et multi-vectorielles, dimensionnées pour correspondre à votre index. Choisissez mal et votre RAG récupère la mauvaise chose.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 03 (Word2Vec), Phase 5 · 14 (Information Retrieval)
**Time:** ~60 minutes

## Le problème

Votre système RAG récupère le mauvais passage 40% du temps. Le coupable est rarement la base de données vectorielle ou le prompt.

Le choix d'une intégration en 2026 signifie de choisir à travers cinq axes:

1. **Dense vs sparse vs multi-vector.**Un vecteur par passage, ou un par jeton, ou un sac de mots.
2. **Language coverage.**Les modèles anglais monolingues gagnent toujours sur les tâches uniquement en anglais.
3. **Context length.**512 jetons contre 8.192 contre 32.768  et la capacité effective réelle est souvent de 60-70% du maximum annoncé.
4. **Dimension budget.**Avec une précision totale de 3 072 flots = 12 KB par vecteur.
5. **Open vs hosted.**Le poids ouvert signifie que vous contrôlez la pile et les données.

Cette leçon nomme les compromis pour que vous puissiez tirer parti des preuves, pas de ce qui était populaire au dernier trimestre.

## Le concept

![Dense, sparse, and multi-vector embeddings](../assets/embedding-modes.svg)

**Dense embeddings.**Un vecteur par passage (généralement 384-3,072 dimensions).`text-embedding-3-large`, mode densité BGE-M3, Voyage-3.

**Sparse embeddings.**Un transformateur prédit un poids pour chaque jeton de vocabulaire, puis les zéros de la plupart d'entre eux. Le résultat est un vecteur de taille épars avec une vocabelle. Capture le correspondement lexicale (comme BM25) mais avec des poids de termes appris. Fort sur les requêtes de mots clés lourds.

**Multi-vector (late interaction).**ColBERTv2, Jina-ColBERT. Un vecteur par jeton. Scoring avec MaxSim: pour chaque jeton de requête, trouver le jeton document le plus similaire, additionner les scores. Plus cher à stocker et à scorer, mais gagne sur de longues requêtes et des corps spécifiques à un domaine.

**BGE-M3: all three at once.**Le modèle unique produit simultanément des représentations denses, rares et multi-vectorielles. Chacun peut être interrogé indépendamment; les scores se fusionnent via la somme pondérée.

**Matryoshka Representation Learning.**Il est utilisé pour la création de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image de l'image.

### Le classement MTEB raconte une histoire partielle

En 2026, Gemini Embedding 2 atteint le sommet de la récupération (67,71 MTEB-R). Cohere embed-v4 mène généralement (65,2 MTEB). BGE-M3 mène multilingue à poids ouvert (63,0). Le tableau de classement est nécessaire mais pas suffisant  toujours référence sur votre domaine.

### Le modèle à trois niveaux

| Use case | Pattern |
|----------|---------|
| Fast first-pass | Dense bi-encoder (BGE-M3, text-3-small) |
| Recall boost | Sparse (SPLADE, BGE-M3 sparse) + RRF fuse |
| Precision on top-50 | Multi-vector (ColBERTv2) or cross-encoder reranker |

La plupart des piles de production utilisent les trois.

```figure
gx-matryoshka
```

## Faites-le

### Étape 1: ligne de base  intégrations denses avec Sentence-BERT

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

`normalize_embeddings=True`le produit des points est égal à la similitude cosine.

### Étape 2: troncation de matryoshka

```python
def truncate(vectors, dim):
    out = vectors[:, :dim]
    return out / np.linalg.norm(out, axis=1, keepdims=True)

emb_256 = truncate(emb, 256)
emb_128 = truncate(emb, 128)
```

Nomic v1.5, OpenAI text-3, et Voyage-4 sont formés de sorte que cela est sans perte pour les premiers niveaux. Les modèles non-matryoshka (Sentence-BERT d'origine) dégradent fortement lorsqu'ils sont tronqués.

### Étape 3: Multifonctionnalité BGE-M3

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

Trois indices, une inférence.

```python
dense_score = ... # cosine over dense_vecs
sparse_score = model.compute_lexical_matching_score(q_lex, d_lex)
colbert_score = model.colbert_score(q_col, d_col)
final = 0.4 * dense_score + 0.2 * sparse_score + 0.4 * colbert_score
```

Ajustez les poids à votre domaine.

### Étape 4: Évaluation MTEB sur une tâche personnalisée

```python
from mteb import MTEB

tasks = ["ArguAna", "SciFact", "NFCorpus"]
evaluation = MTEB(tasks=tasks)
results = evaluation.run(encoder, output_folder="./mteb-results")
```

Exécutez vos modèles de candidats sur un sous-ensemble *représentatif* Ne faites pas confiance au classement du classement seul  votre domaine compte.

### Étape 5: cosine roulé à la main à partir de zéro

Regardez !`code/main.py`. Embeddings Hashing Trick moyens (stdlib seulement). Ne sont pas compétitifs avec les embeddings transformateurs, mais montrent la forme: tokenize → vecteur → normaliser → produit de point.

## Les pièges

- **Same model for query and doc.**Certains modèles (Voyage, Jina-ColBERT) utilisent un codage asymétrique  requête et document passent par différents chemins.
- **Missing prefix.** `bge-*`Les modèles ont besoin `"Represent this sentence for searching relevant passages: "`3 à 5 points de recul si vous oubliez.
- **Over-trimming Matryoshka.**1,536 → 256 est généralement sûr. 1,536 → 64 n'est pas. Validez sur votre ensemble d'évaluation.
- **Context truncation.**La plupart des modèles réduisent silencieusement les entrées sur leur longueur maximale.
- **Ignoring latency tail.**Les scores MTEB cachent la latence p99. Un modèle 600M pourrait battre un modèle 335M de 2 points mais coûte 3 fois plus par requête.

## Utilisez-le

La pile de 2026:

| Situation | Pick |
|-----------|------|
| English-only, fast, API | `text-embedding-3-large` or `voyage-3-large` |
| Open-weight, English | `BAAI/bge-large-en-v1.5` |
| Open-weight, multilingual | `BAAI/bge-m3` or `Qwen3-Embedding-8B` |
| Long context (32k+) | Voyage-3-large, Cohere embed-v4, Qwen3-Embedding-8B |
| CPU-only deployment | Nomic Embed v2 (137M params, MoE) |
| Storage-constrained | Matryoshka-truncated + int8 quantization |
| Keyword-heavy queries | Add SPLADE sparse, RRF-fuse with dense |

Modèle 2026: commencez par BGE-M3 ou texte-3-grand, évaluez sur votre domaine avec MTEB, échangez si un modèle spécifique à un domaine gagne de plus de 3 points.

## La faire partir

- Je ne sais pas .`outputs/skill-embedding-picker.md`- Le numéro de la liste:

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

## Exercices

1. **Easy.**Encodez 100 phrases avec `bge-small-en-v1.5`La valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur est est est est est est est est est est est est est est est est est est est est est est est est est est est est est est est est est de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de
2. **Medium.**Comparer BGE-M3 dense, rare et colbert sur 500 passages de votre domaine.
3. **Hard.**Exécutez MTEB sur trois modèles candidats sur vos tâches de domaine 2 principales. Rapportez le score MTEB, la latence p99 sur un lot de 100 requêtes et les requêtes de 1 million $. Choisissez le Pareto-optimal.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Dense embedding | The vector | One fixed-size vector per text. Cosine similarity for ranking. |
| Sparse embedding | Learned BM25 | One weight per vocab token; mostly zeros; trained end-to-end. |
| Multi-vector | ColBERT-style | One vector per token; MaxSim scoring; bigger index, better recall. |
| Matryoshka | Russian doll trick | First N dims are a valid smaller embedding on their own. |
| MTEB | The benchmark | Massive Text Embedding Benchmark — 56 tasks at launch, 100+ in v2. |
| BEIR | The retrieval benchmark | 18 zero-shot retrieval tasks; often cited for cross-domain robustness. |
| Asymmetric encoding | Query ≠ doc path | Model uses different projections for queries and documents. |

## Pour en savoir plus

- [Reimers, Gurevych (2019). Sentence-BERT](https://arxiv.org/abs/1908.10084) le papier bi-encodeur.
- [Muennighoff et al. (2022). MTEB: Massive Text Embedding Benchmark](https://arxiv.org/abs/2210.07316) le tableau de classement.
- [Chen et al. (2024). BGE-M3: Multi-lingual, Multi-functionality, Multi-granularity](https://arxiv.org/abs/2402.03216) le modèle unifié à trois modes.
- [Kusupati et al. (2022). Matryoshka Representation Learning](https://arxiv.org/abs/2205.13147) l'objectif de formation en échelle dimensionnelle.
- [Santhanam et al. (2022). ColBERTv2: Effective and Efficient Retrieval via Lightweight Late Interaction](https://arxiv.org/abs/2112.01488) Interaction tardive dans la production.
- [MTEB leaderboard on Hugging Face](https://huggingface.co/spaces/mteb/leaderboard) classement en direct.
