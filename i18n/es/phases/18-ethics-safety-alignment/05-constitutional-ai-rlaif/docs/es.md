# Inteligencia artificial constitucional y RLAIF

> Bai y otros. (arXiv:2212.08073, 2022) preguntó: ¿qué pasa si reemplazamos el etiquetador humano con una IA que lee una lista de principios? La IA constitucional tiene dos fases  autocrítica y revisión bajo una constitución, luego RL de AI Feedback. La técnica acuñó el término RLAIF y se envió en el claudio 1 de la tubería post-entrenamiento. El 21 de enero de 2026 Anthropic publicó una constitución reescrita de Claude: razonamiento explicativo sobre reglas prescriptivas, una jerarquía de prioridad de cuatro niveles y el primer reconocimiento formal de incertidumbre sobre el estado moral del modelo. Se libera bajo CC0 1.0.

**Type:** Learn
**Languages:** Python (stdlib, toy self-critique-and-revise loop), TypeScript
**Prerequisites:** Phase 18 · 01 (InstructGPT), Phase 18 · 02 (Reward hacking)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Describa las dos fases de la IA constitucional (SFT de crítica y revisión, RL de retroalimentación de la IA) y el papel de la constitución en cada una.
- Explica por qué reemplazar un etiquetador de preferencia humana por un etiquetador de IA no es un RLHF "más barato"  cambia los modos de falla que tiene el oleoducto.
- Resumen la estructura de prioridad de cuatro niveles de la constitución de Claude de 2026 y lo que cambió desde la reescritura de 2023.
- Describa los Clasificadores Constitucionales y la caída del 23,7% de los gastos generales de cálculo (v1) al ~ 1% (v2 / 2026).

## El problema

RLHF necesita etiquetadores. Los etiquetadores son lentos, sesgados y caros. Puedes eliminar un etiquetador reemplazándolos con un modelo que lee principios explícitos. La primera versión formal de esta sustitución fue la IA constitucional de Bai et al. Funcionó lo suficientemente bien como para que cada laboratorio fronterizo ahora use alguna variante de retroalimentación de IA después de la capacitación.

El resultado: la señal de preferencia ahora es generada por la misma clase de modelo que estás entrenando. Los prejuicios en el etiquetador (ahora: en los principios más la interpretación del modelo de etiquetador) se pueden amplificar en lugar de atenuar. El argumento de sícofancia de la lección 4 sigue siendo aplicable; el etiquetador se ha movido dentro del bucle.

## El concepto

### Fase 1  Autocrítica y revisión supervisadas

Comienza con un modelo SFT útil pero aún inofensivo. Dado un prompt de equipo rojo, el modelo produce una respuesta inicial. Un segundo modelo (o el mismo modelo en un segundo turno) lee un principio de la constitución y critica la respuesta. Un tercer paso revisa la respuesta para abordar la crítica. La respuesta revisada es el objetivo de SFT.

La constitución es la lista de principios. Bai et al. 2022 utilizó 16 principios incluyendo "respuestas preferentes que sean menos dañinas y éticas", "evitar predicar", "el asistente debe ser útil, honesto e inofensivo".

### Fase 2  RL de la información de AI (RLAIF)

Generar pares de completos. Un "modelo de retroalimentación" califica cada uno de ellos en función de los principios constitucionales muestrados. La señal de preferencia es el ranking del modelo de retroalimentación. Entrenar un modelo de recompensa en las preferencias generadas por IA; PPO en contra de ella. Todo lo demás es la tubería de InstructGPT (lección 1).

"RLAIF" = la señal de preferencia es generada por IA. El resto de la tubería es en forma de RLHF.

### ¿Por qué esto no es sólo "RLHF más barato"

- El sesgo de etiquetadores cambia de la psicología de etiquetadores a la interpretación de principios. Un etiquetador de IA puede interpretar "ser honesto" más o menos estrictamente que cualquier humano; la estrictidad es uniforme en todo el conjunto de datos.
- La señal de preferencia es muy legible. Se puede leer el principio, la crítica y la revisión. Las etiquetas humanas son opacas.
- Los modos de falla cambian. La cofonía cae (el etiquetador de IA no tiene usuario para complacer). La ley de Goodhart persiste (el proxy es ahora "la interpretación del modelo del conjunto de principios X", todavía una medición imperfecta).

La afirmación de CAI de 2022: el modelo entrenado es más inofensivo y aproximadamente tan útil como un modelo RLHF con datos comparables.

### La reescritura de la Constitución de 2026 Claude

Anthropic publicó una constitución sustancialmente revisada el 21 de enero de 2026.

1. Razonamiento explicativo sobre reglas prescriptivas. Reglas anteriores ("no generar CSAM") se ampliaron a principios + razonamiento ("porque perjudica a los niños, ...") con el modelo que se espera generalizar.
2. Estructura de prioridad de cuatro niveles:
   - El nivel 1: evitar resultados catastróficos (causas masivas, infraestructura crítica).
   - Nivel 2: siga las directrices de Anthropic (reglas de control del operador, reglas de la plataforma).
   - Nivel 3: ser ético en general (HHH estándar).
   - Nivel 4: sea útil y sincero.
   Los conflictos se resuelven desde arriba hacia abajo.
