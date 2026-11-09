# Compilation d'inferences spécialisées en matériel  FP8 et NVFP4 sur Blackwell

> La compilation d'inférence spécialisée dans le matériel commercialise la portabilité pour le débit, et TensorRT-LLM  NVIDIA-uniquement, réglée pour Blackwell  est l'exemple le plus clair du commerce qui porte ses fruits. Sur GB200 NVL72 avec l'orchestration Dynamo, SemiAnalysis InferenceX a mesuré $0.012 per million tokens on a 120B model in Q1-Q2 2026, against $0,09/M sur H100 + vLLM  un écart économique de 7 fois. La pile compose deux formats de points flottants avec deux techniques de service: FP8 reste essentiel pour les noyaux de cache et d'attention KV car il a la gamme dynamique dont ils ont besoin; NVFP4 (4 bits de microscalage) gère les poids et les activations; prédiction multi-token (MTP) et pré-remplissage / décode décomposé ajouter un autre 2-3x en haut. Le support du modèle Day-0 charge directement les poids FP4 sans conversion post-entraînement. Le but pour les équipes d'ingénierie 2026: TRT-LLM est open source mais spécifique à NVIDIA  CUDA- et Blackwell- spécialisée  donc l'adoption de la portativité pour le débit. Faites le calcul de votre mélange de modèles et de matériel avant de vous engager.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy FP8/NVFP4 memory and cost calculator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 10 · 13 (Quantization)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Expliquez pourquoi FP8 reste essentiel pour le cache et l'attention KV même lorsque les poids sont dans NVFP4.
- Comptez l'empreinte HBM d'un modèle frontalier sous BF16, FP8 et NVFP4 et raisonnez sur l'origine des économies.
- Nommer les fonctionnalités spécifiques à Blackwell exploitées par TRT-LLM (jour-0 FP4, MTP, service décomposé, primitifs tout-à-tout).
- Décidez quand le verrou NVIDIA de TRT-LLM vaut le 7x de l'écart de coût par rapport à VLLM sur Hopper.

## Le problème

La frontière de l'économie d'inférence en 2026 est "combien de jetons par dollar". La réponse dépend de quatre choix empilés: génération de matériel (Hopper H100/H200 vs Blackwell B200/GB200), précision (BF16 → FP8 → NVFP4), moteur de service (vLLM vs SGLang vs TRT-LLM), et orchestration (plain vs disaggregé vs Dynamo).

Sur Hopper avec VLLM, un MoE 120B fonctionne à ~$0.09 per million tokens. On Blackwell with TRT-LLM + Dynamo, the same model runs at ~$Une partie de cette lacune est matérielle (Blackwell est 11-15x par GPU LLM throughput vs Hopper). Une autre est la pile: poids FP4, projet MTP, pré-remplissage / décode décomposé, et NVLink 5 tout-à-tout pour la communication par experts MoE.

Vous ne pouvez pas reproduire cela en dehors de la pile NVIDIA. C'est le compromis  portabilité pour l'économie. Comprendre quels choix de pile donnent quelle part de l'écart est le but de cette leçon.

## Le concept

### Pourquoi FP8 est toujours le sol pour KV cache

Une erreur commune en 2026: en supposant que NVFP4 s'applique partout. Il ne l'est pas. Le cache KV a besoin de FP8 (8 bits floating point) car il stocke des clés d'attention et des valeurs qui couvrent une large gamme dynamique. Le quantifier KV à FP4 provoque une perte de précision catastrophique  la queue de la distribution diminue et les scores d'attention s'effondrent.

NVFP4 (2025-2026) s'applique aux poids et aux activations. Microscale: chaque bloc de poids a son propre facteur d'échelle afin que de petits blocs puissent couvrir différentes gammes dynamiques sans perte d'échelle par tenseur. Pour les activations, FP4 se maintient parce que les activations sont de petite gamme dans une couche.

Le type de Blackwell:

- Poids: NVFP4 (4 bits à micro-échelle).
- Activations: NVFP4.
- Le cache KV: FP8.
- Accumulateur d'attention: FP32 (stabilité à hauteur de la température).

### Les primitives spécifiques à Blackwell utilisées par TRT-LLM

- **Day-0 FP4 weights**Les fournisseurs de modèles expédient directement les poids FP4; les charges TRT-LLM sans conversion post-entraînement.
- **Multi-token prediction (MTP)**: la même idée que EAGLE (phase 17 · 05) mais intégrée dans la construction TRT-LLM.
- **Disaggregated serving**: pré-remplissez et décodez sur des pools GPU distincts, KV cache transféré par NVLink ou InfiniBand.
- **All-to-all communication primitives**NVLink 5 réduit la latence de communication des experts MoE de 3x par rapport à Hopper.
- **NVFP4 + MXFP8 microscaling**: manipulation accélérée par le matériel de facteurs d'échelle sur les cœurs de tensor Blackwell.

### Les chiffres que vous devriez mémoriser

- HGX B200 à 0,02 $ / M de jetons sur GPT-OSS-120B via TRT-LLM.
- GB200 NVL72 à 0,012/M $ par le biais de Dynamo (orchestration TRT-LLM).
- H100 + vLLM ≈ 0,09 $ / M de jetons sur une charge de travail comparable.
- 2,8 fois plus de débit en trois mois de mises à jour du TRT-LLM (2026).
- 11 à 15 fois le débit par GPU LLM, Blackwell vs Hopper.
- MLPerf Inference v6.0 (avril 2026): Blackwell domine chaque tâche présentée.

