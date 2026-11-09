# Sistemas de respuesta a preguntas

> Tres sistemas formaron la inteligencia artificial moderna. Extractiva encontró extensiones. Recuperar aumentó la tierra en documentos. Generativo produjo respuestas. Cada asistente de IA moderno es una mezcla de los tres.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 11 (Machine Translation), Phase 5 · 10 (Attention Mechanism)
**Time:** ~75 minutes

## El problema

Un usuario escribe "¿Cuándo lanzó el primer iPhone?" y espera "29 de junio de 2007". No "La historia de Apple es larga y variada". No "2007" sentado aislado sin oración. Una respuesta directa, basada y correcta.

Tres arquitecturas han dominado la QA en la última década.

- **Extractive QA.**Dado una pregunta y un pasaje que se sabe que contiene la respuesta, encontrar los índices de inicio y final del intervalo de respuesta en el pasaje.
- **Open-domain QA.**El pasaje no se da. Recupera el pasaje relevante primero, luego extrae o genera una respuesta. Esta es la base de cada oleoducto RAG hoy en día.
- **Generative / Closed-book QA.**Un modelo de lenguaje grande responde desde su memoria parámétrica, sin recuperación, más rápido en la inferencia, menos confiable en los hechos.

La tendencia en 2026 es híbrida: recuperar los mejores pasajes, luego pedir un modelo generativo para responder en esos pasajes. Eso es RAG, y la lección 14 cubre la mitad de la recuperación en profundidad. Esta lección construye la mitad de la QA.

## El concepto

![QA architectures: extractive, retrieval-augmented, generative](../assets/qa.svg)

**Extractive.**Encode la pregunta y el pasaje junto con un transformador (familia BERT). Entrenar dos cabezas que predicen los índices de inicio y final de los tokens de la respuesta. La pérdida es entropía cruzada sobre posiciones válidas. La salida es un espacio de tiempo del pasaje. Nunca alucina (por construcción), nunca maneja preguntas que el pasaje no puede responder (por construcción).

**Retrieval-augmented (RAG).**Dos etapas. Primero, un retriever encuentra la parte superior...`k`En segundo lugar, un lector (extractivo o generativo) produce la respuesta utilizando esos pasajes. La división retriever-lector permite que cada uno sea entrenado y evaluado de forma independiente.

**Generative.**Un LLM solo para decodificadores (GPT, Claude, Llama) responde a partir de pesas aprendidas. No hay paso de recuperación. Excelente en el conocimiento común, catastrófico en hechos raros o recientes. La tasa de alucinación está inversamente correlacionada con la frecuencia de hechos en los datos de preparación.

```figure
qa-span
```

## Construye el mismo

### Paso 1: A.Q. extractiva con un modelo pre-entrenado

```python
from transformers import pipeline

qa = pipeline("question-answering", model="deepset/roberta-base-squad2")

passage = (
    "Apple Inc. released the first iPhone on June 29, 2007. "
    "The device was announced by Steve Jobs at Macworld in January 2007."
)
question = "When was the first iPhone released?"

answer = qa(question=question, context=passage)
print(answer)
```

```python
{'score': 0.98, 'start': 57, 'end': 70, 'answer': 'June 29, 2007'}
```

`deepset/roberta-base-squad2`El programa de formación de la Comisión de Educación y Ciencias de la Humanidad (SquAD 2.0) incluye preguntas sin respuesta.`question-answering`pipeline devuelve el lapso de puntaje más alto incluso cuando el puntaje nulo del modelo gana  no * no * automáticamente devuelve una respuesta vacía. Para obtener el comportamiento explícito "no respuesta", pasa `handle_impossible_answer=True`a la llamada de la línea de tubería: la línea de tubería devuelve una respuesta vacía sólo cuando el puntaje nulo excede cada puntaje de la línea de espera.`score`campo de cualquier manera.

### Paso 2: una tubería aumentada para la recuperación (bozo)

```python
from sentence_transformers import SentenceTransformer
import numpy as np

encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

corpus = [
    "Apple Inc. released the first iPhone on June 29, 2007.",
    "Macworld 2007 featured the iPhone announcement by Steve Jobs.",
    "Android launched in 2008 as Google's mobile operating system.",
    "The first iPod was released in 2001.",
]
corpus_embeddings = encoder.encode(corpus, normalize_embeddings=True)


def retrieve(question, top_k=2):
    q_emb = encoder.encode([question], normalize_embeddings=True)
    sims = (corpus_embeddings @ q_emb.T).squeeze()
    order = np.argsort(-sims)[:top_k]
    return [corpus[i] for i in order]


def answer(question):
    passages = retrieve(question, top_k=2)
    combined = " ".join(passages)
    return qa(question=question, context=combined)


print(answer("When was the first iPhone released?"))
```

El sistema de recopilación densa (Sentence-BERT) encuentra pasajes relevantes por similitud semántica. El lector extractivo (RoBERTa-SQuAD) extrae el intervalo de respuesta de los pasajes superiores combinados. Trabaja en corporales pequeños. Para un corpus de un millón de documentos, utilice FAISS o una base de datos vectorial.

### Paso 3: generativo con RAG

```python
def rag_generate(question, llm):
    passages = retrieve(question, top_k=3)
    prompt = f"""Context:
{chr(10).join('- ' + p for p in passages)}

Question: {question}

Answer using only the context above. If the context does not contain the answer, say "I don't know."
"""
    return llm(prompt)
```

El patrón de prompt importa. Decir explícitamente al modelo que se encuentre en el contexto y regresar "no sé" cuando el contexto es insuficiente reduce las tasas de alucinación en un 40-60% en comparación con el prompting ingenuo.

