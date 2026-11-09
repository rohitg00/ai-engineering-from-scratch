# Suivi de l'état du dialogue

> "Je veux un restaurant bon marché dans le nord... en fait, faire modérer... et ajouter l'italien". Trois tours, trois mises à jour de l'état.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 20 (Structured Outputs)
**Time:** ~75 minutes

## Le problème

Dans un système de dialogue axé sur les tâches, l'objectif de l'utilisateur est codé en tant que jeu de paires de valeurs de fente: `{cuisine: italian, area: north, price: moderate}`Chaque tour d'utilisateur peut ajouter, modifier ou supprimer un espace. Le système doit lire toute la conversation et exécuter l'état actuel correctement.

Si vous faites une seule fente de jeu mal, le système réserve le mauvais restaurant, planifie le mauvais vol ou facture la mauvaise carte.

Pourquoi cela importe encore en 2026 malgré les LLM:

- Les domaines sensibles à la conformité (banque, santé, réservation de compagnies aériennes) exigent des valeurs déterministes des fentes, et non la génération de formes libres.
- Les agents utilisateurs d'outils ont toujours besoin de résolution de la fente avant d'appeler les API.
- La correction à plusieurs tours est plus difficile qu'il n'y paraît: "en fait non, fais-le jeudi".

Le pipeline moderne: concepts classiques de DST + extracteurs LLM + barreaux de sortie structurés.

## Le concept

![DST: dialog history → slot-value state](../assets/dst.svg)

**Task structure.**Un schéma définit les domaines (restaurant, hôtel, taxi) et leurs fentes (cuisine, zone, prix, personnes). Chaque fente peut être vide, rempli d'une valeur d'un ensemble fermé (prix: {chef, modéré, cher}), ou d'une valeur de forme libre (nom: "The Copper Kettle").

**Two DST formulations.**

- **Classification.**Pour chaque paire (slot, candidate_value), prédire oui/non. Fonctionne pour les slots à vocabulaire fermé.
- **Generation.**En fonction du dialogue, générez des valeurs de fentes en texte libre.

**Metric.**La précision des objectifs communs (JGA)  la fraction de virages où * chaque * fente est correcte. Tout ou rien. MultiWOZ 2.4 figure au sommet du classement d'environ 83% en 2026.

**Architectures.**

1. **Rule-based (slot regex + keyword).**Une base forte pour les domaines étroits.
2. **TripPy / BERT-DST.**Génération basée sur la copie avec un codage BERT.
3. **LDST (LLaMA + LoRA).**LLM adapté aux instructions avec une demande de domaine.
4. **Ontology-free (2024–26).**Sautez le schéma, générez directement les noms et les valeurs des fentes.
5. **Prompt + structured output (2024–26).**LLM avec schéma Pydantic + décoding restreint. 5 lignes de code, prête à être produite.

### Les modes de défaillance classiques

- **Co-reference across turns.**"Restez avec la première option". Il faut décider quelle option.
- **Over-write vs append.**L'utilisateur dit "ajouter italien". Vous remplacez la cuisine ou ajouter?
- **Implicit confirmations.**"OK cool"  a accepté la réservation proposée?
- **Correction.**"En fait, il est 19h". Il faut mettre à jour l'heure sans dégager d'autres machines.
- **Coreference to previous system utterance.**"Oui, celui-là". Quel "c'est" ?

```figure
n5-slot-tracker
```

## Faites-le

### Étape 1: extracteur de fentes basé sur des règles

Regardez !`code/main.py`. Les dictionnaires de régex + synonymes couvrent 70% des déclarations canoniques dans des domaines étroits:

```python
CUISINE_SYNONYMS = {
    "italian": ["italian", "pasta", "pizza", "italy"],
    "chinese": ["chinese", "chow mein", "noodles"],
}


def extract_cuisine(utterance):
    for canonical, synonyms in CUISINE_SYNONYMS.items():
        if any(syn in utterance.lower() for syn in synonyms):
            return canonical
    return None
```

Il est fragile hors du vocabulaire canonique, il fonctionne pour les confirmations déterministes.

### Étape 2: boucle d'actualisation de l'état

```python
def update_state(state, utterance):
    new_state = dict(state)
    for slot, extractor in SLOT_EXTRACTORS.items():
        value = extractor(utterance)
        if value is not None:
            new_state[slot] = value
    for slot in NEGATION_CLEARS:
        if is_negated(utterance, slot):
            new_state[slot] = None
    return new_state
```

Trois invariants:

- Ne réinitialisez jamais une fente que l'utilisateur n'a pas touchée.
- Il faut éliminer le déni explicite ("ne pas se soucier de la cuisine").
- La correction utilisateur ("actuellement...") doit être réécrite en dessous, et non ajoutée.

### Étape 3: DST axé sur la LM avec une sortie structurée

```python
from pydantic import BaseModel
from typing import Literal, Optional
import instructor

class RestaurantState(BaseModel):
    cuisine: Optional[Literal["italian", "chinese", "indian", "thai", "any"]] = None
    area: Optional[Literal["north", "south", "east", "west", "center"]] = None
    price: Optional[Literal["cheap", "moderate", "expensive"]] = None
    people: Optional[int] = None
    day: Optional[str] = None


def llm_dst(history, llm):
    prompt = f"""You track the slot values of a restaurant booking across turns.
Dialogue so far:
{render(history)}

Update the state based on the latest user turn. Output only the JSON state."""
    return llm(prompt, response_model=RestaurantState)
```

Instructor + Pydantic garantit un objet d'état valide.

