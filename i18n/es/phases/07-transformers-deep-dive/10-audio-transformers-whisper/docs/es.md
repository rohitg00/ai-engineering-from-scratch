# Transformadores de audio  Arquitectura de susurros

> El sonido es una imagen de frecuencia a lo largo del tiempo.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 08 (Encoder-Decoder), Phase 7 · 09 (ViT)
**Time:** ~45 minutes

## El problema

Antes de Whisper (OpenAI, Radford et al. 2022), el reconocimiento automático de voz (ASR) de vanguardia significaba que los extractores de características de wav2vec 2.0 y HuBERT  se supervisan por sí mismos más una cabeza afinada.

Whisper hizo tres apuestas:

1. **Train on everything.**680.000 horas de audio deficiente en 97 idiomas, sin un cuerpo académico limpio, sin etiquetas fonéticas.
2. **Multi-task single model.**Un decodificador entrenado conjuntamente en transcripción, traducción, detección de actividad de voz, ID de idioma y timestamping a través de tokens de tarea.
3. **Standard encoder-decoder transformer.**El codificador consume espectrogramas log-mail. El decodificador produce tokens de texto autoregresivamente.

El resultado: Whisper big-v3 es robusto en acentos, ruido y lenguajes que tienen datos de etiqueta limpia cero. Es el front-end de voz predeterminado para todos los asistentes de voz de código abierto y la mayoría de los comerciales en 2026.

## El concepto

![Whisper pipeline: audio → mel → encoder → decoder → text](../assets/whisper.svg)

### Paso 1  repetición + ventana

Audio a 16 kHz. Clip/pad a 30 segundos. Computa el espectrograma log-mel: 80 mel bin, 10 ms de paso → ~ 3.000 cuadros × 80 características. Esta es la "imagen de entrada" que Whisper ve.

### Paso 2  tronco convolucionario

Dos capas Conv1D con el núcleo 3 y el paso 2 reducen los 3.000 cuadros a 1.500.

### Paso 3  codificador

Un codificador de transformador de 24 capas (para grandes) en 1.500 pasos de tiempo. codificación posicional sinusoidal, autoatención, GELU FFN. Produce estados ocultos de 1.500 × 1.280 .

### Paso 4  decodificador

Un decodificador de transformador de 24 capas. Produce automáticamente tokens de un vocabulario BPE que es un superconjunto de GPT-2 con algunos tokens especiales específicos de audio.

### Paso 5  Tokens de tarea

El descifrador comienza con fichas de control que dicen al modelo qué hacer:

```
<|startoftranscript|>  <|en|>  <|transcribe|>  <|0.00|>
```

o

```
<|startoftranscript|>  <|fr|>  <|translate|>   <|0.00|>
```

El modelo fue entrenado en esta convención. controlas tareas por prefijo. el equivalente de instrucción de 2026 pero aplicado al habla.

### Paso 6  salida

Buscar en haz (ancho 5) con un umbral de log-prob.`<|notimestamps|>`El token está ausente.

### Tamaños de susurros

| Model | Params | Layers | d_model | Heads | VRAM (fp16) |
|-------|--------|--------|---------|-------|-------------|
| Tiny | 39M | 4 | 384 | 6 | ~1 GB |
| Base | 74M | 6 | 512 | 8 | ~1 GB |
| Small | 244M | 12 | 768 | 12 | ~2 GB |
| Medium | 769M | 24 | 1024 | 16 | ~5 GB |
| Large | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3 | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3-turbo | 809M | 32 | 1280 | 20 | ~6 GB (4-layer decoder) |

El decodificador de 32 capas se reduce a 4.8 veces más rápido con regresión de <1 punto WER.

### Lo que el susurro no hace

- No hay diarios, para eso se empareja con la nota de piano.
- No se transmite en tiempo real de forma nativa  la ventana de 30 segundos está fija.`faster-whisper`¿ Qué ?`WhisperX`) para el streaming a través de la superposición de VAD +.
- No hay contexto de forma larga más allá de 30 s sin fragmentos externos. Funciona bien en la práctica porque el habla humana rara vez necesita contexto de largo alcance para la transcripción.

### 2026 paisaje

| Task | Model | Notes |
|------|-------|-------|
| English ASR | Whisper-turbo, Moonshine | Moonshine is 4× faster on edge |
| Multilingual ASR | Whisper-large-v3 | 97 languages |
| Streaming ASR | faster-whisper + VAD | 150 ms latency targets achievable |
| TTS | Piper, XTTS-v2, Kokoro | Encoder-decoder pattern, but Whisper-shaped |
| Audio + language | AudioLM, SeamlessM4T | Text tokens + audio tokens in one transformer |

```figure
n5-mel-decode
```

## Construye el mismo

¿ Qué ?`code/main.py`No entrenamos Whisper, construimos el log-mail espectrogram pipeline + task-token prompt formator. Esas son las piezas que realmente tocan en la producción.

### Paso 1: sintetizar el audio

Generar una onda seno-segunda a 440 Hz muestrada a 16 kHz. 16.000 muestras.

### Paso 2: Espectograma de registro de correo electrónico (simplificado)

