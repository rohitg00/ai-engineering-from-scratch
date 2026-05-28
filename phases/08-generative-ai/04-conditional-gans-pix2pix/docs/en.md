# Conditional GANs と Pix2Pix

> 2014-2017年の最初の大きな進展は、GAN が何を作るかを制御できるようにしたことだった。label、image、sentence を付ける。Pix2Pix はその画像版であり、狭い image-to-image tasks では今でも generic text-to-image model を上回る。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 8 · 03 (GANs), Phase 4 · 06 (U-Net), Phase 3 · 07 (CNNs)
**所要時間:** 約75分

## 問題

Unconditional GAN は任意の顔をサンプルする。デモには使えるが、本番では役に立たない。欲しいのは、*sketch を photo に写す*、*map を aerial photo に写す*、*daytime scene を nighttime に写す*、*grayscale image を colorize する* といったものだ。これらでは入力画像 `x` が与えられ、意味的対応を保った `y` を出力しなければならない。1つの `x` に対して妥当な `y` は多数ある。Mean-squared error はそれらを潰して泥のようにする。adversarial loss はそうしない。"looks real" はシャープだからだ。

Conditional GAN（Mirza & Osindero, 2014）は、condition `c` を `G` と `D` の両方の入力に加える。Pix2Pix（Isola et al., 2017）はこれを特化した。condition は丸ごとの入力画像、generator は U-Net、discriminator は *patch-based* classifier（PatchGAN）、loss は adversarial + L1 である。このレシピは、2026年でも狭い image-to-image domains で from-scratch text-to-image models を上回る。*paired data* で学習されており、必要な信号を正確に持っているからだ。

## コンセプト

![Pix2Pix: U-Net generator, PatchGAN discriminator](../assets/pix2pix.svg)

**Conditional G。** `G(x, z) → y`。Pix2Pix では `z` は G 内の dropout である（input noise はない。Isola は explicit noise が無視されることを見つけた）。

**Conditional D。** `D(x, y) → [0, 1]`。入力は *pair*（condition, output）である。ここが重要な違いだ。D は `y` が本物らしいかだけでなく、`x` と整合しているかを判定しなければならない。

**U-Net generator。** bottleneck をまたいだ skip connections を持つ encoder-decoder。入力と出力が low-level structure（edges、silhouette）を共有するタスクでは不可欠である。skip がないと high-frequency detail が消える。

**PatchGAN discriminator。** 単一の real/fake score を出す代わりに、D は `N×N` grid を出力し、各 cell が約70×70 pixels の receptive field を判定する。それを平均する。これは Markov random field assumption、つまり realism は local であるという仮定だ。学習がずっと速く、パラメータが少なく、出力はシャープになる。

**Loss。**

```
loss_G = -log D(x, G(x)) + λ · ||y - G(x)||_1
loss_D = -log D(x, y) - log (1 - D(x, G(x)))
```

L1 項は学習を安定させ、G を既知の target に近づける。L1 は L2 より edges がシャープになる（means ではなく medians）。`λ = 100` が Pix2Pix の default だった。

## CycleGAN — pairs がない場合

Pix2Pix には paired `(x, y)` data が必要である。CycleGAN（Zhu et al., 2017）は追加の loss、つまり *cycle consistency* loss を支払うことでこの要件を外す。2つの generators `G: X → Y` と `F: Y → X` を用意する。`F(G(x)) ≈ x` かつ `G(F(y)) ≈ y` になるように学習する。これにより、paired examples なしで horses を zebras に、summer を winter に変換できる。

2026年では、unpaired image-to-image の大部分は CycleGAN ではなく diffusion（ControlNet、IP-Adapter）で行われる。それでも cycle-consistency の考え方は、ほぼすべての unpaired domain adaptation paper に生き残っている。

## 実装

`code/main.py` は1-D data 上に小さな conditional GAN を実装する。condition `c` は class label（0 または 1）。タスクは、与えられた class に対して conditional distribution から sample を生成することだ。

### Step 1: append condition to both G and D inputs

```python
def G(z, c, params):
    return mlp(concat([z, one_hot(c)]), params)

def D(x, c, params):
    return mlp(concat([x, one_hot(c)]), params)
```

One-hot encoding が最も単純な方法である。より大きなモデルでは learned embeddings、FiLM modulation、cross-attention を使う。

### Step 2: train conditional

```python
for step in range(steps):
    x, c = sample_real_conditional()
    noise = sample_noise()
    update_D(x_real=x, x_fake=G(noise, c), c=c)
    update_G(noise, c)
```

Generator は marginal ではなく、*与えられた condition に対する* real distribution に一致しなければならない。

### Step 3: verify per-class output

```python
for c in [0, 1]:
    samples = [G(noise, c) for noise in batch]
    mean_c = mean(samples)
    assert_near(mean_c, real_mean_for_class_c)
```

## 落とし穴

