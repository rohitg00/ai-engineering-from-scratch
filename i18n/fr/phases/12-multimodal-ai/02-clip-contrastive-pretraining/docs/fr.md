# CLIP et formation en langage de vision contrasté

> Le CLIP d'OpenAI (2021) a prouvé une idée suffisamment grande pour alimenter les cinq prochaines années: aligner un encodeur d'image et un encodeur de texte dans le même espace vectoriel en utilisant uniquement des paires bruyantes de sous-titres d'image Web et une perte de contraste. Zéro étiquette supervisée. 400 millions de paires. L'espace d'intégration résultant fait une classification à zéro coup, une récupération d'image-texte et se connecte à chaque VLM en 2026 comme sa tour de vision. SigLIP 2 (2025) a remplacé softmax par sigmoid et a été supprimé par CLIP à moindre coût. Cette leçon passe les maths de InfoNCE à la perte par paire sigmoid et construit l'étape d'entraînement en stdlib Python.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, InfoNCE + sigmoid loss implementations)
**Prerequisites:** Phase 12 · 01 (ViT patches), Phase 7 (Transformers)
**Time:** ~180 minutes

## Objectifs d'apprentissage

- Dériver la perte d'InfoNCE à partir d'informations mutuelles et mettre en œuvre une version vectoriée numériquement stable.
- Expliquez pourquoi la perte par paire sigmoïde (SigLIP) s'élève à 32768+ sans les exigences de la charge générale de la douceur max.
- Exécuter la classification ImageNet à tirage nul en construisant des modèles de texte (`a photo of a {class}`) et de prendre argmax par rapport à la similitude cosine.
- Nommez les quatre leviers que vous donne la pré-entraînement CLIP / SigLIP: taille de lot, température, modèle de demande, qualité des données.

## Le problème

La vision pré-CLIP était supervisée. Collectez des ensembles de données étiquetés (ImageNet: 1.2M images, 1000 classes), entraînez une CNN, expédez-la. Les étiquettes sont chères, les étiquettes sont biaisées à ce que les étiquetteurs peuvent se mettre d'accord sur, et les étiquettes ne sont pas transférées à de nouvelles tâches sans ajustement.

Le site Web de sous-titres d'images dispose gratuitement de plus d'un milliard de paires étiquetées librement. Une photo d'un retriever doré avec un texte alternatif " mon chien Max dans le parc " porte un signal de surveillance  le texte décrit l'image.

La réponse de CLIP: traiter les paires d'images-titres comme une tâche correspondante. Compte tenu d'un lot d'images N et de titres N, apprenez à correspondre chaque image à sa propre légende contre les distracteurs N-1. La supervision est " ces deux choses appartiennent ensemble; ces N-1 ne le font pas. " Aucune étiquette de classe. Aucune annotation humaine.

L'espace d'embedding résultant fait plus que CLIP a été formé pour. ImageNet fonctionne à zéro tir parce que "une photo d'un chat" est intégrée à proximité d'images de chats qui n'ont jamais été explicitement étiquetés chats. C'est le pari qui a engendré chaque 2026 VLM.

## Le concept

### Le double encodeur

CLIP a deux tours:

- Encodeur d' image `f`: ViT ou ResNet, produit un vecteur D-dim par image.
- Encodeur de texte `g`: petit transformateur, produit un vecteur D-dim par sous-titre.

Les deux tours normalisent leurs sorties à la longueur d'unité.`cos(f(x), g(y)) = f(x)^T g(y)`puisque les deux sont la norme de l'unité.

Pour un lot de $N$(image, sous-titre) paires, construire la matrice de similitude `S`de forme `(N, N)`- Le numéro de la liste:

```math
S[i, j] = \cos(f(x_i), g(y_j)) / \tau
```

où `tau`est une température apprise (CLIP s'initialise à 0,07; apprise dans l'espace log).

### Perte de l'infoNCE

CLIP utilise une entropie croisée symétrique sur les lignes et les colonnes:

```
loss_i2t = CE(S, labels=identity)     # each image's positive is its own caption
loss_t2i = CE(S^T, labels=identity)   # each caption's positive is its own image
loss = (loss_i2t + loss_t2i) / 2
```

