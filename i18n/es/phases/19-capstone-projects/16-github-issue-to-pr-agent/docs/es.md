# Capstone 16  GitHub Emisión a PR Agente Autónomo

> Etiquetar un problema, obtener un PR  la forma del producto 2026 para agentes de codificación autónomos: ejecutar un agente en una caja de arena en la nube, verificar el éxito de las pruebas y publicar un PR listo para revisión con la racionalidad. Los agentes de AWS Remote SWE, los agentes de fondo de cursores, OpenAI Codex cloud y Google Jules todos lo envían. Las partes difíciles son reproducir el entorno de construcción del repo automáticamente, evitando la fuga de credenciales, aplicando los presupuestos por repo y asegurándose de que el agente no pueda forzar. Esta piedra angular construye la versión auto-alojada y la compara en costo y tasa de paso con las alternativas alojadas.

**Type:** Capstone
**Languages:** Python (agent), TypeScript (GitHub App, agent scaffold), YAML (Actions)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:**P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## El problema

El agente de codificación en la nube asíncrona es una categoría de producto separada de los agentes de codificación interactiva (capstone 01).`@agent fix this`En el caso de los robots, un trabajador se rodea en una caja de arena de nube, clona el repositorio, ejecuta pruebas, edita archivos, verifica y abre una relación publicitaria con la lógica del agente en el cuerpo. No hay bucle interactivo, no hay terminal.

Los desafíos de ingeniería son concretos: reproducción del entorno (el agente tiene que construir el repo desde cero sin una imagen de desarrollo almacenada en caché), pruebas escamas (deben ser re ejecutadas o aisladas), alcance de credenciales (una aplicación GitHub con permisos mínimos de granos finos), aplicación de presupuesto por repo por día y política de no empuje de fuerza.

## Concepto

El despacho es un enlace web de GitHub (etiqueta de problema o comentario de relaciones públicas). Un despachador encuentra el trabajo en ECS Fargate o Lambda. El trabajador tira el repo en una caja de arena Daytona o E2B con un archivo de Docker genérico inferido del repo (lenguaje, marco). El agente ejecuta un mini-swe-agent o SWE-agent v2 bucle contra Claude Opus 4.7 o GPT-5.4-Codex. Itera: lee código, propone arreglar, aplica parche, ejecuta pruebas.

La verificación es el paso de cerradura. La información completa debe pasar en la caja de arena antes de que se abra la PR. Se calcula el delta de cobertura; si es negativo más allá de un umbral, se abre la PR pero se etiqueta `needs-review`El agente publica la justificación como la descripción de relaciones públicas más un`@agent`El revisor puede pedir seguimiento.

La seguridad se evalúa a través de dos superficies diferentes de GitHub: la aplicación proporciona un token de instalación de corta duración con `workflows: read`y estrechos contenidos de repo/combines de relaciones públicas; protección de sucursales (no permisos de aplicación) impone "no escribe directamente a `main`" y "no fuerza empuje"  la aplicación nunca se añade a la lista de bypass.`.github/workflows`No es un verdadero GitHub App primitivo, por lo que la lista de permisos del agente en las modificaciones de archivos tiene que hacer cumplir eso en el trabajador. Los límites máximos presupuestarios por repo por día se aplican en el despachador (por ejemplo, máximo 5 PR por repo por día, $20 por PR).

## Arquitectura

```
GitHub issue labeled `@agent fix` or PR comment
            |
            v
    GitHub App webhook -> AWS Lambda dispatcher
            |
            v
    ECS Fargate task (or GitHub Actions self-hosted runner)
       - pull repo
       - infer Dockerfile (language, package manager)
       - Daytona / E2B sandbox with target runtime
       - clone -> git worktree -> agent branch
            |
            v
    mini-swe-agent / SWE-agent v2 loop
       Claude Opus 4.7 or GPT-5.4-Codex
       tools: ripgrep, tree-sitter, read/edit, run_tests, git
            |
            v
    verify CI passes in-sandbox + coverage delta check
            |
            v (verified)
    git push + open PR via GitHub App
       PR body = rationale + diff summary + trace URL
       label: needs-review
            |
            v
    operator reviews; can @-mention agent for follow-ups
```

## El establo

- Trigger: Aplicación GitHub con token de granos finos; receptor webhook a través de Lambda o Fly.io
- Trabajador: tarea de ECS Fargate (o ejecutor de GitHub Actions auto-hosted)
- Sandbox: Container de desarrollo de Daytona o sandbox E2B por tarea
- Bucle de agente: línea de base de mini-swe-agent o SWE-agent v2 sobre Claude Opus 4.7 / GPT-5.4-Codex
- Recuperación: mapa de repos del árbol + ripgrep
- Verificación: CI completo en la caja de arena + puerta delta de cobertura
- Observabilidad: Langfuse con archivo de rastro por PR vinculado desde el organismo de relaciones públicas
- Presupuesto: límite máximo diario de dólar por repo; máximo de relaciones públicas por repo por día

```figure
cf-issue-to-pr
```

## Construye el mismo

