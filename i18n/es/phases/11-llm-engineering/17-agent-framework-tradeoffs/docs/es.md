# Negocios de marco de agentes  Gráfico, papel y orquestación de actores

> Cada marco vende la misma demostración (el agente de investigación construye un informe) y oculta el mismo error (el esquema de estado lucha con la capa de orquestación).

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 16 (LangGraph)
**Time:** ~45 minutes

## El problema

Puede ser un flujo de trabajo de investigación (planar, buscar, resumir, citar). Puede ser un flujo de revisión de código (parse diff, criticar, parchear, validar). Puede ser un asistente de múltiples turnos que hace libros de vuelos, escribe correos electrónicos y archivará informes de gastos.

Tres días después, descubres la fuga de abstracciones del marco. CrewAI te da roles pero te pelea cuando el "investigador" necesita entregar un plan estructurado al "escrito". AutoGen te da chat entre agentes pero no tiene estado de primera clase así que tu punto de control es un picante de un registro de conversaciones. LangGraph te da un gráfico de estado pero te obliga a nombrar cada transición antes de saber lo que hará el agente. Agno te da una abstracción de un solo agente que grita cuando intentas extenderte a tres trabajadores simultáneos.

La solución no es "elija el mejor marco". Es para coincidir con la abstracción del núcleo del marco a la forma de su problema.

## El concepto

![Agent framework matrix: core abstraction vs problem shape](../assets/framework-matrix.svg)

Cuatro marcos dominan el paisaje de 2026. Sus abstracciones centrales no son las mismas.

| Framework | Core abstraction | Best fit | Worst fit |
|-----------|------------------|----------|-----------|
| **LangGraph** | `StateGraph` — typed state, nodes, conditional edges, checkpointer. | Workflows with explicit state and human-in-the-loop interrupts; production agents needing time-travel debugging. | Loose, role-driven brainstorming where the topology is unknown. |
| **CrewAI** | `Crew` — roles (goal, backstory), tasks, process (sequential or hierarchical). | Role-playing or persona-driven workflows with a short linear/hierarchical plan. | Anything stateful beyond the crew's turn history; complex branching. |
| **AutoGen** | `ConversableAgent` pair — two or more agents that speak in turns until an exit condition. | Multi-agent *dialogue* (teacher-student, proposer-critic, actor-reviewer) where the thinking emerges from the chat. | Deterministic workflows with a known DAG; anything needing durable state across restarts. |
| **Agno** | `Agent` — a single LLM + tools + memory, composable into teams. | Fast-to-build single agents and lightweight teams; strong multi-modality and built-in storage drivers. | Deep, explicitly-branched graphs with custom reducers. |

### ¿Qué significa realmente "abstracción"?

La abstracción central de un marco es lo que dibujas en la pizarra cuando presentas la arquitectura.

- **LangGraph**Los nodos son pasos, los bordes son transiciones, y el objeto de estado en cada punto se escribe.
- **CrewAI**→ se dibuja un organograma. cada rol tiene una descripción de trabajo y un gerente rutas tareas. el modelo mental es un pequeño equipo de especialistas.
- **AutoGen**Dos agentes se envían mensajes; un tercero se une si necesitas un moderador. El modelo mental es el chat.
- **Agno**→ dibujas una sola caja con herramientas colgando de ella. Pones cajas juntas para un equipo. El modelo mental es "agente con baterías incluidas".

### La cuestión del Estado

El Estado es donde la mayoría de las opciones de marco se desmoronan en la producción.

