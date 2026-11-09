# Les sorties structurées et le décoding restreint

> Demandez à un LLM pour JSON. Obtenez JSON la plupart du temps. Dans la production, "la plupart" est le problème. Le décoding restreint se transforme en "la plupart" en "tous les temps" en éditant les logits avant le prélèvement.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 17 (Chatbots), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## Le problème

Un classifiant demande à un LLM: "Retournez un de {positif, négatif, neutre}." Le modèle retourne "Le sentiment est positif  cette critique est extrêmement favorable parce que le client déclare explicitement qu'ils ...". Votre parseur s'écrase.

La production libre n'est pas un contrat, c'est une suggestion, un système de production a besoin d'un contrat.

Trois couches existent en 2026.

1. **Prompting.**Demandez gentiment. "Retournez seulement l'objet JSON". Fonctionne à environ 80% sur les modèles frontaliers, moins sur les plus petits.
2. **Native structured output APIs.**OpenAI `response_format`, utilisation de l'outil anthropic, mode JSON Gémeaux, fiable sur les schémas pris en charge, verrouillé par le fournisseur.
3. **Constrained decoding.**Modifiez les logits à chaque étape de génération afin que le modèle * ne peut pas * émettre de jetons invalides. 100% valide par construction. Fonctionne sur n'importe quel modèle local.

Cette leçon nous donne l'intuition de les trouver et de savoir à quel moment.

## Le concept

![Constrained decoding masking invalid tokens at each step](../assets/constrained-decoding.svg)

**How constrained decoding works.**À chaque étape de génération, le LLM produit un vecteur logite sur le vocabulaire complet (~ 100k tokens). Un processeur logit se trouve entre le modèle et le prélèvement. Il calcule les jetons qui sont valides compte tenu de la position actuelle dans la grammaire cible  JSON Schema, regex, grammaire sans contexte  et fixe les logits de tous les jetons invalides à l'infini négatif. La masse de probabilité est seulement appliquée aux continuations valides par la masse de douceur sur les logits restants.

Mise en œuvre en 2026:

- **Outlines.**Compile JSON Schema ou regex dans une machine d'état fini.$O(1)$Les systèmes récursifs doivent être éclaircis.
- **XGrammar / llguidance.**Les moteurs de grammaire sans contexte. gérer le schéma JSON récursif. décoding presque zéro. OpenAI a crédité l'orientation dans leur mise en œuvre structurée de sortie 2025.
- **vLLM guided decoding.**Intégré`guided_json`- Je suis là .`guided_regex`- Je suis là .`guided_choice`- Je suis là .`guided_grammar`par contours, XGrammar ou lm-format-enforcer arrière-plan.
- **Instructor.**Enveloppe basée sur Pydantic sur tout LLM. Retries sur l'échec de validation. Cross-provider, mais ne modifie pas les logits  il repose sur retries + structurés-output-conscious prompts.

### Le résultat contre-intuitif

Le décoding restreint est souvent plus rapide que la génération non restreinte. Deux raisons. Premièrement, il réduit l'espace de recherche du prochain jeton. Deuxièmement, les implémentations intelligentes sautent entièrement la génération de jetons pour les jetons forcés (échafaudage comme ).`{"name": "` chaque octet est déterminé).

### Le piège qui vous coûte

L'ordre du terrain est important.`answer`avant `reasoning`JSON est valide, la réponse est erronée, aucune validation ne la capture.

```json
// BAD
{"answer": "yes", "reasoning": "because ..."}

// GOOD
{"reasoning": "... therefore ...", "answer": "yes"}
```

L'ordre des champs de schéma est logique, pas de formatage.

```figure
constrained-decoder
```

## Faites-le

### Étape 1: génération régex-constraint à partir de zéro

Regardez !`code/main.py`L'idée principale est de 30 lignes:

```python
def mask_logits(logits, valid_token_ids):
    mask = [float("-inf")] * len(logits)
    for tid in valid_token_ids:
        mask[tid] = logits[tid]
    return mask


def generate_constrained(model, tokenizer, prompt, fsm):
    ids = tokenizer.encode(prompt)
    state = fsm.initial_state
    while not fsm.is_accept(state):
        logits = model.next_token_logits(ids)
        valid = fsm.valid_tokens(state, tokenizer)
        logits = mask_logits(logits, valid)
        tok = sample(logits)
        ids.append(tok)
        state = fsm.transition(state, tok)
    return tokenizer.decode(ids)
```

Le FSM suit les parties de la grammaire que nous avons satisfaites jusqu'à présent. `valid_tokens(state, tokenizer)`Il est également possible de calculer quels tokens de vocabulaire peuvent faire progresser le FSM sans quitter un chemin d'acceptation.

### Étape 2: Des lignes directrices pour le schéma JSON

```python
from pydantic import BaseModel
from typing import Literal
import outlines


class Review(BaseModel):
    sentiment: Literal["positive", "negative", "neutral"]
    confidence: float
    evidence_span: str


model = outlines.models.transformers("meta-llama/Llama-3.2-3B-Instruct")
generator = outlines.generate.json(model, Review)

result = generator("Classify: 'The wait staff was attentive and the food arrived hot.'")
print(result)
# Review(sentiment='positive', confidence=0.93, evidence_span='attentive ... hot')
```

Le FSM rend inaccessible la sortie invalide.

### Étape 3: Instructeur pour Pydantic agnostique

