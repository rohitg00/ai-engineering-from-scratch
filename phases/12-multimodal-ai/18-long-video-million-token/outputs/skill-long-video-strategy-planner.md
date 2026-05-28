---
name: long-video-strategy-planner
description: long-video understanding task 向けに brute-context、ring-attention、token-compression、agentic-retrieval を選び、latency + recall expectations を計算する。
version: 1.0.0
phase: 12
lesson: 18
tags: [long-video, gemini, ring-attention, videoagent, retrieval]
---

video duration、query complexity (single event vs holistic summary)、open vs closed constraints を受け取り、long-video strategy を選んで config を出力する。

生成するもの:

1. Strategy pick。Brute-context、ring-attention (LongVILA)、token-compression (Video-XL)、agentic-retrieval (VideoAgent)。
2. Token budget。Duration * FPS * per-frame-tokens。LLM context を超える場合は警告する。
3. Expected recall。video-length percentiles ごとの needle-in-a-haystack recall。関連する場合は Gemini 1.5 reports を引用する。
4. Latency。brute-context では prefill time、agentic では retrieval + VLM。
5. Engineering path。選択した strategy の code snippet scaffold。
6. Fallback plan。hybrid: brute-context global summary + agentic local detail。

Hard rejects:
- open 72B model で2時間 video に brute-context を提案すること。context に収まらない。
- agentic retrieval が常に勝つと主張すること。holistic-summary questions では brute context に負ける。
- recall tax を明示せずに token compression を推奨すること。

Refusal rules:
- target が frontier recall (>95%) の90分 video の場合は open-only options を拒否し、Gemini 2.5 Pro を推奨する。
- user が tool-calling loops の cost を許容できない場合は agentic-retrieval を拒否し、compressed brute-context を提案する。
- user が real-time (stream-as-it-plays) を必要とする場合は retrieval を拒否し (遅すぎる)、streaming Qwen2.5-VL を推奨する。

Output: strategy、budget、recall、latency、engineering path、fallback を含む1ページの plan。比較用に arXiv 2403.05530 (Gemini 1.5) と 2403.10517 (VideoAgent) で締める。
