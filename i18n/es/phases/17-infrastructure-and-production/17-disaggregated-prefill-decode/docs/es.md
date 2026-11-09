# Preemplazo/descódigo desglosado  NVIDIA Dynamo y llm-d

> El preempleo está limitado por computadora; el decodificación está limitada por memoria. Ejecutar ambos en la misma GPU desperdicia un recurso. La desagregación las divide en grupos separados y transfiere el caché KV entre ellos a través de NIXL (RDMA/InfiniBand o fallback TCP). NVIDIA Dynamo (GTC 2025 anuncio, 1.0 GA) se encuentra por encima de vLLM/SGLang/TRT-LLM  su Planner Profiler + SLA Planner pre-cambio de tasa automática: descoda las relaciones para cumplir con los SLOs. NVIDIA publica ganancias de rendimiento en este estadio  developer.nvidia.com (2025-06) muestra una mejora de ~6x para DeepSeek-R1 MoE en GB200 NVL72 + Dynamo en el régimen de latencia media, y la página de producto de Dynamo (developer.nvidia.com, sin fecha) anuncia hasta 50x de rendimiento de MoE en GB300 NVL72 + Dynamo vs Hopper. La cifra "30x" es un agregado comunitario en los informes completos de Blackwell + Dynamo + DeepSeek-R1; no hemos encontrado una sola fuente primaria que indique exactamente 30x, así que tratémoslo como una afirmación direccional. llm-d (Red Hat + AWS) es nativo de Kubernetes: preemplazo / decodificación / enrutador como Servicios independientes con HPA por función. llm-d 0.5 añade descarga jerárquica de KV, enrutamiento de LoRA consciente de la caché, red UCCL, escala a cero. Economía: la introducción interna de múltiples divulgaciones de clientes sugiere un ahorro del 3040% en $2M-class inference spend (i.e., $600-800 K/año) cuando se cambia de una porción colocada a una desagregada con Dynamo a un ALS constante;$2M→$La figura 600-800K es una composición interna, no un solo estudio de caso publicado la utiliza como un anclaje de orden de magnitud, no como cita de referencia. Las instrucciones cortas (<512 tokens, salida corta) no justifican el costo de transferencia.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy disaggregated-vs-colocated simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 08 (Inference Metrics)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Explicar por qué el preempleo y la descifrado tienen diferentes asignaciones óptimas de GPU y cuantificar los residuos bajo colocación.
- Diagrama la arquitectura desagregada: pool de preempleo, pool de decodificación, transferencia de KV a través de NIXL, enrutador.
- Nombre de la condición en la que la desagregación NO se realiza (indicaciones cortas, salidas cortas).
- Distinguir entre NVIDIA Dynamo (pillar arriba) y llm-d (nativo de Kubernetes) y ajustar cada uno a un contexto operativo.

## El problema

Se ejecuta Llama 3.3 70B en 8 H100s. Bajo carga de trabajo mixta (prompts largos + salidas cortas), las GPUs se quedan inactivas durante la decodificación porque la mayor parte del cálculo se gastó en preempleo. Bajo carga de trabajo diferente (prompts cortos + salidas largas), sucede lo contrario.

Impacto presupuestario: 20-40% del tiempo de la GPU se pierde en el recurso equivocado. Usted está comprando H100 computadora para ejecutar el decodificación de memoria, o comprando H100 HBM ancho de banda para ejecutar computadora de precarga. ambos son costosos desperdicios.

La desagregación divide preempleo y decodificación en piscinas separadas del tamaño de cada cuello de botella.

## El concepto

### Por qué los cuellos de botella difieren

**Prefill** ejecutar el transformador sobre el prompt de entrada completo en un prospecto. Las multiplicaciones de matriz dominan; encomutado. H100 FP8 da ~ 2000 TFLOPS de rendimiento útil. La eficiencia del lote es buena  un prospecto procesa muchos tokens.

**Decode** generar un token a la vez, leyendo los pesos completos de cada iteración.

