# MARL  MADDPG, QMIX, MAPPO

> L'héritage de la coordination multi-agents, qui continue d'informer les systèmes de MLL-agents en 2026, est renforcé. **MADDPG**(Lowe et coll., NeurIPS 2017, arXiv:1706.02275) introduit la formation centralisée, exécution décentralisée (CTDE): chaque critique voit tous les états et actions des agents pendant la formation; au moment du test, seuls les acteurs locaux sont en cours de fonctionnement.**QMIX**(Rashid et coll., ICML 2018, arXiv:1803.11485) est une décomposition de valeur avec un réseau de mélange monotonique; par agent Qs se combinent en Q commun de sorte que `argmax`distribue de manière nette  dominant sur le défi multi-agents StarCraft (SMAC). **MAPPO**(Yu et al., NeurIPS 2022, arXiv:2103.01955) est un PPO avec une fonction de valeur centralisée; "surprenantement efficace" sur le monde des particules, SMAC, Google Research Football, Hanabi avec un réglage minimal.**default 2026 cooperative-MARL baseline**Cette leçon construit chacun à partir d'un petit jouet de grille-monde et atterrit les trois idées dans la mémoire musculaire avant de toucher à l'entraînement de l'agent LLM.

**Type:** Learn
**Languages:** Python (stdlib, small NumPy-free implementations), TypeScript
**Prerequisites:** Phase 09 (Reinforcement Learning), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~90 minutes

## Problème

Les systèmes de LLM-agent entraînent de plus en plus des politiques de coordination entre les agents: quand reporter, quand agir, qui appeler.

Lire des articles MARL sans le vocabulaire du modèle est douloureux.

- L'apprentissage indépendant est non-stationnaire du point de vue de chaque agent.
- La RL centralisée (un agent contrôle tout) ne fait pas l'échelle et ne respecte pas les contraintes d'exécution.
- CTDE tire le meilleur des deux: entraîne avec des informations mondiales, déploie avec des politiques locales.

## Concept

### Trois environnements utilisés par les journaux

- **Particle World (multi-agent particle env).**Physique 2D simple avec des tâches coopératives/competitives.
- **StarCraft Multi-Agent Challenge (SMAC).**La micro-gestion coopérative, l'observation partielle, le test de QMIX, les actions discrètes, les états continus.
- **Google Research Football, Hanabi, MPE.**Les lignes de base de la carte.

Les différents environnements ont des types d'action/observation différents.

### MADDPG (2017)  le modèle CTDE

Chaque agent .`i`Il a un acteur.`mu_i(o_i)`Il est important de noter que les actions de l'agent sont aussi une critique.`Q_i(x, a_1, ..., a_n)`L'acteur est mis à jour par gradient politique par rapport à l'évaluation du critique.

```
actor update:    grad_theta_i J = E[grad_theta mu_i(o_i) * grad_a_i Q_i(x, a_1..n) at a_i=mu_i(o_i)]
critic update:   TD on Q_i(x, a_1..n) given next-state joint estimate
```

Pourquoi CTDE: au moment de la formation, nous connaissons les actions de chacun; nous utilisons cela pour réduire la variance dans chaque critique.`o_i`et les appels`mu_i(o_i)`- Je suis désolé .

Mode d'échec: les critiques se développent avec N agents (l'entrée comprend toutes les actions).

### QMIX (2018)  décomposition de la valeur

La valeur commune d'action `Q_tot`est une fonction de mélange monotone de Q-values par agent:

```math
Q_{\text{tot}}(\tau, a) = f\big(Q_1(\tau_1, a_1), \ldots, Q_n(\tau_n, a_n)\big), \quad \frac{\partial f}{\partial Q_i} \ge 0
```

La monotonie garantit `argmax_a Q_tot`peut être calculé par chaque agent choisissant `argmax_{a_i} Q_i`- Je ne suis pas d'accord.**exactly the decentralized execution property**En cours de formation, un réseau de mélange produit`Q_tot`du Qs par agent.

Pourquoi QMIX gagne sur SMAC: la micro-gestion coopérative StarCraft a des agents homogènes, des objets locaux, des récompenses mondiales  parfaitement adaptées à la décomposition de la valeur.

