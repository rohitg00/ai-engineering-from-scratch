# Capstone 08  Producción RAG Chatbot para una vertical regulada

> Harvey, Glean, Mendable y LlamaCloud todos tienen la misma forma de producción en 2026. Ingesta con docling o Unstructured y ColPali para imágenes. Busca híbrida. Re-ranquear con Bge-Renanque-V2-gemma. Sintetiza con Claude Sonnet 4.7 usando caché rápido a una tasa de visualización del 60-80%. Guardia con la Guardia de Llama 4 y las barandillas de NeMo. Cuidado con Langfuse y Phoenix. Grado con RAGAS en un juego de 200 preguntas doradas. Construye uno en un dominio regulado (legal, clínico, seguro), y la piedra angular está pasando el conjunto dorado, el equipo rojo, y el tablero de deriva.

**Type:** Capstone
**Languages:** Python (pipeline + API), TypeScript (chat UI, pipeline scaffold)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:**P5 · P7 · P11 · P12 · P17 · P18
**Time:** 30 hours

## El problema

El RAG de dominio regulado (contratos legales, protocolos de ensayos clínicos, pólizas de seguros) es la forma de producción más vendida de 2026 porque el ROI es obvio y las apuestas son concretas. Harvey (Allen & Overy) lo construyó para ser legal. Los barcos de valorables tienen el sabor de los desarrolladores. Glean cubre la búsqueda empresarial. El patrón es: ingerir alta fidelidad, recuperar híbrido con rango, sintetizar con la aplicación de citaciones y caching rápido, proteger con múltiples capas de seguridad, y monitorar la deriva continuamente.

Las partes difíciles no son el modelo. Son el cumplimiento de jurisdicciones (HIPAA, GDPR, SOC2), la auditoría a nivel de citación, el control de costes (el almacenamiento en caché rápido compra un descuento del 60-90% cuando la tasa de impacto es alta), la detección de alucinaciones a través de la fidelidad RAGAS y la detección de deriva cuando los documentos de origen se actualizan sin que el índice se ponga al día. Esta piedra angular le pide que lo envíe todo en un conjunto de 200 preguntas de oro con una suite de equipo rojo al lado.

## Concepto

El oleoducto tiene dos lados.**Ingestion**Los bloques obtienen resúmenes, etiquetas y etiquetas de acceso basadas en roles. Los vectores se dividen en pgvector + pgvector scale (menos de 50M vectores) o Qdrant Cloud; BM25 escaso corre junto. **Conversation**LangGraph maneja la memoria y la multi-turn; cada consulta ejecuta la recuperación híbrida, se reubica con bge-reranker-v2-gemma-2b, se sintetiza con Claude Sonnet 4.7 (prontamente almacenado en caché), pasa la salida a través de Llama Guard 4 y NeMo Guardrails, y emite una respuesta anclada en citaciones.

La pila de evaluación tiene cuatro capas. **Golden set**(200 etiquetados con respuestas y respuestas) para obtener la exactitud. **Red team**(infracciones de cárcel, intentos de extracción de PII, preguntas fuera del dominio) para la seguridad. **RAGAS**para la fidelidad / relevancia de la respuesta / precisión de contexto automáticamente por turno. **Drift dashboard**(Arize Phoenix) viendo la calidad de recuperación y la calificación de alucinación semanalmente.

El caché rápido es la palanca de costo. Claude 4.5+ y GPT-5+ soportan las instrucciones de caché del sistema + contexto recuperado. A una tasa de hits del 60-80%, el costo por consulta disminuye 3-5 veces. La tubería debe diseñarse para prefijos estables (programa del sistema + contexto reordenado primero) para lograr altas tasas de hits de caché.

## Arquitectura

```
documents (contracts, protocols, policies)
      |
      v
docling / Unstructured parse + ColPali for visuals
      |
      v
chunks + summaries + role-labels + jurisdiction tags
      |
      v
pgvector + pgvectorscale  +  BM25 (Tantivy)
      |
query + role + jurisdiction
      |
      v
LangGraph conversational agent
   +--- retrieve (hybrid)
   +--- filter by role + jurisdiction
   +--- rerank (bge-reranker-v2-gemma-2b or Voyage rerank-2)
   +--- synthesize (Claude Sonnet 4.7, prompt cached)
   +--- guard (Llama Guard 4 + NeMo Guardrails + Presidio output PII scrub)
   +--- cite + return
      |
      v
eval:
  RAGAS faithfulness / answer_relevance / context_precision (online)
  Langfuse annotation queue (sampled)
  Arize Phoenix drift (weekly)
  red team suite (pre-release)
```

## El establo

- Ingestión: Unstructured.io o docling para documentos estructurados; ColPali para PDFs con contenido visual
- Vektor DB: pgvector + pgvectorscale bajo 50M vectores; Qdrant Cloud de otro modo
- Esparza: Tantivy BM25 con pesos de campo
- Orquestación: Flujos de trabajo LlamaIndex (ingestión) + LangGraph (conversación)
- Re-ranking: bge-re-ranker-v2-gemma-2b auto-hosted o Voyage rerank-2 hosted
- LLM: Claude Sonnet 4.7 con caché rápido; fallback Llama 3.3 70B auto-hosted
- Eval: RAGAS 0.2 en línea, DeepEval para alucinaciones y suites de jailbreak
- Observabilidad: Langfuse auto-hosted con cola de anotaciones; Arize Phoenix para la deriva
- Guardrails: Llama Guard 4 clasificador de entrada/salida, política de NeMo Guardrails v0.12, escubrimiento de Presidio PII
- Cumplimiento: etiquetas de acceso basadas en el papel en los trozos; etiquetas de jurisdicción para el RGPD/HIPAA

