# Textes à voix (TTS)  De Tacotron à F5 et à Kokoro

> L'ASR inverse la parole vers le texte; TTS inverse le texte vers la parole. La pile 2026 est composée de trois parties: texte → jetons, jetons → mel, mel → forme d'onde. Chaque partie a un modèle par défaut qui s'inscrit dans un ordinateur portable.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms & Mel), Phase 5 · 09 (Seq2Seq), Phase 7 · 05 (Full Transformer)
**Time:** ~75 minutes

## Le problème

Vous avez une chaîne: "S'il vous plaît rappelez-moi d'arroser les plantes à 18h". Vous avez besoin d'un clip audio de 3 secondes qui sonne naturel, a une prosodie correcte (pauses, stress), prononce "plants" avec la bonne voyelle, et fonctionne en moins de 300 ms sur un processeur pour un assistant vocal en direct. Vous devez également échanger des voix, gérer des entrées modifiées par code (" rappelez-moi à 18h, daijoubu ? ") et ne pas vous embarrasser sur les noms.

Les conduites TTS modernes ressemblent à ceci:

1. **Text frontend.**Normalizer le texte (dates, numéros, courriels), convertir en phonèmes ou en jetons de sous-parts, prédire les caractéristiques de prosodie.
2. **Acoustic model.**Le texte → spectrogramme mel. Tacotron 2 (2017), FastSpeech 2 (2020), VITS (2021), F5-TTS (2024), Kokoro (2024).
3. **Vocoder.**Mel → forme d'onde. WaveNet (2016), WaveRNN, HiFi-GAN (2020), BigVGAN (2022), vocoders de codec neuronal en 2024+.

En 2026, le vocomodeur acoustique + se divise avec des modèles de diffusion de bout en bout et de correspondance de flux.

## Le concept

![Tacotron, FastSpeech, VITS, F5/Kokoro side-by-side](../assets/tts.svg)

**Tacotron 2 (2017).**Seq2seq: char-embedding → BiLSTM encoder → attention à l'emplacement → décodeur LSTM autorégressif émet des cadres mel. Lent (AR), oscillant sur le texte long.

**FastSpeech 2 (2020).**Non autorégressif. Prédcteur de durée donne le nombre de cadres mel chaque phonème obtient. 1 passe, 10 fois plus rapide que Tacotron. Perde une certaine naturalité (alignement monotonique) mais se déplace partout.

**VITS (2021).**Le système de communication est un système de communication de données qui permet de créer des connexions de connexion entre les deux systèmes.

**F5-TTS (2024).**Transformateur de diffusion sur l'alignement de flux. prosodie naturelle, clonage vocale à tir zéro avec 5 secondes d'audio de référence. haut des classements TTS open source 2026.

**Kokoro (2024).**Petit (82M), fonctionnel par CPU, TTS anglais de première classe pour une utilisation en temps réel.

**OpenAI TTS-1-HD, ElevenLabs v2.5, Google Chirp-3.**ElevenLabs v2.5 émotion tags (" [soupçonné]", "[rires] ") et les voix des personnages dominent la production de livres audio en 2026.

### Évolution du vocoder

| Era | Vocoder | Latency | Quality |
|-----|---------|---------|---------|
| 2016 | WaveNet | offline only | SOTA at release |
| 2018 | WaveRNN | ~realtime | good |
| 2020 | HiFi-GAN | 100× realtime | near-human |
| 2022 | BigVGAN | 50× realtime | generalizes across speakers/langs |
| 2024 | SNAC, DAC (neural codecs) | integrated with AR models | discrete tokens, bit-efficient |

D'ici 2026, la plupart des modèles "TTS" sont de bout en bout du texte à la forme d'onde; le spectrogramme mel est une représentation interne.

### Évaluation

- **MOS (Mean Opinion Score).**1 à 5 écailles, crowd-sourced.
- **CMOS (Comparative MOS).**Préférence A-V-B, intervalles de confiance plus resserrés par annotation.
- **UTMOS, DNSMOS.**Préditeurs neuraux sans référence, utilisés pour les classements.
- **CER (Character Error Rate) via ASR.**Exécutez la sortie TTS par Whisper, calculer le CER contre le texte d'entrée.
- **SECS (Speaker Embedding Cosine Similarity).**Qualité du clonage vocale.

Numéros 2026 sur le nettoyage des essais LibriTTS:

| Model | UTMOS | CER (via Whisper) | Size |
|-------|-------|-------------------|------|
| Ground truth | 4.08 | 1.2% | — |
| F5-TTS | 3.95 | 2.1% | 335M |
| XTTS v2 | 3.81 | 3.5% | 470M |
| VITS | 3.62 | 3.1% | 25M |
| Kokoro v0.19 | 3.87 | 1.8% | 82M |
| Parler-TTS Large | 3.76 | 2.8% | 2.3B |

```figure
sp-tts-stack
```

## Faites-le

### Étape 1: phonémiser l'entrée

```python
from phonemizer import phonemize
ph = phonemize("Hello world", language="en-us", backend="espeak")
# 'həloʊ wɜːld'
```

Les phonèmes sont le pont universel. Évitez de fournir du texte brut à tout ce qui est en dessous de la qualité du niveau VITS.

### Étape 2: exécuter Kokoro (2026 CPU par défaut)

