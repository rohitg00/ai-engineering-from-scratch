# Modelos generacionales  Taxonomía e historia

> Cada modelo de imagen, modelo de texto, modelo de video y modelo 3D encaja en uno de los cinco baldes. Elige el balde equivocado y lucharás las matemáticas durante semanas. Elige el correcto y los últimos doce años de progreso del campo se apilarán limpio en tu cabeza.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 2 (ML Fundamentals), Phase 3 (Deep Learning Core), Phase 7 · 14 (Transformers)
**Time:** ~45 minutes

## El problema

Un modelo generativo hace un trabajo: muestra de formación dada extraída de una distribución desconocida $p_{\text{data}}(x)$Las caras, las frases, los archivos MIDI, las estructuras de proteínas, todo el mismo problema si miras con los ojos.

El problema es que ...$p_{\text{data}}$Si el modelo de un modelo generativo es un modelo generativo, es un compromiso que cambia un problema difícil por otro ligeramente menos difícil.

Cinco familias han sobrevivido en los últimos doce años. Saber qué compromiso hace cada familia nos dice por qué gana en algunas tareas y se derrumba en otras.

## El concepto

![Five families of generative models — taxonomy by what they model](../assets/taxonomy.svg)

**1. Explicit density, tractable.**Escriba .$\log p(x)$Los modelos autoregresivos (PixelCNN, WaveNet, GPT) factorizan$p(x) = \prod_i p(x_i \mid x_{<i})$. Normalización de los flujos (RealNVP, Glow)$p(x)$Pro: probabilidad exacta, pérdida de entrenamiento limpia. Con: inferencia autorregresista es secuencial (lento para secuencias largas), los flujos necesitan arquitecturas invertibles (arquitectónicamente restrictivas).

**2. Explicit density, approximate.**Enlazado$\log p(x)$Los modelos de difusión (DDPM, Ho 2020) entrenan un denoizador que optimiza implícitamente un ELBO ponderado. La difusión es la columna vertebral dominante de la imagen, el video y la 3D en 2026.

**3. Implicit density.**Salta la densidad por completo; aprende un generador $G(z)$que produce muestras y un discriminador $D(x)$GANs (Goodfellow 2014). Rápido en la inferencia (un pase hacia adelante) pero notoriamente inestable durante el entrenamiento. StyleGAN 1/2/3 sigue siendo el estado de la técnica para el fotorrealismo de dominio fijo (caras, dormitorios) incluso en 2026.

**4. Score-based / continuous-time.**Aprenda el gradiente de la densidad de troncos $\nabla_x \log p(x)$Song & Ermon (2019) mostró que la coincidencia de puntajes generaliza la difusión a una SDE. La coincidencia de flujo (Lipman 2023) es la calidez 2024-2026: entrenamiento sin simulación, caminos más recta, muestreo 4-10 veces más rápido que DDPM.

**5. Token-based autoregressive over discrete codes.**Compresar datos de alto tamaño con un VQ-VAE o cuantificador residual en una secuencia corta de tokens discretos, luego usar un transformador para modelar la secuencia de tokens. Parti, MuseNet, AudioLM, VALL-E, el tokenizer de parches de Sora todos usan esto. Este es balde 1 más un tokenizer aprendido.

## Una breve historia

| Year | Model | Why it mattered |
|------|-------|-----------------|
| 2013 | VAE (Kingma) | First deep generative model with a usable training loss. |
| 2014 | GAN (Goodfellow) | Implicit density, no likelihood — shockingly sharp samples. |
| 2015 | DRAW, PixelCNN | Sequential image generation. |
| 2017 | Glow, RealNVP | Invertible flows; exact likelihood with depth. |
| 2017 | Progressive GAN | First megapixel faces. |
| 2019 | StyleGAN / StyleGAN2 | Photorealistic faces still hard to beat for that one domain. |
| 2020 | DDPM (Ho) | Diffusion becomes practical. |
| 2021 | CLIP, DALL-E 1, VQGAN | Text-to-image goes mainstream. |
| 2022 | Imagen, Stable Diffusion 1, DALL-E 2 | Latent diffusion + text conditioning = commodity. |
| 2022 | ControlNet, LoRA | Fine control over pretrained diffusion. |
| 2023 | SDXL, Midjourney v5, Flow matching | Scale + better training dynamics. |
| 2024 | Sora, Stable Diffusion 3, Flux.1 | Video diffusion; flow matching wins. |
| 2025 | Veo 2, Kling 1.5, Runway Gen-3, Nano Banana | Production-grade video. |
| 2026 | Consistency + Rectified Flow | One-step sampling from diffusion backbones. |

## El triaje de cinco preguntas

Cuando se produzca un nuevo modelo generativo, responda a estas cinco preguntas antes de leer la sección de métodos.

1. **What is being modeled?**¿Pixels, latences, tokens discretos, Gaussians 3D, redes, formas de onda?
2. **Is the density explicit or implicit?**¿ Se escriben ?$\log p(x)$¿ Qué ?
3. **Sampling: one-shot or iterative?**Iterativo significa inferencia más lenta; un tiro generalmente significa adversario o destilado.
4. **Conditioning: unconditional, class, text, image, pose?**Esto determina la pérdida y el andamio de la arquitectura.
5. **Evaluation: FID, CLIP score, IS, human preference, task accuracy?**Cada uno tiene modos de fallo conocidos (véase la Lección 14).

