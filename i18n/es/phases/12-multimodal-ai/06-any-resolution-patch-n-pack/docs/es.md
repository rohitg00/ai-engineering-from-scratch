# Visión de cualquier resolución: Patch-n'-Pack y NaFlex

> Las imágenes reales no son 224x224 cuadrados. Un recibo es 1:3, un gráfico es 16:9, un escaneo médico puede ser 4096x4096, una captura de pantalla móvil es 9:19.5. La respuesta VLM pre-2024  redimensionar todo a un cuadrado fijo  arrojó la señal que hace que OCR, comprensión de documentos y análisis de escena de alta resolución trabajen. NaViT (Google, 2023) mostró que se pueden empacar parches de resolución variable en un solo lote de transformador con enmascaramiento de diagonal de bloque. El M-RoPE (2024) de Qwen2-VL dejó caer por completo las tablas de posiciones absolutas. AnyRes de LLaVA-NeXT ha convertido imágenes de alta resolución en una base + subimágenes. La variante NaFlex de SigLIP 2 (2025) es ahora el codificador predeterminado para VLM abiertos que quieren un solo punto de control para servir a cada relación de aspecto. Esta lección implementa el parche de un paquete de extremo a extremo.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, patch packer + block-diagonal mask)
**Prerequisites:** Phase 12 · 01 (ViT patches), Phase 12 · 05 (LLaVA)
**Time:** ~120 minutes

## Objetivos de aprendizaje

- Envuelve los parches de un lote de imágenes de resolución variable en una secuencia y construye la máscara de atención de bloque diagonal.
- Escoge entre los azulejos AnyRes (LLaVA-NeXT), NaFlex (SigLIP 2) y M-RoPE (Qwen2-VL) para una tarea determinada.
- Computa los presupuestos de tokens para OCR, gráficos y fotografía sin cambiar de tamaño.
- Nombre de los tres modos de fracaso de la talla cuadrada: texto aplastado, contenido recortado, tokens desperdiciados en relleno.

## El problema

Los transformadores esperan una secuencia. Un lote es una pila de secuencias de la misma longitud. Si sus imágenes son 224x224, obtienes 196 tokens de parches cada vez, no se requiere relleno, el trabajo hecho. Entrenamiento en 224, inferir en 224, nunca más pensar en resolución.

El mundo no coopera. Los documentos son retratos (8,5x11 pulgadas, 2:3). Las capturas de pantalla de gráfico son paisajes (16:9). Los recibos son altos y delgados (1:3).

Tres opciones previas a 2024 y por qué cada una falla:

1. El squish distorsiona el texto y las caras. La escala baja destruye las etiquetas de gráficos y el contenido de OCR. Práctica estándar hasta LLaVA-1.5.
2. Se tira la mayor parte de la imagen, y elegir la ubicación de la cosecha es su propio problema de visión.
3. El pad al lado más largo. Corre la distorsión pero desperdicia más del 50% de los tokens en el relleno para imágenes de retrato.

La respuesta 2024-2025: dejar que el transformador coma parches en la resolución nativa de la imagen, y averiguar cómo empacar un lote heterogéneo en una secuencia sin perder la computación.

## El concepto

### NaViT y el paquete de parches

NaViT (Dehghani et al., 2023) fue el documento que mostró que esto funciona a escala.

1. Para cada imagen del lote, calcular su cuadrícula de parches nativos en un tamaño de parche elegido (digamos 14).
2. Aplanar los parches de cada imagen en su propia secuencia de longitud variable.
3. Concaten todos los parches de las imágenes en una larga secuencia para el lote.
4. Construye una máscara de atención de diagonal de bloque para que los parches de la imagen A sólo estén presentes dentro de la imagen A.
5. Tenga en cuenta la información de posición por parche (2D RoPE o inserciones de posición fraccionaria).

Un lote de tres imágenes en 336x336 (576 tokens), 224x224 (256 tokens) y 448x336 (768 tokens) se convierte en una secuencia de 1600 tokens con una máscara de diagonal de bloques 1600x1600.

