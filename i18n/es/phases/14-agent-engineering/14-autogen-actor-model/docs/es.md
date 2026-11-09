# El modelo de actor para agentes  Mensajes sincronizados y tiempos de ejecución de tipo

> Agentes como actores: intercambio de mensajes asíncronos, manipuladores de eventos, aislamiento de fallos, concurrencia natural. AutoGen v0.4 (Microsoft Research, enero 2025) rediseñó la orquestación de agentes alrededor de este modelo; el marco está ahora en modo de mantenimiento, con Microsoft Agent Framework (previsión pública de octubre 2025) como su sucesor de producción.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Describa el modelo de actores: agentes como actores, mensajes como el único IPC, aislamiento de fracasos por actor.
- Nombre de las tres capas de API de AutoGen v0.4  Core, AgentChat, Extensions  y para qué es cada uno.
- Explica por qué la desacoplamiento de la transmisión de mensajes de la manipulación da aislamiento de fallas y concurrencia natural.
- Implemente un tiempo de ejecución de actor stdlib en Python y puesta un flujo de revisión de código de dos agentes en él.

## El problema

La mayoría de los marcos de agentes son sincrónicos: un agente produce, un agente consume, en una pila de llamadas. Los fallos chocan la pila. La concurrencia está activada. La distribución requiere reescribir.

AutoGen v0.4 respuesta: el modelo de actor. Cada agente es un actor con una bandeja de entrada privada. Los mensajes son la única interacción. El tiempo de ejecución desacopla la entrega del manejo. Los fracasos se aislan a un actor. La competencia es nativa. La distribución es sólo un transporte diferente.

## El concepto

### Actores

Un actor tiene:

- Un estado privado (nunca tocado directamente desde fuera).
- Una bandeja de entrada (cuadra de mensajes).
- Un manipulador:`receive(message) -> effects`donde los efectos pueden ser "responda", "envía a otro actor", "españar un nuevo actor", "actualizar estado", "detenerse".

Dos actores no pueden compartir memoria, sólo pueden enviar mensajes.

### Tres capas de API

AutoGen v0.4 divide su superficie en tres:

1. **Core.**Marco de actores de bajo nivel. `AgentRuntime`¿ Qué ?`Agent`¿ Qué ?`Message`¿ Qué ?`Topic`- Intercambio de mensajes sincronizados, basado en eventos.
2. **AgentChat.**API de alto nivel dirigida a tareas (sustitución del ConversableAgent de v0.2). `AssistantAgent`¿ Qué ?`UserProxyAgent`¿ Qué ?`RoundRobinGroupChat`¿ Qué ?`SelectorGroupChat`¿ Qué ?
3. **Extensions.**Integraciones  OpenAI, Anthropic, Azure, herramientas, memoria.

### ¿Por qué es importante la separación?

En el modelo v0.2, llamando`agent_a.chat(agent_b)`bloquea sincrónicamente el agente_a hasta que el agente_b regrese.`send(agent_b, msg)`El tiempo de ejecución se entrega más tarde.

- **Fault isolation.**El agente B se estrella no se estrella el agente A  el tiempo de ejecución captura el fallo en el manipulador de B y decide qué hacer (log, retraye, letra muerta).
- **Natural concurrency.**Muchos mensajes en vuelo a la vez; los actores procesan su bandeja de entrada simultáneamente.
- **Distribution-ready.**La bandeja de entrada + transporte es la misma abstracción ya sea que el actor esté en proceso o en otro anfitrión.

### Topologías

- **RoundRobinGroupChat.**Los agentes se turnan en una rotación fija.
- **SelectorGroupChat.**Un agente seleccionador elige quién va a seguir en función del contexto de la conversación.
- **Magentic-One.**Equipo de referencia multi-agente para navegación web, ejecución de código, manejo de archivos.

### Observabilidad

