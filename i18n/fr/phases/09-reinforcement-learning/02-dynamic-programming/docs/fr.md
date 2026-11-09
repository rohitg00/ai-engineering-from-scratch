# Programming dynamique  Iteration des politiques et Iteration des valeurs

> La programmation dynamique est RL avec tricherie. Vous connaissez déjà les fonctions de transition et de récompense; vous faites simplement l'équation Bellman jusqu'à ce que$V$ou $\pi$Il s'agit de la référence à laquelle chaque méthode basée sur l'échantillonnage tente de s'approcher.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs)
**Time:** ~75 minutes

## Le problème

Vous avez un MDP avec un modèle connu: vous pouvez demander $P(s' \mid s, a)$et $R(s, a, s')$Un gestionnaire d'inventaire connaît la distribution de la demande. un jeu de société a des transitions déterministes. un monde de grille est quatre lignes de Python. vous avez un * modèle *.

La RL sans modèle (Q-learning, PPO, REINFORCE) a été inventée pour le cas où vous n'avez pas de modèle  vous pouvez seulement échantillonner de l'environnement. Mais quand vous en avez un, il y a des méthodes plus rapides et meilleures: la programmation dynamique. Bellman les a conçues en 1957.

Vous en avez besoin en 2026 pour trois raisons. Premièrement, chaque environnement tabulaire dans la recherche RL (GridWorld, FrozenLake, CliffWalking) est résolu avec DP pour produire la politique standard en or. Deuxièmement, les valeurs exactes vous permettent de déboguer les méthodes d'échantillonnage: si l'estimation de Q-learning pour $V^{\ast}(s_0)$Troisièmement, les méthodes modernes de RL hors ligne et de planification (MCTS, recherche d'AlphaZero, RL basée sur le modèle dans la phase 9 · 10) répéteront toutes une sauvegarde Bellman sur un modèle appris ou donné.

## Le concept

![Policy iteration and value iteration, side by side](../assets/dp.svg)

**Two algorithms, both fixed-point iteration on Bellman.**

**Policy iteration.**Alterne deux étapes jusqu'à ce que la politique cesse de changer.

1. *Évaluation:* politique donnée $\pi$, calcul$V^\pi$en appliquant à plusieurs reprises $V(s) \leftarrow \sum_a \pi(a \mid s) \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]$jusqu'à ce qu'il converge.
2. * Amélioration: * accordée $V^\pi$, faire$\pi$L' avide W.R.T.$V^\pi$Le numéro de la liste:$\pi(s) \leftarrow \arg\max_a \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]$- Je suis désolé .

La convergence est garantie parce que: a) chaque étape d'amélioration ou conserve $\pi$la même ou une augmentation stricte $V^\pi$Pour certains états, (b) l'espace des politiques déterministes est fini. converge habituellement en ~520 itérations extérieures même pour de grands espaces d'état.

**Value iteration.**L'évaluation et l'amélioration se fondent en une seule analyse.

```math
V(s) \leftarrow \max_a \sum_{s',r} P(s',r \mid s,a) [r + \gamma V(s')]
```

Répétez jusqu' à $\max_s \lvert V_{\text{new}}(s) - V(s) \rvert < \epsilon$. Extraire la politique à la fin en prenant l'action avide. Rigoureusement plus rapide par itération  pas de boucle d'évaluation interne  mais généralement besoin de plus d'itérations pour converger.

**Generalized policy iteration (GPI).**La mise en forme unifiante. La fonction de valeur et la politique sont verrouillées dans une boucle d'amélioration bidirectionnelle; toute méthode qui conduit les deux vers la cohérence mutuelle (itération de valeur asynchrone, itération de politique modifiée, Q-apprentissage, acteur-critique, PPO) est une instance de GPI.

**Why $\gamma < 1$ matters.**L' opérateur Bellman est un $\gamma$- contraction dans la norme supérieure: $\lVert T V - T V' \rVert_\infty \le \gamma \lVert V - V' \rVert_\infty$La contraction implique un point fixe unique et une convergence géométrique.$\gamma < 1$et vous perdez la garantie  vous avez besoin d'un horizon fini ou d'un état terminal d'absorption.

```figure
value-iteration-gamma
```

## Faites-le

### Étape 1: construire le modèle MDP GridWorld