```python
from kokoro import KPipeline
tts = KPipeline(lang_code="a")  # "a" = American English
audio, sr = tts("Please remind me to water the plants at 6 pm.", voice="af_bella")
# audio: float32 tensor, sr=24000
```

Il fonctionne hors ligne, un seul fichier, 82M paramètres.

### Étape 3: exécuter F5-TTS avec clonage vocale

```python
from f5_tts.api import F5TTS
tts = F5TTS()
wav = tts.infer(
    ref_file="my_voice_5s.wav",
    ref_text="The quick brown fox jumps over the lazy dog.",
    gen_text="Please remind me to water the plants.",
)
```

Passez un clip de référence de 5 secondes + sa transcription; F5 clone la prosodie et le timbre.

### Étape 4: Vocoder HiFi-GAN à partir de zéro

Trop grand pour s'intégrer dans un script tutoriel, mais la forme est:

```python
class HiFiGAN(nn.Module):
    def __init__(self, mel_channels=80, upsample_rates=[8, 8, 2, 2]):
        super().__init__()
        # 4 upsample blocks, total 256x to go from mel-rate to audio-rate
        ...
    def forward(self, mel):
        return self.blocks(mel)  # -> waveform
```

Formation: adversitaire (discriminateur sur les fenêtres courtes) + perte de reconstruction du spectrogramme méle + perte de correspondance des caractéristiques.`hifi-gan`repo ou nvidia-neMo.

### Étape 5: l'ensemble du pipeline (pseudocode)

```python
text = "Please remind me at 6 pm."
phones = phonemize(text)
mel = acoustic_model(phones, speaker=alice)      # [T, 80]
wav = vocoder(mel)                                # [T * 256]
soundfile.write("out.wav", wav, 24000)
```

## Utilisez-le

La pile de 2026:

| Situation | Pick |
|-----------|------|
| Real-time English voice assistant | Kokoro (CPU) or XTTS v2 (GPU) |
| Voice cloning from 5 s reference | F5-TTS |
| Commercial character voices | ElevenLabs v2.5 |
| Audiobook narration | ElevenLabs v2.5 or XTTS v2 + fine-tune |
| Low-resource language | Train VITS on 5–20 h target-lang data |
| Expressive / emotion tags | ElevenLabs v2.5 or StyleTTS 2 fine-tune |

Leader de l' open source à partir de 2026: **F5-TTS for quality, Kokoro for efficiency**Ne touchez pas Tacotron à moins d'être historien.

## Les pièges

- **No text normalizer.**"Dr Smith" est "Doctor" ou "Drive"? "2026" est "vingt-vingt-six" ou "deux zéro deux six"?
- **OOV proper nouns.**"Ghumare" → "ghyu-mair"? Envoyez un modèle de graphème à phonème pour des jetons inconnus.
- **Clipping.**Les résultats du vocoder sont rarement clips, mais l'incohérence de l'échelle de la mémoire à l'inférence peut dépasser ±1,0.`np.clip(wav, -1, 1)`- Je suis désolé .
- **Sample-rate mismatch.**Kokoro produit 24 kHz; votre pipeline en aval s'attend à 16 kHz → à nouveau échantillonner ou à obtenir un aliasing.

## La faire partir

- Je ne sais pas .`outputs/skill-tts-designer.md`. Conception d'un pipeline TTS pour une voix, une latence et une langue cible données.

## Exercices

1. **Easy.**On court .`code/main.py`- Construit un dictionnaire phonémique à partir d'un vocabulaire jouet, estime la durée par phonème, et imprime un faux calendrier "mail".
2. **Medium.**Installez Kokoro, synthétisez la même phrase à la voix `af_bella`et `am_adam`- Comparer la durée de l'audio et la qualité subjective.
3. **Hard.**Enregistrez un clip de référence de 5 secondes de vous-même. Utilisez F5-TTS pour le cloner.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Phoneme | Sound unit | Abstract sound class; 39 in English (ARPABet). |
| Duration predictor | How long each phoneme lasts | Non-AR model output; integer frames per phoneme. |
| Vocoder | Mel → waveform | Neural net mapping mel-spec to raw samples. |
| HiFi-GAN | Standard vocoder | GAN-based; dominant 2020–2024. |
| MOS | Subjective quality | 1–5 mean opinion score from human raters. |
| SECS | Voice-clone metric | Cosine similarity between target and output speaker embedding. |
| F5-TTS | 2024 open-source SOTA | Flow-matching diffusion; zero-shot cloning. |
| Kokoro | CPU English leader | 82M-param model, Apache 2.0. |

## Pour en savoir plus

- [Shen et al. (2017). Tacotron 2](https://arxiv.org/abs/1712.05884) la ligne de base de la séquence.
- [Kim, Kong, Son (2021). VITS](https://arxiv.org/abs/2106.06103) basé sur le flux de bout en bout.
- [Chen et al. (2024). F5-TTS](https://arxiv.org/abs/2410.06885) SOTA en source ouverte actuelle.
- [Kong, Kim, Bae (2020). HiFi-GAN](https://arxiv.org/abs/2010.05646)Le vocoder qui se déploie encore en 2026.
- [Kokoro-82M on HuggingFace](https://huggingface.co/hexgrad/Kokoro-82M) 2024 TTS anglais convivial pour les processeurs.
