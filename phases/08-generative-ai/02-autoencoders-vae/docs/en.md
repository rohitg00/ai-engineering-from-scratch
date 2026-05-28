# Autoencoders と Variational Autoencoders (VAE)

> 普通の autoencoder は圧縮してから再構成する。記憶はする。生成はしない。そこに1つの工夫、つまり code を Gaussian に見えるよう強制する仕掛けを加えると sampler が得られる。`z = μ + σ·ε` の reparameterization というこの1つの工夫こそ、2026年に使う latent-diffusion と flow-matching の画像モデルすべてが入力側に VAE を持つ理由である。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 3 · 02 (Backprop), Phase 3 · 07 (CNNs), Phase 8 · 01 (Taxonomy)
**所要時間:** 約75分

## 問題

784ピクセルの MNIST 数字を16個の数値からなる code に圧縮し、再構成する。普通の autoencoder は reconstruction MSE では高得点を取るが、code space はでこぼこの混沌になる。code space のランダムな点を選んで decode すると、ノイズが出る。sampler はない。これは生成モデルのふりをした圧縮モデルである。

本当に欲しいのは次の3つだ。(a) code space が、たとえば isotropic Gaussian `N(0, I)` のように、そこからサンプルできるきれいでなめらかな分布であること。(b) どんなサンプルを decode しても妥当な数字になること。(c) encoder と decoder が依然としてうまく圧縮すること。3つの目標、1つのアーキテクチャ、1つの loss。

Kingma の2013年の VAE は、encoder に *distribution* `q(z|x) = N(μ(x), σ(x)²)` を出力させ、KL penalty でその分布を prior `N(0, I)` に引き寄せ、decode 前に `q(z|x)` から `z` をサンプルすることでこれを解く。推論時には encoder を捨て、`z ~ N(0, I)` をサンプルして decode する。code space を構造化するのが KL penalty である。

2026年時点で VAE が単体で出荷されることは少ない。raw image quality では diffusion に抜かれたからだ。しかし、すべての latent-diffusion model（SD 1/2/XL/3、Flux、AudioCraft）にとって、VAE は選ばれる encoder である。VAE を学べば、普段使うあらゆる画像パイプラインの見えない最初の層を学ぶことになる。

## コンセプト

![Autoencoder vs VAE: the reparameterization trick](../assets/vae.svg)

**Autoencoder。** `z = encoder(x)`, `x̂ = decoder(z)`, loss = `||x - x̂||²`。Code space は構造化されない。

**VAE encoder。** 2つのベクトル `μ(x)` と `log σ²(x)` を出力する。これらが `q(z|x) = N(μ, diag(σ²))` を定義する。

**Reparameterization trick。** `q(z|x)` からの sampling は微分できない。サンプルを `z = μ + σ·ε`、ただし `ε ~ N(0, I)` と書き換える。これで `z` は `(μ, σ)` と非パラメータな noise の deterministic function になり、勾配が `μ` と `σ` を通って流れる。

**Loss。** Evidence Lower BOund（ELBO）は2項からなる。

```
loss = reconstruction + β · KL[q(z|x) || N(0, I)]
     = ||x - x̂||²  + β · Σ_i ( σ_i² + μ_i² - log σ_i² - 1 ) / 2
```

Reconstruction は `x̂` を `x` に近づける。KL は `q(z|x)` を prior に近づける。両者はトレードオフする。小さい β（<1）= サンプルはシャープだが code space は Gaussian から遠い。大きい β（>1）= code space はきれいだがサンプルはぼやける。β-VAE（Higgins 2017）はこのつまみを有名にし、disentanglement 研究のきっかけになった。

**Sampling。** 推論時は `z ~ N(0, I)` を引き、decoder に通す。1回の forward pass だけ。diffusion のような iterative sampling はない。

## 実装

`code/main.py` は numpy も torch も使わずに小さな VAE を実装する。入力は8次元の synthetic data で、8-D の2成分 Gaussian mixture から生成される。Encoder と decoder は単一 hidden-layer MLP。tanh activation、forward pass、loss、手書きの backward pass を実装する。本番用ではなく、教育用である。

