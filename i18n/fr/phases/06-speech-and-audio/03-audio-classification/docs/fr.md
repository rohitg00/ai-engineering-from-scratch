# Classification audio  De k-NN sur les MFCC à AST et BEAT

> Tout, de " chien aboyer contre la sirène " à " quel langage est ce " est la classification audio. Les caractéristiques sont des mels. L'architecture se déplace chaque décennie. L'évaluation reste AUC, F1, et par classe rappel.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 3 · 06 (CNNs), Phase 5 · 08 (CNNs & RNNs for Text)
**Time:** ~75 minutes

## Le problème

Vous obtenez un clip de 10 secondes. Vous voulez savoir: "Qu'est-ce que c'est?" Son urbain (sirène, exercice, chien), commandement de la parole (oui/non/arrêt), ID de langue (en/es/ar), émotion des haut-parleurs (énervé/neutral), ou son environnemental (intérieur/extérieur, babble).

Le problème principal n'est pas le réseau. Ce sont les données. Les ensembles de données audio ont un déséquilibre de classe brutal, un fort changement de domaine (nettous contre bruyant) et le bruit d'étiquette (qui a décidé " babble urbain " contre " bruit de restaurant ").

## Le concept

![Audio classification ladder: k-NN on MFCCs to AST to BEATs](../assets/audio-classification.svg)

**k-NN on MFCCs (the 1990s baseline).**MFCC plates par clip, calculer la similitude cosine à une banque étiquetée, retourner le vote majoritaire du K supérieur. Surprenantement fort sur les petits ensembles de données propres (Speech Commands, ESC-50).

**2D CNN on log-mels (2015-2019).**Traiter le `(T, n_mels)`La moyenne globale de l'axe de temps. Softmax sur les classes. Toujours la ligne de base dans la plupart des concours de 2026 kaggle.

**Audio Spectrogram Transformer, AST (2021-2024).**Partagez le log-mail (par exemple, 16×16 patches), ajoutez des emblèmes de position, fournissez un ViT.

**BEATs and WavLM-base (2024-2026).**Préentraînement autonome sur des millions d'heures. Téléchargez votre tâche avec 1 à 10% des données supervisées dont vous auriez besoin. En 2026, ce sera le point de départ par défaut pour l'audio non-speech. BEATs-iter3 bat AST de 1-2 mAP sur AudioSet en utilisant 1/4 du calcul.

**Whisper-encoder as a frozen backbone (2024).**Prenez l'encodeur de Whisper, laissez tomber le décodeur, attachez un classifiateur linéaire.

### Le déséquilibre des classes est le véritable défi

ESC-50: 50 classes, 40 clips chacun  équilibré, facile. UrbanSound8K: 10 classes, déséquilibré 10:1. AudioSet: 632 classes avec une longue queue de 100,000:1.

- Prise d'échantillons équilibrée pendant la formation (pas lors de l'évaluation).
- Mélange: interpolez linéairement deux clips (et leurs étiquettes) en augmentation.
- SpecAugment: masquer le temps aléatoire et les bandes de fréquences.

### Évaluation

- Exclusif en plusieurs classes (commandes de parole): précision de haut à haut, précision de haut à haut à haut à haut.
- Multiclass multi-label (AudioSet, UrbanSound-style): précision moyenne moyenne (mAP).
- En effet, les données de référence sont généralement définies comme étant les données de référence.

2026 numéros que vous devriez savoir:

| Benchmark | Baseline | SOTA 2026 | Source |
|-----------|----------|-----------|--------|
| ESC-50 | 82% (AST) | 97.0% (BEATs-iter3) | BEATs paper (2024) |
| AudioSet mAP | 0.485 (AST) | 0.548 (BEATs-iter3) | HEAR leaderboard 2026 |
| Speech Commands v2 | 98% (CNN) | 99.0% (Audio-MAE) | HEAR v2 results |

```figure
mfcc-pipeline
```

## Faites-le

### Étape 1: Featurisez

```python
def featurize_mfcc(signal, sr, n_mfcc=13, n_mels=40, frame_len=400, hop=160):
    mag = stft_magnitude(signal, frame_len, hop)
    fb = mel_filterbank(n_mels, frame_len, sr)
    mels = apply_filterbank(mag, fb)
    log = log_transform(mels)
    return [dct_ii(frame, n_mfcc) for frame in log]
```

### Étape 2: résumé de longueur fixe

