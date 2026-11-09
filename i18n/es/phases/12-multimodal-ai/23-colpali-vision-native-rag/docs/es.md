# ColPali y el documento RAG nativo de visión

> RAG tradicional analiza los PDF en texto, se divide en trozos, incrusta trozos, almacena vectores. Cada paso pierde la señal: OCR deja caer los datos de los gráficos, la fragmentación rompe las filas de tablas, los embebidos de texto ignoran las cifras. ColPali (Faysse et al., julio 2024) hizo la pregunta más simple: ¿por qué extraer texto en absoluto? Embed la imagen de la página directamente a través de PaliGemma, utilice la interacción tardía de estilo ColBERT para la recuperación, y guarde toda la disposición, las figuras, las fuentes y la señal de formato que lleva el documento. Indicadores de referencia publicados: 20-40% mejor precisión de extremo a extremo que el texto-RAG en documentos ricos en imágenes. ColQwen2, ColSmol y VisRAG ampliaron el patrón. Esta lección lee la tesis de RAG nativo de la visión y construye un pequeño índice similar a ColPali.

**Type:** Build
**Languages:** Python (stdlib, multi-vector indexer + MaxSim scorer), TypeScript
**Prerequisites:** Phase 11 (LLM Engineering — RAG basics), Phase 12 · 05 (LLaVA)
**Time:** ~180 minutes

## Objetivos de aprendizaje

- Explica la diferencia entre la recuperación de biencoder (un vector por documento) y la recuperación de interacción tardía (muchos vectores por documento).
- Describa la operación MaxSim de ColBERT y cómo ColPali la generaliza desde tokens de texto hasta parches de imagen.
- Construir un pequeño índice similar a ColPali: página → embebedidos de parches → MaxSim sobre embebedidos de query term → páginas top-k.
- Compare el generador ColPali + Qwen2.5VL con el texto-RAG + GPT-4 en un caso de uso de facturas / informes financieros.

## El problema

El texto-RAG en los PDFs arroja la mayor parte del documento. El crecimiento de los ingresos del tercer trimestre de un informe financiero suele estar en un gráfico; los hallazgos de un informe médico están en imágenes anotadas; el bloque de firma de un contrato legal es un hecho de diseño, no un hecho de texto.

El sistema de texto-RAG:

1. PDF → texto a través de OCR / pdftotext.
2. Texto → 300-500 trozos de tokens.
3. Embedado de bi-encoder → Chunk (un vector).
4. Encuesta de usuario → incrustado → cosino similaridad → top-k trozos.
5. Unidad de trabajo + consulta → LLM.

Cinco pasos perdidos, gráficos no capturados, tablas rotas en pedazos, diseño de múltiples columnas aplanadas, anotaciones de figuras desaparecen.

Corrección de ColPali: omite OCR, embebegue la imagen de la página directamente. Utilice la interacción tardía de estilo ColBERT para la recuperación para que el modelo pueda atender a los parches de granos finos en el momento de la consulta.

## El concepto

### El proyecto de ley

ColBERT (Khattab & Zaharia, arXiv:2004.12832) es un método de recuperación de texto. En lugar de un vector por documento, produce un vector por token.

- Los tokens de consulta obtienen sus propias incorporaciones ($N_q$de los vectores).
- Los tokens de documentos obtienen embebidos ($N_d$vectores, típicamente almacenados en caché).
- Score = suma sobre los tokens de consulta de max sobre los tokens de documento de similitud cosina: $\sum_i \max_j \cos(q_i, d_j)$¿ Qué ?

Esta es la operación MaxSim. Cada token de consulta "escoge" su mejor token de documento.

Pros: fuerte recuerdo, maneja la semántica a nivel de términos.$N_d$vectores por documento, almacenamiento caro.

### ColPali

ColPali (Faysse et al., arXiv:2407.01449) aplica el patrón ColBERT a las imágenes.

- Cada página está codificada por PaliGemma (idioma ViT +) en parches: $N_p$vectores por página.
- Cada consulta de usuario (texto) se codifica en las incorporaciones de los tokens de consulta: $N_q$vectores.
- Punto = $\sum_i \max_j \cos(q_i, p_j)$, es decir, MaxSim sobre las marcas de texto de consulta y las parches de imagen de página.
- Recupera las páginas de primer nivel por puntaje total.

En el momento de ingestión de documentos: embebar cada página con PaliGemma, almacenar todas las incorporaciones de parches. En el momento de la consulta: embebar los tokens de consulta, calcular MaxSim contra todas las incorporaciones de página almacenadas, devolver páginas top-k.

Pros: de extremo a extremo supera el texto-RAG en un 20-40% en documentos ricos en visualización.

Contras: $N_p$parches × floats de 4 bytes × $D$-dim vectores por página = almacenamiento crece rápidamente. Mitigado por la cuantización de PQ / OPQ.

### ColQwen2 y ColSmol

ColQwen2 (illuin-tech, 2024-2025) sustituye PaliGemma por Qwen2-VL. Mejor codificador de base, mejor recuperación.

ColSmol es la variante a menor escala para uso local / borde. Un retriever ColSmol con ~1B parámetros se ejecuta en GPU de consumo.

