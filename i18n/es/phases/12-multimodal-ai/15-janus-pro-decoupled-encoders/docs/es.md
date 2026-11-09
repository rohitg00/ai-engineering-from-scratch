# Janus-Pro: Encoders descoplados para modelos multimodal unificados

> Los modelos multimodal unificados tienen una tensión inevitable. La comprensión necesita características semánticas  SigLIP o DINOv2 vectores de salida ricos en información de nivel de concepto. La generación quiere códigos amigables con la reconstrucción. Tokens VQ que componen de nuevo en píxeles nítidos. Los dos objetivos no son compatibles en un solo codificador. Janus (DeepSeek, octubre 2024) y Janus-Pro (DeepSeek, enero 2025) argumentan que la solución es dejar de intentar: desacoplar los dos codificadores. Comparte el cuerpo del transformador entre las tareas, pero la comprensión de ruta a través de SigLIP y generación a través de un tokenizer VQ. En 7B, Janus-Pro vence a DALL-E 3 en GenEval mientras que coincide con LLaVA en MMMU. Esta lección explica por qué dos codificadores funcionan cuando uno falla.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, dual-encoder routing + shared-body signal)
**Prerequisites:** Phase 12 · 13 (Transfusion), Phase 12 · 14 (Show-o)
**Time:** ~120 minutes

## Objetivos de aprendizaje

- Explica por qué un único codificador compartido compromete la comprensión o la calidad de generación.
- Describa el enrutamiento de Janus-Pro: SigLIP funciona en el lado de entrada para la comprensión, tokens VQ tanto en entrada como en salida para la generación.
- Traza la escalación de mezcla de datos que hace que Janus-Pro tenga éxito donde Janus no lo hizo.
- Comparar las arquitecturas desacopladas (Janus-Pro), acopladas continuas (Transfusión) y acopladas discretas (Show-o).

## El problema

Los modelos unificados comparten un cuerpo transformador a través de la comprensión y la generación. Los intentos anteriores (Chameleon, Show-o, Transfusion) todos usan un tokenizer visual para ambas direcciones.

- Optimizado para la reconstrucción (generación): VQ-VAE captura detalles de píxeles de granos finos pero produce tokens con débil coherencia semántica.
- Optimizado para la semántica (entendimiento): SigLIP incorpora imágenes de "gato" cerca de tokens de "gato", pero no permite una buena reconstrucción.

En el caso de los proyectos de tecnología de la Unión Europea, la Comisión ha puesto en marcha un programa de investigación de la Unión Europea, que se desarrolla en el ámbito de la tecnología de la información y de la información.

## El concepto

### Código visual descoplado

La arquitectura de Janus-Pro separa los dos codificadores:

- Comprensión de la ruta. Imagen de entrada → SigLIP-SO400m → Cuerpo de transformador de 2 capas MLP.
- Camino de generación. Imagen de entrada (si se condiciona en una imagen existente) → Tokenizer VQ → IDs de token → cuerpo del transformador.
- Generación de salida. Tokens de imagen predicho por el transformador → decodificador VQ → píxeles.

El cuerpo del transformador es compartido. Todo arriba y abajo del cuerpo es específico de la tarea.

Las entradas se desambiguan por formato de respuesta: a `<understand>`Etiquetas de rutas a través de SigLIP; `<generate>`o la ruta es implícita de la tarea.

### ¿Por qué funciona esto?

La pérdida de comprensión obtiene características SigLIP, que el preentrenamiento de estilo CLIP ha ajustado para la similitud semántica.

La pérdida de generación obtiene tokens VQ, que un tokenizer ha sintonizado para la reconstrucción. La calidad de la imagen mejora en comparación con Show-o porque los códigos VQ se componen de nuevo a píxeles de forma limpia.

El cuerpo del transformador compartido ve dos distribuciones de entrada (SigLIP y VQ) y aprende a trabajar con ambos.

### Escalado de datos  Janus vs Janus-Pro

Janus (original, arXiv 2410.13848) introdujo el desacoplamiento pero a pequeña escala (1.3B parámetros, datos limitados).

- 7B parámetros (vs 1.3B).
- 90M pares de imágenes y texto para la etapa 1 (alignamiento) desde 72M.
- 72M para la etapa 2 (unificada) desde 26M.
- Se añadieron 200 mil muestras de instrucciones de generación de imágenes para la etapa 3.

El resultado: Janus-Pro-7B coincide con LLaVA en MMMU (60.3 vs ~58) y supera a DALL-E 3 en GenEval (0.80 vs 0.67). Un modelo abierto, competitivo en ambos lados del espectro unificado.

### JanusFlow  la variante de flujo rectificada

JanusFlow (arXiv 2411.07975) cambia el camino de generación de VQ por un camino de generación de flujo rectificado (continuo). La división se convierte en SigLIP-para-entendimiento + rectificado-flujo-para-generación. Los techos de calidad se elevan aún más. La arquitectura sigue siendo decoupling-encoders-shared-body.

