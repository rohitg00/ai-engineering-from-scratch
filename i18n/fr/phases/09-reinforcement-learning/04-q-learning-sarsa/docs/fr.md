# Différence temporelle  Q-Learning et SARSA

> Monte Carlo attend la fin de l'épisode. TD met à jour après chaque étape en démarrant la prochaine estimation de valeur. Q-learning est hors politique et optimiste; SARSA est sur politique et prudent. Les deux sont une ligne de code. Les deux sont à la base de chaque méthode de RL profonde dans cette phase.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 01 (MDPs), Phase 9 · 02 (Dynamic Programming), Phase 9 · 03 (Monte Carlo)
**Time:** ~75 minutes

## Le problème

Monte Carlo fonctionne mais il a deux exigences coûteuses. Il a besoin d'épisodes qui se terminent, et il ne se met à jour que lorsque le retour final est arrivé. Si votre épisode est de 1000 étapes, MC attend 1000 étapes pour mettre à jour quoi que ce soit. C'est de haute variance, faible partialité, et lent en pratique.

La programmation dynamique a le profil opposé  sauvegardes à zéro variance  mais nécessite un modèle connu.

L'apprentissage par différence temporelle (TD) divise la différence.$(s, a, r, s')$, pour former une cible en un seul pas $r + \gamma V(s')$et de pousser$V(s)$Aucun modèle, aucun épisode complet, aucun biais d'utilisation d'une approximation.$V$sur le RHS, mais une variance nettement inférieure à celle du MC et des mises à jour en ligne à partir de l'étape 1.

C'est le pivot sur lequel se tournent toutes les RL  DQN, A2C, PPO, SAC  modernes. Le reste de la phase 9 est des couches d'approximation des fonctions et des astuces construites en haut de la mise à jour TD en une étape que vous écrirez dans cette leçon.

## Le concept

![Q-learning vs SARSA: off-policy max vs on-policy Q(s', a')](../assets/td.svg)

**The TD(0) update for V:**

```math
V(s) \leftarrow V(s) + \alpha [r + \gamma V(s') - V(s)]
```

La quantité en parenthèses est l' erreur TD $\delta = r + \gamma V(s') - V(s)$Il s'agit de l' analogue en ligne de $G_t - V(s_t)$dans le MC. La convergence exige $\alpha$- le rapport de l'entreprise$\sum \alpha = \infty$- Je suis là .$\sum \alpha^2 < \infty$Il y a eu des visites de nombreux États.

