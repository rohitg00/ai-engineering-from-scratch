# Video-Language Models: Temporal Tokens and Grounding

> video は写真の束ではありません。5秒の clip には因果順序、action verbs、event timing があり、image model だけでは表現できません。Video-LLaMA (Zhang et al., 2023年6月) は、audio-visual grounding を備えた最初期の open video-LLM を提供しました。VideoChat と Video-LLaVA はこの pattern を拡張しました。2025年には Qwen2.5-VL の TMRoPE が frontier proprietary model との差を縮めました。それぞれの system は temporal tokens を別々に解きました。clip ごとの Q-former、frame ごとの concat-pool、token ごとの TMRoPE です。この lesson ではそれらの pattern を読み解き、uniform-vs-dynamic frame sampler を作り、temporal grounding task で評価します。

**種別:** 構築
**言語:** Python (stdlib, frame sampler + temporal-grounding evaluator)
**前提条件:** Phase 12 · 08 (LLaVA-OneVision)
**所要時間:** 約180分

## 学習目標

- temporal positional encoding が、vision encoder とは独立に video VLM の性能を変える理由を説明する。
- tokens-per-second と grounding accuracy の観点で、uniform、dynamic-FPS、event-driven frame sampling を比較する。
- Q-former-per-clip (Video-LLaMA)、pooled-per-frame (Video-LLaVA)、M-RoPE-per-token (Qwen2.5-VL) の設計を説明する。
- 4つの video benchmark、VideoMME、TempCompass、EgoSchema、Video-MMMU を挙げられる。

## 問題

30 FPS の 1分 video は 1800 frames です。1 frame あたり 196 visual tokens (224 解像度の ViT-B) なら 352k tokens になり、2024年時点のどの LLM context よりも大きくなります。

削減戦略は3つあります。

1. frame を subsample する (content に応じて 1-8 FPS)。
2. 各 frame の patch tokens を強く pool する (3x3 または 4x4 bilinear pool)。
3. 16-frame clip を受け取り 64 tokens を出す Q-former で圧縮する。

それぞれ trade-off は異なります。Subsampling は temporal detail を失います。Pooling は spatial detail を失います。Q-former は両方を少し失いますが tokens を節約します。

もう1つの軸は temporal position encoding です。model は frame 5 が frame 6 より前に来たことをどう知るのでしょうか。選択肢には、単純な 1D temporal RoPE (Video-LLaMA)、learned temporal embeddings (Video-LLaVA)、TMRoPE (Qwen2.5-VL、完全な 3D) があります。

## コンセプト

### Video-LLaMA: Q-former per clip + audio branch

Video-LLaMA (2023) は最初期の open video-LLM でした。architecture は次の通りです。

- 2 FPS の 16-frame clips (つまり8秒)。
- frame ごとの ViT features -> 16 frames 全体へ cross-attend する Video Q-former -> 32 learned queries -> LLM。
- 並列 audio branch: waveform -> ImageBind audio encoder -> Audio Q-former -> 32 queries -> LLM。

強みは audio-visual joint reasoning です。弱みは clip 長が固定で、任意時刻の grounding ができないことです。

### VideoChat and Video-LLaVA

VideoChat は Video-LLaMA の idea を保ちつつ、audio を外して簡素化しました。Video-LLaVA (Lin et al., 2023) は、images と video frames の両方で単一の visual encoder を訓練し ("alignment before projection")、統一された representation を得ました。どちらも frozen-CLIP-encoder + MLP + LLM です。

どちらも long video は扱えません。どちらも 8-16 frame の system です。

### Qwen2.5-VL and TMRoPE

Qwen2.5-VL は TMRoPE、Temporal-Modality Rotary Position Embedding を導入しました。各 patch token は (t, h, w) position を持ち、t は frame index ではなく実際の timestamp です。

単純な temporal embedding との主な違いは次です。

- index ではなく absolute time。model は「frame 15」ではなく「4.2秒時点」を見ます。
- per-clip ではなく per-token rotation。各 visual token は timestamp によって独立に rotation されます。
- dynamic FPS と互換。ある区間を 2 FPS、別区間を 4 FPS で sample しても、TMRoPE は不均一な間隔を自然に扱えます。

TMRoPE により、「猫がジャンプするのは何秒か」という query が可能になります。model は「4.2秒時点」と出力できます。Video-LLaMA は「clip の序盤」としか言えませんでした。

### Frame sampling 戦略

Uniform: duration 全体から N frames を均等に sample します。単純ですが motion peak を失います。

Dynamic FPS: motion intensity に基づいて適応的に sample します。Optical flow や frame differencing により high-motion segment を密に sample します。Qwen2.5-VL はこれで訓練されます。

