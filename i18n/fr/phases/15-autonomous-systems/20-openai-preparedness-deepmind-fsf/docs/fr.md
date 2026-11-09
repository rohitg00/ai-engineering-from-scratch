# Le cadre de préparation à l'OpenAI et le cadre de sécurité frontalière de DeepMind

> OpenAI Preparedness Framework v2 (avril 2025) introduit les catégories de recherche  Autonomie à longue portée, sandbagging, réplique autonome et adaptation, soustraction des garanties  distinctes des catégories suivantes. Les catégories suivantes déclenchent des rapports sur les capacités ainsi que des rapports sur les garanties examinés par le groupe consultatif sur la sécurité. La FSF v3 de DeepMind (septembre 2025, avec des niveaux de capacité de suivi ajoutés le 17 avril 2026) replie l'autonomie dans les domaines de R&D et de cyber-médias (niveau d'autonomie de R&D de ML 1 = automatiser complètement le pipeline de R&D de l'IA à un coût compétitif par rapport aux outils humains + AI). La FSF v3 aborde explicitement l'alignement trompeur par la surveillance automatisée des abus de raisonnement par instrument. La note honnête: Les catégories de recherche dans PF v2 (y compris l'autonomie à longue portée) ne déclenchent pas automatiquement des atténuations; le langage de politique est "potentiel". DeepMind lui-même dit que la surveillance automatisée "ne restera pas suffisante à long terme" si le raisonnement instrumental se renforce.

**Type:** Learn
**Languages:** Python (stdlib, three-framework decision-table diff tool), TypeScript
**Prerequisites:** Phase 15 · 19 (Anthropic RSP)
**Time:** ~45 minutes

## Le problème

La leçon 19 lit de près la politique d'échelle d'Anthropic. Cette leçon complète l'image en lisant OpenAI et DeepMind. Les trois documents sont des objets de cousin traitant de la même question  quand un laboratoire frontalier devrait-il faire une pause ou passer une porte sur un modèle  et ils convergent sur un petit ensemble de catégories et divergent dans des endroits spécifiques qui comptent.

La convergence: les trois étiquettes autonomie à longue portée comme une classe de capacités digne de suivi. Les trois reconnaissent le comportement trompeur (faux d'alignement, sabotage) comme une catégorie spécifique de risque. Les trois ont un organe d'examen interne. La divergence: OpenAI divise les catégories en "Tracked" (atténuation obligatoire) et "Research" (pas de déclencheur automatique). DeepMind divise l'autonomie en deux domaines plutôt que de la nommer séparément. Les noms du laboratoire sont Tracked vs Research, ou Critical vs Moderate, ou Tier-1 vs Tier-2; la conséquence opérationnelle de la cuve dans laquelle une capacité vit est différente entre les laboratoires.

La même capacité peut être "atténuation obligatoire" chez Anthropic, "monitorée mais non déclenchée" chez OpenAI, et "traquée dans un domaine spécifique" chez DeepMind.

## Le concept

### Le cadre de préparation d'OpenAI v2 (avril 2025)

La structure:

- **Tracked Categories**Les rapports de mesures de sécurité (quels sont les mesures d'atténuation en place) sont examinés par le groupe consultatif en matière de sécurité avant le déploiement.
- **Research Categories**Le projet de recherche a été lancé en décembre 1995 pour la mise en œuvre de la stratégie de recherche et de l'analyse des données de l'industrie de l'énergie et de l'énergie.

Le cadre clé dans v2: Les catégories de recherche ne déclenchent pas automatiquement des atténuations. Le langage de politique est les atténuations " potentielles ". C'est le delta spécifique à surveiller: l'emplacement d'une catégorie dans Tracked vs Research est la charnière entre " fermé " et " observé ".

### Framework de sécurité de la frontière DeepMind v3 (septembre 2025; niveaux de capacité de suivi ajoutés le 17 avril 2026)

La structure:

- **Critical Capability Levels (CCLs)**: les seuils de capacité dans trois groupes: abus (CBRN, Cyber, Manipulation nocive), R&D ML et une piste de désalignement exploratoire.
- **Tracked Capability Levels**Exemple concret: ML R&D autonomie niveau 1 = automatiser pleinement le pipeline de R&D de l'IA à un coût compétitif par rapport aux outils humains + IA.
- **Deceptive alignment monitoring**: engagement explicite à la surveillance automatisée des abus de raisonnement par des instruments.

L'autonomie de l'encadrement diffère de celle d'OpenAI. DeepMind ne garde pas "Autonomy" comme un domaine de premier niveau; il est plié dans les domaines où l'autonomie causerait des dommages (ML R&D et Cyber). L'argument est que l'autonomie sans domaine est une capacité sans risque; le contre-argument est que l'autonomie entre domaines est un méta-risque que le cadre devrait nommer.

### Ce sur quoi les trois convergent

- Groupe consultatif en matière de sécurité interne (nommé Anthropic SAG, OpenAI SAG, comité interne DeepMind).
- mention explicite de l'alignement trompeur / de l'alignement simulé comme une classe de risque.
- Les documents permanents sur une cadence déclarée (Anthropic: Route-plan de sécurité frontalière, rapport de risque; OpenAI: rapports sur les capacités et les garanties; DeepMind: cycle de mise à jour du FSF).
- Reconnaissance que les défenses de surveillance seulement ont un plafond. "La surveillance automatisée ne restera pas suffisante à long terme", explique DeepMind.

### Où ils divergent

- **Anthropic**: l'engagement de pause supprimé dans v3.0; le seuil de R&D-4 est le porte suivant nommé.
- **OpenAI**: Traqué vs recherche divisé; les catégories de recherche (y compris l'autonomie à longue portée) ne se feront pas automatiquement passer.
- **DeepMind**: autonomie repliée sur d'autres domaines; les niveaux de capacité suivis ajoutent de la granularité en avril 2026.

### Le sablebaging: une capacité spécifique qui complique les trois

Le sandbagging (un modèle qui a des performances stratégiques inférieures aux évaluations) est dans les catégories de recherche d'OpenAI. Le RSP v3.0 d'Anthropic le traite via le vide d'évaluation-context (leçon 1). DeepMind le traite via une surveillance trompeuse de l'alignement dans FSF v3.

Si un modèle de sable de sable sur les évaluations, les seuils de capacité de chaque cadre sont sous-estimés. Le cadre fonctionne seulement si la mesure fonctionne. C'est pourquoi la mesure externe (leçon 21, METR) et l'évaluation adversitaire sont nécessaires en plus de l'auto-évaluation en laboratoire.

### La compétence en matière de lecture des politiques

- Localiser: chaque fonctionnalité qui vous intéresse doit être disponible dans la police.
- Classifier: est-ce suivi (qui déclenche l'atténuation) ou la recherche (qui suit mais ne déclenche pas)?
- Cadence: la politique est-elle mise à jour sur un calendrier déclaré ou seulement après des événements spécifiques?
- L'indépendance: est-elle obligatoire ou facultative ? partenaires anthropologiques avec Apollo et l'Institut américain de sécurité de l'IA; OpenAI avec METR; DeepMind avec SAG interne principalement.

```figure
a5-tracked-vs-research
```

## Utilisez-le

`code/main.py`Il est également possible de trouver des solutions de gestion de la situation en fonction de la capacité de l'entreprise à utiliser des outils de gestion de la situation en fonction de la capacité de l'entreprise à prendre des décisions.

## La faire partir

`outputs/skill-cross-policy-diff.md`produit une comparaison entre les politiques pour une capacité spécifique, en utilisant les trois cadres comme référence.

## Exercices

1. On court .`code/main.py`. Confirmer que la sortie de l'outil diff correspond aux politiques pour au moins deux fonctionnalités que vous pouvez vérifier par rapport aux documents source.

2. Lisez le Cadre de préparation OpenAI v2 en entier. Identifiez chaque catégorie de recherche. Pour chaque catégorie, écrivez une phrase sur la raison pour laquelle elle est dans la recherche plutôt que dans le suivi.

3. Lisez la version complète de DeepMind FSF v3, ainsi que la mise à jour des niveaux de capacité de suivi d'avril 2026. Identifiez les critères d'évaluation spécifiques de l'autonomie de niveau 1 de R&D de ML. Comment le mesurerez-vous à l'extérieur?

4. Le sandbagging est dans les catégories de recherche d'OpenAI. Concevoir une évaluation qui obligerait un modèle de sandbagging à révéler sa capacité réelle.

5. Comparez les trois politiques sur une capacité spécifique (votre choix). Nommez la classification de la politique que vous trouvez la plus rigoureuse et la moins rigoureuse.

## Les termes clés

| Term | What people say | What it actually means |
|---|---|---|
| Preparedness Framework | "OpenAI's scaling policy" | PF v2 (April 2025); Tracked vs Research categories |
| Tracked Category | "Mandatory mitigation" | Triggers Capabilities + Safeguards Reports; SAG review |
| Research Category | "Monitored only" | Tracked but no automatic mitigation; includes Long-range Autonomy |
| Frontier Safety Framework | "DeepMind's scaling policy" | FSF v3 (Sept 2025) + Tracked Capability Levels (Apr 2026) |
| CCL | "Critical Capability Level" | DeepMind threshold per domain (CBRN, Cyber, Harmful Manipulation, ML R&D) |
| ML R&D autonomy level 1 | "R&D automation" | Fully automate AI R&D pipeline at competitive cost |
| Sandbagging | "Strategic underperformance" | Model underperforms on evals; in OpenAI Research Categories |
| Instrumental reasoning | "Means-ends reasoning" | Reasoning about how to achieve goals; target of DeepMind monitoring |

## Pour en savoir plus

- [OpenAI — Updating our Preparedness Framework](https://openai.com/index/updating-our-preparedness-framework/)- L'annonce de v2.
- [OpenAI — Preparedness Framework v2 PDF](https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf) document complet.
- [DeepMind — Strengthening our Frontier Safety Framework](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) Annonce de FSF v3.
- [DeepMind — Updating the Frontier Safety Framework (April 2026)](https://deepmind.google/blog/updating-the-frontier-safety-framework/) Ajout des niveaux de capacité suivis.
- [Gemini 3 Pro FSF Report](https://storage.googleapis.com/deepmind-media/gemini/gemini_3_pro_fsf_report.pdf) exemple d'un rapport de risque au format FSF.
