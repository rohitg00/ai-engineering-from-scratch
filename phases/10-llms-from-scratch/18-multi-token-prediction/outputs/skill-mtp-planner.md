---
name: mtp-planner
description: 新しい pre-training run に multi-token prediction を統合する計画。
version: 1.0.0
phase: 10
lesson: 18
tags: [mtp, multi-token-prediction, deepseek-v3, pre-training, speculative-decoding]
---

pre-training run specification (model scale、hidden size、layers、data tokens budget、GPU topology、target deployment) と、明示された goal (denser training signal vs speculative-decoding draft vs both) が与えられたら、MTP integration plan を作成する。

作成するもの:

1. Depth D。1 または 2 を選ぶ。DeepSeek-V3 は D=1 を使い、first-depth speculative-decoding acceptance が 80%+ だと報告している。D=2 はほとんどの runs で diminishing-returns territory である。compute budget に照らして選択を正当化する。extra depth ごとに、training step あたりおおよそ transformer block 1 つ分の compute が追加される。
2. Lambda schedule。default: training の最初の 10% は 0.3、その後は 0.1。小さな models (7B 未満) では denser signal がより重要なので early に最大 0.5 まで上げる。MTP loss が main loss を支配している場合は下げる。
3. Parameter budget。main model に対する per-module parameter count を報告する。overhead が main parameters の 5% 未満 (dense) または 3% 未満 (MoE) であることを確認する。
4. Memory and compute overhead。step あたりの extra forward-pass FLOPs (おおよそ `D * transformer_block_cost`)、extra backward-pass memory (D modules の activation memory)、extra peak VRAM (shared embedding と head は数えず、projection と transformer block は数える) を定量化する。
5. Inference-time wiring。MTP module を inference で speculative-decoding draft として consume する方法を説明する。Leviathan rule integration path と KV-rollback bookkeeping を名指しする。target inference stack (vLLM、SGLang、TensorRT-LLM) との compatibility を確認する。

即時拒否:
- MTP なしで pre-trained された dense model に MTP を追加すること。retrofit はできない。MTP modules が訓練されていないためである。
- 初回 integration で D > 2。D=1 からの gain は小さく、complexity は急速に増える。
- active parameters が 1B 未満の model で MTP を使うこと。その scale では signal が overhead cost より弱い。
- goal が speculative decoding なのに parallel (Gloeckle-style) heads を使うこと。causally に chain しないためである。

拒否ルール:
- pre-training data が short sequences (2k 未満) に支配されている場合は拒否する。MTP gains は depth-2 supervision が意味を持つだけの十分に長い sequences を前提にする。
- target inference stack が speculative decoding をまったく support しない場合、MTP はそれでも denser training signal をもたらすと述べて進めるが、mismatch として flag する。
- user が MTP なしの既存 dense checkpoint で continued pre-training している場合は拒否し、clean training run の開始時、または clean data-boundary reset のタイミングでのみ MTP を追加するよう推奨する。

出力: D、lambda schedule、parameter overhead (absolute and percentage)、compute overhead (training step あたりの percentage)、inference-time speculative-decoding wiring plan を列挙した one-page integration plan。最後に "success criterion" paragraph を付ける。MTP を維持する根拠となる measured metric を明記する。50B training tokens 後の depth 1 acceptance rate が 70% を超えていなければ、architecture を戻すべきである。
