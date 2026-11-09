# Enlace y desambiguación de la entidad

> NER encontró "Paris". La entidad que vincula decide: París, Francia? Paris Hilton? Paris, Texas? Paris (el príncipe troyano)?

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 24 (Coreference Resolution)
**Time:** ~60 minutes

## El problema

Una frase dice: "Jordan golpeó a la prensa". Tu NER etiqueta "Jordan" como PERSON.

- ¿Michael Jordan (basquetbol)?
- ¿Michael B. Jordan (actor)?
- Michael I. Jordan (profesa de ML de Berkeley  sí, esta confusión es real en los artículos de ML)?
- ¿Jordania (el país)?
- Jordan (nombre hebreo)?

El enlace de entidad (EL) resuelve cada mención a una entrada única en una base de conocimientos: Wikidata, Wikipedia, DBpedia o su dominio KB. Dos subtareas:

1. **Candidate generation.**Dado "Jordan", ¿cuáles entradas KB son plausibles?
2. **Disambiguation.**Dado el contexto, ¿qué candidato es el correcto?

Los dos pasos son aprendizables. Ambos son comparados. La tubería combinada ha sido estable durante una década.

## El concepto

![Entity linking pipeline: mention → candidates → disambiguated entity](../assets/entity-linking.svg)

**Candidate generation.**Dado el formulario de superficie de mención ("Jordania"), busque candidatos en un índice de alias. Los diccionarios de alias de Wikipedia cubren la mayoría de las entidades nombradas: "JFK" → John F. Kennedy, Jacqueline Kennedy, aeropuerto JFK, JFK (película).

**Disambiguation: three approaches.**

1. **Prior + context (Milne & Witten, 2008).** `P(entity | mention) × context-similarity(entity, text)`Funciona bien, rápido, sin entrenamiento.
2. **Embedding-based (ESS / REL / Blink).**Encode mención + contexto. Encode la descripción de cada candidato. Elige max cosino. El estándar 2020-2024.
3. **Generative (GENRE, 2021; LLM-based, 2023+).**Descifrar el nombre canónico de la entidad token por token. Restringido a un trie de nombres de entidades válidas para que la salida sea garantizada como un ID KB válido.

**End-to-end vs pipeline.**Los modelos modernos (ELQ, BLINK, ExtEnD, GENRE) ejecutan NER + generación de candidatos + desambiguación en un solo paso.

### Las dos mediciones

- **Mention recall (candidate gen).**Se menciona la fracción de oro donde aparece la entrada KB correcta en la lista de candidatos.
- **Disambiguation accuracy / F1.**Dados los candidatos correctos, ¿cuántas veces el top 1 es correcto?

Siempre reportar ambas cosas. Un sistema con 99% de desambiguación en el 80% de reclamo de candidatos es un 80% de pipeline.

```figure
gx-entity-linking
```

## Construye el mismo

### Paso 1: crear un índice de alias desde redirecciones de Wikipedia

```python
alias_to_entities = {
    "jordan": ["Q41421 (Michael Jordan)", "Q810 (Jordan, country)", "Q254110 (Michael B. Jordan)"],
    "paris":  ["Q90 (Paris, France)", "Q663094 (Paris, Texas)", "Q55411 (Paris Hilton)"],
    "apple":  ["Q312 (Apple Inc.)", "Q89 (apple, fruit)"],
}
```

Los datos de alias de Wikipedia: ~ 18M (alias, entidad) pares. Descargar desde los vertederos de Wikidata. Almacenar como índice invertido.

### Paso 2: Desambiguación basada en el contexto

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

El Jaccard es un juguete que se sustituye por una similitud cosina en los embeddings (ver `code/main.py`paso 2 para la versión del transformador).

### Paso 3: basado en la incorporación (estilo BLINK)

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

En el tiempo de índice, embebezar cada entidad KB una vez. En el tiempo de consulta, embezar la mención + contexto una vez, punto-producto contra el pool de candidatos, elegir max.

### Paso 4: vinculación de entidades generativas (concepto)

GENRE decodifica el título de Wikipedia de la entidad caracter por caracter. La decodificación restringida (ver lección 20) asegura que solo se pueden emitir títulos válidos.

```python
prompt = f"""Text: {text}
Mention: {mention}
List the best Wikipedia title for this mention.
Respond with JSON: {{"title": "..."}}"""
```

