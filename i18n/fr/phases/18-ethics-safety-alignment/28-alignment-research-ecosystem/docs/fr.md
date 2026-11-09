# Écosystème de recherche d'alignement  MATS, Redwood, Apollo, METR

> Cinq organisations définissent la couche de recherche non-laboratoire d'alignement de 2026. MATS (ML Alignment & Theory Scholars): 527 chercheurs depuis fin 2021, 180+ articles, 10K+ citations, h-index 47; cohort été 2024 incorporé comme 501 ((c) ((3) avec ~90 chercheurs et 40 mentors; 80% des anciens étudiants d'avant 2025 travaillent sur la sécurité / sécurité avec 200+ à Anthropic, DeepMind, OpenAI, UK AISI, RAND, Redwood, METR, Apollo. Redwood Research: laboratoire d'alignement appliqué fondé par Buck Shlegeris; introduit le contrôle de l'IA (leçon 10); collabore avec l'AISI britannique sur les cas de sécurité de contrôle. Apollo Research: évaluations préalables au déploiement de plans pour les laboratoires frontaliers; auteur de Planification dans le contexte (leçon 8) et vers les cas de sécurité pour l'IA. METR (Model Evaluation and Threat Research): évaluations de la capacité basées sur les tâches, études autonomes sur l'horizon temporel des tâches; "Éléments communs des politiques de sécurité de l'IA frontalière" compare les cadres de laboratoire. Eleos AI Research: évaluations préalables au déploiement des modèles de bien-être (leçon 19); évaluation du bien-être réalisée par Claude Opus 4.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 18 · 01-27 (prior Phase 18 lessons)
**Time:** ~45 minutes

## Objectifs d'apprentissage

- Identifier les cinq organisations du système de recherche non-laboratoire et leur production principale.
- Décrivez l'échelle du MATS (étudiants, documents, h-index) et son rôle de pipeline de talents.
- Décrivez l'agenda de Redwood sur le contrôle de l'IA et son partenariat avec l'AISI britannique.
- Décrire la méthodologie d'évaluation basée sur les tâches du METR.

## Le problème

Les laboratoires frontaliers (leçon 18) produisent des évaluations de sécurité en interne et publient des résultats sélectionnés. L'écosystème extérieur des laboratoires est celui où les évaluations sont validées, où de nouveaux modes d'échec sont découverts pour la première fois et où les talents sont formés.

## Le concept

### MATS (étudiants de l'alignement et de la théorie du ML)

Le programme de mentorat de recherche a débuté fin 2021. Les chercheurs passent 10-12 semaines avec un chercheur principal sur un problème d'alignement spécifique.

Équelle (2026):
- 527+ chercheurs depuis leur création.
- Plus de 180 articles publiés.
- 10 000 citations.
- l'indice h 47.
- Été 2024: 90 chercheurs + 40 mentors; constitué en tant que 501 (c) (3).

Résultats de carrière: ~ 80% des anciens élèves d'avant 2025 travaillent sur la sécurité. 200+ chez Anthropic, DeepMind, OpenAI, UK AISI, RAND, Redwood, METR, Apollo.

### La recherche sur le bois rouge

Laboratoire d'alignement appliqué. Fondé par Buck Shlegeris. Il a présenté l'agenda de contrôle de l'IA (leçon 10). Collabore avec l'AISI britannique sur les cas de sécurité de contrôle. Il conseille DeepMind et Anthropic sur la conception d'évaluation.

Des documents canoniques: Greenblatt, Shlegeris et al., "AI Control" (arXiv:2312.06942, ICML 2024); Faction d'alignement (Greenblatt, Denison, Wright et al., arXiv:2412.14093, conjointement avec Anthropic).

Style: modèles de menaces spécifiques, adversaires au pire, protocoles concrets qui peuvent être testés par stress.

### La recherche sur l'Apollo

Évaluations préalables au déploiement de schematismes pour les laboratoires frontaliers. Auteur de Schematismes en contexte (leçon 8, arXiv:2412.04984). Partenaire de la collaboration de formation anti-schematisme OpenAI en 2025. Produit vers des cas de sécurité pour la schematisation par IA (2024).

