# Relación extracción y conocimiento gráfico construcción

> NER encontró las entidades. la entidad que une las ancla. la extracción de relaciones encuentra los bordes entre ellos. un gráfico de conocimiento es la suma de nodos, bordes y su procedencia.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 25 (Entity Linking)
**Time:** ~60 minutes

## El problema

Un analista dice: "Tim Cook se convirtió en CEO de Apple en 2011". Cuatro hechos:

- `(Tim Cook, role, CEO)`
- `(Tim Cook, employer, Apple)`
- `(Tim Cook, start_date, 2011)`
- `(Apple, type, Organization)`

Relación Extracción (RE) convierte el texto libre en triples estructurados `(subject, relation, object)`. Agregar a través de un corpus y tienes un gráfico de conocimiento. Agregar y consultar y tienes un sustrato de razonamiento para RAG, análisis o auditorías de cumplimiento.

El problema de 2026: los LLM extraen relaciones con entusiasmo. Demasiado entusiasmo. Alucinan triples que el texto fuente no respalda. Sin procedencia, no se puede distinguir triples reales de ficción plausible. La respuesta de 2026 es en el estilo AEVS de anclaje y verificación de tuberías.

## El concepto

![Text → triples → knowledge graph](../assets/relation-extraction.svg)

**Triple form.** `(subject_entity, relation_type, object_entity)`Las relaciones provienen de una ontología cerrada (propiedades de Wikidata, FIBO, UMLS) o de un conjunto abierto (estilo OpenIE, todo lo que sea).

**Three extraction approaches.**

1. **Rule / pattern-based.**Modelos Hearst: "X como Y" → `(Y, isA, X)`Además de regex hecho a mano, frágil, preciso, explicable.
2. **Supervised classifier.**Dado que dos entidades se mencionan en una oración, predecir la relación desde un conjunto fijo.
3. **Generative LLM.**Pida al modelo que emita triples, funciona fuera de la caja, necesita procedencia o alucina basura que parece plausible.

**AEVS (Anchor-Extraction-Verification-Supplement, 2026).**El actual marco de hallucinación- mitigación:

- **Anchor.**Identifique cada espacio de la entidad y el espacio de la frase de relación con posiciones exactas.
- **Extract.**Generar triples conectados a las anchas de anclaje.
- **Verify.**Aparezca cada elemento triple con el texto fuente; rechace cualquier cosa que no sea compatible.
- **Supplement.**Un pase de cobertura asegura que no se deje caer el espacio anclado.

Las alucinaciones caen rápidamente, requiere más computación pero es auditable.

**The open-vs-closed tradeoff.**

- **Closed ontology.**Lista de propiedades fijas (por ejemplo, las 11,000+ propiedades de Wikidata). Predecible. Querible. Difícil de inventar.
- **Open IE.**Cualquier frase verbal se convierte en una relación, alta recuerdo, baja precisión, desordenada para la consulta.

Los KGs de producción generalmente se mezclan: abren IE para el descubrimiento, luego canonizan las relaciones en una ontología cerrada antes de fusionarse en el gráfico principal.

```figure
relation-triples
```

## Construye el mismo

### Paso 1: extracción basada en patrones

```python
PATTERNS = [
    (r"(?P<s>[A-Z]\w+) (?:is|was) (?:a|an|the) (?P<o>[A-Z]?\w+)", "isA"),
    (r"(?P<s>[A-Z]\w+) (?:is|was) born in (?P<o>\w+)", "bornIn"),
    (r"(?P<s>[A-Z]\w+) works? (?:at|for) (?P<o>[A-Z]\w+)", "worksAt"),
    (r"(?P<s>[A-Z]\w+) founded (?P<o>[A-Z]\w+)", "founded"),
]
```

¿ Qué ?`code/main.py`Los patrones de Hearst todavía se envían en líneas de tubería específicas de dominio porque son depurables.

### Paso 2: extracción de relaciones seguidas supervisadas

```python
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

tok = AutoTokenizer.from_pretrained("Babelscape/rebel-large")
model = AutoModelForSeq2SeqLM.from_pretrained("Babelscape/rebel-large")

text = "Tim Cook was born in Alabama. He later became CEO of Apple."
encoded = tok(text, return_tensors="pt", truncation=True)
output = model.generate(**encoded, max_length=200)
decoded = tok.batch_decode(output, skip_special_tokens=False)
```

REBEL es un extractor de relaciones seq2seq basado en BART: genera triples en lugar de clasificar pares de entidades.`<triplet>`¿ Qué ?`<subj>`y `<obj>`los marcadores, así que dividirlos (como hace el parser de la tarjeta modelo) para obtener `(subject, relation, object)`Registros, ajustados a datos de supervisión remota, base de peso abierto estándar.

