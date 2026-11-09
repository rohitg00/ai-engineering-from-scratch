# Quantisation de la production  AWQ, GPTQ, GGUF K-quants, FP8, MXFP4/NVFP4

> Le format de quantification n'est pas un choix universel  il est une fonction du matériel, du moteur de service et de la charge de travail. GGUF Q4_K_M ou Q5_K_M possède la CPU et le bord, livrés par llama.cpp et Ollama. GPTQ gagne dans le vLLM quand vous avez besoin de plusieurs LORA sur la même base. AWQ avec les noyaux Marlin-AWQ fournit ~741 tok/s sur un modèle de classe 7B avec le meilleur Pass@1 à INT4  la production par défaut de 2026 pour le centre de données. Le 8e trimestre reste le terrain du milieu sur Hopper, Ada et Blackwell  presque sans pertes et largement soutenu. NVFP4 et MXFP4 (microscalage Blackwell) sont agressifs et nécessitent une validation par bloc. Deux équipes de pièges: le jeu de données d'étalonnage doit correspondre au domaine de déploiement, et le cache KV est séparé de la quantification du poids  la leçon AWQ "mon modèle est 4 Go maintenant" oublie le cache KV de 10 à 30 Go aux tailles de lot de production.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy memory and throughput comparison across formats)
**Prerequisites:** Phase 10 · 13 (Quantization foundations), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Nombre des six formats de quantification de production et de leurs points doux en 2026.
- Choisissez un format donné du matériel (CPU vs GPU, Hopper vs Blackwell), du moteur (vLLM, TRT-LLM, llama.cpp) et de la charge de travail (chat de routine, raisonnement, multi-LoRA).
- Compute la mémoire de poids enregistrée et le cache KV laissé intact pour un format choisi.
- Nommez le piège de l'ensemble de données d'étalonnage qui dégrade les modèles quantifiés sur le trafic de domaine.

## Le problème

La quantification réduit la mémoire et la bande passante HBM, ce qui est exactement ce dont le décodeur a besoin. Un modèle FP16 70B est de 140 Go de poids. Quantifier les poids à INT4 (AWQ ou GPTQ) et le modèle est de 35 Go s'adapte à un H100 avec place pour le cache KV, ce qui importe car à 128 séquences concurrentes avec 2K contexte, le cache KV seul est de 20-30 Go.

Mais la quantification n'est pas gratuite. La quantification agressive dégrade la qualité, en particulier sur les tâches lourdes de raisonnement. Différents formats fonctionnent avec différents moteurs. Différents matériels prennent en charge différentes précisions nativement. Le format du zoo 2026 est réel et vous ne pouvez pas copier le choix de quelqu'un d'autre.

## Le concept

### Les six formats

| Format | Bits | Sweet spot | Engines |
|--------|------|-----------|---------|
| GGUF Q4_K_M / Q5_K_M | 4-5 | CPU, edge, laptops | llama.cpp, Ollama |
| GPTQ | 4-8 | Multi-LoRA on vLLM | vLLM, TGI |
| AWQ | 4 | Datacenter GPU production | vLLM (Marlin-AWQ), TGI |
| FP8 | 8 | Hopper/Ada/Blackwell datacenter | vLLM, TRT-LLM, SGLang |
| MXFP4 | 4 | Blackwell multi-user | TRT-LLM |
| NVFP4 | 4 | Blackwell multi-user | TRT-LLM |

### GGUF  le CPU/edge par défaut

GGUF est un format de fichier, pas un schéma de quantification en soi. Il regroupe les variantes quantiques K (Q2_K, Q3_K_M, Q4_K_M, Q5_K_M, Q6_K, Q8_0) dans un conteneur. Q4_K_M et Q5_K_M sont les défauts de production  près de la qualité BF16 à 4-5 bits. Le meilleur choix pour le serveur CPU ou Edge car llama.cpp est de loin le moteur d'inférence CPU le plus rapide.

Penalty de débit dans vLLM: ~93 tok/s sur 7B  le format n'est pas optimisé pour les noyaux de GPU. Utilisez GGUF lorsque la cible de déploiement est CPU/edge.

### GPTQ  multi-LRA dans le vLLM

GPTQ est un algorithme de quantification post-entraînement avec un passage d'étalonnage.

Le succès unique: GPTQ-Int4 prend en charge les adaptateurs LoRA dans vLLM. Si vous utilisez un modèle de base plus 10 à 50 variantes finement ajustées (chacune en tant que LoRA), GPTQ est votre chemin. NVFP4 ne prend pas en charge encore LoRA dès le début de 2026.

### AWQ  le GPU par défaut du centre de données

La quantification de poids consciente de l'activation protège les poids les plus remarquables de 1% pendant la quantification. Noyaux Marlin-AWQ: 10.9x de vitesse par rapport à naïf. ~ 741 tok/s sur 7B, meilleur Pass@1 parmi les formats INT4.

Choisissez AWQ pour le nouveau service de GPU à moins que vous n'ayez besoin de multi-LoRA (GPTQ) ou d'un Blackwell FP4 agressif (NVFP4).

### PQ8  le milieu fiable

Le point flottant de 8 bits. Presque sans perte. Largement pris en charge. Les cœurs de tension Hopper accélèrent FP8 de manière native. Blackwell hérite. FP8 est le défaut sûr de 2026 lorsque la qualité n'est pas négociable (réasonnement, médical, génération de code). L'économie de mémoire est la moitié de l'INT4 mais le risque de qualité est beaucoup plus faible.

### MXFP4 / NVFP4  Blackwell agressif

Microscale FP4. Chaque bloc de poids a son propre facteur d'échelle. Aggressif mais accéléré par le matériel sur les cœurs de tensors Blackwell.

