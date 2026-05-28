# Show-o と Discrete-Diffusion Unified Models

> Transfusion は continuous と discrete representations を混ぜる。Show-o (Xie et al., 2024年8月) は逆方向へ進む。Text tokens は causal next-token prediction、image tokens は MaskGIT の流れを汲む masked discrete diffusion を使う。両者は hybrid attention mask を持つ1つの transformer の中に置かれる。その結果、VQA、text-to-image、inpainting、mixed-modality generation が、1つの backbone、modalityごとに1つの tokenizer、1つの loss formulation (masked prediction へ拡張された next-token) に統合される。このレッスンでは Show-o design、なぜ masked discrete diffusion が parallel で few-step な image generator なのかを見て、Transfusion と Emu3 と対比する。

**種類:** 学習
**言語:** Python (stdlib, masked-discrete-diffusion sampler)
**前提:** Phase 12 · 13 (Transfusion)
**所要時間:** 約120分

## 学習目標

- Masked discrete diffusion を説明する。Tokens を一様に mask し、transformer にそれらを復元させる schedule。
- Parallel image decoding (Show-o, MaskGIT) と autoregressive image decoding (Chameleon, Emu3) を speed と quality で比較する。
- Show-o が1つの checkpoint で扱う3つの task、T2I、VQA、image inpainting を名指しする。
- Masking schedule (cosine, linear, truncated) を選び、sample quality への影響を推論する。

## 問題

Transfusion の two-loss training は機能するが、dynamics は難しい。Continuous diffusion loss は discrete NTP loss と数値スケールが異なる。Loss weights の balancing は hyperparameter search になる。Architecture は有効だが複雑だ。

Show-o の答えは、Chameleon のように両方の modalities を discrete に保ちつつ、image は sequential ではなく masked discrete diffusion で parallel に生成することだ。Training objective は next-token-prediction を自然に一般化した single masked-token-prediction になる。

## 概念

### Masked discrete diffusion (MaskGIT)

元の Chang et al. (2022) の MaskGIT trick は洗練されている。完全に mask された image (全tokenが special `<MASK>` id) から始める。各stepで、全masked tokensを parallel に予測し、最も confidence の高い top-K predictions を保持し、残りを再度 mask する。約8-16 iterations で全tokensが埋まる。各stepで何個 unmask するかの schedule は tuned される。Cosine schedules がよく機能する。

Training は単純だ。Masking ratio を [0, 1] から一様sampleし、それを image の VQ tokens に適用し、transformer に masked ones を復元させる。Text に対する BERT のやり方を image generation に scale したものだ。

### Show-o: 1つの transformer と hybrid mask

Show-o は MaskGIT を causal-language-model transformer の中に置く。Attention mask は次の通り:

- Text tokens: causal (標準 LLM)。
- Image tokens: image block 内では full bidirectional (masked tokens が prediction 中に他の全image tokensを見られる)。
- Text-to-image: text は prior images に attend し、image は prior text に attend する。

Training は次を切り替える:
1. Text sequences 上の標準 NTP。
2. T2I samples: text → image。Masked image tokens に対する masked-token-prediction loss。
3. VQA samples: image → text。Masked text tokens (実質的には NTP)。

Unified loss は `<MASK>` tokens 上の cross-entropy で、text NTP (最後のtokenだけが「masked」) と image masked-diffusion (random subset が masked) の両方を覆う。

### Parallel sampling

Show-o は image を約16 stepsで生成する。Autoregressive の tokenごと約1000 stepsや、diffusion の約20 stepsとは異なる。各stepで masked tokens 全体を parallel に予測し、confident な top-K を commit し、繰り返す。

比較:
- Chameleon / Emu3 (tokens上の autoregressive): N_tokens forward passes。通常は imageあたり1024-4096。
- Transfusion (continuous diffusion): 約20 steps。各stepは full transformer pass。
- Show-o (masked discrete diffusion): 約16 steps。各stepは full transformer pass。

Show-o は同規模のmodelsで Chameleon より速く、step count は Transfusion とほぼ同等で、per-step cost は低い (continuous MSE loss ではなく discrete vocab logits)。

### 1つの checkpoint に入る task

Show-o は inference で4つの task を support し、prompt format で選択する:

- Text generation: 標準 autoregressive text output。
- VQA: image in, text out。
- T2I: text in, masked discrete diffusion による image out。
- Inpainting: 一部tokensが mask された image を fill in。

