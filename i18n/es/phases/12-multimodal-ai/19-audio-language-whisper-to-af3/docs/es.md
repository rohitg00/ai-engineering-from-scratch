# Modelos de audio: el susurro al audio Flamingo 3 Arc

> Whisper (Radford et al., diciembre 2022) estableció el reconocimiento del habla  680k horas de habla multilingüe supervisionada de forma débil, un simple transformador de codificador-decodificador, un punto de referencia que hizo que cada lanzamiento posterior de ASR lo citara. Pero reconocer no es razonar. Para preguntar "qué instrumentos hay en esta grabación" o "qué emoción expresa el orador" o "qué pasó en el minuto 3" se requiere un entendimiento de audio, no una transcripción. Qwen-Audio, SALMONN, LTU y Audio Flamingo 3 de NVIDIA (AF3, julio 2025) construyeron progresivamente esa pila: mantener los codificadores de la clase Whisper, conectar los formadores Q, entrenar en datos de instrucción de audio-texto, agregar el razonamiento de cadena de pensamiento. Esta lección va por el arco.

**Type:** Build
**Languages:** Python (stdlib, log-Mel spectrogram + audio Q-former skeleton), TypeScript
**Prerequisites:** Phase 6 (Speech and Audio), Phase 12 · 03 (Q-Former)
**Time:** ~180 minutes

## Objetivos de aprendizaje

- Computa un espectrograma log-Mel a partir de una forma de onda: ventana, FFT, bancos de filtros, transformación de registro.
- Compare las opciones de codificación: codificador de susurros, BEATs, híbrido AF-Whisper.
- Construir un formato de audio Q: N consultas de aprendizaje que atenden a parches de espectrograma.
- Explica cascada (Whisper-then-LLM) vs. capacitación de audio-LLM de extremo a extremo: por qué la escala de extremo a extremo es mejor para el razonamiento.

## El problema

El reconocimiento de voz fue resuelto por Whisper. OCR de audio es una mercancía. Pero "comodidad" se detiene en la transcripción. Si el modelo no puede razonar sobre lo que escuchó  tiempo, altavoces, emoción, estructura musical, sonidos ambientales  la transcripción sola no puede impulsar las características del producto.

Tres rutas obvias:

1. Cascada: Whisper transcribe, LLM razona sobre la transcripción. Trabaja para escenarios de habla pura. Falta para música, audio ambiental, superposición de varios altavoces, emoción.

2. Audio-LLM de extremo a extremo: un codificador de audio alimenta los tokens de audio directamente en un LLM, saltando la transcripción. Preserva la información acústica (emoción, altavoz, entorno). Necesita nuevos datos de capacitación.

3. El código de audio + decodificador de texto que puede transcribir y razonar.

## El concepto

### Espectograma de registro-Mel: la característica de entrada

Cada codificador de audio comienza con la misma característica: un espectrograma log-Mel.

1. Reparación a 16 kHz.
2. La transformación de Fourier de corto tiempo con ventanas de 25 ms, salto de 10 ms.
3. Tomemos la magnitud del resultado de FFT.
4. Aplicar bancos de filtros Mel (normalmente 80 filtros con espacio de registro de 0-8000 Hz) para warp a la frecuencia perceptiva.
5. Compresora de registro $(\log(1 + x))$para el rango dinámico.

Resultado: una matriz 2D de forma (T, 80) donde T es el número de marcos de tiempo. Para un clip de 30 segundos a 100 Hz: (3000, 80).

### El codificador de Whisper

El codificador de Whisper es un transformador de estilo ViT de 12 capas que procesa el espectrograma log-Mel como una secuencia de marcos de tiempo.

Para ASR, el decodificador de Whisper es un transformador de atención cruzada que genera tokens de texto condicionados a la salida del codificador.

Para los ALM (audio-LLM), se desea que el codificador sea ingresado a un LLM diferente. El patrón: codificador de susurros congelado, Q-former trainable, LLM congelado o sintonizado.

### Los sistemas de codificación de audio específicos

Whisper fue entrenado en datos dominantes del habla. Es más débil para la música y el audio ambiental.

BEATs (Chen et al., 2022) es un transformador auto supervisado entrenado en AudioSet. Captura música y sonidos ambientales mejor que Whisper en el mismo conteo de parámetros.

AF-Whisper (encoder de Audio Flamingo 3): comienza con el encoder Whisper-large-v3 y sigue entrenándolo en voz, sonido y música juntos, por lo que un encoder lleva tanto la señal lingüística como la acústica.

### Audio Q-former

El mismo patrón que el Q-former visual de BLIP-2. un número fijo de consultas de aprendizaje (a menudo 32 o 64) se cruzan sobre los marcos de salida del codificador de audio.

Estadio de alineación de formación: Q-former solo, pérdidas de contraste + subtítulos en pares de audio-texto (AudioCaps, Clotho).

### El arco  SALMONN, Qwen-Audio, AF3

SALMONN (Tang et al., 2023): Whisper + BEATs + Q-former + LLaMA. El primer LLM de audio abierto con capacidad de razonamiento serio.

Qwen-Audio (Chu et al., 2023): arquitectura similar, entrenada en un conjunto de datos más rico, sintonizada para el diálogo de múltiples giros. MMAU ~ 0.60.

LTU  Escucha, piensa, entienda (Gong et al., 2023): datos de razonamiento explícito, enfoque en la cadena de pensamiento sobre los clips de audio.

