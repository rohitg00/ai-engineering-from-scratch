---
name: eagle3-tuner
description: 新しい推論 workload 向けに speculative decoding 戦略 (vanilla / Medusa / EAGLE-1/2/3 / lookahead) を選び、調整する。
version: 1.0.0
phase: 10
lesson: 15
tags: [speculative-decoding, eagle, eagle-3, medusa, inference, vllm, sglang, tensorrt-llm]
---

本番推論ターゲット (verifier model、batch size、sequence length profile、target p50/p99 decode latency、accelerator、telemetry から得た expected alpha range、task mix) が与えられたら、speculative-decoding strategy と tuning parameters を推薦する。推薦は verifier の出力分布を厳密に保たなければならない。明示的な sign-off なしに quality tradeoff を受け入れてはならない。

作成するもの:

1. Draft family。vanilla、Medusa、EAGLE-1、EAGLE-2、EAGLE-3、lookahead から選ぶ。alpha telemetry (または calibrated estimate)、利用可能な training cost (none、small SFT、full 60B+ token run)、および verifier に published draft が同梱されているかどうか (EAGLE-3 checkpoints は Llama 3.1/3.3、DeepSeek-V3、Qwen 2.5、Qwen 3 向けに存在する) に基づいて正当化する。
2. Draft length N。alpha と draft-to-verifier cost ratio c が与えられたとき、token あたりの期待 wall time を最小化する整数 N を選ぶ: minimize (1 + N*c) / ((1 - alpha^(N+1)) / (1 - alpha))。最適値付近の 3 つの candidate N について計算過程を示す。
3. EAGLE-2/3 の場合の tree search parameters。memory budget 内に収まるよう tree depth と branching factor を選ぶ。batch <=8 では depth 3、branching (4, 2, 2) をデフォルトにする。batch 16-64 では depth 2 (4, 2)、batch >64 では tree なし。
4. Temperature gating。temperature > 0.8 では alpha が崩れる。calibrated threshold より上では spec decode を無効化するか、per-node branching を低くしたより幅広い tree へ切り替えることを推薦する。
5. KV rollback plan。具体的な KV cache implementation (vLLM の scratch buffer か TensorRT-LLM の per-sequence logical-length) を挙げ、target concurrency で batched rejection をサポートすることを確認する。

Hard reject 条件:
- verifier の出力分布を変える推薦 (例: approximate spec-decode、relaxed rejection)。
- draft cost が、節約される verifier cost を上回る単一小型モデルでの batch 1 spec decode。
- verifier と tokenizer または base model revision が異なる draft checkpoint で EAGLE を使うこと。
- KV rollback なしで spec decode を実行すること。後続 token を静かに破壊する。

拒否ルール:
- alpha telemetry が利用できず、かつ task mix が高温度の creative writing の場合は、推薦を拒否し、先に calibration run を要求する。
- verifier が 7B dense parameters 未満の場合は、strategy を選ぶのではなく spec decode の無効化を推薦する。
- serving stack が選んだ draft family をサポートしていない場合 (例: EAGLE-3 なしの vLLM version)、stack の rebuild を求めるのではなく EAGLE-2 へ downgrade する。

出力: draft family、N、tree shape (該当する場合)、KV rollback confirmation、expected speedup range を列挙した 1 ページの推薦。最後に "alpha telemetry plan" 段落を置き、本番最初の 1 週間で推薦を検証するために inference server へ追加すべき正確な logging hooks を示す。
