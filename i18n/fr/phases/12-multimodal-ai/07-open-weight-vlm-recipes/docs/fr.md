# Les recettes VLM à poids ouvert: ce qui compte vraiment

> La littérature VLM de poids ouvert 2024-2026 est une forêt de tables d'ablation. Le MM1 d'Apple a testé 13 combinaisons d'encodeur d'image, de connecteur et de mélange de données. Les légendes humaines détaillées de l'IA Allen Molmo ont prouvé que la distillation GPT-4V était plus efficace. Cambrian-1 a effectué plus de 20 comparaisons d'encodeurs. Idefics2 a officiellement formalisé l'espace de conception à cinq axes. Les VLM prismatiques ont comparé 27 recettes de formation sur un critère de référence contrôlé. De tout ce bruit, un petit ensemble de résultats est valable sur tous les papiers: l'encodeur d'image compte plus que l'architecture du connecteur, le mélange de données compte plus que les deux, et les légendes humaines détaillées battent les données synthétiques distillées. Cette leçon lit ces tables pour que vous n'ayez pas à le faire.

**Type:** Learn + lab
**Languages:** Python, TypeScript (stdlib, ablation table parser + recipe picker)
**Prerequisites:** Phase 12 · 05 (LLaVA baseline)
**Time:** ~180 minutes

## Objectifs d'apprentissage

- Nommer l'espace de conception VLM à cinq axes: encodeur d'image, connecteur, LLM, mélange de données, calendrier de résolution.
- Lisez un tableau d'ablation MM1 / Idefics2 / Cambrian-1 et prédisez quel bouton déplace une référence donnée.
- Choisissez une recette (encodeur, connecteur, données, résolution) pour un nouveau VLM compte tenu d'un budget de calcul et d'un mélange de tâches.
- Expliquez pourquoi les légendes détaillées sur l'homme sont plus efficaces que la distillation GPT-4V au même nombre de symboles.

## Le problème

Il existe des centaines de VLM à poids ouvert. La plupart du temps, l'écart entre "bon" et "state-of-the-art" n'est pas l'architecture. Il s'agit de données, de calendrier de résolution et de choix d'encodeur.

La vague 2023 (LLaVA-1.5, InstructBLIP, MiniGPT-4) a été réalisée sur un coup de sous-titres + LLaVA-Instruct-150k.

La vague 2024 (MM1, Idefics2, Molmo, Cambrian-1, Prismatic VLMs) a effectué des ablations exhaustives.

## Le concept

### L'espace de conception à cinq axes

Idefics2 (Laurençon et coll., 2024) a nommé les axes:

1. Codificateur d'image. CLIP ViT-L/14, SigLIP SO400m/14, DINOv2 ViT-g/14, InternViT-6B. Les codificateurs diffèrent par la taille du patch, la résolution et l'objectif de pré-entraînement.
2. Connecteur: MLP (2-4 couches), Q-Former (32 requêtes + cross-attn), Re-sampler de percepteur (64 requêtes), C-Abstractor (pooling convolutif + bilinéaire).
3. Le modèle de langue: Llama-3 8B / 70B, Mistral 7B, Phi-3, Gemma-2, Qwen2.5.
4. Les données de formation: couples de sous-titres (CC3M, LAION), interligés (OBELICS, MMC4), instruction (LLaVA-Instruct, ShareGPT4V, PixMo, Cauldron).
5. Calendrier de résolution: fixe 224/336/448, AnyRes, dynamique natif.

Chaque VLM de production fait un choix sur chaque axe. La plupart des variations dans les scores MMMU sont expliquées par les axes 1, 4 et 5  et non par le connecteur que vous avez choisi.

### Axe 1: encodeur > connecteur

MM1 Section 3.2 a montré: le changement de CLIP ViT-L/14 à SigLIP SO400m/14 a ajouté 3 points MMMU. le changement du connecteur de MLP à Perceiver Resampler a ajouté moins de 1 point.

Le "Cambrian Vision Encoders Match-Up" de Cambrian-1 (Tong et coll., 2024) a utilisé plus de 20 encoders sur un benchmark axé sur la vision (CV-Bench). Le haut du classement est un mélange de DINOv2 et SigLIP; CLIP est au milieu du pack; ImageBind et ViT-MAE sont plus bas. L'écart entre CLIP ViT-L et DINOv2 ViT-g/14 est de ~ 5 à 7 points sur CV-Bench.

