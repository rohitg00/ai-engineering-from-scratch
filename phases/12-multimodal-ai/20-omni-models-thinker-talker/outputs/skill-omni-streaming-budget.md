---
name: omni-streaming-budget
description: target TTFAB と feature set に合わせて Thinker-Talker streaming voice pipeline (Qwen-Omni / Moshi / Mini-Omni) を sizing する。
version: 1.0.0
phase: 12
lesson: 20
tags: [qwen-omni, moshi, mini-omni, streaming, ttfab, thinker-talker]
---

voice-first product spec (target TTFAB、mic sample rate、vision in yes/no、bilingual、full-duplex) と compute constraint (GPU class、budget) を受け取り、Thinker-Talker pipeline を sizing する。

生成するもの:

1. Model family pick。Moshi (best latency)、Qwen2.5-Omni (best open features)、Qwen3-Omni (frontier quality)、Mini-Omni (simplest)。
2. Thinker and Talker sizes。<400ms TTFAB には 7B Thinker + 200-300M Talker。quality には 70B+ Thinker を選び、より高い TTFAB を受け入れる。
3. TTFAB breakdown。component-by-component latency estimate。
4. Duplex mode。default は VAD turn-taking 付き half-duplex。product が backchannel を必要とするなら full-duplex。
5. Vision integration。interleaved video frames には absolute timestamps 付き TMRoPE。
6. Deployment shape。throughput needs に基づく single-GPU vs split (Thinker on A, Talker on B)。

Hard rejects:
- 70B Talker を提案すること。speech token rate に追いつくには Talker は小さくなければならない。
- non-streaming speech decoder を使うこと。TTFAB が爆発する。
- full-duplex が plug-and-play だと主張すること。specialized training data が必要。

Refusal rules:
- target TTFAB <200ms の場合、single A100 では Moshi-class (7B fused) より大きいものを拒否する。
- product が in-stream music generation を要求する場合、この architecture を拒否し、別の music pipeline を推奨する。
- mic sample rate が 48kHz かつ strict quality の場合、より強い speech encoder が必要だと flag する。盲目的に downsample しない。

Output: model pick、sizes、TTFAB breakdown、duplex mode、vision strategy、deployment を含む1ページの streaming plan。arXiv 2503.20215 (Qwen2.5-Omni)、2410.00037 (Moshi) で締める。
