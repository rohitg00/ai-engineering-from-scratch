# Modelos unificados de muestra y difusión discreta

> La transfusión mezcla representaciones continuas y discretas. Show-o (Xie et al., agosto 2024) va en el otro sentido: los tokens de texto utilizan la predicción causal del siguiente token, los tokens de imagen utilizan la difusión discreta enmascarada en el espíritu de MaskGIT. Ambos se sientan dentro de un transformador con una máscara híbrida de atención. El resultado unifica VQA, texto a imagen, inpainting y generación de modalidad mixta en una columna vertebral, un tokenizer por modalidad, una formulación de pérdida (se extiende el siguiente token a la predicción enmascarada). Esta lección recorre el diseño Show-o  por qué la difusión discreta enmascarada es un generador de imágenes paralelo y de pocos pasos  y contrasta con Transfusión y Emu3.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, masked-discrete-diffusion sampler)
**Prerequisites:** Phase 12 · 13 (Transfusion)
**Time:** ~120 minutes

## Objetivos de aprendizaje

- Explica la difusión discreta enmascarada: el calendario que enmascara los tokens de forma uniforme luego pide al transformador que los recupere.
- Compare la descodificación de imágenes paralelas (Show-o, MaskGIT) con la descodificación de imágenes autoregresivas (Chameleon, Emu3) en velocidad y calidad.
- Nombre de las cuatro tareas que se realizan en un solo punto de control: generación de texto, VQA, T2I, pintura de imágenes.
- Seleccione un calendario de enmascaramiento (cosino, lineal, truncado) y razone su efecto sobre la calidad de la muestra.

## El problema

La pérdida de difusión continua vive en una escala numérica diferente a la pérdida discreta de NTP.

La respuesta de Show-o: mantener ambas modalidades discretas (como Chameleon), pero generar imágenes en paralelo a través de difusión discreta enmascarada en lugar de secuencialmente.

## El concepto

### Difusión discreta enmascarada (MaskGIT)

El truco original de Chang et al. (2022) MaskGIT es elegante.`<MASK>`En cada paso, predecir todos los tokens enmascarados en paralelo, luego mantener las predicciones más seguras de K y volver a enmascarar el resto. Después de ~ 8-16 iteraciones, todos los tokens se llenan.

La formación es simple: muestra una proporción de enmascaramiento uniformemente desde [0, 1], aplica a los tokens VQ de la imagen, entrena al transformador para recuperar los enmascarados.

### Show-o: un transformador, máscara híbrida

El show-o pone MaskGIT dentro de un transformador de modelo de lenguaje causal.

- Los tokens de texto: causal (MLL estándar).
- Tokens de imagen: bidireccionales completos dentro del bloque de imagen (para que los tokens enmascarados puedan ver todos los otros tokens de imagen durante la predicción).
- Texto a imagen: el texto se ajusta a las imágenes anteriores, la imagen se ajusta al texto anterior.

Los cursos de formación alternativos entre:
1. NTP estándar en secuencias de texto.
2. Muestras de T2I: texto → imagen con tokens de imagen enmascarados, pérdida de predicción de tokens enmascarados.
3. Muestras de VQA: imagen → texto con tokens de texto enmascarados (en realidad sólo NTP).

La pérdida unificada es la entropía cruzada en `<MASK>`tokens, que cubre tanto el NTP de texto (solo el último token está "mascarado") como la difusión de imágenes enmascarada (un subconjunto aleatorio está enmascarado).

### Muestreo paralelo

Show-o genera una imagen en ~16 pasos en lugar de ~1000 (autoregresivas por token) o ~20 (difusión).

Comparar:
- Cameleón / Emu3 (autoregresividad sobre tokens): N_tokens pasa hacia adelante, típicamente 1024-4096 por imagen.
- Transfusión (difusión continua): ~20 pasos, cada uno con un transformer completo.
- Show-o (difusión discreta enmascarada): ~16 pasos, cada uno con un transformer completo.

Show-o es más rápido que el Chameleon en modelos de escala similar, coincide aproximadamente con el recuento de pasos de Transfusión con un menor costo por paso (logitas de vocabulario discreta vs pérdida continua de MSE).

### tareas en un solo puesto de control

Show-o admite cuatro tareas en la inferencia, seleccionadas por formato de respuesta rápida:

- Generación de texto: salida de texto autoregresista estándar.
- VQA: imagen en, mensaje de texto.
- T2I: entrada de texto, salida de imagen a través de difusión discreta enmascarada.
- Inpintado: imagen con algunos tokens enmascarados, rellenar.

