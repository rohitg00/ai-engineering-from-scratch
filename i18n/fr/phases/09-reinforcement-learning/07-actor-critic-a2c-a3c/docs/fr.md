# Acteur-critique  A2C et A3C

> La force est bruyante, ajoutez un critique qui apprend.$\hat{V}(s)$A2C le fait en synchronisation, A3C le fait en travers de fils. Les deux sont le modèle mental de chaque méthode moderne de RL profonde.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 04 (TD Learning), Phase 9 · 06 (REINFORCE)
**Time:** ~75 minutes

## Le problème

La vanille de la force de renversement fonctionne, mais sa variance est terrible.$G_t$Il peut s'élever sur un facteur de 10 entre les épisodes.$\nabla \log \pi$et la moyenne produit un estimateur de gradient qui prend des milliers d'épisodes pour déplacer la politique à la même distance que vous pourriez le déplacer avec beaucoup moins de mises à jour DQN.

La variance provient de l'utilisation de rendements bruts.$b(s_t)$ toute fonction d'état, y compris une valeur apprise  l'attente est inchangée et la variance diminue.$\hat{V}(s_t)$La quantité se multiplie .$\nabla \log \pi$est l'avantage:

```math
A(s, a) = G - \hat{V}(s)
```

Une action est bonne si elle produit un rendement supérieur à la moyenne; mauvaise si elle est inférieure. REINFORCE avec un critique érudit est *acteur-critique*. Le critique donne à l'acteur un professeur de faible variance. C'est chaque méthode de politique profonde après 2015 (A2C, A3C, PPO, SAC, IMPALA).

## Le concept

![Actor-critic: policy net plus value net, TD residual as advantage](../assets/actor-critic.svg)

**Two networks, one shared loss:**

- **Actor** $\pi_\theta(a \mid s)$Le programme de formation est un programme de formation de base.
- **Critic** $V_\phi(s)$Les résultats de l'enquête ont été évalués en fonction des résultats obtenus.$(V_\phi(s) - \text{target})^2$- Je suis désolé .

**The advantage.**Deux formulaires standard:

- *Avantage du MC*$A_t = G_t - V_\phi(s_t)$- Inpartieux, plus varié.
- *Avantages du TD*$A_t = r_{t+1} + \gamma V_\phi(s_{t+1}) - V_\phi(s_t)$. Utilisation biaisée $V_\phi$La variance est beaucoup plus faible.$\delta_t$- Je suis désolé .

**n-step advantage.**Interpolez les deux:

```math
A_t^{(n)} = r_{t+1} + \gamma r_{t+2} + \ldots + \gamma^{n-1} r_{t+n} + \gamma^n V_\phi(s_{t+n}) - V_\phi(s_t)
```

$n = 1$est une TD pure. $n = \infty$La plupart des mises en œuvre utilisent $n = 5$pour Atari, $n = 2048$Pour le PPO sur MuJoCo.

**Generalized Advantage Estimation (GAE).**Schulman et coll. (2016) ont proposé une moyenne pondérée exponentielle sur tous les avantages de l'étape n:

```math
A_t^{\text{GAE}} = \sum_{l=0}^{\infty} (\gamma \lambda)^l \delta_{t+l}
```

avec $\lambda \in [0, 1]$- Je suis là .$\lambda = 0$est TD (faible variance, haut biais). $\lambda = 1$est MC (haute variance, impartiale). $\lambda = 0.95$est la tonne  par défaut 2026 jusqu'à ce que le cadran biais/variance soit là où vous le voulez.

**A2C: synchronous advantage actor-critic.**Rassembler$T$pas à travers $N$Environments parallèles, calculer les avantages pour chaque étape, mettre à jour l'acteur et le critique sur le lot combiné, répète, le frère plus simple et plus évolutif d'A3C.

**A3C: asynchronous advantage actor-critic.**Mnih et coll. (2016). Spawn $N$Chaque travailleur calcule les gradients localement sur son propre déploiement, puis les applique de manière asynchrone à un serveur de paramètres partagé. Aucun tampon de répétition n'est nécessaire  les travailleurs se décorèrent en exécutant différentes trajectoires. A3C a prouvé que vous pouviez vous entraîner sur des processeurs à grande échelle. En 2026, A2C basé sur des processeurs parallèles en série (environnements parallèles en série) domine parce que les processeurs veulent de grands lots.

