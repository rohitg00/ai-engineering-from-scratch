# InternVL3: Pré-entraînement multimodaux natif

> Chaque VLM ouvert avant InternVL3 suivait la même recette en trois étapes: prendre un texte LLM formé sur des milliards de jetons de texte, boulon sur un codeur de vision, puis affiner les coutures. Ce système fonctionne mais a une dette d'alignement  le texte LLM a dépensé tout son budget pré-entraînement sur le texte pur et ne comprend pas nativement les jetons visuels. Lorsque vous ajoutez la vision post-hoc, le LLM doit réapprendre à relier l'entrée visuelle à son raisonnement textuel sans oublier le texte. InternVL3 (Zhu et coll., avril 2025) rejette l'approche post-hoc: une course pré-entraînement, un texte et un multimodal interlevé à partir de l'étape 1. Le résultat correspond à Gemini 2.5 Pro sur MMMU-Pro à 78B params ouverts. Cette leçon explique le cas de la pré-entraînement natif et ce qui change lorsque vous le faites.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, training-corpus mixer)
**Prerequisites:** Phase 12 · 05, Phase 12 · 07 (recipes)
**Time:** ~120 minutes

## Objectifs d'apprentissage

- Expliquez pourquoi la formation post-hoc en VLM accumule une dette d'alignement, en citant les trois symptômes mesurables (oubli catastrophique, dérive de réponse, incohérence visuelle-textuelle).
- Décrivez le mix de corpus de préparation de l'InternVL3 et pourquoi le rapport de texte : interligé : sous-titre est important.
- Comparer le V2PE (codage de position visuelle variable) avec le M-RoPE de Qwen2-VL.
- Nommer les optimisations de déploiement du routeur de résolution visuelle (ViR) et du langage de vision découplé (DvD).

## Le problème

La formation post-hoc VLM est la formation par défaut. LLaVA, BLIP-2, Qwen-VL, Idefics  prennent tous un LLM déjà prétrainé (Llama, Vicuna, Qwen, Mistral) et ajoutent la vision.

1. LLM gelé + encodeur de vision gelé + projecteur entraîneur, formé sur des paires de sous-titres pour aligner les emblèmes.
2. Défriger le LLM, former sur les données d'instruction (LLaVA-Instruct, ShareGPT4V).
3. Optionnel de réglage spécifique à la tâche.

Trois symptômes de la dette d'alignement apparaissent:

- L'oubli catastrophique, le VLM post-hoc oublie les compétences en texte seulement, les scores GSM8K baissent de 5 à 10 points, les scores Hellaswag baissent, les agents pur-textes régressent.
- Les petites phrases de la même question visuelle obtiennent des réponses différentes. Le codeur de vision se connecte au LLM avec des liaisons plus faibles que les jetons du LLM lui-même.
- L'image est une image qui est décrite correctement et qui répond ensuite à une question qui contredit sa propre description.

Ces symptômes sont bien documentés. MM1.5 Section 4 les quantifie. LLaVA-OneVision ablations suggèrent. Pré-entraînement natif est la réponse.

## Le concept

### Pré-entraînement multimodal natif

InternVL3 traîne à partir de zéro sur un corpus qui est natif multimodal à partir de l'étape 1.

- 40% de données uniquement textuelles (FineWeb, Proof-Pile-2, etc.)
- 35% de données d'image-texte interligées (OBELICS, style MMC4)
- 20% de données de sous-titres d'images parallèles
- 5% de données vidéo-texte

Les jetons de vision, les jetons de texte et les interactions intermodiales participent tous à la même perte dès la première étape du gradient.

La formation est une étape unique pour le modèle de base.

### V2PE (codation de position visuelle variable)

Qwen2-VL utilise M-RoPE avec allouement d'axe fixe. InternVL3 introduit V2PE: le codage de position varie selon le type de modalité (texte, image, vidéo) avec une mise à l'échelle appréciable.

- Les jetons de texte obtiennent une position 1D (index de texte).
- Les patchs d'image obtiennent une position 2D (ligne, colonne).
- Les images vidéo obtiennent une position 3D (temps, rangée, col).

Les trois partagent la même base de fréquences RoPE, mais l'allocation de la lumière cachée par bande est un paramètre appris plutôt que une fraction fixe.

L'affirmation d'ablation de V2PE: 1 à 2 points sur les points de référence vidéo par rapport à M-RoPE au même calcul.

### Routeur à résolution visuelle (ViR)

Optimisation du déploiement. Toutes les images ne nécessitent pas un codage à haute résolution. Une photo avec un objet à faible détail gaspille des jetons lorsqu'elle est cochée à 1280px natif. ViR est un petit classifiant qui prédit la résolution minimale nécessaire pour répondre à la question, avant de cocher.

Le routage a trois niveaux: faible résolution (256 jetons), moyen (576), élevé (2048+). Pour 60% des requêtes dans le trafic de production, faible ou moyen est suffisant.

### Déploiement de la vision-langue déconnectée (DvD)

