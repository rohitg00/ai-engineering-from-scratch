# InternVL3: Pretraño Multimodal Nativo

> Cada VLM abierto antes de InternVL3 siguió la misma receta de tres pasos: tomar un texto LLM entrenado en billones de tokens de texto, conectar un codificador de visión, y luego ajustar las costuras. Esto funciona pero tiene deuda de alineación  el texto LLM ha gastado todo su presupuesto pre-entrenamiento en texto puro y no entiende nativamente los tokens visuales. Cuando se añade visión post hoc, el LLM tiene que volver a aprender a relacionar la entrada visual con su razonamiento del texto sin olvidar el texto. InternVL3 (Zhu et al., abril 2025) rechaza el enfoque post hoc: una carrera previa al entrenamiento, texto y multimodal entrelazados desde el primer paso. El resultado coincide con Gemini 2.5 Pro en MMMU-Pro en 78B parámetros abiertos. Esta lección lee el caso de la preentrenamiento nativo y lo que cambia cuando lo haces.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, training-corpus mixer)
**Prerequisites:** Phase 12 · 05, Phase 12 · 07 (recipes)
**Time:** ~120 minutes

## Objetivos de aprendizaje

- Explica por qué la formación post hoc en VLM acumula deudas de alineación, citando los tres síntomas medibles (olvido catastrófico, deriva de respuesta, inconsistencia visual-textual).
- Describa la mezcla de corpus pre-entrenamiento de InternVL3 y por qué importa la proporción de texto: entrelazado: subtítulo.
- Comparar V2PE (codificación de posición visual variable) con el M-RoPE de Qwen2-VL.
- Nombre de las optimizaciones de implementación de Router de Resolución Visual (ViR) y lenguaje de visión descoplado (DvD).

## El problema

El entrenamiento post-hoc VLM es el predeterminado. LLaVA, BLIP-2, Qwen-VL, Idefics  todos toman un LLM ya pre-entrenado (Llama, Vicuna, Qwen, Mistral) y agregan visión.

1. LLM congelado + codificador de visión congelada + proyector entrenable, entrenado en pares de captura para alinear los embebidos.
2. Descongelar el LLM, entrenar en datos de instrucción (LLaVA-Instruct, ShareGPT4V).
3. Opcional ajuste específico de tarea.

Tres síntomas de la deuda de alineación se muestran:

- El VLM post hoc olvida las habilidades de texto, las puntuaciones de GSM8K caen de 5 a 10 puntos, las puntuaciones de Hellaswag caen, los agentes de texto puro regresan.
- Las frases pequeñas de la misma pregunta visual obtienen respuestas diferentes. El codificador de visión se conecta con el LLM con vínculos más débiles que los tokens del LLM.
- La VLM puede describir una imagen correctamente y luego responder a una pregunta que contradice su propia descripción.

Los síntomas de la enfermedad son bien documentados. MM1.5 Sección 4 los cuantifica. Las ablaciones de LLaVA-OneVision indican que son.

## El concepto

### Prea capacitación multimodal nativa

InternVL3 se desarrolla desde cero en un corpus que es nativo multimodal desde el primer paso.

- 40% de datos sólo de texto (FineWeb, Proof-Pile-2, etc.)
- 35% de datos de texto-imagen entrelazados (OBELICS, estilo MMC4)
- 20% de datos de captura de imagen emparejados
- 5% de datos de texto de vídeo

Los tokens de visión, los tokens de texto y las interacciones transmódales participan en la misma pérdida desde el primer paso de gradiente.

El modelo base es una etapa única, y se sigue la instrucción, pero el modelo base ya entiende los tokens visuales como ciudadanos de primera clase.

### V2PE (codificación de posición visual variable)

Qwen2-VL utiliza M-RoPE con asignación de eje fijo. InternVL3 introduce V2PE: el codificación de posición varía según el tipo de modalidad (texto, imagen, video) con escalabilidad de aprendizaje.

- Los tokens de texto obtienen posición 1D (índice de texto).
- Los parches de imagen obtienen posición 2D (fila, columna).
- Los cuadros de vídeo obtienen posición 3D (tiempo, fila, col).

Los tres comparten la misma base de frecuencia RoPE, pero la asignación de oscuridad oculta por banda es un parámetro aprendido en lugar de una división fija.

La afirmación de ablación de V2PE: 1-2 puntos en los puntos de referencia de vídeo sobre M-RoPE en el mismo cálculo.

### Router de resolución visual (ViR)

Optimización de implementación. No todas las imágenes necesitan codificación de resolución completa. Una foto con un objeto en bajo detalle desperdicia tokens cuando se codifica en 1280px nativo. ViR es un clasificador pequeño que predice la resolución mínima necesaria para responder a la pregunta, antes de codificar.

El enrutamiento tiene tres niveles: bajo res (256 tokens), medio (576), alto (2048+). Para el 60% de las consultas en el tráfico de producción, es suficiente bajo o medio. Efecto neto: 2-3x de rendimiento a la misma calidad.

### Desarrollo de lenguaje de visión descoplado (DvD)

Cuando se sirve un VLM grande, el codificador de visión se ejecuta una vez por imagen, pero el LLM se ejecuta autoregresivamente para cada token de salida. Los dos componentes tienen diferentes cuellos de botella (visión = ancho de banda de memoria de GPU para conv + atención; LLM = caché KV).