Mode d'échec: la contrainte de monotonie est restrictive; certaines tâches ont des structures de récompense qui ne sont pas monotones décomposables (un agent sacrifiant pour l'équipe).

### MAPPO (2022)  le défaut négligé

PPO multi-agent: PPO avec une fonction de valeur centralisée. Chaque agent a sa propre politique; tous les agents partagent (ou ont par agent) des fonctions de valeur qui voient l'état complet. Yu et al. 2022 comparent MAPPO à MADDPG, QMIX et leurs extensions sur cinq critères de référence et trouvent:

- MAPPO correspond ou dépasse les méthodes MARL hors politique sur le monde des particules, SMAC, Google Research Football, Hanabi, MPE.
- Un réglage minimal des hyperparamètres est requis.
- Formation stable; reproduisable à travers les graines.

La communauté a sous-estimé la MARL en politique jusqu'à ce document. En 2026, MAPPO est la ligne de base par défaut pour la MARL coopérative; toute nouvelle méthode doit la battre.

### Pourquoi les ingénieurs de LLM devraient-ils s'en soucier ?

Trois utilisations directes:

1. **Router training.**Un méta-agent choisit quel sous-agent gère une tâche. C'est un problème MARL avec N sous-agents décentralisés et un routeur centralisé.
2. **Role emergence.**Dans les simulations d'agents génératifs, l'adoption de rôles complémentaires au fil du temps est un problème MARL masqué.
3. **Multi-agent tool use.**Lorsque les agents partagent des outils et se disputent le budget, leur formation par l'intermédiaire du CTDE produit des politiques locales déployables qui respectent les contraintes de ressources.

Une mise en garde pratique: en 2026, la plupart des systèmes d'agents de LLM de production prennent en charge leurs politiques plutôt que de les former. MARL intervient lorsque vous avez (a) beaucoup de données d'interaction, (b) un signal de récompense clair et (c) la volonté d'investir dans l'infrastructure de formation.

### CTDE comme modèle de conception au-delà de la RL

Même sans formation, le CTDE est un modèle architectural utile:

- Pendant la conception, assurez-vous que l'équipe est entièrement visible.
- En temps d'exécution, appliquer l'exécution décentralisée: chaque agent ne voit que `o_i`- Je suis désolé .

Le modèle vous oblige à garder l'état par agent explicite et à penser à l'observabilité partielle à l'avance.

### Le problème de la non-stationarité

Lorsque plusieurs agents apprennent simultanément, l'environnement de chaque agent (qui comprend les politiques des autres) est non-stationnaire.

- MADDPG: le critique mondial voit toutes les actions, donc son estimation de valeur est stationnaire.
- QMIX: la décomposition de la valeur déplace l'apprentissage dans un espace de Q commun où l'optimisation est bien définie.
- MAPPO: la fonction de valeur centralisée réduit les variations des changements de politique des autres.

Dans les systèmes d'agents LLM, la non-stationarité se manifeste comme " mon agent a travaillé le mois dernier, maintenant que l'autre agent en amont a changé, la mine se comporte mal. " La formation MARL avec CTDE est la solution de principe; les corrections à niveau rapide sont plus rapides mais moins durables.

### Ce que cette leçon ne couvre PAS

La formation des réseaux réels est un sujet de phase 9. Cette leçon construit des versions de politique scriptées qui démontrent le CTDE, la décomposition de valeur et les modèles de valeur centralisés sans mises à jour de gradient. L'objectif est d'internaliser les modèles avant de récupérer une bibliothèque MARL complète (PyMARL, MARLlib, RLlib multi-agent).

```figure
sw-ctde
```

## Faites-le

`code/main.py`Il met en œuvre trois démonstrations de modèle, toutes sur un petit réseau coopératif de 2 agents:

- Environnement: 2 agents sur une grille 4x4, une pellette de récompense.
- `IndependentAgents` chaque agent traite les autres comme un environnement.
- `MADDPGStyle` un critique centralisé compute une valeur commune; les politiques des acteurs s'y mettent à jour.
- `QMIXStyle` décomposition de la valeur avec un mélangeur monotone.
- `MAPPOStyle` fonction de valeur centralisée; les politiques sont mises à jour par rapport à la ligne de base partagée.