NaViT también introdujo la caída de parches fraccionadas durante el entrenamiento  caída de 50% de parches al azar en todo el lote  que regulariza y acelera el entrenamiento. SigLIP 2 heredó esto.

### En el caso de los productos de la industria de la industria de la industria de la producción, el valor de la producción de los productos de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la producción se calcula en el punto 1.

La alternativa más práctica es AnyRes de LLaVA-NeXT. Dado una imagen de alta resolución y un codificador fijo (CLIP o SigLIP en 336), la imagen se conforma con un mosaico:

1. Seleccione un diseño de cuadrícula de un conjunto predefinido  (1x1), (1x2), (2x1), (1x3), (3x1), (2x2), etc.  que mejor se adapte a la relación de aspecto de la imagen.
2. Tela la imagen completa en la cuadrícula; cada mosaico se convierte en un cultivo de 336x336.
3. También produce una miniatura: toda la imagen se ha redimensionado a 336x336 como un token de contexto global.
4. Encifre cada mosaico a través del codificador congelado 336. Concaten los tokens de mosaico + los tokens de miniatura.

Para una imagen 672x672 en una cuadrícula 2x2 más miniatura: 4 * 576 + 576 = 2880 tokens visuales.

AnyRes es la ruta de elección cuando su codificador está congelado y sólo admite una resolución. Explosa el recuento de tokens para imágenes grandes (una imagen de 1344x1344 en una cuadrícula 4x4 es de 9216 + 576 ≈ 9800 tokens, que sobrepasa un contexto de LLM de 8k antes de que llegue cualquier texto).

### El valor de la carga de carga de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la industria de la Unión

Qwen2-VL introdujo el embebimiento de posición rotativa multimodal. En lugar de las posiciones fraccionarias de NaViT o el mosaico y miniatura de AnyRes, cada parche tiene una posición 3D (temporal, altura, ancho).

M-RoPE envía una resolución dinámica nativa sin reentrenamiento. En la inferencia de que se alimenta cualquier imagen HxW, el embebedador de parches produce tokens H/14 x W/14, cada token obtiene su posición (t=0, r=row, c=col), RoPE gira la atención con las frecuencias correctas, hecho. Qwen2.5-VL y Qwen3-VL continúan esto.

A diferencia de AnyRes, el M-RoPE es $O(H \times W / P^2)$No hay cargas generales multiplicativas. a diferencia de NaViT, todavía espera una sola imagen por adelantado.

### NaFlex (SigLIP 2)

NaFlex es el modo nativo de la señal de control SigLIP 2. Un modelo único sirve a múltiples longitudes de secuencia (256, 729, 1024 tokens) en la inferencia. Internamente utiliza parches de estilo NaViT durante el entrenamiento y posiciones fraccionarias absolutas por parche.

Para una tarea semántica (clasificación, recuperación), 256 tokens. Para OCR o comprensión de gráficos, 1024 tokens. No hay reentrenamiento.

### La máscara de empaque

La máscara de diagonal de bloque es donde la mayoría de las implementaciones tropiezan.`N_total`que cubren las imágenes `i=0..B-1`con longitud `n_i`, la máscara`M`de forma`(N_total, N_total)`es 1 si ambos índices caen en el mismo bloque de la imagen, o 0.

```
offsets = [0, n_0, n_0+n_1, ..., N_total]
M[i, j] = 1 iff there exists b where offsets[b] <= i < offsets[b+1] and offsets[b] <= j < offsets[b+1]
```

Esta es una línea en PyTorch con `torch.block_diag`El camino de longitud variable de FlashAttention (`cu_seqlens`) se salta de la máscara por completo y se realiza en secuencias utilizando el tensor de longitud acumulada directamente  ~ 10 veces más rápido que una máscara densa para lotes típicos.

### Presupuestos de tokens

Elige tu estrategia por tarea:

- OCR / documentos: 1024-4096 tokens. SigLIP 2 NaFlex en 1024, o AnyRes 3x3 + miniatura.
- Gráficos y interfaz de usuario: 729-1024 tokens en 384-448 nativo. Resolución dinámica Qwen2.5VL con tapa máxima de píxeles.
- Las fotos naturales: 256-576 tokens está bien. El LLM en aguas abajo ve suficiente. Pague por tokens donde la densidad de contenido es alta.
- Video: 64-128 tokens por fotograma después de la agrupación espacial, 2-8 FPS.

