# METR Horizontes temporales y evaluación de la capacidad externa

> METR (ex-ARC Evals) es una organización independiente 501(c)(3) desde diciembre de 2023. Su referencia Time Horizon 1.1 (enero 2026) se ajusta a una curva logística de probabilidad de éxito de tarea vs log(experto tiempo de finalización humana); la intersección en probabilidad del 50% define el horizonte temporal del modelo. El conjunto de compromiso 20252026 cubre GPT-5.1, GPT-5.1-Codex-Max y evaluaciones de monitoreo de prototipos (puede un monitor realizar tareas secundarias; puede el agente evadirlas). Suites de referencia: HCAST (180+ ML, ciber, SWE, tareas de razonamiento; de 1 minuto a 8+ horas), RE-Bench (71 ML tareas de investigación e ingeniería con base de expertos), SWAA. La nota honesta: las mediciones de METR están idealizadas  sin humanos, sin consecuencias reales  y el equipo ha documentado la brecha de comportamiento de evaluación frente a la implementación (lección 1). Un horizonte temporal es un límite superior, no una predicción de despliegue.

**Type:** Learn
**Languages:** Python (stdlib, logistic-fit horizon estimator), TypeScript
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 19 (RSP)
**Time:** ~60 minutes

## El problema

Las políticas de escalación (lecciones 19, 20) son tan útiles como las mediciones a las que se refieren. "Párrafo de I+D-4 de IA" y "Autonomía de largo alcance" se definen en la prosa de la política; se vuelven actuables solo cuando evaluaciones específicas producen números específicos.

METR es la organización de evaluación externa 20242026 que ha definido muchos de esos números. Evaluan modelos fronterizos  a menudo pre-lanzamiento, bajo NDA con laboratorios  y publican la metodología después. El punto de referencia Time Horizon 1.1 (enero 2026) es su artefacto principal: un único escalar que comprime la capacidad en una unidad legible por el hombre ("este modelo puede hacer el tipo de tarea en la que un experto pasa X horas con una fiabilidad del 50%").

La lección es en parte sobre la metodología (cómo se calcula un horizonte) y en parte sobre la interpretación (por qué un horizonte es un límite superior, no una predicción de despliegue). Las dos habilidades pertenecen a una sola.

## El concepto

### METR de fondo

