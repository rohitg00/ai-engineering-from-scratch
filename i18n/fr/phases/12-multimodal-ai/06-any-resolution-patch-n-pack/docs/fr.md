# Vue à toute résolution: patch-n'-pack et NaFlex

> Les images réelles ne sont pas 224x224 carrés. Un reçu est 1: 3, un graphique est 16: 9, une analyse médicale peut être 4096x4096, une capture d'écran mobile est 9:19.5. La réponse VLM pré-2024  redimensionner tout à un carré fixe  a jeté le signal qui rend OCR, compréhension de documents et analyse de scène haute résolution fonctionnant. NaViT (Google, 2023) a montré que vous pouviez emballer des correctifs à résolution variable dans un seul lot de transformateur avec un masque de bloc-diagonale. Le M-RoPE (2024) de Qwen2-VL a complètement abandonné les tables de position absolue. L'AnyRes de LLaVA-NeXT a plaqué des images haute résolution dans une base + sous-images. La variante NaFlex de SigLIP 2 (2025) est maintenant l'encodeur par défaut pour les VLM ouverts qui veulent un seul point de contrôle pour servir chaque ratio d'aspect. Cette leçon met en œuvre le patch-n'-pack de bout en bout.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, patch packer + block-diagonal mask)
**Prerequisites:** Phase 12 · 01 (ViT patches), Phase 12 · 05 (LLaVA)
**Time:** ~120 minutes

## Objectifs d'apprentissage

- Emballez des patchs d'un lot d'images à résolution variable dans une séquence et construisez le masque d'attention à diagonale de bloc.
- Choisissez entre AnyRes (LLaVA-NeXT), NaFlex (SigLIP 2) et M-RoPE (Qwen2-VL) pour une tâche donnée.
- Comptez les budgets de jetons pour le RCR, les graphiques et la photographie sans redimensionner.
- Nombre des trois modes d'échec de la taille carrée: texte écrasé, contenu coupé, jetons gaspillés sur le rembourrage.

## Le problème

Les transformateurs s'attendent à une séquence. Un lot est une pile de séquences de la même longueur. Si vos images sont 224x224, vous obtenez 196 jetons de patch à chaque fois, le rembourrage n'est pas nécessaire, le travail est fait. Train sur 224, inférer sur 224, ne jamais penser à la résolution à nouveau.

Les documents sont portraits (8,5x11 pouces, 2:3-ish). Les captures d'écran des graphiques sont paysages (16:9). Les reçus sont hauts et fins (1:3). Les navires d'imagerie médicale à 2048x2048 ou plus. Les captures d'écran des appareils mobiles sont 1170x2532 (0,46:1).

Trois options pré-2024 et pourquoi chacune échoue:

1. La taille est réduite à un carré fixe (224x224 ou 336x336). Le squish déforme le texte et les visages.
2. On jette la plupart de l'image, et choisir l'emplacement de la culture est son propre problème de vision.
3. Le pad sur le côté le plus long. Réglectionne la distorsion mais gaspille plus de 50% des jetons sur le rembourrage pour les images de portrait. Coût d'attention quadratique sur tous ces jetons de pad.

La réponse 2024-2025: laissez le transformateur manger des patchs à la résolution native de l'image, et de trouver comment emballer un lot hétérogène dans une séquence sans gaspiller de calcul.

## Le concept

### NaViT et le patch-n'-pack

NaViT (Dehghani et coll., 2023) a été le document qui a montré que cela fonctionne à grande échelle.

1. Pour chaque image du lot, calculer sa grille de patch native à une taille de patch choisie (disons 14).
2. Appliquer les patchs de chaque image dans sa propre séquence de longueur variable.
3. Concaténez tous les patchs d'images en une longue séquence pour le lot.
4. Construisez un masque d'attention à diagonale de bloc afin que les patchs de l'image A ne se trouvent que dans l'image A.
5. Les informations relatives à la position par patch (enregistrements RoPE ou position fractionnelle) doivent être portées.