El espectrograma de mel completo necesita FFT. hacemos un marco simplificado + versión de energía por marco que muestra la tubería sin necesidad de`librosa`¿Qué es esto ?

```python
def frame_signal(x, frame_size=400, hop=160):
    frames = []
    for start in range(0, len(x) - frame_size + 1, hop):
        frames.append(x[start:start + frame_size])
    return frames
```

En el marco = 25 ms, en el hop = 10 ms.

### Paso 3: envasado a 30 s

Whisper siempre procesa trozos de 30 segundos.

### Paso 4: crear los tokens de solicitud

```python
def whisper_prompt(lang="en", task="transcribe", timestamps=True):
    tokens = ["<|startoftranscript|>", f"<|{lang}|>", f"<|{task}|>"]
    if not timestamps:
        tokens.append("<|notimestamps|>")
    return tokens
```

Esa es toda la superficie de control de tareas.

## Usalo

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("meeting.wav", language="en", task="transcribe")
print(result["text"])
print(result["segments"][0]["start"], result["segments"][0]["end"])
```

Más rápido, compatible con OpenAI:

```python
from faster_whisper import WhisperModel
model = WhisperModel("large-v3-turbo", compute_type="int8_float16")
segments, info = model.transcribe("meeting.wav", vad_filter=True)
for s in segments:
    print(f"{s.start:.2f} - {s.end:.2f}: {s.text}")
```

**When to pick Whisper in 2026:**

- RAS multilingüe con un modelo.
- Una robusta transcripción de ruidosos y diversos sonidos.
- Investigación / prototipo ASR  punto de partida más rápido.

**When to pick something else:**

- Ultra baja latencia streaming en el borde Moonshine supera a Whisper en calidad igualada.
- AI de conversación en tiempo real que necesita <200 ms  ASR de transmisión dedicada.
- Diario de altavoces  Susurro no hace esto; paralizador en la nota de piano.

## Envío

¿ Qué ?`outputs/skill-asr-configurator.md`La habilidad elige un modelo ASR, parámetros de decodificación y una tubería de procesamiento previo para una nueva aplicación de voz.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`Confirmar el recuento de fotogramas para una señal de 1 segundo a 16 kHz con 10 ms saltar es ~ 100 fotogramas.
2. **Medium.**Construir el espectro completo de log-mel usando `numpy.fft`Verifique si 80 mil contenedores coinciden .`librosa.feature.melspectrogram(n_mels=80)`dentro del error numérico.
3. **Hard.**Implemente inferencia de transmisión: fragmento de audio en ventanas de 10 segundos con superposición de 2 segundos, ejecuta Whisper en cada fragmento, fusione las transcripciones. Mide la tasa de error de palabra frente a un solo paso en una muestra de podcast de 5 minutos.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mel spectrogram | "Audio image" | 2D representation: frequency bins on one axis, time frames on the other; log-scaled energy per cell. |
| Log-mel | "What Whisper sees" | Mel spectrogram passed through log; approximates human perception of loudness. |
| Frame | "One time slice" | A 25 ms window of samples; overlapping at 10 ms stride. |
| Task token | "Prompt prefix for speech" | Special tokens like `<\|transcribe\|>` / `<\|translate\|>` in the decoder prompt. |
| Voice activity detection (VAD) | "Find the speech" | Gate that removes silence before ASR; cuts cost massively. |
| CTC | "Connectionist Temporal Classification" | Classic ASR loss for alignment-free training; Whisper does NOT use it. |
| Whisper-turbo | "Small decoder, full encoder" | large-v3 encoder + 4-layer decoder; 8× faster decoding. |
| Faster-whisper | "The production wrapper" | CTranslate2 reimplementation; int8 quantization; 4× faster than OpenAI's reference. |

## Leer más

- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) Papel de susurros.
- [OpenAI Whisper repo](https://github.com/openai/whisper) código de referencia + pesos del modelo.`whisper/model.py`para ver el código de base Conv1D + codificador + decodificador de arriba a abajo en ~ 400 líneas.
- [OpenAI Whisper — `whisper/decoding.py`](https://github.com/openai/whisper/blob/main/whisper/decoding.py) la lógica de búsqueda de haces + ficha de tarea descrita en los pasos 56 está aquí; 500 líneas, completamente legibles.
- [Baevski et al. (2020). wav2vec 2.0: A Framework for Self-Supervised Learning of Speech Representations](https://arxiv.org/abs/2006.11477) precursor; todavía cuenta con SOTA en algunas configuraciones.
- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) envase de producción, 4 veces más rápido que el de referencia.
- [Jia et al. (2024). Moonshine: Speech Recognition for Live Transcription and Voice Commands](https://arxiv.org/abs/2410.15608) 2024 ASR amigable con los bordes, en forma de susurro pero más pequeño.
- [HuggingFace blog — "Fine-Tune Whisper For Multilingual ASR with 🤗 Transformers"](https://huggingface.co/blog/fine-tune-whisper) receta de ajuste fino canónico, incluido el preprocesador del espectrograma mel y el manejo de las sellas de tiempo de los tokens.
- [HuggingFace `modeling_whisper.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/whisper/modeling_whisper.py) Implementación completa (encodificador, decodificador, atención cruzada, generación) que refleje el diagrama de arquitectura de la lección.