**The combined loss.**

```math
L(\theta, \phi) = -\mathbb{E}[ A_t \cdot \log \pi_\theta(a_t \mid s_t) ] + c_v \cdot \mathbb{E}[(V_\phi(s_t) - G_t)^2] - c_e \cdot \mathbb{E}[H(\pi_\theta(\cdot \mid s_t))]
```

Trois termes: perte de la politique, régression de la valeur, bonus d'entropie. `c_v ~ 0.5`- Je suis là .`c_e ~ 0.01`sont des points de départ canoniques.

```figure
actor-critic
```

## Faites-le

### Étape 1: un critique

Le critique linéaire $V_\phi(s) = w \cdot \text{features}(s)$mis à jour avec MSE:

```python
def critic_update(w, x, target, lr):
    v_hat = dot(w, x)
    err = target - v_hat
    for j in range(len(w)):
        w[j] += lr * err * x[j]
    return v_hat
```

Sur une enveloppe tabulaire, le critique converge en quelques centaines d'épisodes. sur Atari, remplacer le critique linéaire par une tête de valeur CNN partagée.

### Étape 2: avantage de n-étape

Compte tenu de la longueur de la déploiement $T$et une finale à la traîne$V(s_T)$- Le numéro de la liste:

```python
def compute_advantages(rewards, values, gamma=0.99, lam=0.95, last_value=0.0):
    advantages = [0.0] * len(rewards)
    gae = 0.0
    for t in reversed(range(len(rewards))):
        next_v = values[t + 1] if t + 1 < len(values) else last_value
        delta = rewards[t] + gamma * next_v - values[t]
        gae = delta + gamma * lam * gae
        advantages[t] = gae
    returns = [a + v for a, v in zip(advantages, values)]
    return advantages, returns
```

`returns`est la cible critique. `advantages`est ce qui se multiplie $\nabla \log \pi$- Je suis désolé .

### Étape 3: mise à jour combinée

```python
for step_i, (x, a, _r, probs) in enumerate(traj):
    adv = advantages[step_i]
    target_v = returns[step_i]

    # critic
    critic_update(w, x, target_v, lr_v)

    # actor
    for i in range(N_ACTIONS):
        grad_logpi = (1.0 if i == a else 0.0) - probs[i]
        for j in range(N_FEAT):
            theta[i][j] += lr_a * adv * grad_logpi * x[j]
```

On-policy, un déploiement par mise à jour, taux d'apprentissage séparés pour acteur et critique.

### Étape 4: parallélisation (A3C contre A2C)

- **A3C:**tourner vers le haut $N$Chaque course est en mode environnemental et en mode avant.
- **A2C:**courir$N$Env instances dans un seul processus, enchaînement des observations en un `[N, obs_dim]`Les données de l'échantillon sont plus précises, plus précises, plus faciles à raisonner.

Notre code de jouet est un seul fil pour la clarté; réécrire à A2C en lots est trois lignes de numpy.

## Les pièges

