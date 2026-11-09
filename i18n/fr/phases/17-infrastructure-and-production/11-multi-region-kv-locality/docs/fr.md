# L'application de la loi sur les droits de propriété intellectuelle et les droits de propriété intellectuelle

> L'équilibrage de la charge en round-robin est activement nocif pour l'inférence de la MLL en cache. Une demande qui ne débarque pas sur le nœud contenant son préfixe paie le coût de remplissage complet  environ 800 ms à P50 sur une longue demande par rapport à ~80 ms avec un cache hit. En 2026, le modèle de production est un routeur conscient du cache (vLLM Router in Rust, llm-d router) qui consomme des événements de cache KV et des routes sur le préfixe-hash match. Des recherches récentes (GORGO) font de la latence réseau interrégionale un terme explicite dans l'objectif de routage. Les offres commerciales d'"inférence transregionale" (inférence transregionale Bedrock, passerelles multi-cluster GKE) traitent l'inférence comme opaque  elles gèrent la disponibilité, pas le TTFT. JPMorgan et la Mayo Clinic ont fait une défaillance de l'East-1 en novembre 2024 à 22 minutes. La réalité de la DR: 32% des échecs de la DR LLM sont dus à ce que les équipes aient sauvegardé des poids mais ont oublié des fichiers de jeton ou des configurations de quantification.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy prefix-cache-aware router simulator)
**Prerequisites:** Phase 17 · 04 (vLLM Serving), Phase 17 · 06 (SGLang RadixAttention)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Expliquez pourquoi les ruptures de balance de charge en rouleau ont mis en cache l'inférence et quantifiez la sanction TTFT.
- Diagramme d'un routeur conscient du cache: entrées (événements de cache KV), algorithme (partie de préfixe-hash), coupe-coupe (utilisation de GPU).
- Nombre du pilote d'échec de DR de 32% pour les LLM (fichiers de jetonnisation manquants / configurations de quantification) et indiquez une liste de contrôle de DR de trois fichiers.
- Distinguer les offres commerciales trans-régionales (Bedrock CRI, GKE Multi-Cluster Gateway) de l'itinérance KV.

## Le problème

Votre service fonctionne dans US-East-1, US-West-2 et eu-West-1. Vous mettez un ALB devant avec round-robin. Le taux de préfixe cache de la production diminue à 8%. TTFT P50 triplé. Vos journaux vLLM montrent que chaque demande est payante le coût de remplissage complet.

Le round-robin est optimal pour les services sans état. L'inference LLM est stateful par conception  le cache KV encode tout ce que le modèle a vu.

Vous avez sauvegardé les poids du modèle vers la région S3. Une panne régionale survient; vous tentez de faire une panne; la réplique refuse de démarrer. Vous avez oublié que tokenizer.json, la configuration de quantification et la configuration de mise à l'échelle RoPE étaient dans un seau séparé que vous n'avez pas synchronisé.

Le service de LLM multi-régions est un problème de cache, un problème de routage et un problème d'hygiène DR  pas un problème d'équilibre de charge.

## Le concept

### Routage en connaissance de cache

La requête arrive avec un prompt. Le routeur hashes le préfixe (disons, les 512 premiers jetons); il demande à chaque réplique " avez-vous ce préfixe mis en cache ? " Les répliques publient des événements de cache KV sur un pub / sous-canal alors qu'elles allouent et évacuent des blocs. Le routeur choisit la réplique avec le match, passe à un coupe-coupe basé sur GPU util si personne ne le fait.

**vLLM Router**(Rust, 2026 production-stack): souscrit à `kv.cache.block_added`événements, maintient un préfixe-hash → réplique index, routes avec $O(1)$Il tombe à la plus petite profondeur de file d'attente quand il n'y a pas de match.

**llm-d router**: le même schéma, Kubernetes natif. Publie des événements via l'API ControlPlane.

**SGLang RadixAttention**(Phase 17 · 06) est l'équivalent intra-replica.

### Numéros

TTFT P50 sur une demande de jeton 2K, Llama 3.3 70B FP8, H100:
- Accès de cache (même réplique, préfixe résident): ~80 ms.
- Faute de cache (pré-remplissage à froid): ~ 800 ms.

Si votre routeur atteint 60 à 80% du cache de préfixe sur les réplices, vous approximerez la performance de la seule réplica à la capacité de N-réplique.

### La zone transversale a une nouvelle contrainte  latence réseau

RTT interrégionale:
- US-Est-1  US-Ouest-2: ~65 ms.
- États-Unis-Est-1  Eu-Ouest-1: ~75 ms.
- États-Unis-est-1  ap-sud-est-1: ~ 220 ms.

Si le routage prend une demande de us-est-1 à un préfixe chaud en ap-sud-est-1, le préfilé enregistré (800 → 80 ms, donc 720 ms) se réduit à environ 500 ms une fois que le ~220 ms RTT est payé, et la marge disparaît si la région éloignée fait la queue de la demande ou a déjà expulsé le préfixe.`prefill_time + network_latency`La réponse est souvent de continuer à router régionalement sauf sur des préfixes massifs de plusieurs MB où le préfilement domine.