Lorsque vous servez un grand VLM, l'encodeur de vision fonctionne une fois par image mais le LLM fonctionne autorégressivement pour chaque jeton de sortie. Les deux composants ont des goulots d'étranglement différents (vision = bande passante de la mémoire GPU pour conv + attention; LLM = cache KV).

Pour un modèle d'encodeur 8B + 400M, le DvD doublera à peu près le débit par nœud par rapport au co-loqué.

### Qualité en un seul stade par rapport à celle en plusieurs étapes

La première référence de l'InternVL3 est: à 78B params, correspondre à MMMU-Pro de Gemini 2.5 Pro. À 38B, correspondre à GPT-4o. À 8B, mener le leader des 8B ouverts. Tout sur une recette de pré-entraînement + instruction-tune d'une seule étape.

L'hypothèse de l'alignement-débit est mesurable: InternVL3-8B perd moins de points de référence texte (MMLU, GSM8K) que Qwen2.5-VL-7B par unité de gain de référence vision.

### Les résultats de l'enquête

InternVL3.5 (août 2025) évolue la recette. La même approche de pré-entraînement natif, plus de données, plus de paramètres.

InternVL-U (2026) ajoute une production d'image unifiée de génération  via les têtes MMDiT sur le dessus de la même colonne vertébrale.

### Compenses de formation précoce en milieu natif

La pré-entraînement native n'est pas gratuite:

- Compute. La formation d'un nouveau VLM à partir de zéro coûte la même chose qu'une formation de texte LLM  millions d'heures GPU.
- Les données. Les corps d'image-texte interligés à l'échelle sont rares. OBELICS est de 141 millions de documents; MMC4 est de 571 millions. Le texte seul est livré à 15T tokens.
- La formation initiale native renonce à la possibilité de déposer un nouveau LLM plus tard.

Le pari de InternVL3 est que la dette d'alignement est pire que la perte de réutilisation. Les critères de référence confirment la revendication. Les coûts de production empêchent les laboratoires futurs de reproduire à bas prix.

```figure
l5-native-pretrain
```

## Utilisez-le

`code/main.py`est un mélangeur de formation et un simulateur de routeur ViR.

- Prend un corpus cible mix (% texte, % interleavé, % sous-titre, % vidéo) et calcule les étapes attendues par modalité.
- Simulation du routage ViR sur un lot de requêtes (distribution: 50% de faible détail, 30% de moyenne, 20% de haute détail) et rapport du nombre moyen de jetons.
- Rapports des estimations de débit DvD données par l'encodeur par rapport aux FLOP de la MLL.
- Imprime un suivi de la formation post-hoc et de la formation précoce native en paramètres, calcul, données et symptômes attendus d'alignement-dette.

## La faire partir

Cette leçon produit `outputs/skill-native-vs-posthoc-auditor.md`. En raison d'un plan de formation proposé pour le VLM, il vérifie si l'on doit se lancer en mode native ou post-hoc, identifie le risque d'alignement-endettement et recommande un corpus mix.

## Exercices

1. Évaluer le delta de calcul entre InternVL3-8B (pré-train natif) et LLaVA-OneVision-7B (post-hoc).

2. InternVL3 rapporte 40% de texte / 35% de sous-titres / 20% de vidéo. Si votre tâche cible est vidéo-cheveuse, proposez un nouveau ratio et expliquez pourquoi le modèle de base a encore besoin de données de texte et de sous-titres substantielles.

3. Lisez MM1.5 Section 4 sur l'oubli. Nommez le point de référence exact où l'entraînement post-hoc a montré la plus grande régression.

4. ViR envoie 60% du trafic à un codage à basse résolution. Quels types de requêtes est-il enroule (envoie à basse résolution lorsque la haute résolution est nécessaire)?

5. DvD divise la vision et le LLM en GPU séparées.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Native multimodal pretraining | "From scratch together" | Text + image + video tokens participate in the loss from step 1, not bolted on later |
| Alignment debt | "Post-hoc penalty" | Measurable regression in text skills and answer consistency that comes from bolting vision onto a frozen LLM |
| V2PE | "Variable visual pos encoding" | Per-modality learnable position encoding allocation; InternVL3's M-RoPE successor |
| ViR | "Resolution router" | Small classifier that picks minimum resolution needed per query before encoding, saving inference tokens |
| DvD | "Decoupled deployment" | Vision encoder on one GPU, LLM on another, with stream handoff; doubles throughput for large VLMs |
| InternVL-U | "Unified understanding + generation" | 2026 follow-up that adds image-generation heads to the native-pretrain backbone |
| Interleaved corpus | "OBELICS / MMC4" | Documents with text and images in natural reading order; the raw material for native pretraining |

## Pour en savoir plus

- [Chen et al. — InternVL 1 (arXiv:2312.14238)](https://arxiv.org/abs/2312.14238)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
- [InternVL3.5 (arXiv:2508.18265)](https://arxiv.org/abs/2508.18265)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Zhang et al. — MM1.5 (arXiv:2409.20566)](https://arxiv.org/abs/2409.20566)
