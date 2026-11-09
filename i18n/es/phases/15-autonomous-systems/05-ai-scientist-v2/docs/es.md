# Científico de IA v2  Investigación autónoma a nivel de taller

> El científico de IA de Sakana v2 (Yamada et al., arXiv:2504.08066) ejecuta el ciclo completo de investigación: hipótesis, código, experimentos, cifras, redacción, presentación. Es el primer sistema en tener una revisión por pares de documentos en un taller ICLR 2025. Una evaluación independiente (Beel et al.) encontró que el 42% de los experimentos falló por errores de codificación y la revisión de la literatura a menudo etiquetó erróneamente los conceptos establecidos como novedosos. Los propios doctores de Sakana advierten que la base de código ejecuta código escrito por LLM y recomiendan aislamiento de Docker. Ambas mitades de la imagen son el punto.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, research-loop state-machine toy)
**Prerequisites:** Phase 15 · 03 (AlphaEvolve), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## El problema

La investigación es una tarea abierta. A diferencia de la búsqueda algorítmica de AlphaEvolve o la auto-modificación limitada por puntos de referencia de DGM, un resultado de investigación no tiene un criterio de corrección verificable por máquina. Un documento es juzgado por revisores, no por pruebas unitarias. Eso hace que el bucle sea más difícil de cerrar  y más valioso si se cierra, porque la investigación es donde vive el progreso de composición.

El científico de IA v1 (Sakana, 2024) cerró el bucle comenzando con plantillas escritas por humanos. El LLM completó experimentos dentro de un andamio fijo. AI Scientist v2 (Yamada et al., 2025) elimina el requisito de plantilla mediante la búsqueda de árboles con un bucle de crítica de modelos de lenguaje de visión. El sistema genera ideas, implementa experimentos, produce cifras, escribe un artículo e iterar el feedback de los revisores.

Veredicto de revisión por pares: un documento generado por v2 fue aceptado en un taller de ICLR 2025 (con divulgación). Veredicto de evaluación independiente: el sistema está lejos de ser confiable. Ambos son ciertos.

## El concepto

### La arquitectura

1. **Idea generation.**El LLM propone ideas de investigación condicionadas a un tema y literatura previa. v1 utiliza plantillas; v2 utiliza búsqueda agencial sobre un espacio de hipótesis.
2. **Novelty check.**Una etapa de recuperación de la literatura verifica si la idea ha sido publicada. Esta es la etapa en la que la evaluación de Beel et al. encontró etiquetado erróneo  métodos establecidos frecuentemente clasificados como novedosos.
3. **Experiment plan.**El agente redacta un protocolo experimental y escribe código.
4. **Execution.**El código se ejecuta en una caja de arena. Los fallos se devuelven a un ciclo de retoma. En las mediciones de Beel et al., el 42% de los experimentos falló por errores de codificación en esta etapa.
5. **Figure generation.**Un modelo de lenguaje visual lee las cifras generadas y las reescribe para mayor claridad.
6. **Writeup.**El LLM redacta un documento, repite con un revisor interno.
7. **Optional: submission.**El documento se presenta a un lugar.

### Lo que significa el resultado de aceptación del taller

Un documento generado por v2 pasó la revisión por pares en un taller de ICLR 2025. Los autores revelaron el origen del documento al comité del programa. La aceptación es un punto de datos; no es una licencia para afirmar que el sistema "hace investigación".

Un estudio de la naturaleza 2026 documenta el ciclo de extremo a extremo y fue co-autor de investigadores humanos; no es "el sistema escribió un artículo de la naturaleza".

### Lo que encontró la evaluación independiente

Beel et al. (arXiv:2502.14297) realizó una evaluación externa.

- **Experiment failures.**El 42% de los experimentos falló por errores de codificación (importaciones malas, incompatibilidades de forma, variables indefinidas).
- **Novelty mislabeling.**El paso de la recuperación de la literatura con frecuencia señalaba conceptos establecidos como novedosos.
- **Presentation-quality gap.**La crítica de la figura del lenguaje de visión produjo imágenes de grado de publicación, disfrazando las debilidades experimentales subyacentes.

El último hallazgo es el importante para esta fase: un sistema que produce resultados convincentes sin realizar investigaciones convincentes es más peligroso, no más seguro, que uno que obviamente falla.

### La preocupación por la fuga de la caja de arena

El propio repositorio de Sakana README advierte:

