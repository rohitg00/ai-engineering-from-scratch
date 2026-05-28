---
name: nsa-integrator
description: long-context pre-training run に Native Sparse Attention を統合する計画。
version: 1.0.0
phase: 10
lesson: 17
tags: [nsa, sparse-attention, long-context, pre-training, kernel-aligned, deepseek]
---

long-context pre-training run specification (target context、base architecture、利用可能な training tokens、GPU topology、deployment target) が与えられたら、NSA integration plan を作成する。

作成するもの:

1. Compression block size `l`。32、64、128 から選ぶ。target context に照らして正当化する。16k-32k では `l = 32`、64k-128k では `l = 64`、256k-plus では `l = 128`。大きな `l` は compressed keys を減らすが、routing signal は粗くなる。
2. Top-k selection count。8 から 32 の間で選ぶ。paper の default は 16。target task mix に照らして正当化する。reasoning-heavy tasks (math、code) は、selection precision がより重要なため高い `k` の恩恵を受ける。retrieval-heavy tasks は低い `k` でも機能する。
3. Sliding window `W`。256、512、1024 から選ぶ。default は 512。local context で十分な heavily structured content (code) では短く、prose では長くする。
4. Gate MLP。width と initialization を指定する。default: `hidden` から 3 への linear layer に、`sigmoid` または `softplus` activation。gate weights が 1 つの branch に collapse する場合は警告する。これは `l`、`k`、または `W` の tuning が外れていることを示す。
5. Kernel choice。target accelerator で Triton または CUDA kernel が利用可能か確認する。inference で dense attention fallback は拒否する (NSA の目的は decode compute を節約することだから)。forward kernels しかなく backward がない場合は、pre-training を拒否し、既存 dense checkpoints に対する continued training を推奨する。

即時拒否:
- continued pre-training なしに、dense attention で pre-trained された model に NSA を適用すること。inference で後付けはできない。
- target context が 16k 未満。three-branch overhead が支配的になる。
- NSA kernel support のない stack での inference-only deployments。代わりに MLA または sliding-window attention を推奨する。

拒否ルール:
- long-context evaluation data (RULER、LongBench、needle-in-haystack) が利用できない場合は拒否し、先に calibration data を要求する。
- training-data context distribution が short sequences に支配されている場合は拒否し、NSA 統合の前に data reweighting を推奨する。
- accelerator が A100 より古い場合は拒否する。NSA の kernel advantages は H100/H200/MI300 memory hierarchies を前提にしている。

出力: `l`、`k`、`W`、gate config、kernel path、target context で期待される compute savings を列挙した one-page integration plan。最後に "success criterion" paragraph を付ける。NSA を維持する根拠となる specific RULER または LongBench number (matched dense-attention baseline に対する percentage points) を示す。rollback trigger も含める。その threshold を下回ったら architecture を MLA または dense GQA に戻す。
