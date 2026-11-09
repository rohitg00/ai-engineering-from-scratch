# Bloques de memoria y cálculo del tiempo de sueño

> Un modelo puede editar directamente un bloqueo de memoria funcional discreto, y un agente del tiempo de sueño que consolida la memoria sincrónicamente mientras el agente principal está inactivo.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 07 (MemGPT)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Nombre de los tres niveles de memoria que utiliza Letta (núcleo, recuerdo, archivo) y el papel de cada uno.
- Explica el patrón de bloqueo de memoria: bloque humano, bloque Persona y bloques definidos por el usuario como objetos de primera clase.
- Describa lo que es la computación del tiempo de sueño, por qué se encuentra fuera del camino crítico y por qué puede ejecutar un modelo más fuerte que el agente principal.
- Implemente un bucle de dos agentes scripted donde un agente principal sirve respuestas y un agente de tiempo de sueño consolida bloques entre turnos.

## El problema

MemGPT (lección 07) resolvió el flujo de control de memoria virtual. Surgieron tres problemas de producción:

1. **Latency.**Cada operación de memoria se encuentra en el camino crítico. Si el agente tiene que recortar, resumir o reconciliar mientras el usuario espera, la latencia de cola explotará.
2. **Memory rot.**Los escritos se acumulan, los hechos contradictorios permanecen, la recuperación se ahoga en el contenido obsoleto.
3. **Structure loss.**Una tienda de archivos plana no puede expresar "el bloque humano siempre está en el prompt; el bloque Persona siempre está en el prompt; el bloque de tareas cambia por sesión".

Letta (letta.com) es el nombre de la plataforma el proyecto MemGPT original adoptado en 2024  el patrón del papel mantiene el nombre MemGPT  y la reescritura de 2026 Letta V1 es un paso posterior y separado.

## El concepto

### Tres niveles

| Tier | Scope | Where it lives | Written by |
|------|-------|----------------|------------|
| Core | Always visible | Inside the main prompt | Agent tool call + sleep-time rewrites |
| Recall | Conversation history | Retrievable | Automatic turn logging |
| Archival | Arbitrary facts | Vector + KV + graph | Agent tool call + sleep-time ingest |

El núcleo es el núcleo MemGPT. Recuerda es el amortiguador de conversación con su cola desalojada.

### Bloques de memoria

Un bloque es una sección tipada, persistente y editable del nivel principal.

- **Human block** hechos sobre el usuario (nombre, función, preferencias, objetivos).
- **Persona block** el concepto de sí mismo del agente (identidad, tono, restricciones).

Letta generaliza a bloques definidos por el usuario: a `Task`bloque para el objetivo actual, un `Project`bloque de datos de base de código, una `Safety`bloque para restricciones duras. Cada bloque tiene un`id`¿ Qué ?`label`¿ Qué ?`value`¿ Qué ?`limit`(capítulo de carácter), `description`(para que el modelo sepa cuándo editarlo).

Los bloques se pueden editar a través de la superficie de la herramienta:

- `block_append(label, text)`
- `block_replace(label, old, new)`
- `block_read(label)`
- `block_summarize(label)` condensa un bloque que está cerca de su límite.

### Computación del tiempo de sueño

La adición 2025 Letta: ejecutar un segundo agente en el fondo, fuera de la ruta crítica.`learned_context`en bloques compartidos, y consolidar o invalidar los registros de archivo.

Propiedades que se desprenden:

- **No latency cost.**Las respuestas primarias no esperan a las operaciones de memoria.
- **Stronger model allowed.**El agente de tiempo de sueño puede ser un modelo más caro y más lento porque no tiene limitaciones de latencia.
- **Natural consolidation window.**Dedup, resumir, invalidar hechos contradictorios cuando el usuario no está esperando.

La forma coincide con cómo trabajan los humanos: haces la tarea, duermes en ella, la memoria a largo plazo se calma durante la noche.

### Razonamiento nativo

