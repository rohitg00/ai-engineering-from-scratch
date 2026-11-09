# Evaluación de audio  WER, MOS, UTMOS, MMAU, FAD y los cuadros de clasificación abiertos

> No se puede enviar lo que no se puede medir. Esta lección nombra las métricas 2026 para cada tarea de audio: ASR (WER, CER, RTFx), TTS (MOS, UTMOS, SECS, WER-on-ASR-round-trip), audio-lenguaje (MMAU, LongAudioBench), música (FAD, CLAP), y altavoz (EER). Además de los tablones de clasificación donde se compara.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 04, 06, 07, 09, 10; Phase 2 · 09 (Model Evaluation)
**Time:** ~60 minutes

## El problema

Cada tarea de audio tiene múltiples métricas, cada una midiendo un eje diferente. Usando la métrica equivocada es cómo envías un modelo que se ve muy bien en tu tablero de instrumentos y terrible en producción.

| Task | Primary | Secondary |
|------|---------|-----------|
| ASR | WER | CER · RTFx · first-token latency |
| TTS | MOS / UTMOS | SECS · WER-on-ASR-round-trip · CER · TTFA |
| Voice cloning | SECS (ECAPA cosine) | MOS · CER |
| Speaker verification | EER | minDCF · FAR / FRR at operating point |
| Diarization | DER | JER · speaker confusion |
| Audio classification | top-1 · mAP | macro F1 · per-class recall |
| Music generation | FAD | CLAP · listening panel MOS |
| Audio language model | MMAU-Pro | LongAudioBench · AudioCaps FENSE |
| Streaming S2S | latency P50/P95 | WER · MOS |

## El concepto

![Audio evaluation matrix — metrics vs tasks vs 2026 leaderboards](../assets/eval-landscape.svg)

### Metricas de RAS

**WER (Word Error Rate).** `(S + D + I) / N`. letra pequeña, puntuación de la tira, normaliza los números antes de marcar.`jiwer`o de OpenAI `whisper_normalizer`. &lt;5% = lectura del discurso por igualdad humana.

**CER (Character Error Rate).**La misma fórmula, nivel de caracteres. Se utiliza para los lenguajes de tono (mandarín, cantonés) donde la segmentación de palabras es ambigua.

**RTFx (inverse real-time factor).**Se trata de un segundo de audio procesado por segundo de un reloj de pared.

**First-token latency.**Un reloj de pared desde la entrada de audio hasta el primer token de transcripción.

### Metricas de TTS

**MOS (Mean Opinion Score).**1-5 calificación humana. estándar de oro pero lento. Recolectar más de 20 oyentes por muestra, más de 100 muestras por modelo.

**UTMOS (2022-2026).**Aprendió predictor MOS. Correlación de ~ 0,9 con MOS humano en puntos de referencia estándar. F5-TTS: UTMOS 3.95; verdad de fondo: 4.08.

**SECS (Speaker Encoder Cosine Similarity).**Para clonación de voz. ECAPA que incorpora cosino entre la referencia y la salida clonada. &gt; 0,75 = clona reconocible.

**WER-on-ASR-round-trip.**ejecuta Whisper sobre la salida de TTS, computa WER con el texto de entrada. Captura regresiones de inteligencia. 2026 SOTA: &lt; 2% WER en los conjuntos de prueba en inglés (en lugar de los conjuntos mandarinos reportan CER).

**TTFA (time-to-first-audio).**La latencia del reloj de pared. Kokoro-82M: ~ 100 ms; F5-TTS: ~ 1 s.

### Específico para el clonamiento de voz

**SECS + MOS + CER**El clonado que obtiene un alto SECS pero un bajo MOS significa timbre-correcto-pero-innaturalizado; lo contrario significa voz natural pero fallo de altavoz.

### Verificación de altavoces

**EER (Equal Error Rate).**El umbral en el que la tasa de aceptación falsa es igual a la tasa de rechazo falso.

**minDCF (min Detection Cost).**Costo ponderado en un punto de operación elegido (a menudo FAR=0,01).

### Diarización

