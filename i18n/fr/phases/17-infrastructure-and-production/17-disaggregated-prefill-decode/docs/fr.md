# Décodage pré-remplissage décomposé  NVIDIA Dynamo et llm-d

> Le pré-remplissage est lié à l'informatique; le décode est lié à la mémoire. Exécuter les deux sur le même GPU gaspille une ressource. La désagrégation les divise en pools séparés et transfère le cache KV entre eux sur NIXL (RDMA/InfiniBand ou TCP fallback). NVIDIA Dynamo (GTC 2025 annonce, 1.0 GA) est situé au-dessus de vLLM/SGLang/TRT-LLM  son Planner Profiler + SLA Planner pré-remplissage automatique-match:décode pour répondre aux SLO. NVIDIA publie des gains de débit dans ce stade  developer.nvidia.com (2025-06) montre une amélioration de ~6x pour DeepSeek-R1 MoE sur GB200 NVL72 + Dynamo dans le régime de latence moyenne, et la page de produit Dynamo (developer.nvidia.com, non datée) annonce jusqu'à 50x de débit MoE sur GB300 NVL72 + Dynamo vs Hopper. Le chiffre "30x" est un agrégat communautaire sur les rapports Blackwell + Dynamo + DeepSeek-R1 à pile complète; nous n'avons pas trouvé de source primaire indiquant exactement 30x, alors traitez-le comme une revendication directionnelle. llm-d (Red Hat + AWS) est Kubernetes natif: pré-remplir / décoder / routeur comme services indépendants avec HPA par rôle. llm-d 0.5 ajoute un déchargement KV hiérarchique, un routage LoRA conscient du cache, un réseau UCCL, une échelle à zéro. Économie: le déploiement interne de plusieurs informations sur les clients suggère des économies de 3040% sur $2M-class inference spend (i.e., $600-800 K/an) lors du passage d'une portion en collage à une portion décomposée avec Dynamo à un SLA constant;$2M→$Le chiffre 600-800K est un composite interne, pas une seule étude de cas publiée  l'utiliser comme un ordre de grandeur ancre, pas une citation de référence.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy disaggregated-vs-colocated simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 08 (Inference Metrics)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Expliquez pourquoi les précharges et les décodés ont des allocations GPU optimales différentes et quantifiez les déchets sous colocation.
- Diagramme de l'architecture décomposée: pré-remplissage, décodeur, transfert de KV via NIXL, routeur.
- Nombre de conditions dans lesquelles la désagrégation ne porte pas ses fruits (indications courtes, sorties courtes).
- Distinguer NVIDIA Dynamo (stack-above) de llm-d (Kubernetes-native) et correspondre chacun à un contexte opérationnel.

## Le problème

Vous exécutez Llama 3.3 70B sur 8 H100. Sous une charge de travail mixte (longues demandes + courtes sorties), les GPU sont inactifs pendant le décode parce que la plupart du calcul a été dépensé sur le pré-remplissage. Sous une charge de travail différente (courts demandes + longues demandes), il se passe le contraire.

L'impact budgétaire: 20 à 40% du temps de la GPU est gaspillé sur la mauvaise ressource. Vous achetez un calcul H100 pour exécuter le décodeur lié à la mémoire, ou achetez une bande passante H100 HBM pour exécuter le préchargement lié au calcul.

La désagrégation divise le pré-remplissage et le décodeur en pools séparés de taille pour chaque goulot d'étranglement.

## Le concept

### Pourquoi les écarts de contrôle diffèrent

**Prefill** exécuter le transformateur sur le prompt d'entrée complet dans un avant. Les multiplications de matrice dominent; en fonction de l'informatique. H100 FP8 donne ~ 2000 TFLOPS de débit utile. L'efficacité du lot est bonne  un avant traite de nombreux jetons.

**Decode** générer un jeton à la fois, en lisant les poids complets à chaque itération. La mémoire-largeur de bande est limitée. HBM3 donne ~ 3 TB/s. L'efficacité du lot est bonne uniquement à haute simultanéité  les poids lus amortize à travers le lot.