Para un modelo de codificador 8B + 400M, DvD aproximadamente duplica el rendimiento por nodo frente a co-localizado.

### Calidad de una sola etapa frente a una de varias

El primer punto de referencia de InternVL3 es que en 78B params, coincida con el MMMU-Pro de Gemini 2.5 Pro. En 38B, coincida con el GPT-4o. En 8B, lidera el tablero de clasificación de 8B abierto. Todo en una receta de preparación de una sola etapa + instrucción-tune.

La hipótesis de la deuda de alineación es medible: InternVL3-8B pierde menos puntos de referencia de texto (MMLU, GSM8K) que Qwen2.5-VL-7B por unidad de ganancia de referencia de visión.

### El procedimiento de evaluación de las medidas de seguridad

InternVL3.5 (agosto 2025) escala la receta. El mismo enfoque nativo de pretrain, más datos, más parámetros. Las mejoras en MMMU son incrementales.

InternVL-U (2026) añade la generación unificada  de imagen a través de cabezas MMDiT en la parte superior de la misma columna vertebral. La "U" significa "Entendimiento + generación", que persigue modelos unificados de estilo Transfusión (Lección 12.13).

### Compromiso de la formación preescolar nativa

El preentrenamiento nativo no es gratuito:

- Computación. Entrenar un nuevo VLM desde cero cuesta lo mismo que entrenar un LLM de texto  millones de horas de GPU. La adaptación post-hoc reutiliza los pesos existentes del LLM, ahorra la mayor parte del costo.
- Los datos. Corporaciones de imagen y texto intercaladas en escala son raras. OBELICS es 141M documentos; MMC4 es 571M. El texto solo se envía a fichas de 15T. La escasez de datos de pretraining multimodal es una dura restricción.
- La formación pre-entrenamiento nativo deja la opción de dejar un nuevo LLM más tarde.

La apuesta que InternVL3 hace: la deuda de alineación es peor que la pérdida de reutilización. Los puntos de referencia respaldan la afirmación. El costo de producción impide que los laboratorios futuros replicen a bajo costo.

```figure
l5-native-pretrain
```

## Usalo

`code/main.py`es un mezclador de entrenamiento y un simulador de enrutador ViR.

- Toma una mezcla de corpus objetivo (% texto, % interleaved, % caption, % video) y calcula los pasos esperados por modalidad.
- Simula el enrutamiento de ViR en un lote de consultas (distribución: 50% de detalle bajo, 30% de detalle medio, 20% de detalle alto) e informa el recuento promedio de tokens.
- Se informa de las estimaciones de rendimiento de DvD en función de los FLOPs de codificación frente a los FLOPs de MLL.
- Imprime un lado a lado de la post hoc vs nativo pre-entrenamiento en params, computación, datos, y los síntomas de alineación-deuda esperados.

## Envío

Esta lección produce`outputs/skill-native-vs-posthoc-auditor.md`. Dado que se propone un plan de formación para el VLM, el programa evalúa si se debe realizar una formación nativa o post-hoc, señala el riesgo de alineación y deuda y recomienda una combinación de corpus.

## Los ejercicios

1. Estima el delta de cálculo entre InternVL3-8B (pre-treino nativo) y LLaVA-OneVision-7B (post-hoc).

2. InternVL3 informa 40% de texto / 35% entrelazado / 20% de título / 5% de vídeo. Si su tarea objetivo es video-pesado, proponga una nueva proporción y argumentar por qué el modelo base todavía necesita datos sustanciales de texto y título.

3. En el caso de los niños, el número de niños que se han ido a estudiar en el instituto de formación de post hoc es el número de niños que han tenido que regresar a la escuela.

4. ViR envía el 60% del tráfico a codificación de baja resolución. ¿Qué tipos de consultas desvía (envía a baja resolución cuando se necesita alta resolución)? Propón tres modos de falla del router.

5. DvD divide la visión y LLM en GPUs separadas. ¿Bajo qué patrón de tráfico DvD perjudica el rendimiento en lugar de ayudar?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Native multimodal pretraining | "From scratch together" | Text + image + video tokens participate in the loss from step 1, not bolted on later |
| Alignment debt | "Post-hoc penalty" | Measurable regression in text skills and answer consistency that comes from bolting vision onto a frozen LLM |
| V2PE | "Variable visual pos encoding" | Per-modality learnable position encoding allocation; InternVL3's M-RoPE successor |
| ViR | "Resolution router" | Small classifier that picks minimum resolution needed per query before encoding, saving inference tokens |
| DvD | "Decoupled deployment" | Vision encoder on one GPU, LLM on another, with stream handoff; doubles throughput for large VLMs |
| InternVL-U | "Unified understanding + generation" | 2026 follow-up that adds image-generation heads to the native-pretrain backbone |
| Interleaved corpus | "OBELICS / MMC4" | Documents with text and images in natural reading order; the raw material for native pretraining |

## Leer más

- [Chen et al. — InternVL 1 (arXiv:2312.14238)](https://arxiv.org/abs/2312.14238)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
- [InternVL3.5 (arXiv:2508.18265)](https://arxiv.org/abs/2508.18265)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Zhang et al. — MM1.5 (arXiv:2409.20566)](https://arxiv.org/abs/2409.20566)
