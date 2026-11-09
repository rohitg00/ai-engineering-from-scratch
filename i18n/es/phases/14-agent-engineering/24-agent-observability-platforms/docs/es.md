# Los agentes observables: Langfuse, Phoenix, Opik

> Las plataformas de observabilidad de agentes auto-hostables dominan el 2026. Langfuse (MIT)  6M+ instalaciones/mes, rastreo + gestión de prompto + evaluaciones + repetición de sesión. Arize Phoenix (Elastic 2.0)  evaluaciones específicas de agentes profundas, relevancia RAG, auto-instrumentación OpenInference. Cometa Opik (Apache 2.0)  optimización automática de prompto, guardrails, detección de alucinaciones del juez LLM.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 23 (OTel GenAI)
**Time:** ~45 minutes

## Objetivos de aprendizaje

- Nombre de las tres plataformas de observabilidad de agentes auto-hostables y sus licencias, y decir cuál licencia no es OSI de código abierto.
- Distingue en qué es más fuerte cada uno: Langfuse (sesiones de mgmt + inmediato), Phoenix (RAG + auto-instrumentamiento), Opik (optimización + barandillas).
- Explica por qué el 89% de las organizaciones informa tener observabilidad de agentes en vigor para 2026.
- Implementar una línea de trayectoria de la tabla de control con evaluación del juez de la LLM.

## El problema

OTel GenAI (Lección 23) le da el esquema. Todavía necesita la plataforma que ingere los intervalos, ejecuta evaluaciones, almacena versiones rápidas y superviene regresiones.

## El concepto

### El proyecto de investigación

- 6M+ SDK instalaciones / mes, 19k+ GitHub estrellas.
- Características: seguimiento, gestión rápida con versiones + playground, evaluaciones (LLM-as-judge, comentarios de los usuarios, personalizado), repeticiones de sesión.
- junio 2025: módulos anteriormente comerciales (LLM-as-a-judge, colas de anotaciones, experimentos rápidos, Playground) de código abierto bajo el MIT.
- Más fuerte para: observabilidad de extremo a extremo con un circuito de gestión rápida apretado.

### Arize Phoenix (licencia elástica 2.0)

- Evaluación más profunda específica de los agentes: agrupamiento de rastros, detección de anomalías, relevancia de la recuperación para el RAG.
- Autonoma instrumentación de OpenInference nativo.
- Parejas con Arize AX gestionado para producción.
- No se ha producido una versión rápida  posicionada como herramienta de deriva/regresor de comportamiento junto a plataformas más amplias.
- Lo más fuerte para: relevancia RAG, deriva de comportamiento, detección de anomalías.

### Cometa Opik (Apache 2.0)

- Optimización automática de la rapidez a través de experimentos A/B.
- Barrancas de seguridad (reducción de PII, restricciones tópicas).
- El juez LLM detecta alucinaciones.
- Indicador de referencia de la propia medición de Comet: los registros de Opik + evaluaciones en 23.44s vs. Langfuse 327.15s (~14x gap)  toman los indicadores de referencia del proveedor como direccionales.
- Lo más fuerte para: bucle de optimización, experimentación automatizada, aplicación de barandillas.

### Datos de la industria

Por Maxim (2026 análisis de campo): el 89% de las organizaciones tienen observabilidad de agentes en su lugar; los problemas de calidad son la principal barrera de producción (32% de los encuestados los citan).

### Escogiendo uno

| Need | Pick |
|------|------|
| All-in-one with prompt management | Langfuse |
| Deep RAG evaluation + drift | Phoenix |
| Automated optimization + guardrails | Opik |
| Open licensing, no ELv2 | Langfuse (MIT) or Opik (Apache 2.0) |
| Datadog / New Relic integration | Any — they all export OTel |

### Cuando este patrón va mal

- **No eval strategy.**El rastreo sin evaluación es sólo una extracción costosa.
- **Self-rolled LLM-judge without grounding.**Se aplica el patrón CRITICO (lección 05)  los jueces necesitan herramientas externas para la verificación de los hechos.
- **Prompt versions not tied to traces.**Cuando el prodo regresa, no se puede dividir a la señal que lo causó.

```figure
wb-trace-ingest
```

## Construye el mismo

`code/main.py`Implementa un colector de huellas de la stdlib + evaluador de jueces de LLM:

- Ingerir las espinas en forma de GenAI.
- Grupo por sesión, etiqueta de ejecuciones fallidas (viajes de vigilancia, evaluaciones de baja confianza).
- Un juez de LLM con guión que califica las respuestas de los agentes en una rúbrica.
- Un resumen similar al tablero de instrumentos: tasa de fallas, principales razones de fallas, distribución de puntuaciones de evaluación.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

Resultado: puntuaciones de evaluación por sesión y clasificación de fallos que coinciden con lo que mostraría Langfuse/Phoenix/Opik.

## Usalo

- **Langfuse**auto-hosted o en la nube; cable a través de OTel o su SDK.
- **Arize Phoenix**auto-aliñado; auto-instrumento OpenInference.
- **Comet Opik**auto-hosted o en la nube; bucle de optimización automatizado.
- **Datadog LLM Observability**para equipos de operaciones mixtas + ML que ya ejecutan Datadog.

## Envío

`outputs/skill-obs-platform-wiring.md`elige una plataforma y traza + evalua + versiones de respuesta en un agente existente.

## Los ejercicios

1. Exportar una semana de trazas de OTel a la nube Langfuse. ¿Qué sesiones fallaron?
2. Escriba una rúbrica de juez de LLM para su dominio (corrección de hechos, tono, cumplimiento del alcance).
3. Comparar la versión de Langfuse con la de Phoenix, ¿qué te dice qué se rompió más rápido?
4. Lea los documentos de la barrera de Opik, entregue una barrera de redacción de PII a uno de sus agentes.
5. Revisa los tres en tu corpus, ignora los números publicados por el vendedor, mide los tuyos.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Tracing | "Spans collector" | Ingest OTel / SDK spans; index by session |
| Prompt management | "Prompt CMS" | Versioned prompts tied to traces |
| LLM-as-judge | "Automated eval" | Separate LLM scores agent output against a rubric |
| Session replay | "Trace playback" | Step through past runs for debugging |
| RAG relevancy | "Retrieval quality" | Does the retrieved context match the query |
| Trace clustering | "Behavioral grouping" | Cluster similar runs for drift detection |
| Guardrail enforcement | "Policy at log time" | PII/toxicity/scope checks on logged content |

## Leer más

- [Langfuse docs](https://langfuse.com/) rastreo, evaluaciones, seguimiento de la información
- [Arize Phoenix docs](https://docs.arize.com/phoenix) Auto-instrumentamiento, derivación
- [Comet Opik](https://www.comet.com/site/products/opik/) optimización + barandillas
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) el esquema los tres consumen
