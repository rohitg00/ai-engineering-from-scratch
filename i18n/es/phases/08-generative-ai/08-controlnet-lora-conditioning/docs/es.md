# ControlNet, LoRA y acondicionamiento

> El texto solo es una señal de control torpe. ControlNet le permite clonar un modelo de difusión preentrenado y dirigirlo con un mapa de profundidad, esqueleto de pose, escrutinio o imagen de borde. LoRA le permite ajustar un modelo de parámetro 2B mediante el entrenamiento de 10 millones de parámetros. Juntos convirtieron a la difusión estable de un juguete en la tubería de imágenes 2026 que se envía a cada agencia.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 10 (LLMs from Scratch — for LoRA foundation)
**Time:** ~75 minutes

## El problema

Un mensaje como "una mujer con un vestido rojo caminando con un perro en una calle concurrida" no le da al modelo información sobre *dónde* está el perro, *qué postura* está la mujer en, o *la perspectiva* de la calle.

El entrenamiento de un nuevo modelo condicional desde cero para cada señal (posición, profundidad, ingenioso, segmentación) es prohibitivo.

También quieres enseñar al modelo nuevos conceptos (tu rostro, tu producto, tu estilo) sin volver a entrenar al modelo completo. Quieres un delta 100 veces más pequeño.

ControlNet + LoRA + texto = el kit de herramientas del profesional 2026 La mayoría de las tuberías de imágenes de producción tienen 2-5 LoRA, 1-3 ControlNets y un adaptador IP encima de una base SDXL / SD3 / Flux.

## El concepto

![ControlNet clones the encoder; LoRA adds low-rank deltas](../assets/controlnet-lora.svg)

### ControlNet (Zhang et al., 2023)

*Clon* la mitad de codificador de la U-Net. Congela el original. Entren el clon para aceptar una entrada de condicionamiento adicional (borda, profundidad, pose). Conecte al clon de nuevo al decodificador de la mitad del original con *convolución cero* conexiones saltadas (1×1 convs inicializados a cero  comienzan como no-op, aprende un delta).

```
SD U-Net decoder:   ... ← orig_enc_features + zero_conv(controlnet_enc(condition))
```

El tren en 1M (prompto, condición, imagen) se triplica con la pérdida de difusión estándar.

ControlNets por modalidad se envían como modelos secundarios pequeños (~ 360 M para SDXL, ~ 70 M para SD 1.5).

```
features += weight_a * control_a(depth) + weight_b * control_b(pose)
```

### Los Estados miembros pueden adoptar medidas de seguridad en el marco de la aplicación de la presente Directiva.

Para cualquier capa lineal $W \in \mathbb{R}^{d \times d}$en el modelo, congelación $W$y añadir un delta de bajo rango:

```math
W' = W + \Delta W, \quad \Delta W = B A, \quad A \in \mathbb{R}^{r \times d}, \quad B \in \mathbb{R}^{d \times r}
```

con$r \ll d$.Rango 4-16 es estándar para la atención, rango 64-128 para las tonas finas pesadas.$2 \cdot d \cdot r$en lugar de$d^2$. para la atención de SDXL con $d=640$¿ Qué ?$r=16$Por ejemplo, el modelo de la base de 5GB es de 20-200 MB.

En la inferencia se puede escalar la LoRA: $W' = W + \alpha \cdot B A$- ¿ Qué ?$\alpha = 0.5\text{-}1.5$Los LRA múltiples se apilan de forma aditiva (con la advertencia habitual de que interactúan de manera no lineal).

### Adaptador IP (Ye et al., 2023)

Un pequeño adaptador que acepta una *imagen* como condicionamiento (junto con texto). Utiliza el codificador de imagen CLIP para producir tokens de imagen, inyectándolos en atención cruzada junto con tokens de texto. ~ 20 MB por modelo base. Permite "generar una imagen en el estilo de esta referencia" sin un LoRA.

## Matriz de composibilidad

