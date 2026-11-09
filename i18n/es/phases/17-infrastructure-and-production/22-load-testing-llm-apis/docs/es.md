# Las APIs de LLM para pruebas de carga  Por qué K6 y Locust mienten

> Los probadores de carga tradicionales no fueron diseñados para respuestas de transmisión, longitudes de salida variables, métricas de nivel de token o saturación de GPU. Dos trampas mueren a la mayoría de los equipos. La trampa GIL: La medición a nivel de tokens de Locust ejecuta tokenización bajo el Python GIL, que compite con la generación de solicitudes bajo una concurrencia pesada; el backlog de tokenización luego infla la latencia entre tokens reportada  su cliente es el cuello de botella, no el servidor. La trampa de uniformidad de la señal: las instrucciones idénticas en un bucle prueban un punto en la distribución de los tokens; el tráfico real tiene longitud variable y coincidencias de prefijos diversas. LLMPerf arregla esto con `--mean-input-tokens`¿ Qué es eso ?`--stddev-input-tokens`. Mapeo de herramientas en 2026: especializada en LLM (GenAI-Perf, LLMPerf, LLM-Locust, guidelellm) para la precisión a nivel de tokens; **k6 v2026.1.0**¿ Qué es eso ?**k6 Operator 1.0 GA (Sept 2025)** streaming-consciente, Kubernetes nativo distribuido a través de TestRun/PrivateLoadZone CRDs, mejor para puertas CI/CD; Vegeta for Go saturación de tasa constante; Locust 2.43.3 solo con extensión LLM-Locust para streaming. patrones de carga: estado estable, rampa, punta (test de autoescalado), remojo (vacificaciones de memoria).

**Type:** Build
**Languages:** Python, TypeScript (stdlib, toy realistic-prompt generator + latency collector)
**Prerequisites:** Phase 17 · 08 (Inference Metrics), Phase 17 · 03 (GPU Autoscaling)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Explique los dos patrones anti-impulsivos (trampa GIL, trampa de uniformidad de la rapidez) que hacen que los probadores de carga genéricos se encuentren en las API de LLM.
- Seleccione una herramienta para un propósito determinado: LLMPerf (corrido de referencia), k6 + extensión de transmisión (puerta CI), guidellm (síntesis a gran escala), GenAI-Perf (referencia NVIDIA).
- Diseñe cuatro patrones de carga (estables, rampa, punta, remojo) y nombre el modo de falla de cada captura.
- Construir una distribución realista de la cuenta de espera utilizando el promedio + stddev de tokens de entrada en lugar de longitud fija.

## El problema

Probaste tu punto final de LLM en 500 usuarios simultáneos, lo conseguiste, lo enviaste, en producción en 200 usuarios reales el servicio cayó sobre P99 TTFT explotó, las GPUs se engancharon.

Dos cosas sucedieron. Primero, k6 envió 500 instrucciones idénticas  tu recopilación de solicitudes y caché de prefijos hizo que pareciera que estabas manejando 500 decodificadores simultáneos cuando realmente manejabas uno. Segundo, k6 no rastrea la latencia entre tokens en las respuestas de transmisión de la manera en que el ojo lo experimenta; ve una conexión HTTP, no 500 tokens llegando a intervalos variables.

Las pruebas de carga para LLM son su propia disciplina.

## El concepto

### La trampa de la GIL (Locust)

Locust utiliza Python y ejecuta tokenización del lado del cliente bajo el GIL. Bajo alta concurrencia las colas de tokenización detrás de la generación de solicitudes. La latencia entre tokens reportada incluye el backlog de tokenización del lado del cliente.

Corrección: La extensión de LLM-Locust traslada la tokenización a procesos separados, o utiliza un arnés de lenguaje compilado (k6, LLMPerf usando tokenizers.rs).

### La trampa de la uniformidad rápida

Todos los probadores de carga conocidos le permiten configurar un solo prompt. En una prueba de bucle de 10.000 iteraciones el mismo prompt se envía cada vez. El servidor ve el mismo prefijo cada vez que el prefijo  caché se acerca al 100%, el rendimiento se ve muy bien.

Corrección: muestra de una distribución rápida.`--mean-input-tokens 500 --stddev-input-tokens 150` diferentes longitudes, contenido diverso.

### Cuatro patrones de carga

1. **Steady-state** RPS constante durante 30 a 60 minutos.
2. **Ramp** aumentar linealmente el RPS de 0 a la meta durante 15 minutos.
3. **Spike** repentina 3-10 veces RPS durante 2 minutos y luego atrás.
4. **Soak** estado de estabilidad durante 4-8 horas. Captura: fugas de memoria, deriva del pool de conexión, sobrecarga de observabilidad.

### 2026 cartografía de herramientas

