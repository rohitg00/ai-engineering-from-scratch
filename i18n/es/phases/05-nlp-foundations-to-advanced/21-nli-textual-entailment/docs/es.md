# Inferencia del lenguaje natural  Entraenimiento textual

> "t implica h" significa que una lectura humana t concluiría que h es verdad. NLI es la tarea de predecir implicación / contradicción / neutral.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 05 (Sentiment Analysis), Phase 5 · 13 (Question Answering)
**Time:** ~60 minutes

## El problema

¿Cómo sabes que el resumen no contiene alucinaciones?

Construiste un chatbot, y respondió "sí". ¿Cómo sabes que la respuesta está respaldada por el pasaje recuperado?

Necesitas clasificar 10.000 artículos de noticias por tema. No tienes etiquetas de entrenamiento. ¿Puedes reutilizar un modelo?

Los tres problemas se reducen a la inferencia del lenguaje natural.`t`y una hipótesis.`h`, es `h`por lo que se`t`¿Contradice o neutral (no relacionado)?

- **Hallucination check:** `t`= documento fuente, `h`No implicación = alucinación.
- **Grounded QA:** `t`= pasaje recuperado, `h`No implicación = fabricación.
- **Zero-shot classification:** `t`= documento, `h`En el caso de los deportes, el nombre de los participantes es el de los participantes.

Una tarea, tres usos de producción. Por eso cada marco de evaluación RAG envía un modelo NLI bajo el capó.

## El concepto

![NLI: three-way classification, premise vs hypothesis](../assets/nli.svg)

**The three labels.**

- **Entailment.** `t`¿ Qué es esto ?`h`"El gato está en la alfombra" implica "Hay un gato".
- **Contradiction.** `t`¿ Qué es esto ?`h`"El gato está en la alfombra" contradice a "No hay gato".
- **Neutral.**No hay ninguna inferencia de ninguna manera. "El gato está en la alfombra" es neutral a "El gato tiene hambre".

**Not logical entailment.**NLI es una inferencia de lenguaje natural que un lector humano típico inferiría, no una lógica estricta. "John caminó con su perro" implica "John tiene un perro" en NLI, pero la lógica estricta de primer orden sólo lo admitiría si se axioma la posesión.

**Datasets.**

- **SNLI**(2015). 570 mil pares anotados por humanos, capciones de imágenes como premisas. Dominio estrecho.
- **MultiNLI**El corpus de formación estándar en 2026.
- **ANLI**(2019). NLI adversario. Los humanos escribieron ejemplos diseñados específicamente para romper los modelos existentes.
- **DocNLI, ConTRoL**(202021). Premisas de longitud de documento. Pruebas de inferencia de múltiples saltos y de largo alcance.

**The architecture.**Un codificador de transformador (BERT, RoBERTa, DeBERTa) lee `[CLS] premise [SEP] hypothesis [SEP]`- El .`[CLS]`El tren en MNLI, evaluar en benchmarks retenidos, obtener 90% + de precisión en pares de distribución.

**Zero-shot via NLI.**Dado un documento y las etiquetas candidatos, convierta cada etiqueta en una hipótesis ("Este texto es sobre deportes").`zero-shot-classification`- ¿Qué pasa?

```figure
nli-router
```

## Construye el mismo

### Paso 1: ejecutar un modelo de NLI pre-entrenado

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

Para las NLI de producción, `facebook/bart-large-mnli`y `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli`DeBERTa-v3 está en las listas de clasificación.

### Paso 2: Clasificación de disparos cero

```python
zs = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

text = "The stock market rallied after the central bank cut interest rates."
labels = ["finance", "sports", "politics", "technology"]

result = zs(text, candidate_labels=labels)
print(result)
# {'labels': ['finance', 'politics', 'technology', 'sports'],
#  'scores': [0.92, 0.05, 0.02, 0.01]}
```

La plantilla es "Este ejemplo es sobre {etiqueta}." por defecto. Personaliza con `hypothesis_template`No se requieren datos de entrenamiento, no se ajusta a la perfección, funciona de la caja.

### Paso 3: Verificación de fidelidad para RAG

```python
def is_faithful(answer, context, threshold=0.5):
    result = nli({"text": context, "text_pair": answer})[0]
    entail = next(s for s in result if s["label"] == "entailment")
    return entail["score"] > threshold
```

