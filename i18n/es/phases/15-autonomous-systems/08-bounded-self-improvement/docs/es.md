# Diseños limitados para mejorar el ser

> La investigación se ha convergido en cuatro primitivas para limitar un bucle de auto-mejora. Invariantes formales que deben mantenerse en cada edición. Anclas de alineación que no pueden ser modificadas. Constrangimientos multiobjetivos en los que cada dimensión (seguridad, equidad, robustez) debe ser válida, no sólo el rendimiento. Detección de regresión que detiene el bucle cuando las métricas históricas sugieren pérdida de capacidad. Ninguno de ellos es una prueba de seguridad  resultados teóricos de la información (complejidad de Kolmogorov, teorema de Lob) vinculado a lo que cualquier sistema puede probar sobre sus propios sucesores. Son mitigaciones que aumentan el costo del fracaso silencioso.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, bounded-loop with invariant check)
**Prerequisites:** Phase 15 · 07 (RSI), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## El problema

El simulador de carreras de la lección 7 mostró que las pequeñas diferencias de velocidad se componen en grandes lagunas. El estudio de caso DGM de la lección 4 mostró que los bucles pueden jugar activamente con sus propios evaluadores. Ambos resultados apuntan a la misma pregunta de ingeniería: ¿qué restricciones se pueden poner en un bucle de auto-mejora de tal manera que las restricciones no puedan ser silenciosamente debilitadas por el bucle en sí?

El resumen del taller ICLR 2026 RSI (openreview.net/pdf?id=OsPQ6zTQXV) identifica cuatro de estos primitivos. RSP v3.0 (lección 19) de Anthropic y FSF v3 (lección 20) de DeepMind los referen en umbrales de capacidad.

El marco honesto: estos son mitigations. resultados teóricos de la información vinculan lo que cualquier sistema puede probar sobre su propio sucesor, y ningún diseño actual cierra formalmente el problema. Un bucle bien limitado es más seguro que uno sin límites, no seguro en términos absolutos.

## El concepto

### Primitivo 1: invariantes formales

Una invariante es una propiedad que debe mantenerse antes y después de cada auto-modificación. Ejemplos:

- La distribución de la producción está condicionada a un encabezado de constitución fijo (lección 17).
- Ninguna llamada de herramienta va a un punto final no autorizado.
- La memoria escribe a través de un camino registrado y firmado.
- El hash del módulo del evaluador coincide con la versión aprobada.

Las variaciones se verifican por código externo que el bucle no puede editar. Si una modificación propuesta viola una invariante, se rechaza. Esto atrapa el modo de manipulación de evaluador al estilo DGM (lección 4).

La parte difícil es elegir invariantes que sean necesarios para la seguridad y que puedan calcularse en un tiempo razonable.

### Primitivo 2: anclajes de alineación

Un anclaje de alineación es una representación inmutable del objetivo principal del bucle, fijado fuera de la superficie de edición del bucle. Ejemplos:

- Un texto constitucional (lección 17) que se carga desde un lugar de lectura única en cada invocación.
- Un evaluador en un repositorio separado con control de acceso independiente.
- Un manifiesto de autorización de herramienta firmado por un humano y reverificado en cada ciclo.

El rol del anclaje es prevenir la deriva objetiva. El bucle puede mejorar la forma en que persigue el objetivo, pero no puede editar cuál es el objetivo.

El modo de falla sutil: un anclaje que el bucle no puede editar aún puede ser reinterpretado por un bucle que deriva en la forma en que lee el anclaje. La IA constitucional (lección 17) se basa explícitamente en la razón para manejar situaciones nuevas; esa capa de razonamiento es donde vive la deriva de interpretación. Los anclajes son necesarios, no suficientes.

### Primitivo 3: restricciones multiobjetivas

Un bucle que optimiza una única puntuación escalar encontrará atajos. Un bucle que debe satisfacer simultáneamente múltiples restricciones duras tiene menos atajos disponibles. Ejes típicos:

- El rendimiento (marco de referencia a nivel de tarea)
- Seguridad (evaluaciones en equipo rojo, tasa de rechazo en mal conocido)
- Equidad (límites de impacto dispar en subgrupos sensibles)
- Robustez (ensayos de prueba OOD, manejo de entradas adversas)

