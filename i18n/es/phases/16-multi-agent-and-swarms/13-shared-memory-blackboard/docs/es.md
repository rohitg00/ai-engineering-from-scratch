# Memoria compartida y patrones de tablero negro

> En 2026 coexistirán dos enfoques en los sistemas multiagentes: el **message pool**(todo el mundo ve los mensajes de todos, como en AutoGen GroupChat o MetaGPT) y el **blackboard with subscription**(los agentes se suscriben a eventos relevantes, como en el MCP Context-Aware o el marco de Matrix). Ambos son la única parte de estado de un sistema multi-agente  lo que significa que ambos son donde viven los errores interesantes.**memory poisoning**El estudio de la teoría de la alucinación de un "hecho" en una serie de estudios de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la investigación de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de los resultados de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de los resultados de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de los resultados de la ciencia de la ciencia de la ciencia de la ciencia de la ciencia de la

**Type:** Learn + Build
**Languages:** Python (stdlib, `threading`), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## El problema

Los sistemas multi-agentes necesitan un lugar para que los agentes compartan hechos. Una opción literal es "pasar todo en mensajes"  pero que reinventa el estado compartido con copias adicionales. Otro es "dar a todos un registro global"  pero los registros globales crecen ilimitados y envenen fácilmente. Un tercero es "proyectar una vista por agente"  escalable pero con esquema pesado.

Cuando uno de los agentes alucina y escribe la alucinación en estado compartido, cada agente en el torrente que lee ese estado adopta la alucinación como un hecho. Para el momento en que los humanos se dan cuenta, la cadena de razonamiento es de cinco pasos de profundidad y la causa raíz es el tercer mensaje escrito.

Este es el envenenamiento de la memoria. Es la segunda familia de fallas más documentada en la taxonomía MAST (Cemri et al., arXiv:2503.13657) y es estructural: cualquier diseño de memoria compartida sin procedencia y un verificador no escriturable lo exhibirá eventualmente.

## Concepto

### Las dos topologías principales

**Full message pool.**Cada agente lee cada mensaje. AutoGen GroupChat y MetaGPT usan esto. Simple, transparente, inspectable, pero no se escala más allá de ~ 10 agentes porque el contexto de cada agente se llena con el trabajo de otros agentes.

```
agent-A ──write──▶ ┌────────────────┐ ◀──read── agent-D
                   │ message pool   │
agent-B ──write──▶ │                │ ◀──read── agent-E
                   │ (global log)   │
agent-C ──write──▶ └────────────────┘ ◀──read── agent-F
```

**Blackboard with subscription.**Los agentes declaran interés en los temas; los substratos sólo rutas mensajes relevantes. CA-MCP (arXiv:2601.11595) y el marco descentralizado de Matrix (arXiv:2511.21686) utilizan esto. Escala más, pero requiere un diseño de esquema por adelantado para hacer suscripciones significativas.

```
                   ┌─ topic: prices ──┐
agent-A ──pub────▶ │                  │ ──▶ agent-D (subscribed)
                   ├─ topic: orders ──┤
agent-B ──pub────▶ │                  │ ──▶ agent-E (subscribed)
                   ├─ topic: alerts ──┤
agent-C ──pub────▶ │                  │ ──▶ agent-F (subscribed)
                   └──────────────────┘
```

### Cuando cada uno gana

- **Full pool**La razón por la que se dice lo que es trivial cuando todo el mundo lo ve.
- **Blackboard**Los agentes de rodaje de datos de la red de rodaje de datos de la red de rodaje de datos de la red de rotación de datos de datos de la red de rotación de datos de datos de la red de rotación de datos de datos de la red de rotación de datos de datos de la red de rotación de datos de datos de la red de rotación de datos de datos de la red de rotación de datos de datos de datos de la red de rotación de datos de datos de datos de la red de rotación de datos de datos de datos de datos de datos de la red de rotación de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de

Los sistemas de producción a menudo se mezclan: una pequeña piscina completa en la parte superior (capas de planificación), tablas negras por debajo (capas de trabajadores).

### Envenenamiento de la memoria, en un escenario