Style: évaluations agencées dans lesquelles la tromperie peut apparaître; décomposition à trois piliers (mal alignement, orientation vers l'objectif, prise de conscience de la situation).

### METR (évaluation de modèle et recherche sur les menaces)

Évaluations de capacité basées sur les tâches. Études autonomes sur l'horizon temporel de l'achèvement des tâches. "Éléments communs des politiques de sécurité de l'IA frontalière" (metr.org/common-elements, 2025) compare les cadres de laboratoire.

Co-auteur de l'esquisse de la sécurité de l'IA avec Apollo.

Style: évaluation des tâches à long horizon, mesure empirique des capacités, synthèse du cadre.

### Réflexion sur les résultats de la recherche

Les évaluations préalables au déploiement du modèle de bien-être. a réalisé l'évaluation du bien-être Claude Opus 4 documentée à la section 5.3 de la carte du système. fournit la vérification de la méthodologie externe des revendications relatives au bien-être de la leçon 19.

### Le flux

Les diplômés vont à Anthropic, DeepMind, OpenAI (équipes de sécurité de laboratoire) ou à Redwood, Apollo, METR, Eleos (évaluation externe).

### Pourquoi cette couche importe

Les évaluations à source unique sont peu fiables: les laboratoires évaluant leurs propres modèles ont un conflit d'intérêts structurel. Les évaluateurs externes peuvent augmenter et valider les modes de défaillance que le laboratoire peut sous-reporter. Le papier 2024 de Sleeper Agents (leçon 7) était Anthropic + Redwood; Faisant l'alignement était Anthropic + Redwood; In-Context Scheming était Apollo; Anti-Scheming était Apollo + OpenAI. La structure multiorgane est le contrôle de la qualité.

### Là où cela s'inscrit dans la phase 18

Les leçons 7-11 font référence au travail de Redwood et d'Apollo; la leçon 18 fait référence à la comparaison du cadre du METR; la leçon 19 fait référence à Eleos. La leçon 28 est la carte organisationnelle explicite de l'écosystème sur lequel repose le reste de la phase.

```figure
sae-features
```

## Utilisez-le

Lisez les "éléments communs des politiques de sécurité de l'IA frontalière" du METR comme exemple de la façon dont la synthèse externe ajoute de la valeur au travail de la politique interne du laboratoire.

## La faire partir

Cette leçon produit `outputs/skill-ecosystem-map.md`. En raison d'une demande ou d'une évaluation d'alignement, elle identifie l'organisation, le lieu de publication et le style méthodologique, ainsi que les contrôles croisés par rapport aux organisations contreparties connues.

## Exercices

1. Choisissez un article des leçons 7-15 et identifiez les organisations impliquées.

2. Lisez les "éléments communs des politiques de sécurité de l'IA frontalière" du METR. Identifiez les trois convergences entre laboratoires qu'elles soulignent et les deux plus grandes divergences.

3. Les résultats de carrière MATS sont d'environ 80% de sécurité.

4. Redwood et Apollo font tous deux des travaux de contrôle/planification mais avec des styles différents.

5. Eleos AI est la seule organisation pure de bien-être de modèle. Concevoir une deuxième organisation hypothétique axée sur une question de bien-être adjacente différente (liberté cognitive, incarnation robotique, etc.) et articuler sa méthodologie.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| MATS | "the mentorship program" | ML Alignment & Theory Scholars; 527+ researchers since 2021 |
| Redwood Research | "the control lab" | Applied alignment; AI Control authors; UK AISI partner |
| Apollo Research | "the scheming evals" | Pre-deployment scheming evaluations for frontier labs |
| METR | "the task-horizon evals" | Task-based capability evaluations; framework synthesis |
| Eleos AI | "the welfare lab" | Model-welfare pre-deployment evaluations |
| Talent pipeline | "MATS -> labs" | MATS graduates flow to Anthropic, DM, OpenAI, Redwood, Apollo, METR |
| External evaluation | "non-lab check" | Evaluation not done by the model's producer; adds credibility |

## Pour en savoir plus

- [MATS (ML Alignment & Theory Scholars)](https://www.matsprogram.org/) le programme de mentorat
- [Redwood Research](https://www.redwoodresearch.org/) Documents de contrôle de l'IA
- [Apollo Research](https://www.apolloresearch.ai/) évaluations de projets
- [METR — Common Elements of Frontier AI Safety Policies](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) comparaison du cadre
- [Eleos AI Research](https://www.eleosai.org/research) modèle de méthodologie de bien-être
