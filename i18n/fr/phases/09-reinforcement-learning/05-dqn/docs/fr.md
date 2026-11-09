# Réseaux Q profonds (DQN)

> 2013: Mnih entraîne un réseau d'apprentissage Q sur des pixels bruts, bat tous les agents RL classiques sur sept jeux Atari. 2015: étendu à 49 jeux, publié dans Nature, déclenche l'ère de la profondeur RL. DQN est Q-apprentissage plus trois astuces qui rendent l'approximation de fonction stable.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 03 (Backpropagation), Phase 9 · 04 (Q-learning, SARSA)
**Time:** ~75 minutes

## Le problème

L'apprentissage de Q tabulaire nécessite une valeur Q distincte pour chaque paire (état, action). Une planche d'échecs a ~1043 états. Un cadre Atari est 210 × 160 × 3 = 100 800 caractéristiques.

La solution est évidente en arrière-plan: remplacer la table Q par un réseau neural,$Q(s, a; \theta)$. Mais l'approximation des fonctions naïves avec l'apprentissage Q diverge sous la " triade mortelle "  approximation des fonctions + démarrage + apprentissage hors politique. Mnih et al. (2013, 2015) ont identifié trois astuces d'ingénierie qui stabilisent l'apprentissage:

1. **Experience replay**déco-corrélate les transitions.
2. **Target network**gelant la cible du démarrage.
3. **Reward clipping**normalizes les magnitudes de gradient.

DQN sur Atari est la première fois qu'une seule architecture avec un seul ensemble d'hyperparamètres a résolu des dizaines de problèmes de contrôle à partir de pixels bruts. Tout ce qui est "deep-RL" construit depuis DDQN, Rainbow, Dueling, Distribution, R2D2, Agent57  est empilé sur cette base de trois tours.

## Le concept

![DQN training loop: env, replay buffer, online net, target net, Bellman TD loss](../assets/dqn.svg)

**The objective.**Le DQN réduit au minimum la perte de TD en une étape sur une fonction Q neuronale:

```math
L(\theta) = \mathbb{E}_{(s,a,r,s') \sim D}[ (r + \gamma \max_{a'} Q(s', a'; \theta^-) - Q(s, a; \theta))^2 ]
```

$\theta$= réseau en ligne, mis à jour à chaque étape par déclin de gradient. $\theta^-$= réseau cible, copié périodiquement à partir de $\theta$(à chaque 10 000 pas). $D$= tampon de répétition des transitions passées.

**The three tricks, in order of importance:**

**Experience replay.**Un tampon de bague de `~10⁶`Les transitions de formation sont effectuées par des équipes de formation qui ont des échantillons de type mini par lots aléatoires.

**Target network.**En utilisant le même réseau $Q(\cdot; \theta)$Les deux côtés de l'équation Bellman font que la cible se déplace à chaque mise à jour  " chasse à sa propre queue. " La solution: garder un deuxième réseau $Q(\cdot; \theta^-)$avec des poids gelés.$C$Pas, copie $\theta \to \theta^-$Cela stabilise la cible de régression pour des milliers d'étapes de gradient à la fois.$\theta^- \leftarrow \tau \theta + (1-\tau) \theta^-$(utilisés dans le DDPG, SAC) sont une variante plus lisse.

**Reward clipping.**Les magnitudes de récompense Atari varient de 1 à 1000+.$\lbrace-1, 0, +1 \rbrace$Faut quand la récompense importe, c'est bien pour Atari quand il ne s'agit que de signes.

**Double DQN.**Hasselt (2016) corrige le biais de maximisation: utilisez le net en ligne pour * sélectionner* l'action, le net cible pour * l'évaluer*.

```math
\text{target} = r + \gamma Q(s', \arg\max_{a'} Q(s', a'; \theta); \theta^-)
```

Le remplacement est toujours mieux.

