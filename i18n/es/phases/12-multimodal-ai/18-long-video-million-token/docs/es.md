# Comprensión de un video largo en un contexto de millones de hablados

> Un video 4K de 1 hora a 24 FPS, parcheado e incrustado, produce el orden de 60 millones de tokens. Un episodio de podcast de 2 horas transcrito es de 30.000 tokens. Una película completa de Blu-ray, incluso comprimida con un agresivamente combinado, es de cientos de miles de tokens. Gemini 1.5 de Google (marzo 2024) abrió esta era con un contexto de 10 millones de tokens, haciendo una recuperación confiable de agujas en un haystack durante videos de una hora. LWM (Liu et al., febrero 2024) mostró la trayectoria de escala de la atención anilla. LongVILA y Video- XL aumentaron aún más la ingestión. VideoAgent cambió el contexto crudo por la recuperación de agentes. Cada enfoque es un cambio diferente en la composición, el recuerdo y la complejidad de la ingeniería. Esta lección las lee lado a lado.

**Type:** Build
**Languages:** Python (stdlib, needle-in-haystack simulator + agentic-retrieval router), TypeScript
**Prerequisites:** Phase 12 · 17 (video temporal tokens)
**Time:** ~180 minutes

## Objetivos de aprendizaje

- Calcule el recuento total de tokens visuales para el vídeo de formato largo a diferentes FPS y pooling.
- Explica las cuatro vías de escala: contexto bruto (Gemini 1.5), atención a anillos (LWM), compresión de tokens (LongVILA / Video-XL), recuperación agente (VideoAgent).
- Comparar VLMs de video de contexto crudo con VLMs de video de recuperación de agentes (VideoAgent) en precisión y latencia.
- Diseñar una prueba de aguja en un manto de heno para un video de 30 minutos y medir el recuerdo en un minuto específico.

## El problema

Un solo marco de parches de tamaño Qwen2.5VL con 384 resoluciones nativas es de ~729 tokens. En 3x3 pooling eso es de 81 tokens por marco. Un clip de 30 minutos a 1 FPS = 1800 frames = 145,800 tokens.

Una película de 2 horas a 1 FPS es de 583k tokens. Más allá de la mayoría de los modelos abiertos de 2026; requiere Gemini 2.5 Pro o un pooling más agresivo.

Se han dado cuatro caminos de escala.

## El concepto

### Caminado 1: Contexto bruto (Gemini 1.5, Claude Opus)

Arrojar hardware al problema, escalar el contexto a millones de tokens, procesar todo en un solo pase hacia adelante.

Gemini 1.5 Pro lanzado con 1M tokens; Gemini 1.5 Ultra a 10M; Gemini 2.5 Pro en 2026 hace horas de video confiablemente. El papel (arXiv:2403.05530) documenta la recuperación de aguja en un haystack en un 99,7% hasta ~ 9,5M tokens.

Ingeniería: una implementación de atención personalizada con jerarquía de memoria (local + global + escaso) más enrutamiento experto de MoE para la eficiencia de largo contexto. No se publicó en detalle completo. No es de código abierto.

### Caminado 2: Atención a los anillos (LWM, LongVILA)

La atención en el anillo distribuye largas secuencias entre dispositivos en un "anillo" donde cada dispositivo tiene un pedazo.

LWM (Liu et al., 2024) entrenó un modelo de contexto de 1M-token de esta manera. Escales de memoria por dispositivo con el pedazo que cada dispositivo tiene, por lo que agregar dispositivos extiende el contexto aproximadamente linealmente.

LongVILA (arXiv:2408.10188) adaptó el patrón a VLMs. 1400-frame videos a 192 tokens por fotograma = 268k contexto, entrenado con la atención del anillo a través del paralelismo de 8 vías.

### Camino 3: Compresión de tokens (Video-XL, LongVA)

Más barato que el contexto bruto: comprimir agresivamente antes de que el LLM vea la secuencia.

Video-XL (arXiv:2409.14485) utiliza un token de resumen visual: cada clip de los cuadros N produce un solo token de "resumen" que se encuentra sobre el N. En la inferencia, el LLM ve un token de resumen por clip, reduciendo drásticamente el contexto.

LongVA amplía el contexto de LLM de 200 mil a 2 millones con una técnica de "transferencia de contexto largo".

La compresión de tokens se trata de un retiro en marcas de tiempo específicas para la escalabilidad.

### Camino 4: Recuperación de agentes (VideoAgent)

No entregue el vídeo completo al LLM. En su lugar, trate el vídeo como una base de datos y use un LLM para consultarlo.

VideoAgent (arXiv:2403.10517):

1. El LLM lee la pregunta.
2. El LLM pide una herramienta de recuperación de clips relevantes ("mírame segmentos con un gato").
3. La herramienta devuelve las marcas de tiempo de los clip.
4. LLM lee esos clips a través de un VLM.
5. El LLM compone la respuesta o hace preguntas de seguimiento.

