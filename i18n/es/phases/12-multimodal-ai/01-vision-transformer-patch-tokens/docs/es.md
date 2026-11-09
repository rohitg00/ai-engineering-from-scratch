# Los transformadores de visión y el primitivo con parche

> Antes de cualquier cosa multimodal, una imagen tiene que convertirse en una secuencia de tokens que un transformador puede comer. El documento ViT 2020 respondió a esto con parches de 16x16 píxeles, una proyección lineal y una inserción de posición. Cinco años después cada modelo fronterizo de 2026 (Claude Opus 4.7 en 2576px nativo, Gemini 3.1 Pro, Qwen3.5-Omni) todavía comienza de esta manera  el codificador cambió de ViT a DINOv2 a SigLIP 2, se agregaron fichas de registro, el esquema posicional se convirtió en 2D-RoPE, pero el primitivo se mantuvo. Esta lección lee la línea de tokens de parches de extremo a extremo y lo construye en stdlib Python para que el resto de la Fase 12 tenga un modelo mental concreto para "tokens visuales".

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, patch tokenizer + geometry calculator)
**Prerequisites:** Phase 7 (Transformers), Phase 4 (Computer Vision)
**Time:** ~120 minutes

## Objetivos de aprendizaje

- Convierta una imagen HxWx3 en una secuencia de tokens de parches con codificación posicional correcta.
- Calcule la longitud de la secuencia, el conteo de parámetros y los FLOP para un ViT de un dato (tamaño de parche, resolución, oscuridad oculta, profundidad).
- Nombre de las tres actualizaciones que llevaron ViT de la investigación de 2020 a la producción de 2026: pre-entrenamiento auto supervisado (DINO / MAE), tokens de registro y embalaje de resolución nativa.
- Elija entre la agrupación CLS, la agrupación media, y registrar tokens para una tarea en el flujo posterior.

## El problema

Los transformadores operan en secuencias de vectores. El texto ya es una secuencia (bytes o tokens). Una imagen es una cuadrícula 2D de píxeles con tres canales de color  no una secuencia. Si se aplanan cada píxel, una imagen RGB 224x224 se convierte en 150.528 tokens, y la autoatención a esa longitud es un no iniciante (cuadrático en longitud de secuencia).

Los enfoques anteriores a 2020 empujaron un extractor de características de CNN en el frente: ResNet produce un mapa de características 7x7 de vectores de 2048 dimensiones, alimenta esos 49 tokens a un transformador. Esto funciona pero hereda los sesgos de CNN (equivalencia de traducción, campos receptivos locales) y pierde el apetito del transformador por la escala.

Dosovitskiy y otros. (2020) hizo la pregunta directa: ¿qué pasa si saltamos la CNN? Dividir la imagen en parches de tamaño fijo (digamos 16x16 píxeles), proyectar linealmente cada parche en un vector, agregar una incorporación posicional y alimentar la secuencia a un transformador de vainilla. En ese momento esto era una visión hereje sin convulsiones. Con suficientes datos (JFT-300M, luego LAION) venció a ResNet en ImageNet y siguió mejorando.

Para 2026, el ViT primitivo es la base indiscutible. la torre de visión de cada VLM de peso abierto es algún descendiente (DINOv2, SigLIP 2, CLIP, EVA, InternViT). La pregunta ya no es "¿deberíamos usar parches?" sino "qué tamaño de parche, qué horario de resolución, qué objetivo de preentrenamiento, qué codificación posicional".

## El concepto

### Los parches como tokens

Dado una imagen `x`de forma`(H, W, 3)`y un tamaño de parche `P`, usted tallar la imagen en una cuadrícula de`(H/P) x (W/P)`Los parches no se superponen.`P x P x 3`Cubo de píxeles. Aplanar cada cubo a un`3 P^2`Aplicar una proyección lineal compartida `W_E`de forma`(3 P^2, D)`para mapear cada parche en la dimensión oculta del modelo `D`¿ Qué ?

Para la configuración canónica de ViT-B/16:
- Resolución 224, tamaño de parche 16 → cuadrícula 14x14 → 196 tokens de parche.
- Cada parche es`16 x 16 x 3 = 768`valores de píxeles, proyectados a `D = 768`¿ Qué ?
- Añadir un aprendizaje `[CLS]`token → longitud de secuencia 197.

La proyección de parche es matemáticamente idéntica a una convolución 2D con tamaño del núcleo `P`, paso .`P`, y `D`Así es como el código de producción lo implementa realmente`nn.Conv2d(3, D, kernel_size=P, stride=P)`. El marco de la proyección lineal es conceptual; el marco del núcleo es eficiente.

### Embedings de posición

