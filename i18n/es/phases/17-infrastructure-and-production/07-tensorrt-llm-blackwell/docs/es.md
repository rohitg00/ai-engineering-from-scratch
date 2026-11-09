# Compilación de inferencias especializadas en hardware  FP8 y NVFP4 en Blackwell

> La compilación de inferencias especializada en hardware comercializa la portabilidad para el rendimiento, y TensorRT-LLM  NVIDIA-sólo, sintonizado para Blackwell  es el ejemplo más claro del comercio que da frutos.$0.012 per million tokens on a 120B model in Q1-Q2 2026, against $0,09/M en H100 + VLLM  una brecha económica de 7 veces. La pila combina dos formatos de puntos flotantes con dos técnicas de servicio: FP8 se mantiene crítico para los kernels de caché y atención KV porque tiene el rango dinámico que necesitan; NVFP4 (4 bits de microscalación) maneja pesos y activaciones; predicción de multi-token (MTP) y preempleo / decodificación desagregada añaden otros 2-3x en la parte superior. El modelo de soporte de día-0 carga directamente los pesos de FP4 sin conversión post-entrenamiento. La captura para los equipos de ingeniería de 2026: TRT-LLM es de código abierto pero específico de NVIDIA  CUDA- y Blackwell-especializado  así que la adopción de la trata de la portabilidad para el rendimiento. Ejecutar las matemáticas de su mezcla de modelos y hardware antes de comprometerse.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy FP8/NVFP4 memory and cost calculator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 10 · 13 (Quantization)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Explica por qué FP8 sigue siendo fundamental para la memoria caché y la atención de KV incluso cuando los pesos están en NVFP4.
- Calcule la huella de HBM de un modelo fronterizo bajo BF16, FP8 y NVFP4 y razone de dónde provienen los ahorros.
- Nombre de las características específicas de Blackwell TRT-LLM exploits (día-0 FP4, MTP, servicio desagregado, primitivos todo a todo).
- Decida cuándo el bloqueo NVIDIA de TRT-LLM vale la diferencia de costo 7x frente a VLLM en Hopper.

## El problema

La frontera de la economía de inferencia en 2026 es "cuántos tokens por dólar". La respuesta depende de cuatro opciones apiladas: generación de hardware (Hopper H100/H200 vs Blackwell B200/GB200), precisión (BF16 → FP8 → NVFP4), motor de servicio (vLLM vs SGLang vs TRT-LLM), y orquestación (plain vs disaggregated vs Dynamo).

En Hopper con VLLM, un MoE 120B corre a ~$0.09 per million tokens. On Blackwell with TRT-LLM + Dynamo, the same model runs at ~$Algunos de esos puntos son hardware (Blackwell es 11-15 veces por CPU LLM en comparación con Hopper). Algunos son la pila: pesos FP4, borrador MTP, preempleo / decodificación desagregado y NVLink 5 todo-a-todo para comunicación de expertos de MoE.

No se puede replicar esto fuera de la pila de NVIDIA. Ese es el compromiso  portabilidad para la economía. Comprender qué opciones de pila dan qué parte de la brecha es el punto de esta lección.

## El concepto

### ¿Por qué FP8 sigue siendo el suelo para KV cache

Un error común en 2026: asumiendo que NVFP4 se aplica en todas partes. No lo hace. El caché KV necesita FP8 (8 bits flotantes) porque almacena claves de atención y valores que abarcan un amplio rango dinámico. Cuantificar KV a FP4 causa una pérdida de precisión catastrófica  la cola de la distribución cae y las puntuaciones de atención se derrumban.

NVFP4 (2025-2026) se aplica a pesas y activaciones. Microscalación: cada bloque de pesas tiene su propio factor de escala para que los bloques pequeños puedan abarcar diferentes rangos dinámicos sin pérdida de escala por tensor. Para las activaciones, FP4 se mantiene porque las activaciones son de pequeño rango dentro de una capa.

La configuración típica de Blackwell:

- Peso: NVFP4 (4 bits de microscalación).
- Actividades: NVFP4.
- El caché de KV: FP8.
- acumulador de atención: FP32 (estabilidad de máxima suavidad).

### Las primitivas específicas de Blackwell utilizan TRT-LLM

- **Day-0 FP4 weights**Los proveedores de modelos envían directamente pesos FP4; cargas TRT-LLM sin conversión post-entrenamiento.
- **Multi-token prediction (MTP)**: la misma idea que EAGLE (fase 17 · 05) pero integrada en la estructura TRT-LLM.
- **Disaggregated serving**El proceso de procesamiento de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de
- **All-to-all communication primitives**NVLink 5 redujo la latencia de comunicación experta de MoE en 3x frente a Hopper.
- **NVFP4 + MXFP8 microscaling**: manipulación acelerada de factor de escala en los núcleos tensores Blackwell.

### Los números que debes memorizar

- HGX B200 a $ 0.02 / M tokens en GPT-OSS-120B a través de TRT-LLM.
- GB200 NVL72 a $ 0,012/M tokens a través de Dynamo (orquestación TRT-LLM).
- H100 + vLLM ≈ $ 0.09 / M tokens en carga de trabajo comparable.
- El aumento de la capacidad de producción en tres meses de actualizaciones del TRT-LLM (2026) es de 2,8 veces mayor.
- 11-15 veces por CPU LLM de rendimiento, Blackwell vs Hopper.
- MLPerf Inference v6.0 (abril 2026): Blackwell domina todas las tareas presentadas.

