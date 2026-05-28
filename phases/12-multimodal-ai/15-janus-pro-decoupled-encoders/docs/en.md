# Janus-Pro: Unified Multimodal Models のための Decoupled Encoders

> Unified multimodal models には避けられない緊張がある。Understanding は semantic features を欲しがる。SigLIP や DINOv2 の output vectors は concept-level information が豊かだ。Generation は reconstruction-friendly codes を欲しがる。VQ tokens は crisp pixels に戻しやすい。この2つの目標は、単一の encoder では両立しない。Janus (DeepSeek, 2024年10月) と Janus-Pro (DeepSeek, 2025年1月) は、解決策は無理に両立しようとしないことだと主張する。2つの encoders を decouple する。Tasks 間で transformer body は共有するが、understanding は SigLIP 経由、generation は VQ tokenizer 経由に route する。7B では Janus-Pro は GenEval で DALL-E 3 を上回り、MMMU では LLaVA に並ぶ。このレッスンでは、なぜ1つではなく2つの encoders が機能するのかを読む。

**種類:** 構築
**言語:** Python (stdlib, dual-encoder routing + shared-body signal)
**前提:** Phase 12 · 13 (Transfusion), Phase 12 · 14 (Show-o)
**所要時間:** 約120分

## 学習目標

- 単一の shared encoder が understanding または generation quality のどちらかを犠牲にする理由を説明する。
- Janus-Pro の routing を説明する。Understanding の input side では SigLIP features、generation の input/output では VQ tokens。
- Janus では成功しなかったところを Janus-Pro で成功させた data-mix scaling を追う。
- Decoupled (Janus-Pro)、coupled-continuous (Transfusion)、coupled-discrete (Show-o) architectures を比較する。

## 問題

Unified models は understanding と generation の間で transformer body を共有する。これまでの試み (Chameleon, Show-o, Transfusion) は全て、両方向に1つの visual tokenizer を使う。Tokenizer は compromise になる:

- Reconstruction (generation) に最適化: VQ-VAE は fine-grained pixel detail を捉えるが、semantic coherence が弱い tokens を出す。
- Semantics (understanding) に最適化: SigLIP embeddings は "cat" images を "cat" tokens の近くにまとめるが、良い reconstruction はできない。

Show-o と Transfusion は、このため片方向に visible quality tax を払う。Janus-Pro は問う。Tasks が違う要求を持つなら、なぜ1つの tokenizer を要求するのか。

## 概念

### Decoupled visual encoding の構造

Janus-Pro の architecture は2つの encoders を分ける:

- Understanding path。Input image → SigLIP-SO400m → 2-layer MLP → transformer body。
- Generation path。Input image (既存imageを condition する場合) → VQ tokenizer → token IDs → transformer body。
- Output generation。Transformer が予測した image tokens → VQ decoder → pixels。

Transformer body は共有される。Body の upstream と downstream は全て task-specific。

Inputs は prompt format で disambiguate される。`<understand>` tag は SigLIP に route し、`<generate>` は VQ に route する。または task から routing を暗黙に決める。

### これが機能する理由

Understanding loss は SigLIP features を受け取る。CLIP-style pretraining により semantic similarity に tuned されている。Input features が task に合うため、model の perception benchmarks は Show-o / Transfusion より改善する。

Generation loss は VQ tokens を受け取る。Tokenizer は reconstruction に tuned されている。VQ codes が pixels へ clean に compose されるため、image quality は Show-o より改善する。

Shared transformer body は2つの input distributions (SigLIP と VQ) を見て、両方で動くことを学ぶ。主張は、十分な data と parameters があれば body が switching を吸収する、というものだ。

### Data scaling — Janus と Janus-Pro

Janus (original, arXiv 2410.13848) は decoupling を導入したが、small scale (1.3B params, limited data) だった。Janus-Pro (arXiv 2501.17811) は scale した:

- 7B params (1.3B から拡大)。
- Stage 1 (alignment) の image-text pairs は 72M から 90M へ。
- Stage 2 (unified) は 26M から 72M へ。
- Stage 3 に 200k image-gen instruction samples を追加。

結果として、Janus-Pro-7B は MMMU で LLaVA に並び (60.3 vs ~58)、GenEval で DALL-E 3 を上回る (0.80 vs 0.67)。Unified spectrum の両側で competitive な1つの open model だ。

### JanusFlow — the rectified flow variant

JanusFlow (arXiv 2411.07975) は VQ generation path を rectified-flow generation path (continuous) に置き換える。Split は SigLIP-for-understanding + rectified-flow-for-generation になる。Quality ceilings はさらに上がる。Architecture は decoupled-encoders-shared-body のままだ。

### Shared body の役割

