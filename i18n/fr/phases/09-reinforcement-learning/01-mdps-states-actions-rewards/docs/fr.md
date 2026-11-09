# Les PDM, les États, les actions et les récompenses

> Un processus de décision Markov est composé de cinq choses: états, actions, transitions, récompenses, réduction. Tout dans RL  Q-learning, PPO, DPO, GRPO  optimiser sur cette forme. Apprenez-le une fois, lire le reste de l'apprentissage de renforcement gratuitement.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1 · 06 (Probability & Distributions), Phase 2 · 01 (ML Taxonomy)
**Time:** ~45 minutes

## Le problème

Vous écrivez un robot d'échecs, un planificateur d'inventaire, un agent de trading, ou la boucle PPO qui entraîne un modèle de raisonnement, quatre domaines différents, un fait surprenant: les quatre s'effondrent dans le même objet mathématique.

L' apprentissage supervisé vous donne `(x, y)`L'apprentissage de renforcement ne vous donne pas d'étiquettes, seulement un flux d'états, les actions que vous avez prises et une récompense scalaire. La décision de réapprovisionnement a-t-elle économisé de l'argent? le commerce a-t-il fait un profit? le jeton que le LLM vient de produire a-t-il conduit à une récompense plus élevée du juge?

Vous ne pouvez pas apprendre de ce flux avant de le formaliser. "Ce que j'ai vu," "ce que j'ai fait," "ce qui s'est passé ensuite," "combien cela a été bon"  chacun doit devenir un objet que vous pouvez raisonner à propos. Cette formalisation est un processus de décision Markov. Tout algorithme RL dans cette phase, y compris les boucles RLHF et GRPO à la fin, optimise sur cette forme.

## Le concept

![Markov decision process: states, actions, transitions, rewards, discount](../assets/mdp.svg)

**The five objects.**

