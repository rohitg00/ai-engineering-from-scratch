# Las instrucciones del agente como restricciones ejecutables

> Las instrucciones escritas como prosa son deseos. Las instrucciones escritas como restricciones son pruebas. El banco de trabajo convierte cada regla en algo que un agente puede verificar en el tiempo de ejecución y un revisor puede verificar después del hecho.

**Type:** Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 32 (Minimal Workbench)
**Time:** ~50 minutes

## Objetivos de aprendizaje

- Separar la prosa de enrutamiento de las reglas operativas.
- Expresar las reglas de inicio, las acciones prohibidas, la definición de hecho, el manejo de incertidumbres y los límites de aprobación como restricciones controlables por máquina.
- Implementar un controlador de reglas que marque una carrera contra el conjunto de reglas.
- Haga que el conjunto de reglas sea diferente para que la revisión pueda ver qué ha cambiado.

## El problema

Un típico .`AGENTS.md`Se lee como una documentación de embarque. le dice al agente que "ten cuidado" y "prueba a fondo" y "pregunta si no estás seguro". Tres días después, el agente envía un cambio sin pruebas, escribe a un directorio prohibido, y nunca pregunta porque nunca supo dónde estaba la línea.

Las instrucciones son poderosas cuando son operacionales y débiles cuando son aspiracionales.

## El concepto

Las reglas pertenecen a la`docs/agent-rules.md`Cada regla tiene un nombre, una categoría y un cheque.

```mermaid
flowchart LR
  Router[AGENTS.md] --> Rules[docs/agent-rules.md]
  Rules --> Checker[rule_checker.py]
  Checker --> Report[rule_report.json]
  Report --> Reviewer[Reviewer]
```

### Cinco categorías que cubren la mayoría de las normas

| Category | Question the rule answers | Example |
|----------|---------------------------|---------|
| Startup | What must be true before work begins? | "state file exists and is fresh" |
| Forbidden | What must never happen? | "do not edit `scripts/release.sh`" |
| Definition of done | What proves the task is complete? | "pytest exits 0 and acceptance line passes" |
| Uncertainty | What does the agent do when unsure? | "open a question note instead of guessing" |
| Approval | What requires human approval? | "any new dependency, any prod write" |

Una regla que no encaja con una de estas cinco reglas suele ser dos reglas.

### Las reglas son legibles por máquina

Cada regla tiene una bala, una categoría, una descripción de una línea y una`check`campo que nombra una función en `rule_checker.py`Añadir una regla significa añadir un cheque; el checker crece con el banco de trabajo.

### Las reglas son diferentes

Las reglas viven una por título en un solo archivo de marcado. Los nombres nuevos son visibles en diferencias. Las nuevas reglas se sitúan en la parte superior de su categoría. Las reglas antiguas se eliminan, no se comentan, porque el escritorio de trabajo es la fuente de la verdad, no el registro de chat de cómo se sintió el equipo el trimestre pasado.

### Reglas frente a barandillas de marco

Las barandillas de marco (OpenAI Agents SDK barandillas, LangGraph interrumpe) hacen cumplir las reglas a nivel de tiempo de ejecución. La regla establecida en esta lección es el contrato legible y revisable por el hombre que implementan esas barandillas. Necesitas ambos: el tiempo de ejecución detecta violaciones durante un turno, el conjunto de reglas demuestra que el tiempo de ejecución está haciendo lo correcto.

### Divulgación progresiva: un mapa, no una enciclopedia

La razón .`AGENTS.md`El archivo es de dos mil líneas, y el agente lee la primera pantalla, se queda sin presupuesto de atención, y actúa en una fracción de lo que se le dijo. Un archivo de instrucciones gigantesca falla por la misma razón que un documento de cuarenta páginas de incorporación falla: el lector lo analiza una vez y nunca vuelve a la parte que importó.

El router de raíz se mantiene lo suficientemente pequeño como para leer cada sesión y no contiene nada más que señales. La profundidad vive en los archivos de temas que el agente carga solo cuando la tarea los toca.

```
AGENTS.md                  # router, < 50 lines: what this repo is, where to look, the 5 hard rules
docs/
  agent-rules.md           # the full rule set (this lesson)
  architecture.md          # loaded when the task touches module boundaries
  testing.md               # loaded when the task writes or runs tests
  deploy.md                # loaded only for release work, gated behind an approval rule
feature_list.json          # the backlog (Phase 14 · 36)
```

| Tier | Lives in | Read when | Size budget |
|------|----------|-----------|-------------|
| Router | `AGENTS.md` | Every session, always | Under ~50 lines |
| Rules | `docs/agent-rules.md` | Every session, on startup | One screen per category |
| Topic docs | `docs/<topic>.md` | Only when the task touches that topic | As deep as needed |

Dos pruebas mantienen la capa honesta. La prueba de accesibilidad: un agente debe alcanzar cualquier regla en al menos dos saltos desde el router, por lo que el router debe vincular cada documento de tema por camino, no describirlo en prosa. La prueba de frescura: el router es lo suficientemente corto como para que un revisor lo lea de nuevo en cada PR, lo cual es lo único que impide que vuelva a crecer silenciosamente en la enciclopedia que reemplazó. Un puntero que ya no resuelve es un error peor que una regla que falta, por lo que un enlace roto en el router es en sí mismo una violación de la verificación de inicio.

