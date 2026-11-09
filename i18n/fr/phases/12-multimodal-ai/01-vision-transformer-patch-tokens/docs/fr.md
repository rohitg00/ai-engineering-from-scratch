# Les transformateurs de vision et le primitif patch-token

> Avant tout multimodal, une image doit devenir une séquence de jetons qu'un transformateur peut manger. Le papier ViT 2020 a répondu à cela avec des patchs de 16x16 pixels, une projection linéaire et une intégration de position. Cinq ans plus tard, chaque modèle frontalier 2026 (Claude Opus 4.7 à 2576px natif, Gemini 3.1 Pro, Qwen3.5-Omni) commence toujours de cette façon  l'encodeur a changé de ViT à DINOv2 à SigLIP 2, des jetons de registre ont été ajoutés, le schéma positionnel est devenu 2D-RoPE, mais le primitif a été maintenu. Cette leçon lit le pipeline de patch-token de bout en bout et le construit en stdlib Python afin que le reste de la phase 12 ait un modèle mental concret pour les "tokens visuels".

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, patch tokenizer + geometry calculator)
**Prerequisites:** Phase 7 (Transformers), Phase 4 (Computer Vision)
**Time:** ~120 minutes

## Objectifs d'apprentissage

- Convertir une image HxWx3 en une séquence de jetons de correction avec un codage positionnel correct.
- Comptez la longueur de la séquence, le nombre de paramètres et les FLOP pour un ViT donné (taille de patch, résolution, faible cache, profondeur).
- Nombre des trois améliorations qui ont permis de passer la recherche de ViT de 2020 à la production de 2026: pré-entraînement auto-supervisé (DINO / MAE), jetons de registre et emballage à résolution native.
- Choisissez entre le pooling CLS, le pooling moyen et l'enregistrement de jetons pour une tâche en aval.

## Le problème

Les transformateurs fonctionnent sur des séquences de vecteurs. Le texte est déjà une séquence (byte ou jetons). Une image est une grille 2D de pixels avec trois canaux de couleur  pas une séquence. Si vous aplanissez chaque pixel, une image RGB 224x224 devient 150,528 jetons, et l'attention personnelle à cette longueur est un non-starter (quadratique en longueur de séquence).

Les approches pré-2020 ont boulonné un extracteur de fonctionnalités de CNN sur le devant: ResNet produit une carte de fonctionnalités 7x7 de vecteurs 2048-dimension, alimente ces 49 jetons à un transformateur. Cela fonctionne mais hérite des biais de la CNN (équivalence de traduction, champs réceptifs locaux) et perd l'appétit du transformateur pour l'échelle.

Dosovitskiy et al. (2020) a posé la question simple: et si nous ignorons la CNN ? Divisez l'image en patchs de taille fixe (disons 16x16 pixels), projettez chaque patch de manière linéaire dans un vecteur, ajoutez une intégration positionnelle et alimentez la séquence à un transformateur de vanille. À l'époque, c'était une vision hérétique sans convolutions. Avec suffisamment de données (JFT-300M, puis LAION) il a battu ResNet sur ImageNet et a continué à s'améliorer.

En 2026, la base de la première vitesse est la ViT. La tour de vision de chaque VLM à poids ouvert est un descendant (DINOv2, SigLIP 2, CLIP, EVA, InternViT). La question n'est plus " devrions-nous utiliser des patches ? " mais " quelle taille de patch, quelle résolution, quel objectif de pré-entraînement, quel codage positional ".

## Le concept

### Les patches en tant que jetons

En raison d' une image `x`de forme `(H, W, 3)`et une taille de patch `P`, vous taillez l' image dans une grille de `(H/P) x (W/P)`Les patchs ne se chevauchent pas.`P x P x 3`Cube de pixels. Appliquer chaque cube à un`3 P^2`Vecteur. Appliquer une projection linéaire partagée `W_E`de forme `(3 P^2, D)`pour cartographier chaque patch dans la dimension cachée du modèle `D`- Je suis désolé .

Pour la configuration canonique ViT-B/16:
- Résolution 224, taille de patch 16 → grille 14x14 → 196 jetons de patch.
- Chaque plaque est `16 x 16 x 3 = 768`Les valeurs de pixels, projetées à `D = 768`- Je suis désolé .
- Ajoutez un apprenant `[CLS]`longueur de la séquence → symbole 197.

La projection de patch est mathématiquement identique à une convolutions 2D avec la taille du noyau `P`- Je suis en train de faire un pas .`P`, et `D`C'est ainsi que le code de production le met en œuvre  `nn.Conv2d(3, D, kernel_size=P, stride=P)`. Le cadre de la projection linéaire est conceptuel; le cadre du noyau est efficace.

