# El paisaje de los agentes de codificación autónomos (2026)

> El banco SWE-Verified pasó del 4% al 80,9% en menos de tres años. El mismo Claude Sonnet 4.5 obtuvo un puntaje del 43,2% en SWE-agent v1 y el 59,8% en Cline autonomo  el andamio alrededor del modelo ahora importa tanto como el propio modelo. OpenHands (anteriormente OpenDevin) es la plataforma más activa con licencia MIT y su bucle CodeAct ejecuta acciones Python directamente en una caja de arena en lugar de llamadas de herramientas JSON. Los números de encabezado ocultan un problema metodológico: 161 de las 500 tareas verificadas de SWE-bench requieren solo un cambio de línea de 12, y SWE-bench Pro (10 tareas de línea superior) se sitúa en 2359% para los mismos modelos fronterizos.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, CodeAct vs JSON tool-call comparison)
**Prerequisites:** Phase 14 · 07 (Tool use), Phase 15 · 01 (Long-horizon agents)
**Time:** ~45 minutes

## El problema

La pregunta correcta es: en una distribución de tareas que coincida con mi trabajo, con el andamio que voy a ejecutar en producción, ¿qué fiabilidad de extremo a extremo obtengo?

Entre 2022 y 2026, el campo aprendió que el andamio  la capa de recuperación, el planificador, la caja de arena, el bucle de edición-verificación, el formato de retroalimentación  es cargador. Claude Sonnet 4.5 en SWE-agent v1 obtuvo un puntaje del 43,2% en SWE-bench Verified; el mismo modelo dentro del andamio autónomo de Cline obtuvo un puntaje del 59,8%. 16.6 puntos de diferencia absolutos, mismos pesos. El modelo base es un componente; el bucle es el producto.

El problema con el que se trata es que la saturación de los benchmarks oculta regresiones. SWE-bench Verified está cerca de estar saturado, y la cola de tareas fáciles (161 de 500 tareas que requieren ≤2 líneas) aumenta los puntajes. La calidad del mundo real se mide mejor en distribuciones como SWE-bench Pro (10+ cambios de línea), donde los mismos líderes todavía se sientan en 2359%.

## El concepto

### En el caso de los Estados miembros, el artículo 1 del Reglamento (UE) n.o 525/2014 se aplica a los Estados miembros.

SWE-bench (Jimenez et al.) toma problemas reales de GitHub con parches de verdad en el suelo y pide a un agente que produzca un parche que haga pasar la suite de pruebas. SWE-bench Verified (OpenAI, 2024) es un subconjunto de 500 tareas curado por el hombre con las tareas ambigüas y rotas eliminadas. SWE-bench Pro es el sucesor más difícil de las tareas que requieren 10+ líneas de cambio, donde los agentes fronterizos actuales se sientan en 2359%.

### Lo que la curva 2022 → 2026 realmente muestra

- **2022**En el caso de los modelos de investigación, el valor de la producción de los modelos de investigación es de ~4% en el banco de SWE en bruto.
- **2024**: GPT-4 + andamios de estilo Devin en ~14%; agente SWE en ~12%.
- **2025**: Claude 3.5/3.7 Sonet dentro de Aider y agente SWE empujar en el rango de 4055%.
- **2026**Claude Sonnet 4.5 y competidores fronterizos en 7080%+ en el banco SWE-Verified.

La pendiente proviene de tres fuentes de composición: mejores modelos base, mejores andamios (CodeAct, reflexión, bucles verificadores) y mejores puntos de referencia (eliminación de ruido verificado).

### Llamadas de herramientas CodeAct vs JSON

OpenHands (All-Hands-AI, arXiv:2407.16741, anteriormente OpenDevin) tomó una apuesta arquitectónica específica: en lugar de que el modelo emita llamadas de herramienta JSON que un host decodifica y ejecuta, el modelo emite código Python y un kernel de estilo Jupyter lo ejecuta en una caja de arena.

El acuerdo de cambio:

- **JSON tool calls**: cada acción es una vez; fácil de auditar; composicionalidad limitada; seguro por defecto porque cada llamada pasa por un validador explícito.
- **CodeAct**: una acción puede ser un programa completo; composición; requiere una caja de arena endurecida (OpenHands utiliza aislamiento Docker); los modos de falla incluyen cualquier cosa que el tiempo de ejecución de la caja de arena permita.

Ambas arquitecturas están en producción. CodeAct es dominante en plataformas abiertas (OpenHands, smolagents). Las llamadas de herramientas JSON siguen siendo dominantes en servicios administrados (Agentes Administrados Antropicos, Asistentes OpenAI) donde el proveedor controla el ejecutor.

### Escaflados en el paisaje 2026

