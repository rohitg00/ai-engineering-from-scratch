# Capstone 12  Video de la comprensión de la tubería (Escena, QA, búsqueda)

> Doce laboratorios producían Marengo + Pegasus. VideoDB envió la API CRUD-for-video. Molmo 2 de AI2 publicó puestos de control VLM abiertos. Gemini maneja horas de video de forma nativa. TimeLens-100K definió la tierra temporal a escala. Se ha resuelto la línea de 2026: segmentación de escena, captura + incorporación por escena, alineación de transcripción, índice multi-vector y una consulta que responde con sellos de tiempo (inicio, fin) más vistas previas de cuadros. La piedra angular está ingiriendo 100 horas, alcanzando puntos de referencia públicos, y midiendo alucinaciones en preguntas de conteo y acción.

**Type:** Capstone
**Languages:** Python (pipeline), TypeScript (UI, pipeline scaffold)
**Prerequisites:** Phase 4 (CV), Phase 6 (speech), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 12 (multimodal), Phase 17 (infrastructure)
**Phases exercised:**P4 · P6 · P7 · P11 · P12 · P17
**Time:** 30 hours

## El problema

El video de larga forma QA es el problema multimodal más hambriento de ancho de banda en la escala de 2026. Gemini 2.5 Pro puede leer un video de 2 horas de forma nativa, pero ingerir 100 horas de video en un cuerpo consultable todavía requiere un índice de nivel de escena. La forma de producción combina la segmentación de escena (TransNetV2 o PySceneDetect), la subtítulo por escena con un VLM (Gemini 2.5, Qwen3-VL-Max, o Molmo 2), la alineación de transcripción (Whisper-v3-turbo con timestamps de palabras) y un índice multi-vector que almacena la subtítulo, el marco de incorporación y la transcripción lado a lado. La línea de preguntas responde con sellos de tiempo (inicio, final) más vistas previas de los cuadros.

Los puntos de referencia son públicos (ActivityNet-QA, NeXT-GQA) más su propio conjunto personalizado de 100 consultas.

## Concepto

Tres tuberías corren en paralelo en la ingesta. **Scene segmentation**corta el video en escenas. **VLM captioning**genera una leyenda por escena y un marco incorporado desde un marco de teclado. **ASR alignment**Se trata de un sistema de captura de tiempo de nivel de palabra. Las tres corrientes se unen por (scene_id, rango de tiempo). Cada escena obtiene tres tipos de vectores en un índice multi-vector (Qdrant): captura de captura, captura de keyframe, captura de transcripción.

En el momento de la consulta, la pregunta de lenguaje natural dispara contra los tres vectores; los resultados se fusionan con RRF; un adaptador de tierra temporal (estilo TimeLens) refina la ventana (inicio, final) dentro de la escena superior. El sintetizador VLM (Gemini 2.5 Pro o Qwen3-VL-Max) toma la consulta + escenas superiores + cuadros recortados y respuestas con sellos de tiempo citados y una vista previa de cuadros.

La medición de las alucinaciones es importante. Las preguntas de conteo ("¿cuántas personas entran en la habitación?") y tipo de acción ("¿el chef derrama antes de agitar?") son notoriamente poco confiables.

## Arquitectura

```
video file / URL
      |
      v
PySceneDetect / TransNetV2  (scene segmentation)
      |
      +--- per-scene keyframe --- VLM caption + frame embedding
      |                            (Gemini 2.5 Pro / Qwen3-VL-Max / Molmo 2)
      |
      +--- audio channel --- Whisper-v3-turbo ASR + word timestamps
      |
      v
multi-vector Qdrant: {caption_emb, keyframe_emb, transcript_emb}
      |
query:
  dense queries against all three -> RRF merge -> top-k scenes
      |
      v
TimeLens / VideoITG temporal grounding (refine start/end within scene)
      |
      v
VLM synth: query + top scenes + frame previews
      |
      v
answer + (start, end) timestamps + frame thumbs + citations
```

## El establo

- Segmentación de escenas: TransNetV2 (estado de la técnica 2024-26) o PySceneDetect
- ASR: Whisper-v3-turbo a través de un susurro más rápido con sello de tiempo de palabras
- VLM capricho + respuesta: Gemini 2.5 Pro o Qwen3-VL-Max o Molmo 2
- Aterrizaje temporal: adaptador con TimeLens-100K o VideoITG
- Indice: Qdrant con soporte multivectorial (capción / marco / transcripción)
- Interfaz de usuario: Next.js 15 con reproductor de vídeo HTML5 y miniaturas de escena
- Eval: ActivityNet-QA, NeXT-GQA, conjunto de 100 preguntas etiquetado a mano
- Indicador de referencia de alucinación: subconjuntos de conteo y tipo de acción con etiquetas manuales

```figure
cf-scene-index
```

## Construye el mismo

