# El estiloGAN

> La mayoría de los generadores se mueven .$z$StyleGAN lo divide en partes: primer mapa$z$a un intermediario $w$, luego * inyectar *$w$Este cambio único desentrañó el espacio latente y hizo que las caras fotorealistas fueran un problema resuelto durante siete años consecutivos.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 03 (GANs), Phase 4 · 08 (Normalization), Phase 3 · 07 (CNNs)
**Time:** ~45 minutes

## El problema

Un mapa de DCGAN $z$a una imagen a través de una pila de convolucciones transpuestas.$z$controlan todo  pose, iluminación, identidad, fondo  entrelazados.$z$No se puede preguntar al modelo "la misma persona, pose diferente" porque la representación no tiene factor de esa manera.

Karras et al. (2019, NVIDIA) propuso: dejar de alimentar $z$En el interior de la superficie, el agua se coloca en una posición constante.`4×4×512`Aprenda una MLP de 8 capas que mapea $z \in Z \to w \in W$Inyectar$w$en cada resolución a través de *adaptive instance normalization* (AdaIN): normaliza cada mapa de características con, luego escala y desplaza por proyecciones afines de $w$. Añadir ruido por capa para detalle estocástico (poros de piel, hebras de cabello).

El resultado:$W$tiene aproximadamente ejes ortogonales para "estilo de alto nivel" (posición, identidad) vs "estilo fino" (iluminación, color).$w$para los niveles de baja resolución y las imágenes B $w$Esta edición desbloqueada, estilización de dominios cruzados y toda la línea de investigación "StyleGAN-inversión".

## El concepto

![StyleGAN: mapping network + AdaIN + per-layer noise](../assets/stylegan.svg)

**Mapping network.** $f: Z \to W$, una MLP de 8 capas.$Z = \mathcal{N}(0, I)^{512}$- ¿ Qué ?$W$No se ve obligado a ser gaussiano. Aprende una forma adaptada a los datos.

**Synthesis network.**Comienza con una constante aprendida .`4×4×512`. Cada bloque de resolución: `upsample → conv → AdaIN(w_i) → noise → conv → AdaIN(w_i) → noise`Resoluciones dobles: 4, 8, 16, 32, 64, 128, 256, 512, 1024.

**AdaIN.**

```math
\mathop{\mathrm{AdaIN}}(x, y) = y_{\text{scale}} \cdot \frac{x - \mathop{\mathrm{mean}}(x)}{\mathop{\mathrm{std}}(x)} + y_{\text{bias}}
```

donde$y_{\text{scale}}$y $y_{\text{bias}}$se derivan de proyecciones afines de $w$Normaliza por mapa de características, luego rediseña. "estilo" aquí es la estadística de primer y segundo orden del mapa de características.

**Per-layer noise.**El ruido gaussiano de un solo canal se añade a cada mapa de características, escalado por un factor por canal aprendido.

**Truncation trick.**En la inferencia, muestra $z$, computación $w = \text{mapping}(z)$, entonces$w' = \hat{w} + \psi \cdot (w - \hat{w})$donde$\hat{w}$es la media$w$en muchas muestras. $\psi < 1$La diversidad es la ventaja de la calidad.$\psi \approx 0.7$¿ Qué ?

## StyleGAN 1 → 2 → 3

| Version | Year | Innovation |
|---------|------|------------|
| StyleGAN | 2019 | Mapping network + AdaIN + noise + progressive growing. |
| StyleGAN2 | 2020 | Weight demodulation replaces AdaIN (fixes droplet artifacts); skip/residual architecture; path-length regularization. |
| StyleGAN3 | 2021 | Alias-free convolution + equivariant kernels; eliminates texture sticking to pixel grid. |
| StyleGAN-XL | 2022 | Class-conditional, 1024², ImageNet. |
| R3GAN | 2024 | Rebrands with stronger reg; closes gap to diffusion on FFHQ-1024 with 20x fewer params. |

