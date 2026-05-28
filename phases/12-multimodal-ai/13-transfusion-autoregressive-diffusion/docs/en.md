# Transfusion: 1つのTransformerでAutoregressive TextとDiffusion Imageを扱う

> Chameleon と Emu3 は discrete tokens に全てを賭けた。動くが、quantization bottleneck は目に見える。画像品質は continuous-space diffusion models より低いところで頭打ちになる。Transfusion (Meta, Zhou et al., 2024年8月) は逆に賭ける。画像は continuous のまま保ち、VQ-VAE を完全に捨て、2つのlossで1つの transformer を訓練する。Text tokens には next-token-prediction。Image patches には flow-matching / diffusion loss。どちらの objective も同じ重みを最適化する。Stable Diffusion 3 の基盤アーキテクチャである MMDiT は近い親戚だ。このレッスンでは Transfusion の主張を読み、toy two-loss trainer を作り、1つの transformer に両方の仕事をさせる attention mask を追う。

**種類:** 構築
**言語:** Python (stdlib, MNIST規模のtoy two-loss trainer)
**前提:** Phase 12 · 11 (Chameleon), Phase 8 (Generative AI)
**所要時間:** 約180分

## 学習目標

- 1つの backbone 上で2つのloss (text tokens の NTP、image patches の diffusion MSE) を走らせる transformer を接続する。
- Image patches 間の bidirectional attention と text tokens 上の causal attention を組み合わせることが、なぜ正しい mask 選択なのか説明する。
- Transfusion-style (continuous images, diffusion loss) と Chameleon-style (discrete images, NTP) を compute、quality、code complexity で比較する。
- MMDiT の貢献を名指しする: 各blockでの modality-specific weights、residual stream 上の joint attention。

## 問題

Discrete vs continuous image tokens の議論は LLM より古い。Continuous representations (raw pixels, VAE latents) は細部を保つ。Discrete tokens (VQ indices) は transformer の native vocabulary に収まりやすいが、quantization step で細部を失う。

Chameleon / Emu3 は discrete に進んだ。lossは1つ、architectureも1つだが、image fidelity は tokenizer quality によって上限が決まる。

Diffusion models は continuous に進んだ。画像品質は非常に高いが、LLM とは別モデルであり、noise-schedule engineering が複雑で、text generation ときれいに統合しにくい。

Transfusion は問う。両方を持てないか。画像は continuous のまま、なお1つのmodelを訓練し、2つのlossを1つのgradient stepに縫い合わせる。

## 概念

### Two-loss architecture の構造

単一の decoder-only transformer が、次を含む sequence を処理する:

- Text tokens (discrete, BPE vocab由来)。
- Image patches (continuous, 16x16 pixel blocks を linear embedding で hidden dim にprojectしたもの。ViT encoder の入力と同じ)。
- Continuous patches が置かれる場所を示す `<image>` と `</image>` tags。

Forward pass は1回だけ走る。Loss は token ごとに2つの head のどちらかを選ぶ:

- Text tokens: vocab-logits head 上の標準 cross-entropy。
- Image patches: continuous patches 上の diffusion loss。各patchに加えたnoiseを予測する。

Gradient は shared transformer body を通って流れる。両方のlossが shared weights を同時に改善する。

### Attention mask: causal text と bidirectional image

Text tokens は causal でなければならない。text token が future text に attend できると teacher forcing が壊れる。一方、image patches は1枚の snapshot を表す。同じ image block 内では互いに bidirectional に attend すべきだ。

Mask は次の通り:

```
M[i, j] = 1 if:
  (i is text and j is text and j <= i)   # textではcausal
  OR (i is image and j is image and same_image_block(i, j))   # image内ではbidirectional
  OR (i is text and j is image and j < i_image_end)   # textは前のimagesを見る
  OR (i is image and j is text and j < i_image_start)   # imageは前のtextを見る
```

Training と inference では block-triangular mask として実装する。

### Transformer 内の diffusion loss

Diffusion loss は標準的だ。Image patch にnoiseを加え、modelにそのnoiseを予測させる (または等価に clean patch を予測させる)。Transfusion の版では flow matching を使い、noisy から clean への velocity field を予測する。

Training では:
1. 各 image patch x0 について random timestep t をsampleする。
2. Noise ε をsampleし、xt = (1-t) * x0 + t * ε を計算する (flow matching の linear interpolation)。
3. Transformer が v_theta(xt, t) を予測する。loss = MSE(v_theta(xt, t), ε - x0)。
4. 同じ sequence の text NTP losses と一緒に backprop する。

Inference での generation は:
- Text tokens: 標準 autoregressive sampling。
- Image patches: prior text tokens に条件付けた diffusion sampling loop (典型的には10-30 steps)。

### MMDiT: Stable Diffusion 3 の variant

Stable Diffusion 3 (Esser et al., 2024年3月) は Transfusion と同時期に MMDiT (Multimodal Diffusion Transformer) を出荷した。これらの architecture は兄弟関係にある。

