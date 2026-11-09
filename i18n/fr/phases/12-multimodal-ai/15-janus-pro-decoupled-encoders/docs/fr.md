# Janus-Pro: encoders découplés pour les modèles multimodaux unifiés

> Les modèles multimodels unifiés ont une tension inévitable. La compréhension a besoin de caractéristiques sémantiques  VECTORS de sortie SigLIP ou DINOv2 riches en informations au niveau du concept. La génération veut des codes conviviaux à la reconstruction  des jetons VQ qui se composent en pixels clairs. Les deux objectifs ne sont pas compatibles dans un seul encodeur. Janus (DeepSeek, octobre 2024) et Janus-Pro (DeepSeek, janvier 2025) affirment que la solution est d'arrêter d'essayer: déconnecter les deux encoders. Partager le corps de transformateur entre les tâches, mais parcourir la compréhension via SigLIP et générer par un tokenizer VQ. À 7B, Janus-Pro bat DALL-E 3 sur GenEval tout en correspondant à LLaVA sur MMMU. Cette leçon explique pourquoi deux encoders fonctionnent quand l'un échoue.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, dual-encoder routing + shared-body signal)
**Prerequisites:** Phase 12 · 13 (Transfusion), Phase 12 · 14 (Show-o)
**Time:** ~120 minutes

## Objectifs d'apprentissage

- Expliquez pourquoi un seul codeur partagé compromet la compréhension ou la qualité de la génération.
- Décrivez le routage de Janus-Pro: SigLIP fonctionne sur le côté d'entrée pour la compréhension, VQ tokens à la fois pour l'entrée et la sortie pour la génération.
- Suivez l'échelle des données qui rend Janus-Pro réussi là où Janus ne l'a pas fait.
- Comparer les architectures découplées (Janus-Pro), couplées-continues (Transfusion) et couplées-discrètes (Show-o).

## Le problème

Les modèles unifiés partagent un corps transformateur à travers la compréhension et la génération.

- Optimisé pour la reconstruction (génération): VQ-VAE capture des détails de pixel finement grains mais produit des jetons avec une faible cohérence sémantique.
- Optimisé pour la sémantique (compréhension): SigLIP incrustations de groupe "cat" images près de "cat" jetons mais ne permettent pas une bonne reconstruction.

Le programme de la Commission a été lancé en juin 1995 et a été lancé en décembre 1995.

## Le concept

### Codification visuelle découlée

L'architecture de Janus-Pro sépare les deux encoders:

- Compréhension du chemin. image d'entrée → SigLIP-SO400m → corps de transformateur à 2 couches MLP.
- Chemin de génération. image d'entrée (si conditionnée sur une image existante) → VQ tokenizer → IDs de jeton → corps transformateur.
- Génération de sortie. Tokens d'image prédits par le transformateur → décodeur VQ → pixels.

Le corps du transformateur est partagé, tout en amont et en aval du corps est spécifique à la tâche.

Les entrées sont déambiguées par format prompt: a `<understand>`les itinéraires de marquage à travers le SigLIP; `<generate>`ou le routage est implicite de la tâche.

### Pourquoi ça marche ?

La perte de compréhension obtient des fonctionnalités SigLIP, qui ont été ajustées pour une similitude sémantique par la pré-entraînement CLIP.

La perte de génération obtient des jetons VQ, qui ont été réglés par un tokeniser pour la reconstruction.

Le corps du transformateur partagé voit deux distributions d'entrée (SigLIP et VQ) et apprend à travailler avec les deux.

### Écalement des données  Janus vs Janus-Pro

Janus (original, arXiv 2410.13848) a introduit le découplage mais à petite échelle (1.3B paramètres, données limitées).

- Paramètres 7B (versus 1.3B).
- 90 M paires d'images-texte pour la phase 1 (alignement) à partir de 72 M.
- 72 M pour la phase 2 (unifiée) à partir de 26 M.
- 200 000 échantillons d'instructions de génération d'images ont été ajoutés pour la phase 3.

Le résultat: Janus-Pro-7B partage LLaVA sur MMMU (60.3 vs ~58) et bat DALL-E 3 sur GenEval (0.80 vs 0.67). Un modèle ouvert, compétitif des deux côtés du spectre unifié.

### JanusFlow  la variante de flux rectifiée

JanusFlow (arXiv 2411.07975) change le chemin de génération de VQ pour un chemin de génération de flux rectifié (continu). La fraction devient SigLIP-pour-compréhension + flux-pour-génération rectifié.

### Le travail du corps commun

Le corps transformateur traite une séquence unifiée mais avec deux distributions d'entrée.