**Other improvements (Rainbow, 2017):**réplique prioritaire (échantillons de transitions à forte TD-erreur plus), architecture duel (separé $V(s)$Les résultats obtenus sont: les réseaux bruyants (exploration apprise), les retours en n étapes, la distribution Q (C51/QR-DQN), le démarrage en plusieurs étapes.

```figure
f3-dqn-stability
```

## Faites-le

Le code ici est stdlib-only numpy-free  nous utilisons un MLP à couche cachée roulée à la main sur un petit continu GridWorld, donc chaque étape d'entraînement se déroule en microsecondes. L'algorithme est identique à Atari DQN à l'échelle.

### Étape 1: tampon de répétition

```python
class ReplayBuffer:
    def __init__(self, capacity):
        self.buf = []
        self.capacity = capacity
    def push(self, s, a, r, s_next, done):
        if len(self.buf) == self.capacity:
            self.buf.pop(0)
        self.buf.append((s, a, r, s_next, done))
    def sample(self, batch, rng):
        return rng.sample(self.buf, batch)
```

~106 capacité pour Atari, comme dans le DQN original (il recueille 50 000 transitions avant le début de l'apprentissage); 5 000 suffisent pour notre environnement de jouets.

### Étape 2: un petit réseau Q (MLP manuel)

```python
class QNet:
    def __init__(self, n_in, n_hidden, n_actions, rng):
        self.W1 = [[rng.gauss(0, 0.3) for _ in range(n_in)] for _ in range(n_hidden)]
        self.b1 = [0.0] * n_hidden
        self.W2 = [[rng.gauss(0, 0.3) for _ in range(n_hidden)] for _ in range(n_actions)]
        self.b2 = [0.0] * n_actions
    def forward(self, x):
        h = [max(0.0, sum(w * xi for w, xi in zip(row, x)) + b) for row, b in zip(self.W1, self.b1)]
        q = [sum(w * hi for w, hi in zip(row, h)) + b for row, b in zip(self.W2, self.b2)]
        return q, h
```

Pass avant: linéaire → ReLU → linéaire.

### Étape 3: mise à jour du DQN

```python
def train_step(online, target, batch, gamma, lr):
    grads = zeros_like(online)
    for s, a, r, s_next, done in batch:
        q, h = online.forward(s)
        if done:
            y = r
        else:
            q_next, _ = target.forward(s_next)
            y = r + gamma * max(q_next)
        td_error = q[a] - y
        accumulate_grads(grads, online, s, h, a, td_error)
    apply_sgd(online, grads, lr / len(batch))
```

La forme est Q-apprentissage de la leçon 04 avec deux différences: a) nous nous rapprochons par un différenciable $Q(\cdot; \theta)$au lieu d'indiquer un tableau, b) les utilisations cibles $Q(\cdot; \theta^-)$- Je suis désolé .

### Étape 4: boucle extérieure

Pour chaque épisode, agissez avec avidité.$Q(\cdot; \theta)$, poussez les transitions dans le tampon, prenez un échantillon d'un minibatch, faites un pas de gradient, synchronisez périodiquement$\theta^- \leftarrow \theta$Le modèle:

```python
for episode in range(N):
    s = env.reset()
    while not done:
        a = epsilon_greedy(online, s, epsilon)
        s_next, r, done = env.step(s, a)
        buffer.push(s, a, r, s_next, done)
        if len(buffer) >= batch:
            train_step(online, target, buffer.sample(batch), gamma, lr)
        if steps % sync_every == 0:
            target = copy(online)
        s = s_next
```

Sur notre petit GridWorld avec un état unique de 16 dimensions, l'agent apprend une politique presque optimale en environ 500 épisodes. sur Atari, élargir à 200M cadres et ajouter un extracteur de fonctionnalités CNN.

## Les pièges

- **Deadly triad.**L'approximation des fonctions + hors politique + démarrage peut diverger. DQN atténue avec la mise en réseau cible + répétition; ne supprimez pas les deux.
- **Exploration.**Le Q-net doit se décomposer, généralement de 1,0 à 0,01 au cours des premières ~10% de l'entraînement.
- **Overestimation.** `max`Le Q bruyant est partial.
- **Reward scale.**Clip ou normaliser les récompenses; la magnitude du gradient est proportionnelle à la magnitude de la récompense.
- **Replay buffer coldstart.**Ne vous entraînez pas avant que le tampon ait quelques milliers de transitions.
- **Target sync frequency.**Trop fréquent ≈ pas de filet cible; trop rare ≈ cibles obsolètes. Atari DQN utilise 10 000 étapes env. Règle générale: synchronisez chaque 1/100 de l'horizon d'entraînement.
- **Observation preprocessing.**L'Atari DQN empile 4 images pour faire l'état Markov.

## Utilisez-le

En 2026, DQN est rarement à la pointe de la technologie mais reste l'algorithme de référence hors politique:

| Task | Method of choice | Why not DQN? |
|------|------------------|--------------|
| Discrete-action Atari-like | Rainbow DQN or Muesli | Same framework, more tricks. |
| Continuous control | SAC / TD3 (Phase 9 · 07) | DQN has no policy network. |
| On-policy / high-throughput | PPO (Phase 9 · 08) | No replay buffer; easier to scale. |
| Offline RL | CQL / IQL / Decision Transformer | Conservative Q targets, no bootstrapping blowups. |
| Large discrete action spaces (recommender) | DQN with action embedding, or IMPALA | Fine; decoration matters. |
| LLM RL | PPO / GRPO | Sequence-level, not step-level; different loss. |

Les leçons sont toujours en cours. La lecture et les réseaux cibles apparaissent dans SAC, TD3, DDPG, SAC-X, le tampon de lecture automatique d'AlphaZero et toutes les méthodes de RL hors ligne.

## La faire partir

- Je ne sais pas .`outputs/skill-dqn-trainer.md`- Le numéro de la liste:

```markdown
---
name: dqn-trainer
description: Produce a DQN training config (buffer, target sync, ε schedule, reward clipping) for a discrete-action RL task.
version: 1.0.0
phase: 9
lesson: 5
tags: [rl, dqn, deep-rl]
---

Given a discrete-action environment (observation shape, action count, horizon, reward scale), output:

1. Network. Architecture (MLP / CNN / Transformer), feature dim, depth.
2. Replay buffer. Capacity, minibatch size, warmup size.
3. Target network. Sync strategy (hard every C steps or soft τ).
4. Exploration. ε start / end / schedule length.
5. Loss. Huber vs MSE, gradient clip value, reward clipping rule.
6. Double DQN. On by default unless explicit reason to disable.

Refuse to ship a DQN with no target network, no replay buffer, or ε held at 1. Refuse continuous-action tasks (route to SAC / TD3). Flag any reward range > 10× per-step mean as needing clipping or scale normalization.
```

## Exercices

1. **Easy.**On court .`code/main.py`Combien d'épisodes avant que la moyenne de course dépasse -10 ?
2. **Medium.**Désactiver le réseau cible (utiliser le réseau en ligne pour les deux côtés de la cible Bellman). Mesurer l'instabilité de l'entraînement  est-ce que le retour oscille ou diverge?
3. **Hard.**Ajouter le double DQN: utilisez le réseau en ligne pour choisir `argmax a'`Les résultats de l'analyse de la recherche ont été évalués en fonction des résultats obtenus.`Q(s_0, best_a)`contre vrai $V^{\ast}(s_0)$Après 1000 épisodes avec vs sans Double DQN sur un grille-World.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| DQN | "Deep Q-learning" | Q-learning with a neural Q-function, replay buffer, and target network. |
| Experience replay | "Shuffled transitions" | Ring buffer sampled uniformly each gradient step; decorrelates data. |
| Target network | "Frozen bootstrap" | Periodic copy of Q used in the Bellman target; stabilizes training. |
| Deadly triad | "Why RL diverges" | Function approximation + bootstrapping + off-policy = no convergence guarantee. |
| Double DQN | "Fix for maximization bias" | Online net selects action, target net evaluates it. |
| Dueling DQN | "V and A heads" | Decompose Q = V + A - mean(A); same output, better gradient flow. |
| Rainbow | "All the tricks" | DDQN + PER + dueling + n-step + noisy + distributional in one. |
| PER | "Prioritized Replay" | Sample transitions proportional to TD-error magnitude. |

## Pour en savoir plus

- [Mnih et al. (2013). Playing Atari with Deep Reinforcement Learning](https://arxiv.org/abs/1312.5602) le document d'atelier de 2013 sur NeurIPS qui a déclenché la RL profonde.
- [Mnih et al. (2015). Human-level control through deep reinforcement learning](https://www.nature.com/articles/nature14236) le journal Nature, 49 jeux de DQN.
- [Hasselt, Guez, Silver (2016). Deep Reinforcement Learning with Double Q-learning](https://arxiv.org/abs/1509.06461) DDQN.
- [Wang et al. (2016). Dueling Network Architectures](https://arxiv.org/abs/1511.06581)- Le duel de DQN.
- [Hessel et al. (2018). Rainbow: Combining Improvements in Deep RL](https://arxiv.org/abs/1710.02298)- Le papier de trucs empilés.
- [Sutton & Barto (2018). Ch. 9 — On-policy Prediction with Approximation](http://incompleteideas.net/book/RLbook2020.pdf) le traitement manuel de la "triade mortelle" (approximation des fonctions + démarrage + hors politique) que le réseau cible et le tampon de lecture de DQN sont conçus pour dompter.
- [CleanRL DQN implementation](https://docs.cleanrl.dev/rl-algorithms/dqn/) DQN de référence à fichier unique utilisé dans les études d'ablation; bon à lire à côté de la version originale de cette leçon.