Un lot de trois images à 336x336 (576 jetons), 224x224 (256 jetons) et 448x336 (768 jetons) devient une séquence de 1600 jetons avec un masque de bloc-diagon 1600x1600. Pas de rembourrage. Pas de calcul gaspillé. Le transformateur gère des ratios d'aspect arbitraires.

NaViT a également introduit la chute fractionnelle de patch pendant l'entraînement  la chute de 50% des patches au hasard dans le lot  qui régularise et accélère l'entraînement. SigLIP 2 a hérité de cela.

### Les produits de la catégorie "récipients"

L'AnyRes de LLaVA-NeXT est l'alternative pragmatique.

1. Choisissez une mise en page de la grille d'un ensemble prédéfini  (1x1), (1x2), (2x1), (1x3), (3x1), (2x2), etc.  qui correspond le mieux au rapport d'aspect de l'image.
2. Tire l'image complète dans la grille; chaque carreaux devient une culture de 336x336.
3. Produisez également une miniature: l'image entière est redimensionnée à 336x336 comme un jeton de contexte global.
4. Encodez chaque carreaux à travers le codeur gelé 336. Concatenez les jetons de carreaux + jetons miniatures.

Pour une image 672x672 à la grille 2x2 plus une miniature: 4 * 576 + 576 = 2880 jetons visuels.

AnyRes est la voie de choix lorsque votre encodeur est gelé et ne prend en charge qu'une seule résolution. Il exploite le nombre de jetons pour les grandes images (une image de 1344x1344 à la grille 4x4 est de 9216 + 576 ≈ 9800 jetons, qui dépasse un contexte LLM de 8k avant l'arrivée de tout texte).

### Le produit est le produit de l'équipement de la production de l'équipement.

Qwen2-VL a introduit l'intégration de position rotative multimodal. Au lieu des positions fractionnelles de NaViT ou de la carreaux et miniatures d'AnyRes, chaque patch porte une position 3D (temporale, hauteur, largeur).

M-RoPE envoie une résolution dynamique native sans recyclage. À l'inférence, vous nourrissez une image HxW, le patch embedder produit des jetons H/14 x W/14, chaque jeton obtient sa position (t=0, r=row, c=col), le RoPE fait tourner l'attention avec les bonnes fréquences, fait. Qwen2.5-VL et Qwen3-VL continuent ainsi.

Contrairement à AnyRes, M-RoPE est $O(H \times W / P^2)$Les jetons à résolution native  pas de charge de carreaux multiplicative. contrairement à NaViT, il s'attend toujours à une seule image par transfert.

### Le produit est le NaFlex (SigLIP 2)

NaFlex est le mode native-flex du point de contrôle SigLIP 2. Un seul modèle sert plusieurs longueurs de séquences (256, 729, 1024 jetons) à l'inférence.

Pour une tâche sémantique (classification, récupération), 256 jetons. Pour OCR ou compréhension de graphique, 1024 jetons. Pas de recyclage.

### Le masque d'emballage

Le masque de bloc-diagonale est le point où la plupart des implémentations trébuchent.`N_total`couverture d'images `i=0..B-1`avec des longueurs `n_i`, le masque `M`de forme `(N_total, N_total)`est 1 si les deux indices tombent dans le même bloc d'image, sinon 0. Vous pouvez le construire à partir d'une liste de longueur cumulée:

```
offsets = [0, n_0, n_0+n_1, ..., N_total]
M[i, j] = 1 iff there exists b where offsets[b] <= i < offsets[b+1] and offsets[b] <= j < offsets[b+1]
```

C' est une ligne dans PyTorch avec `torch.block_diag`La trajectoire de longueur variable de FlashAttention (`cu_seqlens`) saute entièrement le masque et se présente en séquences en utilisant directement le tensor de longueur cumulée  ~ 10 fois plus rapidement qu'un masque dense pour les lots typiques.

### Budgets des jetons

Choisissez votre stratégie par tâche:

- OCR / documents: 1024-4096 jetons. SigLIP 2 NaFlex à 1024, ou AnyRes 3x3 + miniature.
- Charts et interface utilisateur: 729-1024 jetons à 384-448 natifs. résolution dynamique Qwen2.5VL avec cap de pixels max.
- Les photos naturelles: 256-576 jetons sont bons. Le LLM en aval voit assez.
- Vidéo: 64 à 128 jetons par image après le regroupement spatial, 2 à 8 FPS.

