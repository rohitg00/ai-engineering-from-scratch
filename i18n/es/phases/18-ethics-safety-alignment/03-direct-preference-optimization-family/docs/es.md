# La familia de optimización de preferencias directas

> Rafaelov y otros. (2023) mostró que el óptimo de RLHF tiene una forma cerrada en términos de datos de preferencias, por lo que puede saltarse el modelo de recompensa explícito y optimizar la política directamente. Esa visión dio lugar a una familia  IPO, KTO, SimPO, ORPO, BPO  cada uno fijando un modo de falla de DPO. En 2026, los algoritmos de alineación directa envían más carreras fronterizas después del entrenamiento que PPO. Pero la curva de optimización excesiva de la Lección 2 sigue siendo aplicable: los DAA no escapan de Goodhart, simplemente se mueven donde muerde.

**Type:** Learn
**Languages:** Python (stdlib, six-variant preference-loss comparator), TypeScript
**Prerequisites:** Phase 18 · 01 (InstructGPT), Phase 18 · 02 (Reward hacking), Phase 10 · 08 (DPO basics)
**Time:** ~75 minutes

## Objetivos de aprendizaje

- Derivar el formulario cerrado de DPO del RLHF-with-KL óptimo.
- Indique el modo de falla de cada una de las correcciones de IPO, KTO, SimPO, ORPO y BPO en DPO.
- Distinguir entre "la brecha implícita de recompensa" y "la fuerza de preferencia" y explicar por qué importa el mapeo de identidad de la OPI.
- Explica por qué Rafailov et al. (NeurIPS 2024) demuestra que los DAA se optimizan demasiado a pesar de no tener RM explícita.

## El problema

El objetivo del RLHF (lección 1):

```math
\max_{\pi} \; \mathbb{E}_{x, y \sim \pi} \big[ r(x, y) \big] - \beta \, \mathrm{KL}(\pi \,\|\, \pi_{\text{ref}})
```

tiene un óptimo conocido:

```math
\pi^*(y \mid x) = \frac{1}{Z(x)} \, \pi_{\text{ref}}(y \mid x) \exp\!\left(\frac{r(x, y)}{\beta}\right)
```

Así que la recompensa se define implícitamente por la relación entre la política óptima y la referencia:

```math
r(x, y) = \beta \log \frac{\pi^*(y \mid x)}{\pi_{\text{ref}}(y \mid x)} + \beta \log Z(x)
```

Substituir esto en la probabilidad de preferencia Bradley-Terry y la función de partición `Z(x)`cancela porque depende sólo de`x`. Lo que queda es una pérdida en los parámetros de la política solamente  no se necesita un modelo de recompensa.

La arrugas: la derivación asume que el óptimo es alcanzable, los datos de preferencias son en distribución y la política de referencia es el anclaje de modo verdadero. Ninguno de estos se mantiene exactamente.

## El concepto

### DPO (Rafailov y otros, 2023)

```math
L_{\text{DPO}} = -\log \sigma\!\left(
  \beta \log \frac{\pi(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)}
  - \beta \log \frac{\pi(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)}
\right)
```

¿Qué puede salir mal?

- La brecha implícita de recompensas `beta * (log(pi/pi_ref)_w - log(pi/pi_ref)_l)`Una pequeña preferencia puede producir una brecha arbitrariamente grande.
- El disco de pérdida selecciona y rechaza las pruebas de registro en direcciones opuestas. Puede empujar la prueba de registro absoluta elegida hacia abajo siempre que la rechazada caiga más rápido. Este es el fenómeno de la respuesta elegida degradada.
- Las preferencias fuera de distribución (parejas en las que ambas respuestas son raras en el marco de la política de referencia) producen recompensas implícitas arbitrarias.

### El mercado de la inversión se ha convertido en un mercado de inversión.

