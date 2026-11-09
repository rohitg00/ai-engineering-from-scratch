# L'évaluation de la capacité de double utilisation du WMDP

> Li et coll., "Le benchmark WMDP: Mesurer et réduire l'utilisation malveillante avec le désapprentissage" (ICML 2024, arXiv:2403.03218). 4 157 questions à choix multiples sur la biosécurité (1 520), la cybersécurité (2 225) et la chimie (412). Les questions sont posées dans la "zone jaune"  à proximité permettant la connaissance, filtrées par l'examen par plusieurs experts et la conformité juridique ITAR/EAR. Deux objectifs: évaluation par procuration de la capacité à double usage et référence de non-apprentissage (la méthode RMU complémentaire réduit les performances du WMDP tout en préservant la capacité générale). 2024-2025 récit de terrain: les premières évaluations OpenAI/Anthropic 2024 ont rapporté une " légère amélioration " de la recherche sur Internet; en avril 2025, le Cadre de préparation OpenAI v2 a déclaré que les modèles étaient " sur le point d'aider significativement les novices à créer des menaces biologiques connues ".

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, WMDP-shaped uplift evaluation harness)
**Prerequisites:** Phase 18 · 16 (red-team tooling), Phase 14 (agent engineering)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Décrivez les trois domaines de WMDP, le nombre de questions et le critère de filtrage "zone jaune".
- Expliquez à l'UER et pourquoi le WMDP est à la fois une évaluation et un critère de référence pour le désapprentissage.
- Décrivez le récit de l'élévation de 2024-2025: "légère élévation" -> "sur le point" -> "insufficient pour exclure ASL-3".
- Distinguer la capacité relative des débutants de la capacité absolue des experts.

## Le problème

La capacité à double usage est le problème de mesure dans le cadre de la sécurité frontalière de chaque laboratoire (leçon 18). La question est: le modèle X améliore-t-il la capacité d'un débutant à causer des dommages massifs en bio, en chimie ou en cyber ? La mesure directe (demander au modèle de produire réellement des dommages) est illégale et contraire à l'éthique. La mesure par procuration a besoin d'un indice de référence que le modèle ne peut refuser (pour produire des chiffres honnêtes de capacité), mais dont les questions ne sont pas elles-mêmes des publications nuisibles.

## Le concept

### La "zone jaune"

Les questions qui nécessitent une connaissance proche d'un processus nocif sans être une recette de synthèse directe. " Quel réactif catalyse l'étape 4 de [route publiée] ? " et non " comment faire [compound dangereux] ? " Chaque question examinée par plusieurs experts de domaine; filtrée pour la conformité ITAR/EAR aux contrôles d'exportation.

Au total, 4 157 questions:
- Biosecurité: 1 520
- Sécurité informatique: 2 225
- Chimique: 412

Les modèles répondent sans être invités à aider à quoi que ce soit; la capacité peut être mesurée sans provoquer un comportement nuisible.

### RMU  Réprésentation Fausse direction pour désapprentissage

La méthode de désapprentissage associée. Appliquée à LLaMa-2-7B, réduit les scores de WMDP à presque aléatoire tout en préservant MMLU et autres critères de référence de capacité générale dans quelques points de pourcentage. La méthode publiée est la ligne de base de désapprentissage pour chaque article de désapprentissage bio-chimique-cyberconcentré ultérieur.

### Le récit édifiant 2024-2025

Trois phases:

1. **2024 "mild uplift."**Les premières évaluations d'OpenAI et d'Anthropic Preparedness/RSP ont rapporté de petits avantages par rapport à la recherche sur Internet pour les débutants qui tentent des tâches bio-adjacentes.

2. **April 2025 "on the cusp."**Le Cadre de préparation d'OpenAI v2 a rapporté des modèles " sur le point d'aider significativement les novices à créer des menaces biologiques connues. " Pas une revendication de capacité  un avertissement que le seuil est proche.

3. **Anthropic's 2025 bioweapon-acquisition trial.**Une étude contrôlée avec des participants débutants, mesurée de succès relatif dans les tâches de phase d'acquisition. augmentation de 2,53 fois rapportée. insuffisante pour exclure ASL-3 (leçon 18)  le seuil de la politique d'échelle responsable d'Anthropic de niveau 3 est atteint ou approché.

### Le débutant relatif contre l'expert absolu

Une distinction cruciale:

- **Novice-relative uplift.**Le modèle aide- t- il un non-expert? Multiplicatif. L'avantage relatif est élevé parce que les débutants savent peu; même des informations modestes peuvent aider.
- **Expert-absolute capability.**Le modèle produit combien d'informations avec le maximum d'efforts? Un expert peut extraire plus qu'un novice.

