# Attention différentielle (V2)

> L'attention Softmax répand une petite quantité de probabilité sur chaque jeton non correspondant. Plus de 100 000 jetons qui ajoutent du bruit et noient le signal. Le transformateur différentiel (Ye et al., ICLR 2025) le corrige en calculant l'attention comme la différence de deux softmaxes, en soustrayant le sol de bruit partagé. DIFF V2 (Microsoft, janvier 2026) est la réécriture de la pile de production: correspondant la latence de décode à la ligne de base Transformer, aucun noyau personnalisé, compatible avec FlashAttention. Cette leçon est de bout en bout V1 à V2, avec une mise en œuvre de jeu de travail de l'opération différence que vous pouvez exécuter dans stdlib Python.

**Type:** Build
**Languages:** Python (stdlib), Rust
**Prerequisites:** Phase 7 · 02 (self-attention), Phase 7 · 15 (attention variants), Phase 10 · 14 (architecture walkthrough)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Expliquez précisément pourquoi l'attention softmax a un sol de bruit et pourquoi elle augmente avec la longueur du contexte.
- Dériver la formule d'attention différentielle et expliquer pourquoi la soustraction annule le composant de bruit partagé tout en préservant le signal.
- Parcourez la différence entre V1 et V2: ce qui est devenu plus rapide, ce qui est devenu plus simple, ce qui est devenu plus stable, et pourquoi chaque changement était nécessaire pour la formation préalable à la production.
- Implémenter l'attention différentielle à partir de zéro dans Python pur et vérifier empiriquement la propriété d'annulation du bruit sur une requête synthétique signal-plus-bruit.

## Le problème

L'attention standard softmax a une propriété mathématique qui se transforme en un mal de tête opérationnel à l'échelle.`q`, les poids d' attention sont `softmax(qK^T / sqrt(d))`Softmax ne peut jamais produire de zéros exacts: chaque jeton non correspondant obtient une masse positive. Cette masse résiduelle est du bruit, et elle s'égale avec la longueur du contexte.

En empirie, cela apparaît comme une interference de la tête d'attention: des citations hallucinées dans des RAG de long contexte, des échecs perdus au milieu sur les tâches de récupération de 100k-tokens et une dégradation subtile de la précision sur les points de référence de l'aiguille dans le paillot de foin après 32k. Le document Transformateur différentiel (arXiv:2410.05258, ICLR 2025) a mesuré l'écart: les Transformateurs DIFF ont atteint une plus faible perplexité, une plus grande précision dans le long contexte et moins d'hallucinations que les lignes de base de la même taille.

Le DIFF V1 avait trois problèmes qui l'ont empêché de se rendre dans les pipelines de pré-entraînement frontaliers. Son cache de valeur devait être chargé deux fois par étape de décode, il nécessitait des noyaux CUDA personnalisés qui rompaient la compatibilité FlashAttention, et son RMSNorm par tête déstabilisé l'entraînement à long terme à l'échelle 70B-plus. DIFF V2 (blog unilm de Microsoft, 20 janvier 2026) a corrigé les trois. Cette leçon traverse les deux versions, construit l'opérateur de différence et compare l'annulation du bruit sur une requête de jouet.

## Le concept

### Le sol bruyant de softmax

Pour une question `q`et les clés `K = [k_1, ..., k_N]`, les poids d'attention sont:

```math
w_i = \frac{\exp(q \cdot k_i / \sqrt{d})}{\sum_j \exp(q \cdot k_j / \sqrt{d})}
```

- Je ne veux pas .`w_i`est toujours zéro.`k_i`est totalement sans rapport avec `q`, le score `q . k_i`n' est pas 0  il fluctue autour de zéro avec la variance `||q||^2 / d`Après la normalisation de softmax, chaque jeton non lié continue de contribuer `O(1/N)`La contribution totale des jetons non liés est `O((N-1)/N) = O(1)` pas une petite quantité.

Ce que le modèle veut, c'est un truc comme un top-k dur: un poids élevé sur les jetons correspondants, un poids presque nul partout ailleurs.

