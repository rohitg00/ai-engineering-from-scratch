# RL pour les jeux  AlphaZero, MuZero et l'ère du LLM-Rasoning

> 1992: TD-Gammon bat les champions humains au backgammon avec une pure TD. 2016: AlphaGo bat Lee Sedol. 2017: AlphaZero domine les échecs, les shogi et le Go à partir de zéro. 2025: DeepSeek-R1 prouve la même recette, avec GRPO remplaçant PPO, fonctionne sur le raisonnement.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 05 (DQN), Phase 9 · 08 (PPO), Phase 9 · 09 (RLHF), Phase 9 · 10 (MARL)
**Time:** ~120 minutes

## Le problème

Les jeux ont tout ce que RL veut. Récompense propre (gagnant/perte). Épisodes infinies (auto-jeu réinitialisé). Simulation parfaite (le jeu *est* le simulateur). espaces d'action discrets ou petits en continu. Structure multi-agent qui force la robustesse des adversaires.

Et les jeux sont la façon dont chaque grande percée RL a été testée. Le projet de loi sur les droits de l'homme (TD-Gammon, 1992) Le projet de loi de 2013 sur les droits de l'homme Le projet de loi de 2006 Le groupe AlphaZero (2017). Le projet de loi de l'Union européenne sur les droits de l'homme (DOT 2, 2019) AlphaStar (StarCraft II, 2019). MuZero (modèle apprenant, 2019). AlphaTensor (multiplication de matrice, 2022). AlphaDev (algorithmes de tri, 2023). DeepSeek-R1 (réasonnement mathématique, 2025)  la dernière démonstration que les techniques de jeu-RL fonctionnent sur le texte.

Cette pierre angulaire surveille les trois architectures marquantes  AlphaZero, MuZero et GRPO  à travers un seul objectif unificateur: **self-play + search + policy improvement**. Chacun généralise le précédent; GRPO en particulier est la recette d'AlphaZero appliquée au raisonnement LLM, avec des jetons comme actions et une vérification mathématique comme signal gagnant.

## Le concept

![AlphaZero ↔ MuZero ↔ GRPO: same loop, different environments](../assets/rl-games.svg)

**The unifying loop.**

```
while True:
    trajectory = self_play(current_policy, search)     # play game against self
    policy_target = search.improved_policy(trajectory) # search improves raw policy
    policy_net.update(policy_target, value_target)     # supervised on search output
```

**AlphaZero (2017).**Silver et al. Un jeu (échecs, shogi, Go) avec des règles connues:

- Réseau de valeur politique: une tour $f_\theta(s) \to (p, v)$- Je suis là .$p$est un précurseur sur les mouvements juridiques. $v$est le résultat attendu du jeu.
- Monte Carlo Tree Search (MCTS): à chaque mouvement, élargir un arbre de possibilités de continuation.$(p, v)$comme le précédent + la bande de démarrage. Sélectionnez les nœuds par UCB (PUCT): $a^{\ast} = \arg\max_a Q(s, a) + c \cdot p(a \mid s) \cdot \sqrt{N(s)} / (1 + N(s, a))$- Je suis désolé .
- Jouer à soi-même: jouer à des jeux agent-agent.$t$, la distribution des visites du MCTS $\pi_t$Il est également possible de faire des efforts pour améliorer la qualité de la formation.
- Perte:$L = (v - z)^2 - \pi \cdot \log p + c \cdot \lVert \theta \rVert^2$- Je suis là .$z$est le résultat du jeu (+1 / 0 / -1).

Zéro connaissance humaine, zéro heuristique artisanale, une recette unique qui maîtrisait les échecs, le shogi et le go après quelques dizaines de millions de jeux d'auto-jouer chacun.

**MuZero (2019).**Schrittwieser et al. Supprime l'exigence de connaître les règles.

- Au lieu d'un environnement fixe, apprenez un modèle de dynamique latente.$(h, g, f)$- Le numéro de la liste:
  - $h(s)$: encodez l'observation à un état latent.
  - $g(s_{\text{latent}}, a)$: prédire le prochain état latent + récompense.
  - $f(s_{\text{latent}})$: prévoir la politique prioritaire + valeur.
- MCTS fonctionne dans l'espace latent appris.
- Fonctionne sur Go, échecs, shogi et Atari, un algorithme, aucune connaissance des règles.

**Stochastic MuZero (2022).**Ajout de dynamique stochastique et de nœuds de chance; s'étend aux jeux de classe backgammon.

**Muesli, Gumbel MuZero (2022-2024).**Amélioration de l'efficacité de l'échantillon et de la recherche déterministe.

