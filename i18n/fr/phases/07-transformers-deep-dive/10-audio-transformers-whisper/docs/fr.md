# Transformateurs audio  Architecture de murmure

> L'audio est une image de fréquence au fil du temps.

**Type:** Learn
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 08 (Encoder-Decoder), Phase 7 · 09 (ViT)
**Time:** ~45 minutes

## Le problème

Avant Whisper (OpenAI, Radford et coll. 2022), la reconnaissance automatique de la parole (ASR) de pointe signifiait les extracteurs de fonctionnalités autosuvisés wav2vec 2.0 et HuBERT  plus une tête fine-tunée. Pipelines de données de haute qualité, coûteuses, fragiles de domaine. La reconnaissance de la parole multilingue nécessitait des modèles distincts par famille de langues.

Whisper a fait trois paris:

1. **Train on everything.**680.000 heures d'audio mal étiqueté, extraites d'Internet dans 97 langues, sans corpus académique propre, sans étiquettes phonémiques.
2. **Multi-task single model.**Un décodeur a été formé conjointement à la transcription, à la traduction, à la détection de l'activité vocale, à l'identification de la langue et au timestamping via des jetons de tâche.
3. **Standard encoder-decoder transformer.**Le codeur consomme des spectrogrammes log-mail. Le décodeur produit des jetons de texte autoregressif. Aucun vocodeur, aucun CTC, aucun HMM.

Le résultat: Whisper large-v3 est robuste sur les accents, le bruit et les langages qui ont zéro données étiquetées. C'est la version par défaut de la bouche à oreille pour chaque assistant vocal open source et la plupart des commerciaux en 2026.

## Le concept

![Whisper pipeline: audio → mel → encoder → decoder → text](../assets/whisper.svg)

### Étape 1  Résemplaire + fenêtre

Audio à 16 kHz. Clip/pad à 30 secondes. Compute le spectrogramme log-mail: 80 billets de métro, 10 ms de décalage → ~ 3000 images × 80 fonctionnalités. C'est l'"image d'entrée" que voit Whisper.

### Étape 2  tronc convolutif

Deux couches Conv1D avec le noyau 3 et la phase 2 réduisent les 3000 images à 1 500.

### Étape 3  encodeur

Un encodeur transformateur à 24 couches (pour les grands) sur 1 500 étapes de temps.

### Étape 4  décodeur

Un décodeur transformateur à 24 couches. Il produit autorégressivement des jetons à partir d'un vocabulaire BPE qui est un superensemble de GPT-2 avec quelques jetons spéciaux audio-specifiques.

### Étape 5  jetons de tâche

Le décodeur commence par des jetons de contrôle qui indiquent au modèle ce qu'il doit faire:

```
<|startoftranscript|>  <|en|>  <|transcribe|>  <|0.00|>
```

ou

```
<|startoftranscript|>  <|fr|>  <|translate|>   <|0.00|>
```

Le modèle a été formé sur cette convention. Vous contrôlez la tâche par préfixe. L'équivalent de 2026 de l'instruction-tuning, mais appliqué à la parole.

### Étape 6  sortie

Le nombre de journées de recherche (largeur 5) avec un seuil de log-prob.`<|notimestamps|>`Le token est absent.

### Tailles de murmure

| Model | Params | Layers | d_model | Heads | VRAM (fp16) |
|-------|--------|--------|---------|-------|-------------|
| Tiny | 39M | 4 | 384 | 6 | ~1 GB |
| Base | 74M | 6 | 512 | 8 | ~1 GB |
| Small | 244M | 12 | 768 | 12 | ~2 GB |
| Medium | 769M | 24 | 1024 | 16 | ~5 GB |
| Large | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3 | 1550M | 32 | 1280 | 20 | ~10 GB |
| Large-v3-turbo | 809M | 32 | 1280 | 20 | ~6 GB (4-layer decoder) |

Le décodeur est coupé de 32 couches à 4,8 fois plus rapide avec une régression de <1 point WER.

### Ce que ne fait pas Whisper

- Pas de journalisation, partagez avec une note de piane.
- Aucun streaming en temps réel natif  la fenêtre de 30 secondes est fixe.`faster-whisper`- Je suis là .`WhisperX`) à la transmission par voie de superposition VAD +.
- Aucun contexte de forme longue dépassant 30 s sans fragmentation externe. Cela fonctionne bien dans la pratique car la parole humaine a rarement besoin de contexte à longue portée pour la transcription.

### paysage 2026

| Task | Model | Notes |
|------|-------|-------|
| English ASR | Whisper-turbo, Moonshine | Moonshine is 4× faster on edge |
| Multilingual ASR | Whisper-large-v3 | 97 languages |
| Streaming ASR | faster-whisper + VAD | 150 ms latency targets achievable |
| TTS | Piper, XTTS-v2, Kokoro | Encoder-decoder pattern, but Whisper-shaped |
| Audio + language | AudioLM, SeamlessM4T | Text tokens + audio tokens in one transformer |

```figure
n5-mel-decode
```

## Faites-le

Regardez !`code/main.py`Nous ne formons pas Whisper, nous construisons le pipeline de spectrogrammes log-mail + formatateur de prompt de jetons de tâche. Ce sont les pièces que vous touchez réellement en production.

### Étape 1: synthétiser l'audio

Générer une onde sinusoïdale de 1 seconde à 440 Hz échantillonnée à 16 kHz. 16 000 échantillons.

### Étape 2: spectrogramme log-mel (simplifié)

