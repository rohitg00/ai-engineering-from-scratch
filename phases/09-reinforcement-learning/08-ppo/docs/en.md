# Proximal Policy Optimization (PPO)

> A2C は各 rollout を1回の update 後に捨てる。PPO は policy gradient を clipped importance ratio で包み、policy を爆発させずに同じデータで10 epochs 以上回せるようにする。Schulman et al. (2017)。2026年でもなお、デフォルトの policy-gradient algorithm である。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 9 · 06 (REINFORCE), Phase 9 · 07 (Actor-Critic)
**所要時間:** 約75分

## 問題

A2C（Lesson 07）は on-policy である。勾配 `E_{π_θ}[A · ∇ log π_θ]` には、*現在の* `π_θ` からサンプリングされたデータが必要になる。1回 update すると `π_θ` は変わる。使ったデータはもう off-policy である。再利用すると gradient に bias が入る。

Rollout は高コストである。Atari では、8 envs × 128 steps の1 rollout は 1024 transitions で、環境時間として十数秒かかる。これを1回の gradient step 後に捨てるのは無駄である。

Trust Region Policy Optimization（TRPO, Schulman 2015）が最初の修正だった。Old policy と new policy の KL divergence が `δ` 未満にとどまるよう各 update を制約する。理論的にはきれいだが、update ごとに conjugate-gradient solve が必要になる。2026年に TRPO を実行する人はほぼいない。

PPO（Schulman et al. 2017）は hard trust-region constraint を単純な clipped objective に置き換える。コードは1行増えるだけ。同じ rollout で10 epochs。Conjugate gradients は不要。理論保証は十分実用的。9年後も、MuJoCo から RLHF まであらゆる対象でデフォルトの policy-gradient algorithm であり続けている。

## コンセプト

![PPO clipped surrogate objective: ratio clipping at 1 ± ε](../assets/ppo.svg)

**Importance ratio。**

`r_t(θ) = π_θ(a_t | s_t) / π_{θ_old}(a_t | s_t)`

これは、データを集めた policy に対する new policy の likelihood ratio である。`r_t = 1` は変化なしを意味する。`r_t = 2` は、new policy が old policy の2倍の確率で `a_t` を取ることを意味する。

**Clipped surrogate。**

`L^{CLIP}(θ) = E_t [ min( r_t(θ) A_t, clip(r_t(θ), 1-ε, 1+ε) A_t ) ]`

2つの項がある。

- Advantage `A_t > 0` で ratio が `1 + ε` を超えて増えようとする場合、clip が gradient を平らにする。良い行動を old probability より `+ε` 以上押し上げない。
- Advantage `A_t < 0` で ratio が `1 - ε` を超える方向に進もうとする場合（clipped reduction と比べて悪い行動をより起こりやすくすることを意味する）、clip が gradient を抑える。悪い行動を `-ε` より下へ押し込みすぎない。

`min` は反対方向を扱う。Ratio が*有益な*方向に動いている場合は、依然として gradient が得られる（損になる側では clipping しない）。

典型的には `ε = 0.2`。`r_t` の関数として objective を plot すると、「良い側」に平らな屋根、「悪い側」に平らな床を持つ piecewise-linear function になる。

**Full PPO loss。**

`L(θ, φ) = L^{CLIP}(θ) - c_v · (V_φ(s_t) - V_t^{target})² + c_e · H(π_θ(·|s_t))`

A2C と同じ actor-critic structure である。係数は3つで、通常 `c_v = 0.5`、`c_e = 0.01`、`ε = 0.2`。

**Training loop。**

1. `N` 個の parallel envs で、それぞれ `T` steps、合計 `N × T` transitions を集める。
2. Advantages（GAE）を計算し、定数として固定する。
3. 現在の `π_θ` の snapshot として `π_{θ_old}` を固定する。
4. `K` epochs の間、`(s, a, A, V_target, log π_old(a|s))` の各 minibatch について次を行う。
   - `r_t(θ) = exp(log π_θ(a|s) - log π_old(a|s))` を計算する。
   - `L^{CLIP}` + value loss + entropy を適用する。
   - Gradient step を行う。
