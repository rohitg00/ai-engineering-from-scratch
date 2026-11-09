# Metricas de inferencia  TTFT, TPOT, ITL, Goodput, P99

> Cinco métricas deciden si una implementación de inferencias está funcionando. TTFT es preempleo más cola más red. TPOT (a menudo se informa como ITL, aunque las herramientas no están de acuerdo sobre si ITL cuenta el primer token) es el costo de decodificación de memoria por token. La latencia de extremo a extremo es TTFT más TPOT veces longitud de salida. El rendimiento es los tokens por segundo agregados en toda la flota. Pero lo que importa para el producto es el goodput  la fracción de solicitudes que cumplieron con todos los SLO simultáneamente. Alto rendimiento con bajo goodput significa que estás procesando tokens que nunca llegan a los usuarios a tiempo. Números de referencia para Llama-3.1-8B-Instruir sobre TRT-LLM en 2026: TTFT promedio de 162 ms, TPOT promedio de 7,33 ms, E2E promedio de 1,093 ms. Siempre reportar P50, P90, P99  nunca sólo significa. Y observa la trampa de medición: GenAI-Perf excluye TTFT del cálculo de ITL, LLMPerf lo incluye; dos herramientas no están de acuerdo en TPOT para el mismo ejecutivo.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy percentile calculator and goodput reporter)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Definir con precisión TTFT, TPOT, ITL, E2E, rendimiento y goodput y nombrar el componente que cada uno mide.
- Explica por qué la media es la estadística equivocada para el servicio de LLM y cómo leer P50/P90/P99.
- Construir una restricción SLO multi- (por ejemplo, TTFT < 500 ms Y TPOT < 15 ms Y E2E < 2 s) y calcular el buen rendimiento en relación con ella.
- Nombre de dos instrumentos de referencia que no estén de acuerdo en TPOT para el mismo período y explica por qué.

## El problema

"Nuestro rendimiento es de 15.000 tokens por segundo". ¿Y qué? Si el 40% de las solicitudes pasan de 2 segundos de extremo a extremo, los usuarios abandonan la sesión.

La inferencia tiene múltiples ejes de latencia y cada uno falla de manera diferente. El preempleo está limitado por el cálculo y se mide con una longitud rápida. El decodificación está ligada a la memoria y se mide con el tamaño del lote. El retraso en la cola es un problema operativo. La red es un problema de distancia física. Necesitas métricas distintas para cada uno, y necesitas percentillas, y necesitas un único compuesto que diga "el usuario obtuvo lo que esperaba"

## El concepto

### TTFT  tiempo para el primer token

`TTFT = queue_time + network_request + prefill_time`

Prefill domina cuando las instrucciones son largas. En Llama-3.3-70B FP8 en H100, una instrucción de 32k toma ~800 ms de prefill puro. El tiempo de cola es el comportamiento del programador bajo carga. La solicitud de red es el tiempo de cable incluyendo TLS. TTFT es la latencia que el usuario ve antes de que algo fluye de nuevo.

### TPOT / ITL  latencia entre tokens

Muchos nombres para una cantidad.`TPOT`(tiempo por token de salida), `ITL`(latencia entre tokens), `decode latency per token`Es el tiempo entre los tokens transmitidos consecutivos después del primero.

`TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced`

En la misma pila Llama-3.3-70B H100 con preempleo en pedazos, TPOT significa ~ 7 ms. Sin preempleo en pedazos, durante un largo preempleo en una secuencia vecina, TPOT puede aumentar a 50 ms. Observa P99, no significa.

### La latencia E2E

`E2E = TTFT + TPOT * output_tokens + network_response`

Para las salidas largas (> 500 tokens), E2E está dominado por TPOT. Para las salidas cortas con pedidos largos, E2E está dominado por TTFT.

### Capacidad de transmisión

`throughput = total_output_tokens / elapsed_time`

La métrica agregada le dice la eficiencia de la flota no la salud de las solicitudes individuales.

### Goodput  la métrica que realmente te importa

`goodput = fraction of requests meeting (TTFT <= a) AND (TPOT <= b) AND (E2E <= c)`

El SLO es una restricción múltiple. Una solicitud es "buena" sólo si se cumple cada restricción. Goodput es la participación. Algunos papeles y tablas de control informan de goodput como tasa en su lugar: solicitudes por segundo que cumplen con cada SLO. Multiplica la participación por la tasa de solicitud para convertir.

En 2026, el goodput es la métrica utilizada en las presentaciones de MLPerf Inference v6.0 y en el seguimiento interno de SLA en los proveedores de plataformas de IA.

### ¿Por qué la mala es la estadística equivocada?

Las distribuciones de latencia LLM son distorsionadas a la derecha. Un lote de decodificación con un vecino de pre-empleo largo puede enviar 500 tokens con TPOT ~ 7 ms y 20 tokens con TPOT ~ 60 ms.

Siempre informe el triple (P50, P90, P99). Para la experiencia del usuario, P99 es el que optimiza.

### Números de referencia  Llama-3.1-8B-Instrucción sobre TRT-LLM, 2026

