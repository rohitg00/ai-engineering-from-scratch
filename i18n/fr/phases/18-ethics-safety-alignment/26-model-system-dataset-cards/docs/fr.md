# Modèle, système et données de carte

> Trois formats de documentation structurent la transparence de l'IA. Les cartes modèle (Mitchell et coll. 2019)  Étiquettes nutritionnelles pour les modèles: données de formation, analyses quantitatives désagrégées, considérations éthiques, avertissements; seulement 0,3% des cartes modèles Hugging Face documentent des considérations éthiques (Oreamuno et coll. 2023). Fiches de données pour les ensembles de données (Gebru et coll. 2018, CACM)  motivation, composition, processus de collecte, étiquetage, distribution, entretien; analogie électronique-fichier de données. Les cartes de données (Pushkarna et coll., Google 2022)  détails modulaires en couches (téléscopiques, périscopiques, microscopiques) en tant qu'objets de limite pour divers lecteurs. Les développements de 2024 à 2025: génération automatisée via des LLM (CardGen, Liu et coll. En ce qui concerne les données relatives aux données de téléchargement, le rapport de référence de la Commission a été établi en vue de la réalisation de la nouvelle version de la carte de modèle (Liang et coll. Les certificats vérifiables (Laminator, Duddu et coll. Les États membres ont également adopté des mesures de répartition des données sur les données relatives aux données de l'Union européenne. Le 1er juillet 2025); les cartes réglementaires UE/ISO émergentes. Les cartes système (Sidhpurwala 2024; transparence au niveau du système méta; "Bluprints of Trust" arXiv:2509.20394)  documentation complète du système d'IA couvrant les capacités de sécurité, la protection par injection rapide, la détection des données d'exfiltration, l'alignement avec les valeurs humaines.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, model-card + datasheet + system-card generator)
**Prerequisites:** Phase 18 · 18 (safety frameworks), Phase 18 · 24 (regulatory)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Décrivez la carte modèle Mitchell et coll. 2019 et la fiche de données Gebru et coll. 2018.
- Décrire la couche télescopique/périscopique/microscopique des cartes de données.
- Décrivez les cartes système et leur couverture de bout en bout.
- Définir trois développements de 2024 à 2025 (génération automatisée, attestations vérifiables, rapports sur la durabilité).

## Le problème

Les cadres réglementaires (leçon 24) et les politiques de sécurité de laboratoire (leçon 18) exigent toutes deux de la documentation. Les formats de documentation ont évolué de modèles spécifiques (carte modèle) à des ensembles de données spécifiques (fiches de données) à des systèmes spécifiques (carte système). Chacun aborde une portée différente de transparence.

## Le concept

### Les cartes modèle (Mitchell et coll. 2019)

Les sections:
- Des détails du modèle.
- Utilisation prévue.
- Facteurs (facteurs démographiques ou environnementaux pertinents à évaluer).
- Les métriques.
- Les données d'évaluation.
- Données de formation.
- Analyse quantitative (décomposée par facteur).
- Des considérations éthiques.
- Des cavernes et des recommandations.

Problème d'adoption: Oreamuno et collègues ont constaté en 2023 que 0,3% des documents concernant les considérations éthiques étaient des cartes modèle Hugging Face.

### Les fiches de données pour les ensembles de données (Gebru et coll. 2018)

Analogie électronique-fichier de données.
- Motivation (pourquoi le jeu de données a été créé).
- Composition (ce qui est dedans).
- Processus de collecte (comment il a été assemblé).
- Étiquetage (le cas échéant).
- Utilisations (intentionnées, interdites, risques).
- La distribution.
- - Je suis en service.

Publié dans CACM 2021. La feuille de données est la documentation en amont; la carte modèle dépend de l'exactitude de la feuille de données.

### Carte de données (Pushkarna et coll., Google 2022)

Détail en couches modulaires.
- **Telescopic.**Résumé de haut niveau pour les non-experts.
- **Periscopic.**Un aperçu de niveau moyen pour les praticiens de l'IM.
- **Microscopic.**Documentation détaillée au niveau des caractéristiques pour les auditeurs.

Cadrage des objets frontaliers: différents lecteurs extraient des informations différentes du même document.

### Carte de système

Scope: système d'IA de bout en bout comprenant le modèle + stack de sécurité + contexte de déploiement.
- Les capacités de sécurité.
- Protection contre les injections rapides.
- Détection des données par exfiltration.
- L'alignement avec les valeurs humaines déclarées.
- Réaction à l'incident.

Sidhpurwala 2024 et le travail de transparence au niveau du système Meta. " Blueprints of Trust " (arXiv:2509.20394) formalite la carte système comme complément à la couche de déploiement des cartes modèle.

### Les événements de 2024 à 2025

- **CardGen (Liu et al. 2024).**Génération automatique de cartes modèle via LLM; rapporte une objectivité plus élevée que de nombreuses cartes d'auteur humain sur les champs standardisés Mitchell 2019.
- **Download correlation (Liang et al. 2024).**Les cartes de modèle détaillées corrélatives à des taux de téléchargement jusqu'à 29% plus élevés sur la pression d'adoption de HF  sont désormais orientées par le marché, et non seulement par la conformité.
- **Laminator (Duddu et al. 2024).**Les attestations vérifiables par voie de TEE matérielle / signatures cryptographiques  permettent au modèle de carte de porter une preuve de réclamation, pas seulement une réclamation.
- **Sustainability (Jouneaux et al. July 2025).**Ajout de carbone, d'eau et d'empreinte énergétique; normes ISO émergentes.
- **Regulatory cards.**La loi sur l'IA de l'UE (leçon 24) Le chapitre du code de pratique du GPAI sur la transparence exige que les cartes modèle soient un élément de conformité.

### Là où cela s'inscrit dans la phase 18

Les leçons 24-25 sont les couches réglementaire et CVE. La leçon 26 est la couche de documentation. La leçon 27 est la gouvernance des données de formation, qui est la feuille de données en amont. La leçon 28 est l'écosystème de recherche qui produit des évaluations référencées dans les cartes.

```figure
an-card-scopes
```

## Utilisez-le

`code/main.py`Il est possible de vérifier le format et de comparer les trois champs.

## La faire partir

Cette leçon produit `outputs/skill-card-audit.md`- En cas de carte modèle, de feuille de données ou de carte système, elle vérifie la couverture des sections, la désagrégation numérique et la présence d'attestations vérifiables.

## Exercices

1. On court .`code/main.py`- Inspecter les cartes générées. Identifier les sections faibles (pour les titulaires de places uniquement) et préciser les éléments de preuve qui les renforceront.

2. Élargir la carte modèle avec une analyse quantitative désagrégée sur deux groupes démographiques (leçon 20).

3. Lire Oreamuno et coll. 2023 sur le taux d'adoption de 0,3%. Proposer un changement structurel à la spécification du modèle de carte qui augmenterait l'adoption des considérations éthiques.

4. Laminator (Duddu et coll. 2024) utilise des TEE pour les attestations vérifiables.

5. Écrivez une carte système (carte système, pas carte modèle) pour un projet passé ou un déploiement hypothétique.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Model Card | "the Mitchell card" | Mitchell et al. 2019 standard documentation for ML models |
| Datasheet | "the Gebru datasheet" | Gebru et al. 2018 standard documentation for datasets |
| Data Card | "the Pushkarna card" | Google 2022 modular layered data documentation |
| System Card | "the deployment card" | End-to-end AI system documentation including safety stack |
| Boundary object | "different readers, one doc" | Data Cards framing: same document serves diverse audiences |
| Verifiable attestation | "the Laminator attestation" | Cryptographic or TEE proof attached to a documentation claim |
| Sustainability field | "carbon / water footprint" | Emerging 2025 addition for environmental accounting |

## Pour en savoir plus

- [Mitchell et al. — Model Cards for Model Reporting (arXiv:1810.03993, FAT* 2019)](https://arxiv.org/abs/1810.03993) la carte modèle canonique
- [Gebru et al. — Datasheets for Datasets (CACM 2021, arXiv:1803.09010)](https://arxiv.org/abs/1803.09010) papier de feuille de données
- [Pushkarna et al. — Data Cards (Google 2022)](https://arxiv.org/abs/2204.01075) documentation de données en couches
- [Sidhpurwala et al. — Blueprints of Trust (arXiv:2509.20394)](https://arxiv.org/abs/2509.20394) Formalisation de la carte système
