# Escalado de la producción  Colas, puntos de control, durabilidad

> Escalado de los sistemas multi-agentes a miles de ejecuciones simultáneas requiere **durable execution** colas de trabajo más puntos de control, por lo que cualquier trabajador puede reanudar cualquier carrera después de cualquier accidente, siempre que se manejen los contratos de arrendamiento, los efectos secundarios idempotentes y la reproducción determinista.`thread_id`(Pósgrados por defecto); los trabajadores que se estrelen liberan un contrato de arrendamiento y otro trabajador reanuda.**MegaAgent**(arXiv:2408.09955) ejecutó una cola de productores y consumidores por agente con tres estados (Idle / Processing / Response) y coordinación de dos capas (chat intragrupo + chat administrador intergrupo). **Fiber/async**Los filos permanecen inactivos 99% del tiempo esperando a tokens, las fibras producen cooperativamente en I/O. Contrapunto: "Scaling Agentic Software" de Ashpreet Bedi sostiene que **FastAPI + Postgres + nothing else**Hasta que la carga demuestre lo contrario  las arquitecturas simples van más allá de lo esperado. Esta lección construye un registro duradero de puntos de control, una cola de trabajo por agente con transiciones de estado, una demostración asíncrona contra hilo y aterriza la regla pragmática "iniciar simple".

**Type:** Learn + Build
**Languages:** Python (stdlib, `asyncio`, `sqlite3`), TypeScript
**Prerequisites:** Phase 16 · 09 (Parallel Swarm Networks), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## El problema

Un prototipo de sistema multi-agente funciona en un ordenador portátil con tres agentes en un ciclo de eventos en memoria.

- Los agentes a veces se ejecutan durante horas (longas investigaciones, espera humana en el ciclo).
- Los procesos de trabajo se estropean, reiniciar pierde estado.
- La carga máxima es de 10 veces el promedio; necesitas escalar horizontalmente.
- Los usuarios pagan por agente ejecutado; necesitas exactamente una semántica para cargar.

El bucle de eventos en memoria no hace ninguno de estos. Necesitas una capa de ejecución duradera debajo. Las opciones canónicas de 2026 son:

1. Un motor de flujo de trabajo con puntos de control (tiempo temporal, tiempo de ejecución de LangGraph).
2. Una cola de mensajes con una tienda estatal (Postgres + SQS/RabbitMQ).
3. En el caso de los agentes de megaagencia, el modelo de actores es el modelo de producción y consumo de megaagente.
4. FastAPI + Postgres laminado a mano (argumento de Bedi).

Esta lección construye una miniatura de cada uno.

## Concepto

### Ejecución duradera, el patrón

Un motor de ejecución duradera persiste en el estado completo del programa después de cada "paso" (superpaso, en el lenguaje de LangGraph).

```
worker crashes mid-step
  -> lease timeout
  -> another worker picks up the thread_id
  -> resumes from last checkpoint
  -> no duplicate side effects
```

Requisitos para que esto funcione:

- **Serializable state.**Todos los estados de agente deben ser persistentes.
- **Deterministic resume.**Dado el mismo estado y las mismas entradas, el agente produce las mismas acciones (o se desplaza a un oráculo determinista externo para las llamadas de LLM).
- **Idempotent side effects.**Las llamadas externas (llamadas a herramientas, pagos) deben ser idempotentes o utilizar una clave de deduplicación.

LangGraph escribe un punto de control después de cada superpaso; Temporal escribe después de cada actividad; Restate utiliza revistas de origen de eventos. Los tres implementan el mismo patrón.

### Un tiempo de ejecución de un punto de control por paso

El tiempo de ejecución de LangGraph es el ejemplo trabajado: cada agente tiene un `thread_id`El estado es un dictado tipado; cada superpaso escribe una fila en la tabla de los puestos de control.`interrupt()`El tiempo de ejecución persiste y libera al trabajador.

Este es el diseño de producción de referencia para abril de 2026.

### La cola de los agentes de MegaAgent

ArXiv:2408.09955 describe un experimento a escala: miles de agentes simultáneos en un grupo.

```
agent i:
  state ∈ {Idle, Processing, Response}
  in_queue   <- messages addressed to agent i
  out_queue  -> replies + side effects

coordinators:
  intra-group chat  (agents in the same group)
  inter-group admin chat  (high-level routing)
```

