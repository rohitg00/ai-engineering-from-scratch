# Detección y toma de vueltas de la actividad de voz  Silero, Cobra y el truco de la roca

> Cada agente de voz vive o muere por dos decisiones: ¿habla el usuario ahora y están terminados? VAD responde a la primera. La detección de giros (VAD + silencio-hangower + modelo de punto final semántico) responde a la segunda.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 11 (Real-Time Audio), Phase 6 · 12 (Voice Assistant)
**Time:** ~45 minutes

## El problema

Tres decisiones distintas que un agente de voz toma en cada 20 ms:

1. **Is this frame speech?**- VAD, binario, por marco.
2. **Has the user started a new utterance?** detección de inicio.
3. **Has the user finished?** apuntar al final (turn-end).

La respuesta ingenua (umbral de energía) falla en cualquier ruido  tráfico, teclados, charlatos de la multitud. La respuesta 2026: Silero VAD (abierto, profundamente aprendido) + un modelo de detección de turno (indicación semántica de extremo) + una resaca de silencio calibrada por VAD.

## El concepto

![VAD cascade: energy → Silero → turn-detector → flush trick](../assets/vad-turn-taking.svg)

### La cascada de tres niveles de VAD

**Tier 1: energy gate.**El límite RMS es de -40 dBFS, filtra el silencio obvio pero dispara cualquier ruido por encima del límite.

**Tier 2: Silero VAD**(2020-2026, MIT). 1M parámetros. Entrenado en más de 6000 idiomas. Se ejecuta en ~1 ms por 30 ms de trozo en un solo hilo de CPU.

**Tier 3: semantic turn detector.**El modelo de detección de turno de LiveKit (2024-2026) o su propio clasificador pequeño. Distingue "pausa a mitad de oración" de "hablar terminado".

### Parámetros clave y sus valores predeterminados

- **Threshold.**Silero produce una probabilidad; clasificar el habla en &gt; 0.5 (default) o &gt; 0.3 (sensitivo). umbral más bajo = menos clips de primera palabra, más falsos positivos.
- **Minimum speech duration.**Rechazar el habla menor a 250 ms  usualmente tos o ruido de la silla.
- **Silence hangover (end-pointing).**Después de que el VAD vuelva a 0, espere 500-800 ms antes de declarar el final del giro. Demasiado corto → interrumpir al usuario. Demasiado largo → se siente lento.
- **Pre-roll buffer.**Mantenga 300-500 ms de audio antes de que el VAD dispare.

### El truco de la roca (Kyutai 2025)

Los modelos STT en streaming tienen un retraso de vista hacia adelante (500 ms para Kyutai STT-1B, 2,5 s para STT-2.6B). Normalmente esperarías tanto tiempo después del final del discurso para la transcripción.**send a flush signal to the STT**El proceso de STT se realiza en tiempo real de ~4×, por lo que el buffer de 500 ms termina en ~125 ms.

End-to-end: 125 ms VAD + flush STT = latencia de conversación.

### Comparación de las VAD 2026

| VAD | TPR @ 5% FPR | Latency | License |
|-----|--------------|---------|---------|
| WebRTC VAD (Google, 2013) | 50.0% | 30 ms | BSD |
| Silero VAD (2020-2026) | 87.7% | ~1 ms | MIT |
| Cobra VAD (Picovoice) | 98.9% | ~1 ms | commercial |
| pyannote segmentation | 95% | ~10 ms | MIT-ish |

Silero es el correcto por defecto. Cobra es la actualización de cumplimiento / precisión.

```figure
sp-vad-cascade
```

## Construye el mismo

### Paso 1: la puerta de energía

```python
def energy_vad(chunk, threshold_dbfs=-40.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    dbfs = 20.0 * math.log10(max(rms, 1e-10))
    return dbfs > threshold_dbfs
```

### Paso 2: Silero VAD en Python

```python
from silero_vad import load_silero_vad, get_speech_timestamps

vad = load_silero_vad()
audio = torch.tensor(waveform_16k, dtype=torch.float32)
segments = get_speech_timestamps(
    audio, vad, sampling_rate=16000,
    threshold=0.5,
    min_speech_duration_ms=250,
    min_silence_duration_ms=500,
    speech_pad_ms=300,
)
for s in segments:
    print(f"{s['start']/16000:.2f}s - {s['end']/16000:.2f}s")
```

