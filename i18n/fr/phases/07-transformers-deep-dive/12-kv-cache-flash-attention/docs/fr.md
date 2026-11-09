# Cache KV, attention et optimisation de l'inference

> L'entraînement est parallèle et lié à FLOP. L'inférence est sérielle et liée à la mémoire.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~75 minutes

## Le problème

Un décodeur autorégressif naïf le fait .$O(N^2)$travail à générer $N$Les jetons: à chaque étape, il recompte l'attention sur le préfixe complet. Pour une réponse à jetons 4K qui est 16M opérations d'attention, la plupart d'entre eux redondants. Chaque état caché d'un jeton préfixe est déterministe une fois calculé  vous avez seulement besoin d'exécuter la requête du nouveau jeton contre les clés cachées et les valeurs de tout avant.

En plus de cela, l'attention elle-même déplace beaucoup de données. L'attention standard matérialise une matrice de score N×N, une sortie de softmax N×d, une sortie finale N×d  trop de lecture et d'écriture à HBM. Pour N≥2K, l'attention devient liée à la mémoire avant de devenir liée à FLOP.

Deux optimisations, toutes deux de Dao et coll., ont poussé l'inférence de frontière de "lente" à "rapide":

1. **KV cache.**Enregistrer les vecteurs K et V de chaque jeton préfixe.$O(N^2)$à $O(N)$par étape de génération.
2. **Flash Attention.**Le calcul de l'attention est calculé de telle sorte que la matrice N×N complète ne touche jamais le HBM. Tout le softmax + matmul se produit dans le SRAM. 24× accélération de l'horloge murale sur A100; 510× sur H100 avec FP8.

D'ici 2026, les deux sont universels. Chaque pile d'inférence de production (vLLM, TensorRT-LLM, SGLang, llama.cpp) les assume.

## Le concept

![KV cache growth and Flash Attention tiling](../assets/kv-cache-flash-attn.svg)

### Mathématiques de cache KV

Par couche de décodeur, par jeton, sur toutes les têtes KV:

```
bytes_per_token_per_layer = 2 * n_kv_heads * d_head * dtype_size
                          ^
                          K and V
```

Pour un modèle 7B de 32 couches, 32 têtes (toutes utilisées pour K et V), d_head=128, fp16:

```
per token per layer = 2 * 32 * 128 * 2 = 16384 bytes (16 KiB)
per token (32 layers) = 512 KiB
per 32K context = 16 GiB
```

Pour Llama 3 70B (80 couches, d_head=128, GQA avec 8 têtes KV):

```
per token per layer = 2 * 8 * 128 * 2 = 4096 bytes (4 KiB)
per 32K context = 10 GiB
```

Ce 10 GiB à 32K passe à 40 GiB à 128K, ce qui est l'ensemble d'un A100 de 40 GB seulement pour le cache KV à la taille de lot 1.

**GQA is the KV-cache win.**L'AMM avec 64 têtes KV serait 8 fois plus grand, environ 80 GiB à 32K.

Tirez les dimensions et regardez le déplacement de la taille du cache. Poussez la longueur de la séquence ou le lot vers le haut et voyez à quelle vitesse il souffle au-delà d'un seul GPU:

```figure
kv-cache-sizer
```

### Attention à la lumière

Attention à la norme:

```
S = Q @ K^T          (HBM read, N×N, HBM write)
P = softmax(S)       (HBM read, HBM write)
O = P @ V            (HBM read, HBM write)
```

Trois voyages aller-retour HBM. Sur H100, la bande passante HBM est de 3 TB/s; SRAM est de 30 TB/s. Chaque voyage HBM est un facteur de ralentissement de 10 par rapport à garder tout sur la puce.

Attention à la lumière:

```
for each block of Q (tile size ~128 × 128):
    load Q_tile into SRAM
    for each block of K, V:
        load K_tile, V_tile into SRAM
        compute S_tile = Q_tile @ K_tile^T     (SRAM)
        running softmax aggregation             (SRAM)
        accumulate into O_tile                  (SRAM)
    write O_tile to HBM
```

Un HBM par carrelage, une trace de mémoire totale en baisse.$O(N^2)$à $O(N)$. Pass arrière recompte certaines valeurs de la passe avant au lieu de les stocker  une autre mémoire gagne.

**Numerical trick.**La durée de fonctionnement de la softmax est maintenue `(max, sum)`L'attention flash compute une sortie identique à l'attention standard (modulo fp16 non-associativité).

