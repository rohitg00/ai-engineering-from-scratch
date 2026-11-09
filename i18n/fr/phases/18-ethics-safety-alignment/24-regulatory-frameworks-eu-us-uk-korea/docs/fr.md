# Cadres réglementaires  UE, États-Unis, Royaume-Uni, Corée

> Quatre régimes réglementaires primaires définissent le paysage de la gouvernance de l'IA en 2026. La loi de l'UE sur l'IA (en vigueur le 1er août 2024)  pratiques interdites et l'apprentissage de l'IA à partir du 2 février 2025; obligations relatives au GPAI à partir du 2 août 2025; pleine applicabilité et transparence de l'article 50 le 2 août 2026; GPAI hérité et systèmes à haut risque intégrés le 2 août 2027; pénalités pouvant atteindre 15 millions d'euros ou 3% du chiffre d'affaires mondial. Code de pratique du GPAI (10 juillet 2025): trois chapitres  Transparence, droit d'auteur, sécurité et sécurité  12 engagements; l'application commence en août 2026. UK AISI -> AI Security Institute (février 2025): les signaux de renommée restreignent leur portée. US AISI -> CAISI (juin 2025): Centre de normes et d'innovation en IA au sein du NIST; déménagement vers une posture pro-croissance. Loi sur le cadre coréen de l'IA (adopté en décembre 2024, en vigueur en janvier 2026): L'article 12 établit l'AISI dans le cadre du MSIT; mandat des représentants locaux pour les entreprises étrangères d'IA, l'évaluation des risques, les mesures de sécurité pour l'IA à impact élevé et générative.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 18 · 18 (frontier frameworks), Phase 18 · 27 (data governance)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Décrire les niveaux de risque de l'Acte sur l'IA de l'UE (interdits, à haut risque, à but général, à risque limité) et le calendrier août 2025 / août 2026 / août 2027.
- Décrivez les trois chapitres du code de pratique de l'APG et les fournisseurs qui sont liés par chacun.
- Décrivez les rebrands de 2025: UK AISI -> AI Security Institute; US AISI -> CAISI; ce que chaque rebranding implique sur la direction des politiques.
- Déclarer la disposition fondamentale de la Loi sur le cadre de l'IA en Corée.

## Le problème

Les cadres de laboratoire (leçon 18) sont volontaires. Les cadres réglementaires sont obligatoires. La période 2024-2026 a vu entrer en vigueur la première vague de réglementation globale de l'IA. Les déployeurs doivent mapper les contrôles techniques aux obligations réglementaires; la cartographie diffère selon la juridiction.

## Le concept

### Loi sur l'IA de l'UE

**In force 1 August 2024.**Structure de niveau de risque:

- **Prohibited practices**(article 5). Scoring social, identification biométrique à distance en temps réel en public (à l'exception des forces de l'ordre), manipulation exploitative des groupes vulnérables.
- **High-risk systems**(annexe III). Emploi, éducation, crédit, application de la loi, justice, migration. Exiger une évaluation de la conformité, une gestion des risques, une exploitation forestière et une transparence.
- **General-Purpose AI (GPAI) models**. Appliqué le 2 août 2025. Tous les fournisseurs d'IPAI sont tenus d'exercer des obligations; l'IPAI à risque systémique (> 1e25 calcul de formation FLOP) est soumis à des obligations supplémentaires.
- **Limited-risk systems**- Les obligations de transparence prévues à l'article 50 (étiquetage des contenus générés par l'IA).

L' échéance:
- 2 février 2025: pratiques interdites + littératie en IA.
- 2 août 2025: IAPP + gouvernance.
- 2 août 2026: pleine applicabilité + transparence de l'article 50 + sanctions allant jusqu'à 15 millions EUR / 3% du chiffre d'affaires mondial.
- 2 août 2027: GPAI hérité + risque élevé intégré.

La Commission a proposé d'ajuster le calendrier de risque élevé à 16 mois fin 2025.

### Code de pratique de l'APPI

Publié le 10 juillet 2025. Trois chapitres:

- **Transparency.**Tous les fournisseurs de GPAI.
- **Copyright.**Tous les fournisseurs de GPAI.
- **Safety and Security.**Les fournisseurs d'IPAI à risque systémique (estimées entre 5 et 15 entreprises).

Un groupe de travail signataire présidé par le Bureau de l'IA gère la mise en œuvre.

### Code de transparence pour l'article 50

Le premier projet 17 décembre 2025. Le deuxième projet de mars 2026. La version finale est publiée en juin 2026.

