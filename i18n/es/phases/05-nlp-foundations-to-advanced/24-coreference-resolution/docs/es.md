# Resolución de la Comisión

> "Le llamó, no contestó, el médico estaba al almuerzo". Tres referencias a dos personas y nadie es nombrado.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 06 (NER), Phase 5 · 07 (POS & Parsing)
**Time:** ~60 minutes

## El problema

Extraer cada mención de Apple Inc. de un artículo de 300 palabras. fácil cuando el artículo dice "Apple". difícil cuando dice "la compañía", "ellos", "el gigante tecnológico de Cupertino", o "la firma de Jobs". Sin resolver estas menciones a la misma entidad, su tubería de NER pierde 60-80% de las menciones.

La resolución de coreferencia une todas las expresiones que se refieren a la misma entidad del mundo real en un cluster. Es el pegamento entre la PNL de nivel superficial (NER, análisis) y la semántica descendente (IE, QA, resumen, KG).

Por qué importa en 2026:

- Resumen: "El CEO anunció... " vs "Tim Cook anunció... "  El resumen debe nombrar al CEO.
- La respuesta a la pregunta: "¿A quién llamó?" requiere resolver "ella".
- Extracción de información: un gráfico de conocimiento con "PER1 fundó Apple" y "Jobs fundó Apple" como entradas separadas es incorrecto.
- Multi-document IE: la fusión de menciones entre artículos sobre el mismo evento es coreferencia de documentos cruzados.

## El concepto

![Coreference clustering: mentions → entities](../assets/coref.svg)

**The task.**Input: un documento. Output: un agrupamiento de menciones (amplitud) donde cada agrupamiento se refiere a una entidad.

**Mention types.**

- **Named entity.**"Tim Cook"
- **Nominal.**"el CEO", "la compañía"
- **Pronominal.**"él", "ella", "ellos", "el"
- **Appositive.**"Tim Cook, el CEO de Apple,

**Architectures.**

1. **Rule-based (Hobbs, 1978).**Resolución de pronombres basados en árboles sintácticos usando reglas gramaticales. buena línea de base. sorprendentemente difícil de superar en pronombres.
2. **Mention-pair classifier.**Por cada par de menciones .$(m_i, m_j)$El sistema de control de las emisiones de gases de efecto invernadero (CIP) se ha convertido en un sistema de control de gases de efecto invernadero (CIP) con un sistema de control de gases de efecto invernadero (CIP) con un sistema de control de gases de efecto invernadero (CIP) con un sistema de control de gases de efecto invernadero (CIP) con un sistema de control de gases de efecto invernadero (CIP) con un sistema de control de gases de efecto invernadero (CIP) con un sistema de control de gases de efecto invernadero (CIP) con un sistema de control de gases de efecto invernadero (CIP) con un sistema de control de gases de efecto invernadero (CIP) con un sistema de control de efecto invernadero (CIP) con un sistema de control de efecto invernadero (CIP) con un sistema de control de efecto invernadero (CIP) con un sistema de control de efecto invernadero (CIP) con un sistema de control de efecto invernadero (CIP) con un sistema de efecto invernadero (CIP) de la CIP) de 2016.
3. **Mention-ranking.**Para cada mención, clasifique antecedentes de candidatos (incluyendo "sin antecedentes").
4. **Span-based end-to-end (Lee et al., 2017).**Encuentra todos los candidatos hasta un límite de longitud, predice las puntuaciones, predice la probabilidad de antecedentes para cada período, agrupar codiciosamente, el estándar moderno.
5. **Generative (2024+).**Promover un LLM: "Enumera cada pronombre en este texto y su antecedente".

**The evaluation metrics.**Cinco métricas estándar (MUC, B3, CEAF, BLANC, LEA) porque ninguna métrica única captura la calidad de agrupamiento.

**Known hard cases.**

- Descripciones definidas referidas a las entidades introducidas en páginas anteriores.
- Anafora de puente ("las ruedas" → un coche mencionado anteriormente).
- Cero anafora en idiomas como el chino y el japonés.
- Cataphora (pronom antes del referente): "Cuando **she**entró, Mary sonrió".

```figure
coref-links
```

## Construye el mismo

### Paso 1: coreferencia neuronal preentrenada (AllenNLP / spaCy-experimental)

```python
import spacy
nlp = spacy.load("en_coreference_web_trf")   # experimental model
doc = nlp("Apple announced new products. The company said it would ship them soon.")
for cluster in doc._.coref_clusters:
    print(cluster, "->", [m.text for m in cluster])
```

En un documento más largo, se obtiene algo así:
- Cluster 1: [Apple, la compañía, el]
- Grupo 2: [productos nuevos, ellos]

### Paso 2: resolver de pronombres basados en reglas (ensensenación)

¿ Qué ?`code/main.py`para una implementación de un solo nivel de restricción:

1. Menciones de extractos: entidades nombradas (capitalizadas), pronombres (busca directa), descripciones definidas ("la X").
2. Para cada pronombre, mira las menciones anteriores de K y marcalas por:
   - acuerdo de género/número (heurística)
   - reciente (ganas más cercanas)
   - papel sintáctico (objetos preferidos)
