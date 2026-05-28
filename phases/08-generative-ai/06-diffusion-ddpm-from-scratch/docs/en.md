# Diffusion Models — DDPM from Scratch

> Ho, Jain, Abbeel (2020) は、この分野が手放せなくなるレシピを与えました。千個の小さなステップでデータをノイズに破壊する。1 つのニューラルネットにそのノイズを予測させる。推論時にはその過程を逆向きにたどる。現在の主流の画像、動画、3D、音楽モデルはすべてこのループの上で動いており、その上に flow matching や consistency の工夫が載っていることもあります。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 3 · 02 (Backprop), Phase 8 · 02 (VAE)
**所要時間:** 約75分

## 問題

`p_data(x)` の sampler が欲しいとします。GAN はしばしば発散する minimax game を行います。VAE は Gaussian decoder からぼやけたサンプルを生成します。本当に欲しいのは、(a) 1 つの安定した loss (saddle point も minimax もない)、(b) `log p(x)` の lower bound (likelihood が得られる)、(c) SOTA 品質に一致する sample、を同時に満たす training objective です。

Sohl-Dickstein et al. (2015) は理論的な答えを持っていました。Gaussian noise を徐々に加える Markov chain `q(x_t | x_{t-1})` を定義し、denoise する reverse chain `p_θ(x_{t-1} | x_t)` を学習する、というものです。Ho, Jain, Abbeel (2020) は、この loss を 1 行、つまり noise を予測する形へ単純化できることを示し、数学を整理しました。2020 年にはこれは珍しい研究でした。2021 年には state-of-the-art samples を生みました。2022 年には Stable Diffusion になりました。2026 年には基盤そのものです。

## The Concept

![DDPM: forward noise, reverse denoise](../assets/ddpm.svg)

**Forward process `q`.** `T` 個の小さなステップで Gaussian noise を加えます。閉形式があり、これが数学を扱いやすくしている理由です。累積ステップも Gaussian になります。

```
q(x_t | x_0) = N( sqrt(α̅_t) · x_0,  (1 - α̅_t) · I )
```

ここで `α̅_t = ∏_{s=1..t} (1 - β_s)` で、`β_t` の schedule に対する値です。`β_t` を 1e-4 から 0.02 まで T=1000 steps で線形に選ぶと、`x_T` はおおよそ `N(0, I)` になります。

**Reverse process `p_θ`.** 追加された noise を予測する neural net `ε_θ(x_t, t)` を学習します。`x_t` が与えられたら、次で denoise します。

```
x_{t-1} = (1 / sqrt(α_t)) · ( x_t - (β_t / sqrt(1 - α̅_t)) · ε_θ(x_t, t) )  +  σ_t · z
```

ここで `σ_t` は `sqrt(β_t)` または learned variance です。式は見た目が複雑ですが、posterior `q(x_{t-1} | x_t, x_0)` が与えられたときに `x_{t-1}` を解き、`x_0` を noise prediction からの推定値で置き換えただけの代数です。

**Training loss.**

```
L_simple = E_{x_0, t, ε} [ || ε - ε_θ( sqrt(α̅_t) · x_0 + sqrt(1 - α̅_t) · ε,  t ) ||² ]
```

data から `x_0` をサンプルし、random な `t` を選び、`ε ~ N(0, I)` をサンプルし、閉形式で noisy な `x_t` を一度に計算して、noise に回帰します。1 つの loss、minimax なし、KL なし、reparameterization tricks なしです。

**Sampling.** `x_T ~ N(0, I)` から始めます。`t = T` から `1` まで reverse step を反復します。これで完了です。

## Why it works

直感は 3 つあります。

1. **Denoising is easy; generating is hard.** `t=T` では data は pure noise なので、net が解く問題は自明です。`t=0` では、net は数 pixel を整えるだけです。中間の `t` では問題は難しいものの、すべての noise level から同じ weights へ多くの gradients が流れます。

2. **Score matching in disguise.** Vincent (2011) は、noise を予測することが `∇_x log q(x_t | x_0)`、つまり *score* を推定することと等価であると証明しました。reverse SDE はこの score を使い、density gradient を上るように進みます。これは高確率領域へ向かう guided random walk です。

3. **The ELBO reduces to simple MSE.** 完全な variational lower bound には timestep ごとの KL term があります。DDPM の parameterization では、それらの KL term は特定の係数付きの noise prediction MSE に単純化されます。Ho はその係数を落とし ("simple" loss と呼び)、品質は*改善*しました。