**GRPO (2024-2025).**La même boucle en forme d'AlphaZero, appliquée au raisonnement du modèle de langage:

- "Jeu": répondre à un problème mathématique / de codage / de raisonnement. "Vincre" = vérificateur (test case passes, correspondances numériques de réponse) renvoie 1.
- Politique: le LLM. Actions: jetons. État: prompt + réponse-jusqu'à présent.
- Aucun critique (au style PPO $V_\phi$Dans chaque cas, il faut prendre un échantillon.$G$Les résultats de la politique sont complétés.**group-relative advantage** $A_i = (r_i - \text{mean}_r) / \text{std}_r$comme signal de mise à jour de style REINFORCE.
- KL pénalité à la politique de référence pour prévenir la dérive (comme RLHF).
- Perte totale:

  $L_{\text{GRPO}}(\theta) = -\mathbb E_{q, \lbrace o_i \rbrace} \left[ \frac{1}{G} \sum_i A_i \cdot \log \pi_\theta(o_i \mid q) \right] + \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{ref}})$

Aucun modèle de récompense appris, aucun critique, aucun MCTS. Un vérificateur basé sur des règles fournit la récompense, la ligne de base relative au groupe remplace le critique et la étape de recherche est abandonnée.

**The R1 recipe in full.**DeepSeek-R1 (DeepSeek 2025) est constitué de deux modèles dans un seul document:

- **R1-Zero.**Commencez par le modèle de base DeepSeek-V3. Pas de SFT. Appliquez GRPO directement avec deux composants de récompense: *récompense de précision* (basée sur des règles  a-t-il analysé la réponse finale au bon nombre / le code a-t-il passé les tests d'unité) et *récompense de format* (a-t-il enveloppé sa chaîne de pensée en `<think>…</think>`Les résultats de la recherche de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de calcul de la méthode de calcul de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de calcul de la méthode de calcul de la méthode de calcul de la méthode de la méthode de calcul de la méthode de calcul de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de la méthode de calcul de
- **R1.**Réparer les problèmes de lisibilité de R1-Zero avec un pipeline en quatre étapes:
  1. **Cold-start SFT.**Rassemblez quelques milliers de démonstrations longues de CoT avec un formatage propre.
  2. **Reasoning-oriented GRPO.**Appliquer GRPO avec les récompenses de précision + format plus une récompense de cohérence de langage pour éviter le changement de code.
  3. **Rejection sampling + SFT round 2.**Prenez des trajectories de raisonnement de 600 000 à partir du point de contrôle RL, conservez seulement celles avec des réponses finales correctes et une CoT lisible, et combinez avec 200 000 exemples de SFT non raisonnables (écriture, QA, auto-cognition).
  4. **Full-spectrum GRPO.**Une nouvelle ronde de RL couvrant à la fois le raisonnement (récompenses basées sur les règles) et l'alignement général (récompenses basées sur les préférences d'utilité/impérience).

Le résultat correspond à l'o1 sur l'AIME et MATH-500 à poids ouverts, et est assez petit pour distiller. Le même document libère également six modèles denses distillés (Qwen-1.5B à Llama-70B) en SFT'ing sur les traces de raisonnement de R1  pas de RL chez l'étudiant.

**Why GRPO instead of PPO for reasoning.**Trois raisons dans le document DeepSeekMath (février 2024): (1) aucun réseau de valeur à former, réduisant de moitié la mémoire; (2) la ligne de base du groupe gère naturellement la récompense rare de fin de trajectoire que produisent les tâches de raisonnement; (3) la normalisation par prompt rend les avantages comparables sur des problèmes de difficulté très différente, ce que le seul critique de PPO ne peut pas faire.

**Search-free vs search-based.**Les jeux se sont succédé:

- *Jeux d'information parfaits avec de longs horizons* (Go, échecs): toujours basés sur la recherche. AlphaZero / MuZero dominent.
- *Réconciliation LLM*: aucun MCTS n'est encore en production; GRPO sur des déploiements complets, meilleur de N pour le calcul des inférences.

```figure
f3-selfplay-ladder
```

## Faites-le

Le code dans `code/main.py`les implémentations **GRPO in miniature**L'algorithme est le même qu'un LLM; seulement la politique et l'environnement sont plus simples. Il enseigne la *perte* et l'avantage relatif au groupe*, qui est l'innovation 2024 de DeepSeekMath.

### Étape 1: un petit environnement de vérification

```python
QUESTIONS = [
    {"prompt": "q1", "correct": 3},
    {"prompt": "q2", "correct": 1},
]

def verify(prompt_idx, answer_token):
    return 1.0 if answer_token == QUESTIONS[prompt_idx]["correct"] else 0.0
```