### Institut de sécurité de l'IA du Royaume-Uni (février 2025)

Renommé d'après l'Institut de sécurité de l'IA. La rebranding réduit la portée: supprime les biais algorithmiques et les cadres de libre-expression; se concentre sur la sécurité des capacités frontalières.

### États-Unis CAISI (juin 2025)

L'administration Trump transforme l'Institut de sécurité de l'IA du NIST en Centre de normes et d'innovation de l'IA. Un changement vers des " politiques d'IA pro-croissance " selon les remarques du sommet d'action de l'IA de Paris du vice-président Vance.

### Loi sur le cadre de l'IA coréenne

Il est adopté en décembre 2024. Il est adopté en janvier 2025.

L'article 12 établit un AISI au sein du ministère de la Science et des TIC (MSIT).
- Les représentants locaux des entreprises étrangères d'IA opérant en Corée.
- Évaluation des risques pour les systèmes d'IA "à fort impact".
- Mesures de sécurité pour l'IA génératrice et l'IA à fort impact.

Première juridiction asiatique avec une réglementation horizontale globale de l'IA.

### Dynamique entre juridictions

- L'UE: sanctions strictes, à risque et lourdes.
- États-Unis: favorisant l'innovation, décentralisés, les États (par exemple, la Californie AB 2013  Leçon 27) comblent les lacunes fédérales.
- Royaume-Uni: une mise à jour étroite de la sécurité, une infrastructure d'évaluation solide.
- Corée: MSIT dirigé, axé sur les fournisseurs étrangers.

Les déployants dans plusieurs juridictions doivent respecter les règles les plus strictes, qui en 2026 sont généralement les lois sur l'IA de l'UE.

### Là où cela s'inscrit dans la phase 18

La leçon 18 est la gouvernance volontaire en laboratoire; la leçon 24 est réglementaire; la leçon 25 est une classe émergente de CVE pour les systèmes d'IA; les leçons 26-27 couvrent la documentation (carte) et la gouvernance des données de formation.

```figure
an-eu-act-timeline
```

## Utilisez-le

Aucun code. Lisez les sources principales de la Loi sur l'IA de l'UE: le texte du règlement, le code de pratique du GPAI, le cadre britannique AISI Inspect.

## La faire partir

Cette leçon produit `outputs/skill-regulatory-map.md`- En raison d'une description du déploiement, il trace les juridictions applicables, les classifications de niveaux dans chacune, les obligations par juridiction et la structure des délais.

## Exercices

1. Lisez la loi de l'UE sur l'IA (règlement 2024/1689) et le code de pratique de l'IPGA (10 juillet 2025).

2. Un déploiement est effectué par une entreprise américaine, fonctionne sur l'infrastructure de l'UE et sert les utilisateurs coréens.

3. Le renom de l'Institut britannique de sécurité de l'IA réduit la portée.

4. Le cadre " pro-croissance " de CAISI est un décalage du modèle de l'institut de sécurité de l'IA 2022-2024.

5. La Loi sur le cadre de l'IA en Corée exige des représentants locaux pour les fournisseurs étrangers.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| EU AI Act | "the regulation" | Risk-tier-based horizontal AI regulation; in force Aug 2024 |
| GPAI | "general-purpose AI" | Large foundation models; systemic-risk subset has additional obligations |
| Article 50 | "transparency obligations" | AI-generated content labelling; applies Aug 2026 |
| UK AISI | "AI Security Institute" | Renamed Feb 2025; narrower frontier-security focus |
| CAISI | "US center for AI standards" | Renamed Jun 2025 from AI Safety Institute; pro-growth posture |
| Korean AI Framework Act | "MSIT horizontal regulation" | First Asian comprehensive AI law; effective Jan 2026 |
| Systemic-risk GPAI | "the 1e25 FLOP threshold" | Additional obligations tier; estimated 5-15 companies bound |

## Pour en savoir plus

- [EU AI Act text (Regulation 2024/1689)](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) le règlement et le calendrier
- [GPAI Code of Practice (10 July 2025)](https://digital-strategy.ec.europa.eu/en/library/final-version-general-purpose-ai-code-practice) Code de trois chapitres
- [UK AI Security Institute (renamed Feb 2025)](https://www.gov.uk/government/organisations/ai-security-institute) page officielle
- [CSET — South Korea AI Framework Act Analysis (2025)](https://cset.georgetown.edu/publication/south-korea-ai-law-2025/) Analyse du cadre coréen
