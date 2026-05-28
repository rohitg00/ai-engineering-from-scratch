# Vision Transformers と Patch-Token Primitive

> マルチモーダルの前に、画像は transformer が処理できる token 列へ変換される必要があります。2020 年の ViT 論文は、16x16 pixel patch、linear projection、position embedding でこの問題に答えました。5 年後の 2026 年の frontier model (Claude Opus 4.7 の 2576px native、Gemini 3.1 Pro、Qwen3.5-Omni) も、依然としてここから始まります。encoder は ViT から DINOv2、SigLIP 2 へ変わり、register token が追加され、position scheme は 2D-RoPE になりましたが、primitive は残りました。この lesson では patch-token pipeline を端から端まで読み、stdlib Python で実装して、Phase 12 の残りに必要な「visual token」の具体的なメンタルモデルを作ります。

**種別:** 学習
**言語:** Python (stdlib、patch tokenizer + geometry calculator)
**前提条件:** Phase 7 (Transformers)、Phase 4 (Computer Vision)
**所要時間:** ~120 分

## 学習目標

- HxWx3 画像を、正しい positional encoding を持つ patch token 列へ変換する。
- 指定された (patch size, resolution, hidden dim, depth) の ViT について、sequence length、parameter count、FLOPs を計算する。
- ViT を 2020 年の研究から 2026 年の production へ押し上げた 3 つの upgrade を説明する: self-supervised pretraining (DINO / MAE)、register token、native-resolution packing。
- downstream task に応じて CLS pooling、mean pooling、register token を選び分ける。

## 問題

Transformers は vector の sequence を扱います。text はすでに sequence (byte または token) です。image は 3 つの color channel を持つ 2D pixel grid であり、そのままでは sequence ではありません。すべての pixel を flatten すると、224x224 RGB image は 150,528 token になり、この長さでの self-attention は現実的ではありません (sequence length に対して quadratic)。

2020 年以前の approach は、front に CNN feature extractor を接続していました。ResNet が 2048-dim vector の 7x7 feature map を生成し、その 49 token を transformer に渡す。この方法は機能しますが、CNN の bias (translation equivariance、local receptive field) を引き継ぎ、transformer の scale への強さを損ないます。

Dosovitskiy et al. (2020) は率直な問いを立てました: CNN を飛ばしたらどうなるか。画像を固定サイズ patch (たとえば 16x16 pixel) に分割し、各 patch を vector に linearly project し、positional embedding を足して、vanilla transformer に渡す。当時これは異端でした。convolution なしの vision です。十分な data (JFT-300M、その後 LAION) があると ImageNet で ResNet を上回り、その後も改善し続けました。

2026 年時点で、ViT primitive は疑いようのない土台です。open-weights VLM の vision tower はすべて何らかの子孫です (DINOv2、SigLIP 2、CLIP、EVA、InternViT)。問いはもはや「patch を使うべきか」ではなく、「どの patch size、どの resolution schedule、どの pretraining objective、どの positional encoding を使うか」です。

## 概念

### Patches as tokens

shape `(H, W, 3)` の image `x` と patch size `P` があるとします。画像を `(H/P) x (W/P)` の non-overlapping patch grid に切り分けます。各 patch は `P x P x 3` の pixel cube です。この cube を flatten して `3 P^2` vector にします。shape `(3 P^2, D)` の shared linear projection `W_E` を適用し、各 patch を model の hidden dimension `D` へ写像します。

canonical な ViT-B/16 config では:
- Resolution 224、patch size 16 -> grid 14x14 -> 196 patch tokens。
- 各 patch は `16 x 16 x 3 = 768` pixel value で、`D = 768` へ projection される。
- learnable `[CLS]` token を追加 -> sequence length 197。

patch projection は数学的には、kernel size `P`、stride `P`、output channel `D` の 2D convolution と同じです。production code は実際にこの形で実装します: `nn.Conv2d(3, D, kernel_size=P, stride=P)`。「linear projection」という説明は概念上のもので、kernel として扱う実装のほうが効率的です。

### Positional embeddings

patch には本質的な順序がありません。transformer から見ると bag です。初期 ViT は learnable 1D positional embedding を追加しました (各 position に 768-dim vector、合計 197 個)。これは機能しますが、model を training resolution に縛ります。inference で grid を変えるなら position table を interpolate しなければなりません。

