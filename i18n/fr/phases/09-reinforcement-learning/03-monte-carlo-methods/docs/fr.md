# Les méthodes de Monte Carlo  Apprendre des épisodes complets

> La programmation dynamique a besoin d'un modèle. Monte Carlo n'a besoin que d'épisodes. Exécutez la politique, regardez les rendements, les moyenniez. L'idée la plus simple dans RL  et celle qui déverrouille tout en aval.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming)
**Time:** ~75 minutes

## Le problème

La programmation dynamique est élégante, mais elle suppose que vous pouvez demander $P(s' \mid s, a)$Un robot ne peut pas calculer analytiquement la distribution sur les pixels de la caméra après un couple commun. Un algorithme de prix ne peut pas s'intégrer sur chaque réaction possible du client. Un LLM ne peut pas énumérer toutes les continuations possibles après un jeton.

Vous avez besoin d'une méthode qui ne nécessite que la capacité de *prendre des échantillons* de l'environnement.`s_0, a_0, r_1, s_1, a_1, r_2, …, s_T`- Utilisez-le pour estimer les valeurs.

Le changement de DP à MC est philosophiquement important: nous passons de * modèle connu + sauvegarde exacte * à * déploiements échantillonnés + retour moyen*. La variance augmente, mais l'applicabilité explose. Chaque algorithme RL après cette leçon  TD, Q-learning, REINFORCE, PPO, GRPO  est un estimateur de Monte Carlo au cœur, parfois avec le démarrage en couches en haut.

## Le concept

![Monte Carlo: rollout, compute returns, average; first-visit vs every-visit](../assets/monte-carlo.svg)

**The core idea, in one line:** $V^\pi(s) = \mathbb E_\pi[G_t \mid s_t = s] \approx (1/N) \sum_i G^{(i)}(s)$où $G^{(i)}(s)$Les résultats observés sont les suivants:$s$dans le cadre de la politique $\pi$- Je suis désolé .

**First-visit vs every-visit MC.**Vu un épisode qui visite l' état $s$Plusieurs fois, le premier MC de visite ne compte que le retour de la première visite; chaque MC de visite compte toutes les visites. Le MC de première visite est impartial. Chaque MC de visite peut être légèrement biaisé après un nombre fini d'épisodes, car il moyenne un nombre aléatoire de retours par épisode et ce nombre peut être corrélé avec les retours, mais les deux convergent à $V^\pi(s)$La première visite est plus simple à analyser (échantillons d'iid). Chaque visite utilise plus de données par épisode et converge généralement plus rapidement dans la pratique.

**Incremental mean.**Au lieu de stocker tous les retours, mettre à jour la moyenne courante:

```math
V_n(s) = V_{n-1}(s) + (1/n) [G_n - V_{n-1}(s)]
```

Réorganiser: $V_{\text{new}} = V_{\text{old}} + \alpha \cdot (\text{target} - V_{\text{old}})$avec $\alpha = 1/n$- Échangez .$1/n$pour une taille de marge constante $\alpha \in (0, 1)$et vous obtenez un estimateur MC non-stationnaire qui suit les changements dans $\pi$Ce mouvement est le saut de MC à TD à tous les algorithmes RL modernes.

**Exploration is now a problem.**Le DP a touché chaque État par l'enregistrement.$\pi$Les données de l'espace de l'état ne sont jamais échantillonnées et leurs estimations de valeur restent à zéro pour toujours.

1. **Exploring starts.**Commencez chaque épisode à partir d'une paire aléatoire (s, a). Garantit la couverture; irréaliste dans la pratique (vous ne pouvez pas "réinitialiser" un robot dans un état arbitraire).
2. **ε-greedy.**Agissez avide avec le courant Q, mais avec la probabilité $\epsilon$Toutes les paires d'actions d'état sont échantillonnées de manière asymptotique.
3. **Off-policy MC.**Rassembler des données dans le cadre d' une politique de comportement $\mu$, apprendre sur la politique cible $\pi$La variance est élevée, mais c'est le pont vers des méthodes de tampon de répétition comme DQN.

**Monte Carlo Control.**Évaluer → améliorer → évaluer, tout comme l'itération de la politique, mais l'évaluation est basée sur l'échantillonnage:

1. On court .$\pi$- Je vais vous faire un épisode.
2. Mise à jour $Q(s, a)$à partir des résultats observés.
3. Faites-le$\pi$É-coupard de l'argent.$Q$- Je suis désolé .
4. Je répète.

Converge à $Q^{\ast}$et $\pi^{\ast}$avec probabilité 1 dans des conditions douces (toutes les paires ont été visitées de façon infinie,$\alpha$Il est satisfait de Robbins-Monro.

```figure
epsilon-greedy
```

## Faites-le

### Étape 1: déploiement → liste de (s, a, r)

```python
def rollout(env, policy, max_steps=200):
    trajectory = []
    s = env.reset()
    for _ in range(max_steps):
        a = policy(s)
        s_next, r, done = env.step(s, a)
        trajectory.append((s, a, r))
        s = s_next
        if done:
            break
    return trajectory
```

Pas de modèle, seulement.`env.reset()`et `env.step(s, a)`- La même interface qu'un environnement de gym, mais dépouillée.

### Étape 2: retour de calcul (soufflement inverse)

```python
def returns_from(trajectory, gamma):
    returns = []
    G = 0.0
    for _, _, r in reversed(trajectory):
        G = r + gamma * G
        returns.append(G)
    return list(reversed(returns))
```

Une passe,$O(T)$La récurrence en arrière .$G_t = r_{t+1} + \gamma G_{t+1}$évitent de recommencer à la somme.

### Étape 3: évaluation du MC lors de la première visite

```python
def mc_policy_evaluation(env, policy, episodes, gamma=0.99):
    V = defaultdict(float)
    counts = defaultdict(int)
    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for t, ((s, _, _), G) in enumerate(zip(trajectory, returns)):
            if s in seen:
                continue
            seen.add(s)
            counts[s] += 1
            V[s] += (G - V[s]) / counts[s]
    return V
```

Trois lignes font le travail: marquer l'état vu lors de la première visite, le nombre de points, la moyenne de mise à jour.

### Étape 4: contrôle de MC avide (sur la politique)

```python
def mc_control(env, episodes, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    counts = defaultdict(lambda: {a: 0 for a in ACTIONS})

    def policy(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        trajectory = rollout(env, policy)
        returns = returns_from(trajectory, gamma)
        seen = set()
        for (s, a, _), G in zip(trajectory, returns):
            if (s, a) in seen:
                continue
            seen.add((s, a))
            counts[s][a] += 1
            Q[s][a] += (G - Q[s][a]) / counts[s][a]
    return Q, policy
```

### Étape 5: comparer avec le standard d'or DP

Votre estimation du MC de $V^\pi$En pratique, 50 000 épisodes sur 4×4 GridWorld vous permettent de vous intégrer dans la série.`~0.1`de la réponse du DP.

## Les pièges

- **Infinite episodes.**MC a besoin d'épisodes pour *cesser*. Si votre politique peut boucle pour toujours, cap `max_steps`GridWorld avec une politique aléatoire, il faut compter correctement.
- **Variance.**MC utilise des retours complets. sur les longs épisodes, la variance est énorme  une récompense malchanceuse à la fin des tours $V(s_0)$Les méthodes TD (Lesson 04) réduisent ce nombre en le démarrant.
- **State coverage.**Un MC avide sur un Q frais avec des liens n'essaie qu'une seule action.
- **Non-stationary policies.**Si vous$\pi$Les résultats de l'analyse de l'échantillon sont basés sur des données de référence, et les résultats de l'échantillon sont basés sur des données de référence.
- **Off-policy importance sampling.**Les poids .$\pi(a \mid s)/\mu(a \mid s)$La variance explose avec l'horizon.

## Utilisez-le

Le rôle des méthodes de Monte Carlo en 2026:

| Use case | Why MC |
|----------|--------|
| Short-horizon games (blackjack, poker) | Episodes terminate naturally; returns are clean. |
| Offline evaluation of a logged policy | Average discounted returns over stored trajectories. |
| Monte Carlo Tree Search (AlphaZero) | MC rollouts from tree leaves guide selection. |
| LLM RL evaluation | Compute average reward over sampled completions for a given policy. |
| Baseline estimation in PPO | The advantage target $A_t = G_t - V(s_t)$ uses an MC $G_t$. |
| Teaching RL | Simplest algorithm that actually works — strip bootstrapping to see the core. |

Les algorithmes modernes de profondeur de RL (PPO, SAC) interpolent entre MC pur (rendement complet) et TD pur (bootstrap à un pas) via $n$Les deux points de fin sont des instances du même estimateur.

## La faire partir

- Je ne sais pas .`outputs/skill-mc-evaluator.md`- Le numéro de la liste:

```markdown
---
name: mc-evaluator
description: Evaluate a policy via Monte Carlo rollouts and produce a convergence report with DP-comparison if available.
version: 1.0.0
phase: 9
lesson: 3
tags: [rl, monte-carlo, evaluation]
---

Given an environment (episodic, with reset+step API) and a policy, output:

1. Method. First-visit vs every-visit MC. Reason.
2. Episode budget. Target number, variance diagnostic, expected standard error.
3. Exploration plan. ε schedule (if needed) or exploring starts.
4. Gold-standard comparison. DP-optimal V* if tabular; otherwise a bound from a Q-learning / PPO baseline.
5. Termination check. Max-step cap, timeouts, handling of non-terminating trajectories.

Refuse to run MC on non-episodic tasks without a finite horizon cap. Refuse to report V^π estimates from fewer than 100 episodes per state for tabular tasks. Flag any policy with zero-variance actions as an exploration risk.
```

## Exercices

1. **Easy.**Mettre en œuvre une évaluation MC de la politique uniforme au hasard lors de la première visite sur 4×4 GridWorld.$V(0,0)$en fonction du nombre d'épisodes par rapport à la réponse du DP.
2. **Medium.**Implémenter le contrôle de l' MC avec $\epsilon \in \lbrace 0.01, 0.1, 0.3 \rbrace$Comparer le retour moyen après 20 000 épisodes.
3. **Hard.**Implementer des MC "extra-politiques" avec échantillonnage d'importance: collecter des données dans le cadre d'une politique uniforme et aléatoire $\mu$, estimation $V^\pi$pour la politique déterministe optimale $\pi$Comparer l'IS simple par rapport à l'IS par décision par rapport à l'IS pondéré.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Monte Carlo | "Random sampling" | Estimate expectations by averaging over iid samples from the distribution. |
| Return $G_t$ | "Future reward" | Sum of discounted rewards from step $t$ to episode end: $\sum_{k\ge 0} \gamma^k r_{t+k+1}$. |
| First-visit MC | "Count each state once" | Only the first visit in an episode contributes to the value estimate. |
| Every-visit MC | "Use all visits" | Every visit contributes; slightly biased for finite samples, consistent in the limit, and more sample-efficient. |
| ε-greedy | "Exploration noise" | Pick greedy action with prob $1-\epsilon$; random action with prob $\epsilon$. |
| Importance sampling | "Correcting for sampling from the wrong distribution" | Reweight returns by $\pi(a \mid s)/\mu(a \mid s)$ products to estimate $V^\pi$ from $\mu$ data. |
| On-policy | "Learn from my own data" | Target policy = behavior policy. Vanilla MC, PPO, SARSA. |
| Off-policy | "Learn from someone else's data" | Target policy ≠ behavior policy. Importance-sampled MC, Q-learning, DQN. |

## Pour en savoir plus

- [Sutton & Barto (2018). Ch. 5 — Monte Carlo Methods](http://incompleteideas.net/book/RLbook2020.pdf) le traitement canonique.
- [Singh & Sutton (1996). Reinforcement Learning with Replacing Eligibility Traces](https://link.springer.com/article/10.1007/BF00114726) analyse de la première visite par rapport à chaque visite.
- [Precup, Sutton, Singh (2000). Eligibility Traces for Off-Policy Policy Evaluation](http://incompleteideas.net/papers/PSS-00.pdf) MC et contrôle des variantes hors politique.
- [Mahmood et al. (2014). Weighted Importance Sampling for Off-Policy Learning](https://arxiv.org/abs/1404.6362) estimateurs IS modernes à faible variance.
- [Tesauro (1995). TD-Gammon, A Self-Teaching Backgammon Program](https://dl.acm.org/doi/10.1145/203330.203343) la première démonstration empirique à grande échelle du jeu de MC/TD convergeant au jeu surhumain; précurseur conceptuel de chaque leçon dans la seconde moitié de cette phase.