### Paso 3: máquina de estado de turno

```python
class TurnDetector:
    def __init__(self, silence_hangover_ms=500, min_speech_ms=250):
        self.state = "idle"
        self.speech_ms = 0
        self.silence_ms = 0
        self.silence_hangover_ms = silence_hangover_ms
        self.min_speech_ms = min_speech_ms

    def update(self, is_speech, chunk_ms=20):
        if is_speech:
            self.speech_ms += chunk_ms
            self.silence_ms = 0
            if self.state == "idle" and self.speech_ms >= self.min_speech_ms:
                self.state = "speaking"
                return "START"
        else:
            self.silence_ms += chunk_ms
            if self.state == "speaking" and self.silence_ms >= self.silence_hangover_ms:
                self.state = "idle"
                self.speech_ms = 0
                return "END"
        return None
```

### Paso 4: el esqueleto de trucos de la roza

```python
def flush_on_end(stt_client, audio_buffer):
    stt_client.send_audio(audio_buffer)
    stt_client.send_flush()
    return stt_client.recv_transcript(timeout_ms=150)
```

STT (Kyutai, Deepgram, AssemblyAI) debe soportar el flush para que esto funcione.

## Usalo

| Situation | VAD choice |
|-----------|-----------|
| Open, fast, general | Silero VAD |
| Commercial call center | Cobra VAD |
| On-device (phone) | Silero VAD ONNX |
| Research / diarization | pyannote segmentation |
| Zero-dependency fallback | WebRTC VAD (legacy) |
| Need turn-ending quality | Silero + LiveKit turn-detector layered |

Regla de oro: nunca envíe VAD sólo de energía a menos que realmente no tenga otra opción.

## Las trampas

- **Fixed threshold.**Funciona en silencio, falla en ruido, calibra en el dispositivo o cambia a Silero.
- **Too-short silence hangover.**El agente interrumpe la mitad de la oración. 500-800 ms es el punto ideal para el discurso de conversación.
- **Too-long hangover.**Se siente lento. Prueba A/B con usuarios objetivo.
- **No pre-roll buffer.**Los primeros 200-300 ms de audio del usuario se pierden.
- **Ignoring semantic endpointing.**"Hmm, déjame pensar"... contiene largas pausas. Los usuarios odian ser cortados en medio de la reflexión.

## Envío

Salvo como`outputs/skill-vad-tuner.md`Seleccione el modelo VAD, el umbral, la resaca, la estrategia de pre-rollo y detección de turno para una carga de trabajo.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`Simula una secuencia de habla + silencio + habla + tos y prueba tres niveles de VAD.
2. **Medium.**Instalar`silero-vad`, procesar una grabación de 5 minutos, ajustar el umbral para minimizar los clips de primera palabra y los disparadores falsos.
3. **Hard.**Construir un mini detector de giras: Silero VAD + una MLP de 3 capas en las últimas 10 palabras (utilizar transformadores de oraciones). Entrenar en un conjunto de datos de giras final etiquetado a mano.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| VAD | Voice detector | Binary per-frame: is this speech? |
| Turn detection | End-pointing | VAD + silence-hangover + semantic endpoint. |
| Silence hangover | Wait-after-speech | Time to wait before declaring turn end; 500-800 ms. |
| Pre-roll | Pre-speech buffer | Keep 300-500 ms audio before VAD fires. |
| Flush trick | Kyutai hack | VAD → flush-STT → 125 ms instead of 500 ms delay. |
| Semantic endpoint | "Did they mean to stop?" | ML classifier that looks at words, not just silence. |
| TPR @ FPR 5% | ROC point | Standard VAD benchmark; 87.7% for Silero, 50% WebRTC. |

## Leer más

- [Silero VAD](https://github.com/snakers4/silero-vad) el VAD de referencia abierto.
- [Picovoice Cobra VAD](https://picovoice.ai/products/voice/voice-activity-detection/) líder en precisión comercial.
- [Kyutai — Unmute + flush trick](https://kyutai.org/stt) el truco de ingeniería sub-200 ms.
- [LiveKit — turn detection](https://docs.livekit.io/agents/logic/turns/) Endpointing semántico en la producción.
- [WebRTC VAD](https://webrtc.googlesource.com/src/) el nivel de base heredado.
- [pyannote segmentation](https://github.com/pyannote/pyannote-audio) Segmentación de grado de diarización.
