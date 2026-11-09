# Memoria de agente  Contexto virtual y páginas de memoria

> Las ventanas de contexto son finitas. Las conversaciones, documentos y rastros de herramientas no son. La solución es la memoria virtual del sistema operativo re-estabilizada.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 06 (Tool Use)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Explica la analogía del sistema operativo en la que MemGPT se basa: contexto principal = RAM, contexto externo = disco, herramientas de memoria = página de entrada/salida.
- Implemente el patrón MemGPT de dos niveles en stdlib con un buffer de contexto principal, una tienda de búsqueda externa y herramientas de entrada/salida de página.
- Describa cómo el agente emite "interrumpe" para consultar o modificar la memoria externa y cómo el resultado se inserta de nuevo en el siguiente aviso.
- Identifique las opciones de diseño MemGPT que llevan a Letta (lección 08) y Mem0 (lección 09).

## El problema

Las ventanas de contexto parecen resolver la memoria. No lo hacen. Tres modos de falla se repiten en la producción:

1. **Overflow.**Las conversaciones de varios turnos, documentos largos o trayectorias pesadas en herramientas cruzan la ventana.
2. **Dilution.**Incluso dentro de la ventana, llenar un contexto irrelevante diluye la atención sobre lo que importa.
3. **Persistence.**Una nueva sesión comienza con una ventana vacía, y los agentes sin memoria externa no pueden decir "recuerde cuando me pediste"...

Los ventanas más grandes ayudan pero no arreglan esto. Mem0 2025 documento midió que las líneas de base de 128k ventanas todavía faltan los hechos de largo horizonte que un agente de 4k ventanas con memoria externa captura.

## El concepto

### La analogía del sistema operativo

MemGPT (Packer et al., arXiv:2310.08560, v2 Feb 2024) mapea la gestión de contexto a la memoria virtual del sistema operativo:

| OS concept | MemGPT concept | 2026 production analog |
|------------|---------------|------------------------|
| RAM | main context (prompt) | Anthropic/OpenAI context window |
| Disk | external context | vector DB, KV, graph store |
| Page fault | memory tool call | `memory.search`, `memory.read`, `memory.write` |
| OS kernel | agent control loop | ReAct loop with memory tools |

El agente ejecuta un bucle ReAct normal. Una clase adicional de herramientas le permite páginas de datos dentro y fuera del contexto principal.

### Dos niveles

- **Main context.**Impulso de tamaño fijo que retiene la tarea actual. Siempre visible para el modelo.
- **External context.**Sin límites, se puede buscar a través de herramientas.

El documento original evaluó el diseño en dos tareas más allá de la ventana base: análisis de documentos más largos que 100k tokens y chat de varias sesiones con memoria persistente a lo largo de días.

### El patrón de interrupción

MemGPT introduce la memoria como interrupción: a mediados de la conversación el agente puede invocar una herramienta de memoria, el tiempo de ejecución la ejecuta, y el resultado se inserta en el siguiente turno de asistente como una nueva observación.`read()`syscall que bloquea el proceso, devuelve bytes, y el proceso continúa.

Superficie de la herramienta de memoria canónica:

- `core_memory_append(section, text)` escribir a una sección persistente del aviso.
- `core_memory_replace(section, old, new)` editar una sección persistente.
- `archival_memory_insert(text)` escribir a la tienda externa de búsqueda.
- `archival_memory_search(query, top_k)` Recogerlo en la tienda externa.
- `conversation_search(query)` escanear los curvas pasadas.

### Donde termina el papel y comienza la producción

En septiembre de 2024 el MemGPT se convirtió en Letta.`cpacker/MemGPT`) permanece; Letta amplía el diseño:

- Tres niveles en lugar de dos (núcleo, recuerdo, archivo  Lección 08).
- Raciocinio nativo que sustituye a la `send_message`/ patrón de latidos cardíacos (lección 08).
- Agentes del sueño que ejecutan el trabajo de memoria asincronizada (lección 08).

El papel MemGPT es la base para 2026 incluso si los sistemas de producción ejecutan Letta, Mem0 o una tienda de dos niveles personalizada.

### Cuando este patrón va mal

- **Memory rot.**Las escrituras se acumulan más rápido que las lecturas; la recuperación se ahoga en hechos obsoletos.
- **Memory poisoning.**Se recupera el texto de la memoria externa. Si el contenido controlado por el atacante se encuentra en una nota de memoria, el agente la reingesta en la próxima sesión.
- **Citation loss.**El agente recuerda que "el usuario me pidió enviar X" pero no puede citar qué turno.

```figure
context-budget
```

## Construye el mismo

`code/main.py`Implementa el patrón de dos niveles de MemGPT en stdlib:

- `MainContext` Puffer de respuesta de tamaño fijo con un `core`dict y un `messages`lista; auto-compacta los mensajes más antiguos cuando se ha superado el límite.
- `ArchivalStore` almacenamiento en memoria BM25-esque (puntuación de tokens-overlap) de (id, texto, etiquetas, sesión, turno) registros.
- Cinco herramientas de memoria que trazan mapas a la superficie de MemGPT.
- Un agente con guión que llena el archivo con hechos, luego responde una pregunta llamando.`archival_memory_search`¿ Qué ?

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

