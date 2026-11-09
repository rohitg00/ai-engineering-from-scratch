# Mitigación de los comienzos en frío para los LLM sin servidor

> Un modelo grande tarda minutos en pasar de frío a servicio: un modelo 70B en un nodo fresco necesita aproximadamente 3-8 minutos antes del primer token. En un mundo sin servidores, eso no es un calentamiento, es un apagón. Las mitigaciones operan en cinco capas: imágenes de nodos pre-seeded (Bottlerocket en AWS, arco de doble volumen), transmisión de modelos (NVIDIA Run:ai Model Streamer, nativo en vLLM), instantáneas de memoria de GPU (puntos de control módiles, hasta 10 veces más rápido reinicio), piscinas calientes (`min_workers=1`), carga en niveles (NVMe→DRAM→HBM de ServerlessLLM, reducción de latencia 10-200x), más un patrón sexto de bonificación, migración en vivo que mueve tokens de entrada (KB) en lugar de KV caché (GB).

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy cold-start path simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 03 (GPU Autoscaling)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Enumere las cinco capas de mitigación de arranque en frío y nombre una herramienta o patrón en cada capa.
- Calcule el tiempo total de arranque en frío como suma de (provisión de nodos) + (peso descarga) + (peso carga en HBM) + (motor init) para un modelo 70B.
- Explica por qué la migración en vivo transfiere tokens de entrada (KB) y no KV cache (GB) y cuál es la penalización (recomputado).
- Nombre del trade-off de la piscina caliente (pagar por la GPU ociosa o aceptar cola de arranque en frío) y el umbral de SLA en el que `min_workers > 0`se hace obligatorio.

## El problema

Tu punto final sin servidor de LLM se reduce a cero durante la noche a las 8 de la mañana, el tráfico aumenta.

1. Karpenter proporciona un nodo de GPU: 45-60s.
2. El contenedor saca una imagen de 30 GB con pesos: 120-300s.
3. El motor carga pesos en HBM: 45-120s dependiendo del tamaño del modelo y la velocidad de almacenamiento.
4. vLLM o TRT-LLM inicializa los gráficos CUDA, el caché KV, el tokenizer: 10-30s.

Total: 220-510s (aproximadamente 3-8 minutos) antes de que un token regrese. Su SLA es 2s.`min_workers=1`Si tu servicio tiene 5 productos cada uno con una réplica caliente, eso es 5 × 24 × 30 = 3.600 horas de GPU / mes, ya sea que un solo usuario llamó o no.

La mitigación de arranque en frío es cómo mantener la economía sin servidores mientras se aproxima a la latencia de siempre en marcha.

## El concepto

### Capas 1  imágenes de nodos pre-semeados (Bottlerocket)

En AWS, la arquitectura de doble volumen de Bottlerocket separa el sistema operativo de los datos.`EC2NodeClass`. Los nuevos nodos se arrancan con pesos ya en NVMe local  paso 2 y parte de 3 desaparecen. Funciona con Karpenter de forma nativa.

Equivalente en GCP: imágenes personalizadas de VM con capas de contenedores precoces. En Azure: instantáneas de disco administradas con el mismo patrón.

### Capas 2  modelo de transmisión (Run:ai Model Streamer)

En lugar de cargar el archivo completo antes de responder a la primera solicitud, transmite pesos en la memoria de GPU capa por capa y comience el procesamiento tan pronto como el primer bloque de transformador sea residente. El NVIDIA Run:ai Model Streamer se envía nativo en vLLM 2026. Funciona con S3, GCS y NVMe local. Cortará el tiempo de carga de peso aproximadamente a la mitad para los modelos grandes superponiéndose I / O con la configuración de computación.

### Capas 3  Snapshots de memoria de GPU (Modal)

Modal toma un punto de control del estado de la GPU (pesos, gráficos CUDA, región de caché KV) después de la primera carga. Los reinicios posteriores se deserializan directamente en HBM  10 veces más rápido que la reinicialización. Esta es la cosa más cercana a "iniciar una GPU caliente en 2 segundos".

### Capas 4  piscinas calientes (min_trabajadores=1)

La más simple de las medidas: mantener una réplica siempre lista. El costo es la tasa por hora de una GPU 24x7.$0.85-$El límite de SLA para las piscinas calientes es típicamente TTFT P99 < 60 en un modelo 70B+.

### Capas 5  Carga en capas (LLM sin servidor)

ServerlessLLM trata el almacenamiento como una jerarquía: NVMe (rápido pero grande), DRAM (medio pero nivelado), HBM (pequeño pero instantáneo). Los pesos se precargan a DRAM; carga a pedido en HBM. El papel informa una reducción de latencia de 10-200 veces en cargas frías en comparación con navías de disco a HBM. La adopción de producción es temprana pero existen integraciones con vLLM.

### Capas 6  Migración en vivo (patrón de bonificación)

