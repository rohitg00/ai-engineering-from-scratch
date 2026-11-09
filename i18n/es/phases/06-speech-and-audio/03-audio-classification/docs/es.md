# Clasificación de audio  De k-NN en MFCC a AST y BEAT

> Todo, desde "dog barking vs sirena" hasta "qué idioma es este" es la clasificación de audio. Las características son mels. La arquitectura se mueve cada década. La evaluación permanece AUC, F1, y recall por clase.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 3 · 06 (CNNs), Phase 5 · 08 (CNNs & RNNs for Text)
**Time:** ~75 minutes

## El problema

Obtienes un clip de 10 segundos. Quiere saber: "¿qué es?" sonido urbano (sirena, simulacro, perro), comando de voz (sí/no/stop), ID de idioma (en/es/ar), emoción del altavoz (enojado/neutral), o sonido ambiental (interior/exterior, babilón). Todos estos son *clasificación de audio*, y en 2026 la arquitectura de base está madura: log-mel → CNN o Transformer → softmax.

El problema principal no es la red. Son los datos. Los conjuntos de datos de audio tienen un desequilibrio de clase brutal, un fuerte cambio de dominio (limpio vs ruidoso) y ruido de etiqueta (quién decidió "barbudo urbano" vs "ruido de restaurante"?).

## El concepto

![Audio classification ladder: k-NN on MFCCs to AST to BEATs](../assets/audio-classification.svg)

**k-NN on MFCCs (the 1990s baseline).**MFCCs planos por clip, computa cosino similaridad a un banco etiquetado, devuelve el voto mayoritario de la parte superior K. Sorprendentemente fuerte en los conjuntos de datos limpios y pequeños (Comando de habla, ESC-50).

**2D CNN on log-mels (2015-2019).**Tratar el`(T, n_mels)`El log-mail como una imagen. Aplicar ResNet-18 o estilo VGG. Medio global de la combinación del eje de tiempo. Softmax sobre las clases. Aún la línea de base en la mayoría de las competiciones de 2026 kaggle.

**Audio Spectrogram Transformer, AST (2021-2024).**Parchear el registro (por ejemplo, parches 16×16), añadir inserciones de posición, alimentar a un ViT. Estado de la técnica en AudioSet (mAP 0.485) para el aprendizaje supervisado.

**BEATs and WavLM-base (2024-2026).**Pre-entrenamiento auto supervisado en millones de horas. Ajuste bien tu tarea con 1-10% de los datos supervisados que habría necesitado. En 2026 este es el punto de partida predeterminado para el audio no hablado. BEATs-iter3 supera a AST en 1-2 mAP en AudioSet mientras utiliza 1/4 de la computación.

**Whisper-encoder as a frozen backbone (2024).**Toma el codificador de Whisper, deja caer el decodificador, adjunta un clasificador lineal. Casi SOTA en ID de idioma y clasificación de eventos simple con aumento de audio cero. La línea de base de "almuerzo gratis".

### El desequilibrio de clases es el verdadero desafío

ESC-50: 50 clases, 40 clips cada  equilibrado, fácil. UrbanSound8K: 10 clases, desequilibrado 10:1. AudioSet: 632 clases con una cola larga de 100,000:1. Técnicas que funcionan:

- Muestreo equilibrado durante la formación (no en la evaluación).
- Mezcla: interpolar linealmente dos clips (y sus etiquetas) como aumento.
- SpecAugment: enmascarar el tiempo aleatorio y las bandas de frecuencia.

### Evaluación

- Exclusivo para múltiples clases (Comando de habla): precisión superior a 1, precisión superior a 5.
- Multi-etiqueta de múltiples clases (AudioSet, UrbanSound-style): precisión media (mAP).
- Desbalanceado en gran medida: recuerdo por clase + macro F1.

2026 números que usted debe saber:

| Benchmark | Baseline | SOTA 2026 | Source |
|-----------|----------|-----------|--------|
| ESC-50 | 82% (AST) | 97.0% (BEATs-iter3) | BEATs paper (2024) |
| AudioSet mAP | 0.485 (AST) | 0.548 (BEATs-iter3) | HEAR leaderboard 2026 |
| Speech Commands v2 | 98% (CNN) | 99.0% (Audio-MAE) | HEAR v2 results |

```figure
mfcc-pipeline
```

## Construye el mismo

### Paso 1: Featurizar

```python
def featurize_mfcc(signal, sr, n_mfcc=13, n_mels=40, frame_len=400, hop=160):
    mag = stft_magnitude(signal, frame_len, hop)
    fb = mel_filterbank(n_mels, frame_len, sr)
    mels = apply_filterbank(mag, fb)
    log = log_transform(mels)
    return [dct_ii(frame, n_mfcc) for frame in log]
```

### Paso 2: resumen de longitud fija

```python
def summarize(mfcc_frames):
    n = len(mfcc_frames[0])
    mean = [sum(f[i] for f in mfcc_frames) / len(mfcc_frames) for i in range(n)]
    var = [
        sum((f[i] - mean[i]) ** 2 for f in mfcc_frames) / len(mfcc_frames) for i in range(n)
    ]
    return mean + var
```

Simple pero fuerte: media + variación a través del tiempo da una incorporación fija de 26 dimensiones para una MFCC de 13 cuerdas. Se ejecuta instantáneamente.

