# Reconocimiento y verificación de los oradores

> ASR pregunta "¿qué dijeron?" el reconocimiento del orador pregunta "¿quién lo dijo?" La matemática se ve igual  embebidos más cosino  pero cada decisión de producción depende de un solo número EER.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 22 (Embedding Models)
**Time:** ~45 minutes

## El problema

Un usuario dice una frase de contraseña. ¿Quieres saber: es esta la persona que dicen ser (*verificación*, 1:1), o es la primera persona en tu banco de inscripción (*identificación*, 1:N)?

Pre-2018: GMM-UBM + i-vectores. EER razonable pero frágil para el cambio de canal (teléfono vs portátil) y la emoción. 20182022: x-vectores (espina dorsal TDNN entrenada con margen angular). 2022+: ECAPA-TDNN y WavLM-embeddings grandes. Para 2026 el campo está dominado por tres modelos y una métrica.

La métrica es **EER** tasa de error igual. Establezca su umbral de decisión para que False Accept Rate = False Reject Rate. El crossover es EER.

## El concepto

![Enrollment + verification pipeline with embedding + cosine + EER](../assets/speaker-verification.svg)

**The pipeline.**Inscripción: grabar 530 segundos del altavoz objetivo; calcular una incorporación de dimensión fija (192-d para ECAPA-TDNN, 256-d para WavLM-large). Verificación: obtener la incorporación de la expresión de prueba; calcular la similitud cosina; comparar con un umbral.

**ECAPA-TDNN (2020, still dominant 2026).**Enfatizado de la atención de canal, propagación y agregación - red neuronal de retraso en el tiempo. Bloques de convoluciones 1D con excitación de apretón, concentración de atención multi-cabeza, seguido de una capa lineal a 192-d. Entrenado en VoxCeleb 1+2 (2,700 altavoces, 1.1M pronunciamientos) con pérdida de margen angular aditiva (AAM-softmax).

**WavLM-SV (2022+).**Ajuste la columna vertebral de SSL de WavLM con pérdida de AAM.

**x-vector (baseline).**TDNN + estadísticas de agrupación. clásico; todavía útil en CPU / borde.

**AAM-softmax.**Softmax estándar con margen añadido `m`en el espacio angular: `cos(θ + m)`Las fuerzas de separación angular entre clases.`m=0.2`, escala `s=30`¿ Qué ?

### Punto de juego

- **Cosine**La decisión basada en el umbral.
- **PLDA (Probabilistic LDA).**Embedings de proyectos en un espacio latente donde el mismo altavoz vs altavoz diferente tiene una proporción de probabilidad de forma cerrada. Añadido en la parte superior del cosino para una reducción de EER de +1020%. estándar pre-2020; ahora solo se utiliza en configuraciones cerradas.
- **Score normalization.** `S-norm`o `AS-norm`La normalización de cada puntuación en relación con una cohorte de medios imposter y etc. Es esencial para la evaluación de distintos dominios.

### Números que usted debe saber (2026)

| Model | VoxCeleb1-O EER | Params | Throughput (A100) |
|-------|-----------------|--------|-------------------|
| x-vector (classic) | 3.10% | 5 M | 400× RT |
| ECAPA-TDNN | 0.87% | 15 M | 200× RT |
| WavLM-SV large | 0.42% | 316 M | 20× RT |
| Pyannote 3.1 segmentation + embedding | 0.65% | 6 M | 100× RT |
| ReDimNet (2024) | 0.39% | 24 M | 100× RT |

### Diarización

"Quién habló cuando" en un clip de altavoces. Pipeline: VAD → segmento → incrusta cada segmento → grupo (aglomerativo o espectral) → límites suaves.`pyannote.audio`3.1, que agrupa la segmentación de altavoces + incorporación + agrupación detrás de una llamada. 2026 SOTA DER en AMI es de ~ 15% (descenso del 23% en 2022).

```figure
sp-eer-crossover
```

## Construye el mismo

### Paso 1: incorporación de juguetes de las estadísticas de la MFCC

```python
def embed_mfcc_stats(signal, sr):
    frames = featurize_mfcc(signal, sr, n_mfcc=13)
    mean = [sum(f[i] for f in frames) / len(frames) for i in range(13)]
    std = [
        math.sqrt(sum((f[i] - mean[i]) ** 2 for f in frames) / len(frames))
        for i in range(13)
    ]
    return mean + std  # 26-d
```

No SOTA por una milla  sólo para la enseñanza. `code/main.py`utiliza esto como prueba de concepto en los datos de altavoces sintéticos.

### Paso 2: similitud cosina + umbral

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0

def verify(enroll, test, threshold=0.75):
    return cosine(enroll, test) >= threshold