**Version evolution:**

| Version | Year | Key change | Speedup on reference hardware |
|---------|------|-----------|-------------------------------|
| Flash 1 | 2022 | Tiled SRAM kernel | 2× on A100 |
| Flash 2 | 2023 | Better parallelism, causal-first ordering | 3× on A100 |
| Flash 3 | 2024 | Hopper asynchrony, FP8 | 1.5–2× on H100 (~740 TFLOPs FP16) |
| Flash 4 | 2026 | Blackwell 5-stage pipeline, software exp2 | Inference-first (forward only initially) |

Flash 4 est seulement avancé au lancement. L'entraînement utilise encore Flash 3.

### Décodage spéculatif  l'autre gain de latence

Le modèle bon marché propose N-tokens. Le modèle grand vérifie tous les N en parallèle. Si la vérification accepte k-tokens, vous avez payé 1 large-model avant pour k générations.

2026 défauts:
- **EAGLE 2 / Medusa.**Des capteurs de projet intégrés qui partagent les états cachés du vérificateur. 23x accélération sans perte de qualité.
- **Speculative decoding with draft model.**2×4 fois plus rapide sur le matériel de consommation.
- **Lookahead decoding.**Je ne veux pas de modèle de projet, niche mais gratuite.

### Partage continu

Inference classique par lots: attendre que la séquence la plus lente se termine, puis commencer un nouveau lot.