- **LangGraph.**Estado de tipo (`TypedDict`El modelo Pydantic, por campo reducidores, punto de control de primera clase (SQLite/Postgres/Redis).
- **CrewAI.**Los flujos de estado como cadenas entre las tareas a través de la `context`campo, o estructurados a través de `output_pydantic`No hay una tienda duradera por tripulación fuera de la caja, se puede salir por su cuenta si la tripulación debe sobrevivir a un reinicio.
- **AutoGen.**Estado es el historial de chat y cualquier usuario definido `context`Las transcripciones de conversación persisten; el estado de flujo de trabajo arbitrario no lo hace a menos que escriba adaptadores.
- **Agno.**Impulsores de almacenamiento incorporados (SQLite, Postgres, Mongo, Redis, DynamoDB) conectados a un `Agent`por medio de`storage=` las sesiones de conversación y los recuerdos del usuario persisten automáticamente.

### La cuestión de las ramas

Todos los agentes no triviales se suceden, quien decide las cosas.

- **LangGraph** decide, a través de bordes condicionales. El enrutamiento es una función de Python con ramas nombradas. Las ramas son de primera clase en el gráfico compilado; el checkpointer registra qué rama se tomó.
- **CrewAI** el administrador decide en modo jerárquico; en modo secuencial usted decide en el tiempo de construcción. El enrutamiento está implícito en la lista de tareas; no hay "si" de primera clase fuera del prompt del administrador.
- **AutoGen** los agentes deciden por chat.`GroupChatManager`selecciona el próximo orador; puede escribir a mano un `speaker_selection_method`pero el defecto es impulsado por el LLM.
- **Agno** el agente decide con qué herramienta llamar a continuación. los equipos tienen un modo coordinador/router/colaborador; la ramificación más allá de eso es responsabilidad del desarrollador.

### La cuestión de la observabilidad

- **LangGraph** OpenTelemetry a través de LangSmith o cualquier exportador de OTel. Cada transición de nodo es un lapso de rastreo; los puntos de control se duplican como rastros reproducibles. LangSmith es la opción de primera parte; Langfuse / Phoenix también tiene adaptadores.
- **CrewAI** OpenTelemetry de primera clase desde finales de 2025; integraciones con Langfuse, Phoenix, Opik, AgentOps.
- **AutoGen** Integrar la Telemetría abierta a través de `autogen-core`AgentOps y Opik tienen conectores.
- **Agno** incorporado `monitoring=True`bandera más exportadores OpenTelemetry; estrecha integración con Langfuse para las pistas de sesiones.

### Costo y latencia

Los cuatro frameworks añaden gastos generales por llamada (lógica de marco, validación, serialización). Orden aproximada de aumento de gastos generales: Agno ≈ LangGraph < CrewAI ≈ AutoGen. La diferencia está dominada por la cantidad de enrutamiento adicional de LLM que hace el framework.`GroupChatManager`LangGraph sólo gasta tokens donde escribe.`llm.invoke`El camino de Agno es delgado.

Cuando el costo por carrera es importante, prefiere el enrutamiento explícito (LangGraph edges, AutoGen `speaker_selection_method`) sobre el itinerario seleccionado por el LLM.

### Interoperabilidad

- **LangGraph**¿ Qué es esto ?**LangChain**herramientas, retrievers, LLM. Adaptador MCP de primera clase (herramientas importadas como servidores MCP).
- **CrewAI** herencias heredadas de herramientas `BaseTool`Las herramientas de LangChain, LlamaIndex y MCP se adaptan a la experiencia de la tripulación.`allow_delegation=True`¿ Qué ?
- **AutoGen**¿ Qué es esto ?`FunctionTool`Envuelve cualquier Python de llamadas; adaptador MCP disponible.
- **Agno**¿ Qué es esto ?`@tool`decorador o subclase BaseTool; adaptador MCP; las herramientas pueden ser compartidas entre agentes y equipos.

## La habilidad

> Puedes explicar, en una frase, por qué un marco dado es adecuado para un problema de agente dado.

Lista de verificación de preconstrucción:

1. **Draw the shape.**¿Es un gráfico (estado tipado, transiciones nombradas)? ¿Un juego de rol (especialistas abandonan el trabajo)? ¿Un chat (agentes hablan hasta que terminan)? ¿Un agente único con herramientas?
2. **Decide who branches.**Desarrollo decidido por el desarrollador → LangGraph. Gerente-agente decidido → CrewAI jerárquico. Chat emergente → AutoGen. Herramienta-llamada decidida → Agno.
3. **Check the state budget.**¿Necesitas un currículum desde el punto de control? Viajes en el tiempo? Interrumpe el ser humano a mitad de carrera? Si es así, LangGraph es el predeterminado; sesiones Agno cubren el estado de conversación.
4. **Check the cost budget.**El enrutamiento seleccionado por LLM cuesta tokens adicionales por turno.
5. **Budget the framework overhead.**Cada marco es otra dependencia. Si la tarea es dos llamadas de LLM y una herramienta, escriba 30 líneas de Python simple; ningún marco es más barato que ningún marco.

Rechazarse a buscar un marco antes de poder dibujar el gráfico, el organograma, el chat o la caja de agentes.

## La matriz de decisiones

| Problem shape | Preferred framework | Why |
|---------------|---------------------|-----|
| Workflow DAG with typed state, human approvals, long-running | LangGraph | First-class state, checkpointer, interrupts, time-travel. |
| Research / writing pipeline with distinct roles | CrewAI (sequential) or LangGraph subgraphs | Role-per-task is cheap to express in CrewAI; scale up with LangGraph when branching gets complex. |
| Proposer-critic or teacher-student dialogue | AutoGen | Two-agent chat is its native shape. |
| Single agent with tools, sessions, memory | Agno | Thinnest setup, built-in storage and memory. |
| Thousands of parallel fanouts with reducers | LangGraph + `Send` | The only one with a first-class parallel-dispatch API. |
| Quick prototype, no framework commitment | Plain Python + provider SDK | No framework is the fastest framework. |

```figure
l5-framework-fit
```

## Los ejercicios

1. **Easy.**Tome la misma tarea  "investigar la sede de Anthropic, escribir un breve de 200 palabras, citar fuentes"  y implementarlo en LangGraph (cuatro nodos: planear, buscar, escribir, citar) y en CrewAI (tres roles: investigador, escritor, editor).
2. **Medium.**Construir la misma tarea en AutoGen (investigador  escritor chat, editor se une a través `GroupChat`) y Agno (un solo agente con `search_tools`y `write_tools`Las cuatro implementaciones se clasifican en: a) costo por carrera, b) capacidad de reanudar después de un accidente, c) capacidad de inyectar una aprobación humana antes del paso de escritura.
3. **Hard.**Construir un guión de árbol de decisión `pick_framework.py`que toma una breve descripción del problema (JSON: `{has_typed_state, has_roles, has_dialogue, has_parallel_fanout, needs_resume}`En el caso de los casos de la Comisión, el Consejo de Ministros de la Unión Europea (CE) y el Consejo de Ministros de la Unión Europea (CE) han presentado una recomendación con una justificación de una frase.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Orchestration | "How the agents coordinate" | The layer that decides which node/role/agent runs next. |
| Durable state | "Resume after a restart" | State that survives process death, attached to a checkpoint or session store. |
| LLM-selected routing | "Let the model decide" | A planner LLM picks the next step each turn; flexible but pays tokens on every decision. |
| Explicit routing | "Developer decides" | A Python function or static edge picks the next step; cheap and auditable. |
| Crew | "A CrewAI team" | Roles + tasks + process (sequential or hierarchical) bound into a single runnable. |
| GroupChat | "AutoGen's multi-agent chat" | A managed conversation between N agents with a speaker selector. |
| Team (Agno) | "Multi-agent Agno" | Route / coordinate / collaborate mode over a set of agents. |
| StateGraph | "LangGraph's graph" | Typed-state, node, conditional-edge, checkpointer abstraction. |

## Leer más

- [LangGraph documentation](https://langchain-ai.github.io/langgraph/) StateGraph, puntos de control, interrupciones, viajes en el tiempo.
- [CrewAI documentation](https://docs.crewai.com/) Equipos, flujos, agentes, tareas, procesos.
- [AutoGen documentation](https://microsoft.github.io/autogen/) ConversableAgent, GroupChat, equipos, herramientas.
- [Agno documentation](https://docs.agno.com/)Agente, equipo, flujo de trabajo, almacenamiento, memoria.
- [Anthropic — Building effective agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) biblioteca de patrones (cadena de instrucciones, enrutamiento, paralelación, orquestación-trabajadores, evaluador-optimizador) marco-agnóstico.
- [Yao et al., "ReAct: Synergizing Reasoning and Acting" (ICLR 2023)](https://arxiv.org/abs/2210.03629) el bucle cada marco se pone de moda.
- [Wu et al., "AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation" (2023)](https://arxiv.org/abs/2308.08155) El papel de diseño de AutoGen.
- [Park et al., "Generative Agents: Interactive Simulacra of Human Behavior" (UIST 2023)](https://arxiv.org/abs/2304.03442) base de juego de rol en la que se basan las pilas de personajes de estilo CrewAI.
- Fase 11 · 16 (Langgraph)  el marco que esta lección comparte.
- Fase 11 · 19 (Reflexión)  un patrón que se mapea limpio a LangGraph pero incómodo a CrewAI.
- Fase 11 · 22 (Observabilidad de producción)  cómo utilizar el instrumento en función del marco que elija.
