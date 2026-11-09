# Modelos de orquestación: Supervisor, Cuerpo, Jerárquico

> Cuatro patrones de orquestación se repiten en los marcos 2026: supervisor-trabajador, enjambre / peer-to-peer, jerárquico, debate. La guía de Anthropic: "Se trata de construir el sistema adecuado para sus necesidades".

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 25 (Multi-Agent Debate)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Nombre los cuatro patrones de orquestación recurrentes y cuándo cada uno encaja.
- Describa la recomendación de LangChain 2026: supervisión basada en herramientas y bibliotecas supervisoras.
- Explica la regla de "construir el sistema correcto" de Anthropic y cómo se aborda la elección de topología.
- Implementar los cuatro en un estudio contra un LLM con guión común.

## El problema

Los equipos buscan "multi-agente" antes de necesitarlo. Cuatro patrones se repiten en los marcos; una vez que se puede nombrarlos, se puede elegir el correcto  o saltar la topología por completo.

## El concepto

### Trabajadores supervisores

- Un LLM de enrutamiento central envía a agentes especializados.
- Decide: volver a sí mismo, entregar a un especialista, terminar.
- Los especialistas no se hablan entre sí; todo el enrutamiento pasa por el supervisor.

Cuadro: LangGraph `create_supervisor`, trabajadores de la Orquesta Antropical, Proceso Jerárquico de la CrewAI.

**2026 LangChain recommendation:**hacer supervisión a través de llamadas directas a herramientas en lugar de `create_supervisor`. Da un control de ingeniería de contexto más preciso  decides exactamente lo que ve cada especialista.

### En el caso de los productos de la industria de la industria de la producción, el precio de la producción se calcula en el caso de los productos de la industria de la industria de la industria de la producción.

- Los agentes se entregan directamente a través de una superficie compartida de herramientas.
- No hay router central.
- Menos latencia que la de supervisor (menos saltos).
- Más difícil de razonar sobre (ningún punto de control único).

Marco: Topología de enjambre LangGraph, entrega de SDK de OpenAI Agents (cuando todos los agentes pueden entregar a todos los demás).

### Los niveles de orden

- Supervisores que gestionan subsupervisores que gestionan trabajadores.
- Implementados como subgrafos anidados en LangGraph; tripulaciones anidadas en CrewAI.
- Escala a grandes poblaciones de agentes a costa de la complejidad operativa.

Cuando lo necesite: cuando el presupuesto contextual de un solo supervisor no puede contener descripciones de todos los especialistas.

### Debate sobre el tema

- Proponentes paralelos + crítica cruzada iterativa (lección 25).
- No es realmente orquestación  más verificación  pero aparece como una opción de topología en los marcos.

### Los equipos autónomos vs flujos deterministas

CrewAI formaliza dos modos de despliegue:

- **Flow**para la automatización determinista basada en eventos (punto de partida recomendado para la producción).
- **Crew**para la colaboración autónoma basada en el papel.

Esto es ortogonal a los cuatro patrones anteriores, pero los mapas a la topología: Flow es típicamente supervisor o jerárquico; Crew es típicamente supervisor con un router LLM.

### La guía de Anthropic

"El éxito en el área de LLM no se trata de construir el sistema más sofisticado, sino de construir el sistema adecuado para tus necesidades".

Orden de decisión:

1. Un agente único + patrones de flujo de trabajo (lección 12)  comienzan aquí.
2. Trabajo supervisor  cuando usted tiene 2-4 especialistas.
3. Swarm  cuando la latencia importa más que la claridad del razonamiento.
4. Hierarquico  sólo cuando el presupuesto de contexto de supervisión falla.
5. Debate  cuando la precisión es más importante que el costo.

### Cuando este patrón va mal

- **Topology-first thinking.**"Necesitamos multi-agente" antes de identificar qué problema multi-agente resuelve.
- **Bouncing handoffs in swarm.**A -> B -> A -> B. Utilice contadores de salpicaduras.
- **Fake hierarchy.**Tres capas porque "empresa"; dos equipos reales.

```figure
orchestration-pattern
```

## Construye el mismo

`code/main.py`Implementa los cuatro patrones en stdlib contra un LLM con guión:

- `Supervisor` Router central.
- `Swarm` Peer-to-peer con entregas directas.
- `Hierarchical` Supervisores de supervisores.
- `Debate` Propososos paralelos + crítica.

Cada patrón maneja la misma tarea de tres intenciones (reembolso / error / ventas).

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

Resultado: rastreo por patrón + recuento de operaciones. Supervisor es más limpio; enjambre es más corto; jerárquico es más profundo; debate es más caro.

## Usalo

- **LangGraph**para supervisores y jerárquicos (subgrafos anidados).
- **OpenAI Agents SDK**para las entregas como herramientas (en forma de supervisor).
- **CrewAI Flow**para la determinación de la producción.
- **Custom**para el debate o cuando quieras el control exacto.

## Envío

`outputs/skill-orchestration-picker.md`elige una topología y la implementa.

## Los ejercicios

1. Convierte a un supervisor en un enjambre quitando el router. ¿Qué se rompe? ¿Qué mejora?
2. Añadir un contador de salto al enjambre: rechazar después de 3 entregas. ¿Coge A->B->A rebotando?
3. ¿Cuál es el presupuesto de contexto que falla sin anidar?
4. Profilar los cuatro patrones en una carga de trabajo en forma de producción. ¿Cuál gana en qué métrica (latencia, costo, precisión, descomposición)?
5. Lea el post de Anthropic sobre "Construir agentes eficaces" y mapa cada uno de sus flujos de producción a uno de los cuatro. ¿Alguno que no haga un mapa limpio?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Supervisor-worker | "Router + specialists" | Central LLM dispatches to specialists; they don't talk to each other |
| Swarm | "Peer-to-peer" | Direct handoffs via shared tools; no central router |
| Hierarchical | "Supervisors of supervisors" | Nested subgraphs for large populations |
| Debate | "Proposer + critique" | Parallel proposers, cross-critique (Lesson 25) |
| Tool-call-based supervision | "Supervisor without a library" | Implement supervisor as direct tool calls for context control |
| Crew | "Autonomous team" | CrewAI's role-based collaboration mode |
| Flow | "Deterministic workflow" | CrewAI's event-driven production mode |

## Leer más

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) cinco patrones + agente vs flujo de trabajo
- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) supervisor, enjambre, jerárquico
- [CrewAI docs](https://docs.crewai.com/en/introduction) Equipamiento vs flujo
- [Du et al., Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) Modelo de debate
