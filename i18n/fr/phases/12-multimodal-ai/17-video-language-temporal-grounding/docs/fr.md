# Modèles vidéo: jetons temporaires et mise au sol

> La vidéo n'est pas une pile de photos. Un clip de 5 secondes a un ordre causal, des verbes d'action et un calendrier d'événement qu'un modèle d'image ne peut pas représenter. Video-LLaMA (Zhang et coll., juin 2023) a expédié le premier open video-LLM avec fondation audiovisuelle. VideoChat et Video-LLaVA ont étalé le modèle. En 2025, le M-RoPE de Qwen2.5 VL, aligné sur le temps, a fermé le fossé avec les modèles de propriété frontalière. Chaque système a résolu les jetons temporels différemment  Q-former par clip, concat-pool par cadre, M-RoPE aligné sur le temps par jeton. Cette leçon lit les modèles, construit un échantillonneur de cadre uniforme contre dynamique et évalue les tâches de mise à terre temporelle.

**Type:** Build
**Languages:** Python (stdlib, frame sampler + temporal-grounding evaluator), TypeScript
**Prerequisites:** Phase 12 · 08 (LLaVA-OneVision)
**Time:** ~180 minutes

## Objectifs d'apprentissage

- Expliquez pourquoi le codage positionnel temporel modifie les performances de la vidéo VLM indépendamment du codageur de vision.
- Comparer l'échantillonnage uniforme, dynamique-FPS et événement-driven de cadres sur les jetons-par seconde par rapport à la précision de mise à terre.
- Décrivez les conceptions Q-ex-per-clip (Video-LLaMA) vs pooled-per-frame (Video-LLaVA) vs M-RoPE par jeton (Qwen2.5-VL) alignées sur le temps.
- Nombre des quatre critères de référence pour la vidéo: VideoMME, TempCompass, EgoSchema, Video-MMMU.

## Le problème

Une vidéo de 1 minute à 30 FPS est de 1800 images. À 196 jetons visuels par image (ViT-B à 224), c'est 352k jetons  plus gros que tout contexte LLM de l'ère 2024.

Il existe trois stratégies de réduction:

1. Les cadres de sous-échantillons (1-8 FPS selon le contenu).
2. Rassembler les jetons de patch de chaque cadre de manière agressive (3x3 ou 4x4 bilinéaires).
3. Comprimez par un Q-former qui prend un clip de 16 cadres et sort 64 jetons.

Chaque trade-off est différent. le sous-échantillonnage perd les détails temporels. le pooling perd les détails spatiaux. le Q-former perd un peu les deux mais économise des jetons.

Le codeur de position temporelle est l'autre axe: comment le modèle sait-il que le cadre 5 est venu avant le cadre 6 ? Les options incluent le simple RoPE temporel 1D (Video-LLaMA), les emblèmes temporels apprises (Video-LLaVA) et le M-RoPE aligné sur le temps (Qwen2.5-VL, 3D complet).

## Le concept

### Vidéo-LLaMA: Q-former par clip + branche audio

Le vidéo-LLMA (2023) est le premier vidéo-LLM ouvert.

