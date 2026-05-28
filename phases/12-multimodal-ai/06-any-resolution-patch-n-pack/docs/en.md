# Any-Resolution Vision: Patch-n'-Pack と NaFlex

> 現実の画像は 224x224 の正方形ではない。receipt は 9:16、chart は 16:9、medical scan は 4096x4096 かもしれず、mobile screenshot は 9:19.5 である。2024年以前の VLM の答え、すなわちすべてを固定正方形に resize する方法は、OCR、document understanding、高解像度 scene parsing を成り立たせる signal を捨てていた。NaViT (Google, 2023) は、block-diagonal masking によって variable-resolution patches を単一 transformer batch に pack できることを示した。Qwen2-VL の M-RoPE (2024) は absolute positional table を完全に捨てた。LLaVA-NeXT の AnyRes は高解像度画像を base + sub-images に tile した。SigLIP 2 の NaFlex variant (2025) は、すべての aspect ratio を1つの checkpoint で扱いたい open VLM の default encoder になっている。この lesson では patch-n'-pack を end to end で実装する。

**種別:** 構築
**言語:** Python (stdlib、patch packer + block-diagonal mask)
**前提条件:** Phase 12 · 01 (ViT patches)、Phase 12 · 05 (LLaVA)
**所要時間:** 約120分

## 学習目標

- variable-resolution images の batch から patches を1つの sequence に pack し、block-diagonal attention mask を作る。
- task に応じて AnyRes tiling (LLaVA-NeXT)、NaFlex (SigLIP 2)、M-RoPE (Qwen2-VL) を選ぶ。
- resize せずに OCR、charts、photography の token budget を計算する。
- square-resize の3つの failure mode、すなわち squished text、cropped content、padding による wasted tokens を説明する。

## 問題

Transformers は sequence を期待する。batch は同じ長さの sequence の stack である。画像が 224x224 なら、毎回 196 patch tokens が得られ、padding も不要で、それで完了する。224 で train し、224 で infer し、resolution について二度と考えなくてよい。

現実は協力してくれない。documents は portrait (8.5x11 inch、だいたい 2:3)。chart screenshot は landscape (16:9)。receipt は縦長で細い (1:3)。medical imaging は 2048x2048 以上で配布される。mobile device screenshot は 1170x2532 (0.46:1) である。

2024年以前の3つの選択肢と、それぞれが失敗する理由:

1. 固定正方形 (224x224 または 336x336) に resize する。squish により text と faces が歪む。downscale により chart label と OCR content が壊れる。LLaVA-1.5 までは標準だった。
2. 固定 aspect ratio に crop する。画像の大部分を捨てることになり、crop location を選ぶこと自体が vision problem になる。
3. longest side に合わせて pad する。歪みは解決するが、portrait image では 50% 以上の tokens を padding に浪費する。attention cost はそれらの pad tokens に対しても二乗でかかる。

2024-2025年の答えは、transformer に画像の native resolution の patches を食べさせ、wasted compute なしで heterogeneous batch を1つの sequence に pack する方法を考えることだった。

## コンセプト

### NaViT と patch-n'-pack

NaViT (Dehghani et al., 2023) は、これが scale することを示した論文である。考え方は機械的だ。

1. batch 内の各 image について、選んだ patch size (例えば 14) で native patch grid を計算する。
2. 各 image の patches を、それぞれ variable-length sequence に flatten する。
3. すべての image の patch sequence を batch 用の1本の長い sequence に連結する。
4. image A の patches が image A の内部だけを見るように、block-diagonal attention mask を作る。
5. patch ごとの position information (2D RoPE または fractional position embeddings) を運ぶ。

336x336 (576 tokens)、224x224 (256 tokens)、448x336 (768 tokens) の3画像 batch は、1600-token sequence と 1600x1600 block-diagonal mask になる。padding はない。wasted compute もない。transformer は任意の aspect ratio を扱える。

NaViT は training 中の fractional patch dropping も導入した。batch 全体で patches の 50% を random に drop する。これは regularization と speed-up の両方になる。SigLIP 2 はこれを継承した。

