# LLaVA-OneVision: imagen única, imagen múltiple, vídeo en un modelo

> Antes de LLaVA-OneVision (Li et al., agosto 2024) el mundo de VLM abierto tenía linajes separados: LLaVA-1.5 para imágenes individuales, modelos de imágenes múltiples como Mantis y VILA, modelos de video como Video-LLaVA y Video-LLaMA. Cada uno ganó su punto de referencia y falló en los otros. LLaVA-OneVision argumentó que un solo plan de estudios podría capacitar a un modelo para dominar los tres escenarios, y que los efectos emergentes de transferencia de tareas (habilidades de imagen única exportadas al video, razonamiento de imágenes múltiples exportados a imagen única) superan a la suma de especialistas. La receta es engañosamente simple: un presupuesto de fichaje visual equilibrado entre escenarios, más un plan de estudios explícito que pasa de una sola imagen a OneVision (multi-imagen) a video. Esta lección lee el presupuesto, el programa de estudios y los comportamientos emergentes.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, token budget solver + curriculum planner)
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 12 · 06 (any-resolution)
**Time:** ~180 minutes

## Objetivos de aprendizaje

- Diseñar un presupuesto de tokens visuales que se mantenga equilibrado en entradas de una sola imagen, múltiples imágenes y vídeo.
- Ordenar un plan de formación que transfiera habilidades de una sola imagen a video sin olvidar catastróficamente.
- Explica por qué un modelo único supera a los especialistas en el mismo número de parámetros cuando el plan de estudios se hace correctamente.
- Nombre de las tres capacidades emergentes reportadas por LLaVA-OneVision: razonamiento multi-cámara, puesta de marca, agente de capturas de pantalla del iPhone.

## El problema

La imagen, la imagen múltiple y el video enfatizan cada modelo de manera diferente.

Una sola imagen necesita tokens de alta resolución (AnyRes, ~ 2880 tokens visuales) para capturar OCR y detalles finos. Presupuesto por muestra: una imagen, 2880 tokens.

Multi-imagen quiere varias imágenes con resolución moderada (~ 576 tokens cada uno) por lo que el razonamiento entre las imágenes encaja en el contexto. Presupuesto por muestra: 4-8 imágenes, 576 cada, 2300-4600 tokens.

El video necesita muchos cuadros con baja resolución (~ 196 tokens por cuadro después de la agrupación) para capturar la dinámica temporal. Presupuesto por muestra: 8-32 cuadros, 196 cada, 1600-6200 tokens.

Si entrenas modelos separados, escoges un presupuesto. Si entrenas un modelo, necesitas el presupuesto para escalar sensatamente entre escenarios sin explotar el contexto.

Pre-OneVision, la respuesta predeterminada era "entrenar un escenario, ignorar los otros". Video-LLaVA adaptó el video a un modelo de imagen con etapas de entrenamiento adicionales. LLaVA-NeXT agregó soporte para múltiples imágenes con mosaicos. Ninguno manejó las tres limpiamente.

## El concepto

### El presupuesto de tokens de OneVision

LLaVA-OneVision no fija un número exacto de tokens. Equilibra el número máximo de tokens visuales por muestra para que los tres escenarios se encuentren en el mismo rango, aproximadamente de 6.000 a 9.000 tokens, asignados de manera diferente por escenario:

- Imagen única: AnyRes-Max-9 (hasta 9 azulejos + una vista base), cada vista 384x384 dando 729 tokens de SigLIP SO400M. Máximo: 729 * (1 + 9) = 7290 tokens.
- Multi-imagen: cada imagen en 384 sin tejas, 729 tokens sin agrupamiento. Hasta 12 imágenes → 8748 tokens.
- Video: hasta 32 cuadros en 384 con 2x2 bilinear → 196 tokens por cuadro.

La asignación mantiene los totales máximos en la misma banda, por lo que ningún escenario domina el contexto o el gradiente.`code/main.py`el planificador de abajo utiliza un presupuesto de juguete más pequeño de 4096 para mostrar la misma lógica de equilibrio.

### El plan de estudios en tres etapas

Los trenes LLaVA-OneVision se dividen en tres etapas:

1. El sistema de datos de una sola imagen es una única imagen más texto. Entrenamiento en la entrada de AnyRes de alta resolución. Esto enseña la percepción, OCR y la comprensión de granos finos.
2. OneVision SFT (estadio OV). Mezcla una imagen + una imagen + un video (marcos de muestra uniforme). Entrena en el presupuesto de tokens unificado. Esto enseña al modelo a manejar formas de lotes heterogéneas.
3. Transferencia de tareas (etapa TT). Continúa con una mezcla de tareas objetivo, generalmente más pesada en imágenes o videos múltiples dependiendo del producto.

El programa de formación de video-primero o de imágenes múltiples-primero produce un rendimiento de imagen peor que de imagen única-primero, incluso con los mismos datos.

### Por qué funciona el plan de estudios

La formación de una sola imagen construye la base perceptiva. Los tokens de parche tienen características visuales de granos finos; el LLM aprende a integrarlas con el texto.

Si entrenamos todos los escenarios desde cero juntos, el modelo se adapta a la percepción (datos de una sola imagen por lote limitado) y a la estructura de sobrepeso (muchos datos de imágenes / videos múltiples).

