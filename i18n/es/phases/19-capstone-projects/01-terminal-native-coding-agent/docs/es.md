# Capstone 01  Agente de codificación nativo terminal

> Para 2026 la forma de un agente de codificación se ha establecido. Un arnés TUI, un plan de estado, una superficie de herramientas de caja de arena, un bucle que planea, actúa, observa, recupera. Claude Code, Cursor 3 y OpenCode se ven todos iguales desde 50 pies. Esta piedra angular le pide que construya un extremo para terminar  CLI en, sacar la solicitud  y medirlo contra mini-swe-agente y Live-SWE-agente en SWE-bench Pro. Aprenderá por qué la parte difícil no es la llamada de modelo sino el bucle de herramientas, la caja de arena y el techo de costo en una carrera de 50 vueltas.

**Type:** Capstone
**Languages:** TypeScript / Bun (harness, loop scaffold), Python (eval scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and protocols), Phase 14 (agents), Phase 15 (autonomous systems), Phase 17 (infrastructure)
**Phases exercised:**P0 · P5 · P7 · P10 · P11 · P13 · P14 · P15 · P17 · P18
**Time:** 35 hours

## El problema

Los agentes de codificación se convirtieron en la categoría de aplicaciones de IA dominante en 2026. Claude Code (Antropico), Cursor 3 con Composer 2 y Tabs de Agente (Cursor), Amp (Sourcegraph), OpenCode (112k estrellas), Factory Droids y Google Jules son todas las variaciones de navegación de la misma arquitectura: un arnés terminal, una superficie de herramientas autorizada, una caja de arena y un bucle de observación de planes y acciones construido alrededor de un modelo fronterizo. La frontera es estrecha  Agente SWE-Live alcanzó el 79.2% en el banco SWE Verificado con Opus 4.5  pero la nave de ingeniería es ancha. La mayoría de los modos de falla no son errores de modelo. Son la inestabilidad del bucle de herramientas, el envenenamiento de contexto, el costo de tokens fugitivos y las operaciones destructivas del sistema de archivos.

No puedes razonar sobre estos agentes desde fuera. Tienes que construir uno, ver el bloqueo en la curva 47 cuando ripgrep devuelve 8 MB de fósforos, y reconstruir la capa de truncado.

## Concepto

El arnés tiene cuatro superficies.**Plan**mantiene un objeto de estado de estilo TodoWrite que el modelo reescribe cada turno. **Act**Envía llamadas a herramientas (leer, editar, ejecutar, buscar, git). **Observe**captura los códigos de salida / stderr / exit, truncates y alimenta el resumen de nuevo. **Recover**maneja errores de herramienta sin volar la ventana de contexto o en bucle para siempre. La forma 2026 agrega una cosa más: **hooks**- ¿ Qué ?`PreToolUse`¿ Qué ?`PostToolUse`¿ Qué ?`SessionStart`¿ Qué ?`SessionEnd`¿ Qué ?`UserPromptSubmit`¿ Qué ?`Notification`¿ Qué ?`Stop`, y `PreCompact` puntos de extensión configurables en los que el operador inyecta políticas, telemetría y barandillas.

La caja de arena es E2B o Daytona. Cada tarea se ejecuta en un nuevo devcontainer con un git de trabajo montado en el árbol de lectura-escritura. El arnés nunca toca el sistema de archivos del host. El árbol de trabajo se derriba en el éxito o el fracaso. El control de costos se aplica en tres capas: un límite máximo de tokens por turno, un presupuesto de dólares por sesión y un límite de turno duro (normalmente 50). La capa de observabilidad es OpenTelemetry con convenciones semánticas de GenAI, enviadas a un Langfuse auto-host.

## Arquitectura