### Quel est le coût de la qualité du 4e PQ

NVFP4 est agressif. Sur les charges de travail lourdes (chaîne de pensée, mathématiques, génération de code avec long contexte), les poids FP4 se dégradent visiblement. L'étalonnage par bloc atténue mais n'élimine pas. Les modèles de raisonnement des équipes utilisent souvent des poids FP8 + activations FP4 comme compromis, ou adhèrent à H200 avec FP8 tout au long.

La règle: toujours valider la qualité de la tâche sur votre ensemble d'évaluation avant de s'engager dans des poids NVFP4.

### Pourquoi c'est une décision de verrouillage NVIDIA

TRT-LLM est un noyau de source fermée. Les modèles doivent être compilés pour un SKU GPU spécifique. Pas de AMD, pas d'Intel, pas d'ARM. Si votre stratégie infrarouge est multi-vendeur, TRT-LLM est un non-starter pour le niveau TRT-LLM servi.

### 2026 recette pratique

Pour une facture annuelle d'inférence de 100 millions de dollars, fonctionner sur Hopper + vLLM laisse 7 à 10 fois sur la table. Migrer les charges de travail dominantes en coûts vers Blackwell + TRT-LLM + Dynamo. Garder le niveau d'expérimentation sur H100 + vLLM pour la vitesse d'itération du modèle. Valider la qualité sur chaque modèle converti en NVFP4 avant la production.

### Le bonus de désagrégation

La portion désagrégée de TRT-LLM (pools de pré-remplissage et de décode séparés) est couverte en profondeur dans la phase 17 · 20. Sur Blackwell, les pile de multiplicateurs: poids FP4 × accélération MTP × placement désagrégé × routage conscient du cache.

```figure
pipeline-parallel
```

## Utilisez-le

`code/main.py`Compute l'empreinte HBM, le décodage de débit (régime de mémoire liée) et les jetons $/M pour un modèle sur trois piles: H100 + BF16 + vLLM, H100 + FP8 + vLLM, B200 + NVFP4/FP8 + TRT-LLM. Exécutez-le pour voir l'effet de composition et la part de l'écart que chaque changement contribue.

## La faire partir

Cette leçon produit `outputs/skill-trtllm-blackwell-advisor.md`. Compte tenu de la charge de travail, de la taille du modèle et du volume annuel des jetons, il décide si la pile Blackwell + TRT-LLM vaut le verrouillage NVIDIA.

## Exercices

1. On court .`code/main.py`. Sur un MoE 120B avec des paramètres actifs de 30%, calculer le décodage limité de la mémoire-largeur de bande passante sur H100 BF16, H100 FP8 et B200 NVFP4/FP8.
2. Un client dépense 2 millions de dollars par an sur H100 + vLLM. Quel est le nombre d'équivoques de GPU Blackwell qu'il doit acheter pour amorcer une migration vers TRT-LLM en 12 mois, compte tenu de l'écart économique de 7 fois ?
3. Vous verrez une baisse de précision de 3 points sur MATH après la conversion de poids NVFP4. Nommez deux voies de récupération: une qualité-première (maintien des poids FP8) et une coût-première (calibrer avec les données dans le domaine).
4. Lisez les résultats de l'inférence MLPerf v6.0.
5. Compute le HBM nécessaire pour un modèle 405B à des poids NVFP4 + FP8 KV cache à un contexte 128k.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| FP8 | "eight-bit float" | 8-bit floating point; used for KV cache and attention due to dynamic range |
| NVFP4 | "four-bit micro" | NVIDIA's 4-bit microscaling FP format; weights and activations on Blackwell |
| MXFP8 | "MX eight" | Microscaling FP8 variant; hardware-accelerated on Blackwell Tensor Cores |
| Day-0 FP4 | "ship FP4 weights" | Model providers release weights already in FP4; no post-train conversion step |
| MTP | "multi-token prediction" | TRT-LLM's integrated speculative-decoding draft (Phase 17 · 05) |
| Disaggregated serving | "split prefill/decode" | Prefill and decode on separate GPU pools; KV transferred over NVLink/IB |
| All-to-all | "MoE expert comm" | Communication pattern routing tokens to expert GPUs; NVLink 5 cuts 3x |
| InferenceX | "SemiAnalysis inference bench" | The 2026 industry-accepted cost-per-token benchmark |

## Pour en savoir plus

- [NVIDIA — Blackwell Ultra MLPerf Inference v6.0](https://developer.nvidia.com/blog/nvidia-blackwell-ultra-sets-new-inference-records-in-mlperf-debut/) Avril 2026 résultats de la MLPerf.
- [NVIDIA — MoE Inference on Blackwell](https://developer.nvidia.com/blog/delivering-massive-performance-leaps-for-mixture-of-experts-inference-on-nvidia-blackwell/) NVLink 5 tout-à-tout et MoE noyaux.
- [TensorRT-LLM Overview](https://nvidia.github.io/TensorRT-LLM/overview.html) documentation officielle du moteur.
- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/) orchestration décomposée au-dessus de TRT-LLM.
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) la suite de référence qui publie les chiffres Blackwell.
