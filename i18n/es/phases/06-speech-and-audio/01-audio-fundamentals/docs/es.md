# Fundamentos de audio  Forma de onda, muestreo, transformación de Fourier

> Las formas de onda son la señal bruta. Los espectrogramas son la representación. Las características de Mel son la forma amigable con ML. Cada tubería moderna de ASR y TTS camina esta escalera, y el primer paso es entender el muestreo y Fourier.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 · 06 (Vectors & Matrices), Phase 1 · 14 (Probability Distributions)
**Time:** ~45 minutes

## El problema

Un micrófono produce una señal de presión contra tiempo. Su red neuronal consume tensores. Entre ellos se encuentra una pila de convenciones que, cuando se violan, producen errores silenciosos: el modelo se entrena bien pero el WER se duplica, o TTS envía un silbido, o un sistema de clonación de voz memoriza el micrófono en lugar del altavoz.

Cada error en los sistemas de habla se remonta a una de las tres preguntas:

1. ¿A qué tasa de muestreo se registraron los datos, y qué espera el modelo?
2. ¿La señal es alias?
3. ¿Está operando en muestras crudas o en una representación de frecuencia?

Si haces esto bien, el resto de la Fase 6 es manejable, si haces esto mal, incluso Whisper-Large-v4 produce basura.

## El concepto

![Waveform, sampling, DFT, and frequency bins visualized](../assets/audio-fundamentals.svg)

**Waveform.**Una matriz unidimensional de flotadores en `[-1.0, 1.0]`Para convertir en segundos, dividir por la tasa de muestra:`t = n / sr`Un clip de 10 segundos a 16 kHz es un conjunto de 160.000 floats.

**Sampling rate (sr).**¿Cuántas muestras por segundo?

| Rate | Use |
|------|-----|
| 8 kHz | Telephony, legacy VOIP. Nyquist at 4 kHz kills consonants. Avoid for ASR. |
| 16 kHz | ASR standard. Whisper, Parakeet, SeamlessM4T v2 all consume 16 kHz. |
| 22.05 kHz | TTS vocoder training for older models. |
| 24 kHz | Modern TTS (Kokoro, F5-TTS, xTTS v2). |
| 44.1 kHz | CD audio, music. |
| 48 kHz | Film, pro audio, high-fidelity TTS (VALL-E 2, NaturalSpeech 3). |

**Nyquist-Shannon.**Una tasa de muestreo de `sr`puede representar de forma inequívoca frecuencias de hasta `sr/2`- El .`sr/2`La energía que se encuentra por encima de Nyquist se dobla hacia abajo en frecuencias más bajas y corrompe la señal.

**Bit depth.**PCM de 16 bits (firmado int16, rango ±32,767) es el formato de intercambio universal.`soundfile`leer int16 pero exponer float32 matrices en `[-1, 1]`¿ Qué ?

**Fourier Transform.**Cualquier señal finita es una suma de sinusoides en diferentes frecuencias.`N`muestras, `N`coeficientes complejos  uno por cuadro de frecuencia. `bin k`mapas a la frecuencia `k · sr / N`La magnitud es la amplitud en esa frecuencia, el ángulo es la fase.

**FFT.**Transformación rápida de Fourier: un `O(N log N)`algoritmo para el DFT cuando `N`Una FFT de 1024 muestras a 16 kHz da 512 contenedores de frecuencia utilizables que abarcan 08 kHz a una resolución de 15.6 Hz.

**Framing + window.**No FFT un clip entero. lo cortamos en *frames* superpuestos (generalmente 25 ms con 10 ms saltar), multiplicamos cada frame por una función de ventana (Hann, Hamming) para eliminar las discontinuidades de borde, luego FFT cada frame. Esto es el Short-Time Fourier Transform (STFT).

```figure
mel-scale
```

## Construye el mismo

### Paso 1: lee un clip y traza la forma de onda

