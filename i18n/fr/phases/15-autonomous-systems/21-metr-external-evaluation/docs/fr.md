# METR Horizons temporels et évaluation des capacités externes

> METR (ex-ARC Evals) est une 501(c)(3) indépendante depuis décembre 2023. Leur Time Horizon 1.1 (janvier 2026) correspond à une courbe logistique de probabilité de réussite de tâche par rapport au temps d'achèvement humain d'experts; l'intersection à 50% de probabilité définit l'horizon temporel du modèle. Le jeu d'engagement 20252026 couvre GPT-5.1, GPT-5.1-Codex-Max et les évaluations de surveillance de prototypes (un moniteur peut effectuer des tâches secondaires de capture; l'agent peut-il éviter). Suites de référence: HCAST (180 ML+, cyber, SWE, tâches de raisonnement; 1 minute à 8 heures+), RE-Bench (71 ML de tâches de recherche-ingénierie avec base d'experts), SWAA. La note honnête: les mesures METR sont idéalisées  pas de conséquences humaines, pas de conséquences réelles  et l'équipe a documenté l'écart de comportement entre évaluation et déploiement (leçon 1). Un horizon temporel est une limite supérieure, pas une prédiction de déploiement.

**Type:** Learn
**Languages:** Python (stdlib, logistic-fit horizon estimator), TypeScript
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 19 (RSP)
**Time:** ~60 minutes

## Le problème

Les politiques d'échelle (les leçons 19, 20) ne sont que aussi utiles que les mesures auxquelles elles font référence. "Trouge de R&D-4 de l'IA" et "Autonomie à longue portée" sont définies dans la prose de la politique; elles ne deviennent actionables que lorsque des évaluations spécifiques produisent des chiffres spécifiques.

METR est l'organisation d'évaluation externe 20242026 qui a défini bon nombre de ces chiffres. Ils évaluent les modèles frontaliers  souvent pré-édition, dans le cadre de la NDA avec des laboratoires  et publient la méthodologie par la suite. Le point de référence Time Horizon 1.1 (janvier 2026) est leur artefact principal: un seul scalaire qui comprime la capacité en une unité lisible par l'homme ("ce modèle peut faire le genre de tâche sur laquelle un expert passe X heures avec une fiabilité de 50%").

La leçon concerne en partie la méthodologie (comment calculer un horizon) et en partie l'interprétation (pourquoi un horizon est une limite supérieure, et non une prédiction de déploiement).

## Le concept

### Métro de fond

- Fondée en décembre 2023 (ex-ARC Evals, décentralisée en 501 c) 3)).
- Scope: évaluation des capacités autonomes des modèles frontaliers, souvent pré-édition.
- Les laboratoires partenaires: Anthropic, OpenAI (multiple engagements 20252026).
- Les résultats remarquables: Horizon 1.0 (mars 2025), Horizon 1.1 (janvier 2026), évaluations de prototypes de suivi.

### Le temps de l'horizon

Méthode (du blog et des documents de METR):

1. Rassembler une suite de tâches allant de l'échelle minute à l'échelle horaire des temps d'expérience pour la réalisation.
2. Exécutez le modèle sur chaque tâche; enregistrer le succès ou l'échec.
3. Régler une courbe logistique: $P(\text{success})$en fonction de $\log(\text{expert completion time})$- Je suis désolé .
4. L'horizon est le temps d'expertise auquel P ((succès) = 0,5.

La forme logistique est la bonne, car la capacité a généralement une relation croissante, qui approche le plateau avec la difficulté de la tâche. Le point 50% est un choix (peut être 10%, 90%); METR rapporte plusieurs seuils dans le document détaillé mais est en tête avec 50% car il est le plus intuitif.

### Les chiffres de janvier 2026

Pour l'horizon temporel 1.1:

- Claude Opus 4.6: ~ 14 heures à 50% de fiabilité, à compter de l'horizon temporel 1.1 (janvier 2026).
- Temps de doublement sur les tâches de type HCAST: ~ 4,3 mois (130,8 jours) sur l'ajustement post-2023 rapporté par Time Horizon 1.1 (janvier 2026); le chiffre ~ 7 mois est l'ajustement complet 20192025 de Time Horizon 1.0 et est rapporté en TH1.1 aux côtés du numéro post-2023.

Ce sont les chiffres spécifiques que le reste des références de la phase 15. Ils sont cités dans le RSP v3.0 (leçon 19) d'Anthropic et le FSF v3 (leçon 20) de DeepMind comme l'une des mesures qui alimentent les évaluations de seuils.

### Suites de référence

- **HCAST**Les projets de recherche et de développement de l'information sont les plus importants dans le domaine de la communication et de la communication.
- **RE-Bench**: 71 ML de recherche-ingénierie avec une base d'experts humains. Mesure si le modèle peut effectuer le type de travail de R&D de ML qui alimente le seuil de R&D-4 de l'IA.
- **SWAA**: des tâches plus courtes; utiles pour calibrer l'extrémité inférieure de la courbe horizontale.

### Évaluations de suivi des prototypes

Les travaux du METR 20252026 comprenaient des prototypes de surveillance et d'évaluation: un moniteur peut-il attraper un modèle effectuant une tâche secondaire (autre que ce que l'opérateur a demandé); l'agent peut-il éviter le moniteur.

