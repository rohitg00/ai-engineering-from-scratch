# Réduction du démarrage à froid pour les LLM sans serveur

> Un modèle grand prend quelques minutes pour passer du froid à la serveur: un modèle 70B sur un noeud frais a besoin d'environ 3 à 8 minutes avant le premier jeton. Dans un monde sans serveurs, ce n'est pas un réchauffement, c'est une panne. Les atténuations fonctionnent à cinq niveaux: images de nœuds pré-sémentées (Bottlerocket sur AWS, arc à double volume), streaming de modèle (NVIDIA Run:ai Model Streamer, natif en vLLM), captures instantanées de mémoire GPU (points de contrôle modèles, redémarrage jusqu'à 10 fois plus rapide), piscines chaudes (`min_workers=1`Le module de téléchargement est un module de téléchargement de 2 à 4 étages, basé sur un système de téléchargement de 2 à 4 étages, basé sur un système de téléchargement de 5 à 5 étages, basé sur un système de téléchargement de 2 à 5 étages.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy cold-start path simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 03 (GPU Autoscaling)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Nombrez les cinq couches d'atténuation du démarrage à froid et nommez un outil ou un motif à chaque couche.
- Comptez le temps total de démarrage à froid comme la somme de (provisionnement du nœud) + (poids de téléchargement) + (poids de chargement dans le HBM) + (initiation du moteur) pour un modèle 70B.
- Expliquez pourquoi la migration en direct transfère des jetons d'entrée (KB) et non le cache KV (GB) et quelle est la sanction (recomputation).
- Nommez le compromis de la piscine chaude (payer pour la GPU en marche ou accepter la queue de démarrage à froid) et le seuil de SLA à lequel `min_workers > 0`devient obligatoire.

## Le problème

Votre point final de votre LLM sans serveur passe à zéro au cours de la nuit.

1. Karpenter fournit un nœud GPU: 45-60s.
2. Le conteneur tire une image de 30 Go avec des poids: 120-300s.
3. Le moteur charge des poids dans le HBM: 45 à 120s selon la taille du modèle et la vitesse de stockage.
4. VLLM ou TRT-LLM initiale les graphiques CUDA, KV cache pool, jeton: 10-30s.

Total: 220-510s (environ 3 à 8 minutes) avant le retour d'un jeton.`min_workers=1`Si votre service a 5 produits chacun avec une réplique chaude, c'est 5 × 24 × 30 = 3 600 GPU-heures / mois, qu'un seul utilisateur ait appelé ou non.

L'atténuation du démarrage à froid est de garder l'économie sans serveur tout en approximant la latence du toujours-on.

## Le concept

### Couche 1  images de nœuds pré-semencés (Bottlerocket)

Sur AWS, l'architecture à double volume de Bottlerocket sépare le système d'exploitation des données.`EC2NodeClass`. Les nouveaux nœuds démarrent avec des poids déjà sur le NVMe local  étapes 2 et partie 3 disparaissent. Fonctionne avec Karpenter natively. Économies typiques: 2-4 minutes par démarrage à froid pour les grands modèles.

Équivalent sur GCP: images VM personnalisées avec des couches de conteneurs prépayées. sur Azure: instantanés de disque gérés avec le même motif.

### Couche 2  Modèle de diffusion (Run:ai Modèle Streamer)

Au lieu de charger le fichier complet avant de répondre à la première demande, le flux de poids dans la mémoire GPU couche par couche et commencer le traitement dès que le premier bloc transformateur est résident. Le NVIDIA Run:ai Model Streamer expédite natif dans vLLM 2026. Fonctionne avec S3, GCS et NVMe local. Réduit le temps de charge de poids d'environ la moitié pour les grands modèles en superposant I / O avec la configuration de calcul.

### Couche 3  Snapshots de mémoire GPU (Modal)

Modal prend un point de contrôle de l'état de la GPU (poids, graphiques CUDA, région cache KV) après le premier chargement. Les redémarrages ultérieurs désérialisent directement dans HBM  10 fois plus rapidement que la réinitialisation. C'est la chose la plus proche de "démarrer un GPU chaud en 2 secondes".

### Couche 4  piscines chaudes (min_travailleurs=1)

La méthode la plus simple: gardez toujours une réplique prête. Le coût est le taux horaire d'un GPU 24x7.$0.85-$1,50/h pour éviter un démarrage à froid de 30s) et gentils à de grands (payer 4 $/h pour éviter un démarrage à froid de 5 minutes). Le seuil SLA où les piscines chaudes deviennent obligatoires: typiquement TTFT P99 < 60s sur un modèle 70B+.

### Couche 5  Chargement à plusieurs niveaux (LLM sans serveur)

ServerlessLLM traite le stockage comme une hiérarchie: NVMe (rapide mais grand), DRAM (médium mais classé), HBM (petit mais instantané). Les poids sont pré-chargés sur DRAM; chargement à la demande dans HBM. Le papier rapporte une réduction de latence de 10-200 fois sur les charges froides par rapport à des naïfs disques à HBM. L'adoption de la production est précoce mais des intégrations avec vLLM existent.

### Couche 6  migration en direct (moteur bonus)

Lorsqu'un nœud devient indisponible (éviction de point, drain de nœud), le modèle traditionnel est de démarrer à froid une autre réplique et de drain de requête de file d'attente. La migration en direct déplace les jetons d'entrée (kilobytes) vers une destination qui a le modèle chargé et recompte le cache KV sur la destination. La recomputation est moins chère que le transfert de GB de cache KV sur le réseau. Applicable aux déploiements désagrégés.

### Le calcul de la piscine chaude

Pour un service avec P99 TTFT SLA de 2s, la question n'est pas "poisson chaud oui/non" mais "combien de réplicas chaudes, et quels chemins les obtiennent".

- Volets interactifs à haute valeur (chat en direct, agent de voix): `min_workers=1-2`- Je suis désolé .
- Parcours de départ de l'arrière-plan (classification nocturne): accepté à l'échelle de zéro, tolérable à partir de 5 à 10 minutes à froid.
- Niveau de prime: `min_workers`par locataire ayant une capacité dédiée.

### Mesurer avant d'optimiser

Anatomie à démarrage à froid pour un modèle 70B sur un noeud frais (illustratif):

| Phase | Time | Mitigation |
|-------|------|-----------|
| Node provision | 50s | Bottlerocket + pre-seeded image, warm pool |
| Image pull | 180s | Pre-seeded data volume (eliminate) |
| Weights to HBM | 75s | Model streamer (halve); GPU snapshot (eliminate) |
| Engine init | 20s | Persistent CUDA graph cache |
| First forward | 3s | Min inherent latency |
| **Total cold** | **328s** | |
| **Total with mitigations** | **~15s** | 22x reduction |

### Les chiffres que vous devriez vous rappeler

- Début à froid modal: 2 à 4 secondes (avec des captures instantanées GPU).
- Baséten démarrage à froid par défaut: 5 à 10 secondes; sous-seconde avec préchauffage.
- Début à froid de 70B: 3 à 8 minutes.
- Retour de mode: 2 fois plus rapide.
- Chargement en niveaux sans serveurLLM: réduction de la latence de 10 à 200 fois (numéros de papier).

```figure
cold-start-pipeline
```

## Utilisez-le

`code/main.py`Les données relatives aux coûts de la piscine chaude et au taux de demande de compensation au-dessus duquel la piscine chaude se paie par elle-même.

## La faire partir

Cette leçon produit `outputs/skill-cold-start-planner.md`- étant donné la SLA, la taille du modèle et la forme du trafic, choisir les mesures d'atténuation à mettre en place.

## Exercices

1. On court .`code/main.py`- Calculer le taux de demande de compensation au-dessus duquel une copie chaude est moins chère que le paiement de la taxe de démarrage à froid par des baisses supplémentaires de demande à SLO.
2. Vous déployez un modèle 13B avec P99 TTFT SLA de 3s. Choisissez la pile d'atténuation minimale (moins de couches) qui le réalise.
3. La pré-semission de la bouteille élimine la traction de l'image mais les poids sont toujours chargés de l'imprimé à la HBM.
4. Votre fournisseur sans serveur offre des instantanés GPU (Modal) et votre équipe refuse parce que "les instantanés fuissent des PII".
5. Conceptez une politique de pool chaud à niveaux: combien de réplices chaudes pour les utilisateurs payants, les utilisateurs expérimentaux et les charges de travail de lot?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Cold start | "the big pause" | Time from request to first token on a fresh replica |
| Warm pool | "always-on minimum" | `min_workers >= 1` to keep at least one replica ready |
| Pre-seeded image | "baked AMI" | Node image with container weights pre-resident |
| Bottlerocket | "AWS node OS" | AWS container-optimized OS with dual-volume snapshot support |
| Model streamer | "streaming load" | Overlap weights I/O with compute setup |
| GPU snapshot | "checkpoint to HBM" | Serialize post-load GPU state; deserialize on restart |
| Tiered loading | "NVMe + DRAM + HBM" | Hierarchy of storage tiers; load on demand |
| Live migration | "move tokens" | Transfer input (KB), recompute KV on destination |
| `min_workers` | "warm replicas" | Serverless minimum keep-alive count |
| Scale-to-zero | "full serverless" | No cost when idle; accept full cold-start tax |

## Pour en savoir plus

- [Modal — Cold start performance](https://modal.com/docs/guide/cold-start) Les critères de référence et l'architecture des points de contrôle publiés par Modal.
- [AWS Bottlerocket](https://github.com/bottlerocket-os/bottlerocket) modèle d'imagerie du volume de données pré-sémenté.
- [NVIDIA Run:ai Model Streamer](https://github.com/run-ai/runai-model-streamer) charge de poids de chevauchement avec configuration de calcul.
- [Baseten — Cold starts](https://docs.baseten.co/deployment/autoscaling/cold-starts) Le manuel de préchauffement.
- [ServerlessLLM paper (USENIX OSDI'24)](https://www.usenix.org/conference/osdi24/presentation/fu) conception de chargement à plusieurs niveaux.
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) migration en direct pour les déploiements décomposés.
