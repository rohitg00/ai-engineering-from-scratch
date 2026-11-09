# Attention Variantes  Fenêtre coulissante, épargne, différentielle

> Toutes les étiquettes sont un cercle, chaque jeton voit chaque jeton et la mémoire paie le prix.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 03 (Multi-Head), Phase 7 · 12 (KV Cache / Flash Attention)
**Time:** ~60 minutes

## Le problème

Coûts de l' attention totale $O(N^2)$mémoire et $O(N^2)$Pour un Llama 3 70B de 128K, qui est 16 milliards d'entrées d'attention par couche, par 80 couches.$O(N^2)$la mémoire d'activation mais ne change pas le coût arithmétique  chaque jeton continue de servir tous les autres jetons.

Trois classes de variantes modifient la topologie de la matrice d'attention elle-même:

1. **Sliding window attention (SWA).**Chaque jeton est à la fenêtre fixe des voisins, pas le préfixe complet.$O(N \cdot W)$où $W$Je suis la fenêtre, Gemma 2/3, les premières couches du Mistral 7B, Phi-3-Long.
2. **Sparse / block attention.**Seules les paires sélectionnées `(i, j)`Les autres sont obligés de ne pas peser.
3. **Differential attention.**Compute deux cartes d'attention avec des projections Q/K distinctes, en soustraisant l'une de l'autre.

Un modèle frontalier de 2026 les mélange souvent: la plupart des couches sont SWA-1024, chaque cinquième est une attention globale complète, et une poignée sont des têtes différentielles qui nettoient la récupération.

## Le concept

### Attention à la fenêtre coulissante (SWA)

Chaque requête à position $i$ne prend part qu'à des postes dans $[i - W, i]$(SWA de cause à effet) ou $[i - W/2, i + W/2]$Les jetons à l' extérieur de la fenêtre se retrouvent$-\infty$dans la matrice de score.

```
full causal:           sliding window (W=4):
positions 0-7          positions 0-7, W=4
    0 1 2 3 4 5 6 7        0 1 2 3 4 5 6 7
0 | x                0 |  x
1 | x x              1 |  x x
2 | x x x            2 |  x x x
3 | x x x x          3 |  x x x x
4 | x x x x x        4 |    x x x x
5 | x x x x x x      5 |      x x x x
6 | x x x x x x x    6 |        x x x x
7 | x x x x x x x x  7 |          x x x x
```

Pour $N = 8192$et $W = 1024$, la matrice de score a 1024 × 8192 rangées non zéro dans l'attente  une réduction de 8 ×.

**KV cache shrinks with SWA.**Seulement la dernière .$W$Les jetons de K et V doivent être conservés par couche. Pour une configuration Gemma-3-ish (1024 fenêtre, contexte 128K), le cache KV tombe 128x.

**Quality cost.**Les transformateurs SWA seulement ont du mal à récupérer à longue portée. La solution: interdire les couches SWA avec des couches d'attention pleine. Gemma 3 utilise 5:1 SWA:global. Mistral 7B utilise une pile SWA causale où l'information "fluit vers l'avant" à travers des fenêtres superposées  chaque couche étend le champ réceptif efficace par $W$, et après `L`couches que le modèle peut assister `L × W`Les jetons sont de retour.

### Attention à l' épargne / blocage

Choisissez une`N × N`Le modèle de sparsité à l'avance.

- **Local + strided (OpenAI sparse transformer).**Attends le dernier .$W$des jetons plus tous `stride`- Le symbole de la première fois.$O(N \cdot \sqrt{N})$- Je ne sais pas.
- **Longformer / BigBird.**Fenêtre locale + petit ensemble de jetons globaux (p. ex. `[CLS]`) qui assurent la participation de tous et sont assurés par tous + liens aléatoires.
- **Native Sparse Attention (DeepSeek, 2025).**Apprenez quelles sont les blocs de `(Q, K)`Il faut passer les blocs zéro au niveau du noyau.

L'attention épargnée est une histoire d'ingénierie du noyau. Les mathématiques sont simples (masquer la matrice de score); le gain vient de ne jamais charger les entrées zéro dans SRAM. FlashAttention-3 et l'API 2026 FlexAttention rendent les modèles épargnées personnalisés de première classe dans PyTorch.

### L'attention différentielle (transformateur DIFF, 2024)

L'attention régulière a un problème de "sink attention": softmax force chaque rangée à s'ajouter à 1, de sorte que les jetons qui ne veulent pas prendre en charge quoi que ce soit en particulier dépôt le poids sur le premier jeton (ou les premiers).

