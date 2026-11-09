# Producción de servicio de pila  descarga de KV y enrutamiento de caché

> Una producción que sirve a los cables de pila de enrutador, motores y observabilidad en una implementación Kubernetes  y trata el caché KV como un recurso que puede dejar la GPU. La descarga de KV extrae el caché de KV de la memoria de la GPU y lo reutiliza en consultas y motores (DRAM de CPU, luego disco / Ceph). La pila de producción de vLLM es la implementación de referencia; LMCache es la capa de descarga. El conector de descarga de KV 0.11.0 vLLM (enero 2026) hace que este sea asincrónico y se pueda conectar a través de la API del conector (v0.9.0+). El camino de descarga generalmente está oculto del camino de la solicitud, aunque las fallas de caché y las promociones pueden agregar latencia de extremo a extremo. LMCache es valioso incluso sin prefijos compartidos  cuando una GPU se queda sin ranuras de KV, las solicitudes preemptadas se pueden restaurar desde la CPU en lugar de recomputar prefill. Se publicaron puntos de referencia en 16x H100 (80 GB HBM) en 4 a3-highgpu-4g: cuando la caché KV supera la HBM, tanto la descarga de CPU nativa como la LMCache mejoran sustancialmente el rendimiento; en una huella de KV baja, todas las configuraciones coinciden con la línea de base con un pequeño gasto aéreo.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy KV-spill simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 06 (SGLang/RadixAttention)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Diagrama de las capas de producción de vLLM: enrutador, motores, descarga de KV, observabilidad.
- Explica la API de conector de descarga de KV (v0.9.0+) y cómo el camino asincrónico 0.11.0 oculta la latencia de descarga.
- Cuantificar cuándo LMCache CPU-DRAM ayuda (KV > HBM) vs añade gastos generales (KV lo suficientemente pequeño como para caber en HBM).
- Escoge entre la descarga de CPU de vLLM nativa y el conector LMCache dado las restricciones de implementación.

## El problema

Su servicio vLLM muestra GPUs en 100% HBM con eventos de preempción cada vez que la concurrencia sube. Las solicitudes se desalojan, se requieren y se vuelve a preencher el mismo aviso de 2K-token cuatro veces en un minuto.

Añadir más GPUs cuesta linealmente. Añadir más HBM no es posible. Pero CPU DRAM es barato  un socket tiene 512 GB + en órdenes de latencia de magnitud peores que HBM pero bien para "temporalmente caliente" KV caché.

LMCache extrae la caché KV a la CPU DRAM para que las solicitudes preemptadas se recuperen rápidamente, y los prefijos repetidos en los motores comparten la caché sin que cada motor se vuelva a llenar.

## El concepto

### VLLM - pila de producción

`github.com/vllm-project/production-stack`es el despliegue de referencia Kubernetes:

- **Router** Cache-consciente (fase 17 · 11). Consume eventos de KV.
- **Engines** Trabajadores de VLLM. Uno por GPU o por grupo TP/PP.
- **KV cache offload** Despliegue de LMCache o conector nativo.
- **Observability** El raspado de Prometheus, los tableros de grafana, los rastros de OTel.
- **Control plane** Descubrimiento de servicios, configuración, actualizaciones de rodaje.

Se envió como operador de Helm Chart +.

### La API del conector de descarga de KV (v0.9.0+)

vLLM 0.9.0 introdujo una API de conector para los backends de caché KV enchufables. Su motor descarga los bloques al conector; el conector los almacena (RAM, disco, almacenamiento de objetos, LMCache).

vLLM 0.11.0 (enero 2026) añade una ruta de descarga asíncrona  descarga puede ocurrir en el fondo para que el motor no se bloquee en el caso común. La latencia de extremo a extremo y el rendimiento todavía dependen de la forma de la carga de trabajo, la tasa de impacto de la caché KV y la presión del sistema; las propias notas de vLLM indican que la descarga del núcleo personalizado puede degradar el rendimiento a bajas tasas de impacto y que la programación asíncrona ha conocido problemas de interacción con la descodificación especulativa.

### Descarga de CPU nativa vs LMCache

**Native vLLM CPU offload**El motor local almacena bloques de KV en la memoria RAM del host. Rápido para implementar, salto de red cero. No cruza motores.

**LMCache connector**Los bloques son accesibles para cualquier motor. Se publican 16 puntos de referencia H100.

Seleccione nativo cuando un solo motor tiene presión HBM. Seleccione LMCache cuando varios motores comparten prefijos (RAG con instrucciones de sistema comunes, multi-tenant con plantillas compartidas).

### Comportamiento de referencia

El H100 16x (HBM de 80 GB) distribuido en 4 ensayos a3-highgpu-4g:

- Baja huella de KV (promptos cortos, baja concurrencia): todas las configuraciones coinciden con la línea de base, LMCache añade ~ 3-5% de gastos generales.
- Moderada huella: LMCache comienza a ayudar en el reutilización de prefijos en los motores.
- KV supera HBM: la descarga de CPU nativa y LMCache mejoran sustancialmente el rendimiento; LMCache obtiene mayor ganancia debido al intercambio entre motores.

### Cuando el LMCache es decisivo

- Servicio multi-arrendatario donde las instrucciones del sistema se comparten entre los inquilinos.
- RAG donde los fragmentos de documentos se repiten en las consultas.
- Variantes de ajuste fino (LoRA) en la misma base donde la reutilización del modelo base KV reduce el trabajo redundante.
- Cargas de trabajo pesadas de preempción: restaurar desde la CPU más barato que volver a precargar.

### Cuando NO habilitar

- La presión de la HBM pequeña  se paga el gasto general sin beneficios.
- Contexto corto (tokens < 1K)  tiempo de transferencia > re-pre-reemplazar.
- Carga de trabajo de un solo inquilino de una sola vez  no se reutiliza para capturar.

### Integración con servicio desglosado

Fase 17 · 17 porción desagregada + compuestos LMCache: KV transfiere de prefill pool a decodificar pool land en LMCache si no se utiliza; consultas posteriores se retiran de LMCache. Fase 17 · 11 router consciente de caché puede enrutarse al motor cuyo local O LMCache-compartido caché coincide.

### Números que debes recordar

- vLLM 0.9.0: API de conector enviado.
- vLLM 0.11.0 (Jan 2026): ruta de descarga asíncrona; el impacto de latencia de extremo a extremo depende de la carga de trabajo, la velocidad de impacto de KV y la presión del sistema (no es una garantía absoluta).
- 16x H100: LMCache ayuda cuando la huella de KV excede la HBM.
- Presión de HBM pequeña: 3-5% de gastos generales sin beneficio.

```figure
zero-sharding
```

## Usalo

`code/main.py`La información de la empresa de gestión de los sistemas de gestión de datos de los sistemas de gestión de datos de los sistemas de gestión de datos de los sistemas de gestión de datos de los sistemas de gestión de datos de los sistemas de gestión de datos de los sistemas de gestión de datos de los sistemas de gestión de datos de los sistemas de gestión de datos de los sistemas de gestión de datos de los sistemas de gestión de datos de los sistemas de gestión de datos de los sistemas de gestión de datos de los sistemas de gestión de datos de datos de los sistemas de gestión de datos de datos de los sistemas de gestión de datos de datos de los sistemas de gestión de datos de datos de los sistemas de gestión de datos de datos de datos de los sistemas de gestión de datos de datos de datos de los sistemas de gestión de datos de datos de datos de datos de los sistemas de gestión de datos de datos de datos de datos de datos de datos de los sistemas de gestión de datos de datos de datos de datos de datos de datos de datos de datos de los sistemas de gestión de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos

## Envío

Esta lección produce`outputs/skill-vllm-stack-decider.md`. Dada la forma de la carga de trabajo y la implementación de vLLM, decide nativo vs LMCache vs ninguno.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`¿A qué uso de HBM comienza a pagar LMCache?
2. Un inquilino comparte un sistema de 6K-token en 200 consultas/hora.
3. El servidor LMCache es un solo punto de falla. Diseñar la estrategia HA (replicas, retroceso a nativo).
4. LMCache almacena a Ceph en disco giratorio. ¿Para un KV de 4K con 70B FP8 (500 MB), cuál es el tiempo de lectura frente a la reposición?
5. Argumentar si la ruta asíncrona vLLM 0.11.0 es "libre" ¿Dónde se esconde la cabeza?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Production-stack | "the reference deployment" | vLLM's Kubernetes Helm chart + operator |
| Connector API | "KV backend interface" | vLLM 0.9.0+ pluggable KV store interface |
| Native CPU offload | "engine-local spill" | Store KV in host RAM of same engine |
| LMCache | "cluster KV cache" | Cross-engine KV cache server on CPU DRAM + disk |
| 0.11.0 async | "non-blocking offload" | Offload hidden behind engine stream |
| Preemption | "evict to make room" | KV cache shuffle when HBM full |
| Prefix reuse | "same system prompt" | Multiple queries share beginning; cache hit |
| Ceph tier | "disk tier" | Durable storage below DRAM in the cache hierarchy |

## Leer más

- [vLLM Blog — KV Offloading Connector (Jan 2026)](https://blog.vllm.ai/2026/01/08/kv-offloading-connector.html)
- [vLLM Production Stack GitHub](https://github.com/vllm-project/production-stack) Diagrama del casco + operador.
- [LMCache for Enterprise-Scale LLM Inference (arXiv:2510.09665)](https://arxiv.org/html/2510.09665v2)
- [LMCache GitHub](https://github.com/LMCache/LMCache) Implementación de los conectores.
- [vLLM 0.11.0 release notes](https://github.com/vllm-project/vllm/releases) Detalles de la trayectoria asincrónica.
