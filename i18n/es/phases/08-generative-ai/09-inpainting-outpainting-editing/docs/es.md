# Pintura, pintura y edición de imágenes

> El texto a la imagen hace cosas nuevas. La pintura repara las viejas. En la producción, el 70% del trabajo de imagen facturable es la edición  cambiar un fondo, quitar un logotipo, extender el lienzo, regenerar una mano. La pintura es donde la difusión gana su mantenimiento.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 8 · 08 (ControlNet & LoRA)
**Time:** ~75 minutes

## El problema

Un cliente envía una foto perfecta del producto con un signo distractivo en el fondo. Quieres borrar el signo y dejar todo lo demás idéntico a los píxeles. No puedes ejecutar texto a imagen desde cero. El resultado tendrá un color diferente, una iluminación diferente, un ángulo diferente del producto. Quieres regenerar *sólo* la región enmascarada, y quieres que la regeneración respete el contexto circundante.

Eso es pintar.

- **Inpainting.**Regenerarse dentro de una máscara, mantener fuera de los píxeles.
- **Outpainting.**Regenerar fuera de la máscara (o más allá del lienzo), mantenerse dentro.
- **Image editing.**Regenerar toda la imagen pero mantener la fidelidad semántica o estructural al original (SDEdit, InstructPix2Pix).

Cada tubería de difusión en 2026 envía un modo de pintura. Flux.1-Fill, Inpaint de difusión estable, SDXL-Inpaint, DALL-E 3 Edit. Trabajan en el mismo principio.

## El concepto

![Inpainting: mask-aware denoising with context-preserving reinjection](../assets/inpainting.svg)

### El enfoque ingenuo (y por qué es incorrecto)

ejecuta texto estándar a imagen con una máscara. en cada paso de muestreo, reemplaza la región sin máscara de la latencia ruidosa con la imagen limpia difundida hacia adelante. funciona mal. los artefactos fronterizos sangran porque el modelo no tiene información sobre lo que está en la región enmascarada.

### El modelo de pintura adecuado

Entrenar una red U-Modificada que toma 9 canales de entrada en lugar de 4:

```
input = concat([ noisy_latent (4ch), encoded_image (4ch), mask (1ch) ], dim=channel)
```

Los canales adicionales son una copia de la imagen fuente codificada por VAE más una máscara de un solo canal. En el tiempo de entrenamiento, se enmascaran aleatoriamente las regiones de la imagen y se entrena al modelo para denotar solo la región enmascarada mientras que la región sin máscara se da como una señal de acondicionamiento limpia.

SD-Inpaint, SDXL-Inpaint, Flux-Fill todos usan esta entrada de 9 canales (o analógicos).`StableDiffusionInpaintPipeline`¿ Qué ?`FluxFillPipeline`¿ Qué ?

### SDEdit (Meng et al., 2022)  edición gratuita

Añadir ruido a la imagen fuente hasta un punto intermedio `t`, luego ejecuta la cadena inversa de `t`No hay reentrenamiento, la opción de empezar.`t`comercio de fidelidad por la libertad creativa:

- `t/T = 0.3`→ casi idéntico a la fuente, pequeños cambios estilísticos
- `t/T = 0.6`→ modificaciones moderadas, conserva la estructura gruesa
- `t/T = 0.9`→ generado a partir de una preservación de fuentes de ruido cercano y mínima

### InstructPix2Pix (Brooks et al., 2023)

Ajustar el modelo de difusión en`(input_image, instruction, output_image)`En la inferencia, condicionar tanto la imagen de entrada como una instrucción de texto ("hacer que se ponga el sol", "agrega un dragón"). Dos escalas CFG: escala de imagen y escala de texto.

### RePaint (Lugmayr et al., 2022)

Mantenga un modelo estándar de difusión incondicional. En cada paso inverso, vuelva a probar  saltar de vez en cuando a un estado más ruidoso y regenerarse. Evita artefactos de frontera. Se utiliza cuando no tiene un modelo de pintura entrenado.