La règle de production 2026: choisir un capot max-pixels par tâche, encoder à la proportion d'aspect native jusqu'à ce capot, emballer le lot, et sauter le rembourrage.`min_pixels`et `max_pixels`Pour ce bouton.

```figure
mm-patch-n-pack
```

## Utilisez-le

`code/main.py`Il implémentera le patch-n'-pack pour un lot hétérogène d'images avec des coordonnées de pixel entiers.

- Prend une liste des tailles d'image (H, W).
- Calcule la longueur de la séquence de patch de chaque image à la taille de patch 14.
- Les emballer en une séquence de longueur totale `sum(n_i)`- Je suis désolé .
- Construit le masque d'attention à diagonale de bloc (dense, pour clarté).
- Comparer le coût de l'emballage par rapport à la taille carrée et à la tôle AnyRes.
- Imprime un tableau de budget symbolique pour un lot mixte (receipt, graphique, capture d'écran, photo).

Les chiffres qui tombent sont la raison pour laquelle chaque VLM ouvert en 2026 utilise un patch-n'-pack.

## La faire partir

Cette leçon produit `outputs/skill-resolution-budget-planner.md`. Compte tenu d'une charge de travail à rapport d'aspect mixte (OCR, graphiques, photos, images vidéo) et d'un budget total de jetons, il choisit la bonne stratégie (NaFlex, AnyRes, M-RoPE ou quadré fixe) et émet une configuration par demande.

## Exercices

1. Un reçu est 600x1500 (1:2.5). À la taille du patch 14, combien de jetons à résolution native? combien après la taille carrée à 336? Qui perd plus de précision OCR en pratique?

2. Construisez le masque de bloc-diagonale pour un lot de quatre images de longueur 256, 576, 729, 1024.`256^2 + 576^2 + 729^2 + 1024^2`les entrées non zéroes.

3. Pour une image 1792x896 au patch 14, comparez: (a) quadratiser à 336 puis encoder, (b) AnyRes 2x1 + miniature, (c) M-RoPE à native.

4. Mettre en œuvre la chute de patch fractionnée: compte tenu d'une séquence emballée, déposez 50% des jetons de manière uniforme au hasard et mettez à jour le masque de bloc-diagonale en conséquence. Mesurer la variation de la rareté du masque.

5. Lisez la section 3.2 du document Qwen2-VL (arXiv:2409.12191). Décrivez en deux phrases ce qui est`min_pixels`et `max_pixels`le contrôle et pourquoi les deux limites comptent.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Patch-n'-pack | "NaViT-style packing" | Concatenate variable-length patch sequences from different images into one batch dimension |
| Block-diagonal mask | "Packing mask" | Attention mask that confines each image's patches to attend only to themselves, not neighbors in the pack |
| AnyRes | "LLaVA-NeXT tiling" | Split a high-res image into a grid of fixed-size tiles plus a global thumbnail; encode every tile with a fixed encoder |
| NaFlex | "SigLIP 2 native-flex" | Single SigLIP 2 checkpoint that serves 256/729/1024-token budgets at inference without retraining |
| M-RoPE | "Multimodal RoPE" | 3D rotary position encoding (time, row, column) that handles arbitrary H, W, T without position tables |
| cu_seqlens | "FlashAttention packing" | Cumulative-length tensor the FlashAttention varlen path uses instead of a dense block-diagonal mask |
| min_pixels / max_pixels | "Resolution bounds" | Qwen2.5-VL per-request knobs capping token count on very small or very large inputs |
| Visual token budget | "How many tokens per image" | Rough count of patch tokens emitted per image; sets the LLM's prompt budget and attention cost |

## Pour en savoir plus

- [Dehghani et al. — Patch n' Pack: NaViT (arXiv:2307.06304)](https://arxiv.org/abs/2307.06304)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Laurençon et al. — What matters when building vision-language models? (Idefics2, arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
