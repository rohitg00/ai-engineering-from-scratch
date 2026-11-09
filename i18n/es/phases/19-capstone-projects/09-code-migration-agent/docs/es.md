# Capstone 09  Agente de migración de código (Lenguaje de nivel repuesto / actualización de tiempo de ejecución)

> El MigrationBench de Amazon (Java 8 a 17) y el migrante Py2-to-Py3 de Google de App Engine establecen la barra de 2026. OpenRewrite de Moderne hace reescrituras deterministas de AST a escala. Grit tiene como objetivo el mismo problema con el estilo de codemod DSL. El patrón de producción combina ambas cosas: un sustrato determinista para las reescrituras seguras más una capa de agente para los casos ambiguos, una caja de arena para cada rama de construcción y un arnés de prueba que se vuelve verde antes de que se abra la PR. La piedra angular es migrar 50 repos reales y publicar una tasa de aprobación con una taxonomía de fracaso.

**Type:** Capstone
**Languages:** Python (agent), Java / Python (targets), TypeScript (dashboard, agent scaffold)
**Prerequisites:** Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 15 (autonomous), Phase 17 (infrastructure)
**Phases exercised:**P5 · P7 · P11 · P13 · P14 · P15 · P17
**Time:** 30 hours

## El problema

La migración de código a gran escala es una de las aplicaciones de producción más limpias de agentes de codificación de 2026. La verdad de fondo es obvia (¿cumple la suite de pruebas después de la migración?), las recompensas son reales (una migración de flota Java-8 es un proyecto a escala de personal) y los puntos de referencia son públicos (subconjunto de MigrationBench 50-repo). El OpenRewrite de Moderne maneja el lado determinista. La capa de agente maneja todo lo que las recetas OpenRewrite no pueden: reescrituras ambigüas, derivación del sistema de construcción, sintaxis de cola larga, ruptura de dependencias transitivas.

Se construirá un agente que toma un repo Java 8 (o Python 2 repo) y produce una rama migrada de CI verde. Se medirá la tasa de aprobación, la preservación de la cobertura de prueba, el costo por repo y se construirá una taxonomía de fracaso. El lado a lado contra una línea de base determinista solo le dice dónde realmente vive el valor del agente.

## Concepto

El oleoducto tiene dos capas.**deterministic substrate**(OpenRewrite para Java, libcst para Python) ejecuta la mayor parte de las reescrituras mecánicas de forma segura: importaciones, firmas de método, modificaciones de seguridad nula, prueba de recursos, reemplazos de API obsoletos. Es rápido y produce diferencias auditables.**agent layer**(OpenAI Agents SDK o LangGraph sobre Claude Opus 4.7 y GPT-5.4-Codex) maneja los casos en que las recetas no pueden: actualizaciones de archivos de construcción (Maven/Gradle/pyproject), conflictos de dependencias transitivas, fragmentos de prueba, anotaciones personalizadas.

Cada repo recibe una caja de arena Daytona con el tiempo de ejecución objetivo preinstalado. El agente itera: ejecuta la construcción, clasifica los fallos, aplica la corrección, repite. límites duros: 30 minutos por repo, $ 8 por repo, 20 giros de agente. Si todas las pruebas pasan y la cobertura cae no más de 2 puntos porcentuales, la rama abre un PR. Si no, el repo se presenta bajo una clase de fallo con evidencia.

La taxonomía de fallas es la entregable. En 50 repos, ¿qué se rompió? deps transitivos? anotaciones personalizadas? versiones de herramienta de construcción? flocos de prueba no relacionados con la migración? Cada clase recibe un recuento y una diferencia ejemplar.

## Arquitectura

```
target repo
      |
      v
OpenRewrite / libcst deterministic recipes
   (safe, fast, auditable, ~70-80% of fixes)
      |
      v
Daytona sandbox per branch
      |
      v
agent loop (Claude Opus 4.7 / GPT-5.4-Codex):
   - run build -> capture failures
   - classify failures (build, test, lint)
   - apply fix (patch or retry recipe)
   - rerun
   - budget: 30 min, $8, 20 turns
      |
      v
test + coverage delta gate
      |
      v (passed)
open PR
      |
      v (failed)
file under failure class + attach repro
```

## El establo

- Substrato determinista: OpenRewrite (Java) o libcst (Python)
- Agente: OpenAI Agents SDK o LangGraph sobre Claude Opus 4.7 + GPT-5.4-Codex
- Sandbox: Daytona devcontainers por rama, tiempo de ejecución de objetivo preinstalado (Java 17 / Python 3.12)
- Construir sistemas: Maven, Gradle, uv (Python)
- Indicadores de referencia: Amazon MigrationBench 50 repo subconjunto (Java 8 a 17), Google App Engine Py2-to-Py3 repos
- Arnes de prueba: corredor paralelo, cobertura a través de Jacoco (Java) o coverage.py (Python)
- Observabilidad: Langfuse + trace bundle por repo con cada pieza diferente
- Tablero de control: tablero de control de la taxonomía de fallos con recuentos por clase y diferencias ejemplares

```figure
ce-migration-funnel
```

## Construye el mismo

1. **Recipe pass.**ejecuta OpenRewrite (Java) o libcst (Python) recetas primero. Captura el 70-80% de las migraciones que son mecánicas. Compromete como "recepta" compromete.