### L'idée différentielle

Divisez les projections Q et K de chaque tête en deux: $Q = (Q_1, Q_2)$et $K = (K_1, K_2)$Compute deux cartes d' attention:

```math
\begin{aligned}
A_1 &= \mathop{\mathrm{softmax}}(Q_1 K_1^T / \sqrt{d}) \\
A_2 &= \mathop{\mathrm{softmax}}(Q_2 K_2^T / \sqrt{d})
\end{aligned}
```

Résultats:

```math
\mathop{\mathrm{DiffAttn}} = (A_1 - \lambda \cdot A_2) V
```

La soustraction annule toute distribution de bruit que les deux cartes partagent. Si les deux cartes ont un poids approximativement uniforme sur les 127k jetons non liés (qui ils le feront, à l'initialisation aléatoire), ceux-ci annulent. Le signal  poids maximum sur les quelques jetons réellement pertinents  annule uniquement s'il apparaît dans les deux cartes à la même magnitude, ce qui ne le sera pas une fois que le modèle traîne.

`lambda`est un échelle par tête appréciable, paramétrisé comme `lambda = exp(lambda_q1 dot lambda_k1) - exp(lambda_q2 dot lambda_k2) + lambda_init`- Ça peut être négatif.`lambda_init`par défaut à un petit nombre positif comme 0,8.

### Pourquoi cette correspondance de direction de l'annulation du bruit

Si vous retenez l'un de l'autre, le bruit partagé disparaît. La voix survit parce que les deux signaux diffèrent en phase ou en amplitude suffisamment pour éviter une annulation complète.`lambda`apprend exactement cet équilibre.

### V1 contre V2: la différence

V1 a maintenu le nombre de paramètres égal au transformateur de ligne de base. Pour obtenir deux requêtes par tête, il a réduit de moitié la dimension de tête. Cela a coûté la expressivité de la tête et  plus douloureusement  a réduit de moitié le cache de valeur par tête.

Le V2 double le nombre de têtes de requête et garde les têtes KV les mêmes (empruntant des paramètres de la projection vers le haut). La dimension de tête reste la même que la ligne de base. Après la soustraction, la dimension supplémentaire est projetée vers le bas pour correspondre à la ligne de base du Transformateur $O_W$Trois choses se produisent à la fois:

1. La vitesse de décode correspond à la ligne de base (le cache KV est chargé une fois).
2. FlashAttention fonctionne inchangé (pas de noyau personnalisé).
3. L'intensité arithmétique au décode augmente (plus de calcul par octet chargé à partir de HBM).

V2 supprime également le RMSNorm par tête que V1 utilisait pour stabiliser la soustraction. À des échelles de pré-entraînement de classe 70B, ce RMSNorm déstabilisait la formation tardive. V2 le remplace par un schéma d'initialisation plus simple qui maintient la formation stable sans le module supplémentaire.

### Quand le trouver ?

| Workload | Benefit |
|----------|---------|
| Long-context RAG (64k+) | Cleaner attention maps, fewer hallucinated citations |
| Needle-in-haystack benchmarks | Substantial accuracy lift past 32k |
| Multi-document QA | Less cross-document interference |
| Code completion at 8k | Marginal, not worth the architecture change |
| Short chat (< 4k) | Essentially indistinguishable from baseline |

La valeur augmente avec la longueur du contexte. à 4k les jetons le sol bruyant est assez petit pour que l'attention standard est bien. à 128k il vous fait mal.

### Comment il s' amassent avec les autres boutons 2026

| Feature | Compatible with DIFF V2? |
|---------|------------------------|
| GQA | Yes (V2 increases Q heads, not KV heads) |
| MLA (DeepSeek) | Yes in principle, no published paper combining them |
| MoE | Yes (attention is independent of MLP block) |
| RoPE | Yes (unchanged) |
| YaRN / long-context scaling | Yes (exactly where DIFF helps most) |
| FlashAttention | Yes in V2 (was no in V1) |
| Speculative decoding | Yes (attention change is invisible to the spec-decode loop) |

```figure
differential-attention
```

## Faites-le

`code/main.py`Une requête de jouet avec une structure signal-plus-bruit connue vous permet de mesurer directement le rapport bruit-annulation.

### Étape 1: attention de softmax standard

Opérations de matrice Stdlib: listes de listes, matmul manuel, softmax avec soustraction numérique-stabilité du max.

```python
def softmax(row):
    m = max(row)
    exps = [math.exp(x - m) for x in row]
    s = sum(exps)
    return [e / s for e in exps]
```

### Étape 2: Divisez Q, K en deux parties

V1 style: réduire de moitié la dimension de la tête. V2 style: maintenir la dimension de la tête et doubler le nombre de têtes. La mise en œuvre du jouet utilise V1 pour une clarté pédagogique  les mathématiques sont identiques, seulement la comptabilité diffère.

### Étape 3: deux branches de softmax + soustraction

```python
A1 = [softmax([dot(q1, k) / scale for k in K1]) for q1 in Q1]
A2 = [softmax([dot(q2, k) / scale for k in K2]) for q2 in Q2]
diff_weights = [[a1 - lam * a2 for a1, a2 in zip(r1, r2)] for r1, r2 in zip(A1, A2)]
out = [[sum(w * v[j] for w, v in zip(row, V)) for j in range(d_v)] for row in diff_weights]
```

Remarque: les poids de sortie peuvent être négatifs. C'est bien  le cache de valeur traite toujours les contributions signées. La projection V suivante absorbe le signe.

### Étape 4: Mesure de l'annulation du bruit

Construisez une séquence synthétique de longueur 1024. Placez le signal dans une position connue, remplissez le reste de bruit. Comptez a) le poids d'attention standard softmax sur la position du signal et b) le poids d'attention différentiel. Mesurer le rapport signal-bruit dans chacun. L'attention DIFF produit de manière fiable un rapport signal-bruit plus élevé de 3x à 10x selon la différence entre les deux branches.

