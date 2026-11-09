# Transmisiones de voz a voz  Moshi, Hibiki y diálogo doble completo

> 2024-2026 redefinió la IA de voz. Moshi envía un solo modelo que escucha y habla simultáneamente a 200 ms de latencia. Hibiki hace la traducción de voz a voz pieza por pieza. Ambos abandonan la tubería ASR → LLM → TTS para una arquitectura unificada de doble completo sobre tokens de codec Mimi. Este es el nuevo diseño de referencia.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 13 (Neural Audio Codecs), Phase 6 · 11 (Real-Time Audio), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## El problema

Cada agente de voz construido a partir de las lecciones 11 + 12 tiene un nivel de latencia fundamental de alrededor de 300-500 ms: incendios VAD, procesos STT, razones LLM, TTS genera. Cada etapa tiene su propia latencia mínima. Puedes sintonizar y paralelalizar, pero la forma de la tubería te limita.

Moshi (Kyutai, 2024-2026) hace una pregunta diferente: ¿qué pasa si no hay un conducto? ¿Qué pasa si un modelo toma audio y emite audio directamente, continuamente, con texto como un "monólogo interno" intermedio en lugar de una etapa requerida?

La respuesta es:**full-duplex speech-to-speech**La latencia teórica 160 ms (80 ms Mimi frame + 80 ms retraso acústico) La latencia práctica 200 ms en una sola GPU L4. Eso es la mitad de lo que un mejor agente de voz en tubos de su clase logra.

## El concepto

![Moshi architecture: two parallel Mimi streams + inner-monologue text](../assets/moshi-hibiki.svg)

### La arquitectura de Moshi

**Inputs.**Dos flujos de códec Mimi, ambos a 12,5 Hz × 8 libros de códigos:

- Flujo 1: audio de usuario (Mimi codificado, llegando constantemente)
- Stream 2: audio propio de Moshi (generado por Moshi)

**The transformer.**Un transformador temporal de parámetro 7B procesa las dos corrientes y un flujo de texto "monólogo interno".

1. Consume las fichas Mimi de usuario más recientes (8 libros de código).
2. Consume los tokens Moshi Mimi más recientes (8 libros de código, según se ha producido).
3. Genera el siguiente símbolo de texto Moshi (monólogo interno).
4. Generar los siguientes tokens de Moshi Mimi (8 libros de código a través de un pequeño Transformador de Profundidad).

Los tres flujos  audio del usuario, audio de Moshi, texto de Moshi  funcionan en paralelo. Moshi puede escuchar al usuario mientras habla; puede interrumpirse cuando el usuario interrumpe; puede retrocanicular ("mhm") sin romper su pronunciación principal.

**The depth transformer.**En un marco, los 8 códigos no se predicen en paralelo  tienen dependencias entre códigos. Un pequeño "transformador de profundidad" de 2 capas los predice secuencialmente dentro de 80 ms. Esta es la factorization estándar para los LMs de códigos AR (también utilizado por VALL-E, VibeVoice).

### Por qué ayuda el texto del monólogo interno

Sin texto explícito, el modelo tiene que modelar implícitamente el lenguaje en su flujo acústico. La visión de Moshi: forzarlo a emitir tokens de texto junto con el audio. El flujo de texto es esencialmente la transcripción de lo que Moshi está diciendo. Esto mejora la coherencia semántica, hace que sea más fácil intercambiar una cabeza de modelo de lenguaje y le da transcripciones de forma gratuita.

### Hibiki: traducción de voz a voz en streaming

La misma arquitectura, entrenada en pares de traducciones. Audio de origen en, audio de idioma objetivo fuera, continuamente. Hibiki-Zero (feb 2026) elimina la necesidad de datos de entrenamiento alineados a nivel de palabras  utiliza datos de nivel de oración + aprendizaje de refuerzo GRPO para la optimización de latencia.

Cuatro pares de idiomas soportados inicialmente; pueden adaptarse a un nuevo idioma con ≈1000 horas.

### La pila más amplia de Kyutai (2026)

- **Moshi** Diálogo duplex completo (francés primero, inglés bien apoyado)
- **Hibiki / Hibiki-Zero** Traducción simultánea del habla
- **Kyutai STT** RAS de transmisión (500 ms o 2,5 segundos de vista hacia adelante)
- **Kyutai Pocket TTS** TTS de 100M-param se ejecuta en CPU (Jan 2026)
- **Unmute** un conjunto completo de sistemas que combinan estos en servidores públicos

Despliegue en una GPU L40S: 64 sesiones simultáneas en 3x tiempo real.

### El C.S.M. de sésamo  el primo

Sesame CSM (2025) utiliza una idea similar  una columna vertebral Llama-3 con una cabeza de códec Mimi. Pero CSM es unidireccional (tomando contexto + texto, produce voz) en lugar de doble. Es el mejor TTS "presencia de voz" en el mercado; no es del todo lo mismo que la capacidad de doble completo de Moshi.

### Números de rendimiento 2026

| Model | Latency | Use case | License |
|-------|---------|----------|---------|
| Moshi | 200 ms (L4) | full-duplex English / French dialogue | CC-BY 4.0 |
| Hibiki | 12.5 Hz framerate | French ↔ English streaming translation | CC-BY 4.0 |
| Hibiki-Zero | same | 5 language-pairs, no aligned data | CC-BY 4.0 |
| Sesame CSM-1B | 200 ms TTFA | context-conditioned TTS | Apache-2.0 |
| GPT-4o Realtime | ~300 ms | closed, OpenAI API | commercial |
| Gemini 2.5 Live | ~350 ms | closed, Google API | commercial |

