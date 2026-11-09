# Transfusión: texto autoregresivamente + imagen de difusión en un transformador

> Cameleon y Emu3 apostaron todo en tokens discretos. Funcionan, pero el cuello de botella de cuantificación es visible  las mesetas de calidad de imagen debajo de los modelos de difusión en el espacio continuo. La transfusión (Meta, Zhou et al., agosto 2024) toma la apuesta opuesta: mantener las imágenes continuas, dejar caer el VQ-VAE por completo y entrenar a un transformador con dos pérdidas. Los tokens de texto obtienen la predicción de los próximos tokens. Los parches de imagen obtienen una pérdida de flujo de coincidencia / difusión. Ambos objetivos optimizan los mismos pesos. La arquitectura subyacente a la Stable Diffusion 3 (MMDiT) es una prima cercana. Esta lección lee la tesis de Transfusión, construye un entrenador de juguete de dos pérdidas y rastrea la máscara de atención que permite a un transformador hacer ambos trabajos.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, two-loss trainer on MNIST-scale toy)
**Prerequisites:** Phase 12 · 11 (Chameleon), Phase 8 (Generative AI)
**Time:** ~180 minutes

## Objetivos de aprendizaje

- Envía un transformador que ejecuta dos pérdidas (NTP en tokens de texto, MSE de difusión en parches de imagen) en una columna vertebral.
- Explica por qué la atención bidireccional entre parches de imagen más la atención causal sobre tokens de texto es la elección correcta de máscara.
- Comparar el estilo Transfusión (imágenes continuas, pérdida de difusión) con el estilo Chameleon (imágenes discretas, NTP) en computación, calidad y complejidad de código.
- Nombre de la contribución de MMDiT: pesas específicas de modalidad en cada bloque, atención conjunta en el flujo residual.

## El problema

El debate entre los tokens de imagen discretos y continuos es más antiguo que los LLM. Las representaciones continuas (pixeles crudos, VAE latente) conservan el detalle.

Caméleo / Emu3 fue discreto: una pérdida, una arquitectura, pero la fidelidad de la imagen se limitó por la calidad del tokenizer.

Los modelos de difusión fueron continuos: calidad de imagen excepcional, pero un modelo separado del LLM, ingeniería compleja de horarios de ruido y ninguna integración limpia con la generación de texto.

La transfusión pregunta: ¿podemos tener ambas? Mantener las imágenes continuas, seguir entrenando un modelo, usar dos pérdidas cosidas en un paso de gradiente.

## El concepto

### La arquitectura de dos pérdidas

Un único transformador de decodificación sólo procesa una secuencia que contiene:

- Tokens de texto (discreto, de la vocabla BPE).
- Parches de imagen (continua, bloques de píxeles 16x16 proyectados en oscuridad oculta a través de la incorporación lineal  igual que la entrada de un codificador ViT).
- `<image>`y `</image>`etiquetas que marcan donde viven los parches continuos.

El pase delantero se ejecuta una vez. La pérdida elige una de dos cabezas por token:

- Para los tokens de texto: entropía cruzada estándar en la cabeza de los logitos de vocabulario.
- Para parches de imagen: pérdida de difusión en parches continuos  predecir el ruido que se añadió a cada parche.

El gradiente fluye a través del cuerpo del transformador compartido. Ambas pérdidas mejoran los pesos compartidos simultáneamente.

### Máscara de atención: texto causal + imagen bidireccional

Los tokens de texto deben ser causales  no se puede dejar que un token de texto atenda a un texto futuro, o que el profesor obligue a los descansos.

La máscara:

```
M[i, j] = 1 if:
  (i is text and j is text and j <= i)   # causal for text
  OR (i is image and j is image and same_image_block(i, j))   # bidirectional within image
  OR (i is text and j is image and j < i)   # text attends to images that closed before it
  OR (i is image and j is text and j < i_image_start)   # image attends to preceding text
```

Implementado como una máscara triangular en el entrenamiento y la inferencia.

### Perdida de difusión dentro del transformador

La pérdida de difusión es estándar: añadir ruido a un parche de imagen, pedir al modelo que predica el ruido (o el parche limpio, equivalentemente).

Durante la formación:
1. Para cada parche de imagen $x_0$, muestra un paso de tiempo aleatorio $t$¿ Qué ?
2. Muestra de ruido$\epsilon$, computación $x_t = (1-t) \cdot x_0 + t \cdot \epsilon$(interpolación lineal para el coincidencia de flujo).
3. El transformador predice .$v_\theta(x_t, t)$¿ Qué es ?$\text{loss} = \mathop{\mathrm{MSE}}(v_\theta(x_t, t), \epsilon - x_0)$¿ Qué ?
4. La retroprop junto con el texto NTP pérdidas de la misma secuencia.

En la inferencia, la generación es:
- Tokens de texto: muestreo autorregresor estándar.
- Parches de imagen: bucle de muestreo de difusión (10-30 pasos típicos) condicionado a los tokens de texto anteriores.

### MMDiT: Variante de la difusión estable 3

Estable Diffusion 3 (Esser et al., marzo 2024) envió MMDiT (Transformador de Diffusión Multimodal) aproximadamente al mismo tiempo que Transfusión.

Las diferencias clave del MMDiT:

- Peso específico de modalidad por bloque. Cada bloque de transformador tiene pesos separados Q, K, V y MLP para tokens de texto frente a parches de imagen.
- Una variante específica de flujo de coincidencia con muestreo conocido y matemáticas más simples que DDPM.
- Escala. MMDiT es la columna vertebral de SD3 (2B y 8B variantes param).

Ambos convergen en la misma idea central: un transformador ejecuta NTP en texto y difusión en representaciones continuas de imágenes.

### ¿Por qué esto es mejor que el estilo del camaleón?

La brecha de calidad entre la difusión continua y la NTP discreta en la generación de imágenes es medible.

- En parámetros 7B, supera un modelo de estilo camaleón del mismo tamaño en FID en 3-5 puntos.
- No se requiere entrenamiento de tokenizer  el codificador de imagen es más simple (proyección lineal a oculta, igual que la capa de entrada de un ViT).
- La inferencia puede paralelalizar la denotación de parches de imagen, a diferencia de los tokens de imagen autoregresivos.

Desventaja: La transfusión es un modelo de doble pérdida, lo que hace que la dinámica de entrenamiento sea más complicada. Los pesos de pérdida necesitan ajuste.

### Lo que se encuentra río abajo

Janus-Pro (lección 12.15) perfecciona la idea de Transfusion descoplando el codificador de visión para la comprensión y generación  SigLIP para uno, VQ para el otro  mientras comparte el cuerpo del transformador. Show-o (lección 12.14) cambia la difusión por difusión discreta (predicción enmascarada).

Los modelos de producción cerrados que emiten imágenes nativamente pueden usar algunos descendientes de esta familia, pero sus arquitecturas no se publican, por lo que trate cualquier afirmación como una suposición.

```figure
cfg-guidance-scale
```

## Usalo

`code/main.py`construye un juguete Transfusión sobre un pequeño problema similar a MNIST:

- Las capciones de texto son secuencias cortas de números enteros que describen un dígito (0-9).
- Las imágenes son redes de 4x4 bytes.
- Un par de proyecciones lineales de peso compartido actúa como el reemplazo del transformador; pérdida de NTP en texto, pérdida de MSE en parches ruidosos.
- El bucle de entrenamiento alterna las dos pérdidas, la máscara de atención es explícita.
- Una demostración de máscara imprime el patrón de atención triangular de bloque para un texto, imagen, secuencia de texto. La generación no se ejecuta: un muestreo real decodificaría el token de texto por token, luego denotaba los parches de imagen en muchos pasos, como los ejercicios a continuación cuentan.

El transformador es un juguete, la tubería de dos pérdidas, la construcción de la máscara de atención y el bucle de inferencia son los artefactos reales.

## Envío

Esta lección produce`outputs/skill-two-loss-trainer-designer.md`. Dado una nueva tarea de formación multimodal (texto + imagen, texto + audio, texto + video), diseña el calendario de dos pérdidas (peso de pérdida, forma de máscara, bloques compartidos vs. específicos de modalidad) y señala los riesgos de implementación.

## Los ejercicios

1. Un modelo de estilo Transfusion entraña 70% de tokens de texto y 30% de parches de imagen. La pérdida de difusión de imagen es ~10 veces la pérdida de NTP de texto en magnitud. ¿Qué pesos de pérdida los equilibran?

2. Implementar la máscara triangular de bloque para una secuencia: `[T, T, <image>, P, P, P, P, </image>, T]`Marque cada entrada 0 o 1.

3. MMDiT tiene pesos de QKV específicos para modalidad. ¿Qué parámetros cuenta por encima añade esto vs Transfusion's transformador totalmente compartido?

4. Generación: dado un mensaje de texto, el modelo ejecuta NTP para 50 tokens, luego golpea `<image>`, luego ejecuta difusión en 256 parches en 20 pasos denoise. ¿Cuántos pasos adelante en total?

5. Leer el documento SD3 Sección 3. Describa el flujo rectificado y por qué converge en menos pasos de inferencia que el DDPM.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Two-loss training | "NTP + diffusion" | A single transformer optimizes both cross-entropy on text tokens and MSE on continuous image patches in the same gradient step |
| Flow matching | "Rectified flow" | Diffusion variant that predicts a velocity field from noise to clean data; simpler math than DDPM |
| MMDiT | "Multimodal DiT" | Stable Diffusion 3's architecture: joint attention, modality-specific MLPs and norms |
| Block-triangular mask | "Causal text + bidirectional image" | Attention mask that is causal across text but bidirectional within image regions |
| Continuous image representation | "No VQ" | Image patches as real-valued vectors, not integer codebook indices |
| Velocity prediction | "v-parameterization" | Network output is the velocity field between noise and data, not the noise itself |

## Leer más

- [Zhou et al. — Transfusion (arXiv:2408.11039)](https://arxiv.org/abs/2408.11039)
- [Esser et al. — Stable Diffusion 3 / MMDiT (arXiv:2403.03206)](https://arxiv.org/abs/2403.03206)
- [Peebles & Xie — DiT (arXiv:2212.09748)](https://arxiv.org/abs/2212.09748)
- [Zhao et al. — MonoFormer (arXiv:2409.16280)](https://arxiv.org/abs/2409.16280)
- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
