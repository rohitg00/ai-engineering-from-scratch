# Génération audio

> L'audio est un signal 1D à 16-48 kHz. Un clip de cinq secondes est de 80 à 240k échantillons. Aucun transformateur ne prend directement en charge cette séquence. La solution pour chaque modèle audio de production en 2026 est la même: un codec neuronal (Encodec, SoundStream, DAC) comprime l'audio à des jetons discrets à 50-75 Hz, et un modèle de transformateur ou de diffusion génère des jetons.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Audio Features), Phase 6 · 04 (ASR), Phase 8 · 06 (DDPM)
**Time:** ~45 minutes

## Le problème

Trois tâches de génération audio:

1. **Text-to-speech.**Le langage propre est à bande étroite et a une structure phonétique forte  bien résolue par des transformateurs-over-tokens.
2. **Music generation.**En raison d'un prompt (texte, mélodie, progression d'accord, genre), produisez de la musique. Distribution beaucoup plus large. MusicGen (Meta), Stable Audio 2.5, Suno v4, Udio, Riffusion.
3. **Audio effects / sound design.**À une demande, produisez un son ambiant ou Foley.

Les trois fonctionnent sur le même substrat: codec audio neuronal + token-AR ou générateur de diffusion.

## Le concept

![Audio generation: codec tokens + transformer or diffusion](../assets/audio-generation.svg)

### Codecs audio neuronaux

Encodec (Meta, 2022), SoundStream (Google, 2021), Descript Audio Codec (DAC, 2023). Un encodeur convoluteur comprime la forme d'onde en un vecteur à chaque étape de temps; la quantification vectorielle résiduelle (RVQ) convertit chaque vecteur en une cascade d'indices de codebook K. Le décodeur le renverse.

```
waveform (16000 samples/sec)
    └─ encoder conv ─┐
                     ├─ RVQ layer 1 → indices at 75 Hz
                     ├─ RVQ layer 2 → indices at 75 Hz
                     ├─ ...
                     └─ RVQ layer 8
```

### Deux paradigmes génératifs en haut

**Token-autoregressive.**Appliquez des jetons RVQ en une séquence, exécutez un transformateur à décodeur uniquement. MusicGen utilise "parallèle retardé" pour émettre des flux de codebook K parallèlement aux compensations par flux.

**Latent diffusion.**Emballez les jetons de codec en latences continues ou modélisez-les avec une diffusion catégorique. Stable Audio 2.5 utilise le flux correspondant sur les latences audio continues. AudioLDM 2 utilise la diffusion texte-à-mail-audio.

La tendance 2024-2026: le flux de correspondance gagne pour la musique (inférence plus rapide, échantillons plus propres) tandis que la technologie token-AR domine toujours la parole parce qu'elle est naturellement causale et diffuse bien.

## Paysage de production

| System | Task | Backbone | Latency |
|--------|------|----------|---------|
| ElevenLabs V3 | TTS | Token-AR + neural vocoder | ~300ms first token |
| OpenAI GPT-4o audio | Full-duplex speech | End-to-end multimodal AR | ~200ms |
| NaturalSpeech 3 | TTS | Latent flow matching | Non-streaming |
| Stable Audio 2.5 | Music / SFX | DiT + flow matching on audio latents | ~10s for 1-minute clip |
| Suno v4 | Full songs | Undisclosed; token-AR suspected | ~30s per song |
| Udio v1.5 | Full songs | Undisclosed | ~30s per song |
| MusicGen 3.3B | Music | Token-AR on Encodec 32kHz | Real-time |
| AudioCraft 2 | Music + SFX | Flow matching | ~5s for 5s clip |
| Riffusion v2 | Music | Spectrogram diffusion | ~10s |

```figure
score-matching
```

## Faites-le

`code/main.py`Simulation de l'idée principale: entraîner un minuscule transformateur de jeton suivant sur des séquences synthétiques de " jeton audio " générées à partir de deux " styles " distincts (alternation de jetons bas et hauts pour le style A, rampe monotone pour le style B). Condition sur le style et l'échantillon.

### Étape 1: jetons audio synthétiques

```python
def make_tokens(style, length, vocab_size, rng):
    if style == 0:  # "speech-like": alternating
        return [i % vocab_size for i in range(length)]
    # "music-like": ramp
    return [(i * 3) % vocab_size for i in range(length)]
```

### Étape 2: entraînez un petit prédicteur de jetons

Un prédicteur de style bigrammais conditionné sur le style. Le point est le motif: codec tokens → entraînement croisé entropie → échantillonnage autorégressif.

### Étape 3: échantillon conditionnel

Compte tenu du jeton de style et d'un jeton de départ, prenez le prochain jeton de la distribution prévue.

## Les pièges

- **Codec quality caps output quality.**Si le codec ne peut pas représenter un son fidèlement, aucune quantité de qualité du générateur n'aide.
- **RVQ error accumulation.**Chaque couche RVQ modélise le résidu de la précédente. Les erreurs sur la couche 1 se propagent.
- **Musical structure.**30 secondes de jetons est 20k+ jetons à 75 Hz. Difficile pour les transformateurs. MusicGen utilise une fenêtre coulissante + continuation rapide; Stable Audio utilise des clips plus courts + croisement.
- **Artifacts at boundaries.**Le croisement entre les clips générés nécessite une superposition soigneuse.
- **Clean-data appetite.**Les générateurs de musique ont besoin de dizaines de milliers d'heures de musique sous licence.
- **Voice cloning ethics.**Un échantillon de 3 secondes plus une requête de texte suffisent pour que VALL-E / XTTS / ElevenLabs clone une voix.