### AnyRes (LLaVA-NeXT)

LLaVA-NeXT の AnyRes は pragmatical な代替案である。高解像度 image と固定 encoder (CLIP または SigLIP @ 336) があるとき、image を tile する。

1. 事前定義された grid layout、すなわち (1x1)、(1x2)、(2x1)、(1x3)、(3x1)、(2x2) などから、image の aspect ratio に最も合うものを選ぶ。
2. full image を grid に tile する。各 tile は 336x336 crop になる。
3. thumbnail も作る。global-context token として、画像全体を 336x336 に resize したものを使う。
4. すべての tile を frozen 336-encoder に通す。tile tokens + thumbnail tokens を連結する。

672x672 image を 2x2 grid + thumbnail で扱うと、4 * 576 + 576 = 2880 visual tokens になる。高価だが効果的である。LLM は local detail と global context の両方を見る。

AnyRes は、encoder が frozen で1つの resolution しか support しないときに最有力の経路である。ただし大きい image では token count が爆発する。1344x1344 image を 4x4 grid で扱うと 9216 + 576 ≈ 9800 tokens となり、8k LLM context の大半を埋めてしまう。

### M-RoPE (Qwen2-VL)

Qwen2-VL は Multimodal Rotary Position Embedding を導入した。NaViT の fractional positions や AnyRes の tile-and-thumbnail の代わりに、各 patch が 3D position (temporal、height、width) を持つ。query/key rotation が任意の H、W、temporal length を扱う。

M-RoPE は retraining なしで native dynamic resolution を出荷する。inference では任意の HxW image を入力し、patch embedder が H/14 x W/14 tokens を生成し、各 token が (t=0, r=row, c=col) position を受け取り、RoPE が正しい frequency で attention を回転させ、それで完了する。Qwen2.5-VL と Qwen3-VL はこれを継続している。InternVL3 の V2PE も、modality ごとの variable encoding という同じ考え方である。

AnyRes と違い、M-RoPE は native resolution で O(H x W / P^2) tokens で済み、multiplicative tile overhead がない。NaViT と違い、forward ごとに1つの image を想定する。resolution を跨いだ batching には、依然として上に patch-n'-pack が必要である。

### NaFlex (SigLIP 2)

NaFlex は SigLIP 2 checkpoint の native-flex mode である。単一 model が inference で複数の sequence length (256、729、1024 tokens) を処理する。内部では training に NaViT-style patch-n'-pack を使い、patch ごとの absolute fractional positions を使う。売りは、1つの checkpoint で task に応じて inference の token budget を選べることだ。

semantic task (classification、retrieval) なら 256 tokens。OCR や chart understanding なら 1024 tokens。retraining は不要である。

### Packing mask

block-diagonal mask は、多くの implementation がつまずく箇所である。length `n_i` の image `i=0..B-1` を含む packed sequence の total length を `N_total` とすると、shape `(N_total, N_total)` の mask `M` は、両方の index が同じ image block に入っている場合は 1、それ以外は 0 である。cumulative length list から構築できる。

```
offsets = [0, n_0, n_0+n_1, ..., N_total]
M[i, j] = 1 iff there exists b where offsets[b] <= i < offsets[b+1] and offsets[b] <= j < offsets[b+1]
```

PyTorch では `torch.block_diag` または explicit gather で1行で作れる。FlashAttention の variable-length path (`cu_seqlens`) は mask を完全に省き、cumulative-length tensor を直接使って sequence 内だけに attend する。典型的な batch では dense mask より約10倍速い。

### Token budgets

task ごとに strategy を選ぶ。

- OCR / documents: 1024-4096 tokens。SigLIP 2 NaFlex @ 1024、または AnyRes 3x3 + thumbnail。
- Charts and UI: native 384-448 で 729-1024 tokens。Qwen2.5-VL dynamic resolution と max pixels cap。
- Natural photos: 256-576 tokens で十分。downstream LLM は十分に見える。content density が高いところに token を払う。
- Video: spatial pooling 後に frame あたり 64-128 tokens、2-8 FPS。Lesson 12.17 で扱う。

