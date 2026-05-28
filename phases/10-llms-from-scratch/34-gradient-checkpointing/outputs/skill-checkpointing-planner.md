---
name: checkpointing-planner
description: training config と HBM budget をもとに、layer ごとの activation recomputation policy (none / selective / full / offload) を選ぶ。
version: 1.0.0
phase: 10
lesson: 34
tags: [gradient-checkpointing, activation-recomputation, selective-checkpoint, fsdp-offload, training-memory]
---

Training config (layer count L、hidden size d、sequence length S、microbatch B、dtype bytes per value、attention kernel、tensor-parallel degree TP、pipeline-parallel degree PP、MoE の場合は expert-parallel degree EP) と、weights と optimizer state を除いた per-rank HBM budget が与えられたら、次を出力します。

1. Per-layer policy。Stack 内の各 layer family (embedding、attention、FFN、MoE expert、norm、output head) について、none、selective、full、offload のいずれかを選びます。S が 4_096 を超える場合は attention を selective にするのを default とします。Residual streams と norms は none を default とします。FFN で offload を default にするのは、その layer の activations に対する measured PCIe transfer time が measured recompute time より短い場合だけです。
2. Segment size k。Full checkpointing が有効なら、uniform layer cost では k を round(sqrt(L)) として選び、activation memory が budget を支配する場合はより小さい k を選びます。Extra FLOP percentage を forward FLOPs の (1/k) として報告します。
3. FlashAttention interaction。Attention kernel がすでに softmax を recompute しているか確認します。している場合、selective attention checkpointing の利点は小さいため none に downgrade します。Kernel 名 (FlashAttention-2/3、xFormers memory-efficient、vanilla) を明記します。
4. TP / PP plan。TP では、recompute 時に gather または rescatter が必要な activations と、追加される per-step communication bytes を示します。PP では、reverse microbatches が戻る前に activation memory を解放できるよう、どの pipeline stages を end-to-end で checkpoint するか確認します。
5. Budget math。Policy 適用前後の activation memory を予測します (MB per rank)。FLOP overhead を fwd+bwd に対する percent として予測します。10 percent headroom を含めて HBM budget に収まらない plan は拒否します。

Attention だけの selective で budget を満たせる場合、every layer の full checkpointing は拒否します。同じ memory savings に対して FLOP overhead が selective より何倍も高く、正確な比率は workload-specific です。Target PCIe link 上で layer の measured activation transfer time が measured recompute time を超える場合、offload は拒否します。Recompute の方が勝ちます。選んだ framework が amax history を snapshot しない FP8 training では、"checkpoint everywhere" を拒否します。Recompute により scale が drift し、gradients が silent に破損します。

Example input: "L=64, d=8192, S=8192, B=1, bf16, FlashAttention-3, TP=8, PP=4, HBM budget per rank 32 GB after weights, MoE with 8 experts and EP=8."

Example output:
- Per-layer policy: attention selective, FFN none, MoE expert full, embedding none, output head offload.
- Segment size: full は MoE のみに k=8 で適用。FLOP overhead は expert path で 12 percent、それ以外は 0。
- FlashAttention interaction: FA-3 はすでに softmax を recompute する。Selective は kernel 内ではなく layer wrapper で行う。
- TP / PP plan: recompute 時に attention input の TP gather、extra comms は step あたり 0.3 GB。PP stages はそれぞれ full forward を checkpoint する。PP stage 3 は final backward のため activations を保持する。
- Budget math: policy なしでは activations 38 GB、policy ありでは 11 GB。Total FLOP overhead は fwd+bwd の 7.5 percent。
