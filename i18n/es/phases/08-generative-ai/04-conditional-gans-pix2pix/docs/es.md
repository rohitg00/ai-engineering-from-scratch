# GANs condicionales y Pix2Pix

> La primera gran desbloqueación de 2014-2017 fue controlar lo que hace un GAN. adjunta una etiqueta, o una imagen, o una frase. Pix2Pix hizo la versión de imagen y todavía supera todos los modelos genéricos de texto a imagen en tareas estrechas de imagen a imagen.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 06 (U-Net), Phase 3 · 07 (CNNs)
**Time:** ~75 minutes

## El problema

Un GAN incondicional muestra caras arbitrarias. Útil para una demostración, inútil en la producción. Quieres: *mapear un boceto a una foto*, *mapear un mapa a una foto aérea*, *mapear una escena diurna a la noche*, *colorizar una imagen a escala de gris*. En todas estas, se te da una imagen de entrada$x$y debe emitir$y$Hay muchas razones plausibles.$y$Es por$x$El error medio cuadrado los aplanará en masaje.

GAN condicional (Mirza & Osindero, 2014) añade una condición $c$como una entrada para ambos $G$y $D$. Pix2Pix (Isola et al., 2017) se especializó en esto: condición es una imagen de entrada completa, generador es una U-Net, discriminador es un clasificador basado en parches (PatchGAN), y pérdida es adversarial + L1.

## El concepto

![Pix2Pix: U-Net generator, PatchGAN discriminator](../assets/pix2pix.svg)

**Conditional G.** $G(x, z) \to y$En Pix2Pix,$z$se desprende dentro de G (no hay ruido de entrada  Isola encontró que el ruido explícito fue ignorado).

**Conditional D.** $D(x, y) \to [0, 1]$. La entrada es el *pair* (condición, salida). Esta es la diferencia clave: D debe juzgar si $y$es consistente con $x$, no sólo si$y$Parece real.

**U-Net generator.**Encoder-decodificador con conexiones de salto a través del cuello de botella. Es crítico para tareas donde la entrada y salida comparten una estructura de bajo nivel (bordañas, silueta). Sin los saltos, los detalles de alta frecuencia desaparecen.

**PatchGAN discriminator.**En lugar de emitir una única puntuación real/falsa, D emitirá una$N \times N$La red de la red donde cada célula juzga un campo receptivo de ~70×70 píxeles. promedio. Esta es una suposición de campo aleatorio de Markov: el realismo es local.

**Loss.**

```math
\begin{aligned}
\text{loss}_G &= -\log D(x, G(x)) + \lambda \cdot \lVert y - G(x) \rVert_1 \\
\text{loss}_D &= -\log D(x, y) - \log(1 - D(x, G(x)))
\end{aligned}
```

El término L1 estabiliza el entrenamiento y empuja a G hacia el objetivo conocido.$\lambda = 100$fue el default de Pix2Pix.

## CycleGAN  cuando no tienes pares

Pix2Pix necesita emparejados $(x, y)$Los datos. CycleGAN (Zhu et al., 2017) reduce este requisito al costo de una pérdida adicional: la pérdida de *consistencia del ciclo* .$G: X \to Y$y $F: Y \to X$Entrenadlos así .$F(G(x)) \approx x$y $G(F(y)) \approx y$Esto te permite traducir caballos a cebras, verano a invierno, sin ejemplos emparejados.

En 2026, la imagen a imagen sin pareja se realiza principalmente a través de la difusión (ControlNet, IP-Adapter) en lugar de CycleGAN, pero la idea de coherencia de ciclo sobrevive en casi todos los papeles de adaptación de dominio sin pareja.

```figure
gx-patchgan
```

## Construye el mismo

`code/main.py`Implementa una pequeña GAN condicional en los datos 1D.$c$es una etiqueta de clase (0 o 1). La tarea: producir una muestra de la distribución condicional para la clase dada.

### Paso 1: añadir la condición a las entradas G y D

```python
def G(z, c, params):
    return mlp(concat([z, one_hot(c)]), params)

def D(x, c, params):
    return mlp(concat([x, one_hot(c)]), params)
```

El codificación de un solo punto es la forma más simple. Los modelos más grandes utilizan embebedidos aprendidos, modulación FiLM o atención cruzada.

### Paso 2: tren condicional

```python
for step in range(steps):
    x, c = sample_real_conditional()
    noise = sample_noise()
    update_D(x_real=x, x_fake=G(noise, c), c=c)
    update_G(noise, c)
```

El generador debe coincidir con la distribución real *de la condición dada*, no con la marginal.

### Paso 3: verificar la salida por clase

```python
for c in [0, 1]:
    samples = [G(noise, c) for noise in batch]
    mean_c = mean(samples)
    assert_near(mean_c, real_mean_for_class_c)
```

## Las trampas

