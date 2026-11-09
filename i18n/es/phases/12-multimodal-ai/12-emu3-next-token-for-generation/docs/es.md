# Emu3: Predección de la próxima generación de imágenes y videos

> El Emu3 de BAAI (Wang et al., septiembre 2024) es el resultado de 2024 que debería haber terminado el debate difusión-versus-autorregressiva. Un único transformador de decodificación solo de estilo Llama, entrenado solo en el objetivo de predicción de tokens siguientes, a través de un vocabulario unificado de tokens de texto + VQ de imagen + 3D VQ de vídeo, supera a SDXL en generación de imágenes y LLaVA-1.6 en percepción. No hay pérdida de CLIP. No hay horario de difusión. La orientación sin clasificador se utiliza para inferir la calidad, pero el objetivo principal de la formación es la predicción de la próxima señal con la fuerza del profesor. Publicado en Nature. Esta lección lee la tesis Emu3  por qué un mejor tokenizer más escala es todo lo que necesita  y contrasta con los enfoques de difusión.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, 3D video tokenizer math + autoregressive sampler skeleton)
**Prerequisites:** Phase 12 · 11 (Chameleon)
**Time:** ~120 minutes

## Objetivos de aprendizaje

- Explica por qué el objetivo de tokens de una sola pérdida de Emu3 funciona a pesar de la suposición de hace mucho tiempo de que la difusión es necesaria para la calidad de la imagen.
- Describa el tokenizer de vídeo 3D: cómo se ve un libro de código VQ espacial-temporal, por qué los parches duran tiempo.
- Comparar Emu3 vs. Estable Diffusion XL en (computación de entrenamiento, costo de inferencia, límite de calidad).
- Nombre de los tres roles que el mismo modelo Emu3 juega: Emu3-Gen (gen de imagen), Emu3-Chat (percepción), Emu3-Stage2 (gen de vídeo).

## El problema

La sabiduría convencional hasta 2024: la generación de imágenes necesita difusión. El argumento: los tokens de imagen discretos pierden demasiada información para reconstruir detalles, y el muestreo autoregresista acumula error en miles de tokens. Estable Diffusion, DALL- E 3, Imagen, Midjourney todos utilizan alguna forma de difusión. Chameleon (Lección 12.11) refutó parcialmente esto a pequeña escala, pero no coincidió con SDXL en calidad.

Emu3 atacó el argumento de frente. La afirmación: mejor tokenizer visual + escala suficiente + pérdida de token siguiente = generación de imagen de difusión en el mismo modelo que también hace percepción.

La apuesta fue controvertida cuando se publicó. Dos años después, la familia de generación unificada de código abierto (Emu3, Show-o, Janus-Pro, Transfusion) es el camino predeterminado para la investigación; los modelos de producción fronteriza parecen usar alguna variante.

## El concepto

### El tokenizador Emu3

El ingrediente clave es el tokenizer visual. Emu3 entrena un tokenizer personalizado de clase IBQ (Quantizer de cuello de botella inverso, familia SBER-MoVQGAN) a 8x8 de reducción de resolución por token. Una imagen de 512x512 se convierte en 64x64 = 4096 tokens en el tamaño del libro de código 32768.

Esto es más grande que los 1024 tokens de Chameleon por 512x512 en K=8192 en ambos ejes: cuatro veces los tokens y un libro de códigos cuatro veces más grande. La capacidad extra compra calidad de reconstrucción. La métrica clave: reconstrucción PSNR a 30,5 dB, competitiva con el espacio latente continuo de Stable Diffusion a 32 dB.

Para el vídeo: un tokenizer VQ 3D codifica un parche espacio-temporal (4 cuadros x 8x8 píxeles) a un número entero. Un clip 4s a 8 FPS tiene 32 cuadros; en 256x256 con 8x reducción espacial y 4x temporal, el recuento de tokens es (256/8) * (256/8) * (32/4) = 32 * 32 * 8 = 8.192 tokens.

La calidad del tokenizer es el techo. La contribución de Emu3 es en parte "entrenamos a un muy buen tokenizer".

### Formación de pérdida única

Emu3 utiliza un objetivo: predicción de tokens siguientes en un vocabulario compartido entre tokens de texto, tokens de imagen 2D y tokens de video 3D. Los pesos se multiplican por factores específicos de la modalidad durante el entrenamiento para equilibrar la contribución, pero la función de pérdida es idéntica.

El tren en una mezcla de:
- Género de imagen: `<text caption> <image> image_tokens </image>`
- Percepción de imagen: `<image> image_tokens </image> <question> text_tokens`
- Gen de vídeo: `<text caption> <video> video_tokens </video>`
- Percepción de vídeo: análogo.
- Sólo texto: NTP estándar.

El modelo aprende cuándo emitir tokens de imagen frente a tokens de texto a partir de la distribución de datos.`<image>`- ¿Qué?

### Orientación y temperatura sin clasificador

La generación de imágenes autoregresivas mejora mucho con la orientación sin clasificador (CFG) en la inferencia. Emu3 la utiliza: genera dos veces, una vez con la leyenda completa, una vez con una leyenda vacía, mezcla los logits con un peso de la guía (típico 3.0-7.0).

La temperatura es importante: demasiado alta, artefactos; demasiado baja, colapso de modo. La temperatura recomendada de Emu3 es de 1,0 para la percepción, 0,8 para la generación de imágenes.

### Tres papeles, un modelo

Emu3 como tres API funcionalmente distintas pero un conjunto de pesas subyacente:

