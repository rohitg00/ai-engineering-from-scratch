# Difusión latente y difusión estable

> La difusión del espacio de píxeles en imágenes 512×512 es un crimen de guerra computacional. Rombach et al. (2022) notó que no se necesitan todas las dimensiones 786k para generar una imagen  se necesita suficiente para capturar la estructura semántica, y un decodificador separado para el resto. ejecutar difusión dentro del espacio latente de un VAE. Esa idea es la difusión estable.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 02 (VAE), Phase 8 · 06 (DDPM), Phase 7 · 09 (ViT)
**Time:** ~75 minutes

## El problema

La difusión del espacio-pixel en 5122 significa que la U-Net funciona en tensores de forma .`[B, 3, 512, 512]`Cada paso de muestreo es de ~100 GFLOPS para una U-Net de 500M. Cincuenta pasos son 5 TFLOPS por imagen.

La mayoría de esos FLOPs van a empujar detalles perceptualmente no importantes a través de la red  la textura de alta frecuencia que un VAE perdedor podría comprimir. La idea de Rombach: entrenar un VAE una vez (la * primera etapa*), congelarlo y ejecutar la difusión enteramente en el espacio latente de 4 canales 64×64 (la * segunda etapa*).

Esta es la receta de la difusión estable. SD 1.x / 2.x usó una U-Net de 860M sobre `64×64×4`Las redes de acceso a Internet de SDXL utilizan una red de acceso a Internet de 2.6B.`128×128×4`, SD3 cambió la U-Net por un Transformador de Difusión (DiT) con flujo de coincidencia. Flux.1-dev (Black Forest Labs, 2024) envía un DiT-MMDiT de 12B-parámetro. Todos funcionan en el mismo sustrato de dos etapas.

## El concepto

![Latent diffusion: VAE compression + diffusion in latent space](../assets/latent-diffusion.svg)

**Two stages, separately trained.**

