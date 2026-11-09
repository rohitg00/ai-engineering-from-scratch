# Política de escalación responsable antropófica v3.0

> RSP v3.0 entró en vigor el 24 de febrero de 2026, reemplazando a la política de 2023. Mitigamiento de dos niveles: lo que Anthropic hará unilateralmente frente a lo que se enmarca como una recomendación a nivel de la industria (incluyendo las normas de seguridad RAND SL-4). Añade mapas de ruta de seguridad fronteriza e informes de riesgos como documentos permanentes en lugar de entregas únicas. Se deja de cumplir el compromiso de pausa para 2023. Introduce el umbral de I+D-4 de la IA: una vez superado, Anthropic debe publicar un caso afirmativo que identifique los riesgos y mitigaciones de desalineamiento. Claude Opus 4.6 no lo cruza. En el anuncio de v3.0, Anthropic dice que "con confianza descartar esto se está volviendo difícil". SaferAI calificó el RSP 2023 en 2.2; redujeron el v3.0 a 1.9, poniendo a Anthropic en la categoría de RSP "débil" junto con OpenAI y DeepMind. Los límites cualitativos sustituyeron a los compromisos cuantitativos de 2023; la eliminación de la cláusula de pausa es la regresión más acentuada.

**Type:** Learn
**Languages:** Python (stdlib, RSP threshold decision engine), TypeScript
**Prerequisites:** Phase 15 · 06 (AAR), Phase 15 · 07 (RSI)
**Time:** ~45 minutes

## El problema

Los laboratorios fronterizos publican políticas de escalación que son en parte documentos técnicos, en parte documentos de gobernanza y en parte señales a los reguladores. RSP v3.0 es el documento antropológico actual. Leerlo de cerca importa no porque el cumplimiento con él sea vinculante (no lo es), sino porque el marco da forma a cómo un laboratorio concibe el riesgo catastrófico y cómo comunica compromisos al público.

La diferencia entre v3.0 y v2.0 es la unidad útil. Lo que se añadió: Hojas de ruta de seguridad fronteriza, informes de riesgos, el umbral de I+D-4 de IA. Lo que se eliminó: el compromiso de pausa de 2023. Lo que se reformó: un calendario de mitigación de dos niveles dividido entre la recomendación unilateral de Anthropic y la de la industria. Revisas externas  SaferAI  rebajó la puntuación de 2.2 (v2) a 1.9 (v3.0). Así es como una política de escala puede ser menos rigurosa mientras se ve más pulida.

## El concepto

### El calendario de mitigación de dos niveles

- **Anthropic unilateral actions**La formación se detiene por encima de un umbral, medidas de seguridad específicas, puertas de despliegue específicas.
- **Industry-wide recommendations**En el caso de la empresa, la empresa no se compromete a cumplir con el objetivo de garantizar la seguridad de los usuarios, sino que se trata de una política de defensa.

La estructura de dos niveles no estaba en v2. Significa que un lector necesita ver en qué columna vive cada compromiso. Una medida de seguridad en la columna "recomendación a nivel de la industria" no es la promesa de Anthropic; es la esperanza de Anthropic.

### El umbral de I+D-4 de IA

Este es el nivel de capacidad RSP v3.0 nombra como el próximo umbral importante. Específicamente: un modelo que podría automatizar una parte sustancial de la investigación de IA a un costo competitivo. Una vez que Anthropic cree que un modelo lo cruza, deben publicar un caso afirmativo identificando los riesgos de desalinamiento y las mitigaciones antes de continuar escalado.

Claude Opus 4.6 no lo cruza según el anuncio de v3.0. El documento agrega: "Es difícil descartar esto con confianza". Esa frase es importante; admite que el umbral está lo suficientemente cerca como para ser una preocupación real, no un límite especulativo.

La lección 6 (Investigación de Alineación Automática) y la lección 7 (Mejora de Sí Misma Recurrente) se alimentan directamente de este umbral.

### Carta de ruta de seguridad fronteriza y informes de riesgos

v3.0 eleva dos tipos de artefactos a documentos permanentes:

- **Frontier Safety Roadmap**: documento prospectivo que describe el trabajo de seguridad planificado, las expectativas de capacidad y la investigación sobre la mitigación.
- **Risk Report**: documento retrospectivo sobre modelos específicos después de su liberación, que describe la capacidad observada y el riesgo residual.

Ambos son públicos. Ambos se actualizan en una cadencia declarada. La utilidad es: el lector puede rastrear cómo lo que Anthropic dijo que haría en una hoja de ruta se compara con lo que informan en un informe de riesgo.

### Eliminar la cláusula de pausa