**DER (Diarization Error Rate).** `(FA + Miss + Confusion) / total_speaker_time`. Habla perdida + falso alarma + confusión de altavoces, cada uno como fracción. Encuentros AMI: DER ~10-20% es realista. nota 3.1 + Precisión-2 comercial: &lt;10% DER en audio bien grabado.

**JER (Jaccard Error Rate).**Alternativa a DER, robusta a la inclinación de segmentos cortos.

### Clasificación de audio

Multi-etiqueta: **mAP (mean Average Precision)**AudioSet: 0.548 mAP para BEATs-iter3.

Exclusivo de varias clases: **top-1, top-5 accuracy**. Comando de habla v2: 99,0% top-1 (Audio-MAE).

Desbalanceado: **macro F1**¿ Qué es eso ?**per-class recall**.Informe por clase  la precisión agregada oculta qué clases fallan.

### Generación de música

**FAD (Fréchet Audio Distance).**Distancia entre las distribuciones de audio real y generado por VGGish. MusicGen-small en MusicCaps: 4.5. MusicLM: 4.0.

**CLAP Score.**Score de alineación de texto y audio utilizando embebedidos CLAP. &gt; 0.3 = alineación razonable.

**Listening panel MOS.**Sin embargo, la última palabra para la música de consumo. Suno v5 obtuvo un ELO 1293 en el propio índice de preferencia de parejas de Suno. Ese es un número de proveedor; TTS Arena clasifica el habla, no la música.

### Indicadores de referencia de lenguaje de audio

**MMAU (Massive Multi-Audio Understanding).**10K pares de audio-QA.

**MMAU-Pro.**1800 artículos duros, cuatro categorías: habla / sonido / música / multi-audio. casualidad 25% en 4 vías. Gemini 2.5 Pro en general ~ 60%; multi-audio ~ 22% en todos los modelos.

**LongAudioBench.**Clip de varios minutos con consultas semánticas.

**AudioCaps / Clotho.**Los indicadores de referencia de la SPICE, CIDER y FENSE.

### Transmisiones de habla a palabra

**Latency P50 / P95 / P99.**Reloj de pared desde el final del usuario de la voz a la primera respuesta audible.

**WER / MOS**en la salida.

**Barge-in responsiveness.**Tiempo desde la interrupción del usuario hasta el silencio del asistente.

### Las tablas de clasificación de 2026

| Leaderboard | Tracks | URL |
|------------|--------|-----|
| Open ASR Leaderboard (HF) | English + multilingual + long-form | `huggingface.co/spaces/hf-audio/open_asr_leaderboard` |
| TTS Arena (HF) | English TTS | `huggingface.co/spaces/TTS-AGI/TTS-Arena` |
| Artificial Analysis Speech | TTS + STT, ELO from paired votes | `artificialanalysis.ai/speech` |
| MMAU-Pro | LALM reasoning | `sonalkum.github.io/mmau-pro` |
| SpeakerBench / VoxSRC | Speaker recognition | `voxsrc.github.io` |
| MMAU music subset | Music LALM | (within MMAU) |
| HEAR benchmark | Self-supervised audio | `hearbenchmark.com` |

```figure
sp-wer-align
```

## Construye el mismo

### Paso 1: WER con normalización

```python
from jiwer import wer, Compose, ToLowerCase, RemovePunctuation, Strip

transform = Compose([ToLowerCase(), RemovePunctuation(), Strip()])
score = wer(
    truth="Please turn on the lights.",
    hypothesis="please turn on the light",
    truth_transform=transform,
    hypothesis_transform=transform,
)
# ~0.17
```

### Paso 2: TTS WER de ida y vuelta

```python
def ttr_wer(tts_model, asr_model, texts):
    errors = []
    for txt in texts:
        audio = tts_model.synthesize(txt)
        recog = asr_model.transcribe(audio)
        errors.append(wer(truth=txt, hypothesis=recog))
    return sum(errors) / len(errors)
```

### Paso 3: SECS para la clonación de voz