```

### Paso 3: EER de pares de similitudes

```python
def eer(same_scores, diff_scores):
    thresholds = sorted(set(same_scores + diff_scores))
    best = (1.0, 1.0, 0.0)  # (fa, fr, threshold)
    for t in thresholds:
        fr = sum(1 for s in same_scores if s < t) / len(same_scores)
        fa = sum(1 for s in diff_scores if s >= t) / len(diff_scores)
        if abs(fa - fr) < abs(best[0] - best[1]):
            best = (fa, fr, t)
    return (best[0] + best[1]) / 2, best[2]
```

Las devoluciones (eer, threshold_at_eer) reportan ambas.

### Paso 4: producción con SpeechBrain

```python
from speechbrain.pretrained import EncoderClassifier

clf = EncoderClassifier.from_hparams(source="speechbrain/spkrec-ecapa-voxceleb")

# enroll: average the embeddings of 3-5 clean samples
enroll = torch.stack([clf.encode_batch(load(x)) for x in enrollment_clips]).mean(0)
# verify
score = clf.similarity(enroll, clf.encode_batch(load("test.wav"))).item()
verdict = score > 0.25   # ECAPA typical threshold; tune on your data
```

### Paso 5: Diario con nota de piña

```python
from pyannote.audio import Pipeline

pipe = Pipeline.from_pretrained("pyannote/speaker-diarization-3.1")
diarization = pipe("meeting.wav", num_speakers=None)
for turn, _, speaker in diarization.itertracks(yield_label=True):
    print(f"{turn.start:.1f}–{turn.end:.1f}  {speaker}")
```

## Usalo

La pila de 2026:

| Situation | Pick |
|-----------|------|
| Closed-set 1:1 verification, edge | ECAPA-TDNN + cosine threshold |
| Open-set verification, cloud | WavLM-SV + AS-norm |
| Diarization (meetings, podcasts) | `pyannote/speaker-diarization-3.1` |
| Anti-spoofing (replay / deepfake detection) | AASIST or RawNet2 |
| Tiny embedded (KWS + enrollment) | Titanet-Small (NeMo) |

## Las trampas

- **Channel mismatch.**Modelo entrenado en VoxCeleb (vídeo web) ≠ audio de llamada telefónica. Siempre evalúa en el canal objetivo.
- **Short utterances.**El EER se degrada marcadamente por debajo de los 3 segundos de audio de prueba.
- **Enrollment with noise.**Una inscripción ruidosa envenena el anclaje.
- **Fixed threshold across conditions.**Siempre sintonice el umbral en un conjunto de desarrollo prolongado del dominio objetivo.
- **Cosine on non-normalized embeddings.**L2-normalizan primero; de lo contrario la magnitud domina.

## Envío

Salvo como`outputs/skill-speaker-verifier.md`- Selección de modelo, protocolo de inscripción, plan de ajuste de umbral y garantías de fraude.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`. Construye altavoces sintéticos (profiles de tono diferentes), registra y calcula EER en una lista de ensayos de 100 pares.
2. **Medium.**Utilice el ECAPA SpeechBrain en 30 declaraciones VoxCeleb1 (5 altavoces × 6 cada uno).
3. **Hard.**Construir el registro completo → diario → verificar la tubería con `pyannote.audio`Evaluar el DER en el set de desarrollo de AMI.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| EER | The headline metric | Threshold where False Accept = False Reject. |
| Verification | 1:1 | "Is this Alice?" |
| Identification | 1:N | "Who is speaking?" |
| Open-set | Unknown possible | Test set can contain unenrolled speakers. |
| Enrollment | Registering | Computing a speaker's reference embedding. |
| AAM-softmax | The loss | Softmax with additive angular margin; forces cluster separation. |
| PLDA | Classic scoring | Probabilistic LDA; likelihood-ratio scoring on top of embeddings. |
| DER | Diarization metric | Diarization Error Rate — miss + false alarm + confusion. |

## Leer más

- [Snyder et al. (2018). X-Vectors: Robust DNN Embeddings for Speaker Recognition](https://www.danielpovey.com/files/2018_icassp_xvectors.pdf) el clásico papel de inserción profunda.
- [Desplanques et al. (2020). ECAPA-TDNN](https://arxiv.org/abs/2005.07143) arquitectura dominante 20202026.
- [Chen et al. (2022). WavLM: Large-Scale Self-Supervised Pre-Training for Full Stack Speech Processing](https://arxiv.org/abs/2110.13900) Espionaje SSL para SV y diarización.
- [Bredin et al. (2023). pyannote.audio 3.1](https://github.com/pyannote/pyannote-audio) Diarización de la producción + pila de incorporación.
- [VoxCeleb leaderboard (updated 2026)](https://www.robots.ox.ac.uk/~vgg/data/voxceleb/) las clasificaciones actuales de la EER en los modelos.