```python
def summarize(mfcc_frames):
    n = len(mfcc_frames[0])
    mean = [sum(f[i] for f in mfcc_frames) / len(mfcc_frames) for i in range(n)]
    var = [
        sum((f[i] - mean[i]) ** 2 for f in mfcc_frames) / len(mfcc_frames) for i in range(n)
    ]
    return mean + var
```

Simple mais fort: moyenne + variance à travers le temps donne une intégration fixe de 26 dimensions pour un MFCC à 13 côtes.

### Étape 3: k-NN

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

### Étape 4: mise à niveau vers CNN sur les log-mels

Dans PyTorch:

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

Paramètres 3M. Trains en 10 minutes sur ESC-50 avec une seule RTX 4090.

### Étape 5: régler un transformateur audio prétrainé (AAST montré)

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

L'exemple de réglage fin AST du Hub. BEATs, la version par défaut de 2026, n'est pas sur le Hub Hugging Face: téléchargez un point de contrôle du [BEATs release in microsoft/unilm](https://github.com/microsoft/unilm/tree/master/beats)et le charger avec ce repo.`BEATs`et `BEATsConfig`les classes; la boucle de réglage fin conserve la même forme.

## Utilisez-le

La pile de 2026:

| Situation | Start with |
|-----------|-----------|
| Tiny dataset (<1000 clips) | k-NN on MFCC means (your baseline) + audio augmentation |
| Medium dataset (1K–100K) | BEATs or AST fine-tune |
| Large dataset (>100K) | Train from scratch or fine-tune Whisper-encoder |
| Real-time, edge | 40-MFCC CNN, quantized to int8 (KWS-style) |
| Multi-label (AudioSet) | BEATs-iter3 with BCE loss + mixup + SpecAugment |
| Language ID | MMS-LID, SpeechBrain VoxLingua107 baseline |

Règle de décision: **start with a frozen backbone, not a fresh model**Une tête de BEATs à réglage fin vous donne 95% de SOTA en quelques heures, pas en quelques semaines.

## La faire partir

- Je ne sais pas .`outputs/skill-classifier-designer.md`. Choisir l'architecture, les augmentations, la stratégie d'équilibre des classes et évaluer les mesures pour une tâche de classification audio donnée.

## Exercices

1. **Easy.**On court .`code/main.py`Il forme la base de base de la K-NN MFCC sur un ensemble de données synthétiques de 4 classes (tons purs à différents tons).
2. **Medium.**Remplacez`summarize`Le regroupement de 4 moments bat-il le moyen + le ver sur le même ensemble de données synthétiques ?
3. **Hard.**En utilisant `torchaudio`En plus de la précision de validation croisée, il est nécessaire d'ajouter un accroissement de la spécification (masque temporelle = 20, masque fréquence = 10) et de signaler le delta.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| AudioSet | The ImageNet of audio | Google's 2M-clip, 632-class weakly-labeled YouTube dataset. |
| ESC-50 | Small classification benchmark | 50 classes × 40 clips of environmental sounds. |
| AST | Audio Spectrogram Transformer | ViT on log-mel patches; 2021 SOTA. |
| BEATs | Self-supervised audio | Microsoft model, iter3 leads AudioSet as of 2026. |
| Mixup | Pair augmentation | `x = λ·x1 + (1-λ)·x2; y = λ·y1 + (1-λ)·y2`. |
| SpecAugment | Mask-based augmentation | Zero-out random time and frequency bands of the spectrogram. |
| mAP | Main multi-label metric | Mean average precision across classes and thresholds. |

## Pour en savoir plus

- [Gong, Chung, Glass (2021). AST: Audio Spectrogram Transformer](https://arxiv.org/abs/2104.01778) l'architecture de l'enregistrement à partir de 20212024.
- [Chen et al. (2022, rev. 2024). BEATs: Audio Pre-Training with Acoustic Tokenizers](https://arxiv.org/abs/2212.09058) le défaut de 2024+.
- [Park et al. (2019). SpecAugment](https://arxiv.org/abs/1904.08779) l'augmentation de l'audio dominante.
- [Piczak (2015). ESC-50 dataset](https://github.com/karolpiczak/ESC-50) 50 classes de référence qui vit sur.
- [Gemmeke et al. (2017). AudioSet](https://research.google.com/audioset/) Taxonomie YouTube de classe 632; toujours la norme en or.
