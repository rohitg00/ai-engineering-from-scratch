# Fondements audio  Formations d'ondes, échantillonnage, transformation de Fourier

> Les formes d'onde sont le signal brut. Les spectrogrammes sont la représentation. Les caractéristiques Mel sont la forme ML-friendly. Chaque pipeline moderne ASR et TTS marche cette échelle, et le premier pas est la compréhension de l'échantillonnage et Fourier.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 · 06 (Vectors & Matrices), Phase 1 · 14 (Probability Distributions)
**Time:** ~45 minutes

## Le problème

Un microphone produit un signal de pression contre temps. Votre réseau neural consomme des tensors. Entre eux se trouve une pile de conventions qui, lorsqu'elles sont violées, produisent des bugs silencieux: le modèle fonctionne bien mais le WER double, ou TTS envoie un sifflement, ou un système de clonage vocale mémorise le microphone au lieu de l'enceinte.

Chaque bug dans les systèmes de parole remonte à une des trois questions:

1. À quel taux de l'échantillon les données ont-elles été enregistrées, et à quoi le modèle s'attend-il?
2. Le signal est alias ?
3. Vous opérez sur des échantillons bruts ou sur une représentation de fréquence ?

Si vous faites ça correctement, le reste de la phase 6 est traitable, mais même Whisper-Large-v4 produit des ordures.

## Le concept

![Waveform, sampling, DFT, and frequency bins visualized](../assets/audio-fundamentals.svg)

**Waveform.**Un ensemble unidimensionnel de flottes dans `[-1.0, 1.0]`Pour convertir en secondes, partager par le taux d'échantillonnage:`t = n / sr`Une vidéo de 10 secondes à 16 kHz est un array de 160 000 floats.

**Sampling rate (sr).**Combien d'échantillons par seconde.

| Rate | Use |
|------|-----|
| 8 kHz | Telephony, legacy VOIP. Nyquist at 4 kHz kills consonants. Avoid for ASR. |
| 16 kHz | ASR standard. Whisper, Parakeet, SeamlessM4T v2 all consume 16 kHz. |
| 22.05 kHz | TTS vocoder training for older models. |
| 24 kHz | Modern TTS (Kokoro, F5-TTS, xTTS v2). |
| 44.1 kHz | CD audio, music. |
| 48 kHz | Film, pro audio, high-fidelity TTS (VALL-E 2, NaturalSpeech 3). |

**Nyquist-Shannon.**Un taux d'échantillonnage de `sr`peut représenter sans ambiguïté des fréquences allant jusqu' à `sr/2`- Le .`sr/2`La limite est la fréquence Nyquist. L'énergie au-dessus de Nyquist est *aliasée*  pliée vers le bas dans les fréquences plus basses  et corrompt le signal.

**Bit depth.**Le PCM à 16 bits (signé int16, plage ±32.767) est le format d'échange universel.`soundfile`lire int16 mais exposer les matrices float32 dans `[-1, 1]`- Je suis désolé .

**Fourier Transform.**Tout signal fini est une somme de sinus à différentes fréquences.`N`échantillons `N`coefficients complexes  un par bac à fréquences. `bin k`cartes à fréquence `k · sr / N`La magnitude est l'amplitude à cette fréquence, l'angle est la phase.

**FFT.**Transformation rapide de Fourier: une `O(N log N)`algorithme pour le DFT lorsque `N`Une FFT de 1024 échantillons à 16 kHz donne 512 poubelles de fréquences utilisables couvrant 08 kHz à une résolution de 15,6 Hz.

**Framing + window.**Nous ne faisons pas FFT d'un clip entier. Nous le couperons en *frame* qui se chevauchent (généralement 25 ms avec 10 ms hop), multiplier chaque cadre par une fonction de fenêtre (Hann, Hamming) pour supprimer les discontinuités de bord, puis FFT chaque cadre.

```figure
mel-scale
```

## Faites-le

### Étape 1: lire un clip et tracer la forme d'onde

