# Surveillance évolutive et généralisation faible à forte

> Burns et al. (OpenAI Superalignment, " Généralisation faible à forte ", 2023) a proposé un proxy pour le problème de la superalignement: affiner un modèle fort en utilisant des étiquettes produites par un modèle plus faible. Si le modèle fort généralise correctement à partir d'une supervision faible imparfaite, les méthodes d'alignement à l'échelle humaine actuelles peuvent s'étendre aux systèmes surhumains. La surveillance évolutive et le W2SG sont complémentaires. La surveillance évolutive (débat, modélisation récursive de la récompense, décomposition des tâches) augmente la capacité efficace du surveillant afin qu'il puisse suivre le modèle sous surveillance. Le W2SG assure que le modèle solide généralise correctement toute supervision imparfaite que le surveillant fournit. Le groupe W2SG (arXiv:2501.13124, janvier 2025) les combine.

**Type:** Learn
**Languages:** Python (stdlib, W2SG gap simulator), TypeScript
**Prerequisites:** Phase 18 · 01 (instruction-following), Phase 18 · 10 (AI Control), Phase 09 (RL foundations)
**Time:** ~60 minutes

## Objectifs d'apprentissage

- Définir la surveillance évolutive et la généralisation faible à forte et expliquer comment elles sont complémentaires.
- Décrire la configuration expérimentale de Burns et coll. 2023: réglage fin de GPT-4 à l'aide d'étiquettes de GPT-2.
- Expliquer la mesure de l'écart de performance récupéré (PGR) et ce qu'elle mesure.
- Indiquez les trois principaux mécanismes de surveillance évolutifs (débat, modélisation récursive de la récompense, décomposition des tâches) et une force de chacun.

## Le problème

Chaque technique d'alignement jusqu'à présent dans la phase 18 suppose que le superviseur peut évaluer le comportement du modèle. Lorsque le modèle est surhumain, le superviseur est le maillon faible. La question de l'alignement supérieur: un superviseur plus faible peut-il produire de manière fiable un modèle plus fort et aligné?

Burns et al. réduisent cela à une configuration empirique opérationnelle: superviser fort avec faible, mesurer combien de la capacité du modèle fort survit à la supervision faible.

## Le concept

### W2SG: la configuration de Burns et al.

- Modèle faible: classe GPT-2.
- Modèle fort: classe GPT-4.
- Objectif: un plafond GPT-4 solide pour la tâche.

Procédure:
1. Obtenez les prédictions zéro-shot du modèle faible sur une tâche.
2. Réglez le modèle fort sur des données faibles.
3. Mesurer la précision du modèle fort et bien ajusté.

Les lignes de base: précision faible du modèle lui-même, plafond supervisé du modèle fort sur les étiquettes en or.

Metrique de la faille: Faille de performance récupérée (PGR) = (finement réglée - faible) / (plafond - faible).

### Résultats empiriques de Burns et coll.

Dans les tâches de PNL, de puzzle d'échecs et de modélisation de récompenses, le PGR était toujours positif: le modèle fort se généralisait au-delà des erreurs du superviseur faible.

Limitations Burns et al. note:
- Le modèle faible est aligné; un modèle vraiment surhumain pourrait être aligné par un humain, mais avec un écart de capacité beaucoup plus grand.
- La généralisation du modèle fort peut être plus liée aux antécédents de tâches que à la récupération de l'intention de vérité de base.
- L'obtention de la connaissance latente du modèle fort est le vrai problème; la RGP mesure une opérationnalisation spécifique.

### Surveillance évolutive: trois mécanismes

- **Debate (Irving et al. 2018).**Deux exemples de U débattent des côtés opposés; le juge faible décide. L'hypothèse: trouver une vraie réponse convaincante est plus facile que de trouver une fausse réponse convaincante.
- **Recursive Reward Modeling (Leike et al. 2018).**U aide l'humain à former le modèle de récompense pour U+1.
- **Task Decomposition (Christiano, Shlegeris, Amodei 2018).**Décomposer une tâche difficile en sous-tâches que l'homme peut vérifier, récursivement.

Chaque mécanisme suppose quelque chose sur la structure de la tâche ou l'alignement des composants intermédiaires.

### Pourquoi la surveillance évolutive et le W2SG sont complémentaires

Une surveillance à grande échelle améliore la qualité du signal efficace du surveillant.
Le W2SG comble le fossé de tout signal imparfait que le surveillant peut fournir.