Cada mensaje emite un período de tiempo; las llamadas a la herramienta llevan`gen_ai.*`Los datos de la evaluación de los datos de la evaluación de los datos de la evaluación de los datos de la evaluación de los datos de la evaluación de los datos de la evaluación de la evaluación de los datos de la evaluación de la evaluación de los datos de la evaluación de la evaluación de la evaluación de la evaluación de los datos de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de los datos de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de los datos de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la evaluación de la cuento de la evaluación de la evaluación de la evaluación de la evaluación de la cuento de la cuento de la evaluación de la cuento de la cuento de la cuento de la evaluación de

### Estado: modo de mantenimiento

Inicio 2026: AutoGen v0.7.x es estable para la investigación y la creación de prototipos. Microsoft ha cambiado el desarrollo activo al Microsoft Agent Framework, el sucesor de producción (previsión pública 1 de octubre de 2025; 1.0 GA fue dirigido a finales del primer trimestre de 2026).

```figure
actor-mailbox
```

## Construye el mismo

`code/main.py`Implementa un tiempo de ejecución de actores stdlib:

- `Message` carga útil tipografada con `sender`¿ Qué ?`recipient`¿ Qué ?`topic`¿ Qué ?`body`¿ Qué ?
- `Actor` abstracto con `receive(message, runtime)`¿ Qué ?
- `Runtime` bucle de eventos con una cola compartida, entrega, aislamiento de fallas.
- Una demostración de dos actores:`ReviewerAgent`código de revisión, `ChecklistAgent`ejecuta una lista de verificación; intercambian mensajes hasta el consenso.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

El rastro muestra la entrega del mensaje, un fracaso simulado en un actor que no estrella al otro, y convergencia en un veredicto compartido.

## Usalo

- **AutoGen v0.4/v0.7**(Mantenimiento)  estable para la investigación, prototipos, patrones multi-agentes.
- **Microsoft Agent Framework** el sucesor de producción (previsión pública de octubre de 2025); las mismas ideas de actores-modelo en una API actualizada.
- **LangGraph swarm topology**(Lección 13)  patrón similar a través de las entregas de herramientas compartidas.
- **Custom actor runtime** cuando se necesita un transporte específico (NATS, RabbitMQ, gRPC).

## Envío

`outputs/skill-actor-runtime.md`genera un tiempo de ejecución mínimo de actores más una plantilla de equipo (RoundRobin o Selector) para una tarea multi-agente dada.

## Los ejercicios

1. Añadir una cola de letras muertas: cuando un manipulador levante, estacione el mensaje fallido para inspección humana. ¿Con qué frecuencia se golpea DLQ en su juguete?
2. Implementación `SelectorGroupChat`: un actor selector elige quien procesa el siguiente mensaje en función del estado de conversación.
3. Añadir transporte distribuido: intercambiar la cola en proceso por un servidor JSON-over-HTTP para que los actores puedan ejecutar procesos separados.
4. Envía un tiempo de OTel por mensaje (o un no-op stand-in).`gen_ai.agent.name`¿ Qué ?`gen_ai.operation.name`Por lección 23.
5. Lea el post de arquitectura de AutoGen v0.4.`autogen_core`¿Qué se ha saltado que importa en la producción?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Actor | "Agent" | Private state + inbox + handler; no shared memory |
| Message | "Event" | Typed payload; the only way actors interact |
| Inbox | "Mailbox" | Per-actor queue of pending messages |
| Runtime | "Agent host" | Event loop that routes messages and isolates failures |
| Topic | "Channel" | Named publish-subscribe route between actors |
| Fault isolation | "Let it crash" | One actor failing does not crash others |
| RoundRobinGroupChat | "Fixed-rotation team" | Agents take turns in order |
| SelectorGroupChat | "Context-routed team" | Selector picks who goes next |
| Magentic-One | "Reference team" | Multi-agent squad for web + code + files |

## Leer más

- [AutoGen v0.4, Microsoft Research](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) el puesto de rediseño
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) Alternativa en forma de gráfico
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) se extiende AutoGen emite por defecto
