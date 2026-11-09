# Construir un tubo de ayuda de voz  La Capstone de la Fase 6

> Todo desde las lecciones 01-11, unido. Construye un asistente de voz que escuche, razone y hable. En 2026 ese es un problema de ingeniería resuelto, no un problema de investigación  pero los detalles de integración deciden si se lanza.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04, 05, 06, 07, 11; Phase 11 · 09 (Function Calling); Phase 14 · 01 (Agent Loop)
**Time:** ~120 minutes

## El problema

Construir un asistente de extremo a extremo:

1. Captura la entrada de micrófono (16 kHz mono).
2. Detecta el inicio y el final del habla del usuario.
3. Transcribe el streaming.
4. Pases transcripción a un LLM que puede llamar a herramientas (timer, clima, calendario).
5. Transmite un texto de LLM a un TTS.
6. Reproduce el audio al usuario.
7. Se detiene si el usuario interrumpe la respuesta media.

Objetivo de latencia: primer byte de audio TTS dentro de los 800 ms del usuario terminando su pronunciación en una CPU portátil. Objetivo de calidad: no faltan palabras, no hay subtítulos alucinados en silencio, no hay filtración de clonación de voz, no hay éxito de inyección rápida.

## El concepto

![Voice assistant pipeline: mic → VAD → STT → LLM+tools → TTS → speaker](../assets/voice-assistant.svg)

### Los siete componentes

1. **Audio capture.**Mic → 16 kHz mono → 20 ms trozos. Por lo general `sounddevice`en Python o AudioUnit/ALSA/WASAPI nativo en producción.
2. **VAD (Lesson 11).**Silero VAD @ umbral 0,5, min habla 250 ms, silencio colgar 500 ms. Las señales "inicio" y "fina".
3. **Streaming STT (Lesson 4-5).**Whisper-streaming, Parakeet-TDT, o Deepgram Nova-3 (API). Transcripciones parciales + finales.
4. **LLM with tool calling.**GPT-4o / Claude 3.5 / Gemini 2.5 Flash. esquema JSON para herramientas. Tokens de transmisión.
5. **Streaming TTS (Lesson 7).**Kokoro-82M (abriendo más rápido) o Cartesia Sonic (comercial).
6. **Playback.**El altavoz fuera; código opus para redes de bajo ancho de banda.
7. **Interruption handler.**Si el VAD dispara durante la reproducción de TTS, detenga la reproducción, cancele LLM, reinicie STT.

### Los tres modos de fracaso que golpearás

1. **First-word clip.**VAD comienza un ritmo demasiado tarde. "Hey" del usuario falta.
2. **Mid-response interrupt confusion.**LLM sigue generando después de que el usuario interrumpa; el asistente habla sobre el usuario.
3. **Silence hallucination.**Los susurros dicen "gracias por ver" en los cuadros silenciosos de calentamiento.

### 2026 Estadios de referencia de producción

| Stack | Latency | License | Notes |
|-------|---------|---------|-------|
| LiveKit + Deepgram + GPT-4o + Cartesia | 350-500 ms | commercial API | Industry default 2026 |
| Pipecat + Whisper-streaming + GPT-4o + Kokoro | 500-800 ms | mostly open | DIY-friendly |
| Moshi (full-duplex) | 200-300 ms | CC-BY 4.0 | Single-model; different architecture, lesson 15 |
| Vapi / Retell (managed) | 300-500 ms | commercial | Fastest to launch; limited customization |
| Whisper.cpp + llama.cpp + Kokoro-ONNX | offline | open | Privacy / edge |

```figure
v4-voice-latency
```

## Construye el mismo

### Paso 1: captura de micrófono con fragmentación (pseudocodo)

```python
import sounddevice as sd

def mic_stream(chunk_ms=20, sr=16000):
    q = queue.Queue()
    def cb(indata, frames, time, status):
        q.put(indata.copy().flatten())
    with sd.InputStream(channels=1, samplerate=sr, blocksize=int(sr * chunk_ms/1000), callback=cb):
        while True:
            yield q.get()
```

### Paso 2: Captura de la vuelta con puerta VAD

```python
def capture_turn(stream, vad, pre_roll_ms=300, silence_ms=500):
    buf, pre, triggered = [], collections.deque(maxlen=pre_roll_ms // 20), False
    silent = 0
    for chunk in stream:
        pre.append(chunk)
        if vad(chunk):
            if not triggered:
                buf = list(pre)
                triggered = True
            buf.append(chunk)
            silent = 0
        elif triggered:
            silent += 20
            buf.append(chunk)
            if silent >= silence_ms:
                return b"".join(buf)
```