**Q-learning.**Une méthode de contrôle TD hors politique:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma \max_{a'} Q(s', a') - Q(s, a)]
```

Le `max`Il est donc important de prendre en compte les mesures prises en vue de la mise en œuvre de la politique de l'avidité.$s'$Ce découplage fait que l'apprentissage Q apprend.$Q^{\ast}$Mnih et al. (2015) ont converti cela en profondeur d'apprentissage Q sur Atari (Léction 05).

**SARSA.**Une méthode de démarrage de la politique:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma Q(s', a') - Q(s, a)]
```

Le nom est le tuple .$(s, a, r, s', a')$La SARSA utilise l' action.$a'$L'agent prend le prochain, pas l'avid`argmax`- Converge à$Q^\pi$Pour quoi que ce soit de cupide .$\pi$est en cours d'exécution, qui dans la limite $\epsilon \to 0$devient $Q^{\ast}$- Je suis désolé .

**The cliff-walking difference.**Dans la tâche classique de marche sur le falais (coupe-de-cliff = récompense -100), l'apprentissage Q apprend le chemin optimal le long du bord du falais mais prend parfois la pénalité lors de l'exploration. SARSA apprend un chemin plus sûr à un pas de l'exploration car il fait partie de la valeur Q du bruit d'exploration.$\epsilon \to 0$En pratique, il importe: lorsque l'exploration se déroule réellement au déploiement, le comportement de la SARSA est plus conservateur.

**Expected SARSA.**Remplacez$Q(s', a')$avec sa valeur attendue inférieure à $\pi$- Le numéro de la liste:

```math
Q(s, a) \leftarrow Q(s, a) + \alpha [r + \gamma \sum_{a'} \pi(a' \mid s') Q(s', a') - Q(s, a)]
```

Variance inférieure à SARSA (pas d' échantillon de $a'$Le problème est que les échanges de données sont souvent négatifs.

**n-step TD and TD(λ).**Interpolez entre TD(0) et MC en attendant $n$étapes avant le démarrage. $n=1$est TD, $n=\infty$est MC. TD(λ) moyennes sur tous $n$avec des poids géométriques $(1-\lambda)\lambda^{n-1}$La plupart des utilisations de RL profonde$n$entre 3 et 20.

```figure
qlearning-gridworld
```

## Faites-le

### Étape 1: SARSA sur la politique de l'avidité

```python
def sarsa(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})

    def choose(s):
        if random() < epsilon:
            return choice(ACTIONS)
        return max(Q[s], key=Q[s].get)

    for _ in range(episodes):
        s = env.reset()
        a = choose(s)
        while True:
            s_next, r, done = env.step(s, a)
            a_next = choose(s_next) if not done else None
            target = r + (gamma * Q[s_next][a_next] if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s, a = s_next, a_next
    return Q
```

La seule différence avec l'apprentissage de Q est la ligne cible.

### Étape 2: Apprendre à Q

```python
def q_learning(env, episodes, alpha=0.1, gamma=0.99, epsilon=0.1):
    Q = defaultdict(lambda: {a: 0.0 for a in ACTIONS})
    for _ in range(episodes):
        s = env.reset()
        while True:
            a = choose(s, Q, epsilon)
            s_next, r, done = env.step(s, a)
            target = r + (gamma * max(Q[s_next].values()) if not done else 0.0)
            Q[s][a] += alpha * (target - Q[s][a])
            if done:
                break
            s = s_next
    return Q
```

Le `max`Ce symbole est la différence entre les politiques et les politiques.

### Étape 3: courbes d'apprentissage

Le taux de retour moyen sur 100 épisodes. Q-learning converge plus rapidement sur le simple GridWorld déterministe; SARSA est plus conservateur sur le grillage.`code/main.py`, les deux sont presque optimaux après environ 2000 épisodes avec$\alpha=0.1, \epsilon=0.1$- Je suis désolé .

### Étape 4: comparer avec la vérité DP

L' iteration de la valeur d' exécution (leçon 02) pour obtenir $Q^{\ast}$- Vérifiez .$\max_{s,a} \lvert Q_{\text{learned}}(s,a) - Q^{\ast}(s,a) \rvert$Un agent de TD tablaire sain atterrit à l' intérieur de la`~0.5`sur le 4x4 GridWorld après 10 000 épisodes.

## Les pièges

- **Initial Q values matter.**L'initiative optimiste ($Q = 0$Les résultats de l'enquête ont été très positifs, et la Commission a décidé de les mettre en œuvre.
- **α schedule.**Constante$\alpha$Il est bon pour les problèmes non stables.$\alpha_n = 1/n$donne une convergence en théorie mais est trop lente en pratique  pin $\alpha$dans `[0.05, 0.3]`et surveiller la courbe d'apprentissage.
- **ε schedule.**Commencez à hauteur ($\epsilon=1.0$), décomposition à $\epsilon=0.05$. "GLIE" (avidité dans la limite avec exploration infinie) est la condition de convergence.
- **Max bias in Q-learning.**Le `max`l' opérateur est biaisé vers le haut lorsque $Q$Le double Q-learning de Hasselt (utilisé par DDQN dans la leçon 05) corrige cette situation avec deux tables Q.
- **Non-terminating episodes.**TD peut apprendre sans terminaux, mais vous devez soit enfoncer les étapes ou gérer correctement le démarrage au cap.
- **State hashing.**Si les états sont des tuples/tensors, utilisez une touche hachable (tuple, pas liste; tuple de flottes arrondie, pas crue).

## Utilisez-le

Le paysage de la TD de 2026:

| Task | Method | Reason |
|------|--------|--------|
| Small tabular environments | Q-learning | Learns optimal policy directly. |
| On-policy safety-critical | SARSA / Expected SARSA | Conservative during exploration. |
| High-dimensional state | DQN (Phase 9 · 05) | Neural-net Q-function with replay and target net. |
| Continuous actions | SAC / TD3 (Phase 9 · 07) | TD update on a Q-network; policy net emits actions. |
| LLM RL (reward-model-based) | PPO / GRPO (Phase 9 · 08, 12) | Actor-critic with TD-style advantage via GAE. |
| Offline RL | CQL / IQL (Phase 9 · 08) | Q-learning with conservative regularization. |

90% des "RL" que vous lisez dans les articles 2026 sont une élaboration de Q-learning ou SARSA.

## La faire partir

- Je ne sais pas .`outputs/skill-td-agent.md`- Le numéro de la liste:

```markdown
---
name: td-agent
description: Pick between Q-learning, SARSA, Expected SARSA for a tabular or small-feature RL task.
version: 1.0.0
phase: 9
lesson: 4
tags: [rl, td-learning, q-learning, sarsa]
---

Given a tabular or small-feature environment, output:

1. Algorithm. Q-learning / SARSA / Expected SARSA / n-step variant. One-sentence reason tied to on-policy vs off-policy and variance.
2. Hyperparameters. α, γ, ε, decay schedule.
3. Initialization. Q_0 value (optimistic vs zero) and justification.
4. Convergence diagnostic. Target learning curve, `|Q - Q*|` check if DP is possible.
5. Deployment caveat. How will exploration behave at inference? Is SARSA's conservatism needed?

Refuse to apply tabular TD to state spaces > 10⁶. Refuse to ship a Q-learning agent without a max-bias caveat. Flag any agent trained with ε held at 1.0 throughout (no exploitation phase).
```

## Exercices

1. **Easy.**Implémenter Q-learning et SARSA sur le 4×4 GridWorld. Plot des courbes d'apprentissage (retour moyen par 100 épisodes) pour 2000 épisodes. Qui converge plus vite?
2. **Medium.**Construisez un environnement de marche sur un cliff (4x12, la dernière rangée est le cliff avec récompense -100 et réinitialisez pour commencer). Comparer les politiques finales de Q-learning et SARSA.
3. **Hard.**Implémentation du double Q-learning. sur un grille-monde bruyant-récompensation (bruit gaussien $\sigma=5$ajoutés à la récompense par étape), montrer des surestimations de l'apprentissage Q $V^{\ast}(0,0)$Il est vrai que les deux types d'apprentissage sont différents.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| TD error | "The update signal" | $\delta = r + \gamma V(s') - V(s)$, the bootstrapped residual. |
| TD(0) | "One-step TD" | Update after every transition using only the next state's estimate. |
| Q-learning | "Off-policy RL 101" | TD update with `max` over next-state actions; learns $Q^{\ast}$ regardless of behavior policy. |
| SARSA | "On-policy Q-learning" | TD update using the actual next action; learns $Q^\pi$ for current ε-greedy π. |
| Expected SARSA | "The low-variance SARSA" | Replace sampled $a'$ with its expectation under π. |
| GLIE | "Correct exploration schedule" | Greedy in the Limit with Infinite Exploration; needed for Q-learning convergence. |
| Bootstrapping | "Using current estimate in the target" | What distinguishes TD from MC. Source of bias but massive variance reduction. |
| Maximization bias | "Q-learning overestimates" | `max` over noisy estimates is upward-biased; fixed by Double Q-learning. |

## Pour en savoir plus

- [Watkins & Dayan (1992). Q-learning](https://link.springer.com/article/10.1007/BF00992698) le papier original et la preuve de convergence.
- [Sutton & Barto (2018). Ch. 6 — Temporal-Difference Learning](http://incompleteideas.net/book/RLbook2020.pdf) TD(0), SARSA, Q-apprentissage, SARSA attendue.
- [Hasselt (2010). Double Q-learning](https://papers.nips.cc/paper_files/paper/2010/hash/091d584fced301b442654dd8c23b3fc9-Abstract.html) fixer le biais de maximisation.
- [Seijen, Hasselt, Whiteson, Wiering (2009). A Theoretical and Empirical Analysis of Expected SARSA](https://ieeexplore.ieee.org/document/4927542) motivation attendue par le SARSA.
- [Rummery & Niranjan (1994). On-line Q-learning using connectionist systems](https://www.researchgate.net/publication/2500611_On-Line_Q-Learning_Using_Connectionist_Systems) le document qui a inventé SARSA (alors appelé "apprentissage Q-connexion modifié").
- [Sutton & Barto (2018). Ch. 7 — n-step Bootstrapping](http://incompleteideas.net/book/RLbook2020.pdf) généralise le TD(0) à TD(n), le chemin de l'apprentissage Q aux traces d'admissibilité et, plus tard, de l'AEG en PPO.