Le codeur par défaut 2026 pour les VLM ouverts est SigLIP 2 SO400m/14 pour les fonctionnalités sémantiques + denses, parfois concatené avec les fonctionnalités DINOv2 ViT-g/14 (l'agrégateur de vision spatiale de Cambrian le fait).

### Axe 2: conception du connecteur est un lavage

MM1, Idefics2, Prismatic et MM-Interleaved ont tous conclu la même chose: à un nombre fixe de jetons visuels, l'architecture du connecteur compte à peine.

Ce qui compte, c'est le nombre de jetons. Plus de jetons visuels = plus de calcul LLM = meilleure performance jusqu'à un point, puis des rendements diminuant. 64 jetons par image est trop peu pour OCR. 576-1024 jetons est le point de départ pour la plupart des VLM ouverts. 2048+ aide uniquement pour les documents et les graphiques.

Q-Former vs MLP est une question de coût, pas une question de qualité: Q-Former limite les jetons à 32-64 indépendamment de la résolution de l'image; MLP émet tous les jetons de patch. Pour les entrées haute résolution, Q-Former économise le contexte LLM; pour les basses résolutions, la différence est le bruit.

### Axe 3: La taille du MLL fixe le plafond

Le double du LLM de 7B à 13B ajoute de manière fiable 2 à 4 points sur MMMU sur chaque document VLM. À 70B, vous saturerez la plupart des points de référence.

C'est pourquoi Qwen2.5VL-72B et Claude Opus 4.7 écrasent MMMU-Pro et ScreenSpot-Pro: le cerveau du langage est énorme. Un VLM 7B ne peut pas remplacer un VLM 70B grâce à une conception intelligente de connecteur.

### Axe 4: données  détails des légendes humaines sur la distillation

Molmo + PixMo (Deitke et coll., 2024) est le résultat 2024 que tout le monde devrait lire. Allen AI a demandé aux annotateurs humains de décrire les images en 1-3 minutes de passages de parole à texte denses, ce qui a donné 712K d'images sous-titrées denses. Aucune distillation GPT-4V nulle part dans les données de formation.

Molmo-72B bat Llama-3.2-90B-Vision sur 11 des 11 critères de référence. Le delta n'est pas une architecture  c'est la qualité des légendes. Les légendes détaillées contenant 5-10 fois plus d'informations par image que les légendes courtes et restent basées sur des faits où la distillation GPT-4V hallucine.

ShareGPT4V (Chen et coll., 2023) et Cauldron (Idefics2) ont suivi le même manuel avec des sous-titres humains + GPT-4V mixtes.

### Axe 5: résolution et calendrier

Les ablations d'Idefics2: 384 -> 448 ajoute 1-2 points. 448 -> 980 avec la fraction d'image (AnyRes) ajoute encore 3-5 sur les benchmarks OCR. Plateaux de formation à haute résolution à une précision moyenne; rampe de résolution (début 224, fin 448 ou natif) trains plus rapide et finit plus haut.

Cambrian-1 a effectué un trade-off résolution vs. tokens: au calcul fixe, vous pouvez avoir plus de tokens à résolution inférieure ou moins de tokens à résolution plus élevée.

La recette de production 2026: train étape 1 à 384 fixes, étape 2 avec résolution dynamique jusqu'à 1280 pour les tâches lourdes en matière de RCO.

### La comparaison contrôlée prismatique

Prismatic VLMs (Karamcheti et coll., 2024) est le document qui a contrôlé tous les axes.

- Le nombre de jetons visuels par image explique ~60% de la variance.
- Le choix du codeur explique ~20%.
- L'architecture du connecteur explique ~5%.
- Tout le reste (mix de données, planificateur, LR) les 15% restants.

C'est une décomposition grossière, mais c'est la réponse la plus claire à "ce que je devrais ablation d'abord" dans la littérature.

### Un choix pour 2026

Compte tenu des preuves, la recette par défaut de VLM ouvert pour un nouveau projet en 2026:

- Encoder: SigLIP 2 SO400m/14 à résolution native avec NaFlex, concaténé avec DINOv2 ViT-g/14 pour des caractéristiques denses si vous avez besoin de segmentation/terrestation.
- Connecteur: 2 couches MLP sur les jetons de correction.
- LLM: Qwen2.5 / Llama-3.1 / Gemma 2, 7B pour le coût, 70B pour la qualité, sélectionné par latence cible.
- Données: PixMo + ShareGPT4V + Cauldron, complétée par des données d'instructions spécifiques à la tâche.
- Résolution: dynamique (min 256, max 1280 pixels par long côté).
- L'annexe: alignement de la phase 1 (projecteur uniquement), phase 2 mise à jour complète, phase 3 mise à jour spécifique à la tâche.

Chacune de ces défauts remonte à une ablation mesurée dans les documents cités à la fin de cette leçon.

```figure
l5-vlm-recipe-knobs
```

## Utilisez-le

`code/main.py`est un analyseur de table d'ablation et un sélecteur de recettes. Il encode les tables d'ablation MM1 et Idefics2 (condensé) et vous permet de demander:

- "Compte tenu du budget X et de la tâche Y, quelle recette gagne?"
- "Si je change SigLIP pour CLIP sur un Llama 7B, quel est le delta MMMU attendu?"
- "Quel axe dois-je ablationner en premier pour une réponse de confiance de 80%?"

La sortie est une liste de recettes classées avec des delta de référence attendues et une recommandation "ablate first".

## La faire partir

Cette leçon produit `outputs/skill-vlm-recipe-picker.md`. Compte tenu d'un mix de tâches cibles, d'un budget de calcul et d'un objectif de latence, il émet une recette complète (encodeur, connecteur, LLM, mix de données, calendrier de résolution) avec des citations à l'ablation qui justifie chaque choix.

## Exercices

1. Pour un LLM 2B fixe à 50 millions d'images, quel codeur gagne ?

2. Cambrian-1 constate que la concaténation DINOv2 + SigLIP dépasse les résultats des critères de référence centrés sur la vision mais n'ajoute aucun signal sur MMMU.

3. Votre cible est un agent d'interface utilisateur mobile sur un 2B LLM. Choisissez un encodeur, un connecteur, une résolution et un mélange de données.

4. Molmo produit des modèles 4B et 72B. Le 4B est compétitif avec les VLM fermés 7B; le 72B bat Llama-3.2-90B-Vision sur les critères de référence 11/11.

5. Conçuez un tableau d'ablation pour isoler la qualité du mélange de données de la qualité du codeur sur un VLM 7B. Combien de sessions d'entraînement minimum?

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Ablation | "Turning one knob" | Training multiple runs that differ in exactly one design-space axis, holding everything else constant |
| Connector | "Bridge" / "projector" | Trainable module that maps vision encoder output into the LLM's token space (MLP, Q-Former, Perceiver) |
| Detailed human caption | "Dense caption" | A multi-sentence human-written description (typically 80-300 tokens) richer than a web alt text |
| Distillation | "GPT-4V captions" | Training data generated by a stronger proprietary VLM; convenient but prone to inherited hallucination |
| AnyRes / dynamic res | "High-res path" | Strategy to feed images larger than the encoder's native resolution via tiling or M-RoPE |
| Resolution ramp | "Curriculum" | Training schedule that starts low-resolution and increases, speeding alignment learning |
| Vision-centric bench | "CV-Bench / BLINK" | Evaluation that stresses fine-grained visual perception rather than language-heavy reasoning |
| PixMo | "Molmo's data" | Allen AI's 712K densely-captioned image dataset; human speech transcribed into dense captions |

## Pour en savoir plus

- [McKinzie et al. — MM1 (arXiv:2403.09611)](https://arxiv.org/abs/2403.09611)
- [Laurençon et al. — Idefics2 / What matters building VLMs (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Deitke et al. — Molmo and PixMo (arXiv:2409.17146)](https://arxiv.org/abs/2409.17146)
- [Tong et al. — Cambrian-1 (arXiv:2406.16860)](https://arxiv.org/abs/2406.16860)
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865)
