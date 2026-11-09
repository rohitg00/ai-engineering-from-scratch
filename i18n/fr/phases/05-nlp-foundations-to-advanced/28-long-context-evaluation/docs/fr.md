# Évaluation à long terme  NIAH, RULER, LongBench, MRCR

> Gemini 3 Pro annonce 10 millions de jetons de contexte. À 1 million de jetons, le MRCR à 8 aiguilles tombe à 26,3%.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 23 (Chunking Strategies)
**Time:** ~60 minutes

## Le problème

Vous avez un contrat de 200 pages. Le modèle revendique un contexte de jeton 1M. Vous collez le contrat et demandez: "Quelle est la clause de résiliation?" Le modèle répond  mais répond à partir de la page d'arrière car la clause de résiliation se trouve à 120k jetons de profondeur, au-delà de l'endroit où le modèle assiste réellement.

C'est l'écart de capacité de contexte de 2026. Les feuilles de calcul disent 1M ou 10M. La réalité dit que 60-70% de cela est utilisable, et "utilisable" dépend de la tâche.

- **Retrieval (single needle in haystack):**- C'est un modèle presque parfait, jusqu'au maximum annoncé sur les modèles frontaliers.
- **Multi-hop / aggregation:**déprécie nettement plus de ~ 128k sur la plupart des modèles.
- **Reasoning over dispersed facts:**La première tâche à échouer.

L'évaluation de long contexte mesure ces axes. Cette leçon nomme les points de référence, ce que chaque mesure réellement, et comment construire un test d'aiguille personnalisé pour votre domaine.

## Le concept

![NIAH baseline, RULER multi-task, LongBench holistic](../assets/long-context-eval.svg)

**Needle-in-a-Haystack (NIAH, 2023).**Placez un fait ("le mot magique est l'ananas") à une profondeur contrôlée dans un long contexte. Demandez au modèle de le récupérer.

**RULER (Nvidia, 2024).**13 types de tâches dans 4 catégories: récupération (single / multi-key / multi-value), traçage multi-hop (tracking variable), aggregation (frequency de mot commun), QA. Longueur de contexte configurable (4k à 128k +). Révèle des modèles qui saturent NIAH mais échouent sur multi-hop.

**LongBench v2 (2024).**503 questions de choix multiples, contextes de mots 8k-2M, six catégories de tâches: QA monodoc, QA multi-doc, apprentissage long dans le contexte, dialogue long, code repo, données structurées longues.

**MRCR (Multi-Round Coreference Resolution).**Une coréférence à plusieurs tours à l'échelle, 8 aiguilles, 24 aiguilles, 100 aiguilles, explique combien de faits un modèle peut jongler avant que l'attention ne dégrade.

**NoLiMa.**"Aiguille non léxicale". L'aiguille et la requête ne partagent pas de superposition littérale; la récupération nécessite une étape de raisonnement sémantique.

**HELMET.**Il concocte de nombreux documents, pose une question à n'importe qui, teste l'attention sélective.

**BABILong.**Il intègre des chaînes de raisonnement dans des tas de foin sans importance.

### Qu'est-ce qui doit être rapporté

- **Advertised context window.**Le numéro de la fiche.
- **Effective retrieval length.**Le NIAH passe à un certain seuil (par exemple, 90%).
- **Effective reasoning length.**Le multi-hop ou l'agrégation passe à ce seuil.
- **Degradation curve.**Accuracité par rapport à la longueur du contexte, graphique par type de tâche.

Deux chiffres pour votre fiche de spécifications: récupération efficace et raisonnement efficace.

```figure
gx-niah-decay
```

## Faites-le

### Étape 1: une NIAH personnalisée pour votre domaine

Regardez !`code/main.py`Le squelette:

```python
def build_haystack(filler_text, needle, depth_ratio, total_tokens):
    if not (0.0 <= depth_ratio <= 1.0):
        raise ValueError(f"depth_ratio must be in [0, 1], got {depth_ratio}")
    if total_tokens <= 0:
        raise ValueError(f"total_tokens must be positive, got {total_tokens}")

    filler_tokens = tokenize(filler_text)
    needle_tokens = tokenize(needle)
    if not filler_tokens:
        raise ValueError("filler_text produced no tokens")

    # Repeat filler until long enough to fill the haystack body.
    body_len = max(total_tokens - len(needle_tokens), 0)
    while len(filler_tokens) < body_len:
        filler_tokens = filler_tokens + filler_tokens
    filler_tokens = filler_tokens[:body_len]

    insert_at = min(int(body_len * depth_ratio), body_len)
    haystack = filler_tokens[:insert_at] + needle_tokens + filler_tokens[insert_at:]
    return " ".join(haystack)


def score_niah(model, haystack, question, expected):
    answer = model.complete(f"Context: {haystack}\nQ: {question}\nA:", max_tokens=50)
    return 1 if expected.lower() in answer.lower() else 0
```

- Le balayage .`depth_ratio`∈ {0, 0, 25, 0, 5, 0, 75, 1,0} × `total_tokens`Tracez la carte thermique, c'est la carte NIAH pour votre modèle cible.

### Étape 2: une variante à plusieurs aiguilles

```python
def build_multi_needle(filler, needles, total_tokens):
    depths = [0.1, 0.4, 0.7]
    chunks = [filler[:int(total_tokens * 0.1)]]
    for depth, needle in zip(depths, needles):
        chunks.append(needle)
        next_chunk = filler[int(total_tokens * depth): int(total_tokens * (depth + 0.3))]
        chunks.append(next_chunk)
    return " ".join(chunks)
```

