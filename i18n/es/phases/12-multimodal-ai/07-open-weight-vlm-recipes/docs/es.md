# Recetas de VLM de peso abierto: lo que realmente importa

> La literatura VLM de peso abierto 2024-2026 es un bosque de tablas de ablación. El MM1 de Apple probó 13 combinaciones de codificador de imágenes, conector y mezcla de datos. El Molmo de Allen AI demostró que los títulos humanos detallados superan la destilación GPT-4V. Cambrian-1 ejecutó 20+ comparaciones de codificadores. Idefics2 formalizó el espacio de diseño de cinco ejes. Los VLM prismáticos compararon 27 recetas de entrenamiento en un índice de referencia controlado. De todo ese ruido, un pequeño conjunto de resultados se mantiene en el papel: el codificador de imágenes importa más que la arquitectura del conector, la mezcla de datos importa más que ambas, y los títulos humanos detallados superan a los datos sintéticos destilados. Esta lección lee esas tablas para que no tengas que hacerlo.

**Type:** Learn + lab
**Languages:** Python, TypeScript (stdlib, ablation table parser + recipe picker)
**Prerequisites:** Phase 12 · 05 (LLaVA baseline)
**Time:** ~180 minutes

## Objetivos de aprendizaje

- Nombre del espacio de diseño VLM de cinco ejes: codificador de imagen, conector, LLM, mezcla de datos, cronograma de resolución.
- Lea una tabla de ablación MM1 / Idefics2 / Cambrian-1 y pronostica qué botón mueve un punto de referencia dado.
- Seleccione una receta (encodor, conector, datos, resolución) para un nuevo VLM dado un presupuesto de cálculo y una mezcla de tareas.
- Explica por qué los títulos humanos detallados superan a la destilación GPT-4V en el mismo recuento de tokens.

## El problema

Hay cientos de VLM de peso abierto. La mayor parte de la brecha entre "bueno" y "estado de la técnica" no es arquitectura. Son datos, horario de resolución y elección de codificador. Saber qué botón girar primero cuando su modelo no funciona bien te ahorra un error de 5 millones de GPU-hora.

La ola de 2023 (LLaVA-1.5, InstructBLIP, MiniGPT-4) se realizó en el entrenamiento previo a la pareja de captura + LLaVA-Instruct-150k.

La ola de 2024 (MM1, Idefics2, Molmo, Cambrian-1, Prismatic VLMs) realizó ablaciones exhaustivas.

## El concepto

### El espacio de diseño de cinco ejes

Idefics2 (Laurençon et al., 2024) nombró los ejes:

1. Encodrador de imágenes. CLIP ViT-L/14, SigLIP SO400m/14, DINOv2 ViT-g/14, InternViT-6B. Los codificadores difieren en tamaño de parche, resolución y objetivo de preentrenamiento.
2. Conector: MLP (2-4 capas), Q-Former (32 consultas + cross-attn), Perceptor Resampler (64 consultas), C-Abstractor (convolución + bilinear pooling).
3. Modelo de lenguaje. Llama-3 8B / 70B, Mistral 7B, Phi-3, Gemma-2, Qwen2.5.
4. Datos de formación: pares de capciones (CC3M, LAION), entrelazados (OBELICS, MMC4), instrucción (LLaVA-Instruct, ShareGPT4V, PixMo, Cauldron).
5. Calendario de resolución: fijo 224/336/448, AnyRes, dinámico nativo.

Cada VLM de producción hace una elección en cada eje. La mayoría de las variaciones en las puntuaciones de MMMU se explican por los ejes 1, 4 y 5  no por qué conector elegiste.

### Eje 1: codificador > conector

MM1 Sección 3.2 mostró: el intercambio de CLIP ViT-L/14 a SigLIP SO400m/14 añadió 3 puntos MMMU. el intercambio del conector de MLP a Perceptor Resampler añadió menos de 1 punto.

Cambrian-1 "Cambrian Vision Encoders Match-Up" (Tong et al., 2024) ejecutó 20+ codificadores en un punto de referencia centrado en la visión (CV-Bench). La parte superior del tablero de clasificación es una mezcla de DINOv2 y SigLIP; CLIP está en el medio del paquete; ImageBind y ViT-MAE son más bajos. La brecha entre CLIP ViT-L y DINOv2 ViT-g/14 es de ~ 5-7 puntos en CV-Bench.

