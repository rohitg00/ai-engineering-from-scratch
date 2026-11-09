# Espectogramas, escala de mel y características de audio

> Las redes neuronales no consumen bien las formas de onda crudas. Consumen espectrogramas. Consumen espectrogramas mel aún mejor. Cada clasificador de audio, TTS y ASR en 2026 vive o muere por esta sola elección de procesamiento previo.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 01 (Audio Fundamentals)
**Time:** ~45 minutes

## El problema

Toma un clip de 10 segundos de 16 kHz. Eso es 160.000 floats, todo en`[-1, 1]`La forma de onda cruda tiene la información pero en una forma que el modelo no puede extraer fácilmente. Dos fonemas idénticos hablados a 100 ms de distancia tienen muestras crudas completamente diferentes.

Un espectrograma corrige esto. Se derrumba el detalle temporal donde la percepción humana lo ignora (miocrosegundo de nerviosismo) y conserva la estructura donde la percepción asiste (que son frecuencias energéticas, en ventanas de tiempo de ~ 1025 ms).

Los espectrogramas mel empujan más lejos. Los humanos perciben el tono logaritmicamente: 100 Hz vs 200 Hz suenan "la misma distancia entre sí" que 1000 Hz vs 2000 Hz. La escala mel deforma el eje de frecuencia para que coincida. Un espectrograma a escala mel es la característica más importante en el lenguaje ML desde 2010 hasta 2026.

## El concepto

![Waveform to STFT to mel spectrogram to MFCC ladder](../assets/mel-features.svg)

**STFT (Short-Time Fourier Transform).**Cortar la forma de onda en cuadros superpuestos (típico: ventana de 25 ms, 10 ms hop = 400 muestras / 160 muestras a 16 kHz). Multiplicar cada cuadro por una función de ventana (Hann es el predeterminado; Hamming un poco diferente tradeoff). FFT cada cuadro. apilar los espectros de magnitud en una matriz de forma `(n_frames, n_freq_bins)`Ese es tu espectrograma.

**Log-magnitude.**Las magnitudes primas abarcan entre 5 y 6 órdenes de magnitud.`log(|X| + 1e-6)`o `20 * log10(|X|)`Cada línea de producción utiliza la magnitud de registro, no la magnitud en bruto.

**Mel scale.**Frecuencia `f`en mapas Hz a mel `m`por $m = 2595 \cdot \log_{10}(1 + f / 700)$. El mapeo es aproximadamente lineal por debajo de 1 kHz y aproximadamente logaritmico por encima. 80 melbins que cubren 08 kHz es la entrada estándar de ASR.

**Mel filterbank.**Un conjunto de filtros triangulares espaciados igualmente en la escala mel. Cada filtro es una suma ponderada de contenedores FFT adyacentes. Multiplicando la magnitud STFT por la matriz de filtro banco se da el espectrograma mel en un matmul.

**Log-mel spectrogram.** `log(mel_spec + 1e-10)`La entrada de Whisper, la entrada de Parakeet, la entrada de SeamlessM4T, el frontend de audio universal 2026.

**MFCCs.**Tomar el espectrograma de log-mel, aplicar un DCT (tipo II), mantener los primeros 13 coeficientes. Descoorrela las características y comprime más. característica dominante hasta alrededor de 2015 cuando CNNs / Transformers en los log-mels crudos se recuperaron. Todavía se utiliza en el reconocimiento de altavoces (vectores x, ECAPA).

**Resolution trade.**FFT más grande = mejor resolución de frecuencia pero peor resolución de tiempo. 25 ms / 10 ms es el audio-ML predeterminado; 50 ms / 12.5 ms para la música; 5 ms / 2 ms para la detección transitoria (batería, plosivos).

```figure
spectrogram-window
```

## Construye el mismo

### Paso 1: Enmarque la forma de onda

```python
def frame(signal, frame_len, hop):
    n = 1 + (len(signal) - frame_len) // hop
    return [signal[i * hop : i * hop + frame_len] for i in range(n)]
```

Un clip de 10 segundos de 16 kHz con `frame_len=400, hop=160`y produce 998 cuadros.

### Paso 2: Ventana Hann

```python
import math

def hann(N):
    return [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]
```

Multiplicar el elemento con la inteligencia antes de la FFT. Elimina la fuga espectral causada por el truncado en puntos finales no cero.

### Paso 3: magnitud de la FST

```python
def stft_magnitude(signal, frame_len=400, hop=160):
    win = hann(frame_len)
    frames = frame(signal, frame_len, hop)
    return [magnitudes(dft([w * s for w, s in zip(win, f)])) for f in frames]
```

Utilizaciones en la producción `torch.stft`o `librosa.stft`El ciclo aquí es pedagógico; se ejecuta en cortos clips en`code/main.py`¿ Qué ?

### Paso 4: banco de filtros de mel

```python
def hz_to_mel(f):
    return 2595.0 * math.log10(1.0 + f / 700.0)

def mel_to_hz(m):
    return 700.0 * (10 ** (m / 2595.0) - 1)

def mel_filterbank(n_mels, n_fft, sr, fmin=0, fmax=None):
    fmax = fmax or sr / 2
    mels = [hz_to_mel(fmin) + (hz_to_mel(fmax) - hz_to_mel(fmin)) * i / (n_mels + 1)
            for i in range(n_mels + 2)]
    hzs = [mel_to_hz(m) for m in mels]
    bins = [int(h * n_fft / sr) for h in hzs]
    fb = [[0.0] * (n_fft // 2 + 1) for _ in range(n_mels)]
    for m in range(n_mels):
        for k in range(bins[m], bins[m + 1]):
            fb[m][k] = (k - bins[m]) / max(1, bins[m + 1] - bins[m])
        for k in range(bins[m + 1], bins[m + 2]):
            fb[m][k] = (bins[m + 2] - k) / max(1, bins[m + 2] - bins[m + 1])
    return fb
```