- **States** $S$Dans GridWorld, la cellule, dans les échecs, le tableau, dans un LLM, la fenêtre contextuelle et toute mémoire.
- **Actions** $A$Les choix, monter/baisser/gauche/droite, jouer un mouvement, émettre un jeton.
- **Transitions** $P(s' \mid s, a)$- Dans l' état actuel .$s$et action $a$Déterministique dans les échecs, stochastique dans l'inventaire, presque déterministe dans le décoding LLM.
- **Rewards** $R(s, a, s')$Le signal scalaire. Le gain = +1, la perte = -1. Retour moins coût.
- **Discount** $\gamma \in [0, 1)$- Combien compte la récompense future par rapport au présent ?$\gamma = 0.99$achète un horizon de ~ 100 étapes; $\gamma = 0.9$Il achète 10 $.

**The Markov property** $P(s_{t+1} \mid s_t, a_t) = P(s_{t+1} \mid s_0, a_0, \ldots, s_t, a_t)$L'avenir ne dépend que de l'état actuel. Si ce n'est pas le cas, la représentation de l'État est incomplète.

**Policies and returns.**Une politique$\pi(a \mid s)$Les cartes indiquent les répartitions d'action.$G_t = r_t + \gamma r_{t+1} + \gamma^2 r_{t+2} + \ldots$est la somme réduite des récompenses futures.$V^\pi(s) = \mathbb{E}[G_t \mid s_t = s]$est le rendement attendu à partir de $s$dans le cadre de la politique $\pi$La valeur Q$Q^\pi(s, a) = \mathbb{E}[G_t \mid s_t = s, a_t = a]$L'algorithme RL évalue l'un de ces deux, puis l'améliore $\pi$En conséquence.

**The Bellman equations.**Les équations à point fixe que tout utilise dans cette phase:

```math
\begin{aligned}
V^\pi(s) &= \sum_a \pi(a \mid s) \sum_{s', r} P(s', r \mid s, a) [r + \gamma V^\pi(s')] \\
Q^\pi(s, a) &= \sum_{s', r} P(s', r \mid s, a) [r + \gamma \sum_{a'} \pi(a' \mid s') Q^\pi(s', a')]
\end{aligned}
```

Ces fractions attendues reviennent en "récompense de cette étape" plus "valeur réduite de l'endroit où vous atterrissez". Récursif. Chaque algorithme de la phase 9 réitère soit cette équation à la convergence (programme dynamique), des échantillons de celle-ci (Monte Carlo), soit le démarre à un pas (différence temporelle).

```figure
discount-horizon
```

## Faites-le

### Étape 1: un petit MDP déterministe

Un 4x4 GridWorld. L'agent commence en haut à gauche, le terminal en bas à droite, récompense de -1 par étape, actions.`{up, down, left, right}`- Vous voyez ?`code/main.py`- Je suis désolé .

```python
GRID = 4
TERMINAL = (3, 3)
ACTIONS = {"up": (-1, 0), "down": (1, 0), "left": (0, -1), "right": (0, 1)}

def step(state, action):
    if state == TERMINAL:
        return state, 0.0, True
    dr, dc = ACTIONS[action]
    r, c = state
    nr = min(max(r + dr, 0), GRID - 1)
    nc = min(max(c + dc, 0), GRID - 1)
    return (nr, nc), -1.0, (nr, nc) == TERMINAL
```

Cinq lignes, c'est l'environnement entier, des transitions déterministes, une pénalité constante, un état terminal absorbant.

### Étape 2: mise en place d'une politique

Une politique est une fonction de la répartition de l'état à l'action.

```python
def uniform_policy(state):
    return {a: 0.25 for a in ACTIONS}

def rollout(policy, max_steps=200):
    s, total, steps = (0, 0), 0.0, 0
    for _ in range(max_steps):
        a = sample(policy(s))
        s, r, done = step(s, a)
        total += r
        steps += 1
        if done:
            break
    return total, steps
```

Exécutez la politique aléatoire 1000 fois. Le retour moyen est d'environ -60 à -80 pour cette carte 4x4. Le retour optimal est -6 (route droite vers le bas). Fermer cet écart est tout dans la phase 9.

### Étape 3: calculer`V^π`exactement par l'équation de Bellman

Pour les petites MDP, l'équation de Bellman est un système linéaire.

```python
def policy_evaluation(policy, gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in all_states()}
    while True:
        delta = 0.0
        for s in all_states():
            if s == TERMINAL:
                continue
            v = 0.0
            for a, pi_a in policy(s).items():
                s_next, r, _ = step(s, a)
                v += pi_a * (r + gamma * V[s_next])
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            return V
```

Il s'agit d'une évaluation de politique itérative. C'est le premier algorithme de Sutton & Barto et la base théorique de chaque méthode RL qui suit.

### Étape 4:`γ`est un hyperparamètre ayant une signification physique

L' horizon effectif est approximatif $1 / (1 - \gamma)$- Je suis là .$\gamma = 0.9$→ 10 étapes. $\gamma = 0.99$→ 100 pas. $\gamma = 0.999$→ 1000 pas.

La récompense est trop faible et l'agent agit de manière myope.$\gamma = 1$Les tâches de contrôle utilisent des techniques de contrôle.`0.95–0.99`. Jeux de stratégie à long horizon utilisent `0.999`- Je suis désolé .

## Les pièges

- **Non-Markovian state.**Si vous avez besoin des trois dernières observations pour décider, l'"état" n'est pas seulement l'observation actuelle.
- **Sparse rewards.**Les récompenses uniquement gagnantes rendent l'apprentissage presque impossible dans de grands espaces d'état.
- **Reward hacking.**L'optimisation d'une récompense par procuration produit souvent un comportement pathologique. L'agent de course à la barque d'OpenAI tourne en cercles collectant des powerups pour toujours au lieu de terminer la course. Définissez toujours la récompense à partir du résultat cible, pas le procuration.
- **Discount mis-spec.** $\gamma = 1$Dans une tâche à horizon infini, chaque valeur est infinie.$\gamma < 1$- Je suis désolé .
- **Reward scale.**Les récompenses de {+100, -100} par rapport à {+1, -1} donnent des politiques optimales identiques mais des magnitudes de gradient très différentes.`[-1, 1]`- avant de se connecter au PPO/DQN.

## Utilisez-le

La pile 2026 réduit chaque pipeline RL à un MDP avant de toucher le code:

| Situation | State | Action | Reward | γ |
|-----------|-------|--------|--------|---|
| Control (locomotion, manipulation) | Joint angles + velocities | Continuous torques | Task-specific shaped | 0.99 |
| Games (chess, Go, poker) | Board + history | Legal move | Win=+1 / loss=-1 | 1.0 (finite) |
| Inventory / pricing | Stock + demand | Order qty | Revenue - cost | 0.95 |
| RLHF for LLMs | Context tokens | Next token | Reward-model score at end | 1.0 (episode ~200 tokens) |
| GRPO for reasoning | Prompt + partial response | Next token | Verifier 0/1 at end | 1.0 |

Écrivez les cinq tuples avant d'écrire une boucle d'entraînement.

## La faire partir

- Je ne sais pas .`outputs/skill-mdp-modeler.md`- Le numéro de la liste:

```markdown
---
name: mdp-modeler
description: Given a task description, produce a Markov Decision Process spec and flag formulation risks before training.
version: 1.0.0
phase: 9
lesson: 1
tags: [rl, mdp, modeling]
---

Given a task (control / game / recommendation / LLM fine-tuning), output:

1. State. Exact feature vector or tensor spec. Justify Markov property.
2. Action. Discrete set or continuous range. Dimensionality.
3. Transition. Deterministic, stochastic-with-known-model, or sample-only.
4. Reward. Function and source. Sparse vs shaped. Terminal vs per-step.
5. Discount. Value and horizon justification.

Refuse to ship any MDP where the state is non-Markovian without explicit mention of frame-stacking or recurrent state. Refuse any reward that was not defined in terms of the target outcome. Flag any `γ ≥ 1.0` on an infinite-horizon task. Flag any reward range >100x the typical step reward as a likely gradient-explosion source.
```

## Exercices

1. **Easy.**Mettre en œuvre le 4×4 GridWorld et le déploiement de la politique aléatoire en `code/main.py`- 10 000 épisodes, rapportez le rapport moyen et le rapport de rendement, comparez le rapport optimal (-6).
2. **Medium.**On court .`policy_evaluation`avec $\gamma \in \lbrace 0.5, 0.9, 0.99 \rbrace$Pour la politique uniforme et aléatoire.`V`Expliquez pourquoi les valeurs d'état près du terminal augmentent plus rapidement avec la plus grande.$\gamma$- Je suis désolé .
3. **Hard.**Tournez le GridWorld stochastique: chaque action glît dans une direction adjacente avec probabilité $p = 0.1$- Réévaluer la politique uniforme.`V[start]`- Ça va s'améliorer ou empirer ?

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MDP | "Reinforcement learning setup" | Tuple $(S, A, P, R, \gamma)$ satisfying the Markov property. |
| State | "What the agent sees" | Sufficient statistic for future dynamics under the chosen policy class. |
| Policy | "Agent's behavior" | Conditional distribution $\pi(a \mid s)$ or deterministic map $s \to a$. |
| Return | "Total reward" | Discounted sum $\sum \gamma^t r_t$ from the current step. |
| Value | "How good a state is" | Expected return under $\pi$ starting from $s$. |
| Q-value | "How good an action is" | Expected return under $\pi$ starting from $s$ with first action $a$. |
| Bellman equation | "Dynamic programming recursion" | Fixed-point decomposition of value / Q into one-step reward plus discounted successor value. |
| Discount $\gamma$ | "Future vs present" | Geometric weight on far-future reward; effective horizon $\approx 1/(1-\gamma)$. |

## Pour en savoir plus

- [Sutton & Barto (2018). Reinforcement Learning: An Introduction, 2nd ed.](http://incompleteideas.net/book/RLbook2020.pdf)Le chapitre 3 couvre les équations MDP et Bellman; le chapitre 1 motive l'hypothèse de récompense qui sous-tend chaque leçon ultérieure.
- [Bellman (1957). Dynamic Programming](https://press.princeton.edu/books/paperback/9780691146683/dynamic-programming) l'origine de l'équation de Bellman.
- [OpenAI Spinning Up — Part 1: Key Concepts](https://spinningup.openai.com/en/latest/spinningup/rl_intro.html) Primer concis MDP sous un angle de RL profond.
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) la référence de recherche opérationnelle sur les PDM et les méthodes de solution exactes.
- [Littman (1996). Algorithms for Sequential Decision Making (PhD thesis)](https://cs.brown.edu/media/filer_public/d1/a6/d1a6f66a-289a-4b81-9596-417114843489/littman.pdf) la dérivation la plus nette des PDM en tant que spécialisation de la programmation dynamique.