La optimización de preferencias de identidad reemplaza el log-sigmoid con un mapeo de identidad en la probabilidad de preferencias. La pérdida se convierte en un error cuadrado en un objetivo limitado:

```math
L_{\text{IPO}} = \left( \log \frac{\pi(y_w \mid x)}{\pi_{\text{ref}}(y_w \mid x)} - \log \frac{\pi(y_l \mid x)}{\pi_{\text{ref}}(y_l \mid x)} - \frac{1}{2\beta} \right)^2
```

El margen está limitado por `1/(2 beta)`La fuerza de preferencia y la brecha implícita de recompensa son proporcionales.

### KTO (Ethayarajh et al., 2024)

La optimización Kahneman-Tversky elimina completamente la estructura pareja. Dado una salida única etiquetada y una señal binaria "deseable" o "indeseable", se asigna a una utilidad de teoría de prospectos:

```math
v(x, y) = \sigma\!\left(\beta \log \frac{\pi(y \mid x)}{\pi_{\text{ref}}(y \mid x)} - z_{\text{ref}}\right)
```

El beneficio: puede utilizar datos sin pareja, que es mucho más abundante.

### SimPO (Meng et al., 2024)

Optimización de preferencias sencillas alinea la señal de entrenamiento con la generación. Eliminar la política de referencia por completo y normalizar la probabilidad de registro por longitud:

```math
L_{\text{SimPO}} = -\log \sigma\!\left(
  \frac{\beta}{|y_w|} \log \pi(y_w \mid x)
  - \frac{\beta}{|y_l|} \log \pi(y_l \mid x)
  - \gamma
\right)
```

con un margen `gamma`La normalización de longitud elimina el incentivo para explotar el modo de falla de la longitud-bias del DPO (más largo `y_w`da una brecha mayor de registro-prob por construcción).

### ORPO (Hong et al., 2024)

Optimización de preferencias de probabilidades-ratio añade un término de preferencia a la probabilidad de registro negativo de SFT estándar:

```math
\begin{aligned}
L_{\text{ORPO}} &= L_{\text{NLL}}(y_w) + \lambda L_{\text{OR}} \\
L_{\text{OR}} &= -\log \sigma\!\left(\log \frac{\text{odds}(y_w)}{\text{odds}(y_l)}\right)
\end{aligned}
```

No hay política de referencia  el término SFT es el regulador. Entrenamiento en una sola etapa desde el modelo base al modelo alineado. No hay punto de control separado SFT.

### BPO (envía ICLR 2026 OpenReview id=b97EwMUWu7)

Identifica el problema de respuestas elegidas degradadas: DPO conserva el ranking `y_w > y_l`Pero el log-prob absoluto de `y_w`BPO añade una corrección de línea única que penaliza los movimientos hacia abajo en la respuesta elegida.

### El resultado universal: los DAA siguen optimizando demasiado

Rafailov et al. "Leyes de escala para la sobreoptimización de modelos de recompensas en algoritmos de alineación directa" (NeurIPS 2024) entrenó políticas con DPO, IPO, SLiC en múltiples conjuntos de datos en los presupuestos de KL. Las curvas oro-recompensa-vs.KL tienen la misma forma Gao et al. Pico y colapso.

Los DAA no escapan a Goodhart. Cambian la superficie donde se muerde de "modelo de recompensa sobre-optimizado" a "ratio de política de referencia sobre-optimizado".

### Elegir entre ellos (2026)

- Si tiene datos de preferencias en parejas grandes: DPO con beta conservadora, SimPO si es evidente el sesgo de longitud.
- Si tiene comentarios binarios sin pareja: KTO.
- Si quieres un oleoducto de una sola etapa de un modelo base: ORPO.
- Si ves registros degradados de registro elegidos en registros de DPO: BPO.
- Si las preferencias varían mucho y el DPO es saturante: IPO.

Cada laboratorio ejecuta los cinco en una batería y elige el ganador por tarea. No hay razón para que el óptimo sea el mismo para el razonamiento matemático y la seguridad.

