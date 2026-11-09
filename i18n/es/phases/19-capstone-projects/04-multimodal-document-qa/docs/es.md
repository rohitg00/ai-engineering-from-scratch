# Capstone 04  Documentos de calidad multimodal (PDF de primera visión, tablas, gráficos)

> La frontera de 2026 entre documento y QA se alejó de la OCR-entonces-texto y hacia la interacción tardía de la visión primero. ColPali, ColQwen2.5 y ColQwen3-omni tratan cada página PDF como una imagen, la incorporan con interacción tardía multi-vector, y dejan que la consulta atenda a los parches directamente. En los 10K financieros, artículos científicos y notas escritas a mano este patrón supera a OCR primero por un gran margen. Construir la tubería de extremo a extremo en 10 mil páginas y publicar el lado a lado contra OCR-then-text.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (viewer UI, retrieval scaffold)
**Prerequisites:** Phase 4 (computer vision), Phase 5 (NLP), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:**P4 · P5 · P7 · P11 · P12 · P17
**Time:** 30 hours

## El problema

Las empresas se sientan en PDF que las tuberías de OCR se desmoronan: 10-K escaneados con tablas giratorias, documentos científicos densos con ecuaciones, gráficos que sólo tienen sentido como imágenes, anotaciones escritas a mano. Tratarlos como el primer mensaje significa perder la mitad de la señal. La respuesta para 2026 es la recuperación multi-vectorial de interacción tardía en imágenes de páginas crudas. ColPali (Illuin Tech) lo introdujo; ColQwen2.5-v0.2 y ColQwen3-omni impulsaron la precisión. En ViDoRe v3, la recuperación de visión primero obtiene puntajes por encima de OCR-entonces-texto por márgenes significativos  y la brecha se amplía en gráficos, tablas y escritura a mano.

El trade-off es el almacenamiento y la latencia. Una incorporación de ColQwen es ~2048 vectores de parches por página, no un solo vector de 1024 dimensiones. Balones de almacenamiento crudos. DocPruner (2026) proporciona poda del 50% sin pérdida de precisión medible. Indéxarás 10k páginas, medirás ViDoRe v3 nDCG@5, servirás respuestas en menos de 2 segundos y compararás directamente con una línea de base OCR-then-text.

## Concepto

Interacción tardía significa que cada token de consulta obtiene puntajes frente a cada token de parche, y se suma la puntuación máxima por token de consulta. Obtiene una coincidencia de granos finos sin necesidad de un solo vector combinado. Un índice multi-vector (Vespa, Qdrant multi-vector o AstraDB) almacena las incorporaciones por parche y ejecuta MaxSim en el momento de recuperación.

El respondedor es un modelo de lenguaje de visión que toma la consulta más las páginas recuperadas en la parte superior como imágenes y escribe una respuesta con regiones de evidencia (cajas de límite o referencias de página). Qwen3-VL-30B, Gemini 2.5 Pro y InternVL3 son las opciones fronterizas de 2026. Para ecuaciones y notación científica, se inserta un fallback OCR (Nougat, dots.ocr) como un canal de texto opcional.

La evaluación es una matriz bidimensional. Un eje: tipo de contenido ( párrafos de texto plano, tablas densas, gráficos de barras/líneas, notas escritas a mano, ecuaciones). Otro eje: enfoque de recuperación (interacción tardía de primera visión vs OCR-entonces-texto vs híbrido). Cada célula obtiene nDCG@5 y la exactitud de respuesta. El informe es el entregable.

## Arquitectura

```
PDFs -> page renderer (PyMuPDF, 180 DPI)
           |
           v
  ColQwen2.5-v0.2 embed (multi-vector per page, ~2048 patches)
           |
           +------> DocPruner 50% compression
           |
           v
   multi-vector index (Vespa or Qdrant multi-vector)
           |
query ----+----> retrieve top-k pages (MaxSim)
           |
           v
  VLM answerer: Qwen3-VL-30B | Gemini 2.5 Pro | InternVL3
    inputs: query + top-k page images + optional OCR text
           |
           v
  answer with cited page numbers + evidence regions
           |
           v
  Streamlit / Next.js viewer: highlighted boxes on source page
```

## El establo

- Rendering de página: PyMuPDF (fitz) a 180 DPI, normalizado por retrato
- Modelo de interacción tardía: ColQwen2.5-v0.2 o ColQwen3-omni (equipo vidore en Hugging Face)
- Indice: Vespa con campo multivector, o multivector Qdrant, o AstraDB con MaxSim
- Triturado: DocPruner 2026 política (mantener parches de alta variación, 50% de compresión a pérdida de precisión < 0,5%)
- Retrocesión de OCR (equaciones / tablas densas): puntos.ocr o Nougat
- Responder VLM: Qwen3-VL-30B auto-hosted o Gemini 2.5 Pro alojado; InternVL3 como retroceso
- Evaluación: Visión de referencia ViDoRe v3, M3DocVQA para el razonamiento de varias páginas
- Interfaz de usuario del visor: Next.js 15 con capa de tela para regiones de evidencia

```figure
ce-late-interaction
```

## Construye el mismo

1. **Ingest.**Recorre un corpus de 10 mil páginas PDF en 10 mil páginas, artículos científicos y documentos escaneados.`{doc_id, page_num, image_path}`¿ Qué ?

2. **Embed.**Ejecutar ColQwen2.5-v0.2 en cada imagen de página. Forma de salida ~2048 embebedidos de parches de dim 128. Aplicar DocPruner para mantener la mitad de señal más alta. Escribir a campo multi-vector Vespa o multi-vector Qdrant.

