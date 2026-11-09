# PNL multilingue

> Un modèle, plus de 100 langues, zéro données de formation pour la plupart d'entre elles. Le transfert interlinguiste est le miracle pratique des années 2020.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 04 (GloVe, FastText, Subword), Phase 5 · 11 (Machine Translation)
**Time:** ~45 minutes

## Le problème

L'anglais a des milliards d'exemples étiquetés. L'ourdou a des milliers. La maithili n'a presque aucun. Tout système pratique de PNL qui sert un public mondial doit travailler sur la longue queue des langues où les données de formation spécifiques à des tâches n'existent pas.

Les modèles multilingues résolvent cela en formant un modèle sur plusieurs langues simultanément. La représentation partagée permet au modèle de transférer les compétences acquises dans les langues à ressources élevées à celles à ressources faibles. D'accord avec l'analyse anglaise des sentiments, il produit des prédictions surprenantes sur l'urdu. C'est un transfert interlinguel sans décalage, et il a remodelé la façon dont la PNL se transmet dans le monde.

Cette leçon mentionne les compromis, les modèles canoniques et la seule décision qui incite les équipes nouvelles à travailler en plusieurs langues: choisir une langue source pour le transfert.

## Le concept

![Cross-lingual transfer via shared multilingual embedding space](../assets/multilingual.svg)

**Shared vocabulary.**Les modèles multilingues utilisent un jeton SentencePiece ou WordPiece formé sur le texte de toutes les langues cibles. Le vocabulaire est partagé: la même unité de sous-parts représente le même morphème dans toutes les langues apparentées. `anti-`en anglais et en italien, on obtient le même jeton.

**Shared representation.**Un transformateur prétrainé à la modélisation du langage masqué dans de nombreuses langues apprend que des phrases sémantiquement similaires dans différentes langues produisent des états cachés similaires. mBERT, XLM-R et NLLB le montrent tous.

**Zero-shot transfer.**La définition de la langue de référence est la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la définition de la langue de référence, la langue de référence, la langue de référence, la langue de référence, la langue de référence.

**Few-shot fine-tuning.**Ajouter 100 à 500 exemples étiquetés dans la langue cible. La précision saute à 95 à 98% de la ligne de base anglaise sur les tâches de classification. C'est le levier le plus rentable dans la PNL multilingue.

## Les modèles

| Model | Year | Coverage | Notes |
|-------|------|----------|-------|
| mBERT | 2018 | 104 languages | Trained on Wikipedia. First practical multilingual LM. Weak on low-resource. |
| XLM-R | 2019 | 100 languages | Trained on CommonCrawl (much larger than Wikipedia). Sets the cross-lingual baseline. Base 270M, Large 550M. |
| XLM-V | 2023 | 100 languages | XLM-R with 1M-token vocabulary (vs 250k). Better on low-resource. |
| mT5 | 2020 | 101 languages | T5 architecture for multilingual generation. |
| NLLB-200 | 2022 | 200 languages | Meta's translation model; includes 55 low-resource languages. |
| BLOOM | 2022 | 46 languages + 13 programming | Open 176B LLM trained multilingually. |
| Aya-23 | 2024 | 23 languages | Cohere's multilingual LLM. Strong on Arabic, Hindi, Swahili. |

Choisissez par cas d'utilisation. La classification fonctionne bien avec la base XLM-R en tant que défaut sain. Les tâches de génération nécessitent mT5 ou NLLB selon la traduction et la génération ouverte.

## La décision de la langue source (2026 recherche)

La plupart des équipes utilisent l'anglais comme source de réglage.

