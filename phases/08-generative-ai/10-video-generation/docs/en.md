# 動画生成

> 画像は 2-D tensor です。動画は 3-D tensor です。理論は同じですが、計算量は 10-100 倍難しくなります。OpenAI の Sora (Feb 2024) は、それが可能であることを示しました。2026 年までに Veo 2、Kling 1.5、Runway Gen-3、Pika 2.0、WAN 2.2 は、1080p の本番 text-to-video を提供しています。そして open-weights stack (CogVideoX, HunyuanVideo, Mochi-1, WAN 2.2) は 12 か月遅れで追っています。

**種別:** 構築
**言語:** Python
**前提条件:** Phase 8 · 07 (Latent Diffusion), Phase 7 · 09 (ViT), Phase 8 · 06 (DDPM)
**所要時間:** 約45分

## 課題

24fps の 10 秒 1080p 動画は、1920×1080×3 ピクセルのフレームが 240 枚です。クリップあたり生データは約 1.5 GB になります。Pixel-space diffusion は現実的ではありません。必要なのは次のものです。

1. **Spatiotemporal compression.** フレームではなく動画を、時空間パッチ列にエンコードする VAE。
2. **Temporal coherence.** フレーム間で、内容、照明、物体の同一性を数秒にわたって共有する必要があります。ネットワークは動きをモデル化しなければなりません。
3. **Compute budget.** 同じモデルサイズでも、動画訓練は画像より 10-100 倍高価です。
4. **Conditioning.** テキスト、画像 (first-frame)、音声、または別の動画。本番モデルの多くは 4 つすべてを受け取ります。

これを解いたアーキテクチャは、巨大な (prompt, caption, video) データセットで訓練された、時空間パッチに対する **Diffusion Transformer (DiT)** です。Lesson 06 と同じ diffusion loss を使います。

## コンセプト

![Video diffusion: patchify, DiT, decode](../assets/video-generation.svg)

### Patchify

3D VAE、つまり学習された時空間圧縮で動画をエンコードします。latent の形状は `[T_latent, H_latent, W_latent, C_latent]` です。これをサイズ `[t_p, h_p, w_p]` のパッチに分割します。Sora 風モデルでは、`t_p = 1` (フレームごとのパッチ) または `t_p = 2` (2 フレームごと) です。10 秒 1080p 動画は、約 20,000-100,000 パッチに圧縮されます。

### Spatiotemporal DiT

Transformer が、平坦化されたパッチ列を処理します。各パッチは 3D positional embedding (time + y + x) を持ちます。Attention は通常、分解されます。

- **Spatial attention** 各フレーム内のパッチ間。
- **Temporal attention** 同じ空間位置のフレーム間。
- **Full 3D attention** は 16-100 倍高価です。低解像度または研究用途でのみ使われます。

### Text conditioning

大きな text encoder との cross-attention を使います。Sora は T5-XXL、CogVideoX-5B も T5-XXL を使います。長いプロンプトが重要です。Sora の訓練セットには、クリップあたり平均 200 token の GPT 生成 dense re-captions がありました。

### Training

時空間 latent に対する標準的な diffusion loss、ε または v prediction です。データは web video + 約 100M の curated clips + synthetic text captions。計算量は、小規模な研究実行でも 10,000+ GPU hours、Sora 規模では 100,000+ です。

## 2026 年の本番環境

| モデル | 日付 | 最大長 | 最大解像度 | Open weights? | 特徴 |
|-------|------|--------------|---------|---------------|---------|
| Sora (OpenAI) | 2024-02 | 60s | 1080p | No | world simulator 的性質を大規模に示した最初のモデル |
| Sora Turbo | 2024-12 | 20s | 1080p | No | 推論が 5 倍速い本番 Sora |
| Veo 2 (Google) | 2024-12 | 8s | 4K | No | 2025 年の最高品質 + physics |
| Veo 3 | 2025 Q3 | 15s | 4K | No | ネイティブ音声と強化されたカメラ制御 |
| Kling 1.5 / 2.1 (Kuaishou) | 2024-2025 | 10s | 1080p | No | 2025 Q1 の最良の人物動作 |
| Runway Gen-3 Alpha | 2024-06 | 10s | 768p | No | 上位にプロ向け動画ツールを搭載 |
| Pika 2.0 | 2024-10 | 5s | 1080p | No | 最も強いキャラクター一貫性 |
| CogVideoX (THUDM) | 2024 | 10s | 720p | Yes (2B, 5B) | 最初の open 5B-scale video |
| HunyuanVideo (Tencent) | 2024-12 | 5s | 720p | Yes (13B) | 2024 年後半の open SOTA |
| Mochi-1 (Genmo) | 2024-10 | 5.4s | 480p | Yes (10B) | 最も permissive なライセンス |
| WAN 2.2 (Alibaba) | 2025-07 | 5s | 720p | Yes | 2025 年半ばの最強 open model |

