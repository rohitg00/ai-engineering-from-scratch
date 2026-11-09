# Las entregas y las rutinas  Orquestación sin estatus

> OpenAI's Swarm (octubre 2024) destilado multi-agente orquestación a dos primitivos: **routines**(instrucciones + herramientas como un mensaje de sistema) y **handoffs**(una herramienta que devuelve a otro agente). No hay máquina estatal, no hay ramas de DSL  las rutas de LLM llamando a la herramienta de entrega correcta. El SDK OpenAI Agents (marzo 2025) es el sucesor de producción. El mismo cúmulo sigue siendo la referencia conceptual más limpia  su fuente entera encaja en unos cientos de líneas. El patrón es viral porque la superficie de la API es aproximadamente "agente = prompt + herramientas; entrega = agente de devolución de funciones". Limitación: sin estado, por lo que la memoria es el problema del llamador.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## El problema

Cada marco multi-agente quiere que aprendas su DSL: nodos y bordes de LangGraph, equipos y tareas de CrewAI, AutoGen GroupChat y gerentes.

El grupo empuja en la dirección opuesta: utiliza la capacidad de llamada de herramientas que el modelo ya tiene. Las entregas se convierten en llamadas de herramientas. El orquestrador es el agente que actualmente sostiene la conversación. La máquina de estado está implícita en las instrucciones del sistema de los agentes.

## Concepto

### Dos primitivos

**Routine.**Un sistema de instrucciones que define el papel de un agente y las herramientas disponibles. Piense en ello como un conjunto de instrucciones con un alcance: "es un agente de triaje; si el usuario pregunta sobre reembolsos, entregue a la agente de reembolso".

**Handoff.**Una herramienta que el agente puede llamar que devuelve un nuevo objeto de agente.

Esa es toda la abstracción.

```
def transfer_to_refunds():
    return refund_agent  # Swarm sees Agent return → switch active agent

triage_agent = Agent(
    name="triage",
    instructions="Route the user to the right specialist.",
    functions=[transfer_to_refunds, transfer_to_sales, transfer_to_support],
)
```

El sistema de la solicitud del agente de triaje le hace elegir la entrega correcta en función del mensaje del usuario.

### Por qué es viral

- **Small API.**Dos conceptos que aprender.
- **Uses what the model already does.**La llamada a herramientas ya es de producción entre los proveedores.
- **No state-machine burden.**No describirás el gráfico, las instrucciones de los agentes describen a quiénes entregan.

### El comercio sin estado

Swarm es explícitamente sin estado entre las ejecuciones. El marco mantiene un historial de mensajes durante una ejecución, pero no persiste nada. Memoria, continuidad, tareas de larga duración  todo el problema del llamador.

En la producción (OpenAI Agents SDK, marzo 2025) esto fue una de las principales cosas que cambiaron: el SDK añade gestión de sesiones integrada, barandillas y seguimiento mientras mantiene la entrega primitiva.

### Cuando el grupo de manadas se ajuste

- **Triage patterns.**El agente de primera línea envía al usuario a un especialista.
- **Skill-based handoffs.**"Si la tarea necesita código, llame al codificador; si necesita investigación, llame al investigador".
- **Short, bounded conversations.**Soporte al cliente, preguntas frecuentes, flujos de trabajo simples.

### Cuando el enjambre lucha

- **Long sessions with shared memory.**Las transferencias restablecen el estado de conversación al nuevo agente de la cuenta de espera más el historial.
- **Parallel execution.**El cambio de mano es uno a la vez  los interruptores del agente activo. Paralelamente, el llamador requiere orquestar múltiples carreras de Swarm.
- **Audit and replay.**Las carreras sin estatus son difíciles de reproducir exactamente; la elección de entrega del LLM no es determinista.

### El objetivo de la evaluación es mejorar la calidad de la información y la calidad de la información.

El sucesor de producción añade:

- **Session state.**Un hilo persistente a través de las carreras.
- **Guardrails.**Los ganchos de validación de entrada/salida.
- **Tracing.**Todas las llamadas y entregas de herramientas están registradas.
- **Handoff filters.**Controlar qué contexto se transfiere en la entrega.

