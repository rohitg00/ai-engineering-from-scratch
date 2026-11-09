# Códec de audio neural  EnCodec, SNAC, Mimi, DAC y la división semántica-acústica

> La generación de audio 2026 es casi toda una serie de tokens. EnCodec, SNAC, Mimi y DAC convierten formas de onda continuas en secuencias discretas que un transformador puede predecir. La división de tokens semánticos vs acústicos  primer código como semántico, descanso como acústico  es el cambio arquitectónico más importante desde el transformador para el audio.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 10 · 11 (Quantization), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## El problema

Los modelos de lenguaje trabajan en tokens discretos. El audio es continuo. Si desea un modelo de estilo LLM para el habla / música  MusicGen, Moshi, Sesame CSM, VibeVoice, Orpheus  primero necesita un **neural audio codec**: un codificador aprendido que discrete el audio en un pequeño vocabulario de tokens, y un decodificador que coincide que reconstruye la forma de onda.

Dos familias han surgido:

1. **Reconstruction-first codecs** EnCodec, DAC. Optimiza la calidad de audio perceptual. Los tokens son "acústicos"  capturan todo, incluida la identidad del altavoz, el timbre, el ruido de fondo.
2. **Semantic-first codecs** Mimi (Kyutai), SpeechTokenizer. Forza el primer código para codificar contenido lingüístico / fonético (a menudo destilizando de WavLM).

Las perspectivas de 2024-2026: **a pure reconstruction codec gives you blurry speech when you try to generate from text.**El LLM sobre tokens de codec tiene que aprender tanto la estructura del lenguaje como la estructura acústica en el mismo libro de código, que no se escala.

## El concepto

![Four codec landscape: EnCodec, DAC, SNAC (multi-scale), Mimi (semantic+acoustic)](../assets/codec-comparison.svg)

### El truco principal: Cuantización de vectores residuales (RVQ)

En lugar de un libro de códigos grande (que necesitaría millones de códigos para una buena calidad), todos los códigos de audio modernos usan **RVQ**El primer libro de código cuantifica la salida del codificador; el segundo cuantifica el residual; etc. Cada libro de código es de 1024 códigos.$1024^8 = 10^{24}$¿ Qué ?

En el momento de la inferencia, el decodificador suma todos los códigos elegidos por marco para reconstruir.

### Los cuatro códec que importan en 2026

**EnCodec (Meta, 2022).**El código base. Encoder-decodificador sobre forma de onda, cuello de botella RVQ. 24 kHz, 32 libretas de código posibles, 4 libretas de código predeterminadas @ 1.5 kbps. Utiliza `1D conv + transformer + 1D conv`arquitectura. Usado por MusicGen.

**DAC (Descript, 2023).**RVQ con libros de código L2-normalizados, funciones de activación periódicas, pérdidas mejoradas. La mayor fidelidad de reconstrucción de cualquier código abierto  a veces indistinguible del habla original con 12 libros de código. 44.1 kHz banda completa.

**SNAC (Hubert Siuzdak, 2024).**RVQ a múltiples escalas  los libros de código gruesos operan a una velocidad de cuadros más baja que los finos. Modelan eficazmente el audio jerárquicamente: un "bozón" grueso a ~ 12 Hz más detalles a 50 Hz. Usado por Orpheus-3B porque la estructura jerárquica se adapta bien a la generación basada en LM.

**Mimi (Kyutai, 2024).**El cambio de juego 2026 . 12.5 Hz frecuencia de fotogramas (extremadamente baja), 8 libros de código @ 4.4 kbps.**distilled from WavLM** entrenado para predecir las características de contenido de voz de WavLM. Los códigos 1-7 son residuos acústicos. Esta división potencia Moshi (lección 15) y Sesame CSM.

### Las velocidades de cuadros son importantes para la modelado del lenguaje

Rate de fotogramas más bajo = secuencia más corta = LM más rápido.

| Codec | Frame rate | 1 s = N frames | Good for |
|-------|-----------|----------------|---------|
| EnCodec-24k | 75 Hz | 75 | music, general audio |
| DAC-44.1k | 86 Hz | 86 | high-fidelity music |
| SNAC-24k (coarse) | ~12 Hz | 12 | AR-LM efficient |
| Mimi | 12.5 Hz | 12.5 | streaming speech |

A 12,5 Hz, una declaración de 10 segundos es sólo 125 marcos de códec  un transformador puede predecirlos fácilmente.

### Señales semánticos vs acústicos

```
frame_t → [semantic_token_t, acoustic_token_0_t, acoustic_token_1_t, ..., acoustic_token_6_t]
```

- **Semantic token (codebook 0 in Mimi).**Encodifica lo que se dijo  fonemas, palabras, contenido. Destilado de WavLM a través de una pérdida de predicción auxiliar.
- **Acoustic tokens (codebooks 1-7).**Timbre de código, identidad del altavoz, prosodia, ruido de fondo, detalles finos.

Un AR LM predice primero el token semántico (condicionado en texto), luego predice los tokens acústicos (condicionados en referencia semántica + altavoz). Esta factorization es la razón por la que el TTS moderno puede cero-shot-clone voces: el modelo semántico maneja el contenido; el modelo acústico maneja el timbre.

### 2026 calidad de reconstrucción (bites por segundo, menor bitrate es mejor)