Open weights は画像領域よりも速く差を縮めています。2026 年半ばまでに、HunyuanVideo + WAN 2.2 LoRAs は、すでに多くの open-source workflows を支えています。

## 実装

`code/main.py` は、中心となる spatiotemporal DiT の考え方をシミュレートします。小さな合成動画を patchify し、パッチごとの position embedding を加え、パッチ列全体に対する transformer-style attention で denoise します。numpy は使わず、純粋な Python です。隣接フレームのパッチが denoiser と position embeddings を共有すると、1-D でも temporal coherence が現れることを示します。

### Step 1: 合成 1-D "video" を patchify する

```python
def make_video(T_frames=8, rng=None):
    # a "video" is a sequence of 1-D values following a smooth trajectory
    base = rng.gauss(0, 1)
    return [base + 0.3 * t + rng.gauss(0, 0.1) for t in range(T_frames)]
```

### Step 2: フレームごとの position embedding

```python
def pos_embed(t, dim):
    return sinusoidal(t, dim)
```

### Step 3: denoiser が系列全体を見る

各フレームを独立に denoise するのではなく、この小さなネットワークは全フレーム値 + それらの position embeddings を連結し、全フレームのノイズをまとめて予測します。

### Step 4: temporal coherence test

訓練後に動画をサンプルします。フレーム間 delta を測定します。モデルが時間構造を学んでいれば、各フレームを独立サンプルする場合より delta は小さく保たれます。

## 落とし穴

- **Independent per-frame sampling = flicker.** 各フレームに画像拡散を別々に走らせると、各フレームのノイズが独立しているため出力がちらつきます。動画拡散は、attention または shared noise を通じてフレームを結合することでこれを直します。
- **Naive 3D attention = OOM.** 10 秒 1080p latent に full 3D attention をかけると、数千億演算になります。spatial + temporal に分解します。
- **Data captioning matters more than size.** Sora の主な改善は、従来より約 10 倍詳細な caption、つまり GPT-4 による re-labelled clips で訓練したことでした。OpenAI の technical report はこの点を明示しています。
- **First-frame conditioning.** 本番モデルの多くは、画像を first frame として受け取ることもできます。これは "image-to-video" mode であり、訓練にもこの変種が含まれます。
- **Physics drift.** 長いクリップ (>10s) は微妙な不整合を蓄積します。Sliding-window generation + keyframe anchoring が役立ちます。

## 使いどころ

| ユースケース | 2026 年の選択 |
|----------|-----------|
| 最高品質の hosted text-to-video | Veo 3 または Sora |
| カメラ制御付き cinematic | motion brushes 付き Runway Gen-3 |
| クリップ間のキャラクター一貫性 | Pika 2.0 または Kling 2.1 |
| Open weights、高速 fine-tune | WAN 2.2 + LoRA |
| Image-to-video | WAN 2.2-I2V、Kling 2.1 I2V、または Runway |
| Audio-to-video lip sync | Veo 3 (native audio) または専用 lip-sync model |
| Video editing | Runway Act-Two、Kling Motion Brush、Flux-Kontext (still-frame) |

同等品質における動画 1 秒あたりのコストは、2024 年から 2026 年の間に 20 分の 1 まで下がりました。

## 出荷

`outputs/skill-video-brief.md` を保存します。このスキルは、video brief (duration, aspect ratio, style, camera plan, subject consistency, audio) を受け取り、model + hosting、prompt scaffolding (camera language, subject description, motion descriptors)、seed + reproducibility protocol、frame-level QA checklist を出力します。

