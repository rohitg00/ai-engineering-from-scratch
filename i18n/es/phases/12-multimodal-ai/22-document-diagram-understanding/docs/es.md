# Comprensión del documento y del diagrama

> Los documentos no son fotos. Un PDF, un documento científico, una factura o un formulario escrito a mano tiene un diseño, tablas, diagramas, notas a pie de página, encabezados y estructura semántica que la comprensión de la imagen simple no puede captar. La pila pre-VLM era una tubería: Tesseract OCR + LayoutLMv3 + heurísticas de extracción de tablas. La ola VLM reemplazó a la de modelos libres de OCR  Donut (2022), Nougat (2023), DocLLM (2023)  que emiten marcado estructurado directamente. Para 2026, la frontera es simplemente "alimentar la imagen de página a Claude Opus 4.7 en nativo de 2576px", y la salida de marcado estructurado viene de forma gratuita. Esta lección lee el arco de tres épocas de la IA de documentos.

**Type:** Build
**Languages:** Python (stdlib, layout-aware document parser skeleton), TypeScript
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 5 (NLP)
**Time:** ~180 minutes

## Objetivos de aprendizaje

- Explica las tres eras de la IA de documentos: OCR pipeline, OCR libre, VLM nativo.
- Describa las tres corrientes de entrada de LayoutLMv3: texto, diseño (bbox), parches de imagen, con enmascaramiento unificado.
- Compare Donut (sin OCR, imagen → marcado), Nougat (papel científico → LaTeX), DocLLM (generativo consciente del diseño), PaliGemma 2 (nativo de VLM).
- Seleccione un modelo de documento para una nueva tarea (facturas, documentos científicos, formularios escritos a mano, recibos chinos).

## El problema

"Entender este PDF" es engañosamente difícil. La información se encuentra en:

- Contenido de texto (90% de la señal).
- Layout (títulos, notas de pie, barras laterales, formato de dos columnas).
- Tablas (fila, columna, células fusionadas).
- Las figuras y diagramas.
- Anotadas escritas a mano.
- Fuentes y tipografía (título vs cuerpo).

Un sistema que se preocupa por las facturas necesita saber que "Total: $1,245" proviene de la parte inferior derecha, no de una nota a pie de página.

## El concepto

### ERA 1  OCR (antes de 2021)

La pila clásica:

1. PDF → imagen por página.
2. Tesseract (o OCR comercial) extrae texto con cuadro de límite por palabra.
3. El analizador de diseño identifica los bloques (título, tabla, párrafo).
4. El reconocedor de estructura de la tabla analiza las tablas.
5. Reglas de dominio + campos de extracto de regex.

Funciona para texto impreso limpio. Se rompe la letra, escaneos sesgados, tablas complejas, guiones no en inglés. Cada modo de falla requiere un camino de excepción personalizado.

### El importe de la ayuda se calcula en el plazo de cinco meses.

TrOCR (Li et al., arXiv:2109.10282) reemplazó al clásico CNN-CTC de Tesseract por un transformer encoder-decoder entrenado en imágenes de texto sintéticas + reales.

### Era 2  libre de OCR (2022-2023)

Los primeros modelos libres de OCR dijeron: omite la detección por completo, mapa de los píxeles de imagen a la salida estructurada directamente.

Donut (Kim et al., arXiv:2111.15664):
- Transformador de codificación y decodificación, codificador es Swin-B.
- La salida es JSON para la comprensión de las formas, marcado para la resumen, o cualquier esquema específico de tarea.
- No hay OCR, no hay diseño, no detección.

Nougat (Blecher et al., arXiv:2308.13418):
- Formado específicamente en artículos científicos.
- La salida es LaTeX / marcado.
- Maneja ecuaciones, diseño de varias columnas, figuras.
- El modelo que llama cada parser de archivo.

Esos son especialistas, no generalistas.

### LayoutLMv3 (2022)

La distribuciónLMv3 (Huang et al., arXiv:2204.08387) mantiene la OCR pero añade la comprensión del diseño:

- Tres flujos de entrada: tokens de texto OCR, cuadros de límite 2D por token, parches de imagen.
- Objetivo de formación enmascarada en las tres modalidades (texto enmascarado, parches enmascarados, diseño enmascarado).
- A continuación: clasificación, extracción de entidades, cuadro de calificación.

LayoutLMv3 es el máximo de comprensión de documentos basados en OCR. Fuerte en formularios y facturas. Requiere OCR en el río arriba. Mejor precisión previo a VLM en referentes de documentos estandarizados.

### DocLLM (2023)

DocLLM (Wang et al., arXiv:2401.00908, presentado el 31 de diciembre de 2023, por lo que el ID lleva un prefijo de enero de 2024) es el hermano generativo de LayoutLM. Genera respuestas de forma libre condicionadas a tokens de diseño. Mejor para QA en documentos; todavía depende de la entrada de OCR.

### Era 3  nativo de VLM (2024+)

2024 VLMs se hicieron lo suficientemente buenos para reemplazar el oleoducto por completo.

