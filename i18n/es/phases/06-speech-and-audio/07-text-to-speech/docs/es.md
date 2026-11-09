# Textos a voz (TTS)  De Tacotron a F5 y Kokoro

> ASR inverte el habla al texto; TTS inverte el texto al habla. La pila 2026 está compuesta por tres partes: texto → tokens, tokens → mel, mel → waveform. Cada parte tiene un modelo predeterminado que se ajusta a una computadora portátil.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 09 (Seq2Seq), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## El problema

Tienes una cadena: "Por favor, recuerda que regar las plantas a las 6 pm". Necesitas un clip de audio de 3 segundos que suene natural, tenga una prosodia correcta (pausas, estrés), pronuncie "plantes" con la vocales correctas y se ejecuta en menos de 300 ms en una CPU para un asistente de voz en vivo. También necesitas intercambiar voces, manejar entradas con código cambiado ("recordame a las 6 pm, daijoubu?"), y no avergonzarte por los nombres.

Los oleoductos modernos TTS se ven así:

1. **Text frontend.**Normaliza el texto (fechas, números, correos electrónicos), convierta en fonemas o fichas de palabras, predica las características de prosodia.
2. **Acoustic model.**Texto → espectrograma mel. Tacotron 2 (2017), FastSpeech 2 (2020), VITS (2021), F5-TTS (2024), Kokoro (2024).
3. **Vocoder.**Mel → forma de onda. WaveNet (2016), WaveRNN, HiFi-GAN (2020), BigVGAN (2022), vocoders de códec neural en 2024+.

En 2026 el vocalista acústico + vocoder se desdivide con modelos de difusión de extremo a extremo y de coincidencia de flujo.

## El concepto

![Tacotron, FastSpeech, VITS, F5/Kokoro side-by-side](../assets/tts.svg)

**Tacotron 2 (2017).**Seq2seq: car-embedding → BiLSTM encoder → atención sensible a la ubicación → autoregressive LSTM decoder emite marcos mel. lento (AR), oscilante en texto largo.

**FastSpeech 2 (2020).**No autorregresivista. El predictor de duración saca cuántos marcos mel cada fonema obtiene. 1-pasar, 10 veces más rápido que Tacotron. pierde algo de naturalidad (alineamiento monótono) pero navega por todas partes.

**VITS (2021).**En conjunto, el programa de entrenamiento de código + duración basada en flujo + vocoder HiFi-GAN de extremo a extremo con inferencia variativa. Alta calidad, modelo único. TTS de código abierto dominante 20222024. Variantes: YourTTS (multiplicador de tiro cero), XTTS v2 (2024, Coqui).

**F5-TTS (2024).**Transformador de difusión sobre la coincidencia de flujo. Prósodia natural, clonación de voz de tiro cero con 5 segundos de audio de referencia.

**Kokoro (2024).**Pequeño (82M), ejecutado por CPU, mejor TTS de inglés para uso en tiempo real.

**OpenAI TTS-1-HD, ElevenLabs v2.5, Google Chirp-3.**El estado comercial de la técnica. ElevenLabs v2.5 etiquetas de emoción ("[susurrado]", "[risas]") y voces de personajes dominan la producción de audiolibros en 2026.

### Evolución del vocoder

| Era | Vocoder | Latency | Quality |
|-----|---------|---------|---------|
| 2016 | WaveNet | offline only | SOTA at release |
| 2018 | WaveRNN | ~realtime | good |
| 2020 | HiFi-GAN | 100× realtime | near-human |
| 2022 | BigVGAN | 50× realtime | generalizes across speakers/langs |
| 2024 | SNAC, DAC (neural codecs) | integrated with AR models | discrete tokens, bit-efficient |

Para 2026, la mayoría de los modelos "TTS" son de extremo a extremo desde el texto a la forma de onda; el espectrograma mel es una representación interna.

### Evaluación

- **MOS (Mean Opinion Score).**Escala de 1 a 5, de fuente multitudinaria, todavía el estándar de oro, dolorosamente lento.
- **CMOS (Comparative MOS).**Preferencia A-vs-B. Intervalos de confianza más estrechos por anotación.
- **UTMOS, DNSMOS.**Predictores neuronales de MOS sin referencias, usados para los rankings.
- **CER (Character Error Rate) via ASR.**Ejecutar la salida TTS a través de Whisper, calcular CER contra el texto de entrada.
- **SECS (Speaker Embedding Cosine Similarity).**La calidad de clonación de voz.

Números 2026 de limpieza de ensayo LibriTTS:

| Model | UTMOS | CER (via Whisper) | Size |
|-------|-------|-------------------|------|
| Ground truth | 4.08 | 1.2% | — |
| F5-TTS | 3.95 | 2.1% | 335M |
| XTTS v2 | 3.81 | 3.5% | 470M |
| VITS | 3.62 | 3.1% | 25M |
| Kokoro v0.19 | 3.87 | 1.8% | 82M |
| Parler-TTS Large | 3.76 | 2.8% | 2.3B |

```figure
sp-tts-stack
```

## Construye el mismo

### Paso 1: fonemizar la entrada