modern vision backbone は 2D-RoPE (Qwen2-VL の M-RoPE、SigLIP 2 の default) または factorized 2D position を使います。2D-RoPE は patch の (row, column) index に基づいて query/key vector を回転させるため、model は rotation angle から relative 2D position を推論します。position table はありません。model は inference で任意の grid size を扱えます。

### CLS token, pooled output, and register tokens

image-level representation は何でしょうか。3 つの選択肢が共存しています。

1. `[CLS]` token。learnable vector を patch sequence の先頭に付ける。すべての transformer block の後、CLS token の hidden state が画像表現になる。BERT 由来。original ViT と CLIP で使用。
2. Mean pool。patch token の output hidden state を平均する。SigLIP、DINOv2、modern VLM の多くで使用。
3. Register tokens。Darcet et al. (2023) は、明示的な sink token なしで training された ViT が self-attention を乗っ取る high-norm の「artifact」patch を発達させることを観察しました。4-16 個の learnable register token を追加するとこの負荷を吸収し、dense-prediction quality (segmentation、depth) が改善します。DINOv2 と SigLIP 2 はどちらも register を備えています。

この選択は downstream task で重要です。classification なら CLS で十分です。patch token を LLM へ渡す VLM では pooling を完全に skip します。すべての patch が LLM input token になります。register は handoff 前に捨てます (scaffolding であって content ではないため)。

### Pretraining: supervised, contrastive, masked, self-distilled

2020 年の ViT は JFT-300M の supervised classification で pretrained されました。すぐに次の方法へ置き換わっていきます。

- CLIP (2021): 400M pair の contrastive image-text。Lesson 12.02。
- MAE (2021, He et al.): patch の 75% を mask し、pixel を reconstruct。self-supervised で、pure image だけで機能。
- DINO (2021) / DINOv2 (2023): student-teacher による self-distillation。label なし、caption なし。2023 年の DINOv2 ViT-g/14 は最強クラスの purely-visual backbone で、「dense features」用途の default。
- SigLIP / SigLIP 2 (2023, 2025): sigmoid loss と native aspect ratio のための NaFlex を備えた CLIP。2026 年の open VLM (Qwen、Idefics2、LLaVA-OneVision) で支配的な vision tower。

どの pretraining を選ぶかで backbone の得意分野が決まります。CLIP/SigLIP は text との semantic matching、DINOv2 は dense visual features、MAE は downstream finetuning の starting point に向きます。

### Scaling laws

ViT scaling (Zhai et al. 2022) は、ViT の quality が model size、data size、compute に関して予測可能な law に従うことを示しました。fixed compute では:
- bigger model + more data -> better quality。
- patch size は sequence length と fidelity の lever。Patch 14 (DINOv2/SigLIP SO400m で典型的) は patch 16 より image あたりの token が多い。OCR や dense task では有利だが speed は悪化。
- resolution はもう 1 つの大きな lever。224 から 384、512 へ上げるとほぼ常に改善するが、FLOPs は quadratic に増える。

ViT-g/14 (1B params、patch 14、resolution 224 -> 256 tokens) と SigLIP SO400m/14 (400M params、patch 14) は、2026 年 open VLM の 2 つの workhorse encoder です。

### Parameter count for a ViT

完全な計算は `code/main.py` にあります。224 の ViT-B/16 では:

```
patch_embed = 3 * 16 * 16 * 768 + 768  =  591k
cls + pos    = 768 + 197 * 768          =  152k
block        = 4 * 768^2 (QKVO) + 2 * 4 * 768^2 (MLP) + 2 * 2*768 (LN)
             = 12 * 768^2 + 3k          =  7.1M
12 blocks    = 85M
final LN    = 1.5k
total       ~= 86M
```

checkpoint を load する前に、この方法であらゆる ViT を概算してください。backbone size は downstream VLM の VRAM floor を決めます。

### 2026 production config

2026 年に多くの open VLM が採用している encoder は、native resolution (NaFlex) の SigLIP 2 SO400m/14 です。特徴は次の通りです。

- 400M parameters。
- Patch size 14、default resolution 384 -> image あたり 729 patch tokens。
- image-level task では mean pool。VQA では 729 patch すべてが LLM へ流れる。
- 4 register tokens。LLM handoff 前に discard。
- native aspect ratio のための image-level scaling 付き 2D-RoPE。