La capacidad de pintura viene de forma gratuita de la formación de predicción enmascarada. Enmascarar una región de la cuadrícula de tokens VQ, alimentar el resto más un mensaje de texto, predecir los tokens enmascarados.

### Programa de enmascaramiento

El calendario de cuántos tokens desmascarar por paso forma la calidad.

```math
\text{mask\_ratio}(t) = \cos\left(\frac{\pi t}{2T}\right) \qquad t = 0, \ldots, T
```

En el paso 0, todos los tokens enmascarados (ratio 1.0).$T$Los horarios lineales también funcionan pero se colocan más rápidamente.

### El programa de trabajo

Show-o2 (2025 seguimiento, arXiv 2506.15564) escalas Show-o: mayor base de LLM, mejor tokenizer, mejor cronograma de máscara.

### Donde se sienta Show-o

En la taxonomía de 2026:

- Tokens discretos + NTP: camaleón, Emu3.
- Tokens discretos + difusión enmascarada: Show-o, MaskGIT, LlamaGen, Muse. Muestreo paralelo, todavía perdida por el tokenizer.
- Transfusión continua + difusión: Transfusión, MMDiT, DiT. La formación de mayor calidad y más compleja.
- Aparición continua + flujo en un VLM: JanusFlow, InternVL-U. Más reciente.

Seleccionar por tarea: Show-o cuando se quiere T2I + inpainting + VQA en un modelo abierto con una velocidad razonable; Transfusión cuando la calidad es primordial y se puede pagar la plomería de dos pérdidas.

```figure
masked-diffusion-unmask
```

## Usalo

`code/main.py`simula la muestreo de muestra:

- Una cuadrícula de juguetes de 16 tokens VQ.
- Un falso "transformador" que predice logits basándose en un prompt y los tokens actualmente desmascarados.
- Muestreo enmascarado paralelo en 8 pasos con horario cosino.
- Imprime los estados intermedios (evolución de patrones de máscara) y los tokens finales.

Echa un vistazo a la máscara disolverse paso a paso.

## Envío

Esta lección produce`outputs/skill-unified-gen-model-picker.md`. Dado un producto que necesita tanto comprensión (VQA, subtítulos) como generación (T2I, inpainting) con una restricción de peso abierto, escoge entre la familia Show-o, la familia Transfusion/MMDiT y la familia Emu3/Chameleon con compensaciones concretas.

## Los ejercicios

1. ¿Por qué no 1? ¿Qué se rompe si desmascaras todo en el paso 0?

2. La pintura es libre con difusión enmascarada. Propón un caso de uso del producto (real o hipotético) en el que la pintura de Show-o supera a un modelo especializado.

3. Calendario cosino vs calendario lineal: rastrear el número de tokens desmascarados por paso para T=8. ¿Cuál es más equilibrado?

4. Una imagen de 512x512 muestra 1024 tokens.$K=16384$, el modelo emite $1024 \cdot \log_2(16384) = 14{,}336$Los bits (~ 1,75 KiB) de datos. La difusión estable de 512*512*24 bits = 6,291,456 bits (~ 768 KiB) de píxeles crudos. ¿Cuál es la relación de compresión y qué calidad compra?

5. ¿En qué se diferencia el modelo de imagen autorregresista con condiciones de clase de LlamaGen del enfoque enmascarado de Show-o?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Masked discrete diffusion | "MaskGIT-style" | Training to predict masked tokens; at inference, iteratively unmask the most-confident predictions |
| Cosine schedule | "Unmask schedule" | Decay of mask ratio over inference steps; concentrates confidence growth at mid-range |
| Parallel decoding | "All tokens at once" | Every step predicts the full sequence of masked tokens in one forward pass, then commits top-K |
| Hybrid attention | "Causal + bidirectional" | Mask that is causal over text tokens and bidirectional within image blocks |
| Inpainting | "Fill-in generation" | Condition on an image with some tokens masked, predict the missing ones; free from the training objective |
| Commitment rate | "Top-K per step" | How many tokens are declared "done" per iteration; controls inference vs quality trade-off |

## Leer más

- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
- [Show-o2 (arXiv:2506.15564)](https://arxiv.org/abs/2506.15564)
- [Chang et al. — MaskGIT (arXiv:2202.04200)](https://arxiv.org/abs/2202.04200)
- [Sun et al. — LlamaGen (arXiv:2406.06525)](https://arxiv.org/abs/2406.06525)
- [Chang et al. — Muse (arXiv:2301.00704)](https://arxiv.org/abs/2301.00704)