```figure
sp-fullduplex
```

## Construye el mismo

### Paso 1: la interfaz

Moshi expone un servidor WebSocket que toma 80 ms de audio codificado por Mimi y devuelve 80 ms de audio codificado por Mimi.

```python
import asyncio
import websockets
from moshi.client_utils import encode_audio_mimi, decode_audio_mimi

async def moshi_chat():
    async with websockets.connect("ws://localhost:8998/api/chat") as ws:
        mic_task = asyncio.create_task(stream_mic_to(ws))
        spk_task = asyncio.create_task(stream_from_to_speaker(ws))
        await asyncio.gather(mic_task, spk_task)
```

### Paso 2: el bucle de doble completo

```python
async def stream_mic_to(ws):
    async for chunk_80ms in mic_stream_at_12_5_hz():
        mimi_tokens = encode_audio_mimi(chunk_80ms)
        await ws.send(serialize(mimi_tokens))

async def stream_from_to_speaker(ws):
    async for msg in ws:
        mimi_tokens, text_token = deserialize(msg)
        audio = decode_audio_mimi(mimi_tokens)
        await play(audio)
```

Ambas direcciones se ejecutan simultáneamente. Python asyncio o futuros de Rust son el transporte estándar.

### Paso 3: el objetivo de la formación (conceptual)

Por cada fotograma de 80 ms `t`¿Qué es esto ?

- Entrada: `user_mimi[0..t]`¿ Qué ?`moshi_mimi[0..t-1]`¿ Qué ?`moshi_text[0..t-1]`
- Previsión: `moshi_text[t]`, entonces`moshi_mimi[t, codebook_0..7]`

El texto se predice antes del audio (monólogo interno); el audio se predice secuencial en el libro de códigos dentro del transformador de profundidad.

### Paso 4: donde el Moshi gana y donde no

Moshi gana:

- Sub-250 ms de extremo a extremo en hardware barato.
- Canales de retroceso naturales y interrupciones.
- No hay código de pegamento de tubería.

Moshi no gana:

- La llamada de herramientas (no está capacitada para ello; necesita un camino separado de LLM).
- El razonamiento largo (Moshi es un modelo de diálogo 8B, no Claude/GPT-4).
- Precisión factual en temas de nicho.
- La mayoría de los casos de uso de las empresas de producción (todavía se utilizan tuberías en 2026).

## Usalo

| Situation | Pick |
|-----------|------|
| Lowest-latency voice companion | Moshi |
| Live translation call | Hibiki |
| Voice demo / research | Moshi, CSM |
| Enterprise agent with tools | Pipeline (Lesson 12), not Moshi |
| Custom-voice TTS in context | Sesame CSM |
| Speech-to-speech, any languages | GPT-4o Realtime or Gemini 2.5 Live (commercial) |

## Las trampas

- **Limited tool calling.**Moshi es un modelo de diálogo, no un marco de agentes.
- **Specific-voice conditioning.**Moshi usa un solo personaje entrenado; la clonación es una carrera de entrenamiento separada.
- **Language coverage.**El francés + inglés es excelente; otros son limitados. Hibiki-Zero ayuda, pero todavía necesitas datos de formación.
- **Resource cost.**Una sesión completa de Moshi tiene un espacio de GPU; no un patrón de implementación compartido barato.

## Envío

Salvo como`outputs/skill-duplex-pipeline.md`Elige pipeline vs. arquitectura de doble completo para una carga de trabajo de agente de voz, con razón.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`Simula simbólicamente la arquitectura de dos corrientes + monólogo interno.
2. **Medium.**Trae a Moshi de HuggingFace, ejecuta el servidor, prueba una conversación, mide la latencia del reloj de la pared desde el final del discurso del usuario hasta el inicio de la respuesta de Moshi.
3. **Hard.**Toma tu agente de tubería de la Lección 12 y compara la latencia P50 vs Moshi en 20 declaraciones de prueba coincidentes.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Full-duplex | Hear-and-speak at once | Two audio streams active simultaneously on the same model. |
| Inner monologue | Model's text stream | Moshi emits text tokens alongside its audio output. |
| Depth transformer | Inter-codebook predictor | Small transformer that predicts 8 codebooks within one 80 ms frame. |
| Mimi | Kyutai's codec | 12.5 Hz × 8 codebooks; semantic+acoustic; powers Moshi. |
| Streaming S2S | Audio → audio live | Chunk-by-chunk translation/dialogue, no pipeline stages. |
| Back-channeling | "Mhm" reactions | Moshi can emit small acknowledgments without breaking its turn. |

## Leer más

- [Défossez et al. (2024). Moshi — speech-text foundation model](https://arxiv.org/html/2410.00037v2)- El periódico.
- [Kyutai Labs (2026). Hibiki-Zero](https://arxiv.org/abs/2602.12345) Translaciones en streaming sin datos alineados.
- [Sesame (2025). Crossing the uncanny valley of voice](https://www.sesame.com/research/crossing_the_uncanny_valley_of_voice) Específico del MCS.
- [Kyutai — Moshi repo](https://github.com/kyutai-labs/moshi) instalar + servidor.
- [OpenAI — Realtime API](https://platform.openai.com/docs/guides/realtime) cerrado comercial.
- [Kyutai — Delayed Streams Modeling](https://github.com/kyutai-labs/delayed-streams-modeling) el marco STT/TTS debajo del capó.