Les cavernes:
- Aucun soutien à la LRA pour l'instant (début 2026).
- Une baisse de la qualité visible sur les charges de travail lourdes.
- Valider sur votre ensemble d'évaluation par modèle.

### Le piège d'étalonnage

AWQ et GPTQ nécessitent un ensemble de données d'étalonnage  généralement C4 ou WikiText. Pour les modèles de domaine (code, médical, juridique), l'étalonnage sur le texte Web générique permet à l'algorithme de prendre de mauvaises décisions sur les poids à protéger. Pass@1 sur HumanEval peut perdre plusieurs points.

La solution: calibrer sur les données du domaine. Des centaines d'échantillons de domaine sont généralement suffisants.

### Le piège de cache KV

AWQ réduit les poids à 4 bits. Le cache KV est séparé et reste à FP16/FP8. Pour un modèle 70B avec AWQ:

- Poids: ~ 35 Go (INT4 à partir de 140 Go).
- Cache KV à 128 contextes simultané × 2k: ~ 20 Go.
- Activations: ~ 5 Go.
- Total: ~60 Go  s'adapte au H100 80 Go.

Naïvement, "J'ai quantifié mon modèle à 4 Go" oublie les autres 30 à 50 Go.

Separément, la quantification cache KV (FP8 KV ou INT8 KV) est un choix différent avec ses propres compromis  elle affecte directement la précision de l'attention et n'est pas une victoire libre.

### AWQ INT4 est dangereux pour le raisonnement

La chaîne de pensée, les mathématiques, le code-gen avec un long contexte  ceux-ci souffrent visiblement de quantification agressive. AWQ INT4 perd ~ 3-5 points sur MATH. Pour les charges de travail lourdes, envoyez FP8 ou BF16; acceptez le coût de la mémoire.

### Guide de sélection 2026

- Service de CPU/extrémité: GGUF Q4_K_M. Fin.
- GPU serve, chat de routine, pas de LoRA.
- GPU serve, multi-LoRA: GPTQ avec Marlin.
- Charge de travail de raisonnement: 8e RP.
- Centre de données Blackwell, qualité validée: NVFP4 + FP8 KV.
- Ambigu: effectuer une évaluation de 1000 échantillons sur chaque format de candidat.

```figure
gpu-memory-breakdown
```

## Utilisez-le

`code/main.py`Il compute l'empreinte mémoire (poids + KV + activations) et le débit relatif sur les six formats pour une gamme de tailles de modèles.

Le [Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?dtype=fp8&users=64)La machine montre FP8 sur un NVIDIA L4. Les poids tombent de 15,28 Go à 8,81 Go, le pool KV passe de 24 094 à 142 369 jetons, et la sortie mesurée à 64 utilisateurs passe de 250,85 à 735,91 jetons par seconde.

## La faire partir

Cette leçon produit `outputs/skill-quantization-picker.md`. Compte tenu du matériel, de la taille du modèle, du type de charge de travail et de la tolérance de qualité, choisit un format et produit un plan d'étalonnage/validation.

## Exercices

1. On court .`code/main.py`Pour un modèle 70B à 128 en simultané avec 2k contexte, calculer le total HBM pour chaque format.
2. Si vous avez tort sur la tolérance de qualité, quel est le chemin de récupération ?
3. Comptez la taille du ensemble de données d'étalonnage nécessaire pour calibrer AWQ pour un modèle de domaine médical. Pourquoi plus de données ne sont pas toujours meilleures?
4. Lisez le papier du noyau de Marlin-AWQ ou les notes de sortie. Expliquez en trois phrases pourquoi AWQ atteint 741 tok/s sur 7B alors que le GPTQ brut atteint ~712.
5. Quand est-il logique de combiner les poids AWQ avec le cache KV FP8 vs garder KV à BF16 ?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GGUF | "llama.cpp format" | File format bundling K-quant variants; CPU/edge default |
| Q4_K_M | "Q4 K M" | 4-bit K-quant medium; the production GGUF default |
| GPTQ | "gee pee tee q" | Post-train INT4 with calibration; supports LoRA in vLLM |
| AWQ | "a w q" | Activation-aware INT4; Marlin kernels; best Pass@1 at INT4 |
| Marlin kernels | "fast INT4 kernels" | Custom CUDA kernels for INT4 on Hopper; 10x speedup |
| FP8 | "eight-bit float" | Safe precision default on Hopper/Ada/Blackwell |
| MXFP4 / NVFP4 | "microscaling four" | Blackwell 4-bit FP with per-block scale factors |
| Calibration dataset | "cal data" | Input text used to pick quantization parameters; must match domain |
| KV cache quantization | "KV INT8" | Separate choice from weights; affects attention accuracy |

## Pour en savoir plus

- [VRLA Tech — LLM Quantization 2026](https://vrlatech.com/llm-quantization-explained-int4-int8-fp8-awq-and-gptq-in-2026/) des critères de référence comparatifs.
- [Jarvis Labs — vLLM Quantization Complete Guide](https://jarvislabs.ai/blog/vllm-quantization-complete-guide-benchmarks) Numéros de débit par format.
- [PremAI — GGUF vs AWQ vs GPTQ vs bitsandbytes 2026](https://blog.premai.io/llm-quantization-guide-gguf-vs-awq-vs-gptq-vs-bitsandbytes-compared-2026/) sélection format par format.
- [vLLM docs — Quantization](https://docs.vllm.ai/en/latest/features/quantization/index.html) formats et drapeaux pris en charge.
- [AWQ paper (arXiv:2306.00978)](https://arxiv.org/abs/2306.00978) la formule AWQ originale.
- [GPTQ paper (arXiv:2210.17323)](https://arxiv.org/abs/2210.17323) la formule originale du GPTQ.