3. Enlace el antecedente con más puntuaciones.

No es competitivo con los modelos neuronales, pero muestra el espacio de búsqueda y las decisiones que un modelo de extremo a extremo debe tomar.

### Paso 3: utilizar los LLM para la referencia

```python
prompt = f"""Text: {text}

List every pronoun and noun phrase that refers to a person or company.
Cluster them by what they refer to. Output JSON:
[{{"entity": "Apple", "mentions": ["Apple", "the company", "it"]}}, ...]
"""
```

Dos modos de fracaso para ver. Primero, LLM se fusionan demasiado ("él" y "ella" se refieren a dos personas distintas). segundo, LLM caen silenciosamente menciones en documentos largos.

### Paso 4: evaluación

El script estándar conll-2012 calcula MUC, B3, CEAF-φ4 y informa el promedio. Para una evaluación interna, comience con la precisión de nivel de período y recuerde su conjunto de pruebas anotado, luego añada el enlace de mención F1.

## Las trampas

- **Singleton explosion.**Algunos sistemas informan cada mención como su propio grupo. B3 es indulgente. MUC castiga esto. Siempre compruebe las tres métricas.
- **Pronouns in long context.**El rendimiento cae en 15 F1 en documentos de más de 2.000 tokens.
- **Gender assumptions.**Las reglas de género codificadas en forma dura infringen referentes no binarios, organizaciones, animales.
- **LLM drift on long docs.**Una sola llamada de API no puede mencionar de manera confiable los clusters en más de 50 párrafos. Utilice la ventana deslizante + fusionar.

## Usalo

La pila de 2026:

| Situation | Pick |
|-----------|------|
| English, single document | `en_coreference_web_trf` (spaCy-experimental) or AllenNLP neural coref |
| Multilingual | SpanBERT / XLM-R trained on OntoNotes or Multilingual CoNLL |
| Cross-document event coref | Specialized end-to-end models (2025–26 SOTA) |
| Quick LLM baseline | GPT-4o / Claude with structured-output coref prompt |
| Production dialog systems | Rule-based fallback + neural primary + manual review for critical slots |

El patrón de integración que se lanzará en 2026: ejecutar primero NER, ejecutar coref, fusionar coref clusters en entidades NER.

## Envío

Salvo como`outputs/skill-coref-picker.md`¿Qué es esto ?

```markdown
---
name: coref-picker
description: Pick a coreference approach, evaluation plan, and integration strategy.
version: 1.0.0
phase: 5
lesson: 24
tags: [nlp, coref, information-extraction]
---

Given a use case (single-doc / multi-doc, domain, language), output:

1. Approach. Rule-based / neural span-based / LLM-prompted / hybrid. One-sentence reason.
2. Model. Named checkpoint if neural.
3. Integration. Order of operations: tokenize → NER → coref → downstream task.
4. Evaluation. CoNLL F1 (MUC + B³ + CEAF-φ4 average) on held-out set + manual cluster review on 20 documents.

Refuse LLM-only coref for documents over 2,000 tokens without sliding-window merge. Refuse any pipeline that runs coref without a mention-level precision-recall report. Flag gender-heuristic systems deployed in demographically diverse text.
```

## Los ejercicios

1. **Easy.**Ejecutar el resolver basado en reglas en `code/main.py`En 5 párrafos hechos a mano, se mide la precisión de la referencia-enlace en comparación con la verdad de fondo.
2. **Medium.**Usar un modelo del núcleo neuronal preentrenado en un artículo de noticias. Comparar grupos con su propia anotación manual. ¿Dónde falló?
3. **Hard.**Construir un pipeline de NER mejorado en el núcleo: primero NER, luego fusionarse a través de clusters centrales.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mention | A reference | A span of text that refers to an entity (name, pronoun, noun phrase). |
| Antecedent | What "it" refers to | The earlier mention a later one corefers with. |
| Cluster | The entity's mentions | Set of mentions that all refer to the same real-world entity. |
| Anaphora | Backward reference | Later mention refers to earlier ("he" → "John"). |
| Cataphora | Forward reference | Earlier mention refers to later ("When he arrived, John..."). |
| Bridging | Implicit reference | "I bought a car. The wheels were bad." (wheels of THAT car.) |
| CoNLL F1 | The number on leaderboards | Average of MUC, B³, CEAF-φ4 F1 scores. |

## Leer más

- [Jurafsky & Martin, SLP3 Ch. 26 — Coreference Resolution and Entity Linking](https://web.stanford.edu/~jurafsky/slp3/26.pdf) capítulo del libro de texto canónico.
- [Lee et al. (2017). End-to-end Neural Coreference Resolution](https://arxiv.org/abs/1707.07045) de extremo a extremo basado en el tiempo.
- [Joshi et al. (2020). SpanBERT](https://arxiv.org/abs/1907.10529) Preentrenamiento que mejora el corazón.
- [Pradhan et al. (2012). CoNLL-2012 Shared Task](https://aclanthology.org/W12-4501/) el índice de referencia.
- [Hobbs (1978). Resolving Pronoun References](https://www.sciencedirect.com/science/article/pii/0024384178900064) el clásico basado en reglas.
