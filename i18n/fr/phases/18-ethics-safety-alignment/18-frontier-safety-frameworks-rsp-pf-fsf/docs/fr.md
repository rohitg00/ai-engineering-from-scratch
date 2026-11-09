# Cadres de sécurité frontaliers  RSP, PF, FSF

> Trois cadres de laboratoire majeurs définissent la gouvernance de l'industrie des capacités frontalières en 2026. La politique d'échelle responsable anthropic v3.0 (février 2026) introduit des niveaux de sécurité de l'IA (ASL-1 à ASL-5+), modélisés sur les niveaux de biosécurité, avec ASL-3 activé en mai 2025 pour les modèles pertinents pour le CBRN. Le cadre de préparation d'OpenAI v2 (avril 2025) définit cinq critères pour les capacités de suivi et sépare les rapports de capacités des rapports de sauvegarde. Le DeepMind Frontier Safety Framework v3.0 (septembre 2025) introduit des niveaux de capacité critiques, y compris une nouvelle CCL de manipulation nocive. Les trois entités incluent désormais des clauses d'ajustement des concurrents permettant de reporter le débarquement des laboratoires sans garanties comparables. L'alignement entre laboratoires reste structurel et non terminologique: "Pouvres de capacité", "Pouvres de capacité élevées" et "Niveaux de capacité critique" désignent des constructions analogues.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 18 · 17 (WMDP), Phase 18 · 07-09 (deception failures)
**Time:** ~75 minutes

## Objectifs d'apprentissage

- Décrivez la structure de niveau ASL d'Anthropic et ce qui a activé ASL-3.
- Nombre des cinq critères du cadre de préparation OpenAI v2 pour les capacités de suivi.
- Décrivez la structure du niveau de capacité critique de DeepMind et la CCL de manipulation nocive.
- Expliquer les clauses d'ajustement des concurrents et leur importance pour la dynamique de la course.
- Définir un cas de sécurité et décrire la structure à trois piliers (monitoring, illégabilité, incapacité).

## Le problème

Les leçons 7-17 établissent que l'illusion est possible, que la capacité à double usage existe et que l'évaluation a des limites.
- Définit les seuils pour les cas où de nouvelles garanties sont nécessaires.
- Définit les évaluations requises avant l'échelle.
- Décrivant à quoi ressemble une caisse de sécurité.
- Il gère le problème de la dynamique de la course (si les concurrents naviguent sans garantie, que faites-vous?).

Les trois cadres 2025-2026 sont l'état de l'art  imparfait, en évolution et suffisamment aligné entre les laboratoires que la question de gouvernance est maintenant de savoir si les cadres sont adéquats, pas s'ils existent.

## Le concept

### Politique d'échelle responsable anthropologique v3.0 (février 2026)

Structure de l'ASL:
- ASL-1: pas un modèle frontalier (summé par une valeur de base inférieure à la frontière).
- ASL-2: ligne de base de la frontière actuelle; déployée avec les garanties habituelles.
- ASL-3: risque significativement plus élevé d'utilisation abusive catastrophique; capacités pertinentes pour le RCRC. Activé en mai 2025.
- ASL-4: TREX de traversée de la R&D-2 de l'IA; modèles qui peuvent automatiser la recherche sur l'IA au niveau d'entrée.
- ASL-5+: des modèles de R&D avancés de l'IA qui accélèrent considérablement l'échelle efficace.