Inpainting capability は masked-prediction training から無料で得られる。VQ-token grid の region を mask し、残りと text prompt を入力し、masked tokens を予測する。

### Masking schedule

各stepで何個 unmask するかの schedule が quality を形作る。Show-o は cosine を推奨する:

```
mask_ratio(t) = cos(pi * t / (2 * T))   # t = 0..T
```

Step 0 では全tokensが masked (ratio 1.0)。Step T では masked なし。Cosine は prediction が最もinformativeになる mid-range ratios に mass を集中させる。Linear schedules も機能するが、より速く plateau する。

### Show-o2

Show-o2 (2025 follow-up, arXiv 2506.15564) は Show-o を scale する。より大きな LLM base、より良い tokenizer、改善された mask schedule。同じ architectural pattern だ。

### Show-o の位置づけ

2026年の taxonomy では:

- Discrete tokens + NTP: Chameleon, Emu3。単純だが inference が遅い。
- Discrete tokens + masked diffusion: Show-o, MaskGIT, LlamaGen, Muse。Parallel sampling だが、tokenizer による lossiness は残る。
- Continuous + diffusion: Transfusion, MMDiT, DiT。最高品質だが training はより複雑。
- Continuous + flow matching in a VLM: JanusFlow, InternVL-U。最新。

Taskで選ぶ。Open model 1つで T2I + inpainting + VQA と妥当な speed が欲しいなら Show-o。Quality が最優先で two-loss plumbing を負担できるなら Transfusion。

## 使ってみる

`code/main.py` は Show-o sampling を simulate する:

- 16個の VQ tokens からなる toy grid。
- Prompt と現在 unmasked な tokens に基づいて logits を予測する mock "transformer"。
- Cosine schedule を使った8 stepsの parallel masked sampling。
- Intermediate states (mask pattern evolution) と final tokens を表示する。

実行し、mask が step by step で溶けていく様子を見る。

## 仕上げ

このレッスンは `outputs/skill-unified-gen-model-picker.md` を作る。Understanding (VQA, captioning) と generation (T2I, inpainting) の両方を open-weights constraint のもとで必要とする product に対し、Show-o family、Transfusion/MMDiT family、Emu3 / Chameleon family の間から concrete trade-offs とともに選ぶ。

## 演習

1. Masked discrete diffusion は約16 stepsで sample する。なぜ1 stepではないのか。Step 0 で全て unmask すると何が壊れるか。

2. Inpainting は masked diffusion で無料になる。Show-o の inpainting が specialist model に勝つ product use case (実在または仮想) を提案せよ。

3. Cosine schedule vs linear schedule: T=8 の各stepで unmasked tokens の数を追跡せよ。どちらがより balanced か。

4. 512x512 の Show-o image は1024 tokens。Vocab K=16384 のとき、model は 1024 * log2(16384) = 14,336 bits (~1.75 KiB) の data を出す。Stable Diffusion は 512*512*24 bits = 6,291,456 bits (~768 KiB) の raw pixels を出す。Compression ratio はいくつで、その代償または利益は何か。

5. LlamaGen (arXiv:2406.06525) を読め。LlamaGen の class-conditional autoregressive image model は Show-o の masked approach とどう違うか。

## 重要語句

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|------------------------|
| Masked discrete diffusion | "MaskGIT-style" | Masked tokens を予測する training。Inference では confidence が最も高い predictions から反復的に unmask する |
| Cosine schedule | "Unmask schedule" | Inference steps にわたる mask ratio の decay。Confidence growth を mid-range に集中させる |
| Parallel decoding | "All tokens at once" | 各stepで masked tokens の full sequence を1回の forward pass で予測し、top-K を commit する |
| Hybrid attention | "Causal + bidirectional" | Text tokens 上では causal、image blocks 内では bidirectional な mask |
| Inpainting | "Fill-in generation" | 一部tokensが masked された image に条件付けて missing tokens を予測する。Training objective から無料で得られる |
| Commitment rate | "Top-K per step" | 各iterationで「done」と宣言されるtokens数。Inference と quality の trade-off を制御する |

## 参考文献

- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
- [Show-o2 (arXiv:2506.15564)](https://arxiv.org/abs/2506.15564)
- [Chang et al. — MaskGIT (arXiv:2202.04200)](https://arxiv.org/abs/2202.04200)
- [Sun et al. — LlamaGen (arXiv:2406.06525)](https://arxiv.org/abs/2406.06525)
- [Chang et al. — Muse (arXiv:2301.00704)](https://arxiv.org/abs/2301.00704)