L' attention différentielle résout cela en calculant **two**cartes d'attention et soustraction:

```math
\begin{aligned}
A_1 &= \mathop{\mathrm{softmax}}(Q_1 K_1^T / \sqrt{d}) \\
A_2 &= \mathop{\mathrm{softmax}}(Q_2 K_2^T / \sqrt{d}) \\
\text{DiffAttn} &= (A_1 - \lambda \cdot A_2) V
\end{aligned}
```

où $\lambda$est un écalier appris (typiquement 0,50,8). A1 capture des poids de contenu réels; A2 capture le lavabo.

Résultats rapportés (Microsoft 2024): 510% de perplexité moindre, 1,52x de plus de contexte efficace à la même longueur formée, récupération plus nette de l'aiguille dans le paquet de foin.

### Comparaison variée

| Variant | Compute | KV cache | Quality vs full | Production use |
|---------|---------|----------|-----------------|----------------|
| Full attention | $O(N^2)$ | $O(N)$ per layer | baseline | every model's default layer |
| SWA (window 1024) | $O(N \cdot W)$ | $O(W)$ per layer | -0.1 ppl, good with global layers | Gemma 2/3, Phi-3-Long |
| Local + strided sparse | $O(N \cdot \sqrt{N})$ | mixed | similar to SWA | OpenAI sparse transformer, Longformer |
| BigBird (local + global + random) | $O(N)$ approx | mixed | matches full at 2× context | early long-context BERT |
| Native Sparse (DeepSeek-V3.2) | $O(N \cdot \text{active fraction})$ | $O(N)$ | within 0.05 ppl | DeepSeek-V3.2, 2025 |
| Differential | $O(2 \cdot N^2)$ | $O(2N)$ | -5 to -10% ppl | DIFF Transformer, early 2026 models |

```figure
gqa-kv-sharing
```

## Faites-le

Regardez !`code/main.py`, ou son port de Rust `code/main.rs`Pour exécuter la version Rust:`rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson`Nous mettons en œuvre un comparateur de masques causaux qui montre l'attention totale, SWA, locale + stridée et différentielle côte à côte sur une séquence de jouets.

### Étape 1: masque causal complet (ligne de base)

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

Ligne de base de la leçon 07. Triangulaire inférieur; poids nul au-dessus de la diagonale.

### Étape 2: masque causal de la fenêtre coulissante

```python
def swa_mask(n, window):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
    return M
```

Un paramètre  `window`Pour ...`window >= n`Vous récupérez l'attention causale complète.`window = 1`Chaque jeton ne sert que lui-même.

### Étape 3: masque local + masque à poids faible à pas

```python
def strided_mask(n, window, stride):
    M = [[float("-inf")] * n for _ in range(n)]
    for i in range(n):
        lo = max(0, i - window + 1)
        for j in range(lo, i + 1):
            M[i][j] = 0.0
        for j in range(0, i + 1, stride):
            M[i][j] = 0.0
    return M
```

Une fenêtre locale dense plus chaque fenêtre .`stride`Le champ réceptif se développe en étapes de journaux avec des couches supplémentaires.

### Étape 4: attention différentielle

```python
def diff_attention(Q1, K1, Q2, K2, V, lam):
    A1 = softmax_causal(Q1 @ K1.T / sqrt_d)
    A2 = softmax_causal(Q2 @ K2.T / sqrt_d)
    return (A1 - lam * A2) @ V
```

Deux passes d'attention, soustraire avec un coefficient de mélange appris. Dans le code, nous comparons la carte thermique attention-sink de unique versus différentiel et regarder l'évier s'effondrer.

### Étape 5: Tailles de cache KV

Imprimez la taille du cache par couche à $N = 131072$Les variantes SWA et les variantes rares diminuent de 10 à 100 fois.

## Utilisez-le

Modèles de production 2026:

```python
from transformers import AutoModelForCausalLM
# Gemma 3 mixes SWA (window=1024) and global layers at 5:1.
model = AutoModelForCausalLM.from_pretrained("google/gemma-3-27b-it")
# print(model.config.sliding_window, model.config.layer_types)
```

FlexAttention dans PyTorch 2.5+ accepte une fonction de masque:

```python
from torch.nn.attention.flex_attention import flex_attention, create_block_mask

def swa_pattern(b, h, q_idx, kv_idx):
    return (q_idx - kv_idx < 1024) & (q_idx >= kv_idx)

mask = create_block_mask(swa_pattern, B=batch, H=heads, Q_LEN=n, KV_LEN=n)
out = flex_attention(q, k, v, block_mask=mask)
```