**LLMPerf**(Anyscale)  Python pero tokenization respaldado por Rust. Mediano / stddev instrucciones. stream-consciente. Mejor predeterminado para ejecuciones de rendimiento.

**NVIDIA GenAI-Perf** NVIDIA. Utiliza el cliente Triton; cobertura métrica completa. Nota su ITL excluye TTFT; LLMPerf incluye. Dos herramientas producen TPOT diferentes para el mismo servidor.

**LLM-Locust**Extensión de langosta que arregla la trampa GIL.

**guidellm** Comparativo sintético a gran escala.

**k6 v2026.1.0**¿ Qué es eso ?**k6 Operator 1.0 GA (Sept 2025)**¿Qué es esto ?
- k6 mismo (Go, compilado, sin GIL) añadió métricas de transmisión conscientes.
- k6 El operador utiliza los CRD de TestRun / PrivateLoadZone para las pruebas distribuidas nativas de Kubernetes.
- Lo mejor para las puertas CI/CD y las pruebas SLA.

**Vegeta** Go, más simple que k6. Saturación HTTP de tasa constante. No es consciente de LLM, pero es bueno para las pruebas de gateway / límite de tasa.

**Locust 2.43.3 stock** tiene la trampa GIL para LLM. Sólo con extensión LLM-Locust.

### Puerta de SLA en CI

Ejecutar el K6 en la PR con:

- 30-50 iteraciones cada una en el RPS de referencia.
- Puerta: P50/P95 TTFT, 5xx < 5%, TPOT por debajo del umbral.
- Rompe la construcción en la brecha.

### Distribución rápida realista

Construir a partir de muestras reales de tráfico (si las tiene) o de distribuciones publicadas (por ejemplo, ShareGPT solicitudes para el chat, HumanEval para el código).

### Números que debes recordar

- k6 Operador 1.0 GA: septiembre de 2025.
- k6 v2026.1.0: métricas de transmisión conscientes.
- Tipo de LLMPerf: 100-1000 solicitudes en la concurrencia X.
- Puerta de CI típica: 30-50 iteraciones por PR.
- Cuatro patrones: estable, rampa, punta, remojo.

```figure
load-pattern-waves
```

## Usalo

`code/main.py`simula una prueba de carga con una distribución realista de la velocidad, mide el TPOT efectivo y demuestra la trampa de velocidad uniforme.

## Envío

Esta lección produce`outputs/skill-load-test-plan.md`. Dado la carga de trabajo y el SLA, elige la herramienta y diseña los cuatro patrones de carga.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`. Comparar distribución uniforme vs realista ¿dónde está la brecha?
2. Escriba el guión k6 para una puerta CI: TTFT P95 < 800 ms a 100 concurrencias, tiempo de ejecución 5 minutos.
3. Su prueba de remojo muestra que la memoria crece 50 MB/hora. Nombre tres causas y el instrumento para elegir entre ellos.
4. Prueba de punta de 10 RPS a 100 RPS. ¿Cuál es el tiempo de recuperación esperado si se está en marcha la pila de producción Karpenter + vLLM (fase 17 · 03 + 18)?
5. GenAI-Perf informa TPOT=6ms; LLMPerf informa TPOT=11ms en el mismo servidor.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| LLMPerf | "the LLM harness" | Anyscale benchmark tool, streaming-aware |
| GenAI-Perf | "NVIDIA tool" | NVIDIA reference harness |
| LLM-Locust | "Locust for LLMs" | Locust extension fixing GIL trap |
| guidellm | "synthetic benchmark" | Large-scale synthetic tool |
| k6 Operator | "K8s k6" | CRD-based distributed k6 |
| GIL trap | "Python client overhead" | Tokenization backlog inflates reported latency |
| Prompt-uniformity trap | "single-prompt lie" | Loop with same prompt hits cache, inflates throughput |
| Steady-state | "constant load" | Flat RPS for N minutes |
| Ramp | "linear up" | 0 to target over duration |
| Spike | "burst test" | Sudden multiplier then revert |
| Soak | "long test" | Hours for leak detection |

## Leer más

- [TianPan — Load Testing LLM Applications](https://tianpan.co/blog/2026-03-19-load-testing-llm-applications)
- [PremAI — Load Testing LLMs 2026](https://blog.premai.io/load-testing-llms-tools-metrics-realistic-traffic-simulation-2026/)
- [NVIDIA NIM — Introduction to LLM Inference Benchmarking](https://docs.nvidia.com/nim/large-language-models/1.0.0/benchmarking.html)
- [TrueFoundry — LLM-Locust](https://www.truefoundry.com/blog/llm-locust-a-tool-for-benchmarking-llm-performance)
- [LLMPerf](https://github.com/ray-project/llmperf)
- [k6 Operator](https://github.com/grafana/k6-operator)