## 実装

`code/main.py` は 1-D DDPM を実装します。data は 2-mode mixture です。"net" は `(x_t, t)` を受け取り predicted noise を出力する小さな MLP です。training は 1 行の loss です。sampling は reverse chain を反復します。

### Step 1: the forward schedule (closed form)

```python
betas = [1e-4 + (0.02 - 1e-4) * t / (T - 1) for t in range(T)]
alphas = [1 - b for b in betas]
alpha_bars = []
cum = 1.0
for a in alphas:
    cum *= a
    alpha_bars.append(cum)
```

### Step 2: sample `x_t` in one shot

```python
def forward_sample(x0, t, alpha_bars, rng):
    a_bar = alpha_bars[t]
    eps = rng.gauss(0, 1)
    x_t = math.sqrt(a_bar) * x0 + math.sqrt(1 - a_bar) * eps
    return x_t, eps
```

### Step 3: one training step

```python
def train_step(x0, model, alpha_bars, rng):
    t = rng.randrange(T)
    x_t, eps = forward_sample(x0, t, alpha_bars, rng)
    eps_hat = model_forward(model, x_t, t)
    loss = (eps - eps_hat) ** 2
    return loss, gradient_step(model, ...)
```

### Step 4: reverse sampling

```python
def sample(model, alpha_bars, T, rng):
    x = rng.gauss(0, 1)
    for t in range(T - 1, -1, -1):
        eps_hat = model_forward(model, x, t)
        beta_t = 1 - alphas[t]
        x = (x - beta_t / math.sqrt(1 - alpha_bars[t]) * eps_hat) / math.sqrt(alphas[t])
        if t > 0:
            x += math.sqrt(beta_t) * rng.gauss(0, 1)
    return x
```

40 timesteps と 24-unit MLP の 1-D 問題では、約 200 epochs で 2-mode mixture を学習します。

## Time conditioning

net は、どの timestep を denoise しているかを知る必要があります。標準的な選択肢は 2 つです。

- **Sinusoidal embedding.** Transformer positional encoding と同様です。`embed(t) = [sin(t/ω_0), cos(t/ω_0), sin(t/ω_1), ...]`。MLP に通し、net 内へ broadcast します。
- **Film / group-norm conditioning.** 各 block で embedding を per-channel scale/bias (FiLM) に射影します。

toy code は sinusoidal → concat を使います。production U-Nets は FiLM を使います。

## Pitfalls

- **Schedule matters a lot.** Linear `β` は DDPM default ですが、cosine schedule (Nichol & Dhariwal, 2021) は同じ compute でよりよい FID を出します。品質が plateau したら schedule を切り替えます。
- **Timestep embedding is fragile.** raw `t` を float として渡す方法は toy 1-D では動きますが、画像では失敗します。必ず適切な embedding を使います。
- **V-prediction vs ε-prediction.** 狭い領域 (非常に小さい t または非常に大きい t) では、`ε` の signal-to-noise が悪くなります。V-prediction (`v = α·ε - σ·x`) の方が安定します。SDXL、SD3、Flux はこれを使います。
- **Classifier-free guidance.** 推論時に conditional と unconditional の両方の `ε` を計算し、`ε_cfg = (1 + w) · ε_cond - w · ε_uncond` とします。`w ≈ 3-7` です。Lesson 08 で扱います。
- **1000 steps is a lot.** production では DDIM (20-50 steps)、DPM-Solver (10-20 steps)、または distillation (1-4 steps) を使います。Lesson 12 を参照してください。

## Use It

| Role | Typical stack in 2026 |
|------|-----------------------|
| Image pixel-space diffusion (small, toy) | DDPM + U-Net |
| Image latent diffusion | VAE encoder + U-Net or DiT (Lesson 07) |
| Video latent diffusion | Spatiotemporal DiT (Sora, Veo, WAN) |
| Audio latent diffusion | Encodec + diffusion transformer |
| Science (molecules, proteins, physics) | Equivariant diffusion (EDM, RFdiffusion, AlphaFold3) |

Diffusion は汎用的な generative backbone です。Flow matching (Lesson 13) は 2024-2026 年の競合で、同じ品質ならたいてい inference speed で勝ちます。

## Ship It