```python
from phonemizer import phonemize
ph = phonemize("Hello world", language="en-us", backend="espeak")
# 'həloʊ wɜːld'
```

Los fonemas son el puente universal. Evite alimentar texto crudo a cualquier cosa por debajo del nivel de calidad de VITS.

### Paso 2: ejecutar Kokoro (2026 CPU por defecto)

```python
from kokoro import KPipeline
tts = KPipeline(lang_code="a")  # "a" = American English
audio, sr = tts("Please remind me to water the plants at 6 pm.", voice="af_bella")
# audio: float32 tensor, sr=24000
```

Se ejecuta fuera de línea, un solo archivo, 82M params.

### Paso 3: ejecutar F5-TTS con clonación de voz

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="my_voice_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please remind me to water the plants.",
)
```

Pasar un clip de referencia de 5 segundos + su transcripción; F5 clona prosodia y timbre.

### Paso 4: Vocoder HiFi-GAN desde cero

Demasiado grande para encajar en un guión de tutoriales, pero la forma es:

```python
class HiFiGAN(nn.Module):
    def __init__(self, mel_channels=80, upsample_rates=[8, 8, 2, 2]):
        super().__init__()
        # 4 upsample blocks, total 256x to go from mel-rate to audio-rate
        ...
    def forward(self, mel):
        return self.blocks(mel)  # -> waveform
```

Formación: adversarial (discriminador en ventanas cortas) + pérdida de reconstrucción del espectrograma mel + pérdida de coincidencia de características.`hifi-gan`¿Qué es esto?

### Paso 5: el conjunto completo de tuberías (pseudocodo)

```python
text = "Please remind me at 6 pm."
phones = phonemize(text)
mel = acoustic_model(phones, speaker=alice)      # [T, 80]
wav = vocoder(mel)                                # [T * 256]
soundfile.write("out.wav", wav, 24000)
```

## Usalo

La pila de 2026:

| Situation | Pick |
|-----------|------|
| Real-time English voice assistant | Kokoro (CPU) or XTTS v2 (GPU) |
| Voice cloning from 5 s reference | F5-TTS |
| Commercial character voices | ElevenLabs v2.5 |
| Audiobook narration | ElevenLabs v2.5 or XTTS v2 + fine-tune |
| Low-resource language | Train VITS on 5–20 h target-lang data |
| Expressive / emotion tags | ElevenLabs v2.5 or StyleTTS 2 fine-tune |

Líder de código abierto a partir de 2026: **F5-TTS for quality, Kokoro for efficiency**No llegues a Tacotron a menos que seas un historiador.

## Las trampas

- **No text normalizer.**"Dr. Smith" se lee como "Doctor" o "Drive"? "2026" como "veinte veintiséis" o "dos cero dos seis"?
- **OOV proper nouns.**"Ghumare" → "ghyu-mair"? Envía un modelo de fallback grapheme-to-phoneme para tokens desconocidos.
- **Clipping.**La salida del vocoder rara vez se hace, pero la desajuste de escalación de mel en la inferencia puede superar ±1.0.`np.clip(wav, -1, 1)`¿ Qué ?
- **Sample-rate mismatch.**Kokoro emitirá 24 kHz; su tubería aguas abajo espera 16 kHz → replantear o obtener alias.

## Envío

Salvo como`outputs/skill-tts-designer.md`Diseñar una tubería TTS para una determinada voz, latencia y lenguaje objetivo.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`Construye un diccionario de fonemas a partir de una vocabulario de juguete, estima la duración por fonema e imprime un calendario falso de "mel".
2. **Medium.**Instala Kokoro, sintetiza la misma oración en voz.`af_bella`y `am_adam`Comparar las duradas de audio y la calidad subjetiva.
3. **Hard.**Graba un clip de referencia de 5 segundos de ti mismo, usa F5-TTS para clonarlo, informe SECS entre la referencia y la salida clonada.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Phoneme | Sound unit | Abstract sound class; 39 in English (ARPABet). |
| Duration predictor | How long each phoneme lasts | Non-AR model output; integer frames per phoneme. |
| Vocoder | Mel → waveform | Neural net mapping mel-spec to raw samples. |
| HiFi-GAN | Standard vocoder | GAN-based; dominant 2020–2024. |
| MOS | Subjective quality | 1–5 mean opinion score from human raters. |
| SECS | Voice-clone metric | Cosine similarity between target and output speaker embedding. |
| F5-TTS | 2024 open-source SOTA | Flow-matching diffusion; zero-shot cloning. |
| Kokoro | CPU English leader | 82M-param model, Apache 2.0. |

## Leer más

- [Shen et al. (2017). Tacotron 2](https://arxiv.org/abs/1712.05884) el nivel de base de seguimiento.
- [Kim, Kong, Son (2021). VITS](https://arxiv.org/abs/2106.06103) basado en flujo de extremo a extremo.
- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) SOTA de código abierto actual.
- [Kong, Kim, Bae (2020). HiFi-GAN](https://arxiv.org/abs/2010.05646) el vocoder que todavía se envía en 2026.
- [Kokoro-82M on HuggingFace](https://huggingface.co/hexgrad/Kokoro-82M) 2024 TTS inglés compatible con la CPU.