Le softmax de la CE force chaque image à correspondre à sa légende plus que toutes les autres légendes du lot. Les " négatifs " sont tous les autres articles du lot.

### Température

`tau`La température de la douceur maximale est réduite.$\tau$→ une distribution nette, un effet minéral négatif dur.$\tau$→ doux, tous les échantillons contribuent.$\log(1/\tau)$SigLIP 2 répare l' initiel$\tau$et utilise un biais appris à la place.

### Pourquoi les sigmoïdes sont mieux étalés (SigLIP)

Softmax a besoin de la matrice de similitude entière en synchronisation. Dans la formation distribuée, vous devez rassembler tous les intégrations à chaque réplique, puis faire le softmax.

SigLIP remplace softmax par un sigmoïde à base d' éléments: pour chaque paire `(i, j)`, la perte est une classification binaire de "sont-ce la paire correspondante?" les étiquettes de classe positive sont la diagonale, tout le reste est négatif.

```math
L = -\frac{1}{N} \sum_{(i, j)} \Big[ y_{ij} \log \mathop{\mathrm{sigmoid}}(S[i,j]) + (1-y_{ij}) \log \mathop{\mathrm{sigmoid}}(-S[i,j]) \Big]
```

`y_ij = 1`si `i == j`Chaque GPU calcule son bloc local et ses sommes. SigLIP 2 évolue à 32k-512k à moindre coût où CLIP aurait besoin d'une communication proportionnelle plus grande.

### Classification à tir zéro

En fonction des noms de classes N, construire un modèle de texte pour chaque classe:

```
"a photo of a {class}"
```

Embed chaque modèle avec le codeur de texte. Embed votre image avec le codeur d'image. Argmax cosine similarité = classe prévue. Aucune formation sur les classes cibles.

Les modèles rapides sont importants. Le papier original de CLIP utilisait 80 modèles par classe (plain, artistique, photo, peinture, etc.) et comptait en moyenne les emblèmes. +3 points ImageNet. L'utilisation moderne choisit généralement un ou deux modèles.

### Sondes linéaires et réglages fin

La mise à jour est une ligne de base. Une sonde linéaire (traîne une couche linéaire sur les fonctionnalités CLIP gelées pour vos classes cibles) bat la mise à jour zéro sur les tâches dans le domaine.

### SigLIP 2: NaFlex et caractéristiques denses

SigLIP 2 (2025) ajoute:
- NaFlex: un modèle unique gère des ratios d'aspect et des résolutions variables.
- Meilleures caractéristiques denses pour la segmentation et l'estimation de la profondeur, ciblant l'utilisation comme colonne vertébrale gelée dans les VLM.
- Multilingue: formé à plus de 100 langues où le CLIP était uniquement anglais.
- 1B paramétrage où CLIP a atteint le sommet à 400M.

En 2026 VLMs ouverts, SigLIP 2 SO400m/14 est la tour de vision par défaut. CLIP reste la norme par défaut pour la récupération de texte d'image pure où la distribution de formation spécifique LAION-2B correspond à votre modèle de requête.

### Les produits de base sont les produits de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de base de

ALIGN (Google, 2021): la même idée que CLIP, 1,8B paire d'échelle, 90% bruyant. Évalué de la taille bruyante des données. OpenCLIP (LAION): reproduction ouverte de CLIP sur LAION-400M / 2B, échelles multiples, le point de contrôle aller à ouvrir. EVA-CLIP: initializes à partir de la modélisation d'images masquées; forte colonne vertébrale pour VLMs. BASIC: Google CLIP+ALIGN hybride. Toutes la même famille, différentes données et réglage.

### Le plafond de tir zéro

Les modèles CLIP classent environ 76% de capture zéro ImageNet (CLIP-G, OpenCLIP-G). Au-delà nécessite soit des données beaucoup plus grandes (SigLIP 2 obtient 80% +) ou des changements d'architecture (têtes supervisées, plus de paramètres).

```figure
multimodal-fusion
```

## Utilisez-le

