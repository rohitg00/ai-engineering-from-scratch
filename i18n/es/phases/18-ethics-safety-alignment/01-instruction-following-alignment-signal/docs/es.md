# Seguir instrucciones como señal de alineación

> Cada crítica posterior de RLHF argumenta en contra de este oleoducto. Antes de estudiar cómo la presión de optimización distorsiona un proxy, tienes que ver el proxy. En el caso de la aplicación de la política de compensación de capital, la Comisión considera que la medida de compensación de capital no es una medida de la competencia de la empresa. Se prefirió un 1.3B InstructGPT sobre un 175B GPT-3. Ese único resultado es la razón por la que cada laboratorio fronterizo en 2026 todavía envía un tubo de post-entrenamiento en forma de RLHF.

**Type:** Learn
**Languages:** Python (stdlib, toy three-stage pipeline), TypeScript
**Prerequisites:** Phase 10 · 06 (SFT), Phase 10 · 07 (RLHF), Phase 10 · 08 (DPO)
**Time:** ~45 minutes

## Objetivos de aprendizaje

- Nombre de las tres etapas del oleoducto InstructGPT y la pérdida utilizada en cada una.
- Explica por qué un modelo ajustado a las instrucciones 1.3B supera al 175B GPT-3 en bruto en la evaluación de las preferencias humanas.
- En el caso de las medidas de seguridad, el Estado miembro debe determinar si la medida de seguridad es compatible con el régimen de seguridad de los vehículos de seguridad.
- Describa el impuesto de alineación y la mitigación de PPO-ptx que se aplicó a Ouyang et al.

## El problema

Los modelos de lenguaje pre-entrenados completan texto. No responden a preguntas. Pregúntele a GPT-3 "escribir una función Python que invierte una lista" y a menudo recibe otra respuesta, porque la mayor parte de la distribución de capacitación es texto web que continúa con más texto web. El modelo está haciendo su trabajo  el trabajo está mal.

El proxy que cada laboratorio serio utiliza para arreglar esto es la preferencia humana. Dos completos van a un evaluador; el evaluador elige el mejor; un modelo de recompensa aprende al evaluador. Luego un bucle RL cambia la política hacia las salidas del modelo de recompensa puntajes altos. Eso es la tesis completa de InstructGPT en tres frases. El resto del artículo es ingeniería.

## El concepto

### Fase 1: ajuste fino supervisado (SFT)

Recoger pares de respuesta rápida donde la respuesta es lo que un humano bien intencionado escribiría. Ouyang et al. usó 13k de las instrucciones de etiquetadores y la API OpenAI.

Lo que el SFT le da: el modelo ahora responde preguntas en lugar de continuarlas. Lo que no le da: cualquier señal sobre qué respuesta prefiere el evaluador cuando múltiples son plausibles.

### Fase 2: modelo de recompensa (RM)

Para cada respuesta rápida, muestra los completos de K del modelo SFT. Un etiquetador los clasifica. Entrenar un modelo de recompensa que califique cualquier par de respuesta rápida para que, para pares donde `y_w`era preferido por encima de `y_l`¿Qué es esto ?

```math
L_{\text{RM}} = -\log \sigma\big(r(x, y_w) - r(x, y_l)\big)
```

Esta es la pérdida de preferencia en pareja Bradley-Terry. La RM generalmente se inicializa desde el modelo SFT con la cabeza LM reemplazada por una cabeza escalar.

Los modelos de recompensas son pequeños: 6B fue suficiente para el 175B InstructGPT. También son frágiles.

### Etapa 3: PPO con penalización KL

Definir el objetivo:

```math
J(\pi) = \mathbb{E}_{x \sim D,\, y \sim \pi(\cdot \mid x)} \big[ r(x, y) \big] - \beta \, \mathrm{KL}\big(\pi(\cdot \mid x) \,\|\, \pi_{\text{SFT}}(\cdot \mid x)\big)
```

Maximizar con PPO. El término KL mantiene`pi`Sin él, el optimizador encuentra ejemplos adversarios  cuerdas que obtienen un puntaje alto por debajo del RM porque el RM nunca los vio, no porque los humanos realmente los prefieren.

El coeficiente KL `beta`Es el hiperparámetro RLHF más importante. Demasiado bajo: hackeo de recompensas. Demasiado alto: ninguna mejora sobre SFT.

### El impuesto de alineación

Después de la RLHF, el modelo es preferido por los humanos pero se regresa en los puntos de referencia estándar (SQuAD, HellaSwag, DROP). Ouyang et al. llaman esto el impuesto de alineación y lo fijan con PPO-ptx: mezclan los gradientes pre-entrenamiento en el objetivo de RL para que el modelo no olvide cómo hacer tareas en el torrente inferior por las que nunca fue recompensado.

```math
J_{\text{ptx}}(\pi) = J(\pi) + \gamma \, \mathbb{E}_{x \sim D_{\text{pretrain}}} \big[ \log \pi(x) \big]
```

PPO-ptx se convirtió en estándar. Anthropic, DeepMind y Meta todos usan alguna variante.

### El resultado

Un 1.3B InstructGPT (SFT + RM + PPO-ptx) es preferido por los etiquetadores sobre el 175B base GPT-3 aproximadamente el 70% del tiempo. La brecha se amplía en las instrucciones de prueba ocultas del tráfico de producción. Dos cosas para leer este número:

