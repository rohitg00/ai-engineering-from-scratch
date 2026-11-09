# Agentes de larga duración: ejecución duradera

> Los agentes de producción de largo horizonte no se ejecutan en `while True`. Cada llamada de LLM se convierte en una actividad con checkpoint, retry, y replay. La integración de OpenAI Agents SDK de Temporal fue GA marzo 2026. Claude Code Routines (Anthropic) ejecuta invocaciones programadas de Claude Code sin un proceso local persistente. Las sesiones se pausan en la entrada humana, sobreviven a los despliegues y se reanudan desde el último checkpoint teclado por`thread_id`. Detrás de la nueva ergonomía se encuentra un viejo patrón  orquestación de flujos de trabajo  con una nueva entrada: LLM llama a actividades no deterministas que deben repetirse deterministicamente en la recuperación.

**Type:** Learn
**Languages:** Python (stdlib, minimal durable-execution state machine), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 01 (Long-horizon agents)
**Time:** ~60 minutes

## El problema

Consideremos un agente que se ejecuta durante cuatro horas, llama a tres herramientas, le pide al usuario dos veces y hace cuarenta llamadas de LLM.

- En un ingenuo .`while True`Lo que se hace es que el usuario se reincorpora en las llamadas de la aplicación de la aplicación de la aplicación de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de software de los usuarios de los usuarios de los usuarios de los usuarios de los mismos.
- Con ejecución duradera: la ejecución se reanuda desde el punto de control más reciente. Las actividades ya completadas no se re-executa; sus resultados se reproducen desde el registro duradero. El usuario no reaproba cosas que ya aprobaron. Las llamadas LLM ya hechas no se refacturan.

Este es el mismo patrón que los motores de flujo de trabajo han enviado durante una década (Temporal, Cadence, Cherami de Uber). Lo nuevo es que las llamadas de LLM son ahora una especie de actividad  no determinista, cara, con efectos secundarios  y encajan en este patrón limpiamente.

El tema de la lección: la fiabilidad de largo horizonte se desacelera (METR observa una "degradación de 35 minutos"  la tasa de éxito disminuye aproximadamente cuadráticamente con el horizonte).

## El concepto

### Actividades, flujos de trabajo y reproducción

- **Workflow**El código de orquestación determinista define la secuencia de actividades, las ramas, las esperas. Debe ser determinista para que pueda reproducirse del registro de eventos sin divergencias sorprendentes.
- **Activity**Un programa de trabajo de la empresa de gestión de datos (LLC) es una unidad de trabajo no determinista, potencialmente fallida. llamada de LLM, llamada de herramienta, escritura de archivos, solicitud HTTP. Cada actividad se registra con sus entradas y (una vez completada) sus salidas.
- **Event log**Cada actividad se inicia, completa, falla, vuelve a intentar y se registra cada decisión del flujo de trabajo.
- **Replay**En el proceso de recuperación, el código del flujo de trabajo se ejecuta de nuevo desde el principio; cada actividad que ya se haya completado devuelve su resultado registrado sin volver a ejecutarse.

Esta es la misma forma que React que se vuelve a renderizar contra un DOM virtual, o Git reconstruyendo un árbol de trabajo a partir de commits.

### Por qué las llamadas de LLM encajan en el patrón

Las convocatorias de LLM son:
- No determinista (temperatura > 0; incluso la temperatura 0 fluye entre las versiones del modelo).
- Es caro (dinero y latencia).
- Potencialmente fallido (limites de tasas, tiempo de espera).
- Efecto secundario (si invocan herramientas).

Esta es exactamente la actividad del perfil. Envuelva cada llamada LLM como una actividad le da volver a intentar con retroceso exponencial, control de puntos a través de reinicios, y un rastro replayable para el desarreglamiento.

### Puntos de control seleccionados por `thread_id`

LangGraph, Microsoft Agent Framework, Cloudflare Durable Objects y Claude Code Routines convergieron en la misma forma de API: un `thread_id`(o equivalente) identifica la sesión; cada transición de estado persiste a un backend (postgreSQL predeterminado, SQLite para dev, Redis para caché); el currículum lee el último punto de control.

La elección del final es importante:

- **PostgreSQL**Es duradero, consultable, sobrevive a los despliegues.
- **SQLite**: solo local-dev; pierde datos en todos los hosts.
- **Redis**: rápido pero efímero, a menos que se configure AOF/snapshot.
- **Cloudflare Durable Objects**: distribuido de forma transparente; escalzado por una llave única; sobrevive durante horas o semanas.

