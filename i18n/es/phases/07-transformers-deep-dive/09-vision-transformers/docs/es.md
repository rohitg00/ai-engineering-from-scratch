# Transformadores de visión (ViT)

> Una imagen es una cuadrícula de parches. Una oración es una cuadrícula de tokens. El mismo transformador se come a ambos.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 4 · 03 (CNNs), Phase 4 · 14 (Vision Transformers intro)
**Time:** ~45 minutes

## El problema

Antes de 2020, la visión por ordenador significaba convulsiones. Cada SOTA en ImageNet, COCO y puntos de referencia de detección utilizaban una columna vertebral de CNN.

Dosovitskiy et al. (2020)  "Una imagen vale 16x16 palabras"  mostró que se pueden soltar las convulsiones por completo. Cortar una imagen en parches de tamaño fijo, proyectar linealmente cada parche en un embebedido, alimentar la secuencia a un codificador transformador de vainilla. A escala suficiente (ImageNet-21k pre-entrenamiento o mayor), ViT coincide o supera a los modelos basados en ResNet.

ViT fue el comienzo de un patrón más amplio en 2026: una arquitectura, muchas modalidades. Whisper tokeniza el audio. ViT tokeniza las imágenes. Tokens de acción para robótica. Tokens de píxeles para video.

Para 2026, ViT y sus descendientes (DeiT, Swin, DINOv2, ViT-22B, SAM 3) poseen la mayor parte de la visión.

## El concepto

![Image → patches → tokens → transformer](../assets/vit.svg)

### Paso 1  Aplicar

Dividiendo una`H × W × C`imagen en una`N × (P·P·C)`Secuencia de parches planos.`224 × 224`imagen, `16 × 16`parches → 196 parches de 768 valores cada uno.

```
image (224, 224, 3) → 14 × 14 grid of 16x16x3 patches → 196 vectors of length 768
```

El tamaño del parche es la palanca. Parches más pequeños = más tokens, mejor resolución, costo de atención cuadrática. Parches más grandes = más gruesos, más baratos.

### Paso 2  incorporación lineal

Una matriz única aprendida proyecta cada parche plano a `d_model`. Equivalente a una convolución del tamaño del núcleo `P`y paso .`P`En PyTorch esto es literalmente`nn.Conv2d(C, d_model, kernel_size=P, stride=P)` una aplicación de dos líneas.

### Paso 3  Prepend `[CLS]`token, añadir inserciones posicionales

- Prepara un aprendizaje .`[CLS]`Su estado oculto final es la representación de imagen utilizada para la clasificación.
- Añadir embebidos posicionales aprendibles (original ViT) o sinusoidales 2D (variantes posteriores).
- En 2024+ RoPE se amplió a 2D para la posición, a veces sin incorporaciones explícitas.

### Paso 4  codificador estándar de transformador

La pila de bloques de`LayerNorm → Self-Attention → + → LayerNorm → MLP → +`No hay capas específicas de visión. Este es el punto de inflexión pedagógico del documento.

### Paso 5  cabeza

Para su clasificación: tomar `[CLS]`estado oculto → lineal → softmax. para DINOv2 o SAM, descartar `[CLS]`, usar los embebidos de parches directamente.

### Las variantes que importaron

| Model | Year | Change |
|-------|------|--------|
| ViT | 2020 | The original. Fixed patch size, full global attention. |
| DeiT | 2021 | Distillation; trainable on ImageNet-1k only. |
| Swin | 2021 | Hierarchical with shifted windows. Fixed sub-quadratic cost. |
| DINOv2 | 2023 | Self-supervised (no labels). Best general vision features. |
| ViT-22B | 2023 | 22B params; scaling laws apply. |
| SigLIP | 2023 | ViT + language pair, sigmoid contrastive loss. |
| SAM 3 | 2025 | Segment anything; ViT-Large + promptable mask decoder. |

### ¿Por qué tardó un tiempo?

ViT necesita *muchos* datos para coincidir con las CNN porque no tiene ninguno de los sesgos inductivos de CNN (invarianza de traducción, localidad). Sin imágenes etiquetadas >100M o una fuerte pre-entrenamiento auto supervisado, las CNN todavía ganan en la computación coincidente. DeiT lo solucionó en 2021 con trucos de destilación; DINOv2 lo solucionó permanentemente en 2023 con auto-supervisión.

```figure
n5-patch-stream
```

## Construye el mismo

¿ Qué ?`code/main.py`.Pure-stdlib patchify + linear embedding + controles de cordura. No entrenamiento  ViT a cualquier escala realista necesita PyTorch y horas de tiempo de GPU.

### Paso 1: Imagen falsa

