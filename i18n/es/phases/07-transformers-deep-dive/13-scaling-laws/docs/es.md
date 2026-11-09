# Las leyes de escala

> El artículo de Kaplan de 2020 dijo: modelo más grande, pérdida menor. El artículo de Hoffmann de 2022 dijo: estabas bajo entrenamiento. La computación se divide en dos cubos  parámetros y tokens  y la división no es obvia.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## El problema

Cuando tienes C FLOPs de formación en computación y quieres el mejor modelo, te enfrentas a dos botones:

1. **How many parameters (N)?**Un modelo más grande, mayor capacidad.
2. **How many training tokens (D)?**Más datos, mejor uso de la capacidad.

Las PLOP se extienden aproximadamente en la misma escala que `6 × N × D`Puedes empujar N hacia arriba y D hacia abajo, o D hacia arriba y N hacia abajo. ¿Cuál es mejor?

Antes de 2022, la respuesta era "push N hard". GPT-3 (2020) era 175B parámetros entrenados en tokens ~300B. Una proporción de aproximadamente 1,7 tokens por parámetro.

Hoffmann et al. (2022), que formaba una pequeña familia de modelos llamada Chinchilla, encontró algo diferente: la relación óptima está más cerca de **20 tokens per parameter**Sin embargo, el equipo de GPT-3 fue 10 veces menos capacitado. Chinchilla (70B parámetros, 1.4T tokens) superó a GPT-3 (175B, 300B tokens) en cada punto de referencia a un costo de inferencia 2,5 veces menor.

2026 es el mundo de Chinchilla  con un giro importante. Llama 3 8B fue entrenado en 15 billones de tokens, una proporción de 1.875 tokens por parámetro. Noventa y cuatro veces más allá de Chinchilla-óptimo. El costo de inferencia importa más que el costo de entrenamiento para modelos que se utilizarán a escala, por lo que el sobreentrenamiento (pasado de Chinchilla) para una huella desplegable más pequeña es el estándar de 2026.

## El concepto

![Chinchilla curves: loss vs compute at various N/D ratios](../assets/scaling-laws.svg)

### La ley Hoffmann

De la publicación de Chinchilla, la pérdida es la siguiente:

```math
L(N, D) = \frac{A}{N^\alpha} + \frac{B}{D^\beta} + E
```

- $N$= parámetros (no incorporados).
- $D$= tokens de entrenamiento.
- $\alpha \approx 0.34$¿ Qué ?$\beta \approx 0.28$(aproximadamente simétrica).
- $E \approx 1.69$, el techo de pérdida irreductible.
- $A \approx 406$¿ Qué ?$B \approx 411$¿ Qué ?