2. **Build trial.**Sandbox Daytona: instalar el tiempo de ejecución del objetivo, ejecutar la construcción. si verde, saltar a las pruebas. si rojo, entregar al agente.

3. **Agent loop.**LangGraph con herramientas: `run_build`¿ Qué ?`read_file`¿ Qué ?`edit_file`¿ Qué ?`run_test`¿ Qué ?`git_diff`El agente clasifica el fallo (profundidad, sintaxis, prueba, herramienta de construcción) y aplica una corrección dirigida.

4. **Budget caps.**30 minutos de tiempo por repo, 8 dólares, 20 vueltas de agente. Cualquier violación se detiene y archivos bajo "budget_exhausted" con la diferencia actual.

5. **Test + coverage gate.**Después de que la construcción se vuelva verde, ejecute la suite de pruebas. Compara la cobertura con la repo base. Si la cobertura cayó más de 2 puntos porcentuales, archivar bajo "cobreza_regressión".

6. **PR open.**En el éxito, empuje la rama, abra la PR con la diferencia y un resumen de cuáles recetas se aplicaron y cuál compromete al agente autor.

7. **Failure taxonomy.**Para cada repo fallido, etiquete con una clase: `dep_upgrade_required`¿ Qué ?`build_tool_drift`¿ Qué ?`custom_annotation`¿ Qué ?`test_flake`¿ Qué ?`syntax_edge_case`¿ Qué ?`budget_exhausted`Construye un tablero de control.

8. **50-repo run.**Ejecutar en el subconjunto MigrationBench. Informar por clase tasa de aprobación, costo por repo, cobertura-preservación, y una comparación-versus-determinista-solo línea de base.

## Usalo

```
$ migrate legacy-java-service --target java17
[recipe]   27 rewrites applied (JUnit 4->5, HashMap initializer, try-with-resources)
[build]    FAIL: cannot find symbol sun.misc.BASE64Encoder
[agent]    turn 1 classify: removed_jdk_api
[agent]    turn 2 apply: sun.misc.BASE64Encoder -> java.util.Base64
[build]    OK
[tests]    412/412 passing; coverage 84.1% -> 84.3%
[pr]       opened #1841  cost=$3.20  turns=4
```

## Envío

`outputs/skill-migration-agent.md`Se le da un repo, ejecuta recetas deterministas, luego un bucle de agente para producir una rama migrada verde, o archivando el repo bajo una clase de taxonomía.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | MigrationBench pass rate | 50-repo subset pass@1 |
| 20 | Test-coverage preservation | Mean coverage delta vs base |
| 20 | Cost per migrated repo | $/repo on passing runs |
| 20 | Agent / deterministic-tool integration | Fraction of fixes that OpenRewrite handled vs agent authored |
| 15 | Failure analysis write-up | Taxonomy completeness with exemplars |
| **100** | | |

## Los ejercicios

1. Ejecutar la tubería de migración con OpenRewrite solamente (sin agente). Comparar la tasa de paso con la tubería completa. Identificar los casos en los que el agente solo es la diferencia.

2. Implemente una verificación de "limpieza de linte": después de la migración, ejecute un linter de estilo (sin manchas para Java, ruff para Python). Falle en la PR si aparecen nuevos errores de linte. Mide la tasa de cobertura conservada pero regresada por estilo.

3. Añadir un optimizador de "diferencia mínima": después de que la rama del agente haya superado las pruebas, corregir los cambios innecesarios con un segundo paso.

4. Extensión a una tercera migración: nodo 18 a nodo 22. Reutilice el envase de la caja de arena; intercambiar la capa de receta por un código personalizado.

5. Mide el tiempo de la primera construcción verde (TTFGB) como una métrica UX. Objetivo: p50 en menos de 10 minutos.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Deterministic substrate | "Recipe engine" | OpenRewrite / libcst: declarative AST rewrites with safety guarantees |
| Codemod | "Code-modifying program" | A rewrite rule that changes source code mechanically |
| Build drift | "Tool version skew" | Subtle Maven / Gradle / uv behavior changes between major versions |
| Failure class | "Taxonomy bucket" | A labeled reason a repo did not migrate: dep, syntax, test, build-tool, budget |
| Coverage delta | "Coverage preservation" | Change in test coverage % from base to migrated branch |
| Agent turn | "Tool-call round" | One plan -> act -> observe cycle in the agent loop |
| Budget exhaustion | "Hit the ceiling" | The repo consumed its 30-min / $8 / 20-turn limit without passing |

## Leer más

- [Amazon MigrationBench](https://aws.amazon.com/blogs/devops/amazon-introduces-two-benchmark-datasets-for-evaluating-ai-agents-ability-on-code-migration/) el índice de referencia canónico de 2026
- [Moderne.io OpenRewrite platform](https://www.moderne.io) la referencia determinista del sustrato
- [OpenRewrite documentation](https://docs.openrewrite.org) Autoría de recetas
- [Grit.io](https://www.grit.io) Código alternativo DSL
- [OpenAI sandboxed migration cookbook](https://developers.openai.com/cookbook/examples/agents_sdk/sandboxed-code-migration/sandboxed_code_migration_agent) la referencia de los agentes SDK
- [Google App Engine Py2 to Py3 migrator](https://cloud.google.com/appengine) índice de referencia de migración alternativa
- [libcst](https://github.com/Instagram/LibCST) Substrato determinista de Python
- [Daytona sandboxes](https://daytona.io) Referencia por rama
