# RL à plusieurs agents

> L'agent unique RL suppose que l'environnement est stationnaire. Mettre deux agents d'apprentissage dans le même monde et cette hypothèse est cassée: chaque agent fait partie de l'environnement de l'autre, et les deux changent.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 04 (Q-learning), Phase 9 · 06 (REINFORCE), Phase 9 · 07 (Actor-Critic)
**Time:** ~45 minutes

## Le problème

Un robot apprenant à naviguer dans une pièce est un problème de RL d'agent unique. Une équipe de football n'est pas. Les adversaires AlphaStar vs StarCraft ne le sont pas. Un marché d'agents d'appel d'offres n'est pas. Deux voitures négociant un arrêt à quatre voies ne le sont pas. Beaucoup de problèmes sur beaucoup dans le monde réel ne le sont pas.

Dans chaque contexte multi-agents, du point de vue d'un agent, les autres agents font partie de l'environnement. Au fur et à mesure qu'ils apprennent et changent de comportement, l'environnement devient non-stagnant. La propriété Markov  "l'état suivant dépend uniquement de l'état actuel et de mon action"  est violée parce que l'état suivant dépend également de ce que les *autres* agents ont choisi, et leurs politiques sont des cibles en mouvement.

Cela casse les preuves de convergence tabulaire (la garantie de Q-learning suppose un environnement stationnaire). Il casse également la RL profonde naïve: les agents se poursuivent dans des boucles, ne convergent jamais vers une politique stable.

2026 applications: essaims de robots, routage de la circulation, flottes de véhicules autonomes, simulateurs de marché, systèmes de gestion de la gestion des risques multi-agents (phase 16), et tout jeu avec plus d'un joueur intelligent.

## Le concept

![Four MARL regimes: indep, centralized critic, self-play, league](../assets/marl.svg)

**Formalism: Markov Game.**Une généralisation du MDP: États $S$, une action commune $a = (a_1, \ldots, a_n)$, transition $P(s' \mid s, a)$, et récompenses par agent $R_i(s, a, s')$- Chaque agent .$i$maximiser son propre rendement dans le cadre de sa propre politique $\pi_i$Si les récompenses sont identiques, c'est le cas.**fully cooperative**Si c'est une somme nulle, c'est ça.**adversarial**Si elle est mélangée, elle est.**general-sum**- Je suis désolé .

**Core challenges:**