`code/main.py`sólo utiliza el stdlib `wave`Modulo para mantener la demostración libre de dependencia.`soundfile`o `torchaudio.load`(ambos regresan `(waveform, sr)`Túples:

```python
import soundfile as sf
waveform, sr = sf.read("clip.wav", dtype="float32")  # shape (T,), sr=int
```

### Paso 2: sintetizar una onda seno a partir de los primeros principios

```python
import math

def sine(freq_hz, sr, seconds, amp=0.5):
    n = int(sr * seconds)
    return [amp * math.sin(2 * math.pi * freq_hz * i / sr) for i in range(n)]
```

Un seno de 440 Hz (concierto A) a 16 kHz durante 1 segundo es 16.000 flotantes.`wave.open(..., "wb")`utilizando codificación PCM de 16 bits.

### Paso 3: calcular el DFT a mano

```python
def dft(x):
    N = len(x)
    out = []
    for k in range(N):
        re = sum(x[n] * math.cos(-2 * math.pi * k * n / N) for n in range(N))
        im = sum(x[n] * math.sin(-2 * math.pi * k * n / N) for n in range(N))
        out.append((re, im))
    return out
```

`O(N²)` bien por `N=256`Para confirmar la corrección, inútil para el audio real.`numpy.fft.rfft`o `torch.fft.rfft`¿ Qué ?

### Paso 4: encontrar la frecuencia dominante

Indice de pico de magnitud `k_star`mapas a la frecuencia `k_star * sr / N`Si ejecutamos esto en el seno de 440 Hz , volveremos a ver un pico en bin .`440 * N / sr`¿ Qué ?

### Paso 5: demostrar el alias

Muestre un seno de 7 kHz a 10 kHz (Nyquist = 5 kHz). El tono de 7 kHz está por encima de Nyquist y se pliega a`10 − 7 = 3 kHz`El máximo de FFT aparece a 3 kHz. Esta es la demo de alias clásica y la razón por la cual todos los DAC / ADC envían con un filtro de paso bajo de pared de ladrillo.

## Usalo

La pila que enviará en 2026:

| Task | Library | Why |
|------|---------|-----|
| Read/write WAV/FLAC/OGG | `soundfile` (libsndfile wrapper) | Fastest, stable, returns float32. |
| Resample | `torchaudio.transforms.Resample` or `librosa.resample` | Correct anti-aliasing built in. |
| STFT / Mel | `torchaudio` or `librosa` | GPU-friendly; PyTorch ecosystem. |
| Real-time streaming | `sounddevice` or `pyaudio` | Cross-platform PortAudio bindings. |
| Inspect a file | `ffprobe` or `soxi` | CLI, fast, reports sr/channels/codec. |

Regla de decisión: **match sample rate before you match anything else**Whisper espera una mono float de 16 kHz.

## Envío

Salvo como`outputs/skill-audio-loader.md`La habilidad le ayuda a comprobar si la entrada de audio coincide con las expectativas del modelo en línea y repeticiones correctas cuando no lo hace.

## Los ejercicios

1. **Easy.**Sintetiza una mezcla de 1 segundo de 220 Hz + 440 Hz + 880 Hz a 16 kHz. ejecuta DFT. Confirme tres picos en los contenedores esperados.
2. **Medium.**Graba un WAV de 3 segundos de tu voz a 48 kHz.`torchaudio.transforms.Resample`(con antialiasing), luego a 16 kHz usando decimación ingenua (cada tercera muestra).
3. **Hard.**Construir el STFT desde cero usando sólo `math`y el DFT de la etapa 3. tamaño de cuadro 400, salta 160, ventana Hann.`matplotlib.pyplot.imshow`Este es el espectrograma de la Lección 02.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Sample rate | How many samples per second | Frequency in Hz at which the ADC measures the signal. |
| Nyquist | The max frequency you can represent | `sr/2`; energy above it aliases back down. |
| Bit depth | Resolution of each sample | `int16` = 65,536 levels; `float32` = 24-bit precision in `[-1, 1]`. |
| DFT | The Fourier transform for sequences | `N` samples → `N` complex frequency coefficients. |
| FFT | The fast DFT | `O(N log N)` algorithm requiring `N` = power of 2. |
| Bin | Frequency column | `k · sr / N` Hz; resolution = `sr / N`. |
| STFT | Spectrogram under the hood | Framed + windowed FFT over time. |
| Aliasing | Weird frequency ghosts | Energy above Nyquist mirroring down to lower bins. |

## Leer más

- [Shannon (1949). Communication in the Presence of Noise](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf) el papel detrás del teorema de muestreo.
- [Smith — The Scientist and Engineer's Guide to Digital Signal Processing](https://www.dspguide.com/ch8.htm) libro de texto canónico de DSP.
- [librosa docs — audio primer](https://librosa.org/doc/latest/auto_tutorials/index.html) Un paso práctico con el código.
- [Heinrich Kuttruff — Room Acoustics (6th ed.)](https://www.taylorfrancis.com/books/mono/10.1201/9781315372150/room-acoustics-heinrich-kuttruff) referencia de por qué el audio del mundo real no es un sinusoide limpio.
- [Steve Eddins — FFT Interpretation notebook](https://blogs.mathworks.com/steve/2020/03/30/fft-spectrum-and-spectral-densities/)La intuición del contenedor de frecuencia se despejó en 10 minutos.
