# Résultats de l'extraction et de la conception de graphiques de connaissances

> L'extraction de relation trouve les bords entre eux. Un graphique de connaissance est la somme des nœuds, des bords et de leur provenance.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 25 (Entity Linking)
**Time:** ~60 minutes

## Le problème

Un analyste lit: "Tim Cook est devenu PDG d'Apple en 2011". Quatre faits:

- `(Tim Cook, role, CEO)`
- `(Tim Cook, employer, Apple)`
- `(Tim Cook, start_date, 2011)`
- `(Apple, type, Organization)`

Relation Extraction (RE) transforme le texte libre en triple structuré `(subject, relation, object)`- Aggreger dans un corpus et vous avez un graphique de connaissances. Aggreger et demander et vous avez un substrat de raisonnement pour RAG, analytique, ou audits de conformité.

Le problème de 2026: les LLM extraient les relations avec enthousiasme. Trop enthousiasmément. Ils hallucinent des triples que le texte source ne supporte pas. Sans provenance, vous ne pouvez pas distinguer les triples réels de la fiction plausible. La réponse de 2026 est des pipelines d'ancrage et de vérification à la manière AEVS.

## Le concept

![Text → triples → knowledge graph](../assets/relation-extraction.svg)

**Triple form.** `(subject_entity, relation_type, object_entity)`Les relations proviennent d'une ontologie fermée (propriétés de Wikidata, FIBO, UMLS) ou d'un ensemble ouvert (à la manière d'OpenIE, tout est possible).

**Three extraction approaches.**

1. **Rule / pattern-based.**Modèles Hearst: "X comme Y" → `(Y, isA, X)`- Plus un régex fait à la main, fragile, précis, expliquable.
2. **Supervised classifier.**Compte tenu des deux mentions d'entités dans une phrase, prédire la relation à partir d'un ensemble fixe.
3. **Generative LLM.**Faites en sorte que le modèle émet des triples, ça marche à l'extérieur de la boîte, ça doit être de l'origine, ou ça fait des hallucinations.

**AEVS (Anchor-Extraction-Verification-Supplement, 2026).**Le cadre actuel d'atténuation des hallucinations:

- **Anchor.**Identifier chaque espace d'entité et chaque espace de relation-phrase avec des positions exactes.
- **Extract.**Générer des triples liés aux spans d'ancrage.
- **Verify.**Correspondrez chaque élément triple au texte source; rejetez tout ce qui n'est pas pris en charge.
- **Supplement.**Un passe de couverture garantit qu'aucune détente ancrée ne tombe.

Les hallucinations diminuent fortement, nécessitent plus de calcul mais sont vérifiables.

**The open-vs-closed tradeoff.**

- **Closed ontology.**Liste de propriétés fixes (par exemple, les 11 000+ propriétés de Wikidata). Prévisible. Chérable. Difficile à inventer.
- **Open IE.**Toutes les phrases verbales deviennent une relation, rappel élevé, faible précision, désordre pour la requête.

Les KG de production se mélangent généralement: ouvrent IE pour la découverte, puis canonisent les relations sur une ontologie fermée avant de fusionner dans le graphique principal.

```figure
relation-triples
```

## Faites-le

### Étape 1: extraction à base de motifs

```python
PATTERNS = [
    (r"(?P<s>[A-Z]\w+) (?:is|was) (?:a|an|the) (?P<o>[A-Z]?\w+)", "isA"),
    (r"(?P<s>[A-Z]\w+) (?:is|was) born in (?P<o>\w+)", "bornIn"),
    (r"(?P<s>[A-Z]\w+) works? (?:at|for) (?P<o>[A-Z]\w+)", "worksAt"),
    (r"(?P<s>[A-Z]\w+) founded (?P<o>[A-Z]\w+)", "founded"),
]
```

Regardez !`code/main.py`Les modèles Hearst sont toujours expédiés dans des pipelines spécifiques à un domaine parce qu'ils sont débogables.

### Étape 2: extraction de relations de séquence supervisée

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("Babelscape/rebel-large")
model = AutoModelForSeq2SeqLM.from_pretrained("Babelscape/rebel-large")

text = "Tim Cook was born in Alabama. He later became CEO of Apple."
encoded = tok(text, return_tensors="pt", truncation=True)
output = model.generate(**encoded, max_length=200)
decoded = tok.batch_decode(output, skip_special_tokens=False)
```

REBEL est un extracteur de relation seq2seq basé sur BART: il génère des triples au lieu de classer des paires d'entités.`<triplet>`- Je suis là .`<subj>`et `<obj>`Les marqueurs, donc partager sur eux (comme le parseur de la carte modèle) pour obtenir `(subject, relation, object)`Les données de surveillance à distance, les poids ouverts standard.

### Étape 3: extraction à l'aide d'un MLL avec ancrage

```python
prompt = f"""Extract (subject, relation, object) triples from the text.
For each triple, include the exact character span in the source text.

Text: {text}

Output JSON:
[{{"subject": {{"text": "...", "span": [start, end]}},
   "relation": "...",
   "object": {{"text": "...", "span": [start, end]}}}}, ...]

Only include triples fully supported by the text. No inference beyond what is stated.
"""
```

Vérifiez chaque décalage retourné contre la source.`text[start:end] != triple_entity`C'est l'étape "vérifier" de l'AEVS sous sa forme minimale.

### Étape 4: canonize sur une ontologie fermée

```python
RELATION_MAP = {
    "is the CEO of": "P169",       # "chief executive officer"
    "was born in":   "P19",         # "place of birth"
    "founded":        "P112",       # "founded by" (inverted subject/object)
    "works at":       "P108",       # "employer"
}


def canonicalize(relation):
    rel_low = relation.lower().strip()
    if rel_low in RELATION_MAP:
        return RELATION_MAP[rel_low]
    return None   # drop unmapped open relations or route to manual review
```

La canonisation représente souvent 60 à 80% des travaux d'ingénierie.

### Étape 5: construire un petit graphique et la requête

```python
triples = extract(text)
graph = {}
for s, r, o in triples:
    graph.setdefault(s, []).append((r, o))


def neighbors(node, relation=None):
    return [(r, o) for r, o in graph.get(node, []) if relation is None or r == relation]


print(neighbors("Tim Cook", relation="P108"))    # -> [(P108, Apple)]
```

C'est l'atome de chaque système RAG-over-KG. Écalage avec des magasins triple RDF (Blazegraph, Virtuoso), des graphes de propriété (Neo4j), ou des magasins de graphes augmentés par vecteur.

## Les pièges

- **Coreference before RE.**"Il a fondé Apple"  RE doit savoir qui "il" est.
- **Entity canonicalization.**"Apple Inc" et "Apple" doivent se résoudre au même nœud.
- **Hallucinated triples.**Les LLM émettent des triplets que le texte ne supporte pas.
- **Relation canonicalization drift.**Les relations d'IE ouvertes sont incohérentes ("est né en", "est né de", "est né de").
- **Temporal errors.**"Tim Cook est le PDG d'Apple"  vrai maintenant, faux en 2005.`P580`l'heure de début, `P582`temps de fin dans Wikidata).
- **Domain mismatch.**Le texte juridique, médical et scientifique nécessite souvent des modèles de référencement finement ajustés.

## Utilisez-le

La pile de 2026:

| Situation | Pick |
|-----------|------|
| Fast production, general domain | REBEL or LlamaPred with Wikidata canonicalization |
| Domain-specific (biomed, legal) | SciREX-style domain fine-tune + custom ontology |
| LLM-prompted, audited output | AEVS pipeline: anchor → extract → verify → supplement |
| High-volume news IE | Pattern-based + supervised hybrid |
| Building a KG from scratch | Open IE + manual canonicalization pass |
| Temporal KG | Extract with qualifiers (start/end time, point in time) |

Le schéma d'intégration: NER → coref → entité liant → extraction de relation → cartographie ontologique → charge graphique. Chaque étape est une porte de qualité potentielle.

## La faire partir

- Je ne sais pas .`outputs/skill-re-designer.md`- Le numéro de la liste:

```markdown
---
name: re-designer
description: Design a relation extraction pipeline with provenance and canonicalization.
version: 1.0.0
phase: 5
lesson: 26
tags: [nlp, relation-extraction, knowledge-graph]
---

Given a corpus (domain, language, volume) and downstream use (KG-RAG, analytics, compliance), output:

1. Extractor. Pattern-based / supervised / LLM / AEVS hybrid. Reason tied to precision vs recall target.
2. Ontology. Closed property list (Wikidata / domain) or open IE with canonicalization pass.
3. Provenance. Every triple carries source char-span + doc id. Non-negotiable for audit.
4. Merge strategy. Canonical entity id + relation id + temporal qualifiers; dedup policy.
5. Evaluation. Precision / recall on 200 hand-labelled triples + hallucination-rate on LLM-extracted sample.

Refuse any LLM-based RE pipeline without span verification (source provenance). Refuse open-IE output flowing into a production graph without canonicalization. Flag pipelines with no temporal qualifier on time-bounded relations (employer, spouse, position).
```

## Exercices

1. **Easy.**Remplissez l' extracteur de motifs `code/main.py`Je suis en train de vérifier la précision.
2. **Medium.**Utilisez REBEL (ou un petit LLM) sur les mêmes phrases. Comparer les triples.
3. **Hard.**Construire le pipeline AEVS: extraire avec LLM + vérifier les intervalles par rapport à la source. Mesurer le taux d'hallucination avant vs après l'étape de vérification sur 50 phrases de style Wikipedia.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Triple | Subject-relation-object | `(s, r, o)` tuple that is the atomic unit of a KG. |
| Open IE | Extract anything | Open-vocabulary relation phrases; high recall, low precision. |
| Closed ontology | Fixed schema | Bounded set of relation types (Wikidata, UMLS, FIBO). |
| Canonicalization | Normalize everything | Map surface names / relations to canonical ids. |
| AEVS | Grounded extraction | Anchor-Extraction-Verification-Supplement pipeline (2026). |
| Provenance | Source-of-truth link | Every triple carries a doc id + char-span to its source. |
| Distant supervision | Cheap labels | Align text with an existing KG to create training data. |

## Pour en savoir plus

- [Mintz et al. (2009). Distant supervision for relation extraction without labeled data](https://www.aclweb.org/anthology/P09-1113.pdf) le document de surveillance à distance.
- [Huguet Cabot, Navigli (2021). REBEL: Relation Extraction By End-to-end Language generation](https://aclanthology.org/2021.findings-emnlp.204.pdf)- Le cheval de travail de la RE.
- [Wadden et al. (2019). Entity, Relation, and Event Extraction with Contextualized Span Representations (DyGIE++)](https://arxiv.org/abs/1909.03546) IE commun.
- [AEVS — Anchor-Extraction-Verification-Supplement framework](https://www.mdpi.com/2073-431X/15/3/178) 2026 conception de l'atténuation des hallucinations.
- [Wikidata SPARQL tutorial](https://www.wikidata.org/wiki/Wikidata:SPARQL_tutorial) requêtes de graphes canoniques.