```
  user CLI  ->  harness (Bun + Ink TUI)
                  |
                  v
           plan / act / observe loop  <--->  Claude Sonnet 4.7 / GPT-5.4-Codex / Gemini 3 Pro
                  |                          (via OpenRouter, model-agnostic)
                  v
           tool dispatcher (MCP StreamableHTTP client)
                  |
     +------------+------------+----------+
     v            v            v          v
  read/edit    ripgrep     tree-sitter   git/run
     |            |            |          |
     +------------+------------+----------+
                  |
                  v
           E2B / Daytona sandbox  (worktree isolated)
                  |
                  v
           hooks: Pre/Post, Session, Prompt, Compact
                  |
                  v
           OpenTelemetry -> Langfuse (spans, tokens, $)
                  |
                  v
           PR via GitHub app
```

## El establo

- Tiempo de ejecución del arnés: Bun 1.2 + Tinta 5 (Reacción en terminal)
- Modelo de acceso: OpenRouter API unificada con Claude Sonnet 4.7, GPT-5.4-Codex, Gemini 3 Pro, Opus 4.5 (para tareas más difíciles)
- Transporte de herramientas: Modelo de protocolo de contexto StreamableHTTP (revisión MCP 2026)
- Cajas de arena: cajas de arena E2B (JS SDK) o contenedores de desarrollo Daytona
- Busca de código: subproceso ripgrep, parseres para 17 idiomas (pre-compilados)
- El aislamiento: `git worktree add`por tarea, limpieza sobre el éxito / fracaso
- Arnés Eval: SWE-bench Pro (subconjunto verificado) + Terminal-Bench 2.0 + su propio retener de 30 tareas
- Observabilidad: OpenTelemetry SDK con `gen_ai.*`semconv → Langfuse auto-alojado
- Publicidad de relaciones públicas: Aplicación GitHub con token de granos finos, alcance limitado al repo objetivo

```figure
ce-agent-loop
```

## Construye el mismo

1. **TUI and command loop.**Estafalla un proyecto Bun con tinta.`agent run <repo> "<task>"`Imprimir una vista dividida: pane de planes (arriba), flujo de llamadas de herramientas (medio), presupuesto de token (bajo). Agregar cancelación en el Ctrl-C que dispara `SessionEnd`gancho antes de salir.

2. **Plan state.**Definir un esquema TodoWrite tipado (en espera / en_progreso / elementos hechos con notas). El modelo reescribe el estado completo cada turno como una llamada de herramienta  no permita que mutar incrementalmente.`.agent/state.json`para que los accidentes puedan reanudarse.

3. **Tool surface.**Definir seis herramientas: `read_file`¿ Qué ?`edit_file`(con una vista previa diferente),`ripgrep`¿ Qué ?`tree_sitter_symbols`¿ Qué ?`run_shell`(con tiempo de espera),`git`(estatus / dif / commit / push). Exponer a través de MCP StreamableHTTP para que el arnés sea agnóstico de transporte. Cada herramienta devuelve salida truncada (cap a 4k tokens por llamada).

4. **Sandbox wrapping.**Cada tarea genera una caja de arena E2B. `git worktree add -b agent/$TASK_ID`Todas las llamadas de herramientas se ejecutan dentro de la caja de arena.

5. **Hooks.**Implementar los ocho tipos de ganchos 2026: cablear al menos cuatro ganchos autorizados por el usuario: a) `PreToolUse`Guardia de comando destructivo que bloquea`rm -rf`fuera del árbol de trabajo, b) `PostToolUse`contabilidad simbólica, c) `SessionStart`inicialización presupuestaria, d) `Stop`escribe un último paquete de rastro.

6. **Eval loop.**Clone un subconjunto de 30 números de SWE-bench Pro Python. ejecuta tu arnés contra cada uno. Compare con mini-swe-agent (la línea de base mínima) en pass@1, turnos por tarea y $-por tarea. Escriba los resultados a `eval/results.jsonl`¿ Qué ?

7. **Cost control.**Cutoffs duros: 50 giros, 200 mil contextos, 5 dólares por tarea.`PreCompact`Hook resume los cambios más antiguos en un bloque de estado anterior en el marcado de 150k, liberando espacio para nuevas observaciones sin perder el plan.

8. **PR posting.**Para el éxito, el paso final es`git push`+ una llamada de API de GitHub que abre una relación con el plan y el resumen de diferencias en el cuerpo.

