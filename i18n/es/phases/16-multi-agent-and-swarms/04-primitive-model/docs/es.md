# El modelo primitivo multiagente

> Cuatro primitivas, nada más  el agente, la entrega, el estado compartido, el orquestrador  abarcan un espacio de diseño en cuatro dimensiones, y los principales marcos multi-agentes que se enviarán en 2026 (AutoGen, LangGraph, CrewAI, OpenAI Agents SDK, Microsoft Agent Framework) son puntos en él. Esta lección los construye desde cero, ejecuta un sistema de juguetes en los cuatro, luego mapea cada marco principal en los mismos ejes para que pueda leer cualquier nueva versión en un párrafo.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 (Agent Engineering), Phase 16 · 01 (Why Multi-Agent)
**Time:** ~60 minutes

## El problema

Cada seis meses un nuevo marco multi-agente se lanza. AutoGen en 2023. CrewAI en 2024. LangGraph y OpenAI Swarm en 2024. Google ADK en abril de 2025. Microsoft Agent Framework RC en febrero de 2026. Cada comunicado de prensa afirma ser "la abstracción correcta".

Si tratas de aprenderlos uno a la vez, se agotará. Las API se ven diferentes. Los documentos no están de acuerdo sobre lo que es un "agente". Un marco llama su memoria compartida un "tablero de control", otro lo llama un "poll de mensajes", un tercero lo llama un "StateGraph".

No es. Bajo el marketing, las cuatro primitivas son estables. Apréndelos una vez, lea cada nuevo marco en un párrafo.

## Concepto

### Los cuatro primitivos

1. **Agent** un prompt de sistema más una lista de herramientas. Estatal; cada ejecución comienza desde su prompt de sistema y el historial de mensajes actual.
2. **Handoff** una transferencia estructurada de control de un agente a otro. Mecánica, una llamada de herramienta que devuelve un nuevo agente o un borde de gráfico que sigue una condición.
3. **Shared state** cualquier estructura de datos que más de un agente pueda leer (a veces escribir).
4. **Orchestrator** quien decida quién habla después. Opciones: un gráfico explícito (determinista), un selector de altavoces de LLM (suave), la llamada de entrega del último orador (OpenAI Swarm), o un programador sobre una cola (arquitectura de conjuntos).

Todo el espacio de diseño. Cada marco elige los valores predeterminados para cada eje; el resto es la sintaxis de superficie.

### Cómo cada marco 2026 se asigna a él

| Framework | Agent | Handoff | Shared state | Orchestrator |
|-----------|-------|---------|--------------|--------------|
| OpenAI Swarm / Agents SDK | `Agent(instructions, tools)` | tool returns Agent | caller's problem | the LLM's next handoff call |
| AutoGen v0.4 / AG2 | `ConversableAgent` | speaker-selector on GroupChat | message pool | selector function (LLM or round-robin) |
| CrewAI | `Agent(role, goal, backstory)` | `Process.Sequential / Hierarchical` | Task outputs chained | manager LLM or static order |
| LangGraph | node function | graph edge + condition | `StateGraph` reducer | the graph, deterministic |
| Microsoft Agent Framework | agent + orchestration patterns | pattern-specific | thread / context | pattern-specific |
| Google ADK | agent + A2A card | A2A task | A2A artifacts | host decides |

Las diferencias superficiales son enormes, debajo de ellos, los mismos cuatro botones.

### ¿Por qué esto importa?

Una vez que veas las primitivas, la comparación de marcos se convierte en una lista de verificación corta:

- ¿Confia el orquestrador en que el LLM en el enrutamiento (Swarm) o en que el enrutamiento se enmarque en código (LangGraph)?
- ¿Es el estado compartido de historia completa (GroupChat) o proyectado (Reductor de gráfico de estado)?
- ¿Pueden los agentes modificar las instrucciones de los demás (administrador de CrewAI) o sólo entregar (Swarm)?

Estas tres preguntas responden al 80% de cuál marco se adapta a un problema dado. Dejas de comprar "el mejor marco multi-agente" y empiezas a diseñar para el eje que realmente te importa.

### El insight sin estado

Cada primitivo excepto el estado compartido es estatal. El agente es una función de (prompto, herramientas).**The only stateful thing in the system is shared state.**Ahí viven todos los interesantes errores: envenenamiento de la memoria (lección 15), ordenamiento de mensajes, versioning, discusión de escritura.

Los marcos que ocultan el estado compartido (Swarm) empujan el problema al llamador.

### Anatomía de una sola primitiva

#### Agente , ¿ qué ?

```
Agent = (system_prompt, tools, model, optional_name)
```

No hay memoria, no hay estado, dos agentes con el mismo sistema de instrucción y herramientas son intercambiables, todo lo que parece un estado de agente es en realidad en estado compartido o el protocolo de transmisión.

#### Entrega de dinero

```
Handoff = (from_agent, to_agent, reason, payload)
```

Las tres implementaciones son dominantes:

- **Function return** la herramienta devuelve el siguiente agente. Este es el patrón de OpenAI Swarm. Los agentes llevan el enrutamiento en sus esquemas de herramientas.
- **Graph edge** LangGraph. Los bordes son declarativos. El LLM produce un valor; una condición selecciona el siguiente nodo.
- **Speaker selection**Una función selectora (a veces en sí misma una llamada de LLM) lee el grupo y elige quién habla después.

#### Estado compartido

```
SharedState = { messages: [], artifacts: {}, context: {} }
```

A menudo más: artefactos estructurados (salidas de tareas de CrewAI), contexto tipado (reducidores de LangGraph), memoria externa (MCP, vector DB).

