# LLaVA-OneVision: image unique, image multi, vidéo dans un modèle

> Avant LLaVA-OneVision (Li et coll., août 2024) le monde VLM ouvert avait des lignées distinctes: LLaVA-1.5 pour les images uniques, les modèles multi-image comme Mantis et VILA, les modèles vidéo comme Video-LLaVA et Video-LLaMA. Chacun a remporté sa référence et échoué aux autres. LLaVA-OneVision a soutenu qu'un seul programme d'études pouvait former un modèle pour dominer les trois scénarios, et que les effets émergents de transfert de tâches (habiletés de l'image unique exportées vers la vidéo, raisonnement multi-image exporté vers l'image unique) ont dépassé la somme des spécialistes. La recette est trompeusement simple: un budget de jeton visuel équilibré entre les scénarios, plus un programme explicite qui passe d'une seule image à OneVision (multi-image) à la vidéo. Cette leçon est consacrée au budget, au programme et aux comportements émergents.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, token budget solver + curriculum planner)
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 12 · 06 (any-resolution)
**Time:** ~180 minutes

## Objectifs d'apprentissage

- Conçuez un budget de jeton visuel qui reste équilibré sur les entrées d'image unique, multi-image et vidéo.
- Commandez un programme de formation qui transforme les compétences d'une seule image en vidéo sans oublier catastrophiquement.
- Expliquez pourquoi un modèle unique dépasse les spécialistes du même nombre de paramètres lorsqu'un programme est bien fait.
- Nombre des trois capacités émergentes rapportées par LLaVA-OneVision: le raisonnement multi-caméras, l'interrogatoire de marque, l'agent de capture d'écran de l'iPhone.

## Le problème

L'image, la vidéo et la vidéo mettent chaque modèle en valeur différemment.

Une image unique nécessite des jetons haute résolution (AnyRes, ~ 2880 jetons visuels) pour capturer OCR et les détails fins.

Multi-image veut plusieurs images à résolution modérée (~ 576 jetons chacun) de sorte que le raisonnement entre les images s'inscrit dans le contexte.

La vidéo a besoin de plusieurs images à faible résolution (~ 196 jetons par image après la mise en commun) pour capturer la dynamique temporelle.

Si vous entraînez des modèles séparés, vous choisissez un budget. Si vous entraînez un modèle, vous avez besoin du budget pour échanger raisonnablement entre les scénarios sans percer de contexte.

Avant OneVision, la réponse par défaut était "traînez un scénario, ignorez les autres". Video-LLaVA a retrofitté la vidéo sur un modèle d'image avec des étapes d'entraînement supplémentaires. LLaVA-NeXT a ajouté une prise en charge multi-image avec des carreaux. Aucun n'a géré les trois correctement.

## Le concept

### Le budget des jetons OneVision

LLaVA-OneVision ne fixe pas un nombre exact de jetons. Il équilibre le nombre maximum de jetons visuels par échantillon de sorte que les trois scénarios se trouvent dans la même plage, environ 6 000 à 9 000 jetons, alloués différemment par scénario:

- Image unique: AnyRes-Max-9 (jusqu'à 9 tuiles + une vue de base), chaque vue 384x384 donnant 729 jetons de SigLIP SO400M. Maximum: 729 * (1 + 9) = 7290 jetons.
- Multi-image: chaque image à 384 sans carrelage, 729 jetons sans pooling. Jusqu'à 12 images → 8748 jetons.
- Vidéo: jusqu'à 32 images à 384 avec un pooling bilinéaire 2x2 → 196 jetons par image.

L'allocation maintient les totaux maximaux dans la même bande, de sorte qu'aucun scénario ne domine le contexte ou le gradient.`code/main.py`Le planificateur ci-dessous utilise un budget de jouets plus petit de 4096 pour montrer la même logique d'équilibrage.

### Le programme en trois étapes

Les trains LLaVA-OneVision sont organisés en trois étapes:

1. SFT d'image unique (étape SI). Toutes les données sont d'image unique plus de texte.
2. OneVision SFT (étape OV). Mix d'une seule image + de plusieurs images + vidéo (cadres échantillonnés de manière uniforme). entraînez le budget de jeton unifié. Cela enseigne au modèle à gérer des formes de lot hétérogènes. Aucun réinitialisation de poids  ne se poursuit à partir de l'étape SI.
3. Transfert de tâches (étape TT). Continuez avec un mix de tâches cibles, généralement plus lourd sur plusieurs images ou vidéos selon le produit.

Le programme de formation vidéo-première ou multi-image-première produit de pires performances d'image que la première image-unique, même avec les mêmes données.

### Pourquoi le programme fonctionne

La formation en image unique construit la base perceptuelle. Les jetons de patch comportent des caractéristiques visuelles fines; le LLM apprend à les intégrer avec le texte.

Si vous entraînez tous les scénarios à partir de zéro ensemble, le modèle est inférieur à la perception (données limitées d'une seule image par lot) et à la structure des surdits (beaucoup de données multiculturelles / vidéo).

L'ordre du programme vous donne une force de perception à partir de l'étape SI, puis un raisonnement compositif/temporal à partir de l'étape OV, sans perdre aucun.

### Des compétences émergentes en matière de scénarios croisés

Le document LLaVA-OneVision rapporte trois capacités émergentes:

1. Le modèle intègre correctement les vues malgré le fait de ne jamais avoir vu ce format exact en formation.
2. L'utilisateur annotera les objets d'une image avec des marques numérotées; le modèle explique ce que fait la marque 3 par rapport à la marque 7.
3. L'utilisateur fournit une capture d'écran d'un écran de l'iPhone et demande de planifier le prochain clic.

Il ne s'agit pas de tâches formées; elles émergent de la structure compositive du programme.

### Le regroupement des jetons visuels

Le budget des jetons nécessite un regroupement. OneVision utilise une interpolation bilinéaire sur la grille de correctifs 2D: 24x24 = 576 patches devient 12x12 = 144 (2x facteur) ou 8x8 = 64 (3x facteur).

Le choix du facteur de pooling par scénario est lui-même un hyperparamètre. Moins de pooling = plus de jetons = représentation plus riche.

### LLaVA-OneVision-1.5

Le suivi de 2025 (LLaVA-OneVision-1.5, arXiv 2509.23661) est " complètement ouvert " dans les données de formation, les poids des modèles et le code. Il correspond à la lacune de propriété sur certains critères de référence et démocratise la recette.

### Contraste avec Qwen2.5-VL

Qwen2.5-VL (Létion 12.09) fait des choix différents. Il utilise M-RoPE et FPS dynamique au lieu de pooling fixe. Ses balances budgétaires avec entrée  une vidéo de 1 minute utilise plus de jetons qu'une vidéo de 5 secondes. LLaVA-OneVision fixe le budget et évolue le pooling.

```figure
l5-onevision-budget
```

## Utilisez-le

`code/main.py`Il est un programme et un planificateur budgétaire pour un VLM de style OneVision.

- Alloque la résolution, le facteur de pooling et les cadres par scénario.
- Vérifie que chaque scénario s'inscrit dans le budget partagé.
- Les rapports indiquent le nombre de jetons attendu, les FLOP de LLM et les scénarios sous-tokenés.
- Imprime un programme d'entraînement étape par étape.

Utilisez-le pour planifier une mise à jour de OneVision ou pour vérifier le coût par demande d'un déploiement VLM.

## La faire partir

Cette leçon produit `outputs/skill-onevision-budget-planner.md`. Compte tenu d'une répartition des tâches cibles et d'un budget par échantillon, il émet le facteur AnyRes, le regroupement par cadre, le nombre de images vidéo et les poids des étapes du programme.

## Exercices

1. Votre produit prend en charge 80% d'images uniques, 10% de plusieurs images (2-4 images), 10% de vidéos (8-16 images). Concevez le budget des jetons.

2. Lire la section 4.3 de LLaVA-OneVision (capacités émergentes). Proposer une quatrième compétence émergente que le programme pourrait probablement débloquer mais que le journal n'a pas rapportée.

3. Changer l'ordre du programme  train d'abord multi-image, puis une seule image, puis vidéo. Prédire quelles valeurs de référence dégradent et pourquoi.

4. Le document rapporte des benchmarks vidéo formés sur seulement 8 images par échantillon. Cela se généralise-t-il à des vidéos de 30 secondes à l'inférence?

5. Le pooling bilinéaire de 24x24 patches à 12x12 est une réduction de 2x par dimension, donc 4x moins de jetons.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| OneVision scenario | "Single-image, multi-image, or video" | One of three input shapes the unified VLM handles; the budget stays balanced across |
| Token budget | "How many tokens per sample" | Total visual tokens the LLM sees per training / inference sample, about 6k to 9k at most in LLaVA-OneVision |
| Curriculum | "Training order" | Stage ordering (single-image → multi-image → video) chosen for emergent transfer |
| Bilinear pooling | "Token shrink" | Applying bilinear interpolation to the patch grid (2D) to reduce token count while preserving locality |
| Emergent skill | "Not trained, still works" | Capability that appears at inference without matching training data, due to curriculum composition |
| AnyRes-k | "k-tile setup" | k sub-tiles of fixed resolution plus one thumbnail, typical $k \in \lbrace 4, 9 \rbrace$ |
| Task transfer | "Cross-scenario generalization" | Skills learned on single-image that apply to video (and vice versa) via shared backbone |

## Pour en savoir plus

- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326)
- [LLaVA-OneVision-1.5: Fully Open Framework (arXiv:2509.23661)](https://arxiv.org/abs/2509.23661)
- [Lin et al. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Lin et al. — VILA (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
