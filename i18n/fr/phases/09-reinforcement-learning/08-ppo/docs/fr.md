# Optimisation des politiques proximales (PPO)

> A2C jette chaque déploiement après une mise à jour. PPO enveloppe le gradient de politique dans un ratio d'importance réduit afin que vous puissiez faire 10+ époques sur les mêmes données sans que la politique explose. Schulman et al. (2017).

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 9 · 06 (REINFORCE), Phase 9 · 07 (Actor-Critic)
**Time:** ~75 minutes

## Le problème

A2C (leçon 07) est sur la politique: le gradient $\mathbb E_{\pi_\theta}[A \cdot \nabla \log \pi_\theta]$nécessite des données prélevées à partir du * courant* $\pi_\theta$- Prenez une mise à jour, et $\pi_\theta$Les données que vous avez utilisées sont désormais hors politique.

Les déploiements sont chers. Sur Atari, un déploiement sur 8 envs × 128 étapes = 1024 transitions et une douzaine de secondes de temps environnemental. Jeter cela après un pas de gradient est gaspillé.

L'optimisation des politiques de la région de confiance (TRPO, Schulman 2015) a été la première solution: restreindre chaque mise à jour afin que la divergence KL entre les anciennes et les nouvelles politiques reste inférieure $\delta$- En théorie propre, mais nécessite une solution de gradient conjugué par mise à jour.

PPO (Schulman et coll. 2017) remplace la contrainte de la région de confiance avec un objectif simple coupé. Une ligne de code supplémentaire. Dix époques par déploiement. Pas de gradients conjugués.

## Le concept

![PPO clipped surrogate objective: ratio clipping at 1 ± ε](../assets/ppo.svg)

**The importance ratio.**

```math
r_t(\theta) = \frac{\pi_\theta(a_t \mid s_t)}{\pi_{\theta_{\text{old}}}(a_t \mid s_t)}
```

Il s'agit du ratio de probabilité entre la nouvelle politique et la politique qui a recueilli les données. $r_t = 1$Ça ne change rien.$r_t = 2$Cela signifie que la nouvelle politique est deux fois plus susceptible de prendre$a_t$comme les anciens.

**The clipped surrogate.**

```math
L^{\text{CLIP}}(\theta) = \mathbb{E}_t \left[ \min\left( r_t(\theta) A_t, \mathop{\mathrm{clip}}(r_t(\theta), 1-\epsilon, 1+\epsilon) A_t \right) \right]
```

Deux termes:

- Si l' avantage $A_t > 0$et le ratio essaie de passer $1 + \epsilon$, le clip aplatit le gradient  ne pousse pas une bonne action plus loin que $+\epsilon$au-dessus de la vieille probabilité.
- Si l' avantage $A_t < 0$et le ratio tente de tomber en dessous $1 - \epsilon$(ce qui signifie que nous rendrions une mauvaise action beaucoup moins probable que l'ancienne politique), le clip aplatit le gradient: ne poussez pas une mauvaise action plus loin que $-\epsilon$- En dessous de la vraisemblance.

Le `min`Il s'agit de la direction opposée: si le ratio a déménagé dans la direction * bénéfique*, vous obtenez toujours le gradient (pas de coupure sur le côté qui vous ferait mal).

Typique$\epsilon = 0.2$. Tracer l'objectif en fonction de $r_t$: une fonction linéaire en morceaux avec un toit plat sur le "bon côté" et un plancher plat sur le "mauvais côté".

**The full PPO loss.**

```math
L(\theta, \phi) = L^{\text{CLIP}}(\theta) - c_v \cdot (V_\phi(s_t) - V_t^{\text{target}})^2 + c_e \cdot H(\pi_\theta(\cdot \mid s_t))
```

La même structure acteur-critique que l'A2C. Trois coefficients, généralement $c_v = 0.5$- Je suis là .$c_e = 0.01$- Je suis là .$\epsilon = 0.2$- Je suis désolé .

**The training loop.**

1. Rassembler$N \times T$transitions à travers $N$environnements parallèles pour $T$chaque étape.
2. Comptez les avantages (GAE), congélez-les comme constantes.
3. Le gel$\pi_{\theta_{\text{old}}}$comme une capture d'écran de courant $\pi_\theta$- Je suis désolé .
4. Pour $K$Les épisodes de la première série de l'époque sont les suivants:`(s, a, A, V_target, log π_old(a|s))`- Le numéro de la liste:
   - Compte $r_t(\theta) = \exp(\log \pi_\theta(a \mid s) - \log \pi_{\text{old}}(a \mid s))$- Je suis désolé .
   - Appliquer $L^{\text{CLIP}}$+ perte de valeur + entropie.
   - Un pas de plus.
5. Jetez le déploiement et retournez à l'étape 1.