1. **Stage 1 — VAE.**Encodificador$E(x) \to z$, decodificador$D(z) \to x$. Compresión objetivo: 8 veces muestra descendente en cada eje espacial + ajustar canales para que el tamaño latente total sea ~1/16 de la cantidad de píxeles. pérdida = reconstrucción (L1 + LPIPS perceptual) + KL (pequeño peso así $z$No es demasiado Gaussian, porque no necesitamos muestras exactas de$z$A menudo entrenados con una derrota adversaria, las imágenes descifradas son agudas.

2. **Stage 2 — diffusion on $z$.**Tratar$z = E(x_{\text{real}})$En el caso de las redes de Internet, el sistema de comunicación de Internet (U-Net) puede ser utilizado para denegar la información.$z_t$En la inferencia: muestra$z_0$por difusión, entonces $x = D(z_0)$¿ Qué ?

**Text conditioning.**Dos componentes adicionales: un codificador de texto congelado (CLIP-L para SD 1.x, CLIP-L+OpenCLIP-G para SD 2/XL, T5-XXL para SD3 y Flux).`[Q = image features, K = V = text tokens]`Los tokens son la única forma en que el texto influye en la imagen.

**The loss function is identical to Lesson 06.**El mismo DDPM / flujo de MSE coincide con el ruido.

## Variantes de arquitectura

| Model | Year | Backbone | Latent shape | Text encoder | Params |
|-------|------|----------|--------------|--------------|--------|
| SD 1.5 | 2022 | U-Net | 64×64×4 | CLIP-L (77 tokens) | 860M |
| SD 2.1 | 2022 | U-Net | 64×64×4 | OpenCLIP-H | 865M |
| SDXL | 2023 | U-Net + refiner | 128×128×4 | CLIP-L + OpenCLIP-G | 2.6B + 6.6B |
| SDXL-Turbo | 2023 | Distilled | 128×128×4 | same | 1-4 step sampling |
| SD3 | 2024 | MMDiT (multimodal DiT) | 128×128×16 | T5-XXL + CLIP-L + CLIP-G | 2B / 8B |
| Flux.1-dev | 2024 | MMDiT | 128×128×16 | T5-XXL + CLIP-L | 12B |
| Flux.1-schnell | 2024 | MMDiT distilled | 128×128×16 | T5-XXL + CLIP-L | 12B, 1-4 step |

La tendencia: reemplazar U-Net por DiT (transformador sobre parches latente), escalar el codificador de texto (T5 supera CLIP para la adhesión rápida), aumentar los canales latente (4 → 16 da más espacio de detalle).

```figure
noise-schedule
```

## Construye el mismo

`code/main.py`Esta prueba muestra que la misma pérdida de difusión funciona si se ejecuta con valores 1D crudos o con valores codificados. Esa es la clave.

### Paso 1: codificador/decodificador

```python
def encode(x):    return x * 0.5          # toy "compression" to smaller scale
def decode(z):    return z * 2.0
```

Para la pedagogía, este mapa lineal es suficiente para mostrar que la difusión opera en$z$sin importar el espacio de datos original.

### Paso 2: difusión en `z`- el espacio

El mismo DDPM que la Lección 06.$z = E(x)$Después de tomar muestras$z_0$, decodificar con $D(z_0)$¿ Qué ?

### Paso 3: Guía sin clasificador

Durante el entrenamiento, deje de escribir la etiqueta de clase el 10% de las veces (reemplaza con un token nulo).$\epsilon_{\text{cond}}$y $\epsilon_{\text{uncond}}$, entonces:

```python
eps_cfg = (1 + w) * eps_cond - w * eps_uncond
```

$w = 0$= no hay orientación (plena diversidad), $w = 3$= por defecto, $w = 7+$= saturado / demasiado nítido.

### Paso 4: Condicionamiento de texto (concepto, no código)

Reemplazar la etiqueta de clase con una salida de codificador de texto congelado. Alimenta el texto integrado a la U-Net a través de la atención cruzada:

```python
h = h + CrossAttention(Q=h, K=text_embed, V=text_embed)
```

Esta es la única diferencia sustancial entre un modelo de difusión con condiciones de clase y la difusión estable.

## Las trampas

- **VAE-scale mismatch.**SD 1.x VAEs tienen una constante de escala (`scaling_factor ≈ 0.18215`El sistema de control de la red de U-Net se encuentra en latencia con una variación muy equivocada.
- **Text encoder silently wrong.**SD3 necesita T5-XXL con >=128 tokens, y el regreso a CLIP-solo es pérdida.`use_t5=True`o cráteres de fidelidad rápidos.
- **Mixing latent spaces.**SDXL, SD3, Flux todos usan diferentes VAEs. Un LoRA entrenado en SDXL latente no funcionará en SD3.
- **CFG too high.** `w > 10`La idea de la Comisión es que la Comisión debe tener en cuenta que el mercado de la información en el mercado interior es un mercado único.`w = 3-7`¿ Qué ?
- **Negative prompts leaking.**El mensaje negativo vacío se convierte en el token nulo; un mensaje negativo lleno se convierte en el $\epsilon_{\text{uncond}}$No son lo mismo; algunas tuberías silenciosamente se ponen en nulo.

## Usalo

Estatuas de producción en 2026:

| Target | Recommended backbone |
|--------|----------------------|
| Narrow domain, paired data, training a model from scratch | SDXL fine-tune (LoRA / full) — fastest to ship |
| Open-domain text-to-image, open weights | Flux.1-dev (12B, Apache / non-commercial) or SD3.5-Large |
| Fastest inference, open weights | Flux.1-schnell (1-4 step, Apache) or SDXL-Lightning |
| Best prompt adherence, hosted | GPT-Image / DALL-E 3 (still), Midjourney v7, Imagen 4 |
| Edit workflows | Flux.1-Kontext (Dec 2024) — natively accepts image + text |
| Research, baseline | SD 1.5 — ancient but well-studied |

## Envío

Salva .`outputs/skill-sd-prompter.md`. Skill toma un texto de respuesta + estilo objetivo y las salidas: modelo + punto de control, escala CFG, muestra, respuesta negativa, resolución, combinación opcional de ControlNet/IP-Adapter, y una lista de verificación de calidad por paso.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`con una guía$w \in \lbrace 0, 1, 3, 7, 15 \rbrace$- Registran la muestra media por clase.$w$¿Las clases de medios divergen más allá de los medios de datos reales?
2. **Medium.**Cambiar el codificador lineal del juguete por un par de codificador/decodificador tanh-MLP con pérdida de reconstrucción. Retrain difusión en los nuevos latentes. ¿Cambia la calidad de la muestra?
3. **Hard.**Configurar una verdadera inferencia de difusión estable con difusores: carga `sdxl-base`, ejecutar 30 pasos de Euler con CFG=7, tiempo. Ahora cambia a`sdxl-turbo`El mismo tema, diferente calidad  describir lo que cambió y por qué.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| First stage | "The VAE" | Trained encoder/decoder pair; compresses 512² to 64². |
| Second stage | "The U-Net" | Diffusion model over the latent space. |
| CFG | "Guidance scale" | $(1+w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$; tunes conditioning strength. |
| Null token | "Empty prompt embed" | Unconditional embed used for $\epsilon_{\text{uncond}}$. |
| Cross-attention | "How text gets in" | Each U-Net block attends to text tokens as K and V. |
| DiT | "Diffusion Transformer" | Replace U-Net with a transformer over latent patches; scales better. |
| MMDiT | "Multi-modal DiT" | SD3's architecture: text and image streams with joint attention. |
| VAE scaling factor | "Magic number" | Divides latents by ~5.4 so diffusion operates in unit-variance space. |

## Nota de producción: ejecutar Flux-12B en una GPU de consumo de 8 GB

La integración de Flux de referencia es la receta canónica "Tengo una GPU de consumo, ¿puedo enviar esto?" El truco es el mismo de tres botones de receta de producción de la literatura de inferencia listas aplicadas a una difusión DiT:

1. **Staggered loading.**Flux tiene cuatro redes que nunca necesitan coexistir en VRAM: T5-XXL codificador de texto (~ 10 GB en fp32), CLIP-L (pequeño), el 12B MMDiT, y el VAE. Encode el prompt primero, *borrar* los codificadores, cargar el DiT, denoise, *borrar* el DiT, cargar el VAE, decodificar.
2. **4-bit quantization via bitsandbytes.** `BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16)`En el codificador T5 y en el DiT. Cortando la memoria 8×, la caída de calidad es imperceptible para el texto a la imagen por los puntos de referencia de Aritra (enlazados en el cuaderno).
3. **CPU offload.** `pipe.enable_model_cpu_offload()`automáticamente cambia los módulos entre la CPU y la GPU a medida que cada paso avanzado avanza. Agrega 10-20% de latencia pero hace que la tubería funcione en absoluto.

La contabilidad de la memoria es: `10 GB T5 / 8 = 1.25 GB`cuantificado,`12 B params × 0.5 bytes = ~6 GB`En términos de stas00 este es el extremo de la inferencia TP=1  sin paralelismo de modelo, cuantización máxima. Para la producción se ejecutaría TP=2 o TP=4 en H100s; para un solo portátil de desarrollo, esta es la receta.

## Leer más

- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) Difusión estable.
- [Podell et al. (2023). SDXL: Improving Latent Diffusion Models for High-Resolution Image Synthesis](https://arxiv.org/abs/2307.01952) SDXL.
- [Peebles & Xie (2023). Scalable Diffusion Models with Transformers (DiT)](https://arxiv.org/abs/2212.09748)¿Qué es esto?
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) SD3, MMDiT.
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) CFG.
- [Labs (2024). Flux.1 — Black Forest Labs announcement](https://blackforestlabs.ai/announcing-black-forest-labs/) Familia Flux1.
- [Hugging Face Diffusers docs](https://huggingface.co/docs/diffusers/index) aplicación de referencia para cada punto de control anterior.