### Paso 3: Extracción con LLM con anclaje

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

Verifique cada intervalo devuelto contra la fuente.`text[start:end] != triple_entity`Este es el paso de "verificación" de AEVS en su forma mínima.

### Paso 4: canonizarse en una ontología cerrada

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

La canonización es a menudo del 60-80% del trabajo de ingeniería.

### Paso 5: crear un pequeño gráfico y consulta

```python
triples = extract(text)
graph = {}
for s, r, o in triples:
    graph.setdefault(s, []).append((r, o))


def neighbors(node, relation=None):
    return [(r, o) for r, o in graph.get(node, []) if relation is None or r == relation]


print(neighbors("Tim Cook", relation="P108"))    # -> [(P108, Apple)]
```

Este es el átomo de cada sistema RAG-over-KG. Escalalo con almacenes triples RDF (Blazegraph, Virtuoso), gráficos de propiedades (Neo4j), o almacenes de gráficos aumentados por vectores.

## Las trampas

- **Coreference before RE.**"Él fundó Apple"  RE necesita saber quién es "él".
- **Entity canonicalization.**"Apple Inc" y "Apple" deben resolverse en el mismo nodo.
- **Hallucinated triples.**Los LLM emiten triples que el texto no respalda.
- **Relation canonicalization drift.**Las relaciones de IE abiertas son inconsistentes ("nació en", "provino de", "es nativo de").
- **Temporal errors.**"Tim Cook es CEO de Apple"  verdad ahora, falso en 2005. Muchas relaciones están limitadas en el tiempo.`P580`hora de inicio,`P582`tiempo de finalización en Wikidata).
- **Domain mismatch.**El texto legal, médico y científico a menudo necesita modelos de RE ajustados a los dominios.

## Usalo

La pila de 2026:

| Situation | Pick |
|-----------|------|
| Fast production, general domain | REBEL or LlamaPred with Wikidata canonicalization |
| Domain-specific (biomed, legal) | SciREX-style domain fine-tune + custom ontology |
| LLM-prompted, audited output | AEVS pipeline: anchor → extract → verify → supplement |
| High-volume news IE | Pattern-based + supervised hybrid |
| Building a KG from scratch | Open IE + manual canonicalization pass |
| Temporal KG | Extract with qualifiers (start/end time, point in time) |

El patrón de integración: NER → coref → entidad que une → extracción de relaciones → cartografía ontológica → carga gráfica. Cada etapa es una puerta de calidad potencial.

## Envío

Salvo como`outputs/skill-re-designer.md`¿Qué es esto ?

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

## Los ejercicios

1. **Easy.**Enciende el extractor de patrones .`code/main.py`En 5 frases de artículos de noticias.
2. **Medium.**Utilice REBEL (o un LLM pequeño) en las mismas oraciones. Comparar triples. ¿Cuál extractor tiene mayor precisión?
3. **Hard.**Construir la tubería AEVS: extraer con LLM + verificar las extensiones en relación con la fuente. Medir la tasa de alucinación antes vs después del paso de verificación en 50 frases de estilo Wikipedia.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Triple | Subject-relation-object | `(s, r, o)` tuple that is the atomic unit of a KG. |
| Open IE | Extract anything | Open-vocabulary relation phrases; high recall, low precision. |
| Closed ontology | Fixed schema | Bounded set of relation types (Wikidata, UMLS, FIBO). |
| Canonicalization | Normalize everything | Map surface names / relations to canonical ids. |
| AEVS | Grounded extraction | Anchor-Extraction-Verification-Supplement pipeline (2026). |
| Provenance | Source-of-truth link | Every triple carries a doc id + char-span to its source. |
| Distant supervision | Cheap labels | Align text with an existing KG to create training data. |

## Leer más

- [Mintz et al. (2009). Distant supervision for relation extraction without labeled data](https://www.aclweb.org/anthology/P09-1113.pdf) el papel de supervisión remota.
- [Huguet Cabot, Navigli (2021). REBEL: Relation Extraction By End-to-end Language generation](https://aclanthology.org/2021.findings-emnlp.204.pdf) Seq2seq RE caballo de trabajo.
- [Wadden et al. (2019). Entity, Relation, and Event Extraction with Contextualized Span Representations (DyGIE++)](https://arxiv.org/abs/1909.03546) IE común.
- [AEVS — Anchor-Extraction-Verification-Supplement framework](https://www.mdpi.com/2073-431X/15/3/178) Diseño para la mitigación de alucinaciones para 2026.
- [Wikidata SPARQL tutorial](https://www.wikidata.org/wiki/Wikidata:SPARQL_tutorial) consultas de gráficos canónicos.