2026年 production rule: task ごとの max-pixels cap を選び、その cap まで native aspect ratio で encode し、batch を pack し、padding は使わない。Qwen2.5-VL はまさにこの knob として `min_pixels` と `max_pixels` を公開している。

## 使ってみる

`code/main.py` は integer pixel coordinate を持つ heterogeneous image batch 向けに patch-n'-pack を実装する。処理内容:

- (H, W) image size の list を受け取る。
- patch size 14 で各 image の patch sequence length を計算する。
- total length `sum(n_i)` の1つの sequence に pack する。
- block-diagonal attention mask を作る (説明のため dense)。
- packed cost と square-resize、AnyRes tiling を比較する。
- mixed batch (receipt、chart、screenshot、photo) の token budget table を出力する。

実行してみること。出てくる数字が、2026年の open VLM がすべて patch-n'-pack を使う理由である。

## 仕上げ

この lesson は `outputs/skill-resolution-budget-planner.md` を生成する。mixed-aspect-ratio workload (OCR、charts、photos、video frames) と total-token budget を受け取り、適切な strategy (NaFlex、AnyRes、M-RoPE、fixed-square) を選び、request ごとの configuration を出力する。product 用に VLM の size を決めるときに使う skill である。latency budget を破壊する、静かな 10x token blowup を防ぐ。

## 演習

1. receipt は 600x1500 (1:2.5) である。patch size 14 なら native-resolution tokens はいくつか。336 への square-resize 後はいくつか。実務で OCR accuracy をより落とすのはどちらか。

2. length 256、576、729、1024 の4画像 batch 用に block-diagonal mask を作れ。attention matrix が 2585x2585 であり、非ゼロ要素がちょうど `256^2 + 576^2 + 729^2 + 1024^2` 個であることを確認せよ。

3. 1792x896 image を patch 14 で扱う。次を比較せよ: (a) 336 に square-resize して encode、(b) AnyRes 2x1 + thumbnail、(c) native の M-RoPE。最も token が少ないのはどれか。最も detail を保つのはどれか。

4. fractional patch dropping を実装せよ。packed sequence から 50% の tokens を uniform random に drop し、block-diagonal mask をそれに合わせて更新する。mask の sparsity 変化を測定せよ。

5. Qwen2-VL paper (arXiv:2409.12191) の Section 3.2 を読め。`min_pixels` と `max_pixels` が何を制御するか、なぜ上下限が両方必要かを2文で説明せよ。

## 重要語句

| Term | よく言われる表現 | 実際の意味 |
|------|-----------------|------------|
| Patch-n'-pack | "NaViT-style packing" | 異なる image からの variable-length patch sequences を1つの batch dimension に連結すること |
| Block-diagonal mask | "Packing mask" | 各 image の patches が pack 内の隣接 image ではなく自分自身だけに attend する attention mask |
| AnyRes | "LLaVA-NeXT tiling" | high-res image を fixed-size tiles の grid と global thumbnail に分け、各 tile を fixed encoder で encode する |
| NaFlex | "SigLIP 2 native-flex" | retraining なしで inference の 256/729/1024-token budget に対応する単一 SigLIP 2 checkpoint |
| M-RoPE | "Multimodal RoPE" | position table なしで任意の H、W、T を扱う 3D rotary position encoding (time, row, column) |
| cu_seqlens | "FlashAttention packing" | FlashAttention varlen path が dense block-diagonal mask の代わりに使う cumulative-length tensor |
| min_pixels / max_pixels | "Resolution bounds" | 非常に小さい入力または大きい入力の token count を cap する Qwen2.5-VL の request ごとの knob |
| Visual token budget | "How many tokens per image" | 画像あたりに出る patch tokens の概算。LLM の prompt budget と attention cost を決める |

## 参考文献

- [Dehghani et al. — Patch n' Pack: NaViT (arXiv:2307.06304)](https://arxiv.org/abs/2307.06304)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Laurençon et al. — What matters when building vision-language models? (Idefics2, arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
