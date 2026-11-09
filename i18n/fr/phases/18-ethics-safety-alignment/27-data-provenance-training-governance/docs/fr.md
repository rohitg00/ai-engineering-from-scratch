# Provenance des données et formation - Gouvernance des données

> La loi de l'UE sur l'IA exige que les normes de désactivation de l'IPG soient lisibles par machine d'ici août 2025 (via l'exception de la directive TDM sur le droit d'auteur de l'UE). California AB 2013 (signé 2024)  La transparence des données générative de formation en IA exige des développeurs de publier un résumé des ensembles de données contenant 12 champs mandatés. 2025 L'alignement de l'APD sur l'intérêt légitime: le DPC irlandais (21 mai 2025) accepte la formation de META en matière de contenu public public pour adultes de l'UE/EEE avec des garanties après l'avis du DPB; la Cour régionale supérieure de Cologne (23 mai 2025) rejette l'injonction; la DPA de Hambourg réduit l'urgence; l'ICO du Royaume-Uni (23 septembre 2025) émet une réponse réglementaire positive aux garanties de formation en IA de LinkedIn (transparence, opt-out simplifié, fenêtres d'opposition étendues) et continue de surveiller  pas une autorisation formelle. L'ANPD brésilien (2 juillet 2024) a suspendu le traitement de Meta en raison de l'insuffisance de la transparence des informations; la mesure préventive a été levée le 30 août 2024 après que Meta ait présenté un plan de conformité. Problème clé d'irréversibilité: les cadres de consentement aux cookies sont conçus pour le suivi en temps réel et réversible; une fois que les données sont en poids de modèle, l'effacement chirurgical est impossible  aucun droit pratique de l'effacement GDPR pour les réseaux neuronaux formés. La fenêtre de conformité est à l'heure de la collecte. Initiative de provenance des données (dataprovenance.org, Longpre, Mahari, Lee et al., "Consent in Crisis", juillet 2024): une vérification à grande échelle montre un déclin rapide des données communes d'IA à mesure que les éditeurs ajoutent des restrictions robots.txt.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, 12-field California AB 2013 scaffolding generator)
**Prerequisites:** Phase 18 · 24 (regulatory), Phase 18 · 26 (cards)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Décrivez les 12 domaines mandatés de la CA 2013 pour la transparence des données en matière de formation en IA générative.
- Déclarer la position de l'APD en 2025 sur la formation en LLM à intérêt légitime (DPC irlandais, ICO du Royaume-Uni, Hambourg, Cologne).
- Décrivez le problème de l'irréversibilité: pourquoi le droit à l'effacement du RGPD n'a pas d'équivalent pratique pour les réseaux neuronaux formés.
- Déclarer la conclusion du "consentement en crise" de l'Initiative de prédisposition des données.

## Le problème

La gouvernance des données de formation est la priorité de chaque carte modèle (leçon 26) et de l'obligation réglementaire (leçon 24). En 2024-2025, le paysage réglementaire s'est consolidé sur trois principes: l'infrastructure de refus de consentement, la divulgation par ensemble de données et les ajustements d'intérêts légitimes pour les données disponibles au public. Les fournisseurs qui ne se conforment pas au moment de la collecte ne peuvent pas remédier à la situation en aval.

## Le concept

### Californie AB 2013

