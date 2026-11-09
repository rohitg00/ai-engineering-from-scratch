# Génération de musique  Gen musical, Audio stable, Suno et le tremblement de terre de licence

> La génération de musique 2026: Suno v5 et Udio v4 dominent les affaires; MusicGen, Stable Audio Open et ACE-Step sont principalement open-source. Le problème technique est principalement résolu. Le problème juridique (Warner Music $ 500M règlement, UMG règlement) remodelée le domaine en 2025-2026.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 6 · 02 (Spectrograms), Phase 4 · 10 (Diffusion Models)
**Time:** ~75 minutes

## Le problème

Text → un clip musical de 30 secondes à 4 minutes, avec paroles, voix et structure.

1. **Instrumental generation.**Textes comme "lo-fi hip-hop drums avec des touches chaudes" → audio.
2. **Song generation (with vocals + lyrics).**"Cant country sur les nuits pluvieuses au Texas" → chanson complète.
3. **Conditional / controllable.**Extendre un clip existant, régénérer un pont, échanger le genre, séparer la tige ou la peinture.

## Le concept

![Music generation: token-LM vs diffusion, the 2026 model map](../assets/music-generation.svg)

### Les codes de codec neuraux

Les méta **MusicGen**(2023, MIT) et de nombreux dérivés: condition sur les emblèmes de texte/mélodie, prévoir autorégressivement les jetons EnCodec (32 kHz, 4 codebooks), décoder avec EnCodec. 300M - 3.3B paramètres.

**ACE-Step**(open source, 4B XL sorti en avril 2026) étend cela à la génération liricale à chansons complètes.

### Diffusion sur les fondements ou les latents

**Stable Audio (2023)**et **Stable Audio Open (2024)**Il est excellent pour les boucles, la conception sonore, les textures ambiantes, pas très bien pour les chansons complètes structurées.

**AudioLDM / AudioLDM2**: texte à audio via diffusion latente de style T2I, généralisée à la musique, aux effets sonores, à la parole.

### Hybride (production)  Suno, Udio, Lyria

Poids fermé. Probablement le codec AR LM + vocodeur basé sur la diffusion avec des têtes de voix / tambour / mélodie spécialisées. Suno v5 (2026) est le leader de qualité ELO 1293. Udio v4 ajoute la peinture + séparation de tige (bass, tambour, voix séparées téléchargements).

### Évaluation

- **FAD (Fréchet Audio Distance).**Distance de niveau d'intégration entre la distribution audio générée et la distribution audio réelle à l'aide de fonctionnalités VGGish ou PANN. Moins est mieux. MusicGen petit: 4,5 FAD sur MusicCaps; SOTA ~ 3.0.
- **Musicality (subjective).**La préférence humaine.
- **Text-audio alignment.**CLAP score entre le prompt et la sortie.
- **Musicality artifacts.**Des transitions hors rythme, une dérive vocal, une perte de structure après 30 secondes.

## Carte modèle 2026

| Model | Params | Length | Vocals | License |
|-------|--------|--------|--------|---------|
| MusicGen-large | 3.3B | 30 s | no | MIT |
| Stable Audio Open | 1.2B | 47 s | no | Stability non-commercial |
| ACE-Step XL (Apr 2026) | 4B | &gt; 2 min | yes | Apache-2.0 |
| YuE | 7B | &gt; 2 min | yes, multilingual | Apache-2.0 |
| Suno v5 (closed) | ? | 4 min | yes, ELO 1293 | commercial |
| Udio v4 (closed) | ? | 4 min | yes + stems | commercial |
| Google Lyria 3 (closed) | ? | real-time | yes | commercial |
| MiniMax Music 2.5 | ? | 4 min | yes | commercial API |

## Le paysage juridique (2025-2026)

- **Warner Music vs Suno settlement.**500 millions de dollars. WMG a maintenant la supervision de l'intelligence artificielle, des droits de musique et des pistes générées par l'utilisateur sur Suno.
- **EU AI Act**+ **California SB 942**: La musique générée par l'IA doit être divulguée.
- **Riffusion / MusicGen**Les membres du groupe ne sont pas des professionnels de la musique.

Modèles de sécurité pour le navire:

1. Générer uniquement des instruments (MusicGen, Stable Audio Open, sorties MIT/CC0).
2. Utilisez des API commerciales (Suno, Udio, ElevenLabs Music) avec une licence par génération.
3. Le train sur le catalogue de propriété ou de licence (la plupart des entreprises finissent ici).
4. Étiquettez les générations avec des balises d'eau + métadonnées.

```figure
sp-codec-tokens
```

## Faites-le

### Étape 1: générer avec MusicGen