Lang et coll.  Débat aide la généralisation faible à forte (arXiv:2501.13124) les combine: un protocole de débat fournit de meilleures étiquettes faibles, et le modèle fort est formé sur ces étiquettes.

### Le drame organisationnel

L'équipe Superalignment d'OpenAI a été dissoute en mai 2024 après le départ de Jan Leike à Anthropic. L'agenda (surveillance scalable, W2SG, recherche d'alignement automatisée) a continué à Anthropic et dans les laboratoires académiques  MATS (leçon 28), Redwood (leçon 10), Apollo (leçon 8), METR (leçon 28). La structure organisationnelle a changé; les questions de recherche ne l'ont pas fait.

### Là où cela s'inscrit dans la phase 18

Les leçons 6-10 décrivent la menace et le paradigme défensif sous l'hypothèse que U est peu fiable. La leçon 11 est le paradigme offensif: rendre le surveillant assez fort pour vérifier l'alignement de U. Les leçons 12-16 se tournent ensuite vers l'outillage pratique de l'évaluation adversitaire.

```figure
scalable-oversight
```

## Utilisez-le

`code/main.py`Simulation de l'étiquetage W2SG sur une tâche synthétique. un étiquetage faible a une précision de 70% avec des erreurs structurées; un modèle fort a un plafond de 95% sur des étiquettes en or. Vous étiquettez le modèle fort sur des étiquettes faibles, mesurez le PGR et comparez avec le modèle fort sur l'or et le modèle faible seul.

## La faire partir

Cette leçon produit `outputs/skill-w2sg-pgr.md`. En raison d'une description de la configuration de la surveillance, elle identifie le responsable de surveillance faible, le modèle fort, la qualité de la surveillance et compute (ou demande) la RGP. Elle marque si l'affirmation est "faible peut superviser fort" ou "faible + mécanisme de surveillance peut superviser fort".

## Exercices

1. On court .`code/main.py`. Rapporte le PGR pour la faiblesse de précision = 0,60, 0,70, 0,80. Expliquez la forme de la courbe du PGR.

2. Modifier l'étiquetateur faible pour qu'il ait une erreur structurée (par exemple, toujours incorrecte sur une classe d'entrée spécifique).

3. Lisez Burns et coll. 2023 Section 4.3 (Tâches de PNL). Reproduire l'intuition de "perte de confiance auxiliaire": lorsque le modèle fort est plus confiant que les étiquettes faibles, qui gagne?

4. Conceptez un protocole de surveillance évolutif qui combine le débat et la décomposition des tâches pour une tâche de génie logiciel. Nommez un mode d'échec de chaque composant et expliquez comment la combinaison s'adresse ou ne s'y parvient pas.

5. Expliquez ce qui pourrait falsifier l'affirmation selon laquelle "la généralisation faible à forte est une voie viable vers la suralignement".

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Scalable oversight | "making the overseer stronger" | Mechanisms that increase an overseer's ability to evaluate a more-capable model |
| W2SG | "weak supervises strong" | Fine-tuning a strong model on weak labels and measuring the capability recovered |
| PGR | "performance gap recovered" | (fine-tuned - weak) / (ceiling - weak); 1.0 = fully closed, 0 = no help |
| Debate | "two U instances argue" | Scalable oversight mechanism where a weak judge picks between two U defenders |
| RRM | "recursive reward modeling" | U helps train the reward model for U+1; overseer capability tracks U |
| Task decomposition | "sub-tasks the human checks" | Break a hard task into sub-tasks the human can verify, recursively |
| Superalignment | "aligning superhuman AI" | The research agenda concerned with aligning models the human cannot directly evaluate |

## Pour en savoir plus

- [Burns et al. — Weak-to-Strong Generalization (OpenAI 2023)](https://openai.com/index/weak-to-strong-generalization/) le papier W2SG
- [Irving, Christiano, Amodei — AI safety via debate (arXiv:1805.00899)](https://arxiv.org/abs/1805.00899) le mécanisme de débat
- [Leike et al. — Scalable agent alignment via reward modeling (arXiv:1811.07871)](https://arxiv.org/abs/1811.07871) Modélisation récursive de la récompense
- [Khan et al. — Debating with More Persuasive LLMs Leads to More Truthful Answers (arXiv:2402.06782)](https://arxiv.org/abs/2402.06782) 2024 étude empirique du débat avec des débatteurs plus forts
- [Lang et al. — Debate Helps Weak-to-Strong Generalization (arXiv:2501.13124)](https://arxiv.org/abs/2501.13124) 2025 combinaison de débats + W2SG