### Cuánto cuesta en realidad el FP4 en calidad

NVFP4 es agresivo. En cargas de trabajo pesadas de razonamiento (cadena de pensamiento, matemáticas, código-gen con contexto largo), los pesos de FP4 se degradan visiblemente. La calibración por bloque mitigará pero no eliminará. Los modelos de razonamiento de los equipos a menudo utilizan pesos de FP8 + activaciones de FP4 como compromiso, o se adhieren a H200 con FP8 en todo.

La regla: siempre valida la calidad de la tarea en su conjunto de evaluaciones antes de comprometerse con pesos NVFP4.

### ¿Por qué esta es una decisión de bloqueo de NVIDIA

TRT-LLM es un kernel de código cerrado. Los modelos deben compilarse para un SKU específico de GPU. No hay AMD, no hay Intel, no hay ARM. Si su estrategia infra-vendor es multivendor, TRT-LLM es un no-starter para el nivel TRT-LLM-servido.

### 2026 receta práctica

Para una factura de inferencia anual de $100M +, ejecutar en Hopper + vLLM deja 7-10x en la mesa. Migra las cargas de trabajo dominantes en costos a Blackwell + TRT-LLM + Dynamo. Mantenga el nivel de experimentación en H100 + vLLM para la velocidad de iteración del modelo. Valida la calidad en cada modelo convertido en NVFP4 antes de la producción.

### El bono de desagregación

La porción desagregada de TRT-LLM (pools separados de preempleo y decodificación) se cubre en profundidad en la fase 17 · 20. En Blackwell, los multiplicadores se apilan: pesos FP4 × aceleramiento MTP × colocación desagregada × enrutamiento consciente de caché.

```figure
pipeline-parallel
```

## Usalo

`code/main.py`Computa huella HBM, decodificación de rendimiento (regimen de memoria limitada) y $/M-tokens para un modelo en tres pilas: H100 + BF16 + vLLM, H100 + FP8 + vLLM, B200 + NVFP4/FP8 + TRT-LLM. ejecuta para ver el efecto de composición y la proporción de la brecha que cada cambio contribuye.

## Envío

Esta lección produce`outputs/skill-trtllm-blackwell-advisor.md`. Dada la carga de trabajo, el tamaño del modelo y el volumen anual de tokens, decide si la pila Blackwell + TRT-LLM vale la pena el bloqueo NVIDIA.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`En un MoE 120B con parámetros activos del 30%, calcular el rendimiento de decodificación limitado de ancho de banda de memoria en H100 BF16, H100 FP8 y B200 NVFP4/FP8. ¿De dónde viene el salto más grande?
2. Un cliente gasta 2 millones de dólares al año en H100 + vLLM. ¿Cuál es el número de GPUs Blackwell que necesitan comprar para amortizar una migración a TRT-LLM en 12 meses, dada la brecha económica de 7x?
3. Se ve una caída de precisión de 3 puntos en MATH después de la conversión de peso NVFP4. Nombre dos vías de recuperación: una de calidad primero (mantener los pesos FP8) y otra de costo primero (calibrar con datos en el dominio).
4. Lea los resultados de la inferencia de MLPerf v6.0. ¿Cuál tarea tiene la menor brecha de Blackwell-over-Hopper, y por qué?
5. Computa el HBM necesario para un modelo 405B en pesos NVFP4 + FP8 KV caché en contexto 128k. ¿Se ajusta en un solo nodo GB200 NVL72?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| FP8 | "eight-bit float" | 8-bit floating point; used for KV cache and attention due to dynamic range |
| NVFP4 | "four-bit micro" | NVIDIA's 4-bit microscaling FP format; weights and activations on Blackwell |
| MXFP8 | "MX eight" | Microscaling FP8 variant; hardware-accelerated on Blackwell Tensor Cores |
| Day-0 FP4 | "ship FP4 weights" | Model providers release weights already in FP4; no post-train conversion step |
| MTP | "multi-token prediction" | TRT-LLM's integrated speculative-decoding draft (Phase 17 · 05) |
| Disaggregated serving | "split prefill/decode" | Prefill and decode on separate GPU pools; KV transferred over NVLink/IB |
| All-to-all | "MoE expert comm" | Communication pattern routing tokens to expert GPUs; NVLink 5 cuts 3x |
| InferenceX | "SemiAnalysis inference bench" | The 2026 industry-accepted cost-per-token benchmark |

## Leer más

- [NVIDIA — Blackwell Ultra MLPerf Inference v6.0](https://developer.nvidia.com/blog/nvidia-blackwell-ultra-sets-new-inference-records-in-mlperf-debut/) Abril 2026 resultados de la MLPerf.
- [NVIDIA — MoE Inference on Blackwell](https://developer.nvidia.com/blog/delivering-massive-performance-leaps-for-mixture-of-experts-inference-on-nvidia-blackwell/) NVLink 5 todo-a-todo y núcleos de MoE.
- [TensorRT-LLM Overview](https://nvidia.github.io/TensorRT-LLM/overview.html) documentación oficial del motor.
- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/) Orquestación desglosada por encima de TRT-LLM.
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) el conjunto de referencia que publica números de Blackwell.
