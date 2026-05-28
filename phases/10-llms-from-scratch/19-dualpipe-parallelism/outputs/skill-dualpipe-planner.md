---
name: dualpipe-planner
description: training cluster 向けに pipeline parallelism strategy (1F1B, Zero Bubble, DualPipe, DualPipeV) を計画する。
version: 1.0.0
phase: 10
lesson: 19
tags: [pipeline-parallelism, dualpipe, dualpipev, zero-bubble, expert-parallelism, distributed-training]
---

training cluster specification (total GPU count、interconnect topology、accelerator model、memory per GPU)、model shape (total params、active params、MoE or dense、expected layer count)、target training-data volume が与えられたら、pipeline parallelism strategy を推奨し、expected bubble fraction を確認する。

作成するもの:

1. Pipeline depth P。GPU memory budget (rank あたり 1 pipeline stage が収まる必要がある)、MoE vs dense、interconnect bandwidth に基づいて選ぶ。範囲: small clusters では 4、frontier MoE training では 16-32。
2. Micro-batch count M。DualPipe と DualPipeV では 2 で割り切れる必要がある。typical ratio M/P は 8 から 16。gradient-accumulation targets と target sequence length における activation memory に照らして正当化する。
3. Schedule choice。1F1B、Zero Bubble、DualPipe、DualPipeV から選ぶ。decision table: 500 GPUs 未満の dense training -> Zero Bubble。expert parallelism を伴う MoE -> DualPipe。heavy all-to-all のない 500 GPUs 超の dense training -> DualPipeV。100 GPUs 未満の small runs -> 1F1B で十分。
4. Expected bubble fraction。target P と M で chosen schedule について計算する。percentage と、total training budget において 1F1B 比で節約される absolute GPU-hours として報告する。
5. Parameter replication plan (DualPipe only)。2x parameter replication が available VRAM に収まることを確認する。chosen P に対する GPU あたりの effective parameter density を報告する。

即時拒否:
- Expert Parallelism なしの DualPipe。hide すべき EP-heavy comms がない場合、2x replication は正当化できない。
- どの training run でも P > 64。schedule に関係なく bubble fraction は P に対して linear に増える。
- DualPipe/DualPipeV で micro-batch count が 2 で割り切れない場合。schedule が閉じない。
- model が 1 GPU の memory に収まる場合の pipeline parallelism。data parallelism のみを使う。

拒否ルール:
- interconnect が GPU あたり 200Gbps 以下の場合、DualPipe を拒否し DualPipeV を推奨する。all-to-all overlap window が狭すぎて replication を正当化できない。
- user が cluster topology に適した custom all-to-all kernel を提供できない場合、DualPipe ではなく Zero Bubble を推奨する。
- training run が 1B tokens 未満の場合、pipeline parallelism planning 全体を拒否し、data parallelism と tensor parallelism を推奨する。

出力: P、M、schedule、expected bubble fraction、parameter replication cost (DualPipe の場合)、all-to-all kernel recommendation を列挙した one-page plan。最後に "rollback trigger" paragraph を付ける。target number に届かない場合に simpler schedule へ切り替える根拠となる specific utilization metric (最初の 1000 steps で測定した aggregate GPU utilization percentage) を明記する。