- TTFT medio: 162 ms
- TPOT medio: 7,33 ms
- medias E2E: 1,093 ms
- P99 TPOT: varía entre 10 y 25 ms dependiendo de la configuración de preempleo en pedazos.

Estos son los puntos de referencia publicados de NVIDIA. Cambian con el tamaño del modelo (70B mostraría 3-5x), el hardware (H100 vs. B200 ~ 3x), y la carga.

### La trampa de medición

Dos de las herramientas de referencia más utilizadas para 2026 no están de acuerdo en TPOT para el mismo período:

- **NVIDIA GenAI-Perf**El ITL comienza con el token 2.
- **LLMPerf**El ITL comienza con el token 1.

Para una solicitud con TTFT 500 ms y 100 tokens de salida en 700 ms total de decodificación, GenAI-Perf informa `ITL = 700/99 = 7.07 ms`, informa LLMPerf `ITL = 1200/100 = 12.00 ms`La elección de la herramienta cambia el número.

Siempre indique qué herramienta. Siempre publique la definición.

### Construir un SLO

Un SLO razonable para el consumidor para un modelo de chat 70B en 2026:

- TTFT P99 <= 800 ms.
- TPOT P99 <= 25 ms.
- E2E P99 <= 3 s para las salidas de < 300 tokens.
- Objetivo de rendimiento >= 99%.

Los SLO de la empresa apretan el TTFT (200-400 ms) y aflojan el E2E. El punto es escribirlos, medir los tres y rastrear el goodput como un solo compuesto.

### Cómo medir

- Realizar tráfico real o realista sintético (LLMPerf con `--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150`¿Qué es lo que se hace?
- Objetivo de 2 veces la concurrencia máxima para la ejecución de referencia.
- Ejecutar 30-50 iteraciones, tomar percentiles de la muestra combinada.
- Publica con el nombre de la herramienta, la versión de la herramienta, el modelo, el hardware, la concurrencia, la distribución rápida.

```figure
throughput-latency
```

## Usalo

`code/main.py`Es una calculadora de buen rendimiento de juguete. Generar una distribución de latencia sintética, aplicar un SLO, y calcular el buen rendimiento. También muestra la diferencia de TPOT GenAI-Perf vs LLMPerf en el mismo rastro.

El [Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?users=1)La máquina muestra de dónde proviene el tiempo por token de salida en una NVIDIA L4. Un paso de decodificación lee 16.41 GB de pesos, lo que toma al menos 54.7 ms a 300 GB/s, y el paso medido tomó 60.16 ms.

## Envío

Esta lección produce`outputs/skill-slo-goodput-gate.md`. Dada la carga de trabajo y la SLO, produce una receta de referencia de CI/CD que se utiliza en las puertas de buen rendimiento en lugar de en el rendimiento.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`¿Cómo cambia el goodput cuando se apreta el P99 TPOT de 30 ms a 15 ms?
2. Un vendedor cita "15,000 tok/s en Llama 3.3 70B H100". Nombre tres preguntas que hacer antes de confiar en él.
3. ¿Por qué el preempleo en pedazos protege a P99 TPOT pero no a TPOT?
4. Construir un SLO de consumo para un asistente de voz (el primer token se escucha, no se lee). ¿Cuál métrica es más visible para el usuario?
5. Lea los documentos LLMPerf README y GenAI-Perf. Identifique otras tres métricas en las que las herramientas no estén de acuerdo.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| TTFT | "time to first token" | Queue + network + prefill; dominated by prefill at long prompts |
| TPOT | "time per output token" | Memory-bound decode cost per token after first |
| ITL | "inter-token latency" | Same as TPOT in most tools (not all — see GenAI-Perf) |
| E2E | "end to end" | TTFT + TPOT * output_len; response-side network on top |
| Throughput | "tok/s" | Fleet efficiency; useless without latency percentiles |
| Goodput | "SLO-met rate" | Fraction of requests meeting every SLO constraint simultaneously |
| P99 | "tail" | 1-in-100 worst-case latency; the user experience metric |
| SLO multi-constraint | "the joint" | AND of all three latency bounds; a request fails if any one is violated |
| GenAI-Perf vs LLMPerf | "the tool trap" | Tools disagree on whether ITL includes TTFT |

## Leer más

- [NVIDIA NIM — LLM Benchmarking Metrics](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html) definición canónica de TTFT, ITL, TPOT.
- [Anyscale — LLM Serving Benchmarking Metrics](https://docs.anyscale.com/llm/serving/benchmarking/metrics) definiciones alternativas y receta de medición.
- [BentoML — LLM Inference Metrics](https://bentoml.com/llm/inference-optimization/llm-inference-metrics) medición aplicada en los despliegues reales.
- [LLMPerf](https://github.com/ray-project/llmperf) Indicador de referencia de código abierto basado en ray.
- [GenAI-Perf](https://github.com/triton-inference-server/perf_analyzer/blob/main/genai-perf/README.md) La herramienta de referencia de NVIDIA.
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) el índice de referencia basado en el buen rendimiento aceptado por la industria.
