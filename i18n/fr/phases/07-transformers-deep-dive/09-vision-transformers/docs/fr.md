# Transformateurs de vision (ViT)

> Une image est une grille de patchs, une phrase est une grille de jetons, le même transformateur les mange tous les deux.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 4 · 03 (CNNs), Phase 4 · 14 (Vision Transformers intro)
**Time:** ~45 minutes

## Le problème

Avant 2020, la vision par ordinateur signifiait des convulsions. Chaque SOTA sur ImageNet, COCO et les benchmarks de détection utilisaient une colonne vertébrale de CNN.

Dosovitskiy et coll. (2020)  " Une image vaut 16x16 mots "  a montré que vous pouvez laisser tomber les convolutions entièrement. Couper une image en patches de taille fixe, projeter linéairement chaque patch dans une intégration, alimenter la séquence à un encodeur transformateur de vanille. À une échelle suffisante (ImageNet-21k pré-entraînement ou plus grande), ViT correspond ou bat les modèles basés sur ResNet.

ViT a été le début d'un modèle plus large en 2026: une architecture, de nombreuses modalités. Whisper symbolise l'audio. ViT symbolise les images. Tokens d'action pour la robotique. Tokens de pixels pour la vidéo. Le transformateur ne se soucie pas  alimente une séquence et il apprend.

En 2026, ViT et ses descendants (DeiT, Swin, DINOv2, ViT-22B, SAM 3) possèdent la plupart de la vision. Les CNN gagnent toujours sur les appareils de bord et les tâches sensibles à la latence. Tout le reste a un ViT quelque part dans la pile.

## Le concept

![Image → patches → tokens → transformer](../assets/vit.svg)

### Étape 1  patch

Partagez un`H × W × C`image dans une `N × (P·P·C)`séquence de patchs plats. configuration typique: `224 × 224`image, `16 × 16`Les correctifs → 196 correctifs de 768 valeurs chacun.

```
image (224, 224, 3) → 14 × 14 grid of 16x16x3 patches → 196 vectors of length 768
```

Les patches plus petites = plus de jetons, meilleure résolution, coût d'attention quadratique.

### Étape 2  intégration linéaire

Une seule matrice apprise projette chaque plateau plat à `d_model`. Équivalent à une convolutions de taille du noyau `P`et de faire des pas.`P`En PyTorch , c' est littéralement`nn.Conv2d(C, d_model, kernel_size=P, stride=P)` une mise en œuvre en deux lignes.

### Étape 3  préparation `[CLS]`- les symboles, ajouter des emplacements positionnels

- Préparez un apprenant`[CLS]`Son dernier état caché est la représentation d'image utilisée pour la classification.
- Ajouter des embellissements positionnels apprenables (originaux ViT) ou sinusoïdal 2D (variantes ultérieures).
- En 2024+ RoPE étendu à 2D pour la position, parfois sans intégrations explicites.

### Étape 4  encodeur de transformateur standard

L' épaisseur de blocs de `LayerNorm → Self-Attention → + → LayerNorm → MLP → +`- Identique au BERT. Aucune couche spécifique à la vision.

### Étape 5 - tête

Pour la classification: prenez `[CLS]`L'état caché → linéaire → softmax. pour DINOv2 ou SAM, rejeter `[CLS]`, utilisez directement les inserts de patch.

### Les variantes qui comptent

| Model | Year | Change |
|-------|------|--------|
| ViT | 2020 | The original. Fixed patch size, full global attention. |
| DeiT | 2021 | Distillation; trainable on ImageNet-1k only. |
| Swin | 2021 | Hierarchical with shifted windows. Fixed sub-quadratic cost. |
| DINOv2 | 2023 | Self-supervised (no labels). Best general vision features. |
| ViT-22B | 2023 | 22B params; scaling laws apply. |
| SigLIP | 2023 | ViT + language pair, sigmoid contrastive loss. |
| SAM 3 | 2025 | Segment anything; ViT-Large + promptable mask decoder. |

### Pourquoi ça a pris du temps ?

ViT a besoin de beaucoup de données pour correspondre aux CNN parce qu'il n'a aucun des biais inductifs de CNN (invariance de traduction, localité). Sans images étiquetées de > 100M ou une pré-entraînement auto-supervisée forte, les CNN gagnent toujours au calcul correspondant. DeiT a corrigé cela en 2021 avec des astuces de distillation; DINOv2 l'a corrigé de façon permanente en 2023 avec l'auto-supervision.

```figure
n5-patch-stream
```

## Faites-le

Regardez !`code/main.py`- La mise en place de patch-stdlib + intégration linéaire + contrôle de santé mentale.

### Étape 1: image fausse

