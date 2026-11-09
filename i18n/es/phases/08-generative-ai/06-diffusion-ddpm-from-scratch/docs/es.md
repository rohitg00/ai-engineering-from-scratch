# Modelos de difusión  DDPM desde cero

> Ho, Jain, Abbeel (2020) dio al campo una receta que no podía dejar de hacer. Destruye los datos con ruido en mil pequeños pasos. Entrenar una red neuronal para predecir el ruido. Invertir el proceso a la inferencia. Hoy en día cada imagen, video, 3D y modelo musical corriente en este bucle, posiblemente con flujo de coincidencia o trucos de consistencia en la parte superior.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## El problema

¿ Quieres una muestra para ?$p_{\text{data}}(x)$Los GAN juegan un juego de mínimas que a menudo divergen. Los VAEs producen muestras borrosas de un decodificador gaussiano. Lo que realmente se quiere es un objetivo de entrenamiento que es (a) una sola pérdida estable (sin punto de sella, sin mínimas), (b) un límite inferior en $\log p(x)$(por lo que tiene probabilidades), y (c) muestras que coinciden con la calidad de SOTA.

Sohl-Dickstein et al. (2015) tenía una respuesta teórica: definir una cadena de Markov $q(x_t \mid x_{t-1})$que gradualmente añade ruido Gaussian, y entrenar una cadena inversa$p_\theta(x_{t-1} \mid x_t)$En el año 2020 se produjo muestras de última generación. En 2022 se convirtió en la difusión estable. En 2026 es el sustrato.

## El concepto

![DDPM: forward noise, reverse denoise](../assets/ddpm.svg)

**Forward process $q$.**Añadir el ruido Gaussian $T$La forma cerrada  la razón por la que la matemática es tratable  es que el paso acumulativo es también gaussiano:

```math
q(x_t \mid x_0) = \mathcal{N}\left( \sqrt{\bar{\alpha}_t} \cdot x_0, (1 - \bar{\alpha}_t) \cdot I \right)
```

donde$\bar\alpha_t = \prod_{s=1}^{t} (1 - \beta_s)$para un calendario de $\beta_t$- Escoge .$\beta_t$de 1e-4 a 0,02 por línea $T=1000$pasos y $x_T$es aproximadamente $\mathcal{N}(0, I)$¿ Qué ?

**Reverse process $p_\theta$.**Aprenda una red neuronal .$\epsilon_\theta(x_t, t)$que predice el ruido que se agregó.$x_t$, se denota por:

```math
x_{t-1} = \frac{1}{\sqrt{\alpha_t}} \cdot \left( x_t - \frac{\beta_t}{\sqrt{1 - \bar{\alpha}_t}} \cdot \epsilon_\theta(x_t, t) \right) + \sigma_t \cdot z
```

donde$\sigma_t$es cualquiera $\sqrt{\beta_t}$La expresión es fea pero es sólo álgebra  resolver para $x_{t-1}$dado el posterior $q(x_{t-1} \mid x_t, x_0)$y sustituyendo $x_0$con su estimación de ruido prevista.

**Training loss.**

```math
L_{\text{simple}} = \mathbb{E}_{x_0, t, \epsilon} \left[ \left\lVert \epsilon - \epsilon_\theta\left( \sqrt{\bar{\alpha}_t} \cdot x_0 + \sqrt{1 - \bar{\alpha}_t} \cdot \epsilon, t \right) \right\rVert^2 \right]
```

Muestra $x_0$de los datos, elige un aleatorio $t$, muestra $\epsilon \sim \mathcal{N}(0, I)$, calcular el ruido .$x_t$En un tiro a través de la forma cerrada, y regresar al ruido.

**Sampling.**Comienza .$x_T \sim \mathcal{N}(0, I)$. Iterar el paso inverso de $t = T$- Ya está.

## Por qué funciona

Tres intuiciones:

1. **Denoising is easy; generating is hard.**En el$t=T$La red tiene que resolver un problema trivial.$t=0$La red sólo tiene que limpiar unos pocos píxeles.$t$, el problema es difícil pero la red tiene muchos gradientes que fluyen a través de los mismos pesos de cada nivel de ruido.

2. **Score matching in disguise.**Vincent (2011) demostró que predecir el ruido es equivalente a estimar $\nabla_x \log q(x_t \mid x_0)$, el * puntaje*. El SDE inverso utiliza este puntaje para subir el gradiente de densidad  un paseo aleatorio guiado hacia regiones de alta probabilidad.