### La entrada humana como un estado de primera clase

Proponer y luego comprometerse (lección 15) requiere un estado duradero de "espera a los humanos". El flujo de trabajo se detiene, la cola externa sostiene la solicitud pendiente y la aprobación se reanuda exactamente desde ese punto.

### La degradación de 35 minutos

METR observó que cada clase de agentes medida muestra una degradación de fiabilidad más allá de ~ 35 minutos de operación continua. El doble de la duración de la tarea casi cuadruplica la tasa de fracaso. La ejecución duradera no corrige esto; le permite correr más tiempo de lo que admite el perfil de fiabilidad. El patrón seguro es combinar la durabilidad con los puntos de control que requieren HITL fresco en la reentrada, y con interruptores de eliminación de presupuesto (lección 13) que limitan el cálculo total independientemente del tiempo del reloj de pared.

### Cuando la ejecución duradera es la respuesta equivocada

- Las carreras son más cortas que unos minutos sin intervención humana.
- Recuperación de información estrictamente de lectura.
- tareas en las que la corrección requiere de un extremo a otro dentro de una ventana de contexto (algunas tareas de razonamiento; algunas generaciones de una sola toma).

```figure
memory-consolidation
```

## Usalo

`code/main.py`Implementa un motor de ejecución duradera mínima en stdlib Python.

- `@activity`decorador que registra entradas y salidas en un registro de eventos JSON.
- Una función de flujo de trabajo que secuencia las actividades.
- ¿ Qué es esto ?`run_or_replay(workflow, event_log)`Función que reproduce las actividades completadas sin volver a ejecutarlas.

El conductor simula un flujo de trabajo de tres actividades, se estrella a mitad de camino, y muestra (a) un ingenuo retiro re-executivo de todo frente a (b) una repetición que ejecuta sólo la actividad que falta.

## Envío

`outputs/skill-durable-execution-review.md`revisa el despliegue de agentes de larga duración propuesto para determinar la forma correcta de ejecución duradera: actividades, determinismo, backend de los puntos de control, estado de entrada humana y política de HITL-on-resume.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Observe la diferencia en el recuento de actividad-execución entre la repetición y la repetición ingenuas. Cambia el punto de choque y muestra los cambios en el recuento de repetición en consecuencia.

2. Convierta el motor de juguete para usarlo `thread_id`Simula dos sesiones simultáneas compartiendo el motor y confirma que sus registros de eventos no chocan.

3. Tomar una actividad en el motor de juguete. Introducir un no-determinismo (un sello de tiempo de un reloj de pared dentro de una decisión de flujo de trabajo). Demostrar la divergencia en la repetición. Explicar cómo los motores reales manejan esto (registro de efectos secundarios, `Workflow.now()`Las API).

4. Lea el post de LangChain "Runtime behind production deep agents" en el que se enumera cada estado en el que persiste el tiempo de ejecución y se nombra el modo de falla que cubre cada uno.

5. Diseñar una política de punto de control para una tarea de codificación autónoma de 6 horas. ¿Dónde se hace el punto de control? ¿Cómo se ve el resumen en desfase? ¿Qué requiere HITL fresco?

## Términos clave

| Term | What people say | What it actually means |
|---|---|---|
| Workflow | "Agent's script" | Deterministic orchestration code; replayable from event log |
| Activity | "A step" | Non-deterministic unit (LLM call, tool call); logged before and after |
| Event log | "The backing store" | Durable record of every state transition |
| Replay | "Resume" | Re-run workflow; completed activities return logged results without re-execution |
| Checkpoint | "Save point" | Persisted state keyed by thread_id; latest-wins on resume |
| thread_id | "Session key" | Identifier that scopes durable state |
| 35-minute degradation | "Reliability decay" | METR: success rate drops ~quadratically with horizon |
| Non-determinism | "Drift on replay" | Wall clock, random, LLM output; must be registered as side effect |

## Leer más

- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) presupuesto, giros y semántica de reanudación.
- [Microsoft — Agent Framework: human-in-the-loop and checkpointing](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) Forma de solicitud de información.
- [LangChain — The Runtime Behind Production Deep Agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) requisitos concretos de tiempo de ejecución.
- [OpenAI Agents SDK + Temporal integration (Trigger.dev announcement)](https://trigger.dev) Forma de actividad para las convocatorias de LLM.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) la referencia de degradación de 35 minutos.
