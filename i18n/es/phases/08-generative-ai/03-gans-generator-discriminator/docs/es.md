# GANs  Generador vs Discriminador

> El truco de Goodfellow en 2014 fue saltar la densidad por completo. Dos redes. Una hace falsificaciones. Una las captura. Luchan hasta que las falsificaciones son indistinguibles de las reales. No debería funcionar. A menudo no funciona. Cuando lo hace, las muestras siguen siendo las más nítidas de la literatura para dominios estrechos.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 08 (Optimizers), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## El problema

Los VAEs producen muestras borrosas porque su pérdida de decodificador MSE es Bayes-óptima para la imagen * media *  y la media de muchos dígitos plausibles es un dígito borroso. Quieres una pérdida que recompensen * plausibilidad*, no la proximidad de un objetivo en forma de píxel. No hay forma cerrada para la plausibilidad. Tienes que aprenderlo.

La idea de Goodfellow: entrenar un clasificador $D(x)$Para distinguir imágenes reales de falsas.$G(z)$para engañar .$D$. La señal de pérdida para $G$¿ Qué es lo que sea ?$D$Ahora, la señal se actualiza como$G$Mejoras, perseguir un objetivo en movimiento.$G$ha aprendido la distribución de datos sin escribirlo nunca.`log p(x)`¿ Qué ?

Esto es entrenamiento adversario.

```math
\min_G \max_D \; \mathbb{E}_{\text{real}}[\log D(x)] + \mathbb{E}_{\text{fake}}[\log(1 - D(G(z)))]
```

En 2026 los GAN ya no son el generador de SOTA (la difusión y el flujo de coincidencia comieron esa corona). Pero StyleGAN 2/3 sigue siendo los modelos de cara más afilados jamás enviados, los discriminadores GAN se utilizan como *perdidas perceptuales* en el entrenamiento de difusión, y el entrenamiento adversario potencia las destilaciones rápidas de 1 paso (SDXL-Turbo, SD3-Turbo, LCM) que le permiten enviar difusión en tiempo real.

## El concepto

![GAN training: generator and discriminator in minimax](../assets/gan.svg)

**Generator $G(z)$.**Mapas de un vector de ruido $z \sim \mathcal{N}(0, I)$a una muestra $\hat{x}$Una red en forma de decodificador (contenido o transpuesto).

**Discriminator $D(x)$.**Mapas de una muestra a una probabilidad escalar (o puntaje). Real → 1, falso → 0.

**Loss.**Dos actualizaciones alternativas:

- **Train $D$:** $\text{loss}_D = -[ \log D(x) + \log(1 - D(G(z))) ]$Entropia binaria cruzada en real=1, falso=0.
- **Train $G$:** $\text{loss}_G = -\log D(G(z))$Esta es la forma no saturante utilizada por Goodfellow (original)$\log(1 - D(G(z)))$saturado y mata los gradientes cuando $D$es seguro).

**Training loop.**Un paso de $D$, un paso de $G$Repito.

**Why it works.**Si ...$G$Se ajusta perfectamente .$p_{\text{data}}$, entonces$D$No puede hacer mejor que el azar y las salidas 0.5 en todas partes; $G$No tiene más gradiente.