3. **The ELBO reduces to simple MSE.**El límite inferior de variación completa tiene un término KL por paso de tiempo. Con la parámetriz de DDPM, esos términos KL se simplifican a MSE en predicción del ruido con coeficientes específicos; Ho redujo los coeficientes (llamándolo pérdida "simplificada") y la calidad *mejorada*.

```figure
diffusion-denoise
```

## Construye el mismo

`code/main.py`La red es una pequeña MLP que toma un$(x_t, t)$El entrenamiento es la pérdida de una línea.

### Paso 1: el calendario anticipado (formulario cerrado)

```python
betas = [1e-4 + (0.02 - 1e-4) * t / (T - 1) for t in range(T)]
alphas = [1 - b for b in betas]
alpha_bars = []
cum = 1.0
for a in alphas:
    cum *= a
    alpha_bars.append(cum)
```

### Paso 2: muestra `x_t`en un solo disparo

```python
def forward_sample(x0, t, alpha_bars, rng):
    a_bar = alpha_bars[t]
    eps = rng.gauss(0, 1)
    x_t = math.sqrt(a_bar) * x0 + math.sqrt(1 - a_bar) * eps
    return x_t, eps
```

### Paso 3: un paso de entrenamiento

```python
def train_step(x0, model, alpha_bars, rng):
    t = rng.randrange(T)
    x_t, eps = forward_sample(x0, t, alpha_bars, rng)
    eps_hat = model_forward(model, x_t, t)
    loss = (eps - eps_hat) ** 2
    return loss, gradient_step(model, ...)
```

### Paso 4: muestreo inverso

```python
def sample(model, alpha_bars, T, rng):
    x = rng.gauss(0, 1)
    for t in range(T - 1, -1, -1):
        eps_hat = model_forward(model, x, t)
        beta_t = 1 - alphas[t]
        x = (x - beta_t / math.sqrt(1 - alpha_bars[t]) * eps_hat) / math.sqrt(alphas[t])
        if t > 0:
            x += math.sqrt(beta_t) * rng.gauss(0, 1)
    return x
```

Para un problema 1-D con 40 pasos de tiempo y una MLP de 24 unidades, esto aprende la mezcla de dos modos en ~200 épocas.

## Condicionamiento del tiempo

La red necesita saber qué paso de tiempo está denonizando.

- **Sinusoidal embedding.**Como el codificación de posición de Transformer.$\text{embed}(t) = [\sin(t/\omega_0), \cos(t/\omega_0), \sin(t/\omega_1), \ldots]$Pasar por una MLP, transmitir a la red.
- **Film / group-norm conditioning.**El proyecto de incorporación a escala/bias por canal (FiLM) en cada bloque.

Nuestro código de juguete usa sinusoidal → concat.

## Las trampas