Letta V1 (`letta_v1_agent`, 2026) se desactiva `send_message`/bate del corazón y en línea `Thought:`Las aplicaciones de respuesta y mensajes (OpenAI) emiten el razonamiento en un canal separado, pasando por turnos (cifrados entre los proveedores en producción). El bucle de control es todavía ReAct.

### Cuando este patrón va mal

- **Block bloat.**Infinito .`block_append`Si el bloque llega al límite, debe enviar un resumen de bloque antes de escribir.
- **Silent drift.**El agente del sueño reescribe un bloque y el agente principal nunca se da cuenta.
- **Poisoned consolidation.**El agente del sueño procesa el contenido accesible al atacante en el núcleo.

```figure
memory-blocks
```

## Construye el mismo

`code/main.py`los instrumentos:

- `Block` identificación, etiqueta, valor, límite, descripción.
- `BlockStore` CRUD + `near_limit(label)`¿Qué es eso?
- Dos agentes con guión  `PrimaryAgent`sirve un turno, `SleepTimeAgent`se consolida entre los turnos.
- Un rastro que muestra una conversación de tres vueltas con el bloque escribe, más un pase de tiempo de sueño que resume un bloque e invalida un hecho anticuado.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

La transcripción muestra la división: los giros primarios son rápidos y producen escritos crudos; el paso del sueño se compacta y limpia.

## Usalo

- **Letta**(letta.com) para la implementación de referencia.
- **Claude Agent SDK skills**como conocimiento en forma de bloque  una habilidad es un bloque de instrucciones nombrado, versionado y recuperable que el agente carga a pedido.
- **Custom builds**Para los equipos que quieren controlar el backend de almacenamiento, utilice el contrato de Letta API para poder migrar más tarde.

## Envío

`outputs/skill-memory-blocks.md`genera un sistema de bloque en forma de Letta con ganchos de hora de dormir para cualquier tiempo de ejecución, incluidas las reglas de seguridad y el cableado de citación.

## Los ejercicios

1. Añadir un`block_summarize`herramienta que sustituye el valor de bloque por un resumen generado por el modelo cuando `near_limit`¿Cuál umbral de activación minimiza tanto las llamadas de resumen como el desbordamiento de bloque?
2. Implementar deducción del tiempo de sueño sobre el archivo: dos registros cuyo texto tiene un superposición simbólica de > 90% se derrumban a uno.
3. Bloques de versiones. En cada registro de escritura el valor antiguo y una diferencia. Exponer `block_history(label)`Así que los operadores pueden deshacerse de "por qué el agente olvidó X".
4. Trate a los agentes de horas de sueño como escritores no confiables. Cuando toquen el bloque Persona o Seguridad, requieren una revisión de segundo agente antes de comprometerse.
5. Portar el ejemplo para utilizar la API Letta (`letta_v1_agent`¿Qué cambios hay en el esquema de bloques, y cómo el razonamiento nativo altera la forma de las huellas?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Memory block | "Editable prompt section" | Typed, persistent, LLM-editable segment of core memory |
| Human block | "User memory" | Facts about the user, pinned in core |
| Persona block | "Agent identity" | Self-concept, tone, constraints, pinned in core |
| Sleep-time compute | "Async memory work" | Second agent doing consolidation off the critical path |
| Core / Recall / Archival | "Tiers" | Three-layer memory split: always-visible / conversation / external |
| Block limit | "Cap" | Character limit per block; forces summarization |
| Native reasoning | "Thinking channel" | Provider-level reasoning output, not prompt-level `Thought:` |
| Learned context | "Sleep output" | Facts the sleep-time agent writes into shared blocks |

## Leer más

- [Letta, Memory Blocks blog](https://www.letta.com/blog/memory-blocks) el patrón de bloque
- [Letta, Sleep-time Compute blog](https://www.letta.com/blog/sleep-time-compute) Consolidación sin sincronizada
- [Letta, Rearchitecting the Agent Loop](https://www.letta.com/blog/letta-v1-agent) Reescribir el razonamiento nativo
- [Packer et al., MemGPT (arXiv:2310.08560)](https://arxiv.org/abs/2310.08560) el origen