> Debido a la naturaleza de este software, que ejecuta código generado por LLM, no podemos garantizar la seguridad. Hay riesgos de paquetes peligrosos, acceso a la web sin control y desove de procesos no deseados. Utilice a su propio riesgo y considere el aislamiento de Docker.

El LLM escribe código; el código se ejecuta; el código puede hacer cualquier cosa que el proceso esté autorizado a hacer. Sin una caja de arena que limite duramente el sistema de archivos, la red y las acciones de proceso, cualquier agente de investigación autodirigido puede exfiltrar datos, quemar computación o reescribirse.

La historia de la caja de arena de AlphaEvolve es más fácil porque su evaluador es apretado. El bucle de AI Scientist v2 ejecuta código abierto con objetivos abiertos. Es por eso que necesita un aislamiento más fuerte (Docker mínimo; seccomp / gVisor preferido) y una revisión manual de cada presentación antes de salir del sistema.

### Donde v2 se encuentra en la pila de fronteras

| System | Target | Output kind | Evaluator | Known failure |
|---|---|---|---|---|
| AlphaEvolve | algorithms | code | unit + benchmark | bounded by evaluator rigor |
| DGM | agent scaffolding | code | SWE-bench | reward hacking |
| AI Scientist v2 | research papers | text + code + figures | peer review (weak) | experiment failures, mislabeling, polish masking weakness |

V2 tiene el evaluador automático más débil de los tres, la superficie de salida más amplia y el camino más corto a artefactos públicos.

```figure
mx-research-loop
```

## Usalo

`code/main.py`simula el bucle v2 como una máquina de estado: idea → novedad verificación → experimento → figura → escritura → revisión → aceptación o iteración. Cada estado tiene una probabilidad de falla configurable extraída de los hallazgos de Beel et al.

- Cuántas ideas llegan a la sumisión.
- Cuántas presentaciones tendrían un fallo experimental crítico que el papel pulido oculta.
- Cómo los presupuestos de retraso intercambian calidad vs rendimiento.

## Envío

`outputs/skill-ai-scientist-sandbox-review.md`es una lista de revisión de dos puertas para cualquier cosa producida por un agente de ciclo de investigación antes de salir de la caja de arena.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`¿Qué fracción de circuitos produce un papel "limpio"? ¿Qué fracción produce un papel con un fallo de experimento?

2. Los valores por defecto ya utilizan el 42% / 25% de Beel et al.`--experiment-failure 0.20 --novelty-mislabel 0.10`y luego con `--experiment-failure 0.60 --novelty-mislabel 0.40`¿Cómo cambia la parte polida pero defectuosa entre las dos carreras?

3. Lea el repositorio de IA Scientist v2 de Sakana sobre los requisitos de la caja de arena. Nombre dos restricciones adicionales (más allá de Docker) que usted aplicaría para una carrera autónoma de varios días.

4. Leer Beel et al. Sección 4 sobre la brecha de calidad de presentación. Diseñar un evaluador adicional que captaría papeles de aspecto pulido pero experimentalmente defectuosos.

5. Propón un protocolo de revisión humana para los resultados de los agentes de investigación que se expanda mejor que "un doctoral lee cada artículo". Identifique el cuello de botella y el diseño alrededor de él.

## Términos clave

| Term | What people say | What it actually means |
|---|---|---|
| AI Scientist v1 | "Sakana's templated research agent" | Filled experiments into a fixed scaffold |
| AI Scientist v2 | "Template-free research agent" | Agentic tree search with VLM figure critique |
| Agentic tree search | "Branching research agent" | Expands multiple experiment plans in parallel; prunes by internal critic |
| Vision-language critique | "VLM polish on figures" | Multimodal model reads figures and rewrites them for clarity |
| Literature retrieval | "Novelty check" | Searches prior work to confirm idea novelty — documented to mislabel |
| Polish masking | "Pretty paper, broken research" | Presentation quality exceeds experimental quality; hides weaknesses |
| Sandbox escape | "LLM code breaks out" | Agent-executed code does things the loop designer did not intend |

## Leer más

- [Yamada et al. (2025). The AI Scientist-v2](https://arxiv.org/abs/2504.08066)- Papel.
- [Sakana blog on the Nature 2026 publication](https://sakana.ai/ai-scientist-nature/) resumen de los proveedores con contexto de revisión por pares.
- [Beel et al. (2025). Independent evaluation of The AI Scientist](https://arxiv.org/abs/2502.14297) Números de evaluación externa.
- [Sakana AI Scientist v1 paper](https://arxiv.org/abs/2408.06292) el predecesor templado.
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) un marco más amplio de los agentes de investigación abiertos.
