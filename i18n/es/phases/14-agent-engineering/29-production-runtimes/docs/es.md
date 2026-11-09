# Tiempos de ejecución de la producción: cola, evento, cron

> Los agentes de producción funcionan en seis formas de tiempo de ejecución: solicitud-respuesta, transmisión, ejecución duradera, fondo basado en cola, impulsado por eventos y programado. Elige la forma antes de elegir el marco.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 22 (Voice)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Nombre las seis formas de ejecución de producción y coincide cada una con un patrón de marco / producto.
- Explique por qué la ejecución duradera (LangGraph) es importante para las tareas de largo horizonte.
- Describa el tiempo de ejecución basado en el evento y cuándo encaja Claude Managed Agents.
- Explicar la afirmación de observabilidad como carga de carga para los agentes de múltiples pasos.

## El problema

Los agentes de producción fallan de manera que un portátil de Jupyter no aparece: los tiempos de red en el paso 37, el usuario cuelga la llamada de voz, el trabajo cron se muere en la reiniciación de la máquina, el trabajador de fondo se queda sin memoria. La forma de tiempo de ejecución determina qué fallos son supervivientes.

## El concepto

### Requisito y respuesta

- HTTP sincrónico. El usuario espera la finalización.
- Solo viable para tareas cortas (< 30 años).
- Las pilas: Agno (Python + FastAPI), Mastra (TypeScript + Express/Hono/Fastify/Koa).
- Observabilidad: registros de acceso HTTP estándar + extensiones de OTel.

### En streaming

- SSE o WebSocket para salida progresiva.
- LiveKit extiende esto a WebRTC para voz/vídeo (lección 22).
- Stacks: cualquier marco con soporte de transmisión + una frontend que maneje SSE/WS.
- Observabilidad: tiempo por pieza, latencia de primer token, latencia de cola.

### Ejecución duradera

- El estado de control después de cada paso; auto-resumen en caso de fallo.
- El modelo de actores de AutoGen v0.4 aisla las fallas a un agente (lección 14).
- El diferenciador central de LangGraph (lección 13).
- Es esencial cuando el número de pasos es desconocido y el costo de recuperación es alto.

### Basado en la cola / fondo

- El trabajo entra en cola, los trabajadores se recogen, los resultados fluyen a través de webhooks o pub/sub.
- Esencial para agentes de largo horizonte (decenas a cientos de pasos por tarea, por anuncio de uso de computadora de Anthropic).
- Las pilas: Celery (Python), BullMQ (Node), SQS + Lambda (AWS), personalizado.
- Observabilidad: profundidad de cola, distribución de latencia por trabajo, tamaño de DLQ.

### El desarrollo de la actividad

- Los agentes se suscriben a los gatillos: nuevo correo electrónico, PR abierto, cron fire.
- Claude Managed Agents cubre esto fuera de la caja (lección 17).
- Los flujos de CrewAI (lección 15) estructuran flujos de trabajo deterministas basados en eventos.
- Observabilidad: fuente de activación, latencia de inicio de evento, latencia de agente.

### Programación

- Agentes en forma de Cron que se ejecutan periódicamente.
- Combina con una ejecución duradera para que una carrera nocturna fallida se reanude la próxima vez.
- Stacks: Kubernetes CronJob + un marco duradero; alojado (Render cron, Vercel cron).

### Modelos de despliegue para 2026

- **CrewAI Flows**para la producción basada en eventos.
- **Agno**FastAPI sin estado para microservicios Python.
- **Mastra**Adaptadores de servidores (Express, Hono, Fastify, Koa) para su incorporación.
- **Pipecat Cloud / LiveKit Cloud**para la voz gestionada (lección 22).
- **Claude Managed Agents**para asíncrono de larga duración alojado.

### La observabilidad es de carga

Sin OpenTelemetry GenAI (lección 23) más un backend Langfuse/Phoenix/Opik (lección 24), no se puede deshacer un agente de múltiples pasos que falló en el paso 40. Esto no es opcional para la producción. Es la diferencia entre "deshacemos deshacer rápidamente" y "replayamos desde cero con más registro".

### Cuando los tiempos de ejecución de la producción no funcionen

- **Wrong shape choice.**Elegir la respuesta a las solicitudes para una tarea de 5 minutos.
- **No DLQ.**Trabajadores en cola sin letra muerta.
- **Opaque background work.**El agente de fondo se ejecuta sin rastro de exportación. Los fallos son invisibles hasta que el usuario los informa.
- **Skipping durable state.**Cualquier ejecución > 30 segundos donde no se puede permitir reiniciar necesita ejecución duradera.

```figure
wb-runtime-shapes
```

## Construye el mismo

`code/main.py`es una demostración multi-forma de stdlib:

- Punto final de solicitud y respuesta (función simple).
- El controlador de transmisión (generador).
- Trabajadora en cola con DLQ.
- Registro de activadores de eventos.
- Programación en forma de cron.

- ¿Qué quieres decir ?

```bash
python3 code/main.py
npx tsx code/main.ts
```

Resultado: cinco rastros que muestran el comportamiento de cada forma en la misma tarea. La misma lógica del agente, diferentes capas externas. La ejecución duradera (la sexta forma) se cubre intencionalmente en la Lección 13 con el punto de control de LangGraph.

## Usalo

- **Request-response**para el estilo de chat UX.
- **Streaming**para respuestas progresivas.
- **Durable**para tareas de largo horizonte.
- **Queue**para lote / asíncrono / de larga duración.
- **Event**para la reactividad del agente.
- **Cron**para el mantenimiento de la vivienda (consolidación de memoria, evaluaciones, informes de costes).

## Envío

`outputs/skill-runtime-shape.md`elige una forma de tiempo de ejecución para una tarea y fija los requisitos de observabilidad.

## Los ejercicios

1. Portar su Lección 01 ReAct bucle a las seis formas en su pila. ¿Qué forma se ajusta a la superficie del producto?
2. Añadir un DLQ a la demostración basada en la cola. Simula el fracaso del trabajo del 10%; tamaño de DLQ de superficie.
3. Escriba un agente de evaluación cron-triggered que se ejecuta todas las noches contra sus 20 mejores rastros del día.
4. Implementar el streaming con presión de contra: si el cliente es lento, detenga al agente. ¿Cómo interactúa esto con un presupuesto de turno?
5. ¿Cuándo trasladaría a un agente de largo horizonte a administrar?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Request-response | "Synchronous" | User waits; short tasks only |
| Streaming | "SSE / WS" | Progressive output; better UX; latency observable per chunk |
| Durable execution | "Resume from failure" | Checkpointed state; restart at last step |
| Queue-based | "Background jobs" | Producer / worker pool / DLQ |
| Event-driven | "Trigger-based" | Agent reacts to external events |
| DLQ | "Dead-letter queue" | Parking lot for failed jobs |
| Claude Managed Agents | "Hosted harness" | Anthropic-hosted long-running async with caching + compaction |

## Leer más

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) Detalles de ejecución duraderos
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) acogida sin sincronización de larga duración
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) "decenas a cientos de pasos por tarea"
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) aislamiento de fallas del modelo actor
