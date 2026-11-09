# Evaluación del LLM  RAGAS, DeepEval, G-Eval

> La comparación exacta y la F1 no tienen equivalencia semántica. La revisión humana no escala. LLM-as-judge es la respuesta de producción  con suficiente calibración para confiar en el número.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 13 (Question Answering), Phase 5 · 14 (Information Retrieval)
**Time:** ~75 minutes

## El problema

Su sistema RAG responde: "29 de junio de 2007".
La referencia de oro es: "29 de junio de 2007".
Exact Match tiene un puntaje de 0. F1 tiene un puntaje de ~75%.

Ahora multiplica por 10.000 casos de prueba. Multiplica de nuevo por cada cambio en el retriever, en el chunking, en el prompt o en el modelo. Necesitas un evaluador que entienda el significado, que funcione a bajo costo en la escala, que no miente sobre regresiones y que aparezca los modos de falla correctos.

2026 tiene tres marcos que poseen este problema.

- **RAGAS.**Recuperación-evaluación de la generación aumentada. Cuatro métricas RAG (filialidad, relevancia de las respuestas, precisión de contexto, recuerdo de contexto) con retrocesos de jueces de NLI + LLM. Respaldado por la investigación, ligero.
- **DeepEval.**PYTEST para LLM. G-Eval, finalización de tareas, alucinación, métricas de sesgo. CI/CD nativo.
- **G-Eval.**Un método (y una métrica DeepEval): LLM como juez con cadena de pensamiento, criterios personalizados, puntaje 0-1.

Esta lección construye la intuición para el método y la capa de confianza que lo rodea.

## El concepto

![Four evaluation dimensions, LLM-as-judge architecture](../assets/llm-evaluation.svg)

**LLM-as-judge.**Reemplazar una métrica estática con una LLM que califica los resultados dados por una rúbrica.`(query, context, answer)`, pedirle a un juez LLM: "Cota 0-1 en fidelidad".

Por qué funciona: los LLM se acercan al juicio humano a una pequeña fracción del costo.$0.003 per scored case enables 1000-sample regression eval runs for under $5. El mismo.

Por qué falla en silencio:

1. **Judge bias.**Los jueces prefieren respuestas más largas, respuestas de su propia familia modelo, respuestas que coincidan con el estilo de la rapidez.
2. **JSON parsing failures.**Mala puntuación JSON → NaN → silenciosamente excluido del agregado. Los usuarios de RAGAS conocen este dolor. Puerta con modo de prueba/excepto + falla explícita.
3. **Drift over model versions.**La actualización del juez cambia cada métrica.

**The RAG four.**

| Metric | Question | Backend |
|--------|----------|---------|
| Faithfulness | Does each claim in the answer come from the retrieved context? | NLI-based entailment |
| Answer relevance | Does the answer address the question? | Generate hypothetical questions from answer; compare to real question |
| Context precision | Of retrieved chunks, what fraction were relevant? | LLM-judge |
| Context recall | Did retrieval return everything needed? | LLM-judge against gold answer |

**G-Eval.**Definir un criterio personalizado: "¿La respuesta cita la fuente correcta?" El marco se expande automáticamente en pasos de evaluación de cadena de pensamiento, luego obtiene una puntuación de 0-1.

**Calibration.**Nunca confíe en la puntuación del juez hasta que tenga una correlación con las etiquetas humanas. ejecuta 100 ejemplos etiquetados a mano. juez de trama vs humano. Computa rho de Spearman. Si rho < 0,7, su rubrica juez necesita trabajo.

```figure
n5-judge-gauge
```

## Construye el mismo

### Paso 1: fidelidad con NLI (estilo RAGAS)

