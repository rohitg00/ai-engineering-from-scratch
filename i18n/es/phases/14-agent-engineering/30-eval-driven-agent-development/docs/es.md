# Desarrollo de agentes impulsados por Eval

> La guía de Anthropic: "comience con instrucciones simples, optimicelas con una evaluación integral, y añada sistemas agenciales de múltiples pasos solo cuando sea necesario". La evaluación no es el último paso. Es el bucle externo que impulsa todas las demás opciones en la Fase 14.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** All of Phase 14.
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Nombre de las tres capas de evaluación  referentes estáticos, personalizado fuera de línea, producción en línea  y para qué sirve cada uno.
- Explica el bucle cerrado de evaluador-optimizador.
- Describa las mejores prácticas para 2026: evaluaciones en directo junto al código, ejecutadas en CI, relaciones públicas de puertas.
- Conecta cada lección de la Fase 14 al caso de evaluación que genera.

## El problema

Los agentes pasan demos. Ellos fallan en la producción de maneras que las demos no pueden predecir. Los puntos de referencia responden "¿este modelo es amplio en capacidad?" no "este agente está enviando los parches adecuados para mi producto?" La respuesta: evaluación en tres capas, funcionando continuamente, con cada baranda de seguridad y regla aprendida mapeada a un caso de evaluación.

## El concepto

### Tres capas de evaluación

1. **Static benchmarks** SWE-bench Verificado para código (lección 19), WebArena/OSWorld para navegación / escritorio (lección 20), GAIA para generalista (lección 19), BFCL V4 para uso de herramientas (lección 06). Uso para comparación entre modelos y cerraduras de regresión. Contaminación es real: SWE-bench+ encontró una fuga de solución del 32.67% . Siempre informe de puntajes en SWE-bench Verified o en un conjunto de auditorías de fugas como SWE-bench+.

2. **Custom offline evals** la forma de su producto:
   - LLM como juez (Langfuse, Phoenix, Opik  Lección 24).
   - Basado en la ejecución (execute el parche, verifique las pruebas).
   - Basado en la trayectoria (compara secuencias de acción con el oro; OSWorld-Human muestra agentes superiores 1.4-2.7x sobre el oro).

3. **Online evals** Producción:
   - Repeticiones de la sesión (Langfuse).
   - Alertas activadas por la vigilancia (lección 16, 21).
   - El seguimiento de costes / latencia por paso (lección 23 OTel abarca).

### Evaluación-optimización (antrópica)

El bucle apretado:

1. El proponente genera la salida.
2. Los jueces de evaluación.
3. Refinar hasta que el evaluador pase.

Este es el auto-refinado (lección 05) generalizado. Cualquier flujo de agentes que te importa puede envolver en evaluador-optimizador para la confiabilidad.

### 2026 mejores prácticas

- Los Evals viven junto al código.
- Haga informativos en cada PR.
- La combinación de puertas en las puntuaciones de evaluación (por ejemplo, "sin regresión > 5% vs principal").
- Cada baranda de vigilancia hace un mapa de un caso de evaluación.
- Cada regla aprendida (Reflexión, pro-flujo de trabajo-regla de aprendizaje) mapas a un caso de fracaso.

### Enlazación de la fase 14

La mayoría de las lecciones en la Fase 14 generan casos de evaluación.

| Lesson | Eval case it generates |
|--------|------------------------|
| 01 Agent Loop | Budget-exhausted, infinite-loop guard |
| 02 ReWOO | Planner replans correctly when a tool fails |
| 03 Reflexion | Learned reflections apply on retry |
| 05 Self-Refine/CRITIC | Judge passes refined output |
| 06 Tool Use | Argument coercion works; unknown tools rejected |
| 07-10 Memory | Retrieval citations match sources; stale facts invalidate |
| 12 Workflow Patterns | Each pattern produces correct output |
| 13 LangGraph | Resume reproduces state exactly |
| 14 AutoGen Actors | DLQ catches crashed handlers |
| 16 OpenAI Agents SDK | Guardrail trips on the right inputs |
| 17 Claude Agent SDK | Subagent results return to orchestrator |
| 19-20 Benchmarks | SWE-bench Verified score, WebArena success rate, OSWorld efficiency |
| 21 Computer Use | Per-step safety catches injected DOM |
| 23 OTel | Spans emit required attributes |
| 26 Failure Modes | Detectors tag known failures |
| 27 Prompt Injection | PVE refuses poisoned retrievals |
| 28 Orchestration | Supervisor routes to the right specialist |
| 29 Runtime Shapes | DLQ handles N% failure |

Si su suite de evaluación tiene un caso para cada fila, ha cubierto el núcleo de la Fase 14.

### Cuando el desarrollo basado en la evaluación no funciona

- **No baseline.**Los Evals sin un último bien conocido son ilegibles.
- **LLM-judge without grounding.**Los jueces también alucinan. patrón crítico (lección 05)  juicios basados en herramientas externas.
- **Over-fitting to evals.**La optimización para la evaluación se desvía de la utilidad de producción.
- **Flaky evals.**Los casos no deterministas causan falsas alarmas.

```figure
ae-eval-three-layers
```

## Construye el mismo

`code/main.py`es un arnés de evaluación stdlib:

- Registro de casos con categorías (marca de referencia, personalizado, en línea).
- Un agente con guión bajo prueba.
- El ciclo de evaluador-optimizador: proponer, juzgar, refinar hasta el paso o rondas máximas.
- Puerta de CI: tasa de aprobación agregada + regresión frente al nivel de referencia.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

Resultado: por caso, la aprobación/fallo, la bandera de regresión, el veredicto de la puerta de CI.

## Usalo

- Escriba casos de evaluación en el mismo repo que su código de agente.
- Controlarlos en todas las relaciones públicas a través de CI.
- No se construye en regresión.
- Rate de paso de seguimiento a lo largo del tiempo.
- Atájate cada fallo de producción a un nuevo caso.

## Envío

`outputs/skill-eval-suite.md`construye una suite de evaluación de tres capas para un producto agente con puertas de CI y seguimiento de regresión.

## Los ejercicios

1. Toma uno de tus fallos de producción, escribe un caso de evaluación que lo reproduzca. ¿Tu agente lo pasa ahora?
2. Construye una rúbrica de jueces de LLM para su dominio con tres dimensiones (factual, tono, alcance).
3. Enviar la suite de eval en CI. Fallar en la construcción de >=5% regresión.
4. Añadir una métrica de eficiencia de trayectoria: ¿cuántos pasos tomó el agente frente a una trayectoria de oro?
5. Mapa cada lección de la Fase 14 a un caso de evaluación en su suite. ¿Hay algo que falta?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Static benchmark | "Off-the-shelf eval" | SWE-bench, GAIA, AgentBench, WebArena, OSWorld |
| Custom offline eval | "Domain eval" | LLM-as-judge / exec / trajectory on your product shape |
| Online eval | "Production eval" | Session replay, guardrail alerts, cost/latency tracking |
| Evaluator-optimizer | "Propose-judge-refine" | Iterate until judge passes |
| CI gate | "Merge blocker" | Fail the build on eval regression |
| Baseline | "Last-known-good" | Reference score to detect regression |
| Trajectory efficiency | "Steps over gold" | Agent step count divided by human expert minimum |

## Leer más

- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) "comenzar simple, optimizar con evals"
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) el índice de referencia seleccionado
- [Berkeley Function Calling Leaderboard](https://gorilla.cs.berkeley.edu/leaderboard.html) Indicador de referencia de uso de herramientas
- [Langfuse docs](https://langfuse.com/) evaluaciones + repetición de sesiones en la práctica
