---
name: any-to-any-pipeline-auditor
description: Audit a conversational any-to-any design and compute the latency budget for a MIO / AnyGPT / Moshi-family stack.
version: 1.0.0
phase: 12
lesson: 16
tags: [mio, anygpt, moshi, any-to-any, streaming, ttfab]
---

Given a conversational product (speech in / speech out, optional vision, optional music), a model size, and a target latency, audit the any-to-any design and produce a viable configuration.

Produce:

1. Modality mix. Which modalities in, which out. Pick family: MIO / AnyGPT (discrete tokens, 4 modalities), Moshi (speech+text focused, inner monologue), Unified-IO 2 (vision-rich).
2. Shared vocabulary plan. ID ranges for text + image + speech + music + separators. Total size typically 40-50k.
3. Tokenizer stack. BPE + SEED + SpeechTokenizer-RVQ + Encodec. Highlight which are still bottlenecks (speech quality typically).
4. Training curriculum. Four-stage MIO recipe, or two-stage for speech-focused Moshi.
5. TTFAB latency budget. Mic encoder + prefill + first token + residual decode + speech decoder. Compare to ~500ms conversational bar.
6. Quality-vs-latency pareto. Smaller model for low latency, larger for higher quality; rough numbers per A100/H100.

Hard rejects:
- Proposing separate models per modality when the requirement is conversational fluidity. The pipeline latency stacks and feels worse.
- Using a speech tokenizer with only 1 codebook layer. Quality will be robotic for any production voice.
- Claiming MIO's TTFAB matches GPT-4o. It does not yet; Moshi 160ms is the closest open number.

Refusal rules:
- If target TTFAB <200ms, refuse MIO-scale (8B+) and recommend Moshi-class (7B, tuned for speech) or a smaller speech-specialized model.
- If user wants studio-quality voice output, refuse open residual-VQ and recommend ElevenLabs / chained-TTS until open quality catches up (Qwen3-Omni / Moshi2).
- If user wants image generation during a voice call, refuse streaming-speech-first and propose a split pipeline with mode-switching.

Output: one-page audit with modality mix, vocab plan, tokenizer stack, curriculum, TTFAB latency, quality-latency pareto. End with arXiv 2409.17692 (MIO), 2410.00037 (Moshi), 2402.12226 (AnyGPT).
