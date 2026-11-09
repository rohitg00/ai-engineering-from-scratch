# Résumé du texte

> Les systèmes extractifs vous disent ce que le document dit, les systèmes abstraits vous disent ce que l'auteur voulait dire, différentes tâches, différents pièges.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 11 (Machine Translation)
**Time:** ~75 minutes

## Le problème

Un article de 2000 mots se trouve dans votre flux. Vous avez besoin de 120 mots qui le capturent. Vous pouvez choisir les trois phrases les plus importantes de l'article (extractif) ou réécrire le contenu dans vos propres mots (abstractif).

Le résumé extractif est un problème de classement.`k`Le résultat est toujours grammatical car il est levé littéralement.

La résumation abstractive est un problème de génération. Un transformateur produit un nouveau texte conditionné sur l'entrée. La sortie est fluide et compressive mais peut halluciner des faits qui n'étaient pas dans la source. Le risque est une fabrication confiante.

Cette leçon les construit tous les deux, avec le mode d'échec de chacun.

## Le concept

![Extractive TextRank vs abstractive transformer](../assets/summarization.svg)

**Extractive.**Traitez l'article comme un graphique où les nœuds sont des phrases et les bords sont des similitudes.**TextRank**(Mihalcea et Tarau, 2004).

**Abstractive.**Fin-tune un transformateur encodeur-décodeur (BART, T5, Pegasus) sur les paires document-récapitulatif. À l'inférence, le modèle lit le document et génère le résumé jeton par jeton via l'attention croisée. Pegasus utilise en particulier un objectif de pré-entraînement de la phrase-écart qui le rend excellent pour la résumé sans beaucoup de fin-tune.

Évaluation avec **ROUGE**(Return-Oriented Understudy for Gisting Evaluation). ROUGE-1 et ROUGE-2 scores singramme et bigramme chevauchent. ROUGE-L scores la plus longue sous-sequence commune. Plus élevé est mieux mais 40 ROUGE-L est "bon" et 50 est "exceptionnel".`rouge-score`le colis.

```figure
summarize-collapse
```

## Faites-le

### Étape 1: TextRank (extractif)

```python
import math
import re
from collections import Counter


def sentence_split(text):
    return re.split(r"(?<=[.!?])\s+", text.strip())


def similarity(s1, s2):
    w1 = Counter(s1.lower().split())
    w2 = Counter(s2.lower().split())
    intersection = sum((w1 & w2).values())
    denom = math.log(len(w1) + 1) + math.log(len(w2) + 1)
    if denom == 0:
        return 0.0
    return intersection / denom


def textrank(text, top_k=3, damping=0.85, iterations=50, epsilon=1e-4):
    sentences = sentence_split(text)
    n = len(sentences)
    if n <= top_k:
        return sentences

    sim = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                sim[i][j] = similarity(sentences[i], sentences[j])

    scores = [1.0] * n
    for _ in range(iterations):
        new_scores = [1 - damping] * n
        for i in range(n):
            total_out = sum(sim[i]) or 1e-9
            for j in range(n):
                if sim[i][j] > 0:
                    new_scores[j] += damping * sim[i][j] / total_out * scores[i]
        if max(abs(s - ns) for s, ns in zip(scores, new_scores)) < epsilon:
            scores = new_scores
            break
        scores = new_scores

    ranked = sorted(range(n), key=lambda k: scores[k], reverse=True)[:top_k]
    ranked.sort()
    return [sentences[i] for i in ranked]
```

Deux choses qui valent la peine de nommer. La fonction de similitude utilise une superposition de mots normalisés par jour, qui est la variante originale de TextRank.

### Étape 2: abstractif avec BART

```python
from transformers import pipeline

summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

article = """(long news article text)"""

summary = summarizer(article, max_length=120, min_length=60, do_sample=False)
print(summary[0]["summary_text"])
```

BART-grand-CNN est bien ajusté sur le corpus CNN/DailyMail. Il produit des résumés de style news hors boîte. Pour d'autres domaines (articles scientifiques, dialogue, juridique), utilisez le point de contrôle Pegasus correspondant ou bien ajustez vos données cibles.

### Étape 3: Évaluation ROUGE

```python
from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(reference_summary, generated_summary)
print({k: round(v.fmeasure, 3) for k, v in scores.items()})
```

Sans lui, "courir" et "courir" comptent comme des mots différents et ROUGE sous-compte.

### Au-delà de ROUGE (2026 évaluation de résumé)

ROUGE est la mesure de synthèse dominante depuis vingt ans et elle est insuffisante en elle-même en 2026.

