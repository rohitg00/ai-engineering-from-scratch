# Reconocimiento del habla (RAS)  CTC, RNN-T, atención

> El reconocimiento del habla es una clasificación de audio en cada paso del tiempo, pegada entre sí por un modelo de secuencia que conoce el inglés y el silencio. CTC, RNN-T y atención son las tres formas de hacerlo. Elige una y entienda por qué.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 08 (CNNs & RNNs for Text), Phase 5 · 10 (Attention)
**Time:** ~45 minutes

## El problema

El problema es estructural: los marcos de audio no se alinean uno a uno con los caracteres. La palabra "okay" puede tardar 200 ms o 1200 ms. El silencio puntua la pronunciación. Algunos fonemas son más largos que otros. El número de tokens de salida no se conoce de antemano.

Tres formulaciones resuelven esto:

1. **CTC (Connectionist Temporal Classification).**Emite probabilidades de tokens por marco incluyendo un *blanco especial*. Repeticiones de colapso y espacios en tiempo de decodificación. No autoregresivos, rápido. Usado por wav2vec 2.0, MMS.
2. **RNN-T (Recurrent Neural Network Transducer).**La red conjunta predice el próximo token dado marco de codificación y los tokens anteriores.
3. **Attention encoder-decoder.**El codificador comprime el audio a estados ocultos, el decodificador atende cruzando para generar tokens autoregresivamente.

En 2026, el SOTA WER en LibriSpeech es de 1,4% (Parakeet-TDT-1.1B, NVIDIA) y 1,58% (Whisper-Large-v3-turbo). Las diferencias son pequeñas; las diferencias de despliegue son enormes.

## El concepto

![Three ASR formulations: CTC, RNN-T, attention-encoder-decoder](../assets/asr-formulations.svg)

**CTC intuition.**Deja que el codificador salga `T`distribuciones a nivel de marco en `V+1`Tokens (V caracteres + blanco). Para una cadena objetivo `y`de longitud `U < T`, cualquier alineación de marco que se derrumbe a`y`Contiene. CTC pérdida suma sobre todas estas alineaciones. Inferencia: por marco argmax, colapso repite, eliminar espacios en blanco.

Ventajas: no autoregresivos, transmitibles, cero mirador. Desventaja: * suposición de independencia condicional *  cada predicción de cuadro es independiente de los demás, por lo que no hay un modelo de lenguaje interno.

