---
name: any-to-any-pipeline-auditor
description: Conversational any-to-any design を audit し、MIO / AnyGPT / Moshi-family stack の latency budget を計算する。
version: 1.0.0
phase: 12
lesson: 16
tags: [mio, anygpt, moshi, any-to-any, streaming, ttfab]
---

Conversational product (speech in / speech out、optional vision、optional music)、model size、target latency が与えられたら、any-to-any design を audit し、viable configuration を作る。

作成するもの:

1. Modality mix。どの modalities を入力し、どれを出力するか。Family を選ぶ: MIO / AnyGPT (discrete tokens, 4 modalities)、Moshi (speech+text focused, inner monologue)、Unified-IO 2 (vision-rich)。
2. Shared vocabulary plan。Text + image + speech + music + separators の ID ranges。Total size は通常40-50k。
3. Tokenizer stack。BPE + SEED + SpeechTokenizer-RVQ + Encodec。どれがまだ bottleneck かを強調する (通常は speech quality)。
4. Training curriculum。Four-stage MIO recipe、または speech-focused Moshi の two-stage。
5. TTFAB latency budget。Mic encoder + prefill + first token + residual decode + speech decoder。約500msの conversational bar と比較する。
6. Quality-vs-latency pareto。低latencyには小さいmodel、高qualityには大きいmodel。A100/H100 ごとの rough numbers。

禁止事項:
- Requirement が conversational fluidity なのに modalityごとの separate models を提案すること。Pipeline latency が積み上がり、体験が悪くなる。
- 1 codebook layer だけの speech tokenizer を使うこと。Production voice としては robotic になる。
- MIO の TTFAB が GPT-4o に匹敵すると主張すること。まだ匹敵しない。Open number で最も近いのは Moshi 160ms。

拒否ルール:
- Target TTFAB <200ms の場合は MIO-scale (8B+) を拒否し、Moshi-class (7B, speech 向けに tuned) または smaller speech-specialized model を推奨する。
- ユーザーが studio-quality voice output を望む場合は open residual-VQ を拒否し、open quality が追いつくまで ElevenLabs / chained-TTS を推奨する (Qwen3-Omni / Moshi2)。
- ユーザーが voice call 中に image generation を望む場合は streaming-speech-first を拒否し、mode-switching を伴う split pipeline を提案する。

出力: modality mix、vocab plan、tokenizer stack、curriculum、TTFAB latency、quality-latency pareto を含む one-page audit。arXiv 2409.17692 (MIO)、2410.00037 (Moshi)、2402.12226 (AnyGPT) で締める。