| Tool | What it controls | Size | When to use |
|------|------------------|------|-------------|
| ControlNet | Spatial structure (pose, depth, edges) | 70-360MB | Exact layout, composition |
| LoRA | Style, subject, concept | 20-200MB | Personalization, style |
| IP-Adapter | Style or subject from reference image | 20MB | No text can describe the look |
| Textual Inversion | Single concept as a new token | 10KB | Legacy, mostly replaced by LoRA |
| DreamBooth | Full fine-tune on a subject | 2-5GB | Strong identity, high compute |
| T2I-Adapter | Lighter ControlNet alternative | 70MB | Edge devices, inference budget |

ControlNet es espacial, LoRA es semántico, usa ambas cosas.

```figure
v4-controlnet-zero
```

## Construye el mismo

`code/main.py`simula los dos mecanismos en 1-D:

1. **LoRA.**Una capa lineal preentrenada .$W$- Congelarlo. Entrenar a un bajo rango.$BA$Es así .$W + BA$coincide con una capa lineal objetivo. Muestre que$r = 1$es suficiente para aprender una corrección de rango 1 perfectamente.

2. **ControlNet-lite.**Un predictor de "base congelada" y una "red lateral" que lee una señal adicional. La salida de la red lateral está bloqueada por un escalar aprendizaje inicializado a cero (nuestra versión de cero-conv). Entren y vigila la rampa de la puerta hacia arriba.

### Paso 1: Matemáticas de la LORA

```python
def lora(W, A, B, x, alpha=1.0):
    # W is frozen; A, B are the trainable low-rank factors.
    return [W[i][j] * x[j] for i, j in ...] + alpha * (B @ (A @ x))
```

### Paso 2: red lateral de inicio cero

```python
side_out = control_net(x, condition)
gated = gate * side_out  # gate initialized to 0
h = base(x) + gated
```

En el paso 0 la salida es idéntica a la base.`gate`lentamente, sin una deriva catastrófica.

## Las trampas

- **Over-scaling LoRAs.** $\alpha = 2$o $\alpha = 3$es un hack común "hacerlo más fuerte" que produce resultados demasiado estilizados / rotos.$\alpha \le 1.5$¿ Qué ?
- **ControlNet weight conflict.**Usar una Pose ControlNet con peso 1.0 y una Depth ControlNet con peso 1.0 generalmente se sobrepone.
- **LoRA on the wrong base.**Los SDXL LoRA no se operan en silencio en SD 1.5 porque las dimensiones de atención no coinciden.
- **Textual Inversion drift.**Los tokens entrenados en un puesto de control se desplazan mal en otro.
- **LoRA weight-merging and storage.**Puedes hornear un LoRA en los pesos del modelo base para inferir más rápido (sin adición de tiempo de ejecución), pero pierdes la capacidad de escalar $\alpha$Mantenga ambas versiones.

## Usalo

| Goal | 2026 pipeline |
|------|---------------|
| Reproduce a brand's art style | LoRA trained on ~30 curated images at rank 32 |
| Put my face in a generated image | DreamBooth or LoRA + IP-Adapter-FaceID |
| Specific pose + prompt | ControlNet-Openpose + SDXL + text |
| Depth-aware composition | ControlNet-Depth + SD3 |
| Reference + prompt | IP-Adapter + text |
| Exact layout | ControlNet-Scribble or ControlNet-Canny |
| Background replace | ControlNet-Seg + Inpainting (Lesson 09) |
| Fast 1-step style | LCM-LoRA on SDXL-Turbo |

## Envío

Salva .`outputs/skill-sd-toolkit-composer.md`. La habilidad toma una tarea (activos de entrada: instantáneo, imagen de referencia opcional, pose opcional, profundidad opcional, escríbalo opcional) y saca la pila de herramientas, pesos y un protocolo de semilla reproducible.

## Los ejercicios

