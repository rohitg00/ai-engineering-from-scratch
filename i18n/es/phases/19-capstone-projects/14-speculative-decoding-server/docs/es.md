# Capstone 14  Servidor de inferencia de descodación especulativa

> La descifrado especulativo  un borrador barato propone tokens, el modelo objetivo los verifica en un solo paso  ahora es una optimización lista para la producción, no un truco de investigación. EAGLE-3 en vLLM 0.7 nave 2.5-3x de rendimiento en tráfico real. P-EAGLE (AWS 2026) empujó aún más la especulación paralela. El SpecForge de SGLang entrenó a los jefes de reclutamiento a escala. El centro de especuladores de Red Hat publicó proyectos alineados para modelos abiertos comunes. TensorRT-LLM hizo el decodificación especulativa de primera clase en NVIDIA. La pila de producción de servicio 2026 es vLLM o SGLang con proyectos de familia EAGLE, cuantización FP8 o INT4, y HPA en cola. Esta piedra angular servirá a dos modelos abiertos con un rendimiento de 2,5x+ de línea de base con un informe completo de latencia de cola.

**Type:** Capstone
**Languages:** Python (serving), TypeScript, C++ / CUDA (kernel inspection), YAML (configs)
**Prerequisites:** Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 17 (infrastructure)
**Phases exercised:**P3 · P7 · P10 · P17
**Time:** 30 hours

## El problema

La descifrado especulativo se convirtió en una mercancía en 2026. EAGLE-3 los jefes de proyección entrenan en los estados ocultos del modelo objetivo y predicen N tokens hacia adelante; el modelo objetivo se verifica en un solo pase. Las tasas de aceptación del 60-80% se traducen en 2-3 veces el rendimiento de extremo a extremo. vLLM 0.7 integra esto de forma nativa. SGLang + SpecForge le proporciona la línea de entrenamiento. Red Hat's Speculators publica proyectos alineados para Llama 3.3 70B, Qwen3-Coder-30B MoE, GPT-OSS-120B.

La nave está en las operaciones de servicio, no el modelo. La tasa de aceptación deriva con la distribución del tráfico (ShareGPT vs código vs datos de dominio). La latencia de cola bajo rechazo es peor que sin especulación  debe reportar p99 en múltiples tamaños de lotes, no solo tokens de estado estacionario / segundo. El costo por 1M tokens vs Anthropic / OpenAI API es la palanca de credibilidad.

## Concepto

La descifrado especulativo tiene dos capas.**draft**El modelo (capítulo de la aguja-3, ngram o modelo más pequeño alineado con el objetivo) propone k tokens candidatos por paso.**target**El modelo verifica todos los k en un solo paso; cualquier prefijo aceptado reemplaza el camino codicioso.

EAGLE-3 supera los proyectos ngram en la mayoría del tráfico. P-EAGLE realiza especulaciones paralelas para los proyectos más profundos. La compensación: la latencia P99 en el rechazo es mayor porque el pase de verificación es mayor. La configuración de servicio debe informar la latencia de tamaño de lote para supervivir esto.

La implementación es Kubernetes. vLLM 0.7 ejecuta una réplica por GPU o fragmento paralelo tensor. HPA autoscales en fila de espera en lugar de CPU. FP8 (Marlin) e INT4 (AWQ) cuantes mantienen la memoria de GPU dentro de un envase H100 / H200. El informe de extremo a extremo es rendimiento, tasa de aceptación, p50/p99 en lote 1/8/32, y tokens de $/1M.

## Arquitectura

```
request ingress
    |
    v
vLLM server (0.7) or SGLang (0.4)
    |
    +-- draft: EAGLE-3 heads | P-EAGLE parallel | ngram fallback
    +-- target: Llama 3.3 70B | Qwen3-Coder-30B | GPT-OSS-120B
    |     quantized FP8-Marlin or INT4-AWQ
    |
    v
verify pass: batch k draft tokens through target
    |
    v (accept prefix; resample for rejected suffix)
    v
token stream back to client
    |
    v
Prometheus metrics: throughput, acceptance rate, queue wait, latency p50/p99
    |
    v
HPA on queue-wait metric
```

## El establo

- Servidores: vLLM 0,7 o SGLang 0,4
- Métodos especulativos: cabezas de proyecto EAGLE-3, especulación paralela P-EAGLE, regreso de gramos
- Formación de proyectos: SpecForge (SGLang) o Red Hat Speculators
- Modelos objetivo: Llama 3.3 70B, Qwen3-Coder-30B MoE, GPT-OSS-120B
- Cuantificación: FP8 (Marlin), INT4 AWQ
- Despliegue: Kubernetes + NVIDIA dispositivo de complemento; HPA en la métrica de espera de cola
- Eval: ShareGPT, MT-Bench-v2, GSM8K, HumanEval para la medición de aceptación de dominio
- Referencia: Descodage especulativo TensorRT-LLM para una línea de base del proveedor