`outputs/skill-diffusion-trainer.md` を保存します。この skill は dataset + compute budget を受け取り、schedule (linear/cosine/sigmoid)、prediction target (ε/v/x)、steps の数、guidance scale、sampler family、eval protocol を出力します。

## Exercises

1. **Easy.** `code/main.py` で T を 40 から 10 に変更します。sample quality (outputs の visual histogram) はどう劣化しますか。どの T で 2-mode structure が崩れますか。
2. **Medium.** ε-prediction から v-prediction に切り替えます。reverse step を再導出します。最終的な sample quality を比較します。
3. **Hard.** classifier-free guidance を追加します。class label `c ∈ {0, 1}` で condition し、training 中は 10% の確率で drop し、sampling 時に `ε = (1+w)·ε_cond - w·ε_uncond` を使います。`w = 0, 1, 3, 7` で conditional-mode-hit rate を測定します。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Forward process | "Adding noise" | data を破壊する fixed Markov chain `q(x_t \| x_{t-1})`。 |
| Reverse process | "Denoising" | data を再構成する learned chain `p_θ(x_{t-1} \| x_t)`。 |
| β schedule | "The noise ladder" | step ごとの variance。linear、cosine、sigmoid がある。 |
| α̅ | "Alpha bar" | cumulative product `∏(1 - β)`。`x_0` から閉形式の `x_t` を与える。 |
| Simple loss | "MSE on noise" | `\|\|ε - ε_θ(x_t, t)\|\|²`。variational derivation はすべてこれに落ちる。 |
| ε-prediction | "Predict noise" | 出力は追加された noise。標準 DDPM。 |
| V-prediction | "Predict velocity" | 出力は `α·ε - σ·x`。t 全体で conditioning が良い。 |
| DDPM | "The paper" | Ho et al. 2020。linear β、1000 steps、U-Net。 |
| DDIM | "Deterministic sampler" | Non-Markov sampler。20-50 steps。同じ training objective。 |
| Classifier-free guidance | "CFG" | conditional と unconditional の noise predictions を混ぜ、conditioning を強める。 |

## Production note: diffusion inference is a step-count problem

DDPM paper は T=1000 reverse steps を実行します。production でそれを ship する人はいません。実際の inference stack は必ず次の 3 つの戦略のいずれかを選びます。そしてそれぞれが「latency はどこから来ているのか」という production framing にきれいに対応します。

1. **Faster sampler, same model.** DDIM (20-50 steps)、DPM-Solver++ (10-20)、UniPC (8-16)。reverse loop の drop-in replacement であり、学習済みの `ε_θ` weights は変更しません。latency を 20-50× 削減します。
2. **Distillation.** student を、より少ない steps で teacher に一致するよう学習します。Progressive Distillation (2 → 1)、Consistency Models (arbitrary → 1-4)、LCM、SDXL-Turbo、SD3-Turbo。latency をさらに 5-10× 削減しますが、retraining が必要です。
3. **Caching and compilation.** `torch.compile(unet, mode="reduce-overhead")`、TensorRT-LLM の diffusion backends、`xformers`/SDPA attention、bf16 weights。per-step latency を約 2× 削減します。(1) と (2) に重ねられます。

production diffusion server の budget conversation は、production literature が LLMs について説明するものと同じです。latency は `num_steps × step_cost + VAE_decode`、throughput は `batch_size × (num_steps × step_cost)^-1` です。TTFT は小さい (one step) です。TPOT-equivalent は full response time です。image generation は user から見ると "all-at-once" だからです。

## 参考文献

- [Sohl-Dickstein et al. (2015). Deep Unsupervised Learning using Nonequilibrium Thermodynamics](https://arxiv.org/abs/1503.03585) — diffusion paper。時代を先取りしていました。
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) — DDPM.
- [Song, Meng, Ermon (2021). Denoising Diffusion Implicit Models](https://arxiv.org/abs/2010.02502) — DDIM、より少ない steps。
- [Nichol & Dhariwal (2021). Improved DDPM](https://arxiv.org/abs/2102.09672) — cosine schedule、learned variance。
- [Dhariwal & Nichol (2021). Diffusion Models Beat GANs on Image Synthesis](https://arxiv.org/abs/2105.05233) — classifier guidance.
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) — CFG.
- [Karras et al. (2022). Elucidating the Design Space of Diffusion-Based Generative Models (EDM)](https://arxiv.org/abs/2206.00364) — unified notation、最も明快な recipe。
