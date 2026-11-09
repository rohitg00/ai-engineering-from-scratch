# Video de la familia Qwen-VL y de la FPS dinámica

> La familia Qwen-VL  Qwen-VL (2023), Qwen2-VL (2024), Qwen2.5-VL (2025), Qwen3-VL (2025)  es el linaje de modelos de lenguaje de visión abierta más influyente en 2026. Cada generación hizo una apuesta arquitectónica única decisiva que el resto del ecosistema abierto copió en doce meses: resolución dinámica nativa a través de M-RoPE, muestreo dinámico-FPS con alineación de tiempo absoluta, atención de ventana en el ViT y formatos de salida de agente estructurados. Por Qwen3-VL, la receta se había estabilizado: un codificador 2D-RoPE-ViT con entradas nativas de relación de aspecto, un proyector MLP en una gran base de lenguaje Qwen3, y etapas de entrenamiento que enfatizaron el comportamiento de OCR, la tierra y el agente como objetivos de primera clase. Esta lección lee la familia cronológicamente para que entiendas por qué cada botón está donde está.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, M-RoPE encoder + dynamic-FPS sampler)
**Prerequisites:** Phase 12 · 06 (patch-n'-pack)
**Time:** ~120 minutes

## Objetivos de aprendizaje

- Calcule las rotación de tres ejes de M-RoPE (temporal, altura, ancho) y explique por qué se necesitan las tres.
- Elija una estrategia de muestreo dinámico-FPS para un video y razonar sobre las fichas-por-segundo vs. la precisión de detección de eventos.
- Nombre las cuatro actualizaciones generacionales de Qwen-VL en orden y lo que cada una habilitado.
- Enviar un formato de salida de agente JSON de estilo Qwen2.5-VL y analizar las llamadas de herramientas estructuradas de una respuesta VLM.

## El problema

Qwen-VL fue lanzado en agosto de 2023 como respuesta directa a LLaVA-1.5 y BLIP-2. La brecha que el equipo de Qwen se centró en fue triple: resolución, vídeo y salida estructurada.

Resolución: LLaVA-1.5 funcionó a 336x336. Muy bien para fotos, inútil para una factura en chino o una pantalla de hoja de cálculo densa. La primera innovación de Qwen-VL fue 448x448 y la salida de la caja de límite de tierra, dejando que el modelo apunte a las cosas.

Video: Video-LLaMA apilaron codificadores por marco y los alimentaron al LLM. Funcionó para clips cortos, no para videos de varios minutos donde el eje temporal es la señal.

Producción estructurada: LLaVA emitió texto de forma libre. Un agente necesita JSON. Qwen-VL entrenado en formatos de salida JSON explícitos, incluidas las coordenadas de la caja de límite como texto.

Cada generación de Qwen-VL extiende uno de estos tres ejes.

## El concepto

### Qwen-VL (agosto 2023)

La primera generación: OpenCLIP ViT-bigG/14 como codificador (2.5B parámetros), Q-Former compatible con LLama (1 paso con 256 consultas), base Qwen-7B. Contribuciones:

- Resolución 448x448 (entonces SOTA para un VLM abierto).
- "El gato está en <box>112, 204), (280, 344)</box>".
- Formación multilingüe en chino + inglés desde el principio.

En la época, los puntos de referencia eran competitivos con el GPT-4V en inglés, dominantes en chino.

### Qwen2-VL (septiembre 2024)  M-RoPE y resolución nativa

Qwen2-VL reemplazó la pila de resolución fija + Q-Former con un codificador ViT de resolución dinámica nativo.

- Resolución dinámica nativa. El ViT acepta cualquier HxW divisible por 28 (parche 14 con 2x fusión espacial). Una imagen en 1120x672 (40x24 parches fusionados) produce 960 tokens visuales.
- M-RoPE (RoPE multimodal). Cada token lleva una posición 3D (t, h, w) en lugar de 1D. Para imágenes t = 0, para video t = frame_index. RoPE gira los vectores de consulta / clave por una frecuencia por eje. No hay tabla de inserción posicional.
- Descarga el Q-Former, usa un MLP de dos capas en los tokens de parches fusionados.
- Video con FPS dinámico. El video muestra a 1-2 FPS por defecto, pero el modelo acepta recuentos de cuadros arbitrarios.

Resultado: Qwen2-VL-7B coincidió con GPT-4o en varios puntos de referencia multimodal y lo superó en DocVQA (94.5 vs 88.4).

### Qwen2,5-VL (febrero 2025)  FPS dinámico + tiempo absoluto

El cambio principal de Qwen2.5VL fue el video.

- El eje temporal de M-RoPE sigue las marcas de tiempo reales, por lo que la brecha entre las marcas de dos marcas rastrea los segundos entre ellas. "A 0:04, el gato salta".
- FPS dinámico. Muestra a 1 FPS para imágenes lentas, 4+ FPS para acción. El usuario o entrenador elige; M-RoPE se adapta.
- La atención espacial se hace por ventanas (local dentro de los bloques) para el rendimiento; la atención global cada pocas capas.
- Formato de salida JSON explícito. entrenado en la herramienta de llamadas de datos: "{\"herramienta\": \"clic\", \"coords\": [380, 220]}". Agente listo de la caja.
- Escalado MRoPE-v2. Escalado posiciones con el tamaño máximo de entrada para que un video de 10 minutos no se agota del rango de frecuencia.

Compartidos: Qwen2.5-VL-72B supera a GPT-4o en la mayoría de los puntos de referencia de vídeo, coincide con Gemini 2.0 en documentos y establece el modelo abierto SOTA para la conexión a tierra de la interfaz gráfica (ScreenSpot: 84% de precisión frente a 38% para GPT-4o).

### Qwen3-VL (novembre 2025)

Qwen3-VL es una actualización incremental que consolida en lugar de reinventar: la columna vertebral de LLM más grande (Qwen3-72B), los datos de capacitación ampliados, la OCR mejorada, un razonamiento más fuerte a través del "modo de pensamiento" de Qwen3.

El resultado de la línea: para 2025 la arquitectura Qwen-VL se había estabilizado.

### M-RoPE matemáticamente

El RoPE clásico gira una consulta `q`de dimensiones `d`por posición `m`utilizando coordenadas emparejadas:

```math
\begin{aligned}
q_{\text{rot}}[2i] &= q[2i] \cos(m \theta_i) - q[2i+1] \sin(m \theta_i) \\
q_{\text{rot}}[2i+1] &= q[2i] \sin(m \theta_i) + q[2i+1] \cos(m \theta_i) \\
\theta_i &= 10000^{-2i/d}
\end{aligned}
```

M-RoPE divide el oscuro escondido en tres bandas.`d = 96`. Asesinar 32 puntos de menor tamaño a la altura, 32 a la anchura. Cada banda gira por su propia posición en el eje.`R_t(5)`¿ Qué ?`R_h(10)`¿ Qué ?`R_w(20)`se aplica a sus tres bandas.

Uso de tokens de texto `t = text_index, h = 0, w = 0`(o una opción normalizada), manteniendo la compatibilidad.`t = frame_time, h = row, w = col`. Uso de imágenes únicas `t = 0`¿ Qué ?

El beneficio: una codificación de posición maneja texto, imagen y video sin código ramificado o tablas de posición diferentes.

### Logicas de muestreo de FPS dinámico

Dado un video de duración `T`segundos y un presupuesto de tokens objetivo `B`¿Qué es esto ?

1. Calcule el máximo de FPS que pueda permitirse: `fps_max = B / (T * tokens_per_frame)`¿ Qué ?
2. Elige un FPS objetivo de `{1, 2, 4, 8}`que satisface `fps <= fps_max`¿ Qué ?
3. Si el movimiento es alto (heurística de flujo óptico o solicitud explícita del usuario), elija un FPS más alto.
4. Muestra uniformemente en el FPS elegido; establece la identificación temporal M-RoPE de cada marco desde su sello de tiempo en segundos.

Qwen2.5-VL entrena esta lógica implícitamente; en la inferencia el usuario controla a través de `fps`Parámetro: Una secuencia de acción de 60 segundos a 4 FPS con 81 tokens por fotograma = 19440 tokens, manejable en un contexto de 32k.

### Producción de agentes estructurados

La formación de agentes de Qwen2.5VL se dirige explícitamente a las llamadas de herramientas estructuradas:

```
{
  "tool": "mouse_click",
  "coords": [1024, 512],
  "button": "left",
  "modifier": null
}
```

El parse es determinista: JSON.parse sobre la salida del modelo. Comparar con el formulario libre "clic en (1024, 512) " que requirió el manejo de regex y ambigüedad. El cambio es por lo que las puntuaciones de ScreenSpot de Qwen2.5-VL saltaron del 55% a 84% de Qwen2-VL.

```figure
mm-mrope-axes
```

## Usalo

`code/main.py`los instrumentos:

- Computación de posición M-RoPE para una secuencia de mezcla de texto, parches de imagen y marcos de vídeo.
- Muestra de FPS dinámico: dada (tiempo de duración, presupuesto, movimiento_nivel), seleccione FPS y emita marcas de tiempo del marco.
- Un parser de salida de JSON Qwen2.5VL que maneja las respuestas de llamadas de herramientas con campos de coordenadas.

Ejecutarlo, y luego sienta la diferencia cuando cambias FPS fijo por FPS dinámico en un video de 5 minutos.

## Envío

Esta lección produce`outputs/skill-qwen-vl-pipeline-designer.md`. Dado una tarea de vídeo (monitoreo, agente, reconocimiento de acción, accesibilidad), emite la configuración Qwen2.5VL (orden de cuadro, estrategia FPS, bandera de atención de ventana, modo de salida de agente) y una estimación de latencia.

## Los ejercicios

1. Calcule las rotaciones de M-RoPE para un parche en (t=3, h=5, w=7) con 48 ocultos (16 por banda, base theta 10000). Muestre los ángulos de rotación de los primeros tres pares en cada banda.

2. ¿Cuántos cuadros producen una cámara de seguridad de 10 minutos a 1 FPS? ¿A 384 de resolución con 3x pool, cuántos tokens totales? ¿El contexto predeterminado de Qwen2.5VL de 32k lo maneja?

3. Elige FPS para un rally de tenis de 30 segundos vs. una demostración de receta de 30 segundos vs. una grabación de agente de interfaz de 30 segundos.

4. Qwen2.5VL deja de funcionar el Q-Former por completo. ¿Por qué un MLP simple funciona en 2025 pero no en 2023?

5. Parsear tres Qwen2.5-VL JSON herramienta de llamadas de salida en Python dicts. ¿Qué falla en JSON malformado y qué estrategia de recuperación recomienda el libro de cocina Qwen?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| M-RoPE | "Multimodal RoPE" | 3D rotary position embedding with temporal, height, and width bands in the hidden dim |
| Dynamic FPS | "Smart sampling" | Frame sampling rate chosen per video based on motion, duration, and token budget |
| Absolute time encoding | "Time-aligned M-RoPE" | Temporal position IDs set from each frame's timestamp, so the model sees actual seconds, not frame index, with no extra tokens |
| Window attention | "Local attention" | Spatial self-attention restricted to small windows for speed; global attention added periodically |
| Structured agent output | "JSON mode" | Training data supervision teaching the VLM to emit parseable JSON with coords and tool names |
| min_pixels / max_pixels | "Resolution bounds" | Per-request Qwen2.5-VL controls bounding total pixel count and therefore token count |
| Grounding | "Point-at-it" | Outputting bounding-box coordinates as text tokens; used since Qwen-VL v1 |

## Leer más

- [Bai et al. — Qwen-VL (arXiv:2308.12966)](https://arxiv.org/abs/2308.12966)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Qwen Team — Qwen3-VL (arXiv:2511.21631)](https://arxiv.org/abs/2511.21631)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