- **Non-stationarity.** $P(s' \mid s, a_i)$de l' agent $i$La vue dépend de $\pi_{-i}$, ce qui change.
- **Credit assignment.**Avec une récompense partagée, quel agent l'a causé ?
- **Exploration coordination.**Les agents doivent explorer des stratégies complémentaires, pas redondamment explorer le même état.
- **Scalability.**L' espace d' action commune augmente de façon exponentielle en $n$- Je suis désolé .
- **Partial observability.**Chaque agent ne voit que sa propre observation; l'état mondial est caché.

**Four dominant regimes:**

**1. Independent Q-learning / independent PPO (IQL, IPPO).**Chaque agent apprend sa propre Q ou politique, traitant les autres comme faisant partie de l'environnement. Simple, parfois cela fonctionne (surtout avec une répétition de l'expérience agissant comme un truc de modélisation d'agent de lissage). Convergence théorique: aucune.

**2. Centralized training, decentralized execution (CTDE).**Le paradigme moderne le plus courant.$\pi_i$que les conditions de l' observation locale $o_i$ exécution standard décentralisée au déploiement.$Q(s, a_1, \ldots, a_n)$Les conditions relatives à l'état global complet et à l'action commune.
- **MADDPG**(Lowe et coll. 2017): DDPG avec un critique centralisé par agent.
- **COMA**(Foerster et coll. 2017): base contrefactuelle  demandez " quelle aurait été ma récompense si j'avais pris des mesures $a'$"  isole ma contribution.
- **MAPPO**- Je suis là .**IPPO**avec critique partagée (Yu et coll. 2022): PPO avec une fonction de valeur centralisée.
- **QMIX**(Rashid et coll. 2018): décomposition de la valeur  $Q_{\text{tot}}(s, a) = f(Q_1(s, a_1), \ldots, Q_n(s, a_n))$avec un mélange monotone.

**3. Self-play.**Deux copies du même agent se jouent. La politique de l'adversaire *est* ma politique d'un instantané passé. AlphaGo / AlphaZero / MuZero. OpenAI Five. Fonctionne mieux pour les jeux à somme nulle; le signal d'entraînement est symétrique.

**4. League play.**Une extension du jeu à des environnements généraux / adversitaires: conserver une population de politiques passées et actuelles, échantillonner un adversaire de la ligue, s'entraîner contre eux. Ajout d'exploitants (spécialisés dans la battre le meilleur actuel) et d'exploitants principaux (spécialisés dans la battre des exploitants). AlphaStar (StarCraft II). Nécessaire lorsque le jeu admet des cycles de stratégie "rock-paper-scissors".

**Communication.**Permettez aux agents d' envoyer des messages apprentis .$m_i$Foerster et coll. (2016) ont montré que la communication interagent différenciable peut être formée de bout en bout. Les systèmes multi-agents basés sur le LLM d'aujourd'hui (phase 16) communiquent essentiellement en langage naturel.

```figure
f3-marl-orbit
```

## Faites-le

Cette leçon utilise un 6×6 GridWorld avec deux agents coopératifs. Ils commencent dans des coins opposés et doivent atteindre un objectif commun. Récompense partagée:`-1`par étape pendant que l'un des agents est toujours en mouvement,`+10`Quand ils arriveront tous les deux.`code/main.py`- Je suis désolé .

### Étape 1: l'environnement multi-agent

```python
class CoopGridWorld:
    def __init__(self):
        self.size = 6
        self.goal = (5, 5)

    def reset(self):
        return ((0, 0), (5, 0))  # two agents

    def step(self, state, actions):
        a1, a2 = state
        new1 = move(a1, actions[0])
        new2 = move(a2, actions[1])
        done = (new1 == self.goal) and (new2 == self.goal)
        reward = 10.0 if done else -1.0
        return (new1, new2), reward, done
```

L'espace d'action commun est `|A|² = 16`L'état mondial est de deux positions.

### Étape 2: apprentissage Q indépendant

Chaque agent exécute sa propre table Q sur l'état commun. À chaque étape: choisir les actions ε-avides, collecter la transition commune, chaque mise à jour de son propre Q avec la récompense partagée.

```python
def independent_q(env, episodes, alpha, gamma, epsilon):
    Q1, Q2 = defaultdict(default_q), defaultdict(default_q)
    for _ in range(episodes):
        s = env.reset()
        done = False
        while not done:
            a1 = epsilon_greedy(Q1, s, epsilon)
            a2 = epsilon_greedy(Q2, s, epsilon)
            s_next, r, done = env.step(s, (a1, a2))
            if done:
                Q1[s][a1] += alpha * (r - Q1[s][a1])
                Q2[s][a2] += alpha * (r - Q2[s][a2])
                break
            target1 = r + gamma * max(Q1[s_next].values())
            target2 = r + gamma * max(Q2[s_next].values())
            Q1[s][a1] += alpha * (target1 - Q1[s][a1])
            Q2[s][a2] += alpha * (target2 - Q2[s][a2])
            s = s_next
```

Il travaille sur cette tâche parce que les récompenses sont denses et alignées.

### Étape 3: Q centralisé avec mise à jour de la valeur décomposée

Utilisez un Q au lieu d' actions conjointes $Q(s, a_1, a_2)$- Mise à jour à partir de la récompense partagée. Décentraliser à l'exécution en marginalisant:$\pi_i(s) = \arg\max_{a_i} \max_{a_{-i}} Q(s, a_1, a_2)$. Échange d'espace d'action commun exponentiel pour une vision globale *correcte*

### Étape 4: simple jeu d'auto (agent adversaire 2)

Le même agent, deux rôles.$K$Les épisodes, copier les poids d'A en B. Formation symétrique, progression constante.

## Les pièges

- **Non-stationary replay.**La répétition de l'expérience avec des agents indépendants est pire que le simple agent parce que les anciennes transitions ont été générées par des adversaires désormais obsolètes.
- **Credit assignment ambiguity.**Récompense partagée après un long épisode; aucun moyen clair de dire quel agent a contribué.
- **Policy drift / chasing.**La meilleure réponse de chaque agent change avec la mise à jour de l'autre.
- **Reward hacking via coordination.**Les agents trouvent des exploits coordonnés que le concepteur n'a pas anticipés. Les agents d'enchères convergent pour offrir zéro.
- **Exploration redundancy.**Les deux agents explorent les mêmes paires d'actions d'état.
- **League cycles.**Le jeu pur peut se retrouver dans un cycle de domination.
- **Sample explosion.** `n`Les agents × espace d'état × actions conjointes. Approximation avec approximation de fonction; espaces d'action facteurés (un chef de sortie de politique par agent).

## Utilisez-le

La carte des demandes MARL 2026:

| Domain | Method | Notes |
|--------|--------|-------|
| Cooperative navigation / manipulation | MAPPO / QMIX | CTDE; shared critic + decentralized actors. |
| Two-player games (chess, Go, poker) | Self-play with MCTS (AlphaZero) | Zero-sum; symmetric training. |
| Complex multiplayer (Dota, StarCraft) | League play + imitation pretraining | OpenAI Five, AlphaStar. |
| Autonomous-vehicle fleets | CTDE MAPPO / PPO with attention | Partial obs; variable team sizes. |
| Auction markets | Game-theoretic equilibrium + RL | Mean-field RL when `n` → ∞. |
| LLM multi-agent systems (Phase 16) | Natural-language comm + role conditioning | RL loop at the agent-planning layer. |

En 2026, le domaine de croissance le plus important de MARL est basé sur le MLL: des essaims d'agents de modèle linguistique négociant, débattant, construisant des logiciels.

## La faire partir

- Je ne sais pas .`outputs/skill-marl-architect.md`- Le numéro de la liste:

```markdown
---
name: marl-architect
description: Pick the right multi-agent RL regime (IPPO, CTDE, self-play, league) for a given task.
version: 1.0.0
phase: 9
lesson: 10
tags: [rl, multi-agent, marl, self-play]
---

Given a task with `n` agents, output:

1. Regime classification. Cooperative / adversarial / general-sum. Justify.
2. Algorithm. IPPO / MAPPO / QMIX / self-play / league. Reason tied to coupling tightness and reward structure.
3. Information access. Centralized training (what global info goes to the critic)? Decentralized execution?
4. Credit assignment. Counterfactual baseline, value decomposition, or reward shaping.
5. Exploration plan. Per-agent entropy, population-based training, or league.

Refuse independent Q-learning on tightly-coupled cooperative tasks. Refuse to recommend self-play for general-sum with cycle risks. Flag any MARL pipeline without a fixed-opponent eval (cherry-picked self-play numbers are common).
```

## Exercices

1. **Easy.**Prenez l'apprentissage indépendant de Q sur la coopérative GridWorld. Combien d'épisodes jusqu'à ce que le retour moyen > 0?
2. **Medium.**Ajouter une tâche de "coordination": l'objectif n'est atteint que lorsque les deux agents y arrivent sur le même virage.
3. **Hard.**Mettre en œuvre un critère centralisé pour la formation de type MAPPO et comparer la vitesse de convergence à la vitesse de PPO indépendante sur la tâche de coordination.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Markov game | "Multi-agent MDP" | $(S, A_1, \ldots, A_n, P, R_1, \ldots, R_n)$; each agent has its own reward. |
| CTDE | "Centralized training, decentralized execution" | Joint critic at training time; each agent's policy uses only local obs. |
| IPPO | "Independent PPO" | Each agent runs PPO separately. Simple baseline; often underrated. |
| MAPPO | "Multi-agent PPO" | PPO with a centralized value function conditioned on global state. |
| QMIX | "Monotonic value decomposition" | $Q_{\text{tot}} = f_{\text{monotone}}(Q_1, \ldots, Q_n)$ allows decentralized argmax. |
| COMA | "Counterfactual multi-agent" | Advantage = my Q minus expected Q marginalizing over my action. |
| Self-play | "Agent vs past self" | Single agent, two roles; standard for zero-sum games. |
| League play | "Population training" | Cache past policies, sample opponents from the pool; handles strategy cycles. |

## Pour en savoir plus

- [Lowe et al. (2017). Multi-Agent Actor-Critic for Mixed Cooperative-Competitive Environments (MADDPG)](https://arxiv.org/abs/1706.02275) CTDE avec un critique centralisé.
- [Foerster et al. (2017). Counterfactual Multi-Agent Policy Gradients (COMA)](https://arxiv.org/abs/1705.08926) contrefactuelles de base pour l'attribution de crédit.
- [Rashid et al. (2018). QMIX: Monotonic Value Function Factorisation](https://arxiv.org/abs/1803.11485) décomposition de la valeur avec monotonie.
- [Yu et al. (2022). The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games (MAPPO)](https://arxiv.org/abs/2103.01955)La PPO est étonnamment forte pour MARL.
- [Vinyals et al. (2019). Grandmaster level in StarCraft II using multi-agent reinforcement learning (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z) jeu de ligue à l'échelle.
- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270) pure jeu d'auto dans les jeux à somme nulle.
- [Sutton & Barto (2018). Ch. 15 — Neuroscience & Ch. 17 — Frontiers](http://incompleteideas.net/book/RLbook2020.pdf) comprend le traitement court du manuel des paramètres multi-agents et le problème de non-stationarité que le CTDE est conçu pour résoudre.
- [Zhang, Yang & Başar (2021). Multi-Agent Reinforcement Learning: A Selective Overview](https://arxiv.org/abs/1911.10635) enquête portant sur les LMR coopératives, compétitives et mixtes avec des résultats de convergence.
