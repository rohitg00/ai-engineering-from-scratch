# Production Servant Stack  Déchargement KV et routage en cache

> Une production qui sert le routeur, les moteurs et l'observabilité des fils de pile dans un déploiement Kubernetes et traite le cache KV comme une ressource qui peut quitter le GPU. Le déchargement KV extrait le cache KV de la mémoire de la GPU et le réutilise sur les requêtes et les moteurs (DRAM du processeur, puis disque/Ceph). La production-stack de vLLM est le déploiement de référence; LMCache est la couche de déchargement. Le connecteur de déchargement vLLM 0.11.0 KV (janvier 2026) rend ce connecteur asynchrone et branchable via l'API du connecteur (v0.9.0+). Le chemin de déchargement est généralement caché du chemin de la demande, bien que les manquements de cache et les promotions puissent ajouter une latence de bout en bout. LMCache est précieux même sans préfixes partagés  lorsque un GPU se débarrasse des fentes KV, les demandes préemptives peuvent être restaurées à partir du processeur au lieu de recomputer le préchargement. Des benchmarks publiés sur 16x H100 (80 GB HBM) sur 4 a3-highgpu-4g: lorsque le cache KV dépasse le HBM, la décharge de CPU native et le LMCache améliorent considérablement le débit; à faible empreinte KV, toutes les configurations correspondent à la ligne de base avec de petites charges générales.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy KV-spill simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 06 (SGLang/RadixAttention)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Diagramme des couches de production de la pile vLLM: routeur, moteurs, déchargement KV, observabilité.
- Expliquez l'API du connecteur de déchargement KV (v0.9.0+) et comment le chemin asynchrone 0.11.0 cache la latence de déchargement.
- Quantifier quand le LMCache aide le CPU-DRAM (KV > HBM) par rapport aux coûts généraux (KV suffisamment petit pour s'adapter au HBM).
- Choisissez entre le déchargement de CPU vLLM natif et le connecteur LMCache compte tenu des contraintes de déploiement.

## Le problème

Votre service vLLM affiche les GPU à 100% HBM avec des événements de préemption chaque fois que la concurrence monte. Les demandes sont expulsées, réquisitions et vous remplissez à nouveau la même requête de jeton 2K quatre fois en une minute. Le calcul de la GPU est dépensé sur des pré-remplissages redondants; le rendement est bien inférieur au rendement brut.

L'ajout de plus de GPU coûte linéairement. L'ajout de plus de HBM n'est pas possible. Mais le DRAM de CPU est bon marché  une prise a 512 GB + à des ordres de latence de magnitude pires que HBM mais bien pour le cache KV "temporairement chaud".

LMCache extrait le cache KV dans le DRAM du processeur afin que les demandes préemptées se récupèrent rapidement, et les préfixes répétés à travers les moteurs partagent le cache sans que chaque moteur soit rechargé.

## Le concept

### vLLM série de production

`github.com/vllm-project/production-stack`est le déploiement Kubernetes de référence:

- **Router** cache-conscient (phase 17 · 11). Consomme des événements KV.
- **Engines** travailleurs vLLM. Un par GPU ou par groupe TP/PP.
- **KV cache offload** Déploiement de LMCache ou connecteur natif.
- **Observability**- Prometheus, les tableaux de bord Grafana, les traces OTel.
- **Control plane** Découverte de services, configuration, mises à jour en cours.

Envoyé en tant qu'opérateur Helm chart +.

### L'API du connecteur de déchargement KV (v0.9.0+)

vLLM 0.9.0 a introduit une API Connector pour les backends cache KV branchables. Votre moteur décharge les blocs sur le connecteur; le connecteur les stocke (RAM, disque, stockage d'objets, LMCache).

vLLM 0.11.0 (janvier 2026) ajoute un chemin de déchargement asynchrone  déchargement peut se produire en arrière-plan afin que le moteur ne le bloque pas dans le cas courant. La latence et le débit de bout en bout dépendent toujours de la forme de la charge de travail, du taux de débit de cache KV et de la pression du système; les notes de vLLM indiquent que le débit de noyau personnalisé peut dégrader le débit à faibles taux de débit et que la planification asynchrone a connu des problèmes d'interaction avec le décoding spéculatif.

### Déchargement du processeur natif par rapport à LMCache

**Native vLLM CPU offload**: localisé par le moteur. stocke des blocs KV dans la RAM hôte. rapide à mettre en œuvre, zéro saut réseau. Ne croise pas les moteurs.

**LMCache connector**Les blocs sont accessibles à n'importe quel moteur. 16x H100 de référence publiés.

Choisissez natif lorsqu'un seul moteur a une pression HBM. Choisissez LMCache lorsque plusieurs moteurs partagent des préfixes (RAG avec des instructions système communes, multi-locataire avec des modèles partagés).

### Comportement de référence

Le test H100 16x (HBM de 80 Go) réparti sur 4 a3-highgpu-4g:

- Faible empreinte KV (réponse courte, faible concurrence): toutes les configurations correspondent à la ligne de base, LMCache ajoute ~ 3-5% de frais généraux.
- Modérée empreinte: LMCache commence à aider à réutiliser les préfixes dans les moteurs.
- KV dépasse HBM: déchargement de CPU natif et LMCache améliorent tous deux le débit de manière substantielle; LMCache plus grand gain en raison du partage entre moteurs.

### Lorsque la LMCache est décisive

- Service multi-locataires où les informations du système sont partagées entre les locataires.
- RAG où les pièces de document se répètent à travers les requêtes.
- Variantes finement ajustées (LoRA) sur la même base où la réutilisation du modèle de base KV réduit le travail redondant.
- Charges de travail lourdes: récupérer à partir de la CPU moins cher que de re-précharger.

### Lorsque N' activer pas

- Petite pression HBM  vous payez les frais généraux sans avantage.
- Contexts courts (tokens < 1K)  temps de transfert > ré-récharge.
- Charge de travail à un seul locataire à une seule demande  aucune réutilisation à capturer.

### Intégration avec une portion décomposée

Phase 17 · 17 serveurs désagrégés + composés LMCache: KV transfère de pré-remplissage pool à décodeur de terre pool dans LMCache si elle n'est pas utilisée; les requêtes ultérieures tirent de LMCache. Phase 17 · 11 routeur conscient de cache peut rouvrir vers le moteur dont le cache local ou LMCache partagé correspond à la cache.

### Les chiffres que vous devriez vous rappeler

- VLLM 0.9.0: API du connecteur expédié.
- vLLM 0.11.0 (janvier 2026): chemin de déchargement asynchrone; impact de latence de bout en bout dépend de la charge de travail, de la vitesse de KV et de la pression du système (pas une garantie absolue).
- 16x H100: LMCache aide lorsque l'empreinte de KV dépasse la HBM.
- Petite pression HBM: 3-5% de frais généraux sans avantage.

```figure
zero-sharding
```

## Utilisez-le

`code/main.py`Il est également possible de simuler une charge de travail lourde avec et sans LMCache.

## La faire partir

Cette leçon produit `outputs/skill-vllm-stack-decider.md`. Compte tenu de la forme de la charge de travail et du déploiement de vLLM, décide native vs LMCache vs aucun des deux.

## Exercices

1. On court .`code/main.py`À quelle utilisation de HBM commence LMCache à payer ?
2. Un locataire partage un système de jeton 6K sur 200 requêtes par heure.
3. Le serveur LMCache est un point unique d'échec.
4. Pour un KV 4K à 70B FP8 (500 MB), quel est le temps de lecture par rapport à la pré-remplissage ?
5. Discutez si le chemin asynchrone vLLM 0.11.0 est "libre"  où se cache la tête supérieure?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Production-stack | "the reference deployment" | vLLM's Kubernetes Helm chart + operator |
| Connector API | "KV backend interface" | vLLM 0.9.0+ pluggable KV store interface |
| Native CPU offload | "engine-local spill" | Store KV in host RAM of same engine |
| LMCache | "cluster KV cache" | Cross-engine KV cache server on CPU DRAM + disk |
| 0.11.0 async | "non-blocking offload" | Offload hidden behind engine stream |
| Preemption | "evict to make room" | KV cache shuffle when HBM full |
| Prefix reuse | "same system prompt" | Multiple queries share beginning; cache hit |
| Ceph tier | "disk tier" | Durable storage below DRAM in the cache hierarchy |

## Pour en savoir plus

- [vLLM Blog — KV Offloading Connector (Jan 2026)](https://blog.vllm.ai/2026/01/08/kv-offloading-connector.html)
- [vLLM Production Stack GitHub](https://github.com/vllm-project/production-stack) Graphique du casque + opérateur.
- [LMCache for Enterprise-Scale LLM Inference (arXiv:2510.09665)](https://arxiv.org/html/2510.09665v2)
- [LMCache GitHub](https://github.com/LMCache/LMCache) Implementation du connecteur.
- [vLLM 0.11.0 release notes](https://github.com/vllm-project/vllm/releases) détails de la trajectoire asynchrone.