## 演習

1. **Easy.** `code/main.py` で、(a) independent per-frame sampling、(b) joint sequence sampling の frame-to-frame delta を比較してください。delta の平均と分散を報告してください。
2. **Medium.** first-frame condition を追加してください。frame 0 を指定値に固定し、残りをサンプルします。固定値がどのように伝播するか測定してください。
3. **Hard.** HuggingFace diffusers を使い、ローカル GPU で CogVideoX-2B を実行してください。720p、6 秒クリップで 20 inference steps の時間を測定してください。spatiotemporal attention を profile してボトルネックを特定してください。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|-----------------------|
| Video VAE | "3-D VAE" | `(T, H, W, C)` を時空間 latent に圧縮する encoder。 |
| Patches | "The tokens" | latent の固定サイズ 3-D ブロック。DiT への入力。 |
| Factorized attention | "Spatial + temporal" | 空間方向に attention を実行し、その後時間方向に実行する。full 3-D attention は避ける。 |
| Image-to-video (I2V) | "Animate this photo" | モデルが画像 + テキストを受け取り、その画像から始まる動画を出力する。 |
| Keyframe conditioning | "Anchor frames" | 特定フレームを固定して、動画の流れを制御する。 |
| Motion brush | "Directional hint" | ユーザーが画像上に motion vectors を塗る UI 入力。 |
| Re-captioning | "Dense captions" | LLM を使い、訓練クリップを詳細なプロンプトで再ラベルすること。 |
| Flicker | "Temporal artifact" | フレーム間の不整合。coupled denoising で修正する。 |

## 本番メモ: video latents はメモリ帯域の問題

24 fps の 10 秒 1080p クリップは、240 frames × 1920 × 1080 × 3 ≈ 1.5 GB の生ピクセルです。4× video VAE compression (`2 × spatial × 2 × temporal`) 後でも、latent はリクエストあたり約 100 MB です。これを batch 1 の spatiotemporal DiT に 30 steps 通すと、HBM を通じて ~3 GB/step を移動することになります。ボトルネックは FLOPs ではなくメモリ帯域です。

本番の調整ノブは 3 つあり、いずれも production-inference literature の inference chapter から直接来ています。

- **TP across the DiT.** Text-to-video モデルは日常的に 10B params 以上です。4 H100 にまたがる TP=4 が標準で、405B 級モデルでは PP=2 × TP=2 です。step あたりのレイテンシは、all-reduce の壁までは TP にほぼ線形に下がります。
- **Frame batching = continuous batching.** 生成時、動画は attention で結びついたフレームの batch と考えられます。Continuous batching (in-flight scheduling) が適用できます。モデルアーキテクチャが sliding-window generation を許すなら、frame `t-1` を返しながら frame `t+1` のレンダリングを始めます。
- **Clip-level prefill cache.** Image-to-video では、first-frame conditioning は LLM の prompt prefill に似ています。一度計算し、temporal decoder passes 全体で再利用します。これは実質的に動画用の KV-cache です。

## 参考文献

- [Brooks et al. (2024). Video generation models as world simulators](https://openai.com/index/video-generation-models-as-world-simulators/) — Sora technical report。
- [Yang et al. (2024). CogVideoX: Text-to-Video Diffusion Models with An Expert Transformer](https://arxiv.org/abs/2408.06072) — CogVideoX。
- [Kong et al. (2024). HunyuanVideo: A Systematic Framework for Large Video Generative Models](https://arxiv.org/abs/2412.03603) — HunyuanVideo。
- [Genmo (2024). Mochi-1 Technical Report](https://www.genmo.ai/blog/mochi) — Mochi-1。
- [Alibaba (2025). WAN 2.2](https://wanvideo.io/) — 2025 年半ばの open SOTA。
- [Ho, Salimans, Gritsenko et al. (2022). Video Diffusion Models](https://arxiv.org/abs/2204.03458) — 動画拡散の初期重要論文。
- [Blattmann et al. (2023). Align your Latents (Video LDM)](https://arxiv.org/abs/2304.08818) — Stable Video Diffusion の先祖。