Una imagen RGB 24 × 24 como una lista de filas de `(R, G, B)`Usamos 6×6 parches → 16 parches, 108-d incorporando vector cada uno.

### Paso 2: Aparecer

```python
def patchify(image, P):
    H = len(image)
    W = len(image[0])
    patches = []
    for i in range(0, H, P):
        for j in range(0, W, P):
            patch = []
            for di in range(P):
                for dj in range(P):
                    patch.extend(image[i + di][j + dj])
            patches.append(patch)
    return patches
```

Cada VT utiliza este orden.

### Paso 3: incrustado lineal

Multiplica cada parche plano por un aleatorio `(patch_flat_size, d_model)`Matrix. Verifique que la forma de salida es `(N_patches + 1, d_model)`después de la preposición `[CLS]`¿ Qué ?

### Paso 4: Parámetros de conteo para un ViT realista

Imprima el parámetro para ViT-Base: 12 capas, 12 capas, d=768, parche=16. Compara con ResNet-50 (~25M). ViT-Base aterriza en ~86M. ViT-Large ~307M. ViT-Huge ~632M.

## Usalo

```python
from transformers import ViTImageProcessor, ViTModel
import torch
from PIL import Image

processor = ViTImageProcessor.from_pretrained("google/vit-base-patch16-224-in21k")
model = ViTModel.from_pretrained("google/vit-base-patch16-224-in21k")

img = Image.open("cat.jpg")
inputs = processor(img, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, 197, 768): [CLS] + 196 patches
cls_emb = out[:, 0]                       # image representation
```

**DINOv2 embeddings are the 2026 default for image features.**Congelar la columna vertebral, entrenar una cabeza pequeña funciona para la clasificación, recuperación, detección, subtítulos los puntos de control DINOv2 de Meta superan a CLIP en todas las tareas de visión no textual

**Patch-size picking.**Los modelos pequeños usan 16×16 (ViT-B/16). la predicción densa (segmentación) utiliza 8×8 o 14×14 (SAM, DINOv2).

## Envío

¿ Qué ?`outputs/skill-vit-configurator.md`. La habilidad elige una variante de ViT y un tamaño de parche para una nueva tarea de visión dada el tamaño del conjunto de datos, la resolución y el presupuesto de cálculo.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`Verifique el número de parches igual .`(H/P) * (W/P)`y la dimensión del parche plano es igual `P*P*C`¿ Qué ?
2. **Medium.**Implementar inserciones posicionales sinusoidales 2D  dos códigos sinusoidales independientes para `row`y `col`Los alimentamos en un pequeño PyTorch ViT y comparamos la precisión con las incorporaciones posicionales que se pueden aprender en CIFAR-10.
3. **Hard.**Construir un ViT de 3 capas (PyTorch), entrenar en 1.000 imágenes MNIST con parches 4×4. Medir la precisión de la prueba. Ahora añadir DINOv2 pre-entrenamiento en las mismas 1.000 imágenes (simplificado: simplemente entrenar el codificador para predecir los embebidos de parches de parches enmascarados). ¿ Mejora la precisión?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Patch | "The vision-transformer token" | Flat vector of pixel values for a `P × P × C` region of the image. |
| Patchify | "Chop + flatten" | Slice image into non-overlapping patches, flatten each to a vector. |
| `[CLS]` token | "The image summary" | Prepended learnable token; its final embedding is the image representation. |
| Inductive bias | "What the model assumes" | ViT has fewer priors than CNNs; needs more data to make up the gap. |
| DINOv2 | "Self-supervised ViT" | Trained without labels using image augmentation + momentum teacher. Best general image features in 2026. |
| SigLIP | "CLIP's successor" | ViT + text encoder trained with sigmoid contrastive loss; better than CLIP on matched compute. |
| Swin | "Windowed ViT" | Hierarchical ViT with local attention + shifted windows; sub-quadratic. |
| Register tokens | "2023 trick" | A few extra learnable tokens that soak up attention sinks; improves DINOv2 features. |

## Leer más

- [Dosovitskiy et al. (2020). An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale](https://arxiv.org/abs/2010.11929) el papel de ViT.
- [Touvron et al. (2021). Training data-efficient image transformers & distillation through attention](https://arxiv.org/abs/2012.12877) DeiT.
- [Liu et al. (2021). Swin Transformer: Hierarchical Vision Transformer using Shifted Windows](https://arxiv.org/abs/2103.14030)- ¡Swin!
- [Oquab et al. (2023). DINOv2: Learning Robust Visual Features without Supervision](https://arxiv.org/abs/2304.07193)¿Qué es esto?
- [Darcet et al. (2023). Vision Transformers Need Registers](https://arxiv.org/abs/2309.16588) la fijación de la ficha de registro para DINOv2.
