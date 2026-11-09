# Recuperación de RAG multimodal y de recopilación transmodal

> El documento RAG de visión nativa es una sola rebanada. La producción multimodal RAG se expande  la recuperación de texto, imágenes, audio y video para flujos de trabajo como la planificación de viajes ("encontradme un brunch vegano tranquilo con luz natural"), triaje médico ("qué lesión coincide con esta foto + estas notas"), comercio electrónico ("trajes similares a este selfie, en mi tamaño") y servicio de campo ("diagnóstico este sonido del motor más foto de la parte"). Tres encuestas de 2025  Abootorabi et al., Mei et al., Zhao et al.  codificó los subproblemas: recuperación transmodal, fusión de recuperación, generación de tierra, evaluación multimodal. Esta lección lee las encuestas y diseña una línea de producción.

**Type:** Build
**Languages:** Python (stdlib, cross-modal retriever with fusion + grounded generator), TypeScript
**Prerequisites:** Phase 12 · 23 (ColPali), Phase 11 (RAG basics)
**Time:** ~180 minutes

## Objetivos de aprendizaje

- Diseño de recuperación transmódica: texto → imagen, imagen → texto, audio → video, etc.
- Comparar tres estrategias de fusión: fusión de puntaje, fusión basada en la atención, fusión de MoE.
- Explica la generación de tierra: cómo se ve "citar sus fuentes" cuando las fuentes son una mezcla de modalidades.
- Nombre de las tres encuestas multimodales canónicas de RAG de 2025 y su taxonomía de subproblemas.

## El problema

RAG de modalidad única es un patrón resuelto: incrustar consulta, incrustar trozos, recuperar, cosas en LLM. RAG multimodal requiere:

1. Capaces de extracción múltiples (cada modalidad necesita incorporaciones en un espacio compatible).
2. Fusión de resultados de recuperación en diferentes modalidades.
3. La generación de tierra que cita fuentes en todas las modalidades.
4. Metricas de evaluación que cubren la señal transmódica.

Las encuestas de 2025 llegan todas a la misma taxonomía.

## El concepto

### Recuperación transmódica

Recoger documentos de modalidad B en una consulta de modalidad A. Tres patrones:

1. Espacio de incorporación compartido. CLIP y CLAP producen embedidos de texto + imagen / texto + audio en un espacio compartido. La similitud de cosinos entre modalidades funciona directamente.

2. Encodrador de modalidad + traducción. Encodrador de texto + encodrador de imagen + un pequeño módulo de traducción que mapea entre espacios. Sen2Sen de Gupta et al. y otros diseños de 2024. Flexible pero añade complejidad.

3. VLM como codificador. Utilice los estados ocultos de un VLM como la representación de recuperación. Cualquier modalidad que el VLM admita funciona.

Opción: CLIP / SigLIP 2 para texto + imagen; CLAP para texto + audio; VLM-estados ocultos para trans-modal en calidad fronteriza.

### Estrategias de fusión

Recuperaste 10 resultados: 5 imágenes, 3 pasajes de texto, 2 clips de audio. ¿Cómo se fusiona?

Fusión de puntajes (más barato). Cada modalidad tiene su propio retriever, cada uno devuelve puntajes. Normaliza las puntuaciones dentro de la modalidad y luego suma.

Fusión basada en la atención. Concatenar todos los objetos recuperados, dejar que una pequeña red de atención los pese.

Fusión de MoE. Gating de rutas de red a expertos específicos de modalidad. Diferentes tipos de consultas rutas de manera diferente  una pregunta visual pesa imágenes más alto.

Producción por defecto: puntuación de fusión con un ligero sesgo hacia la modalidad dominante de la consulta. actualizar a MoE si A / B muestra claras victorias en su dominio.

### Aterrizaje de generación

La MLL debe citar qué elemento recuperado impulsó cada reclamo.

- Fuente de texto: citación estándar `[1]`¿ Qué ?
- Fuente de imagen: `[img 3]`con una breve leyenda.
- Audio: `[audio 2 at 0:34]`¿ Qué ?

Entrenando al generador con datos conocedores de la base: cada afirmación en el objetivo de entrenamiento está etiquetada con el índice de origen.

### Las encuestas de 2025

Abootorabi et al. (arXiv:2502.08826, "Ask in Any Modality"): taxonomía para RAG multimodal. Cubre la recuperación, fusión, generación. Cobertura más amplia.

Mei et al. (arXiv:2504.08748, "Una encuesta de RAG multimodal"): se centra en los puntos de referencia de subtareas y modos de falla.

Zhao et al. (arXiv:2503.18016): encuesta centrada en la visión.

