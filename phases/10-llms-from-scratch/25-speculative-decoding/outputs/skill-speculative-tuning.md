---
name: speculative-tuning
description: decode workload を profile し、speculative decoding の draft model、draft length K、temperature gate、fallback policy を選ぶ。
version: 1.0.0
phase: 10
lesson: 25
tags: [speculative-decoding, draft-model, alpha, throughput, inference, decode-latency]
---

Target model (size、family、tokenizer)、workload telemetry (task mix、prompt-vs-decode token ratio、p50/p99 decode latency、accelerator と HBM headroom、average batch size、sampling temperature distribution)、利用可能な draft checkpoints が与えられたら、次を出力します。

1. Draft choice。同一 family の small model (Llama-3.2-1B for Llama-70B)、distilled draft (Qwen3-0.6B-spec)、target に追加した Medusa heads、または FLOP cost ratio が 30 percent より近い draft がない場合は "no spec decode" から選びます。Target との tokenizer match を byte-for-byte で確認し、tokenizer が一致しない場合は拒否します。
2. Draft length K。E[tokens] / (1 + K x c) の argmax を選びます。ここで c は draft-to-target cost ratio です。In-distribution data 5_000 tokens の calibration run で測定した alpha を使い、K が 2, 3, 4, 5, 6 の場合の計算を示します。Default は chat で K=4、code で K=6、高 temperature の creative writing で K=2 です。
3. Temperature gate。これを超えると spec decode を無効化する temperature threshold を設定します。Default は 0.8 です。Calibration で alpha がそれより早く崩れる場合は 0.6 まで下げます。Per-request inspection に 50 microseconds を超える追加時間を要する temperature gate は拒否します。
4. Tree budget。Serving stack が tree drafting をサポートする場合、batch under 8 では小さな fixed tree (depth 2, branch 3-2)、batch over 32 では flat chain を選びます。Verifier の KV scratch size を bytes で示し、HBM headroom に収まることを確認します。
5. Fallback policy。Server がその request stream で plain autoregressive decode に戻る指標 (last 1_000 verifies にわたる sliding-window measured alpha) と threshold (alpha under 0.4) を指定します。Fallback decision の per-request lifetime も含めます。

Verifier が compute-bound になる点を超える batch size では spec decode を拒否します。その点を超えると、speculator が吸収するはずだった未使用 FLOPs は存在せず、throughput が低下します。Measured alpha が 0.4 未満の task family では spec decode を拒否します。Draft overhead が支配的になり、wall-clock latency が悪化します。Target に対して held-out 1_000-token sample で validation されていない draft は拒否します。未検証の draft は silent KL drift です。

Example input: "Llama-3.3-70B on 8xH100, chat workload, batch 16, p50 decode 28 ms, p99 60 ms, temperature distribution mean 0.4 / max 1.2, calibration shows alpha 0.78 on chat, 0.61 on code."

Example output:
- Draft: Llama-3.2-1B-Instruct-spec。同じ tokenizer、同じ family、ratio c approx 0.03。
- K: 4。E[tokens/verify] = 3.4 chat, 2.5 code。K=5 は chat で 0.1 token しか増えず、0.03 extra c を払うため reject。
- Temperature gate: 0.8。0.8 を超えると calibration set 上で alpha が 0.45 未満に落ちる。
- Tree budget: depth 2 branch (3, 2)。Batch 16 で KV scratch 480 MB は収まる。
- Fallback: last 1_000 verifies にわたる sliding-window alpha が 0.40 未満なら、その stream では 30 s の間 spec decode を無効化し、その後ふたたび probe する。