El codificador predeterminado 2026 para VLM abiertos es SigLIP 2 SO400m/14 para características semánticas + densas, a veces concatenado con DINOv2 ViT-g/14 características (Cambrian "Aggregador de visión espacial" hace esto).

### Eje 2: diseño del conector es un lavado

MM1, Idefics2, Prismatic y MM-Interleaved llegaron a la misma conclusión: en un conteo fijo de tokens visuales, la arquitectura del conector apenas importa.

Lo que importa es el número de tokens. Más tokens visuales = más computación LLM = mejor rendimiento hasta un punto, luego disminuye los rendimientos. 64 tokens por imagen es demasiado poco para OCR. 576-1024 tokens es el punto dulce para la mayoría de VLM abiertos. 2048+ ayuda solo para documentos y gráficos.

Q-Former vs MLP es una cuestión de costo, no una cuestión de calidad: Q-Former limita los tokens a 32-64 independientemente de la resolución de la imagen; MLP emite todos los tokens de parche. Para entradas de alta resolución, Q-Former guarda el contexto LLM; para bajas respuestas, la diferencia es el ruido.

### Eje 3: El tamaño del LLM establece el límite máximo

El doble del LLM de 7B a 13B añade confiablemente 2-4 puntos en MMMU en cada documento de VLM. En 70B se saturan la mayoría de los puntos de referencia.

Es por eso que Qwen2.5VL-72B y Claude Opus 4.7 aplastan MMMU-Pro y ScreenSpot-Pro: el cerebro del lenguaje es enorme. Un VLM 7B no puede sustituir a un VLM 70B a través del diseño inteligente de conectores.

### Eje 4: datos  detalles de los títulos humanos superan la destilación

Molmo + PixMo (Deitke et al., 2024) es el resultado 2024 que todos deberían leer. Allen AI tenía anotadores humanos que describieron imágenes en 1-3 minutos de pasajes densos de habla a texto, dando 712K imágenes con subtítulos densos.

Molmo-72B superó a Llama-3.2-90B-Vision en 11 de los 11 puntos de referencia. El delta no es arquitectura  es calidad de leyenda.

ShareGPT4V (Chen et al., 2023) y Cauldron (Idefics2) siguieron el mismo manual con títulos humanos + GPT-4V mixtos. La tendencia es clara: para la frontera de 2026, la densidad de títulos > cantidad de títulos > conveniencia de destilación.

### Eje 5: resolución y su calendario

Las ablaciones de Idefics2: 384 -> 448 añade 1-2 puntos. 448 -> 980 con división de imágenes (AnyRes) añade otros 3-5 en los puntos de referencia OCR. Planas de entrenamiento de resolución plana a una precisión media; ramping de resolución (inicio 224, final 448 o nativo) trenes más rápido y termina más alto.

Cambrian-1 realizó un trade-off de resolución vs. tokens: en el cálculo fijo, puede tener más tokens con menor resolución o menos tokens con mayor resolución.

La receta de producción 2026: tren etapa 1 en 384 fijos, etapa 2 con resolución dinámica hasta 1280 para tareas pesadas de OCR.

### La comparación controlada de Prismatic

Prismatic VLMs (Karamcheti et al., 2024) es el documento que controlaba todos los ejes.

- El recuento de tokens visuales por imagen explica ~60% de la variación.
- La elección del codificador explica ~20%.
- La arquitectura del conector explica ~5%.
- Todo lo demás (mix de datos, programador, LR) el ~15% restante.

Esta es una descomposición dura, pero es la respuesta más limpia a "qué debo ablar primero" en la literatura.

### Un selector para 2026

Dadas las pruebas, la receta de VLM abierta por defecto para un nuevo proyecto en 2026:

- Encoder: SigLIP 2 SO400m/14 en resolución nativa con NaFlex, concatenado con DINOv2 ViT-g/14 para características densas si se necesita segmentación/terrizaje.
- Conector: MLP de 2 capas en tokens de parche. Salta Q-Former a menos que esté limitado por tokens.
- LLM: Qwen2.5 / Llama-3.1 / Gemma 2, 7B para el costo, 70B para la calidad, elegido por latencia objetivo.
- Datos: PixMo + ShareGPT4V + Cauldron, completado con datos de instrucciones específicas de tareas.
- Resolución: dinámica (min 256, máximo 1280 píxeles por lado largo).
- Programa: Alineación de la etapa 1 (sólo para proyectores), fase 2 de ajuste completo, fase 3 de ajuste específico de tarea.

Cada uno de esos valores por defecto se remonta a una ablación medida en los documentos citados al final de esta lección.

```figure
l5-vlm-recipe-knobs
```

## Usalo

`code/main.py`Es un analizador de tablas de ablación y receta. codifica las tablas de ablación MM1 e Idefics2 (condensado) y le permite hacer consultas:

- "Dado el presupuesto X y la tarea Y, ¿qué receta gana?"
- "Si cambio SigLIP por CLIP en un Llama 7B, ¿cuál es el delta esperado de MMMU?"
- "¿Qué eje debo ablar primero para una respuesta de confianza del 80%?"

La salida es una lista de recetas clasificadas con los deltas de referencia esperados y una recomendación de "ablate first".

## Envío

Esta lección produce`outputs/skill-vlm-recipe-picker.md`. Dado un mix de tareas objetivo, un presupuesto de cálculo y un objetivo de latencia, emite una receta completa (encodor, conector, LLM, mix de datos, cronograma de resolución) con citas a la ablación que justifica cada elección.

## Los ejercicios

1. ¿Qué código gana en el programa de estudios de la Universidad de California en el Reino Unido? ¿La respuesta se invertiría en el programa de estudios de la Universidad de California en el Reino Unido?

2. Cambrian-1 encuentra que la concatenada DINOv2 + SigLIP supera a sí sola en los puntos de referencia centrados en la visión, pero no añade ninguna señal en MMMU.

3. Su objetivo es un agente de interfaz móvil en un 2B LLM. Seleccione un codificador, conector, resolución y mezcla de datos. Justifique cada elección con una tabla de ablación específica.

4. Molmo vende modelos 4B y 72B. El 4B es competitivo con los VLM cerrados 7B; el 72B supera a Llama-3.2-90B-Vision en 11/11 puntos de referencia. ¿Qué le dice eso sobre la hipótesis de plato del tamaño de LLM?

5. Diseñar una tabla de ablación para aislar la calidad de la mezcla de datos de la calidad del codificador en un VLM 7B. ¿Cuántas carreras de entrenamiento mínimo? Propón las cuatro configuraciones de eje.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Ablation | "Turning one knob" | Training multiple runs that differ in exactly one design-space axis, holding everything else constant |
| Connector | "Bridge" / "projector" | Trainable module that maps vision encoder output into the LLM's token space (MLP, Q-Former, Perceiver) |
| Detailed human caption | "Dense caption" | A multi-sentence human-written description (typically 80-300 tokens) richer than a web alt text |
| Distillation | "GPT-4V captions" | Training data generated by a stronger proprietary VLM; convenient but prone to inherited hallucination |
| AnyRes / dynamic res | "High-res path" | Strategy to feed images larger than the encoder's native resolution via tiling or M-RoPE |
| Resolution ramp | "Curriculum" | Training schedule that starts low-resolution and increases, speeding alignment learning |
| Vision-centric bench | "CV-Bench / BLINK" | Evaluation that stresses fine-grained visual perception rather than language-heavy reasoning |
| PixMo | "Molmo's data" | Allen AI's 712K densely-captioned image dataset; human speech transcribed into dense captions |

## Leer más

- [McKinzie et al. — MM1 (arXiv:2403.09611)](https://arxiv.org/abs/2403.09611)
- [Laurençon et al. — Idefics2 / What matters building VLMs (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Deitke et al. — Molmo and PixMo (arXiv:2409.17146)](https://arxiv.org/abs/2409.17146)
- [Tong et al. — Cambrian-1 (arXiv:2406.16860)](https://arxiv.org/abs/2406.16860)
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865)