### VisRAG

VisRAG (Yu et al., arXiv:2410.10594) es una variante diferente: en lugar de MaxSim en parches, agrupar cada página en un solo vector con un VLM y luego recuperar el bi-encoder.

El compromiso calidad-precio: ColPali para la calidad, VisRAG para la escala.

### M3DocRAG

M3DocRAG (Cho et al., arXiv:2411.04952) extiende la recuperación multimodal al razonamiento multicapa de documentos.

### ViDoRe  el índice de referencia

El punto de referencia de ColPali. Evaluación de recuperación de documentos visuales. Las tareas incluyen informes financieros, documentos científicos, documentos administrativos, registros médicos, manuales.

ColPali-v1 obtiene un puntaje de ~80% nDCG@5 en ViDoRe; el texto-RAG en los mismos documentos obtiene un puntaje de ~50-60%.

### El gasoducto de RAG de extremo a extremo

Para un RAG nativo de la visión:

1. Ingesta: PDF → imágenes de página → codificación PaliGemma → almacenar todos los embebedidos de parches.
2. Consultas: texto de usuario → embeddings de token de consulta → MaxSim contra todas las páginas indexadas → páginas top-k.
3. Generar: imágenes de la página superior + consulta → VLM (Qwen2.5-VL o Claude) → respuesta.

No hay OCR en ninguna parte. Las figuras, gráficos, fuentes, diseño todo fluye en la respuesta.

### Matemáticas de almacenamiento

Un informe financiero de 50 páginas con 729 parches por página y embebidos de 128 dimensiones:

- ColPali: 50 * 729 * 128 * 4 bytes = ~ 18 MB crudo, ~ 2.3 MB después de 8x PQ.
- Text-RAG: 50 trozos * 768-dim * 4 bytes = ~ 150 kB.

ColPali es ~ 120 veces más almacenamiento por documento crudo. En escala, 8x OPQ / PQ lo reduce a ~ 15x, generalmente tolerable.

### Cuando el texto-RAG todavía gana

- Documentación de texto puro sin señal de diseño (artículos wiki, registros de chat).
- Archivos de varios millones de páginas donde el almacenamiento domina el costo.
- Se aplican requisitos regulatorios estrictos que exigen que el texto OCR extraíble se extraiga junto con la recuperación.

Para todo lo demás en 2026  informes financieros, artículos científicos, contratos legales, registros médicos, documentación UX  RAG nativo de visión gana.

```figure
mm-maxsim
```

## Usalo

`code/main.py`¿Qué es esto ?

- Encodrador de parches de juguete: mapea una "página" (pequeña cuadrícula de vectores de características) a una matriz de embebedidos de parches.
- MaxSim puntuación: calcula la puntuación de estilo ColBERT entre un conjunto de embedding de token de consulta y un conjunto de parches de página.
- Indexa 5 páginas de juguete, ejecuta 3 consultas, devuelve el top-k con puntajes.

## Envío

Esta lección produce`outputs/skill-vision-rag-designer.md`. Dado un proyecto de documento-RAG, elige ColPali / ColQwen2 / VisRAG / texto-RAG y mide el almacenamiento.

## Los ejercicios

1. Un informe anual de 200 páginas en 729 parches por página, emblemas de 128 dimensiones, floats de 4 bytes.

2. MaxSim es$\sum_i \max_j \cos(q_i, p_j)$¿Qué capta esta suma que una simple significa similaridad no?

3. ColPali indexa las páginas como conjuntos de parches. ¿Qué cambios si en su lugar indexamos a nivel de palabras (como ColBERT hace)?

4. Diseñar la línea de tubería de extremo a extremo para un corpus de 1M páginas con un presupuesto de latencia de 500ms por consulta.

5. Lea M3DocRAG (arXiv:2411.04952). Describa el patrón de atención de varias páginas y cómo difiere de la recuperación de una sola página de ColPali.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Late interaction | "ColBERT-style" | Retrieval using per-token or per-patch embeddings + MaxSim, not a single doc vector |
| MaxSim | "Max-over-patches" | For each query token, pick the highest-similarity document token; sum across query |
| Bi-encoder | "Single-vector" | One vector per document; faster but loses granularity |
| Multi-vector | "Many-vectors-per-doc" | Store $N_p$ vectors per document / page; storage cost grows but recall improves |
| Patch embedding | "Page feature" | One vector per image patch from a VLM encoder, cached per page |
| ViDoRe | "Vision doc bench" | ColPali's benchmark suite for visual document retrieval |
| PQ quantization | "Product quantization" | Compression that maintains vector similarity while shrinking storage ~8x |

## Leer más

- [Faysse et al. — ColPali (arXiv:2407.01449)](https://arxiv.org/abs/2407.01449)
- [Khattab & Zaharia — ColBERT (arXiv:2004.12832)](https://arxiv.org/abs/2004.12832)
- [Yu et al. — VisRAG (arXiv:2410.10594)](https://arxiv.org/abs/2410.10594)
- [Cho et al. — M3DocRAG (arXiv:2411.04952)](https://arxiv.org/abs/2411.04952)
- [illuin-tech/colpali GitHub](https://github.com/illuin-tech/colpali)