El primitivo de entrega sobrevive; la ergonomía de producción se agrega a su alrededor.

### Swarm vs. grupo chat

Ambos utilizan el enrutamiento impulsado por el LLM, pero difieren en**who picks next**¿Qué es esto ?

- GrupoChat: un selector (función o LLM) elige al próximo orador desde fuera.
- El agente actual elige a su sucesor llamando a una herramienta de entrega.

Swarm es "el agente decide lo que viene después"; GroupChat es "el gerente decide lo que viene después". La decisión de Swarm vive en la llamada de herramientas del agente activo; la vida de GroupChat en el `GroupChatManager`¿ Qué ?

```figure
sw-handoff-routing
```

## Construye el mismo

`code/main.py`Implementa Swarm desde cero: una clase de datos de agente, un mecanismo de entrega (herramienta devuelve agente) y un bucle de ejecución que detecta los interruptores de agente.

Demo: un agente de triaje viaja para reembolsar, ventas o especialistas de soporte. Cada especialista tiene sus propias herramientas.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

## Usalo

`outputs/skill-handoff-designer.md`diseña una topología de entrega para una tarea determinada: qué agentes existen, qué entregas pueden llamar, qué contextos transfieren.

## Envío

Lista de control:

- **Handoff logging.**Cada entrega escribe un evento de rastreo con un instantáneo de agente a agente, contexto.
- **Context transfer rules.**Decida qué se mueve en la entrega: historia completa (cargada), últimos N mensajes, o un resumen.
- **Guardrail on handoff.**Una entrega a un especialista con diferentes permisos de herramienta debe ser autenticada  de lo contrario, la inyección rápida puede forzar las entregas no deseadas.
- **Loop detection.**Dos agentes que se entregan de un lado a otro es un fracaso común; detecta con una simple verificación de anillo de último K.
- **Fallback agent.**Si no existe un objetivo de entrega, vuelva a un defecto seguro.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Confirme que el agente activo de la segunda vuelta es el reembolso.
2. Añadir una regla de detección de bucle: si los mismos dos agentes han entregado 3 veces seguidas, forzar una salida. Diseñar el fallback.
3. Lea los documentos de OpenAI Agents SDK sobre filtros de entrega. Implemente una versión de "resumen en entrega": el agente saliente comprime el contexto a un resumen de bala antes de que el agente entrante se haga cargo.
4. Comparar la entrega de Swarm con un selector de GroupChatManager. ¿Qué patrón empeora la inyección rápida, y por qué?
5. Lea el libro de cocina de los "Swarm" (https://developers.openai.com/cookbook/examples/orchestrating_agentsIdentificar una decisión explícita de diseño que Swarm hace que OpenAI Agents SDK cambiado o mantenido.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Routine | "The agent prompt" | System prompt + tool list. Defines role and available handoffs. |
| Handoff | "Transfer to another agent" | A tool the active agent can call that returns a new Agent. The runtime switches active agent. |
| Stateless | "No memory between runs" | Swarm does not persist anything; memory is the caller's responsibility. |
| Active agent | "Who's speaking now" | The agent currently holding the conversation. Handoff changes this. |
| Context transfer | "What moves on handoff" | Policy for what history the incoming agent sees: full, last N, or summarized. |
| Handoff loop | "Agents ping-pong" | Failure mode where two agents keep handing back to each other. |
| OpenAI Agents SDK | "Production Swarm" | March 2025 successor; adds sessions, guardrails, tracing on top of the handoff primitive. |
| Handoff filter | "Gate on transfer" | SDK feature to inspect and modify context at the handoff boundary. |

## Leer más

- [OpenAI cookbook — Orchestrating Agents: Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) la articulación de referencia
- [OpenAI Swarm repo](https://github.com/openai/swarm) la aplicación original, conservada como referencia conceptual
- [OpenAI Agents SDK docs](https://openai.github.io/openai-agents-python/) sucesor de producción con sesiones y seguimiento
- [Anthropic handoff-in-Claude notes](https://docs.anthropic.com/en/docs/claude-code) cómo los subagentes de código claude utilizan un patrón similar a la entrega a través de `Task`