```figure
inpaint-mask-reinject
```

## Construye el mismo

`code/main.py`Implementa un esquema de pintura de juguete 1-D en datos 5 dimensiones. Entrenamos un DDPM en datos de mezcla 5D donde cada muestra es 5 flotantes de uno de dos racimos. En la inferencia, "mascaramos" 2 de las 5 dimensiones, inyectamos la versión ruidosa hacia adelante de los tres desmascarados en cada paso, y regeneramos solo las dimensiones enmascaradas.

### Paso 1: Datos de DDPM en 5D

```python
def sample_data(rng):
    cluster = rng.choice([0, 1])
    center = [-1.0] * 5 if cluster == 0 else [1.0] * 5
    return [c + rng.gauss(0, 0.2) for c in center], cluster
```

### Paso 2: Denoiser de tren en los 5 dims

DDPM estándar. Las salidas de red predicen el ruido en 5D para la entrada de ruido en 5D.

### Paso 3: en la inferencia, reverso consciente de la máscara

```python
def inpaint_step(x_t, mask, clean_image, alpha_bars, t, rng):
    # replace unmasked dims with a freshly noised version of the clean source
    a_bar = alpha_bars[t]
    for i in range(len(x_t)):
        if not mask[i]:
            x_t[i] = math.sqrt(a_bar) * clean_image[i] + math.sqrt(1 - a_bar) * rng.gauss(0, 1)
    # ...then run the normal reverse step on x_t
```

Este es el enfoque ingenuo y funciona con datos de juguete 1-D. La pintura de imágenes real utiliza la entrada de 9 canales porque la coherencia de la textura es más importante.

### Paso 4: Despeño

La pintura exterior es la pintura con la máscara invertida: enmascarar el lienzo nuevo (antes inexistente), llenar el resto con el original.

## Las trampas

- **Seams.**El enfoque ingenuo deja límites visibles porque la información de gradiente no fluye a través de la máscara.
- **Mask leakage.**Si la región desmascarada de la imagen de acondicionamiento es de baja calidad o ruidosa, contamina la generación dentro de la máscara.
- **CFG interacts with mask size.**Alta CFG en una máscara pequeña = parche saturado. Reducir CFG para pequeñas ediciones.
- **SDEdit fidelity cliff.**Desde el`t/T = 0.5`¿ Qué ?`t/T = 0.6`Puede perder la identidad del sujeto.
- **Prompt mismatch.**El mensaje debe describir la imagen completa, no sólo el nuevo contenido. "Un gato sentado en una silla" no "un gato".

## Usalo

| Task | Pipeline |
|------|----------|
| Remove object, small mask | SD-Inpaint or Flux-Fill, standard prompt |
| Replace sky | SD-Inpaint + "blue sky at sunset" |
| Extend canvas | SDXL outpaint mode (8px feather) or Flux-Fill with outpaint mask |
| Regenerate hand / face | SD-Inpaint with prompt re-describing the subject + ControlNet-Openpose |
| Change style of one region | SDEdit at `t/T=0.5` on masked region |
| "Make it sunset" | InstructPix2Pix or Flux-Kontext |
| Background replacement | SAM mask → SD-Inpaint |
| Ultra-high-fidelity | Flux-Fill or GPT-Image (hosted) for hardest cases |

SAM (Segmento de Meta cualquier cosa, 2023) + difusión de pintura es el 2026 de la extracción de fondo de la tubería. SAM 2 (2024) funciona en video.

## Envío

Salva .`outputs/skill-editing-pipeline.md`. Skill toma una imagen original + descripción de edición + máscara opcional (o SAM prompt) y las salidas: enfoque de generación de máscara, modelo base, escalas CFG (imagen + texto), modo SDEdit-t o inpainting y lista de verificación de calidad.

## Los ejercicios