Leur colocation: vous achetez des GPU optimisées pour les deux. H100 est bon pour les deux mais coûte le même en tous les cas. À l'échelle, vous voulez un bassin de pré-remplissage sur H100 / calcul-cheveux; décodeur bassin sur H200 / mémoire-cheveux, ou avec quantification agressive.

### L'architecture

```
            ┌──────────────┐
  Request → │    Router    │ ───────────────────────┐
            └──────┬───────┘                        │
                   │                                │
                   ▼ (prompt only)                  │
            ┌──────────────┐    KV cache    ┌───────▼──────┐
            │ Prefill pool │ ─── NIXL ────► │ Decode pool  │
            │  (compute)   │                │  (memory)    │
            └──────────────┘                └──────┬───────┘
                                                   │ tokens
                                                   ▼
                                                 Client
```

NIXL est le transport internode de NVIDIA. Utilise RDMA/InfiniBand quand il est disponible, TCP fallback autrement. La latence de transfert est réelle  typiquement 20-80 ms pour le cache KV d'un prompt 4K-token sur 70B FP8.

### Dynamo contre Illm-d

**NVIDIA Dynamo**(annonce de la CGD 2025, 1.0 GA):
- Assise au-dessus de VLLM, SGLang, TRT-LLM en tant qu'orchestre.
- Le profilateur de planificateur mesure la charge de travail, le planificateur de SLA configure automatiquement les ratios de pré-remplissage: décode.
- Le noyau de rouille, l'extensibilité de Python.
- Gains de débit: NVIDIA rapporte 6x pour DeepSeek-R1 MoE sur GB200 NVL72 + Dynamo dans le régime de latence moyenne (developer.nvidia.com, 2025-06); les rapports communautaires de "jusqu'à 30x" sur les piles complètes Blackwell + Dynamo + DeepSeek-R1 manquent d'une seule source primaire et devraient être traités comme directionnels.
- GB300 NVL72 + Dynamo: jusqu'à 50 fois le débit MoE par rapport à Hopper par page de produit Dynamo (développer.nvidia.com, non daté).

**llm-d**(Red Hat + AWS, natif de Kubernetes):
- Remplissez / décodez / routeur en tant que services Kubernetes indépendants.
- HPA par rôle avec des signaux de profondeur de file d'attente (préchargement) / utilisation KV (décodage).
- `topologyConstraint packDomain: rack`les paquets de pré-remplissage+décodage cliques sur le même rack pour le transfert de KV à haute bande passante.
- Ilm-d 0.5 (2026): déchargement hiérarchique de KV, routage LoRA conscient du cache, réseautage UCCL, échelle à zéro.

Utilisez Dynamo si vous voulez un orchestrateur géré par la pile, ou llm-d si vous voulez des primitifs natifs Kubernetes et engagés dans l'écosystème CNCF.

### Économie