- Pour comprendre: consommer les fonctionnalités SigLIP + jetons de texte → émettre du texte autorégressivement.
- Pour la génération: consommer des jetons de texte + (jetons VQ d'image optionnels) → émettre des jetons VQ d'image autogressivement.

Le corps n'a pas de poids spécifique à la modalité par bloc. C'est le transformateur de style texte que vous attendez de trouver à l'intérieur de Qwen ou Llama, plus les deux adaptateurs d'entrée.

Il est intéressant de noter que le corps de Janus-Pro pourrait être initialisé à partir d'un LLM prétrainé. Janus-Pro commence à partir de DeepSeek-MoE-7B. Ce choix compte: le LLM contribue à la capacité de raisonnement que les modèles unifiés purement de zéro luttent pour atteindre.

### Comparé à InternVL-U

Le programme de suivi de l'internVL-U (leçon 12.10) est le suivant pour 2026.

- Pré-entraînement multimodal natif (rétectrice interne VL3).
- Routage par codeur découplé (siglip en, diffusion VQ + se déplace).
- Compréhension unifiée + génération + édition.

InternVL-U intègre le choix architectural de Janus-Pro dans un cadre plus large.

### Limitations

Les encoders découpés ajoutent une complexité architecturale. Deux tokenizers à former, deux chemins d'entrée à entretenir, deux ensembles de modes de défaillance. Pour les produits qui ne nécessitent pas de génération, Janus-Pro est sur-ingénierie.

Pour les produits qui ne nécessitent pas de compréhension, Janus-Pro est surqualifié  choisissez un modèle Stable Diffusion 3 / Flux.

Pour les produits qui ont besoin des deux, Janus-Pro est maintenant l'architecture ouverte de référence.

```figure
l5-janus-decouple
```

## Utilisez-le

`code/main.py`simule le routage Janus-Pro:

- Deux encoders simulés: SigLIP (produit des vecteurs sémantiques de 256 dimensions) et VQ (produit des codes entiers).
- Un routeur rapide qui choisit l'encodeur en fonction d'une balise de tâche.
- Un corps partagé (stand-in) qui traite les séquences de jetons, quel que soit le codeur qui les a produites.
- Un passage de l'étape 1 (alignement) à l'étape 3 (tune d'instruction) du calendrier des échantillons pondérés.

Imprimez les chemins routés pour 3 exemples: image QA, T2I, édition d'image.

## La faire partir

Cette leçon produit `outputs/skill-decoupled-encoder-picker.md`. Étant donné qu'un produit qui veut une génération unifiée + une compréhension de la qualité de pointe, il choisit Janus-Pro, JanusFlow ou InternVL-U avec une recommandation concrète sur l'échelle des données.

## Exercices

1. Janus-Pro-7B surpasse DALL-E 3 sur GenEval. Expliquez pourquoi un modèle ouvert 7B peut être compatible avec un modèle propriétaire de frontière sur la génération mais pas sur la compréhension.

2. Implémenter une fonction de routeur: en donnant un texte prompt, classer comme `understand`ou `generate`Comment gérer des demandes ambiguës comme "décrire et ensuite dessiner"?

3. JanusFlow remplace le chemin VQ par un flux rectifié.

4. Proposer une quatrième tâche que l'architecture Janus-Pro pourrait gérer avec un encodeur déconnecté supplémentaire.

5. Lisez la section 4.2 de Janus-Pro sur l'échelle des données.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Decoupled encoding | "Two visual encoders" | Separate tokenizer or encoder per direction: semantic for understanding, reconstruction for generation |
| Shared body | "One transformer" | Single transformer processes either encoder's output; no modality-specific weights |
| SigLIP for understanding | "Semantic features" | CLIP-family vision tower providing rich conceptual features but poor reconstruction |
| VQ for generation | "Reconstruction codes" | Vector-quantized tokens that decode cleanly back to pixels |
| JanusFlow | "Rectified-flow variant" | Janus-Pro with a continuous flow-matching generation head instead of VQ |
| Routing tag | "Task tag" | Prompt marker (`<understand>` / `<generate>`) that picks the input encoder |

## Pour en savoir plus

- [Wu et al. — Janus (arXiv:2410.13848)](https://arxiv.org/abs/2410.13848)
- [Chen et al. — Janus-Pro (arXiv:2501.17811)](https://arxiv.org/abs/2501.17811)
- [Ma et al. — JanusFlow (arXiv:2411.07975)](https://arxiv.org/abs/2411.07975)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Dong et al. — DreamLLM (arXiv:2309.11499)](https://arxiv.org/abs/2309.11499)