5. Rollout を捨てる。Step 1 に戻る。

`K = 10`、minibatch size 64 が標準的なハイパーパラメータセットである。PPO は頑健で、正確な値は ±50% の範囲ではあまり問題にならない。

**KL-penalty variant。** 原論文は、adaptive KL penalty を使う別案も提案した。`L = L^{PG} - β · KL(π_θ || π_old)` とし、observed KL に基づいて `β` を調整する。Clipping version が主流になった。KL variant は RLHF で生き残っている（reference policy への KL は、いずれにせよ常に欲しい別制約だからである）。

## 作ってみる

### ステップ1: rollout 時に `log π_old(a | s)` を保存する

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

Snapshot は rollout 時に一度だけ取られる。Update epochs 中には変化しない。

### ステップ2: GAE advantages を計算する（Lesson 07）

A2C と同じである。Batch 全体で normalize する。

### ステップ3: clipped surrogate update

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

「clipped → zero gradient」というパターンが PPO の核心である。New policy が有益な方向にすでに動きすぎている場合、update は止まる。

### ステップ4: value と entropy

A2C と同じく、critic target への標準的な MSE と actor への entropy bonus を追加する。

### ステップ5: diagnostics

各 update で見るべきものは3つある。

- **Mean KL** `E[log π_old - log π_θ]`。`[0, 0.02]` に収まるべきである。`0.1` を大きく超えるなら、`K_EPOCHS` または `LR` を下げる。
- **Clip fraction** — ratio が `[1-ε, 1+ε]` の外にあるサンプルの割合。`~0.1-0.3` が望ましい。`~0` なら clip が一度も発火していないので `LR` または `K_EPOCHS` を上げる。`~0.5+` なら rollout に over-fitting しているので下げる。
- **Explained variance** `1 - Var(V_target - V_pred) / Var(V_target)`。Critic quality metric。Critic が学習するにつれて 1 に近づくべきである。

## 落とし穴

- **Clip coefficient mistuned。** `ε = 0.2` が事実上の標準である。`0.1` にすると update が臆病すぎ、`0.3+` は不安定さを招く。
- **Too many epochs。** `K > 20` は、policy が `π_old` から遠く drift するため、しばしば不安定化する。特に大きな networks では epochs に上限を設ける。
- **No reward normalization。** 大きな reward scale は clip range を食いつぶす。Advantages を計算する前に報酬を normalize する（running std）。
- **Forgetting advantage normalization。** Batch ごとの zero-mean/unit-std normalization が標準である。省略すると多くの benchmark で PPO が壊れる。
- **Learning rate not decayed。** PPO は LR を線形に zero へ decay すると良くなる。Constant LR はしばしば劣る。
- **Importance ratio math errors。** 数値安定性のため、常に `new / old` ではなく `exp(log_new - log_old)` を使う。
- **Wrong gradient sign。** Surrogate を maximize することは `-L^{CLIP}` を *minimize* すること。符号反転は最もよくある PPO bug である。

## 使いどころ

PPO は2026年のデフォルト RL algorithm として、驚くほど多くの領域で使われている。

| ユースケース | PPO の変種 |
|----------|-------------|
| MuJoCo / robotics control | PPO with Gaussian policy, GAE(0.95) |
| Atari / discrete games | PPO with categorical policy, rolling 128-step rollouts |
| RLHF for LLMs | PPO with KL penalty to reference model, reward from RM at end of response |
| Large-scale game agents | IMPALA + PPO (AlphaStar, OpenAI Five) |
| Reasoning LLMs | GRPO (Lesson 12) — critic なし PPO variant |
| Preference-only data | DPO — PPO+KL を closed-form に畳み込んだもの。Online sampling なし |

PPO の *loss shape*、すなわち clipped surrogate + value + entropy は、DPO、GRPO、そしてほぼすべての RLHF pipeline の足場である。

## 出荷する

`outputs/skill-ppo-trainer.md` として保存する。