- El AnyRes de lápiz LLaVA-NeXT 336 funciona para documentos pequeños.
- Qwen2.5VL de resolución dinámica maneja 2048+ píxeles de forma nativa.
- Claude Opus 4.7 admite documentos de 2576px.
- PaliGemma 2 (diciembre 2024) se prepara específicamente para documentos + escritura a mano.

La brecha entre el tubo de VLM-nativo y el OCR se cerró rápidamente.

- Texto de escena (escrito a mano + impreso, guiones mixtos).
- Tablas complejas con células fusionadas.
- Ecuaciones matemáticas incrustadas en el texto.
- Figuras con anotaciones de texto.

Los oleoductos de OCR siguen ganando:

- Cargas de trabajo de escaneo puro a gran escala donde la latencia por página importa.
- Confiabilidad de la tubería (fallas deterministas frente a alucinaciones de VLM).
- Entidades reguladas que requieren una salida de OCR auditable.

### La frontera de Claude 4.7 / GPT-5

A 2576 píxeles de entrada nativa, los VLM fronterizos documentan la comprensión con una precisión casi humana.

- DocVQA: Claude 4.7 ~ 95.1, PaliGemma 2 ~ 88.4, Nougat ~ 77.3, Layout en tuberíaLMv3 ~ 83.
- CÁRTO: Claude 4.7 ~ 92,2, GPT-4V ~ 78.
- VisualMRC: Claude 4.7 ~ 94.

La brecha en el modelo cerrado es principalmente de resolución y escala LLM base.

### Ecuaciones matemáticas y salida de LaTeX

Los trabajos científicos necesitan una salida exacta de LaTeX para las ecuaciones. Nougat fue entrenado en esto. VLM entrenados con objetivos LaTeX (Qwen2.5-VL-Math, derivados de Nougat) producen LaTeX utilizable.

Para las tuberías de papel científico en 2026: cadena Nougat en el PDF, luego un VLM en páginas complicadas.

### Escritura de mano

La tarea más difícil es la de imprimir mezclado + escrito a mano (noticias de médicos, formularios llenos) donde las tuberías de OCR siguen superando a las VLM en cuanto a costo.

### Recepta de 2026

Para un nuevo proyecto de IA documental:

- Las facturas impresas en escala: LayoutLMv3 + reglas, rentables.
- Documentación mixta (científica + manuscrito + formularios): nativo de VLM (PaliGemma 2 o Qwen2.5-VL).
- Ingestión completa de archivo: Nougat para matemáticas, VLM para cifras.
- Regulación: tubería de OCR + validador VLM para la verificación cruzada.

```figure
mm-doc-layout
```

## Usalo

`code/main.py`¿Qué es esto ?

- Un tokenizer de juguete consciente de la disposición: dado (texto, bbox) pares, produce la entrada de estilo LayoutLMv3.
- Generador de esquemas de tareas de estilo Donut: plantilla JSON para formularios.
- Una comparación de los presupuestos de tokens por página en OCR-pipeline, Donut, Nougat y VLM-native.

## Envío

Esta lección produce`outputs/skill-document-ai-stack-picker.md`. Dado un proyecto de IA de documentos (dominio, escala, calidad, regulación), escoge entre el oleoducto de OCR, el especialista libre de OCR y el nativo de VLM.

## Los ejercicios

1. Su proyecto es de 10 millones de facturas al día. ¿Cuál pila minimiza el costo por página sin perder la precisión?

2. ¿Por qué LayoutLMv3 supera a los CLIP-VLMs puros en el formulario QA pero tiene un rendimiento inferior en el texto de escena? ¿Qué es lo que el stream bbox da?

3. Proponemos un caso de prueba en el que la salida nativa de VLM vence a Nougat en fidelidad de LaTeX, y un caso en el que Nougat gane.

4. Leer el documento PaliGemma 2 (Google, 2024). ¿Cuál fue la adición clave de datos de entrenamiento que levantó la exactitud del documento frente a PaliGemma 1?

5. Diseñar un híbrido seguro por la regulación: OCR como principal, VLM como secundario de verificación cruzada. ¿Cómo resolver el desacuerdo?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| OCR pipeline | "Tesseract-style" | Stage-wise stack: detect -> OCR -> layout -> rules; deterministic, fragile |
| OCR-free | "Donut-style" | Image-to-output transformer that skips explicit OCR; single model |
| Layout-aware | "LayoutLM" | Input includes per-token bbox coordinates; unified masking across modalities |
| VLM-native | "Frontier VLM" | Feed page image directly to Claude/GPT/Qwen VLM at high resolution; no pipeline |
| DocVQA | "Doc benchmark" | Document VQA standard; most-cited score |
| Markup output | "LaTeX / MD" | Structured output format instead of free-form text; enables downstream automation |

## Leer más

- [Li et al. — TrOCR (arXiv:2109.10282)](https://arxiv.org/abs/2109.10282)
- [Blecher et al. — Nougat (arXiv:2308.13418)](https://arxiv.org/abs/2308.13418)
- [Huang et al. — LayoutLMv3 (arXiv:2204.08387)](https://arxiv.org/abs/2204.08387)
- [Kim et al. — Donut (arXiv:2111.15664)](https://arxiv.org/abs/2111.15664)
- [Wang et al. — DocLLM (arXiv:2401.00908)](https://arxiv.org/abs/2401.00908)