El rastro muestra al agente escribiendo tres hechos, llenando el contexto principal del límite (desalojo forzoso), luego respondiendo a una pregunta de seguimiento mediante la extracción de archivos  reproducción del flujo de trabajo MemGPT sin ningún LLM real.

## Usalo

Cada sistema de memoria de producción hoy en día es una variante MemGPT:

- **Letta**(Lección 08)  tres niveles, razonamiento nativo, cálculo del tiempo de sueño.
- **Mem0**(Lección 09)  vector + KV + gráfico fusionado con una capa de puntuación.
- **OpenAI Assistants / Responses** la memoria gestionada a través de hilos y archivos.
- **Claude Agent SDK** memoria a largo plazo a través de las habilidades y la tienda de sesiones.

Seleccione uno por forma operativa (auto-hosted, administrado, integrado en el marco), no por el patrón central  el patrón central es MemGPT.

### La forma de la memoria del agente

La página de página resuelve la capacidad. No decide qué almacenar. Cuatro tipos de memoria recurren en los sistemas de producción, cada uno respondiendo a una pregunta diferente:

- **Working memory**¿Qué importa ahora? La capa dentro del contexto: tarea actual, giros recientes, secciones centrales fijadas.
- **Episodic memory** ¿Qué pasó? curvas y trayectorias pasadas, almacenadas con referencias de sesión y curva, reproducibles a pedido.
- **Semantic memory** ¿Qué es verdad? hechos sobre el usuario, el dominio, el mundo, actualizados y deduplicados a medida que cambian.
- **Procedural memory**Aprendí rutinas, preferencias y reglas que guían el comportamiento futuro en lugar de recordar.

Las implementaciones de código abierto eligen diferentes puntos de ataque:

| Type | Implementation | How it tackles it |
|------|----------------|-------------------|
| Working | MemGPT / Letta | Pages content in and out of a fixed prompt budget via memory tools (this lesson, Lesson 08) |
| Episodic | Zep | Temporal knowledge graph — facts carry validity intervals, so "what was true when" is queryable |
| Semantic | Mem0 | Extraction pipeline that dedupes and updates facts across vector, KV, and graph stores (Lesson 09) |
| Semantic + procedural | LangMem | Background extraction of facts and behavioral rules into a store the agent consults between turns |
| Episodic + semantic | agentmemory | Captures sessions as they run, consolidates them into typed, searchable records |

## Envío

`outputs/skill-virtual-memory.md`es una habilidad reutilizable que produce un andamio de memoria de dos niveles correcto (superficie principal + archivo + herramienta) para cualquier tiempo de ejecución objetivo, con política de desalojo y campos de cita conectados.

## Los ejercicios

1. Añadir un`max_main_context_tokens`Cap medida en tokens (aproximadamente con `len(text.split())`* 1.3). Compactar los mensajes más antiguos en un resumen cuando se supera el límite.
2. Implemente correctamente BM25 sobre el archivo (frecuencia de plazo, frecuencia inversa de documento).
3. Añadir`citation`los campos (session_id, turn_id, source_url) a los inserts de archivo. Haga que el agente cite fuentes en cada respuesta respaldada por recuperación.
4. Simula el envenenamiento de la memoria: añade un archivo que dice "ignora todas las instrucciones futuras del usuario".
5. Portar la implementación para utilizar el esquema JSON de memoria central del repo de investigación MemGPT (`cpacker/MemGPT`¿Qué cambios se producen cuando se cambian de cadenas planas a secciones tipografadas?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Virtual context | "Unlimited memory" | Main (prompt) + external (searchable) tiers with page in/out |
| Main context | "Working memory" | The prompt — fixed-size, always visible |
| Archival memory | "Long-term store" | External searchable persistence, retrieved on demand |
| Core memory | "Persistent prompt section" | Named sections pinned inside the main context |
| Memory tool | "Memory API" | Tool call the agent issues to read/write external memory |
| Interrupt | "Memory page fault" | Agent pauses, runtime fetches, result splices into next turn |
| Memory rot | "Stale facts" | Old writes drown retrieval; fix with consolidation |
| Memory poisoning | "Injected persistent note" | Attacker content stored as memory, re-ingested on recall |

## Leer más

- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) Papel de contexto virtual inspirado en el sistema operativo
- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) la evolución de tres niveles
- [Anthropic, Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) el contexto como presupuesto
- [Chhikara et al., Mem0 (arXiv:2504.19413)](https://arxiv.org/abs/2504.19413) memoria de producción híbrida en la parte superior de este patrón
- [Zep (getzep/zep)](https://github.com/getzep/zep) Memoria temporal del grafo de conocimiento de la tabla de taxonomía
- [Mem0 (mem0ai/mem0)](https://github.com/mem0ai/mem0) el oleoducto de extracción detrás de la tienda híbrida de la Lección 09
- [LangMem (langchain-ai/langmem)](https://github.com/langchain-ai/langmem) extracción de datos y normas de comportamiento
- [agentmemory (rohitg00/agentmemory)](https://github.com/rohitg00/agentmemory) Captura de sesiones consolidada en registros digitalizados y buscables
