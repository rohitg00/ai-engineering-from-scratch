# Jamba  Transformateur SSM hybride

> Les modèles spatiaux d'État (SSM) et les transformateurs veulent des choses différentes. Les transformateurs achètent la qualité à un coût quadratique. Les SSM achètent l'inférence linéaire et la mémoire constante par une récurrence mais un retard qualité. Jamba (mars 2024) et Jamba 1.5 (août 2024) d'AI21 les mettent dans le même modèle: 1 couche transformateur pour chaque 7 couches Mamba, MoE sur chaque autre bloc, et une fenêtre contextuelle de 256k qui s'adapte à un seul GPU de 80 Go. Mamba-3 (ICLR 2026) resserre le côté SSM avec des espaces d'état de valeur complexe et des projections MIMO. Cette leçon explique pourquoi la recette hybride a survécu à trois ans d'évolution alors que les tentatives de long-context pur-SSM et pur-Transformer n'en ont pas.

**Type:** Learn
**Languages:** Python (stdlib, layer-mix calculator), Rust
**Prerequisites:** Phase 10 · 14 (open-model architectures), Phase 10 · 17 (native sparse attention)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Expliquez les trois primitives dans un bloc Jamba  couches transformateur, couches Mamba, MoE  et la recette 1:7: même interlacer.
- Expliquer à quel point la récurrence d'un SSM ressemble à un niveau élevé et pourquoi elle permet l'inférence de mémoire constante.
- Computez l'empreinte cache KV d'un modèle Jamba à 256k de contexte et comparez à ce dont un modèle transformateur pur aurait besoin.
- Nombre des trois innovations Mamba-3 (discrétisation exponentielle-trapézoïdale, mise à jour de l'état à valeur complexe, MIMO) et le problème visé par chacune.

## Le problème

L'attention est quadratique en longueur de séquence. Les modèles d'espace d'état sont linéaires. Cette différence est composée: à 256k jetons, une carte d'attention Transformer est de 65B entrées par tête; l'état récurrent d'un SSM est de taille fixe indépendamment de la longueur de la séquence.

Les modèles SSM purs (Mamba, Mamba-2) correspondent à la complexité des transformateurs à petite échelle, mais sont en retard sur les tâches de suivi de l'état et échouent dans certaines catégories de récupération dans le contexte.

La solution évidente: utiliser les deux. Mettez les couches de Transformer là où le rappel exact compte. Utilisez les couches SSM ailleurs. Ajustez le rapport. Jamba est le premier modèle de production à expédier cette recette hybride à l'échelle (52B au total, 12B actif, 256k contexte, GPU unique de 80 Go). Jamba 1.5 étend la famille à 398B au total / 94B actifs. Mamba-3 (ICLR 2026) est la meilleure base de base de SSM pure actuelle autour de laquelle les hybrides peuvent être reconstruits.

Cette leçon lit les trois articles et produit le modèle mental pour "choisir le bon rapport".

## Le concept

### Un SSM en une page

Un modèle spatial d' état traite une séquence `x_1, ..., x_N`par un état de taille fixe `h`- Le numéro de la liste:

```math
\begin{aligned}
h_t &= A h_{t-1} + B x_t \\
y_t &= C h_t
\end{aligned}
```

À chaque étape , l' état évolue par une dynamique linéaire .`A`, prend des informations `B x_t`, et émet des sorties `C h_t`- Je suis là .`A, B, C`Il est important de noter la propriété critique:`y_t`seulement besoin `h_{t-1}`et `x_t`Pas plus tôt .`x`La mémoire est constante, l'inférence est constante.$O(1)$par jeton.

Le truc de la qualité de la modélisation est la structure de`A`. S4 (Gu 2021) a utilisé une matrice très structurée qui pouvait être évaluée efficacement en tant que longue convolutions pendant la formation.`A, B, C`Mamba-2 (2024) a encore simplifié la structure. Mamba-3 (2026) ajoute de nouveau la complexité dans des lieux spécifiques.

La propriété clé: pour un décodeur LLM, une couche SSM est un remplacement déroulant d'une couche attention, avec un état de taille fixe par couche au lieu d'un cache KV en croissance.

### Le bloc de Jamba

Un bloc de Jamba interpose des couches selon deux nombres:

- `l`Le rapport attention-Mamba.`l = 8`, soit 1 couche transformateur pour chaque 7 couches de Mamba (7 Mamba + 1 Attention = 8 couches par groupe).
- `e`: la fréquence MoE.`e = 2`, ce qui signifie que chaque autre couche s'applique à MoE.

La séquence de couches dans un bloc:

```
M  M  M  M  M  M  M  A    (7 Mamba + 1 Attention)
|  M  |  M  |  M  |  M    (where | marks MoE applied)
```

Chaque bloc Jamba est de 8 couches. À 4 blocs de profondeur (32 couches au total), vous obtenez 28 Mamba et 4 couches Attention.

### Pourquoi le rapport 1:7

AI21 a exécuté des ablations: quel rapport attention-à-mamba donne la meilleure perplexité par paramètre ET rappel dans le contexte sur leurs évaluations de long contexte?

- Trop d'attention (1:1): la qualité augmente mais la mémoire et la vitesse se dégradent.
- Trop peu d'attention (1:15): la mémoire est excellente mais la récupération dans le contexte échoue.
- Le point de départ: 1:7 ou 1:8.

L'intuition: les couches Transformer gèrent le rappel exact et le suivi de l'état.

### Codification de position

Les couches de Mamba sont elles-mêmes conscientes de la position (via la récurrence). Les couches d'attention des hybrides originaux à base de Mamba n'ont pas utilisé RoPE  les couches SSM fournies informations de position. Jamba 1.5 ajoute RoPE aux couches d'attention pour une généralisation de contexte plus longue, un raffinement post-hoc basé sur l'évaluation empirique du contexte long.

### Le budget de la mémoire

Pour une forme Jamba-1 (32 couches: 28 Mamba + 4 Attention, 4096, 32 têtes d'attention cachées):

- Cache KV (seulement les couches d'attention): `2 * 4 * 32 * 128 * 256k * 2 = 16 GB`Le Jamba libéré utilise GQA avec 8 têtes KV dans ces couches, ce qui porte à 4 GB, le chiffre dans le papier Jamba.
- État du MSS: `28 * hidden * state_size`par préfixe de jeton, mais c'est une taille fixe par couche, pas en évolue avec la longueur de la séquence.`28 * 4096 * 16 * 2 = 3.7 MB`- Tout à fait.

Comparer à un transformateur pur à 32 couches, le même caché, plein MHA à 32 têtes: `2 * 32 * 32 * 128 * 256k * 2 = 128 GB`En effet, la plupart des modèles 2024 utilisent des modèles de base (environ 8 fois plus de KV) que les modèles de base (environ 8 fois plus de KV).`2 * 32 * 8 * 128 * 256k * 2 = 32 GB`Le Jamba, à 4 Go, est 8 fois plus petit.

C'est ce que signifie AI21 par "context 256k sur un seul GPU de 80 Go". Le cache KV d'un transformateur pur à MHA complet ne conviendrait pas; même une ligne de base GQA ne laisse aucune place aux poids et aux activations; Jamba le fait.

### Mamba-3: la ligne de base de la MSS pure en 2026

Mamba-3 (ICLR 2026, arXiv:2603.15569) présente trois innovations sur le côté pur du SSM:

1. **Exponential-trapezoidal discretization.**Remplace la discrétion de la méthode Euler dans Mamba-2 par une récurrence plus expressive.`x_t`- Je suis désolé .

2. **Complex-valued state update.**Les Mamba précédents ont réduit la matrice d'état de complexe (S4) à diagonale réelle (Mamba) à identité à l'échelle (Mamba-2). Mamba-3 ajoute de nouveau des valeurs complexes  équivalentes à une intégration rotative dépendante des données sur l'état. Cela restaure les capacités de suivi de l'état qui coûtent les simplifications précédentes à valeur réelle.

3. **Multi-input multi-output (MIMO) projections.**Au lieu de projections scalaires par fonction, utilisez des projections à valeur de matrice. Améliore la puissance de modélisation et l'utilisation du matériel de temps d'inférence sans augmenter la latence de décode.

À 1,5B, Mamba-3 améliore la précision moyenne en aval de 0,6 points par rapport au Gated DeltaNet; la variante MIMO ajoute 1,2 points de plus pour un gain total de 1,8 points.

Mamba-3 n'est pas encore livré dans un hybride de production à l'échelle  mais c'est le candidat évident pour le côté SSM du prochain modèle de la classe Jamba.

### Quand trouver un hybride

Les hybrides gagnent lorsque:

- Le contexte est assez long pour que le cache KV Transformer pur soit douloureux (64k+).
- Les tâches mélangent structure à courte portée (bon pour SSM) avec rappel à longue portée (necessité de transformateur).
- Vous voulez déployer sur des budgets de mémoire GPU uniques où le cache KV Transformer seul ne conviendrait pas.

Les hybrides perdent lorsque:

- Le contexte est court (moins de 16k).
- Les tâches nécessitent une attention partout-à-tout (réflexion profonde, référence croisée de plusieurs documents).
- Vous êtes en train d'évoluer vers des modèles frontaliers de plusieurs milliards de paramètres. Pure-Transformer + MLA + MoE (style DeepSeek-V3) remporte actuellement la course de capacité.

### Le paysage concurrentiel

| Model | Family | Scale | Unique claim |
|-------|--------|------|-------------|
| Mamba-2 | pure SSM | 3B | linear time, constant memory |
| Jamba | hybrid | 52B/12B | 256k on 80GB |
| Jamba 1.5 Large | hybrid | 398B/94B | enterprise-grade long-context |
| Mamba-3 | pure SSM | 1.5B (paper) | state-tracking restored |
| DeepSeek-V3 | pure Transformer + MoE | 671B/37B | frontier capability |

Le paysage 2026: le MoE transformateur pur domine la frontière, mais les hybrides possèdent la niche contextuelle de 256k plus.

```figure
swiglu-ffn
```

## Utilisez-le

`code/main.py`est une calculatrice de mémoire pour les architectures hybrides.

- Le cache KV dans le contexte cible.
- La mémoire de l'état SSM.
- La mémoire totale au contexte N pour une gamme de formes de modèle.

La calculatrice prend en charge:

- L'indice de base de la transformation pure (la cache KV augmente avec N).
- Hybride à style Jamba 1:7
- Le système de gestion des données (SSM) est pur (pas de cache KV du tout).

Les chiffres sont directement tirés des documents Jamba-1 et Jamba-1.5 pour les formes publiées et extrapolés pour les variantes hypothétiques.

Les considérations d'intégration pour un déploiement réel:

- La plupart des serveurs d'inférence de production (vLLM, SGLang) prennent en charge Jamba et Mamba.
- Dans le même VRAM, vous installez plus de séquences Jamba que de séquences Transformer.
- Mamba-3 en tant que modèle autonome n'est pas encore livré en production  recherche prévisualisation à 1.5B.

## La faire partir

Cette leçon produit `outputs/skill-hybrid-picker.md`. Compte tenu de la spécification de la charge de travail (profil de longueur de contexte, mix de tâches, budget de mémoire), il recommande de choisir entre un transformateur pur, un hybride de style Jamba et un SSM pur, en raison explicite des compromis entre la mémoire et la qualité.

## Exercices

1. On court .`code/main.py`Pour calculer le cache KV à 256k context pour un transformateur pur à 32 couches (couches cachées 4096, 32 têtes) et pour un hybride Jamba-1 de la même forme.

2. Modifier la calculatrice pour modéliser un hybride 1:3 (4 Mamba: 1 Attention) et un hybride 1:15 (14 Mamba: 1 Attention).

3. Lisez la section 3 du document Jamba (arXiv:2403.19887). Expliquez pourquoi AI21 utilise Mamba-1 plutôt que Mamba-2 malgré le fait que Mamba-2 soit plus rapide.

4. Comparer le rapport actif à DeepSeek-V3 (37B/671B) et expliquer pourquoi l'architecture de Jamba pousse le rapport actif plus haut.

5. Lisez la section 3 du document Mamba-3 (arXiv:2603.15569). Expliquez en trois phrases pourquoi une mise à jour d'état à valeur complexe est équivalente à une intégration rotative dépendante des données.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| State space model (SSM) | "Recurrence with a fixed state" | A layer with a learned recurrence `h_t = A h_{t-1} + B x_t`; constant memory per token |
| Selective SSM | "Mamba's trick" | Data-dependent A, B, C parameters that give the model gating-like selectivity at linear time |
| Attention-to-Mamba ratio | "How many attention layers" | In Jamba, `l = 8` means 1 attention layer per 7 Mamba layers |
| Jamba block | "The 8-layer group" | One attention + seven Mamba + MoE on alternate positions |
| SSM state | "The hidden buffer" | Fixed-size per-layer state that replaces the KV cache for Mamba layers |
| 256k context | "Jamba's flagship number" | The sequence length Jamba-1 fits on a single 80GB GPU; pure Transformer cannot at that size |
| Mamba-3 | "2026 pure SSM" | Current-best pure-SSM architecture with complex state + MIMO; the baseline hybrids rebuild around |
| MIMO | "Multi-input multi-output" | Mamba-3 innovation using matrix-valued projections instead of scalar per-feature |
| Exponential-trapezoidal discretization | "Mamba-3's recurrence" | More expressive recurrence that subsumes Mamba-2's Euler-method discretization |
| Hybrid architecture | "Mix attention and SSM" | Any model that interleaves Transformer and SSM layers; Jamba is the production archetype |

## Pour en savoir plus

- [Lieber et al. — Jamba: A Hybrid Transformer-Mamba Language Model (arXiv:2403.19887)](https://arxiv.org/abs/2403.19887) le papier Jamba original, ablations de ratio, revendication de contexte 256k
- [AI21 — Jamba 1.5: Hybrid Transformer-Mamba at Scale (arXiv:2408.12570)](https://arxiv.org/abs/2408.12570) la famille de la mise à l'échelle, 398B/94B et 12B/52B publications
- [Gu, Dao — Mamba: Linear-Time Sequence Modeling with Selective State Spaces (arXiv:2312.00752)](https://arxiv.org/abs/2312.00752) le papier sélectif du MSS sur lequel Jamba s'appuie
- [Dao, Gu — Mamba-2 (arXiv:2405.21060)](https://arxiv.org/abs/2405.21060) le successeur simplifié de l'espace État structuré
- [Lahoti et al. — Mamba-3 (arXiv:2603.15569, ICLR 2026)](https://arxiv.org/abs/2603.15569) État à valeur complexe, MIMO, frontière 2026 pure-SSM
- [Gu et al. — Efficiently Modeling Long Sequences with Structured State Spaces (arXiv:2111.00396)](https://arxiv.org/abs/2111.00396) le document S4, point de départ de la généalogie SSM pour les LLM