## Utilisez-le

| Task | 2026 stack |
|------|------------|
| Commercial TTS | ElevenLabs, OpenAI TTS, or Azure Neural |
| Voice cloning (consent-verified) | XTTS v2 (open) or ElevenLabs Pro |
| Background music, fast | Stable Audio 2.5 API, Suno, or Udio |
| Music with lyrics | Suno v4 or Udio v1.5 |
| Sound effects / Foley | AudioCraft 2, ElevenLabs SFX, or Stable Audio Open |
| Real-time voice agent | GPT-4o realtime or Gemini Live |
| Open-weights music research | MusicGen 3.3B, Stable Audio Open 1.0, AudioLDM 2 |
| Dubbing / translation | HeyGen, ElevenLabs Dubbing |

## La faire partir

- Ça va .`outputs/skill-audio-brief.md`. Skill prend un bref audio (tâche, durée, style, voix, licence) et les sorties: modèle + hébergement, format prompt (tags de genre, descripteurs de style, marqueurs structurels), codec + générateur + chaîne vocoder, protocole de semence et plan d'évaluation (score MOS / CLAP / CER pour TTS / utilisateur A / B).

## Exercices

1. **Easy.**On court .`code/main.py`et définir explicitement le style. Vérifiez que les séquences générées correspondent au modèle du style.
2. **Medium.**Ajouter le décoding parallèle retardé: simuler 2 flux de jetons qui doivent rester compensés par 1 étape.
3. **Hard.**Utilisez les transformateurs HuggingFace pour exécuter MusicGen-small localement. Générez un clip de 10 secondes avec trois instructions différentes; A/B pour l'adhésion au style.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Codec | "Neural compression" | Encoder / decoder for audio; typical output is 50-75 Hz tokens. |
| RVQ | "Residual VQ" | Cascade of K quantizers; each models the residual of the previous. |
| Token | "One codec symbol" | Discrete index into a codebook; 1024 or 2048 typical. |
| Delayed parallel | "Offset codebooks" | Emit K token streams with staggered offsets to reduce sequence length. |
| Flow matching | "The 2024 win for audio" | Straighter-path alternative to diffusion; faster sampling. |
| Voice prompt | "3-second sample" | Speaker embedding or token prefix that steers the cloned voice. |
| Mel spectrogram | "The visual" | Log-magnitude perceptual spectrogram; used by many TTS systems. |
| Vocoder | "Mel to wave" | Neural component that converts mel spectrograms back to audio. |

## Note de production: l'audio est un problème de streaming

L'audio est la mode de sortie que les utilisateurs attendent d'arriver *comme il est généré*, pas tout à la fois. En termes de production, cela signifie que TPOT compte (Time Per Output Token) parce que la vitesse d'écoute de l'utilisateur est le débit cible  et non sa vitesse de lecture. Pour l'audio 16 kHz jetonné à ~75 jetons / seconde (Encodec), le serveur doit générer ≥75 jetons / seconde par utilisateur pour garder la lecture fluide.

Deux conséquences architecturales:

- **Flow-matching audio models cannot stream trivially.**Stable Audio 2.5 et AudioCraft 2 rendent une longueur de clip fixe en un seul passage. Pour diffuser, vous déchiffrez le clip et les limites de superposition  pensez à la diffusion des fenêtres coulissantes  ajoutant 100-300 ms de latence en tête par rapport à un modèle AR codec.

Si le produit est " live voice chat " ou " continuation de musique en temps réel ", choisissez le codec AR chemin. Si il est " rend une vidéo de 30 secondes sur soumission ", le flux de correspondance gagne sur la qualité et la latence totale.

## Pour en savoir plus

- [Défossez et al. (2022). Encodec: High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) la norme codec.
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) le premier codec audio neuronal largement utilisé.
- [Kumar et al. (2023). High-Fidelity Audio Compression with Improved RVQGAN (DAC)](https://arxiv.org/abs/2306.06546)- Le DAC.
- [Wang et al. (2023). Neural Codec Language Models are Zero-Shot Text to Speech Synthesizers (VALL-E)](https://arxiv.org/abs/2301.02111)- Je suis en train de vous dire.
- [Copet et al. (2023). Simple and Controllable Music Generation (MusicGen)](https://arxiv.org/abs/2306.05284) MusiqueGen.
- [Liu et al. (2023). AudioLDM 2: Learning Holistic Audio Generation with Self-supervised Pretraining](https://arxiv.org/abs/2308.05734) AudioLDM 2.
- [Stability AI (2025). Stable Audio 2.5](https://stability.ai/news-updates/stability-ai-introduces-stable-audio-25-the-first-audio-model-built-for-enterprise-sound-production-at-scale) 2025 text-to-music avec correspondance de flux.