80 mels que cubren 08 kHz con `n_fft=400`da una`(80, 201)`Matriz. Multiplicar el `(n_frames, 201)`La magnitud de la STFT por la transposición para obtener `(n_frames, 80)`Es un espectrograma de mel.

### Paso 5: registro de correo electrónico

```python
def log_mel(mel_spec, eps=1e-10):
    return [[math.log(max(v, eps)) for v in frame] for frame in mel_spec]
```

Alternativas comunes: `librosa.power_to_db`(dB normalizado en referencia),`10 * log10(power + eps)`. Whisper utiliza un clip más involucrado + normaliza la rutina (ver Whisper's `log_mel_spectrogram`¿Qué es lo que se hace?

### Paso 6: CFCM

```python
def dct_ii(x, n_coeffs):
    N = len(x)
    return [
        sum(x[n] * math.cos(math.pi * k * (2 * n + 1) / (2 * N)) for n in range(N))
        for k in range(n_coeffs)
    ]
```

Aplicar DCT a cada marco de log-mel, mantener los primeros 13 coeficientes. Esa es su matriz MFCC. El primer coeficiente se cae generalmente (que codifica la energía total).

## Usalo

La pila de 2026:

| Task | Features |
|------|----------|
| ASR (Whisper, Parakeet, SeamlessM4T) | 80 log-mels, 10 ms hop, 25 ms window |
| TTS acoustic model (VITS, F5-TTS, Kokoro) | 80 mels, 5–12 ms hop for fine temporal control |
| Audio classification (AST, PANNs, BEATs) | 128 log-mels, 10 ms hop |
| Speaker embedding (ECAPA-TDNN, WavLM) | 80 log-mels or raw-waveform SSL |
| Music (MusicGen, Stable Audio 2) | EnCodec discrete tokens (not mels) |
| Keyword spotting | 40 MFCCs for tiny devices |

Regla de oro: **if you are not working on music, start with 80 log-mels.**La carga de la prueba está en cualquier desviación.

## Las trampas que todavía se envían en 2026

- **Mel count mismatch.**Entrenamiento con 80 mels, inferencia con 128 mels, fallo silencioso, registro de la forma de la característica en ambos extremos.
- **Sample-rate mismatch upstream.**Los Mels calculados a 22,05 kHz se ven diferentes a los 16 kHz.
- **dB vs log.**Whisper espera log-mel, no dB-mel. Algunas tuberías HF se detecten automáticamente, su código personalizado no lo hará.
- **Normalization drift.**Normalización de la producción durante el entrenamiento, normalización global durante la inferencia.
- **Leakage from padding.**El empate cero en el extremo de un clip produce un espectro plano en los marcos traseros.

## Envío

Salvo como`outputs/skill-feature-extractor.md`La habilidad selecciona el tipo de característica, el recuento de mel, el marco/salto y la normalización para un objetivo de modelo determinado.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`. Sintetiza una chirp (frecuencia barrida 200 → 4000 Hz) e imprime el argmax mel bin por fotograma.
2. **Medium.**Re-corre con `n_mels`En el`{40, 80, 128}`y `frame_len`En el`{200, 400, 800}`¿Cuál combinación resuelve mejor el chimp?
3. **Hard.**Implementación `power_to_db`y comparar la precisión de ASR de un pequeño clasificador CNN en AudioMNIST utilizando (a) el registro de datos en bruto, (b) el dB-mel con `ref=max`, (c) MFCC-13 + delta + delta-delta.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Frame | A slice | 25 ms chunk of waveform fed to one FFT. |
| Hop | Stride | Samples between consecutive frames; 10 ms is ASR default. |
| Window | Hann/Hamming thing | Point-wise multiplier that tapers the frame edges to zero. |
| STFT | Spectrogram generator | Framed + windowed FFT; yields time × frequency matrix. |
| Mel | Warped frequency | Log-perception scale; `m = 2595·log10(1 + f/700)`. |
| Filterbank | The matrix | Triangular filters that project STFT onto mel bins. |
| Log-mel | Whisper's input | `log(mel_spec + eps)`; standardized in 2026. |
| MFCC | Old-school feature | DCT of log-mel; 13 coeffs, decorrelated. |

## Leer más

- [Davis, Mermelstein (1980). Comparison of parametric representations for monosyllabic word recognition](https://ieeexplore.ieee.org/document/1163420) el documento de la MFCC.
- [Stevens, Volkmann, Newman (1937). A Scale for the Measurement of the Psychological Magnitude Pitch](https://pubs.aip.org/asa/jasa/article-abstract/8/3/185/735757/) la escala mel original.
- [OpenAI — Whisper source, log_mel_spectrogram](https://github.com/openai/whisper/blob/main/whisper/audio.py) leer la aplicación de referencia.
- [librosa feature extraction docs](https://librosa.org/doc/latest/api/feature.html) referencia para `mfcc`¿ Qué ?`melspectrogram`, y salta / ventana.
- [NVIDIA NeMo — audio preprocessing](https://docs.nvidia.com/deeplearning/nemo/user-guide/docs/en/main/asr/asr_all.html#featurizers) tubería a escala de producción para los modelos Parakeet + Canary.
