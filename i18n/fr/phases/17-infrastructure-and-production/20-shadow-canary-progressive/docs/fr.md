# Traffic d'ombre, déploiement des Canaries et déploiement progressif des LLM

> Les déploiements de LLM combinent les parties les plus difficiles du déploiement de logiciels: aucun test unitaire, modes de défaillance diffuse, signaux retardés. La séquence est (1) mode ombre  répétition de demandes de prod à un modèle candidat, journal, comparer avec zéro impact utilisateur; détecte des problèmes de distribution évidents mais n'est pas une garantie de qualité; (2) déploiement canarien  déplacement progressif du trafic 10% → 25% → 50% → 75% → 100% avec des portes à chaque étape; suivi des percentiles de latence, coût / demande, taux d'erreur / refus, distribution de longueur de sortie, taux de retour d'utilisateur; (3) test A / B pour différentes alternatives après la stabilité confirmée. Le non-déterminisme est irréductible  jusqu'à 15% de variation de précision sur les circuits avec des entrées identiques en raison de la non-associativité du GPU FP plus la variance de la taille du lot. Le coût est variable, pas constante  un modèle de 20% peut être 3 fois plus cher par appel. La vitesse de retour est décisive: si le retour nécessite un redéploiement, vous êtes trop lent. Politique de vie dans la configuration/drapeau; modèle de vie dans le registre avec les digests collés; retour = politique de retour + seuil de retour + pin ancien modèle en quelques secondes.

