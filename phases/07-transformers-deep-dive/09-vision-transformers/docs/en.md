# Vision Transformers (ViT)

> 画像はパッチのグリッドです。文はトークンのグリッドです。同じ transformer がその両方を処理します。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 7 · 05 (Full Transformer), Phase 4 · 03 (CNNs), Phase 4 · 14 (Vision Transformers intro)
**所要時間:** 約45分

## 課題

2020 年以前、コンピュータビジョンと言えば畳み込みでした。ImageNet、COCO、検出ベンチマークのあらゆる SOTA は CNN backbone を使っていました。Transformers は言語向けでした。

Dosovitskiy et al. (2020) の "An Image is Worth 16x16 Words" は、畳み込みを完全に捨てられることを示しました。画像を固定サイズのパッチに切り分け、各パッチを線形射影で embedding にし、その系列を素の transformer encoder に入力します。十分なスケール、つまり ImageNet-21k 事前学習以上の規模があれば、ViT は ResNet ベースのモデルに匹敵するか上回ります。

ViT は、2026 年に広く見られるパターンの始まりでした。1 つのアーキテクチャで多くのモダリティを扱う、という流れです。Whisper は音声をトークン化します。ViT は画像をトークン化します。ロボティクスでは action tokens、動画では pixel tokens が使われます。Transformer は入力が何かを気にしません。系列を与えれば学習します。

2026 年時点で、ViT とその子孫である DeiT、Swin、DINOv2、ViT-22B、SAM 3 は、ビジョンの大部分を占めています。CNN は今でも edge devices や latency-sensitive tasks では勝ちます。それ以外では、スタックのどこかに ViT が入っています。

## コンセプト

![Image → patches → tokens → transformer](../assets/vit.svg)

### Step 1 — patchify

`H × W × C` の画像を、平坦化されたパッチからなる `N × (P·P·C)` の系列に分割します。典型的な設定は、`224 × 224` 画像、`16 × 16` パッチで、768 個の値を持つパッチが 196 個できます。

```
image (224, 224, 3) → 14 × 14 grid of 16x16x3 patches → 196 vectors of length 768
```

パッチサイズは調整レバーです。小さいパッチはトークン数が増え、解像度は上がりますが、attention cost は二乗で増えます。大きいパッチは粗くなりますが安くなります。

### Step 2 — linear embedding

1 つの学習済み行列で、平坦化された各パッチを `d_model` に射影します。これは kernel size `P`、stride `P` の畳み込みと等価です。PyTorch では文字どおり `nn.Conv2d(C, d_model, kernel_size=P, stride=P)` で、2 行で実装できます。

### Step 3 — `[CLS]` token を先頭に追加し、positional embeddings を加える

- 学習可能な `[CLS]` token を先頭に追加します。その最終 hidden state が分類に使う画像表現です。
- 学習可能な positional embeddings (ViT-original) または sinusoidal 2D (後続 variant) を加えます。
- 2024 年以降は、明示的な embedding なしで、位置表現に 2D 拡張された RoPE を使うこともあります。

### Step 4 — 標準 transformer encoder

`LayerNorm → Self-Attention → + → LayerNorm → MLP → +` のブロックを L 層積みます。BERT と同一です。ビジョン専用レイヤーはありません。これがこの論文の教育的な要点です。

### Step 5 — head

分類では `[CLS]` hidden state → linear → softmax とします。DINOv2 や SAM では `[CLS]` を捨て、patch embeddings を直接使います。

### 重要だった variants

| Model | Year | Change |
|-------|------|--------|
| ViT | 2020 | オリジナル。固定パッチサイズ、完全な global attention。 |
| DeiT | 2021 | Distillation。ImageNet-1k だけで学習可能。 |
| Swin | 2021 | Shifted windows を使う階層型。固定の sub-quadratic cost。 |
| DINOv2 | 2023 | Self-supervised、ラベルなし。最良の汎用ビジョン特徴。 |
| ViT-22B | 2023 | 22B params。scaling laws が成り立つ。 |
| SigLIP | 2023 | ViT + language pair、sigmoid contrastive loss。 |
| SAM 3 | 2025 | Segment anything。ViT-Large + promptable mask decoder。 |

### 時間がかかった理由

ViT が CNN に匹敵するには大量のデータが必要です。CNN が持つ inductive biases、つまり translation invariance や locality を持たないためです。1 億枚を超えるラベル付き画像や強力な self-supervised pretraining がない場合、同じ compute なら CNN がまだ勝ちます。2021 年の DeiT は distillation の工夫でこれを改善し、2023 年の DINOv2 は self-supervision で恒久的に解決しました。

## 作ってみる

`code/main.py` を見てください。Pure-stdlib の patchify、linear embedding、sanity checks です。学習はしません。現実的なスケールの ViT には PyTorch と数時間の GPU 時間が必要です。

### Step 1: fake image

`(R, G, B)` タプルの行リストとして表した 24 × 24 RGB 画像です。6×6 パッチを使うので、16 個のパッチができ、それぞれ 108 次元の embedding vector になります。

