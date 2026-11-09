# Generación de audio

> El audio es una señal 1-D a 16-48 kHz. Un clip de cinco segundos es de 80-240k muestras. Ningún transformador atende a esa secuencia directamente. La solución para cada modelo de audio de producción en 2026 es la misma: un codec neuronal (Encodec, SoundStream, DAC) comprime el audio a tokens discretos a 50-75 Hz, y un transformador o modelo de difusión genera tokens.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Audio Features), Phase 6 · 04 (ASR), Phase 8 · 06 (DDPM)
**Time:** ~45 minutes

## El problema

Tres tareas de generación de audio:

1. **Text-to-speech.**En el texto, produce el habla. El habla limpia es de banda estrecha y tiene una estructura fonética fuerte  bien resuelta por los transformadores sobre tokens. VALL-E (Microsoft), NaturalSpeech 3, ElevenLabs, OpenAI TTS.
2. **Music generation.**Dado un impulso (texto, melodía, progresión de acordes, género), produce música. Distribución mucho más amplia. MusicGen (Meta), Stable Audio 2.5, Suno v4, Udio, Riffusion.
3. **Audio effects / sound design.**En caso de que se le indique, produzca un sonido ambiente o Foley.

Los tres funcionan en el mismo sustrato: codec de audio neuronal + token-AR o generador de difusión.

## El concepto

![Audio generation: codec tokens + transformer or diffusion](../assets/audio-generation.svg)

### Códec de audio neuronal

Encodec (Meta, 2022), SoundStream (Google, 2021), Descript Audio Codec (DAC, 2023). Un codificador convolucional comprime la forma de onda a un vector por paso de tiempo; cuantización de vectores residuales (RVQ) convierte cada vector en una cascada de índices de K de código.

```
waveform (16000 samples/sec)
    └─ encoder conv ─┐
                     ├─ RVQ layer 1 → indices at 75 Hz
                     ├─ RVQ layer 2 → indices at 75 Hz
                     ├─ ...
                     └─ RVQ layer 8
```

### Dos paradigmas generacionales en la parte superior

**Token-autoregressive.**Plantear tokens RVQ en una secuencia, ejecutar un transformador solo para decodificador. MusicGen utiliza "paralelo retrasado" para emitir flujos de código de K en paralelo con los offsets por flujo. VALL-E genera tokens de voz a partir de un mensaje de texto + muestra de voz de 3 segundos.

**Latent diffusion.**Embarque los tokens de codec como latencias continuas o modelos con difusión categórica. Stable Audio 2.5 utiliza la coincidencia de flujo en latencias de audio continuas. AudioLDM 2 utiliza difusión de texto a correo electrónico a audio.

La tendencia 2024-2026: la coincidencia de flujo está ganando para la música (inflación más rápida, muestras más limpias) mientras que la AR token todavía domina el habla porque es naturalmente causal y fluye bien.

## Paisaje de producción

| System | Task | Backbone | Latency |
|--------|------|----------|---------|
| ElevenLabs V3 | TTS | Token-AR + neural vocoder | ~300ms first token |
| OpenAI GPT-4o audio | Full-duplex speech | End-to-end multimodal AR | ~200ms |
| NaturalSpeech 3 | TTS | Latent flow matching | Non-streaming |
| Stable Audio 2.5 | Music / SFX | DiT + flow matching on audio latents | ~10s for 1-minute clip |
| Suno v4 | Full songs | Undisclosed; token-AR suspected | ~30s per song |
| Udio v1.5 | Full songs | Undisclosed | ~30s per song |
| MusicGen 3.3B | Music | Token-AR on Encodec 32kHz | Real-time |
| AudioCraft 2 | Music + SFX | Flow matching | ~5s for 5s clip |
| Riffusion v2 | Music | Spectrogram diffusion | ~10s |

```figure
score-matching
```

## Construye el mismo

`code/main.py`simula la idea principal: entrenar un pequeño transformador de next-token en secuencias sintéticas de "token de audio" generadas a partir de dos "estilos" distintos (alternando tokens bajos y altos para el estilo A, rampa monótona para el estilo B). Condición en el estilo y muestra.

### Paso 1: Tokens de audio sintéticos

```python
def make_tokens(style, length, vocab_size, rng):
    if style == 0:  # "speech-like": alternating
        return [i % vocab_size for i in range(length)]
    # "music-like": ramp
    return [(i * 3) % vocab_size for i in range(length)]
```

### Paso 2: entrenar un pequeño predictor de token

Un predictor de estilo bigram condicionado al estilo. El punto es el patrón: tokens de codec → entrenamiento de entropía cruzada → muestreo autoregresivista.

### Paso 3: muestra condicionalmente

Dado el token de estilo y un token de inicio, muestra el siguiente token de la distribución prevista. Continúa por 20-40 tokens.

## Las trampas