```python
from audiocraft.models import MusicGen
import torchaudio

model = MusicGen.get_pretrained("facebook/musicgen-small")
model.set_generation_params(duration=10)
wav = model.generate(["upbeat synthwave with driving drums, 128 BPM"])
torchaudio.save("out.wav", wav[0].cpu(), 32000)
```

Trois tailles: `small`(300 M, rapide),`medium`Le rapport de la Commission`large`(3.3B) Le petit suffit pour "faire tomber l'idée".

### Étape 2: conditionnement de la mélodie

```python
melody, sr = torchaudio.load("humming.wav")
wav = model.generate_with_chroma(
    ["jazz piano cover"],
    melody.squeeze(),
    sr,
)
```

MusicGen-melody prend un chromagramme et préserve la mélodie tout en échangeant le timbre.

### Étape 3: évaluation du FAD

```python
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()

fad.get_fad_score("generated_folder/", "reference_folder/")
```

Compute la distance de VGGish. Utilisée pour les tests de régression au niveau du genre; pas un substitut pour les auditeurs humains.

### Étape 4: ajouter au flux de travail de la maîtrise en musique

Combinez avec les idées de l'étude 7-8:

```python
prompt = "Write a 30-second jazz loop. Describe the drums, bass, and piano voicing."
description = llm.complete(prompt)
music = musicgen.generate([description], duration=30)
```

## Utilisez-le

| Goal | Stack |
|------|-------|
| Instrumental sound design | Stable Audio Open |
| Game / adaptive music | Google Lyria RealTime (closed) |
| Full songs with vocals (commercial) | Suno v5 or Udio v4 with explicit license |
| Full songs with vocals (open) | ACE-Step XL or YuE |
| Short ad jingle | MusicGen melody-conditioned on a hummed reference |
| Music-video background | MusicGen + Stable Video Diffusion |

## Des pièges qui vont encore arriver en 2026

- **Copyright-laundering prompts.**"Cant dans le style de Taylor Swift"  commercial Suno / Audio filtrer ces maintenant, les modèles ouverts ne. Ajoutez votre propre liste de filtres.
- **Repetition / drift past 30 s.**Modèles AR boucle. croiser plusieurs générations, ou utiliser ACE-Step pour la cohérence structurelle.
- **Tempo drift.**Les modèles se détournent du BPM. Utilisez les balises BPM dans le prompt et le post-filtre avec librosa's `beat_track`- Je suis désolé .
- **Vocal intelligibility.**Le Suno est excellent; les modèles ouverts sont souvent mal à l'aise avec les mots.
- **Mono output.**Les modèles ouverts génèrent des stéréos mono ou faux.

## La faire partir

- Je ne sais pas .`outputs/skill-music-designer.md`. Choisir le modèle, la stratégie de licence, la longueur / plan de structure et les métadonnées de divulgation pour un déploiement de génération de musique.

## Exercices

1. **Easy.**On court .`code/main.py`Il produit une progression d'accord "générative" + un motif de batterie comme symboles ASCII  un dessin animé de génération musicale.
2. **Medium.**Installez`audiocraft`, générer des clips de 10 secondes sur 4 genres avec MusicGen-small, mesurer FAD contre un ensemble de genres de référence.
3. **Hard.**En utilisant ACE-Step (ou MusicGen-melody), générez trois variations de la même mélodie avec des commandes de timbre différentes.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| FAD | Audio FID | Fréchet distance between embedding distributions of real vs generated. |
| Chromagram | Melody as pitches | 12-dim per-frame vector; input to melody conditioning. |
| Stems | Instrument tracks | Separated bass / drums / vocals / melody as WAV. |
| Inpainting | Regen a section | Mask a time window; model regenerates just that. |
| CLAP | Text-audio CLIP | Contrastive audio-text embedding; eval text-audio alignment. |
| EnCodec | Music codec | Meta's neural codec used by MusicGen; 32 kHz, 4 codebooks. |

## Pour en savoir plus

- [Copet et al. (2023). MusicGen](https://arxiv.org/abs/2306.05284) l'indice de référence autorégressif ouvert.
- [Evans et al. (2024). Stable Audio Open](https://arxiv.org/abs/2407.14358) la conception sonore par défaut.
- [ACE-Step](https://github.com/ace-step/ACE-Step) ouverture 4B générateur de chansons complète, avril 2026.
- [Suno v5 platform docs](https://suno.com) le leader de la qualité commerciale.
- [AudioLDM2](https://arxiv.org/abs/2308.05734) diffusion latente pour la musique + effets sonores.
- [WMG-Suno settlement coverage](https://www.musicbusinessworldwide.com/warner-music-group-settles-with-suno-strikes-first-of-its-kind-deal-with-ai-song-generator/) Novembre 2025 précédent.