Utilisez le même 4x4 GridWorld de la leçon 01. Nous ajoutons une variante stochastique: avec probabilité `0.1`l'agent glisse dans une direction perpendiculaire aléatoire.

```python
SLIP = 0.1

def transitions(state, action):
    if state == TERMINAL:
        return [(state, 0.0, 1.0)]
    outcomes = []
    for direction, prob in action_probs(action):
        outcomes.append((apply_move(state, direction), -1.0, prob))
    return outcomes
```

`transitions(s, a)`renvoie une liste de `(s', r, p)`C'est le modèle entier.

### Étape 2: évaluation des politiques

En raison d' une politique `π(s) = {action: prob}`, répéter l' équation Bellman jusqu' à $V$Arrête de bouger:

```python
def policy_evaluation(policy, gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in states()}
    while True:
        delta = 0.0
        for s in states():
            v = sum(pi_a * sum(p * (r + gamma * V[s_prime])
                              for s_prime, r, p in transitions(s, a))
                   for a, pi_a in policy(s).items())
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            return V
```

### Étape 3: Amélioration des politiques

Remplacez$\pi$avec la politique avide W.R.T.$V$Si vous ...$\pi$Nous sommes au maximum.

```python
def policy_improvement(V, gamma=0.99):
    new_policy = {}
    for s in states():
        best_a = max(
            ACTIONS,
            key=lambda a: sum(p * (r + gamma * V[s_prime])
                              for s_prime, r, p in transitions(s, a)),
        )
        new_policy[s] = best_a
    return new_policy
```

### Étape 4: les couture ensemble

```python
def policy_iteration(gamma=0.99):
    policy = {s: "up" for s in states()}   # arbitrary start
    for _ in range(100):
        V = policy_evaluation(lambda s: {policy[s]: 1.0}, gamma)
        new_policy = policy_improvement(V, gamma)
        if new_policy == policy:
            return V, policy
        policy = new_policy
```

Convergence typique sur 4×4: 46 Iterations extérieures.$V^{\ast}(0,0) \approx -6$et une politique qui réduit strictement le nombre d'étapes.

### Étape 5: Iteration de valeur (version en boucle unique)

```python
def value_iteration(gamma=0.99, tol=1e-6):
    V = {s: 0.0 for s in states()}
    while True:
        delta = 0.0
        for s in states():
            v = max(sum(p * (r + gamma * V[s_prime])
                       for s_prime, r, p in transitions(s, a))
                   for a in ACTIONS)
            delta = max(delta, abs(v - V[s]))
            V[s] = v
        if delta < tol:
            break
    policy = policy_improvement(V, gamma)
    return V, policy
```

Le même point fixe, moins de lignes de code.

## Les pièges

- **Forgetting to handle terminals.**Si vous appliquez Bellman à un état d'absorption, il prend toujours une "meilleure action" qui ne change rien.`if s == terminal: V[s] = 0`- Je suis désolé .
- **Sup-norm vs L2 convergence.**Utilisation `max |V_new - V|`La garantie théorique est sur la sup-norme.
- **In-place vs synchronous updates.**Mise à jour `V[s]`La convergence en place (Gauss-Seidel) est plus rapide qu'une convergence séparée.`V_new`Le code de production utilise le code de production.
- **Policy ties.**Si deux actions ont la même valeur Q,`argmax`Les deux types de corrections peuvent être modifiés de manière différente à chaque itération, ce qui provoque une oscillation du contrôle "stable de la politique".
- **State-space explosion.**Le DP est $O(\lvert S \rvert \cdot \lvert A \rvert)$Il fonctionne jusqu'à ~ 107 états. Au-delà de cela, vous avez besoin d'approximation de fonction (phase 9 · 05 et plus).

## Utilisez-le

En 2026, DP est la ligne de base de la précision et la boucle interne des planificateurs:

| Use case | Method |
|----------|--------|
| Solve a small tabular MDP exactly | Value iteration (simpler) or policy iteration (fewer outer steps) |
| Verify a Q-learning / PPO implementation | Compare to DP-optimal $V^{\ast}$ on a toy environment |
| Model-based RL (Phase 9 · 10) | Bellman backup on a learned transition model |
| Planning in AlphaZero / MuZero | Monte Carlo Tree Search = async Bellman backup |
| Offline RL (CQL, IQL) | Conservative Q-iteration — DP with a penalty on OOD actions |

