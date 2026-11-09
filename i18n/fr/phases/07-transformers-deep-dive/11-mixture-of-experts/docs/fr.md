# Le groupe d'experts (MoE)

> Un transformateur dense 70B active tous les paramètres pour chaque jeton. Un MoE 671B active seulement 37B par jeton et le bat sur chaque référence.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## Le problème

Les FLOP d'un transformateur dense sont à l'inférence égaux au nombre de paramètres (deux fois pour le passage à l'avant).

Le mélange d'experts rompt ce lien.$E$experts indépendants + un routeur qui choisit $k$Parmi les paramètres de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de la valeur de cette valeur de cette valeur de cette valeur de cette valeur de cette valeur de cette valeur de cette valeur de cette valeur de cette valeur,$E \times \text{FFN size}$. Paramètres actifs par jeton = $k \times \text{FFN size}$. Configuration typique pour 2026: $E=256$- Je suis là .$k=8$- Balances de stockage avec$E$, calculer des échelles avec $k$- Je suis désolé .

La frontière 2026 est presque entièrement MoE: DeepSeek-V3 (671B total / 37B actif), Mixtral 8×22B, Qwen2.5-MoE, Llama 4, Kimi K2, gpt-oss.

## Le concept

![MoE layer: router selects k of E experts per token](../assets/moe.svg)

### Le swap FFN

Bloc de transformateur dense:

```
h = x + attn(norm(x))
h = h + FFN(norm(h))
```

Bloc de la moée:

```
h = x + attn(norm(x))
scores = router(norm(h))              # (N_tokens, E)
top_k = argmax_k(scores)              # pick k of E per token
h = h + sum_{e in top_k}(
        gate(scores[e]) * Expert_e(norm(h))
    )
```

Chaque expert est un FFN indépendant (typiquement SwiGLU). le routeur est une seule couche linéaire. chaque jeton choisit son propre`k`les experts et obtient un mélange fermé de leurs résultats.

### Le problème de l'équilibre de la charge

Si le routeur passe 90% des jetons par l'expert 3, les autres experts meurent de faim.

1. **Auxiliary load-balancing loss**(Switch Transformer, Mixtral). Ajouter une pénalité proportionnelle à la variance dans l'utilisation des experts. Fonctionne, mais ajoute un hyperparamètre et un deuxième signal de gradient.
2. **Expert capacity + token dropping**(début de la mise en place).$C \times N/E$Les jetons de débordement sautent la couche.
3. **Auxiliary-loss-free balancing**(DeepSeek-V3). Ajouter un biais appris par expert qui change la sélection top-k du routeur.

Approche de DeepSeek-V3: après chaque étape de formation, chaque expert vérifie si son utilisation est supérieure ou inférieure à l'objectif.`±γ`. Utilisation de sélection `scores + bias`Les probabilités d' expertise utilisées pour le dépistage sont les premières`scores`Découpe le routage de l'expression.

### Des experts partagés

DeepSeek-V2/V3 divise également les experts en *shared* et *routed*. Chaque jeton passe par tous les experts partagés. Les experts partagés sont choisis par le biais de top-k. Les experts partagés capturent les connaissances communes; les experts partagés se spécialisent. V3 exécute 1 expert partagé plus le top-8 des 256 partagés.

### Des experts en grains fins

MoE classique (GShard, Switch): chaque expert est aussi large qu'un FFN complet. `E`est petite (864), `k`est petite (12).

MoE moderne à grains fins (DeepSeek-V3, Qwen-MoE): chaque expert est plus étroit (1/8 FFN de taille). $E$est grand (256+), $k$Les paramètres totaux sont les mêmes, mais les combinaisons évoluent beaucoup plus rapidement. $\binom{256}{8} \approx 400$La qualité augmente, la latence reste stable.

### Le profil des coûts

Par jeton, par couche:

| Config | Active params / token | Total params |
|--------|-----------------------|--------------|
| Mixtral 8×22B | ~39B | 141B |
| Llama 3 70B (dense) | 70B | 70B |
| DeepSeek-V3 | 37B | 671B |
| Kimi K2 (MoE) | ~32B | 1T |

DeepSeek-V3 bat Llama 3 70B (dense) sur presque tous les indicateurs de référence en faisant **fewer active FLOPs per token**Plus de paramètres = plus de connaissances. Plus de FLOPs actifs = plus de calcul par jeton.

### Le problème: la mémoire

Tous les experts vivent sur GPU, quel que soit le type de GPU. Un modèle 671B nécessite ~ 1,3 To de VRAM pour les poids fp16.

```figure
expert-routing
```

## Faites-le

Regardez !`code/main.py`- une couche compacte de MoE en stdlib pur avec:

- `n_experts=8`Des experts en SWIGU (un linéaire par exemplaire)
- en route de haut-k=2
- poids de fermeture normalisé à la hauteur de la douceur maximale
- équilibrage sans perte auxiliaire par biais de biais par expert

`code/main.rs`Le nombre aléatoire diffère de celui de Python, mais les conclusions imprimées sont les mêmes.

```bash
python3 code/main.py
rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson
```

### Étape 1: le routeur

```python
def route(hidden, W_router, top_k, bias):
    scores = [sum(h * w for h, w in zip(hidden, W_router[e])) for e in range(len(W_router))]
    biased = [s + b for s, b in zip(scores, bias)]
    top_idx = sorted(range(len(biased)), key=lambda i: -biased[i])[:top_k]
    # softmax over ORIGINAL scores of the chosen experts
    chosen = [scores[i] for i in top_idx]
    m = max(chosen)
    exps = [math.exp(c - m) for c in chosen]
    s = sum(exps)
    gates = [e / s for e in exps]
    return top_idx, gates
```

Le biais affecte la sélection, pas le poids de la porte. C'est le truc DeepSeek-V3  bias corrige le déséquilibre de charge sans diriger les prédictions du modèle.

### Étape 2: exécuter 100 jetons à travers le routeur

Suivre quelle fréquence les experts tirent. Sans le biais, l'utilisation est biaisée.`-γ`pour les experts surutilisés `+γ`Les utilisations sont généralement moins fréquentes (en fonction de la fréquence de l'utilisation), et l'utilisation converge à une distribution uniforme sur quelques itérations.