- **Condition ignored.**G aprende a marginar, D nunca penaliza porque la señal de condición es débil.
- **L1 weight too low.**G se deriva a resultados de aspecto real arbitrario, no fieles.$\lambda \approx 100$para tareas de estilo Pix2Pix.
- **L1 weight too high.**G produce resultados borrosos porque L1 sigue siendo un $L_p$La anel baja una vez que el entrenamiento se estabilice.
- **Ground-truth leakage in D.**Concatenato $(x, y)$como entrada D, no sólo $y$Sin este D no se puede comprobar la consistencia.
- **Mode collapse per class.**Cada clase puede colapsar de forma independiente.

## Usalo

2026 estado de las tareas de imagen a imagen:

| Task | Best approach |
|------|---------------|
| Sketch → photo, same domain, paired data | Pix2Pix / Pix2PixHD (still fast, still sharp) |
| Sketch → photo, unpaired | ControlNet with a Scribble conditioning model |
| Semantic seg → photo | SPADE / GauGAN2 or SD + ControlNet-Seg |
| Style transfer | Diffusion with IP-Adapter or LoRA; GAN methods are legacy |
| Depth → photo | ControlNet-Depth over Stable Diffusion |
| Super-resolution | Real-ESRGAN (GAN), ESRGAN-Plus, or SD-Upscale (diffusion) |
| Colorization | ColTran, diffusion-based colorizers, or Pix2Pix-color |
| Daytime → nighttime, seasons, weather | CycleGAN or ControlNet-based |

Pix2Pix sigue siendo la herramienta correcta cuando (a) tienes miles de ejemplos emparejados, (b) la tarea es estrecha y repetible, y (c) necesitas una inferencia rápida. En tareas genéricas de dominio abierto, la difusión gana.

## Envío

Salva .`outputs/skill-img2img-chooser.md`. La habilidad toma una descripción de tarea, la disponibilidad de datos (pareados vs. sin parejas, muestras N) y el presupuesto de latencia/calidad, luego las salidas: enfoque (Pix2Pix, CycleGAN, variante de ControlNet, SDXL + IP-Adapter), requisitos de datos de capacitación, costo de inferencia y protocolo de evaluación (LPIPS, FID, específico de tarea).

## Los ejercicios

1. **Easy.**Modificar`code/main.py`Confirmar G todavía maps el ruido de cada clase al modo correcto.
2. **Medium.**Reemplazar L1 con una pérdida de estilo perceptivo en el entorno 1-D (por ejemplo, un pequeño D congelado que actúa como extractor de características). ¿Cambia la nitidez de la distribución condicional?
3. **Hard.**Esbozar un CycleGAN en la configuración 1-D: dos distribuciones, dos generadores, pérdida de ciclo. Muestre que aprende a mapear entre ellos sin datos emparejados.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Conditional GAN | "GAN with labels" | G(z, c), D(x, c). Both networks see the condition. |
| Pix2Pix | "Image-to-image GAN" | Paired cGAN with U-Net G and PatchGAN D + L1 loss. |
| U-Net | "Encoder-decoder with skips" | Symmetric conv network; skips preserve high-freq. |
| PatchGAN | "Local-realism classifier" | D outputs per-patch score instead of global score. |
| CycleGAN | "Unpaired image translation" | Two G's + cycle-consistency loss; no paired data. |
| SPADE | "GauGAN" | Normalizes intermediate activations with the semantic map; segmentation-to-image. |
| FiLM | "Feature-wise linear modulation" | Per-feature affine transform from the condition; cheap conditioning. |

## Nota de producción: Pix2Pix como línea de base limitada a la latencia

Cuando se ha emparejado datos y una tarea estrecha (bozo → renderizado, mapa semántico → foto, día → noche), la inferencia de una sola toma de Pix2Pix supera la difusión por un orden de magnitud en la latencia.

| Path | Steps | Typical latency at 512² on a single L4 |
|------|-------|----------------------------------------|
| Pix2Pix (U-Net forward) | 1 | ~30 ms |
| SD-Inpaint or SD-Img2Img | 20 | ~1.2 s |
| SDXL-Turbo Img2Img | 1-4 | ~0.15-0.35 s |
| ControlNet + SDXL base | 20-30 | ~3-5 s |

Pix2Pix gana en el rendimiento en lotes estáticos (cada solicitud es la misma FLOPs). La difusión gana en la calidad y generalización.

## Leer más

- [Mirza & Osindero (2014). Conditional Generative Adversarial Nets](https://arxiv.org/abs/1411.1784) el documento de la CGAN.
- [Isola et al. (2017). Image-to-Image Translation with Conditional Adversarial Networks](https://arxiv.org/abs/1611.07004) Pix2Pix.
- [Zhu et al. (2017). Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks](https://arxiv.org/abs/1703.10593) CycleGAN.
- [Wang et al. (2018). High-Resolution Image Synthesis with Conditional GANs](https://arxiv.org/abs/1711.11585) Pix2PixHD.
- [Park et al. (2019). Semantic Image Synthesis with Spatially-Adaptive Normalization](https://arxiv.org/abs/1903.07291) SPADE / Gaugan.
- [Miyato & Koyama (2018). cGANs with Projection Discriminator](https://arxiv.org/abs/1802.05637) la proyección D.