- Emu3 Gen. Generación de imágenes.
- Emu3-Chat. VQA y subtítulos. Imagen de entrada (tokens), texto de salida.
- Emu3-Etapia2. Generación de vídeo y VQA de vídeo. Ingreso de texto o vídeo, salida de texto o vídeo.

No hay cabezas específicas de tareas, solo plantillas de instrucciones diferentes, el mismo punto de control.

### Indicadores de referencia

De la publicación de Emu3 (septiembre 2024):

- Generación de imágenes: supera a SDXL en MJHQ-30K FID (5.4 vs 5.6), GenEval en general (0.54 vs 0.55  empate estadístico), y el compuesto de Deep-Eval en par.
- Percepción de imagen: sigue a LLaVA-1.6 en VQAv2 (75.1 vs 81.8) y MMMU (31.6 vs 35.1), pero lo supera en SEED-Bench, OCRBench y ChartQA.
- Generación de vídeo: calidad de 4 segundos en FVD competitivo con modelos de la era Sora comparados públicamente.

Los números no siempre están ganando  Emu3 negocia un punto aquí por un punto allí  pero la afirmación "la predicción de la próxima ficha es todo lo que necesitas" es defendible a través de las modalidades.

### Costo de cálculo

Emu3 es un modelo de parámetro 8B. El documento no publica un total de horas de GPU; para la escala, el preentrenamiento de Llama-2-7B utilizó aproximadamente 184k A100 horas de GPU, aproximadamente 21 años de GPU.

En la inferencia, Emu3 es más lento que SDXL por imagen: 4096 tokens de imagen a 30 tok/s es ~2 minutos por imagen 512x512 , frente a 2-5 segundos para SDXL. La descifrado especulativo y la optimización de KV-cache estrechan la brecha pero no la cierran.

### Por qué importa

La contribución profunda de Emu3 es conceptual. Si la predicción de los tokens siguientes se adapta a la difusión en la generación de imágenes, el camino del modelo unificado (una pérdida, una columna vertebral, cualquier modalidad) es viable. Los modelos futuros no necesitan codificadores de texto separados, cronólogos de difusión separados, VAEs separados. Un transformador, un tokenizer por modalidad, escala.

Show-o, Janus-Pro y InternVL-U se basan o desafían a esta tesis. Los laboratorios chinos (BAAI, DeepSeek) publican más agresivamente en esta dirección que los laboratorios estadounidenses hasta 2025.

```figure
l5-emu3-next-token
```

## Usalo

`code/main.py`construye dos piezas de juguete:

- Una calculadora de recuento de tokenizaje VQ 2D vs 3D: dada (resolución, parche, longitud de clip, FPS), cuenta los tokens de cálculo para imagen vs video.
- Un muestreo autoregresor de marcas de imagen con orientación sin clasificador a temperatura.

La implementación del CFG coincide con la receta de Emu3  mezclar logits condicionales e incondicionales con un peso de orientación.

## Envío

Esta lección produce`outputs/skill-token-gen-cost-analyzer.md`. Dado un producto de generación especificación (imagen o vídeo, resolución objetivo, nivel de calidad, presupuesto de latencia), se calcula el recuento de tokens, el costo de inferencia, y elige Emu3 familia vs difusión.

## Los ejercicios

1. Emu3 produce 4096 tokens por 512x512 imagen a una reducción de 8x8.

2. Lea la sección 3.3 de Emu3 en el tokenizer de vídeo. Describa la forma del parche VQ 3D y por qué se extiende a 4 cuadros x 8x8 píxeles en lugar de un solo cuadro.

3. Peso de orientación libre de clasificadores 5.0 vs 3.0: ¿qué efecto visual?`code/main.py`¿ Qué ?

4. Computa los FLOP de formación para Emu3 (8B) a un token de 300B y compara con la Diffusión estable 3. ¿Cuál fue más caro de entrenar?

5. Emu3 supera a SDXL en FID pero no en VQAv2 vs VLM especializados. Explique por qué el enfoque de pérdida unificada muestra diferentes fortalezas vs especialistas en diferentes puntos de referencia.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Next-token prediction | "NTP" | Standard autoregressive loss: predict token[i+1] given token[0..i]; works for every modality when tokenized |
| IBQ tokenizer | "Inverse bottleneck quantizer" | A class of VQ-VAE with larger codebooks (32768+) and better reconstruction than Chameleon's |
| 3D VQ | "Spatiotemporal quantizer" | Codebook indexed by (time, row, col); one token covers 4 frames x 8x8 pixels |
| Classifier-free guidance | "CFG" | Mix conditional and unconditional logits with weight gamma; boosts image quality at inference |
| Unified vocabulary | "Shared tokens" | Text + image + video all draw from the same integer space; model predicts whichever modality comes next |
| MJHQ-30K | "Image gen benchmark" | Midjourney-quality benchmark with 30k prompts; Emu3 reports FID here |

## Leer más

- [Wang et al. — Emu3: Next-Token Prediction is All You Need (arXiv:2409.18869)](https://arxiv.org/abs/2409.18869)
- [Sun et al. — Emu: Generative Pretraining in Multimodality (arXiv:2307.05222)](https://arxiv.org/abs/2307.05222)
- [Liu et al. — LWM (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Yu et al. — MAGVIT-v2 (arXiv:2310.05737)](https://arxiv.org/abs/2310.05737)
- [Tian et al. — VAR (arXiv:2404.02905)](https://arxiv.org/abs/2404.02905)