### El trabajo del cuerpo compartido

El cuerpo del transformador procesa una secuencia unificada pero con dos distribuciones de entrada.

- Para entender: consumen las características de SigLIP + tokens de texto → emiten texto autoregresivamente.
- Para la generación: consumen tokens de texto + (tokens VQ de imagen opcionales) → emiten tokens VQ de imagen autoregresivamente.

El cuerpo no tiene pesos específicos de modalidad por bloque. Es el transformador de estilo de texto que se espera encontrar dentro de Qwen o Llama, más los dos adaptadores de entrada.

Curiosamente, esto significa que el cuerpo de Janus-Pro podría ser iniciado desde un LLM pre-entrenado. Janus-Pro inicia desde DeepSeek-MoE-7B. Esa elección importa: el LLM contribuye a la capacidad de razonamiento que los modelos unificados puros desde cero luchan por alcanzar.

### En comparación con el InternVL-U

El curso de seguimiento de 2026 se define como el curso de seguimiento de la U (lección 12.10).

- Preentrenamiento multimodal nativo (internVL3 espina dorsal).
- Enrutamiento de codificador descoplado (SigLIP en, VQ + difusión se dirige hacia fuera).
- Comprensión unificada + generación + edición.

InternVL-U incorpora la elección arquitectónica de Janus-Pro en un marco más amplio.

### Las limitaciones

Los codificadores descoplados agregan complejidad arquitectónica. Dos tokenizers para entrenar, dos vías de entrada para mantener, dos conjuntos de modos de falla. Para productos que no necesitan generación, Janus-Pro es sobre-ingeniero.

Para los productos que no requieren comprensión, Janus- Pro es sobrecalificado  elige un modelo Stable Diffusion 3 / Flux.

Para los productos que necesitan ambos, Janus-Pro es ahora la arquitectura abierta de referencia.

```figure
l5-janus-decouple
```

## Usalo

`code/main.py`simula el enrutamiento de Janus-Pro:

- Dos codificadores simulados: SigLIP-like (produce vectores semánticos de 256 dimensiones) y VQ-like (produce códigos enteros).
- Un router de instrucción que elige el codificador basado en una etiqueta de tarea.
- Un cuerpo compartido (stand-in) que procesa secuencias de tokens independientemente de cuál codificador las haya producido.
- Cambiar de la etapa 1 (alignamiento) a la etapa 3 (tón de instrucción) del calendario de muestras ponderadas.

Imprima las rutas de ruta para 3 ejemplos: imagen QA, T2I, edición de imagen.

## Envío

Esta lección produce`outputs/skill-decoupled-encoder-picker.md`. Dado que un producto que quiere generación unificada + comprensión a la calidad de la frontera, elige Janus-Pro, JanusFlow o InternVL-U con una recomendación concreta de escala de datos.

## Los ejercicios

1. Janus-Pro-7B supera a DALL-E 3 en GenEval. Explique por qué un modelo abierto 7B puede coincidir con un modelo patentado fronterizo en generación pero no en comprensión.

2. Implementar una función de enrutador: dado texto de respuesta, clasificar como `understand`o `generate`¿Cómo manejas las preguntas ambigüas como "describir y luego dibujar"?

3. JanusFlow reemplaza la ruta de VQ con un flujo rectificado. ¿Qué produce ahora el cuerpo del transformador, y qué cambios en la pérdida?

4. Proponemos una cuarta tarea que la arquitectura Janus-Pro podría manejar con un codificador más descoplado. Ejemplos: segmentación de imágenes (estilo DINO), profundidad (estilo MiDaS).

5. Leer la sección 4.2 de Janus-Pro sobre la escalación de datos. ¿Qué etapa de datos contribuye más a la ganancia de calidad de T2I vs. Janus?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Decoupled encoding | "Two visual encoders" | Separate tokenizer or encoder per direction: semantic for understanding, reconstruction for generation |
| Shared body | "One transformer" | Single transformer processes either encoder's output; no modality-specific weights |
| SigLIP for understanding | "Semantic features" | CLIP-family vision tower providing rich conceptual features but poor reconstruction |
| VQ for generation | "Reconstruction codes" | Vector-quantized tokens that decode cleanly back to pixels |
| JanusFlow | "Rectified-flow variant" | Janus-Pro with a continuous flow-matching generation head instead of VQ |
| Routing tag | "Task tag" | Prompt marker (`<understand>` / `<generate>`) that picks the input encoder |

## Leer más

- [Wu et al. — Janus (arXiv:2410.13848)](https://arxiv.org/abs/2410.13848)
- [Chen et al. — Janus-Pro (arXiv:2501.17811)](https://arxiv.org/abs/2501.17811)
- [Ma et al. — JanusFlow (arXiv:2411.07975)](https://arxiv.org/abs/2411.07975)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Dong et al. — DreamLLM (arXiv:2309.11499)](https://arxiv.org/abs/2309.11499)
