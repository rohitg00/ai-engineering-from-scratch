# Génération vidéo

> Une image est un tensor 2D. Une vidéo est une 3D. La théorie est la même; le calcul est 10-100 fois plus difficile. Sora d'OpenAI (février 2024) a prouvé que c'était possible.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 7 · 09 (ViT), Phase 8 · 06 (DDPM)
**Time:** ~45 minutes

## Le problème

Une vidéo 1080p de 10 secondes à 24 fps est de 240 images de 1920×1080×3 pixels. C'est environ 1,5 Go de données brutes par clip. La diffusion par pixels est impossible. Vous avez besoin:

1. **Spatiotemporal compression.**Un VAE qui encode des vidéos, pas des cadres, en une séquence de patchs spatiaux-temporaux.
2. **Temporal coherence.**Les images doivent partager le contenu, l'éclairage et l'identité des objets en quelques secondes.
3. **Compute budget.**La formation vidéo est 10 à 100 fois plus chère que l'image pour le même modèle.
4. **Conditioning.**Les quatre modèles de production acceptent les quatre.

L'architecture qui a résolu cela est la **Diffusion Transformer (DiT)**Il est également possible de faire des analyses de la diffusion de la lumière, en utilisant des données de type "réflexible" et "réflexible" pour les données.

## Le concept

![Video diffusion: patchify, DiT, decode](../assets/video-generation.svg)

### Partage de la couche

Le vide est encodé par un VAE 3D (compression spatiale-temporale apprise).`[T_latent, H_latent, W_latent, C_latent]`- Divisé en petits morceaux .`[t_p, h_p, w_p]`Pour les modèles de style Sora,`t_p = 1`(parches par cadre) ou `t_p = 2`Une vidéo 1080p de 10 secondes est comprimée à environ 20 000 à 100 000 patches.

### DiT spatiotemporal

Un transformateur traite la séquence plate de patchs. Chaque patch a une intégration positionnelle 3D (temps + y + x).

- **Spatial attention**dans les patchs de chaque cadre.
- **Temporal attention**à travers des cadres dans le même emplacement spatial.
- **Full 3D attention**est 16 à 100 fois plus cher; utilisé uniquement à faible résolution ou dans la recherche.

### Conditionnement du texte

L'attention croisée avec un grand encodeur de texte (T5-XXL pour Sora, CogVideoX-5B utilise T5-XXL).

### Formation

Perte de diffusion standard (ε ou v prédiction) sur les latences spatiotemporales. Données: vidéo web + ~ 100M clips curatés + légendes de texte synthétiques. Compute: 10 000 heures de GPU+ pour même une petite recherche; l'échelle Sora est de 100 000+.

## Le paysage de production de 2026

| Model | Date | Max duration | Max res | Open weights? | Notable |
|-------|------|--------------|---------|---------------|---------|
| Sora (OpenAI) | 2024-02 | 60s | 1080p | No | First model to show world simulator properties at scale |
| Sora Turbo | 2024-12 | 20s | 1080p | No | Production Sora at 5x faster inference |
| Veo 2 (Google) | 2024-12 | 8s | 4K | No | Highest quality + physics in 2025 |
| Veo 3 | 2025 Q3 | 15s | 4K | No | Native audio and stronger camera control |
| Kling 1.5 / 2.1 (Kuaishou) | 2024-2025 | 10s | 1080p | No | Best human motion in 2025 Q1 |
| Runway Gen-3 Alpha | 2024-06 | 10s | 768p | No | Professional video tools on top |
| Pika 2.0 | 2024-10 | 5s | 1080p | No | Strongest character consistency |
| CogVideoX (THUDM) | 2024 | 10s | 720p | Yes (2B, 5B) | First open 5B-scale video |
| HunyuanVideo (Tencent) | 2024-12 | 5s | 720p | Yes (13B) | Open SOTA late 2024 |
| Mochi-1 (Genmo) | 2024-10 | 5.4s | 480p | Yes (10B) | Most permissively licensed |
| WAN 2.2 (Alibaba) | 2025-07 | 5s | 720p | Yes | Strongest open model mid-2025 |

Les poids ouverts comblent le fossé plus rapidement que dans l'espace d'images: HunyuanVideo + WAN 2.2 LoRA alimentent déjà la plupart des flux de travail open source d'ici la mi-2026.

```figure
video-diffusion-denoise
```

## Faites-le

`code/main.py`Il est également possible de simuler l'idée de la DiT spatiotemporale principale: patch une petite vidéo synthétique, ajouter une position par patch intégrée, et dénoncer toute la séquence avec une attention de style transformateur sur les patches. Pas de numpy; Python pur. Nous montrons que la cohérence temporelle émerge même en 1D lorsque les patches de cadre adjacents partagent un dénonciateur et les emblèmes de position.

### Étape 1: patch une " vidéo " synthétique en 1D

```python
def make_video(T_frames=8, rng=None):
    # a "video" is a sequence of 1-D values following a smooth trajectory
    base = rng.gauss(0, 1)
    return [base + 0.3 * t + rng.gauss(0, 0.1) for t in range(T_frames)]
```

### Étape 2: intégration de position par cadre

```python
def pos_embed(t, dim):
    return sinusoidal(t, dim)
```

### Étape 3: le dénicheur voit toute la séquence

Au lieu de dénoncer chaque cadre indépendamment, notre petit filet concatenant toutes les valeurs de cadre + leurs emplacements de position et prédit le bruit pour tous les cadres conjointement.

### Étape 4: Teste de cohérence temporelle

Après l'entraînement, prenez une vidéo. Mesurez le delta frame-to-frame. Si le modèle a appris la structure temporelle, les deltas restent plus petits que le prélèvement de chaque cadre indépendamment.

## Les pièges