Les quatre épisodes sont identiques et rapportent des étapes moyennes vers l'objectif.

Je vais courir .

```
python3 code/main.py
npx tsx code/main.ts
```

Expérience attendue: les agents indépendants prennent en moyenne ~6 étapes; les variantes CTDE convergent vers ~3.5 étapes (optimale pour la grille 4x4 est 3).

## Utilisez-le

`outputs/skill-marl-picker.md`est une compétence qui choisit un algorithme MARL pour une tâche multi-agents donnée: coopérative vs compétitive, homogène vs hétérogène, type d'espace d'action, échelle, signal de récompense.

## La faire partir

Le MARL en production est rare.

- **Start with MAPPO.**Le document de 2022 a établi cette ligne de base; la reproduction d'abord économise des semaines de poursuite de méthodes plus fantaisistes.
- **Log every agent's observation and action stream.**Détecter le MARL sans traces de l'agent est désespéré.
- **Separate training code from execution code.**Le CTDE est une discipline; laissez le chemin de l'exécution voir vraiment seulement `o_i`- Je suis désolé .
- **Reward shaping warning.**MARL est extrêmement sensible à la conception de récompenses.
- **For LLM agents**En effet, les investissements dans la formation MARL ne sont effectués que lorsque les données d'interaction + le signal de récompense + l'infrastructure sont toutes présentes.

## Exercices

1. On court .`code/main.py`- Mesurer l'écart entre les agents indépendants et les agents de type MAPPO.
2. La mise en œuvre d'une variante concurrentielle: deux agents, une pellette, seul le premier à atteindre reçoit une récompense.
3. Lisez MADDPG (arXiv:1706.02275) Section 3. Implémenter la règle de mise à jour critique exacte symboliquement dans un pseudocode dans vos propres mots.
4. Pourquoi les auteurs affirment-ils que la valeur centralisée + PPO dépasse la MARL hors politique sur leurs critères de référence ?
5. Appliquer CTDE comme modèle de conception à un système hypothétique d'agent LLM (par exemple, agent de recherche + résumé + codeur). Quelles sont les informations communes disponibles au moment de la conception qui ne sont pas disponibles en temps d'exécution?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MARL | "Multi-Agent RL" | Reinforcement learning for multi-agent systems. |
| CTDE | "Centralized Training, Decentralized Execution" | Train with global info; deploy with local policies. |
| MADDPG | "Multi-Agent DDPG" | CTDE with per-agent critic seeing all observations + actions. |
| QMIX | "Value decomposition" | Monotonic mixing of per-agent Qs. Cooperative. |
| MAPPO | "Multi-Agent PPO" | PPO with centralized value function. 2026 default baseline. |
| Value decomposition | "Sum of individual Qs" | Joint Q represented as a monotone function of per-agent Qs. |
| Non-stationarity | "Moving targets" | Each agent's env changes as others learn. The core MARL problem. |
| On-policy / off-policy | "Learn from current / replay" | PPO is on-policy (MAPPO); DDPG and Q-learning are off-policy. |
| SMAC | "StarCraft Multi-Agent Challenge" | Cooperative micromanagement benchmark; QMIX's homegrown ground. |

## Pour en savoir plus

- [Lowe et al. — Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments](https://arxiv.org/abs/1706.02275) MADDPG; NeurIPS 2017
- [Rashid et al. — QMIX: Monotonic Value Function Factorisation for Deep Multi-Agent Reinforcement Learning](https://arxiv.org/abs/1803.11485) QMIX; ICML 2018
- [Yu et al. — The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games](https://arxiv.org/abs/2103.01955) MAPPO; NeurIPS 2022
- [BAIR blog post on MAPPO](https://bair.berkeley.edu/blog/2021/07/14/mappo/) Cadrage lisible du résultat de la MAPPO
- [SMAC repository](https://github.com/oxwhirl/smac) Défi multi-agents StarCraft