- **BERTScore**(semblance d'intégration contextuelle) a gagné en popularité jusqu'en 2023 et est maintenant rapporté aux côtés de ROUGE dans la plupart des documents de résumé.
- **BARTScore**traite l'évaluation comme une génération: note le résumé en fonction de la probabilité qu'un BART prétrainé l'attribue compte tenu de la source.
- **MoverScore**(Distances de la Terre sur les emplacements contextuels) a atteint la première place dans les benchmarks de résumé de 2025, car il capture mieux la chevauchement sémantique que ROUGE.
- **FactCC**et **QA-based faithfulness**étaient courantes en 2021-2023, maintenant souvent remplacées par **G-Eval**(une chaîne de réponse GPT-4 qui note la cohérence, la cohérence, la fluidité, la pertinence avec le raisonnement de la chaîne de pensée).
- **G-Eval**Les approches de la Juge LLM correspondent à la décision humaine dans ~80% des cas où les rubriques sont bien conçues.

Recommandation de production: rapport ROUGE-L pour comparaison antérieure, BERTScore pour superposition sémantique, G-Eval pour cohérence et factualité. Calibration par rapport à 50 à 100 résumés étiquetés par l'homme.

### Étape 4: le problème de la réalité

Les résumés abstraits sont sujets à l'hallucination. Les résumés extractifs comportent un risque d'hallucination beaucoup plus faible parce que la sortie est supprimée littéralement de la source, bien qu'ils puissent toujours induire en erreur si les phrases sources sont décontextualisées, obsolètes ou citées hors ordre. C'est la seule raison pour laquelle les systèmes de production préfèrent encore les méthodes extractives pour le contenu adjacent à la conformité.

Types d'hallucinations à nommer:

- **Entity swap.**La source dit "John Smith". Le résumé dit "John Brown".
- **Number drift.**La source dit 25 000 et le résumé dit 25 millions.
- **Polarity flip.**La source dit "rejeté l'offre". Le résumé dit "accepté l'offre".
- **Fact invention.**La source ne mentionne pas le PDG.

Les approches d'évaluation suivent:

- **FactCC.**Classificateur binaire formé sur l'implication entre la phrase source et la phrase sommaire. Prédit factuel/non factuel.
- **QA-based factuality.**Posez des questions à un modèle d'évaluation de la qualité dont les réponses figurent dans la source.
- **Entity-level F1.**Comparer les entités nommées dans la source par rapport au résumé.

Pour tout ce qui est fait par l'utilisateur où la factualité est importante (nouvelles, médicales, juridiques, financières), l'extractive est la solution la plus sûre.

## Utilisez-le

La pile de 2026:

| Use case | Recommended |
|---------|-------------|
| News, 3-5 sentence summary, English | `facebook/bart-large-cnn` |
| Scientific papers | `google/pegasus-pubmed` or a tuned T5 |
| Multi-document, long-form | Any LLM with 32k+ context, prompted |
| Dialog summarization | `philschmid/bart-large-cnn-samsum` |
| Extractive, low hallucination risk by construction | TextRank or `sumy`'s LSA / LexRank |

Les LLM à long contexte battent souvent les modèles spécialisés en 2026 lorsque le calcul n'est pas une contrainte.

## La faire partir

- Je ne sais pas .`outputs/skill-summary-picker.md`- Le numéro de la liste:

```markdown
---
name: summary-picker
description: Pick extractive or abstractive, named library, factuality check.
version: 1.0.0
phase: 5
lesson: 12
tags: [nlp, summarization]
---

Given a task (document type, compliance requirement, length, compute budget), output:

1. Approach. Extractive or abstractive. Explain in one sentence why.
2. Starting model / library. Name it. `sumy.TextRankSummarizer`, `facebook/bart-large-cnn`, `google/pegasus-pubmed`, or an LLM prompt.
3. Evaluation plan. ROUGE-1, ROUGE-2, ROUGE-L (use rouge-score with stemming). Plus factuality check if abstractive.
4. One failure mode to probe. Entity swap is the most common in abstractive news summarization; flag samples where source entities do not appear in summary.

Refuse abstractive summarization for medical, legal, financial, or regulated content without a factuality gate. Flag input over the model's context window as needing chunked map-reduce summarization (not just truncation).
```

## Exercices

1. **Easy.**Exécutez TextRank sur 5 articles d'actualité. Comparer les 3 premières phrases à un résumé de référence. Mesurer ROUGE-L. Vous devriez voir 30-45 ROUGE-L sur les articles de style CNN/DailyMail.
2. **Medium.**Implémentation de la factualité au niveau de l'entité: extraire des entités nommées de la source et du résumé (spaCy), rappel calcul des entités sources en résumé et précision des entités résumées par rapport à la source.
3. **Hard.**Comparer BART-grand-CNN à un LLM (Claude ou GPT-4) sur 50 articles CNN/DailyMail. Rapporte ROUGE-L, factualité (par entité F1), et coût par résumé. Document où chaque gagnant.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Extractive | Pick sentences | Return sentences verbatim from the source. Never hallucinates. |
| Abstractive | Rewrite | Generate new text conditioned on source. Can hallucinate. |
| ROUGE | Summary metric | N-gram / LCS overlap between system output and reference. |
| TextRank | Graph-based extractive | PageRank over sentence similarity graph. |
| Factuality | Is it right | Whether summary claims are supported by the source. |
| Hallucination | Made-up content | Content in the summary that the source does not support. |

## Pour en savoir plus

- [Mihalcea and Tarau (2004). TextRank: Bringing Order into Texts](https://aclanthology.org/W04-3252/) le papier canonique extractif.
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training](https://arxiv.org/abs/1910.13461) le papier BART.
- [Zhang et al. (2019). PEGASUS: Pre-training with Extracted Gap-sentences](https://arxiv.org/abs/1912.08777) Pegasus et l'objectif de la phrase à écart.
- [Lin (2004). ROUGE: A Package for Automatic Evaluation of Summaries](https://aclanthology.org/W04-1013/) PAPE ROUGE.
- [Maynez et al. (2020). On Faithfulness and Factuality in Abstractive Summarization](https://arxiv.org/abs/2005.00661) le document de paysage de la réalité.