```python
from typing import Callable
from transformers import pipeline

nli = pipeline("text-classification",
               model="MoritzLaurer/DeBERTa-v3-large-mnli-fever-anli-ling-wanli",
               top_k=None)

# `llm` is any callable: prompt str -> generated str.
# Example: llm = lambda p: client.messages.create(model="claude-haiku-4-5", ...).content[0].text
LLM = Callable[[str], str]


def atomic_claims(answer: str, llm: LLM) -> list[str]:
    prompt = f"""Break this answer into simple factual claims (one per line):
{answer}
"""
    return llm(prompt).splitlines()


def faithfulness(answer: str, context: str, llm: LLM) -> float:
    claims = atomic_claims(answer, llm)
    if not claims:
        return 0.0
    supported = 0
    for claim in claims:
        result = nli({"text": context, "text_pair": claim})[0]
        entail = next((s for s in result if s["label"] == "entailment"), None)
        if entail and entail["score"] > 0.5:
            supported += 1
    return supported / len(claims)
```

Descompone la respuesta en afirmaciones atómicas. NLI comprobar cada afirmación en relación con el contexto recuperado. fidelidad = fracción soportada.

### Paso 2: relevancia de la respuesta

```python
import numpy as np
from sentence_transformers import SentenceTransformer

# encoder: any model implementing .encode(texts, normalize_embeddings=True) -> ndarray
# e.g., encoder = SentenceTransformer("BAAI/bge-small-en-v1.5")

def answer_relevance(question: str, answer: str, encoder, llm: LLM, n: int = 3) -> float:
    prompt = f"Write {n} questions this answer could be the answer to:\n{answer}"
    generated = [line for line in llm(prompt).splitlines() if line.strip()][:n]
    if not generated:
        return 0.0
    q_emb = np.asarray(encoder.encode([question], normalize_embeddings=True)[0])
    g_embs = np.asarray(encoder.encode(generated, normalize_embeddings=True))
    sims = [float(q_emb @ g_emb) for g_emb in g_embs]
    return sum(sims) / len(sims)
```

Si la respuesta implica preguntas diferentes a las que se le hicieron, la relevancia disminuye.

### Paso 3: Metrica personalizada de G-Eval

```python
from deepeval.metrics import GEval
from deepeval.test_case import LLMTestCaseParams, LLMTestCase

metric = GEval(
    name="Correctness",
    criteria="The answer should be factually accurate and match the expected output.",
    evaluation_steps=[
        "Read the expected output.",
        "Read the actual output.",
        "List factual claims in the actual output.",
        "For each claim, mark supported or unsupported by the expected output.",
        "Return score = fraction supported.",
    ],
    evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT, LLMTestCaseParams.EXPECTED_OUTPUT],
)

test = LLMTestCase(input="When was the first iPhone released?",
                   actual_output="June 29th, 2007.",
                   expected_output="June 29, 2007.")
metric.measure(test)
print(metric.score, metric.reason)
```

Los pasos de evaluación son la rúbrica. los pasos explícitos son más estables que las instrucciones implícitas de "puntuación 0-1".

### Paso 4: Puerta de información

```python
import deepeval
from deepeval.metrics import FaithfulnessMetric, ContextualRelevancyMetric


def test_rag_system():
    cases = load_regression_cases()
    faith = FaithfulnessMetric(threshold=0.85)
    rel = ContextualRelevancyMetric(threshold=0.7)
    for case in cases:
        faith.measure(case)
        assert faith.score >= 0.85, f"faithfulness regression on {case.id}"
        rel.measure(case)
        assert rel.score >= 0.7, f"relevancy regression on {case.id}"
```

Envía como un archivo pytest, ejecuta todas las relaciones públicas, el bloque se fusiona en regresiones.

### Paso 5: Evaluación de juguete desde cero

¿ Qué ?`code/main.py`- Aproximativas de fidelidad (superposición de las afirmaciones de respuesta con el contexto) y relevancia (superposición de los tokens de respuesta con los tokens de pregunta) - no producción.

## Las trampas