```python
import instructor
from anthropic import Anthropic
from pydantic import BaseModel, Field


class Invoice(BaseModel):
    vendor: str
    total_usd: float = Field(ge=0)
    line_items: list[str]


client = instructor.from_anthropic(Anthropic())
invoice = client.messages.create(
    model="claude-opus-4-7",
    max_tokens=1024,
    response_model=Invoice,
    messages=[{"role": "user", "content": "Extract from: 'Acme Corp $420. Widget, Gizmo.'"}],
)
```

Le système de validation est un système de validation de type type type type type type, qui est utilisé pour la configuration de l'échantillon.

### Étape 4: API de fournisseur natif

```python
from openai import OpenAI

client = OpenAI()
response = client.responses.create(
    model="gpt-5",
    input=[{"role": "user", "content": "Classify: 'The food was cold.'"}],
    text={"format": {"type": "json_schema", "name": "sentiment",
          "schema": {"type": "object", "required": ["sentiment"],
                     "properties": {"sentiment": {"type": "string",
                                                  "enum": ["positive", "negative", "neutral"]}}}}},
)
print(response.output_parsed)
```

Décodage limité du côté du serveur. Parité de fiabilité avec Outlines pour les schémas pris en charge. Pas de gestion de modèle locale. Vous verrouille au fournisseur.

## Les pièges

- **Recursive schemas.**Les résultats structurés en arbres (commentaires en nid, AST) nécessitent une XGrammar ou une guide (à base de CFG).
- **Huge enums.**Enum de 10 000 options se compilent lentement ou à temps partiel.
- **Grammar too strict.**La force`date: "YYYY-MM-DD"`regex et le modèle ne peuvent pas être exécutés `"unknown"`Le modèle compense en inventant une date.`null`ou un sentinel.
- **Premature commitment.**Voir le piège de l'ordre du terrain ci-dessus.
- **Vendor JSON mode without schema.**Le mode JSON pur ne garantit que le JSON valide, pas valide *pour votre cas d'utilisation*. Fournir toujours un schéma complet.

## Utilisez-le

La pile de 2026:

| Situation | Pick |
|-----------|------|
| OpenAI/Anthropic/Google model, simple schema | Native vendor structured output |
| Any provider, Pydantic workflow, can tolerate retries | Instructor |
| Local model, need 100% validity, flat schema | Outlines (FSM) |
| Local model, recursive schema | XGrammar or llguidance |
| Self-hosted inference server | vLLM guided decoding |
| Batch processing with retries acceptable | Instructor + cheapest model |

## La faire partir

- Je ne sais pas .`outputs/skill-structured-output-picker.md`- Le numéro de la liste:

```markdown
---
name: structured-output-picker
description: Choose a structured output approach, schema design, and validation plan.
version: 1.0.0
phase: 5
lesson: 20
tags: [nlp, llm, structured-output]
---

Given a use case (provider, latency budget, schema complexity, failure tolerance), output:

1. Mechanism. Native vendor structured output, Instructor retries, Outlines FSM, or XGrammar CFG. One-sentence reason.
2. Schema design. Field order (reasoning first, answer last), nullable fields for "unknown", enum vs regex, required fields.
3. Failure strategy. Max retries, fallback model, graceful `null` handling, out-of-distribution refusal.
4. Validation plan. Schema compliance rate (target 100%), semantic validity (LLM-judge), field-coverage rate, latency p50/p99.

Refuse any design that puts `answer` or `decision` before reasoning fields. Refuse to use bare JSON mode without a schema. Flag recursive schemas behind an FSM-only library.
```

## Exercices

1. **Easy.**Prendre un petit modèle à poids ouvert (p. ex., Llama-3.2-3B) sans décoder forcément pour `Review(sentiment, confidence, evidence_span)`Mesurer la fraction qui analyse comme JSON valide sur 100 avis.
2. **Medium.**Le même corpus avec le mode JSON. Comparer le taux de conformité, la latence et la précision sémantique.
3. **Hard.**Implementer un décodeur régex-constraint à partir de zéro pour les numéros de téléphone (`\d{3}-\d{3}-\d{4}`Vérifiez 0 résultats non valides sur 1000 échantillons.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Constrained decoding | Force valid output | Mask invalid-token logits at every generation step. |
| Logit processor | The thing that constrains | Function: `(logits, state) -> masked_logits`. |
| FSM | Finite-state machine | Compiled grammar representation; $O(1)$ valid-next-token lookup. |
| CFG | Context-free grammar | Grammar that handles recursion; slower but more expressive than FSM. |
| Schema field order | Does it matter? | Yes — first field commits; always put reasoning before answer. |
| Guided decoding | vLLM's name for it | Same concept, integrated into the inference server. |
| JSON mode | OpenAI's early version | Guarantees JSON syntax; does NOT guarantee schema match. |

## Pour en savoir plus

- [Willard, Louf (2023). Efficient Guided Generation for LLMs](https://arxiv.org/abs/2307.09702) Le journal Outlines.
- [XGrammar paper (2024)](https://arxiv.org/abs/2411.15100) décoding limité rapide basé sur le CFG.
- [vLLM — Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html) intégration du serveur d'inférence.
- [OpenAI — Structured Outputs guide](https://platform.openai.com/docs/guides/structured-outputs) référence API + gotchas.
- [Instructor library](https://python.useinstructor.com/) Pydantic + réessaie à travers les fournisseurs.
- [JSONSchemaBench (2025)](https://arxiv.org/abs/2501.10868) comparation 6 cadres de décoding restreints.