Colocarlos: usted compra GPUs optimizadas para ambos. H100 es bueno en ambos, pero cuesta lo mismo en ambos sentidos. A escala, usted quiere preemplar el pool en H100 / computación pesada; decodificar el pool en H200 / memoria pesada, o con cuantización agresiva.

### La arquitectura

```
            ┌──────────────┐
  Request → │    Router    │ ───────────────────────┐
            └──────┬───────┘                        │
                   │                                │
                   ▼ (prompt only)                  │
            ┌──────────────┐    KV cache    ┌───────▼──────┐
            │ Prefill pool │ ─── NIXL ────► │ Decode pool  │
            │  (compute)   │                │  (memory)    │
            └──────────────┘                └──────┬───────┘
                                                   │ tokens
                                                   ▼
                                                 Client
```

NIXL es el transporte internodo de NVIDIA. Utiliza RDMA/InfiniBand cuando está disponible, fallback TCP de lo contrario. La latencia de transferencia es real  típicamente 20-80 ms para el caché KV de un prompt de 4K-token en 70B FP8.

### Dinamo vs llm-d

**NVIDIA Dynamo**(Anuncio de la CGT 2025, 1.0 GA):
- Se sienta por encima de VLLM, SGLang, TRT-LLM como orquesta.
- El Profilador de planificación mide la carga de trabajo, el SLA Planner configura automáticamente las proporciones de preempleo:decodificación.
- Núcleo de resistencia, extensibilidad de Python.
- Aumento de rendimiento: NVIDIA informa 6x para DeepSeek-R1 MoE en GB200 NVL72 + Dynamo en el régimen de latencia media (developer.nvidia.com, 2025-06); informes comunitarios de "hasta 30x" en las pilas completas de Blackwell + Dynamo + DeepSeek-R1 carecen de una única fuente primaria y deben tratarse como direccionales.
- GB300 NVL72 + Dynamo: hasta 50 veces el rendimiento MoE vs Hopper por página de producto de Dynamo (desarrollador.nvidia.com, sin fecha).

**llm-d**(Red Hat + AWS, nativo de Kubernetes):
- Preempla / decodifica / router como servicios independientes de Kubernetes.
- HPA por función con profundidad de cola (precarga) / KV de utilización (decodificación) señales.
- `topologyConstraint packDomain: rack`los paquetes preemplen+decodifican los clics en el mismo estante para la transferencia de KV de gran ancho de banda.
- llm-d 0.5 (2026): descarga jerárquica de KV, enrutamiento de LoRA consciente de la caché, red UCCL, escala a cero.

Usa Dynamo si quieres un orquestrador de pila gestionado, usa llm-d si quieres primitivos nativos Kubernetes y comprometidos con el ecosistema CNCF.

### Economía

Compuesto interno (no se publicó un solo estudio de caso  anclaje de orden de magnitud):

- 2 millones de dólares anuales en gastos de inferencia en porciones colocadas.
- Cambié a desagregado con Dynamo.
- El mismo volumen de solicitud, la misma SLA de latencia P99.
- Ahorros reportados: $600K–$800K/año (3040% reducción).
- No hay nuevo hardware.

Sintetizamos esta cifra a partir de múltiples revelaciones de clientes en lugar de un solo estudio de caso citable; el punto de datos publicado más cercano es el TTFT 2x más rápido de Baseten / 61% más alto rendimiento con Dynamo KV enrutamiento (baseten.co, 2025-10), y la proyección de VAST + CoreWeave de 60130% más tokens / $ a 4060% KV tasa de éxito (vastdata.com, 2025-12). El ahorro proviene del tamaño adecuado de cada piscina; las cargas de trabajo pesadas de preempleo (RAG con prefijos 8K+) se benefician más que las equilibradas.

### Cuando NO se desagregará

- Las solicitudes < 512 tokens y las salidas < 200 tokens: el impuesto sobre las transferencias domina la ganancia.
- Cluster pequeño (< 4 GPU): no hay suficiente diversidad de piscina.
- El equipo no puede operar dos GPU con escalación por rol: Dynamo ayuda pero no trivialmente.
- No hay tejido RDMA: el impuesto a la transferencia TCP es más pesado.

