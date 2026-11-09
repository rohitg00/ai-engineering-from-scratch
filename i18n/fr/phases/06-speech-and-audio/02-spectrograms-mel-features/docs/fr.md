# Spectrogrammes, échelle de mélange et caractéristiques audio

> Les réseaux neuraux ne consomment pas bien les formes d'onde brutes. Ils consomment des spectrogrammes. Ils consomment encore mieux les spectrogrammes mel. Chaque classifiateur ASR, TTS et audio en 2026 vit ou meurt par ce seul choix de préprocessage.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 01 (Audio Fundamentals)
**Time:** ~45 minutes

## Le problème

Prenez une vidéo de 10 secondes à 16 kHz, c'est 160 000 floats, tout en`[-1, 1]`La forme d'onde brute contient les informations mais dans une forme que le modèle ne peut pas extraire facilement.

Un spectrogramme corrige cela. Il effondre le détail temporel où la perception humaine l'ignore (tremblement de microseconde) et préserve la structure où la perception assiste (qui sont des fréquences énergétiques, sur des fenêtres temporelles de ~ 1025 ms).

Les spectrogrammes de mélomène poussent plus loin. Les humains perçoivent le pitch logarithmiquement: 100 Hz vs 200 Hz sonne "la même distance entre eux" que 1000 Hz vs 2000 Hz. L'échelle de mélomène déforme l'axe de fréquence pour correspondre. Un spectrogramme à l'échelle de mélomène est la caractéristique la plus importante du langage ML de 2010 à 2026.

## Le concept

![Waveform to STFT to mel spectrogram to MFCC ladder](../assets/mel-features.svg)

**STFT (Short-Time Fourier Transform).**Coupez la forme d'onde en cadres superposés (typiquement: fenêtre de 25 ms, 10 ms hop = 400 échantillons / 160 échantillons à 16 kHz). Multipliez chaque cadre par une fonction de fenêtre (Hann est la fonction par défaut; Hamming un compromis légèrement différent). FFT chaque cadre. Ampiler les spectres de magnitude en une matrice de forme `(n_frames, n_freq_bins)`C'est votre spectrogramme.

**Log-magnitude.**Les magnitudes brutes sont de 5 à 6 ordres.`log(|X| + 1e-6)`ou `20 * log10(|X|)`Chaque pipeline de production utilise une grandeur de log, pas une grandeur brute.

**Mel scale.**La fréquence`f`en Hz pour les cartes à mel `m`par $m = 2595 \cdot \log_{10}(1 + f / 700)$. Le mappage est à peu près linéaire en dessous de 1 kHz et à peu près logarithmique au-dessus.

**Mel filterbank.**Un ensemble de filtres triangulaires espacés de manière égale sur l'échelle mel. Chaque filtre est une somme pondérée des poubelles FFT adjacentes. Multiplication de la magnitude STFT par la matrice de la banque de filtres donne le spectrogramme mel en un matmul.

**Log-mel spectrogram.** `log(mel_spec + 1e-10)`- L'entrée de Whisper, l'entrée de Parakeet, l'entrée de Seamless M4T, le front-end audio universel 2026.

**MFCCs.**Prenez le spectrogramme log-mel, appliquez un DCT (type II), gardez les 13 premiers coefficients. Décorrelate les caractéristiques et comprime plus loin. Fonction dominante jusqu'en 2015 environ, lorsque les CNNs / Transformers sur les log-mels bruts ont été capturés.

**Resolution trade.**Plus grand FFT = meilleure résolution de fréquence mais pire résolution de temps. 25 ms / 10 ms est la résolution audio-ML par défaut; 50 ms / 12,5 ms pour la musique; 5 ms / 2 ms pour la détection transitoire (batte de tambour, plosives).

```figure
spectrogram-window
```

## Faites-le

### Étape 1: encadrer la forme d'onde

```python
def frame(signal, frame_len, hop):
    n = 1 + (len(signal) - frame_len) // hop
    return [signal[i * hop : i * hop + frame_len] for i in range(n)]
```

Un clip de 10 secondes à 16 kHz avec `frame_len=400, hop=160`Il donne 998 cadres.

### Étape 2: fenêtre Hann

```python
import math

def hann(N):
    return [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]
```

Multipliez par élément avant la FFT. Élimine la fuite spectrale causée par le troncage à des points d'extrémité non zéro.

### Étape 3: Ampleur de la FST

```python
def stft_magnitude(signal, frame_len=400, hop=160):
    win = hann(frame_len)
    frames = frame(signal, frame_len, hop)
    return [magnitudes(dft([w * s for w, s in zip(win, f)])) for f in frames]
```

Utilisation dans la production `torch.stft`ou `librosa.stft`La boucle est pédagogique, elle se déroule sur de courts clips en`code/main.py`- Je suis désolé .