Composite interne (pas une seule étude de cas publiée  ancrage d'ordre de grandeur):

- 2 millions de dollars par an sont dépensés pour les portions en collage.
- Passer à désagrégé avec Dynamo.
- Le même volume de demande, le même SLA de latence P99.
- Économies déclarées: $600K–$800 000 par an (30% à 40% de réduction).
- Pas de matériel nouveau.

Nous synthétisons ce chiffre à partir de plusieurs divulgations de clients plutôt qu'une seule étude de cas citable; le point de données publié le plus proche est le TTFT 2x plus rapide de Baseten / 61% de débit plus élevé avec le routage Dynamo KV (baseten.co, 2025-10), et la projection de VAST + CoreWeave de 60130% de jetons / $ de plus à 4060% KV taux de succès (vastdata.com, 2025-12). Les économies sont dues à la taille correcte de chaque piscine; les charges de travail lourdes à remplir en pré-emplacement (RAG avec préfixes 8K+) bénéficient davantage que les charges équilibrées.

### Lorsque ne pas être décomposé

- Les impôts < 512 jetons et les sorties < 200 jetons: l'impôt sur les transferts domine les gains.
- Petit cluster (< 4 GPU): insuffisante diversité de piscine.
- L'équipe ne peut pas exploiter deux pools GPU avec une mise à l'échelle par rôle: Dynamo aide mais pas triviellement.
- Aucun tissu RDMA: la taxe de transfert TCP est plus lourde.

### Le routeur s'intègre à la phase 17 · 11

Les routeurs désagrégés sont conscients du cache KV (phase 17 · 11). Une demande atterrit sur le pool de décode contenant son préfixe  si aucune correspondance, il déplace préfill → décode.

### Le MoE sur Blackwell est où les chiffres réels sont

Le routage expert MoE est lourd en calcul sur le pré-remplissage mais lourd en mémoire sur le décodeur (caches experts), de sorte que la désagrégation est une double victoire. Le modèle frontalier de 2026 est le modèle dominant MoE (DeepSeek-V3, futures variantes GPT-5).

### Les chiffres que vous devriez vous rappeler

Les chiffres de référence dérivent  NVIDIA et la pile d'inférence publient des résultats mis à jour chaque trimestre.

- DeepSeek-R1 sur GB200 NVL72 + Dynamo: ~6x débit par rapport à la ligne de base dans le régime de latence moyenne (developer.nvidia.com, 2025-06); les revendications communautaires "jusqu'à 30x" sur les piles Blackwell + Dynamo complètes sont des agrégats directionnels sans source primaire unique.
- GB300 NVL72 + Dynamo: jusqu'à 50 fois le débit MoE par rapport à Hopper (développer.nvidia.com, non daté).
- Ancrage d'épargne (composite interne, pas une seule étude de cas): $600-800K/year off a $2 millions de dépenses annuelles à un taux constant de SLA.
- Le seuil de désagrégation: les commandes > 512 jetons + les sorties > 200 jetons.
- Transfert de KV par NIXL: 20 à 80 ms pour KV 4K-prompt sur 70B FP8.

```figure
prefill-decode-split
```

## Utilisez-le

`code/main.py`Simulation de la portion coloquée par rapport à celle désagrégée.

## La faire partir

Cette leçon produit `outputs/skill-disaggregation-decider.md`- compte tenu de la charge de travail et du cluster, décide de découpler ou non.

## Exercices

1. On court .`code/main.py`À quelle longueur rapide la désagrégation va-t-elle surpasser la colocation ?
2. Conceptualiser le pool de pré-remplissage et le pool de décode pour un service RAG avec un préfixe P99 de longueur 8K, sortie 300.
3. Dynamo vs llm-d: choisissez un magasin pur Kubernetes sans préférence pour le temps d'exécution Python.
4. Comptez le coût de transfert de KV: 4K préchargement sur 70B FP8 = ~ 500 MB KV. À RDMA 100 GB/s, transfert = 5 ms. À TCP 10 GB/s = 50 ms. Qu'est-ce qui compte pour votre SLA?
5. Comment la désagrégation se comporte-t-elle avec le MoE qui active différents experts par jeton ?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Disaggregated serving | "split prefill/decode" | Separate GPU pools for each phase |
| NIXL | "NVIDIA transport" | Dynamo's inter-node KV transfer (RDMA/TCP) |
| NVIDIA Dynamo | "the orchestrator" | Stack-above coordinator for vLLM/SGLang/TRT-LLM |
| llm-d | "Kubernetes native" | Red Hat + AWS K8s disaggregated stack |
| Planner Profiler | "Dynamo auto-config" | Measures workload, configures pool ratios |
| SLA Planner | "Dynamo policy" | Auto-rate-matches prefill:decode to meet SLOs |
| `packDomain: rack` | "llm-d topology" | Pack prefill+decode on same rack for fast KV |
| UCCL | "unified collective" | llm-d 0.5 networking layer for scale-to-zero |
| MoE expert routing | "expert per token" | DeepSeek-V3 pattern; disaggregation helps |

## Pour en savoir plus

- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/)
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/)
- [TensorRT-LLM Disaggregated Serving blog](https://nvidia.github.io/TensorRT-LLM/blogs/tech_blog/blog5_Disaggregated_Serving_in_TensorRT-LLM.html)
- [llm-d GitHub](https://github.com/llm-d/llm-d)
- [llm-d 0.5 release notes](https://github.com/llm-d/llm-d/releases)
