# GPU Autoscaling sur Kubernetes  Karpenter, KAI Scheduler, Scheduling de gang

> Trois couches, pas une. Les nœuds de fournitures Karpenter sont dynamiques (moins d'une minute, 40% plus rapide que Cluster Autoscaler). KAI Scheduler gère la planification de gang, la prise de conscience de la topologie et les files d'attente hiérarchiques. Il empêche le piège d'allocation partielle 7 sur 8 où sept nœuds attendent et brûlent sur un GPU manquant. Autoscalers au niveau de l'application (NVIDIA Dynamo Planner, llm-d Workload Variant Autoscaler) à l'échelle des signaux spécifiques à l'inférence  profondeur de file d'attente, utilisation du cache KV  pas cycle de travail du processeur / DCGM. Le classique piège de l' HPA est que`DCGM_FI_DEV_GPU_UTIL`est une mesure du cycle de tâche: 100% pourrait être 10 demandes ou 100. vLLM alloue préalablement la mémoire cache KV, de sorte que la mémoire ne déclenche jamais la mise à l'échelle.`WhenEmptyOrUnderutilized`une politique qui met fin à l'exécution de GPU en milieu d'inférence.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy queue-depth autoscaler simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Décrire les trois couches d'auto-échelle (provisionnement des nœuds, planification des groupes, niveau d'application) et nommer l'outil utilisé à chaque couche.
- Expliquez pourquoi .`DCGM_FI_DEV_GPU_UTIL`est le signal HPA incorrect pour vLLM et nomme deux remplacements (profondeur de file d'attente, utilisation de cache KV).
- Décrivez la planification des groupes et le mode d'échec de l'allocation partielle que KAI Scheduler empêche (7 GPU sur 8 inactifs).
- Nom de la politique de consolidation de Karpenter (`WhenEmptyOrUnderutilized`) qui met fin à l'exploitation des GPU et déclare l'alternative sûre de 2026.

## Le problème

Votre équipe envoie un service de maîtrise de la loi sur Kubernetes.`DCGM_FI_DEV_GPU_UTIL`Les pints de service à 100% utilisation pendant les heures de travail. HPA ne s'élargit jamais  il pense déjà que vous êtes plein. Vous ajoutez une réplique manuellement; TTFT tombe. HPA ne s'élargit toujours pas. Le signal vous ment.

Vous utilisez le Cluster Autoscaler pour les nœuds. Une requête de jeton 1M arrive à 2 heures du matin; le cluster passe 3 minutes à fournir un nœud, et les temps de demande sont terminés.

Vous déployez un modèle 70B qui nécessite 8 GPU sur 2 nœuds. Le cluster a 7 GPU gratuits, dispersés sur 3 nœuds, et a besoin d'un autre. Cluster Autoscaler fournit un nœud pour le 1 GPU manquant. Les 7 GPU réservés restent inactifs pendant 4 minutes en train de brûler de l'argent pendant que Kubernetes reçoit le dernier GPU.

Trois couches, trois modes d'échec différents. L'autoscalage conscient de la GPU en 2026 n'est pas "allumé à HPA". Il compose le provisionnement de nœuds, la planification de gangs et l'autoscalage des signaux d'application.

## Le concept

### Couche 1  fourniture de nœuds (Karpenter)

Karpenter surveille les pods et les nœuds de provision en attente en 45 à 60 secondes (Cluster Autoscaler prend généralement 90 à 120 secondes pour les nœuds GPU).`NodePool`restriction  si votre module a besoin de 8 H100 et que le cluster n'a pas de nœud correspondant, Karpenter fournit un directement au lieu d'échelonner un groupe existant.

**The consolidation trap**: Le défaut de Karpenter `consolidationPolicy: WhenEmptyOrUnderutilized`Il met fin à un nœud de GPU en cours d'exécution pour migrer les pods vers une instance de taille plus économique. Pour les charges de travail d'inférence qui signifient évacuer les demandes en cours d'exécution et reloader un modèle 70B sur le nouveau nœud.

Configuration sécurisée pour les pools GPU:

```yaml
disruption:
  consolidationPolicy: WhenEmpty
  consolidateAfter: 1h
```

Laissez Karpenter consolider des nœuds vraiment vides après une heure mais ne jamais expulser un emploi en cours.

### Couche 2  planification des gangs (KAI Scheduler)

KAI Scheduler (projet "Karp" renommé ensuite) gère ce que le kube-scheduler par défaut ne fait pas:

**Gang scheduling**Un module d'inférence distribuée nécessitant 8 GPU ou les 8 démarrent ensemble ou aucun ne le fait. Sans cela, vous obtenez le piège de l'allocation partielle: 7 des 8 pods démarrent, attendent indéfiniment, brûlent de l'argent.

**Topology awareness** savoir quels GPU partagent NVLink, qui sont sur le même rack, qui ont InfiniBand entre eux. Placez les pods en conséquence.

**Hierarchical queues** Plusieurs équipes se disputent pour le même pool de GPU avec priorité et quota.

KAI est déployé à côté de kube-scheduler comme un scheduler secondaire; vous annoterez les charges de travail pour l'utiliser.

### Couche 3  Signes au niveau de l'application

**The HPA trap**Le numéro de la liste:`DCGM_FI_DEV_GPU_UTIL`est une métrique du cycle de tâche  il mesure si le GPU faisait du travail à chaque intervalle d'échantillonnage. 100% utilisation pourrait signifier 10 demandes concurrentes ou 100; le GPU était occupé de toute façon.

Pire encore, les moteurs vLLM et similaires préalloquent la mémoire cache KV (jusqu'à `--gpu-memory-utilization`L'utilisation de la mémoire reste proche de 90% même à une seule demande.

**2026 replacement signals**- Le numéro de la liste:

- Profondeur de file d'attente (nombre de demandes attendues pour le remplissage préalable).
- Utilisation de cache KV (quelle fraction de blocs est allouée aux séquences actives).
- Le signal de votre SLA est TTFT P99 par réplique.
- Goodput (demandes de remplacement de tous les SLO par seconde).

NVIDIA Dynamo Planner et llm-d Workload Variant Autoscaler consomment ces signaux et réplices d'échelle. Ils remplacent entièrement HPA pour le service LLM.

### Quand utiliser quoi

| Scale decision | Tool |
|----------------|------|
| Add/remove nodes | Karpenter |
| Schedule multi-GPU jobs | KAI Scheduler |
| Add/remove replicas | Dynamo Planner / llm-d WVA (or custom HPA on queue depth) |
| Choose GPU type | Karpenter NodePool |
| Preempt low-priority | KAI Scheduler queues |

### Le pré-remplissage/décodage décomplexe tout

Si vous exécutez des classes de pré-remplissage/décodage désagrégées (phase 17 · 17), vous avez deux classes de pods avec des déclencheurs d'échelle différents: échelle de pods de pré-remplissage sur la profondeur de la file d'attente, échelle de pods de décode sur la pression de cache KV. llm-d les expose séparément `Services`Ne tentez pas de mettre un seul HPA devant les deux.

### Le début à froid est aussi important ici.

L'atténuation du démarrage à froid (phase 17 · 10) est le moment où le temps de mise en service des nœuds devient visible pour l'utilisateur.`min_workers=1`) pour les chemins critiques de la SLO, ou utiliser le point de contrôle modal à la couche d'application.

### Les chiffres que vous devriez vous rappeler

- Prévoyance de nœuds de carpenter: ~ 45-60s vs Cluster Autoscaler ~ 90-120s (nœuds GPU).
- Le schedulaire KAI empêche la prise de déchets partagés  7 sur 8.
- `DCGM_FI_DEV_GPU_UTIL`comme signal HPA: cassé; utilisez la profondeur de file d'attente ou l'utilisation de KV.
- Carpenter `WhenEmptyOrUnderutilized`: met fin à l'exécution des tâches de GPU.`WhenEmpty + consolidateAfter: 1h`Pour des inférences.

```figure
autoscaling
```

## Utilisez-le

`code/main.py`Simulation d'une échelle automatique à trois couches sur une charge de travail de GPU éclatée. Compares HPA naïf (cycle de travail), HPA de profondeur de file d'attente et escalage programmé par KAI-gang. Rapporte les demandes non satisfaites, minutes de GPU inactives et un score composite.

## La faire partir

Cette leçon produit `outputs/skill-gpu-autoscaler-plan.md`. Compte tenu de la topologie du cluster, de la forme de la charge de travail et de la SLO, il conçoit un plan d'auto-échelle de trois couches.

## Exercices

1. On court .`code/main.py`Dans une charge de travail intense, combien de demandes de HPA naïfs du cycle de travail font tomber les captures de HPA en profondeur de file d'attente ?
2. Conception d'un Carpenter NodePool pour un cluster desservant Llama 3.3 70B FP8 sur H100 SXM5.`capacity-type`- Je suis là .`disruption.consolidationPolicy`- Je suis là .`consolidateAfter`, et une tache qui empêche les charges de travail non GPU de ces nœuds.
3. Votre équipe rapporte que les déploiements sont bloqués dans l'attente parce que "GPUs disponibles mais la capsule ne planifie pas". Diagnose  est-ce Karpenter, kube-scheduler, ou KAI Scheduler?
4. Choisissez un signal pour les pods de remplissage pré-réparties à l'échelle automatique et un autre signal pour les pods de décode.
5. Calculer le coût de la `WhenEmptyOrUnderutilized`Trappe de consolidation sur un service de production 24x7 qui a en moyenne 60 événements de réduction des demandes par jour à P99 TTFT > 10s.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Karpenter | "the node provisioner" | Kubernetes node autoscaler; sub-minute provisioning |
| Cluster Autoscaler | "the old scaler" | Kubernetes node autoscaler predecessor; slower, group-based |
| KAI Scheduler | "the GPU scheduler" | Secondary scheduler for gang + topology + queues |
| Gang scheduling | "all or nothing" | Schedule N pods atomically or defer all of them |
| Topology awareness | "rack-aware" | Place pods based on NVLink/IB/rack placement |
| `DCGM_FI_DEV_GPU_UTIL` | "GPU utilization" | Duty-cycle metric; NOT a scaling signal for LLMs |
| Queue depth | "waiting requests" | Correct HPA signal for prefill-bound scaling |
| KV cache utilization | "memory pressure" | Correct HPA signal for decode-bound scaling |
| Consolidation | "Karpenter consolidation" | Node termination to cheaper instance type |
| `WhenEmpty + 1h` | "safe consolidation" | Policy that doesn't evict running GPU jobs |

## Pour en savoir plus

- [KAI Scheduler GitHub](https://github.com/kai-scheduler/KAI-Scheduler) documents de conception et exemples de configuration.
- [Karpenter Disruption Controls](https://karpenter.sh/docs/concepts/disruption/) la sémantique de la politique de consolidation et les défauts sécurisés par les GPU.
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) Dynamo Planner étalant les signaux.
- [Ray docs — KAI Scheduler for RayClusters](https://docs.ray.io/en/latest/cluster/kubernetes/k8s-ecosystem/kai-scheduler.html) Modèle d'intégration des rayons.
- [AWS EKS Compute and Autoscaling Best Practices](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-compute.html) orientation spécifique à Kubernetes gérée.
- [llm-d GitHub](https://github.com/llm-d/llm-d) Conception de la variante de charge de travail Autoscaler.
