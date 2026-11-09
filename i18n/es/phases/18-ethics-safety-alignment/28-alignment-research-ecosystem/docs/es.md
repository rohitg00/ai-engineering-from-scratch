# Ecosistema de investigación de alineación  MATS, Redwood, Apollo, METR

> Cinco organizaciones definen la capa de investigación de alineación no de laboratorio para 2026. MATS (ML Alignment & Theory Scholars): 527+ investigadores desde finales de 2021, 180+ artículos, 10K+ citas, h-index 47; cohortas incorporadas en el verano de 2024 como 501 ((c) ((3) con ~ 90 académicos y 40 mentores; 80% de los ex alumnos de pre-2025 trabajan en seguridad / seguridad con 200+ en Anthropic, DeepMind, OpenAI, UK AISI, RAND, Redwood, METR, Apollo. Redwood Research: laboratorio de alineación aplicada fundado por Buck Shlegeris; introdujo el control de IA (lección 10); colabora con AISI del Reino Unido en casos de seguridad de control. Investigación de Apolo: evaluaciones de esquemas de preimpiego para laboratorios fronterizos; autor de In-Context Scheming (Lección 8) y Towards Safety Cases for AI Scheming. METR (Model Evaluation and Threat Research): evaluaciones de capacidad basadas en tareas, estudios de horizonte de tiempo de tareas autónomas; "Elementos comunes de las políticas de seguridad de la IA fronteriza" compara los marcos de laboratorio. Eleos AI Research: evaluaciones previo al despliegue de modelos de bienestar (lección 19); realizó una evaluación de bienestar de Claude Opus 4.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 18 · 01-27 (prior Phase 18 lessons)
**Time:** ~45 minutes

## Objetivos de aprendizaje

- Identificar las cinco organizaciones del ecosistema de investigación de alineación fuera de laboratorio y su producción principal.
- Describa la escala del MATS (estudiantes, documentos, índice h) y su papel como un grupo de talentos.
- Describa la agenda de Control de Inteligencia Artificial de Redwood y su asociación con AISI del Reino Unido.
- Describa la metodología de evaluación basada en tareas del METR.

## El problema

Los laboratorios fronterizos (lección 18) producen evaluaciones de seguridad internamente y publican resultados seleccionados. El ecosistema fuera de los laboratorios es donde se validan las evaluaciones, donde se descubren por primera vez los nuevos modos de falla y donde se capacitan los talentos.

## El concepto

### MATS (M.L. Alineación y Teoría de Estudiantes)

Comenzó a finales de 2021. Programa de tutoría de investigación; los académicos pasan 10-12 semanas con un investigador senior en un problema específico de alineación.

Escala (2026):
- 527+ investigadores desde su creación.
- Más de 180 artículos publicados.
- 10K más citas.
- índice h 47.
- Verano 2024: 90 académicos + 40 mentores; incorporado como 501 ((c) ((3).

Resultados de carrera: ~ 80% de los ex alumnos de pre-2025 trabajan en seguridad. 200+ en Anthropic, DeepMind, OpenAI, UK AISI, RAND, Redwood, METR, Apollo.

### Investigación de Redwood

Laboratorio de alineación aplicada. Fundado por Buck Shlegeris. Introdujo la agenda de control de IA (lección 10). Colabora con AISI del Reino Unido en casos de seguridad de control. Asesora a DeepMind y Anthropic en el diseño de evaluación.

Documentos canónicos: Greenblatt, Shlegeris et al., "AI Control" (arXiv:2312.06942, ICML 2024); Falsalización de la alineación (Greenblatt, Denison, Wright et al., arXiv:2412.14093, junto con Anthropic).

Estilo: modelos de amenazas específicos, adversarios en el peor de los casos, protocolos concretos que pueden ser probados por estrés.

### Investigación de Apolo

Evaluaciones de esquemas de preimpiego para laboratorios fronterizos. Autor de Esquemas de contexto (lección 8, arXiv:2412.04984). Socio en la colaboración de capacitación contra la esquemación de OpenAI en 2025. Produce Casos de seguridad para la esquemación de IA (2024).

Estilo: evaluaciones de configuración de agentes en las que puede surgir el engaño; descomposición de tres pilares (mal alineación, orientación hacia el objetivo, conciencia de la situación).

### METR (evaluación de modelos y investigación de amenazas)

Evaluaciones de capacidad basadas en tareas. Estudios de tiempo y horizonte de finalización de tareas autónomas. "Elementos comunes de las políticas de seguridad de la IA fronteriza" (metr.org/common-elements, 2025) compara los marcos de laboratorio.

Coautor en el esquema de seguridad de la IA con Apollo.

Estilo: evaluaciones de tareas de largo horizonte, medición empírica de la capacidad, síntesis de marcos.

### Investigación de IA de Eleos

Modelo de evaluación de bienestar previo a la implementación. Realizó la evaluación de bienestar de Claude Opus 4 documentada en la sección 5.3 de la tarjeta del sistema.

### El flujo

MATS capacita a investigadores. Los graduados van a Anthropic, DeepMind, OpenAI (equipo de seguridad de laboratorio) o a Redwood, Apollo, METR, Eleos (evaluación externa).

### ¿Por qué esta capa importa?

Las evaluaciones de un solo origen no son fiables: los laboratorios que evalúan sus propios modelos tienen un conflicto de intereses estructural. Los evaluadores externos pueden elevar y validar los modos de falla que el laboratorio pueda no informar. El documento de 2024 de los agentes durmientes (lección 7) fue Antropic + Redwood; Falsación de alineación fue Antropic + Redwood; Planificación en contexto fue Apollo; Anti-Scheming fue Apollo + OpenAI. La estructura de múltiples órganos es el control de calidad.

### Donde esto encaja en la Fase 18

Las lecciones 7-11 hacen referencia al trabajo de Redwood y Apollo; la lección 18 hace referencia a la comparación del marco de METR; la lección 19 hace referencia a Eleos. La lección 28 es el mapa organizacional explícito del ecosistema en el que se basa el resto de la fase.

```figure
sae-features
```

## Usalo

No hay código. Lea los "Elementos comunes de las políticas de seguridad de la IA fronteriza" de METR como un ejemplo de cómo la síntesis externa agrega valor al trabajo de políticas internas del laboratorio.

## Envío

Esta lección produce`outputs/skill-ecosystem-map.md`. Dado un reclamo o evaluación de alineación, se identificará la organización, el lugar de publicación y el estilo metodológico, así como las comprobaciones cruzadas con las organizaciones contrapartes conocidas.

## Los ejercicios

1. Seleccione un documento de las lecciones 7-15 e identifique las organizaciones involucradas.

2. Lea los "Elementos comunes de las políticas de seguridad de la IA fronteriza" de METR. Identifique las tres convergencias transversales de laboratorio que enfatizan y las dos divergencias más grandes.

3. Los resultados de la carrera de MATS son ~80% de seguridad.

4. Redwood y Apollo hacen el trabajo de control y planeación pero con estilos diferentes.

5. Eleos AI es la única organización de bienestar modelo pura. Diseñar una segunda organización hipotética enfocada en una cuestión de bienestar adyacente diferente (libertad cognitiva, realización robótica, etc.) y articular su metodología.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| MATS | "the mentorship program" | ML Alignment & Theory Scholars; 527+ researchers since 2021 |
| Redwood Research | "the control lab" | Applied alignment; AI Control authors; UK AISI partner |
| Apollo Research | "the scheming evals" | Pre-deployment scheming evaluations for frontier labs |
| METR | "the task-horizon evals" | Task-based capability evaluations; framework synthesis |
| Eleos AI | "the welfare lab" | Model-welfare pre-deployment evaluations |
| Talent pipeline | "MATS -> labs" | MATS graduates flow to Anthropic, DM, OpenAI, Redwood, Apollo, METR |
| External evaluation | "non-lab check" | Evaluation not done by the model's producer; adds credibility |

## Leer más

- [MATS (ML Alignment & Theory Scholars)](https://www.matsprogram.org/) el programa de tutoría
- [Redwood Research](https://www.redwoodresearch.org/) Documentación de control de IA
- [Apollo Research](https://www.apolloresearch.ai/) evaluaciones de planes
- [METR — Common Elements of Frontier AI Safety Policies](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) Comparación del marco
- [Eleos AI Research](https://www.eleosai.org/research) modelo de metodología de bienestar