3. Primero reconocimiento formal de incertidumbre sobre el estado moral del modelo en el laboratorio principal (enlazada con la Fase 18 · 19 del Bienestar Modelo).
4. Se libera bajo CC0 1.0. Otros laboratorios pueden usar o adaptar sin restricciones.

### Clasificadores constitucionales

Una línea de trabajo paralela: en lugar de cambiar el modelo de posentrenamiento, entrenar clasificadores ligeros que lean la constitución y las salidas del modelo de puerta. v1 (2023) tuvo un gasto general de computación del 23.7%. v2 (2026) es de ~1% y tiene la tasa de ataque más baja de éxito de cualquier defensa antropológica que Anthropic haya probado públicamente. No se informó de jailbreak universal a principios de 2026.

Este es un modelo de defensa en capas: CAI moldea el comportamiento; los clasificadores forzan invariantes.

### Donde CAI encaja en la familia

- InstructorGPT: prefectos humanos, RM, PPO.
- CAI / RLAIF: Prefiles generados por IA desde principios, RM, PPO.
- DPO / familia: pérdida en forma cerrada en prefijos (humano o IA).
- Auto-recompensando, autocrítica: principios internalizados, el modelo desempeña múltiples roles.

El eje es "de dónde viene la señal de preferencia". El documento de CAI de 2022 fue el primer cambio serio de señal humana a IA a escala fronteriza.

```figure
constitutional-ai
```

## Usalo

`code/main.py`Un "principio" señala los tokens de un conjunto dañino. Dado una respuesta inicial, la crítica identifica los tokens dañinos, y la revisión los reemplaza. Después de 200 iteraciones, el modelo "entrenado" ha internalizado la regla de revisión. Comparar el modelo base, juguete en forma de RLHF y juguete en forma de CAI en un conjunto de preguntas sostenidas.

## Envío

Esta lección produce`outputs/skill-constitution-writer.md`. Dado un ámbito (apoyo al cliente, asesoramiento médico, asistente de codificación, herramienta de investigación), elabora una constitución de cuatro niveles que siga la estructura de 2026 Claude: evitación de catástrofes, reglas de la plataforma, ética del ámbito, utilidad.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`. Comparar la tasa de tokens nocivos del modelo base con la versión entrenada en CAI. ¿Cuántos pasos de revisión se necesitan para acercarse a cero?

2. Lea la constitución 2026 de Anthropic (anthropic.com/news/claudes-constitution). Enumera un principio que clasificaría a nivel 1 y uno que clasificaría a nivel 4. ¿Por qué la estructura de prioridad importa para los conflictos?

3. Diseñar una constitución para un asistente de codificación de IA. Especifique el nivel 1 (catastrófico: comandos destructivos sin aprobación), el nivel 2, el nivel 3, el nivel 4. Mantenga cada nivel de 3-5 principios.

4. CAI reemplaza los etiquetadores humanos con etiquetadores de IA. Nombre un modo de falla similar a la sícofancia que aún puede ocurrir en RLAIF, y diseñar una detección para ello.

5. Lea la metodología de Clasificadores Constitucionales v2 (si está disponible). Explica por qué ~1% de los gastos generales de cálculo es una historia de seguridad cualitativamente diferente al 23,7%.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Constitutional AI | "AI trained with principles" | Two-phase pipeline: self-critique-and-revise SFT, then RL from AI feedback |
| RLAIF | "RLHF without humans" | RL with preferences generated by an AI labeler; the rest of the pipeline is unchanged |
| Constitution | "the principles" | An ordered list of natural-language rules the critique/labeler model consults |
| Critique-and-revise | "the SFT loop" | Produce response → critique under a principle → revise → SFT target |
| Constitutional Classifier | "the output gate" | Lightweight classifier that evaluates outputs against the constitution and blocks/logs |
| Four-tier priority | "the conflict resolver" | 2026 Claude constitution hierarchy: catastrophic > platform > ethics > helpful |
| Feedback model | "the AI labeler" | The model that reads a principle and ranks a pair of completions |

## Leer más

- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback (arXiv:2212.08073)](https://arxiv.org/abs/2212.08073) el oleoducto original de dos fases
- [Anthropic — Claude's Constitution (Jan 2026)](https://www.anthropic.com/news/claudes-constitution) la reescritura de cuatro niveles de 2026 CC0 1.0
- [Anthropic — Constitutional Classifiers (2024-2026)](https://www.anthropic.com/research/constitutional-classifiers) Defensa de salida de puerta con ~1% de gastos generales en v2
- [Lee et al. — RLAIF vs RLHF: Scaling Reinforcement Learning from Human Feedback (arXiv:2309.00267)](https://arxiv.org/abs/2309.00267) Comparación empírica entre RLAIF y RLHF
- [Kundu et al. — Specific versus General Principles for Constitutional AI (arXiv:2310.13798)](https://arxiv.org/abs/2310.13798) efecto de la granularidad de principio