### El router se integra con la fase 17 · 11

Los routers desglosados son conocedores de KV-cache (fase 17 · 11). Una solicitud aterriza en el conjunto de decodificación que contiene su prefijo  si no coincide, fluye prefill → decodificar.

### El MoE en Blackwell es donde los números reales son

GB300 NVL72 + Dynamo muestra 50 veces el rendimiento de MoE sobre las líneas de base de Hopper. El enrutamiento experto en MoE es computacional en preempleo pero de memoria en decodificación (caches expertos), por lo que la desagregación es una doble victoria. El modelo fronterizo de 2026 es el MoE dominante (DeepSeek-V3, futuras variantes de GPT-5).

### Números que debes recordar

Los números de referencia se mueven  NVIDIA y la pila de inferencias publican los resultados actualizados cada trimestre.

- DeepSeek-R1 en GB200 NVL72 + Dynamo: ~6x de rendimiento frente a línea de base en el régimen de latencia media (developer.nvidia.com, 2025-06); las reclamaciones de la comunidad "hasta 30x" en las pilas completas de Blackwell + Dynamo son agregados direccionales sin una sola fuente primaria.
- GB300 NVL72 + Dynamo: hasta 50 veces el rendimiento MoE frente a Hopper (desarrollador.nvidia.com, sin fecha).
- Anclar de ahorro (compuesto interno, no un solo estudio de caso): $600-800K/year off a $2 millones de gastos anuales a un ALS constante.
- El valor de la operación de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad de la entidad.
- Transferencia de KV a través de NIXL: 20-80 ms para KV de 4K en 70B FP8.

```figure
prefill-decode-split
```

## Usalo

`code/main.py`Simula la distribución colocada frente a la distribución desglosada.

## Envío

Esta lección produce`outputs/skill-disaggregation-decider.md`- Dado el volumen de trabajo y el grupo, decide si se desagrega.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`¿A qué velocidad la desagregación supera la colocación?
2. Diseñar el pool de preempleo y el pool de decodificación para un servicio RAG con longitud del prefijo P99 8K, salida 300.
3. Dynamo vs llm-d: escoge uno para una tienda pura de Kubernetes sin preferencia de tiempo de ejecución de Python.
4. Computación de costo de transferencia de KV: 4K preempleo en 70B FP8 = ~ 500 MB KV. En RDMA 100 GB / s, transferencia = 5 ms. En TCP 10 GB / s = 50 ms. ¿Qué importa para su SLA?
5. ¿Cómo se comporta la desagregación con el MoE que activa a diferentes expertos por token?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Disaggregated serving | "split prefill/decode" | Separate GPU pools for each phase |
| NIXL | "NVIDIA transport" | Dynamo's inter-node KV transfer (RDMA/TCP) |
| NVIDIA Dynamo | "the orchestrator" | Stack-above coordinator for vLLM/SGLang/TRT-LLM |
| llm-d | "Kubernetes native" | Red Hat + AWS K8s disaggregated stack |
| Planner Profiler | "Dynamo auto-config" | Measures workload, configures pool ratios |
| SLA Planner | "Dynamo policy" | Auto-rate-matches prefill:decode to meet SLOs |
| `packDomain: rack` | "llm-d topology" | Pack prefill+decode on same rack for fast KV |
| UCCL | "unified collective" | llm-d 0.5 networking layer for scale-to-zero |
| MoE expert routing | "expert per token" | DeepSeek-V3 pattern; disaggregation helps |

## Leer más

- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/)
- [TensorRT-LLM Disaggregated Serving blog](https://nvidia.github.io/TensorRT-LLM/blogs/tech_blog/blog5_Disaggregated_Serving_in_TensorRT-LLM.html)
- [llm-d GitHub](https://github.com/llm-d/llm-d)
- [llm-d 0.5 release notes](https://github.com/llm-d/llm-d/releases)