この config の各 decision は、読める論文に由来しています。

## 使ってみる

`code/main.py` は patch tokenizer と geometry calculator です。(image H, W, patch P, hidden D, depth L) を受け取り、次を報告します。

- patching 後の grid shape と sequence length。
- synthetic 8x8 pixel toy image の token sequence (flatten + project path をたどる)。
- patch embed、position embed、transformer blocks、head に分解した parameter count。
- target resolution での forward pass あたり FLOPs。
- ViT-B/16 @ 224、ViT-L/14 @ 336、DINOv2 ViT-g/14 @ 224、SigLIP SO400m/14 @ 384 の comparison table。

実行してください。parameter count を公開値と照合してください。patch size と resolution を変え、token-count cost の感覚をつかんでください。

## 仕上げ

この lesson は `outputs/skill-patch-geometry-reader.md` を作ります。ViT config (patch size、resolution、hidden dim、depth) が与えられると、根拠付きの token-count、parameter-count、VRAM estimate を出します。VLM の vision backbone を選ぶたびにこの skill を使ってください。「token が爆発して LLM context が埋まった」という事故を防げます。

## 演習

1. native 1280x720 input、patch size 14 の Qwen2.5-VL について patch-token sequence length を計算してください。CLS-only representation と比べるとどうなりますか。

2. 1080p frame (1920x1080) を patch 14 にすると何 token になりますか。30 FPS の 5 分 video では total visual token はいくつですか。最も cost を減らすのは pooling、frame sampling、token merging のどれですか。

3. pure Python で patch token の mean pooling を実装してください。DINOv2 output の 196 token を mean-pool した結果が、pooled embedding を要求したときの model の `forward` と一致することを確認してください。

4. "Vision Transformers Need Registers" (arXiv:2309.16588) の Section 3 を読んでください。register が吸収する artifact と、それが downstream dense prediction で重要な理由を 2 文で説明してください。

5. `code/main.py` を patch-n'-pack 対応に変更してください。異なる resolution の image list を受け取り、1 つの packed sequence と block-diagonal attention mask を生成します。Lesson 12.06 に進んだら、その実装と照合してください。

## 重要語句

| Term | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| Patch | 「16x16 pixel square」 | input image の fixed-size non-overlapping region。1 token になる |
| Patch embedding | 「Linear projection」 | flattened patch pixels を D-dim vector へ写像する shared learned matrix (または stride=P の Conv2d) |
| CLS token | 「Class token」 | final hidden state が画像全体を表す、先頭に付与される learnable vector。2026 年では optional |
| Register token | 「Sink token」 | pretraining 中に ViT が発達させる high-norm attention artifact を吸収する extra learnable tokens |
| Position embedding | 「Positional info」 | sequence に order を与える per-position vector または rotation。2D-RoPE が modern default |
| Grid | 「Patch grid」 | given resolution と patch size で得られる (H/P) x (W/P) の 2D patch array |
| NaFlex | 「Native flexible resolution」 | retraining なしで複数の aspect ratio と resolution を扱う SigLIP 2 の feature |
| Backbone | 「Vision tower」 | VLM で patch-token output を LLM に渡す pretrained image encoder |
| Pooling | 「Image-level summary」 | patch token を 1 vector に変換する strategy: CLS、mean、attention pool、register-based など |
| Patch 14 vs 16 | 「Finer vs coarser grid」 | Patch 14 は image あたり token が多く、OCR fidelity は高いが遅い。patch 16 は classic default |

## 参考文献

- [Dosovitskiy et al. — An Image is Worth 16x16 Words (arXiv:2010.11929)](https://arxiv.org/abs/2010.11929) — original ViT。
- [He et al. — Masked Autoencoders Are Scalable Vision Learners (arXiv:2111.06377)](https://arxiv.org/abs/2111.06377) — MAE、self-supervised pretraining。
- [Oquab et al. — DINOv2 (arXiv:2304.07193)](https://arxiv.org/abs/2304.07193) — scale した self-distillation、label なし。
- [Darcet et al. — Vision Transformers Need Registers (arXiv:2309.16588)](https://arxiv.org/abs/2309.16588) — register token と artifact analysis。
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) — 2026 年の default vision tower。
- [Zhai et al. — Scaling Vision Transformers (arXiv:2106.04560)](https://arxiv.org/abs/2106.04560) — empirical scaling laws。