### Étape 4: évaluation des AGJ

```python
def joint_goal_accuracy(predicted_states, gold_states):
    correct = sum(1 for p, g in zip(predicted_states, gold_states) if p == g)
    return correct / len(predicted_states)
```

Calibration: quelle fraction des tours le système obtient toutes les machines correctement? Pour MultiWOZ 2.4, les meilleurs systèmes 2026: 80-83%. Votre système dans le domaine devrait dépasser ce que vous avez sur votre vocabulaire étroit ou la ligne de base de LLM vous battre.

### Étape 5: correction de la manutention

```python
CORRECTION_CUES = {"actually", "no wait", "on second thought", "change that to"}


def is_correction(utterance):
    return any(cue in utterance.lower() for cue in CORRECTION_CUES)
```

Sur une correction détectée, écris la dernière fente mise à jour plutôt que d'ajouter. Difficile de se faire correctement sans l'aide de LLM. Le modèle moderne: laissez toujours le LLM régénérer l'ensemble de l'état de l'histoire plutôt que de mettre à jour progressivement  cela gère naturellement les corrections.

## Les pièges

- **Full-history regeneration cost.**Laisser le MLL régénérer chaque tour coûte $O(n^2)$Les données de la liste des actions de la Commission sont les suivantes:
- **Schema drift.**L'ajout de nouveaux slots après le hoc casse les données de formation anciennes.
- **Case sensitivity.**"Italien" contre "italien" contre "Italien"  se normalisent partout.
- **Implicit inheritance.**Si l'utilisateur a déjà spécifié "pour 4 personnes", une nouvelle demande pour un autre moment ne devrait pas effacer les personnes.
- **Free-form vs closed-set.**Les noms, les heures et les adresses doivent être en forme libre; les cuisines et les zones sont fermées.

## Utilisez-le

La pile de 2026:

| Situation | Approach |
|-----------|----------|
| Narrow domain (one or two intents) | Rule-based + regex |
| Broad domain, labeled data available | LDST (LLaMA + LoRA on MultiWOZ-style data) |
| Broad domain, no labels, prod-ready | LLM + Instructor + Pydantic schema |
| Spoken / voice | ASR + normalizer + LLM-DST |
| Multi-domain booking flow | Schema-guided LLM with per-domain Pydantic models |
| Compliance-sensitive | Rule-based primary, LLM fallback with confirmation flow |

## La faire partir

- Je ne sais pas .`outputs/skill-dst-designer.md`- Le numéro de la liste:

```markdown
---
name: dst-designer
description: Design a dialogue state tracker — schema, extractor, update policy, evaluation.
version: 1.0.0
phase: 5
lesson: 29
tags: [nlp, dialogue, task-oriented]
---

Given a use case (domain, languages, vocab openness, compliance needs), output:

1. Schema. Domain list, slots per domain, open vs closed vocabulary per slot.
2. Extractor. Rule-based / seq2seq / LLM-with-Pydantic. Reason.
3. Update policy. Regenerate-whole-state / incremental; correction handling; negation handling.
4. Evaluation. Joint Goal Accuracy on a held-out dialogue set, slot-level precision/recall, confusion on the hardest slot.
5. Confirmation flow. When to explicitly ask the user to confirm (destructive actions, low-confidence extractions).

Refuse LLM-only DST for compliance-sensitive slots without a rule-based secondary check. Refuse any DST that cannot roll back a slot on user correction. Flag schemas without version tags.
```

## Exercices

1. **Easy.**Construire le tracker d' état basé sur des règles en `code/main.py`Pour 3 fentes (cuisine, surface, prix), test sur 10 dialogues faits à la main. Mesurer JGA.
2. **Medium.**Le même ensemble de données avec Instructor + Pydantic + un petit LLM. Comparer JGA.
3. **Hard.**Mettre en œuvre à la fois et la route: primaire basé sur les règles, LLM fallback lorsque les règles basées sur les règles émettent < 2 espaces avec confiance. Mesurer le coût combiné de l'AGA et de l'inférence par tour.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| DST | Dialogue state tracking | Maintain the slot-value dict across dialogue turns. |
| Slot | Unit of user intent | Named parameter the backend needs (cuisine, date). |
| Domain | The task area | Restaurant, hotel, taxi — sets of slots. |
| JGA | Joint Goal Accuracy | Fraction of turns where every slot is correct. All-or-nothing. |
| MultiWOZ | The benchmark | Multi-domain WOZ dataset; standard DST evaluation. |
| Ontology-free DST | No schema | Generate slot names and values directly, no fixed list. |
| Correction | "Actually..." | Turn that overwrites a previously-filled slot. |

## Pour en savoir plus

- [Budzianowski et al. (2018). MultiWOZ — A Large-Scale Multi-Domain Wizard-of-Oz](https://arxiv.org/abs/1810.00278) le point de référence canonique.
- [Feng et al. (2023). Towards LLM-driven Dialogue State Tracking (LDST)](https://arxiv.org/abs/2310.14970) LLaMA + LoRA réglage des instructions pour le DST.
- [Heck et al. (2020). TripPy — A Triple Copy Strategy for Value Independent Neural Dialog State Tracking](https://arxiv.org/abs/2005.02877) le cheval de travail DST à base de copie.
- [King, Flanigan (2024). Unsupervised End-to-End Task-Oriented Dialogue with LLMs](https://arxiv.org/abs/2404.10753) TDE non supervisée basée sur des EM.
- [MultiWOZ leaderboard](https://github.com/budzianowski/multiwoz) résultats canoniques de la TDS.