Tres agentes trabajan en una tarea de investigación, el agente A es un agente de recuperación, el agente B es un resumidor, el agente C es un analista.

1. A trae una página y escribe un mensaje a la declaración compartida: "El estudio informa una mejora de precisión del 42%".
2. La página que se trajo en realidad decía "Mejora del 4,2%". Una alucinó una decimal.
3. B, leyendo el estado compartido, escribe: "Gran aumento de precisión del 42% reportado (fuente: A). "
4. C, leyendo el estado compartido, escribe: "Recomendar la adopción  42% elevación es transformador".
5. El informe final cita un número del 42% que nunca existió.

Ningún agente se estrelló, ninguna prueba falló, el sistema "funcionó", la alucinación pasó del contexto de un agente al razonamiento de cada agente a través del estado compartido.

### ¿Por qué esto es estructural?

Sin estado compartido, la alucinación del agente A permanece en el contexto de A. Los agentes de abajo recogerían o rederivarían y podrían atrapar el error.

El problema no es el estado compartido en sí mismo  es el estado compartido **without provenance and without an independent verifier**Tres medidas de mitigación se refieren a esto:

1. **Attribute provenance on every write.**Cada entrada en los registros estatales compartidos quién la escribió, cuándo, bajo qué instante y (si corresponde) qué fuente citó el agente.
2. **Version writes; treat them as append-only.**Una corrección es una nueva entrada que sustituye a la antigua, no una actualización en el lugar.
3. **Keep at least one agent that cannot write to shared state.**Un agente de verificación de sólo lectura muestra entradas, recoge fuentes y señala inconsistencias. Todavía lee el grupo, por lo que puede ser engañado por una mala entrada, pero verifica cada entrada contra la fuente original y no puede escribir, por lo que sus veredictos nunca devuelven un hecho envenenado al estado compartido.

### Precedente de tablero negro (Hayes-Roth, 1985)

El patrón de la pizarra es anterior a los agentes de LLM en cuatro décadas. Hayes-Roth (1985, "Una arquitectura de tablero negro para el control") describió a las fuentes de conocimiento especializadas que observan una tablero negro global, contribuyen a soluciones parciales y desencadenan otras fuentes. La pizarra negra 2026 (CA-MCP, Matrix) es el mismo patrón con agentes LLM como fuentes de conocimiento y manchas JSON como soluciones parciales. La antigua literatura ha documentado soluciones para escribir contención, control oportunista y coherencia que los sistemas modernos redescubren.

### Proyección frente a vista completa

Una tabla negra pura da a cada suscriptor la misma proyección (tema-escalada).**per-agent projection**Las reducciones de estado de LangGraph son la implementación canónica de 2026  la función de reducción dobla el estado global en una rodaje específico de función.

La proyección por agente se expande más, pero necesita un esquema.

### Modelos de contenido de escritura

El problema de la concurrencia es que varios agentes escriben simultáneamente, no sólo un problema de LLM.

- **Sequential writer (single producer).**Todos los escritos pasan por un agente coordinador que serializa.
- **Optimistic concurrency with versioning.**Cada entrada tiene una versión; los escritores fallan en la incompatibilidad de versiones y vuelven a intentarlo.
- **Topic partitioning.**Los diferentes agentes poseen temas diferentes, no hay discusiones entre temas, requiere límites de partición diseñados.

La mayoría de los marcos 2026 son por defecto escritores secuenciales porque las llamadas de LLM son lo suficientemente lentas como para que la contención sea rara y el cuello de botella no lastime.

### El verificador no escriturable

La más eficaz de la mitigación es el verificador de lectura única.

- El verificador comparte el estado con el equipo (leer la pizarra o el grupo).
- Verificador no tiene manillar de escritura para compartir estado  sólo a un canal de verificación separado.
- Verificador de forma independiente busca fuentes citadas en los escritos.
- Las propias salidas del verificador se envía a un humano o a un agente de decisión separado, nunca devueltas a la piscina.

Sin esta separación, las salidas del verificador se convierten en nuevas entradas en el grupo, lo que significa que un grupo envenenado envenena al verificador, lo que envenena sus verificaciones.

```figure
swarm-blackboard
```

