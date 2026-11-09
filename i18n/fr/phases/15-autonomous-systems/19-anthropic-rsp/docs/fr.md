# Politique d'échelle responsable anthropic v3.0

> RSP v3.0 est entré en vigueur le 24 février 2026, remplaçant la politique de 2023. L'atténuation à deux niveaux: ce que fera unilatéralement Anthropic par rapport à ce qui est formulé comme une recommandation à l'échelle de l'industrie (y compris les normes de sécurité RAND SL-4). Ajout de feuilles de route de sécurité frontalière et de rapports de risque en tant que documents permanents plutôt que de livrables ponctuels. Il abandonne l'engagement de la pause de 2023. Introduit le seuil de R&D-4 de l'IA: une fois franchi, Anthropic doit publier un cas affirmatif identifiant les risques et les atténuations de désalignement. Claude Opus 4.6 ne le traverse pas. Anthropic déclare dans l'annonce de la version 3.0 que " exclure avec confiance cela devient difficile. " SaferAI a classé le RSP 2023 à 2,2; ils ont rebaptisé la version 3.0 à 1,9, plaçant Anthropic dans la catégorie RSP " faible " aux côtés d'OpenAI et DeepMind. Les seuils qualitatifs ont remplacé les engagements quantitatifs de 2023; la suppression de la clause de pause est la régression la plus marquée.

**Type:** Learn
**Languages:** Python (stdlib, RSP threshold decision engine), TypeScript
**Prerequisites:** Phase 15 · 06 (AAR), Phase 15 · 07 (RSI)
**Time:** ~45 minutes

## Le problème

Les laboratoires frontaliers publient des politiques d'échelle qui sont en partie des documents techniques, en partie des documents de gouvernance et en partie des signaux aux régulateurs. RSP v3.0 est le document Anthropic actuel.

La différence v3.0 vs v2.0 est l'unité utile. Ce qui a été ajouté: feuilles de route de sécurité frontalière, rapports de risques, seuil de R&D-4 sur l'IA. Ce qui a été supprimé: l'engagement de la pause de 2023. Ce qui a été refait: un calendrier d'atténuation à deux niveaux divisé entre l'anthropie unilatérale et la recommandation de l'industrie. Révision externe  SaferAI  a abaissé le score de 2.2 (v2) à 1.9 (v3.0). C'est ainsi qu'une politique d'échelle peut devenir moins rigoureuse tout en ayant un aspect plus poli.

## Le concept

### Le calendrier d'atténuation à deux niveaux

- **Anthropic unilateral actions**Les programmes de formation sont basés sur des objectifs spécifiques, des mesures de sécurité spécifiques, des portes de déploiement spécifiques.
- **Industry-wide recommendations**Les normes de sécurité RAND SL-4 sont incluses. Ce ne sont pas des engagements de la part d'Anthropic; ce sont des politiques de défense.

La structure à deux niveaux n'était pas dans v2. Cela signifie qu'un lecteur doit regarder dans quelle colonne chaque engagement vit. Une mesure de sécurité dans la colonne "récommandation à l'échelle de l'industrie" n'est pas la promesse d'Anthropic; c'est l'espoir d'Anthropic.

### Le seuil de R&D-4 en IA

C'est le niveau de capacité que RSP v3.0 nomme comme le prochain seuil important. Plus précisément: un modèle qui pourrait automatiser une fraction substantielle de la recherche sur l'IA à un coût compétitif. Une fois qu'Anthropic croit qu'un modèle le franchit, il doit publier un cas affirmatif identifiant les risques de désalignement et les atténuations avant de continuer à l'échelle.

Claude Opus 4.6 ne le franchit pas selon l'annonce de la version 3.0. " Il devient difficile de ne pas en parler avec certitude. " Cette phrase est importante; elle admet que le seuil est assez proche pour être une préoccupation vivante, pas une limite spéculative.

Les études de l'alignement automatisé (Automated Alignment Research) et de l'auto-amélioration récursive (Lecture 7) sont directement liées à ce seuil.

### Carte routière de la sécurité aux frontières et rapports sur les risques

V3.0 élève deux types d'artefacts à des documents permanents:

- **Frontier Safety Roadmap**: document prospectif décrivant les travaux de sécurité planifiés, les attentes de capacité et la recherche sur l'atténuation.
- **Risk Report**: document rétrospectif sur des modèles spécifiques après la mise en vente, décrivant la capacité observée et le risque résiduel.

Les deux sont publiques. Les deux sont mises à jour à une cadence déclarée. L'utilité est que le lecteur peut suivre comment ce qu'Anthropic a dit qu'ils feraient dans une feuille de route se compare à ce qu'ils rapportent dans un rapport de risque.

### Suppression de la clause de pause

