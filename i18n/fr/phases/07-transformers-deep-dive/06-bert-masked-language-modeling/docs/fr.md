# BERT  Modélisation du langage masqué

> GPT prédit le mot suivant. BERT prédit un mot manquant. Une phrase de différence  et une demi-décennie de tout en forme d'embedding.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 5 · 02 (Text Representation)
**Time:** ~45 minutes

## Le problème

En 2018, chaque tâche de PNL  sentiment, NER, QA, entailment  a entraîné son propre modèle à partir de zéro sur ses propres données étiquetées. Il n'y avait pas de point de contrôle "comprendre l'anglais" prétrainé que vous puissiez affiner. ELMo (2018) a montré que vous pouviez pré-entraîner les emblèmes contextuels avec un LSTM bidirectionnel; cela a aidé mais n'a pas généralisé.

BERT (Devlin et coll. 2018) a demandé: et si nous prenions un encodeur transformateur, l'entraînons sur chaque phrase sur Internet, et le forçons à prédire les mots manquants du contexte des deux côtés?

Le résultat: en 18 mois, BERT et ses variantes (RoBERTa, ALBERT, ELECTRA) ont dominé tous les classements de PNL existants.

En 2026, les modèles encodés uniquement sont toujours l'outil idéal pour la classification, la récupération et l'extraction structurée. Ils fonctionnent 510x plus rapidement par jeton que les décodeurs et leurs intégrations sont l'épine dorsale de chaque pile de récupération moderne. ModernBERT (décembre 2024) a poussé l'architecture vers le contexte 8K avec Flash Attention + RoPE + GeGLU.

## Le concept

![Masked language modeling: pick tokens, mask them, predict originals](../assets/bert-mlm.svg)

### Le signal d'entraînement

Prenez une phrase:`the quick brown fox jumps over the lazy dog`- Je suis désolé .

Masquer 15% des jetons au hasard:

```
input:  the [MASK] brown fox jumps [MASK] the lazy dog
target: the  quick brown fox jumps  over  the lazy dog
```

Exercez le modèle pour prédire les jetons originaux à des positions masquées.`[MASK]`à la position 1 peut utiliser `brown fox jumps`C'est ce que le GPT ne peut pas faire.

### Les règles du masque BERT

Parmi les 15% des jetons sélectionnés pour la prédiction:

- 80% sont remplacés par `[MASK]`- Je suis désolé .
- 10% sont remplacés par un jeton aléatoire.
- 10% restent inchangés.

Pourquoi pas toujours ?`[MASK]`Parce que ...`[MASK]`Le modèle est formé à s'attendre à ce que la`[MASK]`Les résultats obtenus par le système de calcul de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position de la position

### Prédiction de la phrase suivante (NSP)  et pourquoi elle a été abandonnée

BERT original a également été formé sur NSP: donné deux phrases A et B, prédire si B suit A. RoBERTa (2019) l'a abolie et a montré que NSP a blessé, pas aidé.

### Ce qui a changé en 2026: ModernBERT

Le papier ModernBERT 2024 a reconstruit le bloc avec des primitifs 2026:

| Component | Original BERT (2018) | ModernBERT (2024) |
|-----------|----------------------|-------------------|
| Positional | Learned absolute | RoPE |
| Activation | GELU | GeGLU |
| Normalization | LayerNorm | Pre-norm RMSNorm |
| Attention | Full dense | Alternating local (128) + global |
| Context length | 512 | 8192 |
| Tokenizer | WordPiece | BPE |

Et contrairement à la pile 2018, il est natif Flash-Attention. L'inférence est 23x plus rapide à la longueur de séquence 8K que DeBERTa-v3 avec de meilleurs scores GLUE.

### Cas d'utilisation qui choisissent encore un codeur en 2026

| Task | Why encoder beats decoder |
|------|---------------------------|
| Retrieval / semantic search embeddings | Bidirectional context = better embedding quality per token |
| Classification (sentiment, intent, toxicity) | One forward pass; no generation overhead |
| NER / token labeling | Per-position output, natively bidirectional |
| Zero-shot entailment (NLI) | Classifier head on top of encoder |
| Reranker for RAG | Cross-encoder scoring, 10x faster than LLM rerankers |

```figure
transformer-residual
```

## Faites-le

### Étape 1: masquer la logique

Regardez !`code/main.py`- La fonction`create_mlm_batch`Returne les identifiants d'entrée (avec des masques appliqués) et les étiquettes (uniquement dans les positions masquées, -100 ailleurs  PyTorch ignore la convention de l'indice).

