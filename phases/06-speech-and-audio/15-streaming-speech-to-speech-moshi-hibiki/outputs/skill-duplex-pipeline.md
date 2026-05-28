---
name: duplex-pipeline
description: 音声エージェントのワークロードに対して full-duplex (Moshi) と pipeline (VAD + STT + LLM + TTS) architecture のどちらを選ぶか決める。
version: 1.0.0
phase: 6
lesson: 15
tags: [moshi, hibiki, full-duplex, voice-agent, streaming]
---

ワークロード (latency target、tool-calling needs、language coverage、hardware budget、cloud vs edge) が与えられたら、次を出力します。

1. Architecture。Full-duplex (Moshi / GPT-4o Realtime / Gemini Live) か pipeline (LiveKit + STT + LLM + TTS, Lesson 12)。理由を 1 文で述べます。
2. Model。Moshi · Hibiki · Hibiki-Zero · Sesame CSM · GPT-4o Realtime · Gemini 2.5 Live · traditional pipeline。理由を述べます。
3. Scale。Per-session GPU cost (Moshi は slot を保持)、最大 concurrent sessions、cold-start impact。
4. Tool-calling path。必要なら hybrid pipeline (duplex + external LLM for tool calls) か pure pipeline。trade-off を説明します。
5. Language coverage。Full-duplex models は言語対応が狭いです。pipelines は LLM の multilingual capability を継承します。

tool-calling / retrieval が必要な enterprise agents では full-duplex-only architecture を拒否します。Moshi は dialogue model であって agent framework ではありません。sub-250 ms conversational agents に pipeline-only を拒否します。段の合計が大きくなるためです。1 GPU で &gt; 4 concurrent sessions の Moshi を拒否します。contention に当たります。

Example input: "Voice companion for language learning — conversational fluency practice. English + French. &lt; 250 ms responsiveness. 10k daily actives."

Example output:
- Architecture: full-duplex (Moshi)。sub-250 ms latency requirement と conversational fluency が Moshi の強みに合います。
- Model: Moshi。EN + FR はどちらも十分対応。CC-BY 4.0 license。
- Scale: one L4 GPU per 4-6 concurrent sessions → 10k DAU、10% concurrency の peak では約 1500 GPUs。quiet path には Kyutai Pocket TTS + local Whisper を使う on-device light mode を計画します。
- Tool calling: 最小限。"reveal grammar hint" と "translate this phrase" は小さな LLM sidecar へルーティングできます。やりとりの大半は Moshi が得意な open-ended dialogue です。
- Language coverage: EN + FR (native)。ES / DE / JP は Hibiki-Zero adaptation 経由 (新言語ごとに 1000 h の音声が必要)。