1. **Easy.**En el`code/main.py`, varían el rango de la LoRA `r`¿En qué rango el LoRA coincide exactamente con un delta objetivo de rango 2?
2. **Medium.**Entrenar dos LoRAs separadas en dos transformaciones de objetivo. cargarlos juntos y mostrar su interacción aditiva. ¿Cuándo la interacción rompe la linealidad?
3. **Hard.**Utilice difusores para apilar: SDXL-base + Canny-ControlNet (peso 0,8) + un estilo LoRA ($\alpha$0.8) + IP-Adapter (peso 0.6). Medir el compromiso entre FID y adhesión inmediata a medida que los pesos de la pila varían.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| ControlNet | "Spatial control" | Cloned encoder + zero-conv skips; reads a conditioning image. |
| Zero convolution | "Starts as identity" | 1×1 conv initialized to zero; ControlNet starts as no-op. |
| LoRA | "Low-rank adapter" | $W + BA$, $r \ll d$; 100x fewer params than a full fine-tune. |
| rank r | "The knob" | LoRA compression; 4-16 typical, 64+ for heavy personalization. |
| $\alpha$ | "LoRA strength" | Runtime scaling of the LoRA delta. |
| IP-Adapter | "Reference image" | Small image-conditioning adapter via CLIP-image tokens. |
| DreamBooth | "Full subject fine-tune" | Train the full model on ~30 images of a subject. |
| Textual Inversion | "New token" | Learn a new word embedding only; legacy, mostly replaced. |

## Nota de producción: intercambios de la LRA, carriles de ControlNet, servicio para varios inquilinos

Un SaaS de texto a imagen real sirve a cientos de LoRA y una docena de ControlNets en el mismo punto de control base. El problema de servicio se parece mucho a la LLM multi-tenancy (la literatura de producción cubre el caso de LLM bajo lotes continuos y LoRAX / S-LoRA):

- **Hot-swap LoRAs, do not merge.**Fusión$W' = W + \alpha \cdot B \cdot A$en la base da ~ 3-5% más rápido por paso de inferencia pero se congela $\alpha$Mantenga los LRA calientes en VRAM como deltas de rango; los difusores exponen`pipe.load_lora_weights()`¿ Qué es eso ?`pipe.set_adapters([...], adapter_weights=[...])`El costo de cambio es el `2 · d · r · num_layers`Peso  en escala de MB, subsegundo.
- **ControlNet as a second attention lane.**El codificador clonado funciona en paralelo con la base. Dos ControlNets con peso 1.0 cada uno = dos pases adicionales hacia adelante por paso, no un pasado fusionado. El tamaño del batch se reduce cuadráticamente. Presupuesto para ~ 1.5 × costo de paso por ControlNet activo.
- **Quantized LoRAs too.**Si cuantificó la base (ver Lección 07, Flux en 8GB), el delta LoRA también cuantifica limpiamente a 8 bits o 4 bits.

Flux-specific: la notebook de Niels Flux-on-8GB cuantifica la base a 4 bits; apilar un estilo LoRA (`pipe.load_lora_weights("user/style-lora")`) en esa base cuantificada en `weight_name="pytorch_lora_weights.safetensors"`Esta es la receta que la mayoría de las agencias SaaS envían en 2026.

## Leer más

- [Zhang, Rao, Agrawala (2023). Adding Conditional Control to Text-to-Image Diffusion Models](https://arxiv.org/abs/2302.05543) ControlNet.
- [Hu et al. (2021). LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) LoRA (originalmente para LLM; puertos de difusión).
- [Ye et al. (2023). IP-Adapter: Text Compatible Image Prompt Adapter](https://arxiv.org/abs/2308.06721) Adaptador IP.
- [Mou et al. (2023). T2I-Adapter: Learning Adapters to Dig Out More Controllable Ability](https://arxiv.org/abs/2302.08453) alternativa más ligera a ControlNet.
- [Ruiz et al. (2023). DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation](https://arxiv.org/abs/2208.12242) DreamBooth.
- [HuggingFace Diffusers — ControlNet / LoRA / IP-Adapter docs](https://huggingface.co/docs/diffusers/training/controlnet) tuberías de referencia.