```figure
wb-rule-checkoff
```

## Construye el mismo

`code/main.py`Naves:

- `agent-rules.md`un parser que carga reglas en una clase de datos.
- `rule_checker.py`Funciones de control de estilo, una por `check`de referencia.
- Un agente de demostración que viola dos reglas y un cheque que los atrapa.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

Resultado: conjunto de reglas analizadas, seguimiento de ejecución, paso/fallo por regla, y un `rule_report.json`guardado junto al guión.

## Modelos de producción en la naturaleza

Tres patrones separan un conjunto de reglas que dura un cuarto de uno que se descompone en una semana.

**Severity tagging at write time.**Cada regla tiene un significado .`severity`¿ Qué es esto ?`block`¿ Qué ?`warn`, o`info`El controlador informa de los tres; el tiempo de ejecución sólo se niega a`block`La mayoría de los equipos exageran la gravedad temprano y luego la debilitan silenciosamente bajo presión de fecha límite; etiquetando en el momento de escribir obliga a la calibración hacia adelante.`block`La regla en un `overrides.jsonl`registro de auditoría.

**Rule expiry as a forcing function.**Cada regla tiene un significado .`expires_at`La fecha de la fecha de la publicación (por defecto 90 días a partir de la fecha de publicación).`info`Los datos de la revisión de código de IA de Cloudflare (abril de 2026, 131.246 revisiones se ejecutan en 5.169 repos en 30 días) mostraron que los conjuntos de reglas con vencimiento explícito se mantuvieron bajo 30 reglas por repos; los conjuntos sin crecieron a 80 + con la mayoría nunca disparando.

**Markdown-as-source, JSON-as-cache.** `agent-rules.md`es el archivo autor; `agent-rules.lock.json`El bloqueo se regenera por un gancho precomitado. las diferencias de marcación son revisables; el análisis de marcación se mantiene fuera de cada giro, porque el comprobador carga solo el pequeño JSON preconstruido. La misma forma que`package.json`- ¿ Qué ?`package-lock.json`y `Cargo.toml`- ¿ Qué ?`Cargo.lock`¿ Qué ?

## Usalo

En producción:

- Claude Code, Codex, Cursor lee las reglas al comienzo de la sesión y las cita cuando se niegan las acciones.
- Los barandillas de OpenAI Agents SDK registran las mismas comprobaciones que los barandillas de entrada y salida.
- LangGraph interrumpe el fuego cuando un nodo en vuelo viola una regla.

El conjunto de reglas es portátil en los tres porque es sólo marcación más nombres de funciones.

## Envío

`outputs/skill-rule-set-builder.md`Entrevistará a un propietario de un proyecto, clasificará sus instrucciones de prosa existentes en las cinco categorías y emitirá una versión `agent-rules.md`Además de un botón de verificación.

## Los ejercicios

1. Añadir una sexta categoría si su producto realmente la necesita.
2. Extensión del control para que una regla pueda tener una severidad (`block`¿ Qué ?`warn`¿ Qué ?`info`) y el informe agregado en consecuencia.
3. Enviar el controlador en CI: fallar la construcción si una regla de severidad de bloque falla en la última ejecución de agente.
4. Añadir un campo "cumplimiento" por regla. Después de 90 días sin un cheque fallido, la regla es para revisión.
5. Encuentra una verdadera .`AGENTS.md`¿Cuántas de sus líneas eran operativas? ¿Cuántas eran aspiracionales?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Operational rule | "A real instruction" | A rule the workbench can check at runtime |
| Aspirational rule | "Be careful" | A rule with no check; either delete or upgrade |
| Definition of done | "Acceptance" | An objective, file-backed proof the task is complete |
| Block severity | "Hard rule" | Violation halts the run; cannot be silenced without an operator |
| Rule expiry | "Stale rule sweep" | A rule with no fails in N days is up for retirement |

## Leer más

- [OpenAI Agents SDK guardrails](https://openai.github.io/openai-agents-python/guardrails/)
- [LangGraph interrupts](https://langchain-ai.github.io/langgraph/how-tos/human_in_the_loop/breakpoints/)
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Rick Hightower, Agent RuleZ: A Deterministic Policy Engine](https://medium.com/@richardhightower/agent-rulez-a-deterministic-policy-engine-for-ai-coding-agents-9489e0561edf) bloqueo/alerta/información severidad en la producción
- [Cloudflare, Orchestrating AI Code Review at Scale](https://blog.cloudflare.com/ai-code-review/) 131k revisiones, lecciones de composición de reglas
- [microservices.io, GenAI development platform — part 1: guardrails](https://microservices.io/post/architecture/2026/03/09/genai-development-platform-part-1-development-guardrails.html) defensa en profundidad entre las reglas y la CI
- [Type-Checked Compliance: Deterministic Guardrails (arXiv 2604.01483)](https://arxiv.org/pdf/2604.01483) Lean 4 como límite superior en la regla de control
- [logi-cmd/agent-guardrails](https://github.com/logi-cmd/agent-guardrails) Implementación de la puerta de fusión: alcance, pruebas de mutación, presupuestos de violación
- Fase 14 · 32  el banco de trabajo mínimo de este conjunto de reglas cae en
- Fase 14 · 38  la puerta de verificación que consume el informe de regla
- Fase 14 · 39  el agente revisor que califica el cumplimiento de las reglas