Los parches no tienen orden inherente  el transformador los ve como una bolsa. los primeros viTs añadieron una incorporación posicional 1D aprendizable (un vector de 768 dimensiones por posición, 197 de ellos). Funciona, pero vincula el modelo a la resolución de entrenamiento: en la inferencia tienes que interpolar la tabla de posición si cambias la cuadrícula.

Las espinas de visión modernas utilizan 2D-RoPE (M-RoPE de Qwen2-VL, por defecto de SigLIP 2) o posiciones 2D factorizadas. 2D-RoPE gira la consulta y los vectores clave basados en el índice del parche (fila, columna), por lo que el modelo infere la posición 2D relativa desde el ángulo de rotación. No hay tabla de posición. El modelo maneja tamaños de cuadrícula arbitrarios a la inferencia.

### Tokens CLS, salida conjunta y registros

¿Qué es la representación a nivel de imagen? Tres opciones coexisten:

1. `[CLS]`token. prepárate un vector de aprendizaje a la secuencia de parches. Después de todos los bloques transformadores, el estado oculto del token CLS es la representación de imagen. heredada de BERT. utilizada por ViT original, CLIP.
2. Media de los estados ocultos de salida de los tokens de parche, utilizado por SigLIP, DINOv2, la mayoría de los VLM modernos.
3. Las señales de registro. Darcet et al. (2023) observaron que las VTs entrenadas sin un token de fregadero explícito desarrollan parches de "artefactos" de alta norma que secuestran la autoatención.

La elección importa para las tareas en el flujo posterior. CLS es bueno para la clasificación. Para VLMs que alimentan tokens de parches en un LLM, se omite la puesta en común por completo  cada parche se convierte en un token de entrada de LLM. Los registros se desechan antes de la entrega (son andamios, no contenido).

### Preentrenamiento: supervisado, contrastivo, enmascarado, auto-destilado

El ViT 2020 fue preentrenado con clasificación supervisada en JFT-300M. Rápidamente sustituido por:

- CLIP (2021): texto de imagen contrastable en 400M pares. Lección 12.02.
- MAE (2021, He et al.): enmascarar el 75% de los parches, reconstruir los píxeles. Auto supervisado, trabaja en imágenes puras.
- DINO (2021) / DINOv2 (2023): auto-distillación con estudiante-maestro, sin etiquetas, sin encabezados. La DINOv2 ViT-g/14 2023 es la columna vertebral puramente visual más fuerte y el estándar para los casos de uso de "características densas".
- SigLIP / SigLIP 2 (2023, 2025): CLIP con pérdida sigmoide y NaFlex para la relación de aspecto nativa. La torre de visión dominante en 2026 VLM abiertos (Qwen, Idefics2, LLaVA-OneVision).

Su elección de la preparación determina para qué es buena la columna vertebral: CLIP/SigLIP para la combinación semántica con el texto, DINOv2 para características visuales densas, MAE como punto de partida para la regulación de la línea baja.

### Leyes de escala

La escalación de ViT (Zhai et al. 2022) estableció que la calidad de un ViT obedece a leyes predecibles en tamaño de modelo, tamaño de datos y computación.
- Un modelo más grande + más datos → mejor calidad.
- El tamaño del parche es un palanca en la longitud de la secuencia frente a la fidelidad. El parche 14 (típico de DINOv2/SigLIP SO400m) da más tokens por imagen que el parche 16; mejor para las tareas OCR y densas, peor para la velocidad.
- La resolución es la otra gran palanca. Ir de 224 a 384 a 512 casi siempre ayuda, a un costo cuadrático en FLOPs.

ViT-g/14 (1B params, parche 14, resolución 224 → 256 tokens) y SigLIP SO400m/14 (400M params, parche 14) son los dos codificadores de trabajo para 2026 VLM abiertos.

### El número de parámetros para un ViT

El cálculo completo se realiza en`code/main.py`Para ViT-B/16 en el 224:

```
patch_embed = 3 * 16 * 16 * 768 + 768  =  591k
cls + pos    = 768 + 197 * 768          =  152k
block        = 4 * 768^2 (QKVO) + 2 * 4 * 768^2 (MLP) + 2 * 2*768 (LN)
             = 12 * 768^2 + 3k          =  7.1M
12 blocks    = 85M
final LN    = 1.5k
total       ≈ 86M
```

Estajando cada VT de esta manera antes de cargar el punto de control.

### Configuración de producción 2026

El codificador más abierto que VLMs envían en 2026 es SigLIP 2 SO400m/14 en resolución nativa (NaFlex).
- Parámetros de 400M.
- Tamaño de parche 14, resolución predeterminada 384 → 729 parches de tokens por imagen.
- Pozo medio para tareas de nivel de imagen; todos los 729 parches fluyen al LLM para VQA.
- 4 fichas de registro, desechadas antes de la entrega de LLM.
- 2D-RoPE con escalación a nivel de imagen para la relación de aspecto nativa.

