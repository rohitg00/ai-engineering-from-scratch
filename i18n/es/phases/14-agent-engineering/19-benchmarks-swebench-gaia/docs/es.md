# Indicaciones de referencia: SWE-bench, GAIA, agenteBench

> Tres puntos de referencia de evaluación de agentes anclaje en 2026. SWE-bench prueba el parcheado de código. GAIA prueba el uso de herramientas generalistas. AgentBench prueba el razonamiento multi-ambiente. Conozca su composición, su historia de contaminación y lo que no miden.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 06 (Tool Use)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Nombre del arnés de prueba del banco SWE (FAIL_TO_PASS) y explica por qué se bloquea en las pruebas de unidad.
- Explica por qué existe el SWE-bench Verified (OpenAI, 500 tareas) y qué elimina.
- Describa el diseño de GAIA: simple para los humanos, difícil para la IA; tres niveles de dificultad.
- Nombre los ocho entornos de AgentBench y su bloqueador principal para LLM de código abierto.
- Resumen de la conclusión de contaminación del banco SWE+ y sus implicaciones.

## El problema

Las tablas de clasificación le dicen qué modelo gana en un punto de referencia.

- Si el indicador de referencia está contaminado (soluciones en los datos de formación, fuga de pruebas).
- Si el índice de referencia mide lo que le importa (código vs navegación vs generalista).
- Si el evaluador es robusto (combinación de AST, controles de estado, revisión por humanos).

Conozca los tres puntos de referencia de anclaje y sus modos de falla antes de citar un número.

## El concepto

### En el caso de los productos de la industria de la industria de la industria, el valor de la producción de productos de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la del del sur.

- 2.294 problemas reales de GitHub de 12 repositorios populares de Python.
- El agente obtiene: la base de código en el prefijo de compromiso + descripción del problema en lenguaje natural.
- El agente produce un parche.
- Evaluación: aplicar parche, ejecutar la suite de pruebas del repo. El parche debe cambiar las pruebas FAIL_TO_PASS (anteriormente fallido, ahora pasando) sin romper las pruebas PASS_TO_PASS.

SWE-agent (Yang et al., 2024) alcanzó el 12,5% en la liberación haciendo hincapié en las interfaces agente-computador (comando de editor de archivos, sintaxis de búsqueda que el modelo entiende).

### En el caso de los bancos de SWE, el valor de la banca de SWE se verificó.

OpenAI, agosto 2024. Subconjunto de 500 tareas curado por humanos. Elimina problemas ambiguos, pruebas poco fiables y tareas donde la solución no estaba clara.

### Contaminación

- Más del 94% de los problemas de la banca SWE preceden a la mayoría de los recortes de modelos.
- **SWE-bench+**El 32,67% de los parches exitosos encontraron soluciones filtradas en el texto de la cuestión (el modelo vio la corrección en la descripción), y el 31,08% fueron sospechosos debido a la escasa cobertura de las pruebas.
- Verificado es más limpio pero no libre de contaminación.

Implicación práctica: un modelo que obtiene un 50% en el banco SWE puede obtener un 35% en el banco SWE. Siempre informe ambos si reclama un rendimiento en el banco SWE.

### La Comisión no puede adoptar medidas en el sentido de que el Estado miembro no pueda adoptar medidas en virtud del artículo 107, apartado 1, del Reglamento (UE) n.o 1095/2012.

- 466 preguntas; 300 retenidas para el ranking privado en huggingface.co/gaia-benchmark.
- Filosofía del diseño: "conceptualmente simple para los humanos (92%) pero difícil para la IA (GPT-4 con plugins: 15%)."
- Pruebas de razonamiento, multi-modalidad, web, uso de herramientas.
- Tres niveles de dificultad; el nivel 3 requiere largas cadenas de herramientas en todas las modalidades.

GAIA es lo que se ejecuta para medir la "capacidad generalista". No se confunda con los puntos de referencia específicos del código.

### El artículo 6 del Reglamento (UE) n.o 1095/2013 se aplica a las medidas de seguridad y seguridad de los trabajadores.