Une image RGB 24 × 24 en tant que liste de lignes de `(R, G, B)`Nous utilisons 6×6 patches → 16 patches, 108-d intégrant vecteur chacun.

### Étape 2: patch

```python
def patchify(image, P):
    H = len(image)
    W = len(image[0])
    patches = []
    for i in range(0, H, P):
        for j in range(0, W, P):
            patch = []
            for di in range(P):
                for dj in range(P):
                    patch.extend(image[i + di][j + dj])
            patches.append(patch)
    return patches
```

L'ordre des races: rang principal sur la grille.

### Étape 3: intégration linéaire

Multipliez chaque plaque par un nombre aléatoire `(patch_flat_size, d_model)`la matrice. Vérifiez que la forme de sortie est `(N_patches + 1, d_model)`après la préparation `[CLS]`- Je suis désolé .

### Étape 4: comptez les paramètres pour un ViT réaliste

Imprimez le nombre de paramètres pour ViT-Base: 12 couches, 12 têtes, d = 768, patch = 16.

## Utilisez-le

```python
from transformers import ViTImageProcessor, ViTModel
import torch
from PIL import Image

processor = ViTImageProcessor.from_pretrained("google/vit-base-patch16-224-in21k")
model = ViTModel.from_pretrained("google/vit-base-patch16-224-in21k")

img = Image.open("cat.jpg")
inputs = processor(img, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, 197, 768): [CLS] + 196 patches
cls_emb = out[:, 0]                       # image representation
```

**DINOv2 embeddings are the 2026 default for image features.**La colonne vertébrale est gelée, la tête est entraînée, elle fonctionne pour la classification, la récupération, la détection, la sous-titration, les points de contrôle DINOv2 de Meta dépassent CLIP sur toutes les tâches de vision non textuelle.

**Patch-size picking.**Les modèles plus petits utilisent 16×16 (ViT-B/16). La prédiction dense (segmentation) utilise 8×8 ou 14×14 (SAM, DINOv2).

## La faire partir

Regardez !`outputs/skill-vit-configurator.md`. La compétence choisit une variante ViT et une taille de patch pour une nouvelle tâche de vision compte tenu de la taille, de la résolution et du budget de calcul du jeu de données.

## Exercices

1. **Easy.**On court .`code/main.py`- Vérifiez que le nombre de patchs est égal .`(H/P) * (W/P)`et la dimension de la plaque plate est égale `P*P*C`- Je suis désolé .
2. **Medium.**Implementer des embellissements positionnels sinusoïdes 2D  deux codes sinusoïdes indépendants pour `row`et `col`Envoyez-les dans un petit PyTorch ViT et comparez la précision par rapport aux emblèmes positionnels appréciables sur CIFAR-10.
3. **Hard.**Construisez un ViT (PyTorch) à 3 couches, entraînez sur 1000 images MNIST avec des correctifs 4×4. Mesurez la précision du test. Ajoutez maintenant DINOv2 pré-entraînement sur les mêmes 1000 images (simplifié: entraînez simplement le codeur pour prédire les emplacements de correctifs à partir de correctifs masqués).

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Patch | "The vision-transformer token" | Flat vector of pixel values for a `P × P × C` region of the image. |
| Patchify | "Chop + flatten" | Slice image into non-overlapping patches, flatten each to a vector. |
| `[CLS]` token | "The image summary" | Prepended learnable token; its final embedding is the image representation. |
| Inductive bias | "What the model assumes" | ViT has fewer priors than CNNs; needs more data to make up the gap. |
| DINOv2 | "Self-supervised ViT" | Trained without labels using image augmentation + momentum teacher. Best general image features in 2026. |
| SigLIP | "CLIP's successor" | ViT + text encoder trained with sigmoid contrastive loss; better than CLIP on matched compute. |
| Swin | "Windowed ViT" | Hierarchical ViT with local attention + shifted windows; sub-quadratic. |
| Register tokens | "2023 trick" | A few extra learnable tokens that soak up attention sinks; improves DINOv2 features. |

## Pour en savoir plus

- [Dosovitskiy et al. (2020). An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale](https://arxiv.org/abs/2010.11929)- Le papier de la ViT.
- [Touvron et al. (2021). Training data-efficient image transformers & distillation through attention](https://arxiv.org/abs/2012.12877)- Je ne sais pas.
- [Liu et al. (2021). Swin Transformer: Hierarchical Vision Transformer using Shifted Windows](https://arxiv.org/abs/2103.14030)- Je suis en train de faire un tour.
- [Oquab et al. (2023). DINOv2: Learning Robust Visual Features without Supervision](https://arxiv.org/abs/2304.07193)- DINOv2.
- [Darcet et al. (2023). Vision Transformers Need Registers](https://arxiv.org/abs/2309.16588) la fixation du code de registre pour DINOv2.