### Étape 3: Comparation du nombre de paramètres

Imprimez l'équivalent dense d'une configuration MoE. DeepSeek-V3-forme: 256 routi + 1 partagé, 8 actif, d_model = 7168. Le nombre total de paramètres est impressionnant. Le nombre actif est un septième d'un Llama dense 3 70B.

## Utilisez-le

Chargement de la face:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("mistralai/Mixtral-8x22B-v0.1")
```

2026 production d'inférence: vLLM prend en charge le routage MoE natively. SGLang a le plus rapide parallèle expert-path.

**When to pick MoE:**
- Vous voulez une qualité de pointe à un coût inférieur par jeton.
- Vous disposez de l'infrastructure VRAM / expert parallèle.
- Votre charge de travail est lourde en tokens (chat, code) et non lourde en contexte (longs documents).

**When NOT to pick MoE:**
- Déploiement de bord  vous payez le stockage complet pour tout FLOP actif.
- L'expertise en routage  pour un utilisateur unique critique de la latence ajoute des frais généraux.
- Les modèles de petite taille (<7B)  L'avantage de qualité du MoE ne se dégage qu'au-dessus d'un seuil de calcul (~6B paramètres actifs).

## La faire partir

Regardez !`outputs/skill-moe-configurator.md`. La compétence choisit E, k et la mise en page partagée par des experts pour un nouveau budget de paramètre du MoE, des jetons de formation et des objectifs de déploiement.

## Exercices

1. **Easy.**On court .`code/main.py`Regardez comment la mise à jour de biais sans perte auxiliaire équivaut à l'utilisation des experts sur 50 itérations.
2. **Medium.**Remplacez le routeur apprenant par un routeur basé sur le hachage (déterministique, pas d'apprentissage). Comparer la qualité et l'équilibre. Pourquoi le routeur apprenant est-il meilleur?
3. **Hard.**Implémenter le "routage parallèle de déploiement" (truc DeepSeek-V3.2): enregistrer ce que les experts tirent lors de l'inférence, forcer le même routage lors du calcul des gradients. Mesurer l'effet sur une configuration de politique de jeu-gradient.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Expert | "One FFN among many" | An independent feed-forward network; parameters dedicated to a sparse slice of the FFN computation. |
| Router | "The gate" | A tiny linear layer that scores each token against each expert; top-k selection. |
| Top-k routing | "k active experts per token" | Each token's FFN computation goes through exactly k experts, weighted by gate. |
| Auxiliary loss | "Load-balance penalty" | Extra loss term that penalizes skewed expert usage. |
| Auxiliary-loss-free | "DeepSeek-V3's trick" | Balance via per-expert bias on the router's selection only; no extra gradient. |
| Shared expert | "Always on" | Extra expert through which every token passes; captures common knowledge. |
| Expert parallelism | "Shard by expert" | Distribute different experts to different GPUs; route tokens across the network. |
| Sparsity | "Active params < total params" | The ratio $k \times \text{expert size} / (E \times \text{expert size})$; 37/671 ≈ 5.5% for DeepSeek-V3. |

## Pour en savoir plus

- [Shazeer et al. (2017). Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer](https://arxiv.org/abs/1701.06538)- L'idée.
- [Fedus, Zoph, Shazeer (2022). Switch Transformer: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity](https://arxiv.org/abs/2101.03961)- Le Switch, le MoE classique.
- [Jiang et al. (2024). Mixtral of Experts](https://arxiv.org/abs/2401.04088) Mixtral 8×7B.
- [DeepSeek-AI (2024). DeepSeek-V3 Technical Report](https://arxiv.org/abs/2412.19437) MLA + MoE sans perte auxiliaire + MTP.
- [Wang et al. (2024). Auxiliary-Loss-Free Load Balancing Strategy for Mixture-of-Experts](https://arxiv.org/abs/2408.15664) le papier d'équilibrage basé sur les biais.
- [Dai et al. (2024). DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models](https://arxiv.org/abs/2401.06066) le spécialiste de la division de l'utilisation du routeur de cette leçon.
- [Kim et al. (2022). DeepSpeed-MoE: Advancing Mixture-of-Experts Inference and Training](https://arxiv.org/abs/2201.05596) document d'expert commun original.
