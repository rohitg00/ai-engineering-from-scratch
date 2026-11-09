# Arquitecturas paralelas / conjuntas / en red

> Contraste con el supervisor: no hay un factor central de decisión. Los agentes leen un bus de eventos compartidos, recogen el trabajo sincrónicamente, escriben los resultados. LangGraph admite explícitamente "Arquitectura de la Enredada" para entornos dinámicos y descentralizados. Matrix (arXiv:2511.21686) representa tanto el control como el flujo de datos como mensajes serializados que pasan a través de colas distribuidas para eliminar el cuello de botella del orquestrador. La compensación es explícita: determinismo y trazabilidad para la escalabilidad. El conjunto se adapta a las tareas con muchos subproblemas independientes; no se adapta a las tareas que requieren un solo plan coherente.

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`, `queue`), TypeScript
**Prerequisites:** Phase 16 · 05 (Supervisor Pattern), Phase 16 · 04 (Primitive Model)
**Time:** ~75 minutes

## El problema

El supervisor se limita a unos pocos trabajadores. ¿Qué pasa con cientos? El supervisor mismo se convierte en el cuello de botella: cada decisión sobre quién hace qué canaliza a través de un agente. Un paso lento del plan impide todo el sistema.

Las arquitecturas de conjuntos cambian el diseño. En lugar de un planificador central que despachará el trabajo, los trabajadores eligen el trabajo de una cola compartida. La "coordinación" se incubó en la semántica del bus de eventos.

## Concepto

### La forma

```
                ┌──── shared queue ────┐
                │                      │
       ┌────────┼────────┐  ◄──────┬───┘
       ▼        ▼        ▼         │
     Worker  Worker  Worker   Worker
      A       B       C        D
       │        │        │         │
       └────────┴────────┴─────────┘
                 │
                 ▼
            results pool