Cela se compile à un noyau Triton personnalisé. Dans les 10% de la vitesse FlashAttention-3 pour les modèles communs, et la fonction de masque est un Python appelable.

**When to pick each:**

- **Pure full attention** chaque couche jusqu'à ~ 16K de contexte, ou lorsque la qualité de récupération est primordiale.
- **SWA + global mix** long context (> 32K), formation et inférence liées à la mémoire.
- **Sparse block attention** noyau personnalisé, modèle personnalisé. réservé aux charges de travail spécialisées (retrait, audio).
- **Differential attention** toute charge de travail où la contamination par la prise d'attention fait mal (RAG à long contexte, aiguille dans un tas de foin).

## La faire partir

Regardez !`outputs/skill-attention-variant-picker.md`. La compétence choisit une topologie d'attention pour un nouveau modèle compte tenu de la longueur du contexte cible, des exigences de récupération et du profil de calcul de formation/inférence.

## Exercices

1. **Easy.**On court .`code/main.py`- Vérifiez la SWA à l' adresse `window=4`- Il n'y a pas de code de la ligne de débit.`window=n`reproduit l'attention causal complète de manière bit-identique.
2. **Medium.**Implémentation de l' SWA de causalité avec `window=1024`En train de 1000 pas sur Tinyshakespeare, combien de valence perd la récession par rapport à l'attention totale ?
3. **Hard.**Implémenter un mélange de couches 5:1 de style Gemma-3 (5 SWA, 1 global) dans le modèle de capstone. Comparer la perte, la mémoire et la qualité de génération contre les lignes de base pur-SWA et pur-global à des paramètres correspondants.
4. **Hard.**Mettre en œuvre une attention différentielle avec un apprenant $\lambda$Les résultats de la recherche sont les suivants:

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Sliding window attention (SWA) | "Local attention" | Each query attends to its last $W$ tokens; KV cache shrinks to $O(W)$. |
| Effective receptive field | "How far back the model sees" | In an $L$-layer SWA stack with window $W$, up to $L \times W$ tokens. |
| Longformer / BigBird | "Local + global + random" | Sparse patterns with a few always-attending global tokens; early long-context approach. |
| Native Sparse Attention | "DeepSeek's kernel trick" | Learn block-level sparsity; skip zero blocks at the kernel level while keeping quality. |
| Differential attention | "Two maps, one subtracts" | DIFF Transformer: subtract a learned $\lambda$ times a second attention map from the first to cancel attention sinks. |
| Attention sink | "Weight bleeds to token 0" | Softmax normalization forces rows to sum to 1; uninformative queries dump weight on position 0. |
| FlexAttention | "Mask-as-Python" | PyTorch 2.5+ API that compiles arbitrary mask functions into FlashAttention-shape kernels. |
| Layer type mix | "5:1 SWA-to-global" | Interleave sparse and full attention layers in a stack to keep quality at lower memory. |

## Pour en savoir plus

- [Beltagy, Peters, Cohan (2020). Longformer: The Long-Document Transformer](https://arxiv.org/abs/2004.05150) le papier canonique de vitre coulissante + le papier de jeton global.
- [Zaheer et al. (2020). Big Bird: Transformers for Longer Sequences](https://arxiv.org/abs/2007.14062) local + mondial + aléatoire.
- [Child et al. (2019). Generating Long Sequences with Sparse Transformers](https://arxiv.org/abs/1904.10509) Le modèle local+réciproque d'OpenAI.
- [Gemma Team (2024). Gemma 2: Improving Open Language Models at a Practical Size](https://arxiv.org/abs/2408.00118) le mélange 1:1 SWA:global.
- [Gemma Team (2025). Gemma 3 technical report](https://arxiv.org/abs/2503.19786) le mix 5:1 avec window=1024 qui est maintenant le manuel par défaut.
- [Ye et al. (2024). Differential Transformer](https://arxiv.org/abs/2410.05258) papier transformateur DIFF.
- [Yuan et al. (2025). Native Sparse Attention](https://arxiv.org/abs/2502.11089) L'attention de l'apprentissage de la sparsité de DeepSeek-V3.2.
- [PyTorch — FlexAttention blog and docs](https://pytorch.org/blog/flexattention/) Reference API pour le modèle de masque comme appel dans Utilisez-le.
