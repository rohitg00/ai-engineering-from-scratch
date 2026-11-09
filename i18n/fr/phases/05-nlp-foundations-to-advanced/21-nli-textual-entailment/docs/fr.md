# Inference du langage naturel  implication textuelle

> "t implique h" signifie qu'une lecture humaine t conclurait h est vrai. NLI est la tâche de prédire l'implication / contradiction / neutre.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 05 (Sentiment Analysis), Phase 5 · 13 (Question Answering)
**Time:** ~60 minutes

## Le problème

Vous avez construit un résumé, il a produit un résumé.

Vous avez construit un chatbot qui a répondu "oui". Comment savez-vous que la réponse est soutenue par le passage récupéré?

Vous devez classer 10 000 articles par sujet. Vous n'avez pas d'étiquettes de formation. Pouvez-vous réutiliser un modèle?

Les trois problèmes se réduisent à l'inference naturelle.`t`et une hypothèse `h`, est `h`entraîné par `t`, contradictoire ou neutre (non liée)?

- **Hallucination check:** `t`= document source, `h`- Une affirmation résumée, pas une implication.
- **Grounded QA:** `t`= passage récupéré, `h`= réponse générée.
- **Zero-shot classification:** `t`= document, `h`= étiquette verbale ("Il s'agit de sport").

Une tâche, trois utilisations de production. C'est pourquoi chaque cadre d'évaluation RAG envoie un modèle NLI sous le capot.

## Le concept

![NLI: three-way classification, premise vs hypothesis](../assets/nli.svg)

**The three labels.**

- **Entailment.** `t`- Je suis là.`h`"Le chat est sur le tapis" signifie "Il y a un chat".
- **Contradiction.** `t`→`h`"Le chat est sur le tapis" contredit "Il n'y a pas de chat".
- **Neutral.**Aucune inférence. "Le chat est sur le tapis" est neutre à "Le chat a faim".

**Not logical entailment.**L'inference de langage NLI est *naturelle* ce qu'un lecteur humain typique en déduirait, pas une logique stricte. "John a marché son chien" implique "John a un chien" dans l'inference de langage NLI, mais la logique stricte du premier ordre ne l'admettrait que si vous axiomatiserez la possession.

**Datasets.**

- **SNLI**(2015). 570 000 paires d'annotations humaines, sous-titres d'images comme prémisses. Domaine étroit.
- **MultiNLI**Le corpus de formation standard en 2026
- **ANLI**(2019). NLI opposé. Les humains ont écrit des exemples spécialement conçus pour briser les modèles existants.
- **DocNLI, ConTRoL**(202021). Prémissions de document. Tests d'inférence à plusieurs sauts et à longue portée.

**The architecture.**Un encodeur de transformateur (BERT, RoBERTa, DeBERTa) lit `[CLS] premise [SEP] hypothesis [SEP]`- Le .`[CLS]`La représentation donne un softmax à trois voies. entraînement sur MNLI, évaluation sur des critères de référence retenus, obtenir 90% + de précision sur les paires de distribution.

**Zero-shot via NLI.**En fonction du document et des étiquettes candidates, transformez chaque étiquette en une hypothèse (" Ce texte concerne les sports ").`zero-shot-classification`- Le pipeline.

```figure
nli-router
```

## Faites-le

### Étape 1: exécuter un modèle NLI prétrainé

```python
from transformers import pipeline

nli = pipeline("text-classification",
               model="facebook/bart-large-mnli",
               top_k=None)  # return all labels; replaces deprecated return_all_scores=True

premise = "The cat is sleeping on the couch."
hypothesis = "There is a cat in the room."

result = nli({"text": premise, "text_pair": hypothesis})[0]
print(result)
# [{'label': 'entailment', 'score': 0.97},
#  {'label': 'neutral', 'score': 0.02},
#  {'label': 'contradiction', 'score': 0.01}]
```

Pour les NLI de production, `facebook/bart-large-mnli`et `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli`DeBERTa-v3 est au sommet des classements.

### Étape 2: classification à tir zéro

```python
zs = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

text = "The stock market rallied after the central bank cut interest rates."
labels = ["finance", "sports", "politics", "technology"]

result = zs(text, candidate_labels=labels)
print(result)
# {'labels': ['finance', 'politics', 'technology', 'sports'],
#  'scores': [0.92, 0.05, 0.02, 0.01]}
```

Le modèle est "Cet exemple est sur {label}." par défaut.`hypothesis_template`Aucune formation, aucune mise à jour, ça marche à l'extérieur.

### Étape 3: vérification de la fidélité pour RAG

```python
def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold
```

C'est le cœur de la fidélité RAGAS. Divisez la réponse générée en revendications atomiques. Vérifiez chaque revendication par rapport au contexte récupéré.

### Étape 4: classifiant NLI laminé à la main (conceptuel)