MMDiT の主な違い:

- Blockごとの modality-specific weights。各 transformer block は text tokens と image patches に対して別々の Q, K, V, MLP weights を持つ。Attention は joint (cross-modality) で、それ以外は modality-specific。
- Rectified flow training。既知の sampling と DDPM より単純な数学を持つ specific flow-matching variant。
- Scale。MMDiT は SD3 (2B と 8B param variants) の backbone。Transfusion paper は 7B まで scale する。

どちらも同じ core idea に収束する。1つの transformer が text には NTP、continuous image representations には diffusion を走らせる。

### Chameleon-style を上回る理由

Image generation における continuous-diffusion と discrete-NTP の quality gap は測定できる。Transfusion paper の報告:

- 7B params で、同サイズの Chameleon-style model を FID で3-5 points上回る。
- Tokenizer training が不要。Image encoder はより単純 (ViT の input layer と同じ linear projection to hidden)。
- Autoregressive image tokens と違い、inference で image patch denoising を parallelize できる。

欠点: Transfusion は dual-loss model なので training dynamics が難しい。Loss weights は tuning が必要。NTP と diffusion の schedule mismatch により、片方の head が支配的になることがある。

### Downstream にあるもの

Janus-Pro (Lesson 12.15) は、understanding と generation の vision encoder を decouple することで Transfusion の idea を磨く。片方は SigLIP、もう片方は VQ を使い、transformer body は共有する。Show-o (Lesson 12.14) は diffusion を discrete-diffusion (masked prediction) に置き換える。Unified-generation family は Transfusion 以後、急速に枝分かれする。

2026年の production VLMs のうち画像を出力するもの、Gemini 3 Pro、GPT-5、Claude Opus 4.7 の image generation path は、ほぼ確実にこの family の descendant を使っている。詳細は proprietary だ。

## 使ってみる

`code/main.py` は tiny MNIST-like problem 上で toy Transfusion を作る:

- Text captions は digit (0-9) を説明する短い integer sequences。
- Images は 4x4 grids of bytes。
- Shared-weight linear projections のpairが transformer の stand-in として振る舞う。Text には NTP loss、noisy patches には MSE loss。
- Training loop は2つのlossを交互に走らせ、attention mask は明示的。
- Generation は1回の forward pass で text caption と 4x4 image を生成する。

Transformer は toy だ。Two-loss plumbing、attention mask construction、inference loop が本当の成果物である。

## 仕上げ

このレッスンは `outputs/skill-two-loss-trainer-designer.md` を作る。新しい multimodal training task (text + image, text + audio, text + video) が与えられたとき、two-loss schedule (loss weights, mask shape, shared vs modality-specific blocks) を設計し、implementation risks を指摘する。

## 演習

1. Transfusion-style model が 70% text tokens と 30% image patches で訓練される。Image diffusion loss の大きさが text NTP loss の約10倍である。両者を balance する loss weights は何か。

2. Sequence `[T, T, <image>, P, P, P, P, </image>, T]` の block-triangular mask を実装せよ。各entryを0または1で示せ。

3. MMDiT は modality-specific QKV weights を持つ。Transfusion の fully-shared transformer と比べて、parameter count overhead はどれくらい増えるか。7B params では価値があるか。

4. Generation: text prompt が与えられ、model は50 tokens分 NTP を走らせ、`<image>` に到達し、その後256 patches上で20 denoise stepsの diffusion を走らせる。Forward passes は合計いくつか。

5. SD3 paper Section 3 を読め。Rectified flow を説明し、なぜ DDPM より少ない inference steps で収束するのか述べよ。

## 重要語句

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|------------------------|
| Two-loss training | "NTP + diffusion" | 1つの transformer が同じ gradient step で text tokens 上の cross-entropy と continuous image patches 上の MSE の両方を最適化する |
| Flow matching | "Rectified flow" | Noise から clean data への velocity field を予測する diffusion variant。DDPM より数学が単純 |
| MMDiT | "Multimodal DiT" | Stable Diffusion 3 の architecture。joint attention、modality-specific MLPs と norms |
| Block-triangular mask | "Causal text + bidirectional image" | Text tokens 間は causal、image regions 内は bidirectional になる attention mask |
| Continuous image representation | "No VQ" | Integer codebook indices ではなく、real-valued vectors としての image patches |
| Velocity prediction | "v-parameterization" | Network output は noise 自体ではなく、noise と data の間の velocity field |

## 参考文献

- [Zhou et al. — Transfusion (arXiv:2408.11039)](https://arxiv.org/abs/2408.11039)
- [Esser et al. — Stable Diffusion 3 / MMDiT (arXiv:2403.03206)](https://arxiv.org/abs/2403.03206)
- [Peebles & Xie — DiT (arXiv:2212.09748)](https://arxiv.org/abs/2212.09748)
- [Zhao et al. — MonoFormer (arXiv:2409.16280)](https://arxiv.org/abs/2409.16280)
- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
