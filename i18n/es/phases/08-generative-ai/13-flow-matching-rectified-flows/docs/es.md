# Flujo de la combinación y flujos rectificados

> Los modelos de difusión toman pasos de muestreo de 20-50 porque recorren un camino curvo desde el ruido hasta los datos. La coincidencia de flujo (Lipman et al., 2023) y el flujo rectificado (Liu et al., 2022) entrenaron caminos rectos.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 06 (DDPM), Phase 1 · Calculus
**Time:** ~45 minutes

## El problema

El proceso inverso de DDPM es un paseo estocástico de 1000 pasos desde $\mathcal{N}(0, I)$El bloqueador es que el ODE que resuelve el proceso inverso es rígido; el camino es curvo.

Si pudieras entrenar el modelo de tal manera que el camino del ruido a los datos fuera una *línea recta*, un solo paso de Euler de $t=1$¿ Qué ?$t=0$La combinación de flujos construye esto directamente: definir una interpolación en línea recta desde$x_1 \sim \mathcal{N}(0, I)$¿ Qué ?$x_0 \sim \text{data}$, entrenar un campo vectorial $v_\theta(x, t)$para coincidir con su derivada del tiempo, integrar en la inferencia.

El flujo rectificado (Liu 2022) va más allá: endereza iterativamente los caminos con un procedimiento de reflujo que produce un ODE progresivamente más cercano a lineal. Después de dos iteraciones de reflujo, un muestrador de 2 pasos coincide con la calidad de DDPM de 50 pasos.

## El concepto

![Flow matching: straight-line interpolation between noise and data](../assets/flow-matching.svg)

### Flujo en línea recta

Definición:

```math
x_t = t \cdot x_1 + (1 - t) \cdot x_0, \quad t \in [0, 1]
```

donde$x_0 \sim \text{data}$y $x_1 \sim \mathcal{N}(0, I)$La derivada temporal a lo largo de esta línea recta es constante:

```math
\frac{dx_t}{dt} = x_1 - x_0
```

Define un campo vectorial neuronal $v_\theta(x_t, t)$y entrenarlo para que coincida con esta derivada:

```math
L = \mathbb{E}_{x_0, x_1, t} \left\lVert v_\theta(x_t, t) - (x_1 - x_0) \right\rVert^2
```

Esto es el**conditional flow matching**El programa de formación de la ODE no se puede deshacer nunca.$(x_0, x_1, t)$y el regreso.

### Muestreo

En la inferencia, integra el campo vectorial aprendido *retroceder* en el tiempo:

```math
x_{t-\Delta t} = x_t - \Delta t \cdot v_\theta(x_t, t)
```

Comience en$x_1 \sim \mathcal{N}(0, I)$, Euler-paso hacia abajo a $t=0$¿ Qué ?

### Flujo rectificado (Liu 2022)

El flujo en línea recta funciona pero los caminos aprendidos no son *realmente rectos*  se curvan porque muchos $x_0$Es un mapa de la misma .$x_1$. Paso de reflujo del flujo rectificado:

1. Modelo de flujo del tren $v_1$con parejas aleatorias.
2. Muestra N pares $(x_1, x_0)$por la integración $v_1$de la$x_1$hasta su aterrizaje $x_0$¿ Qué ?
3. Tren $v_2$Como los pares ahora están "parecidos con ODE", el interpolante en línea recta entre ellos es realmente más plano.
4. Repito, ¿qué quieres?

En la práctica, las iteraciones de reflow 2 te llevan a una aproximación lineal, permitiendo inferir en 2-4 pasos. SDXL-Turbo, SD3-Turbo, LCM son todos modelos destilados de flujo.

### Por qué esto ganó las imágenes en 2024

Tres razones:

1. **Simulation-free training** no se despliegan ODE durante la formación, trivial para su implementación.
2. **Better loss geometry** Los caminos rectos tienen una señal-ruido consistente, mientras que la pérdida ε-DDPM tiene una negativa SNR en los bordes del horario.
3. **Faster inference** 4-8 pasos con calidad SDXL-Turbo; 1 paso con destilación de consistencia.

## Corresponde flujo vs DDPM  la conexión exacta

El flujo que coincide con una trayectoria condicional de Gauss es la difusión *con un horario de ruido específico*.$x_t = \alpha(t) x_0 + \sigma(t) x_1$el tiempo y el flujo coinciden con la recuperación de la difusión reformulada de Stratonovich con $v = \alpha' \cdot x_0 - \sigma' \cdot x_1$Los dos son algebraicamente equivalentes para las rutas de Gaussian.

Lo que se añadió a la coincidencia de flujo: la *claridad* del objetivo (una velocidad plana), una pérdida más limpia y la licencia para experimentar con interpolantes no gaussianos.

```figure
normalizing-flow
```

## Construye el mismo

`code/main.py`Implementa la coincidencia de flujo 1D en una mezcla gaussiana de dos modos.$v_\theta(x, t)$En la inferencia, integra 1, 2, 4 y 20 pasos de Euler y compara la calidad de la muestra.

### Paso 1: pérdida de entrenamiento

```python
def train_step(x0, net, rng, lr):
    x1 = rng.gauss(0, 1)
    t = rng.random()
    x_t = t * x1 + (1 - t) * x0
    target = x1 - x0
    pred = net_forward(x_t, t)
    loss = (pred - target) ** 2
    # backprop + update
```

### Paso 2: Inferencia en múltiples etapas

```python
def sample(net, num_steps):
    x = rng.gauss(0, 1)
    for i in range(num_steps):
        t = 1.0 - i / num_steps
        dt = 1.0 / num_steps
        x -= dt * net_forward(x, t)
    return x
```