La similitude linguistique prédit la qualité de transfert mieux que la taille du corpus brut. Pour les cibles slaves, l'allemand ou le russe battent souvent l'anglais. Pour les cibles indiennes, l'hindi bat souvent l'anglais.**qWALS**La métrique de similitude (2026, basée sur les caractéristiques de l'Atlas mondial des structures linguistiques) quantifie cela. **LANGRANK**(Lin et al., ACL 2019) est une méthode distincte et antérieure qui classe les langues candidates à la source à partir d'une combinaison de similitude linguistique, de taille de corpus et de connexion génétique.

Règle pratique: si votre langue cible a un parent typiquement proche de ressources élevées, essayez d'abord de l'ajuster, puis comparez-le à l'anglais.

```figure
n5-crosslingual-bridge
```

## Faites-le

### Étape 1: classification interlinguistique à zéro

```python
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

tok = AutoTokenizer.from_pretrained("joeddav/xlm-roberta-large-xnli")
model = AutoModelForSequenceClassification.from_pretrained("joeddav/xlm-roberta-large-xnli")


def classify(text, candidate_labels, hypothesis_template="This text is about {}."):
    scores = {}
    for label in candidate_labels:
        hypothesis = hypothesis_template.format(label)
        inputs = tok(text, hypothesis, return_tensors="pt", truncation=True)
        with torch.no_grad():
            logits = model(**inputs).logits[0]
        entail_score = torch.softmax(logits, dim=-1)[2].item()
        scores[label] = entail_score
    return dict(sorted(scores.items(), key=lambda x: -x[1]))


print(classify("I love this product!", ["positive", "negative", "neutral"]))
print(classify("मुझे यह उत्पाद पसंद है!", ["positive", "negative", "neutral"]))
print(classify("J'adore ce produit !", ["positive", "negative", "neutral"]))
```

Un modèle, trois langues, la même API. XLM-R formé sur NLI transfère bien les données à la classification via le truc de l'enclusion.

### Étape 2: espace d'intégration multilingue

```python
from sentence_transformers import SentenceTransformer
import numpy as np

model = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")

pairs = [
    ("The cat is sleeping.", "Le chat dort."),
    ("The cat is sleeping.", "El gato está durmiendo."),
    ("The cat is sleeping.", "Die Katze schläft."),
    ("The cat is sleeping.", "The dog is barking."),
]

for eng, other in pairs:
    emb_eng = model.encode([eng], normalize_embeddings=True)[0]
    emb_other = model.encode([other], normalize_embeddings=True)[0]
    sim = float(np.dot(emb_eng, emb_other))
    print(f"  {eng!r} <-> {other!r}: cos={sim:.3f}")
```

Les traductions se rapprochent dans l'espace d'embedding. Une phrase anglaise différente se rapproche davantage. C'est ce qui rend la récupération, le regroupement et la similitude interlinguistes fonctionnent.

### Étape 3: stratégie de réglage des points de vue

```python
from transformers import TrainingArguments, Trainer
from datasets import Dataset


def few_shot_finetune(base_model, base_tokenizer, examples):
    ds = Dataset.from_list(examples)

    def tokenize_fn(ex):
        out = base_tokenizer(ex["text"], truncation=True, max_length=128)
        out["labels"] = ex["label"]
        return out

    ds = ds.map(tokenize_fn)
    args = TrainingArguments(
        output_dir="out",
        per_device_train_batch_size=8,
        num_train_epochs=5,
        learning_rate=2e-5,
        save_strategy="no",
    )
    trainer = Trainer(model=base_model, args=args, train_dataset=ds)
    trainer.train()
    return base_model
```

Pour 100 à 500 exemples de langues cibles, `num_train_epochs=5`et `learning_rate=2e-5`Les taux d'apprentissage plus élevés font que l'alignement multilingue s'effondre et vous obtenez un modèle en anglais seulement.

## Une évaluation qui fonctionne réellement

- **Per-language accuracy on held-out sets.**L'agrégat cache la longue queue.
- **Benchmark against monolingual baseline.**Pour les langues avec suffisamment de données, un modèle monolingual entraîné à partir de zéro peut parfois dépasser celui multilingue.
- **Entity-level tests.**Les modèles multilingues ont souvent une faible tokenization pour les scripts éloignés du latin.
- **Cross-lingual consistency.**Le même sens dans deux langues devrait produire la même prédiction.

## Utilisez-le

La pile de 2026:

| Task | Recommended |
|-----|-------------|
| Classification, 100 languages | XLM-R-base (~270M) fine-tuned |
| Zero-shot text classification | `joeddav/xlm-roberta-large-xnli` |
| Multilingual sentence embeddings | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` |
| Translation, 200 languages | `facebook/nllb-200-distilled-600M` (see lesson 11) |
| Generative multilingual | Claude, GPT-4, Aya-23, mT5-XXL |
| Low-resource language NLP | XLM-V or a domain-specific fine-tune on related high-resource language |

Le budget est toujours pour la mise à jour de la langue cible si les performances comptent.

### La taxe de tokenization (ce qui ne va pas pour les langues à faible consommation)

Les modèles multilingues partagent un tokenizer dans toutes leurs langues. Ce vocabulaire est formé sur un corpus dominé par l'anglais, le français, l'espagnol, le chinois, l'allemand. Pour toute langue en dehors de l'ensemble dominant, trois taxes se composent silencieusement:

- **Fertility tax.**Un texte en langue à faible ressource se transforme en beaucoup plus de jetons par mot que l'anglais. Une phrase en hindi peut avoir besoin de 3-5 fois les jetons d'une phrase anglaise équivalente. Ce 3-5x consomme votre fenêtre de contexte, l'efficacité de la formation et la latence.
- **Variant recovery tax.**Chaque erreur de frappe, variante diacratique, déséquilibre de normalisation Unicode ou variation de cas devient une séquence sans rapport au début à froid dans l'espace d'embedding.
- **Capacity spillover tax.**Les taxes 1 et 2 consomment des positions de contexte, la profondeur de couche et les dimensions d'intégration. Ce qui reste pour le raisonnement réel est systématiquement plus petit que ce qu'un langage à haute ressource obtient du même modèle.

Le symptôme pratique: votre modèle s'entraîne normalement en hindi, la courbe de perte semble correcte, la perplexité d'évaluation semble raisonnable et les résultats de production sont subtilement erronés. La morphologie s'effondre au milieu de la phrase. Les inflexions rares restent irrécupérables. **You cannot data-scale your way out of a broken tokenizer.**

L'atténuation: choisir un tokenizer avec une bonne couverture pour votre langue cible (le vocabulaire de 1M-token de XLM-V est une solution directe); vérifier la fertilité de la tokenification sur le texte cible retenu avant l'entraînement; utiliser le bac à niveau de octets (SentencePiece `byte_fallback=True`, GPT-2-style BPE de niveau octal) pour les scripts vraiment long-tail donc rien n'est jamais OOV.

## La faire partir

- Je ne sais pas .`outputs/skill-multilingual-picker.md`- Le numéro de la liste:

```markdown
---
name: multilingual-picker
description: Pick source language, target model, and evaluation plan for a multilingual NLP task.
version: 1.0.0
phase: 5
lesson: 18
tags: [nlp, multilingual, cross-lingual]
---

Given requirements (target languages, task type, available labeled data per language), output:

1. Source language for fine-tuning. Default English; check LANGRANK or qWALS if target language has a typologically close high-resource language.
2. Base model. XLM-R (classification), mT5 (generation), NLLB (translation), Aya-23 (generative LLM).
3. Few-shot budget. Start with 100-500 target-language examples if available. Zero-shot only if labeling is infeasible.
4. Evaluation plan. Per-language accuracy (not aggregate), cross-lingual consistency, entity-level F1 on non-Latin scripts.

Refuse to ship a multilingual model without per-language evaluation — aggregate metrics hide long-tail failures. Flag scripts with low tokenization coverage (Amharic, Tigrinya, many African languages) as needing a model with byte-fallback (SentencePiece with byte_fallback=True, or byte-level tokenizer like GPT-2).
```

## Exercices

1. **Easy.**Exécutez le pipeline de classification à tir zéro sur 10 phrases par langue en anglais, français, hindi et arabe. Rapportez la précision sur chacun. Vous devriez voir un français fort, un hindi décent, un arabe variable.
2. **Medium.**Utilisation `paraphrase-multilingual-MiniLM-L12-v2`Pour obtenir des informations sur les données, il est nécessaire de créer un retriever multilingue sur un petit corpus de langues mixtes.
3. **Hard.**Comparer la mise en forme de la langue anglaise et la langue hindi pour une tâche de classification en hindi. Utilisez 500 exemples de langue cible pour la mise en forme de quelques coups sous les deux régimes. Rapporte quelle source produit une meilleure précision en hindi et par combien.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Multilingual model | One model, many languages | Shared vocabulary and parameters across languages. |
| Cross-lingual transfer | Train on one language, run on another | Fine-tune on source, evaluate on target without target-language labels. |
| Zero-shot | No target-language labels | Transfer without fine-tuning on the target language. |
| Few-shot | Small target labels | 100-500 target-language examples used for fine-tuning. |
| mBERT | First multilingual LM | 104-language BERT pretrained on Wikipedia. |
| XLM-R | Standard cross-lingual baseline | 100-language RoBERTa pretrained on CommonCrawl. |
| NLLB | Meta's 200-language MT | No Language Left Behind. Includes 55 low-resource languages. |

## Pour en savoir plus

- [Conneau et al. (2019). Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116)- Le papier XLM-R.
- [Pires, Schlinger, Garrette (2019). How Multilingual is Multilingual BERT?](https://arxiv.org/abs/1906.01502) le document d'analyse qui a lancé la ligne de recherche sur le transfert translinguiste.
- [Costa-jussà et al. (2022). No Language Left Behind](https://arxiv.org/abs/2207.04672) Document de la NLLB-200.
- [Üstün et al. (2024). Aya Model: An Instruction Finetuned Open-Access Multilingual Language Model](https://arxiv.org/abs/2402.07827)Aya, le Master multilingue de Cohere.
- [Language Similarity Predicts Cross-Lingual Transfer Learning Performance (2026)](https://www.mdpi.com/2504-4990/8/3/65) le papier de langue source QWALS / LANGRANK.