Esta es la base de la fidelidad de RAGAS. Divide la respuesta generada en reclamos atómicos.

### Paso 4: clasificador de NLI laminado a mano (conceptual)

¿ Qué ?`code/main.py`para un juguete solo de un punto de partida: se comparan la premisa y la hipótesis mediante superposición léxica + detección de negación. No es competitivo con los modelos de transformadores  pero muestra la forma de la tarea: dos textos en, etiqueta de tres vías hacia afuera, pérdida = entropía cruzada sobre `{entail, contradict, neutral}`¿ Qué ?

## Las trampas

- **Hypothesis-only shortcuts.**Los modelos pueden predecir la etiqueta a partir de la hipótesis sola en ~60% en SNLI porque "no", "nadie", "nunca" se correlacionan con la contradicción.
- **Lexical overlap heuristic.**La heurística de subsecuencia ("cada subsecuencia está implicada") pasa SNLI pero no pasa HANS/ANLI.
- **Document-length degradation.**Los modelos de NLI de una sola frase caen 20+ F1 en las instalaciones de longitud de documentos.
- **Zero-shot template sensitivity.**"Este ejemplo es sobre {label}" vs "{label}" vs "El tema es {label}" puede cambiar la precisión en 10 puntos.
- **Domain mismatch.**El MNLI se entrena en inglés general. El texto legal, médico y científico necesita modelos NLI específicos de dominio (por ejemplo, SciNLI, MedNLI).

## Usalo

La pila de 2026:

| Use case | Model |
|---------|-------|
| General-purpose NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Fast / edge | `cross-encoder/nli-deberta-v3-base` |
| Zero-shot classification (lightweight) | `facebook/bart-large-mnli` |
| Document-level NLI | `MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli` |
| Multilingual | `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` |
| Hallucination detection in RAG | NLI layer inside RAGAS / DeepEval |

El 2026 meta-patrón: NLI es la cinta adhesiva de la comprensión del texto. Cuando necesites "¿A apoya B?" o "¿A contradice B?"  busque NLI antes de buscar otra llamada de LLM.

## Envío

Salvo como`outputs/skill-nli-picker.md`¿Qué es esto ?

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

## Los ejercicios

1. **Easy.**- ¿ Qué ?`facebook/bart-large-mnli`En el caso de las trampas de "subsecuencia heurística" ("no comí el pastel" vs "comí el pastel") y ver si se rompe.
2. **Medium.**Compare la plantilla de tiro cero `"This text is about {label}"`contra`"The topic is {label}"`y `"{label}"`En 100 titulares de AG News, reportar el swing de precisión.
3. **Hard.**Construir un verificador de fidelidad de RAG: descomposición de las reclamaciones atómicas + NLI por reclamación. Evaluar en 50 respuestas generadas por RAG con contexto oro. Medir las tasas falsas positivas y falsas negativas frente a las etiquetas de mano.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NLI | Natural Language Inference | 3-way classification of premise-hypothesis relationship. |
| RTE | Recognizing Textual Entailment | Older name for NLI; same task. |
| Entailment | "t implies h" | A typical reader would conclude h is true given t. |
| Contradiction | "t rules out h" | A typical reader would conclude h is false given t. |
| Neutral | "undecided" | No inference from t to h either way. |
| Zero-shot classification | NLI as classifier | Verbalize labels as hypotheses, pick max entailment. |
| Faithfulness | Is the answer supported? | NLI over (retrieved context, generated answer). |

## Leer más

- [Bowman et al. (2015). A large annotated corpus for learning natural language inference](https://arxiv.org/abs/1508.05326) SNLI.
- [Williams, Nangia, Bowman (2017). A Broad-Coverage Challenge Corpus for Sentence Understanding through Inference](https://arxiv.org/abs/1704.05426) MultiNLI.
- [Nie et al. (2019). Adversarial NLI](https://arxiv.org/abs/1910.14599) el índice de referencia de la ANLI.
- [Yin, Hay, Roth (2019). Benchmarking Zero-shot Text Classification](https://arxiv.org/abs/1909.00161) NLI-as-clasificador.
- [He et al. (2021). DeBERTa: Decoding-enhanced BERT with Disentangled Attention](https://arxiv.org/abs/2006.03654) el caballo de trabajo de la NLI de 2026.