`code/main.py`utilise uniquement le stdlib `wave`Le module de démo pour garder la démo libre de dépendance.`soundfile`ou `torchaudio.load`(les deux retournent `(waveform, sr)`- les deux couches:

```python
import soundfile as sf
waveform, sr = sf.read("clip.wav", dtype="float32")  # shape (T,), sr=int
```

### Étape 2: synthétiser une onde sine à partir des premiers principes

```python
import math

def sine(freq_hz, sr, seconds, amp=0.5):
    n = int(sr * seconds)
    return [amp * math.sin(2 * math.pi * freq_hz * i / sr) for i in range(n)]
```

Un sinus de 440 Hz (concert A) à 16 kHz pendant 1 seconde est de 16 000 flottes.`wave.open(..., "wb")`en utilisant le codage PCM à 16 bits.

### Étape 3: calculer le DFT à la main

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

`O(N²)` bien pour `N=256`Pour confirmer la précision, inutile pour l'audio réel.`numpy.fft.rfft`ou `torch.fft.rfft`- Je suis désolé .

### Étape 4: trouver la fréquence dominante

Indice de pointe de la magnitude `k_star`cartes à fréquence `k_star * sr / N`En exécutant ce sur le sinus de 440 Hz , il devrait retourner un pic à bin .`440 * N / sr`- Je suis désolé .

### Étape 5: démontrer l'aliasing

Prenez un signe de 7 kHz à 10 kHz (Nyquist = 5 kHz).`10 − 7 = 3 kHz`Le pic FFT apparaît à 3 kHz. C'est la démo d'alias classique et la raison pour laquelle chaque DAC/ADC envoie un filtre à basse fréquence.

## Utilisez-le

La pile que vous expédierez en 2026:

| Task | Library | Why |
|------|---------|-----|
| Read/write WAV/FLAC/OGG | `soundfile` (libsndfile wrapper) | Fastest, stable, returns float32. |
| Resample | `torchaudio.transforms.Resample` or `librosa.resample` | Correct anti-aliasing built in. |
| STFT / Mel | `torchaudio` or `librosa` | GPU-friendly; PyTorch ecosystem. |
| Real-time streaming | `sounddevice` or `pyaudio` | Cross-platform PortAudio bindings. |
| Inspect a file | `ffprobe` or `soxi` | CLI, fast, reports sr/channels/codec. |

Règle de décision: **match sample rate before you match anything else**S'il vous plaît, passez-le à 44,1 kHz et vous obtiendrez des ordures qui ressemblent à un bug de modèle.

## La faire partir

- Je ne sais pas .`outputs/skill-audio-loader.md`La compétence vous aide à vérifier que l'entrée audio correspond aux attentes du modèle en aval et à reproduire correctement quand elle ne le fait pas.

## Exercices

1. **Easy.**Synthétisez un mélange de 1 seconde de 220 Hz + 440 Hz + 880 Hz à 16 kHz. Exécutez DFT. Confirmez trois pics aux poubelles attendues.
2. **Medium.**Enregistrez un WAV de 3 secondes de votre voix à 48 kHz.`torchaudio.transforms.Resample`(avec anti-aliasing), puis à 16 kHz en utilisant une décimation naïve (tous les trois échantillons).
3. **Hard.**Construire le STFT à partir de zéro en utilisant seulement `math`et le DFT de l'étape 3. Taille de cadre 400, hop 160, fenêtre Hann.`matplotlib.pyplot.imshow`C'est le spectrogramme de la leçon 02.

## Les termes clés

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

## Pour en savoir plus

- [Shannon (1949). Communication in the Presence of Noise](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf) le document derrière le théorème de l'échantillonnage.
- [Smith — The Scientist and Engineer's Guide to Digital Signal Processing](https://www.dspguide.com/ch8.htm) livre de cours canonique gratuit sur les SPD.
- [librosa docs — audio primer](https://librosa.org/doc/latest/auto_tutorials/index.html) un parcours pratique avec le code.
- [Heinrich Kuttruff — Room Acoustics (6th ed.)](https://www.taylorfrancis.com/books/mono/10.1201/9781315372150/room-acoustics-heinrich-kuttruff) référence pour expliquer pourquoi l'audio du monde réel n'est pas un sinus propre.
- [Steve Eddins — FFT Interpretation notebook](https://blogs.mathworks.com/steve/2020/03/30/fft-spectrum-and-spectral-densities/)L'intuition du bac à fréquences a été nettoyée en 10 minutes.