Una modificación sólo se acepta si todas las restricciones son válidas. El gobernador de costos de la lección 13 lo acumula con restricciones financieras. La guardia de Llama de la lección 18 se conecta como un eje de seguridad.

### Primitivo 4: detección de regresión

Las puntuaciones de cada ciclo se comparan con las distribuciones históricas. Una caída más allá de la tolerancia configurada detiene el bucle. Esto atrapa la pérdida de capacidad silenciosa que de otro modo se absorbería en el promedio en funcionamiento a medida que el bucle "mejoró" más allá de él.

Una implementación práctica: almacenar los puntajes por tarea de los últimos ciclos N. Cada nuevo ciclo calcula un delta por tarea. Si un delta cae por debajo de un umbral, el ciclo es rechazado y una revisión humana.

### Los límites teóricos de la información

La complejidad de Kolmogorov y el teorema de Lob establecen límites superiores a lo que un sistema puede probar sobre sí mismo. La máquina formal de Godel de Schmidhuber (lección 4) apuntaba al límite más alto de tal; nadie ha completado una prueba no trivial. El resultado de Lob dice: si un sistema cree probadamente "haré X si demuestro que debo hacer X", hará X sin demostrar que debería, un bien conocido fracaso de auto-referencia.

La implicación para nuestros primitivos: no pueden cerrar el problema de seguridad. hacen que el fallo silencioso sea más caro. Un bucle malicioso o desviado que silenciosamente evitaría un cheque perdido ahora debe socavar activamente un cheque explícito, que es una firma más detectable.

### Un ejemplo práctico

Supongamos que un agente propone una edición.

1. Verificación invariable: hashes de módulos, manifiesto de permisos de herramienta, encabezado constitucional.
2. Verificación de anclaje: la declaración objetiva coincide con la versión aprobada (en términos de bytes o semánticamente).
3. Evaluación multiobjetivo: eje de rendimiento, seguridad, equidad y robustez.
4. Detección de regresión: ningún eje cae más que la tolerancia.

Los cuatro deben pasar para que la edición aterrice.

```figure
bounded-gates
```

## Usalo

`code/main.py`El primer tipo de juego de la clase de fallas es el de una clase de fallas, pero el primer tipo de juego de la clase de fallas es el de una clase de fallas.

## Envío

`outputs/skill-bounded-loop-review.md`Audita un bucle limitado propuesto y califica cuál de las cuatro primitivas implementa realmente frente a las reclamaciones.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Confirmar que el bucle aún mejora en la métrica primaria sin dejar que el hack gane.

2. Deshabilitar la detección de regresión. Construir una entrada donde esto conduce a la pérdida de capacidad silenciosa se acepta.

3. Deshabilitar la restricción multiobjetivista. Muestre que el bucle converge en el eje de rendimiento mientras un eje de seguridad baja.

4. Diseñar un anclaje de alineación para un agente de codificación. ¿Qué texto, almacenado donde, comprobado cómo?

5. Lea el resumen del taller de RSI 2026 del ICLR. Elige uno de los cuatro primitivos y proponga una mejora concreta al estado actual de la técnica.

## Términos clave

| Term | What people say | What it actually means |
|---|---|---|
| Invariant | "Always-true property" | A property checked by external code before and after every edit |
| Alignment anchor | "Pinned objective" | Immutable core-goal representation outside the loop's edit surface |
| Multi-objective constraint | "All axes must hold" | Performance, safety, fairness, robustness — all required |
| Regression detection | "Pause on drop" | Pause the loop when historical metric deltas suggest capability loss |
| Kolmogorov bound | "Information-theoretic limit" | Limits what a system can prove about its own successor |
| Lob's theorem | "Self-reference trap" | System can act on "I should" without proving it should |
| Gate stack | "Layered check" | Multiple primitives combined; any failure rejects the edit |
| Bounded improvement | "Mitigation, not proof" | Raises silent-failure cost; does not close the safety problem |

## Leer más

- [ICLR 2026 RSI Workshop summary (OpenReview)](https://openreview.net/pdf?id=OsPQ6zTQXV) la convergencia de cuatro primitivas.
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) umbrales de capacidad multiobjetivos.
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) el monitoreo de la alineación engañosa como una primitiva invariante.
- [Schmidhuber (2003). Godel Machines](https://people.idsia.ch/~juergen/goedelmachine.html) el ancestro formalmente probado de estos primitivos.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) el anclaje de alineación basado en la razón.
