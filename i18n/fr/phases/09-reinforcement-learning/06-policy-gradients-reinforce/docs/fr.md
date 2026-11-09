# Politique Gradient  RENFORCE à partir de zéro

> Arrêtez d'estimer la valeur. Paramétrez directement la politique, calculez le gradient du rendement attendu, faites des pas en haut. Williams (1992) l'a écrit dans un théorème. C'est pourquoi PPO, GRPO et chaque boucle LLM RL existent.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 03 (Backpropagation), Phase 9 · 03 (Monte Carlo), Phase 9 · 04 (TD Learning)
**Time:** ~75 minutes

## Le problème

Q-learning et DQN paramétrisent la fonction *value*.`argmax Q`Il est bon pour les actions discrètes et les états discrets.`argmax`sur un couple à 10 dimensions?) ou lorsque vous voulez une politique stochastique (`argmax`est déterministe par construction).

Les gradients de politique paramétrisent plutôt la politique. $\pi_\theta(a \mid s)$Le taux de rendement attendu est calculé par rapport à la valeur de l'échantillon.$\theta$- Passer le mont.`argmax`Pas de récursion Bellman, juste une ascension de gradient.$J(\theta) = \mathbb E_{\pi_\theta}[G]$- Je suis désolé .

Le théorème de la REINFORCE (Williams 1992) vous dit que ce gradient est calculé: $\nabla J(\theta) = \mathbb E_\pi[ G \cdot \nabla_\theta \log \pi_\theta(a \mid s) ]$- Exécutez un épisode, comptez le rendement, multipliez par$\nabla \log \pi_\theta(a \mid s)$Je suis en moyenne, à chaque étape, à chaque grade.

Chaque algorithme LLM-RL en 2026  PPO, DPO, GRPO  est un raffinement de REINFORCE.

## Le concept

![Policy gradient: softmax policy, log-π gradient, return-weighted update](../assets/policy-gradient.svg)

**The policy gradient theorem.**Pour toute politique $\pi_\theta$paramétrisé par $\theta$- Le numéro de la liste:

```math
\nabla J(\theta) = \mathbb{E}_{\tau \sim \pi_\theta}[ \sum_{t=0}^{T} G_t \cdot \nabla_\theta \log \pi_\theta(a_t \mid s_t) ]
```

où $G_t = \sum_{k=t}^{T} \gamma^{k-t} r_{k+1}$est le rendement réduit de la étape $t$L' attente est au-delà des trajectories complètes .$\tau$échantillonnés à partir de $\pi_\theta$- Je suis désolé .

**The proof is short.**Différencier $J(\theta) = \sum_\tau P(\tau; \theta) G(\tau)$- Je suis un peu déçu.$\nabla P(\tau; \theta) = P(\tau; \theta) \nabla \log P(\tau; \theta)$Facteur $\log P(\tau; \theta) = \sum \log \pi_\theta(a_t \mid s_t) + \text{environment terms that do not depend on } \theta$Les termes de l'environnement disparaissent.

**Variance reduction tricks.**La vanille de la force a une variance meurtrière. Les retours sont bruyants.$\nabla \log \pi$Le produit est très bruyant.

1. **Baseline subtraction.**Remplacez$G_t$avec $G_t - b(s_t)$pour toute ligne de base $b(s_t)$qui ne dépend pas de $a_t$- Je suis impartial parce que ...$\mathbb{E}[b(s_t) \cdot \nabla \log \pi(a_t \mid s_t)] = 0$. Choix typique: $b(s_t) = \hat{V}(s_t)$apprise par un critique → acteur-critique (Lément 07).
2. **Reward-to-go.**Remplacez$\sum_t G_t \cdot \nabla \log \pi_\theta(a_t \mid s_t)$avec $\sum_t G_t^{\text{from } t} \cdot \nabla \log \pi_\theta(a_t \mid s_t)$. Seuls les rendements futurs sont importants pour une action donnée  Les récompenses passées contribuent au bruit nul moyen.

Combiné, vous obtenez:

```math
\nabla J \approx (1/N) \sum_{i=1}^{N} \sum_{t=0}^{T_i} [ G_t^{(i)} - \hat{V}(s_t^{(i)}) ] \cdot \nabla_\theta \log \pi_\theta(a_t^{(i)} \mid s_t^{(i)})
```

qui est REINFORCE avec une ligne de base  l'ancêtre direct de l'A2C (leçon 07) et du PPO (leçon 08).

**Softmax policy parameterization.**Pour les actions discrètes, le choix standard:

```math
\pi_\theta(a \mid s) = \exp(f_\theta(s, a)) / \sum_{a'} \exp(f_\theta(s, a'))
```

où $f_\theta$est un réseau neural qui donne un score par action.

```math
\nabla_\theta \log \pi_\theta(a \mid s) = \nabla_\theta f_\theta(s, a) - \sum_{a'} \pi_\theta(a' \mid s) \nabla_\theta f_\theta(s, a')
```

c'est-à-dire le score de l'action prise moins sa valeur attendue dans le cadre de la police.

**Gaussian policy for continuous actions.** $\pi_\theta(a \mid s) = N(\mu_\theta(s), \sigma_\theta(s))$- Je suis là .$\nabla \log N(a; \mu, \sigma)$Il est nécessaire de fournir une information complète sur les besoins de la phase 9 · 07 du SAC.

```figure
policy-gradient-landscape
```

## Faites-le

### Étape 1: réseau de politique softmax

```python
def policy_logits(theta, state_features):
    return [dot(theta[a], state_features) for a in range(N_ACTIONS)]

def softmax(logits):
    m = max(logits)
    exps = [exp(l - m) for l in logits]
    Z = sum(exps)
    return [e / Z for e in exps]
```

Utilisez une politique linéaire (un vecteur de poids par action) pour une enveloppe tabulaire. Pour Atari, échangez dans une CNN et gardez la tête softmax.

### Étape 2: prélèvement d'échantillons et probabilité de stockage

```python
def sample_action(probs, rng):
    x = rng.random()
    cum = 0
    for a, p in enumerate(probs):
        cum += p
        if x <= cum:
            return a
    return len(probs) - 1

def log_prob(probs, a):
    return log(probs[a] + 1e-12)
```

### Étape 3: déploiement avec des sondes de journaux capturées

```python
def rollout(theta, env, rng, gamma):
    trajectory = []
    s = env.reset()
    while not done:
        logits = policy_logits(theta, s)
        probs = softmax(logits)
        a = sample_action(probs, rng)
        s_next, r, done = env.step(s, a)
        trajectory.append((s, a, r, probs))
        s = s_next
    return trajectory
```

### Étape 4: Mise à jour de REINFORCE

```python
def reinforce_step(theta, trajectory, gamma, lr, baseline=0.0):
    returns = compute_returns(trajectory, gamma)
    for (s, a, _, probs), G in zip(trajectory, returns):
        advantage = G - baseline
        grad_log_pi_a = [-p for p in probs]
        grad_log_pi_a[a] += 1.0
        for i in range(N_ACTIONS):
            for j in range(len(s)):
                theta[i][j] += lr * advantage * grad_log_pi_a[i] * s[j]
```

Le gradient $\nabla \log \pi(a \mid s) = e_a - \pi(\cdot \mid s)$(à l'intérieur de $a$Le cœur des gradients de politique softmax.

### Étape 5: lignes de base

Une moyenne de $G$Les épisodes récents sont suffisants pour réduire la variance pour faire fonctionner un GridWorld 4×4; il faut environ 500 épisodes pour converger.$\hat{V}(s)$et vous obtenez un critique d'acteur.

## Les pièges

- **Exploding gradients.**Les retours peuvent être énormes.$G$à `~N(0, 1)`à travers le lot avant de multiplier par $\nabla \log \pi$- Je suis désolé .
- **Entropy collapse.**La politique converge à une action quasi-deterministe trop tôt, cesse d'explorer, se retrouve coincée.$\beta \cdot H(\pi(\cdot \mid s))$à l'objectif.
- **High variance.**La réaction de Vanilla REINFORCE nécessite des milliers d'épisodes.
- **Sample inefficiency.**On-policy signifie que vous jetez chaque transition après une mise à jour.Les corrections hors-policy par l'intermédiaire d'un échantillonnage d'importance ramènent des données au coût de la variance (le ratio de l'OPP est un poids IS réduit).
- **Non-stationary gradients.**Le même gradient de 100 épisodes auparavant utilise l' ancien .$\pi$Les méthodes de mise en œuvre de la politique sont mises à jour à chaque déploiement.
- **Credit assignment.**Sans récompense, les récompenses passées contribuent au bruit.

## Utilisez-le

En 2026, REINFORCE est rarement utilisé directement mais sa formule de gradient est partout:

| Use case | Derived method |
|----------|---------------|
| Continuous control | PPO / SAC with Gaussian policy |
| LLM RLHF | PPO with KL penalty, running on token-level policy |
| LLM reasoning (DeepSeek) | GRPO — REINFORCE with group-relative baseline, no critic |
| Multi-agent | Centralized-critic REINFORCE (MADDPG, COMA) |
| Discrete action robotics | A2C, A3C, PPO |
| Preference-only settings | DPO — REINFORCE rewritten as a preference-likelihood loss, no sampling |