$K = 10$Les données de l'analyse de la quantité de données de l'indice de référence sont très précises, et les mini-parts de 64 sont un ensemble standard d'hyperparamètres.

**KL-penalty variant.**Le document original proposait une alternative à l' utilisation d' une pénalité KL adaptative: $L = L^{\text{PG}} - \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{old}})$avec $\beta$La version de coupage est devenue dominante; la variante KL survit dans le RLHF (où KL à la politique de référence est une contrainte séparée que l'on veut toujours de toute façon).

```figure
ppo-clip
```

## Faites-le

### Étape 1: capture `log π_old(a | s)`au moment du déploiement

```python
for step in range(T):
    probs = softmax(logits(theta, state_features(s)))
    a = sample(probs, rng)
    s_next, r, done = env.step(s, a)
    buffer.append({
        "s": s, "a": a, "r": r, "done": done,
        "v_old": value(w, state_features(s)),
        "log_pi_old": log(probs[a] + 1e-12),
    })
    s = s_next
```

L'instantané est pris une fois, au moment du déploiement.

### Étape 2: calculer les avantages de l'AEG (leçon 07)

La même chose que l'A2C. Normalize à travers le lot.

### Étape 3: Mise à jour de substitution coupée

```python
for _ in range(K_EPOCHS):
    for mb in minibatches(buffer, size=64):
        for rec in mb:
            x = state_features(rec["s"])
            probs = softmax(logits(theta, x))
            logp = log(probs[rec["a"]] + 1e-12)
            ratio = exp(logp - rec["log_pi_old"])
            adv = rec["advantage"]
            surrogate = min(
                ratio * adv,
                clamp(ratio, 1 - EPS, 1 + EPS) * adv,
            )
            # backprop -surrogate, add value loss, subtract entropy
            grad_logpi = onehot(rec["a"]) - probs
            if (adv > 0 and ratio >= 1 + EPS) or (adv < 0 and ratio <= 1 - EPS):
                pg_grad = 0.0  # clipped
            else:
                pg_grad = ratio * adv
            for i in range(N_ACTIONS):
                for j in range(N_FEAT):
                    theta[i][j] += LR * pg_grad * grad_logpi[i] * x[j]
```

Le modèle "gradient réduit → zéro" est au cœur de la PPO. Si la nouvelle politique a déjà dérivé trop loin dans la direction bénéfique, la mise à jour s'arrête.

### Étape 4: valeur et entropie

Ajouter des MSE standard à la cible critique et un bonus d'entropie sur l'acteur, le même que A2C.

### Étape 5: diagnostic

Trois choses à regarder à chaque mise à jour:

- **Mean KL** $\mathbb{E}[\log \pi_{\text{old}} - \log \pi_\theta]$- Je devrais rester .`[0, 0.02]`Si ça passe ,`0.1`, réduire `K_EPOCHS`ou `LR`- Je suis désolé .
- **Clip fraction** la fraction des échantillons dont le ratio se trouve à l'extérieur $[1-\epsilon, 1+\epsilon]$- Ça devrait être .`~0.1-0.3`Si vous ...`~0`, le clip ne déclenche jamais → augmentation `LR`ou `K_EPOCHS`Si vous ...`~0.5+`Vous les faites trop bas.
- **Explained variance** $1 - \text{Var}(V_{\text{target}} - V_{\text{pred}}) / \text{Var}(V_{\text{target}})$Il devrait grimper vers 1 à mesure que le critique apprend.

## Les pièges

- **Clip coefficient mistuned.** $\epsilon = 0.2$C'est la norme de fait.`0.1`rend les mises à jour trop timides; `0.3+`Il y a une instabilité.
- **Too many epochs.** $K > 20$La politique de l'Union européenne est en train de détériorer de manière régulière la stabilité de l'Union européenne.$\pi_{\text{old}}$- Époques de cap, en particulier pour les grands réseaux.
- **No reward normalization.**Les grandes échelles de récompense entrent dans la gamme des clips.
- **Forgetting advantage normalization.**La normalisation par lot de zéro moyenne/unit-std est standard.
- **Learning rate not decayed.**La PPO bénéficie d'une décomposition de la LR linéaire à zéro.
- **Importance ratio math errors.**Toujours .`exp(log_new - log_old)`pour la stabilité numérique, non `new / old`- Je suis désolé .
- **Wrong gradient sign.**Maximiser la mère porteuse = *minimiser* $-L^{\text{CLIP}}$Un panneau inversé est le virus le plus courant.

## Utilisez-le

PPO est l'algorithme RL par défaut de 2026 sur un nombre surprenant de domaines:

| Use case | PPO variant |
|----------|-------------|
| MuJoCo / robotics control | PPO with Gaussian policy, GAE(0.95) |
| Atari / discrete games | PPO with categorical policy, rolling 128-step rollouts |
| RLHF for LLMs | PPO with KL penalty to reference model, reward from RM at end of response |
| Large-scale game agents | IMPALA + PPO (AlphaStar, OpenAI Five) |
| Reasoning LLMs | GRPO (Lesson 12) — PPO variant without critic |
| Preference-only data | DPO — closed-form collapsing of PPO+KL, no online sampling |

La forme de PPO *perte*  coupée surrogée + valeur + entropie  est l'échafaudage pour DPO, GRPO et presque tous les pipelines RLHF.

## La faire partir

- Je ne sais pas .`outputs/skill-ppo-trainer.md`- Le numéro de la liste:

```markdown
---
name: ppo-trainer
description: Produce a PPO training config and a diagnostic plan for a given environment.
version: 1.0.0
phase: 9
lesson: 8
tags: [rl, ppo, policy-gradient]
---

Given an environment and training budget, output:

1. Rollout size. `N` envs × `T` steps.
2. Update schedule. `K` epochs, minibatch size, LR schedule.
3. Surrogate params. `ε` (clip), `c_v`, `c_e`, advantage normalization on.
4. Advantage. GAE(`λ`) with explicit `γ` and `λ`.
5. Diagnostics plan. KL, clip fraction, explained variance thresholds with alerts.

Refuse `K > 30` or `ε > 0.3` (unsafe trust region). Refuse any PPO run without advantage normalization or KL/clip monitoring. Flag clip fraction sustained above 0.4 as drift.
```

## Exercices

1. **Easy.**Réglez le PPO sur 4×4 GridWorld avec $\epsilon=0.2, K=4$- Comparez l'efficacité de l'échantillon à A2C (une époque par déploiement) à des étapes d'environnement correspondantes.
2. **Medium.**- Le balayage .$K \in \lbrace 1, 4, 10, 30 \rbrace$- Retour de l'intrigue vers l'env étapes et suivre la moyenne KL par mise à jour.$K$KL explose sur cette tâche ?
3. **Hard.**Le remplaçant coupé est remplacé par une pénalité KL adaptative ($\beta$double si $\mathrm{KL} > 2 \cdot \text{target}$, réduit de moitié si $\mathrm{KL} < \text{target}/2$) Comparer le rendement final, la stabilité et la non-clip.

## Les termes clés

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Importance ratio | "r_t(θ)" | $\pi_\theta(a \mid s) / \pi_{\text{old}}(a \mid s)$; deviation from the policy that collected the data. |
| Clipped surrogate | "PPO's main trick" | $\min(r \cdot A, \mathop{\mathrm{clip}}(r, 1-\epsilon, 1+\epsilon) \cdot A)$; flat gradient past the clip on beneficial side. |
| Trust region | "TRPO / PPO intent" | Limit each update's KL to guarantee monotone improvement. |
| KL penalty | "Soft trust region" | Alternative PPO: $L - \beta \cdot \mathrm{KL}(\pi_\theta \Vert \pi_{\text{old}})$. Adaptive $\beta$. |
| Clip fraction | "How often clipping triggers" | Diagnostic — should be 0.1-0.3; outside means mistuned. |
| Multi-epoch training | "Data reuse" | K epochs on each rollout; variance cost traded for sample efficiency. |
| On-policy-ish | "Mostly on-policy" | PPO is nominally on-policy but K>1 epochs uses slightly-off-policy data safely. |
| PPO-KL | "The other PPO" | KL-penalty variant; used in RLHF where KL-to-reference is already a constraint. |

## Pour en savoir plus

- [Schulman et al. (2017). Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347)- Le journal.
- [Schulman et al. (2015). Trust Region Policy Optimization](https://arxiv.org/abs/1502.05477) TRPO, prédécesseur de PPO.
- [Andrychowicz et al. (2021). What Matters In On-Policy RL? A Large-Scale Empirical Study](https://arxiv.org/abs/2006.05990) tous les hyperparametres de PPO supprimés.
- [Ouyang et al. (2022). Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) InstructGPT; la recette de PPO-in-RLHF.
- [OpenAI Spinning Up — PPO](https://spinningup.openai.com/en/latest/algorithms/ppo.html) exposition moderne propre avec PyTorch.
- [CleanRL PPO implementation](https://github.com/vwxyzjn/cleanrl) référence PPO à fichier unique utilisé par de nombreux documents.
- [Hugging Face TRL — PPOTrainer](https://huggingface.co/docs/trl/main/en/ppo_trainer) la recette de production de PPO sur les modèles linguistiques; lire à côté de la leçon 09 (RLHF).
- [Engstrom et al. (2020). Implementation Matters in Deep Policy Gradients](https://arxiv.org/abs/2005.12729) le document "37 optimisations au niveau du code"; quelles astuces PPO sont portables et quelles sont folklore.