## Usalo

```
$ agent run ./my-repo "Fix the race condition in worker.rs"
[plan]  1 locate worker.rs and enumerate mutex uses
        2 identify shared state under contention
        3 propose fix, verify tests
[tool]  ripgrep mutex.*lock -t rust           (44 matches, truncated)
[tool]  read_file src/worker.rs 120..180
[tool]  edit_file src/worker.rs (+8 -3)
[tool]  run_shell cargo test worker::          (passed)
[plan]  1 done · 2 done · 3 done
[done]  PR opened: #482   turns=9   tokens=38k   cost=$0.41
```

## Envío

La habilidad entregable vive en`outputs/skill-terminal-coding-agent.md`. Dado un recorrido de repo y una descripción de tarea, ejecuta el ciclo completo de plan-acto-observación en una caja de arena y devuelve una URL de relaciones públicas más un paquete de rastreo.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 vs baseline | Your harness vs mini-swe-agent on 30 matched Python tasks |
| 20 | Architecture clarity | Plan/act/observe separation, hook surface, tool schema — reviewed against Live-SWE-agent layout |
| 20 | Safety | Sandbox escape tests, permission prompts, destructive-command guard passes red-team |
| 20 | Observability | Trace completeness (100% of tool calls spanned), token accounting per turn |
| 15 | Developer UX | Cold-start < 2s, crash recovery resumes plan, Ctrl-C cancels mid-tool cleanly |
| **100** | | |

## Los ejercicios

1. Cambiar el modelo de respaldo de Claude Sonnet 4.7 a Qwen3-Coder-30B servido en vLLM. Comparar pas@1 y $-per-tarefa. Informar donde el modelo abierto tiene un rendimiento inferior.

2. Añadir un`reviewer`Sub-agente que lee el dif antes de publicar PR y puede solicitar un ciclo de revisión. Medir si las revisiones falsamente positivas caen en la tasa de aprobación del banco SWE por debajo de la línea de base de un solo agente (indicación: generalmente sí).

3. Prueba de estrés en la caja de arena: escriba una tarea que intente hacer `curl`Una URL externa y una tarea que escribe fuera del árbol de trabajo. Confirmar que ambos están bloqueados por el gancho PreToolUse. Registre los intentos.

4. Implementación `PreCompact`Se puede calcular la fidelidad del plan en una compactación de 3x.

5. Cambiar el transporte MCP StreamableHTTP para el estudio. Indicar el inicio en frío y la latencia por llamada. Elegir un ganador para uso local.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Harness | "The agent loop" | The code surrounding the model that dispatches tools, maintains plan state, and enforces budgets |
| Hook | "Agent event listener" | A user-authored script run on one of eight lifecycle events by the harness |
| Worktree | "Git sandbox" | A linked git checkout at a separate path; disposable without touching the main clone |
| TodoWrite | "Plan state" | A typed list of pending/in-progress/done items the model rewrites each turn |
| StreamableHTTP | "MCP transport" | 2026 MCP revision: long-lived HTTP connection with bidirectional streaming; replaces SSE |
| Token ceiling | "Context budget" | Per-turn or per-session cap on input+output tokens; triggers compaction or termination |
| pass@1 | "Single-attempt pass rate" | Fraction of SWE-bench tasks solved on the first run without retry or test-set peeking |

## Leer más

- [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) arnés de referencia de Anthropic
- [Cursor 3 changelog](https://cursor.com/changelog) Agentes Tabs y notas de producto de Composer 2
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) Línea de referencia mínima para la comparación entre el arnés de banco SWE
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) 79,2% de la banca de SWE Verificada con Opus 4.5
- [OpenCode](https://opencode.ai) Arneso abierto, 112k estrellas
- [SWE-bench Pro leaderboard](https://www.swebench.com) la evaluación de los objetivos de esta meta
- [Model Context Protocol 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) StreamableHTTP, metadatos de capacidad
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) esquema de duración para llamadas de herramientas y uso de tokens
