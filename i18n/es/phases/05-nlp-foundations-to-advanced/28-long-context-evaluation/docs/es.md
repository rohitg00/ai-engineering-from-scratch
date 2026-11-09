# Evaluamiento a largo plazo  NIAH, RULER, LongBench, MRCR

> Gemini 3 Pro anuncia 10M tokens de contexto. En 1M tokens, el MRCR de 8 agujas cae a 26.3%. Publicado ≠ utilizable.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 23 (Chunking Strategies)
**Time:** ~60 minutes

## El problema

El modelo tiene un contrato de 200 páginas. El modelo reclama un contexto de 1M de tokens. Pegas el contrato y preguntas: "¿Cuál es la cláusula de terminación?" El modelo responde  pero responde desde la página de portada porque la cláusula de terminación se encuentra en 120k de tokens profundidad, más allá de donde el modelo realmente asiste.

Esta es la brecha de capacidad de contexto de 2026. Las hojas de especificaciones dicen 1M o 10M. La realidad dice que 60-70% de eso es utilizable, y "utilizable" depende de la tarea.

- **Retrieval (single needle in haystack):**casi perfecto hasta el máximo anunciado en los modelos fronterizos.
- **Multi-hop / aggregation:**degradación más allá de ~ 128k en la mayoría de los modelos.
- **Reasoning over dispersed facts:**La primera tarea que falla.

La evaluación de largo contexto mide estos ejes. Esta lección nombra los puntos de referencia, lo que cada uno mide realmente y cómo construir una prueba de aguja personalizada para su dominio.

## El concepto

![NIAH baseline, RULER multi-task, LongBench holistic](../assets/long-context-eval.svg)

**Needle-in-a-Haystack (NIAH, 2023).**Colocar un hecho ("la palabra mágica es piña") en una profundidad controlada en un contexto largo. Pida al modelo que lo recupere.

**RULER (Nvidia, 2024).**13 tipos de tareas en 4 categorías: recuperación (single / multi-key / multi-value), seguimiento multi-hop (tracking variable), agregación (frecuencia de palabras comunes), QA. longitud de contexto configurable (4k a 128k +). Reveles modelos que saturan NIAH pero fallan en multi-hop. En la versión de 2024, solo la mitad de los 17 modelos que afirman contexto 32k + mantuvieron la calidad en 32k.

**LongBench v2 (2024).**503 preguntas de opción múltiple, contextos de palabras 8k-2M, seis categorías de tareas: QA de un solo documento, QA de varios documentos, aprendizaje largo en contexto, diálogo largo, código repo, datos estructurados largos.

**MRCR (Multi-Round Coreference Resolution).**Multi-turn coreference en escala, 8 agujas, 24 agujas, 100 agujas variantes. Expone cuántos hechos un modelo puede malabarismar antes de que la atención se degrada.

**NoLiMa.**"Aguila no léxica". La aguja y la consulta no comparten superposición literal; la recuperación requiere un paso de razonamiento semántico.

**HELMET.**Concatena muchos documentos, hace una pregunta a cualquiera, prueba la atención selectiva.

**BABILong.**Encabe las cadenas de razonamiento de ABI dentro de pajaros irrelevantes.

### ¿Qué informar realmente?

- **Advertised context window.**El número de la hoja de especificaciones.
- **Effective retrieval length.**El NIAH pasa a un cierto umbral (por ejemplo, 90%).
- **Effective reasoning length.**El paso de múltiples saltos o agregaciones en ese umbral.
- **Degradation curve.**Precisión vs longitud del contexto, trazado por tipo de tarea.

Dos números para su hoja de especificaciones: la recuperación efectiva y la razonamiento eficaz.

```figure
gx-niah-decay
```

## Construye el mismo

### Paso 1: una NIAH personalizada para su dominio

¿ Qué ?`code/main.py`El esqueleto:

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

Especialización`depth_ratio`∈ {0, 0.25, 0.5, 0.75, 1.0} × `total_tokens`Traza el mapa de calor, esa es la tarjeta NIAH para tu modelo objetivo.

### Paso 2: una variante con múltiples agujas

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

Las preguntas como "¿Cuáles son las tres palabras mágicas?" requieren recuperar las tres.