1. **Ingest walker.**Acceptar URL de YouTube o MP4 locales. Reducir a 720p si es necesario. Persistir `{video_id, file_path}`¿ Qué ?

2. **Scene segmentation.**Ejecutar TransNetV2 o PySceneDetect para producir `[{scene_id, start_ms, end_ms, keyframe_path}]`Objetivo 100 horas: 6K-8K escenas.

3. **ASR pass.**Ejecutar Whisper-v3-turbo en audio; exportar timestamps de nivel de palabra; dividir en recortes de transcripción por escena.

4. **VLM captioning.**Por escena, llame Gemini 2.5 Pro (o Qwen3-VL-Max) con el marco de teclas y una plantilla de captura corta. Produce captura + incorporación de marco.

5. **Multi-vector index.**Colección de Qdrant con tres vectores nombrados.`{video_id, scene_id, start_ms, end_ms, keyframe_url}`¿ Qué ?

6. **Query.**La pregunta de lenguaje natural dispara tres preguntas densas; se fusionan con la fusión de rango recíproca; top-k=5 escenas.

7. **Temporal grounding.**Ejecutar el adaptador de estilo TimeLens en la escena superior para refinar la ventana (inicio, final) dentro de la escena.

8. **VLM synth.**Llame a Gemini 2.5 Pro con consulta + 3 clips de escena (como imágenes o clips cortos) + transcripciones.`(video_id, start_ms, end_ms)`las citas.

9. **Eval.**Ejecutar ActivityNet-QA y NeXT-GQA. Construir un conjunto personalizado de 100 consultas. Informar precisión general + desglose por clase (contado, acción, descriptiva).

## Usalo

```
$ video-qa ask --url=https://youtube.com/watch?v=X "how many cars pass the intersection in the first minute?"
[scene]    23 scenes detected
[asr]      transcript complete, 4m12s
[index]    69 vectors written (23 scenes x 3)
[query]    top scene: scene 3 [01:32-01:54], confidence 0.84
[ground]   refined window: [00:12-00:58]
[synth]    gemini 2.5 pro, 1.4s
answer:    5 cars pass the intersection between 00:12 and 00:58.
citations: [scene 3: 00:12-00:58]
          [frame preview at 00:14, 00:27, 00:44, 00:51, 00:57]
```

## Envío

`outputs/skill-video-qa.md`Se le da una URL de YouTube o un video subido, la tubería indexa las escenas y responde preguntas con citas marcadas en el tiempo.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Temporal grounding IoU | Intersection-over-union on held-out grounding set |
| 20 | QA accuracy | NeXT-GQA and custom 100-query |
| 20 | Ingest throughput | Hours of video per dollar spent |
| 20 | UI and citation UX | Timestamp links, thumbnail strip, jump-to-frame |
| 15 | Hallucination rate | Counting and action-type accuracy separately |
| **100** | | |

## Los ejercicios

1. Cambiar Gemini 2.5 Pro por Qwen3-VL-Max en el pase de subtítulos.

2. Reducir la incorporación de cuadros por escena a un vector en lugar de multi-vector.

3. Construir un modo "conte estricto": el sintetizador extrae cada instancia contada con un sello de tiempo y el usuario hace clic para verificar.

4. Costo de ingesta de referencia: horas de vídeo por dólar en tres opciones VLM.

5. Añadir una transcripción diarizada por altavoz: ejecutar la diarización de altavoces de pyannote en el audio e incrustar transcripciones por altavoz.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Scene segmentation | "Shot detection" | Cutting video into scenes at shot boundaries |
| Multi-vector index | "Caption + frame + transcript" | Qdrant collection with named vectors per representation |
| Temporal grounding | "When exactly did it happen" | Refining the (start, end) window for a query answer |
| Frame embedding | "Visual representation" | A vector embedding of a keyframe; used for scene-visual similarity |
| RRF fusion | "Reciprocal rank fusion" | Merge strategy across multiple ranked lists; a classic hybrid-retrieval trick |
| Counting hallucination | "Miscount" | Known failure mode of VLMs on "how many X" questions |
| ActivityNet-QA | "Video-QA benchmark" | Long-form video QA accuracy benchmark |

## Leer más

- [AI2 Molmo 2](https://allenai.org/blog/molmo2) abrir los puestos de control de VLM
- [TimeLens (CVPR 2026)](https://github.com/TencentARC/TimeLens) Terreno temporal a escala
- [Gemini Video long-context](https://deepmind.google/technologies/gemini) la referencia alojada
- [VideoDB](https://videodb.io) Referencia de la API CRUD para vídeo
- [Twelve Labs Marengo + Pegasus](https://www.twelvelabs.io) Referencia comercial
- [TransNetV2](https://github.com/soCzech/TransNetV2) Modelo de segmentación de escenas
- [PySceneDetect](https://github.com/Breakthrough/PySceneDetect) alternativa clásica abierta
- [ActivityNet-QA](https://arxiv.org/abs/1906.02467) Valoración de referencia
