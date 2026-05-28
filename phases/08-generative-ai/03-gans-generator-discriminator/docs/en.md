# GANs — Generator vs Discriminator

> 2014年の Goodfellow の工夫は、密度を完全に飛ばすことだった。2つのネットワーク。1つは偽物を作る。もう1つはそれを見破る。本物と見分けがつかなくなるまで戦わせる。動くはずがないように見える。実際、しばしば動かない。それでも動いたとき、狭いドメインでは今でも文献中で最もシャープなサンプルを出す。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 3 · 02 (Backprop), Phase 3 · 08 (Optimizers), Phase 8 · 02 (VAE)
**所要時間:** 約75分

## 問題

VAE のサンプルはぼやける。MSE decoder loss が *平均* 画像に対して Bayes-optimal だからだ。妥当な数字がいくつもあると、その平均はぼやけた数字になる。欲しいのは、ある1つの target との pixel-wise な近さではなく、*もっともらしさ* に報酬を与える loss である。もっともらしさの closed-form はない。学習するしかない。

Goodfellow のアイデアは、real images と fakes を区別する classifier `D(x)` を学習することだった。generator `G(z)` は `D` をだますように学習する。`G` への loss signal は、その時点の `D` が「本物らしさ」だと考えているものそのものになる。この信号は `G` が改善するたびに更新され、動く target を追いかける。両方のネットワークが収束すれば、`G` は一度も `log p(x)` を書かずに data distribution を学習したことになる。

これが adversarial training である。数式では minimax game になる。

```
min_G max_D  E_real[log D(x)] + E_fake[log(1 - D(G(z)))]
```

2026年時点で GAN はもはや SOTA generator ではない（diffusion と flow matching がその座を奪った）。しかし StyleGAN 2/3 は今でも出荷された顔モデルの中で最もシャープであり、GAN discriminators は diffusion training の *perceptual losses* として使われ、SDXL-Turbo、SD3-Turbo、LCM のような real-time diffusion を出荷可能にする高速 1-step distillation を支えている。

## コンセプト

![GAN training: generator and discriminator in minimax](../assets/gan.svg)

**Generator `G(z)`。** noise vector `z ~ N(0, I)` を sample `x̂` に写す。dense または transposed conv の decoder 形ネットワーク。

**Discriminator `D(x)`。** sample を scalar probability（または score）に写す。Real → 1、fake → 0。

**Loss。** 2つの update を交互に行う。

- **`D` を学習する:** `loss_D = -[ log D(x) + log(1 - D(G(z))) ]`。real=1、fake=0 の binary cross-entropy。
- **`G` を学習する:** `loss_G = -log D(G(z))`。これは Goodfellow が使った *non-saturating* form である（元の `log(1 - D(G(z)))` は、`D` が自信を持つと飽和して勾配を殺す）。

**Training loop。** `D` を1 step、`G` を1 step。これを繰り返す。

**なぜ動くのか。** `G` が `p_data` と完全に一致すれば、`D` は偶然以上の判定ができず、どこでも 0.5 を出す。`G` はそれ以上の勾配を受け取らない。均衡である。

**なぜ壊れるのか。** Mode collapse（`G` が `D` に分類されにくい1つの mode を見つけてそれだけを作り続ける）、vanishing gradient（`D` が速く学びすぎ、`log D` が飽和する）、training instability（learning rates、batch sizes、その他あらゆるもの）。

## GAN を実用にした変種

| 年 | Innovation | 修正したこと |
|------|------------|-----|
| 2015 | DCGAN | Conv/deconv、batch norm、LeakyReLU。最初の安定したアーキテクチャ。 |
| 2017 | WGAN, WGAN-GP | BCE を Wasserstein distance + gradient penalty に置き換える。vanishing gradient を直す。 |
| 2017 | Spectral normalization | discriminator に Lipschitz bound をかける。2026年の discriminators でも使われる。 |
| 2018 | Progressive GAN | 低解像度から学習し、層を追加していく。最初のメガピクセル級結果。 |
| 2019 | StyleGAN / StyleGAN2 | Mapping network + adaptive instance norm。固定ドメインのフォトリアリズムで state of the art。 |
| 2021 | StyleGAN3 | Alias-free、translation-equivariant。2026年でも顔の gold standard。 |
| 2022 | StyleGAN-XL | Conditional、class-aware、より大規模。 |
| 2024 | R3GAN | より強い regularization で再ブランド化。1024² でも小細工なしに動く。 |

## 実装

`code/main.py` は1次元データ、つまり2つの Gaussian mixture 上で小さな GAN を学習する。Generator と discriminator は単一 hidden-layer MLP。forward、backward、minimax loop を手で実装する。目的は、2つの主要な失敗モード（mode collapse + vanishing gradient）が起きる様子を見ることだ。

### Step 1: non-saturating loss

Vanilla Goodfellow loss `log(1 - D(G(z)))` は、D が G の fake を高い確信で fake と分類すると 0 に近づく。その時点で G の勾配はほぼゼロになり、G は改善できない。non-saturating form `-log D(G(z))` は逆の漸近挙動を持ち、D が自信を持つほど大きくなって G に強い信号を与える。

```python
def g_loss(d_fake):
    # maximize log D(G(z))  <=>  minimize -log D(G(z))
    return -sum(math.log(max(p, 1e-8)) for p in d_fake) / len(d_fake)
```

### Step 2: one discriminator step per generator step

```python
for step in range(steps):
    # train D
    real_batch = sample_real(batch_size)
    fake_batch = [G(z) for z in sample_noise(batch_size)]
    update_D(real_batch, fake_batch)

    # train G
    fake_batch = [G(z) for z in sample_noise(batch_size)]  # fresh fakes
    update_G(fake_batch)
```