Quand vous lisez`loss = -advantage * log_prob`Les documents complets (DPO, GRPO, RLOO) sont des astuces de réduction des variantes en plus de cette ligne.

## La faire partir

- Je ne sais pas .`outputs/skill-policy-gradient-trainer.md`- Le numéro de la liste:

```markdown
---
name: policy-gradient-trainer
description: Produce a REINFORCE / actor-critic / PPO training config for a given task and diagnose variance issues.
version: 1.0.0
phase: 9
lesson: 6
tags: [rl, policy-gradient, reinforce]
---

Given an environment (discrete / continuous actions, horizon, reward stats), output:

1. Policy head. Softmax (discrete) or Gaussian (continuous) with parameter counts.
2. Baseline. None (vanilla), running mean, learned `V̂(s)`, or A2C critic.
3. Variance controls. Reward-to-go on by default, return normalization, gradient clip value.
4. Entropy bonus. Coefficient β and decay schedule.
5. Batch size. Episodes per update; on-policy data freshness contract.

Refuse REINFORCE-no-baseline on horizons > 500 steps. Refuse continuous-action control with a softmax head. Flag any run with `β = 0` and observed policy entropy < 0.1 as entropy-collapsed.
```

## Exercices

1. **Easy.**Mettre en œuvre REINFORCE sur 4×4 GridWorld avec une politique de softmax linéaire. entraîner pour 1000 épisodes sans ligne de base. tracer la courbe d'apprentissage; mesurer la variance (std de rendements).
2. **Medium.**Ajoutez une ligne de base moyenne de course. Reentraînez. Comparer l'efficacité de l'échantillon et la variance à la course de vanille. En combien la ligne de base réduit les étapes de convergence?
3. **Hard.**Ajoutez une bonus d' entropie $\beta \cdot H(\pi)$- Le balayage .$\beta \in \lbrace 0, 0.01, 0.1, 1.0 \rbrace$Où est le bon point de cette tâche ?

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Policy gradient | "Train the policy directly" | $\nabla J(\theta) = \mathbb{E}[G \cdot \nabla \log \pi_\theta(a \mid s)]$; derived from the log-derivative trick. |
| REINFORCE | "The original PG algorithm" | Williams (1992); Monte Carlo returns multiplied by log-policy gradient. |
| Log-derivative trick | "Score function estimator" | $\nabla P(\tau;\theta) = P(\tau;\theta) \cdot \nabla \log P(\tau;\theta)$; makes gradients of expectations tractable. |
| Baseline | "Variance reduction" | Any $b(s)$ subtracted from $G$; unbiased because $\mathbb{E}[b \cdot \nabla \log \pi] = 0$. |
| Reward-to-go | "Only future returns count" | $G_t^{\text{from } t}$ instead of the full $G_0$; correct and lower-variance. |
| Entropy bonus | "Encourage exploration" | $+\beta \cdot H(\pi(\cdot \mid s))$ term keeps the policy from collapsing. |
| On-policy | "Train on what you just saw" | Gradient expectation is w.r.t. the current policy — cannot reuse old data directly. |
| Advantage | "How much better than average" | $A(s, a) = G(s, a) - V(s)$; the signed quantity REINFORCE-with-baseline multiplies. |

## Pour en savoir plus

- [Williams (1992). Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning](https://link.springer.com/article/10.1007/BF00992696) le papier original de REINFORCE.
- [Sutton et al. (2000). Policy Gradient Methods for Reinforcement Learning with Function Approximation](https://papers.nips.cc/paper_files/paper/1999/hash/464d828b85b0bed98e80ade0a5c43b0f-Abstract.html) le théorème moderne de la politique-gradient avec approximation de fonction.
- [Sutton & Barto (2018). Ch. 13 — Policy Gradient Methods](http://incompleteideas.net/book/RLbook2020.pdf) présentation de livres de cours.
- [OpenAI Spinning Up — VPG / REINFORCE](https://spinningup.openai.com/en/latest/algorithms/vpg.html) exposition pédagogique claire avec le code PyTorch.
- [Peters & Schaal (2008). Reinforcement Learning of Motor Skills with Policy Gradients](https://homes.cs.washington.edu/~todorov/courses/amath579/reading/PolicyGradient.pdf) Réduction des variantes et la vue naturelle-gradiente qui relie REINFORCE à la famille de la région de confiance (TRPO, PPO).