- **Condition が無視される。** G が marginalize することを学び、condition signal が弱いため D が罰しない。対策: D をより強く condition する（late だけでなく early layer）、projection discriminator（Miyato & Koyama 2018）を使う。
- **L1 weight が低すぎる。** G が faithful な出力ではなく、任意の本物らしい出力へ drift する。Pix2Pix-style tasks では λ≈100 から始める。
- **L1 weight が高すぎる。** L1 も L_p norm なので、G はぼやけた出力を作る。学習が安定したら anneal down する。
- **D に ground-truth leakage。** D input には `y` だけでなく `(x, y)` を concatenate する。そうしないと D は整合性を確認できない。
- **Class ごとの mode collapse。** 各 class は独立に collapse しうる。class-conditional diversity checks を実行する。

## Use It

2026年の image-to-image tasks の状況:

| タスク | 最適な手法 |
|------|---------------|
| Sketch → photo、同一ドメイン、paired data | Pix2Pix / Pix2PixHD（今でも速く、シャープ） |
| Sketch → photo、unpaired | Scribble conditioning model を持つ ControlNet |
| Semantic seg → photo | SPADE / GauGAN2 または SD + ControlNet-Seg |
| Style transfer | IP-Adapter または LoRA を使う diffusion。GAN methods は legacy |
| Depth → photo | Stable Diffusion 上の ControlNet-Depth |
| Super-resolution | Real-ESRGAN（GAN）、ESRGAN-Plus、または SD-Upscale（diffusion） |
| Colorization | ColTran、diffusion-based colorizers、または Pix2Pix-color |
| Daytime → nighttime、seasons、weather | CycleGAN または ControlNet-based |

Pix2Pix が正しい道具であり続けるのは、(a) 数千の paired examples があり、(b) タスクが狭く反復可能で、(c) 高速推論が必要な場合である。generic open-domain tasks では diffusion が勝つ。

## Ship It

`outputs/skill-img2img-chooser.md` を保存する。Skill は task description、data availability（paired vs unpaired、N samples）、latency/quality budget を受け取り、approach（Pix2Pix、CycleGAN、ControlNet variant、SDXL + IP-Adapter）、training data requirements、inference cost、eval protocol（LPIPS、FID、task-specific）を出力する。

## 演習

1. **Easy.** `code/main.py` を変更して3つ目の class を追加する。G が各 class の noise を正しい mode に写すことを確認する。
2. **Medium.** 1-D setting で L1 を perceptual-style loss に置き換える（例: feature extractor として動く小さな frozen D）。conditional distribution の sharpness は変わるか。
3. **Hard.** 1-D setting で CycleGAN をスケッチする。2つの distributions、2つの generators、cycle loss。paired data なしでそれらの間の写像を学べることを示す。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| Conditional GAN | "GAN with labels" | G(z, c), D(x, c)。両方の networks が condition を見る。 |
| Pix2Pix | "Image-to-image GAN" | U-Net G と PatchGAN D + L1 loss を持つ paired cGAN。 |
| U-Net | "Encoder-decoder with skips" | 対称な conv network。skips が high-freq を保つ。 |
| PatchGAN | "Local-realism classifier" | D が global score ではなく per-patch score を出力する。 |
| CycleGAN | "Unpaired image translation" | 2つの G + cycle-consistency loss。paired data は不要。 |
| SPADE | "GauGAN" | semantic map で中間 activations を normalize する。segmentation-to-image。 |
| FiLM | "Feature-wise linear modulation" | condition から作る per-feature affine transform。安価な conditioning。 |

## 本番メモ: latency-bound baseline としての Pix2Pix

paired data があり、タスクが狭い場合（sketch → render、semantic map → photo、day → night）、Pix2Pix の one-shot inference は diffusion より1桁速い。production comparison はたいてい次のようになる。

| Path | Steps | Typical latency at 512² on a single L4 |
|------|-------|----------------------------------------|
| Pix2Pix (U-Net forward) | 1 | ~30 ms |
| SD-Inpaint or SD-Img2Img | 20 | ~1.2 s |
| SDXL-Turbo Img2Img | 1-4 | ~0.15-0.35 s |
| ControlNet + SDXL base | 20-30 | ~3-5 s |

Pix2Pix は static batches の throughput で勝つ（すべての request が同じ FLOPs）。Diffusion は品質と generalization で勝つ。現代的な選択は、狭いタスクには Pix2Pix-style distilled model を出荷し、tail inputs には diffusion fallback を用意することが多い。

## 参考文献

- [Mirza & Osindero (2014). Conditional Generative Adversarial Nets](https://arxiv.org/abs/1411.1784) — cGAN 論文。
- [Isola et al. (2017). Image-to-Image Translation with Conditional Adversarial Networks](https://arxiv.org/abs/1611.07004) — Pix2Pix。
- [Zhu et al. (2017). Unpaired Image-to-Image Translation using Cycle-Consistent Adversarial Networks](https://arxiv.org/abs/1703.10593) — CycleGAN。
- [Wang et al. (2018). High-Resolution Image Synthesis with Conditional GANs](https://arxiv.org/abs/1711.11585) — Pix2PixHD。
- [Park et al. (2019). Semantic Image Synthesis with Spatially-Adaptive Normalization](https://arxiv.org/abs/1903.07291) — SPADE / GauGAN。
- [Miyato & Koyama (2018). cGANs with Projection Discriminator](https://arxiv.org/abs/1802.05637) — projection D。