- **Codec quality caps output quality.**Si el codec no puede representar un sonido fielmente, ninguna cantidad de calidad del generador ayuda.
- **RVQ error accumulation.**Cada capa RVQ modela el residuo de la anterior. Los errores en la capa 1 se propagan.
- **Musical structure.**30 segundos de tokens es 20k + tokens a 75 Hz. Es difícil para transformadores. MusicGen utiliza ventana deslizante + continuación rápida; Stable Audio utiliza clipes más cortos + crossfading.
- **Artifacts at boundaries.**La combinación entre los clips generados requiere una superposición cuidadosa.
- **Clean-data appetite.**Los generadores de música necesitan decenas de miles de horas de música con licencia. La demanda de Suno / Udio RIAA (2024) puso esto a la superficie.
- **Voice cloning ethics.**Una muestra de 3 segundos más un mensaje de texto es suficiente para que VALL-E / XTTS / ElevenLabs clone una voz.

## Usalo

| Task | 2026 stack |
|------|------------|
| Commercial TTS | ElevenLabs, OpenAI TTS, or Azure Neural |
| Voice cloning (consent-verified) | XTTS v2 (open) or ElevenLabs Pro |
| Background music, fast | Stable Audio 2.5 API, Suno, or Udio |
| Music with lyrics | Suno v4 or Udio v1.5 |
| Sound effects / Foley | AudioCraft 2, ElevenLabs SFX, or Stable Audio Open |
| Real-time voice agent | GPT-4o realtime or Gemini Live |
| Open-weights music research | MusicGen 3.3B, Stable Audio Open 1.0, AudioLDM 2 |
| Dubbing / translation | HeyGen, ElevenLabs Dubbing |

## Envío

Salva .`outputs/skill-audio-brief.md`. Skill toma un breve audio (tarea, duración, estilo, voz, licencia) y las salidas: modelo + alojamiento, formato de solicitud (tags de género, descriptores de estilo, marcadores estructurales), codec + generador + cadena de vocoder, protocolo de semilla y plan de evaluación (score MOS / CLAP / CER para TTS / usuario A / B).

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`Verifique si las secuencias generadas coinciden con el patrón del estilo.
2. **Medium.**Añadir decodificación paralela retrasada: simular 2 flujos de tokens que deben permanecer compensados por 1 paso. Entrenar un predictor conjunto.
3. **Hard.**Utilice transformadores HuggingFace para ejecutar MusicGen-small localmente. Generar un clip de 10 segundos con tres instrucciones diferentes; A/B para la adhesión al estilo.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Codec | "Neural compression" | Encoder / decoder for audio; typical output is 50-75 Hz tokens. |
| RVQ | "Residual VQ" | Cascade of K quantizers; each models the residual of the previous. |
| Token | "One codec symbol" | Discrete index into a codebook; 1024 or 2048 typical. |
| Delayed parallel | "Offset codebooks" | Emit K token streams with staggered offsets to reduce sequence length. |
| Flow matching | "The 2024 win for audio" | Straighter-path alternative to diffusion; faster sampling. |
| Voice prompt | "3-second sample" | Speaker embedding or token prefix that steers the cloned voice. |
| Mel spectrogram | "The visual" | Log-magnitude perceptual spectrogram; used by many TTS systems. |
| Vocoder | "Mel to wave" | Neural component that converts mel spectrograms back to audio. |

## Nota de producción: el audio es un problema de transmisión

El audio es la modalidad de salida que los usuarios esperan llegar *como se genera*, no de una vez. En términos de producción esto significa que TPOT importa (Tiempo por Token de salida) porque la velocidad de escucha del usuario es el rendimiento objetivo  no su velocidad de lectura. Para el audio de 16 kHz tokenado a ~75 tokens/segundo (Encodec), el servidor debe generar ≥75 tokens/segundo por usuario para mantener la reproducción fluida.

Dos consecuencias arquitectónicas:

- **Flow-matching audio models cannot stream trivially.**Stable Audio 2.5 y AudioCraft 2 hacen una longitud fija de clip en un solo paso. Para transmitir, se desglosan el clip y se superponen los límites  pensar en la difusión de la ventana corredera  añadir 100-300 ms de latencia en el modelo de AR de codec.

Si el producto es "chat de voz en vivo" o "continuidad de música en tiempo real", elija el camino de AR del codec. Si es "rendir un clip de 30 segundos en la presentación", el flujo de coincidencia gana en calidad y latencia total.

## Leer más

- [Défossez et al. (2022). Encodec: High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) el estándar de códec.
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) el primer códec de audio neuronal ampliamente utilizado.
- [Kumar et al. (2023). High-Fidelity Audio Compression with Improved RVQGAN (DAC)](https://arxiv.org/abs/2306.06546) DAC.
- [Wang et al. (2023). Neural Codec Language Models are Zero-Shot Text to Speech Synthesizers (VALL-E)](https://arxiv.org/abs/2301.02111)¿Qué es eso?
- [Copet et al. (2023). Simple and Controllable Music Generation (MusicGen)](https://arxiv.org/abs/2306.05284) MusicGen.
- [Liu et al. (2023). AudioLDM 2: Learning Holistic Audio Generation with Self-supervised Pretraining](https://arxiv.org/abs/2308.05734) AudioLDM 2.
- [Stability AI (2025). Stable Audio 2.5](https://stability.ai/news-updates/stability-ai-introduces-stable-audio-25-the-first-audio-model-built-for-enterprise-sound-production-at-scale) 2025 texto a música con flujo de coincidencia.