Nouveau dans la version 3.0:
- Carte routière de sécurité des frontières (publique sous forme édité).
- Rapports sur les risques (quartiers, certains examinés par l'extérieur).
- La R&D de l'IA est désagrégée en R&D-2 et R&D-4 de l'IA.
- Une fois que l'IA R&D-4 est franchie, un cas de sécurité affirmatif est nécessaire, identifiant les risques de désalination des modèles poursuivant des objectifs désalinés.

### Le cadre de préparation d'OpenAI v2 (15 avril 2025)

Cinq critères pour les capacités de suivi:
- **Plausible.**Il existe un modèle de menace raisonnable.
- **Measurable.**Une évaluation empirique possible.
- **Severe.**Les dégâts sont importants.
- **Net-new.**Pas un risque préexistant augmenté.
- **Instantaneous-or-irremediable.**Les dommages surviennent rapidement ou ne peuvent être réparés.

Les capacités qui répondent aux cinq sont suivis.

Autre structure de PF v2:
- Rapports de capacité séparés (ce que le modèle peut faire) des rapports de garanties (quels contrôles existent).
- Les avis du groupe consultatif sur la sécurité.
- Le comité de sécurité du conseil d'administration supervise.
- "Clausule d'ajustement": OpenAI peut réduire les exigences si un autre laboratoire ne dispose pas de garanties comparables.

### Le cadre de sécurité de la frontière DeepMind v3.0 (septembre 2025)

Niveaux de capacité critique (CCL) par domaine:
- Le renforcement des armes biologiques
- Le cyber-accès
- ML Accélération de la R&D
- Manipulation nocive (nouvelle dans la version 3.0): des modèles qui pourraient modifier considérablement les croyances/comportements dans des contextes à haut risque.

La version 2.0 (février 2025) a ajouté une section d'alignement trompeur et des niveaux de sécurité plus élevés pour les CCL de R&D ML.

### L'alignement entre les laboratoires

- "Les seuils de capacité"
- "Le niveau de capacité critique".
- OpenAI "Pouvoir de capacité élevé".

Aucune terminologie standard de l'industrie. alignée structurellement: chacun des trois cadres définit des seuils de capacité à niveaux avec des critères d'évaluation publiés.

### Cas de sécurité

Un cas de sécurité est un argument écrit selon lequel un déploiement est acceptablement sûr dans les pires cas.

- **Monitoring.**Peut-on détecter un mauvais comportement si cela se produit ?
- **Illegibility.**Le modèle manque-t-il de capacité à exécuter un plan cohérent pour causer des dommages?
- **Incapability.**Le modèle manque-t-il de capacité à causer le dommage en question?

Les différents cas de sécurité visent différents piliers. Pour un cas ASL-3 CBRN, l'incapacité (via non-apprentissage) est la cible principale. Pour l'alignement trompeur, la surveillance et l'illégalité sont des cibles. Pour la cyber-élevage, les trois sont pertinents.

### Le problème de la dynamique de la course

Les clauses d'ajustement des concurrents sont controversées. Les critiques affirment qu'elles créent une course vers le bas: si les trois laboratoires réduisent les exigences lorsqu'un concurrent est défectueux, l'équilibre se déplace vers la défectuosité.

Les résultats de l'étude ont été évalués par le Bureau de l'IA (leçon 24) et par le Bureau de l'IA (leçon 24) du Royaume-Uni.

### Là où cela s'inscrit dans la phase 18

Les leçons 17-18 sont la couche de mesure et de gouvernance en plus des analyses de la tromperie et de l'équipe rouge. Les leçons 19-24 couvrent le bien-être, les préjugés, la vie privée, le marquage d'eau et la structure réglementaire.

```figure
al-asl-ladder
```

## Utilisez-le

Aucun code pour cette leçon. Lisez les trois sources principales: RSP v3.0, PF v2, FSF v3.0. Mettez la structure de chaque laboratoire aux autres et identifiez un seuil que chaque laboratoire définit que les autres ne le font pas.

## La faire partir

Cette leçon produit `outputs/skill-framework-diff.md`. Compte tenu d'un cadre de sécurité ou d'une note de mise en œuvre, il compare les définitions de seuils, les évaluations requises et la structure des cas de sécurité du cadre par rapport aux RSP v3.0, PF v2, FSF v3.0 et aux écarts de labélisation.

## Exercices

1. Lisez RSP v3.0, PF v2 et FSF v3.0. Compilez un tableau du seuil de CBRN de chaque laboratoire, du seuil de R&D d'IA de chacun et de l'évaluation préalable requise de chacun.

2. La clause d'ajustement des concurrents est dans les trois cadres (2025+). Écrivez un paragraphe en faveur de cette clause; écrivez un paragraphe en opposition. Identifiez l'hypothèse de dépendance de chaque position.

3. Conceptez un dossier de sécurité pour un modèle qui franchit le seuil de R&D-4 de l'IA d'Anthropic. Nommez les preuves requises par chacun des trois piliers (monitoring, illégabilité, incapacité).

4. La FSF v3.0 de DeepMind introduit une LCC de manipulation nocive. Proposez trois mesures empiriques qui indiqueraient qu'un modèle a franchi ce seuil.

5. Lisez les "éléments communs des politiques de sécurité de l'IA frontalière" (2025) du METR. Nombrez les trois convergences inter-laboratorielles les plus fortes et les deux plus grandes divergences.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| RSP | "Anthropic's framework" | Responsible Scaling Policy; ASL tiers; v3.0 February 2026 |
| PF | "OpenAI's framework" | Preparedness Framework; five criteria; v2 April 2025 |
| FSF | "DeepMind's framework" | Frontier Safety Framework; CCLs; v3.0 September 2025 |
| ASL-3 | "biosafety level 3-analog" | Anthropic tier for CBRN-relevant capabilities; activated May 2025 |
| CCL | "critical capability level" | DeepMind's threshold construct; per-domain |
| Safety case | "the formal argument" | Written argument that deployment is acceptably safe under worst-case U |
| Adjustment clause | "competitor defection allowance" | Framework provision for reducing requirements if competitors ship without comparable safeguards |

## Pour en savoir plus

- [Anthropic — Responsible Scaling Policy v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) niveaux de LSA, feuilles de route, répartition de la R&D en IA
- [OpenAI — Updating the Preparedness Framework (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/) cinq critères, clause d'ajustement
- [DeepMind — Strengthening our Frontier Safety Framework (September 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) CCL v3.0, Manipulation néfaste
- [METR — Common Elements of Frontier AI Safety Policies (2025)](https://metr.org/blog/2025-03-26-common-elements-of-frontier-ai-safety-policies/) comparaison entre laboratoires
