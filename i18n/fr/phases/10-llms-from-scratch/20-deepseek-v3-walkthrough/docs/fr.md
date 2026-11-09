# Une architecture de recherche profonde

> La leçon 14 nomme les six boutons architecturaux que chaque modèle ouvert tourne. DeepSeek-V3 (décembre 2024, 671B paramètres totaux, 37B actif) tourne les six et ajoute quatre autres: Attention latente multi-tête, équilibrage de charge sans perte auxiliaire, prédiction multi-token et formation DualPipe. Cette leçon lit l'architecture de DeepSeek-V3 de haut en bas et dérive chaque nombre de paramètres de la configuration publiée. À la fin, vous pourrez expliquer pourquoi le ratio 671B/37B est le bon pari et pourquoi MLA + MoE ensemble battrait l'un ou l'autre seul à la frontière.

**Type:** Learn
**Languages:** Python (stdlib, parameter calculator), Rust
**Prerequisites:** Phase 10 · 14 (open-model walkthroughs), Phase 10 · 17 (NSA), Phase 10 · 18 (MTP), Phase 10 · 19 (DualPipe)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Lisez la configuration DeepSeek-V3 de haut en bas et expliquez chaque champ en termes de six boutons GPT-2 plus quatre ajouts spécifiques à DeepSeek.
- Dériver le nombre total de paramètres (671B), le nombre de paramètres actifs (37B) et les composants qui contribuent à chacun.
- Computez l'empreinte cache KV de MLA dans un contexte de 128k et comparez à ce qu'un modèle densément actif avec GQA paierait.
- Indiquez les quatre innovations spécifiques à DeepSeek (MLA, MTP, routage sans perte auxiliaire, DualPipe) et nommez la partie de l'architecture/de la stack de formation que chaque cible vise.

## Le problème

DeepSeek-V3 est le premier modèle ouvert de frontière dont l'architecture est significativement différente de la famille Llama. Llama 3 405B est "GPT-2 avec six boutons tournés". DeepSeek-V3 est GPT-2 avec les six boutons plus quatre autres. La lecture de la configuration Llama 3 est un réchauffement pour la lecture de la configuration DeepSeek, mais la structure profonde  la forme du bloc d'attention, la logique de routage, l'objectif de temps d'entraînement  est suffisamment différente pour que vous ayez besoin d'un passage séparé.

La récompense de l'apprentissage: la sortie open-weights de DeepSeek-V3 a changé le sens de la "capacité frontalière" dans les modèles ouverts. L'architecture est le modèle que beaucoup de séances de formation 2026 copient.

## Le concept

### Le noyau invariant, encore une fois

DeepSeek-V3 est toujours autorégressif. Il empile encore des blocs de décodeur. Chaque bloc a toujours une attention plus MLP plus deux RMSNorms. Il utilise toujours SwiGLU dans le MLP. Il utilise encore RoPE. Pré-norme. Embeddings liés au poids. La même base que chaque Llama ou Mistral.

### Le tournant: MLA au lieu de GQA

Dès la phase 10 · 14, vous savez que GQA réduit le cache KV en partageant K et V entre groupes de têtes Q. L'attention latente multi-tête (MLA) va plus loin: K et V sont compressés dans une représentation latente de rang bas partagée (la `kv_lora_rank`Le cache KV ne stocke que le cache latent  généralement 512 floats par jeton par couche, pas 8 x 128 = 1024 floats.

Dans le contexte 128k, DeepSeek-V3 avec MLA (un latente partagé `c^{KV}`par jeton par couche; K et V sont tous deux dérivés de ce latente par des projections à la hausse qui peuvent être absorbées dans le matmul ultérieur):

```
kv_cache = num_layers * kv_lora_rank * max_seq_len * bytes_per_element
         = 61 * 512 * 131072 * 2
         = 7.6 GB
```

Une ligne de base hypothétique de GQA (forme Llama 3 70B, 8 têtes KV, tête épaisse 128) paierait:

```
kv_cache = 2 * 61 * 8 * 128 * 131072 * 2
         = 30.5 GB
```

MLA est 4 fois plus petit qu'un cache GQA de style Llama-3-70B à 128k de contexte.

Le compromis: MLA ajoute une étape de décompression par attente calcul (par tête). Le calcul supplémentaire est petit par rapport à la bande passante enregistrée.

### Le routage: équilibrage de la charge sans perte auxiliaire

Les routeurs MoE décident des experts top-k qui traitent chaque jeton. Un routeur naïf concentre trop de travail sur quelques experts, laissant d'autres inactifs.

DeepSeek-V3 introduit un schéma sans perte auxiliaire.`e`est surchargé, diminuer `bias_e`Si vous êtes sous-chargé, augmentez-le. Pas de délai supplémentaire de perte.

L'effet sur l'architecture du MoE: plus propre, pas d'hyperparamètre de perte auxiliaire à régler.

### Le MTP: formation plus dense + projet libre

