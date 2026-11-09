# Servicio de LLM multi-regional y localización de caché de KV

> El equilibrio de carga de round-robin es activamente perjudicial para la inferencia LLM almacenada en caché. Una solicitud que no aterriza en el nodo que tiene su prefijo paga el costo de preempleo completo  aproximadamente 800 ms en P50 en un prompt largo versus ~ 80 ms con un caché hit. En 2026 el patrón de producción es un router consciente de la caché (vLLM Router en Rust, llm-d router) que consume eventos de caché KV y rutas en coincidencia prefijo-hash. La investigación reciente (GORGO) hace que la latencia de la red transregional sea un término explícito en el objetivo de enrutamiento. Las ofertas comerciales de "inflación transregional" (inflación transregional Bedrock, puertas de entrada multi-cluster GKE) tratan la inferencia como opaca  manejan la disponibilidad, no TTFT. JPMorgan y Mayo Clinic realizaron un fallo de la primera en noviembre de 2024 en 22 minutos. La realidad de DR: el 32% de los fracasos de LLM DR se deben a que los equipos hicieron copias de seguridad de pesos pero olvidaron archivos de tokenizer o configuraciones de cuantización.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy prefix-cache-aware router simulator)
**Prerequisites:** Phase 17 · 04 (vLLM Serving), Phase 17 · 06 (SGLang RadixAttention)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Explicar por qué las interrupciones de equilibrio de carga en round-robin almacenaron en caché la inferencia y cuantificar la penalidad TTFT.
- Diagrama un router consciente de la caché: entradas (eventos de caché KV), algoritmo (combinación de prefijo-hash), tie-breaker (utilización de GPU).
- Nombre el controlador de falla del 32% de DR para LLMs (archivos de tokenización / configuraciones de cuantización faltantes) y indique una lista de verificación de DR de tres archivos.
- Distinguir las ofertas comerciales transregionales (Bedrock CRI, GKE Multi-Cluster Gateway) de las de enrutamiento consciente de KV.

## El problema

Su servicio se ejecuta en US-East-1, US-West-2, y EU-West-1. pone un ALB delante con round-robin. Prefijo caché tasa de impacto en la producción cae al 8%. TTFT P50 triplica. sus registros vLLM muestran que cada solicitud está pagando el costo de preempleo completo.

La redonda es óptima para los servicios sin estado. La inferencia LLM es estatalizada por diseño.

Separadamente, su equipo tiene un plan DR. Usted hace una copia de seguridad de los pesos del modelo para S3 cross-región. Un apagón regional golpea; usted intenta fallar; la réplica se niega a iniciar. Se olvidó tokenizer.json, la configuración de cuantificación, y la configuración de escala RoPE estaban en un balde separado que no sincronizó.

El servicio de LLM multi-regional es un problema de caché, un problema de enrutamiento y un problema de higiene DR  no un problema de balance de carga.

## El concepto

### Enrutamiento consciente de la caché

El router hacha el prefijo (digamos, los primeros 512 tokens); le pregunta a cada réplica "¿tienes este prefijo almacenado en caché?". Las réplicas publican eventos de caché KV en un canal pub/sub mientras asignan y despejan bloques.

**vLLM Router**(Rust, 2026 producción-estaca): suscribirse a `kv.cache.block_added`eventos, mantiene un índice de réplica → prefijo-hash, rutas con $O(1)$Se cae hasta la menor profundidad de cola cuando no hay coincidencia.

**llm-d router**: mismo patrón, nativo de Kubernetes. Publica eventos a través de la API ControlPlane.

**SGLang RadixAttention**(Fase 17 · 06) es el equivalente intra-replica.

### Números

TTFT P50 en una señal de 2K, Llama 3.3 70B FP8, H100:
- El caché se encuentra en el mismo lugar (replica, prefijo residente): ~80 ms.
- Falta de almacenamiento en caché (preenchimiento en frío): ~ 800 ms.

Si su router alcanza el 60-80% de la caché de prefijos en réplicas, se aproxima el rendimiento de una réplica única a capacidad de N-replica. Si alcanza el 10%, se aproxima la escalación ingenua.

### La región transversal tiene una nueva restricción  latencia de la red

RTT interregional:
- US-East-1  US-West-2: ~65 ms.
- Estados Unidos-este-1  Europa-oeste-1: ~75 ms.
- Estados Unidos-este-1  ap-sureste-1: ~ 220 ms.

Si el enrutamiento lleva una solicitud de us-est-1 a un prefijo caliente en ap-southeast-1, el prefill guardado (800 → 80 ms, por lo que 720 ms) se reduce a aproximadamente 500 ms una vez que se paga el ~220 ms RTT, y el margen desaparece si la región remota hace cola a la solicitud o ya ha desalojado el prefijo. GORGO (2026 investigación) hace que esto explícito  minimizar `prefill_time + network_latency`A menudo la respuesta es mantener el enrutamiento regional excepto en prefijos masivos de varios MB donde prefill domina.

