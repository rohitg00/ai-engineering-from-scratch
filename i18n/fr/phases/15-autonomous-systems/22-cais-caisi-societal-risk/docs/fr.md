# Les risques de CAIS, CAISI et de risque à l'échelle sociale

> Le Centre de sécurité de l'IA (CAIS, San Francisco, fondé en 2022 par Hendrycks et Zhang) publie le cadre à quatre risques  utilisation malveillante, courses d'IA, risques organisationnels, IA malhonnêtes  et la déclaration de mai 2023 sur le risque d'extinction signée par des centaines de professeurs et de dirigeants d'entreprises. 2026: tableau de bord de l'IA pour l'évaluation des modèles frontaliers, Index du travail à distance (avec l'IA à l'échelle), document de stratégie de super-intelligence, newsletter de l'IA Frontiers. Une entité distincte: NIST Center for AI Standards and Innovation (CAISI)  Accords volontaires face au gouvernement américain et évaluations non classées de capacité axées sur les risques liés aux cyber-armes, à la bio et aux armes chimiques. Le CAIS définit le risque organisationnel comme l'un des quatre risques de haut niveau: la culture de la sécurité, les audits rigoureux, les défenses à plusieurs couches et la sécurité de l'information sont fondamentaux, mais sont systématiquement échangés contre la vitesse de déploiement. Le projet de loi de la Californie SB-53, si signé, serait le premier règlement américain sur les risques catastrophiques au niveau de l'État.

**Type:** Learn
**Languages:** Python (stdlib, four-risk inventory and mitigation matcher), TypeScript
**Prerequisites:** Phase 15 · 19 (RSP), Phase 15 · 20 (PF + FSF)
**Time:** ~45 minutes

## Le problème

Les leçons 19 et 20 couvraient les politiques d'échelle interne du laboratoire. La leçon 21 couvrait l'évaluation indépendante des capacités. Cette leçon couvrait la troisième perspective: la société civile et les organisations gouvernementales qui façonnent la discussion publique et la base réglementaire pour le risque catastrophique d'IA.

Deux entités distinctes sont importantes. CAIS est un organisme de recherche à but non lucratif qui publie des cadres pour penser au risque de l'IA et coordonne les déclarations publiques. CAISI est un centre gouvernemental américain au sein du NIST qui gère des accords volontaires avec des laboratoires et des évaluations de capacités non classées. Les noms riment; les missions ne se chevauchent pas. Un praticien devrait connaître les deux.

Le contenu pratique: le cadre des quatre risques du CAIS est la taxonomie des risques à l'échelle sociale la plus citée dans la littérature. La culture de la sécurité et le risque organisationnel sont l'un de ces quatre, et celui-ci est le plus directement sous le contrôle d'un praticien. SB-53 (Californie) serait le premier règlement de risque catastrophique au niveau des États-Unis si signé; le cadre du projet de loi est important parce que la réglementation au niveau des États a historiquement conduit à l'action fédérale dans la politique technologique américaine.

## Le concept

### CAIS  Centre de sécurité de l'IA