- Fundada: diciembre de 2023 (ex-ARC Evals, desvinculada en una organización independiente 501 ((c) ((3)).
- Ámbito de aplicación: evaluación de las capacidades autónomas de los modelos fronterizos, a menudo pre-lanzamiento.
- Laboratorios asociados: Antropic, OpenAI (múltiples compromisos 20252026).
- Resultados notables: Horizonte temporal 1.0 (marzo 2025), Horizonte temporal 1.1 (enero 2026), evaluaciones de monitoreo de prototipos.

### El horario del tiempo se ajusta

Metodología (desde el blog y los artículos de METR):

1. Recoger una suite de tareas que abarca de la escala de minutos a la escala de horas de los tiempos de finalización experto.
2. Ejecutar el modelo en cada tarea; registrar el éxito o el fracaso.
3. Encuentra una curva logística: $P(\text{success})$como función de $\log(\text{expert completion time})$¿ Qué ?
4. El horizonte es el tiempo experto en el que P (sucesión) = 0,5.

La forma logística-ajuste es la correcta porque la capacidad generalmente tiene una relación creciente, que se acerca a la meseta con la dificultad de la tarea. El punto del 50% es una opción (podría ser 10%, 90%); METR informa múltiples umbrales en el documento detallado, pero lidera con el 50% porque es el más intuitivo.

### Los números de enero de 2026

Por Horizonte temporal 1.1:

- Claude Opus 4.6: ~ 14 horas con fiabilidad del 50%, a partir de Time Horizon 1.1 (enero 2026).
- El tiempo duplicado en tareas de estilo HCAST: ~4,3 meses (130,8 días) en el ajuste post-2023 reportado por Time Horizon 1.1 (enero 2026); la cifra de ~7 meses es el ajuste completo 20192025 de Time Horizon 1.0 y se informa en TH1.1 junto con el número post-2023.

Esos son los números específicos que restan en las referencias de la Fase 15. Son citados en el RSP v3.0 (lección 19) de Anthropic y en el FSF v3 (lección 20) de DeepMind como una de las mediciones que alimentan las evaluaciones de umbral.

### Suites de referencia

- **HCAST**Las tareas de la empresa son: 189 en el área de tecnología de inteligencia, ciberseguridad, ingeniería de software y razonamiento general.
- **RE-Bench**: 71 tareas de investigación e ingeniería de ML con un experto humano. Medir si el modelo puede realizar el tipo de trabajo de I+D de ML que alimenta el umbral de I+D-4 de IA.
- **SWAA**: tareas más cortas; útiles para calibrar el extremo inferior de la curva del horizonte.

### Evaluaciones de monitoreo de prototipos

20252026 Trabajo METR incluyó prototipos de monitoreo-evaluación: puede un monitor atrapar un modelo que realiza una tarea secundaria (algo distinto de lo que el operador pidió); puede el agente evadir el monitor. Estos alimentan directamente la categoría "Salvaguardias minantes" en OpenAI PF v2 y el monitoreo de alineación engañosa en DeepMind FSF v3 (lección 20).

### Por qué los horizontes son límites superiores

- **Idealized tooling**Las tareas de referencia proporcionan al modelo herramientas limpias y datos bien formateados.
- **No real consequences**El modelo nunca factura a un cliente, elimina datos reales o contacta con personas reales.
- **Eval-context gaming**Las pruebas de inteligencia artificial se comportan de manera diferente en los modelos.
- **No legitimate user variance**Las solicitudes de referencia son estructuradas.

El horizonte es el límite de capacidad en condiciones favorables. La fiabilidad de la implementación es diferente, más baja, y los equipos deben medir su propia distribución para conocerlo.

### El caso del evaluador externo

La evaluación externa es importante porque los laboratorios internos tienen incentivos para optimizar las métricas que informan. La independencia de METR  un 501 ((c) (3) con una metodología declarada y documentos revisados por pares  es la mitigación estructural. No es suficiente solo (los laboratorios todavía controlan lo que METR ve), pero es estrictamente mejor que ninguna evaluación externa.

### Cómo utilizar los números de horizonte en la práctica

- **As a capability filter**Si el horizonte de un modelo está muy por debajo del tiempo de expertos de una tarea propuesta, no lo envíe de forma autónoma (fichero de habilidades de Lesson 1).
- **As a trend indicator**El tiempo de duplicación indica cuánto tiempo la práctica actual permanecerá segura incluso sin nuevas mitigaciones.
- **As a prior**El objetivo de la evaluación es mejorar la calidad de la información y la calidad de las herramientas.

```figure
a5-horizon-fit
```

## Usalo

`code/main.py`Implementa un ajuste logístico de la tarea-éxito vs $\log(\text{expert time})$El estudio de la evaluación de los resultados de la evaluación de contexto muestra los cambios que se producen cuando la tasa de éxito se infla artificialmente por el juego de contexto de evaluación.

## Envío

`outputs/skill-horizon-interpretation.md`revisa la afirmación de horizonte de un proveedor y produce un análisis de la brecha entre la afirmación de referencia y la realidad de la implementación.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Confirmar que el 50% del horizonte de ajuste coincide con la verdad sintética de la tierra. Ahora, dime la cuadrícula de tiempo de tarea. ¿Estimar el horizonte el cambio significativamente?

2. Lea la publicación de blog Time Horizon 1.1 de METR. Identifique las tareas específicas en las que la fiabilidad es más alta y en las que es más baja. Explique por qué existe la brecha.

3. Lea los recursos de METR "Medición de capacidades de IA autónomas". Enumera las categorías de tareas de HCAST. Elige una categoría que ponderas más pesadamente para una tarea de producción y justifique por qué.

4. Introduzca juegos de eval-contexto en el simulador: invertir ~20% de las tareas fallidas para el éxito. Informar el nuevo horizonte. Esto se aproxima a lo que hace una tasa de juego de 20% al número observado.

5. Diseñe una evaluación de horizonte interno en su propio archivo de errores o un conjunto de tareas representativo. Describa la recopilación de datos, el ajuste y lo que le dice la salida. Compara con los números METR.

## Términos clave

| Term | What people say | What it actually means |
|---|---|---|
| METR | "External evaluator" | ex-ARC Evals; independent 501(c)(3) since Dec 2023 |
| Time Horizon | "Capability measure" | Expert task length at 50% reliability, from logistic fit |
| HCAST | "METR's main suite" | 180+ tasks spanning 1 min to 8+ hours |
| RE-Bench | "Research engineering" | 71 ML research-engineering tasks with human baseline |
| SWAA | "Short-task suite" | Calibrates the low end of the horizon curve |
| Doubling time | "Growth rate" | Time for the 50% horizon to double; ~7 months per HCAST |
| Eval-context gaming | "Model behaves differently" | Documented behavior gap between tests and deployment |
| Upper bound | "Horizon is a ceiling" | Benchmark horizon > deployment reliability under load |

## Leer más

- [METR — Resources for Measuring Autonomous AI Capabilities](https://metr.org/measuring-autonomous-ai-capabilities/) HCAST, RE-Bench, especificaciones de SWAA.
- [METR — Measuring AI Ability to Complete Long Tasks](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/) el papel original del horizonte.
- [METR — Time Horizon 1.1 (January 2026)](https://metr.org/research/) Números y metodología actuales.
- [Epoch AI — METR Time Horizons benchmark](https://epoch.ai/benchmarks/metr-time-horizons) seguimiento en vivo.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) Perspectiva interna de las mediciones de los METR.