3. **Query.**Para cada consulta entrante, embebedar con la torre de consulta (embedings a nivel de tokens). ejecutar MaxSim contra el índice: para cada token de consulta, tomar el producto punto máximo sobre las páginas de parche de página, suma.

4. **Synthesize.**Llame a Qwen3-VL-30B con la consulta y las imágenes de las 5 páginas superiores. Prompt: "Responde utilizando solo las páginas suministradas. Cite cada reclamo por (doc_id, página) y nombre la región (figura, tabla, párrafo)."

5. **Evidence regions.**Después de procesar la respuesta para extraer las regiones citadas. Si el VLM emite cajas de límite (Qwen3-VL lo hace), rendirlos como superposiciones en el visor.

6. **OCR fallback.**Para las páginas identificadas como densas en ecuaciones (heurística sobre la varianza de imagen), ejecuta Nougat o dots.ocr y pasa el texto OCR como un canal adicional junto a la imagen.

7. **Eval.**Ejecutar ViDoRe v3 (recuperar nDCG@5) y M3DocVQA (acurateza de QA de múltiples páginas). También ejecutar OCR-then-text pipeline en el mismo corpus con el mismo sintetizador. Produce una matriz de tipo de contenido × enfoque.

8. **UI.**Primero, el prototipo de streamlit; Next.js 15 es un visor de producción con una superposición de página por página de la región de la evidencia.

## Usalo

```
$ doc-qa ask "what was the 2024 operating margin change for segment EMEA?"
[retrieve]   top-5 pages in 320ms (ColQwen2.5, MaxSim, Vespa)
[synth]      qwen3-vl-30b, 1.4s, cited (form-10k-2024, p. 88) + (..., p. 92)
answer:
  EMEA operating margin moved from 18.2% to 16.8%, a 140bp decline.
  cited: 10-K-2024.pdf p.88 (Table 4, Segment Operating Margin)
         10-K-2024.pdf p.92 (MD&A, Operating Performance)
[viewer]     open with highlighted bounding boxes overlaid on p.88 Table 4
```

## Envío

`outputs/skill-doc-qa.md`describe el producto entregado: un sistema de evaluación de calidad de documentos multimodal de primera visión, ajustado a un corpus específico y evaluado en comparación con una base de OCR-then-text en ViDoRe v3.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | ViDoRe v3 / M3DocVQA accuracy | Benchmark numbers vs OCR-text baseline and published leaderboard |
| 20 | Evidence-region grounding | Fraction of cited regions that actually contain the answer span |
| 20 | Storage and latency engineering | DocPruner compression ratio, index p95, answer p95 |
| 20 | Multi-page reasoning | Accuracy on a hand-labeled 100-question multi-page set |
| 15 | Source-inspection UX | Viewer clarity, overlay fidelity, side-by-side comparison tools |
| **100** | | |

## Los ejercicios

1. Mide ColQwen2.5-v0.2 vs ColQwen3-omni en el mismo corpus. ¿Qué páginas se obtienen correctas y la otra se pierden? Agregue una etiqueta de "clase de contenido" al índice para recorrer por tipo.

2. Encuentra el acantilado de compresión: el punto donde ViDoRe nDCG@5 cae por debajo de la línea de base de OCR.

3. Construir un híbrido: ejecutar OCR-then-text y ColQwen en paralelo, fusionarse con RRF, volver a clasificar con un codificador cruzado. ¿El híbrido bate a uno solo? ¿Dónde ayuda más?

4. Cambiar Qwen3-VL-30B por un VLM más pequeño (Qwen2.5-VL-7B).

5. Añadir soporte de notas escritas a mano. Render el corpus de escritura a mano, incrustado con ColQwen, medir la recuperación. Comparar con una tubería de OCR de escritura a mano.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Late interaction | "ColPali-style retrieval" | Query tokens score against page patches independently; MaxSim aggregates |
| Multi-vector | "Per-patch embedding" | Each document has many vectors, not one pooled vector |
| MaxSim | "Late-interaction scoring" | For every query token, take max similarity over document vectors; sum |
| DocPruner | "Patch compression" | 2026 pruning that keeps 50% of patches with negligible accuracy loss |
| ViDoRe v3 | "Document-retrieval benchmark" | The 2026 standard for measuring visual-document retrieval |
| Evidence region | "Cited bounding box" | A bbox on the source page that localizes the answer span |
| OCR fallback | "Equation channel" | Text pipeline used alongside vision for equation- or table-heavy pages |

## Leer más

- [ColPali (Illuin Tech) repository](https://github.com/illuin-tech/colpali) Recuperación de documentos de referencia en interacción tardía
- [ColPali paper (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449) el documento de método fundamental
- [ColQwen family on Hugging Face](https://huggingface.co/vidore) Puntos de control listos para la producción
- [M3DocRAG (Adobe)](https://arxiv.org/abs/2411.04952) Línea de base de RAG multimodal de varias páginas
- [Vespa multi-vector tutorial](https://docs.vespa.ai/en/colpali.html) pila de servicio de referencia
- [Qdrant multi-vector support](https://qdrant.tech/documentation/concepts/vectors/#multivectors) índice alternativo
- [AstraDB multi-vector](https://docs.datastax.com/en/astra-db-serverless/databases/vector-search.html) índice administrado alternativo
- [Nougat OCR](https://github.com/facebookresearch/nougat) Retrocesión de la OCR con capacidad de ecuación