Cuando un nodo se vuelve indisponible (evacución de puntos, desagüe de nodos), el patrón tradicional es iniciar en frío otra réplica y desagüe la cola de solicitud. La migración en vivo mueve los tokens de entrada (kilobytes) a un destino que tiene el modelo cargado y recalcula el caché KV en el destino. La recomputada es más barata que transferir GB de caché KV a través de la red. Aplicable a implementaciones desagregadas.

### Las matemáticas de la piscina caliente

Para un servicio con P99 TTFT SLA de 2s, la pregunta no es "polar caliente sí/no" sino "cuántas réplicas calientes, y qué caminos las obtienen".

- Rutas interactivas de alto valor (chat en vivo, agente de voz): `min_workers=1-2`¿ Qué ?
- Rutas de lote de fondo (clasificación nocturna): escala a cero aceptada, 5-10 minutos de inicio en frío tolerada.
- Nivel de primera categoría: `min_workers`por inquilino con capacidad específica.

### Medir antes de optimizar

Anatomía de arranque en frío para un modelo 70B en un nodo fresco (ilustrativo):

| Phase | Time | Mitigation |
|-------|------|-----------|
| Node provision | 50s | Bottlerocket + pre-seeded image, warm pool |
| Image pull | 180s | Pre-seeded data volume (eliminate) |
| Weights to HBM | 75s | Model streamer (halve); GPU snapshot (eliminate) |
| Engine init | 20s | Persistent CUDA graph cache |
| First forward | 3s | Min inherent latency |
| **Total cold** | **328s** | |
| **Total with mitigations** | **~15s** | 22x reduction |

### Números que debes recordar

- Inicio en frío modal: 2-4 segundos (con instantáneas de GPU).
- Comienza en frío por defecto de baseta: 5 a 10 segundos; subsegundo con precalentamiento.
- Inicio en frío de 70B crudo: 3-8 minutos.
- Run:ai Modelo de Streamer: ~ 2x velocidad de carga por peso.
- Carga en niveles de ServerlessLLM: reducción de latencia 10-200 veces (números de papel).

```figure
cold-start-pipeline
```

## Usalo

`code/main.py`El modelo de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de la base de datos de datos de la base de datos de datos de la base de datos de datos de la base de datos de datos de la base de datos de datos de la base de datos de datos de la base de datos de datos de la base de datos de datos de la base de datos de datos de datos de la base de datos de datos de datos de la base de datos de datos de datos de datos de la base de datos de datos de datos de datos de datos de datos de datos de la base de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de la base de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de

## Envío

Esta lección produce`outputs/skill-cold-start-planner.md`. Dado el SLA, el tamaño del modelo y la forma del tráfico, elige qué mitigations apilar.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`. Calcular la tasa de compensación de las solicitudes por encima de la cual una réplica caliente es más barata que el pago del impuesto de inicio en frío mediante caídas adicionales de las solicitudes en SLO.
2. Se despliega un modelo 13B con P99 TTFT SLA de 3s. Elige la pila de mitigación mínima (las capas más bajas) que lo logre.
3. El pre-seeding de botellas elimina la atracción de la imagen, pero los pesos aún se cargan desde la instantánea a HBM.
4. Su proveedor sin servidor ofrece instantáneas de GPU (Modal) y su equipo se niega porque "las instantáneas filtran PII".
5. Diseñar una política de piscina caliente en niveles: ¿cuántas réplicas calientes para usuarios pagados, usuarios de prueba y cargas de trabajo de lote? Muestre las matemáticas.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Cold start | "the big pause" | Time from request to first token on a fresh replica |
| Warm pool | "always-on minimum" | `min_workers >= 1` to keep at least one replica ready |
| Pre-seeded image | "baked AMI" | Node image with container weights pre-resident |
| Bottlerocket | "AWS node OS" | AWS container-optimized OS with dual-volume snapshot support |
| Model streamer | "streaming load" | Overlap weights I/O with compute setup |
| GPU snapshot | "checkpoint to HBM" | Serialize post-load GPU state; deserialize on restart |
| Tiered loading | "NVMe + DRAM + HBM" | Hierarchy of storage tiers; load on demand |
| Live migration | "move tokens" | Transfer input (KB), recompute KV on destination |
| `min_workers` | "warm replicas" | Serverless minimum keep-alive count |
| Scale-to-zero | "full serverless" | No cost when idle; accept full cold-start tax |

## Leer más

- [Modal — Cold start performance](https://modal.com/docs/guide/cold-start) Los puntos de referencia publicados de Modal y la arquitectura de los puntos de control.
- [AWS Bottlerocket](https://github.com/bottlerocket-os/bottlerocket) Modelo de instantánea de volumen de datos pre-seeded.
- [NVIDIA Run:ai Model Streamer](https://github.com/run-ai/runai-model-streamer) Peso sobrepeso carga con configuración de cálculo.
- [Baseten — Cold starts](https://docs.baseten.co/deployment/autoscaling/cold-starts) Manual de juego de precalentamiento.
- [ServerlessLLM paper (USENIX OSDI'24)](https://www.usenix.org/conference/osdi24/presentation/fu) Diseño de carga en niveles.
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) migración en vivo para desplegamientos desglosados.