Les questions comme "Quels sont les trois mots magiques?" nécessitent de les récupérer toutes les trois.

### Étape 3: Traçage des variables à plusieurs branches (à la mode RULER)

```python
haystack = """X1 = 42. ... (filler) ... X2 = X1 + 10. ... (filler) ... X3 = X2 * 2."""
question = "What is X3?"
```

La réponse nécessite la liaison de trois tâches. Les modèles frontaliers à 128k tombent souvent à 50-70% de précision ici.

### Étape 4: LongBench v2 sur votre pile

```python
from datasets import load_dataset
longbench = load_dataset("THUDM/LongBench-v2")

def eval_model_on_longbench(model, subset="single-doc-qa"):
    tasks = [x for x in longbench["test"] if x["task"] == subset]
    correct = 0
    for x in tasks:
        answer = model.complete(x["context"] + "\n\nQ: " + x["question"], max_tokens=20)
        if normalize(answer) == normalize(x["answer"]):
            correct += 1
    return correct / len(tasks)
```

Les scores agrégés cachent de grandes différences au niveau des tâches.

## Les pièges

- **NIAH-only evaluation.**Passer NIAH à 1M de jetons ne dit rien sur le multi-hop.
- **Uniform depth sampling.**De nombreuses implémentations ne testent que la profondeur = 0,5.
- **Lexical overlap with filler.**Si l'aiguille partage des mots clés avec le remplissage, la récupération devient trivial.
- **Ignoring latency.**Les instructions de 1M-token prennent 30 à 120 secondes pour être remplies. Mesurer le temps du premier-token en plus de la précision.
- **Vendor-self-reported numbers.**OpenAI, Google, Anthropic publient tous leurs propres scores.

## Utilisez-le

La pile de 2026:

| Situation | Benchmark |
|-----------|-----------|
| Quick sanity check | Custom NIAH at 3 depths × 3 lengths |
| Model selection for production | RULER (13 tasks) at your target length |
| Real-world QA quality | LongBench v2 single-doc-QA subset |
| Multi-hop reasoning | BABILong or custom variable-tracing |
| Conversational / dialogue | MRCR 8-needle at your target length |
| Model upgrade regression | Fixed in-house NIAH + RULER harness, run on every new model |

Règle générale pour la production: ne jamais faire confiance à une fenêtre contextuelle tant que vous n'avez pas de tâche de raisonnement NIAH + 1 à la longueur prévue.

## La faire partir

- Je ne sais pas .`outputs/skill-long-context-eval.md`- Le numéro de la liste:

```markdown
---
name: long-context-eval
description: Design a long-context evaluation battery for a given model and use case.
version: 1.0.0
phase: 5
lesson: 28
tags: [nlp, long-context, evaluation]
---

Given a target model, target context length, and use case, output:

1. Tests. NIAH depth × length grid; RULER multi-hop; custom domain task.
2. Sampling. Depths 0, 0.25, 0.5, 0.75, 1.0 at each length.
3. Metrics. Retrieval pass rate; reasoning pass rate; time-to-first-token; cost-per-query.
4. Cutoff. Effective retrieval length (90% pass) and effective reasoning length (70% pass). Report both.
5. Regression. Fixed harness, rerun on every model upgrade, surface deltas.

Refuse to trust a context window from the model card alone. Refuse NIAH-only evaluation for any multi-hop workload. Refuse vendor self-reported long-context scores as independent evidence.
```

## Exercices

1. **Easy.**Construisez un NIAH avec 3 profondeurs (0,25, 0,5, 0,75) × 3 longueurs (1k, 4k, 16k).
2. **Medium.**Ajoutez une variante à 3 aiguilles. Mesurez la récupération des 3 à chaque longueur. Comparer à la fréquence de passage à une aiguille à la même longueur.
3. **Hard.**Construire une tâche de suivi variable (X1 → X2 → X3, avec 3 sauts) intégrée dans 64k de remplissage. Mesurer la précision sur 3 modèles frontaliers. Rapporter la longueur de raisonnement efficace par modèle.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NIAH | Needle in haystack | Plant a fact in filler, ask the model to retrieve it. |
| RULER | NIAH on steroids | 13 task types across retrieval / multi-hop / aggregation / QA. |
| Effective context | The real capacity | Length at which accuracy still holds above threshold. |
| Lost in the middle | Depth bias | Models under-attend to content in the middle of long inputs. |
| Multi-needle | Many facts at once | Multiple plants; tests attention juggling, not retrieval alone. |
| MRCR | Multi-round coref | 8, 24, or 100-needle coreference; exposes attention saturation. |
| NoLiMa | Non-lexical needle | Needle and query share no literal tokens; requires reasoning. |

## Pour en savoir plus

- [Kamradt (2023). Needle in a Haystack analysis](https://github.com/gkamradt/LLMTest_NeedleInAHaystack) le référentiel original de la NIAH.
- [Hsieh et al. (2024). RULER: What's the Real Context Size of Your Long-Context LMs?](https://arxiv.org/abs/2404.06654) l'indice de référence multi-tasks.
- [Bai et al. (2024). LongBench v2](https://arxiv.org/abs/2412.15204) évaluation dans le contexte réel.
- [Modarressi et al. (2024). NoLiMa: Non-lexical needles](https://arxiv.org/abs/2404.06666)- Des aiguilles plus dures.
- [Kuratov et al. (2024). BABILong](https://arxiv.org/abs/2406.10149)- Le raisonnement dans le pavé de foin.
- [Liu et al. (2024). Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172) le papier de profondeur.