La regla de producción 2026: escoger una tapa de pixel máximo por tarea, codificar en proporción de aspecto nativa hasta esa tapa, empacar el lote y saltar relleno.`min_pixels`y `max_pixels`para exactamente este botón.

```figure
mm-patch-n-pack
```

## Usalo

`code/main.py`Implementa el paquete de parches para un lote heterogéneo de imágenes con coordenadas de píxeles enteros.

- Toma una lista de tamaños de imagen (H, W).
- Computa la longitud de la secuencia de parches de cada imagen en el tamaño de parche 14.
- Los empaque en una secuencia de longitud total .`sum(n_i)`¿ Qué ?
- Construye la máscara de atención de bloque diagonal (densa, para mayor claridad).
- Compara el coste de empaquetado con el tamaño cuadrado y el mosaico de AnyRes.
- Imprime una tabla de presupuesto simbólica para un lote mixto (recibo, gráfico, captura de pantalla, foto).

Los números que se caen son la razón por la que cada VLM abierto 2026 usa parches.

## Envío

Esta lección produce`outputs/skill-resolution-budget-planner.md`. Dado una carga de trabajo de relación de aspecto mixta (OCR, gráficos, fotos, fotogramas de video) y un presupuesto total de tokens, elige la estrategia correcta (NaFlex, AnyRes, M-RoPE o cuadrado fijo) y emite una configuración por solicitud.

## Los ejercicios

1. Un recibo es 600x1500 (1:2.5). En el tamaño de parche 14, ¿cuántos tokens de resolución nativa? ¿Cuántos después de cuadrar a 336? ¿Cuál pierde más precisión OCR en la práctica?

2. Construye la máscara de diagonal de bloque para un lote de cuatro imágenes con longitudes 256, 576, 729, 1024.`256^2 + 576^2 + 729^2 + 1024^2`entradas no cero.

3. Para una imagen 1792x896 en el parche 14, compare: (a) cuadrado-dimensionar a 336 y luego codificar, (b) AnyRes 2x1 + miniatura, (c) M-RoPE en nativo. ¿Cuál utiliza menos tokens? ¿Cuál conserva más detalles?

4. Implemente la caída de parches fraccionados: dada una secuencia de paquetes, deje caer el 50% de los tokens de forma uniforme al azar, y actualice la máscara de diagonal de bloque en consecuencia.

5. Leer la sección 3.2 del documento Qwen2-VL (arXiv:2409.12191).`min_pixels`y `max_pixels`control y por qué ambas fronteras importan.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Patch-n'-pack | "NaViT-style packing" | Concatenate variable-length patch sequences from different images into one batch dimension |
| Block-diagonal mask | "Packing mask" | Attention mask that confines each image's patches to attend only to themselves, not neighbors in the pack |
| AnyRes | "LLaVA-NeXT tiling" | Split a high-res image into a grid of fixed-size tiles plus a global thumbnail; encode every tile with a fixed encoder |
| NaFlex | "SigLIP 2 native-flex" | Single SigLIP 2 checkpoint that serves 256/729/1024-token budgets at inference without retraining |
| M-RoPE | "Multimodal RoPE" | 3D rotary position encoding (time, row, column) that handles arbitrary H, W, T without position tables |
| cu_seqlens | "FlashAttention packing" | Cumulative-length tensor the FlashAttention varlen path uses instead of a dense block-diagonal mask |
| min_pixels / max_pixels | "Resolution bounds" | Qwen2.5-VL per-request knobs capping token count on very small or very large inputs |
| Visual token budget | "How many tokens per image" | Rough count of patch tokens emitted per image; sets the LLM's prompt budget and attention cost |

## Leer más

- [Dehghani et al. — Patch n' Pack: NaViT (arXiv:2307.06304)](https://arxiv.org/abs/2307.06304)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Laurençon et al. — What matters when building vision-language models? (Idefics2, arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