Le spectrogramme complet de MEL a besoin de FFT. Nous faisons une version simplifiée de l'encadrement + par cadre énergie qui montre le pipeline sans avoir besoin `librosa`- Le numéro de la liste:

```python
def frame_signal(x, frame_size=400, hop=160):
    frames = []
    for start in range(0, len(x) - frame_size + 1, hop):
        frames.append(x[start:start + frame_size])
    return frames
```

La forme de l'énergie par cadre représente les poubelles de la pédagogie.

### Étape 3: plaquette à 30 s

Whisper traite toujours des morceaux de 30 secondes.

### Étape 4: construire les jetons de commande

```python
def whisper_prompt(lang="en", task="transcribe", timestamps=True):
    tokens = ["<|startoftranscript|>", f"<|{lang}|>", f"<|{task}|>"]
    if not timestamps:
        tokens.append("<|notimestamps|>")
    return tokens
```

C'est la surface de contrôle de tâches.

## Utilisez-le

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("meeting.wav", language="en", task="transcribe")
print(result["text"])
print(result["segments"][0]["start"], result["segments"][0]["end"])
```

Plus rapide et compatible avec OpenAI:

```python
from faster_whisper import WhisperModel
model = WhisperModel("large-v3-turbo", compute_type="int8_float16")
segments, info = model.transcribe("meeting.wav", vad_filter=True)
for s in segments:
    print(f"{s.start:.2f} - {s.end:.2f}: {s.text}")
```

**When to pick Whisper in 2026:**

- RAS multilingue avec un modèle.
- Une transcription robuste de son son bruyant et diversifié.
- Réservation / prototype ASR  point de départ le plus rapide.

**When to pick something else:**

- La diffusion à faible latence sur Edge  Moonshine bat Whisper à une qualité correspondante.
- IA en conversation en temps réel nécessitant < 200 ms  ASR de streaming dédié.
- Le son de la musique ne fait pas cela.

## La faire partir

Regardez !`outputs/skill-asr-configurator.md`. La compétence choisit un modèle ASR, des paramètres de décoding et un pipeline de prétraitement pour une nouvelle application de la parole.

## Exercices

1. **Easy.**On court .`code/main.py`Confirmer le nombre de images pour un signal de 1 seconde à 16 kHz avec 10 ms saut est ~ 100 images.
2. **Medium.**Construisez le spectrogramme complet de log-mail en utilisant `numpy.fft`- Vérifiez la correspondance de 80 billets .`librosa.feature.melspectrogram(n_mels=80)`dans l'erreur numérique.
3. **Hard.**Implémenter l'inférence de streaming: une pièce audio dans des fenêtres de 10 secondes avec une superposition de 2 secondes, exécuter Whisper sur chaque pièce, fusionner les transcriptions. Mesurer le taux d'erreur de mot par rapport au single-pass sur un échantillon de podcast de 5 minutes.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Mel spectrogram | "Audio image" | 2D representation: frequency bins on one axis, time frames on the other; log-scaled energy per cell. |
| Log-mel | "What Whisper sees" | Mel spectrogram passed through log; approximates human perception of loudness. |
| Frame | "One time slice" | A 25 ms window of samples; overlapping at 10 ms stride. |
| Task token | "Prompt prefix for speech" | Special tokens like `<\|transcribe\|>` / `<\|translate\|>` in the decoder prompt. |
| Voice activity detection (VAD) | "Find the speech" | Gate that removes silence before ASR; cuts cost massively. |
| CTC | "Connectionist Temporal Classification" | Classic ASR loss for alignment-free training; Whisper does NOT use it. |
| Whisper-turbo | "Small decoder, full encoder" | large-v3 encoder + 4-layer decoder; 8× faster decoding. |
| Faster-whisper | "The production wrapper" | CTranslate2 reimplementation; int8 quantization; 4× faster than OpenAI's reference. |

## Pour en savoir plus

- [Radford et al. (2022). Robust Speech Recognition via Large-Scale Weak Supervision](https://arxiv.org/abs/2212.04356)- Le papier à murmures.
- [OpenAI Whisper repo](https://github.com/openai/whisper) code de référence + poids du modèle.`whisper/model.py`pour voir le codeur + décodeur + codeur de haut en bas en 400 lignes.
- [OpenAI Whisper — `whisper/decoding.py`](https://github.com/openai/whisper/blob/main/whisper/decoding.py) la logique de recherche de faisceau + de jeton de tâche décrite dans les étapes 56 est ici; 500 lignes, entièrement lisibles.
- [Baevski et al. (2020). wav2vec 2.0: A Framework for Self-Supervised Learning of Speech Representations](https://arxiv.org/abs/2006.11477) précurseur; encore fonctionnalités SOTA dans certains paramètres.
- [SYSTRAN/faster-whisper](https://github.com/SYSTRAN/faster-whisper) enveloppe de production, 4 fois plus rapide que la référence.
- [Jia et al. (2024). Moonshine: Speech Recognition for Live Transcription and Voice Commands](https://arxiv.org/abs/2410.15608) 2024 ASR à bord, en forme de chuchotement mais plus petit.
- [HuggingFace blog — "Fine-Tune Whisper For Multilingual ASR with 🤗 Transformers"](https://huggingface.co/blog/fine-tune-whisper) recette de réglage canonique, y compris le préprocesseur de spectrogramme de méle et la manipulation des timestamps de jetons.
- [HuggingFace `modeling_whisper.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/whisper/modeling_whisper.py) mise en œuvre complète (encodeur, décodeur, attention croisée, génération) qui reflète le diagramme d'architecture de la leçon.
