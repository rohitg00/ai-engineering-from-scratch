# Capstone 10  Equipo de ingeniería de software multi-agente

> La forma de 2026 de un equipo de ingeniería multi-agente se ha convergido: un arquitecto planea, N codificadores trabajan en árboles de trabajo paralelos, un revisor puertas, un probador verifica. La arquitectura de fábrica de SWE-AF, la incitación basada en el papel de MetaGPT, el gráfico de actores tipado de AutoGen 0.4, Devin de Cognition y Droids de Factory todos aterrizaron en ella de forma independiente. Los árboles de trabajo paralelas convierten el reloj de pared en rendimiento. Los protocolos de estado compartido y de transmisión se convierten en la superficie de fallas. La piedra angular es construir el equipo, evaluar en el banco de SWE Pro, y informar qué entregas se rompen y con qué frecuencia.

**Type:** Capstone
**Languages:** Python / TypeScript (agents, task board scaffold), Shell (worktree scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 16 (multi-agent), Phase 17 (infrastructure)
**Phases exercised:**P11 · P13 · P14 · P15 · P16 · P17
**Time:** 40 hours

## El problema

Los arneses de codificación de un agente único alcanzan un límite en tareas grandes. No porque cualquier agente individual sea débil, sino porque un contexto de 200k-token no puede contener un plan de arquitectura más cuatro fragmentos paralelos de base de código más comentarios del revisor más salida de prueba. Las fábricas de múltiples agentes dividen el problema: un arquitecto es dueño del plan, los programadores son dueños de la implementación en árboles de trabajo paralelos, un revisor es el encargado de revisar, un probador lo verifica. La arquitectura "fabricaria" de SWE-AF, los roles de MetaGPT, el gráfico de actores tipado de AutoGen  los tres marcos describen la misma forma.

La superficie de falla es la entrega. El arquitecto planea algo que los codificadores no pueden implementar. Los codificadores producen diferencias contradictorias. El revisor aprueba una solución alucinada. El probador corre un codificador de escritura inmóvil. Usted construirá uno de estos equipos, lo ejecutará en 50 números Pro de SWE-bench, rastreará cada entrega y publicará el post-mortem.

## Concepto

Los papeles son agentes de tipografía.**Architect**(Claude Opus 4.7) lee el número, escribe un plan y lo divide en subtareas con interfaces explícitas. **Coders**(Claude Sonnet 4.7, N instancias paralelas, cada una en una `git worktree`+ Daytona sandbox) implementar las subtareas de forma independiente. **Reviewer**(GPT-5.4) lee la diferencia fusionada y aprueba o solicita cambios específicos. **Tester**(Gemini 2.5 Pro) ejecuta la suite de pruebas aislada y informa sobre el paso/fallo con artefactos.

La comunicación se realiza a través de un tablero de tareas compartido (con archivo respaldado o Redis). Cada rol consume tareas que se le permite realizar. Las entregas son mensajes tipo protocolo A2A. Las preocupaciones de coordinación: resolución de conflictos de fusión (rollo de coordinador o fusión automática de tres vías), sincronización de estado compartido (el plan se congela una vez que comienzan los codificadores; los repláneos son eventos separados) y control de la puerta del revisor (el revisor no puede aprobar sus propios cambios o cambios que propone).

La amplificación de tokens es el costo oculto. Cada límite de rol agrega instrucciones de resumen y contexto de entrega. Una carrera de 40 vueltas de un solo agente se convierte en 160 vueltas totales en cuatro roles. La rúbrica pesa específicamente la eficiencia de tokens frente a la línea de base de un solo agente porque la pregunta no es "hace trabajo multi-agente" sino "ha ganado por dólar".

## Arquitectura

```
GitHub issue URL
      |
      v
Architect (Opus 4.7)
   reads issue, produces plan with subtasks + interfaces
      |
      v
Task board (file / Redis)
      |
   +-- subtask 1 ---+-- subtask 2 ---+-- subtask 3 ---+-- subtask 4 ---+
   v                v                v                v                v
Coder A          Coder B          Coder C          Coder D          (4 parallel)
 (Sonnet)         (Sonnet)         (Sonnet)         (Sonnet)
 worktree A       worktree B       worktree C       worktree D
 Daytona          Daytona          Daytona          Daytona
      |                |                |                |
      +--------+-------+-------+--------+
               v
           merge coordinator  (three-way merge + conflict resolution)
               |
               v
           Reviewer (GPT-5.4)
               |
               v
           Tester  (Gemini 2.5 Pro)  -> passes? -> open PR
                                     -> fails?  -> route back to coder
```

## El establo

- Orquestación: LangGraph con estado compartido + subgrafos por agente
- Comunicación: Protocolo A2A (Google 2025) para mensajes entre agentes digitalizados
- Modelos: Opus 4.7 (arquitecto), Sonnet 4.7 (codrador), GPT-5.4 (revisor), Gemini 2.5 Pro (tester)
- aislamiento de árboles de trabajo: `git worktree add`por codificador + caja de arena Daytona
- Coordinador de fusión: fusión en tres vías personalizada + resolución de conflictos mediada por el MLL
- Eval: SWE-bench Pro (50 números), escenarios SWE-AF, HumanEval++ para pruebas unitarias
- Observabilidad: Langfuse con extensiones de etiquetas de rol, contabilidad de tokens por agente
- Despliegue: K8 con cada rol como un despliegue separado + HPA en el backlog

```figure
ce-team-handoff
```

## Construye el mismo

1. **Task board.**JSONL respaldado por archivos con mensajes digitalizados: `plan_request`¿ Qué ?`subtask`¿ Qué ?`diff_ready`¿ Qué ?`review_needed`¿ Qué ?`test_needed`¿ Qué ?`approved`¿ Qué ?`rejected`¿ Qué ?`replan_needed`Los agentes se suscriben a las etiquetas.

2. **Architect.**Lea el tema de GitHub, ejecuta Opus 4.7 con una plantilla que requiere interfaces de subtareas explícitas (files tocados, funciones públicas, impacto de prueba).`plan_request`con un día de subtareas.

3. **Coders.**En el caso de los trabajadores paralelos, cada uno reclama una subtarefa de la junta.`git worktree add`Se ejecuta la subtarefa, y se emite.`diff_ready`con el parche + deltas de prueba.

4. **Merge coordinator.**En todo codificador, tres vías fusiona las ramas N en una rama de etapa.

5. **Reviewer.**GPT-5.4 lee la diferencia fusionada. No puede aprobar las diferencias que ha escrito.`approved`(no-op) o `review_feedback`con solicitudes específicas de cambio enviadas de nuevo al codificador correspondiente.

6. **Tester.**Gemini 2.5 Pro ejecuta la suite de pruebas en una caja de arena limpia, captura artefactos, emite.`test_passed`o `test_failed`Las pruebas fallidas vuelven al codificador que posee la subtarefa fallida.

7. **Handoff accounting.**Cada mensaje que cruza un límite de rol obtiene un espacio en Langfuse con el tamaño de la carga útil y el modelo utilizado.

8. **Eval.**Compare el paso@1 y $- por problema resuelto con una línea de base de un solo agente (un Sonet 4.7 en un solo árbol de trabajo).

9. **Post-mortem.**Para cada problema fallido, identifique la entrega que se rompió (plan demasiado vago, conflicto de fusión, falso aprobación del revisor, flake del probador).

## Usalo

```
$ team run --issue https://github.com/acme/widget/issues/842
[architect] plan: 4 subtasks (parser, cache, api, migration)
[board]     dispatched to 4 coders in parallel worktrees
[coder-A]   subtask parser  -> 42 lines, tests pass locally
[coder-B]   subtask cache   -> 88 lines, tests pass locally
[coder-C]   subtask api     -> 31 lines, tests pass locally
[coder-D]   subtask migration -> 19 lines, tests pass locally
[merge]     3-way merge: 0 conflicts
[reviewer]  comments on cache (thread pool sizing); routed to coder-B
[coder-B]   revision: 92 lines; submits
[reviewer]  approved
[tester]    all 412 tests pass
[pr]        opened #3382   4 coders, 1 revision, $4.90, 18m
```

## Envío

`outputs/skill-multi-agent-team.md`Dado un URL de problema y nivel de paralelismo, el equipo produce una relación pública lista para la fusión con la contabilidad de tokens por rol.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | Matched 50-issue subset, pass@1 |
| 20 | Parallel speedup | Wall-clock vs single-agent baseline |
| 20 | Review quality | False-approval rate on injected-bug probe |
| 20 | Token efficiency | Total tokens per solved issue vs single-agent |
| 15 | Coordination engineering | Merge-conflict resolution, handoff-failure histogram |
| **100** | | |

## Los ejercicios

1. Inyectar un error obvio en un dif medio de ejecución (extra `return None`El informe de la Comisión sobre la evaluación de la calidad de los productos y de la calidad de los productos de la industria de la Unión Europea (UE) se presenta en el informe de la Comisión sobre la evaluación de los productos y de la calidad de los productos y de la calidad de los productos y de la calidad de los productos y de la calidad de los productos y de la calidad de los productos y de la calidad de los productos y de la calidad de los productos y de la calidad de los productos y de la calidad de los productos y de la calidad de los productos y de la calidad de los productos y de la calidad de los productos y de la calidad de los productos y de la calidad de los productos.

2. Reducir a dos codificadores (arquitecto + dos codificadores + revisor + probador, cada codificador ejecuta dos subtareas secuencialmente). Comparar el reloj de pared y la tasa de aprobación.

3. Reemplazar el coordinador de fusión con una restricción de escritora única (subtareas tocan conjuntos de archivos desarticulados).

4. Revisador de swap desde GPT-5.4 hasta Claude Opus 4.7. Medir la tasa de falsa aprobación y el delta de costo de tokens.

5. Añadir un quinto papel: documentador (Haiku 4.5). Después de la revisión, produce una entrada de registro de cambios. Medir si la calidad de la documentación justifica el gasto adicional de tokens.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Parallel worktree | "Isolated branch" | `git worktree add` producing a fresh working tree per coder |
| Task board | "Shared message bus" | File or Redis store of typed messages agents subscribe to |
| Handoff | "Role boundary" | Any message crossing from one role's context to another's |
| Token amplification | "Multi-agent overhead" | Total tokens across roles / single-agent tokens for the same task |
| A2A protocol | "Agent-to-agent" | Google's 2025 spec for typed inter-agent messages |
| Merge coordinator | "Integrator" | Component that runs three-way merge and mediates conflicts |
| False approval | "Reviewer hallucination" | Reviewer approves a diff with known bugs |

## Leer más

- [SWE-AF factory architecture](https://github.com/Agent-Field/SWE-AF) la fábrica de referencia 2026 de múltiples agentes
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT) marco multiagente basado en el papel
- [AutoGen v0.4](https://github.com/microsoft/autogen) El marco de actores de Microsoft
- [Cognition AI (Devin)](https://cognition.ai) producto de referencia
- [Factory Droids](https://www.factory.ai) producto de referencia alternativo
- [Google A2A protocol](https://a2a-protocol.org/latest/) especificación de mensajería entre agentes
- [git worktree documentation](https://git-scm.com/docs/git-worktree) el sustrato de aislamiento
- [SWE-bench Pro](https://www.swebench.com) el objetivo de evaluación