Batchage continu (d'abord expédié en Orca, maintenant en vLLM, TensorRT-LLM, SGLang): échangez de nouvelles demandes dans le lot dès que les anciennes sont terminées.

### PagedAttention  KV cache comme mémoire virtuelle

La fonctionnalité principale de vLLM. Le cache KV est alloué en blocs de 16 jetons; une table de page cartographique les positions logiques des blocs physiques. Vous pouvez partager KV sur des échantillons parallèles (recherche de faisceaux, prélèvement parallèle), préfixes de swap chaud pour le caching rapide et la mémoire de défragmentation. Amélioration de débit 4x par rapport à l'allocation contiguë naïve.

```figure
flash-attention-memory
```

## Faites-le

```figure
iso-machine {"machine":"kv-cache"}
```

Regardez !`code/main.py`, ou son port de Rust `code/main.rs`Pour exécuter la version Rust:`rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson`Nous mettons en œuvre:

1. Une naïve .$O(N^2)$décodeur incrémentiel.
2. Une .$O(N)$Décoder en cache KV.
3. Une softmax en carreaux qui simule l'algorithme de fonctionnement maximal de Flash Attention.

### Étape 1: cache KV

```python
class KVCache:
    def __init__(self, n_layers, n_heads, d_head):
        self.K = [[[] for _ in range(n_heads)] for _ in range(n_layers)]
        self.V = [[[] for _ in range(n_heads)] for _ in range(n_layers)]

    def append(self, layer, head, k, v):
        self.K[layer][head].append(k)
        self.V[layer][head].append(v)

    def read(self, layer, head):
        return self.K[layer][head], self.V[layer][head]
```

Simple: continuez à augmenter les vecteurs K et V par jeton dans les listes de couches et de têtes.

### Étape 2: softmax en carreaux

```python
def tiled_softmax_dot(q, K, V, tile=4):
    """Flash-attention-style softmax(qK^T)V with running max/sum."""
    m = float("-inf")
    s = 0.0
    out = [0.0] * len(V[0])
    for start in range(0, len(K), tile):
        k_block = K[start:start + tile]
        v_block = V[start:start + tile]
        scores = [sum(qi * ki for qi, ki in zip(q, k)) for k in k_block]
        new_m = max(m, *scores)
        exp_old = math.exp(m - new_m) if m != float("-inf") else 0.0
        exp_new = [math.exp(sc - new_m) for sc in scores]
        s = s * exp_old + sum(exp_new)
        for j in range(len(out)):
            out[j] = out[j] * exp_old + sum(e * v[j] for e, v in zip(exp_new, v_block))
        m = new_m
    return [o / s for o in out]
```

Sortie par bits identiques à `softmax(qK) V`dans un seul coup, mais à tout moment le jeu de travail est un `tile × d_head`Le bloc, pas le plein.`N × d_head`- Je suis désolé .

### Étape 3: comparer le décoding naïf et le décoding en cache

Les deux décodeurs effectuent les mêmes comparaisons de requêtes-clés: étape `t`Il y a des gens qui viennent .`t`Les jetons, donc le total est 1 + 2 + ... + N = N(N+1)/2. Le code utilise N = 10 et imprime 55 pour chaque décodeur. Pour une génération de 100 jetons, les deux font 5050 comparaisons. Le cache garde les projections K et V. Sans cache, chaque étape compute K et V à nouveau pour le préfixe complet, donc une génération de 100 jetons compute 5050 états de jetons. Avec le cache, les K et V de chaque jeton sont calculés une fois, de sorte que la même génération calcule 100 états de jeton.

## Utilisez-le

```python
# HuggingFace transformers auto-enables KV cache on decoder-only generate().
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B",
    attn_implementation="flash_attention_2",  # use FA3 if Hopper
    torch_dtype="bfloat16",
)
# generate() uses KV cache automatically
```

Production de VLLM:

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --max-model-len 32768 \
    --enable-prefix-caching \
    --kv-cache-dtype fp8
```

Le préfixe de mise en cache entre les demandes est un gros gain 2026  le même système de mise en cache, quelques exemples de tir ou un document de contexte long réutilise KV entre les appels. Pour les charges de travail d'agent avec des demandes d'outils répétées, la mise en cache de préfixe est habituellement 5x gain de débit.

## La faire partir

Regardez !`outputs/skill-inference-optimizer.md`. La compétence choisit la mise en œuvre de l'attention, la stratégie de cache KV, la quantification et le décoding spéculatif pour un nouveau déploiement d'inférence.

## Exercices

1. **Easy.**On court .`code/main.py`- Confirmer que les décodeurs naïfs et cachés produisent la même sortie; noter la différence de calcul optique.
2. **Medium.**Implémentation de la mise en cache de préfixe: compte tenu d'un prompt P et de plusieurs compléments, exécutez un passage avant sur P pour remplir le cache KV, puis branchez par complément. Mesurer la vitesse par rapport au re-encodage P pour chacun.
3. **Hard.**Mise en œuvre d'un jouet PagedAttention: KV cache dans des blocs fixes de 16 jetons avec une liste libre. Une fois une séquence terminée, retournez ses blocs à la piscine. Simuler 1000 chats terminés avec des longueurs variables. Comparer la fragmentation de mémoire par rapport à l'allocation contiguë.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| KV cache | "The trick that makes decoding fast" | Stored K and V from every prefix token; new queries attend to them instead of recomputing. |
| HBM | "GPU main memory" | High Bandwidth Memory; 80 GB on H100, 192 GB on B200. ~3 TB/s bandwidth. |
| SRAM | "On-chip memory" | Per-SM fast memory, ~256 KB per SM on H100. ~30 TB/s bandwidth. |
| Flash Attention | "Tiled attention kernel" | Computes attention without materializing N×N in HBM. |
| Continuous batching | "No-wait batching" | Swap finished sequences out, new ones in, without draining the batch. |
| PagedAttention | "vLLM's headline" | KV cache allocated in fixed blocks with a page table; eliminates fragmentation. |
| Prefix caching | "Reuse long prompts" | Cache KV for a shared prefix across requests; major cost cut for agents. |
| Speculative decoding | "Draft + verify" | Cheap draft model proposes tokens; big model verifies k in one pass. |

## Pour en savoir plus

- [Dao et al. (2022). FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135)- Flash 1
- [Dao (2023). FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning](https://arxiv.org/abs/2307.08691)- Flash 2.
- [Shah et al. (2024). FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision](https://arxiv.org/abs/2407.08608)- Flash 3.
- [FlashAttention-4 release notes (Dao-AILab, 2026)](https://github.com/Dao-AILab/flash-attention) Le pipeline de 5 étapes Blackwell et le truc logiciel-exp2; lisez le repo README pour les avertissements de lancement à l'avant-garde mentionnés dans cette leçon.
- [Kwon et al. (2023). Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180) papier VLLM.
- [Leviathan et al. (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) Décodage des spécifications.
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) Le document EAGLE-1/2 pour l'approche intégrée de projet que cite la leçon.
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) l'approche Medusa référencée aux côtés de l'Eagle.
- [vLLM docs — PagedAttention](https://docs.vllm.ai/en/latest/design/kernel/paged_attention.html) la plongée canonique profonde sur le bloc de 16 jetons et la conception de table de page.