À partir de la phase 10 · 18, vous savez que DeepSeek-V3 ajoute le module D=1 MTP qui prédit les deux positions du jeton. À l'inférence, le module formé est réutilisé comme un projet de décoding spéculatif avec une acceptation de 80%+.

Parametres: 14B sur le 671B principal.

### La formation: DualPipe

Du stade 10 · 19 vous savez que DualPipe est un pipeline bidirectionnel qui se chevauchent en avant et en arrière avec des communications tout-à-tout à l'intersection de nœuds croisés.

### La configuration, champ par champ

Voici la configuration de DeepSeek-V3 (simplifiée):

```
hidden_size: 7168
intermediate_size: 18432   (dense MLP hidden size, used on first few layers)
moe_intermediate_size: 2048 (expert MLP hidden size)
num_hidden_layers: 61
first_k_dense_layers: 3    (first 3 layers use dense MLP)
num_attention_heads: 128
num_key_value_heads: 128   (formally equal to num_heads under MLA, but
                           the real compression is in kv_lora_rank)
kv_lora_rank: 512          (MLA latent dimension)
num_experts: 256            (MoE expert count per block)
num_experts_per_tok: 8      (top-8 routing)
shared_experts: 1           (always-on shared expert per block)
max_position_embeddings: 163840
rope_theta: 10000.0
vocab_size: 129280
mtp_module: 1               (1 MTP module at depth 1)
```

Pars le:

- `hidden_size=7168`: dimension d'intégration.
- `num_hidden_layers=61`: profondeur totale du bloc.
- `first_k_dense_layers=3`Les 3 premiers blocs utilisent un MLP dense de taille 18432.
- `num_attention_heads=128`: 128 têtes de requête.
- `kv_lora_rank=512`: K et V sont compressés à cette dimension latente et décomprimés par tête.
- `num_experts=256, num_experts_per_tok=8`: chaque bloc du MoE compte 256 experts, les routes sont les 8 premières.
- `shared_experts=1`En plus des 256 experts délégués, un expert toujours en service contribue à chaque jeton.
- `moe_intermediate_size=2048`Le nombre de MLP cachées de chaque expert est inférieur à celui du MLP dense car il en existe 256.

### Comptabilité des paramètres

Le calcul complet se fait en `code/main.py`Le titre:

- Intégration: `vocab * hidden = 129280 * 7168 = ~0.93B`- Je suis désolé .
- Les trois premiers blocs denses: attention avec MLA (~84M par bloc dans le compte simplifié de la calculatrice) + SwiGLU MLP denses (`3 * 7168 * 18432 = ~396M`Environ 1,4 B au total.
- 58 blocs de MoE: attention avec des députés (~84 millions) + 256 experts affectés (`3 * 7168 * 2048 = ~44M`Par exemple, les données de l'expertise de l'interface de communication (environ 44M) et de l'expertise de l'interface de communication (environ 44M) sont utilisées pour les blocs de communication.
- Module MTP: le module publié est 14B. La calculatrice utilise un stand-in dense de ~0,8B.

Le point de contrôle Hugging Face est 685B car il ajoute le module MTP 14B au dessus du 671B. L'écart restant de ~1% provient de simplifications: le calculateur saute les dimensions RoPE découplées en MLA, la tête de sortie non liée et quelques petits tensors.

Paramètres actifs par transfert:

- Attention: 84 M par couche * 61 = ~5,1B (toutes couches en feu).
- L'activité de la PMP: les 3 premières couches denses (`3 * 396M = ~1.2B`), 58 couches de MoE actives chacune avec 8 parcourues + 1 expert partagé (`9 * 44M = ~396M`Environ 24B au total.
- Embedding + normes: ~ 0,9B.
- Total actif: ~30B de la calculatrice par rapport au 37B publié. La plupart du décalage est l'attention: le MLA complet, avec ses dimensions RoPE et ses requêtes plus larges et les têtes de clé, est plus grand que le compte simplifié. Le module MTP ne compte pas vers le 37B.

### Le rapport 671B / 37B

Le ratio de rareté de 18x (paramètres actifs sont de 5,5% du total). DeepSeek-V3 est le modèle MoE frontalier le plus rare qui a livré des poids ouverts. Mixtral 8x7B au ratio 13/47 (28%) est beaucoup plus dense. Llama 4 Maverick au ratio 17B/400B (4.25%) est comparable. Le pari DeepSeek: à l'échelle frontalière, plus d'experts avec un taux d'activation plus faible produit une meilleure qualité par FLOP actif.

### Où se trouve DeepSeek-V3

| Model | Total | Active | Ratio | Attention | Novel ideas |
|-------|------|-------|-------|-----------|-------------|
| Llama 3 70B | 70B | 70B | 100% | GQA 64/8 | — |
| Llama 4 Maverick | 400B | 17B | 4.25% | GQA | — |
| Mixtral 8x22B | 141B | 39B | 27% | GQA | — |
| DeepSeek V3 | 671B | 37B | 5.5% | MLA 512 | MLA + MTP + aux-free + DualPipe |
| Qwen 2.5 72B | 72B | 72B | 100% | GQA 64/8 | YaRN extension |

### Le suivi: R1, V4

DeepSeek-R1 (2025) est une course de formation de raisonnement sur la colonne vertébrale V3. R1 utilise la même architecture. Ce qui a changé, c'est la recette post-entraînement (RL à grande échelle sur les tâches vérifiables), et non l'architecture pré-entraînement.

DeepSeek-V4 (si elle est livrée) devrait conserver MLA + MoE + MTP et ajouter DSA (DeepSeek Sparse Attention), le successeur de la NSA à partir de la phase 10 · 17.

```figure
moe-routing
```

## Utilisez-le

`code/main.py`est la calculatrice de paramètres spécialisée dans la forme de DeepSeek-V3. Exécutez-la, comparez sa sortie aux numéros du papier et utilisez-la sur des variantes hypothétiques (256 experts contre 512, top-8 contre top-16, MLA rang 512 contre 1024).

À quoi regarder:

- Le nombre total de paramètres par rapport au 671B publié.
- Le nombre de paramètres actifs par rapport au 37B publié.
- Le cache KV dans le contexte 128k  la comparaison MLA vs GQA.
- Par couche pour voir où le budget des paramètres va réellement.

## La faire partir

Cette leçon produit `outputs/skill-deepseek-v3-reader.md`. Compte tenu d'un modèle de la famille DeepSeek (V3, R1 ou toute autre variante future), il produit une lecture d'architecture composante par composant qui donne le nom de chaque champ de la configuration, déduit le nombre de paramètres par composant et identifie quelles des quatre innovations spécifiques à DeepSeek le modèle utilise.

## Exercices

1. On court .`code/main.py`- Comparer l'estimation du paramètre total de la calculatrice avec la publication 671B et identifier l'origine du delta.

2. Modifiez la configuration pour utiliser le rang MLA 256 au lieu de 512. Computez la taille de cache KV obtenue dans un contexte de 128k. Quelle réduction en pourcentage achète-t-elle, et à quel coût à l'expressivité par tête?

3. Comparer le routage de DeepSeek-V3 (256 experts, top-8) à une variante hypothétique (512 experts, top-8). Les paramètres totaux augmentent; les paramètres actifs restent les mêmes.

4. Lisez la section 2.1 du rapport technique DeepSeek-V3 (arXiv:2412.19437) sur MLA. Expliquez en trois phrases pourquoi les matrices de décompression K et V peuvent être "absorbées" dans le matmul ultérieur pour une efficacité de temps d'inférence.

5. DeepSeek-V3 utilise la formation FP8 pour la plupart des opérations. Compute les économies de mémoire de FP8 par rapport à BF16 pour stocker les poids 671B. Comment cela se croisent-ils avec le budget de formation de jetons 14.8T?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MLA | "Multi-Head Latent Attention" | Compress K and V into a shared low-rank latent (kv_lora_rank, typically 512), decompress per head on-the-fly; KV cache stores only the latent |
| kv_lora_rank | "MLA compression dim" | The size of the shared latent for K and V; DeepSeek-V3 uses 512 |
| First k dense layers | "Early layers stay dense" | The first few MoE-model layers skip the MoE router and run a dense MLP for stability |
| num_experts_per_tok | "Top-k routing" | How many routed experts fire per token; DeepSeek-V3 uses 8 |
| Shared experts | "Always-on experts" | Experts that process every token regardless of routing; DeepSeek-V3 uses 1 |
| Auxiliary-loss-free routing | "Bias-adjusted load balance" | Per-expert bias terms adjusted during training to keep expert load balanced without adding a loss term |
| MTP module | "Extra prediction head" | Transformer block predicting $t+2$ from $h^{(1)}$ and $E(t+1)$; denser training, free speculative-decoding draft |
| DualPipe | "Bidirectional pipeline" | Training schedule that overlaps forward/backward compute with cross-node all-to-all |
| Active parameter ratio | "Sparsity" | active_params / total_params; DeepSeek-V3 hits 5.5% |
| FP8 training | "8-bit training" | Training storage and many compute ops in FP8; roughly halves memory vs BF16 at a small quality cost |

## Pour en savoir plus

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) le document complet sur l'architecture, la formation et les résultats
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) fichiers de configuration et notes de déploiement
- [DeepSeek-V2 paper (arXiv:2405.04434)](https://arxiv.org/abs/2405.04434) le prédécesseur qui a introduit MLA
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) le successeur de la formation de raisonnement sur l'architecture de V3
- [Native Sparse Attention (arXiv:2502.11089)](https://arxiv.org/abs/2502.11089) la direction future de l'attention de la famille DeepSeek
- [DualPipe repository](https://github.com/deepseek-ai/DualPipe) la référence au calendrier de formation
