# Critères d'équité  Groupe, individuel, contrefactuel

> Trois familles ont créé la littérature de l'équité. L'équité des groupes: parité démographique, cotisations égalées, équité d'utilisation conditionnelle d'une certaine précision  taux égaux entre les groupes protégés en moyenne. L'équité individuelle (Dwork et al. 2012): des individus similaires reçoivent des décisions similaires; condition de Lipschitz sur la carte de décision. L'équité contrefactuelle (Kusner et coll. 2017): une décision est juste pour un individu si elle est inchangée lorsque des attributs sensibles sont modifiés de manière contrefactuelle. Résultat théorique 2024 (NeurIPS 2024): il existe un compromis inhérent entre CF et précision; une méthode modèle-agnostique convertit un prédicteur optimal mais injuste en un prédicteur CF avec perte de précision limitée. Contrastes de rétractation (arXiv:2401.13935, janvier 2024): un nouveau paradigme qui évite d'exiger des interventions sur les attributs légalement protégés. Réconciliation philosophique (ICLR Blogposts 2024): avec des graphiques de causes, satisfaire certaines mesures d'équité de groupe implique une équité contrefactuelle.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, three-criteria comparison)
**Prerequisites:** Phase 18 · 20 (bias), Phase 02 (classical ML)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Indiquez les trois critères d'équité de groupe (parité démographique, cote égalisée, égale précision d'utilisation conditionnelle) et un résultat impossible.
- Décrire l'équité individuelle à l'aide de la formule de Dwork et coll. 2012 de Lipschitz.
- Décrivez l'équité contrefactuelle et sa dépendance au graphe causale.
- Expliquez les contrefaçons de rétractation et pourquoi elles évitent le problème de l'intervention sur les attributs protégés.

## Le problème

La leçon 20 traitait de la mesure des biais. La leçon 21 traitait de la définition de la norme d'équité à laquelle la mesure devrait servir. Les trois familles donnent des normes structurellement différentes  un modèle peut être équitable en groupe et injuste en individu, équitable en contrefaçon et injuste en groupe. Choisir une norme est une décision politique; aucune norme n'est universellement optimale.

## Le concept

### L'équité de groupe

- **Demographic parity.**P\Y=1\A=a=P\Y=1\A=a') pour tous les groupes.
- **Equalized odds.**P (Y=1), Y=y, A=a = P (Y=1), Y=y, A=a) = TPR et FPR égaux dans les groupes.
- **Conditional use accuracy equality.**P * Y = y , Y = y, A = a) = P * Y * y , Y = y, A = a') est la même valeur prédictive entre les groupes.

L'impossibilité (Chouldechova, Kleinberg-Mullainathan-Raghavan 2017): ces trois critères ne peuvent pas être satisfaits simultanément sous des taux de base inégaux.

### L'équité individuelle

Une carte de décision f est individuellement équitable par rapport à une métrique de similitude spécifique à la tâche d si f(x) - f(x') <= L * d(x, x') pour une constante de Lipschitz L. Des individus similaires prennent des décisions similaires.

Il faut définir d. Question politique, pas statistique.

### L'équité contrefactuelle

Une décision est contrefactuellement juste pour l'individu i si, selon un modèle de causalité de la population, la décision est inchangée lorsque les attributs sensibles i sont contrefactuellement modifiés.

Il faut une DAG causale, la DAG est un choix de modélisation, l'équité contrefactuelle est justifiée seulement par la DAG.

### Le compromis CF-versus précision

NeurIPS 2024 théorique: il existe un compromis inhérent entre l'équité contrefactuelle et la précision prédictive. Une méthode modèle-agnostique peut convertir un prédicteur optimal mais injuste en un prédicteur CF, à un coût de précision limité. Le coût de précision dépend de l'ampleur du coefficient d'attribut sensible dans le prédicteur injuste optimal.

### Contrôts de rétractation

arXiv:2401.13935 (janvier 2024). Les contrefaçons traditionnelles nécessitent des interventions sur l'attribut sensible  "la décision changerait si cette personne avait été d'un sexe différent".

Les contrefactuels de rétractation font tourner le dos: au lieu d'intervenir sur l'attribut, demandez quelle combinaison des caractéristiques réelles de l'individu aurait produit le résultat contrefactuel.

### Réconciliation philosophique

ICLR Blogposts 2024. Avec un graphique de causalité à portée de main, satisfaire certaines mesures d'équité de groupe implique une équité contrefactuelle.

Cela ne résout pas les théorèmes de l'impossibilité (les taux de base inégaux empêchent toujours l'équité simultanée des groupes).

### Là où cela s'inscrit dans la phase 18

La leçon 20 est la mesure du biais. La leçon 21 est la définition de l'équité. La leçon 22 est la vie privée (privé différentiel). La leçon 23 est la marquage d'eau.

```figure
an-fairness-trilemma
```

## Utilisez-le

`code/main.py`construit un ensemble de données de classification binaire de jouets avec un attribut sensible et des taux de base inégaux. Compute la parité démographique, les cotes égalées et l'équité de précision d'utilisation conditionnelle sur un classificateur simple. Observez les trois mesures qui ne sont pas d'accord. Appliquez une ré pondération pour la parité démographique et observez son coût sur les deux autres.

## La faire partir

Cette leçon produit `outputs/skill-fairness-criterion.md`. En raison d'une allégation ou d'une politique d'équité, il indique quel critère est réclamé, si le modèle peut satisfaire aux critères restants en vertu des taux de base inégalés réclamés et quel DAG de causalité dépend de la allégation.

## Exercices

1. On court .`code/main.py`- Rapporter les trois indicateurs de groupe sur les données par défaut.

2. Implémenter la métrique d'équité individuelle de Dwork et coll. 2012 en utilisant L2 sur les caractéristiques non sensibles.

3. Lisez Kusner et coll. 2017. Construisez un simple DAG causale à deux facteurs pour le score de CV et identifiez la condition d'équité contrefactuelle qu'il implique.

4. Le document relatif aux contrefacteurs de rétractation 2024 évite l'intervention sur les attributs protégés.

5. La réconciliation ICLR 2024 soutient que l'équité de groupe et contrefactuelle sont des facettes de la même structure.`code/main.py`et indiquer l'hypothèse causale qui les rendrait équivalents.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Demographic parity | "equal rates" | P(Y=1 | A=a) equal across groups |
| Equalized odds | "equal TPR/FPR" | Equal true-positive and false-positive rates across groups |
| Conditional use accuracy | "equal PPV/NPV" | Equal predictive values across groups |
| Individual fairness | "Lipschitz condition" | Similar individuals get similar decisions |
| Counterfactual fairness | "causal alteration invariance" | Decision unchanged under counterfactual attribute alteration |
| Backtracking counterfactual | "explain via actuals" | Counterfactual reasoned backward from outcome, not forward from attribute |
| Impossibility theorem | "the three conflict" | Chouldechova / KMR 2017: group criteria mutually exclusive under unequal base rates |

## Pour en savoir plus

- [Dwork et al. — Fairness through Awareness (arXiv:1104.3913)](https://arxiv.org/abs/1104.3913) équité individuelle
- [Kusner, Loftus, Russell, Silva — Counterfactual Fairness (arXiv:1703.06856)](https://arxiv.org/abs/1703.06856) équité contrefactuelle
- [Chouldechova — Fair prediction with disparate impact (arXiv:1703.00056)](https://arxiv.org/abs/1703.00056) impossibilité
- [Backtracking Counterfactuals (arXiv:2401.13935)](https://arxiv.org/abs/2401.13935) un nouveau paradigme pour les interventions à attribut protégé