Dans le GRPO réel, le vérificateur effectue des tests unitaires ou vérifie l'égalité mathématique.

### Étape 2: politique: softmax sur K des jetons de réponse par prompt

```python
def policy_probs(theta, p_idx):
    return softmax(theta[p_idx])
```

Équivalent à la production finale d'un LLM conditionné à un prompt.

### Étape 3: Prélèvement par groupe et avantage par groupe

```python
def grpo_step(theta, p_idx, G=8, beta=0.01, lr=0.1, rng=None):
    probs = policy_probs(theta, p_idx)
    samples = [sample(probs, rng) for _ in range(G)]
    rewards = [verify(p_idx, s) for s in samples]
    mean_r = sum(rewards) / G
    std_r = stddev(rewards) + 1e-8
    advs = [(r - mean_r) / std_r for r in rewards]

    for a, A in zip(samples, advs):
        grad = onehot(a) - probs
        for i in range(len(probs)):
            theta[p_idx][i] += lr * A * grad[i]
    # KL penalty: pull theta toward reference
    for i in range(len(probs)):
        theta[p_idx][i] -= beta * (theta[p_idx][i] - reference[p_idx][i])
```

L'avantage relatif au groupe est le truc DeepSeek 2024. Aucun critique n'est nécessaire.

### Étape 4: comparer avec la ligne de base de REINFORCE (sans valeur)

La même configuration, le même calcul, la même force de réaction.

### Étape 5: observez l'entropie et KL

Les mêmes diagnostics que la RLHF: moyenne KL à référence, entropie politique, récompense au-delà du temps.

## Les pièges