Cada decisión en ese archivo remonta a un periódico que puedes leer.

```figure
image-patch-tokens
```

## Usalo

`code/main.py`Es un tokenizador de parches y calculadora de geometría. toma (imagen H, W, parche P, oculto D, profundidad L) y informa:

- Forma de la rejilla y longitud de la secuencia después de la corrección.
- Secuencia de fichas para una imagen de juguete sintética de 8x8 píxeles (caminar por la ruta plana + proyecto).
- El recuento de parámetros se desglosó por inserción de parche, inserción de posición, bloques de transformador y cabeza.
- Los FLOP por paso hacia adelante en la resolución objetivo.
- Una tabla de comparación en ViT-B/16 @ 224, ViT-L/14 @ 336, DINOv2 ViT-g/14 @ 224, SigLIP SO400m/14 @ 384.

Ejecutar. Combinar el parámetro cuenta con los números publicados. Jugar con el tamaño del parche y la resolución para sentir el costo de cuenta de tokens.

## Envío

Esta lección produce`outputs/skill-patch-geometry-reader.md`. Dado una configuración ViT (tamaño de parche, resolución, oscuridad oculta, profundidad), produce un recuento de tokens, recuento de parámetros y estimación VRAM con justificaciones.

## Los ejercicios

1. Calcule la longitud de la secuencia de tokens de parche para Qwen2.5-VL en entrada nativa 1280x720 con tamaño de parche 14. ¿Cómo se compara eso con una representación solo CLS?

2. ¿Cuántos tokens producen un fotograma 1080p (1920x1080) en el parche 14? ¿A 30 FPS en un video de 5 minutos, cuántos tokens visuales totales? ¿Cuál es el costo más ahorrado: pooling, muestreo de fotogramas o fusión de tokens?

3. Implementar el pool medio sobre tokens de parches en Python puro. Verifique que el pool medio sobre 196 tokens de una salida DINOv2 coincide con lo que el modelo `forward`regresa cuando usted pide una incorporación conjunta.

4. Lea la sección 3 de "Los transformadores de visión necesitan registros" (arXiv:2309.16588). Describa en dos frases qué artefacto absorben los registros y por qué es importante para la predicción densa aguas abajo.

5. Modificar`code/main.py`Para soportar el parche-n'-pack: dada una lista de imágenes de diferentes resoluciones, produzca una sola secuencia de paquetes y la máscara de atención de diagonal de bloque.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Patch | "16x16 pixel square" | A fixed-size non-overlapping region of the input image; becomes one token |
| Patch embedding | "Linear projection" | A shared learned matrix (or Conv2d with stride=P) mapping flattened patch pixels to D-dim vectors |
| CLS token | "Class token" | Prepended learnable vector whose final hidden state represents the whole image; optional in 2026 |
| Register token | "Sink token" | Extra learnable tokens that absorb the high-norm attention artifacts ViTs develop during pretraining |
| Position embedding | "Positional info" | Per-position vector or rotation making the sequence-order-aware; 2D-RoPE is the modern default |
| Grid | "Patch grid" | The (H/P) x (W/P) 2D array of patches for a given resolution and patch size |
| NaFlex | "Native flexible resolution" | SigLIP 2 feature: single model serves multiple aspect ratios and resolutions without retraining |
| Backbone | "Vision tower" | The pretrained image encoder whose patch-token outputs feed the LLM in a VLM |
| Pooling | "Image-level summary" | Strategy to turn patch tokens into one vector: CLS, mean, attention pool, or register-based |
| Patch 14 vs 16 | "Finer vs coarser grid" | Patch 14 produces more tokens per image, better fidelity for OCR, slower; patch 16 is the classic default |

## Leer más

- [Dosovitskiy et al. — An Image is Worth 16x16 Words (arXiv:2010.11929)](https://arxiv.org/abs/2010.11929) ViT original.
- [He et al. — Masked Autoencoders Are Scalable Vision Learners (arXiv:2111.06377)](https://arxiv.org/abs/2111.06377) MAE, auto-supervisión de la preparación.
- [Oquab et al. — DINOv2 (arXiv:2304.07193)](https://arxiv.org/abs/2304.07193) Auto-destilación a escala, sin etiquetas.
- [Darcet et al. — Vision Transformers Need Registers (arXiv:2309.16588)](https://arxiv.org/abs/2309.16588) registro de tokens y análisis de artefactos.
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) la torre de visión predeterminada de 2026.
- [Zhai et al. — Scaling Vision Transformers (arXiv:2106.04560)](https://arxiv.org/abs/2106.04560) leyes empíricas de escala.
