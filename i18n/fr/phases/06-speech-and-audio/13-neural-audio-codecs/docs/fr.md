# Codecs audio neuraux  EnCodec, SNAC, Mimi, DAC et la séparation sémantique-acoustique

> La génération audio 2026 est presque tous des jetons. EnCodec, SNAC, Mimi et DAC transforment les formes d'onde continues en séquences discrètes que un transformateur peut prédire.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 10 · 11 (Quantization), Phase 5 · 19 (Subword Tokenization)
**Time:** ~60 minutes

## Le problème

Les modèles de langage fonctionnent sur des jetons distincts. L'audio est continu. Si vous voulez un modèle de style LLM pour la parole / la musique  MusicGen, Moshi, Sesame CSM, VibeVoice, Orpheus  vous avez d'abord besoin d'un **neural audio codec**: un codeur apprenant qui discrète l'audio en un petit vocabulaire de jetons, et un décodeur correspondant qui reconstruit la forme d'onde.

Deux familles sont apparues:

1. **Reconstruction-first codecs** EnCodec, DAC. Optimiser la qualité audio perceptuelle. Les jetons sont "acoustiques"  ils capturent tout, y compris l'identité du haut-parleur, le timbre, le bruit de fond.
2. **Semantic-first codecs** Mimi (Kyutai), SpeechTokenizer. Forcez le premier codebook à encoder le contenu linguistique / phonétique (souvent en distillant de WavLM).

Les perspectives de 2024 à 2026: **a pure reconstruction codec gives you blurry speech when you try to generate from text.**Le LLM sur les jetons codec doit apprendre à la fois la structure du langage ET la structure acoustique dans le même codebook, ce qui n'est pas à l'échelle.

## Le concept

![Four codec landscape: EnCodec, DAC, SNAC (multi-scale), Mimi (semantic+acoustic)](../assets/codec-comparison.svg)

### Le truc principal: quantification des vecteurs résiduels (RVQ)

Au lieu d'un seul codec (qui nécessiterait des millions de codes pour une bonne qualité), tous les codecs audio modernes utilisent **RVQ**Le premier codebook quantifie la sortie du codeur; le second quantifie le résiduel; etc. Chaque codebook est constitué de 1024 codes.$1024^8 = 10^{24}$- Je suis désolé .

Au moment de l'inférence, le décodeur additionne tous les codes choisis par cadre pour la reconstruction.

### Les quatre codecs qui comptent en 2026

**EnCodec (Meta, 2022).**Le code de base. Encoder-décoder sur la forme d'onde, RVQ goulet d'étranglement. 24 kHz, 32 livres de code possibles, 4 livres de code par défaut @ 1,5 kbps. Utilisations `1D conv + transformer + 1D conv`L'architecture, utilisée par MusicGen.

**DAC (Descript, 2023).**RVQ avec des codebooks normalisés L2, des fonctions d'activation périodiques, des pertes améliorées. La plus haute fidélité de reconstruction de tout codec ouvert  parfois indistinguible de la parole originale avec 12 codebooks. 44,1 kHz à bande complète.

**SNAC (Hubert Siuzdak, 2024).**Les rouges de code fonctionnent à un rythme d'image inférieur à ceux fins. Modélise efficacement l'audio hiérarchiquement: un "boutonnement" grossier à ~ 12 Hz plus un détail à 50 Hz. Utilisé par Orpheus-3B parce que la structure hiérarchique correspond bien à la génération basée sur LM.

**Mimi (Kyutai, 2024).**Le changateur de jeu 2026: 12,5 Hz de fréquence d'images (extrêmement bas), 8 livres de code @ 4,4 kbps.**distilled from WavLM**Les livres de code 1-7 sont des résidus acoustiques. Cette division permet de prédire les caractéristiques du contenu de la parole de WavLM.

### Les taux de cadres sont importants pour la modélisation des langages

La fréquence de l'image inférieure = séquence plus courte = LM plus rapide.

| Codec | Frame rate | 1 s = N frames | Good for |
|-------|-----------|----------------|---------|
| EnCodec-24k | 75 Hz | 75 | music, general audio |
| DAC-44.1k | 86 Hz | 86 | high-fidelity music |
| SNAC-24k (coarse) | ~12 Hz | 12 | AR-LM efficient |
| Mimi | 12.5 Hz | 12.5 | streaming speech |

À 12,5 Hz, une déclaration de 10 secondes est seulement 125 cadres de codec  un transformateur peut facilement les prédire.

### Les jetons sémantiques et les jetons acoustiques

```
frame_t → [semantic_token_t, acoustic_token_0_t, acoustic_token_1_t, ..., acoustic_token_6_t]
```

- **Semantic token (codebook 0 in Mimi).**Il encode ce qui a été dit  phonèmes, mots, contenu. Destilé à partir de WavLM via une perte de prédiction auxiliaire.
- **Acoustic tokens (codebooks 1-7).**Timbre de code, identité du haut-parleur, prosodie, bruit de fond, détails fins.

Un LM AR prédit d'abord le jeton sémantique (conditionné sur le texte), puis prédit les jetons acoustiques (conditionnés sur la référence sémantique + haut-parleur). Cette factualisation est la raison pour laquelle le TTS moderne peut cloner des voix à tir zéro: le modèle sémantique gère le contenu; le modèle acoustique gère le timbre.

### 2026 qualité de reconstruction (bits par seconde, plus faible bitrate est mieux)

| Codec | Bitrate | PESQ | ViSQOL |
|-------|---------|------|--------|
| Opus-20kbps | 20 kbps | 4.0 | 4.3 |
| EnCodec-6kbps | 6 kbps | 3.2 | 3.8 |
| DAC-6kbps | 6 kbps | 3.5 | 4.0 |
| SNAC-3kbps | 3 kbps | 3.3 | 3.8 |
| Mimi-4.4kbps | 4.4 kbps | 3.1 | 3.7 |