### Paso 3: k-NN

```python
def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1e-12
    nb = math.sqrt(sum(x * x for x in b)) or 1e-12
    return dot / (na * nb)

def knn_classify(q, bank, labels, k=5):
    sims = sorted(range(len(bank)), key=lambda i: -cosine(q, bank[i]))[:k]
    votes = Counter(labels[i] for i in sims)
    return votes.most_common(1)[0][0]
```

### Paso 4: actualización a CNN en log-mels

En PyTorch:

```python
import torch.nn as nn

class AudioCNN(nn.Module):
    def __init__(self, n_mels=80, n_classes=50):
        super().__init__()
        self.body = nn.Sequential(
            nn.Conv2d(1, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(32, 64, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            nn.Conv2d(64, 128, 3, padding=1), nn.ReLU(),
            nn.AdaptiveAvgPool2d(1),
        )
        self.head = nn.Linear(128, n_classes)

    def forward(self, x):  # x: (B, 1, T, n_mels)
        return self.head(self.body(x).flatten(1))
```

Parámetros 3M. Trenes en ~10 min en ESC-50 con una sola RTX 4090. 80% + precisión.

### Paso 5: ajustar a la perfección un transformador de audio pre-entrenado (EST mostrado)

```python
from transformers import ASTFeatureExtractor, ASTForAudioClassification

ext = ASTFeatureExtractor.from_pretrained("MIT/ast-finetuned-audioset-10-10-0.4593")
model = ASTForAudioClassification.from_pretrained(
    "MIT/ast-finetuned-audioset-10-10-0.4593",
    num_labels=50,
    ignore_mismatched_sizes=True,
)

inputs = ext(audio, sampling_rate=16000, return_tensors="pt")
logits = model(**inputs).logits
```

El ejemplo de ajustes finos AST desde el Hub. BEATs, el 2026 predeterminado, no está en el Hub de Cara Encuadrada: descarga un punto de control desde el [BEATs release in microsoft/unilm](https://github.com/microsoft/unilm/tree/master/beats)y cargarlo con ese repo.`BEATs`y `BEATsConfig`las clases; el bucle de ajuste fino mantiene la misma forma.

## Usalo

La pila de 2026:

| Situation | Start with |
|-----------|-----------|
| Tiny dataset (<1000 clips) | k-NN on MFCC means (your baseline) + audio augmentation |
| Medium dataset (1K–100K) | BEATs or AST fine-tune |
| Large dataset (>100K) | Train from scratch or fine-tune Whisper-encoder |
| Real-time, edge | 40-MFCC CNN, quantized to int8 (KWS-style) |
| Multi-label (AudioSet) | BEATs-iter3 with BCE loss + mixup + SpecAugment |
| Language ID | MMS-LID, SpeechBrain VoxLingua107 baseline |

Regla de decisión: **start with a frozen backbone, not a fresh model**La perfección de una cabeza de BEATs te da el 95% de SOTA en horas, no semanas.

## Envío

Salvo como`outputs/skill-classifier-designer.md`. Seleccionar arquitectura, aumentos, estrategia de equilibrio de clases y métricas de evaluación para una tarea de clasificación de audio dada.

## Los ejercicios

1. **Easy.**- ¿ Qué ?`code/main.py`. El sistema de formación de base de la K-NN MFCC en un conjunto de datos sintéticos de 4 clases (tones puros en diferentes tonos).
2. **Medium.**Reemplazar`summarize`¿El agrupamiento de 4 momentos supera el valor medio + variable en el mismo conjunto de datos sintéticos?
3. **Hard.**Usando`torchaudio`, entrenar una CNN 2D en ESC-50 plegado 1. informar 5 veces la precisión de validación cruzada. añadir SpecAugment (máscara de tiempo = 20, máscara de frecuencia = 10) y informar el delta.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| AudioSet | The ImageNet of audio | Google's 2M-clip, 632-class weakly-labeled YouTube dataset. |
| ESC-50 | Small classification benchmark | 50 classes × 40 clips of environmental sounds. |
| AST | Audio Spectrogram Transformer | ViT on log-mel patches; 2021 SOTA. |
| BEATs | Self-supervised audio | Microsoft model, iter3 leads AudioSet as of 2026. |
| Mixup | Pair augmentation | `x = λ·x1 + (1-λ)·x2; y = λ·y1 + (1-λ)·y2`. |
| SpecAugment | Mask-based augmentation | Zero-out random time and frequency bands of the spectrogram. |
| mAP | Main multi-label metric | Mean average precision across classes and thresholds. |

## Leer más

- [Gong, Chung, Glass (2021). AST: Audio Spectrogram Transformer](https://arxiv.org/abs/2104.01778) la arquitectura de registro desde 20212024.
- [Chen et al. (2022, rev. 2024). BEATs: Audio Pre-Training with Acoustic Tokenizers](https://arxiv.org/abs/2212.09058) el impago de 2024+.
- [Park et al. (2019). SpecAugment](https://arxiv.org/abs/1904.08779) el aumento de audio dominante.
- [Piczak (2015). ESC-50 dataset](https://github.com/karolpiczak/ESC-50) 50 clases de referencia que vive.
- [Gemmeke et al. (2017). AudioSet](https://research.google.com/audioset/) Taxonomía de YouTube de clase 632; todavía el estándar de oro.