### Étape 5: Comptabilité des paramètres V1 contre V2

En fonction de la configuration (occultée = 4096, têtes = 32, d_tête = 128), imprimez:

- Transformateur de base: Q, K, V de chaque taille `hidden * hidden`, MLP à 4 * caché.
- DIFF V1: Q, K de chaque taille `hidden * hidden`, taille V `hidden * hidden`(Inchangé), tête épaisse à moitié à l'intérieur.`lambda`Paramètres $(O(\text{heads} \cdot d_{\text{head}}))$- Je suis désolé .
- DIFF V2: taille Q `2 * hidden * hidden`, taille K `hidden * hidden`, taille V `hidden * hidden`- Extra faible projeté vers le bas avant .$O_W$- Ajoutée la même chose .`lambda`Paramètres.

Le jouet mesure le coût de paramètre supplémentaire pour V2 (environ `hidden * hidden`Il est également possible de l'imprimer.

## Utilisez-le

DIFF V2 n'est pas encore livré dans tous les serveurs d'inférence de production en avril 2026, mais l'intégration est en cours dans vLLM et SGLang.

- Modèles de production internes de long contexte de Microsoft.
- Des réplications de recherche dans plusieurs formations de modèle ouvert ciblant 256k plus de contextes.
- Des architectures hybrides qui combinent l'attention DIFF avec l'attention des fenêtres coulissantes sur des couches alternatives.

Quand vous atteindriez cela en 2026:

- La formation d'un nouveau modèle à partir de zéro, en ciblant un contexte efficace de 64k et plus.
- Un modèle de long-context où les défaillances perdues dans le milieu dominent votre évaluation.

Quand vous ne le feriez pas:

- Vous utilisez un modèle dense prétrainé avec des performances stables dans un contexte long.
- Votre contexte est toujours inférieur à 16 000 et le niveau sonore est négligeable.

## La faire partir

Cette leçon produit `outputs/skill-diff-attention-integrator.md`. Compte tenu de l'architecture du modèle, de la longueur du contexte cible, du profil d'hallucination et du budget de formation, il produit un plan d'intégration pour ajouter une attention différentielle à une nouvelle course pré-entraînement ou à un ajustement de la LoRA.

## Exercices

1. On court .`code/main.py`- vérifier que le rapport signal-bruit rapporté pour l'attention différentielle est supérieur à l'attention softmax standard sur la requête synthétique.

2. Comptez le delta de comptage des paramètres de la ligne de base à la DIFF V1 et de la ligne de base à la DIFF V2 pour un modèle de classe 7B (hidden=4096, heads=32, d_head=128, 32 couches). Affichez quels composants ont obtenu des paramètres et lesquels sont restés les mêmes.

3. Lisez la section 3 du document DIFF V1 (arXiv:2410.05258) et la section 2 du blog DIFF V2 Hugging Face.

4. Implémenter une ablation: calculer l' attention différentielle avec `lambda = 0`(première pure douceur max) et `lambda = 1`(soustraction complète). Dans la requête synthétique, mesurer comment le signal-à-bruit change à travers le balayage.`lambda`qui maximisent le signal-au-bruit.

5. Extension du jouet à GQA + DIFF V2. Choisissez 8 têtes KV et 32 têtes Q. Montrez que la taille du cache KV correspond à un modèle GQA de base avec la même configuration (8, 32).

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Differential attention | "Two softmaxes minus each other" | Split Q, K into two halves, compute two softmax maps, subtract the second (scaled by $\lambda$) from the first, then multiply by V |
| Noise floor | "The non-zero tail of softmax" | The $O(1/N)$ weight softmax puts on every unrelated token, which sums to $O(1)$ across long contexts |
| lambda | "The subtraction scale" | Per-head learnable scalar parameterized as `exp(lq1.lk1) - exp(lq2.lk2) + lambda_init`; can be negative |
| DIFF V1 | "The ICLR 2025 version" | Original Differential Transformer; halves head dim to preserve parameter count, needs custom kernel, slower decode |
| DIFF V2 | "The January 2026 fix" | Doubles Q heads keeping KV heads; matches baseline decode speed and works with FlashAttention |
| Per-head RMSNorm | "The V1 stabilizer" | Extra norm V1 applied after the difference; V2 removed it to prevent late-training instability |
| Signal-to-noise ratio | "How much attention is wasted" | Ratio of weight on the true signal position to average weight on unrelated positions |
| Lost in the middle | "Long-context failure mode" | Empirical phenomenon where retrieval accuracy dips for documents in the middle of a long context — DIFF attention reduces this |
| Arithmetic intensity | "FLOPs per byte loaded" | Ratio V2 increased at decode by doubling queries per KV load; important for memory-bound decode |

## Pour en savoir plus

- [Ye et al. — Differential Transformer (arXiv:2410.05258, ICLR 2025)](https://arxiv.org/abs/2410.05258) le document original avec la théorie de l'annulation du bruit et des ablations de long contexte
- [Microsoft unilm — Differential Transformer V2 (Hugging Face blog, January 2026)](https://huggingface.co/blog/microsoft/diff-attn-v2) la réécriture de la pile de production, le décode de la ligne de base correspondant, compatible avec FlashAttention
- [Understanding Differential Transformer Unchains Pretrained Self-Attentions (arXiv:2505.16333)](https://arxiv.org/abs/2505.16333) analyse théorique de la raison pour laquelle la soustraction récupère la structure d'attention prétrainée
- [Shared DIFF Transformer (arXiv:2501.17900)](https://arxiv.org/html/2501.17900) Variante de partage des paramètres
- [Vaswani et al. — Attention Is All You Need (arXiv:1706.03762)](https://arxiv.org/abs/1706.03762) le DIFF de transformateur de base soustrait de
- [Liu et al. — Lost in the Middle (arXiv:2307.03172)](https://arxiv.org/abs/2307.03172) les objectifs d'attention du DIFF en matière de référence à long terme