```figure
canary-rollout
```

## Construye el mismo

1. **Ingestion.**Para las páginas escaneadas / visuales pesadas, recorre ColPali. Produce trozos con resúmenes, etiquetas de rol, etiquetas de jurisdicción.

2. **Index.**Embedings densos (Voyage-3 o Nomic-embed-v2) en pgvector + pgvector escala. BM25 índice lateral a través de Tantivy.

3. **Hybrid retrieve.**Filtra por función + jurisdicción primero; luego paralelo denso + BM25; fusión con la fusión de rango recíproco; top-20 a re-ranquer; top-5 a sintetizar.

4. **Synthesize with prompt caching.**Promete el sistema + políticas estáticas en la caché; re-ranqueado contexto como extensión de caché; pregunta de usuario como sufijo no caché. Objetivo 60-80% tasa de caché en estado estable.

5. **Guardrails.**Llama Guard 4 en entrada; NeMo Guardrails bloquea preguntas fuera del dominio o temas prohibidos por la política; Presidio elimina la PII accidental en la salida; filtro de aplicación de citaciones.

6. **Golden set.**200 pares de preguntas y respuestas etiquetados por un experto en el dominio con (respuesta, citas).

7. **Red team.**50 indicaciones adversas: jailbreaks (PAIR, TAP), intentos de exfiltración de PII, filtraciones fuera del dominio, transversales.

8. **Drift dashboard.**Arize Phoenix realiza un seguimiento semanal de la calidad de la recuperación (nDCG, citation fidelity).

9. **Cost report.**Langfuse: tasa de hits de caché de instrucción, tokens por consulta, $/cuestión por etapa.

## Usalo

```
$ chat --role=analyst --jurisdiction=GDPR
> what is the data-retention obligation for EU user profiles under our contract?
[retrieve]  hybrid top-20 filtered to GDPR + analyst-role
[rerank]    top-5 kept
[synth]     claude-sonnet-4.7, cache hit 74%, 0.8s
answer:
  The contract (Section 12.4, Master Services Agreement dated 2024-03-11)
  obligates EU user profile deletion within 30 days of termination per GDPR
  Article 17. The DPA amendment (DPA-v2.1, Section 5) extends this to 14 days
  for "restricted" category data.
  citations: [MSA-2024-03-11 s12.4, DPA-v2.1 s5]
```

## Envío

`outputs/skill-production-rag.md`Un chatbot de dominio regulado desplegado con etiquetas de cumplimiento, que pasa por la rúbrica, observado con monitoreo de deriva en vivo.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | RAGAS faithfulness + answer relevance | Online scores on the golden set (200 Q/A) |
| 20 | Citation correctness | Fraction of answers with verifiable source anchors |
| 20 | Guardrail coverage | Llama Guard 4 pass rate + jailbreak suite results |
| 20 | Cost / latency engineering | Prompt-cache hit rate, p95 latency, $/query |
| 15 | Drift monitoring dashboard | Phoenix live dashboard with weekly retrieval-quality trend |
| **100** | | |

## Los ejercicios

1. Construir una segunda sección de corpus bajo una jurisdicción diferente (por ejemplo, HIPAA junto con GDPR). Demostrar el filtrado de rol+jurisdicción para evitar filtraciones cruzadas en una investigación de 20 preguntas.

2. Mide la tasa de hits de caché de la solicitud durante una semana de tráfico de producción. Identifique qué consultas rompen el prefijo de caché.

3. Agregue memoria de varios vueltos con un tampón de resumen de 10k. Medir si la fidelidad disminuye a medida que la conversación crece.

4. Cambiar Claude Sonnet 4.7 por Llama 3.3 70B auto-hosted.

5. Añadir un modo de " inseguridad ": si las puntuaciones más altas re-ranqueadas están por debajo de un umbral, el agente dice "no tengo citas seguras" en lugar de responder.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Prompt caching | "Cached system + context" | Claude/OpenAI feature: cached prefix tokens discounted 60-90% on hit |
| RAGAS | "RAG evaluator" | Automated scoring of faithfulness, answer relevance, context precision |
| Golden set | "Labeled eval" | 200+ expert-labeled Q/A with citations; the ground truth |
| Jurisdiction tag | "Compliance label" | GDPR/HIPAA/SOC2 scope attached to chunks; enforced by retrieval filter |
| Citation faithfulness | "Grounded answer rate" | Fraction of claims backed by retrievable source spans |
| Drift | "Retrieval quality decay" | Weekly change in nDCG or citation score; alert threshold 5% |
| Red team | "Adversarial eval" | Pre-release jailbreak, PII extraction, off-domain probes |

## Leer más

- [Harvey AI](https://www.harvey.ai) Estricta de producción legal de referencia
- [Glean enterprise search](https://www.glean.com) RAG de referencia a escala empresarial
- [Mendable documentation](https://mendable.ai) Referencia de los documentos de desarrollo RAG
- [LlamaCloud Parse + Index](https://docs.cloud.llamaindex.ai/llamaparse/getting_started) Ingestión controlada
- [Anthropic prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching) la referencia de apalancamiento de costes
- [RAGAS 0.2 documentation](https://docs.ragas.io/) el marco de evaluación canónico de RAG
- [Arize Phoenix](https://github.com/Arize-ai/phoenix) observabilidad de deriva de referencia
- [Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) Clasificación de seguridad 2026
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) marco ferroviario de la política