Audio Flamingo 3 (Goel et al., julio 2025): la actual SOTA abierta. 7B LLM backbone (Qwen2.5-7B), un codificador de audio AF-Whisper construido a partir de Whisper-large-v3, pequeñas capas de adaptador en el LLM, entrenamiento en pares de instrucción de audio-texto 1M +. MMAU 0.72, coincide con la frontera patentada en algunas subtareas.

AF3 también introduce una cadena de pensamiento a pedido para el audio: el modelo puede emitir tokens de pensamiento opcionalmente ("permítanme identificar los instrumentos primero: ...") antes de la respuesta final.

### Cascada vs extremo a extremo

El gasoducto en cascada:

1. Whisper transcribe audio → texto.
2. Razones de LLM sobre texto.

Funciona perfectamente para "resumir este podcast". No funciona para:
- "¿Qué humor tiene esta canción?"  El humor está en el sonido, no en las palabras.
- "¿Quién está hablando, Alice o Bob?"  requiere la identificación del hablante.
- "¿A qué momento ocurre la explosión?"  Terreno temporal perdido en el texto.
- "Es este audio real o generado?"  La detección de deepfake necesita características acústicas.

El Qwen-Audio y el AF3 manejan la música, el ambiente y las emociones de forma nativa.

### Recepta de producción 2026

Para un nuevo producto de audio-comprensión:

- Cascada si: la transcripción es el objetivo, no hay música, no hay inferencia emocional.
- AF3 / Qwen-Audio-familia si: música, emoción, multi- altavoz, o razonamiento de audio complejo.

Cascada es más barata y sencilla.

### MMAU  el punto de referencia de razonamiento de audio

MMAU (Entendición de Audio Multimodal masivo) es el punto de referencia de razonamiento de audio 2024-2025.

- 10.000 pares de audio-texto de calidad a través del habla, la música, los sonidos ambientales.
- Abarca la clasificación, el razonamiento temporal, el razonamiento causal, la evaluación de calidad sin límite.
- Prueba qué oleoductos en cascada se pierden sistemáticamente.

Open SOTA (AF3) en 0,72; frontera patentada ~ 0,78 (Gemini 2.5 Pro, Claude Opus 4.7). La brecha es menor que el delta abierto versus cerrado de VideoMME, lo que indica que los audio-LLM están madurando.

```figure
audio-text-ctc
```

## Usalo

`code/main.py`¿Qué es esto ?

- Implementa el cálculo de espectrogramas de log-Mel en stdlib: ventana, DFT ingenuo, banco de filtros de Mel.
- Audio Q-ex esqueleto: dado los marcos de salida del codificador, calcular Q, K, V, atención, y emitir N tokens.
- Comparación cascada contra extremo a extremo en una tarea de juguete.

## Envío

Esta lección produce`outputs/skill-audio-llm-pipeline-picker.md`. Dado una tarea de audio (transcripción, etiquetado musical, inferencia de emociones, diarización de varios altavoces, clasificación del entorno), elige una cascada, AF3 de extremo a extremo o un híbrido.

## Los ejercicios

1. Computa la dimensión del espectrograma log-Mel para un clip de 30 segundos a 16 kHz, ventana de 25 ms, salto de 10 ms, 80 contenedores de Mel. ¿Cómo cambia esto a 48 kHz?

2. ¿Por qué Whisper tiene un rendimiento inferior en la música? ¿Qué características de audio capturan los BEAT que Whisper no tiene?

3. Audio Q-former con 64 consultas vs 32: ¿en qué complejidad de tarea 64 paga? 32 guardar computación para qué?

4. Lea la sección 4 de AF3 sobre el pensamiento bajo demanda. Propón tres tareas de audio en las que la cadena de pensamiento ayuda más.

5. Implemente una línea de diarización mínima utilizando la salida de AF3. ¿Cómo se señalan cambios de altavoz?

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Log-Mel spectrogram | "Mel features" | 2D (time, frequency) array of log-magnitude values after Mel filter banks |
| Audio Q-former | "Audio Perceiver" | Cross-attention bottleneck from audio encoder output to fixed-length queries feeding the LLM |
| Cascaded | "ASR-then-LLM" | Pipeline where Whisper transcribes and a text LLM reasons; loses acoustic information |
| End-to-end | "Audio-LLM" | Audio features enter the LLM directly via Q-former; preserves acoustic signal |
| BEATs | "Audio AudioSet encoder" | SSL transformer trained on AudioSet; strong on music + environmental sounds |
| MMAU | "Audio reasoning bench" | 10k QA pairs across speech, music, environment; 2024 eval standard |
| On-demand thinking | "Audio CoT" | Model can optionally emit reasoning tokens before final answer, lifts accuracy 3-5 pts |

## Leer más

- [Radford et al. — Whisper (arXiv:2212.04356)](https://arxiv.org/abs/2212.04356)
- [Chu et al. — Qwen-Audio (arXiv:2311.07919)](https://arxiv.org/abs/2311.07919)
- [Goel et al. — Audio Flamingo 3 (arXiv:2507.08128)](https://arxiv.org/abs/2507.08128)
- [Tang et al. — SALMONN (arXiv:2310.13289)](https://arxiv.org/abs/2310.13289)
- [Gong et al. — LTU (arXiv:2305.10790)](https://arxiv.org/abs/2305.10790)