- **Critic bias before actor gradient.**Si le critique est aléatoire, sa ligne de départ est non informative et vous vous entraînez sur le bruit pur. Réchauffez le critique pendant quelques centaines d'étapes avant d'activer le gradient de politique, ou utilisez un taux d'apprentissage lent des acteurs.
- **Advantage normalization.**Normalement, les avantages sont réduits à zéro moyenne/unit-std par lot.
- **Shared trunk.**Utilisez un extracteur de fonctionnalités partagées pour les acteurs et les critiques sur les entrées d'image.
- **On-policy contract.**A2C réutilise les données pour une mise à jour. Plus et votre gradient est biaisé (correction d'importance-échantillonnage est ce que PPO ajoute).
- **Entropy collapse.**Sans$c_e > 0$La politique devient presque déterministe dans quelques centaines de mises à jour et cesse d'explorer.
- **Reward scale.**Les magnitudes d'avantage dépendent de l'échelle de récompense. Normalize les récompenses (par exemple, la division run-std) pour des magnitudes de gradient cohérentes entre les tâches.

## Utilisez-le

A2C/A3C sont rarement le choix final en 2026 mais ils sont l'architecture que tout raffinera plus tard:

| Method | Relation to A2C |
|--------|----------------|
| PPO | A2C + clipped importance ratio for multi-epoch updates |
| IMPALA | A3C + V-trace off-policy correction |
| SAC (Phase 9 · 07) | Off-policy A2C with a soft-value critic (next lesson) |
| GRPO (Phase 9 · 12) | A2C without the critic — group-relative advantage |
| DPO | A2C collapsed into a preference-ranking loss, no sampling |
| AlphaStar / OpenAI Five | A2C with league training + imitation pre-training |

Si vous voyez "avantage" dans un article de 2026, pensez à un critique acteur.

## La faire partir

- Je ne sais pas .`outputs/skill-actor-critic-trainer.md`- Le numéro de la liste:

```markdown
---
name: actor-critic-trainer
description: Produce an A2C / A3C / GAE configuration for a given environment, with advantage estimation and loss weights specified.
version: 1.0.0
phase: 9
lesson: 7
tags: [rl, actor-critic, gae]
---

Given an environment and compute budget, output:

1. Parallelism. A2C (GPU batched) vs A3C (CPU async) and the number of workers.
2. Rollout length T. Steps per env per update.
3. Advantage estimator. n-step or GAE(λ); specify λ.
4. Loss weights. `c_v` (value), `c_e` (entropy), gradient clip.
5. Learning rates. Actor and critic (separate if using).

Refuse single-worker A2C on environments with horizon > 1000 (too on-policy, too slow). Refuse to ship without advantage normalization. Flag any run with `c_e = 0` and observed entropy < 0.1 as entropy-collapsed.
```

## Exercices

1. **Easy.**Prenez l' acteur-critique avec l' avantage MC $(G_t - V(s_t))$Comparer l'efficacité de l'échantillon à la base moyenne de REINFORCE avec fonctionnement de la leçon 06.
2. **Medium.**Passer à l' avantage résiduel TD $(r + \gamma V(s') - V(s))$Mesurer la variance des lots d'avantage.
3. **Hard.**Implémentation de l'AEA (L).$\lambda \in \lbrace 0, 0.5, 0.9, 0.95, 1.0 \rbrace$Où est le point de vue de la différence pour cette tâche ?

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Actor | "The policy net" | $\pi_\theta(a \mid s)$, updated by policy gradient. |
| Critic | "The value net" | $V_\phi(s)$, updated by MSE regression to returns / TD targets. |
| Advantage | "How much better than average" | $A(s, a) = Q(s, a) - V(s)$ or its estimators. Multiplier for $\nabla \log \pi$. |
| TD residual | "δ" | $\delta_t = r + \gamma V(s') - V(s)$; one-step advantage estimate. |
| GAE | "The interpolation knob" | Exponentially weighted sum of n-step advantages, parameterized by $\lambda$. |
| A2C | "Synchronous actor-critic" | Batched across envs; one gradient step per rollout. |
| A3C | "Async actor-critic" | Worker threads push gradients to a shared param server. Original paper; less common in 2026. |
| Bootstrap | "Use V at the horizon" | Truncate the rollout, add $\gamma^n V(s_{t+n})$ to close the sum. |

## Pour en savoir plus

- [Mnih et al. (2016). Asynchronous Methods for Deep Reinforcement Learning](https://arxiv.org/abs/1602.01783) A3C, le papier critique acteur-critique original.
- [Schulman et al. (2016). High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) GAE.
- [Sutton & Barto (2018). Ch. 13 — Actor-Critic Methods](http://incompleteideas.net/book/RLbook2020.pdf) fondations; associer ceci au chapitre 9 sur l'approximation des fonctions lorsque le critique est un réseau neuronal.
- [Espeholt et al. (2018). IMPALA](https://arxiv.org/abs/1802.01561) critique distribuée d'acteurs évolutifs avec correction hors politique de V-trace.
- [OpenAI Baselines / Stable-Baselines3](https://stable-baselines3.readthedocs.io/) des mises en œuvre de production A2C/PPO qui méritent d'être lues.
- [Konda & Tsitsiklis (2000). Actor-Critic Algorithms](https://papers.nips.cc/paper/1786-actor-critic-algorithms) le résultat de convergence fondamental de la décomposition acteur-critique à deux échelles.