Chaque fois que quelqu'un dit "la fonction de valeur optimale", il veut dire "le point fixe DP".$V^{\ast}$ou $Q^{\ast}$Dans un journal, imaginez cette boucle.

## La faire partir

- Je ne sais pas .`outputs/skill-dp-solver.md`- Le numéro de la liste:

```markdown
---
name: dp-solver
description: Solve a small tabular MDP exactly via policy iteration or value iteration. Report convergence behavior.
version: 1.0.0
phase: 9
lesson: 2
tags: [rl, dynamic-programming, bellman]
---

Given an MDP with a known model, output:

1. Choice. Policy iteration vs value iteration. Reason tied to |S|, |A|, γ.
2. Initialization. V_0, starting policy. Convergence sensitivity.
3. Stopping. Sup-norm tolerance ε. Expected number of sweeps.
4. Verification. V*(s_0) computed exactly. Greedy policy extracted.
5. Use. How this baseline will be used to debug/evaluate sampling-based methods.

Refuse to run DP on state spaces > 10⁷. Refuse to claim convergence without a sup-norm check. Flag any γ ≥ 1 on an infinite-horizon task as a guarantee violation.
```

## Exercices

1. **Easy.**Exécuter l' itération de la valeur sur le 4×4 GridWorld avec $\gamma \in \lbrace 0.9, 0.99 \rbrace$Combien de balais jusqu' à$\max \lvert \Delta V \rvert < 10^{-6}$- Imprimé$V^{\ast}$comme une grille 4x4.
2. **Medium.**Comparez l'itération de la politique par rapport à l'itération de la valeur sur le GridWorld (probabilité de glissement `0.1`Le nombre: balayage, heure du mur, finale $V^{\ast}(0,0)$Qui converge plus vite en itérations ?
3. **Hard.**Construire une itération de politique modifiée: dans l'étape d'évaluation, exécuter uniquement $k$- Il s'agit d'un plan de recherche.$V^{\ast}(0,0)$erreur vs $k$pour $k \in \lbrace 1, 2, 5, 10, 50 \rbrace$Que vous dit la courbe sur l'offre d'évaluation/amélioration ?

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Policy iteration | "DP algorithm" | Alternating evaluation ($V^\pi$) and improvement (greedy $\pi$ w.r.t. $V^\pi$) until the policy stops changing. |
| Value iteration | "Faster DP" | Bellman optimality backup applied in one sweep; converges to $V^{\ast}$ geometrically. |
| Bellman operator | "The recursion" | $(T V)(s) = \max_a \sum P (r + \gamma V(s'))$; a $\gamma$-contraction in sup-norm. |
| Contraction | "Why DP converges" | Any operator $T$ with $\lVert T x - T y \rVert \le \gamma \lVert x - y \rVert$ has a unique fixed point. |
| GPI | "Everything is DP" | Generalized Policy Iteration: any method driving $V$ and $\pi$ to mutual consistency. |
| Synchronous update | "Jacobi-style" | Use old $V$ throughout a sweep; cleanly analyzable but slower. |
| In-place update | "Gauss-Seidel-style" | Use $V$ as it's being updated; converges faster in practice. |

## Pour en savoir plus

- [Sutton & Barto (2018). Ch. 4 — Dynamic Programming](http://incompleteideas.net/book/RLbook2020.pdf) la présentation canonique de l'itération de la politique et de l'itération de la valeur.
- [Bertsekas (2019). Reinforcement Learning and Optimal Control](http://www.athenasc.com/rlbook_athena.html) traitement rigoureux des arguments de cartographie de contraction.
- [Puterman (2005). Markov Decision Processes](https://onlinelibrary.wiley.com/doi/book/10.1002/9780470316887) l'itération de la politique modifiée et son analyse de convergence.
- [Howard (1960). Dynamic Programming and Markov Processes](https://mitpress.mit.edu/9780262582300/dynamic-programming-and-markov-processes/) le document d'itération de la politique originale.
- [Bertsekas & Tsitsiklis (1996). Neuro-Dynamic Programming](http://www.athenasc.com/ndpbook.html) le pont du DP à l'approximation du DP / RL profond utilisé dans chaque cours ultérieur.