- 8 entornos en todo el código (Bash, DB, KG), juegos (Alfworld, LTP), web (WebShop, Mind2Web) y generación abierta.
- Múltiples giros, ~ 4K-13K giros por división.
- El razonamiento a largo plazo, la toma de decisiones y la instrucción a continuación son los obstáculos para que los LLM OSS alcancen a los comerciales.

### Lo que estos no miden

- Costo operativo real (tokens, reloj de pared).
- Comportamiento de seguridad en condiciones adversas.
- El rendimiento en su dominio (utilice sus propias evaluaciones, lección 30).
- Las fallas de cola (medio de puntos de referencia; los operadores de producción se preocupan por el peor 1%).

### Cuando el benchmarking sale mal

- **Single-number fixation.**El 50% del banco SWE le dice menos que el costo de P50/P75/P95 + distribución de pasos.
- **Contaminated claims.**La información sobre el banco SWE sin mencionar el banco Verified o el banco SWE+ es engañosa.
- **Benchmark-as-development-target.**La optimización para el índice de referencia difiere de la utilidad de producción.

```figure
ae-swebench-gate
```

## Construye el mismo

`code/main.py`se aplica un arnés de juego SWE-bench:

- Tarea de solución de errores sintéticos (3 tareas).
- Un "agente" con guión que propone parches.
- Un ejecutor de prueba que comprueba FAIL_TO_PASS (bug ahora fijado) y PASS_TO_PASS (nada roto).
- Un clasificador de dificultad de estilo GAIA basado en la profundidad de la descomposición de la pregunta.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

La salida muestra la tasa de resolución por tarea + por dificultad y hace concretas las reglas del evaluador.

## Usalo

- **SWE-bench Verified**Siempre reportar las puntuaciones verificadas.
- **GAIA**Para los agentes generalistas, usa la división de la tabla de clasificación privada.
- **AgentBench**para la comparación entre múltiples entornos.
- **Custom evals**(Lección 30) para la forma real de su producto.

## Envío

`outputs/skill-benchmark-harness.md`construye un arnés de estilo SWE-bench para cualquier par de tareas de base de código con puertas FAIL_TO_PASS / PASS_TO_PASS.

## Los ejercicios

1. Portar el arnés de juguete para que se ejecute en un repo real (escolle uno de los suyos). Escriba 3 pruebas FAIL_TO_PASS para detectar errores conocidos.
2. Añadir una métrica de recuento de pasos. ¿Cuántos pasos de agente por resolución?
3. Lea el documento SWE-bench+. Implemente una verificación de fuga de solución (paraleje de patrón del texto de la cuestión con la diferencia).
4. Descarga una pregunta de GAIA de la división pública, rastrea lo que un agente de clase GPT-4 haría. ¿Qué herramientas necesita?
5. Lea la descripción de medio ambiente del agente Bench. ¿Qué medio ambiente refleja la superficie de su producto?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| SWE-bench | "Code agent benchmark" | 2,294 GitHub issues; patch must flip FAIL_TO_PASS tests |
| SWE-bench Verified | "Clean SWE-bench" | 500 human-curated tasks, OpenAI |
| FAIL_TO_PASS | "Fix gate" | Tests previously failing that must pass after the patch |
| PASS_TO_PASS | "No-regression gate" | Tests that were passing and must still pass |
| GAIA | "Generalist benchmark" | 466 human-easy / AI-hard multi-tool questions |
| AgentBench | "Multi-env benchmark" | 8 environments; long-horizon multi-turn |
| Contamination | "Training-set leak" | Benchmark tasks present in model training |
| SWE-bench+ | "Contamination audit" | 32.67% solution leakage found in successful SWE-bench patches |

## Leer más

- [Jimenez et al., SWE-bench (arXiv:2310.06770)](https://arxiv.org/abs/2310.06770) el índice de referencia original
- [OpenAI, SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) el subconjunto seleccionado
- [Mialon et al., GAIA (arXiv:2311.12983)](https://arxiv.org/abs/2311.12983) Referencia generalista
- [Liu et al., AgentBench (arXiv:2308.03688)](https://arxiv.org/abs/2308.03688) Suite multiambiental