| Scaffold | License | Execution model | Notable property |
|---|---|---|---|
| OpenHands (OpenDevin) | MIT | CodeAct in Docker | Most active open platform; event-stream replayable |
| SWE-agent | MIT | Agent-Computer Interface (ACI) | First end-to-end SWE-bench scaffold |
| Aider | Apache-2 | edit-via-diff in local repo | Minimal scaffold, strong regression stability |
| Cline | Apache-2 | VS Code agent with tool policy | Highest-scoring open scaffold on Sonnet 4.5 |
| Devin (Cognition) | Proprietary | Managed VM + planner | First "AI software engineer" product category |
| Claude Code | Proprietary | Permission modes + routines | Lesson 10 covers the agent loop in detail |

### Por qué el andamio domina

Una carrera de codificación es una trayectoria de largo horizonte (lección 1). Compuestos de fiabilidad a través de los pasos. Tres lugares donde el andamio compra puntos:

1. **Retrieval**El ACI de SWE-agent, el índice de archivos de OpenHands y el mapa de repos de Aider atacan esto.
2. **Verifier loop**: ejecutar pruebas, leer huellas de pila y volver a intentar es un delta de 10 puntos más en el banco SWE.
3. **Failure containment**El mismo modelo con y sin un bucle de verificación se parece a dos productos diferentes.

### La saturación de los puntos de referencia y la distribución real

Los autores de OpenHands y Epoch AI señalan que SWE-bench Verified tiene una cola fácil: 161 de 500 tareas necesitan solo 12 líneas de cambio. Las puntuaciones altas son impulsadas en parte por esta cola. SWE-bench Pro se limita a más de 10 cambios de línea y devuelve puntuaciones en el rango de 2359% incluso para sistemas fronterizos.

Implicación para elegir un agente: ejecutar un subconjunto Pro-like de su propio backlog de errores. La puntuación que importa es la puntuación en las tareas representativas de lo que envías.

```figure
a5-scaffold-delta
```

## Usalo

`code/main.py`compara dos andamios de agentes de juguete en una distribución fija de mini tareas:

1. ¿ Qué es esto ?**JSON tool-call**un andamio que toma una acción por turno.
2. ¿ Qué es esto ?**CodeAct**un andamio que puede emitir un pequeño fragmento de Python por acción.

Ambos usan un "modelo" de estubes (reglas deterministas) por lo que la comparación aisla el andamio de la calidad del modelo.

## Envío

`outputs/skill-scaffold-audit.md`ayuda a auditar un andamio de agentes de codificación propuesto antes de su adopción: calidad de recuperación, presencia de verificadores, aislamiento de la caja de arena y ajuste de referencia a distribución.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`¿Cuántos giros hace cada andamio en el mismo conjunto de tareas? ¿Cuál es el radio de explosión por acción de cada uno?

2. Lea el documento OpenHands (arXiv:2407.16741). El documento argumenta que CodeAct supera las llamadas de herramienta JSON en tareas complejas. Identifique un modo de falla que el documento reconoce y escriba una frase sobre cuándo ese modo predominaría en la producción.

3. Seleccione una tarea de su cartera de errores que requiere más de 10 líneas de cambio en dos archivos. Estima la probabilidad de éxito de extremo a extremo para un modelo fronterizo bajo (a) llamadas a herramientas JSON y (b) CodeAct. Justifique la brecha.

4. SWE-bench Verified tiene 161 tareas de un solo archivo, 12 líneas. Construir una puntuación que las excluya. ¿Cómo se mezcla la tabla de clasificación?

5. Lea "Introducing SWE-bench Verified" (OpenAI). Explica la metodología específica utilizada para eliminar tareas ambigüas y nombra una categoría que la curadora no vería.

## Términos clave

| Term | What people say | What it actually means |
|---|---|---|
| SWE-bench | "Coding benchmark" | Real GitHub issues with ground-truth patches and test suites |
| SWE-bench Verified | "Cleaned subset" | 500 human-curated tasks, easier-tail present |
| SWE-bench Pro | "Harder subset" | 10+ line changes; frontier sits at 23–59% |
| CodeAct | "Code-as-action" | Agent emits Python; Jupyter-style kernel executes in sandbox |
| JSON tool call | "Function calling" | Each action is a structured JSON payload validated before execution |
| Scaffold | "Agent framework" | Retrieval + planner + executor + verifier loop around the base model |
| ACI (Agent-Computer Interface) | "SWE-agent's format" | Command set designed for LLM ergonomics, not human shells |
| Verifier loop | "Test-and-retry" | Run tests, read output, revise patch; biggest non-model reliability gain |

## Leer más

- [Jimenez et al. — SWE-bench](https://www.swebench.com/) el índice de referencia y la metodología originales.
- [OpenAI — Introducing SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) cómo se construyó el subconjunto seleccionado.
- [Wang et al. — OpenHands: An Open Platform for AI Software Developers](https://arxiv.org/abs/2407.16741) Arquitectura de CodeAct y diseño de eventos.
- [Epoch AI — SWE-bench leaderboard](https://epoch.ai/benchmarks) puntajes en vivo.
- [Anthropic — Measuring agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) Enmarcado de fiabilidad de los agentes codificadores de largo horizonte.