### Embeddings positionnels

Les patchs n'ont pas d'ordre inhérent  le transformateur les voit comme un sac. Les premiers ViTs ont ajouté une intégration positionnelle 1D appréciable (un vecteur de 768 dimensions par position, 197 d'entre eux).

Les dos de vision modernes utilisent 2D-RoPE (M-RoPE de Qwen2-VL, par défaut de SigLIP 2) ou des positions 2D facteurisées. 2D-RoPE fait pivoter la requête et les vecteurs clés en fonction de l'indice du patch (ligne, colonne), de sorte que le modèle infère la position 2D relative à partir de l'angle de rotation.

### Les jetons CLS, les sorties regroupées et les jetons de registre

Qu'est-ce que la représentation au niveau de l'image ?

1. `[CLS]`Le symbole CLS est le symbole de l'image hérité de BERT. utilisé par le ViT original, CLIP.
2. La moyenne des états cachés des jetons de patch utilisés par SigLIP, DINOv2, la plupart des VLM modernes.
3. Les jetons de registre. Darcet et coll. (2023) ont observé que les ViTs formés sans jeton de lavage explicite développent des correctifs "artifact" de haute norme qui détournent l'attention personnelle.

Le choix est important pour les tâches en aval. CLS est bon pour la classification. Pour les VLM qui alimentent des jetons de patch dans un LLM, vous sautez la mise en commun entièrement  chaque patch devient un jeton d'entrée LLM. Les registres sont jetés avant la remise (ils sont des échafaudages, pas du contenu).

### Pré-entraînement: supervisé, contrastif, masqué, autodistilé

Le ViT 2020 a été prétrainé avec une classification supervisée sur le JFT-300M. Rapidement remplacé par:

- CLIP (2021): texte d'image contrasté sur 400 millions de paires.
- MAE (2021, He et al.): masquer 75% des patchs, reconstruire les pixels. Autoservisé, fonctionne sur des images pures.
- DINO (2021) / DINOv2 (2023): auto-destilation avec élève-enseignant, sans étiquettes, sans sous-titres. Le 2023 DINOv2 ViT-g/14 est la colonne vertébrale purement visuelle la plus forte et la norme par défaut pour les cas d'utilisation "densité de caractéristiques".
- SigLIP / SigLIP 2 (2023, 2025): CLIP avec une perte sigmoïde et NaFlex pour le rapport d'aspect natif. La tour de vision dominante en 2026 est ouverte VLM (Qwen, Idefics2, LLaVA-OneVision).

Le choix de la pré-entraînement détermine à quoi l'épine dorsale est adaptée: CLIP/SigLIP pour l'ajustement sémantique avec le texte, DINOv2 pour les caractéristiques visuelles denses, MAE comme point de départ pour la finition en aval.

### Les lois de l'échelle

L'échelle ViT (Zhai et coll. 2022) a établi que la qualité d'une ViT obéit à des lois prévisibles en termes de taille du modèle, de taille des données et de calcul.
- Un modèle plus grand + plus de données → meilleure qualité.
- La taille du patch est un levier sur la longueur de séquence par rapport à la fidélité. Le patch 14 (typique pour DINOv2/SigLIP SO400m) donne plus de jetons par image que le patch 16; mieux pour les tâches OCR et dense, pire pour la vitesse.
- La résolution est l'autre gros levier. passer de 224 à 384 à 512 aide presque toujours, au coût quadratique dans les FLOP.

ViT-g/14 (1B params, patch 14, résolution 224 → 256 jetons) et SigLIP SO400m/14 (400M params, patch 14) sont les deux encoders de cheval de travail pour les VLM ouverts de 2026.

### Le nombre de paramètres pour un ViT

Le calcul complet se fait en `code/main.py`Pour ViT-B/16 à 224:

```
patch_embed = 3 * 16 * 16 * 768 + 768  =  591k
cls + pos    = 768 + 197 * 768          =  152k
block        = 4 * 768^2 (QKVO) + 2 * 4 * 768^2 (MLP) + 2 * 2*768 (LN)
             = 12 * 768^2 + 3k          =  7.1M
12 blocks    = 85M
final LN    = 1.5k
total       ≈ 86M
```

Parquez chaque vitesse de ballon de cette façon avant de charger le point de contrôle.

### Configuration de la production 2026

Le codeur le plus ouvert que les VLM ont utilisé en 2026 est SigLIP 2 SO400m/14 à résolution native (NaFlex).
- Paramètres de 400 M.
- Taille de patch 14, résolution par défaut 384 → 729 jetons de patch par image.
- Pools moyen pour les tâches au niveau de l'image; tous les 729 patches coulent dans le MLL pour VQA.
- 4 jetons de registre, jetés avant la remise de la LLM.
- 2D-RoPE avec mise à l'échelle au niveau de l'image pour le rapport d'aspect natif.

Chaque décision de cette config remonte à un journal que vous pouvez lire.

```figure
image-patch-tokens
```

## Utilisez-le

`code/main.py`est un jeton de patch et une calculatrice géométrique. Il prend (image H, W, patch P, caché D, profondeur L) et rapporte:

- La forme de la grille et la longueur de la séquence après le patchage.
- Sequence de jetons pour une image de jouet à 8x8 pixels synthétique (marcher à travers le chemin plat + projet).
- Le nombre de paramètres est divisé par insertion de patch, insertion de position, blocs de transformateur et tête.
- Les FLOP par passe à l'avant à la résolution cible.
- Un tableau de comparaison à travers ViT-B/16 @ 224, ViT-L/14 @ 336, DINOv2 ViT-g/14 @ 224, SigLIP SO400m/14 @ 384.

Appliquez le nombre de paramètres aux numéros publiés, utilisez la taille et la résolution du patch pour connaître le coût du nombre de jetons.

## La faire partir

Cette leçon produit `outputs/skill-patch-geometry-reader.md`. Une configuration ViT (taille de patch, résolution, flou caché, profondeur) produit un nombre de jetons, un nombre de paramètres et une estimation VRAM avec des justifications.

## Exercices

1. Comptez la longueur de la séquence de patch-token pour Qwen2.5-VL à l'entrée 1280x720 native avec la taille du patch 14. Comment cela se compare-t-il à une représentation CLS seulement?

2. Un cadre 1080p (1920x1080) au patch 14 produit combien de jetons? À 30 FPS sur une vidéo de 5 minutes, combien de jetons visuels au total? Quel coût vous économise le plus: pooling, échantillonnage de cadre ou fusion de jetons?

3. Implémenter le pooling moyen sur les jetons de patch dans Python pur. Vérifiez que le pool moyen sur 196 jetons d'une sortie DINOv2 correspond à ce que le modèle `forward`retourne lorsque vous demandez une intégration combinée.

4. Lisez la section 3 de " Les transformateurs de vision ont besoin de registres " (arXiv:2309.16588).

5. Modifier `code/main.py`Pour soutenir le patch-n'-pack: une liste d'images de différentes résolutions étant fournie, produisez une seule séquence de package et le masque d'attention de bloc-diagonale.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Patch | "16x16 pixel square" | A fixed-size non-overlapping region of the input image; becomes one token |
| Patch embedding | "Linear projection" | A shared learned matrix (or Conv2d with stride=P) mapping flattened patch pixels to D-dim vectors |
| CLS token | "Class token" | Prepended learnable vector whose final hidden state represents the whole image; optional in 2026 |
| Register token | "Sink token" | Extra learnable tokens that absorb the high-norm attention artifacts ViTs develop during pretraining |
| Position embedding | "Positional info" | Per-position vector or rotation making the sequence-order-aware; 2D-RoPE is the modern default |
| Grid | "Patch grid" | The (H/P) x (W/P) 2D array of patches for a given resolution and patch size |
| NaFlex | "Native flexible resolution" | SigLIP 2 feature: single model serves multiple aspect ratios and resolutions without retraining |
| Backbone | "Vision tower" | The pretrained image encoder whose patch-token outputs feed the LLM in a VLM |
| Pooling | "Image-level summary" | Strategy to turn patch tokens into one vector: CLS, mean, attention pool, or register-based |
| Patch 14 vs 16 | "Finer vs coarser grid" | Patch 14 produces more tokens per image, better fidelity for OCR, slower; patch 16 is the classic default |

## Pour en savoir plus

- [Dosovitskiy et al. — An Image is Worth 16x16 Words (arXiv:2010.11929)](https://arxiv.org/abs/2010.11929) ViT original.
- [He et al. — Masked Autoencoders Are Scalable Vision Learners (arXiv:2111.06377)](https://arxiv.org/abs/2111.06377) MAE, pré-entraînement auto-supervisé.
- [Oquab et al. — DINOv2 (arXiv:2304.07193)](https://arxiv.org/abs/2304.07193) Autodistillation à grande échelle, sans étiquettes.
- [Darcet et al. — Vision Transformers Need Registers (arXiv:2309.16588)](https://arxiv.org/abs/2309.16588) enregistrement des jetons et analyse des artefacts.
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) la tour de vision par défaut de 2026.
- [Zhai et al. — Scaling Vision Transformers (arXiv:2106.04560)](https://arxiv.org/abs/2106.04560) les lois empiriques de l'échelle.