```markdown
---
name: ppo-trainer
description: 与えられた環境向けに PPO training config と diagnostic plan を作成する。
version: 1.0.0
phase: 9
lesson: 8
tags: [rl, ppo, policy-gradient]
---

環境と training budget が与えられたら、次を出力する。

1. Rollout size。`N` envs × `T` steps。
2. Update schedule。`K` epochs、minibatch size、LR schedule。
3. Surrogate params。`ε`（clip）、`c_v`、`c_e`、advantage normalization on。
4. Advantage。明示的な `γ` と `λ` を伴う GAE(`λ`)。
5. Diagnostics plan。KL、clip fraction、explained variance thresholds と alerts。

`K > 30` または `ε > 0.3` は拒否する（unsafe trust region）。Advantage normalization または KL/clip monitoring のない PPO run は拒否する。Clip fraction が継続的に 0.4 を超える場合は drift として指摘する。
```

## 演習

1. **初級。** `ε=0.2, K=4` で 4×4 GridWorld に PPO を実行する。同じ env steps にそろえて A2C（rollout あたり1 epoch）と sample efficiency を比較する。
2. **中級。** `K ∈ {1, 4, 10, 30}` を sweep する。Return vs env steps を plot し、update ごとの mean KL を追跡する。このタスクではどの `K` で KL が爆発するか。
3. **上級。** Clipped surrogate を adaptive KL penalty に置き換える（`KL > 2·target` なら `β` を倍にし、`KL < target/2` なら半分にする）。Final return、stability、clip-free-ness を比較する。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| Importance ratio | "r_t(θ)" | `π_θ(a\|s) / π_old(a\|s)`。データを集めた policy からのずれ。 |
| Clipped surrogate | "PPO's main trick" | `min(r·A, clip(r, 1-ε, 1+ε)·A)`。有益な側で clip を超えると gradient が平らになる。 |
| Trust region | "TRPO / PPO intent" | 単調改善を保証するため、各 update の KL を制限する。 |
| KL penalty | "Soft trust region" | Alternative PPO: `L - β · KL(π_θ \|\| π_old)`。Adaptive `β`。 |
| Clip fraction | "How often clipping triggers" | Diagnostic。0.1-0.3 が望ましく、外れると調整不良を示す。 |
| Multi-epoch training | "Data reuse" | 各 rollout で K epochs。Variance cost と sample efficiency を交換する。 |
| On-policy-ish | "Mostly on-policy" | PPO は名目上 on-policy だが、K>1 epochs では少し off-policy なデータを安全に使う。 |
| PPO-KL | "The other PPO" | KL-penalty variant。KL-to-reference がすでに制約である RLHF で使われる。 |

## 参考文献

- [Schulman et al. (2017). Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347) — 原論文。
- [Schulman et al. (2015). Trust Region Policy Optimization](https://arxiv.org/abs/1502.05477) — PPO の前身である TRPO。
- [Andrychowicz et al. (2021). What Matters In On-Policy RL? A Large-Scale Empirical Study](https://arxiv.org/abs/2006.05990) — PPO の全ハイパーパラメータを ablate した研究。
- [Ouyang et al. (2022). Training language models to follow instructions with human feedback](https://arxiv.org/abs/2203.02155) — InstructGPT。PPO-in-RLHF の recipe。
- [OpenAI Spinning Up — PPO](https://spinningup.openai.com/en/latest/algorithms/ppo.html) — PyTorch 付きの明快な現代的解説。
- [CleanRL PPO implementation](https://github.com/vwxyzjn/cleanrl) — 多くの papers で使われる reference single-file PPO。
- [Hugging Face TRL — PPOTrainer](https://huggingface.co/docs/trl/main/en/ppo_trainer) — Language models 上の PPO の production recipe。Lesson 09（RLHF）と合わせて読む。
- [Engstrom et al. (2020). Implementation Matters in Deep Policy Gradients](https://arxiv.org/abs/2005.12729) — 「37個の code-level optimizations」paper。どの PPO trick が重要で、どれが folklore かを扱う。
