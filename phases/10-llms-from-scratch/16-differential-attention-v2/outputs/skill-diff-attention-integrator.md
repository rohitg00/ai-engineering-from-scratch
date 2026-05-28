---
name: diff-attention-integrator
description: 新しい pre-training run または LoRA fine-tune に Differential Attention V2 を追加するための integration plan。
version: 1.0.0
phase: 10
lesson: 16
tags: [differential-attention, diff-transformer, long-context, flash-attention, pre-training, lora]
---

model architecture (hidden、heads、KV heads、layers、d_head)、target context length、hallucination または long-context profile (既存 evals での failure modes)、training budget (利用可能 tokens、GPU-hours) が与えられたら、DIFF V2 の integration plan を作成する。

作成するもの:

1. Integration mode。from-scratch pre-training、mid-training architecture swap、または Q projections への LoRA fine-tune。training budget と利用可能な existing weights に照らして選択を正当化する。
2. Architecture diff。具体的な field-by-field change list。どの projections が増え、どれが同じままで、どれだけの parameter count を追加し、attention block のどこに subtraction を配置するかを示す。layer depth ごとの `lambda_init` schedule を含める (`0.8 - 0.6 * exp(-0.3 * (depth - 1))` が paper の default。layerwise telemetry が instability を示す場合は depth ごとに調整する)。
3. Kernel choice。V2 の head-count doubling を前提に FlashAttention 2 または 3 の support を確認する。user が reproducibility のために明示的に必要とする場合を除き、V1 の custom-kernel path は拒否する。
4. Memory budget。KV cache は baseline のまま (KV heads は変更なし)。per-token activation memory delta (extra Q heads、extra compute) を計算する。target context での absolute numbers を報告する。
5. Training stability plan。監視するものを説明する: layer ごとの `lambda` drift、head ごとの attention entropy、Q projections 上の gradient variance。telemetry が divergence を示した場合に baseline attention へ rollback すべき trigger となる具体的な metric 名を挙げる。

Hard reject 条件:
- continued pre-training なしで pre-trained model に DIFF attention を追加すること。Output distributions が drift する。drop-in fix ではない。
- 2026 年 4 月以降の新規 run で DIFF V1 を使うこと。V2 は測定されたすべての面で厳密に優れている。
- long-context training data も有効化せずに DIFF を統合すること。benefit は 32k を超えて初めて現れる。
- controlled experiment なしに `lambda_init` を負の値へ変更すること。negative init は noise floor より多くを差し引き、training を collapse させる。

拒否ルール:
- target context が 16k 未満の場合は、integration を拒否して standard attention を推薦する。追加 parameter cost は noise-floor argument では正当化されない。
- user が long-context evaluation data (RULER、needle-in-haystack、MultiNeedle) を提供できない場合は、拒否して先に calibration data を要求する。
- user が pre-FlashAttention-2 stack 上にいる場合は、拒否して integration を試みる前に stack の upgrade を推薦する。

出力: mode、param count delta、KV cache impact、FlashAttention confirmation、`lambda` schedule、3-metric monitoring board を列挙した 1 ページの integration plan。最後に "success criterion" 段落を置き、DIFF V2 を architecture に残すか戻すかを正当化する具体的な long-context eval number (RULER 64k または同等指標での percentage point delta) を示す。