### Step 2: patchify

```python
def patchify(image, P):
    H = len(image)
    W = len(image[0])
    patches = []
    for i in range(0, H, P):
        for j in range(0, W, P):
            patch = []
            for di in range(P):
                for dj in range(P):
                    patch.extend(image[i + di][j + dj])
            patches.append(patch)
    return patches
```

Raster order はグリッドを行優先でたどります。すべての ViT がこの順序を使います。

### Step 3: linear embed

各 flat patch にランダムな `(patch_flat_size, d_model)` 行列を掛けます。`[CLS]` を先頭に追加した後、出力 shape が `(N_patches + 1, d_model)` であることを確認します。

### Step 4: 現実的な ViT の parameter count を数える

ViT-Base の parameter count を出力します。12 layers、12 heads、d=768、patch=16 です。ResNet-50 (~25M) と比較します。ViT-Base は約 86M、ViT-Large は約 307M、ViT-Huge は約 632M です。

## 使ってみる

```python
from transformers import ViTImageProcessor, ViTModel
import torch
from PIL import Image

processor = ViTImageProcessor.from_pretrained("google/vit-base-patch16-224-in21k")
model = ViTModel.from_pretrained("google/vit-base-patch16-224-in21k")

img = Image.open("cat.jpg")
inputs = processor(img, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, 197, 768): [CLS] + 196 patches
cls_emb = out[:, 0]                       # image representation
```

**DINOv2 embeddings は 2026 年の画像特徴のデフォルトです。** backbone を freeze し、小さな head だけを学習します。分類、検索、検出、キャプション生成に使えます。Meta の DINOv2 checkpoints は、非テキストのビジョンタスクすべてで CLIP を上回ります。

**Patch-size picking.** 小さいモデルは 16×16 (ViT-B/16) を使います。Dense prediction、つまり segmentation では 8×8 または 14×14 (SAM, DINOv2) を使います。非常に大きなモデルでは 14×14 が使われます。

## Ship It

`outputs/skill-vit-configurator.md` を見てください。この skill は、新しいビジョンタスクに対して dataset size、resolution、compute budget から ViT variant と patch size を選びます。

## 演習

1. **Easy.** `code/main.py` を実行してください。パッチ数が `(H/P) * (W/P)` に等しく、flat patch dimension が `P*P*C` に等しいことを確認します。
2. **Medium.** 2D sinusoidal positional embeddings を実装してください。各パッチの `row` と `col` に対して独立した sinusoidal code を作り、連結します。それを小さな PyTorch ViT に入力し、CIFAR-10 で learnable positional embeddings と accuracy を比較します。
3. **Hard.** 3-layer ViT (PyTorch) を作り、4×4 パッチで 1,000 枚の MNIST 画像に学習させます。test accuracy を測ります。次に同じ 1,000 枚の画像で DINOv2 pretraining を追加します。簡略化として、masked patches から patch embeddings を予測するよう encoder を学習します。accuracy は改善しますか。

## 重要語句

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Patch | 「vision-transformer token」 | 画像の `P × P × C` 領域に含まれる pixel values を平坦化した vector。 |
| Patchify | 「Chop + flatten」 | 画像を重ならない patches に切り分け、それぞれを vector に平坦化すること。 |
| `[CLS]` token | 「image summary」 | 先頭に追加される学習可能 token。その最終 embedding が画像表現になる。 |
| Inductive bias | 「model assumes」 | ViT は CNN より事前仮定が少ないため、その差を埋めるにはより多くのデータが必要。 |
| DINOv2 | 「Self-supervised ViT」 | 画像 augmentation + momentum teacher を使い、ラベルなしで学習されたもの。2026 年の最良の汎用画像特徴。 |
| SigLIP | 「CLIP's successor」 | ViT + text encoder を sigmoid contrastive loss で学習したもの。同じ compute では CLIP より優れる。 |
| Swin | 「Windowed ViT」 | local attention + shifted windows を使う階層型 ViT。sub-quadratic。 |
| Register tokens | 「2023 trick」 | attention sinks を吸収する少数の追加学習可能 tokens。DINOv2 features を改善する。 |

## 参考資料

- [Dosovitskiy et al. (2020). An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale](https://arxiv.org/abs/2010.11929) — ViT 論文。
- [Touvron et al. (2021). Training data-efficient image transformers & distillation through attention](https://arxiv.org/abs/2012.12877) — DeiT。
- [Liu et al. (2021). Swin Transformer: Hierarchical Vision Transformer using Shifted Windows](https://arxiv.org/abs/2103.14030) — Swin。
- [Oquab et al. (2023). DINOv2: Learning Robust Visual Features without Supervision](https://arxiv.org/abs/2304.07193) — DINOv2。
- [Darcet et al. (2023). Vision Transformers Need Registers](https://arxiv.org/abs/2309.16588) — DINOv2 向け register-token 修正。
