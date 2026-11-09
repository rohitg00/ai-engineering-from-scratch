# L'entité liant et désambiguant

> NER a trouvé "Paris". L'entité reliant décide: Paris, France? Paris Hilton? Paris, Texas? Paris (le prince de Troie)?

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 24 (Coreference Resolution)
**Time:** ~60 minutes

## Le problème

Une phrase dit: "Jordan bat la presse". Votre NER marque "Jordan" comme PERSON.

- Michael Jordan (basketball) ?
- Michael B. Jordan (acteur)?
- Michael I. Jordan (professeur de l'éducation de Berkeley  oui, cette confusion est réelle dans les documents de l'éducation de l'homme)?
- La Jordanie ?
- Jordan (prénom hébreu)?

L'entité de liaison (EL) résolve chaque mention à une entrée unique dans une base de connaissances: Wikidata, Wikipedia, DBpedia ou votre domaine KB. Deux sous-tâches:

1. **Candidate generation.**Compte tenu de "Jordan", quelles entrées KB sont plausibles ?
2. **Disambiguation.**Compte tenu du contexte, quel candidat est le bon ?

Les deux étapes sont appréciables. Les deux sont comparées. Le pipeline combiné est stable depuis une décennie  ce qui change est la qualité du désambiguateur.

## Le concept

![Entity linking pipeline: mention → candidates → disambiguated entity](../assets/entity-linking.svg)

**Candidate generation.**Compte tenu de la forme de surface de mention (" Jordan ") , recherchez les candidats dans un index d'alias. Les dictionnaires de Wikipedia couvrent la plupart des entités nommées: " JFK " → John F. Kennedy, Jacqueline Kennedy, aéroport JFK, JFK (film).

**Disambiguation: three approaches.**

1. **Prior + context (Milne & Witten, 2008).** `P(entity | mention) × context-similarity(entity, text)`Ça marche bien, vite, pas d'entraînement.
2. **Embedding-based (ESS / REL / Blink).**Encode mention + contexte. Encode la description de chaque candidat. Choisissez max cosine. Le modèle par défaut 2020-2024.
3. **Generative (GENRE, 2021; LLM-based, 2023+).**Décoder le nom canonique de l'entité par jeton. Restricted à un tri de noms d'entité valides afin que la sortie soit garantie d'être un KB id valide.

**End-to-end vs pipeline.**Les modèles modernes (ELQ, BLINK, ExtEnD, GENRE) exécutent NER + génération de candidats + désambiguation en un seul passage.

### Les deux mesures

- **Mention recall (candidate gen).**Fraction d'or mentionné lorsque la bonne entrée KB apparaît dans la liste des candidats.
- **Disambiguation accuracy / F1.**Combien de fois le premier est-il correct ?

Un système avec 99% de doute sur 80% de rappel des candidats est un pipeline de 80%.

```figure
gx-entity-linking
```

## Faites-le

### Étape 1: créer un index alias à partir des redirections de Wikipédia

```python
alias_to_entities = {
    "jordan": ["Q41421 (Michael Jordan)", "Q810 (Jordan, country)", "Q254110 (Michael B. Jordan)"],
    "paris":  ["Q90 (Paris, France)", "Q663094 (Paris, Texas)", "Q55411 (Paris Hilton)"],
    "apple":  ["Q312 (Apple Inc.)", "Q89 (apple, fruit)"],
}
```

Les données de l'alias de Wikipédia: ~ 18M (alias, entité) paires. Télécharger à partir de Wikidata dumps.

### Étape 2: désambiguation fondée sur le contexte

```python
def disambiguate(mention, context, alias_index, entity_desc):
    candidates = alias_index.get(mention.lower(), [])
    if not candidates:
        return None, 0.0
    context_words = set(tokenize(context))
    best, best_score = None, -1
    for entity_id in candidates:
        desc_words = set(tokenize(entity_desc[entity_id]))
        union = len(context_words | desc_words)
        score = len(context_words & desc_words) / union if union else 0.0
        if score > best_score:
            best, best_score = entity_id, score
    return best, best_score
```

Le jaccard est un jouet.`code/main.py`étape 2 pour la version transformatrice).

### Étape 3: basé sur l'intégration (à la mode BLINK)

```python
from sentence_transformers import SentenceTransformer
encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

def embed_mention(text, mention_span):
    start, end = mention_span
    marked = f"{text[:start]} [MENTION] {text[start:end]} [/MENTION] {text[end:]}"
    return encoder.encode([marked], normalize_embeddings=True)[0]

def embed_entity(entity_id, description):
    return encoder.encode([f"{entity_id}: {description}"], normalize_embeddings=True)[0]
```

Au moment de l'index, embellez chaque entité KB une fois. Au moment de la requête, embellez la mention + contexte une fois, point-produit contre le pool de candidats, choisissez max.

### Étape 4: lien entre entités génératives (concept)

GENRE décode le titre de Wikipédia de l'entité caractère par caractère. Le décoding restreint (voir leçon 20) garantit que seuls les titres valides peuvent être produits.

```python
prompt = f"""Text: {text}
Mention: {mention}
List the best Wikipedia title for this mention.
Respond with JSON: {{"title": "..."}}"""
```

