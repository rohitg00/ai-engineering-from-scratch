# Optimisation des effectifs de l'équipe pour les LLM (PSO, ACO)

> L'optimisation bio-inspirée fait un retour à la maîtrise de la loi. **LMPSO**(arXiv:2504.09247) utilise PSO où la vitesse de chaque particule est un prompt et le LLM génère le candidat suivant; fonctionne bien sur les sorties de séquences structurées (expressions mathématiques, programmes). **Model Swarms**(arXiv:2410.11163) traite chaque expert LLM comme une particule PSO sur un modèle-poids variété et rapports **13.3% average gain**plus de 12 lignes de base sur 9 ensembles de données avec seulement 200 instances. **SwarmPrompt**(ICAART 2025) hybride PSO + Grey Wolf pour une optimisation rapide. **AMRO-S**(arXiv:2603.12933) est un spécialiste des phéromones inspiré par l'ACO pour le parcours LLM multi-agent  **4.7x speedup**Cette leçon met en œuvre le PSO sur l'espace paramétrique rapide et le ACO sur l'itinérance des agents, mesure pourquoi ces algorithmes classiques correspondent à l'ère du LLM et quand ils ne le font pas.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 09 (Parallel Swarm Networks), Phase 16 · 14 (Consensus and BFT)
**Time:** ~75 minutes

## Problème

Vous avez un prompt qui marque 62% sur votre évaluation de tâche. Vous voulez l'améliorer. Le mouvement naïf est le tweaking manuel sans gradient, qui évolue mal. L'apprentissage du renforcement a besoin de signaux de récompense et de déploiements suffisants pour s'entraîner. Backprop à travers les prompt n'est pas vraiment possible  le prompt est une chaîne discrète, pas un paramètre différenciable.

L'optimisation classique bio-inspirée  PSO pour les espaces de recherche continus, ACO pour la sélection de chemin  a été conçue exactement pour ce régime: sans gradient, basé sur la population, bon marché par évaluation.

Les mêmes schémas s'appliquent au routage des agents dans les systèmes multi-agents. Un phéromone de type ACO enregistre la piste de l'agent qui a travaillé le mieux sur quel type de tâche, permet au routeur d'exploiter la piste et décompose les phéromones afin que les routes puissent être redécouvertes.

## Concept

### Récupération de l'OPS (Kennedy & Eberhart 1995)

Optimisation de l'accumulation de particules: population de particules dans un espace de recherche continu.`x_i`et la vitesse `v_i`- Chaque itération:

```
v_i <- w * v_i + c1 * r1 * (p_best_i - x_i) + c2 * r2 * (g_best - x_i)
x_i <- x_i + v_i
evaluate fitness(x_i)
update p_best_i if improved
update g_best if global best
```

Où ?`p_best`est le meilleur de la particule,`g_best`est le meilleur de swarm, `w, c1, c2`sont l'inertie + les poids cognitifs + les poids sociaux, `r1, r2`sont des facteurs aléatoires.

### PSO sur les résultats de la LLM  LMPSO

Le programme d'exécution de la vitesse est un programme de détection de la vitesse de détection de la vitesse. le programme d'exécution de la vitesse est un programme de détection de la vitesse de détection de la vitesse.

Cela fonctionne bien lorsque:
- La sortie est structurée (perçable, évaluable).
- La condition physique est automatique (expérience, évaluation arithmétique).
- La population est petite (~10-30 particules) et les appels LLM totaux restent gérables.

Il ne fonctionne pas bien lorsque la forme physique a besoin d'un examen humain  le coût de la réitération devient prohibitif.

### Des essaims modèles

Le nombre de particules est de 12 lignes de base sur 9 ensembles de données, avec seulement 200 instances par itération.

L'idée clé est que les modèles experts de la LLM sont déjà proches dans un variété de paramètres partagés (poids d'adaptateur, delta de LoRA).

### Récupération de l'ACO (Dorigo 1992)

Optimisation de la colonie de fourmis: les fourmis traversent un graphique; chaque chemin a une trace de phéromones. Les fourmis déplacent les probabilités de poids par la force des phéromones. Les fourmis qui terminent la tâche déposent des phéromones proportionnellement à la qualité de la solution. Les phéromones se décomposent avec le temps.

### AMRO-S  ACO pour le routage des agents

Le phéromone est un phéromone qui renforce les routes qui produisent de bons résultats.

- **Interpretable routing evidence.**La force des phéromones est un signal lisible par l'homme.
- **Quality-gated asynchronous update.**Les phéromones ne se mettent à jour qu'après la réussite des contrôles de qualité, déconnectant les inférences de l'apprentissage.
- **4.7x speedup**sur le point de référence de routage multi-agents.

La qualité est importante: sans elle, les agents rapides mais mal conçus accumulent des phéromones, et le système s'enferme sur de mauvaises voies.

### Quand utiliser le PSO / ACO pour les LLM

**Use PSO when:**
- L'espace de recherche est continu ou des cartes à des paramètres continu (embeddings de prompt, poids LoRA, paramètres de génération numérique).
- Le fitness est bon marché et automatique.
- La population peut être petite (10-30).

**Use ACO when:**
- Vous avez un problème de routage ou de sélection de chemin.
- Les décisions se renforcent au fil du temps (les mêmes types de tâches reviennent).
- Vous avez besoin de preuves interprétables pour les décisions de routage.

**Do not use either when:**
- La forme physique nécessite une révision humaine (trop coûteuse par itération).
- L'espace de recherche est discrète et combinatoire de manière à ne pas être couvert par le PSO (utiliser des algorithmes génétiques à la place).
- Les décisions en temps réel nécessitent une latence stricte (convergence PSO/ACO lentement par rapport aux heuristiques à passage unique).