```python
from speechbrain.inference.speaker import EncoderClassifier
sv = EncoderClassifier.from_hparams("speechbrain/spkrec-ecapa-voxceleb")

emb_ref = sv.encode_batch(load_wav("reference.wav"))
emb_clone = sv.encode_batch(load_wav("cloned.wav"))
secs = torch.nn.functional.cosine_similarity(emb_ref, emb_clone, dim=-1).item()
```

### Paso 4: FAD para la generación de música

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()
score = fad.get_fad_score("generated_folder/", "reference_folder/")
```

### Paso 5: EER para la verificación de altavoces (el mismo código que la lección 6)

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        frr = sum(1 for s in same_scores if s < t) / len(same_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), (far + frr) / 2)
    return best[1]
```

## Usalo

Enpareja cada implementación con un arnés de evaluación fijo que se ejecuta en cada actualización del modelo.

1. **Normalize before scoring.**La letra baja, la franja de puntuación, el número ampliado, informe la regla de normalización.
2. **Report distributions, not averages.**P50/P95/P99 para latencia. Recall por clase para clasificación. Por categoría para MMAU.
3. **Run one canonical public benchmark.**Incluso si sus datos de producción difieren, el reporte en Open ASR / TTS Arena / MMAU permite a los revisores comparar manzanas con manzanas.

## Las trampas

- **UTMOS extrapolation.**Entrenado en el estilo de voz limpia VCTK; califica ruidosos / clonados / audio emocional mal.
- **MOS panel bias.**20 trabajadores de Amazon Mechanical Turk ≠ 20 usuarios objetivo.
- **FAD depends on reference set.**Comparar con la misma distribución de referencia entre los modelos.
- **Aggregate WER.**Un 5% de RAE en general puede ocultar el 30% de RAE en el habla acentuada.
- **Public benchmark saturation.**La mayoría de los modelos fronterizos están cerca del techo en los puntos de referencia estándar.

## Envío

Salvo como`outputs/skill-audio-evaluator.md`Seleccionar métricas, puntos de referencia y formato de informes para cualquier versión de modelo de audio.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`. Calcular WER / CER / EER / SECS / FAD-ish / MMAU-ish en las entradas de juguete.
2. **Medium.**Construye un arnés WER de ida y vuelta TTS. ejecuta su salida Kokoro o F5-TTS a través de Whisper. Computa WER más de 50 instrucciones. Indicaciones de bandera con WER &gt; 10%.
3. **Hard.**Obtenga un puntaje en la opción de LALM de la Lección 10 en el discurso MMAU-Pro + subconjuntos de audio múltiples (50 elementos cada uno).

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| WER | ASR score | `(S+D+I)/N` at word level after normalization. |
| CER | Character WER | For tone languages or char-level systems. |
| MOS | Human opinion | 1-5 rating; 20+ listeners × 100 samples. |
| UTMOS | ML MOS predictor | Learned model; correlates ~0.9 with human MOS. |
| SECS | Voice-clone similarity | ECAPA cosine between reference and clone. |
| EER | Speaker verif score | Threshold where FAR = FRR. |
| DER | Diarization score | (FA + Miss + Confusion) / total. |
| FAD | Music-gen quality | Fréchet distance on VGGish embeddings. |
| RTFx | Throughput | Audio seconds per wall-clock second. |

## Leer más

- [jiwer](https://github.com/jitsi/jiwer) Biblioteca WER/CER con utilidades de normalización.
- [UTMOS (Saeki et al. 2022)](https://arxiv.org/abs/2204.02152) aprendido predictor de MOS.
- [Fréchet Audio Distance (Kilgour et al. 2019)](https://arxiv.org/abs/1812.08466) el estándar de la generación musical.
- [Open ASR Leaderboard](https://huggingface.co/spaces/hf-audio/open_asr_leaderboard) 2026 rankings en vivo.
- [TTS Arena](https://huggingface.co/spaces/TTS-AGI/TTS-Arena) el ranking de TTS con votos humanos.
- [MMAU-Pro benchmark](https://sonalkum.github.io/mmau-pro/) Lista de resultados del razonamiento LALM.
- [HEAR benchmark](https://hearbenchmark.com/) índices de referencia de SSL de audio.