Combinado con una lista blanca (Síntese `choice`), es el oleoducto de energía eléctrica más simple para el 2026.

### Paso 5: evaluar el AIDA-CoNLL

AIDA-CoNLL es el indicador de referencia estándar de la UE: 1.393 artículos de Reuters, 34 mil menciones, entidades de Wikipedia.`P@1`) y la tasa de detección de NIL fuera de KB.

## Las trampas

- **NIL handling.**Algunas menciones no están en el KB (entidades emergentes, personas oscuras). Los sistemas deben predecir NIL en lugar de adivinar la entidad equivocada. Medido por separado.
- **Mention boundary errors.**El NER upstream pierde períodos parciales ("Bank of America" etiquetado como "Bank"). EL recall cae.
- **Popularity bias.**Los sistemas entrenados predican demasiado a las entidades frecuentes.
- **Cross-lingual EL.**Mapear menciones en texto chino a las entidades de Wikipedia en inglés. Requiere un codificador multilingüe o un paso de traducción.
- **KB staleness.**Las nuevas empresas, los eventos, las personas no están en el vertedero de Wikipedia del año pasado.

## Usalo

La pila de 2026:

| Situation | Pick |
|-----------|------|
| General-purpose English + Wikipedia | BLINK or REL |
| Cross-lingual, KB = Wikipedia | mGENRE |
| LLM-friendly, few mentions/day | Prompt Claude/GPT-4 with candidate list + constrained JSON |
| Domain-specific KB (medical, legal) | Custom BERT with KB-aware retrieval + fine-tune on domain AIDA-style set |
| Extremely low-latency | Exact-match prior only (Milne-Witten baseline) |
| Research SOTA | GENRE / ExtEnD / generative LLM-EL |

Patrón de producción que se envía en 2026: NER → coref → EL en cada mención → clusters de colapso a una entidad canónica por cluster.

## Envío

Salvo como`outputs/skill-entity-linker.md`¿Qué es esto ?

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

## Los ejercicios

1. **Easy.**Implementar el desambiguación de prior+contexto en `code/main.py`En el caso de las empresas de la Unión Europea, el valor de la ayuda es el valor de la ayuda financiera concedida por el Estado miembro a la empresa.
2. **Medium.**Encode 50 menciones ambiguas con un transformador de oraciones. Incorpore la descripción de cada candidato. Compara la desambiguación basada en la incorporación con la superposición del contexto de Jaccard.
3. **Hard.**Construir un dominio de 1k de entidades KB (por ejemplo, empleados + productos en su empresa). Implementar NER + EL de extremo a extremo. Medir la precisión y recordar en 100 oraciones prolongadas.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Entity linking (EL) | Link to Wikipedia | Map a mention to a unique KB entry. |
| Candidate generation | Who could it be? | Return a shortlist of plausible KB entries for a mention. |
| Disambiguation | Pick the right one | Score candidates using context, pick the winner. |
| Alias index | The lookup table | Map from surface form → candidate entities. |
| NIL | Not in KB | Explicit prediction that no KB entry matches. |
| KB | Knowledge base | Wikidata, Wikipedia, DBpedia, or your domain KB. |
| AIDA-CoNLL | The benchmark | 1,393 Reuters articles with gold entity links. |

## Leer más

- [Milne, Witten (2008). Learning to Link with Wikipedia](https://researchcommons.waikato.ac.nz/entities/publication/b9a0b520-abc5-47c5-a86a-da6c579893ab) el enfoque fundamental de prioridad+contexto.
- [Wu et al. (2020). Zero-shot Entity Linking with Dense Entity Retrieval (BLINK)](https://arxiv.org/abs/1911.03814) el caballo de trabajo basado en el embebimiento.
- [De Cao et al. (2021). Autoregressive Entity Retrieval (GENRE)](https://arxiv.org/abs/2010.00904) EL generativo con decodificación restringida.
- [Hoffart et al. (2011). Robust Disambiguation of Named Entities in Text (AIDA)](https://www.aclweb.org/anthology/D11-1072.pdf) el documento de referencia.
- [REL: An Entity Linker Standing on the Shoulders of Giants (2020)](https://arxiv.org/abs/2006.01969) la pila de producción abierta.