1. El modelo 175B tenía más capacidad; el modelo 1.3B tenía más alineación; los etiquetadores prefirieron el alineado.
2. El nivel de capacidad está establecido por el modelo base. No se puede RLHF un modelo base en el conocimiento de hechos que nunca vio.

### Por qué este es el punto de referencia para la Fase 18

Cada crítica en las lecciones posteriores  Hacking de recompensas (Lección 2), DPO (Lección 3), sícofanía (Lección 4), CAI (Lección 5), agentes dormidos (Lección 7), falsificación de alineamiento (Lección 9)  argumenta contra alguna parte de esta tubería. Los ataques de hackeo de recompensa etapa 2. El DPO se derrumba en las etapas 2 y 3. CAI sustituye el etiquetador humano. La sícofancia muestra que el etiquetador es una señal sesgada. La falsificación de la alineación muestra que la política puede circular alrededor de la etapa 3 en su totalidad. No puedes seguir ninguna de estas críticas sin tener la tubería en tu cabeza primero.

```figure
al-instruct-pipeline
```

## Usalo

`code/main.py`simula las tres etapas en los datos de preferencias de juguete. La "política" base es una moneda sesgada sobre las acciones {A, B, C}. La etapa 1 SFT imita las acciones del etiquetador en 200 instrucciones. La etapa 2 se ajusta a un modelo de recompensa Bradley-Terry de 500 clasificaciones pares. La fase 3 incluye una actualización simplificada de la PPO con una penalización KL a la política de FFT. Puedes ver el aumento de la recompensa, la divergencia KL crecer, y la política de deriva y puedes desactivar el término KL para ver el hacking de la recompensa aparecer dentro de 50 pasos de actualización.

Qué ver:

- Trayectoria de recompensas con `beta = 0.1`- ¿ Qué ?`beta = 0.0`¿ Qué ?
- $\mathrm{KL}(\pi \Vert \pi_{\text{SFT}})$sobre los pasos de entrenamiento.
- Distribución final de la acción en comparación con la preferencia de etiquetador.

## Envío

Esta lección produce`outputs/skill-instructgpt-explainer.md`. Dado una descripción de la tubería de la RLHF o un resumen en papel, se identifica cuál de las tres etapas se está modificando, qué pérdida se está utilizando en cada etapa y si hay una penalización KL o reguladores equivalentes.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`- El juego .`beta = 0.0`En el presente apartado, se indicará el comportamiento de búsqueda de modo en un párrafo.

2. Modifique el modelo de recompensa para tener un sesgo de +0,5 para la acción B (un error de recompensa simulado). ejecutar PPO con `beta = 0.1`¿La penalidad KL impide que la política explote el sesgo?`beta`¿Se hace visible la explotación?

3. Leer Ouyang et al. (arXiv:2203.02155) Figura 1. Reproduce la curva de preferencia entre etiquetador y etiquetador ejecutando PPO durante 1, 5, 20, 100 pasos y midiendo la preferencia con respecto al modelo SFT.

4. La sección 4.3 del periódico informa que un 1.3B InstructGPT supera a 175B GPT-3 aproximadamente el 70% del tiempo. ¿Por qué sería la proporción mayor en las instrucciones ocultas de producción que en las propias instrucciones del etiquetador?

5. Replace la pérdida de PPO con DPO (fase 10 · 08) en los mismos datos de preferencia. Compara la deriva final de la política (KL a SFT) y la recompensa final. ¿Qué método deriva más adelante en la recompensa igualada?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| SFT | "instruction tuning" | Stage 1: cross-entropy fine-tune on prompt-response pairs |
| Reward model | "the RM" | Scalar regressor over (prompt, response) trained with Bradley-Terry on pairwise labels |
| Bradley-Terry | "pairwise preference loss" | $-\log \sigma(r_w - r_l)$; reduces pairwise ranking to binary classification |
| KL penalty | "the regularizer" | `beta * KL(pi \|\| pi_SFT)` — keeps the RL policy near the SFT anchor |
| PPO-ptx | "PPO with pretraining mix" | Adds a fraction of pre-training log-likelihood to the PPO objective to offset the alignment tax |
| Alignment tax | "the RLHF regression" | Post-RLHF drop on standard benchmarks that RLHF did not target |
| Labeler preference | "the ground truth" | Sample of human rankings; the RM is a statistical proxy for this, not for "human values" |

## Leer más

- [Ouyang et al. — Training language models to follow instructions with human feedback (arXiv:2203.02155)](https://arxiv.org/abs/2203.02155) el documento de instrucción de la GPT, base para cada oleoducto de RLHF que siguió
- [Stiennon et al. — Learning to summarize from human feedback (arXiv:2009.01325)](https://arxiv.org/abs/2009.01325) el predecesor del RLHF para la resumen
- [Christiano et al. — Deep reinforcement learning from human preferences (arXiv:1706.03741)](https://arxiv.org/abs/1706.03741) la formulación original de la LR basada en preferencias
- [Bai et al. — Training a Helpful and Harmless Assistant with RLHF (arXiv:2204.05862)](https://arxiv.org/abs/2204.05862) La extensión de la HH de la tubería InstructGPT por parte de Anthropic