- **Independent per-frame sampling = flicker.**Si vous exécutez la diffusion d'image sur chaque cadre séparément, la sortie s'allume parce que le bruit de chaque cadre est indépendant.
- **Naive 3D attention = OOM.**L'attention 3D totale sur une latence de 10 secondes 1080p est des centaines de milliards d'opérations. Factoriser en spatial + temporel.
- **Data captioning matters more than size.**La mise à niveau principale de Sora par rapport aux travaux précédents a été la formation sur des sous-titres 10 fois plus détaillés (clips re-étiquetés GPT-4).
- **First-frame conditioning.**La plupart des modèles de production acceptent également une image comme première image.
- **Physics drift.**Les clips longs (> 10 s) accumulent des inconsistences subtiles.

## Utilisez-le

| Use case | 2026 pick |
|----------|-----------|
| Highest-quality text-to-video, hosted | Veo 3 or Sora |
| Camera-controlled cinematic | Runway Gen-3 with motion brushes |
| Character consistency across clips | Pika 2.0 or Kling 2.1 |
| Open weights, fast fine-tune | WAN 2.2 + LoRA |
| Image-to-video | WAN 2.2-I2V, Kling 2.1 I2V, or Runway |
| Audio-to-video lip sync | Veo 3 (native audio) or a dedicated lip-sync model |
| Video editing | Runway Act-Two, Kling Motion Brush, Flux-Kontext (still-frame) |

Le coût par seconde de la vidéo à parité de qualité a chuté de 20 fois entre 2024 et 2026.

## La faire partir

- Ça va .`outputs/skill-video-brief.md`. Skill prend un bref vidéo (durée, rapport d'aspect, style, plan de caméra, cohérence du sujet, audio) et les résultats: modèle + hébergement, échafaudage rapide (langue de la caméra, description du sujet, descripteurs de mouvement), protocole de sélection + reproductibilité et liste de contrôle de QA au niveau du cadre.

## Exercices

1. **Easy.**Dans `code/main.py`, comparer le delta cadre-à-cadre pour (a) l'échantillonnage indépendant par cadre, (b) l'échantillonnage par séquence commune.
2. **Medium.**Ajouter une condition de première image: image de pin 0 à une valeur donnée et échantillonner le reste. Mesurer comment la valeur fixée se propage.
3. **Hard.**Utilisez les diffuseurs HuggingFace pour exécuter CogVideoX-2B sur un GPU local.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Video VAE | "3-D VAE" | Encoder that compresses `(T, H, W, C)` → spatiotemporal latent. |
| Patches | "The tokens" | Fixed-size 3-D blocks of the latent; input to the DiT. |
| Factorized attention | "Spatial + temporal" | Run attention over space, then over time; skip full 3-D attention. |
| Image-to-video (I2V) | "Animate this photo" | Model takes an image + text, outputs a video that starts from it. |
| Keyframe conditioning | "Anchor frames" | Pin specific frames to control the video's arc. |
| Motion brush | "Directional hint" | UI input where the user paints motion vectors onto the image. |
| Re-captioning | "Dense captions" | Using an LLM to re-label training clips with detailed prompts. |
| Flicker | "Temporal artifact" | Frame-to-frame inconsistency; fixed with coupled denoising. |

## Note de production: les latences vidéo sont un problème de mémoire et de bande passante

Une vidéo 1080p de 10 secondes à 24 images par seconde est de 240 images × 1920 × 1080 × 3 ≈ 1,5 Go de pixels bruts.`2 × spatial × 2 × temporal`En fonction de la fréquence de détection de l'écran, vous pouvez utiliser un disque de détection spatiotemporal pendant 30 étapes au lot 1 et vous déplacez ~3 Go/étape à travers la bande passante de mémoire HBM , et non FLOPs, c'est le goulot d'étranglement.

Trois boutons de production, tous directement à partir de la production-inférence de la littérature inférence chapitre:

- **TP across the DiT.**Les modèles texte à vidéo sont habituellement ≥10B. TP = 4 sur 4 H100 est standard; PP = 2 × TP = 2 pour les modèles de classe 405B. La latence par étape diminue approximativement linéairement avec TP jusqu'au mur tout réduit.
- **Frame batching = continuous batching.**Au moment de la génération, la vidéo est conceptuellement un lot de cadres reliés par l'attention.`t+1`pendant le cadre `t-1`est retourné, si l'architecture du modèle permet la génération de fenêtres coulissantes.
- **Clip-level prefill cache.**Pour l'image à la vidéo, le conditionnement de première image est analogue au pré-remplissage rapide d'un LLM: le calculer une fois, réutiliser à travers les passes du décodeur temporel.

## Pour en savoir plus

- [Brooks et al. (2024). Video generation models as world simulators](https://openai.com/index/video-generation-models-as-world-simulators/)Rapport technique Sora.
- [Yang et al. (2024). CogVideoX: Text-to-Video Diffusion Models with An Expert Transformer](https://arxiv.org/abs/2408.06072) CogVideoX.
- [Kong et al. (2024). HunyuanVideo: A Systematic Framework for Large Video Generative Models](https://arxiv.org/abs/2412.03603) HunyuanVideo.
- [Genmo (2024). Mochi 1 preview model card](https://huggingface.co/genmo/mochi-1-preview)- Mochi-1.
- [Alibaba (2025). WAN 2.2](https://wanvideo.io/) ouverture de SOTA à la mi-2025.
- [Ho, Salimans, Gritsenko et al. (2022). Video Diffusion Models](https://arxiv.org/abs/2204.03458) le papier de diffusion vidéo de référence.
- [Blattmann et al. (2023). Align your Latents (Video LDM)](https://arxiv.org/abs/2304.08818) Ancêtre de la diffusion vidéo stable.