```python
def create_mlm_batch(tokens, vocab_size, mask_prob=0.15, rng=None):
    input_ids = list(tokens)
    labels = [-100] * len(tokens)
    for i, t in enumerate(tokens):
        if rng.random() < mask_prob:
            labels[i] = t
            r = rng.random()
            if r < 0.8:
                input_ids[i] = MASK_ID
            elif r < 0.9:
                input_ids[i] = rng.randrange(vocab_size)
            # else: keep original
    return input_ids, labels
```

### Étape 2: exécuter la prédiction de MLM sur un petit corpus

Prenez un codeur à 2 couches + un chef MLM sur un vocabulaire de 20 mots, 200 phrases.

### Étape 3: comparer les types de masques

Montrez comment la règle des trois sens rend le modèle utilisable sans `[MASK]`- Prédire une phrase non masquée et une phrase masquée.

### Étape 4: tête de réglage

Remplacez la tête de MLM par une tête de classification sur un ensemble de données de sentiment de jouets. Seuls les têtes sont chargées; l'encodeur est gelé. C'est le modèle que suit chaque application BERT.

## Utilisez-le

```python
from transformers import AutoModel, AutoTokenizer

tok = AutoTokenizer.from_pretrained("answerdotai/ModernBERT-base")
model = AutoModel.from_pretrained("answerdotai/ModernBERT-base")

text = "Attention is all you need."
inputs = tok(text, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, N, 768)
```

**Embedding models are fine-tuned BERT.** `sentence-transformers`modèles comme `all-MiniLM-L6-v2`Le codeur est le même, la perte a changé.

**Cross-encoder rerankers are also fine-tuned BERT.**Classification par paires`[CLS] query [SEP] doc [SEP]`L'attention bidirectionnelle entre requête et document est exactement ce qui donne aux encoders croisés leur avantage de qualité par rapport aux biencoders.

**When not to pick BERT in 2026.**Tout ce qui génère. L'encodeur n'a aucun moyen sensé de produire des jetons autoregressif.

## La faire partir

Regardez !`outputs/skill-bert-finetuner.md`. Les compétences sont un réglage fin du BERT (choix de colonne vertébrale, spécifications de tête, données, évaluation, arrêt) pour une nouvelle tâche de classification ou d'extraction.

## Exercices

1. **Easy.**On court .`code/main.py`Confirmer ~ 15% sont sélectionnés, et de ces ~ 80% deviennent `[MASK]`- Je suis désolé .
2. **Medium.**Mettre en œuvre le masquage de mots entiers: si un mot est symbolisé en sous-words, masquer tous les sous-words ensemble ou pas. Mesurer si cela améliore la précision de MLM sur un corpus de 500 phrases.
3. **Hard.**Exercer un petit BERT de 2 couches, d=64, sur 10 000 phrases d'un ensemble de données public.`[CLS]`Comparer avec une ligne de base uniquement décodeur à des paramètres correspondants

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MLM | "Masked language modeling" | Training signal: randomly replace 15% of tokens with `[MASK]`, predict the originals. |
| Bidirectional | "Looks both ways" | Encoder attention has no causal mask — every position sees every other position. |
| `[CLS]` | "The pooler token" | A special token prepended to every sequence; its final embedding is used as the sentence-level representation. |
| `[SEP]` | "Segment separator" | Separates paired sequences (e.g. query/doc, sentence A/B). |
| NSP | "Next sentence prediction" | BERT's second pretraining task; shown to be useless in RoBERTa, dropped after 2019. |
| Fine-tuning | "Adapt to a task" | Keep the encoder mostly frozen; train a small head on top for the downstream task. |
| Cross-encoder | "A reranker" | A BERT that takes both query and doc as input, outputs a relevance score. |
| ModernBERT | "2024 refresh" | Encoder rebuilt with RoPE, RMSNorm, GeGLU, alternating local/global attention, 8K context. |

## Pour en savoir plus

- [Devlin et al. (2018). BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding](https://arxiv.org/abs/1810.04805) papier original.
- [Liu et al. (2019). RoBERTa: A Robustly Optimized BERT Pretraining Approach](https://arxiv.org/abs/1907.11692) comment former correctement BERT; tue NSP.
- [Clark et al. (2020). ELECTRA: Pre-training Text Encoders as Discriminators Rather Than Generators](https://arxiv.org/abs/2003.10555) la détection de jeton remplacé dépasse MLM à l'ordinateur correspondant.
- [Warner et al. (2024). Smarter, Better, Faster, Longer: A Modern Bidirectional Encoder](https://arxiv.org/abs/2412.13663) Le papier ModernBERT.
- [HuggingFace `modeling_bert.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/bert/modeling_bert.py) référence au codeur canonique.
