# El arnés como biblioteca  Subbagents y tienda de sesiones

> Un arnés que puede importar: herramientas incorporadas, subagentes para aislamiento de contexto, ganchos, propagación de rastros W3C, persistencia de sesión. El SDK de agente Claude es el ejemplo de referencia  la forma de biblioteca del arnés de código Claude  y Claude Managed Agents es la alternativa alojada para el trabajo de sincronización de larga duración.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 10 (Skill Libraries)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Explique la diferencia entre el SDK del cliente antropico (API prima) y el SDK del agente Claude (forma de arnés).
- Describa los subgentes  paralelación y aislamiento de contexto  y cuándo alcanzarlos.
- Nombre de la superficie de almacenamiento de sesión del SDK Python (`append`¿ Qué ?`load`¿ Qué ?`list_sessions`¿ Qué ?`delete`¿ Qué ?`list_subkeys`) y el papel de `--session-mirror`¿ Qué ?
- Implemente un arnés stdlib con herramientas incorporadas, desove subagente con contexto aislado, ganchos de ciclo de vida y una tienda de sesiones.

## El problema

Una API de LLM crudo te da un viaje de ida y vuelta. Un agente de producción necesita ejecución de herramientas, servidores MCP, ganchos de ciclo de vida, desove subagente, persistencia de sesión, propagación de huellas. Claude Agent SDK envía esta forma como una biblioteca  el mismo arnés que Claude Code utiliza, expuesto para agentes personalizados.

## El concepto

### SDK del cliente vs SDK del agente

- **Client SDK (`anthropic`).**Eres dueño del bucle, de las herramientas, del estado.
- **Agent SDK (`claude-agent-sdk`).**Ejecución de herramientas integradas, conexiones MCP, ganchos, desove subagente, almacenamiento de sesiones.

### Herramientas incorporadas

El SDK envía más de 10 herramientas de la caja: lectura/escritura de archivos, shell, grep, glob, web fetch, etc. Herramientas personalizadas se registran a través de la interfaz estándar de esquema de herramientas.

### Sub-cargas

Dos propósitos documentados por Anthropic:

1. **Parallelization.**Realizar trabajo independiente simultáneamente. "Encuentra el archivo de prueba para cada uno de estos 20 módulos" es 20 tareas paralelas de subagente.
2. **Context isolation.**Los subjugadores utilizan su propia ventana de contexto; sólo los resultados regresan al orquestrador.

Python SDK recientes adiciones: `list_subagents()`¿ Qué ?`get_subagent_messages()`para leer las transcripciones de subagento.

### Tienda de sesiones

Paridad de protocolo con TypeScript:

- `append(session_id, message)` añadir un giro.
- `load(session_id)` restaurar la conversación.
- `list_sessions()` enumerar.
- `delete(session_id)` con sesiones en cascada a subagentes.
- `list_subkeys(session_id)` lista de las claves de subagente.

`--session-mirror`(Bandereta CLI) refleja la transcripción a un archivo externo mientras fluye, para depurar.

### Los ganchos

Los ganchos de ciclo de vida que se pueden registrar:

- `PreToolUse`¿ Qué ?`PostToolUse` llamadas de puerta o de herramienta de auditoría.
- `SessionStart`¿ Qué ?`SessionEnd`- Construir y derribar.
- `UserPromptSubmit` actuar sobre la entrada del usuario antes de que el modelo la vea.
- `PreCompact` ejecutarse antes de la compactación del contexto.
- `Stop` limpieza en la salida del agente.
- `Notification` Alertas de canales laterales.

Los ganchos son la forma en que los flujos de trabajo (referencia del currículo de la Fase 14) y sistemas similares añaden comportamiento transversal.

### Contexto de la traza W3C

Las extensiones de OTel activas en el llamador se propagan al subproceso CLI a través de los encabezados de contexto de rastreo W3C.

### Claude manejaba a los agentes

La alternativa alojada (título beta `managed-agents-2026-04-01`La gestión de la información en el mercado de la información y la información en el mercado de la información.

### Cuando este patrón va mal

- **Subagent over-spawn.**Desprender 100 subagentes para 100 tareas pequeñas.
- **Hook creep.**Cada equipo añade ganchos, globos de tiempo de inicio, revisa ganchos trimestralmente.
- **Session bloat.**Las sesiones se acumulan, el tamaño crece.`list_sessions`+ Política de vencimiento.

```figure
ae-subagent-isolation
```

## Construye el mismo

`code/main.py`Implementa la forma SDK en stdlib:

- `Tool`¿ Qué ?`ToolRegistry`con incorporado `read_file`¿ Qué ?`write_file`¿ Qué ?`list_dir`¿ Qué ?
- `Subagent` contexto privado, ejecución aislada, resultados devueltos.
- `SessionStore` añadir, cargar, listar, borrar, list_subkey.
- `Hooks`¿ Qué es esto ?`pre_tool_use`¿ Qué ?`post_tool_use`¿ Qué ?`session_start`¿ Qué ?`session_end`¿ Qué ?
- Una demostración: el agente principal genera 3 subpagentes en paralelo (cada uno aislado), agrega los resultados, persiste la sesión.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

El rastro muestra el aislamiento de contexto subagente (el tamaño del contexto del orquestrador se mantiene limitado), la ejecución del gancho y la persistencia de la sesión.

## Usalo

- **Claude Agent SDK**para productos de Claude-first que quieren la forma de arnés de código Claude.
- **Claude Managed Agents**para el trabajo de asíncrono de larga duración alojado.
- **OpenAI Agents SDK**(Ley 16) para las contrapartes de OpenAI-primero.
- **LangGraph + custom tools**Si quieres la máquina de estado en forma de gráfico en su lugar.

## Envío

`outputs/skill-claude-agent-scaffold.md`plantillas de una aplicación de Claude Agent SDK con subagents, ganchos, almacenamiento de sesiones, servidor MCP adjunto, y W3C de la propagación de rastros.

## Los ejercicios

1. Añadir un deslizador de subbagentes que agrupa 20 tareas en grupos de 5 subbagentes paralelos. Medir el tamaño del contexto del orquestrador frente a uno por tarea.
2. Implementar una `PreToolUse`Cuelga ese límite de tarifas `write_file`Las llamadas (5 minutos por sesión).
3. El cable`list_subkeys`¿Cómo es el anidamiento profundo?
4. Llevar el juguete al real `claude-agent-sdk`¿Qué cambios hay en el registro de herramientas?
5. ¿Cuándo pasarías de auto-host a administrado?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent SDK | "Claude Code as a library" | Harness shape: tools, MCP, hooks, subagents, session store |
| Subagent | "Child agent" | Separate context, own budget; results bubble up |
| Session store | "Conversation DB" | Persist, load, list, delete turns with subagent cascade |
| Hook | "Lifecycle callback" | Pre/post tool, session, prompt submit, compact, stop |
| W3C trace context | "Cross-process trace" | Parent span propagates into CLI subprocess |
| Managed Agents | "Hosted harness" | Anthropic-hosted long-running async work |
| `--session-mirror` | "Transcript mirror" | Writes session turns to an external file as they stream |
| MCP server | "Tool surface" | External tool/resource source attached to the agent |

## Leer más

- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) la forma de biblioteca de Claude Code
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) patrones de producción
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) alternativa alojada
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) contraparte