- **Reward hacking via verifier gaming.**Le GRPO hérite du risque de la RLHF: si le vérificateur est erroné ou exploitable, le MLL trouvera l'exploit.
- **Group size too small.**La variation de la moyenne de base du groupe est la suivante:$1/G$(son erreur standard comme $1/\sqrt{G}$Ci-dessous .$G = 4$, le signal d' avantage est bruyant; choix standard est $G = 8$à 64.
- **Length bias.**Les résultats de LLM de différentes longueurs ont des probabilités de logs différentes.
- **Pure self-play cycles.**L'entraînement de style AlphaZero peut être bloqué dans des boucles de domination sur les jeux de somme générale.
- **Search-policy mismatch.**AlphaZero entraîne la politique pour imiter les résultats de recherche. Si le réseau de politique est trop petit pour représenter la distribution de la recherche, la formation est suspendue.
- **Compute floor.**MuZero / AlphaZero nécessite un calcul massif. Une seule ablation est souvent de centaines d'heures de GPU. Des démos miniatures existent (par exemple, AlphaZero sur Connect Four) pour l'apprentissage.
- **Verifier coverage.**Les tests unitaires qui réussissent pour une solution de buggy renforcent le bug.

## Utilisez-le

Le paysage du jeu-RL 2026 par domaine:

| Domain | Dominant method |
|--------|-----------------|
| Two-player zero-sum board games (Go, chess, shogi) | AlphaZero / MuZero / KataGo |
| Imperfect info card games (poker) | CFR + deep learning (DeepStack, Libratus, Pluribus) |
| Atari / pixel games | Muesli / MuZero / IMPALA-PPO |
| Large multiplayer strategy (Dota, StarCraft) | PPO + self-play + league (OpenAI Five, AlphaStar) |
| LLM math/code reasoning | GRPO (DeepSeek-R1, Qwen-RL, open replications) |
| LLM alignment | DPO / RLHF-PPO (not GRPO; verifier is preference not verifiable) |
| Robotics | PPO + DR (not game-RL, but uses same policy-gradient tools) |
| Combinatorial problems | AlphaZero variants (AlphaTensor, AlphaDev) |

La recette *recipe*  auto-joue, amélioration augmentée par la recherche, distillation de politique  couvre le texte, les pixels et le contrôle physique.

## La faire partir

- Je ne sais pas .`outputs/skill-game-rl-designer.md`- Le numéro de la liste:

```markdown
---
name: game-rl-designer
description: Design a game-RL or reasoning-RL training pipeline (AlphaZero / MuZero / GRPO) for a given domain.
version: 1.0.0
phase: 9
lesson: 12
tags: [rl, alphazero, muzero, grpo, self-play]
---

Given a target (perfect-info game / imperfect-info / Atari / LLM reasoning / combinatorial), output:

1. Environment fit. Known rules? Markov? Stochastic? Multi-agent? Informs AlphaZero vs MuZero vs GRPO.
2. Search strategy. MCTS (PUCT with learned prior), Gumbel-sampled, best-of-N, or none.
3. Self-play plan. Symmetric self-play / league / offline data / verifier-generated.
4. Target signal. Game outcome / verifier reward / preference / learned model. Include robustness plan.
5. Diagnostics. Win rate vs baseline, ELO curve, verifier pass rate, KL to reference.

Refuse AlphaZero on imperfect-info games (route to CFR). Refuse GRPO without a trusted verifier. Refuse any game-RL pipeline without a fixed baseline opponent set (self-play ELO is uncalibrated otherwise).
```

## Exercices

1. **Easy.**Mettre en œuvre le bandit GRPO en `code/main.py`. Traînez sur 2 demandes × 4 jetons de réponse chacun. Converger dans < 1000 mises à jour avec $G=8$- Je suis désolé .
2. **Medium.**Comparer l'efficacité de l'échantillon et la variance de la récompense avec la GRPO sur le même bandit.
3. **Hard.**Prendre une longueur à 2 "chaîne de raisonnement": l'agent émet deux jetons et le vérificateur récompense la paire. Mesurer comment GRPO gère l'attribution de crédit sur deux séquences de étapes. (Conseil: calculer l'avantage du groupe par *sequence complète*, propager aux deux positions de jetons.)

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| MCTS | "Tree search with learned net" | Monte Carlo Tree Search; UCB1/PUCT selection with learned $(p, v)$ priors. |
| AlphaZero | "Self-play + MCTS" | Policy-value net trained to match MCTS visits and game outcome. |
| MuZero | "Learned-model AlphaZero" | Same loop but in latent space via learned dynamics. |
| GRPO | "Critic-free PPO" | Group Relative Policy Optimization; REINFORCE with group-mean baseline + KL. |
| PUCT | "AlphaZero's UCB" | $Q + c \cdot p \cdot \sqrt{N} / (1 + N_a)$ — balances value estimate with prior. |
| Self-play | "Agent vs past self" | Standard for zero-sum; symmetric training signal. |
| League play | "Population-based self-play" | Past + current + exploiters sampled as opponents. |
| Verifier reward | "Verifiable RL" | Reward comes from a deterministic checker (tests pass, answer matches). |
| Process reward | "PRM" | Scores each reasoning step, not just the final answer. |

## Pour en savoir plus

- [Silver et al. (2017). Mastering the game of Go without human knowledge (AlphaGo Zero)](https://www.nature.com/articles/nature24270)- Je suis désolé .
- [Silver et al. (2018). A general reinforcement learning algorithm that masters chess, shogi, and Go through self-play (AlphaZero)](https://www.science.org/doi/10.1126/science.aar6404)- Je suis désolé .
- [Schrittwieser et al. (2020). Mastering Atari, Go, chess and shogi by planning with a learned model (MuZero)](https://www.nature.com/articles/s41586-020-03051-4)- Je suis désolé .
- [Vinyals et al. (2019). Grandmaster level in StarCraft II (AlphaStar)](https://www.nature.com/articles/s41586-019-1724-z)- Je suis désolé .
- [DeepSeek-AI (2024). DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models (GRPO)](https://arxiv.org/abs/2402.03300) le document qui introduit le GRPO et la référence par groupe.
- [DeepSeek-AI (2025). DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning](https://arxiv.org/abs/2501.12948) la recette R1 complète en quatre étapes plus l'ablation R1-Zero.
- [Brown et al. (2019). Superhuman AI for multiplayer poker (Pluribus)](https://www.science.org/doi/10.1126/science.aay2400) CFR + apprentissage en profondeur à l'échelle.
- [Tesauro (1995). Temporal Difference Learning and TD-Gammon](https://dl.acm.org/doi/10.1145/203330.203343)Le journal qui a tout commencé.
- [Hugging Face TRL — GRPOTrainer](https://huggingface.co/docs/trl/main/en/grpo_trainer) la référence de production pour l'application de GRPO avec des fonctions de récompense personnalisées.
- [Qwen Team (2024). Qwen2.5-Math — GRPO replication](https://github.com/QwenLM/Qwen2.5-Math) réplique ouverte de la recette R1 à plusieurs échelles.
- [Sutton & Barto (2018). Ch. 17 — Frontiers of Reinforcement Learning](http://incompleteideas.net/book/RLbook2020.pdf) le cadre du manuel de lecture pour le jeu personnel, la recherche et la "récompense conçue" que R1 instantie à l'échelle de la maîtrise en droit.