### Step 1: encoder forward

```python
def encode(x, enc):
    h = tanh(add(matmul(enc["W1"], x), enc["b1"]))
    mu = add(matmul(enc["W_mu"], h), enc["b_mu"])
    log_sigma2 = add(matmul(enc["W_sig"], h), enc["b_sig"])
    return mu, log_sigma2
```

`σ` ではなく `log σ²` を使うので、network output は制約なしでよい（σ に softplus をかけるのは罠で、σ ≈ 0 で勾配が死ぬ）。

### Step 2: reparameterize and decode

```python
def reparameterize(mu, log_sigma2, rng):
    eps = [rng.gauss(0, 1) for _ in mu]
    sigma = [math.exp(0.5 * lv) for lv in log_sigma2]
    return [m + s * e for m, s, e in zip(mu, sigma, eps)]

def decode(z, dec):
    h = tanh(add(matmul(dec["W1"], z), dec["b1"]))
    return add(matmul(dec["W_out"], h), dec["b_out"])
```

### Step 3: the ELBO

```python
def elbo(x, x_hat, mu, log_sigma2, beta=1.0):
    recon = sum((a - b) ** 2 for a, b in zip(x, x_hat))
    kl = 0.5 * sum(math.exp(lv) + m * m - lv - 1 for m, lv in zip(mu, log_sigma2))
    return recon + beta * kl, recon, kl
```

両方の分布が Gaussian なので、KL は正確な closed-form で計算できる。数値積分してはいけない。2026年でも monte-carlo KL estimates のコードを出荷している人がいるが、理由なく3倍遅い。

### Step 4: generate

```python
def sample(dec, z_dim, rng):
    z = [rng.gauss(0, 1) for _ in range(z_dim)]
    return decode(z, dec)
```

これが生成モデルである。5行。

## 落とし穴

- **Posterior collapse。** KL 項が `q(z|x) → N(0, I)` を強く押しすぎて、`z` が `x` の情報をまったく持たなくなる。対策: β-annealing（β=0 から始めて 1 まで上げる）、free bits、または inactive dimensions では KL をスキップする。
- **ぼやけたサンプル。** Gaussian decoder likelihood は MSE reconstruction を意味し、これは L2 に対して Bayes-optimal（平均）である。妥当な数字の集合の平均はぼやけた数字になる。対策: discrete decoder（VQ-VAE、NVAE）、または VAE を encoder としてだけ使い、latents の上に diffusion を積む（Stable Diffusion がこれをしている）。
- **β が大きすぎる、早すぎる。** Posterior collapse を参照。β≈0.01 から始めて ramp する。
- **Latent dim が小さすぎる。** MNIST なら 16-D、ImageNet 256² なら 256-D、ImageNet 1024² なら 2048-D。Stable Diffusion の VAE は 512×512×3 → 64×64×4 に圧縮する（spatial area で32x、channels で32x の downsample factor）。

## Use It

2026年の VAE stack:

| 状況 | 選択 |
|-----------|------|
| diffusion 用の image-latent encoder | Stable Diffusion VAE (`sd-vae-ft-ema`) または Flux VAE |
| Audio-latent encoder | Encodec (Meta)、SoundStream、または DAC (Descript) |
| Video latents | Sora の spatiotemporal patches、Latte VAE、WAN VAE |
| Disentangled representation learning | β-VAE、FactorVAE、TCVAE |
| Discrete latents（transformer modelling 用） | VQ-VAE、RVQ (ResidualVQ) |
| 生成用の continuous latents | Plain VAE、その後で latent space に flow / diffusion model を条件付けする |

Latent-diffusion model とは、encoder と decoder の間に diffusion model が住んでいる VAE である。VAE が粗い圧縮を行い、diffusion model が重い仕事をする。動画（VAE + video-diffusion DiT）でも音声（Encodec + MusicGen transformer）でも同じパターンである。