La coordinación de dos capas permite que la conversación intragrupo ocurra densamente mientras que la intergrupo se mantiene escasa  el patrón utilizado para mantener el costo lineal en miles de agentes.

### Async vs hilo por trabajo

LLM llamadas son I / O-ligado. Un hilo esperando para el siguiente token está ocioso el 99% del tiempo. los hilos cuestan ~ 1 MB de RAM cada; en 10,000 llamadas simultáneas, eso es 10 GB sólo para las pilas.

Fibras (Python `asyncio`, Go goroutines, Rust `tokio`En el caso de los programas de gestión de los servicios de gestión de datos, el sistema de gestión de datos de los servicios de gestión de datos de los servicios de gestión de datos de los servicios de gestión de datos de los servicios de gestión de datos de los servicios de gestión de datos de los servicios de gestión de datos de los servicios de gestión de datos de los servicios de gestión de datos de los servicios de gestión de datos de los servicios de gestión de datos de los servicios de gestión de datos de los servicios de gestión de datos de los servicios de gestión de datos de los servicios de gestión de datos de los servicios de gestión de datos de los servicios de gestión de datos de datos de los servicios de gestión de datos de datos de los servicios de gestión de datos de datos de los servicios de gestión de datos de datos de los servicios de gestión de datos de datos de los servicios de gestión de datos de datos de datos de los servicios de gestión de datos de datos de datos de los servicios de gestión de datos de datos de datos de los servicios de gestión de datos de datos de los servicios de datos de los servicios de gestión de datos de datos de datos de los servicios de datos de los servicios de datos de los servicios de datos de los servicios de datos de los servicios de datos de los servicios de los servicios de los servicios de los servicios de información de información de los servicios de los servicios de información de los servicios de los servicios de los servicios de los servicios de los servicios de los servicios de los servicios de los servicios de los servicios de los servicios de los servicios de los servicios de los servicios de los servicios de los servicios de los servicios de los servicios de los servicios de los servicios de los servicios de los servicios de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración de la administración

Excepción: el procesamiento posterior vinculado a la CPU (embedding, trucos de tokenizer) todavía necesita hilos o procesos. Separar su capa de entrada y salida de su capa de la CPU.

### El contrapunto de Bedi

"Scaling Agentic Software" (Ashpreet Bedi, 2026) sostiene que la mayoría de los equipos sobre-ingenieran antes de medir la carga.

- FastAPI + Postgres.
- Cada ejecución de agente es una fila; estado actualizado en el lugar con una concurrencia optimista.
- Trabajos de fondo a través de `pg_notify`o un simple trabajador de Celery.
- Retraje la política en el código de solicitud.

Para cargas de menos de ~ 100 ejecuciones simultáneas de agentes en tareas manejables, esto es a menudo todo lo que necesita.

La regla: adoptar marcos de ejecución duraderos cuando se encuentra un problema concreto que las arquitecturas simples no pueden resolver.

### Semántica de una vez exactamente

Para las carreras de agentes pagadas, se necesita "exactamente una vez efectiva" (al menos una entrega + consumidor idempotente).

- **Dedup key per run.**Incluya en cada llamada de efectos secundarios.
- **Outbox pattern.**Los efectos secundarios escriben primero a una tabla, luego un proceso separado los ejecuta.
- **Compensating transactions.**Cuando un efecto secundario tiene éxito pero su registro de registro falla, programe una compensación.

El impuesto de LLM es sólo que las llamadas de LLM son lentas; todo lo demás son sistemas distribuidos estándar.

### Despliegue del arco iris

El sistema de investigación multi-agente de Anthropic utiliza "despliegues de arco iris": varias versiones del agente runtime se ejecutan simultáneamente para que los agentes de larga duración no tengan que ser asesinados en cada implementación de código.

Esto es estándar para sistemas de estado de larga duración; la adaptación de 2026 es que los agentes pueden vivir durante horas, por lo que los ciclos de despliegue deben adaptarse.

### Lista de verificación de la producción canónica

- Estado duradero (checkpoints, snapshots o outbox + registro reproducible).
- Efectos secundarios impotentes.
- Capa de entrada y salida sincronizada para las llamadas de LLM.
- Por lo menos una entrega con dedup.
- Despliegue de arco iris/canario para cargas de trabajo de estado.
- Observabilidad: rastro por agente, auditoría en superpaso, contador de retas.

```figure
sw-checkpoint-replay
```

## Construye el mismo

`code/main.py`los instrumentos:

- `CheckpointStore` Registro de puntos de control respaldados por SQLite con teclas de identificación de hilo. Cada superpaso añade una fila.
- `run_with_checkpoint(agent, thread_id)` simula un accidente en mitad de carrera; un segundo trabajador se reanuda desde el último punto de control.
- `AgentQueue` por agente máquina de estado de inacción / procesamiento / respuesta con una pequeña cola de trabajo.
- `demo_async_vs_threads()` ejecuta 500 "llamadas LLM" simuladas simultáneamente a través de asyncio y a través de hilos; informa sobre el reloj de la pared y la memoria máxima (aproximada).

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

Resultado esperado: el punto de control reanuda después de un accidente simulado; la versión asíncrona maneja 500 llamadas simultáneas en < 1s; la versión de hilo tarda varios segundos y utiliza órdenes de magnitud más de memoria por unidad simultánea.

## Usalo

`outputs/skill-scaling-advisor.md`Asesoramiento sobre la elección de ejecución duradera: FastAPI + Postgres, LangGraph runtime, Temporal o personalizado. Calibrado por carga, necesidades de retención de estado y frecuencia de implementación.

## Envío

Endurecimiento de la producción canónica:

- **Start simple (Bedi's rule).**FastAPI + Postgres hasta que se mide que falla.
- **Instrument everything before optimizing.**Histograma de latencia por ejecución, tiempo por paso, recuento de retempta, clasificación de fallas.
- **Outbox pattern for side effects.**Especialmente los pagos y las llamadas externas de API.
- **Rainbow deploys.**Nunca mate a los agentes en vuelo durante el despliegue.
- **Adopt durable-execution engines (Temporal / LangGraph / Restate) when**Se encuentran problemas específicos: espera de horas de tiempo por parte de los humanos en el circuito, coordinación entre regiones, políticas complejas de retoma/compensación.
- **Async for the I/O layer.**Los hilos sólo para el procesamiento posterior de la CPU.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`. Confirmar los trabajos de los puntos de control; medir la diferencia de sincronización frente a la concurrencia de los hilos.
2. Implementar un **outbox**tabla: cada llamada de herramienta escribe primero a la caja de salida, luego se ejecuta una rutina/tarea separada. Verifique la idempotencia ejecutando la llamada de herramienta dos veces.
3. Simula una**rainbow deploy**: dos versiones simultáneas en tiempo de ejecución; envía la mitad de los nuevos thread_ids a cada una; confirma que los thread en vuelo de la versión anterior no se interrumpen.
4. Lea el documento de tiempo de ejecución de LangGraph (enlazado a continuación). Identifique qué características del tiempo de ejecución tardarían más en replicarse en una versión FastAPI + Postgres rodada a mano. ¿Es una razón para adoptar, o puede posponerlo?
5. Lea MegaAgent (arXiv:2408.09955) Sección 3. La coordinación de dos capas (intergrupo + chat de administrador entre grupos) es explícita.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Durable execution | "Persist the program state" | Engine writes state after each super-step; crash recovery is deterministic. |
| Super-step | "Transactional boundary" | Unit of work between checkpoints. LangGraph term. |
| thread_id | "Agent run identifier" | Key that binds checkpoints and resume logic. |
| Idempotency | "Safe to retry" | Repeating a side effect produces the same result as one attempt. |
| Outbox pattern | "Decouple side effects" | Write intent to a table; a separate executor performs and marks done. |
| At-least-once delivery | "Possible duplicates" | Message queue semantics; dedup key makes consumer effective-once. |
| Rainbow deploy | "Overlapping versions" | Multiple runtime versions concurrent during long-running workloads. |
| Async fiber | "Cooperative yielding" | User-mode concurrency; cheap compared to threads for I/O-bound loads. |
| Checkpoint | "State snapshot" | Serialized state at a super-step boundary; key for resume. |

## Leer más

- [LangChain — The runtime behind production deep agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) Diseño de tiempo de ejecución de LangGraph
- [MegaAgent](https://arxiv.org/abs/2408.09955) Coordinación de dos capas en miles de agentes simultáneos
- [Matrix](https://arxiv.org/abs/2511.21686) marco descentralizado con colas de mensajes como sustrato de coordinación
- [Temporal docs](https://docs.temporal.io/) el motor de flujo de trabajo de referencia para ejecución duradera
- [Anthropic — Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) Lecciones de producción, incluido el despliegue del arco iris