```

No hay orquesta. Cada trabajador repite: tirar una tarea, procesar, escribir el resultado (y opcionalmente hacer seguimientos).

### Cuando el enjambre se ajusta

- **Many independent tasks.**Descargar, transformar, clasificar, las tareas no dependen de las otras.
- **Variable-duration work.**Si algunas tareas tardan 100 ms y otras 10s, un enjambre balancea la carga automáticamente  rápidos trabajadores tiran los próximos trabajos.
- **Throughput over determinism.**Te importa el tiempo total de finalización, no el ordenamiento estricto.

### Cuando el enjambre falla

- **Ordered workflows.**Si el paso 3 necesita la salida del paso 2, un enjambre corre el riesgo de disparar el paso 3 antes de que se complete el paso 2.
- **Global-plan tasks.**Las preguntas de investigación complejas se benefician de un planificador.
- **Debugging.**Sin registro central y trabajo asincrónico, reproducir un error es caro.

### Matriz (arXiv:2511.21686)

Matrix es el documento de 2025 que lleva a swarm a su conclusión natural: tanto el flujo de control como el flujo de datos son mensajes serializados en colas distribuidas. No hay coordinador central. La tolerancia a fallos proviene de la durabilidad del mensaje. La escalabilidad es el problema del corredor de mensajes, no del sistema.

Contribución: un modelo de programación en el que la coordinación multi-agente es "qué tema de mensaje se suscribe este agente?" en lugar de "qué agente elige el supervisor después?" Esto hace que el sistema parezca una malla de eventos pub/sub.

### Un montón en los marcos gráficos

Los documentos de LangGraph 2025 describen explícitamente "Arquitectura de la Enredada" como uno de los patrones de múltiples agentes: los agentes son nodos, pero los bordes forman un gráfico dirigido con ciclos y cualquier nodo puede ser activado desde el grupo.

### Modo de falla: hambre y puntos calientes

Si todos los trabajadores hacen la tarea más rápida disponible, las tareas de larga duración nunca se seleccionan hasta que no queden las únicas.

Mitigación:
- Colas de prioridad con envejecimiento explícito (aumentar la prioridad con el tiempo de espera).
- Especialización de los trabajadores: algunos trabajadores solo realizan tareas "longas".
- Presión de retroceso: limita la cantidad de tareas rápidas que entran en la cola.

### El enlace de enrutamiento basado en el contenido

Los pares de conjuntos se realizan naturalmente con el enrutamiento basado en contenido (lección 22). En lugar de una cola genérica, tienen una cola por tipo de mensaje. Los trabajadores especializados se suscriben solo a su tipo. Esta es la base de las arquitecturas de bus de mensajes que se escalan a miles de agentes.

```figure
sw-work-stealing
```

## Construye el mismo

`code/main.py`Implementa un enjambre de 4 hilos de trabajadores tirando de un compartido `queue.Queue`Las tareas tienen duradas variables (algunas rápidas, otras lentas).

- **Sequential baseline:**un trabajador procesa todas las tareas en serie.
- **Fixed assignment:**cada tarea previamente asignada a un trabajador específico (estilo de supervisor).
- **Swarm:**Los trabajadores se hacen cola compartida.

Las balanzas de un montón se cargan automáticamente; la asignación fija deja a los trabajadores rápidos inactivos cuando su tarea asignada es lenta.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

La salida muestra el número de tareas por trabajador (el grupo se distribuye de manera desigual pero óptima) y los tiempos del reloj de pared.

## Usalo

`outputs/skill-swarm-fit.md`evalúa si una tarea debe utilizar enjambre vs supervisor. Ingresos: independencia de tarea, variación de duración, requisitos de orden, necesidades de descomposición.

## Envío

Lista de control:

- **Priority queue with aging.**Prevenir el hambre de tareas largas.
- **Worker idempotency.**La tarea puede ser realizada más de una vez si un trabajador se estrella en medio de la carrera.
- **Durable queue.**Utilice Kafka, Redis Streams o una cola respaldada por una base de datos para la producción. `queue.Queue`Es sólo en memoria.
- **Observability per task.**Cada tarea tiene un identificador de rastreo; cada trabajador registra el inicio y el final con él.
- **Back-pressure.**Si la cola crece más rápido que los trabajadores la drenan, ralentiza al productor.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`¿Cuánto más rápido es el enjambre que el secuencial en la carga de trabajo de duración variable?
2. Añadir una variante de la cola de prioridad (uso `queue.PriorityQueue`Se debe asignar prioridad por tarea en el campo "importancia". Observe si las tareas de baja prioridad pasan hambre bajo carga continua.
3. Implementar un detector de puntos calientes: registro cuando un trabajador procesa 3 veces más tareas que el trabajador más lento. ¿Qué indica eso sobre la distribución de la duración de la tarea?
4. Lea el resumen del documento de Matrix (arXiv:2511.21686) y la sección 3. Identifique una compensación específica que la Matrix acepta (ganancia de escalabilidad) y una que abandona (trazabilidad, determinismo).
5. Convierta la demo del enjambre para usar un `queue.Queue`¿Qué reglas de enrutamiento tienen sentido cuando las tareas son heterogéneas?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Swarm architecture | "Decentralized agents" | Workers pull from shared queue; no central orchestrator. |
| Event bus | "Agents subscribe to topics" | Message broker that routes tasks to workers by type or content. |
| Starvation | "Task never runs" | Low-priority task never gets picked because higher-priority work arrives continuously. |
| Hot-spotting | "One worker drowns" | Load imbalance where one worker gets most tasks. |
| Back-pressure | "Slow down the producer" | Mechanism that signals upstream to stop producing when the queue fills up. |
| Idempotent worker | "Safe to re-run" | A task processed twice produces the same result. Required because workers may crash mid-run. |
| Durable queue | "Survives crashes" | Queue backed by disk or replicated storage; tasks are not lost when a worker crashes. |
| Matrix framework | "Full message-passing swarm" | Both data and control flow are serialized messages on distributed queues. |

## Leer más

- [LangGraph workflows and agents — Swarm Architecture](https://docs.langchain.com/oss/python/langgraph/workflows-agents) apoyo explícito del enjambre
- [Matrix — A Decentralized Framework for Multi-Agent Systems](https://arxiv.org/abs/2511.21686) Envuelo de mensajes completos
- [Anthropic engineering — why supervisor not swarm in Research](https://www.anthropic.com/engineering/multi-agent-research-system) por qué un sistema de producción específico escogió explícitamente a un supervisor sobre un enjambre
- [AutoGen v0.4 actor-model docs](https://microsoft.github.io/autogen/stable/) el actor impulsado por eventos reescribir, más cerca del enjambre que GroupChat de v0.2