Dos topologías: **full pool**(todo agente ve cada mensaje) y **projected**Los grupos completos son simples y escalar mal. los grupos proyectados escalar pero requieren un diseño de esquema anticipado.

#### Orquestación

```
Orchestrator = ({state, last_speaker}) -> next_agent
```

Cuatro sabores:

- **Static** el gráfico se fija en el tiempo de construcción (determinista de LangGraph, secuencial CrewAI).
- **LLM-selected** un LLM lee la piscina y elige al siguiente orador (AutoGen, CrewAI Hierarquial).
- **Handoff-driven** el agente actual decide llamando a una herramienta de entrega (Swarm).
- **Queue-driven** los trabajadores se tiran de una cola compartida; no hay altavoz siguiente explícito (arquitecturas de enjambres, Matrix).

### ¿Qué cambios se producen entre los marcos

Una vez que las primitivas se fijan, las decisiones de diseño restantes son:

- **Memory strategy** Control efímero frente a control duradero (checkpointer LangGraph).
- **Safety boundary** que puede aprobar una entrega (humano en el circuito).
- **Cost accounting** Presupuestos de tokens por agente.
- **Observability** rastrear las entregas, persistir en el estado para repetición.

Todos implementados en la parte superior de los primitivos. ninguno de ellos son nuevos primitivos.

```figure
a5-primitive-radar
```

## Construye el mismo

`code/main.py`Implementa las cuatro primitivas en ~ 150 líneas de stdlib Python.

El expediente exporta:

- `Agent` una clase de datos de nombre, orden del sistema, herramientas, función de política.
- `Handoff` una función que devuelve un nuevo agente.
- `SharedState` un grupo de mensajes seguro de hilo.
- `Orchestrator` tres variantes: `StaticOrchestrator`¿ Qué ?`HandoffOrchestrator`¿ Qué ?`LLMSelectorOrchestrator`(simulado).

La demostración ejecuta la misma línea de tres agentes (investigación → escribir → revisión) a través de los tres tipos de orquesta y imprime el conjunto de mensajes al final.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

La ejecución dirigida por la entrega llega a menos agentes si el investigador decide que se hace temprano  que es el tradeoff de enrutamiento LLM en miniatura.

## Usalo

`outputs/skill-primitive-mapper.md`es una habilidad que lee cualquier base de código multi-agente o documento marco y devuelve el mapeo de cuatro primitivos. ejecutarlo en una nueva versión de marco para obtener una comprensión de un párrafo antes de leer documentos en profundidad.

## Envío

Antes de adoptar un nuevo marco, escriba el mapa primitivo para él. Si no puede, los documentos son incompletos o el marco está inventando un quinto primitivo (que se verifique raramente  para un sabor de estado compartido que no ha visto).

Enfilar el mapeo en su documento de arquitectura. Cuando un nuevo miembro del equipo se une, envíe el mapeo antes de los documentos de la API. Cuando las versiones del marco cambian, difir el mapeo, no el registro de cambios.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Observe cómo el orquestaje cambia la elección de los agentes.
2. Implemente un cuarto tipo de orquesta: uno dirigido por fila donde los agentes encuestan el estado compartido para el trabajo. ¿Qué estancamiento puede ocurrir, y cómo lo detecta?
3. Tomemos el arranque rápido de LangGraph (https://docs.langchain.com/oss/python/langgraph/workflows-agents¿Cuál de los mapas de abstracciones de LangGraph 1:1 y cuáles son los envoltorios de conveniencia?
4. Lea el libro de cocina OpenAI Swarm (https://developers.openai.com/cookbook/examples/orchestrating_agentsIdentifique cuál de las cuatro primitivas es la que más ergonomía hace Swarm y cuál empuja al que llama.
5. Encuentra un marco en esta tabla que oculte el estado compartido por completo y explique qué se rompe cuando los agentes necesitan coordinar entre las entregas sin volver a leer el historial.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent | "An LLM with tools" | A `(system_prompt, tools, model)` triple. Stateless. |
| Handoff | "Transfer of control" | A structured call that names the next agent and optional payload. Three implementations: function return, graph edge, speaker selection. |
| Shared state | "Memory" / "context" | The only stateful part of a multi-agent system. Message pool or blackboard. |
| Orchestrator | "Coordinator" | Whoever decides who runs next. Static graph, LLM selector, handoff-driven, or queue-driven. |
| Primitive | "Abstraction" | One of the four axes every framework parameterizes. Not a framework feature. |
| Message pool | "Shared chat history" | Full-history shared state. Easy to reason about, scales badly. |
| Projected state | "Scoped view" | Role-specific view into shared state. Scales, requires schema design. |
| Speaker selection | "Who talks next" | Orchestrator pattern where a function (often an LLM) picks the next agent from a group. |

## Leer más

- [OpenAI cookbook: Orchestrating Agents — Routines and Handoffs](https://developers.openai.com/cookbook/examples/orchestrating_agents) la articulación más clara de la orquestación impulsada por la entrega
- [AutoGen stable docs](https://microsoft.github.io/autogen/stable/) GroupChat + selección de oradores es la referencia para la orquestación seleccionada por el LLM
- [LangGraph workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) Orquestación de borde gráfico y estado compartido basado en reducidor
- [CrewAI introduction](https://docs.crewai.com/en/introduction) agentes de rol-objetivo-historia de fondo, procesos secuenciales / jerárquicos
- [AG2 (community AutoGen continuation)](https://github.com/ag2ai/ag2) la línea de AutoGen v0.2 en vivo después de que Microsoft moviera v0.4 en mantenimiento