Leer los tres te da el estado del arte a partir de la primavera de 2025.

### MuRAG  el documento de base

MuRAG (Chen et al., 2022) fue el primer RAG multimodal. Recuperó imagen + texto de un KB multimodal, generó respuestas.

### Un ejemplo de planificador de viajes de producción

Pregunta: "Encuentra un brunch vegano tranquilo con luz natural".

El gasoducto:

1. Descompone la consulta. "quiet" → palabra clave de audio/revisión; "vegan brunch" → elemento del menú; "luz natural" → función de imagen.
2. Recuperación por modalidad:
   - Recuperación de texto en las reseñas: "brunch vegano, ambiente tranquilo".
   - Recuperación de imágenes en fotos de restaurantes: "luz natural, aireada".
   - Recuperación de audio en clips de sonido ambiente: "bajo decibel, sin música".
3. Cada restaurante tiene una puntuación compuesta.
4. Restaurantes Top-k → Generador VLM con toda la evidencia → respuesta con citas.

Esto va mucho más allá del texto-RAG. Cada modalidad añade una señal que el texto solo pierde.

### Agentes de RAG multimodal

Multi-hop: si la primera recuperación no devuelve respuestas de alta confianza, el LLM reformula y recupera de nuevo.

- Recuperar el top-10 inicial → LLM pide "demasiado ruidoso, filtro para <40 dB" → recuperar de nuevo.
- Recuperar imágenes → LLM ve que uno tiene un menú → recuperar el texto del menú → respuesta.

Agrega complejidad pero maneja consultas que la recuperación de un solo disparo no puede.

### Evaluación

La evaluación transmodal es aún inmadura.

- Recall@k por modalidad.
- Precisión top-k fusionada.
- La satisfacción de extremo a extremo, según el juicio humano.
- Específico de tarea (reservas completadas, compras realizadas).

No hay un índice de referencia estándar que abarque todas las modalidades.

```figure
contrastive-matrix
```

## Usalo

`code/main.py`¿Qué es esto ?

- Tres simuladores de retriever (texto, imagen, audio) que operan en un conjunto compartido de restaurantes.
- Fusión de puntuaciones que combina puntuaciones de modalidad con pesos configurables.
- Un generador que emite una respuesta final con citas.
- Un simple bucle agente que reformula la consulta si la confianza es baja.

## Envío

Esta lección produce`outputs/skill-multimodal-rag-designer.md`. Dado un producto específico con un flujo de consulta multimodal, diseña retrievers, fusión, generador y evaluación.

## Los ejercicios

1. Proponer una RAG multimodal de triaje médico: consulta = foto de lesión + síntomas de texto. ¿Qué modalidades se extraen de qué KB?

2. La fusión de puntajes es una suma ponderada simple. ¿Qué modo de falla tiene que la fusión de MoE evita?

3. Leer la taxonomía de Abootorabi et al. (Sección 3). ¿Cuáles son los tres subproblemas canónicos y cómo se corresponden al producto que usted ha elegido?

4. Diseñar una especificación de evaluación para un RAG multimodal de planeador de viajes. ¿Qué métricas cubren el recuerdo de imágenes, el recuerdo de audio y la corrección compuesta?

5. El RAG multi-hop agencial tiene un impuesto de latencia por ida y vuelta. ¿En qué dificultad de consulta justifica la ganancia de precisión la latencia?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Cross-modal retrieval | "Query one modality, retrieve another" | Text query retrieves images; image query retrieves text; requires a shared space or translator |
| Score fusion | "Combine scores" | Weighted sum of per-modality retrieval scores; simplest fusion |
| MoE fusion | "Modality-routed experts" | Gating network picks which modality's scores to trust per query |
| Grounded generation | "Cite your sources" | Each claim in the answer tagged with the source index |
| MuRAG | "First multimodal RAG" | 2022 paper that established the multimodal RAG pattern |
| Agentic multi-hop | "Reformulate and retry" | LLM re-queries retrievers when first-pass confidence is low |

## Leer más

- [Abootorabi et al. — Ask in Any Modality (arXiv:2502.08826)](https://arxiv.org/abs/2502.08826)
- [Mei et al. — A Survey of Multimodal RAG (arXiv:2504.08748)](https://arxiv.org/abs/2504.08748)
- [Zhao et al. — Vision RAG Survey (arXiv:2503.18016)](https://arxiv.org/abs/2503.18016)
- [Chen et al. — MuRAG (arXiv:2210.02928)](https://arxiv.org/abs/2210.02928)
- [Liu et al. — REACT (arXiv:2301.10382)](https://arxiv.org/abs/2301.10382)