### La "inflación transregional" comercial no ayuda aquí

La inferencia transregional de AWS Bedrock envía automáticamente las solicitudes a otras regiones durante la presión de capacidad. Optimiza la disponibilidad, no TTFT, y trata la inferencia como opaca.

Aún necesitas un router consciente de la caché de la capa de la aplicación incluso cuando usas estos manejan el caso "US-East-1 está en llamas" el routing consciente de la caché maneja el caso TTFT

### Higiene DR  el problema de los archivos faltantes del 32%

Estadísticas de 2026 citadas ampliamente: el 32% de los fracasos de LLM DR ocurren porque los equipos respaldaron los pesos pero olvidaron:

- `tokenizer.json`o `tokenizer.model`
- Configuración de cuantificación (`quantize_config.json`, escalas AWQ, puntos cero GPTQ)
- Configuraciones específicas del modelo (escalado RoPE, máscaras de atención, plantillas de chat)
- Configuración del motor (`vllm_config.yaml`, muestreo por defecto, manifiestos de adaptador LoRA)

La solución es un manifiesto de DR mínimo de tres archivos:

1. Todos los archivos bajo el modelo HF repo (pesos + configuraciones + tokenizer).
2. Configuración de servicio específica del motor.
3. Manifiesto de despliegue (K8s YAML, archivo de Docker, bloqueo de dependencia).

Además, ejecuta un ejercicio DR trimestral. El ejercicio JPMorgan US-East-1 alcanzó 22 minutos de recuperación en noviembre de 2024 sólo porque el libro de jugadas fue ensayado.

### La residencia de datos es ortogonal

Si su router de caché envía una solicitud de origen de París a us-east-1 para un ajuste de prefijos, ha violado el GDPR independientemente de la ganancia de TTFT.

### Números que debes recordar

- Cache hit vs miss TTFT gap: ~ 10x (80 ms vs 800 ms en 2K prompt).
- RTT interregional entre Estados Unidos y la UE: ~75 ms.
- Fallo de DR: 32% fallo de configuración de tokenizer/quant.
- JPMorgan us-east-1 falloover noviembre 2024: 22 minutos (30 minutos SLA).

```figure
cache-aware-router
```

## Usalo

`code/main.py`simula tres estrategias de enrutamiento (round-robin, regional consciente de caché, global consciente de caché) en una carga de trabajo multi-región.

## Envío

Esta lección produce`outputs/skill-multi-region-router.md`- Dadas las regiones, las restricciones de residencia y el SLA, diseña un plan de ruta.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`¿A qué velocidad supera el enrutamiento transregional el enrutamiento local, dado el RTT de 75 ms?
2. Su tasa de caché de impacto cae del 70% al 12%. Diagnóstico tres posibles causas y los observables que confirmarían cada uno.
3. Diseñar un manifiesto DR para un modelo cuantificado AWQ 70B servidos en vLLM con 5 adaptadores LoRA.
4. Argumentar si la inferencia transregional de Bedrock es "suficiente" para una fintech con estrictas SLOs TTFT. Citar comportamientos específicos.
5. Una solicitud de origen de París coincide con un prefijo en el este de Estados Unidos. ¿Lo envía?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Cache-aware routing | "smart LB" | Route on prefix-hash match to KV-cache-holding replica |
| KV-cache events | "cache pub-sub" | Replicas publish block add/evict; router indexes |
| Prefix hash | "cache key" | Hash of first N tokens used as router lookup |
| GORGO | "cross-region routing research" | arXiv 2602.11688; network latency as explicit term |
| Cross-region inference | "Bedrock CRI" | AWS product; availability failover, not TTFT awareness |
| DR manifest | "the backup list" | Every file needed to restore — not just weights |
| Data residency | "GDPR boundary" | Legal constraint on which region sees user data |
| RTT | "round-trip time" | Network latency; 75 ms US-EU, 220 ms US-APAC |
| LLM-aware LB | "cache-hit LB" | Cache-aware router as a product category |

## Leer más

- [BentoML — Multi-cloud and cross-region inference](https://bentoml.com/llm/infrastructure-and-operations/multi-cloud-and-cross-region-inference)
- [arXiv — GORGO (2602.11688)](https://arxiv.org/html/2602.11688v1) reutilización de la caché KV transregional con plazo de latencia de la red.
- [TianPan — Multi-Region LLM Serving Cache Locality](https://tianpan.co/blog/2026-04-17-multi-region-llm-serving-data-residency-routing)
- [AWS Bedrock Cross-Region Inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html) Documentación de fallas de disponibilidad.
- [vLLM Production Stack Router](https://github.com/vllm-project/production-stack) Fuente de router consciente de la caché.