### Paso 3: transmisión de STT → LLM → TTS

```python
async def turn(audio_bytes):
    transcript = await stt.transcribe(audio_bytes)
    async for token in llm.stream(transcript):
        async for audio in tts.stream(token):
            await speaker.play(audio)
```

### Paso 4: herramienta de llamadas dentro del bucle de LLM

```python
tools = [
    {"name": "get_weather", "parameters": {"location": "string"}},
    {"name": "set_timer", "parameters": {"seconds": "int"}},
]

async for chunk in llm.stream(user_text, tools=tools):
    if chunk.type == "tool_call":
        result = dispatch(chunk.name, chunk.args)
        continue_streaming(result)
    if chunk.type == "text":
        await tts.stream(chunk.text)
```

### Paso 5: Manejo de interrupciones

```python
tts_task = asyncio.create_task(tts_loop())
while True:
    chunk = await mic.get()
    if vad(chunk):
        tts_task.cancel()
        await speaker.stop()
        await new_turn()
        break
```

## Usalo

¿ Qué ?`code/main.py`para una simulación ejecutable que conecta los siete componentes con modelos de estubes, para que pueda ver la forma de la tubería incluso sin hardware.

- `silero-vad`(El artículo`pip install silero-vad`(en inglés)
- `deepgram-sdk`o `openai-whisper`
- `openai`(El artículo`gpt-4o`) o `anthropic`
- `kokoro`o `cartesia`
- `sounddevice`para la entrada/entrada

## Las trampas

- **Logging PII forever.**El audio de giro completo es información personal en la mayoría de jurisdicciones.
- **No barge-in.**Los usuarios interrumperán, su asistente debe dejar de hablar.
- **TTS that blocks.**TTS sincrónico bloquea el bucle de eventos.
- **No tool-call error handling.**Las herramientas fallan. LLM debe recuperar el error + volver a intentar una vez, luego degradar con gracia.
- **Overzealous hallucination filters.**Superfiltrado y el asistente repite "No puedo evitarlo" subfiltrado y dice cualquier cosa calibra en un set aguantado.
- **No wake-word option.**Siempre escuchar es una responsabilidad de privacidad. Añadir una puerta de advertencia (Porcupine o openWakeWord).

## Envío

Salvo como`outputs/skill-voice-assistant-architect.md`. Dadas las limitaciones presupuestarias + de escala + de lenguaje + de cumplimiento, elaborar una especificación completa de la pila.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`Simula una vuelta completa de extremo a extremo con módulos de estub y grabadas por latencia de etapa.
2. **Medium.**Reemplaza el estubito de STT con un modelo real de Whisper en una grabación previa `.wav`- Medir el WER y la latencia de extremo a extremo.
3. **Hard.**Añadir la llamada de herramientas: implementar `get_weather`(cualquier API) y `set_timer`. Envía el LLM a través de las herramientas y comprueba que cuando el usuario dice "establecer un temporizador de 5 minutos" se activa la función correcta y la respuesta oral lo confirma.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Turn | A user + assistant round-trip | One VAD-bounded user speech + one LLM-TTS response. |
| Barge-in | Interruption | User speaks while assistant talks; assistant stops. |
| Wake word | "Hey assistant" | Short keyword detector; Porcupine, Snowboy, openWakeWord. |
| End-pointing | Turn ending | VAD + min-silence decision that user has finished. |
| Pre-roll | Pre-speech buffer | Keep 200-400 ms of audio before VAD fires to avoid first-word clip. |
| Tool call | Function invocation | LLM emits JSON; runtime dispatches; result feeds back in-loop. |

## Leer más

- [LiveKit — voice agent quickstart](https://docs.livekit.io/agents/) Referencia de grado de producción.
- [Pipecat — voice agent examples](https://github.com/pipecat-ai/pipecat) Marco de trabajo personal.
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) el camino nativo de voz gestionado.
- [Kyutai Moshi](https://github.com/kyutai-labs/moshi) Referencia de doble completo (lección 15).
- [Porcupine wake-word](https://picovoice.ai/products/porcupine/) la puerta de la palabra de la alarma.
- [Anthropic — tool use guide](https://docs.anthropic.com/en/docs/build-with-claude/tool-use) Llamamiento de funciones de LLM.