1. **Easy.**En el`code/main.py`¿A qué fracción la calidad de la pintura (residual en las dimensiones enmascaradas) es igual a la generación incondicional?
2. **Medium.**Implementar RePaint: cada décimo paso inverso, salta 5 pasos atrás (agrega ruido) y vuelve a denotar.
3. **Hard.**Utilice difusores de cara abrazada para comparar: SD 1.5 Inpaint + ControlNet-Openpose vs Flux.1-Complete en 20 tareas de regeneración facial.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Inpainting | "Fill the hole" | Regenerate inside a mask; keep outside pixels. |
| Outpainting | "Extend the canvas" | Regenerate outside the canvas; keep inside. |
| 9-channel U-Net | "Proper inpainting model" | U-Net with `noisy \| encoded-source \| mask` as input. |
| SDEdit | "Img2img with noise level" | Noise to time `t`, denoise with new prompt. |
| InstructPix2Pix | "Text-only edits" | Fine-tuned diffusion on (image, instruction, output) triples. |
| RePaint | "No retraining" | Re-noise periodically during reverse to reduce seams. |
| SAM | "Segment Anything" | Mask generator by clicks or boxes; pairs with inpaint. |
| Flux-Kontext | "Edit with context" | Flux variant that accepts a reference image + instruction for edits. |

## Nota de producción: las líneas de edición son sensibles a la latencia

Los usuarios que editan una imagen esperan viajes de ida y vuelta de menos de 5 segundos. Un SDXL-Inpaint de 30 pasos en 10242 es de 3-4 segundos en un L4, más generación de máscara SAM (~ 200 ms) y código/decodificación VAE (~ 500 ms combinados). En el marco de producción, esto está ligado a TTFT en lugar de a través de  lote 1, baja concurrencia, minimizar cada etapa:

- **SAM-H is the slow one.**SAM-H en 10242 es ~ 200 ms; SAM-ViT-B es ~ 40 ms con pérdida de calidad menor. SAM 2 (video) añade gastos temporales; no lo utilice para la edición de una sola imagen.
- **Skip the encode when possible.** `pipe.image_processor.preprocess(img)`Si tienes los latences de la generación anterior (típico en las interfaces de edición iterativa), pasalos directamente a través de `latents=...`para omitir un código de VAE.
- **Mask dilation matters for throughput too.**Una máscara pequeña significa que la mayor parte del pase hacia adelante de la U-Net se desperdicia (los píxeles sin máscara están sujetos de todos modos). `diffusers`¿ Qué es eso ?`StableDiffusionInpaintPipeline`ejecuta la red U-Net completa sin importar; sólo las variantes de 9 canales de impresión adecuada explotan la computación enmascarada.
- **Flux-Kontext is the 2025 answer.**Un solo paso hacia adelante .`(source_image, instruction)`No hay máscara separada, no hay barreras de ruido SDEdit. En un H100 se envía una edición en ~ 1,5 s. La lección de arquitectura: derrumbar las etapas.

## Leer más

- [Lugmayr et al. (2022). RePaint: Inpainting using Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2201.09865) pintura sin formación.
- [Meng et al. (2022). SDEdit: Guided Image Synthesis and Editing with Stochastic Differential Equations](https://arxiv.org/abs/2108.01073) SDEdit.
- [Brooks, Holynski, Efros (2023). InstructPix2Pix](https://arxiv.org/abs/2211.09800) edición de instrucciones de texto.
- [Kirillov et al. (2023). Segment Anything](https://arxiv.org/abs/2304.02643)SAM, la fuente de la máscara.
- [Ravi et al. (2024). SAM 2: Segment Anything in Images and Videos](https://arxiv.org/abs/2408.00714) vídeo SAM.
- [Hertz et al. (2022). Prompt-to-Prompt Image Editing with Cross-Attention Control](https://arxiv.org/abs/2208.01626) Editación a nivel de atención.
- [Black Forest Labs (2024). Flux.1-Fill and Flux.1-Kontext](https://blackforestlabs.ai/flux-1-tools/) 2024 herramientas.