- **No calibration.**Un juez con una correlación de 0,3 a las etiquetas humanas es ruido.
- **Self-evaluation.**Usar el mismo LLM para generar y juzgar infla las puntuaciones en un 10-20%.
- **Positional bias in pairwise judging.**Los jueces prefieren la primera opción presentada.
- **Raw aggregate hides failures.**El puntaje medio de 0,85 es un 5% de fallas catastróficas.
- **Golden dataset rot.**Los conjuntos de eval no versionados que se derivan con el tiempo rompen la comparación longitudinal. etiquetar el conjunto de datos con cada cambio.
- **LLM cost.**En escala, el juez decide dominar el costo.

## Usalo

La pila de 2026:

| Use case | Framework |
|---------|-----------|
| RAG quality monitoring | RAGAS (4 metrics) |
| CI/CD regression gates | DeepEval + pytest |
| Custom domain criteria | G-Eval within DeepEval |
| Online live-traffic monitoring | RAGAS with reference-free mode |
| Human-in-the-loop spot checks | LangSmith or Phoenix with annotation UI |
| Red-teaming / safety eval | Promptfoo + DeepEval |

Tipo de pila: RAGAS para monitoreo, DeepEval para CI, G-Eval para nuevas dimensiones.

## Envío

Salvo como`outputs/skill-eval-architect.md`¿Qué es esto ?

```markdown
---
name: eval-architect
description: Design an LLM evaluation plan with calibrated judge and CI gates.
version: 1.0.0
phase: 5
lesson: 27
tags: [nlp, evaluation, rag]
---

Given a use case (RAG / agent / generative task), output:

1. Metrics. Faithfulness / relevance / context-precision / context-recall + any custom G-Eval metrics with criteria.
2. Judge model. Named model + version, rationale for cost vs accuracy.
3. Calibration. Hand-labeled set size, target Spearman rho vs human > 0.7.
4. Dataset versioning. Tag strategy, change log, stratification.
5. CI gate. Thresholds per metric, regression-window logic, bottom-quantile alert.

Refuse to rely on a judge untested against ≥50 human-labeled examples. Refuse self-evaluation (same model generates + judges). Refuse aggregate-only reporting without bottom-10% surfacing. Flag any pipeline where judge upgrade lands without parallel baseline eval.
```

## Los ejercicios

1. **Easy.**Utilice RAGAS en 10 ejemplos de RAG con alucinaciones conocidas.
2. **Medium.**50 calificaciones de calificación son 0-1 para la corrección, puntaje con G-Eval, medida el rollo de Spearman entre juez y humano.
3. **Hard.**Construye una puerta de CI más profunda con DeepEval. Regresar intencionalmente el retriever. Verificar que la puerta falla. Agregar alerta en el cuantilo inferior a través de la verificación del umbral en el 10% más bajo.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| LLM-as-judge | Scoring with an LLM | Prompt a judge model to score outputs 0-1 given a rubric. |
| RAGAS | The RAG metric library | Open-source eval framework with 4 reference-free RAG metrics. |
| Faithfulness | Is the answer grounded? | Fraction of answer claims entailed by retrieved context. |
| Context precision | Were retrieved chunks relevant? | Fraction of top-K chunks that actually mattered. |
| Context recall | Did retrieval find everything? | Fraction of gold-answer claims supported by retrieved chunks. |
| G-Eval | Custom LLM judge | Rubric + chain-of-thought eval steps + 0-1 score. |
| Calibration | Trust but verify | Spearman correlation between judge score and human score. |

## Leer más

- [Es et al. (2023). RAGAS: Automated Evaluation of Retrieval Augmented Generation](https://arxiv.org/abs/2309.15217) el papel RAGAS.
- [Liu et al. (2023). G-Eval: NLG Evaluation using GPT-4 with Better Human Alignment](https://arxiv.org/abs/2303.16634) el papel G-Eval.
- [DeepEval docs](https://deepeval.com/docs/metrics-introduction) la pila de producción abierta.
- [Zheng et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685) sesgos, calibración, límites.
- [MLflow GenAI Scorer](https://mlflow.org/blog/third-party-scorers) un marco unificador que integra RAGAS, DeepEval y Phoenix.