1. **GitHub App.**Token de instalación de granos finos: problemas de lectura+escritura, pull_requests de escritura, contenido de lectura+escritura, flujos de trabajo de lectura. protección de ramas (la única superficie que puede hacer esto) impone "no presionar directamente a `main`"y "no se empurra por fuerza"; la aplicación no está en la lista de bypass.`.github/workflows`" como una lista de permisos de verificación de la diferencia propuesta, ya que los permisos de la aplicación GitHub no son de alcance de ruta.

2. **Webhook receiver.**La función Lambda acepta etiquetas de temas / comentarios de relaciones públicas webhooks.`@agent fix this`- Encuestas a la SQS.

3. **Dispatcher.**Se ejecutan tareas desde SQS. Se ejecutan por repo por presupuesto diario. Se ejecutan tareas de ECS Fargate con la URL de repo, cuerpo de emisión y una caja de arena fresca de Daytona.

4. **Environment inference.**Detectar el lenguaje (Python, Node, Go, Rust) y el gestor de paquetes (uv, pnpm, go mod, cargo). Generar un archivo Docker en vuelo si no existe.

5. **Agent loop.**Mini-swe-agent o SWE-agent v2 con Claude Opus 4.7. herramientas: ripgrep, tree-sitter repo-map, read_file, edit_file, run_tests, git. límites de durabilidad: $20 de costo, 30 minutos de reloj de pared, 30 giros de agente.

6. **Verification.**Después de que el ciclo se complete, ejecute la suite de pruebas completa en la caja de arena.`needs-review`etiqueta.

7. **PR posting.**Empuje la rama del agente. Abra relaciones públicas a través de GitHub API con: título, razón, resumen de diferencia, URL de rastreo, costo, giros.

8. **Credential hygiene.**El trabajador se ejecuta con un token de instalación de GitHub de corta duración. Los registros se limpian para los secretos antes de archivo.

9. **Eval.**30 temas internos de dificultad variable. Medir la tasa de aprobación, la calidad de las relaciones públicas (tamaño diferente, estilo, cobertura), el costo, la latencia. Comparar con los agentes de fondo de cursor y los agentes de AWS remoto SWE en los mismos temas.

## Usalo

```
# on github.com
  - user labels issue #842 with `@agent fix this`
  - PR #1903 appears 14 minutes later
  - body:
    > Fixed NPE in widget.dedupe() caused by null comparator entry.
    > Added regression test widget_test.go::TestDedupeNullComparator.
    > Coverage delta: +0.12%
    > Turns: 7  Cost: $1.80  Trace: langfuse:...
    > Label: needs-review
```

## Envío

`outputs/skill-issue-to-pr.md`Es un trabajador en la nube asíncrona de GitHub App + que convierte los problemas etiquetados en relaciones públicas listos para revisión con costos limitados y credenciales de alcance.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Pass rate on 30 issues | End-to-end success (CI green + coverage OK) |
| 20 | PR quality | Diff size, coverage delta, style conformance |
| 20 | Cost and latency per resolved issue | $ and wall-clock per PR |
| 20 | Safety | Scoped token, per-repo budget, no force-push, credential hygiene |
| 15 | Operator UX | Rationale comments, retry affordance, @-mention follow-up |
| **100** | | |

## Los ejercicios

1. Añadir un modo de "solución de prueba de escamas": la etiqueta `@agent stabilize-flake TestX`ejecuta la prueba 50 veces en la caja de arena y propone un cambio mínimo que la estabilice.

2. Comparar el costo con los agentes de fondo de cursor en tres temas compartidos.

3. Implemente un panel de presupuesto: costo por reporte por día, costo por usuario.

4. Construir un modo "seco-run" que abra un borrador de relaciones públicas sin ejecutar CI, para que los revisores puedan examinar el plan barato.

5. Añadir una política de retención: las sucursales de relaciones públicas mayores de 7 días sin fusión se borran automáticamente.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| GitHub App | "Scoped bot identity" | App with fine-grained permissions + short-lived installation token |
| Async cloud agent | "Background agent" | Non-interactive worker that runs in a cloud sandbox, not a terminal |
| Environment inference | "Dockerfile synthesis" | Detect language + package manager, generate a Dockerfile if absent |
| Verification | "CI-in-sandbox" | Run the full test suite inside the worker before opening a PR |
| Coverage delta | "Coverage preservation" | Change in test coverage % from base to agent branch |
| Per-repo budget | "Daily ceiling" | Dollar and PR-count cap enforced at the dispatcher |
| Rationale | "PR body explanation" | Agent's summary of what changed and why; required in the PR body |

## Leer más

- [AWS Remote SWE Agents](https://github.com/aws-samples/remote-swe-agents) la referencia de agente de nube asíncrona canónica
- [SWE-agent](https://github.com/SWE-agent/SWE-agent) Referencia de las CLI
- [Cursor Background Agents](https://docs.cursor.com/background-agent) Alternativa comercial
- [OpenAI Codex (cloud)](https://openai.com/codex) Competidor acogido
- [Google Jules](https://jules.google) La versión alojada de Google
- [Factory Droids](https://www.factory.ai) Referencia comercial alternativa
- [GitHub App documentation](https://docs.github.com/en/apps) Identidad del bot de alcance
- [Daytona cloud sandboxes](https://daytona.io) caja de arena de referencia