G 用には fresh fakes を使う。そうしないと勾配が stale になる。

### Step 3: watch for mode collapse

```python
if step % 200 == 0:
    samples = [G(z) for z in sample_noise(500)]
    mode_a = sum(1 for s in samples if s < 0)
    mode_b = 500 - mode_a
    if min(mode_a, mode_b) < 50:
        print("  [!] mode collapse: one mode is starved")
```

典型的な症状は、2つの real modes のうち片方が生成されなくなることだ。discriminator はそれを fake として見ることがないため、修正しなくなる。

## 落とし穴

- **Discriminator が強すぎる。** D の learning rate を 2-5x 下げるか、instance/layer noise を加える。D が >95% accuracy に達したら G は死んでいる。
- **Generator が1つの mode を記憶する。** D inputs に noise を加える、minibatch-discriminator layer を使う、または WGAN-GP に切り替える。
- **Batch norm leaking statistics。** Real batch + fake batch が同じ BN layer を通ると統計が混ざる。代わりに instance norm または spectral norm を使う。
- **Inception-score gaming。** FID と IS は sample counts が少ないとノイズが大きい。評価では ≥10k samples を使う。
- **Conditional tasks で one-shot sampling というのは誤解を招く。** 使える出力を得るには、まだ CFG scales、truncation tricks、re-sampling が必要になる。

## Use It

2026年の GAN stack:

| 状況 | 選択 |
|-----------|------|
| フォトリアルな人の顔、固定 pose | StyleGAN3（最もシャープで最小） |
| Anime / stylized faces | StyleGAN-XL または Stable Diffusion LoRA |
| Image-to-image translation | Pix2Pix / CycleGAN（Phase 8 · 04）または ControlNet（Phase 8 · 08） |
| 高速な 1-step text-to-image | diffusion の adversarial distillation（SDXL-Turbo、SD3-Turbo） |
| diffusion trainer 内の perceptual loss | image crops 上の小さな GAN discriminator |
| Multi-modal で open-ended なもの | やらない。diffusion または flow matching を使う |

GAN はシャープだが狭い。ドメインが開いた瞬間、つまり写真、任意の text prompts、動画になったら diffusion に切り替える。adversarial trick は単体 generator ではなく、component（perceptual losses、distillation）として生き残っている。

## Ship It

`outputs/skill-gan-debugger.md` を保存する。Skill は失敗した GAN run（loss curves、sample grid、dataset size）を受け取り、原因のランキング、1行の修正、再実行プロトコルを出力する。

## 演習

1. **Easy.** 標準設定で `code/main.py` を実行する。次に `D_LR = 5 * G_LR` に設定して再実行する。G の loss はどれくらい速く定数に潰れるか。
2. **Medium.** Goodfellow BCE loss を WGAN loss に置き換える: `loss_D = E[D(fake)] - E[D(real)]`、`loss_G = -E[D(fake)]` とし、D の weights を `[-0.01, 0.01]` に clip する。学習はより安定するか。wall-clock convergence を比較する。
3. **Hard.** 1-D example を 2-D data（ring 上の8 Gaussian mixture）に拡張する。steps 1k、5k、10k で generator が8個の mode のうちいくつを捕捉するか追跡する。minibatch discrimination を実装して再測定する。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| Generator | "G" | Noise-to-sample network、`G: z → x̂`。 |
| Discriminator | "D" | Classifier `D: x → [0, 1]`、real vs fake。 |
| Minimax | "The game" | joint objective の `min_G max_D`。 |
| Non-saturating loss | "The fix" | G に `log(1 - D(G(z)))` ではなく `-log D(G(z))` を使う。 |
| Mode collapse | "G memorized one thing" | 多様なデータにもかかわらず、generator が少数の distinct outputs しか出さない。 |
| WGAN | "Wasserstein" | BCE を Earth-Mover distance + gradient penalty に置き換える。よりなめらかな勾配。 |
| Spectral norm | "Lipschitz trick" | D の weight norms を制約して slope を bounded にする。学習を安定化する。 |
| StyleGAN | "The one that works" | Mapping network + AdaIN。顔では best-in-class、2026年でもそうである。 |

## 本番メモ: one-shot inference は GAN に残った強みである

GAN は open-domain generation の sample quality ではもう勝たないが、inference cost ではまだ勝つ。production-inference literature の語彙で言えば、GAN には次がある。

- **Prefill も decode stages もない。** 単一の `G(z)` forward pass。TTFT ≈ total latency。
- **KV-cache pressure がない。** state は weights だけである。Batch size は cache ではなく activation memory によって制限される。
- **Trivial continuous batching。** すべての request が同じ fixed FLOPs を持つため、server の target occupancy に合わせた static batch がたいてい最適になる。in-flight scheduler は不要。

だから GAN distillation（SDXL-Turbo、SD3-Turbo、ADD、LCM）は、2026年の fast text-to-image の主要技術である。20-50 step の diffusion pipeline を、diffusion base の分布を保ちながら 1-4 回の GAN-style forward passes に潰す。adversarial loss は、遅い generator を速いものに変える training-time knob として生き残っている。

## 参考文献

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661) — 元の GAN 論文。
- [Radford et al. (2015). Unsupervised Representation Learning with DCGAN](https://arxiv.org/abs/1511.06434) — 最初の安定したアーキテクチャ。
- [Arjovsky, Chintala, Bottou (2017). Wasserstein GAN](https://arxiv.org/abs/1701.07875) — WGAN。
- [Miyato et al. (2018). Spectral Normalization for GANs](https://arxiv.org/abs/1802.05957) — SN。
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958) — StyleGAN2。
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423) — StyleGAN3。
- [Sauer et al. (2023). Adversarial Diffusion Distillation](https://arxiv.org/abs/2311.17042) — SDXL-Turbo。