Les codecs traditionnels comme Opus gagnent toujours par bit en matière de qualité perceptuelle.**discrete tokens**(qui n'est pas produit par Opus) et **generative-model quality**(ce que le LM peut faire avec ces jetons).

```figure
rvq-codec-cascade
```

## Faites-le

### Étape 1: encoder avec EnCodec

```python
from encodec import EncodecModel
import torch

model = EncodecModel.encodec_model_24khz()
model.set_target_bandwidth(6.0)  # kbps

wav = torch.randn(1, 1, 24000)
with torch.no_grad():
    encoded = model.encode(wav)
codes, scale = encoded[0]
# codes: (1, n_codebooks, n_frames), dtype=int64
```

`n_codebooks=8`Chaque code est de 0 à 1023 (10 bits).

### Étape 2: Décoder et mesurer la reconstruction

```python
with torch.no_grad():
    wav_recon = model.decode([(codes, scale)])

from torchaudio.functional import compute_deltas
import torch.nn.functional as F

mse = F.mse_loss(wav_recon[:, :, :wav.shape[-1]], wav).item()
```

### Étape 3: la fraction sémantique-acoustique (à la manière de Mimi)

```python
from moshi.models import loaders
mimi = loaders.get_mimi()

with torch.no_grad():
    codes = mimi.encode(wav)  # shape (1, 8, frames@12.5Hz)

semantic = codes[:, 0]
acoustic = codes[:, 1:]
```

Le codebook sémantique 0 est aligné avec WavLM. Vous pouvez former un transformateur texte-sémantique  un vocabulaire beaucoup plus petit que de passer directement à l'audio.

### Étape 4: pourquoi AR LM sur les jetons codec fonctionne

Pour un clip de 10 secondes à 12,5 Hz × 8 codes de Mimi:

```math
N_{\text{tokens}} = 10 \times 12.5 \times 8 = 1000 \text{ tokens}
```

1000 jetons est un contexte trivial pour un transformateur. Un transformateur de 256M-paramètre peut générer 10 secondes de parole en millisecondes sur un GPU moderne.

## Utilisez-le

Problème de carte → codec:

| Task | Codec |
|------|-------|
| General music generation | EnCodec-24k |
| Highest-fidelity reconstruction | DAC-44.1k |
| AR LM over speech (TTS) | SNAC or Mimi |
| Streaming full-duplex speech | Mimi (12.5 Hz) |
| Sound-effect library with text | EnCodec + T5 condition |
| Fine-grained audio editing | DAC + inpainting |

Règle générale: **if you're building a generative model, start with Mimi or SNAC. If you're building a compression pipeline, use Opus.**

## Les pièges

- **Too many codebooks.**L'ajout de livres de code augmente la fidélité linéairement mais la longueur de la séquence LM également linéairement.
- **Frame-rate mismatch.**L'entraînement LM à 12,5 Hz Mimi puis l'ajustement fin à 50 Hz EnCodec échoue silencieusement.
- **Assuming all codebooks equal.**Dans Mimi, le codebook 0 contient du contenu; le perdre détruit l'intelligibilité.
- **Using reconstruction quality as the only metric.**Un codec peut avoir une grande reconstruction mais être inutile pour la génération basée sur LM si la structure sémantique est mauvaise.

## La faire partir

- Je ne sais pas .`outputs/skill-codec-picker.md`Choisissez un codec pour une tâche générative ou de compression donnée.

## Exercices

1. **Easy.**On court .`code/main.py`Il implémentera un quantificateur de jouets scalaire + résiduel et mesurera l'erreur de reconstruction lorsque vous ajoutez des livres de code.
2. **Medium.**Installez`encodec`et comparer 1, 4, 8, 32 livres de code sur un clip de discours prolongé.
3. **Hard.**Charger Mimi. Encodez un clip. Remplacez le codebook 0 par des entiers aléatoires; décodez. Puis remplacez le codebook 7 de la même manière. Comparer les deux corruptions  codebook 0 corruption devrait détruire l'intelligibilité; codebook 7 corruption devrait à peine changer quoi que ce soit.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| RVQ | Residual quantization | Cascade of small codebooks; each quantizes the previous residual. |
| Frame rate | Codec speed | How many token-frames per second. Lower = faster LM. |
| Semantic codebook | Codebook 0 (Mimi) | Codebook distilled from SSL features; encodes content. |
| Acoustic codebooks | Everything else | Timbre, prosody, noise, fine detail. |
| PESQ / ViSQOL | Perceptual quality | Objective metrics correlating with MOS. |
| EnCodec | Meta codec | The RVQ baseline; used by MusicGen. |
| Mimi | Kyutai codec | 12.5 Hz frame rate; semantic-acoustic split; powers Moshi. |

## Pour en savoir plus

- [Défossez et al. (2023). EnCodec](https://arxiv.org/abs/2210.13438) la ligne de base RVQ.
- [Kumar et al. (2023). Descript Audio Codec (DAC)](https://arxiv.org/abs/2306.06546) La plus haute fidélité ouverte.
- [Siuzdak (2024). SNAC](https://arxiv.org/abs/2410.14411) RVQ à grande échelle.
- [Kyutai (2024). Mimi codec](https://kyutai.org/codec-explainer) séparation sémantique-acoustique, distillation WavLM.
- [Borsos et al. (2023). AudioLM](https://arxiv.org/abs/2209.03143) le paradigme sémantique/acoustique à deux étapes.
- [Zeghidour et al. (2021). SoundStream](https://arxiv.org/abs/2107.03312) le codec RVQ original en streaming.