### Paso 3: compara el número de pasos

Esperar que el muestreo de 4 pasos ya coincida con la calidad de 20 pasos  un gran problema para la latencia.

## Las trampas

- **Time parameterization.**Utilizaciones de coincidencia de flujo $t \in [0, 1]$con$t=0$en los datos, $t=1$en el ruido.$t \in [0, T]$con$t=0$en los datos, $t=T$El mismo rumor, la misma dirección, en diferentes escalas.
- **Schedule choice.**La línea recta del flujo rectificado es "el" calendario de coincidencia de flujo, pero se puede utilizar el muestreo de t-normal cosino o logit (SD3 hace esto) para una mejor cobertura a escala.
- **Reflow cost.**Generar el conjunto de datos emparejado para reflujo es un paso de inferencia completo por muestra. Sólo recaiga cuando realmente necesita inferencia de 1-2 pasos.
- **Classifier-free guidance still applies.**Sólo cambié .$\epsilon$por$v$en la combinación lineal: $v_{\text{cfg}} = (1+w) v_{\text{cond}} - w v_{\text{uncond}}$¿ Qué ?

## Usalo

| Use case | 2026 stack |
|----------|-----------|
| Text-to-image, best quality | Flow matching: SD3, Flux.1-dev |
| Text-to-image, 1-4 steps | Distilled flow matching: Flux.1-schnell, SD3-Turbo, SDXL-Turbo |
| Real-time inference | Consistency distillation from a flow-matched base (LCM, PCM) |
| Audio generation | Flow matching: Stable Audio 2.5, AudioCraft 2 |
| Video generation | Flow matching mixed with diffusion (Sora, Veo, Stable Video) |
| Science / physics (particle trajectories, molecules) | Flow matching + equivariant vector field |

Cada vez que un documento dice "más rápido que la difusión" en 2025-2026, casi siempre es el flujo de coincidencia + destilación.

## Envío

Salva .`outputs/skill-fm-tuner.md`. Skill toma una especificación de modelo de estilo de difusión y la convierte en una configuración de entrenamiento de flujo: elección de horario, distribución de muestreo de tiempo (uniforme / logit-normal), optimizador, plan de reflujo, recuento de pasos objetivo, protocolo de evaluación.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`y comparar la MSE de 1 paso vs 20 pasos vs la distribución de datos real.
2. **Medium.**Cambiar de uniforme$t$El análisis de muestras se reduce a logit-normal (concentra el análisis de muestras a mediados de t).
3. **Hard.**Implemente una iteración de reflow: genera pareadas $(x_0, x_1)$mediante la integración del primer modelo, entrenar un segundo modelo en los pares y comparar la calidad de la muestra en un paso.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Flow matching | "Straight-line diffusion" | Train $v_\theta(x, t)$ to match $x_1 - x_0$ along an interpolant. |
| Rectified flow | "Reflow" | Iterative procedure that straightens learned flows. |
| Velocity field | "v_θ" | Output of the model — the direction to move $x_t$. |
| Straight-line interpolant | "The path" | $x_t = (1-t) \cdot x_0 + t \cdot x_1$; trivial target derivative. |
| Euler sampler | "1st order ODE solver" | Simplest integrator; works well when paths are straight. |
| Logit-normal t | "SD3 sampling" | Concentrate $t$ sampling toward mid-values where gradients are strongest. |
| Consistency distillation | "1-step sampler" | Train a student to map any $x_t$ directly to $x_0$. |
| CFG with velocity | "v-CFG" | $v_{\text{cfg}} = (1+w) v_{\text{cond}} - w v_{\text{uncond}}$; same trick, new variable. |

## Nota de producción: Flux.1-schnell es el flujo de coincidencia a su más rápido

La victoria de producción de flujo de coincidencia es Flux.1-schnell  un flujo-combinación DiT destilado a 1-4 pasos de inferencia manteniendo la calidad de grado Flux-dev. Niels "Run Flux en una máquina de 8GB" notebook es la receta de implementación de referencia: T5 + CLIP código, cuantizado MMDiT denoise (en 4 pasos para rápido vs 50 para dev), VAE decodificación. La contabilidad de costos:

| Variant | Steps | Latency at 1024² on L4 | Total FLOPs (relative) |
|---------|-------|------------------------|------------------------|
| Flux.1-dev (raw) | 50 | ~15 s | 1.0× |
| Flux.1-schnell | 4 | ~1.2 s | 0.08× (12× faster) |
| SDXL-base | 30 | ~4 s | 0.25× |
| SDXL-Lightning 2-step | 2 | ~0.3 s | 0.03× |

La regla de producción: **flow-matched base + distillation = the 2026 default for fast text-to-image.**Todos los principales proveedores envían esta combinación: SD3-Turbo (SD3 + flujo + destilación), Flux-schnell (Flux-dev + rectificado-flujo de enderezamiento), CogView-4-Flash.

## Leer más

- [Liu, Gong, Liu (2022). Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow](https://arxiv.org/abs/2209.03003) flujo rectificado.
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) coincidencia de flujo.
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) SD3, flujo rectificado a escala.
- [Albergo, Vanden-Eijnden (2023). Stochastic Interpolants](https://arxiv.org/abs/2303.08797) marco general que cubre la difusión FM +.
- [Song et al. (2023). Consistency Models](https://arxiv.org/abs/2303.01469) Destillación en 1 paso de difusión/flujo.
- [Sauer et al. (2023). Adversarial Diffusion Distillation (SDXL-Turbo)](https://arxiv.org/abs/2311.17042) Variante turbo.
- [Black Forest Labs (2024). Flux.1 models](https://blackforestlabs.ai/announcing-black-forest-labs/) flujo de coincidencia en la producción.