```figure
cf-spec-decode
```

## Construye el mismo

1. **Target model prep.**Seleccione Llama 3.3 70B. Cuantice a FP8 a través de Marlin. Despliegue bajo vLLM 0.7 en 1xH100 (o 2x tensor paralelo).

2. **Draft source.**Extraer un eje de proyecto de EAGLE-3 alineado de Red Hat Speculators (o entrenar uno a través de SpecForge). Cargar en la configuración de decodificación especulativa de vLLM.

3. **Baseline numbers.**Antes de la especulación: tokens/s en lote 1/8/32, p50/p99 latencia, utilización de GPU.

4. **Enable EAGLE-3.**Configuración de cambio; repite el mismo índice de referencia. Raporte de aceleración, tasa de aceptación, delta de latencia de cola p99.

5. **P-EAGLE.**Habilitar especulación paralela; medir árbol de proyección más profundo vs. EAGLE-3 en serie. Informar la inflexión donde P-EAGLE ayuda vs. duele.

6. **Domain traffic.**Ejecutar ShareGPT vs HumanEval vs tráfico específico de dominio a través del mismo servidor. Medir la tasa de aceptación por distribución. Identificar cuando los borrados se deriva.

7. **Second target model.**Ejecutar la misma tubería en Qwen3-Coder-30B MoE. El borrador es más complicado (ruido de enrutamiento de MoE).

8. **K8s HPA.**Despliegue bajo K8s con seguimiento de HPA `queue_wait_ms`- Demostrar escalabilidad cuando la carga se triplica.

9. **Cost comparison.**Compute $ 1M tokens vs. Antropic Claude Sonnet 4.7 y OpenAI GPT-5.4 en la misma evaluación.

## Usalo

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[serve]     vLLM 0.7, Llama 3.3 70B FP8, EAGLE-3 active
[decode]    bs=8, accepted_tokens_per_step=3.2, acceptance_rate=0.76
[latency]   first-token 42ms, full-response 980ms (620 tokens)
[cost]      $0.34 per 1M output tokens at sustained throughput
```

## Envío

`outputs/skill-inference-server.md`Una pila de servicio medida con descifrado especulativo, un informe completo de referencia y un despliegue de K8.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Measured speedup vs baseline | 2.5x+ throughput at matched quality on two models |
| 20 | Acceptance rate on realistic traffic | Per-distribution acceptance-rate report |
| 20 | P99 tail-latency discipline | p99 at batch 1/8/32 with and without speculation |
| 20 | Ops | K8s deploy, HPA on queue-wait, rollout smooth |
| 15 | Write-up and methodology | Clear explanation of what changed and why |
| **100** | | |

## Los ejercicios

1. Medir la degradación de la tasa de aceptación cuando el borrador esté una versión detrás del objetivo (por ejemplo, Llama 3.3 -> 3.4 deriva).

2. Implementar la retroceso de los gramos: si la aceptación de EAGLE-3 cae por debajo de un umbral, cambiar a los proyectos de gramos.

3. Ejecutar un experimento controlado de MoE: el mismo Qwen3-Coder-30B con ruido de enrutamiento inyectado vs. fuera. Medir la sensibilidad de aceptación del borrador.

4. Extenda a H200 (141 GB). Informar el tamaño del modelo por réplica de la cabina ganada y si puede servir un Llama 3.3 70B no cuantificado.

5. Descifrado especulativo de TensorRT-LLM en el mismo hardware H100.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Draft model | "Speculator" | Small model that proposes N tokens for the target to verify |
| EAGLE-3 | "2026 draft architecture" | Draft head trained on target hidden states; ~75% acceptance |
| P-EAGLE | "Parallel speculation" | Tree of draft branches verified in one target pass |
| Acceptance rate | "Hit rate" | Fraction of drafted tokens accepted without resampling |
| Quantization | "FP8 / INT4" | Lower-precision weights to fit more model in GPU memory |
| Queue wait | "HPA metric" | Time a request waits in the pending queue before inference starts |
| Speculators hub | "Aligned drafts" | Red Hat Neural Magic hub of EAGLE drafts for common open models |

## Leer más

- [vLLM EAGLE and P-EAGLE documentation](https://docs.vllm.ai) la pila de servicio de referencia
- [P-EAGLE (AWS 2026)](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-speculative-decoding-in-vllm/) papel paralelo de decodificación especulativa + integración
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) Línea de formación de la cabeza de proyecto
- [Red Hat Speculators](https://github.com/neuralmagic/speculators) centro de proyección alineado
- [TensorRT-LLM speculative decoding](https://nvidia.github.io/TensorRT-LLM/) Alternativa de proveedor
- [Fireworks.ai serving architecture](https://fireworks.ai/blog) Referencia comercial
- [EAGLE-3 paper (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) el papel de método
- [vLLM repository](https://github.com/vllm-project/vllm) código y valores de referencia