El RSP 2023 incluyó un compromiso explícito de pausa: si un modelo cruzaba los umbrales de capacidad específicas, la capacitación se detendría hasta que las mitigaciones estuvieran en marcha. v3.0 reemplaza la pausa explícita con una formulación más suave (publicar un caso afirmativo, proceder si las mitigaciones son adecuadas). SaferAI y otros analistas lo calificaron directamente como la regresión más fuerte en el nuevo documento.

El argumento de la política para el cambio: los umbrales cuantitativos en 2023 resultaron ser inalcanzables por los puntos de referencia de capacidad de la era 2026 porque los mismos puntos de referencia fueron reescalados.

### Descenso de la clasificación de SaferAI

SaferAI es una organización independiente que califica documentos de estilo RSP. Su calificación pública: 2023 Anthropic RSP obtuvo 2.2 (de una escala en la que 4.0 es el mejor RSP actual y 1.0 es nominal). v3.0 obtuvo 1.9. Esto movió a Anthropic de "moderado" a "débil", uniéndose a OpenAI y DeepMind en la categoría débil.

Los factores de rebaja por SaferAI:
- Los umbrales cualitativos sustituyeron a los cuantitativos.
- Se ha eliminado el compromiso de pausa.
- Las mitigaciones del umbral de I+D-4 de IA se describen como "casos afirmativos" en lugar de medidas específicas.
- Los mecanismos de revisión dependen del Grupo de Asesoría de Seguridad de Anthropic, con una supervisión independiente limitada.

### ¿Qué no es esta lección?

La lección es leer el documento con la especificidad y el escepticismo que merece. Las políticas de escalación son los principales laboratorios públicos de señales fronterizas que emiten sobre posturas de riesgo catastrófico.

```figure
a5-rsp-ladder
```

## Usalo

`code/main.py`Implementa un pequeño motor de decisión que refleja la forma de evaluación del umbral de RSP: dado un modelo candidato y un conjunto de mediciones de capacidad, devuelve si el umbral de I&D-4 de IA se cruza, las secciones de casos afirmativos requeridas y si la implementación puede continuar. Es intencionalmente simple; el punto es hacer explícita la lógica del documento.

## Envío

`outputs/skill-scaling-policy-review.md`revisa una política de escalado (Antropic, OpenAI, DeepMind o interna) en comparación con la referencia de v3.0: estructura de dos niveles, umbrales, compromisos de pausa, revisión independiente.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`. Introducir tres modelos sintéticos en diferentes niveles de capacidad.

2. Lea RSP v3.0 en su totalidad (32 páginas). Identifique cada compromiso que vive en el nivel de "recomendación a nivel de la industria". ¿Cuál de esos compromisos habría sido "antrópico unilateral" en v2?

3. Lea la metodología de clasificación de RSP de SaferAI. Reproduce su puntaje 1.9 para la versión 3.0 aplicando su rúbrica al documento. ¿Qué fila de rúbrica impulsó la rebaja más?

4. Proponer un compromiso de reemplazo que preserve la credibilidad de la política y reconozca el problema de recalentamiento de los valores de referencia de 2026.

5. Compare RSP v3.0 con OpenAI Preparedness Framework v2 (lección 20). Elige un área donde v3.0 es más fuerte. Elige un área donde el Framework de Preparación es más fuerte.

## Términos clave

| Term | What people say | What it actually means |
|---|---|---|
| RSP | "Anthropic's scaling policy" | Responsible Scaling Policy; v3.0 effective Feb 24, 2026 |
| AI R&D-4 | "Research-automation threshold" | Capability to automate substantial AI research at competitive cost |
| Affirmative case | "Safety justification" | Published argument that risks are identified and mitigations adequate |
| Frontier Safety Roadmap | "Forward plan" | Standing document on planned safety work and expected capabilities |
| Risk Report | "Retrospective on a model" | Standing document on observed capability and residual risk after release |
| Two-tier mitigation | "Unilateral vs industry" | Anthropic commitments vs industry recommendations, separated |
| Pause commitment | "2023 clause" | Explicit promise to pause training; removed in v3.0 |
| SaferAI rating | "Independent RSP grade" | Third-party rubric; v3.0 scored 1.9 (v2 was 2.2) |

## Leer más

- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) la política completa de 32 páginas.
- [Anthropic — RSP v3.0 announcement](https://www.anthropic.com/news/responsible-scaling-policy-v3) resumen de los cambios de v2.
- [Anthropic — Frontier Safety Roadmap](https://www.anthropic.com/responsible-scaling-policy/roadmap) documento permanente vinculado a partir de RSP v3.0.
- [Anthropic — Risk Report: February 2026](https://www.anthropic.com/feb-2026-risk-report) retrospectiva sobre Claude Opus 4.6, el modelo fronterizo en su publicación.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) conecta AI R&D-4 a la autonomía medida.