**Why it breaks.**Collapso de modo ($G$encuentra un modo $D$No puedo clasificarlo y lo acuñar para siempre), desvanecimiento de gradiente ($D$Aprende demasiado rápido y $\log D$El programa de formación de los jóvenes de edad avanzada (SET) se ha desarrollado en el ámbito de la formación.

## Variantes que hicieron que funcionaran las GAN

| Year | Innovation | Fix |
|------|------------|-----|
| 2015 | DCGAN | Conv/deconv, batch norm, LeakyReLU — the first stable architecture. |
| 2017 | WGAN, WGAN-GP | Replace BCE with Wasserstein distance + gradient penalty. Fixes vanishing gradient. |
| 2017 | Spectral normalization | Lipschitz-bound the discriminator. Still used in 2026 discriminators. |
| 2018 | Progressive GAN | Train low-res first, add layers. First megapixel results. |
| 2019 | StyleGAN / StyleGAN2 | Mapping network + adaptive instance norm. State of the art for fixed-domain photorealism. |
| 2021 | StyleGAN3 | Alias-free, translation-equivariant — still the face gold standard in 2026. |
| 2022 | StyleGAN-XL | Conditional, class-aware, larger scale. |
| 2024 | R3GAN | Rebrands with stronger regularization; works on 1024² without tricks. |

```figure
gan-minimax
```

## Construye el mismo

`code/main.py`El generador y el discriminador son MLP de capa única oculta. Implementamos el bucle hacia adelante, hacia atrás y el bucle minimax a mano. El objetivo es ver los dos modos de falla clave (collaps de modo + gradiente de desaparición) a medida que suceden.

### Paso 1: pérdida no saturante

La pérdida de la vainilla Goodfellow .$\log(1 - D(G(z)))$se eleva a 0 cuando D clasifica el falso de G como falso con alta confianza. En ese punto el gradiente para G es básicamente cero  G no puede mejorar.$-\log D(G(z))$tiene la asintoto opuesta: explota cuando D está seguro, dando a G una señal fuerte.

```python
def g_loss(d_fake):
    # maximize log D(G(z))  <=>  minimize -log D(G(z))
    return -sum(math.log(max(p, 1e-8)) for p in d_fake) / len(d_fake)
```

### Paso 2: un paso discriminador por paso generador

```python
for step in range(steps):
    # train D
    real_batch = sample_real(batch_size)
    fake_batch = [G(z) for z in sample_noise(batch_size)]
    update_D(real_batch, fake_batch)

    # train G
    fake_batch = [G(z) for z in sample_noise(batch_size)]  # fresh fakes
    update_G(fake_batch)
```

Falsas frescas para G, de lo contrario los gradientes son obsoletos.

### Paso 3: vigila el colapso del modo

```python
if step % 200 == 0:
    samples = [G(z) for z in sample_noise(500)]
    mode_a = sum(1 for s in samples if s < 0)
    mode_b = 500 - mode_a
    if min(mode_a, mode_b) < 50:
        print("  [!] mode collapse: one mode is starved")
```

El síntoma canónico: uno de los dos modos reales deja de generarse. El discriminador deja de corregirlo porque nunca se ve como falso.

## Las trampas

- **Discriminator too strong.**Reducir la velocidad de aprendizaje de D en 2-5 veces, o añadir ruido de instancia/camada. Si D alcanza una precisión del 95%, G está muerto.
- **Generator memorizes a mode.**Añadir ruido a las entradas D, utilizar una capa de miniparcelación o cambiar a WGAN-GP.
- **Batch norm leaking statistics.**Los datos de la serie de datos de la serie de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos de datos
- **Inception-score gaming.**FID y IS son ruidosos en el recuento de muestras bajo.
- **One-shot sampling is a lie for conditional tasks.**Todavía necesitas escalas CFG, trucos de truncado y re-muestreo para obtener resultados útiles.

## Usalo

La pila de GAN 2026:

| Situation | Pick |
|-----------|------|
| Photoreal human faces, fixed pose | StyleGAN3 (sharpest, smallest) |
| Anime / stylized faces | StyleGAN-XL or Stable Diffusion LoRA |
| Image-to-image translation | Pix2Pix / CycleGAN (Phase 8 · 04) or ControlNet (Phase 8 · 08) |
| Fast 1-step text-to-image | Adversarial distillation of diffusion (SDXL-Turbo, SD3-Turbo) |
| Perceptual loss inside a diffusion trainer | Small GAN discriminator on image crops |
| Anything multi-modal, open-ended | Don't — use diffusion or flow matching |

Las GAN son agudas pero estrechas. Una vez que su dominio se abre  fotos, se le solicita texto arbitrario, el video  cambia a difusión.

## Envío

Salva .`outputs/skill-gan-debugger.md`. Skill toma una ejecución GAN fallida (curvas de pérdida, red de muestra, tamaño del conjunto de datos) y produce una lista clasificada de causas probables, correcciones de una línea y un protocolo de repetición.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`con las configuraciones de acciones.`D_LR = 5 * G_LR`¿A qué velocidad se derrumba la pérdida de G a una constante?
2. **Medium.**Substituir la pérdida de Goodfellow BCE por la pérdida de WGAN: $\text{loss}_D = \mathbb{E}[D(\text{fake})] - \mathbb{E}[D(\text{real})]$¿ Qué ?$\text{loss}_G = -\mathbb{E}[D(\text{fake})]$, y clip de D los pesos a `[-0.01, 0.01]`¿El entrenamiento es más estable?
3. **Hard.**Extenda el ejemplo de 1D a datos 2D (mezcla de 8 Gaussians en un anillo). Rastrear cuántos de los 8 modos que el generador captura en los pasos 1k, 5k, 10k. Implementar la discriminación de minipartidos y volver a medir.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Generator | "G" | Noise-to-sample network, `G: z → x̂`. |
| Discriminator | "D" | Classifier `D: x → [0, 1]`, real vs fake. |
| Minimax | "The game" | $\min_G \max_D$ of a joint objective. |
| Non-saturating loss | "The fix" | Use $-\log D(G(z))$ for G instead of $\log(1 - D(G(z)))$. |
| Mode collapse | "G memorized one thing" | Generator produces few distinct outputs despite diverse data. |
| WGAN | "Wasserstein" | Replace BCE with Earth-Mover distance + gradient penalty; smoother gradient. |
| Spectral norm | "Lipschitz trick" | Constrain D's weight norms to bound its slope; stabilizes training. |
| StyleGAN | "The one that works" | Mapping network + AdaIN; best-in-class for faces, still in 2026. |

## Nota de producción: la inferencia de una sola toma es la ventaja duradera de GAN

Los GAN ya no ganan en la calidad de la muestra para la generación de dominio abierto, pero todavía ganan en el costo de inferencia.

- **No prefill, no decode stages.**Un solo .$G(z)$TTFT ≈ latencia total.
- **No KV-cache pressure.**El tamaño del lote está limitado por la memoria de activación, no por el caché.
- **Trivial continuous batching.**Como cada solicitud requiere los mismos FLOPs fijos, un lote estático en la ocupación de destino del servidor es generalmente óptimo.

Esta es la razón por la que la destilación de GAN (SDXL-Turbo, SD3-Turbo, ADD, LCM) es la técnica dominante para el texto rápido a la imagen en 2026: se desmorona un tubo de difusión de 20-50 pasos en pases hacia adelante de 1-4 GAN al tiempo que se mantiene la distribución de una base de difusión.

## Leer más

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) el papel original de la GAN.
- [Radford et al. (2015). Unsupervised Representation Learning with DCGAN](https://arxiv.org/abs/1511.06434) la primera arquitectura estable.
- [Arjovsky, Chintala, Bottou (2017). Wasserstein GAN](https://arxiv.org/abs/1701.07875) WGAN.
- [Miyato et al. (2018). Spectral Normalization for GANs](https://arxiv.org/abs/1802.05957) SN.
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) StyleGAN2.
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) StyleGAN3.
- [Sauer et al. (2023). Adversarial Diffusion Distillation](https://arxiv.org/abs/2311.17042) SDXL-Turbo.