### Paso 4: evaluación que refleje el mundo real

Uso de la SQuAD **Exact Match (EM)**y **token-level F1**¿ Qué ? EM es una coincidencia estricta después de la normalización (carácter menor, puntuación de la tira, eliminación de artículos)  o bien la predicción coincide exactamente o obtiene un puntaje de 0. F1 se calcula sobre la superposición de tokens entre predicción y referencia y da crédito parcial. Ambas parafrazas de bajo crédito: "29 de junio de 2007" vs "29 de junio de 2007" generalmente obtiene 0 EM (la normalización de los descansos ordinarios) pero aún gana una F1 sustancial de tokens superpuestos.

Para la producción de QA:

- **Answer accuracy**(Judicado por la LLM o por el hombre, ya que las métricas no capturan equivalencia semántica).
- **Citation accuracy.**¿El pasaje citado realmente respalda la respuesta?
- **Refusal calibration.**Cuando la respuesta no está en los pasajes recuperados, ¿dice correctamente el sistema "No sé"?
- **Retrieval recall.**Antes de evaluar al lector, mide si el retriever obtiene el pasaje correcto en la parte superior...`k`Un lector no puede arreglar un pasaje perdido.

### RAGAS: el marco de evaluación de la producción de 2026

`RAGAS`Es especialmente diseñado para sistemas RAG y es el envío por defecto en 2026.

- **Faithfulness.**¿Todas las afirmaciones en la respuesta provienen del contexto recuperado? Medido por la implicación basada en NLI.
- **Answer relevance.**Se mide generando preguntas hipotéticas de la respuesta y comparando con la pregunta real.
- **Context precision.**De los trozos recuperados, ¿cuál fracción era realmente relevante?
- **Context recall.**¿El conjunto recuperado contiene toda la información necesaria?

La puntuación sin referencias le permite evaluar el tráfico en directo sin respuestas de oro seleccionadas.

`pip install ragas`Conecta tu retriever + lector, consigue cuatro escalares por consulta, alerta de regresión.

## Usalo

La pila de 2026.

| Use case | Recommended |
|---------|-------------|
| Given passage, find answer span | `deepset/roberta-base-squad2` |
| Over a fixed corpus, closed-book not acceptable | RAG: dense retriever + LLM reader |
| Real-time over a document store | RAG with hybrid (BM25 + dense) retriever + reranker (lesson 14) |
| Conversational QA (follow-up questions) | LLM with conversation history + RAG on each turn |
| Highly factual, regulated domains | Extractive over an authoritative corpus; never generative alone |

La AQ extractiva es de moda en 2026 porque RAG con LLM maneja más casos.

## Envío

Salvo como`outputs/skill-qa-architect.md`¿Qué es esto ?

```markdown
---
name: qa-architect
description: Choose QA architecture, retrieval strategy, and evaluation plan.
version: 1.0.0
phase: 5
lesson: 13
tags: [nlp, qa, rag]
---

Given requirements (corpus size, question type, factuality constraint, latency budget), output:

1. Architecture. Extractive, RAG with extractive reader, RAG with generative reader, or closed-book LLM. One-sentence reason.
2. Retriever. None, BM25, dense (name the encoder), or hybrid.
3. Reader. SQuAD-tuned model, LLM by name, or "domain-fine-tuned DistilBERT."
4. Evaluation. EM + F1 for extractive benchmarks; answer accuracy + citation accuracy + refusal calibration for production. Name what you are measuring and how you are measuring it.

Refuse closed-book LLM answers for regulatory or compliance-sensitive questions. Refuse any QA system without a retrieval-recall baseline (you cannot evaluate the reader without knowing the retriever surfaced the right passage). Flag questions that require multi-hop reasoning as needing specialized multi-hop retrievers like HotpotQA-trained systems.
```

## Los ejercicios

1. **Easy.**Configure la línea extractiva SQuAD arriba en 10 pasajes de Wikipedia. 10 preguntas artesanales. Medir la frecuencia con la que la respuesta es correcta. Usted debe ver 7-9 correctas si los pasajes y las preguntas son limpios.
2. **Medium.**Añadir un clasificador de rechazo. Cuando el puntaje de recuperación superior está por debajo de un umbral (digamos 0,3 cosinos), devuelva "no sé" en lugar de llamar al lector.
3. **Hard.**Construye un oleoducto RAG sobre un corpus de 10.000 documentos de su elección. Implemente la recuperación híbrida (BM25 + densa) con fusión RRF (ver lección 14).

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Extractive QA | Find the answer span | Predict start and end indices of the answer within a given passage. |
| Open-domain QA | QA over a corpus | No given passage; must retrieve then answer. |
| RAG | Retrieve then generate | Retrieval-augmented generation. Retriever + reader pipeline. |
| SQuAD | Canonical benchmark | Stanford Question Answering Dataset. EM + F1 metrics. |
| Hallucination | Made-up answer | Reader output not supported by retrieved context. |
| Refusal calibration | Know when to shut up | System correctly says "I don't know" when unable to answer. |

## Leer más

- [Rajpurkar et al. (2016). SQuAD: 100,000+ Questions for Machine Comprehension of Text](https://arxiv.org/abs/1606.05250) el documento de referencia.
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) DPR, el retriever canónico denso para QA.
- [Lewis et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401) el periódico que nombró RAG.
- [Gao et al. (2023). Retrieval-Augmented Generation for Large Language Models: A Survey](https://arxiv.org/abs/2312.10997) encuesta exhaustiva del RAG.