Les cas de sécurité (leçon 18) visent à la fois: "le modèle ne peut pas donner à un débutant suffisamment de relance pour l'exécuter" et "un expert ne peut pas extraire des informations du modèle qui n'a pas déjà été publié".

### Le piège de mesure

Le WMDP est un proxy de capacité, pas une mesure de déploiement. Un modèle qui obtient un score élevé sur le WMDP peut ou non être exploitable par un débutant dans la pratique, selon:
- Résistance à l'évitement (combien il est difficile de retirer la capacité sans démarrer les filtres de sécurité)
- Connaissance tacite (capacité qui nécessite des compétences en laboratoire humide, pas des informations)
- Les obstacles à l'exécution (achats, équipements)

L'essai d'acquisition d'armes biologiques d'Anthropic en 2025 ajoute la couche d'élicitation des débutants en plus de la capacité de style WMDP: il mesure le succès réel de la tâche, pas la capacité de choix multiples.

### Là où cela s'inscrit dans la phase 18

Les leçons 12-16 sont les outils d'attaque et de défense sur les sorties de modèle. La leçon 17 est la couche de capacité à double usage  la mesure que les cadres de sécurité frontaliers (leçon 18) évaluent. La leçon 30 ferme l'arc avec les preuves actuelles de 2026 cyber/bio/chimie/élévation nucléaire.

```figure
al-wmdp-yellow-zone
```

## Utilisez-le

`code/main.py`Un modèle de simulation est testé sur des questions encastrées dans des catégories; des scores par domaine sont rapportés. Une simple intervention de désapprentissage (réprésentation zéro-sauf spécifique au domaine) réduit les scores; vous pouvez mesurer le compromis par rapport à la capacité générale.

## La faire partir

Cette leçon produit `outputs/skill-wmdp-eval.md`. Compte tenu d'une affirmation de capacité à double usage ("notre modèle n'aide pas significativement les armes biologiques"), il vérifie: quels critères de référence ont été exécutés, quel chemin de refus a été utilisé pour l'évaluation (completion brute par rapport aux objectifs politiques) et si les études d'élicitation novices complètent le résultat de choix multiples.

## Exercices

1. On court .`code/main.py`- Rapporter la précision par domaine avant et après la phase de désapprentissage du jouet.

2. Augmentez le WMDP avec un quatrième domaine (par exemple, radiologique). spécifiez deux types de questions illustratives dans la zone jaune. Expliquez pourquoi la rédaction de telles questions est plus difficile que l'ajout de questions en forme de MMLU.

3. Lisez la section 5 du WMDP 2024 (méthodologie RMU). Décrire une approche de désapprentissage plus simple (par exemple, supprimer les neurones top-k pour le contenu de domaine) et décrire son coût de capacité générale attendu.

4. L'essai d'acquisition d'armes biologiques d'Anthropic 2025 rapporte une hausse de 2,53 fois. Décrivez deux façons dont ce nombre pourrait être biaisé vers le haut (dimension d'échantillon novices, fidélité à la tâche) et deux vers le bas (plafond d'élicitation, clôture de sécurité du modèle).

5. Expliquer ce qu'un cas de sécurité pour l'ASL-3 exige en plus de passer le WMDP. Nommer au moins deux études complémentaires d'élicitation.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| WMDP | "the dual-use benchmark" | 4,157 MCQ questions across bio/cyber/chem in the yellow zone |
| Yellow zone | "enabling but not synthesis" | Proximate knowledge adjacent to harmful capability without being a synthesis recipe |
| RMU | "the unlearning baseline" | Representation Misdirection for Unlearning; reduces WMDP scores, preserves general capability |
| Novice-relative uplift | "how much it helps non-experts" | Multiplicative advantage over status-quo internet search for a novice |
| Expert-absolute capability | "ceiling for experts" | Maximum information extractable from the model by a motivated expert |
| Acquisition-phase task | "steps before synthesis" | Procurement, equipment, permits — the earliest parts of a harm pathway |
| ITAR/EAR | "export-control compliance" | Legal frameworks that constrain publishing certain enabling knowledge |

## Pour en savoir plus

- [Li et al. — The WMDP Benchmark (arXiv:2403.03218, ICML 2024)](https://arxiv.org/abs/2403.03218) le rapport de référence et le papier RMU
- [OpenAI — Preparedness Framework v2 (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) "sur le bord"
- [Anthropic — Responsible Scaling Policy v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) Le seuil de bio de l'ASL-3 et les résultats des essais d'acquisition
- [DeepMind — Frontier Safety Framework v3.0 (September 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) LCC de bio-élévation
