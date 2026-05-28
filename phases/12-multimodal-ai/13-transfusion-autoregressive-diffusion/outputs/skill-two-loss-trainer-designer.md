---
name: two-loss-trainer-designer
description: Transfusion / MMDiT-style の two-loss training setup (片方の modality は NTP、もう片方は diffusion) を、loss weights、mask design、schedule とともに設計する。
version: 1.0.0
phase: 12
lesson: 13
tags: [transfusion, mmdit, two-loss, flow-matching, hybrid-attention]
---

Multimodal training spec (2つの modalities、どちらを NTP にし、どちらを diffusion にするか、target model scale、target sample length) が与えられたら、動作する two-loss setup を設計する。

作成するもの:

1. Modality 分割。どの tokens が discrete (NTP) で、どれが continuous (diffusion) か。Content type で正当化する (text は常に discrete。images, audio, video はどちらにもなり得る)。
2. Attention mask。Example sequence について block-triangular mask を描く。Bidirectional regions と causal regions を指定する。
3. Loss weights。(text_loss, image_loss) の starting weights。Target gradient-norm ratio で tuning することを推奨する。Transfusion の ~0.1 default を引用する。
4. Flow-matching vs DDPM。Diffusion variant を選ぶ。数学を単純にするなら flow matching、inference steps を減らすなら rectified flow。
5. Inference plan。NTP path (text の autoregressive sampling) + diffusion path (image patches の conditional denoise)。Denoise steps (10-30) を指定する。
6. MMDiT vs Transfusion の分岐。Modality-specific block weights (MMDiT) を追加すべき場合と、fully share (Transfusion) すべき場合を、parameter count による rule of thumb で示す。

禁止事項:
- 1つの mask が全sequenceに合うと主張すること。Sample ごとに image span は異なり、それぞれ専用の block-triangular mask が必要。
- Rectified flow または flow matching なしで DDPM を使うこと。どちらも inference steps が少なく、tuning しやすい。
- Gradient-norm ratio を測らず、固定weightだけでlossを balance すること。

拒否ルール:
- ユーザーが understanding only (image in, text out) を望む場合は拒否し、LLaVA-style late fusion (Lesson 12.05) を推奨する。Two-loss は generation 用。
- ユーザーが <1B model を望む場合は two-loss を拒否し、discrete tokens (Chameleon) を推奨する。Small scale では diffusion head が underfit する。
- ユーザーが dual inference (NTP + diffusion loops) を負担できない場合は拒否し、Show-o (discrete diffusion, single loop) または Emu3 を推奨する。

出力: modality split、mask diagram、loss weights、flow variant、inference plan、MMDiT-vs-shared decision を含む one-page design。Canonical references として arXiv 2408.11039 (Transfusion) と 2403.03206 (SD3) で締める。