Combiné à une liste blanche (Résumé `choice`), il s'agit du pipeline EL le plus simple à expédier en 2026.

### Étape 5: évaluer l'AIDA-CoNLL

L'AIDA-CoNLL est le critère de référence standard de l'EL: 1 393 articles Reuters, 34 000 mentions, entités de Wikipédia.`P@1`) et le taux de détection des NIL hors KB.

## Les pièges

- **NIL handling.**Certains noms ne figurent pas dans le KB (entités émergentes, personnes obscures). Les systèmes doivent prédire le NIL au lieu de deviner l'entité incorrecte. Mesurés séparément.
- **Mention boundary errors.**En amont, le NER manque des délais partiels ("Bank of America" marqué simplement comme "Bank").
- **Popularity bias.**Les systèmes formés prédisent trop souvent les entités fréquentes.
- **Cross-lingual EL.**Le mappage mentionne dans le texte chinois les entités de Wikipédia en anglais.
- **KB staleness.**Les nouvelles entreprises, les événements, les gens ne sont pas dans le dépotoir de Wikipédia de l'année dernière.

## Utilisez-le

La pile de 2026:

| Situation | Pick |
|-----------|------|
| General-purpose English + Wikipedia | BLINK or REL |
| Cross-lingual, KB = Wikipedia | mGENRE |
| LLM-friendly, few mentions/day | Prompt Claude/GPT-4 with candidate list + constrained JSON |
| Domain-specific KB (medical, legal) | Custom BERT with KB-aware retrieval + fine-tune on domain AIDA-style set |
| Extremely low-latency | Exact-match prior only (Milne-Witten baseline) |
| Research SOTA | GENRE / ExtEnD / generative LLM-EL |

Modèle de production qui expédie en 2026: NER → coref → EL sur chaque mention → collapse des grappes à une entité canonique par grappe.

## La faire partir

- Je ne sais pas .`outputs/skill-entity-linker.md`- Le numéro de la liste:

```markdown
---
name: entity-linker
description: Design an entity linking pipeline — KB, candidate generator, disambiguator, evaluation.
version: 1.0.0
phase: 5
lesson: 25
tags: [nlp, entity-linking, knowledge-graph]
---

Given a use case (domain KB, language, volume, latency budget), output:

1. Knowledge base. Wikidata / Wikipedia / custom KB. Version date. Refresh cadence.
2. Candidate generator. Alias-index, embedding, or hybrid. Target mention recall @ K.
3. Disambiguator. Prior + context, embedding-based, generative, or LLM-prompted.
4. NIL strategy. Threshold on top score, classifier, or explicit NIL candidate.
5. Evaluation. Mention recall @ 30, top-1 accuracy, NIL-detection F1 on held-out set.

Refuse any EL pipeline without a mention-recall baseline (you cannot evaluate a disambiguator without knowing candidate gen surfaced the right entity). Refuse any pipeline using LLM-prompted EL without constrained output to valid KB ids. Flag systems where popularity bias affects minority entities (e.g. name-clashes) without domain fine-tuning.
```

## Exercices

1. **Easy.**Implémenter le désambiguateur prior+context en `code/main.py`Les données de référence sont fournies par le système de référence de la marque de référence, qui est le plus utilisé pour la marque de référence.
2. **Medium.**Encodez 50 mentions ambiguës avec un transformateur de phrases. Embed la description de chaque candidat. Comparer la désambiguité basée sur l'embedding au contexte de Jaccard.
3. **Hard.**Construisez un domaine de 1k entités KB (par exemple, les employés + produits de votre entreprise). Implémenter NER + EL de bout en bout. Mesurer la précision et rappeler sur 100 phrases retenues.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Entity linking (EL) | Link to Wikipedia | Map a mention to a unique KB entry. |
| Candidate generation | Who could it be? | Return a shortlist of plausible KB entries for a mention. |
| Disambiguation | Pick the right one | Score candidates using context, pick the winner. |
| Alias index | The lookup table | Map from surface form → candidate entities. |
| NIL | Not in KB | Explicit prediction that no KB entry matches. |
| KB | Knowledge base | Wikidata, Wikipedia, DBpedia, or your domain KB. |
| AIDA-CoNLL | The benchmark | 1,393 Reuters articles with gold entity links. |

## Pour en savoir plus

- [Milne, Witten (2008). Learning to Link with Wikipedia](https://researchcommons.waikato.ac.nz/entities/publication/b9a0b520-abc5-47c5-a86a-da6c579893ab) l'approche prioritaire fondamental et le contexte.
- [Wu et al. (2020). Zero-shot Entity Linking with Dense Entity Retrieval (BLINK)](https://arxiv.org/abs/1911.03814) le cheval de travail basé sur l'intégration.
- [De Cao et al. (2021). Autoregressive Entity Retrieval (GENRE)](https://arxiv.org/abs/2010.00904) EL génératif avec décoding restreint.
- [Hoffart et al. (2011). Robust Disambiguation of Named Entities in Text (AIDA)](https://www.aclweb.org/anthology/D11-1072.pdf) le document de référence.
- [REL: An Entity Linker Standing on the Shoulders of Giants (2020)](https://arxiv.org/abs/2006.01969) la pile de production ouverte.