Signé 2024. La documentation doit être affichée le 1er janvier 2026 ou avant celle-ci pour les systèmes publiés le 1er janvier 2022 ou après celui-ci.
1. Sources ou propriétaires des ensembles de données.
2. Description de la façon dont les ensembles de données poursuivent l'objectif prévu du système d'IA.
3. Nombre de points de données dans les ensembles de données (variétés générales acceptables; estimations pour les ensembles de données dynamiques).
4. Description des types de points de données (types d'étiquettes pour les ensembles de données étiquetés; caractéristiques générales pour les non étiquetés).
5. Que les ensembles de données incluent des données protégées par le droit d'auteur, la marque ou le brevet, ou qu'elles soient entièrement du domaine public.
6. Si les ensembles de données ont été achetés ou autorisés.
7. Si les ensembles de données comprennent des informations personnelles (selon le code civil de la Cal. §1798.140 ((v)).
8. Si les ensembles de données comprennent des informations globales sur les consommateurs (selon le code civil de la Cal. §1798.140 ((b)).
9. Nettoyage, transformation ou autre modification par le développeur, à des fins prévues.
10. La période de collecte des données, avec avis si la collecte est en cours.
11. Date à laquelle les ensembles de données ont été utilisés pour la première fois pendant le développement.
12. Si le système utilise ou utilise continuellement la génération de données synthétiques.

L'article 12 (données synthétiques) est nouveau par rapport aux fiches de données de Gebru et coll. 2018 . L'article 7 (informations personnelles) déclenche les obligations de la loi sur les droits de la vie privée (CPRA).

### Loi sur l'IA de l'UE (leçon 24) et exclusion de la TDM

L'exception de la directive de l'UE sur le droit d'auteur pour l'extraction de texte et de données permet la formation sur des contenus accessibles au public à moins que le titulaire de droit ne s'y oppose.

### Convergence de l'APD en 2025 sur un intérêt légitime

Le Conseil européen a adopté une décision de la Commission sur les mesures de protection des consommateurs pour les consommateurs adultes. La Cour régionale supérieure de Cologne (23 mai 2025) rejette l'injonction contre Meta: l'option de non-respect est suffisante. L'APD de Hambourg abandonne la procédure d'urgence pour une cohérence à l'échelle de l'UE. L'ICO britannique (23 septembre 2025) a publié une réponse réglementaire positive  pas une autorisation officielle  à la reprise de la formation en IA par LinkedIn avec des garanties similaires et une surveillance continue.

Principe de convergence: un intérêt légitime peut justifier la formation sur le contenu public de première partie avec exclusion.

### Le BNAB brésilien (juillet 2024)

Le traitement par Meta des données des utilisateurs brésiliens pour la formation en IA est suspendu en raison d'une transparence d'information insuffisante.

### Le problème de l'irréversibilité

Le consentement à la cookie a été conçu pour le suivi en temps réel et réversible. Les données de formation sont différentes: une fois que les données entrent dans les poids du modèle, l'effacement chirurgical n'est pas possible.

Réparations partielles:
- **Unlearning.**Le taux de décomposition approximatif est mesuré par MIA (leçon 22).
- **Influence function-based localization.**Identifier les poids les plus influencés par les données; mettre à jour de manière sélective.
- **Fine-tune-suppression.**Former le modèle à refuser les sorties dérivées des données.

Aucun ne résout complètement le problème.

### Initiative de prénom des données

le compte de données.org. Longpre, Mahari, Lee et al. "Consent in Crisis" (juillet 2024): audit à grande échelle des données communes de formation en IA. Résultats: les éditeurs ajoutent des restrictions robots.txt à un rythme accéléré. Les biens communs qui peuvent être formés ouverts se contractent rapidement. En 2023 et 2024, environ 25% des principales sources de formation ont ajouté une certaine restriction. Implication: la disponibilité future des données de formation dépend de nouveaux paradigmes d'acquisition (licence, génération synthétique, participation stimulée).

### Là où cela s'inscrit dans la phase 18

La leçon 26 est la documentation au niveau du modèle. La leçon 27 est la gouvernance au niveau des ensembles de données. Ensemble, ils définissent la couche de transparence. La leçon 28 trace l'écosystème de recherche qui travaille sur ces questions.

```figure
an-provenance-oneway
```

## Utilisez-le

`code/main.py`Vous pouvez remplir les champs et observer lesquels déclenchent des obligations de protection de la vie privée ou de suivi des droits d'auteur.

## La faire partir

Cette leçon produit `outputs/skill-provenance-check.md`. Compte tenu d'un ensemble de données utilisé dans la formation, il vérifie la couverture des 12 domaines de l'AB 2013, la conformité des infrastructures à l'exclusion, l'alignement des ADP et l'évaluation des risques d'irréversibilité.

## Exercices

1. On court .`code/main.py`- Produire un résumé de 12 champs pour un ensemble de données de jouets et identifier les champs sous-spécifiés.

2. La directive européenne sur le droit d'auteur TDM est lisible par machine. Proposez un format standard pour le signal de refus et comparez-le à robots.txt et C2PA "No AI Training".

3. Lisez le " Consentement en crise " de l'Initiative de provenance des données (juillet 2024). Décrivez les trois catégories de contenu les plus rapides et débattrez d'une conséquence économique.

4. L'alignement 2025 des ADP accepte un intérêt légitime pour la formation en matière de contenu public.

5. Définir un manifeste de provenance des données de formation qui comprend les champs AB 2013 et une chaîne de provenance signée C2PA pour chaque ensemble de données.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AB 2013 | "the California law" | Generative AI training-data transparency; 12 mandated fields |
| TDM exception | "text-and-data-mining" | EU Copyright Directive training-data exception with opt-out |
| Legitimate interest | "the EU basis" | GDPR Article 6 basis that may justify training on public content |
| Opt-out signal | "machine-readable no-train" | robots.txt, C2PA "No AI Training," TDM.Reservation |
| Irreversibility | "cannot un-train" | Data in model weights is not surgically removable |
| Unlearning | "approximate removal" | Post-training interventions to reduce model dependence on specific data |
| Consent in Crisis | "the DPI audit" | July 2024 finding of accelerating robots.txt restrictions |

## Pour en savoir plus

- [California AB 2013](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2013) Loi sur la transparence des données en matière de formation générative en IA
- [EU AI Act + GPAI Code of Practice (Lesson 24)](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) Chapitre du droit d'auteur
- [Longpre, Mahari, Lee et al. — Consent in Crisis (dataprovenance.org, July 2024)](https://www.dataprovenance.org/consent-in-crisis-paper) Audit de l'IPD
- [IAPP — EU Digital Omnibus GDPR amendments (2025)](https://iapp.org/news/a/eu-digital-omnibus-amendments-to-gdpr-to-facilitate-ai-training-miss-the-mark) contexte réglementaire