### Étape 4: filtrage de la méle

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

80 mels couvrant 08 kHz avec `n_fft=400`donne une`(80, 201)`La matrice.`(n_frames, 201)`L' magnitude de la TFT par la transposition pour obtenir `(n_frames, 80)`Le spectrogramme de MEL.

### Étape 5: log-mail

```python
def log_mel(mel_spec, eps=1e-10):
    return [[math.log(max(v, eps)) for v in frame] for frame in mel_spec]
```

Les alternatives communes: `librosa.power_to_db`(db normalité de référence),`10 * log10(power + eps)`. Whisper utilise un clip plus impliqué + normaliser la routine (voir Whisper's `log_mel_spectrogram`)

### Étape 6: CFCM

```python
def dct_ii(x, n_coeffs):
    N = len(x)
    return [
        sum(x[n] * math.cos(math.pi * k * (2 * n + 1) / (2 * N)) for n in range(N))
        for k in range(n_coeffs)
    ]
```

Appliquez DCT à chaque cadre log-mel, gardez les 13 premiers coefficients. C'est votre matrice MFCC. Le premier coefficient est généralement déroulé (il encode l'énergie globale).

## Utilisez-le

La pile de 2026:

| Task | Features |
|------|----------|
| ASR (Whisper, Parakeet, SeamlessM4T) | 80 log-mels, 10 ms hop, 25 ms window |
| TTS acoustic model (VITS, F5-TTS, Kokoro) | 80 mels, 5–12 ms hop for fine temporal control |
| Audio classification (AST, PANNs, BEATs) | 128 log-mels, 10 ms hop |
| Speaker embedding (ECAPA-TDNN, WavLM) | 80 log-mels or raw-waveform SSL |
| Music (MusicGen, Stable Audio 2) | EnCodec discrete tokens (not mels) |
| Keyword spotting | 40 MFCCs for tiny devices |

Règle générale: **if you are not working on music, start with 80 log-mels.**Le fardeau de la preuve est de toute déviation.

## Des pièges qui vont encore arriver en 2026

- **Mel count mismatch.**Formation à 80 mels, inférence à 128 mels, défaillance silencieuse, enregistrement de la forme des caractéristiques aux deux extrémités.
- **Sample-rate mismatch upstream.**Les Mels calculés à 22,05 kHz sont différents de 16 kHz.
- **dB vs log.**Whisper s'attend à ce que le code log-mel, pas le dB-mel, soit détecté par lui-même.
- **Normalization drift.**Normalité par éternuement pendant l'entraînement, normalité globale pendant l'inférence.
- **Leakage from padding.**Le rembourrage à zéro de l'extrémité d'un clip produit un spectre plat dans les cadres arrière.

## La faire partir

- Je ne sais pas .`outputs/skill-feature-extractor.md`. La compétence choisit le type de fonctionnalité, le nombre de mélanges, le cadre/hop et la normalisation pour un modèle donné.

## Exercices

1. **Easy.**On court .`code/main.py`Il synthétise un chirp (frequence balayée 200 → 4000 Hz) et imprime le bin argmax mel par cadre.
2. **Medium.**Retournez avec `n_mels`dans `{40, 80, 128}`et `frame_len`dans `{200, 400, 800}`- Mesurer la bande passante à hauteur de pointe à travers l'axe temporel.
3. **Hard.**Mise en œuvre `power_to_db`et comparer la précision ASR d'un minuscule classifiateur CNN sur AudioMNIST en utilisant (a) le log-mel brut, (b) le dB-mel avec `ref=max`C) MFCC-13 + delta + delta-delta.

## Les termes clés

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

## Pour en savoir plus

- [Davis, Mermelstein (1980). Comparison of parametric representations for monosyllabic word recognition](https://ieeexplore.ieee.org/document/1163420) le document de la CFPM.
- [Stevens, Volkmann, Newman (1937). A Scale for the Measurement of the Psychological Magnitude Pitch](https://pubs.aip.org/asa/jasa/article-abstract/8/3/185/735757/) l'échelle de la méle originale.
- [OpenAI — Whisper source, log_mel_spectrogram](https://github.com/openai/whisper/blob/main/whisper/audio.py) lire la mise en œuvre de référence.
- [librosa feature extraction docs](https://librosa.org/doc/latest/api/feature.html) référence à `mfcc`- Je suis là .`melspectrogram`, et le saut / fenêtre.
- [NVIDIA NeMo — audio preprocessing](https://docs.nvidia.com/deeplearning/nemo/user-guide/docs/en/main/asr/asr_all.html#featurizers) pipeline à l'échelle de la production pour les modèles Parakeet + Canary.