```figure
dpo-margin
```

## Usalo

`code/main.py`comparar seis pérdidas (DPO, IPO, KTO, SimPO, ORPO, BPO) en un conjunto de datos de preferencias de juguete donde la fuerza de preferencia real varía por pareja. Cada pérdida se optimiza contra la misma muestra de 500 parejas con una pequeña política de softmax.

## Envío

Esta lección produce`outputs/skill-preference-loss-selector.md`. Dadas las estadísticas de los conjuntos de datos (parados vs. sin par, variables vs. preferencias uniformes, distribución de longitud) y un objetivo (estadios individuales o FFT-then-preferencia), recomendamos una pérdida de preferencias e informamos del modo de falla contra el cual protege.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`. Informar la caída final de registro de prueba elegida para DPO y BPO. BPO debe mantener una probabilidad absoluta elegida más alta  verificar esto.

2. Modificar los datos de preferencias para que todos los pares tengan la misma fuerza. ¿Cuál de los seis métodos es más robusto? ¿Cuál degrada? Explique la ventaja de la OPI aquí.

3. Haga que las respuestas rechazadas sean en promedio 2 veces más largas que las elegidas. Sin cambiar nada más, muestre la explotación de longitud del DPO numéricamente y la corrección del SimPO.

4. Rafailov et al. (NeurIPS 2024) afirman que los DAA se optimizan demasiado. Reproduce una versión de un solo punto: la divergencia KL de gráfico elegida-menos-rechazada y observa la sobre-optimización en DPO en beta grande.

5. Lea el resumen del documento de BPO (OpenReview b97EwMUWu7).`code/main.py`¿ Qué ?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| DPO | "RLHF without a reward model" | Loss derived from the closed-form RLHF optimum; policy parameters only |
| Implicit reward | "the log-ratio" | `beta * log(pi(y\|x) / pi_ref(y\|x))` — the DPO-implied reward |
| IPO | "bounded DPO" | Replaces log-sigmoid with identity; implicit reward gap capped by `1/(2 beta)` |
| KTO | "unpaired DPO" | Prospect-theory utility over single labels with loss aversion |
| SimPO | "reference-free DPO" | Length-normalized log-likelihood + margin; no reference policy |
| ORPO | "one-stage DPO" | NLL + odds-ratio preference term; trains from base model in one pass |
| BPO | "chosen-preserving DPO" | DPO plus a penalty for decreasing the chosen response's absolute log-prob |
| Degraded Chosen | "chosen goes down" | DPO decreases chosen log-prob so long as rejected falls faster |
| DAA | "direct alignment algorithm" | Any preference-loss method that skips an explicit RM |

## Leer más

- [Rafailov et al. — Direct Preference Optimization (NeurIPS 2023, arXiv:2305.18290)](https://arxiv.org/abs/2305.18290)
- [Azar et al. — A General Theoretical Paradigm to Understand Learning from Human Preferences (AISTATS 2024, arXiv:2310.12036)](https://arxiv.org/abs/2310.12036) OPI
- [Ethayarajh et al. — KTO: Model Alignment as Prospect Theoretic Optimization (arXiv:2402.01306)](https://arxiv.org/abs/2402.01306)
- [Meng, Xia, Chen — SimPO (NeurIPS 2024, arXiv:2405.14734)](https://arxiv.org/abs/2405.14734)
- [Hong, Lee, Thorne — ORPO (EMNLP 2024, arXiv:2403.07691)](https://arxiv.org/abs/2403.07691)
- [BPO — Behavior Preservation Optimization (ICLR 2026 OpenReview b97EwMUWu7)](https://openreview.net/forum?id=b97EwMUWu7)
- [Rafailov et al. — Scaling Laws for RM Overoptimization in DAAs (NeurIPS 2024, arXiv:2406.02900)](https://arxiv.org/abs/2406.02900)