### Pourquoi l'inspiration biologique gagne toujours

Les méthodes basées sur les gradients ont besoin de signaux différenciables. Les résultats du LLM et les décisions de routage ne sont pas trivialement différenciables.

PSO et ACO n'ont besoin que d'une fonction d'évaluation. Si vous pouvez marquer une sortie de candidat ou une décision de routage, vous pouvez optimiser l'espace. Cela rend la barre d'applicabilité beaucoup plus faible.

### Limits pratiques

- **Population budget.**N particules × T itérations × coût par éval. Pour les évaluations LLM à ~$0.02 / call, a 20-particle PSO running 50 iterations costs ~$20 - Planifiez en conséquence.
- **Exploration vs exploitation.**Le taux de décomposition des phéromones et l'inertie de l'OPS se décompensent; décomposition trop rapide → oubli de solutions; trop lent → collé à l'optima locale précoce.
- **Catastrophic drift.**Les deux algorithmes peuvent converger et ensuite diverger si le paysage de la condition physique change (nouvelle distribution de données).

```figure
swarm-stigmergy
```

## Faites-le

`code/main.py`les implémentations:

- `LMPSO` PSO sur les paramètres numériques de prompt (température, poids top_k). La "génération LLM" de chaque particule est simulée comme une fonction de conditionnement scriptée.
- `AMRO_S` Routage à la mode ACO. 3 agents, 4 types de tâches, matrice phéromone, 100 tâches routées.
- Comparaison: routage aléatoire par rapport au routage ACO sur le même flux de tâches. Mesure la qualité et la latence.

Je vais courir .

```
python3 code/main.py
npx tsx code/main.ts
```

Résultats attendus:
- LMPSO: g_best fitness s'améliore de façon aléatoire à presque optimale sur 30 itérations.
- AMRO-S: la table des phéromones se stabilise sur le bon agent par type de tâche; le routage ACO bat au hasard de ~ 30 à 40% sur la qualité et réduit également la latence (moins de retries).

## Utilisez-le

`outputs/skill-swarm-optimizer.md`aide à choisir entre les algorithmes génétiques, les algorithmes de PSO et les optimisateurs basés sur les gradients pour les problèmes d'optimisation de l'agent.

## La faire partir

- **Start small.**10 à 20 particules, 20 à 50 itérations.
- **Log pheromones or g_best per iteration.**Débarrasser les optimisateurs sans trace est douloureux.
- **Quality-gate updates.**Surtout pour le routage ACO: les agents rapides et mal conçus ne doivent pas accumuler de phéromone.
- **Reset decay on distribution shift.**Lorsque la distribution de votre évaluation change, les phéromones vieillissants sont stériles; réinitialisez ou doublons temporairement le taux de décomposition.
- **Cap the per-iteration cost.**Émettez une métrique de coût par itération. PSO qui coûte 500 $ / itération et gagne 0,5% n'est pas expédible.

## Exercices

1. On court .`code/main.py`- Observez la convergence de l'OMPSO. La taille de la population varie 5, 10, 20, 50.
2. La fonction de fitness est modifiée après l'itération 30.`p_best`- Je peux vous aider ?
3. Ajouter une passerelle de qualité à AMRO-S: dépôt de phéromone uniquement sur les courses avec un score d'évaluation > 0,7. Comment cela change-t-il la convergence par rapport à la version non-gérée?
4. Lire LMPSO (arXiv:2504.09247). Mettez la "vitesse comme une demande" du papier à votre vitesse numérique.
5. Lisez AMRO-S (arXiv:2603.12933). Implémenter le " chemin rapide d'inférence " déconnecté avec la mise à jour phéromonique asynchrone. Comment cela change-t-il la latence du système sous charge soutenue ?

## Les termes clés

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| PSO | "Particle Swarm Optimization" | Kennedy-Eberhart 1995. Population-based gradient-free optimizer. |
| ACO | "Ant Colony Optimization" | Dorigo 1992. Path/route optimization via pheromone trails. |
| LMPSO | "PSO with LLM generation" | arXiv:2504.09247. Velocity is a prompt; LLM produces candidates. |
| Model Swarms | "PSO on expert weights" | arXiv:2410.11163. Gradient-free update on model parameter subspace. |
| AMRO-S | "ACO for agent routing" | arXiv:2603.12933. Pheromone matrix over task-type × agent. |
| p_best / g_best | "Personal / global best" | Per-particle and swarm-wide best solutions found so far. |
| Pheromone | "Routing memory" | Strength on an edge; decays over time; deposits on quality. |
| Quality-gated update | "Only learn from good runs" | Pheromone deposit conditioned on quality check. |
| Catastrophic drift | "Distribution shift" | Fitness landscape changes; old p_best and pheromones become stale. |

## Pour en savoir plus

- [Kennedy & Eberhart — Particle Swarm Optimization](https://ieeexplore.ieee.org/document/488968) le document de l'OPS de 1995
- [Dorigo — Ant Colony Optimization](https://www.aco-metaheuristic.org/about.html) Fondations de l'ACO 1992
- [LMPSO — Language Model Particle Swarm Optimization](https://arxiv.org/abs/2504.09247) OPS pour les résultats structurés de la LLM
- [Model Swarms — gradient-free LLM expert optimization](https://arxiv.org/abs/2410.11163) PSO sur le sous-espace de poids de modèle
- [AMRO-S — ant-colony multi-agent routing](https://arxiv.org/abs/2603.12933) routage à phéromone avec passerelle de qualité
