# Les préjugés et les préjudices représentatifs dans les LLM

> Il est également possible de faire appel à des services de communication et de communication de manière à ce que les données soient disponibles. Enquête fondatrice de 2024 distinguant les dommages représentatifs (stéréotypes, suppression) des dommages alloués (distribution inégale des ressources) et catégorisant les mesures d'évaluation en tant que métriques basées sur l'intégration, la probabilité ou le texte généré. 2024-2025 empirique: An et al. (PNAS Nexus, mars 2025) mesure le biais intersectionnel de genre x race sur GPT-3.5 Turbo, GPT-4o, Gemini 1.5 Flash, Claude 3.5 Sonnet, Llama 3-70B sur l'évaluation automatisée du CV pour 20 emplois de niveau d'entrée. WinoIdentity (COLM 2025, arXiv:2508.07111) introduit une évaluation de l'équité fondée sur l'incertitude pour les identités intersectionnelles. Yu & Ananiadou 2025 identifient les neurones de genre dans les couches de PLM; Ahsan & Wallace 2025 utilisent les SAE pour révéler les préjugés raciaux cliniques; Zhou et coll. 2024 (UniBias) manipule les têtes d'attention pour débiasing. Meta-critique (arXiv:2508.11067): La littérature de 10 ans se concentre de manière disproportionnée sur le biais binaire de genre.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, toy embedding-based bias probe)
**Prerequisites:** Phase 05 (word embeddings), Phase 18 · 01 (instruction following)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Définir les dommages représentatifs par rapport aux dommages alloués et donner un exemple de chacun dans un déploiement de MLL.
- Nombre des trois catégories d'évaluation-métrie de Gallegos et coll. 2024 et décrivez une métrique de chacune.
- Décrivez l'intersectionnalité et pourquoi la mesure de l'équité basée sur l'incertitude de WinoIdentity aborde les lacunes dans l'évaluation du biais à un seul axe.
- Décrivez trois approches mécanistes-interprétables du biais (néurones de genre, caractéristiques de l'ESA, manipulation de la tête d'attention).

## Le problème

Les leçons précédentes couvrent les dommages délibérés (détentions, complot) et la gouvernance de la sécurité.

## Le concept

### Réprésentation par rapport à allouement

- **Representational harm.**Un LLM qui présente les infirmières comme exclusivement féminines produit des dommages représentatifs.
- **Allocational harm.**Un LLM qui donne systématiquement un score inférieur aux CV des candidats noirs produit des dommages alloués.

Un modèle peut être "réprésentatif impartial" (produit des représentations diverses) tout en étant "partial par allouement" (fait des recommandations inégales).

### Trois catégories d'évaluation-métrie (Gallegos et coll. 2024)

- **Embedding-based.**Tests de style WEAT sur les emblèmes pré-RLHF. Mesure les associations statistiques entre les termes d'identité et les termes d'attribut.
- **Probability-based.**La probabilité de vérification des stéréotypes par rapport à la violation des stéréotypes.
- **Generated-text-based.**Mesure des tâches en aval sur le texte généré: scoring de CV, rédaction de recommandations, dialogue.

### Intersectionnalité

L'évaluation du biais sur le " genre " manque du biais qui ne se produit que sur les paires (de genre, de race).

WinoIdentity (COLM 2025) introduit l'équité intersectionnelle basée sur l'incertitude. Il mesure si l'incertitude du modèle sur les résultats diffère entre les tuples d'identité intersectionnelle  pas seulement la prédiction du point. Cela capture les cas où le modèle est également erroné entre les groupes mais plus incertain pour certains, ce qui produit un comportement d'allocation en aval différent.

### Approches mécanisées

Les travaux d'interprétation de 2024 à 2025 ouvrent le voile à l'intervention mécaniste:

- **Gender neurons (Yu & Ananiadou 2025).**Les neurones spécifiques de la PML sont corrélés avec des comportements spécifiques au genre.
- **Clinical racial bias via SAEs (Ahsan & Wallace 2025).**Les caractéristiques de l'autoencodeur Sparse décomposent la représentation interne en dimensions interprétables; les caractéristiques liées à la race peuvent être identifiées et supprimées.
- **UniBias (Zhou et al. 2024).**La manipulation des têtes d'attention pour débiasing à tir zéro. Les têtes spécifiques amplifient la sensibilité de la classe d'identité; le zéro ou le ré-poids de ces têtes réduit le biais sans réglage fin.

### La méta-critique

La revue de littérature de 10 ans (arXiv:2508.11067, 2025) constate que le domaine se concentre de manière disproportionnée sur le biais de genre binaire. D'autres axes  handicap, religion, statut de migration, identité multilingue  reçoivent beaucoup moins d'attention. La méta-critique soutient que l'attention étroite peut nuire aux groupes marginalisés par négligence: un modèle bien dévié sur le genre binaire peut être fortement biaisé sur les dimensions que personne n'a vérifiées.

### Là où cela s'inscrit dans la phase 18

Les leçons 20-21 couvrent le biais et l'équité formellement. La leçon 22 couvre la vie privée. La leçon 23 couvre l'eau marquée.

```figure
an-bias-two-harms
```

## Utilisez-le

`code/main.py`construit une sonde de biais basée sur l'intégration de jouets: mesurez la distance de style WEAT entre les termes d'identité et les termes d'attributs dans une simple intégration de co-occurrence. Vous pouvez injecter un biais et observer le feu métrique; appliquer une opération de débiasing simple et observer la récupération partielle.

## La faire partir

Cette leçon produit `outputs/skill-bias-eval.md`. En raison d'une carte modèle ou d'une allégation d'équité, elle contrôle l'évaluation dans les trois catégories métriques (embedding, probabilité, texte généré), la couverture de l'intersectionnalité et le mécanisme de toute intervention débiasing.

## Exercices

1. On court .`code/main.py`- Rapporter les scores de biais de style WEAT avant et après la débiasing étape.

2. Extension de la sonde avec un test intersectionnel: (genre, race) x (carrière, famille).

3. Lisez An et al. 2025 (PNAS Nexus). Identifiez les deux effets intersectionnels qu'ils rapportent que l'évaluation de genre à un seul axe manquerait.

4. Yu & Ananiadou 2025 identifier les neurones de genre. Dessinez une expérience de falsification qui distinguerait " ces neurones causent des préjugés de genre " de " ces neurones corréler avec les préjugés de genre ".

5. La méta-critique soutient que le domaine se concentre trop étroitement sur le sexe binaire.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Representational harm | "stereotypes / erasure" | Biased portrayal of a group |
| Allocational harm | "unequal decisions" | Biased material outcome for a group |
| WEAT | "the embedding test" | Word Embedding Association Test; co-occurrence-based bias probe |
| Intersectionality | "combined identity effects" | Bias that emerges at the intersection of multiple identity axes |
| Gender neurons | "MLP bias neurons" | Specific neurons whose activations correlate with gender-specific behaviour |
| SAE feature | "interpretable dimension" | Sparse-autoencoder-identified feature; useful for mechanistic bias analysis |
| UniBias | "attention-head debiasing" | Zero-shot debiasing by reweighting attention heads |

## Pour en savoir plus

- [Gallegos et al. — Bias and Fairness in LLMs: A Survey (arXiv:2309.00770, Computational Linguistics 2024)](https://arxiv.org/abs/2309.00770) enquête canonique
- [An et al. — Intersectional resume-evaluation bias (PNAS Nexus, March 2025)](https://academic.oup.com/pnasnexus/article/4/3/pgaf089/8111343) étude intersectionnelle à cinq modèles
- [WinoIdentity — uncertainty-based intersectional fairness (arXiv:2508.07111, COLM 2025)](https://arxiv.org/abs/2508.07111) nouveau point de référence
- [UniBias — attention-head manipulation (Zhou et al. 2024, ACL)](https://arxiv.org/abs/2405.20612) Débiasing à tir zéro