- **Schedule matters a lot.**Lineal $\beta$Es el DDPM predeterminado pero el cronograma cosino (Nichol & Dhariwal, 2021) da una mejor FID para el mismo cálculo.
- **Timestep embedding is fragile.**Pasando en bruto$t$como un flotador funciona para juguete 1-D pero no para imágenes; siempre use una incorporación adecuada.
- **V-prediction vs ε-prediction.**Para regímenes estrechos (t muy pequeños o muy grandes), $\epsilon$El sistema de predicción de V ($v = \alpha \cdot \epsilon - \sigma \cdot x$) es más estable; SDXL, SD3 y Flux lo utilizan.
- **Classifier-free guidance.**En la inferencia, calcular tanto condicional como incondicional $\epsilon$, entonces$\epsilon_{\text{cfg}} = (1 + w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$con$w \approx 3\text{-}7$- Se trata de la Lección 8.
- **1000 steps is a lot.**La producción utiliza DDIM (20-50 pasos), DPM-Solver (10-20 pasos) o destilación (1-4 pasos).

## Usalo

| Role | Typical stack in 2026 |
|------|-----------------------|
| Image pixel-space diffusion (small, toy) | DDPM + U-Net |
| Image latent diffusion | VAE encoder + U-Net or DiT (Lesson 07) |
| Video latent diffusion | Spatiotemporal DiT (Sora, Veo, WAN) |
| Audio latent diffusion | Encodec + diffusion transformer |
| Science (molecules, proteins, physics) | Equivariant diffusion (EDM, RFdiffusion, AlphaFold3) |

La difusión es la columna vertebral generativa universal. La coincidencia de flujo (lección 13) es el competidor 2024-2026 que generalmente gana en velocidad de inferencia por la misma calidad.

## Envío

Salva .`outputs/skill-diffusion-trainer.md`. La habilidad toma un conjunto de datos + presupuesto y resultados de cálculo: horario (lineal/cosino/sigmoide), objetivo de predicción (ε/v/x), número de pasos, escala de orientación, familia de muestras y un protocolo de evaluación.

## Los ejercicios

1. **Easy.**Cambiar T de 40 a 10 en `code/main.py`¿Cómo se degrada la calidad de la muestra (histograma visual de las salidas)?
2. **Medium.**Cambiar de la predicción ε a la predicción v. Retomar el paso inverso. Comparar la calidad final de la muestra.
3. **Hard.**Añadir una guía sin clasificador. Condición en una etiqueta de clase $c \in \lbrace 0, 1 \rbrace$, bajar el 10% del tiempo durante el entrenamiento y en el tiempo de muestreo de uso $\epsilon = (1+w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$. Medir la tasa de impacto en el modo condicional en $w = 0, 1, 3, 7$¿ Qué ?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Forward process | "Adding noise" | Fixed Markov chain $q(x_t \mid x_{t-1})$ that destroys the data. |
| Reverse process | "Denoising" | Learned chain $p_\theta(x_{t-1} \mid x_t)$ that reconstructs the data. |
| β schedule | "The noise ladder" | Per-step variance; linear, cosine, or sigmoid. |
| α̅ | "Alpha bar" | Cumulative product $\prod (1 - \beta)$; gives closed-form $x_t$ from $x_0$. |
| Simple loss | "MSE on noise" | $\lVert \epsilon - \epsilon_\theta(x_t, t) \rVert^2$; all variational derivations collapse to this. |
| ε-prediction | "Predict noise" | Output is the noise added; standard DDPM. |
| V-prediction | "Predict velocity" | Output is $\alpha \cdot \epsilon - \sigma \cdot x$; better conditioning across t. |
| DDPM | "The paper" | Ho et al. 2020; linear β, 1000 steps, U-Net. |
| DDIM | "Deterministic sampler" | Non-Markov sampler, 20-50 steps, same training objective. |
| Classifier-free guidance | "CFG" | Mix conditional and unconditional noise predictions to amplify conditioning. |

## Nota de producción: la inferencia de difusión es un problema de recuento de pasos

El documento DDPM ejecuta T=1000 pasos invertidos. Nadie envía eso en producción. Cada pila de inferencias real elige una de tres estrategias  y cada mapa limpio a la producción de enmarcado de "de dónde viene la latencia":

1. **Faster sampler, same model.**DDIM (20-50 pasos), DPM-Solver++ (10-20), UniPC (8-16).$\epsilon_\theta$Los pesos están intactos, reduce la latencia 20 a 50 veces.
2. **Distillation.**Entrenar a un estudiante a coincidir con el maestro en menos pasos: Distillación progresiva (2 → 1), Modelos de consistencia (arbitrario → 1-4), LCM, SDXL-Turbo, SD3-Turbo.
3. **Caching and compilation.** `torch.compile(unet, mode="reduce-overhead")`, los retrocesos de difusión de TensorRT-LLM,`xformers`/SDPA atención, bf16 pesos. Cortes por paso latencia ~ 2×.

Para un servidor de difusión de producción la conversación presupuestaria es la misma que la literatura de producción describe para LLM: la latencia es `num_steps × step_cost + VAE_decode`, el rendimiento es `batch_size × (num_steps × step_cost)^-1`. TTFT es pequeño (un paso); TPOT-equivalente es el tiempo de respuesta completo porque la generación de imágenes es "todo a la vez" desde la perspectiva del usuario.

## Leer más

- [Sohl-Dickstein et al. (2015). Deep Unsupervised Learning using Nonequilibrium Thermodynamics](https://arxiv.org/abs/1503.03585) el papel de difusión, antes de su tiempo.
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) DDPM.
- [Song, Meng, Ermon (2021). Denoising Diffusion Implicit Models](https://arxiv.org/abs/2010.02502) DDIM, menos pasos.
- [Nichol & Dhariwal (2021). Improved DDPM](https://arxiv.org/abs/2102.09672) horario cosino, variación aprendida.
- [Dhariwal & Nichol (2021). Diffusion Models Beat GANs on Image Synthesis](https://arxiv.org/abs/2105.05233) Orientación del clasificador.
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) CFG.
- [Karras et al. (2022). Elucidating the Design Space of Diffusion-Based Generative Models (EDM)](https://arxiv.org/abs/2206.00364) Notas unificadas, receta más limpia.