**RNN-T intuition.**Añade una red de * predictor* que incorpora el historial de los tokens y una *joiner* que combina el estado de predictor con un marco de codificación en una distribución conjunta de `V+1`(la `+1`Es una dependencia condicional que se ignora en CTC. Se puede transmitir porque cada paso solo se condiciona en marcos y tokens pasados.

Ventajas: transmisión + LM interna. Desventaja: el entrenamiento es más complejo y hambriento de memoria (3D retícula de pérdida); los núcleos de pérdida RNN-T son una categoría de biblioteca completa por sí mismos.

**Attention encoder-decoder.**El codificador (6-32 capas de transformador) sobre los marcos de log-mail. El decodificador (6-32 capas de transformador) atende cruzando a las salidas de codificación para generar tokens autoregresivamente.

Ventajas: la más alta calidad en ASR fuera de línea, fácil de entrenar con herramientas seq2seq estándar. Desventaja: la latencia autoregressiva es proporcional a la longitud de salida; no puede transmitirse sin ingeniería.

### WER: el número uno

**Word Error Rate**¿ Qué es esto ?$(S + D + I) / N$, donde $S$=substituciones, $D$=Delecciones, $I$=inserciones, $N$=conto de palabras de referencia. Mejora la distancia de edición de Levenshtein a nivel de palabras. Más bajo es mejor. Un WER superior al 20% es generalmente inutilizable; por debajo del 5% es la paridad humana para el habla de lectura.

| Model | LibriSpeech test-clean | LibriSpeech test-other | Size |
|-------|------------------------|------------------------|------|
| Parakeet-TDT-1.1B | 1.40% | 2.78% | 1.1B params |
| Whisper-Large-v3-turbo | 1.58% | 3.03% | 809M |
| Canary-1B Flash | 1.48% | 2.87% | 1B |
| Seamless M4T v2 | 1.7% | 3.5% | 2.3B |

Todos estos sistemas son codificadores-decodificadores o basados en RNN-T. Los sistemas de CTC puros (wav2vec 2.0) se encuentran en torno al 1,82,1% en la prueba de limpieza.

```figure
ctc-collapse
```

## Construye el mismo

### Paso 1: codificación codificada por CTC

```python
def ctc_greedy(frame_logits, blank=0, vocab=None):
    # frame_logits: list of per-frame probability vectors
    preds = [max(range(len(p)), key=lambda i: p[i]) for p in frame_logits]
    out = []
    prev = -1
    for p in preds:
        if p != prev and p != blank:
            out.append(p)
        prev = p
    return "".join(vocab[i] for i in out) if vocab else out
```

Dos reglas: derrumbar repetidas consecutivas, dejar en blanco. Ejemplo: `a a _ _ a b b _ c`¿ Qué es esto ?`a a b c`¿ Qué ?

### Paso 2: CTC de búsqueda de haz

```python
def ctc_beam(frame_logits, beam=8, blank=0):
    import math
    beams = [([], 0.0)]  # (tokens, log_prob)
    for p in frame_logits:
        log_p = [math.log(max(pi, 1e-10)) for pi in p]
        candidates = []
        for seq, lp in beams:
            for t, lpt in enumerate(log_p):
                new = seq[:] if t == blank else (seq + [t] if not seq or seq[-1] != t else seq)
                candidates.append((new, lp + lpt))
        candidates.sort(key=lambda x: -x[1])
        beams = candidates[:beam]
    return beams[0][0]
```

La producción utiliza búsqueda de prefijos de haces de árboles con fusión LM; este es el esqueleto conceptual.

### Paso 3: WER

```python
def wer(ref, hyp):
    r, h = ref.split(), hyp.split()
    dp = [[0] * (len(h) + 1) for _ in range(len(r) + 1)]
    for i in range(len(r) + 1):
        dp[i][0] = i
    for j in range(len(h) + 1):
        dp[0][j] = j
    for i in range(1, len(r) + 1):
        for j in range(1, len(h) + 1):
            cost = 0 if r[i - 1] == h[j - 1] else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
    return dp[len(r)][len(h)] / max(1, len(r))
```

### Paso 4: Inferencia contra el susurro

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("clip.wav")
print(result["text"])
```

Un linear para el ASR general más fuerte en 2026.

### Paso 5: transmisión con Parakeet o wav2vec 2.0

```python
from transformers import pipeline
asr = pipeline("automatic-speech-recognition", model="nvidia/parakeet-tdt-1.1b")
for chunk in streaming_audio():
    print(asr(chunk, return_timestamps=True))
```

La transmisión de ASR requiere de la atención del codificador en pedazos y el estado de transferencia; utilice una biblioteca que lo admita (NeMo para Parakeet, `transformers`el oleoducto con `chunk_length_s`¿Qué es lo que se hace?

## Usalo

La pila de 2026:

| Situation | Pick |
|-----------|------|
| English, offline, max quality | Whisper-large-v3-turbo |
| Multilingual, robust | SeamlessM4T v2 |
| Streaming, low latency | Parakeet-TDT-1.1B or Riva |
| Edge, mobile, <500 ms latency | Whisper-Tiny quantized or Moonshine (2024) |
| Long-form | Whisper with VAD-based chunking (WhisperX) |
| Domain-specific (medical, legal) | Fine-tune wav2vec 2.0 + domain LM fusion |

## Las trampas que todavía se envían en 2026

- **No VAD.**El funcionamiento de Whisper en silencio produce alucinaciones ("Gracias por ver!").
- **Character vs word vs subword WER.**Informar el nivel de palabra WER *after* normalización (minus letra, puntuación despojada).
- **Language ID drift.**El LID automático de Whisper desvía los clips ruidosos al japonés o gales; fuerza `language="en"`Cuando lo sepas.
- **Long clips without chunking.**Whisper tiene una ventana de 30 segundos.`chunk_length_s=30, stride=5`por cualquier cosa más larga.

## Envío

Salvo como`outputs/skill-asr-picker.md`Seleccionar el modelo, la estrategia de decodificación, el desglose y la fusión de LM para un objetivo de despliegue determinado.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`- Descifrará codiciosamente una salida CTC hecha a mano y calculará WER con una referencia.
2. **Medium.**Implemente correctamente la búsqueda de haces de árbol de prefijo en el paso 2 (cuenta con la regla de fusión en blanco).
3. **Hard.**Usar`whisper-large-v3-turbo`En el[LibriSpeech test-clean](https://www.openslr.org/12)Comparar con los números publicados.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| CTC | The blank-token loss | Marginal over all frame-to-token alignments; non-AR. |
| RNN-T | The streaming loss | CTC + next-token predictor; handles word-order. |
| Attention enc-dec | Whisper-style | Encoder + cross-attending decoder; best offline quality. |
| WER | The number you report | `(S+D+I)/N` at word level. |
| Blank | The emptiness | Special token in CTC signalling "no emission this frame". |
| LM fusion | External language model | Add weighted LM log-probs during beam search. |
| VAD | The silence gate | Voice activity detector; trims non-speech. |

## Leer más

- [Graves et al. (2006). Connectionist Temporal Classification](https://www.cs.toronto.edu/~graves/icml_2006.pdf) el documento del CTC.
- [Graves (2012). Sequence Transduction with RNNs](https://arxiv.org/abs/1211.3711) el papel RNN-T.
- [Radford et al. / OpenAI (2022). Whisper: Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356) el documento canónico de 2022; extensión v3-turbo en 2024.
- [NVIDIA NeMo — Parakeet-TDT card](https://huggingface.co/nvidia/parakeet-tdt-1.1b) Líder del Directorio de RAS Abiertos para 2026.
- [Hugging Face — Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) referencia en vivo en más de 25 modelos.
