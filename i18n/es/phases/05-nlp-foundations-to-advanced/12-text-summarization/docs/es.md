# Resumen del texto

> Los sistemas extractivos te dicen lo que dice el documento, los sistemas abstractos te dicen lo que el autor quería decir, diferentes tareas, diferentes trampas.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 11 (Machine Translation)
**Time:** ~75 minutes

## El problema

Un artículo de noticias de 2.000 palabras se encuentra en su feed. Necesitas 120 palabras que lo capturen. Puedes elegir las tres frases más importantes del artículo (extractiva) o reescribir el contenido en tus propias palabras (abstractiva). Ambos se llaman resumen. Son problemas completamente diferentes.

La resumen extractiva es un problema de clasificación.`k`El resultado es siempre gramatical porque se levanta literalmente.

La resumen abstractiva es un problema de generación. Un transformador produce un nuevo texto condicionado a la entrada. La salida es fluida y compresiva, pero puede alucinar hechos que no estaban en la fuente. El riesgo es la fabricación segura.

Esta lección construye a ambos, con el modo de fracaso que cada uno posee.

## El concepto

![Extractive TextRank vs abstractive transformer](../assets/summarization.svg)

**Extractive.**Trate el artículo como un gráfico donde los nodos son oraciones y los bordes son similitudes. ejecuta PageRank (o algo parecido) sobre el gráfico para marcar oraciones por la conexión que tienen con todo lo demás.**TextRank**(Mihalcea y Tarau, 2004).

**Abstractive.**La combinación de un transformer encoder-decoder (BART, T5, Pegasus) en pares de resumen de documentos.

Evaluación con **ROUGE**(Recall-Oriented Understudy for Gisting Evaluation). ROUGE-1 y ROUGE-2 puntajes unigram y bigram superpone. ROUGE-L puntajes más largo subsecuencia común. Más alto es mejor, pero 40 ROUGE-L es "bueno" y 50 es "excepcional".`rouge-score`el paquete.

```figure
summarize-collapse
```

## Construye el mismo

### Paso 1: TextRank (extractivo)

```python
import math
import re
from collections import Counter


def sentence_split(text):
    return re.split(r"(?<=[.!?])\s+", text.strip())


def similarity(s1, s2):
    w1 = Counter(s1.lower().split())
    w2 = Counter(s2.lower().split())
    intersection = sum((w1 & w2).values())
    denom = math.log(len(w1) + 1) + math.log(len(w2) + 1)
    if denom == 0:
        return 0.0
    return intersection / denom


def textrank(text, top_k=3, damping=0.85, iterations=50, epsilon=1e-4):
    sentences = sentence_split(text)
    n = len(sentences)
    if n <= top_k:
        return sentences

    sim = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                sim[i][j] = similarity(sentences[i], sentences[j])

    scores = [1.0] * n
    for _ in range(iterations):
        new_scores = [1 - damping] * n
        for i in range(n):
            total_out = sum(sim[i]) or 1e-9
            for j in range(n):
                if sim[i][j] > 0:
                    new_scores[j] += damping * sim[i][j] / total_out * scores[i]
        if max(abs(s - ns) for s, ns in zip(scores, new_scores)) < epsilon:
            scores = new_scores
            break
        scores = new_scores

    ranked = sorted(range(n), key=lambda k: scores[k], reverse=True)[:top_k]
    ranked.sort()
    return [sentences[i] for i in ranked]
```

La función de similitud utiliza una superposición de palabras normalizadas de registro, que es la variante original de TextRank.

### Paso 2: abstracto con BART

```python
from transformers import pipeline

summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

article = """(long news article text)"""

summary = summarizer(article, max_length=120, min_length=60, do_sample=False)
print(summary[0]["summary_text"])
```

BART-large-CNN está ajustado al corpus de CNN/DailyMail. Produce resúmenes de estilo de noticias fuera de la caja. Para otros dominios (artículos científicos, diálogo, legal), utilice el correspondiente punto de control Pegasus o ajuste a sus datos objetivo.

### Paso 3: Evaluación ROUGE

```python
from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(reference_summary, generated_summary)
print({k: round(v.fmeasure, 3) for k, v in scores.items()})
```

Sin él, "correr" y "correr" cuentan como palabras diferentes y ROUGE cuentan como subcuentas.

### Más allá de ROUGE (2026 evaluación de resumen)

ROUGE ha sido la métrica de resumen dominante durante veinte años y no es suficiente por sí sola en 2026.

- **BERTScore**(similaridad de inserción contextual) ganó terreno hasta 2023 y ahora se informa junto con ROUGE en la mayoría de los documentos de resumen.
- **BARTScore**El análisis de la evaluación se realiza en función de la probabilidad de que un BART previamente entrenado lo asigne a la fuente.
- **MoverScore**(Distancia de Earth Mover sobre embebidos contextuales) alcanzó el primer lugar en 2025 en los puntos de referencia de resumen porque capta la superposición semántica mejor que ROUGE.
- **FactCC**y **QA-based faithfulness**Las nuevas tecnologías de la información son comunes en 2021-2023, ahora a menudo reemplazadas por **G-Eval**(una cadena de respuesta GPT-4 que califica la coherencia, la consistencia, la fluidez, la relevancia con el razonamiento de la cadena de pensamiento).
- **G-Eval**y enfoques similares de LLM-juzgados coinciden con el juicio humano ~ 80% del tiempo cuando las rúbricas están bien diseñadas.