- Fondée en 2022 à San Francisco par Dan Hendrycks et Oliver Zhang. Hendrycks est directeur exécutif et de recherche; Zhang est directeur général.
- Statut: 501 ((c) ((3) à but non lucratif.
- Résultats remarquables de 2023: déclaration sur le risque d'extinction, co-signée par des centaines de chercheurs et de PDG. Elle déclare: "Médier le risque d'extinction de l'IA devrait être une priorité mondiale aux côtés d'autres risques à l'échelle sociale tels que les pandémies et la guerre nucléaire".
- Les résultats de 2026: tableau de bord de l'IA pour l'évaluation des modèles frontaliers, Index du travail à distance (jointement avec l'IA à l'échelle), document de stratégie de super-intelligence, newsletter de l'IA Frontiers.

### Le cadre des quatre risques

Les cadres du CAIS regroupent les risques catastrophiques liés à l'IA en quatre catégories de haut niveau:

1. **Malicious use**: un mauvais acteur utilise l'IA pour causer des dommages (synthèse d'armes biologiques, désinformation, cyberattaques).
2. **AI races**: la pression concurrentielle entre laboratoires, entreprises ou nations pousse le déploiement au-delà du point où il est sûr.
3. **Organizational risks**: les dynamiques internes du laboratoire (failles de la culture de sécurité, audit insuffisant, sécurité sous-ressources) produisent un mauvais déploiement.
4. **Rogue AIs**: une IA suffisamment capable pour poursuivre des objectifs qui sont en conflit avec le bien-être humain.

Ce n'est pas la seule taxonomie, c'est la plus citée. Les catégories ne sont pas mutuellement exclusives  une IA malhonnête produite par une organisation qui négocie l'audit de vitesse dans une course est les quatre.

### Où le risque organisationnel vit

Parmi les quatre catégories, le risque organisationnel est le plus actionable pour les praticiens. La culture de sécurité d'un laboratoire, la rigueur de l'audit, la couche de défense et la sécurité de l'information décident si leurs modèles de navires avec les contrôles des leçons 1018 sont réellement en place, ou si ces contrôles sont des éléments de liste de contrôle que personne n'a vérifié.

Les leviers concrets de risque organisationnel:

- **Safety culture**Les enquêtes de CAIS montrent que c'est un indicateur fort des autres leviers.
- **Rigorous audits**Les audits internes produisent des rapports optimistes.
- **Multi-layered defenses**: aucune couche unique ne suffit (thème de la phase 15).
- **Information security**Leur méthode de détection est la méthode de détection des données de l'analyse de données de l'analyse de données de l'analyse de données de l'analyse de données de l'analyse de données de l'analyse de données de l'analyse de données de l'analyse de données de l'analyse de données de l'analyse de données de l'analyse de données de l'analyse de données de l'analyse de données de données de l'analyse de données de l'analyse de données de l'analyse de données de données de l'analyse de données de l'analyse de données de données de l'analyse de données de l'analyse de données de données de l'analyse de données de données de l'analyse de données de données de l'analyse de données de données de l'analyse de données de données de l'analyse de données de données de l'analyse de données de données de l'analyse de données de données de données de l'analyse de données de données de données de l'analyse de données de données de données de données de données de l'analyse de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données de données

### CAISI  Centre de Normes et d'innovation en matière d'IA

- Il travaille au sein du NIST.
- Il a des accords volontaires avec des laboratoires frontaliers.
- Publie des évaluations non classifiées de la capacité axées sur les risques liés aux cyber-armes, aux armes biologiques et chimiques.
- Différent du CAIS; les acronymes se heurtent; vérifiez l'URL (nist.gov) pour confirmer lequel vous lisez.

Le rôle de CAISI est le public, contrepartie gouvernementale des activités de laboratoire privés du METR (leçon 21).

### Californie SB-53

Le projet de loi du Sénat de Californie (2025-2026 session) aborde les risques catastrophiques liés aux modèles frontaliers.

- Des seuils de capacité spécifiques qui déclenchent des obligations au niveau de l'État.
- Protection des dénonciateurs pour les employés du laboratoire d'IA.
- Les exigences relatives aux signalements d'incidents pour les défaillances catastrophiques.

Si elle est signée, elle serait la première réglementation de risque catastrophique au niveau des États-Unis. Indépendamment du statut de signature, le cadre du projet de loi façonne la façon dont les autres législateurs des États abordent le problème. Les praticiens en Californie devraient suivre le statut du projet de loi; les praticiens ailleurs devraient le lire pour comprendre à quoi ressemblera probablement la réglementation au niveau des États-Unis.

### Le risque à l'échelle sociale n'est pas un problème à couche unique

Le thème de la phase 15  défense en profondeur  s'applique également à la couche sociale. Aucune organisation, réglementation ou cadre unique ne ferme le risque catastrophique. L'écosystème ne fonctionne que lorsque:

- Les politiques de mise à l'échelle des laboratoires (leçons 19, 20).
- Les évaluateurs externes effectuent des mesures (leçon 21).
- La société civile suit et publie (CAIS).
- Le gouvernement dispose de programmes volontaires et de réglementations de base (CAISI, SB-53).
- Les praticiens construisent des contrôles à plusieurs couches (leçons 1018).

C'est la synthèse finale de la phase: chaque leçon précédente est une couche dans une pile dont la plénitude compte plus que la force de toute couche.

```figure
a5-four-risks
```

## Utilisez-le

`code/main.py`Il met en œuvre un petit outil d'inventaire des risques. En raison d'un déploiement proposé, il marque le déploiement contre les quatre catégories de risque et renvoie une liste de contrôle d'atténuation. C'est un outil de lecture pour le cadre, pas un substitut pour le jugement humain.

## La faire partir

`outputs/skill-societal-risk-review.md`Il examine un déploiement pour la position de risque à l'échelle de la société: quelle des quatre catégories est concernée, quelles mesures d'atténuation sont en place, quelle est l'exposition au risque organisationnel.

## Exercices

1. On court .`code/main.py`- fournissez trois déploiements synthétiques à différentes échelles.

2. Lisez le document complet sur les quatre risques du CAIS. Choisissez une catégorie de risque et écrivez deux paragraphes sur ce que vous croyez être le développement le plus important de cette catégorie en 2026.

3. Lisez le projet actuel de la loi de Californie, identifiez une disposition qui, selon vous, renforce la position de risque catastrophique et une autre qui, selon vous, la affaiblit.

4. Choisissez un déploiement d'IA de production que vous connaissez (le vôtre ou un publié). Réservez-le par rapport aux sous-livers de risque organisationnel: culture de sécurité, rigueur d'audit, défense multi-couches, sécurité de l'information.

5. Décrire une version 2028 du cadre à quatre risques qui reflète une année de capacité supplémentaire et une année d'expérience supplémentaire de déploiement.

## Les termes clés

| Term | What people say | What it actually means |
|---|---|---|
| CAIS | "Center for AI Safety" | Non-profit; four-risk framework; 2023 extinction statement |
| CAISI | "US government AI safety" | NIST Center; voluntary agreements; unclassified evals |
| Four-risk framework | "CAIS's taxonomy" | malicious use, AI races, organizational risks, rogue AIs |
| Malicious use | "Bad actor uses AI" | Bioweapons, disinformation, cyberattacks |
| AI races | "Competitive pressure" | Labs/companies/nations push deployment past safety |
| Organizational risk | "Lab internal failure" | Safety culture, audit, defenses, infosec |
| Rogue AI | "Misaligned agent" | Capable AI pursuing goals conflicting with human welfare |
| California SB-53 | "State-level regulation" | 2025–2026 bill; first US state catastrophic-risk regulation if signed |

## Pour en savoir plus

- [Center for AI Safety](https://safe.ai/) institutionnel de l'établissement de quatre risques.
- [CAIS — AI Risks that Could Lead to Catastrophe](https://safe.ai/ai-risk) le papier à quatre risques.
- [CAIS — May 2023 statement on extinction risk](https://safe.ai/statement-on-ai-risk) courte déclaration commune.
- [NIST CAISI](https://www.nist.gov/caisi) centre d'innovation et de normes d'IA au service du gouvernement.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) connecte les engagements au niveau du laboratoire à l'établissement d'un cadre à l'échelle de la société.