### Les "inférences transregionales" commerciales ne sont pas utiles ici.

L'inference transregionale AWS Bedrock enroute automatiquement les demandes vers d'autres régions pendant la pression de capacité. Elle optimise la disponibilité, pas le TTFT, et traite l'inference comme opaque.

Vous avez toujours besoin d'un routeur de mise en cache de la couche de l'application même lorsque vous utilisez ces. Ils gèrent le cas " us-east-1 est en feu ".

### L'hygiène DR  le problème des dossiers manquants de 32%

Statistique 2026 largement citée: 32% des échecs de la DR LLM se produisent parce que les équipes ont sauvegardé des poids mais ont oublié:

- `tokenizer.json`ou `tokenizer.model`
- Configuration de la quantification (`quantize_config.json`, échelles AWQ, points zéro GPTQ)
- Configurations spécifiques au modèle (mesure RoPE, masques d'attention, modèles de chat)
- Configuration du moteur (`vllm_config.yaml`, défauts de prélèvement d'échantillons, manifestes de l'adaptateur LoRA)

La fixation est un manifeste DR minimum de trois fichiers:

1. Tous les fichiers sous le modèle HF repo (poids + configurations + tokenizer).
2. Configuration de service spécifique au moteur.
3. Manifeste de déploiement (K8s YAML, fichier Docker, verrouillage de dépendance).

Le drill de JPMorgan US-East-1 a atteint 22 minutes de récupération en novembre 2024 seulement parce que le manuel de jeu a été répété.

### La résidence des données est orthogonale

Si votre routeur de cache-conscient envoie une demande parisienne à us-east-1 pour une correspondance de préfixe, vous avez violé le RGPD indépendamment du gain TTFT. Partagez les routeurs par limite de résidence avant d'optimiser le cache.

### Les chiffres que vous devriez vous rappeler

- L'écart entre le cache et le TTFT: ~ 10x (80 ms contre 800 ms sur 2K prompt).
- RTT interrégional États-Unis-UE: ~75 ms.
- Failure de DR: 32% manquent les configurations de jeton/quant.
- JPMorgan us-east-1 échec de l'offre Nov 2024: 22 minutes (30 minutes SLA).

```figure
cache-aware-router
```

## Utilisez-le

`code/main.py`Simulation de trois stratégies de routage (route-robin, cache-conscient régional, cache-conscient global) sur une charge de travail multi-régions.

## La faire partir

Cette leçon produit `outputs/skill-multi-region-router.md`- compte tenu des régions, des contraintes de résidence et de l'ALS, il conçoit un plan d'itinéraire.

## Exercices

1. On court .`code/main.py`À quelle longueur rapide le routage interrégional dépasse le routage local, compte tenu du RTT de 75 ms ?
2. Votre taux de cache de frappe diminue de 70% à 12%.
3. Conceptez un manifeste DR pour un modèle quantifié AWQ 70B servi dans vLLM avec 5 adaptateurs LoRA.
4. Débattre si l'inférence transregionale de Bedrock est "assez" pour une fintech avec des OTS TTFT strictes.
5. Une demande d'origine parisienne correspond à un préfixe dans l'Est-Est.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Cache-aware routing | "smart LB" | Route on prefix-hash match to KV-cache-holding replica |
| KV-cache events | "cache pub-sub" | Replicas publish block add/evict; router indexes |
| Prefix hash | "cache key" | Hash of first N tokens used as router lookup |
| GORGO | "cross-region routing research" | arXiv 2602.11688; network latency as explicit term |
| Cross-region inference | "Bedrock CRI" | AWS product; availability failover, not TTFT awareness |
| DR manifest | "the backup list" | Every file needed to restore — not just weights |
| Data residency | "GDPR boundary" | Legal constraint on which region sees user data |
| RTT | "round-trip time" | Network latency; 75 ms US-EU, 220 ms US-APAC |
| LLM-aware LB | "cache-hit LB" | Cache-aware router as a product category |

## Pour en savoir plus

- [BentoML — Multi-cloud and cross-region inference](https://bentoml.com/llm/infrastructure-and-operations/multi-cloud-and-cross-region-inference)
- [arXiv — GORGO (2602.11688)](https://arxiv.org/html/2602.11688v1) réutilisation de la cache KV trans-régionale avec une durée de latence réseau.
- [TianPan — Multi-Region LLM Serving Cache Locality](https://tianpan.co/blog/2026-04-17-multi-region-llm-serving-data-residency-routing)
- [AWS Bedrock Cross-Region Inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html) documentation de défaillance de disponibilité.
- [vLLM Production Stack Router](https://github.com/vllm-project/production-stack) source de routeur conscient du cache.