Event-driven: lightweight detector を走らせ、action が起きる場所をより多く sample します。VideoAgent が使います。

Keyframe + context: shot boundary と、その周辺の数 frames を sample します。cinematic content で使われます。

### Frame ごとの pooling

1 FPS かつ 1 frame あたり 576 tokens なら、5分 clip は 172,800 tokens です。Qwen2.5-VL-72B の 128k context ではぎりぎり扱えますが高コストです。

3x3 bilinear pool は 1 frame あたり 64 tokens まで減らし、5分で 19,200 tokens になります。多くの task の sweet spot です。

spatial detail の重要度が低い agent workflow では、より強く pool します (6x6 -> 1 frame あたり 16 tokens)。

### 4つの video benchmark

- VideoMME: short + medium + long を含む包括的な video understanding。
- TempCompass: 「before」/「after」質問による細粒度 temporal reasoning。
- EgoSchema: long-horizon な first-person video。
- Video-MMMU: multimodal multi-discipline video questions。

完全な video-VLM evaluation では4つすべてを使います。それぞれ異なる軸に負荷をかけます。TempCompass は ordering、EgoSchema は3分超の reasoning、VideoMME は duration の幅を見ます。

### Grounding output formats

temporal grounding の output format:

- Free text: 「猫は4秒付近でジャンプする」。parse しやすいが不正確です。
- Structured JSON: `{"event": "jump", "start": 4.1, "end": 4.3}`。Qwen2.5-VL はこれを訓練します。
- Token-based: 特別な `<time>4.1</time>` tokens を answer に挟み込みます。Qwen2.5-VL の内部 format です。

downstream use では token-based が最も正確です。Qwen2.5-VL の JSON output format は直接 parse できます。

### 2026年の best practice

2026年の video VLM では次を使います。

- Encoder: M-RoPE または TMRoPE (Qwen2.5-VL) 付き SigLIP 2。
- Frame sampling: max-frame cap 付き dynamic FPS (motion に応じて 1-4)。
- Per-frame pooling: 3x3 bilinear。
- Output: time + event fields を持つ structured JSON。
- Benchmarks: general には VideoMME + TempCompass、long-horizon には EgoSchema。

## 使ってみる

`code/main.py` includes:

- Uniform と dynamic-FPS の frame sampler。
- toy temporal-grounding evaluator: time T の "ground truth" event と model output を受け取り、tolerance 付きで accuracy を採点します。
- Video-LLaMA (16 frames, Q-former)、Video-LLaVA (8 frames, MLP)、Qwen2.5-VL (dynamic FPS + TMRoPE) の比較。

## 仕上げ

この lesson は `outputs/skill-video-vlm-frame-planner.md` を生成します。video task (monitoring、action recognition、temporal grounding、summarization) を受け取り、frame sampler、pooling factor、output format、expected accuracy tier を選びます。

## 演習

1. 3分の cooking demo では uniform と dynamic FPS のどちらを選ぶか。token count で正当化してください。

2. TMRoPE は、単純な temporal embedding table ではできない何を具体的に追加しますか。

3. VLM が出力できる temporal grounding 用 JSON schema を書いてください。error cases も含めます。

4. Video-LLaVA の Section 3「Alignment Before Projection」を読んでください。別々の image encoder と video encoder を訓練するより、なぜ優れているのでしょうか。

5. VideoMME leaderboard を見て、2026年時点で top open model と top proprietary model の差はどれくらいですか。その差のうち、temporal encoding と base LLM scale はそれぞれどの程度寄与していますか。

## 重要語句

| Term | よく言われること | 実際の意味 |
|------|-----------------|------------------------|
| Temporal grounding | 「Time-localized answers」 | event が起きる specific timestamp range を VLM が出力すること |
| TMRoPE | 「Time-Multimodal RoPE」 | Qwen2.5-VL で使われる、absolute timestamps を持つ 3D rotary position |
| Dynamic FPS | 「Motion-aware sampling」 | high-motion segment では多く、static segment では少なく frame を sample すること |
| Frame pooling | 「Spatial compress per frame」 | LLM の前に bilinear interpolation で frame ごとの patches を減らすこと |
| Video Q-former | 「Clip compressor」 | N frames を K learned queries に写像する cross-attention bottleneck |
| VideoMME | 「Video bench」 | short/medium/long を含む包括的 video benchmark、2500+ samples |

## 参考文献

- [Zhang et al. — Video-LLaMA (arXiv:2306.02858)](https://arxiv.org/abs/2306.02858)
- [Li et al. — VideoChat (arXiv:2305.06355)](https://arxiv.org/abs/2305.06355)
- [Lin et al. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Qwen Team — Qwen2.5-VL (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Lin et al. — VILA-1.5 (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