- Des clips de 16 images à 2 FPS (jusqu'à 8 secondes).
- Les fonctionnalités ViT par cadre -> Video Q-former qui intervient sur les 16 cadres -> 32 requêtes apprises -> LLM.
- Branche audio parallèle: forme d'onde -> encodeur audio ImageBind -> Audio Q-former -> 32 requêtes -> LLM.

La force: raisonnement articulaire audiovisuel.

### VidéoChat et Vidéo-LLaVA

VideoChat a gardé l'idée de Video-LLaMA mais a abandonné l'audio et simplifié. Video-LLaVA (Lin et coll., 2023) a formé un seul encodeur visuel sur les images et les cadres vidéo ("alignement avant la projection"), donnant une représentation unifiée.

Aucun ne peut traiter de longues vidéos.

### Qwen2,5-VL et M-RoPE aligné sur le temps

Qwen2.5-VL conserve le M-RoPE de Qwen2-VL (Inplementation de position rotative multimodale) et aligne son axe temporel avec le temps absolu. Chaque jeton de patch porte une position (t, h, w) où t suit le timestamp réel (pas l'index du cadre). Qwen2.5-Omni (Létion 12.20) nomme plus tard sa version audio et vidéo de la même idée TMRoPE, Time-aligné Multimodal RoPE.

Différences clés par rapport à l'intégration temporelle simple:

- Le modèle voit "à 4,2 secondes" et non "à 15".
- Chaque jeton visuel tourne indépendamment par son timestamp.
- Si vous prenez un échantillon à 2 FPS ici et 4 FPS là, M-RoPE aligné sur le temps traite l'espacement inégalitaire de manière native.

Le M-RoPE aligné sur le temps permet de poser des questions " à quelle seconde le chat saute-t-il ? " Le modèle peut exécuter " à 4,2 secondes. " Le vidéo-LLaMA ne pouvait dire que " tôt dans le clip. "

### Stratégies de prélèvement d'échantillons

Unique: l'échantillon N cadres uniformément sur la durée.

FPS dynamique: échantillon adapté en fonction de l'intensité du mouvement.

Événement-driven: exécuter un détecteur léger, échantillonner plus où l'action se produit.

Tasté + contexte: échantillon aux limites des prises de vue + quelques cadres adjacents. Utilisé pour le contenu cinématographique.

### Rassemblement par cadre

À 1 FPS et 576 jetons par image, un clip de 5 minutes est de 172.800 jetons. Cela dépasse le contexte 128k de Qwen2.5-VL-72B, donc vous devez d'abord laisser tomber le taux de images ou les jetons de pool par image.

Le pool bilinéaire 3x3 se réduit à 64 jetons par cadre -> 19 200 jetons pendant 5 minutes.

Les actions de base sont plus agressives (6x6 -> 16 jetons par cadre) pour les flux de travail des agents où les détails spatiaux comptent moins.

### Les quatre critères de référence vidéo

- Vidéo-MME: compréhension vidéo complète, courte + moyenne + longue.
- TempCompass: raisonnement temporel finement nourri, questions "avant" / "après".
- EgoSchema: vidéo à la première personne.
- Vidéo-MMMU: questions vidéo multimodelles et multidisciplinaires.

Une évaluation vidéo-VLM complète touche les quatre. Ils soulignent différents axes  TempCompass est tout sur la commande, EgoSchema est environ 3 + minutes de raisonnement, VideoMME couvre les durées.

### Format de sortie de mise au sol

Format de sortie pour la mise à terre temporelle:

- "Le chat saute autour de la marque de 4 secondes". Facile à analyser mais imprecise.
- JSON structuré: `{"event": "jump", "start": 4.1, "end": 4.3}`Le Qwen2.5VL est équipé de ce train.
- Basé sur des jetons: spécial `<time>4.1</time>`Certains modèles vidéo utilisent ce code; Qwen2.5-VL instead encode le temps dans ses M-RoPE position IDs et réponses en texte ou JSON.

Le format de sortie JSON de Qwen2.5VL partage directement.

### 2026 les meilleures pratiques

Pour les VLM vidéo en 2026:

- Encodeur: SigLIP 2 ou ViT à résolution native, avec M-RoPE aligné sur le temps dans le LLM (Qwen2.5-VL).
- Prise d'échantillons de cadres: FPS dynamique (1-4 en fonction du mouvement) avec capot maximal de cadres.
- Le poids par cadre: 3x3 bilinéaire.
- Sortie: JSON structuré avec champs de temps + événement.
- Les critères de référence: Vidéo- PME + TempCompass pour les entreprises générales; EgoSchema pour les entreprises à long terme.

```figure
video-temporal-patches
```

## Utilisez-le

`code/main.py`comprend:

- Des échantillonnages de cadres FPS uniformes et dynamiques.
- Un évaluateur de la fondation temporelle de jouets: étant donné un événement de "vérité fondamentale" au moment T et une sortie de modèle, la précision est notée avec tolérance.
- Une comparaison entre les vidéos-LLaMA (16 images, Q-former), Vidéos-LLaVA (8 images, MLP), Qwen2.5-VL (FPS dynamique + M-RoPE aligné sur le temps).

## La faire partir

Cette leçon produit `outputs/skill-video-vlm-frame-planner.md`. En fonction d'une tâche vidéo (monitoring, reconnaissance d'action, repérage temporel, résumé), il choisit l'échantillon de cadre, le facteur de mise en commun, le format de sortie et le niveau de précision attendu.

## Exercices

1. Pour une démonstration de cuisson de 3 minutes, choisissez uniforme contre FPS dynamique.

2. Le M-RoPE aligné sur le temps ajoute-t-il précisément ce qu'une simple table d'intégration temporelle ne peut pas faire?

3. Écrivez un schéma JSON pour le repérage temporel qu'un VLM peut apprendre à émettre.

4. Lisez la section 3 de Video-LLaVA sur "L'alignement avant la projection". Pourquoi est-ce mieux que de former des encoders d'image et de vidéo séparés?

5. Compte tenu du classement des entreprises vidéo-médicales, quelle est la différence entre le modèle ouvert le plus élevé et le modèle propriétaire le plus élevé à partir de 2026?

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Temporal grounding | "Time-localized answers" | VLM outputs a specific timestamp range for when an event happens |
| Time-aligned M-RoPE | "TMRoPE" | 3D rotary position whose temporal axis follows absolute timestamps; Qwen2.5-VL uses it for video, and Qwen2.5-Omni names its audio and video form TMRoPE |
| Dynamic FPS | "Motion-aware sampling" | Sample more frames in high-motion segments, fewer in static ones |
| Frame pooling | "Spatial compress per frame" | Reduce patches per frame with bilinear interpolation before the LLM |
| Video Q-former | "Clip compressor" | Cross-attention bottleneck mapping N frames to K learned queries |
| VideoMME | "Video bench" | Comprehensive short/medium/long video benchmark, 2500+ samples |

## Pour en savoir plus

- [Zhang et al. — Video-LLaMA (arXiv:2306.02858)](https://arxiv.org/abs/2306.02858)
- [Li et al. — VideoChat (arXiv:2305.06355)](https://arxiv.org/abs/2305.06355)
- [Lin et al. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Qwen Team — Qwen2.5-VL (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Lin et al. — VILA-1.5 (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