Recomendación de producción: informe ROUGE-L para comparación de la herencia, BERTScore para superposición semántica, G-Eval para coherencia y factualidad. Calibrado en función de 50-100 resúmenes etiquetados por humanos.

### Paso 4: el problema de la realidad

Los resúmenes abstractos son propensos a la alucinación. Los resúmenes extractivos tienen un riesgo de alucinación mucho menor porque la salida se levanta literalmente de la fuente, aunque aún pueden engañar si las oraciones de la fuente se descontéxtúan, quedan obsoletas o se citan fuera de orden. Esta es la única razón más grande por la que los sistemas de producción todavía prefieren métodos extractivos para el contenido adyacente al cumplimiento.

Tipos de alucinaciones para nombrar:

- **Entity swap.**La fuente dice "John Smith". El resumen dice "John Brown".
- **Number drift.**La fuente dice "25.000". El resumen dice "25 millones".
- **Polarity flip.**La fuente dice "rechazó la oferta". El resumen dice "aceptó la oferta".
- **Fact invention.**La fuente no menciona al CEO.

La evaluación se aproxima a ese trabajo:

- **FactCC.**Un clasificador binario entrenado en la relación entre la frase fuente y la frase resumida. Predece hechos/no hechos.
- **QA-based factuality.**Si el resumen respalda respuestas diferentes, señale.
- **Entity-level F1.**Comparar las entidades nombradas en la fuente con el resumen.

Para cualquier cosa que se enfrente al usuario donde la factualidad importa (noticias, médicos, legales, financieros), la extractiva es el default más seguro.

## Usalo

La pila de 2026:

| Use case | Recommended |
|---------|-------------|
| News, 3-5 sentence summary, English | `facebook/bart-large-cnn` |
| Scientific papers | `google/pegasus-pubmed` or a tuned T5 |
| Multi-document, long-form | Any LLM with 32k+ context, prompted |
| Dialog summarization | `philschmid/bart-large-cnn-samsum` |
| Extractive, low hallucination risk by construction | TextRank or `sumy`'s LSA / LexRank |

Los LLM con contexto largo a menudo superan a los modelos especializados en 2026 cuando la computación no es una limitación.

## Envío

Salvo como`outputs/skill-summary-picker.md`¿Qué es esto ?

```markdown
---
name: summary-picker
description: Pick extractive or abstractive, named library, factuality check.
version: 1.0.0
phase: 5
lesson: 12
tags: [nlp, summarization]
---

Given a task (document type, compliance requirement, length, compute budget), output:

1. Approach. Extractive or abstractive. Explain in one sentence why.
2. Starting model / library. Name it. `sumy.TextRankSummarizer`, `facebook/bart-large-cnn`, `google/pegasus-pubmed`, or an LLM prompt.
3. Evaluation plan. ROUGE-1, ROUGE-2, ROUGE-L (use rouge-score with stemming). Plus factuality check if abstractive.
4. One failure mode to probe. Entity swap is the most common in abstractive news summarization; flag samples where source entities do not appear in summary.

Refuse abstractive summarization for medical, legal, financial, or regulated content without a factuality gate. Flag input over the model's context window as needing chunked map-reduce summarization (not just truncation).
```

## Los ejercicios

1. **Easy.**Ejecutar TextRank en 5 artículos de noticias. Comparar las tres frases principales con un resumen de referencia. Medir ROUGE-L. Usted debe ver 30-45 ROUGE-L en artículos de estilo CNN / DailyMail.
2. **Medium.**Implementar la realidad a nivel de entidad: extraer las entidades nombradas de la fuente y el resumen (spaCy), recordar las entidades fuentes en resumen y recoger con precisión las entidades sumarias en relación con la fuente.
3. **Hard.**Comparar BART-grand-CNN con un LLM (Claude o GPT-4) en 50 artículos de CNN/DailyMail.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Extractive | Pick sentences | Return sentences verbatim from the source. Never hallucinates. |
| Abstractive | Rewrite | Generate new text conditioned on source. Can hallucinate. |
| ROUGE | Summary metric | N-gram / LCS overlap between system output and reference. |
| TextRank | Graph-based extractive | PageRank over sentence similarity graph. |
| Factuality | Is it right | Whether summary claims are supported by the source. |
| Hallucination | Made-up content | Content in the summary that the source does not support. |

## Leer más

- [Mihalcea and Tarau (2004). TextRank: Bringing Order into Texts](https://aclanthology.org/W04-3252/) el papel canónico extractivo.
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training](https://arxiv.org/abs/1910.13461) el papel BART.
- [Zhang et al. (2019). PEGASUS: Pre-training with Extracted Gap-sentences](https://arxiv.org/abs/1912.08777) Pegasus y el objetivo de la frase de la brecha.
- [Lin (2004). ROUGE: A Package for Automatic Evaluation of Summaries](https://aclanthology.org/W04-1013/) papel rojo.
- [Maynez et al. (2020). On Faithfulness and Factuality in Abstractive Summarization](https://arxiv.org/abs/2005.00661) el documento de paisaje de la realidad.