Regardez !`code/main.py`Pour un jouet à simple valeur: la prémisse et l'hypothèse sont comparées par superposition léxicale + détection de négation.`{entail, contradict, neutral}`- Je suis désolé .

## Les pièges

- **Hypothesis-only shortcuts.**Les modèles peuvent prédire l'étiquette à partir de l'hypothèse seule à ~60% sur SNLI parce que "non", "personne", "ne jamais" corréle avec la contradiction.
- **Lexical overlap heuristic.**L'heuristique de la sous-sequence ("toute sous-sequence est impliquée") passe SNLI mais échoue HANS/ANLI.
- **Document-length degradation.**Les modèles NLI à phrase unique déposent 20+ F1 sur des locaux de longueur document.
- **Zero-shot template sensitivity.**"Cet exemple est sur {label}" vs "{label}" vs "Le sujet est {label}" peut faire osciller la précision de 10 points.
- **Domain mismatch.**Le MNLI est formé en anglais général. Les textes juridiques, médicaux et scientifiques nécessitent des modèles NLI spécifiques à un domaine (par exemple, SciNLI, MedNLI).

## Utilisez-le

La pile de 2026:

| Use case | Model |
|---------|-------|
| General-purpose NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Fast / edge | `cross-encoder/nli-deberta-v3-base` |
| Zero-shot classification (lightweight) | `facebook/bart-large-mnli` |
| Document-level NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Multilingual | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` |
| Hallucination detection in RAG | NLI layer inside RAGAS / DeepEval |

Le méta-pattern 2026: NLI est le ruban adhésif de la compréhension du texte. Chaque fois que vous avez besoin de " A soutient B? " ou " A contredit B? "  Recherchez NLI avant de vous lancer dans un autre appel de LLM.

## La faire partir

- Je ne sais pas .`outputs/skill-nli-picker.md`- Le numéro de la liste:

```markdown
---
name: nli-picker
description: Pick an NLI model, label template, and evaluation setup for a classification / faithfulness / zero-shot task.
version: 1.0.0
phase: 5
lesson: 21
tags: [nlp, nli, zero-shot]
---

Given a use case (faithfulness check, zero-shot classification, document-level inference), output:

1. Model. Named NLI checkpoint. Reason tied to domain, length, language.
2. Template (if zero-shot). Verbalization pattern. Example.
3. Threshold. Entailment cutoff for the decision rule. Reason based on calibration.
4. Evaluation. Accuracy on held-out labeled set, hypothesis-only baseline, adversarial subset.

Refuse to ship zero-shot classification without a 100-example labeled sanity check. Refuse to use a sentence-level NLI model on document-length premises. Flag any claim that NLI solves hallucination — it reduces it; it does not eliminate it.
```

## Exercices

1. **Easy.**On court .`facebook/bart-large-mnli`Les trois classes sont couvertes par 20 triples faits à la main (prémisse, hypothèse, étiquette). Mesurez l'exactitude. Ajoutez des pièges " heuristiques de sous-sequence " adversitaires (" Je n'ai pas mangé le gâteau " contre " J'ai mangé le gâteau ") et voyez si il se casse.
2. **Medium.**Comparez le modèle à tir zéro `"This text is about {label}"`contre `"The topic is {label}"`et `"{label}"`Sur 100 titres de l'A.G. News, on rapporte des changements de précision.
3. **Hard.**Construire un vérificateur de fidélité RAG: décomposition des revendications atomiques + NLI par revendication. Évaluer sur 50 réponses générées par RAG avec contexte d'or. Mesurer les taux de faux positifs et faux négatifs par rapport aux étiquettes manuelles.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NLI | Natural Language Inference | 3-way classification of premise-hypothesis relationship. |
| RTE | Recognizing Textual Entailment | Older name for NLI; same task. |
| Entailment | "t implies h" | A typical reader would conclude h is true given t. |
| Contradiction | "t rules out h" | A typical reader would conclude h is false given t. |
| Neutral | "undecided" | No inference from t to h either way. |
| Zero-shot classification | NLI as classifier | Verbalize labels as hypotheses, pick max entailment. |
| Faithfulness | Is the answer supported? | NLI over (retrieved context, generated answer). |

## Pour en savoir plus

- [Bowman et al. (2015). A large annotated corpus for learning natural language inference](https://arxiv.org/abs/1508.05326) SNLI.
- [Williams, Nangia, Bowman (2017). A Broad-Coverage Challenge Corpus for Sentence Understanding through Inference](https://arxiv.org/abs/1704.05426) MultiNLI.
- [Nie et al. (2019). Adversarial NLI](https://arxiv.org/abs/1910.14599) l'indice de référence ANLI.
- [Yin, Hay, Roth (2019). Benchmarking Zero-shot Text Classification](https://arxiv.org/abs/1909.00161) NLI-as-classifier.
- [He et al. (2021). DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654) le cheval de travail de la NLI de 2026.