## Ship It

`outputs/skill-vae-trainer.md` を保存する。

Skill は dataset profile + latent-dim target + downstream use（reconstruction、sampling、または latent-diffusion input）を受け取り、architecture choice（plain/β/VQ/RVQ）、β schedule、latent dim、decoder likelihood（Gaussian vs categorical）、evaluation plan（recon MSE、KL per dim、`q(z|x)` と `N(0, I)` の Fréchet distance）を出力する。

## 演習

1. **Easy.** `code/main.py` の `β` を `0.01`、`0.1`、`1.0`、`5.0` に変える。最終的な reconstruction MSE と KL を記録する。自分の synthetic data に対して Pareto-best な β はどれか。
2. **Medium.** Gaussian decoder likelihood を Bernoulli likelihood（cross-entropy loss）に置き換える。同じ synthetic data の binarized version で sample quality を比較する。
3. **Hard.** `code/main.py` を mini VQ-VAE に拡張する。continuous `z` を K=32 entries の codebook に対する nearest-neighbour lookup に置き換える。reconstruction MSE を比較し、使用された codebook entries の数を報告する（codebook collapse は本当に起きる）。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| Autoencoder | Encode-decode network | `x → z → x̂`、MSE を学習する。生成的ではない。 |
| VAE | AE with a sampler | Encoder が distribution を出力し、KL penalty が code space を形作る。 |
| ELBO | Evidence lower bound | `log p(x) ≥ recon - KL[q(z\|x) \|\| p(z)]`。`q = p(z\|x)` のとき tight。 |
| Reparameterization | `z = μ + σ·ε` | stochastic node を deterministic + pure noise として書き直す。sampling を通じた backprop を可能にする。 |
| Prior | `p(z)` | latent の target distribution。通常は `N(0, I)`。 |
| Posterior collapse | "KL term wins" | Encoder が `x` を無視し、prior を出力する。decoder は幻覚で埋めるしかない。 |
| β-VAE | Tunable KL weight | `loss = recon + β·KL`。β が高いほど disentangled だが、よりぼやける。 |
| VQ-VAE | Discrete latent | Continuous `z` を最も近い codebook vector に置き換える。transformer modelling を可能にする。 |

## 本番メモ: VAE は diffusion server の最も熱い経路である

Stable Diffusion / Flux / SD3 pipeline では、VAE はリクエストごとに2回呼ばれる。img2img / inpainting の場合は encode に1回、decode に1回である。1024² では、decoder pass が pipeline 全体で最大の activation-memory peak になることが多い。`128×128×16` latents を `1024×1024×3` に upsample するからだ。実務上の帰結は2つある。

- **decode を slice または tile する。** `diffusers` は `pipe.vae.enable_slicing()` と `pipe.vae.enable_tiling()` を公開している。Tiling は小さな seam artifact と引き換えに、メモリを `O(H·W)` ではなく `O(tile²)` にする。consumer GPUs で 1024²+ を扱うには必須である。
- **bf16 decoder、final resize は fp32 numerics。** SD 1.x VAE は fp32 でリリースされ、1024²+ で fp16 に cast すると *silently produces NaNs*。SDXL には `madebyollin/sdxl-vae-fp16-fix` がある。常に fp16-fix variant を優先するか bf16 を使う。

## 参考文献

- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) — VAE 論文。
- [Higgins et al. (2017). β-VAE: Learning Basic Visual Concepts with a Constrained Variational Framework](https://openreview.net/forum?id=Sy2fzU9gl) — disentangled β-VAE。
- [van den Oord et al. (2017). Neural Discrete Representation Learning](https://arxiv.org/abs/1711.00937) — VQ-VAE。
- [Vahdat & Kautz (2021). NVAE: A Deep Hierarchical Variational Autoencoder](https://arxiv.org/abs/2007.03898) — state-of-the-art image VAE。
- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) — Stable Diffusion。encoder としての VAE。
- [Défossez et al. (2022). High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) — Encodec、audio VAE の標準。