**Type:** Learn
**Languages:** Python (stdlib, toy canary-progression simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 21 (A/B Testing)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Distinguer le mode ombre (comparaison à impact zéro), canarien (traffic en direct progressif) et A/B (comparaison confirmée par la stabilité).
- Enumérer cinq mesures canaries spécifiques au LLM (latérance, coût/demande, erreur/déni, distribution de la longueur de sortie, rétroaction des utilisateurs).
- Expliquez pourquoi le non-determinisme de la LLM (jusqu'à 15%) modifie ce que signifie "stable" dans un déploiement.
- Conceptez un chemin de retour qui prend des secondes (flip de politique) et non des heures (réploiement).

## Le problème

Vous expédez un nouveau modèle. Les évaluations hors ligne montrent une augmentation de 3% de précision. Vous le redistribuez dans la production. En 24 heures, le coût est en hausse de 40%, les pouces des utilisateurs sont en hausse de 8%, trois billets de clients rapportent " réponses étranges. " Vous retournez. Rédéployer prend 3 heures. Votre week-end est ruiné.

Chaque élément de cela était évitable. Le mode ombre aurait saisi le 40% de hausse des coûts avant que n'importe quel utilisateur ne le voie. Canary aurait arrêté à 10% lorsque les pouces vers le bas se déplaçaient. Le retour du drapeau politique aurait pris 30 secondes. La discipline est ce qui comble le fossé entre "les évaluations hors ligne semblent bonnes" et "les utilisateurs réels sont heureux".

## Le concept

### Mode d'ombre

Le candidat reçoit les mêmes demandes que la production; les sorties sont enregistrées, et non retournées aux utilisateurs.

- Contenu de la production (différence par rapport à la production).
- Compte des jetons (delta de coût).
- La latence.
- Le refus et l'erreur.

Les prises: augmentation des coûts, régressions de longueur, changements évidents de refus, erreurs difficiles. N'attrape pas: les utilisateurs de delta de qualité perçoivent. L'ombre est un test de fumée, pas un test de qualité.

### Déploiement des Canaries

Décalage progressif du trafic avec les portes. Progression typique: 1% → 10% → 25% → 50% → 75% → 100%.

1. **Latency percentiles** P50, P95, P99. violation: le canary a un P99 > 1,5 fois le niveau de référence.
2. **Cost per request** mixte $. Violation: > 20% au-dessus de la ligne de départ.
3. **Error / refusal rate**5xx plus des refus explicites.
4. **Output length distribution** moyenne + P99. Violation: déplacement de distribution.
5. **User-feedback rate**- Les dépôts de billets.

### Le non-déterminisme est la nouvelle variance

Les entrées identiques produisent des sorties non identiques.

- Non-associativité de la GPU FP (ordre de réduction du point flottant varie selon le lot).
- Variance de taille de lot (même indication dans un lot de 128 contre un lot de 16).
- Prise d'échantillons (température > 0).

Mesurée: jusqu'à 15% de variation de précision en fonction des ensembles d'évaluation identiques. "Stable" dans un déploiement signifie que les mesures sont dans la variance attendue, pas identique à la ligne de base.

### Le coût est variable

Un modèle de 20% peut être 3 fois plus cher par appel. Le coût/la demande est l'une des cinq portes.

### Le Rollback est l'arme.

- Flag de politique (système de flag de fonctionnalité): pourcentage de décalage en configuration; prend des secondes.
- Pinning du modèle (digestation du registre): le modèle en pin ne s'améliore pas automatiquement.
- Retour = renverser le drapeau + régler le digeste fixe à l'ancien.

Si votre pile doit être réaffectée, réparez-la avant de le faire.

### Les outils

**Argo Rollouts**- Je suis là .**Flagger** Contrôleurs de livraison progressifs Kubernetes. Intégrés à l'itinéraire pondéré Istio/Linkerd.

**Istio weighted routing** Partage du trafic au niveau du réseau de service.

**KServe / Seldon Core** modèle servant avec canary intégré.

**Feature flags**LaunchDarkly, Flagsmith, Désactiver.

### Cadence des métriques

Les portes canaries vérifient toutes les 5 à 15 minutes selon le volume de trafic. 1% des 1000 req/min (10 req/min pour le canary) donne 50 à 150 points de données par fenêtre de 5 à 15 minutes  suffisamment pour la latence mais bruyant pour les commentaires des utilisateurs. 10% donne ~ 10 fois plus. Les progrès doivent faire une pause suffisamment longue pour accumuler suffisamment d'échantillons à chaque étape.

### L'étape A/B est facultative

Si le nouveau modèle est nettement différent (comportement différent, courbe de coût différente, ton différent), A/B testé à 50% après le passage canary. Si c'est juste une version améliorée du même comportement, sauter à 100% lorsque canary gates passer. Amélioré signifie que l'évaluation hors ligne a montré le gain. Les portes canary ne mesurent pas la finition de tâche, donc le saut fait confiance à l'évaluation pour elle.

### Les chiffres que vous devriez vous rappeler

- Progression canarienne: 1% → 10% → 25% → 50% → 75% → 100%.
- Plafond de non-determinisme: jusqu'à 15% de variance de fonctionnement à fonctionnement sur les entrées identiques.
- Cinq indicateurs canariens: latence, coût, erreur/réjection, durée de sortie, rétroaction de l'utilisateur.
- Portée de coût: > 20% au-dessus de la ligne de référence est une violation.
- - Des secondes, pas des heures.

```figure
i4-canary-ramp
```

## Utilisez-le

`code/main.py`Simulation d'un déploiement canarien avec régressions injectables.

## La faire partir

Cette leçon produit `outputs/skill-rollout-runbook.md`. Compte tenu du modèle candidat, de la ligne de base et de la tolérance au risque, le plan de conception est shadow→canary→100%.

## Exercices

1. On court .`code/main.py`- Une régression des coûts de 25%.
2. Votre nouveau modèle a un gain de précision de 3% hors ligne mais le coût/demande est de +18%.
3. Conceptez un roulement qui prend moins de 60 secondes de bout en bout.
4. Le non-determinisme montre ±7% sur votre évaluation.
5. Le mode ombre a une hausse de 40% avant le canary.

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Shadow mode | "duplicate to new" | Zero-impact send-to-candidate for logging |
| Canary | "progressive traffic" | Gradual user-exposed rollout with gates |
| Gates | "rollout checks" | Metric thresholds that block progression |
| Non-determinism | "LLM variance" | Irreducible run-to-run differences |
| Policy flag | "flag flip rollback" | Config-level rollback, seconds not hours |
| Model pin | "registry digest" | Immutable reference to a model version |
| Argo Rollouts | "K8s progressive" | Kubernetes-native canary/rollback controller |
| KServe | "inference K8s" | Model serving with canary primitives |
| Istio weighted | "mesh split" | Service-mesh traffic splitter |

## Pour en savoir plus

- [TianPan — Releasing AI Features Without Breaking Production](https://tianpan.co/blog/2026-04-09-llm-gradual-rollout-shadow-canary-ab-testing)
- [MarkTechPost — Safely Deploying ML Models](https://www.marktechpost.com/2026/03/21/safely-deploying-ml-models-to-production-four-controlled-strategies-a-b-canary-interleaved-shadow-testing/)
- [APXML — Advanced LLM Deployment Patterns](https://apxml.com/courses/mlops-for-large-models-llmops/chapter-4-llm-deployment-serving-optimization/advanced-llm-deployment-patterns)
- [Argo Rollouts docs](https://argo-rollouts.readthedocs.io/)
- [Flagger docs](https://docs.flagger.app/)