Responda a estas cinco preguntas para cada lección en esta fase.

```figure
autoencoder-bottleneck
```

## Construye el mismo

El código para esta lección es una visualización ligera: ajusta una mezcla de Gaussis de 1D de muestras utilizando tres enfoques de juguete (densidad del núcleo, histograma discreto y generador de "GAN-ish" de la muestra más cercana) para que puedas ver la diferencia entre la densidad explícita vs implícita en un problema que puedes imprimir en una pantalla.

- ¿ Qué ?`code/main.py`Se extraen 2000 muestras de una mezcla gaussiana de dos modos, y luego se imprimen:

```
explicit density (histogram): p(x in [-0.5, 0.5]) ≈ 0.38
approximate density (KDE):     p(x in [-0.5, 0.5]) ≈ 0.41
implicit (nearest-sample gen): 20 new samples printed, no p(x)
```

Nota: las dos primeras te permiten preguntar "¿qué probabilidades tiene este punto?" La tercera no puede. Esta es la distinción *explicita vs implícita* que será importante para cada lección futura.

## Usalo

¿Qué familia, para qué tarea, en 2026?

| Task | Best family | Why |
|------|-------------|-----|
| Photoreal faces, narrow domain | StyleGAN 2/3 | Still sharpest, fastest inference. |
| General text-to-image | Latent diffusion + flow matching | SD3, Flux.1, DALL-E 3. |
| Fast text-to-image | Rectified flow + distillation | SDXL-Turbo, SD3-Turbo, LCM. |
| Text-to-video | Diffusion Transformer + flow matching | Sora, Veo 2, Kling. |
| Speech + music | Token-based AR (AudioLM, VALL-E, MusicGen) or flow matching (AudioCraft 2) | Discrete tokens scale cheaply. |
| 3D scenes | Gaussian Splatting fit, diffusion prior | 3D-GS for reconstruction, diffusion for novel-view. |
| Density estimation (no sampling) | Flows | Only family with exact $\log p(x)$. |
| Simulation / physics | Flow matching, score SDE | Straight-line paths, smooth vector fields. |

## Envío

Salvo como`outputs/skill-model-chooser.md`¿ Qué ?

La habilidad toma una descripción de tarea y resultados: (1) qué familia utilizar, (2) una lista clasificada de tres opciones abiertas y tres alojadas, (3) el modo probable de fracaso que debe mirar, y (4) un presupuesto de cálculo/tiempo.

## Los ejercicios

1. **Easy.**Para cada uno de estos cinco productos, identifique la familia y la columna vertebral: imagen ChatGPT, Midjourney v7, Sora, Runway Gen-3, ElevenLabs.
2. **Medium.**El artículo que vas a leer mañana recomienda una muestreo 100 veces más rápida que la difusión.
3. **Hard.**Tome un dominio que le importe (por ejemplo, estructura de proteínas, CAD, moléculas, trayectorias). Responde al triaje de cinco preguntas para el modelo SOTA actual en ese dominio y esboce qué cambiaría un modelo mejor.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Generative model | "It makes new stuff" | Learns a sampler for $p_{\text{data}}(x)$, optionally exposes $\log p(x)$. |
| Explicit density | "You can evaluate it" | Model provides a closed-form or tractable $\log p(x)$. |
| Implicit density | "GAN-style" | Only a sampler — no way to evaluate $p(x)$ of a given point. |
| ELBO | "Evidence lower bound" | A tractable lower bound on $\log p(x)$; VAEs and diffusion optimize it. |
| Score | "Gradient of log-density" | $\nabla_x \log p(x)$; diffusion and SDE models learn this field. |
| Manifold hypothesis | "Data lives on a surface" | High-dim data concentrates on a low-dim manifold; why dimensionality reduction works. |
| Autoregressive | "Predict the next piece" | Factorize joint as product of conditionals. |
| Latent | "Compressed code" | Low-dim representation from which a decoder can reconstruct the input. |

## Nota de producción: cinco familias, cinco formas de inferencia

Cada familia hace mapas a una curva de costos inferencia-servidor diferente. La literatura de producción-inferencia enmarca la inferencia LLM como preempleo + decodificación; la misma descomposición se aplica aquí:

- **Autoregressive (bucket 1 and 5).**El decodificación secuencial domina la latencia; el caché KV, el batch continuo y el decodificación especulativa se aplican directamente.
- **VAE / diffusion / flow-matching (buckets 2 and 4).**No hay decodificación en el sentido de LLM.`num_steps × step_cost`, y el `step_cost`Los botones de producción son el recuento de pasos (DDIM / DPM-Solver / destilación), el tamaño del lote y la precisión (bf16 / fp8 / int4).
- **GAN (bucket 3).**No hay cronograma, no hay caché KV, TTFT ≈ latencia total, por eso StyleGAN sigue ganando en el uso de dominio estrecho.

Cuando vea "más rápido que la difusión" en un resumen de papel, traduzca a "menos pasos × el mismo costo del paso" o "los mismos pasos × el costo del paso más barato".

## Leer más

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) el papel GAN.
- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) el documento de la AEV.
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) el documento del DDPM.
- [Song et al. (2021). Score-Based Generative Modeling through SDEs](https://arxiv.org/abs/2011.13456) difusión como SDE.
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747) el papel de correspondencia de flujo.
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) Difusión estable 3.