## Construye el mismo

`code/main.py`Implementa ambas topologías en Stdlib Python más un ataque de intoxicación de juguete y las tres mitigaciones.

- `MessagePool` Registro de sólo apéndice de hilo seguro con lectura completa.
- `Blackboard` Pub/sub con suscripciones por agente.
- `ProvenanceEntry` todos los registros de escritura (escrito, timestamp, prompt_hash, source_uri).
- `PoisoningScenario` ejecuta una tarea de investigación de tres agentes donde el agente A alucina una decimal.
- `Verifier` un agente de sólo lectura que recoge las fuentes y señala las inconsistencias.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

Producción esperada:
- Corrida 1 (sin verificador): el 42% alucinado se propaga al informe final.
- Corriendo 2 (con verificador): el verificador señala la inconsistencia, el grupo está etiquetado "banderado", el informe final incluye una retractación.

## Usalo

`outputs/skill-memory-auditor.md`Es una habilidad que audita el diseño de memoria compartida de cualquier sistema multi-agente para la procedencia, la versión y la separación de verificadores.

## Envío

Para cualquier diseño de memoria compartida:

- Registra la procedencia en cada escrito: `(writer, timestamp, prompt_hash, tool_calls_cited, source_uri)`¿ Qué ?
- Las correcciones son nuevas entradas que hacen referencia a la sustituida.
- Entablar al menos un agente de verificación de sólo lectura con acceso independiente a la fuente.
- La salida del verificador de ruta a un canal separado, no de vuelta al grupo compartido.
- El registro de la proporción de escritos que son superecciones  una proporción creciente es evidencia temprana de patrones de alucinación.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Confirme que la primera prueba propaga la alucinación y la segunda prueba la captura.
2. Añadir una segunda alucinación: el agente B inventa un conjunto de datos de tamaño. El verificador debe capturar ambos sin ser sintonizado a mano para ninguno de ellos.
3. Cambiar la piscina completa a una pizarra con particiones de temas (`prices`¿ Qué ?`summaries`¿ Qué ?`analyses`¿Qué escenarios de intoxicación dificulta la partición de temas, y cuáles no ayudan?
4. Lea Hayes-Roth (1985, "A Blackboard Architecture for Control"). Identifique dos patrones de control del documento que no se discuten en esta lección de los que se beneficiarían los sistemas de 2026.
5. Lea CA-MCP (arXiv:2601.11595). Mapa de su Compañía de Contexto Compartido a la clase de MessagePool o Blackboard en `code/main.py`¿Qué primitivas añade CA-MCP a la parte superior?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Message pool | "Shared chat history" | Append-only log that every agent reads. Full transparency, poor scaling. |
| Blackboard | "Shared workspace" | Topic-keyed pub/sub. Agents subscribe to relevant topics. Scales farther. |
| Provenance | "Who wrote what" | Metadata on each write: writer, timestamp, prompt, sources. |
| Memory poisoning | "Hallucinations spreading" | One agent's error enters shared state, downstream agents adopt it as fact. |
| Append-only | "No in-place updates" | Corrections are new entries that supersede. Preserves audit trail. |
| Unwritable verifier | "Independent auditor" | Read-only agent that re-fetches sources and flags inconsistencies. |
| Projection | "Scoped view" | Per-agent view computed from global state. LangGraph reducers are the canonical case. |
| Knowledge Source | "Specialist agent" | Hayes-Roth's 1985 term for a blackboard participant. |

## Leer más

- [Cemri et al. — Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) Taxonomía MAST; el envenenamiento por memoria es una subfamilia de fallos de coordinación
- [CA-MCP — Context-Aware Multi-Server MCP](https://arxiv.org/abs/2601.11595) Almacenamiento compartido de contexto para servidores MCP coordinados
- [Matrix — decentralized multi-agent framework](https://arxiv.org/abs/2511.21686) tablero basado en la cola de mensajes sin un orquestrador central
- [LangGraph state and reducers](https://docs.langchain.com/oss/python/langgraph/workflows-agents) el patrón de proyección por agente en la producción
- [Anthropic — How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) Notas de procedencia y verificación de una instalación de producción