Transformer body は unified sequence を処理するが、2つの input distributions を持つ。その仕事は:

- Understanding: SigLIP features + text tokens を消費し、text を autoregressively に emit する。
- Generation: text tokens + (optional image VQ tokens) を消費し、image VQ tokens を autoregressively に emit する。

Body は blockごとの modality-specific weights を持たない。Qwen や Llama の内側にあると想像する text-style transformer に、2つの input adapters を足したものだ。

興味深いことに、これは Janus-Pro の body を pretrained LLM から initialize できることを意味する。Janus-Pro は DeepSeek-MoE-7B から initialize する。この選択は重要だ。LLM は reasoning ability を持ち込み、pure-from-scratch unified models が到達しにくい性能を支える。

### InternVL-U との比較

InternVL-U (Lesson 12.10) は2026年の follow-up だ。次を組み合わせる:

- Native multimodal pretraining (InternVL3 backbone)。
- Decoupled-encoder routing (SigLIP in, VQ + diffusion heads out)。
- Unified understanding + generation + editing。

InternVL-U は Janus-Pro の architectural choice をより大きな framework に取り込む。Decoupled-encoder idea は scale した unified models の default になった。

### 制約

Decoupled encoders は architectural complexity を増やす。Train すべき tokenizers が2つ、maintain すべき input paths が2つ、fail modes も2組ある。Generation が不要な products には Janus-Pro は over-engineered だ。LLaVA-family understanding model を選ぶ。

Understanding が不要な products には Janus-Pro は過剰だ。Stable Diffusion 3 / Flux model を選ぶ。

両方が必要な products には、Janus-Pro が現在の reference open architecture だ。

## 使ってみる

`code/main.py` は Janus-Pro routing を simulate する:

- 2つの mock encoders: SigLIP-like (256-dim semantic vectors を生成) と VQ-like (integer codes を生成)。
- Task tag に基づいて encoder を選ぶ prompt router。
- どちらの encoder が生成したかに関係なく token sequences を処理する shared body (stand-in)。
- Stage 1 (alignment) から Stage 3 (instruction tune) への weighted-sample schedule の切り替え。

Image QA、T2I、image editing の3例について routed paths を表示する。

## 仕上げ

このレッスンは `outputs/skill-decoupled-encoder-picker.md` を作る。Frontier-ish quality で unified generation + understanding を望む product に対し、Janus-Pro、JanusFlow、InternVL-U を選び、concrete data-scale recommendation を出す。

## 演習

1. Janus-Pro-7B は GenEval で DALL-E 3 を上回る。7B open model が generation では frontier proprietary model に並べるのに、understanding では並べない理由を説明せよ。

2. Router function を実装せよ。Prompt text が与えられたとき、`understand` または `generate` に分類する。"describe and then sketch" のような曖昧な prompt はどう扱うか。

3. JanusFlow は VQ path を rectified flow に置き換える。Transformer body は何を出力するようになり、loss は何が変わるか。

4. Janus-Pro architecture がもう1つ decoupled encoder を足すことで扱えそうな4つ目の task を提案せよ。例: image segmentation (DINO-style)、depth (MiDaS-style)。

5. Data scaling に関する Janus-Pro Section 4.2 を読め。Janus と比べた T2I quality gain に最も寄与する data stage はどれか。

## 重要語句

| 用語 | よく言われること | 実際の意味 |
|------|-----------------|------------------------|
| Decoupled encoding | "Two visual encoders" | 方向ごとに別の tokenizer または encoder を使う。Understanding には semantic、generation には reconstruction |
| Shared body | "One transformer" | 単一の transformer がどちらの encoder の output も処理する。Modality-specific weights はない |
| SigLIP for understanding | "Semantic features" | Rich conceptual features を提供する CLIP-family vision tower。ただし reconstruction は弱い |
| VQ for generation | "Reconstruction codes" | Pixels に clean に decode できる vector-quantized tokens |
| JanusFlow | "Rectified-flow variant" | VQ の代わりに continuous flow-matching generation head を持つ Janus-Pro |
| Routing tag | "Task tag" | Input encoder を選ぶ prompt marker (`<understand>` / `<generate>`) |

## 参考文献

- [Wu et al. — Janus (arXiv:2410.13848)](https://arxiv.org/abs/2410.13848)
- [Chen et al. — Janus-Pro (arXiv:2501.17811)](https://arxiv.org/abs/2501.17811)
- [Ma et al. — JanusFlow (arXiv:2411.07975)](https://arxiv.org/abs/2411.07975)
- [InternVL-U (arXiv:2603.09877)](https://arxiv.org/abs/2603.09877)
- [Dong et al. — DreamLLM (arXiv:2309.11499)](https://arxiv.org/abs/2309.11499)