En 2026 StyleGAN3 sigue siendo el estándar para (a) fotorrealismo de dominio estrecho con FPS alto, (b) adaptación de dominio de pocos disparos (tren en un nuevo conjunto de datos con 100 imágenes, c) edición basada en la inversión (encuentra el $w$que reconstruye una foto real, luego editar que $w$Para el dominio abierto de texto a imagen, no es la herramienta  difusión es.

```figure
gx-stylegan-mapping
```

## Construye el mismo

`code/main.py`Implementa un juguete "style-GAN lite" en 1-D: una MLP de mapeo, una función de síntesis que toma un vector constante aprendido y lo modula con $w$-desde la escala/bias derivadas y el ruido por capa.$w$por medio de coincidencias de modulación afina o de latidos concatenados $z$en la entrada del generador.

### Paso 1: red de mapeo

```python
def mapping(z, M):
    h = z
    for i in range(num_layers):
        h = leaky_relu(add(matmul(M[f"W{i}"], h), M[f"b{i}"]))
    return h
```

### Paso 2: Normalización de instancia adaptativa

```python
def adain(x, w_scale, w_bias):
    mu = mean(x)
    sd = std(x)
    x_norm = [(xi - mu) / (sd + 1e-8) for xi in x]
    return [w_scale * xi + w_bias for xi in x_norm]
```

La escala y el sesgo de las características del mapa provienen de $w$por medio de la proyección lineal.

### Paso 3: ruido por capa

```python
def add_noise(x, sigma, rng):
    return [xi + sigma * rng.gauss(0, 1) for xi in x]
```

Sigma por canal es aprendizaje.

## Las trampas

- **Droplet artifacts.**StyleGAN 1 produjo una gota de manchas en los mapas de características porque AdaIN eliminó el promedio.
- **Texture sticking.**Las texturas de StyleGAN 1 y 2 siguieron las coordenadas de píxel, no las coordenadas de objeto (visibles cuando se interpola).
- **Mode coverage.**Truncado `ψ < 0.7`se ve limpio pero muestras de un cono estrecho; uso `ψ = 1.0`Si necesitas diversidad.
- **Inversion is lossy.**Invertir una foto real en$W$Se realiza generalmente a través de la optimización o un codificador (e4e, ReStyle, HyperStyle).

## Usalo

| Use case | Approach |
|----------|----------|
| Photoreal human faces (anime, product, narrow) | StyleGAN3 FFHQ / custom fine-tune |
| Face editing from a photo | e4e inversion + StyleSpace / InterFaceGAN directions |
| Face swap / reenactment | StyleGAN + encoder + blending |
| Avatar pipelines | StyleGAN3 w/ ADA for low-data fine-tune |
| Domain adaptation from a few images | Freeze mapping network, fine-tune synthesis |
| Multi-modal or text-conditioned generation | Don't — use diffusion |

Para las demostraciones de calidad de producto donde la respuesta es "foto de la cara de una persona", StyleGAN supera la difusión en el costo de inferencia (pasado a la derecha, <10 ms en un 4090) y la nitidez para la misma barra de calidad.

## Envío

Salva .`outputs/skill-stylegan-inversion.md`. Skill toma una foto real y las salidas: método de inversión (e4e / ReStyle / HyperStyle), pérdida latente esperada, presupuesto de edición (cuánto tiempo en $W$se puede mover antes de los artefactos), y una lista de conocidas buenas direcciones de edición (edad, expresión, postura).

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`con`adain_on=True`y `adain_on=False`Comparar la dispersión de las salidas de un latente fijo con el latente perturbado.
2. **Medium.**Implementar la regularización de mezcla: para un lote de formación, calcular $w_a$¿ Qué ?$w_b$, y se aplican $w_a$para la primera mitad de la síntesis y $w_b$¿El decodificador aprende estilos desentrañados?
3. **Hard.**Tome un modelo de FFHQ (ffhq-1024.pkl) de StyleGAN3 pre-entrenado.$w$Dirección que controla la "smile" mediante la formación de un SVM en muestras etiquetadas; informe hasta dónde puede avanzar antes de que la identidad se desvíe.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mapping network | "The MLP" | $f: Z \to W$, 8 layers, decouples latent geometry from data statistics. |
| W space | "The style space" | Output of the mapping network; roughly disentangled. |
| AdaIN | "Adaptive instance norm" | Normalize feature map, then scale + shift by $w$-projection. |
| Truncation trick | "Psi" | $w = \text{mean} + \psi \cdot (w - \text{mean})$, $\psi<1$ trades diversity for quality. |
| Path-length regularization | "PL reg" | Penalizes large changes in image per unit change in $w$; makes $W$ smoother. |
| Weight demodulation | "The StyleGAN2 fix" | Normalize conv weights instead of activations; kills droplet artifacts. |
| Alias-free | "StyleGAN3's trick" | Windowed sinc filters; eliminates texture sticking to the pixel grid. |
| Inversion | "Find w for a real image" | Optimize or encode $x \to w$ so $G(w) \approx x$. |

## Nota de producción: por qué StyleGAN todavía se envíe en 2026

StyleGAN3 en una 4090 genera una cara de 10242 FFHQ en menos de 10 ms  `num_steps = 1`En términos de producción esta es la latencia de suelo para cualquier generador de imagen. Un tubo de decodificación SDXL + VAE de 50 pasos con la misma resolución es de ~ 3 segundos.**300× gap**, y para productos de dominio estrecho (servicios de avatares, tuberías de documentos de identificación, generación de caras de stock) gana en TCO.

Dos consecuencias operativas:

- **No scheduler, no batcher.**El lote estático en la ocupación objetivo es óptimo. El lote continuo (esencial para los LLM y la difusión) proporciona cero beneficio porque cada solicitud tiene los mismos FLOPs.
- **Truncation `ψ` is the safety knob.** `ψ < 0.7`En el caso de las muestras de una zona de distribución de la red de mapeo, el nivel de distribución de la muestra es el más bajo.`ψ`en la carga máxima, elevarla para usuarios premium.

## Leer más

- [Karras et al. (2019). A Style-Based Generator Architecture for GANs](https://arxiv.org/abs/1812.04948) StyleGAN.
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) StyleGAN2.
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) StyleGAN3.
- [Tov et al. (2021). Designing an Encoder for StyleGAN Image Manipulation](https://arxiv.org/abs/2102.02766) inversión e4e.
- [Sauer et al. (2022). StyleGAN-XL: Scaling StyleGAN to Large Diverse Datasets](https://arxiv.org/abs/2202.00273) StyleGAN-XL.
- [Huang et al. (2024). R3GAN: The GAN is dead; long live the GAN!](https://arxiv.org/abs/2501.05441) receta moderna de GAN mínimo.