Dos términos se intercambian entre sí a medida que escalas.$N$en cálculo fijo ($C = 6ND$¿Qué es lo que se puede hacer?$\alpha$y $\beta$arriba, los exponentes salen en aproximadamente 0.45 para $N$y 0,55 para $D$, por lo que la relación óptima exacta se deriva lentamente con el presupuesto; `code/main.py`Los dos primeros enfoques de ajuste del papel, que miden el óptimo directamente, ponen ambos exponentes en aproximadamente 0.5.$D = 20N$En el$C = 6ND$y la regla general dice:

```math
\begin{aligned}
N_{\text{opt}} &\approx 0.22 \times (C/6)^{0.5} \\
D_{\text{opt}} &\approx 4.5 \times (C/6)^{0.5} \\
D_{\text{opt}} / N_{\text{opt}} &\approx 20
\end{aligned}
```

Optimo para el cálculo: 20 tokens por parámetro.

### ¿Por qué sobreentrenar de todos modos?

Chinchilla-optimal minimiza la pérdida de entrenamiento por entrenamiento FLOP. Pero usted paga el costo de entrenamiento una vez; la inferencia costo para siempre.

Para un chatbot que sirve un billón de tokens por mes, la inferencia domina el costo total. El enfoque de Llama: tren más pequeño, más largo.

- Se ajusta a las GPU de consumo.
- La latencia es una fracción de 70B Chinchilla-óptima.
- La calidad es lo suficientemente cercana para la mayoría de las tareas.

El artículo de DeepMind de 2024 ("Over-training es el nuevo óptimo") formalizó esto. Para las cargas de trabajo dominadas por inferencias, la proporción correcta está más cerca de 100500 tokens por parámetro dependiendo del volumen de servicio.

### Emergencia vs suavidad

Afirmación: ciertas habilidades (arítmética, razonamiento en varios pasos, seguimiento de la cadena de pensamiento) "emergen" repentinamente en alguna escala.

Schaeffer et al. (2023) argumentó que este es un artefacto de medición: las métricas emergentes utilizan puntuaciones discontinuas (combinación exacta, precisión en el umbral) que ocultan una mejora suave en las logitas subyacentes.

En 2026 el consenso es: las predicciones a través de pérdidas continuas son confiables. Los saltos de referencia son a menudo artefactos de puntaje.

### La imagen de 2026

Las leyes de escalación todavía funcionan, pero:

| Factor | Changed how |
|--------|-------------|
| Data quality | Curating "good" tokens (Phi-style) shifts curves by >2× effective compute |
| MoE | Total params decouple from active FLOPs; scaling laws per-active-FLOP |
| Post-training | Some capabilities (instruction following, code) shift with SFT+RLHF more than pretraining |
| Multimodality | Image + text tokens scale together; separate curves per modality |
| Synthetic data | Models generate training data; effective compute can compound |

El optimizador de Muon (Kimi Moonlight, 2024) mostró una ganancia de cálculo efectiva de ~2x sobre AdamW en datos coincidentes. Algunas carreras de entrenamiento de 2026 usan Muon por defecto. Cambia la constante absoluta en la ley de escala, no su forma.

```figure
scaling-laws
```

## Construye el mismo

¿ Qué ?`code/main.py`Implementamos la ecuación de pérdidas de Chinchilla y resolvemos para el óptimo de cálculo .$(N, D)$en cada uno de los presupuestos informáticos.

### Paso 1: pérdida de chinchilla

```python
def chinchilla_loss(N, D, A=406.4, B=410.7, alpha=0.34, beta=0.28, E=1.69):
    return A / N ** alpha + B / D ** beta + E
```

El argumento$L$como un contorno sobre $(N, D)$en fijo $C = 6ND$- Encuentra el mínimo.

### Paso 2: Frontera óptima de cálculo

Para los presupuestos de computación de `1e17`¿ Qué ?`1e25`FLOPs, encontrar $(N, D)$que minimizen las pérdidas sujetas a $6ND = C$Verifique la relación $D/N \approx 20$¿ Qué ?

### Paso 3: Costo de formación excesiva

Calcule la pérdida adicional que paga para entrenar un modelo 10x más pequeño (1/10 de N óptimo, 10x el D óptimo).

### Paso 4: comparación con modelos reales

Entra en conocido`(N, D)`parejas para GPT-3, Chinchilla, Llama 3 8B, DeepSeek-V3 (parámetros activos), y comparar pérdida prevista con la reportada.

## Usalo

Es poco probable que entrenes a un modelo de frontera, pero las leyes de escalate te dicen:

1. **Whether your fine-tune has enough data.**Si sus datos específicos de tareas están por debajo de 20 tokens por parámetro del modelo base, esperen saturación en algún nivel de pérdida.
2. **Whether to pick a bigger base model.**Si gastas todo tu presupuesto en inferencias, prefieres un modelo más pequeño y más entrenado.
3. **Where the returns diminish.**Más allá de 1000x Chinchilla-óptima, los cambios de pérdida de registro se convierten en ruido.

**The research trajectory in 2026:**

- **Data-constrained regime.**La web tiene un número finito de tokens de alta calidad (~510 billones de inglés después de filtrar). El preentrenamiento fronterizo se acerca a este techo.
- **Compute-multiplier tricks.**Optimizador de muones, MoE, mejor curado de datos  cada uno cambia las constantes absolutas, no el asintoto.
- **Scaling laws for RL.**Las primeras pruebas sugieren la ley de poder en muestras de RL pero con exponentes muy diferentes que el preentrenamiento.

## Envío

¿ Qué ?`outputs/skill-training-budget-estimator.md`La habilidad escoge .`(N, D, hours, GPU)`para una nueva carrera de formación, dado el presupuesto de cálculo, las limitaciones de implementación y la pérdida de objetivos.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`Imprimir Chinchilla óptimo$(N, D)$para los presupuestos de computación `1e20`¿ Qué ?`1e22`¿ Qué ?`1e24`Comparar con la mesa de modelos reales.
2. **Medium.**Implemente la curva de pérdida de la función de la computación Hoffmann.`log10(C)`Identificar cuándo la ley predice que necesitaríamos$>10^{28}$FLOPs para la próxima reducción de 0,1 en entropía cruzada.
3. **Hard.**Aplica su propia ley de escala en 5 modelos pequeños (100K a 10M parámetros) entrenados en el mismo conjunto de datos.$\alpha$y $E$¿Qué tan bien coinciden tus exponentes con los publicados?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Parameters (N) | "Model size" | Non-embedding weight count; determines capacity. |
| Tokens (D) | "Training data" | Number of training tokens seen; determines how well the parameters get used. |
| Compute (C) | "FLOPs spent" | Approximately `6 × N × D` for a standard transformer. |
| Chinchilla-optimal | "D/N ≈ 20" | Ratio that minimizes loss per FLOP of pretraining. |
| Over-training | "Past Chinchilla" | Spend extra training FLOPs to save inference FLOPs; D/N >> 20. |
| Irreducible loss | "The floor" | The $E$ term in the scaling law; the entropy of the data itself. |
| Emergent capability | "Sudden jumps at scale" | Often a scorer artifact; continuous loss is smooth. |
| Effective compute | "Training-efficiency multiplier" | Better data / optimizer / architecture multiplies how far a FLOP goes. |

## Leer más

- [Kaplan et al. (2020). Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361) el primer documento de derecho de escala; poco capacitado.
- [Hoffmann et al. (2022). Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556)- Chinchilla.
- [Schaeffer et al. (2023). Are Emergent Abilities of Large Language Models a Mirage?](https://arxiv.org/abs/2304.15004) la aparición como artefacto de medición.
- [Sardana, Frankle (2024). Beyond Chinchilla-Optimal: Accounting for Inference in Language Model Scaling Laws](https://arxiv.org/abs/2401.00448)¿Por qué la sobreentrenamiento de Llama es adecuado para su carga de trabajo?
- [Jordan et al. (2024). Muon: An optimizer for hidden layers in neural networks](https://kellerjordan.github.io/posts/muon/) 2x multiplicador de cálculo.