Le RSP 2023 comprenait un engagement explicite de pause: si un modèle franchissait les seuils de capacité spécifiques, la formation se serait arrêtée jusqu'à ce que les atténuations soient en place. V3.0 remplace la pause explicite par une formulation plus douce (publier un cas affirmatif, procéder si les atténuations sont adéquates). SaferAI et d'autres analystes ont qualifié cela directement de la régression la plus forte du nouveau document.

L'argument politique pour le changement: les seuils quantitatifs en 2023 se sont avérés inaccessibles par les critères de référence de capacité de l'ère 2026 parce que les critères de référence eux-mêmes ont été rééchelonnés.

### Réduction de la note de sécurité

SaferAI est une organisation indépendante qui classe les documents de style RSP. Leur classement public: 2023 Anthropic RSP a obtenu 2.2 (d'une échelle où 4.0 est le meilleur RSP actuel et 1.0 est nominal).

Les facteurs de dégradation par SAFERAI:
- Les seuils qualitatifs ont remplacé ceux quantitatifs.
- L'engagement de pause a été retiré.
- Les atténuations du seuil de R&D-4 de l'IA sont décrites comme "cas affirmatif" plutôt que comme des mesures spécifiques.
- Les mécanismes d'examen dépendent du groupe consultatif de sécurité d'Anthropic, avec une surveillance indépendante limitée.

### Ce que cette leçon ne signifie pas

La leçon est de lire le document avec la spécificité et le scepticisme qu'il mérite. Les politiques d'échelle sont les principaux laboratoires de signal frontaliers publics émettent sur la posture de risque catastrophique.

```figure
a5-rsp-ladder
```

## Utilisez-le

`code/main.py`Il implique un petit moteur de décision qui reflète la forme de l'évaluation du seuil de RSP: étant donné un modèle candidat et un ensemble de mesures de capacité, retourner si le seuil de R&D-4 de l'IA est franchi, les sections requises de cas affirmatifs, et si le déploiement peut se poursuivre. C'est intentionnellement simple; l'objectif est de rendre la logique du document explicite.

## La faire partir

`outputs/skill-scaling-policy-review.md`révise une politique d'échelle (Anthropic, OpenAI, DeepMind ou interne) par rapport à la référence v3.0: structure à deux niveaux, seuils, engagements de pause, révision indépendante.

## Exercices

1. On court .`code/main.py`- fournir trois modèles synthétiques à différents niveaux de capacité. Confirmer que l'évaluateur des seuils se comporte comme prévu et produit le bon modèle de cas affirmatif.

2. Lisez RSP v3.0 en entier (32 pages). Identifiez chaque engagement qui se situe dans le niveau de "récommandation à l'échelle de l'industrie".

3. Lisez la méthodologie de notation RSP de SaferAI. Reproduisez leur score de 1.9 pour la version 3.0 en appliquant leur rubrique au document.

4. L'engagement de pause pour 2023 a été supprimé. Proposer un engagement de remplacement qui préserve la crédibilité de la politique tout en reconnaissant le problème de rééchelle des benchmarks de 2026.

5. Comparez RSP v3.0 à OpenAI Preparedness Framework v2 (leçon 20). Choisissez un domaine où v3.0 est plus fort. Choisissez un domaine où le Framework de préparation est plus fort.

## Les termes clés

| Term | What people say | What it actually means |
|---|---|---|
| RSP | "Anthropic's scaling policy" | Responsible Scaling Policy; v3.0 effective Feb 24, 2026 |
| AI R&D-4 | "Research-automation threshold" | Capability to automate substantial AI research at competitive cost |
| Affirmative case | "Safety justification" | Published argument that risks are identified and mitigations adequate |
| Frontier Safety Roadmap | "Forward plan" | Standing document on planned safety work and expected capabilities |
| Risk Report | "Retrospective on a model" | Standing document on observed capability and residual risk after release |
| Two-tier mitigation | "Unilateral vs industry" | Anthropic commitments vs industry recommendations, separated |
| Pause commitment | "2023 clause" | Explicit promise to pause training; removed in v3.0 |
| SaferAI rating | "Independent RSP grade" | Third-party rubric; v3.0 scored 1.9 (v2 was 2.2) |

## Pour en savoir plus

- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) la politique complète de 32 pages.
- [Anthropic — RSP v3.0 announcement](https://www.anthropic.com/news/responsible-scaling-policy-v3) résumé des modifications de v2.
- [Anthropic — Frontier Safety Roadmap](https://www.anthropic.com/responsible-scaling-policy/roadmap) document permanent lié à partir de RSP v3.0.
- [Anthropic — Risk Report: February 2026](https://www.anthropic.com/feb-2026-risk-report) rétrospective sur Claude Opus 4.6, le modèle frontalier à sa publication.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) connecte l'IA R&D-4 à l'autonomie mesurée.
