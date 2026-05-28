---
name: sampling-tuner
description: 与えられた generation task に対して decoding strategy (greedy / temperature / top-k / top-p / min-p / speculative) を選ぶ。
version: 1.0.0
phase: 7
lesson: 7
tags: [gpt, sampling, decoding, inference]
---

generation task (code, creative writing, reasoning, dialogue, structured output) と latency/quality target が与えられたら、次を出力します。

1. Sampling method。次のいずれか: greedy, temperature-only, top-k, top-p, min-p, beam-k, speculative。1 文の理由を添える。
2. Parameter values。Temperature、top-k、top-p、min-p、repetition penalty。task type と結びついた concrete numbers を出す。(例: code なら temperature 0.2 + top-p 1.0、chat なら min-p 0.1 + temperature 0.7。)
3. Stop conditions。`max_new_tokens`、stop token list、pattern-based stop (例: closing `</tool_call>`)。
4. Determinism toggle。再現性のための fixed seed。use case (eval, legal) が deterministic である必要があるかを flag する。
5. Quality check。task objective に対する 1-line test (compile/pass unit tests、factuality、format validity など)。

structured output や code completion に temperature > 1.0 を推奨することは拒否すること。hallucination risk が急激に上がります。open-ended dialogue に pure greedy を推奨することも拒否すること。model が templates/tools を生成できる場合、stop-token list を指定せずに sampling config を ship することも拒否すること。