Este es el patrón de LLM-as-agent aplicado a los vídeos largos.

### Indicadores de referencia de agujas en un manto de heno

La prueba estándar de largo contexto: insertar un marcador visual o textual único en un punto aleatorio del video, luego hacer una consulta que requiera su recuerdo.

Metrícula: Recall@k a través de la longitud del vídeo y la posición del marcador.

Gemini 2.5 Pro obtiene un puntaje de >99% de recuerdo en videos de hasta 90 minutos. Los modelos abiertos 72B (Qwen2.5-VL-72B, InternVL3-78B) obtienen un puntaje de ~85-90% a los 30 minutos y se degradan más allá de 60.

VideoAgent puede igualar o superar los modelos de contexto crudo en 2 horas porque la recuperación golpea la aguja si la herramienta es buena.

### ¿Qué camino elegir?

Para un clip de 15 minutos con precisión fronteriza: abre 72B + contexto nativo generalmente funciona.

Para el contenido de 30 minutos a 1 hora: LongVILA o Video-XL para abierto; Gemini 2.5 Pro para cerrado. La barra de calidad importa  la frontera se cierra.

Para contenido de más de 2 horas: VideoAgent o patrones de recuperación similares.

### Modelo de producción 2026

En la práctica, las líneas de producción de video largo son híbridas:

1. ejecuta muestreo dinámico de FPS + agregación agresiva en todo el video (obtenga una representación global de 100k tokens).
2. Pasen a un 72B VLM para un resumen global.
3. Si el usuario hace preguntas detalladas, ejecuta la recuperación agencial utilizando el resumen como índice.

Esto combina el contexto bruto para la comprensión global y la recuperación de detalles locales.

```figure
mm-video-token-budget
```

## Usalo

`code/main.py`¿Qué es esto ?

- Computa los presupuestos de tokens para videos de 1 minuto a 3 horas en diferentes FPS + pooling.
- Simula una carrera de aguja en un montón de heno: inyecta un marcador en una marca de tiempo aleatoria, hace una pregunta, recuerda el resultado.
- Incluye un simulador de enrutamiento de recuperación de agentes que selecciona clips específicos para alimentar a un VLM aguas abajo.

Echa un vistazo a la tabla de presupuesto y siente la brecha de la escala.

## Envío

Esta lección produce`outputs/skill-long-video-strategy-planner.md`. Dada la duración del video y la complejidad de la consulta, elige entre el contexto bruto, la compresión y la recuperación agencial, y calcula las expectativas de latencia + calidad.

## Los ejercicios

1. Una conferencia de 45 minutos a 1 FPS, 81 tokens por fotograma. ¿Todos los tokens? ¿En qué contextos de los modelos?

2. Diseñar una prueba con aguja en un manto de heno: ¿en qué minuto inyectas el marcador, y cuál es el formato exacto de la consulta?

3. Comparar el contexto bruto Qwen2.5-VL-72B (contexto 80k) con VideoAgent (Claude 3.5 + recuperación) en un video de 1 hora. ¿Cuál gana en el recuerdo? ¿Cuál gana en la latencia?

4. Las escalas de memoria de la atención de anillo por dispositivo con longitud de secuencia dividida por el número de dispositivos, mientras que el cálculo de la atención total se mantiene cuadrático.

5. Lea Gemini 1.5 Sección 5 sobre aguja en un haystack. ¿Qué encontró el periódico sobre el recuerdo en el límite de token 1M vs 10M?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Brute context | "Just more tokens" | Scale LLM context to millions of tokens; process everything in one pass |
| Ring attention | "LWM-style parallel" | Distributed attention pattern where each device holds a chunk and rotates |
| Token compression | "Summary tokens" | Reduce per-clip tokens via a learned compressor before the LLM |
| Needle-in-haystack | "NIH test" | Insert a unique marker at a random point, ask model to recall it at test time |
| Agentic retrieval | "LLM as query planner" | LLM asks a retrieval tool for relevant clips, reads them via a VLM, composes answer |
| VideoAgent | "Retrieval pattern for video" | Canonical agentic-retrieval design: question -> tool -> clip -> answer |

## Leer más

- [Gemini Team — Gemini 1.5 (arXiv:2403.05530)](https://arxiv.org/abs/2403.05530)
- [Liu et al. — LWM / RingAttention (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Xue et al. — LongVILA (arXiv:2408.10188)](https://arxiv.org/abs/2408.10188)
- [Shu et al. — Video-XL (arXiv:2409.14485)](https://arxiv.org/abs/2409.14485)
- [Wang et al. — VideoAgent (arXiv:2403.10517)](https://arxiv.org/abs/2403.10517)