### Paso 3: rastreo de variables multi-hop (estilo RULER)

```python
haystack = """X1 = 42. ... (filler) ... X2 = X1 + 10. ... (filler) ... X3 = X2 * 2."""
question = "What is X3?"
```

Los modelos fronterizos a 128k a menudo caen a 50-70% de precisión aquí.

### Paso 4: LongBench v2 en su pila

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

Las puntuaciones agregadas ocultan grandes diferencias en el nivel de tarea.

## Las trampas

- **NIAH-only evaluation.**Pasar NIAH a 1M tokens no dice nada sobre multi-hop.
- **Uniform depth sampling.**Muchas implementaciones sólo prueban profundidad = 0,5. Probabilidad = 0, 0, 25, 0,5, 0,75, 1,0  el efecto "perdida en el medio" es real.
- **Lexical overlap with filler.**Si la aguja comparte palabras clave con el relleno, la recuperación se vuelve trivial.
- **Ignoring latency.**Las instrucciones de 1M toman 30-120 segundos para preemplarse.
- **Vendor-self-reported numbers.**OpenAI, Google, Anthropic publican sus propias puntuaciones. Siempre se vuelven a ejecutar de forma independiente en su caso de uso.

## Usalo

La pila de 2026:

| Situation | Benchmark |
|-----------|-----------|
| Quick sanity check | Custom NIAH at 3 depths × 3 lengths |
| Model selection for production | RULER (13 tasks) at your target length |
| Real-world QA quality | LongBench v2 single-doc-QA subset |
| Multi-hop reasoning | BABILong or custom variable-tracing |
| Conversational / dialogue | MRCR 8-needle at your target length |
| Model upgrade regression | Fixed in-house NIAH + RULER harness, run on every new model |

Regla de oro para la producción: nunca confíe en una ventana de contexto hasta que tenga la tarea de razonamiento NIAH + 1 en la longitud prevista.

## Envío

Salvo como`outputs/skill-long-context-eval.md`¿Qué es esto ?

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

## Los ejercicios

1. **Easy.**Construye un NIAH con 3 profundidades (0.25, 0.5, 0.75) × 3 longitudes (1k, 4k, 16k). ejecuta en cualquier modelo.
2. **Medium.**Añadir una variante de 3 agujas. Medir la recuperación de los 3 en cada longitud. Comparar con la tasa de paso de una sola aguja en la misma longitud.
3. **Hard.**Construir una tarea de rastreo de variables (X1 → X2 → X3, con 3 saltos) incrustada en 64k de relleno. Medir la precisión en 3 modelos fronterizos. Informar la longitud de razonamiento efectiva por modelo.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| NIAH | Needle in haystack | Plant a fact in filler, ask the model to retrieve it. |
| RULER | NIAH on steroids | 13 task types across retrieval / multi-hop / aggregation / QA. |
| Effective context | The real capacity | Length at which accuracy still holds above threshold. |
| Lost in the middle | Depth bias | Models under-attend to content in the middle of long inputs. |
| Multi-needle | Many facts at once | Multiple plants; tests attention juggling, not retrieval alone. |
| MRCR | Multi-round coref | 8, 24, or 100-needle coreference; exposes attention saturation. |
| NoLiMa | Non-lexical needle | Needle and query share no literal tokens; requires reasoning. |

## Leer más

- [Kamradt (2023). Needle in a Haystack analysis](https://github.com/gkamradt/LLMTest_NeedleInAHaystack) el repo original de la NIAH.
- [Hsieh et al. (2024). RULER: What's the Real Context Size of Your Long-Context LMs?](https://arxiv.org/abs/2404.06654) el índice de referencia de tareas múltiples.
- [Bai et al. (2024). LongBench v2](https://arxiv.org/abs/2412.15204) evaluación en el contexto largo del mundo real.
- [Modarressi et al. (2024). NoLiMa: Non-lexical needles](https://arxiv.org/abs/2404.06666) agujas más duras.
- [Kuratov et al. (2024). BABILong](https://arxiv.org/abs/2406.10149) Razonamiento en el pajar.
- [Liu et al. (2024). Lost in the Middle: How Language Models Use Long Contexts](https://arxiv.org/abs/2307.03172) el papel de la profundidad.