El orden del currículo le da fuerza de percepción desde la etapa SI, luego el razonamiento compositivo/temporal desde la etapa OV, sin perder ninguna.

### Habilidades emergentes para escenarios cruzados

El documento LLaVA-OneVision informa de tres capacidades emergentes:

1. El modelo integra correctamente las vistas a pesar de que nunca vio ese formato exacto en el entrenamiento.
2. Instrucción de marcas de conjunto. El usuario anota objetos en una imagen con marcas numeradas; el modelo razona sobre "qué hace la marca 3 en relación con la marca 7." Entrenado ni en marcas ni en anotaciones; aprendido a partir de la combinación de tierra espacial + referencia de imagen múltiple.
3. El usuario proporciona una captura de pantalla de una pantalla del iPhone y le pide que planifique el siguiente clic.

Estas no son tareas formadas; surgen de la estructura de composición del plan de estudios.

### Compilación de tokens visuales

El presupuesto de tokens requiere un pooling. OneVision utiliza interpolación bilinear en la red de parches 2D: 24x24 = 576 parches se convierte en 12x12 = 144 (2x factor) o 8x8 = 64 (3x factor).

La elección de un factor de agrupación por escenario es en sí misma un hiperparámetro. Menos agrupación = más tokens = representación más rica.

### LLaVA-OneVision-1.5

El seguimiento de 2025 (LLaVA-OneVision-1.5, arXiv 2509.23661) es "totalmente abierto" en datos de capacitación, pesos de modelos y código.

### Contraste con Qwen2.5-VL

Qwen2.5-VL (Lección 12.09) hace diferentes opciones. Utiliza M-RoPE y FPS dinámico en lugar de un pooling fijo. Su balance de presupuesto con entrada  un video de 1 minuto utiliza más tokens que un video de 5 segundos. LLaVA-OneVision fija el presupuesto y escala el pooling. Ambos trabajan; intercambian configurabilidad por predictibilidad.

```figure
l5-onevision-budget
```

## Usalo

`code/main.py`Se trata de un plan de estudios y un planificador de presupuesto para un VLM de estilo OneVision.

- Alocar resolución, factor de agrupación y marcos por escenario.
- Verifica que cada escenario se ajusta al presupuesto compartido.
- Los informes cuentan con el número de tokens esperado, los FLOPs de LLM y qué escenarios están sub-tokenizados.
- Imprime un programa de entrenamiento paso a paso.

Usalo para planificar una mejoría de OneVision o para comprobar el costo por solicitud de un despliegue de VLM.

## Envío

Esta lección produce`outputs/skill-onevision-budget-planner.md`. Dado una distribución de tareas objetivo y un presupuesto por muestra, emite el factor AnyRes, el conjunto por fotograma, el recuento de fotogramas de vídeo y los pesos de las etapas del currículo.

## Los ejercicios

1. Su producto admite el 80% de imágenes individuales, el 10% de imágenes múltiples (2-4 imágenes), el 10% de vídeo (8-16 cuadros). Diseñe el presupuesto de token. ¿Dónde pondría el presupuesto adicional que ahorra sin hacer imágenes múltiples pesadas?

2. Leer la sección 4.3 de LLaVA-OneVision (capacidades emergentes). Proponer una cuarta habilidad emergente que el plan de estudios probablemente desbloquearía pero el documento no informó.

3. Cambiar el orden del currículo  tren de imágenes múltiples primero, luego de imágenes únicas, luego de video.

4. El artículo informa de los puntos de referencia de vídeo entrenados en sólo 8 cuadros por muestra. ¿Se generaliza eso a videos de 30 segundos en la inferencia? ¿Qué rompe primero  el presupuesto de token o el razonamiento temporal?

5. La combinación bilinear de parches 24x24 a 12x12 es una reducción de 2x por dimensión, por lo que 4x menos tokens. Implemente la combinación en stdlib Python y verifique que la media sobre cada bloque 2x2 coincida con la salida bilinear.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| OneVision scenario | "Single-image, multi-image, or video" | One of three input shapes the unified VLM handles; the budget stays balanced across |
| Token budget | "How many tokens per sample" | Total visual tokens the LLM sees per training / inference sample, about 6k to 9k at most in LLaVA-OneVision |
| Curriculum | "Training order" | Stage ordering (single-image → multi-image → video) chosen for emergent transfer |
| Bilinear pooling | "Token shrink" | Applying bilinear interpolation to the patch grid (2D) to reduce token count while preserving locality |
| Emergent skill | "Not trained, still works" | Capability that appears at inference without matching training data, due to curriculum composition |
| AnyRes-k | "k-tile setup" | k sub-tiles of fixed resolution plus one thumbnail, typical $k \in \lbrace 4, 9 \rbrace$ |
| Task transfer | "Cross-scenario generalization" | Skills learned on single-image that apply to video (and vice versa) via shared backbone |

## Leer más

- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326)
- [LLaVA-OneVision-1.5: Fully Open Framework (arXiv:2509.23661)](https://arxiv.org/abs/2509.23661)
- [Lin et al. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Lin et al. — VILA (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