`code/main.py`les implémentations:

1. Un codeur à double encodeur de jouets (fonctionnalités d'image basées sur des hashtags, fonctions de graphiques de texte) afin que vous puissiez voir la forme InfoNCE sans numpy.
2. Perte de l'infoNCE dans le Python pur (stabilité numérique par log-sum-exp).
3. Perte par paire sigmoïde pour comparaison.
4. Une routine de classification à tir zéro: calculer la similitude cosine contre un ensemble de textes, argmax pour la prédiction.

Les chiffres absolus sont des jouets, la forme correspond à ce qu'un véritable entraîneur CLIP émet.

## La faire partir

Cette leçon produit `outputs/skill-clip-zero-shot.md`. Compte tenu d'un ensemble d'images (via chemin) et d'une liste de classes cibles, il crée des invites de texte avec le modèle CLIP, intègre les deux côtés avec un point de contrôle indiqué (p. ex., `openai/clip-vit-large-patch14`La compétence refuse de faire des revendications sur les classes qui ne figurent pas dans la liste de réponse.

## Exercices

1. Implémenter InfoNCE pour un lot de 4 paires à la main. Construire la matrice de similitude 4x4, exécuter softmax, choisir la diagonale, calculer l'entropie croisée. Vérifiez votre Python mise en œuvre contre ce calcul à la main.

2. SigLIP utilise un paramètre de biais `b`en plus de la température: `S'[i,j] = S[i,j]/tau + b`Quel rôle ?`b`Les résultats de la recherche ont été analysés dans le cadre de la recherche sur les résultats de la recherche.

3. Construisez un classifiateur de cats contre chiens.`a photo of a {class}`et `a picture of a {class}`- Mesurer la précision sur 100 images de test.

4. Comptez le coût de communication de softmax InfoNCE vs sigmoid par paire pour une course à 512 GPU à 32k lot.$O(N)$, qui comme $O(N^2)$Citez la section 4 du Siglip.

5. Lisez le document OpenCLIP sur les lois d'échelle (arXiv:2212.07143, Cherti et al.).

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| InfoNCE | "Contrastive loss" | Cross-entropy over a batch's similarity matrix; each item's positive is its paired item, negatives are everything else |
| Sigmoid loss | "SigLIP loss" | Per-pair binary cross-entropy; no softmax, no all-gather, scales cheaply in distributed training |
| Temperature | "tau" | Scalar that scales logits before softmax/sigmoid; controls sharpness of the distribution |
| Zero-shot | "no-finetune classification" | Use text prompts to construct class embeddings and classify by cosine similarity; no training on target classes |
| Prompt template | "a photo of a ..." | Text scaffold around a class name; affects zero-shot accuracy by 1-5 points |
| Dual encoder | "Two-tower" | One image encoder + one text encoder, outputs in shared D-dim space |
| Hard negative | "Tough distractor" | A negative similar enough to the positive that the model has to work to separate them |
| Linear probe | "Frozen + one layer" | Train only a linear classifier on top of frozen features; measures feature quality |
| NaFlex | "Native flexible resolution" | SigLIP 2 capability to ingest images at any aspect ratio and resolution without resizing |
| Temperature scaling | "log-parametrized tau" | CLIP parametrizes `log(1/tau)` so gradients behave; clips to prevent collapse to near-zero tau |

## Pour en savoir plus

- [Radford et al. — Learning Transferable Visual Models From Natural Language Supervision (arXiv:2103.00020)](https://arxiv.org/abs/2103.00020) le document CLIP.
- [Zhai et al. — Sigmoid Loss for Language Image Pre-Training (arXiv:2303.15343)](https://arxiv.org/abs/2303.15343) SigLIP.
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) multilingue + NaFlex.
- [Jia et al. — ALIGN (arXiv:2102.05918)](https://arxiv.org/abs/2102.05918) étaler avec des données web bruyantes.
- [Cherti et al. — Reproducible scaling laws for contrastive language-image learning (arXiv:2212.07143)](https://arxiv.org/abs/2212.07143) Loi sur l'élargissement de l'OpenCLIP.