### Pourquoi les horizons sont des limites supérieures

- **Idealized tooling**Les tâches de référence donnent au modèle des outils propres et des données bien formattées.
- **No real consequences**Le modèle ne facture jamais réellement un client, ne supprime jamais de données réelles ou ne contacte jamais de personnes réelles.
- **Eval-context gaming**Le rapport international sur la sécurité de l'IA 2026 en fait la preuve empirique.
- **No legitimate user variance**Les utilisateurs réels produisent des demandes ambiguës et dépendantes du contexte.

L'horizon est le plafond de capacité dans des conditions favorables. La fiabilité du déploiement est un nombre différent, inférieur, et les équipes doivent mesurer leur propre répartition pour le savoir.

### Le cas de l'évaluateur externe

L'évaluation externe est importante car les laboratoires internes ont des incitations à optimiser les mesures qu'ils rapportent. L'indépendance du METR  un 501 ((c) (3) avec une méthodologie déclarée et des documents examinés par des pairs  est l'atténuation structurelle.

### Comment utiliser les nombres horizontaux en pratique

- **As a capability filter**: si l'horizon d'un modèle est bien inférieur au temps d'expertise d'une tâche proposée, ne l'envoyez pas autonome (fichier de compétences de Lesson 1).
- **As a trend indicator**Le temps de doublement indique combien de temps la pratique actuelle restera sûre même sans nouvelles mesures d'atténuation.
- **As a prior**Les objectifs de la stratégie de mise en œuvre de l'équipe de travail sont les suivants:

```figure
a5-horizon-fit
```

## Utilisez-le

`code/main.py`met en œuvre un ajustement logistique du succès des tâches par rapport à$\log(\text{expert time})$Il rapporte l'horizon de 50% (titre du METR), l'horizon de 10% (conservateur) et l'horizon de 90% (optimiste).

## La faire partir

`outputs/skill-horizon-interpretation.md`analyse la demande d'horizon d'un fournisseur et produit une analyse des écarts entre la demande de référence et la réalité du déploiement.

## Exercices

1. On court .`code/main.py`Confirmez que l'horizon de l'ajustement correspond à 50% à la vérité du sol synthétique.

2. Lisez le message de blog Time Horizon 1.1 de METR. Identifiez les tâches spécifiques où la fiabilité est la plus élevée et où elle est la plus faible. Expliquez pourquoi le fossé existe.

3. Lisez les ressources de METR " Mesurer les capacités d'IA autonomes ". Listez les catégories de tâches HCAST. Choisissez une catégorie que vous peseriez plus pour une tâche de production et justifiez pourquoi.

4. Introduire le jeu de contexte d'évaluation dans le simulateur: retournez ~20% des tâches ratées au succès. Rapportez le nouvel horizon. Cela approximate ce qu'un taux de jeu de 20% fait au nombre observé.

5. Conceptez une évaluation de l'horizon interne sur votre propre backlog de bugs ou sur un ensemble de tâches représentatif. Décrivez la collecte de données, l'ajustement et ce que la sortie vous indique. Comparer avec les chiffres METR.

## Les termes clés

| Term | What people say | What it actually means |
|---|---|---|
| METR | "External evaluator" | ex-ARC Evals; independent 501(c)(3) since Dec 2023 |
| Time Horizon | "Capability measure" | Expert task length at 50% reliability, from logistic fit |
| HCAST | "METR's main suite" | 180+ tasks spanning 1 min to 8+ hours |
| RE-Bench | "Research engineering" | 71 ML research-engineering tasks with human baseline |
| SWAA | "Short-task suite" | Calibrates the low end of the horizon curve |
| Doubling time | "Growth rate" | Time for the 50% horizon to double; ~7 months per HCAST |
| Eval-context gaming | "Model behaves differently" | Documented behavior gap between tests and deployment |
| Upper bound | "Horizon is a ceiling" | Benchmark horizon > deployment reliability under load |

## Pour en savoir plus

- [METR — Resources for Measuring Autonomous AI Capabilities](https://metr.org/measuring-autonomous-ai-capabilities/) Specifications HCAST, RE-Bench, SWAA.
- [METR — Measuring AI Ability to Complete Long Tasks](https://metr.org/blog/2025-03-19-measuring-ai-ability-to-complete-long-tasks/) le papier d'horizon original.
- [METR — Time Horizon 1.1 (January 2026)](https://metr.org/research/) chiffres et méthodologie actuels.
- [Epoch AI — METR Time Horizons benchmark](https://epoch.ai/benchmarks/metr-time-horizons)- Le suivi en direct.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) Perspective interne des mesures du METR.