| Codec | Bitrate | PESQ | ViSQOL |
|-------|---------|------|--------|
| Opus-20kbps | 20 kbps | 4.0 | 4.3 |
| EnCodec-6kbps | 6 kbps | 3.2 | 3.8 |
| DAC-6kbps | 6 kbps | 3.5 | 4.0 |
| SNAC-3kbps | 3 kbps | 3.3 | 3.8 |
| Mimi-4.4kbps | 4.4 kbps | 3.1 | 3.7 |

Los codecs tradicionales como Opus siguen ganando por bit en calidad perceptiva.**discrete tokens**(que no produce Opus) y **generative-model quality**(lo que el LM puede hacer con esos tokens).

```figure
rvq-codec-cascade
```

## Construye el mismo

### Paso 1: codificar con EnCodec

```python
from encodec import EncodecModel
import torch

model = EncodecModel.encodec_model_24khz()
model.set_target_bandwidth(6.0)  # kbps

wav = torch.randn(1, 1, 24000)
with torch.no_grad():
    encoded = model.encode(wav)
codes, scale = encoded[0]
# codes: (1, n_codebooks, n_frames), dtype=int64
```

`n_codebooks=8`Cada código es 0-1023 (10 bits).

### Paso 2: Descifrar y medir la reconstrucción

```python
with torch.no_grad():
    wav_recon = model.decode([(codes, scale)])

from torchaudio.functional import compute_deltas
import torch.nn.functional as F

mse = F.mse_loss(wav_recon[:, :, :wav.shape[-1]], wav).item()
```

### Paso 3: la división semántica-acústica (estilo Mimi)

```python
from moshi.models import loaders
mimi = loaders.get_mimi()

with torch.no_grad():
    codes = mimi.encode(wav)  # shape (1, 8, frames@12.5Hz)

semantic = codes[:, 0]
acoustic = codes[:, 1:]
```

El código semántico 0 está alineado con WavLM. Se puede entrenar un transformador de texto a semántica  un vocabulario mucho más pequeño que ir directamente al audio. Luego, un decodificador de forma acústica a onda separado condiciones en una referencia de altavoz.

### Paso 4: por qué funciona el AR LM sobre los tokens de codec

Para un clip de 10 segundos de voz en los libros de códigos de Mimi de 12,5 Hz × 8:

```math
N_{\text{tokens}} = 10 \times 12.5 \times 8 = 1000 \text{ tokens}
```

1000 tokens es un contexto trivial para un transformador. Un transformador de parámetro de 256M puede generar 10 segundos de habla en milisegundos en una GPU moderna.

## Usalo

Problema de mapa → codec:

| Task | Codec |
|------|-------|
| General music generation | EnCodec-24k |
| Highest-fidelity reconstruction | DAC-44.1k |
| AR LM over speech (TTS) | SNAC or Mimi |
| Streaming full-duplex speech | Mimi (12.5 Hz) |
| Sound-effect library with text | EnCodec + T5 condition |
| Fine-grained audio editing | DAC + inpainting |

Regla de oro: **if you're building a generative model, start with Mimi or SNAC. If you're building a compression pipeline, use Opus.**

## Las trampas

- **Too many codebooks.**Añadir libros de código aumenta la fidelidad linealmente pero la longitud de la secuencia LM también linealmente.
- **Frame-rate mismatch.**El entrenamiento de LM en 12,5 Hz Mimi luego el ajuste fino en 50 Hz EnCodec falla silenciosamente.
- **Assuming all codebooks equal.**En Mimi, el código 0 lleva contenido; perderlo destruye la inteligencia.
- **Using reconstruction quality as the only metric.**Un codec puede tener una gran reconstrucción pero no servirá para la generación basada en LM si la estructura semántica es mala.

## Envío

Salvo como`outputs/skill-codec-picker.md`Seleccione un codec para una tarea generativa o de compresión dada.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`Implementa un cuantificador de juguete escalar + residual y mide el error de reconstrucción al agregar libros de código.
2. **Medium.**Instalar`encodec`y comparar 1, 4, 8, 32 libros de código en un clip de discurso prolongado.
3. **Hard.**Carga Mimi. Encienda un clip. reemplace el código 0 con números enteros aleatorios; decodifique. Luego reemplace el código 7 de manera similar. Compara las dos corrupciones  código 0 corrupción debe destruir la inteligencia; código 7 corrupción apenas debe cambiar nada.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| RVQ | Residual quantization | Cascade of small codebooks; each quantizes the previous residual. |
| Frame rate | Codec speed | How many token-frames per second. Lower = faster LM. |
| Semantic codebook | Codebook 0 (Mimi) | Codebook distilled from SSL features; encodes content. |
| Acoustic codebooks | Everything else | Timbre, prosody, noise, fine detail. |
| PESQ / ViSQOL | Perceptual quality | Objective metrics correlating with MOS. |
| EnCodec | Meta codec | The RVQ baseline; used by MusicGen. |
| Mimi | Kyutai codec | 12.5 Hz frame rate; semantic-acoustic split; powers Moshi. |

## Leer más

- [Défossez et al. (2023). EnCodec](https://arxiv.org/abs/2210.13438) el nivel de referencia de RVQ.
- [Kumar et al. (2023). Descript Audio Codec (DAC)](https://arxiv.org/abs/2306.06546) La máxima fidelidad abierta.
- [Siuzdak (2024). SNAC](https://arxiv.org/abs/2410.14411) RVQ a escala múltiple.
- [Kyutai (2024). Mimi codec](https://kyutai.org/codec-explainer) división semántica-acústica, destilación de WavLM.
- [Borsos et al. (2023). AudioLM](https://arxiv.org/abs/2209.03143) el paradigma semántico/acústico de dos etapas.
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) el código RVQ original en streaming.
